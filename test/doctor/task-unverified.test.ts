// @basis TASK-a-grandfather-cutoff-belonging-to-this-repository-is-hard, TASK-a-scanner-enumerates-what-it-will-skip-not-what-it-will-scan,
// TASK-sweep-every-timestamp-comparison-for-the-millisecond-tie

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { recordAudit, type AuditInput } from '../../src/core/audit.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { checkTaskUnverified } from '../../src/doctor/checks.ts';
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
 * `verifiedOnAdoptedAt` in `src/doctor/checks.ts`). A task's own `state`
 * field moving is recorded as a write naming `extra.state` among the fields it
 * moved (`mycontext edit --extra state=done`); a `create` record never carries
 * `fields` at all, so a task minted already-`done` leaves no such record, and
 * a task with NO recorded write to `state` is `checkStateUnaudited`'s
 * population (`state-unaudited.test.ts`), not this check's — see "a done task
 * with no recorded state transition is not reported by this check, and is
 * counted instead" below for the test that pins that partition.
 *
 * ── THE LINE IS THE WORKSPACE'S OWN, AND THIS FIXTURE PROVES IT IS ──────────
 *
 * Until 2026-09-14 every fixture here was built out of
 * `VERIFIED_ON_INTRODUCED_AT`, the product's hard-coded `2026-09-03T12:00Z` —
 * so every green assertion in this file was powered by THIS REPOSITORY'S
 * history, imported from the code under test. A fixture built that way cannot
 * fail the way a stranger's install fails, because it has agreed in advance to
 * the same date.
 *
 * `ADOPTED_AT` below is a FIXTURE constant now, and the check learns it from
 * the fixture's own audit log. Two tests make that load-bearing rather than
 * cosmetic: "the line moves with the log" runs the identical task set against
 * two logs whose only difference is the adoption instant and gets opposite
 * verdicts, and "a corpus created today" builds its whole log from
 * `Date.now()` so no date from 2026-09 appears in the decision at all.
 *
 * ── AND THE CHECK IS SILENT WHERE THE FIELD IS NOT USED ─────────────────────
 *
 * Adoption gates the whole check, so every fixture that expects per-item
 * findings has to establish it: `ADOPTER` is an item carrying a `verified_on`,
 * and `adoptionAt` is the log record of it being written. Take them out and
 * the check reports nothing and says so once — which is "a corpus that has
 * never used verified_on", the day-one case this file did not have.
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

/**
 * **The fixture's own adoption instant, and nothing the product knows.** The
 * check reads this date off `adoptionAt`'s record in the fixture log; it is
 * written here so the tests read, and it could be any instant at all — see
 * "the line moves with the log" and "a corpus created today", which are the
 * two tests that would still be green if this number were a lie.
 */
const ADOPTED_AT = '2026-09-03T12:00:00.000Z';

const beforeCutoff = new Date(Date.parse(ADOPTED_AT) - ONE_MS).toISOString();
const afterCutoff = new Date(Date.parse(ADOPTED_AT) + ONE_MS).toISOString();
const wayAfterCutoff = new Date(Date.parse(ADOPTED_AT) + 60_000).toISOString();
const wayBeforeCutoff = new Date(Date.parse(ADOPTED_AT) - 60_000).toISOString();

const createdAt = (itemId: string, at: string): AuditInput => (
  { kind: 'mutation', op: 'create', origin: 'human', itemId, at }
);

/**
 * **The workspace's first recorded `verified_on` write** — what
 * `verifiedOnAdoptedAt` derives the line from. `fields` names the extra key,
 * exactly as `movedFields` (core/persist.ts) reports it.
 */
const adoptionAt = (at: string): AuditInput => (
  { kind: 'mutation', op: 'update', origin: 'human', itemId: 'TASK-adopter',
    fields: ['extra.verified_on'], at }
);

/**
 * **The item that makes this corpus one that USES `verified_on`.** Without an
 * item carrying the field, the check is silent by design and every per-item
 * assertion below would be testing the silence instead. It carries one, so it
 * is never itself reported.
 */
const ADOPTER = (): Item => task('TASK-adopter', { state: 'done', verified_on: '2026-09-03' });

