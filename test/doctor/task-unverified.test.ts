import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { recordAudit, type AuditInput } from '../../src/core/audit.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { checkTaskUnverified, VERIFIED_ON_INTRODUCED_AT } from '../../src/doctor/checks.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * **The check that is `task.verified_on`'s only consumer.**
 *
 * The owner ruling this check exists for: a field shipped with no consumer
 * repeats the defect that was already made once. `task.verified_on` is
 * useless on its own — `checkTaskUnverified` is what makes it something a
 * `done` task can fail to have, rather than a name in `categories.ts` that
 * nothing ever reads.
 *
 * `checkStateUnaudited` (state-unaudited.test.ts) is the model this file
 * follows: a birth cutoff plus a single coverage disclosure, so a field that
 * did not exist yesterday does not turn 406 already-`done` tasks red today.
 * The cutoff here is a literal instant (`VERIFIED_ON_INTRODUCED_AT`) rather
 * than `checkStateUnaudited`'s `checksumAfter` flag, because there is no
 * structural marker for "could this task have carried `verified_on`" — only a
 * date the field became legal to write. See the docblock on
 * `checkTaskUnverified` for why that is the right substitute rather than an
 * invented one.
 */

const CONFIG = resolveConfig({});

function task(id: string, extra: Record<string, string>): Item {
  return {
    id, type: 'task', title: id, status: 'active', severity: 'soft', always: false,
    continuity: false, summary: null, summaryOf: null, summaryWas: [], acknowledged: {},
    scope: [], tags: [], origin: 'human', sourceFile: null, sourceAnchor: null,
    sourceChecksum: null, validFrom: null, validUntil: null, checksum: 'x', extra,
    body: 'Body.', steps: [], observations: [], relations: [], layer: 'project',
    filePath: `items/task/${id}.md`,
  };
}

function root(records: AuditInput[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-unverified-'));
  const corpus = path.join(dir, '.my_context');
  mkdirSync(corpus, { recursive: true });
  for (const record of records) {
    const result = recordAudit(corpus, record);
    assert.equal(result.written, true, 'the fixture log must actually be written');
  }
  return corpus;
}

function withRoot(records: AuditInput[], fn: (corpus: string) => void): void {
  const corpus = root(records);
  try {
    fn(corpus);
  } finally {
    removeTree(path.dirname(corpus));
  }
}

const ONE_MS = 1;
const beforeCutoff = new Date(Date.parse(VERIFIED_ON_INTRODUCED_AT) - ONE_MS).toISOString();
const afterCutoff = new Date(Date.parse(VERIFIED_ON_INTRODUCED_AT) + ONE_MS).toISOString();

const createdAt = (itemId: string, at: string): AuditInput => (
  { kind: 'mutation', op: 'create', origin: 'human', itemId, at }
);

test('a done task carrying verified_on draws nothing', () => {
  withRoot([createdAt('TASK-a', afterCutoff)], (corpus) => {
    const item = task('TASK-a', { state: 'done', verified_on: '2026-09-03' });
    assert.deepEqual(checkTaskUnverified(corpus, [item], CONFIG), []);
  });
});

test('a done task created after the cutoff with no verified_on is reported', () => {
  withRoot([createdAt('TASK-a', afterCutoff)], (corpus) => {
    const item = task('TASK-a', { state: 'done' });
    const findings = checkTaskUnverified(corpus, [item], CONFIG);
    assert.equal(findings.length, 1);
    const [finding] = findings;
    assert.equal(finding!.code, 'task_unverified');
    assert.equal(finding!.item, 'TASK-a');
    assert.equal(finding!.level, 'warn');
    assert.deepEqual(finding!.remedy, { route: 'acknowledge' });
    assert.match(finding!.message, /verified_on/);
  });
});

test('THE BOUNDARY: created exactly at the cutoff is measured, not grandfathered', () => {
  withRoot([createdAt('TASK-a', VERIFIED_ON_INTRODUCED_AT)], (corpus) => {
    const findings = checkTaskUnverified(corpus, [task('TASK-a', { state: 'done' })], CONFIG);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.code, 'task_unverified');
    assert.equal(findings[0]!.item, 'TASK-a');
  });
});

