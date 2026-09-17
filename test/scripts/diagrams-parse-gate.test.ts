// @basis TASK-a-fence-that-does-not-parse-ships-to-readers-because-the, CONST-node-24-no-build-step, CONST-zero-runtime-dependencies, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **`scripts/check-diagrams-parse.ts` — everything about it that can be proved
 * without a browser, which is more than it sounds.**
 *
 * The gate's own RED PROOF is not here and deliberately is not: it needs
 * mermaid, mermaid needs Chromium, and `npm test` runs on Windows as well as
 * ubuntu where no Chromium is installed. So the red path is proved by the gate
 * ITSELF, on every run, as its first act — it feeds the pre-repair chapter 7
 * fence through its own extraction, its own parser and its own verdict and
 * aborts non-zero if that fence is accepted. A red path proved once in a test
 * file is a photograph; a red path re-run before every green number is a
 * measurement.
 *
 * What is left for this file is everything the browser was never the hard part
 * of, and it is the half where the silent failures live:
 *
 *   — the SWEEP actually reaches the documents (fence extraction needs no
 *     browser at all, so this is real coverage and not a proxy);
 *   — the known-bad input is genuinely the fence that shipped, byte for byte;
 *   — the LOCATOR turns mermaid's in-fence line into the document line
 *     `471b13b3` itself names — 78;
 *   — the VERDICT is non-zero for a refusal AND for an empty sweep;
 *   — the gate DRAWS NOTHING, which is the owner's ruling and not an
 *     implementation detail.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  DOC_SOURCES, FENCE_FLOOR, FILE_FLOOR,
  KNOWN_BAD, KNOWN_BAD_DOCUMENT, KNOWN_BAD_CONTENT_LINE, KNOWN_BAD_OFFENDING_LINE,
  collectFences, documentsUnder, fencesIn, describe, offendingLine, verdict,
  type Fence, type Outcome,
} from '../../scripts/check-diagrams-parse.ts';
import { DIAGRAM_SOURCES } from '../../scripts/gen-diagrams.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const GATE = path.join(REPO, 'scripts', 'check-diagrams-parse.ts');

/** A fence that parses, for the verdict cases. Never sent to a parser here. */
const fence = (file: string, line: number): Fence => ({ file, line, source: 'flowchart TB\n  A --> B\n' });
const good = (file: string, line: number): Outcome => ({ fence: fence(file, line), ok: true, error: '' });
const bad = (file: string, line: number, error: string): Outcome =>
  ({ fence: fence(file, line), ok: false, error });

// ── 0. The sweep reaches the documents ─────────────────────────────────────

/**
 * **The measurement the whole item turns on.** `DIAGRAM_SOURCES` lists two
 * files; this list covers the chapters as well, and a gate whose sweep quietly
 * stopped covering them would be the original defect wearing the repair's
 * name.
 */
test('the sweep reaches every document tree the ruling named, not only the two READMEs', () => {
  const documents = documentsUnder(REPO);
  assert.ok(documents.includes('README.md'), 'README.md is not in the sweep');
  assert.ok(documents.includes('docs/README.he.md'), 'docs/README.he.md is not in the sweep');
  assert.ok(
    documents.some((d) => d.startsWith('docs/capabilities/')),
    'no capability chapter is in the sweep — this is the exact hole the item was filed about',
  );
  assert.ok(
    documents.some((d) => d.startsWith('docs/system/')),
    'no docs/system chapter is in the sweep',
  );
});

test('the sweep finds fences, and enough of them to be looking at anything', async () => {
  const fences = await collectFences(REPO);
  const files = new Set(fences.map((f) => f.file));
  assert.ok(
    fences.length >= FENCE_FLOOR,
    `${fences.length} fence(s) found, below the gate's own floor of ${FENCE_FLOOR} — either the `
    + 'documents lost diagrams and FENCE_FLOOR was not lowered with them, or extraction broke',
  );
  assert.ok(
    files.size >= FILE_FLOOR,
    `${files.size} document(s) carry a fence, below the floor of ${FILE_FLOOR}`,
  );
  // The floors must be worth something. A floor of 0 or 1 passes over a broken
  // extractor, which is the failure `19939273` shipped in its own way.
  assert.ok(FENCE_FLOOR > 1 && FILE_FLOOR > 1, 'the floors are too low to refuse an empty sweep');
});

