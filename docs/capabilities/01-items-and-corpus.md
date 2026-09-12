<title>Items and the corpus</title>

[← Index](./00-index.md)

# Items and the corpus

my_context's normative knowledge lives as Markdown files under `.my_context/items/<category>/<id>.md`.
Every other surface — the SQLite index, the web UI, the injected context, the CLI's `show`/`list`/`search`
— is a *read* of those files or of a table built from them. The proof, verified on this repo: the index
database sits at `.my_context/.index.db` (`resolveWorkspace` in `src/core/workspace.ts:169`, confirmed on
disk — `find . -iname "*.db"` turns up `.my_context/.index.db`, `.my_context/.audit/audit.db`, and matching
files in the `.my_context.nested-44/` and `.demo-corpus/` fixture workspaces). Deleting `.index.db` and
running `mycontext rebuild` reconstructs it from the Markdown with nothing lost — the index is a cache, the
Markdown is the source of truth. There is no second copy of a rule's *text* anywhere else in the project; a
category's job is to hold exactly one.

An **item** is one Markdown file: a frontmatter block (YAML between `---` fences) followed by a body in
prose. The id is also the filename stem, and it is generated from the title — never chosen freely — so an
id is self-describing and never has to be looked up. On this repository, real ids look like
`RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done` or
`REQ-every-category-declares-what-may-be-updated-on-its-items-and`.

## Categories: 29 shipped, 16 in use here

