---
id: TASK-the-execution-residual-reaches-a-hebrew-reader-in-hebrew
type: task
title: the execution residual reaches a Hebrew reader in Hebrew
status: active
severity: soft
always: false
summary: The warning shown before running a command stays in English for Hebrew readers, and it is the one sentence they most need to read.
summary_of: d6bc9f65a6b4ccae
scope: []
tags:
  - v2
  - ui
  - execute
  - i18n
  - security
  - "plan:execute"
  - "seq:8b"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: dc6a60ae756e5c76
plan: execute
seq: 8b
state: done
priority: "2"
source: "found building seq:6, 2026-08-27"
---

# the execution residual reaches a Hebrew reader in Hebrew

Found building plan:execute seq:6, and it is a security sentence rather than a label.

Section 6.3 requires the residual to be written where a reader MEETS it: *"This runs on your machine, now. The UI can tell it came from your browser -- not that you asked. Only run what you recognise here."* It is spelled ONCE, in `src/ui/execute.ts` as `EXECUTION_RESIDUAL`, and the confirm renders the server's bytes verbatim.

That single spelling is right and it has a cost: **the sentence stays ENGLISH in the Hebrew UI.** Duplicating it into the string tables would be the obvious fix and the wrong one -- a security sentence with two spellings is a security sentence that gets reworded on one side only, which is exactly what section 6.3 exists to prevent.

SO THE LANGUAGE HAS TO REACH THE SERVER, not the sentence reach the browser. The confirm GET learns which language to answer in, and `EXECUTION_RESIDUAL` becomes one sentence per language in one place. `strings-parity` does not cover it, so whatever holds the two spellings equal has to be written as part of this.

WHY IT MATTERS MORE THAN AN ORDINARY UNTRANSLATED STRING: a reader who cannot read the warning gets the button anyway. Every other English-in-Hebrew leak in this product costs comprehension; this one costs the one sentence standing between a click and a corpus mutation.

PRECEDENT FOR THE ASYMMETRY, so it is not read as new: `work.js` records the same shape for its `stale` chip. That one is a label. This one is not.
