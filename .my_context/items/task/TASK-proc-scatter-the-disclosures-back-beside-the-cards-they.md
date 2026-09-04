---
id: TASK-proc-scatter-the-disclosures-back-beside-the-cards-they
type: task
title: "proc: scatter the disclosures back beside the cards they qualify"
status: active
severity: soft
always: false
summary: Move each footnote back beside the card it is about, instead of piling them all together at the bottom of the screen.
summary_of: 2c0d91ee31dfc069
scope: []
tags:
  - v2
  - ui
  - tree-parity
  - "screen:proc"
  - "plan:walk"
  - "seq:2"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: b00a3bdd4f47c68c
plan: walk
seq: "2"
state: todo
priority: "2"
source: "plan:port seq:98, proc"
---

# proc: scatter the disclosures back beside the cards they qualify

Carries out the ruling of the same date: a disclosure sits beside the card it qualifies.

proc.js collects the disclosures into one card at the foot of the screen. That card is the extra top-level `div.card.pane` reported as tree-parity findings proc #00 and #01 -- the mockup s section has four children, the app s has five.

WHAT THE WORK IS: each disclosure goes back beside the card it is about. The genuinely screen-wide one -- `progress is recorded per workspace, not per session` -- may stay at the foot, and it is the only one that may.

READ THE COMMENT BEFORE CHANGING THE CODE. The function s header argues for the collected card and the argument is not silly; the ruling narrows it rather than rejecting it. It also warns that the card carries no `<h3>` because `pr.` declares no heading for one, and that inventing a heading here fails strings-parity in the direction that names it. Whatever survives at the foot inherits that constraint.

The deduplication logic above it is load-bearing and separate: disclosures are deduped BY MESSAGE and not by code, deliberately, so that two procedures producing two different sentences under one code both survive. Scattering the cards must not quietly become deduping by code.
