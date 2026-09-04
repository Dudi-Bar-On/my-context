---
id: TASK-the-handover-verdict-is-computed-and-kept-and-the-strip
type: task
title: the handover verdict is computed and kept and the strip never shows it
status: active
severity: soft
always: false
summary: Whether the handover notes were written when they were asked for is already recorded, and shown nowhere.
summary_of: 580588284f8346f9
scope: []
tags:
  - v2
  - ui
  - shell
  - handover
  - walk
  - "plan:walk"
  - "seq:118"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/hoNotice.md"
source_anchor: null
source_checksum: d0c160bf0a1ac589
valid_from: 2026-08-31
valid_until: null
checksum: 48d20ea424a3c13e
plan: walk
seq: "118"
state: done
priority: "1"
needs: walk/117
source: owner ruling, 2026-08-31
---

# the handover verdict is computed and kept and the strip never shows it

> > Owner ruling 2026-08-31: show, beside the context figure, when the handover was automatically created or updated.
>
> **The fact already exists, is durable, and nothing reads it**
>
> Every `pre-compact` record carries `handoverAsk` — a settled verdict, not a claim. Read from the live audit log:
>
>     2026-08-29T04:22  auto  99.7147%  handoverAsk: acted-on
>     note: "handover ask acted-on — the handover reports/V2-HANDOVER.md was written
>            at 2026-08-29T04:18:53.462Z, after the ask at 2026-08-29T04:18:19.959Z"
>
> That is the whole gap: the verdict is computed, written and kept, and **the strip does not read it.**
>
> **Why this is the right fact to surface**
>
> `DEC-the-ask-and-the-writing-are-two-turns-apart-so-a-flag-is` settles it: *the flag is not a claim, it is a comparison*. The writer is the model, so the ask and the writing are inherently turns apart and no hook could contain them. What a hook can do is compare two things it observes — when the ask went out, and when the file was last written:
>
>     written after the ask  ->  ACTED ON
>     not written            ->  IGNORED, and that is a fact worth having
>
> This project has already paid for the alternative once: the item held to be the continuity guarantee was delivered on no event at all, for weeks, while everyone believed the guarantee was in force — because a record said an ask went out, which reads exactly like the mechanism working.
>
> **What the strip should say, and what it must not**
>
> Three states, and none of them may be silent:
>
> * **acted on** — with *when*, because the value is knowing the handover is current
> * **ignored** — the ask went out and the file was not written. **This one matters most** and is the one a reader will never think to check for.
> * **not asked** — the threshold has not been crossed. A measured not-yet, not an absence.
>
> Current session, for reference: the latch reads `asks: 0`, `askedAt: null`, window opened 2026-08-29 — because context sits near 60% and 98 has not been crossed since. Correct behaviour, and today invisible.
>
> **Rulings**
>
> * **Do not re-derive the verdict in the client.** `handoverAsk` is computed by `handover-ask.ts` against the file's mtime; a second computation in the browser is a second spelling of one question, which is how facts come apart. Serve it.
> * **`not-asked` is a measured zero and is drawn and named** — `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`.
> * **If the handover feature is off entirely** — the `handover` key absent from config, which means the whole feature is off and silent — say that, rather than showing `not-asked`. They are different facts.
> * Pairs naturally with `plan:walk seq:117` (occupancy colour): both live beside the context figure and both are about what happens as the window fills.
>
> **Done when**
>
> The strip draws all three states from the served verdict; `ignored` is visibly distinct rather than a quieter `acted-on`; the feature-off case says so; and a browser test drives a session in each state rather than asserting the element exists.
