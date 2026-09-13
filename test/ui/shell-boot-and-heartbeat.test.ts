// @basis TASK-the-browser-shell-has-no-catch-and-no-storage-guard-so-a, TASK-one-failed-request-stops-the-heartbeat-for-good-and-the-next, INV-nothing-is-dropped-silently
/**
 * **TWO SHELL DEFECTS THAT BOTH READ AS A HEALTHY PAGE.** `plan:swallow seq:2`
 * and `seq:3`. Both were DRIVEN IN A BROWSER before anything here was written,
 * against a throwaway server on port 58991 on 2026-09-13, and the numbers
 * below are measurements rather than expectations.
 *
 * ── seq:2 — A BLOCKED BROWSER READ AS A DEAD SERVER ────────────────────────
 *
 * With `localStorage` made to throw on the PROPERTY ACCESS — which is what a
 * browser configured to block site data actually does, and what a sandboxed
 * frame does — the shell produced: 0 rail buttons, 0 characters of screen,
 * 237 characters of body (the bare HTML skeleton), no banner, no console
 * message a person would see. `main()`'s first statement threw and `main()`
 * returned a rejected promise nobody held. `lane.js` and `doc.js` each end
 * `main().catch(...)` with a comment saying they follow "the same rule the
 * shell follows"; the shell did not follow it.
 *
 * Restoring the `.catch` ALONE turned that blank page into a visible sentence:
 * "Access is denied for this document." Guarding the access as well booted the
 * page completely: 20 rail buttons, 7,090 characters of screen, in English.
 *
 * ── seq:3 — THE BANNER GOES AND THE HEARTBEAT DOES NOT COME BACK ───────────
 *
 * Four steps, driven in order:
 *
 *   1. one 403 — "Not connected" is drawn;
 *   2. one request whose `fetch` rejects — "The server has exited" replaces
 *      it, and `api()`'s catch calls `stopHeartbeat()`;
 *   3. the next 200 — `#exited` is hidden again;
 *   4. and then no `/api/ping` for 80 seconds. A control page on the same
 *      build and the same server, with no failure in it: one `/api/ping` at
 *      +56 s.
 *
 * After the repair, the same sequence: one beat immediately on recovery and a
 * scheduled one 60 s later. Removing `rearmHeartbeat()` alone reproduces the
 * original exactly — banner hidden, zero beats — which is what makes that one
 * line the subject of this item rather than a nicety beside it.
 *
 * ── WHY THESE ARE STATIC ASSERTIONS ────────────────────────────────────────
 *
 * `live-reopen.test.ts`'s reason, unchanged: this is DOM wiring in a browser
 * module Node cannot import, the property is about the SHAPE of the wiring,
 * and a regex that names the line is a search term the next reader can follow.
 * The browser run is the evidence; this file is what makes a later edit fail
 * with a reason instead of with a blank page nobody is looking at.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const source = (...parts: string[]): string =>
  readFileSync(path.join(import.meta.dirname, '..', '..', 'src', ...parts), 'utf8')
    .replaceAll('\r\n', '\n');

function assertMatches(text: string, pattern: RegExp, message: string): void {
  assert.ok(pattern.test(text), `${message}\n  pattern: ${String(pattern)}`);
}

test('the shell ends its boot with a catch, like the two files that say they copy it', () => {
  const app = source('ui', 'public', 'app.js');
  const lane = source('ui', 'public', 'lane.js');
  const doc = source('ui', 'public', 'doc.js');

  // THE PREMISE, ASSERTED RATHER THAN RECITED. The item's whole argument is
  // that two files claim to follow a rule the third did not. If either of
  // those files loses its catch, this test's reasoning is stale and the
  // reader should be told here rather than discover it in a comment.
  assertMatches(lane, /main\(\)\.catch\(/, 'lane.js is one of the two files that already do this');
  assertMatches(doc, /main\(\)\.catch\(/, 'doc.js is the other');

  assertMatches(app, /main\(\)\.catch\(/,
    'the shell boots with no handler again: a `main()` that throws leaves the page exactly as '
    + 'the HTML left it — measured at 0 rail buttons and 237 characters of body — which reads '
    + 'as a dead server and sends the reader to restart one that was never the problem');

  const handler = /main\(\)\.catch\(\(error\) => \{[\s\S]*?\n\}\);/.exec(app)?.[0] ?? '';
  assert.notEqual(handler, '', 'the catch is there but not in the shape this test can read');
  assertMatches(handler, /document\.getElementById\('exited'\)/,
    'it must reach a region a reader will actually see — `#exited` carries `role="alert"`');
  assertMatches(handler, /hidden = false/, 'and it must SHOW it; building nodes into a hidden node is the same silence');
  assertMatches(handler, /error instanceof Error \? error\.message : String\(error\)/,
    'the message is the error\'s own words, for doc.js\'s reason: a boot can fail before the '
    + 'string table exists, and a missing key would turn the disclosure into a second blank page');
});

test('every storage access in the shell is guarded, and a third one cannot be added quietly', () => {
  const app = source('ui', 'public', 'app.js');

  // TWO ACCESSES, AND THE COUNT IS THE GATE. `sessionStorage` is deliberately
  // excluded: its three uses were already wrapped (`rememberToken`,
  // `rememberedToken`, `forgetToken`) and are not what this item is about.
  // If a third `localStorage` reaches this file, this fails and whoever added
  // it has to say where its guard is.
  const accesses = app.match(/\blocalStorage\./g) ?? [];
  assert.equal(accesses.length, 2,
    `the shell now touches localStorage ${accesses.length} times; reading the PROPERTY throws in `
    + 'a sandboxed frame or with site data blocked, so each one needs its own guard and this '
    + 'assertion needs re-reading');

  const remembered = /function rememberedLanguage\(\) \{[\s\S]*?\n\}/.exec(app)?.[0] ?? '';
  assert.notEqual(remembered, '', 'the guarded read is gone');
  assertMatches(remembered, /try \{[\s\S]*?localStorage\.getItem[\s\S]*?\} catch \{/,
    'the read must be inside the try, not beside it');
  assertMatches(remembered, /return null;/, 'and the refusal answers null — `pickLanguage` already takes it');

  assertMatches(app, /pickLanguage\(rememberedLanguage\(\), navigator\.language\)/,
    'main() must go through the guard; a bare `localStorage.getItem` on that line is the '
    + 'original defect, and it was the FIRST statement of the boot');

  const langHandler = /langButton\.onclick = \(\) => \{[\s\S]*?\n  \};/.exec(app)?.[0] ?? '';
  assert.notEqual(langHandler, '', 'the language switch handler is gone');
  assertMatches(langHandler, /try \{[\s\S]*?localStorage\.setItem[\s\S]*?\} catch \{/,
    'the WRITE needs the same guard as the read — the same property access throws');
  assertMatches(langHandler, /\} catch \{[^\n]*\n\s*location\.reload\(\);/,
    'and the reload happens on both branches: a browser that will not remember the choice '
    + 'still honours it for this document, which beats a button that does nothing silently');
});

test('a handoff that never reaches the server leaves a page, not a rejected promise', () => {
  const app = source('ui', 'public', 'app.js');

  // `lib/bootstrap.js` promises `null` "on any refusal ... not throw into an
  // unhandled rejection the shell never shows the user" — true of a refusal,
  // false of a `fetch` that reached nothing. Pasting the printed URL while the
  // server is still binding took the boot down here. The repair is the
  // shell's, not `bootstrap.js`'s: `lib/` is another lane's file today.
  const exchange = /const nonce = extractNonce\(location\.hash\);[\s\S]*?rememberToken\(token\);\n  \}/.exec(app)?.[0] ?? '';
  assert.notEqual(exchange, '', 'the boot\'s nonce exchange is gone or has changed shape');
  assertMatches(exchange, /try \{[\s\S]*?await exchangeNonce\([\s\S]*?\} catch \{/,
    'the exchange must be guarded: it rejects when the server is not listening yet');
  assertMatches(exchange, /token = null;/,
    'and the answer is an absent credential, which is a state this shell draws — '
    + '`showDisconnected()` already says "the printed link is the way" back');
  assertMatches(exchange, /history\.replaceState\(null, '', location\.pathname\);/,
    'the fragment still dies (§2). Preserving it on the unreachable branch was tried and '
    + 'measured: `route()` overwrites the hash within the same boot, so a comment claiming '
    + 'the nonce survives would be a claim the code cannot keep');
});

test('a stopped heartbeat is re-armed by a proven answer, and by nothing else', () => {
  const app = source('ui', 'public', 'app.js');

  // ── EVERY GIVE-UP IS RECORDED ────────────────────────────────────────────
  // The same pairing `live-reopen.test.ts` holds for `liveUnreachable`, and
  // for the same reason: a failure path that stops the heartbeat and does not
  // say so leaves nothing able to put it back.
  const stops = (app.match(/\bstopHeartbeat\(\);/g) ?? []).length;
  assert.ok(stops >= 2, 'the heartbeat stop sites have moved — re-read this assertion');
  assert.equal((app.match(/heartbeatStopped = true;/g) ?? []).length, stops,
    'a failure path stops the heartbeat without recording it, so the next proven answer cannot '
    + 'put it back — which is the whole of `plan:swallow seq:3`: 0 pings in 80 seconds against '
    + 'a control page\'s 1 at +56 s');

  // ── THE RE-ARM IS ON EVIDENCE, NEVER ON A TIMER ──────────────────────────
  const rearm = /function rearmHeartbeat\(\) \{[\s\S]*?\n\}/.exec(app)?.[0] ?? '';
  assert.notEqual(rearm, '', 'rearmHeartbeat is gone');
  assertMatches(rearm, /if \(!heartbeatStopped\) return;/,
    'it must be a no-op on a page whose heartbeat is already running: starting a second '
    + 'interval doubles the cadence `measureCorpusDrift`\'s budget was ruled against');
  assertMatches(rearm, /stopHeartbeat = startHeartbeat\(document, heartbeatPing, HEARTBEAT_MS, window\);/,
    'and it must restart the one mechanism, with the one interval');
  assertMatches(rearm, /void heartbeatPing\(\);/,
    'plus one beat out of band, for heartbeatPing\'s own reason: the scheduled beat is a whole '
    + 'period out and until it lands the session pills say `not read`');
  assert.equal(/setTimeout|setInterval|retry|schedule/i.test(rearm), false,
    '§2 forbids reconnecting ON A TIMER. This may only run off a response the page already '
    + 'holds; anything that waits and tries again is the daemon by another name');

  // ── AND IT RUNS EXACTLY WHERE THE SERVER PROVED ITSELF ───────────────────
  const clearing = /if \(response\.ok && \([\s\S]*?\n  \}/.exec(app)?.[0] ?? '';
  assert.notEqual(clearing, '', 'the banner-clearing branch is gone or has changed shape');
  assertMatches(clearing, /disconnectedShown \|\| exitedShown/,
    'the condition must name BOTH banners. It read `disconnectedShown` alone while the '
    + 'statement hid `#exited` whatever was in it, so a 403 earlier in the page\'s life '
    + 'silently licensed the removal of a banner raised by something else');
  assertMatches(clearing, /rearmHeartbeat\(\);/,
    'and the re-arm must be IN this branch. Removing this one line reproduces the original '
    + 'defect exactly — measured: banner hidden, zero beats — because hiding the sentence '
    + 'that explained the failure without ending the failure is what made the page look healthy');
  assertMatches(clearing, /exitedShown = false;/, 'and the flag it just acted on is cleared');

  // The exit banner has to SET that flag, or the branch above can never see it.
  const exited = /function showExited\(\) \{[\s\S]*?\n\}/.exec(app)?.[0] ?? '';
  assert.notEqual(exited, '', 'showExited is gone');
  assertMatches(exited, /exitedShown = true;/, 'showExited must record that it is the banner on screen');
  assertMatches(exited, /ok\.onclick = \(\) => \{[\s\S]*?exitedShown = false;/,
    'and dismissing it by hand must clear the flag too, or the next 200 re-arms nothing');
});
