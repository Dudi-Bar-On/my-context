import { COMMAND_FLAGS } from '../../core/command-flags.ts';
import { computeDecay, type DecayRow } from '../../core/decay.ts';
import { Ledger } from '../../core/ledger.ts';
import { topUpLedger } from '../../core/ledger-replay.ts';
import { scopePolicyFor, type Config } from '../../core/config.ts';
import { scopeCell } from '../../core/render-item.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './context.ts';
import {
  DETAIL_USAGE, detailLevel, emitJson, paragraph, records, refuseUnknownFlag, table,
  wantsJson, type Detail,
} from './format.ts';
import { flag, hasFlag, registerCommand, type Emit } from './registry.ts';

/**
 * This command's flag surface, LIFTED to `core/command-flags.ts` so a read
 * surface can have it without reaching a module that writes. Nothing about
 * what is accepted changed; the reasoning is in that module's header.
 */
const { allowed: ALLOWED, values: VALUE_FLAGS } = COMMAND_FLAGS.decay;

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

// No `title` at the scanning level, for the reason `list` gives at its own
// table: the id is a slug of the title, so the two widest columns said one
// thing twice and this report was 170 columns on this repository's corpus.
// `--full` below still carries it.
const HEADERS = ['id', 'type', 'usage'];
const FULL_HEADERS = ['id', 'type', 'injections', 'last injected', 'scope', 'title'];

function usageCell(row: DecayRow): string {
  return row.lastUsed === null ? 'never injected' : `${row.useCount}x, last ${row.lastUsed.slice(0, 10)}`;
}

function cells(row: DecayRow, detail: Detail, config: Config): string[] {
  return detail === 'full'
    ? [
      row.id, row.type, String(row.useCount),
      row.lastUsed === null ? 'never' : row.lastUsed.slice(0, 10),
      // Shared with `list --full`, which renders the same field of the same
      // item and disagreed with this one until `scopeCell` existed.
      scopeCell(row, scopePolicyFor(config, row.type)),
      row.title,
    ]
    : [row.id, row.type, usageCell(row)];
}

/**
 * `--full` is a stanza per item and every other level a table — the same split
 * `list` makes, for the same reason (`records` in format.ts): six columns
 * including a 63-character id and a 92-character title was a 284-column table
 * on this repo's own corpus, so the level carrying the most about an item was
 * the one level nobody could read.
 */
function rows(list: DecayRow[], detail: Detail, config: Config): string[] {
  const values = list.map((r) => cells(r, detail, config));
  // The two-space indent that sits a table inside its section is passed to the
  // renderer, not applied afterwards, so it comes out of the width budget too.
  return detail === 'full'
    ? records(FULL_HEADERS, values, { indent: '  ' })
    : table(HEADERS, values, { indent: '  ' });
}

