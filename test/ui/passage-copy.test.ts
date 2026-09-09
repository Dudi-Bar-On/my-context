// @basis TASK-a-selected-passage-copies-as-something-a-terminal-will,
// TASK-a-task-notification-is-3-9-mb-of-what-a-lane-reported-drawn,
// TASK-a-question-its-options-the-answer-chosen-and-a-shell-command,
// INV-nothing-is-dropped-silently
/**
 * A MARKED PASSAGE, TURNED INTO SOMETHING A TERMINAL WILL ACCEPT —
 * `TASK-a-selected-passage-copies-as-something-a-terminal-will`.
 *
 * ── WHAT IS UNDER TEST HERE, AND WHAT DELIBERATELY IS NOT ─────────────────
 *
 * Two of the three forms are:
 *
 *   MESSAGE TEXT, built by `src/ui/public/lib/passage.js` — a browser module
 *   with no DOM in it, imported here by a `file://` URL the same way
 *   `strings-parity.test.ts` imports the string tables, and driven with the
 *   REAL English table rather than a stub so that the sentences asserted below
 *   are the sentences a reader gets.
 *
 *   RAW RECORD, built by `apiConversationRaw` — a byte slice, asserted against
 *   the file's own bytes rather than against a re-serialisation, because
 *   "exactly as created" is the whole claim.
 *
 * The third — RENDERED TEXT — is `Selection.toString()` and exists only in a
 * browser. It is not stubbed here, because a stub would assert this file's
 * idea of what a browser does. `e2e/conversations.spec.ts` drives it.
 *
 * Nor is the DOM-range-to-record-range mapping here: it reads a live
 * `Selection` over a virtualised well, which is a browser fact. The half of it
 * that IS arithmetic — grouping node indices into the contiguous runs a byte
 * slice can be asked for — is `runsOf`, and it is below.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { Store } from '../../src/core/store.ts';
import { projectDirName, rebuildConversations } from '../../src/core/conversation-index.ts';
import {
  PASSAGE_RAW_CAP, apiConversationRaw, buildOutline,
} from '../../src/ui/read-model-conversation-document.ts';
import { registerReadRoutes } from '../../src/ui/server.ts';
import { registeredRoutes } from '../../src/ui/routes.ts';
import type { Workspace } from '../../src/core/workspace.ts';

const PUBLIC = path.join(import.meta.dirname, '..', '..', 'src', 'ui', 'public');
const fileUrl = (...parts: string[]): string =>
  new URL(`file://${path.join(PUBLIC, ...parts).replaceAll('\\', '/')}`).href;

interface Passage {
  PASSAGE_NODE_CAP: number;
  PASSAGE_RAW_CAP: number;
  messagePassage: (bodies: unknown[], open: Set<number>, l: unknown) => {
    text: string;
    notes: { sections: number; shutFolds: number; shutRecords: number; dropped: string[] };
  };
  passageHead: (body: unknown, l: unknown) => string;
  runsOf: (indices: number[]) => { from: number; to: number }[];
}

const passage = await import(fileUrl('lib', 'passage.js')) as unknown as Passage;
const i18n = await import(fileUrl('lib', 'i18n.js')) as unknown as {
  tFlat: (strings: Record<string, string>, key: string, subs?: Record<string, unknown>) => string;
};
const en = await import(fileUrl('strings', 'en.js')) as unknown as {
  strings: Record<string, string>;
};
const he = await import(fileUrl('strings', 'he.js')) as unknown as {
  strings: Record<string, string>;
};

/**
 * The four words the passage builder needs, wired to a REAL table.
 *
 * `stamp` returns `null` throughout: `zonedStampOf` is a browser formatter and
 * the timestamp line is not what any assertion below is about. A `null` stamp
 * is a shape the builder has to handle anyway — `dayText` returns it for a
 * record with no usable timestamp — so this is a supported answer rather than
 * a convenience.
 */
const labels = (table: Record<string, string>) => ({
  t: (key: string, subs: Record<string, unknown> = {}) => i18n.tFlat(table, key, subs),
  speaker: (who: string | null) => {
    const keys: Record<string, string> = {
      you: 'conv.doc.you', claude: 'conv.doc.claude',
      subagent: 'conv.doc.subagent', shell: 'conv.doc.shell',
    };
    const key = who === null ? undefined : keys[who];
    return key === undefined ? null : i18n.tFlat(table, key);
  },
  synthetic: (label: string) => {
    const keys: Record<string, string> = {
      'task-notification': 'conv.doc.syn.task', 'slash-command': 'conv.doc.syn.slash',
      meta: 'conv.doc.syn.meta', 'system-reminder': 'conv.doc.syn.reminder',
      'harness-compaction-summary': 'conv.doc.syn.compaction',
    };
    const key = keys[label];
    return key === undefined ? label : i18n.tFlat(table, key);
  },
  stamp: () => null,
});

