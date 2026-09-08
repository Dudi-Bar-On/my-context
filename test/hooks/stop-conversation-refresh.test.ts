// @basis TASK-the-archive-shows-what-is-on-disk-now-because-nothing-has, INV-nothing-is-dropped-silently
/**
 * **`Stop` is what keeps the conversation index current, and this is where it
 * is decided that it may** — `plan:archive seq:14`.
 *
 * ── WHAT THIS FILE IS ACTUALLY DEFENDING ───────────────────────────────────
 *
 * `test/core/conversation-refresh.test.ts` proves the refresh is CORRECT and
 * cheap. Nothing there says it ever runs. That was the entire defect: the
 * mechanism existed, was correct, and had one caller — a person typing
 * `mycontext conversation rebuild` — so the archive screen served rows from
 * 2026-09-07T04:03 while the transcript beneath them had grown 11,231,042
 * bytes past.
 *
 * So what is proved here is the CALL SITE and its refusals:
 *
 *   1. **A turn ending brings the index up to date.** The one assertion that
 *      would have failed on the tree this item was written against, whatever
 *      else was green.
 *   2. **It never builds an index nobody asked for.** A hook that created the
 *      conversation tables on first sight would opt every workspace with this
 *      plugin installed into indexing its transcripts, silently, on somebody
 *      else's machine. `openReadOnlyChecked` is the door that asks without
 *      answering, and the assertion is on the DATABASE afterwards — no table,
 *      not merely "returned null".
 *   3. **A subagent declines**, for `stopUpkeep`'s measured reason: a fan-out
 *      of ten finishing at once is ten writers reaching for one SQLite file
 *      inside one second.
 *   4. **The row says what moved, and says nothing when nothing did.** `Stop`
 *      fires on every assistant turn; a clause on every one of them would put
 *      a per-turn liveness report into the one log line that says where an
 *      exchange ended, which `observe.ts` has already ruled against.
 *
 * `CLAUDE_CONFIG_DIR` is redirected per test — the variable the product itself
 * honours, so the path taken is the real one — and restored afterwards, so a
 * test that failed part-way cannot leak a transcript directory into the next.
 * Nothing here reads or writes the developer's own `~/.claude`.
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, appendFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { runCli } from '../../src/cli/index.ts';
import { readAudit } from '../../src/core/audit.ts';
import {
  ConversationIndex, projectDirName, rebuildConversations, type RebuildReport,
} from '../../src/core/conversation-index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { observeAndRecord } from '../../src/hooks/observe.ts';
import {
  refreshNote, stopConversationRefresh, stopSpec,
} from '../../src/hooks/stop.ts';
import { removeTree } from '../helpers/tmp.ts';

const bases: string[] = [];
after(() => { for (const base of bases) removeTree(base); });

const SESSION = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

interface Sandbox {
  /** The repository directory a hook payload carries as `cwd`. */
  cwd: string;
  /** The `.my_context` directory. */
  root: string;
  dbPath: string;
  /** A throwaway `~/.claude`. */
  home: string;
  /** Where transcripts for this workspace live. */
  dir: string;
  file: string;
  append: (lines: unknown[]) => void;
}

const said = (t: string): unknown[] => [{ type: 'text', text: t }];

/** One exchange: a typed prompt, a tool step, and an answer in words. */
function exchange(n: number): unknown[] {
  return [
    {
      type: 'user',
      message: { role: 'user', content: `ask ${n}` },
      timestamp: `2026-09-0${n}T10:00:00.000Z`,
      gitBranch: 'master',
      cwd: '/w',
    },
    {
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Read' }] },
      timestamp: `2026-09-0${n}T10:00:01.000Z`,
    },
    {
      type: 'assistant',
      message: { role: 'assistant', content: said(`answer ${n}`) },
      timestamp: `2026-09-0${n}T10:00:02.000Z`,
    },
  ];
}

