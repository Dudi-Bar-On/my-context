/**
 * **`plan:rulings seq:26`, re-decided 2026-08-21 and reconciled 2026-08-25 —
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`.**
 *
 * The ledger TABLE is a projection of the audit log, and the only thing that
 * writes it is `topUpLedger` — reached by `mycontext status`, `mycontext decay`
 * and `audit replay-ledger`, and nothing else since dedupe moved to the seen
 * file. So a corpus injected into a thousand times, on which no aggregate CLI
 * reader has ever run, arrives at the UI with no ledger tables at all —
 * `read-model.ts`'s `LedgerPresence` names that `'not-projected'`, distinct
 * from `'ready'` (an initialised ledger, whether or not it holds rows).
 *
 * **The ruling: `not-projected` renders as its OWN panel, naming the command
 * that builds the projection — never as the mockup's null state**, because the
 * null state means "nothing here", which is exactly the claim a corpus with a
 * thousand real injections and zero recorded sessions would be making falsely.
 *
 * **Measured against `src/ui/public/app.js` on 2026-09-05: `loadSessions()`
 * never read `data.ledger` at all.** `/api/sessions` has carried the field
 * since `plan:ui1 seq:9`; the picker decided cold-or-not purely from
 * `data.sessions.length === 0`, which is true for BOTH `not-projected` and a
 * genuinely empty, fully-projected ledger — the exact collapse clause 2
 * forbids. `paintSessionList()`'s own comment called the cold row "a real
 * state (an empty ledger, or a session read that refused)", folding a THIRD
 * state — never projected — into the same two words.
 *
 * The fix reuses the `◌` unmeasured primitive `doctor.js`, `watch.js` and this
 * file's own `fillCorpusDrift`/`fillConfigError` already use — not a fourth
 * convention — and follows `showCodeSkew`'s seam: this lane does not own the
 * string tables, so the draw is guarded on the key existing and renders
 * nothing (never a `t()` throw) until it lands there.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');
const APP_JS = readFileSync(path.join(REPO, 'src', 'ui', 'public', 'app.js'), 'utf8');
const READ_MODEL_TS = readFileSync(path.join(REPO, 'src', 'ui', 'read-model.ts'), 'utf8');

function assertMatches(text: string, pattern: RegExp, message: string): void {
  assert.ok(pattern.test(text), `${message}\n  pattern: ${String(pattern)}`);
}

test('loadSessions reads the ledger presence off the wire, not off sessions.length', () => {
  assertMatches(APP_JS, /sessionLedgerPresence\s*=\s*data\.ledger/,
    'the picker must hold the SERVER\'s LedgerPresence rather than re-deriving it from an '
    + 'empty list, which is true of both not-projected and a genuinely empty ready ledger');
});

test('the popover draws a distinct not-projected notice, reusing the ◌ primitive', () => {
  assertMatches(APP_JS, /sessionLedgerPresence === 'not-projected'/,
    'paintSessionList must branch on the not-projected state to draw its own panel');
  assertMatches(APP_JS,
    /chip\.className = 'chip unmeas';\n\s*chip\.dataset\.g = '◌';\n[\s\S]{0,200}?SESS_NOT_PROJECTED_KEY/,
    'the notice reuses the SAME ◌ primitive doctor.js, watch.js and this file already use — not '
    + 'a fourth convention for the same fact');
});

test('the pending string key is named in the shell, guarded, not left to memory', () => {
  assertMatches(APP_JS, /SESS_NOT_PROJECTED_KEY in table\.strings/,
    'the draw is guarded on the key existing, the same seam showCodeSkew uses, so a missing '
    + 'table entry renders nothing rather than throwing');
  // The literal lives ONLY in the constant's own declaration — never inside a
  // `translate()` call — for the reason `CODE_SKEW_KEY` is a constant too:
  // `test/ui/viewmodel.test.ts` scans this file for the literal call shape and
  // fails the whole suite on a key not yet in both tables.
  assertMatches(APP_JS, /const SESS_NOT_PROJECTED_KEY = 'sess\.notProjected';/,
    'the literal is named once, in the constant\'s declaration');
  assertMatches(APP_JS, /translate\(table\.strings, SESS_NOT_PROJECTED_KEY\)/,
    'and reaches translate() by variable, invisible to the key-declared-in-both-tables scan');
});

test('read-model.ts no longer argues that the null ledger renders as the mockup\'s zero-data view', () => {
  // The comment this task's own STD overturned — `plan:rulings seq:26`'s
  // re-decision predates it and `withStores`'/`LedgerPresence`'s own comments
  // still said the old thing: "the owner ruled that both render as the
  // mockup's zero-data view; rendering alike is not being alike" (LedgerPresence,
  // ~883) and the identical claim on `withStores` (~211). Both are now exactly
  // backwards, in the same shape `plan:live seq:13` fixed for three other files.
  assert.equal(/owner ruled that both render as the mockup.s zero-data view/.test(READ_MODEL_TS),
    false, 'the overturned ruling must not still be asserted as current');
  assert.equal(
    /The owner has since ruled the null renders as the mockup.s zero-data view/.test(READ_MODEL_TS),
    false, 'the overturned ruling must not still be asserted as current, on withStores either');
});
