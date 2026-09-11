// @basis TASK-ready-schedules-work-and-never-surfaces-a-decision-so-every, INV-nothing-is-dropped-silently
/**
 * `mycontext ready` — **the open questions that stand between the reader and
 * open work**, beside the held tasks it already counts.
 *
 * ── WHAT THESE TESTS ARE FOR ───────────────────────────────────────────────
 *
 * The task this file rests on measured one defect: `ready` lists ready tasks
 * and names what holds every held one, and it NEVER listed open questions —
 * so a decision awaiting the owner sat in the corpus with nothing putting it
 * in front of him, and every decision that reached him reached him because an
 * assistant remembered to ask across a compaction.
 *
 * Two rulings are pinned here, because both are the kind that a later change
 * would undo without noticing:
 *
 *  - **`a question is counted, never dropped`** is `INV-nothing-is-dropped-
 *    silently` applied to this report. Only the questions whose `blocks`
 *    resolves to open work are LISTED; every other active question is counted
 *    and named by reason. A surface that listed the resolvable ones and said
 *    nothing about the rest would be precise about the wrong corpus — the same
 *    failure the held-row disclosure already exists to prevent.
 *  - **`a question is not drawn as a task`** is the task's own words. A
 *    question has no `seq`, nothing depends on its completion, and it is
 *    finished by an ANSWER. So it must not move the task counts, and this file
 *    asserts that against the counts themselves rather than against a sentence.
 *
 * ── AND ONE THAT IS ABOUT A SURFACE THIS FILE DOES NOT TOUCH ───────────────
 *
 * `a draft question is the review queue's business` pins the boundary the
 * whole design rests on. `reviewQueue` (core/select.ts) is `status === 'draft'
 * && layer === 'project'` and is the ONE definition five surfaces read. An
 * ACTIVE question is not a draft, so it could only have entered that queue
 * behind a second predicate — which `cli/commands/todo.ts` already refused,
 * for this project's most-repeated defect. The test asserts the split holds in
 * both directions rather than trusting the prose.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { OUTPUT_WIDTH } from '../../src/cli/commands/format.ts';
import { removeTree } from '../helpers/tmp.ts';

/** This repository, for the one test that runs against the corpus itself. */
const REPO = path.resolve(import.meta.dirname, '..', '..');

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
 * A project declaring both halves of what this report reads: a category that
 * plans work (`plan`/`seq`/`state`) and one that asks a question (`blocks`).
 *
 * Both are spelled out rather than inherited, for `ready.test.ts`'s reason: a
 * report keyed on the NAME `task` would pass here and fail in a project that
 * calls the same idea something else, and the question half has exactly the
 * same hazard.
 */
const CONFIG = {
  categories: {
    task: {
      tier: 'rationale',
      prefix: 'TASK',
      description: 'A unit of planned work, tracked to completion.',
      extraFields: ['plan', 'seq', 'state', 'priority', 'needs'],
    },
    open_question: {
      tier: 'normative',
      prefix: 'OPENQ',
      description: 'Deliberately undecided; the agent must not decide it alone.',
      extraFields: ['blocks'],
    },
  },
};

function project(config: unknown = CONFIG): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-readyq-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  if (config !== null) {
    writeFileSync(
      path.join(cwd, '.my_context', 'config.json'), JSON.stringify(config, null, 2) + '\n',
    );
  }
  return cwd;
}

/** An item written straight to disk — `mycontext add` cannot set an extra
 * field, so the corpus this feature is for is authored as files. */
function writeItem(
  cwd: string, type: string, id: string, extra: Record<string, string>,
  title = `${type} ${id}`, status = 'active',
): void {
  const dir = path.join(cwd, '.my_context', 'items', type);
  mkdirSync(dir, { recursive: true });
  const fields = Object.entries(extra).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
  writeFileSync(path.join(dir, `${id}.md`), [
    '---',
    `id: ${id}`,
    `type: ${type}`,
    `title: ${JSON.stringify(title)}`,
    `status: ${status}`,
    'severity: soft',
    'always: false',
    'scope: []',
    'tags: []',
    'origin: human',
    fields,
    '---',
    '',
    `# ${title}`,
    '',
  ].join('\n'), 'utf8');
}

