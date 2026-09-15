---
id: TASK-audit-the-six-review-reports-against-the-corpus-and-find
type: task
title: audit the six review reports against the corpus and find what was never filed or was filed narrower than the finding
status: active
severity: soft
always: false
summary: Go back over the six reviews and find what they said we should do that never reached the board — or reached it smaller than it was written.
summary_of: f7b3a9796a1d9fcb
scope:
  - reports/**
  - .my_context/items/**
tags:
  - v2
  - governance
  - "plan:rulings"
  - "seq:90"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 5715c6a809fb7acd
plan: rulings
seq: "90"
state: done
priority: "1"
---

# audit the six review reports against the corpus and find what was never filed or was filed narrower than the finding

OWNER REQUEST 2026-09-15: "we need to go back to our revised 6 reviews reports and look what we need
to do and currentlly didn’t according to the reports".

THE SIX REVIEWS, and they are the source of record:
  reports/2026-09-12-silent-failures-reviewed.md
  reports/2026-09-12-the-ui-reviewed-as-a-user.md
  reports/2026-09-13-the-ui-reviewed-round-two.md
  reports/2026-09-13-type-design-reviewed.md
  reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md
  reports/2026-09-13-what-could-be-removed-or-done-differently.md
and `reports/2026-09-13-the-consolidated-findings.md`, which deduplicated them into 119 numbered
rows and became D66-D76.

THE QUESTION IS NOT "what is open" — `mycontext ready` answers that and cannot go stale. THE
QUESTION IS WHAT THE REPORTS SAID AND THE CORPUS NEVER RECEIVED. Three distinct ways a finding can
be missing, and they need different answers:
  1. FILED AND OPEN — fine. It is on the board and `ready` will surface it. Count it, do not list it.
  2. FILED AND CLOSED — verify the closure actually covers what the row said. A row that became a
     narrower item than the finding is a finding half-dropped, and the item reads as done.
  3. NEVER FILED — the real subject of this task. The consolidation itself records that SIX rows
     were deliberately not filed because they had already landed; those six are accounted for and
     are not what this is looking for.

AND A FOURTH, WHICH IS THE ONE WORTH THE MOST: A FINDING THE CONSOLIDATION DROPPED. 119 rows came
out of six reviews by deduplication. Deduplication loses things — two reviews describing one defect
from different ends can merge into a row that carries only one end. Read the SIX, not only the
consolidation, and say what the consolidation itself did not carry forward.

HOW TO ANSWER IT HONESTLY:
  — Every claim cites the report and the row, and the item id where one exists. A finding asserted
    with neither is not evidence.
  — `git log` and the corpus decide whether something landed, NOT the report and NOT a lane’s
    summary. This campaign has already had three reports whose own numbers were wrong.
  — Where a row is closed, quote the row and name the item, so the owner can judge the match
    himself rather than take the audit’s word.

KNOWN TRAPS IN THIS SPECIFIC MATERIAL, so they are not re-derived:
  — `reports/2026-09-13-the-consolidated-findings.md` has been WRONG ABOUT ITS OWN EVIDENCE at
    least once: its §3 claims seven test files draw a boundary inside `checks.ts` and FIVE OF THE
    SEVEN do not — measured by the lane that closed `accretion/2`. Treat the consolidation as a
    claim, not a record.
  — Report line numbers are not citable. `RULE-a-citation-names-an-item-by-id-never-a-report-by-
    line-number` — cite a row by its number and its text.
  — Three D numbers own plans that are now largely done (D70, D71, D73, D74 are complete). A row
    mapping to a complete plan is probably fine; a row mapping to NO plan is the interesting case.

THE DELIVERABLE: a report naming, for each of the four categories, how many and — for categories 2,
3 and 4 — exactly which, with the evidence. Plus filed items for anything in category 3 or 4 that
is still worth doing, and an explicit list of what is NOT worth filing and why. A finding the owner
ruled out, or that time has overtaken, is closed by saying so, not by silence.