The task brief that requested this document names 14 categories as if that were the whole set. It is not.
`src/core/categories.ts` (554 lines) is the single source of truth, and it currently defines **29** shipped
categories, each with a name, an id prefix, a **tier** (`normative` or `rationale`), a `defaultEnabled`
flag, a one-line description, and its own extra fields. This repository's own corpus currently holds items
in 16 of the 29 (the rest are defined and available but this project hasn't populated them):

| Category | Prefix | Tier | Items on disk here |
|---|---|---|---|
| constraint | CONST | normative | 7 |
| invariant | INV | normative | 6 |
| rule | RULE | normative | 55 |
| requirement | REQ | normative | 32 |
| standard | STD | normative | 15 |
| pattern | PAT | normative | 0 |
| glossary | GLOSS | normative | 0 |
| instruction | INSTR | normative | 11 |
| non_goal | NOGOAL | normative | 3 |
| open_question | OPENQ | normative | 29 |
| runbook | RUN | normative | 0 |
| procedure | PROC | normative | 0 |
| environment | ENV | normative | 0 |
| known_issue | KNOWN | normative | 32 |
| exception | EXC | normative | 0 |
| contract | CONTRACT | normative | 0 |
| adr | ADR | rationale | 3 |
| decision | DEC | rationale | 99 |
| lesson | LESSON | rationale | 43 |
| tradeoff | TRADE | rationale | 0 |
| assumption | ASSUME | rationale | 0 |
| edge_case | EDGE | rationale | 0 |
| risk | RISK | rationale | 0 |
| measurement | MEAS | rationale | 1 |
| reference | REF | rationale | 5 |
| plan | PLAN | rationale | 0 |
| task | TASK | rationale | 740 |
| todo | TODO | rationale | 0 |
| note | NOTE | rationale | 27 |

(Counts are `ls .my_context/items/<category> | wc -l`, taken 2026-09-12. `task` dwarfs everything else at
740 items because it is the corpus's own project-management ledger — every unit of work this project has
ever tracked, per `RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number` and its neighbours in
`src/rules/`.)

Two profiles select a starting subset for `mycontext init`: `standard` is every `defaultEnabled: true`
category (today that's all 29 — see "What's not built" below), and `minimal` is a hand-picked eight:
`constraint, assumption, invariant, tradeoff, adr, edge_case, rule, lesson` (`PROFILES` in categories.ts).
A project can also define wholly custom categories in `.my_context/config.json` — `CategoryUpdates` is
declared as authorable by a human, per `REQ-every-category-declares-what-may-be-updated-on-its-items-and`
("a category that cannot describe its own updates teaches nobody anything" — its own words).

## Tiers: the one distinction that decides who is told

`export type Tier = 'normative' | 'rationale'` (`src/core/types.ts:1`) is the whole vocabulary. What it
buys:

- **normative** — this is a rule the work must satisfy. An `active` normative item with `always: true` is
  injected into every session in full; every other `active` normative item is at least named in the
  session's index line so an agent can pull it. See [Injection](./02-injection.md) for the mechanics —
  `select.ts`'s `buildIndex` is where the tier is actually read (`isNormative` gates whether `always` and
  `scope` are even consulted).
- **rationale** — this is reasoning *about* work or a record of a past decision, never itself an
  instruction to obey. A rationale item is never injected in full and is never named in the session index;
  `buildIndex` reduces the whole tier to a bare count (e.g. "3 decision, 1 lesson"). Nothing an agent does
  is wrong *because* a rationale item exists.

The category comments in `categories.ts` argue this per-category rather than asserting it once, and the
arguments are concrete rather than taxonomic:

- `known_issue` is **normative** even though "the sandbox is flaky" reads like a fact, not a directive —
  because a category whose whole job is "this is broken, do not spend effort on it" is useless from a tier
  an agent never reads in full. It shipped on `rationale` once and the code comment records that as a
  design mistake that "defeats the category's entire purpose."
- `exception` is **normative** for the same reason turned around: an exception is read at exactly the
  moment the rule it waives is being applied, so it has to arrive by the same route and against the same
  budget as that rule, or a reader is told the rule and never told the carve-out.
- `task` and `plan` are **rationale**, deliberately, even though this corpus alone holds 740 task items:
  "515 open tasks arriving as 515 things a model is told to care about is exactly the failure the tier
  boundary exists to prevent." Views that *do* need them — `mycontext ready`, `mycontext doctor`'s
  task checks — query the store directly and never go through `select`.
- `todo` and `note` are **rationale** because the whole point of an inbox is zero-friction capture; forcing
  either into the tier that is injected in full (and gated as a draft on agent capture, see
  [Creation and the gates](./03-creation-and-gates.md)) "would defeat the reason both exist."
- `reference` is **rationale** as a *trust boundary*, not a judgement call: its body is a snapshot of a
  file, so making it normative would let anyone who can edit that source file change what governs the
  project by editing an unrelated file — reopening the staged-revision gate through a side door. `select`
  filters `isNormative` before it ever reads `always`/`scope`, so the question of whether a reference could
  govern never even arises.

`DEC-status-is-the-governance-axis-state-is-the-workflow-axis-and` names a second, orthogonal axis worth
knowing here: **`status`** (draft / active / validated / deprecated / superseded) says whether a record
still stands at all, while **`state`** (todo / doing / blocked / done, a `task`-only extra field) says how
far the work got. They "look alike, so people merge them, and that quietly breaks both" — the decision is
what keeps `status` as the one field every category shares and `state` as one `task` carries alone.

## Frontmatter: the fields every item carries

`src/core/types.ts`'s `Item` interface is the canonical shape (confirmed against the same file's
`Status`/`Severity`/`Origin` type aliases):

