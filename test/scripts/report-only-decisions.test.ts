// @basis TASK-five-checks-print-red-and-exit-zero-and-most-have-a-written, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **A check that prints findings and exits 0 must say so, and say what would
 * make it a gate.**
 *
 * `TASK-five-checks-print-red-and-exit-zero-and-most-have-a-written`: the
 * finding was never "these should all exit 1" — several of the rationales are
 * owner rulings and are correct. It was that *report-only plus never-run
 * equals not a gate*, and that the decision was recorded unevenly: some
 * checks argued it at length in their output, one argued it only in a source
 * comment nobody running the check ever sees, and none of them named what
 * would turn the tier into a gate. A reader could not tell a deliberate
 * report from an omitted `return 1`.
 *
 * **The never-run half is already closed** — measured on this tree:
 * `check:handover`, `check:basis`, `check:dependencies`, `check:needs-cycles`
 * and `verify:citations` all run in both workflows, and
 * `test/scripts/workflow-gates.test.ts` pins that. `check:cited-items` is in
 * neither, deliberately and with its reason pinned. So what is left, and what
 * this file holds, is the report-only half: the decision, in the check, where
 * the person reading the output is.
 *
 * ── THE SET IS DERIVED, NEVER LISTED ────────────────────────────────────────
 *
 * Every script under `scripts/` whose OUTPUT carries a "REPORTED, not/never
 * gated" disclaimer is in scope, found by reading the tree. A sixth check
 * written tomorrow is covered the day it is written, and the item's own count
 * of five is checked rather than copied: it was five when this was written,
 * and nothing here breaks if it becomes six.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SCRIPTS = path.join(REPO, 'scripts');

/** The disclaimer that makes a check report-only in one tier or another. */
const DISCLAIMER = /REPORTED,\s+n(?:ever|ot)\s+gated/i;
/** The half the item says was missing everywhere. */
const WHAT_WOULD_GATE = /what would make it a gate/i;

/** Every `scripts/*.ts` that tells its reader a tier is report-only. */
function reportOnlyScripts(): string[] {
  const all = readdirSync(SCRIPTS).filter((n) => n.endsWith('.ts'));
  assert.ok(all.length > 0, `no scripts under ${SCRIPTS}: this scan examined nothing`);
  return all.filter((n) => DISCLAIMER.test(readFileSync(path.join(SCRIPTS, n), 'utf8'))).sort();
}

test('the report-only set is found by reading the tree, and it is not empty', () => {
  // Anti-vacuity, and it is the load-bearing line here: a regex that stopped
  // matching would report zero report-only checks and conclude every one of
  // them names its gate condition.
  const found = reportOnlyScripts();
  assert.ok(
    found.length > 0,
    'no script under scripts/ carries a report-only disclaimer, which cannot be true of this '
    + 'tree — the scan is broken, not the checks',
  );
});

test('every report-only check names WHAT WOULD MAKE IT A GATE', () => {
  const missing: string[] = [];
  for (const name of reportOnlyScripts()) {
    const src = readFileSync(path.join(SCRIPTS, name), 'utf8');
    if (!WHAT_WOULD_GATE.test(src)) missing.push(`scripts/${name}`);
  }
  assert.deepEqual(
    missing, [],
    'these checks tell the reader a tier is reported and never gated, and do not say what would '
    + 'turn it into one. A reader cannot tell that from an omitted `return 1`, which is the whole '
    + `of TASK-five-checks-print-red-and-exit-zero-and-most-have-a-written:\n${missing.join('\n')}`,
  );
});

test('the decision is PRINTED, not only commented — proved on a real run', () => {
  // `scripts/check-ask-numbering.ts` argued "reporting is the whole job" in a
  // source comment and printed nothing of the kind, so its output was
  // indistinguishable from a gate that happened to be green. A source scan
  // alone would have called that file compliant, so one check is actually run
  // and its real stdout read.
  const out = execFileSync(process.execPath, [path.join(SCRIPTS, 'check-handover.ts')], {
    cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.match(out, DISCLAIMER, 'check-handover printed no report-only disclaimer at all');
  assert.match(
    out, WHAT_WOULD_GATE,
    'the disclaimer is printed and the gate condition is not, so the sentence the test above '
    + 'found in the source is a dead string',
  );
});

test('check-ask-numbering says in its OUTPUT that it never gates', () => {
  // The one that had it only in a comment. Named here rather than folded into
  // the loop above because the defect was specific to it and a general scan
  // cannot see "printed" without running each check.
  const out = execFileSync(process.execPath, [path.join(SCRIPTS, 'check-ask-numbering.ts')], {
    cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.match(out, DISCLAIMER);
  assert.match(out, WHAT_WOULD_GATE);
});
