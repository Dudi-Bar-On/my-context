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

## 6a. Decided after the probes

**`procedure` steps** — a `## Steps` section, parsed by `splitSections` exactly as
`## Observations` and `## Relations` already are, into `steps: string[]`. A third consumer of an
existing parser is not an invention; a fourth mechanism would be.

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

**Hooks taken into v2.0 scope** — three of the five recommended:

1. **Handle `source === 'clear'` in `SessionStart`.** No new hook: the field is already in the
   payload and `inject.ts` already branches on `source`, only on `'compact'`. Clearing the seen
   file when the window is destroyed means items that were live before the clear can arrive again.
   A failed delete over-injects, which is the safe direction.
2. **`PostCompact`** — restore sooner than the next tool call. Unverified that it fires.
3. **`PostToolUseFailure`** — one audit append on a rare event, feeding the degradation counter,
   which is the empirical check on `INV-hooks-fail-open` whose cost is invisible by design.

`FileChanged` was **not** taken.

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
- **sessions gain names.** A session is a UUID today, which is unusable for "carry from that one".
  How a name is assigned is open: chosen by the user, derived from the first prompt, or both.

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

A command names the current session; sessions never named keep their id and short prefix exactly as
today. Nothing is derived on the user's behalf, because a derived name can be wrong and naming is
precisely the moment you know what a session is for.

**Checked, and it changes the design.** The owner expected Claude Code's own session naming could be
read instead. On 2.1.234 **no session name is visible anywhere a hook could reach**: not in the
transcript JSONL (the only `name` keys are tool names), not in a sidecar file, not in
`~/.claude/config.json`, and `claude --help` exposes no naming flag. The capability may exist in the
app with the name stored somewhere not found here — so mycontext owns the name, and reads Claude
Code's if a later probe locates one.

**Not UI-dependent.** Naming and selecting a session are available from the **CLI and a slash
command**. The web UI is wave 1 of three and this must work without it.

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
The owner has now ruled on all four items below. **R7 produced 23 rejections and one adoption**,
and the rejections are load-bearing: they are the reason this product stays a directory of Markdown
files with no daemon.

### FTS5 — **adopted, scoped, and only because the case is recall**

`node:sqlite` on Node 24.14.0 (SQLite 3.51.2) ships `ENABLE_FTS5` with a working `bm25()`, so this
costs **no dependency**. Rebuild measured at **7 ms for 500 items**.

**Where it goes:** behind `search` and `query_items`. **Nowhere else.** `select()` is untouched, so
what gets injected stays deterministic and `core/search.ts`'s recorded decision against **ranking**
stands unamended — this is adopted as **recall**, which is a different claim. The concrete defect it
fixes: `search "silently drop"` returns nothing today, because matching is substring-literal and the
corpus says "dropped silently".

**The warning ships with the decision.** The research measured that a naive FTS5 swap makes recall
*worse* — `inject` goes from **14 hits to 1**, because tokenisation splits on the boundaries a
substring match spans. So the adoption is conditional on **a recall-parity test asserting FTS5
returns a superset of what substring matching returns**, over the real corpus. Without that test
this change is a regression that reads like a feature, which is this project's characteristic
defect.

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

**Decision: add `docs/solutions/**` to the watched globs.** The `PostToolUse` nudge then fires when
a learning is written there and **a human decides** whether to capture it. This uses machinery
already shipped, respects the trust boundary, and `ingest_document` already covers the one-off
import. **No importer** — one would bind us to another plugin's frontmatter schema for no gain.

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

Broadening the shipped defaults to `docs/**` was rejected: `09-workflows.md` already observed that
nobody reads the nudges, and more of them makes that worse rather than better.

---

## 6g. Step progress, continuity surfaces, session names, home stores — decided 2026-08-19

### `procedure` step progress — checkboxes, and exactly one command may touch them

This closes the last of §2.3. **Representation was already settled**: an ordered list in a
`## Steps` section, parsed the way `## Observations` already is. No second spelling, no
data-model change.

**Progress is tracked, as GitHub-flavoured checkboxes in that same list** — `- [ ]` and `- [x]`.
The Markdown stays the whole truth; "step 3 of 5" is computed by counting, never stored.

**The write path is one narrow command**, `mycontext procedure step`, whose only permitted edit is
flipping a single box matched by a strict regex. It does not go through the draft gate, and the
justification is a distinction rather than an exemption: **the gate exists to stop an agent
changing normative *content*, and a checkbox is progress, not content.** Every other byte of the
item is unreachable from this command, and each flip is audited.

**What is NOT relaxed:** the item's state. `active → done` remains human-only, per §2.2, for the
reason recorded there — an agent that can mark its own procedure done can declare victory. Ticking
the last box does not close the procedure; it lets the agent *ask*.

