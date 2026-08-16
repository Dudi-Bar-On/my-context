import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  acceptStagedRule, discardStagedRule, listStaging, loadStaging, saveStaging,
  stageRuleCandidates, stagingDir, validateRuleCandidates,
  STAGING_PROTOCOL, type LessonStaging,
} from '../../src/lesson/derive.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { Store } from '../../src/core/store.ts';
import { createItem, type MutationContext } from '../../src/core/mutate.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * The sibling of `derive.test.ts`'s `fixture`, wrapped in `try/finally` so a
 * FAILING assertion still closes the store and removes the temp directory —
 * a trailing `cleanup()` only runs when every assertion above it passed.
 */
function withFixture(fn: (f: { ctx: MutationContext; root: string; lesson: Item }) => void): void {
  const base = mkdtempSync(path.join(tmpdir(), 'myctx-lesson-guards-'));
  const root = path.join(base, '.my_context');
  mkdirSync(path.join(root, 'items'), { recursive: true });
  const store = Store.open(':memory:');
  const ctx: MutationContext = { root, store, config: resolveConfig({}) };
  try {
    const lessonId = createItem(ctx, {
      type: 'lesson',
      title: 'Migrations deadlock when run during peak traffic',
      body: 'The 3pm deploy took an ACCESS EXCLUSIVE lock and queued every write.',
      origin: 'human',
    }).id;
    fn({ ctx, root, lesson: ctx.store.get(lessonId) as Item });
  } finally {
    store.close();
    removeTree(base);
  }
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

// ---------------------------------------------------------------------------
// I6 — fields the model asserted are rejected with a message, never coerced.
// ---------------------------------------------------------------------------

test('a rule candidate carrying __proto__ is rejected as an unknown field', () => {
  // The sibling of the same guard in `src/ingest/schema.ts`, and the same
  // reasoning: `CANDIDATE_FIELDS` here is a plain array and the check is
  // `Object.keys(entry).filter(...)`, which sees `__proto__` only when it is
  // an OWN enumerable property. `JSON.parse` produces one; an object literal
  // does not — and `lesson-stage --stdin` feeds this parsed JSON. The same key
  // has already defeated two other guards in this codebase by exactly this
  // route, so it is asserted rather than reasoned about.
  const raw = JSON.parse(
    `{"__proto__": {"polluted": true}, ${JSON.stringify(candidate()).slice(1)}`,
  ) as Record<string, unknown>;
  const { valid, issues } = validateRuleCandidates([raw]);
  assert.equal(valid.length, 0);
  assert.match(issues[0].message, /__proto__/);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test('a string "scope" is rejected naming the field and the accepted shape, not coerced to []', () => {
  const { valid, issues } = validateRuleCandidates([candidate({ scope: 'migrations/**' })]);
  assert.equal(valid.length, 0, 'a candidate whose scope was thrown away must not be staged as if it were fine');
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /"scope"/);
  assert.match(issues[0].message, /migrations/, 'the message must show what was passed');
  assert.match(issues[0].message, /array/i, 'the message must state the accepted shape');
});

test('a non-string entry inside "scope" is rejected rather than filtered out', () => {
  const { valid, issues } = validateRuleCandidates([candidate({ scope: ['migrations/**', 42] })]);
  assert.equal(valid.length, 0);
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /"scope" entry 1/);
  assert.match(issues[0].message, /42/);
});

test('an empty-string entry inside "scope" is rejected rather than filtered out', () => {
  const { valid, issues } = validateRuleCandidates([candidate({ scope: ['migrations/**', '   '] })]);
  assert.equal(valid.length, 0);
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /"scope" entry 1 is empty/);
});

test('a missing "body" is rejected — the schema declares it required', () => {
  const raw = candidate();
  delete raw.body;
  const { valid, issues } = validateRuleCandidates([raw]);
  assert.equal(valid.length, 0, 'a rule with no stated reason must not be staged');
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /"body" is required/);
});

