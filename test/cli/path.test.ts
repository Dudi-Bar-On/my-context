// @basis TASK-the-board-under-reports-what-has-shipped-and-the-path-to, REF-the-d-numbers-what-each-one-means-and-which-are-only, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **`mycontext path` — the reading, per subject.**
 *
 * The load-bearing assertions are the ones about the fourth column. Done,
 * ready and held are `ready`'s question asked one level up and they are
 * checked here only enough to prove the buckets add up. **YOURS** is the
 * category nothing could see before, and it is the difference between a list
 * and a path: a report that draws a decision waiting on the owner as ordinary
 * open work keeps offering him work he has already decided to defer.
 *
 * So there are two separate ways into that column and each is asserted alone —
 * a subject whose ROW reads `held-by-owner`, and an item an open QUESTION
 * names. A single test over a fixture carrying both would pass on an
 * implementation that had only ever implemented one.
 *
 * Everything else here is about the report refusing to be quietly wrong: a map
 * it cannot read is a REFUSAL and not an empty table, and a D number that is
 * not in the register is a refusal naming the register rather than a blank
 * page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { D_MAP_CLOSE, D_MAP_OPEN } from '../../src/core/needs.ts';
import { removeTree } from '../helpers/tmp.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  const lines: string[] = [];
  const code = runCli(args, cwd, (s) => lines.push(s));
  return { code, out: lines.join('\n') };
}

/** Wrapped prose collapsed to one line — see `todo.test.ts` for why. */
function prose(out: string): string {
  return out.replace(/\s+/g, ' ');
}

/**
 * Only `task` is declared, and that is deliberate: a config override EXTENDS
 * the shipped catalogue rather than replacing it, so `reference` and
 * `open_question` arrive with the tiers and fields they ship with. Writing
 * them out here would mean re-asserting a catalogue this test is not about,
 * and the first draft did exactly that and refused on a tier it had invented.
 */
const CATEGORIES = {
  categories: {
    task: {
      tier: 'rationale',
      prefix: 'TASK',
      description: 'A unit of planned work, tracked to completion.',
      extraFields: ['plan', 'seq', 'state', 'priority', 'needs'],
    },
  },
};
function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-path-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  writeFileSync(
    path.join(cwd, '.my_context', 'config.json'), JSON.stringify(CATEGORIES, null, 2) + '\n',
  );
  return cwd;
}

/**
 * An item written straight to disk, the way `test/cli/ready.test.ts` writes
 * its tasks and for the same reason: `mycontext add` cannot set an extra
 * field, and every field this report reads is one.
 */
function writeItem(
  cwd: string, type: string, id: string, title: string,
  extra: Record<string, string>, body = '',
): void {
  const dir = path.join(cwd, '.my_context', 'items', type);
  mkdirSync(dir, { recursive: true });
  const fields = Object.entries(extra).map(([k, v]) => `${k}: "${v}"`).join('\n');
  writeFileSync(path.join(dir, `${id}.md`), [
    '---', `id: ${id}`, `type: ${type}`, `title: ${title}`, 'status: active',
    'severity: soft', 'always: false', 'scope: []', 'tags: []', 'origin: human',
    ...(fields === '' ? [] : [fields]),
    '---', '', `# ${title}`, '', body, '',
  ].join('\n'), 'utf8');
}

const REGISTER = 'REF-the-planted-subject-map';

function writeMap(cwd: string, rows: string[]): void {
  writeItem(cwd, 'reference', REGISTER, 'the planted subject map', {}, [
    'The argument lives here. Nothing below the sentinel is prose.',
    '  D66   a failure the code never looks at   plan:swallow seq:1-12',
    '',
    D_MAP_OPEN,
    ...rows,
    D_MAP_CLOSE,
  ].join('\n'));
}

function reg(args: string[]): string[] {
  return [...args, '--register', REGISTER];
}

// ─── The reading itself ────────────────────────────────────────────────────

test('a subject reports done of total, and the buckets add up', () => {
  const cwd = project();
  try {
    writeItem(cwd, 'task', 'TASK-a', 'a', { plan: 'swallow', seq: '1', state: 'done', priority: '1' });
    writeItem(cwd, 'task', 'TASK-b', 'b', { plan: 'swallow', seq: '2', state: 'todo', priority: '1' });
    writeItem(cwd, 'task', 'TASK-c', 'c', {
      plan: 'swallow', seq: '3', state: 'blocked', priority: '1', needs: 'swallow/2',
    });
    writeMap(cwd, ['D66 | open | swallow/*']);

    const { code, out } = run(reg(['path', '--json']), cwd);
    assert.equal(code, 0);
    const parsed = JSON.parse(out) as {
      subjects: Array<{ d: string; done: number; total: number; ready: unknown[]; held: unknown[] }>;
    };
    const d66 = parsed.subjects.find((s) => s.d === '66')!;
    assert.equal(d66.done, 1);
    assert.equal(d66.total, 3);
    assert.equal(d66.ready.length, 1);
    assert.equal(d66.held.length, 1, 'the blocked task is not held, so its blocker is invisible');
    assert.equal(
      d66.done + d66.ready.length + d66.held.length, d66.total,
      'the buckets do not add up to the subject, so an item is drawn nowhere',
    );
  } finally {
    removeTree(cwd);
  }
});

