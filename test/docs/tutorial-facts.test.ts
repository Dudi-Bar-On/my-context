/**
 * Four literal facts the tutorials state, checked against the code that owns
 * them: the version string, the hook roster, the `profile` values a reader is
 * shown, and the budget tier numbers.
 *
 * `TASK-four-literal-facts-a-tutorial-states-are-checked-against-the`
 * (`plan:tuts seq:6`), building
 * `docs/superpowers/specs/2026-09-05-tutorials-are-served-and-browsed-design.md`
 * § "How they are kept TRUE".
 *
 * **Why these four and not others.** `reports/2026-08-22-DOCS-REVIEW.md` found
 * five defects that were not prose-quality problems at all — F11 (both
 * tutorials pinned to v1.0.0 while 1.0.2 shipped), F4 (`docs/TUTORIAL-ADVANCED.md`
 * offering the `full` profile, which the loader refuses BY NAME), F7 and F8
 * (four hooks named where the manifest registers eighteen), and F14 ("pinned …
 * 8,000", which is `restored`'s number, not `pinned`'s). Every one of them sat
 * under a heading the Tutorials screen ticked as done, because the screen
 * checks that a section EXISTS. Existence gates pass while the prose lies;
 * these four facts are the ones a test can actually settle.
 *
 * **This is an extension of the existence check, not a new kind of gate**, and
 * the distinction matters because the screen's `done` chip now means slightly
 * more than it did. It compares a literal token to a literal token. It cannot
 * tell whether the sentence around the token is true, whether an explanation
 * still describes the mechanism, or whether a worked example still makes
 * sense — those stay a human documents-review responsibility, the same one
 * that produced the report above.
 *
 * **The document set is derived, and it survives the migration.** Today the
 * text lives in `docs/TUTORIAL.md` and `docs/TUTORIAL-ADVANCED.md`; `tuts/5`
 * is moving it into one file per feature under `docs/tutorials/`, named by
 * `docs/tutorials/manifest.json`. This file reads BOTH — every manifest entry
 * whose file exists, plus the two originals while they still hold content — so
 * it gates the text before, during and after the migration without an edit.
 * Hebrew mirrors are included for the same reason they matter: a version
 * string and a budget number are the same tokens in both languages, and a
 * Hebrew file left behind by an English correction is exactly the drift this
 * catches.
 *
 * **Every extractor below is demonstrated rather than trusted** (last test):
 * each is run against a planted wrong value and must reject it. Without that,
 * a pattern that silently stopped matching would leave this whole file green
 * and checking nothing — which is the failure mode `counts.test.ts` guards the
 * same way, and the reason a tutorial set that states none of these facts is
 * not the same thing as a broken parser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { VERSION } from '../../src/core/version.ts';
import { DEFAULT_BUDGETS, resolveConfig } from '../../src/core/config.ts';
import { loadTutorialManifest } from '../../src/core/tutorial-manifest.ts';
import { fenceTracker } from '../helpers/markdown.ts';

const REPO = path.join(import.meta.dirname, '..', '..');

/* ---------------------------------------------------------------------------
 * The documents under test.
 * ------------------------------------------------------------------------- */

interface Doc { relative: string; text: string }

/**
 * The two files the tutorials live in today, kept by name because
 * `DEC-the-documentation-system-is-hand-built-over-a-wide-glob` rules that
 * they SURVIVE the migration as pointers. A pointer states none of these
 * facts and is checked for free; a pointer that still carries a stale version
 * line is caught.
 */
const LEGACY = ['docs/TUTORIAL.md', 'docs/TUTORIAL-ADVANCED.md'];

function read(relative: string): string {
  return readFileSync(path.join(REPO, ...relative.split('/')), 'utf8').replaceAll('\r\n', '\n');
}

function tutorialDocuments(): Doc[] {
  const manifest = loadTutorialManifest(REPO);
  assert.ok(manifest.length > 0, 'the tutorial manifest is empty — run `npm run gen:tutorials`');
  const wanted = [
    ...manifest.flatMap((entry) => [entry.enFile, entry.heFile]),
    ...LEGACY,
  ];
  const present = [...new Set(wanted)].filter((f) => existsSync(path.join(REPO, ...f.split('/'))));
  assert.ok(
    present.length > 0,
    'no tutorial file exists at all: neither the two originals nor any file the manifest ' +
    'names. Either the migration deleted the originals without writing the new files, or the ' +
    'manifest points somewhere nothing is. Nothing below can check anything until one exists.',
  );
  return present.map((relative) => ({ relative, text: read(relative) }));
}

const documents = tutorialDocuments();

