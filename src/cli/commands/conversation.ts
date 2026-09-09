import {
  ConversationIndex, ConversationIndexIncompleteError, ConversationIndexUninitializedError,
  MAX_SCAN_BYTES, forgetConversations, rebuildConversations, transcriptDir, truncatedScan,
  type ConversationRow, type SubagentRow,
} from '../../core/conversation-index.ts';
import { SUBCOMMAND_FLAGS } from '../../core/command-flags.ts';
import type { Workspace } from '../../core/workspace.ts';
import { toCliMessage } from './context.ts';
import { confirmAction } from './review.ts';
import { emitJson, refuseUnknownFlag, table, wantsJson, zonedStamp } from './format.ts';
import path from 'node:path';
import { flag, hasFlag, positionals, registerCommand, type Emit } from './registry.ts';

/**
 * `mycontext conversation` — the archive's write half, and the only thing that
 * fills the conversation index.
 *
 * **This command exists because the web UI cannot build its own index.** The
 * server is read-only and says so in its own navigation; `ConversationIndex.open`
 * creates tables, which is a write, so nothing under `src/ui/` may call it
 * (`test/ui/no-writes.test.ts` walks the import graph and would go red). The
 * endpoints in `plan:archive seq:2` therefore read what this command wrote, and
 * report the never-scanned state as itself rather than quietly building one.
 *
 * That split is not an inconvenience to route around; it is the read-only
 * guarantee holding at the one place a new feature would most naturally break
 * it.
 *
 * `plan:archive seq:1`, step 1 of five in
 * `docs/superpowers/specs/2026-09-04-conversation-archive-design.md`.
 */

export const SUBCOMMANDS = ['rebuild', 'list', 'subagents', 'forget'] as const;

const USAGE = `usage: mycontext conversation rebuild [--full] [--json]
       mycontext conversation list [--limit <n>] [--json]
       mycontext conversation subagents [<session>] [--json]
       mycontext conversation forget [--yes] [--json]`;

const CONVERSATION_FLAGS = SUBCOMMAND_FLAGS['conversation'];

/**
 * The directory Claude Code encodes into a transcript folder name — the
 * REPOSITORY root, derived from the corpus rather than read from
 * `process.cwd()`.
 *
 * `ws.projectRoot` is the `.my_context` directory, so its parent is the
 * repository. Deriving it rather than taking the process's cwd is what makes
 * `mycontext conversation rebuild` mean the same project whichever
 * subdirectory it is run from — and it is the same derivation
 * `read-model-conversations.ts` makes, so the writer and the reader cannot
 * disagree about whose transcripts they mean.
 *
 * Found by the F2 guard: run from the repository while the workspace was a
 * temp directory, the first draft scanned the DEVELOPER'S OWN transcripts and
 * indexed them into the test's corpus.
 */
function workspaceCwd(root: string): string {
  return path.dirname(root);
}

/** How many rows `list` prints before it says it stopped. */
const LIST_DEFAULT_LIMIT = 20;

/**
 * What a lane's transcript file is called before its id — and therefore what
 * `agentId` carries, since `listSubagentFiles` takes the whole filename stem.
 * `dispatchingAgentId` is the only thing that needs to know it.
 */
const AGENT_ID_PREFIX = 'agent-';

/**
 * The scan report, printed so the bound is visible rather than implied.
 *
 * Every number here is one a reader can check against the directory named on
 * the first line, and the truncation line is drawn ONLY when something was
 * truncated — but when it is, it names the sessions, because a count of
 * capped rows a reader cannot identify is not a disclosure
 * (`INV-nothing-is-dropped-silently`).
 */
