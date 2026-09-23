// @basis TASK-release-phase-1-the-repository-tells-the-truth, TASK-gen-docs-is-not-idempotent-gen-diagrams-ts-renders-a
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * **Structural guard: no `test/**` file reaches for a browser.**
 *
 * CI run 35722957764 (commit `b791b437`), fix round 1 of `release/11`: both
 * jobs failed exactly one test —
 * `test/ui/diagram-determinism.test.ts:36`, `browserType.launch: Executable
 * doesn't exist at …/ms-playwright/chromium_headless_shell-…`. `npm test`
 * (`node --test`, over `test/**`) runs before the headless shell is installed
 * on the Ubuntu job, and the Windows job never installs one at all — only
 * `npm run test:e2e:install` does, and only `e2e/`'s Playwright suite runs
 * after it. `test/ui/github-render.test.ts` says the same thing structurally
 * in its own docblock: this repository deliberately keeps every Playwright
 * spec out of `test/`, because a Playwright spec is not a `node:test` file
 * and `scripts/check-test-glob.ts` would (separately) catch one placed here.
 *
 * The controller's ruling on that fix round: the byte-equality proof this
 * test guarded stays, but it moves to where a browser is guaranteed — it is
 * now `e2e/diagram-determinism.spec.ts`. This file is what stops it moving
 * back: the same mistake, made again by anyone (or anything) that does not
 * know the history above, is caught here rather than on the next CI run.
 *
 * ── WHAT IS SCANNED, AND WHY BOTH SHAPES ──────────────────────────────────
 *
 * Two independent ways a `test/**` file reaches a browser process, either one
 * sufficient to reproduce the CI failure on its own:
 *
 *   1. **Importing `playwright` or `@playwright/test`** — static
 *      (`from 'playwright'`) or dynamic (`import('playwright')`, the exact
 *      shape `drawAll` uses, since a bare `import` is a runtime statement and
 *      a static-only scan would miss it).
 *   2. **Calling the generator's own browser entry points** —
 *      `drawAll(…)` (`scripts/gen-diagrams.ts`) or `chromium.launch(…)`
 *      directly, either of which launches a browser even without an `import`
 *      line naming the package (`chromium` can arrive via a destructured
 *      dynamic import, as `drawAll` itself shows).
 *
 * Modelled on `test/no-bare-rmsync.test.ts`: comments are blanked before the
 * scan (so this file's own explanation, and every other file's, cannot
 * self-report), the walk has a floor so an empty result cannot be silently
 * "everything is fine", and the scanner is proved against both a planted
 * offender and a planted legitimate use before either count is trusted.
 */

const TEST_ROOT = fileURLToPath(new URL('.', import.meta.url));
/** This file, exempt from its own scan for the same reason `no-bare-rmsync`
 *  exempts itself: the planted positive controls below are the banned
 *  strings, held in string literals, and this file never actually imports
 *  `playwright` or calls `drawAll`/`chromium.launch` — a fact the second test
 *  below checks rather than assumes. */
const SELF = fileURLToPath(import.meta.url);

function testFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) testFiles(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** `source` with every comment blanked, newlines kept — see `no-bare-rmsync.test.ts` for why
 *  blanking (not deleting) and why the `://` guard exists. */
function blankComments(source: string): string {
  const out = source.split('');
  const blank = (from: number, to: number): void => {
    for (let i = from; i < to && i < out.length; i++) if (out[i] !== '\n') out[i] = ' ';
  };
  for (let i = 0; i < source.length; i++) {
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

const BANNED = [
  { name: 'a static import of `playwright`', re: /from\s+['"]playwright['"]/ },
  { name: 'a static import of `@playwright\\/test`', re: /from\s+['"]@playwright\/test['"]/ },
  { name: "a dynamic import('playwright')", re: /import\(\s*['"]playwright['"]\s*\)/ },
  { name: 'a call to drawAll(...)', re: /\bdrawAll\s*\(/ },
  { name: 'a call to chromium.launch(...)', re: /\bchromium\s*\.\s*launch\s*\(/ },
];

/** Every browser-reaching construct in `source`, across all `BANNED` shapes. */
export function offences(source: string): Offence[] {
  const masked = blankComments(source);
  const lines = source.split('\n');
  const found: Offence[] = [];
  for (const { re } of BANNED) {
    for (const m of masked.matchAll(new RegExp(re.source, 'g'))) {
      const line = masked.slice(0, m.index).split('\n').length;
      found.push({ line, text: lines[line - 1]!.trim() });
    }
  }
  return found.sort((a, b) => a.line - b.line);
}

test('no file under test/ imports playwright or calls drawAll/chromium.launch', () => {
  const files = testFiles(TEST_ROOT);
  // The floor: a walk that found nothing reported zero offenders and read
  // exactly like a clean bill of health — the same hazard `no-bare-rmsync`
  // guards against, for the same reason.
  assert.ok(files.length > 0, `no .ts files were found under ${TEST_ROOT} — the walk is broken`);

  const offenders: string[] = [];
  let scanned = 0;
  for (const file of files) {
    if (file === SELF) continue;
    scanned++;
    for (const o of offences(readFileSync(file, 'utf8'))) {
      offenders.push(`${path.relative(TEST_ROOT, file)}:${o.line}: ${o.text}`);
    }
  }
  assert.ok(scanned > 0, 'every file was exempted, so nothing was scanned');
  assert.deepEqual(
    offenders, [],
    'these lines reach for a browser from inside the node:test suite, which runs before a ' +
    'headless shell is installed on Ubuntu CI and never installs one on Windows CI — CI run ' +
    '35722957764 is exactly this failure. A byte-equality-through-a-browser proof belongs in ' +
    `e2e/ (see e2e/diagram-determinism.spec.ts):\n${offenders.join('\n')}`,
  );
});

test('this file, which is exempt from its own scan, imports no banned module or name', () => {
  // A full `offences()` scan of this file's own bytes would trivially "find"
  // every planted control and every `BANNED` regex's own source text — they
  // are strings, not code, but a scanner working on text cannot tell the
  // difference, which is exactly why `no-bare-rmsync.test.ts` does not scan
  // itself either. What it checks instead, and what is checked here, is the
  // narrower fact that makes the exemption safe: this file's own `import`
  // statements name none of the banned specifiers or symbols, so it CANNOT
  // execute the actions those strings only describe.
  const self = readFileSync(SELF, 'utf8');
  const imports = [...self.matchAll(/^import\s+(?:\{([^}]*)\}|(\w+))\s+from\s*'([^']+)';/gm)];
  assert.ok(imports.length > 0, 'this file has no import statements, so the check below is vacuous');

  for (const m of imports) {
    const specifier = m[3]!;
    assert.notEqual(specifier, 'playwright', `this file imports from 'playwright'`);
    assert.notEqual(specifier, '@playwright/test', `this file imports from '@playwright/test'`);
  }
  const names = imports.flatMap((m) => (m[1] ?? m[2] ?? '').split(',').map((s) => s.trim()))
    .filter((s) => s.length > 0);
  assert.ok(!names.includes('drawAll'), `this file imports drawAll (${names.join(', ')})`);
  assert.ok(!names.includes('chromium'), `this file imports chromium (${names.join(', ')})`);
});

test('the scanner finds each PLANTED offender, one per banned shape', () => {
  // The positive control. Without it every assertion above is a claim about
  // regexes nobody has seen match.
  assert.deepEqual(
    offences("import { chromium } from 'playwright';\n").map((o) => o.line), [1]);
  assert.deepEqual(
    offences("import { test } from '@playwright/test';\n").map((o) => o.line), [1]);
  assert.deepEqual(
    offences("const { chromium } = await import('playwright');\n").map((o) => o.line), [1]);
  assert.deepEqual(
    offences('const svgs = await drawAll(defs);\n').map((o) => o.line), [1]);
  assert.deepEqual(
    offences('const browser = await chromium.launch();\n').map((o) => o.line), [1]);

  // Broken across lines, the shape a per-line scan would miss.
  const wrapped = [
    'const svgs = await drawAll(',
    '  defs,',
    ');',
  ].join('\n');
  assert.deepEqual(offences(wrapped).map((o) => o.line), [1]);

  // Two banned shapes in one file are both reported.
  assert.equal(
    offences("import { chromium } from 'playwright';\nawait chromium.launch();\n").length, 2);
});

test('the scanner does NOT name what is legitimate', () => {
  // Importing the SCRIPT (not the browser) is exactly what
  // `test/ui/diagram-gate.test.ts` does, and must stay clear.
  assert.deepEqual(
    offences("import { collectDiagrams, digestOf } from '../../scripts/gen-diagrams.ts';\n"), []);
  // Mentioning `drawAll` in prose, not calling it — the shape this file's own
  // docblock above uses.
  assert.deepEqual(offences('// drawAll launches its own Chromium.\n'), []);
  assert.deepEqual(offences('/**\n * calls drawAll(...) itself\n */\n'), []);
  // `chromium` as a bare identifier, never `.launch(`.
  assert.deepEqual(offences('const chromium = 42;\n'), []);
  // `playwright` inside another word, never the package specifier.
  assert.deepEqual(offences("const dir = 'not-playwright-related';\n"), []);
});

test('the masker does not blank a line because a URL happens to be on it', () => {
  // Same guard `no-bare-rmsync.test.ts` carries, for the same reason: a
  // masker that reads `://` as a comment start would blank a real offence
  // sitting after a URL on the same line.
  const line = "const doc = 'https://example.test/x'; await chromium.launch();\n";
  assert.deepEqual(offences(line).map((o) => o.line), [1]);
});
