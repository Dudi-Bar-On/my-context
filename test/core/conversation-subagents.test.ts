// @basis TASK-the-work-done-in-subagents-is-indexed-and-kept-because-that, INV-nothing-is-dropped-silently
/**
 * **Subagent transcripts are indexed, kept, and linked to the turn that
 * dispatched them** — `plan:archive seq:12`.
 *
 * What is worth proving here, and what is scaffolding for it.
 *
 *   1. **The link is real and it is TWO facts.** `the link from a lane to the
 *      turn that dispatched it is recorded, not inferred` builds a session
 *      that dispatches a lane, and a lane that dispatches another, and asserts
 *      each is reachable from the right transcript. Measured on the real
 *      workspace 2026-09-08: 211 lanes at depth 1 whose `toolUseId` is an
 *      `Agent` call in the SESSION, and 43 at depth 2 whose `toolUseId` is an
 *      `Agent` call in ANOTHER LANE — so a build storing only the session
 *      would mis-file a fifth of them. `plan:archive seq:15` is what this is
 *      for and it cannot be built on one fact.
 *   2. **Old indexes migrate rather than break.** `an index built before the
 *      subagents table is OLD, not damaged` is the regression test for a
 *      defect that reached the owner's running server: the read door reported
 *      a merely-outdated index as damage, the screen drew no files, and the
 *      Stop hook's gate then declined for ever — so nothing would ever have
 *      created the missing table. Both halves are asserted: the distinct error
 *      class, and that a rebuild heals it.
 *   3. **The counts account for every record.** `prompts + answers + machinery
 *      === records` on a subagent transcript, which is the identity
 *      `ConversationRow.machinery` always promised and did not hold: records
 *      of any other type landed in none of the three. `attachment` is 29% of a
 *      real subagent transcript, so this is the difference between a count and
 *      a guess.
 *
 * Everything runs against FIXTURES in a temp directory, never the developer's
 * own `~/.claude`: `CLAUDE_CONFIG_DIR` is redirected per test, which is the
 * variable the product honours and therefore the code path a real run takes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  ConversationIndex, ConversationIndexIncompleteError, listSubagentFiles, projectDirName,
  readSubagentMeta, rebuildConversations, subagentDir,
} from '../../src/core/conversation-index.ts';
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

/** The `Agent` tool call a parent makes, carrying the id the sidecar names. */
const dispatch = (toolUseId: string, at: string): unknown => ({
  type: 'assistant',
  message: {
    role: 'assistant',
    content: [{ type: 'tool_use', id: toolUseId, name: 'Agent', input: { prompt: 'go' } }],
  },
  timestamp: at,
});

function fixture(): {
  env: Record<string, string | undefined>;
  cwd: string;
  dir: string;
  dbPath: string;
  session: (lines: unknown[]) => void;
  lane: (agentId: string, meta: unknown, lines: unknown[]) => void;
  dispose: () => void;
} {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-sub-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-sub-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const dbPath = path.join(cwd, 'index.db');
  Store.open(dbPath).close();

  const lines = (rows: unknown[]): string =>
    rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

  return {
    env: { CLAUDE_CONFIG_DIR: home },
    cwd,
    dir,
    dbPath,
    session: (rows) => writeFileSync(path.join(dir, `${SESSION}.jsonl`), lines(rows)),
    lane: (agentId, meta, rows) => {
      const lane = path.join(dir, SESSION, 'subagents');
      mkdirSync(lane, { recursive: true });
      writeFileSync(path.join(lane, `${agentId}.jsonl`), lines(rows));
      // `null` means "write no sidecar at all", which is the unlinked case.
      if (meta !== null) {
        writeFileSync(path.join(lane, `${agentId}.meta.json`), JSON.stringify(meta));
      }
    },
    dispose: () => {
      removeTree(home);
      removeTree(cwd);
    },
  };
}

