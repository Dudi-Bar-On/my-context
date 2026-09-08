// @basis TASK-a-new-test-declares-what-it-rests-on-and-the-gate-accepts, TASK-an-item-names-the-tests-that-cover-it-through-the-scope-it, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **The basis gate, proved by planting every declaration it must refuse.**
 *
 * `scripts/check-basis.ts` asks one question of every test file: does it say
 * what it rests on. A checker is not verified until it has been made red
 * (`RULE-a-regression-test-is-worth-nothing-until-you-have-watched-it`), so
 * every clause below is demonstrated by PLANTING the thing it must complain
 * about and requiring the specific complaint — and the process itself is run
 * against a planted tree and required to exit 1.
 *
 * **The anti-vacuity pass comes first and matters most.** Every plant is
 * worthless if the walker cannot see the real tree: a suffix that stopped
 * matching, or a header rule that stopped finding declarations, would report
 * zero missing declarations across 490 files it never opened. That is the exact
 * failure — a report correct about what it measured and silent about what it
 * missed — this whole family of checks exists to end. So the walker is first
 * required to find the REAL files, the REAL six declarations and the REAL
 * baseline.
 *
 * **This file is its own hardest fixture.** It contains dozens of `@basis`
 * strings below its header, every one of them a plant. `parseBasis` reads only
 * the run of comment and blank lines at the TOP of a file, so all of them are
 * out of reach by construction — and that property is asserted here against
 * this file's own bytes rather than assumed.
 *
 * Read-only throughout. Nothing writes to `.my_context/`, nothing writes into
 * `test/` or `e2e/`, and every planted tree is built under the OS temp
 * directory and removed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLayer } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { RETIRED_STATUSES } from '../../src/core/select.ts';
import { readCorpus, type Corpus } from '../../scripts/check-handover.ts';
import {
  BASELINE_FILE, BASIS_MARKER, LANE_SPELLING, REASON_MIN_CHARS, REASON_MIN_WORDS, WHOLE_ITEM_ID,
  build, headerLines, helperFiles, parseBaseline, parseBasis, renderItems, rootFrom, summary,
  testFiles,
} from '../../scripts/check-basis.ts';
import { removeTree } from '../helpers/tmp.ts';
import type { Item } from '../../src/core/types.ts';

const REPO = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'check-basis.ts');

const ws = resolveWorkspace(REPO);
const ITEMS: Item[] = ws.projectRoot === null ? [] : loadLayer(ws.projectRoot, 'project', [], ws.config);
const CORPUS: Corpus | null = ws.projectRoot === null ? null : readCorpus(ITEMS, ws.config);

/** The corpus must be real for any of the resolution assertions to mean anything. */
function corpus(): Corpus {
  assert.ok(CORPUS !== null, 'the real corpus must load for these tests to mean anything');
  assert.ok(ITEMS.length > 100, 'the real corpus must be loaded, not an empty stand-in');
  return CORPUS;
}

/** A one-line header, the way every declaration in the tree is actually written. */
const decl = (line: string): string => `${line}\nimport { test } from 'node:test';\n`;

// ── ANTI-VACUITY: the walker sees the real tree ─────────────────────────────

test('the walker finds the real test tree, not an empty one', () => {
  const files = testFiles(REPO);
  assert.ok(files.length > 400, `expected the real suite, walked ${files.length} file(s)`);
  for (const known of [
    'test/core/select.test.ts',
    'test/hooks/session-start-restore.test.ts',
    'test/scripts/basis-gate.test.ts',
    'e2e/composer-execute.spec.ts',
  ]) {
    assert.ok(files.includes(known), `${known} must be walked`);
  }
  // The suffix rule, in both directions: helpers are seen and are not gated.
  assert.ok(!files.includes('e2e/app.ts'), 'a helper is not a gated test file');
  assert.ok(helperFiles(REPO).includes('e2e/app.ts'), 'a helper is still walked, for the report');
  assert.equal(
    files.filter((f) => helperFiles(REPO).includes(f)).length, 0,
    'the gated set and the helper set must be disjoint',
  );
});

