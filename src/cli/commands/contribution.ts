import { COMMAND_FLAGS } from '../../core/command-flags.ts';
import { readAudit } from '../../core/audit.ts';
import { cohorts, contributions, type Cohort, type Contribution } from '../../core/contribution.ts';
import { ORIGINS } from '../../core/validate.ts';
import type { Item } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './context.ts';
import {
  DETAIL_USAGE, detailLevel, emitJson, paragraph, records, refuseUnknownFlag, table,
  wantsJson, type Detail,
} from './format.ts';
import { registerCommand, type Emit } from './registry.ts';

/**
 * This command's flag surface lives in `core/command-flags.ts` for the reason
 * that module's header gives: a read surface must be able to know what a
 * command accepts without importing the column of side-effect imports that
 * registers every writing command.
 */
const { allowed: ALLOWED, values: VALUE_FLAGS } = COMMAND_FLAGS.contribution;

/**
 * **The hedge, and it is bigger than `decay`'s.**
 *
 * Carried by BOTH surfaces — the text report and `--json` — because a script
 * that ranks items by "never delivered" is precisely the reader who most needs
 * it. Two separate limits, and neither is a hedge on a real signal:
 *
 * 1. The log records INJECTION, never reading or reliance. An item opened as
 *    Markdown, fetched with `show` or read through MCP `get_item` leaves no
 *    record here and is indistinguishable from one nobody has ever touched.
 *    This is `decay`'s caveat, and it applies here for the same reason.
 *
 * 2. The log only reaches back as far as the log. An item created yesterday
 *    has had fewer chances to be delivered than one created in July, and this
 *    report does not normalise for that — a low count is not evidence of a
 *    useless item.
 */
const CAVEAT =
  'The audit log records INJECTION, never reading or reliance: an item opened as Markdown, ' +
  'fetched with `show`, or read through MCP `get_item` leaves no record here and looks ' +
  'exactly like one nobody has ever used. And the counts are not normalised for age — a ' +
  'recently created item has had fewer chances to be delivered than an old one. Neither ' +
  'number is a reason to retire anything on its own.';

/**
 * What this report is FOR, stated in the output rather than only in the plan
 * that asked for it.
 *
 * Library drift — accumulated knowledge pushing a session below the
 * no-knowledge baseline — is silent by construction and only ever detectable
 * as a CHANGE. So the value of a single run is not the numbers; it is that a
 * later run has something to be compared against.
 */
const PURPOSE =
  'This is a BASELINE. Per-item delivery is only ever readable as a change over time, so a ' +
  'single reading is the control for a later one — split by who authored the item, because ' +
  'the comparison between cohorts is the measurement.';

const COHORT_HEADERS = ['origin', 'items', 'never delivered', 'always spilled', 'median delivered'];
const ITEM_HEADERS = ['id', 'origin', 'delivered', 'spilled', 'tiers'];
const FULL_ITEM_HEADERS = ['id', 'origin', 'delivered', 'spilled', 'tiers', 'first', 'last'];

/**
 * **The table is drawn for every origin the corpus COULD have, not only the
 * ones it has.**
 *
 * `cohorts` walks the items that exist, so an empty corpus produces no rows at
 * all and `table` renders nothing for zero rows — which is the shape this
 * project has already recorded as a failure elsewhere: an output that looks
 * like a broken command. Worse here than merely ugly, because "no agent-origin
 * item has ever been promoted" is the single most load-bearing fact in the
 * baseline, and a missing row states it by omission where a zero states it out
 * loud (`STD-a-measured-zero-is-drawn-and-named`).
 *
 * Any origin the corpus actually carries and `ORIGINS` does not is appended
 * rather than dropped — the self-improvement design adds a fourth, and a
 * report that silently omitted it would under-count the corpus it is
 * measuring.
 */
function allCohorts(rows: Cohort[]): Cohort[] {
  const byOrigin = new Map(rows.map((row) => [row.origin, row]));
  const names: string[] = [...new Set<string>([...ORIGINS, ...byOrigin.keys()])].sort();
  return names.map((origin) => byOrigin.get(origin) ?? {
    origin, items: 0, neverDelivered: 0, alwaysSpilled: 0, medianDelivered: 0,
  });
}

function cohortCells(row: Cohort): string[] {
  return [
    row.origin, String(row.items), String(row.neverDelivered),
    String(row.alwaysSpilled), String(row.medianDelivered),
  ];
}

/** One item's row. `origin` comes from the corpus, the counts from the log. */
function itemCells(item: Item, got: Contribution | undefined, detail: Detail): string[] {
  const delivered = got?.delivered ?? 0;
  const spilled = got?.spilled ?? 0;
  const tiers = got === undefined || got.tiers.length === 0 ? '—' : got.tiers.slice().sort().join(', ');
  const base = [item.id, item.origin, String(delivered), String(spilled), tiers];
  return detail === 'full'
    ? [...base, got?.firstAt?.slice(0, 10) ?? 'never', got?.lastAt?.slice(0, 10) ?? 'never']
    : base;
}

