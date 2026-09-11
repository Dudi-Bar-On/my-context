// @basis TASK-the-store-is-delivered-at-every-door-an-agent-starts-through, INV-nothing-is-dropped-silently, TASK-seed-the-store-and-migrate-the-rules-that-already-exist
/**
 * **The rendered set: every applicable entry, no inapplicable one, and NEVER
 * the owner's own words.**
 *
 * D41 spec §6 and §8, `plan:store seq:2` Task 6.
 *
 * ── THE `request` ASSERTION IS THE ONE THAT MATTERS ────────────────────────
 *
 * Spec §6 carries the owner's requirement verbatim: the free text he wrote
 * when he asked for an entry is *"for documentation only and should not be
 * injected to the context"*. A renderer that leaked it would leak it into
 * every session and every subagent dispatch, on the highest-traffic path this
 * product has, and nothing downstream would ever report it — the field is
 * legal, so no parser refuses it and no check counts it.
 *
 * So the assertion plants a string that CANNOT arrive by accident and looks
 * for it in the rendered text. `renderEntry` is structurally incapable of
 * emitting it (see `deliver.ts`'s header), and that is exactly why the test is
 * here: "structurally incapable" is a claim about code that somebody will edit.
 *
 * ── AND THE ANTI-VACUITY HALF ──────────────────────────────────────────────
 *
 * An absence test passes against a renderer that emits nothing at all. Every
 * absence assertion below is therefore paired with a presence one over the
 * SAME entry, so "the request is missing" can never be satisfied by the entry
 * being missing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { corpusSlug, findConflicts, renderEntry, renderRules } from '../../src/rules/deliver.ts';
import { ALWAYS, partsOf, TEMPLATE, type Kind } from '../../src/rules/schema.ts';
import { loadRules } from '../../src/rules/store.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * The planted request. Nothing in this repository writes this string, so its
 * appearance anywhere in a rendered block can only have come from the field.
 */
const PLANTED_REQUEST =
  'ZZQ-PLANTED-REQUEST-ONLY-FOR-DOCUMENTATION-never-inject-this-sentence-anywhere';

const PRODUCT_FACT = [
  '---',
  'id: a-body-stops-at-the-first-heading',
  'kind: fact',
  'tier: product',
  'title: an item body stops at the first ## heading',
  'truth: everything from the first `## ` heading onwards is dropped when a body is stored',
  'breaks: the tail of a body is lost with no error, and the write reports success',
  'example: the 2026-09-07 item whose Observations block vanished on save',
  'check: "preventive:the write path refuses a body carrying a ## heading"',
  `request: "${PLANTED_REQUEST}"`,
  '---',
  '',
  'True for anyone who installs the tool.',
  '',
].join('\n');

const DEVELOPER_PROHIBITION = [
  '---',
  'id: never-git-add-all',
  'kind: prohibition',
  'tier: developer',
  'title: never git add -A',
  'prohibition: never stage with `git add -A` or a bare `git commit -a`',
  'why: "a bare commit swept another lane\'s staged work into a commit about a table border"',
  'example: that commit, on 2026-09-09',
  'check: "detective:the archive is asked whether any lane ran `git add -A`"',
  '---',
  '',
  'How this repository chose to work.',
  '',
].join('\n');

const PROCEDURE = [
  '---',
  'id: how-a-lane-reports-its-work',
  'kind: procedure',
  'tier: product',
  'title: how a lane reports what it built',
  'steps:',
  '  - name the items the work rests on',
  '  - run the suite and read its own exit code',
  '  - report the exact paths to stage',
  'proof: the dispatching session can stage from the report without opening a file',
  'example: the 2026-09-10 D41 Phase 1 report',
  'check: "none - nothing gates what a report says, and the archive cannot parse one yet"',
  '---',
  '',
].join('\n');

function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-deliver-'));
  for (const [name, text] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), text, 'utf8');
  }
  return dir;
}

function withFixture(files: Record<string, string>, fn: (dir: string) => void): void {
  const dir = fixture(files);
  try { fn(dir); } finally { removeTree(dir); }
}

/* ══ 1. EVERY APPLICABLE ENTRY, AND NO INAPPLICABLE ONE ════════════════════ */

