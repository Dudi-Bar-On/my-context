/**
 * The surface counts both READMEs state in prose, derived from the running
 * program rather than from a maintainer's memory.
 *
 * Why this file exists: these numbers have now drifted twice, in the same two
 * places each time. The mermaid diagram's "26 CLI commands" node was written
 * for 21 and stayed at 21 across two commands being added; the "N of the M CLI
 * commands have no slash command" line was a task behind on both sides of the
 * ratio. Neither is caught by anything — `test/docs/inventory.test.ts` checks
 * that every command is NAMED, which a wrong total satisfies perfectly, and
 * `test/docs/parity.test.ts` compares structure, which a number is not.
 *
 * Each was corrected by hand and went stale again, so the third correction is
 * a test instead. Every expected value here is computed: the CLI total from
 * the usage banner the program prints, the slash totals from the files in
 * `commands/`, and the no-slash-command list by subtracting one from the
 * other. Nothing below is a literal that a change to the surface leaves
 * standing.
 *
 * What this does NOT check: the prose around the number. A sentence can carry
 * the right total and describe the wrong thing, and no test here would notice.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { TOOL_NAMES } from '../../src/mcp/tools.ts';
import { CATEGORIES, PROFILES } from '../../src/core/categories.ts';
import { COMMANDS } from '../../src/cli/commands/registry.ts';
import { NAMED_ENTRY_POINTS } from '../../src/cli/commands/edit.ts';
import { SUBCOMMANDS } from '../../src/cli/commands/review.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO = path.join(import.meta.dirname, '..', '..');

const DOCUMENTS = ['README.md', path.join('docs', 'README.he.md')];
const documents = DOCUMENTS.map((relative) => ({
  relative,
  text: readFileSync(path.join(REPO, relative), 'utf8').replaceAll('\r\n', '\n'),
}));

/**
 * The CLI's whole command surface, read out of the usage banner for the reason
 * `inventory.test.ts` documents at length: the registry omits the seven names
 * dispatched by the hardcoded `switch`, and the banner is the one place both
 * halves are already joined.
 */
function cliCommandNames(): string[] {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-counts-'));
  try {
    const lines: string[] = [];
    runCli(['help'], dir, (s) => lines.push(s));
    const banner = lines.join('\n');
    const names = [...banner.matchAll(/^ {2}([a-z][a-z-]*)(?= |$)/gm)].map((m) => m[1]);
    assert.ok(names.length > 0, `could not parse the usage banner:\n${banner}`);
    return [...new Set(names)];
  } finally {
    removeTree(dir);
  }
}

