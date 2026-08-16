# mycontext web UI — design

**Date:** 2026-08-16
**Status:** decisions taken in brainstorming; amended three times; pending user review
**Target:** v2.0, after 1.0.0 ships
**Depends on:** the run-time audit log (1.0 Phase 5, decision Q3)

---

## 0. What this pass changed, and why it had to

This is the third amendment pass. It exists because a review found **five statements about the
existing product that the code does not support**, and one argument — the security reframing in §2 —
that was *inverted* relative to the product's own documented trust boundary. Nothing below is quietly
patched. Where a claim was removed, the section that carried it says what it said and why it was wrong,
because a document whose whole subject is "do not assert a property the system does not have" cannot
correct itself invisibly.

| Was | Is | Where |
|---|---|---|
| The UI hands an agent no capability it does not already have, so it may call five mutating functions | **The UI performs no writes at all.** The old argument fails on three counts, each named | §2 |
| `rebuild` would have destroyed audit history had it lived in `.index.db` | **`rebuild` drops `items` only.** The destroyers are `Store.open`'s corruption self-heal and the documented "delete it, it rebuilds" recovery | §5 |
| The coverage map is `matchesAnyGlob` over a file tree | **`matchesScope` + `isEligible` + the normative-tier test.** `matchesAnyGlob` over a file tree is a defect `select.ts` documents by name | §3 |
| `session_id` and `prompt_id` join the status line to the audit log | **`session_id` alone.** No `prompt_id` exists anywhere in this repository except, formerly, this spec | §4b |
| 5,000 items where JIT selection alone costs ~11ms | **The selector is asserted under 10ms; ~11ms is a whole-hook figure.** The number that binds is the hit-path p95, ~20.7–22.7ms against 50ms | §5 |
| `/api/select?event=tool&path=X` is the injection preview | It omits `seen`, so it previews a **different selection and a different spill set** than the hook produces. The endpoint takes a session | §3, §4 |
| A test asserts `/api/select` is byte-identical to `select()` | Impossible as written — `select()` returns objects. Restated as JSON structural equality | §3, §6 |

Two things the review asked for are here because the owner asked for them first and an earlier pass
dropped them: **configuring** (§4, *Configure*) and **reports** (§4, *Report*). Two more are new
constraints rather than screens: **English and Hebrew, structurally mirrored** (§3) and **what the
status strip may claim about git** (§4).

---

## 1. Why

mycontext works by *not* asking you to go anywhere: you capture a rule, and it arrives in a session
weeks later because you opened a matching file. That is the product, and it is why a web UI is
dangerous as well as valuable.

**The failure mode to avoid:** a UI that becomes the primary surface turns mycontext into a wiki with a
Claude integration, and wikis are where knowledge goes to be not-read.

**The test every screen must pass:** does this do something a terminal genuinely *cannot*? Not "is this
nicer" — nicer is real but does not justify a new surface. A prettier `list` is a trap. A scope coverage
map is not, because you cannot see coverage in a table.

**§4 now grades every screen against that test, including the ones that fail it.** Two screens are kept
as deliberate exceptions with the exception written down; two were merged into screens that do pass.
A test the document exempts its own proposals from is not a test.

## 2. Security — the boundary, and what the earlier version got wrong

### What the earlier version said, and why it was wrong

The previous version of this section opened with a reframing: *"The UI hands an agent no capability it
does not already have. An agent that can reach `localhost` is an agent with a shell — and an agent with
a shell can already run `mycontext edit --yes` more easily than it could drive an HTTP API."* It then
permitted the UI to call `createItem`, `updateItem`, `supersedeItem`, `promoteRevision` and
`discardRevision`.

**All three parts of that argument fail, and the conclusion inverted the product's own boundary.**

**1. The boundary is enforced on the command *string*, so an HTTP route is outside it.** `README.md`
§7 is explicit: *"What actually enforces it: your Bash permissions, and nothing else"*
(`README.md:3883`). The recipe it ships is **fourteen `Bash(mycontext … *)` deny rules**
(`README.md:3967-3980`) — `lesson-accept`, `review promote`, `review discard`,
`review promote-revision`, `review discard-revision`, `add`, `supersede`, `refresh`, `edit`, `pin`,
`unpin`, `harden`, `soften`, `repair`. A permission rule is a prefix match on a command string, which is
why that list needs fourteen entries for eight mechanisms — `Bash(mycontext edit *)` does not match
`mycontext pin`, and `Bash(mycontext review promote *)` does not match `review promote-revision`,
because the pattern wants a space where the command has a hyphen. **A `POST /api/…` is not a command
string.** A user who followed that recipe and denied `review promote-revision` would have the protection
**silently removed by installing the UI**. The permitted-function list named `promoteRevision` and
`discardRevision` explicitly: two of the fourteen, reachable with no Bash call and therefore no
permission check.

**2. `promoteRevision` launders origin.** `src/core/revision.ts:1125` applies a promoted revision through
`updateItem` with **`origin: 'human'` hardcoded**, deliberately and correctly — promotion *is* a human
act, and the function's own comment says so. `src/core/mutate.ts:376` (`trustedStatus`) is the whole
draft gate, and it turns on `origin !== 'human'`. Compose the two with an HTTP route and the sequence is:
an agent stages a revision through the MCP surface, where `agentEdits: "review"` holds it as a proposal;
the agent POSTs to a promote endpoint; the proposal applies **as a human edit** to an item that is
already governing. **The agent approves its own proposal.** And it does so with no `--yes` anywhere,
which matters for a reason §7 states in as many words: `--yes` is not a security boundary, what it buys
is *legibility* — *"an explicit, greppable token in the transcript"* (`README.md:3923`). An HTTP request
produces no such token.

