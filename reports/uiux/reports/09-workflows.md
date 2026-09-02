# 09 — Workflows: what makes this worth opening every day

**Panel role:** developer-workflow researcher. The owner's brief is *"very usable, valuable"*.
Usability belongs to panels 02–04. This paper is the second word.

**Evidence base.** `README.md` (§1–§9), `docs/TUTORIAL.md`, `docs/TUTORIAL-ADVANCED.md`,
`docs/superpowers/specs/2026-08-16-web-ui-design.md` (§1's test, §4's screen grading, §5's pinned
record shape), and the repository's own dogfooded corpus — 43 items under `.my_context/items/**`,
99 records in `.my_context/.audit/audit.jsonl`, 33 per-session seen files under `.my_context/state/`.
Every claim about recorded data below is cited to a source file, because §1's test cannot be applied
to a capability whose data does not exist. Type shapes were read out of `src/` directly.

**Three corrections to the brief's own framing, made before building on it.**

- **"The ledger with per-session injection times"** — the ledger records injection **timestamps**, not
  **durations**. Nothing in `src/` persists a wall-clock duration, latency or percentile; every p95 in
  the codebase is a comment citing an offline perf test. No capability below may promise a performance
  chart, because there is no performance data.
- **"The audit log with spill reasons"** — there are **exactly two** reason strings, and both are
  budget: `budget exceeded (used+cost > budget estimated tokens)` (`select.ts:292-295`) and
  `index budget exceeded (…)` (`select.ts:372-375`). A "spill reasons" breakdown is a one-category pie
  chart. What is rich is the *arithmetic inside the string* and the *onset over time*, not the variety.
- **The restored tier's `injected_at` is not a clock reading.** `Ledger.recordRestored`
  (`ledger.ts:166`) stores the snapshot's `capturedAt` as an **identity marker**, compared for
  equality. Any time-series that plots ledger rows on a time axis must exclude or specially mark
  `tier: 'restored'`, or it will draw restores at the wrong instant. This is a real trap for
  capabilities 2 and 3 and it is written down here so no implementer finds it the expensive way.

**Where I differ from panel 02.** The IA paper already names the *why-not panel* — a live predicate
chain over `injection()` — as the highest-value unnamed screen, and it is right. I do not re-propose
it. Capability 1 below is its **past tense**, which is a different question with a different data
source and, I will argue, the more valuable of the two. Where a proposal overlaps 02, I say so.

---

## Jobs to be done, ranked

Ranked by frequency × pain. "Frequency" is how often a working developer hits it; "pain" is what it
costs when the tool does not answer.

### 1. "The model just did the thing we banned. Did my rule reach that session, or not?"

**Frequency: every time the assistant breaks a known rule.** This is the event the product exists to
prevent, so every occurrence is a referendum on it. **Pain: total** — the user cannot tell a product
defect from their own authoring defect, and the two have opposite remedies. Guess wrong and you either
rewrite a rule that was never delivered, or hunt a delivery bug that does not exist.

There are at least **nine** distinct causes, and today no surface enumerates them:

| Cause | Where the fact lives |
|---|---|
| The item is a draft / superseded / deprecated | `isEligible` (`src/core/select.ts:81`) |
| Its category is rationale, so it is never injected uninvited | the normative-tier test in `select` |
| Its category is disabled or misspelled in `config.json` | doctor `unknown_category` (`src/doctor/checks.ts:659`) |
| Its scope glob missed the path | `matchesScope` (`select.ts:191`) |
| Its scope glob matches **no file in the repo at all** | doctor `dead_scope` (`checks.ts:384`) |
| It has no scope and its category is `scopePolicy: "inert"` | doctor `scope_policy_inert` (`checks.ts:603`) |
| A focus hid it | `FocusReport.hidden` (`src/core/focus.ts:237`) |
| It was already delivered this session | the per-session seen file, `readSeen` |
| It spilled for budget | `AuditRecord.spilled[].reason` (`src/core/audit.ts:203`) |

And three more that only the audit record knows, all invisible to any live query:
the JIT hook **served from the Markdown fallback** (`served from markdown fallback: <reason>`), the
**seen file was unreadable so dedupe was skipped**, or the JIT hook **trusted a stale index** — README
§8, *"A just-in-time injection trusts any index it can read"*, a wrong-but-plausible answer that
nothing in the injected block or the audit record marks.

Today this job is a maze of six commands and a mental model of `select()`. It is job #1 by a distance.

### 2. "I am about to change this file. What governs it, and what will Claude actually be handed?"

**Frequency: several times a day** — it is the precondition of every task. **Pain: moderate but
compounding.** `mycontext search --path X` answers a *neighbouring* question: it lists items, not the
delivered set, and does not model `seen`, `focus`, tiers or the budget. TUTORIAL-ADVANCED §3 shows the
gap: the preview and the injection *must* agree, and only `select()` with all five `SelectContext`
inputs makes them agree. This is the spec's landing screen and it is correctly placed.

### 3. "Walk the queue: what has the agent proposed that I have not settled?"

**Frequency: weekly** (TUTORIAL-ADVANCED §14 says exactly that). **Pain: high and delayed.** The
tutorial names this as *the failure mode this design invites* — "Drafts that pile up unread… Claude
keeps proposing, nothing governs, and you get the cost of the tool with none of its benefit."

And the queue is not one queue. It is **four** — drafts, pending revisions, staged rule candidates,
and unfinished ingest sessions — each in its own store, each with its own settling command, and only
the first two visible to `mycontext review`. Pending revisions are also the hardest object in the
product: a per-field three-way diff (`changes` proposed, `base` at staging time, `current` now, plus
`changedSince` and a per-field `stale` flag, `src/core/revision.ts:151-186`). See capability 17.

### 4. "I just learned something. Capture it without filing a duplicate."

**Frequency: a few times a week.** **Pain: permanent when it goes wrong.** `type` is fixed at creation;
there is no retype. A duplicate filed under the wrong category can only be superseded, never merged —
and `observations` "cannot be edited by anyone, at any surface, by any origin" (README §8), so a
mis-captured observation means superseding the whole item. Add the three capture paths that all end
here — `add`, `ingest`, `lesson` → `lesson-accept` — and the pre-flight duplicate check is worth more
than any after-the-fact report. Spec §4 has it (*Overlap detection at capture*); it is under-rated
there, and it belongs in the top five.

