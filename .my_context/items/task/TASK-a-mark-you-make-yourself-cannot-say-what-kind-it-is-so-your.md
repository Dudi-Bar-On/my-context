---
id: TASK-a-mark-you-make-yourself-cannot-say-what-kind-it-is-so-your
type: task
title: a mark you make yourself cannot say what kind it is, so your own bookmarks carry less than the automatic ones
status: active
severity: soft
always: false
summary: When you bookmark something by hand you can type a name and nothing else, while the marks the tool makes for itself are better described than yours.
summary_of: 143b0e4f6850a362
scope:
  - src/ui/anchor-write.ts
  - src/core/anchors.ts
  - src/ui/**
tags:
  - v2
  - recall
  - ui
  - "plan:anchors"
  - "seq:2"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: 72c9ca2af095405d
plan: anchors
seq: "2"
state: done
priority: "1"
---

# a mark you make yourself cannot say what kind it is, so your own bookmarks carry less than the automatic ones

OWNER RULING 2026-09-15: YES. His question was "does the user have the same input options so it
will be documented it is marked anchores?" and the answer today is no.

MEASURED: an owner mark is forced to kind "note", origin "owner". He can type a label and
nothing more. In 746 anchors he has made ONE. The automatic pass, meanwhile, records a kind, a
byte, a session, an agent and an instant.

THE FIXING IS DELIBERATE AND MUST SURVIVE. `apiAnchorMark` pins kind/origin/at ON PURPOSE so
that no request can forge a row the automatic pass is forbidden to read — that property is what
makes the pass safe to re-run, and it is not being traded away. The fix is to give the OWNER his
own vocabulary, kept separate from the automatic one, so the pass still cannot read or overwrite
anything he made.

WHAT HE SHOULD BE ABLE TO SAY, at minimum: what kind of thing this is, in his own words, and a
free-text detail beyond the label. Any owner kind must sit OUTSIDE the automatic set (table,
ruling) so reconciliation cannot confuse the two — and a test must prove the pass leaves an owner
row alone whatever kind it carries.

THE FILE IS STILL THE TRUTH. Whatever fields are added are fields on the row in
.my_context/.anchors.jsonl; the index table stays derived and deleting it must still lose nothing.
