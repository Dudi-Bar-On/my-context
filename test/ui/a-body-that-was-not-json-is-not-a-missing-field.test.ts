// @basis TASK-twenty-one-one-line-swallows-where-the-docstring-asserts, INV-nothing-is-dropped-silently, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **`swallow/11` · m19: a POST body that was not JSON was reported as a
 * missing field.**
 *
 * One line in `src/ui/server.ts` served every POST route this server has:
 *
 *     try { body = JSON.parse(await readBody(req)); } catch { body = undefined; }
 *
 * `undefined` is also what a POST with no body at all produces, so from the
 * handler's side the two are the same value. Every handler then says its own
 * missing-field sentence — *"POST /api/config/check takes a JSON body:
 * { candidate: … }"* — to a caller that sent one and got it wrong, and to a
 * caller whose 10 MB body was REJECTED by `readBody`'s own size guard, whose
 * rejection landed in that same `catch`.
 *
 * `read-model-config.ts` states the rule this breaks, above the very handler
 * that breaks it: *"A malformed BODY is a different answer and takes a
 * different status: a 400 that names the field. 'Your config is invalid' and
 * 'I could not read what you sent me' must never share a response."* The
 * argument was already written; the narrowing was missing.
 *
 * ── WHY IT IS FIXED AT THE ONE SITE AND NOT AT THIRTEEN ───────────────────
 *
 * There are thirteen POST routes and they all read `ctx.body`. The conflation
 * is not in any of them — each is entitled to say what it needs — it is in the
 * single line that hands them a value with two meanings. Refusing there means
 * no handler is ever handed a body it cannot tell apart, which is the only
 * version of this fix that cannot be forgotten by the fourteenth route.
 *
 * ── AND AN EMPTY BODY IS STILL NO BODY ────────────────────────────────────
 *
 * `JSON.parse('')` throws, so a refusal that fired on every parse failure
 * would refuse every bodyless POST — a different behaviour change, wearing
 * this item's name. Nothing was sent is `undefined`, exactly as before; only
 * bytes that arrived and could not be read are a refusal. The item's own first
 * question: is the condition IDENTIFIED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { TOKEN_HEADER } from '../../src/ui/security.ts';
import type { RunningUiServer } from '../../src/ui/server.ts';
import { startSafeUiServer } from '../helpers/safe-ui-server.ts';
import '../helpers/pin-sessions-dir.ts';

interface Harness { server: RunningUiServer; token: string }

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
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-badbody-'));
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    assert.equal(runCli(['init'], cwd, () => {}), 0);
  } finally {
    process.chdir(previous);
  }
  const server = await startSafeUiServer({ cwd, idleMs: 60_000 });
  try {
    await body({ server, token: await tokenFor(server) });
  } finally {
    await server.close();
    removeTree(cwd);
  }
}

/** POST with the body EXACTLY as given — never `JSON.stringify`d for us. */
const postRaw = (h: Harness, route: string, body: string | undefined): Promise<Response> =>
  fetch(`http://127.0.0.1:${h.server.port}${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', [TOKEN_HEADER]: h.token },
    ...(body === undefined ? {} : { body }),
  });

test('a body that is not JSON is refused as unreadable, not as a missing field', async () => {
  await withServer(async (h) => {
    // Bytes arrived and they are not JSON. The caller's mistake is in the
    // ENVELOPE, and the answer it used to get was about the contents.
    const answer = await postRaw(h, '/api/config/check', '{"candidate": {"profile": ');
    const said = ((await answer.json()) as { error?: string }).error ?? '';

    assert.equal(answer.status, 400);
    assert.match(
      said, /not JSON|could not be read as JSON/u,
      'a body that never parsed was answered with a sentence about what the body should have ' +
      'contained, which sends the caller to look at the wrong half of its request',
    );
    assert.doesNotMatch(
      said, /takes a JSON body/u,
      'this is the missing-field sentence, said to a caller that sent a field — the conflation',
    );
  });
});

test('a body that IS JSON and is missing its field still gets the handler\'s own sentence', async () => {
  // Anti-vacuity, and the half that keeps the fix honest: refusing everything
  // at the door would make the test above green and make the endpoint useless.
  await withServer(async (h) => {
    const answer = await postRaw(h, '/api/config/check', JSON.stringify({ nothing: true }));
    const said = ((await answer.json()) as { error?: string }).error ?? '';
    assert.equal(answer.status, 400);
    assert.match(said, /takes a JSON body/u, 'the handler lost its own refusal');
  });
});

test('a body that parses is served exactly as before', async () => {
  await withServer(async (h) => {
    const answer = await postRaw(
      h, '/api/config/check', JSON.stringify({ candidate: { profile: 'standard' } }),
    );
    assert.equal(answer.status, 200);
    assert.equal(((await answer.json()) as { ok: boolean }).ok, true);
  });
});

test('a POST with no body at all is unchanged — absence is not a malformed body', async () => {
  // `JSON.parse('')` throws, so a refusal on every parse failure would refuse
  // every bodyless POST. Nothing was sent stays `undefined` and reaches the
  // handler, which says its own sentence about the field it wanted.
  await withServer(async (h) => {
    const answer = await postRaw(h, '/api/config/check', undefined);
    const said = ((await answer.json()) as { error?: string }).error ?? '';
    assert.equal(answer.status, 400);
    assert.match(
      said, /takes a JSON body/u,
      'an empty body was turned into a transport-level refusal, which is a behaviour change ' +
      'wearing this item\'s name',
    );
  });
});