test('the rendered text carries every applicable entry', () => {
  withFixture(
    { 'a.md': PRODUCT_FACT, 'b.md': DEVELOPER_PROHIBITION, 'c.md': PROCEDURE },
    (dir) => {
      const set = loadRules(dir, true);
      assert.equal(set.entries.length, 3, 'the fixture did not load, so nothing below means anything');
      const { text, entries } = renderRules(set);

      for (const entry of set.entries) {
        assert.ok(
          text.includes(entry.title),
          `the rendered set is missing \`${entry.id}\`. Spec §10: in a user's install ` +
          'EVERYTHING in the store is injected, no exception — a rule that is in the store and ' +
          'not in the block is a rule nobody can obey and nobody can see is absent.',
        );
        assert.ok(text.includes(entry.id), `the rendered set does not cite \`${entry.id}\` by id`);
      }
      assert.deepEqual(entries, set.entries.map((e) => e.id));
    },
  );
});

test('an inapplicable entry is not rendered, and the applicable one still is', () => {
  withFixture({ 'a.md': PRODUCT_FACT, 'b.md': DEVELOPER_PROHIBITION }, (dir) => {
    // A FOREIGN workspace, which is the only way to prove the FILTER rather
    // than to prove the field was written — `store.test.ts` makes the same
    // point about the same load.
    const { text } = renderRules(loadRules(dir, false));
    assert.ok(
      !text.includes('never git add -A'),
      'a `developer` entry reached a foreign workspace\'s block. The tier is the shipping ' +
      'boundary: a rule about how THIS repository works is not the tool\'s law elsewhere.',
    );
    assert.ok(
      text.includes('an item body stops at the first ## heading'),
      'the product entry is missing too, so the assertion above is satisfied by an empty block',
    );
  });
});

test('every part of an entry\'s template is rendered, and the parts come from TEMPLATE', () => {
  withFixture({ 'c.md': PROCEDURE }, (dir) => {
    const [entry] = loadRules(dir, true).entries;
    const rendered = renderEntry(entry);
    for (const part of partsOf(entry.kind)) {
      assert.ok(
        rendered.includes(part.name),
        `\`${part.name}\` — a part \`TEMPLATE\` says a \`${entry.kind}\` owes — is not in the ` +
        'rendered entry. `schema.ts` is the only place a part is named; a renderer that names ' +
        'its own subset is the second table that file exists to prevent.',
      );
    }
    // `steps` is a LIST, and a procedure whose steps arrived as one sentence
    // has lost the ordering that makes it a procedure (schema.ts · PartShape).
    for (const step of entry.parts.steps as string[]) {
      assert.ok(rendered.includes(step), `the step ${JSON.stringify(step)} was not rendered`);
    }
  });
});

/**
 * Anti-vacuity for the assertion above: it would pass against a renderer that
 * printed the whole frontmatter verbatim. This one fails if the part names in
 * the rendered text are a literal list rather than `TEMPLATE`'s.
 */
test('a part that only one kind owes is not rendered on the kinds that do not', () => {
  withFixture({ 'a.md': PRODUCT_FACT }, (dir) => {
    const [entry] = loadRules(dir, true).entries;
    const rendered = renderEntry(entry);
    const own = new Set(partsOf('fact').map((p) => p.name));
    const foreign = (Object.keys(TEMPLATE) as Kind[])
      .flatMap((k) => TEMPLATE[k].map((p) => p.name))
      .filter((name) => !own.has(name));
    assert.ok(foreign.length > 0, 'no foreign part names exist, so this proves nothing');
    for (const name of foreign) {
      assert.ok(
        !rendered.includes(`**${name}:**`),
        `\`${name}\` belongs to another kind and was rendered on a \`fact\`. An empty required ` +
        'field teaches people to write filler (spec §4).',
      );
    }
  });
});

/* ══ 2. `request` IS NEVER IN THE RENDERED TEXT (spec §6) ══════════════════ */

test('the owner\'s own words are never in the rendered set', () => {
  withFixture({ 'a.md': PRODUCT_FACT }, (dir) => {
    const set = loadRules(dir, true);
    assert.equal(
      set.entries[0].request, PLANTED_REQUEST,
      'the fixture entry carries no `request`, so its absence below proves nothing at all',
    );
    const { text } = renderRules(set);
    assert.ok(
      text.includes('an item body stops at the first ## heading'),
      'the entry itself was not rendered, so the absence below is the entry being missing',
    );
    assert.ok(
      !text.includes(PLANTED_REQUEST),
      'the `request` field reached the injected block. Spec §6, in the owner\'s words: it is ' +
      '"for documentation only and should not be injected to the context". It would leak into ' +
      'every session and every subagent dispatch, and no parser or check would ever report it ' +
      'because the field is legal.',
    );
  });
});

test('the request is absent from a whole delivered set, not merely from one entry', () => {
  withFixture(
    { 'a.md': PRODUCT_FACT, 'b.md': DEVELOPER_PROHIBITION, 'c.md': PROCEDURE },
    (dir) => {
      const { text } = renderRules(loadRules(dir, true));
      assert.ok(!text.includes(PLANTED_REQUEST));
      assert.ok(!text.includes('ZZQ-PLANTED'), 'even a fragment of the request survived');
    },
  );
});

