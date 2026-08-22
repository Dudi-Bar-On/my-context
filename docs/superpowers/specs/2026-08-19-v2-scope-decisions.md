# v2.0 — scope decisions beyond the web UI

**Date:** 2026-08-19
**Status:** decided by the owner, one question at a time
**Decides:** requirements R6–R13 in `reports/uiux/REQUIREMENTS-ADDENDUM-2.md`, R14 (stated by the
owner on 2026-08-20 and recorded in §6p, not in that addendum), and the category question the
expert panel answered incorrectly
**Companion:** `2026-08-18-v2-decisions.md`, which decides the web UI. Nothing here reopens it.

---

## 0. What this document is, and one correction it exists because of

The v2.0 scope grew past the web UI. This records what was decided about the rest.

**One correction shapes several entries below.** A research pass ruled that the five proposed
categories duplicated `known_issue`, `Observation` and an issue tracker, and recommended none. The
owner rejected it, and the rejection was right: **the research answered a taxonomy question and
the owner had asked a capture question.**

> *"todo / tbd new features and capabilities and also bugs and especially comments are free way to
> let the user add somthing that raises in it's mind during development so it would be handled
> later and not be forgotten"*

Every existing category expects the author to already know what kind of knowledge they have. At
the moment a thought arrives mid-development, they do not — and the friction of choosing is
exactly what stops the thought being recorded at all. Nothing in the corpus was an **inbox**.

Walking the five separately produced a smaller answer than either the research's *none* or the
owner's original *five*: **two new categories, and two existing mechanisms already covering the
rest.**

**Three is the final count, and it is three on purpose.** Walking the five gave `todo` and `note`;
§2 below adds a third — a `procedure` category for one-shot ordered work. §6m.1 once withdrew that
third, on the reading that the shipped `runbook` already meant it — and **§6o reverses that**: both
categories exist deliberately, `runbook` for the repeatable case and `procedure` for the one-shot
one. So the whole answer is `todo`, `note` and `procedure`.

---

## 1. The category vocabulary gains three entries

| Proposed | Decided | Where it goes instead |
|---|---|---|
| `todo` / `tbd` | **NEW category** | — |
| `comments` | **NEW category, named `note`** | — |
| `prerequisites` | **not a category** | the existing `blocks` relation |
| `defects` | **not a category** | `known_issue`, which already exists and is already normative |
| `bugs` | **not a category** | as above |
| a one-shot ordered procedure (R11b) | **NEW category, named `procedure`** | §2 — and the existing repeatable `runbook` is **unchanged** |

**The third entry is decided here and specified in §2**, because it arrived as a separate proposal
(R11b) rather than in the list of five above, and because it is the only one of the three that
carries a lifecycle. §§1.1–1.6 walk the five; §2 walks `procedure`.

### 1.1 `todo` — rationale tier, never injected

An intention: a feature or capability meant to be built.

**Rationale tier**, so an agent may write one directly with no draft queue. The trust boundary
exists to stop an agent asserting a **rule**; a `todo` asserts nothing, it records an intention.
Draft-gating it would put friction on the one operation that must have none.

**Never injected.** Twenty unbuilt things arriving in every session are twenty things the model is
told to care about and cannot act on — and that is how a pinned block trains a reader to skim.
`todo` gets **its own listing surface** — `mycontext todo`, plus `search --type todo` — and it is
visible in the UI. **The review queue is not widened**: an inbox and a draft queue answer different
questions — *"what did I jot down"* against *"what am I being asked to let govern"* — and
`reviewQueue` keeps meaning exactly one thing across all four surfaces that read it.

> **CORRECTED 2026-08-19, by implementation survey.** This paragraph originally ended *"`todo`
> appears in the review queue, in search, and in the UI"*. It cannot: `reviewQueue` is
> `status === 'draft' && layer === 'project'` (`src/core/select.ts` · `i.status === 'draft' && i.layer === 'project'` · ~435) and a rationale item is
> never forced to draft — which the paragraph above already says (*"no draft queue"*). Ruled in
> §6m.9.

**The known cost, recorded rather than solved:** every other item type is true until superseded. A
`todo` is true until someone does it, and the corpus has no way to learn that happened. Its
promotion path (§1.3) is the mitigation, not a fix.

### 1.2 `note` — rationale tier, never injected, and it stands alone

The inbox. Anything that arises during development and must not be lost.

**The gap it fills, precisely.** `Observation` already exists and is close — a categorised,
tagged record — but it **attaches to an existing item**. A thought during development frequently
has nothing to attach to yet, and if answering *"which item is this about?"* is a precondition for
recording it, it does not get recorded.

Same tier and injection rule as `todo`, for the same reasons.

### 1.3 The promotion path is the point

Neither category is useful without a way out. A `note` or `todo` is **promoted into another
category**, which:

- creates the target item (a `decision`, a `requirement`, a `procedure`, a `known_issue`),
- **links back** to the origin with a relation, so the trail survives,
- and marks the origin resolved rather than deleting it.

The trust boundary applies unchanged on arrival: promoting into a normative category produces the
same draft an agent-authored normative item produces. **Promotion is not laundering.**

### 1.4 Why bugs and defects are not categories

`known_issue` exists, sits on the **normative** tier and **is injected** — which is correct,
because a known bug is exactly the thing the model must be told before it writes code that depends
on the broken behaviour. ISTQB and IEEE 1044 treat bug, defect and fault as one concept under
three names.

**A bug you have just noticed and not yet characterised is not a `known_issue` — it is a `note`.**
That is the lifecycle: `note --tag bug` → understood → promoted to `known_issue`.

### 1.5 Why prerequisites are a relation

A prerequisite is inherently a statement about **two** items: X before Y. `blocks` is already in
the closed `RELATION_TYPES` vocabulary and expresses it, and the relation graph already renders a
prerequisite chain as an ego-graph at radius 2. A prerequisite about the outside world ("Node 24 or
later") is a `constraint`, which also already exists.

### 1.6 Promoting a user's custom category into the shipped defaults — **not now**

Users can already define categories in `config.json` and `resolveConfig` validates them, so nothing
is blocked. The flow where the product **learns** from its users is a different kind of feature
from everything else in v2.0 and is deferred without prejudice.

**One thing here *was* blocked, and §6m.12 unblocks it.** The `commands/*.md` slash commands are
generated at build time from the plugin's **own** defaults and committed, so a category a user
defined in `config.json` — or one a pack enabled — reached **no slash command at all**. A single
generic **`/mycontext:add <category> …`** accepts any category the resolved config knows, so custom
and pack-defined categories work the moment they are enabled, nothing is generated at install time,
and a disabled category fails in one place with a real message. The generated per-category commands
stay exactly as they are, committed, with their CI parity test.

> **CORRECTED 2026-08-19, by the conflict scan.** *"Nothing is blocked"* was true of the data model
> and false of the command surface: §6l F15 found that a config-defined or pack-defined category
> gets no generated slash command, so a user could define a category the product would never offer
> to fill. §6m.12 rules the generic `/mycontext:add` stated above. The deferral of the *learning*
> flow — the product promoting a user's category into the shipped defaults — is unchanged; that was
> never what F15 was about.

---

## 2. `procedure` — a one-shot ordered procedure

**A third new category**, and the only one that changes the injection lifecycle.

> *"runbook is distinguished from a rule by it's steps while a rule is a single instruction …
> always it requires the user to initiate it's functionality, the body should state that only after
> user approval it will be used and honored by the llm."*

**Why `procedure` exists beside `runbook` rather than instead of it.** `runbook` already ships —
normative, prefix `RUN`, *"The steps for a named operation, in the order they must be taken"*
(`src/core/categories.ts` · `runbook:       def('runbook', 'RUN', 'normative', true,` · ~40) — and
it is the **repeatable** one: the steps taken every time the
named operation comes up. `procedure` is the **one-shot** one — a migration, a fix, a one-time
correction — performed once and then finished, and it is `procedure` that carries the lifecycle
below. **Both exist on purpose (§6o)**, and neither absorbs the other: a sequence that applies every
time and a migration run once are not the same knowledge, and collapsing them loses the thing that
makes the one-shot honest — that it stops being injected once it is done. The distinction from
`rule` is structural and is the owner's own — **a rule is one instruction; a procedure is a
sequence**.

**The boundary in one sentence, and §6o requires the docs to use it verbatim:**
*Will you do this again next time the situation arises? Then it is a `runbook`. Is it done once and
then finished? Then it is a `procedure`.*

> **CORRECTED 2026-08-20, by the owner in §6o.** This section was rewritten on 2026-08-19 under
> §6m.1 to read `runbook` throughout, on the reading that R11b's *"runbook (or to call it with
> different name)"* named the shipped category rather than proposing a new one. **§6o reverses
> that**: both categories exist, `runbook` keeps the repeatable meaning it already ships with and
> gains nothing — no lifecycle, no states, no `## Steps` field — and `procedure` is new and carries
> all of it. §§2.1-2.3 below therefore read `procedure` again and an item id is `PROC-`, never
> `RUN-`. **What does not come back is this section's original naming argument**: it argued
> `procedure` against SRE usage of "runbook" and never noticed that `runbook` was an occupied name
> here, so the one-shot/repeatable line above replaces it and the sentence above is the test. **The
> reversal does not touch how the four lifecycle stages are *represented*** — they are still not
> four bespoke statuses, §2.1 below states the mapping §6m.2 ruled, and §6o re-attaches that mapping
> to `procedure`. §2.3's open list stays closed in place — a planner reading this section in order
> must not schedule questions that were answered later in this document.

### 2.1 The lifecycle, mapped onto shipped statuses — and injection happens in exactly one

| Stage | Shipped representation | Injection |
|---|---|---|
| `proposed` | `draft` — which already means "written, not governing". An agent may author one here | **not injected** |
| `ready` | a **tag or `extra` field on the draft** — *not* a status | **none today** — see below |
| `active` | `active` **plus `always: true`** — two human writes, not one | **injected in full**, every session, until it is finished |
| `done` | `deprecated` — **not `validated`** | **not injected**; kept as the record that the work happened, and counted in `retired` |
| abandoned | `superseded` (§6d) | **not injected** |

**Nothing is added to `Status`.** The five shipped members carry this whole lifecycle, so
`RETIRED_STATUSES`, `reviewQueue`, `isEligible` and every `IndexSummary` tally stay correct with no
amendment. `done` is `deprecated` and **not** `validated` because `governsNormatively` treats
`validated` as still governing — a completed procedure would keep governing. And `deprecated` is
counted in `retired`, so a finished procedure still appears in a session-visible number instead of
vanishing from every tally, which is what `INV-nothing-is-dropped-silently` demands.

**Activating a procedure is two human writes, and this spec says so rather than leaving it to be
discovered.** `status: active` makes the item eligible; **`always: true` is what delivers it in
full every session** rather than as an index line, because "injected in full" is a property of the
`always` flag and its tier membership, never of a status. The owner's act of initiating a procedure
therefore sets **both**, and a plan that sets only the status ships a procedure that is merely
eligible — indexed, not delivered, and silently not doing the one thing this lifecycle exists for.

**`ready` yields no index line today, and that is the one question this lifecycle leaves open.**
`buildIndex` enumerates only eligible items and `isEligible` admits only `active`, so a `ready`
procedure — a draft carrying a tag — is not indexed at all. §6i.3 records the choice and it is still
open: either `select()` gains a per-item injection mode, or `ready` is a review state with no
injection and the model does not learn a procedure exists until the owner makes it `active`. **Nothing
may be built on "index line only" until that is decided.**

**Injecting only in `active` is what makes the requirement honest.** A procedure the model holds
in full is a procedure it may begin following. Delivering it only in the state the owner put it in
deliberately is the mechanism behind *"always requires the user to initiate"* — not a sentence in
the body asking the model to wait.

The body still says so as well, because a reader of the file should not have to infer it from
config.

> **CORRECTED 2026-08-19, by the conflict scan.** The table above originally presented `proposed`,
> `ready`, `active` and `done` as **four bespoke states**, with no mapping onto the shipped `Status`
> union. §6l F3 measured what that costs: they are three new `Status` values and two of them are
> unreachable — `ready` can produce no index line, and `done` is counted in **no** tally, which is a
> direct hit on `INV-nothing-is-dropped-silently`. §6m.2 mapped the lifecycle onto what ships, and
> the table now records that mapping instead of four names. The lifecycle itself, the injection rule
> and the completion gate are unchanged; only their expression is.

### 2.2 Completion

> *"just the user should be asked if to set it to done or be notified it was executed and there
> should exist a command that allow to change it's state to done."*

- **A command exists** to move it to `done`. That is the primary path.
- **The agent may ask or notify** — "the steps of `PROC-x` appear complete; mark it done?" — but
  **never decides**. The same gate as activation, for the same reason: an agent that can mark its
  own procedure done can declare victory.
- The audit record then carries `origin: 'human'`, which is the only thing that evidences a human
  did it.

**The failure mode this guards against** is the opposite of the obvious one: not a procedure
closed too early, but one left `active` forever, injecting in full in every session long after the
work finished.

### 2.3 What was open here, and where each was answered

Every question this subsection opened has since been decided. It is kept, with its answers, because
a planner reading in order must not schedule work that is already ruled on.

- **How a step is represented — DECIDED.** A `## Steps` section of ordered checkbox lines, held in a
  **first-class `Item` field**, not in the body: `validateBody` refuses heading lines, so this is a
  file-format change rather than a parser reuse. See §6a and §6i.1.
- **Does anything track step-level progress — DECIDED.** Yes, and **never in the item**. Progress is
  session state or an audit record; "3 of 5" is counted from that and a ticked box is *rendered* over
  the immutable stored list. See §6g and §6m.3. How that write path is expressed in the type system
  is the one implementation choice left, and §6i.4 leaves it deliberately to the plan.
- **What `superseded` means — DECIDED.** An abandoned procedure is `superseded`, with `supersede --by`
  pointing at whatever overtook it. No fifth state and no new command. See §6d.
- **Whether a repeatable sequence is a separate thing — DECIDED, and it is `runbook`.** This bullet
  originally named only `standard` and `rule` as already covering "do it this way every time" and
  **omitted `runbook`**, which was precisely that category — *"The steps for a named operation, in
  the order they must be taken"* — and the omission is how this section came to argue its new
  category from a naming point instead of from the one-shot line. That correction still holds, and
  it is now the answer: the repeatable case had a category all along. Under §6o `runbook` keeps it,
  unchanged, and `procedure` is the one-shot sibling — so neither is a second spelling of the other.
  The second-spelling defect this project has paid for four times is answered by stating the
  boundary where an author is choosing, which is what §6o's one-sentence test is for.

---

## 3. R7 — multi-session, clarified into three requirements

The original requirement was one line and was read three different ways. The owner's clarification
makes it three things, and **one of them is not a reading anyone offered**:

1. **Concurrency.** Several terminals on the same workspace, all served by one registry with the
   same ruleset and items. *Correctness.* The seen file is already keyed `session_id::agent_id`
   and read-only contention was measured at 18,300 trials with zero failures — so this may
   substantially hold already, and the work is **proving** it rather than building it.
