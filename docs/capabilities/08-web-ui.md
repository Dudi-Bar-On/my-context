<!-- Chapter 8 of the my_context capabilities documentation. -->
# The web UI

## What it is, and why

`mycontext ui [--port N] [--no-open] [--idle-ms N]` starts a local HTTP server bound to
`127.0.0.1` (`src/ui/server.ts`, `src/ui/open.ts`) and opens a single-page app at it. It is a
**read-only window** onto everything else this document describes — the corpus, the injection
mechanics, the conversation archive, the audit log, the review queue, the product rule store —
for a *person* to inspect without an agent in the loop and without running CLI commands one at a
time. `src/ui/routes.ts`'s own header states the design intent plainly:

> "Nothing here reads a corpus, so nothing here can write one. The table holds handlers and
> matches paths; every fact about the project comes from the handler bodies in `read-model.ts`."

This chapter is written **entirely from source** — `src/ui/*.ts` and `src/ui/public/` — without
connecting to the live server. The owner's UI server was up on port 58888 with other lanes
attached while this was written, and this chapter does not touch it in any way (no browser tool,
no HTTP request, no navigation).

## The no-writes guarantee, and its three named exceptions

The plan this surface was built against (`docs/superpowers/specs/2026-08-16-web-ui-design.md` §2)
states a "mutator-free rule", and `src/ui/security.ts`'s header says explicitly that the rule is
"enforced by the import-graph test, not by this file" — i.e. it's a build-time, checkable
guarantee (a static test asserting which modules under `src/ui/` are allowed to bind `recordAudit`
at all), not a runtime promise taken on faith.

