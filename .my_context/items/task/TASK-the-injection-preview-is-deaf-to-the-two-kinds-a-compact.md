---
id: TASK-the-injection-preview-is-deaf-to-the-two-kinds-a-compact
type: task
title: the injection preview is deaf to the two kinds a compact writes
status: active
severity: soft
always: false
summary: The screen about what a session receives is never told when a session is compressed, so it has to be reloaded by hand.
summary_of: e3e40b72e837ab03
acknowledged:
  - state_unaudited@e7a7784db8366c33
scope: []
tags:
  - v2
  - ui
  - live
  - "plan:live"
  - "seq:7"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: a402665efa66df66
plan: live
seq: "7"
state: done
priority: "1"
source: owner, 2026-08-28
---

# the injection preview is deaf to the two kinds a compact writes

> Owner, 2026-08-28, two reports minutes apart, both about the Injection preview screen and both the same root cause:
>
> 1. *"the budget ribbon at the injection preview menu item should stay in synch"*
> 2. *"injection review, when i selected compact, was not refreshed by event when compact occured, i had to refresh by myself"*
>
> **The screen is deaf to the two record kinds its own subject produces**
>
> `live-invalidation.js` declares `preview: { kinds: ['mutation', 'focus'], refresh: 'ask' }`. Measured against what a compact actually writes:
>
> * `kind: 'injection'`, `op: 'compact-restore'` — `core/inject.ts` · `kind: 'injection'` · ~839, the delivery itself.
> * `kind: 'hook'`, `op: 'post-compact'` — `hooks/post-compact.ts` · `op: 'post-compact'` · ~322.
>
> **Neither kind is declared.** A compact fires, two records land, and the one screen whose whole subject is "what does an event deliver" is told nothing. The owner selected `compact` in the event picker, the compact happened, and the page had to be reloaded by hand. That is not a missed refresh — the screen never heard the event at all.
>
> The same omission covers the ribbon: `.my_context/config.json` is watched by the `file-changed` HOOK op, which is why `config`, `palette` and `capture` all carry `hook`. `preview` draws a four-tier budget ribbon from `/api/simulate`'s `budgets` and does not.
>
> **Why the derivation missed it, worth recording rather than just fixing**
>
> `live-invalidation.js`'s own header derives preview's row as *"`/api/items`, `/api/select`, `/api/simulate` — the corpus and the gate ladder change under `mutation`"*. That is correct about the CORPUS and silent about the EVENT. It reasoned about what the endpoints read and not about what the screen is for: a preview of an event is stale the moment that event actually happens, and the record proving it happened is exactly the kind the row omits.
>
> This is the same shape as `config`'s own missing `mutation`, fixed hours earlier the same day and documented in that row's comment — a row that was right when written and wrong once something new could write.
>
> **Clarified by the owner, and it widens the claim**
>
> *"i meant it did not update at all, at least it should be checked."* Not one stale region — NO region of this screen updates without a reload. Gate ladder, ribbon, Delivered, Why not: all of it. That is the symptom a missing declaration produces, and it is the acceptance surface for this task.
>
> **The continuity lane makes this categorical, not merely stale**
>
> Owner, 2026-08-28: *"continuity lane also should be triggered by the compact and clear (start) events because there it is or could be changed."*
>
> Verified against `core/audit.ts`'s op-to-kind map: `session-start` and `compact-restore` are `injection`; `post-compact` and `session-end` are `hook`. So the two kinds this task already adds cover all four moments. What the owner adds is WHY it matters most for the newest tier.
>
> `plan:live seq:9` keys continuity dedupe on the WINDOW rather than the id, so its delivered / not-delivered state flips EXACTLY at these events and nowhere else. For the other four tiers a stale ribbon means the numbers moved. For continuity it is categorical — the guarantee is in force, or the tier delivered nothing — and a compact changes which is true. A screen that misses it shows a state WRONG IN KIND rather than out of date, a short distance from the defect `seq:9` exists to end, arriving on the screen instead of in the injection.
>
> **This is the acceptance case for this task**: drive a compact with the preview open and assert the continuity lane changes without a reload. It fails today, and visibly.
>
> **Bounds**
>
> * `refresh: 'ask'` stays. The screen holds an event picker and a session pick, both reader state a rebuild would discard, and `DEC-a-refresh-keeps-the-reader-s-place-or-it-asks` settles this. The owner should get the affordance, not a silent re-render.
> * Adding `hook` to `kinds` makes the ribbon ASK. It does not make it CORRECT — `/api/simulate` serves a config snapshot frozen at server start, so pressing refresh redraws the same stale budgets. That is `plan:live seq:8`, measured there. This task is not done by declaration alone and must not claim the ribbon is synchronised.
> * `test/ui/live-invalidation.test.ts` is the gate that holds the table to `AUDIT_KINDS`; it did not catch this because a row with the wrong kinds is well-formed. Whatever test lands here has to assert BEHAVIOUR — a compact-restore record arrives, the affordance appears — not the table's shape.
>
> **Done when**
>
> `preview` declares `injection` and `hook`; a browser test drives the screen with `compact` selected, writes a `compact-restore` record, and asserts the affordance appears without a reload; and the ribbon's staleness is either fixed by `seq:8` or disclosed rather than left to look synchronised.
