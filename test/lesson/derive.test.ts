import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  buildRuleRequest, renderRuleRequest, validateRuleCandidates, stageRuleCandidates,
  acceptStagedRule, discardStagedRule, loadStaging, listStaging, stagingDir, saveStaging,
  STAGING_PROTOCOL, type LessonStaging,
} from '../../src/lesson/derive.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { Store } from '../../src/core/store.ts';
import { createItem, type MutationContext } from '../../src/core/mutate.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

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
  return { ctx, root, lesson, cleanup: () => { store.close(); removeTree(base); } };
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

test('the rendered request includes readable prose instructions above the JSON payload', () => {
  const { lesson, ctx, cleanup } = fixture();
  const req = buildRuleRequest(lesson, ctx.config);
  const text = renderRuleRequest(req);
  const [prose] = text.split('```json');
  const instructions = req.instructions as string[];
  const bulletLines = prose.split('\n').filter((l) => l.startsWith('- '));
  // Every instruction line must appear as its own rendered bullet in the
  // prose section — not merely be present somewhere in the embedded JSON
  // dump, which repeats the same array and would otherwise mask a mutant
  // that drops the bullet-rendering step entirely.
  assert.equal(bulletLines.length, instructions.length);
  assert.match(prose, /- NOTHING you return is applied\./);
  cleanup();
});

test('a valid rule candidate passes', () => {
  const { valid, issues } = validateRuleCandidates([candidate()]);
  assert.deepEqual(issues, []);
  assert.equal(valid[0].directive, 'do');
  assert.equal(valid[0].severity, 'soft');
});

test('a hard-severity candidate round-trips through validation, staging and acceptance', () => {
  const { valid } = validateRuleCandidates([candidate({ severity: 'hard' })]);
  assert.equal(valid[0].severity, 'hard');

  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate({ severity: 'hard' })]);
  const ruleId = acceptStagedRule(ctx, root, lesson.id, staging.candidates[0].key);
  assert.equal(ctx.store.get(ruleId)?.severity, 'hard');
  cleanup();
});

test('a missing or wrong directive is rejected naming both legal values', () => {
  assert.match(validateRuleCandidates([candidate({ directive: 'should' })]).issues[0].message, /"do".*"dont"/);
  assert.match(validateRuleCandidates([candidate({ directive: undefined })]).issues[0].message, /directive/);
});

test('a title over 200 characters is rejected at exactly the documented limit', () => {
  const longTitle = 'x'.repeat(201);
  const { issues } = validateRuleCandidates([candidate({ title: longTitle })]);
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /limit is 200/);
});

test('a bare "**" scope glob on a rule candidate is rejected as redundant, not as too broad', () => {
  const { issues } = validateRuleCandidates([candidate({ scope: ['**'] })]);
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /matches the whole repository/i);
  assert.match(issues[0].message, /omitting "scope" already does/i);
  assert.doesNotMatch(issues[0].message, /inert/i);
});

test('a backslash scope glob on a rule candidate is rejected', () => {
  const { issues } = validateRuleCandidates([candidate({ scope: ['src\\db\\**'] })]);
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /backslash/i);
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

test('two candidates sharing a title and directive but differing content get distinct keys', () => {
  const { root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [
    candidate({ body: 'First mechanism.' }),
    candidate({ body: 'A completely different mechanism.' }),
  ]);
  assert.equal(staging.candidates.length, 2);
  assert.notEqual(staging.candidates[0].key, staging.candidates[1].key);
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
  const ruleId = acceptStagedRule(ctx, root, lesson.id, staging.candidates[0].key);

  const rule = ctx.store.get(ruleId);
  assert.ok(rule);
  assert.equal(rule.type, 'rule');
  assert.equal(rule.extra.directive, 'do');
  assert.deepEqual(rule.scope, ['migrations/**']);
  assert.deepEqual(
    rule.relations.filter((r) => r.type === 'derived_from'),
    [{ type: 'derived_from', target: lesson.id }],
  );
  // §7.4 asks for the forward edge only. This module simply never calls
  // linkItems or writes a second relation — createItem itself does not
  // enforce the closed relation-type vocabulary (only linkItems does), so
  // this is a choice this module makes, not something it is prevented from
  // doing otherwise.
  assert.deepEqual(ctx.store.get(lesson.id)?.relations, []);

  const after = loadStaging(root, lesson.id);
  assert.equal(after?.candidates[0].state, 'accepted');
  assert.equal(after?.candidates[0].ruleId, ruleId);
  cleanup();
});

test('the accepted rule is active — the command is the approval', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  const ruleId = acceptStagedRule(ctx, root, lesson.id, staging.candidates[0].key);
  // `rule` is normative, so anything but origin: 'human' would land `draft`
  // here (trustedStatus) and this assertion is what catches that.
  assert.equal(ctx.store.get(ruleId)?.status, 'active');
  assert.equal(ctx.store.get(ruleId)?.origin, 'human');
  cleanup();
});