/** A real workspace, and a real transcript directory the harness's encoding names. */
function sandbox(): Sandbox {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-stop-refresh-'));
  bases.push(cwd);
  runCli(['init'], cwd, () => {});
  const root = resolveWorkspace(cwd).projectRoot;
  assert.ok(root, 'the sandbox has no workspace');

  const home = path.join(cwd, 'claude-home');
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${SESSION}.jsonl`);
  writeFileSync(
    file, exchange(1).map((line) => JSON.stringify(line)).join('\n') + '\n',
  );

  return {
    cwd,
    root,
    dbPath: path.join(root, '.index.db'),
    home,
    dir,
    file,
    append: (lines) => {
      appendFileSync(file, lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
    },
  };
}

/**
 * Run `body` with `CLAUDE_CONFIG_DIR` pointing at the sandbox's throwaway home.
 *
 * The variable is set on `process.env` and not passed as an argument because
 * `stopConversationRefresh` reads `process.env` — a hook has no other place to
 * get it from — so a test that injected it would be testing a seam production
 * does not use. Restored in a `finally` for the obvious reason and one less
 * obvious one: the suite runs many files in one process.
 */
function withHome<T>(sb: Sandbox, body: () => T): T {
  const before = process.env['CLAUDE_CONFIG_DIR'];
  process.env['CLAUDE_CONFIG_DIR'] = sb.home;
  try {
    return body();
  } finally {
    if (before === undefined) delete process.env['CLAUDE_CONFIG_DIR'];
    else process.env['CLAUDE_CONFIG_DIR'] = before;
  }
}

/** Does this database hold the conversation table at all? */
function hasConversations(dbPath: string): boolean {
  if (!existsSync(dbPath)) return false;
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'conversations'",
    ).get();
    return row !== undefined;
  } finally {
    db.close();
  }
}

test('a turn ending brings the conversation index up to date with the file on disk', () => {
  const sb = sandbox();
  withHome(sb, () => {
    // The state a person leaves behind by running the command once — which,
    // until this item, was the only state the index was ever in.
    rebuildConversations(sb.dbPath, process.env, sb.cwd, {});
    const before = ConversationIndex.openReadOnlyChecked(sb.dbPath);
    const stale = before.get(SESSION);
    before.close();
    assert.equal(stale?.records, 3);
    assert.equal(stale?.endedAt, '2026-09-01T10:00:02.000Z');

    // The session keeps going. Nothing anywhere runs the command again.
    sb.append(exchange(2));

    const report = stopConversationRefresh({ cwd: sb.cwd });
    assert.notEqual(report, null, 'the hook must not decline in a workspace that has an index');
    assert.equal((report as RebuildReport).appended, 1, 'and it took the cheap path');
    assert.equal((report as RebuildReport).scanned, 0, 'reading no byte it had read before');

    const after = ConversationIndex.openReadOnlyChecked(sb.dbPath);
    const fresh = after.get(SESSION);
    after.close();
    assert.equal(fresh?.records, 6, 'the row now counts what the file holds');
    assert.equal(fresh?.prompts, 2);
    assert.equal(
      fresh?.endedAt, '2026-09-02T10:00:02.000Z',
      'and its end time is the transcript\'s, not the last person-run rebuild\'s',
    );
  });
});

test('the refresh never builds an index nobody has ever asked for', () => {
  const sb = sandbox();
  withHome(sb, () => {
    assert.equal(
      hasConversations(sb.dbPath), false,
      'the fixture must start with no conversation index, or this proves nothing',
    );

    assert.equal(
      stopConversationRefresh({ cwd: sb.cwd }), null,
      'a workspace nobody has scanned in is declined',
    );

    // The assertion that matters is on the DATABASE and not on the return
    // value: a hook that answered `null` and created the tables anyway would
    // pass the line above and still have opted the workspace in.
    assert.equal(
      hasConversations(sb.dbPath), false,
      'and no table was created on the way to declining',
    );
  });
});

test('a subagent declines, so a fan-out is not ten writers reaching for one file', () => {
  const sb = sandbox();
  withHome(sb, () => {
    rebuildConversations(sb.dbPath, process.env, sb.cwd, {});
    sb.append(exchange(2));
    assert.equal(stopConversationRefresh({ cwd: sb.cwd, agent_id: 'agent-7' }), null);

    const index = ConversationIndex.openReadOnlyChecked(sb.dbPath);
    const row = index.get(SESSION);
    index.close();
    assert.equal(row?.records, 3, 'the row is untouched — the subagent wrote nothing');
  });
});

test('a payload with no workspace under it is declined rather than thrown on', () => {
  const outside = mkdtempSync(path.join(tmpdir(), 'myctx-stop-refresh-none-'));
  bases.push(outside);
  assert.equal(stopConversationRefresh({ cwd: outside }), null);
});

test('the note says what the refresh moved, and says nothing at all when nothing moved', () => {
  assert.equal(refreshNote(null), '', 'a declined refresh contributes no clause');

  const base: RebuildReport = {
    dir: '/w', found: 1, scanned: 0, appended: 0, skipped: 1, removed: 0,
    truncated: [], bytesRead: 0, ms: 2,
    subagents: {
      found: 0, scanned: 0, appended: 0, skipped: 0, removed: 0,
      truncated: [], unlinked: 0, bytesRead: 0,
    },
  };
  assert.equal(
    refreshNote(base), '',
    'a turn on which the index was already current is silent — Stop fires on every one of them',
  );

  const grew = refreshNote({ ...base, appended: 1, skipped: 0, bytesRead: 43_118 });
  assert.match(grew, /the conversation index was refreshed/);
  assert.match(grew, /only the appended tail was read/);
  // The BYTES, because the number is the whole argument for running this per
  // turn: a run of rows reporting the file's full size would be the append
  // path having quietly stopped working, and nothing else would report it.
  assert.match(grew, /43118 byte\(s\)/);

  const gone = refreshNote({ ...base, removed: 2, skipped: 0 });
  assert.match(gone, /2 indexed session\(s\) no longer on disk/);

  // ── THE LANES, ON THE SAME RULE ──────────────────────────────────────────
  //
  // A subagent transcript is finished when its lane returns, so in the steady
  // state this clause is ABSENT and its appearance is the fact worth finding:
  // lanes ran during that turn. `plan:archive seq:12`.
  const quietLanes = refreshNote({
    ...base, subagents: { ...base.subagents, found: 253, skipped: 253 },
  });
  assert.equal(
    quietLanes, '',
    '253 lanes all unchanged is the ordinary turn and must stay silent — a clause that fired on '
    + 'every turn would put a per-turn "still up to date" report into the one line that says '
    + 'where an exchange ended',
  );

  const lanesRan = refreshNote({
    ...base,
    skipped: 0,
    appended: 1,
    bytesRead: 43_118,
    subagents: {
      ...base.subagents, found: 253, skipped: 251, scanned: 2, bytesRead: 1_204_882,
    },
  });
  assert.match(lanesRan, /2 subagent transcript\(s\) read whole/);
  // The lanes' bytes are their OWN number and not folded into the session's.
  // 615.3 MB of lanes against 65 MB of session was measured in this workspace,
  // so one total would hide which of the two a slow turn actually paid for.
  assert.match(lanesRan, /\(1204882 byte\(s\)\)/);
  assert.match(lanesRan, /43118 byte\(s\) in 2ms/);

  // An unreadable `.meta.json` is what `plan:archive seq:15` cannot open, and
  // a silent zero would look exactly like a session that dispatched none.
  const unlinked = refreshNote({
    ...base, skipped: 0, subagents: { ...base.subagents, found: 1, scanned: 1, unlinked: 1 },
  });
  assert.match(unlinked, /1 with no readable \.meta\.json/);
});

test('what the refresh did reaches the audit row, because stdout leaves no trace', () => {
  const sb = sandbox();
  withHome(sb, () => {
    rebuildConversations(sb.dbPath, process.env, sb.cwd, {});
    sb.append(exchange(2));
    const report = stopConversationRefresh({ cwd: sb.cwd });

    observeAndRecord(
      stopSpec(null, report),
      {
        session_id: 'refresh-sess', cwd: sb.cwd, hook_event_name: 'Stop',
        stop_hook_active: false,
      },
      sb.cwd,
    );

    const rows = readAudit(sb.root).filter((r) => r.op === 'stop');
    assert.equal(rows.length, 1);
    assert.match(String(rows[0]?.note), /the conversation index was refreshed/);
    // The clause that was already there is still there, ahead of the new one.
    assert.match(String(rows[0]?.note), /the assistant turn ended/);
  });
});
