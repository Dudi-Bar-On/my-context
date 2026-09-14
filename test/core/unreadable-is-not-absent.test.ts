// @basis TASK-one-unreadable-transcript-directory-empties-the-conversation, TASK-a-transient-read-error-permanently-breaks-a-conversation, TASK-unreadable-is-collapsed-into-absent-and-the-next-message, INV-nothing-is-dropped-silently, STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is
/**
 * **Three places where a file that WOULD NOT ANSWER was read as a file that IS
 * NOT THERE, and the sentence after it asserted the absence.**
 *
 * The distinction is not pedantic in any of the three: *not there* is the
 * state each of these mechanisms exists to act on, so collapsing into it
 * triggers the most destructive branch each one has.
 *
 * ── WHAT WAS REPRODUCED, AND WHERE THE ONE GAP IS ──────────────────────────
 *
 * All three were reproduced on throwaway workspaces on 2026-09-14 before a
 * line was changed, by putting a DIRECTORY where a file belongs — a path that
 * stats, is not a file, and cannot be opened as one:
 *
 *     transcript directory unreadable   2 indexed sessions -> 0, removed=2,
 *                                       and the row said "2 indexed session(s)
 *                                       no longer on disk"
 *     transcript unreadable             archive row 'persisted' -> 'exported',
 *                                       reported as "the transcript is gone"
 *     mirror unreadable                 THE OWNER'S PERSIST MARK DELETED,
 *                                       row -> 'live', "the copy is gone"
 *
 * **THE ONE GAP, stated rather than papered over.** A permission refusal
 * (EACCES) could NOT be induced on this machine: `icacls /deny` applied
 * cleanly and the file stayed readable for the account this suite runs as,
 * verified directly on 2026-09-14. So the `catch` inside
 * `conversation-mirror.ts` · `sizeOf` — the branch that separates a `statSync`
 * that THREW `ENOENT` from one that threw anything else — has no case here,
 * because a directory-in-place-of-a-file makes `statSync` SUCCEED and is
 * caught one line later by the `isFile()` test instead. Measured by removal:
 * collapsing that catch's two outcomes into one leaves every test in this file
 * green. The `isFile()` half is proved, the `catch` half is not, and the
 * difference is a platform limit rather than an oversight.
 *
 * `stillPrefix`' third answer has no such gap: a copy truncated below the
 * agreed length makes `windowEndingAt` come up SHORT, which is the same `null`
 * a refused read produces, and that case is exercised below.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import {
  ConversationIndex, listTranscriptFiles, readTranscriptDir, rebuildConversations, transcriptDir,
} from '../../src/core/conversation-index.ts';
import { advanceMirrors, persistSession } from '../../src/core/conversation-mirror.ts';
import { readSnapshotMeta, snapshotPath, writeSnapshot } from '../../src/core/ledger.ts';
import { recordPostCompact } from '../../src/hooks/post-compact.ts';
import { readAudit } from '../../src/core/audit.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

function transcriptRow(role: 'user' | 'assistant', text: string): string {
  return JSON.stringify({
    type: role, timestamp: new Date().toISOString(),
    message: { role, content: text },
  });
}

interface Box {
  base: string; cwd: string; env: Record<string, string | undefined>;
  dir: string; dbPath: string;
}

function box(name: string): Box {
  const base = mkdtempSync(path.join(tmpdir(), `myctx-unreadable-${name}-`));
  const cwd = path.join(base, 'proj');
  mkdirSync(cwd, { recursive: true });
  const env = {
    CLAUDE_CONFIG_DIR: path.join(base, 'claude'),
    MYCONTEXT_MIRROR_DIR: path.join(base, 'mirrors'),
  };
  const dir = transcriptDir(env, cwd);
  mkdirSync(dir, { recursive: true });
  return { base, cwd, env, dir, dbPath: path.join(base, 'index.db') };
}

function writeTranscript(b: Box, sessionId: string): string {
  const file = path.join(b.dir, `${sessionId}.jsonl`);
  writeFileSync(
    file,
    `${transcriptRow('user', 'hello')}\n${transcriptRow('assistant', 'hi')}\n`,
    'utf8',
  );
  return file;
}

/**
 * **Make a FILE unanswerable** by putting a directory in its place: `statSync`
 * succeeds, `isFile()` is false, and `openSync` cannot read it as a file.
 *
 * The obstruction is proved rather than assumed — the first draft of this
 * helper did `rmSync` then `mkdirSync` on a DIRECTORY target, which simply
 * re-created an empty readable directory, and two tests went green while
 * measuring nothing.
 */
