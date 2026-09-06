import {
  ConversationIndex, ConversationIndexUninitializedError, MAX_SCAN_BYTES,
  rebuildConversations, transcriptDir, truncatedScan, type ConversationRow,
} from '../../core/conversation-index.ts';
import { SUBCOMMAND_FLAGS } from '../../core/command-flags.ts';
import type { Workspace } from '../../core/workspace.ts';
import { toCliMessage } from './context.ts';
import { emitJson, refuseUnknownFlag, table, wantsJson } from './format.ts';
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

export const SUBCOMMANDS = ['rebuild', 'list'] as const;

const USAGE = `usage: mycontext conversation rebuild [--full] [--json]
       mycontext conversation list [--limit <n>] [--json]`;

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
    if (err instanceof ConversationIndexUninitializedError) {
      // The empty state, named as itself. Not an error, and not silence.
      const dir = transcriptDir(process.env, workspaceCwd(root));
      if (wantsJson(args)) {
        emitJson(out, { conversations: [], total: 0, indexed: false, dir });
        return 0;
      }
      out('my_context: no conversation index in this workspace yet — nothing has been scanned.');
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
        row.endedAt ?? '—',
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
    return cmdConversationList(ws, root, args, out);
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }
}

registerCommand({
  name: 'conversation',
  usage: `conversation [${SUBCOMMANDS.join('|')}] [--full] [--limit <n>] [--json]`,
  summary: 'index the conversation transcripts on disk, and list what the index holds',
  run: (ws, args, out) => cmdConversation(ws, args, out),
});

export { cmdConversation };
