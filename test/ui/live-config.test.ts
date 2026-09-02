/**
 * **The measurement, performed** — `plan:live seq:8`.
 *
 * A server is started against a corpus, `config.json` is edited OUT OF BAND
 * (the terminal, or the owner's own editor: never the UI's own write), and the
 * two endpoints are asked again:
 *
 *     endpoint         before    after the edit
 *     /api/config      1111      9999
 *     /api/simulate    1111      9999      <- was 1111 for the life of the process
 *
 * That second row is the whole task. `resolveWorkspace()` ran once at server
 * start and every request was handed the same `Workspace`, so `ws.config` was a
 * photograph; `/api/config` re-read the file and disagreed with every other
 * endpoint for the rest of the run.
 *
 * Three things this file proves that the unit test under it
 * (`test/core/live-workspace.test.ts`) cannot:
 *
 *  - the two endpoints AGREE, which is the owner-visible symptom;
 *  - the blast radius is not the budget ribbon — a category disabled out of
 *    band moves `/api/item/:id`'s own injection verdict, with no restart;
 *  - the UI's own budget write still lands, now that the in-place patch it used
 *    to make into the boot snapshot (`ui/execute.ts`) has been removed.
 *
 * **No expectation here spells a budget COUNT.** `plan:live seq:9` landed a
 * fifth budget, `continuity`, absent from most `config.json` files; every
 * expectation is composed from `DEFAULT_BUDGETS`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { DEFAULT_BUDGETS, type Budgets } from '../../src/core/config.ts';
import { BUDGETS_ID } from '../../src/ui/execute.ts';
import { TOKEN_HEADER } from '../../src/ui/security.ts';
import { startUiServer, type RunningUiServer } from '../../src/ui/server.ts';
// Pins the session store out of the real `~/.my-context`; see the module.
import '../helpers/pin-sessions-dir.ts';

const ITEM_TITLE = 'a constraint the ribbon can be measured against';

function project(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-live-cfg-'));
  assert.equal(runCli(['init'], dir, () => {}), 0);
  assert.equal(
    runCli(['add', '--summary-omitted', 'constraint', ITEM_TITLE, '--body', 'a body', '--yes'], dir, () => {}), 0);
  assert.equal(runCli(['rebuild'], dir, () => {}), 0);
  return dir;
}

const configFile = (cwd: string): string => path.join(cwd, '.my_context', 'config.json');

/** The edit the measurement calls for: the file, written by something else. */
function editOutOfBand(cwd: string, raw: unknown): void {
  writeFileSync(configFile(cwd), `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
}

interface Harness { cwd: string; server: RunningUiServer; token: string }

async function tokenFor(server: RunningUiServer): Promise<string> {
  const nonce = new URL(server.urlWithNonce(10_000)).hash.slice(1);
  const response = await fetch(`http://127.0.0.1:${server.port}/api/handoff`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nonce }),
  });
  assert.equal(response.status, 200);
  return ((await response.json()) as { token: string }).token;
}

async function withServer(body: (h: Harness) => Promise<void>): Promise<void> {
  const cwd = project();
  const server = await startUiServer({ cwd, idleMs: 60_000 });
  try {
    await body({ cwd, server, token: await tokenFor(server) });
  } finally {
    await server.close();
    removeTree(cwd);
  }
}

const get = async (h: Harness, target: string): Promise<{ status: number; body: unknown }> => {
  const res = await fetch(`http://127.0.0.1:${h.server.port}${target}`,
    { headers: { [TOKEN_HEADER]: h.token } });
  return { status: res.status, body: await res.json() };
};

interface ConfigBody {
  parseError: string | null;
  resolveError: string | null;
  servingLastGood: boolean;
  resolved: { budgets: Budgets } | null;
}

