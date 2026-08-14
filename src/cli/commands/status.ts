import path from 'node:path';
import { computeDecay } from '../../core/decay.ts';
import { Ledger, type Usage } from '../../core/ledger.ts';
import type { Item } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { runChecks } from '../../doctor/checks.ts';
import { listSessions, pendingAnchors } from '../../ingest/session.ts';
import { listStaging } from '../../lesson/derive.ts';
import { summarize } from './doctor.ts';
import { emitLoadErrors, openMutateContext } from './context.ts';
import { registerCommand, type Emit } from './registry.ts';

const DECAY_WINDOW = 20;

function tally(items: Item[], key: (i: Item) => string): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return [...counts].sort((a, b) => a[0].localeCompare(b[0]));
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
  try {
    const items = ctx.store.all();

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

    const drafts = items.filter((i) => i.status === 'draft');
    out('');
    out(`review queue: ${drafts.length} draft(s) pending review — walk it with \`mycontext review\`.`);

    const sessions = listSessions(ws.projectRoot).filter((s) => pendingAnchors(s).length > 0);
    if (sessions.length) {
      out('');
      out(`ingest: ${sessions.length} unfinished session(s) — continue with \`mycontext ingest <path>\`.`);
      for (const session of sessions) {
        const done = session.chunks.length - pendingAnchors(session).length;
        out(`  ${session.sourceFile.padEnd(40)}${done}/${session.chunks.length}   ${session.id}`);
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
        out(`  ${entry.candidate.key}  ${entry.lesson.padEnd(44)}${entry.candidate.candidate.title}`);
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

    // Every count above was computed over a corpus that is missing whatever
    // could not be read. Plan 1's `status surfaces a rebuild error for a
    // corrupt item and exits non-zero` is what this satisfies, unchanged.
    emitLoadErrors(errors, out);
    return errors.length ? 1 : 0;
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  } finally {
    ctx.store.close();
  }
}

registerCommand({
  name: 'status',
  usage: 'status',
  summary: 'counts, review queue, ingest progress, decay and health',
  run: cmdStatus,
});
