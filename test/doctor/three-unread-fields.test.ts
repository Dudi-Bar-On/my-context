import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { recordAudit, type AuditInput } from '../../src/core/audit.ts';
import {
  checkAssumptionOverdue, checkOpenQuestionBlocks, checkReferenceNoSource,
  ASSUMPTION_OVERDUE_INTRODUCED_AT,
} from '../../src/doctor/checks.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * TASK-three-item-fields-can-be-filled-in-but-nothing-ever-reads: three item
 * fields can be filled in and nothing ever read them back before this file —
 * `open_question.blocks`, `assumption.validate_by`/`validated_on`, and
 * `reference.source_file`. A field nobody reads is worse than an absent one
 * because it looks like it works; these three checks are what makes each one
 * do something.
 */

function base(over: Partial<Item> & { id: string; type: string }): Item {
  return {
    title: over.id, status: 'active', severity: 'soft', always: false,
    continuity: false, summary: null, summaryOf: null, summaryWas: [], acknowledged: {},
    scope: [], tags: [], origin: 'human', sourceFile: null, sourceAnchor: null,
    sourceChecksum: null, validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'Body.', steps: [], observations: [], relations: [], layer: 'project',
    filePath: `items/${over.type}/${over.id}.md`,
    ...over,
  };
}

// --- open_question.blocks -----------------------------------------------

test('an open_question with no blocks draws nothing', () => {
  const item = base({ id: 'OPENQ-a', type: 'open_question' });
  assert.deepEqual(checkOpenQuestionBlocks([item]), []);
});

test('an open_question with blocks set is named, at info level, naming what is waiting', () => {
  const item = base({ id: 'OPENQ-a', type: 'open_question', extra: { blocks: 'the auth rewrite' } });
  const findings = checkOpenQuestionBlocks([item]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, 'info');
  assert.equal(findings[0].code, 'open_question_blocks');
  assert.equal(findings[0].item, 'OPENQ-a');
  assert.match(findings[0].message, /the auth rewrite/);
  assert.equal(findings[0].remedy.route, 'acknowledge');
});

test('blank blocks (whitespace only) is the same as absent', () => {
  const item = base({ id: 'OPENQ-a', type: 'open_question', extra: { blocks: '   ' } });
  assert.deepEqual(checkOpenQuestionBlocks([item]), []);
});

test('a non-open_question item carrying an unrelated "blocks" extra key is not read by this check', () => {
  const item = base({ id: 'TASK-a', type: 'task', extra: { blocks: 'irrelevant here' } });
  assert.deepEqual(checkOpenQuestionBlocks([item]), []);
});

test('a superseded (settled) open_question with blocks is not reported — it is history, not a live dependency', () => {
  const item = base({
    id: 'OPENQ-a', type: 'open_question', status: 'superseded',
    extra: { blocks: 'the auth rewrite' },
  });
  assert.deepEqual(checkOpenQuestionBlocks([item]), []);
});

// --- assumption.validate_by / validated_on --------------------------------

