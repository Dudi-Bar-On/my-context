// @basis TASK-search-the-archive-properly-and-mark-the-anchors-you-want-to,
// INV-nothing-is-dropped-silently, CONST-zero-runtime-dependencies
/**
 * **An FTS5 index over the archive's prose** — `plan:recall seq:1`, Task 1 of
 * `docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md`.
 *
 * What is worth proving here, and what is scaffolding for it.
 *
 *   1. **A hit carries a BYTE offset that really is a seek target.** `a phrase
 *      is found, and its byte offset seeks straight to the record it came
 *      from` does not compare the offset against a remembered number — it
 *      OPENS the transcript at the offset the hit reports and parses the line
 *      that starts there. An offset that is merely plausible fails.
 *   2. **Hebrew is found the way Hebrew is written.** `Hebrew is found, and a
 *      prefixed form is found by its stem` searches `שורה` and expects
 *      `השורה`. That is the whole reason the tokenizer is `trigram` and not
 *      `unicode61`, and it was measured on this project's own corpus,
 *      2026-09-11, over its 298 lane transcripts and 2 sessions:
 *
 *          query      unicode61   trigram
 *          שורה  in השורה      3        11
 *          תוך   in מתוך       0        14
 *          שרה   in עשרה       0         8
 *
 *      A word-boundary tokenizer is not wrong in general; it is wrong for a
 *      language that glues ו/ה/ב/כ/ל/מ/ש onto the front of a word, and this
 *      corpus is Hebrew from record 5.
 *   3. **Only prose is indexed, and the gate is `classifyTurn`.** `a record
 *      classifyTurn calls machinery is not indexed, even when it carries text`
 *      plants a `system` record whose content IS a `text` block — so the
 *      extractor would happily read it and only the classification keeps it
 *      out. A fixture whose machinery carried no text would pass on a build
 *      with no filter at all, which is the assertion-that-cannot-fail this
 *      project has shipped twice.
 *   4. **A query that cannot match SAYS SO.** `a query too short for the
 *      tokenizer is reported, not answered with silence` pins the one cost
 *      trigram charges: a term under three characters matches nothing, ever,
 *      and an empty list would be indistinguishable from "no such phrase".
 *      `INV-nothing-is-dropped-silently`.
 *   5. **The reader's text is data, not query syntax.** `a query containing
 *      FTS5 syntax is matched literally` types the characters FTS5 reserves.
 *      Unescaped they are a thrown `fts5: syntax error`, on a search box.
 *   6. **A new table is a new schema version.** `an index built before the
 *      prose tables is OLD, not damaged` asserts the repairable class and the
 *      heal, which is the rule `plan:archive seq:12`/`seq:33` established and
 *      this build inherits rather than re-decides.
 *
 * Everything runs against FIXTURES in a temp directory, never the developer's
 * own `~/.claude`: `CLAUDE_CONFIG_DIR` is redirected per test, which is the
 * variable the product honours and therefore the code path a real run takes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, openSync, closeSync, readSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  ConversationIndex, ConversationIndexIncompleteError, projectDirName, rebuildConversations,
} from '../../src/core/conversation-index.ts';
import {
  MIN_QUERY_CHARS, buildSearchIndex, searchArchive,
} from '../../src/core/conversation-search.ts';
import { Store } from '../../src/core/store.ts';
import { removeTree } from '../helpers/tmp.ts';

const SESSION = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

/** A `.jsonl` line, in the shape the harness writes one. */
const say = (role: 'user' | 'assistant', text: string, at: string): unknown => ({
  type: role,
  message: { role, content: role === 'user' ? text : [{ type: 'text', text }] },
  timestamp: at,
  cwd: '/w',
  gitBranch: 'master',
});

/**
 * A record `classifyTurn` calls machinery that nevertheless CARRIES a `text`
 * block — the shape that makes assertion 3 able to fail. `system` is one of
 * the nine types measured in a real transcript that this build had never heard
 * of when the scanner was written.
 */
