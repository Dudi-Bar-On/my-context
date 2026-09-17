// @basis TASK-code-and-tests-that-speak-with-a-retired-item-s-authority, TASK-std-absent-vs-zero-is-a-nickname-22-citations-use-and-no, RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none, TASK-ten-thousand-lines-of-documentation-are-held-by-one-gate
/**
 * **The retired-authority check, proved by planting what it must name.**
 *
 * `scripts/check-cited-items.ts` exists because a comment in `e2e/app.ts` cited
 * `DEC-the-ui-is-developed-against-a-simulated-corpus-until-the` as *"the
 * owner's standing ruling"* for weeks after it had been superseded, and a
 * session reasoned from it for hours. Every gate was green throughout, because
 * `verify-citations.ts` proves a citation points at real CODE and nothing
 * proved a cited ITEM still governs.
 *
 * A checker is not verified until it has been made red — `check-retired.ts`
 * says so in its own comments, having once been caught passing everything — so
 * every clause below is demonstrated by PLANTING the thing it must name and
 * requiring the specific naming.
 *
 * **The anti-vacuity tests come first, and they are the ones that matter.** A
 * scanner whose id regex silently stopped matching would report zero findings
 * over 821 real source files and read as a clean bill of health, which is the
 * exact shape — a report correct about what it measured and silent about what
 * it missed — that this check exists to end. So it is first required to find
 * the REAL citations in the REAL tree against the REAL corpus, and every
 * coordinate it reports is opened and checked.
 *
 * **And one clause is tested that is a RULING rather than behaviour: this never
 * gates.** The owner's decision (2026-09-07) is that a comment citing a retired
 * decision is often correct as history and that forcing edits would delete
 * history to go green. A run with findings exiting 0, and the absence of any
 * flag that changes it, are both pinned here — because that is the clause a
 * future well-meaning change is most likely to "fix".
 *
 * Read-only throughout. Nothing here writes to `.my_context/`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadLayer } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { RETIRED_STATUSES } from '../../src/core/select.ts';
import { SUPERSEDED_BY } from '../../src/core/relations.ts';
import { readCorpus, resolveId, type Corpus } from '../../scripts/check-handover.ts';
import { documentsUnder } from '../../scripts/check-diagrams-parse.ts';
import {
  DOC_ROOTS, SOURCE_ROOTS, build, isSourceFile, liveSites, paragraphAround, scanFile,
  successorChain, walkSources,
} from '../../scripts/check-cited-items.ts';
import { removeTree } from '../helpers/tmp.ts';
import type { Item } from '../../src/core/types.ts';
import { resolveConfig } from '../../src/core/config.ts';

const REPO = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'check-cited-items.ts');

const ws = resolveWorkspace(REPO);
const ITEMS: Item[] = ws.projectRoot === null ? [] : loadLayer(ws.projectRoot, 'project', [], ws.config);
const CORPUS: Corpus | null = ws.projectRoot === null ? null : readCorpus(ITEMS, ws.config);

/** The retired item whose live-sounding citation cost the morning this check answers. */
const THE_DEFECT = 'DEC-the-ui-is-developed-against-a-simulated-corpus-until-the';

/** A minimal item, so a plant names only the fields the check reads. */
function fakeItem(id: string, status: string, relations: Item['relations'] = []): Item {
  return {
    id, type: 'decision', title: `title of ${id}`, status: status as Item['status'],
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null,
    summaryWas: [], acknowledged: {}, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null, validFrom: null,
    validUntil: null, checksum: 'x', extra: {}, body: '', steps: [], observations: [],
    relations, layer: 'project', filePath: `items/decision/${id}.md`,
  };
}

/** A corpus of exactly these items, shaped the way `readCorpus` shapes the real one. */
function corpusOf(items: Item[]): Corpus {
  const byId = new Map(items.map((i) => [i.id, i]));
  const ids = [...byId.keys()].sort();
  return {
    // Both lane indexes empty: nothing here asks a lane question, and a
    // `readCorpus` that grew a second one for retired work (`check-handover`'s
    // RETIRED tier) must not silently change what these plants mean.
    // The shipped catalogue. `readCorpus` now keeps its config on the corpus,
    // because `asWorkItem` has to be asked at the point a prose id is resolved
    // — see `TASK-a-function-that-reads-a-task-field-accepts-any-item-and`.
    config: resolveConfig({}),
    lanes: new Map(), retiredLanes: new Map(), plans: new Set(), ids, byId,
    prefixes: new Set(ids.map((id) => id.split('-')[0]!)),
  };
}

