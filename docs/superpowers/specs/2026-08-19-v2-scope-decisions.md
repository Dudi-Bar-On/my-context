# v2.0 — scope decisions beyond the web UI

**Date:** 2026-08-19
**Status:** decided by the owner, one question at a time
**Decides:** requirements R6–R13 in `reports/uiux/REQUIREMENTS-ADDENDUM-2.md`, and the category
question the expert panel answered incorrectly
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

**Two is the final count, and it is two on purpose.** §2 below went on to propose a third — a
`procedure` category for one-shot ordered work — and §6m.1 withdrew it: the shipped `runbook`
category already carries that meaning and gains the one-shot lifecycle instead. Nothing new is
created for it, so the count above is the whole answer: `todo` and `note`.

---

## 1. The category vocabulary gains two entries

| Proposed | Decided | Where it goes instead |
|---|---|---|
| `todo` / `tbd` | **NEW category** | — |
| `comments` | **NEW category, named `note`** | — |
| `prerequisites` | **not a category** | the existing `blocks` relation |
| `defects` | **not a category** | `known_issue`, which already exists and is already normative |
| `bugs` | **not a category** | as above |

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
> `status === 'draft' && layer === 'project'` (`src/core/select.ts:344-347`) and a rationale item is
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

- creates the target item (a `decision`, a `requirement`, a `runbook`, a `known_issue`),
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

## 2. `runbook` — a one-shot ordered procedure

**No new category.** `runbook` already ships and gains a lifecycle, and that lifecycle is the only
part of this work that changes how injection behaves.

> *"runbook is distinguished from a rule by it's steps while a rule is a single instruction …
> always it requires the user to initiate it's functionality, the body should state that only after
> user approval it will be used and honored by the llm."*

**Why the shipped `runbook` and not a new category.** `runbook` already exists — normative, prefix
`RUN`, *"The steps for a named operation, in the order they must be taken"*
(`src/core/categories.ts:40`) — which is almost exactly the description a new category would have
been given, and R11b's *"runbook (or to call it with different name)"* was naming that existing
category rather than proposing another. The distinction from `rule` is structural and is the
owner's own — **a rule is one instruction; a runbook is a sequence**.

> **CORRECTED 2026-08-19, by implementation survey.** This section originally created a **third new
> category named `procedure`**, and argued the name from SRE usage, where "runbook" and "playbook"
> both mean the repeatable thing. §6m.1 withdrew it: `runbook` ships with this description already
> and takes the one-shot lifecycle instead. §§2.1-2.3 below therefore read `runbook` throughout and
> an item id is `RUN-`, never `PROC-`. The lifecycle, the injection rule and the completion gate
> are unchanged — only the category is. **How the four lifecycle stages are *represented* did
> change**: they are not four bespoke statuses, and §2.1 below now states the mapping §6m.2 ruled.
> §2.3's open list is closed in place for the same reason — a planner reading this section in order
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
`validated` as still governing — a completed runbook would keep governing. And `deprecated` is
counted in `retired`, so a finished runbook still appears in a session-visible number instead of
vanishing from every tally, which is what `INV-nothing-is-dropped-silently` demands.

**Activating a runbook is two human writes, and this spec says so rather than leaving it to be
discovered.** `status: active` makes the item eligible; **`always: true` is what delivers it in
full every session** rather than as an index line, because "injected in full" is a property of the
`always` flag and its tier membership, never of a status. The owner's act of initiating a runbook
therefore sets **both**, and a plan that sets only the status ships a runbook that is merely
eligible — indexed, not delivered, and silently not doing the one thing this lifecycle exists for.

**`ready` yields no index line today, and that is the one question this lifecycle leaves open.**
`buildIndex` enumerates only eligible items and `isEligible` admits only `active`, so a `ready`
runbook — a draft carrying a tag — is not indexed at all. §6i.3 records the choice and it is still
open: either `select()` gains a per-item injection mode, or `ready` is a review state with no
injection and the model does not learn a runbook exists until the owner makes it `active`. **Nothing
may be built on "index line only" until that is decided.**

**Injecting only in `active` is what makes the requirement honest.** A runbook the model holds
in full is a runbook it may begin following. Delivering it only in the state the owner put it in
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
- **The agent may ask or notify** — "the steps of `RUN-x` appear complete; mark it done?" — but
  **never decides**. The same gate as activation, for the same reason: an agent that can mark its
  own runbook done can declare victory.
- The audit record then carries `origin: 'human'`, which is the only thing that evidences a human
  did it.