const machineryWithText = (text: string, at: string): unknown => ({
  type: 'system',
  message: { role: 'assistant', content: [{ type: 'text', text }] },
  timestamp: at,
});

/** A tool result: machinery, and the 65.5% of `tool_result` bytes the plan routes away. */
const toolResult = (text: string, at: string): unknown => ({
  type: 'user',
  message: { role: 'user', content: [{ type: 'tool_result', content: text }] },
  timestamp: at,
});

function fixture(): {
  env: Record<string, string | undefined>;
  cwd: string;
  dir: string;
  dbPath: string;
  file: (session?: string) => string;
  session: (rows: unknown[], session?: string) => void;
  append: (rows: unknown[], session?: string) => void;
  lane: (agentId: string, meta: unknown, rows: unknown[]) => void;
  dispose: () => void;
} {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-search-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-search-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const dbPath = path.join(cwd, 'index.db');
  Store.open(dbPath).close();

  const lines = (rows: unknown[]): string =>
    rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
  const file = (session = SESSION): string => path.join(dir, `${session}.jsonl`);

  return {
    env: { CLAUDE_CONFIG_DIR: home },
    cwd,
    dir,
    dbPath,
    file,
    session: (rows, session = SESSION) => writeFileSync(file(session), lines(rows)),
    append: (rows, session = SESSION) => appendFileSync(file(session), lines(rows)),
    lane: (agentId, meta, rows) => {
      const laneDir = path.join(dir, SESSION, 'subagents');
      mkdirSync(laneDir, { recursive: true });
      writeFileSync(path.join(laneDir, `${agentId}.jsonl`), lines(rows));
      if (meta !== null) {
        writeFileSync(path.join(laneDir, `${agentId}.meta.json`), JSON.stringify(meta));
      }
    },
    dispose: () => {
      removeTree(home);
      removeTree(cwd);
    },
  };
}

/** Read one line of a transcript starting at a byte offset, the way a seek would. */
function lineAt(file: string, at: number): Record<string, unknown> {
  const fd = openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(64 * 1024);
    const read = readSync(fd, buffer, 0, buffer.length, at);
    const view = buffer.subarray(0, read);
    const nl = view.indexOf(0x0a);
    return JSON.parse((nl === -1 ? view : view.subarray(0, nl)).toString('utf8'));
  } finally {
    closeSync(fd);
  }
}

/** Index the fixture and hand back an open index. The caller closes it. */
function indexed(f: ReturnType<typeof fixture>): ConversationIndex {
  rebuildConversations(f.dbPath, f.env, f.cwd, {});
  const index = ConversationIndex.open(f.dbPath);
  buildSearchIndex(index);
  return index;
}

test('a phrase is found, and its byte offset seeks straight to the record it came from', () => {
  const f = fixture();
  try {
    f.session([
      say('user', 'open the archive', '2026-09-01T10:00:00.000Z'),
      // Hebrew BEFORE the target, so a character offset and a byte offset
      // cannot possibly be the same number from here on. The corpus is Hebrew
      // from record 5 and this is the fixture saying so.
      say('assistant', 'הארכיון נפתח ועכשיו אפשר לחפש בו', '2026-09-01T10:00:01.000Z'),
      say('assistant', 'the periscope is raised over the harbour', '2026-09-01T10:00:02.000Z'),
    ]);
    const index = indexed(f);
    try {
      const found = searchArchive(index, 'periscope');
      assert.equal(found.searchable, true);
      assert.equal(found.hits.length, 1, 'one record carries the phrase, so one hit');

      const hit = found.hits[0]!;
      assert.equal(hit.sessionId, SESSION);
      assert.equal(hit.recordIndex, 2, 'the third record of the transcript, 0-based');

      // **THE ASSERTION THAT MAKES THE OFFSET A FACT.** Not "the number looks
      // right" — the file is opened AT it and the line that starts there is
      // parsed. A character offset would land mid-record here, because the
      // record above it is Hebrew.
      const record = lineAt(f.file(), hit.byteOffset);
      assert.equal(
        (record.message as { content: { text: string }[] }).content[0]!.text,
        'the periscope is raised over the harbour',
        'the byte offset is a seek target, not a description of one',
      );

      assert.match(hit.snippet, /periscope/, 'and the hit shows the reader what matched');
    } finally {
      index.close();
    }
  } finally {
    f.dispose();
  }
});

