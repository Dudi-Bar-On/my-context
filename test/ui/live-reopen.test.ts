// @basis TASK-the-stream-s-fault-has-a-fix-but-not-yet-a-demonstrated, TASK-one-dead-stream-is-announced-on-every-screen-for-ever-and-a, TASK-a-refresh-keeps-the-reader-s-place-or-it-asks
/**
 * **THE REOPEN IS A STREAM AND NEVER A RELOAD, AND THAT IS THE ASSERTION.**
 *
 * `plan:live seq:22`. The owner's own instruction was *"i think we need to
 * refresh the page on the same event we refreshing the status bar"* — the
 * EVENT is right and the ACTION is not, and the difference is not something a
 * comment can hold, because the wrong version works. A page reloaded on every
 * return to the tab looks completely correct in a browser: the feed comes
 * back. What it silently destroys is everything `plan:archive seq:19`, `22`,
 * `23` and `plan:live seq:15` were built to protect — scroll position, open
 * folds, the session being read, a marked passage, the text in the filter box
 * — and it destroys them only for a reader who has been reading, which is the
 * one class of user no test with a fresh page ever plays.
 *
 * `e2e/live-reopen.spec.ts` drives the recovery in a real browser and asserts
 * that a mark set on the page survives it. This file is the cheaper half, and
 * it is here because the browser one cannot say WHY: it pins the four guards
 * the reopen is gated on and the pairing of the two stop handles, so that a
 * later edit that removes one of them fails with the reason rather than with a
 * timeout on a screen.
 *
 * **Static assertions over `app.js`, for the reason `code-skew.test.ts` uses
 * them**: this is DOM wiring in a browser module that Node cannot import, the
 * property is about the SHAPE of the wiring rather than about a value, and a
 * regex that names the line is a search term the next reader can follow.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Line endings normalised — this repository is checked out CRLF on Windows. */
const source = (...parts: string[]): string =>
  readFileSync(path.join(import.meta.dirname, '..', '..', 'src', ...parts), 'utf8')
    .replaceAll('\r\n', '\n');

function assertMatches(text: string, pattern: RegExp, message: string): void {
  assert.ok(pattern.test(text), `${message}\n  pattern: ${String(pattern)}`);
}

test('the look tick reopens the STREAM, and the only reloads on the page are a reader pressing a button', () => {
  const app = source('ui', 'public', 'app.js');

  assertMatches(app, /stopLiveLook = startLookTicks\(document, window, reopenLiveStream\);/,
    'the reopen must hang off the look tick — the event a reader generates, not a timer');
  assertMatches(app, /import \{ startHeartbeat, startLookTicks \} from '\/lib\/heartbeat\.js';/,
    'and it must be `heartbeat.js`\'s one mechanism rather than a third hand-written copy '
    + 'of visibilitychange + focus (`plan:archive seq:25` moved it there to end exactly that)');

  // **`reopenLiveStream` is not `heartbeatPing`, and that is the §2 line.**
  // The heartbeat runs on a 60 s SCHEDULE as well as on a look. A reopen
  // carried on that beat would be a page silently re-establishing a held-open
  // connection on a timer — the daemon by another name — so the two are
  // separate callbacks on purpose and this asserts they stay separate.
  assert.equal(
    /function heartbeatPing\(\)[\s\S]{0,600}?\n\}/.exec(app)?.[0].includes('reopenLiveStream'),
    false,
    'the reopen leaked into the scheduled heartbeat beat: that is a reconnect on a timer',
  );

  // THE ONLY TWO RELOADS IN THE SHELL, both under a click handler. If a third
  // appears, this fails and whoever added it has to say whose finger is on it.
  const reloads = app.match(/location\.reload\(\)/g) ?? [];
  assert.equal(reloads.length, 2,
    'a third `location.reload()` reached the shell — a reader who is reading must not be moved '
    + '(`TASK-a-refresh-keeps-the-reader-s-place-or-it-asks`)');
  assertMatches(app, /refresh\.onclick = \(\) => \{ location\.reload\(\); \};/,
    'the disconnected banner\'s refresh is one of them, and it is a button');
  assertMatches(app, /langButton\.onclick = [\s\S]{0,120}?location\.reload\(\);/,
    'the language switch is the other, and it is a button too');
});

