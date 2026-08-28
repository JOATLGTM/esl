import assert from "node:assert/strict";
import { test, describe, before, after } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PUBLISHABLE, SECRET, SUPABASE_URL, skipReason } from "./helpers/supabase-env";
import { availableStages, firstStage, nextStage, resumeAt } from "../lib/session/stages";
import type { StageInventory } from "../lib/session/stages";

/**
 * The session row, against the real database (PRD 4.2).
 *
 * `tests/session-stages.test.ts` proves the stage machine offline. This proves
 * the part that machine cannot: that a learner may open exactly one session per
 * unit, that resuming finds it instead of making another, that finishing it
 * sticks, and that none of it is visible to anyone else. Row-level security is
 * asserted live here for the same reason it is in `rls.test.ts` -- a policy
 * that is believed to work and a policy that has been watched refusing a read
 * are different things.
 */

let admin: SupabaseClient;
const createdUsers: string[] = [];

/**
 * Two learners for the whole file, reused and wiped between tests.
 *
 * Signing up per test is the obvious shape and it does not survive: hosted
 * Supabase rate-limits auth, so a file with a dozen tests starts failing every
 * one of them with "Request rate limit reached" the moment it is run twice in
 * quick succession. Two accounts and a delete are indistinguishable from a
 * fresh signup for everything below, and cost two requests instead of twenty.
 */
type Learner = { db: SupabaseClient; userId: string };
let alice: Learner;
let bob: Learner;

/** Everything a learner owns. Reset, not recreated. */
const LEARNER_TABLES = [
  "sessions",
  "user_cards",
  "user_contrast_stats",
  "speaking_samples",
] as const;

async function wipe(learner: Learner) {
  for (const table of LEARNER_TABLES) {
    await admin.from(table).delete().eq("user_id", learner.userId);
  }
}

/** A learner with no history, as though they had just signed up. */
async function fresh(): Promise<Learner> {
  await wipe(alice);
  return alice;
}

async function freshPair(): Promise<[Learner, Learner]> {
  await Promise.all([wipe(alice), wipe(bob)]);
  return [alice, bob];
}

/** The first unit in curriculum order, which is what onboarding assigns. */
const UNIT = "b1_u1";

