// @basis INV-nothing-is-dropped-silently, STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is
/**
 * **The mirror — a session kept outside the project, and kept up to date.**
 * `plan:archive seq:4`.
 *
 * ── WHAT IS WORTH PROVING HERE, AND WHAT IS SCAFFOLDING FOR IT ────────────
 *
 *   1. **The copy is the file, byte for byte.** Every test that writes a
 *      mirror compares its BYTES against the prefix of the transcript it was
 *      copied from, never its record counts. A mirror whose counts matched
 *      while its bytes did not is a file a person cannot hand to anybody, and
 *      counts are the thing most likely to agree by accident.
 *   2. **The append is an append.** `an advance copies only the tail` asserts
 *      the number of bytes WRITTEN, not merely that the file ended up right.
 *      A mirror that silently fell back to copying 65 MB per turn would end up
 *      byte-identical and would be the defect this whole design exists to
 *      avoid.
 *   3. **An interrupted write costs the partial line and never a duplicated
 *      one.** `an interrupted advance is repaired` corrupts the mirror past
 *      the length the index agreed it holds — exactly what a crash mid-write
 *      leaves — and asserts the next pass produces the right bytes. This is
 *      the one property that cannot be checked by reading the code, because
 *      the failure only exists between two processes.
 *   4. **Every state is a state.** A transcript replaced rather than appended
 *      to, a transcript deleted, and a copy deleted are three different things
 *      and each has an assertion that it is REPORTED, not merely survived.
 *
 * `MYCONTEXT_MIRROR_DIR` is pinned to a temp directory in every fixture, so
 * nothing here can reach the developer's real `~/.my-context`;
 * `test/helpers/real-home-guard.ts` would abort the run if it did.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  ConversationIndex, forgetConversations, projectDirName, rebuildConversations,
} from '../../src/core/conversation-index.ts';
import {
  MIRROR_DIR_ENV, advanceMirrors, mirrorPath, persistSession, unpersistSession,
} from '../../src/core/conversation-mirror.ts';
import { Store } from '../../src/core/store.ts';
import { removeTree } from '../helpers/tmp.ts';

interface Fixture {
  env: Record<string, string | undefined>;
  cwd: string;
  dir: string;
  dbPath: string;
  transcript: (session: string) => string;
  write: (session: string, lines: unknown[]) => void;
  append: (session: string, lines: unknown[]) => void;
  rebuild: () => void;
  mirror: (session: string) => string;
  dispose: () => void;
}

/** A throwaway harness home, a throwaway mirror root, and a real workspace cwd. */
function fixture(): Fixture {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-mirror-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-mirror-cwd-'));
  const kept = mkdtempSync(path.join(tmpdir(), 'myctx-mirror-kept-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const dbPath = path.join(cwd, 'index.db');
  Store.open(dbPath).close();
  const env = { CLAUDE_CONFIG_DIR: home, [MIRROR_DIR_ENV]: kept };
  const body = (lines: unknown[]): string =>
    lines.map((line) => JSON.stringify(line)).join('\n') + '\n';
  return {
    env,
    cwd,
    dir,
    dbPath,
    transcript: (session) => path.join(dir, `${session}.jsonl`),
    write: (session, lines) => writeFileSync(path.join(dir, `${session}.jsonl`), body(lines)),
    append: (session, lines) => appendFileSync(path.join(dir, `${session}.jsonl`), body(lines)),
    rebuild: () => { rebuildConversations(dbPath, env, cwd); },
    mirror: (session) => mirrorPath(env, cwd, session),
    dispose: () => {
      removeTree(home);
      removeTree(cwd);
      removeTree(kept);
    },
  };
}

const at = (s: number): string => new Date(Date.UTC(2026, 8, 9, 12, 0, s)).toISOString();
const turn = (n: number): unknown[] => [
  { type: 'user', message: { role: 'user', content: `ask ${n}` }, timestamp: at(n * 2) },
  {
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'text', text: `answer ${n}` }] },
    timestamp: at(n * 2 + 1),
  },
];

/** One session's row, or `null` — the shape every assertion below reads. */
function rowOf(dbPath: string, session: string) {
  const index = ConversationIndex.openReadOnlyChecked(dbPath);
  try {
    return index.get(session);
  } finally {
    index.close();
  }
}

