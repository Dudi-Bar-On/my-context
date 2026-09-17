/**
 * Structural parity between `README.md` and its Hebrew mirror
 * `docs/README.he.md`: the same section structure, in the same order, and the
 * same documented examples, in the same order.
 *
 * The failure this prevents is the one the mirror makes cheap: a section added
 * to one language and forgotten in the other, so the Hebrew reader silently
 * gets less than the English one.
 *
 * **What this test cannot do, stated here because a green suite must not be
 * mistaken for verified Hebrew.** It compares structure, never meaning. A
 * paragraph whose Hebrew was left behind by an English edit — same heading,
 * same example, stale sentence — passes every assertion in this file, and no
 * test in this repository can catch it (spec §8). The third test below
 * *demonstrates* that blindness against the real documents rather than merely
 * asserting it in a comment: it garbles the Hebrew prose and shows the checks
 * still pass. Translation freshness is a review obligation, not a tested one.
 *
 * When a parity assertion fails, the fix is bringing the two documents into
 * line — never deleting the assertion, and never editing one document's
 * heading level to make the sequences match while the sections differ.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { collectExamples } from '../../scripts/gen-doc-examples.ts';
// `fencesIn` is the ONE mermaid-fence extractor — the product's own
// `mermaidBlocks`, reached through the gate that already insists on a single
// one. The capability-mirror block at the foot of this file needs to know which
// fenced blocks are diagrams; a second scanner would disagree with this one the
// day a fence gets an unusual info string.
import { fencesIn } from '../../scripts/check-diagrams-parse.ts';
import { fenceTracker, headings } from '../helpers/markdown.ts';

const REPO = path.join(import.meta.dirname, '..', '..');

/** LF-normalized: a working tree checked out before `.gitattributes` is CRLF. */
function read(relative: string): string {
  return readFileSync(path.join(REPO, relative), 'utf8').replaceAll('\r\n', '\n');
}

const EN = 'README.md';
const HE = path.join('docs', 'README.he.md');
const en = read(EN);
const he = read(HE);

/**
 * The heading depths of a document, in order — `#` lines inside fenced blocks
 * excluded, which is what `headings()` in `test/helpers/markdown.ts` does and
 * why the rule lives there rather than here: `capabilities.test.ts` resolves
 * anchors against the same headings this test counts, and one wrong copy of
 * the fence rule already cost this suite a silently hidden section.
 *
 * Excluding fenced `#` lines is deliberate. Both documents quote injected
 * output verbatim (§3, §4, §6), and that output contains `## my_context index`
 * and similar lines which are not sections of the README: they are the tool's
 * words. As of this commit that is 91 `#` lines raw against 68 headings counted
 * here. That the counted set is the one GitHub's own renderer emits
 * `<h1>`…`<h6>` for was checked once, by rendering both documents through its
 * markdown API, when the same figures stood at 88 and 65; the rule has not
 * changed since, only the number of sections. The exclusion buys two
 * things. A failure message that says "a section was added or removed in one
 * language only" is then true: it cannot be triggered by a change to quoted
 * output. And the quoted output is already pinned, verbatim and in both
 * documents, by `test/docs/injection.test.ts` and `test/docs/examples.test.ts`,
 * which report a drift there with the exact text to paste — a far more useful
 * failure than a depth-sequence mismatch.
 */
function headingDepths(markdown: string): number[] {
  return headings(markdown).map((h) => h.depth);
}

/**
 * Guards the three ways this file could pass while checking nothing: a fenced
 * block left unclosed swallows the rest of the document, a fence regex that
 * matches nothing makes every line "prose", and a heading regex that matches
 * nothing makes two empty sequences "agree".
 *
 * The floor is well below the current 65 headings — it is here to catch a
 * broken parser, not to pin the document's size.
 */
function assertParsable(markdown: string, relative: string): number[] {
  // An unclosed block hides everything after it, so the tracker must end closed.
  // Asked of a trailing sentinel line that can never itself open or close one.
  const fenced = fenceTracker();
  const inside = markdown.split('\n').map((l) => fenced(l));
  assert.ok(
    inside.length > 0 && !fenced(''),
    `${relative} ends inside an unclosed fenced block — everything after it is hidden ` +
    `from this test`,
  );
  assert.ok(
    inside.some((f) => f),
    `no fenced block was found in ${relative}; the fence tracker is broken, not the document`,
  );
  const depths = headingDepths(markdown);
  assert.ok(
    depths.length >= 20,
    `only ${depths.length} headings were found in ${relative}; the parser is broken, ` +
    `not the document`,
  );
  return depths;
}

