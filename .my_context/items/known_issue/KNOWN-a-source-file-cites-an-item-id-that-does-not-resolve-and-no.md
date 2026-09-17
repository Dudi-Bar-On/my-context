---
id: KNOWN-a-source-file-cites-an-item-id-that-does-not-resolve-and-no
type: known_issue
title: a source file cites an item id that does not resolve, and no gate looks at ids outside src
status: active
severity: soft
always: false
summary: The invented item id a document carried came from the code, and the gate that would catch it does not read documents.
summary_of: 804cd09cf40f0ef1
scope:
  - src/ingest/schema.ts
  - scripts/check-cited-items.ts
  - docs/**
tags:
  - v2
  - silent-failure
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: a1c1cc600851875c
---

# a source file cites an item id that does not resolve, and no gate looks at ids outside src

TWO FINDINGS THAT ARE ONE DEFECT, from the `docs/system/` verification on 2026-09-17.

── 1. THE SOURCE OF AN INVENTED ID ─────────────────────────

`docs/system/06-ingest.md` cited `INV-a-validator-that-gates-writes-must-be-a-complete-precondition-
for-the-write`. The real id is `INV-a-validator-that-gates-writes-must-be-a-complete` — four words
shorter. The chapter was repaired on 2026-09-17.

**THE CHAPTER WAS NOT WHERE IT CAME FROM. `src/ingest/schema.ts:340` CARRIES THE SAME UNRESOLVABLE
ID**, and the document was copying the source faithfully. Repairing the chapter and leaving the
source means the next person to document that validator reintroduces it.

In a project whose law is `RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number`, an id
with an invented suffix is not untidy — **it is uncitable, and it looks complete**, which is what
makes it worse than a visibly truncated one. A reader who pastes it into `mycontext show` gets
nothing and has no way to tell whether the item was renamed, superseded or never existed.

── 2. NOTHING WOULD HAVE CAUGHT EITHER ──────────────────────

`scripts/check-cited-items.ts` exists precisely to refuse a citation naming an item that is not
there, and it runs as `check:cited-items`. **ITS `SOURCE_ROOTS` DOES NOT INCLUDE `docs/`.** So every
id in seventeen capability chapters, eight system chapters and both READMEs is unchecked — which is
most of the ids this project writes, because documents cite items far more than code does.

THAT IS WHY THIS IS ONE ITEM AND NOT TWO: a bad id in the source produced a bad id in a document,
and the gate that would have caught the second does not look there. **FIX THE SOURCE, THEN WIDEN
THE GATE** — in that order, so the widened gate runs green rather than reporting a backlog it did
not cause.

EXPECT A BACKLOG ANYWAY. Widening `SOURCE_ROOTS` to `docs/` will surface citations nobody has
checked. **Report what it finds before repairing any of it**; a gate turned on and immediately
silenced by a hasty sweep is worth less than one turned on with its findings written down.

AND MIND THE TWO DELIBERATE CASES: `docs/system/` carries two ids TRUNCATED WITH `…` inside diagram
labels, left that way for a stated reason — a visible ellipsis claims nothing, while an invented
suffix looks complete. Whatever you build must not force those to be wrong.
