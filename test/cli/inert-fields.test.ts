/**
 * The inert-field refusal (spec §3) at the surfaces a user and a model
 * actually touch.
 *
 * `test/core/inert-fields.test.ts` holds the rule. This holds every write
 * surface that can carry `--always`/`--severity` to a rationale item, because
 * every round of this project found that reviews which ran the code caught
 * what reviews that read it did not. The surfaces, and how each reaches the
 * refusal:
 *
 *   mycontext add          → createItem. Its confirmation prompt fires only on
 *                            the NORMATIVE tier and the refusal only on the
 *                            rationale one, so the two can never overlap and
 *                            it needs no early check of its own — unlike
 *                            `scopeRequirementError`, whose refusal and prompt
 *                            do overlap. Pinned below by asserting the refusal
 *                            prints no prompt.
 *   MCP create_item        → createItem.
 *   MCP update_item        → updateItem.
 *   review promote         → updateItem, but AFTER printing a preview and
 *                            asking for confirmation, so it takes its own
 *                            early call. Without it a human is shown "always
 *                            yes — injected in full at every session start"
 *                            for an item that will never be injected, and is
 *                            asked to approve a promotion that cannot land.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import { removeTree } from '../helpers/tmp.ts';

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-inert-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  return cwd;
}

function withProject(fn: (cwd: string) => void): void {
  const cwd = project();
  try {
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
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

/** A rationale-tier draft, written straight to disk the way
 * `test/cli/review.test.ts` plants its own — `create_item` has no `status`
 * argument, and a draft is what `review promote` acts on. */
