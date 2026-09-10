// @basis TASK-the-store-loads-refuses-what-it-cannot-parse-and-proves-it, INV-nothing-is-dropped-silently
/**
 * **The store loads a directory, applies the tier, and NAMES what it could not
 * read.**
 *
 * D41 spec §3 (two tiers) and §7 (the store itself), `plan:store seq:1` Task 2.
 *
 * The tier assertion is made by LOADING AGAINST A FOREIGN WORKSPACE, never by
 * reading the flag back off an entry — the plan says so and the reason is the
 * one this repository keeps re-learning: asserting that `tier === 'developer'`
 * proves the field was written, not that the filter honours it, and the filter
 * is the thing a user's install depends on.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { entriesDir, loadRules } from '../../src/rules/store.ts';
import { removeTree } from '../helpers/tmp.ts';

/** The store as it ships. */
const RULES = entriesDir();

const PRODUCT = [
  '---',
  'id: a-body-stops-at-the-first-heading',
  'kind: fact',
  'tier: product',
  'title: an item body stops at the first ## heading',
  'truth: everything from the first `## ` heading onwards is dropped when a body is stored',
  'breaks: the tail of a body is lost with no error, and the write reports success',
  'example: the 2026-09-07 item whose Observations block vanished on save',
  'check: "preventive:the write path refuses a body carrying a ## heading"',
  '---',
  '',
  'True for anyone who installs the tool.',
  '',
].join('\n');

const DEVELOPER = [
  '---',
  'id: never-git-add-all',
  'kind: prohibition',
  'tier: developer',
  'title: never git add -A',
  'prohibition: never stage with `git add -A` or a bare `git commit -a`',
  'why: "on 2026-09-09 a bare commit swept another lane\'s staged work into a commit about a table border"',
  'example: that commit',
  'check: "detective:the archive is asked whether any lane ran `git add -A`"',
  '---',
  '',
  'How this repository chose to work. In a stranger\'s project it may be wrong.',
  '',
].join('\n');

/** A directory holding `files`, cleaned up by the caller. */
function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-rules-'));
  for (const [name, text] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), text, 'utf8');
  }
  return dir;
}

function withFixture(files: Record<string, string>, fn: (dir: string) => void): void {
  const dir = fixture(files);
  try { fn(dir); } finally { removeTree(dir); }
}

/* ══ 1. THE TIER, ASSERTED BY LOADING ══════════════════════════════════════ */

test('a developer entry is absent in a foreign workspace, and a product entry is not', () => {
  withFixture({ 'p.md': PRODUCT, 'd.md': DEVELOPER }, (dir) => {
    const inHere = loadRules(dir, true).entries.map((e) => e.id);
    const elsewhere = loadRules(dir, false).entries.map((e) => e.id);

    assert.ok(inHere.includes('never-git-add-all'), 'the developer entry is absent in my_context');
    assert.equal(
      elsewhere.includes('never-git-add-all'), false,
      'a developer entry reached a foreign workspace. `tier` is the shipping boundary — a rule ' +
      'about how THIS repository works is not the tool\'s law in a stranger\'s project.',
    );

    // The other half, and it is not decoration: a filter that returned nothing
    // at all would pass the assertion above while shipping no rules to anyone.
    assert.ok(
      elsewhere.includes('a-body-stops-at-the-first-heading'),
      'the product entry did not survive the tier filter, so the filter drops everything',
    );
    assert.ok(inHere.includes('a-body-stops-at-the-first-heading'));
  });
});

test('the tier filter is the only difference between the two loads', () => {
  withFixture({ 'p.md': PRODUCT, 'd.md': DEVELOPER }, (dir) => {
    const elsewhere = loadRules(dir, false).entries;
    assert.deepEqual(elsewhere.map((e) => e.tier), ['product'], 'a non-product entry survived');
  });
});

/* ══ 2. NOTHING IS DROPPED SILENTLY ════════════════════════════════════════ */