**The failure mode this guards against** is the opposite of the obvious one: not a runbook
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
- **What `superseded` means — DECIDED.** An abandoned runbook is `superseded`, with `supersede --by`
  pointing at whatever overtook it. No fifth state and no new command. See §6d.
- **Whether a repeatable sequence is a separate thing.** Provisionally no. This bullet originally
  named only `standard` and `rule` as already covering "do it this way every time" and **omitted
  `runbook`**, which was precisely that category — *"The steps for a named operation, in the order
  they must be taken"* — and the omission is how this section came to propose a new one at all.
  Under §6m.1 `runbook` takes the one-shot lifecycle, so the repeatable case is a `standard` or
  `rule` with ordered steps; a second spelling is the defect class this project has paid for four
  times.

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
how does the user see that it happened? It is unspecified and needs its own design.

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
> (`src/core/types.ts:4`), enforced twice. The ruling that matters is unchanged and turns out to be
> already implemented — everything imported lands `draft`, regardless of any signature — so what is
> gone is the invented origin and the branch inside `trustedStatus` it would have needed, not the
> rule it was invented to serve.

---

## 6a. Decided after the probes

**`runbook` steps** — a `## Steps` section holding the ordered checkbox lines, read into
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
none of which `HookInput` declares.

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

## 6d. Packs, session names, abandoned runbooks

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
> id**, and `src/core/focus.ts:21-31` records the codebase hitting exactly this and conceding it —
> escaping to **workspace** scope, an escape a session name cannot take, because distinguishing one
> session from another *within* a workspace is the whole point of the name. §6m.8 rules the
> explicit-id form stated above. Everything else here stands and is what the finding leaves intact:
> mycontext owns the name, nothing is derived, and an unnamed session keeps its id and short prefix.

### An abandoned `runbook` is `superseded`

