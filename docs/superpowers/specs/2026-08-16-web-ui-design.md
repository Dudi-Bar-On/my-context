# mycontext web UI — design

**Date:** 2026-08-16
**Status:** decisions taken in brainstorming; amended five times; the fifth pass applies the
decisions in `2026-08-18-v2-decisions.md`
**Target:** v2.0. `1.0.0` shipped 2026-08-17 and `1.0.1` followed; this no longer waits on them
**Depends on:** the run-time audit log (1.0 Phase 5, decision Q3)

---

## 0. What this pass changed, and why it had to

This is the third amendment pass. It exists because a review found **five statements about the
existing product that the code does not support**, and one argument — the security reframing in §2 —
that was *inverted* relative to the product's own documented trust boundary. Nothing below is quietly
patched. Where a claim was removed, the section that carried it says what it said and why it was wrong,
because a document whose whole subject is "do not assert a property the system does not have" cannot
correct itself invisibly.

**Every row names the class of error it is an instance of.** That column was added in the fifth pass
and backfilled, because recording an instance is what let one of these defects recur. The third pass
corrected `/api/select` for omitting `seen`; the endpoint went on to omit `focus` as well, and the
expert review found it as a fresh critical. The correction had been written as *"`seen` is missing"*
rather than *"this endpoint must accept every narrowing input `select()` consumes"* — so a reader who
had read §0 attentively still would not have caught `focus`. A correction that does not generalise
does not prevent its own recurrence. See `2026-08-18-v2-decisions.md` §3.

| Was | Is | Class | Where |
|---|---|---|---|
| The UI hands an agent no capability it does not already have, so it may call five mutating functions | **The UI performs no writes at all.** The old argument fails on three counts, each named | An argument that grants capability is checked against the trust boundary the product already documents — never rederived from first principles | §2 |
| `rebuild` would have destroyed audit history had it lived in `.index.db` | **`rebuild` drops `items` only.** The destroyers are `Store.open`'s corruption self-heal and the documented "delete it, it rebuilds" recovery | A claim about what destroys data names the code that deletes, not the command whose name suggests it | §5 |
| The coverage map is `matchesAnyGlob` over a file tree | **`matchesScope` + `isEligible` + the normative-tier test.** `matchesAnyGlob` over a file tree is a defect `select.ts` documents by name | Any surface answering "what governs this?" calls the selection rule; it never re-implements the predicate | §3 |
| `session_id` and `prompt_id` join the status line to the audit log | **`session_id` alone.** No `prompt_id` exists anywhere in this repository except, formerly, this spec | An identifier a design joins on is shown to exist in the codebase before the join is specified | §4b |
| 5,000 items where JIT selection alone costs ~11ms | **The selector is asserted under 10ms; ~11ms is a whole-hook figure.** The number that binds is the hit-path p95, ~20.7–22.7ms against 50ms | A latency claim states the boundary it measures across; a component figure and a whole-path figure are not interchangeable | §5 |
| `/api/select?event=tool&path=X` is the injection preview | It omits `seen`, so it previews a **different selection and a different spill set** than the hook produces. The endpoint takes a session | **The preview endpoint accepts every narrowing input `select()` consumes** — the class that `focus` later violated | §3, §4 |
| A test asserts `/api/select` is byte-identical to `select()` | Impossible as written — `select()` returns objects. Restated as JSON structural equality | An equality assertion states the representation it compares in | §3, §6 |

Two things the review asked for are here because the owner asked for them first and an earlier pass
dropped them: **configuring** (§4, *Configure*) and **reports** (§4, *Report*). Two more are new
constraints rather than screens: **English and Hebrew, structurally mirrored** (§3) and **what the
status strip may claim about git** (§4).

**A fourth pass closed the two items the third left open, and corrected two false descriptions it
found while verifying them against the shipped code.** The `jsonb` question §5 recorded as under
measurement was answered by Phase 5 shipping the measurement and the projection built on it; the
injection-time token count §5 and §9 carried as a proposal received the owner's assent and is recorded
as a decision, its fallback branch deleted as dead. Verifying those exposed two more statements the
code does not support — the pinned record shape was a subset of the `AuditRecord` that shipped, and
"rebuilt whenever it is stale" misdescribed a projection that catches up incrementally — and both are
corrected below rather than left listed as known defects.

| Was | Is | Class | Where |
|---|---|---|---|
| Whether the projection can store each record whole as `jsonb` was an open question under measurement | **Measured and shipped.** On Node 24.18 (SQLite 3.53.1) through `node:sqlite`, the projection stores the record whole as `jsonb` and indexes into it (`src/core/audit-db.ts:36-47` on `phase-5/quality`) | An open question is re-checked against shipped code before it is carried into another pass | §5 |
| The injection-time token count needed the owner's assent, with a fallback re-scoping §4b to item counts if refused | **Decided — the owner assented.** The record carries the estimate computed at injection time; the field shipped as `tokens?: number` on `AuditRecord`; absence means 'not recorded', never zero | A decision recorded as pending is reconciled with the decision actually taken, and its dead fallback branch deleted rather than left readable | §5, §9 |
| The record shape was pinned to scope, tier, item ids, timestamp, `session_id` and the event | **Pinned to the shipped `AuditRecord`** (`src/core/audit.ts:156-184`), which also carries **`spilled` (id, tier, reason)** — the only record anywhere of what was selected and did not fit — plus `hook`, `path`, `note`, and a fourth **`focus`** record kind | A record shape stated in a design is the whole shipped shape, not the subset the design happens to need | §4, §5, §9 |
| The projection is rebuilt from the log whenever it is stale | **Behind means catching up incrementally from the recorded position; discard-and-rebuild happens only on divergence or a schema-version change.** The constraint — staleness is never silent — is unchanged | A description of a projection's refresh distinguishes catching up from discard-and-rebuild | §4, §5, §8 |