async function makeLearner(tag: string): Promise<Learner> {
  const email = `sess-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const password = `pw-${Math.random().toString(36).slice(2)}-A1!`;

  // The admin API rather than public `signUp`, matching `rls.test.ts`. Hosted
  // Supabase rate-limits public signups per project per hour, and a suite that
  // creates its fixtures that way starts failing every test with "Request rate
  // limit reached" as soon as it is run a few times in a row. Signup itself is
  // covered by `onboarding.test.ts`, which is where it belongs.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.equal(error, null, `could not create ${tag}: ${error?.message}`);
  createdUsers.push(data.user!.id);

  const db = createClient(SUPABASE_URL!, PUBLISHABLE!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await db.auth.signInWithPassword({ email, password });
  assert.equal(signIn.error, null, `could not sign in ${tag}: ${signIn.error?.message}`);

  return { db, userId: data.user!.id };
}

/** The same four counts `loadStageInventory` reads, through a learner's client. */
async function inventoryFor(db: SupabaseClient, unitId: string): Promise<StageInventory> {
  const { data: unit } = await db
    .from("units")
    .select("target_contrast")
    .eq("id", unitId)
    .single();

  const [chunks, scenes, dialogues, pairs] = await Promise.all([
    db.from("chunks").select("id", { count: "exact", head: true }).eq("unit_id", unitId),
    db.from("scenes").select("id", { count: "exact", head: true }).eq("unit_id", unitId),
    db.from("dialogues").select("id", { count: "exact", head: true }).eq("unit_id", unitId),
    db.from("minimal_pairs").select("audio").eq("contrast", unit!.target_contrast),
  ]);

  // Meet is exhaustible, so the inventory is per-learner: `db` here is the
  // learner's own client, and row-level security scopes `user_cards` to them.
  const { data: unitChunks } = await db.from("chunks").select("id").eq("unit_id", unitId);
  const { data: cards } = await db.from("user_cards").select("chunk_id");
  const met = new Set((cards ?? []).map((card) => card.chunk_id));

  return {
    earClips: (pairs.data ?? []).reduce(
      (total, pair) => total + ((pair.audio as unknown[] | null)?.length ?? 0),
      0,
    ),
    chunks: chunks.count ?? 0,
    newChunks: (unitChunks ?? []).filter((chunk) => !met.has(chunk.id)).length,
    scenes: scenes.count ?? 0,
    speakingTasks: dialogues.count ?? 0,
  };
}

/** `openSession`, without the server-only client. */
async function openSession(db: SupabaseClient, userId: string, unitId: string, startAt: string) {
  const { data: existing } = await db
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("unit_id", unitId)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await db
    .from("sessions")
    .insert({ user_id: userId, unit_id: unitId, stage_reached: startAt })
    .select("*")
    .single();

  assert.equal(error, null, error?.message);
  return data!;
}

describe("the daily session (PRD 4.2)", { skip: skipReason }, () => {
  before(async () => {
    admin = createClient(SUPABASE_URL!, SECRET!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    alice = await makeLearner("alice");
    bob = await makeLearner("bob");
  });

  after(async () => {
    for (const id of createdUsers) await admin.auth.admin.deleteUser(id);
  });

  test("the seeded unit serves the stages it has content for, and no others", async () => {
    const { db } = await fresh();
    const inventory = await inventoryFor(db, UNIT);

    assert.equal(inventory.chunks, 25);
    assert.equal(inventory.scenes, 6);
    assert.equal(inventory.speakingTasks, 1);
    // The last open content item: the human minimal-pair recordings do not
    // exist yet, so ear training is the one stage still skipped. When this
    // becomes non-zero the stage turns itself on and this line is the reminder.
    assert.equal(inventory.earClips, 0, "ear-training recordings exist now — expect 5 stages");

    assert.deepEqual(availableStages(inventory), ["meet", "absorb", "retrieve", "speak"]);
  });

  test("a learner starts one session and resumes it rather than starting another", async () => {
    const { db, userId } = await fresh();
    const available = availableStages(await inventoryFor(db, UNIT));
    const start = firstStage(available)!;

    const first = await openSession(db, userId, UNIT, start);
    assert.equal(first.stage_reached, "meet");
    assert.equal(first.completed_at, null);
    assert.equal(first.duration_s, 0);

    // Closing the app and reopening it.
    const again = await openSession(db, userId, UNIT, start);
    assert.equal(again.id, first.id, "a second visit created a duplicate session");

    const { count } = await db
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    assert.equal(count, 1);
  });

  test("a partial session resumes at the stage it stopped in", async () => {
    const { db, userId } = await fresh();
    const available = availableStages(await inventoryFor(db, UNIT));
    const session = await openSession(db, userId, UNIT, firstStage(available)!);

    const second = nextStage("meet", available)!;
    await db
      .from("sessions")
      .update({ stage_reached: second, duration_s: 42 })
      .eq("id", session.id);

    const resumed = await openSession(db, userId, UNIT, firstStage(available)!);
    assert.equal(resumed.id, session.id);
    assert.equal(resumeAt(resumed.stage_reached, available), "absorb");
    assert.equal(resumed.duration_s, 42);
  });

  test("finishing the last stage closes the session, and the next one is new", async () => {
    const { db, userId } = await fresh();
    const available = availableStages(await inventoryFor(db, UNIT));
    const session = await openSession(db, userId, UNIT, firstStage(available)!);

    // Walk the whole session the way `advanceStage` does.
    let stage = resumeAt(session.stage_reached, available)!;
    let duration = 0;
    for (;;) {
      duration += 30;
      const next = nextStage(stage, available);
      const patch = next
        ? { stage_reached: next, duration_s: duration }
        : { duration_s: duration, completed_at: new Date().toISOString() };
      const { error } = await db.from("sessions").update(patch).eq("id", session.id);
      assert.equal(error, null, error?.message);
      if (!next) break;
      stage = next;
    }

    const { data: finished } = await db
      .from("sessions")
      .select("*")
      .eq("id", session.id)
      .single();
    assert.ok(finished!.completed_at, "the session never closed");
    // Derived, not hardcoded: a stage lighting up when its content lands is a
    // normal event, and this test is about the walk closing the session -- not
    // about how many stages there happened to be on the day it was written.
    assert.equal(finished!.stage_reached, available[available.length - 1]);
    assert.equal(finished!.duration_s, available.length * 30);

    // Tomorrow's visit must not resume a finished session.
    const tomorrow = await openSession(db, userId, UNIT, firstStage(available)!);
    assert.notEqual(tomorrow.id, session.id);
    assert.equal(tomorrow.stage_reached, "meet");
  });

  test("meeting chunks creates cards, and re-running it does not rewrite them", async () => {
    const { db, userId } = await fresh();

    const { data: chunkRows } = await db
      .from("chunks")
      .select("id")
      .eq("unit_id", UNIT)
      .order("id", { ascending: true });
    const budget = 6; // newChunkBudget(20), the default daily goal
    const shown = (chunkRows ?? []).slice(0, budget).map((chunk) => chunk.id);
    assert.equal(shown.length, budget);

    // What `recordMeetChunks` writes: one card per chunk, one gloss revealed.
    const revealed = shown[0];
    const write = async () =>
      db.from("user_cards").upsert(
        shown.map((chunk_id) => ({
          user_id: userId,
          chunk_id,
          state: "learning" as const,
          gloss_reveals: chunk_id === revealed ? 1 : 0,
        })),
        { onConflict: "user_id,chunk_id", ignoreDuplicates: true },
      );

    const first = await write();
    assert.equal(first.error, null, first.error?.message);

    const { data: cards } = await db.from("user_cards").select("*").eq("user_id", userId);
    assert.equal(cards!.length, budget);
    assert.ok(cards!.every((card) => card.state === "learning"));
    assert.equal(cards!.find((card) => card.chunk_id === revealed)!.gloss_reveals, 1);
    // Nothing may arrive already mastered -- production passes are the only way.
    assert.ok(cards!.every((card) => card.produce_passes === 0));

    // Simulate a double advance. `ignoreDuplicates` must leave review history
    // alone; a plain upsert here would silently reset gloss_reveals to 0.
    await db.from("user_cards").update({ gloss_reveals: 5, produce_passes: 2 }).eq("chunk_id", revealed).eq("user_id", userId);
    const second = await write();
    assert.equal(second.error, null, second.error?.message);

    const { data: after } = await db
      .from("user_cards")
      .select("gloss_reveals, produce_passes")
      .eq("user_id", userId)
      .eq("chunk_id", revealed)
      .single();
    assert.equal(after!.gloss_reveals, 5, "a second advance rewrote review history");
    assert.equal(after!.produce_passes, 2);
  });

  test("meet drops out of the session once every chunk has been met", async () => {
    const { db, userId } = await fresh();

    const before = await inventoryFor(db, UNIT);
    assert.equal(before.newChunks, 25);
    assert.ok(availableStages(before).includes("meet"));

    const { data: chunkRows } = await db.from("chunks").select("id").eq("unit_id", UNIT);
    await db.from("user_cards").upsert(
      (chunkRows ?? []).map((chunk) => ({ user_id: userId, chunk_id: chunk.id })),
      { onConflict: "user_id,chunk_id", ignoreDuplicates: true },
    );

    const after = await inventoryFor(db, UNIT);
    assert.equal(after.newChunks, 0);
    assert.deepEqual(availableStages(after), ["absorb", "retrieve", "speak"]);
  });

  test("a learner cannot end up with two open sessions in the same unit", async () => {
    const { db, userId } = await fresh();
    const available = availableStages(await inventoryFor(db, UNIT));
    const first = await openSession(db, userId, UNIT, firstStage(available)!);

    // The race `openSession` used to lose: a prefetch and a navigation both
    // read no open session and both insert. The database now refuses the
    // second, which is what makes the find-then-insert safe.
    const duplicate = await db
      .from("sessions")
      .insert({ user_id: userId, unit_id: UNIT, stage_reached: "meet" });
    assert.ok(duplicate.error, "a second open session was allowed");
    assert.equal(duplicate.error!.code, "23505");

    // Finishing one frees the slot -- a learner practises the same unit on
    // many days, and every completed session must be allowed to stay.
    await db.from("sessions").update({ completed_at: new Date().toISOString() }).eq("id", first.id);
    const tomorrow = await db
      .from("sessions")
      .insert({ user_id: userId, unit_id: UNIT, stage_reached: "meet" })
      .select("id")
      .single();
    assert.equal(tomorrow.error, null, tomorrow.error?.message);
    assert.notEqual(tomorrow.data!.id, first.id);
  });

  test("a card cannot be called learned without two production passes", async () => {
    const { db, userId } = await fresh();
    const { data: chunk } = await db.from("chunks").select("id").eq("unit_id", UNIT).limit(1).single();

    await db.from("user_cards").insert({ user_id: userId, chunk_id: chunk!.id, state: "learning" });

    // The single most load-bearing pedagogical rule in the product, and it is a
    // CHECK rather than service-layer logic precisely so no code path can miss
    // it. Recognition passes do not count; only production does.
    const forged = await db
      .from("user_cards")
      .update({ state: "learned", produce_passes: 1 })
      .eq("user_id", userId)
      .eq("chunk_id", chunk!.id);
    assert.ok(forged.error, "a card reached 'learned' on one production pass");

    const earned = await db
      .from("user_cards")
      .update({ state: "learned", produce_passes: 2 })
      .eq("user_id", userId)
      .eq("chunk_id", chunk!.id);
    assert.equal(earned.error, null, earned.error?.message);
  });

  test("the unit has a speaking task to serve", async () => {
    const { db } = await fresh();
    const { data } = await db
      .from("dialogues")
      .select("id, mode, scenario_es, character_id, nodes")
      .eq("unit_id", UNIT)
      .maybeSingle();

    // Authored in the YAML from the beginning but not seeded until 2026-08-28,
    // which is why Stage 5 had no source and the session skipped it.
    assert.ok(data, "no dialogue seeded; the speak stage has nothing to serve");
    assert.equal(data!.mode, "scripted");
    const nodes = data!.nodes as { script?: unknown[]; target_chunks?: unknown[] };
    assert.ok((nodes.script ?? []).length > 0, "the dialogue has no script");
    assert.ok((nodes.target_chunks ?? []).length > 0);
  });

  test("a learner's speaking samples and contrast stats are their own", async () => {
    const [alice, bob] = await freshPair();

    await alice.db.from("user_contrast_stats").insert({
      user_id: alice.userId,
      contrast: "ee_ih",
      attempts: 10,
      correct: 9,
      recent: [true, true, false],
    });

    const { data: seen } = await bob.db.from("user_contrast_stats").select("*");
    assert.deepEqual(seen, [], "another learner could read the contrast stats");

    const forged = await bob.db.from("speaking_samples").insert({
      user_id: alice.userId,
      prompt_id: "b1_u1_speaking",
      prompt_es: "forged",
      recording_path: `${alice.userId}/speaking/x.webm`,
      week_number: 1,
    });
    assert.ok(forged.error, "a learner could file a recording against another account");
  });

  test("one learner's session is invisible and unwritable to another", async () => {
    const [alice, bob] = await freshPair();

    const available = availableStages(await inventoryFor(alice.db, UNIT));
    const session = await openSession(alice.db, alice.userId, UNIT, firstStage(available)!);

    const { data: seen } = await bob.db.from("sessions").select("*").eq("id", session.id);
    assert.deepEqual(seen, [], "another learner could read the session row");

    // The policy's USING clause filters the update to zero rows rather than
    // raising -- no error, and nothing changed. Both halves matter.
    const { error } = await bob.db
      .from("sessions")
      .update({ stage_reached: "speak" })
      .eq("id", session.id);
    assert.equal(error, null);

    const { data: after } = await alice.db
      .from("sessions")
      .select("stage_reached")
      .eq("id", session.id)
      .single();
    assert.equal(after!.stage_reached, "meet");

    // And a forged row for someone else is refused outright.
    const forged = await bob.db
      .from("sessions")
      .insert({ user_id: alice.userId, unit_id: UNIT, stage_reached: "meet" });
    assert.ok(forged.error, "a learner could create a session for another account");
  });
});
