import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildOutput, nudgeFor } from '../../src/hooks/post-tool-use.ts';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

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

test('a watched document produces a nudge naming the file, within a tight token budget', () => {
  const cwd = project(['docs/prd/**']);
  const relative = 'docs/prd/auth.md';
  const text = nudgeFor({
    tool_name: 'Write',
    tool_input: { file_path: path.join(cwd, 'docs', 'prd', 'auth.md') },
    cwd,
  }, cwd);

  assert.match(text, /docs\/prd\/auth\.md/);
  assert.match(text, /create_item/);

  // The path must appear exactly once — interpolating it twice is how a deep
  // path (long relative path) can silently blow past the token budget while
  // a short one in a test still looks fine.
  const occurrences = text.split(relative).length - 1;
  assert.equal(occurrences, 1, `path appears ${occurrences} times, expected 1`);

  // Bound the CONSTANT part of the message, not the total: the total grows
  // with the (variable-length, caller-controlled) path, so a bound on the
  // total doesn't actually constrain the message's own verbosity.
  const constantChars = text.length - relative.length;
  assert.ok(
    constantChars < 200,
    `constant portion is ${constantChars} chars — budget is ~30 tokens`,
  );
  removeTree(cwd);
});

test('an unwatched file produces nothing', () => {
  const cwd = project(['docs/prd/**']);
  const text = nudgeFor({
    tool_name: 'Edit',
    tool_input: { file_path: path.join(cwd, 'src', 'db', 'writer.ts') },
    cwd,
  }, cwd);
  assert.equal(text, '');
  removeTree(cwd);
});

test('a windows-style backslash path still matches a POSIX glob', { skip: process.platform !== 'win32' }, () => {
  // Only meaningful on win32: a backslash is an ordinary filename character
  // on POSIX, so a manually-built `${cwd}\\docs\\prd\\auth.md` string is a
  // SIBLING of cwd there, not a child — this test would fail on Linux for a
  // reason that has nothing to do with the property under test.
  const cwd = project(['docs/prd/**']);
  const text = nudgeFor({
    tool_name: 'Write',
    tool_input: { file_path: `${cwd}\\docs\\prd\\auth.md` },
    cwd,
  }, cwd);
  assert.match(text, /docs\/prd\/auth\.md/);
  removeTree(cwd);
});

test('a native child path is normalized to POSIX on every platform', () => {
  // The cross-platform half of the property above: path.join uses the
  // native separator, so this is a genuine child path on both win32 and
  // POSIX, and the nudge must always report it with forward slashes.
  const cwd = project(['docs/prd/**']);
  const text = nudgeFor({
    tool_name: 'Write',
    tool_input: { file_path: path.join(cwd, 'docs', 'prd', 'auth.md') },
    cwd,
  }, cwd);
  assert.match(text, /docs\/prd\/auth\.md/);
  removeTree(cwd);
});

test('a file outside the repository produces nothing, even under a catch-all watch pattern', () => {
  // watchedDocs is '**' here specifically so this test cannot pass merely
  // because the escaped path fails the glob — the '..' guard itself must do
  // the work, which is the property this test names.
  const cwd = project(['**']);
  const outside = path.join(tmpdir(), 'docs', 'prd', 'elsewhere.md');
  assert.equal(nudgeFor({ tool_name: 'Write', tool_input: { file_path: outside }, cwd }, cwd), '');
  removeTree(cwd);
});

test('a cross-drive or UNC path never leaks into the nudge', { skip: process.platform !== 'win32' }, () => {
  // On win32, path.relative(repoRoot, target) returns an ABSOLUTE path (not
  // '..'-prefixed) when the two paths are on different drives/roots. A
  // guard that only checks for a leading '..' misses this entirely and
  // leaks the foreign absolute path into the model's context.
  const cwd = project(['**']);
  const otherDrive = cwd[0].toUpperCase() === 'C' ? 'D' : 'C';
  const candidates = [
    `${otherDrive}:\\secrets\\notes.md`,
    '\\\\server\\share\\notes.md',
    `${otherDrive}:/other/repo/README.md`,
  ];
  for (const file_path of candidates) {
    assert.equal(
      nudgeFor({ tool_name: 'Write', tool_input: { file_path }, cwd }, cwd),
      '',
      `expected no nudge for ${file_path}`,
    );
  }
  removeTree(cwd);
});

