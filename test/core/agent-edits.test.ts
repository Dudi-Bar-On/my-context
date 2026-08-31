/**
 * `agentEdits` at the write path (spec §4, plan Task 5).
 *
 * A non-human caller's edit to an item's CONTENT — title, body, tags — is
 * routed by the item category's `agentEdits` policy:
 *
 *  - `allow`  — it applies immediately, as it did before this existed.
 *  - `review` — it is staged as a pending revision (`stageRevision`,
 *               revision.ts) and the item is untouched: same bytes on disk,
 *               same row in the index, still governing its current text.
 *
 * Three properties this file exists to pin, because each is a way the feature
 * could look right and be wrong:
 *
 *  1. **`allow` is not "agents may do anything to this category."** `scope`,
 *     `always`, `severity` and `status` on a governing normative item stay
 *     human-only whatever `agentEdits` says — that is `guardedChange`, built to
 *     close the hole where an agent neutralises a constraint by emptying its
 *     scope instead of retiring it. `allow` must not widen it, and `review`
 *     must not route around it either.
 *  2. **The agent must be told the edit did not take effect.** An agent told
 *     "updated" for a staged change reasons about text that is not in force.
 *  3. **Nothing is applied by halves.** A call carrying both a content change
 *     and a change to a field a revision cannot carry is refused whole —
 *     staging one half and applying the other would leave the item in a state
 *     nobody asked for, reported as a success.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { agentEditsFor, resolveConfig } from '../../src/core/config.ts';
import { createItem, updateItem, type UpdateInput } from '../../src/core/mutate.ts';
import { pendingRevisions, revisionFor } from '../../src/core/revision.ts';
import { sandbox, type Sandbox } from '../helpers/workspace.ts';

const ORIGINAL = 'Never log a customer email address, anywhere, at any level.';
const PROPOSED = 'Avoid logging customer email addresses unless it is necessary.';

/** A governing (active) normative item, authored by a human. */
function rule(box: Sandbox, extra: Record<string, unknown> = {}): string {
  return createItem(box.ctx, {
    type: 'rule',
    title: 'Do not log customer email',
    body: ORIGINAL,
    status: 'active',
    origin: 'human',
    ...extra,
  }).id;
}

function fileOf(box: Sandbox, id: string): string {
  return path.join(box.root, box.ctx.store.get(id)!.filePath);
}

// --- the defaults -----------------------------------------------------------

test('a normative category defaults to review and a rationale one to allow, with no config', () => {
  const config = resolveConfig({});
  assert.equal(agentEditsFor(config, 'rule'), 'review');
  assert.equal(agentEditsFor(config, 'constraint'), 'review');
  assert.equal(agentEditsFor(config, 'lesson'), 'allow');
  assert.equal(agentEditsFor(config, 'decision'), 'allow');
});

/**
 * The fallback fails CLOSED, the same direction `tierOf` fails closed to
 * `normative`. A category renamed or removed after its items were captured
 * leaves those items indexed with no policy of their own; reading that as
 * `allow` would hand an agent free rein over exactly the items whose governing
 * category just vanished. Asserted directly because every catalogue category
 * is always present in a resolved config, so this branch has no reachable
 * route through `resolveConfig`.
 */
test('a category absent from config resolves to review, not allow', () => {
  assert.equal(agentEditsFor(resolveConfig({}), 'no-such-category'), 'review');
});

// --- review: the edit is staged, not applied --------------------------------

test('under review, an agent content edit is staged and the item is byte-identical', () => {
  const box = sandbox();
  try {
    const id = rule(box);
    const before = readFileSync(fileOf(box, id), 'utf8');

    const result = updateItem(box.ctx, { id, body: PROPOSED, origin: 'agent' });

    assert.equal(readFileSync(fileOf(box, id), 'utf8'), before, 'the file must not have changed');
    assert.equal(box.ctx.store.get(id)!.body, ORIGINAL, 'the indexed row must not have changed');
    assert.equal(result.created, false);
    assert.equal(result.status, 'active');
    assert.ok(result.staged, 'the result must report that it was staged');
    assert.equal(result.staged.duplicate, false);
    assert.equal(result.staged.alsoPending, 0);
    assert.match(result.staged.revisionId, /^REV-/);

    const pending = revisionFor(box.ctx, id);
    assert.ok(pending);
    assert.equal(pending.revisionId, result.staged.revisionId);
    assert.equal(pending.changes.body, PROPOSED);
    assert.equal(pending.base.body, ORIGINAL);
    assert.equal(pending.origin, 'agent');
  } finally { box.dispose(); }
});