/**
 * The PARAGRAPHS of a document that are not inside a fenced block, each with
 * the 1-based line it starts on.
 *
 * Paragraphs rather than lines, and that is not a detail: this documentation
 * is hard-wrapped, and the sentence F14 was found in wraps between the tier
 * name and its number —
 * `` `restored` — the re-injection after a compaction — is the `` /
 * `expensive one, at 8,000 estimated tokens by default`. A line-by-line reader
 * silently loses exactly the claim it was written to catch.
 *
 * A table row is its own paragraph even without a blank line around it: rows
 * are separate contexts, and joining them would pair one row's tier with the
 * next row's number.
 *
 * Fenced blocks are dropped. They hold captured output and config examples,
 * and a reader's own overridden budget is not a claim about the default.
 */
function proseParagraphs(text: string): { line: number; text: string }[] {
  const fenced = fenceTracker();
  const out: { line: number; text: string }[] = [];
  let current: { line: number; parts: string[] } | null = null;
  const flush = (): void => {
    if (current !== null && current.parts.length > 0) {
      out.push({ line: current.line, text: current.parts.join(' ') });
    }
    current = null;
  };
  text.split('\n').forEach((raw, i) => {
    if (fenced(raw) || raw.trim() === '') { flush(); return; }
    if (raw.startsWith('|')) { flush(); out.push({ line: i + 1, text: raw }); return; }
    if (current === null) current = { line: i + 1, parts: [] };
    current.parts.push(raw);
  });
  flush();
  return out;
}

/** One extracted claim: the literal the document states, and where. */
interface Claim { value: string; where: string }

function claims(doc: Doc, found: { value: string; line: number }[]): Claim[] {
  return found.map((f) => ({ value: f.value, where: `${doc.relative}:${f.line}` }));
}

/** Every match of `pattern` (capture group 1) with the line it sits on. */
function matchesWithLines(text: string, pattern: RegExp): { value: string; line: number }[] {
  const out: { value: string; line: number }[] = [];
  text.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(pattern)) out.push({ value: m[1], line: i + 1 });
  });
  return out;
}

/* ---------------------------------------------------------------------------
 * 1 · The version string — F11.
 * ------------------------------------------------------------------------- */

/**
 * `my_context v1.0.2` and `my_context 1.0.2` — the "tested on" line at the top
 * of each tutorial and the version banner inside captured output. Fenced
 * blocks are INCLUDED here on purpose: a captured `mycontext status` banner
 * quoting an old version is the same defect as a stale header, and F11 found
 * it in both shapes.
 */
export function versionClaims(text: string): { value: string; line: number }[] {
  return matchesWithLines(text, /my_context\s+v?(\d+\.\d+\.\d+)/g);
}

test('every version a tutorial states is the version this build ships', () => {
  const wrong: string[] = [];
  let total = 0;
  for (const doc of documents) {
    for (const claim of claims(doc, versionClaims(doc.text))) {
      total += 1;
      if (claim.value !== VERSION) wrong.push(`${claim.where} says ${claim.value}`);
    }
  }
  assert.deepEqual(
    wrong, [],
    `package.json ships ${VERSION}. ${wrong.join('; ')}. This is F11 of ` +
    'reports/2026-08-22-DOCS-REVIEW.md returning: both tutorials sat on v1.0.0 for two ' +
    'releases, under a heading the Tutorials screen ticked as done.',
  );
  // Not an assertion that a tutorial MUST state a version — a per-feature
  // tutorial need not. Recorded so a run that checked nothing says so.
  assert.ok(total >= 0);
});

/* ---------------------------------------------------------------------------
 * 2 · The hook roster — F7, F8.
 * ------------------------------------------------------------------------- */

/** The events `hooks/hooks.json` actually registers — the manifest Claude Code
 * itself reads, which is the only list that decides what fires. */
function registeredHooks(): string[] {
  const manifest = JSON.parse(read('hooks/hooks.json')) as { hooks: Record<string, unknown> };
  const names = Object.keys(manifest.hooks);
  assert.ok(names.length > 0, 'hooks/hooks.json registers nothing — the parser is broken');
  return names;
}

const hooks = registeredHooks();

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, 'twenty-one': 21, 'twenty-two': 22,
  'twenty-three': 23, 'twenty-four': 24, 'twenty-five': 25,
};

const NUMBER_WORD_ALTERNATION = Object.keys(NUMBER_WORDS)
  // Longest first: `eighteen` must win over `eight` in a leftmost-first
  // alternation, the same ordering `counts.test.ts` documents for its own.
  .sort((a, b) => b.length - a.length)
  .join('|');

