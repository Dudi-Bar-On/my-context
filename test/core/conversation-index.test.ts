/**
 * The conversation index and the scanner that rebuilds it from disk —
 * `plan:archive seq:1`.
 *
 * **What is worth proving here, and what is scaffolding for it.**
 *
 *   1. **The index is derived and never authoritative.** `a rebuild
 *      reconstructs the whole index from disk alone` deletes the database
 *      outright and rebuilds it, then asserts the rows are byte-for-byte the
 *      ones that were there before. That is the item's central claim — losing
 *      this index costs time and never knowledge — and it is the one property
 *      a comment cannot carry.
 *   2. **A capped answer and a complete one must not look the same.** `a
 *      transcript longer than the cap is scanned short AND SAYS SO` scans a
 *      real multi-record transcript under a deliberately tiny cap and asserts
 *      both halves: the counts really are floors, and `truncatedScan` really
 *      does report it. A test that only checked the counts would pass on a
 *      scanner that truncated silently, which is the failure
 *      `INV-nothing-is-dropped-silently` exists to forbid.
 *   3. **The read door cannot write.** `the read-only open refuses to create
 *      what it cannot find` asserts the never-scanned state arrives as its own
 *      class rather than as a built-and-empty index, in both directions.
 *
 * Everything runs against FIXTURES in a temp directory, never the developer's
 * own `~/.claude/projects`: `CLAUDE_CONFIG_DIR` is redirected per test, which
 * is the same variable the product honours and therefore the same code path a
 * real run takes. `test/helpers/real-home-guard.ts` would abort the run if
 * anything here reached the real home, and nothing here does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  ConversationIndex, ConversationIndexUninitializedError, listTranscriptFiles,
  projectDirName, rebuildConversations, scanTranscript, transcriptDir, truncatedScan,
} from '../../src/core/conversation-index.ts';
import { Store } from '../../src/core/store.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * A throwaway `~/.claude` plus a workspace cwd, wired the way the harness
 * wires the real one.
 *
 * The cwd is a REAL temp directory rather than a made-up string, because
 * `projectDirName` encodes whatever it is handed and a fixture built from a
 * fictional path would prove the encoding against itself.
 */
function fixture(): {
  env: Record<string, string | undefined>;
  cwd: string;
  dir: string;
  dbPath: string;
  write: (session: string, lines: unknown[]) => void;
  title: (session: string, custom: string) => void;
  dispose: () => void;
} {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-conv-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-conv-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const dbPath = path.join(cwd, 'index.db');
  // `Store.open` first, so the file is a real database with `schema_version`
  // in it before the conversation tables arrive — the arrangement a real
  // workspace is in, and the one that makes the "no pages at all" branch
  // distinguishable from the "no conversation tables yet" branch below.
  Store.open(dbPath).close();

  return {
    env: { CLAUDE_CONFIG_DIR: home },
    cwd,
    dir,
    dbPath,
    write: (session, lines) => {
      writeFileSync(
        path.join(dir, `${session}.jsonl`),
        lines.map((line) => JSON.stringify(line)).join('\n') + '\n',
      );
    },
    title: (session, custom) => {
      mkdirSync(path.join(dir, session), { recursive: true });
      writeFileSync(
        path.join(dir, session, 'custom-title.json'),
        JSON.stringify({ customTitle: custom }),
      );
    },
    dispose: () => {
      removeTree(home);
      removeTree(cwd);
    },
  };
}

/** A plausible session: one typed prompt, two spoken answers, two machinery records. */
const text = (t: string): unknown[] => [{ type: 'text', text: t }];
const CONVERSATION: unknown[] = [
  // A typed prompt: content is a plain string, the shape the harness writes
  // when nothing is attached.
  { type: 'user', message: { role: 'user', content: 'do the thing' }, timestamp: '2026-09-01T10:00:00.000Z', gitBranch: 'master', cwd: '/w' },
  { type: 'ai-title', aiTitle: 'first guess' },
  { type: 'assistant', message: { role: 'assistant', content: text('doing it') }, timestamp: '2026-09-01T10:00:01.000Z' },
  { type: 'attachment', timestamp: '2026-09-01T10:00:02.000Z' },
  // MACHINERY wearing role "user": a tool result, which nobody typed. This is
  // the record the spec's role-counting would have called a prompt.
  { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'ok' }] }, timestamp: '2026-09-01T10:00:03.000Z' },
  // MACHINERY wearing role "assistant": a tool call with no words in it.
  { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Read' }] }, timestamp: '2026-09-01T10:00:04.000Z' },
  { type: 'ai-title', aiTitle: 'what it turned out to be' },
  { type: 'assistant', message: { role: 'assistant', content: text('done') }, timestamp: '2026-09-01T10:00:05.000Z', gitBranch: 'feature' },
];

