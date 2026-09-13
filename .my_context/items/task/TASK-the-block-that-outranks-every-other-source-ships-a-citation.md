---
id: TASK-the-block-that-outranks-every-other-source-ships-a-citation
type: task
title: the block that outranks every other source ships a citation only this repository can resolve
status: active
severity: soft
always: false
summary: The paragraph that claims authority over every other source points at a document that does not exist in anybody else's copy.
summary_of: 852da47770cc4161
scope:
  - src/rules/entries/**
  - src/rules/**
tags:
  - v2
  - store
  - citation
  - consumer-install
  - "plan:rulings"
  - "seq:75"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 31ee36a32532ee27
plan: rulings
seq: "75"
state: todo
priority: "1"
---

# the block that outranks every other source ships a citation only this repository can resolve

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, S1) as row 13 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. Every consumer install is handed `STD-the-precedence-order-when-four-sources-of-truth-disagree` by id, inside the `PRECEDENCE` paragraph of the product rule store -- the block this product says outranks every other source. That item exists only in THIS repository. A stranger's install receives a citation it cannot resolve, in the one paragraph that claims authority over everything else they have.

WHY IT IS CRITICAL RATHER THAN A TYPO. It ships a wrong answer into somebody else's install, and it is the precise class store v5 was published to fix -- and v5 DID fix it, three lines below, on `movedFrom`. The mechanism and the argument for it are already in the file; one paragraph was missed.

THIS IS D6: a citation names an item by id, and an id that cannot be resolved where it is read is not a citation.
