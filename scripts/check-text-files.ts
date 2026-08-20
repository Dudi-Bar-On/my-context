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
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['src', 'test', 'scripts', 'commands', 'docs', 'hooks', 'e2e'];
const EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.json', '.md', '.html', '.css', '.yml', '.yaml']);

function* walk(dir: string): Generator<string> {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      yield* walk(full);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

const offenders: { file: string; offset: number; context: string }[] = [];
let scanned = 0;

for (const dir of DIRS) {
  const abs = path.join(ROOT, dir);
  try { statSync(abs); } catch { continue; }
  for (const file of walk(abs)) {
    scanned += 1;
    const bytes = readFileSync(file);
    const offset = bytes.indexOf(0);
    if (offset === -1) continue;
    const from = Math.max(0, offset - 40);
    const context = bytes.subarray(from, offset + 20).toString('utf8').replace(/\r?\n/g, '\\n');
    offenders.push({ file: path.relative(ROOT, file), offset, context });
  }
}

console.log('');
if (offenders.length === 0) {
  console.log(`${scanned} text file(s) scanned: none contains a NUL byte.`);
  console.log('every one of them still diffs.');
  process.exit(0);
}

for (const o of offenders) {
  console.log(`NUL  ${o.file}  at byte ${o.offset}`);
  console.log(`     …${o.context}…`);
  console.log(
    '     Write it as an escape instead. In a TypeScript string, `\\u0000` sends the '
    + 'same byte and leaves the file diffable.',
  );
}
console.log('');
console.log(
  `${scanned} text file(s) scanned: ${offenders.length} contain(s) a NUL byte, so git treats `
  + 'them as binary — no diff, no review, and an unresolvable merge conflict.',
);
process.exit(1);
