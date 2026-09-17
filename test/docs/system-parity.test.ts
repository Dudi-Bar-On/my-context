/**
 * Structural parity between every chapter of `docs/system/` and its Hebrew
 * mirror `docs/system/NN-*.he.md`.
 *
 * `parity.test.ts` holds `README.md` to `docs/README.he.md` and is the model
 * for this file, but it is deliberately NOT extended in place and NOT copied
 * wholesale, for two reasons found by reading it against these documents rather
 * than assumed:
 *
 *   - **Its pair is fixed and named; this one is eight pairs discovered by
 *     walking the directory.** That difference is the point. A ninth chapter
 *     added with no mirror is exactly the drift this gate exists to catch, and
 *     a hand-written pair list cannot catch it — so the pairing is DERIVED
 *     here, and the first test below is the one that fails when a chapter has
 *     no mirror or a mirror has no chapter.
 *   - **Its anti-vacuity guard does not fit these files.** `assertParsable`
 *     asserts that a fenced block was found, because both READMEs carry many.
 *     `docs/system/00-index.md` carries NONE, so that guard copied blindly
 *     would fail on a correct document. It is replaced below by a set-level
 *     guard — the whole pair set must carry fences — which catches a broken
 *     fence tracker without asserting something false about one chapter.
 *
 * `test/docs/` did not read `docs/system/` at all before this file.
 *
 * ── WHAT THIS CHECKS THAT NO OTHER GATE DOES ──────────────────────────────
 *
 * **A pasted command-output block must be byte-identical in both editions.**
 * That is the assertion worth having here and it is not structural padding:
 * `rulings/109`'s own brief is that a translation is precisely where a RETYPED
 * output block would be invisible, and the English sweeps across this campaign
 * found 10 abridged and 5 doctored blocks. A block is what the program printed;
 * translating, abridging or tidying one in the mirror is a claim the program
 * never made. This test makes that a failure rather than a reading obligation.
 *
 * **A diagram must not be lost in translation.** `npm run check:diagrams`
 * parses every fence in both editions and compares none of them to each other,
 * and its floor is a total over the whole sweep — so a Hebrew chapter that
 * dropped one of its two fences while another document gained one would pass
 * it. Here each pair's fence count, and each fence's own line count and header
 * line, must agree: the labels are translated, the graph is not.
 *
 * ── WHAT THIS CANNOT DO ───────────────────────────────────────────────────
 *
 * The same blindness `parity.test.ts` states of its own pair, and for the same
 * reason: it compares structure, never meaning. A paragraph whose Hebrew was
 * left behind by an English edit — same headings, same diagram skeleton, same
 * pasted block, stale sentence — passes every assertion in this file. The last
 * test below demonstrates that against the real documents rather than asserting
 * it in a comment. Translation freshness is a review obligation, not a tested
 * one.
 *
 * When an assertion here fails, the fix is bringing the two documents into
 * line — never deleting the assertion, and never editing one document's heading
 * level to make the sequences match while the sections differ.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fencesIn, REPO } from '../../scripts/check-diagrams-parse.ts';
import { fenceTracker, headings } from '../helpers/markdown.ts';

const DIR = 'docs/system';

/** LF-normalized: a working tree checked out before `.gitattributes` is CRLF. */
function read(relative: string): string {
  return readFileSync(path.join(REPO, relative), 'utf8').replaceAll('\r\n', '\n');
}

/** One English chapter and the Hebrew mirror that must accompany it. */
interface Pair { en: string; he: string }

/**
 * Every `NN-*.md` under `docs/system/`, paired with its `.he.md` sibling.
 *
 * Derived by walking the directory rather than listed, so adding a chapter
 * adds a pair here on its own. The `.he.md` name is COMPUTED from the English
 * one, which is what makes a missing mirror a failure below rather than a pair
 * that quietly does not exist.
 */
function pairs(): Pair[] {
  return readdirSync(path.join(REPO, ...DIR.split('/')))
    .filter((name) => name.endsWith('.md') && !name.endsWith('.he.md'))
    .sort()
    .map((name) => ({
      en: `${DIR}/${name}`,
      he: `${DIR}/${name.replace(/\.md$/, '.he.md')}`,
    }));
}