2. **Switching views between sessions in the UI.** *A feature.* The data already exists in the
   ledger and the audit log.
3. **Cross-session continuity — NEW.** *"mycontext field with items from previous session could be
   injected and used in the new session too."* **The product does not do this today.** Dedupe state
   is per-session by design, and a new session starts with an empty seen set. The `restored` tier
   carries state across a **compaction**, never across a **session boundary**.

Item 3 is the substantive new requirement: what does a new session inherit, on what evidence, and
how does the user see that it happened?

> **CORRECTED 2026-08-19.** This paragraph ended *"It is unspecified and needs its own design"*,
> and it was **answered three sections later**: a new session inherits **index lines** for a chosen
> session (§6c), the source session and count are shown identically in the CLI and the UI with a
> per-item **carried** marker (§6g), and those lines **deduplicate against the new session's own
> index first, then queue inside the same `budgets.index`** (§6m.11). Left as written it reads as
> open work, which is how a planner comes to schedule a design that already exists.

---

## 4. R10 — the mechanism already exists; the content does not

The requirement is *"ensure the coder always will use mycontext regularly"* and *"a mechanism to
verify it uses it"*. Research against Claude Code's documentation returned an answer the product
already owns:

**The pinned tier is the mechanism.** A pinned item is delivered in full, every session, and is
re-asserted by `SessionStart` — which fires on start, resume, `/compact` **and** `/clear`. That is
precisely what the owner described: *"a predefined rule or category that instructs the model to use
mycontext, injected and let the model know it from the beginning."*

So R10 is largely a **content** decision — writing that item — rather than a build.

**Verified from documentation:**

| | |
|---|---|
| `CLAUDE.md` | survives `/compact` (re-read from disk); **does not survive `/clear`** |
| Hooks | **do** run inside subagents |
| Subagents | inherit `CLAUDE.md`; do **not** inherit auto-memory or output styles |
| Path-scoped rules | are **not** re-injected automatically |

**Unverified, and the probes matter.** Whether a pinned item reaches a **subagent** at all is the
one that decides how much of this requirement is met. `README.md` §8 states that a subagent never
sees the pinned tier — so on the product's own account, the main mechanism does not reach half the
target. See `reports/uiux/research/NEEDS-A-PROBE.md`.

> **SUPERSEDED by §6b and §6c.** `SubagentStart` fires **and can inject** — measured in probe P3 and
> confirmed in the subagent's own transcript, not by asking the model. A subagent now receives the
> pinned tier in full plus the index, before its first tool call, and `README.md` §8 is corrected in
> both languages. **The paragraph is kept because the next one is still true:** injection cannot
> distinguish an agent that received the context and ignored it from one that acted on it. That
> remains the honest limit of R10.

**Verification is the second half and is weaker than it looks.** The audit log distinguishes "the
agent is capturing and consulting" from "the agent has drifted" — mutations stop, injections stop
being followed by mutations. It **cannot** distinguish an agent that received the context and
ignored it from one that acted on it, because nothing records what influenced a decision.

---

## 5. R6 — export and import

Two corrections to an earlier ruling, both from the owner.

**The format was never a tarball.** Decided:

| Case | Format |
|---|---|
| Canonical | a **plain directory** in workspace shape — `items/**`, `config.json`, `manifest.json`, `history.jsonl`. Imports with `cp -r`, diffs per item, needs no code |
| Single file, receiver has git | **`git bundle`** — the only container carrying the corpus's own history, incrementally updatable, signable with tools they already have |
| Single file, receiver has nothing | a **deterministic ZIP** — 64 lines of `node:zlib`, verified byte-identical across runs, and the only archive every Windows since XP opens by double-click |

Identity lives in a sorted `manifest.json` of **full SHA-256 digests** — not the item `checksum`,
which is the first 16 hex chars and therefore a **64-bit truncation**, unfit as an integrity
control. **SQLite is refused as a wire format** because `node:sqlite` is still experimental; no
interchange format may rest on it.

**History travels, and the argument is stronger than expected.** The owner asked for it; the
justification found is that **the item file has no `created` or `updated` field at all**, and most
of a real corpus has a single git commit — so **mutation records are the only thing that can date
an item or say who touched it.**

- **Travels:** mutations only — `create`, `update`, `promote`, `accept`, `stage`, `discard`,
  `supersede`, `refresh`, `link`, `unlink`. These carry no `sessionId` and no `path`.
- **Does not travel:** injections, hook actions and focus records — 86% of the log's bytes, and
  they leak repository paths and subagent ids. **Nor do `.revisions/`, `.ingest/` or `.staging/`.**
  `.revisions/` holds the text of **discarded proposals**, so an export that shipped it would send a
  stranger the drafts this project rejected.
- **The exporter is an allow-list, not a deny-list.** Only what this section names travels — the
  workspace shape in the format table above (`items/**`, `config.json`, `manifest.json`,
  `history.jsonl`) and the mutation records in the first bullet. Anything the product grows later is
  excluded until someone adds it deliberately. The three directories in the bullet above are the
  argument: they existed and this section did not mention them, so a deny-list built from this list
  would already have leaked `.revisions/`. *Cost if wrong: a directory that
  should have travelled is omitted, which is visible and fixable — the opposite error leaks, and is
  not.*
- **Redaction:** the free-text half of `discard` notes; and the history filter must be **joined to
  the item selection**, because ids are slugified titles and a record naming a withheld item
  republishes its subject.

**Exported history cannot justify trust, and must never be allowed to.** The log has no hash
chain, no signature and no sequence number — it is testimony from the party whose trustworthiness
is in question. What it *can* do is rank a review queue by risk and answer one join nothing else
can: *"this item arrives `active` and nothing in its history shows a human ever approved it."*

**Imported history goes in `.audit/imported/` under its own protocol.** Merging foreign records
into `audit.jsonl` in timestamp order was demonstrated to either duplicate records silently or
throw, decided by byte luck.

**An imported record whose op this build does not recognise is quarantined, not fatal.** It is
written to **`.audit/imported/unknown/`** and **counted in the import report** — nothing silently
omitted, nothing refused wholesale. Without that rule the closed op vocabulary makes **one** unknown
op from a stranger's newer build refuse the **whole segment**, so a single unfamiliar name renders
their entire imported history unreadable. The count is the load-bearing half: a quarantine nobody is
told about is an omission, which is the defect `INV-nothing-is-dropped-silently` names.

**Locally the strictness stands, because locally it is right.** An unrecognised op in this
workspace's own `audit.jsonl` means this build wrote a record it cannot read back, and that must
fail loudly rather than be filed away. The two rules differ because the two situations differ: one
is version skew across somebody else's build, the other is a bug in this one.

> **CORRECTED 2026-08-19, by the export survey and the conflict scan.** Two additions, both from
> findings recorded later in this document; nothing decided here is withdrawn. **§6m.10 (F11):**
> this section said only where imported history is *stored* and nothing about ops it cannot parse,
> and the reader refuses the whole segment on the first one — quarantine and a count are now stated
> above. **§6k:** the "does not travel" list named no directories at all, and `.revisions/` — the
> text of discarded proposals — was absent from it; the exporter is an allow-list, also stated
> above. The selection, redaction and "history cannot justify trust" rulings are untouched.

---

## 6. What the command adds over `git`

Verified end to end: `git subtree split --prefix=.my_context` → `git bundle create` →
`git subtree add` already moves a corpus, with its history and nothing else, into a stranger's
unrelated repository. So the command earns its place through four things git cannot do:

1. **Selection** — a subset by status, category or tag.
2. **Re-grading on arrival** — and this is the whole trust argument. `git subtree add` copies
   bytes, so a git-only import makes a stranger's `status: active` rules govern immediately, with
   no review. **Every imported normative item lands `draft`, regardless of any signature**, and the
   import command carries no `--promote-all`. **No new origin is invented for it.** `trustedStatus`
   already demotes every non-human origin on a normative category unconditionally, so this needs no
   code at all; `Origin` is a closed union enforced by two separate `ORIGINS` lists, and an
   `origin: 'import'` member would exist only to be the value an exception tests for. Bulk approval
   is a separate, human-confirmed act taken **after** the corpus is visible —
   `review promote --all --pack <name>`, §6h — never a flag on the import itself.
3. **Collision reporting** — three buckets, using the existing content hash.
4. **Config-as-semantics** — config **replaces**, it does not merge, and an importer must be told.

A **mandatory Unicode screen** refuses bidi controls, zero-width characters and the Tags block at
the door. Signatures are optional and must never gate import: the May 2026 @antv compromise shipped
639 malicious versions that passed npm provenance verification with forged attestations, and the
Rules File Backdoor hides instructions invisibly in exactly this artefact type. `ssh-keygen -Y
sign` is available on stock Windows 11 — offer it, and describe it as proving **authorship, never
safety**.

> **CORRECTED 2026-08-19, by the conflict scan.** Point 2 originally landed imported items *"with a
> new `origin: import`"*. §6m.5 refuses that carve-out and §6k found `Origin` is closed
> (`src/core/types.ts` · `export type Origin = 'human' | 'agent' | 'ingest';` · ~4), enforced twice
> then and three times now (§6k). The ruling that matters is unchanged and turns out to be
> already implemented — everything imported lands `draft`, regardless of any signature — so what is
> gone is the invented origin and the branch inside `trustedStatus` it would have needed, not the
> rule it was invented to serve.

---

## 6a. Decided after the probes

**`procedure` steps** — a `## Steps` section holding the ordered checkbox lines, read into
`steps: string[]`. **Size this as a file-format change, not as a third consumer of an existing
parser.** `validateBody` refuses any heading line inside a body — with the comment that *"changing
the file format … is a much larger decision than this guard"* — and an unrecognised section is
parsed and then **destroyed on the next `persist()`**. So `steps` is a first-class `Item` field: a
`parseItem` read, a `renderItem` write, a `validateBody` carve-out, and decisions on
`ContentShape`, `computeItemChecksum` and `renderItemBlock` — the last of which is
budget-correctness, so getting it wrong mis-sizes injection. `splitSections` is still generic and
SQLite still needs no DDL. What was wrong was the size, not the shape: **sized as a parser change it
will be discovered as a format change**, which is the expensive way to find out.

**The rule-file exporter — accepted, with one gate.** mycontext writes the files itself, creating
directories as needed, at the **repository root** — the directory containing `.my_context/`:

| Target | Default |
|---|---|
| `<repo>/.cursor/rules/*.mdc` | **yes** |
| `<repo>/.github/instructions/*.instructions.md` | **yes** |
| `<repo>/.claude/rules/*.md` | **behind a flag** |

The asymmetry is deliberate. For Cursor and Copilot a rules file is the only path the corpus has.
For Claude Code the hooks already deliver those items scope-matched, budgeted, with spill disclosed
and the trust gate applied — and whether the two double-fire is **unverified**. The flag exists so
that a user who wants it must ask.

**Every exported file opens with a generated-by-mycontext header stating it must not be edited, and
`doctor` re-derives the expected content and reports divergence as a finding.** Neither is polish.
The exporter writes **normative text into directories no gate protects** — the deny hook covers
`.my_context/items/` only — so an agent may edit the exported copy of a rule to say the opposite of
the item it came from, and Cursor will obey the edited copy while the corpus still reads correctly.
The header tells a human where the file came from; the `doctor` check is what notices when the two
have parted.

**Detection, not refusal.** Extending the deny hook to `.cursor/rules/` and `.github/instructions/`
would have mycontext refusing writes to directories other tools legitimately own. This is the same
bargain the audit log makes everywhere else in this product: the edit is possible, and it is
visible.

**Hooks taken into v2.0 scope** — three of the five recommended:

1. **Handle `source === 'clear'` in `SessionStart`.** No new hook: the field is already in the
   payload and `inject.ts` already branches on `source`, only on `'compact'`. Clearing the seen
   file when the window is destroyed means items that were live before the clear can arrive again.
   A failed delete over-injects, which is the safe direction.
2. **`PostCompact`** — restore sooner than the next tool call. Unverified that it fires. **SUPERSEDED by §6e:
   dropped on evidence from this project's own audit log — `PreCompact` capturing and `SessionStart`
   restoring with `source=compact`, across two real compactions. A second mechanism for a working
   one is a second spelling. Do not schedule this hook.**
3. **`PostToolUseFailure`** — one audit append on a rare event, feeding the degradation counter,
   which is the empirical check on `INV-hooks-fail-open` whose cost is invisible by design.

`FileChanged` was **not** taken.

> **CORRECTED 2026-08-19, by the conflict scan.** Two changes above. **The `## Steps` sentence is
> struck** — *"A third consumer of an existing parser is not an invention"*. `validateBody` refuses
> heading lines, so `## Steps` cannot live in a body at all and this is a **file-format change**;
> the controller ruling recorded in §6m strikes the sentence, and §6i.1 reached the same place from
> the type system. The decision to have steps stands; only its stated cost was wrong. **And the
> exporter table gained two requirements** it did not have — the generated-file header and the
> `doctor` divergence check — ruled in §6m.7 on §6l F14, which found that **nothing gates the
> directories this exporter writes into**. The three hooks, the flag on `.claude/rules` and the
> asymmetry behind it are unchanged.

---

## 6b. Probe results — measured, not reasoned

Full record in `reports/uiux/research/PROBE-RESULTS.md`. Two claims, opposite outcomes.

**`SubagentStart` fires.** Measured on Claude Code **2.1.234**. It carries `session_id`,
`transcript_path`, `cwd`, `prompt_id`, `agent_id` and `agent_type`, and its `agent_id` is
**identical** to the one the subagent's own `PreToolUse` carries — so a marker written at birth is
findable on the subagent's first tool call.

`README.md` §8 said *"There is no hook that fires at a subagent's birth for my_context to answer."*
**That is now false and both READMEs are corrected.** The section's title is unchanged and still
true: `SessionStart` still does not fire for a subagent. What changed is that the gap has a known
shape instead of being a property of the platform. **Nothing is built on it yet**, and this is the
fact that decides how much of R10 can be met.

**`prompt_id` exists** — on `PreToolUse`, `SubagentStart` and `SubagentStop`. The web-UI spec's
§4b left this explicitly open in the fifth pass rather than asserting it; that narrowing is why the
sentence is not now false. `PreToolUse` also carries `permission_mode`, `effort` and `tool_use_id`,
none of which `HookInput` declared at the time of this measurement. **The hooks plan's Task 5 declares
`prompt_id` and none of the other three**, on the rule that a declared field nothing reads is a claim
about the payload that no test can hold up.

**Path-scoped rules did not apply.** A rule with `paths: ["billing/**"]` did not fire on a file
inside its own glob; an unscoped rule in the same directory did. So `.claude/rules` **is** read and
the `paths:` form is what failed. `README.md` §1's "unscoped" bullet **stands and was not changed** —
rewriting it on the research report alone would have replaced a true sentence with a false one.

---

## 6c. Decided after the injection probes

### Subagents receive pinned in full, plus the index

Measured: `SubagentStart` **injects**, using the same `hookSpecificOutput.additionalContext`
envelope `PreToolUse` uses, and the text lands in the subagent's own context as
`hook_additional_context`. So a subagent gets **what a main session gets** — the pinned tier in
full and the index of the rest — before its first tool call.

