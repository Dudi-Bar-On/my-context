/**
 * **Which tests rest on an item, asked at the one moment somebody knows — and
 * every path in the answer resolved against disk.**
 *
 * `plan:contra seq:2`, and the design of record is
 * `docs/superpowers/specs/2026-09-07-contradiction-gate-design.md` §8. Owner
 * ruling 2026-09-07, in his words: when an item is retired, *"all the tests
 * that rely on the superseded item must be updated or deleted — every test,
 * including TDD, regression, unit and e2e."*
 *
 * ── WHY THIS IS NOT A SCANNER OF ASSERTIONS, AND IT WAS MEASURED ───────────
 *
 * `budget/16` reversed one admission rule and reddened **26 fixtures across
 * ten files. Not one was a logic failure** — every one asserted an absence the
 * reversed rule had made true — and **zero of the 26 named the rule they
 * rested on.** They encoded it: a golden string, a bare `pinned: 1500`, an item
 * titled "Only an index line", a helper comment reading "one pinned item and
 * one index-only item" with no id in it. One was worse than silent: it CITED an
 * item still in force while the assertion above it rested on the rule being
 * reversed, so a reader who checked that citation concluded the test was
 * covered. **There is no token to match on.**
 *
 * So this module never reads an assertion. It reads the two places where a
 * claim about "this test rests on that item" is written down ON PURPOSE:
 *
 *  1. **`@basis` declarations.**
 *     `RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none` is the
 *     ruling and `scripts/check-basis.ts` is its gate; this reads the same
 *     grammar (`BASIS_MARKER`, `headerLines`), exported from here and imported
 *     BACK by that script so the two cannot drift into two grammars.
 *  2. **A test path recorded in an item's `scope`.** §8 names this as the
 *     cheapest version of the answer — *"the successor's existing `scope` can
 *     carry the test paths, and `checkDeadScopes` validates them today"*.
 *
 * ── THE HALF THAT IS LOAD-BEARING: THE ANSWER IS RESOLVED, NOT REPEATED ────
 *
 * **An answer that names a test file which is not there is worse than no
 * answer, because it resolves for a reader who does not check.** That is the
 * same defect as the one citation among the 26 that pointed at a live item
 * while resting on a dead rule. So the two halves are reported differently and
 * the difference is the point:
 *
 *  - a **declaration** is real by construction — it was found by walking the
 *    tree, so the file exists because it was just read; and
 *  - a **recorded path** is a claim, and every one is resolved against the
 *    files actually on disk. A path that resolves to nothing is `unresolved`
 *    and is named as such: that is the renamed-or-deleted case, and §8 says it
 *    is *"precisely the finding that matters six months later"*.
 *
 * ── AND THE SENTENCE §8 SAYS MUST BE WRITTEN INTO THE CODE ─────────────────
 *
 * **COMPLETENESS CAN NEVER BE CHECKED. "No tests named" is indistinguishable
 * from "no tests affected". So this can never be an error and can never gate**
 * — the same shape as the owner's ruling that `check-cited-items` reports
 * rather than gates, one layer up. §8 asks for that sentence to be in the
 * implementation *"or the field will grow a gate within a month"*, and
 * `restingTestsSaid` below is where it is said out loud to the reader as well.
 *
 * `walked` is reported for the same reason: a corpus in a project with no
 * `test/` tree at all answers zero, and zero-because-nothing-was-read is a
 * different fact from zero-because-nothing-rests-on-it
 * (`STD-a-measured-zero-is-drawn-and-named`).
 *
 * **This module reads and never writes**, and it must stay that way: it is
 * imported by `core/mutate.ts`, whose result message carries the answer through
 * every door into retirement.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { globToRegExp } from './paths.ts';

/**
 * The two trees a test lives in, which is what
 * `RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none` scopes
 * itself to.
 */
export const TEST_TREES: readonly string[] = ['test', 'e2e'];

/**
 * A ceiling on the walk, so that superseding an item in a repository with a
 * very large test tree cannot turn one write into an unbounded directory
 * crawl. `truncated` says when it bit, because a silently short answer to
 * "which tests rest on this" is the exact shape this module exists to refuse.
 */
export const TEST_FILE_LIMIT = 5000;

/**
 * The declaration marker, anchored to the START of a comment line.
 *
 * Moved here from `scripts/check-basis.ts`, which now imports it back, for the
 * reason `core/overlap.ts` gives about `overlapScore`: the gate and the write
 * path may not each carry their own copy of one grammar. `scripts/` is not in
 * the published package (`package.json` · `files`), so a `src/` module can
 * never import from it; the arrow points this way or the two spellings drift.
 */
export const BASIS_MARKER =
  /^[ \t]*(?:\/\/+|\/\*+|\*+(?!\/))[ \t]*@basis\b[ \t]*(.*?)[ \t]*(?:\*+\/)?[ \t]*$/;

/** A comment or blank line: the two things a file header is made of. */
export const HEADER_LINE = /^[ \t]*(?:\/\/|\/\*|\*|$)/;