test('the link from a lane to the turn that dispatched it is recorded, not inferred', () => {
  const f = fixture();
  try {
    // The session dispatches one lane; that lane dispatches another. This is
    // the real shape measured on 2026-09-08 — 211 lanes at depth 1 and 43 at
    // depth 2 — and it is the reason the parent is two fields rather than one.
    f.session([
      say('user', 'do the thing', '2026-09-01T10:00:00.000Z'),
      dispatch('toolu_OUTER', '2026-09-01T10:00:01.000Z'),
    ]);
    f.lane(
      'agent-outer',
      { agentType: 'general-purpose', description: 'the outer lane', toolUseId: 'toolu_OUTER', spawnDepth: 1 },
      [
        say('user', 'the brief', '2026-09-01T10:00:02.000Z'),
        dispatch('toolu_INNER', '2026-09-01T10:00:03.000Z'),
        say('assistant', 'the report', '2026-09-01T10:00:09.000Z'),
      ],
    );
    f.lane(
      'agent-inner',
      {
        agentType: 'Explore', description: 'the inner lane', toolUseId: 'toolu_INNER',
        parentAgentId: 'outer', spawnDepth: 2, model: 'opus', isFork: false,
      },
      [say('assistant', 'found it', '2026-09-01T10:00:05.000Z')],
    );

    rebuildConversations(f.dbPath, f.env, f.cwd, {});
    const index = ConversationIndex.openReadOnlyChecked(f.dbPath);
    try {
      const lanes = index.subagentsOf(SESSION);
      assert.equal(lanes.length, 2, 'both lanes are indexed under the session that owns them');

      const outer = index.getSubagent('agent-outer');
      assert.equal(outer?.toolUseId, 'toolu_OUTER');
      assert.equal(
        outer?.parentAgentId, null,
        'null means THE SESSION dispatched it — the tool_use id above is an `Agent` call in the '
        + 'session transcript, and that is where a screen must look for it',
      );
      assert.equal(outer?.spawnDepth, 1);

      const inner = index.getSubagent('agent-inner');
      assert.equal(inner?.toolUseId, 'toolu_INNER');
      assert.equal(
        inner?.parentAgentId, 'outer',
        'a lane dispatched by a LANE names it, because its `Agent` call is in that lane\'s '
        + 'transcript and NOT in the session\'s. Measured: 43 of 254 are like this, so a build '
        + 'that looked only in the session would fail to link a fifth of them.',
      );
      assert.equal(inner?.spawnDepth, 2);
      assert.equal(inner?.sessionId, SESSION, 'and it still belongs to the session that owns it');

      // The lookup `plan:archive seq:15` actually performs: from a tool_use id
      // seen in a rendered step, to the transcript that step produced.
      assert.equal(index.subagentByToolUse('toolu_INNER')?.agentId, 'agent-inner');
      assert.equal(index.subagentByToolUse('toolu_NOTHING'), null);

      // The id in the sidecar really is the id in the dispatching transcript,
      // proved against the FILE rather than against the fixture's variable —
      // otherwise this asserts the test agrees with itself.
      const sessionText = readFileSync(path.join(f.dir, `${SESSION}.jsonl`), 'utf8');
      assert.ok(sessionText.includes('"id":"toolu_OUTER"'));
      const outerText = readFileSync(
        path.join(f.dir, SESSION, 'subagents', 'agent-outer.jsonl'), 'utf8',
      );
      assert.ok(
        outerText.includes('"id":"toolu_INNER"') && !outerText.includes('"id":"toolu_OUTER"'),
        'the inner lane\'s dispatching call is in the OUTER lane\'s transcript, which is the '
        + 'whole reason parent_agent_id exists',
      );
    } finally {
      index.close();
    }
  } finally {
    f.dispose();
  }
});

