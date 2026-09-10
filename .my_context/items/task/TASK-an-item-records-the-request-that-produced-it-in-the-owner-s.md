---
id: TASK-an-item-records-the-request-that-produced-it-in-the-owner-s
type: task
title: an item records the request that produced it, in the owner’s own words
status: active
severity: soft
always: false
summary: Every item keeps the exact words that asked for it, so its summary can be compared against what was actually requested.
summary_of: c2d48c73af6d770d
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
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-10
valid_until: null
checksum: 6baedd2dbdcd837c
plan: store
seq: "5"
state: todo
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