/** The payload of any comment line, marker stripped, for reason continuation. */
export const COMMENT_PAYLOAD = /^[ \t]*(?:\/\/+|\/\*+|\*+(?!\/))[ \t]?(.*?)[ \t]*(?:\*+\/)?[ \t]*$/;

/**
 * The run of blank and comment lines at the top of the file, which is where a
 * declaration lives and the only place this looks. It ends at the first line of
 * code, so a planted string in a template literal further down a file is out of
 * reach by construction rather than by a heuristic.
 */
export function headerLines(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!HEADER_LINE.test(line)) break;
    out.push(line);
  }
  return out;
}

/**
 * Every token written after `@basis` in a file's header, joined across the
 * comma-continuation lines the convention allows, or `null` when the header
 * carries no declaration at all.
 *
 * Deliberately NOT a judgement about the declaration: malformed, `none` and a
 * list of ids all come back as tokens, and `scripts/check-basis.ts` remains the
 * one place that rules on which is which. This asks a narrower question — does
 * this header name THIS id — and a narrower question must not grow a second
 * opinion about the grammar.
 */
export function basisTokens(text: string): string[] | null {
  const lines = headerLines(text);
  let at = -1;
  for (let i = 0; i < lines.length; i++) {
    if (BASIS_MARKER.test(lines[i]!)) { at = i; break; }
  }
  if (at === -1) return null;
  const payloads = [BASIS_MARKER.exec(lines[at]!)![1]!.trim()];
  for (let i = at + 1; i < lines.length && payloads[payloads.length - 1]!.endsWith(','); i++) {
    const m = COMMENT_PAYLOAD.exec(lines[i]!);
    const payload = (m?.[1] ?? '').trim();
    if (payload === '') break;
    payloads.push(payload);
  }
  return payloads.join(' ').split(/[,\s]+/).filter((t) => t !== '');
}

/**
 * Does one written token name this item?
 *
 * `resolveId` (scripts/check-handover.ts) resolves a written token against the
 * WHOLE corpus, where a shortened id can be ambiguous. This asks the same
 * question from the other end — the id is known — so ambiguity cannot arise
 * and the rule is its two clauses and no more: exact, or a prefix of this id
 * ending at a segment boundary. A trailing hyphen is stripped for `resolveId`'s
 * stated reason: it is the signature of a line wrap breaking the id at its own
 * punctuation, and it is not a claim about anything.
 */
export function tokenNames(token: string, id: string): boolean {
  const probe = token.replace(/-+$/, '');
  return probe === id || id.startsWith(`${probe}-`);
}

/** One test file whose header declares a basis naming the item. */
export interface DeclaringTest {
  /** Repo-relative, POSIX. The file exists: it was read to find this. */
  file: string;
  /** The token exactly as written, which may be a shortened id. */
  wrote: string;
}

/** One test path an item's `scope` records, and what it resolves to on disk. */
export interface RecordedTestPath {
  /** The glob or literal path, exactly as the item records it. */
  named: string;
  /** The item whose `scope` records it. */
  from: string;
  /** How many files under the test trees it actually matches. */
  matches: number;
}

export interface RestingTests {
  /** Files read under `TEST_TREES`. Zero means NOT MEASURED, never "none". */
  walked: number;
  /** Whether `TEST_FILE_LIMIT` cut the walk short. */
  truncated: boolean;
  declaring: DeclaringTest[];
  recorded: RecordedTestPath[];
  /** The recorded paths that match no file at all — renamed, or deleted. */
  unresolved: RecordedTestPath[];
}

/** Every file under the test trees, repo-relative and POSIX, bounded and sorted. */
export function testTreeFiles(repoRoot: string, limit: number = TEST_FILE_LIMIT): {
  files: string[]; truncated: boolean;
} {
  const files: string[] = [];
  let truncated = false;
  const walk = (dir: string): void => {
    if (files.length >= limit) { truncated = true; return; }
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries.sort()) {
      if (entry === 'node_modules' || entry === '.git') continue;
      if (files.length >= limit) { truncated = true; return; }
      const full = path.join(dir, entry);
      let s;
      try {
        s = statSync(full);
      } catch {
        continue;
      }
      if (s.isDirectory()) walk(full);
      else files.push(path.relative(repoRoot, full).split(path.sep).join('/'));
    }
  };
  for (const tree of TEST_TREES) walk(path.join(repoRoot, tree));
  return { files: files.sort(), truncated };
}

/** A `scope` entry that points into a test tree, and is therefore a claim about a test. */
export function isTestScope(glob: string): boolean {
  return TEST_TREES.some((t) => glob === t || glob.startsWith(`${t}/`));
}

/**
 * **The answer, and its proof.**
 *
 * `id` is the item being retired. `sources` are the items whose `scope` may
 * carry the answer — the retiree and its replacement, which is §8's
 * no-new-field version of the question.
 *
 * Only `.ts` files are read for a declaration, because that is the only syntax
 * the marker can live in; **every** file under the trees is used to resolve a
 * recorded path, because a `scope` may legitimately name a fixture. Helpers are
 * read as well as gated test files: `scripts/check-basis.ts` gates
 * `*.test.ts`/`*.spec.ts` only, but six helpers in this tree declare a basis
 * anyway, and a helper that rests on the item being retired is exactly as
 * affected as a test that does.
 */
