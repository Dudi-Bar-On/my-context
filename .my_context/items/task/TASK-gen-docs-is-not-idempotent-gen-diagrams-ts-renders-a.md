---
id: TASK-gen-docs-is-not-idempotent-gen-diagrams-ts-renders-a
type: task
title: "gen:docs is not idempotent: gen-diagrams.ts renders a different SVG on every run of the same source"
status: active
severity: soft
always: false
summary: Running the documentation generator twice on an unchanged tree produces two different diagram files, so every maintainer sees a diff they did not cause and is tempted to discard someone else's.
summary_of: 700f9f1da52e4f10
scope: []
tags:
  - "plan:release"
  - "seq:11"
  - "state:doing"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-22
valid_until: null
checksum: da9b93c858fb070b
plan: release
seq: "11"
state: doing
---

# gen:docs is not idempotent: gen-diagrams.ts renders a different SVG on every run of the same source

Found by lane 1.3 on 2026-09-22 and confirmed by running gen:docs twice: six SVGs under src/ui/public/diagrams/ and src/ui/public/lib/diagrams.js differ between consecutive runs with no source change. scripts/gen-diagrams.ts:239 renders each diagram with mermaid.render inside a Playwright Chromium page; the dagre layout measures label text through the browser's text metrics, which is where sub-pixel differences plausibly enter. Closing condition: two consecutive runs of npm run gen:docs on an unchanged tree leave git status clean, proved by a test that renders one diagram twice and compares bytes, and the release cut (which runs gen:docs) produces no diagram diff. Files: scripts/gen-diagrams.ts, test/ui/diagram-gate.test.ts.
