// @basis TASK-the-archive-indexes-what-was-said-and-none-of-what-was-done,
// INV-nothing-is-dropped-silently, CONST-node-24-no-build-step,
// CONST-zero-runtime-dependencies
/**
 * **INDEXING WHAT WAS DONE** — `semantic/10`, and the owner's two words on
 * 2026-09-16: *"Index the tool calls"*.
 *
 * Until that day the archive indexed `text` blocks and nothing else: 3.3% of
 * this workspace's own characters, measured by
 * `scripts/measure-tool-indexing.ts`. `tool_use` — the commands, the paths, the
 * arguments — was dropped on the floor by ten lines in `proseOf`, and the
 * whole of *"what command did I run"*, *"which file did I touch"* and *"when
 * did I last run that script"* was unanswerable.
 *
 * ── WHAT IS WORTH PROVING HERE, AND WHY EACH ONE CAN FAIL ─────────────────
 *
 *   1. **A tool call is indexed at all, and it is indexed as its OWN KIND.**
 *      The fixture's tool call sits on a record `classifyTurn` calls
 *      `machinery` — the exact record the old walk `continue`d past — so an
 *      index that did not read it answers nothing.
 *   2. **The tool's NAME is in the text, not only its arguments.** A fixture
 *      that only ever searched for a path would pass on a renderer that threw
 *      the name away.
 *   3. **A record that SAYS something and then RUNS something is BOTH.** The
 *      two spans share a byte offset, which is the whole reason `hitKey`
 *      carries the kind — and the reason a half-built version of this feature
 *      would look like it worked: the said span would be shown and the ran
 *      span silently dropped as a duplicate.
 *   4. **`said` is the default, so nothing written before this change widened
 *      silently.** The anchor pass, the item-id lookups and the document find
 *      bar all pass no kind, and this pins what they get.
 *   5. **A `said` answer SAYS how much is in what he did not ask for.** A
 *      default that narrows without disclosing is a zero that reads as an
 *      answer about the archive — `INV-nothing-is-dropped-silently`.
 *   6. **The cap is per ARGUMENT, and it keeps the keys after the long one.**
 *      A cap on the block would spend its whole budget on a file body and lose
 *      the `file_path` that follows it, which is the one argument the reader
 *      was looking for.
 *   7. **`tool_result` is in NO index, at any scope.** This is an assertion of
 *      absence and it is the one the owner has not ruled on yet, so it is
 *      pinned: a lane that switched it on without his answer goes red here.
 *   8. **An empty set of kinds admits NOTHING.** It is the complement of "all
 *      three" and must not be read as "no scope given", which would turn the
 *      narrowest query into the widest.
 *
 * Everything runs against FIXTURES in a temp directory, never the developer's
 * own `~/.claude`: `CLAUDE_CONFIG_DIR` is redirected per test, which is the
 * variable the product honours and therefore the code path a real run takes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  ConversationIndex, PROSE_KINDS, RAN_KINDS, SAID_KINDS,
  projectDirName, rebuildConversations,
} from '../../src/core/conversation-index.ts';
import {
  TOOL_VALUE_CAP, UNINDEXED_BLOCKS, buildSearchIndex, kindsBesides, kindsOf,
  searchArchive, searchArchiveTiered, toolProseOf,
} from '../../src/core/conversation-search.ts';
import { Store } from '../../src/core/store.ts';
import { removeTree } from '../helpers/tmp.ts';

const SESSION = 'cccccccc-1111-2222-3333-444444444444';

/** A turn somebody took, in the shape the harness writes one. */
const say = (role: 'user' | 'assistant', text: string, at: string): unknown => ({
  type: role,
  message: { role, content: role === 'user' ? text : [{ type: 'text', text }] },
  timestamp: at,
  cwd: '/w',
});

/**
 * **A RECORD THAT ONLY CALLS A TOOL** — `classifyTurn` answers `machinery` for
 * it, and it is therefore the record the prose walk used to skip entirely.
 * Every assertion about `'ran'` rests on this shape rather than on a record
 * that also carried text, because a fixture that carried text would pass on a
 * build that still read only `text` blocks.
 */
