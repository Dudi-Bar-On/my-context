---
id: NOTE-the-functional-ux-review-21-screens-both-languages-four
type: note
title: "the functional UX review: 21 screens, both languages, four journeys, on the running app"
status: active
severity: soft
always: false
summary: A walk through every screen in both languages, asking whether a person can actually finish four real tasks rather than whether the screens look right.
summary_of: 59316fced3f39543
scope: []
tags:
  - v2
  - ui
  - review
  - measurement
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 2f536d6eac745e6e
---

# the functional UX review: 21 screens, both languages, four journeys, on the running app

plan:review seq:5, run 2026-08-25 through Playwright against `mycontext ui` over `.demo-corpus`, headed, in Chromium. The task defined itself as a TASK-COMPLETION review rather than a design review: "can a user find what governs a file, promote a draft, see why a search returned nothing, and recover from a stale projection".

=== THE GOOD NEWS, AND IT IS THE HEADLINE ===

All 21 screens, in BOTH languages, swept one at a time:
    0 console errors
    0 uncaught page errors
    0 failed network requests (nothing 4xx or 5xx)
    0 screens that failed to render
The Hebrew toggle works end to end -- `#lang` sets the preference, the page reloads, `dir=rtl lang=he`, the token survives in sessionStorage, and every screen re-renders translated. Character counts track English closely on all 21, so translation is applied rather than falling back.

THIS MATTERS BECAUSE THE OWNER SAID "many things does not work". On the evidence, the app RUNS. What is wrong is narrower and more specific than that feeling, and it is listed below.

=== THE FOUR JOURNEYS ===

J1 FIND WHAT GOVERNS A FILE -- WORKS. Coverage draws the tree, clicking `invoice.ts` updates the heading to "What governs src/billing/invoice.ts" and lists the three governing items with the reason each applies. Checked the tree labels geometrically rather than by reading `textContent`: the count and the filename have a real 7px gap, so the run-together look in a text dump is a measurement artefact and NOT a defect.

J2 PROMOTE A DRAFT -- WORKS, with one flaw. The Review queue shows the staged revision, the per-field diff, and a Copy button. The clipboard received exactly:
    `mycontext review promote-revision CONST-migrations-run-forward-only --revision REV-eba4820f3c21 --yes`
Correct command, correct ids. The flaw is that NOTHING acknowledged the copy -- see finding 1.

J3 WHY DID A SEARCH RETURN NOTHING -- the composer works and `is not` is DISABLED. That turned out to be correct and well-argued, not a bug: no server-side builder emits `<>`, and `ask.js` refuses to send `is` for `is not` because that "would answer a different question from the one on screen and report it as the same one". It is disabled everywhere except the three fields whose vocabulary is closed and holds exactly two members. THE REFUSAL IS RIGHT AND HAS NO WORDS ON SCREEN -- see finding 6.

J4 RECOVER FROM A STALE PROJECTION -- the honest half works, the recovery half does not. Tested by copying the corpus and appending five records to `audit.jsonl` AFTER boot, which is exactly how a real user gets there. watch, ask and decay ALL report it, with the same well-written sentence, and none of them invents a number. That is the product behaving correctly under failure. What is missing is the way out -- see findings 2 and 3.

AND THE FILTER ROW COLLAPSED TO `All` ALONE, live, exactly as predicted by the reconciliation two hours earlier. On a fresh projection it offers All plus all six kinds; behind, it offers All. That is the AUDIT_KINDS defect (`plan:ui3 seq:11x`) reproduced rather than inferred.

=== ONE CORRECTION TO MY OWN FIRST READING ===

I first recorded that Ask says NOTHING about a behind projection while watch refuses honestly, and that two screens reading the same projection disagreed. THAT WAS WRONG -- my probe truncated the screen text at 900 characters and cut the message off. Ask reports it, with the same sentence. Re-run with a full-text search before it was written down.
