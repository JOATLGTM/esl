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

/** The first unit in curriculum order, which is what onboarding assigns. */
const UNIT = "b1_u1";

async function signUpFresh() {
  const email = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const db = createClient(SUPABASE_URL!, PUBLISHABLE!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data } = await db.auth.signUp({ email, password: "correct-horse-8" });
  if (data.user) createdUsers.push(data.user.id);
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

  return {
    earClips: (pairs.data ?? []).reduce(
      (total, pair) => total + ((pair.audio as unknown[] | null)?.length ?? 0),
      0,
    ),
    chunks: chunks.count ?? 0,
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
  before(() => {
    admin = createClient(SUPABASE_URL!, SECRET!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });

  after(async () => {
    for (const id of createdUsers) await admin.auth.admin.deleteUser(id);
  });

  test("the seeded unit serves the stages it has content for, and no others", async () => {
    const { db } = await signUpFresh();
    const inventory = await inventoryFor(db, UNIT);

    assert.equal(inventory.chunks, 25);
    assert.equal(inventory.scenes, 6);
    // Both of these are open items, not bugs: the human minimal-pair recordings
    // do not exist yet, and `speaking_task` is validated in the unit YAML but
    // never seeded into `dialogues`. If either becomes non-zero, this test is
    // the reminder to turn the stage on.
    assert.equal(inventory.earClips, 0, "ear-training recordings exist now — enable the stage");
    assert.equal(inventory.speakingTasks, 0, "a dialogue is seeded now — enable the stage");

    assert.deepEqual(availableStages(inventory), ["meet", "absorb", "retrieve"]);
  });

  test("a learner starts one session and resumes it rather than starting another", async () => {
    const { db, userId } = await signUpFresh();
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
    const { db, userId } = await signUpFresh();
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
    const { db, userId } = await signUpFresh();
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
    assert.equal(finished!.stage_reached, "retrieve");
    assert.equal(finished!.duration_s, 90);

    // Tomorrow's visit must not resume a finished session.
    const tomorrow = await openSession(db, userId, UNIT, firstStage(available)!);
    assert.notEqual(tomorrow.id, session.id);
    assert.equal(tomorrow.stage_reached, "meet");
  });

  test("one learner's session is invisible and unwritable to another", async () => {
    const alice = await signUpFresh();
    const bob = await signUpFresh();

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