**A fifth pass applied the decisions in `2026-08-18-v2-decisions.md`**, taken on the ten-reviewer
expert pass. Three of its corrections are of this document's own statements; the rest are recorded
there.

| Was | Is | Class | Where |
|---|---|---|---|
| `/api/select` takes `event`, `path`, `session` and `restore` | **It takes `focus` as well.** `SelectContext` declares five inputs and `select()` applies focus before every tier and before budgeting, so an endpoint omitting it previews a different delivered set *and* a different spill set — the identical defect the third pass corrected for `seen` | The preview endpoint accepts every narrowing input `select()` consumes | §3 |
| The scope coverage map is a Core screen | **It is graded under Core here and implemented under Navigate in plan 1 Task 18.** The grouping is reconciled in favour of this document: the coverage map is Core and ships in wave 1; the ego graph is Navigate and does not | A screen's grading and its implementing task name the same grouping, or one of them is wrong | §4 |
| `status` is kept as a ⚠️ exception "because it is the landing screen and something must be" | **`route()` lands on the injection preview.** `status` is no longer the landing screen, so that justification is spent; the screen is re-justified below on its own merits | A screen justified by a role it holds is re-justified when the role moves | §4 |
| `README.md:4139` says *"delete the index and the injection history goes with it"* | **That sentence is not in the file, and its fact is now false.** The ledger is a replayed projection of the append-only audit log; `README.md` now says *"deleting the database loses nothing"* | A quotation is checked against the file at the version being cited, and a quotation whose fact has since changed is retired rather than re-pointed | §5 |
| The UI is **read-only** over HTTP | **Mutator-free**, and the server opens with `openReadOnlyChecked`, not `Store.open`. "Read-only" is false three ways: `Store.open` self-heals by deleting the database, the read-only open still creates `-wal`/`-shm` sidecars, and `VACUUM INTO` escapes `readOnly: true` entirely | A guarantee is stated in terms the implementation can actually satisfy; a stronger word that is false cannot be enforced | §2, §6 |
| The Ask screen runs a query the user builds | **No `/api` route accepts SQL.** The request is structured — fields, operators, bound values — never a client-supplied string, because `readOnly: true` does not stop `VACUUM INTO '<any path>'`; `assertSelectOnly` does, and its own comment records that it cannot see keywords inside backtick or `[bracket]` identifiers. **None of the three plans mentions `assertSelectOnly`** | A barrier the code documents as incomplete is not load-bearing; the design removes the input that needs it | §2, §4 |

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

### The decision: the UI is mutator-free, everywhere

The earlier version already contained the right rule and applied it to only half the document. §4's
*Work* section said *"The UI stays off the write path for anything a human should do deliberately"*;
§8's risk table said write commands are *"composed, not executed"*; §2 permitted five mutating calls.
**Resolved in the direction the rest of the document already pointed.**

> **The UI is *mutator-free* over HTTP. No `/api` route calls `createItem`, `updateItem`,
> `supersedeItem`, `linkItems`, `unlinkItems`, `stageRevision`, `promoteRevision` or
> `discardRevision`, directly or transitively. No `/api` route changes an item, a relation or a
> revision.**

**"Read-only" was the wrong word, and the fifth pass replaces it.** Three things make the stronger
claim false, and a guarantee that is false in its own terms cannot be enforced.

**First, a requirement, because the plan gets this wrong.** Plan 1's verified facts list
`Store.open(dbPath)` as the UI's entry point. **It must be `Store.openReadOnlyChecked`** —
(`core/store.ts` · `static openReadOnlyChecked(dbPath: string): Store {` · ~402) — which the hooks
already use and whose own doc comment says it *"never triggers the corruption self-heal."* `Store.open`
does self-heal, by removing the database and its journals:

```ts
rmSync(dbPath, { force: true });
rmSync(`${dbPath}-wal`, { force: true });
```

(`core/store.ts` · `if (!isCorruptionError(error)) throw error;` · ~342). A server that serves a `GET`
through `Store.open` can delete a projection while answering a read. The hooks were moved off that path
deliberately; the UI must not walk back onto it.

**Second, even the read-only connection writes.** Its doc comment records the measurement: *"opening an
existing WAL database does create empty `-shm`/`-wal` sidecars — measured; the main file's bytes and
mtime stay untouched."* Small, harmless, and still not "read-only".

**Third — and this is the one that matters — `readOnly: true` is not a blanket guarantee, and the gap
has a name.** From the same comment:

> `VACUUM INTO '<any path>'` runs successfully on a connection opened with `{ readOnly: true }` and
> writes a full copy of the database to a filesystem path of the caller's choosing … `assertSelectOnly`
> in `query.ts` is the thing actually stopping the write, not this connection.

So a "read-only" connection carries a **write-to-arbitrary-path primitive**, held back by a keyword
scan rather than by the engine.

> **Therefore: no `/api` route accepts SQL.** The Ask screen composes its query from a **structured
> request** — fields, operators, values, bound as parameters — and never from a client-supplied string.
> Where any SQL text is assembled server-side, `assertSelectOnly`
> (`cli/commands/query.ts` · `export function assertSelectOnly(sql: string): void {` · ~114) runs
> first, exactly as `cmdQuery` does.

`assertSelectOnly` is the right barrier and is **not sufficient on its own**: its own comment records
that *"Backtick and `[bracket]` identifiers — both legal SQLite — are NOT handled, so this function
cannot be relied on to see every keyword."* For writes to `dbPath` itself the read-only connection
covers that gap; for `VACUUM INTO`, which targets a *different* file, nothing does. **A structured
request is the design that closes it**, because no attacker-controlled token ever reaches the SQL
grammar. **None of the three plans mentions `assertSelectOnly`** — plan 3, which builds the Ask
screen's server half on `Store.raw`, has zero references to it.

**And the projections are not the corpus.** JSONL is the truth and SQLite is a disposable projection
(§5). Losing the projection costs time, not data. Saying "read-only" conflated the two and would have
made the first self-heal look like a violation of the spec.

