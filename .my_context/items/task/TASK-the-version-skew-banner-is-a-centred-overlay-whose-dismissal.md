---
id: TASK-the-version-skew-banner-is-a-centred-overlay-whose-dismissal
type: task
title: the version-skew banner is a centred overlay whose dismissal does not survive the next re-render
status: active
severity: soft
always: false
summary: A warning sits over the content, and closing it only lasts until the page next redraws itself.
summary_of: c5ff6e3e350de8ec
scope:
  - src/ui/public/app.js
  - src/ui/public/styles.css
tags:
  - v2
  - ui
  - banner
  - dismissal
  - "plan:rulings"
  - "seq:83"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 9cdbc3cb476f3f9a
plan: rulings
seq: "83"
state: todo
priority: "3"
---

# the version-skew banner is a centred overlay whose dismissal does not survive the next re-render

Raised by report 1 (`reports/2026-09-12-the-ui-reviewed-as-a-user.md`, 3.3) as row 98 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. The version-skew banner is a fixed centred overlay over the content area. It is dismissible, AND IT IS REDRAWN ON THE NEXT RE-RENDER -- so dismissing it does not dismiss it. During report 1's cold load it was the only thing on screen.

TWO THINGS HAVE CHANGED SINCE, and both are recorded so nobody re-measures them:
- Report 2 DID NOT REPRODUCE IT, because no lane was editing `src/ui/public/**` during that session. So it is a real condition with a known trigger, not an intermittent mystery.
- Its `color-contrast` failure NOW PASSES.

What remains is the shape: a dismissal that does not persist, and an overlay rather than a strip.
