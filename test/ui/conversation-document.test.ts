// @basis TASK-the-transcript-is-one-document-you-scroll-not-fifty-records,
// TASK-a-subagent-is-opened-from-the-turn-that-dispatched-it-and,
// TASK-the-viewer-renders-what-the-terminal-showed-with-its,
// TASK-a-conversation-is-rendered-as-a-document-who-spoke-when-and,
// TASK-the-open-document-follows-the-session-as-it-is-written-and,
// TASK-a-tool-call-keeps-160-characters-of-its-input-and-drops-the,
// INV-nothing-is-dropped-silently
/**
 * The transcript read as ONE DOCUMENT — `plan:archive seq:7`, `seq:8`, `seq:13`.
 *
 * **The one claim this file exists to make, and the only one a comment cannot
 * make instead: the document ACCOUNTS FOR EVERY RECORD.**
 *
 * A viewer that folds 27,813 records into 4,916 nodes is a viewer that could
 * be quietly dropping twenty thousand of them, and nobody reading the screen
 * would know. So the outline's nodes are asserted to TILE the record space:
 * node `k`'s `first + span` is node `k+1`'s `first`, the first begins at 0, and
 * the spans sum to the record count. That is
 * `INV-nothing-is-dropped-silently` turned into arithmetic rather than into a
 * promise, and it is checked on a fixture AND on the shape the owner's own
 * transcript has.
 *
 * The second claim is the one that makes a virtualised scroll possible at all:
 * **a seek lands where the outline said it would**, across a non-ASCII record.
 * The offsets are BYTE offsets; if they were ever computed from a decoded
 * string every offset after the first Hebrew record would be wrong, and wrong
 * silently — a wrong offset lands mid-record and reports `unreadable` rather
 * than throwing. This project's corpus is half Hebrew, so that is not a
 * hypothetical, and `a seek across a non-ASCII record lands on the record the
 * outline named` is the assertion that would catch it.
 *
 * What is NOT here: the drawing. `render()` needs a real document and this
 * project carries no browser dependency for `node --test` — the limit every
 * screen test in this directory states. The screen was driven in Playwright in
 * both languages before this file was written, and `e2e/conversations.spec.ts`
 * holds it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  DOCUMENT_WALK_CAP, WORK_RUN_CAP, buildOutline, readNodes,
  apiConversationOutline, apiConversationNodes, apiConversationTip,
  type DocOutlineBody, type DocOutlineNode, type DocStep, type DocTipBody,
} from '../../src/ui/read-model-conversation-document.ts';
import { iterateTranscript, projectDirName, rebuildConversations } from '../../src/core/conversation-index.ts';
import { registeredRoutes } from '../../src/ui/routes.ts';
import { registerReadRoutes } from '../../src/ui/server.ts';
import { Store } from '../../src/core/store.ts';
import type { Workspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO = path.join(import.meta.dirname, '..', '..');

const text = (t: string): unknown[] => [{ type: 'text', text: t }];
const toolUse = (name: string, input: unknown): unknown[] => [{ type: 'tool_use', name, input }];
const toolResult = (content: string, isError = false): unknown[] =>
  [{ type: 'tool_result', content, is_error: isError }];

interface Box {
  ws: Workspace;
  dir: string;
  cwd: string;
  file: (session: string) => string;
  write: (session: string, lines: unknown[]) => void;
  writeRaw: (session: string, body: string) => void;
  scan: () => void;
  dispose: () => void;
}

function box(): Box {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-convdoc-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-convdoc-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const dbPath = path.join(cwd, 'index.db');
  Store.open(dbPath).close();
  process.env['CLAUDE_CONFIG_DIR'] = home;
  mkdirSync(path.join(cwd, '.my_context'), { recursive: true });
  const ws = { projectRoot: path.join(cwd, '.my_context'), dbPath } as unknown as Workspace;
  const file = (session: string): string => path.join(dir, `${session}.jsonl`);
  return {
    ws,
    dir,
    cwd,
    file,
    write: (session, lines) => {
      writeFileSync(file(session), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
    },
    writeRaw: (session, body) => { writeFileSync(file(session), body); },
    scan: () => { rebuildConversations(dbPath, process.env, cwd); },
    dispose: () => {
      delete process.env['CLAUDE_CONFIG_DIR'];
      removeTree(home);
      removeTree(cwd);
    },
  };
}

/**
 * A session with every shape the document has to place: words on both sides,
 * a tool call and its result, book-keeping records carrying no `message` at
 * all, a line that will not parse, and — the one that matters most for the
 * offsets — Hebrew, early, so every byte offset after it is past a multi-byte
 * character.
 */
const SESSION: unknown[] = [
  { type: 'user', message: { role: 'user', content: 'build the archive viewer' }, timestamp: '2026-09-08T09:00:00.000Z', gitBranch: 'master' },
  { type: 'ai-title', aiTitle: 'The conversation archive' },
  { type: 'assistant', message: { role: 'assistant', content: text('קודם כול אקרא את המפרט — **one** document.') }, timestamp: '2026-09-08T09:00:01.000Z' },
  { type: 'attachment', attachment: { type: 'total_tokens_reminder' } },
  { type: 'assistant', message: { role: 'assistant', content: toolUse('Bash', { command: 'git status', description: 'Show working tree status' }) }, timestamp: '2026-09-08T09:00:02.000Z' },
  { type: 'user', message: { role: 'user', content: toolResult('nothing to commit, working tree clean') }, timestamp: '2026-09-08T09:00:03.000Z' },
  { type: 'queue-operation', operation: 'drain' },
  { type: 'assistant', message: { role: 'assistant', content: toolUse('Read', { file_path: '/tmp/spec.md' }) }, timestamp: '2026-09-08T09:00:04.000Z' },
  { type: 'user', message: { role: 'user', content: toolResult('no such file', true) }, timestamp: '2026-09-08T09:00:05.000Z' },
  { type: 'user', message: { role: 'user', content: '<task-notification>\n<task-id>abc</task-id>\n</task-notification>' }, timestamp: '2026-09-08T09:00:06.000Z' },
  { type: 'assistant', message: { role: 'assistant', content: text('Done — the index rebuilds from disk.') }, timestamp: '2026-09-08T09:00:07.000Z' },
];

