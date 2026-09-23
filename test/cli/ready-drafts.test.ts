// @basis TASK-mycontext-ready-counts-a-review-draft-as-open-work-so-the
/**
 * **A review draft is not open work, and `mycontext ready` is where that has
 * to be true.**
 *
 * Measured 2026-09-22 during release phase 3: the review pass proposed ten
 * task drafts from the dispatching session's own prompts, and `ready --json`
 * reported `open: 146` where the board held 136 — the ten were listed among
 * the READY rows, with `plan: null`, so the board moved because a machine had
 * an idea. A draft is indexed, searchable and shown; it governs nothing, is
 * never injected, and nobody can dispatch it until a person promotes it
 * through `mycontext review promote`, which is where it gains its `plan` and
 * `seq`.
 *
 * So the draft is EXCLUDED from ready, from held and from `open` — and
 * COUNTED in one line, because `INV-nothing-is-dropped-silently` makes the
 * exclusion something the reader is told about rather than something they
 * discover when the numbers stop adding up.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
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

const TASK_CATEGORY = {
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
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-ready-draft-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  writeFileSync(
    path.join(cwd, '.my_context', 'config.json'), JSON.stringify(TASK_CATEGORY, null, 2) + '\n',
  );
  return cwd;
}

/**
 * A task file, written where the caller says and with the status the caller
 * says.
 *
 * `dir` is the whole point: `items/task/` is the COMMITTED corpus and
 * `.drafts/task/` is where the review pass writes a proposal (`core/drafts.ts`
 * · `DRAFT_DIR`). `loadLayer` walks both, so the two differ in exactly the two
 * facts this file is about — where the file sits and what its `status` says.
 */
function writeTask(
  cwd: string, dir: string, status: string, id: string, extra: Record<string, string>,
): void {
  const target = path.join(cwd, '.my_context', ...dir.split('/'), 'task');
  mkdirSync(target, { recursive: true });
  const fields = Object.entries(extra).map(([k, v]) => `${k}: "${v}"`).join('\n');
  writeFileSync(path.join(target, `${id}.md`), [
    '---',
    `id: ${id}`,
    'type: task',
    `title: task ${id}`,
    `status: ${status}`,
    'severity: soft',
    'always: false',
    'scope: []',
    'tags: []',
    'origin: human',
    fields,
    '---',
    '',
    `# task ${id}`,
    '',
  ].join('\n'), 'utf8');
}

test('a review draft is not ready work, is not open work, and is counted in one line', () => {
  const cwd = project();
  try {
    writeTask(cwd, 'items', 'active', 'TASK-walk-7', { plan: 'walk', seq: '7', state: 'todo', priority: '1' });
    // The shape the review pass writes: no plan, no seq, status draft, under
    // `.drafts/`. Everything about it says "somebody proposed this".
    writeTask(cwd, '.drafts', 'draft', 'TASK-a-proposal-nobody-approved', { state: 'todo' });

    const { code, out } = run(['ready'], cwd);
    assert.equal(code, 0);
    assert.match(out, /walk\/7/, 'the real task is still ready');
    assert.doesNotMatch(out, /TASK-a-proposal-nobody-approved/,
      'THE DEFECT: a proposal nobody has read is offered as work somebody can start');
    assert.match(prose(out), /1 open task\(s\)|1 ready of 1 open/,
      `the open count is the real corpus, not the corpus plus a machine's ideas:\n${out}`);
    assert.match(prose(out), /1 draft/,
      `and the draft is COUNTED, not dropped — INV-nothing-is-dropped-silently:\n${out}`);
    assert.match(prose(out), /mycontext review list/,
      'naming the surface that owns them, so the count is actionable');
  } finally {
    removeTree(cwd);
  }
});

