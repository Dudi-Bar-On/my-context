// src/ui/public/lib/bootstrap.js
// The page receives a one-shot handoff NONCE in the URL fragment — never the
// token, and the fragment is never sent to the server or a referrer (spec
// §2). It exchanges the nonce once, then app.js history.replaceState()s the
// fragment away.
//
// A plain browser ES module: no types (the browser cannot strip them), no
// imports, no build step. `test/ui/viewmodel.test.ts` imports this file
// directly by a `file://` URL specifier (the same trick
// test/ui/strings-parity.test.ts documents), which is the whole reason this
// logic lives here rather than inline in app.js: per spec §6 the DOM glue is
// untested, so nothing that CAN be pure may live there.

/**
 * Read the one-shot nonce out of `location.hash`. `null` for "nothing here" —
 * an empty fragment, a bare `#`, or anything that is not lowercase hex — never
 * a throw: a stale or hand-typed fragment must fall through to "no token",
 * not crash the shell before it can show the exit banner.
 */
export function extractNonce(hash) {
  const value = hash.startsWith('#') ? hash.slice(1) : '';
  return /^[0-9a-f]+$/.test(value) ? value : null;
}

/**
 * Redeem the nonce for a token, once. `fetchFn` is injected so
 * `test/ui/viewmodel.test.ts` can pass a stand-in with no network — the
 * browser always passes `fetch.bind(window)`. `null` on any refusal (spec
 * §6: the nonce is one-shot and a second exchange must fail closed, not
 * throw into an unhandled rejection the shell never shows the user).
 */
export async function exchangeNonce(fetchFn, nonce) {
  const response = await fetchFn('/api/handoff', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nonce }),
  });
  if (!response.ok) return null;
  return (await response.json()).token;
}