/** Write `text` as one source file in a scratch directory and run the real `build` over it. */
function reportFor(text: string, items: Item[], name = 'planted.ts'): ReturnType<typeof build> {
  const dir = mkdtempSync(path.join(tmpdir(), 'cited-items-'));
  try {
    const file = path.join(dir, name);
    writeFileSync(file, text);
    return build([file], corpusOf(items), items);
  } finally {
    removeTree(dir);
  }
}

// ── 0. Anti-vacuity: the scanner is not blind ──────────────────────────────

/**
 * **The load-bearing test in this file.** Every plant below is worthless if the
 * scanner cannot read the real tree: a regex that stopped matching would report
 * zero findings and zero citations, and the run would look like good news.
 */
test('the real walk reads the real tree and the real corpus', () => {
  assert.notEqual(CORPUS, null, 'the repository must resolve as a workspace');
  const files: string[] = [];
  for (const root of SOURCE_ROOTS) walkSources(path.join(REPO, root), files);
  assert.ok(files.length > 500, `expected the four source roots to hold hundreds of files, saw ${files.length}`);

  const report = build(files, CORPUS!, ITEMS);
  assert.ok(report.citations > 500, `expected hundreds of resolved item citations, saw ${report.citations}`);
  assert.ok(report.retiredItems > 0, 'the corpus must contain retired items for this check to have a subject');
  assert.ok(report.findings.length > 0, 'source cites retired items today; zero findings means the scan is blind');
});

/**
 * Every coordinate the report prints is opened and checked. A finding that
 * names a file and a line a reader cannot follow is worse than no finding —
 * it teaches the reader to stop following them.
 */
test('every reported site names a line that really contains the id as written', () => {
  const files: string[] = [];
  for (const root of SOURCE_ROOTS) walkSources(path.join(REPO, root), files);
  const report = build(files, CORPUS!, ITEMS);
  for (const f of report.findings) {
    assert.ok(f.sites.length > 0, `${f.id} was reported with no site`);
    for (const s of f.sites) {
      const lines = readFileSync(path.join(REPO, s.file), 'utf8').split(/\r?\n/);
      assert.ok(
        (lines[s.line - 1] ?? '').includes(s.raw),
        `${s.file}:${s.line} does not contain "${s.raw}"`,
      );
    }
  }
});

/**
 * **The defect itself, still visible.** The DEC is retired and stays retired —
 * a retirement is not reversed — so this asserts what the check must say about
 * it wherever source still names it. If the day comes that no source names it,
 * the loop is empty and the first assertion still pins the reason this file
 * exists.
 */
test('the citation that cost the morning is named, with its successor', () => {
  const defect = ITEMS.find((i) => i.id === THE_DEFECT);
  assert.notEqual(defect, undefined, `${THE_DEFECT} must still be in the corpus`);
  assert.ok(RETIRED_STATUSES.has(defect!.status), `${THE_DEFECT} must still be retired`);

  const chain = successorChain(defect!, CORPUS!.byId);
  assert.ok(chain.length > 0, `${THE_DEFECT} must record what replaced it`);
  assert.equal(chain[0]!.id, 'INSTR-testing-happens-against-the-current-corpus-and-an-exception');

  const files: string[] = [];
  for (const root of SOURCE_ROOTS) walkSources(path.join(REPO, root), files);
  const report = build(files, CORPUS!, ITEMS);
  const finding = report.findings.find((f) => f.id === THE_DEFECT);
  if (finding === undefined) return;
  assert.equal(finding.chain[0]!.id, chain[0]!.id, 'the report must carry the successor, not just the retirement');
  const app = finding.sites.find((s) => s.file === 'e2e/app.ts');
  if (app === undefined) return;
  assert.equal(app.where, 'comment', 'the carrier was a comment, which is the shape that misleads');
  // **This flipped on 2026-09-08, and the flip is the point.** It asserted
  // `false` — "that comment says nothing about the ruling having moved" —
  // because that was the defect: a live comment citing
  // `DEC-the-ui-is-developed-against-a-simulated-corpus-until-the` as current,
  // which cost a morning. `plan:port seq:100` rewrote `e2e/app.ts`, deleting the
  // two blocks that asserted opposite things and recording the retirement, so
  // the site now DISCLOSES.
  //
  // The test is not weakened by the flip: everything above it still holds — the
  // item is still retired, the chain still names its successor, the report still
  // carries it, and the site is still FOUND and still a comment. What changed is
  // the one field that was the defect. A test that pins a defect's shape must
  // move when the defect is repaired, or it becomes a test that fails on being
  // fixed.
  assert.equal(app.disclosed, true, 'port/100 repaired that comment; it now names the retirement');
});

