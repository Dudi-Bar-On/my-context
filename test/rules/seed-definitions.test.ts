// @basis TASK-seed-the-store-and-migrate-the-rules-that-already-exist, INV-nothing-is-dropped-silently
/**
 * **The definitions the store is seeded with, and the one thing that stops a
 * `check` field being decoration.**
 *
 * D41 spec §15 names the vocabulary by name — *lane, spill, stand down, the
 * corpus, known-red, the ration, a door, prove by removal* — so the list below
 * is the requirement rather than a sample of it, and a term missing from the
 * store fails by name rather than by a count going down.
 *
 * ── THE ASSERTION THAT DOES THE REAL WORK ──────────────────────────────────
 *
 * `a check that names a path names a path that EXISTS`. Spec §4's whole
 * argument for the field is that an enforced check beats prose 37.6% to 57.5%,
 * and the way that argument fails quietly is an entry declaring
 * `preventive:<something plausible>` with nothing behind it. Then the store
 * reports more enforcement than it has, which is worse than reporting none —
 * it is the failure §2 calls the one this store must not become.
 *
 * `none - <reason>` stays legal, exactly as `@basis none - <reason>` is legal
 * here, and it is asserted to carry a reason rather than to be rare: rarity is
 * a judgement, and a judgement is not a test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { entriesDir, loadRules } from '../../src/rules/store.ts';
import type { Entry } from '../../src/rules/schema.ts';

/** Spec §15's list, verbatim and in its own order. */
const VOCABULARY: readonly { id: string; term: string }[] = [
  { id: 'def-a-lane', term: 'lane' },
  { id: 'def-spill', term: 'spill' },
  { id: 'def-stand-down', term: 'stand down' },
  { id: 'def-the-corpus', term: 'the corpus' },
  { id: 'def-known-red', term: 'known-red' },
  { id: 'def-the-ration', term: 'the ration' },
  { id: 'def-a-door', term: 'a door' },
  { id: 'def-prove-by-removal', term: 'prove by removal' },
];

function definitions(): Map<string, Entry> {
  const loaded = loadRules(entriesDir(), true);
  assert.deepEqual(loaded.refused, [], 'the store refused an entry');
  return new Map(loaded.entries.filter((e) => e.kind === 'definition').map((e) => [e.id, e]));
}

for (const { id, term } of VOCABULARY) {
  test(`${term} is defined, and says what it is confused with`, () => {
    const entry = definitions().get(id);
    assert.ok(entry !== undefined, `${id} is not in the store`);
    assert.equal(entry.parts.term, term);
    // Three separate parts, asserted separately: a definition that folded
    // `confusedWith` into `means` would still be a definition of the word and
    // would have dropped the half that stops two readers using it differently.
    assert.ok(String(entry.parts.means).length > 80, `${id}: \`means\` is a stub`);
    assert.ok(String(entry.parts.confusedWith).length > 40, `${id}: \`confusedWith\` is a stub`);
    assert.notEqual(entry.parts.confusedWith, entry.parts.means);
  });
}

test('the store defines every term the design names, and no term twice', () => {
  const found = [...definitions().values()].map((e) => String(e.parts.term)).sort();
  assert.deepEqual(found, VOCABULARY.map((v) => v.term).sort());
});

test('a definition that claims a check names a file that exists', () => {
  const unbacked: string[] = [];
  for (const entry of definitions().values()) {
    if (entry.check.how === 'none') continue;
    // The check's name is prose that CITES a path; the citation is what has to
    // resolve. A check naming no path at all is caught by the next assertion.
    const cited = /((?:src|test|scripts|e2e)\/[\w./-]+\.ts)/.exec(entry.check.name);
    if (cited === null) { unbacked.push(`${entry.id}: names no runnable path`); continue; }
    if (!existsSync(path.join(process.cwd(), cited[1]))) {
      unbacked.push(`${entry.id}: ${cited[1]} does not exist`);
    }
  }
  assert.deepEqual(unbacked, []);
});

test('a definition that declares `none` carries a reason, never a bare none', () => {
  const bare: string[] = [];
  for (const entry of definitions().values()) {
    if (entry.check.how !== 'none') continue;
    if (entry.check.why.trim().length < 40) bare.push(`${entry.id}: ${entry.check.why}`);
  }
  assert.deepEqual(bare, []);
});

test('the seeded definitions are developer tier, because promoting one ships it', () => {
  const shipped = [...definitions().values()].filter((e) => e.tier === 'product').map((e) => e.id);
  // Spec §3: new entries default to `developer` — the blast radius of a
  // misfiled developer rule is one workspace, a misfiled product rule ships to
  // everyone. Promoting any of these is the owner's act, and §3 makes it
  // reversible in both directions, so this is a gate rather than a verdict.
  assert.deepEqual(shipped, []);
});
