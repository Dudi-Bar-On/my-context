---
id: DEC-every-screen-the-mockup-shows-is-approved-for-implementation
type: decision
title: Every screen the mockup shows is approved for implementation - nothing in it is a proposal any more
status: active
severity: soft
always: false
summary: "Nothing in the design document is a proposal any more: every screen it draws is approved work to build and track, even where no live data feeds it yet."
summary_of: 90d5382422aa06f7
scope: []
tags:
  - v2
  - ui
  - scope
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 3c08985f88a4f89c
---

# Every screen the mockup shows is approved for implementation - nothing in it is a proposal any more

Owner ruling, 2026-08-22, in the owner's own words: about proposals, I approve all of them to be implemented, not proposals anymore even if it is written somewhere; they should now become tasks in mycontext to be executed and tracked by progress.

WHAT THIS SETTLES. The mockup badges Procedures, Export/import and Template packs with span.prop PROPOSED, and docs/superpowers has plans that treat several screens as out of scope. That vocabulary is retired. The design of record is now a BUILD LIST: every one of the 21 screens, and every graphic, layout and static datum inside them, is approved work.

WHAT IT MEANS FOR DATA. A screen is built even when no live endpoint answers it yet. Where the app has an endpoint, the screen reads it; where it does not, the screen renders the mockup's own static content, laid out and styled exactly as the mockup does. Visual completeness is the goal of this pass; wiring follows. A screen that is not built because its data is not ready is a screen nobody can see or judge, and this project has just spent a day discovering that what cannot be seen does not get verified.

WHAT IT DOES NOT CHANGE. The PROPOSED badge in the app's rail stays, because there it means something different and still true: no module exists behind that route yet. It is computed from Object.hasOwn(SCREENS, name), so it disappears by itself the moment a screen lands. Nothing needs to remember to remove it.

Every screen with no task now has one.