/** Every file actually present, so neither side can carry an orphan. */
function present(suffix: '.he.md' | '.md'): string[] {
  return readdirSync(path.join(REPO, ...DIR.split('/')))
    .filter((name) => (suffix === '.he.md' ? name.endsWith('.he.md') : name.endsWith('.md') && !name.endsWith('.he.md')))
    .sort()
    .map((name) => `${DIR}/${name}`);
}

/**
 * The fenced blocks of a document that are NOT diagrams, in order.
 *
 * Mermaid fences are identified by the product's own `mermaidBlocks`, reached
 * through `fencesIn` — the single extractor `check-diagrams-parse.ts`'s own
 * header insists on, and the reason this function subtracts a known set rather
 * than classifying info strings itself. A second classifier disagrees with the
 * first one the day a fence gets an unusual info string.
 *
 * The block boundaries come from `fenceTracker`, the CommonMark rule
 * `test/helpers/markdown.ts` already owns. So both rules in play here are
 * borrowed; neither is re-stated.
 */
async function pastedBlocks(file: string, text: string): Promise<string[]> {
  const diagrams = new Set((await fencesIn(file, text)).map((f) => f.source));
  const inside = fenceTracker();
  const lines = text.split('\n');
  const blocks: string[] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    const within = inside(line);
    if (within && current === null) current = [line];
    else if (within) current.push(line);
    else if (current !== null) { blocks.push(current.join('\n')); current = null; }
  }
  if (current !== null) blocks.push(current.join('\n'));
  // A block's BODY is what `mermaidBlocks` returns — fence lines excluded.
  return blocks.filter((b) => !diagrams.has(`${b.split('\n').slice(1, -1).join('\n')}\n`));
}

test('every chapter has a Hebrew mirror, and every mirror has a chapter', () => {
  const expected = pairs().map((p) => p.he);
  assert.ok(expected.length >= 8, `only ${expected.length} chapters found under ${DIR}; the ` +
    `directory walk is broken, not the documentation`);
  assert.deepEqual(
    present('.he.md'), expected,
    `a chapter was added or renamed in one language only. Every \`${DIR}/NN-*.md\` needs a ` +
    `\`NN-*.he.md\` beside it and nothing else may live there.`,
  );
});

test('both editions of each chapter carry the same section structure', () => {
  let counted = 0;
  for (const { en, he } of pairs()) {
    const enDepths = headings(read(en)).map((h) => h.depth);
    const heDepths = headings(read(he)).map((h) => h.depth);
    assert.ok(
      enDepths.length >= 5,
      `only ${enDepths.length} headings were found in ${en}; the parser is broken, not the ` +
      `document`,
    );
    assert.deepEqual(
      heDepths, enDepths,
      `a section was added or removed in one language only — update both. ` +
      `${en} has ${enDepths.length} headings, ${he} has ${heDepths.length}.`,
    );
    counted += enDepths.length;
  }
  assert.ok(counted >= 60, `only ${counted} headings across the whole set; the parser is broken`);
});

test('no mirror ends inside an unclosed fenced block', () => {
  // An unclosed block hides everything after it from every check built on the
  // fence rule — including the two below. Asked of a trailing sentinel line
  // that can never itself open or close one.
  let withFence = 0;
  for (const { he } of pairs()) {
    const inside = fenceTracker();
    const flags = read(he).split('\n').map((l) => inside(l));
    assert.ok(!inside(''), `${he} ends inside an unclosed fenced block — everything after it is ` +
      `hidden from this file`);
    if (flags.some((f) => f)) withFence += 1;
  }
  assert.ok(
    withFence >= 7,
    `only ${withFence} mirrors carry a fenced block; the fence tracker is broken, not the ` +
    `documents. (${DIR}/00-index.md carries none by design, which is why this is a set-level ` +
    `floor and not a per-file assertion.)`,
  );
});

