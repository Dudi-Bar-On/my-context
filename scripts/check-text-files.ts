/**
 * Refuse a source or test file that git would classify as BINARY.
 *
 * This has now happened twice, in two different test files, written by two
 * different hands: a raw NUL byte inside a string fixture — `'CONST-x\0'`,
 * `'not json {{{ \0 ]]'` — testing something entirely reasonable. A NUL is fair
 * input for a parser and the tests were right to send one. Only the
 * REPRESENTATION was wrong.
 *
 * What it costs is out of all proportion to the typo. Git decides a blob is
 * binary by looking for a NUL in its first 8000 bytes, so the whole file stops
 * diffing: `Bin 12222 -> 16840 bytes`, nothing to review, and a merge conflict
 * in it is unresolvable. The first instance was found only by reading a diff
 * STAT, because the diff itself could not be rendered.
 *
 * The fix in both cases was one escape — `\u0000` — with the string the test
 * sends byte-identical either way. This checker is here so the third instance
 * is caught by CI rather than by someone noticing a strange line in a diff
 * stat.
 *
 * It checks the whole file rather than git's first 8000 bytes: a NUL past that
 * boundary is the same defect waiting for the file to be edited above it.
 *
 * ── WHAT THIS FILE USED TO DO, AND WHY IT NO LONGER DOES IT ────────────────
 *
 * **It enumerated what it would SCAN.** A `DIRS` list of eight roots, an
 * `EXTENSIONS` set of nine, and a blanket `entry.name.startsWith('.')` skip.
 * Everything else — a `.tsx`, a `.jsonl`, an `.svg`, every file at the
 * repository root including `README.md` and `package.json`, `.github/`, and
 * `.claude-plugin/` **which ships** (`package.json:files`) — was answered "no
 * problem" by a gate that had never looked at it.
 *
 * The docblock above already recorded this failure once: `skills/` sat outside
 * the gate for exactly this reason, and the repair chosen then was to ADD ONE
 * ENTRY. That repair does not generalise, and
 * `TASK-a-scanner-enumerates-what-it-will-skip-not-what-it-will-scan` is the
 * ruling that says so — **a scanner enumerates what it will skip, not what it
 * will scan.**
 *
 * So the shape is inverted. The population is every file GIT TRACKS, which is
 * exactly the population whose diffs this defect destroys, and the only things
 * removed from it are the extensions declared binary BY DESIGN in
 * `BINARY_EXTENSIONS` below — each with the reason it is there, each counted
 * and named in the summary. An extension nobody has declared is SCANNED. A new
 * binary format therefore arrives as a red gate demanding a declaration, which
 * is the direction a gate is supposed to fail.
 *
 * An untracked file is skipped for a reason that is not a judgement about it:
 * git does not diff it, so the defect this gate exists for cannot reach it.
 * That is stated in the summary too (`SKIP_REASON_UNTRACKED`) rather than left
 * for a reader to infer from a count.
 *
 * Verified by making it fail — a NUL planted in `skills/mycontext/SKILL.md`
 * passed the old shape with 503 files scanned and failed with 504; the widened
 * shape found a real NUL in `reports/uiux/sketches/03-interaction.html` that
 * the old one could not see. `test/scripts/text-files-gate.test.ts` holds both
 * halves.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainEntry } from '../src/core/paths.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The ONLY things this gate declines to read, and the reason each one is here.
 *
 * A reason is required, not decorative: it is printed in the summary, so a
 * skip cannot become invisible the way `DIRS` and `EXTENSIONS` were. Anything
 * absent from this map is scanned — including an extension nobody has seen
 * before, which is the input that needed the gate.
 */
export const BINARY_EXTENSIONS: ReadonlyMap<string, string> = new Map([
  ['.png', 'a raster image — NUL bytes are its format, not a typo'],
  ['.jpg', 'a raster image — NUL bytes are its format, not a typo'],
  ['.jpeg', 'a raster image — NUL bytes are its format, not a typo'],
  ['.gif', 'a raster image — NUL bytes are its format, not a typo'],
  ['.webp', 'a raster image — NUL bytes are its format, not a typo'],
  ['.ico', 'a raster image — NUL bytes are its format, not a typo'],
  ['.pdf', 'a binary document container'],
  ['.woff', 'a compressed font'],
  ['.woff2', 'a compressed font'],
  ['.ttf', 'a font'],
  ['.otf', 'a font'],
  ['.zip', 'a compressed archive'],
  ['.gz', 'a compressed archive'],
  ['.wasm', 'a compiled module'],
  ['.node', 'a compiled native addon'],
  ['.bundle', 'a git bundle — a packfile, binary by construction'],
]);

/** Why an untracked file is out of range: git never diffs it. */
export const SKIP_REASON_UNTRACKED =
  'untracked — git never diffs it, so the lost-diff defect cannot reach it';