test('a lane with no readable sidecar is indexed and disclosed, never dropped', () => {
  const f = fixture();
  try {
    f.session([say('user', 'go', '2026-09-01T10:00:00.000Z')]);
    f.lane('agent-nometa', null, [say('assistant', 'worked', '2026-09-01T10:00:01.000Z')]);
    f.lane('agent-badmeta', null, [say('assistant', 'also worked', '2026-09-01T10:00:02.000Z')]);
    // A sidecar that is not JSON at all. The transcript beside it is the thing
    // worth keeping, and the harness owns this file's schema.
    writeFileSync(
      path.join(f.dir, SESSION, 'subagents', 'agent-badmeta.meta.json'), '{not json',
    );

    const report = rebuildConversations(f.dbPath, f.env, f.cwd, {});
    assert.equal(report.subagents.found, 2);
    assert.equal(
      report.subagents.unlinked, 2,
      'COUNTED, because an unlinked lane is exactly what seq:15 cannot open, and a silent zero '
      + 'here would be indistinguishable from a session that dispatched none',
    );

    const index = ConversationIndex.openReadOnlyChecked(f.dbPath);
    try {
      const lanes = index.subagentsOf(SESSION);
      assert.equal(lanes.length, 2, 'both are still INDEXED and still readable');
      for (const lane of lanes) {
        assert.equal(lane.toolUseId, null, 'only the link is missing');
        assert.ok(lane.records > 0, 'the transcript was still scanned');
      }
    } finally {
      index.close();
    }

    assert.equal(readSubagentMeta(path.join(f.dir, SESSION, 'subagents'), 'agent-badmeta'), null);
  } finally {
    f.dispose();
  }
});

test('prompts + answers + machinery accounts for EVERY record, of every type', () => {
  const f = fixture();
  try {
    f.session([say('user', 'go', '2026-09-01T10:00:00.000Z')]);
    f.lane('agent-mixed', { toolUseId: 'toolu_X', spawnDepth: 1 }, [
      say('user', 'the brief', '2026-09-01T10:00:01.000Z'),
      say('assistant', 'the answer', '2026-09-01T10:00:02.000Z'),
      // The types that used to fall into NO column at all. `attachment` is 29%
      // of a real subagent transcript, measured over 99,760 records.
      { type: 'attachment', timestamp: '2026-09-01T10:00:03.000Z' },
      { type: 'attachment', timestamp: '2026-09-01T10:00:04.000Z' },
      { type: 'queue-operation', timestamp: '2026-09-01T10:00:05.000Z' },
      { type: 'file-history-snapshot', timestamp: '2026-09-01T10:00:06.000Z' },
      { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'ok' }] }, timestamp: '2026-09-01T10:00:07.000Z' },
    ]);

    rebuildConversations(f.dbPath, f.env, f.cwd, {});
    const index = ConversationIndex.openReadOnlyChecked(f.dbPath);
    try {
      const lane = index.getSubagent('agent-mixed');
      assert.ok(lane !== null);
      assert.equal(lane.records, 7);
      assert.equal(lane.prompts, 1, 'one typed brief');
      assert.equal(lane.answers, 1, 'one answer in words');
      assert.equal(
        lane.machinery, 5,
        'the tool_result AND the four records of other types. Before this they landed in none '
        + 'of the three and the row silently failed to add up.',
      );
      assert.equal(
        lane.prompts + lane.answers + lane.machinery, lane.records,
        'THE IDENTITY. `machinery` is the remainder, so the two headline numbers can be checked '
        + 'against the total rather than believed — INV-nothing-is-dropped-silently.',
      );
    } finally {
      index.close();
    }
  } finally {
    f.dispose();
  }
});

test('an index built before the subagents table is OLD, not damaged, and a rebuild heals it', () => {
  const f = fixture();
  try {
    f.session([say('user', 'go', '2026-09-01T10:00:00.000Z')]);
    f.lane('agent-one', { toolUseId: 'toolu_A', spawnDepth: 1 }, [
      say('assistant', 'done', '2026-09-01T10:00:01.000Z'),
    ]);
    rebuildConversations(f.dbPath, f.env, f.cwd, {});

    // Put the database back into the shape EVERY EXISTING WORKSPACE is in the
    // moment this ships: `conversations` present, `subagents` never created.
    const raw = new DatabaseSync(f.dbPath);
    raw.exec('DROP TABLE subagents');
    raw.close();

    // ── THE DEFECT THIS PINS ────────────────────────────────────────────────
    //
    // Reported from the owner's own running server, 2026-09-08: the sessions
    // list drew no files and printed the read door's refusal verbatim. Worse
    // than the message was the shape — `stopConversationRefresh` gates on this
    // open and declined on any throw, so the automatic refresh stopped for
    // good, and the automatic refresh was the only thing that would have
    // created the missing table.
    assert.throws(
      () => ConversationIndex.openReadOnlyChecked(f.dbPath).close(),
      (err: unknown) => {
        assert.ok(
          err instanceof ConversationIndexIncompleteError,
          'its OWN class, so a caller can tell "a schema behind" from damage without matching '
          + 'on a message — which is what lets the Stop hook heal it and the screen serve an '
          + 'empty state instead of a 500',
        );
        assert.deepEqual(err.missing, ['subagents'], 'and it NAMES what is missing');
        assert.match(String(err.message), /rebuild/, 'and the repair is composed, never run');
        return true;
      },
    );

    // THE HEAL. A write path creates the table, and the rows come back from
    // the transcripts on disk — which is the property that makes this index
    // disposable in the first place.
    const report = rebuildConversations(f.dbPath, f.env, f.cwd, {});
    assert.equal(report.subagents.found, 1);
    const index = ConversationIndex.openReadOnlyChecked(f.dbPath);
    try {
      assert.equal(index.getSubagent('agent-one')?.toolUseId, 'toolu_A');
    } finally {
      index.close();
    }
  } finally {
    f.dispose();
  }
});

