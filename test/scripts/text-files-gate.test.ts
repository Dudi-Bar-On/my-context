// @basis TASK-a-scanner-enumerates-what-it-will-skip-not-what-it-will-scan, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **The NUL gate, held to the rule it was the first-named member of.**
 *
 * `TASK-a-scanner-enumerates-what-it-will-skip-not-what-it-will-scan` names
 * this script three times over — an extension allow-list of nine, a directory
 * allow-list of eight, and a blanket `startsWith('.')` skip that put
 * `.claude-plugin/` (which SHIPS, `package.json:files`) outside the gate. The
 * file's own docblock already recorded the same shape once, when `skills/` was
 * found outside it, and the repair chosen then was to add one entry.
 *
 * So what is proved here is the INVERSION, not another entry:
 *
 *   1. **The skip list is the declared thing.** `partition` is driven over a
 *      planted file list and every skipped path comes back carrying a reason.
 *      An extension nobody declared is SCANNED, which is the whole point: an
 *      unknown input is the one that needed the gate.
 *   2. **The scan really reaches what the allow-list excluded.** Standing
 *      assertions over this repository: a root file, a `.jsonl`, an `.svg`, a
 *      `.github/` workflow, a `.claude-plugin/` manifest and a `reports/`
 *      document are all in the scanned set. Every one of them was invisible to
 *      this gate before.
 *   3. **It still goes red**, proved by planting a NUL rather than by reading
 *      the code — including in a file whose extension the old shape did not
 *      know.
 *   4. **A measured zero is drawn and named** (`STD-a-measured-zero-is-drawn-
 *      and-named`): the summary states what was scanned AND what was skipped
 *      with why, so a skip cannot be silent again.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  BINARY_EXTENSIONS, SKIP_REASON_UNTRACKED,
  nulOffenders, partition, summarise, trackedFiles,
} from '../../scripts/check-text-files.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'check-text-files.ts');

function sandbox(): string {
  return mkdtempSync(path.join(tmpdir(), 'nul-gate-'));
}

test('an extension nobody declared is scanned, not waved through', () => {
  const { scanned, skipped } = partition([
    'src/a.ts', 'README.md', 'x.tsx', 'harness/evidence/a.jsonl',
    'src/ui/public/icons/i.svg', 'weird.qqq', 'LICENSE', '.githooks/pre-commit',
  ]);
  assert.deepEqual(skipped, [], 'nothing here is declared binary, so nothing may be skipped');
  assert.deepEqual(scanned.toSorted(), [
    '.githooks/pre-commit', 'LICENSE', 'README.md', 'harness/evidence/a.jsonl',
    'src/a.ts', 'src/ui/public/icons/i.svg', 'weird.qqq', 'x.tsx',
  ]);
});

test('a skipped file carries the reason it was skipped', () => {
  const { scanned, skipped } = partition(['src/a.ts', 'docs/shot.png', 'src/ui/f.woff2']);
  assert.deepEqual(scanned, ['src/a.ts']);
  assert.deepEqual(skipped.map((s) => s.file).toSorted(), ['docs/shot.png', 'src/ui/f.woff2']);
  for (const s of skipped) {
    assert.equal(typeof s.why, 'string');
    assert.ok(s.why.length > 0, `${s.file} was skipped with no reason`);
    assert.equal(s.why, BINARY_EXTENSIONS.get(path.extname(s.file)));
  }
});

test('the summary names what was scanned AND what was skipped, with why', () => {
  const line = summarise(
    ['src/a.ts', 'README.md'],
    [{ file: 'docs/shot.png', why: BINARY_EXTENSIONS.get('.png')! }],
  );
  assert.match(line, /2 scanned/);
  assert.match(line, /1 skipped/);
  assert.match(line, /\.png/);
  assert.match(line, new RegExp(BINARY_EXTENSIONS.get('.png')!.split(' ')[0]));
  assert.match(line, new RegExp(SKIP_REASON_UNTRACKED.split(' ')[0]));
});

test('a NUL is found in a file the old allow-list did not know', () => {
  const dir = sandbox();
  try {
    mkdirSync(path.join(dir, 'ui'), { recursive: true });
    writeFileSync(path.join(dir, 'ui', 'Panel.tsx'), "const s = 'a\u0000b';\n");
    writeFileSync(path.join(dir, 'README.md'), 'clean\n');
    writeFileSync(path.join(dir, 'notes.jsonl'), '{"a":"\u0000"}\n');
    const found = nulOffenders(dir, ['ui/Panel.tsx', 'README.md', 'notes.jsonl']);
    assert.deepEqual(found.map((o) => o.file).toSorted(), ['notes.jsonl', 'ui/Panel.tsx']);
    assert.equal(found.find((o) => o.file === 'ui/Panel.tsx')!.offset, 12);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a declared binary file is not read for NULs at all', () => {
  const dir = sandbox();
  try {
    writeFileSync(path.join(dir, 'shot.png'), Buffer.from([0x89, 0x50, 0x00, 0x01]));
    const { scanned, skipped } = partition(['shot.png']);
    assert.deepEqual(scanned, []);
    assert.deepEqual(nulOffenders(dir, scanned), []);
    assert.equal(skipped.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * The standing assertions. These are about THIS repository, and they are the
 * ones that would have caught the three sites the item names: every path below
 * was outside `DIRS`/`EXTENSIONS` and is inside the scan now.
 */
test('the scan reaches every tree the allow-list excluded', () => {
  const { scanned, skipped } = partition(trackedFiles(REPO));
  const set = new Set(scanned);

  for (const file of ['README.md', 'package.json', 'CHANGELOG.md', 'tsconfig.json']) {
    assert.ok(set.has(file), `${file} is a root file and must be scanned`);
  }
  const has = (pred: (f: string) => boolean, what: string): void => {
    assert.ok(scanned.some(pred), `no ${what} is in the scanned set`);
  };
  has((f) => f.startsWith('.github/'), '.github/ file');
  has((f) => f.startsWith('.claude-plugin/'), '.claude-plugin/ file (it ships)');
  has((f) => f.startsWith('reports/'), 'reports/ document');
  has((f) => f.startsWith('.my_context/'), 'corpus item');
  has((f) => f.endsWith('.jsonl'), '.jsonl file');
  has((f) => f.endsWith('.svg'), '.svg file');

  // Anti-vacuity. The old shape scanned 503 files; a scan that collapsed back
  // to a handful would pass every assertion above and mean nothing.
  assert.ok(scanned.length > 2000, `only ${scanned.length} file(s) scanned`);
  // And the skip list is small, declared, and reasoned.
  for (const s of skipped) {
    assert.ok(BINARY_EXTENSIONS.has(path.extname(s.file)), `${s.file} skipped without a rule`);
  }
});

test('the real script runs green over this repository and says what it skipped', () => {
  const out = execFileSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
  assert.match(out, /scanned/);
  assert.match(out, /skipped/);
  assert.match(out, /\.png/, 'the skipped extensions must be named in the summary');
});
