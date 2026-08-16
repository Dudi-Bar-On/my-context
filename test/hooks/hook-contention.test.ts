/**
 * The E4 stall, pinned from the user's side: a SessionStart that meets a
 * locked index database must fail open FAST and say so, not inherit the MCP
 * surface's patience.
 *
 * Before this policy existed, the hook path went through the same
 * `openWithBusyRetry` defaults as every other surface — 5 attempts, each of
 * which can block for the full 3000ms `busy_timeout` — so a contended
 * SessionStart stalled ~15–18s (measured 16.9s on this machine) and then
 * returned '' with no trace anywhere. `hooks.json` gives the hook 10s, so in
 * production the process was killed mid-stall and the injection vanished with
 * even less of a trace. Both halves matter and both are asserted here: the
 * hook must come back well inside the hook timeout, and the failure must be
 * disclosed — in the returned context AND in the audit log — rather than
 * swallowed.
 *
 * The bound is 5s: comfortably above the intended worst case (~1.5s: two
 * 500ms open attempts, backoff, then one 500ms rebuild attempt) so a slow CI
 * machine cannot flake it, and comfortably below both the old ~15s behaviour
 * and the 10s hooks.json budget, so the old policy cannot pass it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { readAudit } from '../../src/core/audit.ts';
import { Store } from '../../src/core/store.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { buildJitOutput } from '../../src/hooks/pre-tool-use.ts';
import { buildSessionStartOutput } from '../../src/hooks/session-start.ts';
import { removeTree } from '../helpers/tmp.ts';

const HOLDER = path.join(import.meta.dirname, '..', 'fixtures', 'hold-write-lock.ts');

/** The whole contended path must finish inside this; see the header comment. */
const STALL_BOUND_MS = 5_000;

interface Contended {
  cwd: string;
  projectRoot: string;
  holder: ChildProcess;
  dispose(): Promise<void>;
}

/** A workspace whose index database another process holds the write lock on. */
async function contendedWorkspace(): Promise<Contended> {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-contention-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  const ws = resolveWorkspace(cwd);
  assert.ok(ws.projectRoot);

  // Create the database (schema, WAL) before the holder takes the lock, so
  // the hook's open exercises the contended-BEGIN path rather than first-ever
  // creation.
  Store.open(ws.dbPath).close();

  const holder = spawn(process.execPath, [HOLDER, ws.dbPath, '60000'], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise<void>((resolve, reject) => {
    holder.stdout!.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('held')) resolve();
    });
    holder.on('exit', (code) => reject(new Error(`holder exited early (${code})`)));
    holder.on('error', reject);
  });

  return {
    cwd,
    projectRoot: ws.projectRoot!,
    holder,
    async dispose() {
      // Wait for the holder to actually die before removing the tree: on
      // Windows its open database handle blocks the removal, and `kill()`
      // returns before the process is reaped.
      const gone = new Promise<void>((resolve) => holder.once('exit', () => resolve()));
      holder.kill();
      await gone;
      removeTree(cwd);
    },
  };
}

test('a contended SessionStart fails open fast, and the failure is disclosed', async () => {
  const ws = await contendedWorkspace();
  try {
    const started = Date.now();
    const out = buildSessionStartOutput(ws.cwd, { source: 'startup', sessionId: 'sess-e4' });
    const elapsed = Date.now() - started;

    assert.ok(
      elapsed < STALL_BOUND_MS,
      `SessionStart took ${elapsed}ms against a locked index — the hook retry ` +
      `policy is stalling instead of failing open (bound: ${STALL_BOUND_MS}ms)`,
    );
    // Fail OPEN is not fail SILENT: the one thing this session must not get
    // is an empty injection with no explanation anywhere.
    assert.notEqual(out, '', 'a contended SessionStart returned "" — the failure was swallowed');
    assert.match(out, /NOT injected/, 'the disclosure must say context was not injected');
    assert.match(out, /locked/, 'the disclosure must name the cause');

    // And the audit log — the surface `mycontext audit` and a human read —
    // carries the same event. The audit log is JSONL beside the database, so
    // a locked index cannot block this record.
    const records = readAudit(ws.projectRoot);
    const contention = records.filter(
      (r) => r.kind === 'injection' && r.op === 'session-start' && /locked/.test(r.note ?? ''),
    );
    assert.equal(contention.length, 1, 'the contended SessionStart must be in the audit log');
    assert.equal(contention[0].sessionId, 'sess-e4');
    assert.deepEqual(contention[0].injected, []);
  } finally {
    await ws.dispose();
  }
});

test('a contended JIT lookup fails open fast', async () => {
  const ws = await contendedWorkspace();
  try {
    const started = Date.now();
    const out = buildJitOutput(
      { session_id: 'sess-e4-jit', tool_name: 'Edit', cwd: ws.cwd },
      ws.cwd,
      path.join(ws.cwd, 'src', 'anything.ts'),
    );
    const elapsed = Date.now() - started;

    assert.ok(
      elapsed < STALL_BOUND_MS,
      `the JIT path took ${elapsed}ms against a locked index — the hook retry ` +
      `policy is stalling instead of failing open (bound: ${STALL_BOUND_MS}ms)`,
    );
    // The JIT contract under any failure is '' (spec §6.5) — the bound is
    // what this test adds.
    assert.equal(out, '');
  } finally {
    await ws.dispose();
  }
});
