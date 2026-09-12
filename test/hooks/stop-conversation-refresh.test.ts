// @basis TASK-the-archive-shows-what-is-on-disk-now-because-nothing-has,
// TASK-the-archive-is-opt-in-which-was-decided-and-never-built,
// INV-nothing-is-dropped-silently,
// REQ-every-anchor-capability-is-reachable-from-the-screen-and-a
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
  ConversationIndex, forgetConversations, projectDirName, rebuildConversations, type RebuildReport,
} from '../../src/core/conversation-index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import type { AutoAnchorReport } from '../../src/core/anchor-pass.ts';
import type { SearchBuildReport } from '../../src/core/conversation-search.ts';
import { observeAndRecord } from '../../src/hooks/observe.ts';
import { CONFIRM_ATTEMPTS, CONFIRM_POLL_MS } from '../../src/core/ui-server-upkeep.ts';
import {
  ANCHOR_HALF_CEILING_MS, ANCHOR_PASS_BUDGET_MS, ANCHOR_PASS_FLOOR_MS, anchorPassBudget,
  refreshNote, stopConversationRefresh, stopSpec, type ConversationRefresh,
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

/**
 * **The opt-in has an OFF position, and this is what makes it one** —
 * `plan:archive seq:9`.
 *
 * The item asks for the archive to be opt-in with a key defaulting to OFF, and
 * reports that no such key exists. The OFF DEFAULT already held — the test
 * above this one is the proof of it, and `forgetConversations`' own header
 * names the three places that enforce it. What did not exist was a way BACK:
 * once a workspace had been scanned, this hook refreshed for ever, and the
 * only way to stop it was deleting `.index.db`, which is also the corpus's own
 * item index.
 *
 * So the property worth testing is not "the rows are gone" — a `DELETE` would
 * do that and would be an opt-out that silently undid itself on the next turn,
 * because the gate asks whether the TABLES exist and not whether they hold
 * anything. It is that the workspace ends up in exactly the state the test
 * above proves the hook declines to act on.
 */
test('forgetting the index puts the workspace back where the refresh will not follow', () => {
  const sb = sandbox();
  withHome(sb, () => {
    rebuildConversations(sb.dbPath, process.env, sb.cwd, {});
    assert.equal(hasConversations(sb.dbPath), true, 'the fixture must start opted IN');
    sb.append(exchange(2));
    assert.notEqual(
      stopConversationRefresh({ cwd: sb.cwd }), null,
      'and the hook must be following it, or the opt-out below proves nothing',
    );

    const report = forgetConversations(sb.dbPath);
    assert.equal(report.indexed, true, 'there was an index to forget');
    assert.equal(report.conversations, 1, 'and it says what left, rather than shrinking quietly');

    assert.equal(
      hasConversations(sb.dbPath), false,
      'the tables are DROPPED and not merely emptied — an empty index is one this hook still '
      + 'opens, so it would refill on the next turn and the opt-out would have undone itself',
    );
    sb.append(exchange(3));
    assert.equal(
      stopConversationRefresh({ cwd: sb.cwd }), null,
      'and the hook now declines exactly as it does in a workspace nobody ever scanned',
    );
    assert.equal(
      hasConversations(sb.dbPath), false,
      'having created nothing on the way to declining',
    );

    // Nothing was lost that the transcripts cannot give back: this index is a
    // cache and the file on disk is the source of truth.
    rebuildConversations(sb.dbPath, process.env, sb.cwd, {});
    const back = ConversationIndex.openReadOnlyChecked(sb.dbPath);
    const row = back.get(SESSION);
    back.close();
    assert.equal(row?.records, 9, 'and one rebuild brings the whole thing back from disk');
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

/**
 * **THE MIRRORS REACH THE AUDIT ROW, AND ONLY WHEN THEY MOVED** —
 * `plan:archive seq:4`.
 *
 * The mark is a standing instruction acted on by a background hook, so the
 * audit row is the ONLY place a person can later find out that bytes were
 * copied out of the harness's directory on their behalf. `stdout` leaves no
 * trace, and the copy itself carries no history.
 *
 * The same rule the refresh above lives by, in both directions: a turn on
 * which every copy was already current says nothing — `Stop` fires on every
 * assistant turn and a per-turn "still current" line would drown the one line
 * that says where an exchange ended — and `marked > 0` on its own is NOT
 * movement, which is the half a later reader is most likely to get wrong.
 */
test('a copy that took bytes says so in the audit row, and a current one is silent', () => {
  const base: RebuildReport = {
    dir: '/w', found: 1, scanned: 0, appended: 0, skipped: 1, removed: 0,
    truncated: [], bytesRead: 0, ms: 2,
    subagents: {
      found: 0, scanned: 0, appended: 0, skipped: 0, removed: 0,
      truncated: [], unlinked: 0, bytesRead: 0,
    },
  };
  const mirror = {
    dir: '/kept', marked: 1, advanced: 0, bytesWritten: 0,
    orphaned: [] as string[], broken: [] as string[], cleared: [] as string[],
    redacted: [] as string[], redactedBytesWritten: 0, ms: 1,
  };

  assert.equal(
    refreshNote({ ...base, mirror }), '',
    'a mark whose copy was already current is the ordinary turn and must stay silent',
  );

  const advanced = refreshNote({
    ...base, mirror: { ...mirror, advanced: 1, bytesWritten: 19_153 },
  });
  assert.match(advanced, /1 kept copy\(s\) took 19153 new byte\(s\)/);

  // The state the mark exists for, and it happens exactly once per session:
  // the transcript is gone and the copy is now what the archive reads.
  const orphaned = refreshNote({ ...base, mirror: { ...mirror, orphaned: ['s1'] } });
  assert.match(orphaned, /now read from their copy because the transcript is gone/);

  // And the two failures, which a reader must be able to find later: a copy
  // that can no longer follow its file, and a mark whose copy was deleted.
  assert.match(
    refreshNote({ ...base, mirror: { ...mirror, broken: ['s1'] } }),
    /1 copy\(s\) can no longer keep up/,
  );
  assert.match(
    refreshNote({ ...base, mirror: { ...mirror, cleared: ['s1'] } }),
    /1 mark\(s\) dropped because the copy is gone/,
  );

  // `plan:archive seq:46`. A choice about what to fake has to keep being
  // applied to everything appended after it was made, and the row is where a
  // reader finds out later that it was — the copy itself cannot say what it
  // WOULD have held.
  assert.match(
    refreshNote({
      ...base,
      mirror: { ...mirror, advanced: 1, redacted: ['s1'], redactedBytesWritten: 512 },
    }),
    /1 redacted copy\(s\) took 512 new byte\(s\)/,
  );

  // A mirror pass that FAILED is not a pass that found nothing —
  // `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`. Neither
  // says anything here, and the two are told apart by the field itself.
  assert.equal(refreshNote({ ...base, mirror: null }), '');
});

/* ══ CREATION PATH 1: THE ANCHORS ARE MARKED AS THE CONVERSATION GROWS ════ */

/**
 * **The one line this item is about, proved AT THE HOOK** —
 * `REQ-every-anchor-capability-is-reachable-from-the-screen-and-a`, owner
 * ruling 2026-09-12: *"1 ongoing appended payload to the conversation would
 * have anchores created on the fly"*, and, on how to pay for it, *"Yes,
 * scoped"*.
 *
 * `test/core/anchor-per-turn.test.ts` proves `markAnchorsOnTurn` is CORRECT
 * and cheap, and says in its own header that nothing there says the hook calls
 * it — which was true when it was written and is the exact defect these
 * assertions exist to close. Everything below is taken through
 * `stopConversationRefresh`, so a pass that was built, measured and never
 * called would leave every one of them red.
 */

/** A prompt naming a normative id — what the `ruling` grammar marks. */
const RULING = 'RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number';

function prompt(text: string, at: string): unknown {
  return {
    type: 'user',
    message: { role: 'user', content: text },
    timestamp: at,
    gitBranch: 'master',
    cwd: '/w',
  };
}

/** Every anchor label the index holds, sorted. */
function anchorLabels(dbPath: string): string[] {
  const index = ConversationIndex.openReadOnlyChecked(dbPath);
  try {
    return index.anchorRows(null).map((row) => row.label).sort();
  } finally {
    index.close();
  }
}

test('a turn ending marks the anchors in what was appended, with nobody running anything', () => {
  const sb = sandbox();
  withHome(sb, () => {
    rebuildConversations(sb.dbPath, process.env, sb.cwd, {});
    // The turn that settles the fixture: the prose index is filled from what
    // the transcript already held, so anything marked below arrived AFTER it.
    stopConversationRefresh({ cwd: sb.cwd });
    assert.deepEqual(
      anchorLabels(sb.dbPath), [],
      'the opening exchange is neither a table nor a ruling — if it were marked, every count '
      + 'below would be meaningless',
    );

    // The session keeps going: the owner types a ruling. Nothing is run.
    sb.append([prompt(`and from now on, follow ${RULING}`, '2026-09-03T10:00:00.000Z')]);
    const report = stopConversationRefresh({ cwd: sb.cwd });

    assert.notEqual(report, null, 'the hook declined in a workspace that has an index');
    assert.equal(
      report?.autoAnchors?.did, 'ran',
      'the Stop hook did not run the automatic anchor pass at all. This is creation path 1, and '
      + 'a pass that was built and measured elsewhere is not a pass that is called.',
    );
    const auto = report?.autoAnchors?.did === 'ran' ? report.autoAnchors.report : null;
    assert.equal(
      auto?.anchors?.marked, 1,
      'the turn that arrived on this turn was not marked — a transcript being appended to is '
      + 'supposed to get its anchors as it goes, rather than waiting for a person to type '
      + '`mycontext conversation rebuild`',
    );
    assert.deepEqual(anchorLabels(sb.dbPath), [RULING]);
  });
});

test('a turn on which no transcript moved does not run the pass at all', () => {
  const sb = sandbox();
  withHome(sb, () => {
    rebuildConversations(sb.dbPath, process.env, sb.cwd, {});
    sb.append([prompt(`follow ${RULING}`, '2026-09-03T10:00:00.000Z')]);
    stopConversationRefresh({ cwd: sb.cwd });
    assert.deepEqual(anchorLabels(sb.dbPath), [RULING], 'the fixture must start with one anchor');

    // A turn on which the person typed and the assistant answered in another
    // window: this session's transcript did not move.
    const report = stopConversationRefresh({ cwd: sb.cwd });
    const auto = report?.autoAnchors?.did === 'ran' ? report.autoAnchors.report : null;
    assert.notEqual(auto, null, 'the pass should still have been entered');
    assert.deepEqual(
      auto?.search.read, [],
      'the prose build re-read a source on a turn where nothing was appended — the resume clamp '
      + 'has come undone, and the skip below rests on it',
    );
    assert.equal(
      auto?.anchors, null,
      'the pass RAN over an archive nothing had appended to. Measured on the real corpus '
      + '2026-09-12: that costs 746-2997 ms of seeks to re-decide bytes nobody touched, against '
      + '5-20 ms for the skip — and it would be paid on every assistant turn.',
    );
    assert.deepEqual(anchorLabels(sb.dbPath), [RULING], 'and nothing was marked or taken back');
  });
});

test('a pass that throws costs the turn its bookmarks and nothing else', () => {
  const sb = sandbox();
  withHome(sb, () => {
    rebuildConversations(sb.dbPath, process.env, sb.cwd, {});
    sb.append([prompt(`follow ${RULING}`, '2026-09-03T10:00:00.000Z')]);

    const report = stopConversationRefresh({ cwd: sb.cwd }, {
      markAnchors: () => { throw new Error('the grammar fell over'); },
    });

    // `INV-hooks-fail-open`, and specifically: the two writes this hook had
    // already made — the index scan and the anchors reconciliation — still
    // reach the caller, because the row they are reported in is the only place
    // a person can ever find out they happened.
    assert.notEqual(
      report, null,
      'a throw from the anchor pass cost the whole turn its refresh report. The scan and the '
      + 'mirrors had already run by then, so what is lost is not the pass — it is the record '
      + 'of everything before it.',
    );
    assert.equal(report?.appended, 1, 'the scan still reports the tail it read');
    // `adopted` and not `restored`: this is the first refresh in this
    // workspace, so the reconciliation is the one that writes the anchors
    // document for the first time — the write whose report would be lost with
    // the rest if a bookmark pass were allowed to throw past it.
    assert.equal(report?.anchors?.direction, 'adopted', 'and the reconciliation still reports');
    assert.deepEqual(
      report?.autoAnchors, { did: 'failed' },
      'a pass that threw was reported as something other than a failure. '
      + '`INV-nothing-is-dropped-silently`: a turn whose bookmarks were not written must say so, '
      + 'and must not say it the way a turn that had nothing to mark says it.',
    );

    // And a pass that answers `null` — which is what the real one does with
    // every fault it catches for itself — is the same fact and reads the same.
    assert.deepEqual(
      stopConversationRefresh({ cwd: sb.cwd }, { markAnchors: () => null })?.autoAnchors,
      { did: 'failed' },
    );
  });
});

/**
 * **THE BUDGET, AND WHY STANDING DOWN IS NOT THE SAME AS FORGIVING** — the
 * sharp edge of wiring anything at all to this hook.
 *
 * `Stop` runs on a 3-second timeout the platform genuinely waits on, and a
 * hook killed at it is killed with `taskkill /T` and loses that turn's audit
 * row. The upkeep beside this refresh spends up to ~1.45 s on the turn it
 * restarts a stale server, so the pass is handed what is LEFT rather than a
 * fixed slice, and below its floor it does not start.
 *
 * The property that makes that safe is the second half of this test: a turn
 * that stood down consumed NOTHING, so the very next turn marks what it
 * skipped. A budget that dropped the work instead would be a silent hole in
 * creation path 1 — anchors missing from exactly the turns on which the
 * machine was busiest.
 */
test('a hook that has already spent its budget stands the pass down, and loses nothing by it', () => {
  const sb = sandbox();
  withHome(sb, () => {
    rebuildConversations(sb.dbPath, process.env, sb.cwd, {});
    stopConversationRefresh({ cwd: sb.cwd });
    sb.append([prompt(`follow ${RULING}`, '2026-09-03T10:00:00.000Z')]);

    // **The floor EXACTLY, not a millisecond under it**, so what stands the
    // pass down is the refresh's own cost and nothing else: the scan, the
    // mirrors and the reconciliation above have already run by the time the
    // budget is read, and on a quiet machine they are the 141-225 ms this
    // subtracts. A budget that started counting at the pass would hand it a
    // slice that had already been spent — which under three-lane load is
    // 630-1223 ms of a 1600 ms slice, measured.
    const tight = stopConversationRefresh({ cwd: sb.cwd }, {
      budgetMs: ANCHOR_PASS_FLOOR_MS,
    });
    assert.equal(
      tight?.autoAnchors?.did, 'stood-down',
      'the pass started with less than its floor left. It cannot be interrupted once its prose '
      + 'build has run, so a hook that starts it without room for it is a hook that gets killed '
      + 'part-way — and the kill is what costs the turn its audit row.',
    );
    const left = tight?.autoAnchors?.did === 'stood-down' ? tight.autoAnchors.leftMs : null;
    assert.ok(
      left !== null && left < ANCHOR_PASS_FLOOR_MS,
      `the budget was reported as ${String(left)}ms of a ${ANCHOR_PASS_FLOOR_MS}ms slice — the `
      + 'refresh spent none of it, so the clock is being read before the work rather than after',
    );
    assert.equal(tight?.appended, 1, 'the refresh itself still ran and still reports');
    assert.deepEqual(
      anchorLabels(sb.dbPath), [],
      'a pass that stood down marked something anyway, which means it was started',
    );

    // The next turn, with room. Nothing was consumed by standing down — the
    // prose index never advanced, so the transcript still reads as moved.
    const next = stopConversationRefresh({ cwd: sb.cwd });
    const auto = next?.autoAnchors?.did === 'ran' ? next.autoAnchors.report : null;
    assert.equal(
      auto?.anchors?.marked, 1,
      'the anchor the busy turn stood down on was never marked at all. Standing down must DEFER '
      + 'work and never forgive it, or a slow turn silently costs the archive its bookmarks.',
    );
    assert.deepEqual(anchorLabels(sb.dbPath), [RULING]);
  });
});

/**
 * **What the anchor pass contributes to the audit row** — the same rule
 * `refreshNote` already lives by: only what MOVED, because `Stop` fires on
 * every assistant turn.
 */
test('the row says what the anchor pass marked, and says nothing on the ordinary turn', () => {
  const base: RebuildReport = {
    dir: '/w', found: 1, scanned: 0, appended: 0, skipped: 1, removed: 0,
    truncated: [], bytesRead: 0, ms: 2,
    subagents: {
      found: 0, scanned: 0, appended: 0, skipped: 0, removed: 0,
      truncated: [], unlinked: 0, bytesRead: 0,
    },
  };
  const search: SearchBuildReport = {
    sources: 1, indexed: 0, appended: 1, skipped: 0, removed: 0, spans: 3,
    bytesRead: 900, read: ['s1'], readFrom: [0], deferred: 0, ms: 4,
  };
  const anchors: AutoAnchorReport = {
    probed: 12, found: 2, marked: 0, dropped: 0, relabelled: 0, capped: false, ms: 9,
  };
  const ran = (
    a: Partial<AutoAnchorReport> | null, s: Partial<SearchBuildReport> = {},
  ): ConversationRefresh => ({
    ...base,
    autoAnchors: {
      did: 'ran',
      report: {
        search: { ...search, ...s },
        anchors: a === null ? null : { ...anchors, ...a },
      },
    },
  });

  // **`probed` and `found` are NOT movement.** The pass looks at candidates on
  // every turn that read a byte, and a clause that fired on those would be in
  // nearly every row — which is what `refreshNote` exists to prevent.
  assert.equal(
    refreshNote(ran({})), '',
    'a pass that recognised nothing new is the ordinary turn and must stay silent',
  );
  assert.equal(refreshNote(ran(null)), '', 'and so is a turn on which nothing moved at all');

  assert.match(
    refreshNote(ran({ marked: 2 })),
    /2 anchor\(s\) marked automatically in what was appended \(9ms\)/,
  );
  assert.match(refreshNote(ran({ relabelled: 3 })), /3 re-labelled/);
  assert.match(
    refreshNote(ran({ dropped: 1 })),
    /1 taken back because the grammar no longer recognises them/,
  );

  // The two states a reader could not find any other way. A prose index that
  // is permanently further behind than one turn's budget can carry is a
  // creation path that has quietly stopped seeing new turns.
  assert.match(
    refreshNote(ran({}, { deferred: 2 })),
    /2 transcript\(s\) were left unread by the turn's search-index budget/,
  );
  assert.match(
    refreshNote({ ...base, autoAnchors: { did: 'stood-down', leftMs: 300 } }),
    /the automatic anchor pass stood down with 300ms of the hook's budget left/,
  );
  // And an overrun, which is the one thing the budget cannot prevent: the pass
  // is atomic, so all that can be done about a slow one is to make it findable.
  assert.match(
    refreshNote(ran({ ms: ANCHOR_HALF_CEILING_MS + 1 })),
    new RegExp(`took ${ANCHOR_HALF_CEILING_MS + 1}ms, past the ${ANCHOR_HALF_CEILING_MS}ms`),
  );

  // A pass that FAILED is not a pass that found nothing — the same distinction
  // `mirror` draws, told apart by the field and not by the clause.
  assert.equal(refreshNote({ ...base, autoAnchors: { did: 'failed' } }), '');
});

/**
 * **The budget arithmetic, held to the two upkeep paths it was derived from.**
 *
 * `runStopHook` reads stdin and spawns processes, so nothing tests it; this is
 * the half of that line that can be tested, and what it is really asserting is
 * a TRADE the numbers make rather than the subtraction itself: on the turn the
 * upkeep merely probes there is room for the anchor pass, and on the turn it
 * restarts a stale server and waits for the replacement to answer there is
 * not. Raising `PROBE_CAP_MS`, lowering `ANCHOR_PASS_BUDGET_MS` or letting the
 * confirmation poll longer would each silently move which turns mark anchors,
 * and this is the only line that would say so.
 */
test('the probe turn leaves room for the anchor pass and the restart turn does not', () => {
  assert.equal(anchorPassBudget(0), ANCHOR_PASS_BUDGET_MS, 'a turn too soon to probe pays nothing');

  // The ordinary turn: `probeUiServer`'s own 250 ms cap, which is the most it
  // can cost, plus the freshness exchange on loopback.
  assert.ok(
    anchorPassBudget(250 + 150) >= ANCHOR_PASS_FLOOR_MS,
    'the pass would stand down on an ORDINARY turn — the upkeep probing at its own cap is not '
    + 'a busy hook, and a budget that treats it as one turns creation path 1 off for everybody',
  );

  // The turn it restarts: 12 confirmation asks 100 ms apart, plus the probe
  // that found the server stale. `CONFIRM_ATTEMPTS * CONFIRM_POLL_MS`.
  assert.ok(
    anchorPassBudget(250 + CONFIRM_ATTEMPTS * CONFIRM_POLL_MS) < ANCHOR_PASS_FLOOR_MS,
    'the pass would START on the turn the upkeep spent 1.45 s restarting a server. Measured '
    + '2026-09-12: boot 200 ms, that upkeep 1450 ms, the refresh 225 ms and the pass up to '
    + '1000 ms is past the 3-second timeout — and a hook killed at its timeout is killed with '
    + '`taskkill /T` and loses the audit row for the turn.',
  );
});
