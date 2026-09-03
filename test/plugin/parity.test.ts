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
import { NAMED_ENTRY_POINTS } from '../../src/cli/commands/edit.ts';
import { COMMANDS } from '../../src/cli/commands/registry.ts';
import { acknowledgeFinding } from '../../src/core/mutate.ts';
import { TOOL_NAMES } from '../../src/mcp/tools.ts';
import {
  CLI_WITHOUT_SLASH, CLI_WITHOUT_TOOL, TOOL_PARITY, covered,
} from '../../src/plugin/parity.ts';
import { sandbox } from '../helpers/workspace.ts';
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

/**
 * B13 — the reverse of the direction every test above checks.
 *
 * `TOOL_PARITY` asserts every TOOL has a CLI or slash counterpart.
 * `CLI_WITHOUT_SLASH` asserts every CLI command has a slash counterpart, or a
 * reason. Nothing asserted the third leg: that every CLI command has a TOOL.
 * `doctor`, `ready`, `status`, `decay`, `pack`, `export`, `session` and more
 * sat in that unexamined space with no test naming them at all.
 *
 * The "tool-covered" CLI names are read out of `TOOL_PARITY`'s own `cli`
 * column — never a second hand-kept list beside it, which is the whole
 * reason `TOOL_PARITY` and `CLI_WITHOUT_TOOL` cannot drift from each other
 * without one of them saying so.
 */
const toolCliNames = TOOL_PARITY
  .map((row) => row.cli)
  .filter((cli): cli is string => cli !== null);

test('every CLI command has a tool, or is listed with a reason', () => {
  const without = cliNames.filter((name) => !covered(name, toolCliNames));
  assert.deepEqual(
    without.toSorted(), Object.keys(CLI_WITHOUT_TOOL).toSorted(),
    'the set of CLI commands with no tool changed. Either give it a TOOL_PARITY row (through ' +
    'the tool that answers it) or add a row to CLI_WITHOUT_TOOL saying why it has none, marked ' +
    '\'intended\' or \'owed\'.',
  );
  for (const [name, entry] of Object.entries(CLI_WITHOUT_TOOL)) {
    assert.ok(
      entry.reason.length > 40,
      `CLI_WITHOUT_TOOL.${name} has no real reason`,
    );
    assert.ok(
      entry.disposition === 'intended' || entry.disposition === 'owed',
      `CLI_WITHOUT_TOOL.${name} has no disposition — every row is 'intended' or 'owed', ` +
      'never left unsaid',
    );
  }
});

/**
 * The self-checks. Each ties one `'intended'` row's REASON to a fact this
 * test can re-read from the source it names, so the reason fails loudly
 * when the fact it depends on stops being true — the way `ready`'s two
 * clauses in `CLI_WITHOUT_SLASH` did not, and survived being wrong.
 *
 * `'owed'` rows need none of this: their only claim is "no tool exists
 * today", which the derived-set comparison above already re-proves on every
 * run by construction. A row that cannot be tied to a re-checkable fact says
 * so in its own `reason` instead of pretending prose is enforcement —
 * `session`, `statusline` and `lesson-discard` are that case, named here so
 * the gap is not silently claimed to be covered by the tests around it.
 */
test('the four named entry points onto `edit` are `update_item` under a shorter name', () => {
  const aliases = NAMED_ENTRY_POINTS.map((entry) => entry.name).toSorted();
  assert.deepEqual(
    aliases, ['harden', 'pin', 'soften', 'unpin'],
    'NAMED_ENTRY_POINTS no longer names exactly the four rows this reasons about — update both.',
  );
  const editRow = TOOL_PARITY.find((row) => row.tool === 'update_item');
  assert.ok(editRow, 'update_item left TOOL_PARITY');
  assert.equal(
    editRow!.cli, 'edit',
    'update_item no longer claims `edit` as its CLI counterpart, so `harden`/`pin`/`soften`/' +
    '`unpin` — which rewrite argv into `edit` — no longer inherit a tool through it either.',
  );
});

