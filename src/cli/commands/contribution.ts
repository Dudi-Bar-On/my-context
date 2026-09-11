import { COMMAND_FLAGS } from '../../core/command-flags.ts';
import { readAudit } from '../../core/audit.ts';
import {
  cohorts, contributions, exposure, undelivered,
  type Cohort, type Contribution, type Exposure, type Injectable,
} from '../../core/contribution.ts';
import {
  MIN_WINDOW_DAYS, RETIREABLE_ORIGIN, RETIREMENT_RULE, WHY_NO_RULE, derivability, payloadTrend,
  separation, tierSkew, type DoorLoad, type RetirementEvidence,
} from '../../core/retire.ts';
import { isEligible, isNormative } from '../../core/select.ts';
import { ORIGINS } from '../../core/validate.ts';
import type { Item } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './context.ts';
import {
  DETAIL_USAGE, detailLevel, emitJson, paragraph, records, refuseUnknownFlag, table,
  wantsJson, type Detail,
} from './format.ts';
import { hasFlag, registerCommand, type Emit } from './registry.ts';

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
 * it. Three separate limits, and none of them is a hedge on a real signal:
 *
 * 1. The log records INJECTION, never reading or reliance. An item opened as
 *    Markdown, fetched with `show` or read through MCP `get_item` leaves no
 *    record here and is indistinguishable from one nobody has ever touched.
 *    This is `decay`'s caveat, and it applies here for the same reason.
 *
 * 2. **A raw delivery count is age, not usefulness**, and on this corpus it is
 *    age almost entirely: on 2026-09-10 the twenty least-delivered injectable
 *    items were the twenty most recently created, and the twenty most-delivered
 *    were all created in August. So `per chance` is reported beside every
 *    count — the deliveries an item got over the injection records written
 *    since its `valid_from` — because a threshold derived from the raw column
 *    would retire exactly the newest governing items.
 *
 * 3. **Eligibility is a PRESENT-TENSE verdict applied to a HISTORICAL log.**
 *    Every count below is taken over the items `select` could choose *today*,
 *    because a delivery count over a `task` or a `decision` measures the
 *    category and not the item. But an item's category tier and its `status`
 *    both move, so an item delivered nine hundred times and superseded
 *    yesterday leaves the measured population while its delivery events stay
 *    in the log. The `delivered, now ineligible` column counts exactly those,
 *    so the correction is visible rather than silent.
 */
const CAVEAT =
  'The audit log records INJECTION, never reading or reliance: an item opened as Markdown, ' +
  'fetched with `show`, or read through MCP `get_item` leaves no record here and looks ' +
  'exactly like one nobody has ever used. A raw delivery count is mostly AGE — the twenty ' +
  'least-delivered items on this corpus were the twenty most recently created — so read ' +
  '`per chance`, the deliveries an item got over the injection records written since its ' +
  '`valid_from`, before ranking anything by the raw column. And ' +
  'eligibility is a verdict about TODAY applied to a log about the past: an item that has ' +
  'since been superseded, deprecated or moved out of the normative tier leaves the measured ' +
  'population while its past deliveries stay in the log, which is what the `delivered, now ' +
  'ineligible` column counts. None of these numbers is a reason to retire anything on its own.';

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

const COHORT_HEADERS = [
  'origin', 'items', 'injectable', 'never delivered', 'always spilled', 'median delivered',
  'delivered, now ineligible',
];
const ITEM_HEADERS = ['id', 'origin', 'delivered', 'per chance', 'spilled', 'tiers'];
const FULL_ITEM_HEADERS = [
  'id', 'origin', 'injectable', 'delivered', 'chances', 'per chance', 'spilled', 'tiers',
  'first', 'last',
];

/**
 * A rate is printed to two places and a missing one is `—`, never `0.00`.
 * `0/0` is unmeasured, and a zero there would read as the sharpest finding in
 * the table when it is in fact the absence of one.
 */
function rateCell(row: Exposure | undefined): string {
  return row === undefined || row.rate === null ? '—' : row.rate.toFixed(2);
}

