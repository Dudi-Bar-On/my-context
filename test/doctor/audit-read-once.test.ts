// @basis TASK-two-read-endpoints-block-the-whole-server-for-about-four

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { recordAudit, type AuditInput, type AuditRecord } from '../../src/core/audit.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { auditOnce, checkAssumptionOverdue } from '../../src/doctor/checks.ts';
import { checkStateUnaudited, checkTaskUnverified } from '../../src/doctor/state-verification.ts';
import type { Item } from '../../src/core/types.ts';

/**
 * **One reading of the audit log per `doctor` run, and the seam that makes it
 * one.**
 *
 * `checkStateUnaudited`, `checkTaskUnverified` and `checkAssumptionOverdue` each
 * want every record in the log, and each called `readAudit(root)` for itself. On
 * the owner's corpus that call is **165 ms over 52,492 records in an 8.1 MB
 * `audit.jsonl`**, measured 2026-09-15; two of the three reach it on an ordinary
 * corpus, so a `doctor` run parsed the same bytes twice — 330 ms of a 700 ms
 * sweep, on the path `/api/status` and `/api/doctor` both stand behind.
 *
 * WHAT IS PINNED HERE:
 *
 *  1. `auditOnce` reads once and hands the same records back — the memo itself.
 *  2. It re-throws the SAME error without re-reading, so a log that cannot be
 *     read costs one refusal rather than three. That is why the seam is a thunk
 *     and not an array: each check still writes its own `*_coverage` finding, in
 *     its own words, from its own `catch`.
 *  3. Each of the three checks calls the reader it is GIVEN, exactly once, and
 *     answers from those records rather than from the log beside them on disk.
 *
 * WHAT IS DELIBERATELY NOT PINNED: any wall-clock figure. The 165 ms above is a
 * measurement reported in prose, never an assertion — a millisecond threshold is
 * green alone and red under load, and this repository repaired two of those this
 * week. What is asserted is the CALL COUNT, which is the thing the saving is
 * made of and reads the same on an idle machine and a busy one.
 *
 * BORROWED POWER, disclosed: assertion 3 rests on the fixture log DISAGREEING
 * with the injected reader. Each such test asserts that disagreement itself —
 * the disk reader and the injected reader give different findings — so a fixture
 * that quietly became empty would redden the test rather than pass it.
 */

const CONFIG = resolveConfig({});

function item(id: string, type: string, extra: Record<string, string>): Item {
  return {
    id, type, title: id, status: 'active', severity: 'soft', always: false,
    continuity: false, summary: null, summaryOf: null, summaryWas: [], acknowledged: {},
    scope: [], tags: [], origin: 'human', sourceFile: null, sourceAnchor: null,
    sourceChecksum: null, validFrom: null, validUntil: null, checksum: 'x', extra,
    body: 'Body.', steps: [], observations: [], relations: [], layer: 'project',
    filePath: `items/${type}/${id}.md`,
  };
}

/** A throwaway corpus root holding a real, product-written audit log. */
function withRoot(records: AuditInput[], fn: (corpus: string) => void): void {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-audit-once-'));
  const corpus = path.join(dir, '.my_context');
  mkdirSync(corpus, { recursive: true });
  try {
    for (const record of records) {
      assert.equal(recordAudit(corpus, record).written, true,
        'the fixture log must actually be written — an empty one would make the disk reader and '
        + 'the injected reader agree, and assertion 3 would then prove nothing');
    }
    fn(corpus);
  } finally {
    removeTree(dir);
  }
}

/** A reader that counts, so "once" is a number rather than an impression. */
function counting(records: AuditRecord[]): { read: () => AuditRecord[]; calls: () => number } {
  let calls = 0;
  return { read: () => { calls++; return records; }, calls: () => calls };
}

test('auditOnce reads once, however many callers ask', () => {
  const records = [{ kind: 'mutation', op: 'create', itemId: 'X' }] as unknown as AuditRecord[];
  const source = counting(records);
  const once = auditOnce(source.read);

  assert.equal(source.calls(), 0,
    'FINDING: nothing is read until a check asks — a corpus on which no check reaches the log '
    + 'pays nothing for the log');
  const first = once();
  const second = once();
  const third = once();
  assert.equal(source.calls(), 1, 'FINDING: three callers, one read');
  assert.equal(first, records, 'the records handed back are the reader\'s own, not a copy');
  assert.equal(second, first);
  assert.equal(third, first);
});

