// @basis TASK-anchors-are-the-one-thing-in-the-index-that-cannot-be-re,
// TASK-trim-the-automatic-anchor-pass-to-the-two-kinds-he-ruled,
// INV-nothing-is-dropped-silently
/**
 * **The anchors file is the truth, and the table is rebuilt from it** —
 * `plan:recall seq:6`, owner ruling 2026-09-11 (*"file as truth, go with it"*).
 *
 * The `anchors` table is the one thing in `.my_context/.index.db` that no
 * rebuild can re-derive: conversations, lanes and prose all come back from the
 * transcripts, and items come back from Markdown, but nothing anywhere holds a
 * bookmark except that table. The file closes that hole, on the same terms
 * Markdown items already have with the index.
 *
 * What is proved here, and why each one is worth a test.
 *
 *   1. **The 565 that exist only in his live table are adopted into the file
 *      automatically.** This is the one thing that must not go wrong, and it
 *      must not depend on him running anything — so it is asserted at
 *      `ConversationIndex.open`, which the Stop hook reaches on every turn. The
 *      hand-marked anchor is asserted BY `origin`, never by count: a count that
 *      matches says nothing about WHICH row survived, and `origin: 'owner'` is
 *      the only row in his archive that no automatic pass could ever write
 *      again.
 *   2. **Deleting `.index.db` loses nothing.** The index is defined as
 *      disposable — the shape IS the version — so the proof of durability is
 *      the deletion itself, not an argument about it.
 *   3. **A relabel is one line, not two.** The shape was chosen against the
 *      two precedents in this repository: `revision-log.ts` is append-only and
 *      folded, `.staging/*.json` and `state/` are rewritten documents. The
 *      automatic sweep relabels hundreds at once — 345 in the last run — and
 *      takes some back, and no history of a bookmark is wanted, so the file is
 *      a REWRITTEN DOCUMENT. If it ever became a log this assertion says so.
 *   4. **A write cannot half-happen.** `restore-store.ts` and the staging
 *      writer write-then-rename, and this follows them. The assertion is the
 *      discriminating one: when the temp path cannot be written, the file on
 *      disk is still byte-for-byte what it was — which an in-place writer
 *      cannot satisfy, because it would already have truncated it.
 *   5. **A damaged line is refused, not skipped.** The file is renamed into
 *      place whole, so a torn tail is not a state it can reach; reading a
 *      damaged file as "fewer bookmarks" would be exactly the silent loss
 *      `INV-nothing-is-dropped-silently` forbids.
 *   6. **A mark does not clobber what another process wrote.** The file is a
 *      whole-document rewrite, so a writer holding a stale table would
 *      otherwise publish its staleness over somebody else's bookmark.
 *   7. **The file is GITIGNORED**, asserted against the real `.gitignore` and
 *      against `git` itself. A label quotes conversation text, and conversation
 *      content stays out of git — owner ruling 2026-09-09.
 *
 * Everything runs against FIXTURES in a temp directory. `CLAUDE_CONFIG_DIR` is
 * redirected per test, which is the variable the product honours.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  ConversationIndex, projectDirName, rebuildConversations, type AnchorRow,
} from '../../src/core/conversation-index.ts';
import { allAnchors, markAnchor, resolveAnchor, unmarkAnchor } from '../../src/core/anchors.ts';
import {
  ANCHOR_FILE_NAME, anchorFilePath, anchorTempPath, readAnchorFile, writeAnchorFile,
} from '../../src/core/anchor-file.ts';
import { runCli } from '../../src/cli/index.ts';
import { stopConversationRefresh } from '../../src/hooks/stop.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO = process.cwd();
const SESSION = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const LANE = 'agent-a440b508f45e05e95';

const say = (role: 'user' | 'assistant', text: string, at: string): unknown => ({
  type: role,
  message: { role, content: role === 'user' ? text : [{ type: 'text', text }] },
  timestamp: at,
  cwd: '/w',
  gitBranch: 'master',
});

interface Fixture {
  env: Record<string, string | undefined>;
  /** The repository directory, which is what a hook payload carries as `cwd`. */
  cwd: string;
  /** A throwaway `~/.claude`, so nothing here reads the developer's own. */
  home: string;
  dbPath: string;
  anchorFile: string;
  file: (session?: string) => string;
  session: (rows: unknown[], session?: string) => void;
  dispose: () => void;
}

