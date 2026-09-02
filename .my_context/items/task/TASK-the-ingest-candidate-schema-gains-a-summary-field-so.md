---
id: TASK-the-ingest-candidate-schema-gains-a-summary-field-so
type: task
title: the ingest candidate schema gains a summary field, so extracted items no longer land without one
status: active
severity: soft
always: false
summary: Document ingestion creates items with no summary; the candidate schema needs a summary field so one is written while the source is still in view.
summary_of: 26f59ceef5d42ebc
scope: []
tags:
  - ingest
  - summary
  - capture
  - "plan:categories"
  - "seq:24"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-test-mycontext-plugin/9e5b6b17-c186-4c93-a0a5-775b4eccd9e7/scratchpad/ingest-summary-task-body.txt"
source_anchor: null
source_checksum: f731c696f93fdc2a
valid_from: 2026-09-02
valid_until: null
checksum: 66c6d634067b0161
plan: categories
seq: "24"
state: todo
---

# the ingest candidate schema gains a summary field, so extracted items no longer land without one

> The owner ruled on 2026-09-02, recorded as DEC-the-document-extraction-schema-gains-a-summary-field-so, that the ingest candidate schema gains a summary field. Nothing in the codebase implements that ruling today, and this task is the implementation.
>
> Add a summary field to the Candidate type in my-context/src/ingest/schema.ts, alongside title, body, type, severity, scope, tags, extra and observations, and validate it there the way the other required candidate fields are already validated. Wire it through my-context/src/ingest/apply.ts: the CreateInput object it builds for every candidate sets type, title, body, status, origin, severity, always, scope, tags, sourceFile, sourceAnchor, sourceChecksum, extra and observations, but never summary, so every candidate reaching createItem today has none, and createItem stores it with summary: null.
>
> That gap is not an oversight a gate missed. apply.ts calls core/mutate.ts's createItem directly, bypassing the summaryRequiredAtCreate / summaryAtCreateRefusal check in core/summary-gate.ts that mycontext add and create_item both enforce. The bypass was deliberate: nobody is authoring prose during a batch ingest, so refusing every candidate that lacks a summary would simply stop ingestion from working. The practical effect is that every item ingest creates lands with no summary, invisible until doctor's summary_absent finding names each one by hand - the documented walkthrough honestly reports it landing at 0 errors and 5 warnings for exactly this reason.
>
> The real difficulty this task has to settle is where the sentence comes from, given that this product has zero runtime dependencies and no model anywhere in it - nothing here can write a sentence on its own. Weigh at least these options before implementing:
>
> The ingesting agent supplies one summary per candidate, written at extraction time while it still has the source document in view. This is the option the owner's ruling text argues for directly: filling summaries in afterwards means writing them from the item alone, which is the worst moment to write one, because the extractor knew what the document was FOR and a later reader does not.
>
> The schema requires a summary and refuses to accept a candidate without one, the same way summaryRequiredAtCreate already refuses a bare mycontext add or create_item call - pushing the requirement into validateCandidates so a candidate missing a summary is rejected before it ever reaches apply.ts, rather than silently stored short of the standard.
>
> Ingest marks its own items summary_omitted explicitly instead of supplying real prose. The owner already considered and declined this option when making the ruling above - record it as considered and declined here too, rather than re-proposing it as though it were still open.
>
> Whichever shape is chosen has to keep validateCandidates and createItem in agreement: if validateCandidates accepts a candidate that createItem then refuses over its summary, a batch ingest half-applies, which is exactly the failure mode the validator-completeness invariant governing this area exists to rule out.
