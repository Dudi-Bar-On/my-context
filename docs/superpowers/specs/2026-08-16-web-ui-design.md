# mycontext web UI — design

**Date:** 2026-08-16
**Status:** decisions taken in brainstorming; pending user review
**Target:** v2.0, after 1.0.0 ships
**Depends on:** the run-time audit log (1.0 Phase 5, decision Q3)

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

## 2. Security

### The reframing that makes this tractable

**The UI hands an agent no capability it does not already have.** An agent that can reach `localhost` is
an agent with a shell — and an agent with a shell can already run `mycontext edit --yes` more easily
than it could drive an HTTP API. A UI whose writes go through the same functions the CLI calls is
*exactly as safe as the CLI is today*. It adds a second path to the same door, not a new door.

There are three ways it becomes worse, and all three are avoidable.

### 1. The UI grows its own write path

**This is the real risk**, and this project has already been bitten by it: `extra` became a trust hole
precisely because one field bypassed the gate everything else went through.

**The rule is absolute: the UI calls `createItem`, `updateItem`, `supersedeItem`, `promoteRevision`,
`discardRevision` and nothing else.** No parallel validation. No "the UI knows better" shortcut. If a
write cannot go through the existing gate, the UI cannot do it either. A test enumerates every write
endpoint and asserts it.

### 2. Binding beyond loopback

`127.0.0.1` only. **Refuse to start** if configured otherwise, rather than warning.

### 3. DNS rebinding and CSRF

The classic attack on local servers: a malicious page in your browser makes requests to `localhost`.
Standard, well-understood mitigations, all required:

- A token of 32 random bytes, minted per invocation, **never written to disk**.
- Required in an `X-Mycontext-Token` **header** on every `/api` request. The custom header is the
  defence: a cross-origin form post cannot set one, and with no CORS headers the browser blocks the
  fetch outright.
- `Origin` and `Host` validated on every request.
- The page receives the token in the URL and immediately `history.replaceState`s it away.

### Ephemerality

A CLI command runs and exits; a server sits there. `mycontext ui` starts on demand, idles out, and
exits — not a daemon you forget is running.

Every UI write lands in the audit log with its origin, so the UI is the one surface where the product
shows you exactly what it did.

## 3. Architecture

`mycontext ui [--port N] [--no-open]`. Node's `node:http`. Static assets (hand-written ES modules and
CSS) plus `/api/*` returning JSON. No framework, no build step, **zero runtime dependencies** — the
invariant that makes hooks start in tens of milliseconds and lets the plugin drop into any repo.

### The constraint that keeps it honest

**An endpoint may compose existing functions. It may not reimplement a rule.**

This is the lesson this project has learned most expensively. `matchesScope` had a second implementation
in SQL; an empty scope had thirteen renderings across four surfaces; the draft count disagreed across
four places. Each cost a real defect. A UI that reimplemented selection to render a coverage map would
be the largest instance yet.

So `/api/select?event=tool&path=X` calls `select()` — the same pure function the JIT hook calls. **That
one endpoint is the injection preview**, and it is why the expensive-sounding screens are cheap: the
coverage map is `matchesAnyGlob` over a file tree, not a second matcher.

A test asserts `/api/select`'s output is byte-identical to calling `select()` directly, so the rule is
enforced rather than intended.

## 4. Screens

### Core — the reason to build it

- **Injection preview.** Pick a file; see exactly what Claude gets, with the budget bar and what spilled.
- **Scope coverage map.** The file tree coloured by what governs it. **The gaps are the point.**
- **Budget simulator.** Drag the budget, watch what fits. The 1.0 default-budget change was decided by
  measurement that this screen would have made a five-second exercise.
- **What is currently injected.** Live state rather than a hypothetical.

### Navigate

- **File browser.** Browse the repo; for any file, what governs it, what would be injected, and a jump
  to the items. The coverage map made navigable rather than only coloured.
- **Relation graph.** What blocks, constrains or depends on what. Dangling edges after a supersede.
- **Onboarding view.** One page answering *"what governs this project"* — grouped, readable, printable.
  Also the thing you screenshot to show someone what mycontext is.