test('both documents carry the same section structure', () => {
  const enDepths = assertParsable(en, EN);
  const heDepths = assertParsable(he, HE);
  assert.deepEqual(
    heDepths, enDepths,
    `a section was added or removed in one language only — update both. ` +
    `${EN} has ${enDepths.length} headings, ${HE} has ${heDepths.length}.`,
  );
});

test('both documents run the same examples, in the same order', () => {
  const enCommands = collectExamples(en).map((e) => e.command);
  const heCommands = collectExamples(he).map((e) => e.command);
  assert.ok(
    enCommands.length > 0,
    `no example markers were found in ${EN} — the marker syntax changed and this ` +
    `assertion has stopped checking anything`,
  );
  assert.deepEqual(
    heCommands, enCommands,
    `the two documents no longer demonstrate the same commands. Regenerate with ` +
    `\`npm run gen:docs\` after adding the marker to both.`,
  );
});

/**
 * The limitation, demonstrated rather than asserted.
 *
 * The plan proposed proving this point by having the test read its own source
 * and match a sentence in it. That form is vacuous here: the regex literal
 * would satisfy its own search, so the assertion passes even after the comment
 * it means to protect is deleted — and even a stricter version could only ever
 * fail when someone edits *this file*, never when the Hebrew goes stale. It
 * would report on its own prose, not on the documents.
 *
 * So the claim is exercised instead. Every Hebrew letter outside the fenced
 * blocks is replaced, which destroys the translation while leaving the
 * structure intact, and the two checks above still pass on the result. That is
 * the limitation made concrete: these assertions are blind to what the Hebrew
 * says.
 *
 * If this test ever fails, the checks above have become sensitive to prose
 * content — good news, but the disclaimers in this file, in the mirror's own
 * introduction and in spec §8 then overstate the blindness and must be
 * corrected to match.
 */
test('structural parity is blind to what the Hebrew actually says', () => {
  const HEBREW = /[֐-׿]/g;
  const fenced = fenceTracker();
  const garbled = he
    .split('\n')
    .map((line) => (fenced(line) ? line : line.replace(HEBREW, 'ם')))
    .join('\n');

  assert.notEqual(garbled, he, 'the mutation changed nothing — this test would be vacuous');

  assert.deepEqual(
    headingDepths(garbled), headingDepths(en),
    'structure survived the mutation, as it must for this demonstration to mean anything',
  );
  assert.deepEqual(
    collectExamples(garbled).map((e) => e.command),
    collectExamples(en).map((e) => e.command),
  );
});

/* ────────────────────────────────────────────────────────────────────────────
 * `docs/capabilities/` and its Hebrew mirror — `rulings/109`, 2026-09-17.
 *
 * @basis INV-nothing-is-dropped-silently RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number
 *
 * ── WHY THIS IS APPENDED HERE AND NOT GIVEN ITS OWN FILE ──────────────────
 *
 * `system-parity.test.ts` is the same gate for `docs/system/`, and it argues at
 * length for being a separate file. This half went the other way, for one
 * measured reason that has nothing to do with taste: `counts.test.ts` counts
 * `test/docs/*.test.ts` and holds BOTH READMEs to the result. That count is 13
 * and both READMEs say 13. A fourteenth file here would make both of them wrong
 * in the same commit that added a gate — a documentation gate breaking the
 * documentation's own number. Extending the file whose subject already IS
 * structural parity costs nothing and breaks nothing.
 *
 * ── WHAT THESE CHECK THAT NO OTHER GATE DOES ──────────────────────────────
 *
 * `test/docs/capabilities.test.ts` does NOT read `docs/capabilities/` — it is
 * about the two READMEs' own "What it can do" section, a name collision that
 * cost this lane a wrong assumption before it was checked. Before this block,
 * nothing under `test/` read these seventeen chapters at all.
 *
 *   - **A pasted block must be byte-identical in both editions.** A block is
 *     what the program PRINTED. `rulings/109`'s brief is that a translation is
 *     precisely where a retyped block would be invisible, and the English
 *     sweeps across this campaign found 10 abridged and 5 doctored blocks.
 *   - **A diagram must not be lost or redrawn.** `check:diagrams` parses every
 *     fence and compares none of them to each other; its floor is a total over
 *     the whole sweep, so a Hebrew chapter that dropped one of its fences while
 *     another document gained one would pass it.
 *   - **A cited item id must be IDENTICAL, never transliterated.** An id is
 *     addressed by name, per
 *     `RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number`; a
 *     transliterated one resolves to nothing, and nothing else in this suite
 *     would notice, because it is still a plausible-looking token.
 *   - **The five shared fences stay shared.** Five English fences are
 *     byte-identical across `README.md`, three capability chapters and
 *     `docs/system/07-focus.md`. The Hebrew copies mirror `docs/README.he.md`'s
 *     own Hebrew fences byte-for-byte rather than being translated a second
 *     time, so the sharing survives the Hebrew edition instead of being quietly
 *     broken by two independent translations of one drawing.
 *
 * ── A DUPLICATION THIS FILE DECLARES RATHER THAN HIDES ────────────────────
 *
 * `pastedBlocks` below is the same shape as `system-parity.test.ts`'s function
 * of that name. Both borrow their two RULES — `fencesIn` for what a diagram is,
 * `fenceTracker` for where a block begins and ends — rather than restating
 * them, so the rules themselves exist once; but the twelve lines that partition
 * one document now exist twice. The repair is one helper under `test/helpers/`,
 * which is outside this lane's write scope. It is named here so it is a known
 * duplication rather than a rediscovered one.
 *
 * ── WHAT THIS CANNOT DO ───────────────────────────────────────────────────
 *
 * The same blindness this file states of its own README pair: it compares
 * structure, never meaning. A paragraph whose Hebrew was left behind by an
 * English edit passes every assertion below. Translation freshness is a review
 * obligation, not a tested one.
 * ──────────────────────────────────────────────────────────────────────── */

