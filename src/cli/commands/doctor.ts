import path from 'node:path';
import { COMMAND_FLAGS } from '../../core/command-flags.ts';
import {
  checkCliOnPath, checksumMigrationFindings, REMEDY, runChecks, type Finding,
} from '../../doctor/checks.ts';
import type { Item } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './context.ts';
import {
  DETAIL_USAGE, detailLevel, emitJson, outputWidth, paragraph, records,
  refuseUnknownFlag, wantsJson, type Detail,
} from './format.ts';
import { hasFlag, registerCommand, type Emit } from './registry.ts';

/**
 * This command's flag surface, LIFTED to `core/command-flags.ts` so a read
 * surface can have it without reaching a module that writes. Nothing about
 * what is accepted changed; the reasoning is in that module's header.
 */
const { allowed: ALLOWED, values: VALUE_FLAGS } = COMMAND_FLAGS.doctor;

/**
 * **A DISCLOSURE — the check describing ITSELF — and how this command tells one
 * from a finding.**
 *
 * The rule above `interface Finding` (checks.ts) already made a check disclose
 * what it cannot judge *"as UNMEASURED, once, and never per item"*, and three
 * checks obey it: `state_audit_coverage` says how many items `state_unaudited`
 * could not look at, `body_review_limits` says the count above it is a floor,
 * and the citation-specimen lane adds a third of the same shape. **What that
 * rule did not finish is that a disclosure was still being COUNTED and LISTED
 * as work.**
 *
 * Owner, 2026-09-03, on exactly these lines: *"after you complete handling
 * them, the test should be that they will not be listed anymore at doctor
 * list"*, against his standing objection that *"a finding a user has no tool to
 * solve is the problem"*. All three name no item, carry `route: 'none'`, and
 * say in their own words that nothing is owed. **A row that says "nothing is
 * owed" is still a row he has to read and dismiss** — which is the same failure
 * the rule names, one level up: not noise wearing work's clothes, but a note
 * wearing a worklist's.
 *
 * So `Finding.about` marks it, and the marker is the CHECK the note is about
 * (`state_audit_coverage` is `about: 'state_unaudited'`). That is not
 * decoration: it is what lets the note be drawn under the table whose reach it
 * limits, which is where a reader meets it in the only context that explains
 * it. A self-naming flag would have said "this is a note" and left the reader
 * to work out a note about WHAT.
 *
 * **Nothing is deleted and nothing is hidden.** `RULE-say-what-your-check-cannot-see-when-you-report-it-green`
 * requires the text and `INV-nothing-is-dropped-silently` forbids losing it, so
 * every character still prints — under its code's heading, after the summary,
 * as a note, and in `--json` under its own key. It moves; it does not go.
 *
 * ── WHY IT IS A RUNTIME TEST AND NOT `if (finding.about)` ─────────────────
 *
 * `about` is OPTIONAL, and the two ways it can be absent must answer the same
 * thing: a check that never sets it, and a `''` from a call site that meant to
 * name a code and named nothing. An empty string is a disclosure with no check
 * to draw it under, which is worse than not being one — the UI keys the note by
 * this value and would file it under `""`.
 *
 * It is also read off objects that were never typed. `/api/doctor` serves these
 * findings verbatim to a browser (`read-model.ts`: *"`runChecks` output,
 * carried and not reshaped"*), and `screens/doctor.js` applies the same two
 * conditions for the same reason — a body from a build that predates the field
 * omits it, exactly as `cardRows` already normalises `item` and `acknowledged`
 * against that case.
 *
 * Written before `checks.ts` declared the field, deliberately as a test on an
 * optional string so that landing the declaration needed no second edit here.
 * That has happened; nothing about this function changed when it did.
 */
export function disclosureAbout(finding: Finding): string | undefined {
  const { about } = finding;
  return typeof about === 'string' && about !== '' ? about : undefined;
}

/** `true` when this finding is a note about a check rather than about the corpus. */
export function isDisclosure(finding: Finding): boolean {
  return disclosureAbout(finding) !== undefined;
}

/**
 * The run split in two, ONCE, so no loop below has to remember the distinction.
 *
 * Both halves are returned rather than one filtered array, because the second
 * half is printed and served rather than discarded — the split is a routing
 * decision, not a filter, and a function that returned only the findings would
 * be the shape that loses the disclosure.
 */