- **Coverage gaps.** Which directories have no items, which categories are empty. The inverse of the
  map: it names what is *missing*.

### Watch

- **Audit live** — mutations *and* injections, streamed from the audit log.
- **Status strip** — branch, commit and push status, corpus counts, injection volume.

> **A limit that was overstated, corrected here rather than quietly dropped.** An earlier version of this
> spec stated flatly that the UI **cannot see Claude's context usage**, and made it a non-goal. That claim
> was reasoned from hooks, and for hooks it holds: checked against Claude Code's documentation, **no hook
> event schema carries a token, context or cost field.** `PreCompact` carries only `triggered_by` — it
> says compaction is happening, not how full the window was. What the claim got wrong was generalising
> from "hooks cannot see it" to "the UI cannot see it". A **status line** command is handed a
> `context_window` object on stdin, so the number is reachable — through a surface mycontext does not
> install by default.
>
> **§4b covers that bridge.** Absent it, the Watch screens show only what *mycontext injected* — items,
> tiers, estimated tokens, what spilled — and no label may present that as Claude's context meter.

### Work

- **Command palette.** Build a command from selections and inputs, with real pickers and a live glob
  tester. **Read commands execute in the UI. Write commands are composed and copied, with a note on
  screen saying plainly that this is a write and must be run in your console.** The UI stays off the
  write path for anything a human should do deliberately — and the palette is useful without being a
  shell.
- **Review queue and staged-revision diffs.** Approving an agent's proposed rewrite is workable in a
  terminal and comfortable here.
- **Overlap detection at capture.** Surface two items saying nearly the same thing, **before** the
  second is filed. Since `type` is fixed at creation and there is no retype, a duplicate filed under the
  wrong category cannot be cleanly undone — only superseded. Catching it at capture is worth more than
  any report.

### Ask

- **Structured query builder** with predefined useful queries, over the corpus **and over the audit
  history**. Filters for people who do not write SQL, with the generated SQL shown so it teaches.
  Reuses the existing read-only path; the `updated_at` trap is already documented and must be carried.
  Audit queries do **not** read the JSONL log directly — they read the SQLite projection derived from it
  (§5), and every audit answer will carry the projection's freshness, because a projection that is behind
  its log must either rebuild or say so rather than answer quietly.

### Learn

- **Full help and documentation with examples, in the UI.** The help topics and category guidance
  already exist as generated content; this renders them rather than duplicating them.

## 4b. The status line bridge — opt-in

The correction in §4 leaves a design decision rather than a fact: the number exists, and mycontext can
reach it only by occupying a surface that belongs to the user. **The owner's decision is to ship the
bridge and make it opt-in.** Installing mycontext will not take over a status line; asking for the bridge
will.

Claude Code runs a configured status line command and passes it a JSON payload on stdin. That payload
carries what hooks do not: a `context_window` object with `total_input_tokens`, `total_output_tokens`,
`context_window_size`, `used_percentage`, `remaining_percentage` and a `current_usage` breakdown, plus
`cost.total_cost_usd`, session durations, lines added and removed, and `rate_limits`.

`mycontext statusline` will do two things with each invocation:

1. **Tee the payload** to a per-session file keyed by the payload's `session_id`. Keying by session is
   not tidiness — two Claude sessions open on the same project would otherwise overwrite each other's
   sample, and the UI would show one session's context as another's.
2. **Print a useful line**: the model, the context used, and how much of that mycontext put there.

### The join is the feature

The tee'd payload is not interesting on its own; Claude Code already shows the context number. What is
new is that **the same `session_id` and `prompt_id` appear in the audit log's injection records**, so the
real context number can be joined to what the hooks actually injected. That join is what lets the UI say:

> of 47k tokens in use, 6.2k came from your project knowledge.

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

Because decision Q3 has the audit log record **mutations and hook actions including injections — the
injection's scope, not its content** — the audit log *is* the stream. The UI tails it. There is one
mechanism, not three competing ones, and the ledger's weakness (it records what was injected, not what
was *considered*) is answered by the audit log recording the hook action itself.