function root(records: AuditInput[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-assume-overdue-'));
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
const afterCutoff = new Date(Date.parse(ASSUMPTION_OVERDUE_INTRODUCED_AT) + ONE_MS).toISOString();
const beforeCutoff = new Date(Date.parse(ASSUMPTION_OVERDUE_INTRODUCED_AT) - ONE_MS).toISOString();

const createdAt = (itemId: string, at: string): AuditInput => (
  { kind: 'mutation', op: 'create', origin: 'human', itemId, at }
);

// Any date safely in the past relative to "today" wherever this test runs.
const PAST_DATE = '2000-01-01';
const FAR_FUTURE_DATE = '2999-01-01';

test('an assumption with no validate_by draws nothing', () => {
  withRoot([createdAt('ASSUME-a', afterCutoff)], (corpus) => {
    const item = base({ id: 'ASSUME-a', type: 'assumption' });
    assert.deepEqual(checkAssumptionOverdue(corpus, [item]), []);
  });
});

test('an assumption whose validate_by has not yet arrived draws nothing', () => {
  withRoot([createdAt('ASSUME-a', afterCutoff)], (corpus) => {
    const item = base({ id: 'ASSUME-a', type: 'assumption', extra: { validate_by: FAR_FUTURE_DATE } });
    assert.deepEqual(checkAssumptionOverdue(corpus, [item]), []);
  });
});

test('an assumption already validated draws nothing, however old validate_by is', () => {
  withRoot([createdAt('ASSUME-a', afterCutoff)], (corpus) => {
    const item = base({
      id: 'ASSUME-a', type: 'assumption',
      extra: { validate_by: PAST_DATE, validated_on: '2000-06-01' },
    });
    assert.deepEqual(checkAssumptionOverdue(corpus, [item]), []);
  });
});

test('an overdue assumption created AFTER the cutoff is reported', () => {
  withRoot([createdAt('ASSUME-a', afterCutoff)], (corpus) => {
    const item = base({ id: 'ASSUME-a', type: 'assumption', extra: { validate_by: PAST_DATE } });
    const findings = checkAssumptionOverdue(corpus, [item]);
    const named = findings.filter((f) => f.code === 'assumption_overdue');
    assert.equal(named.length, 1);
    assert.equal(named[0].item, 'ASSUME-a');
    assert.match(named[0].message, new RegExp(PAST_DATE));
    assert.equal(named[0].remedy.route, 'acknowledge');
  });
});

test('an overdue assumption created BEFORE the cutoff is grandfathered into a coverage disclosure, not named', () => {
  withRoot([createdAt('ASSUME-a', beforeCutoff)], (corpus) => {
    const item = base({ id: 'ASSUME-a', type: 'assumption', extra: { validate_by: PAST_DATE } });
    const findings = checkAssumptionOverdue(corpus, [item]);
    assert.equal(findings.some((f) => f.code === 'assumption_overdue'), false);
    const coverage = findings.find((f) => f.code === 'assumption_overdue_coverage');
    assert.ok(coverage, 'expected a coverage disclosure');
    assert.equal(coverage?.about, 'assumption_overdue');
    assert.equal(coverage?.item, undefined);
  });
});

test('an overdue assumption with no recorded creation at all is grandfathered, not asserted about', () => {
  withRoot([], (corpus) => {
    const item = base({ id: 'ASSUME-a', type: 'assumption', extra: { validate_by: PAST_DATE } });
    const findings = checkAssumptionOverdue(corpus, [item]);
    assert.equal(findings.some((f) => f.code === 'assumption_overdue'), false);
    assert.ok(findings.some((f) => f.code === 'assumption_overdue_coverage'));
  });
});

test('a superseded (retired) overdue assumption is not reported — it is no longer being relied on', () => {
  withRoot([createdAt('ASSUME-a', afterCutoff)], (corpus) => {
    const item = base({
      id: 'ASSUME-a', type: 'assumption', status: 'superseded',
      extra: { validate_by: PAST_DATE },
    });
    assert.deepEqual(checkAssumptionOverdue(corpus, [item]), []);
  });
});

test('an unreadable audit log falls back to one disclosure rather than throwing', () => {
  // No corpus directory at all — readAudit's own "missing" path.
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-assume-noroot-'));
  const corpus = path.join(dir, '.my_context');
  try {
    const item = base({ id: 'ASSUME-a', type: 'assumption', extra: { validate_by: PAST_DATE } });
    const findings = checkAssumptionOverdue(corpus, [item]);
    // A missing log reads as an empty one (no records), which is the same as
    // "no recorded creation" above — still one coverage disclosure, no crash.
    assert.equal(findings.some((f) => f.code === 'assumption_overdue'), false);
    assert.ok(findings.some((f) => f.code === 'assumption_overdue_coverage'));
  } finally {
    removeTree(dir);
  }
});

// --- reference.source_file ------------------------------------------------

test('a reference with source_file set draws nothing from this check — checkSourceDrift owns it', () => {
  const item = base({
    id: 'REF-a', type: 'reference',
    sourceFile: 'docs/roadmap.md', sourceAnchor: null, sourceChecksum: 'abc',
  });
  assert.deepEqual(checkReferenceNoSource([item]), []);
});

test('a reference with no source_file at all is reported', () => {
  const item = base({ id: 'REF-a', type: 'reference' });
  const findings = checkReferenceNoSource([item]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, 'warn');
  assert.equal(findings[0].code, 'reference_no_source');
  assert.equal(findings[0].item, 'REF-a');
  assert.match(findings[0].message, /source_file/);
  assert.equal(findings[0].remedy.route, 'acknowledge');
});

test('a non-reference item with no source_file is not read by this check', () => {
  const item = base({ id: 'TASK-a', type: 'task' });
  assert.deepEqual(checkReferenceNoSource([item]), []);
});

test('a superseded (retired) reference with no source_file is not reported', () => {
  const item = base({ id: 'REF-a', type: 'reference', status: 'superseded' });
  assert.deepEqual(checkReferenceNoSource([item]), []);
});

test('a continuity reference with no source_file is exempt — DEC-continuity-gets-its-own-budget rules this deliberate', () => {
  const item = base({ id: 'REF-a', type: 'reference', continuity: true });
  assert.deepEqual(checkReferenceNoSource([item]), []);
});