function cmdDecay(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  // See `unknownFlag` (format.ts). `--sessions` is declared as a value flag
  // so `--sessions 20` does not report `20`'s absence of a leading `--` as
  // anything, and so a bare `--sessions --json` cannot be read two ways by
  // this check and by `flag` below.
  const decayUsage = `usage: mycontext decay [--sessions N] [--all] ${DETAIL_USAGE}`;
  if (refuseUnknownFlag(args, ALLOWED, VALUE_FLAGS, decayUsage, out)) {
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
    // The ledger is a projection of the audit log (see ledger-replay.ts);
    // hooks stopped writing it directly, so aggregate readers catch it up
    // first. Best-effort: an unreadable log must not take down decay — the
    // answer is then computed from the projection as-is, which is the
    // pre-existing behaviour. Know what that degradation looks like: an
    // unreadable audit TREE is indistinguishable from an empty log
    // (`auditSegments` swallows the readdir error), so this catch rarely
    // even fires — the top-up quietly applies nothing and the report
    // under-counts. NOTHING surfaces that today; no doctor check exists
    // for audit-log readability (review I-2 corrected an earlier claim
    // here that one did).
    try { topUpLedger(ws.projectRoot, ledger); } catch { /* aggregate from what is there */ }
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
      //
      // `loadErrors` travels INSIDE the document, never as trailing
      // `emitLoadErrors` lines after it. This branch used to do the latter,
      // which meant that whenever a corpus load error existed — the one
      // moment the report matters most — `decay --json` emitted a valid JSON
      // document followed by plain-text lines, exit 0, empty stderr, and the
      // whole of stdout unparseable. Every other `--json` reporting surface
      // (`status`, `list`, `doctor`, `query`, `review list`) already spells
      // it this way, and README's Output section states the contract.
      emitJson(out, {
        window: report.window,
        sessionsRecorded: report.sessionsRecorded,
        caveat: COLD_CAVEAT,
        // `cold + warm` is the whole eligible set. `unrestricted` overlaps
        // both and is a breadth view, not a fourth bucket — see
        // `DecayReport.unrestricted`. Summing all three double-counts.
        counts: {
          cold: report.cold.length,
          warm: report.warm.length,
          unrestricted: report.unrestricted.length,
        },
        cold: report.cold,
        warm: report.warm,
        unrestricted: report.unrestricted,
        loadErrors: errors.map((e) => ({ file: e.file, message: e.message })),
      });
      return 0;
    }

    if (report.cold.length === 0 && report.warm.length === 0) {
      out('my_context: nothing to report — no active normative items in this project yet.');
      // F2 (context.ts's doc comment on openMutateContext): decay did what it
      // was asked — reported the (empty) report — so an unrelated corpus load
      // error is a warning, not a failure. Only `status`/`doctor` exit
      // non-zero on one; every other command that did its job exits 0.
      emitLoadErrors(errors, out);
      return 0;
    }

    for (const line of paragraph(
      `my_context decay — items not injected in the last ${report.window} session(s). ` +
      `The ledger holds ${report.sessionsRecorded} session(s).`,
    )) out(line);

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
    //
    // Wrapped, not emitted as one line: it is 284 characters, it is printed at
    // EVERY detail level including `--summary`, and unwrapped it was the single
    // thing that made `decay` impossible to read without scrolling sideways
    // whatever level you asked for.
    for (const line of paragraph(COLD_CAVEAT, '  ')) out(line);
    for (const line of paragraph(
      'Do not supersede or deprecate anything on this report alone — verify real usage first.', '  ',
    )) out(line);
    // Zero is not "a small number of sessions", it is NO measurement at all,
    // and "only 0 session(s) recorded so far, so cold mostly means new" reads
    // as a hedge on a real signal rather than as "there is no signal". Found
    // by running this against this repo's own corpus, where every one of 25
    // items is trivially cold.
    if (report.sessionsRecorded === 0) {
      for (const line of paragraph(
        '(no sessions recorded yet — nothing here has been measured; "cold" currently means only "never injected")',
        '  ',
      )) out(line);
    } else if (report.sessionsRecorded < report.window) {
      out(`  (only ${report.sessionsRecorded} session(s) recorded so far, so "cold" mostly means "new")`);
    }

    // `--summary` stops here: the counts and the caveat, no rows. The hedge
    // above is NOT part of what a detail level may drop — a shorter report
    // that keeps the recommendation and drops the reason it might be wrong is
    // the failure mode this report already had once.
    if (detail === 'summary') {
      out('');
      for (const line of paragraph(
        `cold ${report.cold.length}, warm ${report.warm.length}` +
        `${report.unrestricted.length ? `, of which ${report.unrestricted.length} unrestricted` : ''}. ` +
        `Rows with \`mycontext decay\` (default) or \`--full\`.`,
      )) out(line);
      emitLoadErrors(errors, out);
      return 0;
    }

    out('');
    if (report.cold.length === 0) {
      // Two different truths collapse to this branch: "every item was injected
      // in the window" (real signal) and "there were no items to begin with"
      // (nothing was measured at all). Naming both, rather than asserting the
      // first as if it always holds, is what stops this line from claiming
      // activity that never happened.
      for (const line of paragraph(report.warm.length > 0
        ? 'cold: none — every active normative item was injected inside the window.'
        : 'cold: none — no active, normative item exists yet to measure.')) out(line);
    } else {
      for (const line of paragraph(
        `cold (${report.cold.length}) — not auto-injected in the window; check before acting:`,
      )) out(line);
      for (const row of rows(report.cold, detail, ws.config)) out(row);
    }

    // Deliberately NOT a "fix this" section. These rows are already counted in
    // cold or warm above; repeating them here says one thing only, and it is a
    // cost, not a defect: an item with no scope is unrestricted, so it applies
    // to every file and competes for the JIT budget on every file operation.
    // Narrowing one is worth doing only if you meant it to be narrow.
    if (report.unrestricted.length) {
      out('');
      for (const line of paragraph(
        `unrestricted (${report.unrestricted.length}) — active and normative with no scope, so they ` +
        `apply to every file and compete for the jit budget on every file operation. ` +
        `Each is also counted as cold or warm — this is a view over those rows, not a ` +
        `fourth bucket. Not a defect: add a scope glob only if you meant to narrow ` +
        `where the item applies.`,
      )) out(line);
      for (const row of rows(report.unrestricted, detail, ws.config)) out(row);
    }

    // `--full` implies `--all`: "the most detail this report has" cannot mean
    // "and still hide a third of the corpus". `--all` stays as the way to get
    // warm rows at the default width.
    if ((detail === 'full' || hasFlag(args, 'all')) && report.warm.length) {
      out('');
      out(`warm (${report.warm.length}) — injected inside the window:`);
      for (const row of rows(report.warm, detail, ws.config)) out(row);
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
