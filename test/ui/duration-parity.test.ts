/**
 * **THE TWO SURFACES SPELL A DURATION THE SAME WAY, or this fails.**
 *
 * Owner ruling, 2026-09-01: *"every field that is also displayed on the
 * terminal status line should have exactly the same value in the web status bar
 * full resolution like hours and minutes"*. The report that produced it was
 * ELAPSED reading `5d` in the browser and `5d 8h` in the terminal.
 *
 * The cause was not a broken formatter. It was FOUR of them: `until`, `since`
 * and `elapsed` in `statusline-powerline.ts`, `untilReset` in `viewmodel.js`,
 * and a fifth spelling (`formatAge`) that rounded to a single unit and was what
 * the strip happened to call. Four hand-kept copies that must agree is the
 * defect this project has now measured ten times, and the answer is always the
 * same: derive, do not list.
 *
 * Both surfaces now hold ONE function each. They cannot be one function
 * shared, because `viewmodel.js` is untyped JavaScript and `tsconfig.json` sets
 * no `allowJs` — the bands next door take that same file by dynamic import
 * behind a runtime arrival check for exactly this reason, and that machinery is
 * async while the three callers here are sync.
 *
 * So this file is what stands in for the import: a sweep across every boundary
 * the arithmetic has and a deterministic spread between them, asserting the
 * terminal's three PUBLIC functions against `viewmodel.js`'s. Two copies proven
 * equal, rather than four hoped equal.
 *
 * It goes through `elapsed`/`since`/`until` and not through the terminal's
 * private helper on purpose: the observable surface is what the owner sees, and
 * a test that reached past it would keep passing while a wrapper broke.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { elapsed, since, until } from '../../src/cli/commands/statusline-powerline.ts';

const LIB = path.join(import.meta.dirname, '..', '..', 'src', 'ui', 'public', 'lib');

async function lib<T>(name: string): Promise<T> {
  return (await import(pathToFileURL(path.join(LIB, name)).href)) as T;
}

interface ViewModel {
  formatDuration: (ms: number, sep?: string) => string | null;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Every boundary the arithmetic actually has, each one straddled, plus a
 * deterministic spread. `Math.random` is not used: a parity test that fails on
 * one run in fifty and passes on the rest teaches people to re-run it.
 */
function spans(): number[] {
  const out: number[] = [];
  for (const edge of [0, MINUTE, HOUR, DAY, 2 * DAY, 48 * HOUR, 365 * DAY]) {
    out.push(edge - 1, edge, edge + 1);
  }
  // A 32-bit LCG — same sequence on every machine, every run.
  let seed = 20260901;
  for (let i = 0; i < 400; i += 1) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    out.push(seed % (400 * DAY));
  }
  return out.filter((ms) => ms >= 0);
}

test('the terminal and the strip spell an elapsed duration identically', async () => {
  const { formatDuration } = await lib<ViewModel>('viewmodel.js');
  assert.equal(typeof formatDuration, 'function',
    'viewmodel.js must export formatDuration — without it this whole file is vacuous');
  for (const ms of spans()) {
    assert.equal(elapsed(ms), formatDuration(ms, ' '),
      `elapsed(${ms}) — the bare clock is the SPACED spelling on both surfaces`);
  }
});

test('the terminal and the strip spell a countdown identically', async () => {
  const { formatDuration } = await lib<ViewModel>('viewmodel.js');
  const now = Date.parse('2026-09-01T12:00:00.000Z');
  for (const ms of spans()) {
    assert.equal(until((now + ms) / 1000, now), formatDuration(ms),
      `until(+${ms}) — a qualifier bolted to a field is the UNSPACED spelling`);
  }
});

test('the terminal and the strip spell an age identically', async () => {
  const { formatDuration } = await lib<ViewModel>('viewmodel.js');
  const now = Date.parse('2026-09-01T12:00:00.000Z');
  for (const ms of spans()) {
    assert.equal(since(new Date(now - ms).toISOString(), now), formatDuration(ms),
      `since(-${ms}) — the audit clock's age, unspaced on both surfaces`);
  }
});

/**
 * The separator is the ONE difference the ruling permits, so it is asserted
 * rather than left to be noticed: a later edit that "tidies" the spaced form
 * away would silently change a field the owner drew.
 */
test('the spaced and unspaced spellings differ only by the separator', async () => {
  const { formatDuration } = await lib<ViewModel>('viewmodel.js');
  for (const ms of spans()) {
    const spaced = formatDuration(ms, ' ');
    const tight = formatDuration(ms);
    assert.equal(spaced === null ? null : spaced.replace(' ', ''), tight,
      `${ms}ms — same value, same resolution, one space`);
  }
});

/**
 * The regression itself, named. `formatAge` still exists and is still right for
 * the web-only fields that want one coarse unit; what it may never again do is
 * spell a field the terminal also draws.
 */
test('a multi-unit duration is not rounded to a single unit', async () => {
  const { formatDuration } = await lib<ViewModel>('viewmodel.js');
  assert.equal(formatDuration(5 * DAY + 8 * HOUR, ' '), '5d 8h',
    'the exact reading the owner reported: the strip drew 5d where the terminal drew 5d 8h');
  assert.equal(formatDuration(5 * DAY + 8 * HOUR), '5d8h');
  assert.equal(formatDuration(13 * HOUR + 45 * MINUTE), '13h45m');
});