const ran = (name: string, input: Record<string, unknown>, at: string): unknown => ({
  type: 'assistant',
  message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name, input }] },
  timestamp: at,
  cwd: '/w',
});

/** A record that says something AND calls a tool — one record, two readings. */
const saidAndRan = (
  text: string, name: string, input: Record<string, unknown>, at: string,
): unknown => ({
  type: 'assistant',
  message: {
    role: 'assistant',
    content: [
      { type: 'text', text },
      { type: 'tool_use', id: 'toolu_2', name, input },
    ],
  },
  timestamp: at,
  cwd: '/w',
});

/** A tool result — 67.0% of this archive's characters, and in no index. */
const printed = (text: string, at: string): unknown => ({
  type: 'user',
  message: { role: 'user', content: [{ type: 'tool_result', content: text }] },
  timestamp: at,
  cwd: '/w',
});

interface Fixture {
  env: Record<string, string | undefined>;
  cwd: string;
  dbPath: string;
  session: (rows: unknown[]) => void;
  dispose: () => void;
}

function fixture(): Fixture {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-ran-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-ran-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const dbPath = path.join(cwd, 'index.db');
  Store.open(dbPath).close();
  return {
    env: { CLAUDE_CONFIG_DIR: home },
    cwd,
    dbPath,
    session: (rows) => writeFileSync(
      path.join(dir, `${SESSION}.jsonl`),
      rows.map((r) => JSON.stringify(r)).join('\n') + '\n',
    ),
    dispose: () => { removeTree(home); removeTree(cwd); },
  };
}

/** Index the fixture and hand back an open index. The caller closes it. */
function indexed(f: Fixture): ConversationIndex {
  rebuildConversations(f.dbPath, f.env, f.cwd, {});
  const index = ConversationIndex.open(f.dbPath);
  buildSearchIndex(index);
  return index;
}

test('a record that only called a tool is indexed, as a span of its own kind', () => {
  const f = fixture();
  try {
    f.session([
      say('user', 'run the measurement please', '2026-09-16T10:00:00.000Z'),
      // Hebrew BEFORE the target, so a character offset and a byte offset
      // cannot be the same number from here on.
      say('assistant', 'מריץ את המדידה עכשיו', '2026-09-16T10:00:01.000Z'),
      ran('Bash', {
        command: 'node scripts/measure-tool-indexing.ts --sources 5',
        description: 'measure the cap curve',
      }, '2026-09-16T10:00:02.000Z'),
    ]);
    const index = indexed(f);
    try {
      // **THE ASSERTION.** The phrase lives in a `tool_use` input and nowhere
      // else in the transcript, on a record `classifyTurn` calls machinery.
      const found = searchArchive(index, 'measure-tool-indexing', { kind: RAN_KINDS });
      assert.equal(found.hits.length, 1, 'the command is in the index');
      assert.equal(found.hits[0]?.kind, 'ran', 'and it is a span of the new kind');
      assert.equal(found.hits[0]?.recordIndex, 2, 'the third record, 0-based');

      // AND IT IS NOT REACHABLE AS WHAT WAS SAID, which is the other half of
      // the kind being worth having.
      assert.equal(
        searchArchive(index, 'measure-tool-indexing', { kind: SAID_KINDS }).hits.length, 0,
        'a tool call is not something anybody said',
      );
    } finally { index.close(); }
  } finally { f.dispose(); }
});

test('the tool NAME is indexed, not only what it was given', () => {
  const f = fixture();
  try {
    f.session([
      say('user', 'go on', '2026-09-16T10:00:00.000Z'),
      // The name is `WebFetch` and NOTHING in the input repeats it, so only a
      // renderer that writes the name down can answer this.
      ran('WebFetch', { url: 'https://example.invalid/a', prompt: 'read the page' },
        '2026-09-16T10:00:01.000Z'),
    ]);
    const index = indexed(f);
    try {
      assert.equal(
        searchArchive(index, 'WebFetch', { kind: RAN_KINDS }).hits.length, 1,
        'the tool that ran is searchable by its own name',
      );
    } finally { index.close(); }
  } finally { f.dispose(); }
});