export function partitionFindings(
  all: Finding[],
): { findings: Finding[]; disclosures: Finding[] } {
  return {
    findings: all.filter((f) => !isDisclosure(f)),
    disclosures: all.filter((f) => isDisclosure(f)),
  };
}

/**
 * The level tally — **of findings, and a disclosure is not one.**
 *
 * Filtered HERE rather than only at the call site, and that is deliberate
 * belt-and-braces: this function is exported, is called directly by tests, and
 * its three lines are duplicated verbatim in `read-model.ts`'s `health`. A
 * caller that forgot to partition first would report a note as a note-level
 * finding and put the count back on the screen the owner is clearing.
 *
 * **The exit code cannot move because of this.** `exitCode` reads
 * `counts.errors`, and it is not that all three disclosures happen to be `info`
 * today — it is that a disclosure states what a check could not measure, which
 * is never a corpus defect, so one may not be emitted at `error` in the first
 * place. Should one ever be, the arithmetic here removes it from `errors`
 * BEFORE `exitCode` sees it, which is the safe direction: a note has never
 * failed a build and must not start.
 */
export function summarize(findings: Finding[]): { errors: number; warnings: number; infos: number } {
  const real = findings.filter((f) => !isDisclosure(f));
  return {
    errors: real.filter((f) => f.level === 'error').length,
    warnings: real.filter((f) => f.level === 'warn').length,
    infos: real.filter((f) => f.level === 'info').length,
  };
}

/**
 * **How many of the findings above a person has already ruled on.**
 *
 * Reported BESIDE the three level counts — on the line under them
 * (`emitAcknowledged`) — and never subtracted from them. That arithmetic is the
 * owner's ruling made visible: an acknowledged finding is still a finding,
 * still counted, still there. The number says how much of the report is
 * SETTLED, which is the question a person opening a long doctor run actually
 * has; it does not shrink the report.
 *
 * `0` prints nothing, and `emitAcknowledged` says why.
 */
export function acknowledgedCount(findings: Finding[]): number {
  return findings.filter((f) => f.acknowledged === true).length;
}

/**
 * The one word that distinguishes an acknowledged finding, wherever a finding
 * is printed. Every detail level shows it, because a state that is invisible
 * at the level somebody actually reads is a state nobody can act on — and a
 * reader who cannot tell the two apart is back where the ruling started.
 */
function mark(finding: Finding): string {
  return finding.acknowledged === true ? '  [acknowledged]' : '';
}

/**
 * **The acknowledged tally, on its own WRAPPED line under the summary — not
 * appended to it.**
 *
 * The clause belongs beside the counts and it cannot live inside them, and the
 * reason is arithmetic rather than taste. `summary` is emitted unwrapped by
 * every detail level, and it is the exact line held by `every reporting command
 * fits the layout budget at every detail level` (output.test.ts) — whose own
 * comment records that the fixture "already sits near that budget before this
 * note is even considered". `my_context doctor: 0 error(s), 5 warning(s), 102
 * note(s) across 107 finding(s).` is 78 columns against a budget of 100, so a
 * sentence saying what "acknowledged" means overruns it on any corpus where one
 * exists.
 *
 * **And that overrun would be invisible to the test.** No fixture in this
 * repository carries an acknowledgement, so `--summary` would measure clean
 * forever while every real user with one read a wrapped-by-the-terminal line.
 * A separate `paragraph` line is inside the budget by construction and says the
 * whole thing rather than an abbreviation of it.
 *
 * Silent at zero — a clean corpus's summary block is pinned character for
 * character in three test files, and a line nobody can ever clear is the
 * failure `body_review_limits` and `checkCitationForm` both refuse.
 */
function emitAcknowledged(count: number, out: Emit): void {
  if (count === 0) return;
  for (const line of paragraph(
    `${count} of the finding(s) above are ACKNOWLEDGED: a person read each one and ruled on ` +
    `it. They are still reported and still counted in the numbers above — acknowledging a ` +
    `finding distinguishes it, it does not silence it, and editing the item lapses the ` +
    `acknowledgement so the finding is open again. \`mycontext ack <id> --list\` shows the ` +
    `state per item.`,
    'my_context: ', outputWidth(), '  ',
  )) out(line);
}