function rationaleDraft(cwd: string, id: string, always = false): void {
  const file = path.join(cwd, '.my_context', 'items', 'lesson', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: lesson
title: Retries need jitter
status: draft
severity: soft
always: ${always}
origin: ingest
---

# Retries need jitter

Seen in production.
`, 'utf8');
}

// --- mycontext add -----------------------------------------------------------

test('mycontext add --severity hard on a rationale category is refused, and writes nothing', () => {
  withProject((cwd) => {
    const { code, out } = run(['add', 'lesson', 'Retries need jitter', '--severity', 'hard'], cwd);
    assert.equal(code, 1, out);
    assert.match(out, /severity/);
    assert.match(out, /only governs on the normative tier/);
    assert.match(out, /Nothing was written/);
    // Rationale captures are ungated, so there is no prompt to precede — and
    // the refusal must not invent one.
    assert.doesNotMatch(out, /about to create/);
    assert.deepEqual(itemFiles(cwd, 'lesson'), []);
    assert.match(run(['list', 'lesson'], cwd).out, /0 item\(s\)/);
  });
});

test('mycontext add --severity hard on a normative category still works', () => {
  withProject((cwd) => {
    const { code, out } = run(
      ['add', 'rule', 'Never log secrets', '--severity', 'hard', '--yes'], cwd);
    assert.equal(code, 0, out);
    assert.match(out, /created RULE-never-log-secrets/);
  });
});

// --- MCP ---------------------------------------------------------------------

test('create_item refuses always on a rationale item', () => {
  withProject((cwd) => {
    assert.throws(
      () => createRegistry(cwd).call('create_item', {
        type: 'decision', title: 'Use SQLite', always: true,
      }),
      (err: Error) => {
        assert.match(err.message, /always/);
        assert.match(err.message, /only governs on the normative tier/);
        return true;
      },
    );
    assert.deepEqual(itemFiles(cwd, 'decision'), []);
  });
});

test('update_item refuses always on a rationale item', () => {
  withProject((cwd) => {
    const registry = createRegistry(cwd);
    registry.call('create_item', { type: 'lesson', title: 'A rationale item', body: 'b' });
    assert.throws(
      () => registry.call('update_item', { id: 'LESSON-a-rationale-item', always: true }),
      (err: Error) => {
        assert.match(err.message, /only governs on the normative tier/);
        assert.match(err.message, /Nothing was changed/);
        return true;
      },
    );
    // The claim in that message, checked rather than trusted.
    assert.match(registry.call('get_item', { id: 'LESSON-a-rationale-item' }), /always: false/);
  });
});

test('update_item still accepts always on a normative DRAFT — that gate is not this one', () => {
  withProject((cwd) => {
    const registry = createRegistry(cwd);
    // An agent's normative capture is forced to `draft` (`trustedStatus`), and
    // a draft governs nothing, so `always` is neither guarded nor inert there.
    registry.call('create_item', { type: 'constraint', title: 'Pool capped at 20', body: 'b' });
    registry.call('update_item', { id: 'CONST-pool-capped-at-20', always: true });
    assert.match(registry.call('get_item', { id: 'CONST-pool-capped-at-20' }), /always: true/);
  });
});

// --- review promote ----------------------------------------------------------

test('review promote --always on a rationale draft is refused BEFORE the preview', () => {
  withProject((cwd) => {
    rationaleDraft(cwd, 'LESSON-jitter');
    const { code, out } = run(['review', 'promote', 'LESSON-jitter', '--always', '--yes'], cwd);
    assert.equal(code, 1, out);
    assert.match(out, /only governs on the normative tier/);
    // The defect this closes: the preview says "always yes … injected in full
    // at every session start", which would never happen. A human must not be
    // shown that, nor asked to approve a promotion that cannot do what it says.
    assert.doesNotMatch(out, /about to promote/);
    assert.doesNotMatch(out, /every session start/);
    // And the draft is still a draft.
    assert.match(run(['review'], cwd).out, /LESSON-jitter/);
  });
});

test('review promote --severity hard on a rationale draft is refused before the preview', () => {
  withProject((cwd) => {
    rationaleDraft(cwd, 'LESSON-jitter');
    const { code, out } = run(
      ['review', 'promote', 'LESSON-jitter', '--severity', 'hard', '--yes'], cwd);
    assert.equal(code, 1, out);
    assert.match(out, /severity/);
    assert.match(out, /only governs on the normative tier/);
    assert.doesNotMatch(out, /about to promote/);
  });
});

test('review promote of a rationale draft without the flags still works', () => {
  withProject((cwd) => {
    rationaleDraft(cwd, 'LESSON-jitter');
    const { code, out } = run(['review', 'promote', 'LESSON-jitter', '--yes'], cwd);
    assert.equal(code, 0, out);
    assert.match(out, /LESSON-jitter is now active/);
  });
});

test('review promote --always on a NORMATIVE draft is untouched', () => {
  withProject((cwd) => {
    const registry = createRegistry(cwd);
    registry.call('create_item', { type: 'constraint', title: 'Pool capped at 20', body: 'b' });
    const { code, out } = run(
      ['review', 'promote', 'CONST-pool-capped-at-20', '--always', '--yes'], cwd);
    assert.equal(code, 0, out);
    assert.match(out, /pinned via --always/);
  });
});

test('a rationale draft that already stores always promotes, and is told the truth', () => {
  // The case the refusal deliberately does NOT cover: `--always` can only ever
  // SET the flag, so refusing a draft that arrived already carrying it would
  // strand the item with no way forward. It promotes — and neither the preview
  // nor the completion line may claim an injection that will not happen.
  withProject((cwd) => {
    rationaleDraft(cwd, 'LESSON-jitter', true);
    const { code, out } = run(['review', 'promote', 'LESSON-jitter', '--yes'], cwd);
    assert.equal(code, 0, out);
    assert.match(out, /about to promote/);
    assert.match(out, /always {3}yes \(carried by the draft itself\) — INERT/);
    assert.match(out, /never injected in full/);
    assert.doesNotMatch(
      out, /injected in full at every session start/,
      'the preview claimed a pin that select never honours',
    );
  });
});

test('the promote preview still tells a NORMATIVE draft it will be pinned', () => {
  // The other direction: a phrase that never claims a pin is as wrong as one
  // that always does.
  withProject((cwd) => {
    const registry = createRegistry(cwd);
    registry.call('create_item', { type: 'constraint', title: 'Pool capped at 20', body: 'b' });
    const { out } = run(
      ['review', 'promote', 'CONST-pool-capped-at-20', '--always', '--yes'], cwd);
    assert.match(out, /injected in full at every session start/);
  });
});