const cliNames = cliCommandNames();
const slashNames = readdirSync(path.join(REPO, 'commands'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => f.replace(/\.md$/, ''));

/**
 * Asserts every document contains `phrase`, and — the half that makes this
 * test worth having — that it contains no OTHER number in the same sentence
 * shape. Without the second check, changing "26 CLI commands" to "26 CLI
 * commands" while a second, stale "21 CLI commands" survived elsewhere would
 * pass.
 */
function assertStated(pattern: RegExp, expected: string, what: string): void {
  for (const doc of documents) {
    const found = [...doc.text.matchAll(pattern)].map((m) => m[1]);
    assert.ok(
      found.length > 0,
      `${doc.relative} no longer states ${what} in the expected shape (/${pattern.source}/). ` +
      `If the wording changed, update this pattern; do not delete the assertion.`,
    );
    const wrong = found.filter((n) => n !== expected);
    assert.deepEqual(
      wrong, [],
      `${doc.relative} states ${what} as ${wrong.join(', ')}; the program says ${expected}. ` +
      `Every occurrence must agree — this number has drifted twice already.`,
    );
  }
}

test('both documents state the real number of CLI commands', () => {
  const total = String(cliNames.length);
  // Two shapes, and the first is the one that stayed at 21 while two commands
  // were added: the mermaid node in §5's surface diagram.
  assertStated(/<br\/>(\d+) (?:CLI commands|פקודות שורת פקודה)"/g,
    total, 'the CLI command count in the surface diagram');
  assertStated(/^(\d+) (?:commands|פקודות)\. `mycontext help`/gm,
    total, 'the CLI command count above the command tables');
});

test('both documents state the real number of slash commands', () => {
  assertStated(/<br\/>(\d+) (?:slash commands|פקודות סלאש)"/g,
    String(slashNames.length), 'the slash command count in the surface diagram');
});

/**
 * §8's "how to tell whether something here has shipped" paragraph tells a
 * reader which tests hold this documentation to the program, and it is the one
 * paragraph in the document a reader consults *because* they have stopped
 * trusting the prose. It was wrong for two releases — it said "no test checks
 * this section" while two do, and put the size of the documentation suite at
 * two files when there were nine — so the number it states is computed here
 * rather than typed there, exactly like the ratio above.
 *
 * Counted as FILES, not as tests. A test total would need this suite to run
 * itself to learn it, and the file count is the number that answers the
 * reader's actual question — how much of this document is machine-checked.
 *
 * `import.meta.dirname` is the directory this file lives in, so the count
 * includes this file and cannot fall out of step with the directory it
 * describes.
 */
test('both documents state the real number of documentation test files', () => {
  const files = readdirSync(import.meta.dirname).filter((f) => f.endsWith('.test.ts'));
  assert.ok(files.length > 1, 'the documentation test directory did not read back — the parser is broken');
  // Both spellings in one pattern for the same reason the ratio test uses one:
  // a per-language pattern that stops matching passes silently in that language.
  assertStated(
    /\*\*(\d+) (?:test files under|קובצי בדיקה תחת)/g,
    String(files.length),
    "the number of documentation test files in section 8's verification paragraph",
  );
});

/**
 * The MCP tool total, which drifted the same way and was not caught.
 *
 * Both documents said "eleven MCP tools" in three places each — the surface
 * diagram, the sentence introducing the two surfaces, and the glossary — from
 * before `refresh_item` landed in Phase 3 until Phase 4 found it. That is the
 * same defect as the two counts above, in the same paragraph, missed because
 * the test that computes the other numbers did not compute this one.
 *
 * The number is written as a WORD in prose and as digits in the diagram, so
 * both spellings are checked; `NUMBER_WORDS` covers the range a tool list
 * plausibly occupies, and the assertion fails loudly rather than silently
 * skipping if it ever leaves that range.
 */
const NUMBER_WORDS: Record<number, { en: string; he: string }> = {
  10: { en: 'ten', he: 'עשרה' },
  11: { en: 'eleven', he: 'אחד-עשר' },
  12: { en: 'twelve', he: 'שנים-עשר' },
  13: { en: 'thirteen', he: 'שלושה-עשר' },
  14: { en: 'fourteen', he: 'ארבעה-עשר' },
};

test('both documents state the real number of MCP tools', () => {
  const total = TOOL_NAMES.length;
  const words = NUMBER_WORDS[total];
  assert.ok(
    words,
    `the tool list is now ${total} long, which NUMBER_WORDS does not spell. Add it rather ` +
    `than deleting this test — the whole point is that this number goes stale unwatched.`,
  );
  // Matched in the three SENTENCES that carry the number rather than as a bare
  // word. A bare-word scan cannot work here: `\b` is defined on `\w`, which no
  // Hebrew letter is, so `/עשרה\b/` neither anchors nor fails cleanly — and
  // `תשע-עשרה` ("nineteen", which the argument-hint paragraph uses twice)
  // contains the spelling for ten. The number word is captured in place, and
  // every occurrence in a document has to agree with the program.
  const PATTERNS = [
    /<br\/>([\p{L}-]+), (?:served over stdio|מוגשים מעל stdio)"/gu,
    /(?:calls the |קורא ל)([\p{L}-]+) (?:MCP tools|כלי ה-MCP)/gu,
    /(?:serves|מגיש) ([\p{L}-]+) (?:of them over stdio|מהם מעל stdio)/gu,
    // §8's parity sentence — "Every one of the … MCP tools has a CLI command,
    // a slash command, or both". It said "twelve" in English and "thirteen" in
    // Hebrew at the same time as the three sentences above said "fourteen",
    // which is this defect at its purest: the same fact, four sentences, three
    // values, and only the sentences a pattern watched were right.
    /(?:Every one of the |לכל אחד מ)([\p{L}-]+) (?:MCP tools|כלי\s)/gu,
  ];
  for (const doc of documents) {
    const expected = doc.relative === 'README.md' ? words.en : words.he;
    let found = 0;
    for (const pattern of PATTERNS) {
      for (const [, word] of doc.text.matchAll(pattern)) {
        found++;
        assert.equal(
          word, expected,
          `${doc.relative} states the MCP tool count as "${word}"; the program serves ` +
          `${total} ("${expected}"). This number was "eleven" in three places for a whole ` +
          `phase after refresh_item landed.`,
        );
      }
    }
    assert.equal(
      found, PATTERNS.length,
      `${doc.relative} carries ${found} of the ${PATTERNS.length} sentences that state the ` +
      `MCP tool count. If the wording changed, update the patterns; do not delete them.`,
    );
  }
});

/**
 * Whether `name` has a slash surface.
 *
 * Exact match is not the whole rule, and getting this wrong is how a naive
 * version of this test would have "corrected" a number that was already right.
 * There is no `/mycontext:add` — the closed category set is spelled out in the
 * command NAMES (`add-rule`, `list-rule`, …), which is why they are generated
 * per category rather than taking a `<type>` argument. So `add` and `list` do
 * have a slash surface, reached under a longer name, exactly as §8 says.
 */
function hasSlashCommand(name: string): boolean {
  return slashNames.some((slash) => slash === name || slash.startsWith(`${name}-`));
}

/**
 * The ratio in §8, both halves of it. This is the line that was a task behind
 * on the numerator AND the denominator at the same time, which is exactly what
 * a hand-maintained count does when two commands land in one round.
 */
test('both documents state how many CLI commands have no slash command', () => {
  const without = cliNames.filter((name) => !hasSlashCommand(name));
  assert.ok(without.length > 0 && without.length < cliNames.length,
    'the subtraction produced a degenerate answer — the parser is broken, not the document');

  // Anchored on the sentence, not on any "N of M" in the document: §5 and §8
  // carry two other ratios (MCP tools with no slash command, and the
  // argument-hint defect), and a loose pattern reads those as disagreements.
  const RATIO = /(\d+) of the (\d+) CLI commands|ל-(\d+) מתוך (\d+) פקודות שורת הפקודה/g;
  for (const doc of documents) {
    const matches = [...doc.text.matchAll(RATIO)];
    assert.ok(matches.length > 0, `${doc.relative} no longer carries the "N of M" ratio`);
    const stated = matches.map((m) => `${m[1] ?? m[3]}/${m[2] ?? m[4]}`);
    assert.deepEqual(
      [...new Set(stated)], [`${without.length}/${cliNames.length}`],
      `${doc.relative} states the no-slash-command ratio as ${stated.join(', ')}; the ` +
      `program says ${without.length} of ${cliNames.length}.`,
    );
  }

  // The list beside the ratio must be the same set, not merely the same size:
  // a count that agrees while the enumeration omits a command is the failure
  // a reader actually trips over, since the list is what they read.
  const english = documents[0].text;
  const missing = without.filter((name) => !new RegExp(`\`${name}\``).test(english));
  assert.deepEqual(
    missing, [],
    `README.md's list of commands with no slash command omits: ${missing.join(', ')}`,
  );
});

/**
 * The category counts, which drifted the same way when `reference` landed as
 * the 21st: §6's profile line still said `standard` was "all 20", both
 * documents' framing of the folded `help categories` headings still said "23
 * entries" where the command emits 24 headings, and the Hebrew "fixed list of
 * twenty nouns" sentence lagged the English "twenty-one". Every value below
 * comes from the catalogue, so the 22nd category cannot repeat this.
 */
test('both documents state the real category and profile counts', () => {
  const total = String(Object.keys(CATEGORIES).length);
  assertStated(/`minimal` \((\d+) (?:categories|קטגוריות)\)/g,
    String(PROFILES.minimal.length), "the `minimal` profile's size");
  assertStated(/`standard` \((?:all |כל ה-)(\d+),/g,
    total, "the `standard` profile's size in §6's profile line");
  assertStated(/(?:table of the|הטבלה של) (\d+) (?:categories|הקטגוריות)/g,
    total, 'the row count of the generated category table');
  assertStated(/(?:catalogue holds|הקטלוג מחזיק) \*\*(\d+)\*\*/g,
    total, 'the catalogue size in the two-profiles section');
  assertStated(/(?:enables all|מפעיל את כל) \*\*(\d+)\*\*/g,
    total, "the count of categories `standard` enables");
});

/**
 * The same catalogue size where prose spells it as a WORD — the `examples`
 * section's "twenty-one specimens" and §6's "not a fixed list of twenty-one
 * nouns". The Hebrew nouns sentence said "twenty" while the English said
 * "twenty-one", which no structural test can see; same shape as the MCP-tool
 * word test above, same fix.
 */
const CATEGORY_WORDS: Record<number, { en: string; he: string }> = {
  19: { en: 'nineteen', he: 'תשע-עשרה' },
  20: { en: 'twenty', he: 'עשרים' },
  21: { en: 'twenty-one', he: 'עשרים ואחד' },
  22: { en: 'twenty-two', he: 'עשרים ושניים' },
  23: { en: 'twenty-three', he: 'עשרים ושלושה' },
  24: { en: 'twenty-four', he: 'עשרים וארבעה' },
};

test('both documents spell the catalogue size correctly where it is a word', () => {
  const total = Object.keys(CATEGORIES).length;
  const words = CATEGORY_WORDS[total];
  assert.ok(
    words,
    `the catalogue is now ${total} categories, which CATEGORY_WORDS does not spell. Add it ` +
    `rather than deleting this test — this number has drifted three times already.`,
  );
  const WORD = '[\\p{L}]+(?:[- ]ו?[\\p{L}]+)?';
  const PATTERNS = [
    new RegExp(`(?:catalogue — |שבקטלוג — )(${WORD}) (?:specimens|פריטים לדוגמה)`, 'gu'),
    new RegExp(`(?:fixed list of|רשימה קבועה של) (${WORD}) (?:nouns|שמות עצם)`, 'gu'),
  ];
  for (const doc of documents) {
    const expected = doc.relative === 'README.md' ? words.en : words.he;
    let found = 0;
    for (const pattern of PATTERNS) {
      for (const [, word] of doc.text.matchAll(pattern)) {
        found++;
        assert.equal(
          word, expected,
          `${doc.relative} spells the catalogue size as "${word}"; the catalogue holds ` +
          `${total} ("${expected}").`,
        );
      }
    }
    assert.equal(
      found, PATTERNS.length,
      `${doc.relative} carries ${found} of the ${PATTERNS.length} sentences that spell the ` +
      `catalogue size. If the wording changed, update the patterns; do not delete them.`,
    );
  }
});

/**
 * How many outline entries the folded `help categories` headings would add.
 *
 * Both documents explain that the block's headings are folded to bold because,
 * kept as headings, they "would put N entries into this document's outline".
 * N is the number of headings the command actually prints, and it moved from
 * 23 to 24 when `reference` landed while both documents kept saying 23. The
 * Hebrew output has the same heading structure by construction —
 * `test/help/categories-he.test.ts` fails the suite if the two sources'
 * heading sequences diverge — so one count serves both documents.
 */
test('both documents state how many headings the categories block folds away', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-counts-'));
  let headings: number;
  try {
    const lines: string[] = [];
    runCli(['help', 'categories'], dir, (s) => lines.push(s));
    headings = lines.join('\n').split('\n').filter((l) => /^#{1,6} /.test(l)).length;
  } finally {
    removeTree(dir);
  }
  assert.ok(headings > 0, 'help categories printed no headings — the parser is broken');
  assertStated(/(?:would put|היו מוסיפות) (\d+)\s+(?:entries|ערכים)/g,
    String(headings), 'the outline-entry count of the folded categories block');
});

/**
 * §5's breakdown of the slash-command surface: "one `add-<type>` and one
 * `list-<type>` per enabled category — N today — plus the M that are not
 * per-category: …. All K of those carry `disable-model-invocation: true`."
 *
 * Every number in that paragraph was stale at once, and so was the list: both
 * documents said 21 non-per-category commands and "All 63" while `commands/`
 * held 23 and 65, because `audit` and `focus` landed without either sentence
 * moving — and without their names entering the enumeration beside the count.
 * The list is checked as a SET, not a size, for the reason the no-slash-command
 * test gives: the enumeration is what a reader actually reads.
 */
test('both documents state the real slash-command breakdown', () => {
  const perCategory = slashNames.filter((n) => /^(add|list)-/.test(n));
  const others = slashNames
    .filter((n) => !/^(add|list)-/.test(n) && n !== 'LoadMyContext')
    .sort();
  assert.ok(others.length > 0 && perCategory.length > 0,
    'the commands/ directory did not partition — the parser is broken, not the document');
  // One add- and one list- per enabled category is the paragraph's own claim;
  // if the generator ever breaks that symmetry, the sentence is wrong in a way
  // no count can express, so fail here rather than compare numbers.
  assert.equal(perCategory.length, 2 * Object.keys(CATEGORIES).length,
    'commands/ no longer holds exactly one add- and one list- per catalogue category');

  assertStated(/(?:category — |מופעלת\*\* — )(\d+) (?:today|היום)/g,
    String(perCategory.length), 'the per-category slash-command count');
  assertStated(/(?:the|ועוד) (\d+) (?:that are not per-category|שאינן לפי קטגוריה)/g,
    String(others.length), 'the non-per-category slash-command count');
  assertStated(/(?:All|כל) (\d+) (?:of those carry|אלה נושאות)/g,
    String(slashNames.length - 1), 'the count of slash commands the model cannot invoke');
  assertStated(/(\d+)(?: פקודות ה-<span dir="ltr">| )`\/mycontext:(?:add|list)-<type>`/g,
    String(perCategory.length / 2), 'the per-category command count in §8');

  for (const doc of documents) {
    const anchor = doc.text.match(/(?:that are not per-category|שאינן לפי קטגוריה):/);
    assert.ok(anchor?.index !== undefined,
      `${doc.relative} no longer introduces the non-per-category list with the expected phrase`);
    const start = anchor.index + anchor[0].length;
    const length = doc.text.slice(start).search(/\.\s/);
    assert.ok(length > 0, `${doc.relative}'s non-per-category list has no closing sentence`);
    const listed = [...doc.text.slice(start, start + length).matchAll(/`([a-z][a-z-]*)`/g)]
      .map((m) => m[1])
      .sort();
    assert.deepEqual(
      listed, others,
      `${doc.relative}'s enumeration of non-per-category slash commands does not match ` +
      `commands/: it lists [${listed.join(', ')}].`,
    );
  }
});

/* ---------------------------------------------------------------------------
 * §7's approval boundary — the set, its size, and the deny rules that are the
 * only thing enforcing it.
 * ------------------------------------------------------------------------- */

/**
 * **The number this file was written for, and the one that had no test at all.**
 *
 * §7 opens with "N CLI commands change what governs this project with no human
 * in the loop", enumerates them in a table, and repeats the set as a block of
 * recommended `permissions.deny` rules. Both documents carry all three. None of
 * it was watched: `inventory.test.ts` checks that every command is NAMED
 * somewhere, which a §7 table missing a command satisfies perfectly, and the
 * deny block is a fenced JSON sample that no test read at all.
 *
 * The count went stale the moment `inbox-promote` landed and made it nine, and
 * the trap that near-miss sprang is worse than a wrong number: the generated
 * `commands/*.md` files tell the MODEL that the command it is looking at "is on
 * the deny list this plugin's README recommends" (`previewThenHandBack`,
 * src/plugin/commands.ts). Ship a member the deny block does not list and that
 * sentence is printed to a model while it is false.
 *
 * **What makes a command a member, decided here rather than remembered.** The
 * working definition is: it changes what governs this project, and no human is
 * required to reach that write. The second half is what `--yes` is — a token
 * anything holding a shell can type — so the set is derived by asking the real
 * argument parser which commands accept `--yes`, then subtracting the names
 * that are not separate mechanisms and adding the one command whose gate is not
 * weak but ABSENT.
 *
 * The derivation is deliberately not tuned to reproduce what §7 already said.
 * Run against the nine-command text it replaced it named `refresh` as a tenth
 * member — `mycontext refresh <id> --yes` replaces a governing item's body with
 * the current text of the file that item snapshots, which is what `add --file`
 * on a normative category promises ("`mycontext refresh` takes a new snapshot
 * through this same gate", src/cli/index.ts) and which §7 never listed. It was
 * already on the deny list, which is how the omission stayed invisible: the
 * rules were right and the prose was not.
 */

/** A flag string no command accepts, used to prove the probe below can fail. */
const SENTINEL = '--zzz-not-a-flag-any-command-accepts';

/**
 * Commands whose argument surface the `--yes` probe cannot reach, each with the
 * reason. This table exists because the probe's negative answer is worthless
 * without it: a command that refuses NOTHING would be silently classified as
 * "does not take --yes", and a checker that quietly answers for a case it never
 * tested is the exact defect this repository has now found five times.
 *
 * Every entry is re-checked below, so one that stops being true fails rather
 * than lingering, and a new command that validates no flags has to be named
 * here with a reason instead of falling through.
 */
const NO_FLAG_PROBE: Record<string, string> = {
  help: 'takes a topic, not flags — it reads the sentinel as the topic and says so',
  init: 'creates a workspace and takes no flags at all',
  ingest: 'prints its usage for the missing <path> before any flag is looked at',
  'ingest-apply': 'prints its usage for the missing <session-id> first',
  'lesson-accept': 'prints its usage for the missing <LESSON-id> <key> first — and there is '
    + 'no --yes on it to find either way; see UNGATED below',
  'lesson-discard': 'prints its usage for the missing <LESSON-id> <key> first',
  'lesson-stage': 'prints its usage for the missing <LESSON-id> first',
  rebuild: 're-indexes what is on disk and takes no flags at all',
  show: 'takes an id, not flags — it reads the sentinel as the id and says so',
};

/**
 * The member the `--yes` probe cannot find, because there is nothing to find.
 *
 * `mycontext lesson-accept <lesson> <key>` creates an `active` rule — governing
 * this project — with no `--yes` and no prompt of any kind. It is a member a
 * fortiori: the probe looks for commands whose confirmation a human need not
 * answer, and this one has no confirmation to answer. §3's "From an incident to
 * a rule" says the same thing in prose ("There is no second command and no
 * `--yes` to withhold"), and §7 now says it where the gate is described.
 *
 * Naming it here is the one place this derivation is told something rather than
 * asking, so it is not taken on trust: `the ungated member … is real` below runs
 * the whole lesson → stage → accept flow with no `--yes` and no terminal, and
 * fails if the rule does not appear. If a gate is ever added, that test goes red
 * and this entry has to be revisited rather than silently surviving.
 */
const UNGATED: Record<string, string> = {
  'lesson-accept': 'creates an active rule with no --yes and no prompt at all (§3, §7)',
};

/**
 * In the table and on the deny list, deliberately outside the count.
 *
 * `review discard-revision` settles — terminally — a decision the revision
 * queue exists to reserve for a human, so it belongs on the deny list and in
 * the table. It changes nothing about what governs, which is why §7 says in the
 * row itself that it is not counted. Both halves are asserted below: it must
 * still take `--yes`, or this exemption is about a command that no longer
 * behaves the way the row describes, and it must still be in the table.
 */
const NOT_COUNTED = ['review discard-revision'];

/** Every command string a permission rule would be written against. */
function commandStrings(): string[] {
  const top = [...COMMANDS.keys()].filter((name) => name !== 'review');
  return [...top, ...SUBCOMMANDS.map((sub) => `review ${sub}`)].sort();
}

/**
 * Which command strings the real parser accepts `--yes` on.
 *
 * Probed rather than read out of a source file: the accepted-flag list is a
 * per-command array (`ALLOWED`, `NAMED_ALLOWED`, `SUBCOMMAND_FLAGS`, …) with no
 * single expression to import, and a grep for `'yes'` would find the word in
 * comments and in `--always=yes`. What the CLI does with `--yes` on its own
 * command line is the fact §7 is about, so that is what is asked.
 *
 * The sentinel is the anti-vacuity half. Without it, "did not complain about
 * --yes" is satisfied by every command that refuses earlier for an unrelated
 * reason, which on the first draft of this probe classified all but one command
 * as gated.
 */
function gatedCommands(): Set<string> {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-boundary-'));
  try {
    assert.equal(runCli(['init'], dir, () => {}), 0, 'the probe workspace did not initialize');
    const run = (argv: string[]): string => {
      const lines: string[] = [];
      runCli(argv, dir, (s) => lines.push(s));
      return lines.join('\n');
    };
    const refuses = (text: string, flag: string): boolean =>
      text.includes(`unknown flag "${flag}"`) || text.includes(`unknown option "${flag}"`);

    const all = commandStrings();
    const gated = new Set<string>();
    const unreachable: string[] = [];
    for (const command of all) {
      const argv = command.split(' ');
      if (!refuses(run([...argv, SENTINEL]), SENTINEL)) { unreachable.push(command); continue; }
      if (!refuses(run([...argv, '--yes']), '--yes')) gated.add(command);
    }
    assert.deepEqual(
      unreachable.sort(), Object.keys(NO_FLAG_PROBE).sort(),
      'the set of commands whose flags this probe cannot reach has changed. Add the new one ' +
      'to NO_FLAG_PROBE with the reason, or drop the entry that is no longer true — do not ' +
      'let a command fall through unclassified, because the probe would answer "not gated" ' +
      'for it without ever having tested that.',
    );
    // Both directions, so a probe that answered the same way for everything —
    // the shape `check-retired.ts` shipped in — cannot pass here.
    assert.ok(gated.size > 0, 'the probe found no command that takes --yes; it is broken');
    assert.ok(
      gated.size < all.length - unreachable.length,
      'the probe found that EVERY reachable command takes --yes; it is broken',
    );
    return gated;
  } finally {
    removeTree(dir);
  }
}

const gated = gatedCommands();
/** `pin`/`unpin`/`harden`/`soften` — `edit` under a shorter name, from the registry. */
const aliases = NAMED_ENTRY_POINTS.map((entry) => entry.name);
/** Everything §7's table is about: the gated mechanisms, plus the ungated one. */
const boundary = [
  ...[...gated].filter((name) => !aliases.includes(name)),
  ...Object.keys(UNGATED),
].sort();
/** Of those, the ones that change what governs — the number §7 states. */
const counted = boundary.filter((name) => !NOT_COUNTED.includes(name));

/**
 * The count as a WORD, in both languages, in the two sentences that carry it.
 *
 * Hebrew numerals agree with their noun's gender and `פקודות` is feminine, so
 * these are the feminine forms — not the masculine ones `NUMBER_WORDS` above
 * uses for `כלים`. Getting that wrong would be a Hebrew-only defect of exactly
 * the kind this file exists to catch.
 */
const BOUNDARY_WORDS: Record<number, { en: string; he: string }> = {
  8: { en: 'eight', he: 'שמונה' },
  9: { en: 'nine', he: 'תשע' },
  10: { en: 'ten', he: 'עשר' },
  11: { en: 'eleven', he: 'אחת-עשרה' },
  12: { en: 'twelve', he: 'שתים-עשרה' },
};

test('both documents state the real size of the approval boundary', () => {
  const words = BOUNDARY_WORDS[counted.length];
  assert.ok(
    words,
    `the approval boundary is now ${counted.length} commands, which BOUNDARY_WORDS does not ` +
    `spell. Add it rather than deleting this test — the whole point is that this number went ` +
    `stale unwatched. The set is: ${counted.join(', ')}.`,
  );
  const PATTERNS = [
    // The opening sentence of "The approval boundary".
    /(?:^|\n)([\p{L}-]+) (?:CLI commands change what governs|פקודות בשורת הפקודה משנות)/gu,
    // The `discard-revision` row saying it is not one of them.
    /(?:not counted among the |אינה נספרת בין ה)([\p{L}-]+) (?:above|שלמעלה)/gu,
  ];
  for (const doc of documents) {
    const expected = doc.relative === 'README.md' ? words.en : words.he;
    let found = 0;
    for (const pattern of PATTERNS) {
      for (const [, word] of doc.text.matchAll(pattern)) {
        found++;
        assert.equal(
          word.toLowerCase(), expected,
          `${doc.relative} states the size of the approval boundary as "${word}"; the program ` +
          `puts ${counted.length} command(s) there: ${counted.join(', ')}.`,
        );
      }
    }
    assert.equal(
      found, PATTERNS.length,
      `${doc.relative} carries ${found} of the ${PATTERNS.length} sentences that state the ` +
      `size of the approval boundary. If the wording changed, update the patterns; do not ` +
      `delete them.`,
    );
  }
});

/**
 * The §7 table's header row, per language. Anchored on the header rather than
 * on "a table containing backticked commands", because both documents carry
 * several of those.
 */
const BOUNDARY_TABLE =
  /^\| (?:Command \| What it does with no human|פקודה \| מה היא עושה בלי אדם)/;

/** The command each row of §7's table is about, in document order. */
function boundaryRows(doc: { relative: string; text: string }): string[] {
  const lines = doc.text.split('\n');
  const header = lines.findIndex((line) => BOUNDARY_TABLE.test(line));
  assert.ok(
    header >= 0,
    `${doc.relative} no longer carries §7's approval-boundary table under its expected ` +
    `header. If the wording changed, update BOUNDARY_TABLE; do not delete the assertion.`,
  );
  const rows: string[] = [];
  // header + 1 is the `|---|---|` separator.
  for (let i = header + 2; i < lines.length && lines[i].startsWith('|'); i++) {
    const cell = lines[i].slice(1, lines[i].indexOf('|', 1));
    const named = /`mycontext ([a-z][a-z-]*(?: [a-z][a-z-]*)*)/.exec(cell);
    assert.ok(named, `${doc.relative}: §7 table row ${rows.length + 1} names no command: ${cell}`);
    rows.push(named[1]);
  }
  return rows;
}

test('both documents enumerate the whole approval boundary, and nothing else', () => {
  for (const doc of documents) {
    assert.deepEqual(
      boundaryRows(doc).sort(), boundary,
      `${doc.relative}'s §7 table is not the set the program produces. A count that agrees ` +
      `while the enumeration is short is the failure a reader actually trips over, because ` +
      `the table is what they read.`,
    );
  }
});

