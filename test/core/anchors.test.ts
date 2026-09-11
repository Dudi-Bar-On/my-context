// @basis TASK-search-the-archive-properly-and-mark-the-anchors-you-want-to,
// INV-nothing-is-dropped-silently
/**
 * **The anchors table** — `plan:recall seq:1`, Task 3 of
 * `docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md`, and
 * §7 of `docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md`.
 *
 * An anchor is a fixed point the owner can steer back to. What is worth
 * proving here, and what is scaffolding for it.
 *
 *   1. **It survives a rebuild, which is the whole reason it is a TABLE.**
 *      `an anchor survives a rebuild` marks one, rebuilds, and reads it back —
 *      and in the same test writes a hand value into a `conversations` COLUMN
 *      and watches the same rebuild erase it. That second half is the
 *      measurement `plan:archive seq:34` took hours before this item was
 *      written, asserted rather than quoted: `upsert` sets every column from
 *      `excluded`, and the Stop hook rebuilds at the end of every assistant
 *      turn, so a hand-written value lives ONE TURN and then vanishes
 *      silently. If that ever stops being true, this test goes red on the
 *      half that says so and the design is re-openable — which is the only
 *      honest way to record a reason.
 *   2. **It survives the row being pruned**, which is the second loss the same
 *      item measured. `removeMissing` DELETES the `conversations` row when the
 *      harness prunes a transcript; a table keyed by session id outlives it,
 *      exactly as `persisted` does.
 *   3. **The position is a BYTE offset.** `the position is a byte offset and
 *      resolves to the right record in a Hebrew transcript` plants Hebrew
 *      ahead of the target so that the byte offset and the character offset
 *      are provably different numbers, asserts they differ, and then RESOLVES
 *      the anchor by seeking the file at it. A character offset would land
 *      mid-record and report unreadable rather than throwing, which is a
 *      silently wrong answer.
 *   4. **Marking the same point twice is one anchor.** `marking the same point
 *      twice is one anchor, with the newer label` matters because anchors are
 *      set two ways (§7) and the automatic half runs on every turn. An id
 *      derived from the position rather than from the clock is what stops a
 *      per-turn writer from filling the table with copies of one bookmark.
 *   5. **A new table is a new schema version**, on this index's own rule.
 *
 * Everything runs against FIXTURES in a temp directory, never the developer's
 * own `~/.claude`: `CLAUDE_CONFIG_DIR` is redirected per test, which is the
 * variable the product honours and therefore the code path a real run takes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  ConversationIndex, ConversationIndexIncompleteError, projectDirName, rebuildConversations,
} from '../../src/core/conversation-index.ts';
import {
  anchorsFor, markAnchor, resolveAnchor, searchAnchors,
} from '../../src/core/anchors.ts';
import { Store } from '../../src/core/store.ts';
import { removeTree } from '../helpers/tmp.ts';

const SESSION = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const say = (role: 'user' | 'assistant', text: string, at: string): unknown => ({
  type: role,
  message: { role, content: role === 'user' ? text : [{ type: 'text', text }] },
  timestamp: at,
  cwd: '/w',
  gitBranch: 'master',
});

function fixture(): {
  env: Record<string, string | undefined>;
  cwd: string;
  dir: string;
  dbPath: string;
  file: (session?: string) => string;
  session: (rows: unknown[], session?: string) => void;
  lane: (agentId: string, meta: unknown, rows: unknown[]) => void;
  dispose: () => void;
} {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-anchor-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-anchor-cwd-'));
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

/** Where a record's line starts, in BYTES and in CHARACTERS, from the file itself. */
function offsets(file: string, needle: string): { bytes: number; chars: number } {
  const text = readFileSync(file, 'utf8');
  const chars = text.indexOf(needle);
  const lineStart = text.lastIndexOf('\n', chars) + 1;
  return { bytes: Buffer.byteLength(text.slice(0, lineStart)), chars: lineStart };
}

