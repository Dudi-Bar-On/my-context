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
`todo` appears in the review queue, in search, and in the UI.

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

---

## 2. `procedure` — a one-shot ordered procedure

**A third new category**, and the only one that changes the injection lifecycle.

> *"runbook is distinguished from a rule by it's steps while a rule is a single instruction …
> always it requires the user to initiate it's functionality, the body should state that only after
> user approval it will be used and honored by the llm."*

**Named `procedure`** rather than runbook or playbook: in SRE usage both of those mean the
*repeatable* thing, which is the opposite of the intent here. The distinction from `rule` is
structural and is the owner's own — **a rule is one instruction; a procedure is a sequence**.

### 2.1 Four states, and injection happens in exactly one

| State | Meaning | Injection |
|---|---|---|
| `proposed` | written, not approved. An agent may author one here | **not injected** |
| `ready` | the owner approved it | **index line only** — the model knows it exists and may offer it |
| `active` | the owner initiated it | **injected in full**, every session, until it is finished |
| `done` | completed | **not injected**; kept as the record that the work happened |

**Injecting only in `active` is what makes the requirement honest.** A procedure the model holds
in full is a procedure it may begin following. Delivering it only in the state the owner put it in
deliberately is the mechanism behind *"always requires the user to initiate"* — not a sentence in
the body asking the model to wait.

The body still says so as well, because a reader of the file should not have to infer it from
config.

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

### 2.3 Open — needs design before it is built

- **How a step is represented.** Ordered list in the body, or a structured field? A structured
  field is queryable and renderable; a body list is free and needs no data-model change.
- **Does anything track step-level progress**, or only the item's state?
- **What `superseded` means** for a procedure abandoned rather than completed.
- **Whether a repeatable procedure is a separate thing.** Provisionally no: a `standard` or `rule`
  with ordered steps already covers "do it this way every time", and a second spelling is the
  defect class this project has paid for four times.

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
  they leak repository paths and subagent ids.
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

---

## 6. What the command adds over `git`

Verified end to end: `git subtree split --prefix=.my_context` → `git bundle create` →
`git subtree add` already moves a corpus, with its history and nothing else, into a stranger's
unrelated repository. So the command earns its place through four things git cannot do:

1. **Selection** — a subset by status, category or tag.
2. **Re-grading on arrival** — and this is the whole trust argument. `git subtree add` copies
   bytes, so a git-only import makes a stranger's `status: active` rules govern immediately, with
   no review. **Every imported normative item lands `draft`**, with a new `origin: import`,
   **regardless of any signature**, and there is no `--promote-all`.
3. **Collision reporting** — three buckets, using the existing content hash.
4. **Config-as-semantics** — config **replaces**, it does not merge, and an importer must be told.

A **mandatory Unicode screen** refuses bidi controls, zero-width characters and the Tags block at
the door. Signatures are optional and must never gate import: the May 2026 @antv compromise shipped
639 malicious versions that passed npm provenance verification with forged attestations, and the
Rules File Backdoor hides instructions invisibly in exactly this artefact type. `ssh-keygen -Y
sign` is available on stock Windows 11 — offer it, and describe it as proving **authorship, never
safety**.

---

## 7. Still open

- **R13 template packs** — the transport and trust model are decided with R6 above; what a *pack*
  is beyond an import with different provenance is not.
- **The `procedure` step representation** — §2.3.
- **Cross-session continuity** — §3, item 3.
- **The rule-file exporter** — compiling active normative items into `.claude/rules/*.md`,
  `.cursor/rules/*.mdc` and `.github/instructions/*.instructions.md`. All three frontmatter schemas
  are strict subsets of `scope` + `always` + `title`. Not yet decided.
- **Two claims in the shipped README** that may now be false — see
  `reports/uiux/research/NEEDS-A-PROBE.md`. Neither has been changed, because the first is stated
  as measured and correcting it on an unmeasured report would be the same defect pointed the other
  way.