const CAP_DIR = 'docs/capabilities';

/** One English chapter and the Hebrew mirror that must accompany it. */
interface CapPair { en: string; he: string }

/**
 * Every `NN-*.md` under `docs/capabilities/`, paired with its `.he.md` sibling.
 *
 * DERIVED by walking the directory, never listed: an eighteenth chapter added
 * with no mirror is exactly the drift this gate exists to catch, and a
 * hand-written pair list cannot catch it. The `.he.md` name is COMPUTED, which
 * is what makes a missing mirror a failure below rather than a pair that
 * quietly does not exist.
 */
function capPairs(): CapPair[] {
  return readdirSync(path.join(REPO, ...CAP_DIR.split('/')))
    .filter((name) => name.endsWith('.md') && !name.endsWith('.he.md'))
    .sort()
    .map((name) => ({
      en: `${CAP_DIR}/${name}`,
      he: `${CAP_DIR}/${name.replace(/\.md$/, '.he.md')}`,
    }));
}

/** Every mirror actually present, so neither side can carry an orphan. */
function capMirrors(): string[] {
  return readdirSync(path.join(REPO, ...CAP_DIR.split('/')))
    .filter((name) => name.endsWith('.he.md'))
    .sort()
    .map((name) => `${CAP_DIR}/${name}`);
}

/**
 * The fenced blocks of a document that are NOT diagrams, in order.
 *
 * Both rules are borrowed: `fencesIn` says what a mermaid fence is (the single
 * extractor `check-diagrams-parse.ts`'s own header insists on), and
 * `fenceTracker` says where a block begins and ends (the CommonMark rule
 * `test/helpers/markdown.ts` already owns). Neither is re-stated here.
 */
async function pastedBlocks(file: string, text: string): Promise<string[]> {
  const diagrams = new Set((await fencesIn(file, text)).map((f) => f.source));
  const inside = fenceTracker();
  const blocks: string[] = [];
  let current: string[] | null = null;
  for (const line of text.split('\n')) {
    const within = inside(line);
    if (within) { if (current === null) current = [line]; else current.push(line); }
    else if (current !== null) { blocks.push(current.join('\n')); current = null; }
  }
  if (current !== null) blocks.push(current.join('\n'));
  // A block's BODY is what `mermaidBlocks` returns — fence lines excluded.
  return blocks.filter((b) => !diagrams.has(`${b.split('\n').slice(1, -1).join('\n')}\n`));
}

/**
 * Every corpus item id a document cites, with its occurrence count.
 *
 * A MULTISET, not a set, deliberately: an id dropped from one of three mentions
 * is a real divergence and a set would call the two documents equal. The
 * prefixes are the shipped catalogue's own (chapter 1), and the shape is
 * `PREFIX-` plus at least two hyphen-joined lower-case runs — the same strict
 * shape `retrieval/return.ts` uses, so it cannot fire on an ordinary word.
 *
 * HTML comments are stripped first: every mirror's own header comment cites the
 * convention items it follows, which the English file has no reason to carry.
 */