**What still needs measuring**, and it is one question rather than three: *what does writing one audit
record cost on the hot path?* The hooks run on every tool call under a 50ms p95 ceiling and must fail
open. The record is small by design. Measure at the sizes the perf suite already uses, including 5,000
items where the JIT selection alone costs ~11ms.

**Mutations are free.** A capture, a promote, a supersede happens a few times an hour, not thousands of
times a session. The audit view can be live for mutations with no hot-path cost at all. **Only the
injection half carries risk**, which is a much smaller problem than the one this started as.

### Where the audit log lives — JSONL is the truth, SQLite is a projection

The owner has since decided the storage, and it changes what the UI queries.

**The log is JSONL and it is the source of truth. A SQLite database is projected from it, is derived, and
is disposable.** The hook appends one line: one syscall, no connection to open, no schema to migrate. A
kill mid-write damages the tail and nothing else, and the file stays greppable and tailable by hand. The
projection is rebuilt from the log whenever it is stale, and deleting it loses nothing.

Three reasons, and they are the design rather than a rationale added afterwards:

1. **The hot path.** Opening a connection, inserting and closing on every tool call is measurably more
   work than an append, against the 50ms p95 ceiling above. The append is the shape that fits the budget;
   the query engine sits off the hot path where it costs nothing.
2. **It is the invariant the product already runs on.** `INV-markdown-is-the-source-of-truth` — Markdown
   is truth, the index is derived and disposable. The audit takes the same shape and inherits the same
   recovery story users already know: *delete it, it rebuilds*.
3. **It closes a trap.** Had audit records lived in `.index.db`, then `rebuild` — which the product tells
   users to run freely, and which **every `query` runs implicitly** — would have destroyed audit history.
   A routine, encouraged, implicit command silently deleting the one record of what happened is exactly
   the class of defect this project keeps paying for. Separating truth from projection removes it.

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
- **Security assertions are first-class**: wrong token, missing header, bad `Origin`, non-loopback bind.
- A test enumerating every write endpoint, asserting it routes through `mutate.ts`.
- A test asserting `/api/select` equals `select()` called directly.

**A limit stated rather than papered over:** the view modules' pure logic is testable; the *rendering*
is not, without a browser dependency this project does not have. That is a real gap in coverage and the
test file should say so.

## 7. What this is not

- Not a replacement for the CLI or the slash commands. Every screen must justify itself against "a
  terminal cannot do this."
- Not multi-user. Single developer, one machine, localhost, ephemeral. No accounts, no identity, no
  hosting.
- Not a write path of its own — see §2.
- **Not an unconditional context meter.** The earlier version of this spec listed "not a context meter"
  flatly; that was wrong, and §4 says why. What holds instead, stated with its condition attached per
  `STD-guarantee-claims-carry-their-condition-in-the-same-sentence`: **when the status line bridge is
  installed, the UI shows Claude's real context number, labelled with the condition it was measured
  under; without the bridge, it shows only what mycontext injected and says so.** See §4b.

## 8. Risks

| Risk | Mitigation |
|---|---|
| The UI becomes the primary surface and the product inverts | Every screen passes "a terminal cannot do this"; the CLI and slash surfaces stay complete |
| A second write path drifts from the gates | Writes call `mutate.ts` only, enforced by an enumerating test; write commands in the palette are *composed, not executed* |
| DNS rebinding / CSRF | Custom-header token, no CORS, `Origin` and `Host` validated, loopback-only bind |
| A forgotten server left running | Ephemeral by design: idle timeout and exit |
| Audit writes slow the hot path | Measured before committing to always-on; the record is scope-not-content by decision Q3, and the hook appends one JSONL line rather than opening a database (§5) |
| The audit projection answers from stale data without saying so | The projection records its log position; a query behind its log rebuilds or reports that it is behind (§5) |
| A screen shows a context number that is wrong, stale or invented | The number is shown only when the bridge is installed, labelled "as of last response" with the sample's age, never interpolated, input-only, with distinct "not yet known" and "unknown" states (§4b) |
| Installing the bridge overwrites a `statusLine` the user already configured | Opt-in, never installed as a side effect; the installer **prints the existing setting and what it would replace it with, and asks, before writing** |
| Rendering is untested | Stated in the test file rather than implied by a green suite |
