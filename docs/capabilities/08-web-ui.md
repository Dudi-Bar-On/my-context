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

## The no-writes guarantee, and the twelve bindings it actually admits

The plan this surface was built against (`docs/superpowers/specs/2026-08-16-web-ui-design.md` §2)
states a "mutator-free rule", and `src/ui/security.ts`'s header says explicitly that the rule is
"enforced by the import-graph test, not by this file" — i.e. it's a build-time, checkable
guarantee (a static test asserting which modules under `src/ui/` are allowed to bind a writing
symbol at all), not a runtime promise taken on faith.

**The enforced number is twelve, not three.** `RULED_WRITES` in `test/ui/no-writes.test.ts:567`
is a literal list of twelve binding strings, and the assertion at `:2030` is
`assert.deepEqual(bound.sort(), RULED_WRITES, …)` — **set equality**, so twelve is the exact
admitted set, not a floor and not a ceiling a reader should round down. Adding a thirteenth fails
the build; so does removing one without editing the list. The twelve sit in **five files**:

| File | Bindings | What they are |
|---|---|---|
| `src/ui/anchor-write.ts` | `markAnchor`, `markAutomaticAnchors`, `unmarkAnchor` | the anchor write surface (below) — **composes no command and starts no process** |
| `src/ui/execute.ts` | `recordAudit`, `writeBudgets`, `deriveEffect` | the Composer's run path, its budget write, and the tmpdir-only Execute preview |
| `src/ui/retrieval-write.ts` | `stageRetrievalReturn`, `approveStagedRestore` | the retrieval stage/approve surface (below) — also composes no command |
| `src/ui/security.ts` | `recordAudit` | **one** binding, shared by `recordRefusal` and `recordNonceMint` |
| `src/ui/server.ts` | `writeUiServerRecord`, `clearUiServerRecord`, `recordSessionDigest` | machine state under the global root, outside every corpus |

Each entry in `RULED_WRITES` carries its own owner ruling and its own bounding properties in a
comment above it; the list is the documentation of record, and this table is an index into it.
Three of them are worth stating in full because they are the ones a reader auditing "can this
local web surface write to my corpus?" is asking about:

1. **`recordAudit` via `src/ui/security.ts`** — the security gate's refusal path. Every `/api/*`
   request passes a gate that checks Host/Origin headers and the session token; a request the gate
   refuses gets exactly one audit record (`kind: 'access', op: 'ui-refused'`), built field-by-field
   from an allow-list that can never carry the token itself. The function is structurally incapable
   of recording a *served* read: it refuses to write anything whose `status` isn't `401`/`403` or
   whose `check` isn't one of `['host', 'origin', 'token-missing', 'token-mismatch']`. The nonce
   mint (`POST /api/nonce`, owner ruling 2026-08-28, tied to
   `KNOWN-a-locked-out-tab-can-only-be-recovered-by-the-restart-that-locks-out-the-next-one`) is
   audited through the *same* binding — it is not a second entry in the set, which is why counting
   "refusal" and "mint" as two exceptions does not match the shape the test counts in.
2. **`src/ui/execute.ts`** — the module that runs a real, mutating command on the person's behalf.
   See "The Composer" below.
3. **`src/ui/anchor-write.ts` and `src/ui/retrieval-write.ts`** — two write surfaces that reach the
   disk **without composing a command at all**. See "The two command-free write surfaces" below.

`execute.ts`'s own header underlines a different property, and it is about output rather than
about being the only writer: *"It composes nothing (that is `execute-catalogue.ts`), it decides
nothing about which confirm a command gets ... and it records no OUTPUT anywhere."*

## The two command-free write surfaces

These are the part of the surface the "read-only window" framing hides, and they are the reason
the count above matters. Both were ruled by the owner under one sentence —
`REQ-every-anchor-capability-is-reachable-from-the-screen-and-a`: *a composed command a reader
copies to a terminal is not the UI having a capability, it is the UI describing one.*

**`src/ui/anchor-write.ts`** registers four routes —
`POST /api/conversations/anchors/{mark,relabel,drop,sweep}` (`:357–366`) — and its own header says
in capitals what distinguishes it from the Composer: *"NOTHING HERE COMPOSES A COMMAND OR STARTS A
PROCESS. There is no argv, no nonce, no child. The whole write is one row."* Four properties bound
it, stated in that header: it goes through the **same seam the CLI uses** (`markAnchor` /
`unmarkAnchor`, with `withAnchorWrite` publishing `.my_context/.anchors.jsonl` in the transaction
that moves the row); **what is gitignored is what moves** — an anchor row and a gitignored
document, no corpus item, no `config.json`, no transcript, with
`test/ui/anchor-write-route.test.ts` taking the byte snapshot over a whole
mark/relabel/drop/sweep round trip; **the shape is fixed by the route, not the caller** (a
hand-made anchor is `kind: 'note'`, `origin: 'owner'`, so no request can forge a row the automatic
pass is forbidden to touch); and **it cannot turn the archive on** — every handler opens the read
door first and answers the never-indexed state rather than creating a database.