/** The `Bash(mycontext … *)` rules inside the recommended `permissions.deny` block. */
function denyRules(doc: { relative: string; text: string }): string[] {
  const start = doc.text.indexOf('"deny": [');
  assert.ok(start > 0, `${doc.relative} no longer carries a recommended "deny" block`);
  const end = doc.text.indexOf(']', start);
  assert.ok(end > start, `${doc.relative}'s "deny" block is not closed`);
  const rules = [...doc.text.slice(start, end).matchAll(/"Bash\(mycontext ([a-z][a-z- ]*?) \*\)"/g)]
    .map((m) => m[1]);
  assert.ok(rules.length > 0, `${doc.relative}'s "deny" block parsed to no rules`);
  return rules.sort();
}

/**
 * The half the prose cannot carry: every member has a deny rule, in BOTH
 * languages. The Hebrew occurrence of §8's ratio was already outside every
 * pattern in this file once; the deny block is the same shape of omission
 * waiting to happen, since it is a fenced JSON sample that reads as decoration.
 *
 * The aliases are here and not in the count for the reason §7 gives itself — a
 * permission rule is matched against the command STRING, so
 * `Bash(mycontext edit *)` does not match `mycontext pin …`, and each of the
 * four needs a rule of its own. Same arithmetic in the other direction for
 * `review promote-revision`, which `Bash(mycontext review promote *)` does not
 * match because the pattern wants a space where the command has a hyphen.
 *
 * Asserted as an equality, not a subset. A missing rule leaves a member
 * reachable while the generated `commands/*.md` tell the model it is denied; a
 * rule with no member behind it names something that has been renamed or
 * removed, and a deny list carrying one is out of date in a way a reader cannot
 * see.
 */