/** A real workspace — `mycontext init` writes it — and a real transcript directory. */
function fixture(): Fixture {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-anchordur-'));
  runCli(['init'], cwd, () => {});
  const root = path.join(cwd, '.my_context');
  const home = path.join(cwd, 'claude-home');
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const dbPath = path.join(root, '.index.db');

  const lines = (rows: unknown[]): string =>
    rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
  const file = (session = SESSION): string => path.join(dir, `${session}.jsonl`);

  return {
    env: { CLAUDE_CONFIG_DIR: home },
    cwd,
    home,
    dbPath,
    anchorFile: anchorFilePath(dbPath) ?? '',
    file,
    session: (rows, session = SESSION) => writeFileSync(file(session), lines(rows)),
    dispose: () => { removeTree(cwd); },
  };
}

/**
 * Run `body` with `CLAUDE_CONFIG_DIR` pointing at the fixture's throwaway home.
 *
 * On `process.env` rather than as an argument because `stopConversationRefresh`
 * reads `process.env` — a hook has nowhere else to get it — so injecting it
 * would test a seam production does not use.
 */
function withHome<T>(f: Fixture, body: () => T): T {
  const before = process.env['CLAUDE_CONFIG_DIR'];
  process.env['CLAUDE_CONFIG_DIR'] = f.home;
  try {
    return body();
  } finally {
    if (before === undefined) delete process.env['CLAUDE_CONFIG_DIR'];
    else process.env['CLAUDE_CONFIG_DIR'] = before;
  }
}

/** Where a record's line starts, in BYTES, read from the file itself. */
function byteOffsetOf(file: string, needle: string): number {
  const text = readFileSync(file, 'utf8');
  const lineStart = text.lastIndexOf('\n', text.indexOf(needle)) + 1;
  return Buffer.byteLength(text.slice(0, lineStart));
}

/** A row as his live table holds one. */
function row(over: Partial<AnchorRow> & { id: string }): AnchorRow {
  return {
    sessionId: SESSION,
    agentId: null,
    byteOffset: 0,
    label: 'a table',
    kind: 'table',
    origin: 'automatic',
    at: '2026-09-11T06:00:00.000Z',
    ...over,
  };
}

/**
 * Put anchors in the TABLE without going through the write path — which is
 * exactly the state his live index is in: 565 rows that predate the file.
 */
function seedTableOnly(dbPath: string, rows: AnchorRow[]): void {
  const db = new DatabaseSync(dbPath);
  try {
    const insert = db.prepare(
      'INSERT INTO anchors (id, session_id, agent_id, byte_offset, label, kind, origin, at) '
      + 'VALUES (?,?,?,?,?,?,?,?)',
    );
    for (const r of rows) {
      insert.run(r.id, r.sessionId, r.agentId, r.byteOffset, r.label, r.kind, r.origin, r.at);
    }
  } finally {
    db.close();
  }
}

/** His live shape in miniature: many automatic anchors and the one he made. */
function hisAnchors(n: number): AnchorRow[] {
  const rows: AnchorRow[] = [];
  for (let i = 0; i < n; i++) {
    rows.push(row({ id: `${SESSION}:-:${i * 100}`, byteOffset: i * 100, label: `a table ${i}` }));
  }
  rows.push(row({
    id: `${SESSION}:${LANE}:904023`,
    agentId: LANE,
    byteOffset: 904_023,
    label: 'byte offset',
    kind: 'note',
    origin: 'owner',
    at: '2026-09-11T06:35:21.837Z',
  }));
  return rows;
}