test('every fence the sweep reports can be located in its own file', async () => {
  for (const f of await collectFences(REPO)) {
    assert.ok(f.line > 0, `${f.file}: a fence was extracted but could not be located in the text`);
    const lines = readFileSync(path.join(REPO, ...f.file.split('/')), 'utf8')
      .replaceAll('\r\n', '\n').split('\n');
    assert.equal(
      lines[f.line - 2], '```mermaid',
      `${f.file}:${f.line} is reported as a fence's first content line, but the line above it is `
      + `${JSON.stringify(lines[f.line - 2])} rather than an opening mermaid fence`,
    );
  }
});

// ── 1. The known-bad input, and its provenance ─────────────────────────────

/**
 * **A bulb, not a drawing of one.** The proof input is the fence that really
 * shipped, and this is the pin that says so: the SHA-256 of
 * `git show 471b13b3^:docs/capabilities/07-restore-and-handover.md | sed -n '69,84p'`,
 * taken with LF endings. If someone "tidies" the embedded copy — normalises an
 * em dash, straightens a `<br/>` — it stops being the shipped fence and this
 * says so rather than letting a tidied fixture stand in for evidence.
 */
test('the known-bad fence is byte-identical to the one that shipped until 471b13b3', () => {
  assert.equal(
    createHash('sha256').update(KNOWN_BAD, 'utf8').digest('hex'),
    'd50ff7abfa1255ed77a9436b71000109c32204bc35ec378606e946afdd3a60e2',
    'KNOWN_BAD is no longer the pre-repair chapter 7 fence. Recover it with: '
    + "git show 471b13b3^:docs/capabilities/07-restore-and-handover.md | sed -n '69,84p'",
  );
  assert.match(KNOWN_BAD, /--approve &lt;key&gt;/, 'the defect itself is gone from the known-bad input');
});

/**
 * The pair, and the one that keeps this honest in the other direction: the
 * repaired document must NOT carry it. If it did, the gate would be red on the
 * real tree and `rulings/106` — not this lane — would own the repair.
 */
test('the repaired chapter 7 no longer carries the defect the proof input carries', () => {
  const chapter = path.join(REPO, 'docs', 'capabilities', '07-restore-and-handover.md');
  assert.ok(existsSync(chapter), 'the chapter the proof input came from no longer exists');
  const text = readFileSync(chapter, 'utf8');
  assert.ok(!text.includes('--approve &lt;key&gt;'), 'the `&lt;key&gt;` defect is back in the shipped chapter');
  assert.match(text, /--approve <key>/, 'the repaired form 471b13b3 wrote is not there either');
});

// ── 2. Extraction and the locator ──────────────────────────────────────────

test('the proof document holds exactly one fence, on the line it shipped on', async () => {
  const found = await fencesIn('proof', KNOWN_BAD_DOCUMENT);
  assert.equal(found.length, 1, 'the proof document does not hold exactly one fence');
  assert.equal(
    found[0]!.line, KNOWN_BAD_CONTENT_LINE,
    'the proof document is padded so the fence lands where it shipped (content on line 69); it no longer does',
  );
  assert.equal(found[0]!.source, KNOWN_BAD, 'extraction changed the fence on the way through');
});

/**
 * **78 is not an arbitrary number.** It is the line `471b13b3` names and the
 * line the owner's ruling cites, and it is what the gate must print when it
 * refuses this fence. mermaid counts from the start of the DEFINITION — "Parse
 * error on line 10" — so the locator adds the fence's own offset, and this is
 * the arithmetic written out where it can go red.
 */
test('mermaid\'s in-fence line becomes the line in the document that 471b13b3 names', async () => {
  const found = await fencesIn('proof', KNOWN_BAD_DOCUMENT);
  const at = offendingLine(found[0]!, 'Parse error on line 10:\n...--approve &lt;key&gt;\n---^');
  assert.equal(at, 78, 'the locator no longer points at the line the repair commit points at');
  assert.equal(at, KNOWN_BAD_OFFENDING_LINE, 'the gate\'s own pin and this test disagree');
});

test('a mermaid error naming no line still points somewhere true — the fence itself', () => {
  assert.equal(offendingLine(fence('a.md', 40), 'Syntax error in text'), 40);
  assert.equal(offendingLine({ file: 'a.md', line: 0, source: '' }, 'Parse error on line 3:'), 0);
});

// ── 3. The verdict: two ways to be red, and they are different ─────────────

test('a fence mermaid refuses makes the gate non-zero', () => {
  const outcomes = [good('a.md', 10), bad('b.md', 20, 'Parse error on line 2:')];
  const { code, reasons } = verdict(outcomes, 2, { fences: 2, files: 2 });
  assert.equal(code, 1);
  assert.ok(reasons.some((r) => r.includes('do not parse')), reasons.join(' | '));
});