function makeFileUnreadable(target: string): void {
  removeTree(target);
  mkdirSync(target, { recursive: true });
  let threw = false;
  try { writeFileSync(target, 'x', 'utf8'); } catch { threw = true; }
  assert.equal(threw, true, `the obstruction did not land on ${target}`);
}

/**
 * **Make a DIRECTORY unlistable** by putting a file in its place: `readdirSync`
 * answers ENOTDIR, which is the one directory refusal this platform will give
 * on demand. `icacls /deny` does not bite for the account this suite runs as
 * (verified 2026-09-14), so a permission fixture would pass by never failing.
 */
function makeDirUnreadable(target: string): void {
  removeTree(target);
  writeFileSync(target, 'not a directory', 'utf8');
  const read = readTranscriptDir(target);
  assert.notEqual(read.unreadable, null, `the obstruction did not land on ${target}`);
}

/* ══ 1. THE TRANSCRIPT DIRECTORY ═══════════════════════════════════════════ */

test('a transcript directory that will not list is REPORTED, not read as empty', () => {
  const b = box('dir');
  try {
    writeTranscript(b, 's-one');
    const clean = readTranscriptDir(b.dir);
    assert.equal(clean.files.length, 1);
    assert.equal(clean.unreadable, null, 'a directory that listed fine must report no defect');

    makeDirUnreadable(b.dir);
    const refused = readTranscriptDir(b.dir);
    assert.equal(refused.files.length, 0);
    assert.notEqual(refused.unreadable, null, 'the refusal is invisible, which is the defect');
    assert.match(refused.unreadable ?? '', /ENOTDIR/);
  } finally { removeTree(b.base); }
});

test('a directory that is simply NOT THERE is an empty archive, not a refusal', () => {
  // The absence/refusal split, and the half that must stay quiet: a project
  // whose transcripts were pruned, or a cwd the harness has never opened.
  const absent = path.join(tmpdir(), `myctx-absent-${process.pid}-${Date.now()}`);
  const read = readTranscriptDir(absent);
  assert.deepEqual(read.files, []);
  assert.equal(read.unreadable, null);
  assert.deepEqual(listTranscriptFiles(absent), [], 'the old surface still answers the old way');
});

test('an unreadable directory does NOT empty the conversation index', () => {
  const b = box('index');
  try {
    writeTranscript(b, 's-one');
    writeTranscript(b, 's-two');
    const first = rebuildConversations(b.dbPath, b.env, b.cwd);
    assert.equal(first.found, 2);
    assert.equal(first.removed, 0);
    let index = ConversationIndex.open(b.dbPath);
    assert.equal(index.all().length, 2, 'the fixture did not index anything');
    index.close();

    makeDirUnreadable(b.dir);
    const second = rebuildConversations(b.dbPath, b.env, b.cwd);
    // Measured before the fix on this exact fixture: removed=2, index emptied.
    assert.equal(second.removed, 0, 'the archive was swept on a listing that never happened');
    assert.notEqual(second.unreadable, null);
    index = ConversationIndex.open(b.dbPath);
    assert.equal(
      index.all().length, 2,
      'every row in the archive was dropped because one directory would not answer',
    );
    index.close();
  } finally { removeTree(b.base); }
});

test('a transcript that really was deleted is still swept', () => {
  // Anti-vacuity for the test above: the sweep is not being disabled, it is
  // being gated on the listing having happened.
  const b = box('swept');
  try {
    const file = writeTranscript(b, 's-gone');
    rebuildConversations(b.dbPath, b.env, b.cwd);
    rmSync(file);
    const after = rebuildConversations(b.dbPath, b.env, b.cwd);
    assert.equal(after.removed, 1, 'a row whose transcript is genuinely gone must still go');
    assert.equal(after.unreadable, null);
  } finally { removeTree(b.base); }
});