test('the message tells the agent it was NOT applied and what still governs', () => {
  const box = sandbox();
  try {
    const id = rule(box);
    const { message } = updateItem(box.ctx, { id, body: PROPOSED, origin: 'agent' });
    assert.match(message, /NOT applied/);
    assert.match(message, /staged as revision REV-/);
    assert.match(message, /unchanged and keeps governing/);
    assert.match(message, /Do not reason as if the new text is in force/);
    assert.doesNotMatch(message, /\bupdated\b/, 'an agent told "updated" reasons about text that is not in force');
  } finally { box.dispose(); }
});

test('title and tags are staged too, not only body', () => {
  const box = sandbox();
  try {
    const id = rule(box);
    const result = updateItem(box.ctx, {
      id, title: 'Do not log customer identifiers', tags: ['pii', 'logging'], origin: 'agent',
    });
    assert.ok(result.staged);
    assert.equal(box.ctx.store.get(id)!.title, 'Do not log customer email');
    assert.deepEqual(box.ctx.store.get(id)!.tags, []);
    const pending = revisionFor(box.ctx, id)!;
    assert.equal(pending.changes.title, 'Do not log customer identifiers');
    assert.deepEqual(pending.changes.tags, ['pii', 'logging']);
  } finally { box.dispose(); }
});

test('ingest is a non-human origin too and is staged the same way', () => {
  const box = sandbox();
  try {
    const id = rule(box);
    const result = updateItem(box.ctx, { id, body: PROPOSED, origin: 'ingest' });
    assert.ok(result.staged);
    assert.equal(revisionFor(box.ctx, id)!.origin, 'ingest');
  } finally { box.dispose(); }
});

test('a repeated identical proposal does not grow the queue and says so', () => {
  const box = sandbox();
  try {
    const id = rule(box);
    const first = updateItem(box.ctx, { id, body: PROPOSED, origin: 'agent' });
    const second = updateItem(box.ctx, { id, body: PROPOSED, origin: 'agent' });
    assert.equal(second.staged!.revisionId, first.staged!.revisionId);
    assert.equal(second.staged!.duplicate, true);
    assert.equal(pendingRevisions(box.ctx).length, 1);
    assert.match(second.message, /already staged/);
  } finally { box.dispose(); }
});

/**
 * An echo is not a change anywhere else in this module (`guardedChange`
 * documents the rule), so a call whose content fields all match the item has
 * nothing to stage. It must fall through to the ordinary path rather than
 * staging an empty revision or throwing.
 */
test('an agent echoing the current content stages nothing', () => {
  const box = sandbox();
  try {
    const id = rule(box);
    const result = updateItem(box.ctx, { id, body: ORIGINAL, title: 'Do not log customer email', origin: 'agent' });
    assert.equal(result.staged, undefined);
    assert.match(result.message, /updated/);
    assert.deepEqual(pendingRevisions(box.ctx), []);
  } finally { box.dispose(); }
});

/**
 * `tags` is a SET everywhere else in this codebase — `contentHash` sorts it
 * before hashing, and `normalizeChanges` (revision.ts) compares it sorted — so
 * a reordering is not a change and must not stage anything. Without the sorted
 * comparison here, this call reaches `stageRevision`, which drops the tags as
 * unchanged on its own side and then refuses the now-empty proposal: an agent
 * echoing back the tags it just read would get an error telling it there is
 * nothing to stage.
 */
