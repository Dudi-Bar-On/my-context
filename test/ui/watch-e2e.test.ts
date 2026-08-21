/**
 * Spawned-process E2E for the Watch stream and the Ask surface (spec §6: real
 * process, real requests). Plan 3 Task 8.
 *
 * The rendering limit (spec §6) is stated in `test/ui/server-e2e.test.ts` and
 * applies here identically: these tests verify the wire contract, not pixels.
 *
 * **The middle test is THE §2 test**, and it is the reason this file exists:
 * plan 1 built the `kind: 'stream'` slot and the dispatch that deliberately
 * does not touch the idle monitor for it
 * (`src/ui/server.ts` · `NOT idle.touch(): an open stream is not activity` · ~406),
 * but shipped no stream route, so the promise was never EXECUTED. It is now.
 *
 * **How that test is built, and why it is not a third wall-clock race.**
 *
 * `test/ui/server.test.ts` already asserts the same rule in-process
 * (`test/ui/server.test.ts` · `an open stream is not activity; a json request is` · ~85),
 * and it does it by MEASURING: a stream must not push the exit past
 * `IDLE + 500ms`, a control request must push it past `IDLE + 800ms`. Two
 * deadlines on a loaded machine, which is exactly why it is one of this
 * branch's two documented load flakes. Repeating that shape here would buy a
 * third flake and no new information, so this test asserts a LIVENESS property
 * instead of a deadline:
 *
 *   - A stream is opened and **held**, and it is **read** for the whole run —
 *     a record is appended every `APPEND_MS` so frames keep arriving, and the
 *     frames are counted. "Connected" is not enough; §2 is a claim about a
 *     server holding a live SSE connection.
 *   - A **new** stream is opened every `REOPEN_MS`, ~30 times inside one idle
 *     window, and every one of them is held open too.
 *   - Then the only assertion that matters: **the child exits anyway.**
 *
 * The reopen loop is what makes this strictly stronger than the sample test
 * the plan shipped, which opened one stream and waited. A single held stream
 * cannot tell the two regressions apart: if `idle.touch()` were moved above
 * the `kind: 'stream'` branch, one stream would delay the exit by exactly one
 * window and a test that waits ten windows would still pass, green and blind.
 * Reopening inside the window turns that into a liveness failure — under any
 * "a stream counts as activity" regression the child NEVER exits, whether the
 * touch happens per request or per poll. Verified by making it fail: with
 * `idle.touch()` hoisted above the stream branch in `src/ui/server.ts` this
 * test hangs to its bound and reports that regression by name; restored, it
 * passes.
 *
 * **The one time-based element left, stated rather than hidden.** The exit
 * itself can only be observed by waiting for it, so `GIVE_UP_MS` is a bound on
 * the claim. It is TEN idle windows, and the exit is expected at one — a
 * margin no amount of load consumes, and a bound whose failure means "the
 * server never exited", never "the server was slow". Nothing here asserts an
 * upper bound on how QUICKLY it exits, which is the assertion that flakes.
 * `IDLE_MS` is 3000ms rather than the sample's 400ms for the same reason from
 * the other side: the reopen cadence has to stay well inside the window for
 * the loop to mean anything, and 30x of headroom is what makes a stalled
 * machine produce a slower run rather than a wrong verdict.
 *
 * The first test overlaps `server-e2e.test.ts`'s stream test
 * (`test/ui/server-e2e.test.ts` · `the audit stream delivers what lands after you connect` · ~684)
 * only in its premise. That one proves a record appended after connect arrives
 * and one appended before it does not; this one proves the record's SHAPE
 * survives the wire — `spilled`, its `reason` and `tokens` — which is the half
 * the Watch screen actually renders and the half a JSON round trip can lose.
 *
 * Cleanup is `removeTree`, the one owner of test temp-directory removal; the
 * bare `rmSync` the plan's sample used is what `test/no-bare-rmsync.test.ts`
 * fails on.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { recordAudit } from '../../src/core/audit.ts';
import { DIR_NAME } from '../../src/core/workspace.ts';
import { TOKEN_HEADER } from '../../src/ui/security.ts';
import { redeemNonce, startUiChild, type UiHarness } from './helpers.ts';

function project(): { dir: string; corpus: string; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-watch-e2e-'));
  assert.equal(runCli(['init'], dir, () => {}), 0, 'fixture command failed: init');
  return { dir, corpus: path.join(dir, DIR_NAME), done: () => removeTree(dir) };
}

interface SseFrame { event: string; data: unknown }

/**
 * SSE frames off a fetch body, decoded and split on the blank line.
 *
 * A generator rather than a "read until predicate" helper because the §2 test
 * needs to keep reading a stream it is not waiting for anything on: the count
 * of frames that arrive is its evidence that the connection was live, and a
 * helper that returns on a match cannot supply it.
 */
