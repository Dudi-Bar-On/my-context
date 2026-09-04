---
id: TASK-ruling-36-the-readme-sentence-about-which-commands-check
type: task
title: "ruling 36: the README sentence about which commands check flags is wrong, and one summary understates its list"
status: active
severity: soft
always: false
summary: The guide names a command as careless about bad options when it is not, and describes a prohibition list at a third of its real length.
summary_of: 501a24e0afb8d317
scope: []
tags:
  - "plan:rulings"
  - "seq:36"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 8d2f9ed670764b19
plan: rulings
seq: "36"
state: done
priority: "1"
---

# ruling 36: the README sentence about which commands check flags is wrong, and one summary understates its list

Found by ruling 35 while deriving the --yes table, and deliberately left alone because neither is a one-line consequence of that derivation.

1. README says lesson is among the commands that silently ignore an unrecognised flag. Verified against the real parser by execution: mycontext lesson --zzz-not-a-flag prints 'unknown option' and exits 1. It checks. Nothing pins the sentence, and it is derivable from the same SENTINEL probe that already computes NO_FLAG_PROBE in test/helpers/approval-boundary.ts.

2. README summarises the skill's prohibition list as six human actions - promotion, discard, lesson-accept, supersede, edit, repair. The skill's actual never-run-these sentence carries FIFTEEN command strings including inbox-promote, refresh, both revision subcommands and four aliases. Not false word for word, but it reads as a description of the list and understates it by two thirds.

Same defect family as the --yes row and one document section away: a hand-kept list beside a constant that already exists.