// ── 1. Planted: what is a finding and what is not ──────────────────────────

test('a comment citing an ACTIVE item is not a finding', () => {
  const items = [fakeItem('DEC-a-live-ruling-that-still-governs-everything', 'active')];
  const report = reportFor(
    '// `DEC-a-live-ruling-that-still-governs-everything` says so.\n',
    items,
  );
  assert.equal(report.findings.length, 0);
  assert.equal(report.citations, 1, 'it must still have been READ — zero would mean the scan missed it');
});

test('a comment citing a retired item is a finding, tagged as reading live', () => {
  const items = [fakeItem('DEC-a-ruling-that-changed-last-tuesday', 'superseded')];
  const report = reportFor(
    '// `DEC-a-ruling-that-changed-last-tuesday` is the owner standing ruling.\n',
    items,
  );
  assert.equal(report.findings.length, 1);
  assert.equal(liveSites(report.findings[0]!).length, 1);
});

/**
 * **A disclosure is a tag, never a suppression.** The site is still counted,
 * still printed and still attached to its finding — only its tag changes. A
 * heuristic that could hide a finding would be the blanket suppressor this
 * project refuses everywhere else.
 */
test('a comment that says the ruling moved is still reported, only tagged differently', () => {
  const items = [fakeItem('DEC-a-ruling-that-changed-last-tuesday', 'superseded')];
  const report = reportFor(
    '// `DEC-a-ruling-that-changed-last-tuesday` ruled it, and was superseded.\n',
    items,
  );
  assert.equal(report.findings.length, 1, 'a disclosed site is still a finding');
  assert.equal(report.findings[0]!.sites.length, 1);
  assert.equal(report.findings[0]!.sites[0]!.disclosed, true);
  assert.equal(liveSites(report.findings[0]!).length, 0);
});

test('an id in code rather than in prose is reported as code, and never as live', () => {
  const items = [fakeItem('DEC-a-ruling-that-changed-last-tuesday', 'superseded')];
  const report = reportFor(
    "const id = 'DEC-a-ruling-that-changed-last-tuesday';\n",
    items,
  );
  assert.equal(report.findings[0]!.sites[0]!.where, 'code');
  assert.equal(liveSites(report.findings[0]!).length, 0);
});

/**
 * **The paragraph is the window, and this is why.** The whole comment run would
 * let "superseded", written a hundred lines away about something else, excuse a
 * citation it never mentions — measured on `src/ui/public/screens/learn.js`,
 * whose run is 180 lines long.
 */
test('a disclosure in a DIFFERENT paragraph of the same docblock does not excuse', () => {
  const items = [fakeItem('DEC-a-ruling-that-changed-last-tuesday', 'superseded')];
  const report = reportFor(
    [
      '/**',
      ' * Some other argument entirely, in which something was superseded.',
      ' *',
      ' * `DEC-a-ruling-that-changed-last-tuesday` is the rule here.',
      ' */',
      '',
    ].join('\n'),
    items,
  );
  assert.equal(liveSites(report.findings[0]!).length, 1, 'the other paragraph must not reach this one');
});

/**
 * **The regression that a planted test found before the tree did.** Ids are
 * slugged titles, and this corpus really contains
 * `TASK-learn-cross-links-a-superseded-item-and-a-closed-task-and`. A paragraph
 * that names an id carrying the word "superseded" is not thereby a paragraph
 * that says the ruling moved.
 */
test('a retirement word inside an ID is not a disclosure', () => {
  const items = [fakeItem('DEC-a-ruling-about-a-superseded-item-elsewhere', 'deprecated')];
  const report = reportFor('// `DEC-a-ruling-about-a-superseded-item-elsewhere` is the rule here.\n', items);
  assert.equal(liveSites(report.findings[0]!).length, 1, 'the word came out of the id, not out of the prose');
});