/* ══ THE ARITHMETIC: NOTHING IS DROPPED ════════════════════════════════════ */

test('the outline tiles the record space exactly — every record is inside a node', () => {
  const b = box();
  try {
    b.write('sess-doc', SESSION);
    const out = buildOutline(b.file('sess-doc'));

    assert.equal(out.records, SESSION.length, 'every line is a record');
    assert.equal(out.nodes.length, out.said + out.work, 'a node is `said` or `work`, never a third thing');

    let at = 0;
    for (let i = 0; i < out.nodes.length; i += 1) {
      const node = out.nodes[i]!;
      assert.equal(node.n, i, `node ${i} carries its own position`);
      assert.equal(node.f, at, `node ${i} begins where node ${i - 1} ended — no gap, no overlap`);
      assert.ok(node.s > 0, `node ${i} covers at least one record`);
      at += node.s;
    }
    assert.equal(at, out.records,
      'the spans SUM to the record count. A viewer that folds 27,813 records into 4,916 '
      + 'nodes could quietly drop twenty thousand of them and no reader would know; this '
      + 'sum is what makes that impossible rather than merely unlikely.');
  } finally { b.dispose(); }
});

test('a said node is one turn and a work node is a RUN — the fold that makes it readable', () => {
  const b = box();
  try {
    b.write('sess-doc', SESSION);
    const out = buildOutline(b.file('sess-doc'));

    const said = out.nodes.filter((n) => n.k === 'said');
    // Four turns carried words: the prompt, the Hebrew answer, the task
    // notification (person-side text `classifyTurn` counts as a prompt), and
    // the closing answer.
    assert.equal(said.length, 4, 'one node per turn somebody took');
    for (const node of said) assert.equal(node.s, 1, 'a said node is never a run');

    assert.deepEqual(said.map((n) => n.w), ['you', 'claude', 'you', 'claude'],
      'the speaker is read off the turn, in document order');

    // THE FOLD. Seven records carried no words — an `ai-title`, an
    // `attachment`, a `queue-operation`, two tool calls and two tool results —
    // and they became TWO folded runs rather than seven rows: the `ai-title`
    // alone between the prompt and the answer, then the six that run together.
    // A fold per record is not a fold; it is the same list with smaller rows,
    // and it is what the owner saw as "49 folded 0-character rows".
    const work = out.nodes.filter((n) => n.k === 'work');
    assert.equal(work.length, 2, 'consecutive machinery collapses into one node');
    assert.equal(work.reduce((sum, n) => sum + n.s, 0), 7, 'and it still covers all seven records');

    const withTools = work.find((n) => n.x !== undefined && n.x.includes('Bash'));
    assert.ok(withTools, 'a folded run NAMES what ran — a fold that says only "7 steps" cannot be skimmed');
  } finally { b.dispose(); }
});

test('person-side text nobody typed is labelled, never drawn as the person speaking', () => {
  const b = box();
  try {
    b.write('sess-doc', SESSION);
    const out = buildOutline(b.file('sess-doc'));
    const tagged = out.nodes.filter((n) => n.y !== undefined);
    assert.deepEqual(tagged.map((n) => n.y), ['task-notification']);
    // It keeps its POSITION and its record. Labelling is the disclosure;
    // dropping it would renumber everything after it.
    assert.equal(tagged[0]!.k, 'said');
    assert.equal(tagged[0]!.w, 'you');
  } finally { b.dispose(); }
});

