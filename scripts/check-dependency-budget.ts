#!/usr/bin/env node
/**
 * **The dependency budget stops being a sentence review keeps missing.**
 *
 *     npm run check:dependencies
 *
 * `CONST-zero-runtime-dependencies` is the promise this repository makes to
 * anyone who installs the plugin: nothing is fetched at run time, which is what
 * lets hooks start in tens of milliseconds and lets the plugin be dropped into
 * any repo. Until 2026-09-07 the constraint said, in its own words, *"NOTHING
 * CHECKS THIS AUTOMATICALLY. No `check:*` script and no CI step reads a
 * dependency list, so a runtime dependency added in a pull request goes green.
 * The guarantee is held by review."*
 *
 * Review missed. `mermaid` was committed as a fourth devDependency in `52f74e4`
 * against a constraint that enumerated three and said in as many words that a
 * fourth is "a ruling to record, never a commit to make". It was found weeks
 * later, by hand, by someone reading `package.json` while verifying something
 * else. `mermaid` turned out to be admissible and has since been admitted on
 * the record — but nothing about that discovery was systematic, and the case
 * that actually matters, a RUNTIME dependency, would have been found the same
 * way or not at all.
 *
 * ── THE ENUMERATION LIVES IN EXACTLY ONE PLACE, AND IT IS NOT HERE ──────────
 *
 * The obvious implementation of this check is a `const ALLOWED = [...]` at the
 * top of this file. That is the bug being fixed, wearing a different hat: two
 * lists that must be edited together are two lists that will disagree, and the
 * disagreement this check exists to catch is precisely a list nobody re-read.
 *
 * So the enumeration is READ OUT OF THE CONSTRAINT — the item body of
 * `CONST-zero-runtime-dependencies`, which is the artifact with the authority
 * to name what is admitted and the only one a ruling is ever recorded in.
 * `scripts/check-vendor.ts` already settles the same question the same way for
 * vendored files: *"The table in that document is the source of truth and is
 * PARSED, not duplicated here."*
 *
 * The parse is anchored on one sentence, whose shape the constraint states
 * about itself so that whoever edits it is warned:
 *
 *     Today they are four: `typescript`, `@types/node`, `@playwright/test`,
 *     `mermaid`.
 *
 * — the words "Today they are", a spelled-out count, a colon, then the names in
 * backticks, ending at the first full stop. Whitespace is collapsed before
 * matching, so the sentence may wrap across lines as prose in that item does.
 *
 * **Every way the parse can fail is RED, never a quiet pass.** No matching
 * sentence, more than one, a count word this file does not know, or a spelled
 * count that disagrees with the number of names — each exits 1 quoting the
 * shape it wanted. A check whose source of truth was rewritten out from under
 * it must say so; it must not fall back to trusting `package.json`, because
 * `package.json` is the thing on trial.
 *
 * The spelled count is not decoration. It is a second, redundant statement of
 * the same fact by the same hand, so a half-finished edit — a name appended and
 * the count left at "four" — fails here instead of silently widening the
 * budget.
 *
 * ── WHAT IS CHECKED ─────────────────────────────────────────────────────────
 *
 * 1. **Any runtime dependency at all.** `dependencies`, and also
 *    `optionalDependencies`, `peerDependencies`, `bundledDependencies` and
 *    `bundleDependencies` — every manifest field that makes a consumer's
 *    `npm install` fetch something. Non-empty is a failure. This is the clause
 *    that matters and the one nothing read before today.
 * 2. **The devDependencies are exactly the enumerated set.** A fifth name fails
 *    (a ruling to record, never a commit to make). An enumerated name that is
 *    NOT installed also fails, in the other direction: the constraint would be
 *    claiming a tool this repository does not have.
 *
 * `RUNTIME_FIELDS` is hard-coded here and that is deliberate, not an exception
 * to the rule above. It is not a project ruling anyone may revise — it is npm's
 * manifest surface, the set of fields that cause a fetch. The constraint names
 * the same fields in prose, and `test/scripts/dependency-budget.test.ts`
 * asserts that every field this file knows about is named there, so those two
 * cannot drift apart in silence either.
 *
 * Versions are not checked. What a devDependency is pinned to is a different
 * question from whether it is admitted at all, and this check makes no claim
 * about it.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { isMainEntry } from '../src/core/paths.ts';

const REPO = path.resolve(import.meta.dirname, '..');

/** The item whose body carries the enumeration. */
export const CONSTRAINT_ID = 'CONST-zero-runtime-dependencies';

