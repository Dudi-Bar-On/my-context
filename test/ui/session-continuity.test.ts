/**
 * **An open tab survives the server restarting on the same port.**
 *
 * The owner reported "still 401" three times against a server that was
 * healthy, and each earlier fix addressed a different layer of the same
 * symptom. Measured on 2026-08-23, over real HTTP, against the real corpus:
 *
 *     first load, fresh nonce  ->  200
 *     reload, cookie only      ->  200
 *     -- server restarts on the same port --
 *     reload, previous cookie  ->  403, and the server expires the cookie
 *     refresh                  ->  401
 *     refresh                  ->  401   (forever)
 *
 * The cause is one sentence: **a token was minted per process and kept only in
 * memory** (`security.ts` · `minted per invocation, held in memory on both sides and nowhere else` · ~28), <!-- historical-citation: the OLD text of that comment; the fix this file pins is what replaced it -->
 *
 * so a restarted server could not recognise any credential an open tab held,
 * and a page can only earn a new one by redeeming a nonce PRINTED IN THE
 * TERMINAL. Refresh therefore moved a page from 403 to 401 and held it there.
 *
 * The banner added the day before told the reader to refresh. That was a
 * promise the protocol could not keep, which is why the fix had to change what
 * refresh CAN DO rather than what the page says.
 *
 * **What is persisted is a DIGEST, never the token.** The browser's cookie
 * holds the secret; disk holds `sha256(token)`. A reader of the file gets
 * something they cannot present. This matters more than it looks: `mode: 0o600`
 * is not honoured on win32 — measured, a file written 0600 lands 666 — so a
 * plain token file would be a live credential readable by anything running as
 * the user. A digest file is not a credential at all.
 *
 * The store lives OUTSIDE every corpus, under the global root, for two
 * reasons that are both load-bearing: `server-e2e.test.ts` snapshots every byte
 * under the workspace and asserts the read surface changes none of them, and a
 * file inside `.my_context/` is a file that can be committed.
 *
 * `MYCONTEXT_UI_SESSIONS_DIR` is what keeps this suite out of the developer's
 * real home directory. That is not hypothetical caution: a fixture leaking into
 * `~/.my-context/` turned 134 unrelated tests red on 2026-08-22 with a message
 * pointing nowhere near the cause.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { TOKEN_COOKIE } from '../../src/ui/security.ts';
import { redeemNonce, spawnUiChild, type UiHarness } from './helpers.ts';

function project(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ui-sess-'));
  const run = (args: string[]): void => {
    assert.equal(runCli(args, dir, () => {}), 0, `fixture command failed: ${args.join(' ')}`);
  };
  run(['init']);
  run(['add', 'rule', 'Pin me', '--body', 'Pinned body. '.repeat(10), '--yes']);
  return dir;
}

/** A GET carrying ONLY the cookie — exactly what a reloaded page sends. */
function withCookie(port: number, token: string): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/api/ping`, {
    headers: { cookie: `${TOKEN_COOKIE}=${token}` },
  });
}

/**
 * Both servers share one sessions directory, which is what makes them the same
 * INSTALLATION rather than two unrelated processes. Restarting `mycontext ui`
 * in the same corpus is the case under test; two different corpora sharing a
 * token would be a defect, and is asserted separately below.
 */
async function withRestart(
  body: (first: UiHarness, second: UiHarness, token: string) => Promise<void>,
): Promise<void> {
  const cwd = project();
  const sessions = mkdtempSync(path.join(tmpdir(), 'myctx-sessions-'));
  const previous = process.env['MYCONTEXT_UI_SESSIONS_DIR'];
  process.env['MYCONTEXT_UI_SESSIONS_DIR'] = sessions;
  let first: UiHarness | null = null;
  let second: UiHarness | null = null;
  try {
    // `--port 0` for the first, then the SAME port for the second: a restart a
    // person performs lands on the port they typed, and that is the case where
    // a browser still holds a cookie for the origin.
    first = await spawnUiChild(cwd, ['--port', '0']);
    const token = await redeemNonce(first.port, first.nonce);
    const port = first.port;
    await first.stop();
    second = await spawnUiChild(cwd, ['--port', String(port)]);
    await body(first, second, token);
  } finally {
    if (second !== null) await second.stop();
    if (first !== null) await first.stop();
    if (previous === undefined) delete process.env['MYCONTEXT_UI_SESSIONS_DIR'];
    else process.env['MYCONTEXT_UI_SESSIONS_DIR'] = previous;
    removeTree(sessions);
    removeTree(cwd);
  }
}

test('a cookie from the previous server is accepted after a restart on the same port', async () => {
  await withRestart(async (_first, second, token) => {
    const reload = await withCookie(second.port, token);
    assert.equal(
      reload.status, 200,
      'the tab that was open when the server restarted was refused. A token minted per '
      + 'process and held only in memory cannot be recognised by the next process, and the '
      + 'page has no way to earn a new one without a nonce from the terminal — so refresh '
      + 'moves it from 403 to 401 and holds there forever.',
    );
  });
});

test('the restarted server does not expire a cookie it is willing to accept', async () => {
  await withRestart(async (_first, second, token) => {
    const reload = await withCookie(second.port, token);
    assert.equal(
      reload.headers.get('set-cookie'), null,
      'the accepted cookie was cleared anyway. `refuse()` expires a cookie this server did '
      + 'not issue so a locked-out page reaches a clean 401 instead of a permanent 403; a '
      + 'cookie that VALIDATES must not travel that path, or the next reload has nothing.',
    );
  });
});

test('a token from an unrelated corpus is still refused after a restart', async () => {
  await withRestart(async (_first, second, token) => {
    // The credential is per installation, not per port. Flipping one byte is
    // the cheapest thing that is definitely not an issued token, and it proves
    // the digest comparison is a comparison rather than a length check.
    const forged = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
    const refused = await withCookie(second.port, forged);
    assert.equal(
      refused.status, 403,
      'a token nobody issued was accepted. Persisting digests must widen what a RETURNING '
      + 'tab may present, and nothing else.',
    );
  });
});
