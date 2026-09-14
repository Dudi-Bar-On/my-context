// @basis TASK-seven-gates-cannot-be-shown-to-go-red-and-one-of-them-has-no, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **`scripts/check-needs-cycles.ts`, proved by planting the cycle it must name.**
 *
 * This was the one gate in the project with no evidence behind it at all —
 * `reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md` (G6) counted six
 * checkers with a test proving them and named this as the exception. Its own
 * header argues that a cycle is invisible to `ready`, to `doctor` and to every
 * other reader of `needs:`, which is exactly why nothing else would notice if
 * the walk stopped finding one.
 *
 * ── THE SHAPE, WHICH IS THE HOUSE PATTERN AND NOT AN INVENTION ──────────────
 *
 * `test/scripts/cited-items.test.ts` and `test/scripts/vendor-gate.test.ts`
 * both do three things, in this order, and so does this file:
 *
 *  1. **Anti-vacuity against the REAL tree first.** A `buildGraph` whose key
 *     extraction silently stopped matching would walk an empty graph over a
 *     corpus of real items and print *"no cycle: every needs chain in this
 *     corpus terminates"* — true, and worthless. So the real corpus is walked
 *     and its graph is required to be non-trivial before any acyclicity claim
 *     is made about it. The floor is derived on every run and never a pinned
 *     total.
 *  2. **A planted violation, end to end.** A throwaway workspace with two
 *     tasks that need each other; the SCRIPT is spawned against it and must
 *     exit 1 naming both members. The same workspace with one edge removed
 *     must exit 0. Both directions, on the real executable, because an exit
 *     code is the only thing CI reads.
 *  3. **The vacuous-pass floor.** A real workspace holding no work items must
 *     exit 1, not 0 — the guard `main()` argues for at length and which
 *     nothing proved.
 *
 * Read-only against this repository's own `.my_context/`; every write is to a
 * `mkdtemp` directory removed in a `finally`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildGraph, describe as describeCycle, findCycles,
} from '../../scripts/check-needs-cycles.ts';
import { runCli } from '../../src/cli/index.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { loadLayer } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'check-needs-cycles.ts');

const CONFIG = resolveConfig({
  categories: {
    task: {
      tier: 'rationale',
      prefix: 'TASK',
      description: 'A unit of planned work, tracked to completion.',
      extraFields: ['plan', 'seq', 'state', 'needs'],
    },
  },
});

let n = 0;
/** One task fixture. `extra` carries `plan`, `seq`, `state` and `needs`. */
function task(extra: Record<string, string>): Item {
  n++;
  return {
    id: `TASK-${extra.plan ?? 'p'}-${extra.seq ?? String(n)}-${n}`,
    type: 'task', title: `T${n}`, status: 'active', severity: 'soft', always: false,
    continuity: false, summary: null, summaryOf: null, summaryWas: [], acknowledged: {},
    scope: [], tags: [], origin: 'human', sourceFile: null, sourceAnchor: null,
    sourceChecksum: null, validFrom: null, validUntil: null, checksum: 'x', extra,
    body: '', steps: [], observations: [], relations: [],
    layer: 'project', filePath: `items/task/TASK-${n}.md`,
  };
}

/** `plan/seq` keys of every cycle the walk closed, sorted for comparison. */
function cycleKeys(items: Item[]): string[][] {
  return findCycles(buildGraph(items, CONFIG)).map((c) => [...c].sort()).sort();
}

/* ── 1. Anti-vacuity: the walk over the REAL corpus is not empty ───────────── */

test('buildGraph over this repository own corpus walks a non-trivial graph', () => {
  // Without this every acyclicity claim below — and the gate's own green run
  // in CI — could be an empty graph reporting success.
  const ws = resolveWorkspace(REPO);
  assert.notEqual(ws.projectRoot, null, 'this repository has no workspace, so nothing below reads it');
  const items = loadLayer(ws.projectRoot!, 'project', [], ws.config);
  assert.ok(items.length > 0, 'loadLayer returned no items at all — the corpus was not read');

  const graph = buildGraph(items, ws.config);
  assert.ok(graph.size > 0, 'the graph has no plan/seq nodes: taskKey matched nothing in a real corpus');
  const edges = [...graph.values()].reduce((sum, node) => sum + node.out.length, 0);
  assert.ok(
    edges > 0,
    'the graph has nodes but no edges, so findCycles could not find a cycle if one existed — '
    + 'either `needs:` stopped being parsed or every reference now reads as dangling',
  );
});

