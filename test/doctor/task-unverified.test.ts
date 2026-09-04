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
 * **Keyed on the recorded `done` TRANSITION, not on creation** (owner ruling,
 * 2026-09-04, reversed from this check's first ship — see the docblock on
 * `VERIFIED_ON_INTRODUCED_AT` in `src/doctor/checks.ts`). A task's own `state`
 * field moving is recorded as a write naming `extra.state` among the fields it
 * moved (`mycontext edit --extra state=done`); a `create` record never carries
 * `fields` at all, so a task minted already-`done` leaves no such record, and
 * a task with NO recorded write to `state` is `checkStateUnaudited`'s
 * population (`state-unaudited.test.ts`), not this check's — see "a done task
 * with no recorded state transition is not reported by this check, and is
 * counted instead" below for the test that pins that partition.
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
const wayAfterCutoff = new Date(Date.parse(VERIFIED_ON_INTRODUCED_AT) + 60_000).toISOString();
const wayBeforeCutoff = new Date(Date.parse(VERIFIED_ON_INTRODUCED_AT) - 60_000).toISOString();

const createdAt = (itemId: string, at: string): AuditInput => (
  { kind: 'mutation', op: 'create', origin: 'human', itemId, at }
);

/**
 * `mycontext edit --extra state=<value>` — the shape of write this check
 * actually keys its cutoff on. The op is `update`, not `create`, and the log
 * never records what `state` moved TO — only that it moved — so a fixture
 * building "the task's done transition" and one building "the task's move
 * back to todo" are IDENTICAL records; only the `at` differs. See the
 * done→todo→done test below for why that is the honest reading and not a gap.
 */
const stateTransitionAt = (itemId: string, at: string): AuditInput => (
  { kind: 'mutation', op: 'update', origin: 'human', itemId, fields: ['extra.state', 'tags'], at }
);

test('a done task carrying verified_on draws nothing', () => {
  withRoot([createdAt('TASK-a', afterCutoff)], (corpus) => {
    const item = task('TASK-a', { state: 'done', verified_on: '2026-09-03' });
    assert.deepEqual(checkTaskUnverified(corpus, [item], CONFIG), []);
  });
});

test('a task whose recorded done transition postdates the field and lacks verified_on is reported', () => {
  withRoot(
    [createdAt('TASK-a', beforeCutoff), stateTransitionAt('TASK-a', afterCutoff)],
    (corpus) => {
      const item = task('TASK-a', { state: 'done' });
      const findings = checkTaskUnverified(corpus, [item], CONFIG);
      assert.equal(findings.length, 1);
      const [finding] = findings;
      assert.equal(finding!.code, 'task_unverified');
      assert.equal(finding!.item, 'TASK-a');
      assert.equal(finding!.level, 'warn');
      assert.deepEqual(finding!.remedy, { route: 'acknowledge' });
      assert.match(finding!.message, /verified_on/);
    },
  );
});

test('THE BOUNDARY: a transition recorded exactly at the cutoff is measured, not grandfathered', () => {
  withRoot(
    [createdAt('TASK-a', beforeCutoff), stateTransitionAt('TASK-a', VERIFIED_ON_INTRODUCED_AT)],
    (corpus) => {
      const findings = checkTaskUnverified(corpus, [task('TASK-a', { state: 'done' })], CONFIG);
      assert.equal(findings.length, 1);
      assert.equal(findings[0]!.code, 'task_unverified');
      assert.equal(findings[0]!.item, 'TASK-a');
    },
  );
});

test('THE BOUNDARY: a transition recorded one millisecond before the cutoff is grandfathered', () => {
  withRoot(
    [createdAt('TASK-a', beforeCutoff), stateTransitionAt('TASK-a', beforeCutoff)],
    (corpus) => {
      const findings = checkTaskUnverified(corpus, [task('TASK-a', { state: 'done' })], CONFIG);
      assert.equal(findings.length, 1);
      assert.equal(findings[0]!.code, 'task_verification_coverage');
      assert.equal(findings[0]!.item, undefined);
    },
  );
});

test('a corpus of only pre-cutoff transitions draws zero per-item findings', () => {
  // THE NEGATIVE CASE, and the one that matters most: this is the shape of
  // the tasks in the live corpus whose `state` a recorded write DID move,
  // before `verified_on` existed. A check that fires on them undoes the
  // doctor cleanup this ruling was made alongside.
  withRoot(
    [
      createdAt('TASK-a', beforeCutoff), stateTransitionAt('TASK-a', beforeCutoff),
      createdAt('TASK-b', beforeCutoff), stateTransitionAt('TASK-b', beforeCutoff),
    ],
    (corpus) => {
      const items = [task('TASK-a', { state: 'done' }), task('TASK-b', { state: 'done' })];
      const findings = checkTaskUnverified(corpus, items, CONFIG);
      assert.equal(findings.some((f) => f.item !== undefined), false);
      assert.equal(findings.length, 1, 'grandfathered tasks are counted once, not per item');
      assert.match(findings[0]!.message, /2 task\(s\)/);
    },
  );
});

