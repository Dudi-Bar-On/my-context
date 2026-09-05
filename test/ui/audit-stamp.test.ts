/**
 * **ONE AUDIT INSTANT, ONE SPELLING** — `plan:walk seq:101`.
 *
 * `audit.at` reaches a reader on three screens: the Audit stream's `At`, the
 * Ask table's `At`, and the injection preview's `When`. Until 2026-08-31 each
 * of the three formatted it in its own file, and the three were not three
 * copies of one function — they were two near-copies and one considered
 * divergence, which is worse:
 *
 *   `screens/watch.js` `clockOf`   `new Date(at)`, then `toLocaleTimeString`.
 *                                  Reformatted ANYTHING `Date` would accept.
 *   `screens/ask.js`   `clockOf`   the same output, but GUARDED: the text had
 *                                  to end in `Z` or an offset or it was
 *                                  returned unformatted.
 *   `screens/preview.js` `stampOf` a wall date AND a wall time, deliberately,
 *                                  because two preview rows can be weeks apart.
 *
 * The first two draw the SAME records from the SAME log through two different
 * parse guards, so one malformed record made the two audit tables disagree
 * about what a reader was looking at. And all three carried the identical
 * two-paragraph argument about `en-GB` and about drawing an unparsable stamp as
 * it arrived — the same reasoning written three times, free to rot in two
 * places while staying right in the third.
 *
 * `screens/parts.js` now holds ONE parse guard and TWO precisions over it, and
 * this file is the pin on that pair. The screens' own tests cover their use of
 * it; what is decidable — which strings are reformatted, what the two forms
 * agree about, and where they are allowed to differ — is decided here.
 *
 * ── WHY THIS FILE PINS THE TIME ZONE AND THE OTHER ONE DID NOT ────────────
 *
 * `test/ui/ask-screen.test.ts` asserted the SHAPE of the clock and said why:
 * the rendered value is the running machine's, so pinning the digits would
 * pin a time zone. That was right for a test that could only reach one form.
 * It is not enough here, because the defect under repair is precisely that
 * three renderings of one instant could disagree, and a shape assertion cannot
 * see a disagreement in the digits.
 *
 * So `process.env.TZ` is set around the digit assertions and restored, the same
 * pin `e2e/playwright.config.ts` applies to the browser (`timezoneId: 'UTC'`)
 * and `test/helpers/pin-rendering.ts` applies to the terminal, for the reason
 * that file gives: a suite whose expected output depends on the developer's
 * ambient settings is green on every machine that can run it locally. Node's
 * test runner gives each FILE its own process, so the pin cannot leak sideways
 * into another test file — and it is restored anyway.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const PARTS = new URL('../../src/ui/public/screens/parts.js', import.meta.url).href;

interface StampModule {
  clockOf: (at: unknown) => string;
  stampOf: (at: unknown) => string;
}

async function stamps(): Promise<StampModule> {
  return (await import(PARTS)) as unknown as StampModule;
}

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

/* ── The guard, which is the stricter of the two that were here ─────────── */

test('only a real instant is reformatted, and the two forms refuse exactly the same strings', async () => {
  const { clockOf, stampOf } = await stamps();

  // The stricter guard is `ask.js`', and taking it is a BEHAVIOUR CHANGE on the
  // Audit stream and on the preview: both used to hand anything `Date` would
  // accept to a formatter. It is the direction that stops a machine-local
  // offset being presented as a measurement, and these are the values it
  // protects — the index's `updated_at` carries no zone at all, so `new Date()`
  // reads it as LOCAL time and reformatting it shifts the value by the running
  // machine's offset and then shows the result as though it had been measured.
  const notInstants = [
    '2026-08-23 05:21:54',
    '2026-08-23',
    'not a date',
    '',
    'never',
  ];
  for (const text of notInstants) {
    assert.equal(clockOf(text), text, `clockOf reformatted a non-instant: ${JSON.stringify(text)}`);
    assert.equal(stampOf(text), text, `stampOf reformatted a non-instant: ${JSON.stringify(text)}`);
  }

  // A string that PASSES the guard and that `Date` still cannot parse falls
  // through the same way — the record's own bytes are the last true thing left.
  assert.equal(clockOf('2026-13-45T99:99:99Z'), '2026-13-45T99:99:99Z');
  assert.equal(stampOf('2026-13-45T99:99:99Z'), '2026-13-45T99:99:99Z');

  // Both forms are total: a `null` or a number is drawn, never thrown over.
  assert.equal(clockOf(null), 'null');
  assert.equal(stampOf(undefined), 'undefined');
});

test('every zoned ISO-8601 spelling an audit record can carry is an instant', async () => {
  const { clockOf, stampOf } = await stamps();
  // `recordAudit` writes `new Date().toISOString()`, which is the first of
  // these. The rest are the forms the declaration allows and the guard must
  // therefore accept, or the When column degrades to raw text on real data.
  for (const at of [
    '2026-08-29T04:33:07.500Z',
    '2026-08-29T04:33:07Z',
    '2026-08-29T04:33:07+03:00',
    '2026-08-29T04:33:07-0330',
  ]) {
    assert.match(clockOf(at), /^\d\d:\d\d:\d\d$/, `not reduced to a clock: ${at}`);
    assert.match(stampOf(at), /^\d\d\/\d\d\/\d{4}, \d\d:\d\d$/, `not reduced to a stamp: ${at}`);
  }
});

