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
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
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