test('the grandfathered disclosure is a note about the check, not a finding', () => {
  withRoot(
    [createdAt('TASK-a', beforeCutoff), stateTransitionAt('TASK-a', beforeCutoff)],
    (corpus) => {
      const [finding] = checkTaskUnverified(corpus, [task('TASK-a', { state: 'done' })], CONFIG);
      assert.equal(finding!.about, 'task_unverified');
      assert.deepEqual(finding!.remedy, { route: 'none', why: 'nothing' });
    },
  );
});

test('a done task with no recorded state transition is not reported by this check, and is counted instead', () => {
  // THE PARTITION. No write in this log ever touched `extra.state` for this
  // item — not even at creation, since a `create` record carries no `fields`
  // at all. That is `checkStateUnaudited`'s question (was this task's `done`
  // ever witnessed, or is it a hand-edit bypass, or is it simply unmeasurable)
  // and this check must not draw a second, disagreeing conclusion about the
  // same log.
  withRoot([createdAt('TASK-a', afterCutoff)], (corpus) => {
    const findings = checkTaskUnverified(corpus, [task('TASK-a', { state: 'done' })], CONFIG);
    assert.equal(findings.some((f) => f.code === 'task_unverified'), false);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.code, 'task_verification_coverage');
    assert.equal(findings[0]!.item, undefined);
    assert.deepEqual(findings[0]!.remedy, { route: 'none', why: 'nothing' });
    assert.match(findings[0]!.message, /state_unaudited/);
  });
});

test('a done task the log never saw at all is not reported by this check, and is counted instead', () => {
  withRoot([], (corpus) => {
    const findings = checkTaskUnverified(corpus, [task('TASK-imported', { state: 'done' })], CONFIG);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.code, 'task_verification_coverage');
    assert.equal(findings[0]!.item, undefined);
    assert.deepEqual(findings[0]!.remedy, { route: 'none', why: 'nothing' });
    assert.match(findings[0]!.message, /1 task\(s\)/);
  });
});

test('done -> todo -> done through the product is judged by the LATEST recorded transition', () => {
  // The log carries no VALUES, only that `state` moved (`AuditRecord.fields`'s
  // own docblock) — so this task's two writes are indistinguishable from the
  // record alone, and the newest one is what this check reads. Here that
  // newest write postdates the cutoff, so the task is reported despite its
  // first, pre-cutoff, brush with `done`.
  withRoot(
    [
      createdAt('TASK-a', beforeCutoff),
      stateTransitionAt('TASK-a', beforeCutoff), // -> done, before the field existed
      stateTransitionAt('TASK-a', afterCutoff),  // -> todo
      stateTransitionAt('TASK-a', wayAfterCutoff), // -> done again, after the field existed
    ],
    (corpus) => {
      const findings = checkTaskUnverified(corpus, [task('TASK-a', { state: 'done' })], CONFIG);
      assert.equal(findings.length, 1);
      assert.equal(findings[0]!.code, 'task_unverified');
      assert.equal(findings[0]!.item, 'TASK-a');
    },
  );
});

test('done -> todo, both recorded and both pre-cutoff, is grandfathered though the item is done today', () => {
  // The task's LAST recorded write moved it to `todo`, before the cutoff; the
  // item is `done` on disk today through a write this log never saw (exactly
  // `checkStateUnaudited`'s bypass case). This check does not know that — it
  // only knows the newest recorded touch to `state` predates the field, which
  // is enough on its own to grandfather, whatever direction that write was.
  withRoot(
    [
      createdAt('TASK-a', wayBeforeCutoff),
      stateTransitionAt('TASK-a', wayBeforeCutoff), // -> done
      stateTransitionAt('TASK-a', beforeCutoff),    // -> todo, still pre-cutoff
    ],
    (corpus) => {
      const findings = checkTaskUnverified(corpus, [task('TASK-a', { state: 'done' })], CONFIG);
      assert.equal(findings.length, 1);
      assert.equal(findings[0]!.code, 'task_verification_coverage');
      assert.equal(findings[0]!.item, undefined);
    },
  );
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
  withRoot(
    [createdAt('TASK-a', beforeCutoff), stateTransitionAt('TASK-a', afterCutoff)],
    (corpus) => {
      const item = task('TASK-a', { state: 'done', verified_on: '   ' });
      const findings = checkTaskUnverified(corpus, [item], CONFIG);
      assert.equal(findings.length, 1);
      assert.equal(findings[0]!.code, 'task_unverified');
    },
  );
});
