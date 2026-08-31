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
  // `DOC_FILES` names the two front-door documents BY NAME and refuses to run
  // without them, so every throwaway tree has to carry them. Empty is the right
  // content here: a probe measures the document it was handed, and a README with
  // anything in it would add citations to every count below.
  writeFileSync(path.join(root, 'README.md'), '', 'utf8');
  writeFileSync(path.join(root, 'docs', 'README.he.md'), '', 'utf8');
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
// RED: a citation already in the checked form but SPLIT ACROSS TWO SOURCE
// LINES. `CITATION` separates the three parts with `[ \t]*·[ \t]*`, which does
// not cross a newline, so a wrapped citation matches nothing — and "nothing"
// is not BROKEN. It is invisible: never counted, never resolved, reported
// nowhere. Twenty-two were found by hand on 2026-08-21 and ten of them came
// back MOVED the instant the gate could see them, which is what the silence
// was hiding.
//
// Every test in this block asserts the citation count as well as the fault,
// because the count is the evidence that the gate really could not see it.
// ---------------------------------------------------------------------------

test('a citation wrapped between its file and its fragment is a fault, not a silence', () => {
  run(`The two questions. \`thing.ts\` ·\n\`${PRESENT}\` · ~2 says so.\n`, (p) => {
    assert.equal(p.code, 1, p.out);
    // The whole point. Without the fault this run is a clean green over a
    // document whose one citation the script never saw.
    assert.match(p.out, /0 citation\(s\)/);
    assert.match(p.out, /UNREAD docs\/superpowers\/plans\/probe\.md:1/);
    assert.match(p.out, /the fragment is on the next line/);
    // The orphaned tail is named too — both halves need joining.
    assert.match(p.out, /UNREAD docs\/superpowers\/plans\/probe\.md:2/);
    assert.match(p.out, /2 fault\(s\)/);
  });
});

test('a citation whose fragment is cut mid-span is a fault, not a silence', () => {
  run('Because `thing.ts` · `export function\npresent(): void {` · ~2 is the anchor.\n', (p) => {
    assert.equal(p.code, 1, p.out);
    assert.match(p.out, /0 citation\(s\)/);
    assert.match(p.out, /UNREAD docs\/superpowers\/plans\/probe\.md:1/);
    assert.match(p.out, /a code span the citation form did not match/);
  });
});

test('a citation wrapped after its fragment is read WITHOUT its hint, and faults', () => {
  run(`It says \`thing.ts\` · \`${PRESENT}\` ·\n~2 and then some prose.\n`, (p) => {
    assert.equal(p.code, 1, p.out);
    // Worse than invisible in one way: it looks checked, and the `~2` under it
    // is dead text no verdict will ever touch.
    assert.match(p.out, /1 citation\(s\)/);
    assert.match(p.out, /1 ok, /);
    assert.match(p.out, /UNREAD docs\/superpowers\/plans\/probe\.md:1/);
    assert.match(p.out, /a separator closing the line/);
    assert.match(p.out, /1 fault\(s\)/);
  });
});

test('a hint left behind on the next line is a fault — the real shape found in the corpus', () => {
  // `2026-08-20-v2-hooks-sessions-and-continuity.md:514` exactly: the file and
  // the fragment fit, the separator and the `~8` did not.
  run(`\`thing.ts\` · \`${PRESENT}\`\n· ~2 lists it, and so does the prose.\n`, (p) => {
    assert.equal(p.code, 1, p.out);
    assert.match(p.out, /1 citation\(s\)/);
    assert.match(p.out, /UNREAD docs\/superpowers\/plans\/probe\.md:2/);
    assert.match(p.out, /no citation on this line claimed/);
    assert.match(p.out, /1 fault\(s\)/);
  });
});

test('a separator opening the continuation line is a fault', () => {
  run(`\`thing.ts\`\n· \`${PRESENT}\` · ~2\n`, (p) => {
    assert.equal(p.code, 1, p.out);
    assert.match(p.out, /0 citation\(s\)/);
    assert.match(p.out, /UNREAD docs\/superpowers\/plans\/probe\.md:2/);
  });
});

// ---------------------------------------------------------------------------
// GREEN: `·` is ordinary punctuation in these documents and must stay that
// way. A fault that fires on prose is the other way this gate stops being
// read — and the discrimination is not a heuristic, so each of these pins the
// exact reason it is not a citation.
// ---------------------------------------------------------------------------