**3. "Reaching localhost implies having a shell" is empirically false.** Browser-automation MCP tools
reach `127.0.0.1` and execute JavaScript **inside a page that already holds the token**, with no Bash
call at all. The same is true of a browser extension, an `npm` `postinstall` script, a sandboxed process
whose network is open but whose shell is not the agent's, and another local user: **loopback is not
user-scoped.** The reframing assumed one attacker with one capability set. The port does not check.

**4. The token leaks through a channel the earlier version defended the wrong side of.** It promised the
token is *"never written to disk"* — true, and beside the point. Opening a browser with zero
dependencies means spawning a per-platform command (§3, *Opening the browser*), and on Windows that is
`cmd /c start "" "http://127.0.0.1:PORT/?t=TOKEN"` — the token in a **process command line**, readable by
any local account for the lifetime of the spawn. Not-on-disk is not the property that was needed.

### The boundary, stated as it actually is

Read `README.md` §7 (`README.md:3757`) before implementing anything in this document. In summary, and
each clause verified in the code:

- **The draft gate is `trustedStatus` (`src/core/mutate.ts:376`)**: a non-human origin capturing a
  normative item is forced to `draft` regardless of what it requested, and a draft is in no injection
  tier (`isEligible`, `src/core/select.ts:81`, plus the normative-tier test in `select`).
- **No MCP tool takes an `origin` argument.** `create_item`, `update_item` and `supersede_item` each
  stamp `agent` themselves, so an agent cannot claim to have been a human.
- **The CLI is the human surface, and it passes `origin: 'human'`.** That is what makes it the route
  around every refusal the MCP tools make — and it is why the enforcement lives in Bash permissions.
- **`promoteRevision` (`src/core/revision.ts:1088`) and `discardRevision` (`:1187`) live in
  `revision.ts`, not `mutate.ts`**, and `promoteRevision` stamps `human`. Any test written against a
  "routes through `mutate.ts`" allow-list would fail on its own premise.

### The decision: the UI executes no writes, anywhere

The earlier version already contained the right rule and applied it to only half the document. §4's
*Work* section said *"The UI stays off the write path for anything a human should do deliberately"*;
§8's risk table said write commands are *"composed, not executed"*; §2 permitted five mutating calls.
**Resolved in the direction the rest of the document already pointed.**

> **The UI is read-only over HTTP. No `/api` route calls `createItem`, `updateItem`, `supersedeItem`,
> `linkItems`, `unlinkItems`, `stageRevision`, `promoteRevision` or `discardRevision`, directly or
> transitively. There is no `POST` that changes state on disk.**

Promote, discard, edit, supersede, capture, link, unlink, and every configuration change are
**composed and copied to the console** — the exact treatment the command palette already gave write
commands, with the on-screen note the owner asked for saying plainly that this is a write and must be
run in your own shell.

**The review queue keeps its place, and this is the clearest case for the rule rather than against it.**
What a terminal cannot do is render a two-column diff of a proposed rewrite against the text currently
in force, with the item's injection terms beside it. What a terminal does perfectly well is accept one
line: `mycontext review promote-revision <id> --yes`. **The diff is the capability; the approval is a
paste.** Splitting them that way preserves the deny rules, keeps the greppable token in the transcript,
and deletes this section's entire risk surface along with the argument that justified it.

Three consequences worth stating because each removes something the earlier version needed:

- No question of what `origin` a UI write stamps. There are no UI writes.
- No enumerating-write-endpoint test. The test inverts (§6): **no route reaches a mutating function.**
- The token is still needed — it protects *reads*, and the corpus is not public — but a stolen token
  now buys reading a corpus the thief could read off disk anyway, not a promotion.

**The rejected alternative, recorded honestly.** In-UI writes *could* be made safe: each write shows a
confirmation code printed to the **server's own terminal**, which the user types into the page, so the
capability requires a human at the machine that started the server and an HTTP client alone cannot use
it. That works, and it was rejected — not because it fails, but because **the capability is not worth
reopening the gate Phase 1 built.** A UI write path would be a second door that every future
permission recipe has to remember, and this project has already paid for exactly that shape once:
`extra` became a trust hole because one field bypassed the gate everything else went through.

### 1. Binding beyond loopback

`127.0.0.1` only. **Refuse to start** if configured otherwise, rather than warning.

### 2. DNS rebinding and CSRF

The classic attack on local servers: a malicious page in your browser makes requests to `localhost`.
Standard, well-understood mitigations, all required even though the surface is read-only:

- A token of 32 random bytes, minted per invocation, never written to disk **and never placed on a
  process command line** — see *Opening the browser* in §3 for how the page receives it instead.
- Required in an `X-Mycontext-Token` **header** on every `/api` request. The custom header is the
  defence: a cross-origin form post cannot set one, and with no CORS headers the browser blocks the
  fetch outright.
- `Origin` and `Host` validated on every request.
- The page receives the token in the URL fragment and immediately `history.replaceState`s it away. The
  **fragment** rather than the query string, because a fragment is never sent to the server and never
  appears in a server log or a referrer.

### 3. Ephemerality, and the tab that would have defeated it

A CLI command runs and exits; a server sits there. The earlier version promised the server *"idles out
and exits — not a daemon you forget is running"* and, four paragraphs later, promised a **live stream**
of the audit log. Those two promises are in conflict: a tab left open holds a stream connection, an
idle timer that counts connections never fires, and the daemon you forgot arrives through the front
door. Resolved:

- **Idle means: no `/api` request other than the stream, for 15 minutes.** An open stream connection is
  explicitly **not** activity, and never resets the timer. That is the whole of the fix.
- **The page heartbeats only while visible.** A `GET /api/ping` every 60 seconds, sent only when
  `document.visibilityState === 'visible'`. A tab in a background window stops heartbeating, so a
  forgotten tab stops holding the server up within one idle window.
- **On exit the server closes the stream and the page says so.** It renders "the mycontext UI server has
  exited — restart it with `mycontext ui`" and **does not auto-reconnect**. Silent reconnection would
  reintroduce the daemon by another name.

## 3. Architecture

