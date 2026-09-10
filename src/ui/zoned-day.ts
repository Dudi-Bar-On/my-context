/**
 * **WHICH DAY AN INSTANT FELL ON, IN A NAMED ZONE — the server's half of one
 * derivation, not a second one** —
 * `TASK-a-date-filter-measures-the-reader-s-day-not-utc-s-because`.
 *
 * ── WHY A MODULE OF ITS OWN, AND WHY THIS SMALL ───────────────────────────
 *
 * `/api/conversations` narrows by date, and after this item the day it
 * compares is the day the SCREEN prints, computed in the zone the reader sent.
 * The browser's spelling lives in `src/ui/public/lib/viewmodel.js`, which is
 * untyped JavaScript that a TypeScript caller cannot statically import —
 * `tsconfig.json` sets no `allowJs`, and `src/cli/commands/format.ts` already
 * states that bargain in full for `zonedStamp`.
 *
 * So there is a second spelling, and the two things that keep it from becoming
 * a second ANSWER are both in place: it is one exported function over one
 * `Intl.DateTimeFormat`, and `test/ui/zoned-stamp-parity.test.ts` sweeps every
 * instant and zone in it through BOTH files and through `zonedStamp` in all
 * three, asserting the day is the first ten characters of the stamp. A drift
 * is a red suite, not a wrong list.
 *
 * **It imports NOTHING**, which is the reason it is a file rather than a
 * paragraph inside `read-model-conversations.ts`. That module's whole claim is
 * a runtime graph of exactly two project files that cannot write and cannot
 * spawn (`test/ui/conversations-endpoint.test.ts`), and `format.ts` — where
 * the CLI's copy lives — is a CLI command module behind which the whole writer
 * graph sits. A zero-import leaf can be reached from either side without
 * spending that property.
 *
 * ── AND WHY `Intl` AND NEVER ARITHMETIC ───────────────────────────────────
 *
 * An offset applied to an instant is not a day computed in a zone. The owner's
 * own zone moves: `Asia/Jerusalem` is GMT+2 in January and GMT+3 in July, so
 * `21:30Z` is the 15th in one and the 16th in the other. Anything that added a
 * fixed three hours would place both on the 16th and be wrong for half the
 * year, silently, at exactly the edge a date filter is asked about.
 */

/**
 * `YYYY-MM-DD` for `at` as read in `timeZone`, or `null`.
 *
 * `null` for an instant that is not one, and for a formatter that produced no
 * zone name — the second guard mirrors `zonedStamp`'s, so a day exists in
 * exactly the cases a stamp exists in. `timeZone` undefined is the RUNTIME's
 * zone, which on this side is the server's and is therefore never what an
 * endpoint should pass: `apiConversations` passes `UTC` explicitly when the
 * caller named no zone.
 */
export function zonedDay(at: unknown, timeZone?: string): string | null {
  const when = at instanceof Date ? at : new Date(String(at));
  if (Number.isNaN(when.getTime())) return null;
  const parts = zonedFormat(timeZone).formatToParts(when);
  const field = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  if (field('timeZoneName') === '') return null;
  return `${field('year')}-${field('month')}-${field('day')}`;
}

/**
 * Whether `Intl` on this runtime knows the zone by that name.
 *
 * The endpoint refuses an unreadable bound rather than accepting and ignoring
 * it (`plan:archive seq:10`), and a zone is half of what a bound MEANS after
 * this item — so an unknown zone is refused in the same breath and by the same
 * rule. `Intl.DateTimeFormat` throws `RangeError` on one; nothing else here
 * can throw, so the catch cannot swallow a different fault.
 */
export function zoneIsKnown(timeZone: string): boolean {
  try {
    zonedFormat(timeZone);
    return true;
  } catch {
    return false;
  }
}

/**
 * One `Intl.DateTimeFormat` per zone, kept — `viewmodel.js`' cache and its
 * reason. Constructing one is the expensive half of formatting a date, and the
 * list computes a day per indexed session whenever a bound is set.
 */
const ZONED = new Map<string, Intl.DateTimeFormat>();

function zonedFormat(timeZone?: string): Intl.DateTimeFormat {
  const key = timeZone ?? '';
  let format = ZONED.get(key);
  if (format === undefined) {
    format = new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'shortOffset',
    });
    ZONED.set(key, format);
  }
  return format;
}