test('the project directory name is the harness\'s encoding, measured not assumed', () => {
  // Pinned against the real directory observed on this machine 2026-09-07:
  // `D:\Users\UserC\source\repos\my-context` is filed under this name, the
  // doubled hyphen being the drive colon and the separator in turn.
  assert.equal(
    projectDirName(String.raw`D:\Users\UserC\source\repos\my-context`),
    'D--Users-UserC-source-repos-my-context',
  );
  // A POSIX path, and a nested one, encode by the same rule.
  assert.equal(projectDirName('/home/u/src/app'), '-home-u-src-app');
  assert.equal(
    projectDirName(String.raw`C:\Users\U\AppData\Local\Temp\claude\probe`),
    'C--Users-U-AppData-Local-Temp-claude-probe',
  );
});

test('CLAUDE_CONFIG_DIR is honoured, and an empty value is treated as unset', () => {
  const home = path.join(tmpdir(), 'somewhere');
  assert.equal(
    transcriptDir({ CLAUDE_CONFIG_DIR: home }, '/w/x'),
    path.join(home, 'projects', '-w-x'),
  );
  // An exported-but-empty variable is not a directory — the same reading
  // `claudeSettingsPath` takes, and for the same reason: a reader that
  // honoured the empty string would look in `projects/` at the filesystem root.
  const unset = transcriptDir({ CLAUDE_CONFIG_DIR: '' }, '/w/x');
  assert.ok(unset.includes('.claude'), `an empty value should fall back to ~/.claude: ${unset}`);
});

test('only top-level .jsonl files are transcripts — never a recursive walk', () => {
  const box = fixture();
  try {
    box.write('a1', CONVERSATION);
    // The two subdirectories a real session directory carries. Measured on
    // this project 2026-09-07: `subagents/` held 493 MB across 414 files and
    // `tool-results/` 91 MB across 1,149, against 52 MB of actual transcript.
    // A recursive walk would read twelve times the bytes it wanted, and every
    // one of those files belongs to a different feature.
    mkdirSync(path.join(box.dir, 'a1', 'subagents'), { recursive: true });
    writeFileSync(
      path.join(box.dir, 'a1', 'subagents', 'agent-deadbeef.jsonl'),
      JSON.stringify({ type: 'user', message: { role: 'user' } }) + '\n',
    );
    mkdirSync(path.join(box.dir, 'memory'), { recursive: true });
    writeFileSync(path.join(box.dir, 'memory', 'MEMORY.md'), '# not a transcript\n');
    writeFileSync(path.join(box.dir, 'notes.txt'), 'not a transcript\n');

    const found = listTranscriptFiles(box.dir);
    assert.deepEqual(found.map((f) => f.sessionId), ['a1'],
      'a lane transcript under subagents/, a memory file and a .txt are all not this session\'s '
      + 'conversation. The spec rules lane activity out of this archive explicitly.');
  } finally { box.dispose(); }
});

test('a directory that is not there is an empty archive, never a throw', () => {
  assert.deepEqual(listTranscriptFiles(path.join(tmpdir(), 'myctx-conv-absent-xyz')), []);
});