The existing status already means exactly this: no longer governs; file, body, observations and
relations all kept; still searchable; rendered by every screen that exists. And `supersede --by`
lets an abandoned runbook point at whatever overtook it. **No fifth state, no new command, no new
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
   untouched. That decision's subject is not `select()`. Verbatim, `src/core/search.ts:6-8`: *"The
   corpus filter behind **BOTH** `query_items` (the model's tool) and `mycontext search` (the
   user's command)."* Those are **exactly the two surfaces FTS5 was to sit behind**, so the
   protective clause guarded a module the decision never governed and left the only module it did.
2. **The motivating query misses on field coverage, not tokenisation.** The predicate is
   `` `${item.title}\n${item.body}` `` — title and body only (`search.ts:50`), verified — and the
   phrase sits inside an `## Observations` section. The corpus does contain it. **FTS5 over title
   and body reproduces the miss exactly**, so the swap buys nothing on the example that motivated
   it.
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

1. **Extend the `text` predicate to `observations` and `extra`.** **One line**, no new machinery,
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
> `src/core/focus.ts:21-31` records the codebase already hitting and conceding, and which §6j sets
> out in full. The form is now `session name <id> <name>` with `session list` to find the id, and
> the slash command supplies the id because it arrives as a prompt and therefore reaches a hook that
> carries one. **§6m.11 — carried index lines have a budget.** §6l F13 found that neither this
> section nor §6c said which; carried lines now deduplicate against the new session's own index and
> then queue inside the same `budgets.index`. The two `CORRECTED` notes inside the step-progress
> subsection below are earlier and stand as written.

### `runbook` step progress — checkboxes are representation; progress is session state

This closes the last of §2.3. **Representation was already settled**: an ordered list in a
`## Steps` section, parsed the way `## Observations` already is. No second spelling.

> **CORRECTED 2026-08-19, by implementation survey.** This paragraph originally ended "no
> data-model change", and that was **false**. `validateBody` refuses any line matching
> `/^#{1,6}\s/` inside a body (`my-context/src/core/validate.ts:234-247`), so a `## Steps` section
> cannot live in `body` at all — it must be a first-class `Item` field, exactly as `observations`
> is. The parallel to `## Observations` holds; the inference drawn from it did not. See §6i.

> **CORRECTED 2026-08-19, by the conflict scan.** This subsection originally gave
> `mycontext runbook step` a **write path into the item file** — flipping a single checkbox matched
> by a strict regex, exempted from the draft gate on the distinction that a checkbox is progress
> rather than content. §6m.3 withdrew that write path: **progress lives in session state or the
> audit log, never in the item.** The checkbox survives as *display*; what changed is where progress
> is **stored**. See §6l F4, and §6i.4, which reached the same place from the type system.

**The steps are immutable Markdown.** A `## Steps` field holds GitHub-flavoured checkbox lines —
`- [ ]` — authored once with the runbook and never rewritten by the tool. They are the knowledge:
what to do, in what order.

**Progress is recorded outside the item.** `mycontext runbook step` writes *"step 3 of `RUN-x`
done"* into **session state or the audit log**, and nothing else. "Step 3 of 5" is still computed by
counting and still never stored as a number — it is now counted from that record rather than from
bytes in the corpus. A ticked box in a listing is **rendered**, by laying the session's progress
over the stored list at display time; the file on disk does not move.

**What that buys, stated plainly, because it is the whole reason the write path was withdrawn:**

- **`UPDATE_FIELD_POLICY` is untouched.** `FieldPolicy` stays `'content' | 'gated'`, and the four
  `Assert<>` types that pin both classes in both directions keep their compile-time guarantee
  (`src/core/trust.ts:322-359`). The original "third thing — progress, neither content nor gated"
  compiled to neither, which §6i.4 recorded; there is now no third thing to express.
- **`checksum` never moves on a tick**, so `doctor` never reddens because somebody made progress —
  and `INV-markdown-is-the-source-of-truth` stays honest, because progress is not knowledge and
  never enters the corpus.
- **The command no longer writes into `items/` at all**, so **the "first hole in the boundary" §6l
  F4 identified does not open.** There is no narrow exemption to police, because there is no
  exemption: the gate that stops an agent changing normative content is never asked to make the
  distinction.

**What is NOT relaxed:** the item's state. `active → done` remains human-only, per §2.2, for the
reason recorded there — an agent that can mark its own runbook done can declare victory. Recording
the last step does not close the runbook; it lets the agent *ask*. That was true when the tick lived
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
> (`src/core/trust.ts:166-169`), and §6 had already ruled universally that *"every imported
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
categories are *enabled* (`config.ts:441,461`); the `categories` block **also** carries `tier` and
`agentEdits`, and a `tier` override drags `agentEdits` with it (`config.ts:559-563`). A pack
shipping `"rule": {"tier": "rationale"}` would land every future agent-authored `rule` **active**
instead of draft *and* stop every existing `rule` being injected at all — **strictly more power than
the `--trust` flag this section refuses, delivered through the surface this section called safe.** A
`tier` override is that same power with a longer name and no prompt.

**And a pack's config MERGES field-wise; it does not replace.** §6's "config replaces, it does not
merge" was written for a whole-workspace R6 export, where it is correct and **applies there still**.
This section inherited it from a case it does not fit: a pack config with `budgets` and
`watchedDocs` stripped — which this section *requires* — would **reset both to product defaults** on
import (`config.ts:342,388`), doing precisely what the next paragraph forbids, through the mechanism
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
never-injected, never-indexed and no draft gate through `isNormative` (`src/core/select.ts:473`).
**Their real cost is 22 hand-typed enumeration sites**, which is the "half-added category" hazard,
not the engine.

### 1. `## Steps` cannot live in the body — CORRECTED in §6g above

`validateBody` refuses any heading line (`src/core/validate.ts:234-247`), so steps must be a
first-class `Item` field. That touches parse, render, `computeItemChecksum`, `itemContentHash`,
`renderItemBlock` (which is budget-correctness, so getting it wrong mis-sizes injection), the MCP
schema and ingest. `splitSections` is already generic and SQLite needs no DDL — `data` is a JSON
`TEXT` column.

**§6g's "no data-model change" was wrong and is struck above.** The decision stands; its stated
cost was understated.

### 2. `ready` has no home in the status vocabulary

`isEligible` admits exactly `'active'` (`src/core/select.ts:124`); everything else is `draft` or a
retired status. §2.1's four runbook states therefore need a mapping rather than four new statuses.

| §2.1 state | Maps to | Note |
|---|---|---|
| `proposed` | `draft` | already means "written, not governing" |
| `ready` | **no clean home** | see below |
| `active` | `active` | |
| `done` | `deprecated` | **not `validated`** — `governsNormatively` treats `validated` as still governing, so a completed runbook would keep governing |

**Ruling:** `done → deprecated`, on the survey's evidence. Cost if wrong: a completed runbook is
listed among deprecated items rather than under a status of its own — cosmetic, and reversible.

**`ready` is left open**, because it is the same question as §6i.3 and should be answered once.

### 3. The full-text / index-line split has never been per-item

It is a **category** lookup — `isNormative(item, config)` at `src/core/select.ts:473` and `:358`.
`always`, `scope` and `severity` modulate *tier membership*; none of them has ever modulated that
split. §2.1's "index line only when `ready`, full text when `active`" would be **the first per-item
case**, and `select()` documents itself as the one place that rule may live.

**Not ruled on.** This is the substantive design question left in `runbook`, and it is worth
deciding deliberately rather than inside a fix loop: either `select()` gains a per-item injection
mode, or `ready` is dropped and a runbook is simply not injected until it is `active`.

### 4. `mycontext runbook step` does not fit the field policy

`UPDATE_FIELD_POLICY` (`src/core/trust.ts:322-359`) types every updatable field as
`'content' | 'gated'`, with `satisfies Record<…>` and four `Assert<>` types pinning both classes in
both directions. **§6g's third thing — "progress, neither content nor gated" — compiles to
neither.** Two honest routes: a third policy member with new assertions, or a write path outside
`updateItem` entirely, for which `observations` (create-only) is the existing precedent.

**Not ruled on.** The decision that a checkbox is not content stands; how it is expressed in the
type system is an implementation choice the plan should make with the code in front of it.

### 5. `RELATION_TYPES` is closed, and §1.3 needs a relation

Promotion "with a link back" (§1.3) needs a relation type. `RELATION_TYPES`
(`src/core/vocabulary.ts:42-45`) is a closed vocabulary and **`derived_from` is the only honest
fit**. **Ruling:** use `derived_from` rather than adding a ninth relation. Cost if wrong: a
promoted `todo` reads as "derived from" its origin rather than "promoted from" — accurate, if less
specific, and adding a relation type later is cheaper than removing one.

---

## 6j. Hooks and sessions — what the survey found. 2026-08-19

Source: `.superpowers/sdd/2026-08-19-v2-scope-decisions/survey-hooks-sessions.md`. Three findings
help; one **contradicts a decision** and goes back to the owner.

### ⚠️ `mycontext session name <name>` cannot know which session is current

**This is not a difficulty. It is a thing the codebase already tried, measured and conceded.**

`src/core/focus.ts:21-31` records the same problem being hit before: **no surface that can *set*
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

Three implementations already exist: `audit-db.ts:447` `sessions(db, limit)` over the projection's
generated `session_id` column, `audit.ts:491` `sessionsWithoutDb` from raw JSONL, and
`ledger.ts:242` `recentSessions`. **`mycontext audit --sessions` already prints the list today.**
"What that session had" is equally derivable — `ledger.ts:263` `itemsUsedIn`.

So cross-session continuity needs a *selector and a carry*, not a new store.

### ⚠️ There is effectively no hook timeout, and `SubagentStart` blocks

The only in-process timer in the hook layer is `post-tool-use.ts:121-122`
(`setTimeout(() => process.exit(0), 2000)` with `unref()`). SessionStart, PreToolUse and PreCompact
each carry an explicit comment saying they deliberately have none — `io.ts:52`'s
`readFileSync(0, 'utf8')` blocks the thread outright, so no timer can preempt it. The only real
bound is `"timeout": 10` declared in `hooks.json`, which is **Claude Code killing the process**, not
mycontext failing open.

Set beside the measured fact that a 3,018 ms `SubagentStart` hook delayed the subagent's first tool
call by that much: **taking `SubagentStart` puts an unbounded-by-us hook on the critical path of
every subagent dispatch.** `INV-hooks-fail-open` is satisfied by the external kill, not by anything
mycontext does. The plan must say so explicitly rather than implying the invariant covers it.

### ⚠️ Seen files accumulate, and the unit is context windows

`pruneSnapshots` (`ledger.ts:456-486`) is age-based — 30 days by mtime — and its **only production
caller is `cmdRebuild`** (`cli/index.ts:664`). No hook prunes. There is no `SessionEnd` hook, and no
`clearSeen` function exists anywhere; only age-pruning.

Measured in this repository right now: **15 `.seen.jsonl` files for a single session id** — one
parent plus fourteen subagent files — over roughly two days, invisible to git because
`writeSnapshot` drops a `.gitignore` of `*` beside them.

Two consequences for decided work: handling `source === 'clear'` needs a defined answer for the
`session::agent` sibling files, since a per-session clear misses them; and whether `/clear` even
preserves `session_id` **is recorded nowhere and is unprobed**.

### Implementation note that will bite if missed

`parseAudit` (`audit.ts:280`) **refuses unregistered ops**. Any new hook op must be added to
`HOOK_OPS` / `INJECTION_OPS` *and* `KIND_OF`, or the audit log rejects its own records — a failure
that would look like the hook silently not running.

---

## 6k. Export, import and packs — what the survey found. 2026-08-19

Source: `.superpowers/sdd/2026-08-19-v2-scope-decisions/survey-export-packs.md`. Two decisions are
**cheaper** than assumed, one is **blocked by code**, and one part of §5 is **wrong as written**.

### ⚠️ Active-at-`init` is blocked by the trust layer, and it is blocked deliberately

`trustedStatus` (`src/core/trust.ts:166-169`) **unconditionally demotes every non-human origin on a
normative category**. There is no parameter, no flag and no caller-supplied override.

That is convenient in one direction and fatal in the other:

- **§6h's draft-on-later-import comes free.** Nothing to build.
- **§6h's active-at-`init` cannot be expressed.** And §6h itself forbids the obvious escape: *"There
  is no `--trust` flag; a boundary a flag can override is not a boundary."*

`origin: 'import'` does not exist either — `Origin` is closed (`src/core/types.ts:4`) and enforced by
two separate `ORIGINS` lists.

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

The audit log is **gitignored and documented as never travelling** — `src/core/jsonl-log.ts:74-78`,
`src/core/audit.ts:42-49`, and **both READMEs**. §5 reverses that on the owner's explicit
instruction (*"history could be also be exported by including the audit too"*), and the code permits
it. **The prose is what must change**, in both READMEs, or the product will ship documentation that
contradicts its own feature.

### ⚠️ §5's "does not travel" list is incomplete — three directories are unmentioned

`.revisions/`, `.ingest/` and `.staging/` all exist and appear nowhere in §5. **`.revisions/` stores
the text of discarded proposals** (`src/core/revision.ts:1196`) — an export built as a deny-list
would ship rejected drafts to a stranger.

**Ruling: the exporter is an allow-list, not a deny-list.** Only what is named travels; anything the
product grows later is excluded by default and must be added deliberately. Cost if wrong: a
directory that should have travelled is omitted, which is visible and fixable — the opposite error
leaks and is not.

### ✅ The audit discriminator exists, exactly as §5 assumed

`AuditKind = 'mutation' | 'injection' | 'hook' | 'focus'` (`src/core/audit.ts:75`), stored per
record, derived from one total `KIND_OF` table (`:119-131`), validated on read (`:283`), with
`filterAudit(…, {kind})` (`:482`) already the shared filter. `MUTATION_OPS` (`:82-85`) matches §5's
ten names exactly. **§5's filtering decision rests on something real.**

Better still, §5's claim that mutations carry no `sessionId` or `path` holds **by construction** —
the only two writers (`persist.ts:121`, `revision.ts:1198`) have no parameter for either. The type
permits them, so the exporter should *project* the fields it emits rather than pass records through.

### ✅ Collision detection is already written

`itemContentHash` (`src/core/content-hash.ts:104`) — the same predicate `createItem` uses — excludes
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
(`config.ts:441,461`). The `categories` block **also** carries `tier`, `agentEdits`, `scopePolicy`
and `prefix` — and a `tier` override drags `agentEdits` with it (`config.ts:559-563`).

So a pack shipping `"rule": {"tier": "rationale"}` does two things at once, and `resolveConfig`
accepts both without complaint because every value is valid:

1. every future agent-authored `rule` lands **active** instead of draft — `tierOf` reads the
   resolved config (`trust.ts:184-188`) and `trustedStatus` gates on tier;
2. every existing `rule` **stops being injected at all** — `isNormative` (`select.ts:129-131`).

**That is strictly more power than the flag §6h refuses, delivered through the surface §6h calls
safe.** A pack can silently disarm the trust boundary and un-inject the importer's whole normative
corpus.

**Second half of the same finding:** §6 says config **replaces**, it does not merge. A pack config
with `budgets` and `watchedDocs` stripped — which §6h *requires* — resets both to product defaults
on import (`config.ts:342,388`). §6h's own words: *"a pack that silently changed how much context
mycontext spends would be doing something the user did not ask a template to do."* Exactly that,
through the mechanism chosen to prevent it.

**Fix that keeps §6h's line intact:** a **field-level merge of the `categories` block only**, with
`tier` and `agentEdits` overrides **refused outright** from a pack. §6's replace-not-merge was
written for a whole-workspace export, where it is correct; §6h inherited it from a case it does not
fit.

### F5 — the FTS5 decision protects the wrong module, and the real defect is one line elsewhere

**CORRECTION to §6f.** §6f claims *"`core/search.ts`'s recorded decision against ranking stands
unamended"* because `select()` is untouched. **The decision's subject is not `select()`.** Verbatim,
`my-context/src/core/search.ts:6-8`:

> *"The corpus filter behind **BOTH** `query_items` (the model's tool) and `mycontext search` (the
> user's command)."*

Those are **precisely the two surfaces §6f puts FTS5 behind.** The protective clause guards a module
the decision never governed and leaves the only module it does. The decision is amended by this
adoption, whether or not `select()` moves.

**And the motivating example fails for a different reason than stated.** §6f says
`search "silently drop"` misses because matching is substring-literal. The predicate is
`` `${item.title}\n${item.body}` `` — **title and body only** (`search.ts:50`), verified. The corpus
does contain the phrase; it sits inside `## Observations`. **The miss is field coverage, not
tokenisation, and FTS5 over title+body reproduces it exactly.**

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
(`trust.ts:321-351`). §6g's third class fails to compile **by construction** — and that table exists
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
(`trust.ts:161-169`, verified) — *"a non-human caller that explicitly passes `status: 'active'` … is
still forced to `draft`, or one argument would defeat the whole boundary."*

**The scan's answer is better than my three routes in §6k.** §6h's argument — a 40-item review queue
gets bulk-approved unread — supports *"make bulk review tractable"*, not *"skip the gate"*. A
`review promote --all --pack <name>` behind one confirmation is the same human act §6h calls
"choosing the pack", made **after** the corpus is visible rather than before.

**This supersedes §6k's recommendation of route (3).**

### F3 — §2.1's four states are three new `Status` values, and two are unreachable

`Status` has five members (`types.ts:2`). `ready` cannot produce an index line — `buildIndex`
enumerates only `eligible`, and `isEligible` requires `active` (`select.ts:124,357`). `done` is
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
taken"* (`categories.ts:40-41`). The scan adds the decisive point: **the owner was naming the
existing category** — R11b says *"runbook (or to call it with different name)"*.

So the live question was never "what do we call the new thing" but **"does `runbook` become the
one-shot procedure, or does `procedure` ship beside it"** — and §2 never asks.

### The rest, in one line each

- **F9** — `todo` can never reach the review queue: the queue is `status === 'draft'`
  (`select.ts:344-347`) and a rationale item is never forced to draft. §1's own §1.1 says "no draft
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
(`categories.ts:40-41`). R11b's own words were *"runbook (or to call it with different name)"*: the
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

1. `search.ts:6-8` — the recorded decision's subject is *"BOTH `query_items` … and `mycontext
   search`"*, exactly the two surfaces FTS5 was to sit behind. §6f's clause protected `select()`,
   which the decision never governed.
2. The motivating example misses on **field coverage**: `search.ts:50` is
   `` `${item.title}\n${item.body}` `` — observations are not searched, and that is where the phrase
   was. FTS5 over title+body reproduces the miss exactly.
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
is in — which `focus.ts:21-31` records as unknowable.

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

## 7. Still open

**Nothing is awaiting an owner decision.** R6-R13 were decided in §§1-6h; the surveys and the
conflict scan (§§6i-6l) found twelve places where a decision or its argument did not survive the
code; all twelve were ruled on in §6m, which supersedes the earlier sections where they conflict.

**What remains is measurement and work, not choice.**

**Still unmeasured** — both need an interactive session that `claude -p` cannot produce:

- whether `SessionStart` ever reports `source === 'clear'`, and whether `/clear` even preserves
  `session_id`, which is recorded nowhere;
- whether a rules file written by the exporter double-fires alongside mycontext's own JIT hook.

**Applied to this document on 2026-08-19:** every `procedure` reference across §2, §6a, §6d, §6g
and §6i now reads `runbook`, every `PROC-` id is `RUN-`, §1's "appears in the review queue" is
corrected, and §0 is restated. The sections whose *conclusion* changed carry a `CORRECTED` note; the
pure renames do not.

**Known work that follows from §6m, not yet planned:**

- correct the audit-travel prose in both READMEs and the two source comments;
- the implementation plans themselves, which do not exist — the three surveys
  (`survey-categories.md`, `survey-export-packs.md`, `survey-hooks-sessions.md`) are their input.
