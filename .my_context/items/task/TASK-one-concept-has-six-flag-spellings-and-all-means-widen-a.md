---
id: TASK-one-concept-has-six-flag-spellings-and-all-means-widen-a
type: task
title: one concept has six flag spellings, and --all means widen a read in two commands and widen a write in two others
status: active
severity: soft
always: false
summary: One idea had six different flag spellings; the one where being wrong costs a write is settled and enforced, and the two harmless renames are still to do.
summary_of: 81bed2c72bd6ea0e
summary_was:
  - 2026-09-16 The same idea is spelled six different ways across commands, and one option means two different things, one of which changes data.
scope:
  - src/cli/**
tags:
  - v2
  - cli
  - vocabulary
  - "plan:cliscript"
  - "seq:6"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 2cd7bec45598a678
plan: cliscript
seq: "6"
state: todo
priority: "3"
---

# one concept has six flag spellings, and --all means widen a read in two commands and widen a write in two others

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, C8) as row 114 of `reports/2026-09-13-the-consolidated-findings.md`. ONE CONCEPT, SEVERAL SPELLINGS, measured:

- "REMOVE THIS" HAS SIX: `--clear`, `--off`, `--none`, `--drop`, `--discard`, `--unset`.
- "CATEGORY" HAS FOUR.
- `--all` MEANS TWO DIFFERENT THINGS: "widen the listing" in two commands, "switch to bulk mode" in two others.
- `ingest.ts` · the sentence that uses both "candidate" and "draft" (line 387) uses "candidate" and "draft" in ONE SENTENCE for ONE concept.

WHY IT IS UNDER THIS SUBJECT. A person learns a spelling once and guesses the rest; a script and an agent cannot guess at all. `--all` meaning two opposite-risk things in one binary is the sharpest of the four: one widens a read and the other widens a WRITE.

THE WORK IS A VOCABULARY PLUS A GATE, not a rename pass -- the flag tables are already machine-readable and already pinned against the registry in both directions.

── STILL OPEN 2026-09-16, AND THIS IS WHAT REMAINS ─────────────────────

NAMED-BUT-OPEN fc0b57da — the dangerous spelling is ruled and gated; the two renames are not implemented and reach a palette and help pages a live lane holds

THE COMMIT THAT DID THE WORK SAID "see the follow-up notes in each item" AND WROTE NONE. This is that note, written from the commit.

WHAT LANDED: the ruling that `--all` means WIDEN THE READ and never widens a write on its own — a bulk write is `--all` PLUS a flag naming what it is bulk over, and the command refuses without it. That RATIFIES what both writing commands already do and changes no behaviour; it ships as a gate because it is the one of the three where being wrong costs a write.

WHAT REMAINS: the other two are NOT implemented — `--clear` as the one spelling of "remove this" and `--type` as the one spelling of "category". Retiring a spelling means it must KEEP WORKING and say what replaced it, and those five retirements reach the Composer palette and the help pages a live lane holds. Nothing was silently broken; every spelling works exactly as before.

The `NAMED-BUT-OPEN` line above is read by `npm run check:board`.