function reportLines(report: ReturnType<typeof rebuildConversations>): string[] {
  const lines = [
    `my_context: scanned ${report.scanned} transcript(s) of ${report.found} in ${report.dir}`,
  ];
  if (report.appended > 0) {
    lines.push(
      `my_context: ${report.appended} transcript(s) had grown since they were indexed and only ` +
      'the appended tail was read — a transcript never changes what it already holds, so the ' +
      'row is composed rather than rebuilt; `--full` re-reads them whole anyway',
    );
  }
  if (report.skipped > 0) {
    lines.push(
      `my_context: ${report.skipped} unchanged since the last scan and re-read from the index ` +
      '(size and mtime both matched); `--full` re-reads them anyway',
    );
  }
  if (report.removed > 0) {
    lines.push(
      `my_context: ${report.removed} indexed session(s) no longer have a transcript on disk and ` +
      'were dropped from the index. The harness prunes transcripts; the archive reads them in ' +
      'place and cannot hold what is gone.',
    );
  }
  if (report.truncated.length > 0) {
    lines.push(
      `my_context: ${report.truncated.length} transcript(s) hit the ${MAX_SCAN_BYTES} byte scan ` +
      'cap, so their prompt and answer counts are FLOORS and their end time is where the scan ' +
      `stopped, not where the conversation did: ${report.truncated.join(', ')}`,
    );
  }
  if (report.found === 0) {
    lines.push(
      'my_context: no transcripts here. That is either a project the harness has never opened ' +
      'or transcripts it has pruned — the directory named above is where this looked, so the ' +
      'two can be told apart.',
    );
  }
  // ── THE LANES, REPORTED APART ──────────────────────────────────────────
  //
  // `plan:archive seq:12`. Their numbers are separate from the session's
  // because their budget is: measured in this workspace 2026-09-08, 253
  // subagent transcripts totalling 615.3 MB against 65 MB of session. One
  // merged total would hide which of the two a slow scan actually paid for,
  // and would silently change what the line above this one means.
  const agents = report.subagents;
  if (agents.found > 0) {
    lines.push(
      `my_context: and ${agents.found} subagent transcript(s) under those sessions — ` +
      `${agents.scanned} read whole, ${agents.appended} from their appended tail, ` +
      `${agents.skipped} unchanged, ${agents.bytesRead} byte(s) read`,
    );
    if (agents.removed > 0) {
      lines.push(
        `my_context: ${agents.removed} indexed subagent(s) no longer have a transcript on disk ` +
        'and were dropped from the index.',
      );
    }
    if (agents.unlinked > 0) {
      lines.push(
        `my_context: ${agents.unlinked} subagent(s) have no readable .meta.json beside them, so ` +
        'nothing links them to the turn that dispatched them. They are indexed and readable; ' +
        'only the link is missing.',
      );
    }
    if (agents.truncated.length > 0) {
      lines.push(
        `my_context: ${agents.truncated.length} subagent transcript(s) hit the ` +
        `${MAX_SCAN_BYTES} byte scan cap, so their counts are FLOORS: ` +
        `${agents.truncated.join(', ')}`,
      );
    }
  }
  lines.push(`my_context: read ${report.bytesRead} byte(s) in ${report.ms}ms`);
  return lines;
}

function cmdConversationRebuild(ws: Workspace, root: string, args: string[], out: Emit): number {
  const report = rebuildConversations(ws.dbPath, process.env, workspaceCwd(root), {
    full: hasFlag(args, 'full'),
  });
  if (wantsJson(args)) {
    emitJson(out, report);
    return 0;
  }
  for (const line of reportLines(report)) out(line);
  return 0;
}

/**
 * The `ended` column: the reader's own wall clock, or the honest absence of a
 * time. The raw stamp is the fallback rather than `—`, because a value that
 * exists and cannot be reformatted is still evidence — the same argument
 * `screens/parts.js`' `stampOf` makes for its own column.
 */
function endedCell(endedAt: string | null): string {
  if (endedAt === null) return '—';
  return zonedStamp(endedAt) ?? endedAt;
}

/** One row's title, or the honest absence of one. Never a fabricated title. */
function titleCell(row: ConversationRow): string {
  if (row.title === null) return '—';
  return row.titleSource === 'ai' ? `${row.title} (model)` : row.title;
}

