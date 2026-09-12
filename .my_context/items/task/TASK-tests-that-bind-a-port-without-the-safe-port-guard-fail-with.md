---
id: TASK-tests-that-bind-a-port-without-the-safe-port-guard-fail-with
type: task
title: tests that bind a port without the safe-port guard fail with bad port under load and the victims vary
status: active
severity: soft
always: false
summary: Under load, tests grab network ports that cannot be connected to, so a few fail at random and teach people to re-run instead of read.
summary_of: 919e50c517975da7
acknowledged:
  - citation_form@ec06ca49f8eff00a
  - task_unverified@ec06ca49f8eff00a
scope: []
tags:
  - v2
  - gates
  - tests
  - walk
  - "plan:walk"
  - "seq:82"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/port.md"
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: b098919d979241bd
plan: walk
seq: "82"
state: done
priority: "2"
source: "measured by plan:walk seq:74, 2026-08-29"
---

# tests that bind a port without the safe-port guard fail with bad port under load and the victims vary

> > Measured 2026-08-29 by `plan:walk seq:74`'s pane-size diagnosis, under heavy concurrent load (three agents plus a live UI server).
>
> **The symptom**
>
> `npm test` fails roughly five tests per full run with `TypeError: fetch failed` / `Error: bad port`. **The failing FILES differ run to run** — observed across `execute-budgets-route`, `execute-route`, `live-config`, `statusline-chain` — and all of them pass 87/87 when run alone. A clean run on a quiet machine the same day was 5,380 tests, 0 fail, which is the counter-evidence that it is load-shaped rather than a defect in any one test.
>
> **The cause**
>
> Helpers in `test/ui/*` that call the server directly rather than going through `startOnSafePort` can be handed a port on Chrome's/undici's UNSAFE-PORT list. `fetch` then refuses the connection outright with `bad port` before any request is made. The more tests run concurrently, the more random ports are drawn, so the failure rate scales with load and the identity of the victim is arbitrary.
>
> ~~`test/cli/statusline-chain.test.ts` is in the same shape.~~ **CORRECTED 2026-09-12 — this sentence was false when it was written.** See the correction below.
>
> **Why it matters more than five flakes**
>
> This is the second "the suite is unreliable for a reason nobody wrote down" this week; the first was `plan:walk seq:79`'s write-per-fixture, which had accumulated a five-spec allowance list that hid two real failures. A varying set of victims is precisely what teaches people to re-run rather than read, and the cost is the next real failure being dismissed.
>
> **The fix**
>
> Route every direct server call in `test/**` through `startOnSafePort`, the same way the specs that never fail already do. Then re-measure under load rather than on a quiet machine, because a quiet machine cannot reproduce this.
>
> **Done when**
>
> No test binds a port without the safe-port guard; a full `npm test` under deliberate concurrent load shows zero `bad port`; and the guard is enforced by something better than convention, so the next helper cannot reintroduce it silently.

**CORRECTION, 2026-09-12 — one of the four named victims never bound a port**

`test/cli/statusline-chain.test.ts` is **not** in the same shape, and could not
have failed with `bad port`. Measured by counting occurrences over all 799 lines
of the file:

| token | occurrences |
| --- | --- |
| `startUiServer` | 0 |
| `.listen(` | 0 |
| `--port` | 0 |
| `fetch(` | 0 |
| `createServer` | 0 |
| `127.0.0.1` | 0 |
| `http://` | 0 |
| `connect(` | 0 |

It binds nothing and opens no socket. Every hit for the string `port` in it is
inside the word `import` or `report`. Its work is `spawnSync` against a status
line delegate.

**It is still a plausible victim of load, for a different reason, and that
reason is not fixed by this item.** The file drives `DELEGATE_TIMEOUT_MS` and
carries a test named *"a delegate that hangs is killed and reported as no line,
rather than hanging the status line"* — a wall-clock assertion on a spawned
child. Under three concurrent agents that is timing-shaped, not port-shaped.
Anyone who reads a red `statusline-chain` and reaches for this item will be
looking in the wrong place.

**WHAT WAS ACTUALLY UNGUARDED, counted 2026-09-12**

