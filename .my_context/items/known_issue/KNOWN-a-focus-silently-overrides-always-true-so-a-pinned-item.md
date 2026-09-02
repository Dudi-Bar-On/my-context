---
id: KNOWN-a-focus-silently-overrides-always-true-so-a-pinned-item
type: known_issue
title: "a focus silently overrides always:true, so a pinned item stops being pinned"
status: active
severity: soft
always: false
summary: Narrowing what gets shown also drops items marked to appear every time, and nothing says which of those promised items went missing.
summary_of: 252b21c39c0ce5c8
scope: []
tags:
  - v2
  - injection
  - focus
  - owner-blocking
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: ce08101268cc7750
---

# a focus silently overrides always:true, so a pinned item stops being pinned

MEASURED 2026-08-27, and it is the real cause of a thing that was misdiagnosed twice before it was measured properly.

THE SYMPTOM: the newest SessionStart delivered **16 of 23** pinned items, and nothing said so.

THE FIRST (WRONG) DIAGNOSIS, mine: that the pinned tier exceeded its budget. I computed 17,237 tokens against 16,000 from RAW FILE BYTES including frontmatter, over 23 items including one that is superseded. **The shipped estimator says 14,876 against 16,000 — 93%. Nothing spills.** A measurement taken with a different instrument from the one the product uses is not a measurement of the product.

THE ACTUAL CAUSE: an active FOCUS.

    focus set 2026-08-24T13:42:47.811Z by human · tags: plan:walk
    114 item(s) in focus, 467 hidden

`focusHides` exempts `severity: hard` and **does not exempt `always: true`**. So six pinned items whose severity is soft are hidden by the focus, and a seventh is `status: superseded`. The six:

  - INSTR-query-and-display-the-task-item-before-starting-and-after
  - INSTR-the-mockup-is-the-ui-specification-build-it-exactly-and-ask
  - INSTR-use-my-context-for-everything-you-need-to-remember-read-what
  - REQ-restore-the-graphical-views-the-design-sketches-already
  - RULE-always-return-the-working-tree-to-master-when-work-is-not-in
  - STD-v2-0-progress-report-and-the-format-progress-reports-use

WHY THIS IS A CONTRADICTION AND NOT A TRADE-OFF. `always: true` means *every session, regardless*. A focus NARROWS what is injected. Narrowing something whose entire meaning is "regardless" is a contradiction, and the product resolves it silently in favour of the focus — for three days, in this case.

**AND THE CONSEQUENCE IS EXACTLY THE ONE THAT HIDES ITSELF.** Among the six is the instruction to use my_context for everything and the instruction to display the task item before and after work. The corpus hid the instructions that would have said they were not being followed. When the owner asked whether they were reaching the assistant, the honest answer turned out to be no, and the reason had been in place since before the question.

THE DISCLOSURE IS ALSO WRONG-SHAPED. The audit note says `focus hid 467` — one count, mixing six pinned items in with 461 ordinary ones. A pinned item hidden by a focus is a different fact from an ordinary item hidden by a focus, and only one of them is a broken promise.

TWO ANSWERS, and they are not alternatives:

  1. **`focusHides` exempts `always: true` the way it exempts `hard`.** This is a behaviour change affecting what EVERY session receives and needs the owner. The argument for it: `always` is already the strongest claim an item can make about its own delivery, and a focus is a working convenience.
  2. **Whatever is decided, it must be SAID.** A pinned item hidden by a focus is named on stderr and recorded distinctly, the same way `plan:budget seq:1` now names one dropped by a budget. Even if the ruling is that a focus may hide a pinned item, the silence is indefensible.

IMMEDIATE WORKAROUND, and it is one command: `mycontext focus --clear` restores all six at the next session start.