test('a table with rows and no file yet produces a file with every row', () => {
  const f = fixture();
  try {
    withHome(f, () => {
      // A scanned archive, which is what the Stop hook's opt-in gate asks for.
      f.session([say('user', 'come back to this', '2026-09-01T10:00:00.000Z')]);
      rebuildConversations(f.dbPath, process.env, f.cwd, {});

      // The table holds bookmarks and there is no file — his state on the day
      // this landed, and the state of every corpus that predates it.
      seedTableOnly(f.dbPath, hisAnchors(564));
      assert.equal(existsSync(f.anchorFile), false, 'the fixture must start with no file');

      // **NOTHING IS RUN BY HAND.** A turn ends; that is all.
      const report = stopConversationRefresh({ cwd: f.cwd });
      assert.notEqual(report, null, 'the hook declined in a workspace that has an index');
      assert.deepEqual(
        report?.anchors, { direction: 'adopted', rows: 565 },
        'the turn did not report adopting the standing table into a file',
      );

      const adopted = readAnchorFile(f.anchorFile);
      assert.equal(adopted.state, 'read');
      // **564 AND NOT 565, AND THE MISSING ONE IS NAMED RATHER THAN ROUNDED
      // OFF** — 2026-09-12, when creation path 1 was wired and this same turn
      // began running the automatic pass after the reconciliation above
      // (`REQ-every-anchor-capability-is-reachable-from-the-screen-and-a`).
      //
      // The adoption still writes every one of the 565, which is what the
      // report a few lines up says and what this test is for. What the pass
      // then does is its own documented contract: it owns every `origin:
      // automatic` row, reads each back AT ITS OWN BYTE, and takes back what
      // today's grammar does not recognise. Exactly one seeded row resolves to
      // a record at all — the one at byte 0, over a prompt that is neither a
      // table nor a ruling — and it is taken back. The other 563 point past
      // the end of a one-record transcript, where `turnAt` reads nothing, and
      // SILENCE IS NOT EVIDENCE: they are left exactly where they are.
      //
      // The two named rows come BEFORE the count deliberately: a count is the
      // assertion that reddens whichever half of this broke, and a reader of
      // the failure would not know which.
      assert.equal(
        adopted.rows.filter((r) => r.origin === 'automatic' && r.byteOffset === 0).length, 0,
        'the row at byte 0 stands over a turn the grammar does not recognise and should have '
        + 'been taken back by the pass that ran on this same turn',
      );
      assert.equal(
        adopted.rows.filter((r) => r.origin === 'automatic' && r.byteOffset === 100).length, 1,
        'a row the pass could not READ was taken back anyway. A transcript that is shorter than '
        + 'the offset is not the grammar saying no, and deleting on it turns a pruned session '
        + 'into lost bookmarks.',
      );
      assert.equal(adopted.rows.length, 564);

      // BY ORIGIN, never by count: the count says nothing about WHICH row survived.
      const byHand = adopted.rows.filter((r) => r.origin === 'owner');
      assert.equal(byHand.length, 1, 'the anchor he marked by hand is not in the file');
      assert.equal(byHand[0]?.label, 'byte offset');
      assert.equal(byHand[0]?.agentId, LANE);
      assert.equal(byHand[0]?.byteOffset, 904_023);
    });
  } finally {
    f.dispose();
  }
});