async function* sseFrames(body: ReadableStream<Uint8Array>): AsyncGenerator<SseFrame> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) return;
    buffer += decoder.decode(chunk.value, { stream: true });
    for (let split = buffer.indexOf('\n\n'); split !== -1; split = buffer.indexOf('\n\n')) {
      const frame = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      let event = 'message';
      let data = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7);
        else if (line.startsWith('data: ')) data += line.slice(6);
      }
      yield { event, data: data === '' ? null : JSON.parse(data) as unknown };
    }
  }
}

async function nextFrame(frames: AsyncGenerator<SseFrame>, what: string): Promise<SseFrame> {
  const next = await frames.next();
  assert.ok(next.done !== true, `${what}: the stream ended before it sent a frame`);
  return next.value as SseFrame;
}

const streamUrl = (port: number): string => `http://127.0.0.1:${port}/api/watch/stream?poll=50`;

test('the stream delivers a record appended after connect — spills, reason and tokens intact', async () => {
  const { dir, corpus, done } = project();
  const abort = new AbortController();
  let h: UiHarness | null = null;
  try {
    h = await startUiChild(dir);
    const token = await redeemNonce(h.port, h.nonce);
    const stream = await fetch(streamUrl(h.port), {
      headers: { [TOKEN_HEADER]: token },
      // The server never ends this response, so every read below needs its own
      // bound: without one a broken stream hangs the file instead of failing.
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15_000)]),
    });
    assert.equal(stream.status, 200);
    assert.equal(stream.headers.get('content-type'), 'text/event-stream; charset=utf-8');

    const frames = sseFrames(stream.body!);
    // The `hello` frame is a CAUSAL signal, not a courtesy: the handler
    // constructs its `AuditTail` — which captures the current segment EOFs —
    // and only then sends it. So a record appended after this line is
    // guaranteed to be one the tail has not already passed, and the sample
    // test's "give the child a beat to prime the tail" sleep is not a shorter
    // wait here, it is a race this file does not run.
    assert.equal((await nextFrame(frames, 'the stream')).event, 'hello');

    recordAudit(corpus, {
      kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'src/a.ts',
      injected: [{ id: 'RULE-a', tier: 'jit' }],
      spilled: [{ id: 'RULE-b', tier: 'jit', reason: 'budget exceeded (900 > 800 estimated tokens)' }],
      tokens: 123,
    });

    type Delivered = { op?: string; tokens?: number; spilled?: { id: string; reason: string }[] };
    let record: Delivered | null = null;
    for await (const frame of frames) {
      if (frame.event !== 'record') continue;
      record = frame.data as Delivered;
      break;
    }
    assert.ok(record !== null, 'a record appended while the stream was open never reached it');
    assert.equal(record.op, 'jit');
    // The three fields the Watch screen renders and a JSON round trip can lose.
    assert.equal(record.tokens, 123);
    assert.equal(record.spilled?.[0]?.id, 'RULE-b');
    assert.match(record.spilled?.[0]?.reason ?? '', /budget exceeded/);
  } finally { abort.abort(); await h?.stop(); done(); }
});