test('nothing is stored: the report says so on every path, --summary included', () => {
  const cwd = project();
  try {
    writeItem(cwd, 'task', 'TASK-a', 'a', { plan: 'swallow', seq: '1', state: 'todo', priority: '1' });
    writeMap(cwd, ['D66 | open | swallow/*']);
    for (const level of ['--summary', '--short', '--full']) {
      const { code, out } = run(reg(['path', level]), cwd);
      assert.equal(code, 0, `${level} refused`);
      assert.match(
        prose(out), /derived on this run/,
        `${level} does not say the numbers are derived, so a reader cannot tell this from a `
        + 'progress file',
      );
      assert.match(prose(out), /100% here means every remaining step is either DISPATCHABLE or NAMED AS YOURS/);
    }
  } finally {
    removeTree(cwd);
  }
});

// ─── The fourth column, by each of its two routes ──────────────────────────

test('YOURS route 1: a subject whose row reads held-by-owner', () => {
  const cwd = project();
  try {
    writeItem(cwd, 'task', 'TASK-w', 'w', { plan: 'wcag', seq: '1', state: 'todo', priority: '1' });
    writeMap(cwd, ['D67 | held-by-owner | wcag/*']);

    const { code, out } = run(reg(['path']), cwd);
    assert.equal(code, 0);
    assert.match(prose(out), /WAITING ON YOU — 1 subject/);
    assert.match(prose(out), /D67 — the whole subject is held by your own ruling/);
  } finally {
    removeTree(cwd);
  }
});

test('YOURS route 2: an open question naming an item under the subject', () => {
  const cwd = project();
  try {
    writeItem(cwd, 'task', 'TASK-a', 'a', { plan: 'anchors', seq: '12', state: 'todo', priority: '1' });
    writeItem(
      cwd, 'open_question', 'OPENQ-which-mark-wins',
      'does the table mark or the lane-report mark win?', { blocks: 'anchors/12' },
    );
    writeMap(cwd, ['D78 | open | anchors/*']);

    const { code, out } = run(reg(['path']), cwd);
    assert.equal(code, 0);
    assert.match(prose(out), /WAITING ON YOU — 1 subject/);
    assert.match(prose(out), /D78 · anchors\/12 — does the table mark/);
    assert.match(prose(out), /OPENQ-which-mark-wins/);
  } finally {
    removeTree(cwd);
  }
});

/**
 * The control for both routes above, in the same shape: an identical corpus
 * with the question ANSWERED — which here means removed — draws no fourth
 * column at all. Without it, "the output mentions WAITING ON YOU" would pass
 * on a report that printed the heading unconditionally.
 */
test('and with no ruling and no question, nothing is waiting on anybody', () => {
  const cwd = project();
  try {
    writeItem(cwd, 'task', 'TASK-a', 'a', { plan: 'anchors', seq: '12', state: 'todo', priority: '1' });
    writeMap(cwd, ['D78 | open | anchors/*']);

    const { out } = run(reg(['path']), cwd);
    assert.doesNotMatch(prose(out), /WAITING ON YOU/);
  } finally {
    removeTree(cwd);
  }
});

/**
 * A question whose work has LANDED leaves the column with nobody editing
 * anything — the property that makes this derived rather than a status field.
 *
 * **BORROWED POWER, disclosed:** this is `core/questions.ts`'s guarantee and
 * not this command's. `questionReport` puts a question in `blocking` only for
 * references that are not all done, so the column empties upstream of anything
 * `path` does. A removal proof against `path` cannot redden this, and the
 * first draft carried a `state` filter here purely because nobody had checked.
 */
test('the column empties itself when the work the question names is done', () => {
  const cwd = project();
  try {
    writeItem(cwd, 'task', 'TASK-a', 'a', { plan: 'anchors', seq: '12', state: 'done', priority: '1' });
    writeItem(
      cwd, 'open_question', 'OPENQ-which-mark-wins', 'which mark wins?', { blocks: 'anchors/12' },
    );
    writeMap(cwd, ['D78 | open | anchors/*']);

    const { out } = run(reg(['path']), cwd);
    assert.doesNotMatch(prose(out), /WAITING ON YOU/);
  } finally {
    removeTree(cwd);
  }
});

// ─── Refusals: never a quietly empty table ─────────────────────────────────