**`src/ui/retrieval-write.ts`** registers three (`:420–427`): `POST /api/retrieval/stage`,
`GET /api/retrieval/approve/confirm`, `POST /api/retrieval/approve`. This is a **second
confirm+nonce pair, outside `execute.ts`** — so the Composer's "there is no second code path" is a
statement about `execute.ts`'s interior, not about the server. The nonce here comes from
`GET /api/retrieval/approve/confirm` and from no other line, is bound to the key **and** to a
digest of the staged bytes recomputed from disk at both ends, and is spent on attempt. Its four
bounding properties, from `RULED_WRITES`' own comment: **staging is not delivery** (the record is
left `proposed`, and `approvedRestore` must still answer nothing afterwards); **what moves is
`.staging/restore/`**, one JSON file in a gitignored directory; **the actor is the route's** —
`'human'` is a literal at the one call site, reachable from no body field; and the approval is
authorised by a confirm nobody can mint.

Both modules register from `startUiServer` rather than from `registerReadRoutes`, which is how
`server-e2e.test.ts`'s byte-identical sweep over the read surface stays meaningful: every *read*
module still binds nothing.

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
import map still says *"TWENTY-ONE OF TWENTY-ONE"*, and the `NAV` comment below it still says
*"ALL TWENTY-ONE SCREENS"*, against a `NAV` that now totals 20. **The 21st was never `cli-help`.**
At `e8a8177416d8`, when those comments were written, `NAV` really did list 21 ids: `nav.inj`
carried a fifth entry, `gaps`, and `nav.read` was `['docs', 'tut', 'learn']`. Three retirements
and a merge took it to 20 — `gaps` was absorbed into `coverage` on 2026-09-04, `docs` and `tut`
became the single `library` screen on 2026-09-05, and `conversations` was added — so the count in
the comment is one screen behind, for reasons that have nothing to do with `cli-help`.

`cli-help` is separately *not* a rail screen, and never was one: it has no entry in `NAV` or
`SCREENS`, and is imported *inside* `library.js`
(`import { paintCliHelp } from '/screens/cli-help.js'`) as the CLI-topics pane of the Help screen.
So there are 20 navigable rail screens and one additional screen-shaped module folded into one of
them. Both facts are flagged here rather than silently reconciled; the comment is a code defect,
not a chapter one.

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

**Composer** (`palette`) — see its own section below; the screen where a person runs a real
catalogue command from the browser. It is **not** the only place the "read-only" UI causes a
write: the Conversations screen writes anchors and stages retrievals through routes that compose
no command at all (see "The two command-free write surfaces"), and the Copy+Execute control
`lib/command-actions.js` provides is imported by **eight screens** — `config`, `conversations`,
`coverage`, `doctor`, `packs`, `port`, `proc`, `work` — plus `app.js` and `lib/builder.js`
(which is how `palette` reaches it; `palette.js`'s own comment at `:193` records that it imported
the module directly until the shared builder took it over). The Composer is where the catalogue is
*browsed*; it is not a chokepoint.

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
**It sits in the `nav.read` ("Read") group and is nevertheless the product's largest write
surface**: it performs four anchor writes (`screens/conversations.js:1215, 1562, 1598, 1757`,
and again from the `/lane.html`-side handlers at `:5215, 5235, 5277`) and a retrieval
stage/confirm/approve cycle (`:2375, 2419, 2462`). The group label describes the tense of what the
screen is *about*, not the reachability of a write from it.

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
argv a different way. (That is a statement about `execute.ts`'s interior, and only about it: a
**second** confirm+nonce pair exists on the server, in `retrieval-write.ts`, binding its nonce to a
digest of staged bytes rather than to an argv. See "The two command-free write surfaces".) The
POST handler's own ordering *is* the security story, spelled out in the
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
`src/ui/public/strings/he.js`, rather than hard-coded in the screen modules. `grep -c "^\s*'"`
extracts **1,314 key lines from each** (measured 2026-09-13; the files themselves are 2,386 and
1,629 lines, most of the difference being comment prose in the English table). That is a
measurement, not the enforcement.