function markOf(dbPath: string, session: string) {
  const index = ConversationIndex.openReadOnlyChecked(dbPath);
  try {
    return index.persistedOf(session);
  } finally {
    index.close();
  }
}

/**
 * **THE ITEM SAID THE BEGINNING WOULD BE LOST, AND IT IS NOT.**
 *
 * `plan:archive seq:4` predicted: *"If a session is marked persistent halfway
 * through, the mirror starts from that point and the beginning is already
 * unrecoverable."* A transcript only appends and the whole of it is on disk
 * when the mark is taken, so the copy starts at byte 0 and the earlier turns
 * are in it. This test is the correction, run rather than argued: the mark is
 * taken after three turns and the copy holds all three.
 */
test('a session marked mid-flight is copied WHOLE — the beginning is not lost', () => {
  const f = fixture();
  try {
    f.write('sess-a', [...turn(1), ...turn(2), ...turn(3)]);
    f.rebuild();
    const result = persistSession(f.dbPath, f.env, f.cwd, 'sess-a');

    const original = readFileSync(f.transcript('sess-a'));
    const copy = readFileSync(f.mirror('sess-a'));
    assert.deepEqual(copy, original, 'the copy is not the file, byte for byte');
    assert.equal(result.bytes, original.length);
    assert.equal(result.written, original.length, 'a first copy writes the whole file');
    assert.equal(result.already, false);
    assert.match(copy.toString('utf8'), /ask 1/, 'the first turn is missing from the copy');

    const mark = markOf(f.dbPath, 'sess-a');
    assert.ok(mark !== null, 'the mark was not recorded');
    assert.equal(mark.bytes, original.length);
    assert.equal(mark.note, null, 'a fresh copy carries no reason for stopping');
    assert.equal(rowOf(f.dbPath, 'sess-a')?.source, 'persisted');
  } finally {
    f.dispose();
  }
});

/**
 * The whole reason this is affordable once per assistant turn: a grown
 * transcript costs its TAIL and not its length.
 *
 * The bytes WRITTEN are asserted, not only the bytes that end up there. A
 * mirror that re-copied the file whole every turn would leave exactly the same
 * bytes on disk and would be the defect.
 */
test('an advance copies only the tail, and the bytes it wrote say so', () => {
  const f = fixture();
  try {
    f.write('sess-b', [...turn(1), ...turn(2)]);
    f.rebuild();
    const first = persistSession(f.dbPath, f.env, f.cwd, 'sess-b');
    const before = statSync(f.transcript('sess-b')).size;

    f.append('sess-b', turn(3));
    const after = statSync(f.transcript('sess-b')).size;
    f.rebuild();
    const report = advanceMirrors(f.dbPath, f.env, f.cwd);

    assert.equal(report.marked, 1);
    assert.equal(report.advanced, 1);
    assert.equal(
      report.bytesWritten, after - before,
      'the advance wrote something other than the delta — either it re-copied the file whole ' +
      'or it stopped short, and both are invisible in the resulting bytes',
    );
    assert.ok(first.bytes < after);
    assert.deepEqual(
      readFileSync(f.mirror('sess-b')), readFileSync(f.transcript('sess-b')),
      'the copy is not the file after the append',
    );
    assert.deepEqual(report.orphaned, []);
    assert.deepEqual(report.broken, []);
    assert.deepEqual(report.cleared, []);
  } finally {
    f.dispose();
  }
});

/** A pass with nothing to do says so with a measured zero, and writes nothing. */
test('a caught-up copy costs a stat and reports a measured zero', () => {
  const f = fixture();
  try {
    f.write('sess-c', turn(1));
    f.rebuild();
    persistSession(f.dbPath, f.env, f.cwd, 'sess-c');
    const stamp = statSync(f.mirror('sess-c')).mtimeMs;

    const report = advanceMirrors(f.dbPath, f.env, f.cwd);
    assert.equal(report.marked, 1, 'the mark is still counted — it is not an absence');
    assert.equal(report.advanced, 0);
    assert.equal(report.bytesWritten, 0);
    assert.equal(statSync(f.mirror('sess-c')).mtimeMs, stamp, 'the copy was rewritten anyway');
  } finally {
    f.dispose();
  }
});

