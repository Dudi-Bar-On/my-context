---
id: TASK-updateitem-and-createitem-project-or-the-cli-is-the-only
type: task
title: updateItem and createItem project, or the CLI is the only closed door
status: active
severity: soft
always: false
summary: Two of the three ways to write an item skip the rules the third enforces, so a bad value is accepted and only noticed later.
summary_of: fb954b42bd670501
scope: []
tags:
  - "plan:categories"
  - "seq:20"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 3b3a69682ce88da0
state: done
plan: categories
seq: "20"
---

# updateItem and createItem project, or the CLI is the only closed door

The CLI door is closed (seq 15) and the STORE door is not, so the drift this plan exists to end can still be reintroduced through the surface the model actually uses.

MEASURED 2026-08-23 by execution, on a project whose config declares `updates.state` with `projectsTo`. MCP `update_item({id, extra: {state: "done"}})` wrote `state: done` into the frontmatter, left the tag reading `state:todo`, and returned "updated" - one fresh `stale` mismatch, reported as a success. The same call with `state: "donee"` was ALSO accepted and written: `updateItem` calls `validateExtra` and `unknownExtraFieldError` but never `updatableExtraError`, so the declared vocabulary is not enforced on that path at all. `mycontext add --extra state=donee` did the same at capture, exit 0. `mycontext edit --extra state=donee` refuses both, and `mycontext doctor` then reports every one of them as `tag_projection_drift` and exits 1 - so the defect is DETECTED after the fact and PREVENTED on exactly one of three write surfaces.

RULING: `updateItem` and `createItem` should project, and should refuse a value outside the declared vocabulary, the same way they already enforce `validateExtra`, `unknownExtraFieldError`, `scopeRequirementError` and `inertFieldError`. Projection is the same class of rule as those four and is the odd one out if it lives only in a command. It is deterministic - given the config and the item, the tag list is a FUNCTION of the field - so nothing is lost by computing it at the write boundary, and every caller above it (edit, add, create_item, update_item, review promote, inbox promote, ingest apply) inherits it instead of each growing a copy.

The seq-15 wiring in `edit.ts` STAYS where it is and does not become redundant: the preview a human approves has to show the tag rewrite as part of the diff, which means the projection must happen before `changesOf` and cannot wait for the write. That is the shape `inertFieldError` and `scopeRequirementError` already have - thrown by the store, called early by the command purely for ordering - and it is the shape this should take. `reconcileTags` is idempotent (the first tag under the prefix keeps its slot and takes the value, any further one is dropped), so the command computing the fixed point and the store recomputing it is safe by construction.

Two things this does NOT become, and both follow from `projectFieldUpdate` reconciling only the projections whose field the CALLER is moving. It is not a migration: an unrelated `--title` edit passes no extra, so no projection runs and the thirteen already-disagreeing items are untouched - seq 19 keeps its own audit trail. And it does not rewrite tags nobody asked about: every tag outside the prefix is returned in its original position.

TWO THINGS TO GET RIGHT, both found while wiring seq 15. First, `updateItem` MERGES extra and ASSIGNS tags outright, so the store must project from the merged extra and from the INCOMING tag list (`input.tags ?? item.tags`), not from the stored one - otherwise `--tags "v2,ui" --state done` silently discards the caller's tag list. `edit.ts` composes them in exactly that order and `test/cli/edit-projection.test.ts` pins it. Second, the staged-revision path (`agentEdits: "review"`) was NOT checked: if an agent's update is staged rather than written, the projected tags have to be staged WITH it, or a promoted revision lands the field without the tag and reopens the same hole one door further in. Verify that before implementing, do not assume it.
