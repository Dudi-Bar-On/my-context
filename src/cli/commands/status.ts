import path from 'node:path';
import { computeDecay } from '../../core/decay.ts';
import { Ledger, type Usage } from '../../core/ledger.ts';
import type { MutationContext } from '../../core/mutate.ts';
import type { Item } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { runChecks } from '../../doctor/checks.ts';
import { listSessions, pendingAnchors } from '../../ingest/session.ts';
import { listStaging } from '../../lesson/derive.ts';
import { col } from './decay.ts';
import { summarize } from './doctor.ts';
import { drafts } from './review.ts';
import { emitLoadErrors, openMutateContext } from './context.ts';
import { registerCommand, type Emit } from './registry.ts';

const DECAY_WINDOW = 20;

function tally(items: Item[], key: (i: Item) => string): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return [...counts].sort((a, b) => a[0].localeCompare(b[0]));
}

/**
 * The review queue, exactly as `mycontext review` itself defines it —
 * project-layer drafts only. Delegates to `drafts` (review.ts) instead of
 * re-deriving the filter: a merged project+global corpus otherwise makes
 * `status` count a global-layer draft that `review` deliberately excludes
 * (its own comment calls listing one there "its own silent-wrongness trap" —
 * a global draft can never be promoted or discarded from this project), so
 * the two commands would disagree about the very queue `status` points the
 * user at. Exported so its correctness can be pinned directly with
 * `sandbox()` in tests, without writing under the real `~/.my-context`.
 */
export function reviewQueueDrafts(ctx: MutationContext): Item[] {
  return drafts(ctx, null);
}

interface LedgerView {
  usage: Usage[];
  recentlyUsed: string[];
  sessionsRecorded: number;
}

/** A report must never crash on a ledger Plan 2 has not populated yet. */
function readLedger(dbPath: string): LedgerView {
  let ledger: Ledger | null = null;
  try {
    ledger = Ledger.open(dbPath);
    const recent = ledger.recentSessions(DECAY_WINDOW);
    return {
      usage: ledger.allUsage(),
      recentlyUsed: ledger.itemsUsedIn(recent),
      sessionsRecorded: ledger.sessionCount(),
    };
  } catch {
    return { usage: [], recentlyUsed: [], sessionsRecorded: 0 };
  } finally {
    try { ledger?.close(); } catch { /* nothing to close */ }
  }
}

