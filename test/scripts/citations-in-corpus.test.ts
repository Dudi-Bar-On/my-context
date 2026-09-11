// @basis TASK-verify-citations-must-scan-the-corpus-and-the-corpus-should,
//         STD-a-citation-names-a-file-a-verbatim-fragment-and-an-optional,
//         RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number,
//         INV-nothing-is-dropped-silently
/**
 * **The corpus walk, and the measurement that reopened it.**
 *
 * `scripts/verify-citations.ts` refused `.my_context/items/` on 2026-08-29 with
 * a measurement written into its own header: 658 item files, **one** citation
 * in the checked form, 165 bare `file.ts:123` pointers. Pointed at the corpus
 * that day it would have walked 658 files and checked one claim, which is the
 * appearance of coverage, and this script's whole argument is that the
 * appearance is worse than the absence. The refusal was right on that tree.
 *
 * **It is not that tree any more.** Re-measured 2026-09-11 with the same
 * script, over 1,093 items: **223 citations in the checked form — 40 ok, 126
 * moved, 57 BROKEN — and 8 faults.** The corpus was normalised toward the form
 * over the fortnight that followed the refusal, which is what
 * `TASK-verify-citations-must-scan-the-corpus-and-the-corpus-should` asked for,
 * and every one of those 223 claims is checked by nothing. Fifty-seven of them
 * are already wrong. Normalising a tree into a gate's form without the gate is
 * how you manufacture the exact silence the form was invented to end.
 *
 * So the tree is WALKED. It shipped behind `--corpus` on 2026-09-11 and the
 * number was put in front of the owner the same day; his ruling, that day, was
 * that the walk runs on EVERY run, reported and NOT gated — **on the reasoning
 * that the only way those 57 ever reached 57 is that nobody could see them.**
 * An opt-in measurement is taken by whoever already suspects the answer.
 *
 * The two halves of that are still not the same decision:
 *
 *   - **Walked by default**, by the ruling above. `--no-corpus` puts the tree
 *     back outside the walk for a caller who wants only the gated set, and it
 *     is named for what it does.
 *   - **Never gated**, because the GATE half of that task was CLOSED by owner
 *     ruling on 2026-09-07 (`plan:walk seq:140`, option A) and today's ruling
 *     did not reopen it — and because the 57 sit in items other work owns. The
 *     exit code is the documentation failures and nothing else, which is the
 *     property `THE EXIT CODE IS THE DOCUMENTATION FAILURES AND NOTHING ELSE`
 *     below exists to keep provable.
 *
 * **What this file rests on** —
 * `RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none`:
 *
 *   - `TASK-verify-citations-must-scan-the-corpus-and-the-corpus-should`
 *     (`plan:walk seq:30`) — the item this implements the surviving half of.
 *   - `STD-a-citation-names-a-file-a-verbatim-fragment-and-an-optional` — the
 *     form. One spelling, stated in the corpus and checked here.
 *   - `RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number` — the
 *     reason the line is a hint and never the identity.
 *   - `INV-nothing-is-dropped-silently` — why a tree the gate does not walk is
 *     named in the run rather than left to a header.
 *
 * Every test below is a PAIR, for the reason `citations-in-source.test.ts`
 * states at length: a walker's failure mode is silence, not a wrong answer, and
 * a walk that finds nothing reports zero broken and passes every green
 * assertion by being empty. So each one pins a COUNT as well as a verdict.
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
 * The cited file, and the whole of the anchor argument in five lines.
 *
 * `PRESENT` sits at line 8. An item written before the six-line preamble was
 * added cited it as `~2`, and `target.ts:2` was that citation's other spelling.
 * One of the two still finds the code; the other now names a blank line inside
 * a comment block and cannot say so.
 */
const TARGET = [
  '// a file with one citable line, and six lines of preamble that arrived',
  '// after the citations below were written — the ordinary edit, the one that',
  '// moves every line under it and breaks nothing.',
  '//',
  '// This is the line a `target.ts:2` pointer names today.',
  '//',
  '',
  'export function present(): void {',
  '}',
  '',
].join('\n');

const PRESENT = 'export function present(): void {';
const PRESENT_LINE = 8;
const GONE = "export function deletedLastMonth(): void {";

interface Probe {
  root: string;
  code: number;
  out: string;
  dispose(): void;
}

/**
 * Run the real script over a throwaway repo containing `src/target.ts` plus
 * whatever `files` names, which is where the item bodies go. No `docs/` content
 * and no source citations on purpose: every number on the corpus line below
 * came from the corpus.
 */