const task = (cwd: string, id: string, extra: Record<string, string>): void =>
  writeItem(cwd, 'task', id, extra);

// --- The defect itself -------------------------------------------------------

test('a question whose `blocks` names open work is listed by ready', () => {
  const cwd = project();
  try {
    task(cwd, 'TASK-live-22', { plan: 'live', seq: '22', state: 'todo', priority: '1' });
    writeItem(cwd, 'open_question', 'OPENQ-credential', { blocks: 'live/22' },
      'should the credential survive a reload');

    const { code, out } = run(['ready'], cwd);
    assert.equal(code, 0);
    // The decision is on the surface somebody goes to for "what now" — which
    // is the whole of the defect this rests on.
    assert.match(out, /OPENQ-credential/);
    assert.match(prose(out), /should the credential survive a reload/);
    // A table of its own, headed `question` — not `task`, `pri` and `state`.
    // The ruling is that a question must not be DRAWN as a task, and the
    // headers are the line that carries it.
    assert.match(out, /\|\s*question\s*\|\s*blocks\s*\|\s*title\s*\|/);
  } finally {
    removeTree(cwd);
  }
});

test('a question is answered, not worked: it moves no task count and gets no seq', () => {
  const cwd = project();
  try {
    task(cwd, 'TASK-live-22', { plan: 'live', seq: '22', state: 'todo', priority: '1' });
    const before = run(['ready'], cwd);
    assert.equal(before.code, 0);
    assert.match(prose(before.out), /1 ready of 1 open task\(s\)/);

    writeItem(cwd, 'open_question', 'OPENQ-credential', { blocks: 'live/22' });
    const after = run(['ready'], cwd);
    assert.equal(after.code, 0);
    // Same corpus of WORK. A question that moved this number would be being
    // scheduled, which is exactly what it must not be.
    assert.match(prose(after.out), /1 ready of 1 open task\(s\)/);

    // …and it is in neither array of WORK. Asserted against the arrays rather
    // than against the rendered row: an earlier spelling of this pinned the
    // absence with a regex over the table, and that regex could not fail — a
    // piped table never produces the run of spaces it required, whatever the
    // columns were. Proved and replaced rather than trusted.
    const parsed = JSON.parse(run(['ready', '--json'], cwd).out) as {
      ready: { id: string }[]; held: { id: string }[]; open: number;
    };
    assert.equal(parsed.open, 1);
    assert.deepEqual([...parsed.ready, ...parsed.held].map((r) => r.id), ['TASK-live-22']);
  } finally {
    removeTree(cwd);
  }
});

// --- Nothing is dropped ------------------------------------------------------

test('a question that names nothing it blocks is counted and named, never dropped', () => {
  const cwd = project();
  try {
    task(cwd, 'TASK-live-22', { plan: 'live', seq: '22', state: 'todo', priority: '1' });
    writeItem(cwd, 'open_question', 'OPENQ-sketches', {},
      'do the sketches get resynced when the mockup changes');

    const { code, out } = run(['ready'], cwd);
    assert.equal(code, 0);
    // Hidden is fine; unmentioned is not.
    assert.doesNotMatch(out, /OPENQ-sketches/);
    assert.match(prose(out), /1 active open question\(s\) not listed above/);
    assert.match(prose(out), /naming nothing it blocks/);
  } finally {
    removeTree(cwd);
  }
});

test('a question whose `blocks` is prose is counted under a reason of its own', () => {
  const cwd = project();
  try {
    task(cwd, 'TASK-live-22', { plan: 'live', seq: '22', state: 'todo', priority: '1' });
    writeItem(cwd, 'open_question', 'OPENQ-prose', {
      blocks: 'the Procedures step table and `pr.md`’s claim about itself',
    });

    const { code, out } = run(['ready'], cwd);
    assert.equal(code, 0);
    assert.doesNotMatch(out, /OPENQ-prose/);
    assert.match(prose(out), /naming what it blocks in prose this report cannot resolve/);
  } finally {
    removeTree(cwd);
  }
});

