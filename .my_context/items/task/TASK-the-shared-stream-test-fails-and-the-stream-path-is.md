---
id: TASK-the-shared-stream-test-fails-and-the-stream-path-is
type: task
title: the shared-stream test fails and the stream path is untouched
status: active
severity: soft
always: false
summary: A test proving the live feed opens only once fails every time, and nothing in the feed's own code has changed.
summary_of: b5cebedb8b691557
acknowledged:
  - state_unaudited@c836fd9adae9f48a
scope: []
tags:
  - v2
  - ui
  - live
  - e2e
  - "plan:live"
  - "seq:11"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: d670507616344884
plan: live
seq: "11"
state: done
priority: "1"
source: "found running the browser suite over seq:9, 2026-08-28"
---

# the shared-stream test fails and the stream path is untouched

> Found running the browser suite over `plan:live seq:9` and `plan:categories seq:21`, 2026-08-28. **Not diagnosed. Recorded with the evidence rather than guessed at.**
>
> ## The failure
>
> `e2e/live-stream.spec.ts` · `the shell opens the stream ONCE — a second subscriber reuses the same connection` · ~99 — *"the shell opens the stream ONCE — a second subscriber reuses the same connection"* fails in both projects:
>
>     Error: visiting Watch never opened the shared stream at all
>
> and the page under test displays, from `watch.js`'s own error path:
>
>     "the stream refused to continue: network error"
>
> with three regions reading *"not measured — this screen's endpoint refused"*.
>
> Deterministic: 2 failed / 4 passed on three consecutive isolated runs. In the FULL suite only one of the two projects fails, so there is a timing component on top of a real cause.
>
> ## What was ruled OUT, by measurement
>
> * **The stream code is untouched by today's work.** `git diff` over `src/ui/server.ts`, `src/ui/watch-model.ts` and `src/ui/public/app.js`: no changes. `src/ui/public/lib/live-invalidation.js`: no changes. `src/core/audit.ts`: comments only. `src/ui/public/screens/watch.js`: one citation comment. `src/ui/public/lib/palette-defs.js`: four lines adding `--continuity` to the `edit` flag catalogue.
> * **It is not the demo corpus.** `shelled()` builds its own fixture — `mkdtemp`, `init`, `audit`, `startUiChild` — and never touches `.demo-corpus`.
> * **It is not the audit projection.** `mycontext audit` was run against the fixture corpus; no change.
> * **The same path works in isolation.** A direct probe — `startUiServer` in-process against a freshly `init`ed corpus, Chromium, navigate to `#/watch` — logs `200 /api/watch/stream?backlog=20`. The stream opens and is served.
> * **It passed earlier the same day.** The last full-suite run before these two tasks landed showed five failures and this was not among them.
>
> ## The hypothesis worth testing first
>
> The test attaches its `request` listener AFTER `page.goto` and before setting the hash. If the shell now opens the shared stream during the INITIAL load — because the landing screen already declares kinds under `plan:live seq:2`/`seq:3` — then no NEW request fires on `#/watch`, the counter stays at zero, and the assertion fails while the behaviour it is testing (one shared connection) is actually correct.
>
> The *"stream refused to continue: network error"* on the page is consistent with that reading: a stream that opened at load and then died, rather than one that never opened.
>
> **If that is the cause, the TEST is wrong and not the shell** — and the fix is to count stream requests from before `goto`, or to assert on the connection's identity rather than on a request arriving after a navigation. Do not "fix" the shell to open a second connection; that would break the very property this test exists to protect.
>
> ## What must not happen
>
> Do not delete or weaken this test to get the suite green. It guards `plan:live seq:1`'s whole claim — one stream, shared. A second connection per subscriber is a real defect this would stop catching.
>
> ## Also worth fixing while here
>
> The controller's own ad-hoc probes called `startUiServer` WITHOUT importing `test/helpers/pin-sessions-dir.ts`, and so wrote session digests into the real `~/.my-context/ui-sessions.json` (observed, timestamped 17:39). That is the same contamination `plan:port seq:95`'s pin exists to prevent, arriving through a route the pin cannot cover: a hand-written script. Harmless now only because `SESSION_MAX` was raised to 64 the same day. A guard that refuses to start an unpinned server when `NODE_ENV`/a test marker is set, or simply a documented probe helper that imports the pin, would close it.
>
> ## Done when
>
> The cause is established by measurement rather than the hypothesis above being assumed; the fix is in whichever of the test or the shell is actually wrong; the full browser suite is green; and the unpinned-probe route is either guarded or documented.

**MEASURED 2026-08-29 — it fails in ISOLATION too, which changes what this task is**

`live-stream.spec.ts` · `test('the shell opens the stream ONCE` · ~99 was recorded as passing alone and failing only under contention. That half is no longer true: it fails **2 of 6 on consecutive isolated runs**, and passes **16/16 when run beside `e2e/app-refresh.spec.ts`**.

Two independent confirmations it is not caused by recent work: the status-strip regression fix reverted both of its own edits and re-ran to an identical failure, and the controller measured it directly.

**So it is ORDER-dependent, not load-dependent** — which sharpens the original hypothesis rather than replacing it. The test attaches its `request` listener AFTER `page.goto` and before setting the hash, so whether a stream opened during the initial load gets counted depends on what else has warmed the page. Another spec running first changes that timing and it passes.

**That makes the TEST wrong, not the shell.** And it means the property it exists to protect — one shared connection however many subscribers — is currently unguarded in both directions, because a test that passes for a timing reason is not evidence of anything.

**Do not "fix" it by making the shell open a second connection.** That satisfies the assertion by destroying the property.

The fix is to count stream requests from before `goto`, or to assert on the connection's identity rather than on a request arriving after a navigation.