test('an anchor survives a rebuild, and the column it is not does not', () => {
  const f = fixture();
  try {
    f.session([
      say('user', 'come back to this', '2026-09-01T10:00:00.000Z'),
      say('assistant', 'the ruling is recorded here', '2026-09-01T10:00:01.000Z'),
    ]);
    rebuildConversations(f.dbPath, f.env, f.cwd, {});
    const at = offsets(f.file(), 'the ruling is recorded here').bytes;

    const index = ConversationIndex.open(f.dbPath);
    try {
      markAnchor(index, { sessionId: SESSION, byteOffset: at, label: 'the ruling' });
    } finally {
      index.close();
    }

    // ── THE COLUMN THIS TABLE EXISTS INSTEAD OF ───────────────────────────
    //
    // A hand value in a `conversations` column, written the way a
    // `title_override` column would be written: a direct UPDATE by whatever
    // command the owner typed, not a value any scan produced. It is written
    // through raw SQL DELIBERATELY — routing it through `upsert` would make
    // the write and the erasure the same statement, and then the assertion
    // below could not tell a rebuild that overwrites from one that does not.
    // `plan:archive seq:34` measured what happens next and this asserts it
    // rather than repeating it.
    const hand = new DatabaseSync(f.dbPath);
    hand.prepare('UPDATE conversations SET title_source = ? WHERE session_id = ?')
      .run('a value nobody scanned', SESSION);
    hand.close();

    const before = ConversationIndex.openReadOnlyChecked(f.dbPath);
    try {
      assert.equal(before.get(SESSION)?.titleSource, 'a value nobody scanned', 'it is there now');
    } finally {
      before.close();
    }

    // ONE REBUILD — the thing that happens at the end of every turn.
    rebuildConversations(f.dbPath, f.env, f.cwd, { full: true });

    const after = ConversationIndex.openReadOnlyChecked(f.dbPath);
    try {
      const kept = anchorsFor(after, SESSION);
      assert.equal(kept.length, 1, 'the anchor is still there — no writer of the scan can reach it');
      assert.equal(kept[0]!.label, 'the ruling');
      assert.equal(kept[0]!.byteOffset, at);

      assert.notEqual(
        after.get(SESSION)?.titleSource, 'a value nobody scanned',
        'and the COLUMN was erased by the same rebuild, which is the measurement the table '
        + 'choice rests on. If this ever goes red, `plan:archive seq:34` no longer holds and '
        + 'the design is re-openable.',
      );
    } finally {
      after.close();
    }
  } finally {
    f.dispose();
  }
});

test('an anchor survives removeMissing pruning the session row', () => {
  const f = fixture();
  try {
    f.session([say('assistant', 'the ruling is recorded here', '2026-09-01T10:00:00.000Z')]);
    rebuildConversations(f.dbPath, f.env, f.cwd, {});
    const at = offsets(f.file(), 'the ruling is recorded here').bytes;

    const index = ConversationIndex.open(f.dbPath);
    try {
      markAnchor(index, { sessionId: SESSION, byteOffset: at, label: 'the ruling' });
    } finally {
      index.close();
    }

    // The harness prunes the transcript. `removeMissing` deletes the whole
    // `conversations` row, and a column would go with it — `seq:11`'s ruling
    // and the second loss `seq:34` measured.
    removeTree(f.file());
    const report = rebuildConversations(f.dbPath, f.env, f.cwd, {});
    assert.equal(report.removed, 1, 'the row really was dropped');

    const after = ConversationIndex.openReadOnlyChecked(f.dbPath);
    try {
      assert.equal(after.get(SESSION), null, 'and nothing is left to hang a column on');
      const kept = anchorsFor(after, SESSION);
      assert.equal(
        kept.length, 1,
        'what the OWNER put there outlives what the scan found — the reason `persisted` is a '
        + 'table and the reason this is one',
      );
      assert.equal(kept[0]!.label, 'the ruling');

      assert.equal(
        resolveAnchor(after, kept[0]!.id), null,
        'and resolving it says plainly that the transcript is gone, rather than inventing a '
        + 'record — `INV-nothing-is-dropped-silently`',
      );
    } finally {
      after.close();
    }
  } finally {
    f.dispose();
  }
});

test('the position is a byte offset and resolves to the right record in a Hebrew transcript', () => {
  const f = fixture();
  try {
    f.session([
      say('user', 'תתחיל', '2026-09-01T10:00:00.000Z'),
      // Two Hebrew records ahead of the target, so every later offset differs
      // between bytes and characters by a provable amount.
      say('assistant', 'הארכיון נפתח ועכשיו אפשר לחפש בו בלי להתאמץ', '2026-09-01T10:00:01.000Z'),
      say('assistant', 'זאת השורה שלפני השורה שמחפשים', '2026-09-01T10:00:02.000Z'),
      say('assistant', 'the ruling is recorded here', '2026-09-01T10:00:03.000Z'),
    ]);
    rebuildConversations(f.dbPath, f.env, f.cwd, {});
    const { bytes, chars } = offsets(f.file(), 'the ruling is recorded here');
    assert.ok(
      bytes > chars,
      `the fixture must make the two numbers differ or this test proves nothing — bytes ${bytes} `
      + `characters ${chars}`,
    );

    const index = ConversationIndex.open(f.dbPath);
    try {
      const anchor = markAnchor(index, {
        sessionId: SESSION, byteOffset: bytes, label: 'the ruling',
      });

      const resolved = resolveAnchor(index, anchor.id);
      assert.ok(resolved !== null, 'the transcript is on disk, so it resolves');
      assert.equal(
        resolved.text, 'the ruling is recorded here',
        'the BYTE offset seeks to the record the owner marked. `iterateTranscript` walks bytes '
        + 'from the Buffer for this reason, and the corpus is Hebrew from record 5.',
      );

      // And the character offset, planted here as the mistake this guards
      // against, does NOT land on a record boundary at all.
      const wrong = markAnchor(index, {
        sessionId: SESSION, byteOffset: chars, label: 'the character offset',
      });
      assert.equal(
        resolveAnchor(index, wrong.id)?.text ?? null, null,
        'a character offset lands inside a record and reads as unreadable rather than throwing '
        + '— which is why it would have been wrong SILENTLY',
      );
    } finally {
      index.close();
    }
  } finally {
    f.dispose();
  }
});