The gap was never deliberate. `README.md` §8 recorded it as a property of Claude Code, and it is
not one any more.

**Dedupe is already solved.** `ledgerKey` returns the identical string from the real
`SubagentStart` and subagent `PreToolUse` payloads, so writing the seen entry at birth makes
`PreToolUse` skip those items. The `session_id::agent_id` keying — added for a different reason —
covers this exactly, unchanged.

**Two constraints on the implementation, both measured.** The hook **blocks**: a 3,018 ms hook
delayed the subagent's first tool call until it returned, so it sits on the critical path of every
dispatch and `INV-hooks-fail-open` applies at full force. And the injected text must be **framed as
project knowledge with visible provenance** — in the probe, a bare imperative caused the subagent
to report the injection to its parent as a possible attack, which is the model behaving correctly.

### R13 — packs are portable artefacts, not git references

The research recommended git addressing (`github.com/acme/flavour@v1.2.0`). **Overruled by the
owner, on reasoning that holds:**

> *"my intention as mycontext becomes open source is to let users to uploade their templates and
> others to use them like a library of templates — git may not exist or they use different git
> repos so it becomes irelevant. version could be descriptive that a user should add when packing a
> template and also a checksum including timestamp could be added to the package."*

A shared library cannot assume every publisher uses git, or the same host. So a pack is a
**portable directory or archive**, and what git was providing must come from inside it:

| Was provided by git | Now must come from |
|---|---|
| version | a **descriptive version the author supplies** when packing |
| integrity | a **checksum recorded in the pack**, with a timestamp |
| identity / re-fetch | **open** — see below |

**One hard constraint on the checksum.** mycontext's item `checksum` is
`sha256(content).slice(0, 16)` — a **64-bit truncation**, described in its own comment as tamper and
drift detection. That is not an integrity control for an artefact a stranger downloads. A pack
manifest carries **full SHA-256** digests, per file, sorted.

**Newly open, because git addressing was providing it:** how a user *finds* a template in the
library, and how they *re-fetch* or update one they already imported. Removing the address removed
both.

### Cross-session continuity — selectable, and not only in the UI

The new session inherits **index lines** for what a previous session had (already decided), and:

- the default is the most recent session;
- **any session may be chosen**, and that choice must be available from the **CLI and a slash
  command**, not only the web UI — the UI is wave 1 of three, and this must work without it;
- **carried lines deduplicate first, then share the index budget.** Carry **only what the new
  session's own index would not already show**. Most carried lines are duplicates of lines the new
  index produces anyway, so the remainder is small — and what survives the dedupe queues inside the
  **same `budgets.index`**, spilling and disclosing exactly as any other index line does. No fifth
  budget and no new config key, so §6f's *"retrieval is bounded by the index budget"* keeps
  describing the system;
- **sessions gain names.** A session is a UUID today, which is unusable for "carry from that one".
  **mycontext owns the name and derives nothing on the user's behalf** — §6d, with the unnamed
  fallback in §6g and the command form in §6m.8.

> **CORRECTED 2026-08-19, by the conflict scan and the hooks survey.** Two amendments to this
> subsection. **§6m.11 (F13):** carried index lines had **no budget** here — neither this section
> nor §6g picked between consuming `budgets.index` and adding a fifth one, so a carry could have
> spilled the new session's own items with nothing deciding which won. Dedupe-then-share is stated
> above. **And the naming bullet's *"how a name is assigned is open"* was closed one section
> later**: §6d rules that mycontext owns the name and refuses to derive one, and §6m.8 fixes the
> command form. The rest — the most-recent default, and selection from the CLI and a slash command —
> is unchanged.

---

## 6d. Packs, session names, abandoned procedures

### Pack discovery — a curated list, and import is a copy

`docs/TEMPLATES.md` lists known packs with a link and an author. **There is no re-fetch, no update
channel and no version check over the network.** Updating means importing again; the collision
report already shows what changed in three buckets and nothing applies unconfirmed.

This is the answer that fits a product making **no network requests at all** — loopback-only, no
telemetry anywhere. A registry was rejected on the research's strongest evidence: the May 2026
@antv compromise shipped 639 malicious versions that **passed** npm provenance verification with
forged attestations, so centralisation did not prevent the thing a registry is supposed to prevent.

### Session names — mycontext owns them

A command names an **explicitly identified** session — `mycontext session name <id> <name>`, with
`mycontext session list` to find the id (§6m.8; §6g states the form and why the id must be
explicit). Sessions never named keep their id and short prefix exactly as today. Nothing is derived
on the user's behalf, because a derived name can be wrong and naming is precisely the moment you
know what a session is for.

**Checked, and it changes the design.** The owner expected Claude Code's own session naming could be
read instead. On 2.1.234 **no session name is visible anywhere a hook could reach**: not in the
transcript JSONL (the only `name` keys are tool names), not in a sidecar file, not in
`~/.claude/config.json`, and `claude --help` exposes no naming flag. The capability may exist in the
app with the name stored somewhere not found here — so mycontext owns the name, and reads Claude
Code's if a later probe locates one.

**Not UI-dependent.** Naming and selecting a session are available from the **CLI and a slash
command**. The web UI is wave 1 of three and this must work without it.

> **CORRECTED 2026-08-19, by the hooks survey.** This subsection originally read *"a command names
> the **current** session"*. It cannot: §6j found that **no CLI surface has a trustworthy session
> id**, and `src/core/focus.ts` · `What focus is scoped to: the WORKSPACE, not the session` · ~21 records the codebase hitting exactly this and conceding it —
> escaping to **workspace** scope, an escape a session name cannot take, because distinguishing one
> session from another *within* a workspace is the whole point of the name. §6m.8 rules the
> explicit-id form stated above. Everything else here stands and is what the finding leaves intact:
> mycontext owns the name, nothing is derived, and an unnamed session keeps its id and short prefix.

### An abandoned `procedure` is `superseded`

The existing status already means exactly this: no longer governs; file, body, observations and
relations all kept; still searchable; rendered by every screen that exists. And `supersede --by`
lets an abandoned procedure point at whatever overtook it. **No fifth state, no new command, no new
rendering.**

---

## 6e. R10's pinned item, and one hook dropped

### `PostCompact` — dropped, on evidence from this project's own audit log

The research recommended it to *"restore sooner than the next tool call"*. **The restore already
happens at that moment**, and mycontext's own dogfooded audit log proves it across two real
compactions:

```
2026-08-17T14:47:02Z  hook       op: pre-compact      PreCompact    3 from the seen file, 5 cited, 5 captured
2026-08-17T14:49:12Z  injection  op: compact-restore  SessionStart  source=compact
2026-08-18T14:35:56Z  hook       op: pre-compact      PreCompact    3 from the seen file, 6 cited, 6 captured
2026-08-18T14:37:55Z  injection  op: compact-restore  SessionStart  source=compact
```

`PreCompact` captures; `SessionStart` fires with `source=compact` about two minutes later — the
compaction itself — and performs the restore. **A second mechanism for a working one is a second
spelling.** Dropped. Two hooks remain in scope: handling `source === 'clear'`, and
`PostToolUseFailure`.

**Method note.** This was settled by reading the product's own history rather than by probing. That
should be the first move whenever a claim concerns behaviour the product already records — it is
cheaper than a probe and it is evidence from production rather than from a scratch directory.

### The pinned item — R10's content, drafted

R10 asked for *"a predefined rule or category that instructs the model to use mycontext … always in
context memory so it will not forget"*. The pinned tier is that mechanism. This is the text, and
it carries **both** halves the owner asked for: provenance, so it is legible rather than suspicious,
and an explicit directive to read and act on what is pinned.

> **This project keeps its knowledge in my_context.**
>
> The items delivered with this block are this project's recorded knowledge — its constraints,
> standards, decisions, invariants, rules and known issues. They were written by people working on
> this project and reviewed before they were allowed to govern.
>
> **Read every pinned item you are given and act on them. They are your guides for this entire
> project, not background.** Where one of them applies to what you are doing, it decides the
> question — you do not need to re-derive it, and you should not contradict it without saying so.
>
> Beyond the pinned items there is more: an index of what exists, and items that arrive when you
> touch the files they govern. If the index names something relevant, ask for it.
>
> **When you establish something that should outlive this session** — a constraint you discovered,
> a decision that was taken, a lesson from something that went wrong — record it in my_context so
> the next session begins already knowing it.

**Why the framing paragraph is not decoration.** Measured in probe P3: a bare imperative injected
into a subagent caused it to report the injection to its parent as a possible out-of-band attack —
correct behaviour on the model's part. An instruction that arrives with no account of where it came
from is indistinguishable from an injection attack, and the account is what makes it legible.

**It competes for budget on every session**, against real constraints, in the 6,000-token pinned
tier. That is the cost, and it is the reason the text is as short as it is.

---

## 6f. R12 integrations, and two overlaps — decided 2026-08-19

Both research reports are in (`reports/uiux/research/R6-ecosystem-tools.md`, `R7-data-infra.md`).
The owner has now ruled on all four items below. **R7 produced 23 rejections and one adoption — and
§6m.6 has since withdrawn the adoption too**, so the rejections are the whole of R7's yield. They
are load-bearing: they are the reason this product stays a directory of Markdown files with no
daemon.

### Full-text recall — **FTS5 is NOT adopted. The defect is field coverage.**

> **CORRECTED 2026-08-19, by the conflict scan.** This subsection originally **adopted FTS5**,
> scoped behind `search` and `query_items` and conditional on a recall-parity test. §6m.6 withdrew
> that adoption on the evidence of §6l F5, and the three reasons it fell are recorded below in place
> of the argument they falsified. **The recall problem is real; the mechanism was the wrong size.**
> The PostgreSQL and vector-search rejections that follow are untouched by this and stand as
> written.

**The defect is stated first, because it is the part that survived.** `search "silently drop"`
returns nothing today while the corpus says "dropped silently". That is a recall failure and it
still has to be fixed.

**Why FTS5 is not the fix — three reasons, each fatal on its own:**

1. **It amends the one decision it claimed to protect.** The original argument was that
   `core/search.ts`'s recorded decision against **ranking** stood unamended because `select()` was
   untouched. That decision's subject is not `select()`. Verbatim, `src/core/search.ts` · `The corpus filter behind BOTH` · ~7: *"The
   corpus filter behind **BOTH** `query_items` (the model's tool) and `mycontext search` (the
   user's command)."* Those are **exactly the two surfaces FTS5 was to sit behind**, so the
   protective clause guarded a module the decision never governed and left the only module it did.
2. **The motivating query missed on field coverage, not tokenisation.** The predicate **was**
   `` `${item.title}\n${item.body}` `` — title and body only, verified — while the phrase sat inside
   an `## Observations` section. The corpus always contained it. **FTS5 over title and body would
   have reproduced the miss exactly**, so the swap bought nothing on the example that motivated it.
   **The one-line widening under "Taken instead" below shipped 2026-08-19** and this reason is now
   the code's own: `searchableText` joins title, body, every observation's text and context, and
   every `extra` value (`src/core/search.ts` · `function searchableText(item: Item): string {` · ~60), and its docblock records exactly this argument.
3. **The parity condition is unmeetable by a swap.** *"FTS5 returns a superset of what substring
   matching returns"* cannot hold: `search "ilently"` matches `String.includes` and matches no
   tokeniser. Only a **union** of both predicates satisfies it, and a union must decide ordering —
   which is the ranking question again, and by reason 1 that recorded decision governs precisely
   these two surfaces.

**The measurement pointed the same way and was filed as a warning rather than read as evidence.** A
naive FTS5 swap makes recall *worse* — `inject` goes from **14 hits to 1** — because tokenisation
splits on the boundaries a substring match spans. That is what the parity test was there to catch;
not taking a change whose own measurement says it regresses is cheaper than testing for it.

**Taken instead, in order:**

1. **Extend the `text` predicate to `observations` and `extra` — shipped 2026-08-19.** **One line**, no new machinery,
   nothing to rebuild, and it fixes the cited example — because the phrase was always in the
   corpus, just not in the fields being read.
2. **Then, only if word-order-insensitive matching is still wanted, an AND-of-terms substring
   predicate.** It is a superset of today's predicate **by construction**, so it needs no index, no
   ranking and no parity test to be safe; it cannot regress; and it keeps working through the
   Markdown fallback path, where FTS5 could not.

**What FTS5's best argument was, and why it is moot.** `node:sqlite` on Node 24.14.0 (SQLite
3.51.2) does ship `ENABLE_FTS5` with a working `bm25()`, and a rebuild measured at **7 ms for 500
items** — so it would have cost **no dependency**. That is a measured fact and is kept as one. It is
simply not spent: the replacement costs less than no dependency, because it adds no index at all.

**Rejected, and worth recording as rejected:** PostgreSQL, and semantic/vector search in every
engine surveyed.

- **PostgreSQL — and note it is *not* a latency argument.** Loopback TCP measured **0.42 ms p50**
  against **1.71 ms** to open SQLite and run a point query, so Postgres is *faster* on that axis.
  The case against it is a **runtime dependency plus a daemon**, bought to solve concurrency WAL
  already solves and sharing git already does *with review*, at a scale a **65 KB corpus** will
  never reach.
- **Semantic/vector search.** Retrieval here is bounded by the **1,200-token index budget (~47
  items)**, not by matching quality. The whole active normative corpus is **25 items, 7,584
  tokens** — it can simply be shown in full. Better matching solves a problem this product does
  not have.

**Free and worth documenting:** both SQLite files are already readable by Datasette, DuckDB and
Metabase with nothing built. Document that, and say **"disposable"** in the same sentence — the
index is a projection of the Markdown, per `INV-markdown-is-the-source-of-truth`.

### GSD and Graphify — **compose by convention, zero code**

An interop document, and nothing shipped.

- **GSD.** Its `CONTEXT.md` template makes `<canonical_refs>` **mandatory** and instructs
  downstream agents they MUST read those before planning. That is a pre-built slot: putting
  mycontext item paths in it reaches GSD's 33 subagents for free.
- **Graphify.** **One-directional — mycontext emits, graphify renders, and graphify must never
  extract *from* `.my_context/`.** Their relation vocabularies share **zero** names: mycontext's 8
  are normative and *authored*; graphify's 8 are structural and *inferred* with confidence tiers.
  Not a duplicate — a viewer.

**No emitter command.** A shipped command producing another project's node/edge format couples us
to a format that is not ours to keep stable. Revisit only if someone asks.

### `compound-engineering` — watched, not imported

Installed (v2.13.0, `every-marketplace`); writes durable learnings to `docs/solutions/` with YAML
frontmatter. That is **`lesson` in a second spelling, with no shared ids** — verified.

**Decision: `init` includes `docs/solutions/**` in the concrete `watchedDocs` list it writes**, when
the directory exists. `DEFAULT_WATCHED_DOCS` is **not** broadened, and a list the user already wrote
is **never** merged into — this is the same single ruling as the `watchedDocs` subsection below, and
it is stated there once with its sequencing. The `PostToolUse` nudge then fires when a learning is
written there and **a human decides** whether to capture it. This uses machinery already shipped,
respects the trust boundary, and `ingest_document` already covers the one-off import. **No importer** — one would bind us to another plugin's frontmatter schema for no gain.

