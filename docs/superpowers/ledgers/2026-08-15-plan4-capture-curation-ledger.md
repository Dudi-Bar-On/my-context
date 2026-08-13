# SDD ledger — plan: docs/superpowers/plans/2026-08-15-my-context-capture-curation.md

Spec: `docs/superpowers/specs/2026-08-12-my-context-design.md` (binding authority).
Baseline: `98f64d1`, **605 tests** green, tsc clean.

The plan was amended before execution (`5208d7c`) against eleven pre-flight rulings; the prerequisite
code changes those rulings required are merged (`3a17af8`, `521bf95`, `811ea4d`, `3f2c7a5`). The
pre-flight scan itself, with all eleven rulings and their reasoning, is in the merge commit history
and in the amended plan's own prose. Highlights worth carrying: ingestion was structurally impossible
against the shipped `createItem`; `trustedStatus` had no `ingest` row and would have let ingested
constraints govern immediately; Task 7 was written against an MCP module that never existed.

## Standing instructions from the user for this plan

**S1 — Dogfood intensively, after every task.** Once a task's review is clean, capture that task's
real normative knowledge into this repo's own `.my_context/` **through the plugin's own surfaces**
(the MCP tools or the CLI), never by hand-writing Markdown. Rationale, in the user's words: at
completion we should have a tested, reliable plugin that is genuinely used rather than merely tested.
This project has twice found defects by *running* the product that 250+ tests missed — the missing
edit path and the unreachable migration — so this is a defect-finding technique, not ceremony.
Each task's dogfooding pass must report: what was captured, through which surface, and **anything
that was awkward, impossible, or wrong** — the friction is the finding.

**S2 — Ship a user-facing command surface alongside the agent-facing tools.** The plugin must serve
the user by command and the model by tool at the same time. The user's examples:
`/add-requirement <text>`, `/list-decisions [filter]`.

- **Ruling: generate `add-<type>` and `list-<type>` per *enabled* category from one template**,
  driven by the same resolved config `mycontext_help("categories")` reads, with a test asserting the
  generated set equals the enabled set. *Why:* it gives exactly the names the user asked for, it
  cannot drift from the category table (the defect class this project keeps re-finding), and disabled
  categories get no command. Plus a small generic set — `/mycontext-search`, `/mycontext-review`,
  `/mycontext-status` — for the actions that are not per-category. `/LoadMyContext` already exists.
  *Cost if wrong:* ~34 command entries in the user's picker; flagged to the user, who can collapse it
  to a generic `/mycontext-add <type> <text>` with a one-line change to the generator.
- This is **additional scope beyond the plan's fifteen tasks** and is tracked as Task 16.
- **Namespacing (user, follow-up): commands must read `/mycontext:add…`, not bare `/add-requirement`.**
  Claude Code namespaces plugin commands by plugin name, so this is probably automatic — but
  `.claude-plugin/plugin.json` names the plugin **`my-context`** (hyphenated) while the CLI binary and
  the `.mcp.json` server key are both **`mycontext`**. Left as-is, commands land at
  `/my-context:add-requirement`. Getting the requested prefix means renaming the plugin to
  `mycontext`, which is cheap now and disruptive once installed anywhere. **Do not guess the
  namespacing rule** — this project has already been burned assuming Claude Code plugin behaviour;
  confirm it from the documentation before Task 16, and settle the plugin-name inconsistency at the
  same time.

**S3 — a production-readiness audit, AFTER everything is committed and pushed and I would declare
the plugin production grade.** The user's terms, recorded verbatim in substance so they are not
softened later:
- It runs **from `master`**, not from a feature branch.
- It uses the superpowers tooling.
- It covers **every aspect**: code review, tests, architecture, UI/UX, the help system, usability,
  refactoring — and anything else that should be checked.
- It is measured **against all requirements accumulated from the beginning of this work to the end**,
  including everything the user added along the way, and against the written codebase. That means the
  original brainstorm, the spec, all four plans, and every requirement raised mid-flight — the
  tabular output with detail levels, domain grouping, session focus controls, granular filters that
  respect dependency structure, run-time audit logging that does not rely on git, the answered-question
  lifecycle, the dogfooding requirement, and the user command surface.
- Subagents must be configured **`model: fable`, `effort: xhigh`**. Note: the Agent tool exposes
  `model` but not `effort`; only the Workflow tool's `agent()` takes both. So honouring this as
  written means orchestrating the audit through Workflow — which the user has now explicitly
  requested in their own words, satisfying the opt-in requirement.
- Output: **a very detailed report plus an executive plan** for how to fix and improve, grounded in
  each area's foundations.

This is a standing instruction for after Plan 4 and Task 16 land. It is not optional and it is not
to be quietly folded into an ordinary final review.

## Rulings

- **Ruling (scope): the command surface is Task 16, executed after Task 15, not woven through.**
  *Why:* it depends on the command registry Task 6 builds and on `review`/`status` from Tasks 10 and
  15, so building it earlier means building it twice. — *Cost if wrong:* the user waits for the
  command surface until the plan's end; the MCP surface already works today.

## Progress