`mycontext ui [--port N] [--no-open]`. Node's `node:http`. Static assets (hand-written ES modules and
CSS) plus `/api/*` returning JSON. No framework, no build step, **zero runtime dependencies** — the
invariant that makes hooks start in tens of milliseconds and lets the plugin drop into any repo.
`package.json` has no `dependencies` key today, and this must not add one.

### The constraint that keeps it honest

**An endpoint may compose existing functions. It may not reimplement a rule.**

This is the lesson this project has learned most expensively. `matchesScope` had a second implementation
in SQL; an empty scope had thirteen renderings across four surfaces; the draft count disagreed across
four places. Each cost a real defect. A UI that reimplemented selection to render a coverage map would
be the largest instance yet.

**The functions to compose, named, so no screen re-derives one of them:**

| Question | Function | Where |
|---|---|---|
| What would be injected here, and what spills | `select()` | `src/core/select.ts:324` |
| Does this item govern this path | `matchesScope(item, target, config)` | `src/core/select.ts:149` |
| Is this item eligible at all | `isEligible(item, config)` | `src/core/select.ts:81` |
| What does an empty scope mean for this category | `scopePolicyFor(config, type)` | `src/core/config.ts:138` |
| Does an agent's edit apply or wait | `agentEditsFor(config, type)` | `src/core/config.ts:160` |
| Is this item injected, and **on what terms** | `injection(item, config)` | `src/cli/commands/injection.ts:42` |
| Estimated tokens for a body | `estimateTokens()` | `src/core/select.ts:64` |
| What has this session already been given | `Ledger.seen(sessionId)` | `src/core/ledger.ts:166` |
| Which sessions exist, most recent first | `Ledger.recentSessions(n)` | `src/core/ledger.ts:229` |

`injection()` is on that list because it already exists as **the single answer to "is this injected and
on what terms"** — it composes `isEligible`, the normative-tier test, `always`, `scope` and
`emptyScopeInjection(scopePolicyFor(...))`, in the order `select` applies them, and its own comment says
it lives where it does because that fact had a long history of being spelled differently in each place
that needed it. The UI is the third caller, not a fourth spelling.

**The correction that matters most here.** The earlier version said the expensive screens were cheap
because *"the coverage map is `matchesAnyGlob` over a file tree, not a second matcher."* That is
precisely the defect `src/core/select.ts:125-129` documents by name: the `query_items` MCP tool
re-derived scope matching as a bare `matchesAnyGlob(path, item.scope)` *"and consequently kept hiding
unscoped items from a path query long after they had become injectable on that path."* An unscoped item
matches every path under the default `scopePolicy` and no path under `inert`, and `matchesAnyGlob`
cannot know which. **The coverage map calls `matchesScope`.** It also filters on `isEligible` and the
normative tier — via `injection()` — or drafts and rationale items would colour the tree as governing,
which is the same class of false statement in a different medium.

One caveat for the implementer, because it is a real friction rather than an oversight: **`isNormative`
is private** to `select.ts` (`src/core/select.ts:87`). The UI must not copy its one-line body. Either
call `injection()`, which already encapsulates it, or export it — but not both, and never neither.

### `/api/select` — the endpoint the flagship screen rests on

The earlier version specified `/api/select?event=tool&path=X`. **That would have previewed a different
selection than the hook produces, and shown a different spill set**, which is fatal for a screen whose
entire value is "see exactly what Claude gets".

The reason is `seen`. `select()` filters already-injected items **before** budgeting
(`src/core/select.ts:332-333`), and the comment above it says this is Plan 1's hardening and **must not
be reverted**: an already-injected item must not consume budget and spill a fresh one in its place. The
real hook passes `seen: ledger.seen(sessionId)` (`src/hooks/pre-tool-use.ts:138`). Without it, every
item ever injected in the session competes for budget again, and the items that spill are not the items
that would really spill.

**So the endpoint takes a session:** `/api/select?event=tool&path=X&session=<id>`, and passes
`seen: ledger.seen(session)` exactly as the hook does. `event` accepts the same four values `select`
does — `session-start`, `compact`, `tool`, `manual` — and `compact` additionally takes `restore`.

**How the UI picks a session, since it raises multi-session for the status line and must not forget it
here.** One session selector, global to the app, in the header, driving every session-dependent screen:

1. Default to `Ledger.recentSessions(1)[0]` — most recently active, ties broken deterministically on
   `session_id DESC`, so the default is repeatable across page loads.
2. The picker lists `Ledger.recentSessions(20)` with each session's last injection time.
3. A **"cold session"** option, which passes no `seen` at all. This is a legitimate and different
   question — *what would a brand-new session get on this file* — and it is **labelled as that**, never
   presented as the current session's preview.
4. If the ledger is empty, the picker shows only *cold session* and says why.

The session id also keys the status-line bridge's tee'd payload (§4b), so one selector drives both
halves of the join.

### English and Hebrew, structurally mirrored

**A constraint, not a screen, and it belongs here because retrofitting it is the expensive part.**

Every user-facing document in this project is mirrored: `README.md` and `docs/README.he.md`, held in
structural parity by `test/docs/parity.test.ts`, with Hebrew prose inside `<div dir="rtl">` blocks. A UI
that ships "full help and documentation" is as user-facing as this project gets. Retrofitting RTL into
hand-written CSS means auditing every `margin-left`, `padding-right`, `text-align: left` and absolute
offset in the codebase, which is why it is cheap now and expensive later.

- All UI strings live in one module per language, keyed identically. A **test asserts the two key sets
  are equal**, in the spirit of `parity.test.ts` — and, like that test, its docstring states what it
  cannot check: it compares key coverage, never translation freshness.
- The CSS uses **logical properties only** — `margin-inline-start`, `padding-inline`, `text-align: start`,
  `inset-inline-start`. A physical `left`/`right` in a stylesheet is a defect.
