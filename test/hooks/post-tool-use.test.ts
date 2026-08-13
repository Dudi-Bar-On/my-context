import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildOutput, nudgeFor } from '../../src/hooks/post-tool-use.ts';
import { runCli } from '../../src/cli/index.ts';

function project(watchedDocs?: string[]): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-nudge-'));
  runCli(['init'], cwd, () => {});
  if (watchedDocs) {
    writeFileSync(
      path.join(cwd, '.my_context', 'config.json'),
      JSON.stringify({ profile: 'standard', watchedDocs }, null, 2) + '\n',
    );
  }
  return cwd;
}

test('a watched document produces a nudge naming the file', () => {
  const cwd = project(['docs/prd/**']);
  const text = nudgeFor({
    tool_name: 'Write',
    tool_input: { file_path: path.join(cwd, 'docs', 'prd', 'auth.md') },
    cwd,
  }, cwd);

  assert.match(text, /docs\/prd\/auth\.md/);
  assert.match(text, /create_item/);
  assert.ok(text.length < 320, `nudge is ${text.length} chars — budget is ~30 tokens`);
  rmSync(cwd, { recursive: true, force: true });
});

test('an unwatched file produces nothing', () => {
  const cwd = project(['docs/prd/**']);
  const text = nudgeFor({
    tool_name: 'Edit',
    tool_input: { file_path: path.join(cwd, 'src', 'db', 'writer.ts') },
    cwd,
  }, cwd);
  assert.equal(text, '');
  rmSync(cwd, { recursive: true, force: true });
});

test('a Windows-style path still matches a POSIX glob', () => {
  const cwd = project(['docs/prd/**']);
  const text = nudgeFor({
    tool_name: 'Write',
    tool_input: { file_path: `${cwd}\\docs\\prd\\auth.md` },
    cwd,
  }, cwd);
  assert.match(text, /docs\/prd\/auth\.md/);
  rmSync(cwd, { recursive: true, force: true });
});

test('a file outside the repository produces nothing', () => {
  const cwd = project(['docs/prd/**']);
  const outside = path.join(tmpdir(), 'docs', 'prd', 'elsewhere.md');
  assert.equal(nudgeFor({ tool_name: 'Write', tool_input: { file_path: outside }, cwd }, cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('my_context items never nudge about themselves', () => {
  const cwd = project(['**/*.md']);
  const item = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-a.md');
  assert.equal(nudgeFor({ tool_name: 'Write', tool_input: { file_path: item }, cwd }, cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('a tool other than Write or Edit produces nothing', () => {
  const cwd = project(['docs/prd/**']);
  const file = path.join(cwd, 'docs', 'prd', 'auth.md');
  assert.equal(nudgeFor({ tool_name: 'Read', tool_input: { file_path: file }, cwd }, cwd), '');
  assert.equal(nudgeFor({ tool_name: 'Bash', tool_input: {} }, cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('no workspace, malformed input and a missing path all fail open', () => {
  const bare = mkdtempSync(path.join(tmpdir(), 'myctx-bare-'));
  assert.equal(nudgeFor({
    tool_name: 'Write', tool_input: { file_path: path.join(bare, 'docs', 'prd', 'a.md') }, cwd: bare,
  }, bare), '');
  assert.equal(nudgeFor({}, bare), '');
  assert.equal(nudgeFor({ tool_name: 'Write', tool_input: {} }, bare), '');
  rmSync(bare, { recursive: true, force: true });
});

test('a corrupt config fails open rather than throwing', () => {
  const cwd = project();
  writeFileSync(path.join(cwd, '.my_context', 'config.json'), '{ not json');
  assert.equal(nudgeFor({
    tool_name: 'Write', tool_input: { file_path: path.join(cwd, 'docs', 'prd', 'a.md') }, cwd,
  }, cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('the default watchedDocs cover spec and plan directories', () => {
  const cwd = project();
  const file = path.join(cwd, 'docs', 'superpowers', 'specs', '2026-08-12-design.md');
  assert.match(nudgeFor({ tool_name: 'Write', tool_input: { file_path: file }, cwd }, cwd), /specs/);
  rmSync(cwd, { recursive: true, force: true });
});

test('buildOutput emits the documented hook JSON on one line', () => {
  const line = buildOutput('You edited docs/prd/auth.md.');
  const parsed = JSON.parse(line) as {
    hookSpecificOutput: { hookEventName: string; additionalContext: string };
  };
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'PostToolUse');
  assert.equal(parsed.hookSpecificOutput.additionalContext, 'You edited docs/prd/auth.md.');
  assert.equal(line.includes('\n'), false);
});

test('buildOutput emits nothing for an empty nudge', () => {
  assert.equal(buildOutput(''), '');
});
