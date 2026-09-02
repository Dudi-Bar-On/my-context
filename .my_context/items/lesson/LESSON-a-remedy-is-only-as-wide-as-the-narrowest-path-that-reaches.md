---
id: LESSON-a-remedy-is-only-as-wide-as-the-narrowest-path-that-reaches
type: lesson
title: a remedy is only as wide as the narrowest path that reaches it
status: active
severity: soft
always: false
summary: A safeguard protects only the routes that actually pass through it, and a note claiming every route does is a guess until something checks it.
summary_of: bd62f4f5f9ece8cd
scope: []
tags:
  - v2
  - testing
  - ui
  - sessions
  - process
origin: human
source_file: null
source_anchor: null
source_checksum: db8eab0e8a6d5d94
valid_from: 2026-08-27
valid_until: null
checksum: 5d16ec009a0a9580
---

# a remedy is only as wide as the narrowest path that reaches it

> The UI session store `~/.my-context/ui-sessions.json` is capped at
> `SESSION_MAX = 8`. Three test files started UI servers without pinning the
> store elsewhere, so running them recorded real digests into the developer's
> own store and evicted the digests of the tabs they had open. Measured
> 2026-08-27 by running each file bare against a throwaway `HOME`:
> `server.test.ts` 6 digests, `open.test.ts` 1, `execute-route.test.ts` 8 —
> the last filling all eight slots by itself.
>
> The cost was not theoretical. An evicted tab spent 134 minutes heartbeating
> `/api/ping` into a 401, with nothing on screen saying why, and no route back
> except a nonce minted at a terminal and pasted into its address bar.
>
> What makes this worth keeping is that the consequence was already written
> down, correctly, in the file holding the remedy. `test/ui/helpers.ts` said an
> unpinned run "would evict the digests of the tabs the developer actually has
> open, and lock them out. The suite would have caused the exact defect it was
> written to prevent." The prediction was exact. It still happened, because the
> remedy sat in a file that claimed to be "the one file every harness-started
> server goes through" and was not: a server started IN PROCESS goes through
> neither it nor the `--import` preload, and a bare `node --test <file>` is how
> a test is run while someone is working on it.
>
> The generalisable shape: a remedy is only as wide as the narrowest path that
> reaches it, and a comment asserting universality is not evidence of it. When
> a file claims "every X goes through here", that claim is a testable
> proposition and should be a test. Here it became one —
> `test/ui/sessions-pin.test.ts` walks each test file's imports and fails any
> that can mint a token without reaching the pin, proven by reintroducing the
> real defect and watching it go red.
>
> Second-order: the exemption in `real-home-guard.ts` that let this pass was
> argued well and still stands (a guard that fires on the developer's own
> running `mycontext ui` gets switched off). What did not stand were the two
> claims that made its residual affordable — "the pin lives in the preload
> every test file loads" (false for bare runs) and the destroyed digests are
> ones "the developer's browser can re-obtain" (it cannot). An accepted
> residual is only as good as the cost estimate under it, and cost estimates
> expire.