test('the scanner counts prompts and answers off the role, and tolerates the rest', () => {
  const box = fixture();
  try {
    box.write('a1', CONVERSATION);
    const scan = scanTranscript(path.join(box.dir, 'a1.jsonl'));
    assert.equal(
      scan.prompts, 1,
      'ONE person typed once. The fixture holds two records with role "user" and the second is '
      + 'a tool_result — measured on the real 52 MB transcript, 2,504 of 2,954 role-"user" '
      + 'records are tool results, so role-counting reports 2,933 prompts where a person typed '
      + '450. That is the design spec being wrong on a fact, in the most prominent column '
      + 'the list screen has.',
    );
    assert.equal(scan.answers, 2, 'two assistant turns carry text; the tool_use one does not');
    assert.equal(scan.machinery, 2, 'the tool_result and the tool_use, counted rather than lost');
    assert.equal(
      scan.prompts + scan.answers + scan.machinery, 5,
      'every user/assistant record lands in exactly one of the three, so the two headline '
      + 'numbers can be checked against the total instead of believed',
    );
    assert.equal(scan.records, CONVERSATION.length, 'every record counts, known type or not');
    assert.equal(scan.unreadable, 0);
    assert.equal(scan.startedAt, '2026-09-01T10:00:00.000Z');
    assert.equal(scan.endedAt, '2026-09-01T10:00:05.000Z');
    assert.equal(scan.branch, 'feature', 'the branch it ENDED on, last writer wins');
    assert.equal(
      scan.aiTitle, 'what it turned out to be',
      'the LAST ai-title, not the first. Measured on the real transcript: 957 of these records '
      + 'in one file, because the model renames a session as it learns what it is about, so the '
      + 'first is the earliest guess and taking it would title every session from its opening '
      + 'minute.',
    );
  } finally { box.dispose(); }
});

test('a line that will not parse costs one row and never its neighbours', () => {
  const box = fixture();
  try {
    const file = path.join(box.dir, 'a1.jsonl');
    writeFileSync(file, [
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'hello' } }),
      '{ this is not json',
      '[]',
      JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'hi' }] } }),
      JSON.stringify({ type: 'a-type-this-build-has-never-heard-of' }),
    ].join('\n') + '\n');

    const scan = scanTranscript(file);
    assert.equal(scan.prompts, 1);
    assert.equal(scan.answers, 1, 'the record AFTER the damage is still counted');
    assert.equal(scan.unreadable, 2, 'the broken line and the non-object, each costing one');
    assert.equal(scan.records, 3, 'an unknown type is a record, not an error');
  } finally { box.dispose(); }
});

test('an unreadable file is a state the scanner returns, not one it throws', () => {
  const scan = scanTranscript(path.join(tmpdir(), 'myctx-conv-nothing-here.jsonl'));
  assert.equal(scan.scannedBytes, 0);
  assert.equal(scan.records, 0);
});

/**
 * **The bound, and the half a weaker test would miss.**
 *
 * Asserting only that the counts are lower under a cap would pass on a scanner
 * that truncated in silence. The disclosure is asserted in the same breath as
 * the loss, in both directions: capped rows say so and complete rows do not.
 */
test('a transcript longer than the cap is scanned short AND SAYS SO', () => {
  const box = fixture();
  try {
    const long = [];
    for (let i = 0; i < 400; i++) {
      long.push({ type: 'user', message: { role: 'user', content: 'ask' }, timestamp: `2026-09-01T10:00:00.${String(i).padStart(3, '0')}Z` });
      long.push({ type: 'assistant', message: { role: 'assistant', content: text('x'.repeat(200)) } });
    }
    box.write('big', long);
    box.write('small', CONVERSATION);

    const report = rebuildConversations(box.dbPath, box.env, box.cwd, { cap: 4096 });
    assert.deepEqual(report.truncated, ['big'], 'the capped session is NAMED, not merely counted');

    const index = ConversationIndex.openReadOnlyChecked(box.dbPath);
    try {
      const big = index.get('big');
      const small = index.get('small');
      assert.ok(big !== null && small !== null);

      assert.equal(truncatedScan(big), true);
      assert.ok(big.scannedBytes < big.bytes, 'the row carries the two numbers, not a flag alone');
      assert.ok(big.prompts < 400, `the counts really are floors: ${big.prompts}`);
      assert.ok(big.prompts > 0, 'and it really did read something');

      assert.equal(truncatedScan(small), false,
        'a complete row must NOT be marked. A capped answer and a complete one must not look '
        + 'the same, and that is a claim about both of them.');
      assert.equal(small.scannedBytes, small.bytes);
      assert.equal(small.prompts, 1, 'the small one is a total, not a floor');
    } finally { index.close(); }
  } finally { box.dispose(); }
});

