---
id: RULE-a-supersession-is-unwound-by-superseding-the-successor-back
type: rule
title: a supersession is unwound by superseding the successor back, never by a status flag
status: active
severity: soft
always: false
summary: Retiring one item in favour of another is a dated record of something that happened, so it is undone by retiring the replacement in turn rather than by quietly switching the first one back on.
summary_of: 5074f0df58dbbdd6
scope:
  - src/core/relations.ts
  - src/cli/commands/edit.ts
  - src/mcp/tools.ts
  - src/core/mutate.ts
tags:
  - v2
  - corpus
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/ruling.md"
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: e89fcc9794f1b7ce
directive: dont
---

# a supersession is unwound by superseding the successor back, never by a status flag

> OWNER RULING 2026-09-13, on `TASK-supersede-has-no-inverse-and-edit-status-active-is-a-half`:
> **supersede has no inverse, and it is not getting one.**
>
> A SUPERSESSION IS FOUR FACTS ACROSS TWO FILES. Retiring A in favour of B writes
> `status: superseded` and `valid_until` on A, `superseded_by B` on A, and `supersedes A` on B.
>
> WHAT WAS MEASURED, on a throwaway corpus, before any of this was built:
>
>     mycontext edit DEC-the-old-way --status active --yes
>     my_context: updated DEC-the-old-way (active).        exit 0
>
> It changed TWO of the four — `status` back to `active`, and `valid_until` back to `null`,
> because `updateItem` calls `stampValidUntil` unconditionally and that helper moves the field
> in BOTH directions. The other two were left standing: a governing item still carrying
> `superseded_by`, and a replacement still claiming to have replaced something that governs
> again. `update_item({status: "active"})` did the same on the MCP surface. `mycontext doctor`
> reported ZERO errors and ZERO warnings on the result.
>
> THE RULING. A supersession is a DATED HISTORICAL CLAIM. Unwinding it means superseding the
> successor back, which leaves a true record of BOTH acts. An inverse that flips the four facts
> off would make the corpus lie about its own history — the exact defect its lifecycle exists to
> prevent. So the hatch is shut rather than completed, and no inverse command was built.
>
> WHAT A REFUSAL MUST SAY (`TASK-a-refusal-must-state-its-unblocking-condition-where-a-gate`): the successor by
> name, and `mycontext supersede <successor> --by <what stands now>` as the way forward. "What
> stands now" is usually a NEW item saying what the retired one said. Naming the retired item
> itself is accepted and leaves BOTH retired, with nothing governing in their place — measured,
> and the preview says so at the time.
>
> THE ONE CASE THAT STILL PASSES. An item marked `superseded` with NO `superseded_by` edge is
> not a supersession; it is the successor-less retirement this system does not offer. There is
> nothing to protect, so a status change on it is accepted and `--status deprecated` is the
> honest name for what it already is. Refusing there would make it the only state in the corpus
> with no route out.
>
> A MIRROR HATCH WAS FOUND WHILE MEASURING, AND SHUT IN THE SAME ACT.
> `update_item({id, status: "superseded"})` was ACCEPTED: it returned "updated (superseded)",
> stamped `valid_until`, and wrote NO relation at all — forging exactly the successor-less
> retirement `mycontext edit --status superseded` has refused by name since it shipped. The CLI
> door was shut and the MODEL's door was open. One wording now serves both
> (`forgedSupersessionRefusal`, relations.ts).
>
> WHERE IT LIVES, AND WHY NOT IN `updateItem`. The guards sit on the two AUTHORED surfaces —
> `src/cli/commands/edit.ts` and `update_item` in `src/mcp/tools.ts` — sharing one wording in
> `src/core/relations.ts`, beside the three supersession refusals already there. `updateItem` is
> the road every mechanical write drives down (a promoted revision, a pack import, `review
> promote`, `refresh_item`), and this project already recorded that reasoning for the summary
> gate in `src/mcp/tools.ts`. A guard there would refuse them all.
>
> ONE FALSE SENTENCE WAS RETIRED BY THIS RULING. `retirementEdgeRefusal` — the message
> `edit --unlink superseded_by` prints — INSTRUCTED the reader to take the hatch: *"If the
> retirement itself was wrong, change the retired item's status with `mycontext edit <id>
> --status active`."* README.md said the same thing, and `test/cli/edit-unlink.test.ts` asserted
> it by regex. All three now name superseding the successor back.
>
> STILL OPEN, DELIBERATELY NOT FIXED HERE. A mutual supersession — A superseded by B and B
> superseded by A, reachable in two supported commands — passes `mycontext doctor` with zero
> findings, and leaves a family of items with nothing governing. `doctor` has no check for a
> supersession cycle, nor for "every item in a chain is retired".
