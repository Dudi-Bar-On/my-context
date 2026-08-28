/**
 * `BUDGETS_ID`, the branch `src/ui/execute.ts` folds into `GET
 * /api/execute/confirm` and `POST /api/execute` — task `plan:budget seq:5`,
 * `DEC-the-ui-writes-budgets-and-the-simulator-always-meant-to`.
 *
 * `test/ui/execute-route.test.ts` already proves the ORDER for a catalogue
 * command (shape, resolve, redeem, audit, run). This file proves the same
 * shape holds for the budgets branch, which shares the confirm GET, the POST,
 * the nonce store and the single-use redemption with that branch rather than
 * duplicating any of them — and it proves the four things the task named as
 * non-negotiable: BUDGETS ONLY, no CLI command reaches it, a positive integer
 * or a named refusal, and the confirm shows real values.
 *
 * The harness is `execute-route.test.ts`'s own, reproduced rather than
 * imported: that file's helpers are module-private, and `node --test` runs
 * each file in its own process against the process-global route table anyway
 * (`routes.ts`), so nothing is shared between the two suites regardless.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { readAudit, type AuditRecord } from '../../src/core/audit.ts';
import { DEFAULT_BUDGETS } from '../../src/core/config.ts';
import { TOKEN_HEADER } from '../../src/ui/security.ts';
import { startUiServer, type RunningUiServer } from '../../src/ui/server.ts';
// Pins the session store out of the real `~/.my-context`; see the module.
import '../helpers/pin-sessions-dir.ts';
import { BUDGETS_ID } from '../../src/ui/execute.ts';

function project(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-budgets-'));
  assert.equal(runCli(['init'], dir, () => {}), 0);
  return dir;
}

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

interface Harness { cwd: string; server: RunningUiServer; token: string }

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

const base = (h: Harness): string => `http://127.0.0.1:${h.server.port}`;
const configPath = (cwd: string): string => path.join(cwd, '.my_context', 'config.json');
const workspace = (cwd: string): string => path.join(cwd, '.my_context');

function confirmUrl(values: Record<string, string>, lang?: string): string {
  const q = new URLSearchParams({ id: BUDGETS_ID, ...values });
  if (lang !== undefined) q.set('lang', lang);
  return `/api/execute/confirm?${q.toString()}`;
}

const getRaw = (h: Harness, target: string): Promise<Response> =>
  fetch(`${base(h)}${target}`, { headers: { [TOKEN_HEADER]: h.token } });

const postRaw = (h: Harness, body: unknown): Promise<Response> =>
  fetch(`${base(h)}/api/execute`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', [TOKEN_HEADER]: h.token },
    body: JSON.stringify(body),
  });

interface ConfirmBody {
  id: string;
  argv?: string[];
  boundary: boolean;
  effect: { id: string; kind: string; fields: { field: string; before: unknown; after: unknown }[] }[];
  nonce: string;
  residual: string;
}
interface ErrorBody { error: string }
interface WriteBody {
  id: string;
  diff: { field: string; before: number; after: number }[];
  auditNote?: string;
}

async function confirm(h: Harness, values: Record<string, string>): Promise<ConfirmBody> {
  const res = await getRaw(h, confirmUrl(values));
  const body = (await res.json()) as ConfirmBody | ErrorBody;
  assert.equal(res.status, 200, `confirm answered ${res.status}: ${JSON.stringify(body)}`);
  return body as ConfirmBody;
}

/* -------------------------------------------------------------------------- *
 * The confirm GET.
 * -------------------------------------------------------------------------- */