**What this means for the test in §6.** The guarantee is about **functions**, not files, and the
distinction is load-bearing because the functions have moved:

| Mutator | Lives in |
|---|---|
| `createItem`, `updateItem`, `supersedeItem` | `mutate.ts` |
| `linkItems`, `unlinkItems` | **`relations.ts`** — split out of `mutate.ts` after these plans were written |
| `stageRevision`, `promoteRevision`, `discardRevision` | `revision.ts` |

An import-graph test that bans a **file** would have passed while `linkItems` moved out from under
it, and would fail spuriously the next time an innocent helper joins one of those modules. The test
resolves the eight **symbols** and asserts no route reaches any of them. See §6.

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
Standard, well-understood mitigations, all required even though the surface only reads the corpus:

- A token of 32 random bytes, minted per invocation, never written to disk **and never placed on a
  process command line** — see *Opening the browser* in §3 for how the page receives it instead.
- Required in an `X-Mycontext-Token` **header** on every `/api` request. The custom header is the
  defence: a cross-origin form post cannot set one, and with no CORS headers the browser blocks the
  fetch outright.
- `Origin` and `Host` validated on every request.
- The page receives the token in the URL fragment and immediately `history.replaceState`s it away. The
  **fragment** rather than the query string, because a fragment is never sent to the server and never
  appears in a server log or a referrer.

**Response headers, on every response including the static assets** — added in the fifth pass, because
the corpus is semi-trusted text and the page renders it:

| Header | Value | Why |
|---|---|---|
| `Content-Security-Policy` | `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` | Item titles and bodies are authored by agents and by ingest. `default-src 'none'` means a stray `<img src=x onerror=…>` in a body has nowhere to go, and `frame-ancestors 'none'` is the framing half of the rebinding defence that `X-Frame-Options` covers only for older browsers. No `'unsafe-inline'`: §3's no-build-step rule already requires real `.js` and `.css` files, so nothing needs it. |
| `X-Content-Type-Options` | `nosniff` | An item body served as JSON must never be sniffed into HTML. |
| `Referrer-Policy` | `no-referrer` | Nothing about a local corpus belongs in a referrer, and the token lives in the fragment. |
| `Cache-Control` | `no-store` on `/api` | The corpus is not public and the server is ephemeral; a cached response outliving the token is a leak with no upside. |

**What happens on reload** — the question the fragment-delivery design left open. The token arrives in
the fragment and is erased from the address bar immediately, so a plain `F5` would otherwise leave the
page with no credential and an unexplained wall of `401`s.

- The page keeps the token in **`sessionStorage`**, which survives reload and dies with the tab. Not
  `localStorage`, which would outlive the server that minted it and leave a dead secret on disk.
- On load the page takes the fragment if there is one, otherwise `sessionStorage`, otherwise it has no
  token.
- With no token, or with one the server rejects because it minted a new one, the page renders **the
  reconnect state, naming the cause**: *"this page was opened by a server that is no longer running —
  run `mycontext ui` again."* It never renders an empty corpus, which would read as "you have no
  items". That is §8's staleness-is-never-silent rule applied to the credential.

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
| What would be injected here, and what spills | `select()` | `select.ts` · `export function select(items: Item[], ctx: SelectContext, config: Config): Selection {` · ~460 |
| Does this item govern this path | `matchesScope(item, target, config)` | `select.ts` · `export function matchesScope(item: Item, target: string, config: Config): boolean {` · ~191 |
| Is this item eligible at all | `isEligible(item, config)` | `select.ts` · `export function isEligible(item: Item, config: Config): boolean {` · ~123 |
| What does an empty scope mean for this category | `scopePolicyFor(config, type)` | `config.ts` · `export function scopePolicyFor(config: Config, type: string): ScopePolicy {` · ~138 |
| Does an agent's edit apply or wait | `agentEditsFor(config, type)` | `config.ts` · `export function agentEditsFor(config: Config, type: string): AgentEdits {` · ~160 |
| Is this item injected, and **on what terms** | `injection(item, config)` | `cli/commands/injection.ts` · `export function injection(` · ~42 |
| Estimated tokens for a body | `estimateTokens()` | `select.ts` · `export function estimateTokens(text: string): number {` · ~106 |
| **What is the active focus** | `readFocus(root)` → `FocusState` | `core/focus.ts` · `export function readFocus(root: string): FocusState {` · ~321 |
| **Is a focus actually narrowing** | `isFocusActive(focus)` | `core/focus.ts` · `export function isFocusActive(focus: FocusAxes \| null): focus is FocusAxes {` · ~271 |
| **What did focus hide, and how much** | `Selection.focus` → `FocusReport \| null` | `core/focus.ts` · `export interface FocusReport {` · ~237 |
| What has this context window already been given | `readSeen(root, key)` → `seenIds(state)` | `seen-file.ts` · `export function readSeen(root: string, key: string): SeenState {` · ~109 |
| Which key is that, for a session or a subagent | `ledgerKey(input)` | `hooks/io.ts` · `export function ledgerKey(input: HookInput): string \| null {` · ~46 |
| Which sessions exist, most recent first | `Ledger.recentSessions(n)` | `ledger.ts` · `recentSessions(limit: number): string[] {` · ~242 |

**Three of those rows are new in the fifth pass, and two of them replace a row that was wrong.**

- **`focus` was missing from this table entirely**, which is where the `/api/select` omission
  originates. `select()` applies focus before every tier and before budgeting; a contract that lists
  the functions a screen may compose, and omits the one that narrows the corpus, invites exactly the
  endpoint that shipped in plan 1.
- **`Ledger.seen(sessionId)` was the wrong function.** Session dedupe state moved to a per-session
  **seen file** after this table was written; `Ledger.seen` still exists but is a **replayed
  projection**, topped up by `status`, `decay` and `audit replay-ledger`, and nothing in the UI updates
  it. A screen that called it would show a number that is not what the hook consults.