test('both documents deny every command on the approval boundary', () => {
  const required = [...new Set([...boundary, ...aliases])].sort();
  for (const doc of documents) {
    assert.deepEqual(
      denyRules(doc), required,
      `${doc.relative}'s recommended deny list is not the approval boundary. A member with no ` +
      `rule is reachable while the generated commands/*.md tell the model it is denied.`,
    );
  }
});

/**
 * `review discard-revision`'s exemption from the count, checked rather than
 * assumed — an exemption nothing verifies is how a list stops describing the
 * program.
 */
test('the command left out of the count is still in the table and still gated', () => {
  for (const name of NOT_COUNTED) {
    assert.ok(
      gated.has(name),
      `${name} no longer takes --yes, so its exemption from the count was written about a ` +
      `command that behaved differently. Re-read §7's row for it.`,
    );
    for (const doc of documents) {
      assert.ok(
        boundaryRows(doc).includes(name),
        `${doc.relative}'s §7 table no longer carries ${name}, which is left out of the count ` +
        `only because the table is there to explain why.`,
      );
    }
  }
});

/**
 * The ungated member, proven by running it.
 *
 * `lesson-accept` is the one name this derivation is handed rather than
 * deriving, so it is the one that most needs to be falsifiable. This runs the
 * whole flow with no `--yes` and no terminal — the conditions every other
 * member of the set refuses under — and requires that a governing rule exists
 * afterwards. If a confirmation gate is ever added, `confirmAction` declines
 * without a TTY, no rule appears, and this goes red: exactly the moment UNGATED
 * needs to be revisited.
 */