The enforcement is a named test, and it is not in `scripts/`: **`test/ui/strings-parity.test.ts`**
has existed since 2026-08-20 — its first commit is titled "…with key-parity test" — and asserts
three separate things. Key sets, **in both directions**: *"en and he string tables declare
identical key sets — in both directions"* diffs `enKeys \ heKeys` and `heKeys \ enKeys` and
requires both to be empty (`:116–123`). Monospace slots (`{m:…}`) match key for key (`:204`).
Value slots (`{name}`) match key for key (`:229`), with the comment recording why the second was
added: `t()` substitutes by *name*, so a renamed slot leaves a literal `{lines}` on screen and a
dropped one loses the number the sentence is about. Four sibling parity tests live in the same
directory — `strip-parity`, `styles-parity`, `duration-parity`, `zoned-stamp-parity`.

`docs/README.he.md` is the Hebrew mirror of the project's own top-level README, following the same
"mirror, don't fork" discipline as the UI strings.

## What's NOT built / built but off

- **`cli-help` is not an independent rail screen** — it is a module folded into the Help
  (`library`) screen. Separately, `app.js`'s "TWENTY-ONE OF TWENTY-ONE" comment is one screen
  behind the current 20-entry `NAV`, for the reasons traced above (`gaps` retired, `docs`+`tut`
  merged, `conversations` added). Both are live code defects, not facts about the product.
- This chapter could not confirm, without connecting to the live server, whether every one of the
  20 `SCREENS` entries currently renders real content versus a `PROPOSED` placeholder — the source
  comment describing the badge logic (`Object.hasOwn(SCREENS, name)`) implies none should be
  proposed-only today since all 20 ids have loaders, but this is inferred from source, not observed
  live.
- **No write path beyond the twelve in `RULED_WRITES` exists as of 2026-09-13**, and a thirteenth
  cannot be added silently: the assertion is set equality, so an unruled binding fails the build
  and so does a removal the list was not told about. What this does *not* say is that twelve is
  small — see the count and the two command-free surfaces above.
- **This chapter does not cover most of the HTTP surface.** `src/ui/` registers **76 routes**
  (`grep -c 'registerRoute(' src/ui/*.ts`, 2026-09-13); this chapter names sixteen distinct
  paths. Uncovered families include the whole `/api/watch/*` SSE stream set, `/api/ask/*`,
  `/api/render`, `/api/glob`, `/api/overlap`, `/api/command/check`, `/api/config/{check,preview}`
  and `/api/handoff`.
- **Uncovered modules**, named here so a reader knows they exist rather than inferring they do
  not: `git-info.ts`, `idle.ts`, `zoned-day.ts`, `execute-nonce.ts`, `maintenance/`,
  `read-model-{flags,cli-help,work,staging,retrieval}.ts`; the client libraries under
  `lib/` (`sse`, `heartbeat`, `live-invalidation`, `disclosure`, `pane-resize`, `sanitize`,
  `highlight`, `markdown`, `diagrams`, `wa-tree`, `palette-defs`, `builder`); `screens/parts.js`,
  the shared screen-chrome module every screen imports; and the two non-SPA pages
  `tree-proof.html` and `doc.html`.
- **The RTL mirroring mechanism itself is not described here** — only key parity is. `lib/i18n.js`,
  `translate()`, the `.m` / `unicode-bidi: isolate` spans and the `{mv:…}` monospace value slots
  are what make a Hebrew screen render a Latin identifier correctly, and they are a gap in this
  chapter rather than a gap in the product.
- **The token/nonce bootstrap and its `sessionStorage` lifetime** (`app.js:310–340`) and the CSP
  `style-src 'self'` / no-`innerHTML` discipline that shapes every DOM builder are both
  undescribed here.
- **`clearUiServerRecord` takes an identity, and this matters to anyone reasoning about the
  server-record write.** Since `fe4086c1` the signature is
  `clearUiServerRecord(owner: UiServerIdentity, globalRoot?): ClearOutcome`
  (`src/core/ui-server-record.ts:343–357`): it re-reads the record and returns
  `'names-another-server'` unless **both** `pid` and `port` match — the conjunction is deliberate,
  since "`pid` alone is defeated by recycling, `port` alone by a machine that reuses a port". A
  closing server can therefore no longer delete a *replacement's* record. The function never
  throws; an unremovable file answers `'no-record'`.

## See also

- [Index](./00-index.md)
- [Injection](./02-injection.md) — what the Injection preview/Injected now screens actually show
- [Anchors](./05-anchors.md) — the Conversations screen's provenance mechanism
- [The CLI and the MCP server](./09-cli-and-mcp.md) — the commands the Composer ultimately composes and runs
