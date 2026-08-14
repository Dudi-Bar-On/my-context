import path from 'node:path';
import { runChecks, type Finding } from '../../doctor/checks.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext } from './context.ts';
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

  const { ctx, errors } = openMutateContext(ws);
  let findings: Finding[];
  try {
    // `ctx.store.all()` is the full, merged cross-layer item set (project +
    // global), not just `ws.projectRoot`'s own items — `openMutateContext`
    // always rebuilds against both roots before returning. Feeding
    // `runChecks` anything narrower would make `checkOrphanRelations`
    // false-fire on every relation that legitimately points at a
    // global-layer item, per checks.ts's own doc comment on that function.
    findings = runChecks({
      root: ws.projectRoot,
      repoRoot: path.dirname(ws.projectRoot),
      dbPath: ws.dbPath,
      items: ctx.store.all(),
    });
  } finally {
    ctx.store.close();
  }

  const counts = summarize(findings);
  const summary =
    `my_context doctor: ${counts.errors} error(s), ${counts.warnings} warning(s), ` +
    `${counts.infos} note(s) across ${findings.length} finding(s).`;

  const failed = exitCode(counts, errors.length) === 1;

  if (hasFlag(args, 'quiet')) {
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
      out(`  ${finding.item ? `${finding.item}: ` : ''}${finding.message}`);
    }
    out('');
  }

  out(summary);
  emitLoadErrors(errors, out);
  return failed ? 1 : 0;
}

registerCommand({
  name: 'doctor',
  usage: 'doctor [--quiet]',
  summary: 'self-check: index freshness, orphans, drift, dead globs, permissions',
  run: cmdDoctor,
});