const L = labels(en.strings);

/** A `said` node. Everything a `DocNodeBody` carries, with the defaults it has. */
function said(n: number, text: string, extra: Record<string, unknown> = {}): unknown {
  return {
    n, kind: 'said', deed: null, who: 'you', timestamp: null, first: n, span: 1,
    text, totalChars: text.length, thinking: '', synthetic: null, steps: [],
    outcome: null, answers: [], answerText: '', ...extra,
  };
}

/** A promoted shell command — the case the owner named. */
function ran(n: number, command: string, rest: Record<string, unknown> = {}): unknown {
  const input: { name: string; value: unknown }[] = [{ name: 'command', value: command }];
  for (const [name, value] of Object.entries(rest)) input.push({ name, value });
  return {
    n, kind: 'deed', deed: 'ran', who: 'shell', timestamp: null, first: n, span: 1,
    text: '', totalChars: 0, thinking: '', synthetic: null,
    steps: [{
      index: n, type: 'assistant', subtype: null, timestamp: null, tool: 'Bash',
      detail: 'a description', failed: false, blocks: ['tool_use'], text: '',
      input, toolUseId: 'toolu_1', unreadable: false,
    }],
    outcome: 'ok', answers: [], answerText: '',
  };
}

/** A folded run of machinery. */
function work(n: number, span: number, resultText: string): unknown {
  const steps = [];
  for (let i = 0; i < span; i += 1) {
    steps.push({
      index: n + i, type: 'user', subtype: null, timestamp: null, tool: 'Read',
      detail: 'src/app.ts', failed: false, blocks: ['tool_result'],
      text: `${resultText} ${i}`, input: [], toolUseId: null, unreadable: false,
    });
  }
  return {
    n, kind: 'work', deed: null, who: null, timestamp: null, first: n, span,
    text: '', totalChars: 0, thinking: '', synthetic: null, steps,
    outcome: null, answers: [], answerText: '',
  };
}

/* ══ MESSAGE TEXT — THE DEFAULT, AND THE OWNER'S OWN CASE ══════════════════ */

test('one marked shell command copies as the command and nothing else', () => {
  const built = passage.messagePassage(
    [ran(4, 'git status --porcelain')], new Set(), L);

  // **THE WHOLE ITEM, IN ONE ASSERTION.** *"For a shell command it is the
  // command exactly as it ran — which is what a terminal will accept, and is
  // the case he named."* A heading above it is the thing that breaks the
  // paste, so a single section that can stand alone gets none.
  assert.equal(built.text, 'git status --porcelain');
  assert.ok(!built.text.includes('##'), 'no heading, or a terminal refuses the line');
});

test('a command copied on its own SAYS what was left beside it', () => {
  const built = passage.messagePassage(
    [ran(4, 'npm test', { description: 'Run the suite', timeout: 600000 })], new Set(), L);

  assert.equal(built.text, 'npm test', 'the payload is still exactly the command');
  // `INV-nothing-is-dropped-silently`. The disclosure cannot live in the
  // payload — a note above the command is what stops a terminal accepting it —
  // so it is handed to the caller, which says it on the screen.
  assert.deepEqual(built.notes.dropped, ['description', 'timeout']);
});

test('a passage of several sections names who spoke in each, in document order', () => {
  const built = passage.messagePassage(
    [said(1, 'first thing'), ran(2, 'ls -la'), said(3, 'last thing')], new Set(), L);

  const heads = built.text.split('\n').filter((line) => line.startsWith('## '));
  assert.equal(heads.length, 3, 'one heading per section, once there is more than one');
  assert.ok(heads[0]!.includes('You'));
  assert.ok(heads[1]!.includes('Shell'));
  assert.ok(built.text.indexOf('first thing') < built.text.indexOf('ls -la'));
  assert.ok(built.text.indexOf('ls -la') < built.text.indexOf('last thing'));
});