export interface Skip { file: string; why: string }
export interface Offender { file: string; offset: number; context: string }

/**
 * Every file git tracks, repository-relative, with `/` separators on every
 * platform.
 *
 * Fails CLOSED. If `git ls-files` cannot answer, this THROWS rather than
 * returning `[]`: a scanner that reports "0 files scanned, none contains a
 * NUL" because it could not look is the exact failure
 * `INV-nothing-is-dropped-silently` refuses, and it is the failure that let
 * the previous shape pass while seeing a third of the tree.
 */
export function trackedFiles(root: string): string[] {
  const out = execFileSync('git', ['-C', root, 'ls-files', '-z'], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const files = out.split('\0').filter((f) => f !== '');
  if (files.length === 0) {
    throw new Error(
      `git tracks no file under ${root}. This gate refuses to report a clean scan of nothing — `
      + 'see INV-nothing-is-dropped-silently.',
    );
  }
  return files;
}

/** Split a tracked file list into what is read and what is declined, with why. */
export function partition(files: readonly string[]): { scanned: string[]; skipped: Skip[] } {
  const scanned: string[] = [];
  const skipped: Skip[] = [];
  for (const file of files) {
    const why = BINARY_EXTENSIONS.get(path.extname(file).toLowerCase());
    if (why === undefined) scanned.push(file);
    else skipped.push({ file, why });
  }
  return { scanned, skipped };
}

/** The files carrying a NUL, with the byte offset and the text around it. */
export function nulOffenders(root: string, files: readonly string[]): Offender[] {
  const offenders: Offender[] = [];
  for (const file of files) {
    let bytes;
    try {
      bytes = readFileSync(path.join(root, file));
    } catch {
      // A tracked path that cannot be read is not a pass. It is reported as
      // its own offender line rather than dropped, for the same reason the
      // skip list is printed: the only silent outcome this gate permits is a
      // file it actually read and found clean.
      offenders.push({ file, offset: -1, context: 'unreadable — this gate could not look at it' });
      continue;
    }
    const offset = bytes.indexOf(0);
    if (offset === -1) continue;
    const from = Math.max(0, offset - 40);
    const context = bytes.subarray(from, offset + 20).toString('utf8').replace(/\r?\n/g, '\\n');
    offenders.push({ file, offset, context });
  }
  return offenders;
}

/**
 * The one line that has to be true whether the run is red or green:
 * WHAT WAS SCANNED, and WHAT WAS SKIPPED WITH WHY.
 *
 * `STD-a-measured-zero-is-drawn-and-named`. The old summary said only
 * `503 text file(s) scanned`, which is a count with no denominator — it could
 * not distinguish a healthy repository from a gate pointed at a third of one.
 */
export function summarise(scanned: readonly string[], skipped: readonly Skip[]): string {
  const byExtension = new Map<string, { count: number; why: string }>();
  for (const s of skipped) {
    const ext = path.extname(s.file).toLowerCase();
    const row = byExtension.get(ext);
    if (row === undefined) byExtension.set(ext, { count: 1, why: s.why });
    else row.count += 1;
  }
  const lines = [
    `${scanned.length + skipped.length} tracked file(s): `
    + `${scanned.length} scanned for NUL bytes, ${skipped.length} skipped.`,
  ];
  if (byExtension.size === 0) {
    lines.push('  skipped: none — every tracked file was read.');
  } else {
    for (const [ext, row] of [...byExtension].sort((a, b) => b[1].count - a[1].count)) {
      lines.push(`  skipped ${row.count} × ${ext} — ${row.why}`);
    }
  }
  lines.push(`  not tracked: ${SKIP_REASON_UNTRACKED}.`);
  return lines.join('\n');
}

function main(): number {
  const files = trackedFiles(ROOT);
  const { scanned, skipped } = partition(files);
  const offenders = nulOffenders(ROOT, scanned);

  console.log('');
  for (const o of offenders) {
    if (o.offset === -1) {
      console.log(`UNREADABLE  ${o.file}`);
      console.log(`     ${o.context}`);
      continue;
    }
    console.log(`NUL  ${o.file}  at byte ${o.offset}`);
    console.log(`     …${o.context}…`);
    console.log(
      '     Write it as an escape instead. In a TypeScript string, `\\u0000` sends the '
      + 'same byte and leaves the file diffable.',
    );
  }

  console.log(summarise(scanned, skipped));
  if (offenders.length === 0) {
    console.log('none of them contains a NUL byte; every one of them still diffs.');
    return 0;
  }
  console.log(
    `${offenders.length} of them cannot be reviewed — git treats a file carrying a NUL as `
    + 'binary, so there is no diff, no review, and an unresolvable merge conflict.',
  );
  return 1;
}

if (isMainEntry(import.meta.filename, process.argv[1])) process.exit(main());
