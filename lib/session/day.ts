/**
 * The learner's day, not the server's.
 *
 * "Practised today" and "days in a row" are wall-clock questions asked in the
 * learner's timezone (`users.timezone`). A session finished at 11pm in Mexico
 * City is 5am tomorrow in UTC, and counting it as tomorrow would break a streak
 * the learner plainly did not break -- which PRD F8 is explicit about never
 * doing casually.
 *
 * Pure, so `tests/session-stages.test.ts` can check the boundaries offline.
 */

/** Today's date in `timezone`, as `YYYY-MM-DD`. Falls back to UTC on a bad zone. */
export function localDate(timezone: string, at: Date = new Date()): string {
  // `en-CA` formats as YYYY-MM-DD, which is both the format Postgres `date`
  // wants and the one that sorts and compares as a plain string.
  const format = (zone: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at);

  try {
    return format(timezone);
  } catch {
    // `timezone` is a free-text column with a default, so a stale or misspelled
    // IANA name is reachable. UTC is wrong by at most a day; throwing here would
    // lose the whole session.
    return format("UTC");
  }
}

/** Whole days from one `YYYY-MM-DD` to another. Negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const parse = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}

/**
 * The streak counters after practising on `today` (PRD F8).
 *
 * `daysPracticed` only ever goes up and is never reset -- there is no column
 * for a broken streak because there is no such thing in this product. The soft
 * consecutive counter may reset, quietly.
 */
export function practiceCounters(
  current: { daysPracticed: number; consecutiveDays: number; lastPracticedOn: string | null },
  today: string,
): { daysPracticed: number; consecutiveDays: number; lastPracticedOn: string } | null {
  // Already counted today. A second session is welcome and changes nothing here.
  if (current.lastPracticedOn === today) return null;

  const consecutive =
    current.lastPracticedOn && daysBetween(current.lastPracticedOn, today) === 1
      ? current.consecutiveDays + 1
      : 1;

  return {
    daysPracticed: current.daysPracticed + 1,
    consecutiveDays: consecutive,
    lastPracticedOn: today,
  };
}