### `watchedDocs` — detect at init, warn in doctor

**The defect, verified twice:** the shipped defaults are `docs/superpowers/specs/**`,
`docs/superpowers/plans/**` and `docs/prd/**` — three paths specific to one workflow. On a typical
repository **zero documents match**, so the capture nudge never fires and the user never learns the
feature exists.

**Not a defect, and not being changed:** the list **replaces** rather than merges. An explicit list
the user wrote must not silently gain globs they did not write. `requireWatchedDocs` already refuses
a non-array rather than falling back to the defaults, for exactly that reason, and its comment
records why: the user's setting would be *"not merely narrowed but inverted"*.

**The fix, in two existing commands:**

1. **`init`** inspects what documentation directories the repository actually has and writes a
   concrete `watchedDocs` list into `config.json` — visible, editable, no magic, and no behaviour
   that depends on a glob the user cannot see.
2. **`doctor`** reports when **zero files match any watched glob**, so a list that goes stale as a
   repository is reorganised is caught later too.

**One meaning, and one order.** The three rulings this section makes about `watchedDocs` are one
rule seen three times: **`init` writes a concrete list**; that list **includes `docs/solutions/**`
when the directory exists**; and `DEFAULT_WATCHED_DOCS` is not broadened while a user's own list is
never merged into. **Sequencing, so that "whichever runs second silently wins" cannot happen:**
`init --pack` applies the pack's config **first**, then `init` writes `watchedDocs`. There is
nothing of the pack's to overwrite — under §6m.4 a pack may not carry `watchedDocs` at all — so the
order is safe as well as stated, and it is testable.

Broadening the shipped defaults to `docs/**` was rejected: `09-workflows.md` already observed that
nobody reads the nudges, and more of them makes that worse rather than better.

> **CORRECTED 2026-08-19, by the conflict scan.** §6l F10 found three `watchedDocs` rulings in this
> section, unsequenced, and one of them phrased so it contradicts the other two: the
> `compound-engineering` subsection above said *"add `docs/solutions/**` to the watched globs"*,
> which reads as broadening the shipped defaults or merging into the user's list — the two things
> this subsection refuses. The controller ruling recorded in §6m gives the single meaning and the
> `init --pack`-then-`init` order, both now stated above, and the `compound-engineering` wording is
> corrected to match. The measured defect, the refusal to merge and the `doctor` check are
> unchanged. The FTS5 correction at the head of this section is earlier and separate.

---

## 6g. Step progress, continuity surfaces, session names, home stores — decided 2026-08-19

> **CORRECTED 2026-08-19, by the hooks survey and the conflict scan.** Two of this section's
> rulings are restated below, where they were withdrawn or left incomplete. **§6m.8 — session
> naming takes an explicit id.** *"`mycontext session name <name>` renames the **current**
> session"* is not implementable: **no CLI surface has a trustworthy session id**, which
> `src/core/focus.ts` · `What focus is scoped to: the WORKSPACE, not the session` · ~21 records the codebase already hitting and conceding, and which §6j sets
> out in full. The form is now `session name <id> <name>` with `session list` to find the id, and
> the slash command supplies the id because it arrives as a prompt and therefore reaches a hook that
> carries one. **§6m.11 — carried index lines have a budget.** §6l F13 found that neither this
> section nor §6c said which; carried lines now deduplicate against the new session's own index and
> then queue inside the same `budgets.index`. The two `CORRECTED` notes inside the step-progress
> subsection below are earlier and stand as written.

### `procedure` step progress — checkboxes are representation; progress is session state

This closes the last of §2.3. **Representation was already settled**: an ordered list in a
`## Steps` section, parsed the way `## Observations` already is. No second spelling.

> **CORRECTED 2026-08-19, by implementation survey.** This paragraph originally ended "no
> data-model change", and that was **false**. `validateBody` refuses any line matching
> `/^#{1,6}\s/` inside a body (`src/core/validate.ts` · `export function validateBody(body: string): void {` · ~234), so a `## Steps` section
> cannot live in `body` at all — it must be a first-class `Item` field, exactly as `observations`
> is. The parallel to `## Observations` holds; the inference drawn from it did not. See §6i.

> **CORRECTED 2026-08-19, by the conflict scan.** This subsection originally gave
> `mycontext procedure step` a **write path into the item file** — flipping a single checkbox matched
> by a strict regex, exempted from the draft gate on the distinction that a checkbox is progress
> rather than content. §6m.3 withdrew that write path: **progress lives in session state or the
> audit log, never in the item.** The checkbox survives as *display*; what changed is where progress
> is **stored**. See §6l F4, and §6i.4, which reached the same place from the type system.

**The steps are immutable Markdown.** A `## Steps` field holds GitHub-flavoured checkbox lines —
`- [ ]` — authored once with the procedure and never rewritten by the tool. They are the knowledge:
what to do, in what order.

**Progress is recorded outside the item.** `mycontext procedure step` writes *"step 3 of `PROC-x`
done"* into **session state or the audit log**, and nothing else. "Step 3 of 5" is still computed by
counting and still never stored as a number — it is now counted from that record rather than from
bytes in the corpus. A ticked box in a listing is **rendered**, by laying the session's progress
over the stored list at display time; the file on disk does not move.

**What that buys, stated plainly, because it is the whole reason the write path was withdrawn:**

- **`UPDATE_FIELD_POLICY` is untouched.** `FieldPolicy` stays `'content' | 'gated'`, and the four
  `Assert<>` types that pin both classes in both directions keep their compile-time guarantee
  (`src/core/trust.ts` · `export const UPDATE_FIELD_POLICY = {` · ~453). The original "third thing — progress, neither content nor gated"
  compiled to neither, which §6i.4 recorded; there is now no third thing to express.
- **`checksum` never moves on a tick**, so `doctor` never reddens because somebody made progress —
  and `INV-markdown-is-the-source-of-truth` stays honest, because progress is not knowledge and
  never enters the corpus.
- **The command no longer writes into `items/` at all**, so **the "first hole in the boundary" §6l
  F4 identified does not open.** There is no narrow exemption to police, because there is no
  exemption: the gate that stops an agent changing normative content is never asked to make the
  distinction.

**What is NOT relaxed:** the item's state. `active → done` remains human-only, per §2.2, for the
reason recorded there — an agent that can mark its own procedure done can declare victory. Recording
the last step does not close the procedure; it lets the agent *ask*. That was true when the tick lived
in the file, and it is true now that it does not.

### Cross-session continuity — the same provenance in both surfaces

A line naming the source session and the count — *"12 index lines carried from session
`auth-refactor`"* — plus a per-item **carried** marker in listings. **The CLI and the UI show the
same information.**

**What is carried, and out of whose budget.** Carried lines **deduplicate against the new session's
own index first** — only what that index would not already show is carried at all — and what remains
queues inside the **same `budgets.index`**, spilling and disclosing exactly as any other index line
does. No fifth budget, no new config key. That is also what makes the disclosure line above honest:
the count it names is the count that actually arrived, after the dedupe and after any spill, rather
than the count somebody hoped to send.

Two reasons, and the second is the load-bearing one. `INV-nothing-is-dropped-silently` was written
about omissions, but **its spirit covers additions**: knowledge arriving from somewhere the user
cannot see is the same defect pointed the other way. And the owner has twice required that a
capability not depend on the UI — making the UI the only place that can answer *"why is this here"*
would reintroduce that dependency through the back door.

### Session names — optional, with an auto fallback

- **`mycontext session name <id> <name>`** names an explicitly chosen session, and
  **`mycontext session list`** is how you find the id. The CLI never guesses which session it is in,
  because it cannot: no CLI surface is handed a trustworthy session id (§6j), and the one escape the
  codebase has used before — retreating to workspace scope — is closed here, since telling one
  session from another within a workspace is the entire point of a session name. The cost is a
  lookup, and it is paid in exchange for never being silently wrong.
- **A slash command mirrors both, and supplies the id itself.** A slash command arrives as a prompt
  and therefore reaches a hook, and the hook *does* carry `session_id` — so the convenient form is
  correct by construction rather than by guessing. Together the two satisfy the standing requirement
  that session selection work without the UI, without either surface ever having to infer which
  session it is in.
- **A name is never required.** An unnamed session keeps **its id and short prefix, exactly as
  today** — per §6d, which rejected deriving a name on the user’s behalf on the grounds that a
  derived name can be wrong and naming is precisely the moment you know what a session is for.
  **Nothing is invented for an unnamed session.**

**Why the fallback is the short prefix and not a nullable name:** the continuity selector decided
above has to *display* something for every session, including one nobody named. The short prefix is
a poor label and an honest one — it says only what is known. That is the whole of "optional" here:
an identifier always exists, and it never pretends to a meaning it does not have.

mycontext owns the names either way (§6d) — a caller cannot assert one.

### `~/.gsd/knowledge/` — reported, bounded, never read

`doctor` reports when both it and `~/.my-context` exist, so a user running both learns it from the
tool rather than from a surprise months later. The interop document states the boundary plainly:
**mycontext never reads or writes `~/.gsd/`.**

That is the **same one-directional rule as graphify**, for the same reason — knowledge this product
did not verify does not enter the corpus. An import path was rejected specifically because it would
bind us to another project's on-disk layout inside the user's home directory, which is the least
stable thing available to depend on.

---

## 6h. R13 — what a pack is. Decided 2026-08-19, and R13 is now closed.

§6c decided the transport (portable directory or archive, author-supplied descriptive version,
full SHA-256 manifest) and §6d decided discovery (a curated `docs/TEMPLATES.md`, no registry, no
re-fetch). This decides what the artefact contains, who may trust it, and how it is made and taken.

> **CORRECTED 2026-08-19, by the conflict scan.** Two rulings in this section were withdrawn and
> one gap was closed; the subsections below are rewritten to state what now holds.
> **§6m.5 — the trust split is gone.**
> This section originally landed a pack **active at `init`** into an empty corpus and `draft` on
> every later import; `trustedStatus` refuses that exemption on purpose
> (`src/core/trust.ts` · `export function trustedStatus(origin: Origin, tier: Tier, requested: Status): Status {` · ~267), and §6 had already ruled universally that *"every imported
> normative item lands `draft` … regardless of any signature"*. **Everything imported lands
> `draft`**, and `review promote --all --pack <name>` behind one confirmation is what makes that
> bearable. **§6m.4 — a pack may not carry the trust boundary.** The contents rule below said a pack
> carries "the category configuration (which is what `profile` selects)" and inherited §6's
> replace-not-merge; a pack may now carry neither `tier` nor `agentEdits`, and its config **merges
> field-wise**. See §6l F1 and F2, and §6k. **§6m.12 — the gap, not a withdrawal.** A pack may
> enable a category, and until §6m.12 **no slash command could ever exist for one** (§6l F15): the
> `commands/*.md` files are generated at build time from the plugin's own defaults and committed.
> The generic `/mycontext:add` is stated in the contents rule below.

### Contents — knowledge and vocabulary, nothing about the importer's machine

**In:** `items/**`, and the parts of the `categories` block that describe the **domain** — which
categories are **enabled**, and their `prefix` and `scopePolicy`.

**Out:** `budgets` and `watchedDocs`.

**Refused outright, with an error naming them:** `tier` and `agentEdits`.

**Why a refusal and not a warning — this is the security half.** The original parenthetical, "the
category configuration (which is what `profile` selects)", was wrong. `profile` selects only which
categories are *enabled* (`config.ts` · `const enabledByProfile = new Set(PROFILES[profile]);` · ~657, read at `config.ts` · `enabled: enabledByProfile.has(def.name),` · ~677); the `categories` block **also** carries `tier` and
`agentEdits`, and a `tier` override drags `agentEdits` with it (`config.ts` · `} else if (override.tier !== undefined) {` · ~788). A pack
shipping `"rule": {"tier": "rationale"}` would land every future agent-authored `rule` **active**
instead of draft *and* stop every existing `rule` being injected at all — **strictly more power than
the `--trust` flag this section refuses, delivered through the surface this section called safe.** A
`tier` override is that same power with a longer name and no prompt.

**And a pack's config MERGES field-wise; it does not replace.** §6's "config replaces, it does not
merge" was written for a whole-workspace R6 export, where it is correct and **applies there still**.
This section inherited it from a case it does not fit: a pack config with `budgets` and
`watchedDocs` stripped — which this section *requires* — would **reset both to product defaults** on
import (`config.ts` · `if (raw === undefined) return { ...DEFAULT_BUDGETS };` · ~537 and `config.ts` · `if (raw === undefined) return [...DEFAULT_WATCHED_DOCS];` · ~583), doing precisely what the next paragraph forbids, through the mechanism
chosen to prevent it. A field-wise merge leaves the importer's `budgets` and `watchedDocs` untouched
by an import.

**The line, stated once so it settles future arguments:** *a pack may carry what its author knows
about the **domain**; it may not carry settings that describe the **importer** — their context
window or their repository layout — because the author cannot see either.* A budget is the one
number a user tunes for their own session; a pack that silently changed how much context mycontext
spends would be doing something the user did not ask a template to do. **Nor may it carry the
boundary it is imported under** — the same principle, applied to trust instead of to budget.

**What a pack carries must also be usable, and one thing was not: a category it enables had no
command surface.** The `commands/*.md` slash commands are generated at build time from the plugin's
**own** defaults and committed, so a pack-defined category arrived complete — items, `prefix`,
`scopePolicy` — with no way to add one from a slash command, which is most of what makes a
vocabulary usable. §6m.12 rules a single generic **`/mycontext:add <category> …`** accepting any
category the resolved config knows. Nothing is generated at install time, the committed command
files and their CI parity test are untouched, and a disabled category fails in one place with a real
message. This is the one thing this section gained rather than lost.

### Trust — **everything imported lands `draft`**, on both surfaces

The existing boundary has two cases (a human authors; an agent authors and lands a draft). **A pack
looked like a third case it was not written for.** It is not. It is the second case, and the rule
that already shipped covers it:

- **At `init`, into an empty corpus: `draft`.** Choosing the pack is an act of trust, but it is one
  taken **before** there is anything to look at. Nothing is lost by re-taking it a moment later,
  with the corpus visible.
- **Importing into an existing corpus: `draft`.** A stranger's opinion is joining knowledge you
  already verified. It waits for a human, exactly as agent-authored normative content does.

**One rule, and it is the one already in the code.** `trustedStatus` unconditionally demotes every
non-human origin on a normative category, with no parameter, no flag and no caller-supplied
override. There is nothing to build: no `origin: 'import'` to add to a closed `Origin`, and no
exception inside the function whose whole value is having none.

**The honest cost that once bought active-at-`init` is real, and is kept:** a 40-item pack produces
a 40-item review queue on an empty project, and a queue that size is **bulk-approved unread** —
which is a worse outcome than no gate, not a better one. **What that argument supports is making
bulk review tractable, not skipping the gate.**

**So: `mycontext review promote --all --pack <name>`, behind one confirmation.** That is the same
single human act as choosing the pack, taken **after** the corpus is visible rather than before —
and the reviewer who wants to read all 40 still can, because the queue exists to be read.