test('Hebrew is found, and a prefixed form is found by its stem', () => {
  const f = fixture();
  try {
    f.session([
      say('user', 'תתעד את זה', '2026-09-01T10:00:00.000Z'),
      // `השורה` — the definite article glued to `שורה`. A word-boundary
      // tokenizer indexes one token and a reader searching the stem gets
      // nothing; measured on this project's corpus, 3 hits against 11.
      say('assistant', 'השורה הזאת נכתבה בעברית', '2026-09-01T10:00:01.000Z'),
    ]);
    const index = indexed(f);
    try {
      const whole = searchArchive(index, 'השורה');
      assert.equal(whole.hits.length, 1, 'the word as written is found');

      const stem = searchArchive(index, 'שורה');
      assert.equal(
        stem.hits.length, 1,
        'and so is the STEM inside it — the property `trigram` has and `unicode61` does not, '
        + 'which is the whole reason this index is not tokenized on word boundaries',
      );
      assert.equal(stem.hits[0]!.recordIndex, 1);
    } finally {
      index.close();
    }
  } finally {
    f.dispose();
  }
});

test('a record classifyTurn calls machinery is not indexed, even when it carries text', () => {
  const f = fixture();
  try {
    f.session([
      say('user', 'begin the run', '2026-09-01T10:00:00.000Z'),
      // Both of these carry the word. One is a `text` block on a `system`
      // record, which an extractor reads happily — so the ONLY thing that can
      // keep it out of the index is the classification.
      machineryWithText('zarquonium was reported by the harness', '2026-09-01T10:00:01.000Z'),
      toolResult('zarquonium printed by a command', '2026-09-01T10:00:02.000Z'),
    ]);
    const index = indexed(f);
    try {
      const found = searchArchive(index, 'zarquonium');
      assert.equal(found.searchable, true, 'the query itself is long enough to match');
      assert.equal(
        found.hits.length, 0,
        'machinery is not prose. `classifyTurn` already does the 99% reduction in thirteen '
        + 'lines and this index reuses it rather than defining noise a second time.',
      );
      // And the same transcript's real prose IS indexed, so the zero above is
      // a filter working rather than an index that was never built.
      assert.equal(searchArchive(index, 'begin the run').hits.length, 1, 'the typed prompt is there');
    } finally {
      index.close();
    }
  } finally {
    f.dispose();
  }
});

test('a query too short for the tokenizer is reported, not answered with silence', () => {
  const f = fixture();
  try {
    f.session([
      say('user', 'the UI is on the screen', '2026-09-01T10:00:00.000Z'),
    ]);
    const index = indexed(f);
    try {
      const found = searchArchive(index, 'UI');
      assert.equal(
        found.searchable, false,
        'a trigram index cannot match a term under three characters AT ALL — measured: '
        + '`"ui"` returns 0 rows over a corpus in which the word is everywhere. Returning an '
        + 'empty list would make "cannot be searched" look exactly like "not in the archive".',
      );
      assert.equal(found.hits.length, 0);
      assert.match(
        String(found.note), new RegExp(String(MIN_QUERY_CHARS)),
        'and the note says what the bound IS, so the reader can act on it',
      );

      // The same phrase, long enough, really is in there — so the refusal
      // above is a bound being reported and not an empty index.
      assert.equal(searchArchive(index, 'screen').hits.length, 1);
    } finally {
      index.close();
    }
  } finally {
    f.dispose();
  }
});

