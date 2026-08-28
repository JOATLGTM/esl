/**
 * Which transcript line is playing right now.
 *
 * Pure, because the alternative is a highlight that can only be checked by
 * listening to fifty seconds of audio and watching. It also has two edge cases
 * that are easy to get wrong and invisible when they are:
 *
 *   - the gaps *between* lines (the pipeline leaves ~400ms of silence), where
 *     nothing should be highlighted rather than the previous line lingering;
 *   - the state before playback starts, where highlighting line one makes a
 *     paused scene look like a playing one.
 */

export type TimedLine = { startMs: number; endMs: number };

/** Index of the line covering `elapsedMs`, or -1 in a gap or before the start. */
export function activeLineAt(lines: readonly TimedLine[], elapsedMs: number | null): number {
  if (elapsedMs === null) return -1;
  return lines.findIndex((line) => elapsedMs >= line.startMs && elapsedMs < line.endMs);
}
