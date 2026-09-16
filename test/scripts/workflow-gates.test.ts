// @basis TASK-five-gates-are-wired-to-nothing-one-of-them-exits-1-today, CONST-zero-runtime-dependencies, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **The gates are wired, and this is what keeps them wired.**
 *
 * On 2026-09-13 five checks in this repository existed, were correct, were
 * fast — and ran nowhere. `check:needs-cycles`, `check:handover`,
 * `check:dependencies` and `check:cited-items` were in neither workflow;
 * `verify:citations` was in `release.yml` alone AND WAS RED, so every tag cut
 * that day would have failed at a gate no pull request exercised. Four of the
 * twelve blockers found by six reviews that week would have been caught by
 * gates that already existed.
 *
 * Every one of those gates has a test proving the CHECKER works. Not one of
 * them had a test proving the checker is RUN, and that is the gap this file
 * closes: a green `dependency-budget.test.ts` says the dependency budget can
 * be computed, never that anything computes it before a merge.
 *
 * **This file asserts wiring, not behaviour.** Whether a gate is correct is its
 * own test's question. Whether a gate is *reached* is this one's, and the two
 * fail for different reasons on purpose — a step deleted from `ci.yml` reddens
 * here and nowhere else.
 *
 * **The anti-vacuity tests come first, and here they matter more than usual.**
 * The workflows are YAML and this project has no YAML parser (zero runtime
 * dependencies, and none of the four devDependencies is one), so steps are
 * read with a line scan. A line scan that silently stopped matching would find
 * zero steps, conclude nothing is missing from a list of nothing, and report
 * every gate wired while seeing none of them. So the reader is first required
 * to find the steps that were already there before this item — and to find the
 * exact count, so a scan that matched everything is refused too.
 *
 * **`check:cited-items` is asserted ABSENT, with its reason.** That is not an
 * oversight preserved by accident. Its only three non-zero exits are
 * anti-vacuity guards; no finding it reports can set an exit code, and
 * `7d10c14d` excluded it from CI in as many words: "a never-gating check there
 * prints 224 lines into a green log and manufactures the appearance of
 * coverage". An exclusion nobody wrote down is indistinguishable from the
 * omission this whole item was filed about, so the absence is pinned and the
 * workflow is required to still carry the argument for it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');
const CI = path.join(REPO, '.github', 'workflows', 'ci.yml');
const RELEASE = path.join(REPO, '.github', 'workflows', 'release.yml');
const HOOK = path.join(REPO, '.githooks', 'pre-commit');

type Manifest = { scripts?: Record<string, string> };
const PACKAGE = JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8')) as Manifest;
const SCRIPTS = PACKAGE.scripts ?? {};

/**
 * Every package script the file RUNS, in the order it runs them.
 *
 * Deliberately narrow in one direction and complete in the other. It reads a
 * `run:` key — whether the step is bare (`- run: npm test`) or named (`- name:
 * … \n run: npm run test:e2e`) — and it reads NOTHING ELSE. Above all it does
 * not read a comment: half of both workflows is prose, and several of those
 * paragraphs name the very scripts below while arguing about them. A reader
 * that counted a comment would report a gate wired by the sentence explaining
 * why it is not.
 *
 * `npm ci` is not `npm run ci`. It installs, it is in both workflows, and
 * admitting it would put a script name in this list that `package.json` is
 * never going to define.
 */
function stepScripts(file: string): string[] {
  const found: string[] = [];
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:-\s+)?run:\s+npm\s+(run\s+)?(\S+)\s*$/.exec(raw);
    if (m === null) continue;
    if (m[1] === undefined && m[2] !== 'test') continue; // `npm ci`, and anything like it
    found.push(m[2]!);
  }
  return found;
}

const CI_STEPS = stepScripts(CI);
const RELEASE_STEPS = stepScripts(RELEASE);

// ── 0. Anti-vacuity: the reader can see the workflows at all ────────────────

/**
 * The four checks that were in `ci.yml` BEFORE this item, plus the suite. If
 * the scan cannot find these it cannot find anything, and every assertion
 * below would pass over an empty list.
 */
test('the reader finds the steps ci.yml already had before any gate was added', () => {
  for (const s of ['check:test-glob', 'check:basis', 'check:retired', 'check:text-files', 'check:vendor', 'typecheck', 'test']) {
    assert.ok(CI_STEPS.includes(s), `ci.yml: the scan did not find the pre-existing step ${s}`);
  }
});

test('the reader finds the steps release.yml already had', () => {
  for (const s of ['check:test-glob', 'check:basis', 'check:retired', 'check:text-files', 'typecheck', 'test', 'test:perf']) {
    assert.ok(RELEASE_STEPS.includes(s), `release.yml: the scan did not find the pre-existing step ${s}`);
  }
});

