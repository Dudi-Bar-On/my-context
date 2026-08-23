/**
 * **The source walk, proved able to see what it claims to check.**
 *
 * A gate in this project once read `el.className` and silently ignored every
 * SVG element for weeks, because nothing ever asked it to find one. A citation
 * walker fails the same way and worse: its failure mode is not a wrong answer
 * but SILENCE — a citation it cannot parse is not broken, it is uncounted, and
 * an uncounted citation looks exactly like a citation that passed.
 *
 * So no test here trusts an exit code on its own. Every one of them pins the
 * COUNT as well, because the count is the only evidence the walker saw the
 * thing at all, and each plants a citation of a known shape and then breaks a
 * citation of that same shape. A walker that found nothing would report zero
 * broken and pass every green assertion below on its own emptiness.
 *
 * The shapes matter because source is not Markdown. Citations here live in
 * JSDoc blocks and in `//` runs, they wrap across lines because comments wrap
 * at 80 columns, and their fragments quote source lines that themselves contain
 * backticks. Each of those is a way a naive walker goes quietly blind, so each
 * gets a pair: it is FOUND, and one step outside it is REPORTED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { removeTree } from '../helpers/tmp.ts';

const SCRIPT = fileURLToPath(new URL('../../scripts/verify-citations.ts', import.meta.url));

/**
 * The cited file. Line 2 is an ordinary signature; line 3 quotes a source line
 * that CONTAINS backticks, which a fragment can only carry by escaping them.
 */
const TARGET = [
  '// a file with citable lines',
  'export function present(): void {',
  '  const tricky = `a value in backticks`;',
  '}',
  '',
].join('\n');

const PRESENT = 'export function present(): void {';
const TRICKY = '  const tricky = \\`a value in backticks\\`;';
const GONE = "export function deletedLastMonth(): void {";

interface Probe {
  root: string;
  code: number;
  out: string;
  dispose(): void;
}

/**
 * Run the real script over a throwaway repo containing `src/target.ts` plus
 * whatever `files` names. There is no `docs/` content on purpose: the doc walk
 * reports zero, so every number on the source line came from source.
 */
function probe(files: Record<string, string>, args: string[] = []): Probe {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-srccite-'));
  mkdirSync(path.join(root, 'scripts'), { recursive: true });
  mkdirSync(path.join(root, 'src'), { recursive: true });
  mkdirSync(path.join(root, 'docs', 'superpowers', 'plans'), { recursive: true });
  copyFileSync(SCRIPT, path.join(root, 'scripts', 'verify-citations.ts'));
  writeFileSync(path.join(root, 'src', 'target.ts'), TARGET, 'utf8');
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, body, 'utf8');
  }
  const result = spawnSync(
    process.execPath,
    [path.join(root, 'scripts', 'verify-citations.ts'), ...args],
    { cwd: root, encoding: 'utf8' },
  );
  return {
    root,
    code: result.status ?? -1,
    out: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    dispose: () => removeTree(root),
  };
}

function run(
  files: Record<string, string>,
  check: (p: Probe) => void,
  args: string[] = [],
): void {
  const p = probe(files, args);
  try {
    check(p);
  } finally {
    p.dispose();
  }
}

/** `N citation(s) in M source file(s): A ok, B moved, …` — the source tally. */
function sourceTally(out: string): string {
  const m = /^(\d+ citation\(s\) in \d+ source file\(s\): .*)$/m.exec(out);
  assert.ok(m !== null, `no source summary line in:\n${out}`);
  return m[1]!;
}

// ---------------------------------------------------------------------------
// The control, and the plant. Everything below is worthless if the walk cannot
// find an ordinary source citation, because a walk that finds nothing reports
// nothing broken and passes every green assertion by being empty.
// ---------------------------------------------------------------------------