- **`ledgerKey` is on the list because the key is not the session id.** A subagent shares its parent's
  `session_id`, so keying on the bare id unions a subagent's deliveries into the parent's. The UI
  previews the **parent thread** and says so.

`injection()` is on that list because it already exists as **the single answer to "is this injected and
on what terms"** — it composes `isEligible`, the normative-tier test, `always`, `scope` and
`emptyScopeInjection(scopePolicyFor(...))`, in the order `select` applies them, and its own comment says
it lives where it does because that fact had a long history of being spelled differently in each place
that needed it. The UI is the third caller, not a fourth spelling.

**The correction that matters most here.** The earlier version said the expensive screens were cheap
because *"the coverage map is `matchesAnyGlob` over a file tree, not a second matcher."* That is
precisely the defect `select.ts` documents by name (`select.ts` · `` `query_items` re-derived it as a bare `` · ~169): the `query_items` MCP tool
re-derived scope matching as a bare `matchesAnyGlob(path, item.scope)` *"and consequently kept hiding
unscoped items from a path query long after they had become injectable on that path."* An unscoped item
matches every path under the default `scopePolicy` and no path under `inert`, and `matchesAnyGlob`
cannot know which. **The coverage map calls `matchesScope`.** It also filters on `isEligible` and the
normative tier — via `injection()` — or drafts and rationale items would colour the tree as governing,
which is the same class of false statement in a different medium.

One caveat for the implementer, because it is a real friction rather than an oversight: **`isNormative`
is private** to `select.ts` (`select.ts` · `function isNormative(item: Item, config: Config): boolean {` · ~129 — note the absent `export`). The UI must not copy its one-line body. Either
call `injection()`, which already encapsulates it, or export it — but not both, and never neither.

### `/api/select` — the endpoint the flagship screen rests on

The earlier version specified `/api/select?event=tool&path=X`. **That would have previewed a different
selection than the hook produces, and shown a different spill set**, which is fatal for a screen whose
entire value is "see exactly what Claude gets".

The reason is `seen`. `select()` filters already-injected items **before** budgeting
(`select.ts` · `hardening and must not be reverted` · ~476), and the comment above it says this is
Plan 1's hardening and **must not be reverted**: an already-injected item must not consume budget and
spill a fresh one in its place. Without it, every item ever injected in the session competes for budget
again, and the items that spill are not the items that would really spill.

**The rule this endpoint obeys, stated as a rule rather than as a list.** `select()` is the one
selection rule, and every input it consumes narrows what comes out. An endpoint that takes a subset of
those inputs does not preview `select()` — it previews a different question with the same name. So:

> **`/api/select` accepts every narrowing input `SelectContext` declares.** When a new one is added to
> `SelectContext`, this endpoint gains it in the same change, and the parity test in §6 fails until it
> does.

`SelectContext` declares five (`select.ts` · `export interface SelectContext {` · ~19):

| Input | Where the endpoint gets it |
|---|---|
| `event` | the query string — the same four values `select` accepts: `session-start`, `compact`, `tool`, `manual` |
| `path` | the query string; **optional**, and absent is meaningful rather than an error |
| `seen` | derived from the selected session — see below |
| `restore` | the query string, for `event=compact` only |
| `focus` | `readFocus(projectRoot).focus`, exactly as the hook reads it |

**`focus` is the input the third pass missed.** It is applied inside `select()` before every tier and
before budgeting (`select.ts` · `const focus = ctx.focus ?? null;` · ~469), so omitting it previews a
different delivered set *and* a different spill set — the same failure, and the same consequence, that
`seen` had. The hook passes it as `focus: focusState.focus` from `readFocus(ws.projectRoot)`
(`pre-tool-use.ts` · `const focusState = readFocus(ws.projectRoot);` · ~198). The response carries
`Selection.focus`, the `FocusReport | null` disclosure, so the screen can say what focus hid rather
than silently showing less.

**So the endpoint takes a session:** `/api/select?event=tool&path=X&session=<id>&focus=<active|off>`.

**How `seen` is obtained, which is no longer the ledger.** Session dedupe state lives in a
**per-session seen file**, not in SQLite: the hook calls `readSeen(projectRoot, dedupeKey)` and passes
`seenIds(seenState)` (`pre-tool-use.ts` · `const seenState = readSeen(ws.projectRoot, dedupeKey);` ·
~182). The key is **not** the bare session id —

```ts
export function ledgerKey(input: HookInput): string | null {
  if (!input.session_id) return null;
  return input.agent_id ? `${input.session_id}::${input.agent_id}` : input.session_id;
}
```

— because a subagent shares its parent's `session_id` but starts with an **empty context window**.
Keying on the bare id recorded a subagent's deliveries as if the parent had received them.

**Two consequences the UI must not blur:**

1. **The preview is of the parent thread.** The endpoint keys on the bare `session_id`, so it previews
   what the parent's context window has seen. A subagent's deliveries are a different key and are not
   unioned in. The screen says *"parent thread"* where it names the session, because a preview that
   quietly meant "parent and all its subagents" would be the exact error `ledgerKey` was written to fix.
2. **An unreadable seen file is a disclosed state, not an empty one.** The hook falls back to `seen: []`
   and records `seen file unreadable; injected without dedupe` in the audit note. The endpoint reports
   the same distinction; it never renders "nothing has been injected yet" for a file it could not read.

`Ledger.seen` still exists and is a **replayed projection**, topped up by `status`, `decay` and
`audit replay-ledger`. It is not what the hook consults, and the UI must not use it as though it were
live dedupe state.

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

**Focus gets the same treatment, for the same reason.** The default is the focus that is actually
set — `readFocus(projectRoot).focus` — because the default view must be what Claude really gets. Beside
it, a **"focus off"** toggle passing `focus: null`, which answers the different question *what would
this file get with no focus narrowing it*. That is the `seen`/cold-session pattern applied to the other
narrowing input, and it is **labelled as a different question**, never presented as the live preview.
When a focus is active the screen shows `Selection.focus`'s disclosure — what it hid, and how much —
because a preview that silently shows less is the false impression focus must never create.

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