test('the title is the harness\'s own override when there is one, and the model\'s otherwise', () => {
  const box = fixture();
  try {
    box.write('named', CONVERSATION);
    box.write('unnamed', CONVERSATION);
    box.write('titleless', [{ type: 'user', message: { role: 'user' } }]);
    // Measured on this project 2026-09-07: the harness already writes
    // `<session>/custom-title.json` when a user renames a session, holding
    // `{"customTitle":"MyContext V2.0"}`. That is what makes "overridable"
    // compatible with a viewer that cannot write.
    box.title('named', 'The night the archive landed');

    rebuildConversations(box.dbPath, box.env, box.cwd);
    const index = ConversationIndex.openReadOnlyChecked(box.dbPath);
    try {
      assert.equal(index.get('named')?.title, 'The night the archive landed');
      assert.equal(index.get('named')?.titleSource, 'custom');
      assert.equal(index.get('unnamed')?.title, 'what it turned out to be');
      assert.equal(index.get('unnamed')?.titleSource, 'ai');
      assert.equal(index.get('titleless')?.title, null,
        'nothing named it, so it has no name. NEVER the first prompt — the spec considered and '
        + 'rejected that, because first prompts are routinely "continue" or "ok go ahead".');
      assert.equal(index.get('titleless')?.titleSource, null);
    } finally { index.close(); }
  } finally { box.dispose(); }
});

/**
 * **The item's central claim, and the only test here that could not be
 * replaced by reading the code.**
 */
test('a rebuild reconstructs the whole index from disk alone', () => {
  const box = fixture();
  try {
    box.write('a1', CONVERSATION);
    box.write('a2', CONVERSATION.slice(0, 4));
    box.title('a1', 'kept');
    rebuildConversations(box.dbPath, box.env, box.cwd);

    const read = (): unknown => {
      const index = ConversationIndex.openReadOnlyChecked(box.dbPath);
      try {
        // `scannedAt` is when the scan ran and legitimately differs between
        // two rebuilds; everything else is a fact about the file and must not.
        return index.all().map(({ scannedAt: _ignored, ...rest }) => rest);
      } finally { index.close(); }
    };
    const before = read();

    // The whole database, destroyed — the corruption path `Store.open` takes,
    // and the state a user reaches by deleting `.index.db` because they were
    // told to.
    for (const suffix of ['', '-wal', '-shm']) rmSync(box.dbPath + suffix, { force: true });
    Store.open(box.dbPath).close();

    const report = rebuildConversations(box.dbPath, box.env, box.cwd);
    assert.equal(report.scanned, 2, 'nothing was skipped: there was no row to compare against');
    assert.deepEqual(read(), before,
      'the index is a cache of the transcripts and the transcripts are the source of truth. '
      + 'A rebuild that could not reproduce it would make losing this file cost knowledge '
      + 'rather than time, which is the property this item exists to guarantee.');
  } finally { box.dispose(); }
});

test('an unchanged transcript is skipped after one stat, and --full re-reads it', () => {
  const box = fixture();
  try {
    box.write('a1', CONVERSATION);
    const first = rebuildConversations(box.dbPath, box.env, box.cwd);
    assert.equal(first.scanned, 1);
    assert.ok(first.bytesRead > 0);

    const second = rebuildConversations(box.dbPath, box.env, box.cwd);
    assert.equal(second.skipped, 1);
    assert.equal(second.scanned, 0);
    assert.equal(second.bytesRead, 0, 'the file was never opened, only stat-ed');

    const forced = rebuildConversations(box.dbPath, box.env, box.cwd, { full: true });
    assert.equal(forced.scanned, 1);
    assert.ok(forced.bytesRead > 0);
  } finally { box.dispose(); }
});

test('a transcript that changed is re-read, because the fingerprint moved', () => {
  const box = fixture();
  try {
    box.write('a1', CONVERSATION);
    rebuildConversations(box.dbPath, box.env, box.cwd);
    box.write('a1', [...CONVERSATION, { type: 'user', message: { role: 'user', content: 'again' } }]);

    const again = rebuildConversations(box.dbPath, box.env, box.cwd);
    assert.equal(again.scanned, 1, 'the size differs, so the row is stale and is rebuilt');
    const index = ConversationIndex.openReadOnlyChecked(box.dbPath);
    try {
      assert.equal(index.get('a1')?.prompts, 2);
    } finally { index.close(); }
  } finally { box.dispose(); }
});