test('auditOnce re-throws the same failure without reading again', () => {
  let calls = 0;
  const boom = new Error('audit.jsonl line 644 is not JSON');
  const once = auditOnce(() => { calls++; throw boom; });

  assert.throws(() => once(), (err: unknown) => err === boom);
  assert.throws(() => once(), (err: unknown) => err === boom,
    'FINDING: the second caller sees the SAME error object, which is what lets it write its own '
    + 'coverage finding about the same refusal in its own words');
  assert.throws(() => once(), (err: unknown) => err === boom);
  assert.equal(calls, 1,
    'FINDING: a log that cannot be read is not re-read to learn that a second and third time');
});

test('checkStateUnaudited reads the log it is given, exactly once', () => {
  // A `create` carrying the write-time witness: against THIS log the closed task
  // is accounted for and nothing is reported. Against an empty one it is not.
  const log: AuditInput[] = [
    { kind: 'mutation', op: 'create', origin: 'human', itemId: 'TASK-a', checksumAfter: 'x' },
    { kind: 'mutation', op: 'update', origin: 'human', itemId: 'TASK-a', fields: ['extra.state'] },
  ];
  withRoot(log, (corpus) => {
    const items = [item('TASK-a', 'task', { state: 'done' })];
    const fromDisk = checkStateUnaudited(corpus, items, CONFIG);

    const injected = counting([]);
    const fromReader = checkStateUnaudited(corpus, items, CONFIG, injected.read);
    assert.equal(injected.calls(), 1, 'FINDING: the check calls its reader exactly once');
    assert.notDeepEqual(fromReader, fromDisk,
      'FINDING: the disk log and the injected empty log give DIFFERENT findings, which is what '
      + 'proves the injected reader — and not the file beside it — produced the answer');
    // Not `state_unaudited`: an item with NO `create` record at all is one this
    // check calls UNMEASURABLE rather than unaudited, and says so on its
    // coverage line instead of per item. Either way it speaks, and what it says
    // is a fact about the records it was handed.
    assert.ok(fromReader.length > 0,
      'FINDING: against an empty log the check reports something, and against the fixture log it '
      + 'reports something else — the two readings are distinguishable in the output');
  });
});

test('checkTaskUnverified reads the log it is given, exactly once', () => {
  const log: AuditInput[] = [
    { kind: 'mutation', op: 'create', origin: 'human', itemId: 'TASK-a', checksumAfter: 'x' },
    { kind: 'mutation', op: 'update', origin: 'human', itemId: 'TASK-a', fields: ['extra.state'] },
  ];
  withRoot(log, (corpus) => {
    // The second item carries `verified_on`, which is what takes this check past
    // its "this project does not use the field" early return and into the log.
    const items = [
      item('TASK-a', 'task', { state: 'done' }),
      item('TASK-b', 'task', { verified_on: '2026-09-15' }),
    ];
    const fromDisk = checkTaskUnverified(corpus, items, CONFIG);

    const injected = counting([]);
    const fromReader = checkTaskUnverified(corpus, items, CONFIG, injected.read);
    assert.equal(injected.calls(), 1, 'FINDING: the check calls its reader exactly once');
    assert.notDeepEqual(fromReader, fromDisk,
      'FINDING: disk and injected logs disagree, so the injected one is demonstrably the one read');
  });
});

test('checkAssumptionOverdue reads the log it is given, exactly once', () => {
  const log: AuditInput[] = [
    { kind: 'mutation', op: 'create', origin: 'human', itemId: 'ASSUM-a', checksumAfter: 'x' },
  ];
  withRoot(log, (corpus) => {
    const items = [item('ASSUM-a', 'assumption', { validate_by: '2020-01-01' })];
    const fromDisk = checkAssumptionOverdue(corpus, items);

    const injected = counting([]);
    const fromReader = checkAssumptionOverdue(corpus, items, injected.read);
    assert.equal(injected.calls(), 1, 'FINDING: the check calls its reader exactly once');
    assert.notDeepEqual(fromReader, fromDisk,
      'FINDING: disk and injected logs disagree, so the injected one is demonstrably the one read');
    assert.ok(fromReader.length > 0,
      'FINDING: the overdue assumption is reported against the empty log it was handed');
  });
});