/**
 * The pair for the two above, and the half that a "found what I expected" check
 * cannot supply: a reader matching every line would satisfy both lists and this
 * whole file would be vacuous. An exact count refuses that. It is allowed to
 * move — a new step is a real change and updating this number is the deliberate
 * act that goes with it.
 */
test('the reader matches step lines ONLY — not the comments that name the same scripts', () => {
  assert.equal(CI_STEPS.length, 14, `ci.yml step scripts: ${CI_STEPS.join(', ')}`);
  assert.equal(RELEASE_STEPS.length, 13, `release.yml step scripts: ${RELEASE_STEPS.join(', ')}`);
});

test('a comment naming a script is not read as a step', () => {
  const ci = readFileSync(CI, 'utf8');
  assert.ok(
    /#[^\n]*check:cited-items/.test(ci),
    'ci.yml no longer argues in a comment about check:cited-items, so this test is not proving anything',
  );
  assert.ok(!CI_STEPS.includes('check:cited-items'), 'a commented script was read as a step');
});

// ── 1. The five gates, and where each one belongs ──────────────────────────

/**
 * `verify:citations` is here for the sharpest reason of the five: it was the
 * one gate that was RED, and the one gate only a tag cut ran. A commit on
 * master could — and on 2026-09-13 did — break it hours after a review counted
 * the breaks, with nothing looking.
 */
test('verify:citations gates a pull request, not only a tag cut', () => {
  assert.ok(CI_STEPS.includes('verify:citations'), 'verify:citations is not a step in ci.yml');
  assert.ok(RELEASE_STEPS.includes('verify:citations'), 'verify:citations is not a step in release.yml');
});

/** `CONST-zero-runtime-dependencies` is the promise a user installs on. */
test('check:dependencies runs in both workflows', () => {
  assert.ok(CI_STEPS.includes('check:dependencies'), 'check:dependencies is not a step in ci.yml');
  assert.ok(RELEASE_STEPS.includes('check:dependencies'), 'check:dependencies is not a step in release.yml');
});

/**
 * The only one of the five with no test file of its own, so before it was wired
 * it was gated by nothing anywhere — unlike `check:dependencies` and
 * `check:handover`, whose conditions ride `npm test` as standing assertions.
 */
test('check:needs-cycles runs in both workflows', () => {
  assert.ok(CI_STEPS.includes('check:needs-cycles'), 'check:needs-cycles is not a step in ci.yml');
  assert.ok(RELEASE_STEPS.includes('check:needs-cycles'), 'check:needs-cycles is not a step in release.yml');
});

test('check:handover runs in both workflows', () => {
  assert.ok(CI_STEPS.includes('check:handover'), 'check:handover is not a step in ci.yml');
  assert.ok(RELEASE_STEPS.includes('check:handover'), 'check:handover is not a step in release.yml');
});

/**
 * **The sixth gate, and the one whose wiring was the hardest to argue for.**
 *
 * `check:board` carries TWO tiers. The D map tier genuinely gates — an
 * unparsed row, a repeated number, a member naming nothing, one item under two
 * subjects. The drift tier — a commit named an item and the item is still open
 * — can never set an exit code, because a filing commit names its own item and
 * a partial landing is legitimate.
 *
 * A tier that cannot go red is EXACTLY what keeps `check:cited-items` out of
 * both workflows two tests above, and the distinction that admits this one is
 * that it does not travel alone: it rides a step whose other half fails the
 * run, so its output lands in a log whose greenness means something. That is
 * asserted here rather than left to the reader, by requiring the STEP to exist
 * AND the script it names to be the one that gates.
 */
test('check:board runs in both workflows', () => {
  assert.ok(CI_STEPS.includes('check:board'), 'check:board is not a step in ci.yml');
  assert.ok(RELEASE_STEPS.includes('check:board'), 'check:board is not a step in release.yml');
  assert.equal(
    SCRIPTS['check:board'], 'node scripts/check-board.ts',
    'the step runs a different script from the one whose gating tier admits it to a workflow',
  );
});

// ── 2. The one that is absent on purpose ───────────────────────────────────

test('check:cited-items is in NEITHER workflow, because nothing it finds can fail a run', () => {
  assert.ok(!CI_STEPS.includes('check:cited-items'), 'check:cited-items was added to ci.yml; its only non-zero exits are anti-vacuity guards, so it would be a step that cannot go red');
  assert.ok(!RELEASE_STEPS.includes('check:cited-items'), 'check:cited-items was added to release.yml; see the comment in ci.yml');
});

/**
 * An absence is only a decision while the reason is written next to it. Without
 * this, the paragraph could be deleted and the absence above would read as the
 * very omission this item was filed to repair.
 */
