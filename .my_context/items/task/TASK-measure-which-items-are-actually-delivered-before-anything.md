---
id: TASK-measure-which-items-are-actually-delivered-before-anything
type: task
title: measure which items are actually delivered, before anything is built on it
status: active
severity: soft
always: false
summary: Find out how often each piece of project knowledge is actually used, so later changes can be judged against a starting point rather than believed.
summary_of: 7427692848ff759c
scope:
  - src/**
  - test/**
  - scripts/**
tags:
  - v2
  - review-loop
  - "plan:loop"
  - "seq:1"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 7bff151ef7865cad
plan: loop
seq: "1"
state: todo
priority: "1"
---

# measure which items are actually delivered, before anything is built on it

D36a. Plan: docs/superpowers/plans/2026-09-08-self-improvement-instrumentation.md. Spec: docs/superpowers/specs/2026-09-08-self-improvement-loop-design.md section 15.

IT IS FIRST AND THE ORDER IS NOT A PREFERENCE. Library drift - accumulated knowledge pushing
performance BELOW the no-knowledge baseline - is silent by construction and only detectable as a
CHANGE. Instrumentation added after the first promotions has no baseline, so the experiment has no
control.

AND IT IS CHEAP, because the instrument was already recording and nobody had read it: recordAudit has
always written one injection record per delivery carrying `injected` and `spilled`, so per-item
contribution is derivable BACKWARDS through history with no new write path and no hook change.

FOUR TASKS: a pure reader over audit records; a split by who authored the item, because the
COMPARISON is the measurement; a CLI surface; and a dated baseline report committed to disk.

USEFUL EVEN IF THE LOOP IS NEVER BUILT: a corpus of 1,011 items where nobody has ever known which are
actually delivered will answer that for the first time.
