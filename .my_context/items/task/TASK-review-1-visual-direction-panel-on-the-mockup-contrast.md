---
id: TASK-review-1-visual-direction-panel-on-the-mockup-contrast
type: task
title: "review 1: visual direction panel on the mockup — contrast, palette, type scale, depth"
status: active
severity: soft
always: false
summary: "A commissioned review of the look: fix the readability failures, and bring back ranked options on colour, type and depth to choose from."
summary_of: 4e637e0e1e51a2b6
scope: []
tags:
  - "plan:review"
  - "seq:1"
  - review
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 70a4905235c91196
plan: review
seq: "1"
state: done
priority: "1"
last_change: "2026-08-21T08:19:25Z"
progress: "100"
---

# review 1: visual direction panel on the mockup — contrast, palette, type scale, depth

**Commissioned 2026-08-21. Output is a ranked decision document, not an edit.**

The owner's questions: is it the most attractive design available, are the fonts and sizes including headers right, are the colours optimal, could the palette go blue, and how far should the 3D floating-card look go.

**Read `reports/uiux/` first — a panel already ran.** Twelve experts, three adversaries, seven researchers. It measured **five contrast failures**, including gold against green at **1.04:1**, and `--faint` failing 4.5:1 in **both** themes. Whether those survived the mockup rebuild is unverified. Re-measuring is the first task, not the last.

It also already argued the depth question: shine must **earn its place by encoding meaning**; spreading the accent as a brand colour dilutes the one place it carries information; gloss, translucency and shadow **print as grey mud**; and `prefers-reduced-transparency` and `forced-colors` are not honoured.

**Two things are cheaper than they look, and the panel should know it.** The palette is fully tokenised with `light-dark()`, so a blue palette is a token swap rather than a redesign. And depth already has a foothold: `--rim-lit`, `--rim-shade`, `--sheen-top` and `--sheen-bottom` exist today.

**Two buckets, kept apart.** Contrast failures are not a matter of taste and are not ranked against preferences. Palette, type scale and depth are the owner's call and come back as ranked options with a recommendation each.

Argue from the rendered thing: drive all 21 screens through Playwright in **both languages and both themes**. The mockup is served over HTTP because the Playwright plugin blocks `file:`.

**Why now rather than later:** the mockup is the design of record and roughly 40 UI tasks are about to build against it. Changing the palette or the type scale today costs one file. After ui2 and ui3 ship screens it costs rework across all of them.
