---
id: NOTE-reconciliation-batch-3-plan-ui3-nine-open-tasks-verdicted
type: note
title: "reconciliation batch 3: plan:ui3, nine open tasks verdicted"
status: active
severity: soft
always: false
summary: A third batch of open work read, including one fix that will make a second, unfixed problem look closed unless the two are done together.
summary_of: ef88ecd336d496e1
acknowledged:
  - body_disagrees_with_meta@4cb14d1b966690b0
scope: []
tags:
  - v2
  - ui
  - reconciliation
  - "plan:walk"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 396a7344c33625ae
---

# reconciliation batch 3: plan:ui3, nine open tasks verdicted

plan:walk seq:23, 2026-08-25.

  11x bold run       SUPERSEDED  by walk/1h -- both remaining halves are there
  11x projection     SUPERSEDED  by walk/28 -- it delivered a measurement and a ruling
  7d                 DONE        the warning was heeded; verified in code, not assumed
  8d                 DONE        same
  11x AUDIT_KINDS    STANDS      walk/28 will make it LOOK fixed -- see below
  11x provenance bar STANDS      and one half of it HARDENED into a certainty
  11x token bar      STANDS      owner ruling, and one option is a log-format change
  11x four strings   STANDS      mockup session; item 3 is not a string problem
  15  typed SQL      STANDS      one feature spread across three plans

Of the nine: FOUR CLOSED, FIVE STAND. TWO FINDINGS ARE WORTH MORE THAN THE VERDICTS.

ONE. A FIX THAT WILL LOOK LIKE ANOTHER FIX. plan:walk seq:28 keeps the audit projection current, so `/api/watch/volume` stops 503ing, so the watch filter row stops collapsing to All. The AUDIT_KINDS task will appear closed. It is not: the browser still derives its vocabulary from the KEY ORDER OF ONE BUCKET of a response that exists for another purpose, and it still fails silently -- fewer buttons, no refusal -- on an absent, diverged or damaged projection. Dispatch the two together or the second one will be closed by mistake.

TWO. THE PROJECTION RULING KILLED A STRING. `prov.projCaughtUp` -- "caught up before answering" -- was recorded as EITHER dead vocabulary OR evidence the mockup predates owner ruling C1. The 2026-08-25 ruling that the WRITER keeps the projection current settles it: the sync moves further from the read path, so that state can never happen. Retire the key from the mockup and both tables. It is a refusal invisible to every gate, because strings-parity compares key SETS and a key nothing renders is still a key.

THREE. TWO CARRIER TASKS, seq:7d and seq:8d, CLOSED ON EVIDENCE. seq:7d and seq:8d existed to stop a later agent building a shape the plan documents still described. Both were heeded -- `stateBeforeSync` is in no file in `src/`, and `ask-model.ts` imports `readProjection` rather than copying it. This is the reconciliation working as intended: a carrier closes when what it carried arrived, and leaving it open costs the next reader a whole investigation.
