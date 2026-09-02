---
id: DEC-the-markdown-viewer-lives-in-coverage-and-renders-by-id
type: decision
title: the markdown viewer lives in Coverage, and renders by id rather than by path
status: active
severity: soft
always: false
summary: Documents are read on the page that already lists them, and only ones already on that list, so a page can never ask to open just any file.
summary_of: 5a31c725cac500cf
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - security
  - design
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-26
valid_until: null
checksum: 500f7afa5e5ca465
---

# the markdown viewer lives in Coverage, and renders by id rather than by path

OWNER RULING, 2026-08-26, answering `OPENQ-which-screen-hosts-the-markdown-viewer-and-what-may-the` -- both halves of it.

WHERE IT LIVES: COVERAGE. Its detail pane already selects a file and answers what governs it; the spec merged the file browser INTO Coverage precisely so the product would not grow a second tree, and "and read it" is one more answer in a pane that already answers questions about the selected file. Docs and the item pane were both declined as HOMES -- but see the requirement below, because rendering is not the same question as browsing.

WHAT THE ROUTE MAY SERVE: ONLY WHAT `watchedDocs` MATCHES, AND THE CLIENT SENDS AN ID, NEVER A PATH. The server enumerates the watched documents itself and hands out an opaque id per document; the client sends that id back. There is no path on the wire, so there is no traversal to defend against -- the boundary is enforced BY CONSTRUCTION rather than by validating a string, which is the distinction that matters here. This is the narrowest boundary that still satisfies "documents are browsable", and it is the same list Coverage already shows, so the viewer cannot drift from the browser.

THE THREE WIDER BOUNDARIES WERE DECLINED and it is worth saying why, because each looks reasonable: "anything an item cites" makes the allowlist only as trustworthy as item bodies, and item bodies are text that people AND AGENTS write; "any file under the corpus root" serves `items/`, `state/` and the audit log through a browser route; "any tracked file" turns the route into a general repository reader, where one traversal bug exposes the whole checkout instead of a document list.

## Relations
- supersedes [[OPENQ-which-screen-hosts-the-markdown-viewer-and-what-may-the]]