/**
 * **`select`'s own gate, reused rather than re-spelled.**
 *
 * `isNormative`'s doc comment in `core/select.ts` records why it is exported at
 * all: the governance-tier test had already been written twice and a third
 * spelling in a read surface was the drift it existed to prevent — "the
 * function travels instead of the predicate". So this is the two exported
 * functions called in the order `select` calls them (`select.ts`, where
 * `injectable` is `eligible.filter(isNormative)`), and not a fourth statement
 * of the rule.
 *
 * **Why any eligibility gate at all**, given the first reading of this report
 * did without one: `select` admits only categories whose tier is `normative`,
 * so a `task`, `decision`, `lesson`, `note` or `adr` is never a candidate for
 * injection and its delivery count is zero for a reason that has nothing to do
 * with the item. On 2026-09-10 that was 918 of 1,076 items — so the
 * whole-corpus figure said "82% of this corpus has never been delivered" when
 * the measurable claim was that every item `select` could choose had landed at
 * least once. A report whose headline number has to be corrected in prose by a
 * reader who knows `select.ts` cannot be compared against a later reading,
 * which is this command's entire purpose.
 */
function injectableIn(ws: { config: Parameters<typeof isNormative>[1] }): Injectable {
  return (item: Item): boolean => isEligible(item, ws.config) && isNormative(item, ws.config);
}

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
 * loud (`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`).
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
    origin, items: 0, injectable: 0, neverDelivered: 0, alwaysSpilled: 0, medianDelivered: 0,
    deliveredNotInjectable: 0,
  });
}

function cohortCells(row: Cohort): string[] {
  return [
    row.origin, String(row.items), String(row.injectable), String(row.neverDelivered),
    String(row.alwaysSpilled), String(row.medianDelivered), String(row.deliveredNotInjectable),
  ];
}

/** One item's row. `origin` comes from the corpus, the counts from the log. */
function itemCells(
  item: Item, got: Contribution | undefined, chances: Exposure | undefined,
  detail: Detail, injectable: Injectable,
): string[] {
  const delivered = got?.delivered ?? 0;
  const spilled = got?.spilled ?? 0;
  const tiers = got === undefined || got.tiers.length === 0 ? '—' : got.tiers.slice().sort().join(', ');
  return detail === 'full'
    ? [
      item.id, item.origin, injectable(item) ? 'yes' : 'no', String(delivered),
      String(chances?.opportunities ?? 0), rateCell(chances), String(spilled),
      tiers, got?.firstAt?.slice(0, 10) ?? 'never', got?.lastAt?.slice(0, 10) ?? 'never',
    ]
    : [item.id, item.origin, String(delivered), rateCell(chances), String(spilled), tiers];
}

/**
 * **`--retire`: may anything be retired on these numbers, and what would it
 * be?** `plan:loop seq:5`, design §9.
 *
 * The verb is missing on purpose and its absence is the guarantee. §13: *the
 * owner promotes, always* — and a retirement is a stand-down that reaches
 * every future session, so this surface names candidates and stops. There is
 * no `--apply`, `core/retire.ts` imports no write path at all, and
 * `test/core/retire.test.ts` holds both facts.
 *
 * **What it prints when the answer is no is the whole point.** A phase whose
 * honest output is "the data does not support a threshold yet" has to be able
 * to SAY that, in numbers, on a surface somebody will run again in a month —
 * otherwise the next reader's only options are to trust a report or to invent
 * a number, which is the failure §9 exists to prevent.
 */
const RETIRE_PURPOSE =
  'This surface PROPOSES. It has no verb: there is no flag here that retires, deprecates or ' +
  'deletes anything, and `core/retire.ts` imports no write path, because a retirement is a ' +
  'stand-down that reaches every future session and the owner promotes, always.';

