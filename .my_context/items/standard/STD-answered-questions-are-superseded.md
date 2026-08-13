---
id: STD-answered-questions-are-superseded
type: standard
title: An answered open_question is superseded, never deleted and never left active
status: active
severity: soft
always: false
scope:
  - .my_context/**
  - src/core/mutate.ts
tags:
  - lifecycle
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 42e345250832f1e5
---

# An answered open_question is superseded, never deleted and never left active

When an open question is answered: set `status: superseded`, add a
`superseded_by` relation to whatever answered it, and leave the question in place.

Leaving it `active` is the harmful option — an open_question tells an agent "do not
decide this yourself", so once settled it would keep warning agents off a resolved
question. Deleting it loses why the answering item exists, and what was unknown at
the time. `validated` is the wrong retirement: the spec defines it as an assumption
that was checked and held, and a question is not an assumption.

## Observations
- [rule] The answering item need not be a decision — a constraint, ADR or lesson can settle a question; the relation is what matters
- [rule] No dedicated "answered" status: every retired status hits the same eligibility gate, so it would add a name without adding mechanics
- [consequence] Plan 3’s supersedeItem handles this with no special case
