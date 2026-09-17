---
id: KNOWN-the-hebrew-convention-says-an-identifier-with-alphanumeric
type: known_issue
title: the hebrew convention says an identifier with alphanumeric edges needs no wrapper, and a filename with a leading digit renders backwards
status: active
severity: soft
always: false
summary: A stated RTL rule has a hole, and the Hebrew README carries about forty-eight runs that render right-to-left.
summary_of: f825963e071fdffe
scope:
  - docs/README.he.md
  - docs/the-store.he.md
  - docs/system/**
  - docs/capabilities/**
tags:
  - v2
  - silent-failure
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: f04396d1aedc00de
---

# the hebrew convention says an identifier with alphanumeric edges needs no wrapper, and a filename with a leading digit renders backwards

FOUND ON 2026-09-17 BY DRIVING EIGHT HEBREW DOCUMENTS THROUGH CHROMIUM AND MEASURING VISUAL ORDER
PER ELEMENT — 1,764 inline runs — rather than reading the source. **Eleven defects were found in
files whose source looked clean**, and four of them are one rule with a hole in it.

── THE HOLE ────────────────────────────────────────

`docs/README.he.md` states the convention: an identifier whose EDGES are alphanumeric needs no
directional wrapper. `` `01-the-board.md` `` has alphanumeric edges — `0` and `d` — so by the rule
it is safe.

**IT RENDERS AS `the-board.md-01`.**

The hyphen after a LEADING DIGIT RUN takes the paragraph direction rather than the run’s, so the
numeric prefix is carried to the far end. The rule never met this before because no Hebrew
document in this project had carried a `NN-name.md` filename in prose — and the two new Hebrew
editions are full of them, since that is how every chapter is named.

The other seven were `foo()` and `'owner'` — **cases the stated rule already covers**, missed by a
careful writer and caught only by the render. That is the more useful half of the finding: **the
rule is not self-enforcing, and reading the source cannot check it.**

── AND THE RULE’S OWN DOCUMENT BREAKS IT ─────────────────────

`docs/README.he.md` has **~48 runs that render right-to-left** — every glossary id prefix
(`CONST-`, `INV-`, `TASK-`…), `/clear`, `[note]`. `docs/the-store.he.md` has exactly one. Neither
was touched, because both were outside the lane’s scope and neither is a claim being made wrongly
— it is text a reader cannot use.

A glossary of ids where the ids render backwards is worth stating plainly: **it is a glossary
nobody can copy from.**

── WHAT WOULD FIX IT ──────────────────────────────────

  1. **AMEND THE RULE** so a leading digit run is named as a case needing a wrapper. It is one
     sentence and it is wrong today for every chapter filename.
  2. **REPAIR THE 48 RUNS** in the Hebrew README.
  3. **GATE IT, BECAUSE A PROSE RULE CANNOT ENFORCE ITSELF.** The lane that found this built the
     measurement: render through `githubNodes` in Chromium and assert visual order per inline run.
     It found eleven defects in files a careful writer had just produced. Consider whether that
     belongs beside `check:diagrams` — it needs the same browser and would run on the same sweep.
     RECOMMEND AND COST IT; the owner has been clear that a new gate is his call, not a lane’s.