test('an index missing `conversations` is still damage, so the guard is not weakened', () => {
  const f = fixture();
  try {
    f.session([say('user', 'go', '2026-09-01T10:00:00.000Z')]);
    rebuildConversations(f.dbPath, f.env, f.cwd, {});
    const raw = new DatabaseSync(f.dbPath);
    raw.exec('DROP TABLE conversations');
    raw.close();

    // Nothing has ever created `subagents` without `conversations`, so a file
    // in this shape was edited by something that is not this code. It must NOT
    // arrive as the repairable state — that distinction is the whole point of
    // the new class, and a guard that called everything repairable would be
    // the guard being weakened rather than taught.
    assert.throws(
      () => ConversationIndex.openReadOnlyChecked(f.dbPath).close(),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(
          !(err instanceof ConversationIndexIncompleteError),
          'damage is not an upgrade, and reporting it as one would let a background hook quietly '
          + 'rewrite a database nobody has looked at',
        );
        assert.match(String(err.message), /Half an index is damage/);
        return true;
      },
    );
  } finally {
    f.dispose();
  }
});

test('an unchanged lane is skipped after one stat, and a lane that grew is caught up by its tail', () => {
  const f = fixture();
  try {
    f.session([say('user', 'go', '2026-09-01T10:00:00.000Z')]);
    f.lane('agent-live', { toolUseId: 'toolu_L', spawnDepth: 1 }, [
      say('assistant', 'first', '2026-09-01T10:00:01.000Z'),
    ]);
    const first = rebuildConversations(f.dbPath, f.env, f.cwd, {});
    assert.equal(first.subagents.scanned, 1);

    const second = rebuildConversations(f.dbPath, f.env, f.cwd, {});
    assert.equal(second.subagents.skipped, 1, 'size and mtime both matched');
    assert.equal(
      second.subagents.bytesRead, 0,
      'and NOTHING was read. Measured on the real workspace: 254 lanes and 615 MB reduce to 18 '
      + 'ms and zero bytes once warm, which is what makes this affordable on the Stop hook.',
    );

    // A RUNNING lane appends, which is not hypothetical: the first incremental
    // run on the real workspace caught 2 of 254 growing, because two lanes were
    // live at that moment.
    const file = path.join(f.dir, SESSION, 'subagents', 'agent-live.jsonl');
    const before = statSync(file).size;
    writeFileSync(
      file,
      readFileSync(file, 'utf8') + JSON.stringify(say('assistant', 'second', '2026-09-01T10:00:09.000Z')) + '\n',
    );

    const third = rebuildConversations(f.dbPath, f.env, f.cwd, {});
    assert.equal(third.subagents.appended, 1, 'the tail path, not a whole re-read');
    assert.equal(
      third.subagents.bytesRead, statSync(file).size - before,
      'exactly the appended tail, and not one byte of what was already indexed',
    );

    // THE EQUALITY, against a `--full` rebuild rather than remembered numbers,
    // which is `conversation-refresh.test.ts`' rule: a divergence in either
    // path must fail rather than be believed.
    const otherDb = path.join(f.cwd, 'other.db');
    Store.open(otherDb).close();
    rebuildConversations(otherDb, f.env, f.cwd, { full: true });
    const a = ConversationIndex.openReadOnlyChecked(f.dbPath);
    const b = ConversationIndex.openReadOnlyChecked(otherDb);
    try {
      const composed = a.getSubagent('agent-live');
      const whole = b.getSubagent('agent-live');
      assert.ok(composed !== null && whole !== null);
      const comparable = (r: NonNullable<typeof composed>): unknown =>
        ({ ...r, scannedAt: '' });
      assert.deepEqual(
        comparable(composed), comparable(whole),
        'the composed row and the whole-read row must be the same row',
      );
      assert.equal(composed.records, 2);
      assert.equal(composed.answers, 2);
    } finally {
      a.close();
      b.close();
    }
  } finally {
    f.dispose();
  }
});

