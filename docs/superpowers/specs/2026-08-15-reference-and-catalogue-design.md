# References, the category catalogue, and discoverable ingest — design

**Date:** 2026-08-15
**Status:** implemented 2026-08-16 — §§2–5 have shipped. Two premises in §2 did not survive
verification and are corrected in `docs/ROADMAP.md` D2.1: `doctor`'s `source_drift` check
required a `source_anchor` and never fired for a whole-file snapshot, so a sibling check was
written; and an item's body silently loses everything from its first Markdown heading, so a
snapshot is stored quoted. §3's last question — whether `runbook` survives `reference` — has
a recommendation (**keep it**, ROADMAP D2.4) and remains the owner's decision, Q5.
**Scope:** a new `reference` category that carries a file's content into context; three new categories
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

## 2. The `reference` category

### The trust problem, first

**If a reference is normative and its target file is editable by an agent, the agent changes what
governs by editing the file.** That routes around the review gate entirely — the hole Plan 3 closed,
reopened through a different door.

This rules out the obvious implementation: reading the file live at injection time. It would also break
`INV-markdown-is-the-source-of-truth` (the item's rendered form would not round-trip) and make budget
unpredictable, since a tracked file can grow without bound.

### The design: a snapshot with drift detection

An `reference` item's **body is a snapshot** of the file's content at capture. `source_file` records
where it came from, `source_checksum` records what it looked like, and `doctor` reports when they have
diverged. Refreshing the snapshot is an ordinary edit and passes through the ordinary gate.

**Almost none of this is new.** `source_file`, `source_anchor` and `source_checksum` are already
frontmatter fields on every item. `doctor` already has `source_drift` and `source_missing` checks.
Ingest already populates all three. The work is a category that uses them deliberately rather than
incidentally, plus a capture path that reads a file.

Requirements:

- **Capture reads the file**: `mycontext add reference "Roadmap" --file docs/roadmap.md`. The body is the
  file's content; the item's own text (title, observations) says why it matters.
- **Drift is a `doctor` finding, not a silent staleness.** The existing `source_drift` check must fire
  for reference items, and its message must name the refresh route.
- **Refresh is a supported command**, not a hand-edit. Decide whether it is `mycontext refresh <id>`, a
  flag on `edit`, or a re-`add` that supersedes — and justify it. Whatever it is, it goes through the
  same gate as any other content change, and under `agentEdits: review` an agent's refresh stages.
- **Budget must be honest.** A 400-line roadmap is a 400-line item competing for the injection budget.
  Spill already discloses what does not fit; verify it does so legibly for a single large item rather
  than only for many small ones, and say what a user sees.
- **A size limit is a real question.** Decide whether capture refuses beyond some size, warns, or is
  silent — and remember that silent is the one option this codebase does not permit.

### Tier

`reference` is **rationale** by default. A roadmap is context, not a rule; and the rationale tier cannot
govern, which keeps the trust problem closed by construction for the default configuration.

A user may retier it to normative in config — that is their call, and the retiering machinery already
honours it — but the documentation must state plainly what that means: **the file's content becomes
governing knowledge, and whoever can edit the file can change what governs, subject only to the
snapshot-and-review cycle.** Do not soften that.

### The open question

**How does a reference interact with `scope`?** A roadmap probably wants `always: true`. A runbook for
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

**If `reference` ships, `runbook` weakens** — you would point at `RUNBOOK.md` rather than write the steps
as an item. Decide `reference` first, and if it lands, re-examine whether `runbook` still earns a
catalogue entry or whether the right answer is `reference` plus a scope.

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

## 5b. The rest of the buried capabilities

A read-only survey ran every candidate against the real corpus and classified how each is documented.
Ingest was not the only one. Ranked by how much each would change a new reader's understanding, with
the urgent one first for a different reason.

### Urgent — `agentEdits` and staged revisions make three README statements false

Phase 1 shipped a trust mechanism with **zero** README mentions, and in doing so overtook three
existing sentences:

- `README.md:1050` — `update_item` "revise an existing item's title, body, scope, tags…". On an active
  normative item it now *refuses* four of those and *stages* three.
- **`README.md:1544-1548` — §7's inventory of what an agent can do**, which still says an agent can
  "revise an item's title, body, tags and extra fields". It cannot; those are staged.
- `README.md:1685` — the same claim in §8.

The middle one is the load-bearing failure. **§7 is the section this project asks people to read
before trusting the tool, and it now describes the wrong boundary.** A README that under-describes a
feature costs a reader an opportunity; a trust-boundary section that describes the wrong boundary costs
them the thing the section exists to give.

Note its sibling key `scopePolicy`, shipped in the same task, got a full config subsection and its own
docs commit the following day. `agentEdits` got none. Fix both the config subsection and §7, and add a
generated `mycontext review revisions` walkthrough.

### 1. Custom categories — the README implies they are impossible

A user can declare a name absent from the catalogue with a `tier` and `description` and get a
first-class category with its own id prefix, participating in tiers, scope, injection and the
slash-command generator. Verified by execution.

**Documented nowhere** — not in either README, not in `src/help/topics/categories.md`. The only prose
anywhere is the error message you get when you do it wrong.

Meanwhile §6 is built end to end on a closed set: three profiles, "the definitions live in the
catalogue", and an enumeration titled "What each category means". A reader whose domain needs
`security_control` or `slo` concludes the product does not fit, and files the fact under the wrong
built-in — which the documentation elsewhere correctly warns is unfixable, since `type` cannot change
after creation.

**This is the finding that most changes what a reader thinks the product is.** Right now §6 reads as
"here are our twenty nouns, pick from them." The truth is that mycontext is a substrate for whatever
normative vocabulary a project actually has, which is a materially larger product.

Two facts to state plainly: the id prefix derives from the name unless `prefix` is set, and a custom
category gets **no** `extraFields`, so `create_item` will not carry category-specific frontmatter for it.

### 2. The global layer — a headline reduced to a clause about sort order

`~/.my-context` is loaded as a second layer beside the project's, with the project winning on a
duplicate id. "Rules I follow on *every* project" is one of the two or three most compelling things
here.

It is documented in two sentences **inside a paragraph about tie-breaking order within a budget**, plus
a glossary row. A reader would come away thinking "layer" is an implementation detail of sorting —
which is literally the sentence it appears in.

**Documenting it will surface a product gap, and that is a reason to do it.** There is no supported way
to *create* a global layer: `mycontext init` creates `.my_context` (underscore) in the cwd, while the
global root is `.my-context` (hyphen) in the home directory, so `cd ~ && mycontext init` produces a
directory nothing reads. No command writes to the global layer — `repair` skips global items,
`requireWritableItem` refuses every non-project write. The only route today is hand-authoring files,
which §7 tells you never to do.

The documentation pass must state that honestly rather than imply a route. Whether to add
`init --global` is a product decision, not a documentation one.

### 3. `query` — named, with nothing to write a query with

Three mentions, none of which gives a table or column name. There is not one `SELECT` in the whole
document beyond the literal string in a table cell.

The command's own usage text already carries the schema **and** a warning the README does not:
`updated_at` is index write time, rewritten to "now" on every row on every run, because every query
rebuilds the index first. A reader who writes `ORDER BY updated_at DESC` gets a meaningless ordering
and no signal. Lift it.

### 4. The lesson → rule flow — better framed than ingest, still no walkthrough

`lesson` records on the rationale tier and emits a derivation request; `lesson-stage` stages candidates
behind short keys; `lesson-accept` creates the rule with a `derived_from` relation back. It has a
bolded lead-in, so it is better off than ingest was — but no worked output and no place in §§1–4, the
narrative that teaches what the product does.

Two facts that surprise people: `lesson-accept` creates an **active** rule with **no confirmation**
(it prints "review before it becomes active" and creates it in the same breath — §7 flags this, the
§5 section does not), and staged candidates are keyed by a content hash, so re-staging changes the keys.

### 5. The `mycontext` skill — one subordinate clause

`skills/mycontext/SKILL.md` is what makes the model capture knowledge *as it is established* rather
than only when asked. It is the whole answer to "will this actually happen without me remembering to
do it" — the first question a non-developer has — and the README mentions it once, as an item in a
list of what `claude plugin details` prints.

### Documented at length without earning it

Roughly 60 lines of closed-issue archaeology, in a document that gives the global layer two sentences:
a 33-line post-mortem of a *fixed* column-width bug sitting in §8, the section reserved for what does
**not** exist, and the `argument-hint` YAML defect told twice at length. Keep the one durable sentence
from each; the rest belongs in `CHANGELOG.md`, which now exists.

### One more inaccuracy, small but in a carefully-written place

`decay` reports items "not injected lately", and its caveat carefully distinguishes injection from
reading. But an item delivered only as an **index line** records nothing in the ledger — verified by
running the SessionStart hook — so an item Claude sees by name every single session reads as stone
cold. The missing sentence is: *an index line is not an injection.*

## 5c. A capabilities summary, at the top

The README opens with the problem, which is right. But a reader who wants to know **what this thing can
do** has to infer it from 1900 lines.

Add a section near the top — after the problem statement, before the mechanics — that summarises the
capabilities in a form someone can scan in under a minute: capture by hand, capture from a document,
derive rules from lessons, inject automatically at four tiers, review what an agent proposes, share
knowledge across projects, query the corpus, and diagnose it.

Constraints:

- **One line per capability, each linking to its section.** It is a map, not a second document.
- **It must not become a place where claims drift.** Every line names a capability the reader will meet
  in full later; a line with no section is a false promise, and a section with no line is invisible
  again. Consider whether the four documentation tests can enforce that correspondence — the inventory
  test already does exactly this shape for commands and tools.
- **It is written last**, once §5b's sections exist, so it maps the document that ships rather than the
  one that was planned.

## 6. Sequencing

1. **The `agentEdits` correction** (§5b, urgent) — first, and not because it is the biggest. §7
   currently describes a trust boundary the code no longer has, and that is the section this project
   asks people to read before trusting it. It is also the only item here that is a *regression* rather
   than a gap: Phase 1 created it.
2. **The buried-capability sections** (§5 ingest, §5b's five) — the highest value per hour in this
   spec, because every one of these features already works. Custom categories and the global layer are
   the two that most change what a reader thinks the product is.
3. **The capabilities summary** (§5c) — written last, once the sections it maps exist.
4. **The catalogue changes** (§3 and §4) — largely data plus documentation, independent of everything
   else, and they share the MAJOR bump so doing them together is cheaper than twice.
5. **`reference`** (§2) — the largest piece and the one with a trust boundary in it. Its outcome
   decides whether `runbook` survives as a separate category.

Note that steps 1–3 are documentation of code that already exists, and steps 4–5 are new code. Splitting
the plan there is natural: the first is a documentation plan that could ship this week, the second is a
feature plan with a version bump in it.

## 7. Risks

| Risk | Mitigation |
|---|---|
| A normative reference lets whoever can edit a file change what governs | Rationale by default; the consequence of retiering stated plainly rather than softened |
| A large reference swamps the injection budget | Spill already discloses; verify legibility for one large item and decide a capture limit — silent is not an option |
| A reference snapshot goes stale unnoticed | `source_drift` already exists; make it fire for reference items and name the refresh route |
| A stale `known_issue` stops work on something now fixed | `valid_until` exists; decide whether to encourage or require it |
| Removing a category silently drops existing items of that type | `loadLayer` already indexes unknown types; add a `doctor` finding naming `supersede` as the route |
| `runbook` is made redundant by `reference` | Decide `reference` first; re-examine `runbook` after |