Three writes exist inside this "read-only" surface, and all three are individually named, ruled by
the owner, and covered by that same static test (`security.ts`'s header: *"Task 14's static test
asserts the SET of write bindings under `src/ui/` is exactly the owner-ruled set... so an unruled
third binding anywhere in this directory fails the build"*):

1. **`recordRefusal`** (`src/ui/security.ts`) — the *only* write on the security gate's refusal
   path. Every `/api/*` request passes a gate that checks Host/Origin headers and the session
   token; a request the gate refuses gets exactly one audit record (`kind: 'access', op:
   'ui-refused'`), built field-by-field from an allow-list that can never carry the token itself.
   The function is structurally incapable of recording a *served* read: it refuses to write
   anything whose `status` isn't `401`/`403` or whose `check` isn't one of
   `['host', 'origin', 'token-missing', 'token-mismatch']`.
2. **`recordNonceMint`** (`src/ui/security.ts`, `POST /api/nonce`) — a tab that loses its token
   (e.g. after a server restart) needs one way back in without forcing a full server restart. This
   route mints a fresh one-shot nonce, and the mint is itself audited (owner ruling
   2026-08-28, tied to `KNOWN-a-locked-out-tab-can-only-be-recovered-by-the-restart-that-locks-out-the-next-one`).
3. **`execute.ts`** — the one module that runs a real, mutating command on the person's behalf.
   See "The Composer" below; this is the substantive exception, not a bookkeeping one.

Nothing else under `src/ui/` writes to disk. `execute.ts`'s own header underlines the same point
from a different angle: *"It composes nothing (that is `execute-catalogue.ts`), it decides nothing
about which confirm a command gets ... and it records no OUTPUT anywhere."*

## The rail: exactly 20 screens

`src/ui/public/app.js` defines the navigation in one array, `NAV`, grouped into four sections **by
tense** — this is a deliberate design decision the file's own comment names ("FOUR groups, by
TENSE... in the mockup's own order"):

| Group | Label (`strings/en.js`) | Screens |
|---|---|---|
| `nav.inj` | *"Injection — what arrives"* | preview, coverage, simulate, injected |
| `nav.ev`  | *"Evidence — why it did or didn't"* | watch, ask, doctor, decay, graph, status |
| `nav.ch`  | *"Change — composed, never run"* | work, capture, palette, config, proc, port, packs |
| `nav.read`| *"Read"* | conversations, library, learn |

4 + 6 + 7 + 3 = **20**, which is exactly the count the task brief names, and each of the 20 route
ids resolves 1:1 to the 20 given screen names via `strings/en.js`'s `s.<id>` keys:

| id | Label | Backing module(s) |
|---|---|---|
| `preview` | Injection preview | `screens/preview.js` |
| `coverage` | Scope coverage | `screens/coverage.js` (absorbed the retired `gaps` screen 2026-09-04) |
| `simulate` | Budget simulator | `screens/simulate.js` |
| `injected` | Injected now | `screens/injected.js` |
| `watch` | Audit stream | `screens/watch.js` |
| `ask` | Ask | `screens/ask.js` |
| `doctor` | Doctor | `screens/doctor.js` |
| `decay` | Decay | `screens/decay.js` |
| `graph` | Relations | `screens/graph.js` |
| `status` | Status | `screens/status.js` |
| `work` | Review queue | `screens/work.js` |
| `capture` | Capture | `screens/capture.js` |
| `palette` | Composer | `screens/palette.js` |
| `config` | Configure | `screens/config.js` |
| `proc` | Procedures | `screens/proc.js` |
| `port` | Export / import | `screens/port.js` |
| `packs` | Template packs | `screens/packs.js` |
| `conversations` | Conversations | `screens/conversations.js` |
| `library` | Help | `screens/library.js` (embeds `screens/cli-help.js`) |
| `learn` | Learn | `screens/learn.js` |

A note on a discrepancy worth being honest about: `app.js`'s own comment above the `SCREENS`
import map says *"TWENTY-ONE OF TWENTY-ONE"*, counting `cli-help` as a screen in its own right —
but `cli-help` has no entry in `NAV` or `SCREENS`; it is imported *inside* `library.js`
(`import { paintCliHelp } from '/screens/cli-help.js'`) as the CLI-topics pane of the Help screen,
not a rail destination of its own. So there are 20 navigable rail screens and one additional
screen-shaped module folded into one of them. The comment is stale relative to the current
`NAV`/`SCREENS` wiring — flagged here rather than silently reconciled.

Every screen is always listed on the rail, even ones with "no module behind them" — the comment on
`NAV` explains why: *"Hiding a screen because its content is not written yet tells the reader the
product is smaller than it is."* Unbuilt screens would carry a `PROPOSED` badge computed from
`Object.hasOwn(SCREENS, name)`; as read today, `SCREENS` actually defines a loader for **all 20**
ids, so none should currently render as proposed-but-missing — a claim worth re-checking against
the live server if that matters, since this was verified from source only.

### Screen-by-screen

**Injection preview** (`preview`) — reads the same selection path chapter 2
([`./02-injection.md`](./02-injection.md)) describes: what would actually be delivered at the next
`SessionStart`, given the current corpus and budgets. It is named in `app.js`'s own routing
comment as *"the landing screen"* — the first thing a person sees when opening the UI, because
"what arrives" is the most load-bearing single fact about this whole system.
*Use case:* before pinning a new item with `mycontext pin`, check this screen to see whether it
actually earns a spot inside the pinned budget or spills to a title-only line.

**Scope coverage** (`coverage`) — which paths/globs in the repository are actually covered by a
scoped normative item, and where there are gaps. Absorbed the separate "gaps" screen on
2026-09-04; a stale `#/gaps` deep link is explicitly redirected here in `app.js`'s `route()`.
*Use case:* confirming a new source directory isn't silently ungoverned by any constraint/standard.

**Budget simulator** (`simulate`) — lets a person try a hypothetical budget allocation (see
chapter 2 for the real budget keys: `pinned`, `jit`, `restored`, `continuity`, `index`) and see
what would spill before actually writing `config.json`. The *write* path for an accepted
simulation goes through `execute.ts`'s `writeBudgets` (see "The Composer" below) rather than the
simulate screen writing anything itself.
*Use case:* deciding whether raising the `pinned` budget by a given amount actually rescues the
items currently spilling to title-only lines, before spending the corresponding tokens on every
future session.

**Injected now** (`injected`) — what was *actually* delivered at the most recent real injection
event (session start / subagent start / restore), as distinct from `preview`'s hypothetical replay
of "if it ran right now".
*Use case:* auditing a specific session after the fact to see exactly which items it received.

**Audit stream** (`watch`) — the live tail of the append-only audit log
(`.my_context/.audit/audit.jsonl`, per `docs/ROADMAP.md`'s D4.3 entry). `routes.ts`'s own header
says stream routes exist "for plan 3's audit stream" and are explicitly excluded from resetting
the UI's idle-timeout monitor (an open stream is not "activity"). Backed by `watch-model.ts`.
*Use case:* watching mutations (creates/edits/promotions/supersessions) and hook firings land in
real time while working in another terminal.

**Ask** (`ask`) — backed by `ask-model.ts`; a query surface over the corpus (the read-side sibling
of the `ask_handover` MCP tool and the retrieval mechanism in chapter 6,
[`./06-retrieval.md`](./06-retrieval.md)).

**Doctor** (`doctor`) — the UI rendering of `mycontext doctor`'s self-check findings (index
freshness, orphans, drift, dead globs, permissions, session ids — see chapter 3,
[`./03-creation-and-gates.md`](./03-creation-and-gates.md)).

**Decay** (`decay`) — items that have not been injected in N sessions, backed by
`src/core/decay.ts`, the same data `mycontext decay` prints on the CLI.

**Relations** (`graph`) — a visualization of the `link`/relation graph between items (supersedes,
waives, amends, etc.), reads item-pane data (see below) on selection.

**Status** (`status`) — counts, review-queue size, ingest progress, decay and health, the UI
mirror of `mycontext status`.

**Review queue** (`work`) — the draft and revision queue: items captured by something other than a
person (chapter 1, [`./01-items-and-corpus.md`](./01-items-and-corpus.md)) awaiting promotion or
discard, and staged rule candidates from the self-improvement loop (chapter 11,
[`./11-self-improvement-loop.md`](./11-self-improvement-loop.md)). The rail's gold count-badge
logic (`RAIL_COUNTS = ['doctor', 'work']`) singles this screen and Doctor out as the two whose
pending-count is worth badging on the rail itself.

**Capture** (`capture`) — backed by `capture-model.ts`; the UI-side entry point for jotting down a
todo/note, the same inbox `mycontext todo` and `mycontext inbox-promote` operate on.

**Composer** (`palette`) — see its own section below; the most consequential screen on the rail
because it is the one place the "read-only" UI can actually cause a write.

**Configure** (`config`) — backed by `read-model-config.ts`; shows `config.json` as it stands
(including the `configError`/"serving the last good config" fallback described in `routes.ts`'s
`ApiContext.configError` doc-comment) and composes budget-writing commands through the same
Composer/execute path.

**Procedures** (`proc`) — the one-shot procedure lifecycle (`activate`/`step`/`done`) described in
chapter 12, [`./12-packs-export-import-procedures.md`](./12-packs-export-import-procedures.md);
backed by `proc-model.ts`.

**Export / import** (`port`) — backed by `port-model.ts`; the UI view of `mycontext export`/`pack
import` (chapter 12).

**Template packs** (`packs`) — backed by `packs-model.ts` and `preview-history.ts`; browsing and
previewing packs before import (chapter 12).

**Conversations** (`conversations`) — backed by `read-model-conversations.ts` and
`read-model-conversation-document.ts`; the UI view of the conversation archive (chapter 4,
[`./04-conversation-archive.md`](./04-conversation-archive.md)) and anchors (chapter 5,
[`./05-anchors.md`](./05-anchors.md)). Opening a transcript document opens `/lane.html` — a
dedicated page outside the SPA shell, not a rail screen — for reading one conversation in full.

**Help** (`library`) — per its own file header, this is deliberately **the one console page that
replaces what used to be separate Documentation and Tutorials screens** (owner ruling
`DEC-the-documentation-and-tutorials-screens-become-one-list-and`, 2026-09-05, quoted verbatim in
`library.js`: *"One console page replaces both screens. It lists every document and tutorial BY
TITLE, never by file path, with the measured EN/HE state beside each. Opening one opens a RENDERED
page in a new browser tab. The console stops trying to be a documentation site."*). A second
ruling the same day (`DEC-the-document-page-wears-github-styling-lists-the-readmes-and`) narrowed
the *list* (not the viewer) to the two READMEs and the tutorials — "not 166 internal specs, plans
and reports" — while the actual document viewer at `/doc.html` still opens any of the ~190 tracked
Markdown files if a link inside a listed document points at one. This screen also hosts the
`cli-help.js` pane (`mycontext help <topic>` rendered as a browsable console).

**Learn** (`learn`) — a guided-tour/onboarding screen, kept distinct from Help.

## The Composer

`palette` (labelled "Composer") is the screen the `nav.ch` group's own tagline names precisely:
*"Change — composed, never run."* Two source files carry the actual mechanism, split by
responsibility:

- **`execute-catalogue.ts`** *composes*. Given a screen and a set of values a person filled in, it
  resolves to an exact argv — the same string a person would type at a shell — and decides which
  confirmation dialog that command needs. Its own comment states the boundary is cached from a
  measurement `test/ui/palette-lib.test.ts` derives from the real argument parser, i.e. the
  Composer's idea of a valid command is checked against the CLI's actual parser, not maintained by
  hand as a second copy of it.
- **`execute.ts`** *runs* it, through exactly two routes:
  - `GET /api/execute/confirm?id=…` — returns what the confirmation dialog must show, plus a nonce.
  - `POST /api/execute` — body `{ id, values, nonce }` → it actually runs.

The file's header states the one property the whole module exists to protect: **"The string a
person reads in the confirm and the argv that runs are the same thing."** Both routes go through
the same `resolveCommand`, and the nonce cryptographically binds the second call to exactly what
the first one returned — there is no second code path anywhere in the module that could compose an
argv a different way. The POST handler's own ordering *is* the security story, spelled out in the
file: body-shape check → `resolveCommand` → nonce redemption (checked against the server's own
resolved argv, never against anything the client claims) → an `execute` audit row is written
*before* anything runs (**"a run that cannot be recorded does not happen"** — a failed audit write
is a 500 and the command never executes) → the actual run, via `execFile` with an argv array and
**no shell of any kind** → a second audit row, `execute-done`, appended (never amending the first)
with the real exit code and duration.

The module's header is explicit that it "records no OUTPUT anywhere" — only the argv (scope) is
persisted, never stdout (content), because "the argv is scope, stdout is content, and only the
first belongs in a file that travels between machines." Per spec §6.1/§6.2 (cited in the file's
own header): *everything in the catalogue runs, and there is no kill switch* — i.e. this is not a
half-built feature gated behind a flag; whatever commands the catalogue lists are live.

One concrete instance: the **Budget simulator**'s accepted proposal is written to `config.json`
through this exact path — `execute.ts` imports `writeBudgets`/`diffBudgetsAgainstDisk` and calls
`writeBudgets(root, proposedBudgets)` from inside the POST handler, after the nonce redeems, and
the module's own comment underlines that this is "the whole of the write" (no separate write path
exists for budgets).