test('THE §2 TEST: idle fires while a stream is connected, reading, and being reopened', async () => {
  const { dir, corpus, done } = project();

  /** The child's idle window. Every ratio below is stated against it. */
  const IDLE_MS = 3_000;
  /** How often a NEW stream is opened — ~30 inside one window. */
  const REOPEN_MS = 100;
  /** How often a record is appended, so the held stream has something to READ. */
  const APPEND_MS = 100;
  /** Ten windows. The exit is expected at one; this bounds the claim, it is not the claim. */
  const GIVE_UP_MS = 30_000;

  const abort = new AbortController();
  let h: UiHarness | null = null;
  let appender: NodeJS.Timeout | null = null;
  let looping = true;
  let loop: Promise<void> = Promise.resolve();
  try {
    h = await startUiChild(dir, ['--idle-ms', String(IDLE_MS)]);
    const { port, child } = h;
    const token = await redeemNonce(port, h.nonce);
    // Registered BEFORE anything can make the child exit, so the verdict can
    // never be lost to an event that fired while nobody was listening.
    const exit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });

    // One client, connected and READING, for the whole run.
    const held = await fetch(streamUrl(port), {
      headers: { [TOKEN_HEADER]: token }, signal: abort.signal,
    });
    assert.equal(held.status, 200);
    assert.equal(held.headers.get('content-type'), 'text/event-stream; charset=utf-8');
    const frames = sseFrames(held.body!);
    assert.equal((await nextFrame(frames, 'the held stream')).event, 'hello');

    let delivered = 0;
    const reading = (async () => {
      try {
        for await (const frame of frames) if (frame.event === 'record') delivered++;
      } catch { /* the server destroyed the socket, or the abort below fired */ }
    })();

    // …with something to read. The tail polls every 50ms, so a record every
    // 100ms keeps frames arriving for the whole window rather than leaving an
    // idle socket that proves only that a socket was open.
    let appended = 0;
    appender = setInterval(() => {
      appended++;
      recordAudit(corpus, { kind: 'focus', op: 'focus-set', sessionId: 'held', note: `n${appended}` });
    }, APPEND_MS);
    appender.unref();

    // …and a NEW stream every REOPEN_MS, each of them held open too. This is
    // what catches a per-REQUEST touch, which a single held stream cannot.
    const opens: number[] = [];
    const faults: string[] = [];
    loop = (async () => {
      while (looping) {
        try {
          const next = await fetch(streamUrl(port), {
            headers: { [TOKEN_HEADER]: token }, signal: abort.signal,
          });
          if (next.status !== 200) { faults.push(`a reopened stream answered ${next.status}`); return; }
          const first = new TextDecoder().decode((await next.body!.getReader().read()).value);
          if (!first.startsWith('event: hello')) {
            // NOT asserted on: the last attempt of the run can legitimately
            // land on a socket the idle exit is tearing down. It is reported
            // in the messages below, where it explains a thin run instead of
            // reddening a correct one.
            faults.push(`a reopened stream's first frame was ${JSON.stringify(first.slice(0, 40))}`);
            return;
          }
          opens.push(Date.now());
        } catch {
          // The server is gone, or the abort fired. Either way this loop has
          // nothing left to say; `exit` below carries the verdict.
          return;
        }
        await new Promise((r) => setTimeout(r, REOPEN_MS));
      }
    })();

    let giveUp: NodeJS.Timeout | undefined;
    const outcome = await Promise.race([
      exit.then(() => 'exited' as const),
      new Promise<'never exited'>((resolve) => {
        giveUp = setTimeout(() => resolve('never exited'), GIVE_UP_MS);
      }),
    ]);
    clearTimeout(giveUp);
    looping = false;
    clearInterval(appender);
    appender = null;
    await loop;

    const evidence = `${opens.length} streams opened, ${delivered} of ${appended} appended records `
      + `delivered on the held one${faults.length === 0 ? '' : `; faults: ${faults.join('; ')}`}`;

    // The two vacuity guards, asserted BEFORE the verdict: a run in which the
    // client never really connected would otherwise prove nothing more than
    // that an idle server with no clients exits, which is already tested.
    assert.ok(opens.length >= 5,
      `only ${opens.length} streams were opened inside a ${IDLE_MS}ms window at a ${REOPEN_MS}ms `
      + `cadence — this run was too starved to conclude anything about the idle rule (${evidence})`);
    assert.ok(delivered >= 2,
      `the held stream was connected but not READING: ${evidence}. §2 is a claim about a live SSE `
      + 'connection, and a socket nothing arrives on does not test it');

    assert.equal(outcome, 'exited',
      `the child did not exit within ${GIVE_UP_MS}ms — ten times its ${IDLE_MS}ms idle window — `
      + `while ${evidence}. A stream is holding the server up. Spec §2 says an open stream is not `
      + "activity, so the dispatch in src/ui/server.ts must not idle.touch() a kind: 'stream' "
      + 'route, and no stream handler may touch the monitor on its own poll');

    const { code, signal } = await exit;
    assert.equal(signal, null,
      `the child was killed by ${String(signal)} rather than idling out; a death is not an idle exit`);
    assert.equal(code, 0,
      `the child exited ${String(code)} rather than 0 — it CRASHED rather than idling out, and a `
      + `crash proves nothing about the idle rule. Its output was: ${h.output()}`);

    // And the stream ended from the client's point of view: the page's next
    // read fails, which is what raises the "server has exited" banner.
    await Promise.race([reading, new Promise((r) => { setTimeout(r, 5_000).unref(); })]);
  } finally {
    looping = false;
    if (appender !== null) clearInterval(appender);
    abort.abort();
    await loop.catch(() => { /* aborted mid-flight */ });
    await h?.stop();
    done();
  }
});