test('one record that says something and then runs something is BOTH, at one byte offset', () => {
  const f = fixture();
  try {
    f.session([
      say('user', 'what did you do', '2026-09-16T10:00:00.000Z'),
      // The word `periscope` is in the ANSWER and in the ARGUMENTS, so the two
      // spans are two hits for one query, at one offset.
      saidAndRan(
        'raising the periscope now',
        'Bash',
        { command: './periscope --up', description: 'raise it' },
        '2026-09-16T10:00:01.000Z',
      ),
    ]);
    const index = indexed(f);
    try {
      const both = searchArchiveTiered(index, 'periscope', { kind: PROSE_KINDS });
      assert.equal(both.hits.length, 2, 'the answer and the tool call are two hits');
      assert.deepEqual(
        both.hits.map((h) => h.kind).sort(), ['answer', 'ran'],
        'one of each kind, from one record',
      );
      // **THE OFFSETS ARE THE SAME, WHICH IS THE POINT.** A key over position
      // alone collapses the pair and drops the second without a word.
      assert.equal(
        new Set(both.hits.map((h) => h.byteOffset)).size, 1,
        'two spans, one seek target — they are two readings of one record',
      );

      // And each half is reachable alone.
      assert.equal(searchArchive(index, 'periscope', { kind: SAID_KINDS }).hits.length, 1);
      assert.equal(searchArchive(index, 'periscope', { kind: RAN_KINDS }).hits.length, 1);
    } finally { index.close(); }
  } finally { f.dispose(); }
});

test('a search that names no kind reads what was SAID, exactly as it did before', () => {
  const f = fixture();
  try {
    f.session([
      say('user', 'the harbour is quiet', '2026-09-16T10:00:00.000Z'),
      ran('Bash', { command: 'sail into the harbour' }, '2026-09-16T10:00:01.000Z'),
    ]);
    const index = indexed(f);
    try {
      // **THE DEFAULT IS THE COMPATIBILITY STORY.** `anchor-pass.ts`,
      // `retrieval/from-selection.ts` and `read-model-retrieval.ts` all pass no
      // kind; a default that had widened would have changed what every one of
      // them finds, silently.
      const found = searchArchive(index, 'harbour');
      assert.equal(found.hits.length, 1, 'only the prompt, not the command beside it');
      assert.equal(found.hits[0]?.kind, 'prompt');

      const tiered = searchArchiveTiered(index, 'harbour');
      assert.deepEqual(tiered.kinds, [...SAID_KINDS], 'and the answer says which kinds it read');

      // **AND THE SPAN READER ITSELF.** `findInDocument` counts what
      // `proseSpans` hands back and the document screen prints that count as
      // *"the N turns of WORDS this transcript has"*. A default that widened
      // here would make a shipped sentence false without touching the screen.
      assert.deepEqual(
        index.proseSpans({}).map((s) => s.kind), ['prompt'],
        'the unscoped span reader still reads turns of words only',
      );
    } finally { index.close(); }
  } finally { f.dispose(); }
});

test('a said answer counts what is in what was RUN, so a zero cannot read as an absence', () => {
  const f = fixture();
  try {
    f.session([
      say('user', 'nothing here mentions it', '2026-09-16T10:00:00.000Z'),
      ran('Bash', { command: 'node scripts/periscope.ts' }, '2026-09-16T10:00:01.000Z'),
      ran('Bash', { command: 'node scripts/periscope.ts --again' }, '2026-09-16T10:00:02.000Z'),
    ]);
    const index = indexed(f);
    try {
      const said = searchArchiveTiered(index, 'periscope');
      assert.equal(said.hits.length, 0, 'nothing was SAID about it');
      // **THE LINE THAT MAKES THAT ZERO HONEST.**
      assert.deepEqual(said.elsewhere, { kinds: ['ran'], matched: 2 });

      // And when everything was asked for, there is nothing left out to say.
      const all = searchArchiveTiered(index, 'periscope', { kind: PROSE_KINDS });
      assert.equal(all.elsewhere, null, 'a query over all three kinds leaves nothing out');
      assert.equal(all.hits.length, 2);
    } finally { index.close(); }
  } finally { f.dispose(); }
});

