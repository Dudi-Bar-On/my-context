/**
 * The capabilities summary — `## What it can do`, near the top of both READMEs
 * — is a map of the document rather than a second copy of it. These tests pin
 * the correspondence in both directions, so the map cannot drift from the
 * territory without the suite saying so.
 *
 * The defect this exists to prevent is the one the whole
 * `docs/superpowers/plans/2026-08-15-buried-capabilities.md` plan was written
 * to fix: a capability that works, is documented, and is invisible to a reader
 * who does not already know it is there. Six of them were, and the user read
 * the documentation and concluded one of them did not exist. A summary that
 * silently stops naming a section puts the next one back in the same place.
 *
 * **What "major" means here, and why.** A section is major when the table of
 * contents links to it. That is the document's own curated statement of what a
 * reader must be able to reach from the first screen, and it is maintained:
 * every section this plan added is in it. The two rules a depth test could use
 * are both wrong for this document. `##` alone would miss `#### From an
 * incident to a rule` and `#### From a document to draft items` — two of the
 * plan's six buried capabilities, both of them `####` — which is precisely the
 * failure being guarded against. Every `####` would admit fifteen
 * configuration keys, four flag-table groups and three rules about flags, and a
 * summary naming all of those is not scannable in under a minute, which is the
 * one property it has to have.
 *
 * What this cannot check: whether a line is *true*, or whether it says anything
 * useful about the section it points at. `test/docs/inventory.test.ts` carries
 * the same disclaimer for the same reason. A green suite is not a reviewed
 * summary.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fenceTracker, headings, type Heading } from '../helpers/markdown.ts';

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
 * The two sections this file is about, identified by position rather than by
 * name.
 *
 * The Hebrew mirror has Hebrew headings, so a slug lookup would need a second
 * hardcoded pair of Hebrew strings that nothing keeps in step with the English
 * ones. `parity.test.ts` already holds the two documents to the same heading
 * sequence, so the *n*th heading of one is the same section as the *n*th
 * heading of the other, and an index is a name that survives translation.
 */
const CONTENTS_SLUG = 'contents';
const SUMMARY_SLUG = 'what-it-can-do';

interface Doc {
  relative: string;
  lines: string[];
  headings: Heading[];
  /** Every heading slug in the document, for resolving a link target. */
  slugs: Set<string>;
}

function load(relative: string, markdown: string): Doc {
  const hs = headings(markdown);
  return {
    relative,
    lines: markdown.split('\n'),
    headings: hs,
    slugs: new Set(hs.map((h) => h.slug)),
  };
}

const docs = { en: load(EN, en), he: load(HE, he) };

/**
 * The in-document anchors linked from one section's body — the section's own
 * heading excluded, and links inside fenced blocks excluded with it, since
 * quoted output is not the document linking anywhere.
 *
 * A section ends at the next heading of the same depth or shallower, which is
 * what makes `## What it can do` stop at `## 2. The idea` rather than running
 * to the end of the file.
 */