/** Per-door growth, first measured day against last. The "bound the corpus" half of §9. */
function doorGrowth(trend: DoorLoad[]): { op: string; from: DoorLoad; to: DoorLoad }[] {
  const byOp = new Map<string, DoorLoad[]>();
  for (const row of trend) {
    const list = byOp.get(row.op) ?? [];
    list.push(row);
    byOp.set(row.op, list);
  }
  return [...byOp.entries()]
    .map(([op, list]) => ({ op, from: list[0]!, to: list[list.length - 1]! }))
    .sort((a, b) => b.to.injected - a.to.injected);
}

function emitRetirement(
  out: Emit, json: boolean, evidence: RetirementEvidence, trend: DoorLoad[], ration: number,
  loadErrors: { file: string; message: string }[],
): void {
  const verdict = derivability(evidence);
  const growth = doorGrowth(trend);
  if (json) {
    // `loadErrors` travels INSIDE the document for the reason the reading
    // surface below it records: a valid JSON document followed by plain-text
    // lines is an unparseable stdout at the one moment the report matters.
    emitJson(out, {
      measuredAt: new Date().toISOString(),
      purpose: RETIRE_PURPOSE,
      evidence,
      derivable: verdict.derivable,
      because: verdict.because,
      // `null` and it is the answer, not a missing field: a derivation this
      // build does not have is a fact a script must be able to read.
      rule: RETIREMENT_RULE,
      whyNoRule: WHY_NO_RULE,
      candidates: [],
      bound: { maxProposalsPerPass: ration, doors: growth },
      loadErrors,
    });
    return;
  }

  for (const line of paragraph(
    'my_context contribution --retire — whether this corpus supports a retirement threshold, ' +
    'and what one would name if it did.',
  )) out(line);
  out('');
  for (const line of paragraph(RETIRE_PURPOSE, '  ')) out(line);

  out('');
  for (const line of paragraph('the evidence:')) out(line);
  for (const line of table(
    ['measure', 'value'],
    [
      [`items of origin \`${RETIREABLE_ORIGIN}\``, String(evidence.population)],
      ['injectable items', String(evidence.injectable)],
      ['of those, never delivered', String(evidence.neverDelivered)],
      ['of those, only ever spilled', String(evidence.alwaysSpilled)],
      ['days the log covers', `${evidence.windowDays} (need ${MIN_WINDOW_DAYS})`],
      [
        'widest gap in the rate distribution',
        `x${evidence.separation.widestGapRatio.toFixed(0)} the typical spacing, leaving ` +
        `${evidence.separation.below} of ${evidence.separation.of} below it`,
      ],
      [
        'pinned items in the least-delivered half',
        `${evidence.skew.pinnedInBottomHalf} of ${evidence.skew.pinned}`,
      ],
    ],
    { indent: '  ' },
  )) out(line);

  out('');
  if (verdict.derivable) {
    for (const line of paragraph(
      'a threshold MAY now be derived from this corpus — every clause the gate checks is ' +
      'satisfied. It has not been: `RETIREMENT_RULE` is still null. Derive the two numbers ' +
      'from the distribution above, write them down with the day they were measured, and put ' +
      'the report\'s path beside them.',
    )) out(line);
  } else {
    for (const line of paragraph(
      `no retirement threshold may be derived from this corpus today, for ` +
      `${verdict.because.length} measured reason(s):`,
    )) out(line);
    for (const because of verdict.because) {
      for (const line of paragraph(`- ${because}`, '  ')) out(line);
    }
    out('');
    for (const line of paragraph(
      'so NOTHING is proposed for retirement, and that is a result rather than a gap. A ' +
      'threshold picked anyway would be the badly-tuned retirement the design cites as ' +
      'measuring WORSE than no retirement at all.', '  ',
    )) out(line);
  }

  // **The other half of the title, and it is not about retirement at all.** A
  // corpus that only grows does not announce itself as spill; it announces
  // itself as a payload. This is the measurement a cap would one day have to
  // be derived from, printed now so the day it becomes derivable is visible.
  out('');
  for (const line of paragraph(
    'bounding the corpus — what each door actually carried, first measured day against last. ' +
    'Growth here is the cost of a corpus that only grows: it is paid in every delivery, and ' +
    'a door that is not spilling can still be growing.',
  )) out(line);
  // `table` renders nothing at all for zero rows, and a section that vanishes
  // is a measurement stated by omission — the defect
  // `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` names. An
  // empty log is UNMEASURED here, not a corpus that grew by nothing.
  if (growth.length === 0) {
    for (const line of paragraph(
      '(no injection records in this log, so no door has been measured at all — this is the '
      + 'absence of a measurement, not a corpus that has stopped growing)', '  ',
    )) out(line);
  } else {
    for (const line of table(
      ['door', 'first day', 'items then', 'last day', 'items now', 'spilled now'],
      growth.map((row) => [
        row.op, row.from.day, row.from.injected.toFixed(1), row.to.day,
        row.to.injected.toFixed(1), row.to.spilled.toFixed(1),
      ]),
      { indent: '  ' },
    )) out(line);
  }
  out('');
  for (const line of paragraph(
    ration === 0
      ? 'The only bound this build can defend is the one already in force: `review.' +
        'maxProposalsPerPass` is 0, so the loop cannot add to the corpus at all, and a cap on ' +
        'a population that cannot grow would be a number with nothing to measure it against.'
      : `\`review.maxProposalsPerPass\` is ${ration}, so the loop may now add to the corpus. ` +
        'A cap over `origin: `review`` items becomes derivable once that population has a ' +
        'distribution of its own — re-run this then.', '  ',
  )) out(line);
}