test('the real declarations in the tree are found and every one resolves', () => {
  const c = corpus();
  const found: string[] = [];
  for (const file of [...testFiles(REPO), ...helperFiles(REPO)]) {
    const d = parseBasis(readFileSync(path.join(REPO, ...file.split('/')), 'utf8'), c);
    if (d.kind === 'missing') continue;
    found.push(file);
    assert.notEqual(d.kind, 'malformed', `${file}: ${d.why}`);
    for (const id of d.ids) assert.notEqual(id.id, null, `${file} declares ${id.raw}, which resolves to nothing`);
  }
  assert.ok(found.length >= 10, `expected the tree's real declarations, found ${found.length}`);
  for (const known of [
    'test/scripts/cited-items.test.ts',
    'test/scripts/handover-check.test.ts',
    'e2e/composer-bidi.spec.ts',
    'e2e/composer-run.ts',
  ]) {
    assert.ok(found.includes(known), `${known} declares a basis in the tree and must be seen`);
  }
});

test('this file carries exactly one declaration although it is full of planted ones', () => {
  const text = readFileSync(path.join(REPO, 'test', 'scripts', 'basis-gate.test.ts'), 'utf8');
  const everywhere = text.split('\n').filter((l) => l.includes('@basis')).length;
  assert.ok(everywhere > 10, `this file must plant many markers; it has ${everywhere}`);
  const header = headerLines(text);
  // The header MENTIONS `@basis` in prose as well as declaring one, which is
  // the sharper case: only a line whose comment payload STARTS with the marker
  // is a declaration, so a docblock that talks about the convention is not
  // accidentally a second answer.
  assert.ok(
    header.filter((l) => l.includes('@basis')).length > 1,
    'this header must both declare and discuss, or the next assertion proves nothing',
  );
  assert.equal(
    header.filter((l) => BASIS_MARKER.test(l)).length, 1,
    'only the header declaration may be visible to the parser',
  );
  const d = parseBasis(text, corpus());
  assert.equal(d.kind, 'items');
  assert.ok(d.ids.some((i) => i.id === 'RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none'));
});

test('the baseline accounts for every silence in the real tree', () => {
  const c = corpus();
  const baseline = parseBaseline(readFileSync(path.join(REPO, ...BASELINE_FILE.split('/')), 'utf8'));
  const report = build(REPO, testFiles(REPO), baseline, c);
  assert.equal(
    report.declaredItems + report.declaredNone
      + report.undeclaredBaselined.length + report.undeclaredNew.length,
    report.filesWalked,
    'every walked file must be accounted for as declared, exempt, or gated',
  );
  assert.ok(report.declaredItems + report.declaredNone >= 6, 'the real declarations must be counted');
  assert.ok(report.covers.size >= 6, 'the inverse direction must name the real items');
  // Whether the tree is GREEN is the gate's own claim, asserted once at the
  // process level below. It is not repeated here: a lane that adds an
  // undeclared test file has not broken this checker, and a suite that says
  // otherwise sends the next reader to debug the wrong file.
});

/**
 * The ceiling, and the reason it is a ceiling rather than an equality.
 *
 * The baseline exempts the files that predate the rule. It shrinks whenever
 * somebody declares an old file's basis, which is welcome and must not fail the
 * suite; it may never grow, because the only way to grow it is to smuggle a new
 * file into the exemption instead of declaring it. Lower this number when it
 * shrinks; never raise it.
 */
test('the exemption list may only shrink', () => {
  const baseline = parseBaseline(readFileSync(path.join(REPO, ...BASELINE_FILE.split('/')), 'utf8'));
  assert.ok(
    baseline.length <= 475,
    `${BASELINE_FILE} has grown to ${baseline.length} entries. A new test file declares its ` +
      'basis; it is not added here.',
  );
  for (const entry of baseline) {
    assert.ok(entry.startsWith('test/') || entry.startsWith('e2e/'), `${entry} is not a test path`);
    assert.ok(
      entry.endsWith('.test.ts') || entry.endsWith('.spec.ts'),
      `${entry} is not a gated test file, so exempting it exempts nothing`,
    );
  }
  // An entry naming a DELETED file is not asserted against here. The script
  // reports it and deliberately does not gate on it, and a suite that gated
  // where the gate does not would make an ordinary rename fail `npm test`.
});