function anchorsIn(doc: Doc, index: number): string[] {
  const start = doc.headings[index];
  const next = doc.headings.slice(index + 1).find((h) => h.depth <= start.depth);
  const body = doc.lines.slice(start.line, next === undefined ? doc.lines.length : next.line - 1);
  const fenced = fenceTracker();
  const prose = body.filter((line) => !fenced(line)).join('\n');
  return [...prose.matchAll(/\]\((#[^)\s]+)\)/g)].map((m) => decodeURIComponent(m[1].slice(1)));
}

function indexOfSlug(doc: Doc, slug: string): number {
  const at = doc.headings.findIndex((h) => h.slug === slug);
  assert.notEqual(
    at, -1,
    `${doc.relative} has no heading slugging to "${slug}" — the section was renamed or ` +
    `removed, and this file stopped checking the summary rather than failing on it`,
  );
  return at;
}

const summaryIndex = indexOfSlug(docs.en, SUMMARY_SLUG);
const contentsIndex = indexOfSlug(docs.en, CONTENTS_SLUG);

const summaryAnchors = {
  en: anchorsIn(docs.en, summaryIndex),
  he: anchorsIn(docs.he, summaryIndex),
};
const contentsAnchors = {
  en: anchorsIn(docs.en, contentsIndex),
  he: anchorsIn(docs.he, contentsIndex),
};

/**
 * The major sections the summary deliberately does not name, each with the
 * reason it is not a capability line.
 *
 * `8-not-yet-available` is deliberately absent: the summary's own opening
 * sentence links it, to say that nothing on the list below is unbuilt. A
 * *capability line* for a section 8 entry would be the plan's own defect
 * committed in the most-read part of the document; a pointer saying "the
 * unbuilt things are over there" is the opposite.
 *
 * This list is the whole point of the second test. Adding a section to the
 * contents without giving it a line fails until somebody either writes the line
 * or writes down here why the section is not something the product can do — and
 * a stale entry, for a section the contents no longer links to, fails too.
 */
const NOT_A_CAPABILITY = new Map<string, string>([
  ['what-it-can-do', 'the summary itself'],
  ['1-the-problem', 'the problem the product answers, not something it does'],
  ['2-the-idea', 'the normative/rationale split the capabilities rest on'],
  ['3-how-it-works-in-three-steps', 'a container; its three steps each have a line'],
  ['4-when-it-comes-back-and-what', 'a container; its four tiers and the budget have lines'],
  ['5-using-it', 'a container; its four surfaces have lines'],
  ['6-configuration', 'a container; the categories sections have lines'],
  ['7-the-trust-boundary', 'a container; review, revisions and the boundary have lines'],
  ['9-glossary', 'the vocabulary of the document, not a capability'],
  ['installing-it', 'how to get it, which is not what it can do'],
  ['every-flag-in-one-place', 'a reference index of the flags the other sections name'],
]);

test('every capability line links to a section that exists', () => {
  for (const doc of [docs.en, docs.he]) {
    const anchors = doc === docs.en ? summaryAnchors.en : summaryAnchors.he;
    assert.ok(
      anchors.length >= 10,
      `only ${anchors.length} links were found in the capabilities summary of ` +
      `${doc.relative} — the section was gutted, or the marker this file looks for changed ` +
      `and it has stopped checking anything`,
    );
    const broken = anchors.filter((a) => !doc.slugs.has(a));
    assert.deepEqual(
      broken, [],
      `the capabilities summary of ${doc.relative} links to ${broken.join(', ')}, which no ` +
      `heading in that file slugs to. A summary line pointing nowhere is worse than no line: ` +
      `it reads as a promise that the section exists.`,
    );
  }
});

test('every major section is named in the capabilities summary', () => {
  // Guards the way this test could pass while checking nothing: an empty
  // contents makes every difference empty.
  assert.ok(
    contentsAnchors.en.length >= 25,
    `only ${contentsAnchors.en.length} links were found in the contents of ${EN}; ` +
    `"major" is defined by that list, so this test is only as good as finding it`,
  );

  const named = new Set(summaryAnchors.en);
  const unmapped = [...new Set(contentsAnchors.en)].filter((a) => !named.has(a)).toSorted();

  assert.deepEqual(
    unmapped, [...NOT_A_CAPABILITY.keys()].toSorted(),
    `the capabilities summary and the contents of ${EN} disagree about what the document ` +
    `covers. A section in the contents with no summary line is invisible again to a reader ` +
    `who scans the top — the defect this plan exists to fix. Either give it a line, or add ` +
    `it to NOT_A_CAPABILITY in this file with the reason it is not one. An entry listed ` +
    `there that the contents no longer links to fails here too, so the exemptions cannot ` +
    `outlive their sections.`,
  );
});

test('the Hebrew summary maps the same sections as the English one', () => {
  // Positional, per the note on CONTENTS_SLUG: parity holds the two documents
  // to the same heading sequence, so comparing the *positions* the two
  // summaries point at compares meaning without translating anything. A Hebrew
  // line that resolves — and points at the wrong section — fails here.
  const positions = (doc: Doc, anchors: string[]): number[] => {
    const index = new Map(doc.headings.map((h, i) => [h.slug, i]));
    return anchors.map((a) => index.get(a) ?? -1).toSorted((a, b) => a - b);
  };

  assert.deepEqual(
    positions(docs.he, summaryAnchors.he), positions(docs.en, summaryAnchors.en),
    `the Hebrew capabilities summary points at a different set of sections than the English ` +
    `one. Both documents must map the same document.`,
  );
  assert.deepEqual(
    positions(docs.he, contentsAnchors.he), positions(docs.en, contentsAnchors.en),
    `the two tables of contents point at different sections, so "major" does not mean the ` +
    `same thing in the two documents and the check above is comparing unlike things.`,
  );
});
