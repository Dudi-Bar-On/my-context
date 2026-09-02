# Owner requirements, second addendum — 2026-08-19

Added after the adversarial pass. **These are mostly not UI requirements.** They are product
capabilities for v2.0, and several change the data model, the plugin surface or the install story
rather than the screens. Recorded here so nothing is lost, and so the mockup can say honestly
which of them it does and does not represent.

Numbering continues from `REQUIREMENTS-ADDENDUM.md` (R1–R5).

---

## R6 — Export and import the whole registry

> *"add capability to export and import my_context registry complete so it could be copied to
> another team member or workspace"*

**What it must move:** the corpus (`items/**`), `config.json`, and a decision about the derived
and per-machine state — `.index.db`, `.audit/`, `state/*.seen.jsonl`, `state/focus.json`,
`ledger`. `INV-markdown-is-the-source-of-truth` says the Markdown is the thing; everything else is
a projection. So the honest export is probably *corpus + config*, and the interesting question is
what the receiving side must rebuild and how it knows to.

**Open questions the design must answer:** does an export carry history (the audit log is
append-only and machine-specific) or only present state? What happens on import when ids collide?
Is this a `git`-shaped problem already solved by the corpus being in the repository — and if so,
what does export add for someone who is *not* sharing the repository?

---

## R7 — Multi-session support

> *"add support for multi session"*

**Needs disambiguation before design.** At least three readings, and they are different products:

1. **Viewing** several Claude Code sessions at once — the UI already has one global session
   selector; this would make it a comparison surface.
2. **Serving** several concurrent sessions correctly — the seen file is already keyed
   `session_id::agent_id`, and `INV-hooks-fail-open` plus the measured contention work bear on it.
3. **Multiple workspaces** open at once, or one session spanning several repositories.

The owner should say which; the design should probably answer (2) as correctness and (1) as a
feature.

---

## R8 — A hook on `/clear`, like the one on `/compact`

> *"add hook when /clear command is requested something similar to the /compact command"*

`PreCompact` already writes `state/<sessionId>.restore.json` so the next `SessionStart` can
re-apply the trust gate and restore what was injected. `/clear` destroys the context window
just as thoroughly and currently leaves nothing behind.

**To establish by research, not assumption:** whether Claude Code exposes a hook that fires on
`/clear` at all, and if so its name and payload. This is an external fact about someone else's
software and must be **measured against the installed build**, the standard `agent_id` had to
meet.

---

## R9 — Find the other hooks worth taking

> *"look for other hooks that my_context will benefit from when implementing them"*

mycontext currently uses four: `SessionStart`, `PreToolUse`, `PreCompact`, `PostToolUse`.
Enumerate every hook the installed Claude Code build offers, with its real payload, and rule on
each: what would mycontext do with it, and does that pass the "fail open, stay under the latency
ceiling" bar the existing hooks are held to.

---

## R10 — Make the agent actually use the plugin, always

> *"i want to set a mechanism that will enforce claude code as an agent and also sub agents to use
> mycontext plugin extensively all the time"*

**This is the most interesting requirement in the list and the least obviously solvable.**
Injection already pushes knowledge *in*; this asks for the reverse — that the agent reliably
*captures* to the corpus and *consults* it, in the main thread and inside subagents.

Levers that exist: the four hooks, the MCP tool descriptions, `PostToolUse` nudges, the skill,
slash commands, `CLAUDE.md` instructions, and the deny rules. **Enforcement and encouragement are
different things**, and the design must say which it is achieving. A mechanism that merely asks
is a mechanism that will be ignored under load; a mechanism that blocks has to fail open.

Note the existing evidence: the `post-tool-use` nudge and `op:'deny'` records are already a
feedback channel, and `09-workflows.md` observed nobody reads them.

---

## R11 — More categories

> *"i want to consider adding several categories: tbd or todo features and capabilities,
> prerequisites, defects, bugs, comments"*

**Note the word "consider".** The category vocabulary is a settled, load-bearing part of this
product: 13 normative and 8 rationale, and the tier a category sits in *is* the trust boundary —
an agent may write a rationale item directly but a normative one lands as a draft.

So each proposed category needs: which tier, why, what it changes about injection, and whether it
is genuinely a new *kind* of knowledge or a `tag`/`status` on an existing one. `todo`, `defect`
and `bug` in particular look like they may overlap `known_issue`, which already exists and is
already normative.

---

## R12 — Deep research: what to integrate with

> *"i want you to have subagents do a deep research about what other existing tools and
> technologies will be beneficial to mycontext if used by or integrated with"*

Explicitly delegated to research subagents. Domains worth covering: the agent-memory and
context-engineering ecosystem; developer tooling (git, CI, editors, LSP); emerging standards
(MCP, agent instruction files); and knowledge/ruleset tooling relevant to R13.

Each candidate must be ruled against this product's constraints — **zero runtime dependencies and
no build step are not negotiable for anything that ships inside the plugin**, which sharply limits
"integrate" to protocols, file formats and optional external tools.

---

## R13 — Shareable ruleset templates, applied at init

> *"add capability to predefine a template like of rullsets that could be made by users, shared
> and imported to mycontext at init stage to have a flavored pre defined categories items
> registry"*

A pack of pre-authored items plus category configuration, published by someone, imported at
`mycontext init` to give a workspace an opinionated starting corpus — "the React flavour", "the
regulated-industry flavour".

**Interacts with several settled things:** the trust boundary (an imported normative item was
authored by a stranger — draft or active?), `PROFILES` in `categories.ts` (which already does part
of this for category configuration), and R6's import path (a template is an import with different
provenance). It also shares a supply-chain shape with anything installable, and this product's
whole culture is about not trusting text it did not verify.