// ── THE GRAMMAR, EVERY BRANCH PLANTED ───────────────────────────────────────

test('a file with no declaration is MISSING, not silently accepted', () => {
  const d = parseBasis("import { test } from 'node:test';\n", corpus());
  assert.equal(d.kind, 'missing');
});

test('a declaration below the header is invisible, so a fixture cannot forge one', () => {
  const text = "import { test } from 'node:test';\n\n// @basis RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none\n";
  assert.equal(parseBasis(text, corpus()).kind, 'missing');
});

test('a bare `none` does not pass, and the refusal says why', () => {
  const d = parseBasis(decl('// @basis none'), corpus());
  assert.equal(d.kind, 'malformed');
  assert.match(d.why, /bare `none` does not pass/);
});

test('`none` with a reason too short to be evidence does not pass', () => {
  const d = parseBasis(decl('// @basis none - n/a'), corpus());
  assert.equal(d.kind, 'malformed');
  assert.match(d.why, /at least 3 words and 12 characters/);
});

test("the rule's own example passes, and is the exact floor", () => {
  const d = parseBasis(decl('// @basis none - pure parser mechanics'), corpus());
  assert.equal(d.kind, 'none');
  assert.equal(d.reason, 'pure parser mechanics');
  assert.equal(d.reason.split(/\s+/).length, REASON_MIN_WORDS);
  assert.equal(d.reason.length, 21);
  assert.ok(REASON_MIN_CHARS <= 21, 'the floor must admit the rule’s own example');
  // One word shorter fails, which is what makes the floor a floor rather than a
  // decoration.
  assert.equal(parseBasis(decl('// @basis none - parser mechanics'), corpus()).kind, 'malformed');
});

test('@basis with nothing after it is refused', () => {
  const d = parseBasis(decl('// @basis'), corpus());
  assert.equal(d.kind, 'malformed');
  assert.match(d.why, /nothing after it/);
});

test('two declarations in one header are refused rather than one being picked', () => {
  const text = '// @basis none - pure parser mechanics\n// @basis none - a second answer entirely\n' +
    "import { test } from 'node:test';\n";
  const d = parseBasis(text, corpus());
  assert.equal(d.kind, 'malformed');
  assert.match(d.why, /2 @basis lines/);
});

test('a real id resolves, and a docblock spelling is read the same as a line comment', () => {
  const id = 'RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none';
  const line = parseBasis(decl(`// @basis ${id}`), corpus());
  assert.equal(line.kind, 'items');
  assert.deepEqual(line.ids.map((i) => i.id), [id]);
  const block = parseBasis(`/**\n * @basis ${id}\n */\nimport x from 'y';\n`, corpus());
  assert.equal(block.kind, 'items');
  assert.deepEqual(block.ids.map((i) => i.id), [id]);
});

/**
 * The reuse that is the point of the task: `resolveId` from
 * `check-handover.ts`, not a second exact-match scan. Nine of
 * `check-cited-items.ts`'s 56 sites are shortened or hyphen-broken, so an
 * exact-match gate would refuse ids this corpus really writes.
 */
test('a shortened id and a line-wrapped id both resolve, through the shared resolver', () => {
  const full = 'RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none';
  for (const written of ['RULE-a-test-names-the-items-it-rests', 'RULE-a-test-names-the-items-it-rests-']) {
    const d = parseBasis(decl(`// @basis ${written}`), corpus());
    assert.equal(d.kind, 'items', `${written} must parse`);
    assert.deepEqual(d.ids.map((i) => i.id), [full], `${written} must resolve to ${full}`);
  }
});

test('an ambiguous prefix is refused with the count, not resolved to the first match', () => {
  const d = parseBasis(decl('// @basis TASK-the-conversation'), corpus());
  assert.equal(d.kind, 'items');
  assert.equal(d.ids[0]!.id, null);
  assert.match(d.ids[0]!.why!, /items start with it/);
});

