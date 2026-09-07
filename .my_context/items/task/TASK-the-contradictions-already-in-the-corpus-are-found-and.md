---
id: TASK-the-contradictions-already-in-the-corpus-are-found-and
type: task
title: the contradictions already in the corpus are found and reported, never gated
status: active
severity: soft
always: false
summary: Finding the conflicts that are already there, since guarding new writes does nothing about the ones already written.
summary_of: 66cde91e5fbe59be
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
  - "seq:3"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: 7708a4b092edfd32
plan: contra
seq: "3"
state: todo
priority: "1"
needs: contra/1
---

# the contradictions already in the corpus are found and reported, never gated

Design of record: docs/superpowers/specs/2026-09-07-contradiction-gate-design.md section 9.

contra/1 guards NEW writes only. Turning it on does nothing about what is already in the corpus, and
there are known cases: in one working day this project found FIVE superseded instructions being
acted on as current, including two comment blocks in e2e/app.ts asserting opposite things about
which corpus it uses, forty lines apart, both live.

SO: a DOCTOR CHECK that scores active normative items pairwise and reports the closest pairs for a
human to settle. It never gates and never blocks. It is how the existing debt drains.

IT IS DELIBERATELY NOT PART OF contra/1, for two reasons: nobody should mistake the gate for a cure,
and a pairwise sweep smuggled into a write path would slow every write for no benefit.

REUSE THE VERDICT STORE from contra/1: a pair already ruled distinct must not be reported here
either, and a verdict that has lapsed because one item changed meaning SHOULD be. Otherwise the
drain and the gate would disagree about the same pair, which is the failure this whole subject
exists to prevent.
