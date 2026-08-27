/**
 * Pins the UI session store out of the developer's real home directory.
 *
 * Importing this module is the whole interface: it sets
 * `MYCONTEXT_UI_SESSIONS_DIR` to a fresh per-process temporary directory, and
 * a child process inherits it, so spawned servers are covered too.
 *
 * ── WHY THIS IS ITS OWN FILE ────────────────────────────────────────────────
 *
 * `core/ui-sessions.ts` defaults its store to `GLOBAL_DIR` — `~/.my-context` —
 * which is right for a person and wrong for a suite: every `startUiServer`
 * records the digest of the token it just minted, and that store is CAPPED at
 * `SESSION_MAX = 8`. So an unpinned run does not merely add noise. It evicts
 * the digests of the tabs the developer actually has open and locks them out
 * of their own UI, with no way back except a fresh nonce from a terminal.
 *
 * That consequence was written down correctly and the remedy still failed,
 * which is the reason this file exists. The pin lived in two places, each
 * covering one runner: `test/helpers/pin-rendering.ts` (the `--import` preload,
 * so `npm test` only) and `test/ui/helpers.ts` (the spawn helper, so Playwright
 * and anything spawning a child). The second claimed to be "the one file every
 * harness-started server goes through". It is not: a test calling
 * `startUiServer` IN PROCESS goes through neither.
 *
 * **Measured 2026-08-27** by running each file bare — `node --test <file>`,
 * which is how a test gets run while it is being worked on, and which loads no
 * preload — against a throwaway `HOME`:
 *
 *     test/ui/server.test.ts          6 digests
 *     test/ui/open.test.ts            1 digest
 *     test/ui/execute-route.test.ts   8 digests   ← fills the store alone
 *
 * Those writes reached a real developer's store and evicted the digest of an
 * open tab, which then spent 134 minutes heartbeating `/api/ping` into a 401.
 *
 * ── THE PROPERTY, AND WHAT ENFORCES IT ──────────────────────────────────────
 *
 * "A test that can mint a session token has pinned the store first." A comment
 * cannot hold that — the two it replaced were both accurate and both bypassed.
 * `test/ui/sessions-pin.test.ts` checks it instead, by finding every test file
 * that reaches a token-minting entry point and asserting this module is
 * reachable from its imports. A new such file fails there, not in the
 * developer's browser a week later.
 *
 * An existing value is honoured, because a test that needs two servers to share
 * one store — `test/ui/session-continuity.test.ts` — sets it deliberately.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

if ((process.env['MYCONTEXT_UI_SESSIONS_DIR'] ?? '') === '') {
  process.env['MYCONTEXT_UI_SESSIONS_DIR']
    = mkdtempSync(path.join(tmpdir(), 'myctx-test-sessions-'));
}

/**
 * The pinned directory, for a test that needs to read the store it wrote.
 *
 * Read through a function rather than exported as a constant so a test that
 * re-points the variable later still gets the current answer.
 */
export function pinnedSessionsDir(): string {
  return process.env['MYCONTEXT_UI_SESSIONS_DIR'] ?? '';
}