- `<html dir>` and `lang` follow the selected language.
- **What is honestly out of scope:** the coverage map's file tree and any code or path rendering stay
  LTR inside an RTL page, because a path is not prose. That is a decision, and the Hebrew UI should not
  be reviewed as though it were a bug.

### Opening the browser

Zero *dependencies*, real work, and the token channel §2 named.

- Per-platform `child_process.spawn`: `cmd /c start "" "<url>"` on Windows — the empty `""` is the
  title argument `start` otherwise consumes from the URL — `open` on macOS, `xdg-open` on Linux.
- **This would be the first `child_process` use in `src/`.** There are none today. Zero dependencies is
  intact; "zero moving parts" is not, and the spec says so rather than letting the reader assume it.
- **The token never appears in the spawned command line.** The URL passed to the opener carries no
  token. The server mints a **one-shot, 10-second handoff nonce**, puts *that* in the URL, and the page
  exchanges it once for the real token, which then lives only in the page's memory. A nonce visible in
  a process list for ten seconds and already spent is not the same object as a session token.
- `--no-open` skips all of it and prints the URL, which is also the fallback when the spawn fails —
  never an error, never a hang.

## 4. Screens

Each screen carries its verdict against §1's test. **Two fail it and are kept as deliberate
exceptions; two were merged into screens that pass.** The grading is here rather than in a review
because a spec that exempts its own proposals from its own test is not applying one.

### Core — the reason to build it

- **Injection preview.** ✅ Pick a file and a session; see exactly what Claude gets, with the budget bar
  and what spilled. Rests on `/api/select` **with `seen`** — see §3, and note that this screen is wrong
  in a way nobody would notice without it.
- **Scope coverage map.** ✅ The file tree coloured by what governs it, via `matchesScope` +
  `injection()`. **The gaps are the point.** It has a second mode — see *File browser*, below.
- **Budget simulator.** ✅ Drag the budget, watch what fits. The 1.0 default-budget change was decided by
  measurement that this screen would have made a five-second exercise.
- **What is currently injected.** ✅ Live state for the selected session, from the ledger, rather than a
  hypothetical.

### Navigate

- **File browser.** ➖ **Merged.** The earlier version conceded it was *"the coverage map made
  navigable"*, which is one screen with a mode, not two. Keeping both invites two implementations of
  one tree. It is now the coverage map's **detail pane**: select a node, get what governs it, what
  would be injected, and links to the items.
- **Relation graph — an ego-graph, not a hairball.** ✅ with a constraint. This is the one screen that
  quietly wanted a library, and the earlier version specified no layout algorithm, no node budget and
  no interaction model, which made it read as free. It is not. **Constrained:** one focused item, a
  radius of 1 or 2, a deterministic layered layout — the focus centred, neighbours ranked by relation
  type — with a hard cap of 60 nodes and an explicit "+N more" rather than a silent truncation. No
  force simulation, no physics, no dependency. Hand-written force-directed SVG is fine on this
  repository's 43 items and unusable at the 5,000 the perf suite uses; an ego-graph is cheap, honest,
  and more useful than a hairball at either size. Dangling edges after a supersede are the thing worth
  seeing and are legible at radius 1.
- **Onboarding view.** ➖ **Merged.** It was `mycontext list`, grouped and styled, justified as *"the
  thing you screenshot"* — which is a marketing need, and marketing needs are not the test §1 sets. It
  survives as **the coverage map's printable rendering**: one page answering *"what governs this
  project"*, generated from the same data, with a print stylesheet. Same artefact, no second
  implementation, and it is still the thing you screenshot.
- **Coverage gaps.** ✅ Which directories have no items, which categories are empty. The inverse of the
  map: it names what is *missing*, which no listing can.

### Watch

- **Audit live.** ✅ Mutations *and* injections, streamed from the audit log. See §2's idle rules: the
  stream does not hold the server open.
- **Status strip.** ⚠️ **Partly.** Injection volume passes — it is derived from the ledger over time and
  no terminal shows it as it moves. The context number passes, **when the status line bridge is
  installed** (§4b); the condition is stated here and not only in §7, because an implementer reading
  this list is the person who builds the strip. **Branch, commit and push status does not pass.** It is
  `git status` in chrome. It is kept as a **deliberate exception** — the owner asked for it, and a
  corpus is meaningless without knowing which branch it belongs to — under one constraint that keeps it
  from becoming a git client:
  - **Read `.git` as files. Do not shell out.** `.git/HEAD` gives the branch, the loose ref or
    `packed-refs` gives the commit, `.git/refs/remotes/<remote>/<branch>` gives the upstream tip. No
    `child_process`, no dependency, no parsing of porcelain output that changes between git versions.
  - **Therefore no ahead/behind counts.** Those need a revision walk, which is not a file read. The
    strip shows *in sync*, *differs from `origin/<branch>`*, or *no upstream* — and nothing more
    precise, because nothing more precise is available under the constraint. Shelling out to
    `git rev-list --left-right --count` is the rejected alternative; it was rejected to keep `git` off
    the dependency-in-spirit list for a decoration.
  - **Never a working-tree status.** Modified/staged/untracked is `git status`, and this is not that.

### Work

- **Command palette.** ✅ Build a command from selections and inputs, with real pickers and a live glob
  tester. **Read commands execute in the UI. Write commands are composed and copied, with a note on
  screen saying plainly that this is a write and must be run in your console.** Per §2 this is now the
  *only* treatment of a write anywhere in the product's UI, not a special case for some of them.
- **Review queue and staged-revision diffs.** ✅ The clearest instance of the rule in §2: the diff is
  what a terminal cannot do, the approval is one line pasted into a shell. The queue shows the proposed
  text against the text in force, per field, marks stale fields (staleness is per field — a title
  proposal beside a stale body proposal is still promotable), and composes
  `mycontext review promote-revision <id> --yes` or the discard beside it. **It does not promote.**
