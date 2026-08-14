import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  buildRuleRequest, renderRuleRequest, validateRuleCandidates, stageRuleCandidates,
  acceptStagedRule, discardStagedRule, loadStaging, listStaging, stagingDir,
} from '../../src/lesson/derive.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { Store } from '../../src/core/store.ts';
import { createItem, type MutationContext } from '../../src/core/mutate.ts';
import type { Item } from '../../src/core/types.ts';

function fixture(): { ctx: MutationContext; root: string; lesson: Item; cleanup: () => void } {
  const base = mkdtempSync(path.join(tmpdir(), 'myctx-lesson-'));
  const root = path.join(base, '.my_context');
  mkdirSync(path.join(root, 'items'), { recursive: true });
  const store = Store.open(':memory:');
  const ctx: MutationContext = { root, store, config: resolveConfig({}) };
  // MutationResult carries ids, not the item — the object comes from the store.
  const lessonId = createItem(ctx, {
    type: 'lesson',
    title: 'Migrations deadlock when run during peak traffic',
    body: 'The 3pm deploy took an ACCESS EXCLUSIVE lock and queued every write for 40 seconds.',
    origin: 'human',
  }).id;
  const lesson = ctx.store.get(lessonId) as Item;
  return { ctx, root, lesson, cleanup: () => { store.close(); rmSync(base, { recursive: true, force: true }); } };
}

function candidate(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'Run schema migrations outside peak traffic hours',
    directive: 'do',
    body: 'An ACCESS EXCLUSIVE lock queues every write for the duration.',
    scope: ['migrations/**'],
    ...over,
  };
}

test('the rule request names the lesson and demands do/dont form', () => {
  const { lesson, ctx, cleanup } = fixture();
  const req = buildRuleRequest(lesson, ctx.config);
  const text = renderRuleRequest(req);
  assert.match(text, /RULE DERIVATION REQUEST/);
  assert.match(text, new RegExp(lesson.id));
  assert.match(text, /Migrations deadlock when run during peak traffic/);
  assert.match(text, /directive/);
  assert.match(text, /"do"/);
  assert.match(text, /"dont"/);
  assert.match(text, /approval/i);
  cleanup();
});

test('a valid rule candidate passes', () => {
  const { valid, issues } = validateRuleCandidates([candidate()]);
  assert.deepEqual(issues, []);
  assert.equal(valid[0].directive, 'do');
  assert.equal(valid[0].severity, 'soft');
});

test('a missing or wrong directive is rejected naming both legal values', () => {
  assert.match(validateRuleCandidates([candidate({ directive: 'should' })]).issues[0].message, /"do".*"dont"/);
  assert.match(validateRuleCandidates([candidate({ directive: undefined })]).issues[0].message, /directive/);
});

test('a non-array payload is one issue', () => {
  const { issues } = validateRuleCandidates('nope');
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /array/i);
});

test('staging writes nothing into items/ — the approval gate', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const before = ctx.store.all().map((i) => i.id);
  stageRuleCandidates(root, lesson, [candidate(), candidate({ title: 'Never run migrations at 3pm', directive: 'dont' })]);

  assert.deepEqual(ctx.store.all().map((i) => i.id), before);
  assert.deepEqual(readdirSync(path.join(root, 'items')), ['lesson']);
  cleanup();
});

