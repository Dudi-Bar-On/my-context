import { computeDecay, type DecayRow } from '../../core/decay.ts';
import { Ledger } from '../../core/ledger.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext } from './context.ts';
import { flag, hasFlag, registerCommand, type Emit } from './registry.ts';

const DEFAULT_WINDOW = 20;

function line(row: DecayRow): string {
  const used = row.lastUsed === null
    ? 'never injected'
    : `${row.useCount}x, last ${row.lastUsed.slice(0, 10)}`;
  return `${row.id.padEnd(44)}${row.type.padEnd(14)}${used.padEnd(24)}${row.title}`;
}

function cmdDecay(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  const rawWindow = flag(args, 'sessions');
  let window = DEFAULT_WINDOW;
  if (rawWindow !== null) {
    const parsed = Number(rawWindow);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      out(`my_context: --sessions must be a positive whole number. You passed "${rawWindow}".`);
      return 1;
    }
    window = parsed;
  }

  const { ctx, errors } = openMutateContext(ws);
  const ledger = Ledger.open(ws.dbPath);
  try {
    const recentSessions = ledger.recentSessions(window);
    const report = computeDecay({
      items: ctx.store.all(),
      config: ws.config,
      usage: ledger.allUsage(),
      recentlyUsed: ledger.itemsUsedIn(recentSessions),
      window,
      sessionsRecorded: ledger.sessionCount(),
    });

    if (report.cold.length === 0 && report.unscoped.length === 0 && report.warm.length === 0) {
      out('my_context: nothing to report — no active normative items in this project yet.');
      // F2 (context.ts's doc comment on openMutateContext): decay did what it
      // was asked — reported the (empty) report — so an unrelated corpus load
      // error is a warning, not a failure. Only `status`/`doctor` exit
      // non-zero on one; every other command that did its job exits 0.
      emitLoadErrors(errors, out);
      return 0;
    }

    out(
      `my_context decay — items not injected in the last ${report.window} session(s). ` +
      `The ledger holds ${report.sessionsRecorded} session(s).`,
    );

    if (report.sessionsRecorded < report.window) {
      out(`  (only ${report.sessionsRecorded} recorded, so "cold" mostly means "new")`);
    }

    out('');
    if (report.cold.length === 0) {
      out('cold: none — every scoped item activated inside the window.');
    } else {
      out(`cold (${report.cold.length}) — candidates for supersession or re-scoping:`);
      for (const row of report.cold) out(`  ${line(row)}`);
    }

    if (report.unscoped.length) {
      out('');
      out(
        `unscoped (${report.unscoped.length}) — active and normative but carrying no scope, ` +
        `so they are never auto-injected. Not decay: add a scope glob or set always: true.`,
      );
      for (const row of report.unscoped) out(`  ${line(row)}`);
    }

    if (hasFlag(args, 'all') && report.warm.length) {
      out('');
      out(`warm (${report.warm.length}) — injected inside the window:`);
      for (const row of report.warm) out(`  ${line(row)}`);
    }

    // A dropped item file means the "cold" list is missing rows, which is the
    // one thing a decay report must not be silent about — but per F2, decay
    // still did its job, so an unrelated load error is a warning, not a
    // failure. Only `status`/`doctor` exit non-zero on one.
    emitLoadErrors(errors, out);
    return 0;
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  } finally {
    ledger.close();
    ctx.store.close();
  }
}

registerCommand({
  name: 'decay',
  usage: 'decay [--sessions N] [--all]',
  summary: 'items that have not been injected lately',
  run: cmdDecay,
});
