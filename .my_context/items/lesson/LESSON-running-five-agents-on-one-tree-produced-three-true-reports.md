---
id: LESSON-running-five-agents-on-one-tree-produced-three-true-reports
type: lesson
title: running five agents on one tree produced three true reports that meant nothing
status: active
severity: soft
always: false
summary: Several helpers sharing one workspace raise alarms that are true about what they saw and false about what it meant, and each costs time.
summary_of: ac2f3c1eb1eb7798
scope: []
tags:
  - v2
  - process
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: 7e1e01a3ce611e16
---

# running five agents on one tree produced three true reports that meant nothing

> An observation from running five agents against one working tree overnight, 2026-08-29. Not a defect in the product — a defect in how the product is being built, and it has cost measurable time twice.
>
> **What happened, three times**
>
> 1. **Two agents independently reported `REF-v2-handover-read-before-discussing-the-web-ui` failing its checksum.** Both were reading the corpus (`mycontext rebuild`, `create_item`) while the controller ran `mycontext repair` on it. `doctor` was clean before and after each report. **Both were false alarms**, and each cost an investigation.
> 2. **`src/core/item.ts` was transiently broken mid-run** by a concurrent agent — a literal newline inside `/\r\n?/` — red-lining the entire node suite for several minutes for every other agent. It self-resolved when that agent finished the edit.
> 3. **The controller swept in-flight files into commits twice** with `git add -A`, capturing another agent's half-written work under an unrelated commit message. Nothing was lost; the history is now inaccurate about what changed when.
>
> **Why this is worth recording rather than shrugging at**
>
> Each of these produced a REPORT that was true about what it observed and false about what it meant. That is the same shape this project has been finding all week in gates and screens — and here it is in the build process itself.
>
> The cost is not the minutes. It is that a false alarm about corpus corruption is indistinguishable, at the moment it arrives, from a real one — and the corpus is the thing this product exists to protect. An agent that has learned to discount checksum warnings is worse than one that has never seen one.
>
> **What actually helps, in order of value**
>
> * **The controller stages by path, never `git add -A`, while any agent is running.** Adopted mid-session after the second instance. This one is free.
> * **Corpus maintenance (`repair`, `rebuild`) is not run while agents are reading the corpus.** It is the sole cause of instances 1, and it is entirely avoidable by doing it between waves rather than during them.
> * **A transient failure should be re-measured before it is reported.** Two of the three above would have evaporated on a second look one second later. Agents should be told to confirm a corpus-integrity finding twice before raising it — the same discipline this project applies to a flaky test.
> * Worth considering: whether concurrent agents should hold **git worktrees** rather than share one tree. The tool supports it. The cost is real (setup per agent, and the controller merging), and the benefit is that instances 2 and 3 become impossible rather than merely rarer.
>
> **Done when**
>
> The staging and maintenance rules above are written where a controller will read them before dispatching a wave; agent briefs carry the confirm-twice instruction for corpus findings; and a decision is recorded on worktree isolation with its cost stated rather than assumed.
