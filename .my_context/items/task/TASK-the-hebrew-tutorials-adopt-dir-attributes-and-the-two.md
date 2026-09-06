---
id: TASK-the-hebrew-tutorials-adopt-dir-attributes-and-the-two
type: task
title: the Hebrew tutorials adopt dir attributes, and the two families stop disagreeing
status: active
severity: soft
always: false
summary: Both Hebrew document families keep code readable the same way, so a reader and a writer meet one convention.
summary_of: 9437673e8468dcc3
scope:
  - docs/tutorials/**
  - scripts/**
tags:
  - v2
  - docs
  - rtl
  - "plan:docsys"
  - "seq:12"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: d8982cf568bd7f2a
plan: docsys
seq: "12"
state: todo
priority: "3"
---

# the Hebrew tutorials adopt dir attributes, and the two families stop disagreeing

Owner ruling 2026-09-06 (plan D8), settling the open question about the two Hebrew families.

MEASURED: the tutorials use 343 RLM marks and 246 non-breaking hyphens and ZERO dir attributes.
docs/README.he.md uses 1,860 dir attributes and neither mark. Both work; nothing said which this
project uses.

CHOSEN: dir attributes, the README convention. Three reasons, in the order that decided it. It is
VISIBLE IN THE SOURCE - an RLM is invisible in every editor, which is how it goes wrong unnoticed
and why a reviewer cannot see whether it is there. It SURVIVES COPY-PASTE into a terminal or an
issue. And it is what the larger, more-read document already does, so the smaller family moves
rather than the larger.

THE CONVERSION IS GENERATED OR SCRIPTED, NEVER HAND-EDITED. 343 + 246 marks across 24 tutorials is
exactly the volume where a hand pass introduces errors it cannot then find - and an RLM is
invisible, so a missed one is invisible too. Whatever does the conversion must REPORT what it
changed and be re-runnable.

AND THE RESULT IS CHECKED, not assumed: after conversion, zero RLM marks and zero non-breaking
hyphens should remain in the tutorials, and that is a measurement a test can hold so the two
families cannot drift apart again.

ONLY THE HEBREW FILES ARE IN SCOPE. The English tutorials have no marks to convert and must not be
touched.
