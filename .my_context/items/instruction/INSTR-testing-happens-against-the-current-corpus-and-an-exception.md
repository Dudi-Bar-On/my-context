---
id: INSTR-testing-happens-against-the-current-corpus-and-an-exception
type: instruction
title: Testing happens against the current corpus, and an exception is asked for before it is taken
status: active
severity: hard
always: false
summary: Tests and verification run against this project real corpus rather than a fixture, and any exception is approved by the owner in advance.
summary_of: ffc2b0db8e385107
scope: []
tags:
  - dogfooding
  - testing
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-03
valid_until: null
checksum: eaa7972eccdbc10e
---

# Testing happens against the current corpus, and an exception is asked for before it is taken

Owner ruling, 2026-09-03, in his own words: "all your tests would be on the current corpus because we are doing dog fooding, if you need an exception you should ask me first to approve".

WHAT CHANGES

Verification runs against this repository own corpus. Not a fixture, not a seeded demo workspace, not a copy made for the occasion. That includes the browser suite, which is hardwired to `.demo-corpus` today and therefore does not comply.

An exception is available and it is asked for FIRST. The asking is the rule: taking an exception and reporting it afterwards is the same as not having one.

WHY IT WAS RESTATED

It was already a requirement. `REQ-the-web-ui-is-dogfooded-against-this-corpus-and-the-e2e`, 2026-08-22, says it in the same words: this repository own corpus is what the UI displays and manipulates, not a fixture and not a seeded demo workspace. It was restated because a fix was declared landed on the strength of a green browser spec that ran against `.demo-corpus`, and the owner found the feature broken on his own screen within a minute of looking. A suite that passes on simulated data has proved something about simulated data.

WHAT IT DOES NOT LICENCE

It does not licence writing to the corpus to see what happens. The neighbouring rule about probes is about the SESSION rather than the corpus: a probe must not write injection or session records, because those become the newest rows and every latest-N reader believes them. Reading the live corpus, and running commands against it that a user would run, is the point. Manufacturing records in it is not.

THE DISTINCTION THAT MAKES BOTH TRUE

Verification asks does this feature work for a person, and can only be answered on the thing the person uses. A probe asks how does this mechanism behave, and its records are litter. The first belongs here. The second belongs in a temporary workspace.

## Relations
- supersedes [[DEC-the-ui-is-developed-against-a-simulated-corpus-until-the]]
- supersedes [[TASK-give-the-demo-corpus-a-continuity-item-and-remove-the-two]]
- supersedes [[NOTE-what-the-fixture-must-hold-screen-by-screen-for-the]]
- supersedes [[NOTE-the-doctor-fixture-needs-findings-at-all-three-severities]]
