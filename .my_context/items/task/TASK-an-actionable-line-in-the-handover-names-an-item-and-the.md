---
id: TASK-an-actionable-line-in-the-handover-names-an-item-and-the
type: task
title: an actionable line in the handover names an item, and the claim lives in the item
status: active
severity: soft
always: false
summary: Notes handed between sessions should point at the record rather than restate it, so one correction reaches every future reader.
summary_of: 622f48a8683b72e9
scope:
  - reports/V2-HANDOVER.md
  - scripts/check-handover.ts
tags:
  - v2
  - handover
  - quality
  - "plan:handover"
  - "seq:16"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 987cf69ad2d585ca
plan: handover
seq: "16"
state: todo
priority: "2"
---

# an actionable line in the handover names an item, and the claim lives in the item

> RECOMMENDATION from `handover/15` (2026-09-06), which built the truth half of the handover
> check and was asked to design this half rather than assume it. NOT IN FORCE. It is a
> recommendation to the owner with the measurement behind it, so that whoever rules does not
> have to re-measure.
>
> THE ARGUMENT, and it is two defects of the same day rather than one.
>
> FIRST. The handover carried "widen `isServableDocPath` to serve `.my_context/items/**`" in SIX
> consecutive blocks — 90%, 92%, 93%, 94%, 95%, 96% — and it was wrong. `SKIP_DIRS`
> (`src/doctor/checks.ts`) contains `.my_context`, so `listRepoFiles` never yields a corpus path
> and that predicate would have been asked about no corpus file, ever. A lane following it
> faithfully would have shipped a feature that served nothing, looked done, and passed every
> gate. The claim lived in the handover; correcting it there would have corrected one session.
>
> SECOND. `REQ-a-repository-document-is-viewable-in-the-ui-only-once-it-is` (`severity: hard`)
> appeared to contradict the product, the owner had already ruled on it, and the ruling sat in
> the handover five times and in NO ITEM. So every reader who consulted the corpus rather than
> the handover re-found the contradiction and re-raised it. Found twice, stepped over twice.
>
> Both are the same failure: A CLAIM THAT LIVES ONLY ON THE BRIDGE IS RE-LITIGATED FOREVER. The
> corpus governs; the handover is a bridge between sessions. A claim in an item is checked by
> doctor, can be retired by supersession, and one correction reaches every future session. A
> claim in the handover is corrected for exactly one reader.
>
> WHAT IS RECOMMENDED: A CONVENTION, NOT A CHECK, AND NOT A GENERATOR.
>
> An ACTIONABLE line in the handover — an instruction to do something — names a `plan/seq` lane
> or an item id, and the claim itself lives there. A line that only orients the reader ("he was
> looking at a cached page", "expect this question again") carries no pointer and needs none.
>
> WHY NOT A CHECK THAT REQUIRES A POINTER. The handover is written under pressure at high
> occupancy by an assistant with very little room left, and that is its entire purpose. A check
> that says "this line is actionable and names nothing" has to decide what ACTIONABLE means, will
> be wrong often, and its findings can only be cleared by editing the record of a past session.
> Wrong often plus unclearable is the definition of a gate people route around.
>
> WHY NOT A GENERATOR. Writing the handover FROM the corpus was considered and refused here: the
> handover's value is the assistant's own reading of the day — what it got wrong, what a lane
> reported that the item does not say — and a generated file would be an index the reader already
> has. `mycontext ready` is that index and already exists.
>
> WHAT ALREADY WORKS, AND IT IS MOST OF THE WAY THERE. Measured 2026-09-06 by
> `scripts/check-handover.ts` over 2,831 lines and 15 blocks: 117 distinct pointers — 57 lane
> references and 60 item-id references — and ZERO of them resolve to nothing. The handover is
> already largely written in pointers. The convention describes what the writer mostly does; it
> does not ask for a new habit.
>
> WHAT THE CONVENTION BUYS THAT NOTHING ELSE DOES. `scripts/check-handover.ts` can only see a
> line that carries a pointer. Every prose-only instruction is invisible to it — deliberately,
> because guessing is worse than silence. The convention is what converts an invisible claim into
> a checkable one, and it is the only thing that does.
>
> THE ONE THING THAT WOULD MAKE THIS ENFORCEABLE WITHOUT COST, if the owner wants teeth: the
> lines that are ALREADY structured. Every block since 2026-09-04 carries a "THINGS RULED AND NOT
> DISPATCHED" list and a "NEXT SESSION, FIRST THREE THINGS" list. Those are the actionable lines,
> they are enumerated, and requiring a pointer on a NUMBERED LIST ITEM under those two headings
> is a rule with a boundary a machine can find and a writer can predict. That is a narrower
> proposal than "every actionable line" and is the one recommended if a check is wanted at all.
>
> NOT DONE HERE, and why: this is a convention over how a person and an assistant write a
> document under pressure. `handover/15`'s own constraint is that nothing it lands may make the
> write heavier, and adopting a writing rule on an agent's say-so is exactly that. It needs the
> owner.