test('marking the same point twice is one anchor, with the newer label', () => {
  const f = fixture();
  try {
    f.session([say('assistant', 'the ruling is recorded here', '2026-09-01T10:00:00.000Z')]);
    rebuildConversations(f.dbPath, f.env, f.cwd, {});
    const at = offsets(f.file(), 'the ruling is recorded here').bytes;

    const index = ConversationIndex.open(f.dbPath);
    try {
      const first = markAnchor(index, {
        sessionId: SESSION, byteOffset: at, label: 'a table', origin: 'automatic',
      });
      const second = markAnchor(index, {
        sessionId: SESSION, byteOffset: at, label: 'a table the owner named', origin: 'owner',
      });
      assert.equal(
        second.id, first.id,
        'the id is derived from WHERE the anchor is, not from when it was taken — anchors are '
        + 'set automatically as well as by hand (§7) and the automatic half runs every turn, so '
        + 'a clock-derived id would fill this table with copies of one bookmark',
      );
      const kept = anchorsFor(index, SESSION);
      assert.equal(kept.length, 1, 'one point, one row');
      assert.equal(kept[0]!.label, 'a table the owner named', 'and the newer label stands');
      assert.equal(kept[0]!.origin, 'owner');
    } finally {
      index.close();
    }
  } finally {
    f.dispose();
  }
});

test('anchors are scoped to a session, searchable by label, and a lane\'s anchor names the lane', () => {
  const f = fixture();
  const other = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';
  try {
    f.session([say('assistant', 'the ruling is recorded here', '2026-09-01T10:00:00.000Z')]);
    f.session([say('assistant', 'something else entirely', '2026-09-02T10:00:00.000Z')], other);
    f.lane('agent-one', { toolUseId: 'toolu_A', spawnDepth: 1 }, [
      say('assistant', 'the lane reported a table', '2026-09-01T10:00:01.000Z'),
    ]);
    rebuildConversations(f.dbPath, f.env, f.cwd, {});

    const index = ConversationIndex.open(f.dbPath);
    try {
      markAnchor(index, {
        sessionId: SESSION,
        byteOffset: offsets(f.file(), 'the ruling is recorded here').bytes,
        label: 'the ruling about offsets',
      });
      markAnchor(index, {
        sessionId: other,
        byteOffset: offsets(f.file(other), 'something else entirely').bytes,
        label: 'an unrelated note',
      });
      const laneFile = path.join(f.dir, SESSION, 'subagents', 'agent-one.jsonl');
      const laneAnchor = markAnchor(index, {
        sessionId: SESSION,
        agentId: 'agent-one',
        byteOffset: offsets(laneFile, 'the lane reported a table').bytes,
        label: 'the lane\'s table',
        kind: 'table',
        origin: 'automatic',
      });

      const mine = anchorsFor(index, SESSION);
      assert.deepEqual(
        mine.map((a) => a.label).sort(),
        ['the lane\'s table', 'the ruling about offsets'],
        'a session\'s anchors include its lanes\' and exclude another session\'s',
      );

      const found = searchAnchors(index, 'ruling');
      assert.equal(found.length, 1, 'the label is what a search over anchors matches');
      assert.equal(found[0]!.label, 'the ruling about offsets');
      assert.equal(
        searchAnchors(index, 'unrelated').length, 1,
        'and the search really does discriminate rather than returning everything',
      );

      const resolved = resolveAnchor(index, laneAnchor.id);
      assert.equal(
        resolved?.text, 'the lane reported a table',
        'a lane\'s anchor resolves against the LANE\'s transcript, not the session\'s — the '
        + 'archive is mostly lanes',
      );
      assert.equal(resolved?.anchor.agentId, 'agent-one');
    } finally {
      index.close();
    }
  } finally {
    f.dispose();
  }
});

test('an index built before the anchors table is OLD, not damaged, and a rebuild heals it', () => {
  const f = fixture();
  try {
    f.session([say('assistant', 'the ruling is recorded here', '2026-09-01T10:00:00.000Z')]);
    rebuildConversations(f.dbPath, f.env, f.cwd, {});

    const raw = new DatabaseSync(f.dbPath);
    raw.exec('DROP TABLE anchors');
    raw.close();

    assert.throws(
      () => ConversationIndex.openReadOnlyChecked(f.dbPath).close(),
      (err: unknown) => {
        assert.ok(
          err instanceof ConversationIndexIncompleteError,
          'a new table is a new schema version, and an older shape is REPAIRABLE rather than '
          + 'damage — `plan:archive seq:12`/`seq:33`',
        );
        assert.ok(err.missing.includes('anchors'), 'and it NAMES what is missing');
        return true;
      },
    );

    rebuildConversations(f.dbPath, f.env, f.cwd, {});
    const healed = ConversationIndex.open(f.dbPath);
    try {
      assert.equal(
        anchorsFor(healed, SESSION).length, 0,
        'the table is back and empty — an anchor is the owner\'s and no rebuild can invent one',
      );
    } finally {
      healed.close();
    }
    ConversationIndex.openReadOnlyChecked(f.dbPath).close();
  } finally {
    f.dispose();
  }
});
