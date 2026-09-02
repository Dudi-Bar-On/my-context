---
id: TASK-taking-the-live-refresh-discards-the-reader-s-event-pick
type: task
title: taking the live refresh discards the reader's event pick, which is what ask exists to protect
status: active
severity: soft
always: false
summary: Accepting the offer to refresh throws away the choice the reader had made, which is the very thing asking first exists to protect.
summary_of: 04965251e400e9ea
scope: []
tags:
  - v2
  - ui
  - walk
  - live
  - "plan:walk"
  - "seq:64"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: f205cc824c39ca95
plan: walk
seq: "64"
state: done
priority: "1"
source: "found by plan:live seq:7 while writing its test, 2026-08-28"
---

# taking the live refresh discards the reader's event pick, which is what ask exists to protect

> Found by `plan:live seq:7` while writing its browser test, 2026-08-28. **It changed how that test had to be written**, which is the strongest kind of finding: the defect was discovered by trying to measure something else.
>
> **The defect**
>
> `screens/preview.js`'s `render()` rebuilds `#evsel` from `EVENTS[0]`. So taking the live-refresh affordance **discards the reader's event pick** and returns the screen to `session-start`.
>
> That is the exact state `refresh: 'ask'` exists to protect. `DEC-a-refresh-keeps-the-reader-s-place-or-it-asks` says a screen either keeps the reader's place or asks before redrawing; `preview` correctly declares `ask` — and then, when the reader says yes, throws away the thing the asking was for.
>
> **Why it nearly hid itself, and this is the part worth keeping**
>
> The obvious test — the one the owner described and the one this task's parent nearly wrote — is: pick `compact`, drive a compaction, take the refresh, assert the continuity lane changed.
>
> **That test would have passed while measuring nothing.** Taking the refresh resets the picker to `session-start`, and on this fixture the continuity answer for `session-start` happens to equal the answer for `compact`. So the assertion would have gone green whether the invalidation worked or not, and it would have been measuring the picker's reset rather than the screen noticing an event.
>
> `seq:7` spotted this and drove the LANDING event instead, where the flip is unambiguous. A test that is green for the wrong reason is worse than a missing test, and this one was one line away from existing.
>
> **The second half: the `ask` justification is thinner than it reads**
>
> `live-invalidation.js` justifies `preview: refresh: 'ask'` on two pieces of reader state — the event picker and the session pick. But **the session pick is not reader state at all today**: `ctx.session()` is `/api/sessions`' default and there is no selector. So the justification rests entirely on the event picker, which a taken refresh discards.
>
> The ruling still holds on other grounds (a rebuild reorders rows under an open pane), but the stated reason should say what is true. Fix the picker and it becomes true again.
>
> **Bounds**
>
> * Fixing this means `render()` preserving the picked event across a re-render — the reader's selection is client state that no fetch carries, exactly like the simulator's slider position.
> * Check the sibling state at the same time: the `tool` event's chosen path (`chosenPath`) has the same shape and probably the same bug.
> * **Do not fix it by changing `refresh` to `'auto'`.** That removes the ask and keeps the loss.
> * A browser test must assert the picked event SURVIVES a taken refresh — and, given the above, it must use an event whose answer DIFFERS from `session-start`'s, or it will pass without measuring.
>
> **Done when**
>
> Taking the refresh preserves the event pick and the chosen path; `live-invalidation.js`'s justification for `preview`'s `ask` states only what is true; and a browser test asserts survival using an event whose answer differs from the landing event's, so it cannot pass by coincidence.