test('a lane whose transcript is gone drops its row, and only for the session that was walked', () => {
  const f = fixture();
  try {
    f.session([say('user', 'go', '2026-09-01T10:00:00.000Z')]);
    f.lane('agent-kept', { toolUseId: 'toolu_K', spawnDepth: 1 }, [
      say('assistant', 'a', '2026-09-01T10:00:01.000Z'),
    ]);
    f.lane('agent-pruned', { toolUseId: 'toolu_P', spawnDepth: 1 }, [
      say('assistant', 'b', '2026-09-01T10:00:02.000Z'),
    ]);
    rebuildConversations(f.dbPath, f.env, f.cwd, {});

    // A row belonging to a session this walk never lists. `removeMissing` for
    // conversations is global; the subagent sweep must NOT be, or the first
    // refresh after a session's transcript is pruned would delete every lane
    // it ever dispatched on the strength of a directory nobody looked in.
    const raw = new DatabaseSync(f.dbPath);
    raw.exec(
      "INSERT INTO subagents VALUES ('agent-elsewhere','other-session',NULL,'toolu_E',NULL," +
      "NULL,NULL,1,0,'/gone.jsonl',1,1,1,NULL,NULL,0,0,0,0,0,NULL,NULL,'2026-09-01T00:00:00Z')",
    );
    raw.close();

    removeTree(path.join(f.dir, SESSION, 'subagents', 'agent-pruned.jsonl'));
    const report = rebuildConversations(f.dbPath, f.env, f.cwd, {});
    assert.equal(report.subagents.removed, 1, 'the pruned lane, and it is REPORTED');

    const index = ConversationIndex.openReadOnlyChecked(f.dbPath);
    try {
      assert.equal(index.getSubagent('agent-pruned'), null);
      assert.ok(index.getSubagent('agent-kept') !== null);
      assert.ok(
        index.getSubagent('agent-elsewhere') !== null,
        'a lane of a session this walk never listed is UNTOUCHED — knowledge does not leave the '
        + 'archive on the strength of a directory nobody opened',
      );
      assert.equal(index.subagentCounts().get(SESSION), 1);
    } finally {
      index.close();
    }
  } finally {
    f.dispose();
  }
});

test('the listing is keyed on the extension, so a lane and its sidecar are not two lanes', () => {
  const f = fixture();
  try {
    f.session([say('user', 'go', '2026-09-01T10:00:00.000Z')]);
    f.lane('agent-one', { toolUseId: 'toolu_A', spawnDepth: 1 }, [
      say('assistant', 'done', '2026-09-01T10:00:01.000Z'),
    ]);
    const dir = subagentDir(f.env, f.cwd, SESSION);
    const found = listSubagentFiles(dir);
    assert.equal(
      found.length, 1,
      'ONE lane. `agent-<id>.jsonl` and `agent-<id>.meta.json` share a stem, so a listing keyed '
      + 'on a prefix rather than on the extension would find every lane twice.',
    );
    assert.equal(found[0]?.agentId, 'agent-one');
    assert.equal(found[0]?.meta?.toolUseId, 'toolu_A');

    // A session that dispatched no lanes is an ordinary state, not a fault.
    assert.deepEqual(listSubagentFiles(subagentDir(f.env, f.cwd, 'never-ran')), []);
  } finally {
    f.dispose();
  }
});