test('the two spellings of the synthetic rule agree, so the copy cannot drift', () => {
  // `read-model-conversation-document.ts` says in its own docblock that
  // `syntheticLabel` is a SECOND spelling of `syntheticKind` in
  // `core/session-summary.ts`, and that the repair is one exported predicate
  // belonging to whoever next opens that file. Until then this is what keeps
  // the copy honest: both are read off disk and their prefix lists compared.
  const mine = readFileSync(path.join(REPO, 'src', 'ui', 'read-model-conversation-document.ts'), 'utf8');
  const theirs = readFileSync(path.join(REPO, 'src', 'core', 'session-summary.ts'), 'utf8');
  const prefixes = (src: string, fn: string): string[] => {
    const at = src.indexOf(fn);
    assert.notEqual(at, -1, `${fn} is gone — this comparison is stale, not passing`);
    const body = src.slice(at, at + 1400);
    return [...body.matchAll(/startsWith\('([^']+)'\)/g)].map((m) => m[1]!).sort();
  };
  assert.deepEqual(
    prefixes(mine, 'function syntheticLabel'),
    prefixes(theirs, 'function syntheticKind'),
    'the archive and the session-summary reader disagree about what a person typed. '
    + 'They are two spellings of one rule and both are measured on the same transcript; '
    + 'fix the copy, or export the predicate and delete this test.');
});

/* ══ THE SEEK: WHY A VIRTUALISED SCROLL IS POSSIBLE ════════════════════════ */

test('a seek across a non-ASCII record lands on the record the outline named', () => {
  const b = box();
  try {
    b.write('sess-doc', SESSION);
    const file = b.file('sess-doc');
    const out = buildOutline(file);

    // The Hebrew answer is record 2, so every node after it sits past a
    // multi-byte character. A character offset would be short by one byte per
    // Hebrew letter here and would land mid-record — reported as `unreadable`
    // rather than thrown, which is the silent failure this asserts away.
    const later = out.nodes.filter((n) => n.f > 2);
    assert.ok(later.length >= 3, 'the fixture has nodes past the non-ASCII record');

    for (const node of later) {
      const walk = iterateTranscript(file, { startByte: node.o, startIndex: node.f });
      const first = walk.next();
      walk.return(undefined);
      assert.equal(first.done, false, `node ${node.n} seeks to a record`);
      assert.equal(first.value!.index, node.f, `node ${node.n} lands on the record it named`);
      assert.equal(first.value!.byteOffset, node.o, 'and at the byte it named');
      assert.notEqual(first.value!.record, null,
        `node ${node.n}'s offset lands on a line start, not inside one — a character `
        + 'offset would land here and report `unreadable`');
    }
  } finally { b.dispose(); }
});

test('readNodes rebuilds exactly the nodes the outline promised, from the middle', () => {
  const b = box();
  try {
    b.write('sess-doc', SESSION);
    const file = b.file('sess-doc');
    const out = buildOutline(file);

    const start = out.nodes[2]!;
    const got = readNodes(file, { at: start.o, from: start.f, node: start.n, count: 3 });
    assert.equal(got.length, 3);
    for (let i = 0; i < got.length; i += 1) {
      const promised = out.nodes[start.n + i]!;
      assert.equal(got[i]!.n, promised.n);
      assert.equal(got[i]!.kind, promised.k);
      assert.equal(got[i]!.who, promised.w);
      assert.equal(got[i]!.first, promised.f, 'the window agrees with the outline about records');
      assert.equal(got[i]!.span, promised.s);
    }
  } finally { b.dispose(); }
});

test('a folded run carries its steps, its tool detail and its failure', () => {
  const b = box();
  try {
    b.write('sess-doc', SESSION);
    const file = b.file('sess-doc');
    const out = buildOutline(file);
    const run = out.nodes.find((n) => n.k === 'work' && (n.x ?? []).some((t) => t.startsWith('Bash')))!;
    const [body] = readNodes(file, { at: run.o, from: run.f, node: run.n, count: 1 });

    assert.equal(body!.kind, 'work');
    assert.equal(body!.steps.length, run.s, 'every record in the run is a step — nothing folded away twice');

    const bash = body!.steps.find((s) => s.tool === 'Bash')!;
    // A fold that says `Bash` forty times cannot be skimmed. 2,375 of the
    // owner's 3,280 tool calls are Bash, so the DETAIL is what makes the
    // summary readable — and OWNER RULING 2026-09-08, *"move the command into
    // the closed fold"*, settles which argument it reads: the command, not the
    // prose written about the command.
    //
    // `seq:24`'s lane argued against this and was right at the time — while
    // `DETAIL_FIELDS` was the only capture path, promoting `command` destroyed
    // `description` outright. `seq:24` captures the whole input, so the
    // premise changed and the swap now costs a reader nothing.
    assert.equal(
      bash.detail, 'git status',
      'the CLOSED fold shows what ran, not the sentence about what ran',
    );

    const result = body!.steps.find((s) => s.blocks.includes('tool_result'))!;
    assert.match(result.text, /working tree clean/, 'a tool result keeps its output');

    // Book-keeping records carry no message and no text, and they are still
    // steps: a reader who cannot see that a record was there cannot know one
    // was skipped.
    assert.ok(body!.steps.some((s) => s.type === 'ai-title' || s.type === 'attachment'
      || s.type === 'queue-operation'), 'a record with no message is a named step, never a gap');
  } finally { b.dispose(); }
});

/* ══ WHAT THE TOOL WAS ASKED, NOT ONLY WHAT CAME BACK ══════════════════════ */

/**
 * The owner pasted his own terminal output back on 2026-09-08 and found a
 * `Write(...)` naming the file it wrote and a `Bash(...)` naming the command it
 * ran, BOTH absent from the session he was reading in the browser. It was a
 * capture defect: `detail` was one line of at most 160 characters and was the
 * only thing the read model held about an input, so the fold being openable
 * could never have shown it. Measured on that transcript, 3,027 of 3,280 tool
 * calls lost content — 4.45 MB.
 *
 * Every shape that lost something has a row here: a `Bash` whose command was
 * beaten by its description, an `Agent` whose brief was, a `Write` whose
 * content was beaten by its path, and an `AskUserQuestion` that captured
 * NOTHING because `questions` is an array and the fallback only took strings.
 */
const ASKED: unknown[] = [
  { type: 'user', message: { role: 'user', content: 'run the suite' }, timestamp: '2026-09-08T10:00:00.000Z' },
  {
    type: 'assistant',
    message: { role: 'assistant', content: toolUse('Bash', {
      command: 'npx playwright test --config e2e/playwright.config.ts\nconversations.spec.ts',
      description: 'Run the browser suite',
      timeout: 600000,
      run_in_background: false,
    }) },
    timestamp: '2026-09-08T10:00:01.000Z',
  },
  {
    type: 'assistant',
    message: { role: 'assistant', content: toolUse('Write', {
      file_path: '/tmp/report.md', content: '# report\n\nthe whole file body\n',
    }) },
    timestamp: '2026-09-08T10:00:02.000Z',
  },
  {
    type: 'assistant',
    message: { role: 'assistant', content: toolUse('AskUserQuestion', {
      questions: [{
        question: 'Which corpus should the suite read?',
        header: 'Corpus',
        multiSelect: false,
        options: [
          { label: 'The live corpus', description: 'dogfooding, as the rule requires' },
          { label: 'A fixture corpus', description: 'needs the owner’s approval' },
        ],
      }],
    }) },
    timestamp: '2026-09-08T10:00:03.000Z',
  },
  {
    type: 'assistant',
    message: { role: 'assistant', content: toolUse('Bare', ['not', 'an', 'object']) },
    timestamp: '2026-09-08T10:00:04.000Z',
  },
  { type: 'assistant', message: { role: 'assistant', content: text('done') }, timestamp: '2026-09-08T10:00:05.000Z' },
];

/** Every step of every `work` node in a session, in record order. */
function stepsOf(file: string): DocStep[] {
  const out = buildOutline(file);
  const steps: DocStep[] = [];
  for (const node of out.nodes.filter((n) => n.k === 'work')) {
    const [body] = readNodes(file, { at: node.o, from: node.f, node: node.n, count: 1 });
    steps.push(...body!.steps);
  }
  return steps;
}

test('a tool call carries its whole input, and the act reads before the prose about it', () => {
  const b = box();
  try {
    b.write('sess-asked', ASKED);
    const steps = stepsOf(b.file('sess-asked'));

    const bash = steps.find((s) => s.tool === 'Bash')!;
    // THE COMMAND, WHOLE, newline and all — the thing the owner could not find.
    const command = bash.input.find((f) => f.name === 'command')!;
    assert.equal(command.value,
      'npx playwright test --config e2e/playwright.config.ts\nconversations.spec.ts',
      'the command is served exactly as it ran, not collapsed to one line');

    // ORDERING: the ACT outranks the prose ABOUT the act. `description` is
    // written by the same party whose actions are being audited; the command
    // is the fact.
    const names = bash.input.map((f) => f.name);
    assert.ok(names.indexOf('command') < names.indexOf('description'),
      'the command reads before the description of it');
    assert.equal(names[names.length - 1], 'description', 'prose about the call reads last');

    // NOTHING IS DROPPED, including the arguments that are not strings — a
    // capture layer that only understood strings is how AskUserQuestion ended
    // up carrying nothing at all.
    assert.deepEqual([...names].sort(),
      ['command', 'description', 'run_in_background', 'timeout']);
    assert.equal(bash.input.find((f) => f.name === 'timeout')!.value, 600000);
    assert.equal(bash.input.find((f) => f.name === 'run_in_background')!.value, false);

    // ── THE CLOSED FOLD SHOWS THE COMMAND; THE OPEN STEP STILL SHOWS THE
    //    DESCRIPTION ────────────────────────────────────────────────────────
    //
    // Owner ruling, 2026-09-08: *"move the command into the closed fold"*.
    // Both halves are asserted together on purpose, because the ruling is only
    // safe while the second half holds: `description` is what makes a fold of
    // 2,375 `Bash` calls skimmable, and it survives here because `seq:24`
    // captures the whole input one fold away. If a later change dropped
    // `description` from `input`, this pairing fails rather than quietly
    // costing every reader the summary.
    assert.equal(
      bash.detail, 'npx playwright test --config e2e/playwright.config.ts conversations.spec.ts',
      'a MULTI-LINE command collapses to one summary line — `oneLine` flattens whitespace, so '
      + 'the newline in this fixture becomes a space rather than breaking the fold. Measured on '
      + 'the owner\'s transcript: 1,934 of 2,375 collapsed commands (81%) exceed the 160-char '
      + 'cap and are truncated, which is acceptable ONLY because the whole command is in the '
      + 'open fold.',
    );
    assert.equal(
      bash.input.find((f) => f.name === 'description')!.value, 'Run the browser suite',
      'and the prose is still there the moment the step is opened — the condition that makes '
      + 'the ruling above cost nothing',
    );
  } finally { b.dispose(); }
});

test('a written file carries its content, not only its path', () => {
  const b = box();
  try {
    b.write('sess-asked', ASKED);
    const write = stepsOf(b.file('sess-asked')).find((s) => s.tool === 'Write')!;
    assert.equal(write.detail, '/tmp/report.md', 'the fold still names the file');
    assert.equal(write.input.find((f) => f.name === 'content')!.value,
      '# report\n\nthe whole file body\n', 'and the step carries what was written');
  } finally { b.dispose(); }
});

test('a question keeps every option it offered, as structure rather than as a sentence', () => {
  const b = box();
  try {
    b.write('sess-asked', ASKED);
    const ask = stepsOf(b.file('sess-asked')).find((s) => s.tool === 'AskUserQuestion')!;

    // `plan:archive seq:16` must draw a question with EVERY option offered,
    // not only the one chosen — "the options he declined are the record of
    // what was considered". So the array arrives AS AN ARRAY. Stringifying it
    // here would hand that lane a paragraph to re-parse.
    const questions = ask.input.find((f) => f.name === 'questions')!.value as {
      question: string; options: { label: string }[];
    }[];
    assert.ok(Array.isArray(questions), 'a structured argument keeps its structure');
    assert.equal(questions[0]!.question, 'Which corpus should the suite read?');
    assert.deepEqual(questions[0]!.options.map((o) => o.label),
      ['The live corpus', 'A fixture corpus'], 'both options, including the one declined');

    // 71 of these carried NO detail line at all, because every top-level value
    // is an array or a boolean. The last resort now reads one level in rather
    // than giving up, so the closed fold says which question was asked.
    assert.equal(ask.detail, 'Which corpus should the suite read?');
  } finally { b.dispose(); }
});

test('an input that is not an object is still served, under its own name', () => {
  const b = box();
  try {
    b.write('sess-asked', ASKED);
    const bare = stepsOf(b.file('sess-asked')).find((s) => s.tool === 'Bare')!;
    // `INV-nothing-is-dropped-silently`: this module does not get to rule that
    // a tool's arguments are the wrong shape. It serves them and names them.
    assert.deepEqual(bare.input, [{ name: 'input', value: ['not', 'an', 'object'] }]);
  } finally { b.dispose(); }
});

test('carrying an input does not change the count — a step is still one record', () => {
  const b = box();
  try {
    b.write('sess-asked', ASKED);
    const file = b.file('sess-asked');
    const out = buildOutline(file);

    let span = 0;
    for (const node of out.nodes) span += node.s;
    assert.equal(span, out.records, 'sum(span) === records, with structured inputs in the steps');

    const steps = stepsOf(file);
    assert.equal(steps.length, out.nodes.filter((n) => n.k === 'work')
      .reduce((sum, n) => sum + n.s, 0),
    'a step carrying four arguments is still exactly ONE step');
    assert.equal(steps.filter((s) => s.input.length > 0).length, 4,
      'the four tool calls carry input; nothing else does');
  } finally { b.dispose(); }
});

test('a record that calls no tool carries no input, and says so with an empty list', () => {
  const b = box();
  try {
    b.write('sess-doc', SESSION);
    for (const step of stepsOf(b.file('sess-doc'))) {
      assert.ok(Array.isArray(step.input), 'every step has the field, never `undefined`');
      if (step.tool === null) assert.equal(step.input.length, 0);
    }
  } finally { b.dispose(); }
});

/**
 * `plan:archive seq:15`. A step must carry the `tool_use` block's own `id`,
 * because that id — and nothing else — is what an `agent-<id>.meta.json`
 * records as `toolUseId` beside the lane it dispatched.
 *
 * **The alternative this closes off is the reason it is asserted.** Without
 * the id the screen would have to GUESS which turn dispatched which lane —
 * by timestamp proximity, by counting `Agent` calls in order, or by matching a
 * lane's `description` against a call's `prompt`. Every one of those is right
 * most of the time and silently wrong on a session that dispatched two lanes
 * in the same second, which is the ordinary case here: this workspace's own
 * session dispatched 212.
 */
test('a tool call carries the id its lane names it by, and a record with no call carries none', () => {
  const b = box();
  try {
    b.write('sess-ids', [
      { type: 'user', message: { role: 'user', content: 'go' }, timestamp: '2026-09-08T09:00:00.000Z' },
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_LANE', name: 'Agent', input: { prompt: 'the lane brief', subagent_type: 'Explore' } }] }, timestamp: '2026-09-08T09:00:01.000Z' },
      { type: 'user', message: { role: 'user', content: toolResult('the lane reported back') }, timestamp: '2026-09-08T09:00:02.000Z' },
      { type: 'attachment', attachment: { type: 'total_tokens_reminder' } },
    ]);
    const steps = stepsOf(b.file('sess-ids'));

    const call = steps.find((s) => s.tool === 'Agent')!;
    assert.equal(call.toolUseId, 'toolu_LANE');
    assert.ok(
      call.input.some((f) => f.name === 'prompt'),
      'and the brief is beside it, so the link sits on a step that already shows what was asked',
    );

    for (const step of steps) {
      assert.ok(
        step.toolUseId === null || typeof step.toolUseId === 'string',
        'every step has the field, never `undefined` — a screen must not have to tell an absent '
        + 'field from an absent id',
      );
      if (step.tool === null) {
        assert.equal(step.toolUseId, null, 'a record that calls nothing dispatched nothing');
      }
    }
  } finally { b.dispose(); }
});

test('a tool that failed is carried as failed, not as an ordinary step', () => {
  const b = box();
  try {
    b.write('sess-doc', SESSION);
    const file = b.file('sess-doc');
    const out = buildOutline(file);
    let failed = 0;
    for (const node of out.nodes.filter((n) => n.k === 'work')) {
      const [body] = readNodes(file, { at: node.o, from: node.f, node: node.n, count: 1 });
      failed += body!.steps.filter((s) => s.failed).length;
    }
    assert.equal(failed, 1, 'the one `is_error` result is the one marked');
  } finally { b.dispose(); }
});

test('a run longer than the cap splits, and the split still tiles', () => {
  const b = box();
  try {
    const lines: unknown[] = [
      { type: 'user', message: { role: 'user', content: 'go' }, timestamp: '2026-09-08T09:00:00.000Z' },
    ];
    // Three caps' worth of machinery and one word at the end.
    for (let i = 0; i < WORK_RUN_CAP * 3; i += 1) lines.push({ type: 'attachment', attachment: { type: 'x' } });
    lines.push({ type: 'assistant', message: { role: 'assistant', content: text('done') }, timestamp: '2026-09-08T09:01:00.000Z' });
    b.write('sess-long', lines);

    const out = buildOutline(b.file('sess-long'));
    const work = out.nodes.filter((n) => n.k === 'work');
    assert.equal(work.length, 3, 'a run longer than the cap becomes consecutive runs');
    for (const node of work) {
      assert.ok(node.s <= WORK_RUN_CAP,
        'no fold holds more than the cap — a fold nobody can open is worse than two folds');
    }
    let at = 0;
    for (const node of out.nodes) { assert.equal(node.f, at); at += node.s; }
    assert.equal(at, out.records, 'splitting a run does not lose a record');
  } finally { b.dispose(); }
});

test('a line that will not parse is a visible step, never a silent skip', () => {
  const b = box();
  try {
    b.writeRaw('sess-bad', [
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'hello' }, timestamp: '2026-09-08T09:00:00.000Z' }),
      '{ this is not json',
      JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: text('hi') }, timestamp: '2026-09-08T09:00:01.000Z' }),
    ].join('\n') + '\n');

    const out = buildOutline(b.file('sess-bad'));
    assert.equal(out.records, 3, 'the bad line is a record — it occupies a position in the file');
    assert.equal(out.cursor.unreadable, 1, 'and it is counted as unreadable');

    const run = out.nodes.find((n) => n.k === 'work')!;
    const [body] = readNodes(b.file('sess-bad'), { at: run.o, from: run.f, node: run.n, count: 1 });
    assert.equal(body!.steps.length, 1);
    assert.equal(body!.steps[0]!.unreadable, true, 'the gap is drawn as a gap');
  } finally { b.dispose(); }
});