test('the confirm shows the real values, field by field — budgets.pinned: 6000 -> 22000', async () => {
  await withServer(async (h) => {
    const answer = await confirm(h, { pinned: '22000' });
    assert.equal(answer.id, BUDGETS_ID);
    assert.equal(answer.boundary, true);
    assert.equal(answer.effect.length, 1);
    assert.equal(answer.effect[0]!.id, 'config.json');
    assert.equal(answer.effect[0]!.kind, 'changed');
    assert.deepEqual(answer.effect[0]!.fields, [
      { field: 'budgets.pinned', before: [String(DEFAULT_BUDGETS.pinned)], after: ['22000'] },
    ]);
    assert.ok(typeof answer.nonce === 'string' && answer.nonce.length > 0);
  });
});

test('the confirm carries no argv — there is no command line for a budget write', async () => {
  await withServer(async (h) => {
    const res = await getRaw(h, confirmUrl({ pinned: '22000' }));
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(Object.hasOwn(body, 'argv'), false);
  });
});

test('a value that is not a positive integer is refused, naming the key — 400, no nonce minted', async () => {
  await withServer(async (h) => {
    const res = await getRaw(h, confirmUrl({ pinned: '-1' }));
    assert.equal(res.status, 400);
    const body = (await res.json()) as ErrorBody;
    assert.match(body.error, /budgets\.pinned must be a positive integer/);
    assert.match(body.error, /-1/);
  });
});

test('a fractional value is refused rather than truncated', async () => {
  await withServer(async (h) => {
    const res = await getRaw(h, confirmUrl({ pinned: '6000.5' }));
    assert.equal(res.status, 400);
  });
});

test('zero is refused — a UI form must not offer to silently starve a tier', async () => {
  await withServer(async (h) => {
    const res = await getRaw(h, confirmUrl({ pinned: '0' }));
    assert.equal(res.status, 400);
  });
});

test('an unknown key ("categories") is refused — BUDGETS ONLY', async () => {
  await withServer(async (h) => {
    const res = await getRaw(h, confirmUrl({ categories: 'x' }));
    assert.equal(res.status, 400);
    const body = (await res.json()) as ErrorBody;
    assert.match(body.error, /not a budget this screen writes/);
  });
});

test('a proposal identical to the current config is refused — nothing to confirm', async () => {
  await withServer(async (h) => {
    const res = await getRaw(h, confirmUrl({ pinned: String(DEFAULT_BUDGETS.pinned) }));
    assert.equal(res.status, 400);
    const body = (await res.json()) as ErrorBody;
    assert.match(body.error, /Nothing to confirm/);
  });
});

test('the residual is served exactly as a boundary command\'s confirm serves it', async () => {
  await withServer(async (h) => {
    const answer = await confirm(h, { pinned: '22000' });
    assert.match(answer.residual, /not that you asked/);
  });
});

/* -------------------------------------------------------------------------- *
 * The POST — the write itself.
 * -------------------------------------------------------------------------- */

test('a good nonce writes budgets.json, and ONLY budgets — categories/watchedDocs/profile/ui survive', async () => {
  await withServer(async (h) => {
    writeFileSync(configPath(h.cwd), JSON.stringify({
      profile: 'standard',
      categories: { lesson: { scopePolicy: 'inert' } },
      watchedDocs: ['README.md'],
      budgets: { pinned: 6000 },
    }, null, 2), 'utf8');

    const answer = await confirm(h, { pinned: '22000', jit: '9000' });
    const res = await postRaw(h, { id: BUDGETS_ID, values: { pinned: '22000', jit: '9000' }, nonce: answer.nonce });
    const body = (await res.json()) as WriteBody;
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.id, BUDGETS_ID);
    assert.deepEqual(body.diff, [
      { field: 'budgets.pinned', before: 6000, after: 22_000 },
      { field: 'budgets.jit', before: DEFAULT_BUDGETS.jit, after: 9_000 },
    ]);

    const onDisk = JSON.parse(readFileSync(configPath(h.cwd), 'utf8')) as Record<string, unknown>;
    assert.deepEqual(onDisk.budgets, { ...DEFAULT_BUDGETS, pinned: 22_000, jit: 9_000 });
    assert.equal(onDisk.profile, 'standard');
    assert.deepEqual(onDisk.categories, { lesson: { scopePolicy: 'inert' } });
    assert.deepEqual(onDisk.watchedDocs, ['README.md']);
  });
});