test('a non-string or blank "body" is rejected, not coerced to the empty string', () => {
  for (const body of [42, null, { why: 'x' }, '', '   ']) {
    const { valid, issues } = validateRuleCandidates([candidate({ body })]);
    assert.equal(valid.length, 0, `body ${JSON.stringify(body)} must be rejected`);
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /"body"/);
  }
});

test('a field the schema does not declare is reported, not silently dropped', () => {
  const { valid, issues } = validateRuleCandidates([candidate({ rationale: 'smuggled', confidence: 0.9 })]);
  assert.equal(valid.length, 0);
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /"rationale"/);
  assert.match(issues[0].message, /"confidence"/);
});

// Kills the recorded surviving mutant "delete the severity enum check": with
// that check gone, `severity: 'critical'` coerces to 'soft' and no issue is
// reported, so `valid.length` becomes 1 here.
test('an out-of-enum "severity" is rejected rather than coerced to soft', () => {
  const { valid, issues } = validateRuleCandidates([candidate({ severity: 'critical' })]);
  assert.equal(valid.length, 0);
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /"severity" must be "hard" or "soft"/);
});

test('an OMITTED severity still defaults to soft — the default is not what was being fixed', () => {
  const raw = candidate();
  delete raw.severity;
  const { valid, issues } = validateRuleCandidates([raw]);
  assert.deepEqual(issues, []);
  assert.equal(valid[0].severity, 'soft');
});

test('a rejected candidate does not take its valid siblings down with it', () => {
  const { valid, issues } = validateRuleCandidates([
    candidate(),
    candidate({ title: 'Never deploy on a Friday', directive: 'dont', scope: 'ops/**' }),
  ]);
  assert.equal(valid.length, 1);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].index, 1);
});

// ---------------------------------------------------------------------------
// Recorded surviving mutant: widening LESSON_ID_RE.
// ---------------------------------------------------------------------------

test('a lesson id containing a path separator never becomes a staging path', () => {
  withFixture(({ root, ctx, lesson }) => {
    for (const bad of ['../evil', '..\\evil', 'a/b', 'a\\b', 'nested/../../evil']) {
      assert.throws(() => loadStaging(root, bad), /not a valid lesson id/i, `loadStaging accepted ${bad}`);
      assert.throws(() => discardStagedRule(root, bad, 'k'), /not a valid lesson id/i, `discardStagedRule accepted ${bad}`);
      assert.throws(() => acceptStagedRule(ctx, root, bad, 'k'), /not a valid lesson id/i, `acceptStagedRule accepted ${bad}`);
      assert.throws(
        () => saveStaging(root, { protocol: STAGING_PROTOCOL, lessonId: bad, createdAt: '', candidates: [] }),
        /not a valid lesson id/i,
        `saveStaging accepted ${bad}`,
      );
    }
    // And nothing escaped: the only thing the refusals could have written is
    // inside `.staging/`, so the lesson's own directory tree is untouched.
    assert.equal(existsSync(path.join(root, '..', 'evil.json')), false);
    assert.equal(lesson.type, 'lesson');
  });
});

test('saveStaging survives the staging file being held open for reading (the NTFS antivirus hazard)', { skip: process.platform !== 'win32' ? 'Windows-only: EPERM-on-rename-over-open-file is a Windows-specific failure mode' : false }, async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-stage-hold-'));
  const staging: LessonStaging = {
    protocol: STAGING_PROTOCOL, lessonId: 'LESSON-held', createdAt: '2026-08-16T00:00:00.000Z',
    candidates: [],
  };
  saveStaging(root, staging); // create the target once so there is something to rename over

  // A separate process holds the destination open for READ for ~70ms; on
  // NTFS a bare renameSync over it fails EPERM immediately, so this test
  // fails without the retryOnTransientFsError wrap in saveStaging.
  const holder = spawn(process.execPath, ['-e', `
    const fs = require('node:fs');
    const fd = fs.openSync(process.argv[1], 'r');
    setTimeout(() => { fs.closeSync(fd); }, 70);
  `, path.join(stagingDir(root), 'LESSON-held.json')], { stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 20)); // let the holder actually open its handle

  assert.doesNotThrow(() => saveStaging(root, staging));

  await new Promise((res) => holder.on('exit', res));
  removeTree(root);
});

