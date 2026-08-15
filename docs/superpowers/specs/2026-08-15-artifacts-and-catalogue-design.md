# Artifacts, the category catalogue, and discoverable ingest — design

**Date:** 2026-08-15
**Status:** decisions taken in brainstorming; pending user review
**Scope:** a new `artifact` category that carries a file's content into context; three new categories
(`known_issue`, `runbook`, `environment`); removal of three that overlap live ones (`policy`,
`postmortem`, `taxonomy`); and ingest documented as a capability rather than a table row.

---

## 1. Why

Three requests, one theme: **the corpus should hold the kinds of knowledge people actually have, and
the product should say so where people will find it.**

- There is no way to get a file — a roadmap, a progress log, a runbook — into context. The workaround
  is pasting it into an item's body, where it goes stale silently.
- Three kinds of knowledge that agents repeatedly get wrong have no home: known breakage, procedures,
  and environment differences.
- Three categories ship disabled because they duplicate live ones. A catalogue entry nobody should
  enable is a decision left half-made.
- **Ingest — point at a PRD, get reviewable drafts — is one of the most compelling things this product
  does, and it is documented as a row in a command table 946 lines into the README.** The user read the
  documentation and concluded the feature did not exist. That is a documentation defect with a
  product-sized consequence.

## 2. The `artifact` category

### The trust problem, first

**If an artifact is normative and its target file is editable by an agent, the agent changes what
governs by editing the file.** That routes around the review gate entirely — the hole Plan 3 closed,
reopened through a different door.

