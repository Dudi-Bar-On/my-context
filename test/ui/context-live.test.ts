/**
 * **THE STATUS STRIP'S CONTEXT FIGURE, UPDATED WITHOUT A RELOAD** —
 * `plan:walk seq:124`.
 *
 * Owner, 2026-08-31, CRITICAL: *"the status bar now refreshes but only when i
 * reload the page - i want it to be updated automatically without refreshing
 * the web page."*
 *
 * ── THE CAUSE, WHICH IS THIS PROJECT'S RECURRING DEFECT ──────────────────
 *
 * `CHROME_INVALIDATION.session` declares `kinds: ['injection']` and that
 * declaration is HONEST — its own derivation block says so at length. The
 * project-knowledge share genuinely is injection records; the context
 * PERCENTAGE is the status-line tee, written by `mycontext statusline` on
 * Claude Code's per-message hook, and that command appends no audit record of
 * any kind. **A fact with no audit kind can never appear in a list of kinds**,
 * so the group filled at first paint and then waited for a record that names
 * it, which nothing ever will. A hand-kept list that must agree with something
 * derived, for the seventh measured time in this corpus.
 *
 * Both ways of forcing the fact onto the log are ruled out BY MEASUREMENT and
 * not by preference: `fs.watch` collapses past ~20-50 files on this platform
 * (`core/corpus-drift.ts`), and an audit row per assistant message is one row
 * per message — 5,207 rows of that exact shape were deleted from this corpus
 * for being noise. What is left is the channel already there.
 *
 * ── WHAT THIS FILE HOLDS ─────────────────────────────────────────────────
 *
 *   1. `/api/ping` carries the reading, and only when a session is named.
 *   2. `null` means "nobody asked" and is never one of the four reasons.
 *   3. All four `UnmeasurableWhy` states survive the trip over the wire.
 *   4. The shell reads it on the heartbeat, next to the two disclosures that
 *      already ride it.
 *   5. The refill is CONDITIONAL, which is the whole reason the cheap reading
 *      is on this request rather than a second poll of the expensive one.
 *
 * The strip's own RENDERING is `e2e/strip.spec.ts`'s and the four states'
 * meanings are `test/core/context-occupancy.test.ts`'s. This is the wire and
 * the wiring.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { writeTee } from '../../src/core/statusline-tee.ts';
import { CONTEXT_SAMPLE_FRESH_MS } from '../../src/core/context-occupancy.ts';
import { TOKEN_HEADER } from '../../src/ui/security.ts';
import { startUiServer, type RunningUiServer } from '../../src/ui/server.ts';
// Pins the session store out of the real `~/.my-context`; see the module.
import '../helpers/pin-sessions-dir.ts';

const SESSION = 'sess-live-1';

/** A sample at `percent` of a 200k window, in the shape Claude Code sends. */
function sample(percent: number): Record<string, unknown> {
  return {
    context_window: {
      context_window_size: 200_000,
      current_usage: {
        input_tokens: (200_000 * percent) / 100,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        output_tokens: 1_234,
      },
    },
  };
}

interface Harness { server: RunningUiServer; token: string; cwd: string; projectRoot: string }

async function withServer(body: (h: Harness) => Promise<void>): Promise<void> {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-live-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  const server = await startUiServer({ cwd, idleMs: 60_000 });
  try {
    const nonce = new URL(server.urlWithNonce(10_000)).hash.slice(1);
    const handoff = await fetch(`http://127.0.0.1:${server.port}/api/handoff`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nonce }),
    });
    assert.equal(handoff.status, 200);
    const { token } = await handoff.json() as { token: string };
    await body({ server, token, cwd, projectRoot: path.join(cwd, '.my_context') });
  } finally {
    await server.close();
    removeTree(cwd);
  }
}

async function ping(h: Harness, query = ''): Promise<Record<string, unknown>> {
  const res = await fetch(`http://127.0.0.1:${h.server.port}/api/ping${query}`,
    { headers: { [TOKEN_HEADER]: h.token } });
  assert.equal(res.status, 200, `/api/ping${query} answered ${res.status}`);
  return await res.json() as Record<string, unknown>;
}

