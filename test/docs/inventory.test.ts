/**
 * Documentation inventory parity: every CLI command, slash command and MCP
 * tool is named in README.md, and README.md names no CLI command that does
 * not exist.
 *
 * **This test is committed deliberately red.** It lands in Task 4 of
 * `docs/superpowers/plans/2026-08-14-mycontext-documentation.md` and goes
 * green in Task 6, when the README documents every surface. Between those two
 * tasks `npm test` fails, and the failure list *is* the remaining work. Every
 * assertion below says so in its message, so nobody running the suite in that
 * window has to guess whether the red is theirs.
 *
 * Both sides are derived from what the program actually does, never from a
 * hand-kept list: a hand-kept list would drift, which is the failure this
 * test exists to prevent.
 *
 * What this does NOT check: whether the documentation is *true*. A test can
 * check that a command is named and that a named command exists; it cannot
 * check that the sentence around the name is accurate. Claims about the trust
 * boundary, the injection tiers and the configuration semantics remain
 * human-reviewed (spec §5). A green suite is not verified prose.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { COMMANDS } from '../../src/cli/commands/registry.ts';
import { runCli } from '../../src/cli/index.ts';
import { TOOL_NAMES } from '../../src/mcp/tools.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const readme = readFileSync(path.join(REPO, 'README.md'), 'utf8');

/**
 * The banner-and-plan pointer every assertion carries, so a failure in the
 * deliberate red window between Tasks 4 and 6 is self-explaining.
 */
const RED_WINDOW =
  'EXPECTED FAILURE until Task 6 of ' +
  'docs/superpowers/plans/2026-08-14-mycontext-documentation.md is done. ' +
  'This test was committed red on purpose; the names listed here are the ' +
  'work that closes it. If you are seeing this after Task 6, it is a real ' +
  'regression: something was added without being documented.';

/**
 * A throwaway directory with no `.my_context` above it, so the CLI runs
 * against an empty workspace (`dbPath` is `:memory:` when there is no project
 * root — `src/core/workspace.ts`) and cannot touch anything real.
 */
function inScratch<T>(fn: (cwd: string) => T): T {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-inventory-'));
  try {
    return fn(dir);
  } finally {
    removeTree(dir);
  }
}

/** Everything `mycontext <name>` prints, as one string. */
function cli(argv: string[], cwd: string): string {
  const lines: string[] = [];
  runCli(argv, cwd, (s) => lines.push(s));
  return lines.join('\n');
}

/**
 * The complete set of CLI command names, enumerated by *running the program*.
 *
 * Neither source on its own is complete. `COMMANDS` (the registry) omits the
 * seven names dispatched by the hardcoded `switch` in `src/cli/index.ts` —
 * `init`, `add`, `list`, `show`, `rebuild`, `help`, `examples` — which
 * `registry.ts` refuses to let anyone register. A test built on the registry
 * alone would therefore pass while seven real commands went undocumented,
 * which is precisely the half-checking defect this repository keeps
 * producing. The usage banner is the one place both halves are already
 * joined, and `mycontext help` prints it, so it is read from the running CLI
 * rather than reconstructed. `assertBannerIsWholeSurface` below pins the
 * banner as trustworthy in both directions.
 */
function cliCommandNames(): string[] {
  const banner = inScratch((cwd) => cli(['help'], cwd));
  // Each command occupies one two-space-indented line of the usage column;
  // `categories:` and the blank lines are flush left.
  const names = [...banner.matchAll(/^ {2}([a-z][a-z-]*)(?= |$)/gm)].map((m) => m[1]);
  assert.ok(names.length > 0, `could not parse the usage banner:\n${banner}`);
  return [...new Set(names)];
}

const cliNames = cliCommandNames();