test('the reopen refuses on all four of its guards', () => {
  const app = source('ui', 'public', 'app.js');
  const body = /function reopenLiveStream\(\) \{[\s\S]*?\n\}/.exec(app)?.[0] ?? '';
  assert.notEqual(body, '', 'reopenLiveStream is gone entirely');

  // Never opened: `ensureLiveStream()` owns that, called by `route()` on every
  // screen it builds. Opening the ONE connection from a focus event would open
  // it for a page that has not asked for it.
  assertMatches(body, /if \(liveStop === null\) return;/, 'a page that never opened a stream must not open one on focus');
  // Still running: a second connection is two of the thing `plan:live seq:1`
  // exists to make one of.
  assertMatches(body, /if \(!liveClosed\) return;/, 'a running stream must not be replaced');
  // Refused rather than dropped. A stream that never said `hello` was refused,
  // and retrying a refusal on every glance is one audited `ui-refused` write
  // per glance — the defect `CREDENTIAL_COOKIE` was invented to end.
  assertMatches(body, /if \(!liveEstablished\) return;/,
    'a connection that never worked must not be retried on every look');
  // And the same credential gate `ensureLiveStream()` applies.
  assertMatches(body, /if \(!credentialHeld\(\)\) return;/,
    'a page holding no credential must not spend a request finding out');

  assert.equal(body.includes('reload'), false, 'the reopen reopened the PAGE');
});

test('every place the shell stops the heartbeat stops the look tick too', () => {
  const app = source('ui', 'public', 'app.js');

  // **THE PAIRING IS THE §2 STORY AND IT HAS TWO CALL SITES.** `api()`'s catch
  // and `stream()`'s own fetch catch each mean the same thing — a request has
  // proved the server is gone — and after that moment nothing on this page may
  // keep reaching for it. A look tick that survived one of them would be a
  // dead page reopening a stream against a process that exited, arriving
  // through the one channel a cleared timer does not close.
  const calls = app.match(/stopHeartbeat\(\);\n\s*(?:stopLiveLook\(\);)?/g) ?? [];
  const invocations = (app.match(/\bstopHeartbeat\(\);/g) ?? []).length;
  assert.ok(invocations >= 2, 'the heartbeat stop sites have moved — re-read this assertion');
  for (const call of calls) {
    assert.ok(call.includes('stopLiveLook();'),
      'a `stopHeartbeat()` is not followed by `stopLiveLook()`: one failure path leaves the page '
      + 'still reopening a stream against a server it has already been told is gone');
  }
  assert.equal((app.match(/\bstopLiveLook\(\);/g) ?? []).length, invocations,
    'the two stops must be called the same number of times — they answer to one fact');
});

test('a working connection un-says the fault, and only a working one', () => {
  const app = source('ui', 'public', 'app.js');

  // `plan:live seq:21` kept `liveEnded` deliberately: it is the only thing
  // `subscribeStream()` can replay to a screen that mounts after the fault,
  // and dropping it would leave that screen a cheerful `hello` over a dead
  // connection. That rule holds exactly while the stream is dead. A NEW
  // `hello` is a working connection, and replaying a fault over one would be
  // the same lie in the other direction.
  const hello = /if \(event === 'hello'\) \{[\s\S]*?\n  \}/.exec(app)?.[0] ?? '';
  assert.notEqual(hello, '', 'the hello branch of dispatchLiveEvent is gone');
  assertMatches(hello, /liveEstablished = true;/, 'a hello is what proves the connection works');
  assertMatches(hello, /liveEnded = null;/, 'a new connection must clear the fault it replaces');
  assertMatches(hello, /liveProven = false;/,
    '`liveProven` is the switch between two sentences about a DEAD feed, and there is no longer one');
  assertMatches(hello, /hideLiveState\(\);/, 'and the chip must come down with them');

  // The clearing is inside the `liveEnded !== null` branch, so the ordinary
  // first `hello` of a healthy page touches none of it.
  assertMatches(hello, /if \(liveEnded !== null\) \{/,
    'the clear must be gated on there having been a fault at all');
});