/* ══ THE ROUTES ════════════════════════════════════════════════════════════ */

test('all three document routes are registered, so a page can actually reach them', () => {
  registerReadRoutes();
  const paths = registeredRoutes().map((r) => `${r.method} ${r.path}`);
  assert.ok(paths.includes('GET /api/conversations/:id/outline'), paths.join('\n'));
  assert.ok(paths.includes('GET /api/conversations/:id/nodes'), paths.join('\n'));
  assert.ok(paths.includes('GET /api/conversations/:id/tip'), paths.join('\n'));
});

test('the outline endpoint serves the whole document and says how far it read', () => {
  const b = box();
  try {
    b.write('sess-doc', SESSION);
    b.scan();
    const got = apiConversationOutline(
      b.ws, new URL('http://localhost/api/conversations/sess-doc/outline'), { id: 'sess-doc' });
    assert.equal(got.status, 200);
    const body = got.body as {
      present: boolean; records: number; said: number; work: number;
      nodes: unknown[]; truncated: boolean; walkedBytes: number; uncounted: string | null;
    };
    assert.equal(body.present, true);
    assert.equal(body.records, SESSION.length);
    assert.equal(body.said + body.work, body.nodes.length);
    assert.equal(body.truncated, false);
    assert.equal(body.uncounted, null, 'a whole walk has nothing to explain away');
    assert.ok(body.walkedBytes > 0, 'and it says how many bytes it read');
  } finally { b.dispose(); }
});

