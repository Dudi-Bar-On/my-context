---
id: TASK-disclose-where-cli-and-ui-coverage-differ-derived-from-the
type: task
title: disclose where CLI and UI coverage differ, derived from the command registry and route table
status: active
severity: soft
always: false
summary: Show which CLI commands have no UI equivalent, generated from the running program rather than written by hand.
summary_of: 015ae53c44786c68
scope:
  - scripts/gen-commands.ts
  - src/cli/commands/registry.ts
  - src/ui/server.ts
tags:
  - v2
  - ui
  - documentation
  - cli
  - "plan:docsys"
  - "seq:7"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-my-context/595db3b1-a481-4553-b4c0-7248c31b2655/scratchpad/docsys/7.md"
source_anchor: null
source_checksum: 88d584cd8bca7b76
valid_from: 2026-09-05
valid_until: null
checksum: f02d39d3c96d4074
plan: docsys
seq: "7"
state: todo
priority: "3"
needs: docsys/5
---

# disclose where CLI and UI coverage differ, derived from the command registry and route table

> Found 2026-09-05 under `reports/2026-09-05-documentation-screen-definition.md`, researching the
> Documentation screen for `REQ-the-two-readmes-are-the-base-of-a-documentation-system-that`, whose
> own text requires: "cover every single piece of the app, using the CLI and using the UI … Where a
> capability exists on one surface and not the other, the documentation says so, because a reader
> needs to know which can do what." Builds
> `docs/superpowers/specs/2026-09-05-documentation-screen-design.md` §3.
>
> WHAT IS MISSING: nothing in this corpus states, anywhere, which CLI commands have a UI equivalent
> and which do not. `docs.js`, `learn.js` and the mockup's `nav.read` group are all silent on this;
> the UI is read-only by design (`mycontext ui`'s own description), so most of the CLI's mutating
> commands necessarily have no UI action, and that fact is nowhere disclosed to a reader comparing
> the two surfaces.
>
> WHAT THIS TASK BUILDS: a small generation script, in the shape of `scripts/gen-commands.ts`, that
> walks the CLI command registry (`COMMANDS` in `src/cli/commands/registry.ts`, plus the seven names
> the hardcoded switch in `src/cli/index.ts` dispatches, exactly the union
> `test/docs/inventory.test.ts` already assembles for its own purposes) and the UI's own route table
> (`registerReadRoutes` in `src/ui/server.ts`), and produces one row per CLI command naming whether an
> equivalent UI action exists — a route that reads the same data, or explicitly none. Wired into the
> `npm run gen:docs` family rather than invented as a fourth, separate generator with its own
> invocation.
>
> NEEDS: docsys/5 (needs a screen location to render the table); does not need docsys/6 (an
> independent axis — language parity and surface parity are different facts about a document).
>
> VERIFICATION: the coverage-derivation test named in the spec — a manually-added CLI command with
> no UI equivalent is asserted to render as explicitly uncovered, never silently absent from the
> table, the same "measured zero, named" discipline the rest of this screen now follows.
