import {
  ConversationIndex, ConversationIndexIncompleteError, ConversationIndexUninitializedError,
  MAX_SCAN_BYTES, classifyTurn, forgetConversations, iterateTranscript, rebuildConversations,
  transcriptDir, truncatedScan,
  type ConversationRow, type NameRow, type SubagentRow,
} from '../../core/conversation-index.ts';
import {
  allAnchors, anchorIdFor, anchorsFor, markAnchor, resolveAnchor, searchAnchors, unmarkAnchor,
} from '../../core/anchors.ts';
import { anchorTransaction, reconcileAnchors } from '../../core/anchor-file.ts';
import {
  buildSearchIndex, proseOf, searchArchive, type SearchBuildReport,
} from '../../core/conversation-search.ts';
import {
  NotIndexedError, advanceMirrors, mirrorDir, mirrorPath, persistSession, unpersistSession,
  type MirrorReport,
} from '../../core/conversation-mirror.ts';
import {
  NoMirrorError, chooseRedactions, clearRedactions, readRedactionPlan,
  type RedactionResult,
} from '../../core/conversation-redaction.ts';
import {
  SECRET_SHAPES, scanSessionSecrets, type SecretCandidate, type SecretScan,
} from '../../core/conversation-secrets.ts';
import { SUBCOMMAND_FLAGS } from '../../core/command-flags.ts';
import type { Workspace } from '../../core/workspace.ts';
import { toCliMessage } from './context.ts';
import { confirmAction } from './review.ts';
import { emitJson, refuseUnknownFlag, table, wantsJson, zonedStamp } from './format.ts';
import path from 'node:path';
import { flag, hasFlag, listFlag, positionals, registerCommand, type Emit } from './registry.ts';

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

export const SUBCOMMANDS = [
  'rebuild', 'list', 'subagents', 'secrets', 'persist', 'name', 'anchor', 'forget',
] as const;

const USAGE = `usage: mycontext conversation rebuild [--full] [--json]
       mycontext conversation list [--limit <n>] [--json]
       mycontext conversation subagents [<session>] [--json]
       mycontext conversation secrets [<session>] [--json]
       mycontext conversation persist [<session>] [--replace <ids>] [--off] [--yes] [--json]
       mycontext conversation name [<session>] [<name>] [--clear] [--json]
       mycontext conversation anchor [<session>] [<byte offset>] [--label "<why>"]
                                     [--agent <id>] [--find <term>] [--drop <id>] [--json]
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

/**
 * What the mirror pass did, printed only when there is a mark to print about.
 *
 * A workspace with nothing persisted says nothing here, and that is not an
 * omission: `mycontext conversation persist` is the one thing that creates a
 * mark, so "0 mirrors" on every rebuild in every workspace would be a line
 * about a feature the reader has not turned on.
 */
function mirrorLines(report: MirrorReport): string[] {
  if (report.marked === 0) return [];
  const lines = [
    `my_context: ${report.marked} session(s) are kept outside this project in ${report.dir} — ` +
    `${report.advanced} mirror(s) took ${report.bytesWritten} new byte(s) this run`,
  ];
  if (report.orphaned.length > 0) {
    lines.push(
      `my_context: ${report.orphaned.length} of them no longer have a transcript on disk, so ` +
      'the copy is now the only one there is and the archive reads it in place: ' +
      `${report.orphaned.join(', ')}`,
    );
  }
  if (report.broken.length > 0) {
    lines.push(
      `my_context: ${report.broken.length} mirror(s) can no longer keep up — the file they ` +
      'were copied from was replaced rather than appended to. What they hold is everything up ' +
      'to that point, and re-running `mycontext conversation persist <session>` starts a fresh ' +
      `copy: ${report.broken.join(', ')}`,
    );
  }
  if (report.cleared.length > 0) {
    lines.push(
      `my_context: ${report.cleared.length} mark(s) were dropped because their copy is no ` +
      'longer on disk. Nothing was re-copied — that is a decision to take, not one to make on ' +
      `your behalf: ${report.cleared.join(', ')}`,
    );
  }
  // **THE CHOICE KEPT UP WITH THE APPEND** — `plan:archive seq:46`. Said out
  // loud rather than left to be inferred from the mirror line, because the two
  // are different promises and only one of them is about what a person ticked:
  // a redacted copy that silently stopped being projected would reintroduce a
  // value on the very next turn, which is the failure the item names.
  if (report.redacted.length > 0) {
    lines.push(
      `my_context: ${report.redacted.length} redacted copy/copies took ` +
      `${report.redactedBytesWritten} new byte(s), so the values you chose to fake are still ` +
      `faked in everything appended since you chose: ${report.redacted.join(', ')}`,
    );
  }
  return lines;
}

function cmdConversationRebuild(ws: Workspace, root: string, args: string[], out: Emit): number {
  const report = rebuildConversations(ws.dbPath, process.env, workspaceCwd(root), {
    full: hasFlag(args, 'full'),
  });
  // AFTER the scan, never inside it. `rebuildConversations` writes only
  // through `node:sqlite` and is named in `test/ui/no-writes.test.ts`'
  // `WRITES_WITHOUT_FS` on exactly that basis; the filesystem write lives in
  // `core/conversation-mirror.ts` and the two are composed here.
  const mirror = advanceMirrors(ws.dbPath, process.env, workspaceCwd(root));

  // ── THE WORDS AND THE ANCHORS, ON THE SAME COMMAND AND NOT ON THE HOOK ──
  //
  // `plan:recall seq:1` Task 2's decision, and it was taken with a
  // measurement rather than from the plan's file list. `buildSearchIndex`
  // costs 8.6 s to fill this workspace's 307 transcripts cold, and in steady
  // state it costs a comparison per transcript plus the TAIL of whatever
  // grew — measured here 2026-09-11 at 3-6 ms with nothing appended and 26 ms
  // for a 256 KB append. That is affordable on a command a person typed.
  //
  // **It is deliberately NOT wired into `hooks/stop.ts`**, which is where the
  // plan's shape invites it, because the same measurement found a second
  // number: as the code stands a live transcript falls to a WHOLE re-read
  // every run — 1.8-2.1 s and 95.7 MB per turn on this workspace — since
  // `prose_sources.bytes` records where the walk actually reached, which runs
  // PAST the `conversations` row whenever the file grew between the scan and
  // the prose walk, and `source.bytes > previous.bytes` is then false for
  // ever. Until that is repaired in `core/conversation-search.ts`, putting
  // this on the end of every assistant turn would be paying two seconds a
  // turn for something nobody asked to be automatic.
  //
  // The viewer's search says how fresh the index is with every answer
  // (`read-model-conversations.ts`' `index.indexedAt`), so an archive behind
  // its transcripts is DISCLOSED rather than quietly answering a smaller
  // question than the one that was asked.
  const index = ConversationIndex.open(ws.dbPath);
  let search: SearchBuildReport;
  let auto: AutoAnchorReport;
  try {
    // **The anchors come back from their file BEFORE anything else touches
    // them** — `plan:recall seq:6`, the rebuild re-deriving the table the way
    // it re-derives items from Markdown. It is first because the automatic
    // pass below reads the standing anchors to decide what is his and must not
    // be shown an empty table: an index deleted since the last run would
    // otherwise have the pass re-mark everything it can find and leave every
    // anchor he made by hand behind.
    reconcileAnchors(index);
    search = buildSearchIndex(index, { full: hasFlag(args, 'full') });
    auto = markAutomaticAnchors(index);
  } finally {
    index.close();
  }

  if (wantsJson(args)) {
    emitJson(out, { ...report, mirror, search, anchors: auto });
    return 0;
  }
  for (const line of reportLines(report)) out(line);
  for (const line of mirrorLines(mirror)) out(line);
  for (const line of searchLines(search, auto)) out(line);
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

/**
 * One row's name, or the honest absence of one. Never a fabricated title.
 *
 * **Three sources and the cell says which** — `plan:archive seq:34`. `(you)`
 * is a name typed into `mycontext conversation name`; `(model)` is the
 * harness's own `ai-title`; an unmarked cell is a title a person set in Claude
 * Code itself. A column that showed all three the same way would be the
 * asymmetry `seq:34` argued from, moved from the screen into the terminal.
 *
 * When this project's name is shown, the harness's is shown BESIDE it rather
 * than replaced, because the two are different facts and the borrowed one is
 * what every other tool still calls this session.
 */
function titleCell(row: ConversationRow, named: NameRow | null): string {
  const borrowed = row.title === null
    ? null
    : (row.titleSource === 'ai' ? `${row.title} (model)` : row.title);
  if (named === null) return borrowed ?? '—';
  return borrowed === null
    ? `${named.name} (you)`
    : `${named.name} (you) ← ${borrowed}`;
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
    // ONE read of the name table for the whole page, the same shape
    // `apiConversations` uses for the standing marks: this table holds one row
    // per session a person has bothered to name, which is a handful, and a
    // query per listed row would be a cost proportional to the LIST for a fact
    // proportional to the names.
    const named = new Map(index.names().map((row) => [row.sessionId, row]));
    if (wantsJson(args)) {
      emitJson(out, {
        conversations: shown.map((row) => ({
          ...row,
          // Beside the row rather than folded into `title`, so a caller can
          // still see what the harness called it — `plan:archive seq:34`. The
          // stored `title`/`titleSource` are untouched in this document.
          name: named.get(row.sessionId)?.name ?? null,
          namedAt: named.get(row.sessionId)?.namedAt ?? null,
        })),
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
        titleCell(row, named.get(row.sessionId) ?? null),
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
 * **`dispatched by` no longer computes anything — it reads a column** —
 * `plan:archive seq:33`.
 *
 * `seq:32` put the normalisation here, at the point of display, and argued
 * that the index could not carry it: a value normalised on the way in moves no
 * shape, and `conversation-index.ts` rules that THE SHAPE IS THE VERSION, so
 * nothing could tell a row written before the change from one written after
 * it. That argument was right about the mechanism. Its conclusion was wrong,
 * and `seq:33` is the correction — the answer was to MOVE THE SHAPE.
 * `subagents.dispatched_by` is now a column `openReadOnlyChecked` REQUIRES, so
 * an index written before it refuses and is rebuilt rather than serving one
 * column in two namespaces, and `dispatchingAgentId` lives at the seam that
 * builds the row.
 *
 * What that buys here is nothing this file can see and everything a reader
 * can: the same value is now answerable in SQL. `mycontext query`'s
 * `SELECT COUNT(*) FROM subagents c JOIN subagents p ON p.agent_id =
 * c.dispatched_by` answers 43 where the same join on `parent_agent_id`
 * answered 0.
 *
 * `parentAgentId` is still carried verbatim in `--json` beside it, for
 * `seq:32`'s reason, which the column did not change: the two are two
 * questions — what the sidecar said, and what resolves — and one rewritten
 * field would make them unanswerable apart.
 */

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
      // **BOTH ids, and both of them read from the row.** `parentAgentId` is
      // byte-for-byte what the sidecar said and what the index holds, so a
      // reader checking this output against either still can; `dispatchedBy`
      // is the same value the human column prints and is what a caller pipes
      // into another command. Since `plan:archive seq:33` neither is computed
      // here — the row carries both, because `upsertSubagent` derived one from
      // the other at the seam that builds it. One rewritten field would have
      // made those two questions unanswerable apart, which is the whole
      // complaint `seq:32` was about.
      emitJson(out, {
        sessionId,
        subagents: rows,
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
        // From `dispatched_by`, so the 43 print an id that `mycontext
        // conversation show`, the viewer's own address and a SQL join over
        // this table all answer to — see the note above for why the value is
        // now stored rather than derived here.
        row.dispatchedBy ?? 'the session',
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
 * `mycontext conversation secrets [<session>]` — **the candidate list, and the
 * whole of what a form will render.** `plan:archive seq:46`, step 2.
 *
 * ── IT PROPOSES. IT DOES NOT ACT, AND IT CANNOT ───────────────────────────
 *
 * This subcommand writes nothing. It reads one session and answers *what looks
 * private, where, and how many times* — the three things the item asks for by
 * name, because they are what a person needs in order to JUDGE. Replacing
 * anything is a separate act with a separate flag on a separate, gated
 * subcommand (`persist --replace`), and that separation is the design rather
 * than an accident of layout: the owner's own argument against both of the
 * shapes offered before his was that a pattern list must never be in charge of
 * what a reader may see.
 *
 * ── WHY THE TERMINAL AND NOT ONLY THE SCREEN ──────────────────────────────
 *
 * The item leaves WHERE THE FORM LIVES open and asks for both to be weighed.
 * This is the half that has to exist either way. A checkbox form is natural in
 * a browser and awkward in a terminal, but `test/ui/no-writes.test.ts` holds
 * `src/ui/` write bindings to an exact set of one — so a screen cannot perform
 * the export itself, and the shape this product already has for that is the
 * Composer: the screen composes a command and the CLI runs it. Either way the
 * screen needs a derived list to draw and a stable handle to tick, and both
 * are here, in `--json`, so nothing has to be re-derived in the browser.
 *
 * ── NO CANDIDATE'S VALUE IS EVER PRINTED ──────────────────────────────────
 *
 * Every candidate carries a mask, a length, a shape and a context window with
 * every match in it masked. That is enough to tell `secret = cryptoRandomBytes`
 * from a credential, and it means neither the terminal scrollback nor a
 * `--json` file a form fetched becomes a new place a secret is written. This
 * project has the receipt for why that matters: the lane that REPORTED the
 * 2026-09-08 scan wrote a complete bearer token into a corpus item, and corpus
 * items are committed and pushed.
 */
