---
id: TASK-an-item-records-the-request-that-produced-it-in-the-owner-s
type: task
title: an item records the request that produced it, in the owner’s own words
status: active
severity: soft
always: false
summary: Every item keeps the exact words that asked for it, so its summary can be compared against what was actually requested.
summary_of: a494e272734b17d9
scope:
  - src/core/content-hash.ts
  - src/core/**
  - scripts/**
  - test/**
tags:
  - v2
  - store
  - "plan:store"
  - "seq:5"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-10
valid_until: null
checksum: 73338499e3a7e583
plan: store
seq: "5"
state: done
priority: "1"
needs: store/1
---

# an item records the request that produced it, in the owner’s own words

D41 PHASE 5. Plan: docs/superpowers/plans/2026-09-10-d41-product-rule-store.md Tasks 17-18. Design: docs/superpowers/specs/2026-09-10-product-rule-store-design.md section 16a.

Verbatim including the mess, never edited, never injected, never in the summary basis, optional
where no person asked. The value is that it is HIS words; tidying it destroys the point.

AND NOTHING CHECKS TODAY WHETHER A SUMMARY ANSWERS THE REQUEST THAT PRODUCED IT. The summary
standard governs the SHAPE of the sentence and never its fidelity. With the request recorded, that
becomes a real check.

THE BACKFILL IS EXTRACTION, NEVER RECONSTRUCTION. D37 indexes the sessions and lanes, so the
literal prompt can be FOUND; inventing a plausible one would be a paraphrase wearing quotation
marks. Skip when it cannot be found - an empty field is honest and a wrong one is not.

THE TRAP THAT WOULD POISON IT SILENTLY, measured by plan:loop seq:2: a lane’s DISPATCH BRIEF is
stored as a `type:'user'` record. A naive sweep finds 1,453,700 characters of person-side text
across 280 lanes - 33x the 44,006 he actually typed, and none of it his. It would fill his field
with the coordinator’s briefs and read like a real request afterwards. loop/2 built the filter;
the backfill must use it.

The report says WHAT MADE ONE RELIABLE, not only how many. A coverage number nobody can
interrogate is one nobody can trust.

BUILT 2026-09-11, AND THE REAL BACKFILL HAS NOT BEEN RUN. Task 17 landed: `request` is a `## Request` section, outside `ContentShape` and outside `computeItemChecksum`, so it is structurally absent from the summary basis, from every injected surface and from the recorded checksum - and clearing it restores a file byte for byte. Task 18 is built and proved AGAINST A COPY of the corpus only: 36 of 1,085 items filled, 1,049 skipped with a named reason for each, and the copy restored byte-identically by --clear. NOT ONE REAL ITEM WAS WRITTEN. The owner did not authorise an unattended write to 1,076 live items overnight, so the apply run waits for him: `node scripts/backfill-requests.ts .my_context --apply`. Read the 36 matches and their evidence first - two of them quote text the MODEL wrote and the owner pasted back, which is the one class a reader should rule on before the sweep runs for real.
