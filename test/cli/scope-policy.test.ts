/**
 * `scopePolicy` at the surfaces a user and a model actually touch.
 *
 * `test/core/scope-policy.test.ts` holds the rule; this holds the three
 * capture surfaces spec §4b names by hand (`mycontext add`, MCP `create_item`,
 * ingest apply) and the reports whose wording changes with the policy. Every
 * assertion here runs the real command and reads what it printed, because
 * every round of this project found that reviews which ran the code caught
 * what reviews that read it did not.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import { OUTPUT_WIDTH } from '../../src/cli/commands/format.ts';
import { removeTree } from '../helpers/tmp.ts';

/** A real on-disk workspace whose config sets `policy` on `constraint`. */
function project(policy: string | null): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-policy-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  if (policy !== null) {
    writeFileSync(
      path.join(cwd, '.my_context', 'config.json'),
      JSON.stringify({ categories: { constraint: { scopePolicy: policy } } }, null, 2) + '\n',
      'utf8',
    );
  }
  return cwd;
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function itemFiles(cwd: string, type: string): string[] {
  const dir = path.join(cwd, '.my_context', 'items', type);
  return existsSync(dir) ? readdirSync(dir) : [];
}

// --- required: refused at capture, on every capture surface ------------------

test('mycontext add without --scope is refused under required, and writes nothing', () => {
  const cwd = project('required');
  try {
    const { code, out } = run(['add', 'constraint', 'Pool capped at 10', '--yes'], cwd);
    assert.equal(code, 1);
    assert.match(out, /scopePolicy "required"/);
    assert.match(out, /--scope/, 'the refusal must name the flag to pass');
    // Refused BEFORE the approval preview: a human must not be asked to
    // confirm a capture that was never going to land.
    assert.doesNotMatch(out, /about to create/);
    // No file, and no row.
    assert.deepEqual(itemFiles(cwd, 'constraint'), []);
    assert.match(run(['list', 'constraint'], cwd).out, /0 item\(s\)/);
  } finally {
    removeTree(cwd);
  }
});

test('mycontext add WITH --scope is accepted under required', () => {
  const cwd = project('required');
  try {
    const { code, out } = run(
      ['add', 'constraint', 'Pool capped at 10', '--scope', 'src/db/**', '--yes'], cwd);
    assert.equal(code, 0, out);
    assert.match(out, /created CONST-pool-capped-at-10/);
  } finally {
    removeTree(cwd);
  }
});

test('MCP create_item without a scope is refused under required, and writes nothing', () => {
  const cwd = project('required');
  try {
    assert.throws(
      () => createRegistry(cwd).call('create_item', {
        type: 'constraint', title: 'Pool capped at 10',
      }),
      (err: Error) => {
        assert.match(err.message, /scopePolicy "required"/);
        assert.match(err.message, /create_item/);
        return true;
      },
    );
    assert.deepEqual(itemFiles(cwd, 'constraint'), []);
  } finally {
    removeTree(cwd);
  }
});

test('an unscoped capture is still accepted under global and under inert', () => {
  for (const policy of ['global', 'inert']) {
    const cwd = project(policy);
    try {
      assert.equal(run(['add', 'constraint', 'Pool capped at 10', '--yes'], cwd).code, 0, policy);
    } finally {
      removeTree(cwd);
    }
  }
});

// --- inert: what the reports say ---------------------------------------------

test('the supersede preview says an unscoped item is injected nowhere under inert', () => {
  const cwd = project('inert');
  try {
    run(['add', 'constraint', 'Pool capped at 10', '--yes'], cwd);
    run(['add', 'constraint', 'Pool capped at 20', '--yes'], cwd);
    const { out } = run([
      'supersede', 'CONST-pool-capped-at-10', '--by', 'CONST-pool-capped-at-20', '--yes',
    ], cwd);
    assert.match(out, /never injected on a file/);
    assert.doesNotMatch(
      out, /injected on the first file touched/,
      'the preview must not promise an injection this policy makes impossible',
    );
  } finally {
    removeTree(cwd);
  }
});

test('review promote does not claim an unscoped item will be injected under inert', () => {
  const cwd = project('inert');
  try {
    const file = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-draft.md');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `---
id: CONST-draft
type: constraint
title: A drafted constraint
status: draft
severity: soft
always: false
---

# A drafted constraint

Body.
`, 'utf8');
    run(['rebuild'], cwd);
    const { out } = run(['review', 'promote', 'CONST-draft', '--yes'], cwd);
    assert.match(out, /never injected on a file/);
    assert.doesNotMatch(out, /unrestricted, so nothing narrows it/);
  } finally {
    removeTree(cwd);
  }
});

test('decay does not list an inert unscoped item as applying to every file', () => {
  const cwd = project('inert');
  try {
    run(['add', 'constraint', 'Pool capped at 10', '--yes'], cwd);
    const { out } = run(['decay'], cwd);
    assert.match(out, /CONST-pool-capped-at-10/, 'it is still measured as cold');
    assert.doesNotMatch(out, /^unrestricted \(/m);
  } finally {
    removeTree(cwd);
  }
});

test('decay still lists an unscoped item as unrestricted under global', () => {
  const cwd = project('global');
  try {
    run(['add', 'constraint', 'Pool capped at 10', '--yes'], cwd);
    assert.match(run(['decay'], cwd).out, /unrestricted \(1\)/);
  } finally {
    removeTree(cwd);
  }
});

test('doctor reports the policy change that rewrote no file, and stays green', () => {
  const cwd = project('inert');
  try {
    run(['add', 'constraint', 'Pool capped at 10', '--yes'], cwd);
    const { code, out } = run(['doctor'], cwd);
    assert.match(out, /scope_policy_inert/);
    assert.equal(code, 0, 'a note must not fail the run');
  } finally {
    removeTree(cwd);
  }
});

// --- the layout budget --------------------------------------------------------

test('every report fits the layout budget under each of the three policies', () => {
  for (const policy of ['global', 'required', 'inert']) {
    const cwd = project(policy);
    try {
      // The widest id this project can mint is 67 characters; `slugify` caps
      // the slug at 60 and `CONST` is the prefix here.
      const title = 'A shared cache expiry turns every miss into one simultaneous stampede';
      run(['add', 'constraint', title, '--scope', 'src/gone/**', '--yes'], cwd);
      run(['add', 'constraint', 'An unscoped constraint', '--yes'], cwd);
      for (const args of [
        ['list'], ['list', '--full'], ['decay'], ['decay', '--full'],
        ['doctor'], ['doctor', '--full'], ['status'],
      ]) {
        const over = run(args, cwd).out.split('\n').filter((l) => [...l].length > OUTPUT_WIDTH);
        assert.deepEqual(
          over, [],
          `\`${args.join(' ')}\` under scopePolicy "${policy}" printed line(s) over ` +
          `${OUTPUT_WIDTH}:\n${over.join('\n')}`,
        );
      }
    } finally {
      removeTree(cwd);
    }
  }
});