function cmdConversationList(ws: Workspace, root: string, args: string[], out: Emit): number {
  // `flag` answers `null` for "not given" — not `undefined`, which is what a
  // reader coming from `URLSearchParams` assumes and what the first draft of
  // this branch assumed. It refused every bare `conversation list` with
  // `--limit takes a positive whole number, not "null"`, on a command line
  // carrying no `--limit` at all. Read it as the three states it has:
  // absent, present-and-unusable, present-and-a-number.
  const raw = flag(args, 'limit');
  const limit = raw === null ? LIST_DEFAULT_LIMIT : Number(raw);
  if (!Number.isInteger(limit) || limit < 1) {
    out(`my_context: --limit takes a positive whole number, not "${raw ?? ''}".`);
    return 1;
  }

  let index: ConversationIndex;
  try {
    index = ConversationIndex.openReadOnlyChecked(ws.dbPath);
  } catch (err) {
    // An index a schema behind is not a damaged one, and it is not an empty
    // one either — it is full and momentarily unreadable (`plan:archive
    // seq:12`). Both reach the same "nothing to list" answer here, and the
    // sentence differs because the reader's situation does.
    if (err instanceof ConversationIndexUninitializedError
      || err instanceof ConversationIndexIncompleteError) {
      // The empty state, named as itself. Not an error, and not silence.
      const dir = transcriptDir(process.env, workspaceCwd(root));
      const outdated = err instanceof ConversationIndexIncompleteError;
      if (wantsJson(args)) {
        emitJson(out, { conversations: [], total: 0, indexed: false, outdated, dir });
        return 0;
      }
      if (outdated) {
        out(
          'my_context: this workspace\'s conversation index was built before this build added a ' +
          'table it reads, so there is nothing here to list yet. It is not damaged and nothing ' +
          'has been lost — the index is rebuilt from the transcripts on disk.',
        );
      } else {
        out('my_context: no conversation index in this workspace yet — nothing has been scanned.');
      }
      out(`my_context: run \`mycontext conversation rebuild\` to scan ${dir}`);
      return 0;
    }
    throw err;
  }

  try {
    const all = index.all();
    const shown = all.slice(0, limit);
    if (wantsJson(args)) {
      emitJson(out, {
        conversations: shown,
        total: all.length,
        omitted: all.length - shown.length,
        limit,
        indexed: true,
      });
      return 0;
    }

    if (all.length === 0) {
      out('my_context: the conversation index is built and holds no sessions.');
      out(
        `my_context: nothing was found in ${transcriptDir(process.env, workspaceCwd(root))} — a ` +
        'measured zero, not a scan that has not run.',
      );
      return 0;
    }

    const drawn = table(
      ['session', 'ended', 'prompts', 'answers', 'branch', 'title'],
      shown.map((row) => [
        row.sessionId.slice(0, 8),
        // THE READER'S OWN CLOCK, NAMING ITSELF — the same digits the archive
        // screen draws for the same session, which is what
        // `TASK-a-timestamp-is-shown-in-the-reader-s-own-zone-and-says-which`
        // asks the terminal for. `--json` above is untouched and still carries
        // the stored UTC. A stamp the formatter refuses falls back to what the
        // index holds, because a table has a cell that must say something.
        endedCell(row.endedAt),
        truncatedScan(row) ? `${row.prompts}+` : String(row.prompts),
        truncatedScan(row) ? `${row.answers}+` : String(row.answers),
        row.branch ?? '—',
        titleCell(row),
      ]),
    );
    for (const line of drawn) out(line);

    const capped = shown.filter(truncatedScan);
    if (capped.length > 0) {
      out(
        `my_context: ${capped.length} row(s) are marked "+" — their transcript was longer than ` +
        `the ${MAX_SCAN_BYTES} byte scan cap, so those counts are floors rather than totals.`,
      );
    }
    if (all.length > shown.length) {
      out(
        `my_context: showing ${shown.length} of ${all.length}; ` +
        `${all.length - shown.length} not shown. Raise --limit to see them.`,
      );
    } else {
      out(`my_context: showing all ${all.length}.`);
    }
    return 0;
  } finally {
    index.close();
  }
}