/** Naming the successor IS the disclosure, and it is read from the paragraph as written. */
test('naming the successor in the paragraph is a disclosure', () => {
  const items = [
    fakeItem('DEC-the-old-ruling-here', 'superseded', [{ type: SUPERSEDED_BY, target: 'DEC-the-new-ruling-here' }]),
    fakeItem('DEC-the-new-ruling-here', 'active'),
  ];
  const report = reportFor(
    '// `DEC-the-old-ruling-here`, and then `DEC-the-new-ruling-here` took over.\n',
    items,
  );
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0]!.sites[0]!.disclosed, true);
});

test('paragraphAround stops at a blank comment line and at the end of the comment', () => {
  const lines = ['const a = 1;', '// first', '//', '// second', 'const b = 2;'];
  assert.match(paragraphAround(lines, 1), /first/);
  assert.doesNotMatch(paragraphAround(lines, 1), /second/);
  assert.doesNotMatch(paragraphAround(lines, 3), /first/);
});

// ── 2. What is derived rather than restated ────────────────────────────────

/**
 * **`RETIRED_STATUSES` is the source of truth and is USED, not copied.** It is
 * the set injection filters on, so this check and the injector cannot disagree
 * about what "retired" means. Every member is planted, including `validated`,
 * which no item in this corpus carries today — a measured zero that will stop
 * being zero without anyone thinking to come back here.
 */
test('every status in RETIRED_STATUSES is treated as retired', () => {
  for (const status of RETIRED_STATUSES) {
    const items = [fakeItem('DEC-a-ruling-in-one-of-the-retired-statuses', status)];
    const report = reportFor('// `DEC-a-ruling-in-one-of-the-retired-statuses` rules.\n', items);
    assert.equal(report.findings.length, 1, `status "${status}" must count as retired`);
    assert.equal(report.findings[0]!.status, status);
  }
});

test('an active item in no retired status is not treated as retired', () => {
  for (const status of ['active', 'draft']) {
    const items = [fakeItem('DEC-a-ruling-in-one-of-the-retired-statuses', status)];
    const report = reportFor('// `DEC-a-ruling-in-one-of-the-retired-statuses` rules.\n', items);
    assert.equal(report.findings.length, 0, `status "${status}" must not count as retired`);
  }
});

/**
 * One hop is not enough, and this is the case that proved it:
 * `OPENQ-how-do-filters-respect-dependencies` was superseded by a decision that
 * has itself since been superseded, and ten source sites cite the first.
 */
test('the successor chain is followed past a successor that is itself retired', () => {
  const a = fakeItem('DEC-a', 'superseded', [{ type: SUPERSEDED_BY, target: 'DEC-b' }]);
  const b = fakeItem('DEC-b', 'superseded', [{ type: SUPERSEDED_BY, target: 'DEC-c' }]);
  const c = fakeItem('DEC-c', 'active');
  const chain = successorChain(a, new Map([[a.id, a], [b.id, b], [c.id, c]]));
  assert.deepEqual(chain.map((i) => i.id), ['DEC-b', 'DEC-c']);
});

test('the chain stops at a live successor rather than walking the whole corpus', () => {
  const a = fakeItem('DEC-a', 'superseded', [{ type: SUPERSEDED_BY, target: 'DEC-b' }]);
  const b = fakeItem('DEC-b', 'active', [{ type: SUPERSEDED_BY, target: 'DEC-c' }]);
  const c = fakeItem('DEC-c', 'active');
  const chain = successorChain(a, new Map([[a.id, a], [b.id, b], [c.id, c]]));
  assert.deepEqual(chain.map((i) => i.id), ['DEC-b']);
});

/**
 * No command writes a cycle — `existingSuccessorRefusal` caps the back edge at
 * one per item, not one per corpus — but a hand-edited corpus can express one,
 * and a check that hangs reports nothing at all.
 */
test('a supersession cycle terminates instead of hanging', () => {
  const a = fakeItem('DEC-a', 'superseded', [{ type: SUPERSEDED_BY, target: 'DEC-b' }]);
  const b = fakeItem('DEC-b', 'superseded', [{ type: SUPERSEDED_BY, target: 'DEC-a' }]);
  const chain = successorChain(a, new Map([[a.id, a], [b.id, b]]));
  assert.deepEqual(chain.map((i) => i.id), ['DEC-b']);
});