// ---------------------------------------------------------------------------
// Recorded surviving mutant: listStaging's protocol filter.
// ---------------------------------------------------------------------------

test('listStaging excludes a file whose protocol is not the staging protocol', () => {
  withFixture(({ root, lesson }) => {
    stageRuleCandidates(root, lesson, [candidate()]);
    // A second file in the same directory that is valid JSON but is not a
    // staging document. Without the protocol filter it would be reported as a
    // lesson with pending approvals (`status` counts these).
    writeFileSync(
      path.join(stagingDir(root), 'IMPOSTOR-notes.json'),
      JSON.stringify({ protocol: 'something-else@1', lessonId: 'IMPOSTOR-notes', createdAt: '', candidates: [] }),
      'utf8',
    );
    assert.deepEqual(listStaging(root).map((s) => s.lessonId), [lesson.id]);
  });
});

// ---------------------------------------------------------------------------
// Recorded surviving mutant: the re-stage `settled` filter.
// ---------------------------------------------------------------------------

test('re-staging carries an ACCEPTED candidate forward — the reset button is not a second accept', () => {
  withFixture(({ ctx, root, lesson }) => {
    const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
    const key = staging.candidates[0].key;
    const ruleId = acceptStagedRule(ctx, root, lesson.id, key);

    const again = stageRuleCandidates(root, lesson, [candidate()]);
    const carried = again.staging.candidates.find((c) => c.key === key);
    assert.equal(carried?.state, 'accepted', 'an accepted candidate must not come back pending');
    assert.equal(carried?.ruleId, ruleId);
    assert.throws(() => acceptStagedRule(ctx, root, lesson.id, key), /already accepted/i);
    assert.equal(ctx.store.all().filter((i) => i.type === 'rule').length, 1);
  });
});

test('re-staging carries a DISCARDED candidate forward — a rejected rule stays rejected', () => {
  withFixture(({ ctx, root, lesson }) => {
    const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
    const key = staging.candidates[0].key;
    discardStagedRule(root, lesson.id, key);

    const again = stageRuleCandidates(root, lesson, [candidate()]);
    assert.equal(again.staging.candidates.find((c) => c.key === key)?.state, 'discarded');
    assert.throws(() => acceptStagedRule(ctx, root, lesson.id, key), /discarded/i);
    assert.equal(ctx.store.all().filter((i) => i.type === 'rule').length, 0);
  });
});

test('re-staging returns the pending candidates it dropped instead of losing them silently', () => {
  withFixture(({ root, lesson }) => {
    const first = stageRuleCandidates(root, lesson, [
      candidate(),
      candidate({ title: 'Never deploy on a Friday', directive: 'dont' }),
    ]);
    const goneKey = first.staging.candidates[1].key;

    const second = stageRuleCandidates(root, lesson, [candidate()]);
    assert.equal(second.dropped.length, 1);
    assert.equal(second.dropped[0].key, goneKey);
    assert.equal(second.dropped[0].candidate.title, 'Never deploy on a Friday');
    // A candidate that IS produced again is not "dropped" — it is still staged.
    assert.equal(second.dropped.some((c) => c.key === first.staging.candidates[0].key), false);
  });
});

// ---------------------------------------------------------------------------
// I7 — absent and unparseable are different outcomes.
// ---------------------------------------------------------------------------

test('loadStaging returns null when there is no staging file at all', () => {
  withFixture(({ root, lesson }) => {
    assert.equal(loadStaging(root, lesson.id), null);
  });
});