test('the ask surface answers over HTTP behind the token gate, and reports a stale projection', async () => {
  const { dir, corpus, done } = project();
  let h: UiHarness | null = null;
  try {
    recordAudit(corpus, {
      kind: 'injection', op: 'jit', sessionId: 's9', hook: 'PreToolUse', path: 'a.ts',
      injected: [{ id: 'RULE-a', tier: 'jit' }], tokens: 7,
    });
    // The projection is built by the PRODUCT, never by the endpoint: these
    // routes open it through the read-only door
    // (`src/ui/watch-model.ts` · `One door onto the projection for every JSON endpoint` · ~153),
    // which creates nothing. A fixture that forgot this line does not get one
    // built behind its back — it gets the `absent` empty state, which the
    // no-write sweep in `server-e2e.test.ts` probes on purpose.
    assert.equal(runCli(['audit'], dir, () => {}), 0, 'fixture command failed: audit');

    h = await startUiChild(dir);
    const token = await redeemNonce(h.port, h.nonce);
    const ask = `http://127.0.0.1:${h.port}/api/ask/audit?session=s9`;

    const ok = await fetch(ask, { headers: { [TOKEN_HEADER]: token } });
    assert.equal(ok.status, 200);
    const body = await ok.json() as {
      records: { tokens?: number }[]; sql: string; params: unknown[]; projectionState: string;
    };
    assert.equal(body.records.length, 1);
    assert.equal(body.records[0]?.tokens, 7);
    assert.match(body.sql, /SELECT json\(rec\)/);
    // `projectionState`, flat — never `projection.stateBeforeSync`. Nothing
    // syncs, so there is no state BEFORE a sync to name.
    assert.equal(body.projectionState, 'fresh');

    // The gate covers plan-3 routes too, and this request is made AFTER the
    // one above rather than before it — the order is load-bearing, and the
    // plan's sample has it the other way round. A refusal WRITES (plan §0.6:
    // one audit record, on the refusal path only), so it grows the log the
    // projection was built from and the read that follows it can no longer be
    // `fresh`.
    const denied = await fetch(ask);
    assert.equal(denied.status, 401);
    assert.equal((await denied.text()).length, 0);   // ruling A4: a status line and nothing else

    // Which is the read-only door's own rule, now proved on the wire and
    // without a clock: stale is REPORTED, never repaired. 503 naming the
    // state, and naming the command that ends it.
    const stale = await fetch(ask, { headers: { [TOKEN_HEADER]: token } });
    assert.equal(stale.status, 503);
    const staleBody = await stale.json() as { error: string; projectionState: string };
    assert.equal(staleBody.projectionState, 'behind');
    assert.match(staleBody.error, /mycontext audit/,
      'a 503 that does not name the command that ends the state leaves the user nowhere');
  } finally { await h?.stop(); done(); }
});