test('a retired item with no successor is reported with an empty chain, not skipped', () => {
  const items = [fakeItem('DEC-a-ruling-nobody-recorded-a-successor-for', 'deprecated')];
  const report = reportFor('// `DEC-a-ruling-nobody-recorded-a-successor-for` rules.\n', items);
  assert.equal(report.findings.length, 1);
  assert.deepEqual(report.findings[0]!.chain, []);
});

// ── 3. The ruling: reported, never gated ───────────────────────────────────

/**
 * **The owner's decision, pinned as a test because it is the clause a future
 * change is most likely to "fix".** A real run over the real tree, with real
 * findings, exits 0.
 */
test('a run with findings exits 0', () => {
  const out = execFileSync(process.execPath, [SCRIPT, '--quiet'], { cwd: REPO, encoding: 'utf8' });
  assert.match(out, /name \d+ retired item\(s\)/, 'the run must have had findings to report');
  assert.match(out, /REPORTED, NEVER GATED/);
});

/**
 * `verify-citations.ts` reports its source tier ungated and offers
 * `--strict-source` as "the whole of the flip", because that debt is waiting
 * for a repair. This debt is not: the findings are frequently CORRECT AS THEY
 * STAND. A flag would invite somebody to gate them later without re-reading
 * the ruling, so there is deliberately none, and its absence is asserted
 * rather than left to be noticed.
 */
test('there is no flag that turns findings into a failure', () => {
  // The header ARGUES about `--strict`, at length, which is why this reads the
  // argument PARSING rather than the file: what must not exist is a flag this
  // script acts on, not the word.
  const source = readFileSync(SCRIPT, 'utf8');
  assert.doesNotMatch(
    source,
    /argv\.includes\('--strict/,
    'no --strict flag may be introduced here — the ruling is that findings never gate',
  );
  // And the other half, which a missing flag alone does not prove: `main`'s
  // last statement on the path that HAS findings returns 0 unconditionally.
  assert.match(source, /write\(summary\(report, showUnresolved\)\);[\s\S]{0,120}return 0;\n\}/);
});

/**
 * The two non-zero exits are "nothing was checked", which is not a finding. An
 * empty corpus must not read as a clean bill of health — this project has been
 * bitten by that vacuous pass in six other shapes.
 */
test('an empty corpus is a loud failure rather than a clean run', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cited-items-empty-'));
  try {
    let code = 0;
    let out = '';
    try {
      out = execFileSync(process.execPath, [SCRIPT, '--quiet'], { cwd: dir, encoding: 'utf8' });
    } catch (err) {
      const e = err as { status?: number; stdout?: string };
      code = e.status ?? 0;
      out = e.stdout ?? '';
    }
    assert.equal(code, 1, 'a run that checked nothing must not exit 0');
    assert.match(out, /nothing was checked/);
    assert.doesNotMatch(out, /retired item\(s\)/, 'it must not print a finding count it never computed');
  } finally {
    removeTree(dir);
  }
});

// ── 4. Standing assertions about this repository ───────────────────────────

test('check:cited-items is wired to this script', () => {
  const pkg = JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  assert.equal(pkg.scripts['check:cited-items'], 'node scripts/check-cited-items.ts');
});

test('the walk covers the four trees the task scoped and the browser modules in them', () => {
  assert.deepEqual(SOURCE_ROOTS, ['src', 'test', 'scripts', 'e2e']);
  assert.ok(isSourceFile('app.js'), 'src/ui/public/** is hand-written source, not build output');
  assert.ok(isSourceFile('select.ts'));
  assert.ok(!isSourceFile('types.d.ts'), 'a declaration file is generated and cites nothing');
  assert.ok(!isSourceFile('web-ui-mockup.html'));
});