*Use case:* a person reviewing the Budget simulator's proposal, or a catalogued corpus operation
surfaced on another screen, sees the exact command that would run, is shown a typed confirmation
appropriate to that command's risk, and only then triggers a server-side, fully audited execution
— without ever having to leave the browser or trust a client-composed string.

## The item pane

An item-detail pane recurs across several screens rather than being unique to one — real
references to it appear in `app.js` itself plus `screens/conversations.js`, `screens/graph.js`,
`screens/palette.js`, `screens/preview.js`, `screens/work.js`, and the shared
`lib/command-actions.js`. It is the shared surface for showing one item's fields (see chapter 1 for
what those fields mean: title, body, summary, scope, tags, status, severity, `always`,
`continuity`) wherever a screen lets a person drill into a specific item — from a spill line in the
Injection preview, a node in Relations, a queue entry in Review queue, or a match in Ask.

## The Hebrew RTL mirror and the string tables

Every user-facing string in the UI is looked up by key from `src/ui/public/strings/en.js` and
`src/ui/public/strings/he.js`, rather than hard-coded in the screen modules. Both files measure
**exactly 1,313 lines** (`grep -c "^\s*'" ... `on each) — strong, directly-measured evidence the
two tables are kept in lock-step key-for-key, consistent with `library.js`'s own description of
tracking "the measured EN/HE state beside each" document/tutorial, i.e. this project treats
locale-completeness itself as a measured, checkable fact rather than an assumption. (This chapter
did not locate a dedicated `scripts/check-*` parity script by name — several `test/ui/*.test.ts`
files reference both string files, e.g. `static.test.ts`, `viewmodel.test.ts`,
`config-screen.test.ts`, `execute-route.test.ts`, `bounded-list.test.ts`,
`config-error-strip.test.ts` — but this chapter did not read those tests in full to confirm the
exact assertion each makes, so the *mechanism* enforcing parity should be taken as "at least
partially test-covered, exact enforcement unverified from this chapter's reading" rather than
fully pinned down.)