test('a citation planted in a block comment is FOUND, counted, and resolves', () => {
  run(
    { 'src/citer.ts': `/** why: \`target.ts\` · \`${PRESENT}\` · ~2 */\nexport const a = 1;\n` },
    (p) => {
      assert.match(sourceTally(p.out), /^1 citation\(s\) in 1 source file\(s\): 1 ok, /);
      assert.equal(p.code, 0, p.out);
    },
  );
});

test('the same citation broken on purpose is REPORTED, at its own file and line', () => {
  run(
    { 'src/citer.ts': `export const a = 1;\n/** why: \`target.ts\` · \`${GONE}\` · ~2 */\n` },
    (p) => {
      assert.match(sourceTally(p.out), /^1 citation\(s\) in 1 source file\(s\): 0 ok, /);
      assert.match(sourceTally(p.out), /1 broken$/);
      assert.match(p.out, /BROKEN src\/citer\.ts:2/);
      assert.match(p.out, /fragment not found/);
    },
  );
});

test('a `//` line comment is a citation site too, not only a `/**` block', () => {
  run(
    { 'src/citer.ts': `// why: \`target.ts\` · \`${PRESENT}\` · ~2\nexport const a = 1;\n` },
    (p) => {
      assert.match(sourceTally(p.out), /^1 citation\(s\) in 1 source file\(s\): 1 ok, /);
    },
  );
});

test('a `//` citation broken on purpose is reported — the pair for the line above', () => {
  run(
    { 'src/citer.ts': `// why: \`target.ts\` · \`${GONE}\` · ~2\nexport const a = 1;\n` },
    (p) => {
      assert.match(sourceTally(p.out), /1 broken$/);
      assert.match(p.out, /BROKEN src\/citer\.ts:1/);
    },
  );
});

// ---------------------------------------------------------------------------
// THE WRAPPED CITATION — the whole reason source is read by comment run and not
// by line. Thirty-eight of these exist in the tree today. Read line-at-a-time
// they match nothing at all: not broken, not counted, not mentioned. The count
// assertion is the load-bearing one in every test here.
// ---------------------------------------------------------------------------

test('a citation wrapped between its file and its fragment is FOUND, not silently dropped', () => {
  run(
    {
      'src/citer.ts':
        `/**\n * why: (\`target.ts\` ·\n * \`${PRESENT}\` · ~2)\n */\nexport const a = 1;\n`,
    },
    (p) => {
      // Read by line this is 0 citations and 2 faults. Read by comment run it
      // is one citation that resolves.
      assert.match(sourceTally(p.out), /^1 citation\(s\) in 1 source file\(s\): 1 ok, /);
      assert.match(p.out, /0 fault\(s\)/);
      assert.equal(p.code, 0, p.out);
    },
  );
});

test('a WRAPPED citation broken on purpose is reported at the line it STARTS on', () => {
  run(
    {
      'src/citer.ts':
        `export const a = 1;\n/**\n * why: (\`target.ts\` ·\n * \`${GONE}\` · ~2)\n */\n`,
    },
    (p) => {
      assert.match(sourceTally(p.out), /1 broken$/);
      // Line 3 opens the citation; line 4 carries its fragment. The report has
      // to send a reader to the line they must edit first.
      assert.match(p.out, /BROKEN src\/citer\.ts:3/);
      assert.doesNotMatch(p.out, /BROKEN src\/citer\.ts:4/);
    },
  );
});

test('a fragment cut mid-span across two comment lines still resolves', () => {
  run(
    {
      'src/citer.ts': `/**\n * why: \`target.ts\` · \`export function\n * present(): void {\` · ~2\n */\n`,
    },
    (p) => {
      assert.match(sourceTally(p.out), /^1 citation\(s\) in 1 source file\(s\): 1 ok, /);
    },
  );
});

test('a wrapped citation in a `//` run is found across the run', () => {
  run(
    { 'src/citer.ts': `// why: \`target.ts\` ·\n// \`${PRESENT}\` · ~2\nexport const a = 1;\n` },
    (p) => {
      assert.match(sourceTally(p.out), /^1 citation\(s\) in 1 source file\(s\): 1 ok, /);
    },
  );
});