/**
 * **The `absent-vs-zero` nickname, which no item has ever answered to.**
 *
 * `TASK-std-absent-vs-zero-is-a-nickname-22-citations-use-and-no`: the standard
 * is really `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`, and
 * twenty-five sites across `src/`, `test/` and `docs/` called it by a short name
 * that resolves to nothing. `RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number`
 * is the rule it offends, and a citation that resolves to NOTHING is worse than
 * one that names a moved line: a stale line still lands in the right file.
 *
 * **Why this names one id rather than gating every unresolved one.** The script
 * above skips an id it cannot resolve, deliberately and with its reason printed:
 * 2512 id-shaped strings in this tree answer to no item and almost all of them
 * are fixtures inventing an id, which a corpus test must do. `--unresolved`
 * shows 55 even under `src/` alone, and the majority are worked examples in help
 * text (`INV-prices-are-integer-cents`, `CONST-postgres-pool-capped-at-20`).
 * There is no property separating an invented id from a dangling one, so a
 * general gate would be an allow-list — the shape this project keeps measuring
 * as the defect. This asserts the one nickname that was measured, and reports
 * every site by coordinate rather than by count.
 *
 * **The needle is assembled rather than written, and this file is NOT exempt.**
 * Spelling the nickname out here would make this file its own twenty-sixth site,
 * and exempting the file by path would leave the one hole a reader would never
 * look in. So the literal appears nowhere: `NICKNAME` is built from two halves,
 * and the prose above says `absent-vs-zero` without the prefix that makes it an
 * id. The pattern tolerates a line break after any hyphen, because three of the
 * twenty-five were wrapped across a comment break and a per-line match reads
 * those as two different unknown ids; the coordinate reported is where the id
 * STARTS.
 */
test('no source file cites the absent-vs-zero standard by a name no item answers to', () => {
  const NICKNAME = 'STD-absent' + '-vs-zero';
  const BROKEN = new RegExp(
    NICKNAME.replace(/-/g, '-(?:\\r?\\n[ \\t]*(?:\\/\\/|\\*)?[ \\t]*)?'), 'g',
  );
  const sites: string[] = [];
  for (const root of SOURCE_ROOTS) {
    for (const file of walkSources(path.join(REPO, root), [])) {
      if (!isSourceFile(path.basename(file))) continue;
      const text = readFileSync(file, 'utf8');
      const rel = path.relative(REPO, file).replace(/\\/g, '/');
      for (const m of text.matchAll(BROKEN)) {
        sites.push(`${rel}:${text.slice(0, m.index).split(/\r?\n/).length}`);
      }
    }
  }
  assert.deepEqual(
    sites, [],
    `these sites cite \`${NICKNAME}\`, which is a nickname and not an id — the standard is `
    + '`STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`. A reader who follows one '
    + 'of these finds no item at all.',
  );
});

/** `scanFile` is the one piece that decides what a citation IS; pinned directly. */
test('scanFile reads a shortened id and skips an English compound', () => {
  const corpus = corpusOf([fakeItem('DEC-focus-discloses-and-allows-rather-than-refusing', 'superseded')]);
  const hits = scanFile(
    '// `DEC-focus-discloses-and-allows` on a UI-side NUL-byte path\n',
    'planted.ts',
    corpus,
  );
  assert.equal(hits.length, 1, 'the shortened id resolves and the compounds are skipped');
  assert.equal(hits[0]!.id, 'DEC-focus-discloses-and-allows-rather-than-refusing');
  assert.equal(hits[0]!.raw, 'DEC-focus-discloses-and-allows');
});

// ── 5. The documents, added 2026-09-17 by `rulings/111` ────────────────────

/**
 * **`SOURCE_ROOTS` never held `docs/`, so twenty-five reference chapters and
 * two READMEs cited this corpus by id with nothing resolving one of them.**
 *
 * `docs/system/06-ingest.md` had written the gap down itself before anybody
 * closed it: *"And no gate checks the ids cited in these chapters at all …
 * Every id in `docs/system/` was verified by hand in this pass and in the one
 * before it, which is a reading with a date on it and not a standing
 * guarantee."*
 *
 * The plants below prove the one thing the walk change could get wrong: a
 * document is not a source file, and reading it with `COMMENT_PREFIX` would
 * have classified EVERY line of every chapter as `code` — the tag this script
 * prints for a string literal that makes no authority claim. That would have
 * turned the entire documentation backlog into thirty silent rows nobody is
 * asked to read, which is the failure mode this script's own header spends a
 * page refusing. So prose is `comment` and a fenced block is `code`, and each
 * direction is planted here rather than asserted in a comment.
 */

/** The `…`-truncated ids `docs/system/` writes on purpose, inside diagram labels. */
const TRUNCATED_IN_DIAGRAMS: Array<[string, string]> = [
  ['REF-the-d-numbers', 'REF-the-d-numbers-what-each-one-means-and-which-are-only'],
  ['DEC-the-meaning-hue-budget-is-five', 'DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn'],
];