**Gating on the manifest was rejected as theatre:** a checksum a pack carries *about itself* proves
the files arrived intact, not that the author is trustworthy. It is transit integrity, and it must
never be described as anything more.

**No `--trust` flag.** A boundary that can be overridden by a flag is overridden by that flag every
time, and then it is not a boundary. That sentence now does two jobs: it refuses the flag, and under
§6m.4 it refuses a pack-supplied `tier` for the same reason.

### Authoring — a flag on the export command, not a second implementation

**`mycontext export --as-pack`.** A pack *is* an R6 export with the per-machine parts stripped and a
manifest added; the serialiser, the format ladder (directory / `git bundle` / deterministic ZIP)
and the rules about what does not travel are all already decided there.

This document records that a second spelling of one concept is **"the defect class this project has
paid for four times"**. A separate packer would be the fifth.

### Import — a flag on `init`, a command afterwards

- **`mycontext init --pack <path>`** — the owner's stated requirement, and the surface a pack is
  usually first taken through.
- **`mycontext pack import <path>`** — every later import, including re-importing a newer version
  of a pack already taken, which §6d established is the only update mechanism there is.

**One implementation behind both — and now one trust rule behind both.** Everything lands `draft`
either way, and `review promote --all --pack <name>` is available at either surface. The two
surfaces exist because two *moments* exist — founding a corpus, and adding to one — not because they
are governed differently; the split that was once the point is withdrawn (§6m.5). The three-bucket
collision report already decides what applies on re-import, and nothing applies unconfirmed.

---

## 6i. Corrections from the implementation survey — 2026-08-19

The category survey (`.superpowers/sdd/2026-08-19-v2-scope-decisions/survey-categories.md`) mapped
what the **code** requires to deliver §1, §2 and §6g. It found four places where a decision assumed
something the codebase does not provide. **None of the four reverses a decision the owner took** —
each corrects a claim the assistant made in arguing for one, which is a different thing and is
recorded here rather than quietly amended.

**Scale, for planning:** 31 files must change (28 existing, plus 6 generated `commands/*.md`), 8 of
them high-risk. `todo` and `note` are nearly free — the rationale tier already delivers
never-injected, never-indexed and no draft gate through `isNormative` (`src/core/select.ts` · `function isNormative(item: Item, config: Config): boolean {` · ~204).
**Their real cost is 22 hand-typed enumeration sites**, which is the "half-added category" hazard,
not the engine.

### 1. `## Steps` cannot live in the body — CORRECTED in §6g above

`validateBody` refuses any heading line (`src/core/validate.ts` · `export function validateBody(body: string): void {` · ~234), so steps must be a
first-class `Item` field. That touches parse, render, `computeItemChecksum`, `itemContentHash`,
`renderItemBlock` (which is budget-correctness, so getting it wrong mis-sizes injection), the MCP
schema and ingest. `splitSections` is already generic and SQLite needs no DDL — `data` is a JSON
`TEXT` column.

**§6g's "no data-model change" was wrong and is struck above.** The decision stands; its stated
cost was understated.

### 2. `ready` has no home in the status vocabulary

`isEligible` admits exactly `'active'` (`src/core/select.ts` · `export function isEligible(item: Item, config: Config): boolean {` · ~198); everything else is `draft` or a
retired status. §2.1's four procedure states therefore need a mapping rather than four new statuses.

| §2.1 state | Maps to | Note |
|---|---|---|
| `proposed` | `draft` | already means "written, not governing" |
| `ready` | **no clean home** | see below |
| `active` | `active` | |
| `done` | `deprecated` | **not `validated`** — `governsNormatively` treats `validated` as still governing, so a completed procedure would keep governing |

**Ruling:** `done → deprecated`, on the survey's evidence. Cost if wrong: a completed procedure is
listed among deprecated items rather than under a status of its own — cosmetic, and reversible.

**`ready` is left open**, because it is the same question as §6i.3 and should be answered once.

### 3. The full-text / index-line split has never been per-item

It is a **category** lookup — `isNormative(item, config)` (`src/core/select.ts` · `function isNormative(item: Item, config: Config): boolean {` · ~204), applied by `select()` for the full-text half (`src/core/select.ts` · `const injectable = eligible.filter((i) => isNormative(i, config));` · ~780) and by `buildIndex` for the index half (`src/core/select.ts` · `.filter((i) => isNormative(i, config) && !chosenIds.has(i.id))` · ~522).
`always`, `scope` and `severity` modulate *tier membership*; none of them has ever modulated that
split. §2.1's "index line only when `ready`, full text when `active`" would be **the first per-item
case**, and `select()` documents itself as the one place that rule may live.

**Not ruled on.** This is the substantive design question left in `procedure`, and it is worth
deciding deliberately rather than inside a fix loop: either `select()` gains a per-item injection
mode, or `ready` is dropped and a procedure is simply not injected until it is `active`.

### 4. `mycontext procedure step` does not fit the field policy

`UPDATE_FIELD_POLICY` (`src/core/trust.ts` · `export const UPDATE_FIELD_POLICY = {` · ~453) types every updatable field as
`'content' | 'gated'`, with `satisfies Record<…>` and four `Assert<>` types pinning both classes in
both directions. **§6g's third thing — "progress, neither content nor gated" — compiles to
neither.** Two honest routes: a third policy member with new assertions, or a write path outside
`updateItem` entirely, for which `observations` (create-only) is the existing precedent.

**Not ruled on.** The decision that a checkbox is not content stands; how it is expressed in the
type system is an implementation choice the plan should make with the code in front of it.

### 5. `RELATION_TYPES` is closed, and §1.3 needs a relation

Promotion "with a link back" (§1.3) needs a relation type. `RELATION_TYPES`
(`src/core/vocabulary.ts` · `export const RELATION_TYPES = [` · ~42) is a closed vocabulary and **`derived_from` is the only honest
fit**. **Ruling:** use `derived_from` rather than adding a ninth relation. Cost if wrong: a
promoted `todo` reads as "derived from" its origin rather than "promoted from" — accurate, if less
specific, and adding a relation type later is cheaper than removing one.

---

## 6j. Hooks and sessions — what the survey found. 2026-08-19

Source: `.superpowers/sdd/2026-08-19-v2-scope-decisions/survey-hooks-sessions.md`. Three findings
help; one **contradicts a decision** and goes back to the owner.

### ⚠️ `mycontext session name <name>` cannot know which session is current

**This is not a difficulty. It is a thing the codebase already tried, measured and conceded.**

`src/core/focus.ts` · `What focus is scoped to: the WORKSPACE, not the session` · ~21 records the same problem being hit before: **no surface that can *set*
state has a trustworthy session id.** The CLI is handed none. The MCP server's
`CLAUDE_CODE_SESSION_ID` is a *different id* on a resumed session — probe-verified at the time — and
is read nowhere in `src/` today. Focus escaped by retreating to **workspace** scope.

**A session name cannot take that escape**, because the whole point of the name is to distinguish
one session from another within a workspace.

So §6g's *"`mycontext session name <name>` renames the current session"* is, as written, not
implementable: the command cannot identify its own session. **Not ruled on** — the owner decided
this surface, and the options change what they decided:

1. **Name an explicitly chosen session** — `mycontext session name <id> <name>`, with `session list`
   to find the id. Always correct, never guesses, and costs the user a lookup.
2. **Name the most recently active session**, derived from the audit projection. Convenient and
   usually right; **wrong exactly when two terminals are open on one workspace**, which is the
   concurrency case R7 exists to serve.
3. **Name from the hook side only** — the slash command, which arrives as a prompt and therefore
   reaches a hook that *does* receive `session_id`. Correct by construction, but it makes naming
   UI/agent-mediated, which cuts against "must work from the CLI".

Recommendation: **(1) with (3) layered on** — the CLI takes an explicit id and is always right; the
slash command supplies the current id automatically because the hook knows it. Together they satisfy
"not UI-dependent" without ever guessing.

### ✅ Session enumeration is already shipped — §6c and §6d are cheaper than assumed

Three implementations already exist: `sessions(db, limit)` over the projection's generated
`session_id` column (`audit-db.ts` · `export function sessions(db: DatabaseSync, limit: number): SummaryRow[] {` · ~794), `sessionsWithoutDb` from raw JSONL (`commands/audit.ts` · `function sessionsWithoutDb(list: AuditRecord[]): SummaryRow[] {` · ~492), and
`recentSessions` (`ledger.ts` · `recentSessions(limit: number): string[] {` · ~487). **`mycontext audit --sessions` already prints the list today.**
"What that session had" is equally derivable — `itemsUsedIn` (`ledger.ts` · `itemsUsedIn(sessionIds: string[]): string[] {` · ~538).

So cross-session continuity needs a *selector and a carry*, not a new store.

### ⚠️ There is effectively no hook timeout, and `SubagentStart` blocks

The only in-process timer in the hook layer is `post-tool-use.ts` · `const timer = setTimeout(() => process.exit(0), 2000);` · ~132,
with `unref()` on the line below it. SessionStart, PreToolUse and PreCompact
each carry an explicit comment saying they deliberately have none — `readStdin`'s
`readFileSync(0, 'utf8')` (`io.ts` · `return readFileSync(0, 'utf8');` · ~69) blocks the thread outright, so no timer can preempt it. The only real
bound is `"timeout": 10` declared in `hooks.json`, which is **Claude Code killing the process**, not
mycontext failing open.

Set beside the measured fact that a 3,018 ms `SubagentStart` hook delayed the subagent's first tool
call by that much: **taking `SubagentStart` puts an unbounded-by-us hook on the critical path of
every subagent dispatch.** `INV-hooks-fail-open` is satisfied by the external kill, not by anything
mycontext does. The plan must say so explicitly rather than implying the invariant covers it.

### ⚠️ Seen files accumulate, and the unit is context windows

`pruneSnapshots` (`ledger.ts` · `export function pruneSnapshots(` · ~770) is age-based — 30 days by mtime — and when this was written its **only production
caller was `cmdRebuild`** (`cli/index.ts` · `function cmdRebuild(ws: Workspace, out: Emit): number {` · ~1001), with no hook pruning and no `clearSeen` anywhere.
**Both halves have since closed.** A hook prunes: `SessionStart` sweeps `state/` once per session, after the write to stdout (`hooks/session-start.ts` · `function sweepStaleState(cwd: string): void {` · ~64) — its docblock carries this finding's own measurement, "15 files one day and 47 the next". And `clearSeen` exists (`core/seen-file.ts` · `export function clearSeen(root: string, sessionId: string): ClearSeenReport {` · ~290), so pruning is no longer age-only.
There is still no `SessionEnd` hook, and a project whose sessions never start still never prunes.

Measured in this repository right now: **15 `.seen.jsonl` files for a single session id** — one
parent plus fourteen subagent files — over roughly two days, invisible to git because
`writeSnapshot` drops a `.gitignore` of `*` beside them.

Two consequences for decided work: handling `source === 'clear'` needs a defined answer for the
`session::agent` sibling files, since a per-session clear misses them; and whether `/clear` even
preserves `session_id` **is recorded nowhere and is unprobed**.

### Implementation note that will bite if missed

`parseAudit` (`core/audit.ts` · `export function parseAudit(raw: string, file: string): AuditRecord[] {` · ~606) **refuses unregistered ops**. Any new hook op must be added to
`HOOK_OPS` / `INJECTION_OPS` *and* `KIND_OF`, or the audit log rejects its own records — a failure
that would look like the hook silently not running.

---

## 6k. Export, import and packs — what the survey found. 2026-08-19

Source: `.superpowers/sdd/2026-08-19-v2-scope-decisions/survey-export-packs.md`. Two decisions are
**cheaper** than assumed, one is **blocked by code**, and one part of §5 is **wrong as written**.

### ⚠️ Active-at-`init` is blocked by the trust layer, and it is blocked deliberately

`trustedStatus` (`src/core/trust.ts` · `export function trustedStatus(origin: Origin, tier: Tier, requested: Status): Status {` · ~267) **unconditionally demotes every non-human origin on a
normative category**. There is no parameter, no flag and no caller-supplied override.

That is convenient in one direction and fatal in the other:

- **§6h's draft-on-later-import comes free.** Nothing to build.
- **§6h's active-at-`init` cannot be expressed.** And §6h itself forbids the obvious escape: *"There
  is no `--trust` flag; a boundary a flag can override is not a boundary."*

`origin: 'import'` does not exist either — `Origin` is closed (`src/core/types.ts` · `export type Origin = 'human' | 'agent' | 'ingest';` · ~4) and enforced by
two separate `ORIGINS` lists when this was written — **three since**: the pack history reader added
a `Record<Origin, true>` of its own (`pack/history.ts` · `const ORIGINS: Record<Origin, true> = { human: true, agent: true, ingest: true };` · ~217) rather than export either array, and says so in
its docblock. The closure is unchanged; only the count of places enforcing it moved.

**Not ruled on.** Three routes, and the owner picked the trust split so the owner should pick among
them:

1. **Drop active-at-`init`.** Everything imported is a draft, always. The argument that killed
   draft-always — a 40-item review queue gets bulk-approved unread — still applies, but it applies to
   a queue on a corpus the user just chose deliberately.
2. **`init --pack` writes items with `origin: 'human'`**, on the reasoning that the human ran `init`
   and named the pack. Honest-ish, and it makes `origin` mean "who caused this" rather than "who
   wrote it" — a real change of meaning, in the field the trust boundary is built on.
3. **Add `origin: 'import'` and teach `trustedStatus` one exception**, scoped to `init` into an
   empty corpus. Most faithful to the decision, most surface area, and it puts a branch inside the
   function whose whole value is having none.

**Recommendation: (3).** It is the only one that keeps `origin` truthful *and* keeps the decision.
The exception is narrow and testable: empty corpus, `init` only, recorded in the audit log.

### ⚠️ §5 says the audit log travels; the code says it never does

The audit log is **gitignored, and was documented as never travelling** — `src/core/jsonl-log.ts` · `**The consequence is that the log is local to the machine that wrote it**` · ~84,
`src/core/audit.ts` · `**Gitignored, and the consequence is disclosed rather than left to be` · ~42, and **both READMEs**. §5 reverses that on the owner's explicit
instruction (*"history could be also be exported by including the audit too"*), and the code permits
it. **The prose is what must change**, or the product will ship documentation that
contradicts its own feature. **Part of that has happened since**: `core/audit.ts`'s comment now says
the log does not travel *today* and names §5's narrowing — mutation records travel with a corpus
export, injections and hook actions stay behind — and the README's warning is scoped to "in this
release". The remaining work is that the READMEs still describe the log as neither a backup nor a
shared record, which §5's exporter will contradict the day it ships.

### ⚠️ §5's "does not travel" list is incomplete — three directories are unmentioned

`.revisions/`, `.ingest/` and `.staging/` all exist and appear nowhere in §5. **`.revisions/` stores
the text of discarded proposals** (`src/core/revision.ts` · `export function revisionHistory(ctx: MutationContext, itemId: string): RevisionRecord[] {` · ~497) — an export built as a deny-list
would ship rejected drafts to a stranger.

