// @basis TASK-a-temporarily-disabled-boot-heartbeat-carries-no-item-no, INV-nothing-is-dropped-silently
/**
 * **THE BOOT BEAT, RE-ENABLED.** `plan:swallow seq:9`.
 *
 * `main()`'s tail read `// TEMPDISABLED void heartbeatPing();` — a call
 * commented out with no item id, no date and no re-enable condition, in
 * breach of `RULE-a-refusal-states-its-unblocking-condition` in its smallest
 * possible form. `heartbeatPing`'s own header (a few hundred lines above the
 * call site) already argues for exactly this call: "without an ask at boot
 * the two pills would say `not read` for up to sixty seconds on every page
 * load, which is honest and looks broken." The disabled line removed the
 * only beat some pages ever get — paired with the already-fixed
 * `plan:swallow seq:3` (a stopped heartbeat now re-arms on proven evidence,
 * see `test/ui/shell-boot-and-heartbeat.test.ts`), a page whose boot session
 * read failed would otherwise carry no liveness signal at all.
 *
 * This item's own closing condition is that the switch is either turned back
 * on, or its disabling carries an item id, a date and a re-enable condition
 * IN CODE with a test asserting the three are present. The item body argues
 * for the former — the call is restored — so this file asserts the
 * SILENCING marker is gone and the boot beat runs, rather than asserting a
 * disclosure that would leave the page beatless.
 *
 * ── WHY THIS IS A STATIC ASSERTION ──────────────────────────────────────
 *
 * Same reason `shell-boot-and-heartbeat.test.ts` gives for its neighbouring
 * assertions: `app.js` is DOM wiring in a browser module Node cannot import,
 * so the property under test is the SHAPE of the source, and a regex that
 * names the line is a search term the next reader can follow.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const source = (...parts: string[]): string =>
  readFileSync(path.join(import.meta.dirname, '..', '..', 'src', ...parts), 'utf8')
    .replaceAll('\r\n', '\n');

test('no TEMPDISABLED marker survives anywhere in the shell — a switch-off with no item, date or condition', () => {
  const app = source('ui', 'public', 'app.js');
  assert.equal(
    /TEMPDISABLED/.test(app), false,
    'a `TEMPDISABLED` comment is still in app.js. This item\'s whole complaint is a switch-off ' +
    'carrying no item id, no date and no re-enable condition — either the call is restored, or ' +
    'the disabling must instead carry all three, in code, with its own test asserting that',
  );
});

test('the boot asks one heartbeat as soon as fillContext runs, before route() — not a comment', () => {
  const app = source('ui', 'public', 'app.js');

  const main = /async function main\(\) \{[\s\S]*?\n\}\n/.exec(app)?.[0] ?? '';
  assert.notEqual(main, '', 'main() is gone or has changed shape — re-read this assertion');

  // The boot's own ordering: the beat is asked once a session is known
  // (`fillContext()` marks that point) and strictly before `route()` returns
  // control to the reader, matching `heartbeatPing`'s own header argument.
  const tail = /void fillContext\(\);[\s\S]*?await route\(\);/.exec(main)?.[0] ?? '';
  assert.notEqual(
    tail, '',
    'the segment between `fillContext()` and `route()` has moved or changed shape',
  );

  assert.match(
    tail, /(?<!\/\/ ?)(?<!TEMPDISABLED )void heartbeatPing\(\);/,
    'the boot beat must be an ACTIVE call, not a comment: `void heartbeatPing();` uncommented, ' +
    'the one call this item says the disabling removed',
  );

  // A negative control: the exact disabled form must not merely have moved
  // rather than been restored.
  assert.equal(
    /\/\/\s*TEMPDISABLED\s+void heartbeatPing\(\);/.test(tail), false,
    'the call is still commented out under its TEMPDISABLED marker',
  );
});