/**
 * **THE RED PROOF for the documents**, in both directions, because only one of
 * them can be shown by the real tree: the chapters DO cite retired items today,
 * so the positive direction would pass even if the fence discrimination were
 * broken, and the negative direction has no real counterexample to point at.
 */
test('a retired id in a chapter is a claim; the same id in pasted output is not', () => {
  const items = [
    fakeItem('DEC-old-ruling-nobody-should-follow', 'superseded', [
      { type: SUPERSEDED_BY, target: 'DEC-what-replaced-it' },
    ]),
    fakeItem('DEC-what-replaced-it', 'active'),
  ];

  const prose = reportFor(
    'A chapter paragraph naming `DEC-old-ruling-nobody-should-follow` as the rule.\n',
    items, 'chapter.md',
  );
  assert.equal(prose.findings.length, 1, 'a chapter naming a retired item must be a finding');
  assert.equal(prose.findings[0]!.sites[0]!.where, 'comment', 'a chapter paragraph IS the claim');
  assert.equal(liveSites(prose.findings[0]!).length, 1, 'and it reads as a live ruling');
  assert.equal(prose.documentsWalked, 1, 'the report must count the document it walked');

  const quoted = reportFor(
    [
      'The chapter pastes what the command printed:',
      '',
      '```text',
      'CARRIED  DEC-old-ruling-nobody-should-follow',
      '```',
      '',
    ].join('\n'),
    items, 'chapter.md',
  );
  assert.equal(quoted.findings.length, 1, 'the citation is still counted, and still reported');
  assert.equal(
    quoted.findings[0]!.sites[0]!.where, 'code',
    'a line inside a fenced block is pasted output — dated evidence, not a claim that the ruling '
    + 'still governs. docs/capabilities/07-restore-and-handover.md pastes seven such lines.',
  );
  assert.equal(liveSites(quoted.findings[0]!).length, 0, 'so it must not read as a live ruling');

  // The same text as a `.ts` file reads the old way, unchanged: the extension
  // is the only thing that switched, and nothing about source files moved.
  const asSource = reportFor(
    'const x = "DEC-old-ruling-nobody-should-follow";\n', items, 'planted.ts',
  );
  assert.equal(asSource.findings[0]!.sites[0]!.where, 'code', 'a string literal is still code');
  assert.equal(asSource.documentsWalked, 0, 'a .ts file is not a document');
});

/**
 * The five-backtick example block, which both READMEs really carry and which a
 * `/^```/` toggle reads backwards. `test/helpers/markdown.ts` records measuring
 * that the toggle "happened to flip an even number of times, so the parity
 * assertions still saw the real headings" — it stayed green by luck, and the
 * luck is what this refuses to inherit.
 */
test('a fence nested inside a five-backtick example block does not leak into the prose', () => {
  const items = [fakeItem('DEC-old-ruling-nobody-should-follow', 'superseded')];
  const report = reportFor(
    [
      '`````text',
      '```json',
      '{ "cites": "DEC-old-ruling-nobody-should-follow" }',
      '```',
      '`````',
      '',
      'And then prose naming `DEC-old-ruling-nobody-should-follow` again.',
      '',
    ].join('\n'),
    items, 'chapter.md',
  );
  assert.deepEqual(
    report.findings[0]!.sites.map((s) => `${s.line}:${s.where}`),
    ['7:comment', '3:code'],
    'the id inside the example block is quoted and the one in the paragraph below it is a claim',
  );
});

/**
 * Disclosure over a MARKDOWN paragraph rather than a comment paragraph.
 *
 * The rule is the script's own and does not change here: a site that says the
 * ruling moved is tagged and never suppressed. What changes is where the
 * paragraph ends — a blank line and a fence, rather than a bare `*`.
 */