test('the workflow still carries the argument for that absence', () => {
  const ci = readFileSync(CI, 'utf8');
  assert.match(ci, /check:cited-items/, 'ci.yml no longer names check:cited-items at all');
  assert.match(ci, /manufactures the appearance of coverage/, 'ci.yml no longer records WHY check:cited-items is excluded');
});

// ── 3. The relation between the two workflows ──────────────────────────────

/**
 * `release.yml` re-verifies because "a tag can be placed on any commit, and the
 * one thing that must never happen is a release page pointing at a tree nobody
 * verified" — its own words. A gate master runs and a tag does not inverts that
 * sentence, and `check:vendor` was exactly that hole until 2026-09-13: a tagged
 * build could publish a patched vendored asset master would have rejected.
 *
 * `test:e2e` is the ONE admitted exception and it is named rather than
 * filtered silently: `ci.yml` argues at length that the browser suite is
 * ubuntu-only, costs a 275 MB download, and that Chromium is Chromium. Adding
 * it to a tag cut buys no signal. Every other step is required.
 */
const RELEASE_MAY_SKIP = ['test:e2e'];

test('every gate ci.yml runs, release.yml runs too', () => {
  const missing = CI_STEPS.filter((s) => !RELEASE_STEPS.includes(s) && !RELEASE_MAY_SKIP.includes(s));
  assert.deepEqual(missing, [], 'release.yml verifies LESS than the commits it is cut from');
});

/** The pair: an exemption nobody uses is an exemption nobody removed. */
test('the one exemption from that superset is actually taken', () => {
  for (const s of RELEASE_MAY_SKIP) {
    assert.ok(CI_STEPS.includes(s), `${s} is exempted from release.yml but ci.yml does not run it either`);
    assert.ok(!RELEASE_STEPS.includes(s), `${s} is now in release.yml, so the exemption is dead and should be deleted`);
  }
});

/**
 * Two seconds against a twelve-minute suite. `ci.yml` argues this ordering in
 * its own words for the browser suite; the same trade decides this.
 */
test('the cheap citation gate runs before the suite in both workflows', () => {
  for (const [name, steps] of [['ci.yml', CI_STEPS], ['release.yml', RELEASE_STEPS]] as const) {
    const gate = steps.indexOf('verify:citations');
    const suite = steps.indexOf('test');
    assert.ok(gate !== -1 && suite !== -1, `${name}: one of the two steps is missing`);
    assert.ok(gate < suite, `${name}: verify:citations runs after npm test, so a tag waits twelve minutes to hear a two-second verdict`);
  }
});

// ── 4. A step that names a script nobody defined ───────────────────────────

/**
 * The failure this cannot be allowed to have: a gate LISTED in a workflow whose
 * script name is a typo. `npm run` exits non-zero on an unknown script, so it
 * would fail loudly in CI — but only after a push, and only if anyone reads
 * past "npm ERR! Missing script". Here it is a named test.
 */
test('every script a workflow runs is a script package.json defines', () => {
  for (const [name, steps] of [['ci.yml', CI_STEPS], ['release.yml', RELEASE_STEPS]] as const) {
    for (const s of steps) {
      assert.ok(
        Object.hasOwn(SCRIPTS, s),
        `${name} runs "npm run ${s}", which package.json does not define`,
      );
    }
  }
});

// ── 5. The hook ────────────────────────────────────────────────────────────

/**
 * The hook is a SECOND, faster copy of one gate CI already runs — never a gate
 * of its own. That is the whole of why it is safe to have: `.git/hooks` is not
 * versioned and `--no-verify` exists, so anything gated only here is gated by
 * every developer's local configuration, which is not gating. If this ever
 * fails, the repair is to add the gate to CI, not to widen the list here.
 */
test('nothing is gated by the hook alone — every check it runs is also in CI', () => {
  assert.ok(existsSync(HOOK), '.githooks/pre-commit does not exist');
  const hook = readFileSync(HOOK, 'utf8');
  const ran = [...hook.matchAll(/node\s+scripts\/([\w-]+)\.ts/g)].map((m) => m[1]!);
  assert.deepEqual(ran, ['check-dependency-budget'], `the hook runs ${ran.join(', ')}`);
  for (const script of ran) {
    const wired = CI_STEPS.filter((s) => SCRIPTS[s] === `node scripts/${script}.ts`);
    assert.ok(wired.length > 0, `the hook runs scripts/${script}.ts, which no ci.yml step runs`);
  }
});

/**
 * An uninstalled hook is a gate wired to nothing, which is the defect this item
 * exists to repair. The install is therefore one command, and it is in the
 * manifest rather than in prose somebody has to find.
 */
