/**
 * **The dependency budget, proved by planting what it must refuse.**
 *
 * `scripts/check-dependency-budget.ts` exists because the thing it checks was
 * held by review and review missed: `mermaid` was committed as a fourth
 * devDependency in `52f74e4` against a constraint enumerating three, and was
 * found weeks later by hand. The case that actually matters — a RUNTIME
 * dependency, which breaks the promise a user installs on — had nothing
 * reading it at all.
 *
 * So no clause below is demonstrated by reading the source and agreeing with
 * it. Each is demonstrated by **planting a violation and requiring the specific
 * complaint**, and the anti-vacuity tests come first: a checker that cannot
 * read its own source of truth would pass everything, pass every plant that
 * depends on it, and report the budget held while seeing nothing.
 *
 * Two of these tests are STANDING ASSERTIONS about this repository rather than
 * about synthetic input — the real `package.json` audited against the real
 * `CONST-zero-runtime-dependencies`, and the `check:dependencies` script being
 * wired to this file. They are what makes the gate ride `npm test` in CI
 * without a workflow edit, so a runtime dependency added in a pull request is
 * red on the suite that already runs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  CONSTRAINT_ID, RUNTIME_FIELDS,
  auditDependencies, findItemFile, readEnumeration, type Manifest,
} from '../../scripts/check-dependency-budget.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const ITEMS = path.join(REPO, '.my_context', 'items');

const CONSTRAINT_FILE = findItemFile(ITEMS, CONSTRAINT_ID);
assert.notEqual(CONSTRAINT_FILE, null, `${CONSTRAINT_ID} must exist in the corpus`);
const CONSTRAINT = readFileSync(CONSTRAINT_FILE!, 'utf8');
const PACKAGE = JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8')) as Manifest;

/** The real constraint with its enumeration sentence replaced by `replacement`. */
function constraintSaying(replacement: string): string {
  const flat = CONSTRAINT.replace(
    /Today they are [A-Za-z]+:[^.]*\./,
    replacement,
  );
  assert.notEqual(flat, CONSTRAINT, 'the substitution must have changed something');
  return flat;
}

// ── 0. The reader is not blind ─────────────────────────────────────────────

/**
 * **Anti-vacuity, and the load-bearing test in this file.**
 *
 * Everything else assumes the enumeration was actually read out of the
 * constraint. If the parse silently found nothing, `auditDependencies` would
 * report the parse failure rather than pass — but this pins the stronger claim:
 * it reads the four names that are there, out of the real item, today.
 */
test('the enumeration is read out of the real constraint item', () => {
  const parsed = readEnumeration(CONSTRAINT);
  assert.equal(parsed.ok, true, parsed.ok ? '' : parsed.problem);
  assert.ok(parsed.ok);
  assert.deepEqual(
    [...parsed.names].sort(),
    ['@playwright/test', '@types/node', 'mermaid', 'typescript'],
  );
  assert.equal(parsed.word, 'four');
});

/**
 * The enumeration is NOT duplicated in the checker. Planting a different list
 * in the constraint must change what the checker admits — if it did not, the
 * script would be carrying its own copy and this whole exercise would be the
 * same drift wearing a different hat.
 */
test('the admitted set follows the constraint, not a list in the script', () => {
  const rewritten = constraintSaying('Today they are two: `typescript`, `@types/node`.');
  const problems = auditDependencies(PACKAGE, rewritten);
  assert.ok(problems.some((p) => p.includes('@playwright/test')));
  assert.ok(problems.some((p) => p.includes('mermaid')));
});

// ── 1. The standing assertions about this repository ───────────────────────

/**
 * **The gate itself.** Real manifest, real constraint, no problems. This is the
 * assertion that rides `npm test` in CI, so a runtime dependency or an
 * unenumerated devDependency added in a pull request is red on the suite that
 * already runs, whether or not anyone remembers `npm run check:dependencies`.
 */
test('the real package.json satisfies the real constraint', () => {
  assert.deepEqual(auditDependencies(PACKAGE, CONSTRAINT), []);
});

test('package.json wires check:dependencies to this script', () => {
  const scripts = (PACKAGE as { scripts?: Record<string, string> }).scripts ?? {};
  assert.equal(scripts['check:dependencies'], 'node scripts/check-dependency-budget.ts');
});

/**
 * `RUNTIME_FIELDS` is the one list the script does hold, because it is npm's
 * manifest surface rather than a project ruling. It is still allowed to drift
 * from the constraint's prose, so it is checked rather than trusted: every
 * field the script refuses is named in the item that explains why.
 */
test('every runtime field the script knows is named in the constraint', () => {
  for (const field of RUNTIME_FIELDS) {
    assert.ok(
      CONSTRAINT.includes(field),
      `${CONSTRAINT_ID} does not mention ${field}, which the check refuses`,
    );
  }
});

// ── 2. A fifth devDependency ───────────────────────────────────────────────

test('a fifth devDependency is refused, and named', () => {
  const planted: Manifest = {
    ...PACKAGE,
    devDependencies: { ...PACKAGE.devDependencies, 'left-pad': '^1.3.0' },
  };
  const problems = auditDependencies(planted, CONSTRAINT);
  assert.equal(problems.length, 1);
  assert.ok(problems[0]!.includes('left-pad'));
  assert.ok(problems[0]!.includes('a ruling to record, never a commit to make'));
});

/**
 * The drift running the other way: the constraint claiming a tool this
 * repository does not install. The enumeration is a claim about the repo, and a
 * claim about nothing is as stale as a missing one.
 */