test('a query containing FTS5 syntax is matched literally, not parsed', () => {
  const f = fixture();
  try {
    f.session([
      say('assistant', 'the OR gate "quoted" (parenthesised) and NEAR it', '2026-09-01T10:00:00.000Z'),
      say('assistant', 'a gate with nothing else about it', '2026-09-01T10:00:01.000Z'),
    ]);
    const index = indexed(f);
    try {
      // Every character here is FTS5 query syntax. Unescaped this is
      // `fts5: syntax error near "("` thrown out of a search box.
      const found = searchArchive(index, 'OR gate "quoted" (parenthesised)');
      assert.equal(found.searchable, true);
      assert.equal(
        found.hits.length, 1,
        'the reader typed a phrase, so it is matched as a phrase — the second record holds the '
        + 'word `gate` and is correctly NOT a hit',
      );
      assert.equal(found.hits[0]!.recordIndex, 0);
    } finally {
      index.close();
    }
  } finally {
    f.dispose();
  }
});

test('search narrows to one session, and the archive-wide answer is wider', () => {
  const f = fixture();
  const other = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';
  try {
    f.session([say('assistant', 'the periscope is up', '2026-09-01T10:00:00.000Z')]);
    f.session([say('assistant', 'a second periscope entirely', '2026-09-02T10:00:00.000Z')], other);
    const index = indexed(f);
    try {
      assert.equal(
        searchArchive(index, 'periscope').hits.length, 2,
        'the default scope is THIS WORKSPACE, all its sessions — spec §12',
      );
      const scoped = searchArchive(index, 'periscope', { sessionId: other });
      assert.equal(scoped.hits.length, 1, 'and a session narrows it');
      assert.equal(scoped.hits[0]!.sessionId, other);
    } finally {
      index.close();
    }
  } finally {
    f.dispose();
  }
});

test('a lane\'s prose is indexed too, and the hit names the lane', () => {
  const f = fixture();
  try {
    f.session([say('user', 'dispatch it', '2026-09-01T10:00:00.000Z')]);
    f.lane('agent-one', { toolUseId: 'toolu_A', spawnDepth: 1 }, [
      say('assistant', 'the lane reported a periscope', '2026-09-01T10:00:01.000Z'),
    ]);
    const index = indexed(f);
    try {
      const found = searchArchive(index, 'periscope');
      assert.equal(
        found.hits.length, 1,
        'the archive is mostly lanes — 298 against 2 sessions on this workspace, measured '
        + '2026-09-11 — so an index that read only session transcripts would search almost '
        + 'nothing',
      );
      assert.equal(found.hits[0]!.agentId, 'agent-one', 'and the hit says WHICH lane');
      assert.equal(found.hits[0]!.sessionId, SESSION, 'under the session that dispatched it');
    } finally {
      index.close();
    }
  } finally {
    f.dispose();
  }
});

test('re-indexing an unchanged transcript reads nothing, and a grown one is caught up by its tail', () => {
  const f = fixture();
  try {
    f.session([say('assistant', 'the periscope is up', '2026-09-01T10:00:00.000Z')]);
    rebuildConversations(f.dbPath, f.env, f.cwd, {});
    const index = ConversationIndex.open(f.dbPath);
    try {
      const first = buildSearchIndex(index);
      assert.equal(first.indexed, 1);
      assert.equal(first.spans, 1);

      const second = buildSearchIndex(index);
      assert.equal(second.skipped, 1, 'size and mtime both matched');
      assert.equal(second.bytesRead, 0, 'and NOTHING was read');

      // **A FULL re-index REPLACES what a source contributed.** The assertion
      // this replaces was made after the cheap run above and could not fail:
      // a run that reads nothing writes nothing, so it passed on a build with
      // no de-duplication at all. This one reads the transcript again, which
      // is the only path on which duplication is possible.
      const forced = buildSearchIndex(index, { full: true });
      assert.equal(forced.indexed, 1, '`full` re-reads rather than skipping');
      assert.equal(
        searchArchive(index, 'periscope').hits.length, 1,
        'and the span was not written twice — an index that added instead of replacing would '
        + 'grow without bound under a refresh that runs every turn',
      );

      f.append([say('assistant', 'a later bathyscaphe', '2026-09-01T10:05:00.000Z')]);
      rebuildConversations(f.dbPath, f.env, f.cwd, {});
      const third = buildSearchIndex(index);
      assert.equal(third.appended, 1, 'a transcript ONLY APPENDS, so the tail is all there is to read');
      assert.equal(third.spans, 1, 'one new span');
      const tail = searchArchive(index, 'bathyscaphe');
      assert.equal(tail.hits.length, 1);
      assert.equal(
        tail.hits[0]!.recordIndex, 1,
        'and the appended record keeps counting from where the last scan stopped, rather than '
        + 'restarting at 0 — an index whose ordinals reset would point a reader at the wrong turn',
      );
      const record = lineAt(f.file(), tail.hits[0]!.byteOffset);
      assert.equal(
        (record.message as { content: { text: string }[] }).content[0]!.text,
        'a later bathyscaphe',
        'and its byte offset is still a seek target into the whole file',
      );
    } finally {
      index.close();
    }
  } finally {
    f.dispose();
  }
});

