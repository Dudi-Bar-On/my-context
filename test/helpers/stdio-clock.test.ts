/**
 * The readiness gate in `test/helpers/stdio.ts`, pinned against a child whose
 * cold start is longer than the response budget.
 *
 * Without the gate, `responses()` starts its clock at the call and the slow
 * start eats it — which is the 1-in-6 cold-cache red this harness was built to
 * remove, reproduced here deterministically rather than waited for. Delete the
 * `await awaitReady()` from `responses()` and the first test below fails within
 * its budget every time.
 *
 * The bounds here are the one place in this suite where a small budget is
 * deliberate: 400ms is not a claim about how fast anything is, it is the
 * *response* budget, and the whole point is that the 3s cold start must not be
 * charged against it. The readiness budget above it is 60s.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStdioChild, READY_ID } from './stdio.ts';
import { removeTree } from './tmp.ts';

const SLOW = fileURLToPath(new URL('../fixtures/slow-stdio-server.ts', import.meta.url));

/** Far longer than the response budget below, so the two cannot be confused. */
const COLD_MS = 3000;
const RESPONSE_BUDGET_MS = 400;

test('a child slower to start than the response budget still answers within it', async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-stdio-'));
  const harness = startStdioChild(SLOW, {
    cwd, args: [String(COLD_MS)], readyBudgetMs: 60_000, responseBudgetMs: RESPONSE_BUDGET_MS,
  });
  try {
    harness.send({ jsonrpc: '2.0', id: 1, method: 'ping' });
    const [response] = await harness.responses(1);
    assert.deepEqual(response, { jsonrpc: '2.0', id: 1, result: {} });

    const ready = harness.readyMs();
    assert.ok(ready !== null, 'the readiness reply must have been observed');
    assert.ok(
      ready > RESPONSE_BUDGET_MS,
      `this test only proves anything if the start really did outlast the response budget; ` +
      `readiness came back after ${ready}ms and the budget is ${RESPONSE_BUDGET_MS}ms`,
    );
  } finally {
    await harness.stop();
    removeTree(cwd);
  }
});

test('the readiness reply is not counted as one of the caller\'s responses', async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-stdio-'));
  const harness = startStdioChild(SLOW, { cwd, args: ['0'], readyBudgetMs: 60_000 });
  try {
    harness.send({ jsonrpc: '2.0', id: 1, method: 'ping' });
    const [response] = await harness.responses(1);
    assert.equal(response.id, 1, 'the first response the caller sees is the caller\'s own');
    assert.equal(harness.messageCount(), 1, `the ${READY_ID} reply must not be visible`);
  } finally {
    await harness.stop();
    removeTree(cwd);
  }
});

/**
 * A child that dies must fail fast and say it died — not sit out the readiness
 * budget, which would turn a crash into a timeout minutes later and lose the
 * one piece of information worth having.
 */
test('a child that exits immediately fails with its exit, not with a readiness timeout', async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-stdio-'));
  const dead = path.join(cwd, 'dead.mjs');
  writeFileSync(dead, 'process.exit(3);\n', 'utf8');
  const harness = startStdioChild(dead, { cwd, readyBudgetMs: 60_000, responseBudgetMs: 200 });
  try {
    const started = Date.now();
    await assert.rejects(
      () => harness.responses(1),
      (err: Error) => {
        assert.match(err.message, /has since exited/);
        assert.match(err.message, /"code":3/);
        return true;
      },
    );
    assert.ok(Date.now() - started < 30_000, 'it must not have waited out the readiness budget');
  } finally {
    await harness.stop();
    removeTree(cwd);
  }
});
