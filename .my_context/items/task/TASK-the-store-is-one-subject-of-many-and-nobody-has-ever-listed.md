---
id: TASK-the-store-is-one-subject-of-many-and-nobody-has-ever-listed
type: task
title: the store is one subject of many and nobody has ever listed the others, so there is no map of what is undocumented
status: active
severity: soft
always: false
summary: "The table exists: 32 subjects, each with the documentation that already covers it named by file, plus a recommended order — reports/2026-09-16-the-subjects-of-this-system.md."
summary_of: 44964a3f04718238
summary_was:
  - 2026-09-16 List every subject in this system that deserves the same kind of document the rule store just got.
scope:
  - docs/**
  - reports/**
  - src/**
  - .my_context/items/**
tags:
  - v2
  - docs
  - "plan:rulings"
  - "seq:96"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: cb02e6f767e53ec5
plan: rulings
seq: "96"
state: done
priority: "1"
---

# the store is one subject of many and nobody has ever listed the others, so there is no map of what is undocumented

THE OWNER, 2026-09-16, having read the store document: "i would like you to go over the
conversation, transcripts, documents and the code and generate a table for the whole system of
subjects like the store we would document them in the same way."

THE DELIVERABLE IS A TABLE, NOT A DOCUMENT SET. He is choosing what to document next, and he
cannot choose from a list nobody has made.

── WHAT A SUBJECT IS HERE ────────────────────────────────

The rule store is the worked example, so read `docs/the-store.he.md` FIRST to see the shape a
subject has to be able to fill: what it is and what it is confused with, what it contains today,
how it works, how it is managed, and what is known to be wrong with it.

A SUBJECT IS A THING A READER CAN HOLD IN THEIR HEAD AND ASK QUESTIONS OF. It is not a module
and not a directory. "The corpus", "the archive of conversations", "the injection that happens
at session start", "anchors", "the gates", "the review queue" are subjects. `src/core/paths.ts`
is not.

── WHAT THE TABLE MUST CARRY, ONE ROW PER SUBJECT ───────────────────

  — THE SUBJECT, named as a reader would say it, not as the code spells it.
  — WHAT IT IS, in one plain sentence.
  — WHERE IT LIVES — the code and the data, briefly.
  — WHAT DOCUMENTATION ALREADY EXISTS, and this is the load-bearing column: name the file. A
    `docs/capabilities/*` chapter, a design spec under `docs/superpowers/specs/`, a report, a
    corpus item, or NOTHING. Most of the value of this table is knowing which.
  — HOW MUCH OF IT IS ONLY IN THE CONVERSATION — your judgement, with a reason. The store was
    measured that way and the answer was "the story yes, the facts no".
  — WHAT WOULD BE HARD TO DOCUMENT and why — a subject with no single owner in the code, or one
    whose behaviour is only observable by running it, costs more than its size suggests.
  — A RECOMMENDED ORDER, with the reason in a few words. He will read the top of this list.

── AND SAY WHAT YOU COULD NOT SEE ───────────────────────────

`INV-nothing-is-dropped-silently`. A table that quietly omits a subject is worse than a short
one that names its own edges: say what you swept, what you did not, and which corners of this
system you suspect exist but could not confirm.

A FAIR WARNING FROM THE LANE THAT WROTE THE STORE DOCUMENT: its best sources were two documents
DISTILLED FROM this conversation — and that is also where five of six wrong claims lived,
"because a distillate freezes counts that keep moving". Treat every count you read in a document
as a DATE, not a fact, and check anything you put in the table against the tree as it stands.