test('the node endpoint refuses a parameter it cannot act on, and one that is not a number', () => {
  const b = box();
  try {
    b.write('sess-doc', SESSION);
    b.scan();
    const call = (q: string) => apiConversationNodes(
      b.ws, new URL(`http://localhost/api/conversations/sess-doc/nodes${q}`), { id: 'sess-doc' });

    assert.equal(call('?limit=5').status, 400, 'a parameter this route does not take is refused');
    assert.equal(call('?at=-1').status, 400, 'a negative offset is not digits');
    assert.equal(call('?count=many').status, 400);
    assert.equal(call('?at=0&from=0&node=0&count=2').status, 200);
  } finally { b.dispose(); }
});

test('an offset past the end of a growing file is an empty window, not a crash', () => {
  const b = box();
  try {
    b.write('sess-doc', SESSION);
    b.scan();
    // The transcript grows while it is read — the owner's grew 2.7 MB during
    // this build — so a client holding a minute-old outline asking about a
    // byte that no longer means what it did is a legitimate question, and it
    // gets an empty answer it can re-ask rather than a 500.
    const got = apiConversationNodes(
      b.ws,
      new URL('http://localhost/api/conversations/sess-doc/nodes?at=999999999&from=0&node=0&count=4'),
      { id: 'sess-doc' });
    assert.equal(got.status, 200);
    assert.deepEqual((got.body as { nodes: unknown[] }).nodes, []);
  } finally { b.dispose(); }
});