test('POST with no nonce is 403 and writes nothing', async () => {
  await withServer(async (h) => {
    const before = readFileSync(configPath(h.cwd), 'utf8');
    const res = await postRaw(h, { id: BUDGETS_ID, values: { pinned: '22000' } });
    assert.equal(res.status, 403);
    assert.equal(readFileSync(configPath(h.cwd), 'utf8'), before);
  });
});

test('the same nonce cannot write twice', async () => {
  await withServer(async (h) => {
    const answer = await confirm(h, { pinned: '22000' });
    const first = await postRaw(h, { id: BUDGETS_ID, values: { pinned: '22000' }, nonce: answer.nonce });
    assert.equal(first.status, 200);
    const second = await postRaw(h, { id: BUDGETS_ID, values: { pinned: '22000' }, nonce: answer.nonce });
    assert.equal(second.status, 403);
  });
});

test('a nonce minted for one value does not authorise a different one', async () => {
  await withServer(async (h) => {
    const before = readFileSync(configPath(h.cwd), 'utf8');
    const answer = await confirm(h, { pinned: '22000' });
    const res = await postRaw(h, { id: BUDGETS_ID, values: { pinned: '99000' }, nonce: answer.nonce });
    assert.equal(res.status, 403);
    assert.equal(readFileSync(configPath(h.cwd), 'utf8'), before, 'nothing may have been written');
  });
});

test('a nonce minted for a catalogue command does not authorise a budget write', async () => {
  await withServer(async (h) => {
    const res = await getRaw(h, `/api/execute/confirm?id=status`);
    assert.equal(res.status, 200);
    const answer = (await res.json()) as { nonce: string };
    const write = await postRaw(h, { id: BUDGETS_ID, values: { pinned: '22000' }, nonce: answer.nonce });
    assert.equal(write.status, 403);
  });
});

test('an invalid value at POST time is refused BEFORE the nonce is even looked at — 400, not 403', async () => {
  await withServer(async (h) => {
    const answer = await confirm(h, { pinned: '22000' });
    const res = await postRaw(h, { id: BUDGETS_ID, values: { pinned: '-1' }, nonce: 'not-even-a-real-nonce' });
    assert.equal(res.status, 400);
    void answer;
  });
});

test('the write is audited — kind mutation, op update, real fields and values, no itemId', async () => {
  await withServer(async (h) => {
    const answer = await confirm(h, { pinned: '22000' });
    await postRaw(h, { id: BUDGETS_ID, values: { pinned: '22000' }, nonce: answer.nonce });
    const rows = readAudit(workspace(h.cwd));
    const row = rows.find((r) => r.kind === 'mutation' && (r.fields ?? []).includes('budgets.pinned'));
    assert.ok(row, 'no audit row named budgets.pinned in its fields');
    const r = row as AuditRecord;
    assert.equal(r.op, 'update');
    assert.equal(r.origin, 'human');
    assert.equal(r.itemId, undefined, 'a budget is not an item and must not carry a fabricated itemId');
    assert.match(String(r.note), new RegExp(`budgets\\.pinned: ${DEFAULT_BUDGETS.pinned} -> 22000`));
  });
});

/* -------------------------------------------------------------------------- *
 * No CLI command reaches this — the task's own security property.
 * -------------------------------------------------------------------------- */

test('no catalogue entry is named "config:budgets" — an agent scripting the CLI cannot reach this write', async () => {
  const url = new URL('../../src/ui/public/lib/palette-defs.js', import.meta.url);
  const { PALETTE } = (await import(url.href)) as { PALETTE: { name: string }[] };
  assert.equal(PALETTE.some((entry) => entry.name === BUDGETS_ID), false);
});