test('the offset is honoured rather than ignored, which is what the guard is for', async () => {
  const { clockOf, stampOf } = await stamps();
  // The same instant, written two ways. If the offset were dropped instead of
  // applied these would differ by three hours — and they would differ in
  // whichever zone the machine happens to be in, which is the failure the
  // guard exists to make impossible.
  assert.equal(clockOf('2026-08-29T07:33:07+03:00'), clockOf('2026-08-29T04:33:07Z'));
  assert.equal(stampOf('2026-08-29T07:33:07+03:00'), stampOf('2026-08-29T04:33:07Z'));
});

/* ── The two precisions, and what they may not disagree about ───────────── */

test('the clock keeps seconds, the stamp keeps the date, and they agree to the minute', async () => {
  const { clockOf, stampOf } = await stamps();
  const at = '2026-08-29T04:33:07.500Z';

  // **SECONDS ARE KEPT ON THE AUDIT TABLES.** A burst of ten `ui-refused`
  // records lands inside one second; without the seconds the burst is ten rows
  // stamped identically and a reader cannot order them at all.
  const later = clockOf('2026-08-29T04:33:08.000Z');
  assert.notEqual(clockOf(at), later, 'one second apart must not render identically');

  // **AND DROPPED ON THE WHEN COLUMN, WHICH TAKES THE DATE INSTEAD.** Two
  // preview rows can be weeks apart — `preview.when` says so on the screen —
  // and a bare clock draws those two identically while a second on a weeks-old
  // delivery is noise standing where the day should be.
  assert.equal(stampOf(at), stampOf('2026-08-29T04:33:08.000Z'),
    'the When column is minute precision, so one second must not change it');
  assert.notEqual(stampOf(at), stampOf('2026-09-05T04:33:07.500Z'),
    'a week apart must not render identically');

  // **THE ONE THING THEY MAY NOT DISAGREE ABOUT.** Two renderings of one fact
  // on two screens: whatever the zone, the hour and minute the preview shows
  // are the hour and minute the audit tables show. This is the assertion three
  // separate copies could never make.
  assert.equal(stampOf(at).slice(-5), clockOf(at).slice(0, 5));
});

/* ── The digits, with the machine's zone pinned ─────────────────────────── */

test('en-GB is a format and not a language: 24-hour, day-first, in both UI languages', async () => {
  const { clockOf, stampOf } = await stamps();
  const at = '2026-08-29T04:33:07.500Z';

  inZone('UTC', () => {
    // The exact pair the injection preview's When column was reported drawing.
    assert.equal(stampOf(at), '29/08/2026, 04:33');
    assert.equal(clockOf(at), '04:33:07');
  });

  // A zone east of UTC, to show the value is the READER'S wall clock rather
  // than the record's — and that the date follows the clock over a boundary,
  // which is the whole reason the When column carries one.
  inZone('Asia/Tokyo', () => {
    assert.equal(stampOf(at), '29/08/2026, 13:33');
    assert.equal(clockOf(at), '13:33:07');
    assert.equal(stampOf('2026-08-29T20:00:00.000Z'), '30/08/2026, 05:00',
      'the date must roll with the local clock, or the When names the wrong day');
  });

  // Midnight is `00`, never `24`. `hour12:false` selects `h23` here; the `h24`
  // reading would render midnight as `24:00` on the previous day's date, which
  // is a real ICU behaviour and would be a wrong DATE, not merely a wrong hour.
  inZone('UTC', () => {
    assert.equal(clockOf('2026-08-29T00:00:00.000Z'), '00:00:00');
    assert.equal(stampOf('2026-08-29T00:00:00.000Z'), '29/08/2026, 00:00');
  });
});

/* ── No fourth spelling ─────────────────────────────────────────────────── */

test('the three screens format an instant through this pair and nowhere else', async () => {
  const { readFileSync } = await import('node:fs');
  const path = await import('node:path');
  const screens = path.join(import.meta.dirname, '..', '..', 'src', 'ui', 'public', 'screens');

  // Three copies that agreed on the day they were written is how they came to
  // disagree, so the gate is not "the three agree" — it is that there are no
  // longer three. Any screen reaching for a date formatter of its own fails
  // here, on the line it was added.
  // `docs.js` was the fourth until 2026-09-05, when
  // `DEC-the-documentation-and-tutorials-screens-become-one-list-and` retired
  // it; `library.js` is what replaced it and it is held to the same rule.
  for (const file of ['watch.js', 'ask.js', 'preview.js', 'library.js']) {
    const source = readFileSync(path.join(screens, file), 'utf8');
    assert.equal(/toLocale(Time|Date)?String\(/.test(source), false,
      `${file} formats a date itself — import clockOf or stampOf from parts.js instead`);
  }

  // And `parts.js` holds exactly one guard for both forms.
  const parts = readFileSync(path.join(screens, 'parts.js'), 'utf8');
  assert.equal((parts.match(/T\.\*\(Z\|\[\+-\]/g) ?? []).length, 1,
    'parts.js must carry ONE instant guard, shared by both forms');
});