- **Overlap detection at capture.** ✅ Surface two items saying nearly the same thing, **before** the
  second is filed. Since `type` is fixed at creation and there is no retype, a duplicate filed under the
  wrong category cannot be cleanly undone — only superseded. Catching it at capture is worth more than
  any report. It composes the `mycontext add` command; it does not run it.

### Configure — the strongest "a terminal cannot do this" screen available

**Absent from the earlier version entirely**, and the owner named it in his first sentence.

There is no `mycontext config` command. `config.json` is hand-edited — the deny hook says so in the
words it refuses with: *"Configuration changes to `.my_context/config.json` are the user's to make — ask,
do not edit"* (`src/hooks/pre-tool-use.ts:97`). So today, changing `scopePolicy` from `global` to
`inert`, or `agentEdits` from `review` to `allow`, or a budget, means editing JSON and finding out what
it did by living with it.

**A validating config editor that shows what a change would do to the current corpus, before it is
made.** Every input to that answer is a pure function of items and config — `matchesScope`,
`scopePolicyFor`, `agentEditsFor`, `injection`, `select` — so the preview is exact rather than
estimated, and needs no writes to compute:

- **`scopePolicy` per category.** Switching to `inert` makes every unscoped item of that category
  injectable on no path at all. The editor names them: *"7 items become injectable nowhere"*, with the
  list. That is the difference between a considered change and a silent one, and it is not visible in
  any table.
- **`agentEdits` per category.** `allow` versus `review` — which items an agent could rewrite in place
  from tomorrow, counted and named.
- **`budgets`.** The same simulation the budget simulator runs, over all four tiers, showing what starts
  spilling.
- **`enabled` and `tier`.** Disabling a category, or moving one between `normative` and `rationale`,
  changes what is injected at all. Shown as a diff of the governing set, not as a warning.
- **Validation.** The editor refuses an invalid value against the same enums `resolveConfig` uses, with
  the same wording, rather than letting the file be saved and the CLI complain later.

**And it composes; it does not write.** Consistent with §2, the editor produces the resulting
`config.json` — or the minimal diff — for the user to paste, with the note on screen. That is not a
weaker version of the feature: the deny hook already declares this file the user's to change, and a UI
that wrote it would be arguing with a rule this product enforces against its own agent.

### Report

Queries were covered; the three reporting commands had no screen at all.

- **`doctor`.** ✅ Its findings are a list, but its *shape* is not. `src/doctor/checks.ts` emits findings
  carrying a `code` — `index_stale`, `orphan_relation`, `source_drift`, `source_missing`, `dead_scope`,
  `not_writable`, `session_id_mismatch`, `unknown_category`, `scope_policy_inert` and the rest — across
  three levels, all collapsed at the end into a single exit code (`doctor.ts:33`). The screen groups by
  `code`, keeps the three levels visually distinct, and links each finding to the item it names and to
  the command that repairs it (composed, not run). A findings list flattened to "exit 1" is exactly the
  kind of structure a terminal loses.
- **`status`.** ⚠️ **Exception.** Corpus counts, the draft queue and the pending-revisions line are a
  table, and a table is a terminal's home ground. Kept because it is the landing screen and something
  has to be, and recorded here as an exception rather than dressed up as a capability.
- **`decay`.** ✅ **Decay over time is a chart, not a table**, and this is the clearest win in the
  section. The ledger stores `injected_at` per `(session_id, item_id, tier)` (`src/core/ledger.ts:28`),
  so injections per item over time is a real series, and "this rule has not been injected in six weeks"
  is a shape you see instantly and read out of a table never. The chart carries `decay`'s own caveat
  about its window — a report that hides its measurement window overstates its confidence.

### Ask

- **Structured query builder** ✅ with predefined useful queries, over the corpus **and over the audit
  history**. Filters for people who do not write SQL, with the generated SQL shown so it teaches.
  Reuses the existing read-only path; the `updated_at` trap is already documented and must be carried.
  Audit queries do **not** read the JSONL log directly — they read the SQLite projection derived from it
  (§5), and every audit answer will carry the projection's freshness, because a projection that is behind
  its log must either rebuild or say so rather than answer quietly.

### Learn

- **Full help and documentation with examples, in the UI.** ⚠️ **Conditional pass.** Rendering
  `mycontext help <topic>` in a browser is `mycontext help <topic>` in a browser. It passes §1's test
  **only** in the form specified here: **every help topic cross-links to your own corpus.** The `scope`
  topic shows the items in *this* project that declare a scope and the ones that do not, with what that
  means under this project's `scopePolicy`. The `categories` topic shows how many items you have of each
  and which of your categories are empty. The `capture` topic links to your most recent captures. That
  join — generated guidance against your actual corpus — is what a terminal cannot do, and it is the
  whole justification. **Built without it, this screen is a documentation viewer and should be cut.**

## 4b. The status line bridge — opt-in

The correction carried forward from the previous pass: an earlier version of this spec stated flatly
that the UI **cannot see Claude's context usage** and made it a non-goal. That claim was reasoned from
hooks, and for hooks it holds — but it generalised from "hooks cannot see it" to "the UI cannot see it",
and a status line command is handed the number on stdin. The number is reachable, through a surface
mycontext does not install by default. **The owner's decision is to ship the bridge and make it
opt-in.** Installing mycontext will not take over a status line; asking for the bridge will.

> **External claims, marked as external.** Everything in this subsection about *Claude Code's* payload
> schema — that no hook event carries a token, context or cost field; that `PreCompact` carries only
> `triggered_by`; that a status line command receives a `context_window` object with the fields listed
> below — is a claim about **another product's** interface. **This repository cannot confirm any of it**,
> and no test here will fail when it changes. It was checked against Claude Code's documentation, and
> the Claude Code present when this pass was written was **2.1.233**. An implementer must **re-check
> against the version they are building on and update the version recorded here**, because the
> alternative is a spec that ages into a false statement without anyone touching it. What this
> repository *can* confirm is the other half: `HookInput` (`src/hooks/io.ts:3-12`) declares
> `session_id`, `transcript_path`, `cwd`, `hook_event_name`, `source`, `tool_name` and `tool_input`, and
> nothing resembling a token count.