**The landing screen is the injection preview.** `route()` defaults to `preview` at
`event=session-start` on `recentSessions(1)[0]`, which renders with **no user input at all**: `path` is
optional in `SelectContext` and the session selector already defaults. The first paint is *"exactly
what Claude got at the start of your most recent session"*, with the budget bar and the spill set;
choosing a file then refines that view rather than being a precondition for it. Its empty state — no
sessions recorded yet — says *"run Claude once, or pick a file to preview a tool event."* Landing
anywhere else would open the product on a screen that is not the reason it exists.

**Wave assignment.** §4 grades every screen; it does not schedule them. The three waves are fixed in
`2026-08-18-v2-decisions.md` §4 and marked here as **[W1]**, **[W2]** or **[W3]** so the grading and
the schedule cannot drift apart.

### Core — the reason to build it

- **Injection preview.** ✅ **[W1]** Pick a file and a session; see exactly what Claude gets, with the
  budget bar and what spilled. Rests on `/api/select` **with every narrowing input `select()` consumes**
  — `seen` *and* `focus`; see §3, and note that this screen is wrong in a way nobody would notice
  without it. **This is the landing screen.**
- **Scope coverage map.** ✅ **[W1]** The file tree coloured by what governs it, via `matchesScope` +
  `injection()`. **The gaps are the point.** It has a second mode — see *File browser*, below.

  **A grouping correction.** This document grades the coverage map under **Core**; plan 1 implements it
  under **Navigate**, in Task 18. The two are reconciled in favour of this document — it is a Core
  screen and ships in wave 1 — but the *task* boundary is left alone, because Decision 4 defers tasks
  and never re-cuts plans. So wave 1 takes Task 18 **except its ego graph**, and the ego graph is the
  only part of Navigate that waits.
- **Budget simulator.** ✅ **[W1]** Drag the budget, watch what fits. The 1.0 default-budget change was
  decided by measurement that this screen would have made a five-second exercise.
- **What is currently injected.** ✅ **[W1]** Live state for the selected session — from the
  **per-session seen file**, keyed as §3 describes, not from `Ledger.seen`, which is a replayed
  projection nothing in the UI updates. It is the parent thread's state, labelled as such.

### Navigate

- **File browser.** ➖ **Merged.** **[W1]** The earlier version conceded it was *"the coverage map made
  navigable"*, which is one screen with a mode, not two. Keeping both invites two implementations of
  one tree. It is now the coverage map's **detail pane**: select a node, get what governs it, what
  would be injected, and links to the items.
- **Relation graph — an ego-graph, not a hairball.** ✅ with a constraint. **[W3]** — the one part of
  Navigate that waits, and the reason wave 1 takes Task 18 minus this bullet. This is the one screen that
  quietly wanted a library, and the earlier version specified no layout algorithm, no node budget and
  no interaction model, which made it read as free. It is not. **Constrained:** one focused item, a
  radius of 1 or 2, a deterministic layered layout — the focus centred, neighbours ranked by relation
  type — with a hard cap of 60 nodes and an explicit "+N more" rather than a silent truncation. No
  force simulation, no physics, no dependency. Hand-written force-directed SVG is fine on this
  repository's 43 items and unusable at the 5,000 the perf suite uses; an ego-graph is cheap, honest,
  and more useful than a hairball at either size. Dangling edges after a supersede are the thing worth
  seeing and are legible at radius 1.
- **Onboarding view.** ➖ **Merged.** **[W1]** It was `mycontext list`, grouped and styled, justified as *"the
  thing you screenshot"* — which is a marketing need, and marketing needs are not the test §1 sets. It
  survives as **the coverage map's printable rendering**: one page answering *"what governs this
  project"*, generated from the same data, with a print stylesheet. Same artefact, no second
  implementation, and it is still the thing you screenshot.
- **Coverage gaps.** ✅ **[W1]** Which directories have no items, which categories are empty. The
  inverse of the map: it names what is *missing*, which no listing can.

  **The empty state is a required part of this screen, not a polish item.** A freshly initialised
  workspace has no items, so every directory is a gap and the map renders as a wall of warnings for
  what is a completely normal state — the worst possible first impression, shown to exactly the newest
  user. A corpus with no items renders *"nothing governs this project yet"* and the one next step, not
  a coloured tree of alarms.

### Watch — **[W3]** (plan 3)

- **Audit live.** ✅ All four record kinds, streamed from the audit log: mutations, injections **with
  their spills**, hook actions, and focus changes. The spill entries are what answer "why didn't Claude
  see this item", and the focus records are what keep an injection history from showing items
  disappearing for no visible cause (§5). See §2's idle rules: the stream does not hold the server open.
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

### Work — **[W2]** (plan 2, Task 11)

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

### Configure — the strongest "a terminal cannot do this" screen available — **[W2]** (plan 2, Task 13)

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

### Report — **[W3]**

Queries were covered; the three reporting commands had no screen at all.

- **`doctor`.** ✅ **[W3]** Its findings are a list, but its *shape* is not. `src/doctor/checks.ts` emits
  findings carrying a `code` — `index_stale`, `orphan_relation`, `source_drift`, `source_missing`,
  `dead_scope`, `not_writable`, `session_id_mismatch`, `unknown_category`, `scope_policy_inert` and the
  rest — across three levels, all collapsed at the end into a single exit code
  (`cli/commands/doctor.ts` · `export function exitCode(` · ~33). The screen groups by
  `code`, keeps the three levels visually distinct, and links each finding to the item it names and to
  the command that repairs it (composed, not run). A findings list flattened to "exit 1" is exactly the
  kind of structure a terminal loses.
