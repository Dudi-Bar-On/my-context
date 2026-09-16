// @basis TASK-the-board-under-reports-what-has-shipped-and-the-path-to, TASK-five-gates-are-wired-to-nothing-one-of-them-exits-1-today, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **The board gate, proved by planting the thing it is supposed to find.**
 *
 * The rule this file exists under: *beware a proof whose FIXTURE carried its
 * power*. A gate tested only against clean inputs proves that nothing went
 * wrong, which is what every one of the seven gates in `gates/3` could already
 * demonstrate on the day they were found unable to go red. So every tier here
 * is driven with a real, commit-shaped input that SHOULD be reported, and the
 * assertion is that it IS.
 *
 * Three separate things are checked and they fail for different reasons on
 * purpose:
 *
 *   1. **`gateLines` turns a broken map into named lines** — unit level, over
 *      planted rows.
 *   2. **`drift` reports a commit that named an open item** — unit level, over
 *      planted commits shaped exactly as `git log` yields them, INCLUDING the
 *      three cases it must stay quiet about.
 *   3. **THE REAL SCRIPT GOES RED END TO END** on a planted workspace whose
 *      register carries a broken row — process spawned, exit code read. That
 *      is the one that proves the wiring in `ci.yml` buys anything, because a
 *      workflow runs the process and not the function.
 *
 * `test/scripts/workflow-gates.test.ts` proves the step EXISTS. This proves the
 * step can fail. Neither is worth much without the other.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_COMMITS, drift, gateLines, isOpen, readCommits, recordsOn, type Commit,
} from '../../scripts/check-board.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { dBoard, parseDMap, D_MAP_CLOSE, D_MAP_OPEN, workItems } from '../../src/core/needs.ts';
import type { Item } from '../../src/core/types.ts';
import { sandbox } from '../helpers/workspace.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'check-board.ts');

const CONFIG = resolveConfig({
  categories: {
    task: {
      tier: 'rationale',
      prefix: 'TASK',
      description: 'A unit of planned work, tracked to completion.',
      extraFields: ['plan', 'seq', 'state', 'priority', 'needs'],
    },
  },
});

function task(plan: string, seq: string, state: string, body = ''): Item {
  return {
    id: `TASK-${plan}-${seq}`, type: 'task', title: `${plan}/${seq}`, status: 'active',
    severity: 'soft', always: false, summary: '', summaryOf: null, scope: [], tags: [],
    origin: 'human', sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: '2026-09-16', validUntil: null, checksum: '0', body, relations: [],
    extra: { plan, seq, state },
  } as unknown as Item;
}

function commit(over: Partial<Commit> & { text: string }): Commit {
  return {
    full: 'a'.repeat(40), sha: 'aaaaaaaa', date: '2026-09-16',
    subject: over.text.split('\n')[0]!, didWork: true, ...over,
  };
}

/** The script reads git from the REPO, never from the workspace it is given. */
function run(args: string[], cwd: string): { code: number; out: string } {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, ...args], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32e6,
    });
    return { code: 0, out };
  } catch (err) {
    const e = err as { status?: number; stdout?: string };
    return { code: e.status ?? -1, out: String(e.stdout ?? '') };
  }
}

// ─── 0. Anti-vacuity: the reader can see anything at all ───────────────────

/**
 * First, because everything below it is worthless otherwise. A window that
 * silently came back empty would report no drift and read exactly like a clean
 * tree — the vacuous pass this repository has now caught in six other shapes.
 */
test('the commit window is actually read, and carries subjects and file lists', () => {
  const commits = readCommits(REPO, 20);
  assert.ok(commits.length > 0, 'git returned no commits, so every drift assertion below is vacuous');
  assert.ok(commits.every((c) => c.full.length === 40), 'a commit came back with no sha');
  assert.ok(commits.every((c) => c.subject !== ''), 'a commit came back with no subject');
  assert.ok(
    commits.some((c) => c.didWork),
    'not one commit in the window changed anything outside reports/ and .my_context/, which '
    + 'cannot be true of this repository — the file scan is broken, not the history',
  );
  assert.ok(DEFAULT_COMMITS > 0);
});

