// @basis TASK-seven-gates-cannot-be-shown-to-go-red-and-one-of-them-has-no, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { removeTree } from './helpers/tmp.ts';

/**
 * Structural guard for the temp-cleanup flake, in the shape this ledger says
 * these fixes have to take: not "fix the call sites the flake happened to
 * land on", but make there be ONE place and fail if a call site stops using
 * it.
 *
 * The defect: 403 test call sites ended with a bare
 * `rmSync(dir, { recursive: true, force: true })`. `force: true` suppresses
 * "does not exist" and nothing else — `maxRetries` defaults to 0 — so on
 * Windows any still-open handle inside the tree (SQLite's `-wal`/`-shm`
 * released asynchronously after `close()`, a spawned child's cwd, Defender)
 * threw `EPERM` from a cleanup line and failed whichever test was unlucky.
 * Measured: 1 failure in 5 full-suite runs, on a test that touches neither
 * SQLite nor child processes. A red suite makes every mutation reading
 * worthless, so this is a hole in the suite's whole purpose, not cosmetic.
 *
 * `test/helpers/tmp.ts`'s `removeTree` is the one owner. This test is what
 * stops the 404th call site from being written by hand.
 *
 * ── WHAT WAS WRONG WITH IT, AND WHAT IS DIFFERENT NOW ───────────────────────
 *
 * It was one of five gates in this suite with no positive control, and it had
 * two ways of reporting green over a defect:
 *
 *  - **The scan was per LINE.** A call broken across lines —
 *    `rmSync(dir, {` newline `recursive: true, force: true })`, which is how
 *    this repository's own formatter breaks a long one — was invisible. The
 *    scan now runs over the whole file with comments blanked, so a call is
 *    found wherever its two halves sit.
 *  - **Nothing proved it could find anything.** A regex that silently stopped
 *    matching reported zero offenders over every test file in the tree and
 *    read exactly like a clean bill of health. There is now a file-count floor
 *    and a PLANTED control: a synthetic offender the scanner must name, and a
 *    synthetic `removeTree` call it must not.
 */

const TEST_ROOT = fileURLToPath(new URL('.', import.meta.url));
/** The helper itself is the one legitimate caller. */
const OWNER = path.join('helpers', 'tmp.ts');
/**
 * This file, exempt from its own scan — because the planted control below is a
 * real offending call held in a string literal, and a scanner that masks
 * comments but not strings must see it.
 *
 * The exemption is not a hole, and the test below the scan is what makes that
 * true rather than a hope: this file never imports `rmSync`, so it cannot call
 * one however many it quotes.
 */
const SELF = fileURLToPath(import.meta.url);

function testFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) testFiles(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

/**
 * `source` with every comment blanked, newlines kept.
 *
 * Blanking rather than deleting, so a match index still maps to the right line
 * — and comments have to go, or this file's own explanation of the defect
 * above would be its first offender. Crude and exact for this tree: a `//` or
 * `/* ` inside a string literal would be over-blanked, and the guard below
 * proves that has not happened by requiring the scanner to still find a
 * planted call.
 */
function blankComments(source: string): string {
  const out = source.split('');
  const blank = (from: number, to: number): void => {
    for (let i = from; i < to && i < out.length; i++) if (out[i] !== '\n') out[i] = ' ';
  };
  for (let i = 0; i < source.length; i++) {
    // `:` before `//` is a URL scheme, never a comment. Without this line a
    // string holding `https://…` blanks the REST OF ITS LINE, and a real call
    // sitting after it on that line becomes invisible — a false negative
    // manufactured by the masker itself, which is the one thing a masker must
    // not do. `test/ui/no-writes.test.ts` carries a guard for the same class.
    if (source[i] === '/' && source[i + 1] === '/' && source[i - 1] !== ':') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      blank(i, stop);
      i = stop;
    } else if (source[i] === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      blank(i, stop);
      i = stop - 1;
    }
  }
  return out.join('');
}

export interface Offence { line: number; text: string }

/**
 * Every tree removal in `source` that asks for no retry budget.
 *
 * `[^)]*` crosses newlines in JavaScript, which is the whole repair: the call
 * is found whether it is written on one line or four.
 */
export function offences(source: string): Offence[] {
  const masked = blankComments(source);
  const lines = source.split('\n');
  const found: Offence[] = [];
  for (const m of masked.matchAll(/rmSync\s*\([^)]*recursive\s*:\s*true/g)) {
    const line = masked.slice(0, m.index).split('\n').length;
    found.push({ line, text: lines[line - 1]!.trim() });
  }
  return found;
}

