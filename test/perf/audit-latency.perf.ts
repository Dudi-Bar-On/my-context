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
 *
 * ── AND SINCE 2026-08-28, THE PROJECTION BESIDE IT (plan:walk seq:28) ──────
 *
 * `recordAudit` now also keeps `.audit/audit.db` current, so "an append that
 * opens a database" is no longer the regression this file is guarding against
 * — it is the design. What it guards instead is the SHAPE of that database
 * work, and the shape is the whole ruling: the projection is brought forward
 * by APPENDING the new records and never by rebuilding.
 *
 * Recorded baseline (2026-08-28, dev machine — a slower one than the 2026-08-16
 * figures above were taken on, which is why the log-only column reads higher
 * here than 0.55 ms; the two columns are measured in the same run and against
 * each other, not against that day's numbers):
 *
 *                                 log only        log + projection
 *   empty log                     p95 1.82 ms     p95 3.33 ms
 *   1 MiB log                     p95 0.98 ms     p95 3.27–4.57 ms
 *   4 MiB log                     p95 1.02 ms     p95 3.99 ms
 *   8 MiB log (rotation edge)     p95 1.81 ms     p95 3.64 ms
 *
 * **~2.3 ms for keeping the projection current, and flat in the size of the
 * log** — the same property, for the same reason, and it is the property that
 * matters. Two decisions bought it, both measured before they were taken:
 *
 *  1. **One connection per process, held.** A connection opened and closed per
 *     append measured p95 12.29 ms against 3.58 ms held, on the same corpus in
 *     the same run. The 10 ms is not the insert — a held
 *     `BEGIN IMMEDIATE`/`COMMIT` measures 0.017 ms — it is the WAL checkpoint
 *     SQLite runs when the last connection to a database it has written closes.
 *  2. **`PRAGMA synchronous = NORMAL` on that connection.** One record's
 *     transaction, 2.10 ms p95 at the default `FULL`, 0.33 ms at `NORMAL`.
 *     What it risks is losing committed rows in a power cut, which for a
 *     derived store means the projection is behind the log — reported, and
 *     ended by `mycontext audit`. The record itself was durable before this
 *     code ran.
 *
 * **What a rebuild would have cost, measured rather than asserted**, because
 * "it must never rebuild" is the restriction the design turns on. One
 * `syncProjection` over a log that is fully behind, on the same machine:
 *
 *   1 MiB /  1,983 records    47.4 ms
 *   4 MiB /  7,929 records   236.2 ms
 *   8 MiB / 15,858 records   483.7 ms
 *
 * 8 MiB is the rotation cap, i.e. the largest ONE segment ever gets — so the
 * cheapest possible rebuild at the cap is **ten times the entire 50 ms hook
 * budget**, and a corpus with segments behind it is unbounded. That is why
 * `keepProjectionCurrent` reports a `diverged` projection and leaves it for
 * `mycontext audit`, and why the flatness test below is the one that would
 * catch a rebuild sneaking onto this path.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AUDIT_PROTOCOL, auditDir, auditLogPath, recordAudit } from '../../src/core/audit.ts';
import { openProjection, syncProjection } from '../../src/core/audit-db.ts';
import { ensureLogDir } from '../../src/core/jsonl-log.ts';
import { removeTree } from '../helpers/tmp.ts';
import { perfCeiling } from '../helpers/perf.ts';

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
 *
 * Widened 10× on the GitHub Windows runner only, like every ceiling in this
 * suite — see test/helpers/perf.ts. The regression-in-KIND guard survives the
 * widening: an append proportional to the log still blows through 50 ms at
 * the sizes below.
 */
const RECORD_CEILING_MS = perfCeiling(5);

/**
 * The ceiling for one record WITH the projection kept current beside it.
 *
 * 10 ms against a measured ~3.3–4.6 ms, for the same reason
 * `RECORD_CEILING_MS` is 5 against ~0.55: it is a guard against a regression
 * in KIND, not a pin on one machine's number. The kinds it catches are the
 * ones that matter here and they are all far above it — a rebuild is 47 ms at
 * 1 MiB and 484 ms at the 8 MiB rotation cap, and going back to a connection
 * opened per append measured 12.3 ms. A margin under the 50 ms hook budget is
 * what is being certified, on a path that already spends 11–22 ms on the JIT
 * hit itself.
 */
