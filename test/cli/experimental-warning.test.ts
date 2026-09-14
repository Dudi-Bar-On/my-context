// @basis TASK-every-cli-invocation-prints-an-experimental-warning-that-is, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **`cliscript/5`: the one node invocation this project does not start itself
 * was the one printing `ExperimentalWarning` at a person.**
 *
 * ── THE COUNT, MEASURED HERE RATHER THAN QUOTED ─────────────────────────────
 *
 * The item says "twelve other entry points" in its title and "all eleven
 * hooks, the statusline installer and the review pass" — thirteen — in its
 * body, so it disagrees with itself, and both numbers are wrong. Nothing below
 * hardcodes the right one either: every total is derived from `hooks.json`,
 * `.mcp.json` and the source tree, so it cannot go stale the way the item's
 * did.
 *
 * ── WHY THE FIX IS A SHEBANG AND NOT A FILTER ───────────────────────────────
 *
 * The mechanism at all 22 other invocations is a node COMMAND-LINE FLAG, added
 * by whoever spawns the process. The CLI has no such parent: it is what a
 * person types. And a filter installed from inside cannot work — the warning
 * is emitted while node LINKS the module graph, before the first line of this
 * project's code evaluates — so the flag is carried on the one line a `bin`
 * has for the purpose, its shebang.
 *
 * ── THE ANTI-VACUITY THAT MATTERS MOST HERE ─────────────────────────────────
 *
 * "No `ExperimentalWarning` on stderr" is exactly the assertion that goes
 * green for the wrong reason the day node stabilises `node:sqlite`. So the
 * same command is run BOTH ways in the same test — with the shebang's flags
 * and without them — and the run without them must still warn. A silent
 * control is reported as a test that can no longer prove anything, rather than
 * passed over.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CLI_ENTRY } from '../helpers/spawn-cli.ts';

const REPO = path.resolve(import.meta.dirname, '..', '..');
const read = (...p: string[]): string => readFileSync(path.join(REPO, ...p), 'utf8');

/** Every `command` string anywhere in the hook registration file. */
function hookCommands(): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node === null || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (typeof record.command === 'string') out.push(record.command);
    Object.values(record).forEach(walk);
  };
  walk(JSON.parse(read('hooks', 'hooks.json')));
  return out;
}

/**
 * The flag itself, READ OUT of the invocations that already carry it rather
 * than typed here. If the project ever changes which warning it disables, this
 * file follows without being edited — and a test that spelled it a second time
 * would be the same defect as the item it rests on, one concept in two places.
 */
function theFlag(): string {
  const flags = new Set(
    hookCommands().flatMap((c) => c.split(/\s+/).filter((w) => w.startsWith('--disable-warning='))),
  );
  assert.equal(
    flags.size, 1,
    `the hooks disable ${flags.size} different warning categories (${[...flags].join(', ')}); ` +
    'there is no longer one spelling for this test to follow',
  );
  return [...flags][0];
}

test('every node invocation this project starts carries the warning flag, and so does the CLI', () => {
  const flag = theFlag();

  const commands = hookCommands();
  // Anti-vacuity: an empty list would make the loop below assert nothing, and
  // a hooks file that stopped parsing would look exactly like a clean pass.
  assert.ok(commands.length >= 10, `hooks.json yielded ${commands.length} commands; the walk is broken`);
  const bare = commands.filter((c) => !c.includes(flag));
  assert.deepEqual(bare, [], `${bare.length} hook registration(s) of ${commands.length} do not carry ${flag}`);

  // The MCP server, declared in a different file and in a different shape.
  const mcp = JSON.parse(read('.mcp.json')) as { mcpServers: Record<string, { args: string[] }> };
  const servers = Object.entries(mcp.mcpServers);
  assert.ok(servers.length >= 1, 'no MCP server is declared, so the assertion below is free');
  for (const [name, spec] of servers) {
    assert.ok(spec.args.includes(flag), `the ${name} MCP server is started without ${flag}`);
  }

  // The two places src/ spawns node for a shipped purpose.
  for (const file of [['src', 'review', 'pass.ts'], ['src', 'cli', 'commands', 'statusline-install.ts']]) {
    assert.ok(
      read(...file).includes(flag),
      `${file.join('/')} starts a node process without ${flag}`,
    );
  }

  /**
   * And the CLI, which is the finding. It is the only entry point in the
   * project with no parent of ours to put the flag on its command line, so it
   * carries it on the one line a `bin` has for that — and it must be `env -S`,
   * because a bare `#!/usr/bin/env node <flag>` passes the flag to no one.
   */
  const shebang = read('src', 'cli', 'index.ts').split('\n')[0];
  assert.match(
    shebang, /^#!\/usr\/bin\/env -S node /,
    'the CLI shebang cannot carry an argument in this form (cliscript/5)',
  );
  assert.ok(shebang.includes(flag), `the CLI shebang does not carry ${flag}; it reads: ${shebang}`);
});

/**
 * The behavioural half. The shebang's own flags are PARSED OUT of the file and
 * handed to node, rather than retyped, so this asserts about the line that
 * actually ships: on Windows the file is never executed through its shebang at
 * all — npm's shim reads that line and builds the command — and that is the
 * command reconstructed here.
 */
test('the CLI launched the way its shebang says prints no warning, and exits the same code', () => {
  const shebang = read('src', 'cli', 'index.ts').split('\n')[0];
  const flags = shebang.replace(/^#!\s*\/usr\/bin\/env\s+-S\s+node\s*/, '').trim().split(/\s+/).filter(Boolean);
  assert.ok(flags.length >= 1, `the shebang carries no node flags to test: ${shebang}`);

  const run = (extra: string[]) => {
    // `spawnSync(...).status`, never a shell: a pipeline reports its LAST
    // stage, and this project has been lied to by one.
    const r = spawnSync(process.execPath, [...extra, CLI_ENTRY, 'status'], {
      cwd: REPO, encoding: 'utf8',
    });
    return { status: r.status, stderr: r.stderr ?? '' };
  };

  const control = run([]);
  const shipped = run(flags);

  // THE CONTROL FIRST. Without it, "no warning" is a claim about this node
  // build rather than about the flag, and it would stay green through a
  // release that stabilises node:sqlite and through a repair that deleted the
  // shebang.
  assert.match(
    control.stderr, /ExperimentalWarning/,
    `node ${process.version} no longer warns about node:sqlite even without ${flags.join(' ')}. ` +
    'The assertion below can no longer distinguish a working shebang from a missing one — this ' +
    'test needs rewriting rather than trusting.',
  );

  assert.doesNotMatch(
    shipped.stderr, /ExperimentalWarning/,
    'the CLI launched exactly as its shebang says still prints the experimental warning',
  );
  // `CONST-the-cli-exit-code-contract` is HARD: silencing a warning must not
  // move a single exit code, and the same command run both ways is the
  // narrowest way to say so.
  assert.equal(shipped.status, control.status, 'the flag changed the CLI exit code');
});