`docs/README.he.md` is the Hebrew mirror of the project's own top-level README, following the same
"mirror, don't fork" discipline as the UI strings.

## What's NOT built / built but off

- **`cli-help` is not an independent rail screen**, despite `app.js`'s own comment claiming
  "TWENTY-ONE OF TWENTY-ONE" screens — it is a module folded into the Help (`library`) screen. The
  comment appears stale relative to the current `NAV`/`SCREENS` tables as read.
- This chapter could not confirm, without connecting to the live server, whether every one of the
  20 `SCREENS` entries currently renders real content versus a `PROPOSED` placeholder — the source
  comment describing the badge logic (`Object.hasOwn(SCREENS, name)`) implies none should be
  proposed-only today since all 20 ids have loaders, but this is inferred from source, not observed
  live.
- The exact automated check that enforces en/he key parity was not pinned to one named script from
  source alone — flagged above rather than asserted.
- No further capability beyond the three named write exceptions was found; nothing suggests a
  fourth undocumented write path exists (the owner-ruled static test would fail the build if one
  were added, per `security.ts`'s own description).

## See also

- [Index](./00-index.md)
- [Injection](./02-injection.md) — what the Injection preview/Injected now screens actually show
- [Anchors](./05-anchors.md) — the Conversations screen's provenance mechanism
- [The CLI and the MCP server](./09-cli-and-mcp.md) — the commands the Composer ultimately composes and runs