test('no test file removes a tree with a bare rmSync — removeTree is the one owner', () => {
  const files = testFiles(TEST_ROOT);
  // The floor, derived from the tree on every run rather than pinned: a walk
  // that returned nothing reported zero offenders and read as success.
  assert.ok(
    files.length > 0,
    `no .ts files were found under ${TEST_ROOT}, so this scan examined nothing — the walk is `
    + 'broken, not the call sites',
  );

  const offenders: string[] = [];
  let scanned = 0;
  for (const file of files) {
    if (file.endsWith(OWNER) || file === SELF) continue;
    scanned++;
    for (const o of offences(readFileSync(file, 'utf8'))) {
      offenders.push(`${path.relative(TEST_ROOT, file)}:${o.line}: ${o.text}`);
    }
  }
  assert.ok(scanned > 0, 'every file was exempted, so nothing was scanned');
  assert.deepEqual(
    offenders, [],
    'these lines remove a directory tree without the retry budget Windows needs — import ' +
    '`removeTree` from `test/helpers/tmp.ts` instead:\n' + offenders.join('\n'),
  );
});

test('this file, which is exempt from its own scan, cannot call rmSync at all', () => {
  // The exemption above is only safe while this holds: a file that never
  // imports the function cannot call it, however many times it quotes one.
  const self = readFileSync(SELF, 'utf8');
  const imports = [...self.matchAll(/^import\s*\{([^}]*)\}\s*from\s*'node:fs';/gm)]
    .flatMap((m) => m[1]!.split(',').map((s) => s.trim()));
  assert.ok(imports.length > 0, 'this file imports nothing from node:fs, so the scan below is vacuous');
  assert.ok(
    !imports.includes('rmSync'),
    `this file imports rmSync (${imports.join(', ')}), so its exemption from its own scan is now a `
    + 'hole — use removeTree, or stop exempting this file',
  );
});

test('the scanner finds a PLANTED offender, on one line and across four', () => {
  // The positive control. Without it every assertion above is a claim about a
  // regex nobody has seen match. Both shapes, because the multi-line one is
  // the shape that was invisible until now.
  const oneLine = "  rmSync(dir, { recursive: true, force: true });\n";
  assert.deepEqual(offences(oneLine).map((o) => o.line), [1]);

  const wrapped = [
    'const x = 1;',
    'rmSync(dir, {',
    '  recursive: true,',
    '  force: true,',
    '});',
  ].join('\n');
  assert.deepEqual(
    offences(wrapped).map((o) => o.line), [2],
    'a call broken across lines is the shape the per-line scan could not see',
  );

  // Two in one file are both reported, so a file is never "already counted".
  assert.equal(offences(oneLine + oneLine).length, 2);
});

test('the scanner does NOT name what is legitimate, so the control above is not a rubber stamp', () => {
  // A proof that only ever fires is as useless as one that never does: these
  // are the four shapes the tree actually contains beside a real offence.
  assert.deepEqual(offences('removeTree(dir);\n'), []);
  assert.deepEqual(offences('rmSync(file);\n'), [], 'removing ONE file needs no retry budget');
  assert.deepEqual(
    offences('// rmSync(dir, { recursive: true, force: true });\n'), [],
    'a commented-out call is not a call — this file\'s own header would be offender number one',
  );
  assert.deepEqual(
    offences('/**\n * rmSync(dir, { recursive: true })\n */\n'), [],
    'the same, in a block comment',
  );
});

test('the masker does not blank a line because a URL happens to be on it', () => {
  // The guard against the masker MANUFACTURING a false negative. `https://`
  // holds a `//`, and a masker that read it as a comment start would blank the
  // rest of that line — including a real call sitting after it. A scanner made
  // blind by its own preprocessing is the worst shape here: it reports zero
  // and is correct about everything it looked at.
  const line = "const doc = 'https://example.test/x'; rmSync(dir, { recursive: true });\n";
  assert.deepEqual(
    offences(line).map((o) => o.line), [1],
    'a URL in a string blanked the real call that followed it on the same line',
  );
});

test('removeTree actually asks for retries, which is the whole point of it existing', () => {
  // Without this the guard above is satisfied by a helper that forwards the
  // same bare options — one indirection, same flake.
  const source = readFileSync(path.join(TEST_ROOT, OWNER), 'utf8');
  assert.match(source, /maxRetries:\s*\d+/);
  assert.match(source, /retryDelay:\s*\d+/);
});

test('removeTree removes what it can, and does not throw at a caller when it cannot', () => {
  // Both halves. The first is the ordinary case and the reason the helper
  // exists at all; the second is the deliberate swallow, which is only
  // defensible if it is also reported — a helper that quietly ate every
  // failure would hide a real handle leak.
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-removetree-'));
  writeFileSync(path.join(dir, 'a.txt'), 'x', 'utf8');
  removeTree(dir);
  assert.equal(existsSync(dir), false, 'the ordinary case must still actually delete');

  // A path that cannot be removed: a file where a directory is expected, so
  // the recursive removal fails with ENOTDIR rather than being retried away.
  const base = mkdtempSync(path.join(tmpdir(), 'myctx-removetree-'));
  const notADir = path.join(base, 'file');
  writeFileSync(notADir, 'x', 'utf8');
  assert.doesNotThrow(
    () => removeTree(path.join(notADir, 'child')),
    'a cleanup line must never be the thing that reddens an unrelated test',
  );
  removeTree(base);
});