const ORDER: Record<Finding['level'], number> = { error: 0, warn: 1, info: 2 };

/**
 * `checkCliOnPath`'s result (at most one `Finding`), printed as its own
 * block in the two detail levels that show individual findings at all —
 * never folded into the `records`/grouped-by-code loops above it, and never
 * counted toward "N finding(s)" in the summary, for the reasons on
 * `runChecks`'s own doc comment (checks.ts) and on `cliFindings` above.
 * `--summary`/`--quiet` never call this — see `cliNote` on why that level
 * stays silent for anything short of the error state.
 */
function emitCliPathFinding(cliFindings: Finding[], out: Emit): void {
  if (!cliFindings.length) return;
  const f = cliFindings[0]!;
  out('');
  out(`mycontext (the command, not a corpus finding): ${f.code}  [${f.level}]`);
  for (const line of paragraph(f.message, '  ', outputWidth(), '    ')) out(line);
}

/**
 * **The disclosures, printed under their code's headings, AFTER the summary —
 * as notes, not as a section of the report.**
 *
 * Position is the argument. `emitCliPathFinding` established this exact place
 * and this exact reason one field over: a fact that is real, worth printing and
 * NOT a corpus finding goes after the count rather than inside it, so the
 * number a reader takes away is the number of things to do. A disclosure is the
 * second member of that class, and it gets the second block rather than a
 * second convention.
 *
 * **Grouped by code, one heading, every message under it.** `state_audit_coverage`
 * can speak twice in one run — once for the tasks the log never saw, once for
 * the tasks born before the witness — and those are two facts under one code,
 * which is exactly what the grouped level does with findings. Two headings for
 * one code would read as two problems.
 *
 * **The heading names the CHECK, because that is what the note is about.**
 * `state_audit_coverage — about the state_unaudited check` tells a reader what
 * the sentence below is limiting; the code alone tells them nothing they can
 * use. Both are printed, so nothing is lost to grep either way.
 *
 * Everything wraps through `paragraph` at `outputWidth()`, for the reason the
 * grouped level does: these are the longest sentences this command prints, and
 * `every reporting command fits the layout budget at every detail level`
 * (output.test.ts) measures them.
 *
 * Silent at zero, which is this command's own convention for a line nobody can
 * clear — `emitAcknowledged`, `checkCitationForm` and `checkAuditSize` all take
 * it, and a clean corpus's summary block is pinned character for character in
 * three test files.
 */