test('a pruned transcript drops its row, and the rebuild reports how many', () => {
  const box = fixture();
  try {
    box.write('a1', CONVERSATION);
    box.write('a2', CONVERSATION);
    rebuildConversations(box.dbPath, box.env, box.cwd);
    rmSync(path.join(box.dir, 'a2.jsonl'));

    const report = rebuildConversations(box.dbPath, box.env, box.cwd);
    assert.equal(report.removed, 1,
      'the harness prunes transcripts and the archive reads them in place, so a pruned session '
      + 'leaves. The count is REPORTED rather than swallowed: a rebuild that quietly shrank is '
      + 'exactly the silent loss INV-nothing-is-dropped-silently forbids.');
    const index = ConversationIndex.openReadOnlyChecked(box.dbPath);
    try {
      assert.deepEqual(index.all().map((r) => r.sessionId), ['a1']);
    } finally { index.close(); }
  } finally { box.dispose(); }
});

test('an empty archive is a measured zero and names where it looked', () => {
  const box = fixture();
  try {
    const report = rebuildConversations(box.dbPath, box.env, box.cwd);
    assert.equal(report.found, 0);
    assert.equal(report.dir, transcriptDir(box.env, box.cwd),
      'the directory is in the report even when it is empty, so "nothing here" can be told from '
      + '"looked in the wrong place" — which is the failure a changed harness encoding produces');
  } finally { box.dispose(); }
});

/**
 * **The read door, in both directions.** A door that reported damage as an
 * empty archive would be as wrong as one that refused to open against a fresh
 * corpus, and only asserting both catches either.
 */
test('the read-only open refuses to create what it cannot find', () => {
  const box = fixture();
  try {
    // A real database, with `schema_version` and `items` in it, and no
    // conversation tables: exactly a workspace where nobody has ever run the
    // rebuild. Its own class, so a caller never has to match on a message.
    assert.throws(
      () => ConversationIndex.openReadOnlyChecked(box.dbPath),
      ConversationIndexUninitializedError,
    );

    // And it really does open once the tables exist — so the throw above is
    // about the tables and not about the door being broken.
    rebuildConversations(box.dbPath, box.env, box.cwd);
    const index = ConversationIndex.openReadOnlyChecked(box.dbPath);
    index.close();

    // A file that is not a database at all is damage, and must NOT arrive as
    // the empty state. A zero-length file is a VALID empty SQLite database, so
    // absence of tables alone cannot tell the two apart.
    const empty = path.join(box.cwd, 'empty.db');
    writeFileSync(empty, '');
    assert.throws(() => ConversationIndex.openReadOnlyChecked(empty), (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.ok(!(err instanceof ConversationIndexUninitializedError),
        'a truncated file reported as "nothing has been scanned" is the exact confusion this '
        + 'door exists to prevent');
      assert.match(err.message, /no database pages/);
      return true;
    });
  } finally { box.dispose(); }
});

/**
 * **Found by driving the real CLI, not by reading the code.** `mycontext init`
 * writes no `.index.db`, so a freshly created workspace has no database file at
 * all — and the first draft answered `conversation list` there with SQLite's
 * own `unable to open database file`, which tells a reader nothing they can
 * act on and reads like damage.
 *
 * The absence is checked BEFORE the open for the reason the audit projection
 * gives: `SQLITE_CANTOPEN` is also what a permission failure raises, so
 * catching the error and calling it "empty" would report an unreadable
 * database as an empty archive.
 */
test('a workspace with no database at all is the empty state, not a SQLite sentence', () => {
  const missing = path.join(mkdtempSync(path.join(tmpdir(), 'myctx-conv-nodb-')), 'index.db');
  assert.throws(
    () => ConversationIndex.openReadOnlyChecked(missing),
    (err: unknown) => {
      assert.ok(err instanceof ConversationIndexUninitializedError,
        'a fresh workspace must reach the named empty state, not the driver\'s error');
      assert.doesNotMatch((err as Error).message, /unable to open/);
      return true;
    },
  );
});

test('the read-only open refuses a shape it does not read, because shape is the version', () => {
  const box = fixture();
  try {
    rebuildConversations(box.dbPath, box.env, box.cwd);

    // A future build's column, arriving in a database this build then opens.
    // These tables carry no `schema_version` — the choice is argued at
    // `CONVERSATION_SCHEMA` — so the shape is the only version there is, and a
    // read-only caller refuses rather than migrating.
    const db = new DatabaseSync(box.dbPath);
    db.exec('ALTER TABLE conversations ADD COLUMN invented TEXT');
    db.close();

    assert.throws(() => ConversationIndex.openReadOnlyChecked(box.dbPath), (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.ok(!(err instanceof ConversationIndexUninitializedError));
      assert.match(err.message, /shape is the only version/);
      return true;
    });
  } finally { box.dispose(); }
});