/** The items under test, plus the one that establishes adoption. */
const adopting = (...items: Item[]): Item[] => [ADOPTER(), ...items];

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
    [adoptionAt(ADOPTED_AT), createdAt('TASK-a', beforeCutoff), stateTransitionAt('TASK-a', afterCutoff)],
    (corpus) => {
      const item = task('TASK-a', { state: 'done' });
      const findings = checkTaskUnverified(corpus, adopting(item), CONFIG);
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
    [adoptionAt(ADOPTED_AT), createdAt('TASK-a', beforeCutoff), stateTransitionAt('TASK-a', ADOPTED_AT)],
    (corpus) => {
      const findings = checkTaskUnverified(corpus, adopting(task('TASK-a', { state: 'done' })), CONFIG);
      assert.equal(findings.length, 1);
      assert.equal(findings[0]!.code, 'task_unverified');
      assert.equal(findings[0]!.item, 'TASK-a');
    },
  );
});

test('THE BOUNDARY: a transition recorded one millisecond before the cutoff is grandfathered', () => {
  withRoot(
    [adoptionAt(ADOPTED_AT), createdAt('TASK-a', beforeCutoff), stateTransitionAt('TASK-a', beforeCutoff)],
    (corpus) => {
      const findings = checkTaskUnverified(corpus, adopting(task('TASK-a', { state: 'done' })), CONFIG);
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
      adoptionAt(ADOPTED_AT),
      createdAt('TASK-a', beforeCutoff), stateTransitionAt('TASK-a', beforeCutoff),
      createdAt('TASK-b', beforeCutoff), stateTransitionAt('TASK-b', beforeCutoff),
    ],
    (corpus) => {
      const items = adopting(task('TASK-a', { state: 'done' }), task('TASK-b', { state: 'done' }));
      const findings = checkTaskUnverified(corpus, items, CONFIG);
      assert.equal(findings.some((f) => f.item !== undefined), false);
      assert.equal(findings.length, 1, 'grandfathered tasks are counted once, not per item');
      assert.match(findings[0]!.message, /2 task\(s\)/);
    },
  );
});