test('a synthetic turn is never copied as something a person typed', () => {
  const notification = said(7, '<task-notification>a lane finished</task-notification>', {
    synthetic: 'task-notification', who: null,
  });

  // Alone. This is the dangerous case: a bare copy would present a background
  // notification as the owner's own words, which is the defect
  // `plan:archive seq:28` was filed for, made worse — a payload has no chip,
  // no dimming and no glyph left to carry the distinction.
  const one = passage.messagePassage([notification], new Set(), L);
  assert.ok(one.text.startsWith('## '), 'it keeps its heading even alone');
  assert.ok(one.text.includes(en.strings['conv.copy.notTyped']!));
  assert.ok(one.text.includes('Background task finished'));

  // And in a passage, where it sits beside turns a person DID type.
  const many = passage.messagePassage([said(6, 'mine'), notification], new Set(), L);
  const heads = many.text.split('\n').filter((line) => line.startsWith('## '));
  assert.ok(heads[0]!.includes('You'));
  assert.ok(!heads[0]!.includes(en.strings['conv.copy.notTyped']!),
    'the clause goes on the turn nobody typed, not on the one he did');
  assert.ok(heads[1]!.includes(en.strings['conv.copy.notTyped']!));
});

test('a closed fold says how much it kept out; an open one hands it over', () => {
  const fold = work(10, 5, 'the result text');

  const shut = passage.messagePassage([said(9, 'ask'), fold], new Set(), L);
  assert.ok(!shut.text.includes('the result text 0'),
    'a fold the reader never opened is not silently unpacked into their clipboard');
  assert.ok(shut.text.includes('5'), 'and the count of what was left out is in the payload');
  assert.equal(shut.notes.shutFolds, 1);
  assert.equal(shut.notes.shutRecords, 5, 'records, not sections — the fold holds five');

  const open = passage.messagePassage([said(9, 'ask'), fold], new Set([10]), L);
  assert.ok(open.text.includes('the result text 0'));
  assert.ok(open.text.includes('the result text 4'), 'every record in the run, not the first');
  assert.equal(open.notes.shutFolds, 0, 'nothing to disclose when nothing was left out');
});

test('a question copies with every option it offered and the one that was chosen', () => {
  const ask = {
    n: 3, kind: 'deed', deed: 'ask', who: 'claude', timestamp: null, first: 3, span: 1,
    text: '', totalChars: 0, thinking: '', synthetic: null,
    steps: [{
      index: 3, type: 'assistant', subtype: null, timestamp: null, tool: 'AskUserQuestion',
      detail: null, failed: false, blocks: ['tool_use'], text: '', toolUseId: 'toolu_2',
      unreadable: false,
      input: [{
        name: 'questions',
        value: [{
          question: 'Which way?',
          options: [
            { label: 'Left', description: 'the cheap one' },
            { label: 'Right', description: 'the slow one' },
          ],
        }],
      }],
    }],
    outcome: 'ok', answers: [{ question: 'Which way?', answer: 'Right' }], answerText: '',
  };

  const built = passage.messagePassage([ask], new Set(), L);
  assert.ok(built.text.includes('Which way?'));
  // `plan:archive seq:16`: *"the options he declined are the record of what
  // was considered"* — so a copy that kept only the chosen one would be a
  // smaller record than the screen it was copied from.
  assert.ok(built.text.includes('Left'), 'the option he did not take is in the copy');
  assert.ok(built.text.includes('the slow one'), 'and so is what each option said');
  assert.ok(/Right.*\[chosen\]/.test(built.text), 'and which one he picked');
});

test('message text adds no invisible direction marks of its own', () => {
  // The item's reason for ruling out the DOM: *"This UI deliberately inserts
  // bidi control characters and isolation wrappers … a DOM selection copies
  // those invisible characters into the clipboard, and they will travel into
  // whatever he pastes into."* Message text is built from the RECORD and never
  // touches the page, so the only marks it can carry are ones the record
  // itself holds — and the Hebrew table must not smuggle any in either.
  const marks = /[‎‏؜‪-‮⁦-⁩]/;
  const bodies = [
    said(1, 'קודם כול אקרא את המפרט'), ran(2, 'git status'), work(3, 2, 'output'),
  ];
  for (const [name, table] of [['en', en.strings], ['he', he.strings]] as const) {
    const built = passage.messagePassage(bodies, new Set(), labels(table));
    assert.ok(!marks.test(built.text), `${name}: a copy carries no mark the record did not`);
  }
});

