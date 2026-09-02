---
id: TASK-there-is-no-way-to-keep-the-handover-injected-while-turning
type: task
title: there is no way to keep the handover injected while turning the automatic ask off
status: active
severity: soft
always: false
summary: The only way to stop being asked for handover notes is to switch off the whole feature, including the delivery people want to keep.
summary_of: dce312cb7fda1590
scope: []
tags:
  - v2
  - config
  - handover
  - "plan:handover"
  - "seq:11"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/hoswitch.md"
source_anchor: null
source_checksum: 1d833eab11587893
valid_from: 2026-08-31
valid_until: null
checksum: 2891fa24f30c5c3b
plan: handover
seq: "11"
state: todo
priority: "2"
source: owner suggestion, 2026-08-31
---

# there is no way to keep the handover injected while turning the automatic ask off

> > Owner suggestion 2026-08-31. Checked before filing: **not planned anywhere**, and the config cannot express it today.
>
> **What the config accepts**
>
> `HANDOVER_KEYS` is exactly `path`, `marker`, `budgetTokens`, `thresholdPercent`. There is no switch for the ask.
>
> **The two halves are separable and the vocabulary conflates them**
>
> The `handover` feature does two independent things:
>
> 1. **It is READ and INJECTED** — the marked section is delivered on the continuity tier at session start, on compact-restore and manually.
> 2. **It is ASKED FOR** — at `thresholdPercent`, `Stop` asks the model to bring the file up to date, and `handover-ask.ts` later compares the ask time against the file's mtime to record `acted-on` / `ignored`.
>
> **Today the only off switch turns off both.** Removing the `handover` key means *the entire feature is off and silent* — which is the documented and correct meaning of its absence, since resolving that key is what makes the product start reading a file in somebody's repository.
>
> So a user who wants a hand-maintained handover — delivered every session, never automatically asked for — **has no way to say that.** They must choose between an unwanted ask and no continuity at all.
>
> **The accidental workaround is not a contract**
>
> `thresholdPercent: 100` would in practice never fire, because auto-compaction is measured at ~99.75% (`plan:walk seq:117`). But that is an accident of the platform's behaviour, not a promise: a build that compacted at exactly 100.0 would silently re-enable the ask. An off switch that depends on a number nobody controls is not an off switch.
>
> **Design notes for whoever takes it**
>
> * **A boolean is probably wrong.** `thresholdPercent` is already optional-with-a-default, and `config.ts` argues at length that *absent* and *chosen* are different facts a later reader will want back. A third state — asked-never — may belong in that same field rather than beside it.
> * **Whatever is chosen must be honest on the strip.** `plan:walk seq:118` draws the handover verdict beside the context figure, and its three states are `acted-on` / `ignored` / `not-asked`. Turning the ask off adds a fourth meaning to `not-asked` — *never will be* rather than *not yet* — and the strip must distinguish them or it will read as a threshold that has not been crossed.
> * **Injection must be unaffected.** If the ask is off, the continuity tier still delivers the marked section; nothing about `select()` changes.
>
> **Done when**
>
> A user can express "deliver this handover, never ask for it" in one config key; the absent-key meaning (whole feature off) is unchanged; `plan:walk seq:118`'s strip states distinguish *never asked for* from *not yet asked*; and a test drives a `Stop` at an occupancy above the threshold and asserts no ask was recorded.
