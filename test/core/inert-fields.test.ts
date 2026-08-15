/**
 * Inert fields on the rationale tier (spec §3).
 *
 * `always` and `severity` exist on every item, but only govern on the
 * NORMATIVE tier: `select` filters `isNormative` before it filters `always`
 * (select.ts), so `always: true` on a rationale item is never admitted to the
 * pinned tier, and nothing anywhere gates on a rationale item's severity.
 * Accepting either and doing nothing is a silent drop —
 * `INV-nothing-is-dropped-silently` — so they are refused.
 *
 * `scope` is the sub-question the spec left open, and this file pins the
 * answer: it is ACCEPTED on a rationale item, because unlike the other two it
 * has a consumer that does not filter by tier — `query_items({path})` calls
 * `matchesScope` on every item regardless of tier, which is how "what
 * decisions touch this file?" is answered. See `inertFieldError`'s doc comment
 * in mutate.ts.
 *
 * The refusal fires on the CHANGE, not on the presence of a value: the
 * neutral values (`always: false`, `severity: 'soft'`) are what every item
 * carries by default and what `applyCandidates` passes for every ingest
 * candidate, and echoing back an already-stored inert value changes nothing.
 * A value that is already stored is reported as inert instead, by
 * `inertFieldNote` — refuse the new assertion, report the pre-existing one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { resolveConfig } from '../../src/core/config.ts';
import { createItem, updateItem } from '../../src/core/mutate.ts';
import { matchesScope, select } from '../../src/core/select.ts';
import { chunkDocument } from '../../src/ingest/chunk.ts';
import { validateCandidates } from '../../src/ingest/schema.ts';
import { sandbox } from '../helpers/workspace.ts';

function itemFiles(cwd: string, type: string): string[] {
  const dir = path.join(cwd, '.my_context', 'items', type);
  return existsSync(dir) ? readdirSync(dir) : [];
}

// --- create ------------------------------------------------------------------

test('always on a rationale item is refused, not ignored', () => {
  const box = sandbox();
  try {
    assert.throws(
      () => createItem(box.ctx, {
        type: 'decision', title: 'Use SQLite', always: true, origin: 'human',
      }),
      /always.*normative/s,
    );
    // The promise the message makes: nothing was written, and nothing indexed.
    assert.deepEqual(itemFiles(box.cwd, 'decision'), []);
    assert.deepEqual(box.ctx.store.all().map((i) => i.id), []);
  } finally {
    box.dispose();
  }
});

test('severity: hard on a rationale item is refused, not ignored', () => {
  const box = sandbox();
  try {
    assert.throws(
      () => createItem(box.ctx, {
        type: 'decision', title: 'Use SQLite', severity: 'hard', origin: 'human',
      }),
      /severity.*normative/s,
    );
    assert.deepEqual(itemFiles(box.cwd, 'decision'), []);
  } finally {
    box.dispose();
  }
});

test('the refusal names why, and names both alternatives', () => {
  const box = sandbox();
  try {
    assert.throws(
      () => createItem(box.ctx, {
        type: 'decision', title: 'Use SQLite', always: true, origin: 'human',
      }),
      (err: Error) => {
        // Why: the field exists on every item, and only governs on one tier.
        assert.match(err.message, /every item/);
        assert.match(err.message, /only governs on the normative tier/);
        // The alternatives, both of them: retier the category in config, or
        // capture the fact as a normative item instead.
        assert.match(err.message, /categories\.decision\.tier/);
        assert.match(err.message, /\.my_context\/config\.json/);
        assert.match(err.message, /normative category/);
        // A refusal that does not say what happened to the write is half a
        // defect.
        assert.match(err.message, /Nothing was written/);
        return true;
      },
    );
  } finally {
    box.dispose();
  }
});

test('the neutral values are accepted — they assert nothing and drop nothing', () => {
  // `always: false` and `severity: 'soft'` are the defaults every item
  // carries, and `applyCandidates` passes both explicitly for every ingest
  // candidate. Refusing them would refuse every rationale ingest.
  const box = sandbox();
  try {
    const created = createItem(box.ctx, {
      type: 'decision', title: 'Use SQLite', always: false, severity: 'soft', origin: 'human',
    });
    assert.equal(created.created, true);
  } finally {
    box.dispose();
  }
});

test('a retiered category follows the resolved tier, not the catalogue', () => {
  // lesson is rationale in the catalogue; retiered to normative it accepts
  // `always`, because the flag then really does pin the item.
  const box = sandbox({ categories: { lesson: { tier: 'normative' } } });
  try {
    const created = createItem(box.ctx, {
      type: 'lesson', title: 'Retry storms are real', always: true, origin: 'human',
    });
    assert.equal(created.created, true);
    assert.equal(box.ctx.store.get(created.id)!.always, true);
  } finally {
    box.dispose();
  }
});

test('a category retiered the OTHER way refuses always, though the catalogue calls it normative', () => {
  const box = sandbox({ categories: { rule: { tier: 'rationale' } } });
  try {
    assert.throws(
      () => createItem(box.ctx, {
        type: 'rule', title: 'Never log secrets', always: true, origin: 'human',
      }),
      /always.*normative/s,
    );
  } finally {
    box.dispose();
  }
});

test('always on a normative item still works — it is the pinned tier and it governs', () => {
  const box = sandbox();
  try {
    const created = createItem(box.ctx, {
      type: 'constraint', title: 'Pool capped at 20', always: true, origin: 'human',
    });
    assert.equal(created.created, true);
    const sel = select(box.ctx.store.all(), { event: 'session-start' }, box.ctx.config);
    assert.deepEqual(
      sel.full.map((e) => `${e.tier}:${e.item.id}`), [`pinned:${created.id}`],
      'the refusal must not have cost the normative tier its pin',
    );
  } finally {
    box.dispose();
  }
});

// --- scope: the open sub-question, answered ----------------------------------

test('scope IS accepted on a rationale item, and query-by-path finds it', () => {
  // The decision, and the reason it differs from `always`/`severity`: scope
  // has a consumer that does not filter by tier. `query_items({path})` calls
  // `matchesScope` on every item, so a decision's scope answers "which
  // decisions touch this file?" — refusing it would delete that feature.
  const box = sandbox();
  try {
    const created = createItem(box.ctx, {
      type: 'decision', title: 'Use SQLite', scope: ['src/db/**'], origin: 'human',
    });
    assert.equal(created.created, true);
    const item = box.ctx.store.get(created.id)!;
    assert.deepEqual(item.scope, ['src/db/**']);
    assert.equal(matchesScope(item, 'src/db/store.ts', box.ctx.config), true);
    assert.equal(matchesScope(item, 'src/cli/index.ts', box.ctx.config), false);
  } finally {
    box.dispose();
  }
});

test('scopePolicy still governs a rationale category, and the two rules do not collide', () => {
  // `scopePolicy: "required"` on a rationale category demands a scope at
  // capture. If `scope` were refused on the rationale tier the two settings
  // would be mutually unsatisfiable — every capture refused both ways — which
  // is the sharpest argument for accepting scope here.
  const box = sandbox({ categories: { decision: { scopePolicy: 'required' } } });
  try {
    assert.throws(
      () => createItem(box.ctx, { type: 'decision', title: 'Use SQLite', origin: 'human' }),
      /scopePolicy "required"/,
    );
    const created = createItem(box.ctx, {
      type: 'decision', title: 'Use SQLite', scope: ['src/db/**'], origin: 'human',
    });
    assert.equal(created.created, true);
  } finally {
    box.dispose();
  }
});

// --- update ------------------------------------------------------------------

test('setting always on an existing rationale item is refused, and changes nothing', () => {
  const box = sandbox();
  try {
    const created = createItem(box.ctx, {
      type: 'decision', title: 'Use SQLite', body: 'Because it ships with Node.', origin: 'human',
    });
    assert.throws(
      () => updateItem(box.ctx, { id: created.id, always: true, origin: 'human' }),
      /always.*normative/s,
    );
    assert.equal(box.ctx.store.get(created.id)!.always, false);
  } finally {
    box.dispose();
  }
});

test('the edit refusal says nothing was CHANGED, not that nothing was written', () => {
  const box = sandbox();
  try {
    const created = createItem(box.ctx, { type: 'decision', title: 'Use SQLite', origin: 'human' });
    assert.throws(
      () => updateItem(box.ctx, { id: created.id, severity: 'hard', origin: 'human' }),
      (err: Error) => {
        assert.match(err.message, /Nothing was changed/);
        return true;
      },
    );
  } finally {
    box.dispose();
  }
});

test('raising severity to hard on an existing rationale item is refused', () => {
  const box = sandbox();
  try {
    const created = createItem(box.ctx, { type: 'decision', title: 'Use SQLite', origin: 'human' });
    assert.throws(
      () => updateItem(box.ctx, { id: created.id, severity: 'hard', origin: 'human' }),
      /severity.*normative/s,
    );
    assert.equal(box.ctx.store.get(created.id)!.severity, 'soft');
  } finally {
    box.dispose();
  }
});

test('an ordinary rationale edit is untouched by the guard', () => {
  const box = sandbox();
  try {
    const created = createItem(box.ctx, { type: 'decision', title: 'Use SQLite', origin: 'human' });
    updateItem(box.ctx, { id: created.id, body: 'Because it ships with Node.', origin: 'human' });
    assert.equal(box.ctx.store.get(created.id)!.body, 'Because it ships with Node.');
  } finally {
    box.dispose();
  }
});

test('softening a stored hard severity is allowed — it is the way back out', () => {
  const box = sandbox({ categories: { lesson: { tier: 'normative' } } });
  try {
    const created = createItem(box.ctx, {
      type: 'lesson', title: 'Retry storms are real', severity: 'hard', origin: 'human',
    });
    const rationale = { ...box.ctx, config: resolveConfig({}) };
    updateItem(rationale, { id: created.id, severity: 'soft', origin: 'human' });
    assert.equal(box.ctx.store.get(created.id)!.severity, 'soft');
  } finally {
    box.dispose();
  }
});

test('an item retiered UNDER a stored inert value is still editable, and told it is inert', () => {
  // The one case the refusal cannot cover, and the reason the note survives
  // it: `always: true` was legal when it was written (the category was
  // normative), the category has since been retiered, and the caller is
  // echoing the field back rather than asserting it. Refusing that would
  // strand the item behind an unusable edit path; saying nothing would make
  // the inert flag silent again.
  const box = sandbox({ categories: { lesson: { tier: 'normative' } } });
  try {
    const created = createItem(box.ctx, {
      type: 'lesson', title: 'Retry storms are real', always: true, origin: 'human',
    });
    const rationale = { ...box.ctx, config: resolveConfig({}) };
    const result = updateItem(rationale, {
      id: created.id, always: true, title: 'Retry storms are real, and costly', origin: 'human',
    });
    assert.match(result.message, /INERT/);
    assert.match(result.message, /rationale-tier/);
    assert.equal(box.ctx.store.get(created.id)!.title, 'Retry storms are real, and costly');
  } finally {
    box.dispose();
  }
});

test('a stored hard severity on a retiered item is reported inert too', () => {
  const box = sandbox({ categories: { lesson: { tier: 'normative' } } });
  try {
    const created = createItem(box.ctx, {
      type: 'lesson', title: 'Retry storms are real', severity: 'hard', origin: 'human',
    });
    const rationale = { ...box.ctx, config: resolveConfig({}) };
    const result = updateItem(rationale, { id: created.id, body: 'Seen twice.', origin: 'human' });
    assert.match(result.message, /INERT/);
    assert.match(result.message, /severity/);
  } finally {
    box.dispose();
  }
});

test('a normative item is never given the inert note', () => {
  // A note that fires on everything says nothing.
  const box = sandbox();
  try {
    const created = createItem(box.ctx, {
      type: 'constraint', title: 'Pool capped at 20', always: true, severity: 'hard',
      origin: 'human',
    });
    assert.doesNotMatch(created.message, /INERT/);
    const result = updateItem(box.ctx, { id: created.id, body: 'Measured.', origin: 'human' });
    assert.doesNotMatch(result.message, /INERT/);
  } finally {
    box.dispose();
  }
});

// --- ingest ------------------------------------------------------------------

const DOC = '# Retries\n\nRetrying without jitter produced a thundering herd.\n';

test('an ingest candidate is REJECTED for an inert severity, not thrown', () => {
  // The shape `scopeRequirementError` established: `applyCandidates` keeps
  // every success in a partial batch, so one bad candidate must not take the
  // chunk down with it. The rejection is durable — it lands in the session's
  // `.rejected.jsonl` — so nothing is dropped silently.
  const config = resolveConfig({});
  const chunk = chunkDocument(DOC)[0];
  const { valid, issues } = validateCandidates([
    {
      type: 'lesson',
      title: 'Retry without jitter is a thundering herd',
      body: 'Seen in production.',
      quote: 'Retrying without jitter produced a thundering herd.',
      severity: 'hard',
    },
    {
      type: 'lesson',
      title: 'Retries need jitter',
      body: 'Seen in production.',
      quote: 'Retrying without jitter produced a thundering herd.',
    },
  ], config, chunk);

  assert.equal(valid.length, 1, 'the good candidate must survive the bad one');
  assert.equal(valid[0].title, 'Retries need jitter');
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /severity/);
  assert.match(issues[0].message, /normative/);
});

test('a normative ingest candidate may still be hard', () => {
  const config = resolveConfig({});
  const chunk = chunkDocument(DOC)[0];
  const { valid, issues } = validateCandidates([{
    type: 'rule',
    title: 'Retries carry jitter',
    body: 'Enforced in the client.',
    quote: 'Retrying without jitter produced a thundering herd.',
    severity: 'hard',
  }], config, chunk);
  assert.deepEqual(issues, []);
  assert.equal(valid.length, 1);
});