test('the ungated member of the approval boundary is real', () => {
  assert.deepEqual(Object.keys(UNGATED), ['lesson-accept'], 'update this test with UNGATED');
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ungated-'));
  try {
    const run = (argv: string[]): string => {
      const lines: string[] = [];
      runCli(argv, dir, (s) => lines.push(s));
      return lines.join('\n');
    };
    assert.equal(runCli(['init'], dir, () => {}), 0);
    const lesson = /LESSON-[a-z0-9-]+/.exec(run(['lesson', 'Retry storms need jitter']));
    assert.ok(lesson, 'the lesson was not recorded');
    writeFileSync(path.join(dir, 'candidates.json'), JSON.stringify([{
      title: 'Add jitter to backoff',
      directive: 'do',
      body: 'Every retry backoff gets randomized jitter.',
      severity: 'hard',
    }]) + '\n');
    const staged = run(['lesson-stage', lesson[0], '--file', 'candidates.json']);
    const key = /\b[0-9a-f]{8}\b/.exec(staged);
    assert.ok(key, `lesson-stage staged no candidate key:\n${staged}`);

    // No --yes, and `node --test` gives the process no TTY, so every GATED
    // member of this set would refuse here and write nothing.
    const accepted = run(['lesson-accept', lesson[0], key[0]]);
    assert.doesNotMatch(accepted, /refusing without confirmation/, accepted);
    const rules = JSON.parse(run(['list', 'rule', '--json'])) as { count: number };
    assert.equal(
      rules.count, 1,
      `lesson-accept created no governing rule without --yes:\n${accepted}\n` +
      `If it has grown a confirmation gate, that is good news and UNGATED is now wrong — ` +
      `re-derive the set rather than deleting this test.`,
    );
  } finally {
    removeTree(dir);
  }
});
