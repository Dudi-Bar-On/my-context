/**
 * **The historical-citation marker, driven red before it is trusted green.**
 *
 * This repository has already shipped a checker that could not fail —
 * `check-retired.ts` tested each line against a template that matched EVERY
 * possible line, skipped whole documents, and passed everything. It was caught
 * only by reintroducing a real defect and watching it stay green.
 *
 * `<!-- historical-citation: … -->` is a hole deliberately cut in a release
 * gate, so it is exactly the shape that failure takes next: a marker that
 * quietly excuses more than the one thing it was written for turns
 * `verify:citations` into a script that reports 660 citations and checks none
 * of them. Every test below is therefore paired — the marker WORKS, and the
 * marker does NOT work one step outside its scope.
 *
 * The script resolves everything relative to its own parent directory, so
 * these run it as a real process inside a throwaway tree with its own
 * `docs/superpowers/plans/` and `src/`, the same way `mutate.test.ts` drives
 * the mutation harness. A unit test over the regex would pin the pattern and
 * not the gate.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { removeTree } from '../helpers/tmp.ts';

const SCRIPT = fileURLToPath(new URL('../../scripts/verify-citations.ts', import.meta.url));

/** The one line every probe below cites, present or absent on purpose. */
const PRESENT = 'export function present(): void {';
const GONE = "test('there are 21 categories', () => {";

interface Probe {
  code: number;
  out: string;
  dispose(): void;
}

/**
 * Run the real script over a throwaway repo whose only document is `doc`.
 *
 * `src/thing.ts` contains `PRESENT` and does NOT contain `GONE`, so a citation
 * of `GONE` is genuinely unresolvable — the same situation as a plan quoting
 * text a later commit deleted.
 */
function probe(doc: string): Probe {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-cite-'));
  mkdirSync(path.join(root, 'scripts'), { recursive: true });
  mkdirSync(path.join(root, 'src'), { recursive: true });
  mkdirSync(path.join(root, 'docs', 'superpowers', 'plans'), { recursive: true });
  copyFileSync(SCRIPT, path.join(root, 'scripts', 'verify-citations.ts'));
  writeFileSync(
    path.join(root, 'src', 'thing.ts'),
    `// a file with one citable line\n${PRESENT}\n}\n`,
    'utf8',
  );
  writeFileSync(path.join(root, 'docs', 'superpowers', 'plans', 'probe.md'), doc, 'utf8');

  const result = spawnSync(
    process.execPath,
    [path.join(root, 'scripts', 'verify-citations.ts')],
    { cwd: root, encoding: 'utf8' },
  );
  return {
    code: result.status ?? -1,
    out: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    dispose: () => removeTree(root),
  };
}

function run(doc: string, check: (p: Probe) => void): void {
  const p = probe(doc);
  try {
    check(p);
  } finally {
    p.dispose();
  }
}

const cite = (fragment: string): string => `\`thing.ts\` · \`${fragment}\``;

// ---------------------------------------------------------------------------
// The control. Without it, everything below could be passing for the wrong
// reason — a script that never finds a citation at all reports zero broken.
// ---------------------------------------------------------------------------

test('the control: an unmarked citation that resolves passes, and is counted', () => {
  run(`| Fact | Where |\n|---|---|\n| a | ${cite(PRESENT)} |\n`, (p) => {
    assert.equal(p.code, 0, p.out);
    assert.match(p.out, /1 citation\(s\)/);
    assert.match(p.out, /1 ok, /);
    assert.match(p.out, /every citation resolves\./);
  });
});

// ---------------------------------------------------------------------------
// GREEN: the marker does the one job it exists for.
// ---------------------------------------------------------------------------

test('a MARKED citation whose target no longer exists passes, and says so out loud', () => {
  run(
    `| a | ${cite(GONE)} <!-- historical-citation: §7 quotes the pre-change test on purpose --> |\n`,
    (p) => {
      assert.equal(p.code, 0, p.out);
      assert.match(p.out, /0 broken/);
      assert.match(p.out, /1 historical/);
      // Excused is not the same as unmentioned. INV-nothing-is-dropped-silently.
      assert.match(p.out, /HIST {3}docs\/superpowers\/plans\/probe\.md:1 {2}thing\.ts/);
      assert.match(p.out, /§7 quotes the pre-change test on purpose/);
    },
  );
});

// ---------------------------------------------------------------------------
// RED: the same citation without the marker. If this ever passes, the gate is
// gone and the 660 citations are decoration.
// ---------------------------------------------------------------------------

test('an UNMARKED citation whose target no longer exists still fails', () => {
  run(`| a | ${cite(GONE)} |\n`, (p) => {
    assert.equal(p.code, 1, p.out);
    assert.match(p.out, /BROKEN docs\/superpowers\/plans\/probe\.md:1/);
    assert.match(p.out, /fragment not found/);
    assert.match(p.out, /0 historical, 1 broken/);
  });
});