### Cross-session continuity — the same provenance in both surfaces

A line naming the source session and the count — *"12 index lines carried from session
`auth-refactor`"* — plus a per-item **carried** marker in listings. **The CLI and the UI show the
same information.**

Two reasons, and the second is the load-bearing one. `INV-nothing-is-dropped-silently` was written
about omissions, but **its spirit covers additions**: knowledge arriving from somewhere the user
cannot see is the same defect pointed the other way. And the owner has twice required that a
capability not depend on the UI — making the UI the only place that can answer *"why is this here"*
would reintroduce that dependency through the back door.

### Session names — optional, with an auto fallback

- `mycontext session name <name>` renames the current session; `mycontext session list` shows them.
- **A slash command mirrors both**, per the standing requirement that session selection work
  without the UI.
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

### Contents — knowledge and vocabulary, nothing about the importer's machine

**In:** `items/**`, and the category configuration (which is what `profile` selects).

**Out:** `budgets` and `watchedDocs`.

**The line, stated once so it settles future arguments:** *a pack may carry what its author knows
about the **domain**; it may not carry settings that describe the **importer** — their context
window or their repository layout — because the author cannot see either.* A budget is the one
number a user tunes for their own session; a pack that silently changed how much context mycontext
spends would be doing something the user did not ask a template to do.

### Trust — active at `init`, draft on every later import

The existing boundary has two cases (a human authors; an agent authors and lands a draft). **A pack
is a third case it was not written for**, and it splits:

- **At `init`, into an empty corpus: active.** Choosing the pack *is* the act of trust — you are
  picking your foundation, deliberately, and there is nothing yet for a draft to be reviewed
  against.
- **Importing into an existing corpus: draft.** A stranger's opinion is joining knowledge you
  already verified. It waits for a human, exactly as agent-authored normative content does.

**Draft-always was considered and rejected on an honest cost:** a 40-item pack would produce a
40-item review queue on an empty project, and a queue that size is bulk-approved unread — which is
a worse outcome than no gate, not a better one. **Gating on the manifest was rejected as theatre:**
a checksum a pack carries *about itself* proves the files arrived intact, not that the author is
trustworthy. It is transit integrity, and it must never be described as anything more.

**No `--trust` flag.** A boundary that can be overridden by a flag is overridden by that flag every
time, and then it is not a boundary.

### Authoring — a flag on the export command, not a second implementation

**`mycontext export --as-pack`.** A pack *is* an R6 export with the per-machine parts stripped and a
manifest added; the serialiser, the format ladder (directory / `git bundle` / deterministic ZIP)
and the rules about what does not travel are all already decided there.

This document records that a second spelling of one concept is **"the defect class this project has
paid for four times"**. A separate packer would be the fifth.

### Import — a flag on `init`, a command afterwards

- **`mycontext init --pack <path>`** — the owner's stated requirement, and the surface where the
  active-at-init rule applies.
- **`mycontext pack import <path>`** — every later import, including re-importing a newer version
  of a pack already taken, which §6d established is the only update mechanism there is. This is
  the surface where the draft rule applies.

**One implementation behind both.** The two surfaces exist because the two trust rules do — the
split is the point, not an accident of naming. The three-bucket collision report already decides
what applies on re-import, and nothing applies unconfirmed.

---

## 7. Still open

**Every requirement in R6–R13 is now decided.** What remains is not a decision but a measurement,
and both need something `claude -p` cannot produce:

- Whether `source === 'clear'` really appears on `SessionStart`. The payload carries `source`
  (confirmed present, value `startup`); observing the value `clear` needs an interactive `/clear`.
- Whether a rules file written by the exporter double-fires alongside mycontext's own JIT hook.
  This is why `.claude/rules` is behind a flag in the exporter decision rather than on by default.

**Closed, and listed so nobody reopens them:**

- **R13 packs** — §6h closes contents, trust, authoring and import. Transport is §6c, discovery §6d.
- **`procedure` steps** — §6g closes representation, progress and the write path. §2.3 is fully
  closed.
- **Cross-session continuity** and **session naming** — §6g.
- **R12 integrations**, the **`compound-engineering`** overlap and the **`watchedDocs`** defect —
  §6f.
- The **rule-file exporter** — repo root, Cursor and Copilot by default, `.claude/rules` behind a
  flag. See the handover §3.
- The **two README claims** in `NEEDS-A-PROBE.md` are settled by measurement, not left open. §8's
  "no hook fires at a subagent's birth" was **false and is corrected in both READMEs**; §1's
  "`CLAUDE.md` is unscoped" **stands** — a path-scoped rule did not apply on 2.1.234 while an
  unscoped one in the same directory did.
