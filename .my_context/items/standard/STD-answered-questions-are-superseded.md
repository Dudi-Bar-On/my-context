---
id: STD-answered-questions-are-superseded
type: standard
title: An answered open_question is superseded, never deleted and never left active
status: active
severity: soft
always: false
summary: An open question that gets answered is retired pointing at its answer, never deleted and never left open, or it keeps warning people off a settled point.
summary_of: 0118e9e15ddc0100
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
checksum: 6deccf958c6673f6
---

# An answered open_question is superseded, never deleted and never left active

When an open question is answered, retire it with `mycontext supersede <question id> --by <answering id> --yes`; an agent calls the `supersede_item` tool with the same two ids. That single call sets `status: superseded`, stamps `valid_until`, writes `superseded_by` on the question and the mirroring `supersedes` on the answer, and leaves the question — body, observations and existing relations — in place.

Do not try to write the retirement edge as a plain relation. `superseded_by` is deliberately absent from `RELATION_TYPES`, and `link_items` refuses both it and `supersedes` before it even checks that list. The edge can only be written by the call that also moves the status, so a relation can never assert a retirement that never happened.

Leaving it `active` is the harmful option — an open_question tells an agent "do not decide this yourself", so once settled it would keep warning agents off a resolved question. Deleting it loses why the answering item exists, and what was unknown at the time. `validated` is the wrong retirement: the spec defines it as an assumption that was checked and held, and a question is not an assumption.

## Observations
- [rule] The answering item need not be a decision — a constraint, ADR or lesson can settle a question; the relation is what matters
- [rule] No dedicated "answered" status: every retired status hits the same eligibility gate, so it would add a name without adding mechanics
- [consequence] Plan 3’s supersedeItem handles this with no special case