test('deleting the index loses nothing: a rebuild brings every anchor back', () => {
  const f = fixture();
  try {
    withHome(f, () => {
      f.session([
        say('user', 'come back to this', '2026-09-01T10:00:00.000Z'),
        say('assistant', 'the ruling is recorded here', '2026-09-01T10:00:01.000Z'),
      ]);
      rebuildConversations(f.dbPath, process.env, f.cwd, {});
      const at = byteOffsetOf(f.file(), 'the ruling is recorded here');

      // Two bookmarks HE made. `origin: 'owner'` is the kind nothing else can
      // ever re-derive — an automatic one the pass would find again — so it is
      // the kind this proof is about.
      const index = ConversationIndex.open(f.dbPath);
      try {
        markAnchor(index, { sessionId: SESSION, byteOffset: at, label: 'the ruling' });
        markAnchor(index, { sessionId: SESSION, byteOffset: 0, label: 'where it starts' });
      } finally {
        index.close();
      }

      // THE INDEX GOES. Every file SQLite keeps for it, so nothing can come
      // back from a journal rather than from the anchors file.
      for (const suffix of ['', '-wal', '-shm']) {
        rmSync(`${f.dbPath}${suffix}`, { force: true });
      }
      assert.equal(existsSync(f.dbPath), false);

      assert.equal(runCli(['conversation', 'rebuild'], f.cwd, () => {}), 0);

      const after = ConversationIndex.open(f.dbPath);
      try {
        const byHand = allAnchors(after).filter((r) => r.origin === 'owner');
        assert.deepEqual(
          byHand.map((r) => r.label).sort(), ['the ruling', 'where it starts'],
          'the hand-marked anchors did not survive the deletion of the index',
        );
        // And one still POINTS somewhere: an id that resolves to no record
        // would be a bookmark that came back as a number.
        const ruling = byHand.find((r) => r.label === 'the ruling');
        assert.equal(resolveAnchor(after, ruling!.id)?.text, 'the ruling is recorded here');
      } finally {
        after.close();
      }
    });
  } finally {
    f.dispose();
  }
});

test('marking an anchor writes it to the file, and dropping it takes it out', () => {
  const f = fixture();
  try {
    const index = ConversationIndex.open(f.dbPath);
    try {
      const marked = markAnchor(index, {
        sessionId: SESSION, byteOffset: 512, label: 'the ruling',
      });
      assert.deepEqual(
        readAnchorFile(f.anchorFile).rows.map((r) => r.id), [marked.id],
        'a mark did not reach the file',
      );
      unmarkAnchor(index, marked.id);
      assert.deepEqual(
        readAnchorFile(f.anchorFile).rows.map((r) => r.id), [],
        'an unmark did not reach the file',
      );
    } finally {
      index.close();
    }
  } finally {
    f.dispose();
  }
});

test('a relabelled anchor is one line and not two — a document, not a log', () => {
  const f = fixture();
  try {
    const index = ConversationIndex.open(f.dbPath);
    try {
      const first = markAnchor(index, {
        sessionId: SESSION, byteOffset: 512, label: '|', kind: 'table', origin: 'automatic',
      });
      const second = markAnchor(index, {
        sessionId: SESSION,
        byteOffset: 512,
        label: 'a table of anchors',
        kind: 'table',
        origin: 'automatic',
      });
      assert.equal(first.id, second.id);

      const rows = readAnchorFile(f.anchorFile).rows;
      assert.equal(rows.length, 1, 'the file grew a second record for one bookmark');
      assert.equal(rows[0]?.label, 'a table of anchors');
    } finally {
      index.close();
    }
  } finally {
    f.dispose();
  }
});

test('a write that cannot reach its temp path leaves the file exactly as it was', () => {
  const f = fixture();
  try {
    const standing = [row({ id: 'a', label: 'the ruling' }), row({ id: 'b', label: 'a table' })];
    writeAnchorFile(f.anchorFile, standing);
    const before = readFileSync(f.anchorFile);

    // The temp path is a DIRECTORY, so writing it throws — the one failure that
    // tells a write-then-rename apart from a write in place, because an
    // in-place writer would already have truncated the file below.
    mkdirSync(anchorTempPath(f.anchorFile), { recursive: true });
    assert.throws(() => writeAnchorFile(f.anchorFile, [row({ id: 'c', label: 'a third' })]));

    assert.deepEqual(
      readFileSync(f.anchorFile), before,
      'a failed write changed the file it was replacing',
    );
    assert.deepEqual(
      readAnchorFile(f.anchorFile).rows.map((r) => r.id), ['a', 'b'],
    );
  } finally {
    f.dispose();
  }
});