test('reordered tags are not a content change and stage nothing', () => {
  const box = sandbox();
  try {
    const id = rule(box, { tags: ['logging', 'pii'] });
    const result = updateItem(box.ctx, { id, tags: ['pii', 'logging'], origin: 'agent' });
    assert.equal(result.staged, undefined);
    assert.deepEqual(pendingRevisions(box.ctx), []);
    // Sorted, because the ordinary apply path below the policy check does write
    // the reordered array back — which is a no-op as far as the item's meaning
    // goes, and is what happened before this setting existed. What matters here
    // is that no revision was staged and the SET is untouched.
    assert.deepEqual([...box.ctx.store.get(id)!.tags].sort(), ['logging', 'pii']);
  } finally { box.dispose(); }
});

// --- what the refusals promise is still open --------------------------------

/**
 * Both trust-boundary refusals end by naming what the caller MAY still do.
 * Before `agentEdits` existed they said flatly that title, body, summary, tags
 * and extra are "still editable", which is only true under `allow`: under `review`
 * the same call is accepted and STAGED. A caller told "editable" would go on
 * to reason about text that is not in force — the exact failure the staged
 * message exists to prevent, reintroduced through the refusal for a different
 * field.
 */
test('the guarded-field refusal says content is staged under review and editable under allow', () => {
  for (const [policy, expected, forbidden] of [
    ['review', /STAGED as a pending revision/, /tags and extra are still editable/],
    ['allow', /Title, body, summary, tags and extra are still editable/, /STAGED/],
  ] as const) {
    const box = sandbox({ categories: { rule: { agentEdits: policy } } });
    try {
      const id = rule(box, { scope: ['src/**'] });
      assert.throws(
        () => updateItem(box.ctx, { id, scope: ['docs/**'], origin: 'agent' }),
        (err: Error) => {
          assert.match(err.message, expected, policy);
          assert.doesNotMatch(err.message, forbidden, policy);
          return true;
        },
      );
    } finally { box.dispose(); }
  }
});

test('the status refusal on a draft carries the staging caveat under review only', () => {
  for (const [policy, expected] of [['review', true], ['allow', false]] as const) {
    const box = sandbox({ categories: { rule: { agentEdits: policy } } });
    try {
      const id = createItem(box.ctx, {
        type: 'rule', title: 'Do not log customer email', body: ORIGINAL, origin: 'agent',
      }).id;
      assert.throws(
        () => updateItem(box.ctx, { id, status: 'active', origin: 'agent' }),
        (err: Error) => {
          assert.match(err.message, /Every other field is editable/, policy);
          assert.equal(/STAGED as a pending revision/.test(err.message), expected, policy);
          return true;
        },
      );
    } finally { box.dispose(); }
  }
});

// --- allow: the edit applies ------------------------------------------------

test('under allow, an agent content edit applies immediately', () => {
  const box = sandbox({ categories: { rule: { agentEdits: 'allow' } } });
  try {
    const id = rule(box);
    const result = updateItem(box.ctx, { id, body: PROPOSED, origin: 'agent' });
    assert.equal(result.staged, undefined);
    assert.match(result.message, /updated/);
    assert.equal(box.ctx.store.get(id)!.body, PROPOSED);
    assert.match(readFileSync(fileOf(box, id), 'utf8'), /unless it is necessary/);
    assert.deepEqual(pendingRevisions(box.ctx), []);
  } finally { box.dispose(); }
});

test('a rationale category defaults to allow, so an agent lesson edit applies', () => {
  const box = sandbox();
  try {
    const id = createItem(box.ctx, {
      type: 'lesson', title: 'Migrations need locks', body: ORIGINAL, origin: 'human',
    }).id;
    const result = updateItem(box.ctx, { id, body: PROPOSED, origin: 'agent' });
    assert.equal(result.staged, undefined);
    assert.equal(box.ctx.store.get(id)!.body, PROPOSED);
  } finally { box.dispose(); }
});

test('a rationale category set to review stages an agent edit', () => {
  const box = sandbox({ categories: { lesson: { agentEdits: 'review' } } });
  try {
    const id = createItem(box.ctx, {
      type: 'lesson', title: 'Migrations need locks', body: ORIGINAL, origin: 'human',
    }).id;
    const result = updateItem(box.ctx, { id, body: PROPOSED, origin: 'agent' });
    assert.ok(result.staged);
    assert.equal(box.ctx.store.get(id)!.body, ORIGINAL);
  } finally { box.dispose(); }
});

