---
id: TASK-the-footer-overlaps-itself-below-1200-px-and-drops-thirteen
type: task
title: the footer overlaps itself below 1200 px and drops thirteen values with no scrollbar and no disclosure
status: active
severity: soft
always: false
summary: On a narrower window the bottom strip runs into itself and thirteen values simply disappear, with no way to scroll to them and nothing saying they are gone.
summary_of: 0e53e860a186b39b
scope:
  - src/ui/public/styles.css
  - src/ui/public/screens/parts.js
tags:
  - v2
  - ui
  - wcag
  - silent-drop
  - "plan:wcag"
  - "seq:1"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: c0b904920f89fe0d
plan: wcag
seq: "1"
state: todo
priority: "2"
---

# the footer overlaps itself below 1200 px and drops thirteen values with no scrollbar and no disclosure

FOUND INDEPENDENTLY BY BOTH UI REVIEWS, with closely agreeing numbers -- the strongest kind of evidence in the consolidation. Row 21 of `reports/2026-09-13-the-consolidated-findings.md`.

- Report 1 (`reports/2026-09-12-the-ui-reviewed-as-a-user.md`): 32 overlapping pairs at 900x800 and 13 leaf items pushed off-screen, with `overflow: hidden` on both the row and the body so there is no scrollbar to find them with.
- Report 2 (`reports/2026-09-13-the-ui-reviewed-round-two.md`), which had not read report 1's numbers: 38 pairs, and THE SAME 13 CASUALTIES by name -- `cwd`, `my-context`, `corpus`, `limits`, `5h`, `7d`. Row `scrollWidth` 1,440 against `clientWidth` 876.

WHAT IT COSTS. Below about 1,200 px the footer overlaps itself and DROPS DATA WITH NO DISCLOSURE. That is a direct breach of `INV-nothing-is-dropped-silently`, on the strip the owner glances at constantly.

WHY IT IS UNDER THIS SUBJECT RATHER THAN A LAYOUT BUG. It is measurable conformance: content that is present in the DOM and unreachable at a supported viewport width, with no mechanism to reach it.