test('ready --json excludes drafts from ready, held and open, and reports them as their own count', () => {
  const cwd = project();
  try {
    writeTask(cwd, 'items', 'active', 'TASK-walk-7', { plan: 'walk', seq: '7', state: 'todo', priority: '1' });
    writeTask(cwd, 'items', 'active', 'TASK-walk-8', {
      plan: 'walk', seq: '8', state: 'todo', priority: '1', needs: 'walk/7',
    });
    writeTask(cwd, '.drafts', 'draft', 'TASK-a-proposal-nobody-approved', { state: 'todo' });
    // A draft that would be HELD if it were counted at all: it names a task
    // that has not landed. Held is the other half of `open`, and an exclusion
    // that only covered `ready` would move the board just as silently.
    writeTask(cwd, '.drafts', 'draft', 'TASK-a-proposal-that-waits', {
      state: 'todo', needs: 'walk/7',
    });

    const { code, out } = run(['ready', '--json'], cwd);
    assert.equal(code, 0);
    const json = JSON.parse(out) as {
      ready: { id: string }[]; held: { id: string }[];
      open: number; readyTotal: number; heldTotal: number; drafts: number;
    };
    assert.deepEqual(json.ready.map((r) => r.id), ['TASK-walk-7']);
    assert.deepEqual(json.held.map((r) => r.id), ['TASK-walk-8']);
    assert.equal(json.open, 2, 'open is the two real tasks — 146 against a board of 136 is this number wrong');
    assert.equal(json.readyTotal, 1);
    assert.equal(json.heldTotal, 1);
    assert.equal(json.drafts, 2, 'and the two proposals are named as what they are');
  } finally {
    removeTree(cwd);
  }
});

test('ready --held does not list a draft among the held, and still counts it', () => {
  const cwd = project();
  try {
    writeTask(cwd, 'items', 'active', 'TASK-walk-7', { plan: 'walk', seq: '7', state: 'todo', priority: '1' });
    writeTask(cwd, '.drafts', 'draft', 'TASK-a-proposal-that-waits', {
      state: 'todo', needs: 'walk/7',
    });

    const { code, out } = run(['ready', '--held'], cwd);
    assert.equal(code, 0);
    assert.doesNotMatch(out, /TASK-a-proposal-that-waits/,
      'a draft waiting on a real task is still a proposal, not held work');
    assert.match(prose(out), /1 draft/);
  } finally {
    removeTree(cwd);
  }
});

/**
 * **`--summary` is the path a board reads**, and the item's measurement was
 * taken from a count rather than from a list — so the count is asserted on the
 * path that prints nothing else.
 */
test('the draft count survives --summary, where only counts are printed', () => {
  const cwd = project();
  try {
    writeTask(cwd, 'items', 'active', 'TASK-walk-7', { plan: 'walk', seq: '7', state: 'todo', priority: '1' });
    writeTask(cwd, '.drafts', 'draft', 'TASK-a-proposal-nobody-approved', { state: 'todo' });

    const { code, out } = run(['ready', '--summary'], cwd);
    assert.equal(code, 0);
    assert.match(prose(out), /1 open task\(s\)/);
    assert.match(prose(out), /1 draft/);
  } finally {
    removeTree(cwd);
  }
});

/**
 * **A measured zero is drawn and named** (`STD-a-measured-zero-is-drawn-and-named`)
 * — but a line about drafts on a corpus that has never proposed one would be
 * noise on every run of every project. The zero this standard is about is the
 * one somebody might mistake for a missing measurement, and "no drafts" is not
 * that: `ready` states its own scope in the closing paragraph it always
 * prints. Asserted so the absence is a decision, not a drift.
 */
test('a corpus with no drafts says nothing about drafts', () => {
  const cwd = project();
  try {
    writeTask(cwd, 'items', 'active', 'TASK-walk-7', { plan: 'walk', seq: '7', state: 'todo', priority: '1' });
    const { code, out } = run(['ready'], cwd);
    assert.equal(code, 0);
    assert.doesNotMatch(prose(out), /draft/);
  } finally {
    removeTree(cwd);
  }
});