Claude Code runs a configured status line command and passes it a JSON payload on stdin. That payload is
documented to carry what hooks do not: a `context_window` object with `total_input_tokens`,
`total_output_tokens`, `context_window_size`, `used_percentage`, `remaining_percentage` and a
`current_usage` breakdown, plus `cost.total_cost_usd`, session durations, lines added and removed, and
`rate_limits`.

`mycontext statusline` will do two things with each invocation:

1. **Tee the payload** to a per-session file keyed by the payload's `session_id`. Keying by session is
   not tidiness — two Claude sessions open on the same project would otherwise overwrite each other's
   sample, and the UI would show one session's context as another's. It is also the same key the UI's
   session selector (§3) and the ledger (`PRIMARY KEY (session_id, item_id, tier)`) already use, so
   one identifier joins all three.
2. **Print a useful line**: the model, the context used, and how much of that mycontext put there.

### The join is the feature

The tee'd payload is not interesting on its own; Claude Code already shows the context number. What is
new is that **the same `session_id` appears in the audit log's injection records**, so the real context
number can be joined to what the hooks actually injected. That join is what lets the UI say:

> of 47k tokens in use, 6.2k came from your project knowledge.

**Correction: the earlier version said `session_id` *and `prompt_id`*.** There is no `prompt_id`. It
appears in exactly one file in this repository, and that file was this spec. The hook payload has no
prompt identifier (`src/hooks/io.ts:3-12`), §4b's own status-line field list never mentioned one, and
nothing in `src/` reads or writes one. **The join is on `session_id` alone**, which is sufficient for
the sentence above and is the granularity the ledger already keys on. A finer join — this injection
against that turn — would need a per-turn identifier that neither side produces, and the spec must not
imply one exists.

Neither half can say that alone. The status line knows the total and nothing about its provenance; the
audit log knows mycontext's contribution and nothing about the total. **Nothing else in the system can
produce that sentence**, which is exactly the bar §1 sets for a screen existing at all.

### Three honesty constraints

These are constraints on the implementation, not caveats in the docs. A build that violates one is wrong,
not merely unpolished.

1. **Every displayed context number is labelled "as of last response", with the sample's age.** The
   status line is invoked at assistant-message boundaries, so the number is a snapshot, and during a long
   tool-heavy turn it **under-reports** — which is precisely when someone is watching it climb. The label
   carries that condition; the UI **never interpolates or extrapolates between samples** to make the
   number look live.
2. **A distinct "not yet known" state after a compact.** `current_usage` is `null` until the next API
   call, and rendering that as zero would be a lie in the direction of reassurance. The state is its own
   rendering, not a value.
3. **The percentage is computed input-only** — `input + cache_creation + cache_read` over
   `context_window_size` — matching what Claude Code itself displays. Folding output tokens in yields a
   plausible-looking number that disagrees with the one on the user's own status line, which is worse
   than showing nothing.

### Compatibility

`context_window` is a later addition than the status line feature itself, so older Claude Code builds
send a payload without it. The command **gates on the payload's `version` field and null-checks
`context_window` before reading it**, and falls back to **"unknown"** — never to zero. Same rule as
constraint 2: an absent measurement is a state, not a value.

Optionally the installed setting sets `refreshInterval`, so the tee'd file stays fresh while a session
sits idle and the UI's "as of" age does not drift for no reason.

## 5. The live watch — resolved, not deferred

The brainstorm considered three mechanisms: hooks writing always, hooks writing only when a sentinel
file exists, or the UI tailing the session ledger. **The owner's answer removed the choice.**

Because decision Q3 has the audit log record mutations and hook actions including injections, the audit
log *is* the stream. The UI tails it. There is one mechanism, not three competing ones, and the ledger's
weakness (it records what was injected, not what was *considered*) is answered by the audit log
recording the hook action itself.

### The record shape, pinned

The earlier version described the injection record as *"scope, not content"*. `docs/ROADMAP.md:172` and
`:297` both record the decision as **"the injection's scope, tier and item ids, not its content"**. The
spec dropped two of the three fields, and each is load-bearing:

- **Without item ids the audit view cannot name what was injected.** It could only say *something was*.
- **Without item ids, §4b's numerator has to be re-derived from the items as they are now**, which is
  wrong for anything edited, superseded or retired since the injection happened — and the sentence
  "6.2k came from your project knowledge" would silently drift for exactly the corpus that is being
  maintained most actively.

**Pinned: `scope`, `tier`, `item ids`, timestamp, `session_id`, and the event that triggered it.** Never
item content — that is the half of the decision the earlier wording did get right, and it is what keeps
the log small enough for the hot path.

**One open extension, flagged rather than assumed.** §4b's sentence needs a token count for mycontext's
contribution. Deriving it later from the items as they are now has the same drift problem as the ids
would. The natural fix is for the record to carry the **estimated token count computed at injection
time** (`estimateTokens`, `src/core/select.ts:64`) — one integer per record. **That extends the recorded
Q3 shape by a field and therefore needs the owner's assent**; it is written here as a proposal, not as a
decision already taken. If it is refused, §4b's sentence must be re-scoped to item counts rather than
tokens, and it must not quietly re-derive tokens from the present corpus instead.

### The hot-path cost — corrected numbers

**What still needs measuring**, and it is one question rather than three: *what does writing one audit
record cost on the hot path?* The hooks run on every tool call under a 50ms p95 ceiling
(`test/perf/jit-latency.perf.ts:65`) and must fail open. The record is small by design.

**The earlier version cited "5,000 items where JIT selection alone costs ~11ms". That mixed two
different measurements and made the budget look roomier than it is.**

- `test/perf/jit-latency.perf.ts:262` asserts the **selector** under **10ms** on a 5,000-item corpus.
  That is `select()` alone, in-process, with no I/O.
