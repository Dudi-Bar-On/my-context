# mycontext web UI — design

**Date:** 2026-08-16
**Status:** decisions taken in brainstorming; amended six times; the fifth pass applies the
decisions in `2026-08-18-v2-decisions.md`, the sixth reconciles this document with the mockup
**Target:** v2.0. `1.0.0` shipped 2026-08-17 and `1.0.1` followed; this no longer waits on them
**Depends on:** the run-time audit log (1.0 Phase 5, decision Q3)
**Authority for the UI:** `docs/design/web-ui-mockup.html`, per the pinned
`INSTR-the-mockup-is-the-ui-specification-build-it-exactly-and-ask`. Where this document and the
mockup disagree about **what a screen is**, the mockup decides; where they disagree about **what
the server does**, this document decides. §0 states that boundary once and applies it per row.

---

## 0. What this pass changed, and why it had to

<!-- retired-phrases
seen: ledger.seen(session)
with the generated SQL shown so it teaches
the mycontext UI server has exited
-->

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
| `session_id` and `prompt_id` join the status line to the audit log | **`session_id` alone.** No `prompt_id` existed anywhere in this repository except, formerly, this spec. **Amended 2026-08-21:** the v2 hooks plan's Task 5 declares `prompt_id` on `HookInput`, because Claude Code 2.1.234 was measured sending one. Nothing reads it and **this join is unchanged** — a field the payload carries is not a field a surface may join on until something in `src/` keys off it | An identifier a design joins on is shown to exist in the codebase before the join is specified | §4b |
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
| Whether the projection can store each record whole as `jsonb` was an open question under measurement | **Measured and shipped.** On Node 24.18 (SQLite 3.53.1) through `node:sqlite`, the projection stores the record whole as `jsonb` and indexes into it (`src/core/audit-db.ts` · ``**The record is stored whole, as `jsonb`, and queried into.**`` · ~44 on `phase-5/quality`) | An open question is re-checked against shipped code before it is carried into another pass | §5 |
| The injection-time token count needed the owner's assent, with a fallback re-scoping §4b to item counts if refused | **Decided — the owner assented.** The record carries the estimate computed at injection time; the field shipped as `tokens?: number` on `AuditRecord`; absence means 'not recorded', never zero | A decision recorded as pending is reconciled with the decision actually taken, and its dead fallback branch deleted rather than left readable | §5, §9 |
| The record shape was pinned to scope, tier, item ids, timestamp, `session_id` and the event | **Pinned to the shipped `AuditRecord`** (`src/core/audit.ts` · `export interface AuditRecord {` · ~326), which also carries **`spilled` (id, tier, reason)** — the only record anywhere of what was selected and did not fit — plus `hook`, `path`, `note`, and a fourth **`focus`** record kind | A record shape stated in a design is the whole shipped shape, not the subset the design happens to need | §4, §5, §9 |
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

**A sixth pass reconciles this document with `docs/design/web-ui-mockup.html`.** The mockup has
been rebuilt twice since this spec was written, and as of 2026-08-20 it is not a reference this
document defers to — it is the specification for the UI. The pinned instruction
`INSTR-the-mockup-is-the-ui-specification-build-it-exactly-and-ask` says so in its own words:

> **The mockup is the specification for the UI. Build what it shows. Do not invent.** … the mockup
> decides: the screens that exist, what each one shows, where a control lives, what a chart plots,
> what a state looks like when it is empty, and what the words are.

It forbids *adding* a screen, panel, control or field the mockup does not show; *dropping* one it
does show, or "quietly rendering a weaker version — a table where it draws a chart"; restyling; and
rewording, because *"every user-visible string is in the mockup's table with a Hebrew pair."*
**So a sentence here that disagrees with the mockup is not merely stale — it is an instruction to
build something the pinned instruction forbids.** Every row below is one of those.

**The boundary on that authority, stated once rather than re-argued per row.** The mockup is the
authority on **appearance**: which screens exist, what is on each, where a control lives, what a
chart plots, what an empty state looks like, and the words. It is **not** the authority on
**behaviour**, and the sixth pass overruled nothing in that class: the mutator-free rule (§2), the
refusal to accept SQL on any `/api` route (§2), the loopback/token/CSP/idle rules (§2), the five
narrowing inputs `/api/select` must accept (§3), where `seen` comes from (§3), the read-`.git`-as-files
constraint (§4), the three honesty constraints on the context number (§4b), and *absence means "not
recorded", never zero* (§5) all stand. Where the mockup touches one of them it **agrees** — the Ask
screen carries a `ask.whyq` disclosure titled *"Why there is no SQL box"*, and *Injected now* carries
`inj.note` saying it reads the seen file and not `Ledger.seen`. A mockup cannot repeal a security
rule, and this one did not try.

| Was | Is | Class | Where |
|---|---|---|---|
| The rail groups screens as **Core, Navigate, Watch, Work, Configure, Report, Ask, Learn** | **Four groups, by tense** — `nav.inj` *Injection — what arrives*, `nav.ev` *Evidence — why it did or didn't*, `nav.ch` *Change — composed, never run*, `nav.read` *Read* | A document that groups screens and a rail that groups screens carry one grouping; the rail's is the one a user can see | §4 |
| Thirteen screens, two of them merged away | **21 screens**, one `<section data-p=…>` each, six of which this document never described | An inventory is counted against the artefact that renders it, never against the last version of itself | §4 |
| **Learn** is one screen | **Three** — `docs` *Documentation*, `tut` *Tutorials*, `learn` *Learn* — and they are the whole `nav.read` group | A screen that grew a second job is two screens once the rail says so | §4 |
| Overlap detection at capture is a **bullet inside Work** | **`capture` is its own rail screen**, titled *Capture*, in the `nav.ch` group | A capability with its own rail entry is a screen, whatever the document that proposed it called it | §4 |
| **Command palette** | **Composer** (`s.palette`, `pal.h`) — argument chips, a **blocked Copy** when an argument carries shell substitution, and a live glob tester | A screen is named what the mockup names it; a second spelling of one screen is this project's most-paid-for defect | §4 |
| No such screens | **Three `PROPOSED` screens** — `proc` *Procedures*, `port` *Export / import*, `packs` *Template packs* — each carrying a `PROPOSED` chip **in place of** a §1 verdict | A screen the owner asked for is in the inventory with its status on its face, not absent from it | §1, §4 |
| An item id renders as text | **An item detail pane** (`<aside class="pane">`), opened by any `.linkid`, carrying type/status/tier/scope/governs/file, a twelve-week delivery sparkline, and the body rendered as Markdown | Every id the product prints has a destination, or the id is a dead end drawn to look like a link | §4 |
| Each screen carries its own qualifications inline | **One provenance bar** (`<div class="prov">`) carrying *preview of* **parent thread**, *focus* **off — a different question**, *tokens* **not recorded before 1.0.1**, and *projection* **fresh** | Qualifications every screen owes get one home, or each screen re-decides which of them to show | §3, §4b, §5 |
| The Watch status strip carries **injection volume** | **It does not.** The strip is branch, commit, sync chip, item count, the context number, and the **0.55 ms audit-append p95 with a `measured` chip**. Volume lives on the Audit stream as the **activity pulse**, one column per ten seconds, coloured by record kind | A claim that a surface shows a number is checked against the surface, not against the argument for showing it | §4 |
| Ask shows the generated SQL **so it teaches** | **KEPT — owner decision, 2026-08-20.** The reconciliation had removed it; that was a removal, not a question, and the owner reversed it. The mockup gained the display FIRST (`ask.sqlh`, `ask.sqln`) and this spec follows it. The `ask.whyq` disclosure stands and does not conflict: it is about the **input**, and the pane is **output** — shown, never typed, with `/api/ask` accepting fields and never a statement | The teaching argument was the reason it existed; a reconciliation pass is not the place to overturn it | §4 |
| Configure previews `scopePolicy`, `agentEdits`, `budgets`, `enabled`/`tier` and validation | **It draws budgets, one `scopePolicy` blast radius, and `watchedDocs`.** `agentEdits` and `enabled`/`tier` are not on the screen; whether they were cut or merely not drawn is an **open question for the owner**, recorded rather than resolved | A panel a spec requires and a mockup does not draw is a question, not a licence to build it | §4 |
| Decay's x-axis is **the session sequence** | **Two charts.** A **recency comb** — one tooth per item, x = sessions since last injection on a log scale, never bucketed — and a **90-day daily heatstrip** per item from `audit_item.role` joined to `audit.at`, labelled in `dec.sub` as *"a different measurement from a different source"* | A chart described in the singular is checked for how many charts the screen actually has | §4 |
| The coverage empty state is recorded under **Coverage gaps** | It is on the **coverage** screen (`#covempty`, `cov.e1` *"Nothing governs this project yet."*). Gaps instead carries a **third state, `not examined`**, which is *"never folded into 'gap'"* | An empty state belongs to the screen that would otherwise render the wall of warnings | §4 |
| The onboarding view survives as **the coverage map's** printable rendering | The print stylesheet un-hides **whichever screen is current** (`[data-p].printing`), so all 21 print. There is no "Printable" button and no coverage-only path | A print rule that assumes one screen prints a blank page for the other twenty — which is the defect this stylesheet's own comment records | §4 |
| On exit the page says *"the mycontext UI server has exited — restart it with `mycontext ui`"*, and a separate reconnect string names a dead token | **One banner**, `ex.msg`: *"The server has exited. This page shows what it last knew."* with `mycontext ui` beside it and an OK dismiss | A user-visible string is the mockup's to write; a second spelling of it is an untranslated string and a parity failure | §2 |
| §8's risk row: `/api/select` *"passes `seen: ledger.seen(session)`, as the hook does"* | §3 corrected that three passes ago — `readSeen(root, ledgerKey(...))` and `seenIds` — and **§8 went on saying the old thing** | A correction recorded in §0 is applied in the body; recording it is half the work, and the invisible half is the one that rots | §8 |
| Theming is not mentioned | The mockup ships a **theme control** (`#theme`), `light-dark()` tokens throughout, a **gloss** treatment on every card and popover, and a type scale. The pinned instruction names all four: *"The gloss, the logical properties, the light-dark tokens and the type scale are decisions, not defaults"* | A visual system a mockup commits to is a decision the spec records, or the first implementer restyles it | §3, §7 |
| The injection preview is the budget bar and what spilled | It is also a **gate ladder** — `select()`'s own order, *eligible, tier, focus, scope, seen, budget* — and the ribbon carries a **ghost lane** per tier, with a tier the event never reaches drawn **absent and hatched** rather than empty | A screen described by its two most-quoted parts is not described | §4 |

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

