import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { createItem, updateItem, type MutationContext } from '../../src/core/mutate.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { Store } from '../../src/core/store.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';

/**
 * `updateItem`'s two refusals to a non-human caller, asserted on the messages
 * actually thrown rather than on the source file, which carries several
 * paragraphs of comment about what those messages used to say.
 *
 * The correction they encode: both used to deter a hand edit by naming its
 * consequence — "leaves the item failing its own recorded checksum". That was
 * true when written and stopped being true in the same round, when `mycontext
 * repair` shipped: `repair` re-stamps the checksum, so hand edit + `repair`
 * is a working human route, it is the pairing the README documents, and it
 * leaves nothing behind. A deterrent that no longer deters is this project's
 * characteristic defect, so the messages now name the route AND refuse it to
 * the caller reading them. Both halves are pinned here, because either alone
 * is a different failure: the route without the prohibition is an instruction
 * to the one caller the `PreToolUse` write-deny exists to stop, and the
 * prohibition without the route is back to inventing a reason.
 */

function fixture(): { ctx: MutationContext; close: () => void } {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-guardmsg-'));
  runCli(['init'], cwd, () => {});
  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  rebuild(store, { project: ws.projectRoot as string }, ws.config);
  return {
    ctx: { root: ws.projectRoot as string, store, config: resolveConfig({}) },
    close: () => { store.close(); rmSync(cwd, { recursive: true, force: true }); },
  };
}

/** An `active`, governing normative item — what both refusals gate on. */
function governing(ctx: MutationContext): string {
  const { id } = createItem(ctx, {
    type: 'constraint', title: 'The pool is capped at twenty', body: 'Because.', origin: 'human',
  });
  return id;
}

function refusalFor(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  assert.fail('the mutation must have been refused');
}

for (const [label, patch] of [
  ['always', { always: true }],
  ['severity', { severity: 'hard' as const }],
  ['scope', { scope: ['src/**'] }],
] as [string, Record<string, unknown>][]) {
  test(`the ${label} refusal names the repair route and forbids the caller from taking it`, () => {
    const f = fixture();
    try {
      const id = governing(f.ctx);
      const message = refusalFor(() => updateItem(f.ctx, { id, origin: 'agent', ...patch }));

      assert.match(message, /cannot change the .* of a governing/);
      assert.match(
        message, /`mycontext repair`/,
        'the route a human actually has must be named, not replaced with a reason it is impossible',
      );
      assert.doesNotMatch(
        message, /failing its own recorded checksum/,
        '`mycontext repair` re-stamps that checksum, so this is no longer what a hand edit costs',
      );
      assert.match(
        message, /Do not do that yourself/,
        'naming the route without forbidding it turns this into an instruction to the caller',
      );
      assert.match(message, /Ask the user/);
    } finally {
      f.close();
    }
  });
}

test('the status refusal on a governing item names the same route and the same prohibition', () => {
  const f = fixture();
  try {
    const id = governing(f.ctx);
    const message = refusalFor(
      () => updateItem(f.ctx, { id, origin: 'agent', status: 'deprecated' }),
    );
    assert.match(message, /cannot change the status of a normative item/);
    assert.match(message, /`mycontext repair`/);
    assert.doesNotMatch(message, /failing its own recorded checksum/);
    assert.match(message, /Do not do that yourself/);
  } finally {
    f.close();
  }
});

test('a draft is still sent to review promote, not to the hand-edit route', () => {
  // The branch that has a real command must keep pointing at it — a message
  // that offered `repair` here would send a human around a working verb.
  const f = fixture();
  try {
    const { id } = createItem(f.ctx, {
      type: 'constraint', title: 'A drafted constraint', body: 'b', origin: 'agent',
    });
    const message = refusalFor(
      () => updateItem(f.ctx, { id, origin: 'agent', status: 'active' }),
    );
    assert.match(message, /mycontext review promote/);
    assert.doesNotMatch(message, /`mycontext repair`/);
  } finally {
    f.close();
  }
});