test('a pruned session is served as a pruned session, never as a failure', () => {
  const b = box();
  try {
    b.write('sess-gone', SESSION);
    b.scan();
    // The harness prunes transcripts and this archive reads them in place
    // rather than copying, so what is gone is gone — and that is a STATE the
    // document reports, with the reason, not an error that reads as damage.
    removeTree(b.file('sess-gone'));
    const got = apiConversationOutline(
      b.ws, new URL('http://localhost/api/conversations/sess-gone/outline'), { id: 'sess-gone' });
    assert.equal(got.status, 200);
    const body = got.body as { present: boolean; nodes: unknown[]; uncounted: string | null };
    assert.equal(body.present, false);
    assert.deepEqual(body.nodes, []);
    assert.match(String(body.uncounted), /no longer on disk/);
  } finally { b.dispose(); }
});

test('an unknown session is a 404 that names the id as data, never as markup', () => {
  const b = box();
  try {
    b.write('sess-doc', SESSION);
    b.scan();
    const got = apiConversationOutline(
      b.ws,
      new URL('http://localhost/api/conversations/x/outline'),
      { id: '<script>canary-9f3a2b</script>' });
    assert.equal(got.status, 404);
    // The id IS named — a refusal a reader cannot act on is its own defect —
    // but it lands in a JSON string field, never in markup, and the screen
    // appends it as a text node. The wording is
    // `read-model-conversations.ts`' own, deliberately, so a reader who meets
    // both endpoints meets one sentence.
    assert.equal(typeof (got.body as { error: string }).error, 'string');
    assert.match((got.body as { error: string }).error, /no indexed conversation/);
  } finally { b.dispose(); }
});

test('the outline reads as far as the index does, so the two screens cannot disagree', () => {
  // `DOCUMENT_WALK_CAP` is `MAX_SCAN_BYTES` and NOT the record endpoint's
  // 64 MB `CONVERSATION_WALK_CAP`. The owner's transcript was 61 MB when this
  // was written and passed 64 MB during the build, so a smaller cap here would
  // have made the document stop before the counts the LIST screen shows for
  // the same file — two screens disagreeing about one transcript.
  assert.equal(DOCUMENT_WALK_CAP, 256 * 1024 * 1024);
});

/* ══ NO CAP — `seq:7`'s REMAINDER, AND THE RULING IT REPLACED ══════════════ */

/**
 * **The ruling this asserts, and the one it replaces.**
 *
 * `SAID_TEXT_CAP = 60_000` and `STEP_TEXT_CAP = 4_000` stood in the document
 * read model until 2026-09-08, each with a `textTruncated` flag that disclosed
 * itself honestly. The owner read that disclosure on his own screen and ruled
 * it out: *"if there is a size restriction it must be removed, i want no
 * restriction or limitation"* — `seq:7`, "NO CAP IN THE DOCUMENT VIEW".
 *
 * So this test is the OPPOSITE claim to the one a capped endpoint owes, and it
 * is written as a claim about both halves for the same reason the capped
 * version was: a test that only fed it a short record would pass on an
 * endpoint that had quietly kept a cap ten times larger.
 *
 * The sizes are chosen to sit either side of the numbers that were there:
 * 90,000 characters of spoken text against the old 60,000, and 12,000
 * characters of tool output against the old 4,000. Measured on the owner's own
 * transcript before the caps came off, neither bound was hypothetical in the
 * same way: the largest turn in 28,998 records is 24,605 characters, so
 * `SAID_TEXT_CAP` never once fired, while 41 records exceeded the step cap and
 * the largest of them was 58,888 characters.
 */