test('an enumerated devDependency that is not installed is refused', () => {
  const rewritten = constraintSaying(
    'Today they are five: `typescript`, `@types/node`, `@playwright/test`, `mermaid`, `vitest`.',
  );
  const problems = auditDependencies(PACKAGE, rewritten);
  assert.equal(problems.length, 1);
  assert.ok(problems[0]!.includes('vitest'));
  assert.ok(problems[0]!.includes('does not install it'));
});

// ── 3. A runtime dependency — the case that actually matters ───────────────

test('a runtime dependency is refused in every field npm would fetch from', () => {
  for (const field of RUNTIME_FIELDS) {
    const planted: Manifest = { ...PACKAGE, [field]: { chalk: '^5.3.0' } };
    const problems = auditDependencies(planted, CONSTRAINT);
    assert.equal(problems.length, 1, `${field} produced ${problems.length} problem(s)`);
    assert.ok(problems[0]!.includes(field));
    assert.ok(problems[0]!.includes('chalk'));
    assert.ok(problems[0]!.includes('fetches NOTHING at run time'));
  }
});

/** `bundledDependencies` is an ARRAY of names, not an object. Both shapes read. */
test('a bundled dependency written as an array is refused', () => {
  const planted: Manifest = { ...PACKAGE, bundledDependencies: ['chalk'] };
  const problems = auditDependencies(planted, CONSTRAINT);
  assert.equal(problems.length, 1);
  assert.ok(problems[0]!.includes('chalk'));
});

/**
 * The constraint's words are *"`dependencies` is empty and stays empty"*. An
 * empty field declares nothing and fetches nothing, so it passes; only a name
 * in it is a breach.
 */
test('an empty dependencies field is not a breach', () => {
  assert.deepEqual(auditDependencies({ ...PACKAGE, dependencies: {} }, CONSTRAINT), []);
  assert.deepEqual(auditDependencies({ ...PACKAGE, bundledDependencies: [] }, CONSTRAINT), []);
});

// ── 4. Every way the source of truth can go unreadable is RED ──────────────

/**
 * The failure this file most needs to rule out: the constraint gets rewritten,
 * the anchor sentence disappears, and the check quietly admits everything
 * because it found no list to compare against.
 */
test('a constraint whose enumeration cannot be parsed is red, not permissive', () => {
  const gutted = CONSTRAINT.replace(
    /Today they are [A-Za-z]+:[^.]*\./,
    'The list is kept elsewhere now.',
  );
  const problems = auditDependencies(PACKAGE, gutted);
  assert.equal(problems.length, 1);
  assert.ok(problems[0]!.includes('no longer states its enumeration'));
  assert.ok(problems[0]!.includes('Today they are four'), 'it must quote the shape it wanted');
});

test('a spelled count that disagrees with the list is red', () => {
  const rewritten = constraintSaying(
    'Today they are four: `typescript`, `@types/node`, `@playwright/test`.',
  );
  const problems = auditDependencies(PACKAGE, rewritten);
  assert.equal(problems.length, 1);
  assert.ok(problems[0]!.includes('says "four" and then names 3'));
});

test('a count word the checker does not know is red', () => {
  const rewritten = constraintSaying(
    'Today they are several: `typescript`, `@types/node`, `@playwright/test`, `mermaid`.',
  );
  const problems = auditDependencies(PACKAGE, rewritten);
  assert.equal(problems.length, 1);
  assert.ok(problems[0]!.includes('spells its count as "several"'));
});

test('two enumeration sentences are red, because neither is the list', () => {
  const rewritten = CONSTRAINT.replace(
    /(Today they are [A-Za-z]+:[^.]*\.)/,
    '$1 Today they are one: `typescript`.',
  );
  const problems = auditDependencies(PACKAGE, rewritten);
  assert.equal(problems.length, 1);
  assert.ok(problems[0]!.includes('2 enumeration sentences'));
});

test('the same name enumerated twice is red', () => {
  const rewritten = constraintSaying(
    'Today they are four: `typescript`, `typescript`, `@playwright/test`, `mermaid`.',
  );
  const problems = auditDependencies(PACKAGE, rewritten);
  assert.equal(problems.length, 1);
  assert.ok(problems[0]!.includes('names the same devDependency twice'));
});

/**
 * A runtime dependency is reported even when the enumeration is unreadable —
 * the two clauses answer different questions, and the one that matters must not
 * be lost because the other could not be asked.
 */
test('an unreadable enumeration does not hide a runtime dependency', () => {
  const gutted = CONSTRAINT.replace(/Today they are [A-Za-z]+:[^.]*\./, 'Gone.');
  const problems = auditDependencies({ ...PACKAGE, dependencies: { chalk: '^5' } }, gutted);
  assert.equal(problems.length, 2);
  assert.ok(problems.some((p) => p.includes('chalk')));
  assert.ok(problems.some((p) => p.includes('no longer states its enumeration')));
});

// ── 5. The sentence may be reflowed, because it is prose ───────────────────

/**
 * The item wraps at 80 columns and the enumeration crosses a line break today.
 * Whitespace is collapsed before matching precisely so that rewrapping a
 * paragraph — which changes nothing about what it says — does not break the
 * gate and teach everyone that this check cries wolf.
 */
test('the enumeration still parses when the sentence is rewrapped', () => {
  const rewrapped = CONSTRAINT.replace(
    /Today they are [A-Za-z]+:[^.]*\./,
    'Today they are\n   four:\n   `typescript`,\n   `@types/node`,\n'
    + '   `@playwright/test`,\n   `mermaid`.',
  );
  const parsed = readEnumeration(rewrapped);
  assert.ok(parsed.ok);
  assert.equal(parsed.names.length, 4);
});
