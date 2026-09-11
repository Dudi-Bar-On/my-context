// @basis RULE-a-delegated-worker-runs-no-git-command-that-touches-the, TASK-seed-the-store-and-migrate-the-rules-that-already-exist, TASK-the-store-is-delivered-at-every-door-an-agent-starts-through
/**
 * **THE MIGRATION'S ONE UNFORGIVING CONDITION: the rule that stops a lane
 * running `git checkout --` on this shared tree must still REACH a lane.**
 *
 * `plan:store seq:4` moved `RULE-a-delegated-worker-runs-no-git-command-that-
 * touches-the` out of the corpus and into the product rule store as
 * `never-a-git-command-that-writes-the-shared-tree`. Before the move it
 * arrived because it was a corpus item. After the move it has to arrive
 * because it is a store entry, and **nothing about the move guarantees that**:
 * the entry is `developer` tier, and a developer-tier entry is filtered out of
 * every workspace that is not this repository (`rules/store.ts` · `loadRules`).
 * One wrong answer from `workspaceIsMyContext` and a hard rule governing lanes
 * would reach no lane at all — which is strictly worse than leaving it in the
 * corpus, because the corpus at least still had it.
 *
 * This is not hypothetical and it is not a small blast radius. **Lanes have
 * violated this rule twice in this repository, and one of them destroyed its
 * own phase's work with `git checkout -- <file>` on two consecutive days.**
 *
 * ── WHY IT ASSERTS THE DOOR AND NOT THE DIRECTORY ──────────────────────────
 *
 * "The store contains it" is the claim that would have passed on the day the
 * tier filter was wrong. So the load-bearing assertions run the two things a
 * lane actually meets: `deliverAtDoor` with `door: 'subagent-start'`, and
 * `buildSubagentStartOutput` — the hook binary's own function, against THIS
 * repository, resolving the store the way an installed package resolves it.
 *
 * ── WHY IT RUNS AGAINST THE REAL WORKSPACE, WHICH NO OTHER TEST HERE DOES ──
 *
 * `workspaceIsMyContext` compares the workspace's parent against
 * `packageRoot()`, so the developer tier is in force in EXACTLY ONE directory
 * on the machine and a temporary workspace cannot stand in for it. A fixture
 * store under `MYCONTEXT_RULES_DIR` would prove the renderer works and prove
 * nothing about the entry that shipped. The cost is accepted and bounded: the
 * door appends one row to `.my_context/.rules/delivered.jsonl` and one audit
 * record, both in directories this product keeps a `*` .gitignore in, and it
 * writes no item and no entry.
 *
 * ── WHAT MAKES IT GO RED ───────────────────────────────────────────────────
 *
 * Reverting the migration. That is intended: if the entry goes away and the
 * corpus item comes back, this file is wrong about where the rule lives and
 * should say so loudly rather than pass on a store that no longer holds it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Store } from '../../src/core/store.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { RETIRED_STATUSES } from '../../src/core/select.ts';
import { entriesDir, loadRules } from '../../src/rules/store.ts';
import { deliverAtDoor, renderEntry, workspaceIsMyContext } from '../../src/rules/deliver.ts';
import { buildSubagentStartOutput } from '../../src/hooks/subagent-start.ts';
import type { Entry } from '../../src/rules/schema.ts';

/** The repository itself — `test/rules/` is two levels down. */
const REPO = path.resolve(import.meta.dirname, '..', '..');
const PROJECT_ROOT = path.join(REPO, '.my_context');

const ENTRY_ID = 'never-a-git-command-that-writes-the-shared-tree';
const SOURCE_ID = 'RULE-a-delegated-worker-runs-no-git-command-that-touches-the';
const POINTER_ID = `DEC-moved-${ENTRY_ID}`;

/** The entry as the SHIPPED store holds it, or `null`. */
function shipped(): Entry | null {
  return loadRules(entriesDir(), true).entries.find((e) => e.id === ENTRY_ID) ?? null;
}

test('the no-git rule is in the SHIPPED store', () => {
  const entry = shipped();
  assert.ok(
    entry !== null,
    `${ENTRY_ID} is not in ${entriesDir()}. The rule that stops a lane writing this shared tree `
    + 'is in neither the store nor (once migrated) the corpus.',
  );
});

/**
 * Separate from the test above, because "it is in the store" and "it is in the
 * tier that reaches a lane" are two claims and the second is the one that was
 * never going to be obvious. A `product`-tier entry here would pass the first
 * and be a different rule from the one the owner approved.
 */
