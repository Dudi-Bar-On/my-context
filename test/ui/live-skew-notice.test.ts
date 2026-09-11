// @basis TASK-the-live-feed-notice-says-reload-when-the-server-is-stale, TASK-one-dead-stream-is-announced-on-every-screen-for-ever-and-a
/**
 * **A REMEDY THAT CANNOT WORK IS WORSE THAN NO REMEDY, AND THIS IS THE ONE
 * STATE WHERE THE PAGE ALREADY KNOWS WHICH REMEDY IS WHICH.**
 *
 * Owner report 2026-09-12: the strip said `watch.streamNotLive` — *"the live
 * feed is not running — reload to reconnect"* — and reloading did not help. It
 * could not: his server process had been running since 2026-09-11 01:56, and
 * `src/ui/public/` is read from disk on every request while the server's
 * modules loaded once at start. Every reload produced today's client against
 * yesterday's server, for ever.
 *
 * The page was not guessing at that. `/api/ping` answers `staleCode` on the
 * heartbeat and `/api/meta` answers it at first paint, and `noteCodeSkew` is
 * called from both. The fact was in hand and `showLiveState()` never asked for
 * it, so the strip offered a reload in the one state where a restart is the
 * remedy — while `ex.codeSkew`, which says exactly that, sat one function away.
 *
 * **WHAT IS ASSERTED HERE IS THE READ, NOT A SECOND REQUEST.** The skew fact is
 * REMEMBERED, in the shape `corpusDriftAnswer` already established one screen
 * over, so the notice reaches it with no traffic at all. That matters beyond
 * tidiness: `stream()`'s own catch calls `stopHeartbeat()`, so a page that lost
 * the server even once has no channel left on which to ask — a notice that
 * fetched its own answer would be asking down the pipe that is down.
 *
 * **AND THE DISMISSAL IS PINNED UNCHANGED.** `showCodeSkew`'s `ex.ok` means "I
 * know, I will restart when I am ready", and its own header argues that "a
 * warning that reappears every sixty seconds after being answered is the one
 * that teaches people to ignore banners". That is a module-level flag and not
 * persisted, so a reload restores it. Two assertions below exist only to hold
 * that property still while the fact beside it changes.
 *
 * **Static assertions over `app.js`, for the reason `live-reopen.test.ts` and
 * `code-skew.test.ts` use them**: this is DOM wiring in a browser module Node
 * cannot import, the property under test is the SHAPE of the wiring, and a
 * regex that names the line is a search term the next reader can follow.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');
const STRINGS = path.join(REPO, 'src', 'ui', 'public', 'strings');

/** Line endings normalised — this repository is checked out CRLF on Windows. */
function appSource(): string {
  return readFileSync(path.join(REPO, 'src', 'ui', 'public', 'app.js'), 'utf8')
    .replaceAll('\r\n', '\n');
}

/** The body of one top-level `function name() { … }`, braces at column 0. */
function body(app: string, name: string): string {
  const found = new RegExp(`\\nfunction ${name}\\([^)]*\\) \\{\\n[\\s\\S]*?\\n\\}`).exec(app);
  assert.notEqual(found, null, `${name} is gone entirely`);
  return found === null ? '' : found[0];
}

type Table = { lang: string; dir: string; strings: Record<string, string> };
async function table(language: 'en' | 'he'): Promise<Table> {
  const url = new URL(`file://${path.join(STRINGS, `${language}.js`).replaceAll('\\', '/')}`);
  return (await import(url.href)) as Table;
}

const STALE_KEY = 'watch.streamNotLiveStale';
const RELOAD_KEY = 'watch.streamNotLive';

test('the live-feed notice reads the skew fact and swaps the remedy for it', () => {
  const showLiveState = body(appSource(), 'showLiveState');

  // The whole defect, in one line: the chip used to choose on `liveProven`
  // alone. `codeSkewSeen` is the second half of that choice, and it must be
  // read INSIDE the function that draws the sentence — a caller that decided
  // for it would be a second place for the two facts to disagree.
  assert.ok(showLiveState.includes('codeSkewSeen'),
    'showLiveState never consults the skew fact, so it can still offer a reload '
    + 'to a reader whose server is the thing that is stale');
});

test('the skew fact selects the stale-server sentence, and the reload sentence survives for the case it fits', () => {
  const showLiveState = body(appSource(), 'showLiveState');

  // The window is 60 characters and that is load-bearing: it spans the one
  // `? translate(table.strings, ` between the test and its key, and nothing
  // wider. At 120 it would still pass with the two sentences SWAPPED — the
  // stale remedy given to the reader whose server is fine — which is the shape
  // of assertion this project keeps catching, one that is green for the bug.
  assert.match(showLiveState, new RegExp(`codeSkewSeen[\\s\\S]{0,60}?'${STALE_KEY.replace('.', '\\.')}'`),
    'the stale-server sentence is not the one the skew fact selects');
});

test('a dropped stream on a CURRENT server still gets the advice that works', () => {
  const showLiveState = body(appSource(), 'showLiveState');

  assert.ok(showLiveState.includes(`'${RELOAD_KEY}'`),
    'the ordinary not-live sentence is gone — a dropped stream on a current server is '
    + 'still recovered by a reload, and that reader is owed the advice that works');
});

