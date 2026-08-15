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
import { removeTree } from '../helpers/tmp.ts';

/**
 * `updateItem`'s two refusals to a non-human caller, asserted on the messages
 * actually thrown rather than on the source file, which carries several
 * paragraphs of comment about what those messages used to say.
 *
 * The correction they encode, and it has now been made twice.
 *
 * First: both used to deter a hand edit by naming its consequence — "leaves
 * the item failing its own recorded checksum" — which stopped being true the
 * round `mycontext repair` shipped. So they named hand edit + `repair` as the
 * human route and forbade the caller from taking it.
 *
 * Second, and this is what these assertions pin: `mycontext edit` shipped, and
 * with it `pin`/`unpin`/`harden`/`soften`. Every one of these refusals now has
 * a SUPPORTED command to name, so the main clause "no command makes this
 * change on an already-governing item" became false and the remedy became the
 * one route this project's documentation is not allowed to instruct. Both
 * messages name `mycontext edit` instead, and neither mentions a hand edit.
 *
 * The prohibition is pinned alongside the route, because either half alone is
 * a different failure: the route without it is an instruction to the one
 * caller the boundary exists to stop, and the prohibition without a route is
 * back to inventing a reason.
 */

function fixture(): { ctx: MutationContext; close: () => void } {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-guardmsg-'));
  runCli(['init'], cwd, () => {});
  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  rebuild(store, { project: ws.projectRoot as string }, ws.config);
  return {
    ctx: { root: ws.projectRoot as string, store, config: resolveConfig({}) },
    close: () => { store.close(); removeTree(cwd); },
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

/**
 * Every phrasing by which a message could send its reader to hand-edit an
 * item's frontmatter, enumerated in one place so a reworded instruction does
 * not slip past a phrase-specific check. Applied to both refusals below.
 *
 * `mycontext repair` is included: it is only ever a route when paired with a
 * hand edit, so a refusal that names it is naming that pairing. `repair`'s own
 * legitimate use — re-stamping after a deliberate hand edit — belongs in the
 * README's trust-boundary section, not in a message telling an agent what a
 * human should do next.
 */
const HAND_EDIT_ROUTES: [RegExp, string][] = [
  [/`mycontext repair`/, 'repair is only a route in the hand-edit pairing'],
  [/in the Markdown file/, 'a hand edit named as what a human can do'],
  [/failing its own recorded checksum/, 'a deterrent `repair` removed'],
  [/edit .{0,20}directly/, 'a hand edit named as an equivalent route'],
];

function assertNoHandEditRoute(message: string): void {
  for (const [pattern, why] of HAND_EDIT_ROUTES) {
    assert.doesNotMatch(message, pattern, `${why}:\n${message}`);
  }
}

for (const [label, patch, flag] of [
  ['always', { always: true }, '--always'],
  ['severity', { severity: 'hard' as const }, '--severity'],
  ['scope', { scope: ['src/**'] }, '--scope'],
] as [string, Record<string, unknown>, string][]) {
  test(`the ${label} refusal names \`mycontext edit ${flag}\` and forbids the caller from running it`, () => {
    const f = fixture();
    try {
      const id = governing(f.ctx);
      const message = refusalFor(() => updateItem(f.ctx, { id, origin: 'agent', ...patch }));

      assert.match(message, /cannot change the .* of a governing/);
      // The route a human actually has, naming the FLAG as well as the
      // command: `mycontext edit <id>` with no flag changes nothing, and a
      // refusal about `always` that pointed at `--severity` would be worse
      // than one that pointed at nothing.
      assert.match(
        message, new RegExp(`\`mycontext edit ${id} ${flag} `),
        'the supported command AND the flag that makes this change must be named',
      );
      assert.match(
        message, /`mycontext pin`\/`unpin` and `harden`\/`soften`/,
        'the named forms reach the same write, so a caller told "never edit" must be told this too',
      );
      assertNoHandEditRoute(message);
      assert.match(
        message, /Do not run it yourself/,
        'naming the route without forbidding it turns this into an instruction to the caller',
      );
      assert.match(message, /Ask the user/);
    } finally {
      f.close();
    }
  });
}

test('the status refusal on a governing item names `mycontext edit --status` and `supersede`', () => {
  const f = fixture();
  try {
    const id = governing(f.ctx);
    const message = refusalFor(
      () => updateItem(f.ctx, { id, origin: 'agent', status: 'deprecated' }),
    );
    assert.match(message, /cannot change the status of a normative item/);
    assert.match(message, new RegExp(`\`mycontext edit ${id} --status <name>\``));
    // `superseded` is the one status `edit` refuses, so a message that named
    // only `edit` would leave a reader with no route for the retirement case
    // and no reason why.
    assert.match(message, new RegExp(`\`mycontext supersede ${id} --by <id>\``));
    assertNoHandEditRoute(message);
    assert.match(message, /Do not run either yourself/);
  } finally {
    f.close();
  }
});

test('a draft is still sent to review promote, not to `edit`', () => {
  // The branch that has a NARROWER real command must keep pointing at it: a
  // draft's status change is `review promote`, which is the verb that carries
  // the draft gate. Offering `edit --status active` here would route a human
  // around the queue this project exists to keep.
  const f = fixture();
  try {
    const { id } = createItem(f.ctx, {
      type: 'constraint', title: 'A drafted constraint', body: 'b', origin: 'agent',
    });
    const message = refusalFor(
      () => updateItem(f.ctx, { id, origin: 'agent', status: 'active' }),
    );
    assert.match(message, /mycontext review promote/);
    assert.doesNotMatch(message, /mycontext edit/);
    assertNoHandEditRoute(message);
  } finally {
    f.close();
  }
});