/** `/api/config`'s view of the budgets — the endpoint that always re-read. */
async function configBudgets(h: Harness): Promise<Budgets> {
  const answer = await get(h, '/api/config');
  assert.equal(answer.status, 200);
  const body = answer.body as ConfigBody;
  assert.equal(body.parseError, null, 'the fixture config must load');
  assert.equal(body.resolveError, null, 'the fixture config must load');
  return body.resolved!.budgets;
}

/** `/api/simulate`'s view of the budgets — the endpoint that used to be frozen. */
async function simulateBudgets(h: Harness): Promise<Budgets> {
  const answer = await get(h, '/api/simulate?event=manual&cold=1');
  assert.equal(answer.status, 200, JSON.stringify(answer.body));
  return (answer.body as { budgets: Budgets }).budgets;
}

/* -------------------------------------------------------------------------- *
 * The measurement.
 * -------------------------------------------------------------------------- */

test('an out-of-band edit reaches /api/simulate, and the two endpoints agree', async () => {
  await withServer(async (h) => {
    // Before: both endpoints, the same answer — the file and the snapshot are
    // one value here, which is why the bug was invisible until something moved.
    assert.deepEqual(await configBudgets(h), DEFAULT_BUDGETS);
    assert.deepEqual(await simulateBudgets(h), DEFAULT_BUDGETS);

    editOutOfBand(h.cwd, { budgets: { pinned: 9999 } });

    const expected: Budgets = { ...DEFAULT_BUDGETS, pinned: 9999 };
    // After: `/api/config` always answered this. `/api/simulate` answered
    // `DEFAULT_BUDGETS.pinned` for the life of the process before this change.
    assert.deepEqual(await configBudgets(h), expected);
    assert.deepEqual(await simulateBudgets(h), expected,
      '/api/simulate must read the file, not the workspace resolved at server start');
    assert.deepEqual(await simulateBudgets(h), await configBudgets(h),
      'the two endpoints must agree');
  });
});

test('a second edit lands too — this is a re-read, not a one-shot invalidation', async () => {
  await withServer(async (h) => {
    editOutOfBand(h.cwd, { budgets: { pinned: 1111 } });
    assert.equal((await simulateBudgets(h)).pinned, 1111);
    editOutOfBand(h.cwd, { budgets: { pinned: 9999 } });
    assert.equal((await simulateBudgets(h)).pinned, 9999);
  });
});

test('the blast radius is not the ribbon: a category disabled out of band moves a verdict', async () => {
  await withServer(async (h) => {
    const items = await get(h, '/api/items');
    assert.equal(items.status, 200);
    const id = (items.body as { items: { id: string; title: string }[] }).items
      .find((i) => i.title === ITEM_TITLE)!.id;

    const before = await get(h, `/api/item/${encodeURIComponent(id)}`);
    assert.equal((before.body as { injection: { injected: boolean } }).injection.injected, true);

    editOutOfBand(h.cwd, { categories: { constraint: { enabled: false } } });

    const after = await get(h, `/api/item/${encodeURIComponent(id)}`);
    assert.equal((after.body as { injection: { injected: boolean } }).injection.injected, false,
      'every reader of ws.config decides against the file, not against server start');
  });
});

/* -------------------------------------------------------------------------- *
 * R3: the UI's own writer, with the in-place patch removed.
 * -------------------------------------------------------------------------- */

test('the UI\'s own budget write still reaches /api/simulate with no in-memory patch', async () => {
  await withServer(async (h) => {
    const confirm = await get(h,
      `/api/execute/confirm?${new URLSearchParams({ id: BUDGETS_ID, pinned: '22000' })}`);
    assert.equal(confirm.status, 200, JSON.stringify(confirm.body));
    const nonce = (confirm.body as { nonce: string }).nonce;

    const write = await fetch(`http://127.0.0.1:${h.server.port}/api/execute`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [TOKEN_HEADER]: h.token },
      body: JSON.stringify({ id: BUDGETS_ID, values: { pinned: '22000' }, nonce }),
    });
    assert.equal(write.status, 200, JSON.stringify(await write.json()));

    // `ui/execute.ts` used to assign into `ctx.ws.config.budgets` here. It no
    // longer does, and the number still moves — by the one route an editor,
    // a terminal and this button all take.
    assert.equal((await simulateBudgets(h)).pinned, 22_000);
    assert.equal((await configBudgets(h)).pinned, 22_000);
  });
});