test("a question naming its work as `plan:x seq:y` in a sentence is read, not filed as prose", () => {
  const cwd = project();
  try {
    task(cwd, 'TASK-walk-89', { plan: 'walk', seq: '89', state: 'todo', priority: '1' });
    writeItem(cwd, 'open_question', 'OPENQ-import', {
      blocks: 'the import-buckets card on Export / import, and the size of plan:walk seq:89',
    });

    const { code, out } = run(['ready', '--json'], cwd);
    assert.equal(code, 0);
    const parsed = JSON.parse(out) as {
      questions: { blocking: { id: string; pending: string[]; unparsed: string[] }[] };
    };
    assert.deepEqual(parsed.questions.blocking.map((q) => q.id), ['OPENQ-import']);
    assert.deepEqual(parsed.questions.blocking[0]?.pending, ['walk/89']);
    // The half that really is unreadable is still reported; the half this
    // product just acted on is not called unreadable.
    assert.deepEqual(parsed.questions.blocking[0]?.unparsed,
      ['the import-buckets card on Export / import']);
  } finally {
    removeTree(cwd);
  }
});

test('a question whose work has landed stops being listed, with no edit to the question', () => {
  const cwd = project();
  try {
    task(cwd, 'TASK-live-22', { plan: 'live', seq: '22', state: 'done', priority: '1' });
    writeItem(cwd, 'open_question', 'OPENQ-credential', { blocks: 'live/22' });

    const { code, out } = run(['ready'], cwd);
    assert.equal(code, 0);
    // The question is untouched; only the work moved. A filter that merely
    // asked "is `blocks` non-empty" would still be listing this forever.
    assert.doesNotMatch(out, /^OPENQ-credential/m);
    assert.match(prose(out), /naming work that is already done/);
  } finally {
    removeTree(cwd);
  }
});

test('a question naming work this corpus does not have is counted, not listed', () => {
  const cwd = project();
  try {
    task(cwd, 'TASK-live-22', { plan: 'live', seq: '22', state: 'todo', priority: '1' });
    writeItem(cwd, 'open_question', 'OPENQ-typo', { blocks: 'live/999' });

    const { code, out } = run(['ready'], cwd);
    assert.equal(code, 0);
    assert.doesNotMatch(out, /^OPENQ-typo/m);
    assert.match(prose(out), /naming work this corpus does not have/);
  } finally {
    removeTree(cwd);
  }
});

// --- Reachability and every-path disclosure ---------------------------------

test('--questions lists every active question with its reason', () => {
  const cwd = project();
  try {
    task(cwd, 'TASK-live-22', { plan: 'live', seq: '22', state: 'todo', priority: '1' });
    writeItem(cwd, 'open_question', 'OPENQ-credential', { blocks: 'live/22' });
    writeItem(cwd, 'open_question', 'OPENQ-sketches', {});

    const { code, out } = run(['ready', '--questions'], cwd);
    assert.equal(code, 0);
    assert.match(out, /OPENQ-credential/);
    // The quiet one is reachable, which is what stops this being a second
    // unsurfaced fact.
    assert.match(out, /OPENQ-sketches/);
    // Every row says why it is where it is — the one table in this report that
    // lists listed and counted rows side by side.
    assert.match(out, /^\s+why\s+naming open work$/m);
    assert.match(out, /^\s+why\s+naming nothing it blocks$/m);
  } finally {
    removeTree(cwd);
  }
});

/**
 * The stanza form is a MEASUREMENT, not a preference, so it is pinned by the
 * measurement rather than by its shape: a quiet row's `blocks` is the raw
 * field, and as a table beside a 66-character id and a long title this ran to
 * 1,095 columns on the real corpus — `list --full`'s 280-column defect, on the
 * one level that exists to show the most.
 *
 * Caught by a removal proof, not by design: the first version of this file
 * chose `records` for the right measured reason and asserted nothing about it,
 * so the choice could have been reverted with every test still green.
 */