**Ruling: the exporter is an allow-list, not a deny-list.** Only what is named travels; anything the
product grows later is excluded by default and must be added deliberately. Cost if wrong: a
directory that should have travelled is omitted, which is visible and fixable — the opposite error
leaks and is not.

### ✅ The audit discriminator exists, exactly as §5 assumed

`AuditKind` was `'mutation' | 'injection' | 'hook' | 'focus'` when this was written; **`'access'`
joined it 2026-08-20 and `'progress'` 2026-08-21** (`src/core/audit.ts` · `export type AuditKind = 'mutation' | 'injection' | 'hook' | 'focus' | 'access' | 'progress';` · ~136). It is stored per
record, derived from one total `KIND_OF` table (`src/core/audit.ts` · `const KIND_OF: Record<AuditOp, AuditKind> = {` · ~247), validated on read (`src/core/audit.ts` · `!AUDIT_KINDS.includes(row.kind as AuditKind)` · ~472), with
`filterAudit(…, {kind})` (`src/core/audit.ts` · `export function filterAudit(records: AuditRecord[], filter: AuditFilter): AuditRecord[] {` · ~671) already the shared filter. `MUTATION_OPS` (`src/core/audit.ts` · `export const MUTATION_OPS = [` · ~143) still matches §5's
ten names exactly. **§5's filtering decision rests on something real** — and the widening is what it
was built for: two kinds arrived without §5's `kind` filter needing a line.

Better still, §5's claim that mutations carry no `sessionId` or `path` holds **by construction** —
the only two writers (`persist.ts` · `export function auditMutation(` · ~121, and the discard settlement at `revision.ts` · `const audited = auditFailureNote(recordAudit(ctx.root, {` · ~910) have no parameter for either. The type
permits them, so the exporter should *project* the fields it emits rather than pass records through.

### ✅ Collision detection is already written

`itemContentHash` (`src/core/content-hash.ts` · `export function itemContentHash(item: Item): string {` · ~162) — the same predicate `createItem` uses — excludes
`id`, `status` and `origin` and normalizes. That is precisely the three-bucket rule, already
implemented.

### Sizing, for the plan

- **The largest piece is not the ZIP.** It is the shared selection/serializer core — selection,
  filtered audit, manifest, three format writers — at roughly 400-600 lines, and it is large
  *because* §6h forbids a second packer behind `--as-pack`, `pack import` and `init --pack`.
- **The ZIP is well bounded**, ~120-200 lines: `zlib.deflateRawSync` and `zlib.crc32` are both
  present on the installed Node 24.14.0. Only the headers, central directory, EOCD and determinism
  pinning are hand-written. No archive code exists today and `node:zlib` is imported nowhere.
- **The `git bundle` rung is the real risk.** `src/**` contains **no `child_process` import at
  all** — it would be the first subprocess in shipped code. Worth weighing against the fact that the
  plain directory is already the canonical format and git users can bundle it themselves.
- Patterns to copy: `cli/commands/supersede.ts` for a command, `review.ts` for `pack import`'s
  subcommand dispatch.

---

## 6l. Conflict scan — 15 findings, and four decisions do not survive it. 2026-08-19

A pre-flight scan of both v2 specs against the code. It checked 24 surface pairs clean and found 15
conflicts. **Four of them reverse or block a decision the owner took**, and one is a security
finding. Every quotation below was re-verified by the controller against source before being
recorded here.

**Ranked by what they cost.**

### F2 — SECURITY. A pack's "category configuration" is a larger power than the `--trust` flag §6h refuses

§6h admits **"the category configuration (which is what `profile` selects)"** and forbids a
`--trust` flag because *"a boundary a flag can override is not a boundary."*

**The parenthetical is wrong.** `profile` selects only which categories are *enabled*
(`config.ts` · `const enabledByProfile = new Set(PROFILES[profile]);` · ~657, read at `config.ts` · `enabled: enabledByProfile.has(def.name),` · ~677). The `categories` block **also** carries `tier`, `agentEdits`, `scopePolicy`
and `prefix` — and a `tier` override drags `agentEdits` with it (`config.ts` · `} else if (override.tier !== undefined) {` · ~788).

So a pack shipping `"rule": {"tier": "rationale"}` does two things at once, and `resolveConfig`
accepts both without complaint because every value is valid:

1. every future agent-authored `rule` lands **active** instead of draft — `tierOf` reads the
   resolved config (`trust.ts` · `export function tierOf(ctx: MutationContext, item: Item): Tier {` · ~285) and `trustedStatus` gates on tier;
2. every existing `rule` **stops being injected at all** — `isNormative` (`select.ts` · `function isNormative(item: Item, config: Config): boolean {` · ~204).

**That is strictly more power than the flag §6h refuses, delivered through the surface §6h calls
safe.** A pack can silently disarm the trust boundary and un-inject the importer's whole normative
corpus.

**Second half of the same finding:** §6 says config **replaces**, it does not merge. A pack config
with `budgets` and `watchedDocs` stripped — which §6h *requires* — resets both to product defaults
on import (`config.ts` · `if (raw === undefined) return { ...DEFAULT_BUDGETS };` · ~537 and `config.ts` · `if (raw === undefined) return [...DEFAULT_WATCHED_DOCS];` · ~583). §6h's own words: *"a pack that silently changed how much context
mycontext spends would be doing something the user did not ask a template to do."* Exactly that,
through the mechanism chosen to prevent it.

**Fix that keeps §6h's line intact:** a **field-level merge of the `categories` block only**, with
`tier` and `agentEdits` overrides **refused outright** from a pack. §6's replace-not-merge was
written for a whole-workspace export, where it is correct; §6h inherited it from a case it does not
fit.

### F5 — the FTS5 decision protects the wrong module, and the real defect is one line elsewhere

**CORRECTION to §6f.** §6f claims *"`core/search.ts`'s recorded decision against ranking stands
unamended"* because `select()` is untouched. **The decision's subject is not `select()`.** Verbatim,
`src/core/search.ts` · `The corpus filter behind BOTH` · ~7:

> *"The corpus filter behind **BOTH** `query_items` (the model's tool) and `mycontext search` (the
> user's command)."*

Those are **precisely the two surfaces §6f puts FTS5 behind.** The protective clause guards a module
the decision never governed and leaves the only module it does. The decision is amended by this
adoption, whether or not `select()` moves.

**And the motivating example failed for a different reason than stated.** §6f says
`search "silently drop"` misses because matching is substring-literal. The predicate was
**title and body only** — `src/core/search.ts` · ``if (text && !`${item.title}\n${item.body}`.toLowerCase().includes(text)) return false;`` · ~50 — verified at the time. <!-- historical-citation: the scan quotes the pre-fix predicate as it stood on 2026-08-19; the one-line widening this finding recommended shipped that day and `searchableText` now covers observations and `extra` --> The corpus
did contain the phrase; it sat inside `## Observations`. **The miss was field coverage, not
tokenisation, and FTS5 over title+body would have reproduced it exactly.**

**Third problem:** the adoption condition — *"FTS5 returns a superset of what substring matching
returns"* — is unmeetable by a swap. `search "ilently"` matches `String.includes` and matches no
tokeniser. Only a union of both predicates satisfies it, and a union must decide ordering, which is
the ranking question again.

**The cheaper fix, in order:** (1) extend the `text` predicate to observations and `extra` — **one
line**, no new machinery, fixes the cited example; (2) if word-order-insensitive matching is still
wanted, an AND-of-terms substring predicate is a superset of the current one **by construction**,
needs no index and cannot regress.

**Not ruled on.** The owner adopted FTS5 on reasoning that is now falsified in three places. The
recall problem is real; the mechanism was the wrong size.

### F4 — the checkbox write path has no legal implementation, and there is a better design

`FieldPolicy` is `'content' | 'gated'`, pinned by `satisfies` and four `Assert<>` types
(`trust.ts` · `type FieldPolicy = 'content' | 'gated';` · ~451, pinned at `trust.ts` · `export const UPDATE_FIELD_POLICY = {` · ~453). §6g's third class fails to compile **by construction** — and that table exists
because `extra` was once unclassified and an agent could rewrite a governing rule's directive.

Worse, the table classifies by **effect**, not intent: *"`content` … changes what the agent is
TOLD."* An `active` procedure is injected in full, so **flipping a box changes the injected text.**
By the table's own definition that is content.

**The scan's alternative is better than the decision:** keep progress **out of the item file**.
Record "step 3 of PROC-x done" in session state or the audit log. Steps stay immutable Markdown;
progress becomes what it actually is — session state, counted, never stored in the corpus. That
keeps `INV-markdown-is-the-source-of-truth` intact (progress is not knowledge), leaves
`UPDATE_FIELD_POLICY` untouched, leaves `checksum` stable, and still yields "3 of 5".

**Recommended.** It satisfies §6g's stated goal without the hole.

### F1 — active-at-`init` contradicts §6 and cannot be implemented honestly

§6 already ruled, universally: *"Every imported normative item lands `draft` … regardless of any
signature."* §6h then exempts `init`. `trustedStatus` refuses the exemption on purpose
(`trust.ts` · `argument would defeat the whole boundary.` · ~265, verified) — *"a non-human caller that explicitly passes `status: 'active'` … is
still forced to `draft`, or one argument would defeat the whole boundary."*

**The scan's answer is better than my three routes in §6k.** §6h's argument — a 40-item review queue
gets bulk-approved unread — supports *"make bulk review tractable"*, not *"skip the gate"*. A
`review promote --all --pack <name>` behind one confirmation is the same human act §6h calls
"choosing the pack", made **after** the corpus is visible rather than before.

**This supersedes §6k's recommendation of route (3).**

### F3 — §2.1's four states are three new `Status` values, and two are unreachable

`Status` has five members (`types.ts` · `export type Status = 'active' | 'draft' | 'superseded' | 'deprecated' | 'validated';` · ~2). `ready` cannot produce an index line — `buildIndex` (`select.ts` · `function buildIndex(` · ~512)
enumerates only `eligible`, and `isEligible` requires `active` (`select.ts` · `export function isEligible(item: Item, config: Config): boolean {` · ~198). `done` is
counted in **no** tally: not `retired`, not `counts`, not `ineligible` — it vanishes from every
session-visible number, which is a direct hit on `INV-nothing-is-dropped-silently`. And "injected in
full every session" is the `always` flag, not a status — so "the owner initiated it" is **two**
human writes, not one.

**The lifecycle is right; four bespoke statuses are the wrong expression of it.** `proposed→draft`,
`active→active`+`always`, abandoned→`superseded` already work. Only `ready` and `done` are new, and
both fit as `extra` fields or tags rather than `Status` members.

### F7 — `procedure` duplicates the shipped `runbook` category

Independently confirms the controller's finding. `runbook` ships normative, enabled, in the
`standard` profile, described as *"The steps for a named operation, in the order they must be
taken"* (`categories.ts` · `runbook:       def('runbook', 'RUN', 'normative', true,` · ~40). The scan adds the decisive point: **the owner was naming the
existing category** — R11b says *"runbook (or to call it with different name)"*.

So the live question was never "what do we call the new thing" but **"does `runbook` become the
one-shot procedure, or does `procedure` ship beside it"** — and §2 never asks.

### The rest, in one line each

- **F9** — `todo` can never reach the review queue: the queue is `status === 'draft'`
  (`select.ts` · `i.status === 'draft' && i.layer === 'project'` · ~435) and a rationale item is never forced to draft. §1's own §1.1 says "no draft
  queue". It needs its own listing surface.
- **F14** — the rule-file exporter writes normative text into `.cursor/rules/` and
  `.github/instructions/`, which **no gate protects**: the deny hook covers `.my_context/items/`
  only. An agent may edit the exported copy to say the opposite, and Cursor obeys it. Needs a doctor
  check that re-derives and reports divergence, plus a generated-file header.
- **F6** — `## Steps` is a **file-format change**, not a third parser consumer: an unrecognised
  section is parsed then **destroyed on the next `persist()`**, and `validateBody` refuses heading
  lines with the comment *"changing the file format … is a much larger decision than this guard"*.
- **F11** — `AUDIT_OPS` is closed and an unknown op makes the reader **refuse the whole segment**.
  So a v2 log is unreadable by v1.0.2, and one unknown op from a stranger makes their entire
  imported history unreadable. §5 addresses neither.
- **F13** — carried index lines have no budget: either they consume `budgets.index` and spill the
  new session's own items, or they need a fifth budget. Neither §6c nor §6g picks.
- **F10** — three rulings on `watchedDocs` in one section, unsequenced; and the order of §6f's
  `init`-writes-`watchedDocs` against §6h's `init --pack` config replace is undefined — whichever
  runs second silently wins.
- **F8** — §4 and §6a were superseded **inside this document** and left standing. A planner reading
  in order scopes R10 around a gap that no longer exists and schedules a dropped hook.
- **F15** — a category defined in config or shipped by a pack gets **no slash command**: the
  `commands/*.md` files are generated and committed from the plugin's own defaults.
- **§0 is stale** — it says "two new categories"; §2 adds a third.

### What the scan confirmed clean

24 surface pairs, listed in the agent's report — including `ledgerKey`'s subagent join, the
`source === 'clear'` claim about `inject.ts`, §5's audit-record claims, the 64-bit checksum, both
SQLite paths, `~/.my-context`'s spelling, and that `todo`/`note` are never injected **by
construction**. The scan is auditable in both directions.

---

## 6m. The scan's findings, ruled on. 2026-08-19 — THIS SECTION SUPERSEDES §2, §6f, §6g and §6h WHERE THEY CONFLICT

Twelve owner decisions, taken after §6i-§6l. **Where an earlier section says otherwise, this one
wins** — including §2's new category, §6f's FTS5 adoption, §6g's checkbox write path and §6h's
active-at-`init`.

### 1. F7 — **`runbook` becomes the one-shot procedure. `procedure` is not created.**

**This is the largest of the twelve.** `runbook` already ships — normative, prefix `RUN`, enabled in
the `standard` profile, *"The steps for a named operation, in the order they must be taken"*
(`categories.ts` · `runbook:       def('runbook', 'RUN', 'normative', true,` · ~40). R11b's own words were *"runbook (or to call it with different name)"*: the
owner was naming the existing category, not proposing a new one.

So `runbook` gains the lifecycle — states, steps, the injection rule — and its description is
rewritten to say it is performed once. **A repeatable sequence stays what it is today:** a
`standard` or `rule` with ordered steps. **Every reference to a `procedure` category in §2, §6a,
§6d, §6g and §6i now reads `runbook`.**

Nothing to migrate, no vocabulary growth, and it removes the "second spelling" defect this document
names four times.

### 2. F3 — the lifecycle maps onto shipped statuses; nothing is added to `Status`

| Lifecycle | Shipped representation |
|---|---|
| proposed | `draft` |
| ready | a **tag or `extra` field** on a draft — not a status |
| active | `active` **+ `always: true`** — two human writes, and the spec now says so |
| done | `deprecated` — **not `validated`**, which `governsNormatively` treats as still governing |
| abandoned | `superseded` (§6d, unchanged) |

`RETIRED_STATUSES`, `reviewQueue`, `isEligible` and every `IndexSummary` tally stay correct with no
amendment. **`done` is now counted in `retired`**, which closes the
`INV-nothing-is-dropped-silently` hit F3 identified.

