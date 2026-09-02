---
id: REQ-markdown-renders-wherever-markdown-is-displayed-through-one
type: requirement
title: markdown renders wherever markdown is displayed, through one renderer
status: active
severity: hard
always: false
summary: Formatted text displays properly everywhere it appears, through one shared renderer rather than a separate version per screen.
summary_of: 2e57126a72a66311
scope: []
tags:
  - v2
  - ui
  - owner-requirement
  - design
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-26
valid_until: null
checksum: 5b00579799a10025
---

# markdown renders wherever markdown is displayed, through one renderer

OWNER REQUIREMENT, 2026-08-26, given while ruling on the viewer: "the capability to show rendered markdown should be embedded everywhere a markdown content is displayed, especially when displaying items details including body etc. ... and auto render everywhere it is relevant over the app including docs and tutorials for example if they are .md files".

BROWSING AND RENDERING ARE TWO DIFFERENT QUESTIONS, and the ruling that Coverage hosts the VIEWER answers only the first. A markdown file browser belongs in exactly one place. A markdown RENDERER belongs everywhere the product puts markdown in front of a reader.

WHERE MARKDOWN IS ALREADY DISPLAYED AND MUST RENDER:
  - THE ITEM DETAIL PANE -- an item body is authored markdown. This is the case the owner named first and the one he has already caught twice.
  - THE INJECTION PREVIEW -- delivered bodies and carried blocks, fixed 2026-08-25 by delegating to `markdownNodes`.
  - DOCS AND TUTORIALS, wherever their source is a `.md` file.
  - THE VIEWER ITSELF, in Coverage.

ONE RENDERER, NOT FOUR. `markdownNodes` is the design of record s own renderer and is already the one the preview uses. A second implementation anywhere means two markdown dialects in one product and a defect fixed in one of them -- which is exactly how `preview.js` came to print `**20**` with its asterisks while the detail pane rendered the same body correctly.

AND THE CONSTRAINT THAT ALREADY GOVERNS IT: no `innerHTML`, anywhere. The renderer returns NODES, and the CSP is `style-src 'self'` -- so it stays CSSOM-only and never composes markup from text a document supplied.