test('a completed write leaves no temp file beside the anchors file', () => {
  const f = fixture();
  try {
    writeAnchorFile(f.anchorFile, [row({ id: 'a' })]);
    const left = readdirSync(path.dirname(f.anchorFile))
      .filter((name) => name.startsWith(`${ANCHOR_FILE_NAME}.tmp`));
    assert.deepEqual(left, [], 'a temp file survived a completed write');
  } finally {
    f.dispose();
  }
});

test('a damaged line is refused, never read as fewer bookmarks', () => {
  const f = fixture();
  try {
    writeAnchorFile(f.anchorFile, [row({ id: 'a' }), row({ id: 'b' })]);
    const good = readFileSync(f.anchorFile, 'utf8').split('\n').filter((l) => l !== '');
    // Newline-terminated, so this is corruption and not a killed writer's tail.
    writeFileSync(f.anchorFile, `${good[0]}\n{"protocol":"my_context/anchor@1",\n`, 'utf8');

    assert.throws(
      () => readAnchorFile(f.anchorFile),
      (err: Error) => /line 2/.test(err.message) && /anchor/.test(err.message),
      'a damaged anchors file was read as a shorter one',
    );
  } finally {
    f.dispose();
  }
});

test('a mark does not clobber an anchor another process wrote', () => {
  const f = fixture();
  try {
    const index = ConversationIndex.open(f.dbPath);
    try {
      markAnchor(index, { sessionId: SESSION, byteOffset: 100, label: 'mine' });

      // Another process marks one and publishes it. This index's table has
      // never heard of it.
      const theirs = row({ id: `${SESSION}:-:200`, byteOffset: 200, label: 'theirs' });
      writeAnchorFile(f.anchorFile, [...readAnchorFile(f.anchorFile).rows, theirs]);

      markAnchor(index, { sessionId: SESSION, byteOffset: 300, label: 'mine again' });

      assert.deepEqual(
        readAnchorFile(f.anchorFile).rows.map((r) => r.label).sort(),
        ['mine', 'mine again', 'theirs'],
        'a mark published a stale table over another writer’s anchor',
      );
    } finally {
      index.close();
    }
  } finally {
    f.dispose();
  }
});

test('an anchor written in a transaction that would not write the file is refused', () => {
  const f = fixture();
  try {
    const index = ConversationIndex.open(f.dbPath);
    try {
      // A plain `index.transaction` COMMITS the table and writes no document,
      // so the next reconciliation would delete the anchor as one the file
      // does not have. Silent loss of the one thing that cannot be re-derived,
      // so it is refused rather than risked.
      assert.throws(
        () => index.transaction(() => {
          markAnchor(index, { sessionId: SESSION, byteOffset: 64, label: 'lost' });
        }),
        /anchorTransaction/,
        'an anchor write inside a plain transaction was allowed to commit',
      );
      assert.deepEqual(readAnchorFile(f.anchorFile).rows.map((r) => r.label), []);
    } finally {
      index.close();
    }
  } finally {
    f.dispose();
  }
});

test('the anchors file is gitignored, in the real .my_context/.gitignore', () => {
  const ignore = readFileSync(path.join(REPO, '.my_context', '.gitignore'), 'utf8');
  const covered = ignore.split(/\r?\n/).map((l) => l.trim())
    .some((l) => l === ANCHOR_FILE_NAME || l === `${ANCHOR_FILE_NAME}*`);
  assert.equal(
    covered, true,
    `${ANCHOR_FILE_NAME} is not named in .my_context/.gitignore, and an anchor label quotes `
    + 'conversation text',
  );
});

test('git itself agrees that the anchors file is ignored', () => {
  const probe = `.my_context/${ANCHOR_FILE_NAME}`;
  const run = spawnSync('git', ['check-ignore', '-q', '--no-index', probe], { cwd: REPO });
  assert.equal(
    run.status, 0,
    `git check-ignore says ${probe} is NOT ignored (status ${run.status}); a rule may be `
    + 'present and still not cover the path',
  );
});
