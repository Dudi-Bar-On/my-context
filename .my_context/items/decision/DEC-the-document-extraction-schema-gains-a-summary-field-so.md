---
id: DEC-the-document-extraction-schema-gains-a-summary-field-so
type: decision
title: the document extraction schema gains a summary field, so ingested items arrive with one
status: active
severity: soft
always: false
summary: Items created by extracting a document now carry the same one-line plain explanation that every other way of creating an item already requires.
summary_of: 06c2506dc4b7c21f
scope: []
tags:
  - ingest
  - summary
  - capture
  - owner-ruling
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-test-mycontext-plugin/9e5b6b17-c186-4c93-a0a5-775b4eccd9e7/scratchpad/r6a.md"
source_anchor: null
source_checksum: 4f0c8716abcaf57a
valid_from: 2026-09-02
valid_until: null
checksum: da3408e286a900b3
---

# the document extraction schema gains a summary field, so ingested items arrive with one

> OWNER RULING, 2026-09-02. The ingest candidate schema gains a `summary` field.
>
> Every other route that creates an item now carries a summary with it: `mycontext add` requires `--summary`, or an explicit `--summary-omitted`, and `create_item` asks for one. Ingest does not. So a document extracted into candidates produces drafts that arrive with no summary at all, and the gap is invisible - nothing refuses, nothing warns, the items simply land short of the standard every hand-created item is held to.
>
> The fix belongs in the schema, not after it. A candidate declares its own summary, written by the same extractor that wrote its title and its body, at the moment that extractor still has the source document in view. Filling summaries in afterwards means writing them from the item alone, which is the worst moment to write one: the extractor knew what the document was FOR, and a later reader does not.
>
> The summary written here is held to the same bar as everywhere else - one plain sentence for a reader who does not know this codebase, saying what the thing IS and why it matters, with no identifiers, no paths and no measurements in it.

## Observations
- [note] The summary is written by the extractor while the source document is still in view, not filled in afterwards from the item alone.
- [note] It is held to the same bar as every other summary: one plain sentence, no identifiers, no paths, no measurements.

## Relations
- refines [[STD-a-summary-is-one-plain-sentence-for-someone-who-does-not]]
