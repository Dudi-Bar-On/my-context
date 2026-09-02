---
id: OPENQ-which-screen-hosts-the-markdown-viewer-and-what-may-the
type: open_question
title: which screen hosts the markdown viewer, and what may the server serve
status: superseded
severity: soft
always: false
summary: An unsettled question about where a document viewer should live in the interface and which files the server may be allowed to serve.
summary_of: d85efcf72903dfd1
scope: []
tags:
  - v2
  - ui
  - documentation
  - security
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: 2026-08-26
checksum: 353277702e90db2b
blocks: the markdown viewer, and the route that would feed it
---

# which screen hosts the markdown viewer, and what may the server serve

Raised 2026-08-25 with the requirement that markdown documents are browsable and viewable.

TWO QUESTIONS, and the second is a security boundary rather than a detail.

WHERE DOES IT LIVE? Three homes have a claim:
- COVERAGE, whose detail pane already selects a file and answers what governs it. The spec merged the file browser into it precisely so there would not be two trees. Adding "and read it" is one more answer in a pane that already answers questions about the selected file.
- DOCS, which already owns the renderer and the `.md` CSS.
- THE ITEM PANE, reached from a citation -- the reader is looking at an item that cites a document, and wants the document.
The owner did not remember which menu item it was meant to be, and it is in none of them, so this is a fresh choice rather than a recovery.

WHAT MAY IT SERVE? No route serves an arbitrary path today, deliberately. `docs.js` records that `README.md` is unreachable because it sits outside `src/ui/public/`, and the read server s whole route table is enumerated in `registerReadRoutes`. Serving repository files needs a route that takes a path from a client, which is the classic traversal surface.

Candidate boundaries, none chosen: only paths `watchedDocs` matches; only paths some item CITES; only files under the corpus root; any tracked file under the repository root. Each is a different promise and a different test.

BLOCKS the viewer task of the same date.

## Relations
- superseded_by [[DEC-the-markdown-viewer-lives-in-coverage-and-renders-by-id]]