### 5. "Is what I am injecting still true?"

**Frequency: weekly-to-monthly, and spiking after every refactor.** **Pain: severe and silent** — a
constraint that quietly stopped activating "is indistinguishable from one that was never written"
(`INV-posix-normalized-paths`, this repo's own corpus). `doctor` emits ~19 finding codes across three
levels — `index_stale`, `orphan_relation`, `source_drift`, `source_anchor_missing`, `source_missing`,
`dead_scope`, `not_writable`, `index_not_ignored`, `session_id_mismatch`, `unknown_category`,
`scope_policy_inert`, `scope_policy_required`, `audit_log_size`, `corpus_size_fallback_ceiling`,
`check_failed` and more — and **collapses all of it into one exit code**
(`src/cli/commands/doctor.ts:33`).

### 6. "What is this costing me, and what is it pushing out?"

**Frequency: rarely thought about, constantly paid.** **Pain: invisible, which is why it is
under-ranked by users and should not be under-ranked by us.** The pinned tier is charged to *every
session forever*. This repo's own first session-start record delivered 7 pinned + 18 index items for
`"tokens":1542` — a fixed toll on every session on this project, in perpetuity, that nobody has ever
seen as a number in a UI. `LESSON-alphabetical-id-became-the-priority` is the recorded instance of this
job failing: 16 pinned hard items blew the budget, and because severity and layer tied for everything,
**alphabetical id decided what survived** — dropping the open question that blocked all of Plan 2
because "O" sorts after "I".

### 7. "Somebody new needs to know the rules here."

**Frequency: per hire, per contractor, per context switch back to a repo you left three months ago** —
and the last one is far more frequent than the first. **Pain: moderate.** The corpus is committed, so
it *travels*; what does not travel is any sense of which items matter, which are load-bearing, and what
a session actually gets. Spec §4 folds this into the coverage map's printable rendering, which is the
right call.

### 8. "What has stopped mattering?"

**Frequency: quarterly.** **Pain: low per occurrence, high in aggregate** — a corpus that only grows
eventually spends its whole budget on history. `decay` exists and is unusually honest about its own
limits ("the ledger records injection, not reading or reliance"). Its weakness is that the answer is a
**shape over time** presented as a table.

### 9. "What did the agent decide on its own?"

**Frequency: continuous, noticed rarely.** **Pain: high when it bites.** Three things an agent does
with no human act: it creates *rationale* items **active** (TUTORIAL-ADVANCED §12), it may supersede a
validated rationale item, and it can **set a focus** through `focus_context`. The audit module's own
doc comment states the risk in as many words: *"An agent that narrows its own context and then reports
on 'the rules for this project' is describing a corpus it chose"* (`src/core/audit.ts:96-104`).

### 10. "Change a config key without finding out by living with it."

**Frequency: a handful of times per project, clustered at the start.** **Pain: acute at that moment.**
There is no `mycontext config`; the deny hook says the file is the user's to edit. Spec §4's *Configure*
screen is the strongest §1-passing screen in the design and I have two things to add. First its rank:
it is a **setup-time** job, and setup-time jobs do not bring anyone back tomorrow. Second, the screen
should show the **resolved** config, not the file — because resolution is not obvious in at least three
places: a category absent from `categories` resolves `scopePolicy` to `'global'` but `agentEdits`
**fails closed to `'review'`** (`config.ts:138,160`); `agentEdits` otherwise defaults by tier
(normative → `review`, rationale → `allow`, `:106`); and the shipped `DEFAULT_BUDGETS` disagree with
what the advanced tutorial says they are.

**Below the line, deliberately:** browsing the corpus, reading an item, searching. Real, frequent, and
a terminal does them well. They are the *substrate* of the UI, not a reason to open it.

---

## Moments of truth

A "moment of truth" is a specific minute in a specific week when a developer either reaches for this
tool or gives up on it. Named situations, and what the UI shows at each.

### A. The review that went wrong

*Tuesday. A PR review catches `logger.info(card.number)` in code the model wrote last Thursday. The
constraint forbidding it has existed since March.*

The user's question is **past tense**, and every live screen answers a present-tense question. The
governing set today is not the governing set on Thursday: items have been edited, a category may have
been retiered, a focus may have been set and cleared, and the corpus has grown so what fits the budget
has changed.

**What the UI shows:** the recorded injection records for that session, in `at` order, filtered to the
path — `injected` (ids + tiers), `spilled` (ids + tiers + `select`'s own reason string), `tokens` as
recorded, `note`, and the `focus` records interleaved. Then, and only then, the verdict: *the rule was
delivered and ignored* (a prompt-engineering problem, and the UI must say so rather than let the hunt
continue), *the rule spilled at 14:03 with this reason*, or *the rule was never selected, and here is
the gate it failed*. This is capability 1.

### B. Onboarding a teammate

*A new engineer clones the repo. `.my_context/` is committed; `.audit/`, `.revisions/`, `state/` and
`.index.db` are not.*

The knowledge travels. **Every scrap of evidence about how it is used stays behind.** The new engineer
sees 43 Markdown files with no signal about which of them will actually reach their sessions.

**What the UI shows:** the coverage map, printed — plus one sentence nobody has proposed: *"7 items are
pinned. They will be in every session you ever start on this repo, costing ~1,542 estimated tokens
before you type anything. Here they are."* That is the true first-contact fact and it is computable
from the committed corpus alone, with no local history at all — which is exactly what makes it work on
a fresh clone.

### C. A rule that stopped firing

*Someone renamed `src/billing/` to `src/payments/` six weeks ago. `CONST-card-numbers-never-reach-the-logs`
is `active`, `severity: hard`, correctly scoped to `src/billing/**`, and has governed nothing since.*

Nothing errors. Nothing warns in a session. `doctor` will say `dead_scope` **when someone runs it**.

**What the UI shows:** the item's injection series from the ledger (`injected_at` per
`(session_id, item_id, tier)`, `src/core/ledger.ts:30-36`) going flat on a date, beside the
`dead_scope` finding, beside the glob and the file tree it now matches nothing in. Three facts from
three subsystems, one picture. The *date the line goes flat* is the change that broke it, and it is not
in any table.

### D. A budget that started spilling

*The corpus crossed some size last month. Since then, one item silently stops arriving on some paths.*

`INV-nothing-is-dropped-silently` guarantees the spill is **recorded** — `spilled` with
`reason: "budget exceeded (6104 > 6000 estimated tokens)"`, the arithmetic inline. It does not
guarantee anyone **reads** it, and nothing anywhere tells you the *first* time an item spilled.
(Note the drift worth flagging to the docs panel: `DEFAULT_BUDGETS` is
`{pinned: 6000, jit: 6000, restored: 8000, index: 1200}` — `src/core/config.ts:51` — while
TUTORIAL-ADVANCED §4 says the pinned budget is 8,000. One of the two is stale, and a Configure screen
showing the **effective** resolved config is how a user stops having to know which.)

**What the UI shows:** the spill onset chart (capability 2) — per item, the day it crossed from
`injected` to `spilled`, and what was admitted ahead of it. And the tie-break warning that
`LESSON-alphabetical-id-became-the-priority` had to be learned the hard way: *"11 of your 16 pinned
items are `severity: hard` and share a layer. Ties are broken by id. Alphabetical order is currently
deciding what Claude sees."*

### E. An agent captured something wrong

*Claude filed a `decision` last week. It landed `active`, because rationale items do. It is subtly
wrong, and it has been in the index of every session since.*

**What the UI shows:** the agent-authority view (capability 7) — everything with `origin: 'agent'` that
took effect with no human act, plus every `focus-set` record with its axes in the `note`, plus every
`supersede` an agent performed. Not a security dashboard; a *"what happened while I was not looking"*
list, which is the honest framing given that §2 of the spec establishes the boundary is not a sandbox.

### F. The compaction that ate the thing you needed

*A long session compacts. Work resumes. The model no longer knows the invariant it was working to.*

This is the product's **original motivating problem** (`REQ-plan-2-precision-injection`:
*"Surviving compaction was the original motivating problem"*). `PreCompact` writes a manifest of every
id the session touched; `SessionStart(source: compact)` re-applies **current** policy, and in
TUTORIAL-ADVANCED's own worked example five ids went in and **one** came back.

