import { computeDecay, type DecayRow } from '../../core/decay.ts';
import { Ledger } from '../../core/ledger.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext } from './context.ts';
import { flag, hasFlag, registerCommand, type Emit } from './registry.ts';

const DEFAULT_WINDOW = 20;

/**
 * Pads `s` to `width`, but never truncates or collides it into the next
 * column: a real id longer than `width` (this repo has several, e.g.
 * `INV-a-validator-that-gates-writes-must-be-a-complete...`) still gets its
 * own two-space gap instead of running straight into the next field.
 */
function col(s: string, width: number): string {
  return s.length >= width ? `${s}  ` : s.padEnd(width);
}

function line(row: DecayRow): string {
  const used = row.lastUsed === null
    ? 'never injected'
    : `${row.useCount}x, last ${row.lastUsed.slice(0, 10)}`;
  return `${col(row.id, 44)}${col(row.type, 14)}${col(used, 24)}${row.title}`;
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
  // `Ledger.open` runs INSIDE this try, not before it: `openMutateContext`
  // above already opened `ctx.store`, and a throw from `Ledger.open` (e.g. a
  // directory where the db file should be) must still reach `ctx.store.close()`
  // in the `finally` below rather than leaking that handle. `ledger` starts
  // `undefined` so the `finally` can tell "never opened" from "opened, needs
  // closing" without a second boolean.
  let ledger: Ledger | undefined;
  try {
    ledger = Ledger.open(ws.dbPath);
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

    // Unconditional, not gated on `sessionsRecorded < window`: a mature
    // ledger is exactly when a reader is most likely to trust "cold" at face
    // value, and gating the hedge on ledger immaturity hid it at the one
    // moment it mattered most. The ledger only ever knows injection, never
    // use — a scoped item read yesterday via `show`, MCP `get_item`, or a
    // human opening the Markdown directly leaves no row here and reads as
    // "cold" exactly like an item nobody has touched in a year; a brand-new
    // item looks identical to an abandoned one for the same reason. None of
    // that is a reason to delete anything below on this report's say-so
    // alone.
    out(
      '  "cold" means: not auto-injected in the last window of sessions. It does ' +
      'NOT mean unused — the ledger records injection, not reading or reliance, ' +
      'so a new item, and any item consulted via `show`, MCP `get_item`, or the ' +
      'Markdown file directly, look exactly like an abandoned one here.',
    );
    out('  Do not supersede or deprecate anything below on this list alone — verify real usage first.');
    if (report.sessionsRecorded < report.window) {
      out(`  (only ${report.sessionsRecorded} session(s) recorded so far, so "cold" mostly means "new")`);
    }

    out('');
    if (report.cold.length === 0) {
      // Two different truths collapse to this branch: "every scoped item was
      // injected in the window" (real signal) and "there were no scoped
      // items to begin with" (nothing was measured at all, e.g. an empty
      // ledger with only unscoped items above). Naming both, rather than
      // asserting the first as if it always holds, is what stops this line
      // from claiming activity that never happened.
      out(report.warm.length > 0
        ? 'cold: none — every scoped item was injected inside the window.'
        : 'cold: none — no scoped, normative item exists yet to measure.');
    } else {
      out(`cold (${report.cold.length}) — not auto-injected in the window; check before acting:`);
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
    ledger?.close();
    ctx.store.close();
  }
}

registerCommand({
  name: 'decay',
  usage: 'decay [--sessions N] [--all]',
  summary: 'items that have not been injected lately',
  run: cmdDecay,
});