/** Slash commands are `/<plugin>:<file basename>`; the plugin is `mycontext`. */
const slashNames = readdirSync(path.join(REPO, 'commands'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => f.replace(/\.md$/, ''));

/**
 * Every `mycontext <name>` written inside inline code or a fenced block.
 *
 * Restricted to code because "mycontext stores items as Markdown" is prose,
 * not a command invocation, and a bare word-match would read `stores` as an
 * invented command. It deliberately does NOT match `/mycontext:search`: the
 * two surfaces are spelled differently — the CLI is `mycontext <name>` with a
 * space, a slash command is `/mycontext:<name>` with a colon — so the slash
 * surface, which includes names with no CLI counterpart (`search` calls the
 * `query_items` MCP tool and has no CLI command), is excluded by the shape of
 * the invocation rather than by an exception list.
 */
function cliCommandsNamedInReadme(markdown: string): string[] {
  const fenced = /^```[^\n]*\n([\s\S]*?)^```/gm;
  const fences = [...markdown.matchAll(fenced)].map((m) => m[1]);
  const prose = markdown.replace(fenced, '\n');
  const spans = [...prose.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
  const code = [...fences, ...spans].join('\n');
  return [...new Set([...code.matchAll(/(?:^|\s)mycontext ([a-z][a-z-]*)/gm)].map((m) => m[1]))];
}

test('the CLI inventory covers the whole command surface, not just the registry', () => {
  // Importing `runCli` is what registers the registry commands; if that ever
  // stops being true, `COMMANDS` is empty and every check below passes
  // vacuously.
  assert.ok(COMMANDS.size > 0, 'COMMANDS is empty — the registrations did not run');

  const missingFromBanner = [...COMMANDS.keys()].filter((n) => !cliNames.includes(n));
  assert.deepEqual(missingFromBanner, [],
    `the usage banner does not list registered command(s): ${missingFromBanner.join(', ')}`);

  const builtins = cliNames.filter((n) => !COMMANDS.has(n));
  assert.deepEqual(builtins.toSorted(),
    ['add', 'examples', 'help', 'init', 'list', 'rebuild', 'show'],
    'the set of commands dispatched outside the registry changed — this test ' +
    'enumerates the CLI from the usage banner precisely so that change is visible');

  // Advertised is not the same as working: `registry.ts` warns that a name in
  // the banner with no dispatch arm is silently dead. Prove each one runs.
  for (const name of cliNames) {
    const output = inScratch((cwd) => cli([name], cwd));
    assert.ok(!output.includes(`unknown command "${name}"`),
      `the usage banner advertises \`mycontext ${name}\` but the CLI does not dispatch it`);
  }
});

/**
 * Whether `name` is named in the README as a whole token.
 *
 * `includes` alone is not enough: `mycontext lesson` is a substring of
 * `mycontext lesson-accept`, so a plain substring check would report `lesson`
 * as documented on the strength of a mention of a different command. The
 * following character must not extend the identifier.
 */
function namedInReadme(name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}(?![\\w-])`).test(readme);
}

test('every CLI command is documented', () => {
  // The same extractor the reverse-direction test uses, so "documented" means
  // the same thing in both directions: named as an invocation inside code.
  const named = cliCommandsNamedInReadme(readme);
  const missing = cliNames.filter((name) => !named.includes(name));
  assert.deepEqual(missing, [], `undocumented CLI commands: ${missing.join(', ')}. ${RED_WINDOW}`);
});

test('every slash command is documented', () => {
  assert.ok(slashNames.length > 0, 'no slash commands found — run `npm run gen:commands`');
  const missing = slashNames.filter((name) => !namedInReadme(`/mycontext:${name}`));
  assert.deepEqual(missing, [], `undocumented slash commands: ${missing.join(', ')}. ${RED_WINDOW}`);
});

test('every MCP tool is documented', () => {
  assert.ok(TOOL_NAMES.length > 0, 'no MCP tools found — the tool list did not load');
  const missing = TOOL_NAMES.filter((name) => !namedInReadme(name));
  assert.deepEqual(missing, [], `undocumented MCP tools: ${missing.join(', ')}. ${RED_WINDOW}`);
});

test('the README names no command that does not exist', () => {
  const named = cliCommandsNamedInReadme(readme);
  const bogus = named.filter((n) => !cliNames.includes(n));
  assert.deepEqual(bogus, [],
    `README documents nonexistent CLI commands: ${bogus.join(', ')}. ` +
    'Either the command was removed and the README was not updated, or the ' +
    'name is a typo. A slash command with no CLI counterpart (for example ' +
    '/mycontext:search) is written /mycontext:<name> and is not matched here.');
});