test('an unparseable entry is refused and named, never skipped', () => {
  withFixture({ 'p.md': PRODUCT, 'broken.md': '---\nid: half\nkind: fact\n---\n\nno parts\n' }, (dir) => {
    const { entries, refused } = loadRules(dir, true);
    assert.deepEqual(entries.map((e) => e.id), ['a-body-stops-at-the-first-heading']);
    assert.equal(refused.length, 1, 'the unreadable file was skipped rather than refused');
    assert.match(refused[0].path, /broken\.md$/, 'the refusal does not carry the path of the file');
  });
});

/**
 * A refusal is refused in BOTH tiers, and not filtered away with the tier it
 * claims. A broken file's `tier` is exactly the field that may be unreadable,
 * so filtering refusals by it would make the worst-damaged entries the ones
 * nobody is told about.
 */
test('a refusal reaches a foreign workspace too — a broken entry has no trustworthy tier', () => {
  withFixture({ 'broken.md': '---\nid: half\nkind: fact\ntier: developer\n---\n' }, (dir) => {
    assert.equal(loadRules(dir, false).refused.length, 1);
  });
});

test('two entries with the same id are refused, and the refusal names both files', () => {
  withFixture({ 'a.md': PRODUCT, 'b.md': PRODUCT }, (dir) => {
    const { entries, refused } = loadRules(dir, true);
    assert.equal(entries.length, 1, 'a duplicate id was loaded twice');
    assert.equal(refused.length, 1);
    assert.match(refused[0].error, /a\.md/);
    assert.match(refused[0].error, /b\.md/);
  });
});

test('a file that is not Markdown is not read as an entry, and is not a refusal either', () => {
  withFixture({ 'p.md': PRODUCT, 'manifest.json': '{}', 'notes.txt': 'x' }, (dir) => {
    const { entries, refused } = loadRules(dir, true);
    assert.equal(entries.length, 1);
    assert.deepEqual(refused, [], 'a non-entry file was reported as a broken entry');
  });
});

test('a directory that does not exist is an empty store, not a crash', () => {
  const { entries, refused } = loadRules(path.join(tmpdir(), 'myctx-rules-absent-xyz'), true);
  assert.deepEqual(entries, []);
  assert.equal(refused.length, 1, 'a missing store said nothing at all');
  assert.match(refused[0].error, /no rule store/i);
});

test('entries come back in a stable order, so two runs cannot disagree', () => {
  withFixture({ 'z.md': PRODUCT, 'a.md': DEVELOPER }, (dir) => {
    assert.deepEqual(
      loadRules(dir, true).entries.map((e) => e.id),
      ['a-body-stops-at-the-first-heading', 'never-git-add-all'],
    );
  });
});

/* ══ 3. THE STORE AS IT SHIPS ══════════════════════════════════════════════ */

test('the shipped store loads with nothing refused', () => {
  const { entries, refused } = loadRules(RULES, true);
  assert.deepEqual(
    refused.map((r) => `${r.path}: ${r.error}`), [],
    'an entry in the shipped store does not load. Every later phase treats this store as true.',
  );
  assert.ok(entries.length > 0, 'the shipped store is empty, so every assertion about it is vacuous');
});

test('the shipped store holds the seed entry the design chose, and holds it as a standard', () => {
  const seed = loadRules(RULES, true).entries
    .find((e) => e.id === 'numbered-options-on-a-question-put-to-the-owner');
  assert.ok(seed !== undefined, 'the first seed entry (design §4) is not in the store');
  assert.equal(seed.kind, 'standard');
  assert.equal(seed.tier, 'developer');
  assert.equal(seed.trigger, 'putting a decision to the owner');
  assert.equal(seed.check.how, 'detective');
});

test('every file in the shipped store is an entry — nothing is there by accident', () => {
  const markdown = readdirSync(RULES).filter((f) => f.endsWith('.md'));
  assert.equal(
    markdown.length, loadRules(RULES, true).entries.length,
    'the store directory holds a .md file the loader does not return. Either it is refused ' +
    '(and the test above would say so) or it is being filtered by tier in a workspace that ' +
    'is this one, which nothing should do.',
  );
});