/* -------------------------------------------------------------------------- *
 * R2: what happens when the file on disk stops loading, mid-session.
 *
 * Decided: keep the last config that loaded, and disclose it. `/api/config`
 * shows the broken text and the loader's message, as it always has; every
 * other endpoint keeps answering rather than failing together.
 * -------------------------------------------------------------------------- */

test('a config.json corrupted mid-session does not take the endpoints down', async () => {
  await withServer(async (h) => {
    editOutOfBand(h.cwd, { budgets: { pinned: 9999 } });
    assert.equal((await simulateBudgets(h)).pinned, 9999);

    writeFileSync(configFile(h.cwd), '{ this is not json', 'utf8');

    // The LAST GOOD config — 9999, not the defaults, and not a 500.
    assert.deepEqual(await simulateBudgets(h), { ...DEFAULT_BUDGETS, pinned: 9999 });
    for (const target of ['/api/items', '/api/status', '/api/meta']) {
      assert.equal((await get(h, target)).status, 200, `${target} must keep answering`);
    }
  });
});

test('/api/config discloses the break, and says the rest of the server is on the last good config', async () => {
  await withServer(async (h) => {
    assert.equal(((await get(h, '/api/config')).body as ConfigBody).servingLastGood, false);

    writeFileSync(configFile(h.cwd), '{ this is not json', 'utf8');

    const broken = (await get(h, '/api/config')).body as ConfigBody;
    assert.notEqual(broken.parseError, null, 'the text the user has to fix is still shown');
    assert.equal(broken.resolved, null);
    assert.equal(broken.servingLastGood, true);
  });
});

test('a config.json that parses and does not LOAD is disclosed the same way', async () => {
  await withServer(async (h) => {
    editOutOfBand(h.cwd, { budgets: { pinned: 'lots' } });

    const broken = (await get(h, '/api/config')).body as ConfigBody;
    assert.equal(broken.parseError, null, 'it parsed');
    assert.match(broken.resolveError ?? '', /budgets/);
    assert.equal(broken.servingLastGood, true);
    assert.deepEqual(await simulateBudgets(h), DEFAULT_BUDGETS);
  });
});

test('repairing config.json recovers every endpoint without a restart', async () => {
  await withServer(async (h) => {
    writeFileSync(configFile(h.cwd), '{ this is not json', 'utf8');
    assert.equal(((await get(h, '/api/config')).body as ConfigBody).servingLastGood, true);

    editOutOfBand(h.cwd, { budgets: { pinned: 4242 } });

    assert.equal(((await get(h, '/api/config')).body as ConfigBody).servingLastGood, false);
    assert.equal((await simulateBudgets(h)).pinned, 4242);
  });
});

test('a corrupt config.json at START still refuses to start — the safe moment is kept', async () => {
  const cwd = project();
  try {
    writeFileSync(configFile(cwd), '{ this is not json', 'utf8');
    await assert.rejects(
      startUiServer({ cwd, idleMs: 60_000 }),
      /is not valid JSON/,
      'a server that cannot load its config must refuse to start, not start and then fail',
    );
  } finally {
    removeTree(cwd);
  }
});

/* -------------------------------------------------------------------------- *
 * R4 (`plan:live seq:13`): the disclosure has to reach a screen that is not
 * Configure.
 *
 * R2 above settled that a mid-session break keeps the last good config rather
 * than failing every endpoint at once, and that `/api/config` says so. What it
 * left is the reader who never opens Configure: Simulate draws a ribbon and
 * Work draws a governing set from that last good config, and until now nothing
 * on those screens could tell them the file had moved out from under it.
 *
 * `/api/meta` is where it lands because the shell fetches it on EVERY screen to
 * fill the status strip — so a field there is a fact every screen already has
 * in hand, not a second channel to keep in step with `/api/config`'s.
 * -------------------------------------------------------------------------- */