test('the grandfathered disclosure is a note about the check, not a finding', () => {
  withRoot(
    [adoptionAt(ADOPTED_AT), createdAt('TASK-a', beforeCutoff), stateTransitionAt('TASK-a', beforeCutoff)],
    (corpus) => {
      const [finding] = checkTaskUnverified(corpus, adopting(task('TASK-a', { state: 'done' })), CONFIG);
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
  withRoot([adoptionAt(ADOPTED_AT), createdAt('TASK-a', afterCutoff)], (corpus) => {
    const findings = checkTaskUnverified(corpus, adopting(task('TASK-a', { state: 'done' })), CONFIG);
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
    const findings = checkTaskUnverified(corpus, adopting(task('TASK-imported', { state: 'done' })), CONFIG);
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
      adoptionAt(ADOPTED_AT),
      createdAt('TASK-a', beforeCutoff),
      stateTransitionAt('TASK-a', beforeCutoff), // -> done, before anybody here set the field
      stateTransitionAt('TASK-a', afterCutoff),  // -> todo
      stateTransitionAt('TASK-a', wayAfterCutoff), // -> done again, after adoption
    ],
    (corpus) => {
      const findings = checkTaskUnverified(corpus, adopting(task('TASK-a', { state: 'done' })), CONFIG);
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
      adoptionAt(ADOPTED_AT),
      createdAt('TASK-a', wayBeforeCutoff),
      stateTransitionAt('TASK-a', wayBeforeCutoff), // -> done
      stateTransitionAt('TASK-a', beforeCutoff),    // -> todo, still pre-adoption
    ],
    (corpus) => {
      const findings = checkTaskUnverified(corpus, adopting(task('TASK-a', { state: 'done' })), CONFIG);
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
    [adoptionAt(ADOPTED_AT), createdAt('TASK-a', beforeCutoff), stateTransitionAt('TASK-a', afterCutoff)],
    (corpus) => {
      const item = task('TASK-a', { state: 'done', verified_on: '   ' });
      const findings = checkTaskUnverified(corpus, adopting(item), CONFIG);
      assert.equal(findings.length, 1);
      assert.equal(findings[0]!.code, 'task_unverified');
    },
  );
});

/* ── THE DAY-ONE CASE, WHICH IS WHAT `dxfindings/1` IS ABOUT ──────────────── */

test('a corpus that has never used verified_on draws no per-item findings at all', () => {
  // THE SHAPE OF A FRESH INSTALL, and the reason the hard-coded cutoff had to
  // go. Measured on a real `mycontext init` workspace on 2026-09-14 before
  // this gate existed: two tasks closed through `mycontext edit`, two
  // `task_unverified` warnings — 100% of the closed tasks, on day one. Every
  // one of those rows is unclearable except by adopting a convention nobody
  // asked the user about, which is the `RULE` at the top of checks.ts refusing
  // itself.
  withRoot(
    [createdAt('TASK-a', afterCutoff), stateTransitionAt('TASK-a', afterCutoff),
     createdAt('TASK-b', afterCutoff), stateTransitionAt('TASK-b', afterCutoff)],
    (corpus) => {
      const items = [task('TASK-a', { state: 'done' }), task('TASK-b', { state: 'done' })];
      const findings = checkTaskUnverified(corpus, items, CONFIG);
      assert.equal(findings.some((f) => f.code === 'task_unverified'), false);
      assert.equal(findings.length, 1, 'the silence is disclosed once, not per item');
      assert.equal(findings[0]!.code, 'task_verification_coverage');
      assert.equal(findings[0]!.about, 'task_unverified');
      assert.equal(findings[0]!.item, undefined);
      assert.deepEqual(findings[0]!.remedy, { route: 'none', why: 'nothing' });
      assert.match(findings[0]!.message, /2 task\(s\)/);
      assert.match(findings[0]!.message, /no item in this corpus has ever carried one/);
    },
  );
});

test('one verified_on anywhere in the corpus switches the check on', () => {
  // The other side of the same gate, and the reason it is adoption rather
  // than a count: ONE item carrying the field is this project saying it uses
  // it, and from then on a closed task without one is a real gap. The task
  // set here is identical to the test above — only `ADOPTER` is added.
  withRoot(
    [adoptionAt(ADOPTED_AT),
     createdAt('TASK-a', afterCutoff), stateTransitionAt('TASK-a', afterCutoff),
     createdAt('TASK-b', afterCutoff), stateTransitionAt('TASK-b', afterCutoff)],
    (corpus) => {
      const items = adopting(task('TASK-a', { state: 'done' }), task('TASK-b', { state: 'done' }));
      const findings = checkTaskUnverified(corpus, items, CONFIG);
      assert.deepEqual(
        findings.filter((f) => f.code === 'task_unverified').map((f) => f.item).sort(),
        ['TASK-a', 'TASK-b'],
      );
    },
  );
});

/* ── THE LINE IS THE WORKSPACE'S, NOT THE PRODUCT'S ──────────────────────── */

test('the line moves with the log: the same task set is judged both ways', () => {
  // THE PROOF THAT THE FIXTURE NO LONGER CARRIES THE POWER. Identical items,
  // identical `state` transition, identical everything — except WHEN this
  // workspace first wrote a `verified_on`. A check reading a constant would
  // answer the same both times; this one answers oppositely, which is the
  // only evidence that the line comes from the log at all.
  const transition = '2026-06-15T00:00:00.000Z';
  const items = (): Item[] => adopting(task('TASK-a', { state: 'done' }));

  withRoot(
    [adoptionAt('2026-06-14T00:00:00.000Z'), stateTransitionAt('TASK-a', transition)],
    (corpus) => {
      const findings = checkTaskUnverified(corpus, items(), CONFIG);
      assert.equal(findings.length, 1);
      assert.equal(findings[0]!.code, 'task_unverified', 'adopted BEFORE the close: reported');
      assert.equal(findings[0]!.item, 'TASK-a');
    },
  );

  withRoot(
    [adoptionAt('2026-06-16T00:00:00.000Z'), stateTransitionAt('TASK-a', transition)],
    (corpus) => {
      const findings = checkTaskUnverified(corpus, items(), CONFIG);
      assert.equal(findings.length, 1);
      assert.equal(
        findings[0]!.code, 'task_verification_coverage',
        'adopted AFTER the close: grandfathered',
      );
      assert.equal(findings[0]!.item, undefined);
      assert.match(findings[0]!.message, /2026-06-16T00:00:00\.000Z/);
    },
  );
});

test('a corpus created today: no date from this repository appears in the verdict', () => {
  // The trap this file fell into for eleven days: a fixture built out of the
  // product's own cutoff has already agreed with it. Every instant here comes
  // from `Date.now()`, so a cutoff hard-coded anywhere in `checks.ts` would
  // have to be in the future to change these answers — and both verdicts are
  // still correct, which is what "a workspace created today" means.
  const now = Date.now();
  const iso = (offsetMs: number): string => new Date(now + offsetMs).toISOString();
  const adopted = iso(-60_000);

  withRoot(
    [adoptionAt(adopted), stateTransitionAt('TASK-a', iso(-30_000))],
    (corpus) => {
      const findings = checkTaskUnverified(corpus, adopting(task('TASK-a', { state: 'done' })), CONFIG);
      assert.equal(findings.length, 1);
      assert.equal(findings[0]!.code, 'task_unverified', 'closed after today\'s adoption: reported');
    },
  );

  withRoot(
    [adoptionAt(adopted), stateTransitionAt('TASK-a', iso(-90_000))],
    (corpus) => {
      const findings = checkTaskUnverified(corpus, adopting(task('TASK-a', { state: 'done' })), CONFIG);
      assert.equal(findings.length, 1);
      assert.equal(
        findings[0]!.code, 'task_verification_coverage',
        'closed before today\'s adoption: grandfathered',
      );
    },
  );
});

test('adoption the log never witnessed grandfathers nothing, and still reports', () => {
  // A task minted with `--extra verified_on=…` already set leaves no `fields`
  // at all, so the corpus can be an adopter with no dated adoption in the log.
  // `verifiedOnAdoptedAt` answers `null` there, which grandfathers nobody —
  // the same answer the old constant gave on this corpus, and the honest one:
  // there is no measured instant to compare against.
  withRoot(
    [createdAt('TASK-adopter', wayBeforeCutoff), stateTransitionAt('TASK-a', wayBeforeCutoff)],
    (corpus) => {
      const findings = checkTaskUnverified(corpus, adopting(task('TASK-a', { state: 'done' })), CONFIG);
      assert.equal(findings.length, 1);
      assert.equal(findings[0]!.code, 'task_unverified');
      assert.equal(findings[0]!.item, 'TASK-a');
    },
  );
});

/* -------------------------------------------------------------------------- *
 * THE MILLISECOND TIE — `TASK-sweep-every-timestamp-comparison-for-the-
 * millisecond-tie`
 *
 * `at` is `Date.toISOString()`: one-millisecond resolution, and nothing about
 * a synchronous burst of `recordAudit` calls promises the clock ticks between
 * two of them. CI's Ubuntu job landed six in one millisecond (run
 * 35715432299), which is the measurement release/13 came out of.
 *
 * The cutoff here compares two readings of THE SAME CLOCK from THE SAME LOG —
 * a task's recorded `state` transition against this workspace's first recorded
 * `verified_on` write — so `transitionAt < adoptedAt` cannot tell "same
 * millisecond, written first" from "same millisecond, written after", and a
 * task that was closed BEFORE the convention was adopted is reported as though
 * it had been closed after it.
 *
 * The monotonic fact is the one release/13 used one layer over: the record's
 * POSITION in the log. `readAudit` delivers oldest-first across every segment
 * and within a segment that is insertion order, so two records tied on `at`
 * are still ordered by where they sit — which is what the log itself
 * guarantees and what the wall clock does not.
 *
 * The two tests below are one pair: identical records, identical timestamps,
 * opposite ORDER, opposite verdicts. Neither could be written against `at`.
 * -------------------------------------------------------------------------- */

test('A TIE: a transition written BEFORE the adoption in the same millisecond is grandfathered', () => {
  withRoot(
    // Both at `ADOPTED_AT` to the millisecond, the transition first — the
    // shape a burst of writes produces on a fast machine. It happened before
    // the convention existed, so nothing is owed.
    [
      createdAt('TASK-a', wayBeforeCutoff),
      stateTransitionAt('TASK-a', ADOPTED_AT),
      adoptionAt(ADOPTED_AT),
    ],
    (corpus) => {
      const findings = checkTaskUnverified(corpus, adopting(task('TASK-a', { state: 'done' })), CONFIG);
      assert.equal(findings.length, 1,
        `expected only the coverage note: ${JSON.stringify(findings)}`);
      assert.equal(findings[0]!.code, 'task_verification_coverage',
        'THE DEFECT: a tied millisecond made a task closed BEFORE adoption look like one closed '
        + 'after it, and the warn it draws can only be cleared by an acknowledgement nobody owes');
      assert.equal(findings[0]!.item, undefined);
    },
  );
});

test('A TIE, the other way: a transition written AFTER the adoption in the same millisecond is measured', () => {
  withRoot(
    [
      createdAt('TASK-a', wayBeforeCutoff),
      adoptionAt(ADOPTED_AT),
      stateTransitionAt('TASK-a', ADOPTED_AT),
    ],
    (corpus) => {
      const findings = checkTaskUnverified(corpus, adopting(task('TASK-a', { state: 'done' })), CONFIG);
      assert.equal(findings.length, 1, JSON.stringify(findings));
      assert.equal(findings[0]!.code, 'task_unverified',
        'the ruling the boundary tests already pinned still holds: at the cutoff and after it, '
        + 'the task is measured');
      assert.equal(findings[0]!.item, 'TASK-a');
    },
  );
});
