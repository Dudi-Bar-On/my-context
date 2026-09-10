// @basis TASK-a-timestamp-is-shown-in-the-reader-s-own-zone-and-says-which,
// TASK-a-date-filter-measures-the-reader-s-day-not-utc-s-because
/**
 * **THREE HOURS OF A SESSION WENT MISSING AND NOTHING WAS MISSING.**
 *
 * The owner opened the conversation archive on his own session on 2026-09-08
 * and reported that it stopped about three hours before it did. It had not.
 * The viewer drew the stored UTC stamp raw and he is UTC+3, so `14:11` stood
 * where his own clock said `17:11` — the same minute, measured. A FORMATTING
 * defect produced a report of DATA LOSS, and that is the expensive direction:
 * it sends somebody to audit an index while the screen is simply lying about
 * the clock.
 *
 * So this file pins the two halves of the repair, because a half is what would
 * regress. **Local alone is not the fix.** Moving the digits to 17:11 with no
 * marker leaves a plausible time that is silently wrong for the next person to
 * read the same transcript from another country, which is precisely what a
 * transcript is for. Every assertion below therefore checks BOTH the shift and
 * the name of the zone it shifted into.
 *
 * ── AND IT PINS TWO COPIES OF ONE SPELLING TOGETHER ───────────────────────
 *
 * The stamp is drawn on the archive SCREEN and printed by `conversation list`
 * in the TERMINAL, and the item that asked for this named the failure to avoid
 * by name: *"a reader comparing the screen against the terminal must not see
 * two different times for one session."* `src/ui/public/lib/viewmodel.js` is
 * untyped JavaScript that a TypeScript caller cannot import, so there are two
 * implementations — the same bargain `formatDuration` took, and
 * `test/ui/duration-parity.test.ts` is the precedent for what stands in for
 * the import. A sweep across zones and instants, asserted equal, rather than
 * two files hoped equal.
 *
 * ── WHY THE ZONE IS PINNED HERE WHEN OTHER FILES REFUSE TO ────────────────
 *
 * `test/ui/ask-screen.test.ts` asserts the SHAPE of a clock and says why: the
 * value is the running machine's, so pinning digits would pin a zone. Right
 * there, wrong here — the defect under repair IS a zone, and a shape assertion
 * cannot see a three-hour error. `test/ui/audit-stamp.test.ts` reached the
 * same conclusion for the same reason and set `process.env.TZ` around its
 * digits; this takes the stricter road and passes the zone as an ARGUMENT
 * wherever the function accepts one, so nothing ambient is involved at all.
 * `process.env.TZ` is moved only for the one case that must prove the DEFAULT
 * follows the reader rather than the machine that stored the value.
 *
 * `test/helpers/pin-rendering.ts` is the standing reason all of this matters:
 * a suite whose expected output depends on ambient settings is green on every
 * machine that can run it locally and red on the one nobody watches.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { zonedStamp as cliStamp } from '../../src/cli/commands/format.ts';
import { zonedDay as serverDay } from '../../src/ui/zoned-day.ts';

const PUBLIC = path.join(import.meta.dirname, '..', '..', 'src', 'ui', 'public');

const browserModule = async <T>(...segments: string[]): Promise<T> =>
  (await import(pathToFileURL(path.join(PUBLIC, ...segments)).href)) as T;

interface ViewModel {
  zonedStamp: (at: unknown, timeZone?: string) => string | null;
  zonedDay: (at: unknown, timeZone?: string) => string | null;
  zonedZone: (at: unknown, timeZone?: string) => string | null;
}
interface Parts {
  zonedStampOf: (at: unknown, timeZone?: string) => string | null;
}

const viewModel = (): Promise<ViewModel> => browserModule<ViewModel>('lib', 'viewmodel.js');
const parts = (): Promise<Parts> => browserModule<Parts>('screens', 'parts.js');

/** Run `body` with the machine's zone pinned, and put the real one back. */
function inZone(zone: string, body: () => void): void {
  const before = process.env['TZ'];
  process.env['TZ'] = zone;
  try {
    body();
  } finally {
    if (before === undefined) delete process.env['TZ'];
    else process.env['TZ'] = before;
  }
}

