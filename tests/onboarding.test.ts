import assert from "node:assert/strict";
import { test, describe, before, after } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PUBLISHABLE, SECRET, SUPABASE_URL, skipReason } from "./helpers/supabase-env";

/**
 * The F1 path, end to end, against the real database.
 *
 * This is the acceptance criteria as a test rather than as a checklist:
 *
 *   - signup returns a live session, so the learner is inside the app rather
 *     than inside their inbox ("signup -> first session in under 2 minutes");
 *   - the profile row exists the moment the account does;
 *   - onboarding writes are permitted for one's own row and refused for
 *     anyone else's;
 *   - denying the microphone is a recorded, unremarkable outcome, not a block.
 */

let admin: SupabaseClient;
const createdUsers: string[] = [];

/**
 * A real public signup, which is what two of the tests below are actually
 * about. Rate-limited by hosted Supabase per project per hour, so it is used
 * only where the signup itself is the thing under test -- everything else
 * takes a learner from `makeLearner`.
 */
async function signUpFresh() {
  const email = `f1-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const db = createClient(SUPABASE_URL!, PUBLISHABLE!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await db.auth.signUp({ email, password: "correct-horse-8" });
  if (data.user) createdUsers.push(data.user.id);
  return { db, data, error, email };
}

/**
 * A learner who already exists, created through the admin API.
 *
 * Not rate-limited, and indistinguishable from a signed-up learner for any
 * test that only needs someone to own a row. A suite that makes every fixture
 * with public `signUp` starts failing all of its tests with "Request rate limit
 * reached" the moment it is run a few times in an hour.
 */
async function makeLearner(): Promise<{ db: SupabaseClient; userId: string }> {
  const email = `f1a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const password = `pw-${Math.random().toString(36).slice(2)}-A1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.equal(error, null, error?.message);
  createdUsers.push(data.user!.id);

  const db = createClient(SUPABASE_URL!, PUBLISHABLE!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await db.auth.signInWithPassword({ email, password });
  assert.equal(signIn.error, null, signIn.error?.message);
  return { db, userId: data.user!.id };
}

describe("onboarding (PRD F1)", { skip: skipReason }, () => {
  before(() => {
    admin = createClient(SUPABASE_URL!, SECRET!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });

  after(async () => {
    for (const id of createdUsers) await admin.auth.admin.deleteUser(id);
  });

  test("signup returns a session immediately — no trip to the inbox", async () => {
    const { data, error } = await signUpFresh();
    assert.equal(error, null, error?.message);
    // If this ever fails, email confirmation has been turned back on and the
    // two-minute acceptance criterion is gone with it.
    assert.ok(data.session, "signUp returned no session; confirmations are on");
    assert.ok(data.user);
  });

  test("a profile row exists as soon as the account does", async () => {
    const { db, data } = await signUpFresh();
    const { data: profile, error } = await db.from("users").select("*").single();
    assert.equal(error, null, error?.message);
    assert.equal(profile!.id, data.user!.id);
    // The states onboarding depends on, before it runs.
    assert.equal(profile!.onboarded_at, null);
    assert.equal(profile!.motivation, null);
    assert.equal(profile!.daily_goal_minutes, 20);
    assert.equal(profile!.current_block, 1);
  });

  test("completing onboarding writes exactly the five answers", async () => {
    const { db, userId } = await makeLearner();
    const { data: unit } = await db
      .from("units").select("id").order("block").order("order").limit(1).single();
    assert.ok(unit, "no curriculum seeded");

    const { error } = await db.from("users").update({
      motivation: "work",
      daily_goal_minutes: 10,
      mic_permission: "granted",
      current_unit: unit.id,
      onboarded_at: new Date().toISOString(),
    }).eq("id", userId);
    assert.equal(error, null, error?.message);

    const { data: profile } = await db.from("users").select("*").single();
    assert.equal(profile!.motivation, "work");
    assert.equal(profile!.daily_goal_minutes, 10);
    assert.equal(profile!.current_unit, unit.id);
    assert.ok(profile!.onboarded_at);
  });

  test("denying the microphone is recorded and blocks nothing", async () => {
    const { db, userId } = await makeLearner();
    const { error } = await db.from("users").update({
      motivation: "family",
      mic_permission: "denied",
      onboarded_at: new Date().toISOString(),
    }).eq("id", userId);
    assert.equal(error, null, error?.message);

    const { data: profile } = await db.from("users").select("*").single();
    // Onboarded, with the mic refused. Those two facts coexist by design.
    assert.equal(profile!.mic_permission, "denied");
    assert.ok(profile!.onboarded_at);
  });

  test("the daily goal is one of the three the UI offers", async () => {
    const { db, userId } = await makeLearner();
    const { error } = await db.from("users")
      .update({ daily_goal_minutes: 45 }).eq("id", userId);
    assert.notEqual(error, null, "a goal outside 10/20/30 was accepted");
  });

  test("one learner cannot onboard another", async () => {
    const victim = await makeLearner();
    const attacker = await makeLearner();
    await attacker.db.from("users")
      .update({ onboarded_at: new Date().toISOString(), motivation: "other" })
      .eq("id", victim.userId);

    const { data: profile } = await admin
      .from("users").select("onboarded_at").eq("id", victim.userId).single();
    assert.equal(profile!.onboarded_at, null, "another user's profile was onboarded");
  });
});
