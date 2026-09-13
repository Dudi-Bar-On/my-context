---
id: TASK-two-nonces-are-both-plain-strings-so-either-store-redeems
type: task
title: two nonces are both plain strings, so either store redeems the other's token
status: active
severity: soft
always: false
summary: Two different one-time credentials are the same kind of value, so the check for one of them accepts the other.
summary_of: 8c9899c8b815b7b3
scope:
  - src/core/**
  - src/ui/**
tags:
  - v2
  - types
  - invariant
  - security
  - "plan:invariant"
  - "seq:4"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: e7def5a37bc99703
plan: invariant
seq: "4"
state: todo
priority: "2"
---

# two nonces are both plain strings, so either store redeems the other's token

Raised by report 4 (`reports/2026-09-13-type-design-reviewed.md`, section 4.3) as row 74 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. Two nonces -- the handoff nonce and the execution nonce -- are both plain `string`. `redeem()` on either store therefore ACCEPTS THE OTHER'S TOKEN. The surface's own comment says "the nonce is the credential".

AND THE SAME SHAPE AGAIN: four hash kinds are mutually assignable, so a mis-stamp is silent in both directions.

WHAT IT COSTS TO FIX, measured rather than guessed: UNDER 20 LINES for the nonces.

THE SUBJECT. A credential that cannot be told from another credential is not a credential. This is the cheapest item in the whole type set and it is on the security boundary.
