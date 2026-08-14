import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SERVER_INFO } from '../src/mcp/protocol.ts';
import { TOOL_NAMES } from '../src/mcp/tools.ts';

const ROOT = path.join(import.meta.dirname, '..');

function read(...parts: string[]): string {
  return readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');
}

/**
 * The /LoadMyContext command and the skill are the only parts of this plugin
 * that Claude Code loads from the filesystem rather than from the MCP server,
 * so nothing else can notice if they go missing — which is exactly what
 * happened once already, when both were handed between plans and neither
 * plan shipped them. These tests are the notice.
 */
test('the /LoadMyContext command exists and calls the load_context tool', () => {
  const text = read('commands', 'LoadMyContext.md');
  assert.match(text, /^---\n/, 'the command file has frontmatter');
  assert.match(text, /description:/);
  assert.match(text, /load_context/);
  assert.ok(TOOL_NAMES.includes('load_context'), 'the tool the command calls is registered');
});

test('the /LoadMyContext command discloses the compaction caveat', () => {
  assert.match(read('commands', 'LoadMyContext.md'), /not restored after a compaction/i);
});

test('the skill exists, is frontmatter-shaped, and names the tools it teaches', () => {
  const text = read('skills', 'mycontext', 'SKILL.md');
  assert.match(text, /^---\nname: mycontext\n/);
  assert.match(text, /description:/);
  for (const tool of ['create_item', 'query_items', 'get_item', 'mycontext_help']) {
    assert.match(text, new RegExp(tool), `the skill should mention ${tool}`);
  }
});

/**
 * The plugin's NAME is load-bearing in a way nothing in this repo could
 * notice: Claude Code namespaces every plugin command as
 * `<plugin.json name>:<command>`, so `my-context` here would have made the
 * user type `/my-context:add-requirement` while the CLI binary, the `.mcp.json`
 * server key and every doc said `mycontext`. Four spellings of one identity,
 * three of them agreeing and the load-bearing one differing.
 */
test('the plugin name, the MCP server key, the CLI binary and SERVER_INFO are all "mycontext"', () => {
  const plugin = JSON.parse(read('.claude-plugin', 'plugin.json')) as { name: string };
  const mcp = JSON.parse(read('.mcp.json')) as { mcpServers: Record<string, unknown> };
  const pkg = JSON.parse(read('package.json')) as { name: string; bin: Record<string, string> };

  assert.equal(plugin.name, 'mycontext', 'plugin.json — this is what namespaces /mycontext:… commands');
  assert.deepEqual(Object.keys(mcp.mcpServers), ['mycontext'], '.mcp.json server key');
  assert.deepEqual(Object.keys(pkg.bin), ['mycontext'], 'the CLI binary');
  assert.equal(pkg.name, 'mycontext');
  assert.equal(SERVER_INFO.name, 'mycontext', 'the name the MCP server reports at initialize');
});

/**
 * `plugin.json` must NOT declare a `commands` field: per the plugins
 * reference, `commands` REPLACES the default `commands/` scan rather than
 * adding to it, so declaring one path silently unloads every generated
 * command file not listed under it.
 */
test('plugin.json does not declare a commands path that would replace the default scan', () => {
  const plugin = JSON.parse(read('.claude-plugin', 'plugin.json')) as Record<string, unknown>;
  assert.equal(Object.hasOwn(plugin, 'commands'), false);
});

/**
 * Task 9's escalation, closed the only way this plugin actually can: by
 * saying so. The full sequence `lesson` → `lesson-stage --stdin` →
 * `lesson-accept <id> <key>` is the documented happy path, every leg is
 * Bash-reachable, and none of it involves a human — so "a human approved
 * this rule" is true only when the harness's Bash surface excludes those
 * commands. Nothing in this repo can enforce that (a plugin's own
 * `settings.json` supports only `agent` and `subagentStatusLine`), so the
 * deliverable is an honest, findable statement in all three places a reader
 * arrives from: the skill the model loads, the README a user reads, and the
 * help topic that describes promotion.
 *
 * These assertions exist because the statement is the whole mitigation. A
 * doc paragraph with no test is how this project has lost claims before.
 */
test('the approval boundary is stated honestly wherever promotion is described', () => {
  const skill = read('skills', 'mycontext', 'SKILL.md');
  assert.match(skill, /Nothing in this plugin\s*\n?stops an agent with a shell/);
  assert.match(skill, /never promote, discard or accept on the user's behalf/i);

  const readme = read('README.md');
  assert.match(readme, /your Bash permissions, and nothing else/);
  assert.match(readme, /not\*{0,2} a security boundary/);
  assert.match(readme, /A plugin cannot ship permission rules/);
  // The deny rules it offers, and the honest limit of what they buy.
  assert.match(readme, /Bash\(mycontext lesson-accept \*\)/);
  assert.match(readme, /they do not make one impossible/);

  const workflow = read('src', 'help', 'topics', 'workflow.md');
  assert.match(workflow, /not by enforcement/);
  assert.match(workflow, /`--yes` is an audit trail, not a lock/);
});

/** It is loaded into every session that touches the plugin, so it pays rent. */
test('the skill stays small enough to load into every session', () => {
  const text = read('skills', 'mycontext', 'SKILL.md');
  assert.ok(text.length <= 4000, `SKILL.md is ${text.length} chars`);
});