### 3. F4 — step progress lives in session state, never in the item

Record *"step 3 of `RUN-x` done"* in the audit log or session state. **Steps stay immutable Markdown;
progress is session state, counted, never stored in the corpus** — which is what it always was.

Consequences, all good: `UPDATE_FIELD_POLICY` is untouched and keeps its compile-time guarantee;
`checksum` never moves on a tick, so `doctor` never reddens; `INV-markdown-is-the-source-of-truth`
stays honest because progress is not knowledge. **§6g's `mycontext runbook step` no longer writes to
`items/` at all**, so the "first hole in the boundary" F4 identified does not open.

`active → done` remains human-only (§2.2, unchanged).

### 4. F2 — a pack may not carry the trust boundary

**Config from a pack merges field-wise; it does not replace.** `budgets` and `watchedDocs` are
untouched by an import, which is what §6h intended and replace-not-merge silently defeated.

**`tier` and `agentEdits` are REFUSED outright from a pack**, with an error naming them. A pack may
set which categories are enabled, and their `prefix` and `scopePolicy`. It may not move the
boundary it is imported under.

**Why this is stated as a refusal and not a warning:** §6h forbids a `--trust` flag because *"a
boundary a flag can override is not a boundary."* A `tier` override is the same power with a longer
name and no prompt.

§6's "config replaces, it does not merge" was written for a whole-workspace R6 export, where it is
correct, and **applies there still**. §6h inherited it from a case it does not fit.

### 5. F1 — everything imported lands `draft`; bulk review makes that bearable

**§6h's active-at-`init` is withdrawn.** `trustedStatus` refuses it deliberately, and the owner's
argument for it — a 40-item queue gets bulk-approved unread — supports *making bulk review
tractable*, not skipping the gate.

**`mycontext review promote --all --pack <name>`**, behind one confirmation, is the same single human
act as choosing the pack — taken **after** the corpus is visible rather than before. No exemption,
no `origin: 'import'` carve-out, no branch inside `trustedStatus`.

**§6k's recommendation of route (3) is superseded.**

### 6. F5 — FTS5 is **not** adopted. The defect is field coverage.

**§6f's adoption is withdrawn**, on three falsified claims:

1. `src/core/search.ts` · `The corpus filter behind BOTH` · ~7 — the recorded decision's subject is *"BOTH `query_items` … and `mycontext
   search`"*, exactly the two surfaces FTS5 was to sit behind. §6f's clause protected `select()`,
   which the decision never governed.
2. The motivating example missed on **field coverage**: the predicate was `src/core/search.ts` · ``if (text && !`${item.title}\n${item.body}`.toLowerCase().includes(text)) return false;`` · ~50 <!-- historical-citation: the ruling quotes the predicate it is ruling about; the widening ruled here shipped the same day and `searchableText` now covers observations and `extra` --> —
   observations were not searched, and that is where the phrase
   was. FTS5 over title+body would have reproduced the miss exactly.
3. The parity condition is unmeetable by a swap — `search "ilently"` matches `String.includes` and
   no tokeniser.

**Taken instead:** extend the `text` predicate to **observations and `extra`** — one line, no new
machinery, fixes the cited example. If word-order-insensitive matching is still wanted afterwards,
an **AND-of-terms substring predicate** is a superset of today's by construction: no index, no
ranking, cannot regress, and it keeps working through the Markdown fallback path where FTS5 could
not.

### 7. F14 — exported rule files get a header and a doctor check

Each exported file opens with a **generated-by-mycontext header stating it must not be edited**, and
`doctor` **re-derives the expected content and reports divergence** as a finding.

Detection, not refusal: extending the deny hook would have mycontext refusing writes to directories
other tools legitimately own. This is the same bargain the audit log makes everywhere else — the
edit is possible and it is visible.

### 8. §6j — session naming takes an explicit id, and the slash command fills it in

`mycontext session name <id> <name>`, with `mycontext session list` to find the id. **Always
correct, never guesses.** The slash command arrives as a prompt and therefore reaches a hook that
*does* carry `session_id`, so it supplies the id automatically.

Together they satisfy "must work from the CLI" without the CLI ever having to know which session it
is in — which `core/focus.ts` · `What focus is scoped to: the WORKSPACE, not the session` · ~21 records as unknowable.

### 9. F9 — `todo` gets its own listing surface

**`mycontext todo`**, plus `search --type todo` which already works. **The review queue is not
widened.** An inbox and a draft queue answer different questions — *"what did I jot down"* against
*"what am I being asked to let govern"* — and `reviewQueue` keeps meaning exactly one thing across
all four surfaces that read it. **§1's "appears in the review queue" is corrected.**

### 10. F11 — unknown audit ops are quarantined on import, refused locally

On import, records with an unrecognised op go to **`.audit/imported/unknown/` and are COUNTED in the
import report**. Nothing silently omitted, nothing refused wholesale — one stranger's newer op no
longer makes their entire history unreadable.

**Locally the strictness stands**, because there it is right: a local unknown op means this build
wrote something it cannot read back.

### 11. F13 — carried lines deduplicate first, then share the index budget

Carry **only what the new session's own index would not already show**. Most carried lines are
duplicates of lines the new index produces anyway, so the remainder is small — and it queues inside
the **same `budgets.index`**, spilling and disclosing exactly as any other index line does.

No fifth budget, no new config key, and §6f's "retrieval is bounded by the index budget" keeps
describing the system.

### 12. F15 — one generic `/mycontext:add` alongside the generated commands

A single slash command that accepts any resolved category. **Custom and pack-defined categories work
immediately**, with nothing generated at install time, and a disabled category fails in one place
with a real message. The committed-files design and its CI parity test are untouched.

---

## Controller rulings on the mechanical findings

Not put to the owner — these are corrections, not choices.

- **F6** — `## Steps` is a **file-format change**, not a third parser consumer. An unrecognised
  section is parsed then destroyed on the next `persist()`, and `validateBody` refuses heading lines
  with the comment *"changing the file format … is a much larger decision than this guard."* §6a's
  "not an invention" is struck. The work is a new `Item` field, a `parseItem` read, a `renderItem`
  write, a `validateBody` carve-out, and decisions on `ContentShape`, `computeItemChecksum` and
  `renderItemBlock`. **Sized as a parser change it will be discovered as a format change.**
  *Cost if wrong: none — this is a restatement of what the code says.*
- **F10** — `watchedDocs` has one meaning that satisfies all three of §6f's rulings: **`init`
  includes `docs/solutions/**` in the concrete list it writes**, when the directory exists.
  `DEFAULT_WATCHED_DOCS` is not broadened and the user's list is never merged into.
  **Sequencing:** `init --pack` applies config **first**, then `init` writes `watchedDocs` — because
  a pack may not carry `watchedDocs` at all under §6m.4, so there is nothing of the pack's to
  overwrite. *Cost if wrong: the order is stated and testable.*
- **F8** — §4 and §6a were superseded inside this document and left standing. Both now carry a
  forward pointer. A planner reading in order was scoping R10 around a gap that no longer exists and
  scheduling a hook that was dropped.
- **§0 is stale** — it says "two new categories". Under §6m.1 the answer is now **two** again
  (`todo` and `note`), because `procedure` is not created. §0 becomes accidentally correct; it is
  restated anyway so it is correct on purpose.
- **Documentation defect** — both READMEs and two source files state the audit log never travels;
  §5 reverses that. The prose must change, or the product ships documentation contradicting its own
  feature.

---

## 6n. Decided 2026-08-20, after the implementation plans — THIS SUPERSEDES §6m WHERE THEY CONFLICT

The three plans surfaced eight things the decisions had not settled, five of them found only
because each plan was told to **list what it would otherwise have guessed**. All eight are ruled on
here. Two reverse a ruling in §6m.

### 1. A pack MAY declare `tier` — but only for a name that does not exist locally

**§6m.4's flat refusal is withdrawn.** It was jointly unsatisfiable with the code: `resolveConfig`
**requires** `tier` and `description` for a category name the build does not know
(`src/core/config.ts` · `if (!override.tier || !override.description) {` · ~705), so §6h and §6m.12's premise that pack-defined categories work could
never hold.

**The rule:** a pack may declare `tier` for a category the workspace has never heard of — where it
is mandatory and can override nothing — and **never** for a name that already exists.

**The security property is untouched.** The attack §6l F2 found was a pack shipping
`"rule": {"tier": "rationale"}` to retier an *existing* governing category, un-injecting the
importer's whole normative corpus and opening it to unreviewed agent writes. Declaring a tier for a
name nobody has cannot do that: there is nothing to un-inject and nothing to un-gate. `agentEdits`
stays refused outright, and a pack still never carries `budgets` or `watchedDocs`.

### 2. Carried index lines go to the FRONT of the queue, and displacement is disclosed

**§6m.11 is sharpened, because as agreed it was a no-op.** Measured: `buildIndex`'s candidate set is
already every eligible normative item not delivered in full, so a carried id that still governs is
**always already a candidate**. On this corpus — 44 items, 18 index lines, **0 truncated** — a
literal "dedupe then share" adds nothing and reports success.

The decision only bites on an exhausted index, and there **position is the whole feature**. Carried
lines take priority; a line the new session would otherwise have shown is displaced, and the
displaced line **spills visibly**, exactly as any other spill does.

Stated plainly because it changes what was agreed: the honest form of "share the budget" is
**"displace something, and say so."**

### 3. `SubagentStart` ships at a 5-second timeout, and the audit record is written FIRST

The 5 seconds is reasoned, not measured — the only datum is that 3,018 ms was tolerated.

**The ordering is the real decision.** There is no in-process timeout anywhere in the hook layer:
`readFileSync(0)` blocks the thread and no timer can preempt it, so the only bound is Claude Code
killing the process — and **a killed hook writes nothing**, so nothing would record that a subagent
started with no context.

So the hook **records the intent to deliver before doing the work**. A kill then leaves a record
saying delivery was attempted and did not complete. `INV-nothing-is-dropped-silently` is satisfied
by evidence rather than by hope, using machinery that already exists.

### 4. `steps` enters the checksum only when non-empty

`...(item.steps.length ? { steps: item.steps } : {})` in `computeItemChecksum`.

**Why this is not the compromise it looks like.** `JSON.stringify` omits properties whose value is
`undefined` — verified by execution — so the entire hazard was the difference between defaulting
`steps` to `[]` and leaving it absent. This keeps `Item.steps` a normal always-array field,
consistent with `observations` and `relations`, while **every item that exists today hashes exactly
as it does now**. No re-stamp, no migration, and the tamper signal `repair.ts` exists to preserve
stays intact.

**A warning for whoever later wants to tidy this.** Making the key unconditional is a one-character
change that silently invalidates the recorded checksum of every item in every corpus in existence.
The condition is load-bearing.

### 5. The audit log gains a format version, now

`parseAudit` refuses a whole segment on an unknown kind — correctly, since a log that silently omits
entries is worse than one that refuses to answer. But that means a v2.0 log carrying a `progress`
record is unreadable **in its entirety** by a v1.0.2 reader: a user who downgrades, or runs two
versions across machines, loses their whole history rather than the new records.

A version per segment makes an older reader say *"this log is newer than I am"* instead of blaming
an op it does not recognise. **Cheap now, expensive once logs exist on users' machines**, and it
fixes the whole class rather than this one kind. §6m.10's import-side quarantine still stands.

### 6. The `git bundle` rung is dropped from v2.0

`src/**` contains **no `child_process` import at all**, so it would be the first subprocess in
shipped code. And `git subtree split` **writes a commit and a ref into the exporter's own
repository** — a side effect nobody asked a read-shaped command for, with no decided policy for an
untracked corpus or a dirty tree.

The plain directory is canonical, so a receiver with git bundles it in one line. Because the ladder
is a `--format` flag over a shared bundle, **adding the rung later costs one writer and changes
nothing else.** Fully reversible.

### 7. A changed item IS overwritten on re-import — after a warning and explicit approval

**The owner's ruling, and it corrects the framing of the option offered.** The objection to
overwriting was that it *silently* replaces knowledge the user may have edited. Approval removes
the silence, and the owner's reasoning is that requesting an import is itself intentional.

**What that requires, and it is not optional:**

- The warning **names what will be overwritten** — the ids, and enough of the change to recognise
  it. "Some items will be replaced" is not a warning, it is a notice.
- Approval is **explicit and separate** from choosing the pack. Choosing a pack is not consent to
  replace a rule you wrote.
- Every overwrite is a **mutation record in the audit log**, so the prior content is recoverable
  from history and from git where the corpus is tracked.
- **Nothing is overwritten without approval**, and declining leaves the changed items reported and
  skipped — which is what the importer does for every unapproved bucket.

This makes *"updating means importing again"* (§6d) true rather than two-thirds true.

### 8. The README export note stays beside the claim it corrects

Cosmetic, and the reasoning is the same one this document keeps proving: a correction that lives
away from the sentence it corrects is how the audit-travel claim survived in **five** places at
once. §8's rule about unbuilt behaviour is respected by one clause explaining why the planned part
is recorded there.

---

## 6o. Decided 2026-08-20 by the owner — BOTH categories exist. This REVERSES §6m.1.

**§6m.1 was wrong, and the error was mine.** R11b said *"runbook (or to call it with different
name)"* and I read that as the owner naming the **existing** category, concluding that `runbook`
should absorb the one-shot lifecycle and no new category be created. That is not what was intended.

**The ruling: both exist, and they are different kinds of knowledge.**

| Category | Meaning | Status |
|---|---|---|
| **`runbook`** | An ordered set of instructions that is **repeatable** — performed whenever the named operation comes up. | **Ships today, unchanged.** `src/core/categories.ts` · `runbook:       def('runbook', 'RUN', 'normative', true,` · ~40, normative, prefix `RUN`, *"The steps for a named operation, in the order they must be taken."* No lifecycle and no states. `steps` landed as an `Item` field rather than a `procedure` one — `parseItem` is handed a file and never a `Config`, so it cannot know the type until it has read it — and nothing refuses steps on a `runbook`; `procedure` is the category the product documents, seeds and commands around them (`src/core/types.ts` · `steps: Step[];` · ~81). |
| **`procedure`** | An ordered set of instructions performed **once** and then done — a migration, a fix, a one-time correction. | **New.** Normative, prefix `PROC`. Carries the lifecycle, the steps, and the injected-only-while-active rule. |

**Everything §6m and §6n decided about the one-shot lifecycle now attaches to `procedure`, not to
`runbook`.** Specifically: §6m.2's mapping onto shipped statuses, §6m.3's session-state progress,
§6n.3's write ordering, §6n.4's conditional checksum key, and the `mycontext runbook step` /
`activate` / `done` commands, which are **`mycontext procedure …`**.

### The F7 objection, and what actually answers it

§6l F7 argued that two normative ordered-step categories differing only by one-shot-versus-repeatable
is a **second spelling of one concept** — the defect this document names four times. That objection
was not wrong about the risk; it was wrong about the premise, because it assumed the owner was
renaming rather than adding.

