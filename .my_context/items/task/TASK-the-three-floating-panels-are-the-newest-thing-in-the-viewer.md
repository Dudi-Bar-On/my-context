---
id: TASK-the-three-floating-panels-are-the-newest-thing-in-the-viewer
type: task
title: the three floating panels are the newest thing in the viewer and the documents show none of them
status: active
severity: soft
always: false
summary: Document the search, navigation and copy panels with real screenshots, once all three exist.
summary_of: c54e2f6a48429a17
scope:
  - docs/capabilities/15-document-and-lane-viewer.md
  - docs/system/02-the-document-and-lane-viewer.md
tags:
  - v2
  - docs
  - ui
  - "plan:rulings"
  - "seq:100"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: fd5ee75a3ed5d28b
plan: rulings
seq: "100"
state: done
priority: "1"
needs: semantic/12,semantic/13,semantic/14
---

# the three floating panels are the newest thing in the viewer and the documents show none of them

THE OWNER, 2026-09-17: "also worth adding the last implementations of the 3 dialogs search navigate copy and their screen snapshots into the documentation".

MEASURED TODAY, and both halves are gaps:
  - The find panel is MENTIONED in five capability chapters, but the text predates its second round - the four exclusive modes, the help with fifteen worked examples, the pinned counts, the position counter and the clear button are all newer than the prose describing it.
  - THERE ARE ZERO SCREENSHOTS IN ANY ENGLISH DOCUMENT. Not one, across 17 capability chapters and 8 system documents. Meanwhile `docs/the-store.he.md` - the document the owner named as the standard - carries TEN, every one of the real tool, and he praised it.

THIS IS BLOCKED AND THE BLOCK IS REAL, not a delay. `semantic/12` and `semantic/13` are building the navigation and copy panels right now; `semantic/14` is finishing the search panel's counts, reference and clear button. Photographing two panels that do not exist, or a third that is mid-change, produces images that are wrong the day they land. The `needs:` field carries that dependency so nobody has to remember it.

WHERE IT GOES. `docs/capabilities/15-document-and-lane-viewer.md` owns the viewer; `docs/system/02-the-document-and-lane-viewer.md` owns the mechanism. Decide which carries the panels and which points at it - two documents describing one surface is the defect this project measures, and it has already been avoided once between those two files.

AND THE SCREENSHOTS ARE ENGLISH ONLY, DELIBERATELY. An English screen and a Hebrew RTL screen are different images; the Hebrew edition re-shoots rather than reuses. That is why diagrams were required to be Mermaid text and screenshots were not required at all until now: a diagram translates, a photograph does not.

EVERY SCREENSHOT IS OF THE REAL TOOL, DRIVEN. `docs/the-store.he.md` set that standard: read-only screens shot against the real store, anything that writes shot against a copy, and each image says which it was. A drawing of a screen nobody opened is the claim this project refuses.
