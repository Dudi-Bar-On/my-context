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
import { cells, row } from '../helpers/table.ts';

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

function item(
  cwd: string, id: string, origin: string,
  type: string = 'constraint', status: string = 'active',
): void {
  const file = path.join(cwd, '.my_context', 'items', type, `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    `---\nid: ${id}\ntype: ${type}\ntitle: ${id}\nstatus: ${status}\norigin: ${origin}\n---\n\n# ${id}\n\nBody.\n`,
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
    assert.match(out, row('agent', '0', '0', '0', '0', '0', '0'),
      'the agent cohort is the load-bearing zero of this baseline and must be drawn');
    assert.match(out, row('human', '0', '0', '0', '0', '0', '0'));
    assert.match(out, row('ingest', '0', '0', '0', '0', '0', '0'));
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
    assert.match(out, row('human', '1', '1', '0', '0', '1', '0'));
    assert.match(out, row('agent', '1', '1', '1', '1', '0', '0'),
      'the agent item was spilled every time it was chosen, and never delivered');
    // `per chance` sits between `delivered` and `spilled`: the item existed for the
    // one injection record the log holds, so 0-of-1 and 1-of-1 are its two ends.
    assert.match(out, cells('CONST-quiet', 'agent', '0', '0.00', '1'));
    assert.match(out, cells('CONST-shipped', 'human', '1', '1.00', '0'));
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
    // Sorted, and every member of `Origin` — including the ones this corpus
    // has none of — so a script reading the JSON sees the zeros rather than
    // inferring them from an absence. `'review'` joined the union in
    // `plan:loop seq:3` (the self-improvement pass), and it appears here for
    // exactly the reason the other three do: a cohort of zero is a measurement.
    assert.deepEqual(doc.cohorts.map((c) => c.origin), ['agent', 'human', 'ingest', 'review'],
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

/**
 * **The correction, end to end and against the REAL gate** — `isEligible` ∧
 * `isNormative` over this workspace's own `config.json`, not a fixture
 * predicate. `test/core/contribution.test.ts` proves the counting; what is
 * proved here is that the command asks the same question `select` asks.
 *
 * `select` never considers a `task`, so a task that has never been delivered
 * is not a finding — it is a category. Before the eligibility split the
 * default "least delivered" list was the bottom of the whole corpus, which on
 * the real corpus meant 918 by-construction zeros crowding out the twelve rows
 * a reader could act on: **the instrument could not rank its own finding into
 * view.** So the task must be counted in `items`, excluded from `injectable`,
 * absent from the default list, and still reachable at `--full`.
 */
test('an item select could never choose is counted, excluded, and still findable', () => {
  const cwd = project();
  try {
    item(cwd, 'CONST-shipped', 'human');
    item(cwd, 'TASK-not-a-candidate', 'human', 'task');
    recordAudit(resolveWorkspace(cwd).projectRoot!, {
      kind: 'injection', op: 'session-start',
      injected: [{ id: 'CONST-shipped', tier: 'pinned' }],
    });
    const { code, out } = run(['contribution'], cwd);
    assert.equal(code, 0);
    assert.match(out, row('human', '2', '1', '0', '0', '1', '0'),
      'two items, one of which select could choose — the task is in `items` and nowhere else');
    assert.match(out, /1 item\(s\) are NOT injectable/,
      'the exclusion is stated where the numbers are, not only in a report');
    assert.doesNotMatch(out, /TASK-not-a-candidate/,
      'a task in the least-delivered list is the defect: it crowds out the real finding');
    assert.match(out, /injectable and never delivered: NONE/,
      'a measured zero, drawn and named, with the record count beside it');

    const full = run(['contribution', '--full'], cwd);
    assert.equal(full.code, 0);
    assert.match(full.out, /TASK-not-a-candidate/,
      '`--full` still shows every item — dropping 918 rows silently would be a second way to lie');
    assert.match(full.out, /injectable\s+no/,
      'and says which side of the line each one is on');
  } finally { removeTree(cwd); }
});

/**
 * The corpus MOVES under the log. An item delivered and since stood down keeps
 * its delivery events on disk while leaving every measured population, so the
 * measured set can shrink for a reason that has nothing to do with delivery —
 * which a later reading compared against this one must be able to see.
 */
test('an item delivered and since superseded is reported as delivered-now-ineligible', () => {
  const cwd = project();
  try {
    item(cwd, 'CONST-was', 'human', 'constraint', 'superseded');
    recordAudit(resolveWorkspace(cwd).projectRoot!, {
      kind: 'injection', op: 'session-start',
      injected: [{ id: 'CONST-was', tier: 'pinned' }],
    });
    const { code, out } = run(['contribution', '--json'], cwd);
    assert.equal(code, 0);
    const doc = JSON.parse(out) as {
      injectableItems: number; ineligibleItems: number; deliveredNowIneligible: number;
      injectableNeverDelivered: string[];
      cohorts: { origin: string; deliveredNotInjectable: number }[];
    };
    assert.equal(doc.injectableItems, 0, 'nothing in this corpus can be delivered today');
    assert.equal(doc.ineligibleItems, 1);
    assert.equal(doc.deliveredNowIneligible, 1,
      'and yet the log delivered it once — that is the corpus moving, not a quiet item');
    assert.deepEqual(doc.injectableNeverDelivered, []);
    assert.equal(doc.cohorts.find((c) => c.origin === 'human')?.deliveredNotInjectable, 1);
  } finally { removeTree(cwd); }
});

/**
 * **A delivery is not a session, and the report must say which kind it counted.**
 *
 * `recordAudit` writes one injection record per DELIVERY — at session start,
 * at every subagent dispatch, on every JIT hook fire, on compaction restore.
 * On this repository's own corpus that was 54 session-starts against 1,082
 * subagent dispatches and 1,182 JIT fires, so a reader who took "delivered 641
 * times" as "641 sessions" would be out by more than an order of magnitude.
 * The breakdown is on both surfaces because the text reader and the script
 * comparing two readings need it equally.
 */
test('the report says which kind of delivery it counted, on both surfaces', () => {
  const cwd = project();
  try {
    item(cwd, 'CONST-shipped', 'human');
    const root = resolveWorkspace(cwd).projectRoot!;
    recordAudit(root, {
      kind: 'injection', op: 'session-start',
      injected: [{ id: 'CONST-shipped', tier: 'pinned' }],
    });
    for (const _ of [0, 1, 2]) {
      recordAudit(root, {
        kind: 'injection', op: 'subagent-start',
        injected: [{ id: 'CONST-shipped', tier: 'pinned' }],
      });
    }
    const { out } = run(['contribution'], cwd);
    assert.match(out, /3 subagent-start, 1 session-start/,
      'ordered by how many, so the dominant kind of delivery is read first');
    assert.match(out, /A record is one DELIVERY, not one session/);

    const doc = JSON.parse(run(['contribution', '--json'], cwd).out) as {
      injectionsByOp: Record<string, number>;
    };
    assert.deepEqual(doc.injectionsByOp, { 'subagent-start': 3, 'session-start': 1 });
  } finally { removeTree(cwd); }
});
