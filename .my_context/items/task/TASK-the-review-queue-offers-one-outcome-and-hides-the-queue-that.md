---
id: TASK-the-review-queue-offers-one-outcome-and-hides-the-queue-that
type: task
title: the review queue offers one outcome and hides the queue that has something in it
status: active
severity: soft
always: false
summary: The screen for things awaiting a person shows only one of the two queues, and offers no way to accept or reject anything.
summary_of: 3de06f971b26c779
scope: []
tags:
  - v2
  - ui
  - work
  - walk
  - "plan:walk"
  - "seq:81"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/rq.md"
source_anchor: null
source_checksum: d34c764dcb2a63c2
valid_from: 2026-08-29
valid_until: null
checksum: 5b7b8f1f11615847
plan: walk
seq: "81"
state: done
priority: "1"
source: reported by the owner, 2026-08-29
---

# the review queue offers one outcome and hides the queue that has something in it

> > Owner report 2026-08-29: *"review queue has only execute option but first user should accept or reject only then execute."* They are right, and the measurement found a second defect they could not have seen.
>
> **Measured on the live app**
>
> `mycontext review revisions` → **0 pending**. `mycontext review list` → **1 draft pending** (`CONST-live-pass-probe-of-the-agent-normative-trust-boundary`).
>
> The screen renders the REVISION queue only — an empty `FIELD / IN FORCE / PROPOSED` table — and **never mentions the draft**. It also has **zero buttons of its own**: every button in the DOM at `#/work` belongs to a previously-rendered hidden screen.
>
> So the one thing actually waiting for a human is invisible on the screen built to show what is waiting for a human.
>
> **The vocabulary already exists, and it is exactly accept/reject**
>
>     review promote           <id>                      accept a draft
>     review discard           <id>                      reject a draft
>     review promote-revision  <id> --revision <rev>     accept a revision
>     review discard-revision  <id> --revision <rev>     reject a revision
>
> Four commands. The screen composes **one**. You can accept a revision; you cannot reject anything; and neither draft path is reachable at all.
>
> **The owner's ruling**
>
> Accept and Reject come first, Execute runs the decision. Each pending item offers both, the choice COMPOSES the matching command, and Execute stays the single approval boundary — so *"nothing here writes"* is preserved without preserving the defect. The read-only property was never the problem; offering one of two outcomes was.
>
> **Done when**
>
> Both queues are shown, drafts included; every pending item offers Accept and Reject; the composed command reflects the choice and is visible before it runs; and whether Execute actually runs on this screen is measured and stated rather than assumed (`KNOWN-execute-is-not-implemented-the-button-is-mounted-on-seven` is open).
