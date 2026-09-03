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

export function summarize(findings: Finding[]): { errors: number; warnings: number; infos: number } {
  return {
    errors: findings.filter((f) => f.level === 'error').length,
    warnings: findings.filter((f) => f.level === 'warn').length,
    infos: findings.filter((f) => f.level === 'info').length,
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

  const findings = [
    ...runChecks({
      root: ws.projectRoot,
      repoRoot: path.dirname(ws.projectRoot),
      dbPath: ws.dbPath,
      items,
      config: ws.config,
    }),
    ...migrationFindings,
  ];

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
  emitCliPathFinding(cliFindings, out);
  return failed ? 1 : 0;
}

registerCommand({
  name: 'doctor',
  usage: `doctor [--quiet] ${DETAIL_USAGE}`,
  summary: 'self-check: index freshness, orphans, drift, dead globs, permissions, session ids',
  run: cmdDoctor,
});