// --- the trust boundary neither policy may move -----------------------------

/**
 * The whole point of the guard: an agent that cannot retire a constraint can
 * neutralise it just as completely by emptying its scope, softening its
 * severity or unpinning it, and the item stays `active` in every report.
 * `agentEdits` widens what an agent may do to CONTENT. Enumerated in one test
 * rather than four, so a policy that opened one of the four cannot be missed
 * by a suite that still checks the other three.
 */
test('agentEdits: allow does not open the reach-and-force gate', () => {
  const box = sandbox({ categories: { rule: { agentEdits: 'allow' } } });
  try {
    const id = rule(box, { scope: ['src/**'], severity: 'hard', always: true });
    const attempts: [string, Partial<UpdateInput>][] = [
      ['scope', { scope: ['docs/**'] }],
      ['scope emptied', { scope: [] }],
      ['always', { always: false }],
      ['severity', { severity: 'soft' }],
      ['status', { status: 'deprecated' }],
    ];
    for (const [name, patch] of attempts) {
      assert.throws(
        () => updateItem(box.ctx, { id, ...patch, origin: 'agent' }),
        /non-human caller cannot change/,
        `agentEdits: allow must not open ${name}`,
      );
    }
    const item = box.ctx.store.get(id)!;
    assert.deepEqual(item.scope, ['src/**']);
    assert.equal(item.always, true);
    assert.equal(item.severity, 'hard');
    assert.equal(item.status, 'active');
  } finally { box.dispose(); }
});

/** The same enumeration from the other side: `review` must not become a route
 * around the guard by staging what the guard refuses. Task 4 refuses these at
 * `stageRevision`; this asserts they never get that far. */
test('agentEdits: review does not route around the reach-and-force gate', () => {
  const box = sandbox();
  try {
    const id = rule(box, { scope: ['src/**'], severity: 'hard', always: true });
    const patches: Partial<UpdateInput>[] = [
      { scope: ['docs/**'] }, { scope: [] }, { always: false }, { severity: 'soft' },
      { status: 'deprecated' },
    ];
    for (const patch of patches) {
      assert.throws(
        () => updateItem(box.ctx, { id, ...patch, origin: 'agent' }),
        /non-human caller cannot change/,
      );
    }
    assert.deepEqual(pendingRevisions(box.ctx), [], 'nothing may be staged for a refused field');
  } finally { box.dispose(); }
});

// --- a human is never staged ------------------------------------------------

test('a human edit is never staged, whatever the policy says', () => {
  const box = sandbox();
  try {
    const id = rule(box);
    const result = updateItem(box.ctx, { id, body: PROPOSED, origin: 'human' });
    assert.equal(result.staged, undefined);
    assert.equal(box.ctx.store.get(id)!.body, PROPOSED);
    assert.deepEqual(pendingRevisions(box.ctx), []);
  } finally { box.dispose(); }
});

test('a human edit defaults to human origin and is still not staged', () => {
  const box = sandbox();
  try {
    const id = rule(box);
    const result = updateItem(box.ctx, { id, body: PROPOSED });
    assert.equal(result.staged, undefined);
    assert.equal(box.ctx.store.get(id)!.body, PROPOSED);
  } finally { box.dispose(); }
});

// --- mixed calls are refused whole ------------------------------------------

/**
 * On a governing normative item the existing guard fires first and the call is
 * refused for the guarded field — which is already the right outcome, and this
 * pins that nothing was staged on the way out. The interesting cases are the
 * two where that guard does NOT apply: a normative DRAFT (governs nothing yet)
 * and a rationale item set to `review`.
 */
test('a mixed call on a governing item is refused and stages nothing', () => {
  const box = sandbox();
  try {
    const id = rule(box, { scope: ['src/**'] });
    assert.throws(
      () => updateItem(box.ctx, { id, body: PROPOSED, scope: ['docs/**'], origin: 'agent' }),
      /non-human caller cannot change/,
    );
    assert.deepEqual(pendingRevisions(box.ctx), []);
    assert.equal(box.ctx.store.get(id)!.body, ORIGINAL);
  } finally { box.dispose(); }
});

