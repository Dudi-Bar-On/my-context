import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { probeUiServer } from '../../src/core/ui-server-probe.ts';
import { readUiServerRecord, writeUiServerRecord } from '../../src/core/ui-server-record.ts';

// --- Proving a UI server is there --------------------------------------------
//
// `plan:upkeep seq:3`. The property under test is not "can it connect" — it is
// that the RECORD IS NEVER BELIEVED. Every test below that ends in `dead` is a
// test that a plausible, well-formed, perfectly readable record was checked
// rather than taken at its word, because a record that outlives its server is
// the normal case rather than the exotic one.
//
// Every test uses a temp directory. Nothing here may reach the real home:
// `test/core/real-home-guard.test.ts` exists because code once wrote there and
// turned 134 unrelated tests red with a message pointing nowhere near the cause.

function root(): string {
  return mkdtempSync(path.join(tmpdir(), 'uiprobe-'));
}

function withRecord(fields: { pid: number; port: number; host?: string }): string {
  const dir = root();
  writeUiServerRecord({
    version: 1,
    pid: fields.pid,
    host: fields.host ?? '127.0.0.1',
    port: fields.port,
    url: `http://127.0.0.1:${fields.port}/`,
    startedAt: 1_756_300_000_000,
    workspace: 'D:\\repo',
  }, dir);
  return dir;
}

/** A real listening socket on an ephemeral port. */
async function listening(): Promise<{ port: number; close: () => Promise<void> }> {
  const server = net.createServer((socket) => socket.end());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  return {
    port,
    close: () => new Promise<void>((resolve) => { server.close(() => resolve()); }),
  };
}

/** A port nothing is listening on: bind one, read it back, then give it up. */
async function closedPort(): Promise<number> {
  const open = await listening();
  const { port } = open;
  await open.close();
  return port;
}

test('no record is no-record, and nothing is deleted', async () => {
  assert.deepEqual(await probeUiServer(root()), { state: 'no-record' });
});

test('a record naming a dead pid is dead, and the record is REMOVED', async () => {
  // A pid this high is not in use; if it somehow were, step 3 would still reject
  // it, which is exactly the layering this module is built on.
  const dir = withRecord({ pid: 999_999, port: 1 });
  const live = await probeUiServer(dir);
  assert.equal(live.state, 'dead');
  assert.equal(live.why, 'pid');
  assert.equal(readUiServerRecord(dir), null,
    'a record known to be wrong is not left for the next probe to re-decide');
});

test('a live pid whose port refuses is dead BY PORT, and removed', async () => {
  // This is the case the pid check cannot catch and the whole reason step 3
  // exists: the process is real — it is this test process — and it is not the
  // server the record describes.
  const dir = withRecord({ pid: process.pid, port: await closedPort() });
  const live = await probeUiServer(dir);
  assert.equal(live.state, 'dead');
  assert.equal(live.why, 'port');
  assert.equal(readUiServerRecord(dir), null);
});

test('a live pid on a listening port is ALIVE, and the record survives', async () => {
  const open = await listening();
  const dir = withRecord({ pid: process.pid, port: open.port });
  const live = await probeUiServer(dir);
  assert.equal(live.state, 'alive');
  assert.equal(live.port, open.port);
  assert.match(live.url, new RegExp(`127\\.0\\.0\\.1:${open.port}`));
  assert.notEqual(readUiServerRecord(dir), null);
  await open.close();
});

test('the probe HANGS UP immediately — it must not look like the activity it measures', async () => {
  // If the probe sent a request it would touch the server's idle monitor, and a
  // server nobody had opened would be kept alive forever by the thing checking
  // on it. Assert that not one byte arrives.
  let received = 0;
  const server = net.createServer((socket) => { socket.on('data', (buf) => { received += buf.length; }); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  const dir = withRecord({ pid: process.pid, port });
  assert.equal((await probeUiServer(dir)).state, 'alive');
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(received, 0);
  await new Promise<void>((resolve) => { server.close(() => resolve()); });
});

test('the probe is BOUNDED — an unanswering port does not hang the turn', async () => {
  // `Stop` runs on a 3-second timeout the platform genuinely waits for, so a
  // probe that can block is a probe that can freeze a prompt.
  const dir = withRecord({ pid: process.pid, port: 1 });
  const started = Date.now();
  const live = await probeUiServer(dir, 50);
  assert.equal(live.state, 'dead');
  assert.ok(Date.now() - started < 2000, `took ${Date.now() - started}ms`);
});

test('an unreadable record is no-record, not dead — there was nothing to disprove', async () => {
  // `readUiServerRecord` degrades every shape it cannot fully understand to
  // null, so the probe never sees a half-trusted record. The distinction
  // matters to the caller: `dead` means a server went away, `no-record` means
  // none was ever claimed.
  assert.deepEqual(await probeUiServer(root()), { state: 'no-record' });
});