interface MetaBody { configError: string | null }

const meta = async (h: Harness): Promise<MetaBody> => {
  const answer = await get(h, '/api/meta');
  assert.equal(answer.status, 200, JSON.stringify(answer.body));
  return answer.body as MetaBody;
};

test('/api/meta carries configError: null while the file on disk is the governing config', async () => {
  await withServer(async (h) => {
    // PRESENT and null, never absent. "The config governing this page is the
    // file in front of you" is the measured good state, and a strip cannot
    // draw a fact that is missing from the payload
    // (STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is).
    const body = await meta(h);
    assert.ok('configError' in body, 'the field is present in the good state too');
    assert.equal(body.configError, null);

    // Still null after an out-of-band edit that LOADS: the config moved, and
    // that is not an error — this field is about the file failing to load, not
    // about it changing.
    editOutOfBand(h.cwd, { budgets: { pinned: 9999 } });
    assert.equal((await meta(h)).configError, null);
    assert.equal((await simulateBudgets(h)).pinned, 9999);
  });
});

test('a mid-session config break reaches a screen that is not Configure', async () => {
  await withServer(async (h) => {
    editOutOfBand(h.cwd, { budgets: { pinned: 9999 } });
    assert.equal((await meta(h)).configError, null);

    writeFileSync(configFile(h.cwd), '{ this is not json', 'utf8');

    // The ribbon still answers, and it answers from the LAST GOOD config —
    // 9999, not the file, which no longer has a readable number in it.
    assert.equal((await simulateBudgets(h)).pinned, 9999);

    // …and the strip on that same screen can now say so, without the reader
    // having to open Configure to find out.
    const broken = await meta(h);
    assert.notEqual(broken.configError, null,
      'a screen other than Configure must be able to disclose the break');
    assert.match(broken.configError ?? '', /is not valid JSON/);
    assert.match(broken.configError ?? '', /config\.json/,
      'the message names the file the reader has to go and fix');
  });
});

test('a config.json that parses and does not LOAD reaches /api/meta the same way', async () => {
  await withServer(async (h) => {
    editOutOfBand(h.cwd, { budgets: { pinned: 'lots' } });

    // The second of the two ways a file stops becoming a `Config`. Both arrive
    // through `loadConfig`, so both arrive here — the field is the loader's own
    // sentence, not a boolean that would flatten them into one word.
    const broken = await meta(h);
    assert.match(broken.configError ?? '', /budgets/);
    assert.equal(((await get(h, '/api/config')).body as ConfigBody).servingLastGood, true,
      'the two disclosures agree, because both are derived from the same loader');
  });
});

test('repairing the file clears configError with no restart', async () => {
  await withServer(async (h) => {
    writeFileSync(configFile(h.cwd), '{ this is not json', 'utf8');
    assert.notEqual((await meta(h)).configError, null);

    editOutOfBand(h.cwd, { budgets: { pinned: 4242 } });

    assert.equal((await meta(h)).configError, null,
      'the disclosure is a state, not a latch — it goes away when the file loads again');
    assert.equal((await simulateBudgets(h)).pinned, 4242);
  });
});

test('configError and the config every other endpoint answered from cannot disagree', async () => {
  await withServer(async (h) => {
    writeFileSync(configFile(h.cwd), '{ this is not json', 'utf8');

    // The property that makes this DERIVED rather than plumbed: `/api/meta`
    // reporting a break and `/api/config` reporting `servingLastGood` are two
    // readings of one loader, so there is no arrangement in which one says the
    // file loads and the other says it does not.
    assert.equal(
      (await meta(h)).configError === null,
      ((await get(h, '/api/config')).body as ConfigBody).servingLastGood === false,
    );
  });
});
