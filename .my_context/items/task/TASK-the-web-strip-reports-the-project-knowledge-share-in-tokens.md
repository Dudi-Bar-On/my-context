---
id: TASK-the-web-strip-reports-the-project-knowledge-share-in-tokens
type: task
title: the web strip reports the project-knowledge share in tokens while the terminal reports a percentage
status: active
severity: soft
always: false
summary: Two surfaces show the same share in different units, so a reader cannot carry a figure from one to the other.
summary_of: 08825b77f0e2b446
scope:
  - src/ui/public/app.js
  - src/ui/public/strings/en.js
  - src/ui/public/strings/he.js
tags:
  - v2
  - ui
  - statusline
  - "plan:live"
  - "seq:18"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 439b213b5e263ec5
plan: live
seq: "18"
state: done
priority: "3"
verified_on: 2026-09-04
---

# the web strip reports the project-knowledge share in tokens while the terminal reports a percentage

Owner reported 2026-09-04: the MYCTX figure on the web status bar does not show the percentage the terminal status line shows.

Measured. The terminal computes and prints a percentage, tokens over the window. The web strip renders strip.myctx, which reads tokens of it from project knowledge and an injection count, with no percent anywhere in the sentence.

The percentage is not missing from the data. The strip already draws a bar banded at sixty, seventy and eighty percent of the window, and its own tooltip says so, so the figure exists and is simply never written as a number.

The cost is small but real: a reader who watches one surface cannot carry a number to the other, and the two look like different measurements of different things when they are the same measurement in different units.

What to do: show the percentage on the web as the terminal does, keeping the tokens, since the absolute figure is useful and the terminal shows both too. Both languages, and keep the existing qualifier convention: a share that is at least this much rather than exactly this much already carries its mark on the partial string and must keep it.

Do not invent a second rounding. Whatever the terminal does with a fraction of a percent, the web does the same, or the two disagree at the edges and a reader is right to distrust both.