---

## How these relate to the mockup being built now

| Req | Represented in the mockup? |
|---|---|
| R6 export/import | **Yes, as a screen** — but marked as proposed, since no command implements it |
| R7 multi-session | **Partly** — the session selector exists; comparison does not |
| R8, R9 hooks | No — no UI surface until the hooks are established by measurement |
| R10 enforcement | **Partly** — the degradation counter and deny wall are its evidence surface |
| R11 categories | **No** — the category list shown stays the real one; inventing categories in a mockup is the defect this project names |
| R12 integrations | No |
| R13 templates | **Yes, in first-run** — marked as proposed |

The rule the mockup follows: **anything not built is labelled as not built.** A mockup that shows
an unimplemented capability without saying so is this project's characteristic defect, and it has
already been caught twice in this file's history.


---

# Owner clarifications — 2026-08-19, after the research reported

The research answered several of these against assumptions the owner did not make. **Each
clarification below overrides the corresponding section above and the research's ruling on it.**

## R7 — clarified. It is three things, and one of them is new.

> *"same mycontext registry could be used in several sessions, the user can decide to start a new
> session on a workspace, mycontext field with items from previous session could be injected and
> used in the new session too. the ui should allow switching views between sessions. also maybe the
> user opens more then one session in different terminals but on the same workspace — they all
> should be served by mycontext same ruleset and items."*

So all three readings were partly right and one thing was missing:

1. **Concurrency** — several terminals, same workspace, one registry serving all of them with the
   same ruleset. This is a correctness requirement.
2. **Switching views between sessions in the UI** — a feature, and the data already exists.
3. **[NEW] Cross-session continuity** — what a previous session was given should be available to a
   new one. **This is not what the product does today.** Dedupe state is per-session
   (`state/<sessionId>.seen.jsonl`) and a new session starts with an empty seen set by design.
   The `restored` tier does this across a *compaction*, not across a *session boundary*.

Item 3 is the substantive new requirement and needs its own design: what does a new session
inherit, on what evidence, and how does the user see that it happened?

## R6 — clarified. Two corrections to the research.

> *"who said that tarball is the single and best solution? we could research and find better that
> maybe fit better, also history could be also be exported by including the audit too (native or
> filterred) — it just should include the relevant info loged so it could fit."*

1. **The format is open.** The research ruled on a tarball because this document offered one. It
   was not the owner's proposal. **Research the format properly** before ruling.
2. **History is in scope.** The research concluded the honest export is corpus + config, because
   the audit log is machine-specific. The owner wants the audit **included, natively or filtered**
   — carrying the relevant records rather than all of them. That changes the ruling: the question
   is not *whether* history travels but *which records* do, and what a receiver may trust.

## R11 — NOT accepted. The research missed the function these categories serve.

> *"1 — we have the capability that a user can add new categories by itself so over time categories
> may increase also it would be a better feature to get it's new added category and add it to the
> predefined categories. 2. todo / tbd new features and capabilities and also bugs and especially
> comments are free way to let the user add somthing that raises in it's mind during development so
> it would be handled later and not be forgotten, they could be just retional or have a structured
> procedure to convert them to normative with a link and or generated a new item…"*

The research argued these duplicate `known_issue`, `Observation` and issue trackers. **That answers
a question about taxonomy; the owner asked about capture.** The function is an **inbox**: a
low-friction place to put a thought during development so it is not lost, with a **structured
promotion path** out of it — a `todo` becoming a decision, or a runbook, with a link back.

Two further requirements the research did not address at all:

- **Users can already define their own categories**, so the vocabulary is not closed in practice.
  The owner wants the reverse flow too: a category a user invents should be promotable **into the
  predefined set**.
- The promotion path may **generate a new item of a different category**, linked to its origin.

## R11b — NEW: runbooks. A one-shot ordered procedure.

> *"another idea — runbook (or to call it with different name) an orderd set of instructions but the
> difference is that it should be done only once as a fixing or other action vice a set of
> instructions that are repeatable."*

A distinct kind of knowledge nothing in the corpus currently holds: **an ordered procedure that is
performed once and then done**, as against a standing rule that applies every time.

Design questions it raises, none answered:
- What marks it complete, and what happens to it afterwards — `superseded`? A new status?
- Is it injected? A one-shot procedure that keeps arriving in every session is noise after the
  first time; one that never arrives is useless.
- How does it differ from a `todo` that has steps?
- Is "repeatable procedure" a second new kind, or is that what a `rule` or `standard` already is?

## R10 — NOT accepted. The mechanism, not the enforcement point.

> *"none — what i want to ensure is that the coder always will use mycontext regulary and i am
> looking for a mechnism to verify it uses it like for example a predefined rule or category that
> instructs the model to use mycontext, it is injected and let the model know it from the beginning
> and ensure it is always in context memory so it will not forget and stop using it. i want to look
> at the claude code documentation deeply and find the solution from there."*

The research answered *"where can a violation be made to fail"* — CI. The owner asked something
else: **how do you keep the instruction alive in the model's context so it does not drift out of
the habit**, and **how do you verify it is still using the plugin**.

Two parts, both open:
1. **The instruction that persists.** A pinned item, an output style, a skill, `CLAUDE.md`, a rule
   file, a hook that re-asserts — the owner wants this researched **against Claude Code's own
   documentation**, deeply, rather than reasoned from first principles.
2. **The verification.** A way to observe that the agent is actually using it — which the audit log
   may already support, since it records every injection, every mutation and every hook action.