- The 11.0 / 14.5 / 10.7ms figures the spec quoted are **whole-hook** p95s recorded in that file's
  header (`:37-38`) — process start, workspace resolution, SQLite open, selection, render, ledger write.
- **The number that binds is the hit-path p95: ~20.7–22.7ms across two runs (`:23`), against the 50ms
  ceiling.**

So the hot path already spends roughly **45% of its budget**, leaving about **27ms**, not the ~39ms the
old figure implied. That is still comfortable room for one appended line, and it is a materially
different starting point for the measurement. Measure at the sizes the perf suite already uses
(`CORPUS_SIZE = 5000`, `:61`), reporting the **hook** p95 before and after, not the selector's.

**Mutations are free.** A capture, a promote, a supersede happens a few times an hour, not thousands of
times a session. The audit view can be live for mutations with no hot-path cost at all. **Only the
injection half carries risk**, which is a much smaller problem than the one this started as.

### Where the audit log lives — JSONL is the truth, SQLite is a projection

**The log is JSONL and it is the source of truth. A SQLite database is projected from it, is derived, and
is disposable.** The hook appends one line: one syscall, no connection to open, no schema to migrate. A
kill mid-write damages the tail and nothing else, and the file stays greppable and tailable by hand. The
projection is rebuilt from the log whenever it is stale, and deleting it loses nothing.

Three reasons, and they are the design rather than a rationale added afterwards:

1. **The hot path.** Opening a connection, inserting and closing on every tool call is measurably more
   work than an append, against the 50ms p95 ceiling and its remaining ~27ms above. The append is the
   shape that fits the budget; the query engine sits off the hot path where it costs nothing.
2. **It is the invariant the product already runs on.** `INV-markdown-is-the-source-of-truth` — Markdown
   is truth, the index is derived and disposable. The audit takes the same shape and inherits the same
   recovery story users already know: *delete it, it rebuilds*.
3. **It closes a trap — and the trap is not the one this spec named.**

**The third reason was right; its mechanism was wrong, and the correction matters because this project
had already made it.** The earlier version said: *"Had audit records lived in `.index.db`, then `rebuild`
— which the product tells users to run freely, and which every `query` runs implicitly — would have
destroyed audit history."*

**`rebuild` drops `items` and nothing else.** `src/core/rebuild.ts:457` calls `store.deleteByLayer`,
which is `DELETE FROM items WHERE layer = ?` (`src/core/store.ts:442`). The `ledger` table
(`src/core/ledger.ts:28`) lives in the same file and **survives a rebuild untouched.** The half of the
claim that is true is the parenthesis: `query` (`src/cli/commands/query.ts:306`) and `context`
(`src/cli/commands/context.ts:73`) do each run a rebuild implicitly — and it is harmless to history.

**`docs/ROADMAP.md:203` already recorded the corrected fact**, in the C-R4 row, against a README bullet
that had made a related error. Restating the wrong mechanism here contradicted this project's own
correction, in a document written after it.

**The real destroyers, both of which delete the database file whole:**

- **`Store.open`'s corruption self-heal** (`src/core/store.ts:295`): on an unreadable file it `rmSync`s
  the db plus its `-wal` and `-shm` and recreates it. The code says so in a comment on the very branch —
  *"a successful clear here discards not just the disposable `items` cache but also whatever `ledger`
  rows the file held"*. It is the right behaviour: without it a corrupt index silences the plugin
  permanently. It is also unattended, and it takes the history with it.
- **The documented recovery.** `README.md:1237` — *"Delete it and `mycontext rebuild` recreates it from
  the Markdown"* — and `README.md:4139`, which states the consequence for the ledger plainly: *"delete
  the index and the injection history goes with it."*

**The conclusion survives intact with the right mechanism substituted.** A file the product invites you
to delete, and deletes by itself on corruption, is the wrong home for the one record of what happened.
Separating truth from projection removes that, and it removes it against a real destroyer rather than an
imagined one.

**An open question, being measured rather than answered here.** SQLite supports `jsonb`, which may let
the projection store each record whole and index into it, instead of shredding fields into columns and
re-deciding the schema every time the record shape grows. That matters because mutation records and
hook-action records genuinely have different shapes, and a single flat table for both would be a
compromise. **Phase 5 is measuring what `node:sqlite` on Node 24 actually supports.** The spec records
the question and that it is under measurement; it does not assert the outcome.

**A constraint on the projection: staleness must be detectable and never silent.** The projection records
its position in the log, and a query answered from a projection that is behind its log **either rebuilds
first or tells the caller it is behind**. It may not quietly return an answer that is missing the most
recent records — a partial audit answer presented as complete is worse than no audit view.

## 6. Testing

- Endpoints tested as the MCP server is: spawn a real process, make real requests.
- **Security assertions are first-class**: wrong token, missing header, bad `Origin`, non-loopback bind,
  and the handoff nonce refused on second use and after its 10-second window.
- **The write test inverts.** The earlier version specified *"a test enumerating every write endpoint,
  asserting it routes through `mutate.ts`"* — which was doubly wrong: §2 now permits no write endpoints
  at all, and the allow-list would have failed on its own premise, since `promoteRevision` and
  `discardRevision` live in `revision.ts` (`:1088`, `:1187`), not `mutate.ts`. Replaced by the
  assertion the rule actually needs: **no module reachable from the request handler imports or calls
  `createItem`, `updateItem`, `supersedeItem`, `linkItems`, `unlinkItems`, `stageRevision`,
  `promoteRevision` or `discardRevision`** — a static check over the import graph from the server entry
  point, so a write cannot be added without the test noticing.