function cmdContribution(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  const usage = `usage: mycontext contribution ${DETAIL_USAGE}`;
  if (refuseUnknownFlag(args, ALLOWED, VALUE_FLAGS, usage, out)) return 1;

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
  try {
    // Whole-log read, deliberately. `readAudit` is the read surface and says
    // so; nothing on the hook path calls it, so a growing log costs nothing
    // until somebody asks this question.
    const records_ = readAudit(ws.projectRoot);
    const injections = records_.filter((r) => r.kind === 'injection').length;
    const got = contributions(records_);
    const items = ctx.store.all();
    const byId = new Map(items.map((item) => [item.id, item]));
    const rows = allCohorts(cohorts(byId, got));

    if (json) {
      // `loadErrors` travels INSIDE the document, never as trailing plain-text
      // lines after it — `decay --json` had that defect and the whole of
      // stdout was unparseable at the one moment the report mattered most.
      emitJson(out, {
        measuredAt: new Date().toISOString(),
        corpusItems: items.length,
        auditRecords: records_.length,
        injectionRecords: injections,
        idsSeenInLog: got.size,
        purpose: PURPOSE,
        caveat: CAVEAT,
        cohorts: rows,
        items: items.map((item) => {
          const row = got.get(item.id);
          return {
            id: item.id, type: item.type, origin: item.origin,
            delivered: row?.delivered ?? 0, spilled: row?.spilled ?? 0,
            tiers: row?.tiers ?? [],
            firstAt: row?.firstAt ?? null, lastAt: row?.lastAt ?? null,
          };
        }),
        loadErrors: errors.map((e) => ({ file: e.file, message: e.message })),
      });
      return 0;
    }

    for (const line of paragraph(
      `my_context contribution — how often each item was actually delivered into a session, ` +
      `read backwards out of the audit log. The log holds ${injections} injection record(s) ` +
      `of ${records_.length} total, naming ${got.size} distinct id(s); the corpus holds ` +
      `${items.length} item(s).`,
    )) out(line);
    out('');
    for (const line of paragraph(PURPOSE, '  ')) out(line);
    out('');
    for (const line of paragraph(CAVEAT, '  ')) out(line);

    // Zero is NO measurement, not a small one, and it is the one state where
    // every "never delivered" figure below is trivially the whole corpus. Said
    // in its own sentence rather than left for a reader to infer from a column
    // of identical numbers.
    if (injections === 0) {
      out('');
      for (const line of paragraph(
        '(no injection records in this log yet — nothing here has been measured, and ' +
        '"never delivered" below currently means only "the log is empty")', '  ',
      )) out(line);
    }

    out('');
    for (const line of paragraph('by origin — the cohort table:')) out(line);
    for (const line of table(COHORT_HEADERS, rows.map(cohortCells), { indent: '  ' })) out(line);

    if (detail === 'summary') {
      out('');
      for (const line of paragraph(
        `${items.length} item(s), of which ${rows.reduce((n, r) => n + r.neverDelivered, 0)} ` +
        'have never been delivered. Rows with `mycontext contribution` (default) or `--full`.',
      )) out(line);
      emitLoadErrors(errors, out);
      return 0;
    }

    // Least-delivered first: the interesting end of this report is the bottom
    // of the distribution, and an item nobody has ever delivered has no row in
    // the log at all — so it is reached from the corpus, never from `got`.
    const ranked = items.slice().sort((a, b) => {
      const byCount = (got.get(a.id)?.delivered ?? 0) - (got.get(b.id)?.delivered ?? 0);
      return byCount !== 0 ? byCount : (a.id < b.id ? -1 : 1);
    });
    const shown = detail === 'full' ? ranked : ranked.slice(0, 20);

    out('');
    if (shown.length === 0) {
      for (const line of paragraph(
        'no items — this corpus holds nothing to measure yet, so every cohort above is a ' +
        'measured zero rather than a finding.',
      )) out(line);
    } else {
      for (const line of paragraph(
        detail === 'full'
          ? `every item (${ranked.length}), least delivered first:`
          : `least delivered (${shown.length} of ${ranked.length}) — \`--full\` for all, ` +
            '`--json` for the machine form:',
      )) out(line);
      const headers = detail === 'full' ? FULL_ITEM_HEADERS : ITEM_HEADERS;
      const values = shown.map((item) => itemCells(item, got.get(item.id), detail));
      // A stanza per item at `--full` and a table otherwise, the split `list`
      // and `decay` already make: seven columns including a 63-character id is
      // not a table anybody can read at this corpus's width.
      for (const line of detail === 'full'
        ? records(headers, values, { indent: '  ' })
        : table(headers, values, { indent: '  ' })) out(line);
    }

    // F2 (`openMutateContext`): this command did what it was asked, so an
    // unrelated corpus load error is a warning and the exit stays 0. Only
    // `status`/`doctor` exit non-zero on one.
    emitLoadErrors(errors, out);
    return 0;
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  } finally {
    ctx.store.close();
  }
}

registerCommand({
  name: 'contribution',
  usage: `contribution ${DETAIL_USAGE}`,
  summary: 'how often each item was actually delivered, from the audit log',
  run: cmdContribution,
});