test('an index built before the prose tables is OLD, not damaged, and a rebuild heals it', () => {
  const f = fixture();
  try {
    f.session([say('assistant', 'the periscope is up', '2026-09-01T10:00:00.000Z')]);
    const index = indexed(f);
    index.close();

    // Put the database back into the shape EVERY EXISTING WORKSPACE is in the
    // moment this ships: `conversations` present, the prose tables never
    // created.
    const raw = new DatabaseSync(f.dbPath);
    raw.exec('DROP TABLE conversation_prose');
    raw.exec('DROP TABLE prose_sources');
    raw.close();

    assert.throws(
      () => ConversationIndex.openReadOnlyChecked(f.dbPath).close(),
      (err: unknown) => {
        assert.ok(
          err instanceof ConversationIndexIncompleteError,
          'a new table is a new schema version by this index\'s own rule, and an older shape is '
          + 'REPAIRABLE rather than damage — `plan:archive seq:12`/`seq:33`. Reporting it as '
          + 'damage stops `stopConversationRefresh`, which is the only writer that would have '
          + 'created the tables.',
        );
        assert.deepEqual(
          [...err.missing].sort(), ['conversation_prose', 'prose_sources'],
          'and it NAMES what is missing',
        );
        return true;
      },
    );

    // THE HEAL. A write path creates the tables and the spans come back from
    // the transcript on disk, which is the property that makes this index
    // disposable in the first place.
    rebuildConversations(f.dbPath, f.env, f.cwd, {});
    const healed = ConversationIndex.open(f.dbPath);
    try {
      buildSearchIndex(healed);
      assert.equal(searchArchive(healed, 'periscope').hits.length, 1);
    } finally {
      healed.close();
    }
    ConversationIndex.openReadOnlyChecked(f.dbPath).close();
  } finally {
    f.dispose();
  }
});

test('a session whose transcript is gone loses its prose, and the removal is counted', () => {
  const f = fixture();
  const other = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';
  try {
    f.session([say('assistant', 'the periscope is up', '2026-09-01T10:00:00.000Z')]);
    f.session([say('assistant', 'a second periscope entirely', '2026-09-02T10:00:00.000Z')], other);
    const index = indexed(f);
    try {
      assert.equal(searchArchive(index, 'periscope').hits.length, 2);

      // The harness prunes one transcript; `removeMissing` drops its row.
      removeTree(f.file(other));
      rebuildConversations(f.dbPath, f.env, f.cwd, {});
      const report = buildSearchIndex(index);
      assert.equal(
        report.removed, 1,
        'knowledge leaving the archive is COUNTED, never quietly shrunk — '
        + '`INV-nothing-is-dropped-silently`',
      );
      const left = searchArchive(index, 'periscope');
      assert.equal(left.hits.length, 1, 'and the pruned session\'s prose is gone with its row');
      assert.equal(left.hits[0]!.sessionId, SESSION);
    } finally {
      index.close();
    }
  } finally {
    f.dispose();
  }
});