export function testsRestingOn(
  repoRoot: string,
  id: string,
  sources: ReadonlyArray<{ id: string; scope: readonly string[] }>,
): RestingTests {
  const { files, truncated } = testTreeFiles(repoRoot);
  const declaring: DeclaringTest[] = [];
  for (const file of files) {
    if (!file.endsWith('.ts')) continue;
    let text: string;
    try {
      text = readFileSync(path.join(repoRoot, ...file.split('/')), 'utf8');
    } catch {
      continue;
    }
    const tokens = basisTokens(text);
    if (tokens === null) continue;
    const wrote = tokens.find((t) => tokenNames(t, id));
    if (wrote !== undefined) declaring.push({ file, wrote });
  }

  const recorded: RecordedTestPath[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    for (const glob of source.scope) {
      if (!isTestScope(glob)) continue;
      // One key per (item, glob), built with `JSON.stringify` rather than by
      // joining on a separator: a glob may contain any punctuation, and
      // `scripts/check-text-files.ts` refuses the NUL that `pairKey` uses for
      // the same job — a literal NUL in a source file makes git treat it as
      // binary, with no diff, no review and an unresolvable merge conflict.
      const key = JSON.stringify([source.id, glob]);
      if (seen.has(key)) continue;
      seen.add(key);
      const re = globToRegExp(glob);
      recorded.push({
        named: glob, from: source.id, matches: files.filter((f) => re.test(f)).length,
      });
    }
  }
  return {
    walked: files.length,
    truncated,
    declaring,
    recorded,
    unresolved: recorded.filter((r) => r.matches === 0),
  };
}

/**
 * **The one-line form, for `mycontext supersede`'s preview — the moment before
 * the confirm, which is the cheapest moment there will ever be to abandon.**
 *
 * It is a COUNT and not the list, deliberately. The list arrives once, in
 * `supersedeItem`'s result message, where every other door into retirement also
 * gets it; printing the whole paragraph on both sides of one confirm is the same
 * defect as asking a person the same question twice, which is why
 * `mycontext supersede` does not set `ctx.confirm` either.
 */
export function restingTestsLine(found: RestingTests): string {
  if (found.walked === 0) return 'NOT MEASURED — no files under test/ or e2e/ were found';
  const parts = [
    `${found.declaring.length} test(s) declare a basis on it`,
    `${found.recorded.length} test path(s) recorded in scope`,
  ];
  if (found.unresolved.length > 0) {
    parts.push(`${found.unresolved.length} of those MATCH NO FILE — renamed or deleted`);
  }
  return parts.join(', ');
}

/**
 * **What a person is told, at the moment of superseding.**
 *
 * Every sentence here is load-bearing, and the last one is the one §8 asks to
 * be written into the implementation.
 *
 * `walked === 0` is answered as UNMEASURED rather than as "none": a project
 * with no `test/` or `e2e/` tree has not been searched, and reporting that as a
 * clean bill of health is the failure `STD-a-measured-zero-is-drawn-and-named`
 * names at the other end of the scale.
 */
export function restingTestsSaid(id: string, found: RestingTests): string {
  if (found.walked === 0) {
    return (
      `\n\nWhich tests rest on ${id}: NOT MEASURED — no files were found under ` +
      `${TEST_TREES.map((t) => `${t}/`).join(' or ')}, so nothing was searched. That is not the ` +
      `same as nothing resting on it.`
    );
  }
  const out: string[] = [];
  out.push(
    `\n\nWhich tests rest on ${id}, over ${found.walked} file(s) under ` +
    `${TEST_TREES.map((t) => `${t}/`).join(' and ')}${found.truncated
      ? ` (CUT SHORT at the ${TEST_FILE_LIMIT}-file ceiling — the list below is partial)` : ''}:`,
  );
  if (found.declaring.length === 0) {
    out.push(`  no test declares "@basis ${id}".`);
  } else {
    for (const d of found.declaring) out.push(`  declares @basis  ${d.file}`);
  }
  for (const r of found.recorded) {
    out.push(
      `  named in scope   ${r.named}  (${r.from}) -> ${r.matches === 0
        ? 'MATCHES NO FILE — renamed or deleted'
        : `${r.matches} file(s)`}`,
    );
  }
  if (found.unresolved.length > 0) {
    out.push(
      `  ${found.unresolved.length} recorded path(s) name a test that is not there. An answer ` +
      `that names a file which does not exist is worse than no answer, because it resolves for ` +
      `a reader who does not check it. Re-scope it to the path that replaced it.`,
    );
  }
  out.push(
    `  This is a FLOOR, and it can never be anything else: a declaration says what a test ` +
    `VERIFIES, never what it ASSUMES, and it was the assumed half that reddened 26 fixtures in ` +
    `cdc9fd8 without one of them naming a rule. "No tests named" is indistinguishable from "no ` +
    `tests affected", so this never gates and never fails a write — it is told to you here ` +
    `because this is the one moment somebody knows the answer.`,
  );
  return out.join('\n');
}
