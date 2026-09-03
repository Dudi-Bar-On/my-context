---
id: TASK-serve-markdown-documents-to-the-ui-behind-a-decided-boundary
type: task
title: serve markdown documents to the UI, behind a decided boundary
status: active
severity: soft
always: false
summary: Let the app browse and read the project's own documents, from a list the server builds itself so nobody can ask it for an arbitrary file.
summary_of: 95dd23171800c56e
acknowledged:
  - body_disagrees_with_meta@4e877acc112308aa
scope: []
tags:
  - v2
  - ui
  - documentation
  - api
  - "plan:walk"
  - "seq:25"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 3362b314a80926eb
plan: walk
seq: "25"
state: todo
priority: "2"
source: REQ markdown documents are browsable and viewable
needs: walk/37
---

# serve markdown documents to the UI, behind a decided boundary

Carries out the requirement that markdown documents are browsable and viewable. ANSWERED 2026-08-28 by DEC-markdown-is-served-from-a-manifest-rendered-by-one-renderer. The server may serve a SERVER-BUILT MANIFEST and nothing else: it globs a document set at start, gives each a stable id, and answers /api/doc/:id. No client-supplied path ever reaches the filesystem, so the ../, absolute-path and symlink tests listed below become unreachable rather than passed -- the closed set that made the four help topics safe is kept and merely made larger. The Contents list IS the manifest, and stable ids give the deep link this task records as its unlanded half. Still open, and a DESIGN question rather than a security one: which screen hosts the viewer.

THE RENDERER GOES FIRST -- an owner ruling, carried as `needs: walk/37`. That task has since closed, and it closed WITHOUT a blockquote branch: `bodyNodes()` now delegates to `markdownNodes`, the mockup s own renderer, and neither has one. This project's own documents use tables, lists, block quotes and rules throughout, so the first document opened would still print some of its own markdown source mid-page. That is a caution to carry into the build rather than a person to wait for.

THE ROUTE IS THE HARD HALF. Today the read server serves exactly what `registerReadRoutes` enumerates, and the only markdown it answers is `/api/help/:topic` over a CLOSED SET OF FOUR. That closed set is why no traversal check was ever needed. A route that takes a path from a client is a different kind of route and needs:
- the boundary the open question settles, enforced where the path is RESOLVED and not where it is received
- a test with `../` in it, and one with an absolute path, and one with a symlink if this platform can make one
- a refusal that NAMES what it refused, in the shape every other refusal on this server takes

THE VIEWER IS THE EASY HALF: `markdownNodes` already exists and is already the mockup s own renderer, branch for branch, with images and unknown URL schemes refused rather than silently dropped. Point it at the document.

MIND WHAT THE SUBSET CANNOT DO. Measured 2026-08-25 on the one topic it serves today: pipe tables, block quotes, ordered lists, horizontal rules, setext headings and h4+ all fall through to paragraphs carrying their own source, and single-asterisk emphasis reaches the screen as literal asterisks. Real repository documents use all of those. Whatever is decided about the renderer applies here first and hardest.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, blocked on the owner, and the block is a SECURITY question rather than a design one -- which is worth stating plainly before the sitting: a markdown route is a path-traversal surface, and the only markdown route today serves exactly four hard-coded help topics.

IT IS THE ROUTE HALF OF plan:port seq:5c, now superseded into the documentation programme. seq:5c also carries a second unlanded half that belongs here: THE DEEP LINK. #/docs/4 is not a route the router parses, and the mockup draws no control on the Contents list. A document viewer that cannot be linked to is half a feature.

AND ITS ORIGIN SHOULD SURVIVE: this exists because the owner REMEMBERED asking for it months ago, and a search of all requirements, rules, tasks, seven specs, the plans and the mockup s 21 sections found it in NONE of them. Recovery by memory is not a mechanism -- LESSON-a-requirement-given-in-conversation-and-never-captured-is-a.

## Relations
- supersedes [[TASK-dv-sub-and-the-spec-say-docs-renders-the-readme-and-no]]