test('the cap is on one ARGUMENT, so the keys after a long one survive it', () => {
  const f = fixture();
  try {
    const body = 'x'.repeat(TOOL_VALUE_CAP) + ' beyondthecapmarker';
    f.session([
      say('user', 'write the file', '2026-09-16T10:00:00.000Z'),
      // `content` FIRST and `file_path` after it. A cap on the BLOCK spends
      // its whole budget here and loses the path, which is the one argument
      // *"which file did I touch"* is about.
      ran('Write', { content: body, file_path: '/w/src/periscope.ts' },
        '2026-09-16T10:00:01.000Z'),
    ]);
    const index = indexed(f);
    try {
      assert.equal(
        searchArchive(index, 'periscope.ts', { kind: RAN_KINDS }).hits.length, 1,
        'the path after the long argument is indexed',
      );
      assert.equal(
        searchArchive(index, 'beyondthecapmarker', { kind: RAN_KINDS }).hits.length, 0,
        'and what lay past the cap is not',
      );
    } finally { index.close(); }

    // The cut is VISIBLE in the text, not silent.
    const rendered = toolProseOf({
      message: { content: [{ type: 'tool_use', name: 'Write', input: { content: body } }] },
    });
    assert.ok(rendered.endsWith('…'), 'a clipped value says it was clipped');
    assert.ok(rendered.length < body.length, 'and it is shorter than what it clipped');
  } finally { f.dispose(); }
});

test('what a command PRINTED is in no index, at any scope, and every answer says so', () => {
  const f = fixture();
  try {
    f.session([
      say('user', 'run it', '2026-09-16T10:00:00.000Z'),
      ran('Bash', { command: 'node --test' }, '2026-09-16T10:00:01.000Z'),
      printed('ok 1 - the periscope test passed', '2026-09-16T10:00:02.000Z'),
    ]);
    const index = indexed(f);
    try {
      // **AN ASSERTION OF ABSENCE, PINNED DELIBERATELY.** The owner has the
      // measurement and has not ruled; a lane that switches `tool_result` on
      // without his answer goes red here rather than shipping quietly.
      for (const kind of [SAID_KINDS, RAN_KINDS, PROSE_KINDS]) {
        assert.equal(
          searchArchive(index, 'periscope test passed', { kind }).hits.length, 0,
          `tool_result is not indexed under ${kind.join('/')}`,
        );
      }
      assert.deepEqual([...UNINDEXED_BLOCKS], ['tool_result', 'thinking'],
        'and the surfaces are told exactly what they cannot find');
    } finally { index.close(); }
  } finally { f.dispose(); }
});

test('an empty set of kinds admits nothing, and is not read as no scope at all', () => {
  const f = fixture();
  try {
    f.session([
      say('user', 'the harbour is quiet', '2026-09-16T10:00:00.000Z'),
      ran('Bash', { command: 'sail into the harbour' }, '2026-09-16T10:00:01.000Z'),
    ]);
    const index = indexed(f);
    try {
      assert.equal(
        searchArchive(index, 'harbour', { kind: [] }).hits.length, 0,
        'the complement of all three matches nothing',
      );
      assert.equal(index.countProse('"harbour"', { kind: [] }), 0,
        'and the count agrees with the query it discloses a bound on');
      assert.equal(index.proseSpans({ kind: [] }).length, 0);
      // The same query with the scope OPEN finds both, so the zero above is
      // the scope and not the fixture.
      assert.equal(searchArchive(index, 'harbour', { kind: PROSE_KINDS }).hits.length, 2);
    } finally { index.close(); }
  } finally { f.dispose(); }
});

test('the reader word and the stored kinds are one mapping, and the complement is its inverse', () => {
  assert.deepEqual([...kindsOf('said')], ['prompt', 'answer']);
  assert.deepEqual([...kindsOf('ran')], ['ran']);
  assert.deepEqual([...kindsOf('both')], ['prompt', 'answer', 'ran']);
  assert.deepEqual([...kindsBesides(kindsOf('said'))], ['ran']);
  assert.deepEqual([...kindsBesides(kindsOf('ran'))], ['prompt', 'answer']);
  assert.deepEqual([...kindsBesides(kindsOf('both'))], []);
});