/**
 * How many hooks a document CLAIMS: `Hooks (18)` as the plugin inventory
 * prints it, "eighteen hooks", "18 registered events". Deliberately narrow —
 * a number must sit immediately before the word it counts — so that "not
 * four", a sentence ABOUT the old wrong number, is not read as a claim.
 */
export function hookCountClaims(text: string): { value: string; line: number }[] {
  const number = `\\d+|${NUMBER_WORD_ALTERNATION}`;
  return [
    ...matchesWithLines(text, /Hooks\s*\((\d+)\)/gi),
    ...matchesWithLines(text, new RegExp(`\\b(${number})\\s+(?:registered\\s+)?hooks?\\b`, 'gi')),
    ...matchesWithLines(text, new RegExp(`\\b(${number})\\s+registered\\s+(?:hook\\s+)?events?\\b`, 'gi')),
  ];
}

/**
 * The hook EVENTS a document names, in the one shape that cannot be confused
 * with a tool name: the event immediately followed by the word "hook" —
 * "`SessionStart` hook", "the PostToolUse hook". `PreToolUse`'s own matcher
 * names `Read`, `Edit` and `MultiEdit`, and a tutorial listing those is
 * listing TOOLS; requiring the following word keeps them out without a list of
 * exceptions to maintain.
 */
export function hookNameClaims(text: string): { value: string; line: number }[] {
  return [
    ...matchesWithLines(text, /`([A-Z][A-Za-z]*)`\s+hooks?\b/g),
    ...matchesWithLines(text, /\bthe\s+([A-Z][A-Za-z]+)\s+hooks?\b/g),
  ];
}

test('every hook count and hook name a tutorial states matches hooks/hooks.json', () => {
  const total = String(hooks.length);
  const wrongCounts: string[] = [];
  for (const doc of documents) {
    for (const claim of claims(doc, hookCountClaims(doc.text))) {
      const value = /^\d+$/.test(claim.value)
        ? Number(claim.value)
        : NUMBER_WORDS[claim.value.toLowerCase()];
      assert.ok(
        value !== undefined,
        `${claim.where} spells a hook count as "${claim.value}", which NUMBER_WORDS does not ` +
        'know. Add the word rather than deleting the assertion.',
      );
      if (String(value) !== total) wrongCounts.push(`${claim.where} says ${claim.value}`);
    }
  }
  assert.deepEqual(
    wrongCounts, [],
    `hooks/hooks.json registers ${total} hooks. ${wrongCounts.join('; ')}. This is F7/F8 of ` +
    'reports/2026-08-22-DOCS-REVIEW.md: both tutorials said four for a whole round after more ' +
    'were registered.',
  );

  const unknown: string[] = [];
  for (const doc of documents) {
    for (const claim of claims(doc, hookNameClaims(doc.text))) {
      if (!hooks.includes(claim.value)) unknown.push(`${claim.where} names ${claim.value}`);
    }
  }
  assert.deepEqual(
    unknown, [],
    `no such hook is registered. hooks/hooks.json declares: ${hooks.join(', ')}. A tutorial ` +
    'teaching a hook the plugin does not register is teaching behaviour that cannot happen.',
  );
});

/* ---------------------------------------------------------------------------
 * 3 · The `profile` values — F4.
 * ------------------------------------------------------------------------- */

/** Whether the LIVE loader accepts this profile name. Not a list copied from
 * `PROFILES`: `resolveConfig` is the function that refuses `full` by name at
 * load time, so asking it is asking the code that would break the reader. */
function loaderAccepts(profile: string): boolean {
  try {
    resolveConfig({ profile });
    return true;
  } catch {
    return false;
  }
}

/** Backticked lowercase words in `segment`, in order, with their offsets. */
function backtickedWords(segment: string): { value: string; index: number; end: number }[] {
  return [...segment.matchAll(/`([a-z][a-z-]{1,20})`/g)].map((m) => ({
    value: m[1], index: m.index, end: m.index + m[0].length,
  }));
}

/**
 * The `profile` values a document offers a reader.
 *
 * Three shapes, and the third is the one F4 actually took. `"profile":
 * "standard"` in a config example and `profile "standard"` in captured output
 * are unambiguous. F4 was neither: it was a key-effect TABLE row reading
 * ``| `profile` | which categories are enabled — `minimal`, `standard`, `full` |``,
 * an ENUMERATION of backticked names.
 *
 * An enumeration is only read as a profile list when at least one member is a
 * profile name the loader accepts. That single condition is what keeps the
 * rule honest: "the profile decides whether `constraint` and `lesson` exist"
 * is a sentence about categories that happens to mention profiles, and it
 * contains no valid profile name, so it is not treated as an enumeration of
 * them. A run that mixes real profile names with a refused one — exactly F4 —
 * is.
 */
