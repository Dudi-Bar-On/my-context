---
id: TASK-bring-readme-md-docs-readme-he-md-and-the-tutorial-files
type: task
title: bring README.md, docs/README.he.md and the tutorial files into the corpus, with a refresh mechanism
status: active
severity: soft
always: false
summary: A document sitting only in the repository is not viewable in the app; bring the readmes and tutorials into the corpus with staleness made visible.
summary_of: ecdd2b6d3f011f08
scope:
  - README.md
  - docs/README.he.md
  - docs/TUTORIAL.md
  - docs/TUTORIAL-ADVANCED.md
  - src/hooks/post-tool-use.ts
tags:
  - v2
  - ui
  - documentation
  - corpus
  - "plan:docsys"
  - "seq:4"
  - "state:doing"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-my-context/595db3b1-a481-4553-b4c0-7248c31b2655/scratchpad/docsys/4.md"
source_anchor: null
source_checksum: c28165a3afb8ea59
valid_from: 2026-09-05
valid_until: null
checksum: 14b2f00f66baa850
plan: docsys
seq: "4"
state: doing
priority: "2"
needs: docsys/2
---

# bring README.md, docs/README.he.md and the tutorial files into the corpus, with a refresh mechanism

> Found 2026-09-05 under `reports/2026-09-05-documentation-screen-definition.md`, researching the
> Documentation screen for `REQ-the-two-readmes-are-the-base-of-a-documentation-system-that`. Carries
> out `REQ-a-repository-document-is-viewable-in-the-ui-only-once-it-is-part-of-the-corpus`
> (2026-08-26): "Readme is in the repo but to be displayed it should also be located as part of the
> corpus even copied to there if required (when it is changed) including the hebrew version too and
> this rule is relevant also for any tutorial and document."
>
> WHAT IS MISSING, MEASURED: `README.md`, `docs/README.he.md`, `docs/TUTORIAL.md` and
> `docs/TUTORIAL-ADVANCED.md` are not in `watchedDocs` today and are not reachable through the
> corpus; `README.md` sits at the repository root, outside `src/ui/public/`, exactly as `docs.js`'s
> own header records.
>
> WHAT THIS TASK DOES: add these four documents to `watchedDocs`, and build the refresh mechanism the
> requirement's own text leaves open — "WHO REFRESHES THE COPY and WHEN … the candidates are the same
> three this project always faces: a hook on write, a check in `doctor`, or a step in `init`/`refresh`
> — and the answer has to make staleness VISIBLE rather than merely unlikely." Pick one, state the
> choice and why in the commit, and make a stale copy disclosed rather than silently served.
>
> ALSO NAME THE SIDE EFFECT the requirement itself flags: `watchedDocs` also drives the capture nudge
> in `src/hooks/post-tool-use.ts`, so adding these documents to it also makes editing them nudge
> capture — plausibly right, but a consequence to state rather than a coincidence to discover later.
>
> NEEDS: docsys/2 (confirms the manifest boundary stays `watchedDocs`-scoped rather than a wider
> glob, which changes what "bring in" means and how many documents this task actually touches).
>
> VERIFICATION: a test edits one of the four source files and asserts the corpus's record of it is
> flagged stale, not silently served the old copy; `doctor` (or whichever mechanism is chosen)
> surfaces the staleness.
