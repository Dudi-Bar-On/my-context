---
id: TASK-the-mockup-stops-being-a-1-1-target-and-becomes-a-reference
type: task
title: "the mockup stops being a 1:1 target and becomes a reference; only core differences are surfaced"
status: active
severity: soft
always: false
summary: "Done: the ruling is captured, two rules are amended, one named exception covers the retired gaps screen, and the wording question goes back to the owner."
summary_of: 2b6a0e446a3eedc8
summary_was:
  - 2026-09-11 Record the owner's ruling that the design drawing is only a reference to early thinking, and make the tests report only the differences that actually matter.
acknowledged:
  - task_unverified@9ab5ee1a2487f64c
scope: []
tags:
  - v2
  - ui
  - mockup
  - gates
  - owner-ruling
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-11
valid_until: null
checksum: 8c36f3d5a6527106
state: done
---

# the mockup stops being a 1:1 target and becomes a reference; only core differences are surfaced

OWNER RULING, 2026-09-11, verbatim:

"just change or update the rule based on the mockup, add an exception for the cases you found so it will not fail the test only. In general mockup should stay as a reference to initial thoughts and designs, currently the app is far away from it and most of the chances that we did some things different and it's ok. The only request is to identify a diff between the mockup and the app and only if it is important like core functionality or similar."

DONE 2026-09-11. WHAT WAS PRODUCED.

THE RULING is in `DEC-the-mockup-is-a-reference-to-initial-thoughts-and-only-a`, in the owner's own words, with the three tests that make "important, like core functionality" operable and a citation behind every clause. It supersedes `DEC-more-than-the-mockup-is-usually-right-less-than-the-mockup`, whose "app draws LESS -> a defect" was the claim the ruling narrows.

TWO RULES AMENDED IN PLACE, never restated. `RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done` -- amended a second time; the acceptance half survives untouched and the word 1:1 is gone. `RULE-everything-in-the-mockup-gets-built-and-a-proposal-to-change` -- narrowed: what must be built is what is important, and its screenshot clause had already been overtaken by the 2026-09-02 freeze.

ONE EXCEPTION, NAMED AND SELF-PROVING. `RETIRED_FROM_THE_APP` in `e2e/mockup.ts` holds one entry, `gaps`, citing `TASK-coverage-gaps-folds-into-scope-coverage-keeping-the-one-fact` (seq:22, 2026-09-04). `e2e/runs.spec.ts` proves the claim rather than trusting it: the mockup rail minus the ledger must equal the shared list, so a screen dropped with no ruling still fails, and an entry for a screen the app still draws fails too. The test's own name said "twenty-one" while the list it compared held twenty; it now says twenty-one drawn and twenty shared.

THE STRIP'S ROW COUNT NEEDED NO EXCEPTION and none was written. The app drawing five identity groups to the design's three is APP-AHEAD, which `DEC-the-mockup-is-a-frozen-reference-it-is-read-never-written` already ruled is never a finding, and `e2e/strip.spec.ts` had already converted both of its group counts to floors on that ruling. Writing an exception for it would have recorded a permission nobody needs.

ONE QUESTION HANDED BACK, because it could not be derived: `OPENQ-does-a-missing-mockup-string-key-stay-a-finding-under-the`. Wording is the one axis this corpus argues both ways on. Until it is answered, a missing key still fails and different prose under the same key still does not -- which is where the gates already stand.

WHAT IS STILL OWED, and it is browser proof: `e2e/runs.spec.ts` runs in Playwright and this lane did not hold the browser. The four assertions were proved node-side against the mockup's own bytes, one break per assertion, and the replaced assertion was confirmed red. What no one has watched is the rail test passing in a browser.