function citedIds(text: string): Map<string, number> {
  const PREFIX = 'RULE|DEC|TASK|REQ|STD|CONST|INV|KNOWN|OPENQ|ADR|LESSON|NOTE|REF|MEAS'
    + '|PAT|GLOSS|INSTR|NOGOAL|RUN|PROC|ENV|EXC|CONTRACT|TRADE|ASSUME|EDGE|RISK|PLAN|TODO';
  const id = new RegExp(`\\b(?:${PREFIX})-[a-z0-9]+(?:-[a-z0-9]+)+`, 'g');
  const counted = new Map<string, number>();
  for (const found of text.replace(/<!--[\s\S]*?-->/g, '').match(id) ?? []) {
    counted.set(found, (counted.get(found) ?? 0) + 1);
  }
  return counted;
}

test('every capability chapter has a Hebrew mirror, and every mirror has a chapter', () => {
  const expected = capPairs().map((p) => p.he);
  assert.ok(
    expected.length >= 17,
    `only ${expected.length} chapters found under ${CAP_DIR}; the directory walk is broken, not `
    + 'the documentation',
  );
  assert.deepEqual(
    capMirrors(), expected,
    'a chapter was added or renamed in one language only. Every `' + CAP_DIR + '/NN-*.md` needs a '
    + '`NN-*.he.md` beside it and nothing else may live there.',
  );
});

test('both editions of each capability chapter carry the same section structure', () => {
  let counted = 0;
  for (const { en, he } of capPairs()) {
    const enDepths = headingDepths(read(en));
    const heDepths = headingDepths(read(he));
    assert.ok(
      enDepths.length >= 8,
      `only ${enDepths.length} headings were found in ${en}; the parser is broken, not the document`,
    );
    assert.deepEqual(
      heDepths, enDepths,
      'a section was added or removed in one language only — update both. '
      + `${en} has ${enDepths.length} headings, ${he} has ${heDepths.length}.`,
    );
    counted += enDepths.length;
  }
  assert.ok(counted >= 200, `only ${counted} headings across the whole set; the parser is broken`);
});

test('no capability mirror ends inside an unclosed fenced block', () => {
  // An unclosed block hides everything after it from every check built on the
  // fence rule — including the two below. Asked of a trailing sentinel line
  // that can never itself open or close one.
  let withFence = 0;
  for (const { he } of capPairs()) {
    const inside = fenceTracker();
    const flags = read(he).split('\n').map((l) => inside(l));
    assert.ok(
      !inside(''),
      `${he} ends inside an unclosed fenced block — everything after it is hidden from this file`,
    );
    if (flags.some((f) => f)) withFence += 1;
  }
  // 16 of the 17, measured 2026-09-17. `08-web-ui.md` carries NO fenced block
  // at all and neither does its mirror, which is correct and faithful — so this
  // is a set-level floor rather than a per-file assertion, exactly as
  // `system-parity.test.ts` had to make it for `docs/system/00-index.md`. A
  // per-file version copied blindly would fail on a correct document.
  assert.ok(
    withFence >= 16,
    `only ${withFence} capability mirrors carry a fenced block, where 16 of 17 did on 2026-09-17; `
    + 'the fence tracker is broken, not the documents',
  );
});

test('every capability diagram survives translation with its graph intact', async () => {
  let total = 0;
  for (const { en, he } of capPairs()) {
    const enFences = await fencesIn(en, read(en));
    const heFences = await fencesIn(he, read(he));
    assert.equal(
      heFences.length, enFences.length,
      `${he} carries ${heFences.length} mermaid fence(s) against ${enFences.length} in ${en}. `
      + 'A diagram was added or lost in one language only — the Hebrew edition translates the '
      + 'LABELS and keeps the graph.',
    );
    for (const [i, enFence] of enFences.entries()) {
      const heLines = heFences[i]!.source.split('\n');
      const enLines = enFence.source.split('\n');
      assert.equal(
        heLines[0], enLines[0],
        `${he} fence ${i} opens "${heLines[0]}" where ${en} opens "${enLines[0]}" — the diagram `
        + 'TYPE changed in translation, which is a redraw and not a translation.',
      );
      assert.equal(
        heLines.length, enLines.length,
        `${he} fence ${i} has ${heLines.length} lines against ${enLines.length} in ${en}. Each `
        + 'line is one node or one edge; translating labels never changes how many there are.',
      );
      total += 1;
    }
  }
  assert.ok(
    total >= 17,
    `only ${total} diagram pairs compared; the extractor stopped finding fences, which would `
    + 'make every assertion above vacuous',
  );
});

