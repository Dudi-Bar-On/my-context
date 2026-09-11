---
id: DEC-the-mockup-is-a-reference-to-initial-thoughts-and-only-a
type: decision
title: the mockup is a reference to initial thoughts, and only a CORE difference is a finding
status: active
severity: soft
always: false
summary: "The design drawing is now only a record of early thinking: the app being different is normal, and a difference is reported only when something that matters is missing."
summary_of: 2e56cb91c7813177
scope: []
tags:
  - v2
  - ui
  - mockup
  - gates
  - owner-ruling
  - testing
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-11
valid_until: null
checksum: 3b04263bd4624333
---

# the mockup is a reference to initial thoughts, and only a CORE difference is a finding

> OWNER RULING, 2026-09-11, verbatim, and it is the whole of the change:
>
> "just change or update the rule based on the mockup, add an exception for the cases you found so it will not fail the test only. In general mockup should stay as a reference to initial thoughts and designs, currently the app is far away from it and most of the chances that we did some things different and it's ok. The only request is to identify a diff between the mockup and the app and only if it is important like core functionality or similar."

WHAT CHANGES: A DIFFERENCE IS NO LONGER A DEFECT BY DEFAULT

`RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done` still carried the word 1:1 and still read as a target. It is now a REFERENCE TO INITIAL THOUGHTS AND DESIGNS. The app has moved a long way from it, most of those moves were deliberate, and that is fine. What survives is much narrower and is the owner's own sentence: IDENTIFY THE DIFF, AND SURFACE ONLY WHAT IS IMPORTANT.

THIS IS THE THIRD STEP OF ONE MOVEMENT, NOT A REVERSAL

  - 2026-08-26, `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap` dropped the app-to-mockup direction from the gates. Mockup-to-app stayed, and stayed FAILING.
  - 2026-09-02, `DEC-the-mockup-is-a-frozen-reference-it-is-read-never-written` made the file read-only and ruled that app-ahead is NORMAL and must never fail a gate, a review or a report.
  - TODAY narrows the one direction that was left. Mockup-ahead is no longer a finding by itself. It is a finding only when what is missing is important.

This EXTENDS and SHARPENS `DEC-the-app-is-what-is-built`; it does not replace it. That ruling's own qualification -- "a difference is a GAP only where the mockup was right ... When it is not obvious, it goes to the owner" -- is the hinge this turns on, and the escalation clause below is that sentence kept rather than replaced by a definition nobody ruled on.

WHAT "IMPORTANT, LIKE CORE FUNCTIONALITY" MEANS, AND WHERE EACH CLAUSE COMES FROM

The owner gave the principle. Every clause below is DERIVED from a ruling this corpus already carries, so that a gate is not quietly deciding a question nobody answered -- which is exactly how the mockup became a 1:1 target in the first place.

A difference is REPORTABLE only when ALL THREE hold.

TEST 1 -- DIRECTION. The mockup has it and the app does not.

App-ahead is never reportable. Already ruled, 2026-09-02, and not new today: "App-has-it-and-mockup-does-not is NORMAL and must never fail a gate, a review or a report." This halves the space before anything else is decided.

TEST 2 -- KIND. What is absent is one of four things, and the list is CLOSED.

  - A SCREEN -- a `[data-p]` section the mockup draws and the app has no route for. `DEC-every-screen-the-mockup-shows-is-approved-for-implementation` makes each of them approved work, so a missing one is missing work.
  - A CONTROL -- something the reader can operate. The operable set is not invented here: `test/ui/styles-parity.test.ts` and the button-contrast walk already treat `:where(button,a,input,select,summary)` as the set of things a reader acts on.
  - A FIELD OR FIGURE THE SURFACE CAN SOURCE -- a keyed segment with somewhere to read its value from. `e2e/strip.spec.ts`'s `NOT_DRAWN_YET` ledger already states the test: "The question to answer first is whether the segment has a SOURCE." A field with no source is not a gap; it is a drawing of a thing that does not exist yet.
  - A GRAPHIC -- an element KIND absent altogether, not drawn fewer times. `e2e/screen-parity.spec.ts` is the founding case: 109 missing `<rect>` elements were "the entire graphic of the screen", and that file already rules that "Counts are deliberately NOT compared".

TEST 3 -- NOT ALREADY EXCLUDED BY A STANDING RULING.

  - A VALUE difference in spacing, colour or weight is OUT. `DEC-the-frozen-mockup-unpins-the-css-coupling-styles-parity` already turned that comparison into a ONE-DIRECTIONAL PRESENCE FLOOR on 2026-09-02, and the same day's ruling keeps the mockup as the "reference for colours and styles" -- a thing that is READ, not a thing that is matched.
  - A COUNT of repeated rows is OUT. `screen-parity.spec.ts`: "The mockup carries four sample rows where the app renders 275 real items ... Equality of counts would fail on correctness."

THE MOCKUP CAN ONLY EVER EVIDENCE PRESENCE, NEVER CAPABILITY

