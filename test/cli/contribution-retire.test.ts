// @basis TASK-retire-on-evidence-and-bound-the-corpus
/**
 * `mycontext contribution --retire` — the surface over `core/retire.ts`.
 *
 * The gate itself is tested in `test/core/retire-gate.test.ts` against
 * hand-built evidence. What is checked HERE is the two things a surface can
 * get wrong that a pure function cannot:
 *
 *  1. **that it has no verb.** §13 says the owner promotes, always, and a
 *     retirement is a stand-down that reaches every future session. So the
 *     accepted flag set is asserted directly, and `--apply` is refused by
 *     name — a later builder adding one has to delete a test that says why.
 *  2. **that a refusal is PRINTED.** A phase whose honest answer is "the data
 *     does not support a threshold yet" fails if that answer is only in a
 *     report; it has to arrive on a surface somebody will run again.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { recordAudit } from '../../src/core/audit.ts';
import { COMMAND_FLAGS } from '../../src/core/command-flags.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';
import { row } from '../helpers/table.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-retire-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

/**
 * A sentence that may have been WRAPPED to the layout budget — every line this
 * report prints goes through `paragraph`, so matching a literal string would
 * assert where the wrap fell rather than what was said.
 */
function phrase(text: string): RegExp {
  return new RegExp(
    text.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'),
  );
}

test('the retirement surface carries no verb, and `--apply` is refused by name', () => {
  const cwd = project();
  try {
    const { code, out } = run(['contribution', '--retire', '--apply'], cwd);
    assert.equal(code, 1, 'a flag that would retire something must not be silently ignored');
    assert.match(out, /apply/, 'and the refusal names it');
    assert.deepEqual(
      COMMAND_FLAGS['contribution']!.allowed.filter(
        (f) => /apply|retire-now|delete|deprecate|yes|force/.test(f),
      ),
      [],
      'the owner promotes, always — a retirement reaches every future session, so this command '
      + 'accepts no flag that performs one',
    );
  } finally { removeTree(cwd); }
});

test('an empty corpus is refused a threshold, in numbers, and says nothing is proposed', () => {
  const cwd = project();
  try {
    const { code, out } = run(['contribution', '--retire'], cwd);
    assert.equal(code, 0, 'a refusal is a result, not a failure');
    assert.match(out, phrase('no retirement threshold may be derived'));
    assert.match(
      out, phrase('empty population'),
      'the first reason is the population, because a threshold over nothing is the one refusal '
      + 'that cannot be argued with',
    );
    assert.match(
      out, phrase('NOTHING is proposed for retirement, and that is a result rather than a gap'),
      'the honest outcome has to be stated, or a reader takes silence for "nothing found yet"',
    );
  } finally { removeTree(cwd); }
});

test('the machine form carries the verdict, the null rule and an empty candidate list', () => {
  const cwd = project();
  try {
    const { code, out } = run(['contribution', '--retire', '--json'], cwd);
    assert.equal(code, 0);
    const doc = JSON.parse(out) as {
      derivable: boolean; rule: unknown; candidates: unknown[]; because: string[];
      evidence: { population: number }; bound: { maxProposalsPerPass: number; doors: unknown[] };
      loadErrors: unknown[];
    };
    assert.equal(doc.derivable, false);
    assert.equal(
      doc.rule, null,
      'null is the ANSWER — a script must be able to read "this build has derived no threshold" '
      + 'rather than infer it from a missing key',
    );
    assert.deepEqual(doc.candidates, []);
    assert.ok(doc.because.length > 0, 'and every refusal travels in the machine form too');
    assert.equal(doc.evidence.population, 0);
    assert.equal(
      doc.bound.maxProposalsPerPass, 0,
      'the bound already in force is the ration, and it is reported as data rather than prose',
    );
    assert.deepEqual(doc.loadErrors, [], 'load errors travel INSIDE the document, never after it');
  } finally { removeTree(cwd); }
});

test('the report says what each door carried, because growth is not spill', () => {
  const cwd = project();
  try {
    const { out } = run(['contribution', '--retire'], cwd);
    assert.match(
      out, phrase('bounding the corpus'),
      'the second half of the phase is a measurement of growth, and it is printed beside the '
      + 'retirement verdict rather than filed somewhere else',
    );
    assert.match(out, phrase('a door that is not spilling can still be growing'));
    assert.match(
      out, phrase('maxProposalsPerPass` is 0'),
      'the only bound this build can defend is the one already in force, and it says so',
    );
    assert.match(
      out, phrase('no door has been measured at all'),
      'a table with no rows renders as nothing, so an unmeasured door has to be said in words — '
      + 'an empty log is the ABSENCE of a measurement, not a corpus that stopped growing',
    );
  } finally { removeTree(cwd); }
});

test('a door that carried something is measured, first day against last', () => {
  const cwd = project();
  try {
    const root = resolveWorkspace(cwd).projectRoot!;
    recordAudit(root, {
      kind: 'injection', op: 'subagent-start', at: '2026-08-26T10:00:00.000Z',
      injected: [{ id: 'A', tier: 'pinned' }],
    });
    recordAudit(root, {
      kind: 'injection', op: 'subagent-start', at: '2026-09-10T10:00:00.000Z',
      injected: [{ id: 'A', tier: 'pinned' }, { id: 'B', tier: 'pinned' }, { id: 'C', tier: 'jit' }],
    });
    const { out } = run(['contribution', '--retire'], cwd);
    assert.match(
      out, row('subagent-start', '2026-08-26', '1.0', '2026-09-10', '3.0', '0.0'),
      'one door, its first measured day and its last — the growth is the whole finding, and a '
      + 'mean rather than a total because the number of dispatches is not the payload',
    );
    assert.match(
      out, phrase('the log covers 15 day(s)'),
      'and the window is the distance between the two observations, not the count of them',
    );
  } finally { removeTree(cwd); }
});