test('`mycontext conversation rebuild` offers the third explanation, not the old two', () => {
  // The person-facing surface for the same fact. Its "no transcripts here"
  // line offers exactly two explanations — never opened, or pruned — and a
  // refused listing used to be folded into them.
  const b = box('cli');
  try {
    writeTranscript(b, 's-one');
    makeDirUnreadable(b.dir);
    const lines: string[] = [];
    const before = process.env['CLAUDE_CONFIG_DIR'];
    process.env['CLAUDE_CONFIG_DIR'] = b.env['CLAUDE_CONFIG_DIR'];
    try {
      runCli(['init'], b.cwd, () => {});
      runCli(['conversation', 'rebuild'], b.cwd, (l) => lines.push(l));
    } finally {
      if (before === undefined) delete process.env['CLAUDE_CONFIG_DIR'];
      else process.env['CLAUDE_CONFIG_DIR'] = before;
    }
    const out = lines.join('\n');
    assert.match(out, /transcript directory could NOT be read/);
    assert.match(out, /NO\s+indexed session was dropped/);
    assert.doesNotMatch(
      out, /no transcripts here/,
      'the reader is offered two explanations and the true one is not among them',
    );
  } finally { removeTree(b.base); }
});

/* ══ 2. THE MIRROR ═════════════════════════════════════════════════════════ */

function persisted(b: Box, sessionId: string): { file: string; transcript: string } {
  const transcript = writeTranscript(b, sessionId);
  rebuildConversations(b.dbPath, b.env, b.cwd);
  const result = persistSession(b.dbPath, b.env, b.cwd, sessionId);
  return { file: result.file, transcript };
}

function mirrorState(b: Box, sessionId: string): { source: string | null; marked: boolean } {
  const index = ConversationIndex.open(b.dbPath);
  try {
    return {
      source: index.get(sessionId)?.source ?? null,
      marked: index.persistedOf(sessionId) !== null,
    };
  } finally { index.close(); }
}

test('a transcript that will not answer does NOT orphan its mirror', () => {
  const b = box('orphan');
  try {
    const { transcript } = persisted(b, 's-one');
    assert.deepEqual(mirrorState(b, 's-one'), { source: 'persisted', marked: true });

    makeFileUnreadable(transcript);
    const report = advanceMirrors(b.dbPath, b.env, b.cwd);
    // Measured before the fix: orphaned=['s-one'], row rewritten as 'exported'.
    assert.deepEqual(report.orphaned, [], 'a refused stat was read as "the transcript is gone"');
    assert.equal(report.unreadable.length, 1);
    assert.equal(report.unreadable[0]!.sessionId, 's-one');
    assert.match(report.unreadable[0]!.why, /is not a file/);
    assert.deepEqual(
      mirrorState(b, 's-one'), { source: 'persisted', marked: true },
      'the archive row was rewritten on the strength of a read that did not happen',
    );
  } finally { removeTree(b.base); }
});

test('a mirror that will not answer does NOT delete the owner’s standing mark', () => {
  const b = box('mark');
  try {
    const { file, transcript } = persisted(b, 's-one');
    appendFileSync(transcript, `${transcriptRow('user', 'more')}\n`, 'utf8');
    assert.deepEqual(mirrorState(b, 's-one'), { source: 'persisted', marked: true });

    makeFileUnreadable(file);
    const report = advanceMirrors(b.dbPath, b.env, b.cwd);
    // Measured before the fix: cleared=['s-one'], `persistedOf` answered null.
    assert.deepEqual(report.cleared, [], 'the mark was dropped and the reason given was false');
    assert.equal(report.unreadable.length, 1);
    assert.deepEqual(
      mirrorState(b, 's-one'), { source: 'persisted', marked: true },
      'the owner said "do not lose this" and a refused stat threw the instruction away',
    );
  } finally { removeTree(b.base); }
});

test('a mirror whose copy is REALLY gone is still cleared, and says so', () => {
  // Anti-vacuity for the two above: the destructive branches are not being
  // disabled, they are being gated on the file really being absent.
  const b = box('gone');
  try {
    const { file } = persisted(b, 's-one');
    rmSync(file);
    const report = advanceMirrors(b.dbPath, b.env, b.cwd);
    assert.deepEqual(report.cleared, ['s-one']);
    assert.deepEqual(report.unreadable, []);
    assert.equal(mirrorState(b, 's-one').marked, false);
  } finally { removeTree(b.base); }
});

test('a transcript that is REALLY gone still orphans its mirror onto the copy', () => {
  const b = box('really-gone');
  try {
    const { transcript } = persisted(b, 's-one');
    rmSync(transcript);
    const report = advanceMirrors(b.dbPath, b.env, b.cwd);
    assert.deepEqual(report.orphaned, ['s-one']);
    assert.deepEqual(report.unreadable, []);
    assert.equal(mirrorState(b, 's-one').source, 'exported');
  } finally { removeTree(b.base); }
});

