---
id: RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done
type: rule
title: the owner says when a screen is done, and passing is not the same as designed
status: active
severity: hard
always: false
summary: A screen is finished only when the owner says so; the old demand that it match the design drawing exactly is gone, and only a difference that matters is now worth reporting.
summary_of: 405a02fa5f36b963
summary_was:
  - 2026-09-11 A screen is finished only when the owner says so, and a test showing that it works is not a test showing it is the screen that was actually designed.
acknowledged:
  - body_disagrees_with_meta@7ef8f3973e3068f7
scope: []
tags:
  - v2
  - ui
  - governance
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 1b7170dbc5915798
---

# the owner says when a screen is done, and passing is not the same as designed

Owner ruling, 2026-08-23, in the owner's own words: before implementing and when testing you should implement and get at test 1:1 of the mockup features look feel and all other properties, you are not done until 100% similar and i approve that it is.

THE BAR IS 1:1, AND IT IS NOT SELF-CERTIFIED

A screen is finished when it matches the mockup in features, look, feel and every other property - and when the OWNER says so. Not when the gates are green, not when the agent believes it, not when a parity check passes. Done is an owner's word here.

TESTS MUST MEASURE FIDELITY, NOT MERELY FUNCTION

A test that proves the screen runs is not a test that proves it is the screen that was designed. Compare against the mockup section: structure, the prose in each cell, spacing, colour, weight, order, states. Where a check cannot express a property, say so rather than letting the green stand in for it.

The limit of structural comparison is already proved. e2e/screen-parity.spec.ts compares element KINDS and is blind to prose: the audit stream rendered one generic op-itemId-note-path cell for four record kinds where the mockup composes a different sentence for each, and every element involved was the same bdi and span.m. The gate was green. The owner found it by looking at the two screens side by side.

YOU MAY CREATE DATA TO TEST WITH, THEN SUPERSEDE IT

Owner ruling in the same breath: for the tests you are allowed to create data and after that supersede it. This removes the last excuse for an unverified screen. A screen that only renders its graphics when the corpus happens to contain the right record is a screen nobody has seen - so create the records the screen needs, look at it fully populated, and then retire what you created. Use mycontext supersede, or delete fixture records you wrote yourself, and leave the corpus as you found it.

This is what makes 1:1 checkable on a data-driven screen. The audit stream drew no token bar, no hatched void and no regime rule for a whole day because this corpus's recent history was fifty consecutive mutations, and the absence looked exactly like missing code.

Related: [[RULE-look-at-the-mockup-and-the-plans-before-implementing-then]] is the reading order; this is the acceptance bar. [[RULE-a-ui-change-is-not-verified-until-someone-has-looked-at-it]] is why looking is the instrument.

AMENDED 2026-08-26 by `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap`. The amendment narrowed the reach of this rule; it did not unseat it. Both halves are stated below as they stand today, so a reader takes the current bar rather than reconstructing it from an edit.

WHAT STANDS, and it is the half that has been earning its keep: a screen is DONE when the OWNER says so, not when the gates are green; and a test that proves a screen runs is not a test that proves it is the screen that was designed.

WHAT THE AMENDMENT DROPPED, and it is the parity half rather than the acceptance half: the demand that the app equal the mockup in BOTH directions. The app is now what is built and the mockup is history plus a list of intended-but-unbuilt features. A feature added to the app does not have to be drawn in the mockup first, and a difference is a GAP only where the mockup was right -- which is a question for the owner where it is not obvious, because several differences are deliberate decisions.

AMENDED A SECOND TIME, 2026-09-11, by `DEC-the-mockup-is-a-reference-to-initial-thoughts-and-only-a`. The 2026-08-26 amendment dropped one DIRECTION; this one narrows what is left to a KIND. Both halves are stated below as they stand today, so a reader takes the current bar rather than reconstructing it from two edits.

THE OWNER'S WORDS, verbatim, because they are the rule and a paraphrase of them is not: "just change or update the rule based on the mockup, add an exception for the cases you found so it will not fail the test only. In general mockup should stay as a reference to initial thoughts and designs, currently the app is far away from it and most of the chances that we did some things different and it's ok. The only request is to identify a diff between the mockup and the app and only if it is important like core functionality or similar."

WHAT STILL STANDS, and it is the same half that survived the first amendment: a screen is DONE when the OWNER says so, not when the gates are green; a test that proves a screen runs is not a test that proves it is the screen that was designed; and the licence to create data, look at the screen populated, and then supersede what you created is untouched and is still how a data-driven screen is made checkable at all.

WHAT IS GONE IS THE WORD 1:1, AND EVERY READING OF IT. The mockup is a REFERENCE TO INITIAL THOUGHTS AND DESIGNS. The app is far from it, most of those moves were deliberate, and a difference is NOT a defect by default. "100% similar" is no longer the bar and no gate may act as though it were.

WHAT REPLACES IT is one sentence and it is the owner's: identify the diff between the mockup and the app, and surface only what is IMPORTANT -- core functionality or similar. The three tests that make that operable, and the citation behind each clause, are in `DEC-the-mockup-is-a-reference-to-initial-thoughts-and-only-a`. They are not restated here, because a second copy of a rule cannot be superseded.

WHAT IS LOST, named rather than left for someone to find: this rule used to catch a screen that was built without being compared to the design at all. Under the new bar that comparison still runs -- `e2e/screen-parity.spec.ts`, `e2e/tree-parity.spec.ts` and `e2e/pixel-parity.spec.ts` all still produce the full inventory -- but only a reportable difference fails anything. The inventory is the protection now, and an inventory nobody reads protects nothing. That is the owner's acceptance half doing the work, which is what it was always for.