function cmdConversationSecrets(ws: Workspace, root: string, args: string[], out: Emit): number {
  const [, asked] = positionals(args, ['limit']);
  const json = wantsJson(args);

  let index: ConversationIndex;
  try {
    index = ConversationIndex.openReadOnlyChecked(ws.dbPath);
  } catch (err) {
    if (err instanceof ConversationIndexUninitializedError
      || err instanceof ConversationIndexIncompleteError) {
      const dir = transcriptDir(process.env, workspaceCwd(root));
      if (json) {
        emitJson(out, { candidates: [], total: 0, indexed: false, dir, shapes: shapeSummary() });
        return 0;
      }
      out('my_context: nothing is indexed in this workspace yet, so there is nothing to scan.');
      out(`my_context: run \`mycontext conversation rebuild\` to scan ${dir}`);
      return 0;
    }
    throw err;
  }

  let row: ConversationRow | null;
  let sessionId: string | undefined;
  try {
    const sessions = index.all();
    sessionId = asked ?? sessions[0]?.sessionId;
    row = sessionId === undefined ? null : index.get(sessionId);
  } finally {
    index.close();
  }
  if (sessionId === undefined) {
    if (json) {
      emitJson(out, { candidates: [], total: 0, indexed: true, shapes: shapeSummary() });
      return 0;
    }
    out('my_context: the conversation index is built and holds no sessions.');
    return 0;
  }
  if (row === null) {
    out(
      `my_context: no indexed session "${sessionId}". \`mycontext conversation list\` names the ` +
      'ones this workspace has scanned.',
    );
    return 1;
  }

  const scan = scanSessionSecrets(row.file);
  const mirror = mirrorPath(process.env, workspaceCwd(root), sessionId);
  const plan = readRedactionPlan(mirror);
  const accepted = new Set(plan?.accepted ?? []);

  if (json) {
    // **THE SURFACE A FORM CONSUMES.** Every field a checkbox needs is here:
    // `id` is the checkbox's value, `shapeTitle`/`preview`/`contexts` are its
    // label, `occurrences` and `records` are the evidence, `placeholder` is
    // what it becomes, and `accepted` is whether it is already ticked — which
    // is `false` for everything until somebody chooses, because nothing is
    // replaced by default. `replaceCommand` is the Composer's payload: the
    // exact command the screen would hand back to the CLI.
    emitJson(out, {
      sessionId,
      indexed: true,
      file: scan.file,
      source: row.source,
      records: scan.records,
      unreadable: scan.unreadable,
      scannedBytes: scan.scannedBytes,
      truncated: scan.truncated,
      occurrences: scan.occurrences,
      total: scan.candidates.length,
      candidates: scan.candidates.map((candidate) => ({
        ...candidate, accepted: accepted.has(candidate.id),
      })),
      shapes: shapeSummary(),
      chosen: plan === null ? null : {
        accepted: plan.accepted,
        placeholders: plan.placeholders,
        chosenAt: plan.chosenAt,
        projectedAt: plan.projectedAt,
        replaced: plan.replaced,
      },
      replaceCommand: `mycontext conversation persist ${sessionId} --replace <id,id,...>`,
      ms: scan.ms,
    });
    return 0;
  }

  for (const line of secretsLines(sessionId, row, scan, accepted)) out(line);
  return 0;
}

/** The shapes, as a reader or a form legend needs them — never the patterns. */
function shapeSummary(): { id: string; title: string; added: boolean; note: string }[] {
  return SECRET_SHAPES.map(({ id, title, added, note }) => ({ id, title, added, note }));
}

/**
 * The report as a person reads it: a table of candidates, the context that
 * makes each judgeable, and the bound of the scan said out loud.
 */