/* -------------------------------------------------------------------------- *
 * The wire.
 * -------------------------------------------------------------------------- */

/**
 * **`null` IS NOT AN `unmeasurable`, AND THAT IS THE POINT OF THIS TEST.**
 *
 * The four reasons each name something a reader can act on — install the
 * bridge, wait a message, upgrade, the session is idle. None is true of a
 * request that carried no session id, and the boot heartbeat is exactly that
 * request: `fillChrome()` runs before `loadSessions()`, deliberately, so the
 * strip exists before the first data call. Answering `no-sample` there would
 * put a claim about the bridge on a question nobody asked — the collapse the
 * four reasons exist to undo.
 */
test('a ping that names no session answers null — "nobody asked", not a reason', async () => {
  await withServer(async (h) => {
    assert.equal((await ping(h))['occupancy'], null);
    assert.equal((await ping(h, '?session='))['occupancy'], null,
      'an empty session is a session that was not named');
    // Present either way, for the reason `git` is present either way on
    // `/api/meta`: an absent key reads as nobody having looked.
    assert.ok('occupancy' in (await ping(h)), 'the key is present even when nothing was asked');
  });
});

test('a ping that names a session carries the reading, and it is a real percentage', async () => {
  await withServer(async (h) => {
    assert.deepEqual(writeTee(h.projectRoot, { session_id: SESSION, ...sample(60.1) }),
      { written: true });
    const occupancy = await ping(h, `?session=${SESSION}`)
      .then((b) => b['occupancy'] as Record<string, unknown>);
    assert.equal(occupancy['state'], 'known');
    assert.equal(Math.round(occupancy['percent'] as number), 60);
    assert.equal(occupancy['windowSize'], 200_000);
    assert.equal(typeof occupancy['receivedAt'], 'string',
      'the reading carries the moment it was taken — a redraw cannot tell a NEW sample from an '
      + 'old one without it');
  });
});

/**
 * All four `UnmeasurableWhy` reasons over the wire, because the strip's job is
 * to tell them apart and a serialisation that collapsed two of them would look
 * exactly like a working feature.
 */
test('every unmeasurable reason survives the trip, distinctly', async () => {
  await withServer(async (h) => {
    const why = async (session: string): Promise<unknown> =>
      ((await ping(h, `?session=${session}`))['occupancy'] as Record<string, unknown>)['why'];

    // no-bridge: `init` makes no `.statusline/`, so nothing has ever sampled.
    assert.equal(await why(SESSION), 'no-bridge');

    // no-sample: the bridge exists, this session was never sampled.
    assert.deepEqual(writeTee(h.projectRoot, { session_id: 'sess-other', ...sample(10) }),
      { written: true });
    assert.equal(await why(SESSION), 'no-sample');

    // unknown-shape: Claude Code's schema moved under us.
    assert.deepEqual(writeTee(h.projectRoot, { session_id: SESSION, context_window: 'moved' }),
      { written: true });
    assert.equal(await why(SESSION), 'unknown-shape');

    // stale: `plan:walk seq:123`. Perfectly readable, and a fossil.
    const long_ago = new Date(Date.now() - CONTEXT_SAMPLE_FRESH_MS - 60_000).toISOString();
    assert.deepEqual(writeTee(h.projectRoot, { session_id: SESSION, ...sample(60.1) }, long_ago),
      { written: true });
    const occupancy = (await ping(h, `?session=${SESSION}`))['occupancy'] as Record<string, unknown>;
    assert.equal(occupancy['why'], 'stale');
    assert.equal('percent' in occupancy, false,
      'an unmeasurable occupancy has no percentage FIELD, which is what stops a caller writing '
      + '`?? 0` and turning "we never measured" into "the window is empty"');
  });
});

/**
 * A session id `sanitizeSessionId` refuses must not become a path, and must not
 * become a 500 either: `/api/ping` answers 200 or the heartbeat stops, and a
 * heartbeat that stops is what starved the idle timer in the boot failure
 * `app.js`'s `main()` documents at length.
 */