test('several ids on one line, and a list wrapped after a comma, both parse', () => {
  const a = 'RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none';
  const b = 'TASK-a-new-test-declares-what-it-rests-on-and-the-gate-accepts';
  const one = parseBasis(decl(`// @basis ${a}, ${b}`), corpus());
  assert.deepEqual(one.ids.map((i) => i.id), [a, b]);
  const wrapped = parseBasis(`// @basis ${a},\n//        ${b}\nimport x from 'y';\n`, corpus());
  assert.equal(wrapped.kind, 'items');
  assert.deepEqual(wrapped.ids.map((i) => i.id), [a, b]);
});

test('a token that is not an id at all is refused by name', () => {
  const d = parseBasis(decl('// @basis the admission rule'), corpus());
  assert.equal(d.kind, 'malformed');
  assert.match(d.why, /"the".*is not an item id/);
});

/**
 * The habit this gate has to expect. Every one of `cdc9fd8`'s ten repair
 * comments named `plan:budget seq:16`, and `test/` and `e2e/` carry 150+ lane
 * references in that spelling and in the backticked one. Refusing them with
 * "not an item id" and nothing else would send a writer to guess; the refusal
 * resolves the lane and prints the id.
 */
test('a lane is refused, and the refusal names the item to write instead', () => {
  const expected = 'TASK-the-pinned-tier-sits-half-empty-while-sixty-nine-governing';
  for (const written of ['plan:budget seq:16', '`budget/16`', 'budget/16']) {
    assert.ok(LANE_SPELLING.test(written), `${written} must be recognised as a lane spelling`);
    const d = parseBasis(decl(`// @basis ${written}`), corpus());
    assert.equal(d.kind, 'malformed', `${written} must not pass as a declaration`);
    assert.match(d.why, /is a lane, not an item id/);
    assert.match(d.why, new RegExp(expected), `the refusal must name ${expected}`);
  }
});

test('a lane nothing answers to is refused, and says so rather than naming nothing', () => {
  const d = parseBasis(decl('// @basis plan:nosuchplan seq:9'), corpus());
  assert.equal(d.kind, 'malformed');
  assert.match(d.why, /no task answers to that lane/);
});

/**
 * The one place this deliberately differs from `check-cited-items.ts`.
 *
 * `resolveId` returns `skip` for a short `CAPS-lowercase` string whose prefix
 * the corpus does not use — `UI-side`, `MCP-only`, `SVG-blind`, `NUL-byte` —
 * because in running prose those are English compounds and reporting them made
 * that checker wrong four times on its first run. A DECLARATION is not prose:
 * every token after `@basis` is a claim, so the same string is a finding here.
 */
test('an id-shaped token the prose scanner would skip is still a finding in a declaration', () => {
  const c = corpus();
  const d = parseBasis(decl('// @basis UI-side'), c);
  assert.equal(d.kind, 'items', 'it is shaped like a declaration');
  assert.equal(d.ids[0]!.id, null, 'and it must not be silently accepted');
  assert.equal(d.ids[0]!.why, 'no item answers to it');
  assert.ok(WHOLE_ITEM_ID.test('UI-side'), 'the grammar admits it; the corpus is what refuses it');
});

test('an invented id is DANGLING and sets the exit code', () => {
  const c = corpus();
  const dir = plantTree([{ file: 'test/planted.test.ts', body: decl('// @basis DEC-a-ruling-nothing-in-this-corpus-answers-to-at-all') }]);
  try {
    const report = build(dir, testFiles(dir), [], c);
    assert.deepEqual(report.findings.map((f) => f.tier), ['DANGLING']);
    assert.equal(report.findings[0]!.gates, true);
  } finally {
    removeTree(dir);
  }
});

// ── THE TIERS: what gates, and what only reports ────────────────────────────

/** A throwaway tree with a `test/` root and, optionally, a baseline file. */
function plantTree(files: Array<{ file: string; body: string }>, baseline?: string[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-basis-'));
  for (const { file, body } of files) {
    const full = path.join(dir, ...file.split('/'));
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, body, 'utf8');
  }
  if (baseline !== undefined) {
    mkdirSync(path.join(dir, 'scripts'), { recursive: true });
    writeFileSync(
      path.join(dir, ...BASELINE_FILE.split('/')),
      `# planted\n${baseline.join('\n')}\n`,
      'utf8',
    );
  }
  return dir;
}