function secretsLines(
  sessionId: string, row: ConversationRow, scan: SecretScan, accepted: ReadonlySet<string>,
): string[] {
  const thirteen = SECRET_SHAPES.filter((shape) => !shape.added).length;
  const added = SECRET_SHAPES.length - thirteen;
  const lines: string[] = [
    `my_context: scanned session ${sessionId.slice(0, 8)} — ${scan.records} record(s), ` +
    `${scan.scannedBytes} byte(s) of ${row.file} — for ${SECRET_SHAPES.length} credential ` +
    `shape(s): the ${thirteen} the 2026-09-08 scan covered and ${added} added since.`,
  ];
  if (scan.candidates.length === 0) {
    lines.push(
      'my_context: nothing in this session matches any of them — a measured zero, and it is ' +
      'NOT a promise that the session holds no secret. A credential that looks like an ' +
      'ordinary word is missed by every shape here, and this list is what lets you see that ' +
      'gap rather than be reassured about it.',
    );
    return lines;
  }
  lines.push(...table(
    ['candidate', 'looks like', 'chars', 'times', 'records', 'preview'],
    scan.candidates.map((candidate) => [
      accepted.has(candidate.id) ? `${candidate.id} (chosen)` : candidate.id,
      candidate.shapeTitle,
      String(candidate.length),
      String(candidate.occurrences),
      candidate.records.join(',')
        + (candidate.recordsOmitted > 0 ? `+${candidate.recordsOmitted}` : ''),
      candidate.preview,
    ]),
  ));
  for (const candidate of scan.candidates) {
    lines.push(`my_context: ${candidate.id} — ${candidate.contexts[0] ?? '(no context)'}`);
  }
  if (scan.unreadable > 0) {
    lines.push(
      `my_context: ${scan.unreadable} line(s) of this transcript would not parse and were not ` +
      'searched. They are counted rather than skipped, because an unsearched record is a gap ' +
      'in this list and not an absence of candidates.',
    );
  }
  if (scan.truncated) {
    lines.push(
      `my_context: the scan stopped at its ${MAX_SCAN_BYTES} byte cap, so this list is a FLOOR ` +
      'and not a total — a candidate that appears only later in the transcript is not here.',
    );
  }
  lines.push(
    'my_context: NOTHING has been replaced. This is a list of things that LOOK private, and ' +
    'most of a list like this is wrong: the same scan over 1.7 GB on 2026-09-08 found eight ' +
    'matches of which one was a real secret, five were test probes and one was the word ' +
    '`secret` in an assignment. Only you can tell them apart.',
  );
  lines.push(
    'my_context: to fake the ones that are real: `mycontext conversation persist '
    + `${sessionId.slice(0, 8)} --replace ${scan.candidates[0]?.id ?? '<id>'}\` — comma-separate `
    + 'more ids. The copy this product keeps stays byte-faithful; the redacted copy is a second '
    + 'file beside it.',
  );
  return lines;
}

/**
 * **The sentence a copy that leaves this machine has to carry, said FIRST.**
 *
 * `plan:archive seq:11`'s lane put exactly such a sentence (`conv.sensitive`)
 * at the top of the archive's own help on the screen, and this follows that
 * precedent rather than inventing a policy of its own. It is not a gate and
 * does not redact anything: the security work on the archive is not this
 * lane's, and refusing to build the copy would not have made the transcript
 * any less readable where it already sits.
 *
 * What it does is put the fact in front of the person at the one moment it is
 * actionable — before they agree to make a file they can hand to somebody.
 * A session transcript carries full tool-call inputs and full tool results, so
 * a key that was pasted into a prompt, or read by a command whose output the
 * transcript recorded, is in the copy verbatim.
 */
const WHAT_A_COPY_HOLDS =
  'my_context: a copy of a session holds everything you and Claude typed AND every tool call '
  + 'with its full input and its full result — so whatever was pasted, printed or read along '
  + 'the way is in it verbatim: keys, tokens, someone else\'s data. This copy lives outside '
  + 'your project and outside your repository, which means it is a file you can send and a '
  + 'file no `.gitignore` is protecting.';

/**
 * `mycontext conversation persist` — **the standing mark, and the mirror that
 * keeps up with it.** `plan:archive seq:4`.
 *
 * ── WHY THIS IS PERSISTENCE AND NOT AN EXPORT, WHICH THE ITEM RE-CUT ──────
 *
 * The owner's ruling of 2026-09-07: *"EVERY CHANGE IN A SESSION FILE SHOULD
 * ALSO BE WRITTEN TO ITS PERSISTENT EXTERNAL FILE IN ORDER NOT TO LOSE
 * CONTENT."* A one-shot export of a session still being written captures half
 * of it and says nothing about which half. So the act here is a MARK, and
 * `advanceMirrors` — on this command's `rebuild` sibling and on the `Stop`
 * hook — is what keeps it true.
 *
 * **Export is not a second command, because the mirror IS the export.** It is
 * one ordinary `.jsonl` at a stable path this command prints. A separate
 * `export` verb would put two copies of one session on disk for the two
 * commands to disagree about, which is the defect this repository spent
 * 2026-09-07 measuring in its own documents, wearing a filesystem.
 *
 * ── `--yes` AND NOT `--count`, AND THE ITEM ASKED FOR THE ARGUMENT ────────
 *
 * The project's own distinction: `--yes` is for a command performing ONE
 * write, `--count` for a command acting on N items, because stating the number
 * IS the agreement. This takes one named session and writes one file. There is
 * no `--all`, deliberately — a flag that persisted every session on the machine
 * would be a single keystroke copying gigabytes of transcript out of the
 * harness's directory, which is precisely the act that should be typed one
 * session at a time.
 *
 * ── WHICH SIDE OF THE APPROVAL BOUNDARY, AND WHY ──────────────────────────
 *
 * It takes `--yes`, so it is GATED; it is not on the approval boundary, and
 * `test/helpers/approval-boundary.ts`' `OUTSIDE_BOUNDARY` carries the reason.
 * The boundary's own working definition is "changes what governs this project
 * with no human in the loop". This creates no item, retires none, promotes
 * none and puts no text in front of a model — it copies the reader's own
 * transcript to the reader's own home directory. Putting it in §7's table
 * would claim that keeping a copy of your own conversation changes what
 * governs this corpus, which is a false claim in a document whose whole value
 * is that it is exact. The gate is real and is about something else: a write
 * that leaves the project is an act that asks.
 */
/**
 * Has anybody scanned here? Asked through the READ door, which creates
 * nothing — the whole of what makes the archive opt-in.
 *
 * `false` is answered with the sentence and the command that would change it,
 * so a refusal is never a dead end.
 */
function indexExists(ws: Workspace, out: Emit): boolean {
  try {
    ConversationIndex.openReadOnlyChecked(ws.dbPath).close();
    return true;
  } catch (err) {
    if (err instanceof ConversationIndexUninitializedError
      || err instanceof ConversationIndexIncompleteError) {
      out('my_context: nothing is indexed in this workspace yet, so no session is being kept.');
      out('my_context: run `mycontext conversation rebuild` first.');
      return false;
    }
    throw err;
  }
}

