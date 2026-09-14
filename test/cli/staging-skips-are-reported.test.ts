// @basis TASK-liststaging-discards-its-skip-list-against-its-own-twenty, INV-nothing-is-dropped-silently, STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is
/**
 * **A count of staged lessons that leaves out the ones it could not read.**
 *
 * `readStagingDir` carries a twenty-line argument against exactly this, in its
 * own words: *"a status line reading 'three staged lessons' over a directory of
 * five files was indistinguishable from a correct one"*. `listStaging` is that
 * function with the second half thrown away, and both surfaces that print the
 * count — `mycontext status` and the MCP `status_report` — called it.
 *
 * ── THE ASSERTION THAT MATTERS MOST IS THE ZERO CASE ───────────────────────
 *
 * A directory holding ONE unreadable file produces no count at all, so the
 * block naming pending candidates never prints. Without a line of its own,
 * that directory is indistinguishable from an empty one — which is the state
 * the original argument calls out, at its worst.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { stagingDir, STAGING_PROTOCOL } from '../../src/lesson/staging.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import { removeTree } from '../helpers/tmp.ts';

function workspace(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-staging-skip-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0, 'the sandbox workspace did not initialize');
  return cwd;
}

/** One file the sweep reads, and one it refuses, in the same directory. */
function stageOneGoodAndOneBad(cwd: string): void {
  const dir = stagingDir(path.join(cwd, '.my_context'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'LESSON-good.json'),
    JSON.stringify({
      protocol: STAGING_PROTOCOL,
      lessonId: 'LESSON-good',
      createdAt: '2026-09-14T00:00:00Z',
      candidates: [{
        key: 'k1',
        state: 'pending',
        candidate: { title: 'A candidate that can be read', directive: 'do', body: 'b' },
      }],
    }),
    'utf8',
  );
  // Valid-looking name, unreadable content. `readStagingDir`'s first check.
  writeFileSync(path.join(dir, 'LESSON-torn.json'), '{ "candidates": [', 'utf8');
}

function statusText(cwd: string): string {
  const lines: string[] = [];
  runCli(['status'], cwd, (l) => lines.push(l));
  return lines.join('\n');
}

function statusJson(cwd: string): Record<string, unknown> {
  const lines: string[] = [];
  runCli(['status', '--json'], cwd, (l) => lines.push(l));
  return JSON.parse(lines.join('\n')) as Record<string, unknown>;
}

test('`mycontext status` names every staging file it could not read', () => {
  const cwd = workspace();
  try {
    stageOneGoodAndOneBad(cwd);
    const text = statusText(cwd);
    assert.match(text, /1 staging file\(s\) could NOT be read/);
    assert.match(text, /LESSON-torn\.json/, 'the file is not named, so nobody can go and look');
    assert.match(text, /could not be read as JSON/, 'the reason is what says junk from re-stage');
    // The readable one is still counted — a report that dropped the good half
    // to report the bad half would be a worse trade than the one it replaces.
    assert.match(text, /1 rule candidate\(s\) awaiting approval/);
  } finally { removeTree(cwd); }
});

test('a directory whose ONLY file is unreadable does not read as an empty one', () => {
  const cwd = workspace();
  try {
    const dir = stagingDir(path.join(cwd, '.my_context'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'LESSON-torn.json'), '{ "candidates": [', 'utf8');
    const text = statusText(cwd);
    assert.match(text, /1 staging file\(s\) could NOT be read/);
    assert.doesNotMatch(
      text, /rule candidate\(s\) awaiting approval/,
      'there is nothing readable to count, so only the skip line should appear',
    );
  } finally { removeTree(cwd); }
});

test('a staging directory with nothing wrong in it says nothing about skips', () => {
  // Anti-vacuity. Without this, printing the skip line unconditionally would
  // leave both tests above green.
  const cwd = workspace();
  try {
    const dir = stagingDir(path.join(cwd, '.my_context'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, 'LESSON-good.json'),
      JSON.stringify({
        protocol: STAGING_PROTOCOL,
        lessonId: 'LESSON-good',
        createdAt: '2026-09-14T00:00:00Z',
        candidates: [],
      }),
      'utf8',
    );
    assert.doesNotMatch(statusText(cwd), /could NOT be read/);
  } finally { removeTree(cwd); }
});

test('`status --json` carries the skips as a FIELD, because --json exists to be piped', () => {
  const cwd = workspace();
  try {
    stageOneGoodAndOneBad(cwd);
    const doc = statusJson(cwd);
    const skipped = doc['stagedRulesSkipped'] as { file: string; reason: string }[];
    assert.equal(Array.isArray(skipped), true, 'a trailing text line is not pipeable');
    assert.equal(skipped.length, 1);
    assert.equal(skipped[0]!.file, 'LESSON-torn.json');
    assert.match(skipped[0]!.reason, /could not be read as JSON/);
    // The field is a BARE filename and never a path: this document travels,
    // and `SkippedStaging` says so on the field itself.
    assert.doesNotMatch(skipped[0]!.file, /[\\/]/);
  } finally { removeTree(cwd); }
});

test('`status --json` reports an empty skip list rather than omitting the field', () => {
  // "nothing was left out" and "this build does not say" must be different
  // answers to a script.
  const cwd = workspace();
  try {
    const doc = statusJson(cwd);
    assert.deepEqual(doc['stagedRulesSkipped'], []);
  } finally { removeTree(cwd); }
});

test('the MCP status_report names them too, because its numbers may not drift from the CLI’s', () => {
  const cwd = workspace();
  try {
    stageOneGoodAndOneBad(cwd);
    const out = String(createRegistry(cwd).call('status_report', {}));
    assert.match(out, /1 staging file\(s\) could NOT be read/);
    assert.match(out, /LESSON-torn\.json/);
    assert.match(out, /1 rule candidate\(s\) awaiting approval/);
  } finally { removeTree(cwd); }
});