function probe(files: Record<string, string>, args: string[] = []): Probe {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-corpuscite-'));
  mkdirSync(path.join(root, 'scripts'), { recursive: true });
  mkdirSync(path.join(root, 'src'), { recursive: true });
  mkdirSync(path.join(root, 'docs', 'superpowers', 'plans'), { recursive: true });
  copyFileSync(SCRIPT, path.join(root, 'scripts', 'verify-citations.ts'));
  // `DOC_FILES` names the two front-door documents BY NAME and refuses to run
  // without them, so every throwaway tree has to carry them.
  writeFileSync(path.join(root, 'README.md'), '', 'utf8');
  writeFileSync(path.join(root, 'docs', 'README.he.md'), '', 'utf8');
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

/** `N citation(s) in M corpus item(s): A ok, B moved, …` — the corpus tally. */
function corpusTally(out: string): string {
  const m = /^(\d+ citation\(s\) in \d+ corpus item\(s\): .*)$/m.exec(out);
  assert.ok(m !== null, `no corpus summary line in:\n${out}`);
  return m[1]!;
}

/** An item file, minimal but real: front matter, a heading, then the body. */
function item(id: string, body: string): string {
  return `---\nid: ${id}\ntype: note\ntitle: "${id}"\nstatus: active\n---\n\n# ${id}\n\n${body}\n`;
}

const ITEM = '.my_context/items/note/NOTE-probe.md';

// ---------------------------------------------------------------------------
// The control and its plant. Everything below is worthless without them: a walk
// that finds nothing reports zero broken and passes every green assertion by
// being empty, which is the failure this whole script exists to name.
// ---------------------------------------------------------------------------

test('a citation in an item body is FOUND, counted on its own line, and resolves', () => {
  run(
    { [ITEM]: item('NOTE-probe', `It is at \`target.ts\` · \`${PRESENT}\` · ~${PRESENT_LINE}.`) },
    (p) => {
      // The exit code is NOT asserted here, and that is deliberate: a corpus
      // finding never sets it, so on a clean probe a green code proves nothing
      // that could ever go red. The claim belongs where it can fail, which is
      // `a corpus failure is REPORTED and never sets the exit code` below.
      assert.match(corpusTally(p.out), /^1 citation\(s\) in 1 corpus item\(s\): 1 ok, /);
    },
  );
});

test('the pair: a broken citation in an item body is REPORTED at its own file and line', () => {
  run(
    { [ITEM]: item('NOTE-probe', `It is at \`target.ts\` · \`${GONE}\`.`) },
    (p) => {
      assert.match(p.out, /BROKEN \.my_context\/items\/note\/NOTE-probe\.md:10/);
      assert.match(corpusTally(p.out), /1 broken/);
    },
  );
});

// ---------------------------------------------------------------------------
// The default, and the flag that undoes it. A tree walked by ruling has to
// prove that NO FLAG is what walks it — otherwise the number the owner ruled
// on is still being taken by whoever already suspects the answer, and every
// test above is passing on an argument nobody else's run receives.
// ---------------------------------------------------------------------------

test('NO FLAG AT ALL walks the corpus, and the run never says the tree was skipped', () => {
  run(
    { [ITEM]: item('NOTE-probe', `It is at \`target.ts\` · \`${GONE}\`.`) },
    (p) => {
      assert.match(p.out, /BROKEN \.my_context\/items\/note\/NOTE-probe\.md:10/);
      assert.doesNotMatch(p.out, /is not walked/);
    },
  );
});

test('`--no-corpus` puts the tree back outside the walk, and the run names the flag', () => {
  run(
    { [ITEM]: item('NOTE-probe', `It is at \`target.ts\` · \`${GONE}\`.`) },
    (p) => {
      assert.doesNotMatch(p.out, /NOTE-probe/);
      assert.match(p.out, /\.my_context\/items\/ is not walked on this run — `--no-corpus`/);
    },
    ['--no-corpus'],
  );
});

test('a corpus failure is REPORTED and never sets the exit code', () => {
  run(
    { [ITEM]: item('NOTE-probe', `It is at \`target.ts\` · \`${GONE}\`.`) },
    (p) => {
      assert.match(p.out, /1 corpus failure\(s\) above are REPORTED, not gated/);
      assert.equal(p.code, 0, p.out);
    },
  );
});

/**
 * **The property the default must not have moved, stated where it can fail.**
 *
 * Walking the corpus on every run puts 57 pre-existing failures in front of
 * every caller. The one thing that must not follow is that any of them reaches
 * the exit code: it is the documentation failures and nothing else, before this
 * change and after it. So this probe breaks BOTH trees at once and pins all
 * three halves of the answer — the code, the corpus tier's own disclaimer, and
 * the sentence that tells the reader whose the 1 is.
 */
test('THE EXIT CODE IS THE DOCUMENTATION FAILURES AND NOTHING ELSE', () => {
  run(
    {
      [ITEM]: item('NOTE-probe', `It is at \`target.ts\` · \`${GONE}\`.`),
      'docs/superpowers/plans/probe.md': `| a | \`target.ts\` · \`${GONE}\` |\n`,
    },
    (p) => {
      assert.equal(p.code, 1, p.out);
      assert.match(p.out, /1 corpus failure\(s\) above are REPORTED, not gated/);
      assert.match(p.out, /exit code, which is 1 for the documentation failures above/);
    },
  );
});

// ---------------------------------------------------------------------------
// THE ANCHOR, which is what the task was about. The same edit, the two forms.
// ---------------------------------------------------------------------------

test('THE ANCHOR: six lines inserted above the cited code leave the citation GREEN', () => {
  run(
    { [ITEM]: item('NOTE-probe', `It is at \`target.ts\` · \`${PRESENT}\` · ~2.`) },
    (p) => {
      assert.match(corpusTally(p.out), /0 ok, 1 moved, 0 ambiguous, 0 historical, 0 broken/);
      assert.match(p.out, /MOVED {2}\.my_context\/items\/note\/NOTE-probe\.md:10 {2}target\.ts {2}~2 → ~8/);
    },
  );
});

test('THE CONTRAST: the `file:line` spelling of that citation now names a comment', () => {
  // No script runs here. The claim is about the TREE, and it is the whole
  // argument for the form: `target.ts:2` is still a line that exists, still
  // resolves, still reads plausibly — and holds something else entirely.
  const lines = TARGET.split('\n');
  assert.equal(lines[PRESENT_LINE - 1], PRESENT);
  assert.notEqual(lines[1], PRESENT);
});

// ---------------------------------------------------------------------------
// The marker crosses into the corpus, where it already lives — and where its
// rule 1 belongs to somebody else.
// ---------------------------------------------------------------------------

test('a marker in an item body excuses a citation whose fragment is gone', () => {
  run(
    {
      [ITEM]: item(
        'NOTE-probe',
        `It was at \`target.ts\` · \`${GONE}\` <!-- historical-citation: quoted as the plan wrote it -->`,
      ),
    },
    (p) => {
      assert.match(p.out, /HIST {3}\.my_context\/items\/note\/NOTE-probe\.md:10/);
      assert.match(corpusTally(p.out), /0 broken/);
    },
  );
});

test('a marker excusing nothing in an item is NOT this script’s fault to raise', () => {
  // `checkCitationForm` (`src/doctor/checks.ts`) owns rule 1 inside an item
  // body, and it owns it under a DIFFERENT test: a marker there excuses a bare
  // `file:line` pointer, which this script cannot see and must not judge.
  // Raising a fault here would report every legitimate corpus marker as broken.
  run(
    {
      [ITEM]: item(
        'NOTE-probe',
        `It is at \`target.ts\` · \`${PRESENT}\` · ~${PRESENT_LINE} <!-- historical-citation: excuses nothing here -->`,
      ),
    },
    (p) => {
      assert.doesNotMatch(p.out, /MARKER/);
      assert.match(corpusTally(p.out), /1 ok, /);
    },
  );
});

// ---------------------------------------------------------------------------
// The corpus is its own tally. One combined total would let 223 corpus
// citations hide a documentation regression, which is the arithmetic version of
// the silence this script exists to end.
// ---------------------------------------------------------------------------

test('a corpus citation is counted on the corpus line, not among the documents', () => {
  run(
    {
      [ITEM]: item('NOTE-probe', `It is at \`target.ts\` · \`${PRESENT}\` · ~${PRESENT_LINE}.`),
      'docs/superpowers/plans/probe.md': `| a | \`target.ts\` · \`${PRESENT}\` · ~${PRESENT_LINE} |\n`,
    },
    (p) => {
      assert.match(corpusTally(p.out), /^1 citation\(s\) in 1 corpus item\(s\)/);
      assert.match(p.out, /^1 citation\(s\) in 3 document\(s\)/m);
    },
  );
});

// ---------------------------------------------------------------------------
// `--fix` and the corpus, which is the one place this script must not write.
// An item file is not a document: its front matter carries a checksum and a
// summary that the CLI recalculates on every write, so a hint rewritten here
// would leave the file claiming a checksum it no longer has. The refusal is the
// same shape as the wrapped-citation refusal — say so, and leave it alone.
// ---------------------------------------------------------------------------

test('--fix REFUSES to rewrite a hint inside an item, and says why', () => {
  const body = `It is at \`target.ts\` · \`${PRESENT}\` · ~2.`;
  run(
    { [ITEM]: item('NOTE-probe', body) },
    (p) => {
      assert.match(p.out, /skipped \.my_context\/items\/note\/NOTE-probe\.md:10/);
      assert.match(p.out, /mycontext edit/);
      assert.equal(
        readFileSync(path.join(p.root, ITEM), 'utf8'),
        item('NOTE-probe', body),
        'an item file must be left exactly as written',
      );
    },
    ['--fix'],
  );
});