test('a chapter that names the successor in the same paragraph is marked as saying so', () => {
  const items = [
    fakeItem('DEC-old-ruling-nobody-should-follow', 'superseded', [
      { type: SUPERSEDED_BY, target: 'DEC-what-replaced-it' },
    ]),
    fakeItem('DEC-what-replaced-it', 'active'),
  ];
  const report = reportFor(
    [
      'This chapter was written under `DEC-old-ruling-nobody-should-follow`,',
      'which `DEC-what-replaced-it` has since superseded.',
      '',
      'A later paragraph names `DEC-old-ruling-nobody-should-follow` and nothing else.',
      '',
    ].join('\n'),
    items, 'chapter.md',
  );
  const sites = report.findings[0]!.sites;
  assert.equal(sites.length, 2);
  assert.equal(
    sites.find((s) => s.line === 1)!.disclosed, true,
    'the successor is named on the NEXT LINE of the same paragraph, which is the unit',
  );
  assert.equal(
    sites.find((s) => s.line === 4)!.disclosed, false,
    'a paragraph two blank lines away does not tell this reader anything',
  );
});

/**
 * **Anti-vacuity: the real documents, walked.** Every plant above is worthless
 * if `DOC_ROOTS` stopped resolving — a renamed directory would report zero
 * document citations and read as good news, which is the exact shape
 * `rulings/111` was filed about.
 */
test('the real walk reads the real documents', () => {
  assert.deepEqual(
    DOC_ROOTS, ['README.md', 'docs/README.he.md', 'docs/capabilities', 'docs/system'],
    'DOC_ROOTS is check-diagrams-parse.ts\'s DOC_SOURCES, imported rather than restated',
  );
  const docs = documentsUnder(REPO);
  assert.ok(docs.length >= 40, `expected the reference documentation, walked ${docs.length} file(s)`);
  assert.ok(docs.includes('README.md') && docs.includes('docs/system/06-ingest.md'));

  const files = docs.map((f) => path.join(REPO, ...f.split('/')));
  const report = build(files, CORPUS!, ITEMS);
  assert.equal(report.documentsWalked, files.length, 'every walked document must count as one');
  assert.ok(
    report.citations > 200,
    `expected hundreds of item citations in the documents, saw ${report.citations}`,
  );
  assert.ok(
    report.findings.length > 0,
    'the chapters cite retired items today; zero findings means the document walk is blind',
  );
  for (const f of report.findings) {
    for (const s of f.sites) {
      const lines = readFileSync(path.join(REPO, s.file), 'utf8').split(/\r?\n/);
      assert.ok((lines[s.line - 1] ?? '').includes(s.raw), `${s.file}:${s.line} does not contain "${s.raw}"`);
    }
  }
});

/**
 * **The two deliberate shapes `docs/system/` writes, which this must not force
 * to be wrong.** Both are already handled by `resolveId`, and asserting it here
 * is what keeps a future "improvement" to the resolver from quietly breaking a
 * document that is correct as written.
 *
 *   - A `…`-TRUNCATED id inside a diagram label. A visible ellipsis claims
 *     nothing where an invented suffix would look complete, so the truncation
 *     is the honest form; the prefix rule resolves it to the real item with no
 *     exemption written anywhere.
 *   - An OVER-LONG id quoted as the defect being described. It is longer than
 *     the real id rather than shorter, the prefix rule does not reach it, and it
 *     lands in `--unresolved` — uncounted and ungated, exactly where
 *     `06-ingest.md` says it lands.
 */
test('a truncated id in a diagram label resolves and an over-long id stays unresolved', () => {
  for (const [written, real] of TRUNCATED_IN_DIAGRAMS) {
    const r = resolveId(CORPUS!, written);
    assert.equal(r.id, real, `"${written}…" is written on purpose and must resolve to ${real}`);
  }

  const chapter = readFileSync(path.join(REPO, 'docs', 'system', '06-ingest.md'), 'utf8');
  const overLong = 'INV-a-validator-that-gates-writes-must-be-a-complete-precondition-for-the-write';
  assert.ok(chapter.includes(overLong), '06-ingest.md quotes the over-long id as the defect it describes');
  const found = scanFile(chapter, 'docs/system/06-ingest.md', CORPUS!, 'markdown')
    .filter((h) => h.raw === overLong);
  assert.equal(found.length, 1, 'the scanner must see it');
  assert.equal(found[0]!.id, null, 'and must not resolve it to the real, shorter id');
  assert.equal(found[0]!.why, 'no item answers to it', 'so it is unresolved, which is ungated');

  const real = readFileSync(path.join(REPO, 'docs', 'system', '01-the-board.md'), 'utf8');
  assert.ok(real.includes(`${TRUNCATED_IN_DIAGRAMS[0]![0]}…`), 'the truncated id is still written with its ellipsis');
});