test('a missing declaration gates, and the baseline exempts SILENCE only', () => {
  const c = corpus();
  const dir = plantTree([{ file: 'test/quiet.test.ts', body: "import x from 'y';\n" }]);
  try {
    const gated = build(dir, testFiles(dir), [], c);
    assert.deepEqual(gated.findings.map((f) => f.tier), ['MISSING']);
    assert.equal(gated.findings[0]!.gates, true);
    assert.match(gated.findings[0]!.why, /`none` is a legal answer/);

    const exempt = build(dir, testFiles(dir), ['test/quiet.test.ts'], c);
    assert.deepEqual(exempt.findings, []);
    assert.deepEqual(exempt.undeclaredBaselined, ['test/quiet.test.ts']);
    assert.deepEqual(exempt.undeclaredNew, []);
  } finally {
    removeTree(dir);
  }
});

test('a baselined file that carries a BROKEN declaration still gates', () => {
  const c = corpus();
  const dir = plantTree([{ file: 'test/quiet.test.ts', body: decl('// @basis none') }]);
  try {
    const report = build(dir, testFiles(dir), ['test/quiet.test.ts'], c);
    assert.deepEqual(report.findings.map((f) => f.tier), ['MALFORMED']);
    assert.equal(report.findings[0]!.gates, true);
  } finally {
    removeTree(dir);
  }
});

/**
 * RETIRED reports and never gates, on the ruling `check-cited-items.ts` records:
 * a test resting on a superseded ruling is often correct as history, and a gate
 * that forced the edit would delete history to go green.
 */
test('a declaration naming a retired item is reported with its successor and does not gate', () => {
  const c = corpus();
  const retired = ITEMS.find((i) => RETIRED_STATUSES.has(i.status));
  assert.ok(retired !== undefined, 'the corpus must hold a retired item for this to mean anything');
  const dir = plantTree([{ file: 'test/old.test.ts', body: decl(`// @basis ${retired.id}`) }]);
  try {
    const report = build(dir, testFiles(dir), [], c);
    assert.deepEqual(report.findings.map((f) => f.tier), ['RETIRED']);
    assert.equal(report.findings[0]!.gates, false, 'RETIRED must never set the exit code');
    assert.match(report.findings[0]!.why, new RegExp(retired.status));
    assert.deepEqual(report.covers.get(retired.id), ['test/old.test.ts'],
      'a retired item is still covered by the test that names it');
  } finally {
    removeTree(dir);
  }
});

test('spent baseline entries are reported, never gated', () => {
  const c = corpus();
  const dir = plantTree([
    { file: 'test/declared.test.ts', body: decl('// @basis none - pure parser mechanics') },
  ]);
  try {
    const report = build(dir, testFiles(dir), ['test/declared.test.ts', 'test/deleted.test.ts'], c);
    assert.deepEqual(report.findings, []);
    assert.deepEqual(report.baselineSpent, ['test/declared.test.ts']);
    assert.deepEqual(report.baselineDead, ['test/deleted.test.ts']);
  } finally {
    removeTree(dir);
  }
});

// ── THE PROCESS: watched red, then watched green ────────────────────────────