/**
 * **The lane a `parentAgentId` names, spelled the way everything else in this
 * product spells a lane** — `plan:archive seq:32`.
 *
 * ── THE ASYMMETRY, AND WHOSE IT ACTUALLY IS ────────────────────────────────
 *
 * Re-measured 2026-09-09 on this workspace, over all 257 sidecars: 43 carry
 * `parentAgentId`, every one of them WITHOUT the `agent-` prefix, and every
 * one of the 43 resolves against `agent-<value>.jsonl` on disk. So the field
 * is real, it is right, and it is in a different namespace from `agentId`.
 *
 * **But the harness does not "drop" a prefix, and the item that filed this
 * said it did.** The sidecar's key set across all 257 files is exactly
 * `agentType`, `description`, `isFork`, `model`, `parentAgentId`, `spawnDepth`
 * and `toolUseId` — there is NO self-id field at all. A lane's own identity
 * comes from its FILENAME, and `listSubagentFiles` adopts the whole stem:
 * `const agentId = name.slice(0, -'.jsonl'.length)`. The `agent-` prefix is
 * therefore OURS. We chose the prefixed spelling for the primary key and
 * copied the bare spelling for the key that points at it, one field apart in
 * the same `upsertSubagent` call. Half the asymmetry is the harness's format
 * and half is our own naming, and this function repairs our half.
 *
 * ── WHY THE REPAIR IS HERE AND NOT AT THE READ BOUNDARY ────────────────────
 *
 * The item offers both and expects an argument, so: **the index cannot carry
 * this fix.** `conversation-index.ts`' own header rules that these tables hold
 * no version number and "THE SHAPE IS THE VERSION" — `openReadOnlyChecked`
 * walks `CONVERSATION_TABLE_COLUMNS` and refuses a shape it does not read.
 * Normalising on the way in changes a VALUE and not a shape, so nothing can
 * detect that a row predates the change; and `rebuildConversations` skips any
 * transcript whose bytes and mtime are unchanged, which a finished lane's
 * never are again. The 43 rows already written would keep the bare spelling
 * for ever, and new ones would arrive prefixed — one column holding two
 * namespaces at once, which is strictly worse than today's uniform defect and
 * would go undetected because no shape moved.
 *
 * Normalising on the way OUT is correct on the first run, in every workspace,
 * with no rebuild — and it keeps `readSubagentMeta` answering the question its
 * own header says it answers: what the sidecar said. That is the habit the
 * item predicted, reached here on the rebuild mechanics rather than on the
 * habit.
 *
 * ── IDEMPOTENT ON PURPOSE ──────────────────────────────────────────────────
 *
 * The prefix is added only when it is absent. This is an observation about a
 * harness format that can change under us — the reason `readSubagentMeta`
 * tolerates an unreadable sidecar at all — so the day the harness starts
 * writing `agent-a26cb…` this function keeps telling the truth instead of
 * printing `agent-agent-a26cb…`.
 */
export function dispatchingAgentId(parentAgentId: string | null): string | null {
  if (parentAgentId === null) return null;
  return parentAgentId.startsWith(AGENT_ID_PREFIX)
    ? parentAgentId
    : `${AGENT_ID_PREFIX}${parentAgentId}`;
}

/**
 * `mycontext conversation subagents [<session>]` — **the lanes a session
 * dispatched, and what links each to the turn that dispatched it.**
 *
 * `plan:archive seq:12`. It exists in the terminal and not only on the screen
 * because the link is the thing most likely to be doubted: a reader who wants
 * to know whether a lane is reachable from its `Agent` call should be able to
 * see the `toolUseId` beside it without opening a browser.
 *
 * With no session named it lists the lanes of the newest indexed session,
 * which is the one a person asking this question almost always means.
 */
