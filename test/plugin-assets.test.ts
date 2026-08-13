import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
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
  const text = read('skills', 'my-context', 'SKILL.md');
  assert.match(text, /^---\nname: my-context\n/);
  assert.match(text, /description:/);
  for (const tool of ['create_item', 'query_items', 'get_item', 'mycontext_help']) {
    assert.match(text, new RegExp(tool), `the skill should mention ${tool}`);
  }
});

/** It is loaded into every session that touches the plugin, so it pays rent. */
test('the skill stays small enough to load into every session', () => {
  const text = read('skills', 'my-context', 'SKILL.md');
  assert.ok(text.length <= 4000, `SKILL.md is ${text.length} chars`);
});
