---
id: TASK-owner-ruling-needed-which-screen-hosts-the-document-viewer
type: task
title: "owner ruling needed: which screen hosts the document viewer, Coverage or Documentation"
status: active
severity: soft
always: false
summary: Two live owner decisions name different homes for the same unbuilt document viewer; the owner needs to pick one before either can be built.
summary_of: 3d226622e36a971a
scope: []
tags:
  - v2
  - ui
  - documentation
  - "screen:docs"
  - "screen:coverage"
  - owner-ruling
  - "plan:docsys"
  - "seq:2"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-my-context/595db3b1-a481-4553-b4c0-7248c31b2655/scratchpad/docsys/2.md"
source_anchor: null
source_checksum: 6885fd9424038de7
valid_from: 2026-09-05
valid_until: null
checksum: 5151da5299328d76
plan: docsys
seq: "2"
state: done
priority: "1"
verified_on: 2026-09-05
---

# owner ruling needed: which screen hosts the document viewer, Coverage or Documentation

> Found 2026-09-05 under `reports/2026-09-05-documentation-screen-definition.md` §5, researching the
> Documentation screen for `REQ-the-two-readmes-are-the-base-of-a-documentation-system-that`.
>
> Two owner rulings, eight days apart, name two different homes for the same unbuilt document
> viewer, and neither claims to reverse the other.
>
> `DEC-the-markdown-viewer-lives-in-coverage-and-renders-by-id` (2026-08-26): "WHERE IT LIVES:
> COVERAGE … Docs and the item pane were both declined as HOMES." `src/ui/public/screens/coverage.js`
> confirms this target is still live: a file tree with a "what governs" detail pane
> (`groupByKind(node.governs)`).
>
> `DEC-markdown-is-served-from-a-manifest-rendered-by-one-renderer` (2026-08-28): "the Contents list
> the mockup already draws IS the manifest" — the Contents list is `docs.js`'s own card, on the
> screen declined two days earlier — and its own "What this does not decide" section says plainly:
> "Which screen hosts the viewer … is a design question … the mockup's Contents list is the obvious
> candidate." It observes a coincidence; it does not rule.
>
> A second, narrower disagreement rides along: `REQ-a-repository-document-is-viewable-in-the-ui-only-once-it-is-part-of-the-corpus`
> (2026-08-26) scopes the manifest to what `watchedDocs` names; the 2026-08-28 decision's own
> example set is wider — "58 markdown documents under `reports/` and `docs/`" — and does not
> mention the corpus-membership requirement at all.
>
> Neither is a coarse contradiction (both describe the same feature); both are unresolved choices
> this delegated pass is not authorised to make (`STD-the-precedence-order-when-four-sources-of-truth-disagree`:
> "a contradiction found and named is a finding … never resolve a conflict by deleting the loser").
>
> WHAT IS NEEDED: the owner reads both decisions side by side and rules (a) which screen hosts the
> viewer, Coverage or Documentation, and (b) whether the manifest stays `watchedDocs`-scoped or
> widens to a `reports/`+`docs/` glob. `docs/superpowers/specs/2026-09-05-documentation-screen-design.md`
> is written on the assumption "Documentation, watchedDocs-scoped" because the fuller requirement
> record leans that way, and names itself as provisional pending this ruling.
>
> BLOCKS: docsys/4 through docsys/8, all of which are written against whichever screen and boundary
> this ruling settles.