test('the lesson itself stays index-only — its rule is what gets injected', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  acceptStagedRule(ctx, root, lesson.id, staging.candidates[0].key);
  assert.equal(ctx.store.get(lesson.id)?.type, 'lesson');
  assert.equal(ctx.config.categories.lesson.tier, 'rationale');
  cleanup();
});

test('an edit at acceptance time is honoured', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  const ruleId = acceptStagedRule(ctx, root, lesson.id, staging.candidates[0].key, {
    title: 'Run migrations only between 02:00 and 05:00 UTC',
    scope: ['migrations/**', 'ops/deploy/**'],
  });
  const rule = ctx.store.get(ruleId);
  assert.equal(rule?.title, 'Run migrations only between 02:00 and 05:00 UTC');
  assert.deepEqual(rule?.scope, ['migrations/**', 'ops/deploy/**']);
  cleanup();
});

test('an edit cannot smuggle in a bare scope glob or an invalid directive', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  const badEdits = { scope: ['**'], directive: 'maybe' } as unknown as Partial<import('../../src/lesson/derive.ts').RuleCandidate>;
  assert.throws(
    () => acceptStagedRule(ctx, root, lesson.id, staging.candidates[0].key, badEdits),
    /too broad|"do".*"dont"/i,
  );
  assert.equal(ctx.store.all().filter((i) => i.type === 'rule').length, 0);
  cleanup();
});

test('accepting twice is refused rather than duplicating — persisted across separate calls', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  acceptStagedRule(ctx, root, lesson.id, staging.candidates[0].key);
  // A fresh call, with no reference to the first call's state — this is
  // what proves the "already accepted" refusal is a property of what is on
  // disk, not of an in-memory object the caller happened to keep around.
  assert.throws(() => acceptStagedRule(ctx, root, lesson.id, staging.candidates[0].key), /already accepted/i);
  assert.equal(ctx.store.all().filter((i) => i.type === 'rule').length, 1);
  cleanup();
});

test('a discarded candidate can never be accepted', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  const key = staging.candidates[0].key;
  const after = discardStagedRule(root, lesson.id, key);
  assert.equal(after.candidates[0].state, 'discarded');
  assert.throws(() => acceptStagedRule(ctx, root, lesson.id, key), /discarded/i);
  assert.equal(ctx.store.all().filter((i) => i.type === 'rule').length, 0);
  cleanup();
});

test('discarding an already-accepted candidate is refused', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  const key = staging.candidates[0].key;
  acceptStagedRule(ctx, root, lesson.id, key);
  assert.throws(() => discardStagedRule(root, lesson.id, key), /already accepted/i);
  cleanup();
});

test('an unknown key is refused and lists the real keys', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  assert.throws(
    () => acceptStagedRule(ctx, root, lesson.id, 'not-a-key'),
    new RegExp(staging.candidates[0].key),
  );
  cleanup();
});

test('accepting against a lesson with no staged candidates on disk is refused', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  assert.throws(
    () => acceptStagedRule(ctx, root, lesson.id, 'anything'),
    /no staged rule candidates/i,
  );
  cleanup();
});

test('a hand-crafted staging file for a lesson that does not exist is refused', () => {
  const { ctx, root, cleanup } = fixture();
  const ghostLessonId = 'LESSON-ghost-never-created';
  const forged: LessonStaging = {
    protocol: STAGING_PROTOCOL,
    lessonId: ghostLessonId,
    createdAt: new Date().toISOString(),
    candidates: [{
      key: 'forged01',
      candidate: {
        title: 'A rule with no real lesson behind it',
        directive: 'do',
        body: 'Fabricated.',
        scope: [],
        severity: 'hard',
      },
      state: 'pending',
      ruleId: null,
    }],
  };
  // Written through the module's own saveStaging — simulating a tampered or
  // orphaned staging file on disk, not a bypass of any API.
  saveStaging(root, forged);

  assert.throws(
    () => acceptStagedRule(ctx, root, ghostLessonId, 'forged01'),
    /no longer exists|cannot be found/i,
  );
  assert.equal(ctx.store.all().filter((i) => i.type === 'rule').length, 0);
  cleanup();
});