- **`/api/select` equals `select()` — restated so it is implementable.** *"Byte-identical"* was
  impossible as written: `select()` returns objects, not bytes, and a test can only compare a
  serialization. Restated: **`assert.deepEqual(JSON.parse(responseBody), JSON.parse(JSON.stringify(select(items, ctx, config))))`**
  for a matrix of events, paths and `seen` sets, including at least one case where a non-empty `seen`
  changes the spill set — which is the case the endpoint's old signature could not have passed. Fixing
  the wording is not pedantry: left as it was, it gets quietly reinterpreted at build time, and quiet
  reinterpretation is the failure this section exists to prevent.
- **A parity test over the two UI string tables** (§3), asserting equal key sets — with a docstring
  stating, as `parity.test.ts` does, that it checks coverage and never translation freshness.

**A limit stated rather than papered over:** the view modules' pure logic is testable; the *rendering*
is not, without a browser dependency this project does not have. That is a real gap in coverage and the
test file should say so.

## 7. What this is not

- Not a replacement for the CLI or the slash commands. Every screen must justify itself against "a
  terminal cannot do this" — and §4 records the two screens kept as exceptions to it rather than
  pretending the list is clean.
- Not multi-user. Single developer, one machine, localhost, ephemeral. No accounts, no identity, no
  hosting.
- **Not a write path at all** — see §2. Not "not a write path of its own", which was the earlier
  formulation and was compatible with the five mutating calls §2 then permitted.
- Not a git client. Branch and commit are read from `.git` as files; there are no ahead/behind counts and
  no working-tree status (§4).
- **Not an unconditional context meter.** An earlier version listed "not a context meter" flatly; that
  was wrong, and §4b says why. What holds instead, stated with its condition attached per
  `STD-guarantee-claims-carry-their-condition-in-the-same-sentence`: **when the status line bridge is
  installed, the UI shows Claude's real context number, labelled with the condition it was measured
  under; without the bridge, it shows only what mycontext injected and says so.** The Watch entry in §4
  carries the same condition inline, because the person building the strip reads §4, not §7.

## 8. Risks

| Risk | Mitigation |
|---|---|
| The UI becomes the primary surface and the product inverts | Every screen graded against "a terminal cannot do this" in §4, exceptions named; the CLI and slash surfaces stay complete |
| **A UI write silently voids the user's Bash deny rules** | **There are no UI writes.** No `/api` route reaches a mutating function, enforced by a static import-graph test (§6); every write is composed and pasted into a shell, so it stays a command string the deny rules can match |
| **An agent promotes its own proposal over HTTP** | Closed by the same rule. `promoteRevision` stamps `origin: 'human'` (`revision.ts:1125`) and would have laundered origin through any endpoint that called it; nothing calls it |
| DNS rebinding / CSRF | Custom-header token, no CORS, `Origin` and `Host` validated, loopback-only bind |
| The token leaks through the browser-opening command line | The spawned URL carries a one-shot 10-second handoff nonce, not the token; the token never touches a process argument list (§3) |
| A forgotten server left running | Idle is defined as no non-stream request for 15 minutes; **an open stream is not activity**; the page heartbeats only while visible; on exit the page says so and does not reconnect (§2) |
| Audit writes slow the hot path | Measured before committing to always-on, against the corrected budget — hit-path p95 ~20.7–22.7ms of 50ms, ~27ms remaining — and the hook appends one JSONL line rather than opening a database (§5) |
| The audit projection answers from stale data without saying so | The projection records its log position; a query behind its log rebuilds or reports that it is behind (§5) |
| **The audit view cannot name what was injected** | The record shape is pinned to scope, tier **and item ids** per `docs/ROADMAP.md:172`, so the view never re-derives from the present corpus (§5) |
| **The injection preview shows a selection Claude never got** | `/api/select` takes a session and passes `seen: ledger.seen(session)`, as the hook does; a cold-session preview exists and is labelled as one (§3) |
| A screen shows a context number that is wrong, stale or invented | Shown only when the bridge is installed, labelled "as of last response" with the sample's age, never interpolated, input-only, with distinct "not yet known" and "unknown" states (§4b) |
| Installing the bridge overwrites a `statusLine` the user already configured | Opt-in, never installed as a side effect; the installer **prints the existing setting and what it would replace it with, and asks, before writing** |
| The relation graph becomes a hairball or acquires a dependency | Ego-graph only: one focus, radius 1–2, deterministic layered layout, 60-node cap with explicit truncation, no simulation (§4) |
| RTL retrofitted into hand-written CSS | Logical CSS properties from the first stylesheet; one string table per language with a key-parity test (§3) |
| Rendering is untested | Stated in the test file rather than implied by a green suite |

## 9. Decided, so no implementer has to guess

The review that produced this pass ranked ten open questions. Five were not open — they were decided
facts that the document had left implicit, which is how an implementer ends up choosing. They are
recorded here as decisions.

1. **What `origin` does a UI write stamp?** **None — there are no UI writes** (§2). The question was the
   symptom; the answer removed it.
2. **Does the review queue promote over HTTP?** **No.** It renders the diff and composes
   `mycontext review promote-revision <id> --yes` for the user's own shell (§2, §4).
3. **Which function answers "does this item govern this path"?** **`matchesScope(item, target, config)`**
   (`src/core/select.ts:149`), filtered by **`isEligible`** (`:81`) and the normative-tier test, which
   **`injection()`** (`src/cli/commands/injection.ts:42`) already composes in `select`'s own order.
   **Not `matchesAnyGlob`** — that is a defect `select.ts:125-129` documents by name (§3).
4. **Where does the audit log live, and what is in a record?** **JSONL is the source of truth; SQLite is
   a disposable projection that records its position in the log.** An injection record carries scope,
   tier, item ids, timestamp, `session_id` and the triggering event — never item content. The estimated
   token count is a proposed extension awaiting the owner's assent (§5).
5. **How does the UI select a session?** **One global selector**, defaulting to
   `Ledger.recentSessions(1)[0]`, listing 20, with an explicit **cold-session** option that passes no
   `seen` and is labelled as a different question. The same `session_id` keys the ledger, the audit
   records and the status-line tee (§3, §4b).