/* ── 2. The detector, proved in both directions on the same fixture ────────── */

test('two tasks that need each other are reported as a cycle', () => {
  assert.deepEqual(
    cycleKeys([
      task({ plan: 'a', seq: '1', state: 'todo', needs: 'a/2' }),
      task({ plan: 'a', seq: '2', state: 'todo', needs: 'a/1' }),
    ]),
    [['a/1', 'a/2']],
  );
});

test('the SAME fixture with one edge removed reports no cycle', () => {
  // The green direction against the identical pair, so the power of the test
  // above is in the edge and not in the fixture.
  assert.deepEqual(
    cycleKeys([
      task({ plan: 'a', seq: '1', state: 'todo', needs: 'a/2' }),
      task({ plan: 'a', seq: '2', state: 'todo' }),
    ]),
    [],
  );
});

test('a task that needs itself is a cycle, and a lone task that needs nothing is not', () => {
  assert.deepEqual(cycleKeys([task({ plan: 'b', seq: '1', needs: 'b/1' })]), [['b/1']]);
  assert.deepEqual(cycleKeys([task({ plan: 'b', seq: '1' })]), []);
});

test('a three-node loop is found, and the same three as a chain is not', () => {
  const loop = [
    task({ plan: 'c', seq: '1', needs: 'c/2' }),
    task({ plan: 'c', seq: '2', needs: 'c/3' }),
    task({ plan: 'c', seq: '3', needs: 'c/1' }),
  ];
  assert.deepEqual(cycleKeys(loop), [['c/1', 'c/2', 'c/3']]);

  const chain = [
    task({ plan: 'c', seq: '1', needs: 'c/2' }),
    task({ plan: 'c', seq: '2', needs: 'c/3' }),
    task({ plan: 'c', seq: '3' }),
  ];
  assert.deepEqual(cycleKeys(chain), []);
});

test('a reference nothing answers to is counted as dangling and never walked', () => {
  const items = [task({ plan: 'd', seq: '1', needs: 'd/99' })];
  const graph = buildGraph(items, CONFIG);
  assert.deepEqual(graph.get('d/1')!.out, [], 'a dangling reference must not become an edge');
  assert.deepEqual(graph.get('d/1')!.dangling, ['d/99']);
  assert.deepEqual(cycleKeys(items), [], 'a dangling reference cannot close a loop');
});

test('a cycle running through DONE work is still reported', () => {
  // `main()`'s header commits to this in as many words: a scan that dropped
  // finished tasks would go quiet the moment one member landed, reporting the
  // defect as fixed when nothing about the edges changed.
  assert.deepEqual(
    cycleKeys([
      task({ plan: 'e', seq: '1', state: 'done', needs: 'e/2' }),
      task({ plan: 'e', seq: '2', state: 'todo', needs: 'e/1' }),
    ]),
    [['e/1', 'e/2']],
  );
});

test('two cycles that share no node are reported separately, not merged', () => {
  assert.deepEqual(
    cycleKeys([
      task({ plan: 'f', seq: '1', needs: 'f/2' }),
      task({ plan: 'f', seq: '2', needs: 'f/1' }),
      task({ plan: 'g', seq: '1', needs: 'g/2' }),
      task({ plan: 'g', seq: '2', needs: 'g/1' }),
    ]),
    [['f/1', 'f/2'], ['g/1', 'g/2']],
  );
});

test('describe names every member of a cycle with its state and its item id', () => {
  // The report is the whole deliverable — the check deliberately does not
  // break the cycle — so a cycle reported without its members is a finding the
  // reader cannot act on.
  const items = [
    task({ plan: 'h', seq: '1', state: 'todo', needs: 'h/2' }),
    task({ plan: 'h', seq: '2', state: 'blocked', needs: 'h/1' }),
  ];
  const graph = buildGraph(items, CONFIG);
  const cycle = describeCycle(graph, ['h/1', 'h/2']);
  assert.equal(cycle.members.length, 2);
  assert.match(cycle.members[0]!, /^h\/1 {2}\[todo] {2}TASK-h-1-/);
  assert.match(cycle.members[1]!, /^h\/2 {2}\[blocked] {2}TASK-h-2-/);
});

