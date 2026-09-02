---
id: LESSON-a-verdict-drawn-from-one-field-of-a-multi-field-answer
type: lesson
title: a verdict drawn from one field of a multi-field answer denies the other fields
status: active
severity: soft
always: false
summary: When an answer covers several things, a conclusion drawn from one of them quietly denies the rest, and "nothing changed" is the worst of these.
summary_of: e2c0cc4f3dc43167
scope: []
tags:
  - v2
  - ui
  - lesson
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/lesson2.md"
source_anchor: null
source_checksum: 224e2397a05e445f
valid_from: 2026-08-29
valid_until: null
checksum: 426649d61242d8e7
---

# a verdict drawn from one field of a multi-field answer denies the other fields

> > Found 2026-08-29 by `plan:walk seq:10`, in the browser, on a screen whose node tests were green.
>
> **The shape**
>
> `POST /api/config/preview` answers **three** questions about a proposed change — what stops being injected, what spills at the new budget, and what an agent may now edit. A panel that reads **one** of those three and finds it unmoved says *"No change"* — and thereby denies the other two.
>
> Two real cases, both measured on the live corpus:
>
> * `budgets.pinned 16000 → 4000` **spilled 16 items**, and the panel said *"No change — this is the configuration in force"*, because a budget never moves `injection()`.
> * `categories.rule.agentEdits review → allow` **moved 39 items**, and said the same, because `agentEdits` moves neither `injection()` nor `select()`.
>
> Each panel was correct about the question it asked. Both were wrong about the change.
>
> **Why no node test could catch it**
>
> The endpoint's own tests assert each field independently and all three passed. The defect only exists in the *composition* — one reader, three answers, and a sentence that generalises from the one it happened to read. Nothing that tests a field can see a claim made about the union of fields.
>
> **The rule**
>
> **A summary sentence must be as wide as the data it summarises.** If a response answers N questions, a verdict drawn from one of them is a verdict about that one — and must either say so, or rank all N and report the strongest. "No change" is the most dangerous form, because a reader takes it as a statement about *the change*, not about the field the panel happened to read.
>
> The fix was to rank the faces — stops, spills, starts, edits, fits, none — so the panel reports the strongest true statement rather than the first one it looked at.
>
> **Where else to look**
>
> Any screen that draws one sentence from a multi-field response. The delivered/spilled/tokens plate, the doctor cards, the strip's four groups, and every "nothing to report" state in the app are the same shape and have not been checked.