test('a register with no block is a refusal, not an empty report', () => {
  const cwd = project();
  try {
    writeItem(cwd, 'task', 'TASK-a', 'a', { plan: 'swallow', seq: '1', state: 'todo', priority: '1' });
    writeItem(cwd, 'reference', REGISTER, 'the planted subject map', {}, 'prose and no block');

    const { code, out } = run(reg(['path']), cwd);
    assert.equal(code, 1);
    assert.match(prose(out), /carries no \[D-MAP\] block/);
    assert.match(prose(out), /check:board/, 'the refusal does not say what would diagnose it');
  } finally {
    removeTree(cwd);
  }
});

/**
 * **The exit code tells "this project keeps no map" apart from "the map you
 * named is not there", and almost every project is the first one.** The
 * register is THIS repository's own item; a consumer checkout has none, and
 * `mycontext path` erroring there would make the command look broken in every
 * project but one.
 */
test('no register at the DEFAULT id is exit 0 and says what a subject map is', () => {
  const cwd = project();
  try {
    writeItem(cwd, 'task', 'TASK-a', 'a', { plan: 'swallow', seq: '1', state: 'todo', priority: '1' });
    const { code, out } = run(['path'], cwd);
    assert.equal(code, 0, 'a project that keeps no subject map was reported as a failure');
    assert.match(prose(out), /\[D-MAP\] block/, 'it does not say what would give this project one');
    assert.match(prose(out), /This project keeps none/);
  } finally {
    removeTree(cwd);
  }
});

test('a register that does not exist is a refusal that names `ready` as the other answer', () => {
  const cwd = project();
  try {
    writeItem(cwd, 'task', 'TASK-a', 'a', { plan: 'swallow', seq: '1', state: 'todo', priority: '1' });
    const { code, out } = run(['path', '--register', 'REF-nothing-answers-to-this'], cwd);
    assert.equal(code, 1);
    assert.match(prose(out), /holds no item REF-nothing-answers-to-this/);
    assert.match(prose(out), /mycontext ready/);
  } finally {
    removeTree(cwd);
  }
});

test('--d with a number the register does not carry is refused by name', () => {
  const cwd = project();
  try {
    writeItem(cwd, 'task', 'TASK-a', 'a', { plan: 'swallow', seq: '1', state: 'todo', priority: '1' });
    writeMap(cwd, ['D66 | open | swallow/*']);

    const { code, out } = run(reg(['path', '--d', '99']), cwd);
    assert.equal(code, 1);
    assert.match(prose(out), /no subject D99/);
    // And the accepted spelling is the one the owner types.
    assert.equal(run(reg(['path', '--d', 'D66']), cwd).code, 0, '`--d D66` was refused');
    assert.equal(run(reg(['path', '--d', '66']), cwd).code, 0, '`--d 66` was refused');
  } finally {
    removeTree(cwd);
  }
});

test('an unknown flag is refused against THIS command\'s usage', () => {
  const cwd = project();
  try {
    writeMap(cwd, ['D66 | open | swallow/*']);
    const { code, out } = run(['path', '--nonsense'], cwd);
    assert.equal(code, 1);
    assert.match(out, /usage: mycontext path/);
  } finally {
    removeTree(cwd);
  }
});

// ─── The map's own defects are never hidden by the report ──────────────────

/**
 * A report that quietly drew wrong numbers over a broken map would be the
 * regex-over-prose defect wearing this command's clothes. It cannot fix the
 * map; it must say that some of what it printed is wrong.
 */
test('a broken row makes the report say its own numbers cannot be trusted', () => {
  const cwd = project();
  try {
    writeItem(cwd, 'task', 'TASK-a', 'a', { plan: 'swallow', seq: '1', state: 'todo', priority: '1' });
    writeMap(cwd, ['D66 | open | swallow/*', 'D67 open wcag/*']);

    const { code, out } = run(reg(['path']), cwd);
    assert.equal(code, 0, 'the report refused; it is a reading, and the gate is what refuses');
    assert.match(prose(out), /THE MAP ITSELF HAS 1 DEFECT/);
    assert.match(prose(out), /check:board/);

    const json = JSON.parse(run(reg(['path', '--json']), cwd).out) as { mapDefects: unknown[] };
    assert.equal(json.mapDefects.length, 1, 'a machine reader cannot see the defect at all');
  } finally {
    removeTree(cwd);
  }
});

test('open work no subject claims is counted rather than dropped', () => {
  const cwd = project();
  try {
    writeItem(cwd, 'task', 'TASK-a', 'a', { plan: 'swallow', seq: '1', state: 'todo', priority: '1' });
    writeItem(cwd, 'task', 'TASK-b', 'b', { plan: 'orphaned', seq: '1', state: 'todo', priority: '1' });
    writeMap(cwd, ['D66 | open | swallow/*']);

    const { out } = run(reg(['path']), cwd);
    assert.match(prose(out), /1 open work item\(s\) belong to no subject at all/);
  } finally {
    removeTree(cwd);
  }
});
