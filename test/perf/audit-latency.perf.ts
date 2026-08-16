/**
 * **The measurement that decided the audit log is always-on.**
 *
 * The PreToolUse hook runs on every tool call under a 50 ms p95 ceiling
 * (`test/perf/jit-latency.perf.ts`), and it now writes one audit record per
 * injection. Whether that is affordable is a number, not an opinion, so it was
 * measured before the hook was wired rather than after.
 *
 * Recorded baseline (2026-08-16, dev machine, two runs of 200 iterations after
 * 20 warm-up calls, `node --test --test-concurrency=1`):
 *
 *   empty log                 p95 0.579 / 0.552 ms
 *   1 MiB log                 p95 0.570 / 0.507 ms
 *   8 MiB log (rotation edge) p95 0.556 / 0.527 ms
 *   32 MiB log                p95 0.551 / 0.544 ms
 *
 * Two things matter about those figures, and both are asserted below:
 *
 *  1. **It is small.** ~0.55 ms against a 50 ms ceiling, on a JIT hit path that
 *     already costs ~11–22 ms. About 1% more per tool call.
 *  2. **It is FLAT in the size of the log**, which is the property that made
 *     always-on safe rather than merely cheap today. It is flat because the
 *     append never reads the log: `healTornTail` (core/jsonl-log.ts) answers
 *     "is the last byte a newline" with one `stat` and one 1-byte read, and
 *     rotation keeps the live file bounded.
 *
 * The alternative was measured too, because "flat" is a claim about a design
 * decision and the decision had a cheaper-looking option. The original
 * `healTornTail` in `revision.ts` read the WHOLE file to answer the same
 * question — invisible on a revision queue of a few dozen lines. On an 8 MiB
 * log that read alone measures **p95 11.28 ms, median 9.81 ms**, which would
 * have roughly doubled the JIT hot path and grown without bound. That is why
 * the extracted version scans backwards from the end instead.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AUDIT_PROTOCOL, auditDir, auditLogPath, recordAudit } from '../../src/core/audit.ts';
import { ensureLogDir } from '../../src/core/jsonl-log.ts';
import { removeTree } from '../helpers/tmp.ts';

const WARMUP = 20;
const ITERATIONS = 200;

/**
 * The ceiling for ONE audit record on the hook path.
 *
 * 5 ms, not 0.6 ms: the measured figure is ~0.55 ms and this is a guard
 * against a regression in KIND — an append that starts reading the log, or
 * opens a database — not a pin on the exact number a particular machine
 * produces. A ~9x margin absorbs a slow or loaded runner; a change that made
 * the append proportional to the log would blow straight through it at the
 * larger sizes below.
 */
const RECORD_CEILING_MS = 5;

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

/** Ten items at one tier — the shape a JIT injection on a real corpus records. */
const INJECTED = Array.from({ length: 10 }, (_, i) => ({
  id: `CONST-scoped-${i}`, tier: 'jit',
}));

function measure(prefillBytes: number): { p95: number; root: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-audit-perf-'));
  ensureLogDir(auditDir(root));
  const file = auditLogPath(root);

  if (prefillBytes > 0) {
    const line = JSON.stringify({
      protocol: AUDIT_PROTOCOL, at: '2026-08-16T00:00:00.000Z', kind: 'injection', op: 'jit',
      sessionId: 'x', hook: 'PreToolUse', path: 'src/db/writer.ts', injected: INJECTED,
    }) + '\n';
    writeFileSync(file, line.repeat(Math.ceil(prefillBytes / line.length)), 'utf8');
  }

  const call = (): void => {
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 'perf', hook: 'PreToolUse',
      path: 'src/db/writer.ts', injected: INJECTED,
    });
  };

  for (let i = 0; i < WARMUP; i++) call();

  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const started = process.hrtime.bigint();
    call();
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }
  return { p95: p95(samples), root };
}

test('one audit record costs well under the hook budget, at every log size', () => {
  // 32 MiB is past the 8 MiB rotation cap on purpose: the first append rotates
  // it, and the cost of THAT append is in the sample too.
  for (const bytes of [0, 1024 * 1024, 8 * 1024 * 1024, 32 * 1024 * 1024]) {
    const { p95: measured, root } = measure(bytes);
    assert.ok(
      measured < RECORD_CEILING_MS,
      `an audit record cost ${measured.toFixed(3)}ms p95 with a ` +
      `${(bytes / 1024 / 1024).toFixed(0)}MiB log — the recorded baseline is ~0.55ms and flat. ` +
      `A figure that RISES with log size means the append started reading the log again; see ` +
      `healTornTail in core/jsonl-log.ts.`,
    );
    removeTree(root);
  }
});

test('the cost does not grow with the log — that is what makes always-on safe', () => {
  const empty = measure(0);
  const large = measure(4 * 1024 * 1024);
  removeTree(empty.root);
  removeTree(large.root);

  // Generous, deliberately: two independently-sampled p95s on a shared machine
  // vary by more than the quantity being measured, so this is a guard against
  // a change in ORDER, not a claim that the two are equal. The naive full-read
  // heal was ~20x the empty-log cost at 8 MiB and would fail this outright.
  assert.ok(
    large.p95 < Math.max(empty.p95 * 6, RECORD_CEILING_MS),
    `an append against a 4MiB log cost ${large.p95.toFixed(3)}ms p95 against ` +
    `${empty.p95.toFixed(3)}ms on an empty one. The append is supposed to be O(1) in the size ` +
    `of the log.`,
  );
});

test('rotation keeps the live log bounded, which is what keeps the append flat', () => {
  const { root } = measure(8 * 1024 * 1024);
  // The prefill was over the cap, so the first measured append rotated it and
  // every append since has gone to a fresh, small file.
  assert.ok(
    statSync(auditLogPath(root)).size < 1024 * 1024,
    'the live log was not rotated, so the append path is no longer bounded',
  );
  removeTree(root);
});