test('a staging file with the wrong protocol is refused rather than trusted', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const wrongProtocol: LessonStaging = {
    protocol: 'some-other-protocol@1',
    lessonId: lesson.id,
    createdAt: new Date().toISOString(),
    candidates: [{
      key: 'wrongproto',
      candidate: { title: 'Should never be reachable', directive: 'do', body: 'x', scope: [], severity: 'soft' },
      state: 'pending',
      ruleId: null,
    }],
  };
  saveStaging(root, wrongProtocol);

  assert.throws(() => acceptStagedRule(ctx, root, lesson.id, 'wrongproto'), /protocol/i);
  assert.equal(ctx.store.all().filter((i) => i.type === 'rule').length, 0);
  cleanup();
});

test('a lesson id containing a path separator is refused rather than escaping .staging/', () => {
  const { root, cleanup } = fixture();
  assert.throws(() => loadStaging(root, '../../evil'), /not a valid lesson id/i);
  cleanup();
});

test('a staging file whose filename and internal lessonId disagree is refused', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const otherLessonId = createItem(ctx, {
    type: 'lesson',
    title: 'A second, unrelated lesson',
    body: 'Unrelated body text.',
    origin: 'human',
  }).id;

  // Legitimately stage against `lesson`, producing a real file at
  // `.staging/<lesson.id>.json` whose contents correctly name `lesson.id`.
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);

  // Tamper with that EXACT file on disk so its filename still names `lesson`
  // but its own `lessonId` field now names `otherLessonId`. This is the only
  // way the mismatch can occur: `saveStaging` always derives the filename
  // from `staging.lessonId`, and `stageRuleCandidates` always sets that
  // field to the lesson it was called with, so no legitimate call path can
  // produce this — it simulates anything else with write access to
  // `.staging/` (see the report's verdict: the staging directory is
  // unauthenticated working state).
  const tampered = { ...staging, lessonId: otherLessonId };
  writeFileSync(
    path.join(stagingDir(root), `${lesson.id}.json`),
    JSON.stringify(tampered, null, 2) + '\n',
    'utf8',
  );

  assert.throws(
    () => acceptStagedRule(ctx, root, lesson.id, staging.candidates[0].key),
    /names a different lesson/i,
  );
  // No rule was created, and no stray file appeared at a second location —
  // acceptStagedRule never wrote anything, because it refused before ever
  // reaching createItem or saveStaging.
  assert.equal(ctx.store.all().filter((i) => i.type === 'rule').length, 0);
  assert.deepEqual(
    readdirSync(stagingDir(root)).filter((n) => n.endsWith('.json')),
    [`${lesson.id}.json`],
  );
  cleanup();
});

test('a staging file that is not valid JSON is refused as corrupt, not as merely missing', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  stageRuleCandidates(root, lesson, [candidate()]);
  writeFileSync(path.join(stagingDir(root), `${lesson.id}.json`), '{ this is not json', 'utf8');

  assert.throws(
    () => acceptStagedRule(ctx, root, lesson.id, 'anything'),
    /not valid JSON/i,
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
  acceptStagedRule(ctx, root, lesson.id, staging.candidates[1].key);
  const rules = ctx.store.all().filter((i) => i.type === 'rule');
  assert.equal(rules.length, 1);
  assert.equal(rules[0].title, 'Never deploy on a Friday');
  assert.equal(rules[0].status, 'active', 'an explicitly accepted rule is active — that is the approval');

  const after = loadStaging(root, lesson.id);
  assert.equal(after?.candidates[0].state, 'pending');
  assert.equal(after?.candidates[2].state, 'pending');
  cleanup();
});

test('the staging directory is gitignored working state', () => {
  const { root, lesson, cleanup } = fixture();
  stageRuleCandidates(root, lesson, [candidate()]);
  assert.ok(readdirSync(stagingDir(root)).includes('.gitignore'));
  cleanup();
});