- **`status`.** ⚠️ **Exception. [W3]** Corpus counts, the draft queue and the pending-revisions line are
  a table, and a table is a terminal's home ground.

  **Its old justification is spent and is not replaced by another.** It read *"kept because it is the
  landing screen and something has to be"* — and as of the fifth pass it is not the landing screen; the
  injection preview is. A screen justified by a role keeps that justification only while it holds the
  role.

  It is kept anyway, on a narrower and honest basis: it is the **destination of the header's corpus
  counts**, which every screen shows and which have to link somewhere, and it is cheap — its read model
  is plan 1 Task 10, already built for `doctor` and `decay`. It is **not** claimed to beat
  `mycontext status`, and it moves to **wave 3**, where a screen the terminal does just as well
  belongs. If wave 3 arrives and the counts have found a better destination, this screen should be cut
  rather than built.
- **`decay`.** ✅ **[W3] Decay is a chart, not a table** — but of **sessions, not time**, and the
  fifth pass got this wrong before the adversarial pass caught it.

  **Correction.** An earlier version of this bullet said *"injections per item over time is a real
  series"* and cited the comment above `injected_at` as support. That comment says the opposite:
  *"`injected_at` is a value, not part of the key: a repeat injection a millisecond later **must
  collide**, or once-per-session dedupe never fires."* The write is
  `ON CONFLICT(session_id, item_id, tier) DO NOTHING`
  (`ledger.ts` · `ON CONFLICT(session_id, item_id, tier) DO NOTHING` · ~122), so the ledger holds
  **one row per (session, item, tier)** carrying the FIRST injection time. Repeat injections within a
  session add nothing. There is no series of injection events to plot.

  **What is real:** a point per item per session per tier, and `decay`'s own unit is **sessions**
  — "not injected in the last N sessions", not "in six weeks". The x-axis is the session sequence;
  a time axis would be a second encoding of a different quantity and must be labelled as one if it
  appears at all. The same correction applies to the Watch strip's injection-volume claim.

  **Class:** a quoted comment is read for what it says, not for what the sentence around it needs.
  This row is the sharpest instance in this document, because the quotation and the false
  conclusion were written in the same pass. "this rule has not been injected in six sessions"
  is a shape you see instantly and read out of a table never. The chart carries `decay`'s own caveat
  about its window — a report that hides its measurement window overstates its confidence.

### Ask — **[W3]** (plan 3)

- **Structured query builder** ✅ with predefined useful queries, over the corpus **and over the audit
  history**. Filters for people who do not write SQL, with the generated SQL shown so it teaches.
  Reuses the existing read-only path; the `updated_at` trap is already documented and must be carried.
  Audit queries do **not** read the JSONL log directly — they read the SQLite projection derived from it
  (§5), and every audit answer will carry the projection's freshness, because a projection that is behind
  its log must either catch up or say so rather than answer quietly.

### Learn — **[W3]** (plan 1, Task 19)

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

**Correction: the earlier version said `session_id` *and `prompt_id`*.** **The join is on `session_id`
alone**, which is sufficient for the sentence above and is the granularity the ledger already keys on.

**The loop, closed properly in the fifth pass.** The third pass wrote *"there is no `prompt_id` … it
appears in exactly one file in this repository, and that file was this spec."* The first half of that
is a claim about **mycontext**; the second reads as a claim about the **payload**, and only the first
is this repository's to make.

- **[V] mycontext declares no prompt identifier.** `HookInput`
  (`hooks/io.ts` · `export interface HookInput {` · ~3) declares `session_id`, `transcript_path`,
  `cwd`, `hook_event_name`, `source`, `tool_name`, `tool_input`, `agent_id` and `agent_type`. Nothing
  in `src/` reads or writes a per-turn id, and §4b's own status-line field list never mentioned one.
- **Whether the Claude Code payload now carries one is an upstream question this spec does not
  settle.** Plan 3 raised it; a design document is not the place it gets answered.

**So the condition is written down instead of the conclusion.** A finer join — *this injection against
that turn* — becomes possible only when a per-turn identifier is **measured on a real payload**, and
then it is a change to `HookInput` and to the audit record shape, never something the UI synthesises.
The bar is the one `agent_id` itself had to clear, recorded in its own doc comment: *"Measured, not
assumed: a probe hook under a real `claude -p` run…"*. Until a probe shows the field, §4b joins on
`session_id` and says so.

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

**Pinned to the shape that shipped** (`AuditRecord`, `src/core/audit.ts:156-184` on `phase-5/quality` —
build against the type, not this prose). Every record carries `protocol`, a UTC `at` timestamp, `kind`
and `op`. An injection record adds `sessionId` (absent for `manual`, whose surface has no trustworthy
session id — a limitation the type discloses in place), the `hook` that ran, the triggering `path` for
PreToolUse, `injected` as (id, tier) pairs — and **`spilled` as (id, tier, reason)**. A mutation record
instead carries `origin`, `itemId` and the `fields` the write changed; `note` carries short non-content
notes such as a discard reason or a SessionStart source. **Never item content** — that is the half of
the decision the earlier wording did get right, and it is what keeps the log small enough for the hot
path.

Two of those fields are load-bearing for §4's Watch screens, and an earlier version of this pin — a
subset written before the code — omitted both:

- **`spilled` is not an incidental extra.** A spill record is the audit trail of what was selected and
  did *not* fit the budget, with `select`'s own reason attached, and it is the only place that fact is
  recorded — the ledger records deliveries only. "Why didn't Claude see this item" is answered by a
  spill record and by nothing else, and the shipped projection already indexes the question
  (`audit_item`'s `spilled` role, `src/core/audit-db.ts`). A spec pinning a shape without `spilled`
  would have had an implementer build an audit view that cannot answer it.
- **`focus` is a fourth record kind** (`focus-set` / `focus-clear`, `src/core/audit.ts:75,107`),
  deliberately neither a mutation nor an injection: a focus change touches no item and injects no text,
  but it changes what every later selection injects. An audit view that streamed injections without
  focus changes would show items disappearing from a session with no visible cause, so the Watch stream
  carries focus records too.

**One extension, decided with the owner's assent.** §4b's sentence needs a token count for mycontext's
contribution. Deriving it later from the items as they are now has the same drift problem as the ids
would. So the record carries the **estimated token count computed at injection time** (`estimateTokens`,
`src/core/select.ts:64`) — the number as it was when the injection happened, never re-derived from the
present corpus. An earlier version wrote this as a proposal awaiting the owner's assent, with a
fallback re-scoping §4b to item counts if refused; **the owner has assented**, the extension to the
recorded Q3 shape is a decision, and the fallback branch is dead and deleted.

**The deferral to a branch is also spent — it merged.** This paragraph said the field's name and
coverage *"are being settled by the implementation on the `audit-injection-token-count` branch, and
that branch — not this spec — is where the spelling binds."* It has shipped. The field is
**`tokens?: number`** on `AuditRecord` (`core/audit.ts` · `tokens?: number;` · ~201), and what it counts is
pinned in its own doc comment:

> It is `Selection.tokens` verbatim — the sum of the chars/4 estimates … the selector charged its
> budgets for every admitted full-text block (with its joining separator) and every index line.
> Spilled items and un-budgeted scaffolding … are outside the budgets and outside this number.

**One property of it the UI must respect:** the field is **absent** on records written before it
existed, and *"absence means 'not recorded' — never zero. Zero is a real measurement … a reader that
defaults a missing value to 0 turns 'unknown' into a claim."* Every screen that shows a token number
renders **"not recorded"** for an absent one. §4b's sentence — *"of 47k tokens in use, 6.2k came from
your project knowledge"* — is not printed at all for an injection whose `tokens` is absent.

### The hot-path cost — corrected numbers

**Measured, and no longer open.** This paragraph asked *"what does writing one audit record cost on the
hot path?"* and left it as the one thing still to measure. It was measured before the hook was wired,
and the numbers are asserted in `test/perf/audit-latency.perf.ts`
(`audit-latency.perf.ts` · `**The measurement that decided the audit log is always-on.**` · ~2):

| Log size | p95, two runs |
|---|---|
| empty | 0.579 / 0.552 ms |
| 1 MiB | 0.570 / 0.507 ms |
| 8 MiB (rotation edge) | 0.556 / 0.527 ms |
| 32 MiB | 0.551 / 0.544 ms |

**~0.55 ms against a 50 ms ceiling — about 1% more per tool call — and *flat in the size of the log*,**
which is the property that made always-on safe rather than merely cheap today. It is flat because the
append never reads the log: `healTornTail` answers *"is the last byte a newline"* with one `stat` and
one 1-byte read, and rotation keeps the live file bounded. The alternative was measured too, because
"flat" is a claim about a design decision that had a cheaper-looking option.

The hooks run on every tool call under a 50ms p95 ceiling and must fail open. The record is small by
design, and now known to be.

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
kill mid-write damages the tail and nothing else, and the file stays greppable and tailable by hand.
The projection records how much of each log segment it has consumed; when it is merely **behind**, it
catches up by reading only the records it has not yet seen, and it discards itself and rebuilds whole
only when appending cannot be correct — a segment shrank or vanished (a rotation, a moved file) or the
schema version changed (`projectionState` / `syncProjection` / `openProjection`,
`src/core/audit-db.ts` on `phase-5/quality`). An earlier version said the projection "is rebuilt
whenever it is stale" — a true constraint met by a falsely described mechanism, which is this project's
most repeated defect and is corrected here. Deleting the projection loses nothing either way.

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
which is `DELETE FROM items WHERE layer = ?`
(`store.ts` · `this.#db.prepare('DELETE FROM items WHERE layer = ?').run(layer);` · ~527). The `ledger`
table (`ledger.ts` · `injected_at TEXT NOT NULL,` · ~34) lives in the same file and **survives a rebuild
untouched.** The half of the claim that is true is the parenthesis: `query`
(`cli/commands/query.ts` · `updated_at is INDEX WRITE TIME, not a Markdown timestamp: every query
rebuilds the` · ~47) and `context`
(`cli/commands/context.ts` · `This ALWAYS rebuilds before returning the context` · ~42) do each run a
rebuild implicitly — and it is harmless to history.

**`docs/ROADMAP.md`'s C-R4 row** (`docs/ROADMAP.md` · `two bullets after the one saying` · ~214) already recorded
the corrected fact against a README bullet that had made a related error. Restating the wrong mechanism
here contradicted this project's own correction, in a document written after it.

**The real destroyers, both of which delete the database file whole:**

- **`Store.open`'s corruption self-heal** (`store.ts` · `rmSync(dbPath, { force: true });` · ~345): on
  an unreadable file it `rmSync`s the db plus its `-wal` and `-shm` and recreates it. The code says so
  in a comment on the very branch — *"a successful clear here discards not just the disposable `items`
  cache but also whatever `ledger` rows the file held"*. It is the right behaviour: without it a corrupt
  index silences the plugin permanently. It is also unattended.
- **The documented recovery.** `README.md` · `recreates it from the Markdown. The Markdown is the source
  of truth;` · ~1254 — *"Delete it and `mycontext rebuild` recreates it from the Markdown."*

**Correction, fifth pass: the second README quote does not exist, and its fact is now false.** This
paragraph cited `README.md:4139` for *"delete the index and the injection history goes with it."* That
sentence is not in the file — not at that line, not anywhere — and the claim it carried has been
overturned by shipped code. `README.md` now says the opposite, in the bullet that governs:

> Even the usage ledger that shares the file is derived — a projection of the append-only audit log,
> which `mycontext audit replay-ledger` tops up incrementally, rebuilding it whole only when the log
> has diverged — **so deleting the database loses nothing.**

**Which means this section won its own argument, and must stop making it in the future tense.** §5
argued for separating truth from projection so that deleting a database could not destroy the one
record of what happened. That separation **shipped in 1.0**: the append-only audit log is the truth,
the ledger is a replayed projection, and `audit replay-ledger` rebuilds it. The self-heal still deletes
the file, and that is now a cache loss rather than a history loss.

**A second-order lesson, recorded because it is the same failure one level up.** The ROADMAP row cited
above states, in its own text, that deleting the file *"zeroes the injection history permanently"*. That
was true when C-R4 was closed and is no longer true, for exactly the reason above. A document leaning on
another document's correction inherits that correction's expiry date. This is why plan-level facts get a
`§0` of their own and a checker (`2026-08-18-v2-decisions.md` §2, §3), rather than a citation and a hope.

**A question this spec left under measurement, now answered by the measurement.** An earlier version
of this paragraph asked whether `jsonb` could let the projection store each record whole and index
into it, instead of shredding fields into columns and re-deciding the schema every time the record
shape grows — and recorded that Phase 5 was measuring what `node:sqlite` on Node 24 actually supports,
asserting no outcome. **Phase 5 shipped, and the measurement is in the shipped file**
(`src/core/audit-db.ts:36-47` on `phase-5/quality`): on Node 24.18 (SQLite 3.53.1), `jsonb()`, `->>`,
`json_each`, VIRTUAL generated columns over a jsonb blob and expression indexes over them all work
through `node:sqlite`, and a representative injection record measured 452 bytes as jsonb against 546
as text. **The record is stored whole as `jsonb`.** The filter fields — `at`, `kind`, `op`, `origin`,
`item_id`, `session_id`, `path` — are VIRTUAL generated columns derived from the blob, each indexed,
so a record shape that grows a field needs no migration: the new field is already stored and already
queryable with `->>`. The projection stamps a schema version and, on a mismatch, discards itself and
rebuilds from the log — which is what turns even a schema re-decision into a rebuild of a disposable
file rather than a migration of a kept one. That is the shape this paragraph leaned toward, and the
shipped implementation does not diverge from it. It goes one step past what the question asked, and
the step is derived rather than schema-deciding: a side table (`audit_item`) projects one row per
(record, item) mention — including spills — so "everything that happened to this item" is an indexed
lookup rather than a `json_each` scan; it is rebuilt from the blobs and dies with the projection.

**A constraint on the projection: staleness must be detectable and never silent.** The projection records
its position in the log, and a query answered from a projection that is behind its log **either catches
up first or tells the caller it is behind**. It may not quietly return an answer that is missing the most
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
| The audit projection answers from stale data without saying so | The projection records its log position; a query behind its log catches up first or reports that it is behind, and a diverged or version-mismatched projection is discarded and rebuilt whole (§5) |
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
   (`select.ts` · `export function matchesScope(item: Item, target: string, config: Config): boolean {` · ~191), filtered by **`isEligible`** (`select.ts` · `export function isEligible(item: Item, config: Config): boolean {` · ~123) and the normative-tier test, which
   **`injection()`** (`cli/commands/injection.ts` · `export function injection(` · ~42) already composes in `select`'s own order.
   **Not `matchesAnyGlob`** — that is a defect `select.ts` documents by name — `` `query_items` re-derived it as a bare `` · ~169, recording that the bare form *"kept hiding unscoped items from a path query long after they had become injectable on that path"* (§3).
4. **Where does the audit log live, and what is in a record?** **JSONL is the source of truth; SQLite is
   a disposable projection that records its position in the log.** An injection record carries the
   delivered set as (id, tier) pairs, **the spilled set as (id, tier, reason)**, timestamp, `session_id`
   and the hook and path that triggered it — never item content — plus, decided with the owner's assent,
   the estimated token count computed at injection time — shipped as **`tokens?: number`**, whose
   **absence means "not recorded", never zero**. Mutations and focus changes are their
   own record kinds; the full shape is `AuditRecord` (`core/audit.ts` · `export interface AuditRecord {` · ~156, running to `note?: string;` · ~207) (§5).
5. **How does the UI select a session?** **One global selector**, defaulting to
   `Ledger.recentSessions(1)[0]`, listing 20, with an explicit **cold-session** option that passes no
   `seen` and is labelled as a different question. The same `session_id` keys the ledger, the audit
   records and the status-line tee (§3, §4b).

**The fifth pass adds five more**, from `2026-08-18-v2-decisions.md`. Same rule: recorded here so no
implementer chooses.

6. **What does `/api/select` take?** **Every narrowing input `SelectContext` declares** — `event`,
   `path`, `seen`, `restore` **and `focus`** — and it gains any that is added later, in the same change.
   The parity test in §6 fails until it does. Previewing a subset of `select()`'s inputs is previewing a
   different question under the same name (§3).
7. **Where does `seen` come from?** **The per-session seen file**, via `readSeen(root, ledgerKey(...))`
   and `seenIds`, never `Ledger.seen` — which still exists but is a replayed projection nothing in the
   UI updates. The preview is of the **parent thread**, because a subagent has its own key, and the
   screen says so. An unreadable seen file is a **disclosed state**, never rendered as an empty one (§3).
8. **Is the UI read-only?** **No — it is *mutator-free*.** Reads open the store write-capable and
   `Store.open`'s self-heal deletes the database and its journals on a `GET`. No route changes an item,
   a relation or a revision, and the §6 test resolves the eight mutator **symbols**, not their files,
   because `linkItems` and `unlinkItems` have already moved once (§2, §6).
9. **What does `route()` land on?** **`preview`, at `event=session-start` on `recentSessions(1)[0]`,
   rendering with no user input.** Not `status` — whose exception was justified by being the landing
   screen, and which is not it any more (§4).
10. **In what order is this built?** **Three waves**, marked **[W1]/[W2]/[W3]** on every screen in §4.
    Wave 1 is plan 1 Tasks 1–17 plus the coverage map; wave 2 is plan 2; wave 3 is plan 3 plus plan 1's
    deferred tasks. **Tasks are deferred, never re-cut** — a deferred task leaves a re-verified plan
    valid, and a re-cut does not. Work ships in wave 2 **without** stream-driven refresh, and that
    divergence is stated rather than absorbed (§4).