/* ── 3. The executable: the exit code CI actually reads ────────────────────── */

/** A throwaway workspace holding the tasks `specs` describes. */
function workspace(specs: { title: string; plan: string; seq: string; needs?: string }[]): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-cycles-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0, 'init failed, so the fixture is not a workspace');
  for (const spec of specs) {
    const argv = [
      'add', '--summary-omitted', 'task', spec.title,
      '--extra', `plan=${spec.plan}`, '--extra', `seq=${spec.seq}`, '--extra', 'state=todo',
    ];
    if (spec.needs !== undefined) argv.push('--extra', `needs=${spec.needs}`);
    argv.push('--yes');
    assert.equal(runCli(argv, cwd, () => {}), 0, `add failed for ${spec.title}`);
  }
  return cwd;
}

/** The script, spawned against `cwd`. Returns its exit code and its output. */
function run(cwd: string): { code: number; out: string } {
  try {
    return { code: 0, out: execFileSync(process.execPath, [SCRIPT], { cwd, encoding: 'utf8' }) };
  } catch (e) {
    const err = e as { status?: number; stdout?: string };
    return { code: err.status ?? -1, out: err.stdout ?? '' };
  }
}

test('the script exits 1 on a planted cycle and 0 once the edge is removed', () => {
  const red = workspace([
    { title: 'Alpha', plan: 'probe', seq: '1', needs: 'probe/2' },
    { title: 'Beta', plan: 'probe', seq: '2', needs: 'probe/1' },
  ]);
  try {
    const r = run(red);
    assert.equal(r.code, 1, `a corpus with a cycle must exit 1. Output:\n${r.out}`);
    assert.match(r.out, /CYCLE {2}probe\/1 -> probe\/2 -> probe\/1/);
    assert.match(r.out, /TASK-alpha/);
    assert.match(r.out, /TASK-beta/);
  } finally { removeTree(red); }

  // The SAME two tasks, one edge short. Anything that made the red run above
  // pass for a reason other than the edge — a crashed spawn, an unreadable
  // corpus — would report red here too.
  const green = workspace([
    { title: 'Alpha', plan: 'probe', seq: '1', needs: 'probe/2' },
    { title: 'Beta', plan: 'probe', seq: '2' },
  ]);
  try {
    const g = run(green);
    assert.equal(g.code, 0, `an acyclic corpus must exit 0. Output:\n${g.out}`);
    assert.match(g.out, /no cycle/);
  } finally { removeTree(green); }
});

test('a workspace with no work items exits 1 — nothing checked is not nothing wrong', () => {
  // The guard `main()` argues for: a real workspace can hold zero tasks, and
  // walking an empty graph prints "every needs chain terminates", which is
  // true and worthless. Nothing proved this until now.
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-cycles-empty-'));
  try {
    assert.equal(runCli(['init'], cwd, () => {}), 0);
    const r = run(cwd);
    assert.equal(
      r.code, 1,
      `an empty corpus must not read as a clean bill of health. Output:\n${r.out}`,
    );
    assert.match(r.out, /nothing was checked, which is not the same as nothing being wrong/);
  } finally { removeTree(cwd); }
});

/* ── THE GUARD THAT KEEPS THIS FILE IN THE RUN IS CHECKED SOMEWHERE ELSE ─────
 *
 * `scripts/check-needs-cycles.ts` ends in `if (isMain()) process.exit(main())`.
 * Measured while proving this file: with the `if (isMain())` removed, the
 * top-level exit fires during THIS file's import, the repository's corpus is
 * acyclic so the code is 0, and Node's runner reports `tests 1 · pass 1 ·
 * fail 0` — eleven cases silently gone and the suite GREEN.
 *
 * So the guard cannot be asserted here: no assertion in this file survives its
 * removal. It is asserted in `test/scripts/workflow-gates.test.ts`, which
 * imports no script and therefore still runs, as a rule over every script a
 * test imports rather than over this one.
 */
