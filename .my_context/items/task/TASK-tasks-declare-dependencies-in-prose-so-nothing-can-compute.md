---
id: TASK-tasks-declare-dependencies-in-prose-so-nothing-can-compute
type: task
title: tasks declare dependencies in prose, so nothing can compute what is ready
status: active
severity: soft
always: false
summary: Nothing can work out which jobs are ready, because what blocks what is written only in sentences and never in a form a machine can read.
summary_of: fff596752e95198a
scope: []
tags:
  - v2
  - corpus
  - planning
  - "plan:categories"
  - "seq:21"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-28
valid_until: null
checksum: acd2c00ca5f22d2f
plan: categories
seq: "21"
state: done
priority: "1"
source: owner, 2026-08-28
---

# tasks declare dependencies in prose, so nothing can compute what is ready

> Owner, 2026-08-28: *"how do you prioritize the plans? did you checked dependencies between them?"*
>
> The honest answer to the second question is **no, not systematically — and it could not have been done systematically, because the data does not exist.** Measured the moment the question was asked:
>
>     tasks (non-superseded)            425
>       with a `blocks:` field            0
>       with relations                    0
>       with `state: blocked`             5
>       naming a dependency IN PROSE    ~28
>
> **Zero of 425 tasks carry a machine-readable dependency.** Ordering has been done from the `priority` field, from whatever the owner reported most recently, and from dependency reasoning performed in conversation and then lost.
>
> ## `state: blocked` is a flag with no target
>
> Five tasks say they are blocked. None says by what — that lives in a sentence in the body, if anywhere. So nothing can answer "what is now runnable" after a task lands, and nothing notices when a blocker clears.
>
> Not hypothetical, and it happened the same day: `plan:walk seq:8` carried the line *"Blocked on plan:walk seq:7."* `seq:7` landed and went green; `seq:8` sat at `state: blocked` until a human-driven reconciliation caught it by hand while drawing a progress table. `plan:port seq:6` and `plan:walk seq:14` were freed by the same landing and nothing announced either.
>
> ## The prose cannot be parsed, and trying proves it
>
> A deliberate attempt to extract the graph with a regex over the ~28 prose mentions matched **four**, and one of those four resolved to `the/45` — a plan that does not exist, harvested from a sentence like "after the ... seq:45". A dependency notation that yields a 25% hit rate and a false positive in the same pass is not a notation.
>
> ## The vocabulary already exists and was never extended
>
> `open_question` declares `blocks` — *"a field; free text; `mycontext edit <id> --extra blocks=<value>`"* — and its category prose says it *"carries `blocks`, naming what is waiting on the answer."* `task` declares seven extras (`plan`, `seq`, `state`, `priority`, `source`, and two more) and `blocks` is not among them.
>
> So the mechanism was designed, implemented for the category that needed it least, and never given to the 425 items that plan the work. Extending it is a category declaration, not a new subsystem.
>
> ## What this has to produce, or it is just another field nobody fills
>
> * **`needs` on `task`**, holding `plan/seq` references — the direction that matters, because a task knows what it is waiting for and rarely knows who is waiting on it. `blocks` is derivable by inversion; `needs` is not derivable from anything.
> * **`state: blocked` must name its blocker.** A blocked state with an empty `needs` should be a `mycontext doctor` finding, exactly as a checksum mismatch is. That is what turns the field from documentation into a gate.
> * **A ready list**: the open tasks whose `needs` are all `done`, sorted by priority. This is the artefact that makes the field pay for itself — it answers "what can be started right now" without a human re-deriving it, which is the derivation that failed on `seq:8`.
> * **Doctor should flag a cleared blocker**: a task at `state: blocked` whose `needs` are all satisfied is a task that should have moved and did not.
>
> ## The relationship to the progress standard
>
> `STD-the-progress-table-has-one-format-and-this-is-it` already requires reconciling states before counting, and names the failure it prevents: a table drawn over stale states is *"precise about the wrong corpus, and precise in the flattering direction."* A cleared-but-unmoved blocker is that same failure in the other column — `blocked` overstates trouble the way stale `todo` understates progress. The standard makes reconciliation a human obligation; this task is what would let a machine do the part a machine can.
>
> ## Done when
>
> `task` declares `needs`; the five currently-blocked tasks carry theirs; `mycontext doctor` flags a blocked task with no `needs` and a blocked task whose `needs` are all satisfied; a command or report lists the ready tasks by priority; and the ~28 prose dependencies are either converted or deliberately left with a note saying why.
