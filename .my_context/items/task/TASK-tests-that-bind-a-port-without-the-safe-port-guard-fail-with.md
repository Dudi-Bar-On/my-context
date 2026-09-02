---
id: TASK-tests-that-bind-a-port-without-the-safe-port-guard-fail-with
type: task
title: tests that bind a port without the safe-port guard fail with bad port under load and the victims vary
status: active
severity: soft
always: false
summary: Under load, tests grab network ports that cannot be connected to, so a few fail at random and teach people to re-run instead of read.
summary_of: 24a008fe8e268d57
scope: []
tags:
  - v2
  - gates
  - tests
  - walk
  - "plan:walk"
  - "seq:82"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/port.md"
source_anchor: null
source_checksum: 3be76e0af5860872
valid_from: 2026-08-29
valid_until: null
checksum: 68e34eb02c93b2f9
plan: walk
seq: "82"
state: todo
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
> `test/cli/statusline-chain.test.ts` is in the same shape.
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