function cmdConversationPersist(ws: Workspace, root: string, args: string[], out: Emit): number {
  const json = wantsJson(args);
  const [, asked] = positionals(args, ['limit', 'replace']);
  const cwd = workspaceCwd(root);
  // Three states, not two, and the middle one is the reason this is a LIST
  // flag rather than a string: absent is "no choice given and none changed",
  // `--replace=` is "present and empty", i.e. UNTICK EVERYTHING, and a list is
  // the choice itself. Without the middle state there is no way to take a
  // choice back, and a person who ticked something by mistake would have to
  // delete files by hand to undo it.
  const replace = listFlag(args, 'replace');

  if (hasFlag(args, 'off')) {
    if (replace !== null) {
      out(
        'my_context: `--off` stops keeping the session and `--replace` changes what is faked ' +
        'inside the copy it keeps. Those are opposite acts and running them together would ' +
        'leave it ambiguous which one won, so neither is done. Run them one at a time.',
      );
      return 1;
    }
    if (asked === undefined) {
      out('my_context: `--off` needs the session to stop keeping.\n\n' + USAGE);
      return 1;
    }
    // **THE OPT-IN GATE, AND THIS BRANCH IS THE ONE THAT MOST WANTS TO SKIP
    // IT.** `unpersistSession` opens the index for WRITE, and
    // `ConversationIndex.open` is the only thing that creates these tables —
    // so a bare `persist --off` in a workspace nobody has ever scanned would
    // CREATE them, and the end-of-turn refresh, which gates on their
    // existence, would start reading that machine's transcripts. Turning
    // something off is the last act that should turn the archive on.
    if (!indexExists(ws, out)) return 1;
    const result = unpersistSession(ws.dbPath, asked);
    if (json) {
      emitJson(out, result);
      return 0;
    }
    if (!result.unmarked) {
      out(`my_context: session ${asked.slice(0, 8)} was not being kept, so nothing changed.`);
      return 0;
    }
    out(
      `my_context: session ${asked.slice(0, 8)} is no longer kept up to date. The copy is left ` +
      `exactly where it is — ${result.file} — because deleting it could destroy the only ` +
      'remaining record of a conversation, and this command only stops the copying.',
    );
    return 0;
  }

  if (asked === undefined) {
    if (replace !== null) {
      out('my_context: `--replace` needs the session whose copy it is about.\n\n' + USAGE);
      return 1;
    }
    return listPersisted(ws, cwd, out, json);
  }

  let index: ConversationIndex;
  try {
    index = ConversationIndex.openReadOnlyChecked(ws.dbPath);
  } catch (err) {
    if (err instanceof ConversationIndexUninitializedError
      || err instanceof ConversationIndexIncompleteError) {
      out('my_context: nothing is indexed in this workspace yet, so there is no session to keep.');
      out(
        'my_context: run `mycontext conversation rebuild` to scan ' +
        `${transcriptDir(process.env, cwd)}`,
      );
      return 1;
    }
    throw err;
  }
  let row: ConversationRow | null;
  let already: boolean;
  try {
    row = index.get(asked);
    already = row !== null && index.persistedOf(asked) !== null;
  } finally {
    index.close();
  }
  if (row === null) {
    out(
      `my_context: no indexed session "${asked}". \`mycontext conversation list\` names the ` +
      'ones this workspace has scanned.',
    );
    return 1;
  }

  // The preview, then the question. The order every gated command in this
  // product uses, and the sensitivity sentence is FIRST inside it.
  if (!hasFlag(args, 'yes') && !json) {
    out(WHAT_A_COPY_HOLDS);
    out(
      `my_context: about to copy session ${asked.slice(0, 8)} — ${row.records} record(s), ` +
      `${row.bytes} byte(s) — from ${row.file} to ` +
      `${mirrorDir(process.env, cwd)}, and to keep that copy up to date at the end of every ` +
      'assistant turn from now on. Nothing is copied into your repository and nothing here is ' +
      'sent anywhere; `mycontext conversation persist --off ' + asked.slice(0, 8) + '` stops ' +
      'the copying and leaves the file.',
    );
  }
  if (replace !== null && !hasFlag(args, 'yes') && !json) {
    for (const line of replacePreview(replace)) out(line);
  }
  if (!confirmAction(args, out, 'Keep a copy of this session outside the project?')) return 1;

  try {
    const result = persistSession(ws.dbPath, process.env, cwd, asked);
    if (json) {
      emitJson(out, { ...result, already });
      // The mark's own report first, then the choice's — two documents rather
      // than one merged object, because they are two acts and only the first
      // of them happened on a bare `persist`. A caller reading this stream
      // gets the same two answers whether or not `--replace` was given.
      if (replace !== null) return applyRedaction(result.file, asked, replace, out, json);
      return 0;
    }
    out(
      `my_context: ${result.written} byte(s) written; the copy holds ${result.bytes} of ` +
      `${row.bytes} byte(s) in ${result.ms}ms.`,
    );
    out(`my_context: ${result.file}`);
    if (result.bytes < row.bytes) {
      // The tail stops at the last whole line, so a transcript caught
      // mid-record is short by exactly that record and says so rather than
      // letting a partial copy look complete — `INV-nothing-is-dropped-silently`.
      out(
        `my_context: ${row.bytes - result.bytes} byte(s) at the end were a record still being ` +
        'written, so they were not copied. The next turn takes them whole.',
      );
    }
    out(
      'my_context: it is kept up to date at the end of every assistant turn, and by ' +
      '`mycontext conversation rebuild`. If the original is ever deleted, this copy is what ' +
      'the archive reads and the session stays in the list, marked as the copy.',
    );
    if (replace !== null) return applyRedaction(result.file, asked, replace, out, json);
    return 0;
  } catch (err) {
    if (err instanceof NotIndexedError) {
      out(err.message);
      return 1;
    }
    throw err;
  }
}

/** What `--replace` is about to do, said before the question rather than after. */
function replacePreview(accepted: readonly string[]): string[] {
  if (accepted.length === 0) {
    return [
      'my_context: `--replace=` is empty, so NOTHING will be faked: the redacted copy and the ' +
      'choice behind it are removed and the byte-faithful copy is left exactly as it is. That ' +
      'is the way to take a choice back.',
    ];
  }
  return [
    `my_context: and ${accepted.length} candidate(s) will be replaced by an obviously fake ` +
    'stand-in in a SECOND file beside the copy — every occurrence of each, in this session and ' +
    'in everything appended to it afterwards. The copy itself stays byte-for-byte the ' +
    'transcript: it is the record, and a record that was quietly altered is worth less than ' +
    'one that was not.',
  ];
}

/**
 * **The choice, applied** — `plan:archive seq:46`, step 4, at its call site.
 *
 * It runs AFTER the mirror is written and never instead of it, because the
 * redacted copy is DERIVED from the mirror. That ordering is the whole reason
 * the byte-faithful default survives a feature about replacing things: the
 * record is written first and unconditionally, and this adds a second file
 * beside it. An empty accepted set removes that second file rather than
 * producing an identical one, so `--replace=` leaves exactly the state the
 * session was in before anybody chose anything.
 */
function applyRedaction(
  mirror: string, sessionId: string, accepted: readonly string[], out: Emit, json: boolean,
): number {
  if (accepted.length === 0) {
    const removed = clearRedactions(mirror);
    if (json) {
      emitJson(out, { sessionId, accepted: [], cleared: removed, file: null });
      return 0;
    }
    out(removed
      ? 'my_context: the choice and the redacted copy it produced are gone. The byte-faithful ' +
        'copy is untouched.'
      : 'my_context: nothing was being faked in this session, so nothing changed.');
    return 0;
  }
  let result: RedactionResult;
  try {
    result = chooseRedactions(mirror, sessionId, accepted);
  } catch (err) {
    if (err instanceof NoMirrorError) {
      out(err.message);
      return 1;
    }
    throw err;
  }
  if (json) {
    emitJson(out, result);
    return 0;
  }
  out(
    `my_context: ${result.plan.replaced} occurrence(s) of ${result.plan.accepted.length} ` +
    `candidate(s) were replaced across ${result.plan.records} record(s), ` +
    `${result.written} byte(s) written in ${result.ms}ms.`,
  );
  out(`my_context: ${result.file}`);
  for (const [id, placeholder] of Object.entries(result.plan.placeholders)) {
    out(`my_context: ${id} is now ${placeholder}`);
  }
  if (result.unresolved.length > 0) {
    // **NAMED, NEVER DROPPED.** An id that matches nothing in this session is
    // either a typo or a value that has not been written yet, and the two are
    // told apart by the person, not here. It is KEPT in the choice so that a
    // value appearing in a later tail is still faked — silently forgetting a
    // choice is the one thing this design must not do.
    out(
      `my_context: ${result.unresolved.length} of the ids you gave match nothing in this ` +
      `session: ${result.unresolved.join(', ')}. They are kept in the choice anyway, so if ` +
      'that value is appended later it is faked then. `mycontext conversation secrets ' +
      `${sessionId.slice(0, 8)}\` lists the ids this session actually offers.`,
    );
  }
  if (result.plan.unreadable > 0) {
    out(
      `my_context: ${result.plan.unreadable} line(s) would not parse and were copied VERBATIM ` +
      'rather than searched. Nothing in them was replaced, and this line is how you know.',
    );
  }
  return 0;
}