/* ══ THE DEFECT, RESTATED AS SOMETHING THAT FAILS WHEN IT COMES BACK ═══════ */

test('the owner\'s own measurement: 14:11Z reads 17:11 on his clock, and says GMT+3', async () => {
  const { zonedStamp } = await viewModel();
  // His two numbers, from the report. `14:11` is what the screen drew; `17:11`
  // is what his clock said in the same minute.
  assert.equal(zonedStamp('2026-09-08T14:11:23.456Z', 'Asia/Jerusalem'), '2026-09-08 17:11 GMT+3');
  assert.equal(cliStamp('2026-09-08T14:11:23.456Z', 'Asia/Jerusalem'), '2026-09-08 17:11 GMT+3');

  // And the UTC reader, who was never lied to, is still TOLD which clock this
  // is — the half that is easiest to drop, because for this reader nothing
  // moves and the marker looks like decoration.
  assert.equal(zonedStamp('2026-09-08T14:11:23.456Z', 'UTC'), '2026-09-08 14:11 GMT+0');
});

test('every rendered stamp names its zone — there is no shape without a marker', async () => {
  const { zonedStamp } = await viewModel();
  for (const zone of ZONES) {
    for (const at of INSTANTS) {
      const drawn = zonedStamp(at, zone);
      assert.notEqual(drawn, null, `refused a real instant: ${at} in ${zone}`);
      assert.match(
        String(drawn),
        /^\d{4}-\d\d-\d\d \d\d:\d\d GMT[+-]\d\d?(:\d\d)?$/,
        `a stamp without a readable zone marker: ${String(drawn)}`,
      );
    }
  }
});

/**
 * The zones are chosen for what each one can break, not for coverage:
 *
 *   `Asia/Jerusalem`    the owner's own, and it changes offset across the year
 *   `UTC`               the stored value, and the one the browser suite pins
 *   `America/New_York`  a NEGATIVE offset, where a naive `+` would show
 *   `Asia/Kolkata`      a HALF-hour offset (`GMT+5:30`), which a `GMT[+-]\d`
 *                       marker pattern would truncate
 *   `Australia/Eucla`   a QUARTER-hour offset (`GMT+8:45`)
 *   `Pacific/Chatham`   `GMT+12:45`, and it rolls the DATE forward past
 *                       midnight, which is the case a time-only fix passes
 */
const ZONES = [
  'Asia/Jerusalem', 'UTC', 'America/New_York', 'Asia/Kolkata', 'Australia/Eucla', 'Pacific/Chatham',
] as const;

/**
 * Instants chosen the same way: both sides of a day boundary in every zone
 * above, both sides of the Israeli DST change (the owner is `GMT+3` in
 * September and `GMT+2` in January, and a hard-coded offset would pass one and
 * fail the other), and the two ends of a UTC day.
 */
const INSTANTS = [
  '2026-09-08T14:11:23.456Z',
  '2026-09-08T00:00:00.000Z',
  '2026-09-08T23:59:59.999Z',
  '2026-01-15T12:00:00.000Z',
  '2026-06-30T21:30:00.000Z',
  '1999-12-31T23:59:00.000Z',
] as const;

/* ══ THE TWO SURFACES SPELL ONE INSTANT THE SAME WAY, or this fails ════════ */

test('the terminal and the screen spell every instant identically, in every zone', async () => {
  const { zonedStamp } = await viewModel();
  for (const zone of ZONES) {
    for (const at of INSTANTS) {
      assert.equal(
        cliStamp(at, zone), zonedStamp(at, zone),
        `the CLI and the browser disagree about ${at} in ${zone}`,
      );
    }
  }
});

/* ══ AND THE DAY THE FILTER COMPARES IS THE DAY THE STAMP PRINTS ══════════ */

