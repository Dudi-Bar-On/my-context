---
id: KNOWN-a-locked-out-tab-can-only-be-recovered-by-the-restart-that
type: known_issue
title: a locked-out tab can only be recovered by the restart that locks out the next one
status: active
severity: hard
always: false
summary: A browser tab that loses its credential has no way to get another except a restart, and a restart is what takes the credential away.
summary_of: 5fb8105bbefc43c1
scope: []
tags:
  - v2
  - ui
  - security
  - usability
  - owner-blocking
origin: human
source_file: null
source_anchor: null
source_checksum: 90dcb10b04a5ac40
valid_from: 2026-08-28
valid_until: null
checksum: 03888b3eb1b62fce
---

# a locked-out tab can only be recovered by the restart that locks out the next one

> A tab that has lost its token cannot be given a new one while the server runs.
> The only route back is to restart the server — and a restart is what caused the
> loss.
>
> ## The cycle, measured twice on 2026-08-28
>
> 1. A running server holds a token. A tab holds the same token.
> 2. The server restarts (a code change, a crash, a port conflict). It mints a NEW
>    token and records the digest in `~/.my-context/ui-sessions.json`.
> 3. `ui-sessions.json` is capped at `SESSION_MAX = 8`. Old digests are evicted
>    oldest-first, and the file's own comment says so: "a restart retires the
>    oldest, and the tab holding it is asked to re-open the printed link."
> 4. The tab's request is refused `token-mismatch`, the page drops the dead token,
>    and every subsequent request is `token-missing` — a heartbeat into a 401,
>    with nothing on screen saying why.
> 5. The only recovery is a nonce, and a nonce is printed **only when a server
>    starts**. `mycontext ui` against a live port exits `EADDRINUSE` without
>    printing one.
> 6. So recovering the tab means restarting — which mints another digest, evicts
>    another, and can lock out a DIFFERENT tab. Step 6 is step 2.
>
> Measured directly: at the second incident the store held eight digests and all
> eight were server restarts from the same development session —
> `10:08:52, 22:49:37, 21:52:12, 21:51:01, 21:49:26, 21:46:48, 21:19:44, 21:02:34`.
> Not one belonged to a tab. Any tab older than eight restarts was already gone.
>
> ## What this is NOT
>
> Not the eviction defect fixed earlier the same day. That one was the TEST SUITE
> writing digests into the real store; tests are pinned out of it now and the
> guard holds. This is the ordinary, intended behaviour of a capped store meeting
> a development loop that restarts the server often — and it needs no misbehaviour
> at all to lock somebody out.
>
> ## Why the cap is not the thing to raise
>
> Raising `SESSION_MAX` moves the number of restarts a tab survives; it does not
> give a locked-out tab any way back. A tab that loses its token on restart 9
> instead of restart 5 is still a tab with no route to a credential.
>
> ## The shape of the fix, stated rather than chosen
>
> The missing capability is *"give me a credential for the server that is already
> running"*. Anything that supplies it closes the cycle — a flag on `ui` that asks
> a live server to mint and print a nonce rather than refusing the port, a nonce
> written into the liveness record on request, or an unauthenticated
> loopback-and-Origin-checked mint endpoint held to the same rules as
> `/api/handoff`.
>
> The third is the one that needs care: `/api/handoff` is token-exempt precisely
> because it is how a page first obtains a token, and a second exempt route is a
> second thing to get right. The first is the smallest.
>
> Until then the workaround is the printed link. Its TTL is
> `max(PRINTED_NONCE_TTL_MS, idleMs)` — four hours at the idle window used in
> development — so the URL from the last restart usually still works, and pasting
> it into the tab's address bar redeems it in place through the `hashchange`
> listener without a reload.