test('every pasted command-output block is byte-identical in both capability editions', async () => {
  let compared = 0;
  for (const { en, he } of capPairs()) {
    const enBlocks = await pastedBlocks(en, read(en));
    const heBlocks = await pastedBlocks(he, read(he));
    assert.equal(
      heBlocks.length, enBlocks.length,
      `${he} carries ${heBlocks.length} non-diagram fenced block(s) against ${enBlocks.length} `
      + `in ${en}.`,
    );
    for (const [i, enBlock] of enBlocks.entries()) {
      assert.equal(
        heBlocks[i], enBlock,
        `${he} block ${i} is not byte-identical to ${en}'s. A pasted block is WHAT THE PROGRAM `
        + 'PRINTED: it is not translated, not abridged further than the English abridges it, and '
        + 'not retyped. Splice the English block across unchanged and translate only the sentence '
        + 'that introduces it.',
      );
      compared += 1;
    }
  }
  assert.ok(
    compared >= 40,
    `only ${compared} pasted blocks compared; this assertion has stopped checking anything`,
  );
});

test('every cited item id is identical in both editions, never transliterated', () => {
  let compared = 0;
  for (const { en, he } of capPairs()) {
    const enIds = citedIds(read(en));
    const heIds = citedIds(read(he));
    for (const key of new Set([...enIds.keys(), ...heIds.keys()])) {
      assert.equal(
        heIds.get(key) ?? 0, enIds.get(key) ?? 0,
        `${he} cites ${key} ${heIds.get(key) ?? 0} time(s) against ${enIds.get(key) ?? 0} in `
        + `${en}. An id is addressed BY NAME: translating, transliterating or dropping one leaves `
        + 'a citation that resolves to nothing, and it still looks like an id.',
      );
      compared += 1;
    }
  }
  // 93 distinct ids across the seventeen pairs, measured 2026-09-17. This is a
  // FLOOR and not a pin: the figure rises whenever a chapter cites an item it
  // did not before, which is ordinary. What it refuses is the collapse — an id
  // shape that stopped matching would compare zero and pass every assertion
  // above for the wrong reason.
  assert.ok(
    compared >= 90,
    `only ${compared} distinct id(s) compared across the set, where 93 were found on 2026-09-17; `
    + 'the id shape stopped matching',
  );
});

/**
 * The five drawings `README.md` shares byte-for-byte with three capability
 * chapters (and, for one of them, `docs/system/07-focus.md`).
 *
 * The pairing is DERIVED, not listed: any fence a capability chapter shares
 * with `README.md` must have its Hebrew counterpart shared with
 * `docs/README.he.md` at the same index. So a sixth shared drawing is covered
 * the day it appears, and a fence that stops being shared in English stops
 * being asserted here rather than failing for the wrong reason.
 */
test('a drawing shared with the README in English is shared with it in Hebrew too', async () => {
  const enReadme = (await fencesIn(EN, read(EN))).map((f) => f.source);
  const heReadme = (await fencesIn(HE, read(HE))).map((f) => f.source);
  assert.equal(
    heReadme.length, enReadme.length,
    `${HE} carries ${heReadme.length} fence(s) against ${enReadme.length} in ${EN} — the pair `
    + 'this file already holds is out of step, and every assertion below rests on their indexes '
    + 'lining up.',
  );
  let shared = 0;
  for (const { en, he } of capPairs()) {
    const enFences = await fencesIn(en, read(en));
    const heFences = await fencesIn(he, read(he));
    for (const [i, enFence] of enFences.entries()) {
      const at = enReadme.indexOf(enFence.source);
      if (at === -1) continue;
      shared += 1;
      assert.equal(
        heFences[i]!.source, heReadme[at],
        `${en} fence ${i} is byte-identical to ${EN}'s fence ${at + 1}, but ${he}'s is not `
        + `byte-identical to ${HE}'s. One drawing translated twice is two drawings: mirror the `
        + "Hebrew README's fence across instead of translating the English one again.",
      );
    }
  }
  assert.equal(
    shared, 5,
    `${shared} shared drawing(s) found where 5 were expected. If a drawing stopped being shared `
    + 'in English that is a real change — say so here; if the extractor stopped matching, this '
    + 'assertion had gone vacuous.',
  );
});