/** A workspace nobody has asked to keep anything reports zero marks, not silence. */
test('a workspace with no marks is a measured zero and names where copies would live', () => {
  const f = fixture();
  try {
    f.write('sess-d', turn(1));
    f.rebuild();
    const report = advanceMirrors(f.dbPath, f.env, f.cwd);
    assert.equal(report.marked, 0);
    assert.equal(report.bytesWritten, 0);
    assert.ok(report.dir.length > 0, 'the directory is named even when it holds nothing');
  } finally {
    f.dispose();
  }
});

/**
 * **THE CRASH CASE, WHICH ONLY EXISTS BETWEEN TWO PROCESSES.**
 *
 * An advance that died mid-write leaves the copy longer than the length the
 * index agreed it holds, and half of that extra is a partial JSON line. The
 * next pass must not append after it — that would duplicate bytes and put a
 * broken record in the middle of a file whose whole value is that it parses.
 * It truncates back to the agreed length first, which is what makes the
 * operation idempotent.
 */
test('an interrupted advance is repaired, never appended after', () => {
  const f = fixture();
  try {
    f.write('sess-e', [...turn(1), ...turn(2)]);
    f.rebuild();
    persistSession(f.dbPath, f.env, f.cwd, 'sess-e');
    const agreed = markOf(f.dbPath, 'sess-e')?.bytes ?? 0;

    // Exactly what a killed process leaves: bytes past the agreed length, and
    // the last of them not a whole line.
    appendFileSync(f.mirror('sess-e'), '{"type":"user","mess');
    assert.ok(statSync(f.mirror('sess-e')).size > agreed);

    f.append('sess-e', turn(3));
    f.rebuild();
    advanceMirrors(f.dbPath, f.env, f.cwd);

    assert.deepEqual(
      readFileSync(f.mirror('sess-e')), readFileSync(f.transcript('sess-e')),
      'the partial line survived into the copy, or the tail was appended after it',
    );
    for (const line of readFileSync(f.mirror('sess-e'), 'utf8').split('\n')) {
      if (line === '') continue;
      JSON.parse(line);
    }
  } finally {
    f.dispose();
  }
});

/**
 * A transcript caught mid-record is copied up to its last WHOLE line, and the
 * remainder is taken on the next pass.
 *
 * A copy that ended half way through a JSON object would be a file that does
 * not parse — which is the one thing a person handing it to somebody cannot
 * check for themselves.
 */
test('a copy stops at the last whole line, and takes the rest next time', () => {
  const f = fixture();
  try {
    f.write('sess-f', turn(1));
    f.rebuild();
    persistSession(f.dbPath, f.env, f.cwd, 'sess-f');

    // A record still being written: no trailing newline.
    appendFileSync(f.transcript('sess-f'), '{"type":"user","message":{"role":"user"');
    f.rebuild();
    const partial = advanceMirrors(f.dbPath, f.env, f.cwd);
    assert.equal(partial.advanced, 0, 'half a record was copied');
    assert.equal(
      statSync(f.mirror('sess-f')).size, markOf(f.dbPath, 'sess-f')?.bytes,
      'the copy is longer than the length the index agreed it holds',
    );

    appendFileSync(f.transcript('sess-f'), ',"content":"late"},"timestamp":"' + at(9) + '"}\n');
    f.rebuild();
    const whole = advanceMirrors(f.dbPath, f.env, f.cwd);
    assert.equal(whole.advanced, 1);
    assert.deepEqual(
      readFileSync(f.mirror('sess-f')), readFileSync(f.transcript('sess-f')),
      'the record that was half-written did not arrive whole on the next pass',
    );
  } finally {
    f.dispose();
  }
});

/**
 * A transcript REPLACED rather than appended to cannot be followed, and the
 * copy says so instead of looking finished. `INV-nothing-is-dropped-silently`.
 */
