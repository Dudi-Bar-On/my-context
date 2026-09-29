/**
 * **The one walk every scanner in this directory uses, and the one place the
 * rule behind it is written down.**
 *
 * `TASK-a-scanner-enumerates-what-it-will-skip-not-what-it-will-scan`: a
 * scanner enumerates what it will SKIP, not what it will SCAN. Five gates here
 * were the same defect in five spellings — `DIRS`, `ROOTS`, `SCANNED_FILES`,
 * two `SOURCE_ROOTS` — each an allow-list of directories that answered "no
 * problem" for everything outside it, and each repaired in the past by ADDING
 * ONE ENTRY. `check-text-files.ts` records that repair happening to it and
 * calls it a defect; `verify-citations.ts` records `e2e` joining its list on
 * 2026-08-29 for exactly the same reason.
 *
 * **Adding an entry is not the repair, and neither is copying this function
 * five times.** The first round of this task inverted four of the five and
 * left four hand-copied `git ls-files` calls behind — four things that must be
 * edited together, which `check-dependency-budget.ts` already names as the
 * defect it is: *"two lists that must be edited together are two lists that
 * will disagree."* This module is the answer to both halves.
 *
 * THE CONVENTION, in three parts, and every gate here owes all three:
 *
 *   1. **The population is what git tracks.** Not a directory list. Tracked is
 *      the right frame because the defect every one of these gates exists for
 *      — a lost diff, a stale citation, a rule applied to unreadable text — is
 *      a defect in something git diffs.
 *   2. **It fails CLOSED.** `git ls-files` failing THROWS. A scanner that
 *      reports "0 files, nothing wrong" because it could not look is the exact
 *      shape `INV-nothing-is-dropped-silently` refuses, and this project has
 *      been bitten by the vacuous pass in six other forms.
 *   3. **Every skip carries a reason, and the reason is PRINTED.**
 *      `STD-a-measured-zero-is-drawn-and-named`. A count with no denominator
 *      reads the same whether a gate covered the repository or a third of it.
 *      `skipLines` is what makes the skip impossible to leave invisible.
 */
import { execFileSync } from 'node:child_process';

export interface Skip { file: string; why: string }
export interface Walk { scanned: string[]; skipped: Skip[] }

/**
 * A file this walk never sees, because git does not diff it. Stated as a
 * constant so every gate prints the same sentence about the same absence
 * rather than four wordings of it.
 */
export const NOT_TRACKED =
  'untracked — git does not diff it, so the defect these gates exist for cannot reach it';

/**
 * Every file git tracks under `root`, repository-relative, with `/`
 * separators on every platform.
 *
 * Throws rather than returning `[]` — see part 2 of the convention above.
 */
export function trackedFiles(root: string): string[] {
  const out = execFileSync('git', ['-C', root, 'ls-files', '-z'], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const files = out.split('\0').filter((f) => f !== '');
  if (files.length === 0) {
    throw new Error(
      `my_context: git tracks no file under ${root}. This gate refuses to report a clean run `
      + 'over nothing — see INV-nothing-is-dropped-silently and scripts/tracked-walk.ts.',
    );
  }
  return files;
}

/**
 * Split a file list into what is read and what is declined, by a decision
 * function that returns THE REASON to skip a file, or `null` to scan it.
 *
 * A reason rather than a boolean, deliberately: a `false` is a skip nobody has
 * to justify, and an unjustified skip is what every member of this class was.
 */
export function partition(
  files: readonly string[], skipReason: (file: string) => string | null,
): Walk {
  const scanned: string[] = [];
  const skipped: Skip[] = [];
  for (const file of files) {
    const why = skipReason(file);
    if (why === null) scanned.push(file);
    else skipped.push({ file, why });
  }
  return { scanned, skipped };
}

/** `trackedFiles` and `partition` in one call, which is how every gate uses them. */
export function walkTracked(root: string, skipReason: (file: string) => string | null): Walk {
  return partition(trackedFiles(root), skipReason);
}

/**
 * The skips, grouped by reason, one line each, largest group first — and a
 * line naming what is not tracked at all.
 *
 * Grouped rather than listed: 2,055 skipped files printed one per line is a
 * wall, and the first thing that happens to a wall is that someone stops
 * reading it. The COUNT and the REASON are what a reader needs; `--json` on
 * the gates that have it carries the names.
 */
export function skipLines(skipped: readonly Skip[]): string[] {
  const byReason = new Map<string, number>();
  for (const s of skipped) byReason.set(s.why, (byReason.get(s.why) ?? 0) + 1);
  const lines = [...byReason]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([why, count]) => `  skipped ${count} — ${why}`);
  if (lines.length === 0) lines.push('  skipped: none — every tracked file was read.');
  lines.push(`  not tracked: ${NOT_TRACKED}.`);
  return lines;
}

/**
 * The whole disclosure: the headline a gate writes for itself, then what it
 * skipped and why. True on a green run and on a red one, which is the point.
 */
export function walkSummary(headline: string, walk: Walk): string {
  return [headline, ...skipLines(walk.skipped)].join('\n');
}