function emitDisclosures(disclosures: Finding[], out: Emit): void {
  if (!disclosures.length) return;
  const byCode = new Map<string, Finding[]>();
  for (const finding of disclosures) {
    const bucket = byCode.get(finding.code) ?? [];
    bucket.push(finding);
    byCode.set(finding.code, bucket);
  }
  out('');
  for (const line of paragraph(
    `notes about the checks themselves — what they could not measure, said once. ` +
    `These are NOT findings, are not counted above, and nothing is owed on them.`,
    'my_context: ', outputWidth(), '  ',
  )) out(line);
  for (const [code, bucket] of [...byCode.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    out('');
    const about = disclosureAbout(bucket[0]!);
    out(`  ${code} — about the \`${about}\` check`);
    for (const finding of bucket) {
      for (const line of paragraph(finding.message, '    ', outputWidth(), '    ')) out(line);
    }
  }
}

/**
 * The exit-code mapping, pinned as its own pure function so it can be
 * tested directly per level rather than only inferred from CLI output.
 * `0` when there is no `error`-level finding AND no unrelated load error;
 * `1` otherwise. `warn` and `info` findings never fail the build on their
 * own — see the brief: "a dead glob is worth surfacing but must not break
 * someone's CI on the day they rename a directory." A load error (a file
 * `runChecks` never even got to examine) is treated the same as an
 * `error`-level finding, because doctor's whole job is reporting corpus
 * health and an unparseable file is not a healthy corpus.
 */
export function exitCode(counts: { errors: number; warnings: number; infos: number }, loadErrorCount: number): number {
  return counts.errors > 0 || loadErrorCount > 0 ? 1 : 0;
}

function cmdDoctor(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  // An unrecognized flag NAME, refused before the corpus is opened — see
  // `unknownFlag` (format.ts). `mycontext doctor --jso` used to run every
  // check and print the ordinary text report, so a CI job that meant to parse
  // JSON got prose and a green exit code.
  const doctorUsage = `usage: mycontext doctor [--quiet] ${DETAIL_USAGE}`;
  if (refuseUnknownFlag(args, ALLOWED, VALUE_FLAGS, doctorUsage, out)) return 1;

  // Parsed BEFORE the corpus is opened: a malformed `--full=maybe` must
  // refuse without doing minutes of work first, and `hasFlag`/`detailLevel`
  // now throw on one rather than silently choosing an answer.
  let detail: Detail;
  let json: boolean;
  try {
    // `--quiet` predates the detail levels and stays as a synonym for
    // `--summary` — it is in shipped usage strings and possibly in someone's
    // CI. Passing both is not a conflict: they ask for the same thing.
    detail = hasFlag(args, 'quiet') ? 'summary' : detailLevel(args);
    json = wantsJson(args);
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }

  const { ctx, errors: rawErrors } = openMutateContext(ws);
  let items: Item[];
  try {
    // `ctx.store.all()` is the full, merged cross-layer item set (project +
    // global), not just `ws.projectRoot`'s own items — `openMutateContext`
    // always rebuilds against both roots before returning. Feeding
    // `runChecks` anything narrower would make `checkOrphanRelations`
    // false-fire on every relation that legitimately points at a
    // global-layer item, per checks.ts's own doc comment on that function.
    items = ctx.store.all();
  } catch (err) {
    ctx.store.close();
    out(toCliMessage(err));
    return 1;
  }

  // Close the writable connection BEFORE `runChecks`, never inside a `finally`
  // after it — the same ordering, for the same reason, that `cmdStatus`
  // already carries a comment about (status.ts). `checkIndexFreshness` stats
  // `ws.dbPath`'s mtime, and SQLite in WAL mode only checkpoints the
  // write-ahead log back into the main database file on close, so running the
  // checks through a still-open connection sees a pre-rebuild mtime and
  // reports the index as stale on a corpus that was just rebuilt by this very
  // invocation. Reproduced before this reordering: on a byte-identical corpus
  // `doctor` printed one more warning than `status` did, plus a spurious
  // "Run `mycontext rebuild`" that a second `doctor` run would not repeat.
  ctx.store.close();

  // A checksum mismatch whose recorded basis version differs from
  // `CHECKSUM_BASIS_VERSION` (item.ts) is a benign migration, not corruption
  // — see `LoadError.kind` (rebuild.ts). Split those out of the load-error
  // set BEFORE anything below counts `errors.length` toward "corpus load
  // errors" or the exit code: `checksumMigrationFindings` turns them into
  // `warn`-level findings instead, reported alongside every other finding
  // rather than in the block that means "this corpus failed to load".
  // Nothing is dropped either way — every migration mismatch still reaches
  // the user, just not labelled as corruption.
  const errors = rawErrors.filter((e) => e.kind !== 'migration');
  const migrationFindings = checksumMigrationFindings(rawErrors);

  // **Split before anything counts, prints or serves.** `partitionFindings`
  // routes the notes a check makes about ITSELF out of the worklist and into
  // `emitDisclosures` below — see its docblock, and `disclosureAbout` for the
  // owner report. `findings` from here down means what it has always meant to
  // every line under it: the things a person could do something about.
  const { findings, disclosures } = partitionFindings([
    ...runChecks({
      root: ws.projectRoot,
      repoRoot: path.dirname(ws.projectRoot),
      dbPath: ws.dbPath,
      items,
      config: ws.config,
    }),
    ...migrationFindings,
  ]);

  // `checkCliOnPath` deliberately runs OUTSIDE `runChecks` — see the long
  // comment on `runChecks` itself for why: it answers a question about this
  // MACHINE, not this corpus, and folding it into `findings`/`counts` would
  // make "this corpus is clean" depend on whether the box asking has this
  // package linked. `mycontext doctor` is the one place it is reported at
  // all; `checkCliOnPath` itself never throws (every failure mode inside it
  // already becomes an `info` finding), but the same defensive stance
  // `runChecks` takes with every OTHER check applies here too — a check
  // failing must never crash the command reporting it.
  let cliFindings: Finding[];
  try {
    cliFindings = checkCliOnPath();
  } catch (err) {
    cliFindings = [{
      level: 'info', code: 'cli_lookup_failed',
      message:
        `the \`mycontext\`-on-PATH check itself failed unexpectedly: ` +
        `${err instanceof Error ? err.message : String(err)}.`,
      // The SAME remedy `checkCliOnPath` declares for this code, taken from
      // `REMEDY` rather than written out again: two spellings of what settles
      // one code is exactly the UI-side table this field replaced.
      remedy: REMEDY.NOTHING,
    }];
  }
  // Only the WORST of the three states — PATH resolves to a different CLI —
  // moves the exit code. "Not on PATH at all" and "found, but unverifiable"
  // are both real facts worth reporting, but neither is a corpus defect, and
  // `warn`/`info` never fail the build on their own anywhere else in this
  // command either.
  const cliError = cliFindings.find((f) => f.level === 'error');

  const counts = summarize(findings);
  const failed = exitCode(counts, errors.length) === 1 || cliError !== undefined;

  // The summary line counts corpus LOAD errors alongside the findings, because
  // `exitCode` above counts them too. Before this, `counts.errors` alone was
  // printed while `errors.length` alone decided the exit code, so a run with
  // one unparseable item printed "0 error(s) … across 0 finding(s)" — a line
  // that reads clean in a CI log tail — and then exited 1. The number a human
  // reads and the number a machine reads now come from the same arithmetic.
  const totalErrors = counts.errors + errors.length;
  const loadErrorNote = errors.length
    ? ` ${errors.length} of the error(s) are corpus load errors, listed below, not findings.`
    : '';
  // Deliberately silent for the `warn` and `info` cli-path states, even here
  // in the one-line summary every detail level shares: this is exactly the
  // line width-tested by `every reporting command fits the layout budget at
  // every detail level` (output.test.ts), and its fixture already sits near
  // that budget before this note is even considered — nothing safely fits
  // beside it there. `error` is the one state where staying silent would
  // recreate the exact bug this file's own history already fixed once ("0
  // error(s) … across 0 finding(s)" printed above a run that exits 1) — so
  // it alone gets a clause, the same way `loadErrorNote` does.
  const cliNote = cliError
    ? ` mycontext resolves to a DIFFERENT CLI on PATH (${cliError.code}) — see \`mycontext doctor --full\`.`
    : '';
  const acknowledged = acknowledgedCount(findings);
  const summary =
    `my_context doctor: ${totalErrors} error(s), ${counts.warnings} warning(s), ` +
    `${counts.infos} note(s) across ${findings.length} finding(s).${loadErrorNote}${cliNote}`;

  if (json) {
    // `exitCode` is reported as data as well as returned, so a consumer that
    // pipes this document does not have to re-derive the mapping (and cannot
    // get it wrong) — and `loadErrors` travels inside the document rather
    // than as a trailing text line that would make it unparseable.
    //
    // `counts` is the FINDINGS tally and nothing else — that is what
    // `summarize` computes and what every existing consumer reads from this
    // field, so its meaning is left alone. But `counts.errors: 0` sitting
    // beside `exitCode: 1` is the same trap the text summary had (a document
    // that reads clean next to a failing exit code), so the two numbers the
    // exit code is actually derived from are carried explicitly alongside it:
    // `loadErrorCount`, and `totalErrors`, which is what the text summary
    // prints. `totalErrors > 0` iff `exitCode === 1`.
    emitJson(out, {
      counts,
      loadErrorCount: errors.length,
      totalErrors,
      // Carried explicitly, for the reason `totalErrors` is: a consumer must
      // not have to re-derive from `findings` a number the text summary prints,
      // and re-deriving is where two surfaces disagree. `counts` stays the
      // level tally it has always been — an acknowledged finding is counted in
      // it, exactly as it is counted in the text.
      acknowledgedCount: acknowledged,
      exitCode: failed ? 1 : 0,
      findings,
      // **Carried under its own key rather than folded into `findings`**, which
      // is the choice `cliOnPath` two fields down already made and for the
      // identical reason: `counts` and `findings` are the FINDINGS tally and
      // list, whole and untouched, and a consumer that gates CI on
      // `findings.length` must not be handed a note. Always an array, never
      // omitted, so "checked, none" is distinguishable from a field an older
      // build never populated — and `INV-nothing-is-dropped-silently` is
      // satisfied by the text being HERE, not by it being counted.
      disclosures,
      loadErrors: errors.map((e) => ({ file: e.file, message: e.message })),
      // Carried under its own key rather than folded into `findings` — see
      // the comment on `cliFindings` above for why: it is not a corpus
      // finding, and `counts`/`findings` here are the FINDINGS tally, whole
      // and untouched, exactly like every other field on this document.
      // `null` (not `[]` or omitted) when the check found nothing to report,
      // so a consumer can tell "checked, healthy" apart from a field that
      // was never populated.
      cliOnPath: cliFindings[0] ?? null,
    });
    return failed ? 1 : 0;
  }

  if (detail === 'summary') {
    out(summary);
    emitAcknowledged(acknowledged, out);
    emitLoadErrors(errors, out);
    return failed ? 1 : 0;
  }

  if (detail === 'full') {
    // One STANZA per finding, with its level and code on the heading line
    // rather than on a group heading above it: this is still the shape to
    // grep, sort or paste into an issue, where the grouped view below is the
    // one to read.
    //
    // A stanza (`records`) rather than the four-column table this used to be,
    // for the same arithmetic that moved `review list --full` (output.test.ts)
    // and `list --full` (`records` in format.ts) to this shape. A table can
    // never be narrower than the sum of its columns' longest tokens, and an id
    // is one token: `level` + `code` + the widest id this project can mint is
    // 103 columns before a `message` column is considered at all, and a doctor
    // message is a paragraph, not a word. The table measured 548 columns.
    // Here the id costs one labelled line and the message wraps.
    for (const line of records(
      ['finding', 'item', 'message'],
      [...findings]
        .sort((a, b) => ORDER[a.level] - ORDER[b.level] || a.code.localeCompare(b.code))
        .map((f) => [`${f.level}  ${f.code}${mark(f)}`, f.item ?? '-', f.message]),
    )) out(line);
    if (findings.length) out('');
    out(summary);
    emitAcknowledged(acknowledged, out);
    emitLoadErrors(errors, out);
    emitDisclosures(disclosures, out);
    emitCliPathFinding(cliFindings, out);
    return failed ? 1 : 0;
  }

  const grouped = new Map<string, Finding[]>();
  for (const finding of findings) {
    const bucket = grouped.get(finding.code) ?? [];
    bucket.push(finding);
    grouped.set(finding.code, bucket);
  }

  const codes = [...grouped.entries()].sort((a, b) => {
    const byLevel = ORDER[a[1][0].level] - ORDER[b[1][0].level];
    return byLevel !== 0 ? byLevel : a[0].localeCompare(b[0]);
  });

  for (const [code, bucket] of codes) {
    // The group heading carries how many of ITS OWN findings are settled, so a
    // reader deciding which of eleven codes to open can see that one of them is
    // entirely ruled on without expanding it. The bucket total is unchanged.
    const settled = bucket.filter((f) => f.acknowledged === true).length;
    const settledNote = settled ? `  ${settled} acknowledged` : '';
    out(`${code} (${bucket.length})  [${bucket[0].level}]${settledNote}`);
    for (const finding of bucket) {
      // Wrapped to the layout budget, exactly as `status` and `decay` wrap
      // their own prose, and with a hanging indent so a message that takes
      // four lines still reads as ONE finding. Unwrapped, these were the
      // widest lines this program printed: a doctor message is a paragraph
      // with an id in front of it, so at the widest id this project can mint
      // the default level measured 513 columns against a budget of 100.
      for (const line of paragraph(
        `${finding.item ? `${finding.item}: ` : ''}${finding.acknowledged === true ? 'ACKNOWLEDGED — ' : ''}${finding.message}`,
        '  ', outputWidth(), '    ',
      )) out(line);
    }
    out('');
  }

  out(summary);
  emitAcknowledged(acknowledged, out);
  emitLoadErrors(errors, out);
  emitDisclosures(disclosures, out);
  emitCliPathFinding(cliFindings, out);
  return failed ? 1 : 0;
}

registerCommand({
  name: 'doctor',
  usage: `doctor [--quiet] ${DETAIL_USAGE}`,
  summary: 'self-check: index freshness, orphans, drift, dead globs, permissions, session ids',
  run: cmdDoctor,
});