test('a replaced transcript stops the copy and records the reason on the mark', () => {
  const f = fixture();
  try {
    f.write('sess-g', [...turn(1), ...turn(2)]);
    f.rebuild();
    persistSession(f.dbPath, f.env, f.cwd, 'sess-g');
    const kept = readFileSync(f.mirror('sess-g'));

    // A different file at the same path, and LONGER, so a size comparison
    // alone would call it growth.
    f.write('sess-g', [...turn(7), ...turn(8), ...turn(9), ...turn(10)]);
    const report = advanceMirrors(f.dbPath, f.env, f.cwd);

    assert.deepEqual(report.broken, ['sess-g']);
    assert.equal(report.advanced, 0);
    assert.deepEqual(
      readFileSync(f.mirror('sess-g')), kept,
      'bytes from a different file were appended to the copy',
    );
    const mark = markOf(f.dbPath, 'sess-g');
    assert.ok(mark !== null && mark.note !== null, 'the mark does not say why it stopped');

    // And it is not retried on the next pass, because there is no correct
    // answer to retry into.
    const again = advanceMirrors(f.dbPath, f.env, f.cwd);
    assert.deepEqual(again.broken, ['sess-g']);
    assert.equal(again.advanced, 0);
  } finally {
    f.dispose();
  }
});

/**
 * **THE STATE THE WHOLE MARK EXISTS FOR** — `plan:archive seq:5`: the harness
 * pruned the transcript, and the copy is the only thing keeping the session
 * visible at all. `seq:11` ruled that a session whose file is gone LEAVES the
 * list; this is the exception the owner asked for, and without it "marked
 * persistent" is a promise the product does not keep.
 *
 * Three things are asserted together because any one of them alone would be a
 * half-kept promise: the row survives the rebuild, it says `'exported'`, and
 * it points at the copy — so the viewer opens the copy through the same route
 * it opens a live session.
 */
test('when the transcript is pruned the copy keeps the session, marked as the copy', () => {
  const f = fixture();
  try {
    f.write('sess-h', [...turn(1), ...turn(2)]);
    f.rebuild();
    persistSession(f.dbPath, f.env, f.cwd, 'sess-h');
    const before = rowOf(f.dbPath, 'sess-h');
    assert.ok(before !== null);

    rmSync(f.transcript('sess-h'));
    f.rebuild();
    const report = advanceMirrors(f.dbPath, f.env, f.cwd);

    assert.deepEqual(report.orphaned, ['sess-h']);
    const row = rowOf(f.dbPath, 'sess-h');
    assert.ok(row !== null, 'the rebuild dropped a session the owner asked to keep');
    assert.equal(row.source, 'exported');
    assert.equal(row.file, f.mirror('sess-h'), 'the row does not point at the copy');
    assert.equal(
      row.records, before.records,
      'the counts changed when the row was read back from the copy — the copy is not the file',
    );
    assert.equal(row.bytes, statSync(f.mirror('sess-h')).size);

    // And the steady state after that is one stat: a copy whose original is
    // gone cannot grow, so nothing is re-scanned and nothing is re-reported.
    const settled = advanceMirrors(f.dbPath, f.env, f.cwd);
    assert.deepEqual(settled.orphaned, []);
    assert.equal(settled.advanced, 0);
  } finally {
    f.dispose();
  }
});

/**
 * A copy deleted from under its mark is not silently re-made. Re-copying 65 MB
 * on a background hook because a file vanished is a decision to take, not one
 * to make on somebody's behalf — so the mark goes and is NAMED.
 */
test('a copy deleted from under its mark drops the mark and says which', () => {
  const f = fixture();
  try {
    f.write('sess-i', turn(1));
    f.rebuild();
    persistSession(f.dbPath, f.env, f.cwd, 'sess-i');
    rmSync(f.mirror('sess-i'));

    const report = advanceMirrors(f.dbPath, f.env, f.cwd);
    assert.deepEqual(report.cleared, ['sess-i']);
    assert.equal(markOf(f.dbPath, 'sess-i'), null);
    assert.equal(existsSync(f.mirror('sess-i')), false, 'a copy was re-made unasked');
    assert.equal(rowOf(f.dbPath, 'sess-i')?.source, 'live', 'the row still claims a copy exists');
  } finally {
    f.dispose();
  }
});

