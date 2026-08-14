import path from 'node:path';
import { computeDecay } from '../../core/decay.ts';
import { Ledger, type Usage } from '../../core/ledger.ts';
import type { MutationContext } from '../../core/mutate.ts';
import type { Item } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { runChecks } from '../../doctor/checks.ts';
import { listSessions, pendingAnchors } from '../../ingest/session.ts';
import { listStaging } from '../../lesson/derive.ts';
import { summarize } from './doctor.ts';
import { drafts } from './review.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './context.ts';
import { DETAIL_USAGE, detailLevel, emitJson, table, wantsJson, type Detail } from './format.ts';
import { registerCommand, type Emit } from './registry.ts';

const DECAY_WINDOW = 20;

/**
 * The one sentence `--json` must carry alongside the cold count, for the same
 * reason the text report carries it: the ledger records INJECTION, not USE, so
 * a consumer ranking items by "cold" is reading a number that cannot tell a
 * brand-new item from an abandoned one. See `mycontext decay` for the full
 * report and its own hedging language.
 */
const USAGE_CAVEAT =
  'cold means not auto-injected in the window — the ledger records injection, not reading or ' +
  'reliance, so a new item and an item read via `show` or `get_item` look identical here.';

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

function cmdStatus(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  let detail: Detail;
  let json: boolean;
  try {
    detail = detailLevel(args);
    json = wantsJson(args);
  } catch (err) {
    out(toCliMessage(err));
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
    const sessions = listSessions(ws.projectRoot).filter((s) => pendingAnchors(s).length > 0);
    const pendingRules = listStaging(ws.projectRoot)
      .flatMap((s) => s.candidates.filter((c) => c.state === 'pending').map((c) => ({ lesson: s.lessonId, candidate: c })));

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

    const findings = runChecks({
      root: ws.projectRoot,
      repoRoot: path.dirname(ws.projectRoot),
      dbPath: ws.dbPath,
      items,
    });
    const counts = summarize(findings);

    if (json) {
      // Load errors are a FIELD of the document, not a trailing text line:
      // `--json` exists to be piped, and per F2/INV-nothing-is-dropped-
      // silently they must still be reported — carrying them inside the
      // document does both, where `query --json`'s trailing line does the
      // second at the cost of the first. `errors.length ? 1 : 0` below is
      // unchanged, so a script may also just read the exit code.
      emitJson(out, {
        profile: ws.config.profile,
        items: {
          total: items.length,
          byCategory: Object.fromEntries(tally(items, (i) => i.type)),
          byStatus: Object.fromEntries(tally(items, (i) => i.status)),
          byOrigin: Object.fromEntries(tally(items, (i) => i.origin)),
        },
        reviewQueue: { drafts: queueCount },
        // Hierarchical, and this is the surface where it survives: a session
        // holds per-anchor progress that no flat column can carry.
        ingest: sessions.map((s) => ({
          id: s.id,
          sourceFile: s.sourceFile,
          chunks: s.chunks.length,
          applied: s.chunks.length - pendingAnchors(s).length,
          pendingAnchors: pendingAnchors(s),
        })),
        stagedRules: pendingRules.map((e) => ({
          lesson: e.lesson, key: e.candidate.key, title: e.candidate.candidate.title,
        })),
        usage: {
          sessionsRecorded: ledger.sessionsRecorded,
          window: DECAY_WINDOW,
          cold: decay.cold.length,
          unscoped: decay.unscoped.length,
          caveat: USAGE_CAVEAT,
        },
        health: counts,
        loadErrors: errors.map((e) => ({ file: e.file, message: e.message })),
      });
      return errors.length ? 1 : 0;
    }

    out(`my_context: ${items.length} item(s), profile "${ws.config.profile}"`);

    if (detail !== 'summary') {
      for (const [heading, key] of [
        ['by category', (i: Item) => i.type],
        ['by status', (i: Item) => i.status],
        ['by origin', (i: Item) => i.origin],
      ] as const) {
        out('');
        out(heading);
        for (const row of table(
          [heading.replace('by ', ''), 'items'],
          tally(items, key).map(([name, n]) => [name, String(n)]),
        )) out(`  ${row}`);
      }
    }

    out('');
    out(`review queue: ${queueCount} draft(s) pending review — walk it with \`mycontext review\`.`);

    if (sessions.length) {
      out('');
      out(`ingest: ${sessions.length} unfinished session(s) — continue with \`mycontext ingest <path>\`.`);
      if (detail !== 'summary') {
        for (const row of table(
          ['source', 'applied', 'session'],
          sessions.map((s) => [
            s.sourceFile, `${s.chunks.length - pendingAnchors(s).length}/${s.chunks.length}`, s.id,
          ]),
        )) out(`  ${row}`);
        // Per-anchor detail is a level below the row it belongs to; only
        // `--full` (or `--json`) shows it, because a flat table cannot.
        if (detail === 'full') {
          for (const session of sessions) {
            out(`  ${session.id} pending: ${pendingAnchors(session).join(', ')}`);
          }
        }
      }
    }

    if (pendingRules.length) {
      out('');
      out(
        `${pendingRules.length} rule candidate(s) awaiting approval. ` +
        `Nothing generated is active until you accept it — \`mycontext lesson-accept <lesson> <key>\`.`,
      );
      if (detail !== 'summary') {
        for (const row of table(
          ['key', 'lesson', 'title'],
          pendingRules.map((e) => [e.candidate.key, e.lesson, e.candidate.candidate.title]),
        )) out(`  ${row}`);
      }
    }

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
    // abandoned one until the window has actually filled up. Printed at every
    // detail level, `--summary` included: a shorter report may drop rows,
    // never the reason its own headline number might mislead.
    if (ledger.sessionsRecorded > 0 && ledger.sessionsRecorded < DECAY_WINDOW) {
      out(`  (only ${ledger.sessionsRecorded} session(s) recorded so far, so "cold" mostly means "new")`);
    }
    if (decay.unscoped.length) {
      out(`  ${decay.unscoped.length} active normative item(s) carry no scope and are never auto-injected.`);
    }
    // Rows only when the ledger has something to say. Found by running this
    // against this repo's own corpus: with an EMPTY ledger, `--full` printed
    // "no sessions recorded yet" and then 25 rows of "cold id" directly
    // underneath — every scoped item, listed as if it had decayed, one line
    // after the report said it had measured nothing. That is Task 13's defect
    // (a list that reads as a recommendation the data cannot support) and
    // Task 15's (a number asserted over a ledger that does not hold it), in
    // the section that was supposed to have learned from both.
    if (detail === 'full' && decay.cold.length) {
      out('');
      if (ledger.sessionsRecorded === 0) {
        out(
          // "injectable", not "scoped": the cold list holds every item that
          // CAN reach a session, which is the scoped ones AND the pinned ones
          // (`always: true` with no scope) — 7 of this repo's 25. Calling them
          // all "scoped" is the same category error as rendering a pinned
          // item's scope as `(none)`.
          `  ${decay.cold.length} injectable item(s) (scoped or pinned) have never been injected — ` +
          `with no sessions recorded, that means "not measured yet", not "unused". Nothing to act on.`,
        );
      } else {
        out(`  cold — not auto-injected in the last ${DECAY_WINDOW} session(s); verify real use before acting:`);
        for (const row of table(
          ['id', 'type', 'title'],
          decay.cold.map((r) => [r.id, r.type, r.title]),
        )) out(`  ${row}`);
      }
    }

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
  usage: `status ${DETAIL_USAGE}`,
  summary: 'counts, review queue, ingest progress, decay and health',
  run: cmdStatus,
});