/**
 * **THE ANTI-DRIFT PIN FOR `plan:archive seq:37`** —
 * `TASK-a-date-filter-measures-the-reader-s-day-not-utc-s-because`.
 *
 * `seq:10` gave the archive list a date filter that compared a UTC prefix, and
 * `seq:18` moved every stamp beside it into the reader's clock. Each was right
 * about its own half; together they put a control under a column that
 * disagreed with it, and a row could be hidden by a day boundary that did not
 * match the date printed on the row.
 *
 * The repair is not "make the filter zoned too" — that is two zoned things
 * that can still drift. It is ONE derivation: `zonedDay` produces the date,
 * and `zonedStamp` does not compute one, it reads that. This test is what says
 * so across the FILE BOUNDARY the language forces: the endpoint cannot import
 * untyped JavaScript (`tsconfig.json` sets no `allowJs`), so `src/ui/zoned-day.ts`
 * is a second spelling, and here is the sweep that stands in for the import.
 *
 * Three assertions per instant per zone, and each one can fail alone:
 *   - the SERVER's day equals the BROWSER's day  — the copy has not drifted;
 *   - the browser's day is the first ten characters of the browser's stamp —
 *     the filter and the column are one derivation, not two;
 *   - the same against the CLI's stamp, so `conversation list` is in it too.
 *
 * `ZONES` and `INSTANTS` already carry what this needs and were chosen for it
 * before this item existed: `Asia/Jerusalem` on both sides of its DST change,
 * `Pacific/Chatham` at `GMT+12:45` where the date rolls forward, and
 * `America/New_York` where it rolls back.
 */
test('one derivation: the day a filter compares is the day a stamp prints', async () => {
  const { zonedStamp, zonedDay } = await viewModel();
  let moved = 0;
  for (const zone of ZONES) {
    for (const at of INSTANTS) {
      const day = zonedDay(at, zone);
      assert.notEqual(day, null, `refused a real instant: ${at} in ${zone}`);
      assert.equal(
        serverDay(at, zone), day,
        `the endpoint and the browser disagree about WHICH DAY ${at} is in ${zone}. That `
        + 'disagreement is the defect seq:37 was filed about, one file apart.',
      );
      assert.equal(
        String(zonedStamp(at, zone)).slice(0, 10), day,
        `the browser draws a date the browser's own filter would not select: ${at} in ${zone}`,
      );
      assert.equal(
        String(cliStamp(at, zone)).slice(0, 10), day,
        `the terminal prints a date the list filter would not select: ${at} in ${zone}`,
      );
      if (day !== at.slice(0, 10)) moved += 1;
    }
  }
  // ANTI-VACUITY. If every instant here fell on its UTC day, all three
  // assertions above would hold for a build that never left UTC — which is
  // exactly the build this item replaced.
  assert.ok(
    moved >= 6,
    `only ${moved} of these instant/zone pairs fall on a different day from UTC. The table has `
    + 'stopped covering a day boundary, so this test can no longer tell a zoned day from a '
    + 'UTC one.',
  );
});

/**
 * The zone a screen NAMES is the zone that instant is actually in — the same
 * fields, read a third way.
 *
 * `conv.datesIn` draws this beside a date filter, so an empty answer can still
 * say whose day it looked for. Pinned here rather than left to the browser
 * because it is a reading of `zonedFields`, and a reading that drifted from
 * the stamp's tail would put two different clock names on one screen.
 */
test("the clock a filter is named after is the stamp's own tail", async () => {
  const { zonedStamp, zonedZone } = await viewModel();
  for (const zone of ZONES) {
    for (const at of INSTANTS) {
      const named = zonedZone(at, zone);
      assert.notEqual(named, null, `refused a real instant: ${at} in ${zone}`);
      assert.ok(
        String(zonedStamp(at, zone)).endsWith(` ${String(named)}`),
        `the zone named beside a filter (${String(named)}) is not the zone the stamps carry `
        + `for ${at} in ${zone}: ${String(zonedStamp(at, zone))}`,
      );
    }
  }
  // The transition itself, stated rather than swept: naming today's offset
  // over a filter set months back is a small copy of the defect above.
  assert.equal(zonedZone('2026-07-15T12:00:00Z', 'Asia/Jerusalem'), 'GMT+3');
  assert.equal(zonedZone('2026-01-15T12:00:00Z', 'Asia/Jerusalem'), 'GMT+2');
});

/* ══ THE DATE MOVES TOO, WHICH A TIME-ONLY FIX WOULD NOT ══════════════════ */

