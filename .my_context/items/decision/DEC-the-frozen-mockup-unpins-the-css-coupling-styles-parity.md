---
id: DEC-the-frozen-mockup-unpins-the-css-coupling-styles-parity
type: decision
title: "the frozen mockup unpins the CSS coupling: styles parity becomes a one-directional presence floor"
status: active
severity: soft
always: false
summary: The styling check stops demanding an exact match with the design drawing and only requires that the agreed styling still be present in the app.
summary_of: 11495e3def7cdae3
scope: []
tags:
  - v2
  - ui
  - mockup
  - gates
  - testing
  - owner-ruling
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-test-mycontext-plugin/9e5b6b17-c186-4c93-a0a5-775b4eccd9e7/scratchpad/r2.md"
source_anchor: null
source_checksum: c163b0ff4e9473a1
valid_from: 2026-09-02
valid_until: null
checksum: 40a0582900374c8a
---

# the frozen mockup unpins the CSS coupling: styles parity becomes a one-directional presence floor

> OWNER RULING, 2026-09-02. The consequence, for the gates, of freezing the mockup.
>
> Three options were put to the owner. The one chosen: FREEZE THE MOCKUP AND UNPIN THE CSS COUPLING.
>
> **Why the two are one decision.** `test/ui/styles-parity.test.ts` asserted `assert.equal(shipped, mockup)` - byte-identically, across roughly 81 rules. That assertion is symmetric, so it did not only freeze the mockup: it froze `styles.css` too. Every change to the shipped stylesheet required an equal and opposite change to the design document, and the design document is now read-only. Left as it was, the test would have made the app's stylesheet unchangeable as a side effect of a decision about a different file.
>
> **What it becomes: a ONE-DIRECTIONAL PRESENCE FLOOR.** The check asks whether the styling the mockup declares is still present in the app. It does not ask whether the app declares anything more. Extra rules in `styles.css` are the app being more mature than the drawing, which the mockup ruling says is normal, and they stop being a failure.
>
> **The bar for the tests this touches.** The owner: "if required tests should be updated or deleted if not relevant anymore". Three things go with it, and they are the whole of the discipline.
>
> RELEVANCE, NOT CONVENIENCE. A test is changed or removed because what it asserts is no longer what the project means to promise - never because it is in the way of the change in hand. Those two look identical in a diff and are opposite in intent, so the reason is written down at the time.
>
> DELETE RATHER THAN SKIP. A skipped test is a claim nobody checks: it reads as protection in the file list, reports nothing, and survives every review because it never goes red. If it is not relevant, it goes.
>
> NAME WHAT PROTECTION IS LOST. Every weakened or deleted assertion took something with it. Here, what byte-identity caught and a presence floor will not: a shipped rule whose VALUE has drifted from the design while the rule is still present, and a declaration-order difference between the two files. The second is already a known defect shape on this repository - two byte-identical rules in the opposite order resolved differently and overflowed a plate by 28px for weeks - so it has to become someone's job under the new check rather than be assumed gone.

## Observations
- [note] Chosen from three options: freeze the design drawing and unpin the styling check, rather than keep them locked together.
- [note] A test is updated or deleted for relevance, never for convenience, and the reason is written down at the time.
- [note] Delete rather than skip: a skipped test reads as protection, reports nothing, and never goes red.
- [note] Lost protection to be re-owned: a rule whose value drifted while the rule is still present, and a declaration-order difference between the two files.

## Relations
- derived_from [[DEC-the-mockup-is-a-frozen-reference-it-is-read-never-written]]
- constrains [[TASK-carry-the-mockup-s-screen-level-css-into-styles-css-or-the]]
- constrains [[TASK-styles-parity-must-compare-what-the-cascade-resolves-to-not]]
