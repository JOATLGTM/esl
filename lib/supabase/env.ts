/**
 * Supabase configuration, read once and checked loudly.
 *
 * Two things this file is careful about:
 *
 * 1. `process.env.X` must be written out literally. Next inlines public env
 *    vars at build time by matching the literal text, so `process.env[name]`
 *    resolves to undefined in the browser and the failure looks like a
 *    misconfigured project rather than a bundler behaviour.
 *
 * 2. Supabase issues two generations of keys. New projects get `sb_publishable_…`
 *    and `sb_secret_…`; older ones get the legacy anon / service_role JWTs. Both
 *    are accepted, because being strict here means a working project fails to
 *    connect for a reason nobody would guess.
 */

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL;

const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function required(value: string | undefined, names: string[]): string {
  if (value) return value;
  throw new Error(
    `Missing Supabase configuration: set ${names.join(" or ")}.\n` +
      `Copy .env.example to .env.local and fill it in — Project Settings > API ` +
      `in the Supabase dashboard.`
  );
}

export function supabaseUrl(): string {
  return required(url, ["NEXT_PUBLIC_SUPABASE_URL"]);
}

export function supabasePublishableKey(): string {
  return required(publishableKey, [
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ]);
}

/**
 * The key that bypasses row-level security.
 *
 * Server-side only, and not merely by convention: it is read without a
 * `NEXT_PUBLIC_` prefix precisely so that Next cannot inline it into a client
 * bundle even if something imports this by mistake.
 */
export function supabaseSecretKey(): string {
  return required(
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
    ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
  );
}

/** True when the app has enough configuration to talk to Supabase at all. */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && publishableKey);
}