test('a stamp near midnight moves its DAY, not only its clock', async () => {
  const { zonedStamp } = await viewModel();
  // 23:59 UTC is already tomorrow in Jerusalem. A viewer that converted only
  // the clock would draw `2026-09-08 02:59`, which is a day wrong and looks
  // right.
  assert.equal(zonedStamp('2026-09-08T23:59:00Z', 'Asia/Jerusalem'), '2026-09-09 02:59 GMT+3');
  // And backwards, for the negative half.
  assert.equal(zonedStamp('2026-09-08T02:00:00Z', 'America/New_York'), '2026-09-07 22:00 GMT-4');
});

test('the offset is the zone\'s on that date, not the zone\'s today', async () => {
  const { zonedStamp } = await viewModel();
  // Same zone, same reader, two sides of a DST change. An archive is read
  // months later by definition, so this is the ordinary case and not an edge.
  assert.equal(zonedStamp('2026-09-08T12:00:00Z', 'Asia/Jerusalem'), '2026-09-08 15:00 GMT+3');
  assert.equal(zonedStamp('2026-01-15T12:00:00Z', 'Asia/Jerusalem'), '2026-01-15 14:00 GMT+2');
});

/* ══ THE ZONE COMES FROM THE READER, NOT FROM WHOEVER STORED THE VALUE ════ */

test('with no zone argument the reader\'s own runtime decides', async () => {
  const { zonedStamp } = await viewModel();
  // The ONE ambient assertion in this file, and it is the property the item is
  // about: the default is not UTC, not the server's, not a constant — it is
  // whatever the runtime reading the stamp resolves. In a browser that is the
  // reader's machine; in a terminal it is the person at the keyboard.
  //
  // `TZ` is set INSIDE the callbacks rather than around a cached formatter:
  // `viewmodel.js` keeps one `Intl.DateTimeFormat` per zone key, and the
  // no-argument key would otherwise be answered from a formatter built under
  // the previous zone. Asserting the CLI form first, which caches nothing,
  // makes a caching regression in the browser form visible as a MISMATCH
  // rather than as a stale-but-plausible time.
  inZone('Asia/Jerusalem', () => {
    assert.equal(cliStamp('2026-09-08T14:11:00Z'), '2026-09-08 17:11 GMT+3');
  });
  inZone('America/New_York', () => {
    assert.equal(cliStamp('2026-09-08T14:11:00Z'), '2026-09-08 10:11 GMT-4');
  });
});

/* ══ WHAT IS REFUSED, AND WHY THE ARCHIVE'S ANSWER IS `null` ══════════════ */

test('only a real instant is drawn; a stamp with no zone is refused outright', async () => {
  const { zonedStampOf } = await parts();

  // These carry NO zone. `new Date()` reads them as the running machine's
  // LOCAL time, so reformatting one shifts it by an offset nobody measured and
  // then presents the result as though somebody had — the original defect
  // wearing the repair's clothes. `parts.js`' `INSTANT` guard already refuses
  // them for `clockOf` and `stampOf`, and this form inherits it.
  for (const text of ['2026-08-23 05:21:54', '2026-08-23', 'not a date', '', 'never']) {
    assert.equal(
      zonedStampOf(text, 'Asia/Jerusalem'), null,
      `reformatted a string that names no zone: ${JSON.stringify(text)}`,
    );
  }
  // Total: a `null`, an `undefined` or a number is answered, never thrown over.
  assert.equal(zonedStampOf(null, 'UTC'), null);
  assert.equal(zonedStampOf(undefined, 'UTC'), null);

  // And every zoned ISO-8601 spelling a transcript record can carry IS drawn —
  // the harness writes the first of these, and the rest are what the format
  // allows.
  for (const at of [
    '2026-09-08T14:11:23.456Z', '2026-09-08T14:11:23Z',
    '2026-09-08T17:11:23+03:00', '2026-09-08T10:41:23-0330',
  ]) {
    assert.equal(
      zonedStampOf(at, 'Asia/Jerusalem'), '2026-09-08 17:11 GMT+3',
      `not drawn as the one instant it is: ${at}`,
    );
  }
});