test('a marker on ONE line does not excuse an identical break on another', () => {
  run(
    `| a | ${cite(GONE)} <!-- historical-citation: this one is deliberate --> |\n` +
      `| b | ${cite(GONE)} |\n`,
    (p) => {
      assert.equal(p.code, 1, p.out);
      assert.match(p.out, /1 historical, 1 broken/);
      assert.match(p.out, /BROKEN docs\/superpowers\/plans\/probe\.md:2/);
      assert.doesNotMatch(p.out, /BROKEN docs\/superpowers\/plans\/probe\.md:1/);
    },
  );
});

// ---------------------------------------------------------------------------
// RED: a marker that is malformed, misspelled or attached to nothing must be
// reported. Swallowing one silently is how the marker becomes a blanket
// suppressor — the author believes a line is excused, the script believes
// there is no marker there, and neither says anything.
// ---------------------------------------------------------------------------

test('a marker with no reason is a fault, and does NOT excuse the citation beside it', () => {
  run(`| a | ${cite(GONE)} <!-- historical-citation --> |\n`, (p) => {
    assert.equal(p.code, 1, p.out);
    assert.match(p.out, /MARKER docs\/superpowers\/plans\/probe\.md:1/);
    assert.match(p.out, /malformed/);
    // Fails TWICE, never swallows once.
    assert.match(p.out, /BROKEN docs\/superpowers\/plans\/probe\.md:1/);
    assert.match(p.out, /0 historical, 1 broken/);
  });
});

test('a marker with an empty reason is a fault', () => {
  run(`| a | ${cite(GONE)} <!-- historical-citation:   --> |\n`, (p) => {
    assert.equal(p.code, 1, p.out);
    assert.match(p.out, /MARKER /);
    assert.match(p.out, /malformed/);
    assert.match(p.out, /1 broken/);
  });
});

test('a marker whose comment is not closed on its own line is a fault', () => {
  run(`| a | ${cite(GONE)} <!-- historical-citation: wrapped\nover two lines --> |\n`, (p) => {
    assert.equal(p.code, 1, p.out);
    assert.match(p.out, /MARKER docs\/superpowers\/plans\/probe\.md:1/);
    assert.match(p.out, /malformed/);
    assert.match(p.out, /1 broken/);
  });
});

test('a MISSPELLED marker is a fault rather than a silent no-op', () => {
  run(`| a | ${cite(GONE)} <!-- historical-citations: plural typo --> |\n`, (p) => {
    assert.equal(p.code, 1, p.out);
    assert.match(p.out, /MARKER docs\/superpowers\/plans\/probe\.md:1/);
    assert.match(p.out, /malformed/);
    assert.match(p.out, /1 broken/);
  });
});

test('a marker attached to no citation at all is a fault', () => {
  run(`Some prose. <!-- historical-citation: excuses nothing whatsoever -->\n`, (p) => {
    assert.equal(p.code, 1, p.out);
    assert.match(p.out, /MARKER docs\/superpowers\/plans\/probe\.md:1/);
    assert.match(p.out, /excuses nothing on this line/);
    assert.match(p.out, /0 citation\(s\)/);
  });
});

test('a marker cannot be pre-armed on a line whose citation still resolves', () => {
  run(`| a | ${cite(PRESENT)} <!-- historical-citation: not needed yet --> |\n`, (p) => {
    assert.equal(p.code, 1, p.out);
    assert.match(p.out, /MARKER docs\/superpowers\/plans\/probe\.md:1/);
    assert.match(p.out, /excuses nothing on this line/);
    assert.match(p.out, /1 ok, /);
  });
});

test('a marker does not excuse a missing FILE — only a missing fragment', () => {
  run(
    '| a | `nowhere.ts` · `export function absent(): void {` ' +
      '<!-- historical-citation: the file is gone too --> |\n',
    (p) => {
      assert.equal(p.code, 1, p.out);
      assert.match(p.out, /BROKEN docs\/superpowers\/plans\/probe\.md:1/);
      assert.match(p.out, /no such file/);
      assert.match(p.out, /MARKER docs\/superpowers\/plans\/probe\.md:1/);
      assert.match(p.out, /0 historical, 1 broken/);
    },
  );
});

test('a second marker on one line is a fault, even when the first one is doing its job', () => {
  run(
    `| a | ${cite(GONE)} <!-- historical-citation: first --> <!-- historical-citation: second --> |\n`,
    (p) => {
      assert.equal(p.code, 1, p.out);
      assert.match(p.out, /a second marker on one line/);
      // The first still excused the citation; the run fails on the fault alone.
      assert.match(p.out, /1 historical, 0 broken/);
    },
  );
});

// ---------------------------------------------------------------------------
// The marker is not a `--fix` target, and `--fix` must not learn to write one.
// ---------------------------------------------------------------------------

test('the summary always reports how many markers are in play', () => {
  run(
    `| a | ${cite(GONE)} <!-- historical-citation: deliberate --> |\n| b | ${cite(PRESENT)} |\n`,
    (p) => {
      assert.equal(p.code, 0, p.out);
      assert.match(p.out, /1 marker\(s\), 0 fault\(s\)/);
    },
  );
});