test('a mirror whose witness bytes cannot be read is NOT stamped replaced', () => {
  /**
   * **`stillPrefix`' third answer, reached the one way this platform allows.**
   * Truncating the copy below the agreed length makes `windowEndingAt` come up
   * SHORT — the same `null` a refused read produces — while both files still
   * stat cleanly, so neither `sizeOf` guard fires and the prefix check is what
   * answers.
   *
   * Before the fix that `null` became `false`, which `advanceOne` reads as *the
   * transcript was replaced* and writes `REPLACED_NOTE` for — a note that is
   * sticky by its own comment (*"Already broken. It is not retried."*) and
   * that blames a file nothing is wrong with.
   */
  const b = box('short');
  try {
    const { file, transcript } = persisted(b, 's-one');
    appendFileSync(transcript, `${transcriptRow('user', 'more')}\n`, 'utf8');
    const kept = readFileSync(file, 'utf8');
    writeFileSync(file, kept.slice(0, 40), 'utf8');

    const report = advanceMirrors(b.dbPath, b.env, b.cwd);
    assert.deepEqual(
      report.broken, [],
      'a question that could not be asked was answered "the transcript was replaced"',
    );
    assert.equal(report.unreadable.length, 1);
    assert.match(report.unreadable[0]!.why, /witness bytes could not be read/);
    const index = ConversationIndex.open(b.dbPath);
    try {
      assert.equal(
        index.persistedOf('s-one')?.note, null,
        'REPLACED_NOTE is sticky, so writing it on an unanswered question is permanent',
      );
    } finally { index.close(); }
  } finally { removeTree(b.base); }
});

test('an orphan whose copy will not answer keeps the mark — the last record there is', () => {
  // The original is gone, so the copy is the ONLY record that this
  // conversation was ever kept. Dropping the mark here is the most expensive
  // version of the same collapse.
  const b = box('orphan-bad-copy');
  try {
    const { file, transcript } = persisted(b, 's-one');
    rmSync(transcript);
    makeFileUnreadable(file);
    const report = advanceMirrors(b.dbPath, b.env, b.cwd);
    assert.deepEqual(report.cleared, []);
    assert.equal(report.unreadable.length, 1);
    assert.equal(mirrorState(b, 's-one').marked, true);
  } finally { removeTree(b.base); }
});

test('a transcript that was REPLACED is still stamped broken — the check that must survive', () => {
  // `stillPrefix`' `'replaced'` answer, which is the whole reason the check
  // exists: a file that was started over must not have a different
  // conversation's tail appended onto the copy.
  const b = box('replaced');
  try {
    const { transcript } = persisted(b, 's-one');
    writeFileSync(
      transcript,
      `${transcriptRow('user', 'a completely different conversation begins here')}\n` +
      `${transcriptRow('assistant', 'and continues for a while longer than the first')}\n`,
      'utf8',
    );
    const report = advanceMirrors(b.dbPath, b.env, b.cwd);
    assert.deepEqual(report.broken, ['s-one']);
    assert.deepEqual(report.unreadable, [], 'a replacement is not an unanswered question');
  } finally { removeTree(b.base); }
});

test('a replacement that lands on a newline anyway is still caught — the measured case', () => {
  /**
   * **The case `stillPrefix`' own docblock records as MEASURED rather than
   * reasoned about**: the first draft checked only that byte `bytes - 1` was
   * still a newline, and a four-turn transcript replacing a two-turn one
   * PASSED, because records of a similar shape are of a similar length. So the
   * equality of the witness pages is a separate assertion from the boundary
   * check, and it needs a case that gets past the boundary.
   *
   * Added because a mutation found the gap: turning the equality branch into
   * `'unreadable'` left every other test here green.
   */
  const b = box('same-shape');
  try {
    const { transcript } = persisted(b, 's-one');
    const kept = readFileSync(transcript, 'utf8');
    // Same length, same newline positions, different content.
    const swapped = kept.replace('hello', 'HELLO').replace('hi"', 'yo"');
    assert.equal(swapped.length, kept.length, 'the fixture changed the length, so it proves less');
    assert.notEqual(swapped, kept, 'the fixture changed nothing at all');
    writeFileSync(transcript, swapped, 'utf8');

    const report = advanceMirrors(b.dbPath, b.env, b.cwd);
    assert.deepEqual(report.broken, ['s-one'], 'a different file was accepted as the same one');
    assert.deepEqual(report.unreadable, []);
  } finally { removeTree(b.base); }
});

