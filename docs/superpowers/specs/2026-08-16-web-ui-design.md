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

> **An honest limit, stated here so no screen implies otherwise.** The UI **cannot see Claude's context
> usage.** It has no view into a session's token count. It can show what *mycontext injected* — items,
> tiers, estimated tokens, what spilled. That is useful and derivable, and it is **not** the same number
> as Claude's context meter. No label may suggest it is.

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

### Learn

- **Full help and documentation with examples, in the UI.** The help topics and category guidance
  already exist as generated content; this renders them rather than duplicating them.

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
- Not a context meter — see §4.

## 8. Risks

| Risk | Mitigation |
|---|---|
| The UI becomes the primary surface and the product inverts | Every screen passes "a terminal cannot do this"; the CLI and slash surfaces stay complete |
| A second write path drifts from the gates | Writes call `mutate.ts` only, enforced by an enumerating test; write commands in the palette are *composed, not executed* |
| DNS rebinding / CSRF | Custom-header token, no CORS, `Origin` and `Host` validated, loopback-only bind |
| A forgotten server left running | Ephemeral by design: idle timeout and exit |
| Audit writes slow the hot path | Measured before committing to always-on; the record is scope-not-content by decision Q3 |
| A screen implies it knows Claude's context usage | Stated as a non-goal in §4 and §7; no label may suggest it |
| Rendering is untested | Stated in the test file rather than implied by a green suite |