> **CORRECTED 2026-08-20, against `docs/design/web-ui-mockup.html`.** *"Every screen carries a
> verdict"* holds for eighteen of the twenty-one, and the mockup renders each verdict in the screen
> header (`<span class="verdict">`) — ✅ on sixteen, ⚠️ on `status` and `learn`. **The three
> `PROPOSED` screens carry a `PROPOSED` chip in that slot instead of a verdict**, which is the right
> shape and is not an exemption: an unbuilt, unspecified screen has nothing to grade against §1's
> test yet, and grading it would be the assertion-without-code defect this project already has
> thirty recorded instances of. They are graded when they are specified, and the label is what says
> they are not. `pr.sub`, `port.sub` and `pk.sub` each end *"Decided; nothing implements it yet"* or
> its equivalent.

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
(`README.md` · `What actually enforces it: your Bash permissions, and nothing else` · ~4659). The
recipe it ships is **seventeen `Bash(mycontext … *)` deny rules**
(`README.md` · `"Bash(mycontext lesson-accept *)",` · ~4765) — `lesson-accept`, `review promote`,
`review discard`, `review promote-revision`, `review discard-revision`, `procedure activate`,
`procedure done`, `add`, `supersede`, `inbox-promote`, `refresh`, `edit`, `pin`, `unpin`, `harden`,
`soften`, `repair`. It was fourteen when this section was written — `procedure activate`,
`procedure done` and `inbox-promote` joined the recipe with the commands they deny. A permission rule
is a prefix match on a command string, which is why that list needs seventeen entries for eight
mechanisms — `Bash(mycontext edit *)` does not match `mycontext pin`, and
`Bash(mycontext review promote *)` does not match `review promote-revision`,
because the pattern wants a space where the command has a hyphen. **A `POST /api/…` is not a command
string.** A user who followed that recipe and denied `review promote-revision` would have the protection
**silently removed by installing the UI**. The permitted-function list named `promoteRevision` and
`discardRevision` explicitly: two of the seventeen, reachable with no Bash call and therefore no
permission check.

**2. `promoteRevision` launders origin.** It applies a promoted revision through `updateItem` with
**`origin: 'human'` hardcoded**, deliberately and correctly — promotion *is* a human act, and the
function's own comment says so
(`src/core/revision.ts` · ``the change is applied through `updateItem` with `origin: 'human'`,`` · ~763).
`trustedStatus` (`src/core/trust.ts` · `export function trustedStatus(` · ~267) is the whole draft
gate, and it turns on `origin !== 'human'`. Compose the two with an HTTP route and the sequence is:
an agent stages a revision through the MCP surface, where `agentEdits: "review"` holds it as a proposal;
the agent POSTs to a promote endpoint; the proposal applies **as a human edit** to an item that is
already governing. **The agent approves its own proposal.** And it does so with no `--yes` anywhere,
which matters for a reason §7 states in as many words: `--yes` is not a security boundary, what it buys
is *legibility* — *"an explicit, greppable token in the transcript"*
(`README.md` · `an explicit, greppable token in the transcript` · ~4720). An HTTP request produces no
such token.

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

Read `README.md` §7 (`README.md` · `## 7. The trust boundary` · ~4532) before implementing anything
in this document. In summary, and each clause verified in the code:

- **The draft gate is `trustedStatus`
  (`src/core/trust.ts` · `export function trustedStatus(` · ~267)**: a non-human origin capturing a
  normative item is forced to `draft` regardless of what it requested, and a draft is in no injection
  tier (`isEligible`, `src/core/select.ts` · `export function isEligible(` · ~198, plus the
  normative-tier test in `select`).
- **No MCP tool takes an `origin` argument.** `create_item`, `update_item` and `supersede_item` each
  stamp `agent` themselves, so an agent cannot claim to have been a human.
- **The CLI is the human surface, and it passes `origin: 'human'`.** That is what makes it the route
  around every refusal the MCP tools make — and it is why the enforcement lives in Bash permissions.
- **`promoteRevision` (`src/core/revision.ts` · `export function promoteRevision(` · ~783) and
  `discardRevision` (`src/core/revision.ts` · `export function discardRevision(` · ~888) live in
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
- With no token, or with one the server rejects because it minted a new one, the page renders **a
  state that names the cause** — never an empty corpus, which would read as "you have no items".
  That is §8's staleness-is-never-silent rule applied to the credential. **Which words** it renders
  is the mockup's to decide and it draws only the exit case; see the correction below.

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
- **On exit the server closes the stream and the page says so**, and **does not auto-reconnect**.
  Silent reconnection would reintroduce the daemon by another name.

> **CORRECTED 2026-08-20 — the words are the mockup's, and there is one banner, not two states.**
> This section wrote two strings of its own: an exit message, and a separate *"this page was opened
> by a server that is no longer running — run `mycontext ui` again"* for the rejected-token case.
> The mockup ships **one** dismissible alert (`<div class="banner" id="exited" role="alert">`) whose
> text is the `ex.msg` key: **"The server has exited. This page shows what it last knew."** — with
> `mycontext ui` rendered beside it as a `<code>` and an `ex.ok` OK button. Build that string, in
> both languages, from the mockup's table.
>
> **The behaviour on either side of it is unchanged and is not the mockup's to change:** no
> auto-reconnect, and never an empty corpus rendered where a credential is missing, because that
> reads as *"you have no items"* — §8's staleness-is-never-silent rule applied to the credential.
> **What the mockup does not answer** is whether the rejected-token case reuses `ex.msg` or wants a
> string of its own; it draws the exit case only. That is an **open question for the owner**, not a
> licence to invent a second sentence — inventing one creates an untranslated string and a parity
> failure, which is exactly what the pinned instruction forbids.

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
| What would be injected here, and what spills | `select()` | `select.ts` · `export function select(items: Item[], ctx: SelectContext, config: Config): Selection {` · ~833 |
| Does this item govern this path | `matchesScope(item, target, config)` | `select.ts` · `export function matchesScope(item: Item, target: string, config: Config): boolean {` · ~266 |
| Is this item eligible at all | `isEligible(item, config)` | `select.ts` · `export function isEligible(item: Item, config: Config): boolean {` · ~198 |
| What does an empty scope mean for this category | `scopePolicyFor(config, type)` | `config.ts` · `export function scopePolicyFor(config: Config, type: string): ScopePolicy {` · ~143 |
| Does an agent's edit apply or wait | `agentEditsFor(config, type)` | `config.ts` · `export function agentEditsFor(config: Config, type: string): AgentEdits {` · ~165 |
| Is this item injected, and **on what terms** | `injection(item, config)` | `cli/commands/injection.ts` · `export function injection(` · ~84 |
| Estimated tokens for a body | `estimateTokens()` | `select.ts` · `export function estimateTokens(text: string): number {` · ~178 |
| **What is the active focus** | `readFocus(root)` → `FocusState` | `core/focus.ts` · `export function readFocus(root: string): FocusState {` · ~321 |
| **Is a focus actually narrowing** | `isFocusActive(focus)` | `core/focus.ts` · `export function isFocusActive(focus: FocusAxes \| null): focus is FocusAxes {` · ~271 |
| **What did focus hide, and how much** | `Selection.focus` → `FocusReport \| null` | `core/focus.ts` · `export interface FocusReport {` · ~237 |
| What has this context window already been given | `readSeen(root, key)` → `seenIds(state)` | `seen-file.ts` · `export function readSeen(root: string, key: string): SeenState {` · ~123 |
| Which key is that, for a session or a subagent | `ledgerKey(input)` | `hooks/io.ts` · `export function ledgerKey(input: HookInput): string \| null {` · ~61 |
| Which sessions exist, most recent first | `Ledger.recentSessions(n)` | `ledger.ts` · `recentSessions(limit: number): string[] {` · ~487 |

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
precisely the defect `select.ts` documents by name (`select.ts` · `` `query_items` re-derived it as a bare `` · ~244): the `query_items` MCP tool
re-derived scope matching as a bare `matchesAnyGlob(path, item.scope)` *"and consequently kept hiding
unscoped items from a path query long after they had become injectable on that path."* An unscoped item
matches every path under the default `scopePolicy` and no path under `inert`, and `matchesAnyGlob`
cannot know which. **The coverage map calls `matchesScope`.** It also filters on `isEligible` and the
normative tier — via `injection()` — or drafts and rationale items would colour the tree as governing,
which is the same class of false statement in a different medium.

One caveat for the implementer, because it is a real friction rather than an oversight: **`isNormative`
is private** to `select.ts` (`select.ts` · `function isNormative(item: Item, config: Config): boolean {` · ~204 — note the absent `export`). The UI must not copy its one-line body. Either
call `injection()`, which already encapsulates it, or export it — but not both, and never neither.

### `/api/select` — the endpoint the flagship screen rests on

The earlier version specified `/api/select?event=tool&path=X`. **That would have previewed a different
selection than the hook produces, and shown a different spill set**, which is fatal for a screen whose
entire value is "see exactly what Claude gets".

The reason is `seen`. `select()` filters already-injected items **before** budgeting
(`select.ts` · `hardening and must not be reverted` · ~850), and the comment above it says this is
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
before budgeting (`select.ts` · `const focus = ctx.focus ?? null;` · ~843), so omitting it previews a
different delivered set *and* a different spill set — the same failure, and the same consequence, that
`seen` had. The hook passes it as `focus: focusState.focus` from `readFocus(ws.projectRoot)`
(`pre-tool-use.ts` · `const focusState = readFocus(ws.projectRoot);` · ~199). The response carries
`Selection.focus`, the `FocusReport | null` disclosure, so the screen can say what focus hid rather
than silently showing less.

**So the endpoint takes a session:** `/api/select?event=tool&path=X&session=<id>&focus=<active|off>`.

**How `seen` is obtained, which is no longer the ledger.** Session dedupe state lives in a
**per-session seen file**, not in SQLite: the hook calls `readSeen(projectRoot, dedupeKey)` and passes
`seenIds(seenState)` (`pre-tool-use.ts` · `const seenState = readSeen(ws.projectRoot, dedupeKey);` · ~183). The key is **not** the bare session id —

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