/* ══ 3. NOTHING IS DROPPED SILENTLY ════════════════════════════════════════ */

test('an entry that did not load is NAMED in the block, not merely absent from it', () => {
  const broken = '---\nid: half-an-entry\nkind: fact\ntier: product\ntitle: t\n---\n\nno parts\n';
  withFixture({ 'a.md': PRODUCT_FACT, 'broken.md': broken }, (dir) => {
    const set = loadRules(dir, true);
    assert.equal(set.refused.length, 1, 'the fixture did not produce a refusal');
    const { text, refused } = renderRules(set);
    assert.ok(
      text.includes('half-an-entry'),
      'a constant that did not load is invisible in the delivered block. A reader holding one ' +
      'constant when two shipped has no way to learn the second existed ' +
      '(INV-nothing-is-dropped-silently).',
    );
    assert.ok(text.includes('did not load'), 'the block does not say what happened');
    assert.deepEqual(refused, ['half-an-entry']);
  });
});

test('an empty store with nothing refused renders nothing at all', () => {
  withFixture({}, (dir) => {
    assert.equal(
      renderRules(loadRules(dir, true)).text, '',
      'a door that speaks and says nothing teaches its reader to skip the block',
    );
  });
});

/* ══ 4. THE SLUG, WHICH TASK 8 RESTS ON ═══════════════════════════════════ */

test('a corpus id\'s category prefix is stripped and a store id is left alone', () => {
  assert.equal(corpusSlug('RULE-never-git-add-all'), 'never-git-add-all');
  assert.equal(corpusSlug('STD-a-summary-is-one-plain-sentence'), 'a-summary-is-one-plain-sentence');
  assert.equal(
    corpusSlug('never-git-add-all'), 'never-git-add-all',
    'a store id has no category, so there is nothing to strip',
  );
  assert.equal(
    corpusSlug('a-body-stops-at-the-first-heading'), 'a-body-stops-at-the-first-heading',
    'a lower-case head is a word, not a category — stripping it would match on the tail of an ' +
    'unrelated slug and report a conflict between two rules that merely rhyme',
  );
});

test('a conflict is found only on an exact slug match', () => {
  withFixture({ 'b.md': DEVELOPER_PROHIBITION }, (dir) => {
    const entries = loadRules(dir, true).entries;
    assert.deepEqual(
      findConflicts(entries, ['RULE-never-git-add-all']),
      [{ entry: 'never-git-add-all', item: 'RULE-never-git-add-all' }],
    );
    assert.deepEqual(
      findConflicts(entries, ['RULE-never-git-add-all-of-it', 'STD-something-else']), [],
      'a near miss was reported as a conflict. A check that cries wolf is a check people turn ' +
      'off, and this one exists to be believed.',
    );
  });
});

/* ══ 5. THE TWO PARTS EVERY KIND OWES REACH THE READER ════════════════════ */

test('`example` and `check` are rendered on every kind', () => {
  withFixture(
    { 'a.md': PRODUCT_FACT, 'b.md': DEVELOPER_PROHIBITION, 'c.md': PROCEDURE },
    (dir) => {
      for (const entry of loadRules(dir, true).entries) {
        const rendered = renderEntry(entry);
        for (const part of ALWAYS) {
          assert.ok(
            rendered.includes(`**${part.name}:**`),
            `\`${part.name}\` is missing from \`${entry.id}\`. The example is what stops an ` +
            'entry being arguable and the check is the inventory §14 reads; an entry delivered ' +
            'without them is the weaker artifact spec §4 measured at 57.5% violated.',
          );
        }
      }
    },
  );
});

/* ══ 6. PROVENANCE IS DEVELOPER-TIER ONLY (owner's ruling, 2026-09-11) ═════ */

/**
 * **A product entry must not name the corpus item it was moved from, and a
 * developer entry must.**
 *
 * The owner's ruling of 2026-09-11, on the first product-tier entry the
 * migration produced. A migrated entry carries where it came from, and for the
 * two `developer` entries that is useful provenance: they never leave this
 * repository, and the reader of one can open the retired item. A `product`
 * entry ships to every install, where the same line names an item the reader
 * does not have and cannot fetch — a citation that resolves to nothing, in the
 * one block this product says outranks everything else.
 *
 * He was offered three ways out — strip it for product entries, keep it and
 * update both READMEs, or isolate the documentation fixture — and chose the
 * first: **omitted for `product`, kept for `developer`.**
 *
 * ── WHY THE ASSERTION IS ON A PLANTED ID AND NOT ON THE WORD "Moved" ───────
 *
 * `deliver.ts`'s whole subject is text, and four assertions on this plan were
 * lost in two days to a substring some other part of the same output also
 * carried. The ids below are planted: nothing in this repository writes them,
 * and `renderEntry` can only emit one of them from the provenance footer. So
 * `includes(MOVED_FROM_A_DEVELOPER_ENTRY)` is an assertion about the footer
 * and about nothing else, which `includes('Moved')` would not be — a body
 * quoting the word, or a future preamble mentioning it, would satisfy that.
 */