**The distinction is real and it is the owner's:** *"an ordered set of instructions but the
difference is that it should be done only once as a fixing or other action vice a set of
instructions that are repeatable."* A rule that applies every time and a migration you run once are
not the same knowledge, and collapsing them loses the thing that makes the one-shot honest — it
stops being injected when it is done.

**What the risk demands instead of a merge:** the boundary must be stated where an author is
choosing, not buried in a spec. `mycontext help categories`, `mycontext examples runbook`,
`mycontext examples procedure` and both READMEs must each answer *"which one is this?"* in one
sentence. The friction §1 warns about is not two categories existing; it is two categories whose
difference nobody can state at capture time.

**The one-sentence test, to be used verbatim in the docs:**
*Will you do this again next time the situation arises? Then it is a `runbook`. Is it done once and
then finished? Then it is a `procedure`.*

### What this changes in work already written

- **The spec body** — §2 and its subsections, §6a, §6d, §6g and §6i were rewritten on 2026-08-19 to
  say `runbook` where they had said `procedure`. That rename is **reverted**: the lifecycle text
  belongs to `procedure`, and `runbook` returns to being mentioned only as the repeatable sibling it
  already was.
- **`docs/superpowers/plans/2026-08-20-v2-categories-and-runbooks.md`** — written against §6m.1.
  Its Task 2 adds two categories (`todo`, `note`); it must add **three**, with `procedure` carrying
  the lifecycle and `runbook` untouched. Task 10, which converts `runbook` to one-shot everywhere it
  is described, is **withdrawn** and replaced by documenting the boundary above.
- **§0's count** — restated on 2026-08-19 as "two new categories, on purpose". It is **three**:
  `todo`, `note`, `procedure`.

---

## 6p. R14 — the web UI is an OPTIONAL ENHANCEMENT. Decided 2026-08-20 by the owner, and NEW to this list.

**R14 was not in `reports/uiux/REQUIREMENTS-ADDENDUM-2.md` beside R6–R13.** The owner stated it on
2026-08-20, after the three web-UI plans were written, and it is recorded here because this document
is where the R-series is decided. What it sits awkwardly beside is recorded at the end of this
section rather than resolved.

**The requirement, in one sentence:** the web UI is an **optional enhancement** — gated by
configuration, toggled by a slash command, and it **must not change what the plugin does**.

| Clause | What it requires |
|---|---|
| **Configured in `.my_context/config.json`** | Whether the UI may run is a **corpus** setting, sitting beside the profile, the categories and the budgets — not a flag remembered somewhere else on the machine |
| **Toggled by a slash command** | The user enables and disables it by typing a command. Hand-editing JSON is not the interface |
| **No effect on the plugin, in either state** | Injection, the hooks, the MCP surface, the CLI, the budgets and the trust boundary are identical whether the UI is enabled, disabled, or never configured. **Disabled must not mean degraded, and enabled must not mean different** |

**What the UI is FOR, because it constrains the design.** The user wants to *see what is going on in
their context* — what was injected, what spilled, what governs, what decayed. It is an **observation
surface**, and that is the whole of its job. It is why the no-writes ban exists
(`docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md`, §0.5 and Tasks 13–14), and it is
why *enhances, never alters* is the requirement rather than a nice-to-have: a surface that changes
what it is showing you is not showing you anything.

### R14.1 — the slash command WRITES `config.json`, as the user's act

**A slash command is the user typing it, not an agent acting**, and that distinction is what makes
this write legal.

**The project already drew this line, in the same place, for the same reason.** `mycontext review`
promotes a draft with `const patch: UpdateInput = { id: item.id, status: 'active', origin: 'human' };`
(`src/cli/commands/review.ts` · `const patch: UpdateInput = { id: item.id, status: 'active', origin: 'human' };` · ~1068), after a confirmation — and the export-and-packs plan defends
re-using that move in one sentence: *"A human took it, at their terminal, one prompt ago"*
(`docs/superpowers/plans/2026-08-20-v2-export-import-and-packs.md`, §0, "On item 7"). `origin` there
is not a claim about who authored the content; it is a claim about **who took the act**. R14.1 makes
the same claim about the same kind of act.

**The PreToolUse deny hook keeps stopping AGENTS, and nothing here softens it.** It refuses every
direct write under `.my_context/`, and for this file it says so by name — *"Configuration changes to
`.my_context/config.json` are the user's to make — ask, do not edit."*
(`src/hooks/pre-tool-use.ts` · `is managed by my_context and must not be written` · ~115). A toggle command is not a door into the managed directory, and
the hook's verdict on a tool write is unchanged by it.

**The precedent is being set deliberately.** Nothing in the product has edited a config file the user
owns before now, and this is the decision to start.

> **Scope correction, against the code — the precedent is narrower than "first", and the difference
> is the hard part.** `mycontext init` already writes `config.json`, creating it as
> `{ profile: 'standard', categories: {}, budgets: {} }` (`src/cli/index.ts` · `const INIT_CONFIG = { profile: 'standard', categories: {}, budgets: {} } as const;` · ~131). What R14.1
> opens is the first path that **modifies an existing** one — a read-modify-write over a file the
> user may have hand-edited, which is a different problem from writing a fresh one and carries
> questions creating never faced: key order, formatting, and what happens to keys this build does
> not recognise (R14.2). §6m.4 and §6n.1's pack import is the other decided write of this shape, and
> it is unbuilt; whichever ships first sets the mechanics for both.

> **A hole in the premise, recorded and not closed.** *"The deny hook keeps stopping agents"* is true
> of **tool** writes only: `hooks/hooks.json` matches `PreToolUse` on
> `Read|Edit|MultiEdit|Write|NotebookEdit`, and **not on `Bash`**. An agent that runs the toggle
> command in a shell is not seen by that hook at all. This is already true of every mutating CLI
> command, so R14.1 does not create it — but R14.1 is the first ruling whose whole defence is *"a
> slash command is the user"*, so it is the first place the gap is load-bearing.

### R14.2 — unknown TOP-LEVEL config keys warn and are skipped; they no longer refuse the file

**Verified in the code rather than assumed — and this ruling has since shipped.** `TOP_LEVEL_KEYS` was
`src/core/config.ts` · `const TOP_LEVEL_KEYS = ['profile', 'categories', 'budgets', 'watchedDocs'];` · ~389 <!-- historical-citation: quotes the four-key list as it stood before R14.2; `'ui'` joined it 2026-08-20 -->, and a key outside
that list threw before anything was loaded — `src/core/config.ts` · `const unknownTop = Object.keys(input).filter((key) => !TOP_LEVEL_KEYS.includes(key));` · ~483 <!-- historical-citation: quotes the whole-file refusal R14.2 replaces; it is now a `skippedKeys` collection --> — with the message
*"Nothing was loaded — a setting that cannot be acted on is refused rather than ignored."*

**Shipped 2026-08-20, exactly as ruled.** `'ui'` is on the list (`src/core/config.ts` · `const TOP_LEVEL_KEYS = ['profile', 'categories', 'budgets', 'watchedDocs', 'ui'];` · ~452), and an unrecognised
top-level key is collected and disclosed rather than refused (`src/core/config.ts` · `const skippedKeys = Object.keys(input).filter((key) => !TOP_LEVEL_KEYS.includes(key));` · ~646). The paragraphs
below are the reasoning that got it there and are left as they were argued.

**So a config carrying `ui` disables the WHOLE plugin on any build predating the key.** Not the UI —
the plugin: `resolveConfig` refuses the *file*, so injection, the hooks and the MCP surface lose
their configuration together. **That breaks R14's own third clause**, on the exact path R14 exists to
protect — a user who enables the UI and then downgrades, or works on a second machine running an
older install, loses everything rather than losing the UI.

**The rule: an unrecognised TOP-LEVEL key warns and is skipped. An unrecognised key INSIDE a known
block still refuses outright.** A mistyped `categories` or `budgets` key is a setting the user
believes is in force and is not, which is the failure `TOP_LEVEL_KEYS` was added to close in the
first place — `"budget"` for `"budgets"` loaded, every limit stayed at its default, and *"the only
symptom was items quietly missing from sessions"* (`src/core/config.ts` · `the only symptom was items quietly missing from sessions.` · ~445). That stays exactly
as it is. Only the outermost layer, where an unknown key means *a capability this build has never
heard of* rather than *a typo*, becomes forward-compatible.

**`ui` is only the first instance.** Every top-level key this product will ever add had this problem;
the ruling is about the class, and `ui` is merely what exposed it.

**`INV-nothing-is-dropped-silently` applies to the skip, and is not optional.** A key that is ignored
must **say** it was ignored — otherwise this trades one loud whole-file failure for the quiet
per-setting one the refusal was built to prevent, which is the same trade §6m.10 and §6n.5 refuse
elsewhere.

### R14.3 — the UI is ENABLED BY DEFAULT. Opt out, not opt in.

**The owner chose this against a recommendation of opt-in**, and that is recorded because the
reasoning is the ruling: an observation surface a user has to find out about and switch on is one
most users never see, and R14 exists so that they can look at their own context.

**Enabled means `mycontext ui` is PERMITTED. Enabled is not running.** Nothing listens on a port,
nothing is spawned, no hook behaves differently and nothing about a session changes until the user
runs the command. The config key is a permission, not a daemon — and every claim in R14 depends on
that distinction holding in the implementation, not merely in this paragraph.

**The cost, recorded so it is carried rather than discovered.** Two things move with the default:

- **The no-effect claim now has to hold on the path every install gets.** Under opt-in a defect in
  the gate reaches only users who asked for the UI; under opt-out it reaches everyone, including
  users who will never open a browser.
- **Disabled becomes the less-travelled path.** It is therefore the state most likely to rot, and it
  is also the state a user arrives at deliberately — usually because something has already gone
  wrong. R14.4 is what keeps it honest, and it is why R14.4 refuses to test one direction only.

### R14.4 — "does not affect the plugin" is proven by a DIFFERENTIAL TEST, not asserted

**The test: the same operations run twice, UI enabled and UI disabled, asserting identical injection
text, identical audit records and identical exit codes.** Anything that differs is the finding.

**It mirrors how the no-writes ban is proven.** §0.5 of
`docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md` split that ban into a static half
and a runtime half for precisely this reason: *"A static property and a runtime property are proved
by different instruments; one instrument answering for both is a claim the plan cannot cash."* R14's
claim is a runtime one, so it takes the runtime instrument.

**Both directions must be driven.** Testing only that the disabled path still behaves like today is
testing the branch nobody is on — R14.3 puts every install on the enabled one.

**A static import-graph check was considered and REJECTED as the proof.** It shows that the UI's code
is isolated; it cannot show that behaviour is identical. The failure R14 exists to prevent is the
UI's *presence* quietly changing what gets injected, and no import line discloses that — the same
limitation §0.5 already records against Task 14's static test, where a read that writes internally is
invisible to an import walk. A static check may still be worth having beside the differential one; it
may not stand in for it.

### The three web-UI plans predate R14 — recorded, NOT reconciled here

`2026-08-16-web-ui-1-server-and-reads.md`, `2026-08-16-web-ui-2-palette-and-work.md` and
`2026-08-16-web-ui-3-watch-and-ask.md` were all written before R14 was stated. **ui1 Task 15 builds
`open.ts` and the `mycontext ui` command with no gate at all** — no config key is read, there is
nothing for a slash command to toggle, and no differential test is asked for anywhere across the
three.

**ui2's Configure screen is a second reconciliation point, and a sharper one.** Its Tasks 6, 7 and
13 build `GET /api/config`, `POST /api/config/check` and `POST /api/config/preview` — a validating
`config.json` editor that reads, checks and previews but never writes, composing commands for the
user to run instead. R14 puts the UI's own on/off key into that same file, so that screen will
display it. Whether the surface may offer its own switch-off, and what R14.2's skip-and-warn asks
of a validating editor that must now tell *unknown* from *unknown to this build*, are both
undecided — and neither is decided here.

**They need reconciling with R14, and this section does not do it.** No plan is edited by it, and
nothing above decides how the gate is wired into them. What is decided is only that a gate is
required, that it defaults on, that a slash command moves it, and that a differential test proves the
no-effect claim.

### What R14 sits awkwardly beside — recorded, NOT resolved

- **This document's own frame.** The title is *"scope decisions beyond the web UI"*, and the header
  says of the companion `2026-08-18-v2-decisions.md`: *"which decides the web UI. Nothing here
  reopens it."* R14 is a web-UI requirement. Either that framing or R14's placement is wrong, and
  choosing between them is not this section's to take: R14 is recorded here because it is a member of
  the R-series this document decides, and because the companion decides the UI's **design** rather
  than the requirements it answers to.
- **§7's enumeration.** *"R6–R13 were decided in §§1–6h"* was a complete account of this document's
  requirements until R14 existed. §7 now names R14 as well; nothing else in it changes.
- **§6n.6's premise, which R14.3 puts a date on.** It drops the `git bundle` rung partly because
  *"`src/**` contains **no `child_process` import at all**, so it would be the first subprocess in
  shipped code."* That is still true of the tree today — and ui1 Task 15's `openBrowser` is exactly a
  `child_process` spawn, described there as *"the first `child_process` use in `src/`"*, which R14.3
  then puts on the path every install gets. §6n.6's conclusion may well survive on its other reason,
  that `git subtree split` writes a commit and a ref into the exporter's own repository; the premise
  it is written on does not survive the UI shipping.

---

## 7. Still open

**Nothing is awaiting a decision.** R6–R13 were decided in §§1–6h, re-decided against the code in
§6m after the surveys and the conflict scan, and the eight questions the implementation plans
raised are ruled on in §6n. **R14 is new to this list** — stated by the owner on 2026-08-20 and
decided in §6p, in four rulings.

**What remains is measurement and work.**

**Still unmeasured** — both need an interactive session that `claude -p` cannot produce, and both
now have a task in the hooks plan that measures them FIRST rather than assuming:

- whether `SessionStart` fires on `/clear` at all, what `source` carries, and whether `session_id`
  survives it;
- which hook a slash command reaches, and whether it carries `session_id` — §6m.8 assumes one does,
  and no probe in the record names the event.

**The plans exist**, and are the input to building:

- `docs/superpowers/plans/2026-08-20-v2-categories-and-runbooks.md` — 12 tasks
- `docs/superpowers/plans/2026-08-20-v2-export-import-and-packs.md` — 17 tasks
- `docs/superpowers/plans/2026-08-20-v2-hooks-sessions-and-continuity.md` — 20 tasks

**Each plan predates §6n and must be reconciled with it before execution** — §6n.1, §6n.2, §6n.3,
§6n.5, §6n.6 and §6n.7 each change a task the plans already specify.

**The three web-UI plans predate §6p**, and must be reconciled with it too:

- `docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md` — Task 15 builds `mycontext ui`
  with no gate at all
- `docs/superpowers/plans/2026-08-16-web-ui-2-palette-and-work.md` — Tasks 6, 7 and 13 build a
  `config.json` editor that will show the key §6p adds
- `docs/superpowers/plans/2026-08-16-web-ui-3-watch-and-ask.md`

§6p requires a gate, defaulted on, moved by a slash command and proved by a differential test.
Reconciling the three is outstanding work, not an open decision.
