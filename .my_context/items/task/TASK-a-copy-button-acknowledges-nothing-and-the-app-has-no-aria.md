---
id: TASK-a-copy-button-acknowledges-nothing-and-the-app-has-no-aria
type: task
title: a Copy button acknowledges nothing, and the app has no aria-live region at all
status: active
severity: soft
always: false
summary: The copy button works but gives no sign that it did, and the app has no way at all to announce anything to a screen reader.
summary_of: 02a1c5fde58d8efd
scope: []
tags:
  - v2
  - ui
  - review
  - a11y
  - "screen:work"
  - "plan:walk"
  - "seq:31"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 1862640dfa727a16
plan: walk
seq: "31"
state: done
priority: "1"
source: "plan:review seq:5, the functional UX review, 2026-08-25"
---

# a Copy button acknowledges nothing, and the app has no aria-live region at all

FOUND 2026-08-25 by plan:review seq:5, the functional UX review, 2026-08-25, by clicking the button and reading the clipboard.

THE COPY WORKS. On the Review queue the clipboard received exactly `mycontext review promote-revision CONST-migrations-run-forward-only --revision REV-eba4820f3c21 --yes`. The command is right.

NOTHING SAYS SO. Measured on `work`, `capture` and `doctor`: after the click the button label, its class list and its ARIA attributes are BYTE-IDENTICAL to before, and no element anywhere in the document changed. A user cannot tell a successful copy from a click that missed.

AND THERE IS NO `aria-live` REGION ANYWHERE IN THE PAGE -- checked with `document.querySelector("[aria-live]")`, which returns null on every screen. So a screen reader is told nothing, ever, by any transient outcome in this product. That is broader than the copy button: it is the shell missing the one affordance a single-page app needs to announce that something happened.

THE WORK, and the second half is the larger one:
  1. The copy row acknowledges. The mockup is the design of record and must be checked for what it draws here before inventing an affordance.
  2. The SHELL gains one polite `aria-live` region, built in `renderChrome()` beside `#prov` -- one home for every transient announcement, the same argument the provenance bar already makes for qualifications. A screen module creating chrome that outlives it is a decision for the shell s owner, which is why this belongs to the shell and not to `work.js`.

STRINGS FIRST: any new sentence needs a key in the mockup and then in BOTH tables, because `strings-parity` compares the key sets in both directions.

IT BELONGS WITH `plan:builder seq:6`, "copy is refused until the command passes, and the refusal is readable" -- that task makes the FAILURE readable and this one makes the SUCCESS readable. Same row, same commit.