test('--questions stays inside the layout budget when `blocks` is a long sentence', () => {
  const cwd = project();
  try {
    task(cwd, 'TASK-live-22', { plan: 'live', seq: '22', state: 'todo', priority: '1' });
    // An id as long as this corpus's own — 63 characters is what `records`
    // was written for, and a short fixture id is exactly what would let the
    // table form look fine here and blow out in the field.
    writeItem(cwd, 'open_question',
      'OPENQ-a-question-whose-blocks-is-a-whole-sentence-of-prose-about', {
        blocks: 'the Procedures step table, the import-buckets card on Export / import, and ' +
          "`pr.md`'s claim that a procedure cannot ever disagree with its own recorded steps",
      }, 'a question whose blocks is a whole sentence of prose about several different screens');

    const { out } = run(['ready', '--questions'], cwd);
    assert.match(out, /OPENQ-a-question-whose-blocks/);
    // The long field is a wrapped, labelled line — not a table cell.
    assert.match(out, /^\s+blocks\s+the Procedures step table,/m);
    const widest = Math.max(...out.split('\n').map((l) => l.length));
    assert.ok(widest <= OUTPUT_WIDTH,
      `no line may exceed the ${OUTPUT_WIDTH}-column budget; widest was ${widest}`);
  } finally {
    removeTree(cwd);
  }
});

test('the question count is disclosed at --summary, which prints no rows at all', () => {
  const cwd = project();
  try {
    task(cwd, 'TASK-live-22', { plan: 'live', seq: '22', state: 'todo', priority: '1' });
    writeItem(cwd, 'open_question', 'OPENQ-credential', { blocks: 'live/22' });

    const { code, out } = run(['ready', '--summary'], cwd);
    assert.equal(code, 0);
    assert.match(prose(out), /1 open question\(s\) stand between this list and open work/);
  } finally {
    removeTree(cwd);
  }
});

test('--json and the text answer from one split, so the two cannot disagree', () => {
  const cwd = project();
  try {
    task(cwd, 'TASK-live-22', { plan: 'live', seq: '22', state: 'todo', priority: '1' });
    writeItem(cwd, 'open_question', 'OPENQ-credential', { blocks: 'live/22' });
    writeItem(cwd, 'open_question', 'OPENQ-sketches', {});

    const { code, out } = run(['ready', '--json'], cwd);
    assert.equal(code, 0);
    const parsed = JSON.parse(out) as {
      questions: {
        blocking: { id: string; blocks: string | null; reason: string }[];
        quiet: { id: string; reason: string }[];
      };
    };
    assert.deepEqual(parsed.questions.blocking.map((q) => q.id), ['OPENQ-credential']);
    assert.equal(parsed.questions.blocking[0]?.reason, 'blocking');
    assert.deepEqual(parsed.questions.quiet.map((q) => q.id), ['OPENQ-sketches']);
    assert.equal(parsed.questions.quiet[0]?.reason, 'unstated');
  } finally {
    removeTree(cwd);
  }
});

test('--plan narrows the questions through the work they name, and counts what it narrowed away', () => {
  const cwd = project();
  try {
    task(cwd, 'TASK-live-22', { plan: 'live', seq: '22', state: 'todo', priority: '1' });
    task(cwd, 'TASK-walk-89', { plan: 'walk', seq: '89', state: 'todo', priority: '1' });
    writeItem(cwd, 'open_question', 'OPENQ-credential', { blocks: 'live/22' });
    writeItem(cwd, 'open_question', 'OPENQ-import', { blocks: 'walk/89' });
    writeItem(cwd, 'open_question', 'OPENQ-sketches', {});

    const { code, out } = run(['ready', '--plan', 'live'], cwd);
    assert.equal(code, 0);
    assert.match(out, /OPENQ-credential/);
    assert.doesNotMatch(out, /OPENQ-import/);
    // Both of the narrowed-away questions are counted: the one blocking
    // another plan's work AND the one blocking nothing. Counting only the
    // second left the first mentioned nowhere — found by reading this
    // command's own output against this corpus, not by a test.
    assert.match(prose(out), /2 further open question\(s\) are not counted above/);
  } finally {
    removeTree(cwd);
  }
});

// --- The boundary with the review queue -------------------------------------

