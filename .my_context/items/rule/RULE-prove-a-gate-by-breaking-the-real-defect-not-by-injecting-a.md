---
id: RULE-prove-a-gate-by-breaking-the-real-defect-not-by-injecting-a
type: rule
title: Prove a gate by breaking the real defect, not by injecting a synthetic one
status: active
severity: hard
always: false
summary: To prove a check works, put the original fault back and watch it go red; a made-up bad case only shows the measuring works, not that it looks in the right spot.
summary_of: c88e6d76e322c1ed
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 21d108efb3ac2f99
directive: do
---

# Prove a gate by breaking the real defect, not by injecting a synthetic one

An anti-vacuity test that feeds a fabricated bad case to the measuring function proves the INSTRUMENT works. It says nothing about whether the walk that feeds the instrument ever reaches the real subject, and those are different failures — the instrument is rarely the broken part.

The only proof that a gate would have caught the defect it was written for is to reintroduce that defect and watch it go red. Where the fix is a one-line change, this costs a minute; where it is not, the difficulty of reintroducing it is itself information about the gate.

Keep the synthetic case as well: it bounds the instrument. It is not a substitute for the real one.

## Relations
- derived_from [[LESSON-a-ui-gate-must-reach-the-state-the-defect-lives-in-not]]
