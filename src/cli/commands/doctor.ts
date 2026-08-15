import path from 'node:path';
import { runChecks, type Finding } from '../../doctor/checks.ts';
import type { Item } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext, toCliMessage } from './context.ts';
import {
  DETAIL_FLAGS, DETAIL_USAGE, detailLevel, emitJson, outputWidth, paragraph, records,
  refuseUnknownFlag, wantsJson, type Detail,
} from './format.ts';
import { hasFlag, registerCommand, type Emit } from './registry.ts';

export function summarize(findings: Finding[]): { errors: number; warnings: number; infos: number } {
  return {
    errors: findings.filter((f) => f.level === 'error').length,
    warnings: findings.filter((f) => f.level === 'warn').length,
    infos: findings.filter((f) => f.level === 'info').length,
  };
}

const ORDER: Record<Finding['level'], number> = { error: 0, warn: 1, info: 2 };

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
  if (refuseUnknownFlag(args, [...DETAIL_FLAGS, 'quiet'], [], doctorUsage, out)) return 1;

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

  const { ctx, errors } = openMutateContext(ws);
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

  const findings = runChecks({
    root: ws.projectRoot,
    repoRoot: path.dirname(ws.projectRoot),
    dbPath: ws.dbPath,
    items,
    config: ws.config,
  });

  const counts = summarize(findings);
  const failed = exitCode(counts, errors.length) === 1;

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
  const summary =
    `my_context doctor: ${totalErrors} error(s), ${counts.warnings} warning(s), ` +
    `${counts.infos} note(s) across ${findings.length} finding(s).${loadErrorNote}`;

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
      exitCode: failed ? 1 : 0,
      findings,
      loadErrors: errors.map((e) => ({ file: e.file, message: e.message })),
    });
    return failed ? 1 : 0;
  }

  if (detail === 'summary') {
    out(summary);
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
        .map((f) => [`${f.level}  ${f.code}`, f.item ?? '-', f.message]),
    )) out(line);
    if (findings.length) out('');
    out(summary);
    emitLoadErrors(errors, out);
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
    out(`${code} (${bucket.length})  [${bucket[0].level}]`);
    for (const finding of bucket) {
      // Wrapped to the layout budget, exactly as `status` and `decay` wrap
      // their own prose, and with a hanging indent so a message that takes
      // four lines still reads as ONE finding. Unwrapped, these were the
      // widest lines this program printed: a doctor message is a paragraph
      // with an id in front of it, so at the widest id this project can mint
      // the default level measured 513 columns against a budget of 100.
      for (const line of paragraph(
        `${finding.item ? `${finding.item}: ` : ''}${finding.message}`,
        '  ', outputWidth(), '    ',
      )) out(line);
    }
    out('');
  }

  out(summary);
  emitLoadErrors(errors, out);
  return failed ? 1 : 0;
}

registerCommand({
  name: 'doctor',
  usage: `doctor [--quiet] ${DETAIL_USAGE}`,
  summary: 'self-check: index freshness, orphans, drift, dead globs, permissions, session ids',
  run: cmdDoctor,
});
