/**
 * `checkGoverningSpillPressure` (`src/doctor/checks.ts`) — the doctor line the
 * owner asked for 2026-09-04, `TASK-the-injection-budget-drops-governing-
 * items-and-open-work`: *"Add a doctor line when a governing item spills
 * repeatedly, so the corpus says when its budget can no longer carry its own
 * rules rather than leaving it to be discovered."*
 *
 * It reads the SQLite audit projection (`core/audit-db.ts`), which is built
 * by `openProjection` + `syncProjection` — a write `mycontext audit` performs
 * and this test performs on its own behalf, exactly as `test/core/audit-
 * projection.test.ts` does for its own fixtures. The check itself only ever
 * opens the projection READ-ONLY (`openProjectionReadOnlyChecked`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openProjection, syncProjection } from '../../src/core/audit-db.ts';
import { recordAudit, type AuditInput } from '../../src/core/audit.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { checkGoverningSpillPressure } from '../../src/doctor/checks.ts';
import { partitionFindings, summarize } from '../../src/cli/commands/doctor.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

const CONFIG = resolveConfig({});

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'RULE-a', type: 'rule', title: 'A rule', status: 'active',
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null,
    summaryWas: [], acknowledged: {}, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'body', steps: [], observations: [], relations: [],
    layer: 'project', filePath: 'items/rule/RULE-a.md',
    ...over,
  };
}

/** A throwaway corpus root, with a real product-written audit log AND a synced projection. */
function root(records: AuditInput[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-spillpressure-'));
  const corpus = path.join(dir, '.my_context');
  mkdirSync(corpus, { recursive: true });
  for (const record of records) {
    const result = recordAudit(corpus, record);
    assert.equal(result.written, true, 'the fixture log must actually be written');
  }
  const db = openProjection(corpus);
  try {
    syncProjection(corpus, db);
  } finally {
    db.close();
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

/** N `spilled` injection records naming `itemId` at tier `tier`. */
function spills(itemId: string, n: number, tier: string): AuditInput[] {
  const out: AuditInput[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      kind: 'injection', op: 'jit', sessionId: `s${i}`, hook: 'PreToolUse',
      path: 'src/x.ts', at: `2026-08-${String(10 + (i % 15)).padStart(2, '0')}T10:00:00.000Z`,
      spilled: [{ id: itemId, tier, reason: 'budget exceeded (900 > 800 estimated tokens)' }],
    });
  }
  return out;
}

test('no audit projection at all: nothing to disclose', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-spillpressure-absent-'));
  const corpus = path.join(dir, '.my_context');
  mkdirSync(corpus, { recursive: true });
  try {
    const findings = checkGoverningSpillPressure(corpus, [item()], CONFIG);
    assert.deepEqual(findings, []);
  } finally {
    removeTree(dir);
  }
});

test('a governing item spilled below the repeat threshold draws nothing', () => {
  withRoot(spills('RULE-a', 5, 'jit'), (corpus) => {
    const findings = checkGoverningSpillPressure(corpus, [item({ id: 'RULE-a' })], CONFIG);
    assert.deepEqual(findings, []);
  });
});

test('a governing item spilled at or past the repeat threshold is disclosed, not counted', () => {
  withRoot(spills('RULE-a', 25, 'jit'), (corpus) => {
    const findings = checkGoverningSpillPressure(corpus, [item({ id: 'RULE-a' })], CONFIG);
    assert.equal(findings.length, 1);
    const [f] = findings;
    assert.equal(f.code, 'governing_spill_pressure');
    assert.equal(f.about, 'governing_spill_pressure', 'a self-routed disclosure, not a worklist row');
    assert.equal(f.level, 'info');
    assert.deepEqual(f.remedy, { route: 'none', why: 'person' });
    assert.match(f.message, /RULE-a \(25\)/);
    assert.equal(f.item, undefined, 'a pressure disclosure names no single item to anchor an ack to');

    // Routed OUT of the count, whatever level it carries — `about` is what does it.
    const { findings: worklist, disclosures } = partitionFindings(findings);
    assert.deepEqual(worklist, []);
    assert.equal(disclosures.length, 1);
    const counts = summarize(findings);
    assert.deepEqual(counts, { errors: 0, warnings: 0, infos: 0 });
  });
});

test('a non-governing item spilling just as often draws nothing — only governing items qualify', () => {
  const known = item({ id: 'KNOWN-a', type: 'known_issue' });
  withRoot(spills('KNOWN-a', 40, 'jit'), (corpus) => {
    const findings = checkGoverningSpillPressure(corpus, [known], CONFIG);
    assert.deepEqual(findings, []);
  });
});

test('an item no longer in the corpus (renamed, superseded away) is silently skipped, never crashes', () => {
  withRoot(spills('RULE-gone', 30, 'jit'), (corpus) => {
    const findings = checkGoverningSpillPressure(corpus, [], CONFIG);
    assert.deepEqual(findings, []);
  });
});

test('open task/plan work qualifies exactly as the six named categories do', () => {
  const task = item({
    id: 'TASK-open', type: 'task', extra: { state: 'todo' }, filePath: 'items/task/TASK-open.md',
  });
  withRoot(spills('TASK-open', 30, 'continuity'), (corpus) => {
    const findings = checkGoverningSpillPressure(corpus, [task], CONFIG);
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /TASK-open \(30\)/);
  });
});

test('a DONE task spilling repeatedly is not governing and draws nothing', () => {
  const task = item({
    id: 'TASK-closed', type: 'task', extra: { state: 'done' }, filePath: 'items/task/TASK-closed.md',
  });
  withRoot(spills('TASK-closed', 30, 'continuity'), (corpus) => {
    const findings = checkGoverningSpillPressure(corpus, [task], CONFIG);
    assert.deepEqual(findings, []);
  });
});

test('multiple qualifying items are named together, most-spilled first', () => {
  const items = [
    item({ id: 'RULE-a', filePath: 'items/rule/RULE-a.md' }),
    item({ id: 'STD-b', type: 'standard', filePath: 'items/standard/STD-b.md' }),
  ];
  withRoot([...spills('RULE-a', 22, 'jit'), ...spills('STD-b', 30, 'jit')], (corpus) => {
    const findings = checkGoverningSpillPressure(corpus, items, CONFIG);
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /STD-b \(30\).*RULE-a \(22\)/s,
      'sorted by spill count, most-spilled named first');
  });
});

test('a draft/ineligible governing item spilling in a stale record is not disclosed as live pressure', () => {
  // Eligible at capture time is what the audit log recorded, but the corpus
  // handed to doctor is the one that governs what this check may claim is
  // still true — an item withdrawn to draft is no longer a live candidate at
  // all, so it must not be named as ongoing pressure on a budget it no
  // longer competes for.
  const draft = item({ id: 'RULE-a', status: 'draft' });
  withRoot(spills('RULE-a', 30, 'jit'), (corpus) => {
    const findings = checkGoverningSpillPressure(corpus, [draft], CONFIG);
    assert.deepEqual(findings, []);
  });
});