test('a retired question is in no count: it was settled, and its `blocks` is history', () => {
  const cwd = project();
  try {
    task(cwd, 'TASK-live-22', { plan: 'live', seq: '22', state: 'todo', priority: '1' });
    writeItem(cwd, 'open_question', 'OPENQ-gone', { blocks: 'live/22' },
      'a question already settled', 'deprecated');

    const { code, out } = run(['ready'], cwd);
    assert.equal(code, 0);
    assert.doesNotMatch(out, /OPENQ-gone/);
    assert.doesNotMatch(prose(out), /open question\(s\) stand between/);
    assert.doesNotMatch(prose(out), /active open question\(s\) not listed above/);
  } finally {
    removeTree(cwd);
  }
});

test("a draft question is the review queue's business and is in neither of ready's counts", () => {
  const cwd = project();
  try {
    task(cwd, 'TASK-live-22', { plan: 'live', seq: '22', state: 'todo', priority: '1' });
    writeItem(cwd, 'open_question', 'OPENQ-unpromoted', { blocks: 'live/22' },
      'a question nobody has agreed to hold yet', 'draft');

    const readyOut = run(['ready'], cwd);
    assert.equal(readyOut.code, 0);
    // Not `ready`'s: what it awaits is a PROMOTION, not an answer.
    assert.doesNotMatch(readyOut.out, /OPENQ-unpromoted/);
    assert.doesNotMatch(prose(readyOut.out), /open question\(s\) stand between/);

    // And the review queue still holds it — the definition is untouched, so the
    // draft half of an `open_question` reaches a person exactly as before.
    const review = run(['review'], cwd);
    assert.equal(review.code, 0);
    assert.match(review.out, /OPENQ-unpromoted/);
  } finally {
    removeTree(cwd);
  }
});

// --- Dogfood: against this repository's own corpus ---------------------------

test("ready accounts for every one of this corpus's own active questions", () => {
  const { code, out } = run(['ready', '--json'], REPO);
  assert.equal(code, 0);
  const parsed = JSON.parse(out) as {
    questions: {
      blocking: { id: string; blocks: string | null; reason: string }[];
      quiet: { id: string; reason: string }[];
    };
  };
  const seen = [...parsed.questions.blocking, ...parsed.questions.quiet].map((q) => q.id);

  // Every active `open_question` this corpus holds is in exactly one of the
  // two lists. Counted against `search`, not against a number typed here: a
  // hand-kept expectation is the defect this whole item is filed under.
  const listed = run(['search', '--type', 'open_question', '--status', 'active', '--json'], REPO);
  assert.equal(listed.code, 0);
  const active = (JSON.parse(listed.out) as { items: { id: string }[] }).items.map((i) => i.id);
  assert.ok(active.length > 0, 'this corpus must hold active open questions for this to mean anything');
  assert.deepEqual(seen.toSorted(), active.toSorted());

  // `live/22` LANDED after the task was filed, so the question that named it
  // is `landed` rather than `blocking` — with nobody having edited it. That is
  // the property the whole design turns on: a filter reading "is `blocks`
  // non-empty" would still be listing this one forever.
  const credential = parsed.questions.quiet.find(
    (q) => q.id === 'OPENQ-should-the-credential-survive-a-reload-and-by-which-of-four');
  assert.equal(credential?.reason, 'landed');
});

test("ready surfaces this corpus's question that stands in front of open work", () => {
  const { code, out } = run(['ready', '--json'], REPO);
  assert.equal(code, 0);
  const parsed = JSON.parse(out) as {
    questions: { blocking: { id: string; pending: string[] }[] };
  };
  // Its `blocks` names `plan:walk seq:89` inside a sentence, and `walk/89` is
  // still open. Before this surface existed the only thing carrying that fact
  // was an assistant remembering to say so.
  const row = parsed.questions.blocking.find(
    (q) => q.id === 'OPENQ-does-export-import-ever-import-or-is-a-third-of-that-screen');
  assert.ok(row, 'expected the Export / import question on the blocking list, got ' +
    JSON.stringify(parsed.questions.blocking.map((q) => q.id)));
  assert.deepEqual(row.pending, ['walk/89']);
});
