---
id: TASK-show-per-document-whether-a-hebrew-mirror-exists-measured
type: task
title: show, per document, whether a Hebrew mirror exists — measured, never hard-coded
status: active
severity: soft
always: false
summary: Each document in the new index shows whether it has a Hebrew mirror, reusing the Tutorials screen's own to-write chip rather than a blank or a silent fallback.
summary_of: 8fb7f71ea8cdec93
scope:
  - src/ui/public/screens/docs.js
tags:
  - v2
  - ui
  - documentation
  - "screen:docs"
  - hebrew
  - "plan:docsys"
  - "seq:6"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-my-context/595db3b1-a481-4553-b4c0-7248c31b2655/scratchpad/docsys/6.md"
source_anchor: null
source_checksum: 45ca428b54f90276
valid_from: 2026-09-05
valid_until: null
checksum: 49d9f94a03766415
plan: docsys
seq: "6"
state: todo
priority: "3"
needs: docsys/5
---

# show, per document, whether a Hebrew mirror exists — measured, never hard-coded

> Found 2026-09-05 under `reports/2026-09-05-documentation-screen-definition.md`, researching the
> Documentation screen for `REQ-the-two-readmes-are-the-base-of-a-documentation-system-that`. Builds
> `docs/superpowers/specs/2026-09-05-documentation-screen-design.md` §4.
>
> WHAT IS MISSING: today exactly one document renders on this screen (`scope`, a `mycontext help`
> topic) and it has one Hebrew mirror by construction, so the parity machinery
> (`test/docs/parity.test.ts`, `dv.parity`'s "the switch self-disables when the parity test is red")
> has nothing per-document to disclose yet. Once docsys/5 lands a real document list, some entries
> will have a Hebrew mirror (`docs/README.he.md`) and some will not (the tutorials, per
> `reports/2026-08-22-DOCS-REVIEW.md`: "`docs/TUTORIAL-ADVANCED.md` has no Hebrew counterpart").
>
> WHAT THIS TASK BUILDS: `hasHebrewMirror: boolean` per manifest entry, computed by checking whether
> the document's counterpart exists on disk. A document WITH a mirror shows a plain checkmark in the
> document picker. A document WITHOUT one shows the SAME `to write` chip the Tutorials screen already
> uses (`<span class="chip warn" data-g="▲" data-t="tu.todo">`), reused rather than reinvented —
> never a blank cell, and never a silent fallback that serves English prose under a Hebrew heading,
> per `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`.
>
> DELIBERATELY DOCUMENT-LEVEL, NOT HEADING-LEVEL: a document translated for some headings and not
> others is not separately disclosed by this task — that is out of scope, matching the granularity
> `parity.test.ts` already checks structurally, named explicitly in the spec's out-of-scope section
> rather than silently narrowed here.
>
> NEEDS: docsys/5 (the document picker this renders inside).
>
> VERIFICATION: a fixture document with no `.he.md` counterpart renders the chip; a real assertion
> that no code path substitutes English prose under a Hebrew-selected document.
