---
id: LESSON-green-gates-measured-the-specification-not-the-product
type: lesson
title: Green gates measured the specification, not the product
status: active
severity: soft
always: false
summary: Checks aimed at the design instead of the thing built will always pass, and they cannot notice anything the real product gets wrong.
summary_of: 4218ae8e2bb3c2ac
scope: []
tags:
  - v2
  - ui
  - method
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 155e6e14aa6b39e9
---

# Green gates measured the specification, not the product

For six weeks every browser test in this project opened docs/design/web-ui-mockup.html over file:// - the design of record - and e2e/mockup.ts said so in its own first line: what is under test is the mockup, not an implementation. That was true and correct when src/ui/public held a placeholder shell. It stopped being true the moment the shell landed, and nobody moved the suite.

On 2026-08-22 the result was 3,824 green node tests, 33 green browser tests, seven green gates, and a page whose delivered rows rendered as a diagonal fan across four screens of scroll. Not one test had ever opened the product. The owner had to say it looked horrible while the coordinator was reporting seven green gates.

A suite pointed at the specification asserts that the specification is itself. It cannot fail for anything the product does, because it never runs the product.

WHAT MADE IT INVISIBLE

The premise was written down and then expired quietly. The header sentence stayed true-sounding long after it was false, and a reader - including the agent who wrote the next test - had no reason to doubt it. An expired premise in a comment is more dangerous than no comment, because it answers the question that would otherwise have been asked.

The same shape appeared four more times that day: styles-parity's rationale still cited a CSP that had been retired, primitives.test.ts still required a perspective the owner had removed, screen-parity's watch ledger still claimed gaps the agent had just closed, and preview.whyn still told the reader that the fix needed a stable code, printed directly beneath a ladder built on exactly that code.

THE FIX THAT MATTERED

e2e/app.ts starts the real server over the real corpus. It found the defect on its first run: div.pair at 6,471px in a 720px viewport. Then e2e/screen-parity.spec.ts compared every screen to its mockup section and found 106 missing element kinds across eleven screens - and the shape of that list was one finding, not eleven: almost every entry was a GRAPHIC. The screens drew their data and omitted their pictures.

Related: [[RULE-a-ui-change-is-not-verified-until-someone-has-looked-at-it]].