/** Every mark, and where the copy is — the answer to a bare `persist`. */
function listPersisted(ws: Workspace, cwd: string, out: Emit, json: boolean): number {
  let index: ConversationIndex;
  try {
    index = ConversationIndex.openReadOnlyChecked(ws.dbPath);
  } catch (err) {
    if (err instanceof ConversationIndexUninitializedError
      || err instanceof ConversationIndexIncompleteError) {
      if (json) {
        emitJson(out, { persisted: [], total: 0, indexed: false, dir: mirrorDir(process.env, cwd) });
        return 0;
      }
      out('my_context: nothing is indexed in this workspace yet, so nothing is being kept.');
      return 0;
    }
    throw err;
  }
  try {
    const marks = index.persisted();
    if (json) {
      emitJson(out, {
        persisted: marks, total: marks.length, indexed: true, dir: mirrorDir(process.env, cwd),
      });
      return 0;
    }
    if (marks.length === 0) {
      out(
        'my_context: no session in this workspace is being kept outside the project — a ' +
        'measured zero, not a question nobody asked.',
      );
      out(`my_context: \`mycontext conversation persist <session>\` starts one. ${USAGE}`);
      return 0;
    }
    const drawn = table(
      ['session', 'kept since', 'last copied', 'bytes', 'file'],
      marks.map((mark) => [
        mark.sessionId.slice(0, 8),
        zonedStamp(mark.markedAt) ?? mark.markedAt,
        zonedStamp(mark.mirroredAt) ?? mark.mirroredAt,
        String(mark.bytes),
        mark.file,
      ]),
    );
    for (const line of drawn) out(line);
    const broken = marks.filter((mark) => mark.note !== null);
    for (const mark of broken) {
      out(`my_context: ${mark.sessionId.slice(0, 8)} — ${mark.note}`);
    }
    out(`my_context: showing all ${marks.length}.`);
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
/**
 * **How long a name this project gave a session may be.**
 *
 * 120 characters, and it is a READABILITY bound rather than a storage one:
 * the name is drawn as the heading of a list row beside a day, five counts, a
 * branch and a size, and anything longer stops being a name and becomes a
 * sentence the row has to wrap. For comparison, the longest `ai-title` the
 * harness has written in this workspace is 14 characters (`MyContext V2.0`).
 */
const NAME_CAP = 120;

/**
 * A name is ONE LINE, and this is what that means in characters.
 *
 * A newline would break the terminal table and the row heading both; the C0
 * controls include the NUL that `npm run check:text-files` exists to keep out
 * of this repository's own files, and there is no reason to let one into its
 * database either. Refused by NAME rather than stripped, because silently
 * storing something other than what was typed is the defect the whole of this
 * item is about — a name whose source a reader cannot trust.
 */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * `mycontext conversation name` — **the one name this project owns**,
 * `plan:archive seq:34`.
 *
 * -- WHAT THIS IS THE OTHER HALF OF ---------------------------------------
 *
 * `plan:archive seq:10`'s spec asked for the title to be *"taken from the
 * transcript's own `aiTitle` AND OVERRIDABLE for a session worth naming"*, and
 * shipped only the first half. `seq:34` recorded the silence as a choice
 * rather than leaving it as one, costed the reversal, and left the decision
 * with the owner. He asked for naming. This is it, built to the shape that
 * item costed: a store, one subcommand, and the screen preferring it.
 *
 * -- WHY IT IS NOT `--yes`-GATED, WHICH EVERY OTHER WRITE HERE IS ----------
 *
 * `persist` asks because its write LEAVES THE PROJECT — a file in the home
 * directory that no `.gitignore` protects. `forget` asks because it drops
 * rows. This writes one short string into this workspace's own index, changes
 * nothing on disk outside it, destroys nothing, and is undone by the same
 * command with `--clear`. A confirmation on it would teach a reader that the
 * gate means nothing, which is the cost of asking about something cheap.
 *
 * -- AND IT DOES NOT TOUCH THE TRANSCRIPT ---------------------------------
 *
 * Claude Code stores its own name for a session in `custom-title.json` beside
 * the transcript, and writing there is what "overridable" most cheaply means.
 * This does not do that, on the rule `readSubagentMeta` states for the
 * sidecar and `seq:33`/`seq:48` both turned on: the harness's record is
 * REPORTED and never rewritten. A name written into the harness's own file
 * would come back as `titleSource = 'custom'` and be indistinguishable from
 * one the reader set in Claude Code — so the screen could no longer tell them
 * which of the two they were reading, which is exactly the confusion `seq:34`
 * exists to end.
 */
function cmdConversationName(ws: Workspace, root: string, args: string[], out: Emit): number {
  const json = wantsJson(args);
  // Everything after the session id is the name, joined with single spaces, so
  // `conversation name abc123 the archive lane` works unquoted. `positionals`
  // has already removed the flags and their values, so nothing here can be one.
  const [, asked, ...rest] = positionals(args, ['limit', 'replace']);
  const clear = hasFlag(args, 'clear');

  if (asked === undefined) {
    if (clear) {
      out('my_context: `--clear` needs the session whose name it is taking back.\n\n' + USAGE);
      return 1;
    }
    return listNames(ws, out, json);
  }

  const typed = rest.join(' ').trim();
  if (clear && typed !== '') {
    out(
      'my_context: `--clear` takes the name back and a name given here sets one. Those are ' +
      'opposite acts and running them together would leave it ambiguous which one won, so ' +
      'neither is done. Run them one at a time.',
    );
    return 1;
  }
  if (!clear && typed === '') {
    out(
      `my_context: \`conversation name ${asked.slice(0, 8)}\` with no name says nothing about ` +
      'what to call it. Give the name, or `--clear` to take back the one it has.\n\n' + USAGE,
    );
    return 1;
  }
  if (typed.length > NAME_CAP) {
    out(
      `my_context: a name is at most ${NAME_CAP} characters and this one is ${typed.length}. It ` +
      'is drawn as the heading of a list row, so a longer one stops being a name and becomes a ' +
      'sentence the row has to wrap.',
    );
    return 1;
  }
  if (CONTROL_CHARACTERS.test(typed)) {
    out(
      'my_context: a name is one line of text — no newlines and no control characters. Nothing ' +
      'was stored, rather than storing something other than what you typed.',
    );
    return 1;
  }

  // **THE OPT-IN GATE, and this branch wants to skip it exactly as
  // `persist --off` did.** `ConversationIndex.open` is the only thing that
  // creates these tables, so naming a session in a workspace nobody has ever
  // scanned would CREATE them — and the end-of-turn refresh, which gates on
  // their existence, would start reading that machine's transcripts. Naming
  // something is not a way to turn the archive on.
  if (!indexExists(ws, out)) return 1;

  let row: ConversationRow | null;
  let lane: SubagentRow | null;
  let existing: NameRow | null;
  const read = ConversationIndex.openReadOnlyChecked(ws.dbPath);
  try {
    row = read.get(asked);
    lane = row === null ? read.getSubagent(asked) : null;
    existing = read.nameOf(asked);
  } finally {
    read.close();
  }

  if (row === null) {
    // **A lane is refused BY NAME, and the refusal is the interesting one.** A
    // lane already carries a name nobody borrowed: the one line its dispatcher
    // typed, which the index stores as `description` and the document draws
    // with `titleSource = 'agent'`. So the asymmetry this command exists to
    // fix is not present on a lane, and a second name there would compete with
    // a real one rather than replace a borrowed one.
    if (lane !== null) {
      out(
        `my_context: "${asked}" is a helper agent, not a session. A lane already carries the ` +
        'name the agent that dispatched it typed' +
        (lane.description === null ? '' : ` — "${lane.description}"`) +
        ', so there is no borrowed name here to replace. Name the session that dispatched it: ' +
        `\`mycontext conversation subagents ${lane.sessionId.slice(0, 8)}\` lists them.`,
      );
      return 1;
    }
    out(
      `my_context: no indexed session "${asked}". \`mycontext conversation list\` names the ` +
      'ones this workspace has scanned.',
    );
    return 1;
  }

  const index = ConversationIndex.open(ws.dbPath);
  try {
    if (clear) {
      const cleared = index.clearName(asked);
      if (json) {
        emitJson(out, {
          sessionId: asked, cleared, name: null,
          title: row.title, titleSource: row.titleSource,
        });
        return 0;
      }
      if (!cleared) {
        out(`my_context: session ${asked.slice(0, 8)} had no name here, so nothing changed.`);
        return 0;
      }
      out(
        `my_context: session ${asked.slice(0, 8)} is no longer named "${existing?.name ?? ''}" ` +
        'here. Nothing was restored, because nothing was ever overwritten: the archive goes ' +
        'back to showing ' + borrowedPhrase(row) + '.',
      );
      return 0;
    }

    const namedAt = new Date().toISOString();
    index.setName({ sessionId: asked, name: typed, namedAt });
    if (json) {
      emitJson(out, {
        sessionId: asked, name: typed, namedAt, renamed: existing !== null,
        title: row.title, titleSource: row.titleSource,
      });
      return 0;
    }
    out(
      existing === null
        ? `my_context: session ${asked.slice(0, 8)} is now named "${typed}" in this project.`
        : `my_context: session ${asked.slice(0, 8)} was named "${existing.name}" and is now ` +
          `named "${typed}" in this project.`,
    );
    // **The borrowed name is still there, and saying so is the point.** The
    // whole finding behind `seq:34` is that a reader could not tell this
    // project's name from Claude Code's. Reporting both at the moment one is
    // set is the cheapest place to make that difference legible.
    out(
      `my_context: Claude Code's own name for it is untouched — ${borrowedPhrase(row)} — and ` +
      `the transcript at ${row.file} was not written to. The archive draws yours and says ` +
      'whose it is. `--clear` takes it back.',
    );
    return 0;
  } finally {
    index.close();
  }
}

/** What the harness calls a session, in a phrase both branches above can print. */
function borrowedPhrase(row: ConversationRow): string {
  if (row.title === null) return 'no name at all, which is what it had';
  return row.titleSource === 'ai'
    ? `"${row.title}", which the model wrote`
    : `"${row.title}", which was set in Claude Code`;
}

/** Every name this project has given, and the answer to a bare `name`. */
function listNames(ws: Workspace, out: Emit, json: boolean): number {
  if (!indexExists(ws, out)) return 1;
  const index = ConversationIndex.openReadOnlyChecked(ws.dbPath);
  try {
    const names = index.names();
    if (json) {
      emitJson(out, { named: names, total: names.length, indexed: true });
      return 0;
    }
    if (names.length === 0) {
      // A measured zero, named as one. The archive is full of sessions; what
      // is empty is the set this project has bothered to name, and those are
      // two different nothings.
      out(
        'my_context: no session in this workspace has been given a name here. The archive draws ' +
        'the name Claude Code gave each one.',
      );
      out(`my_context: \`mycontext conversation name <session> "<name>"\` gives one. ${USAGE}`);
      return 0;
    }
    const drawn = table(
      ['session', 'named', 'name', 'claude code calls it'],
      names.map((named) => {
        const row = index.get(named.sessionId);
        return [
          named.sessionId.slice(0, 8),
          zonedStamp(named.namedAt) ?? named.namedAt,
          named.name,
          row === null ? '— (not indexed)' : (row.title ?? '—'),
        ];
      }),
    );
    for (const line of drawn) out(line);
    out(`my_context: showing all ${names.length}.`);
    return 0;
  } finally {
    index.close();
  }
}

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
  // **The marks go and the copies stay, said out loud.** This command's whole
  // argument is that it drops a cache the transcripts can rebuild; a mirror is
  // the opposite kind of thing, and for an orphaned session it may be the only
  // copy left. Deleting one here would destroy knowledge under a confirmation
  // that promises it destroys none — `INV-nothing-is-dropped-silently` in the
  // direction that matters most.
  if (report.persisted > 0) {
    out(
      `my_context: ${report.persisted} session(s) were being kept outside this project and are ` +
      'no longer kept up to date. The copies themselves are UNTOUCHED, in ' +
      `${mirrorDir(process.env, workspaceCwd(root))} — deleting them is yours to do, not this ` +
      'command\'s.',
    );
  }
  return 0;
}


/* ══ ANCHORS — `plan:recall seq:1`, Task 4 ════════════════════════════════ */

/**
 * **What the automatic pass will mark, and why it is a grammar rather than a
 * judgement.**
 *
 * §7 of the retrieval design records the owner's ruling that things which are
 * anchors BY NATURE are marked *"automatically by the assistant without
 * requiring the user to initiate one"*, and names *"a table, a report"* and a
 * ruling he gave. **The report half was withdrawn on 2026-09-11**, by him,
 * after reading the 613 anchors the first night produced — see the note where
 * that grammar used to be. What is left is a table and a ruling, and
 * everything below is the reading of "by nature" that this command is willing
 * to defend: a shape the text either has or has not.
 *
 * Nothing here scores, thresholds or infers. That is deliberate, and the
 * research this plan rests on is the reason: a lexical signal/noise classifier
 * measured **AUC 0.499** on this corpus — a coin flip — and a two-rule version
 * of the best single feature still admitted 47% of the noise. A detector that
 * guessed would fill his list with turns he never wanted and he would stop
 * reading the list, which costs more than marking nothing.
 *
 * Each finding also carries the EVIDENCE as its label — the table's header
 * row, the path, the id — so a reader can see what fired without opening the
 * turn, and a wrong mark is visibly wrong rather than merely present.
 */
export interface AutoAnchorFinding {
  /** Which grammar matched. `'table'` or `'ruling'`. */
  kind: string;
  /**
   * The evidence — never a summary of the turn. A ruling's is the id,
   * verbatim; a table's is its first readable header cell, which is the one
   * place this stops being verbatim and says why (`tableLabel`).
   */
  label: string;
}

/** The cells of one Markdown table row, or `null` when the line is not one. */
function cellsOf(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return null;
  const inner = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  return inner.split('|').map((cell) => cell.trim());
}

/** GFM's delimiter row: every cell is dashes, with optional alignment colons. */
function isDelimiter(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

/**
 * **A cell somebody can read: it carries a letter or a digit.**
 *
 * `\p{L}` and `\p{N}` rather than `[a-z0-9]`, and that is not tidiness — this
 * archive is half Hebrew, and an ASCII test would have called every Hebrew
 * header unreadable and thrown it onto the fallback below.
 */
function isReadable(cell: string): boolean {
  return /[\p{L}\p{N}]/u.test(cell);
}

/**
 * **What one table's anchor is CALLED.**
 *
 * The owner's ruling of 2026-09-11, on reading his own list: a table anchor
 * must be labelled with something a person can read — *the table's first
 * header cell*. It was the whole header row joined with `" | "` until then,
 * which is why 25 of his anchors were labelled literally `|` and five more
 * `|  |`: a header of empty cells joins to nothing but its own borders, and a
 * bookmark called `|` is one he cannot recognise in a list.
 *
 * "First" therefore means the first cell there is anything to read IN. An
 * empty corner cell over a row-label column is ordinary, and skipping it
 * yields the table's own header rather than a fallback.
 *
 * **When no cell has anything in it, the label SAYS so** rather than drawing
 * the border characters. It is a poor name and an honest one; the alternative
 * is the defect this fixes.
 */
function tableLabel(header: string[]): string {
  const named = header.find(isReadable);
  return named ?? `a table of ${header.length} columns`;
}

/**
 * **The label of the first GFM table in this text, or `null`.**
 *
 * The rule for what IS a table is GFM's own and not an approximation of it: a
 * delimiter row, and a header row directly above it with THE SAME NUMBER OF
 * CELLS. Both halves earn their place against shapes that occur in this
 * archive constantly —
 *
 *   - a line full of `|` with no delimiter under it is a shell pipeline, and a
 *     detector that marked those would mark most `Bash` turns in the corpus;
 *   - a row of dashes whose count does not match the header is ASCII art or a
 *     horizontal rule someone drew with pipes.
 *
 * What comes back is `tableLabel`'s answer, which is never empty and never
 * only punctuation.
 *
 * Exported so the grammar can be tested on its own, in both directions. A
 * detector whose only test is through the command is a detector whose FALSE
 * side nobody checked.
 */
export function tableIn(text: string): string | null {
  const lines = text.split('\n');
  for (let i = 1; i < lines.length; i += 1) {
    const delimiter = cellsOf(lines[i] ?? '');
    if (delimiter === null || !isDelimiter(delimiter)) continue;
    const header = cellsOf(lines[i - 1] ?? '');
    if (header === null || header.length !== delimiter.length || header.length < 2) continue;
    return tableLabel(header);
  }
  return null;
}

/**
 * ── THERE WAS A THIRD GRAMMAR HERE, AND HE RULED IT OUT ────────────────────
 *
 * A **report** was a dated `.md` path under `reports/` or
 * `docs/superpowers/{specs,plans}/`. It contributed 101 of the 613 anchors the
 * pass wrote into his index overnight, and on 2026-09-11 he read them and
 * ruled: it marks *a turn that mentions a report*, not a report, and those are
 * not worth having. The regex is gone, the two probes that fed it are gone,
 * and `markAutomaticAnchors` takes back the anchors it already wrote —
 * `TASK-trim-the-automatic-anchor-pass-to-the-two-kinds-he-ruled`.
 *
 * `test/cli/anchors.test.ts` holds the removal from both ends: the grammar
 * answers `null` for such a path, and a rebuild over a fixture that names two
 * of them writes no anchor at either byte. Neither assertion alone would
 * notice a probe put back without its regex, or a regex put back without its
 * probe.
 *
 * The RULING grammar below is untouched. He judged those the useful ones.
 */

/**
 * A NORMATIVE corpus id — the categories that carry a ruling.
 *
 * `TASK-` and `REQ-` are deliberately absent. They are ids of work, not of
 * rulings, and this repository holds 728 of the former against 94 `DEC-`; a
 * prefix set widened to catch them would mark nearly every turn of a working
 * session, which is the point at which a list of bookmarks stops being one.
 */
const RULING_ID = /\b(?:DEC|RULE|INSTR|STD|CONST|INV)-[a-z0-9]+(?:-[a-z0-9]+){3,}\b/;

/**
 * **What, if anything, makes this turn an anchor by nature.**
 *
 * The order is the precedence, and first match wins: a turn that both holds a
 * table and names a report is marked as the table, because the table is the
 * thing in the turn rather than a thing the turn points at.
 *
 * `kind` is the turn's own — `classifyTurn`'s, already decided one layer down.
 * A ruling is restricted to `'prompt'` because a ruling is something the owner
 * GAVE; the same id in an answer is a citation, and citations are what this
 * project's assistants write in nearly every turn.
 */
export function anchorInTurn(kind: string, text: string): AutoAnchorFinding | null {
  const table = tableIn(text);
  if (table !== null) return { kind: 'table', label: table };
  if (kind === 'prompt') {
    const ruling = RULING_ID.exec(text);
    if (ruling !== null) return { kind: 'ruling', label: ruling[0] };
  }
  return null;
}

/**
 * **The cheap probes that narrow the archive before the grammar decides.**
 *
 * The grammar above needs a turn's WHOLE text and the prose index stores it,
 * but nothing exposes "every span" — and walking all 875 MB of transcript a
 * second time to re-derive what the index already read would cost the rebuild
 * its whole argument. So this uses the index as an index: each probe is a
 * contiguous substring that a turn of that kind MUST contain, `searchArchive`
 * returns the candidates, and the record at each candidate's byte offset is
 * read — one seek, one line — and put to the grammar.
 *
 * **A probe is allowed to be loose and the grammar is not.** `---` appears in
 * YAML front matter, in horizontal rules and in half the ASCII art in this
 * archive; every one of those is a candidate and none of them is marked,
 * because `tableIn` asks for a header row with a matching cell count. The
 * probe decides what is READ; the grammar decides what is MARKED.
 */
const ANCHOR_PROBES: { probe: string; kind?: 'prompt' | 'answer' }[] = [
  { probe: '|---' },
  { probe: '| ---' },
  { probe: 'DEC-', kind: 'prompt' },
  { probe: 'RULE-', kind: 'prompt' },
  { probe: 'INSTR-', kind: 'prompt' },
  { probe: 'STD-', kind: 'prompt' },
  { probe: 'CONST-', kind: 'prompt' },
  { probe: 'INV-', kind: 'prompt' },
];

/**
 * How many candidates one probe brings back.
 *
 * A bound rather than everything, for `MAX_SCAN_BYTES`' reason: this runs on a
 * command a person types and must not become the slow part of it. When a probe
 * fills its bound the report SAYS so, because a capped pass and a complete one
 * must not look the same.
 */
const ANCHOR_PROBE_LIMIT = 200;

export interface AutoAnchorReport {
  /** Candidate turns the probes brought back, before the grammar saw them. */
  probed: number;
  /** Turns the grammar recognised. */
  found: number;
  /** Anchors written — `found` minus the ones already standing at that point. */
  marked: number;
  /**
   * Anchors the pass had written before and TOOK BACK, because the grammar it
   * runs today does not recognise what is at that byte. Never one of his.
   */
  dropped: number;
  /** Anchors the pass had written before whose label or kind it re-derived. */
  relabelled: number;
  /** At least one probe filled its bound, so there may be more behind it. */
  capped: boolean;
  ms: number;
}

/** The transcript one hit lives in, or `null` when the archive lost the row. */
function fileOf(index: ConversationIndex, sessionId: string, agentId: string | null): string | null {
  if (agentId === null) return index.get(sessionId)?.file ?? null;
  return index.getSubagent(agentId)?.file ?? null;
}

/**
 * The words at one byte offset of one transcript, and how that turn was
 * classified — or `null` when nothing readable starts there.
 *
 * One seek and one line, exactly as `resolveAnchor` reads: the generator's
 * `finally` closes the descriptor when the loop breaks, so this costs the
 * record and not the file.
 *
 * The classification is `classifyTurn`'s, derived here from the record itself
 * rather than read off the prose index, because the sweep below reaches
 * anchors the prose index never offered as candidates. It is the SAME call the
 * prose walk makes (`conversation-search.ts`' `proseFrom`), so the two cannot
 * come to disagree about what a prompt is.
 */
function turnAt(file: string, byteOffset: number): { kind: string; text: string } | null {
  for (const record of iterateTranscript(file, { startByte: byteOffset })) {
    if (record.record === null) return null;
    const text = proseOf(record.record);
    if (text === '') return null;
    const message = record.record['message'];
    const content = typeof message === 'object' && message !== null
      ? (message as { content?: unknown }).content
      : undefined;
    return { kind: classifyTurn(record.record['type'], content), text };
  }
  return null;
}

/**
 * **The pass reads back what it wrote, and takes back what it no longer
 * recognises.** A WRITE, and the only one in this command that DELETES.
 *
 * ── WHY A PASS THAT ONLY ADDS IS NOT ENOUGH ────────────────────────────────
 *
 * Marking is idempotent by construction, which made it safe to run every
 * rebuild and made it incapable of carrying out a trim: when the owner
 * withdrew the report grammar on 2026-09-11 its 101 anchors would have stood
 * in his index for ever, and the 25 table anchors labelled `|` would have kept
 * that label, because `ANCHOR_PROBE_LIMIT` stops at 200 candidates a probe and
 * his archive holds 297 tables. So the pass owns its own anchors: each is read
 * back AT ITS OWN BYTE — which no probe bound can hide — and put to the
 * grammar as it stands today.
 *
 * ── AND IT NEVER TOUCHES ONE HE MADE ───────────────────────────────────────
 *
 * `origin` is the whole distinction between the two halves of §7, and here it
 * is load-bearing rather than descriptive: an automatic pass that deleted a
 * hand-made bookmark would be a far worse defect than any it could fix. An
 * anchor whose row says `origin: 'owner'` is not read, not re-labelled and not
 * dropped, whatever the grammar would say about the turn under it.
 *
 * ── SILENCE IS NOT EVIDENCE ────────────────────────────────────────────────
 *
 * A transcript the harness pruned, or an offset that reads as nothing, leaves
 * its anchor exactly where it is. Those are the two states `resolveAnchor`
 * already keeps distinct, and neither is the grammar saying no — deleting on
 * them would turn a missing file into lost bookmarks.
 */
function sweepAutomaticAnchors(
  index: ConversationIndex,
  files: Map<string, string | null>,
  keep: Set<string>,
  report: AutoAnchorReport,
): void {
  for (const row of index.anchorRows(null)) {
    if (row.origin !== 'automatic') continue;
    if (keep.has(row.id)) continue;

    const key = row.agentId ?? row.sessionId;
    if (!files.has(key)) files.set(key, fileOf(index, row.sessionId, row.agentId));
    const file = files.get(key) ?? null;
    if (file === null) continue;

    const turn = turnAt(file, row.byteOffset);
    if (turn === null) continue;

    const finding = anchorInTurn(turn.kind, turn.text);
    if (finding === null) {
      unmarkAnchor(index, row.id);
      report.dropped += 1;
      continue;
    }
    if (finding.kind === row.kind && finding.label === row.label) continue;
    // The timestamp is the anchor's own and is carried over: re-deriving a
    // label is not a new bookmark, and moving the stamp would reorder his list
    // every time a grammar changed.
    markAnchor(index, {
      sessionId: row.sessionId,
      agentId: row.agentId,
      byteOffset: row.byteOffset,
      label: finding.label,
      kind: finding.kind,
      origin: 'automatic',
      at: row.at,
    });
    report.relabelled += 1;
  }
}

/**
 * **Mark what is an anchor by nature, without being asked.** A WRITE.
 *
 * Idempotent by construction rather than by remembering: `anchorIdFor` derives
 * the id from the POSITION, so a point already marked is the same row again.
 * That is what makes this safe to run on every rebuild, which is what the
 * owner's ruling asks for — and it is why `markAnchor` is called even for an
 * anchor that already stands, rather than this pass keeping its own notion of
 * what it did last time. A second notion is a second thing to be wrong.
 *
 * **It never overwrites one HE made.** An anchor whose row says `origin:
 * 'owner'` is left exactly as it is, label and all: the automatic half is
 * allowed to add bookmarks and is not allowed to rewrite his.
 */
export function markAutomaticAnchors(index: ConversationIndex): AutoAnchorReport {
  const startedMs = Date.now();
  const report: AutoAnchorReport = {
    probed: 0, found: 0, marked: 0, dropped: 0, relabelled: 0, capped: false, ms: 0,
  };
  // The WHOLE row and not just its origin: `relabelled` is a count of anchors
  // whose label actually moved, and the probe pass re-marks every candidate it
  // recognises — so a counter that only watched the sweep would report 56 of a
  // run that changed 345 labels, which reads as a total and is not one.
  const mine = new Map(index.anchorRows(null).map((row) => [row.id, row]));
  const seen = new Set<string>();
  const kept = new Set<string>();
  const files = new Map<string, string | null>();

  // `anchorTransaction` and not `index.transaction`: this pass writes hundreds
  // of anchors in one go — 345 relabelled in the last run — and the anchors
  // DOCUMENT is the truth the table is rebuilt from (`plan:recall seq:6`). One
  // transaction is one document write, at the end, and the reconciliation at
  // the start is what stops a pass that has been running for seconds from
  // erasing an anchor the owner marked at the terminal meanwhile.
  anchorTransaction(index, () => {
    for (const { probe, kind } of ANCHOR_PROBES) {
      const answer = searchArchive(index, probe, {
        ...(kind === undefined ? {} : { kind }),
        limit: ANCHOR_PROBE_LIMIT,
      });
      if (answer.hits.length >= ANCHOR_PROBE_LIMIT) report.capped = true;
      for (const hit of answer.hits) {
        const id = anchorIdFor(hit.sessionId, hit.agentId, hit.byteOffset);
        if (seen.has(id)) continue;
        seen.add(id);
        report.probed += 1;
        const standing = mine.get(id);
        if (standing?.origin === 'owner') continue;

        const key = hit.agentId ?? hit.sessionId;
        if (!files.has(key)) files.set(key, fileOf(index, hit.sessionId, hit.agentId));
        const file = files.get(key) ?? null;
        if (file === null) continue;

        const turn = turnAt(file, hit.byteOffset);
        if (turn === null) continue;

        const finding = anchorInTurn(turn.kind, turn.text);
        if (finding === null) continue;
        report.found += 1;
        if (standing === undefined) report.marked += 1;
        else if (standing.kind !== finding.kind || standing.label !== finding.label) {
          report.relabelled += 1;
        }
        kept.add(id);
        markAnchor(index, {
          sessionId: hit.sessionId,
          agentId: hit.agentId,
          byteOffset: hit.byteOffset,
          label: finding.label,
          kind: finding.kind,
          origin: 'automatic',
          at: hit.at ?? new Date().toISOString(),
        });
      }
    }

    // And the other direction, over what the pass already owns. `kept` is the
    // ids it just re-derived, which are the only ones it need not read again.
    sweepAutomaticAnchors(index, files, kept, report);
  });

  report.ms = Date.now() - startedMs;
  return report;
}

/** What `rebuild` says about the two passes it now runs after the scan. */
function searchLines(search: SearchBuildReport, auto: AutoAnchorReport): string[] {
  const lines = [
    `my_context: the archive's words are searchable — ${search.spans} passage(s) from ` +
    `${search.sources} transcript(s) (${search.indexed} read whole, ${search.appended} ` +
    `appended, ${search.skipped} unchanged), in ${search.ms} ms.`,
  ];
  if (search.removed > 0) {
    lines.push(
      `my_context: ${search.removed} transcript(s) left the archive, and their words left ` +
      'with them.',
    );
  }
  lines.push(
    `my_context: ${auto.marked} new anchor(s) were marked for you and ${auto.found - auto.marked} ` +
    'were already marked — a table or a ruling you gave. ' +
    '`mycontext conversation anchor` lists them and `--drop <id>` takes one back.',
  );
  // **THE DELETION IS SAID OUT LOUD**, `INV-nothing-is-dropped-silently` in the
  // direction that matters here. A pass that quietly removes bookmarks is
  // worse than one that keeps too many, so the count is reported and the
  // sentence says whose anchors can and cannot be in it.
  if (auto.dropped > 0) {
    lines.push(
      `my_context: ${auto.dropped} anchor(s) marked for you by an earlier build are no longer ` +
      'recognised and were taken back. Nothing you marked yourself was touched.',
    );
  }
  if (auto.relabelled > 0) {
    lines.push(
      `my_context: ${auto.relabelled} anchor(s) marked for you were given a clearer label.`,
    );
  }
  if (auto.capped) {
    lines.push(
      'my_context: at least one of the automatic passes reached its bound of ' +
      `${ANCHOR_PROBE_LIMIT} candidates, so there may be more in the archive that were not ` +
      'looked at. Nothing was lost; it was not reached.',
    );
  }
  return lines;
}

/**
 * `mycontext conversation anchor` — **the half he does himself.**
 *
 *     mycontext conversation anchor                      every anchor
 *     mycontext conversation anchor <session>            one session's
 *     mycontext conversation anchor --find <term>        by label
 *     mycontext conversation anchor <session> <byte> --label "..."   mark one
 *     mycontext conversation anchor --drop <id>          take one back
 *
 * **The position is a BYTE offset and the command says so when it is wrong**,
 * because a character offset lands inside a record rather than at the start of
 * one and reads as unreadable instead of throwing — on a corpus that is Hebrew
 * from record 5, that is the failure worth refusing loudly.
 *
 * The viewer composes this line with the offset already in it
 * (`read-model-conversations.ts`' `anchorCommand`), which is how the browser
 * marks an anchor without the read-only server performing a write.
 */
function cmdConversationAnchor(ws: Workspace, args: string[], out: Emit): number {
  const json = wantsJson(args);
  const rest = positionals(args, ['label', 'agent', 'find', 'drop']).slice(1);
  const label = flag(args, 'label');
  const agentId = flag(args, 'agent');
  const find = flag(args, 'find');
  const drop = flag(args, 'drop');

  // **THE OPT-IN GATE, and this branch wants to skip it exactly as `name` and
  // `persist --off` did.** `ConversationIndex.open` is the only thing that
  // creates these tables, so marking a point in a workspace nobody has ever
  // scanned would CREATE them — and the end-of-turn refresh, which gates on
  // their existence, would start reading that machine's transcripts. Marking
  // a bookmark is not a way to turn the archive on, and LISTING one is even
  // less of a way, which is why this gate is before the read branch too.
  if (!indexExists(ws, out)) return 1;

  const index = ConversationIndex.open(ws.dbPath);
  try {
    // Before the read branch as well as the write one: the anchors document is
    // the truth (`plan:recall seq:6`), so a LIST run against an index that has
    // been deleted since the last turn must show the bookmarks rather than an
    // empty table with nothing said about it.
    reconcileAnchors(index);
    if (drop !== null) {
      const gone = unmarkAnchor(index, drop);
      if (json) {
        emitJson(out, { dropped: gone, id: drop });
        return 0;
      }
      out(gone
        ? `my_context: took back the anchor at ${drop}.`
        : `my_context: no anchor is at ${drop}, so there was nothing to take back. ` +
          '`mycontext conversation anchor` lists what is marked.');
      return 0;
    }

    const [session, offset] = rest;
    if (offset !== undefined) {
      // Unreachable through the parser — a second positional implies a first —
      // and a REFUSAL rather than a silent 0 all the same, because the one
      // thing worse than a command that cannot run is one that reports success
      // for having done nothing.
      if (session === undefined) {
        out(`my_context: a byte offset needs the session it is in. ${USAGE}`);
        return 1;
      }
      if (!/^\d+$/.test(offset)) {
        out(
          `my_context: "${offset}" is not a byte offset. An anchor's position is counted in ` +
          'BYTES from the start of the transcript, written in digits — never in characters, ' +
          'because this archive is half Hebrew and a character count lands inside a record ' +
          'rather than at the start of one.',
        );
        return 1;
      }
      if (label === null || label.trim() === '') {
        out(
          'my_context: an anchor needs `--label "<why you kept it>"`. A bookmark that says ' +
          'nothing about why it was kept is one you will not recognise when you come back.',
        );
        return 1;
      }
      const file = fileOf(index, session, agentId);
      if (file === null) {
        out(
          `my_context: the archive holds no transcript for "${session}"` +
          `${agentId === null ? '' : ` / "${agentId}"`}. ` +
          'Run `mycontext conversation rebuild`, or check the id with `mycontext ' +
          'conversation list`.',
        );
        return 1;
      }
      const row = markAnchor(index, {
        sessionId: session,
        agentId,
        byteOffset: Number(offset),
        label: label.trim(),
      });
      const resolved = resolveAnchor(index, row.id);
      if (json) {
        emitJson(out, { ...row, reads: resolved?.text ?? null });
        return 0;
      }
      out(`my_context: marked ${row.id} — ${row.label}`);
      // **What the offset actually lands on, read back before he walks away.**
      // A record of `null` is what a character offset produces, and reporting
      // it here is the difference between a bookmark that is wrong now and one
      // that is found to be wrong in a month.
      out(resolved?.record === null
        ? 'my_context: nothing starts at that byte, so this anchor reads as unreadable. That ' +
          'is what a CHARACTER offset produces on this archive. The mark is kept — take it ' +
          `back with \`mycontext conversation anchor --drop ${row.id}\`.`
        : `my_context: it reads: ${firstLine(resolved?.text ?? '')}`);
      return 0;
    }

    const rows = find !== null
      ? searchAnchors(index, find)
      : (session === undefined ? allAnchors(index) : anchorsFor(index, session));
    if (json) {
      emitJson(out, { anchors: rows });
      return 0;
    }
    if (rows.length === 0) {
      out(find !== null
        ? `my_context: no anchor's label contains "${find}". That is about the labels and not ` +
          'about the archive — `mycontext conversation search` is the other question.'
        : 'my_context: nothing is marked here yet. A table and a ruling you gave are ' +
          'marked for you by `mycontext conversation rebuild`; anything else you mark ' +
          'yourself, from the Conversations screen or with `mycontext conversation anchor ' +
          '<session> <byte> --label "<why>"`.');
      return 0;
    }
    const drawn = table(
      ['id', 'kind', 'set', 'marked', 'label'],
      rows.map((row) => [
        row.id,
        row.kind,
        row.origin,
        zonedStamp(row.at) ?? row.at,
        row.label,
      ]),
    );
    for (const line of drawn) out(line);
    out(`my_context: showing all ${rows.length}.`);
    return 0;
  } finally {
    index.close();
  }
}

/** The first line of a record's words, bounded — a label, not a transcript. */
function firstLine(text: string): string {
  const line = text.split('\n').find((one) => one.trim() !== '') ?? '';
  return line.length > 120 ? `${line.slice(0, 120)}…` : line;
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
    if (subcommand === 'secrets') return cmdConversationSecrets(ws, root, args, out);
    if (subcommand === 'persist') return cmdConversationPersist(ws, root, args, out);
    if (subcommand === 'name') return cmdConversationName(ws, root, args, out);
    if (subcommand === 'anchor') return cmdConversationAnchor(ws, args, out);
    if (subcommand === 'forget') return cmdConversationForget(ws, root, args, out);
    return cmdConversationList(ws, root, args, out);
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }
}

registerCommand({
  name: 'conversation',
  usage:
    `conversation [${SUBCOMMANDS.join('|')}] [--full] [--limit <n>] [--replace <ids>] ` +
    '[--clear] [--yes] [--json]',
  summary: 'index the conversation and subagent transcripts on disk, and list what it holds',
  run: (ws, args, out) => cmdConversation(ws, args, out),
});

export { cmdConversation };