/**
 * The manifest fields that make a consumer's `npm install` fetch something.
 *
 * npm's surface, not this project's ruling — see the header. `bundledDependencies`
 * and the `bundleDependencies` spelling are both real and npm honours either.
 */
export const RUNTIME_FIELDS = [
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
  'bundledDependencies',
  'bundleDependencies',
];

/** Spelled counts the enumeration sentence may use. */
const COUNT_WORDS = new Map<string, number>([
  ['zero', 0], ['none', 0], ['one', 1], ['two', 2], ['three', 3], ['four', 4],
  ['five', 5], ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
  ['eleven', 11], ['twelve', 12],
]);

/** The sentence shape the enumeration is read out of, quoted in every complaint. */
export const ENUMERATION_SHAPE =
  'Today they are four: `typescript`, `@types/node`, `@playwright/test`, `mermaid`.';

/** What the constraint enumerates, or why it could not be read. */
export type Enumeration =
  | { ok: true; names: string[]; word: string }
  | { ok: false; problem: string };

/**
 * The devDependencies `CONST-zero-runtime-dependencies` admits, read out of its
 * own body.
 *
 * `text` is the item file as committed — frontmatter included, which costs
 * nothing, because no frontmatter value can match the sentence shape.
 */
export function readEnumeration(text: string): Enumeration {
  const flat = text.replace(/\s+/g, ' ');
  const matches = [...flat.matchAll(/\bToday they are ([A-Za-z]+): ([^.]*)\./g)];

  if (matches.length === 0) {
    return {
      ok: false,
      problem:
        `${CONSTRAINT_ID} no longer states its enumeration in the shape this check reads. `
        + `Expected one sentence of the form: ${ENUMERATION_SHAPE} `
        + 'The list lives in that item and nowhere else, so a body this cannot parse is a '
        + 'budget nothing can enforce — restore the sentence, or teach this parser the new '
        + 'shape deliberately.',
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      problem:
        `${CONSTRAINT_ID} states ${matches.length} enumeration sentences. There must be exactly `
        + 'one, or "the list" names nothing in particular.',
    };
  }

  const word = matches[0]![1]!.toLowerCase();
  const names = [...matches[0]![2]!.matchAll(/`([^`]+)`/g)].map((m) => m[1]!);

  const expected = COUNT_WORDS.get(word);
  if (expected === undefined) {
    return {
      ok: false,
      problem:
        `${CONSTRAINT_ID} spells its count as "${word}", which this check does not know. `
        + `Known: ${[...COUNT_WORDS.keys()].join(', ')}.`,
    };
  }
  if (expected !== names.length) {
    return {
      ok: false,
      problem:
        `${CONSTRAINT_ID} says "${word}" and then names ${names.length}: `
        + `${names.join(', ')}. The count and the list are two statements of one fact by one `
        + 'hand, and they disagree — which is what a half-finished edit to the budget looks '
        + 'like.',
    };
  }
  if (new Set(names).size !== names.length) {
    return {
      ok: false,
      problem: `${CONSTRAINT_ID} names the same devDependency twice: ${names.join(', ')}.`,
    };
  }
  return { ok: true, names, word };
}

/** The shape of `package.json` this check reads. Everything else is ignored. */
export interface Manifest {
  devDependencies?: Record<string, string>;
  [field: string]: unknown;
}

/**
 * Everything wrong with `manifest` against `constraintText`, as sentences.
 *
 * Empty means the budget holds. A constraint that cannot be parsed returns that
 * one problem alone: with no enumeration there is nothing to compare the
 * devDependencies against, and reporting them as fine would be a green run over
 * a question that was never asked.
 */
export function auditDependencies(manifest: Manifest, constraintText: string): string[] {
  const problems: string[] = [];

  // 1. Any runtime dependency at all — the clause that matters.
  for (const field of RUNTIME_FIELDS) {
    const value = manifest[field];
    if (value === undefined || value === null) continue;
    const named = Array.isArray(value)
      ? value.map(String)
      : typeof value === 'object'
        ? Object.keys(value as object)
        : [String(value)];
    if (named.length === 0) continue;
    problems.push(
      `package.json declares ${field}: ${named.join(', ')}. ${CONSTRAINT_ID} is that the `
      + 'shipped plugin fetches NOTHING at run time — that is what makes hooks start in tens '
      + 'of milliseconds and what lets the plugin be dropped into any repo. No ruling admits '
      + 'a runtime dependency: the MCP server speaks JSON-RPC by hand and the frontmatter '
      + 'parser is written by hand for exactly this reason.',
    );
  }

  // 2. The devDependencies are exactly what the constraint enumerates.
  const enumeration = readEnumeration(constraintText);
  if (!enumeration.ok) {
    problems.push(enumeration.problem);
    return problems;
  }

  const admitted = new Set(enumeration.names);
  const installed = Object.keys(manifest.devDependencies ?? {});

  for (const name of installed) {
    if (admitted.has(name)) continue;
    problems.push(
      `package.json declares the devDependency ${name}, which ${CONSTRAINT_ID} does not `
      + `enumerate. It admits ${enumeration.word} — ${enumeration.names.join(', ')} — and says `
      + 'another is "a ruling to record, never a commit to make". Record the ruling in that '
      + 'item first (mycontext edit), and this check goes green on the edit rather than on '
      + 'the commit.',
    );
  }
  for (const name of enumeration.names) {
    if (installed.includes(name)) continue;
    problems.push(
      `${CONSTRAINT_ID} enumerates ${name} and package.json does not install it. The `
      + 'enumeration is a claim about this repository, and a claim about a tool nobody has '
      + 'is the same drift running the other way.',
    );
  }
  return problems;
}

/** The item file for `id`, found by walking the corpus rather than by guessing its type. */
export function findItemFile(itemsDir: string, id: string): string | null {
  const stack = [itemsDir];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) stack.push(full);
      else if (entry === `${id}.md`) return full;
    }
  }
  return null;
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  const itemsDir = path.join(REPO, '.my_context', 'items');
  const file = findItemFile(itemsDir, CONSTRAINT_ID);
  if (file === null) {
    process.stderr.write(
      `my_context: ${CONSTRAINT_ID} is not in ${path.relative(REPO, itemsDir)}. The dependency `
      + 'budget is enumerated in that item and nowhere else, so without it this check has '
      + 'nothing to enforce.\n',
    );
    process.exit(1);
  }
  const constraintText = readFileSync(file, 'utf8');
  const manifest = JSON.parse(
    readFileSync(path.join(REPO, 'package.json'), 'utf8')) as Manifest;
  const problems = auditDependencies(manifest, constraintText);

  if (problems.length === 0) {
    const enumeration = readEnumeration(constraintText);
    const names = enumeration.ok ? enumeration.names : [];
    process.stdout.write(
      `package.json declares no runtime dependency, and ${names.length} devDependencies `
      + `(${names.join(', ')}) — exactly what ${CONSTRAINT_ID} enumerates.\n`,
    );
    process.exit(0);
  }
  for (const problem of problems) process.stderr.write(`  ${problem}\n`);
  process.stderr.write(`package.json: ${problems.length} problem(s).\n`);
  process.exit(1);
}