| Field | Type / values | What it means |
|---|---|---|
| `id` | string | The filename stem; generated from the title, never hand-chosen. |
| `type` | string | The category name (`rule`, `decision`, …). |
| `title` | string | One line. Median 70 chars in this corpus; 202 of 730 titles have grown past 80, one reached 566 — the pressure that motivated `summary` below. |
| `status` | `active \| draft \| superseded \| deprecated \| validated` | Whether the item governs at all. |
| `severity` | `hard \| soft` | Binding vs advisory, on normative items only. |
| `always` | boolean | Pinned — injected at every session start regardless of scope/index budget. See [Injection](./02-injection.md). |
| `continuity` | boolean | A second, independent pin into the *continuity* budget — redelivered at every session start and after every compaction, for what the next session needs "not to start over." Mirrors `always` structurally but is a distinct field, "not a hardcoded id in `select`… nor a category… nor a tag." |
| `summary` | string or null | One plain sentence, written for a reader who does not know the codebase — no ids, no paths, no numbers, bounded by `SUMMARY_MAX_CHARS`. `null` is legal; every item that predates the field has one. **Never injected** — `renderItemBlock`/`renderIndexLine` don't emit it, so it costs no budget. |
| `summary_of` | string or null | The content hash `summary` was written against (`itemSummaryBasis`), so a later edit to the body can be detected as having made the summary stale. |
| `summary_was` | up to 3 entries, newest first | Prior summaries, kept so history isn't lost when a summary is replaced. Capped at 3 by owner ruling ("does not take long space and should not be injected"); also not charged to any budget. |
| `acknowledged` | map of finding-code → content-hash | Doctor findings a **person** has ruled on, anchored to the exact item content they saw. An edit to the body invalidates the acknowledgement (the hash disagrees) and the finding reopens. |
| `scope` | string[] (globs) | What this item is about. Empty means "everywhere," unless the category's `scopePolicy` requires one. |
| `tags` | string[] | A flat membership set — see the `UpdateStore` design note below. |
| `origin` | `human \| agent \| ingest \| review` | Who/what created it — governs the trust default at capture (see [Creation and the gates](./03-creation-and-gates.md)). |
| `source_file`, `source_anchor`, `source_checksum` | strings or null | For a `reference`-shaped snapshot: where it came from and how to tell if it's drifted. |
| `valid_from`, `valid_until` | dates or null | The window the item is asserted to hold. |
| `checksum` | string | Stamped over the item's content; `mycontext doctor`/`repair` use it to find drift (see [Creation and the gates](./03-creation-and-gates.md)). |
| `extra` | map | Category-specific fields — `directive` on `rule`, `waives`/`until`/`granted_by`/`reason` on `exception`, `state`/`plan`/`seq`/`priority`/`needs`/`verified_on` on `task`, etc. |
| `request` (body section, not frontmatter) | free text | The person's own words when they asked for this item, verbatim, captured **before** any body/summary is derived — "documentation only… should not be injected." Structurally excluded from rendering, from the summary basis, and from the checksum. |
| body | prose | What the item actually says; median 1,693 characters in this corpus. |

**Fields vs. tags — one owner ruling, one measurement.** `UpdateStore` (`categories.ts:22`) draws a hard
line: *"if you would ever want to update it, it is a field."* A tag is a membership, and "what looks like an
update is a remove plus an add, two operations that can half-fail and that a typo turns into a silent third
membership." This isn't theoretical — the same file records a project measurement taken 2026-08-23: across
276 `task` items, all 276 carried a `state:` **tag**, 213 also carried a `state` **field**, and 13
disagreed (5 reading `done` as the tag and `doing` as the field). `task.state` is now declared a field with
`projectsTo: 'state'`, so the tool writes the tag itself, generated rather than hand-typed, keeping the two
in sync by construction.

### Two retired extra fields, left in place

`categories.ts` documents an owner ruling (2026-09-03) retiring `task.progress` and `task.last_change` —
removed from the writable surface (`unknownExtraFieldError` now refuses a *new* write to either) but **not
erased**: 518 items already carrying them keep them unchanged on disk. `last_change` was "hand-typed and
unreliable, all 133 disagree with the audit log"; `progress` was "never more than state's shadow (only 0
and 100 are used today)." This is the project's own model of what "retired" means for a field, distinct
from a corpus item's `status: superseded` — a correction stops new instances, it does not rewrite history.

## A worked example: `mycontext show`

```
$ node src/cli/index.ts show RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done
---
id: RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done
type: rule
title: the owner says when a screen is done, and passing is not the same as designed
status: active
severity: hard
always: false
summary: A screen is finished only when the owner says so; the old demand that it match the
  design drawing exactly is gone, and only a difference that matters is now worth reporting.
summary_of: 405a02fa5f36b963
summary_was:
  - 2026-09-11 A screen is finished only when the owner says so, and a test showing that it
    works is not a test showing it is the screen that was actually designed.
acknowledged:
  - body_disagrees_with_meta@7ef8f3973e3068f7
scope: []
tags:
  - v2
  - ui
  - governance
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 1b7170dbc5915798
---

# the owner says when a screen is done, and passing is not the same as designed
...
```
(truncated here — the real body runs to ~90 lines, including two recorded amendments each citing the
`DEC-…` item that superseded part of the rule, and a `Related:` line linking two sibling `RULE-…` ids.)

