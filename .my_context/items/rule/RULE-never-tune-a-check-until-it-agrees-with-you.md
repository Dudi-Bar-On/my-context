---
id: RULE-never-tune-a-check-until-it-agrees-with-you
type: rule
title: Never tune a check until it agrees with you
status: active
severity: hard
always: false
summary: When a check disagrees with you, ask whether it is measuring the right thing; never loosen it, delete the awkward entry, or retry until it agrees.
summary_of: 00e10bfb0f2da55e
scope: []
tags:
  - v2
  - method
  - governance
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: d897064629d7142f
---

# Never tune a check until it agrees with you

When a check disagrees with you, the first question is whether it is measuring the right quantity - never how to make it agree.

THE TWO CASES THAT SET THIS

A containment assertion reported .plane.l at 421px inside a .pair of 418px and failed. Three pixels. Widening the tolerance would have taken ten seconds and been wrong: getBoundingClientRect returns the axis-aligned box of an element's PROJECTION, and that plane is rotated under a 1600px perspective, so its near edge scales up. The question was whether the LAYOUT box escaped its frame, and offsetHeight answers exactly that. Same check, right quantity, no tolerance needed.

An element-kind ledger measured 15 gaps on the watch screen, 8 an hour later, then grew again when the pulse's twenty-minute window emptied. Deleting the entries would have made it green. What it actually needed was to say that this screen's gaps follow the audit log rather than the code, so its ledger is a ceiling rather than an exact match - and to file the fixture corpus that removes the ambiguity for good.

DO

Ask what the number means before adjusting it. A three-pixel disagreement had a physical explanation and finding it took one measurement.
Change the quantity, not the threshold, when the quantity is wrong.
Record the exemption where the next reader will meet it, with the measurement that justified it, if an exemption is genuinely right.
Make an assertion RED first, deliberately, before trusting it. Every layout assertion added in this session was watched fail against the broken page. One demanded a pulse taller than 20px and would have failed the design of record itself, which measures 8.

DO NOT

Do not widen a tolerance to swallow a disagreement you have not explained.
Do not delete a ledger entry to reach green. The entry is a task somebody owes; deleting it without building the thing is the one edit that makes the ledger worse than nothing.
Do not shorten a wait until a test passes. Sampling a half-drawn screen wrote a ledger full of gaps that did not exist, and two assertions passed alone and failed in the pack for the same reason. A test that passes alone and fails under load is not flaky, it is wrong.
Do not add retries. This suite runs at retries 0 deliberately: a browser test that passes on the second attempt has told you something.
