---
id: DEC-the-three-mockup-parity-browser-specs-are-retired-screen
type: decision
title: "the three mockup-parity browser specs are retired: screen-parity, pixel-parity and tree-parity"
status: active
severity: soft
always: false
summary: Three automated browser checks that compared the live interface against an old design drawing are removed, because the drawing is a record of early thinking and a difference from it is not a defect.
summary_of: 9d40458fb5f3a32b
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-23
valid_until: null
checksum: 9f8fb504c4417c42
---

# the three mockup-parity browser specs are retired: screen-parity, pixel-parity and tree-parity

Owner ruling B, 2026-09-21 (release prompt, OWNER ANSWERS), landed in release phase 3 on 2026-09-22 in commit 0e074059. e2e/screen-parity.spec.ts, e2e/pixel-parity.spec.ts and e2e/tree-parity.spec.ts are deleted. They measured the app against docs/design/web-ui-mockup.html, which DEC-the-mockup-is-a-reference-to-initial-thoughts-and-only-a made a reference to initial thoughts rather than a target, and which DEC-the-mockup-is-a-frozen-reference-it-is-read-never-written froze. test/ui/styles-parity.test.ts stays: it compares the two string tables and the stylesheet with each other, not with the mockup. The CI step named browser suite against the mockup is renamed browser suite and its comment says what the suite drives. Closes the retirement half of task 3.9 (B4); cites TASK-two-browser-gates-are-red-before-any-lane-touches-them-and and TASK-forty-six-browser-failures-are-recorded-as-unknown-so-the.

## Relations
- derived_from [[DEC-the-mockup-is-a-reference-to-initial-thoughts-and-only-a]]
- relates_to [[TASK-two-browser-gates-are-red-before-any-lane-touches-them-and]]