test('a long turn and a long tool result come back WHOLE, and nothing claims a cut', () => {
  const b = box();
  try {
    const said = 'x'.repeat(90_000);
    const output = 'y'.repeat(12_000);
    b.write('sess-big', [
      { type: 'user', message: { role: 'user', content: 'go' }, timestamp: '2026-09-08T09:00:00.000Z' },
      { type: 'assistant', message: { role: 'assistant', content: text(said) }, timestamp: '2026-09-08T09:00:01.000Z' },
      { type: 'assistant', message: { role: 'assistant', content: toolUse('Bash', { command: 'ls' }) }, timestamp: '2026-09-08T09:00:02.000Z' },
      { type: 'user', message: { role: 'user', content: toolResult(output) }, timestamp: '2026-09-08T09:00:03.000Z' },
      { type: 'assistant', message: { role: 'assistant', content: text('short') }, timestamp: '2026-09-08T09:00:04.000Z' },
    ]);
    const out = buildOutline(b.file('sess-big'));
    const nodes = readNodes(b.file('sess-big'), {
      at: out.nodes[0]!.o, from: 0, node: 0, count: out.nodes.length,
    });

    const long = nodes.find((n) => n.kind === 'said' && n.text.length > 1_000);
    assert.ok(long !== undefined, 'the long turn is a node of its own');
    assert.equal(long.text.length, 90_000,
      'WHOLE. 60,000 was the cap the owner ruled out, and a slice at any number '
      + 'is the defect he ruled out rather than a smaller version of it.');
    assert.equal(long.totalChars, 90_000, 'and the length it reports is the length it sent');

    const work = nodes.find((n) => n.kind === 'work' && n.steps.some((step) => step.text !== ''));
    assert.ok(work !== undefined, 'the tool result is folded into a run');
    const step = work.steps.find((one) => one.text.length > 1_000)!;
    assert.equal(step.text.length, 12_000, 'tool output is whole too — 4,000 was the other cap');

    // The complete short turn is asserted in the same breath, which is what
    // the capped version of this test did in the other direction: a claim that
    // long records survive is worth little without the claim that the endpoint
    // did not simply stop measuring.
    const short = nodes.find((n) => n.kind === 'said' && n.text === 'short');
    assert.ok(short !== undefined);
    assert.equal(short.totalChars, 5);

    // AND THE DISCLOSURE FIELDS ARE GONE, not merely always false. A `false`
    // that can never be `true` is a screen drawing a branch nobody can reach,
    // and `conversations.js` read exactly these two names to draw it.
    for (const node of nodes) {
      assert.ok(!('textTruncated' in node), 'nothing can truncate, so nothing discloses one');
      assert.ok(!('thinkingTruncated' in node));
      for (const one of node.steps) {
        assert.ok(!('textTruncated' in one));
        assert.ok(!('totalChars' in one), 'a step\'s totalChars was text.length restated');
      }
    }

    const body = apiConversationOutline(
      b.ws, new URL('http://localhost/api/conversations/sess-big/outline'), { id: 'sess-big' },
    ).body as Record<string, unknown>;
    assert.ok(!('saidTextCap' in body), 'and the answer no longer advertises a bound it does not have');
    assert.ok(!('stepTextCap' in body));
  } finally { b.dispose(); }
});

/* ══ seq:19 — THE DOCUMENT FOLLOWS A SESSION STILL BEING WRITTEN ═══════════ */

/**
 * `plan:archive seq:19` warns that a test cannot use the live session, because
 * *"the document grows BECAUSE it is being looked at"*. So every test below
 * appends to a fixture of its own and watches its own append arrive.
 */
test('the tip is one stat: the bytes and mtime the freshness key is made of', () => {
  const b = box();
  try {
    b.write('sess-tip', SESSION);
    b.scan();
    const got = apiConversationTip(
      b.ws, new URL('http://localhost/api/conversations/sess-tip/tip'), { id: 'sess-tip' });
    assert.equal(got.status, 200);
    const tip = got.body as DocTipBody;
    assert.equal(tip.present, true);
    assert.ok(tip.bytes > 0);
    assert.ok(tip.mtimeMs > 0, 'the OTHER half of the key — `(bytes, mtime_ms)` is the '
      + 'index\'s own, and a document that invented a second notion of "the file moved" '
      + 'would eventually disagree with the list about it');

    const before = tip.bytes;
    appendFileSync(b.file('sess-tip'), JSON.stringify(
      { type: 'user', message: { role: 'user', content: 'and one more thing' } }) + '\n');
    const after = (apiConversationTip(
      b.ws, new URL('http://localhost/api/conversations/sess-tip/tip'), { id: 'sess-tip' },
    ).body as DocTipBody).bytes;
    assert.ok(after > before,
      'and it reads the FILE rather than the index row — the index was scanned before the '
      + 'append and nothing has rebuilt it, which is exactly the state seq:14 was filed for');
  } finally { b.dispose(); }
});

/**
 * **One key, one representation of it — and this is the bug it would have
 * been.** The outline stats the file itself; the tip answers out of
 * `listTranscriptFiles`, which FLOORS `mtimeMs`. A screen holding the
 * outline's unfloored `1234.5678` and receiving the tip's `1234` would read
 * its own rounding as the transcript having been replaced under it, and say so
 * on the screen — the loudest possible way to be wrong about a file that had
 * not changed at all. Both are floored, and this is the assertion that keeps
 * them that way.
 */