test('a mixed call on a normative draft is refused whole, naming both halves', () => {
  const box = sandbox();
  try {
    const id = createItem(box.ctx, {
      type: 'rule', title: 'Do not log customer email', body: ORIGINAL,
      scope: ['src/**'], origin: 'agent',
    }).id;
    assert.equal(box.ctx.store.get(id)!.status, 'draft');
    assert.throws(
      () => updateItem(box.ctx, { id, body: PROPOSED, scope: ['docs/**'], origin: 'agent' }),
      (err: Error) => {
        assert.match(err.message, /body/);
        assert.match(err.message, /scope/);
        assert.match(err.message, /nothing was applied and nothing was staged/i);
        return true;
      },
    );
    assert.deepEqual(pendingRevisions(box.ctx), [], 'no half of a mixed call may be staged');
    assert.deepEqual(box.ctx.store.get(id)!.scope, ['src/**'], 'no half of a mixed call may be applied');
    assert.equal(box.ctx.store.get(id)!.body, ORIGINAL);
  } finally { box.dispose(); }
});

test('a mixed call on a rationale item under review is refused whole', () => {
  const box = sandbox({ categories: { lesson: { agentEdits: 'review' } } });
  try {
    const id = createItem(box.ctx, {
      type: 'lesson', title: 'Migrations need locks', body: ORIGINAL, origin: 'human',
    }).id;
    assert.throws(
      () => updateItem(box.ctx, { id, body: PROPOSED, status: 'deprecated', origin: 'agent' }),
      /nothing was applied and nothing was staged/i,
    );
    assert.equal(box.ctx.store.get(id)!.status, 'active');
    assert.equal(box.ctx.store.get(id)!.body, ORIGINAL);
    assert.deepEqual(pendingRevisions(box.ctx), []);
  } finally { box.dispose(); }
});

/**
 * `extra` carries the category-specific fields — `rule.directive` among them,
 * which decides whether a rule prohibits or prescribes. It is CONTENT
 * (`UPDATE_FIELD_POLICY`, mutate.ts), so it stages like the rest and travels in
 * the same revision as a body change rather than being the unstageable half of
 * a mixed call.
 *
 * Until this was fixed it was neither: absent from `REVISION_FIELDS` and absent
 * from `GUARDED_FIELDS`, so an `extra`-only call from an agent applied
 * immediately to a governing, active, hard rule.
 */
test('an agent extra edit on a governing rule is staged, not applied', () => {
  const box = sandbox();
  try {
    const id = rule(box, { extra: { directive: 'dont' } });
    const before = readFileSync(fileOf(box, id), 'utf8');

    const result = updateItem(box.ctx, { id, extra: { directive: 'do' }, origin: 'agent' });

    assert.ok(result.staged, 'an extra-only change must produce a revision, not a write');
    assert.equal(readFileSync(fileOf(box, id), 'utf8'), before, 'the file must not have changed');
    assert.equal(box.ctx.store.get(id)!.extra.directive, 'dont');
    assert.match(result.message, /NOT applied/);

    const pending = revisionFor(box.ctx, id)!;
    assert.deepEqual(pending.changes.extra, { directive: 'do' });
    assert.deepEqual(pending.base.extra, { directive: 'dont' });
  } finally { box.dispose(); }
});

/** Content travels together: `extra` beside a body change is ONE revision, not
 * a refusal and not two. Both halves are staged, so nothing is applied while
 * the other waits. */
test('extra alongside a body change is staged as one revision', () => {
  const box = sandbox();
  try {
    const id = rule(box, { extra: { directive: 'dont' } });
    const result = updateItem(
      box.ctx, { id, body: PROPOSED, extra: { directive: 'do' }, origin: 'agent' },
    );

    assert.ok(result.staged);
    assert.equal(box.ctx.store.get(id)!.body, ORIGINAL);
    assert.equal(box.ctx.store.get(id)!.extra.directive, 'dont');
    const pending = pendingRevisions(box.ctx);
    assert.equal(pending.length, 1, 'one proposal, carrying both fields');
    assert.deepEqual(Object.keys(pending[0].changes).sort(), ['body', 'extra']);
  } finally { box.dispose(); }
});