function cmdConversationSubagents(ws: Workspace, root: string, args: string[], out: Emit): number {
  const [, asked] = positionals(args, ['limit']);

  let index: ConversationIndex;
  try {
    index = ConversationIndex.openReadOnlyChecked(ws.dbPath);
  } catch (err) {
    if (err instanceof ConversationIndexUninitializedError
      || err instanceof ConversationIndexIncompleteError) {
      const dir = transcriptDir(process.env, workspaceCwd(root));
      if (wantsJson(args)) {
        emitJson(out, { subagents: [], total: 0, indexed: false, dir });
        return 0;
      }
      out('my_context: nothing is indexed in this workspace yet.');
      out(`my_context: run \`mycontext conversation rebuild\` to scan ${dir}`);
      return 0;
    }
    throw err;
  }

  try {
    const sessions = index.all();
    const sessionId = asked ?? sessions[0]?.sessionId;
    if (sessionId === undefined) {
      out('my_context: the conversation index is built and holds no sessions.');
      return 0;
    }
    const rows = index.subagentsOf(sessionId);
    if (wantsJson(args)) {
      // `--json` gets the usable id as an ADDITIONAL field rather than in
      // place of the stored one. `parentAgentId` stays byte-for-byte what the
      // sidecar said and the index holds, so a reader checking this output
      // against either still can; `dispatchedBy` is the same value the human
      // column prints, and is what a caller pipes into another command. One
      // rewritten field would have made those two questions unanswerable
      // apart, which is the whole complaint this item is about.
      emitJson(out, {
        sessionId,
        subagents: rows.map((row: SubagentRow) => ({
          ...row,
          dispatchedBy: dispatchingAgentId(row.parentAgentId),
        })),
        total: rows.length,
        indexed: true,
      });
      return 0;
    }
    if (rows.length === 0) {
      out(
        `my_context: session ${sessionId.slice(0, 8)} dispatched no subagents — a measured ` +
        'zero, not a scan that has not run.',
      );
      return 0;
    }

    const drawn = table(
      ['agent', 'depth', 'type', 'records', 'size', 'dispatched by', 'description'],
      rows.map((row: SubagentRow) => [
        row.agentId,
        String(row.spawnDepth),
        row.agentType ?? '—',
        String(row.records),
        `${Math.round(row.bytes / 1024)}K`,
        // WHAT DISPATCHED IT, which is two facts and not one: a lane at depth
        // 1 was dispatched by the session, and one deeper by another lane.
        // Measured 2026-09-08: 210 at depth 1 and 43 at depth 2, and
        // `parentAgentId` is present on exactly the deeper ones. Re-measured
        // 2026-09-09: 214 and 43 of 257, so the shape holds.
        //
        // Through `dispatchingAgentId`, so the 43 print an id that `mycontext
        // conversation show` and the viewer's own address both answer to —
        // see that function for why the repair is here and not in the index.
        dispatchingAgentId(row.parentAgentId) ?? 'the session',
        row.description ?? '—',
      ]),
    );
    for (const line of drawn) out(line);

    const unlinked = rows.filter((r) => r.toolUseId === null);
    out(
      `my_context: ${rows.length} subagent(s) under session ${sessionId.slice(0, 8)}, ` +
      `${rows.reduce((n, r) => n + r.records, 0)} records, ` +
      `${rows.reduce((n, r) => n + r.bytes, 0)} byte(s).`,
    );
    if (unlinked.length > 0) {
      out(
        `my_context: ${unlinked.length} of them carry no tool_use id, so nothing links them to ` +
        'the turn that dispatched them. Their transcripts are still readable.',
      );
    } else {
      out(
        'my_context: every one carries the tool_use id of the `Agent` call that dispatched it, ' +
        'so each can be opened from the turn it came from.',
      );
    }
    return 0;
  } finally {
    index.close();
  }
}