// ─── 1. The map tier turns a break into a NAMED line ───────────────────────

const BROKEN = [
  D_MAP_OPEN,
  'D66 | open | swallow/*',
  'D67 open wcag/*',
  'D68 | open | nosuchplan/*',
  'D69 | open | swallow/1',
  D_MAP_CLOSE,
].join('\n');

test('every kind of break becomes a line naming the row', () => {
  const reading = parseDMap(BROKEN);
  const board = dBoard(reading, [task('swallow', '1', 'todo'), task('wcag', '1', 'todo')], CONFIG);
  const lines = gateLines(reading, board, 'REF-planted').join('\n');

  assert.match(lines, /UNPARSED .*line 3/, 'the unparsed row is not named with its line');
  assert.match(lines, /D67 open wcag\/\*/, 'the unparsed row\'s TEXT is not printed');
  assert.match(lines, /DANGLING D68.*nosuchplan/s, 'the member naming nothing is not named');
  assert.match(lines, /TWO SUBJECTS swallow\/1 is claimed by D66 and D69/, 'the double claim is not named');
});

/**
 * The control, in the same run: the SAME reader over a clean map says nothing.
 * Without it, an assertion that "the findings mention D67" would pass just as
 * happily on a checker that printed every row it saw.
 */
test('and a clean map produces no lines at all', () => {
  const clean = [D_MAP_OPEN, 'D66 | open | swallow/*', D_MAP_CLOSE].join('\n');
  const reading = parseDMap(clean);
  const board = dBoard(reading, [task('swallow', '1', 'todo')], CONFIG);
  assert.deepEqual(gateLines(reading, board, 'REF-planted'), []);
});

// ─── 2. The drift tier, driven with planted commits ────────────────────────

const ITEMS = [
  task('readmodel', '1', 'todo'),
  task('readmodel', '2', 'todo', 'NAMED-BUT-OPEN aebc76f0 — out of that lane\'s scope'),
  task('readmodel', '3', 'done'),
];
/** A directory git knows nothing about, so `creationOf` answers null for every
 * item and no finding can be excused as a filing. That is the strict setting,
 * which is the right one for a planted red. */
const NO_GIT = path.join(import.meta.dirname, 'no-such-project-root');

test('THE PLANTED RED: a commit that named an open item is reported as drift', () => {
  const findings = drift(NO_GIT, NO_GIT, ITEMS, [
    commit({ text: 'the cold call was a tokenizer run: readmodel/1 and readmodel/3' }),
  ], CONFIG);
  const drifted = findings.filter((f) => f.verdict === 'drift').map((f) => f.key);
  assert.deepEqual(
    drifted, ['readmodel/1'],
    'the detector did not report an item a commit named while it was still open, which is the '
    + 'entire finding this check was written for',
  );
});

/**
 * The three silences, each asserted in its own right — because a detector that
 * reported everything would satisfy the test above and be switched off within
 * a day. On the first real run 15 of 26 findings were one of these.
 */
test('a DONE item named by the same commit is silent', () => {
  const findings = drift(NO_GIT, NO_GIT, ITEMS, [
    commit({ text: 'readmodel/3 landed' }),
  ], CONFIG);
  assert.deepEqual(findings.map((f) => f.key), [], 'finished work was reported as drift');
});

test('a commit that changed nothing outside reports/ and .my_context/ is BOOKKEEPING', () => {
  const findings = drift(NO_GIT, NO_GIT, ITEMS, [
    commit({ text: 'handover: readmodel/1 is live', didWork: false }),
  ], CONFIG);
  assert.deepEqual(findings.map((f) => f.verdict), ['bookkeeping']);
});