test('joining stops at the end of the comment — it does not reach into code', () => {
  // The `·` closes a comment that is not continued. Nothing below it is comment
  // text, so there is no fragment to find and the gate must say so rather than
  // gluing the next statement on and inventing a citation.
  run(
    { 'src/citer.ts': `// why: \`target.ts\` ·\nconst frag = \`${PRESENT}\`;\n` },
    (p) => {
      assert.match(sourceTally(p.out), /^0 citation\(s\)/);
      assert.match(p.out, /UNREAD src\/citer\.ts:1/);
    },
  );
});

// ---------------------------------------------------------------------------
// A fragment quoting a source line that itself contains backticks. `CITATION`
// could not span one until the escape was allowed through, so it captured a
// TRUNCATED fragment and called the citation broken — a wrong answer dressed as
// a real finding. Thirteen source citations in this repo are written this way.
// ---------------------------------------------------------------------------

test('a fragment carrying escaped backticks is read whole, and resolves', () => {
  run({ 'src/citer.ts': `/** why: \`target.ts\` · \`${TRICKY}\` · ~3 */\n` }, (p) => {
    assert.match(sourceTally(p.out), /^1 citation\(s\) in 1 source file\(s\): 1 ok, /);
    assert.match(p.out, /0 fault\(s\)/);
  });
});

test('an escaped-backtick fragment that no longer matches is reported, not passed', () => {
  run(
    { 'src/citer.ts': `/** why: \`target.ts\` · \`  const gone = \\\`a value\\\`;\` · ~3 */\n` },
    (p) => {
      assert.match(sourceTally(p.out), /1 broken$/);
      assert.match(p.out, /BROKEN src\/citer\.ts:1/);
    },
  );
});

// ---------------------------------------------------------------------------
// A stale `~line` hint. MOVED is not a failure in `docs/` and must not become
// one in source — but `--fix` cannot rewrite a hint whose citation wraps,
// because the text it would search for spans a newline that is not in the file.
// ---------------------------------------------------------------------------

test('a stale hint in source is MOVED, and MOVED never sets the exit code', () => {
  run(
    { 'src/citer.ts': `/** why: \`target.ts\` · \`${PRESENT}\` · ~99 */\n` },
    (p) => {
      assert.match(sourceTally(p.out), /0 ok, 1 moved, /);
      assert.match(p.out, /MOVED {2}src\/citer\.ts:1 {2}target\.ts {2}~99 → ~2/);
      assert.equal(p.code, 0, p.out);
    },
    ['--strict-source'],
  );
});