test('runsOf groups the sections a byte slice can actually be asked for', () => {
  assert.deepEqual(passage.runsOf([4, 5, 6]), [{ from: 4, to: 6 }]);
  // With a filter typed the marked sections have gaps in them, and a slice
  // over a gap would serve records the reader never saw.
  assert.deepEqual(passage.runsOf([4, 5, 9, 10, 20]),
    [{ from: 4, to: 5 }, { from: 9, to: 10 }, { from: 20, to: 20 }]);
  assert.deepEqual(passage.runsOf([]), []);
});

/* ══ RAW RECORD — THE BYTES, AND NOTHING DONE TO THEM ══════════════════════ */

interface Box {
  ws: Workspace;
  file: (session: string) => string;
  write: (session: string, lines: unknown[]) => void;
  scan: () => void;
  dispose: () => void;
}

function box(): Box {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-passage-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-passage-cwd-'));
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
    file,
    write: (session, lines) => {
      writeFileSync(file(session), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
    },
    scan: () => { rebuildConversations(dbPath, process.env, cwd); },
    dispose: () => {
      delete process.env['CLAUDE_CONFIG_DIR'];
      removeTree(home);
      removeTree(cwd);
    },
  };
}

const words = (t: string): unknown[] => [{ type: 'text', text: t }];

/**
 * Hebrew in the second record, deliberately.
 *
 * The slice is asked for in BYTES, and every offset after a multi-byte record
 * is wrong if anything on the path ever measured in decoded characters. The
 * outline's own offsets are byte offsets; this asserts the raw route agrees
 * with them across one.
 */
const SESSION: unknown[] = [
  { type: 'user', message: { role: 'user', content: 'first' }, timestamp: '2026-09-09T09:00:00.000Z' },
  { type: 'assistant', message: { role: 'assistant', content: words('קודם כול אקרא את המפרט') }, timestamp: '2026-09-09T09:00:01.000Z' },
  { type: 'attachment', attachment: { type: 'total_tokens_reminder' } },
  { type: 'user', message: { role: 'user', content: 'third' }, timestamp: '2026-09-09T09:00:02.000Z' },
];

test('the raw cap is one number, and the two files that spell it cannot drift', () => {
  // **A SECOND SPELLING OF ONE NUMBER, REPORTED RATHER THAN HIDDEN.** The
  // browser refuses an oversized passage before it asks, so it needs the cap;
  // the server refuses it again, so it needs the cap. The browser module is a
  // plain ES module the page loads with no build step and the route is
  // TypeScript, so neither can import the other and the duplicate is
  // structural rather than careless.
  //
  // What stops it drifting is this line, which is the same remedy
  // `conversation-follow-cadence.test.ts` gives `TIP_MS` and
  // `conversation-document.test.ts` gives the synthetic prefix lists: the copy
  // is allowed to exist and is not allowed to be silent.
  assert.equal(passage.PASSAGE_RAW_CAP, PASSAGE_RAW_CAP,
    'src/ui/public/lib/passage.js and src/ui/read-model-conversation-document.ts '
    + 'disagree about how big a raw copy may be');
  assert.equal(PASSAGE_RAW_CAP, 8 * 1024 * 1024);
});

test('the raw route is registered, so the third copy can actually be asked for', () => {
  registerReadRoutes();
  const paths = registeredRoutes().map((r) => `${r.method} ${r.path}`);
  assert.ok(paths.includes('GET /api/conversations/:id/raw'), paths.join('\n'));
});

test('a raw slice is the file’s own bytes over the records a passage covers', () => {
  const b = box();
  try {
    b.write('sess-raw', SESSION);
    b.scan();
    const outline = buildOutline(b.file('sess-raw'));
    const bytes = readFileSync(b.file('sess-raw'));

    // The passage is nodes 1..1 — one node past the Hebrew one — asked for the
    // way the screen asks: this node's offset, and the NEXT node's offset as
    // the end. Both numbers are the outline's own.
    const from = outline.nodes[1]!;
    const next = outline.nodes[2]!;
    const got = apiConversationRaw(
      b.ws,
      new URL(`http://localhost/api/conversations/sess-raw/raw?at=${from.o}&to=${next.o}`),
      { id: 'sess-raw' });
    assert.equal(got.status, 200);
    const body = got.body as { text: string; bytes: number; tooLong: boolean; present: boolean };

    assert.equal(body.present, true);
    assert.equal(body.tooLong, false);
    // BYTE-EXACT, compared against the file rather than against a
    // re-serialisation: "the JSONL exactly as created" is the claim, and a
    // `JSON.parse`/`stringify` round trip would lose key order and spacing
    // while passing a laxer assertion.
    assert.equal(body.text, bytes.subarray(from.o, next.o).toString('utf8'));
    assert.equal(body.bytes, next.o - from.o);

    // And it is whole records: every line parses, and there is no half line.
    const lines = body.text.split('\n').filter((l) => l !== '');
    assert.equal(lines.length, next.f - from.f, 'one line per record the nodes cover');
    for (const line of lines) assert.doesNotThrow(() => JSON.parse(line));
  } finally { b.dispose(); }
});

