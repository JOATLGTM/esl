import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Liveness, and a heartbeat for the database.
 *
 * Two jobs:
 *
 *  1. **Answer "is this working"** without needing an account, so a failure can
 *     be seen from outside rather than reported by the one learner who has no
 *     way to describe it.
 *  2. **Touch Supabase on a schedule.** Free projects pause after a stretch of
 *     inactivity, and a paused project does not bill anyone -- it just stops,
 *     and the learner is told nothing. `.github/workflows/keepalive.yml` hits
 *     this daily.
 *
 * **Unverified assumption, stated plainly:** that a read like this counts as
 * "activity" for whatever Supabase actually measures. Their definition is not
 * documented precisely enough to rely on, so treat the keepalive as a cheap
 * bet rather than a guarantee, and confirm in the dashboard that the project
 * has not paused before trusting it.
 *
 * The query is a public-read content table: no session, nothing sensitive, and
 * the same question `proxy.ts` asks when it decides between "signed out" and
 * "the backend is gone".
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "unconfigured" }, { status: 503 });
  }

  const started = Date.now();
  try {
    const supabase = createClient(supabaseUrl(), supabasePublishableKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await supabase
      .from("units")
      .select("id", { head: true, count: "exact" })
      .limit(1)
      .abortSignal(AbortSignal.timeout(8000));

    if (error) {
      return NextResponse.json(
        { ok: false, reason: "database", detail: error.message, ms: Date.now() - started },
        // 503 rather than 500: this is "try later", and it is what makes the
        // GitHub Action fail loudly instead of reporting a cheerful 200.
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true, ms: Date.now() - started });
  } catch (cause) {
    return NextResponse.json(
      { ok: false, reason: "unreachable", detail: String(cause), ms: Date.now() - started },
      { status: 503 },
    );
  }
}