test('the hook can be installed in one command, and that command points at this directory', () => {
  assert.equal(SCRIPTS['hooks:install'], 'git config core.hooksPath .githooks');
});

/**
 * The narrowness IS the design: this tree routinely holds several lanes'
 * uncommitted work at once, and a hook that walked the corpus or the source
 * would redden on a neighbour's half-finished edit and be gone within the week.
 * So it reads the manifest and one corpus item, and it only wakes when one of
 * the two is staged.
 */
test('the hook wakes for the manifest and for the constraint the budget is parsed from', () => {
  const hook = readFileSync(HOOK, 'utf8');
  assert.match(hook, /package\.json/, 'the hook does not mention package.json');
  assert.match(hook, /CONST-zero-runtime-dependencies\.md/, 'the hook ignores the item the budget is PARSED OUT OF, so widening the budget there would slip past it');
  assert.match(hook, /--diff-filter=ACMR/, 'the hook no longer scopes itself to the staged set');
  assert.ok(
    existsSync(path.join(REPO, '.my_context', 'items', 'constraint', 'CONST-zero-runtime-dependencies.md')),
    'the constraint file the hook watches for does not exist at that path',
  );
});

/* ── A GATE'S TEST CAN BE REACHED AND STILL NOT RUN ────────────────────────── */

/**
 * **A script that exits at module scope deletes the test file that imports it,
 * silently and green.**
 *
 * Six of this project's checkers are proved by a test that IMPORTS the script
 * and calls its pure functions. That only works because each script guards its
 * own entry point — `scripts/e2e-gate.ts` has said so in a comment since it was
 * written. `scripts/check-needs-cycles.ts` did not, and the measurement is
 * exact: with its guard removed, `node --test test/scripts/needs-cycles.test.ts`
 * reports `tests 1 · pass 1 · fail 0` and exits 0. Eleven cases were gone. The
 * suite was green. The import killed the process before the first assertion ran.
 *
 * That is why this lives HERE and not in the file it protects: no assertion
 * inside an importing test file survives the defect. This file imports no
 * script, so it still runs.
 *
 * The set is DERIVED from the tree on every run — every `../../scripts/<x>.ts`
 * any test file imports — never a list. A seventh checker proved the same way
 * tomorrow is covered the day it is written.
 */
test('every script a test imports guards its entry point, or importing it ends the run', () => {
  const testFiles = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...testFiles(full));
      else if (entry.name.endsWith('.test.ts')) out.push(full);
    }
    return out;
  };

  const imported = new Set<string>();
  const files = testFiles(path.join(REPO, 'test'));
  assert.ok(files.length > 0, 'no test files were found at all, so this scan measured nothing');
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    // An `import`, never a mention. Measured: `test/scripts/verify-citations.test.ts`
    // holds that script's path in a `new URL(...)` in order to SPAWN it, and a
    // spawned script's module-scope exit is its job rather than a hazard. A
    // matcher that read any quoted path reported it as an offender on the first
    // run — a checker wrong on its first run is a checker switched off on its
    // second, so the matcher asks for the import keyword.
    for (const m of src.matchAll(
      /(?:from|import)\s*\(?\s*['"](?:\.\.\/)+scripts\/([A-Za-z0-9-]+\.ts)['"]/g,
    )) {
      imported.add(m[1]!);
    }
  }
  // Anti-vacuity. A regex that stopped matching would report zero imported
  // scripts and conclude every one of them is guarded.
  assert.ok(
    imported.size > 0,
    'no test file imports any script under scripts/, which cannot be true of this tree — the '
    + 'import scan is broken, not the scripts',
  );

  const unguarded: string[] = [];
  for (const name of [...imported].sort()) {
    const p = path.join(REPO, 'scripts', name);
    if (!existsSync(p)) { unguarded.push(`${name}: imported by a test and does not exist`); continue; }
    for (const [i, line] of readFileSync(p, 'utf8').split('\n').entries()) {
      // Column 0 is module scope: an `if (isMain())` guard, or any function
      // body, indents. This is the whole discrimination and it is exact for
      // this tree's style.
      if (/^process\.exit\(/.test(line)) unguarded.push(`scripts/${name}:${i + 1}: ${line.trim()}`);
    }
  }
  assert.deepEqual(
    unguarded, [],
    'these scripts exit at module scope and are imported by a test file. Importing one ends the '
    + 'importing process: every case in that file disappears from the run and the runner reports '
    + 'GREEN over it. Guard the call — `if (isMain()) process.exit(main());`, as scripts/e2e-gate.ts '
    + `and scripts/check-needs-cycles.ts do:\n${unguarded.join('\n')}`,
  );
});