test('staged candidates start pending with no rule id', () => {
  const { root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  assert.equal(staging.candidates[0].state, 'pending');
  assert.equal(staging.candidates[0].ruleId, null);
  assert.ok(staging.candidates[0].key.length > 0);
  cleanup();
});

test('staging persists and reloads', () => {
  const { root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  assert.deepEqual(loadStaging(root, lesson.id), staging);
  assert.deepEqual(listStaging(root).map((s) => s.lessonId), [lesson.id]);
  cleanup();
});

test('re-staging the same lesson replaces the pending set rather than appending', () => {
  const { root, lesson, cleanup } = fixture();
  stageRuleCandidates(root, lesson, [candidate()]);
  const { staging } = stageRuleCandidates(root, lesson, [candidate({ title: 'Something else' })]);
  assert.equal(staging.candidates.length, 1);
  assert.equal(staging.candidates[0].candidate.title, 'Something else');
  cleanup();
});

test('accepting creates the rule with directive and a derived_from relation', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  const ruleId = acceptStagedRule(ctx, staging, staging.candidates[0].key);

  const rule = ctx.store.get(ruleId);
  assert.ok(rule);
  assert.equal(rule.type, 'rule');
  assert.equal(rule.extra.directive, 'do');
  assert.deepEqual(rule.scope, ['migrations/**']);
  assert.deepEqual(
    rule.relations.filter((r) => r.type === 'derived_from'),
    [{ type: 'derived_from', target: lesson.id }],
  );
  // §7.4 asks for the forward edge only. Nothing is written onto the lesson —
  // and nothing could be: a reverse relation type is not in RELATION_TYPES.
  assert.deepEqual(ctx.store.get(lesson.id)?.relations, []);
  assert.equal(staging.candidates[0].state, 'accepted');
  assert.equal(staging.candidates[0].ruleId, ruleId);
  cleanup();
});

test('the accepted rule is active — the command is the approval', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  const ruleId = acceptStagedRule(ctx, staging, staging.candidates[0].key);
  // `rule` is normative, so anything but origin: 'human' would land `draft`
  // here (trustedStatus) and this assertion is what catches that.
  assert.equal(ctx.store.get(ruleId)?.status, 'active');
  assert.equal(ctx.store.get(ruleId)?.origin, 'human');
  cleanup();
});

test('the lesson itself stays index-only — its rule is what gets injected', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  acceptStagedRule(ctx, staging, staging.candidates[0].key);
  assert.equal(ctx.store.get(lesson.id)?.type, 'lesson');
  assert.equal(ctx.config.categories.lesson.tier, 'rationale');
  cleanup();
});

test('an edit at acceptance time is honoured', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  const ruleId = acceptStagedRule(ctx, staging, staging.candidates[0].key, {
    title: 'Run migrations only between 02:00 and 05:00 UTC',
    scope: ['migrations/**', 'ops/deploy/**'],
  });
  const rule = ctx.store.get(ruleId);
  assert.equal(rule?.title, 'Run migrations only between 02:00 and 05:00 UTC');
  assert.deepEqual(rule?.scope, ['migrations/**', 'ops/deploy/**']);
  cleanup();
});

test('accepting twice is refused rather than duplicating', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  acceptStagedRule(ctx, staging, staging.candidates[0].key);
  assert.throws(() => acceptStagedRule(ctx, staging, staging.candidates[0].key), /already accepted/i);
  cleanup();
});

test('a discarded candidate can never be accepted', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  discardStagedRule(staging, staging.candidates[0].key);
  assert.equal(staging.candidates[0].state, 'discarded');
  assert.throws(() => acceptStagedRule(ctx, staging, staging.candidates[0].key), /discarded/i);
  assert.equal(ctx.store.all().filter((i) => i.type === 'rule').length, 0);
  cleanup();
});

test('an unknown key is refused and lists the real keys', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  assert.throws(
    () => acceptStagedRule(ctx, staging, 'not-a-key'),
    new RegExp(staging.candidates[0].key),
  );
  cleanup();
});

test('INVARIANT: no generated rule is ever active without an explicit accept', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [
    candidate(),
    candidate({ title: 'Never deploy on a Friday', directive: 'dont' }),
    candidate({ title: 'Always take a snapshot first' }),
  ]);

  // Nothing has been accepted. Nothing generated may exist at all, let alone be active.
  assert.equal(ctx.store.all().filter((i) => i.type === 'rule').length, 0);
  assert.equal(ctx.store.all().every((i) => i.type === 'lesson'), true);

  // Accept exactly one. Exactly one rule appears; the other two remain nowhere.
  acceptStagedRule(ctx, staging, staging.candidates[1].key);
  const rules = ctx.store.all().filter((i) => i.type === 'rule');
  assert.equal(rules.length, 1);
  assert.equal(rules[0].title, 'Never deploy on a Friday');
  assert.equal(rules[0].status, 'active', 'an explicitly accepted rule is active — that is the approval');
  assert.equal(staging.candidates[0].state, 'pending');
  assert.equal(staging.candidates[2].state, 'pending');
  cleanup();
});

test('the staging directory is gitignored working state', () => {
  const { root, lesson, cleanup } = fixture();
  stageRuleCandidates(root, lesson, [candidate()]);
  assert.ok(readdirSync(stagingDir(root)).includes('.gitignore'));
  cleanup();
});
