---
id: TASK-the-audit-tab-cannot-tell-a-capped-answer-from-a-complete
type: task
title: the audit tab cannot tell a capped answer from a complete one
status: active
severity: soft
always: false
summary: The activity results give no sign of whether more rows matched, so a cut-off answer looks exactly like the complete one.
summary_of: fdd9929a726580bd
scope: []
tags:
  - v2
  - ui
  - ask
  - walk
  - "plan:walk"
  - "seq:76"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/probe-body.md"
source_anchor: null
source_checksum: 3e91000887bac632
valid_from: 2026-08-29
valid_until: null
checksum: 0637439270a02e0b
plan: walk
seq: "76"
state: todo
priority: "2"
source: "found by plan:walk seq:75, 2026-08-29"
---

# the audit tab cannot tell a capped answer from a complete one

> > Found 2026-08-29 by `plan:walk seq:75` while giving the Ask screen its fetch cap, and confirmed live in the browser against the real corpus.
>
> **The defect**
>
> `corpusSelect` binds `limit + 1` and drops the extra row before display: that probe row is how the screen knows the answer was capped, and it is what makes the truncation sentence honest. **`filterSelect` binds the cap itself, with no probe.** So an audit answer that hit its limit is indistinguishable from one that did not.
>
> **Why it got worse rather than better this week**
>
> Before the cap control existed, an audit reader could at least suspect the fixed 200. Now they can raise 200 → 2,000 and *still* not be told whether that was enough — the screen shows a confident count and no signal. Measured in the browser: 2,000 records rendered 6,987 rows with no truncation line, and there is no way from the page to learn whether a 2,001st record matched.
>
> **And the SQL box says the opposite**
>
> The Ask screen prints the composed statement with the note *"The final LIMIT binds one row more than the cap: that extra row is the truncation signal, dropped before display."* On the audit tab that sentence is **false about the query displayed directly beneath it** — the parameters read `[2000]`, not `[2001]`. A teaching surface that misdescribes its own output is worse than one that says nothing.
>
> **The fix**
>
> `filterSelect` binds `limit + 1` like `corpusSelect`, and `queryProjection` drops the probe. In `src/core/audit-db.ts`.
>
> **Done when**
>
> An audit answer at any rung reports truncation when more matched; the SQL box's parameter list shows the same `+1` the note claims; and a test drives a corpus with more audit records than the rung and asserts the sentence appears — the fixture must be bigger than the cap it measures, or it proves nothing.