test('--fix rewrites a hint that fits on one line', () => {
  run(
    { 'src/citer.ts': `/** why: \`target.ts\` · \`${PRESENT}\` · ~99 */\n` },
    (p) => {
      const after = readFileSync(path.join(p.root, 'src', 'citer.ts'), 'utf8');
      assert.match(after, /· ~2 \*\//);
    },
    ['--fix'],
  );
});

test('--fix REFUSES a wrapped hint rather than corrupting the file, and says so', () => {
  const body = `/**\n * why: (\`target.ts\` ·\n * \`${PRESENT}\` · ~99)\n */\n`;
  run(
    { 'src/citer.ts': body },
    (p) => {
      assert.match(p.out, /skipped src\/citer\.ts:2/);
      assert.match(p.out, /the citation wraps across lines/);
      assert.equal(
        readFileSync(path.join(p.root, 'src', 'citer.ts'), 'utf8'),
        body,
        'a wrapped citation must be left exactly as written',
      );
    },
    ['--fix'],
  );
});

// ---------------------------------------------------------------------------
// The exemption. Three exact paths are skipped because they hold deliberately
// malformed citations as SPECIMENS — this file is one of them. A hole cut in a
// gate has to be provably exactly as wide as it claims, so the pair here is:
// the specimens are silent, and a file OUTSIDE the list with the same defect is
// still reported.
// ---------------------------------------------------------------------------

test("the gate does not report its own header's specimens as defects", () => {
  // The copied script carries the full contract comment: example citations, a
  // historical-citation marker, and four malformed shapes written out.
  run({ 'src/citer.ts': `/** why: \`target.ts\` · \`${PRESENT}\` · ~2 */\n` }, (p) => {
    assert.match(sourceTally(p.out), /^1 citation\(s\) in 1 source file\(s\)/);
    assert.match(p.out, /0 fault\(s\)/);
    assert.doesNotMatch(p.out, /verify-citations\.ts/);
  });
});

test('the exemption is a closed list — a file outside it with the same defect is reported', () => {
  run(
    {
      'scripts/other.ts': `// why: \`target.ts\` · \`${GONE}\` · ~2\n`,
      'src/citer.ts': `/** why: \`target.ts\` · \`${PRESENT}\` · ~2 */\n`,
    },
    (p) => {
      assert.match(sourceTally(p.out), /^2 citation\(s\) in 2 source file\(s\): 1 ok, /);
      assert.match(p.out, /BROKEN scripts\/other\.ts:1/);
    },
  );
});

// ---------------------------------------------------------------------------
// The landing. Source findings are printed on every run and gate only under
// `--strict-source`. Both halves are asserted, because "reported" with no way
// to gate it is decoration, and "gated" by default is the red-on-day-one gate
// somebody turns off.
// ---------------------------------------------------------------------------

test('a broken SOURCE citation is reported but does not fail the run by default', () => {
  run({ 'src/citer.ts': `/** why: \`target.ts\` · \`${GONE}\` · ~2 */\n` }, (p) => {
    assert.match(p.out, /BROKEN src\/citer\.ts:1/);
    assert.match(p.out, /1 source failure\(s\) above are REPORTED, not gated/);
    assert.match(p.out, /--strict-source/);
    assert.equal(p.code, 0, p.out);
  });
});

test('the same citation fails the run under --strict-source', () => {
  run(
    { 'src/citer.ts': `/** why: \`target.ts\` · \`${GONE}\` · ~2 */\n` },
    (p) => {
      assert.match(p.out, /BROKEN src\/citer\.ts:1/);
      assert.doesNotMatch(p.out, /REPORTED, not gated/);
      assert.equal(p.code, 1, p.out);
    },
    ['--strict-source'],
  );
});

test('a broken DOCUMENT citation still fails by default — the doc gate is untouched', () => {
  run(
    {
      'docs/superpowers/plans/probe.md': `| a | \`target.ts\` · \`${GONE}\` |\n`,
      'src/citer.ts': `/** why: \`target.ts\` · \`${PRESENT}\` · ~2 */\n`,
    },
    (p) => {
      assert.match(p.out, /BROKEN docs\/superpowers\/plans\/probe\.md:1/);
      assert.equal(p.code, 1, p.out);
    },
  );
});

// ---------------------------------------------------------------------------
// `·` is ordinary punctuation in source as well — in template literals that
// build output, in arithmetic, in a doc comment describing a display format. A
// fault that fires on those is how this gate gets switched off.
// ---------------------------------------------------------------------------

test('a separator inside runtime code and prose raises no fault', () => {
  run(
    {
      'src/citer.ts':
        '/** `tags: billing · scope: src/api` — the axes, for a human. */\n' +
        'export const label = (parts: string[]): string => parts.join(" · ");\n' +
        '// a worst case of 20·(1+14) ms of backoff\n' +
        `/** why: \`target.ts\` · \`${PRESENT}\` · ~2 */\n`,
    },
    (p) => {
      assert.match(sourceTally(p.out), /^1 citation\(s\) in 1 source file\(s\): 1 ok, /);
      assert.match(p.out, /0 fault\(s\)/);
      assert.equal(p.code, 0, p.out);
    },
  );
});