const MOVED_FROM_A_PRODUCT_ENTRY = 'RULE-ZZQ-PLANTED-PROVENANCE-behind-the-product-entry';
const MOVED_FROM_A_DEVELOPER_ENTRY = 'RULE-ZZQ-PLANTED-PROVENANCE-behind-the-developer-entry';

const MIGRATED_PRODUCT = [
  '---',
  'id: a-migrated-product-fact',
  'kind: fact',
  'tier: product',
  'title: a product fact that used to be a corpus item',
  'truth: this entry was a corpus rule before it was a product constant',
  'breaks: nothing — it is here to be rendered',
  'example: the 2026-09-11 migration',
  'check: "none - this is a fixture and the archive has nothing to measure it against"',
  `movedFrom: ${MOVED_FROM_A_PRODUCT_ENTRY}`,
  'movedOn: 2026-09-11',
  '---',
  '',
  'The prose the item carried, which travels with it.',
  '',
].join('\n');

const MIGRATED_DEVELOPER = [
  '---',
  'id: a-migrated-developer-prohibition',
  'kind: prohibition',
  'tier: developer',
  'title: a developer prohibition that used to be a corpus item',
  'prohibition: never do the thing this fixture is about',
  'why: because the fixture says so',
  'example: the 2026-09-11 migration',
  'check: "none - this is a fixture and the archive has nothing to measure it against"',
  `movedFrom: ${MOVED_FROM_A_DEVELOPER_ENTRY}`,
  'movedOn: 2026-09-11',
  '---',
  '',
  'The prose the item carried, which travels with it.',
  '',
].join('\n');

test('a PRODUCT entry does not name the corpus item it was moved from', () => {
  withFixture({ 'p.md': MIGRATED_PRODUCT }, (dir) => {
    const [entry] = loadRules(dir, true).entries;
    assert.equal(entry.tier, 'product', 'the fixture is not the tier this test is about');
    const rendered = renderEntry(entry);
    assert.ok(
      !rendered.includes(MOVED_FROM_A_PRODUCT_ENTRY),
      'a product constant named the corpus item it was moved from. It ships to every install, ' +
      'where that id names an item the reader does not have and cannot fetch — a citation that ' +
      'resolves to nothing, in the block this product says outranks every other source.',
    );
    // Anti-vacuity: the absence above is satisfied by an entry that rendered
    // nothing at all, and this is the half that says it rendered.
    assert.ok(
      rendered.includes('a product fact that used to be a corpus item'),
      'the entry did not render at all, so the absence above proves nothing',
    );
  });
});

test('a DEVELOPER entry DOES name the corpus item it was moved from', () => {
  withFixture({ 'd.md': MIGRATED_DEVELOPER }, (dir) => {
    const [entry] = loadRules(dir, true).entries;
    assert.equal(entry.tier, 'developer', 'the fixture is not the tier this test is about');
    assert.ok(
      renderEntry(entry).includes(MOVED_FROM_A_DEVELOPER_ENTRY),
      'a developer entry lost its provenance. It never leaves this repository, and the reader ' +
      'of one can open the retired item it points at — dropping the pointer here would be ' +
      'paying for the product tier\'s problem with the developer tier\'s evidence.',
    );
  });
});

test('ONE delivered block carries the developer entry\'s source and not the product entry\'s', () => {
  withFixture({ 'p.md': MIGRATED_PRODUCT, 'd.md': MIGRATED_DEVELOPER }, (dir) => {
    const set = loadRules(dir, true);
    assert.equal(set.entries.length, 2, 'the fixture did not load, so nothing below means anything');
    const { text } = renderRules(set);
    assert.ok(
      text.includes(MOVED_FROM_A_DEVELOPER_ENTRY),
      'the developer entry\'s provenance is missing from the delivered block',
    );
    assert.ok(
      !text.includes(MOVED_FROM_A_PRODUCT_ENTRY),
      'the product entry\'s provenance reached the delivered block. The two tiers are rendered ' +
      'by one function into one block, so this is the assertion the ruling is actually about.',
    );
  });
});