/**
 * `persist --off` stops the copying and LEAVES THE FILE. The two acts are
 * different sizes and only the smaller one is offered: deleting could destroy
 * the only remaining record of a conversation.
 */
test('stopping the copying leaves the copy exactly where it is', () => {
  const f = fixture();
  try {
    f.write('sess-j', turn(1));
    f.rebuild();
    persistSession(f.dbPath, f.env, f.cwd, 'sess-j');
    const bytes = readFileSync(f.mirror('sess-j'));

    const result = unpersistSession(f.dbPath, 'sess-j');
    assert.equal(result.unmarked, true);
    assert.equal(result.file, f.mirror('sess-j'));
    assert.deepEqual(readFileSync(f.mirror('sess-j')), bytes, 'the copy was touched');
    assert.equal(markOf(f.dbPath, 'sess-j'), null);
    assert.equal(rowOf(f.dbPath, 'sess-j')?.source, 'live');

    // A second call is an answer, not a failure.
    assert.equal(unpersistSession(f.dbPath, 'sess-j').unmarked, false);
  } finally {
    f.dispose();
  }
});

/**
 * `conversation forget` drops the MARKS and leaves the COPIES, and reports the
 * number so the loss is not silent. The command's own argument is that it
 * drops a cache the transcripts can rebuild; a copy is the opposite kind of
 * thing and may be the only one left.
 */
test('forgetting the index drops the marks and never the copies', () => {
  const f = fixture();
  try {
    f.write('sess-k', turn(1));
    f.rebuild();
    persistSession(f.dbPath, f.env, f.cwd, 'sess-k');
    const bytes = readFileSync(f.mirror('sess-k'));

    const report = forgetConversations(f.dbPath);
    assert.equal(report.indexed, true);
    assert.equal(report.persisted, 1, 'the marks that were dropped were not counted');
    assert.deepEqual(
      readFileSync(f.mirror('sess-k')), bytes,
      'forgetting the index deleted a copy of a conversation',
    );
  } finally {
    f.dispose();
  }
});

/** A session nothing has indexed cannot be kept, and the refusal says what to run. */
test('a session that is not indexed is refused with the command that would index it', () => {
  const f = fixture();
  try {
    f.write('sess-l', turn(1));
    f.rebuild();
    assert.throws(
      () => persistSession(f.dbPath, f.env, f.cwd, 'sess-nope'),
      /no indexed session/,
    );
    assert.equal(existsSync(f.mirror('sess-nope')), false, 'a copy was made of nothing');
  } finally {
    f.dispose();
  }
});

/**
 * **RE-TAKING THE MARK ON A BROKEN COPY STARTS A FRESH ONE**, which is what
 * both the command's own report and `advanceMirrors`' refusal promise.
 *
 * The dangerous alternative is not a crash, it is a silence: resuming from the
 * recorded length would splice the tail of one conversation onto the body of
 * another, the file would still parse, and every count on the row would still
 * add up. So the assertion is on the BYTES — the copy must equal the file that
 * is there now, not the one that used to be.
 */
test('re-taking the mark after a replacement copies the new file whole', () => {
  const f = fixture();
  try {
    f.write('sess-m', [...turn(1), ...turn(2)]);
    f.rebuild();
    persistSession(f.dbPath, f.env, f.cwd, 'sess-m');

    f.write('sess-m', [...turn(7), ...turn(8), ...turn(9), ...turn(10)]);
    advanceMirrors(f.dbPath, f.env, f.cwd);
    assert.ok(markOf(f.dbPath, 'sess-m')?.note !== null, 'the copy did not record a stop');

    f.rebuild();
    const again = persistSession(f.dbPath, f.env, f.cwd, 'sess-m');
    assert.equal(again.already, true, 'the mark was already there and this advanced it');
    assert.deepEqual(
      readFileSync(f.mirror('sess-m')), readFileSync(f.transcript('sess-m')),
      'the fresh copy is not the file that is there now — a tail was spliced onto a stale body',
    );
    assert.equal(markOf(f.dbPath, 'sess-m')?.note, null, 'the stop was not cleared');
    assert.equal(again.written, statSync(f.transcript('sess-m')).size, 'it did not start at 0');
  } finally {
    f.dispose();
  }
});