function cmdContribution(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  const usage = `usage: mycontext contribution [--retire] ${DETAIL_USAGE}`;
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
    const injectionRecords = records_.filter((r) => r.kind === 'injection');
    const injections = injectionRecords.length;
    // **A delivery count is not a count of sessions, and the difference is
    // large enough to change what every number here means.** `recordAudit`
    // writes one injection record per DELIVERY, and a delivery happens at
    // session start, at every subagent dispatch, on every JIT hook fire and on
    // compaction restore. On 2026-09-10 that was 54 session-starts against
    // 1,082 subagent dispatches and 1,182 JIT fires — so an item "delivered
    // 641 times" was overwhelmingly delivered to delegated workers, and a
    // reader who took the same figure as "641 sessions" would be out by more
    // than an order of magnitude. Reported rather than corrected, because
    // which op matters depends on the question being asked.
    const byOp = new Map<string, number>();
    for (const record of injectionRecords) {
      byOp.set(record.op, (byOp.get(record.op) ?? 0) + 1);
    }
    const ops = [...byOp.entries()].sort((a, b) => b[1] - a[1]);
    const got = contributions(records_);
    const items = ctx.store.all();
    const byId = new Map(items.map((item) => [item.id, item]));
    const injectable = injectableIn(ctx);
    const rows = allCohorts(cohorts(byId, got, injectable));
    const quiet = undelivered(byId, got, injectable);
    // **The correction that decides whether any of these counts may ever
    // become a threshold.** On this corpus the twenty least-delivered
    // injectable items were the twenty most recently created and the twenty
    // most-delivered were all from August, so the raw ranking below is age.
    // `per chance` is the same delivery count over the injection records
    // written since the item's `valid_from`, which is the only exposure figure
    // available without guessing.
    const chances = exposure(byId, got, injectionRecords.map((r) => r.at));
    // **The rate's ceiling is set by the LOG, not by the item**, so it is
    // measured rather than assumed to be 1.00. A JIT delivery carries only the
    // items whose scope matches the file being touched, and JIT was 1,182 of
    // 2,343 records on 2026-09-10 — so even an always-pinned item cannot
    // appear in much more than half of them, and the best any item reached was
    // 0.40. A reader who took 0.21 as "one fifth as good as it could be" would
    // be wrong by a factor of two and a half.
    const bestRate = rateCell([...items].filter(injectable)
      .map((item) => chances.get(item.id))
      .reduce<Exposure | undefined>(
        (best, row) => (row !== undefined && (best === undefined || (row.rate ?? -1) > (best.rate ?? -1))
          ? row : best),
        undefined,
      ));
    const total = (pick: (row: Cohort) => number): number => rows.reduce((n, r) => n + pick(r), 0);
    const measurable = total((r) => r.injectable);
    const ineligible = items.length - measurable;

    // **The retirement question is a different report over the same reading**,
    // so it branches here rather than being appended: everything above it is
    // the measurement it consumes, and nothing below it applies.
    if (hasFlag(args, 'retire')) {
      const days = injectionRecords.map((r) => r.at).sort();
      const first = days[0];
      const last = days[days.length - 1];
      const ranked = items.filter(injectable).map((item) => ({
        value: chances.get(item.id)?.rate ?? 0,
        pinned: item.always,
      }));
      emitRetirement(out, json, {
        population: items.filter((item) => item.origin === RETIREABLE_ORIGIN).length,
        injectable: measurable,
        neverDelivered: quiet.length,
        alwaysSpilled: total((r) => r.alwaysSpilled),
        // Whole days between the first and last injection record. A log with
        // one record covers 0 days, which is the honest reading: a window is
        // the distance between two observations, and one observation is not a
        // window.
        windowDays: first === undefined || last === undefined
          ? 0
          : Math.floor((Date.parse(last) - Date.parse(first)) / 86_400_000),
        separation: separation(ranked.map((row) => row.value)),
        skew: tierSkew(ranked),
      }, payloadTrend(records_), ws.config.review.maxProposalsPerPass,
      errors.map((e) => ({ file: e.file, message: e.message })));
      if (!json) emitLoadErrors(errors, out);
      return 0;
    }

    if (json) {
      // `loadErrors` travels INSIDE the document, never as trailing plain-text
      // lines after it — `decay --json` had that defect and the whole of
      // stdout was unparseable at the one moment the report mattered most.
      emitJson(out, {
        measuredAt: new Date().toISOString(),
        corpusItems: items.length,
        // The denominator every other figure is taken over, published so a
        // script never has to re-derive it from `items` and a guess about
        // which categories are normative in THIS workspace's config.
        injectableItems: measurable,
        ineligibleItems: ineligible,
        deliveredNowIneligible: total((r) => r.deliveredNotInjectable),
        auditRecords: records_.length,
        injectionRecords: injections,
        // Which KIND of delivery those records were. A script comparing two
        // readings has to know this: a corpus whose deliveries moved from
        // `session-start` to `subagent-start` has changed how it is used, not
        // how useful it is.
        injectionsByOp: Object.fromEntries(ops),
        idsSeenInLog: got.size,
        purpose: PURPOSE,
        caveat: CAVEAT,
        cohorts: rows,
        injectableNeverDelivered: quiet.map((item) => item.id),
        items: items.map((item) => {
          const row = got.get(item.id);
          return {
            id: item.id, type: item.type, origin: item.origin,
            injectable: injectable(item),
            delivered: row?.delivered ?? 0, spilled: row?.spilled ?? 0,
            opportunities: chances.get(item.id)?.opportunities ?? 0,
            deliveredPerChance: chances.get(item.id)?.rate ?? null,
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
      `${items.length} item(s), of which ${measurable} could be chosen by \`select\` today.`,
    )) out(line);
    if (ops.length > 0) {
      out('');
      for (const line of paragraph(
        'A record is one DELIVERY, not one session: ' +
        ops.map(([op, n]) => `${n} ${op}`).join(', ') +
        '. So a high count is mostly a count of subagent dispatches and hook fires, and reading ' +
        'any figure below as a number of sessions would overstate it by more than an order of ' +
        'magnitude.',
      )) out(line);
    }
    out('');
    for (const line of paragraph(PURPOSE, '  ')) out(line);
    out('');
    for (const line of paragraph(CAVEAT, '  ')) out(line);

    // The correction stated where the numbers are, not only in a report
    // somebody has to find. Without this sentence the cohort table's
    // `injectable` column is a number with no explanation, and the reader is
    // left to infer the rule from the gap.
    if (ineligible > 0) {
      out('');
      for (const line of paragraph(
        `${ineligible} item(s) are NOT injectable and are excluded from every count below ` +
        'except `items`: `select` admits only categories whose tier is `normative`, so a ' +
        '`task`, `decision`, `lesson`, `note` or `adr` is never a candidate, and neither is ' +
        'an item whose status has left `active`. Their delivery count is zero for a reason ' +
        'that is not about the item, and pooling them made the first reading of this report ' +
        'unreadable without a correction in prose.', '  ',
      )) out(line);
    }

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

    // **The finding, named rather than left to be reconstructed from a rank.**
    // The default list below is the bottom of the distribution, and before the
    // eligibility split it was 918 rows of by-construction zeros — the
    // instrument could not rank its own sharpest finding into view. So the
    // finding gets its own section, and its absence is printed too: a corpus
    // where everything lands and a log that recorded nothing read the same
    // here, which is why the record count is repeated in the same sentence.
    out('');
    if (quiet.length === 0) {
      for (const line of paragraph(
        `injectable and never delivered: NONE — all ${measurable} item(s) \`select\` could ` +
        `choose today appear in at least one of the log's ${injections} injection record(s). ` +
        'A quiet run is not a clean corpus: this reads identically to a log that recorded ' +
        'nothing, so check the record count before treating it as good news.',
      )) out(line);
    } else {
      for (const line of paragraph(
        `injectable and never delivered (${quiet.length} of ${measurable}) — items that ` +
        'govern today and appear in no injection record:',
      )) out(line);
      for (const line of records(
        ['id', 'origin', 'type'],
        quiet.map((item) => [item.id, item.origin, item.type]),
        { indent: '  ' },
      )) out(line);
    }

    if (detail === 'summary') {
      out('');
      for (const line of paragraph(
        `${items.length} item(s), ${measurable} of them injectable, of which ` +
        `${total((r) => r.neverDelivered)} have never been delivered. Rows with ` +
        '`mycontext contribution` (default) or `--full`.',
      )) out(line);
      emitLoadErrors(errors, out);
      return 0;
    }

    // Least-delivered first: the interesting end of this report is the bottom
    // of the distribution, and an item nobody has ever delivered has no row in
    // the log at all — so it is reached from the corpus, never from `got`.
    //
    // The default is the INJECTABLE set. `--full` still shows every item, with
    // a column saying which side of the line each one is on, because dropping
    // 918 rows silently would be a second way to make an ineligible item look
    // measured.
    const ranked = items
      .filter((item) => detail === 'full' || injectable(item))
      .sort((a, b) => {
        const byCount = (got.get(a.id)?.delivered ?? 0) - (got.get(b.id)?.delivered ?? 0);
        return byCount !== 0 ? byCount : (a.id < b.id ? -1 : 1);
      });
    const shown = detail === 'full' ? ranked : ranked.slice(0, 20);

    out('');
    if (shown.length === 0) {
      for (const line of paragraph(
        'no injectable items — this corpus holds nothing `select` could deliver, so every ' +
        'cohort above is a measured zero rather than a finding.',
      )) out(line);
    } else {
      for (const line of paragraph(
        detail === 'full'
          ? `every item (${ranked.length}), least delivered first — \`injectable\` says ` +
            'whether `select` could ever have chosen it, and `chances` is how many injection ' +
            'records were written since it existed:'
          : `least delivered of the ${measurable} injectable item(s) (${shown.length} shown) ` +
            '— this order is largely AGE, so read `per chance` beside it before concluding ' +
            `anything. Its ceiling here is ${bestRate}, not 1.00, because a JIT delivery ` +
            'carries only path-scoped items and JIT is most of this log — so compare rates ' +
            `with each other and never against 1. \`--full\` for all ${items.length} ` +
            'including the ineligible, `--json` for the machine form:',
      )) out(line);
      const headers = detail === 'full' ? FULL_ITEM_HEADERS : ITEM_HEADERS;
      const values = shown.map(
        (item) => itemCells(item, got.get(item.id), chances.get(item.id), detail, injectable),
      );
      // A stanza per item at `--full` and a table otherwise, the split `list`
      // and `decay` already make: eight columns including a 63-character id is
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
