// @basis TASK-measure-which-items-are-actually-delivered-before-anything
/**
 * `mycontext contribution` — the CLI surface over `core/contribution.ts`.
 *
 * The counting itself is tested in `test/core/contribution.test.ts` against
 * hand-built records; what is checked HERE is the wiring and the two output
 * shapes, and above all the EMPTY case. A report that prints nothing when it
 * has nothing to say is indistinguishable from a broken command, which is a
 * failure this project has already recorded once — so the empty run must still
 * draw the cohort table, with measured zeros in it, and say what it measured.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { recordAudit } from '../../src/core/audit.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';
import { cells } from '../helpers/table.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-contrib-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function item(cwd: string, id: string, origin: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'constraint', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    `---\nid: ${id}\ntype: constraint\ntitle: ${id}\nstatus: active\norigin: ${origin}\n---\n\n# ${id}\n\nBody.\n`,
    'utf8',
  );
}

test('an empty log still prints the cohort table and says what it measured', () => {
  const cwd = project();
  try {
    const { code, out } = run(['contribution'], cwd);
    assert.equal(code, 0);
    assert.match(out, /never delivered/i,
      'an empty log must still say what it measured, not print nothing');
    // The zeros are DRAWN. `cohorts` produces no row for an origin the corpus
    // does not carry, and `table` renders nothing at all for zero rows — so
    // without the synthetic rows this whole section would vanish silently.
    assert.match(out, cells('agent', '0', '0', '0', '0'),
      'the agent cohort is the load-bearing zero of this baseline and must be drawn');
    assert.match(out, cells('human', '0', '0', '0', '0'));
    assert.match(out, cells('ingest', '0', '0', '0', '0'));
    assert.match(out, /no injection records in this log yet/,
      'zero measurements is not a small measurement, and must be said in words');
  } finally { removeTree(cwd); }
});

test('a delivered item is counted, and one that never was is counted too', () => {
  const cwd = project();
  try {
    item(cwd, 'CONST-shipped', 'human');
    item(cwd, 'CONST-quiet', 'agent');
    recordAudit(resolveWorkspace(cwd).projectRoot!, {
      kind: 'injection', op: 'session-start',
      injected: [{ id: 'CONST-shipped', tier: 'pinned' }],
      spilled: [{ id: 'CONST-quiet', tier: 'jit', reason: 'budget' }],
    });
    const { code, out } = run(['contribution'], cwd);
    assert.equal(code, 0);
    assert.match(out, /1 injection record\(s\)/);
    assert.match(out, cells('human', '1', '0', '0', '1'));
    assert.match(out, cells('agent', '1', '1', '1', '0'),
      'the agent item was spilled every time it was chosen, and never delivered');
    assert.match(out, cells('CONST-quiet', 'agent', '0', '1'));
    assert.match(out, cells('CONST-shipped', 'human', '1', '0'));
  } finally { removeTree(cwd); }
});

test('--json carries the caveat and the purpose as data, not as prose a script cannot see', () => {
  const cwd = project();
  try {
    item(cwd, 'CONST-shipped', 'human');
    recordAudit(resolveWorkspace(cwd).projectRoot!, {
      kind: 'injection', op: 'jit', injected: [{ id: 'CONST-shipped', tier: 'jit' }],
    });
    const { code, out } = run(['contribution', '--json'], cwd);
    assert.equal(code, 0);
    const doc = JSON.parse(out) as {
      corpusItems: number; injectionRecords: number; caveat: string; purpose: string;
      cohorts: { origin: string; items: number }[];
      items: { id: string; delivered: number }[];
    };
    assert.equal(doc.corpusItems, 1);
    assert.equal(doc.injectionRecords, 1);
    assert.match(doc.caveat, /INJECTION, never reading or reliance/);
    assert.match(doc.purpose, /BASELINE/);
    assert.deepEqual(doc.cohorts.map((c) => c.origin), ['agent', 'human', 'ingest'],
      'every origin the corpus could have, so a script sees the zeros too');
    assert.equal(doc.items.find((i) => i.id === 'CONST-shipped')?.delivered, 1);
  } finally { removeTree(cwd); }
});

test('an unknown flag is refused rather than ignored', () => {
  const cwd = project();
  try {
    const { code, out } = run(['contribution', '--sessions', '5'], cwd);
    assert.equal(code, 1);
    assert.match(out, /unknown/);
  } finally { removeTree(cwd); }
});
