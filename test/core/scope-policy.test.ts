/**
 * `scopePolicy` — what an EMPTY scope means, per category (spec §4b).
 *
 * The three values, and the one sentence each must be true for:
 *
 *   global    an unscoped item injects on every file (the default, and the
 *             semantics the product was corrected to)
 *   required  an unscoped item is refused AT CAPTURE; one that predates the
 *             setting still injects everywhere, because "required" must never
 *             become a second injection-time filter — an item that exists and
 *             can never be injected is the defect that was just removed
 *   inert     an unscoped item matches no path: never JIT-injected, index only
 *
 * The rule had TWO implementations the last time it changed: `matchesScope`
 * and a `has_scope = 1` predicate in SQL, so changing the selector alone was a
 * no-op in production while every unit test went green. `Store.activeInjectable`
 * is now scope-blind by construction (`test/core/store-scoped.test.ts` pins
 * that), so this file exercises the selector, and the CLI/MCP surfaces are
 * exercised end-to-end in `test/cli/scope-policy.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { resolveConfig } from '../../src/core/config.ts';
import { computeDecay } from '../../src/core/decay.ts';
import { createItem, updateItem } from '../../src/core/mutate.ts';
import { matchesScope, select } from '../../src/core/select.ts';
import type { Item } from '../../src/core/types.ts';
import { checkScopePolicy } from '../../src/doctor/checks.ts';
import { validateCandidates } from '../../src/ingest/schema.ts';
import { chunkDocument } from '../../src/ingest/chunk.ts';
import { sandbox } from '../helpers/workspace.ts';

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A constraint', status: 'active',
    severity: 'soft', always: false, continuity: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'body', steps: [], observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

const configWith = (policy: string) =>
  resolveConfig({ categories: { constraint: { scopePolicy: policy } } });

// --- selection ---------------------------------------------------------------

test('an unscoped item injects everywhere under global — today\'s behaviour, unchanged', () => {
  const config = resolveConfig({});
  assert.equal(matchesScope(item(), 'src/anything.ts', config), true);
  const sel = select([item()], { event: 'tool', path: 'src/anything.ts' }, config);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-a']);
});

test('an unscoped item still injects everywhere under required', () => {
  const config = configWith('required');
  assert.equal(matchesScope(item(), 'src/anything.ts', config), true);
  const sel = select([item()], { event: 'tool', path: 'src/anything.ts' }, config);
  assert.deepEqual(
    sel.full.map((e) => e.item.id), ['CONST-a'],
    'required refuses at capture, never at injection — an item that exists but can never be ' +
    'injected is the defect this policy must not reintroduce',
  );
});

test('an unscoped item is never JIT-injected under inert, for any path', () => {
  const config = configWith('inert');
  for (const target of ['src/a.ts', 'README.md', 'deeply/nested/file.ts', 'x']) {
    assert.equal(matchesScope(item(), target, config), false, target);
    assert.deepEqual(select([item()], { event: 'tool', path: target }, config).full, []);
  }
});

test('under inert the item survives as an index line rather than disappearing', () => {
  const sel = select([item()], { event: 'session-start' }, configWith('inert'));
  assert.deepEqual(sel.index.normative.map((n) => n.id), ['CONST-a']);
  assert.deepEqual(sel.full, [], 'not pinned: it does not carry always');
});

test('a SCOPED item is unaffected by the policy — inert governs the empty case only', () => {
  const scoped = item({ scope: ['src/db/**'] });
  for (const policy of ['global', 'required', 'inert']) {
    const config = configWith(policy);
    assert.equal(matchesScope(scoped, 'src/db/w.ts', config), true, policy);
    assert.equal(matchesScope(scoped, 'src/api/h.ts', config), false, policy);
  }
});

test('always: true pins an unscoped item even under inert — scope never governs the pinned tier', () => {
  const sel = select([item({ always: true })], { event: 'session-start' }, configWith('inert'));
  assert.deepEqual(sel.full.map((e) => e.tier), ['pinned']);
});

test('the policy is read per category, not globally', () => {
  const config = resolveConfig({ categories: { constraint: { scopePolicy: 'inert' } } });
  assert.equal(matchesScope(item({ type: 'constraint' }), 'a.ts', config), false);
  assert.equal(matchesScope(item({ id: 'RULE-a', type: 'rule' }), 'a.ts', config), true);
});

// --- decay -------------------------------------------------------------------

test('decay counts an unscoped item as unrestricted only where that is true', () => {
  const base = {
    items: [item()], usage: [], recentlyUsed: [], window: 20, sessionsRecorded: 1,
  };
  assert.deepEqual(
    computeDecay({ ...base, config: resolveConfig({}) }).unrestricted.map((r) => r.id),
    ['CONST-a'],
  );
  assert.deepEqual(
    computeDecay({ ...base, config: configWith('inert') }).unrestricted, [],
    'under inert the item applies to NO file, which is the reverse of what that section claims',
  );
  // Not dropped, only reclassified: it is still measured.
  assert.deepEqual(
    computeDecay({ ...base, config: configWith('inert') }).cold.map((r) => r.id), ['CONST-a'],
  );
});

// --- doctor ------------------------------------------------------------------

test('doctor says an unscoped item under inert is index-only, and that no file changed', () => {
  const findings = checkScopePolicy([item()], configWith('inert'));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, 'scope_policy_inert');
  assert.equal(findings[0].level, 'info', 'nothing here is wrong, so doctor must not go red');
  assert.match(findings[0].message, /configuration, not\s+content/);
  assert.match(findings[0].message, /categories\.constraint\.scopePolicy/);
});

test('doctor says an unscoped item under required predates the policy and still injects', () => {
  const findings = checkScopePolicy([item()], configWith('required'));
  assert.equal(findings[0].code, 'scope_policy_required');
  assert.match(findings[0].message, /does not rewrite existing items/);
  assert.match(findings[0].message, /still injected on every file/);
});

test('doctor is silent under global, for scoped items, and for retired ones', () => {
  assert.deepEqual(checkScopePolicy([item()], resolveConfig({})), []);
  assert.deepEqual(checkScopePolicy([item({ scope: ['src/**'] })], configWith('inert')), []);
  assert.deepEqual(checkScopePolicy([item({ status: 'superseded' })], configWith('inert')), []);
});

// --- capture -----------------------------------------------------------------

test('capture without a scope is refused under required, naming the flag and writing nothing', () => {
  const box = sandbox({ categories: { constraint: { scopePolicy: 'required' } } });
  try {
    assert.throws(
      () => createItem(box.ctx, { type: 'constraint', title: 'Pool capped', origin: 'human' }),
      (err: Error) => {
        assert.match(err.message, /--scope/, 'the refusal must name the flag to pass');
        assert.match(err.message, /create_item/, 'and the MCP argument, for the other caller');
        assert.match(err.message, /scopePolicy/);
        return true;
      },
    );
    // Nothing written: no row, and no file anywhere under items/.
    assert.deepEqual(box.ctx.store.all(), []);
    const dir = path.join(box.root, 'items', 'constraint');
    assert.deepEqual(existsSync(dir) ? readdirSync(dir) : [], []);
  } finally {
    box.dispose();
  }
});

test('capture WITH a scope is accepted under required', () => {
  const box = sandbox({ categories: { constraint: { scopePolicy: 'required' } } });
  try {
    const result = createItem(box.ctx, {
      type: 'constraint', title: 'Pool capped', scope: ['src/db/**'], origin: 'human',
    });
    assert.equal(result.created, true);
  } finally {
    box.dispose();
  }
});

test('an empty scope array is refused exactly as an omitted one is', () => {
  const box = sandbox({ categories: { constraint: { scopePolicy: 'required' } } });
  try {
    assert.throws(
      () => createItem(box.ctx, {
        type: 'constraint', title: 'Pool capped', scope: [], origin: 'human',
      }),
      /scopePolicy "required"/,
    );
  } finally {
    box.dispose();
  }
});

test('global and inert do not refuse a capture — required is the only value that gates one', () => {
  for (const policy of ['global', 'inert']) {
    const box = sandbox({ categories: { constraint: { scopePolicy: policy } } });
    try {
      assert.equal(
        createItem(box.ctx, { type: 'constraint', title: 'Pool capped', origin: 'human' }).created,
        true, policy,
      );
    } finally {
      box.dispose();
    }
  }
});

// --- editing -----------------------------------------------------------------

test('under required, an edit that removes the last glob is refused and changes nothing', () => {
  const box = sandbox({ categories: { constraint: { scopePolicy: 'required' } } });
  try {
    const created = createItem(box.ctx, {
      type: 'constraint', title: 'Pool capped', scope: ['src/db/**'], origin: 'human',
    });
    assert.throws(
      () => updateItem(box.ctx, { id: created.id, scope: [], origin: 'human' }),
      /scopePolicy "required"/,
    );
    assert.deepEqual(box.ctx.store.get(created.id)!.scope, ['src/db/**']);
  } finally {
    box.dispose();
  }
});

test('under required, replacing the globs is still allowed', () => {
  const box = sandbox({ categories: { constraint: { scopePolicy: 'required' } } });
  try {
    const created = createItem(box.ctx, {
      type: 'constraint', title: 'Pool capped', scope: ['src/db/**'], origin: 'human',
    });
    updateItem(box.ctx, { id: created.id, scope: ['src/api/**'], origin: 'human' });
    assert.deepEqual(box.ctx.store.get(created.id)!.scope, ['src/api/**']);
  } finally {
    box.dispose();
  }
});

test('an item that predates the policy is not refused for echoing back its own empty scope', () => {
  // Captured under `global`, then read under `required` — the case spec §4b
  // calls legitimate: changing the policy does not rewrite existing items, so
  // an edit that changes nothing about the scope must not be refused for it.
  const box = sandbox();
  try {
    const created = createItem(box.ctx, {
      type: 'constraint', title: 'Pool capped', origin: 'human',
    });
    const strict = {
      ...box.ctx,
      config: resolveConfig({ categories: { constraint: { scopePolicy: 'required' } } }),
    };
    updateItem(strict, { id: created.id, scope: [], title: 'Pool capped tighter', origin: 'human' });
    assert.equal(box.ctx.store.get(created.id)!.title, 'Pool capped tighter');
  } finally {
    box.dispose();
  }
});

// --- ingest ------------------------------------------------------------------

const DOC = '# Password policy\n\nPasswords must be at least 12 characters.\n';

test('an ingest candidate with no scope is rejected under required, not thrown', () => {
  const config = resolveConfig({ categories: { requirement: { scopePolicy: 'required' } } });
  const chunk = chunkDocument(DOC)[0];
  const { valid, issues } = validateCandidates([{
    type: 'requirement',
    title: 'Passwords are at least 12 characters',
    body: 'Enforced at registration.',
    quote: 'Passwords must be at least 12 characters.',
  }], config, chunk);

  assert.deepEqual(valid, [], 'the candidate must not reach createItem');
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /scopePolicy "required"/);
});

test('a scoped ingest candidate is accepted under required', () => {
  const config = resolveConfig({ categories: { requirement: { scopePolicy: 'required' } } });
  const chunk = chunkDocument(DOC)[0];
  const { valid, issues } = validateCandidates([{
    type: 'requirement',
    title: 'Passwords are at least 12 characters',
    body: 'Enforced at registration.',
    quote: 'Passwords must be at least 12 characters.',
    scope: ['src/auth/**'],
  }], config, chunk);
  assert.deepEqual(issues, []);
  assert.equal(valid.length, 1);
});