**What the UI shows:** the survival diff (capability 4). Five in, one out, and the reason for each of
the four: draft, rationale, budget. Nothing today shows this at all.

### G. The first twenty minutes

*A fresh `mycontext init`. Zero items.*

Spec §4 already flags this: every directory is a gap and the map renders as a wall of warnings for a
completely normal state. The moment of truth here is not a screen, it is a *number that starts moving*
— capability 14.

### H. The Monday after a week away

*You return to a repo. Six commits landed. Two touched `.my_context/items/`.*

**What the UI shows:** what changed in the governing set, which is capability 10 — and the one place
the mutator-free, dependency-free constraints bite hardest, so it is proposed with its limits stated.

---

## What a terminal cannot do

§1's test, applied to concrete losses. Each entry names the information a table or a log line destroys.

**1. Coverage is two-dimensional; a table has one axis.** Items × paths. `mycontext list` picks the
item axis; `mycontext search --path X` picks the path axis; the *crossing* — which regions of the tree
are governed by what — has no tabular form. And its most valuable cell is empty: **you cannot list what
is absent from a listing.** A directory nothing governs produces no row anywhere. Spec §4's coverage
map and gaps view are correct and this is why.

**2. Spill causality is a join across time; a spill record is one moment.** `spilled[].reason` tells
you *"budget exceeded (8123 > 8000)"* on one event. It cannot tell you *when this item started losing*,
*what is now admitted ahead of it*, or *whether it is one item's growth or the corpus's*. Those are
comparisons across hundreds of records. `audit --items --role spilled` gives a count and a `last` — the
two summary statistics that specifically hide onset.