/**
 * **Guard 2, the one this repository has already failed once.** A gate that
 * checks zero fences exits 0 and reports GREEN forever while the documents
 * rot — `19939273` shipped a baseline harness that printed "baseline matches
 * the pin" without ever running a test. An empty sweep is not a pass.
 */
test('an EMPTY sweep is refused, not passed', () => {
  const empty = verdict([], 0);
  assert.equal(empty.code, 1, 'zero fences exited 0 — the gate reports green over nothing');
  assert.ok(empty.reasons.some((r) => r.startsWith('EMPTY SWEEP')), empty.reasons.join(' | '));
});

test('a sweep that lost a whole directory is refused even though every fence it kept parses', () => {
  const survivors = Array.from({ length: FENCE_FLOOR }, (_, i) => good('README.md', i + 1));
  const { code, reasons } = verdict(survivors, 1);
  assert.equal(code, 1, 'every fence parsed and they were all in one file, and the gate passed');
  assert.ok(reasons.some((r) => r.includes('document(s) carry a fence')), reasons.join(' | '));
});

test('a full, clean sweep is the only thing that passes', () => {
  const outcomes = Array.from({ length: FENCE_FLOOR }, (_, i) => good(`f${i % FILE_FLOOR}.md`, i + 1));
  assert.deepEqual(verdict(outcomes, FILE_FLOOR), { code: 0, reasons: [] });
});

// ── 4. What a person is told when it goes red ──────────────────────────────

/**
 * "A diagram failed" costs someone the twenty minutes this gate exists to
 * save. The file, the line, and MERMAID'S OWN words — not a summary of them.
 */
test('a refusal prints the file, the line and mermaid\'s own error text', () => {
  const text = describe(bad('docs/capabilities/07-restore-and-handover.md', 69,
    'Parse error on line 10:\n...--approve &lt;key&gt;\n-----^\nExpecting SOLID_ARROW, got NEWLINE'));
  assert.match(text, /docs\/capabilities\/07-restore-and-handover\.md:78/, 'the offending line is not in the message');
  assert.match(text, /Expecting SOLID_ARROW, got NEWLINE/, "mermaid's own words were summarised away");
  assert.match(text, /-----\^/, 'the caret line, which is the whole point of a parse error, was dropped');
});

// ── 5. The ruling itself: it draws nothing, and it is not coupled ──────────

/**
 * **The owner's choice, asserted rather than trusted.** 2026-09-17, between
 * widening `DIAGRAM_SOURCES` and a parse-only gate: "the parse-only gate".
 * Drawing the undrawn fences was measured at ~1.5-1.8 MiB and is past a size
 * budget already rejected. A later hand adding "and while we're here, write
 * the SVG" reverses a ruling; this makes that a red test rather than a diff
 * nobody reads.
 */
test('the gate writes nothing, anywhere', () => {
  const source = readFileSync(GATE, 'utf8');
  const body = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const forbidden of ['writeFileSync', 'mkdirSync', 'rmSync', 'appendFileSync', 'createWriteStream']) {
    assert.ok(
      !body.includes(forbidden),
      `scripts/check-diagrams-parse.ts calls ${forbidden}. The ruling of 2026-09-17 is "the `
      + 'parse-only gate": it draws nothing and writes nothing.',
    );
  }
  assert.ok(!body.includes('mermaid.render'), 'the gate renders rather than parses, so it is drawing');
});

/**
 * **Decoupled on purpose, and the reason is the defect itself.** Reading the
 * source list from `DIAGRAM_SOURCES` would re-create the hole, because the
 * whole defect was that the drawing list is short. So the relation is asserted
 * one way only: this list must COVER that one, and must be strictly wider.
 */
test('DOC_SOURCES covers DIAGRAM_SOURCES, is wider than it, and is not read from it', () => {
  for (const drawn of DIAGRAM_SOURCES) {
    assert.ok(DOC_SOURCES.includes(drawn), `${drawn} is drawn but not parsed by this gate`);
  }
  assert.ok(
    DOC_SOURCES.length > DIAGRAM_SOURCES.length,
    'the parse sweep is no wider than the drawing list, which is the hole this item closed',
  );
  const body = readFileSync(GATE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(
    !body.includes('gen-diagrams'),
    'the gate imports from gen-diagrams.ts, so the two lists can no longer disagree — and the '
    + 'defect WAS that the drawing list is short',
  );
});

// ── 6. Wiring, so this is a gate and not a script ──────────────────────────

test('package.json defines check:diagrams, and it points at this script', () => {
  const manifest = JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8')) as
    { scripts?: Record<string, string> };
  assert.equal(manifest.scripts?.['check:diagrams'], 'node scripts/check-diagrams-parse.ts');
});