test('it is a DEVELOPER-tier entry, which is the tier this repository is the only holder of', () => {
  const entry = shipped();
  assert.ok(entry !== null, `${ENTRY_ID} is not in the shipped store`);
  assert.equal(entry.tier, 'developer');
});

/**
 * The predicate the whole tier turns on, asserted on its own. If this is ever
 * false in this repository, every developer entry silently stops being
 * delivered and every other assertion in this file goes with it — so it is
 * worth knowing WHICH thing broke.
 */
test('this workspace answers YES to `workspaceIsMyContext`, so the developer tier is in force', () => {
  assert.equal(
    workspaceIsMyContext(PROJECT_ROOT), true,
    'this repository does not recognise itself as my_context, so every developer-tier constant '
    + 'is being filtered out of every door here',
  );
});

test('THE SUBAGENT DOOR delivers it — the entry is in the door\'s own list', () => {
  const delivered = deliverAtDoor({
    stateRoot: PROJECT_ROOT,
    door: 'subagent-start',
    key: 'test::lane-still-gets-the-no-git-rule-a',
  });
  assert.ok(
    delivered.entries.includes(ENTRY_ID),
    `the subagent-start door delivered ${delivered.entries.length} constant(s) and ${ENTRY_ID} `
    + `was not among them: ${delivered.entries.join(', ')}`,
  );
});

/**
 * And the BYTES, not only the list. `entries` is what the door recorded; this
 * is what a reader would be obeying. Asserted as the whole rendered block
 * rather than as a phrase, deliberately: three other governing items in this
 * corpus talk about a delegated worker and git, so a substring match on the
 * prose would pass with the store empty and the corpus doing the work — which
 * is the exact "two mechanisms, one assertion" failure this project measured
 * on 2026-09-11.
 */
test('THE SUBAGENT DOOR delivers its TEXT, and no other mechanism can produce that block', () => {
  const entry = shipped();
  assert.ok(entry !== null, `${ENTRY_ID} is not in the shipped store`);
  const delivered = deliverAtDoor({
    stateRoot: PROJECT_ROOT,
    door: 'subagent-start',
    key: 'test::lane-still-gets-the-no-git-rule-b',
  });
  assert.ok(
    delivered.text.includes(renderEntry(entry)),
    'the subagent-start door composed a block that does not carry the rendered entry',
  );
});

/**
 * **The door as a lane actually meets it.** Everything above tests the module
 * the hook calls; this tests the hook. The distinction has already cost this
 * project once — `subagent-start` is measurably the door that carries the
 * weight (1,082 dispatches against 54 session starts in this workspace's own
 * audit log), and a block composed correctly and then dropped on the way into
 * the envelope is indistinguishable from no store at all.
 */
test('THE HOOK A LANE STARTS THROUGH puts it in the envelope', () => {
  const entry = shipped();
  assert.ok(entry !== null, `${ENTRY_ID} is not in the shipped store`);
  const raw = buildSubagentStartOutput(
    { session_id: 'lane-still-gets-the-no-git-rule', agent_id: 'proof', cwd: REPO }, REPO,
  );
  assert.notEqual(raw, '', 'the SubagentStart hook produced nothing at all for this workspace');
  const envelope = JSON.parse(raw) as { hookSpecificOutput?: { additionalContext?: string } };
  const context = envelope.hookSpecificOutput?.additionalContext ?? '';
  assert.ok(
    context.includes(renderEntry(entry)),
    'a dispatched lane does NOT receive the no-git rule. It is in the store and it did not reach '
    + 'the one door lanes start through.',
  );
});

/**
 * **ONE PLACE, asserted on the real corpus.** The rule is in the store, so the
 * item it came from must no longer govern — a rule that is live in two places
 * is the defect `CLAUDE.md` opens with, and the migration's whole claim is
 * that it MOVED rather than being copied.
 */
test('ONE PLACE: the corpus item it came from is RETIRED, and points at where it went', () => {
  const ws = resolveWorkspace(REPO);
  const store = Store.open(':memory:');
  try {
    rebuild(store, { project: ws.projectRoot! }, ws.config);
    const item = store.get(SOURCE_ID);
    assert.ok(item !== null && item !== undefined, `${SOURCE_ID} is not in the corpus at all`);
    assert.equal(
      RETIRED_STATUSES.has(item.status), true,
      `${SOURCE_ID} is "${item.status}" and the rule is also in the store — it is live in two `
      + 'places, and a copy cannot be superseded',
    );
    assert.deepEqual(
      item.relations.filter((r) => r.type === 'superseded_by').map((r) => r.target),
      [POINTER_ID],
      'the retired item does not point at where the rule went, in one hop',
    );
  } finally { store.close(); }
});