**3. A pending revision is a three-way, per-field diff.** `PendingRevision` carries `changes`
(proposed), `base` (the item at staging time), `current` (the item now), `changedSince` (which of this
revision's own fields moved underneath it) and `stale`. That is **three texts per field**, and
staleness is per field, so a title proposal can be promotable while the body proposal beside it is
refused. A terminal prints the three texts sequentially and the reader must align them by eye. Spec §4
identifies this as the clearest instance of "diff in the UI, approval in the shell", and it is right.

**4. A budget is a continuous variable and a terminal has no continuous input.** Every trial is
edit-JSON → rerun → read. The 1.0 default-budget change "was decided by measurement that this screen
would have made a five-second exercise" (spec §4). Direct manipulation is not a nicety here; the
question *"how much budget do I need for nothing to spill"* is a search, and a search with a 30-second
loop is a search nobody runs.

**5. Decay is a time series presented as a last-seen column.** The ledger keys
`(session_id, item_id, tier)` with `injected_at` **as a value, not part of the key** — so repeat
injections are recorded and the series is real. In a `last` column, *"injected 40 times in July and
zero since August 3rd"* and *"never injected"* are the same cell: blank-ish and old. One is an
emergency; the other is a new item. A sparkline separates them at a glance.

**6. Dangling relations after a supersede are a graph fact.** `FocusReport.dangling` is a list of
`DanglingEdge` — load-bearing relations with exactly one end hidden. `DEC-focus-discloses-and-allows`
defines eight load-bearing relation types against eight referential ones, and the whole decision turns
on connectivity: *"in a well-related corpus almost everything is reachable from almost everything."*
Reachability is the thing lists cannot show.

**7. The context-provenance sentence needs two sources at once.** *"Of 47k tokens in use, 6.2k came
from your project knowledge."* The status line knows the total and nothing about provenance; the audit
log knows mycontext's contribution (`tokens`, frozen at injection time) and nothing about the total.
**Nothing in the system can produce that sentence** without joining them on `session_id` — spec §4b,
and the strongest single instance of §1's test in the whole design.

**8. A counterfactual is a side-by-side.** *With focus / without focus.* *This budget / that budget.*
*This session's `seen` / a cold session.* Every one is two selections compared, and a terminal renders
one selection at a time with prose in between. `select()` is pure — `INV-select-is-pure`: "no I/O, no
filesystem, no clock" — so running it twice and diffing costs nothing. Purity is what makes
counterfactuals free, and no CLI surface exploits it.

**9. `doctor`'s structure is destroyed at the moment it reports.** ~19 codes × 3 levels × N items,
collapsed to one exit code. Grouping by `code` and preserving level as a visual channel restores
information that already exists and is thrown away.

**10. Provenance is a property of the whole corpus, not of any row.** `origin` ∈ `human | agent |
ingest` on every item and every mutation record. As a column it is noise; as a colour across the
coverage map it answers *"how much of what governs this project did a person actually decide?"* — which
is the trust question the entire §7 boundary exists to serve, and which no listing poses.

**11. Interleaving four record kinds is a layout problem.** `mutation | injection | hook | focus`
(`src/core/audit.ts:75`) each want different columns. Flattened into one table they share a lowest
common denominator; laid out as a timeline with four visual treatments they stay legible. This is why
the `focus` kind exists as a fourth kind at all — its doc comment says filing it under `mutation` or
`injection` would each make a question have a wrong answer.

---

## Proposed capabilities

Numbered. Each: **what** · **the data that supports it** · **why it matters** · **effort**.
Effort is S (a screen over existing reads), M (a real projection or new join), L (new mechanism).

### 1. Retrospective miss autopsy — "why didn't it fire *then*"

**What.** Given an item id and either a session or a timestamp, reconstruct the delivery decision **as
it was recorded**, not as it would be re-derived now. Three outcomes, each rendered differently:
*delivered* (the injection record names it, with its tier — so the failure is the prompt, not the
tool), *spilled* (the record names it in `spilled` with `select`'s own reason string), or *absent*.
For *absent*, fall through to the live predicate chain — but flag every gate whose **input has changed
since**: the item's status, the category's config, the scope glob, the focus. And add the five gates
the live chain structurally cannot see, all recorded in `note`: `served from markdown fallback: …`,
`seen file unreadable; injected without dedupe`, `N item file(s) dropped by the fallback (first: …)`,
`subagent <agent_id> (<agent_type>)`, and `focus hid N on this path, M load-bearing relation(s)
dangling`.

**Data.** `AuditRecord` with `kind: 'injection'`, `op: 'jit' | 'session-start' | 'compact-restore'`,
carrying `sessionId`, `hook`, `path`, `injected[]`, `spilled[]{id,tier,reason}`, `tokens`, `note`
(`src/core/audit.ts:155-207`). The five note strings are constructed in
`src/hooks/pre-tool-use.ts:252-272`. The `audit_item` side table already indexes one row per
(record, item) mention **including spills**, so "everything that happened to this item" is an indexed
lookup (spec §5).

**Why it matters.** This is job #1, and it is the half of it that no live screen can answer. Panel 02's
why-not panel answers *"why doesn't it fire now"*; a code review is always about the past. The two
together are the diagnostic product. Alone, the live panel will confidently explain a present-tense
state to someone asking about last Thursday.

**Effort: M.**

### 2. Spill onset — the day it stopped fitting

**What.** Per item, a strip showing every injection event it *could* have been part of, coloured
delivered / spilled / not-selected, over time. The **first** spill is marked with its reason string and
the set admitted ahead of it. A corpus-level view ranks items by "days since last delivered, given it
used to be delivered daily".

**Data.** `spilled[]` on injection records with `reason` verbatim; `audit_item`'s `spilled` role; the
ledger's `injected_at` per `(session_id, item_id, tier)` (`src/core/ledger.ts:30-36`). The reason
strings are generated at `select.ts:294` and `:374` and carry the arithmetic —
`budget exceeded (${used + cost} > ${budget} estimated tokens)`.

**Why it matters.** `INV-nothing-is-dropped-silently` is satisfied at the *record* level and unsatisfied
at the *human* level: nothing tells you a spill has become chronic. And the recorded failure —
alphabetical id silently becoming the priority — is precisely a chronic spill nobody saw until the
disclosure was read by hand.

**Effort: M.**

### 3. The rent roll — what each item costs, per week

**What.** Attribute recorded token spend to items. `tokens` is per record; `injected[]` gives ids and
tiers; `estimateTokens(body)` gives each item's own cost. Render: *this pinned item costs ~430 tokens ×
34 session starts this month = ~14.6k tokens, and has never appeared in a spill or a decay report* —
i.e. it is pure rent. Rank the corpus by rent. Render **"not recorded"**, never zero, wherever `tokens`
is absent, per the field's own doc comment.

**Data.** `AuditRecord.tokens` (`audit.ts:201`, absence means not-recorded), `injected[]` with tiers,
`estimateTokens` = `ceil(chars/4)` (`select.ts:106`) and `itemCost` (`:119`, which adds the block
separator), `always` on the item, `INJECTION_OPS` counts per session. **Two honesty rules bind here:**
exclude `tier: 'snapshot'` records, which deliver nothing (`pre-compact.ts:124`), and exclude or mark
`tier: 'restored'` ledger rows, whose `injected_at` is an identity marker rather than a time
(`ledger.ts:166`).

**Why it matters.** The tutorial's advice — *"Pin at most one or two items… Pinned text is paid for in
every session forever"* — is unenforceable advice because the cost is invisible. This turns a habit
into a number. It is also the only proposal here that makes the corpus *shrink*, and a knowledge base
that never shrinks eventually spends its whole budget on its own history.

**Effort: M.**

### 4. Compaction survival report

**What.** For each compaction: the PreCompact manifest (every id the session touched) against the
`compact-restore` injection (what actually came back), with a reason per casualty — draft, rationale
tier, budget spill, focus, category disabled. Plus the rate over time: *"across 12 compactions this
month, 64% of touched items returned."*

**Data — and this is the find that makes it a one-query screen.** The PreCompact manifest **is already
an audit record**: `src/hooks/pre-compact.ts:83,119` writes `op: 'pre-compact'` with the captured ids
in `injected[]` at the pseudo-tier **`'snapshot'`** — a tier that delivers nothing and that
`LEDGER_TIERS` (`audit.ts:562`) deliberately filters back out on replay, precisely so it never pollutes
usage statistics. `op: 'compact-restore'` carries what actually returned. **Both records share
`sessionId`, both are already in the `audit_item` side table keyed by `(seq, item_id, role)`, so the
survival diff is a self-join the projection already indexes.** No new mechanism at all. The on-disk
manifest (`Snapshot { sessionId, capturedAt, itemIds }` at `state/<session>.restore.json`,
`ledger.ts:329-333`) is the corroborating copy.

**Why it matters.** Surviving compaction is the founding requirement, and it is the one behaviour a
user can neither observe nor verify — compaction happens without ceremony and the loss is silent by
construction. This makes the product's central promise **measurable** for the first time. It also
makes visible the property TUTORIAL-ADVANCED calls "the useful part": that the policy in force when
context is rebuilt wins, so a draft you rejected between the two events correctly does not come back.

**Effort: M.**

### 5. Nudge conversion — is `watchedDocs` earning its keep?

**What.** Every capture nudge that fired, on which document, and whether a `create` followed within N
minutes. Presented as a funnel per glob: *`docs/**/*.md` fired 47 nudges this month and produced 2
items.* Composes the `config.json` diff to narrow or drop a glob that is pure noise.

**Data.** `op: 'post-tool-use'`, `kind: 'hook'`, with `path` and
`note: "<tool> on a watched document — capture nudge emitted"` — and the comment above it says the
record is written **only when the nudge actually fires** (`src/hooks/post-tool-use.ts:59-75`). Pair
against `MUTATION_OPS` `create` records by `at`.

**Why it matters.** `watchedDocs` is the one configuration key whose *value* is unknowable without
measurement: too broad and the model is nagged constantly (and learns to ignore it), too narrow and it
never fires. Nobody has proposed measuring it, and it is a two-query screen. It is also the only
capability here that improves the *model's* experience rather than the human's.

**Effort: S.**

### 6. The deny wall — what the agent keeps trying to do and cannot

**What.** Every `op: 'deny'` record, grouped by target path and tool. *"37 denied writes to
`.my_context/items/` this month; 11 to `config.json`."*

**Data.** `HOOK_OPS` includes `deny`; the record carries `path` and
`note: "<tool> refused"` (`src/hooks/pre-tool-use.ts:345-349`).

**Why it matters.** A repeated deny is a **route that does not exist**. Eleven denied writes to
`config.json` means the agent has been asked to change configuration eleven times and there is no
supported path — which is precisely README §8's *"Configuration changes… are the user's to make"* seen
from the other side. Repeated denies on `items/` mean the model has not learned the MCP surface, which
is a skill/prompt problem the user can fix. This is a **product feedback channel that already exists
and nobody reads**. It is also the cheapest screen in this paper.

**Effort: S.**

### 7. Agent authority — what took effect with no human act

**What.** One filtered timeline: every mutation with `origin: 'agent'` whose result was **active**
(i.e. rationale-tier creations, per TUTORIAL-ADVANCED §12's table), every `supersede` an agent
performed, and every `focus-set` / `focus-clear` with its axes — interleaved with the injection records
so the narrowing is visible taking effect on the very next injection.

**Data.** `origin` on mutation records; `AuditKind` includes `'focus'` as a fourth kind precisely so
this question has a right answer (`audit.ts:75, 96-108`); `FOCUS_OPS = ['focus-set','focus-clear']`
with the axes carried as `note`.

**Why it matters.** The spec's §2 is emphatic that the boundary is a strong default, not a sandbox.
A default that cannot be audited after the fact is weaker than it reads. The focus half is the part
nobody has proposed: a focus change *"changes what every later selection injects"* while touching no
item, and an injection timeline without focus records shows items disappearing for no visible cause —
spec §5 says exactly this about the Watch stream, and this capability is that argument applied to
review rather than to live watching.

**Effort: S–M.**

### 8. Degradation counter — is the plugin actually working?

**What.** A weekly count of every recorded moment the product silently did less than it promises:
markdown-fallback serves, unreadable seen files, item files dropped by the fallback, `index_stale`
findings, and — separately, because it is the one that cannot be counted — a standing note that a hook
which fails to write its audit record does not tell you.

**Data.** The four `note` strings in `src/hooks/pre-tool-use.ts:252-272`; doctor's `index_stale`
(`checks.ts:147`), `index_unreadable` (`:133`), `not_writable` (`:473`), `check_failed` (`:771`).

**Why it matters.** `INV-hooks-fail-open` is correct and its cost is that failure is invisible by
design: *"an injection whose audit record could not be written still injects, silently"* (README). The
degradation counter is the empirical check on the invariant — the difference between "we fail open" as
a principle and as a measured rate. No terminal command aggregates these; they are free-text notes on
individual records.

**Effort: S.**

### 9. Scope authoring assistant — the reverse glob tester

**What.** Spec §4's palette has a live glob tester (glob → files). Add the **inverse**: select a
directory or a set of files in the coverage map and get *candidate globs ranked by precision* — how
many of the intended files each covers and how many extra it pulls in — plus which existing items
already claim each glob, and a `dead_scope` prediction before the item is written.

**Data.** `matchesAnyGlob`, `matchesScope` (`select.ts:191`), the file walk `doctor` already performs
for `checkDeadScopes` (`checks.ts:373-385`), `scopePolicyFor` for the empty-scope meaning. The walk is
**already bounded** and the UI must reuse the bound rather than re-walk: `SKIP_DIRS` (`checks.ts:28`),
`SCOPE_SKIP_DIRS` (`:42`) and `FILE_LIMIT = 20_000` (`:44`).

**Why it matters.** *"Scope everything you can"* is the tutorial's habit #1, `status` nags about it by
name, and the tutorial concedes the reason it fails: *"nobody goes back to add scopes."* The reason
nobody does is that authoring a glob correctly requires knowing the file tree, and the feedback loop is
a `doctor` run. This closes the loop to zero, at the exact moment the item is being written.
Note the caution from the expert review addendum §2.6: the file walk must be bounded, or a real
repository's tree will hang the screen.

**Effort: M.**

### 10. Governing-set diff across history — with its limit stated

**What.** *"What changed in the rules since I last pulled."* Two honest tiers:

- **Tier A (local, certain):** rebuild the governing set at any past instant from the mutation half of
  the audit log — `create`, `update` (with `fields`), `promote`, `accept`, `supersede`, `refresh`,
  `link`, `unlink`, each with `origin`, `itemId` and `at`. This answers *"what changed on this machine"*
  exactly, with no git at all.
- **Tier B (shared, partial):** `.my_context/items/**` is committed Markdown, and the spec already
  commits to reading `.git` **as files** for the status strip. `node:zlib` is a Node builtin, so
  inflating a **loose** commit/tree/blob object adds no dependency and no build step. That is enough to
  diff the corpus against `origin/main` for objects still loose. **Packed objects are the limit** — a
  packfile reader with delta resolution is a lot of code and is where this stops. So the feature reads
  what it can and renders *"packed; cannot read"* for the rest, in this project's house style, rather
  than guessing.

**Data.** `MUTATION_OPS` with `fields[]` (`audit.ts:82-86, 166`); committed item files; `.git/HEAD`,
`.git/refs/**`, `packed-refs` (already in scope per spec §4's status strip).

**Why it matters.** The corpus is shared and the *evidence about it* is not — see Team and history
below. Tier A is the only cross-time capability available today and it is free. Tier B is where the
team story actually lives, and it deserves an explicit decision rather than silent omission: without
it, "what changed in the rules" is answerable only for the person who made the changes.

**Effort: A = S. B = L, and it needs an owner decision.**

### 11. Standing overlap report — duplicates that are already filed

**What.** Spec §4 catches overlap **at capture**. Add the standing report over the existing corpus:
items sharing scope globs *and* tags, with body similarity, ranked. Each row composes the
`mycontext supersede <id> --by <id>` that resolves it.

**Data.** `scope[]`, `tags[]`, body text and `checksum` on every item; observations are folded into the
content hash, which is the dedupe key (`DEC-reject-the-whole-candidate-when-one-observation-is-malformed`).

**Why it matters.** Capture-time detection only helps items filed *after* the UI ships. Every corpus
that reaches the UI already has its duplicates, and they are unfixable-in-place: `type` is fixed at
creation, there is no retype, and supersession is the only route. The report is also the honest
counterweight to duplicates the *dedupe hash cannot see* — two items saying the same thing in different
words hash differently and dedupe never fires.

**Effort: M.**

### 12. Lifecycle debt — open questions that are still asking

**What.** Active `open_question` items by age, with their `blocks` / `unblocks` relations and whether
they are still being injected. Each row composes the supersede that retires it.

**Data.** `STD-answered-questions-are-superseded` states the rule and the exact remedy; `valid_until`
is stamped by the supersede path; relations `answers`, `blocks`, `unblocks`, `supersedes`,
`superseded_by`; ledger `injected_at` for "still being injected".

**Why it matters.** The standard states the harm precisely: *"an `open_question` tells an agent 'do not
decide this yourself', so once settled it would keep warning agents off a resolved question."* A stale
open question is not clutter — it is an **active brake on work**, injected into every relevant session.
This repo's own three open questions are all correctly superseded, which is evidence the discipline is
maintainable and evidence that it takes deliberate attention.

**Effort: S.**

### 13. Ingest yield — which documents are worth mining, and why candidates fail

**What.** Per ingest session: chunks processed vs remaining, candidates `created` / `deduped` /
`superseded`, and every rejection grouped by its validation message. *"`docs/prd.md`: 14 chunks, 9
applied, 22 candidates, 6 rejected — 4 of them 'source span is a paraphrase'."*

**Data.** `IngestSession { chunks, applied: Record<anchor, ApplyRecord[]>, rejected: RejectionRecord[] }`
(`src/ingest/session.ts:42-59`); `ApplyRecord.action: 'created' | 'deduped' | 'superseded'` plus
`previousId`; `RejectionRecord { anchor, at, index, title, message }` — kept in a **separate**
`.rejected.jsonl` deliberately, append-only and **never pruned by a later success**.
`validateCandidates` (`src/ingest/schema.ts:202-513`) generates **roughly thirty distinct rejection
messages**, and they cluster into groups a user can act on: *the quote is not verbatim in the chunk*
(`:298` — the single most likely repeat offender), *a Markdown heading in the body* (`:288`), *a bare
`**` scope glob* (`:348`), *a backslash in a scope glob* (`:341`), *`severity: hard` under an inert
category* (`:323`), *unknown category*, *unknown field*, *title over 200 chars*. Applied items also
carry their own provenance in `extra`: `content_hash` (the dedupe key) and `ingest_key`
(`src/ingest/apply.ts:36,79`).

**Why it matters.** The rejection log is a permanent, structured record of *how extraction goes wrong*
and nothing reads it today. `ingest-status` shows progress, not yield. Grouped by message it becomes a
prompt-quality instrument: six "paraphrase" rejections say the extraction instruction is not landing,
and that is fixable in one edit. `deduped` counts tell you a document has already been mined. And
`DEC-reject-the-whole-candidate-when-one-observation-is-malformed` means **one malformed observation
costs the whole candidate**, so the rejection rate is structurally higher than intuition suggests —
which is exactly the kind of number that looks like a defect until you see its distribution.

**Effort: S–M.**

### 14. Corpus health trajectory — three numbers that must move

**What.** Three time series on one strip, with the current value and the trend:
**(a)** % of active normative items carrying a scope; **(b)** count of pinned items and their token
cost; **(c)** days since the review queue was last empty. Nothing else. These are the tutorial's three
habits, rendered as instruments.

**Data.** All three are already computed by one command and rendered nowhere as a series:
`mycontext status --json` (`src/cli/commands/status.ts:222-293`) emits
`items { total, byCategory, byStatus, byOrigin }`, `reviewQueue`, `pendingRevisions`, `stagedRules`,
`unfinishedIngest`, `usage { sessionsRecorded, window, cold, unrestricted, caveat }` and `health`.
(a) adds `scope[]` per item + tier; (b) adds `always` + `estimateTokens` + `tokens` on `session-start`
records; (c) is `create` records for drafts against `promote` / `discard` in the mutation log.

**Why it matters.** This is the answer to *"why would I open it tomorrow?"* Diagnostics are opened
when something breaks; a trajectory is opened because it moved. And these three are not vanity metrics
— the tutorial names each as the difference between the tool working and the tool being cost with no
benefit. (b) is directly measurable rent; (c) is the leading indicator of the recorded failure mode.

**Effort: S.**

### 15. Subagent coverage — the hole that is documented and invisible

**What.** Per parent session, which subagents ran, what each was delivered, and — the point — which
were delivered **nothing** because they touched no file. A subagent never receives the session-start
injection, the index, or a compaction restore; it gets JIT only.

**Data.** `ledgerKey(input)` = `session_id::agent_id` (`src/hooks/io.ts:46`); the jit note
`subagent <agent_id> (<agent_type>)` (`pre-tool-use.ts:254`); per-subagent seen files — this repo's own
`.my_context/state/` holds 32 of them under one session id.

**Why it matters.** README §8 documents the gap as bounded but real and says *"nothing in a plugin can
close it today."* A gap nothing can close is a gap that must at least be **visible**, because the
failure it produces — a subagent confidently working without the project's constraints — is
indistinguishable from the model ignoring them. The data has been recorded since the `agent_id` keying
shipped and no surface reads it.

**Effort: S.**

### 16. Revision store watchdog

**What.** Pending revisions by age, and the size of `.my_context/.revisions/`.

**Data.** `revisions.jsonl` and the `PendingRevision` projection; `stale` and `changedSince` per
revision.

**Why it matters.** README §8, verbatim: *"`mycontext doctor` has no check for the directory at all, so
nothing reports on its size or on a revision left pending for months."* A recorded gap with a
one-screen fix, and it makes job #3 (walk the queue) actually complete — today the queue shows what is
pending, not what has been pending since March.

**Effort: S.**

### 17. One unfinished-work queue — because there are four of them

**What.** Job #3 is "walk the review queue", and everyone including the tutorial believes that means
drafts. **There are four independent queues of half-finished work, each with its own store, its own
staleness, and no shared surface:**

1. **Drafts** awaiting `review promote` / `review discard`.
2. **Pending revisions** awaiting `review promote-revision`, each with per-field staleness.
3. **Staged rule candidates** from the lesson flow, awaiting `lesson-accept` / `lesson-discard`.
4. **Unfinished ingest sessions**, with anchors still pending.

One list, sorted by age, each row composing its own settling command.

**Data.** All four are already assembled by one command and nothing renders them together:
`mycontext status --json` emits `reviewQueue { drafts, always, globalLayerDrafts }`,
`pendingRevisions { revisions, items }`,
`stagedRules [{ lesson, key, title }]` and
`unfinishedIngest [{ id, sourceFile, chunks, applied, pendingAnchors }]`
(`src/cli/commands/status.ts:222-293`). Underneath: `pendingRevisions` (`revision.ts:633`),
`LessonStaging.candidates[].state: 'pending'|'accepted'|'discarded'` in
`.staging/<lessonId>.json` (`src/lesson/derive.ts:21-34`), and `pendingAnchors`
(`src/ingest/session.ts:701`).

**Why it matters.** Queues 3 and 4 are the ones that rot invisibly, and they rot for a *designed*
reason: `/mycontext:lesson-stage` prints the accept and discard commands and **stops**, deliberately,
because "a slash command that ran `lesson-accept` would be the model settling a rule on your behalf."
That design guarantees a staged candidate sits until a human returns to it — and nothing reminds the
human. A deliberate stopping point without a queue that surveys it is a design that leaks. This is the
highest-value **S** in the paper: the data is already in one JSON blob, and it turns job #3 from "walk
the drafts" into "settle what is open."

**Effort: S.**

### 18. Lesson yield — did the incident become a rule?

**What.** Per lesson: was a rule ever derived from it, is a candidate still staged, or was it discarded
— and for the rules that exist, the reverse link back to the incident.

**Data.** `StagedRule { key, candidate, state, ruleId }` (`src/lesson/derive.ts:21-27`) — `ruleId` is
written on accept (`derive.ts:548-550`). The accepted rule is created with
`relations: [{ type: 'derived_from', target: lessonId }]` and audit op **`'accept'`**, not `'create'`
(`derive.ts:518-546`) — so the audit log distinguishes a human-approved machine proposal from a
human-authored rule, which is a distinction no other surface exposes. **The reverse edge (`produced`)
is deliberately not written**, so from a lesson you cannot navigate to the rules it caused.

**Why it matters.** README §2 describes the whole pipeline as "from an incident to a rule", and the
`accept` op exists specifically to record that a human closed the loop. Nothing counts it. Two
questions the data answers and no surface asks: *how many of our lessons ever became rules* (the
product's own conversion rate), and *which incident is this rule protecting us from* — which is the
question that decides whether a rule survives a cleanup. The missing `produced` edge means this view
is the **only** way to walk lesson → rule; the graph cannot do it.

**Effort: S.**

### Indispensable versus nice — which of these eighteen actually bind

Most of the list above is *nice*. Nice is not nothing: it compounds, and a tool nobody opens compounds
nothing. But three properties separate a product you would reinstall on a new machine from one you
would shrug at losing, and only some of these capabilities have them.

**Property 1 — it answers a question that has no other answer.** Not "answers it better". *Only.*
Capability 1 (retrospective autopsy), capability 4 (compaction survival) and the §4b context-provenance
sentence pass this outright: the data exists in exactly one place, is never re-derivable from the
present corpus, and no command prints it. Capability 18 passes on a technicality that is real — the
`produced` edge is deliberately not written, so the lesson → rule walk exists nowhere else.

**Property 2 — it fires on the worst day, not the best one.** Tools that only reward a tidy user get
abandoned by untidy users, which is all users. Capabilities 1, 2, 8 and 17 are worst-day tools: they
are most useful precisely when the corpus is neglected, the queue is full and something has gone wrong.
Capabilities 11, 12 and 14 are best-day tools — genuinely valuable, and the first to be skipped.

**Property 3 — it makes something shrink.** A knowledge base that only grows eventually spends its
entire budget on its own past, and `ADR-normative-vs-rationale-tiers` is explicit that the tier split
exists so "context cost stays fixed whether the corpus holds 40 items or 4,000." The *tiering* holds
that line automatically; nothing helps a human hold the line on what is pinned. Capability 3 (the rent
roll) is the only proposal here whose output is a deletion, and it is therefore the one that keeps the
product's central promise true at year three rather than at month one.

**The indispensability test, stated as one sentence:** a developer keeps a tool when it is the thing
they reach for at the moment they feel stupid. That moment is the code review that catches the model
breaking a rule that was supposed to be enforced — and the honest answer *"the rule was delivered and
your prompt lost to it"* is worth as much as *"the rule spilled at 14:03"*, because both end the hunt.
**Build capability 1 first. If only one thing ships, ship that.**

---

## Team and history

### The asymmetry that defines the team story

**Committed and shared — exactly two things:** `.my_context/items/**` and `config.json`. The workspace
`.gitignore` contains only `.index.db` and `.index.db-*`.

**Machine-local — five separate stores, each writing its own `.gitignore` containing `*`, each
unconditionally, from the code that creates the directory:**
`.audit/` (`audit.ts:43`), `.revisions/` (`revision.ts:272`), `.ingest/` (`session.ts:198`),
`.staging/` (`derive.ts:68`), and `state/` — which holds the seen files, the compaction snapshots and
`focus.json`. Five directories, five deliberate decisions, all the same decision.

So: **the knowledge travels; every piece of evidence about how it is used, and every piece of work in
progress, stays behind.** That single fact should shape the whole team story, and it cuts both ways.

- It means **every history-based and every queue-based capability here (1–8, 10A, 13, 15, 16, 17, 18)
  is single-machine.** The UI must say so once, plainly, on any screen showing them — not as a caveat
  but as a label: *"this machine, since 2026-08-13."* README already carries the warning; the UI should
  carry the same sentence and never imply team coverage it does not have.
- It has a sharper consequence for capability 17 that is worth stating on its own: **a staged rule
  candidate, a pending revision and a half-finished ingest are invisible to every teammate.** If the
  person who staged them leaves, or reimages, that work is gone — and nothing anywhere reports it. The
  revision store's own record accepts this deliberately (*"a staged proposal remains a conversation
  with the human at the machine it was staged on"*), and the same reasoning was never written down for
  `.staging/` or `.ingest/`. Worth a line in the docs, not a change in the design.
- It also means **every corpus-based capability (3 partly, 9, 11, 12, 14a/b) works on a fresh clone
  with zero history**, which is exactly what a new teammate has. Those are the onboarding capabilities,
  and they are the ones to build first for a team.

The design should not try to fix the asymmetry. The revision store's own record explains why an
opt-in committable log was *considered and declined*: an append-only JSONL committed from several
machines meets another machine's appends as a merge conflict, and resolving it means rewriting history
inside the one store whose promise is that a recorded proposal is never rewritten.

### What becomes possible across people

1. **The corpus is reviewable in a pull request, and the UI is what makes the diff mean something.** A
   PR that changes `scope: ["src/billing/**"]` to `["src/payments/**"]` is a two-line diff whose actual
   effect is "these 14 files stop being governed and these 9 start." That is computable from the
   checkout alone — pure functions over items and config — with no history and no git parsing.
   **This is the single highest-value team capability available under the constraints** and it needs
   nothing that does not exist. It is capability 10 Tier A's shape applied to the working tree rather
   than to the log.
2. **Two workspaces, side by side.** Because `select()` is pure and the server takes a project root, a
   second read-only workspace root is a *comparison*, not a new mechanism: `git worktree add` a branch,
   point a second tab at it, and the governing sets diff. Zero git parsing, zero dependencies, and it
   gives the PR review above without ever reading an object file. Worth a decision from the owner: it
   is a small server change (accept a root per request, or per instance) with a large payoff.
3. **Authorship and age travel in the frontmatter.** `origin`, `valid_from`, `valid_until` are
   committed fields. "Who decided this and when" is answerable on any clone without git; "who *changed*
   it" is not, and that is the honest line.
4. **The global layer is the cross-project half and it has no write route at all** — README §8:
   `mycontext init --global` is refused, no command creates or writes one, and the documented route is
   to build an ordinary workspace and move the directory. A UI that composes commands can at least
   *compose that route* and show which global items are currently shadowing or supplementing the
   project layer. Nobody has proposed it; it is the only team-scale mechanism the product has and it is
   effectively undiscoverable.

### What becomes possible across time

The audit log **rotates at 8 MiB and never deletes** — every record ever written is still on disk, and
`doctor` reports segment count and total size past 32 MiB, naming the rotated segments as yours to
archive. That is a multi-year series on a single machine, and it is what capabilities 2, 3, 4, 5, 8 and
14 all spend. Two consequences worth stating:

- **The projection's freshness is part of every answer.** It catches up incrementally from a recorded
  position and discards-and-rebuilds only on divergence or a schema change. Spec §5 requires that a
  query answered from a projection that is behind **either catches up first or says it is behind**. On
  a time-series chart that constraint has a visual form: the series must end where the projection ends,
  not where the log ends, with the gap drawn rather than smoothed over.
- **The one thing history cannot tell you is whether a rule worked.** `decay`'s own preamble is the
  most honest sentence in the product: *"the ledger records injection, not reading or reliance, so a
  new item, and any item consulted via `show`, MCP `get_item`, or the Markdown file directly, look
  exactly like an abandoned one here."* Every capability above measures **delivery**. None measures
  **compliance**, and the UI must never imply otherwise — a "rule effectiveness" score would be the
  exact class of false claim `STD-guarantee-claims-carry-their-condition-in-the-same-sentence` exists
  to refuse.

### One boundary to respect

`NOGOAL-not-a-claude-mem-replacement` is `severity: hard`, `always: true`, and pinned into every
session on this repo: *"Do not build session history, activity capture, or semantic search over past
work."* Capabilities 1, 4, 7 and 15 render **per-session** views, and the distinction has to be made
explicitly in the design or the review will be right to object. The line: these views show
**my_context's own delivery record** — which items this tool handed to a session, and which it
withheld and why. They do not summarise what happened, do not capture activity, and hold no content.
That is precisely the "scope, not content" decision (§5) rendered, and it is the tool's own audit
trail, not the session's history. Say it once, in the design, in those words.

---

## Headline

The reason to open this every day is not that it shows the corpus — a terminal shows the corpus — but
that it is the only place the corpus meets the **record of what actually reached the model**, and that
record is the one thing a developer needs on the worst day of the week: the day a review catches the
model doing the banned thing again. Build the retrospective miss autopsy first and everything else in
this paper becomes a link from it: the spill onset chart, the compaction survival report, the rent
roll, the deny wall, the degradation counter — each one an answer to "why" that exists in the recorded
data today and that no command surfaces. Make it indispensable by making it the only surface that can
say *"the rule was delivered and ignored"* or *"the rule spilled at 14:03 for this reason"* with
evidence, and by keeping every one of those sentences as honest as the product's own documentation is
— **"not recorded" never rendered as zero, "this machine only" never implied as "this team", and
delivery never implied as compliance.**