"A control that does something the other side cannot do" sounds like the sharpest test available and it is not available at all, because `RULE-take-the-mockup-s-design-never-its-behaviour-behaviour-comes` (hard, pinned) rules that the mockup has NO authority over behaviour: "every dynamic thing in it is a fixture or a simulation, and simulations are indistinguishable from behaviour by reading."

So a mockup-versus-app comparison can never say that a control DOES less. It can only say that a control is NOT THERE. "Core functionality", read off this file, therefore means THE PRESENCE OF AN AFFORDANCE and nothing more. Anything stronger has to be measured against the plans and the API, which is where behaviour has always come from.

WHAT IS NOT DERIVED, AND IS THE OWNER'S TO SETTLE: WORDING

WORDING IS NOT SETTLED BY THIS ITEM, and it is not settled by the ruling either. It is the one case where the corpus argues both ways and no gate should pick a side on its own:

  - AGAINST reporting it: it is prose, and the owner's ruling is that the app having done things differently is ok.
  - FOR reporting it: `RULE-1-1`'s surviving half was WRITTEN off a wording defect. The audit stream rendered one generic sentence where the mockup composed four, every gate was green, and the OWNER found it by looking. `test/ui/strings-parity.test.ts` keeps the mockup-declares-a-sentence-the-app-lacks direction for exactly that reason.

So a MISSING STRING KEY stays a finding today, because a key the app never places is usually a missing label on a missing thing rather than a rephrasing. A DIFFERENT SENTENCE under the same key is not a finding and never was -- nothing compares mockup prose to app prose. Whether a missing key should keep failing is the open question, and it goes to the owner rather than being decided here.

THE EXCEPTIONS THIS RULING AUTHORISES ARE NAMED, NEVER BLANKET

The owner asked for exceptions "so it will not fail the test only". An exception NAMES the difference it excuses and cites the ruling behind it. `RULE-never-weaken-byte-identity` and `RULE-never-tune-a-check-until-it-agrees-with-you` both still hold, and `DEC-the-frozen-mockup-unpins-the-css-coupling-styles-parity` already set the bar for this kind of edit: relevance not convenience, delete rather than skip, and NAME WHAT PROTECTION IS LOST. A blanket disable, a widened tolerance or a deleted assertion is not an exception -- it is the gate deciding it no longer measures anything.

TWO WORKED EXAMPLES, BOTH SETTLED BY THE TESTS ABOVE

THE `gaps` SCREEN -- REPORTABLE KIND, EXCUSED BY A RULING. The mockup's rail lists 21 screens; the app draws 20. That is direction-correct and it is a SCREEN, so it passes tests 1 and 2 and would be a finding. It is excused because the screen was retired deliberately and with the owner's approval (`TASK-coverage-gaps-folds-into-scope-coverage-keeping-the-one-fact`, seq:22, 2026-09-04, folded into `coverage`). That is the shape every exception takes: not "this does not matter", but "this was decided, here, on this date".

THE STRIP'S ROW COUNT -- NOT REPORTABLE AT ALL, AND NEEDS NO EXCEPTION. The mockup's own comment says "TWO ROWS SINCE 2026-09-01" and the app draws FIVE identity groups to the design's three. That is APP-AHEAD, so test 1 refuses it before the others are reached, under the 2026-09-02 ruling alone. The height difference that follows from it is a spacing VALUE, refused again by test 3. `e2e/strip.spec.ts` had already converted both of its group-count equalities to floors on that ruling. Writing an exception for this would be recording a permission nobody needs, and permissions nobody needs are how a ledger rots.

## Observations
- [note] A difference is reportable only if all three hold: the mockup has it and the app does not; what is absent is a screen, a control, a sourceable field or a whole graphic; and it is not a spacing/colour/weight VALUE or a row COUNT.
- [note] The mockup can evidence the PRESENCE of an affordance and never its capability, because RULE-take-the-mockup-s-design-never-its-behaviour rules that everything dynamic in the file is simulated.
- [note] WORDING is the one axis that is not derived. A missing string key still fails; a different sentence under the same key never did. Whether the first should keep failing is the owner's to settle.
- [note] App-ahead was already never a finding (2026-09-02). Today's ruling narrows the only direction that was left.
- [supersession] Replaces DEC-more-than-the-mockup-is-usually-right-less-than-the-mockup: settled by the contradiction gate at capture: DEC-the-mockup-is-a-reference-to-initial-thoughts-and-only-a replaces it

## Relations
- supersedes [[DEC-more-than-the-mockup-is-usually-right-less-than-the-mockup]]
- amends [[RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done]]
- refines [[DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap]]
- derived_from [[DEC-the-mockup-is-a-frozen-reference-it-is-read-never-written]]
- refines [[RULE-everything-in-the-mockup-gets-built-and-a-proposal-to-change]]
- depends_on [[RULE-take-the-mockup-s-design-never-its-behaviour-behaviour-comes]]
- constrains [[TASK-the-mockup-stops-being-a-1-1-target-and-becomes-a-reference]]
- relates_to [[OPENQ-does-a-missing-mockup-string-key-stay-a-finding-under-the]]
