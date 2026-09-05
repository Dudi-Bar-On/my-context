---
id: TASK-get-api-doc-colon-id-serves-one-tutorial-by-manifest-id
type: task
title: GET api doc colon id serves one tutorial by manifest id
status: active
severity: soft
always: false
summary: A new endpoint serves one tutorial's markdown by a manifest-assigned id, so no path from the browser ever reaches the filesystem.
summary_of: 4fc558db3e1f14e2
scope:
  - src/ui/server.ts
  - src/ui/read-model.ts
tags:
  - v2
  - tutorials
  - ui
  - docs
  - security
  - "plan:tuts"
  - "seq:3"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 29fbcbad3481a97c
plan: tuts
seq: "3"
state: todo
priority: "2"
needs: tuts/1
---

# GET api doc colon id serves one tutorial by manifest id

Step 3 of six in docs/superpowers/plans/2026-09-05-tutorials-are-served-and-browsed.md. Needs the manifest from tuts/1.

The tutorial-scoped instance of DEC-markdown-is-served-from-a-manifest-rendered-by-one-renderer, applied rather than re-decided: the server globs docs/tutorials/*.md and *.he.md at start, keyed by the manifest's own stable ids, and answers GET /api/doc/:id?lang=en|he. An id not in the manifest is refused by name, the same shape every other route on this server refuses in; a ../ or absolute-path id is a test case, refused as an unknown id rather than resolved. lang=he with no Hebrew file is refused by name too -- never a silent fallback to the English file, per the spec's no-toggle-that-falls-back rule.

This is the route half of what TASK-serve-markdown-documents-to-the-ui-behind-a-decided-boundary (plan:walk seq:25) decides for markdown generally, scoped first to the tutorial files. It does not close walk/25, which stays open for the wider docs/ and reports/ corpus.
