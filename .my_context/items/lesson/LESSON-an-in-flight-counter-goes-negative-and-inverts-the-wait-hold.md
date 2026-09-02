---
id: LESSON-an-in-flight-counter-goes-negative-and-inverts-the-wait-hold
type: lesson
title: an in-flight counter goes negative and inverts the wait; hold the set instead
status: active
severity: soft
always: false
summary: A counter that can go negative makes a test wait forever, or stop waiting far too early. Track the set instead.
summary_of: b24dc3b9a5eeb0b5
scope: []
tags:
  - v2
  - gates
  - e2e
  - lesson
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/counter.md"
source_anchor: null
source_checksum: bf49208754469503
valid_from: 2026-08-29
valid_until: null
checksum: e56376c5ea528950
---

# an in-flight counter goes negative and inverts the wait; hold the set instead

> > Found three times in one day, 2026-08-29, in three separate specs by three separate agents. Recorded as a lesson because the third instance was found only because the first two had been named.
>
> **The bug**
>
> An in-flight-request counter written as `+1` on `request` and `-1` on `requestfinished` / `requestfailed` goes NEGATIVE whenever a request starts before the listeners are attached and finishes after. On a page whose boot fetches race the harness, that is the normal case, not the edge case.
>
> `app.ts` resolves as soon as a rail button is visible while the screen module is still awaiting its boot reads — so the counter was decremented for requests it was never incremented for, and settled permanently at `-1`. Measured at `-1` in three consecutive runs.
>
> **Why a permanent −1 is worse than a stuck wait**
>
> It does not merely make `pending === 0` unreachable. **It inverts the condition.** Both halves appeared in one run of `tree-parity`:
>
> * 8 screens burned all 25 samples waiting on a page that had already finished — 168s of a 216s run. **This is the visible half**, and it is what everyone chased.
> * 10 screens broke on the second sample with 3 nodes in the section — heading only — because *"nothing in flight"* now read true while the first read was still outstanding. **Those screens were inventoried empty and the test went GREEN.**
>
> A slow spec is visible. A fabricated inventory is not. A parity gate was reporting on ten screens it had never seen, and reporting success.
>
> **The fix, and why it is structural**
>
> A `Set<Request>` cannot go negative. Deleting a request that was never added is a no-op, so a listener attached late degrades to "I did not see that one" instead of to a corrupt count. `screen-parity` and `pane-size` were repaired the same way the same day.
>
> **The general rule**
>
> A counter is a proxy for a set. Where the set is available, hold the set: the proxy's failure mode is silent and unbounded, the set's is bounded and obvious. And any settle that can be satisfied by a HOLDING state — an empty section, a placeholder chip, a count that has not started moving — is not a settle condition. Wait on the property, not on a number that correlates with it.