function run(args: string[], cwd = REPO): { status: number; out: string } {
  try {
    return { status: 0, out: execFileSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8' }) };
  } catch (e) {
    const err = e as { status?: number | null; stdout?: string };
    return { status: err.status ?? -1, out: err.stdout ?? '' };
  }
}

test('the gate exits 1 on a planted tree with an undeclared test file', () => {
  const dir = plantTree([{ file: 'test/planted.test.ts', body: "import x from 'y';\n" }], []);
  try {
    const { status, out } = run(['--root', dir]);
    assert.equal(status, 1, `expected a red exit; output was:\n${out}`);
    assert.match(out, /MISSING test\/planted\.test\.ts/);
    assert.match(out, /1 finding\(s\) set the exit code/);
  } finally {
    removeTree(dir);
  }
});

test('the same tree exits 0 once the file declares what it rests on', () => {
  const dir = plantTree(
    [{ file: 'test/planted.test.ts', body: decl('// @basis none - pure parser mechanics') }],
    [],
  );
  try {
    const { status, out } = run(['--root', dir]);
    assert.equal(status, 0, `expected a green exit; output was:\n${out}`);
    assert.match(out, /1 say `none` with a reason/);
  } finally {
    removeTree(dir);
  }
});

/**
 * The one place the REAL tree's greenness is asserted, and it is asserted at
 * the process level because that is the claim being made: `npm run check:basis`
 * exits 0 here today, which is what lets it be added to `ci.yml`. If this goes
 * red, a test file was added without a declaration — the message says so, and
 * the repair is in that file, never in this one.
 */
test('the gate is green on this repository, which is what lets it live in CI', () => {
  const { status, out } = run(['--quiet']);
  assert.equal(
    status, 0,
    'a test file was added without a `// @basis` declaration. Name the item ids it rests on, ' +
      `or write \`// @basis none - <why>\`. The gate says:\n${out}`,
  );
  assert.match(out, /0 do not and are gated/);
});

/**
 * A missing baseline is refused rather than reported. Without it every one of
 * the 484 files that predate the rule reads as new, and the gate would demand
 * hundreds of declarations nobody can honestly write — the fabrication the rule
 * exists to prevent, produced by the gate enforcing it.
 */
test('a tree with no baseline file is refused, not reported as 484 findings', () => {
  const dir = plantTree([{ file: 'test/planted.test.ts', body: "import x from 'y';\n" }]);
  try {
    const { status, out } = run(['--root', dir]);
    assert.equal(status, 1);
    assert.match(out, /is missing or unreadable/);
    assert.doesNotMatch(out, /MISSING/, 'it must refuse rather than list findings');
  } finally {
    removeTree(dir);
  }
});

test('a run that checked nothing does not exit 0', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-basis-empty-'));
  try {
    const { status, out } = run(['--quiet'], dir);
    assert.equal(status, 1, 'no workspace must not read as success');
    assert.match(out, /nothing was checked/);
  } finally {
    removeTree(dir);
  }
});

test('--root is the only thing redirected: ids still resolve against the real corpus', () => {
  const dir = plantTree(
    [{
      file: 'test/planted.test.ts',
      body: decl('// @basis RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none'),
    }],
    [],
  );
  try {
    const { status, out } = run(['--root', dir, '--items']);
    assert.equal(status, 0, out);
    assert.match(out, /RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none/);
  } finally {
    removeTree(dir);
  }
});

test('rootFrom defaults to this repository and is not a general configuration knob', () => {
  assert.equal(rootFrom([]), REPO);
  assert.equal(rootFrom(['--quiet']), REPO);
  assert.equal(rootFrom(['--root']), REPO, 'a --root with no value must not resolve to cwd');
  assert.equal(rootFrom(['--root', tmpdir()]), path.resolve(tmpdir()));
});

// ── THE INVERSE DIRECTION (plan:basis seq:1) ────────────────────────────────

/**
 * The measurement that decides `plan:basis seq:1`: `scope` cannot say which of
 * two things a test path means. Both spellings are printed side by side so a
 * reader can compare them without re-taking the measurement.
 */
test('the inverse report names both spellings and marks the ones scope cannot express', () => {
  const c = corpus();
  const baseline = parseBaseline(readFileSync(path.join(REPO, ...BASELINE_FILE.split('/')), 'utf8'));
  const report = build(REPO, testFiles(REPO), baseline, c);
  const out = renderItems(report, ITEMS);
  assert.match(out, /item\(s\) are named by a test's @basis declaration/);
  assert.match(out, /name a test path in `scope` instead/);
  // The rule itself is the case in point: its scope is `test/**`, so a covering
  // test added there would be indistinguishable from what it governs.
  assert.match(out, /RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none.*test\/\*\*/);
  assert.match(out, /file-level coverage invisible/);
});

test('the summary states the gap and the blind spot rather than only the green', () => {
  const c = corpus();
  const baseline = parseBaseline(readFileSync(path.join(REPO, ...BASELINE_FILE.split('/')), 'utf8'));
  const text = summary(build(REPO, testFiles(REPO), baseline, c), false);
  assert.match(text, /predate the rule and are exempt/);
  assert.match(text, /BLIND SPOT/);
  assert.match(text, /VERIFIES, never what it ASSUMES/);
});