test('THE BOUNDARY: created one millisecond before the cutoff is grandfathered', () => {
  withRoot([createdAt('TASK-a', beforeCutoff)], (corpus) => {
    const findings = checkTaskUnverified(corpus, [task('TASK-a', { state: 'done' })], CONFIG);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.code, 'task_verification_coverage');
    assert.equal(findings[0]!.item, undefined);
  });
});

test('a corpus of only pre-cutoff done tasks draws zero per-item findings', () => {
  // THE NEGATIVE CASE, and the one that matters most: this is the shape of
  // the 406 already-`done` tasks in the live corpus the day this check
  // ships. A check that fires on them undoes the doctor cleanup this ruling
  // was made alongside.
  withRoot([createdAt('TASK-a', beforeCutoff), createdAt('TASK-b', beforeCutoff)], (corpus) => {
    const items = [task('TASK-a', { state: 'done' }), task('TASK-b', { state: 'done' })];
    const findings = checkTaskUnverified(corpus, items, CONFIG);
    assert.equal(findings.some((f) => f.item !== undefined), false);
    assert.equal(findings.length, 1, 'grandfathered tasks are counted once, not per item');
    assert.match(findings[0]!.message, /2 task\(s\)/);
  });
});

test('the grandfathered disclosure is a note about the check, not a finding', () => {
  withRoot([createdAt('TASK-a', beforeCutoff)], (corpus) => {
    const [finding] = checkTaskUnverified(corpus, [task('TASK-a', { state: 'done' })], CONFIG);
    assert.equal(finding!.about, 'task_unverified');
    assert.deepEqual(finding!.remedy, { route: 'none', why: 'nothing' });
  });
});

test('a done task the log never saw at all is named as UNMEASURED, not accused', () => {
  withRoot([], (corpus) => {
    const findings = checkTaskUnverified(corpus, [task('TASK-imported', { state: 'done' })], CONFIG);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.code, 'task_verification_coverage');
    assert.equal(findings[0]!.item, undefined);
    assert.deepEqual(findings[0]!.remedy, { route: 'copy', argv: ['mycontext', 'audit', '--files'] });
  });
});

test('an open task is not asked about at all', () => {
  withRoot([createdAt('TASK-a', afterCutoff)], (corpus) => {
    const items = [
      task('TASK-a', { state: 'todo' }),
      { ...task('TASK-b', { state: 'doing' }) },
      { ...task('TASK-c', { state: 'blocked' }) },
    ];
    assert.deepEqual(checkTaskUnverified(corpus, items, CONFIG), []);
  });
});

test('an item that is not a work item is not asked about at all', () => {
  withRoot([createdAt('DEC-a', afterCutoff)], (corpus) => {
    const decision = { ...task('DEC-a', { state: 'done' }), type: 'decision' };
    assert.deepEqual(checkTaskUnverified(corpus, [decision], CONFIG), []);
  });
});

test('a superseded task is out of scope, as it is for every other task check', () => {
  withRoot([createdAt('TASK-a', afterCutoff)], (corpus) => {
    const gone = { ...task('TASK-a', { state: 'done' }), status: 'superseded' as const };
    assert.deepEqual(checkTaskUnverified(corpus, [gone], CONFIG), []);
  });
});

test('an empty verified_on is treated the same as an absent one', () => {
  withRoot([createdAt('TASK-a', afterCutoff)], (corpus) => {
    const item = task('TASK-a', { state: 'done', verified_on: '   ' });
    const findings = checkTaskUnverified(corpus, [item], CONFIG);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.code, 'task_unverified');
  });
});