test('the notice reaches the fact with no request, because the channel it would ask on can be down', () => {
  const showLiveState = body(appSource(), 'showLiveState');

  // `stream()`'s catch calls `stopHeartbeat()`. A page that has lost the server
  // once has no poll left, so a notice that fetched its own answer would be
  // asking down the pipe that is down. The fact is remembered instead.
  assert.equal(/\bapi\(|\bfetch\(|\bawait\b|\bpost\(/.test(showLiveState), false,
    'showLiveState issues a request to learn what it was already told — and it draws '
    + 'synchronously from a frame handler, where there is nothing to await it');
});

test('noteCodeSkew records the skew, which is the only reason the notice has anything to read', () => {
  const noteCodeSkew = body(appSource(), 'noteCodeSkew');

  assert.match(noteCodeSkew, /staleCode === true[\s\S]{0,200}?codeSkewSeen = true/,
    'nothing records the skew, so the notice has nothing to read');
});

test('the skew is UNLEARNED when the server answers fresh, so a restarted server stops being accused', () => {
  const noteCodeSkew = body(appSource(), 'noteCodeSkew');

  // The half that is easy to forget. The owner restarts the server and leaves
  // the tab open; the next ping answers `staleCode: false`. A chip still saying
  // "restart it" at that point is a warning that has outlived its cause, which
  // is the defect `request()`'s own ok-branch was written to end.
  assert.match(noteCodeSkew, /staleCode === false[\s\S]{0,200}?codeSkewSeen = false/,
    'the fact is never unlearned: a server the reader HAS restarted would keep being '
    + 'accused for the rest of the page\'s life');
});

test('an answer that carries no staleCode at all changes nothing', () => {
  const noteCodeSkew = body(appSource(), 'noteCodeSkew');

  // `/api/ping` and `/api/meta` are the only two routes that carry the field.
  // Twenty screens make requests that say nothing about the server's code, and
  // a falsy test rather than an explicit `=== false` would read every one of
  // them as proof the server is current.
  assert.equal(/staleCode !== true|!answer\.staleCode/.test(noteCodeSkew), false,
    'a route that never answers `staleCode` would clear the fact — twenty screens make '
    + 'requests that say nothing about the server\'s code');
});

test('dismissing the banner silences it and does not unlearn the fact', () => {
  const showCodeSkew = body(appSource(), 'showCodeSkew');

  // `ex.ok` means "I know, I will restart when I am ready" — it is an answer to
  // the BANNER, not a claim that the server was restarted. The strip's own chip
  // is not chrome the reader dismissed and must keep telling the truth.
  assert.equal(showCodeSkew.includes('codeSkewSeen'), false,
    'the dismiss button reaches the skew FACT: answering a banner would blank the chip '
    + 'that explains why the feed cannot be reloaded back');
});

test('the dismissal is still a bare module flag, so a reload restores it', () => {
  assert.match(appSource(), /\nlet codeSkewDismissed = false;\n/,
    'the dismissal is no longer a plain module flag — if it now survives a reload, a reader '
    + 'who answered once can never be told again');
});

test('nothing about the skew is persisted', () => {
  assert.equal(/codeSkew\w*[\s\S]{0,200}?(localStorage|sessionStorage)/.test(appSource()), false,
    'the skew state was persisted: `ex.ok` is "I know, I will restart when I am ready", '
    + 'not a permanent opt-out of the disclosure');
});

test('the stale sentence is in the English table', async () => {
  const en = await table('en');
  assert.ok(STALE_KEY in en.strings, `${STALE_KEY} is missing from the English table`);
});

test('the stale sentence is in the Hebrew table', async () => {
  const he = await table('he');
  assert.ok(STALE_KEY in he.strings,
    `${STALE_KEY} is missing from the Hebrew table — a user-facing sentence here is `
    + 'added to both tables or to neither');
});

test('the stale sentence does not repeat the advice that cannot work', async () => {
  const en = await table('en');
  // If it also says "reload" it is the first sentence in different words and
  // the owner is back where he started. `typeof` is inside the assertion rather
  // than a `?? ''` fallback on purpose: a missing key must fail HERE too, or
  // this passes vacuously for the whole time the key does not exist — which is
  // exactly the shape of green assertion this project keeps catching.
  const stale = en.strings[STALE_KEY];
  assert.ok(typeof stale === 'string' && !/reload/i.test(stale),
    'the stale-server sentence still tells the reader to reload — the one thing that '
    + 'provably cannot help, which is why this key exists');
});

test('the stale sentence names the remedy that does work', async () => {
  const en = await table('en');
  assert.match(String(en.strings[STALE_KEY]), /restart/i,
    'the stale-server sentence names no restart, so it says the feed is dead and leaves '
    + 'the reader with nothing to do about it');
});

test('the Hebrew stale sentence carries the same swap, not the same advice', async () => {
  const he = await table('he');
  // `watch.streamNotLive` in Hebrew says רענן — refresh. The stale sentence is
  // the one that must NOT, or the Hebrew reader is given the remedy that cannot
  // work while the English reader is given the one that can.
  const stale = he.strings[STALE_KEY];
  assert.ok(typeof stale === 'string' && !stale.includes('רענן'),
    'the Hebrew stale-server sentence still says refresh — the swap landed in one table only');
});

test('the ordinary not-live sentence keeps the remedy that is right for IT', async () => {
  const en = await table('en');
  assert.match(en.strings[RELOAD_KEY] ?? '', /reload/i,
    'the ordinary not-live sentence lost its remedy: a dropped stream on a current server '
    + 'really is fixed by a reload');
});