test('an unsafe session id is a named reason, not a traversal and not a fault', async () => {
  await withServer(async (h) => {
    // The bridge is installed first, so this exercises `sanitizeSessionId`'s
    // refusal rather than short-circuiting on the missing directory.
    assert.deepEqual(writeTee(h.projectRoot, { session_id: 'sess-other', ...sample(10) }),
      { written: true });
    const body = await ping(h, `?session=${encodeURIComponent('../../etc/passwd')}`);
    assert.deepEqual(body['occupancy'], { state: 'unmeasurable', why: 'no-sample' });
  });
});

/* -------------------------------------------------------------------------- *
 * The wiring: what the shell does with it.
 * -------------------------------------------------------------------------- */

const APP = readFileSync(
  path.join(import.meta.dirname, '..', '..', 'src', 'ui', 'public', 'app.js'), 'utf8',
).replace(/\r\n/gu, '\n');

test('the heartbeat asks for it, names the session, and reads the answer', () => {
  assert.match(APP, /api\('\/api\/ping' \+ pingQuery\(\)\)/u,
    'the reading is session-scoped, so the heartbeat has to say which session it is asking about');
  assert.match(APP, /noteOccupancy\(answer\);/u,
    'the heartbeat is the only poll a tab open since the morning makes — a field served and read '
    + 'by nobody is indistinguishable from a field nobody added');
  assert.match(APP, /session === 'cold' \? '' : '\?session=' \+ encodeURIComponent\(session\)/u,
    "'cold' is this shell's word for no session, not a session id, and must not be sent as one");
});

/**
 * **THE REFILL IS CONDITIONAL, AND THAT IS WHY THE CHEAP READING IS ON THE
 * PING AT ALL.**
 *
 * Measured 2026-08-31, Windows/Node 24: `readOccupancy` 0.32ms p50 flat, against
 * 4.69ms p50 for a full `/api/watch/context` over a 360-injection session — and
 * that one grows with the session, where `cli/commands/statusline.ts` cites
 * 5,000 injection records for one session as a shape this product meets. If the
 * heartbeat refetched unconditionally the reading would be pure cost; the whole
 * design is that it decides.
 *
 * Both branches are named here because the wrong one is silent: skipping the
 * redraw when nothing moved would freeze every "as of … ago" label at whatever
 * it said when the fetch happened to resolve, which is `walk/123`'s fossil
 * wearing a different hat.
 */
test('an unmoved reading redraws; a moved one refetches', () => {
  assert.match(APP, /if \(moved \|\| lastContextBody === null\) \{ void fillContext\(\); return; \}\n\s*drawContext\(\);/u,
    'moved refetches, unmoved redraws — the redraw is what keeps the ages honest for free');
  assert.match(APP, /return `known:\$\{String\(occupancy\.receivedAt\)\}/u,
    'the stamp is the sample\'s own moment, not the three numbers: two consecutive samples can '
    + 'carry the same token triple');
  assert.match(APP, /return `unmeasurable:\$\{String\(occupancy\.why\)\}`/u,
    'the server\'s `stale` verdict is part of the stamp, which is what makes an IDLE session '
    + 'de-colour itself instead of freezing');
});

/**
 * The refused call clears the remembered body rather than leaving it for a
 * redraw to bring back. A strip that re-asserts an answer the server has since
 * refused to confirm is worse than one that says it could not read.
 */
test('a refused fetch forgets the body it can no longer confirm', () => {
  assert.match(APP, /lastContextBody = null;\n\s*ctx\.replaceChildren\(\.\.\.unreadState\(retry\)\);/u,
    'a redraw must not resurrect an answer the server refused');
});

/**
 * Every assertion above matches a PATTERN against a file, so all of them pass
 * vacuously if the file read was the wrong one or empty. This is the control:
 * it names the one function the split introduced, so a shell restructured out
 * from under this file fails here with a sentence rather than four regexes
 * failing with none.
 */
test('the shell this file reads is the shell that ships', () => {
  assert.ok(APP.includes('function drawContext()'),
    'app.js was not found where this test looks, or the fetch/draw split has been undone');
  assert.ok(APP.includes('function fillContext()'), 'and the fetching half is still there');
});