This single item demonstrates several mechanisms at once: a `summary` distinct from the title, a
`summary_was` history entry from a prior edit, an `acknowledged` doctor finding a person has already
looked at, and two in-body amendment notices each citing the decision that narrowed the rule — a live
instance of "name the item, don't restate it," the same discipline this documentation set itself follows.

## Categories by group, with real shipped examples

### Normative (injected in full when `always`, else indexed)

- **`constraint`** — a non-negotiable limit (budget, stack, regulation, SLA). 7 items here.
- **`invariant`** — a condition that must always hold during execution. 6 items here.
- **`rule`** — a do/don't directive; its one extra field is `directive: do | dont` — "what the rule
  MEANS, which is why `directive` can never be removed from the category." Shipped example:
  ```
  id: RULE-never-log-request-bodies-on-auth-endpoints
  title: Never log request bodies on auth endpoints
  directive: dont

  Bodies carry passwords and reset tokens; logs are retained for 90 days.
  ```
  *Use case*: encode a security or process do/don't so it's re-asserted at every session start rather than
  living only in a teammate's memory. 55 items here — the largest normative category by volume.
- **`requirement`** — what must be built; extra field `kind` (only `functional` attested so far —
  deliberately no closed vocabulary was declared from one observed value: "four statements in the design
  of record were measured false in one week" by exactly that kind of inference). 32 items here.
- **`standard`** — formatting, coding convention, architectural guideline. 15 items here.
- **`pattern`** — a reusable solution, or an anti-pattern to avoid. 0 items here; shipped example:
  `PAT-repository-objects-wrap-every-query-handlers-never-open-a` ("Keeps pool accounting in one place and
  makes the pool cap enforceable.")
- **`glossary`** — ubiquitous language: the agreed term, and terms not to use. 0 items here; shipped
  example: `GLOSS-tenant-means-a-paying-organisation-not-a-user` ("Say 'tenant' for the billing entity and
  'member' for a person inside it. Never 'account'.")
- **`instruction`** — governs the agent's *process*, not the artifact. 11 items here (e.g.
  `INSTR-a-ruling-taken-in-the-screen-walkthrough-is-captured-before`). This is the category the task
  brief's 14-item list omits entirely, alongside 14 others.
- **`non_goal`** — an explicit prohibition on building something. 3 items here.
- **`open_question`** — deliberately undecided; extra field `blocks` names what cannot proceed until it's
  answered. 29 items here — the agent must not decide these alone.
- **`runbook`** — the steps for a *repeatable* named operation. 0 items here; shipped example is a
  Stripe-webhook-secret rotation, 3 numbered steps. Contrast with `procedure` below — the test an author
  applies: "will you do this again next time the situation arises? Then it is a runbook."
- **`procedure`** — a *one-shot* ordered operation, performed once and then finished (a data backfill, a
  migration cleanup). 0 items here; carries a checklist body and a lifecycle (`mycontext procedure
  list|show|activate|done|step`) that `runbook` does not — see [Restore and handover](./07-restore-and-handover.md)
  and [Packs, procedures, and runbooks](./12-packs-procedures.md) for the mechanics.
- **`environment`** — how the environments differ: what production does that local does not. 0 items here.
- **`known_issue`** — broken, flaky, or a dead end right now; do not spend effort on it. 32 items here —
  the second-largest normative category, which tracks with a project that dogfoods itself hard.
- **`exception`** — a scoped, dated carve-out from one named normative item (`waives`, `until`,
  `granted_by`, `reason`). 0 items here; shipped example waives a standard until `2026-12-31`. An exception
  with no `until` "is a permanent change to the rule, made without anybody deciding to make one."
- **`contract`** — a surface other parties depend on (`consumers`, `stability`, `breaking`). 0 items here;
  shipped example is an API payload contract naming three real consumers by name.

### Rationale (never injected in full; reduced to a count in the session index)

- **`adr`** — a formal decision record, MADR-shaped. 3 items here.
- **`decision`** — a lightweight decision not warranting a full ADR. 99 items here — by far the largest
  rationale category besides `task`, reflecting how much of this project's history is owner rulings amending
  prior rules (as seen twice in the `RULE-1-1-…` example above).
- **`lesson`** — what was learned; source material for generated rules. 43 items here. See
  [The self-improvement loop](./11-self-improvement-loop.md) for how a lesson turns into a staged rule
  candidate via `mycontext lesson-stage`/`lesson-accept`.
- **`tradeoff`** — what was sacrificed for what. 0 items here.
- **`assumption`** — an unverified premise plus a `validate_by` deadline; "an assumption with no deadline
  is a belief." 0 items here.
- **`edge_case`** — a boundary condition, frequently worth promoting (see `mycontext inbox-promote`). 0
  items here.
- **`risk`** — may occur and would harm (`likelihood`, `impact`, deliberately no closed vocabulary yet). 0
  items here.
- **`measurement`** — a number, how it was obtained (`method`), and when (`measured_on`), against what
  (`subject`, `revision`) — "so a later reader can tell whether it still holds." 1 item here. A measurement
  is a fact about a moment, never an instruction; this is the category the `UpdateStore` 276-task-item
  figure above would itself belong in, if it had been captured as a corpus item rather than a code comment.
- **`reference`** — a snapshot of a file, with its origin recorded so `doctor` reports drift. 5 items here.
  See [Restore and handover](./07-restore-and-handover.md) for `mycontext refresh`.
- **`plan`** — a named body of work: `goal`, `done_when`, `wave`, `state`. **Not** a work category itself
  (`isWorkCategory` requires `plan`+`seq`+`state` together, and `plan` items carry only `state`) — it is the
  *container* that `task.plan` points into. 0 items here.
- **`task`** — a unit of planned work; `state` (todo/doing/blocked/done, projects to a tag), `plan`, `seq`,
  `priority` (1 highest), `needs` (comma-separated plan/seq references gating readiness — shape checked,
  existence not, because plans are written before their tasks), `verified_on` (stamped by a person
  reviewing a `done` task afterward, not by finishing it). 740 items here — this is the category
  `mycontext ready` and three `doctor` checks (`blocked_without_needs`, `blocked_needs_met`,
  `needs_unresolved`) are built for.
- **`todo`** — the inbox: captured the instant a thought occurs, zero friction. 0 items here (this project
  appears to promote or resolve todos quickly rather than letting them accumulate).
- **`note`** — anything that arose during development and must not be lost. 27 items here.

## What's not built, or built but off

- **`policy`, `postmortem`, `taxonomy`** — three categories that shipped and were later removed outright
  (Phase 3), because "each duplicated a clearer sibling." They are gone, not disabled — `resolveConfig`
  refuses an unknown `profile` name (e.g. a stale `config.json` saying `"profile": "full"`) rather than
  silently downgrading it, per `INV-nothing-is-dropped-silently`.
- **The `full` profile** used to differ from `standard`; today both resolve to the same 29-category
  catalogue, and `full` is documented as removed rather than kept as a silent alias.
- **13 of the 29 categories have zero items in this corpus** (`pattern`, `glossary`, `runbook`,
  `procedure`, `environment`, `exception`, `contract`, `tradeoff`, `assumption`, `edge_case`, `risk`,
  `plan`, `todo`) — the machinery and the shipped examples exist and are fully wired, but nobody has
  captured one here yet. Every worked example for those categories above therefore comes from
  `mycontext examples <category>`, the tool's own shipped illustration, not from a live item in this
  repository — flagged explicitly rather than presented as if it were this project's own data.
- **A `values` vocabulary is deliberately left undeclared** on several extra fields (`requirement.kind`,
  `risk.likelihood`/`impact`, `contract.stability`) even though a familiar closed set exists in other
  projects (e.g. low/medium/high) — the code comments call declaring one from zero attested values "an
  inference," and inference is explicitly what this project's design-of-record was burned by once.

## Could not verify

I did not find a corpus item that states the 29-vs-14 category count as a fact in its own words — that
reconciliation above is my own comparison of the task brief against `categories.ts`, not a claim carried by
any `id`. Everything else above traces to either a source file and line, a real command's output captured
above, or a named item id.

## See also

- [Index](./00-index.md)
- [Injection](./02-injection.md) — how tier and `always` decide what actually reaches a session
- [Creation and the gates](./03-creation-and-gates.md) — how an item comes to exist, and what stops a bad one
- [The product rule store](./10-rule-store.md) — a second, separate store of normative text, shipped in the
  product itself rather than as corpus items