/* ══ 3. THE COMPACTION SNAPSHOT ════════════════════════════════════════════ */

function snapshotBox(t: { after(fn: () => void): void }): { cwd: string; root: string } {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-snapshot-'));
  runCli(['init'], cwd, () => {});
  t.after(() => removeTree(cwd));
  return { cwd, root: resolveWorkspace(cwd).projectRoot! };
}

const SESSION = 'sess-snapshot';

function postCompactNote(cwd: string): string {
  recordPostCompact({
    hook_event_name: 'PostCompact', session_id: SESSION, cwd,
    trigger: 'auto', compact_summary: 'a summary',
  }, cwd);
  const rows = readAudit(resolveWorkspace(cwd).projectRoot!).filter((r) => r.op === 'post-compact');
  assert.equal(rows.length, 1, 'the fixture wrote no post-compact row');
  return rows[0]!.note ?? '';
}

test('a snapshot that is NOT THERE reports no defect — the ordinary case stays ordinary', () => {
  const b = box('no-snapshot');
  try {
    const read = readSnapshotMeta(b.base, 'never-compacted');
    assert.equal(read.meta, null);
    assert.equal(read.defect, null, 'almost every session never compacts');
  } finally { removeTree(b.base); }
});

test('a snapshot that IS there and will not be read is told apart from one that is not', (t) => {
  const { cwd, root } = snapshotBox(t);
  writeSnapshot(root, SESSION, ['CONST-a', 'CONST-b']);
  const clean = readSnapshotMeta(root, SESSION);
  assert.equal(clean.meta?.itemIds.length, 2);
  assert.equal(clean.defect, null);

  makeFileUnreadable(snapshotPath(root, SESSION));
  const refused = readSnapshotMeta(root, SESSION);
  assert.equal(refused.meta, null);
  assert.equal(refused.defect, 'unreadable');

  // And the sentence, which is the whole item: it used to send the operator to
  // their hook configuration to debug a hook that fired perfectly.
  const note = postCompactNote(cwd);
  assert.match(note, /IS on disk and could not be read/);
  assert.match(note, /not in the hook configuration/);
  assert.doesNotMatch(
    note, /NO PreCompact snapshot for this session/,
    'the loud, specific, wrong sentence is back',
  );
});

test('a snapshot that is genuinely absent still gets the loud sentence, which is TRUE there', (t) => {
  // Anti-vacuity: the original sentence is correct when the file really is
  // missing, and it must survive.
  const { cwd } = snapshotBox(t);
  const note = postCompactNote(cwd);
  assert.match(note, /NO PreCompact snapshot for this session/);
  assert.doesNotMatch(note, /could not be read/);
});

test('a malformed itemIds is no longer a SUCCESSFUL read of an empty snapshot', (t) => {
  const { cwd, root } = snapshotBox(t);
  writeSnapshot(root, SESSION, ['CONST-a']);
  // Read back, corrupt only `itemIds`, keep `capturedAt` — which is what makes
  // the two indistinguishable: the read succeeds and the count is a real 0.
  writeFileSync(
    snapshotPath(root, SESSION),
    JSON.stringify({ sessionId: SESSION, capturedAt: '2026-09-14T00:00:00Z', itemIds: 'CONST-a' }),
    'utf8',
  );
  const read = readSnapshotMeta(root, SESSION);
  assert.deepEqual(read.meta?.itemIds, [], 'the recoverable answer is still the empty list');
  assert.equal(read.meta?.capturedAt, '2026-09-14T00:00:00Z', 'the restore window is still real');
  assert.equal(read.defect, 'malformed-ids');

  const note = postCompactNote(cwd);
  assert.match(note, /`itemIds` was not a list of ids/);
  assert.match(note, /NOT what the compaction captured/);
});

test('a snapshot that genuinely captured nothing says nothing about corruption', (t) => {
  // Anti-vacuity for the clause above: an empty capture is a measured zero and
  // must not be reported as a corrupt file.
  const { cwd, root } = snapshotBox(t);
  writeSnapshot(root, SESSION, []);
  assert.equal(readSnapshotMeta(root, SESSION).defect, null);
  assert.doesNotMatch(postCompactNote(cwd), /not a list of ids/);
});
