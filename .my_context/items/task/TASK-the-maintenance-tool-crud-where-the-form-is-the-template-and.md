---
id: TASK-the-maintenance-tool-crud-where-the-form-is-the-template-and
type: task
title: "the maintenance tool: CRUD where the form is the template, and publishing is the gate"
status: active
severity: soft
always: false
summary: The tool that edits the product rules, which never ships to anyone, and the mid-session correction that is built, tested and deliberately connected to nothing.
summary_of: 1d03cb184d6b993a
summary_was:
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
checksum: 6145bcb7d1eeaa04
plan: store
seq: "3"
state: done
priority: "1"
needs: store/2
---

# the maintenance tool: CRUD where the form is the template, and publishing is the gate

D41 PHASE 3. Plan: docs/superpowers/plans/2026-09-10-d41-product-rule-store.md Tasks 9-13. Design: docs/superpowers/specs/2026-09-10-product-rule-store-design.md sections 10, 11, 12.

IT DOES NOT SHIP, AND THAT IS THE WHOLE SECURITY MODEL. `package.json`’s `files` already keeps
`scripts/` out of the published package; the same mechanism keeps this out. A user does not fail
to reach the tool - they do not have it. Assert that, rather than assuming it: if it ever ships,
the no-authentication decision is void.

THE FORM IS THE TEMPLATE. A prohibition’s form has a `why` field and will not save without one,
from the same table the schema and the check read. Three things that can drift are one thing.

AND THE BUDGET IS GOVERNED HERE BUT ENFORCED AT PUBLISH: a user’s install NEVER refuses on size,
because a user cannot fix a store that grew. Publishing refuses instead and names what to move.
Per-entry size is computed, never persisted - a persisted size is a cache that goes stale.

CLOSED 2026-09-11. Tasks 9–12 shipped; TASK 13 IS BUILT, TESTED AND DELIBERATELY UNWIRED BY
OWNER RULING. This closes D41 at 5 of 5.

HIS REASONING, and it is the short form: the maintenance tool DOES NOT SHIP — that is the
store’s whole security model — so the only person who can change the store while a session is
running is the owner, on his own machine, and he would already know he had done it. A correction
exists to tell a session something changed under it. Nothing can change under it.

AND A MEASUREMENT THAT REACHED THE SAME PLACE BY A SHARPER ROUTE, taken before the ruling
arrived and kept because it is the evidence a later reader will want:

EVERY DOOR IN `SESSION_SCOPE_DOORS` ALREADY DELIVERS THE WHOLE STORE. `deliverAtDoor` renders
the full set at `session-start`, `compact-restore` and `manual`, unconditionally and with no
dedupe. So a correction at any of the three arrives STAPLED TO A COMPLETE COPY OF THE STORE IT
CORRECTS — 8,472 bytes of diff beside 23,772 bytes of full delivery. That is the second copy
§12.3 forbids and the defect `CLAUDE.md` opens with. THE GATE ADMITS EXACTLY THE DOORS AT WHICH
THE CORRECTION IS REDUNDANT, and the only hook that fires mid-session is not a door.

WHAT WIRING IT TO `pre-tool-use` WOULD HAVE COST, measured rather than feared. `assertDoor` past
its latch is p50 0.371 ms and parses no store at all. A correction needs the OLD RENDERED
ENTRIES to diff against, and nothing holds those bytes: recording them per delivery takes the
mean row 145 B → 715 B and `deliveries()` p50 3.61 ms → 13.11 ms, p95 4.57 → 16.15 — 3.6×, on
every matched tool call, on a hook held to a 50 ms p95 ceiling, TO SERVE A CORRECTION THAT IS
EMPTY EVERY TIME.

The cheap alternative was measured and REFUSED rather than taken: reading the version from the
manifest costs p50 0.032 ms but diffs FILE CHECKSUMS, so a `request`-only edit — which §6 says
is never injected — would tell a reader their copy is superseded when it is byte-identical. That
is the inverse of the defect the wording exists to prevent, manufactured by the mechanism meant
to prevent it.

AND THE TESTS WOULD HAVE STAYED GREEN, which is why this could not be settled by trying it: the
assertions protecting "says nothing on a call it has no opinion on" pass in every sandbox,
because a correction is empty in all of them. GREENNESS THERE WOULD NOT HAVE BEEN EVIDENCE.

THE CONDITION THAT WOULD MAKE THIS WORTH REVISITING, so nobody re-opens it on finding tested
code with no caller: the maintenance tool SHIPPING, which `package.json`’s `files` exclusion and
its three assertions currently prevent, or §12.1’s store-update artifact existing so a user’s
install can receive a store change at all. `mycontext rules` offers verify, list and show, and
no way to take an update. Until one of those changes, this is finished.

ONE ADJACENT QUESTION LEFT OPEN AND NOT DECIDED HERE: a RESUMED session already holds a
`delivered` row and is handed the whole store again, 23,772 bytes. `hooks/session-start.ts`
rules on that deliberately — "nothing can inspect a context window, so the only safe direction
is to deliver and record" — and reversing it is the owner’s, not a lane’s.

AND A NAMING CORRECTION OWED: three tests named "a session-start / compact-restore / manual door
carries the correction" prove the GATE admits those doors, by calling `correctionAtDoor`
directly. No door supplies the arguments, so the names claim something about the shipped system
that is not true.