test('loadStaging throws — naming the file — when the staging file exists but is unparseable', () => {
  withFixture(({ root, lesson }) => {
    stageRuleCandidates(root, lesson, [candidate()]);
    const file = path.join(stagingDir(root), `${lesson.id}.json`);
    writeFileSync(file, '{ this is not json', 'utf8');

    assert.throws(() => loadStaging(root, lesson.id), (err: Error) => {
      assert.match(err.message, /not valid JSON/i);
      assert.ok(err.message.includes(file), `the message must name the file so a human can inspect it: ${err.message}`);
      return true;
    });
  });
});

test('loadStaging refuses a staging file whose top level is not an object, or whose candidates are not an array', () => {
  withFixture(({ root, lesson }) => {
    const file = path.join(stagingDir(root), `${lesson.id}.json`);
    stageRuleCandidates(root, lesson, [candidate()]);

    writeFileSync(file, '[]', 'utf8');
    assert.throws(() => loadStaging(root, lesson.id), /not an object/i);

    writeFileSync(file, JSON.stringify({
      protocol: STAGING_PROTOCOL, lessonId: lesson.id, createdAt: '', candidates: 'all of them',
    }), 'utf8');
    assert.throws(() => loadStaging(root, lesson.id), /"candidates".*not an array/i);
  });
});

test('stageRuleCandidates refuses to overwrite an unreadable staging file, leaving it byte-for-byte intact', () => {
  withFixture(({ root, lesson }) => {
    stageRuleCandidates(root, lesson, [candidate()]);
    const file = path.join(stagingDir(root), `${lesson.id}.json`);
    const corrupt = '{ this is not json';
    writeFileSync(file, corrupt, 'utf8');

    assert.throws(() => stageRuleCandidates(root, lesson, [candidate()]), /not valid JSON/i);
    assert.equal(readFileSync(file, 'utf8'), corrupt, 'the corrupt file is working state a human must look at');
  });
});

// The resurrection scenario, at the module level: discard, corrupt, re-stage.
// Before the fix, `loadStaging` returned null for the corrupt file,
// `stageRuleCandidates` read that as "nothing staged yet" and wrote a fresh
// file in which the discarded candidate was `pending` again — the reset
// button resurrecting a rejected rule on the approval gate.
test('a discarded candidate cannot be resurrected by corrupting the staging file and re-staging', () => {
  withFixture(({ ctx, root, lesson }) => {
    const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
    const key = staging.candidates[0].key;
    discardStagedRule(root, lesson.id, key);

    writeFileSync(path.join(stagingDir(root), `${lesson.id}.json`), '{ corrupted', 'utf8');
    assert.throws(() => stageRuleCandidates(root, lesson, [candidate()]), /cannot be trusted/i);

    // Repairing the file by hand is the human's job; deleting it is the other
    // route, and it must NOT bring the discard back either way. Here the file
    // is still corrupt, so accept refuses on those grounds rather than
    // creating anything.
    assert.throws(() => acceptStagedRule(ctx, root, lesson.id, key), /cannot be trusted/i);
    assert.equal(ctx.store.all().filter((i) => i.type === 'rule').length, 0);
  });
});

test('a wrong-protocol staging file is refused rather than silently replaced by a re-stage', () => {
  withFixture(({ root, lesson }) => {
    const wrong: LessonStaging = {
      protocol: 'my_context/lesson-staging@0',
      lessonId: lesson.id,
      createdAt: new Date().toISOString(),
      candidates: [],
    };
    saveStaging(root, wrong);
    assert.throws(() => stageRuleCandidates(root, lesson, [candidate()]), /protocol/i);
    assert.equal(JSON.parse(readFileSync(path.join(stagingDir(root), `${lesson.id}.json`), 'utf8')).protocol, wrong.protocol);
  });
});
