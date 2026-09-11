---
id: TASK-the-maintenance-tool-crud-where-the-form-is-the-template-and
type: task
title: "the maintenance tool: CRUD where the form is the template, and publishing is the gate"
status: active
severity: soft
always: false
summary: The tool that edits the product rules, which never ships to anyone, and the mid-session correction that is built, tested and deliberately connected to nothing.
summary_of: 139d53912a601366
summary_was:
  - 2026-09-11 The owner's private tool for writing and publishing the rules, kept out of the package as the store's whole security model, with the mid-session correction built and deliberately left unwired.
  - 2026-09-11 The tool that edits the product rules, which never ships to anyone, and the mid-session correction that is built, tested and deliberately connected to nothing.
  - 2026-09-11 A private tool for the product owner to write and publish the rules, with the size limit enforced where it cannot hurt a user.
scope:
  - src/ui/maintenance/**
  - src/rules/**
  - package.json
  - test/rules/**
  - e2e/**
tags:
  - v2
  - store
  - "plan:store"
  - "seq:3"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-10
valid_until: null
checksum: 805df079179179c9
plan: store
seq: "3"
state: done
priority: "1"
needs: store/2
---

# the maintenance tool: CRUD where the form is the template, and publishing is the gate

D41 PHASE 3, BUILT 2026-09-11. Plan: docs/superpowers/plans/2026-09-10-d41-product-rule-store.md Tasks 9-13. Design: docs/superpowers/specs/2026-09-10-product-rule-store-design.md sections 10, 11, 12.

IT DOES NOT SHIP, AND THAT IS THE WHOLE SECURITY MODEL. `package.json`'s `files` keeps `src/ui/maintenance/**` out of the published package exactly as it keeps `scripts/` out. A user does not fail to reach the tool - they do not have it. Three assertions in test/rules/maintenance-absent.test.ts hold that: the tool is on disk so the exclusion means something, `npm pack` uploads no file from it, and `files` carries an exclusion covering the tool and not what the tool needs. If it ever ships, the no-authentication decision is void.

WHAT WAS BUILT. Task 9: src/ui/maintenance/server.ts, loopback only, a free port chosen at start and 58888 refused by name because it is the owner's. Task 10: the CRUD screens, where a prohibition's form has a `why` field and will not save without one, read from the same schema.ts TEMPLATE the validator and the renderer read - three things that can drift are one thing. Task 11: the budget is shown at maintenance and per-entry size is computed, never persisted. Task 12: publishing shows a diff, asks, regenerates the integrity manifest and refuses when the production tier is over budget - so a user's install NEVER refuses on size, because a user cannot fix a store that grew.

TASK 13 IS BUILT AND DELIBERATELY UNWIRED - OWNER'S RULING, 2026-09-11. renderCorrection, correctionAtDoor and SESSION_SCOPE_DOORS are in src/rules/deliver.ts with twelve assertions in test/rules/update-correction.test.ts, and NOTHING IN src/ CALLS THEM. That is the decided end state, not a gap, and a later session must not "finish" it by finding tested code with no caller.

HIS REASONING. A correction exists to tell a running session that the store changed under it. The maintenance tool does not ship, so the only person who can change the store while a session is running is the owner, on his own machine - and he would already know he had done it. Nothing can change under a session that did not change it. There is no realistic occasion for the feature.

THE EVIDENCE THAT THE COST WOULD HAVE BEEN REAL, measured 2026-09-11 before the ruling. Every door in SESSION_SCOPE_DOORS already delivers the WHOLE store: deliverAtDoor renders the full set at session-start, compact-restore and manual, unconditionally and with no dedupe, so a correction at any of them is 8,472 bytes of diff (the real v4-to-v5 change, three entries) stapled to 23,772 bytes of full delivery - the second copy section 12.3's own second bullet forbids. The only hook that fires mid-session for a session that already holds the store is pre-tool-use, which ASSERTS rather than delivers, and is cheap only because it latches: past the first row it is one read of delivered.jsonl and no store parse at all, p50 0.371 ms / p95 0.503 ms. Making it a delivery door needs the delivered SHAPE recorded per session, because renderCorrection diffs what the renderer printed so that a `request`-only edit cannot manufacture an empty supersession. delivered.jsonl records a count; adding a per-entry shape map takes the mean row from 145 to 715 bytes, and deliveries() parses the whole file on every matched tool call - at the 5,000-row cap that is p50 3.61 to 13.11 ms and p95 4.57 to 16.15 ms, 3.6x and +11.6 ms p95, on a hook held to a 50 ms p95 ceiling, to serve an answer that is empty every time. Taking the diff from the manifest changelog instead is cheap but wrong: planPublish diffs file checksums, not rendered shape.

WHAT WOULD REOPEN THIS, AND IT IS ONE THING: THE MAINTENANCE TOOL SHIPPING. That is what the `files` exclusion and its three assertions currently prevent. If that exclusion is ever relaxed, a store can change under a session that did not change it, and Task 13 is the first thing to revisit - the code and the wording are already paid for. Until then nothing calls it, and the mechanics are recorded beside the code in src/rules/deliver.ts so nobody re-derives them.

── THREE POINTS RECOVERED AFTER A CONCURRENT CLOSE ───────────────────────────

This item was closed twice within ninety seconds — once by the dispatching session on the owner’s
ruling, once by the lane that had been measuring it — and the second `--body` replaced the first.
Both said the same thing; three points existed only in the first and are restored here rather than
left in a commit message. That the loss was visible at all is the audit log doing its job: it
records `update` rows with checksums, and the lane read them and said so.

ONE. THE GATE ADMITS EXACTLY THE DOORS AT WHICH THE CORRECTION IS REDUNDANT. That is the sharpest
form of why Task 13 has nowhere to go: `deliverAtDoor` already renders the FULL set at
`session-start`, `compact-restore` and `manual`, so a correction at any of the three arrives
stapled to a complete copy of the store it corrects — the second copy §12.3 forbids, and the defect
`CLAUDE.md` opens with. The only hook that fires mid-session is not in the set.

TWO. TRYING IT COULD NOT HAVE SETTLED THIS, BECAUSE THE TESTS WOULD HAVE STAYED GREEN. The
assertions protecting "the hook says nothing on a call it has no opinion on" pass in every sandbox,
because a correction is EMPTY in all of them. Greenness there would not have been evidence, which
is why this had to be decided by measurement and a ruling rather than by wiring it and running the
suite.

THREE. A NAMING CORRECTION IS OWED. Three tests are named "a session-start / compact-restore /
manual door carries the correction". They prove the GATE admits those doors, by calling
`correctionAtDoor` directly — no door supplies the arguments, and none ever has. The names claim
something about the shipped system that is not true, and a later reader taking them at face value
would conclude the wiring exists. Rename them to say they test the gate.