test('`ack` is refused for every origin but human', () => {
  const box = sandbox();
  try {
    assert.throws(
      () => acknowledgeFinding(
        box.ctx, { id: 'RULE-does-not-exist', code: 'body_disagrees_with_meta', origin: 'agent' },
      ),
      /only a person can acknowledge a doctor finding/,
    );
  } finally { box.dispose(); }
});

test('`init` is still the one command dispatched before a workspace resolves', () => {
  assert.equal(COMMANDS.get('init')?.workspace, 'none');
  const bare = [...COMMANDS.values()].filter((def) => def.workspace === 'none');
  assert.deepEqual(
    bare.map((def) => def.name), ['init'],
    'a second command now runs before resolveWorkspace — `init`\'s tool-absence reason no ' +
    'longer names the only one',
  );
});

test('every tool call rebuilds the index before its handler runs', () => {
  const text = readFileSync(path.join(REPO, 'src', 'mcp', 'tools.ts'), 'utf8');
  assert.match(
    text, /function withWorkspace[\s\S]*?openRebuiltStore\(/,
    '`withWorkspace` no longer calls `openRebuiltStore` — a dedicated tool for `rebuild` may ' +
    'no longer be redundant',
  );
});

test('`ingest_document` already applies its own extracted candidates', () => {
  const text = readFileSync(path.join(REPO, 'src', 'mcp', 'tools', 'ingest.ts'), 'utf8');
  assert.match(
    text, /applyCandidates\(/,
    'the ingest tool no longer calls applyCandidates — `ingest-apply` may no longer be a step ' +
    'the tool already performs',
  );
});

test('`inbox-promote` retires the origin capture as a hardcoded human act', () => {
  const text = readFileSync(path.join(REPO, 'src', 'cli', 'commands', 'inbox-promote.ts'), 'utf8');
  assert.match(
    text, /status:\s*'deprecated',\s*origin:\s*'human'/,
    'inbox-promote no longer hardcodes origin: \'human\' on the retirement write — a tool may ' +
    'no longer be structurally blocked',
  );
});

test('`lesson-accept` hardcodes the human origin its approval gate depends on', () => {
  const text = readFileSync(path.join(REPO, 'src', 'lesson', 'derive.ts'), 'utf8');
  const fn = text.slice(text.indexOf('function acceptStagedRule'));
  assert.match(
    fn, /origin:\s*'human'/,
    'acceptStagedRule no longer hardcodes origin: \'human\' — the approval gate this row ' +
    'depends on may no longer hold',
  );
});

test('`query` is still raw, uncapped-by-schema SQL', () => {
  assert.match(
    COMMANDS.get('query')?.usage ?? '', /SELECT/,
    'query\'s usage no longer names raw SQL — the reason it has no tool may no longer apply',
  );
});

test('`export` still requires the caller to name a destination outside the workspace', () => {
  assert.match(
    COMMANDS.get('export')?.usage ?? '', /--out <path>/,
    'export no longer requires --out — the destination-choice reason may no longer apply',
  );
});

test('`ui` still binds a port instead of answering one call', () => {
  assert.match(
    COMMANDS.get('ui')?.usage ?? '', /--port/,
    'ui\'s usage no longer mentions a port',
  );
  const text = readFileSync(path.join(REPO, 'src', 'ui', 'server.ts'), 'utf8');
  assert.match(text, /createServer/);
  assert.match(text, /\.listen\(/);
});

test('`repair` and `pack import` are still on the README\'s recommended deny list', () => {
  const readme = readFileSync(path.join(REPO, 'README.md'), 'utf8');
  const denyBlock = readme.slice(readme.indexOf('"deny": ['), readme.indexOf('"deny": [') + 2000);
  const denied = [...denyBlock.matchAll(/Bash\(mycontext ([a-z][a-z -]*) \*\)/g)].map((m) => m[1]);
  assert.ok(
    denied.includes('repair'),
    'README §7\'s recommended deny block no longer lists `mycontext repair *`',
  );
  assert.ok(
    denied.includes('pack import'),
    'README §7\'s recommended deny block no longer lists `mycontext pack import *`',
  );
});