This rules out the obvious implementation: reading the file live at injection time. It would also break
`INV-markdown-is-the-source-of-truth` (the item's rendered form would not round-trip) and make budget
unpredictable, since a tracked file can grow without bound.

### The design: a snapshot with drift detection

An `artifact` item's **body is a snapshot** of the file's content at capture. `source_file` records
where it came from, `source_checksum` records what it looked like, and `doctor` reports when they have
diverged. Refreshing the snapshot is an ordinary edit and passes through the ordinary gate.

**Almost none of this is new.** `source_file`, `source_anchor` and `source_checksum` are already
frontmatter fields on every item. `doctor` already has `source_drift` and `source_missing` checks.
Ingest already populates all three. The work is a category that uses them deliberately rather than
incidentally, plus a capture path that reads a file.

Requirements:

- **Capture reads the file**: `mycontext add artifact "Roadmap" --file docs/roadmap.md`. The body is the
  file's content; the item's own text (title, observations) says why it matters.
- **Drift is a `doctor` finding, not a silent staleness.** The existing `source_drift` check must fire
  for artifacts, and its message must name the refresh route.
- **Refresh is a supported command**, not a hand-edit. Decide whether it is `mycontext refresh <id>`, a
  flag on `edit`, or a re-`add` that supersedes — and justify it. Whatever it is, it goes through the
  same gate as any other content change, and under `agentEdits: review` an agent's refresh stages.
- **Budget must be honest.** A 400-line roadmap is a 400-line item competing for the injection budget.
  Spill already discloses what does not fit; verify it does so legibly for a single large item rather
  than only for many small ones, and say what a user sees.
- **A size limit is a real question.** Decide whether capture refuses beyond some size, warns, or is
  silent — and remember that silent is the one option this codebase does not permit.

### Tier

`artifact` is **rationale** by default. A roadmap is context, not a rule; and the rationale tier cannot
govern, which keeps the trust problem closed by construction for the default configuration.

A user may retier it to normative in config — that is their call, and the retiering machinery already
honours it — but the documentation must state plainly what that means: **the file's content becomes
governing knowledge, and whoever can edit the file can change what governs, subject only to the
snapshot-and-review cycle.** Do not soften that.

### The open question

**How does an artifact interact with `scope`?** A roadmap probably wants `always: true`. A runbook for
the billing subsystem probably wants `scope: src/billing/**`. Both are expressible today, so this may
need no new mechanism — confirm rather than assume, and check the interaction with `scopePolicy`.

## 3. Three new categories

The bar, established by the audit and by this spec's §4: **categories are distinguished by mechanics,
not by vocabulary.** A new category must do something the existing ones mechanically cannot.

### `known_issue` — rationale

*This is broken, flaky, or a dead end; do not chase it.*

Mechanically distinct from `lesson` (what we learned from a past incident — retrospective, general) and
from `risk` (what might happen — prospective, uncertain). A known issue is a **present fact about the
system's current state** that should stop an agent spending effort.

This is the highest-value addition available: agents routinely burn a session rediscovering breakage
someone already knows about, and nothing in the current set holds "we know, it is not worth your time."

Worth considering: known issues expire. When the bug is fixed the item is wrong, and a wrong
`known_issue` is worse than none — it stops an agent working on something that now works. The
`valid_until` field already exists. Decide whether `known_issue` should encourage or require it.

### `runbook` — normative

*When you need to do X, these steps, in this order.*

Distinct from `instruction`, which is a **standing directive** — *always* do X. A runbook is
**conditional and procedural**: it applies when a particular operation is being performed, and its value
is the ordering. Agents improvise procedures badly and confidently.

### `environment` — normative

*Production uses X, local uses Y, staging lies about Z.*

Arguably a `constraint`, and the overlap must be addressed rather than waved away. The mechanical
difference: a constraint is a **limit on what you may do**; an environment fact is **conditional on
where the code runs**. An agent reasoning correctly about a constraint can still be confidently wrong
because it assumed the local environment matched production.

**`antipattern` was considered and rejected** — `non_goal` plus `rule` cover it, and it would be the
fourth category in the set to describe "do not do this."

### Interaction worth deciding before building

**If `artifact` ships, `runbook` weakens** — you would point at `RUNBOOK.md` rather than write the steps
as an item. Decide `artifact` first, and if it lands, re-examine whether `runbook` still earns a
catalogue entry or whether the right answer is `artifact` plus a scope.

## 4. Removing three overlapping categories

`policy`, `postmortem` and `taxonomy` ship with `defaultEnabled: false` because each duplicates a live
category — `policy` ↔ `rule`/`constraint`, `postmortem` ↔ `lesson`, `taxonomy` ↔ `glossary`. Since an
item's type is fixed at creation, having two overlapping types enabled means the same fact filed twice
with no way to reconcile.

**Remove them.** A catalogue entry that ships disabled, duplicates a clearer sibling, and is documented
as "turn this on only if…" is a decision left half-made.

This is not free, and each cost must be handled rather than discovered:

- **It is a MAJOR version bump.** `VERSIONING.md` names removing a category as MAJOR precisely because
  the user's config does not change while what governs their project does. Follow it.
- **An existing corpus may hold items of these types.** `loadLayer` deliberately indexes items whose
  category is absent from config — verified during the documentation work, where `list` still showed
  such items rather than hiding them. Removal must not turn those into silent drops.
- **There is no retype.** An item's `type` is fixed at creation, so an existing `policy` cannot become a
  `rule`. The only supported path is `supersede` — capture the replacement, retire the original. The
  documentation must say this, and `doctor` should name any item of a removed category with that route.
- **Confirm these three are the only overlaps.** `adr` versus `decision`, and `standard` versus
  `pattern`, are *deliberate* pairs with documented distinctions — the help topic now carries
  seven close-neighbour comparisons. Do not remove a deliberate pair while removing accidental ones.

Net effect: 20 catalogue entries before, 20 after — three out, three in — and every one of them enabled
in the standard profile rather than three shipping switched off.

## 5. Ingest, documented as a capability

Ingest is implemented and works: `mycontext ingest <path>` emits a chunk plus an extraction request, the
**model is the extractor**, `ingest-apply` lands candidates as **drafts** so nothing governs until a
human promotes it, and sessions resume so a long document survives an interrupted run.

It is documented as three rows in a command table at README line 946. **The user read the documentation
and concluded the feature did not exist.** For the capability that turns an existing PRD into reviewable
project knowledge, that is a product-sized failure.

Requirements:

- **A section of its own**, positioned where a reader learns what the product *does* — not in the
  command reference. It belongs beside capture, because it is capture at scale.
- **A complete worked walkthrough**, generated by the example harness against the committed fixture so
  it cannot go stale: point at a document, see the extraction request, see candidates applied as drafts,
  see them in `review`, promote one. Every block real output.
- **State plainly that the model is the extractor.** This surprises people who expect a parser, and it
  is the reason the output is a *request* rather than a result.
- **State that candidates land as drafts.** It is the answer to "what if it extracts nonsense", and it
  is the property that makes ingest safe to try.
- **Cover resumption and `ingest-status`**, since a real PRD is many chunks and the session is the thing
  that makes that bearable.
- Both READMEs, structurally in step. The Hebrew mirror gets the same section.
- A slash command — `/mycontext:ingest` — is Phase 2 of the user-surface plan; note it, do not build it
  here.

## 6. Sequencing

1. **The catalogue changes** (§3 and §4) are largely data plus documentation, and they are independent
   of everything else. They also force the MAJOR bump, so doing them together is cheaper than twice.
2. **Ingest documentation** (§5) is independent of both and is the highest value per hour of anything
   in this spec — the feature already works.
3. **`artifact`** (§2) is the largest piece and the one with a trust boundary in it. It should follow,
   and its outcome decides whether `runbook` survives as a separate category.

## 7. Risks

| Risk | Mitigation |
|---|---|
| A normative artifact lets whoever can edit a file change what governs | Rationale by default; the consequence of retiering stated plainly rather than softened |
| A large artifact swamps the injection budget | Spill already discloses; verify legibility for one large item and decide a capture limit — silent is not an option |
| An artifact snapshot goes stale unnoticed | `source_drift` already exists; make it fire for artifacts and name the refresh route |
| A stale `known_issue` stops work on something now fixed | `valid_until` exists; decide whether to encourage or require it |
| Removing a category silently drops existing items of that type | `loadLayer` already indexes unknown types; add a `doctor` finding naming `supersede` as the route |
| `runbook` is made redundant by `artifact` | Decide `artifact` first; re-examine `runbook` after |