test('backticked prose separated by `·` names no file, so it is not a citation', () => {
  run(
    'Profiles: `minimal` (8) · `standard` (17, default) · `full` (20).\n' +
      `| a | ${cite(PRESENT)} |\n`,
    (p) => {
      assert.equal(p.code, 0, p.out);
      assert.match(p.out, /1 citation\(s\)/);
      assert.match(p.out, /0 fault\(s\)/);
    },
  );
});

test('a preamble DESCRIBING the citation form is not a citation', () => {
  run(
    'Citations are `file` · `verbatim fragment` · `~line`, per §2.\n' +
      `| a | ${cite(PRESENT)} |\n`,
    (p) => {
      assert.equal(p.code, 0, p.out);
      assert.match(p.out, /1 citation\(s\)/);
      assert.match(p.out, /0 fault\(s\)/);
    },
  );
});

test('a cited file followed by PROSE rather than a fragment is not a wrapped citation', () => {
  // `2026-08-16-production-grade.md:9` — `**Roadmap:** `docs/ROADMAP.md` ·
  // **Reviews:** …`, a navigation line. The separator has a cited file on its
  // left, and the one place a wrapped citation could have put the fragment —
  // the end of the line, or the code span that follows — holds prose instead.
  run(
    '**Roadmap:** `thing.ts` · **Reviews:** the three read-only reports.\n' +
      `| a | ${cite(PRESENT)} |\n`,
    (p) => {
      assert.equal(p.code, 0, p.out);
      assert.match(p.out, /1 citation\(s\)/);
      assert.match(p.out, /0 fault\(s\)/);
    },
  );
});

