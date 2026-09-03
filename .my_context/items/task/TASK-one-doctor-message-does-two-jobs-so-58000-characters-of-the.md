---
id: TASK-one-doctor-message-does-two-jobs-so-58000-characters-of-the
type: task
title: one doctor message does two jobs so 58000 characters of the same paragraph print sixty-one times
status: active
severity: soft
always: false
summary: The health report repeats the same long explanation with every finding, so the page is almost all one paragraph and tells you nothing.
summary_of: 22b9f11b068d27ec
acknowledged:
  - body_disagrees_with_meta@9acbb023e1537a53
  - citation_form@9acbb023e1537a53
scope: []
tags:
  - v2
  - ui
  - doctor
  - walk
  - "plan:walk"
  - "seq:122"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/msgsplit.md"
source_anchor: null
source_checksum: null
valid_from: 2026-08-31
valid_until: null
checksum: 3fe7afce6b64e25e
plan: walk
seq: "122"
state: todo
priority: "1"
needs: walk/121
source: owner report, 2026-08-31
---

# one doctor message does two jobs so 58000 characters of the same paragraph print sixty-one times

> > Owner report 2026-08-31: *"the notice text is quite big and hard to read and understand"*. Measured before filing.
>
> **The measurement**
>
>     61 findings                     63,560 characters total
>     945 chars of every message      IDENTICAL on all 61  =  58000 characters repeated
>     the part that actually differs  99 characters
>
> The differing part is the whole finding:
>
>     3 citation(s) point by line number and carry no fragment
>     — injected.js:70, work.js:458, packs.js:522 <!-- historical-citation: a verbatim reproduction of the 99 characters a doctor finding actually printed, quoted to measure the message against the 945 identical ones around it; rewriting it would misquote the output -->
>
> **Ninety-one per cent of that screen is one paragraph printed sixty-one times.**
>
> **The cause is one message doing two jobs**
>
> `checkCitationForm` composes the finding AND the teaching into a single string. The finding is per-ITEM — which item, which pointers. The teaching is per-CODE — what the form is, why a line number proves only that the line exists, where the gate's own docblock explains it. The second is identical every time and belongs once.
>
> **Why this is not a wording problem**
>
> A reader facing 61 × 1,000 characters reads none of them. The screen holds 63KB of true, careful prose and communicates nothing — which is worse than a terse message, because the effort spent writing it is invisible and the reader still leaves not knowing what to do.
>
> The prose itself is good. It is in the wrong place and at the wrong multiplicity.
>
> **The shape of the fix**
>
> * **`Finding.message` states the finding.** Short, specific, per item.
> * **The explanation moves to the CODE**, drawn once per group — the screen already groups by code (`citation_form (60)`), so there is a natural home for it.
> * Whatever carries the long form should be **available rather than present** — a disclosure, a title, or the summary trigger `plan:walk seq:119` describes. It must not vanish: the reasoning is why the rule exists.
>
> **Do not lose these two sentences when moving them.** They are the argument, not decoration:
>
> > *"A line number proves only that the line exists; it cannot say whether the code it named is still there, and a plausible wrong number sends a reader somewhere real."*
>
> and the reason the form is not spelled out inside the message — *"a real citation in this string would be read as one, and a mangled example is exactly what the gate exists to catch"*.
>
> **Check the other codes before assuming this one is special.** `nested_corpus` and the codes that do not currently fire (`dead_scope`, `source_drift`, `orphan_relation`, and the rest) may have the same shape. Measure them rather than fixing the one that happens to be visible.
>
> **Done when**
>
> The per-item message is the finding alone; the explanation is drawn once per code group and remains reachable; no code repeats more than a sentence of shared text across its findings; and the total characters on a screen showing 61 findings is measured before and after.
