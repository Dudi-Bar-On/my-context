---
id: NOTE-the-parity-ledger-measured-78-missing-kinds-and-preview-s
type: note
title: "the parity ledger measured: 78 missing kinds, and preview s three are not fixture gaps"
status: active
severity: soft
always: false
summary: Every screen compared against its design in one pass, showing that some gaps blamed on poor sample data are real and no data change can close them.
summary_of: 5c4558dfd1a81302
scope: []
tags:
  - v2
  - ui
  - testing
  - measurement
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-26
valid_until: null
checksum: b468a31112fbcdd9
---

# the parity ledger measured: 78 missing kinds, and preview s three are not fixture gaps

MEASURED 2026-08-26 for `plan:walk seq:44`, by rendering all 21 screens in the app over `.demo-corpus` and all 21 mockup sections in one browser, collecting element KINDS by the gate s own rule, and diffing.

SIX SCREENS MATCH COMPLETELY -- coverage, status, work, port, tut, learn. Fourteen do not, for 78 missing kinds in total.

    simulate 15 · watch 9 · graph 8 · capture 7 · config 7 · gaps 6 · injected 6
    docs 4 · preview 3 · ask 3 · doctor 3 · decay 2 · proc 2 · packs 2

AND THE FIRST FINDING IS THAT PREVIEW S THREE ARE NOT FIXTURE GAPS AT ALL, which is what seq:44 assumed of them:
  `span.prop` -- the PROPOSED badge. An ACCEPTED DIVERGENCE by the owner s ruling of 2026-08-23: the mockup keeps the historical record of what was proposed, the app reports what exists. It is in five screens ledgers for the same reason.
  `span.chip` -- a bare chip in the tier ribbon s `.rlabel`, for the `index` tier. Also already registered as a divergence.
  `i` -- one `<i>not reached</i>` inside `preview.whyn`. The string grammar in `lib/i18n.js` has three markers and NO EMPHASIS MARKER, so no string table can carry it. A CODE gap with its own task (`TASK-the-string-grammar-has-no-bold-run-so-three-of-the-mockup`), not a data one.

SO SEQ:44 S PREMISE FOR PREVIEW IS DISCHARGED: none of its three is waiting on the fixture, and no fixture change can close them. That is worth knowing before spending a fixture rewrite on the screen that motivated one.

THE MEASUREMENT ITSELF IS THE REUSABLE PART. Two `page.evaluate` passes, one per file, collecting `tag.class1.class2` with classes sorted and hidden elements skipped -- the same rule `COLLECT_KINDS` uses, so the numbers are comparable with the gate rather than merely similar to it. Repeat it before and after any fixture change; the diff is the evidence.