const PROJECTED_CEILING_MS = perfCeiling(10);

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

/** Ten items at one tier — the shape a JIT injection on a real corpus records. */
const INJECTED = Array.from({ length: 10 }, (_, i) => ({
  id: `CONST-scoped-${i}`, tier: 'jit',
}));

function measure(prefillBytes: number, withProjection = false): { p95: number; root: string } {
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

  // Built by the PRODUCT, exactly as a real corpus's is: `mycontext audit`
  // owns the projection and an append never creates one. A root without this
  // line measures the `unbuilt` path — one `stat` — which is the other column
  // and is not what these tests below are for.
  if (withProjection) {
    const db = openProjection(root);
    syncProjection(root, db);
    db.close();
  }

  const call = (): void => {
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 'perf', hook: 'PreToolUse',
      path: 'src/db/writer.ts', injected: INJECTED,
      // Present since the injection record grew its token estimate; measured
      // interleaved against the tokens-less shape (2026-08-16, both ~0.6-0.7ms
      // p95 at every size): indistinguishable within run-to-run noise, which
      // is what one ~13-byte JSON property on an append should cost. The
      // VALUE costs nothing to produce either — `select` was already
      // accumulating it to make the budget decisions.
      tokens: 1234,
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

// --- and the projection it now keeps current beside it ----------------------

test('an append that also projects the record stays well inside the hook budget', () => {
  for (const bytes of [0, 1024 * 1024, 8 * 1024 * 1024]) {
    const { p95: measured, root } = measure(bytes, true);
    assert.ok(
      measured < PROJECTED_CEILING_MS,
      `an audit record cost ${measured.toFixed(3)}ms p95 with a ` +
      `${(bytes / 1024 / 1024).toFixed(0)}MiB log and a current projection — the recorded ` +
      `baseline is ~3.3-4.6ms. The two regressions that land above this ceiling are a REBUILD ` +
      `on the append path (47ms at 1MiB, 484ms at the 8MiB rotation cap) and a connection ` +
      `opened per append instead of held (12.3ms); see keepProjectionCurrent in ` +
      `core/audit-db.ts.`,
    );
    removeTree(root);
  }
});

test('keeping the projection current is FLAT in the log — it appends, it never rebuilds', () => {
  const empty = measure(0, true);
  const large = measure(4 * 1024 * 1024, true);
  removeTree(empty.root);
  removeTree(large.root);

  // This is the assertion that would catch a rebuild. A rebuild is O(the whole
  // log) and would show up here as a ratio that grows with the prefill — 47ms
  // against 3.3ms at 1MiB, and worse at 4. The same generous factor as the
  // log-only flatness test above, and for the same reason: two independently
  // sampled p95s on a shared machine vary by more than the quantity being
  // measured, so this is a guard against a change in ORDER.
  assert.ok(
    large.p95 < Math.max(empty.p95 * 6, PROJECTED_CEILING_MS),
    `an append against a 4MiB log cost ${large.p95.toFixed(3)}ms p95 against ` +
    `${empty.p95.toFixed(3)}ms on an empty one. Keeping the projection current is supposed to ` +
    `consume only the bytes past the stored offset, which is O(1) in the size of the log. A ` +
    `figure that grows with it means something on this path started rebuilding.`,
  );
});

test('an append does not build a projection for a workspace that has none', () => {
  // The other column, and the reason the ceiling above is not the only one
  // that matters: a workspace that has never run `mycontext audit` must not
  // start paying for a projection it never asked for — nor be given one.
  const { p95: measured, root } = measure(1024 * 1024);
  assert.ok(
    measured < RECORD_CEILING_MS,
    `an append cost ${measured.toFixed(3)}ms p95 against a corpus with NO projection. That path ` +
    `is one stat: if this rose, an append is building or opening a database for a workspace ` +
    `that has none.`,
  );
  assert.equal(
    existsSync(path.join(auditDir(root), 'audit.db')), false,
    'an append conjured a projection for a workspace that never built one',
  );
  removeTree(root);
});
