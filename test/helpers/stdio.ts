/**
 * A line-delimited JSON-RPC child over real stdio, with the response clock
 * started only once the child has proved it is alive.
 *
 * **The defect this exists to remove.** The harness that used to live inside
 * `test/mcp/server-e2e.test.ts` started a fixed 15-second budget at the moment
 * `responses()` was CALLED, which is some microseconds after `spawn` — not
 * after the child was ready. A `node` cold start that has to type-strip the
 * whole injection import graph (rebuild → select → render → ledger → store)
 * takes a large and unbounded fraction of that budget on a cold module cache,
 * so on a cold cache roughly one run in six went red for no reason connected to
 * the code under test. That is not a cosmetic flake: this project's ledger
 * records mutation results being read against a suite that was already red, and
 * a survived mutant read as killed is worse than no mutation testing at all.
 *
 * **The fix, stated exactly.** A readiness `ping` is written at spawn time and
 * its reply is waited for on its OWN, much wider budget. `responses()` blocks
 * on that first and only then starts the per-response clock, so the clock
 * measures the server answering rather than Node booting. The readiness reply
 * is filtered out of everything the caller sees — it carries a reserved id
 * (`READY_ID`) that no test uses — so `responses(n)` and `messageCount()` count
 * the caller's own traffic and nothing else.
 *
 * Waiting for readiness cannot itself hang the suite on a child that died:
 * `exit` resolves the same promise, and `responses()` then fails with a message
 * naming the exit. Nor can it hang on a child that never answers — the
 * readiness wait has a bound too, and blowing it produces an assertion that
 * says so in those words. The point is not to remove every deadline; it is that
 * a deadline blown by a slow start now REPORTS a slow start instead of being
 * indistinguishable from a server that answered wrongly.
 */
import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

/**
 * The id of the readiness probe. A string, and one no test would type by
 * accident: replies carrying it are removed before the caller sees anything.
 */
export const READY_ID = '__mycontext_ready__';

/**
 * Cold start of `node` plus type-stripping plus module evaluation, on a machine
 * running the rest of this suite concurrently. Deliberately far larger than any
 * plausible real value — its only job is to stop a wedged child from hanging
 * the suite forever, not to measure anything.
 */
const DEFAULT_READY_BUDGET_MS = 120_000;

/** How long one response may take once the child has already answered a ping. */
const DEFAULT_RESPONSE_BUDGET_MS = 15_000;

export interface StdioHarness {
  send(message: unknown): void;
  /** Waits for `count` messages, on a clock that starts after the child is ready. */
  responses(count: number): Promise<Record<string, unknown>[]>;
  stderr(): string;
  /** Every parsed stdout message seen so far, excluding the readiness reply. */
  messageCount(): number;
  /** Set once the child has exited; null while it is still running. */
  exitInfo(): { code: number | null; signal: NodeJS.Signals | null } | null;
  /** Milliseconds from spawn to the readiness reply; null if it never arrived. */
  readyMs(): number | null;
  /**
   * Kills the child and resolves once its stdio streams have fully closed —
   * not merely once it has exited — so that any output written between exit
   * and stream teardown is captured before the caller inspects stdout/stderr.
   *
   * Guards against a child that has already exited: registering a 'close'
   * listener after the event already fired would never resolve, and node:test
   * has no default per-test timeout, so an unguarded wait here turns "server
   * answered then died" into an indefinite CI hang rather than a red test.
   * Idempotent — safe to call more than once per harness.
   */
  stop(): Promise<void>;
}

export interface StdioOptions {
  cwd: string;
  args?: string[];
  readyBudgetMs?: number;
  responseBudgetMs?: number;
}

export function startStdioChild(script: string, options: StdioOptions): StdioHarness {
  const readyBudget = options.readyBudgetMs ?? DEFAULT_READY_BUDGET_MS;
  const responseBudget = options.responseBudgetMs ?? DEFAULT_RESPONSE_BUDGET_MS;
  const spawnedAt = Date.now();

  const child: ChildProcessWithoutNullStreams = spawn(
    process.execPath, [script, ...(options.args ?? [])],
    { cwd: options.cwd, stdio: ['pipe', 'pipe', 'pipe'] },
  );

  let out = '';
  let err = '';
  const seen: Record<string, unknown>[] = [];
  const waiters: (() => void)[] = [];
  let exitInfo: { code: number | null; signal: NodeJS.Signals | null } | null = null;
  let readyMs: number | null = null;

  let markReady: () => void = () => {};
  const ready = new Promise<void>((resolve) => { markReady = resolve; });

  child.on('exit', (code, signal) => {
    exitInfo = { code, signal };
    // A dead child is "ready" for the purpose of the clock: there is nothing
    // left to wait for, and the caller's own assertion should be what reports
    // the exit rather than a readiness timeout minutes later.
    markReady();
    for (const notify of waiters.splice(0)) notify();
  });

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    out += chunk;
    for (;;) {
      const newline = out.indexOf('\n');
      if (newline < 0) break;
      const line = out.slice(0, newline);
      out = out.slice(newline + 1);
      if (line.trim() === '') continue;
      const message = JSON.parse(line) as Record<string, unknown>;
      if (message.id === READY_ID) {
        if (readyMs === null) readyMs = Date.now() - spawnedAt;
        markReady();
        continue;
      }
      seen.push(message);
    }
    for (const notify of waiters.splice(0)) notify();
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => { err += chunk; });

  // A child that has already exited turns any further write into an EPIPE on
  // this stream. That is not a test failure — it is the child's exit, which
  // `responses()` reports properly — but an unhandled 'error' on a stream is
  // an uncaught exception that would take the whole test process down.
  child.stdin.on('error', () => { /* reported through exitInfo instead */ });

  // Written before the caller has sent anything, so the cold start is spent
  // waiting on this rather than on the caller's first real request.
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: READY_ID, method: 'ping' }) + '\n');

  async function awaitReady(): Promise<void> {
    let readyTimer: NodeJS.Timeout | undefined;
    await Promise.race([
      ready,
      new Promise<void>((resolve) => { readyTimer = setTimeout(resolve, readyBudget); }),
    ]);
    clearTimeout(readyTimer);
    assert.ok(
      readyMs !== null || exitInfo !== null,
      `the child never answered a ping within ${readyBudget}ms and is still running — it never ` +
      `became ready, which is a different failure from answering wrongly. stderr: ${err}`,
    );
  }

  return {
    send: (message) => child.stdin.write(JSON.stringify(message) + '\n'),
    async responses(count) {
      await awaitReady();
      const deadline = Date.now() + responseBudget;
      while (seen.length < count && Date.now() < deadline) {
        await new Promise<void>((resolve) => {
          waiters.push(resolve);
          setTimeout(resolve, 100);
        });
      }
      assert.ok(
        seen.length >= count,
        `expected ${count} responses, got ${seen.length} within ${responseBudget}ms of a child ` +
        `that answered a ping after ${readyMs}ms` +
        (exitInfo === null ? '' : ` and has since exited (${JSON.stringify(exitInfo)})`) +
        `; stderr: ${err}`,
      );
      return seen.slice(0, count);
    },
    stderr: () => err,
    messageCount: () => seen.length,
    exitInfo: () => exitInfo,
    readyMs: () => readyMs,
    stop: () => new Promise<void>((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) { resolve(); return; }
      child.once('close', () => resolve());
      child.stdin.end();
      child.kill();
    }),
  };
}