test('every diagram survives translation with its graph intact', async () => {
  let total = 0;
  for (const { en, he } of pairs()) {
    const enFences = await fencesIn(en, read(en));
    const heFences = await fencesIn(he, read(he));
    assert.equal(
      heFences.length, enFences.length,
      `${he} carries ${heFences.length} mermaid fence(s) against ${enFences.length} in ${en}. ` +
      `A diagram was added or lost in one language only — the Hebrew edition translates the ` +
      `LABELS and keeps the graph.`,
    );
    for (const [i, enFence] of enFences.entries()) {
      const heFence = heFences[i]!;
      const enLines = enFence.source.split('\n');
      const heLines = heFence.source.split('\n');
      assert.equal(
        heLines[0], enLines[0],
        `${he} fence ${i} opens "${heLines[0]}" where ${en} opens "${enLines[0]}" — the diagram ` +
        `TYPE changed in translation, which is a redraw and not a translation.`,
      );
      assert.equal(
        heLines.length, enLines.length,
        `${he} fence ${i} has ${heLines.length} lines against ${enLines.length} in ${en}. Each ` +
        `line is one node or one edge; translating labels never changes how many there are.`,
      );
      total += 1;
    }
  }
  assert.ok(total >= 12, `only ${total} diagram pairs compared; the extractor stopped finding ` +
    `fences, which would make every assertion above vacuous`);
});

test('every pasted command-output block is byte-identical in both editions', async () => {
  let compared = 0;
  for (const { en, he } of pairs()) {
    const enBlocks = await pastedBlocks(en, read(en));
    const heBlocks = await pastedBlocks(he, read(he));
    assert.equal(
      heBlocks.length, enBlocks.length,
      `${he} carries ${heBlocks.length} non-diagram fenced block(s) against ${enBlocks.length} ` +
      `in ${en}.`,
    );
    for (const [i, enBlock] of enBlocks.entries()) {
      assert.equal(
        heBlocks[i], enBlock,
        `${he} block ${i} is not byte-identical to ${en}'s. A pasted block is WHAT THE PROGRAM ` +
        `PRINTED: it is not translated, not abridged further than the English abridges it, and ` +
        `not retyped. Splice the English block across unchanged and translate only the sentence ` +
        `that introduces it.`,
      );
      compared += 1;
    }
  }
  assert.ok(compared >= 6, `only ${compared} pasted blocks compared; this assertion has stopped ` +
    `checking anything`);
});

/**
 * The limitation, demonstrated rather than asserted — the same move
 * `parity.test.ts` makes for its own pair, and for the same reason: a regex
 * that finds its own source proves nothing, and a comment cannot fail.
 *
 * Every Hebrew letter outside the fenced blocks is replaced, which destroys the
 * translation while leaving headings, diagram skeletons and pasted blocks
 * intact, and the checks above still pass on the result.
 *
 * If this test ever fails, the checks above have become sensitive to prose
 * content — good news, but the disclaimers in this file's header, and in each
 * mirror's own "the English is the source of record" line, then overstate the
 * blindness and must be corrected to match.
 */
test('structural parity is blind to what the Hebrew actually says', async () => {
  const HEBREW = /[֐-׿]/g;
  const { en, he } = pairs()[1]!; // 01-the-board: headings, two diagrams, prose.
  const original = read(he);
  const inside = fenceTracker();
  const garbled = original
    .split('\n')
    .map((line) => (inside(line) ? line : line.replace(HEBREW, 'ם')))
    .join('\n');

  assert.notEqual(garbled, original, 'the mutation changed nothing — this test would be vacuous');

  assert.deepEqual(
    headings(garbled).map((h) => h.depth),
    headings(read(en)).map((h) => h.depth),
    'structure survived the mutation, as it must for this demonstration to mean anything',
  );
  assert.equal(
    (await fencesIn(he, garbled)).length,
    (await fencesIn(en, read(en))).length,
  );
  assert.deepEqual(
    await pastedBlocks(he, garbled),
    await pastedBlocks(en, read(en)),
  );
});