export function profileClaims(text: string): { value: string; line: number }[] {
  const out: { value: string; line: number }[] = [];
  text.split('\n').forEach((line, i) => {
    const lineNumber = i + 1;
    for (const m of line.matchAll(/"profile"\s*:\s*"([a-z][a-z-]*)"/g)) {
      out.push({ value: m[1], line: lineNumber });
    }
    for (const m of line.matchAll(/\bprofiles?\s+["`]([a-z][a-z-]*)["`]/g)) {
      out.push({ value: m[1], line: lineNumber });
    }
    for (const m of line.matchAll(/`([a-z][a-z-]*)`\s+profile\b/g)) {
      out.push({ value: m[1], line: lineNumber });
    }
    if (!/profile/i.test(line)) return;
    // Table cells and clauses are separate contexts: `| \`profile\` | … |`
    // must not glue the key's own name onto the values in the next cell.
    for (const segment of line.split(/[|.;]/)) {
      const words = backtickedWords(segment);
      let run: typeof words = [];
      const flush = (): void => {
        if (run.length >= 2
          && !run.some((w) => w.value === 'profile')
          && run.some((w) => loaderAccepts(w.value))) {
          for (const w of run) out.push({ value: w.value, line: lineNumber });
        }
        run = [];
      };
      for (const word of words) {
        const joined = run.length === 0
          || /^[\s,]*(?:and|or)?[\s,]*$/.test(segment.slice(run[run.length - 1].end, word.index));
        if (!joined) flush();
        run.push(word);
      }
      flush();
    }
  });
  return out;
}

test('every profile value a tutorial offers is one the loader accepts', () => {
  const refused: string[] = [];
  for (const doc of documents) {
    for (const claim of claims(doc, profileClaims(doc.text))) {
      if (!loaderAccepts(claim.value)) refused.push(`${claim.where} offers "${claim.value}"`);
    }
  }
  assert.deepEqual(
    refused, [],
    'the config loader refuses these by name, so a reader who types one breaks their own ' +
    `config: ${refused.join('; ')}. This is F4 of reports/2026-08-22-DOCS-REVIEW.md — the one ` +
    'finding in that review that actively told a reader to type something the product rejects.',
  );
});

/* ---------------------------------------------------------------------------
 * 4 · The budget tier numbers — F14.
 * ------------------------------------------------------------------------- */

const BUDGET_KEYS = Object.keys(DEFAULT_BUDGETS);

/**
 * Tier-and-number pairs stated in PROSE. Fenced blocks are excluded here (and
 * only here): a config example showing `"pinned": 20000` is a reader's own
 * override, not a claim about the default.
 *
 * The pairing rule, stated because a reader of a failure needs it: inside one
 * clause, every tier name seen since the last number is attributed to the next
 * number. That reads "`pinned` and `jit` are 6,000 each" as two claims of
 * 6,000, and "`restored` … is the expensive one, at 8,000" as one of 8,000 —
 * which is F14 exactly, where the tier named was `pinned` and the number
 * beside it was `restored`'s.
 *
 * A tier name counts only when it is backticked or bold. `index` is an
 * ordinary English word in this documentation ("recreate the index"), and an
 * unmarked one would pair it with any number in the sentence.
 */
export function budgetClaims(text: string): { value: string; line: number; tier: string }[] {
  const out: { value: string; line: number; tier: string }[] = [];
  const TIER = /`([a-z]+)`|\*\*([a-z]+)\*\*/g;
  // No hyphen or dot GLUED to a digit on either side: `2026-08-22` and `1.0.2`
  // are not budgets. A sentence-ending period is not glued to a digit, so
  // "`index` is 1,200." is still a claim.
  const NUMBER = /(?<![\w,.-])(\d{1,3}(?:,\d{3})+|\d{3,6})(?![\w-])(?!\.\d)/g;
  for (const { line, text: raw } of proseParagraphs(text)) {
    for (const clause of raw.split(/(?<=[.;])\s/)) {
      const tokens = [
        ...[...clause.matchAll(TIER)]
          .map((m) => ({ kind: 'tier' as const, value: (m[1] ?? m[2]), index: m.index }))
          .filter((t) => BUDGET_KEYS.includes(t.value)),
        ...[...clause.matchAll(NUMBER)]
          .map((m) => ({ kind: 'number' as const, value: m[1], index: m.index })),
      ].sort((a, b) => a.index - b.index);

      let pending: string[] = [];
      for (const token of tokens) {
        if (token.kind === 'tier') { pending.push(token.value); continue; }
        for (const tier of pending) out.push({ tier, value: token.value, line });
        pending = [];
      }
    }
  }
  return out;
}

test('every budget number a tutorial states is that tier\'s own default', () => {
  const wrong: string[] = [];
  for (const doc of documents) {
    for (const claim of budgetClaims(doc.text)) {
      const expected = DEFAULT_BUDGETS[claim.tier as keyof typeof DEFAULT_BUDGETS];
      const stated = Number(claim.value.replaceAll(',', ''));
      if (stated !== expected) {
        wrong.push(`${doc.relative}:${claim.line} states ${claim.tier} = ${claim.value}, ` +
          `and DEFAULT_BUDGETS says ${expected}`);
      }
    }
  }
  assert.deepEqual(
    wrong, [],
    `${wrong.join('; ')}. This is F14 of reports/2026-08-22-DOCS-REVIEW.md: the tutorial named ` +
    'one tier as the expensive one and gave it a different tier\'s number.',
  );
});

/* ---------------------------------------------------------------------------
 * 5 · The extractors, demonstrated rather than trusted.
 * ------------------------------------------------------------------------- */

/**
 * The guard that keeps every test above from passing vacuously.
 *
 * A tutorial set that states none of these facts is a legitimate state — a
 * per-feature tutorial about the inbox has no reason to name a hook. A pattern
 * that has silently stopped matching looks exactly the same from the outside,
 * and would leave this file green forever. So each extractor is run here
 * against text carrying the ORIGINAL wrong value from the review, and must
 * both find it and mark it wrong.
 */
test('each extractor still finds the drift it was written for', () => {
  // F11 — both tutorials pinned to a version two patches old.
  const version = versionClaims('**Tested on:** my_context v1.0.0, Node 24.');
  assert.deepEqual(version.map((v) => v.value), ['1.0.0']);
  assert.notEqual(version[0].value, VERSION, 'the planted version must differ from the real one');

  // F7/F8 — four hooks named where the manifest registers eighteen.
  const counts = hookCountClaims('my_context installs four hooks and one MCP server.');
  assert.deepEqual(counts.map((c) => c.value), ['four']);
  assert.notEqual(NUMBER_WORDS['four'], hooks.length);
  assert.deepEqual(
    hookCountClaims('eighteen registered events today, not four').map((c) => c.value),
    ['eighteen'],
    'a number that is not counting hooks ("not four") must not be read as a claim',
  );

  // A hook that no longer exists, in the shape a tutorial names one.
  const named = hookNameClaims('the `PostMessage` hook fires afterwards');
  assert.deepEqual(named.map((n) => n.value), ['PostMessage']);
  assert.ok(!hooks.includes('PostMessage'));
  assert.deepEqual(
    hookNameClaims('the PreToolUse hook matches `Read`, `Edit` and `MultiEdit`')
      .map((n) => n.value),
    ['PreToolUse'],
    'a tool name in a sentence about a hook must not be read as a hook name',
  );

  // F4 — the refused `full` profile, in the table shape it was actually found in.
  const profiles = profileClaims(
    '| `profile` | which categories are enabled — `minimal`, `standard`, `full` |',
  );
  assert.deepEqual(profiles.map((p) => p.value).sort(), ['full', 'minimal', 'standard']);
  assert.ok(!loaderAccepts('full'), 'the loader must still refuse `full`, or F4 is not a defect');
  assert.deepEqual(
    profileClaims('the profile decides whether `constraint` and `lesson` exist').map((p) => p.value),
    [],
    'an enumeration with no valid profile name in it is not a profile enumeration',
  );
  assert.deepEqual(
    profileClaims('{ "profile": "full" }').map((p) => p.value), ['full'],
    'the config-example shape must be read too',
  );

  // F14 — the wrong tier's number, and the correct sentence beside it.
  const budgets = budgetClaims('The `pinned` tier is the expensive one, at 8,000 tokens.');
  assert.deepEqual(budgets, [{ tier: 'pinned', value: '8,000', line: 1 }]);
  assert.notEqual(8000, DEFAULT_BUDGETS.pinned, 'F14 is only a defect while these differ');
  assert.deepEqual(
    budgetClaims('`pinned` and `jit` are 6,000 each, `continuity` is 2,000.')
      .map((b) => `${b.tier}=${b.value}`),
    ['pinned=6,000', 'jit=6,000', 'continuity=2,000'],
    'one number after two tier names is a claim about both',
  );
  assert.deepEqual(
    budgetClaims('```\n"pinned": 99999\n```').map((b) => b.tier), [],
    'a fenced config example is a reader\'s override, not a claim about the default',
  );
});