test('the outline and the tip report the SAME mtime for the same file, to the same precision', () => {
  const b = box();
  try {
    b.write('sess-key', SESSION);
    b.scan();
    const outline = apiConversationOutline(
      b.ws, new URL('http://localhost/api/conversations/sess-key/outline'), { id: 'sess-key' },
    ).body as DocOutlineBody;
    const tip = apiConversationTip(
      b.ws, new URL('http://localhost/api/conversations/sess-key/tip'), { id: 'sess-key' },
    ).body as DocTipBody;

    assert.equal(outline.mtimeMs, tip.mtimeMs,
      'the freshness key is (bytes, mtime_ms) and the two readers of it must agree bit for bit');
    assert.equal(outline.mtimeMs, Math.floor(outline.mtimeMs), 'a whole number of milliseconds');
    assert.equal(outline.bytes, tip.bytes);
  } finally { b.dispose(); }
});

test('a pruned transcript answers the tip as a state, never as a failure', () => {
  const b = box();
  try {
    b.write('sess-gone-tip', SESSION);
    b.scan();
    removeTree(b.file('sess-gone-tip'));
    const got = apiConversationTip(
      b.ws, new URL('http://localhost/api/conversations/sess-gone-tip/tip'),
      { id: 'sess-gone-tip' });
    assert.equal(got.status, 200, 'a session the harness pruned is a state the screen draws');
    assert.equal((got.body as DocTipBody).present, false);
  } finally { b.dispose(); }
});

test('the outline resumes from a node and returns only the tail — the append, not the file', () => {
  const b = box();
  try {
    b.write('sess-tail', SESSION);
    b.scan();
    const whole = apiConversationOutline(
      b.ws, new URL('http://localhost/api/conversations/sess-tail/outline'), { id: 'sess-tail' },
    ).body as DocOutlineBody;
    assert.equal(whole.resumed, false);
    const last = whole.nodes[whole.nodes.length - 1] as DocOutlineNode;

    // The append: two more turns and the machinery between them.
    appendFileSync(b.file('sess-tail'), [
      { type: 'user', message: { role: 'user', content: 'one more question' }, timestamp: '2026-09-08T09:01:00.000Z' },
      { type: 'attachment', attachment: { type: 'total_tokens_reminder' } },
      { type: 'assistant', message: { role: 'assistant', content: text('one more answer') }, timestamp: '2026-09-08T09:01:01.000Z' },
    ].map((r) => JSON.stringify(r)).join('\n') + '\n');

    const tail = apiConversationOutline(
      b.ws,
      new URL(`http://localhost/api/conversations/sess-tail/outline?at=${last.o}&from=${last.f}&node=${last.n}`),
      { id: 'sess-tail' },
    ).body as DocOutlineBody;

    assert.equal(tail.resumed, true);
    // THE NAMED NODE IS REBUILT, NOT SKIPPED. It may have been an open `work`
    // run the append extended, so the caller replaces it — and that is only
    // sound if the resumed walk starts AT it.
    assert.equal(tail.nodes[0]!.n, last.n, 'the tail begins at the node the caller named');
    assert.equal(tail.nodes[0]!.f, last.f, 'and at that node\'s own first record');
    assert.ok(tail.nodes.length > 1, 'and it carries what the append added');

    // The whole document, spliced the way the screen splices it, still tiles
    // the record space — which is INV-nothing-is-dropped-silently as
    // arithmetic rather than as a promise, asserted across an APPEND.
    const spliced = [...whole.nodes.slice(0, last.n), ...tail.nodes];
    let at = 0;
    for (const node of spliced) {
      assert.equal(node.f, at, 'node k\'s first is node k-1\'s first + span');
      at += node.s;
    }
    assert.equal(at, last.f + tail.records,
      'and the spans sum to the records — the tail counts from where it started, so the '
      + 'whole is the resumed record index plus the tail\'s own count');
    assert.equal(at, SESSION.length + 3);

    // The nodes are numbered densely across the seam, which is what lets the
    // screen key its cached bodies and measured heights by node index at all.
    spliced.forEach((node, i) => { assert.equal(node.n, i); });
  } finally { b.dispose(); }
});

test('a resume needs all three of at, from and node — a partial set is refused, not defaulted', () => {
  const b = box();
  try {
    b.write('sess-tail2', SESSION);
    b.scan();
    const call = (q: string) => apiConversationOutline(
      b.ws, new URL(`http://localhost/api/conversations/sess-tail2/outline${q}`), { id: 'sess-tail2' });

    assert.equal(call('').status, 200, 'none of them is the whole outline, as it always was');
    assert.equal(call('?at=0').status, 400,
      'a defaulted `node` of 0 would renumber the caller\'s whole document in silence, which '
      + 'is worse than a refusal it can read');
    assert.equal(call('?at=0&from=0').status, 400);
    assert.equal(call('?at=0&from=0&node=0').status, 200);
    assert.equal(call('?at=-1&from=0&node=0').status, 400, 'a negative offset is not digits');
    assert.equal(call('?limit=5').status, 400, 'a parameter this route does not take is refused');
  } finally { b.dispose(); }
});

test('a resume past the end of a replaced file is an empty tail, not a crash', () => {
  const b = box();
  try {
    b.write('sess-tail3', SESSION);
    b.scan();
    const got = apiConversationOutline(
      b.ws,
      new URL('http://localhost/api/conversations/sess-tail3/outline?at=999999999&from=0&node=0'),
      { id: 'sess-tail3' });
    assert.equal(got.status, 200);
    assert.deepEqual((got.body as DocOutlineBody).nodes, [],
      'a transcript can be replaced under a reader, and a client holding a minute-old outline '
      + 'is asking a legitimate question about a file that has since changed');
  } finally { b.dispose(); }
});
