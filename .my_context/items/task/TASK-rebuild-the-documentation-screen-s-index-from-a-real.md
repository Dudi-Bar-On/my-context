---
id: TASK-rebuild-the-documentation-screen-s-index-from-a-real
type: task
title: rebuild the Documentation screen's index from a real manifest, with a working deep link per document
status: active
severity: soft
always: false
summary: Replace the screen's five hard-coded contents entries with a real, derived document index and a link that lands on one section.
summary_of: db8849f67a0f5787
scope:
  - src/ui/public/screens/docs.js
  - src/ui/read-model.ts
  - src/ui/server.ts
tags:
  - v2
  - ui
  - documentation
  - "screen:docs"
  - "plan:docsys"
  - "seq:5"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-my-context/595db3b1-a481-4553-b4c0-7248c31b2655/scratchpad/docsys/5.md"
source_anchor: null
source_checksum: 0debf8efe7aef23c
valid_from: 2026-09-05
valid_until: null
checksum: 24bcb1eea67c4d7e
plan: docsys
seq: "5"
state: todo
priority: "2"
needs: docsys/2,docsys/3,docsys/4,walk/25
---

# rebuild the Documentation screen's index from a real manifest, with a working deep link per document

> Found 2026-09-05 under `reports/2026-09-05-documentation-screen-definition.md`, researching the
> Documentation screen for `REQ-the-two-readmes-are-the-base-of-a-documentation-system-that`. Builds
> the screen half of `docs/superpowers/specs/2026-09-05-documentation-screen-design.md` §1-2.
>
> WHAT IS BUILT TODAY, MEASURED: `docs.js`'s `CONTENTS` array is five hard-coded literals
> (`{ordinal:1,key:'dv.t1'}` … `{ordinal:7,key:'dv.t7'}`), of which exactly one (`dv.t4`, "Scope")
> names a topic the server can serve; `RENDERED` is a single hard-coded `{topic:'scope', entry:
> CONTENTS[3]}`. There is no document picker, no derived index, and `#/docs/4` is not a route the
> shell's `route()` parses — the "deep link" half of the original `dv.sub` promise has nowhere to
> land.
>
> WHAT THIS TASK BUILDS: the manifest response (from `GET /api/doc/:id`, `plan:walk seq:25`'s route
> — this task consumes it, and does not duplicate its boundary tests, which stay `walk/25`'s) drives
> a document picker; each document's ATX headings are parsed into its own index, replacing the
> literal `CONTENTS`; `#/docs/:id/:anchor` is wired into the shell's router and lands on the selected
> document and heading.
>
> NEEDS: docsys/2 (which screen — this task assumes Documentation, the design's stated assumption),
> docsys/3 (tooling ruling — this task is written for "build without a generator"), docsys/4 (the
> documents have to be in the corpus before the manifest can name them), walk/25 (the route and its
> security boundary — filed and `state: todo`, unblocked since `walk/37` is done; this task is its
> Documentation-screen consumer, not a replacement for it).
>
> A mockup session is needed first or alongside, per
> `RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done` — this changes the screen's drawn
> structure (a picker where there was a static list) and needs the owner's look-and-feel approval,
> not only a passing test.
>
> VERIFICATION: the manifest/heading-index tests named in the spec; a browser test opens
> `#/docs/:id/:anchor` directly and asserts the correct document and heading render.
