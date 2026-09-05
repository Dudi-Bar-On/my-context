---
id: TASK-owner-ruling-needed-adopt-a-documentation-generator-or-build
type: task
title: "owner ruling needed: adopt a documentation generator, or build the index and route by hand"
status: active
severity: soft
always: false
summary: Decide whether a documentation tool is worth a fourth dependency and a build step, or whether to extend the derivation scripts already in use.
summary_of: a775391c55d7b485
scope: []
tags:
  - v2
  - documentation
  - owner-ruling
  - packaging
  - "plan:docsys"
  - "seq:3"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-my-context/595db3b1-a481-4553-b4c0-7248c31b2655/scratchpad/docsys/3.md"
source_anchor: null
source_checksum: 6af8e77d45817f0b
valid_from: 2026-09-05
valid_until: null
checksum: 2ef12aa929b7f15d
plan: docsys
seq: "3"
state: todo
priority: "1"
---

# owner ruling needed: adopt a documentation generator, or build the index and route by hand

> Found 2026-09-05 under `reports/2026-09-05-documentation-screen-definition.md` §6, researching the
> Documentation screen for `REQ-the-two-readmes-are-the-base-of-a-documentation-system-that`, which
> itself says of tooling: "the owner said a third-party tool or package may be used if required" but
> "this needs a ruling rather than a commit" — `CONST-zero-runtime-dependencies` states in its own
> words that a fourth `devDependency` (today exactly three: `typescript`, `@types/node`,
> `@playwright/test`) "is a ruling to record, never a commit to make."
>
> THE REPORT'S RECOMMENDATION, offered for the owner to accept or overturn, not self-executing:
> BUILD WITHOUT A GENERATOR, at least for the corpus-scoped documentation system R1–R11 describe.
>
> COST OF ADOPTING ONE: a fourth `devDependency` under `CONST-zero-runtime-dependencies`; very
> likely a build step, which `CONST-node-24-no-build-step` currently forbids outright ("no compile
> step and no `dist/`") — so adopting a generator changes two constraints at once, for a screen that
> already renders through a hand-written subset parser (`markdownNodes`) trusted for a security
> property (no HTML string is ever produced, so nothing needs sanitising) that a general-purpose
> generator's output is not guaranteed to preserve against this project's CSP without a fresh audit.
>
> COST OF BUILDING WITHOUT ONE: the manifest, route and index have to be hand-written (carried by
> `walk/25` and `docsys/5`), and the CLI-vs-UI coverage disclosure has to be derived by a small
> purpose-built script — not new machinery, the same discipline `scripts/gen-commands.ts` and
> `scripts/gen-doc-examples.ts` already apply to the command table and flag reference
> (`STD-documentation-is-regenerated-not-edited-to-match`).
>
> WHAT WOULD CHANGE THE RECOMMENDATION: full-text search across documents, a themed site independent
> of the app shell, or versioned docs — none of which anything gathered in the research names as
> requested. If the owner wants one of those, the generator trade becomes worth naming a specific
> tool and a measured cost for, rather than argued about in the abstract.
>
> OUTPUT NEEDED: the owner's ruling, recorded the way every other ruling in this project is —
> BEFORE any devDependency change, per the constraint's own words.
>
> BLOCKS: the exact shape of docsys/5 through docsys/8, all four assume "build without one."