The item said "helpers in `test/ui/*`". The real set is larger and is not
helpers — it is call sites, in four shapes, of which exactly one was guarded:

- **Guarded already:** `startUiChild` (`test/ui/helpers.ts:90`), the spawned
  child, which is `startOnSafePort` applied to `spawnUiChild`. Every `e2e/`
  spec reaches a server this way or applies `startOnSafePort` by hand.
- **Unguarded, in process: 20 call sites across 10 files** —
  `test/cli/ui-nonce-open.test.ts`, `test/ui/anchor-write-route.test.ts`,
  `code-skew`, `context-live`, `execute-budgets-route`, `execute-route`,
  `live-config`, `nonce-route`, `server-record`, `server`. (The commonly quoted
  figure of 16 files counts every file that NAMES `startUiServer`, including
  fifteen that only mention it in a comment.)
- **Unguarded, raw bind that is then fetched: 1** —
  `test/ui/conversation-document.test.ts`'s `askSpill` stands an
  `http.createServer` up on `listen(0)` and fetches it.
- **Unguarded, spawned child asking for `--port 0` without the screen: 1** —
  `test/ui/session-continuity.test.ts` called `spawnUiChild` directly. Not
  previously known.

Three other `.listen(0)` sites (`test/cli/ui-enabled.test.ts`,
`test/core/ui-server-probe.test.ts`, `test/core/ui-server-upkeep.test.ts`) are
`net.createServer` probes reached with `net.connect` and are NOT exposed: the
`bad port` list is enforced by `fetch` and by browsers, never by a raw socket.

**WHAT WAS BUILT, and why not inside `startUiServer`**

Two wrappers on the TEST side of the boundary, and a gate:

- `test/helpers/safe-ui-server.ts` — `startSafeUiServer`, the in-process
  starter, screened.
- `test/helpers/safe-port.ts` — `listenOnSafePort`, for a raw `http.Server`.
- `test/ui/safe-port-gate.test.ts` — the enforcement. It fails `npm test` for
  any file under `test/` or `e2e/` in one of the three unguarded shapes, and
  allows each shape in exactly ONE module: the wrapper that applies the guard.
  One entry per shape, so it cannot grow into the five-entry allowance list of
  `plan:walk seq:79` that this item's own body cites.

The screen is deliberately NOT inside `src/ui/server.ts`. The refused-port list
is a fact about a TEST's consumers; a person who runs `mycontext ui --port 6669`
and is served on some other port has been lied to by their own tool.

**RE-MEASURED UNDER LOAD, 2026-09-12 — the port lottery is gone, another flake is not**

Two full `npm test` runs, back to back, on a machine carrying ten node
processes: the owner's UI server on 58888, a second lane's UI server on 58899,
that lane's own work, and this one.

    node --import ./test/helpers/pin-rendering.ts --test "test/**/*.test.ts"

| | tests | pass | fail | skip | `bad port` | `fetch failed` | `ERR_UNSAFE_PORT` | wall |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| run 1 | 8091 | 8088 | 1 | 2 | **0** | **0** | **0** | 5m33s |
| run 2 | 8091 | 8087 | 2 | 2 | **0** | **0** | **0** | 5m20s |

**Zero `bad port`, twice. That half is done.**

**The residual is a SECOND load-shaped flake family, and it is not this item.**
Every failure in both runs is a spawned child that did not answer in time:

- run 1 — `test/cli/statusline-chain.test.ts:311`, the delegate printed nothing
  and the bridge printed its own line instead of `THEIRS session=sess-quoted`.
- run 2 — `test/cli/statusline-chain.test.ts:792`, the same shape on a different
  assertion (`THEIRS session=sess-two-profiles`).
- run 2 — `test/cli/ingest-lock.test.ts:452`, workspace B acquired the lock
  866ms after A had already released it, so the test could not measure the
  thing it exists to measure and said so rather than passing.

So `statusline-chain` really does fail under load, really does pick a different
victim each run, and **is untouched by anything to do with ports** — which is
exactly why the corrected sentence above mattered. These belong to a
`spawnSync`-under-contention item that does not exist yet.