test('a citation that fits on one line leaves no separator behind', () => {
  run(`It says \`thing.ts\` · \`${PRESENT}\` · ~2, and that is that.\n`, (p) => {
    assert.equal(p.code, 0, p.out);
    assert.match(p.out, /1 citation\(s\)/);
    assert.match(p.out, /0 fault\(s\)/);
  });
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

// ---------------------------------------------------------------------------
// THE FENCE QUESTION. A fenced block is sometimes source waiting to be pasted
// and sometimes a specimen of this very notation, and the script's answer is
// that its INFO STRING decides — nothing else. Three things have to hold at
// once or the answer is worthless: the fence does not hide a real citation, a
// bare pointer inside a SOURCE fence is named, and the same pointer one step
// outside that scope is left alone. The third is the specimen escape, and it is
// the one that matters most: a sweep that "fixes" a specimen destroys the
// documentation of the form.
//
// The control comes first for the usual reason. A script that never looked
// inside a fence at all would pass the two silences below by being empty.
// ---------------------------------------------------------------------------

/** A `ts`-tagged fenced block, which is what a plan writes for code to paste. */
const tsFence = (body: string): string => `\`\`\`ts\n${body}\n\`\`\`\n`;

/** The same block with no info string, which is what a display is written as. */
const bareFence = (body: string): string => `\`\`\`\n${body}\n\`\`\`\n`;

test('the control: a citation inside a ```ts fence is READ, not skipped as code', () => {
  run(tsFence(`// why: ${cite(PRESENT)} · ~2`), (p) => {
    assert.equal(p.code, 0, p.out);
    assert.match(p.out, /1 citation\(s\)/);
    assert.match(p.out, /0 fault\(s\)/);
  });
});

test('a BROKEN citation inside a ```ts fence is still reported — a fence is not a quotation mark', () => {
  run(tsFence(`// why: ${cite(GONE)}`), (p) => {
    assert.equal(p.code, 1, p.out);
    assert.match(p.out, /BROKEN/);
  });
});

test('a bare `file:line` pointer inside a ```ts fence is a fault, and fails the run', () => {
  run(tsFence('// the filter lives at thing.ts:2 — extend it:'), (p) => {
    assert.equal(p.code, 1, p.out);
    assert.match(p.out, /^BARE .*probe\.md:2$/m, p.out);
    assert.match(p.out, /thing\.ts:2/);
    assert.match(p.out, /1 fault\(s\)/);
  });
});

test('a line RANGE is the same fault — `thing.ts:2-4` carries no fragment either', () => {
  run(tsFence('// see thing.ts:2-4'), (p) => {
    assert.equal(p.code, 1, p.out);
    assert.match(p.out, /^BARE/m);
    assert.match(p.out, /thing\.ts:2-4/);
  });
});

test('THE SPECIMEN ESCAPE: the identical pointer in an UNTAGGED fence is left alone', () => {
  run(bareFence('the form this project refused: thing.ts:2'), (p) => {
    assert.equal(p.code, 0, p.out);
    assert.match(p.out, /0 fault\(s\)/);
  });
});

test('a bare pointer in ordinary prose is NOT this fault — the scope is fences that become source', () => {
  run('The filter lives at thing.ts:2, which the corpus writes this way.\n', (p) => {
    assert.equal(p.code, 0, p.out);
    assert.match(p.out, /0 fault\(s\)/);
  });
});

test('the fence CLOSES: a pointer after the closing delimiter is prose again', () => {
  run(`${tsFence('const a = 1;')}\nand thing.ts:2 names it.\n`, (p) => {
    assert.equal(p.code, 0, p.out);
    assert.match(p.out, /0 fault\(s\)/);
  });
});

// ---------------------------------------------------------------------------
// THE FRONT DOOR. `DOC_FILES` is two named files rather than a root, and both
// halves of that choice need a test: a citation written in a README is CHECKED
// like any other document's, and a README that stops existing STOPS THE RUN
// instead of quietly leaving the walk. The second is the whole reason the
// list is names and not a directory — `walk` returns nothing for a path it
// cannot read, which is right for a root and exactly wrong here.
// ---------------------------------------------------------------------------

/**
 * Run the script over a throwaway repo whose README files are whatever
 * `readmes` says. A key mapped to `null` is NOT created, which is how the
 * missing-file refusal is driven.
 */
function probeReadmes(readmes: Record<string, string | null>): Probe {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-readme-'));
  mkdirSync(path.join(root, 'scripts'), { recursive: true });
  mkdirSync(path.join(root, 'src'), { recursive: true });
  mkdirSync(path.join(root, 'docs', 'superpowers', 'plans'), { recursive: true });
  copyFileSync(SCRIPT, path.join(root, 'scripts', 'verify-citations.ts'));
  writeFileSync(
    path.join(root, 'src', 'thing.ts'),
    `// a file with one citable line\n${PRESENT}\n}\n`,
    'utf8',
  );
  for (const [rel, body] of Object.entries(readmes)) {
    if (body === null) continue;
    writeFileSync(path.join(root, rel), body, 'utf8');
  }
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

function runReadmes(
  readmes: Record<string, string | null>, check: (p: Probe) => void,
): void {
  const p = probeReadmes(readmes);
  try {
    check(p);
  } finally {
    p.dispose();
  }
}

test('a citation in README.md is checked like any other document\'s', () => {
  runReadmes(
    {
      'README.md': `A claim. <!-- ${cite(PRESENT)} · ~2 -->\n`,
      'docs/README.he.md': '',
    },
    (p) => {
      assert.equal(p.code, 0, p.out);
      assert.match(p.out, /1 citation\(s\)/);
    },
  );
});

test('a BROKEN citation in README.md fails the run, ungated', () => {
  runReadmes(
    { 'README.md': `A claim. <!-- ${cite(GONE)} -->\n`, 'docs/README.he.md': '' },
    (p) => {
      assert.equal(p.code, 1, p.out);
      assert.match(p.out, /BROKEN README\.md:1/);
    },
  );
});

test('a broken citation in the HEBREW README fails too — it is not the English one\'s shadow', () => {
  runReadmes(
    { 'README.md': '', 'docs/README.he.md': `טענה. <!-- ${cite(GONE)} -->\n` },
    (p) => {
      assert.equal(p.code, 1, p.out);
      assert.match(p.out, /BROKEN docs\/README\.he\.md:1/);
    },
  );
});

test('a README that is not there stops the run rather than leaving the walk', () => {
  runReadmes({ 'README.md': null, 'docs/README.he.md': '' }, (p) => {
    assert.equal(p.code, 1, p.out);
    assert.match(p.out, /README\.md is named in DOC_FILES and is not a file/);
  });
});

test('a missing HEBREW README stops the run on the same terms', () => {
  runReadmes({ 'README.md': '', 'docs/README.he.md': null }, (p) => {
    assert.equal(p.code, 1, p.out);
    assert.match(p.out, /docs\/README\.he\.md is named in DOC_FILES and is not a file/);
  });
});