test('my_context items never nudge about themselves', () => {
  const cwd = project(['**/*.md']);
  const item = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-a.md');
  assert.equal(nudgeFor({ tool_name: 'Write', tool_input: { file_path: item }, cwd }, cwd), '');
  removeTree(cwd);
});

test('the self-nudge guard covers a nested workspace, the .my-context spelling and MultiEdit', () => {
  const cwd = project(['**']);

  const nested = path.join(cwd, 'packages', 'foo', '.my_context', 'items', 'constraint', 'CONST-a.md');
  assert.equal(nudgeFor({ tool_name: 'Write', tool_input: { file_path: nested }, cwd }, cwd), '');

  const altSpelling = path.join(cwd, '.my-context', 'items', 'constraint', 'CONST-b.md');
  assert.equal(nudgeFor({ tool_name: 'Write', tool_input: { file_path: altSpelling }, cwd }, cwd), '');

  // MultiEdit is watched (unlike PreToolUse's Read|Edit|Write deny matcher)
  // specifically so a MultiEdit into a nested workspace is caught too.
  const nestedMultiEdit = path.join(cwd, 'packages', 'foo', '.my_context', 'items', 'constraint', 'CONST-c.md');
  assert.equal(
    nudgeFor({ tool_name: 'MultiEdit', tool_input: { file_path: nestedMultiEdit }, cwd }, cwd),
    '',
  );
  removeTree(cwd);
});

test('a tool other than Write or Edit produces nothing', () => {
  const cwd = project(['docs/prd/**']);
  const file = path.join(cwd, 'docs', 'prd', 'auth.md');
  assert.equal(nudgeFor({ tool_name: 'Read', tool_input: { file_path: file }, cwd }, cwd), '');
  assert.equal(nudgeFor({ tool_name: 'Bash', tool_input: {} }, cwd), '');
  removeTree(cwd);
});

test('NotebookEdit is not a watched tool, even for a path that would otherwise match', () => {
  const cwd = project(['docs/prd/**']);
  const file = path.join(cwd, 'docs', 'prd', 'auth.ipynb');
  assert.equal(
    nudgeFor({ tool_name: 'NotebookEdit', tool_input: { file_path: file }, cwd }, cwd),
    '',
  );
  removeTree(cwd);
});

test('no workspace, malformed input and a missing path all fail open', () => {
  const bare = mkdtempSync(path.join(tmpdir(), 'myctx-bare-'));
  assert.equal(nudgeFor({
    tool_name: 'Write', tool_input: { file_path: path.join(bare, 'docs', 'prd', 'a.md') }, cwd: bare,
  }, bare), '');
  assert.equal(nudgeFor({}, bare), '');
  assert.equal(nudgeFor({ tool_name: 'Write', tool_input: {} }, bare), '');
  removeTree(bare);
});

test('a corrupt config fails open rather than throwing', () => {
  const cwd = project();
  writeFileSync(path.join(cwd, '.my_context', 'config.json'), '{ not json');
  assert.equal(nudgeFor({
    tool_name: 'Write', tool_input: { file_path: path.join(cwd, 'docs', 'prd', 'a.md') }, cwd,
  }, cwd), '');
  removeTree(cwd);
});

test('the default watchedDocs cover spec and plan directories', () => {
  const cwd = project();
  const file = path.join(cwd, 'docs', 'superpowers', 'specs', '2026-08-12-design.md');
  assert.match(nudgeFor({ tool_name: 'Write', tool_input: { file_path: file }, cwd }, cwd), /specs/);
  removeTree(cwd);
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