/**
 * `mycontext conversation forget` — **the OFF position of the archive's
 * opt-in**, `plan:archive seq:9`.
 *
 * ── WHAT THE ITEM ASKED FOR, AND WHAT WAS ACTUALLY MISSING ────────────────
 *
 * The item says the design settles the archive as opt-in with "One key,
 * defaulting to OFF" and that no such key exists. Checked against the code as
 * it stands rather than as the item found it, the OFF DEFAULT already holds and
 * is enforced in three places rather than declared in one:
 *
 *   - `ConversationIndex.open` is the only thing that creates these tables, and
 *     it is called from exactly one place — inside `rebuildConversations`.
 *   - `rebuildConversations` has exactly two callers: this command, which is a
 *     person typing, and `hooks/stop.ts`' `stopConversationRefresh`, which uses
 *     `openReadOnlyChecked` as a GATE and returns `null` when no index exists.
 *     Its own comment: "a workspace nobody has ever scanned is still never
 *     opted in by a background hook."
 *   - No read surface can build one at all, which `test/ui/no-writes.test.ts`
 *     holds by walking the import graph.
 *
 * So a project that never runs `rebuild` is never scanned — which is the whole
 * of what the spec asked for, and is stronger than a config key in the respect
 * the item cares about most: a key is a FILE, and a file arrives with a cloned
 * repository. Nothing a repository ships can opt a reader's machine into
 * reading their transcripts.
 *
 * **What was genuinely missing is this: the switch had no OFF position.** Once
 * scanned, the Stop hook refreshed for ever, and the only way to stop it was
 * to delete `.index.db` — which is also the corpus's own item index, so opting
 * out of the archive meant discarding an unrelated cache. `forgetConversations`
 * drops the two tables, which returns the workspace to the exact state the
 * hook's gate declines to act on.
 *
 * **It is deliberately not a config key.** A key would be a fourth thing to
 * keep in step with the three above, in a file this lane may not write
 * (`.my_context/config.json` is the owner's), and it would put the decision in
 * a place a repository can ship. Removing the state the existing gate already
 * reads makes the same three enforcement points work in both directions.
 *
 * Nothing is lost that cannot be rebuilt: the transcripts are the source of
 * truth and this index is a cache. The counts are printed because a cache
 * shrinking in silence is what `INV-nothing-is-dropped-silently` forbids.
 */
function cmdConversationForget(ws: Workspace, root: string, args: string[], out: Emit): number {
  const json = wantsJson(args);
  if (!hasFlag(args, 'yes') && !json) {
    out(
      'my_context: about to drop this workspace\'s conversation index — every indexed session ' +
      'and subagent row, and the tables themselves. The transcripts on disk are NOT touched: ' +
      'they are the source of truth and this index is a cache, so `mycontext conversation ' +
      'rebuild` reconstructs all of it. What changes until you do is that the archive screen ' +
      'reports nothing scanned, and the end-of-turn refresh stands down — it only ever ' +
      'refreshes an index that already exists, which is what makes this an opt-OUT and not ' +
      'just a delete.',
    );
  }
  if (!confirmAction(args, out, 'Drop the conversation index for this workspace?')) return 1;

  const report = forgetConversations(ws.dbPath);
  if (json) {
    emitJson(out, report);
    return 0;
  }
  if (!report.indexed) {
    out(
      'my_context: there is no conversation index in this workspace, so there was nothing to ' +
      'forget. Nothing here has ever been scanned.',
    );
    return 0;
  }
  out(
    `my_context: dropped ${report.conversations} session row(s) and ${report.subagents} ` +
    'subagent row(s). Nothing scans the transcripts in ' +
    `${transcriptDir(process.env, workspaceCwd(root))} again until you run \`mycontext ` +
    'conversation rebuild\` yourself.',
  );
  return 0;
}

function cmdConversation(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }
  const root = ws.projectRoot;

  const [subcommand = 'list'] = positionals(args, ['limit']);
  if (!(SUBCOMMANDS as readonly string[]).includes(subcommand)) {
    out(`my_context: unknown conversation subcommand "${subcommand}".\n\n${USAGE}`);
    return 1;
  }

  const spec = CONVERSATION_FLAGS[subcommand];
  if (refuseUnknownFlag(args, spec.allowed, spec.values, USAGE, out)) return 1;

  try {
    if (subcommand === 'rebuild') return cmdConversationRebuild(ws, root, args, out);
    if (subcommand === 'subagents') return cmdConversationSubagents(ws, root, args, out);
    if (subcommand === 'forget') return cmdConversationForget(ws, root, args, out);
    return cmdConversationList(ws, root, args, out);
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }
}

registerCommand({
  name: 'conversation',
  usage: `conversation [${SUBCOMMANDS.join('|')}] [--full] [--limit <n>] [--yes] [--json]`,
  summary: 'index the conversation and subagent transcripts on disk, and list what it holds',
  run: (ws, args, out) => cmdConversation(ws, args, out),
});

export { cmdConversation };
