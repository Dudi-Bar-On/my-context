/**
 * **Parity between what the model can do and what the user can do, enforced.**
 *
 * The requirement: anything the model can do through a tool, the user can do
 * through a command. `src/plugin/parity.ts` declares the map; this checks it
 * against the running program, in both directions, so that a new tool with no
 * command — or a command that quietly lost its slash counterpart — fails here
 * rather than being found by a user who went looking for it.
 *
 * The shape is `test/docs/inventory.test.ts`'s: every side is derived from
 * what the program actually does. The tool list comes from `TOOL_NAMES`, the
 * CLI list from the usage banner the program prints (the registry alone omits
 * the seven names dispatched by the hardcoded switch), and the slash list from
 * the files on disk, which is what Claude Code reads.
 *
 * What is NOT derived is the *pairing* — which command answers which tool, and
 * why an absence is acceptable. That is a judgement, so it is declared, and the
 * whole point of this file is that every such judgement is written down before
 * it is discovered.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { TOOL_NAMES } from '../../src/mcp/tools.ts';
import { CLI_WITHOUT_SLASH, TOOL_PARITY, covered } from '../../src/plugin/parity.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO = path.join(import.meta.dirname, '..', '..');

function cliCommandNames(): string[] {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-parity-'));
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

test('the parity map covers every MCP tool, exactly once, and invents none', () => {
  assert.ok(TOOL_NAMES.length > 0, 'the tool list did not load');
  const declared = TOOL_PARITY.map((r) => r.tool);
  assert.deepEqual(
    [...new Set(declared)].toSorted(), declared.toSorted(),
    'a tool is declared twice in TOOL_PARITY',
  );
  assert.deepEqual(
    declared.toSorted(), [...TOOL_NAMES].toSorted(),
    'TOOL_PARITY and the MCP tool list disagree. A new tool needs a row saying which ' +
    'command answers it — that is the requirement this file exists for, and it is not ' +
    'satisfied by adding the tool alone.',
  );
});

test('every MCP tool has a user-invocable counterpart', () => {
  for (const row of TOOL_PARITY) {
    assert.ok(
      row.cli !== null || row.slash !== null,
      `${row.tool} has neither a CLI command nor a slash command. Anything the model can ` +
      `do through a tool, the user must be able to do through a command — there is no ` +
      `exception list for this half, because an exception here IS the gap.`,
    );
  }
});

test('every counterpart the map claims actually exists', () => {
  for (const row of TOOL_PARITY) {
    if (row.cli !== null) {
      assert.ok(
        covered(row.cli, cliNames),
        `${row.tool} claims the CLI command \`mycontext ${row.cli}\`, which the usage ` +
        `banner does not list`,
      );
    }
    if (row.slash !== null) {
      assert.ok(
        covered(row.slash, slashNames),
        `${row.tool} claims the slash command \`/mycontext:${row.slash}\`, which is not in ` +
        `commands/ — run \`npm run gen:commands\``,
      );
    }
  }
});

test('every missing counterpart carries a reason, and every reason names a real absence', () => {
  for (const row of TOOL_PARITY) {
    const missing = row.cli === null || row.slash === null;
    if (missing) {
      assert.ok(
        row.note && row.note.length > 40,
        `${row.tool} is missing a counterpart and has no note. An asymmetry is listed ` +
        `deliberately or it is a defect; there is no third state.`,
      );
    } else {
      // The other half, so a note cannot linger on a row whose gap was closed
      // and go on explaining an absence that is no longer there.
      assert.equal(
        row.note, undefined,
        `${row.tool} has both counterparts and still carries a note explaining an absence`,
      );
    }
  }
});

/**
 * The other direction. This is the ratio §8 of both READMEs states, computed
 * the same way `test/docs/counts.test.ts` computes it — the two must agree,
 * because a reader who finds different numbers in the document and the test
 * has no way to tell which is wrong.
 */
test('every CLI command has a slash command, or is listed with a reason', () => {
  const without = cliNames.filter((name) => !covered(name, slashNames));
  assert.deepEqual(
    without.toSorted(), Object.keys(CLI_WITHOUT_SLASH).toSorted(),
    'the set of CLI commands with no slash command changed. Either generate the command ' +
    '(src/plugin/commands.ts) or add a row to CLI_WITHOUT_SLASH saying why it has none.',
  );
  for (const [name, reason] of Object.entries(CLI_WITHOUT_SLASH)) {
    assert.ok(reason.length > 40, `CLI_WITHOUT_SLASH.${name} has no real reason`);
  }
});

/**
 * The row that used to be the project's one named asymmetry, kept as a test so
 * that closing it is not silently undone. `/mycontext:search` called
 * `query_items` and had no CLI counterpart at all; `mycontext search` is now
 * that counterpart, and both READMEs' §8 had to stop saying otherwise.
 */
test('the search asymmetry is closed, on both surfaces', () => {
  const row = TOOL_PARITY.find((r) => r.tool === 'query_items');
  assert.ok(row, 'query_items left the tool list');
  assert.equal(row!.cli, 'search');
  assert.equal(row!.slash, 'search');
  assert.ok(cliNames.includes('search'), 'the CLI no longer has a `search` command');
  assert.ok(slashNames.includes('search'), 'commands/search.md is gone');
});

/**
 * Nothing above would notice a slash command that exists, is documented, and
 * points at nothing — so the read commands are checked against the CLI names
 * they name. A `/mycontext:doctor` whose body ran `mycontext dotcor` would be
 * a file a user types and gets an "unknown command" back from.
 */
test('every CLI invocation written into a command file names a command that exists', () => {
  const dir = path.join(REPO, 'commands');
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  assert.ok(files.length > 0, 'commands/ is empty');
  const seen = new Set<string>();
  for (const file of files) {
    const text = readFileSync(path.join(dir, file), 'utf8');
    for (const [, name] of text.matchAll(/\/src\/cli\/index\.ts" ([a-z][a-z-]*)/g)) {
      seen.add(name);
      assert.ok(
        cliNames.includes(name),
        `commands/${file} tells the user to run \`mycontext ${name}\`, which the CLI does ` +
        `not dispatch`,
      );
    }
  }
  // Not vacuous: the regex has to be finding invocations at all, and enough of
  // them that a typo in the pattern shows up here rather than as a green run.
  assert.ok(seen.size >= 10, `only ${seen.size} distinct CLI invocations found in commands/`);
});
