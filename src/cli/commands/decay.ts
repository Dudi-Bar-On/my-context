import { computeDecay, type DecayRow } from '../../core/decay.ts';
import { Ledger } from '../../core/ledger.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './context.ts';
import { DETAIL_USAGE, detailLevel, emitJson, table, wantsJson, type Detail } from './format.ts';
import { flag, hasFlag, registerCommand, type Emit } from './registry.ts';

const DEFAULT_WINDOW = 20;

/**
 * The hedge, spelled once and carried by BOTH surfaces — the text report and
 * `--json`. Unconditional, not gated on `sessionsRecorded < window`: a mature
 * ledger is exactly when a reader is most likely to trust "cold" at face
 * value, and gating the hedge on ledger immaturity hid it at the one moment it
 * mattered most. The ledger only ever knows injection, never use — a scoped
 * item read yesterday via `show`, MCP `get_item`, or a human opening the
 * Markdown directly leaves no row here and reads as "cold" exactly like an
 * item nobody has touched in a year; a brand-new item looks identical to an
 * abandoned one for the same reason. None of that is a reason to delete
 * anything this report lists on its say-so alone.
 */
const COLD_CAVEAT =
  '"cold" means: not auto-injected in the last window of sessions. It does ' +
  'NOT mean unused — the ledger records injection, not reading or reliance, ' +
  'so a new item, and any item consulted via `show`, MCP `get_item`, or the ' +
  'Markdown file directly, look exactly like an abandoned one here.';

const HEADERS = ['id', 'type', 'usage', 'title'];
const FULL_HEADERS = ['id', 'type', 'injections', 'last injected', 'scope', 'title'];

function usageCell(row: DecayRow): string {
  return row.lastUsed === null ? 'never injected' : `${row.useCount}x, last ${row.lastUsed.slice(0, 10)}`;
}

function cells(row: DecayRow, detail: Detail): string[] {
  return detail === 'full'
    ? [
      row.id, row.type, String(row.useCount),
      row.lastUsed === null ? 'never' : row.lastUsed.slice(0, 10),
      row.scope.length ? row.scope.join(' ') : '(none)',
      row.title,
    ]
    : [row.id, row.type, usageCell(row), row.title];
}

/** Two-space indent on every line, so a table sits inside its section. */
function indent(lines: string[]): string[] {
  return lines.map((l) => `  ${l}`);
}

function rows(list: DecayRow[], detail: Detail): string[] {
  return indent(table(detail === 'full' ? FULL_HEADERS : HEADERS, list.map((r) => cells(r, detail))));
}

function cmdDecay(ws: Workspace, args: string[], out: Emit): number {
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

    if (json) {
      // The machine surface carries every list, `warm` included, and carries
      // the caveat as data rather than as prose only a human reading the text
      // output would see: a script that ranks items by "cold" without it is
      // exactly the reader who most needs to know the ledger records
      // injection, not use.
      emitJson(out, {
        window: report.window,
        sessionsRecorded: report.sessionsRecorded,
        caveat: COLD_CAVEAT,
        counts: { cold: report.cold.length, unscoped: report.unscoped.length, warm: report.warm.length },
        cold: report.cold,
        unscoped: report.unscoped,
        warm: report.warm,
      });
      emitLoadErrors(errors, out);
      return 0;
    }

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
    out(`  ${COLD_CAVEAT}`);
    out('  Do not supersede or deprecate anything on this report alone — verify real usage first.');
    // Zero is not "a small number of sessions", it is NO measurement at all,
    // and "only 0 session(s) recorded so far, so cold mostly means new" reads
    // as a hedge on a real signal rather than as "there is no signal". Found
    // by running this against this repo's own corpus, where every one of 25
    // items is trivially cold.
    if (report.sessionsRecorded === 0) {
      out('  (no sessions recorded yet — nothing here has been measured; "cold" currently means only "never injected")');
    } else if (report.sessionsRecorded < report.window) {
      out(`  (only ${report.sessionsRecorded} session(s) recorded so far, so "cold" mostly means "new")`);
    }

    // `--summary` stops here: the counts and the caveat, no rows. The hedge
    // above is NOT part of what a detail level may drop — a shorter report
    // that keeps the recommendation and drops the reason it might be wrong is
    // the failure mode this report already had once.
    if (detail === 'summary') {
      out('');
      out(
        `cold ${report.cold.length}, unscoped ${report.unscoped.length}, warm ${report.warm.length}. ` +
        `Rows with \`mycontext decay\` (default) or \`--full\`.`,
      );
      emitLoadErrors(errors, out);
      return 0;
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
      for (const row of rows(report.cold, detail)) out(row);
    }

    if (report.unscoped.length) {
      out('');
      out(
        `unscoped (${report.unscoped.length}) — active and normative but carrying no scope, ` +
        `so they are never auto-injected. Not decay: add a scope glob or set always: true.`,
      );
      for (const row of rows(report.unscoped, detail)) out(row);
    }

    // `--full` implies `--all`: "the most detail this report has" cannot mean
    // "and still hide a third of the corpus". `--all` stays as the way to get
    // warm rows at the default width.
    if ((detail === 'full' || hasFlag(args, 'all')) && report.warm.length) {
      out('');
      out(`warm (${report.warm.length}) — injected inside the window:`);
      for (const row of rows(report.warm, detail)) out(row);
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
  usage: `decay [--sessions N] [--all] ${DETAIL_USAGE}`,
  summary: 'items that have not been injected lately',
  run: cmdDecay,
});
