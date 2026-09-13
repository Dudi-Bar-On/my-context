// @basis RULE-a-supersession-is-unwound-by-superseding-the-successor-back, TASK-supersede-has-no-inverse-and-edit-status-active-is-a-half, TASK-a-refusal-must-state-its-unblocking-condition-where-a-gate, STD-answered-questions-are-superseded
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * **A supersession is a dated historical claim, and no status flag un-writes
 * it.**
 *
 * Measured on a throwaway corpus 2026-09-13, before any of this existed:
 * `mycontext edit <retired id> --status active` exited 0 and changed TWO of the
 * supersession's four facts — `status` back to `active`, `valid_until` back to
 * `null` — while `superseded_by` on the retiree and `supersedes` on the
 * replacement were left standing. `update_item({status: "active"})` did the
 * same, and `mycontext doctor` reported zero errors and zero warnings on the
 * result. Measuring also found the mirror hatch: `update_item({status:
 * "superseded"})` forged a successor-less retirement that `mycontext edit
 * --status superseded` has refused by name since it shipped.
 *
 * **Four refusal paths, four assertions, because they are four code paths** —
 * un-supersede on the CLI, un-supersede on the MCP tool, forge on the MCP tool,
 * and the corrupt state that must NOT be trapped. A test that proves one proves
 * one.
 */

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-unsup-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  return cwd;
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

/** A retired item and its replacement, wired by the real `supersede` command. */
function retired(cwd: string): { old: string; successor: string } {
  assert.equal(run([
    'add', 'decision', 'the old way', '--body', 'we do it the old way',
    '--summary', 'The old approach to doing the thing.', '--yes',
  ], cwd).code, 0);
  assert.equal(run([
    'add', 'decision', 'the new way', '--body', 'we do it the new way',
    '--summary', 'The new approach to doing the thing.',
    '--distinct', 'DEC-the-old-way', '--yes',
  ], cwd).code, 0);
  assert.equal(run(['supersede', 'DEC-the-old-way', '--by', 'DEC-the-new-way', '--yes'], cwd).code, 0);
  return { old: 'DEC-the-old-way', successor: 'DEC-the-new-way' };
}

function fileOf(cwd: string, id: string): string {
  return readFileSync(path.join(cwd, '.my_context', 'items', 'decision', `${id}.md`), 'utf8');
}

/** The four facts, read off the two files rather than off an index. */
function facts(cwd: string, old: string, successor: string): Record<string, boolean> {
  const retiree = fileOf(cwd, old);
  const replacement = fileOf(cwd, successor);
  return {
    status: /^status: superseded$/m.test(retiree),
    validUntil: /^valid_until: \d{4}-\d{2}-\d{2}$/m.test(retiree),
    supersededBy: retiree.includes(`superseded_by [[${successor}]]`),
    supersedes: replacement.includes(`supersedes [[${old}]]`),
  };
}

test('all four supersession facts survive `edit --status active`, and the refusal names the successor', () => {
  const cwd = project();
  try {
    const { old, successor } = retired(cwd);
    assert.deepEqual(
      facts(cwd, old, successor),
      { status: true, validUntil: true, supersededBy: true, supersedes: true },
      'the fixture must start from a real, complete supersession',
    );

    const { code, out } = run(['edit', old, '--status', 'active', '--yes'], cwd);
    assert.equal(code, 1);
    // `TASK-a-refusal-must-state-its-unblocking-condition-where-a-gate`: the successor by name,
    // and superseding it back named as the way forward.
    assert.match(out, /DEC-the-new-way/);
    assert.match(out, /mycontext supersede DEC-the-new-way --by/);
    // Nothing was written — all four, not just the status.
    assert.deepEqual(
      facts(cwd, old, successor),
      { status: true, validUntil: true, supersededBy: true, supersedes: true },
    );
  } finally { removeTree(cwd); }
});

test('`update_item({status: "active"})` is refused on the same item, in the tool\'s own spelling', () => {
  const cwd = project();
  try {
    const { old, successor } = retired(cwd);
    const registry = createRegistry(cwd);
    assert.throws(
      () => registry.call('update_item', { id: old, status: 'active' }),
      (e: Error) => {
        assert.match(e.message, /is superseded by DEC-the-new-way/);
        // The MCP remedy must name a tool call and not a shell command — a
        // model reading this refusal is not holding a terminal.
        assert.match(e.message, /supersede_item\(\{ id: "DEC-the-new-way", by:/);
        assert.doesNotMatch(e.message, /mycontext supersede/);
        return true;
      },
    );
    assert.deepEqual(
      facts(cwd, old, successor),
      { status: true, validUntil: true, supersededBy: true, supersedes: true },
    );
  } finally { removeTree(cwd); }
});

test('`update_item({status: "superseded"})` no longer forges a successor-less retirement', () => {
  const cwd = project();
  try {
    assert.equal(run([
      'add', 'decision', 'solo', '--body', 'a lone claim',
      '--summary', 'A lone claim about the thing.', '--yes',
    ], cwd).code, 0);
    const registry = createRegistry(cwd);
    assert.throws(
      () => registry.call('update_item', { id: 'DEC-solo', status: 'superseded' }),
      (e: Error) => {
        assert.match(e.message, /"superseded" is not set through `update_item`/);
        assert.match(e.message, /supersede_item\(\{ id: "DEC-solo", by: "<replacement id>" \}\)/);
        return true;
      },
    );
    // The measured defect was not the message: it wrote `status: superseded`
    // and stamped `valid_until` with no relation at all.
    assert.match(fileOf(cwd, 'DEC-solo'), /^status: active$/m);
    assert.match(fileOf(cwd, 'DEC-solo'), /^valid_until: null$/m);
  } finally { removeTree(cwd); }
});

test('an item marked superseded with NO successor edge keeps a route out', () => {
  const cwd = project();
  try {
    const { old, successor } = retired(cwd);
    // The state the forged path used to produce, and the state a hand edit or
    // an older version can still leave behind: retired, with nothing recording
    // what replaced it. The guard must not be the one thing in the corpus with
    // no way out — `--status deprecated` is the honest name for it.
    assert.equal(run(['edit', '--unlink', `superseded_by=${successor}`, old, '--yes'], cwd).code, 1,
      'the edge itself is still refused by `retirementEdgeRefusal` — this is the finding, '
      + 'not a pass: the corrupt state cannot be reached through a supported command, '
      + 'so it is built by hand below');
    const orphan = path.join(cwd, '.my_context', 'items', 'decision', `${old}.md`);
    writeFileSync(orphan, fileOf(cwd, old).replace(/^- superseded_by .*$\n?/m, ''), 'utf8');
    assert.equal(run(['repair', '--yes'], cwd).code, 0);

    const { code } = run(['edit', old, '--status', 'deprecated', '--yes'], cwd);
    assert.equal(code, 0, 'a superseded item with no successor edge is not a supersession, '
      + 'so nothing is being un-written and the status change must pass');
    assert.match(fileOf(cwd, old), /^status: deprecated$/m);
  } finally { removeTree(cwd); }
});
