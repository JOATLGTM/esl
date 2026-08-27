import assert from "node:assert/strict";
import { test, describe, before, after } from "node:test";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/**
 * Row-level security, proved rather than assumed (PRD F1: "RLS verified: a user
 * cannot read another user's rows").
 *
 * Reading the policies is not evidence. A policy can be syntactically perfect
 * and attached to the wrong table, or right on select and missing on update, or
 * silently dropped by a later migration. So this test creates two real users,
 * has one write real rows, and asks the other for them.
 *
 * It needs a project it is safe to create throwaway users in -- a local stack
 * or a scratch project, never production -- so it is opt-in:
 *
 *   RLS_TEST_ENABLED=1 npm run test:rls
 *
 * Without that it skips loudly rather than passing quietly, because a security
 * test that silently no-ops is worse than no test at all.
 */

import { PUBLISHABLE, SECRET, SUPABASE_URL, skipReason } from "./helpers/supabase-env";

const URL_ = SUPABASE_URL;
const skip = skipReason;

type Actor = { user: User; db: SupabaseClient };

let admin: SupabaseClient;
let alice: Actor;
let bob: Actor;
let anon: SupabaseClient;
let chunkId: string | null = null;

async function makeUser(tag: string): Promise<Actor> {
  const email = `rls-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const password = `pw-${Math.random().toString(36).slice(2)}-A1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.equal(error, null, `could not create ${tag}: ${error?.message}`);

  const db = createClient(URL_!, PUBLISHABLE!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await db.auth.signInWithPassword({ email, password });
  assert.equal(signIn.error, null, `could not sign in ${tag}: ${signIn.error?.message}`);
  return { user: data.user!, db };
}

describe("row-level security", { skip }, () => {
  before(async () => {
    admin = createClient(URL_!, SECRET!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    anon = createClient(URL_!, PUBLISHABLE!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    alice = await makeUser("alice");
    bob = await makeUser("bob");

    // A real chunk to hang cards off, if content has been seeded.
    const { data } = await admin.from("chunks").select("id").limit(1);
    chunkId = data?.[0]?.id ?? null;
  });

  after(async () => {
    for (const actor of [alice, bob]) {
      if (actor?.user) await admin.auth.admin.deleteUser(actor.user.id);
    }
  });

  test("signing up creates exactly one profile row, owned by that user", async () => {
    const { data, error } = await alice.db.from("users").select("id");
    assert.equal(error, null, error?.message);
    // Not "the first row is Alice" -- the whole visible set is one row. That is
    // the difference between a filter and an isolation guarantee.
    assert.deepEqual(data?.map((r) => r.id), [alice.user.id]);
  });

  test("a learner cannot read another learner's rows", async () => {
    const { error: writeError } = await alice.db
      .from("known_words")
      .insert({ user_id: alice.user.id, word: "hello" });
    assert.equal(writeError, null, writeError?.message);

    const { data, error } = await bob.db.from("known_words").select("word");
    assert.equal(error, null, error?.message);
    assert.deepEqual(data, [], "Bob can see Alice's known words");
  });

  test("a learner cannot write rows owned by someone else", async () => {
    const { error } = await bob.db
      .from("known_words")
      .insert({ user_id: alice.user.id, word: "forged" });
    assert.notEqual(error, null, "Bob inserted a row owned by Alice");

    // And it did not land anyway.
    const { data } = await admin
      .from("known_words")
      .select("word")
      .eq("user_id", alice.user.id);
    assert.deepEqual(data?.map((r) => r.word).sort(), ["hello"]);
  });

  test("a learner cannot update another learner's profile", async () => {
    const { error } = await bob.db
      .from("users")
      .update({ total_xp: 999_999 })
      .eq("id", alice.user.id);
    // Postgres reports zero rows affected rather than an error -- the row is
    // invisible, so there is nothing to update. Either way the value must not
    // have moved.
    void error;
    const { data } = await admin.from("users").select("total_xp").eq("id", alice.user.id).single();
    assert.equal(data?.total_xp, 0);
  });

  test("a learner cannot forge a profile row for another uuid", async () => {
    // `users` has no insert policy at all: the row is created by the signup
    // trigger. This closes the window where a client could claim a uuid.
    const { error } = await bob.db.from("users").insert({ id: alice.user.id });
    assert.notEqual(error, null, "a client inserted a profile row directly");
  });

  test("signed-out visitors read content and see no learner data", async () => {
    const { data: content, error: contentError } = await anon.from("units").select("id").limit(1);
    assert.equal(contentError, null, contentError?.message);
    assert.ok(Array.isArray(content), "anon cannot read the curriculum");

    const { data: leaked } = await anon.from("users").select("id");
    assert.deepEqual(leaked ?? [], [], "anon can read learner profiles");
  });

  test("nobody but the seed script can write content", async () => {
    const forged = { id: "b9_u9", block: 1, order: 99, title_es: "x", title_en: "x",
      cefr: "A0", can_do_es: "x", target_contrast: "ee_ih" };
    for (const [who, db] of [["anon", anon], ["a learner", alice.db]] as const) {
      const { error } = await db.from("units").insert(forged);
      assert.notEqual(error, null, `${who} wrote to the curriculum`);
    }
  });

  test("a card cannot be marked learned without two production passes (PRD F2)", async (t) => {
    if (!chunkId) return t.skip("no content seeded — run `npm run content:seed` first");

    const { error: created } = await alice.db
      .from("user_cards")
      .insert({ user_id: alice.user.id, chunk_id: chunkId });
    assert.equal(created, null, created?.message);

    // The PRD's hard rule, enforced by the database rather than by whichever
    // code path happens to be updating the card.
    const { error } = await alice.db
      .from("user_cards")
      .update({ state: "learned" })
      .eq("user_id", alice.user.id)
      .eq("chunk_id", chunkId);
    assert.notEqual(error, null, "a recognition-only card reached `learned`");

    const { error: allowed } = await alice.db
      .from("user_cards")
      .update({ state: "learned", produce_passes: 2 })
      .eq("user_id", alice.user.id)
      .eq("chunk_id", chunkId);
    assert.equal(allowed, null, allowed?.message);
  });

  test("recordings are private to their owner", async () => {
    const bytes = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    const alicePath = `${alice.user.id}/speaking/sample.webm`;

    const { error: upload } = await alice.db.storage
      .from("user-recordings")
      .upload(alicePath, bytes, { upsert: true });
    assert.equal(upload, null, upload?.message);

    const { error: read } = await bob.db.storage.from("user-recordings").download(alicePath);
    assert.notEqual(read, null, "Bob downloaded Alice's recording");

    // And Bob cannot write into her folder either.
    const { error: write } = await bob.db.storage
      .from("user-recordings")
      .upload(`${alice.user.id}/speaking/forged.webm`, bytes);
    assert.notEqual(write, null, "Bob wrote into Alice's folder");

    await admin.storage.from("user-recordings").remove([alicePath]);
  });
});
