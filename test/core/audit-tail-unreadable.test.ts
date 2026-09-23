// @basis TASK-one-unreadable-directory-makes-the-audit-projection-look, INV-nothing-is-dropped-silently
//
// The third surface of that item's closing condition, and the one where a
// refusal raised in round one lands in a place the module itself had already
// argued it must not.
//
// `AuditTail`'s constructor lists the segments to capture the EOFs that are
// the live/history boundary. `backlog()`'s own docblock explains why the
// READING was deliberately deferred out of that constructor:
//
//   "A constructor that throws would take the stream down before its response
//    head was written, turning a disclosed `fault` event into a bare 500."
//
// Once `auditSegments` stopped answering `[]` to a refused `readdir`, the
// LISTING could throw there too — and `streamHandler` (`ui/watch-model.ts`)
// constructs the tail AFTER `res.writeHead(200, 'text/event-stream')` and
// outside any `try`, so the throw would escape the handler with the head
// already on the wire: not even a 500, just a stream that stops. The fix is
// the same deferral the docblock describes — hold the refusal and raise it
// from `backlog()` and `poll()`, which the stream handler already converts
// into a disclosed `fault` event carrying the error's own sentence.
//
// The refusal is planted as a FILE where `.audit` belongs (`ENOTDIR`); see
// `test/core/audit-segments-unreadable.test.ts` for why it is not `EACCES`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ServerResponse } from 'node:http';
import { AuditLogUnreadableError, auditDir, recordAudit } from '../../src/core/audit.ts';
import { closeProjectionUpkeep } from '../../src/core/audit-db.ts';
import { AuditTail } from '../../src/core/audit-tail.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { registerWatchRoutes } from '../../src/ui/watch-model.ts';
import { matchRoute, type ApiContext } from '../../src/ui/routes.ts';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

function box(): { root: string; dispose(): void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-tail-unreadable-'));
  assert.equal(runCli(['init'], dir, () => {}), 0, 'fixture command failed: init');
  const root = resolveWorkspace(dir).projectRoot;
  assert.ok(root !== null);
  recordAudit(root, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-x' });
  closeProjectionUpkeep();
  removeTree(auditDir(root));
  writeFileSync(auditDir(root), 'a file where the audit log directory belongs\n');
  return { root, dispose: () => { closeProjectionUpkeep(); removeTree(dir); } };
}

test('the constructor does not throw when the log directory will not list', () => {
  const b = box();
  // The whole point: by the time this runs in `streamHandler` the 200 and the
  // `text/event-stream` head are already on the wire, and there is no `try`
  // around it.
  const tail = new AuditTail(b.root, { backlog: 3 });
  assert.ok(tail instanceof AuditTail);
  b.dispose();
});

test('the refusal is raised from backlog() and poll(), where the stream discloses it', () => {
  const b = box();
  const tail = new AuditTail(b.root, { backlog: 3 });
  for (const [what, call] of [
    ['backlog()', () => tail.backlog()],
    ['poll()', () => tail.poll()],
  ] as const) {
    assert.throws(call, (err: unknown) => {
      assert.ok(
        err instanceof AuditLogUnreadableError,
        `${what}: the refusal must arrive as itself, so a caller can tell it from a damaged line`,
      );
      assert.match(err.message, /could not be listed/);
      return true;
    });
  }
  b.dispose();
});

test('a healthy log tails exactly as before — the deferral changes nothing else', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-tail-healthy-'));
  try {
    assert.equal(runCli(['init'], dir, () => {}), 0, 'fixture command failed: init');
    const root = resolveWorkspace(dir).projectRoot;
    assert.ok(root !== null);
    recordAudit(root, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-before' });
    const tail = new AuditTail(root, { backlog: 5 });
    const opening = tail.backlog();
    assert.equal(opening.records.length, 1);
    assert.equal(opening.complete, true);
    // A live tail starts at the captured EOFs: what was already there is the
    // backlog, and only what lands afterwards arrives on `poll()`.
    assert.deepEqual(tail.poll(), { records: [], resync: false });
    recordAudit(root, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-after' });
    const polled = tail.poll();
    assert.equal(polled.resync, false);
    assert.deepEqual(polled.records.map((r) => r.itemId), ['RULE-after']);
  } finally {
    closeProjectionUpkeep();
    removeTree(dir);
  }
});

/** Just enough `ServerResponse` for the stream route: it writes SSE frames and ends. */
function captureSse(): { res: ServerResponse; frames: () => { event: string; data: unknown }[] } {
  let buffer = '';
  const res = {
    writeHead(): unknown { return res; },
    write(chunk: string): boolean { buffer += chunk; return true; },
    end(): unknown { return res; },
    on(): unknown { return res; },
  } as unknown as ServerResponse;
  return {
    res,
    frames: () => buffer.split('\n\n').filter((f) => f.trim() !== '').map((frame) => {
      let event = 'message';
      let data = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7);
        else if (line.startsWith('data: ')) data += line.slice(6);
      }
      return { event, data: data === '' ? null : JSON.parse(data) as unknown };
    }),
  };
}

test('the watch stream sends a fault event carrying the sentence, not a dead connection', () => {
  const b = box();
  registerWatchRoutes();
  const matched = matchRoute('GET', '/api/watch/stream');
  assert.ok(matched !== null && matched.handler.kind === 'stream');

  const { res, frames } = captureSse();
  // `backlog` > 0, so the opening read happens synchronously inside the
  // handler: no timer, no wall clock, and the fault is on the wire before the
  // call returns.
  const url = new URL('http://127.0.0.1/api/watch/stream?poll=50&backlog=3');
  const ctx = {
    ws: resolveWorkspace(path.dirname(b.root)),
    configError: null,
    repoRoot: path.dirname(b.root),
    url,
    params: {},
    body: undefined,
  } as unknown as ApiContext;

  matched.handler.handle(ctx, res);

  const sent = frames();
  const fault = sent.find((f) => f.event === 'fault');
  assert.ok(
    fault !== undefined,
    `the stream must disclose the refusal as a fault event; it sent ${JSON.stringify(sent)}`,
  );
  const body = fault.data as { error: string };
  // The SAME sentence the CLI prints and the error carries — no second wording
  // invented for the browser.
  assert.match(body.error, /the audit log directory/);
  assert.match(body.error, /could not be listed/);
  assert.match(body.error, /No audit record has been lost/);
  b.dispose();
});