> **CORRECTED 2026-08-20 — the mockup draws this control, and it carries one thing this list did
> not.** The selector is a header button (`#sessbtn`, `top.session`, with a `.live` dot) opening a
> popover `#sesspop`, whose rows are `id · name` on the reading-start side and the last-injection
> time on the other; a `sess.cold` row *"Cold session"* with the sub-label `sess.coldn` *"no seen
> set"*; and two asides — `sess.coldhelp` (*"A different question, not a different view … Never
> shown as the current session's preview"*) and `sess.parent` (*"Previews are of the parent thread.
> A subagent has its own dedupe key and its deliveries are not folded in here"*). Points 1–4 above
> all survive; what they omitted is **naming**:
>
> > **Names are optional and mycontext owns them.** A session nobody named keeps its id and short
> > prefix — nothing is invented for it, because a derived name can be wrong and naming is the
> > moment you know what a session was for. (`sess.name`)
>
> So a row renders the id in `.m` and the name, when there is one, inside `<bdi>`; the header label
> shows the **name if named, the id if not, and `cold` for the cold option**. The picker points at
> `mycontext session name` and `/mycontext-session` and says both *"work without this UI"* — which
> is the compose-don't-write rule (§2) applied to the one control that most looks like it should
> write. **The absence of a derived name is a decision, not a gap to fill.**
>
> **Focus is the mirror of it:** `#focusbtn` / `top.focus` opening `#focuspop`, with exactly two
> rows — `focus.live` *"The focus that is set"*, sub-labelled with the file `state/focus.json`, and
> `focus.off` *"Focus off"* / `focus.offn` *"no narrowing"* — and the aside `focus.help`: *"Focus
> off answers a different question … The default is always what Claude really gets."* Selecting
> either repaints the provenance bar (§4), which is where "focus off — a different question" is
> disclosed rather than on each screen.

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

