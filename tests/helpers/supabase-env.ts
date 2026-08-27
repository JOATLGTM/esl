import fs from "node:fs";
import path from "node:path";

/** tsx does not read .env.local, and two test files need it. */
export function loadEnvLocal() {
  const file = path.join(import.meta.dirname, "..", "..", ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    process.env[m[1]] ??= m[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnvLocal();

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
export const PUBLISHABLE =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const SECRET =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Opt-in: these tests create and delete real users. Never point them at production. */
export const liveTestsEnabled = Boolean(
  process.env.RLS_TEST_ENABLED && SUPABASE_URL && PUBLISHABLE && SECRET
);

export const skipReason = liveTestsEnabled
  ? false
  : ("set RLS_TEST_ENABLED=1 and Supabase env vars to run (see .env.example)" as const);