test('a passage that runs to the end of the document asks for no end at all', () => {
  const b = box();
  try {
    b.write('sess-raw-end', SESSION);
    b.scan();
    const outline = buildOutline(b.file('sess-raw-end'));
    const bytes = readFileSync(b.file('sess-raw-end'));
    const last = outline.nodes[outline.nodes.length - 1]!;

    const got = apiConversationRaw(
      b.ws, new URL(`http://localhost/api/conversations/sess-raw-end/raw?at=${last.o}`),
      { id: 'sess-raw-end' });
    const body = got.body as { text: string };
    assert.equal(body.text, bytes.subarray(last.o).toString('utf8'),
      'no `to` reads to whatever end-of-file is now — the file is still being written');
  } finally { b.dispose(); }
});

test('a slice longer than the cap is REFUSED, not cut — a half record is not a record', () => {
  const b = box();
  try {
    // **A REAL FILE OVER THE CAP, not a fabricated `to`.** An end past the end
    // of the file is CLAMPED to it, so a small fixture can never provoke this
    // branch — a test that passed `to=CAP+1` at a four-record session would
    // assert the clamp and report it as the refusal. So the file is actually
    // made bigger than the cap.
    assert.equal(PASSAGE_RAW_CAP, 8 * 1024 * 1024);
    const filler = 'x'.repeat(4096);
    const lines: unknown[] = [...SESSION];
    while (lines.length < 2200) {
      lines.push({
        type: 'user',
        message: { role: 'user', content: [{ type: 'tool_result', content: filler }] },
        timestamp: '2026-09-09T09:00:03.000Z',
      });
    }
    b.write('sess-raw-big', lines);
    b.scan();

    const wide = apiConversationRaw(
      b.ws,
      new URL(`http://localhost/api/conversations/sess-raw-big/raw?at=0&to=${PASSAGE_RAW_CAP + 1}`),
      { id: 'sess-raw-big' });
    assert.equal(wide.status, 200, 'a passage too big is a state, never an error');
    const body = wide.body as { tooLong: boolean; text: string; bytes: number; wanted: number };
    assert.equal(body.tooLong, true);
    assert.equal(body.text, '', 'nothing is served — a truncated JSONL is a broken JSONL');
    assert.equal(body.bytes, 0);
    assert.ok(body.wanted > PASSAGE_RAW_CAP, 'and it says how big the passage actually was');

    // A slice inside the cap on the same oversized file still answers, so the
    // refusal is about the SLICE and not about the file.
    const narrow = apiConversationRaw(
      b.ws, new URL('http://localhost/api/conversations/sess-raw-big/raw?at=0&to=200'),
      { id: 'sess-raw-big' });
    assert.equal((narrow.body as { tooLong: boolean }).tooLong, false);
  } finally { b.dispose(); }
});

test('the raw route refuses a parameter it cannot act on, and one that is not a number', () => {
  const b = box();
  try {
    b.write('sess-raw-bad', SESSION);
    b.scan();
    const call = (q: string) => apiConversationRaw(
      b.ws, new URL(`http://localhost/api/conversations/sess-raw-bad/raw${q}`),
      { id: 'sess-raw-bad' });
    assert.equal(call('?count=5').status, 400, 'a parameter this route does not take');
    assert.equal(call('?at=-1').status, 400);
    assert.equal(call('?at=0&to=lots').status, 400);
    assert.equal(call('?at=0&to=40').status, 200);
  } finally { b.dispose(); }
});

test('an offset past the end of a file that moved is an empty answer, not a crash', () => {
  const b = box();
  try {
    b.write('sess-raw-past', SESSION);
    b.scan();
    const got = apiConversationRaw(
      b.ws,
      new URL('http://localhost/api/conversations/sess-raw-past/raw?at=99999999&to=99999999'),
      { id: 'sess-raw-past' });
    assert.equal(got.status, 200);
    const body = got.body as { bytes: number; text: string; present: boolean };
    assert.equal(body.bytes, 0);
    assert.equal(body.text, '');
    assert.equal(body.present, true, 'the file is there — the passage is not');
  } finally { b.dispose(); }
});
