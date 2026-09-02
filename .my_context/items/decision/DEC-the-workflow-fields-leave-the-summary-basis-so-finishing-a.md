---
id: DEC-the-workflow-fields-leave-the-summary-basis-so-finishing-a
type: decision
title: the workflow fields leave the summary basis, so finishing a task no longer trips the summary gate
status: active
severity: soft
always: false
summary: Recording that work is finished no longer counts as changing what an item says, so closing a task stops demanding a confirmation nobody was reading.
summary_of: 315d41f6154525ec
scope: []
tags:
  - summary
  - summary-gate
  - edit
  - workflow
  - owner-ruling
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-test-mycontext-plugin/9e5b6b17-c186-4c93-a0a5-775b4eccd9e7/scratchpad/r5.md"
source_anchor: null
source_checksum: 51517b2b1fcd3a81
valid_from: 2026-09-02
valid_until: null
checksum: 573ba5ea1b93bf5b
---

# the workflow fields leave the summary basis, so finishing a task no longer trips the summary gate

> OWNER RULING, 2026-09-02. The workflow fields `state`, `progress` and `last_change` come OUT of the summary basis.
>
> **THE REASONING.** The summary gate exists to catch a case worth catching: an item's text is rewritten, and the one-line summary written against the OLD text silently keeps describing something that is no longer there. Recording that work is FINISHED is not that case. It is not a claim about what the item SAYS at all - the body is untouched, the title is untouched, and nothing a reader relies on has moved.
>
> **WHAT IT WAS COSTING.** Every task closure refused until `--summary-unchanged` was passed. Three separate lanes hit it in one night and all three used the hatch. That is the failure: an escape hatch reached for on every single closure is not a deliberate act any more, it is a reflex - and a reflex waves through the one case the gate was built for exactly as fast as it waves through the ninety-nine it should never have stopped. The gate was being worn down by its own false positives.
>
> **SO THE FIX IS THE BASIS, NOT THE MESSAGE.** A clearer refusal, or an easier hatch, leaves the reflex in place. Taking the three workflow fields out of what the summary is computed against removes the false positive outright, and leaves the gate firing only where a body or a title actually moved - which is the only condition under which it can still be believed.
>
> **THE TASK THAT REPORTED THIS STAYS OPEN.** The ruling settles what should happen. Nothing has changed in the code yet.

## Observations
- [note] The three fields leaving the basis are the ones that record progress, not meaning.
- [note] Three lanes hit the refusal in one night and all three used the escape hatch, which is what turned a deliberate act into a reflex.
- [note] Fixing the message or easing the hatch would have left the reflex in place; only removing the false positive restores the gate.

## Relations
- derived_from [[TASK-closing-any-task-trips-the-summary-gate-even-though-only-the]]
- refines [[DEC-a-stale-summary-that-is-still-correct-is-cleared-by-passing]]
