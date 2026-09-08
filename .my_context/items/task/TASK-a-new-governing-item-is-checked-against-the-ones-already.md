---
id: TASK-a-new-governing-item-is-checked-against-the-ones-already
type: task
title: a new governing item is checked against the ones already governing, and a contradiction stops the write
status: active
severity: soft
always: false
summary: Writing a rule that conflicts with one already in force is stopped and settled, instead of both quietly standing.
summary_of: d1c4ec65f59b16b3
scope:
  - src/core/**
  - src/cli/**
  - src/mcp/**
  - test/**
tags:
  - v2
  - governance
  - corpus
  - "plan:contra"
  - "seq:1"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: 0fc6f72cd4a9218d
plan: contra
seq: "1"
state: done
priority: "1"
verified_on: 2026-09-08
---

# a new governing item is checked against the ones already governing, and a contradiction stops the write

Design of record: docs/superpowers/specs/2026-09-07-contradiction-gate-design.md sections 2 to 7. Read it before starting; this item is the summary,
not the specification.

THE GATE GOES IN createItem AND updateItem in src/core/mutate.ts, which are the only write paths
for item content - the CLI, the MCP tools, inbox-promote, lesson, lesson-accept, ingest-apply and
pack import all route through them. It runs BEFORE any bytes are written, beside the existing
refusals, so the promise every refusal here already makes - "nothing was written" - is unchanged. A
CALL-GRAPH TEST enforces the chokepoint, the way test/ui/staging-endpoint.test.ts already walks the
runtime import graph.

IT FIRES ON NORMATIVE CATEGORIES PLUS always:true - rule, constraint, requirement, decision,
instruction, standard, and any pinned item whatever its category. Owner ruling 2026-09-07. That is
about 104 of 996 items today, one write in ten, and the ratio IS the design constraint: a gate that
fires on every write is one people learn to click through.

RETRIEVAL IS ALREADY BUILT. overlapScore in src/ui/read-model-work.ts scores a draft against an item
by jaccard and containment over tokens, threshold 0.2, cap 5. MOVE IT to src/core/overlap.ts - a
mutation path must not import from src/ui/ - and keep the existing caller working through the new
module. Candidates are the ACTIVE items in scope; active means status not in RETIRED_STATUSES,
IMPORTED from src/core/select.ts and never restated, because that is the same constant injection
filters on and duplicating it is exactly how two halves of a rule drift apart.

THE PRODUCT DOES NOT JUDGE. It has no model and says so already in the summary gate. It retrieves,
then REFUSES, naming each candidate with its summary and offering exactly two dispositions:
--distinct <id> (both can be true) and --supersedes <id> (this replaces it, and it is retired,
routed through supersedeItem which already validates both ids, refuses a second successor, writes
both edges and requires a confirm). Abandoning the write is the third outcome and needs no
mechanism. EVERY candidate must be dispositioned; a write settling one of two is refused again.

AND THE MEMORY IS NOT OPTIONAL - WITHOUT IT THIS IS NET HARMFUL. overlapScore is LEXICAL, so two
items that AGREE score as high as two that conflict, and a gate with no memory raises the same
agreeing pair forever. So every disposition is recorded against the PAIR, keyed to BOTH items
summary_of checksums - the field the product already maintains and already uses to detect that an
edit changed what an item says. The gate skips a candidate when a verdict exists AND both bases
still match. When either item changes meaning the verdict lapses and the pair is raised again,
which is correct rather than noise. Append-only at .my_context/.verdicts/contradiction.jsonl, the
audit log shape, for the reason measured there: append-only survives concurrent writers where a
read-modify-write destroyed 1-21 rows per run.

THE PART I AM LEAST SURE OF, flagged so it is reported rather than bypassed: lesson-accept,
ingest-apply and pack import write through these chokepoints with no human at the keyboard. Each
must carry dispositions decided earlier or fail cleanly naming what to settle. DO NOT INVENT A
BYPASS - a bypass defeats the whole chokepoint argument.

TESTS: the gate is a PURE FUNCTION of (draft, active items, verdicts), testable with no filesystem.
Plus the call-graph test, an ANTI-VACUITY test proving it actually fires (this project has been
bitten by checks that silently stopped checking), a LAPSE test (verdict, then a meaning change,
then raised again) and a NO-LAPSE test (verdict, then --summary-unchanged, then still settled).

DONE 2026-09-08. The gate, the dispositions and the pair memory all landed and were verified here:
tsc clean, 27 tests, and it refused one of my own edits within two hours of being built.

THE THRESHOLD IS THE FINDING. At the 0.2 I specified it would have refused 207 of 207 in-scope
writes - 100%, every one carrying the full cap of five candidates - because 59.3% of all 21,321
in-scope pairs score above it. overlapTokens has no stopword list and no IDF, so two ordinary English
bodies share 20-30% of their vocabulary before either says anything about the other’s subject.
Harmless behind a UI hint, fatal in a refusal. CONTRADICTION_THRESHOLD is a SEPARATE constant at 0.45
(9.2%, mean 1.05 candidates), owner-confirmed, with the calibration table in its comment.

AND MY RETIRED_STATUSES LEAD WAS WRONG IN BOTH DIRECTIONS: `draft` is not in it, so an agent’s
unreviewed draft would have refused a human write; `validated` IS in it and governs. It uses
GOVERNING_STATUS from trust.ts and pins the disagreement with a test.