> **CORRECTED 2026-08-20 — this constraint is no longer a constraint awaiting an implementation. The
> mockup is the string table.** It ships both languages, a toggle (`#lang`, titled *"English /
> עברית"*), and **326 distinct `data-t` keys** with a Hebrew value for each. Four things it settles
> that this section left to the implementer, and none of them is optional:
>
> - **The keys are the mockup's, and so are the sentences.** The pinned instruction makes rewording
>   a defect: *"Every user-visible string is in the mockup's table with a Hebrew pair. Inventing a
>   new sentence creates an untranslated string and a parity failure."* The §6 parity test therefore
>   compares the two shipped tables **against each other**; the mockup is where a key gets minted.
> - **Substitution builds nodes, never strings.** Each Hebrew value is text with `{m:…}` marking a
>   monospace run, and the switch clones English child **nodes** rather than assigning
>   `textContent`. The mockup records both failures it had to fix to get here: `innerHTML` destroyed
>   the `.m` spans that carry `unicode-bidi:isolate`, and `textContent` flattened them just as
>   thoroughly — *"the English side was captured as a STRING, so the seven `data-t` elements holding
>   `.m` spans lost them on the first toggle and never got them back."*
> - **"Paths stay LTR" is implemented as two conventions, not one.** `.m` runs carry
>   `direction:ltr; unicode-bidi:isolate`; **corpus text sits in a `well` and inside `<bdi>`, and the
>   product's own words never do** — `pane.well`: *"that is how you tell them apart."*
> - **Charts mirror by projection, never by transform.** `X(u,W)` flips an x-coordinate into the
>   reading direction and `ANC()` flips a text anchor, *"so the chart mirrors while its glyphs stay
>   upright — `scale(-1,1)` would reverse the digits too."* Box-model views need none of it, which
>   is why the ribbons, ghost lanes, heatstrips, sparklines and diverging bars are CSS and the
>   staircase, comb, pulse and ego-graph are SVG. **That is a build rule, not a rendering detail.**

### The visual system, which is four decisions and not a default

**New in the sixth pass, because the pinned instruction names restyling as a forbidden change** and
this document previously said nothing a reviewer could hold a restyle against. From
`INSTR-the-mockup-is-the-ui-specification-build-it-exactly-and-ask`:

> **Restyling.** The gloss, the logical properties, the light-dark tokens and the type scale are
> decisions, not defaults.

- **Logical properties** — already required above, and now the mockup's whole sheet is written that
  way. The one physical offset in it is the stale-field rule on the review queue, and its mirror is
  written next to it: `td.stale{box-shadow:inset 2px 0 0 …}` with `[dir="rtl"] td.stale` beside it.
- **`light-dark()` tokens** under `color-scheme:light dark`, with a `#theme` control in the header.
  Several token values carry the contrast ratio they replaced in a comment — `--dim` and `--faint`
  were corrected off measured 2.91:1 and 3.29:1, and `--edge-3` exists because a token bounding a
  **control** owes 3:1 and `--edge` measured 1.65:1. **Those are measurements; do not re-pick them.**
- **The gloss** — `.card.gloss` and `.pop.gloss.float`, with a `#sim-rt` *"simulate
  reduced-transparency"* control in the strip so the reduced-transparency rendering is reviewable
  without changing an OS setting.
- **The type scale** — the `--fs-…` steps, used throughout rather than literal sizes.

**And every data-driven size is set through the CSSOM** (`element.style.setProperty`), never as a
`style` attribute: the shipped `style-src 'self'` (§2) blocks the attribute parser and permits the
CSSOM. The mockup's own inline `<style>` and `<script>` are the one thing in it the product may not
copy — it says so in its header comment — and its markup is otherwise written to be lifted straight
into `public/styles.css` and `public/lib/*.js`.

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

### The inventory, and where this document's groups went

> **CORRECTED 2026-08-20 — the rail has four groups, not eight, and 21 screens, not thirteen.**
> The headings below (*Core*, *Navigate*, *Watch*, *Work*, *Configure*, *Report*, *Ask*, *Learn*)
> are kept as **grading buckets**, because that is what they were written to be and §1's test is
> applied per bucket. **They are not the rail.** The rail the user sees groups screens **by tense**:
> what arrives, why it did or didn't, what you are about to change, and what you read. Build the
> rail the mockup draws; read the buckets below for the verdict on each screen and nothing else.

| Rail group (`data-t`) | `data-s` / `data-p` | Title | Graded below under | Wave |
|---|---|---|---|---|
| `nav.inj` — *Injection — what arrives* | `preview` | Injection preview — **the landing screen** | Core | **[W1]** |
| | `coverage` | Scope coverage | Core | **[W1]** |
| | `gaps` | Coverage gaps — rail badge `7` | Navigate | **[W1]** |
| | `simulate` | Budget simulator | Core | **[W1]** |
| | `injected` | Injected now | Core | **[W1]** |
| `nav.ev` — *Evidence — why it did or didn't* | `watch` | Audit stream | Watch | **[W3]** |
| | `ask` | Ask | Ask | **[W3]** |
| | `doctor` | Doctor — rail badge `2` | Report | **[W3]** |
| | `decay` | Decay | Report | **[W3]** |
| | `graph` | Relations | Navigate | **[W3]** |
| | `status` | Status — ⚠️ the recorded exception | Report | **[W3]** |
| `nav.ch` — *Change — composed, never run* | `work` | Review queue — rail badge `3` | Work | **[W2]** |
| | `capture` | Capture | Work | **[W2]** |
| | `palette` | Composer | Work | **[W2]** |
| | `config` | Configure | Configure | **[W2]** |
| | `proc` | Procedures — `PROPOSED` | — not graded | unscheduled |
| | `port` | Export / import — `PROPOSED` | — not graded | unscheduled |
| | `packs` | Template packs — `PROPOSED` | — not graded | unscheduled |
| `nav.read` — *Read* | `docs` | Documentation | Learn | **[W3]** |
| | `tut` | Tutorials | Learn | **[W3]** |
| | `learn` | Learn | Learn | **[W3]** |

**Three of these are new screens this document never described**, and one thing that reads like a
screen is not one:

- **`proc` Procedures, `port` Export / import and `packs` Template packs are `PROPOSED`.** They are
  decided elsewhere — `2026-08-19-v2-scope-decisions.md` §2 for the `procedure` category, and the
  plans `2026-08-20-v2-export-import-and-packs.md` and `2026-08-20-v2-categories-and-runbooks.md` —
  and **nothing in the three web-UI plans builds them**. They carry no wave here because assigning
  one would schedule work no plan contains. `pr.sub`, `port.sub` and `pk.sub` all say the same thing
  in the screen: *decided, nothing implements it yet*, and the label is the whole point.
- **`docs` and `tut` are the other two thirds of what this document called *Learn*.** See *Learn*,
  below.
- **`capture` is a rail screen, not a bullet under Work.** See *Work*, below.
- **The item detail pane is not a screen.** It is `<aside class="pane">`, a third grid column that
  opens beside whichever screen is current, and it is described under *Every screen*, below.

### Every screen — three surfaces that are not in any group

**New in the sixth pass.** The mockup carries three chrome surfaces that belong to no screen and
that this document never described. All three are load-bearing; the pinned instruction forbids
dropping them.

- **The item detail pane** (`<aside class="pane" id="pane">`) — *"the destination every id was
  missing"*. Every item id anywhere in the product renders as a `.linkid` button, and clicking one
  opens the pane: the id, the title, a definition list of **type / status / tier / scope / governs /
  file**, a **twelve-week delivery sparkline** — *"hatched where the item was spilled that week and
  grey where nothing was delivered"* — and the item **body rendered as Markdown** in a `well` inside
  `<bdi>`. `pane.histn` states why it lives here rather than on a screen of its own: it is *"the
  cheapest possible answer to 'is this thing still alive', and the one history that belongs on every
  item rather than on a screen of its own."*
- **The provenance bar** (`<div class="prov">`, between the body and the strip) — *"one home for
  every qualification the screens owe"*. It carries, as `label · value` pairs with the warning half
  emphasised: *preview of* **parent thread**; *focus* **off — a different question**, present only
  when focus is off; *tokens* **not recorded before 1.0.1**; and *projection* **fresh**. Those are
  four disclosures this document requires in four different sections — §3's parent-thread rule,
  §3's focus-off labelling, §5's *absence means "not recorded"*, and §5's staleness-is-never-silent
  constraint. **The mockup's decision is that they have one home rather than being re-decided per
  screen**, and it repaints on every session and focus change.
- **The header** (`<header class="top">`) — the mark, then, on the reading-end side: the focus
  button, the session button with its `.live` dot, an **`∅` zero-data toggle** (*"Toggle the
  zero-data view"*), the **`א/A` language toggle** and the **`◐` theme toggle**. The `∅` control is
  new here and is the empty-state requirement made reviewable: §4's empty states and
  `2026-08-18-v2-decisions.md` §5's *"not the wall of dashed warning dots"* are only ever checked if
  someone can see them without emptying a corpus. **There is no global search box** — an earlier
  mockup carried one as decoration and this document committed to no search anywhere; the current
  mockup does not draw it, and the two now agree.

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

> **CORRECTED 2026-08-20 — what these four screens actually contain, and what two of them are
> called.** The verdicts and the waves are unchanged; the mockup draws each verdict in the screen
> header, in the same words this document grades with (`preview.v` *"exactly what Claude gets"*,
> `cov.v` *"the gaps are the point"*, `sim.v` *"all four tiers"*, `inj.v` *"live, not
> hypothetical"*). The descriptions were too short to build from, and two titles were wrong.
>
> **Titles.** *"Scope coverage map"* is **Scope coverage** (`s.coverage`, `cov.h`). *"What is
> currently injected"* is **Injected now** (`s.injected`, `inj.h`).
>
> **Injection preview** — four parts, not two. An **Event card**: an `event` select over the four
> values `select` accepts, the path shown beside it, and a `help.more` disclosure *"What decides
> this"* naming all five narrowing inputs and stating *"This screen reads. Nothing here changes your
> corpus."* A **Delivered** table of item and tier with a token caption, plus a `preview.carried`
> note on **index lines carried from a prior session** — shown here and in `mycontext context`
> identically, *"an item arriving from somewhere you cannot see is the same defect as one dropped
> silently, pointed the other way"* — whose `carried` tier chip is marked `PROPOSED`. A **"Why not —
> the first gate that failed"** card: an item picker and a **gate ladder** running the gates in
> `select()`'s own order — *eligible, tier, focus, scope, seen, budget* — because *"the order is the
> explanation: a list of six reasons is noise, and the one that binds is only meaningful in the
> position it holds."* Rungs above the binding gate passed; everything below is **not reached**
> rather than passed. And the **budget ribbon**, below.
>
> **The budget bar is a four-tier ribbon with a ghost lane.** `preview.ribbon`: *"Budget ribbon —
> four tiers, and what fell out of each."* One segment per admitted item **sized by its real
> `itemCost`**, and beneath each track *"the ghost lane: every spilled item at the width it would
> have taken, in the position the selector considered it."* Two rules that a simpler bar would
> break: a wide ghost followed by a narrow fill *"is first-fit being honest — drawing spills as a
> tail would misrepresent the algorithm"*, and **a tier the event never reaches is drawn absent and
> hatched**, because *"an empty track would claim it ran and delivered nothing, which is a different
> fact."* It follows the event selector rather than adding a second one.
>
> **Scope coverage** — the pinned items are **hoisted out of the tree** into their own card
> (`cov.pin` *"Pinned — governs every path, independent of scope"*), because *"colouring it per-path
> is why a directory that is governed used to render as a gap. Hoisted here, 'gap' means something
> true."* Each tree row carries a **magnitude**, not only a state: a bar of governed / ungoverned /
> not-examined for the files rolled up under it, and a `governed of total` count — *"four categorical
> dots said which rows were dark; they could not say how dark."* The dot stays because its shape
> survives monochrome, and depth is a `data-depth` step so it mirrors. **Four legend states**, and
> the fourth is **not examined**, in bold. The screen's own empty state is here, not on *Coverage
> gaps* — see that entry.
>
> **Budget simulator** — an **admission staircase** (items admitted per budget) which is *"exact,
> not sampled — the selector is re-run at every cumulative candidate cost, so nothing is invented
> between two rungs"*; a **threshold ladder** the slider **snaps** to, because *"every value between
> two rungs behaves identically … dragging lands on meaning rather than on 6,050"*, with **a red
> rung marking an eviction: more budget, fewer items**; a tier picker and readout; a tier table
> whose *Fits* column is a **ratio, not a count** — *"'2 of 6' says how much of what was eligible
> actually arrived, and the chip flips at the boundary"*; a `help.why` disclosure explaining
> first-fit; and a **"Selected, then not delivered" diverging bar** (`sim.ratio`) whose long red half
> *"names which budget is too small, which is the question this simulator exists to answer."*
> **First-fit is the screen's thesis** and this document never mentioned it: `sim.sub` opens *"Raising
> a budget can evict an item — the selector is first-fit, not a stable ranking with a cut line."*
>
> **Two dependencies the mockup names and this document must not paper over**, both stated on the
> screen: `itemCost` is **private in `select.ts`** and the staircase needs *"one export, and this
> chart is live"*; and the diverging bar's two numbers come from `audit_item.role` through
> `topItems`, *"already exported, already indexed, called twice."* The second is available today; the
> first is a one-line export, and it is named here rather than discovered by the implementer.
>
> **Injected now** is unchanged in substance — item, tier and **when**, with `inj.note` saying in the
> screen what §3 says here: read from the seen file, *"not `Ledger.seen` — that is a replayed
> projection nothing here updates, and it would show a different number."*

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

> **CORRECTED 2026-08-20 — the empty state is on the coverage map, gaps has a third state, and the
> print rule is not coverage-only.**
>
> **The empty state belongs to *Scope coverage*, not to *Coverage gaps*.** The mockup puts it there
> (`#covempty`), which is right for the reason this bullet itself gives — the wall of warnings is
> the *map's* rendering, so the map is what must not render it. Its words are `cov.e1` **"Nothing
> governs this project yet."** and `cov.e2` *"That is the normal state of a new workspace, not a wall
> of warnings. One sentence, said once — not repeated per row."*, above one composed
> `mycontext add constraint … --scope "src/**"`. The requirement above is unchanged; only its
> address was wrong. The `∅` header toggle is how it gets reviewed.
>
> **Coverage gaps has a third state this document did not have.** The screen is a
> **Where / What / Next** table — a directory with a count of files nothing scopes and a **Compose**
> button, a category with nothing in it, and `vendor/` marked **not examined — past the file limit**.
> `gaps.note` states the rule: ***"Not examined is a third state, never folded into 'gap'. A file the
> walk did not reach is not a file nothing governs."*** Two states would have reported the walk's own
> limit as a fact about the corpus, which is the same class of false statement this document exists
> to prevent. The same third state appears in the coverage legend (`cov.k4`).
>
> **The print stylesheet covers every screen, not the coverage map.** *"It survives as the coverage
> map's printable rendering"* is now wrong twice over: there is **no "Printable" button** anywhere,
> and the rule is `[data-p].printing{display:block!important}` with the `printing` class set by the
> rail on whichever screen is current. So **Ctrl+P prints the screen you are on**, all 21 of them,
> with the header, rail, provenance bar, strip, popovers and banner hidden and the gloss flattened to
> a plain border. The mockup's own comment records why it is written that way: *"The previous pass hid
> every screen but Coverage and never un-hid it, so Ctrl+P printed a blank page … un-hide the screen
> being printed rather than assuming one."* **The item detail pane prints too** (`.pane{display:block
> !important;border:0}`), which is what makes a printed screen carry the item it was opened on. The
> substance of the *Onboarding view* merge stands — same data, no second implementation, still the
> thing you screenshot — but it is now a property of the whole app.
>
> **Relations gains three rules and loses a table.** Nodes carry **ids, not titles**, *"which keeps
> bidi-sensitive text out of every SVG in the product."* **Every edge carries its relation type, and
> its line style carries severity**, because those are two different facts: `isLoadBearing` already
> classifies the vocabulary, *"so a dangling `relates_to` reads as noise and a dangling `constrains`
> reads as an alarm."* And **direction is the layout** — *"the column decides which way the relation
> points, so nothing has to be simulated."* The consequence is the loss: the dangling edges *"need
> no separate table"*, because severity is already on the line. The legend is six entries — focus,
> target not in corpus, superseded, load-bearing, referential, dangling. The constraints above
> (radius 1, deterministic layered layout, 60-node cap with an explicit "+N more", no physics, no
> dependency) are unchanged and are restated verbatim on the screen in `gr.sub`.

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

> **CORRECTED 2026-08-20, then PARTLY REVERSED the same day by the owner.** *Audit live* is
> called *Audit stream* and has a chart — that stands. But the strip's **injection volume was
> removed by this pass rather than questioned**, and the owner has restored it: the mockup now
> carries `strip.inj` beside the item count, and the activity pulse keeps its place on the Audit
> stream. Ambient number, investigative chart — both, deliberately.
>
> **The strip's contents, in order** (`<footer class="strip">`): the branch `main`, the commit
> `7f3a91c`, the sync chip **in sync** (`strip.sync`), a separator, **`43` items**
> (`strip.items`) — which is the header count's other end and what makes *Status* the place it
> leads — the **context number** (`#ctx`), and **`0.55 ms` audit append p95** (`strip.append`) with a
> **`measured`** chip (`strip.meas`). Plus the `#sim-rt` reduced-transparency control (§3), which is
> `noprint`. **There is no injection-volume figure**, so *"injection volume passes — it is derived
> from the ledger over time and no terminal shows it as it moves"* is a grading of something the
> strip does not show. The git vocabulary above is unchanged and is exactly what the strip renders;
> the context number's condition is unchanged and is §4b's.
>
> **The `0.55 ms · measured` pair is the one real number in the product's chrome**, and the chip is
> not decoration: everything else on every screen is corpus data, and this is a measurement from
> `test/perf/audit-latency.perf.ts`. **Do not render it without the chip** — a bare number in a strip
> of corpus figures reads as a corpus figure.
>
> **Volume moved to the screen, as a chart.** The Audit stream carries an **activity pulse** —
> *"one column per ten seconds, newest at the reading-end edge. Height is records in that column,
> colour is the record kind."* `watch.pulsen` gives both the justification and the cost: *"It is the
> only thing that makes a live stream feel live, and the time buckets it needs are already indexed
> by `idx_audit_at`."* This is the shape §1's test asks for and the strip could not give it.
>
> **The screen is *Audit stream*** (`s.watch`, `watch.h`), not *Audit live*. Below the pulse:
> **five filter buttons** — all, mutation, injection, hook, focus — the four record kinds §5 pins
> plus *all*; an **At / Kind / What** table; and a polite live region announcing how many records are
> shown.
>
> **A focus change is not a row.** `watch.sub`: *"A focus change is a **regime change**, drawn as a
> rule across the feed rather than as one row."* The mockup's own comment says why, and it is the
> reason §5 put focus records in the stream at all: *"everything below it was selected from a
> different corpus, so the series either side of it is not comparable. Drawn as a row, it reads as
> one more event and the disappearance it explains looks causeless."*
>
> **An injection row carries its cost as a bar, and an absent `tokens` as a hatched void.**
> `watch.voidn`: the bar is the record's cost against the tier budget; where `tokens` is absent the
> row *"draws a hatched void and says so … A zero-length bar would be a claim the record does not
> make."* That is §5's *absence means "not recorded", never zero* given a rendering, and the mockup
> spells the third state out: a number, `null` meaning never written, and **absent because the record
> is not an injection at all**.

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

> **CORRECTED 2026-08-20 — three screens, not one and two bullets; the palette is the *Composer*;
> and the promote command was missing a required flag.**
>
> **Overlap detection at capture is the `capture` screen**, titled **Capture**, with its own rail
> entry. `cap.sub` states what it is for in the terms §1 asks: *"Composes an `add`. What it
> contributes over the CLI is the overlap check — the items already governing this scope."* It shows
> a card **"Already governing `src/billing/**`"** listing those items with their category and tier,
> the composed `mycontext add constraint … --scope … --severity hard`, and a `cap.warn` note **"This
> is a write. Run it in your own shell."**
>
> **And it draws a hard line this document did not.** `cap.nosim`: *"These are the items whose
> **scope matches**. No similarity or ranking is shown, because no similarity metric exists in this
> product — and inventing one here is how a mockup starts lying."* The bullet above says *"surface
> two items saying nearly the same thing"*, which reads as semantic similarity. **It is scope
> overlap.** Build the scope match; do not build a similarity score.
>
> **The command palette is the *Composer*** (`s.palette`, `pal.h`), and its subtitle names a
> capability this document did not have: *"Builds a command from selections. The argument list is
> shown as **chips**, so a value carrying shell syntax is visible before it reaches your clipboard."*
> The screen shows one argument rendered as a red chip — `the $(echo X) way` — and **Copy blocked**,
> with `pal.block`: *"**Copy is blocked.** One argument contains shell substitution syntax.
> Double-quoting does not neutralise `$(…)` — a POSIX shell still substitutes inside double
> quotes."* That is the composition half of the finding in `2026-08-18-v2-decisions.md` §6.1 and §7,
> and it is a **refusal**, so it survives on its own terms rather than as a rendering: the argument
> list is chips *in order to* make the refusal visible.
>
> **The glob tester is specified, and its justification is on the screen.** A pattern input, a live
> count, and *"every file in the repository, with the matches **lit as you type**"* — because
> `pal.globn` argues that *"a count on its own — '7 files' — is a count you cannot inspect, and a
> count you cannot trust: the empty result and the nearly-empty result look identical until you can
> see which files."* Matching goes *"through the same `globToRegExp` cache the selector uses, over
> `listRepoFiles`"*, which is §3's compose-don't-reimplement rule applied to a glob.
>
> **OPEN QUESTION for the owner, recorded rather than resolved.** This bullet says *"Read commands
> execute in the UI."* **The Composer draws no run control** — its only action is a Copy, and that
> Copy is blocked. Elsewhere the mockup executes only the Ask screen's structured query (`ask.run`
> *Run*), which is not a CLI command. So either read commands lost their in-UI execution, or the
> mockup simply does not draw it. **Do not resolve this by building a Run button**: the pinned
> instruction forbids adding a control the mockup does not show, and §2's boundary is drawn around
> *writes*, so nothing here can be inferred either way. Ask.
>
> **The review queue's composed command was missing `--revision`.** This document composes
> `mycontext review promote-revision <id> --yes`. The mockup — whose header comment records that
> *"every command shown is a REAL command with REAL flags"* after a previous pass shipped a Copy
> button for a flag that does not exist — composes:
>
> ```
> mycontext review promote-revision RULE-never-log-customer-email --revision REV-8c21 --yes
> ```
>
> The item id and the revision id are **both** required, which is why the screen heading is the pair
> `RULE-never-log-customer-email · REV-8c21`.
>
> **And the diff is specified more tightly than "the proposed text against the text in force".**
> A **Field / In force / Proposed** table whose proposed column is a **word-level** diff — *"not a
> second paragraph to compare by eye"* — built from real `<ins>` and `<del>` elements, *"so a screen
> reader announces the change without any added ARIA."* The stale field carries a rule down its
> **reading-start** edge, which `work.diffn` flags as *"the one physical offset in the sheet, and its
> mirror is written next to it rather than discovered later."* Per-field staleness is unchanged, and
> the stale row says both halves: *changed since staging* / *promote refuses until re-based*.
>
> **Two things follow the Copy that this document had nowhere to put.** A **command state** chip —
> `state.armed` **armed**, with `work.state` *"copied, not yet observed landing"* — and a
> `help.land` disclosure **"How you will know it worked"**, whose three lines are the compose-only
> rule made usable: *"Run it in your own shell. This tool never writes."* / *"The receipt: an audit
> record with `op: promote-revision`. Returning to this tab re-checks."* / *"If the body moved first,
> promote refuses and names both values — **that refusal is the product working, not failing**."*
> **That pattern — composed command, armed state, receipt — is the general treatment of a write in
> this UI**, and it appears again on Configure.

### Configure — the strongest "a terminal cannot do this" screen available — **[W2]** (plan 2, Task 13)

**Absent from the earlier version entirely**, and the owner named it in his first sentence.

There is no `mycontext config` command. `config.json` is hand-edited — the deny hook says so in the
words it refuses with: *"Configuration changes to `.my_context/config.json` are the user's to make — ask,
do not edit"* (`src/hooks/pre-tool-use.ts` · `to make — ask, do not edit.` · ~118). So today, changing
`scopePolicy` from `global` to `inert`, or `agentEdits` from `review` to `allow`, or a budget, means
editing JSON and finding out what it did by living with it.

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

> **CORRECTED 2026-08-20 — the mockup draws three of the five previews, adds one this document did
> not have, and settles what "composes" means for a file that has no command.**
>
> **What is on the screen**, in order: a **Budgets** card over all four tiers with the changed one
> shown as a pair (`jit  6000 → 8000`); a **"What changes"** card of delta rows; a
> **`categories.lesson.scopePolicy`** segmented control with a **blast-radius** rendering; an
> **"Apply this"** card carrying the `config.json` **patch**; a **Watched documents** section marked
> `PROPOSED`; and a `help.land` **"How you will know it worked"** disclosure. `cfg.sub` states the
> whole contract in one line: *"Every change previewed as a diff of what would govern, validated
> against the same `resolveConfig` that will read it."* The validation requirement above is
> therefore unchanged.
>
> **The delta is a pair, not a direction.** `cfg.deltan`: *"Each row is the **pair**, not the
> direction alone: the old value struck through, the new one highlighted, and the row tinted by which
> way it went. 'What was it before' is half of 'what changes', and a lone `+1` chip keeps the
> direction while losing the pairing."* This document said *"shown as a diff of the governing set,
> not as a warning"* — right in spirit, and the mockup fixes the shape a `+7` chip would have taken.
>
> **"7 items become injectable nowhere" is a border colour and a count.** `cfg.spn`: *"The border
> colour and the count **are** the blast radius: how much of the corpus stops working if this value
> changes. `inert` is the most destructive change the configuration offers, and `scopePolicyFor`
> makes its effect computable exactly rather than estimated — the items are named, and the ones past
> the cut are counted rather than hidden."* Named-then-counted, not truncated silently.
>
> **"Composes" means a patch to a file, and the screen says why there is nothing else to compose.**
> `cfg.nocmd`: *"There is no command that edits a budget. Configuration is a file, and the deny hook
> says so in those words: 'changes to `.my_context/config.json` are the user's to make — ask, do not
> edit.' So this is the edit, not a command."* The Copy button is labelled **Copy the patch**
> (`btn.copypatch`) and what it copies is a unified diff of the `budgets` block, addressed to
> `.my_context/config.json`. The receipt is different from a command's, and the disclosure states it:
> *"this screen re-reads `config.json` from disk on every load, so returning to the tab shows the new
> value — or a `parseError` field if the JSON broke."*
>
> **One section this document did not have: Watched documents**, marked `PROPOSED`. It shows the
> shipped defaults being replaced by what the repository actually has, and carries a rule:
> ***"the list replaces and never merges — a list you wrote must not silently gain globs you did
> not."*** It pairs with the `watched_docs_no_match` finding on Doctor.
>
> **OPEN QUESTION for the owner, recorded rather than resolved.** This section requires five
> previews. The mockup draws **budgets** and **`scopePolicy`**, and adds **`watchedDocs`**. It draws
> **neither `agentEdits` per category nor `enabled`/`tier` as a diff of the governing set.** Both are
> reasonable to want and both are cheap to compute — `agentEditsFor` and `injection()` are already on
> §3's compose list — but the pinned instruction is explicit that *"if it seems obviously missing, it
> is a question, not a licence."* **Do not build them from this document.** Ask whether they were cut
> or merely not drawn.

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
  (`ledger.ts` · `ON CONFLICT(session_id, item_id, tier) DO NOTHING` · ~321), so the ledger holds
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

> **CORRECTED 2026-08-20 — Doctor has two finding codes this document could not have listed, Status
> has five rows and not three, and Decay is two charts.**
>
> **Doctor.** The grouping is exactly as graded — three cards, `error` / `warning` / `notice`, each
> row linking the item it names, each card carrying a composed repair command with a Copy button
> (`mycontext refresh <id>`, `mycontext init --rewrite-watched`). `doc.sub` restates the rule:
> *"each linked to the item it names and the command that repairs it — **composed, not run**."*
> **Two codes on it are not in `src/doctor/checks.ts` and are marked `PROPOSED`:**
> **`watched_docs_no_match`** — *"zero files match any watched glob, so the capture nudge can never
> fire. The shipped defaults name three paths from one workflow; this repo has none of them"* — and
> **`foreign_store`**, reported at `notice`, naming a second cross-project knowledge store on the
> machine and a second plugin's durable-learnings directory, with the disclaimer that
> ***"mycontext never reads or writes it — reported so you learn it here rather than from a
> surprise."*** The list of codes above is this document's reading of shipped code and stays as it
> is; these two are proposals the mockup carries, and they are labelled as such on the screen.
>
> **Status is five rows, and the fifth sentence is the point of the screen.** Items, **drafts
> awaiting review**, **pending revisions**, **staged lessons**, **unfinished ingests** — and then
> `st.four`: ***"There are **four** unfinished-work queues, not one. `mycontext review` shows two of
> them."*** This document graded the screen as *"corpus counts, the draft queue and the
> pending-revisions line"*, which is three of the five and misses the only thing on it that a
> terminal does not already say. It does **not** change the ⚠️ grading — the screen is still a table
> and still the destination of the header's counts, exactly as `st.sub` says: *"Not the landing
> screen, and no longer justified by being one. It is where the header's corpus counts lead."* It is
> a better exception than the one recorded, and the wave is unchanged.
>
> **Decay is two charts from two sources, and the screen says so before either of them.** `dec.sub`
> carries the sessions-not-weeks argument this bullet makes, verbatim in substance, and then adds:
> *"The delivery history in the second card is a different measurement from a different source."*
>
> - **The recency comb** — one tooth per item, **never bucketed**, x = sessions since last injection
>   on a log scale. Its legend is five entries, and three of them are kinds rather than positions:
>   **never injected** — *"a kind, not a big number"* — **pinned and cold**, which is *"a defect
>   signal, not decay"*, and **unrestricted (`∀`)**, *"a breadth view over cold ∪ warm, never a third
>   bucket."* A `help.why` disclosure carries the caveat this bullet requires: *"The ledger records
>   **injection**, not reading or reliance. A cold item may still be governing — and a cold
>   `always:true` item is a bug in selection, not decay."*
> - **A 90-day delivery heatstrip, per item** — *"one cell per day. Intensity is how much was
>   delivered that day, a **hatched** cell is a day the item was **spilled**, and an empty cell is a
>   day nothing happened."* It is *"the one view that separates 'quiet' from 'selected and thrown
>   away repeatedly'"*, and it is **not the ledger**: `audit_item.role` joined to `audit.at`, both
>   indexed, with the `since` / `until` filters that already ship.
>
> **This does not reopen the sessions-not-time correction above.** A time axis appears, on the second
> card only, sourced from the audit projection rather than from the ledger — which is precisely the
> condition that correction attached to it: *"a time axis would be a second encoding of a different
> quantity and must be labelled as one if it appears at all."* The mockup labels it. What is wrong
> above is only the singular: *"the x-axis is the session sequence"* describes one of the two charts.

### Ask — **[W3]** (plan 3)

- **Structured query builder** ✅ with predefined useful queries, over the corpus **and over the audit
  history**. Filters for people who do not write SQL.
  Reuses the existing read-only path; the `updated_at` trap is already documented and must be carried.
  Audit queries do **not** read the JSONL log directly — they read the SQLite projection derived from it
  (§5), and every audit answer will carry the projection's freshness, because a projection that is behind
  its log must either catch up or say so rather than answer quietly.

> **CORRECTED 2026-08-20 — no SQL is shown, and the screen argues that showing it would undo the
> design.** This bullet used to end by promising that the builder would display the SQL it had
> generated, on the argument that seeing it would teach the grammar. The mockup shows none, anywhere. `ask.sub` is: *"Fields, operators and values — bound as parameters, composed on the
> server. **No query text crosses the wire.**"* And a disclosure titled ***"Why there is no SQL
> box"*** carries §2's own argument back onto the screen: *"A `readOnly:true` connection still permits
> `VACUUM INTO '<any path>'` … A keyword scan is what stops it, and that scan cannot see keywords
> inside backtick or bracket identifiers. **Removing the input removes the problem.**"*
>
> The teaching intent was not wrong, but its instrument was: **a screen built to delete an input does
> not re-add it as output.** §2's rule is unchanged and the mockup states it more plainly than this
> document did — the security decision here is not the mockup's to overrule, and it did not; it drew
> the same rule with a better sentence.
>
> **The controls are three selects and a Run.** Field, operator (`is` / `is not`), value, then
> `ask.run` **Run** — and a result table of **At / Item / Role**, `role` being the `audit_item`
> projection's own column, so a row reads *injected* or *spilled*.
>
> **A second disclosure this document did not have: "Why a search can return nothing."** It records
> that matching is **literal today**, so `search "silently drop"` finds nothing while the corpus says
> *"dropped silently"*; that **full-text search with a stemmer is decided** and marked `PROPOSED`,
> *"behind `search` and `query_items` only, never in `select()`, so what gets injected stays
> deterministic"*; and that *"**the case is recall, not ranking**. That distinction is load-bearing:
> `core/search.ts` carries a written decision against ranking, and this does not touch it."* It ships
> with a parity test because *"measured, a naive swap took one query from **14 hits to 1**."*
>
> **OPEN QUESTION for the owner, recorded rather than resolved.** This bullet says the builder runs
> *"over the corpus **and** over the audit history"*. **The mockup's field list is audit-only** —
> `kind`, `op`, `origin`, `item` — its value list is the four record kinds, and its result columns are
> audit columns. Whether corpus fields were dropped, or the screen simply draws one of its two field
> sets, is not answerable from the mockup. **Do not add corpus fields on the strength of this
> sentence.** Ask. (The projection-freshness rule above is a behaviour constraint and stands
> regardless; the mockup discloses it in the provenance bar as *projection · fresh*.)

### Learn — **[W3]** (plan 1, Task 19)

- **Full help and documentation with examples, in the UI.** ⚠️ **Conditional pass.** Rendering
  `mycontext help <topic>` in a browser is `mycontext help <topic>` in a browser. It passes §1's test
  **only** in the form specified here: **every help topic cross-links to your own corpus.** The `scope`
  topic shows the items in *this* project that declare a scope and the ones that do not, with what that
  means under this project's `scopePolicy`. The `categories` topic shows how many items you have of each
  and which of your categories are empty. The `capture` topic links to your most recent captures. That
  join — generated guidance against your actual corpus — is what a terminal cannot do, and it is the
  whole justification. **Built without it, this screen is a documentation viewer and should be cut.**

> **CORRECTED 2026-08-20 — this is three screens, and the ⚠️ belongs to one of them.** The mockup's
> `nav.read` group is **`docs` Documentation, `tut` Tutorials and `learn` Learn**, and it grades them
> separately. The conditional pass and the threat to cut attach to **`learn`** alone; the other two
> earn ✅ on grounds this document never considered.
>
> - **`learn` — Learn.** ⚠️ `ln.v` *"conditional pass — the corpus cross-links earn it"*. The
>   condition above is met exactly and is the whole screen: **four help topics, each linked to the
>   items in *this* corpus that demonstrate it** — `categories`, `scope`, `capture`, `workflow`, with
>   `ln.sub` saying *"That join is what a docs page cannot do."* Two of the four rows carry a real
>   item id beside the topic. Build the join or cut the screen; that has not changed.
> - **`docs` — Documentation.** ✅ `dv.v` *"cross-linked to your own corpus, which a docs site cannot
>   do"*. It renders **the repository's own README**, and the mechanism is the decision: *"addressed
>   by **heading ordinal** — so one integer gives both a deep link and a language switch that lands
>   on the same section."* A **Contents** card lists the sections by ordinal; a second card renders
>   one. **The renderer is specified, and it is a security decision as much as a rendering one:**
>   *"Rendered by a hand-written subset renderer: **no HTML string is ever produced, so there is
>   nothing to sanitise.** Raw HTML, images and unknown URL schemes are **refused and shown as
>   refusals**, not silently dropped."* That is `INV-nothing-is-dropped-silently` applied to a
>   Markdown renderer, and it is the same renderer the item detail pane uses for an item body — which
>   is what makes §2's CSP argument about semi-trusted corpus text hold in practice.
>   **One conditional this document should carry:** *"The EN/HE switch self-disables when the parity
>   test is red — a mirror that has drifted is worse than none."*
> - **`tut` — Tutorials.** ✅ `tu.v` *"each one titled with a job, not a feature"*. **Six replacing
>   two**, listed as **Tutorial / the job it answers / EN / HE**, and *"every transcript is a
>   generated block, so a tutorial cannot teach a flag that no longer exists without a test going
>   red."* The six jobs are: *I have just installed this* · *the model did the banned thing* · *what
>   governs this file* · *why did that not arrive* · *settle what is open* · *I have a spec, not
>   items*.
>   **The EN/HE columns are drawn honestly and that is deliberate**: five of six Hebrew cells and one
>   English cell read **to write**, and `tu.gap` says why — *"Hebrew is shown as **to write** rather
>   than as a language toggle that would silently fall back to English. The changelog already records
>   that the tutorials have no parity test; this is that gap, drawn."* **Do not ship a toggle that
>   falls back.**

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
> the Claude Code present when this pass was written was **2.1.233**. **Re-verified 2026-08-23 against
> the installed build `2.1.239`** (`VERSION:"2.1.239"`, `GIT_SHA:"9bf8e9521fe06414183309865310e27c9b8db3dd"`,
> `BUILD_TIME:"2026-08-21T04:40:30Z"`) by re-running the string-extraction the plan's external-facts
> table describes — **every field this subsection names is still present and still carries the same
> meaning**; the `context_window` builder is byte-identical to the 2.1.233 reading once the minifier's
> symbol names are normalised. The 2.1.233 binary is **no longer on disk** (only `2.1.237`, `2.1.238`,
> `2.1.239` are), so that reading cannot be re-run — the re-verification above stands on the installed
> build alone. An implementer must **re-check
> against the version they are building on and update the version recorded here**, because the
> alternative is a spec that ages into a false statement without anyone touching it. What this
> repository *can* confirm is the other half: `HookInput`
> (`src/hooks/io.ts` · `export interface HookInput {` · ~3) declares `session_id`, `transcript_path`,
> `cwd`, `hook_event_name`, `source`, `tool_name`, `tool_input`, `agent_id`, `agent_type` and
> `prompt_id`, and nothing resembling a token count.

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

- **[V] mycontext declared no prompt identifier, and now declares one it does not use.** `HookInput`
  (`hooks/io.ts` · `export interface HookInput {` · ~3) declared `session_id`, `transcript_path`,
  `cwd`, `hook_event_name`, `source`, `tool_name`, `tool_input`, `agent_id` and `agent_type`. **Amended
  2026-08-21:** the v2 hooks plan's Task 5 adds `prompt_id` beside them, on a measurement of Claude
  Code 2.1.234. **The half of this bullet that carried the argument is unchanged and was re-checked:
  nothing in `src/` reads or writes a per-turn id**, and §4b's own status-line field list still never
  mentioned one. A declaration is not a use, and the join below still turns on the use.
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

> **CORRECTED 2026-08-20 — the three states have a home and the words are written; one constraint's
> rendering is not.** All three states are drawn in the strip's `#ctx` slot, in both languages, and
> the mockup makes them clickable *"to cycle the three states the spec requires"* — a review
> affordance, not a product control:
>
> | State | What the strip renders |
> |---|---|
> | Known | `6.2k` / `47k` **from project knowledge** — the join, in the sentence §4b argues for |
> | Not yet known | **"context not yet known — no response since the compact"**, as bold text, not a number |
> | Unknown | **"context unknown — status line bridge not installed"**, as quiet text |
>
> Constraint 2 and the *Compatibility* fallback are therefore rendered as **states**, exactly as this
> section requires, and constraint 3's input-only percentage is not contradicted anywhere.
>
> **OPEN QUESTION for the owner, recorded rather than resolved.** Constraint 1 requires *"every
> displayed context number is labelled 'as of last response', with the sample's age."* **The strip
> draws the number without that label**, and the provenance bar — which is where the mockup collects
> qualifications of exactly this kind — does not carry it either. The constraint is an **honesty
> rule about a measurement**, not a styling preference, so it is not the mockup's to repeal and it
> stands. But *where the label goes* is a layout question the mockup does not answer, and inventing a
> place for it would add a field the mockup does not show. Ask. **The plausible answer is a fifth
> provenance-bar pair**, and it is written here as a guess, not as a specification.

## 5. The live watch — resolved, not deferred

The brainstorm considered three mechanisms: hooks writing always, hooks writing only when a sentinel
file exists, or the UI tailing the session ledger. **The owner's answer removed the choice.**

Because decision Q3 has the audit log record mutations and hook actions including injections, the audit
log *is* the stream. The UI tails it. There is one mechanism, not three competing ones, and the ledger's
weakness (it records what was injected, not what was *considered*) is answered by the audit log
recording the hook action itself.

### The record shape, pinned

The earlier version described the injection record as *"scope, not content"*. `docs/ROADMAP.md`'s B7.1
row (`docs/ROADMAP.md` · `the injection's scope, tier and item ids, not its content` · ~183) records
the decision as **"the injection's scope, tier and item ids, not its content"**. An earlier pass cited
two ROADMAP rows for that wording; only B7.1 carries it — the Q3 row
(`docs/ROADMAP.md` · `Audit log scope — mutations only, or injections too?` · ~377) records the same
decision in the short form, *"the injection's scope, not its content"*, which is the wording this
paragraph corrects. The spec dropped two of the three fields, and each is load-bearing:

- **Without item ids the audit view cannot name what was injected.** It could only say *something was*.
- **Without item ids, §4b's numerator has to be re-derived from the items as they are now**, which is
  wrong for anything edited, superseded or retired since the injection happened — and the sentence
  "6.2k came from your project knowledge" would silently drift for exactly the corpus that is being
  maintained most actively.

**Pinned to the shape that shipped** (`AuditRecord`,
`src/core/audit.ts` · `export interface AuditRecord {` · ~326, on `phase-5/quality` — build against
the type, not this prose). Every record carries `protocol`, a UTC `at` timestamp, `kind` and `op`. An injection record adds `sessionId` (absent for `manual`, whose surface has no trustworthy
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
- **`focus` is a fourth record kind** — `focus-set` / `focus-clear`
  (`src/core/audit.ts` · `export const FOCUS_OPS = ['focus-set', 'focus-clear'] as const;` · ~190),
  and the kind list says so in its own words
  (`src/core/audit.ts` · `It is genuinely a fourth thing, so it is a fourth kind.` · ~117) —
  deliberately neither a mutation nor an injection: a focus change touches no item and injects no text,
  but it changes what every later selection injects. An audit view that streamed injections without
  focus changes would show items disappearing from a session with no visible cause, so the Watch stream
  carries focus records too.

**One extension, decided with the owner's assent.** §4b's sentence needs a token count for mycontext's
contribution. Deriving it later from the items as they are now has the same drift problem as the ids
would. So the record carries the **estimated token count computed at injection time** (`estimateTokens`,
`src/core/select.ts` · `export function estimateTokens(` · ~178) — the number as it was when the
injection happened, never re-derived from the present corpus. An earlier version wrote this as a
proposal awaiting the owner's assent, with a fallback re-scoping §4b to item counts if refused;
**the owner has assented**, the extension to the
recorded Q3 shape is a decision, and the fallback branch is dead and deleted.

**The deferral to a branch is also spent — it merged.** This paragraph said the field's name and
coverage *"are being settled by the implementation on the `audit-injection-token-count` branch, and
that branch — not this spec — is where the spelling binds."* It has shipped. The field is
**`tokens?: number`** on `AuditRecord` (`core/audit.ts` · `tokens?: number;` · ~372), and what it counts is
pinned in its own doc comment:

> It is `Selection.tokens` verbatim — the sum of the chars/4 estimates … the selector charged its
> budgets for every admitted full-text block (with its joining separator) and every index line.
> Spilled items and un-budgeted scaffolding … are outside the budgets and outside this number.

**One property of it the UI must respect:** the field is **absent** on records written before it
existed, and *"absence means 'not recorded' — never zero. Zero is a real measurement … a reader that
defaults a missing value to 0 turns 'unknown' into a claim."* Every screen that shows a token number
renders **"not recorded"** for an absent one. §4b's sentence — *"of 47k tokens in use, 6.2k came from
your project knowledge"* — is not printed at all for an injection whose `tokens` is absent.

> **CORRECTED 2026-08-20 — `tokens` has three states, not two, and the third is not a missing
> measurement.** The mockup distinguishes *"a number, `null` meaning the field was never written, and
> **absent because the record is not an injection at all**"*. The rule above collapses the second and
> third, and a reader who applied it would render "not recorded" against a mutation record, which is
> not a gap in the data — a mutation has no token count to record. **The disclosure is per record
> kind first, per field second.**
>
> **And the rendering is pinned.** An injection row draws its cost as a bar against the tier budget;
> a `null` draws a **hatched void** with the sentence *"tokens: not recorded — this record predates
> the field. Not zero."*; a non-injection row draws neither. The provenance bar carries the standing
> qualification once, as *tokens · **not recorded before 1.0.1***, so a screen does not repeat it per
> row. The two record kinds this document pins that most affect the Watch screen are drawn as
> §4's correction describes: **`spilled` is what the ghost lane and the *Selected, then not
> delivered* bar are built from, and a `focus` record is drawn as a rule across the feed rather than
> as a row.**

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

- `test/perf/jit-latency.perf.ts` · `test('the selector itself stays well inside the hook budget on 5000 items', () => {` · ~252
  asserts the **selector** under **10ms** on a 5,000-item corpus. That is `select()` alone,
  in-process, with no I/O.
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

**`rebuild` drops `items` and nothing else.**
`src/core/rebuild.ts` · `store.deleteByLayer(layer);` · ~458 calls `store.deleteByLayer`, which is
`DELETE FROM items WHERE layer = ?`
(`store.ts` · `this.#db.prepare('DELETE FROM items WHERE layer = ?').run(layer);` · ~548). The `ledger`
table (`ledger.ts` · `injected_at TEXT NOT NULL,` · ~53) lives in the same file and **survives a rebuild
untouched.** The half of the claim that is true is the parenthesis: `query`
(`cli/commands/query.ts` · `updated_at is INDEX WRITE TIME, not a Markdown timestamp: every query rebuilds the` · ~47) and `context`
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
- **The documented recovery.** `README.md` · `recreates it from the Markdown. The Markdown is the source of truth;` · ~1269 — *"Delete it and `mycontext rebuild` recreates it from the Markdown."*

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
(`src/core/audit-db.ts` · ``**The record is stored whole, as `jsonb`, and queried into.**`` · ~44,
on `phase-5/quality`): on Node 24.18 (SQLite 3.53.1), `jsonb()`, `->>`, `json_each`, VIRTUAL
generated columns over a jsonb blob and expression indexes over them all work through `node:sqlite`,
and a representative injection record measured 452 bytes as jsonb against 546
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

> **CORRECTED 2026-08-20 — the string parity test now has a third party to it.** As written it
> compares the shipped English table against the shipped Hebrew one. **The mockup is where a key gets
> minted** (§3), so a key present in both shipped tables and absent from the mockup is an **invented
> string** — the pinned instruction's named failure — and the parity test as specified cannot see it.
> The mockup currently carries **326 distinct `data-t` keys**.
>
> **This is stated as a requirement on the test, not as a script, because the mockup is a mockup.**
> It is a single self-contained HTML file with an inline `<style>` and `<script>` that the shipped
> CSP forbids; it is a design artefact, not a module the suite can import. **Whether the third
> comparison is automated — a parser over `data-t` attributes — or is a review step, is an open
> question for the owner.** What is not open: a new user-visible sentence that is not in the mockup
> is a defect, and something has to be able to say so.
>
> **The other limit above is unchanged and is now sharper.** The mockup carries **18 graphical
> views**, and its own history is the argument for the limit being written down rather than implied:
> per the pinned instruction, *"a regeneration dropped six screens, and a later one kept the screens
> and lost the 18 graphical views inside them. Both were caught late."* The rendering is what is
> untested, and the rendering is what has twice gone missing.

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
- **Not a commitment to the three `PROPOSED` screens.** `proc`, `port` and `packs` are in the rail
  with a `PROPOSED` chip because the owner asked for them and because *"the label is the whole
  point"* (mockup header comment). They are decided in other documents and built by no web-UI plan.
  A build that ships one of them without a plan is not ahead of schedule; it is off-spec.

> **CORRECTED 2026-08-20 — theming is not out of scope, and it never said it was.** This document
> said nothing about theming at all, which read as a non-goal and was recorded as a divergence when
> the first mockup shipped a dark palette. It is now a decision: the mockup ships a `#theme` control
> and a full `light-dark()` token set, and the pinned instruction names the light-dark tokens
> alongside the gloss, the logical properties and the type scale as *"decisions, not defaults"*.
> §3's new *visual system* subsection carries them. **What remains out of scope is a theme
> *editor*** — there is one control with the platform's three-way behaviour, and no palette
> customisation anywhere.
>
> **And the "no global search" position is now shared rather than merely asserted.** An earlier
> mockup carried a search box with a ⌘K hint that had no handler; it was recorded as decoration
> implying a capability the product does not have. **The current mockup does not draw it.** The
> header is focus, session, `∅`, language, theme — and nothing else.

## 8. Risks

| Risk | Mitigation |
|---|---|
| The UI becomes the primary surface and the product inverts | Every screen graded against "a terminal cannot do this" in §4, exceptions named; the CLI and slash surfaces stay complete |
| **A UI write silently voids the user's Bash deny rules** | **There are no UI writes.** No `/api` route reaches a mutating function, enforced by a static import-graph test (§6); every write is composed and pasted into a shell, so it stays a command string the deny rules can match |
| **An agent promotes its own proposal over HTTP** | Closed by the same rule. `promoteRevision` stamps `origin: 'human'` (`revision.ts` · ``the change is applied through `updateItem` with `origin: 'human'`,`` · ~763) and would have laundered origin through any endpoint that called it; nothing calls it |
| DNS rebinding / CSRF | Custom-header token, no CORS, `Origin` and `Host` validated, loopback-only bind |
| The token leaks through the browser-opening command line | The spawned URL carries a one-shot 10-second handoff nonce, not the token; the token never touches a process argument list (§3) |
| A forgotten server left running | Idle is defined as no non-stream request for 15 minutes; **an open stream is not activity**; the page heartbeats only while visible; on exit the page says so and does not reconnect (§2) |
| Audit writes slow the hot path | Measured before committing to always-on, against the corrected budget — hit-path p95 ~20.7–22.7ms of 50ms, ~27ms remaining — and the hook appends one JSONL line rather than opening a database (§5) |
| The audit projection answers from stale data without saying so | The projection records its log position; a query behind its log catches up first or reports that it is behind, and a diverged or version-mismatched projection is discarded and rebuilt whole (§5) |
| **The audit view cannot name what was injected** | The record shape is pinned to scope, tier **and item ids** per `docs/ROADMAP.md` · `the injection's scope, tier and item ids, not its content` · ~183, so the view never re-derives from the present corpus (§5) |
| **The injection preview shows a selection Claude never got** | `/api/select` takes every narrowing input `SelectContext` declares, and derives `seen` from the **per-session seen file** via `readSeen(root, ledgerKey(...))` and `seenIds` — never from `Ledger.seen`, which is a replayed projection nothing in the UI updates; a cold-session preview exists and is labelled as a different question (§3) |
| A screen shows a context number that is wrong, stale or invented | Shown only when the bridge is installed, labelled "as of last response" with the sample's age, never interpolated, input-only, with distinct "not yet known" and "unknown" states (§4b) |
| Installing the bridge overwrites a `statusLine` the user already configured | Opt-in, never installed as a side effect; the installer **prints the existing setting and what it would replace it with, and asks, before writing** |
| The relation graph becomes a hairball or acquires a dependency | Ego-graph only: one focus, radius 1–2, deterministic layered layout, 60-node cap with explicit truncation, no simulation (§4) |
| RTL retrofitted into hand-written CSS | Logical CSS properties from the first stylesheet; one string table per language with a key-parity test (§3) |
| Rendering is untested | Stated in the test file rather than implied by a green suite |
| **A screen ships a weaker version of what the mockup draws** — a table where it draws a chart, a number where it draws a distribution | The mockup is the specification (`INSTR-the-mockup-is-the-ui-specification-build-it-exactly-and-ask`); §4's per-screen corrections name each chart, its source and its rule. **This has already happened twice**: one regeneration dropped six screens, a later one kept the screens and lost the 18 graphical views inside them |
| **A screen ships a sentence the mockup does not contain** | Every user-visible string is a `data-t` key in the mockup's table with a Hebrew pair; an invented sentence is an untranslated string, and §6's parity test gains the mockup as a third party to the comparison |
| **This document and the mockup disagree again** | Where they disagree about **what a screen is**, the mockup decides and §0 records the correction; where they disagree about **what the server does**, this document decides. A place the mockup does not answer is an **open question for the owner**, recorded in §4 or §9 and never resolved by the implementer |

## 9. Decided, so no implementer has to guess

The review that produced this pass ranked ten open questions. Five were not open — they were decided
facts that the document had left implicit, which is how an implementer ends up choosing. They are
recorded here as decisions.

1. **What `origin` does a UI write stamp?** **None — there are no UI writes** (§2). The question was the
   symptom; the answer removed it.
2. **Does the review queue promote over HTTP?** **No.** It renders the diff and composes
   `mycontext review promote-revision <id> --yes` for the user's own shell (§2, §4).
3. **Which function answers "does this item govern this path"?** **`matchesScope(item, target, config)`**
   (`select.ts` · `export function matchesScope(item: Item, target: string, config: Config): boolean {` · ~266), filtered by **`isEligible`** (`select.ts` · `export function isEligible(item: Item, config: Config): boolean {` · ~198) and the normative-tier test, which
   **`injection()`** (`cli/commands/injection.ts` · `export function injection(` · ~84) already composes in `select`'s own order.
   **Not `matchesAnyGlob`** — that is a defect `select.ts` documents by name (`select.ts` · ``asks the same function. `query_items` re-derived it as a bare`` · ~244), recording that the bare form *"kept hiding unscoped items from a path query long after they had become injectable on that path"* (§3).
4. **Where does the audit log live, and what is in a record?** **JSONL is the source of truth; SQLite is
   a disposable projection that records its position in the log.** An injection record carries the
   delivered set as (id, tier) pairs, **the spilled set as (id, tier, reason)**, timestamp, `session_id`
   and the hook and path that triggered it — never item content — plus, decided with the owner's assent,
   the estimated token count computed at injection time — shipped as **`tokens?: number`**, whose
   **absence means "not recorded", never zero**. Mutations and focus changes are their
   own record kinds; the full shape is `AuditRecord` (`core/audit.ts` · `export interface AuditRecord {` · ~326, running to `core/audit.ts` · `note?: string;` · ~383) (§5).
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

**The sixth pass adds five more**, from `docs/design/web-ui-mockup.html` and the pinned instruction.
Same rule: recorded here so no implementer chooses.

11. **Which document decides the UI?** **The mockup.** `docs/design/web-ui-mockup.html` is the
    specification for what a screen is: which screens exist, what is on each, where a control lives,
    what a chart plots, what an empty state looks like, and the words. **This document decides what
    the server does** — the mutator-free rule, the SQL refusal, the loopback/token/CSP/idle rules,
    `/api/select`'s inputs, where `seen` comes from, `.git` as files, the context number's honesty
    constraints, and *absence means "not recorded", never zero*. Neither overrules the other inside
    the other's half, and §0 states the boundary once (§0, §2, §4).
12. **How many screens are there, and how are they grouped?** **21**, in **four rail groups by
    tense** — Injection, Evidence, Change, Read. The eight headings in §4 are grading buckets and are
    **not** the rail. Three of the 21 are `PROPOSED`, carry a chip in place of a verdict, and are
    built by no web-UI plan (§4).
13. **Where do the qualifications every screen owes get rendered?** **The provenance bar**, once —
    *preview of parent thread*, *focus off — a different question*, *tokens not recorded before
    1.0.1*, *projection fresh* — not per screen. And **every item id is a link to the item detail
    pane**, which carries the twelve-week delivery sparkline that would otherwise want a screen of
    its own (§4).
14. **What renders a write?** **A composed command, an `armed` state chip saying "copied, not yet
    observed landing", and a stated receipt** — an audit record with the matching `op` for a command,
    a re-read of `config.json` for the config patch. Where an argument carries shell substitution,
    **Copy is blocked** and the argument chips are what make that visible. §2's rule is unchanged;
    this is its rendering (§4).
15. **What is the visual system?** **Four decisions, not defaults:** the gloss, logical properties,
    `light-dark()` tokens whose contrast values are measured, and the type scale. Data-driven sizes go
    through the CSSOM because the shipped `style-src 'self'` blocks the style attribute. Charts mirror
    by projection (`X(u,W)` / `ANC()`), never by transform. Corpus text sits in a `well` inside
    `<bdi>`; the product's own words never do (§3).

### Open questions the sixth pass recorded rather than resolved

**These are for the owner.** The pinned instruction is explicit that when the mockup does not answer,
or answers something the code cannot do, the reader **stops and asks** — *"Do not resolve it yourself
and do not pick the reading that is easiest to build."* Each of these is a place this document asserts
something the mockup neither draws nor contradicts, so neither reading is safe.

| # | The question | Where |
|---|---|---|
| A | Configure requires `agentEdits`-per-category and `enabled`/`tier` previews. **The mockup draws neither.** Cut, or not drawn? | §4, *Configure* |
| B | Ask is specified over the corpus **and** the audit history. **The mockup's fields, values and result columns are audit-only.** Cut, or one of two field sets drawn? | §4, *Ask* |
| C | *"Read commands execute in the UI."* **The Composer draws no run control**, and its only Copy is blocked. Did in-UI execution go, or is it undrawn? | §4, *Work* |
| D | Constraint 1 requires the context number to be labelled *"as of last response"* with the sample's age. **Neither the strip nor the provenance bar draws that label.** Where does it go? | §4b |
| E | The mockup draws one exit banner. **Does the rejected-token case reuse `ex.msg`, or does it want a string of its own?** A second sentence invented here is an untranslated string. | §2 |
| F | §6's parity test now needs the mockup as a third party. **Automated parse of `data-t`, or a review step?** The mockup is a design artefact the suite cannot import. | §6 |

**One thing this pass could not fix and is not silent about.** `docs/design/web-ui-mockup.md` — the
mockup's companion — still describes the **first** mockup: it says the artefact opens on Status, is
English-only with physical CSS, has no focus control, shows three audit record kinds, carries a
decorative search box, and that *"where it and the spec disagree, the spec wins."* Every one of those
is false of the current file, and the last one is now **inverted** by the pinned instruction. The same
sentence appears in the HTML's own header comment. **Neither is this document's to rewrite**, and both
should be corrected by whoever owns the mockup, because a companion that tells a reader to prefer the
spec is the one artefact that can undo this pass.
