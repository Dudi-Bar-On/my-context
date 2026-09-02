---
id: TASK-documentation-two-answers-the-design-of-record-owes-the
type: task
title: "Documentation: two answers the design of record owes the renderer — a table-alignment class, and whether the mockup refuses images as its own sentence claims"
status: active
severity: soft
always: false
summary: "Two things for the designer to settle: tables ignore the alignment their author wrote, and the design promises to refuse images while quietly showing them."
summary_of: c695aede03585365
scope: []
tags:
  - v2
  - ui
  - walk
  - "screen:docs"
  - mockup
  - "plan:walk"
  - "seq:95"
  - "state:todo"
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: 3a8ecc4757443237
plan: walk
seq: "95"
state: todo
priority: "3"
progress: "0"
source: "plan:walk seq:27, measured against src/ui/public/screens/docs.js on 2026-08-29"
---

# Documentation: two answers the design of record owes the renderer — a table-alignment class, and whether the mockup refuses images as its own sentence claims

FOUND 2026-08-29 under plan:walk seq:27, from `screens/docs.js`'s header. Both are reported there, both are the owner's to settle, and neither is in any task.

**1. PIPE-TABLE COLUMN ALIGNMENT IS PARSED AND THEN DROPPED.** The renderer recognises `:--` / `--:` and cannot honour it: the alignment needs an inline `text-align`, the server sends `style-src 'self'` with no `'unsafe-inline'`, and the design of record draws no alignment class for `tableNodes` to reach for. Every table renders start-aligned whatever the source says.

It is not a rare shape here: the header's own corpus count puts pipe tables in 75% of the four served help topics and 56.9% of the 58 documents `plan:walk seq:25`'s route will serve next -- and the `scope` topic on this very screen has two. A right-aligned numeric column that silently renders start-aligned is a table saying something the author did not write.

THE ANSWER IS A CLASS, NOT A STYLE ATTRIBUTE. `.md td.end` / `.md td.center` (or whatever the design of record chooses to call them) in the mockup's `<style>` block and in `styles.css` together, byte-identical, held by `test/ui/styles-parity.test.ts` -- exactly the route `.md h4` took on 2026-08-28. Do NOT close this by emitting a `style` attribute; CSP refuses it and the refusal is the point.

**2. THE MOCKUP'S OWN RENDERER CONTRADICTS THE SENTENCE THE MOCKUP DRAWS.** `dv.mdnote` -- a string the design of record declares and this screen renders -- says images are "refused and shown as refusals, not silently dropped". The mockup's script does not refuse them: its inline pattern matches `[alt](url)` inside `![alt](url)` and leaves the `!` behind as text, so an image renders in the design of record as a LINK with a stray exclamation mark.

The app took the sentence over the script and refuses, which is the right call and is recorded as such: "a screen that claims a refusal it does not perform is worse than either behaviour". But the design of record still says one thing and does another, and it is the artefact the owner reads. Either its `mdInline` gains the image branch or `dv.mdnote` stops promising one -- and the first is almost certainly right, because an image in a page rendered by a subset renderer under this CSP is a request the product does not want to make.

BOTH ARE MOCKUP EDITS, so both are the owner's under `DEC-claude-drafts-the-mockup-and-the-owner-approves`, and both belong in the one mockup session already carrying plan:walk seq:3, seq:13, seq:20 and the rest.
