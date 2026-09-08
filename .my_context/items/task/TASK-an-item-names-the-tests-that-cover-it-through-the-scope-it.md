---
id: TASK-an-item-names-the-tests-that-cover-it-through-the-scope-it
type: task
title: an item names the tests that cover it, through the scope it already carries
status: active
severity: soft
always: false
summary: A rule points at the tests that check it, so anyone changing the rule can see what depends on it.
summary_of: 0cb72e2f1824c07f
scope:
  - test/**
  - e2e/**
  - scripts/**
  - src/core/**
tags:
  - v2
  - testing
  - governance
  - "plan:basis"
  - "seq:1"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: 7841cdc2ab8869ef
plan: basis
seq: "1"
state: done
priority: "2"
verified_on: 2026-09-08
---

# an item names the tests that cover it, through the scope it already carries

Owner ruling 2026-09-07: enforce the link in BOTH directions, and do the item side FIRST because it
is nearly free.

NO NEW MACHINERY IS NEEDED. Items already carry `scope:` globs, and checkDeadScopes already walks
them and proves each matches real files. So a rule naming test/core/select.test.ts in its scope is
already validated today, and a test file renamed or deleted underneath it already becomes a doctor
finding. The work is to establish the CONVENTION and prove it holds, not to build a mechanism.

WHY THIS DIRECTION MATTERS MORE THAN IT LOOKS: it is where a person editing a rule is ALREADY
LOOKING. Somebody about to reverse a ruling opens the item; if the item names its tests, the cost of
the reversal is visible at the moment of deciding rather than at the moment the suite goes red.

WHAT TO SETTLE AND SAY OUT LOUD: whether scope is the right field or whether covering tests deserve
their own. Scope today means "what this item governs", and a test that CHECKS a rule is not obviously
a thing the rule GOVERNS. Re-using scope is cheap and may be a category error; a new field alters
every recorded checksum shape, which is the continuity/summary conditional-key problem. Measure both
and recommend - do not assume the cheap answer is right because it is cheap.

START WITH THE 26. budget/16 named 26 fixtures across 10 files and the rule they all rested on. That
is a ready-made, verified test set for this convention: if the mechanism cannot express those 26,
it does not work.

ANSWERED 2026-09-08, and its own premise was REJECTED on measurement rather than implemented.

THE ITEM ASKED for items to name their covering tests through the `scope` globs they already carry.
Measured with the product’s own matchesScope: `scope` is NOT inert. Empty scope matches every path;
non-empty matches ONLY those globs. 814 of 1,011 items have an empty scope - so for 80.5% of the
corpus, adding one covering-test path would SILENTLY UN-INJECT THE ITEM EVERYWHERE ELSE. Not a
category error in theory; a behaviour change in production.

AND MY OTHER LEAD WAS WRONG TOO: a new field does NOT alter every recorded checksum.
computeItemChecksum adds fields conditionally and has done so four times; CHECKSUM_BASIS_VERSION has
never been bumped because of it.

WHAT REPLACED IT: derive the item side FROM the test side - `check:basis --items` inverts the @basis
declarations into "which tests name this item". No corpus write, no injection change, no conflation.
If a stored item-side field is ever wanted it must be a NEW conditional field, never `scope`.