function cmdStatus(ws: Workspace, _args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  const { ctx, errors } = openMutateContext(ws);
  let items: Item[];
  let queueCount: number;
  try {
    items = ctx.store.all();
    queueCount = reviewQueueDrafts(ctx).length;
  } catch (err) {
    ctx.store.close();
    out(err instanceof Error ? err.message : String(err));
    return 1;
  }

  // Close the writable connection now, BEFORE `runChecks`' own
  // `checkIndexFreshness` (which stats `ws.dbPath`'s mtime) and before the
  // ledger read below re-opens the same file. SQLite (WAL mode) only
  // checkpoints its write-ahead log back into the main database file on
  // close, so on the very first `status` run after an item was edited
  // on disk, checking the file's mtime through a connection that is STILL
  // OPEN sees only the last checkpoint — before this invocation's own
  // rebuild — and wrongly reports the index as stale, a staleness that
  // running `doctor` immediately after (as the health line's own text
  // suggests) will not reproduce, because doctor's second, fresh open sees
  // the checkpoint this close performs. Same ordering `cmdQuery` already
  // relies on (see its comment on why closing the writer first matters).
  ctx.store.close();

  try {
    out(`my_context: ${items.length} item(s), profile "${ws.config.profile}"`);
    out('');
    out('by category');
    for (const [type, n] of tally(items, (i) => i.type)) out(`  ${type.padEnd(16)}${n}`);
    out('');
    out('by status');
    for (const [status, n] of tally(items, (i) => i.status)) out(`  ${status.padEnd(16)}${n}`);
    out('');
    out('by origin');
    for (const [origin, n] of tally(items, (i) => i.origin)) out(`  ${origin.padEnd(16)}${n}`);

    out('');
    out(`review queue: ${queueCount} draft(s) pending review — walk it with \`mycontext review\`.`);

    const sessions = listSessions(ws.projectRoot).filter((s) => pendingAnchors(s).length > 0);
    if (sessions.length) {
      out('');
      out(`ingest: ${sessions.length} unfinished session(s) — continue with \`mycontext ingest <path>\`.`);
      for (const session of sessions) {
        const done = session.chunks.length - pendingAnchors(session).length;
        out(`  ${col(session.sourceFile, 40)}${done}/${session.chunks.length} chunk(s) applied   ${session.id}`);
      }
    }

    const pendingRules = listStaging(ws.projectRoot)
      .flatMap((s) => s.candidates.filter((c) => c.state === 'pending').map((c) => ({ lesson: s.lessonId, candidate: c })));
    if (pendingRules.length) {
      out('');
      out(
        `${pendingRules.length} rule candidate(s) awaiting approval. ` +
        `Nothing generated is active until you accept it — \`mycontext lesson-accept <lesson> <key>\`.`,
      );
      for (const entry of pendingRules) {
        out(`  ${entry.candidate.key}  ${col(entry.lesson, 44)}${entry.candidate.candidate.title}`);
      }
    }

    // The ledger records INJECTION, not USE — a new item that has simply
    // never come up in the last DECAY_WINDOW sessions looks identical here
    // to one an engineer actively read and decided not to act on. "cold"
    // below is deliberately not phrased as a superseding recommendation; see
    // `mycontext decay` for the full report and its own hedging language.
    const ledger = readLedger(ws.dbPath);
    const decay = computeDecay({
      items, config: ws.config,
      usage: ledger.usage,
      recentlyUsed: ledger.recentlyUsed,
      window: DECAY_WINDOW,
      sessionsRecorded: ledger.sessionsRecorded,
    });

    out('');
    out(
      ledger.sessionsRecorded === 0
        ? 'usage: no sessions recorded yet — decay reporting starts once items begin to be injected.'
        : `usage: ${ledger.sessionsRecorded} session(s) recorded. ` +
          `${decay.cold.length} normative item(s) not injected in the last ${DECAY_WINDOW} session(s) ` +
          `— not evidence they are unused, only that they were not selected. See \`mycontext decay\`.`,
    );
    // Same hedge `mycontext decay` itself prints, and for the same reason:
    // "the last 20 sessions" means nothing on a ledger that has only
    // recorded a handful — a brand-new item is indistinguishable from an
    // abandoned one until the window has actually filled up.
    if (ledger.sessionsRecorded > 0 && ledger.sessionsRecorded < DECAY_WINDOW) {
      out(`  (only ${ledger.sessionsRecorded} session(s) recorded so far, so "cold" mostly means "new")`);
    }
    if (decay.unscoped.length) {
      out(`  ${decay.unscoped.length} active normative item(s) carry no scope and are never auto-injected.`);
    }

    const findings = runChecks({
      root: ws.projectRoot,
      repoRoot: path.dirname(ws.projectRoot),
      dbPath: ws.dbPath,
      items,
    });
    const counts = summarize(findings);
    out('');
    out(
      `health: ${counts.errors} error(s), ${counts.warnings} warning(s), ${counts.infos} note(s) — ` +
      `details from \`mycontext doctor\`.`,
    );
    // Explicit design decision, not an oversight: `status`'s own exit code
    // reflects corpus LOAD errors only (the F2 rule — see `emitLoadErrors`
    // below), never these doctor-level findings, even an `error`-level one.
    // `doctor` itself DOES fail its exit code on an error-level finding
    // (see `exitCode` in doctor.ts); `status` deliberately does not, because
    // its exit-code contract is pinned to Plan 1's original corrupt-item
    // case and is one of only two commands allowed to fail CI on it at all
    // (see f2-registry.test.ts's `ALLOWED_NONZERO`) — widening that contract
    // to "any doctor-level error" would be a silent, untested change to
    // what a CI pipeline calling `status` can rely on. Surfaced on screen
    // instead, so the gap between the number shown and the exit code
    // returned is never a surprise: a nonzero doctor-level error count here
    // will NOT fail this command, or a CI job gating on it — run
    // `mycontext doctor` directly for that.
    if (counts.errors > 0) {
      out(
        `  note: status's own exit code does not reflect the ${counts.errors} error(s) above — only ` +
        `an unrelated corpus load error fails this command. Run \`mycontext doctor\` if you need a ` +
        `command that fails on them.`,
      );
    }

    // Every count above was computed over a corpus that is missing whatever
    // could not be read. Plan 1's `status surfaces a rebuild error for a
    // corrupt item and exits non-zero` is what this satisfies, unchanged.
    emitLoadErrors(errors, out);
    return errors.length ? 1 : 0;
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

registerCommand({
  name: 'status',
  usage: 'status',
  summary: 'counts, review queue, ingest progress, decay and health',
  run: cmdStatus,
});