test('an item carrying NAMED-BUT-OPEN for that commit is RECORDED, with its reason', () => {
  const findings = drift(NO_GIT, NO_GIT, ITEMS, [
    commit({ full: 'aebc76f0'.padEnd(40, '0'), text: 'readmodel/2 measured, not changed' }),
  ], CONFIG);
  assert.deepEqual(findings.map((f) => f.verdict), ['recorded']);
  assert.match(findings[0]!.reason!, /out of that lane's scope/);
});

/**
 * The record's EXPIRY, which is the property that makes it an acknowledgement
 * rather than a permanent silence. It names one commit; a different commit
 * naming the same item reports again.
 */
test('a SECOND commit naming the same item is drift again, record or no record', () => {
  const findings = drift(NO_GIT, NO_GIT, ITEMS, [
    commit({ full: 'b'.repeat(40), sha: 'bbbbbbbb', text: 'readmodel/2, again' }),
    commit({ full: 'aebc76f0'.padEnd(40, '0'), text: 'readmodel/2 measured, not changed' }),
  ], CONFIG);
  assert.deepEqual(findings.map((f) => f.verdict), ['drift']);
  assert.match(
    findings[0]!.reason!, /out of that lane's scope/,
    'the standing record is not printed on the drift row, so the reader is told less than the '
    + 'item already says',
  );
});

/**
 * **A path fragment in a message is not a finding.** Every commit message here
 * is full of `src/ui/2`-shaped text, and `word/number` is exactly what an
 * address looks like.
 *
 * **BORROWED POWER, disclosed rather than claimed:** the `plans.has(plan)`
 * guard in `drift` is a PREFILTER and a removal proof could not redden this
 * assertion without it. What actually carries the property is the lookup — an
 * address nothing in the corpus answers to yields no item and therefore no
 * finding. The guard saves the lookup and states the intent; it is not what
 * makes this true, and saying so here stops the next reader trusting it to be.
 */
test('a path fragment in a message is not read as a lane address', () => {
  const findings = drift(NO_GIT, NO_GIT, ITEMS, [
    commit({ text: 'moved src/ui/2 files and touched docs/3 — see readmodel/1' }),
  ], CONFIG);
  assert.deepEqual(
    findings.map((f) => f.key), ['readmodel/1'],
    'a path fragment was read as a lane address, or the real address was missed',
  );
});

/**
 * The second "nothing was checked" exit, and it needs its own case: the one
 * below reaches the MISSING-ITEM branch, and a register that exists while
 * carrying no block is a different failure with a different repair. Without
 * this, deleting the block check left every assertion in this file green.
 */
test('a register that exists and carries NO block is exit 1, not an empty map', () => {
  const box = sandbox();
  try {
    const add = execFileSync(process.execPath, [
      path.join(REPO, 'src', 'cli', 'index.ts'), 'add', 'reference', 'a map with no block',
      '--body', 'Prose, and no sentinel anywhere in it.',
      '--summary', 'A throwaway reference with no subject map in it, so the board check can be '
        + 'watched refusing to read one.',
      '--yes',
    ], { cwd: box.cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const id = /(REF-[a-z0-9-]+)/.exec(add)![1]!;
    execFileSync(process.execPath, [
      path.join(REPO, 'src', 'cli', 'index.ts'), 'add', 'task', 'a planted swallow item',
      '--summary', 'A throwaway task so the planted workspace holds work to be counted.',
      '--extra', 'plan=swallow', '--extra', 'seq=1', '--extra', 'state=todo', '--yes',
    ], { cwd: box.cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

    const blocked = run(['--register', id], box.cwd);
    assert.equal(blocked.code, 1, `a register with no block did not fail the run:\n${blocked.out}`);
    assert.match(blocked.out, /carries no \[D-MAP\] block/);
    assert.match(blocked.out, /nothing was checked/);
  } finally {
    box.dispose();
  }
});

test('recordsOn reads every NAMED-BUT-OPEN line an item carries', () => {
  const two = task('x', '1', 'todo', [
    'NAMED-BUT-OPEN aebc76f0 — the client half is in another lane',
    '',
    'NAMED-BUT-OPEN 16125ddc — the same verdict one commit earlier',
  ].join('\n'));
  assert.deepEqual([...recordsOn(two).keys()], ['aebc76f0', '16125ddc']);
});

test('isOpen refuses done, deprecated and superseded alike', () => {
  const [done] = workItems([task('a', '1', 'done')], CONFIG);
  const [live] = workItems([task('a', '2', 'todo')], CONFIG);
  const cancelled = { ...task('a', '3', 'todo'), status: 'deprecated' } as Item;
  const [dep] = workItems([cancelled], CONFIG);
  assert.equal(isOpen(done!), false);
  assert.equal(isOpen(live!), true);
  assert.equal(isOpen(dep!), false, 'a cancelled task was offered as open work');
});

// ─── 3. THE REAL SCRIPT, AS A PROCESS ──────────────────────────────────────

/**
 * The end-to-end red, and it is the assertion that makes the `ci.yml` step
 * worth having: a workflow runs a PROCESS and reads an EXIT CODE, and nothing
 * above this line exercises either.
 *
 * The register is planted in a throwaway workspace rather than by mutating the
 * checked-in one — the shape `fc0b57da` and the anchor-store collision both
 * paid for. `--register` exists for exactly this.
 */
test('the real script EXITS 1 on a planted broken row, and names it', () => {
  const box = sandbox();
  try {
    const body = [
      'Planted for `test/scripts/board-check.test.ts`.',
      '',
      D_MAP_OPEN,
      'D66 | open | swallow/*',
      'D67 open wcag/*',
      D_MAP_CLOSE,
    ].join('\n');
    const add = execFileSync(process.execPath, [
      path.join(REPO, 'src', 'cli', 'index.ts'), 'add', 'reference', 'the planted subject map',
      '--body', body,
      '--summary', 'A throwaway copy of the subject map, planted so the board check can be '
        + 'watched going red on a row that does not parse.',
      '--yes',
    ], { cwd: box.cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const id = /(REF-[a-z0-9-]+)/.exec(add)![1]!;

    // A work item, so the "nothing was checked" guard is not what answers.
    execFileSync(process.execPath, [
      path.join(REPO, 'src', 'cli', 'index.ts'), 'add', 'task', 'a planted swallow item',
      '--summary', 'A throwaway task so the planted workspace holds work to be counted.',
      '--extra', 'plan=swallow', '--extra', 'seq=1', '--extra', 'state=todo', '--yes',
    ], { cwd: box.cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

    const red = run(['--register', id], box.cwd);
    assert.equal(red.code, 1, `the planted broken row did not fail the run:\n${red.out}`);
    assert.match(red.out, /UNPARSED/, 'it failed without naming what was wrong');
    assert.match(red.out, /D67 open wcag\/\*/, 'it failed without printing the offending row');
  } finally {
    box.dispose();
  }
});

/**
 * The pair, in the same run: the SAME process over THIS repository's real
 * register exits 0 and prints a report. Without it, the red above would be
 * consistent with a script that cannot exit 0 at all.
 */
test('and over the real register it exits 0 and reports both tiers', () => {
  const green = run([], REPO);
  assert.equal(green.code, 0, `the board check is red on this tree:\n${green.out}`);
  assert.match(green.out, /THE D MAP — \d+ rows/);
  assert.match(green.out, /NAMED BY A COMMIT AND STILL OPEN/);
  assert.match(
    green.out, /REPORTED, never gated/,
    'the drift tier does not tell its reader it never gates, so its output is indistinguishable '
    + 'from a gate that happened to be green',
  );
  assert.match(green.out, /what would make it a gate/i);
});

test('"nothing was checked" is an exit 1 and says so in those words', () => {
  const box = sandbox();
  try {
    const empty = run(['--register', 'REF-no-such-item-anywhere'], box.cwd);
    assert.equal(empty.code, 1);
    assert.match(empty.out, /nothing was checked/);
  } finally {
    box.dispose();
  }
});

test('the real register carries a block, so the gate is pointed at something', () => {
  // The shipped register, read as a file rather than through the index: if the
  // block is ever deleted the gate exits 1 and CI says so, but this says WHICH
  // file lost it.
  const file = path.join(
    REPO, '.my_context', 'items', 'reference',
    'REF-the-d-numbers-what-each-one-means-and-which-are-only.md',
  );
  const text = readFileSync(file, 'utf8');
  assert.ok(text.includes(D_MAP_OPEN), `${file} no longer carries a [D-MAP] block`);
  const reading = parseDMap(text);
  assert.ok(reading.rows.length > 50, `only ${reading.rows.length} rows parsed out of the register`);
  assert.deepEqual(reading.defects, []);
});