/** Only the keys that MOVE are proposed. `updateItem` merges `extra`, so an
 * echoed key is not a proposal about anything — carrying it would put a key
 * nobody proposed changing into the diff a human reads, and would make the
 * revision stale on an edit to a key it never touched.
 *
 * Two keys are needed for that to be observable, and the catalogue gives
 * `rule` only `directive` — so the second comes from config, which makes this
 * test double as proof that a config-declared field on a BUILT-IN category is
 * honoured on the write path and EXTENDS the catalogue rather than replacing
 * it: `directive` below is never declared here, and still works. */
test('a staged extra carries only the keys that actually move', () => {
  const box = sandbox({ categories: { rule: { extraFields: ['kind'] } } });
  try {
    const id = rule(box, { extra: { directive: 'dont', kind: 'security' } });
    const result = updateItem(
      box.ctx, { id, extra: { directive: 'do', kind: 'security' }, origin: 'agent' },
    );

    assert.ok(result.staged);
    assert.deepEqual(revisionFor(box.ctx, id)!.changes.extra, { directive: 'do' });
  } finally { box.dispose(); }
});

/** An echo across the whole map is not a change at all: nothing is staged and
 * nothing is written, the same rule every other content field follows. */
test('an echoed extra stages nothing', () => {
  const box = sandbox();
  try {
    const id = rule(box, { extra: { directive: 'dont' } });
    const result = updateItem(box.ctx, { id, extra: { directive: 'dont' }, origin: 'agent' });

    assert.equal(result.staged, undefined);
    assert.deepEqual(pendingRevisions(box.ctx), []);
  } finally { box.dispose(); }
});

/** `extra` beside a GATED field is still the mixed call it always was — the
 * refusal now names `extra` as the content half rather than as the other one. */
test('extra alongside a gated field is a mixed call and is refused', () => {
  const box = sandbox();
  try {
    const id = createItem(box.ctx, {
      type: 'rule', title: 'Do not log customer email', body: ORIGINAL,
      extra: { directive: 'dont' }, origin: 'agent',
    }).id;
    assert.throws(
      () => updateItem(box.ctx, { id, extra: { directive: 'do' }, scope: ['src/**'], origin: 'agent' }),
      /mixes a content change \(extra\) with a change to scope/,
    );
    assert.deepEqual(pendingRevisions(box.ctx), []);
    assert.equal(box.ctx.store.get(id)!.extra.directive, 'dont');
    assert.deepEqual(box.ctx.store.get(id)!.scope, []);
  } finally { box.dispose(); }
});

/** An echoed guarded field is not a change, so it is not a mixed call — the
 * same rule `guardedChange` applies. Without this, every read-modify-write
 * round trip an agent makes would be refused. */
test('a content change alongside ECHOED guarded fields is staged, not refused', () => {
  const box = sandbox();
  try {
    const id = rule(box, { scope: ['src/**'], severity: 'hard' });
    const result = updateItem(box.ctx, {
      id, body: PROPOSED, scope: ['src/**'], severity: 'hard', always: false,
      status: 'active', origin: 'agent',
    });
    assert.ok(result.staged);
    assert.equal(box.ctx.store.get(id)!.body, ORIGINAL);
  } finally { box.dispose(); }
});

/** A guarded change with NO content change is not a mixed call either: it goes
 * to the existing guards and, on an item those do not protect, applies. */
test('a guarded-only change on a draft still applies under review', () => {
  const box = sandbox();
  try {
    const id = createItem(box.ctx, {
      type: 'rule', title: 'Do not log customer email', body: ORIGINAL, origin: 'agent',
    }).id;
    const result = updateItem(box.ctx, { id, scope: ['src/**'], origin: 'agent' });
    assert.equal(result.staged, undefined);
    assert.deepEqual(box.ctx.store.get(id)!.scope, ['src/**']);
  } finally { box.dispose(); }
});
