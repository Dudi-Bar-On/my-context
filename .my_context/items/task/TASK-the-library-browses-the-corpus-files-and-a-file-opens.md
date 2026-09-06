---
id: TASK-the-library-browses-the-corpus-files-and-a-file-opens
type: task
title: the library browses the corpus files, and a file opens rendered in its own tab
status: active
severity: soft
always: false
summary: A reader can walk the corpus as folders and files and open any one of them formatted the way the documents already are.
summary_of: 0707eb070deb1a50
scope:
  - src/ui/public/screens/library.js
  - src/ui/public/doc.js
  - src/ui/read-model.ts
  - src/doctor/checks.ts
tags:
  - v2
  - ui
  - library
  - docs
  - "plan:library"
  - "seq:2"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: a02f8571ffdd267a
plan: library
seq: "2"
state: todo
priority: "3"
---

# the library browses the corpus files, and a file opens rendered in its own tab

Owner requirement 2026-09-06 (plan D13, second half).

WHAT HE ASKED FOR: a simple files-and-folders browser whose scope is the CORPUS files. A selected
file is displayed structured and nicely formatted the way the READMEs and tutorials already are -
the same renderer, the same colours, and a new browser tab.

THE RENDERING HALF IS DONE AND SHOULD NOT BE REBUILT. /doc.html renders a document with the
vendored github-markdown-css, resolves internal links or refuses to draw them, and opens in its
own tab. That is exactly what he is asking for, already shipped.

THE BOUNDARY HALF IS NOT DONE, AND IT IS A RULING RATHER THAN A BUILD. `isServableDocPath`
(src/doctor/checks.ts ~835) admits exactly three things: README.md, and anything under docs/ or
reports/ ending .md. **`.my_context/items/**` is not servable today**, so the files he wants to
browse cannot be opened by the viewer at all until that set is widened - and widening what a
server hands out is not a screen decision.

AND THERE IS A REQUIREMENT POINTING THE OTHER WAY THAT MUST BE READ FIRST.
REQ-a-repository-document-is-viewable-in-the-ui-only-once-it-is is severity HARD and says in as
many words: "The UI serves the corpus; it does not serve the checkout." Today the product does the
exact opposite - it serves docs/ and reports/, which are the checkout, and refuses
.my_context/items/**, which is the corpus. This requirement was already found to be contradicted
by apiDoc and was left standing. So this task is not asking to breach it; it is asking for the
thing that requirement describes, and the contradiction should be resolved on the record rather
than stepped over a second time.

WHAT ALREADY VIEWS AN ITEM, so the new thing is not a duplicate of it. Clicking any id anywhere in
the console opens `aside#pane` with the item’s summary, scope, tier, body and provenance -
rendered from the INDEX. A file browser shows the MARKDOWN ON DISK, frontmatter and all, which is
a different artefact answering a different question: what is actually written in the file. Both
are legitimate; the item should say which question it is answering so the two do not converge into
a worse version of either.

SCALE, measured: the corpus holds roughly a thousand item files across fifteen category folders.
A tree that renders all of them at once is the 942-option select again - one control opened the
page to 3,962 px on 2026-09-06 because a <select> cannot shrink below its widest option. Whatever
is built has to be bounded from the start rather than bounded after somebody notices.
