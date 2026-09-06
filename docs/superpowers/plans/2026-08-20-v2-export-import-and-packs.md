# v2.0 Plan — export, import and packs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `mycontext export`, `mycontext export --as-pack`, `mycontext pack import`, `mycontext init --pack` and `mycontext review promote --all --pack <name>` — one selection/serialiser core behind all four transport surfaces, one import implementation behind both trust surfaces, everything imported landing `draft`, and a manifest that is transit integrity and is never allowed to read as trust.

**Architecture:** A new `src/pack/` module with no CLI knowledge and no network. The exporter is an **allow-list walk** producing an in-memory bundle (`ExportFile[]` + a manifest) which two writers serialise: a plain directory (canonical) and a hand-written deterministic ZIP. The importer reads either shape back, screens it, plans it purely, reports three collision buckets, and applies only what a human confirmed — through `createItem`'s existing explicit-id path, which already *is* the three-bucket rule. The two CLI commands are thin: they parse flags, print the preview, run the gate, and render the plan.

**Tech Stack:** Node ≥ 24 built-ins only — `node:crypto` (full SHA-256), `node:zlib` (`crc32`, `inflateRawSync` on the read path), `node:fs`, `node:path`. No framework, no build step, no runtime dependency, no subprocess.

**Spec:** `docs/superpowers/specs/2026-08-19-v2-scope-decisions.md` — the binding authority; §5, §6, §6c, §6d, §6h, §6k, **§6m**, **§6n** and §6o. **Reading order is §6n first, then §6m, then the earlier sections**: §6m supersedes §2, §6f, §6g and §6h where they conflict; **§6n supersedes §6m where they conflict**; §6o reverses §6m.1. This plan is written against §6n's text. Four of its rulings — §6n.1, §6n.5, §6n.6 and §6n.7 — landed *after* the first draft of this plan and each one changed a task below; every change is logged in §0 against the §6n item that caused it.

**Survey:** `.superpowers/sdd/2026-08-19-v2-scope-decisions/survey-export-packs.md` — the file-level map this plan builds on. Its citations were re-resolved against the working tree on 2026-08-20; where a line hint had drifted (`core/audit.ts` moved about five lines) the fragment still resolves and the table below carries the current hint.

**Scope split (binding):** this plan owns the four export/import surfaces and the bulk-promote flag that makes the draft gate bearable. It does **not** own: the three new categories §6o settles (`todo`, `note` and `procedure`), the `procedure` lifecycle or its steps, **the audit segment format version §6n.5 decided**, session naming, cross-session carry, the rule-file exporter, or the `search` predicate. Sibling plans own those — `docs/superpowers/plans/2026-08-20-v2-categories-and-runbooks.md` names §6n.5 and §6o in its own scope split. `runbook` is unchanged by §6o and gains nothing anywhere, here or there. Where this plan touches a file a sibling also touches — `src/cli/index.ts`, `src/cli/commands/review.ts`, both READMEs — the tasks below name the exact insertion point so two plans do not both rewrite one region.

---

## Global Constraints

- **Zero runtime dependencies.** Node 24 native type-stripping, no build step, `erasableSyntaxOnly`, explicit `.ts` import extensions. No framework, no bundler.
- **No subprocess.** `src/**` contains no `child_process` import today and this plan does not introduce one. See §0 correction 3.
- **No network. Ever.** This product makes no network request at all. Discovery is a curated document; there is no registry, no re-fetch, no version check.
- **The exporter is an ALLOW-LIST, not a deny-list.** Only what §5 names travels. Anything the product grows later is excluded until someone adds it deliberately. `.revisions/` holds the text of discarded proposals; a deny-list would ship a stranger our rejected drafts.
- **Everything imported lands `draft`, on both surfaces.** No `origin: 'import'` — `Origin` is closed and the carve-out was refused. Tractability comes from `review promote --all --pack <name>` behind one confirmation.
- **A changed item is overwritten only after a named warning and a separate approval — §6n.7.** The warning names the ids and the fields that differ; the approval is its own act, distinct from choosing the pack, and `--yes` alone does not grant it. Every overwrite is one `update` mutation record, so the prior content stays recoverable from the log and from git. Declining leaves the changed items reported and skipped.
- **A pack may not MOVE the trust boundary — §6n.1.** `agentEdits` is refused outright with an error naming it. `tier` is refused for a category name that already resolves in the importing build — that is the retiering attack — and is **mandatory** for a name the build has never heard of, where it can override nothing. A pack's config **merges field-wise** into the `categories` block and never replaces.
- **OPEN — may a pack carry `extraFields`? Raised 2026-08-20, NOT decided.** §6n.1 enumerates
  `tier`, `agentEdits`, `budgets`, `watchedDocs` and `profile`, and it is complete for the
  config as it stood when it was written — `extraFields` was refused **by name** then, so there
  was nothing to rule on. It is now a settable category key (`core/config.ts` · `  'enabled', 'tier', 'description', 'prefix', 'agentEdits', 'scopePolicy', 'extraFields',` · ~626), which means a pack's `categories` block can reach a key §6n.1 never considered.
  **What is known, so the ruling does not have to start from nothing.** On a name that already
  resolves it EXTENDS by union (`core/config.ts` · `      existing.extraFields = [...new Set([...existing.extraFields, ...added])];` · ~1696), so a
  pack could only ADD accepted frontmatter fields to a built-in category and could never remove
  one the catalogue declares. It does **not** move the trust boundary the way `tier` does — tier
  and `agentEdits` are the discriminators and both stay refused — and it is reversible, because
  the union is recomputed from the catalogue at every resolve, so dropping the override drops the
  field. What it does do is let an imported pack widen, silently and durably, which frontmatter
  keys a category will accept from then on, in a build whose owner never declared them.
  **The argument each way, neither adopted.** Permit: it is additive, satisfiable, reversible, and
  refusing it would make a pack unable to ship a custom category's own fields — which is most of
  what a custom category is. Refuse on names that already resolve, mirroring `tier`: the importer
  agreed to the catalogue's fields, not to a stranger's additions to them. **Whoever rules must
  also say whether Task 2's refusal list gains a fourth key and whether the import report has to
  name a widened category** — an unreported widening is the shape §6n.7's overwrite warning exists
  to prevent.
- **A pack carries** items, the categories it uses, and their `prefix`/`scopePolicy`. **Never** `budgets` or `watchedDocs`.
- **The manifest is transit integrity and must never be described as evidence of trust**, in code, in a message, in a report or in either README. It never gates activation.
- **`INV-markdown-is-the-source-of-truth`** — nothing in this plan writes a field into an item that does not survive parse → render → parse. The index is never exported; it is rebuilt.
- **`INV-nothing-is-dropped-silently`** — every item, record, field or file the exporter omits or the importer cannot carry is counted and named in the report. A quarantine nobody is told about is an omission.
- **Guarantee claims carry their condition in the same sentence** (`STD-guarantee-claims-carry-their-condition-in-the-same-sentence`). The ZIP is byte-identical *given the same file set*; the manifest proves *arrival intact*, not authorship.
- **Never write a comment, message, doc or corpus item asserting a property the code does not have.**
- **Every change needs a test that fails without it.** `npm run mutate` refuses a dirty tree — commit first.
- `npm test`, `npx tsc --noEmit`, `npm run test:perf`, `npm run verify:citations`, `npm run check:retired` clean; `git status --porcelain` clean.
- **Both documents, always** for any README change: `README.md` and `docs/README.he.md`.

---

## 0. Corrections — where the spec, the survey and the code disagree

<!-- retired-phrases
store.get(incoming.id) === undefined
the category configuration (which is what
64 lines of
config **replaces**, it does not merge
NOT applied by this command
items are never applied
does not know is refused
routed to the owner
pending the owner ruling
-->

**These corrections are enforced, not merely recorded.** The block above lists the phrases this plan retires; `npm run check:retired` fails if any of them reappears anywhere below §0. Nothing about a correct §0 tells you whether a task body twenty pages later still says the old thing. The five phrases added on 2026-08-20 are the ones §6n withdrew — they are listed because this plan *shipped* the withdrawn design in five separate places, and a §0 row alone would not have found them.

Nine items. Two are mechanical (the code says something different from the survey), one is a sizing correction, one is a scope observation, **four are §6n/§6o rulings that landed after this plan was drafted and each of which changes a task below**, and one is a dependency on a sibling plan rather than work here.

**Nothing in this section is open.** The two questions this plan raised for the owner — the `git bundle` rung and whether a pack may define a category — were both answered, in §6n.6 and §6n.1, and rows 3 and 6 now record the answers instead of the questions.

| # | Was | Is | Class | Consequence |
|---|---|---|---|---|
| 1 | Survey §4.2's "new" bucket predicate tests the id lookup against `undefined` | `Store.get` returns `Item \| null` — `core/store.ts` · `  get(id: string): Item \| null {` · ~504. The survey's predicate is never true, so every incoming item would fall into "not new" | A nullability spelling is re-read from the signature, never remembered | Task 10 tests `=== null` |
| 2 | The survey sizes re-grading on arrival as "M — small diff, wide blast radius", requiring an edit to `Origin` and both `ORIGINS` lists | **Zero code.** §6m.5 withdrew the invented origin, and `core/trust.ts` · `  if (origin !== 'human' && tier === 'normative') return 'draft';` · ~268 already demotes. What the plan must add is not a type change but an explicit `status: 'draft'` on every item, because `trustedStatus` leaves a *rationale*-tier item's requested status alone | A decision withdrawn upstream shrinks the work it was costed against; re-cost after the withdrawal, not before | Task 12 |
| 3 | §5's format ladder has three rungs, the middle one `git bundle` | **§6n.6 drops the rung from v2.0 — decided, not recommended.** This plan argued against it and the owner made it the ruling. The ladder stays a `--format` flag over a shared bundle, so **the rung costs one writer** if it is ever wanted and nothing else moves. The reasoning is kept below because it is the reason the ruling holds, not because the question is still open | A rung whose cost is policy rather than lines is weighed before it is scheduled — and the weighing is then *ruled on*, so a later reader does not re-litigate a recommendation | "What this plan is not doing" item 1. No task is removed, because none was ever written |
| 4 | §6k: "the prose is what must change, in both READMEs, or the product will ship documentation that contradicts its own feature" | **Already half-done.** Both READMEs already carry the forward-looking callout — `README.md` · `**Decided for v2.0 and not built: half of the log will travel, deliberately filtered.**` · ~2497 and `docs/README.he.md` · `**הוכרע ל-v2.0 ולא נבנה: מחצית מהיומן תיסע, מסוננת במכוון.**` · ~2684 — and `core/audit.ts`'s own comment carries the narrowing at ~46. What is left is flipping "not built" to shipped | A documentation defect is re-read before it is scheduled; half of this one was fixed while the survey was being written | Task 16 is an edit, not a write | <!-- historical-citation: the callout was flipped to shipped on 2026-08-23; both READMEs now open "Half of the log travels with an export, deliberately filtered." -->
| 5 | §6 point 4: config replaces on import, "and an importer must be told" | **That rule has no surface in this plan.** The only import commands in scope are the two pack surfaces, and §6m.4 rules those **merge field-wise**. §6's rule was written for a whole-workspace R6 import, which nothing here builds | A rule inherited from a case it does not fit is the defect §6m.4 exists to correct; recorded so a later whole-workspace import does not inherit the merge by accident | Task 2 implements merge only |
| 6 | §6h/§6m.12 assume a pack can ship a category the importer does not have, while §6m.4 refused `tier` from a pack **outright** — jointly unsatisfiable, because `core/config.ts` · `      if (!override.tier || !override.description) {` · ~1548 **requires** `tier` and `description` for a name the build does not know (`core/config.ts` · `my_context: unknown category "${name}". To define a custom category it must ` · ~1550) | **§6n.1 rules, and §6m.4's flat refusal is withdrawn.** A pack **may** declare `tier` for a category name that does not resolve in the importing build — there it is mandatory and can override nothing — and **never** for a name that already resolves, which is the retiering attack §6l F2 found. `agentEdits` stays refused outright, `budgets` and `watchedDocs` are still never carried, and the `categories` block still merges field-wise | Two rules written in different sections are checked against each other *and* against the code before either is built on — and the check produced a ruling, not a permanent refusal. The question this plan asked is answered; it is not left standing as a finding | Task 2 refuses **narrowly** and now also *emits* `tier`/`description` for a custom category on the way out; Tasks 12 and 15 are unchanged around it |
| 7 | This plan's own Design decision 6, its report text and Tasks 10/12/14: an item in the `changed` bucket is reported and skipped, with no update path anywhere | **§6n.7 withdraws that.** A changed item **is** overwritten — after a warning that **names the ids and the fields that differ**, and an approval that is **its own act**, separate from choosing the pack. Every overwrite is one `update` mutation record, so the prior content stays recoverable from the log and from git. Nothing is overwritten without approval, and declining leaves the changed items reported and skipped exactly as before | §6d's *"updating means importing again"* was two-thirds true for as long as the third bucket had no route. A plan that ships a limitation has to say whether the limitation is the design or the gap — this one was the gap, and the owner closed it | Design decision 6 rewritten; the collision report's `changed` line and its `--json` shape (Byte layouts §4); Tasks 10, 12, 14, 15; "What this plan is not doing" item 2 |
| 8 | Nothing in this plan carried a format version on an audit segment | **§6n.5 adds one — and this plan does not build it.** The version is a change to the local segment format in `core/audit.ts`, and the categories plan names §6n.5 in its own scope split, so **it owns the work.** This plan **depends** on it and duplicates none of it: Task 4 reads local segments through the audit reader and inherits whatever version handling lands there, and its projection is an explicit key literal, so a new segment-level field is projected away **by construction** rather than by an implementer remembering. Nothing this plan writes is an audit segment — everything under `.audit/imported/` carries its own protocol and is invisible to `core/audit.ts` · `const SEGMENT_PATTERN = /^audit\.[0-9TZ]+-\d+\.jsonl$/;` · ~1234 | A versioning decision taken inside one plan is a dependency for every plan that reads the same log. Naming the owner and the seam is cheaper than two implementations, and far cheaper than none | Task 4 gains the dependency note; Task 11 is unaffected; Self-Review §4 records the cross-plan ordering |
| 9 | The scope split named "`runbook` steps" as the sibling's territory — §6m.1's ruling that `runbook` absorbs the one-shot lifecycle and no new category is created | **§6o reverses §6m.1: both categories exist.** `runbook` ships **unchanged** and repeatable; `procedure` is **new** — normative, prefix `PROC` — and carries the lifecycle, the steps and the injected-only-while-active rule. Three categories are new, not two: `todo`, `note`, `procedure` | A plan is written against a decision, not against a document; a reversed decision invalidates a line even when the line cited nothing and every citation around it still resolves | The scope-split paragraph, and only that. Checked rather than assumed: this plan has no collision example, no pack fixture and no category projection that names either category, so §6o reaches nothing else here |

### On item 3 — the `git bundle` rung, and why the ruling holds

**The measurement.** `src/**` contains no `child_process` import at all (re-checked by execution, 2026-08-20 — see the absences table). `src/` never references git except as a directory name to skip. The only precedent for the mechanics is `scripts/mutate.ts`, a development script that never ships on the CLI path.

**What the rung would buy:** a single file carrying the corpus's own git history, incrementally updatable, signable with tools the receiver already has.

**What it would cost, in the order the risk actually lands:**

1. **The first subprocess in shipped code.** Every existing failure mode in this product is a file read, a parse or a SQLite open. A shell-out adds a new class — PATH resolution, exit codes, stderr, Windows argument quoting — to a codebase that has been careful enough about paths to own a `normalizePosix` boundary.
2. **`git subtree split` writes to the exporter's repository.** It creates a commit and a ref. An export command that mutates the repository it is run in is a side effect nobody asked a read-shaped command for, and there is no policy decided anywhere for what it does when the corpus is untracked, when the tree is dirty, or when the user is mid-rebase.
3. **The value is already available without us.** The plain directory is canonical and is what `--format dir` writes. A receiver with git runs `git bundle create` on it themselves in one line; a publisher with git commits the directory. We would be wrapping a command the user already has in a policy we would have to invent.
4. **It is reversible in the cheap direction.** The ladder is a `--format` flag over a shared bundle, so adding `--format bundle` later is a writer plus a reader and changes nothing else. Not building it now forecloses nothing.

**The ruling: §6n.6 ships two rungs — plain directory and deterministic ZIP — and drops `git bundle` from v2.0**, with the recipe documented as a user-run alternative (Task 13, step 5). This is a deviation from §5's table, decided rather than assumed. **It stays cheap to reverse:** the ladder is a `--format` flag over a shared bundle, so `--format bundle` later is one writer, one detector and one refusal path, and the plan around it does not move. That reversibility is the reason the drop was safe to take, and it is the one property a later implementer must not remove — collapsing `--format` into two hardcoded writers would turn a one-writer addition into a refactor.

### On item 6 — the §6n.1 rule, and exactly what Task 2 does with it

**The rule.** A pack may declare `tier` for a category name that **does not resolve** in the importing build; there it is mandatory, because `core/config.ts` · `      if (!override.tier || !override.description) {` · ~1548 will not resolve the config without it, and it can override nothing, because there is nothing at that name to override. A pack may **never** declare `tier` for a name that already resolves: that is §6l F2's attack — `"rule": {"tier": "rationale"}` un-injects the importer's whole normative corpus and opens it to unreviewed agent writes — and it is refused with the message Task 2 already carries.

**`description` travels with `tier`, and this is a reading, stated as one.** §6n.1's sentence names `tier` only. The resolver requires **both** for an unknown name, and §6n.1's stated reason for withdrawing the flat refusal is precisely that the code makes the old rule unsatisfiable. Permitting `tier` while still refusing `description` would leave it exactly as unsatisfiable, so this plan reads §6n.1 as permitting both, and says so here rather than burying the inference in Task 2's refusal list. `prefix` and `scopePolicy` were already carried; `enabled` was already carried and may still only be `true`.

**What is NOT unlocked.** `agentEdits` stays refused outright on every name, new or existing. That is not a leftover: for a brand-new category the resolver **defaults** it from the tier — `core/config.ts` · `          ? defaultAgentEdits(override.tier)` · ~1590 — so refusing it is satisfiable, and permitting it would let a pack ship a normative category whose agent writes apply without review, which is the same power §6m.4 refused under a different key. `budgets`, `watchedDocs` and `profile` are still never carried.

**The residual risk, named because the ruling does not mention it.** A pack-defined category arrives with a `prefix`, and `core/config.ts` · `        prefix: override.prefix === undefined` · ~1571 accepts whatever validates. Two categories with the same prefix produce ids that collide across categories. §6n.1 says nothing about this and this plan does not invent a rule for it: Task 2 **reports** a prefix already in use by another category as a line in the report's `refused` section, which is the visible, fixable direction, and the report says which category holds it.

### On item 7 — the overwrite, and where each of §6n.7's four requirements is discharged

§6n.7 states four requirements and says none of them is optional. Each is bound to a concrete surface here so that no implementer has to invent one, and so that a reviewer can check them off:

| §6n.7 requires | Discharged by | Asserted by |
|---|---|---|
| The warning **names what will be overwritten** — the ids, and enough of the change to recognise it | The `changed` bucket already prints one line per id with its type, title and both short hashes. It gains a **second line naming the fields that differ**, computed field-wise over the two items, and the `mycontext show <id>` line stays | Task 10 — one test that the rendered warning contains every changed id **and** every differing field name, and one that the withdrawn "not applied" sentence appears nowhere in it |
| Approval is **explicit and separate** from choosing the pack | A **second** prompt, asked only when the `changed` bucket is non-empty and only after the pack confirmation has been answered. On the non-interactive path the separate flag `--overwrite-changed` is the approval; **`--yes` alone never grants it** | Task 14 — `--yes` with changed items present imports the new bucket, skips the changed one, and says so |
| Every overwrite is a **mutation record in the audit log** | One `updateItem` call per overwritten id, which writes one `update` record through the existing writer — `core/mutate.ts` · `export function updateItem(` · ~765. Prior content is then recoverable from the log, and from git wherever the corpus is tracked | Task 12 — one `update` record per overwritten id, naming the moved fields |
| **Nothing is overwritten without approval**, and declining leaves changed items reported and skipped | The overwrite pass is a separate stage of `applyImport`, run only when its `overwriteApproved` argument is `true`. `ImportPlan` has no field for an approval and cannot acquire one, so the stage is unreachable except from a call site where a human answered. Without it the stage does not run and the outcome names the count it skipped | Task 12 — the declined path leaves every changed item byte-identical to what it was |

**Two things §6n.7 does not say, decided here with the reason, because an implementer cannot proceed without them:**

1. **The overwrite calls `updateItem` with `origin: 'human'`.** It has to: with a non-human origin the update is refused outright for `scope`/`always`/`severity` on a governing normative item (`core/mutate.ts` · `  if (origin !== 'human' && governsNormatively(ctx, item)) {` · ~915) and content edits are diverted into a staged revision by the category's policy (`core/mutate.ts` · `  if (origin !== 'human' && agentEditsFor(ctx.config, item.type) === 'review') {` · ~1027) — so §6n.7's "IS overwritten" would be false for exactly the items it was written about. **It is not a lie about authorship**, and that distinction is the whole reason this is safe: `updateItem` never writes `origin` onto the item, it reads it as the caller's claim about *who is taking this act*. A human took it, at their terminal, one prompt ago — which is precisely the claim `cli/commands/review.ts` · `const patch: UpdateInput = { id: item.id, status: 'active', origin: 'human' };` · ~1131 already makes after the same kind of confirmation. The item's own stored `origin` is untouched by an overwrite, so it still says how the content arrived.
2. **An overwritten item lands `draft`, like everything else imported.** §6n.7 did not disturb §6m.5, and the alternative — leaving an overwritten item `active` — would let pack content govern with **zero** review, which is the outcome §6m.5 exists to prevent and is strictly worse than the one it was written against. The consequence is real and must be in the warning, not only here: **approving an overwrite of an active item stops that item governing until it is promoted again.** The report says so in its own text, and the outcome points at `review promote --all --pack <name>`, which is the one act that puts it back.

**And one thing this plan cannot do, disclosed rather than half-built.** `UpdateInput` carries `title`, `body`, `scope`, `tags`, `severity`, `always`, `status` and `extra` — `core/mutate.ts` · `export interface UpdateInput {` · ~663 — and **no** `observations` or `relations`; those are settable only at creation (`core/mutate.ts` · `  observations?: Observation[];` · ~174) while `itemContentHash` includes both (`core/content-hash.ts` · `    observations: v.observations.map(canonicalObservation),` · ~112). So an item whose *only* difference is an observation or a relation is bucketed `changed` and **cannot** be overwritten by any write path this plan owns. Silently overwriting the other seven fields and leaving those two would be a partial overwrite presented as a complete one, which is `INV-nothing-is-dropped-silently` at the exact point the silence matters. Such an item is therefore named in the warning as **not overwritable here**, with the field that differs and the reason, and it is skipped whether or not the overwrite is approved. Widening `UpdateInput` is a change to `core/mutate.ts`, which two sibling plans also touch; it is out of scope and named in "What this plan is not doing".

---

## Verified facts this plan builds on

**Verified against the working tree on 2026-08-20.** Citations are `file` · `verbatim fragment` · `~line`: the **fragment is the identity** and the line is a hint that may go stale. `npm run verify:citations` resolves every fragment in this table and exits non-zero on a miss.

### The on-disk layout, and what the allow-list therefore names

| Fact | Where verified |
|---|---|
| The workspace directory name | `core/workspace.ts` · `export const DIR_NAME = '.my_context';` · ~6 |
| `init` creates exactly three things | `cli/index.ts` · `mkdirSync(path.join(root, 'items'), { recursive: true });` · ~443 |
| …the config it writes, verbatim | `cli/index.ts` · `const INIT_CONFIG = { profile: 'standard', categories: {}, budgets: {} } as const;` · ~150 |
| …and a `.gitignore` for the index | `cli/index.ts` · `writeFileSync(path.join(root, '.gitignore')` · ~448 |
| Item files live at `items/<type>/<ID>.md` | `core/mutate.ts` · ``filePath: `items/${input.type}/${itemId}.md`,`` · ~526 |
| …and are written by | `core/rebuild.ts` · `export function writeItem(root: string, item: Item, options?: WriteItemOptions): string {` · ~441 |
| …read back by | `core/rebuild.ts` · `export function loadLayer(` · ~125 |
| `.audit/` is here | `core/audit.ts` · `export function auditDir(root: string): string {` · ~1196 |
| `.audit/audit.db` is a derived projection | `core/audit-db.ts` · `  return path.join(auditDir(root), 'audit.db');` · ~160 |
| `state/focus.json` — per machine | `core/focus.ts` · `  return path.join(root, 'state', 'focus.json');` · ~354 |
| `.revisions/` — **holds discarded proposal text** | `core/revision-log.ts` · `export function revisionDir(root: string): string {` · ~108 and `core/revision.ts` · `revision log, which is its store.` · ~939 |
| `.ingest/` exists | `ingest/session.ts` · `  return path.join(root, '.ingest');` · ~93 |
| `.staging/` exists | `lesson/derive.ts` · `  return path.join(root, '.staging');` · ~38 |
| The index is a WAL SQLite file, hence three on-disk files | `core/store.ts` · `    db.exec('PRAGMA journal_mode = WAL;');` · ~155 |
| The index rebuilds from Markdown unconditionally | `core/open-store.ts` · `export function openRebuiltStore(ws: Workspace, options: OpenStoreOptions = {}): OpenedStore {` · ~75 |

### The audit log — the discriminator, the filter, and the protocol wall

| Fact | Where verified |
|---|---|
| The discriminator is a stored field with **six** members — `access` joined 2026-08-20, `progress` 2026-08-21 | `core/audit.ts` · `export const AUDIT_KINDS: AuditKind[] = [` · ~647 |
| …derived from one total table, so nothing classifies twice | `core/audit.ts` · `const KIND_OF: Record<AuditOp, AuditKind> = {` · ~652 |
| The ten travelling ops, exactly §5's list | `core/audit.ts` · `export const MUTATION_OPS = [` · ~180 |
| The shared filter already takes a `kind` | `core/audit.ts` · `export function filterAudit(records: AuditRecord[], filter: AuditFilter): AuditRecord[] {` · ~1639 |
| Every segment must be read, not just the live file | `core/audit.ts` · `export function auditSegments(root: string): string[] {` · ~1243 |
| …which enumerates one directory and matches two name shapes, so a **subdirectory is invisible to it** | `core/audit.ts` · `const SEGMENT_PATTERN = /^audit\.[0-9TZ]+-\d+\.jsonl$/;` · ~1234 |
| Reading every segment | `core/audit.ts` · `export function readAudit(root: string): AuditRecord[] {` · ~1551 |
| Parsing bytes a caller already holds — what an importer wants | `core/audit.ts` · `export function parseAudit(raw: string, file: string, windowed = false): AuditRecord[] {` · ~1574 |
| The local protocol string | `core/audit.ts` · `export const AUDIT_PROTOCOL = 'my_context/audit@2';` · ~98 |
| **An unknown op refuses the whole segment** — the reason §6m.10 exists | `core/audit.ts` · `declares op ${JSON.stringify(row.op)}, which is not one of` · ~1332 |
| A protocol mismatch is refused on every line, torn tail included | `core/jsonl-log.ts` · `if (typeof row.protocol !== 'string' || !accepted.includes(row.protocol)) {` · ~246 |
| The log spec an importer must supply to reuse the reader | `core/jsonl-log.ts` · `export interface JsonlLogSpec {` · ~38 |
| The parser | `core/jsonl-log.ts` · `export function parseJsonlLog(raw: string, spec: JsonlLogSpec): JsonlRow[] {` · ~211 |
| The appender, and the `*` gitignore it drops beside every log | `core/jsonl-log.ts` · `export function ensureLogDir(dir: string): string {` · ~93 |
| A `discard` note is `<revisionId>` or `<revisionId>: <free text>` — so redaction is "keep up to the first `: `" | `core/revision.ts` · ``${pending.revisionId}: ${options.reason}`` · ~948 |
| `doctor`'s size report counts only what `auditSegments` returns, so `.audit/imported/` is outside it | `core/audit.ts` · `export function auditSize(root: string): { files: string[]; bytes: number } {` · ~1744 and `doctor/checks.ts` · `export function checkAuditSize(root: string): Finding[] {` · ~1452 |

### Identity, collisions and the trust boundary

| Fact | Where verified |
|---|---|
| The item `checksum` is a **64-bit truncation**, by its own comment | `core/slug.ts` · `/** First 16 hex chars of SHA-256. Used for tamper and drift detection. */` · ~54 |
| …the truncation itself | `core/slug.ts` · `  return createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16);` · ~56 |
| The stored frontmatter checksum covers fourteen fields — thirteen unconditionally, plus `steps` only when the item has any, which Task 5 of the categories plan added — and excludes provenance and dates | `core/item.ts` · `export function computeItemChecksum(item: Item): string {` · ~653 |
| The "are these the same item" predicate already exists | `core/content-hash.ts` · `export function itemContentHash(item: Item): string {` · ~166 |
| …normalising, and **excluding `id`, `status` and `origin`** | `core/content-hash.ts` · `function hashContent(v: ContentShape): string {` · ~123 |
| …and it **includes `tags`**, sorted — which is why import must not tag what it imports | `core/content-hash.ts` · `    tags: [...v.tags].sort(),` · ~111 |
| Ids are slugs of titles, so two corpora disagree about which is `-2` | `core/slug.ts` · `export function makeId(prefix: string, title: string): string {` · ~50 |
| **`createItem` accepts an explicit id** | `core/mutate.ts` · `  id?: string;` · ~66 |
| …and its explicit-id branch *is* the three-bucket rule | `core/mutate.ts` · `  if (input.id !== undefined) {` · ~572 |
| …identical content is a no-op duplicate | `core/mutate.ts` · `      if (itemContentHash(existing) === hash) return duplicateOf(existing);` · ~579 |
| …different content at the same id throws — which is why an **overwrite is `updateItem`'s job**, not the creator's | `core/mutate.ts` · `      throw occupiedError(input.id);` · ~580 |
| The second write path, and the one the §6n.7 overwrite uses | `core/mutate.ts` · `export function updateItem(` · ~765 |
| …whose `origin` is the **caller's claim about who is acting**, read for the gates and written into the audit record — it never becomes the item's stored `origin` | `core/mutate.ts` · `  const audited = auditMutation(ctx, auditOp, origin, item.id, {` · ~1222 |
| …a non-human origin is refused outright on a governing normative item's `scope`/`always`/`severity` | `core/mutate.ts` · `  if (origin !== 'human' && governsNormatively(ctx, item)) {` · ~915 |
| …and a non-human origin's **content** edit is diverted into a staged revision by the category's policy | `core/mutate.ts` · `  if (origin !== 'human' && agentEditsFor(ctx.config, item.type) === 'review') {` · ~1027 |
| …and `UpdateInput` carries **no** `observations` and **no** `relations` | `core/mutate.ts` · `export interface UpdateInput {` · ~663 |
| …though `CreateInput` does, so those two fields are settable only at creation | `core/mutate.ts` · `  observations?: Observation[];` · ~174 |
| …while the content hash **includes** them — so a difference confined to those two fields buckets `changed` and has no write path here | `core/content-hash.ts` · `    observations: v.observations.map(canonicalObservation),` · ~112 |
| `Origin` is closed | `core/types.ts` · `export type Origin = 'human' \| 'agent' \| 'ingest';` · ~4 |
| …enforced twice | `core/validate.ts` · `export const ORIGINS: Origin[] = ['human', 'agent', 'ingest'];` · ~38 and `cli/commands/audit.ts` · `const ORIGINS: Origin[] = ['human', 'agent', 'ingest'];` · ~37 <!-- historical-citation: plan:builder seq:2 ended the duplication this row records. `audit --origin` declares `ORIGINS` as its legal values, and the only remaining declaration is `core/validate.ts`'s, which `cli/commands/audit.ts` now imports; the row surveys the two-copy state it replaced --> |
| The demotion, with no parameter and no override | `core/trust.ts` · `export function trustedStatus(origin: Origin, tier: Tier, requested: Status): Status {` · ~267 |
| …and it only fires on the **normative** tier — a rationale-tier item keeps the status it asked for | `core/trust.ts` · `  if (origin !== 'human' && tier === 'normative') return 'draft';` · ~268 |
| `Status` has five members and gains none here | `core/types.ts` · `export type Status = 'active' \| 'draft' \| 'superseded' \| 'deprecated' \| 'validated';` · ~2 |
| Promotion is one `updateItem` with `origin: 'human'` | `cli/commands/review.ts` · `const patch: UpdateInput = { id: item.id, status: 'active', origin: 'human' };` · ~1131 |
| The draft queue definition the bulk promote must not widen | `core/select.ts` · `export function reviewQueue(items: Item[], type: string \| null = null): Item[] {` · ~912 |
| A stranger's `sourceFile` would make `doctor` **error** on every imported item | `doctor/checks.ts` · `        level: 'error', code: 'source_missing', item: item.id,` · ~581 |

### Config — what may be written, and what is refused by name

| Fact | Where verified |
|---|---|
| The resolved shape | `core/config.ts` · `export interface Config {` · ~532 |
| The only top-level keys a config file may carry — and note that an unknown one is now **skipped and disclosed**, not refused (R14.2), so a pack carrying a key this build does not know no longer disables the whole config | `core/config.ts` · `export const TOP_LEVEL_KEYS = [` · ~1025 |
| The only keys a category entry may carry | `core/config.ts` · `const CATEGORY_KEYS = [` · ~625 |
| …the **seven** of them — `extraFields` joined the list on 2026-08-20 | `core/config.ts` · `  'enabled', 'tier', 'description', 'prefix', 'agentEdits', 'scopePolicy', 'extraFields',` · ~626 |
| **CORRECTED 2026-08-20 — `extraFields` is no longer refused.** It was a settable key from the day the `task` category needed it, and the refused-by-name list it used to be the only member of is now deliberately empty. **The trap this row described is gone, and a different one takes its place — see the two rows below.** | `core/config.ts` · `const CATEGORY_KEY_HINTS: Record<string, string> = {};` · ~639 |
| On a **built-in** category `extraFields` EXTENDS by union: config may ADD an accepted field, and can never remove one the catalogue declares | `core/config.ts` · `      existing.extraFields = [...new Set([...existing.extraFields, ...added])];` · ~1696 |
| On a **custom** category it is the whole list, because there is no catalogue entry to protect | `core/config.ts` · `        extraFields: override.extraFields === undefined` · ~1586 |
| A new category name **must** declare `tier` and `description` — which under §6n.1 is the pack's *obligation*, not the reason to refuse it | `core/config.ts` · `      if (!override.tier || !override.description) {` · ~1548 |
| …with this message | `core/config.ts` · `my_context: unknown category "${name}". To define a custom category it must ` · ~1550 |
| …and a new category's `agentEdits` **defaults from its tier**, which is why refusing `agentEdits` from a pack stays satisfiable while refusing `tier` did not | `core/config.ts` · `          ? defaultAgentEdits(override.tier)` · ~1590 |
| …and its `prefix` is optional and validated, never trusted — so a pack-defined category can land a prefix another category already uses | `core/config.ts` · `        prefix: override.prefix === undefined` · ~1571 |
| The built-in category table — the predicate for "does this name already resolve here" | `core/categories.ts` · `export const CATEGORIES: Record<string, CategoryDef> = {` · ~156 |
| A user's `watchedDocs` is never merged into, and the comment says why | `core/config.ts` · `function requireWatchedDocs(raw: unknown): string[] {` · ~1423 |
| Resolved accessors the pack projection reads | `core/config.ts` · `export function scopePolicyFor(config: Config, type: string): ScopePolicy {` · ~207 and `core/config.ts` · `export function agentEditsFor(config: Config, type: string): AgentEdits {` · ~229 |

### CLI conventions — the pattern each new command copies

| Fact | Where verified |
|---|---|
| Registration, one call, duplicate name throws | `cli/commands/registry.ts` · `export function registerCommand(def: CommandDef): void {` · ~46 |
| `init` is the one **bare** command and receives no `Workspace`, structurally | `cli/commands/registry.ts` · `export type BareCommandFn = (args: string[], out: Emit, cwd: string) => number;` · ~16 |
| …declared here | `cli/index.ts` · `  workspace: 'none',` · ~1566 |
| …and dispatched **before** `resolveWorkspace` | `cli/index.ts` · `if (registered !== undefined && registered.workspace === 'none') {` · ~1523 |
| `init` refuses every argument today — `--pack` lands in this refusal | `cli/index.ts` · `init takes no arguments, and` · ~145 <!-- historical-citation: Task 15 landed and `--pack` now lands inside this refusal, which reads "init takes one flag, --pack <path>"; the row surveys the text it replaced --> |
| …its one-line usage | `cli/index.ts` · `const INIT_USAGE = 'usage: mycontext init   (it takes no arguments)';` · ~108 <!-- historical-citation: Task 15 rewrote INIT_USAGE to `usage: mycontext init [--pack <path>]`; this quotes the line it replaced --> |
| …the root it builds | `cli/index.ts` · `  const root = path.join(cwd, DIR_NAME);` · ~419 |
| …and the success line that must not be printed for a half-built workspace | `cli/index.ts` · `my_context: initialized ` · ~465 |
| Unknown flags refused before the corpus is opened | `cli/commands/format.ts` · `export function refuseUnknownFlag(` · ~415 |
| Flag readers | `cli/commands/registry.ts` · `export function flag(args: string[], name: string): string \| null {` · ~193, `cli/commands/registry.ts` · `export function listFlag(args: string[], name: string): string[] \| null {` · ~211, `cli/commands/registry.ts` · `export function hasFlag(args: string[], name: string): boolean {` · ~299, `cli/commands/registry.ts` · `export function positionals(args: string[], valueFlags: string[]): string[] {` · ~304 |
| The confirmation gate, and the non-interactive refusal | `cli/commands/review.ts` · `export function confirmAction(` · ~860 |
| Subcommand dispatch to imitate for `pack` | `cli/commands/review.ts` · `export const SUBCOMMANDS = [` · ~40 |
| …and its per-subcommand flag table | `cli/commands/review.ts` · `const REVIEW_FLAGS: Record<string, { allowed: string[]; values: string[] }> = {` · ~75 |
| Mutating corpus access, always rebuilt | `cli/commands/context.ts` · `export function openMutateContext(ws: Workspace): { ctx: MutationContext; errors: LoadError[] } {` · ~67 |
| Load errors reported on every path | `cli/commands/context.ts` · `export function emitLoadErrors(errors: LoadError[], out: Emit): void {` · ~15 |
| One `my_context:` line, never a stack trace | `cli/commands/context.ts` · `export function toCliMessage(err: unknown): string {` · ~29 |
| One JSON document per `--json` invocation | `cli/commands/format.ts` · `export function emitJson(out: Emit, value: unknown): void {` · ~355 |
| Layout budget and renderers | `cli/commands/format.ts` · `export const OUTPUT_WIDTH = 100;` · ~83, `cli/commands/format.ts` · `export function table(` · ~231, `cli/commands/format.ts` · `export function records(` · ~304 |
| Item read/write round trip | `core/item.ts` · `export function parseItem(text: string, filePath: string, layer: Layer): Item {` · ~440 and `core/item.ts` · `export function renderItem(item: Item): string {` · ~747 |
| The corpus filter to reuse for `--type`/`--status`/`--tag` | `core/search.ts` · `export function filterItems(items: Item[], filters: ItemFilters, config: Config): Item[] {` · ~235 |
| Windows-safe retry wrapper for filesystem writes | `core/rebuild.ts` · `export function retryOnTransientFsError<T>(fn: () => T, attempts = 5): T {` · ~247 |

### The two registries and the three documentation tests a new command must satisfy

| Fact | Where verified |
|---|---|
| Every CLI command with no slash counterpart is listed **with its reason** | `plugin/parity.ts` · `export const CLI_WITHOUT_SLASH: Record<string, string> = {` · ~145 |
| …enforced in both directions | `test/plugin/parity.test.ts` · `test('the parity map covers every MCP tool, exactly once, and invents none', () => {` · ~58 |
| **Both READMEs state the CLI command total, computed from the usage banner** — so registering a command reddens the suite until both documents are edited in the same commit | `test/docs/counts.test.ts` · `test('both documents state the real number of CLI commands', () => {` · ~93 |
| Test sandbox helper | `test/helpers/workspace.ts` · `export function sandbox(rawConfig?: Record<string, unknown>): Sandbox {` · ~24 |
| Temp cleanup — the one owner | `test/helpers/tmp.ts` · `export function removeTree(dir: string): void {` · ~46 |
| Type-stripping constraint | `tsconfig.json` · `"erasableSyntaxOnly": true,` · ~10 |
| The CLI is the TypeScript source, run directly | `package.json` · `"mycontext": "./src/cli/index.ts"` · ~18 |

### Facts that are absences, re-checked by execution

`verify-citations.ts` has nothing to resolve for a thing that does not exist, so these are re-run rather than cited.

| Fact | How it was re-checked, 2026-08-20 |
|---|---|
| No `child_process` anywhere in `src/` | `grep -rn "child_process" src/` — no matches |
| `node:zlib` imported nowhere in `src/` | `grep -rn "node:zlib" src/` — no matches |
| No archive code of any kind exists | as above, plus a case-insensitive sweep for `zip\|deflate\|gzip\|tarball` over `src/**/*.ts` returning only prose comments |
| `package.json` declares no `dependencies` key | read; `devDependencies` holds `typescript` and `@types/node` only |
| `src/pack/` and `test/pack/` do not exist | `ls src/pack test/pack` — absent, so Task 1 starts clean |
| `docs/TEMPLATES.md` does not exist | `ls docs/TEMPLATES.md` — absent; §6d names it and nothing has written it |
| `npm test`'s glob reaches a new `test/pack/` directory | `package.json` declares `"test/**/*.test.ts"` |
| `zlib.crc32`, `zlib.deflateRawSync` and `zlib.inflateRawSync` are all functions on the installed runtime | executed: `node -e "…"` on **v24.14.0** printed `function` for all three; `zlib.crc32(Buffer.from('abc'))` returned `0x352441c2`, the published CRC-32 of `abc` |

---

## Design decisions this plan fixes (so no implementer has to guess)

Each of these is a question the spec leaves open or does not reach. They are fixed here, with the reason, rather than discovered three times during implementation.

1. **Imported items carry `origin: 'ingest'`.** `Origin` is closed and §6m.5 refuses a fourth member. Of the three, `'ingest'` is the only honest one: it already means *content that arrived from outside and was not authored here*, and `trustedStatus`'s doc comment names it explicitly as a non-human origin the boundary covers. `'human'` would be a lie about authorship in the field the whole boundary is built on; `'agent'` would claim an agent wrote it.

2. **Every imported item is written with an explicit `status: 'draft'`, and the plan never relies on `trustedStatus` alone.** `trustedStatus` fires only on the normative tier, so a rationale-tier item — a `lesson`, a `todo` — would otherwise keep whatever status the pack asked for. §6m.5 says *everything* lands draft. Requesting `draft` makes the rule true on both tiers and leaves `trustedStatus` doing exactly what it does today for the normative half.

3. **Pack membership is recorded outside the corpus, in the import record, never as a tag on the items.** `hashContent` includes `tags`, sorted — so tagging imported items with `pack:<name>` would change their content hash, and re-importing the same pack would report every item as *changed* rather than *identical*. The membership list lives at `.audit/imported/<slug>/import.json` and is what `review promote --all --pack <name>` reads. This is the same reasoning §6m.3 used for step progress: a fact about a transaction is not knowledge, and does not enter the corpus.

4. **`--as-pack` drops `source_file`, `source_anchor` and `source_checksum`.** They name documents in the *author's* repository. Kept, they make `doctor` emit `source_missing` at level **error** for every imported item — the importer's health report reddens on arrival, permanently, for provenance they can never resolve. A full `export` keeps them, because there the repository travels with the corpus. Dropped fields are counted in the export report.

5. **`valid_from` is re-stamped on import and reported; a pack carrying `valid_until` is refused.** `CreateInput` has neither field, and `createItem` stamps `validFrom` from today. Re-stamping `valid_from` is honest — the item is valid *here* from today, and the pack's history carries the original dates. Dropping `valid_until` is not honest: it turns an expired claim into a live one, which is `INV-nothing-is-dropped-silently` pointed at exactly the field where the silence is dangerous. So the importer refuses, names the ids, and says why.

6. **A `changed` item is overwritten, and only after a warning that names it and an approval that is its own act — §6n.7.** Re-import *is* an update, because requesting an import is intentional; what was missing was not the intent but the disclosure. `createItem`'s explicit-id branch throws on an occupied id, so the overwrite is `updateItem`'s job — one call per approved id, `origin: 'human'` (see §0 item 7 for why that is the caller's claim and not an authorship lie), landing the item `draft` like everything else imported. **The surface, concretely:**
   - The `changed` bucket prints each id with its type, title, both short hashes, **the names of the fields that differ**, and the `mycontext show <id>` line. A count with no ids is a notice, not a warning, and this plan's report never prints one.
   - The approval is a **second** prompt, asked after the pack confirmation and only when the bucket is non-empty: `overwrite the N item(s) listed above with the pack's version? [y/N]`. Non-interactively the approval is the flag `--overwrite-changed`; **`--yes` does not grant it**, because `--yes` is consent to the import a user already described and this is a different question about items they did not.
   - Declining is not an error. The new items still land, the changed ones are reported and skipped, the outcome names the count, and `--json` carries `overwritten: []` beside `applied: true` so a script never has to infer which happened.
   - An item whose only difference is an `observations` or `relations` entry is named as **not overwritable here** and skipped either way, because `UpdateInput` has no route to those two fields and a partial overwrite presented as a whole one is the silence `INV-nothing-is-dropped-silently` forbids. §0 item 7 carries the citations.

7. **The merge never sets `enabled: false`.** A pack may add vocabulary; it may not silence the importer's. Disabling a category the importer uses would stop their items being injected — the same class of harm as the retiering §6n.1 still refuses, reached through the one field §6h does allow.

8. **A pack does not carry `profile`.** `profile` selects which categories are enabled wholesale, so carrying it replaces the importer's selection — replace-not-merge through the back door. The exporter instead writes explicit `enabled: true` entries for exactly the categories that hold at least one item in the pack. A vocabulary entry with no items is a setting, not knowledge about the domain.

9. **`export` has no confirmation gate; `pack import` and `init --pack` do.** `confirmAction` guards writes to the corpus. `export` writes only to a path the user named on the command line, and refuses to overwrite. It prints the preview unconditionally and offers `--dry-run`; a gate there would train the reflex the gate on the import side depends on.

10. **The ZIP writer stores; it does not deflate.** `zlib.deflateRawSync`'s output is reproducible only for a fixed level *and* a fixed zlib version, which makes "byte-identical across runs" a claim with a condition the user cannot check. Method 0 makes the determinism unconditional, and a 65 KB corpus of Markdown does not need the bytes. **The reader accepts method 0 and method 8**, because a user who receives a pack as a directory and zips it with Explorer produces method 8 — that is where `inflateRawSync` earns its import.

11. **`createdAt` is the one non-reproducible field, and it lives in `manifest.json` where it is data, not container.** The ZIP's own headers carry a fixed DOS timestamp. The byte-identity test therefore builds the file set once and writes the archive twice; the manifest builder takes an injectable `now`, the way the idle monitor takes an injectable clock.

12. **The importer plans before it creates.** `planImport` is pure and reads the pack from disk with no workspace at all, so `init --pack` validates the pack *before* `mkdirSync` runs. The rollback path still exists for a filesystem failure mid-write, and uses the house retry shape (`rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })`), but the common failure never reaches it.

---

## Byte layouts — the four formats, specified rather than described

Two implementations that disagree about sort order produce packs that fail to verify. These are normative.

### 1. `manifest.json`

**Encoding.** UTF-8, LF only, exactly one trailing `\n`. Produced by `JSON.stringify(value, null, 2) + '\n'` — the same spelling `init` uses for `config.json`.

**Key order is the object literal's insertion order**, which `JSON.stringify` preserves for string keys. Every key is **always present**; absence is `null`, never an omitted key, so a reader never has to distinguish "absent" from "null".

```json
{
  "protocol": "my_context/pack@1",
  "kind": "pack",
  "name": "acme-security",
  "version": "2026-08 rev 3",
  "generator": "mycontext 1.0.2",
  "createdAt": "2026-08-20T09:12:44.031Z",
  "itemCount": 22,
  "files": [
    { "path": "config.json", "bytes": 412, "sha256": "9f2c…64 hex chars total" },
    { "path": "history.jsonl", "bytes": 8194, "sha256": "1a03…" },
    { "path": "items/rule/RULE-never-log-a-token.md", "bytes": 733, "sha256": "c7de…" }
  ]
}
```

- `protocol` — `my_context/pack@1`, constant, refused on mismatch.
- `kind` — `"pack"` or `"export"`.
- `name`, `version` — author-supplied, **required when `kind` is `"pack"`**, `null` when `kind` is `"export"`. Both are opaque strings: trimmed, non-empty, at most 64 code points, screened by the Unicode screen, and **never parsed, ordered or compared**. There is no version arithmetic anywhere in this product.
- `generator` — `mycontext <VERSION>`, read from `package.json` by the existing version module, never transcribed.
- `createdAt` — `new Date(now).toISOString()`, UTC with milliseconds, matching the audit log's `at` spelling.
- `itemCount` — the number of `items/**` entries in `files`. Redundant with `files` on purpose: a reader that only wants the size does not have to parse the array, and a mismatch is a refusal.
- `files` — every file in the artefact **except `manifest.json` itself**, which cannot hash itself.
  - `path` — POSIX, relative to the artefact root, no leading `./`, no `..` segment, no backslash, no drive letter.
  - `bytes` — the byte length as an integer.
  - `sha256` — 64 **lowercase** hex characters, the digest of the **file bytes**, not of any parsed projection. `computeItemChecksum` is over a JSON projection and would not notice a reordered frontmatter block, which is precisely what a transit manifest must catch.

**Sort order — the one thing two implementations must agree on.** `files` is sorted ascending by the **byte-wise comparison of the UTF-8 encoding of `path`**:

```ts
files.sort((a, b) => Buffer.compare(Buffer.from(a.path, 'utf8'), Buffer.from(b.path, 'utf8')));
```

Not `localeCompare` (locale-dependent, and `Intl` data varies by build). Not the default `Array.prototype.sort` (UTF-16 code-unit order, which differs from UTF-8 byte order above the BMP). The ZIP's entry order is this same order, so one comparator is defined once and both callers import it.

**Verification.** `verifyManifest` recomputes every digest and reports, in one structure: `missing` (named in the manifest, absent on disk), `extra` (present on disk, absent from the manifest), `mismatched` (present, wrong digest). All three are refusals. A manifest whose `files` array is not in the sorted order above is also a refusal — an out-of-order manifest is a manifest a different implementation wrote, and the point of fixing the order is that this is detectable.

**What it is not.** No message, comment, README sentence or report line may describe manifest verification as evidence of trust or of authorship. It says the bytes arrived intact. Task 3's test asserts the exact strings.

### 2. `history.jsonl`

At the artefact root. UTF-8 JSONL, one record per line, every line `\n`-terminated including the last.

**Each line is `JSON.stringify(projected)`** — no pretty-printing, no trailing spaces. The projection is built by an object literal with this fixed key order, and a key whose value is `undefined` is simply not written into the literal, so it does not appear:

```
protocol, at, kind, op, origin, itemId, fields, note
```

- `protocol` — `my_context/pack-history@1`. **Distinct from `AUDIT_PROTOCOL` by construction**, so a stray copy into `.audit/` is refused by the live reader rather than silently merged.
- `kind` — always `"mutation"`. Present so the file self-describes and so a future kind cannot be added without the reader noticing.
- `op` — one of the ten `MUTATION_OPS` names.
- `origin`, `itemId`, `fields` — projected verbatim.
- `note` — **redacted**: `note.slice(0, note.indexOf(': '))` when `': '` occurs, otherwise the whole note. That keeps the revision id and drops the free text, which is the only place a mutation record carries authored prose.
- **Never emitted:** `sessionId`, `hook`, `injected`, `tokens`, `spilled`, `path`. The two writers of mutation records have no parameter for `sessionId` or `path`, but the *type* permits them, so the exporter **projects the fields it emits** rather than passing records through.

**Sort order.** Ascending by the tuple `(at, itemId ?? '', op, originalIndex)`, where `originalIndex` is the record's position in the concatenation of `auditSegments` in the order that function returns them. String comparison throughout, byte-wise on the UTF-8 encoding as above. The final component makes the order total, so two runs over the same log produce the same file.

**The join to the selection is not optional.** A record is emitted only when its `itemId` is in the exported id set. Ids are slugified titles, so a record naming a withheld item republishes its subject.

### 3. The deterministic ZIP

Little-endian throughout. Entries in the manifest's sort order, no exceptions — `manifest.json` takes its natural sorted position and is not special-cased.

**Fixed values, and why each is fixed:**

| Field | Value | Reason |
|---|---|---|
| version made by / needed | `20` (2.0), host 0 (FAT) | the lowest version that reads what we write; host 0 makes external attributes meaningless and therefore fixable at 0 |
| general purpose bit flag | `0x0800` | bit 11 — names are UTF-8. Set always, so an ASCII-only corpus and a corpus with a non-ASCII custom category produce the same header shape |
| compression method | `0` (stored) | Design decision 10 |
| last mod time | `0x0000` | 00:00:00 |
| last mod date | `0x0021` | 1980-01-01, the lowest date the DOS encoding can express. There is no "no timestamp" encoding, so a fixed one is the only determinism available |
| extra field length | `0` | no extra fields, ever |
| file comment length | `0` | |
| internal / external attributes | `0` | |
| data descriptors | none | sizes and CRC are known before the header is written |
| Zip64 | never emitted | the writer **refuses** rather than truncating — see the refusals below |

**Local file header — 30 bytes, then the name, then the data:**

| Offset | Size | Content |
|---|---|---|
| 0 | 4 | `50 4B 03 04` |
| 4 | 2 | version needed = `14 00` |
| 6 | 2 | flags = `00 08` |
| 8 | 2 | method = `00 00` |
| 10 | 2 | time = `00 00` |
| 12 | 2 | date = `21 00` |
| 14 | 4 | CRC-32 of the data |
| 18 | 4 | compressed size |
| 22 | 4 | uncompressed size |
| 26 | 2 | file name length |
| 28 | 2 | extra field length = `00 00` |
| 30 | n | file name, UTF-8 |

**Central directory file header — 46 bytes, then the name:**

| Offset | Size | Content |
|---|---|---|
| 0 | 4 | `50 4B 01 02` |
| 4 | 2 | version made by = `14 00` |
| 6 | 2 | version needed = `14 00` |
| 8 | 2 | flags = `00 08` |
| 10 | 2 | method = `00 00` |
| 12 | 2 | time = `00 00` |
| 14 | 2 | date = `21 00` |
| 16 | 4 | CRC-32 |
| 20 | 4 | compressed size |
| 24 | 4 | uncompressed size |
| 28 | 2 | file name length |
| 30 | 2 | extra field length = `00 00` |
| 32 | 2 | file comment length = `00 00` |
| 34 | 2 | disk number start = `00 00` |
| 36 | 2 | internal attributes = `00 00` |
| 38 | 4 | external attributes = `00 00 00 00` |
| 42 | 4 | relative offset of the local header |
| 46 | n | file name, UTF-8 |

**End of central directory — 22 bytes, and nothing after it:**

| Offset | Size | Content |
|---|---|---|
| 0 | 4 | `50 4B 05 06` |
| 4 | 2 | this disk = `00 00` |
| 6 | 2 | disk with the central directory = `00 00` |
| 8 | 2 | entries on this disk |
| 10 | 2 | total entries |
| 12 | 4 | central directory size |
| 16 | 4 | central directory offset |
| 20 | 2 | comment length = `00 00` |

**CRC-32** is `zlib.crc32(bytes) >>> 0`. The `>>> 0` is not decoration: the header field is unsigned 32-bit and a signed value would write the wrong bytes for any digest with the high bit set.

**Refusals, never truncation** (the house rule that a value which cannot be acted on is refused rather than ignored): more than 65,535 entries; any file of 4 GiB or more; a total archive of 4 GiB or more; a name whose UTF-8 encoding exceeds 65,535 bytes; a name containing a backslash, a leading `/`, a `..` segment or a drive letter. Each refusal names the offending entry.

**Reader.** Locates the EOCD by scanning backwards from the end over the last 22 bytes plus a 0-byte comment allowance (we write no comment, but a foreign zipper may), walks the central directory, and for each entry reads the local header, skips name and extra, and takes the data. Method 0 is taken as-is; method 8 goes through `inflateRawSync`. Every other method is refused by number. The uncompressed size and CRC-32 from the central directory are **verified** against the extracted bytes; a mismatch is a refusal naming the entry.

### 4. The collision report

**Text.** Fixed section order. **All three buckets print even when empty** — a zero is a fact, and a bucket that vanishes when empty is a bucket a reader cannot tell from one that was never computed. Ids are sorted with the same byte-wise comparator.

```
pack: acme-security  (version "2026-08 rev 3")
source: ../packs/acme-security.zip  (zip, 24 file(s))
manifest: every file verified — 24 of 24 digests match.
          This proves the bytes arrived intact. It says nothing about who wrote them.

new         12   do not exist here — these are what would be imported
changed      3   same id, different content — replaced only if you approve below
identical    7   same id, same content — nothing to do

new:
  CONST-node-24-or-newer      constraint   Node 24 or newer
  RULE-never-log-a-token      rule         Never log a token
changed:
  STD-commit-messages         standard     Commit messages          [active here]
                              here 4f2a1c09  incoming 9b7e0d34
                              differs in: body, tags
                              your version is replaced and drops to draft, so it
                              stops governing until you promote it again
                              inspect with `mycontext show STD-commit-messages`
  LESSON-retry-backoff        lesson       Retry with backoff       [draft here]
                              here 71b0c4ea  incoming 08d3f6b1
                              differs in: observations
                              NOT overwritable here — there is no write path for
                              observations after creation, so this one is skipped
                              whether or not you approve
identical:
  INV-paths-are-posix         invariant    Every stored path is POSIX-normalized

history: 41 mutation record(s) will be filed under .audit/imported/acme-security/
         2 record(s) carry an op this build does not know and will be quarantined
         under .audit/imported/unknown/ — counted here, nothing dropped.
not carried: valid_from will be re-stamped to today on 12 item(s)
refused: 0
```

**The `changed` bucket is the §6n.7 warning, and it is the whole of it.** Every line above it is context; these lines are what the second prompt asks about, so each carries the id, the fields that differ and the consequence for *this* item — an `active` item names its demotion, a `draft` one has nothing to lose and does not. The short hashes stay because they are the identity the buckets were computed from; the field list is what makes the change recognisable, which is what §6n.7 asks for and what a pair of hashes alone does not give.

**The prompt that follows it**, printed only when the bucket is non-empty and only after the pack confirmation has been answered:

```
overwrite the 1 changed item(s) marked above with the pack's version? [y/N]
  1 further changed item(s) cannot be overwritten here and are skipped either way.
```

**And the line printed when it is declined**, or when the run was non-interactive without `--overwrite-changed`:

```
my_context: 3 changed item(s) left exactly as they are — nothing was replaced.
            Approve with a second confirmation, or non-interactively with
            --overwrite-changed, which --yes deliberately does not imply.
```

Every item in the pack appears in exactly one of the three buckets, and the three counts sum to the pack's item count. Task 10's test asserts that sum — it is the arithmetic form of `INV-nothing-is-dropped-silently`.

**`--json`.** One document, fixed key order, load errors inside it so it stays parseable:

```json
{
  "pack": "acme-security",
  "version": "2026-08 rev 3",
  "kind": "pack",
  "source": "../packs/acme-security.zip",
  "format": "zip",
  "manifest": { "files": 24, "verified": 24, "missing": [], "extra": [], "mismatched": [] },
  "buckets": {
    "new":       [ { "id": "RULE-never-log-a-token", "type": "rule", "title": "Never log a token" } ],
    "changed":   [ { "id": "STD-commit-messages", "type": "standard", "title": "Commit messages",
                     "existingHash": "4f2a1c09", "incomingHash": "9b7e0d34",
                     "differs": ["body", "tags"], "existingStatus": "active",
                     "overwritable": true, "blockedBy": null },
                   { "id": "LESSON-retry-backoff", "type": "lesson", "title": "Retry with backoff",
                     "existingHash": "71b0c4ea", "incomingHash": "08d3f6b1",
                     "differs": ["observations"], "existingStatus": "draft",
                     "overwritable": false, "blockedBy": "observations" } ],
    "identical": [ { "id": "INV-paths-are-posix", "type": "invariant", "title": "…" } ]
  },
  "config": { "merged": ["rule", "standard"], "refused": [], "untouched": ["budgets", "watchedDocs"] },
  "history": { "records": 41, "quarantined": 2 },
  "notCarried": [ { "field": "valid_from", "items": 12, "effect": "re-stamped to today" } ],
  "refused": [],
  "applied": false,
  "overwriteApproved": false,
  "overwritten": [],
  "loadErrors": []
}
```

`applied` is `false` for a dry run or a declined pack confirmation and `true` after a write, so a script never has to infer whether anything happened.

**The three overwrite keys are separate from `applied` on purpose**, because §6n.7 makes them separate questions. `overwriteApproved` records whether the second act was taken; `overwritten` is the ids actually replaced, always a subset of `buckets.changed` and never equal to it when any entry has `overwritable: false`; and `applied: true` with `overwritten: []` is the ordinary, expected shape of an import whose new items landed and whose changed items were left alone. Both keys are **always present**, `false` and `[]` on every path including a dry run — the same rule the manifest follows, for the same reason: a reader must never have to tell "absent" from "nothing happened".

`differs` is the field-name list the text report prints, in a fixed order — `type, title, body, steps, severity, always, scope, tags, observations, relations, extra`, filtered to those that actually differ — which is the order `hashContent` composes its object in (`core/content-hash.ts` · `function hashContent(v: ContentShape): string {` · ~123), so the report and the predicate cannot drift apart. `blockedBy` is `null` or the first field name with no write path; `overwritable` is `blockedBy === null`.

---

## File Structure

New files:

```
src/pack/
  layout.ts          # protocol constants, the sort comparator, path rules, shared types
  manifest.ts        # buildManifest, renderManifest, parseManifest, verifyManifest
  config-io.ts       # projectExportConfig, projectPackConfig, refusePackConfig, mergePackConfig
  history.ts         # exportableHistory (filter + project + redact + join + sort)
  bundle.ts          # buildBundle — the allow-list walk and selection, one implementation
  dir-writer.ts      # writeBundleDirectory
  zip.ts             # writeZip / readZip — headers, central directory, EOCD, refusals
  reader.ts          # sniffFormat, readArtefact — directory or zip, manifest-verified
  screen.ts          # the Unicode screen
  collide.ts         # the three-bucket report and its two renderers
  imported-audit.ts  # .audit/imported/ layout, quarantine, the import record
  import.ts          # planImport (pure) + applyImport — the one implementation
src/cli/commands/export.ts
src/cli/commands/pack.ts
test/pack/
  layout.test.ts
  manifest.test.ts
  config-io.test.ts
  history.test.ts
  bundle.test.ts
  dir-writer.test.ts
  zip.test.ts
  screen.test.ts
  reader.test.ts
  collide.test.ts
  imported-audit.test.ts
  import.test.ts
test/cli/export.test.ts
test/cli/pack-import.test.ts
test/cli/init-pack.test.ts
test/cli/review-promote-all.test.ts
docs/TEMPLATES.md
```

Modified files:

```
src/cli/index.ts               # cmdInit accepts --pack (Task 14); INIT_USAGE and the hint table
src/cli/commands/index.ts      # + import './export.ts'; + import './pack.ts'
src/cli/commands/review.ts     # REVIEW_FLAGS.promote gains 'all' and 'pack'; the bulk branch (Task 15)
src/plugin/parity.ts           # + CLI_WITHOUT_SLASH entries for export and pack
README.md, docs/README.he.md   # Tasks 13, 14, 16 — counts, command tables, the audit-travel flip
```

---

## Task 1: `layout.ts` — the constants, the comparator and the path rules

**Files:**
- Create: `src/pack/layout.ts`
- Test: `test/pack/layout.test.ts`

**Interfaces:**
- Consumes: `node:buffer` only.
- Produces — every later task imports from here, so nothing below redefines any of it:
  - `PACK_PROTOCOL = 'my_context/pack@1'`
  - `PACK_HISTORY_PROTOCOL = 'my_context/pack-history@1'`
  - `IMPORTED_PROTOCOL = 'my_context/imported@1'`
  - `IMPORTED_UNKNOWN_PROTOCOL = 'my_context/imported-unknown@1'`
  - `IMPORT_RECORD_PROTOCOL = 'my_context/pack-import@1'`
  - `MANIFEST_NAME = 'manifest.json'`, `HISTORY_NAME = 'history.jsonl'`, `CONFIG_NAME = 'config.json'`, `ITEMS_DIR = 'items'`
  - `comparePaths(a: string, b: string): number` — the byte-wise UTF-8 comparator, the single definition both the manifest and the ZIP sort with.
  - `refuseArtefactPath(p: string): string | null` — `null` when the path is legal, otherwise the refusal sentence. Refuses: empty, a leading slash, a backslash anywhere, a `..` segment, a `.` segment, a drive letter, a trailing slash, and any path not under `items/` that is not one of the three known root files.
  - `type ExportFile = { path: string; bytes: Buffer }`
  - `type ArtefactKind = 'export' | 'pack'`

- [ ] **Step 1: Write the failing test**

```ts
// test/pack/layout.test.ts
/**
 * The comparator and the path rules, which two writers and one reader all
 * share. They live in one module because two implementations that disagree
 * about sort order produce packs that fail to verify, and the disagreement is
 * invisible until a stranger tries to read one.
 *
 * The allow-list lives on the PATH rather than in the walk, so that a walk
 * written later cannot widen it by accident. `.revisions/` is refused here not
 * because it is named but because nothing outside `items/` and the three root
 * files is ever accepted — which is the difference between an allow-list and a
 * deny-list that happens to be up to date today.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUDIT_PROTOCOL } from '../../src/core/audit.ts';
import {
  comparePaths, refuseArtefactPath, PACK_PROTOCOL, PACK_HISTORY_PROTOCOL,
} from '../../src/pack/layout.ts';

test('the pack protocols are distinct from each other and from the live audit protocol', () => {
  const all = [PACK_PROTOCOL, PACK_HISTORY_PROTOCOL, AUDIT_PROTOCOL];
  assert.equal(new Set(all).size, all.length);
});

test('comparePaths orders by UTF-8 bytes, not by UTF-16 code units', () => {
  // U+1D400 encodes as F0 9D 90 80 in UTF-8 and as the surrogate pair D835 DC00
  // in UTF-16. Against U+FF21 (EF BC A1 / FF21) the two orderings DISAGREE: by
  // bytes F0 > EF, by code units D835 < FF21. That disagreement is the only
  // reason this comparator exists rather than a bare sort.
  const astral = '\u{1D400}';
  const bmp = '\uFF21';
  assert.ok(comparePaths(astral, bmp) > 0);
  assert.equal([astral, bmp].toSorted()[0], astral, 'the default sort disagrees — which is the point');
});

test('comparePaths is a total order on the paths an artefact really holds', () => {
  const paths = ['items/rule/RULE-b.md', 'config.json', 'items/rule/RULE-a.md', 'history.jsonl'];
  assert.deepEqual(
    paths.toSorted(comparePaths),
    ['config.json', 'history.jsonl', 'items/rule/RULE-a.md', 'items/rule/RULE-b.md'],
  );
});

test('every escape and every path outside the allow-list is refused, by name', () => {
  for (const bad of [
    '', '/items/x.md', 'items\\rule\\x.md', 'items/../../etc/passwd', 'C:/items/x.md',
    'items/rule/./x.md', 'items/', '.revisions/revisions.jsonl', '.ingest/session.json',
    '.staging/LESSON-a.json', 'state/focus.json', '.index.db', '.audit/audit.jsonl',
  ]) {
    const refusal = refuseArtefactPath(bad);
    assert.ok(refusal, `${JSON.stringify(bad)} was accepted`);
    assert.match(refusal, /^my_context: /);
  }
});

test('the four legal shapes are accepted', () => {
  for (const good of ['config.json', 'manifest.json', 'history.jsonl', 'items/rule/RULE-a.md']) {
    assert.equal(refuseArtefactPath(good), null, good);
  }
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/pack/layout.test.ts`
Expected: FAIL — cannot find module `src/pack/layout.ts`.

- [ ] **Step 3: Implement**

`comparePaths` is `Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))`. `refuseArtefactPath` splits on `/` and checks each segment; the allow-list of root files is `[MANIFEST_NAME, HISTORY_NAME, CONFIG_NAME]`, and everything else must start with `items/` and have at least three non-empty segments. Every refusal is one `my_context:`-prefixed sentence naming the path and the rule it broke.

- [ ] **Step 4: Run the test and see it pass**

Run: `node --test test/pack/layout.test.ts` — 5 tests pass.

- [ ] **Step 5: Full gate and commit**

```bash
npx tsc --noEmit && npm test
git add src/pack/layout.ts test/pack/layout.test.ts
git commit -m "feat(pack): artefact path allow-list and the one UTF-8 sort comparator"
```

---

## Task 2: `config-io.ts` — the two projections, the refusals, and the merge

**Files:**
- Create: `src/pack/config-io.ts`
- Test: `test/pack/config-io.test.ts`

**Interfaces:**
- Consumes: `Config`, `resolveConfig`, `scopePolicyFor` from `core/config.ts`; `layout.ts`.
- Produces:
  - `projectExportConfig(config: Config): RawConfigJson` — the **raw** shape for a whole-workspace export: `{ profile, categories, budgets, watchedDocs }`, category entries carrying only the six permitted keys.
  - `projectPackConfig(config: Config, typesInPack: string[]): RawConfigJson` — `{ categories }` only, one entry per type in `typesInPack`. A type that is **built in** to this product gets exactly `{ enabled: true, prefix, scopePolicy }`. A type that is **custom to the exporting workspace** gets those three **plus `tier` and `description`**, which §6n.1 permits and `resolveConfig` requires; without them the receiving build cannot resolve the config at all. `agentEdits` is never written on either path.
  - `refusePackConfig(raw: unknown, local: Config): string[]` — the refusal sentences; empty when the pack config is legal.
  - `mergePackConfig(existingRaw: unknown, packRaw: unknown): RawConfigJson` — field-wise, into `categories` only.

**§6n.1, in one sentence, because it is the rule this module exists to hold:** `tier` is refused for a name where `Object.hasOwn(local.categories, name)` is true, and is **required** where it is false; `agentEdits` is refused for every name. **The second parameter is the importing build's resolved `Config`, not a bare name predicate** — the §6n.1 rule needs the existing category *names*, and the prefix report below needs their existing *prefixes*, and one argument that carries both cannot go out of step with itself. `resolveConfig({})` is a legal value for it in a test, which is how a build that does not know a given name is constructed.

**Why the export projection is not a serialisation of the resolved config**, in the module docstring: serialising the resolved shape emits `name`, `extraFields` and a resolved `description` inside every category, and `extraFields` is refused **by name** on the way back in — so the round trip fails on a file this product wrote. The projection writes the raw shape deliberately.

- [ ] **Step 1: Write the failing test**

```ts
// test/pack/config-io.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../../src/core/config.ts';
import {
  mergePackConfig, projectExportConfig, projectPackConfig, refusePackConfig,
} from '../../src/pack/config-io.ts';

// The importing build's resolved config: the names it already knows and the
// prefixes those names already hold. Both halves of §6n.1 read from this one
// value, so they cannot disagree about what "already exists here" means.
const LOCAL = resolveConfig({});

test('an exported config round-trips through resolveConfig', () => {
  const config = resolveConfig({ profile: 'standard', categories: { rule: { scopePolicy: 'required' } } });
  const raw = projectExportConfig(config);
  assert.doesNotThrow(() => resolveConfig(raw));
  // extraFields is refused BY NAME on the way in, so it must never be written.
  const text = JSON.stringify(raw);
  assert.equal(text.includes('extraFields'), false);
  assert.equal(text.includes('"name"'), false);
});

test('a pack config carries vocabulary and nothing about the importer', () => {
  const raw = projectPackConfig(resolveConfig({}), ['rule', 'standard']);
  assert.deepEqual(Object.keys(raw), ['categories']);
  assert.deepEqual(Object.keys(raw.categories).toSorted(), ['rule', 'standard']);
  for (const entry of Object.values(raw.categories)) {
    assert.deepEqual(Object.keys(entry).toSorted(), ['enabled', 'prefix', 'scopePolicy']);
    assert.equal(entry.enabled, true);
  }
});

test('a pack carrying a CUSTOM category also carries its tier and description', () => {
  // The exporter's own workspace defines `threat_model`; the receiver's does
  // not. Without these two keys `resolveConfig` refuses the pack's config on
  // arrival, so omitting them would ship a pack that cannot be imported.
  const config = resolveConfig({
    categories: { threat_model: { tier: 'normative', description: 'A threat we model.' } },
  });
  const raw = projectPackConfig(config, ['rule', 'threat_model']);
  assert.deepEqual(Object.keys(raw.categories.rule).toSorted(), ['enabled', 'prefix', 'scopePolicy']);
  assert.deepEqual(
    Object.keys(raw.categories.threat_model).toSorted(),
    ['description', 'enabled', 'prefix', 'scopePolicy', 'tier'],
  );
  assert.equal(JSON.stringify(raw).includes('agentEdits'), false, 'never, on either branch');
});

test('tier on a category that already resolves here is refused — this is the F2 attack', () => {
  const refusals = refusePackConfig(
    { categories: { rule: { tier: 'rationale', agentEdits: 'allow' } } }, LOCAL,
  );
  assert.equal(refusals.length, 2);
  assert.ok(refusals.some((r) => r.includes('tier')));
  assert.ok(refusals.some((r) => r.includes('agentEdits')));
  assert.ok(refusals.every((r) => /boundary/.test(r)));
});

test('tier on a name this build has never heard of is ACCEPTED — §6n.1', () => {
  // The half §6m.4 refused and §6n.1 restored. It can override nothing,
  // because there is nothing at this name to override; and resolveConfig
  // will not resolve the config without it, which is why the flat refusal
  // was jointly unsatisfiable with the code rather than merely strict.
  const raw = { categories: { threat_model: { enabled: true, tier: 'normative', description: 'A threat.' } } };
  assert.deepEqual(refusePackConfig(raw, LOCAL), []);
  assert.doesNotThrow(() => resolveConfig(mergePackConfig({ categories: {} }, raw)));
});

test('a new category WITHOUT tier and description is refused, naming both', () => {
  // Not a policy of this module — the resolver would throw on the way in,
  // and a refusal here names the pack rather than surfacing as a config
  // error after the corpus has been half-built.
  const refusals = refusePackConfig({ categories: { threat_model: { enabled: true } } }, LOCAL);
  assert.equal(refusals.length, 1);
  assert.ok(refusals[0].includes('threat_model'));
  assert.ok(/tier/.test(refusals[0]) && /description/.test(refusals[0]));
});

test('agentEdits is refused on a NEW name too, and the refusal says the tier already decides it', () => {
  const refusals = refusePackConfig(
    { categories: { threat_model: { tier: 'normative', description: 'A threat.', agentEdits: 'allow' } } },
    LOCAL,
  );
  assert.equal(refusals.length, 1);
  assert.ok(refusals[0].includes('agentEdits'));
});

test('a new category whose prefix is already in use is reported, not silently accepted', () => {
  const refusals = refusePackConfig(
    { categories: { threat_model: { tier: 'normative', description: 'A threat.', prefix: 'RULE' } } },
    LOCAL,
  );
  assert.equal(refusals.length, 1);
  assert.ok(refusals[0].includes('RULE') && refusals[0].includes('rule'));
});

test('budgets, watchedDocs and profile in a pack are refused', () => {
  for (const key of ['budgets', 'watchedDocs', 'profile']) {
    const refusals = refusePackConfig({ [key]: {} }, LOCAL);
    assert.ok(refusals.some((r) => r.includes(key)), key);
  }
});

test('enabled: false is refused — a pack may add vocabulary, never silence the importer', () => {
  assert.equal(refusePackConfig({ categories: { rule: { enabled: false } } }, LOCAL).length, 1);
});

test('the merge touches categories only; budgets and watchedDocs come out untouched', () => {
  const existing = {
    profile: 'strict',
    categories: { rule: { scopePolicy: 'required' } },
    budgets: { pinned: 9000 },
    watchedDocs: ['docs/mine/**'],
  };
  const merged = mergePackConfig(existing, {
    categories: { standard: { enabled: true, prefix: 'STD', scopePolicy: 'global' } },
  });
  assert.deepEqual(merged.budgets, { pinned: 9000 });
  assert.deepEqual(merged.watchedDocs, ['docs/mine/**']);
  assert.equal(merged.profile, 'strict');
  assert.equal(merged.categories.rule.scopePolicy, 'required');
  assert.equal(merged.categories.standard.enabled, true);
  assert.doesNotThrow(() => resolveConfig(merged));
});

test('the merge is field-wise inside one category, not entry replacement', () => {
  const merged = mergePackConfig(
    { categories: { rule: { scopePolicy: 'required' } } },
    { categories: { rule: { enabled: true, prefix: 'RULE' } } },
  );
  assert.deepEqual(merged.categories.rule, { scopePolicy: 'required', enabled: true, prefix: 'RULE' });
});
```

- [ ] **Step 2: Run it and see it fail** — module not found.

- [ ] **Step 3: Implement**

`refusePackConfig` checks, in this order, before anything is read out of the object: an unknown top-level key; `budgets`/`watchedDocs`/`profile` present; `categories` not an object; then, per category, **the two branches §6n.1 draws**:

- **The name already resolves** (`Object.hasOwn(local.categories, name)`) — refuse `tier`, refuse `agentEdits`, refuse `description`, refuse `enabled` present and not `true`, refuse any key outside `enabled`, `prefix`, `scopePolicy`.
- **The name does not resolve** — refuse `agentEdits`; **require** `tier` (a valid one) and `description`, refusing with one sentence that names both when either is absent; refuse `enabled` present and not `true`; refuse any key outside `enabled`, `tier`, `description`, `prefix`, `scopePolicy`; and refuse a `prefix` that `local` already assigns to a different category, naming both the prefix and the category holding it.

The asymmetry is the whole rule and belongs in the module docstring in one line: *a pack may name knowledge this build has never heard of, and may not re-describe knowledge it has.*

Each refusal is a full sentence. The `tier`-on-an-existing-name one carries the argument, because a warning here is the hole this rule closes:

> `my_context: this pack sets categories.rule.tier, and "rule" is a category this build already has, so a pack may not. A tier override lands every future agent-authored rule "active" instead of "draft", and stops every rule you already have being injected at all — strictly more power than a --trust flag, which this product refuses for the same reason: a boundary a flag can override is not a boundary. Nothing was imported. (A pack MAY declare a tier for a category name this build does not have; there it can override nothing, and the config resolver requires it.)`

The closing parenthetical is not padding. §6m.4's flat refusal read as *"a pack may never say `tier`"*, and that reading is exactly what §6n.1 had to withdraw; a message that refuses without naming the permitted half teaches the withdrawn rule to everyone who ever hits it.

`mergePackConfig` deep-clones the existing raw config, then assigns each permitted field individually onto the existing category entry (creating the entry when absent — which is the branch a pack-defined category takes, carrying `tier` and `description` with it). It never touches any other top-level key, so `budgets` and `watchedDocs` are untouched **by construction** rather than by being stripped and re-defaulted.

- [ ] **Step 4: Run the test and see it pass** — 12 tests.

- [ ] **Step 5: Full gate and commit**

```bash
npx tsc --noEmit && npm test
git add src/pack/config-io.ts test/pack/config-io.test.ts
git commit -m "feat(pack): config projections, the trust-key refusals and the field-wise merge"
```

---

## Task 3: `manifest.ts` — full SHA-256, sorted, and the sentence it may never say

**Files:**
- Create: `src/pack/manifest.ts`
- Test: `test/pack/manifest.test.ts`

**Interfaces:**
- Consumes: `node:crypto`; `layout.ts`; `VERSION` from `core/version.ts`.
- Produces:
  - `buildManifest(files: ExportFile[], meta: { kind: ArtefactKind; name: string | null; version: string | null; now: number }): Manifest`
  - `renderManifest(m: Manifest): Buffer`
  - `parseManifest(bytes: Buffer): Manifest`
  - `verifyManifest(m: Manifest, present: ExportFile[]): { missing: string[]; extra: string[]; mismatched: string[] }`
  - `refuseDescriptiveVersion(v: unknown): string | null`, `refusePackName(v: unknown): string | null`

- [ ] **Step 1: Write the failing test**

```ts
// test/pack/manifest.test.ts
/**
 * The manifest is TRANSIT INTEGRITY. The last test in this file is the one
 * that matters most: it asserts that nothing this module emits can be read as
 * a statement about the author. A checksum a pack carries about itself proves
 * the files arrived intact and nothing else, and a message that says
 * "verified" without saying what was verified has started doing a job it
 * cannot do.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  buildManifest, parseManifest, refuseDescriptiveVersion, renderManifest, verifyManifest,
} from '../../src/pack/manifest.ts';

const file = (path: string, body: string) => ({ path, bytes: Buffer.from(body, 'utf8') });
const FILES = [file('items/rule/RULE-b.md', 'b'), file('config.json', '{}'), file('items/rule/RULE-a.md', 'a')];
const META = { kind: 'pack' as const, name: 'acme', version: '2026-08 rev 3', now: 1_755_000_000_000 };

test('files are sorted by UTF-8 bytes and the manifest never lists itself', () => {
  const m = buildManifest([...FILES, file('manifest.json', 'x')], META);
  assert.deepEqual(m.files.map((f) => f.path),
    ['config.json', 'items/rule/RULE-a.md', 'items/rule/RULE-b.md']);
});

test('every digest is the full 64-hex SHA-256 of the file bytes', () => {
  const m = buildManifest(FILES, META);
  const entry = m.files.find((f) => f.path === 'items/rule/RULE-a.md');
  assert.equal(entry.sha256, createHash('sha256').update(Buffer.from('a', 'utf8')).digest('hex'));
  assert.match(entry.sha256, /^[0-9a-f]{64}$/);
  assert.equal(entry.bytes, 1);
});

test('every key is always present; absence is null, never an omitted key', () => {
  const m = buildManifest(FILES, { kind: 'export', name: null, version: null, now: META.now });
  assert.deepEqual(Object.keys(m),
    ['protocol', 'kind', 'name', 'version', 'generator', 'createdAt', 'itemCount', 'files']);
  assert.equal(m.name, null);
  assert.equal(m.version, null);
  assert.equal(m.itemCount, 2);
});

test('the rendered bytes are two-space JSON, LF, with exactly one trailing newline', () => {
  const text = renderManifest(buildManifest(FILES, META)).toString('utf8');
  assert.ok(text.endsWith('}\n'));
  assert.equal(text.endsWith('}\n\n'), false);
  assert.ok(text.includes('\n  "protocol"'));
  assert.equal(text.includes('\r'), false);
});

test('rendering is byte-identical across runs for a fixed clock', () => {
  assert.deepEqual(renderManifest(buildManifest(FILES, META)), renderManifest(buildManifest(FILES, META)));
});

test('parseManifest refuses a foreign protocol, a short digest, an out-of-order array and a missing key', () => {
  const good = JSON.parse(renderManifest(buildManifest(FILES, META)).toString('utf8'));
  const mutations = [
    (m) => { m.protocol = 'someone/else@1'; },
    (m) => { m.files[0].sha256 = 'abc'; },
    (m) => { m.files.reverse(); },
    (m) => { delete m.itemCount; },
  ];
  for (const mutate of mutations) {
    const copy = JSON.parse(JSON.stringify(good));
    mutate(copy);
    assert.throws(
      () => parseManifest(Buffer.from(`${JSON.stringify(copy, null, 2)}\n`, 'utf8')),
      /my_context:/,
    );
  }
});

test('verifyManifest names missing, extra and mismatched files separately', () => {
  const m = buildManifest(FILES, META);
  const present = [
    file('config.json', '{}'),
    file('items/rule/RULE-a.md', 'CHANGED'),
    file('items/rule/RULE-z.md', 'z'),
  ];
  const v = verifyManifest(m, present);
  assert.deepEqual(v.missing, ['items/rule/RULE-b.md']);
  assert.deepEqual(v.extra, ['items/rule/RULE-z.md']);
  assert.deepEqual(v.mismatched, ['items/rule/RULE-a.md']);
});

test('a descriptive version is opaque: required, trimmed, bounded, and never parsed', () => {
  assert.equal(refuseDescriptiveVersion('2026-08 rev 3'), null);
  for (const bad of [undefined, null, '', '   ', 42, 'x'.repeat(65)]) {
    assert.ok(refuseDescriptiveVersion(bad), String(bad));
  }
});

test('nothing this module emits describes the manifest as evidence of trust', () => {
  const source = readFileSync(new URL('../../src/pack/manifest.ts', import.meta.url), 'utf8');
  for (const forbidden of [/\btrusted\b/i, /\bsafe to\b/i, /\bauthentic/i, /\bsigned by\b/i, /\bverified author/i]) {
    assert.equal(forbidden.test(source), false, `manifest.ts says ${forbidden}`);
  }
});
```

- [ ] **Step 2: Run it and see it fail** — module not found.

- [ ] **Step 3: Implement** exactly to the byte layout in the section above. `itemCount` counts entries whose path starts with `items/`. `verifyManifest` returns three arrays, each sorted with `comparePaths`.

- [ ] **Step 4: Run the test and see it pass** — 9 tests.

- [ ] **Step 5: Full gate and commit**

```bash
npx tsc --noEmit && npm test
git add src/pack/manifest.ts test/pack/manifest.test.ts
git commit -m "feat(pack): manifest.json byte layout — full SHA-256 per file, sorted"
```

---

## Task 4: `history.ts` — mutations only, projected, redacted, joined and totally ordered

**Files:**
- Create: `src/pack/history.ts`
- Test: `test/pack/history.test.ts`

**Interfaces:**
- Consumes: `readAudit`, `filterAudit`, `AuditRecord` from `core/audit.ts`; `parseJsonlLog` from `core/jsonl-log.ts`; `layout.ts`.
- Produces:
  - `projectMutation(r: AuditRecord): PackHistoryRecord`
  - `compareHistory(a: PackHistoryRecord, b: PackHistoryRecord): number` — exported so the writer and the test share one definition.
  - `exportableHistory(root: string, itemIds: Set<string>): PackHistoryRecord[]`
  - `renderHistory(records: PackHistoryRecord[]): Buffer`
  - `parseHistory(bytes: Buffer, file: string): { records: PackHistoryRecord[]; unknown: JsonlRow[] }`

**The one thing this module exists to get right.** The audit reader refuses the whole segment on the first unrecognised op, which is correct locally and fatal on import. `parseHistory` therefore supplies its **own** log spec whose validator accepts any string `op` and sorts rows into two lists. Protocol, JSON shape and torn-tail handling all still come from the shared parser, so the only thing loosened is the op vocabulary. Locally the strictness stands, because there an unknown op means this build wrote a record it cannot read back.

The sort is stable in the third position by construction: `compareHistory` compares `at`, then `itemId`, then `op`, and `exportableHistory` sorts an array that is already in segment order, so equal keys keep their original relative positions.

**§6n.5 — the audit segment format version. This module DEPENDS on it and does not build it.** §6n.5 adds a version to the local audit log because `parseAudit` refuses a whole segment on an unknown kind, so a v2.0 log is otherwise unreadable in its entirety by a v1.0.2 reader. That work is a change to `core/audit.ts`'s own segment format and belongs to the categories-and-runbooks plan, which names §6n.5 in its scope split — **do not implement it here, and do not wait for it either.** Three facts make this module unaffected in both directions, and each is a thing to *check* rather than assume when §6n.5 lands:

1. **Reading.** `exportableHistory` goes through the audit reader rather than parsing bytes itself, so whatever version handling §6n.5 adds is inherited, including its refusal for a log newer than this build.
2. **Projecting.** `projectMutation` builds an **object literal with a fixed key list**, so a new segment-level field is dropped by construction, not by anybody remembering to drop it. The first test in this task already asserts the exact key set and will fail if a field starts leaking through — which is the desired failure, because a pack must not carry the exporter's log format into someone else's corpus.
3. **Writing.** Nothing this plan writes is an audit segment. `history.jsonl` carries `PACK_HISTORY_PROTOCOL`, which already encodes its own version in the `@1`, and everything under `.audit/imported/` is invisible to `core/audit.ts` · `const SEGMENT_PATTERN = /^audit\.[0-9TZ]+-\d+\.jsonl$/;` · ~1234.

If §6n.5 lands **after** this task, nothing here changes. If it lands **before**, re-run this task's first test before implementing: a green run over the asserted key set is the whole verification.

- [ ] **Step 1: Write the failing test**

```ts
// test/pack/history.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareHistory, exportableHistory, parseHistory, projectMutation, renderHistory,
} from '../../src/pack/history.ts';
import { PACK_HISTORY_PROTOCOL } from '../../src/pack/layout.ts';

const rec = (over) => ({
  protocol: 'my_context/audit@1', at: '2026-08-01T00:00:00.000Z',
  kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-a', ...over,
});

test('the per-machine half is projected away, not passed through', () => {
  const p = projectMutation(rec({ sessionId: 'abc', path: 'src/db/writer.ts', hook: 'PreToolUse', tokens: 12 }));
  assert.deepEqual(Object.keys(p), ['protocol', 'at', 'kind', 'op', 'origin', 'itemId']);
  assert.equal(p.protocol, PACK_HISTORY_PROTOCOL);
});

test('a discard note keeps the revision id and drops the free text after the first colon-space', () => {
  assert.equal(projectMutation(rec({ op: 'discard', note: 'REV-7: it named a customer' })).note, 'REV-7');
  assert.equal(projectMutation(rec({ op: 'discard', note: 'REV-7' })).note, 'REV-7');
});

test('the order is total: equal timestamps fall back to itemId, then op, then original position', () => {
  const at = '2026-08-01T00:00:00.000Z';
  const projected = [
    rec({ at, itemId: 'B', op: 'update' }),
    rec({ at, itemId: 'A', op: 'update' }),
    rec({ at, itemId: 'A', op: 'create' }),
  ].map(projectMutation);
  const lines = renderHistory(projected.toSorted(compareHistory))
    .toString('utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((r) => `${r.itemId}:${r.op}`), ['A:create', 'A:update', 'B:update']);
});

test('every line is newline-terminated, including the last', () => {
  assert.ok(renderHistory([projectMutation(rec({}))]).toString('utf8').endsWith('}\n'));
});

test('parseHistory quarantines an unknown op instead of refusing the whole segment', () => {
  const good = JSON.stringify(projectMutation(rec({})));
  const alien = JSON.stringify({
    protocol: PACK_HISTORY_PROTOCOL, at: '2026-08-02T00:00:00.000Z',
    kind: 'mutation', op: 'annotate', origin: 'human', itemId: 'RULE-b',
  });
  const { records, unknown } = parseHistory(Buffer.from(`${good}\n${alien}\n`, 'utf8'), 'history.jsonl');
  assert.equal(records.length, 1);
  assert.equal(unknown.length, 1);
  assert.equal(unknown[0].op, 'annotate');
});

test('a foreign protocol is still refused wholesale — the loosening is the op vocabulary only', () => {
  const line = JSON.stringify({ protocol: 'someone/else@1', at: '2026-08-02T00:00:00.000Z', op: 'create' });
  assert.throws(() => parseHistory(Buffer.from(`${line}\n`, 'utf8'), 'history.jsonl'), /my_context:/);
});
```

Then two workspace-backed tests using the `sandbox()` helper: create `RULE-a` and `RULE-b`, record one injection, and assert

```ts
test('history is joined to the selection: a record naming a withheld item does not travel', () => {
  const kept = exportableHistory(box.root, new Set(['RULE-a']));
  assert.ok(kept.length > 0);
  assert.deepEqual([...new Set(kept.map((r) => r.itemId))], ['RULE-a']);
});

test('injections, hook actions and focus records never travel', () => {
  assert.deepEqual(exportableHistory(box.root, new Set(['RULE-a'])).filter((r) => r.kind !== 'mutation'), []);
});
```

- [ ] **Step 2: Run it and see it fail.**

- [ ] **Step 3: Implement.** `exportableHistory` reads every segment through the audit reader — not just the live file, or a rotated log exports half its history — filters `kind === 'mutation'`, drops records whose `itemId` is absent from the set or absent entirely, projects, and sorts with `compareHistory`.

- [ ] **Step 4: Run the test and see it pass** — 8 tests.

- [ ] **Step 5: Full gate and commit**

```bash
npx tsc --noEmit && npm test
git add src/pack/history.ts test/pack/history.test.ts
git commit -m "feat(pack): exportable history — mutations only, redacted, joined, totally ordered"
```

---

## Task 5: `bundle.ts` — the allow-list walk and the one selection

**Files:**
- Create: `src/pack/bundle.ts`
- Test: `test/pack/bundle.test.ts`

**Interfaces:**
- Consumes: `loadLayer` and `renderItem`; `filterItems` from `core/search.ts`; `history.ts`, `config-io.ts`, `manifest.ts`, `layout.ts`.
- Produces:
  - ```ts
    interface BundleOptions {
      kind: ArtefactKind;
      name: string | null;          // required when kind === 'pack'
      version: string | null;       // required when kind === 'pack'
      filters: ItemFilters;         // type / status / tag, reusing the corpus filter
      history: boolean;             // default true
      now: number;                  // injectable clock
    }
    interface Bundle {
      files: ExportFile[];          // sorted, manifest.json last-built and included
      manifest: Manifest;
      report: {
        items: number;
        byCategory: Record<string, number>;
        historyRecords: number;
        droppedFields: { field: string; items: number }[];
        excluded: { id: string; reason: string }[];
      };
    }
    function buildBundle(root: string, config: Config, options: BundleOptions): Bundle;
    ```

**This is the largest single piece and it is one implementation on purpose.** A second packer behind `--as-pack` would be the fifth spelling of a concept this project has already paid for four times.

**What it walks, and what it never walks.** It calls the item loader for the **project layer only** — the global layer is another workspace's corpus and is read-only from here — renders each selected item with the shipped renderer, and constructs the artefact path from the item's own `filePath`. **It never reads the workspace directory.** There is no directory walk to widen: the only files it can produce are one per selected item plus the three root files, and each one is passed through the path refusal from Task 1 before it enters the bundle.

**The pack projection of an item**, applied only when `kind === 'pack'`: `sourceFile`, `sourceAnchor` and `sourceChecksum` are set to `null` before rendering, and the count is reported in `droppedFields`. Left in, they make the importer's `doctor` emit `source_missing` at level **error** for every imported item, permanently, for documents they can never resolve.

- [ ] **Step 1: Write the failing test**

```ts
// test/pack/bundle.test.ts
// …sandbox with rule/standard/lesson items, one draft, one deprecated…

test('the bundle contains only items, config and history — never state, index, revisions, ingest or staging', () => {
  // Create .revisions/, .ingest/, .staging/, state/ and .index.db in the sandbox first,
  // so the assertion is about the walk and not about the fixture being thin.
  const bundle = buildBundle(box.root, box.ctx.config, EXPORT_OPTS);
  for (const f of bundle.files) {
    assert.equal(refuseArtefactPath(f.path), null, f.path);
  }
  const roots = new Set(bundle.files.map((f) => f.path.split('/')[0]));
  assert.deepEqual([...roots].toSorted(), ['config.json', 'history.jsonl', 'items', 'manifest.json']);
});

test('a pack strips provenance and counts what it dropped; a full export keeps it', () => {
  const pack = buildBundle(box.root, box.ctx.config, PACK_OPTS);
  const packItem = pack.files.find((f) => f.path.endsWith('RULE-from-a-doc.md')).bytes.toString('utf8');
  assert.equal(packItem.includes('source_file:'), false);
  assert.ok(pack.report.droppedFields.some((d) => d.field === 'source_file' && d.items === 1));

  const full = buildBundle(box.root, box.ctx.config, EXPORT_OPTS);
  const fullItem = full.files.find((f) => f.path.endsWith('RULE-from-a-doc.md')).bytes.toString('utf8');
  assert.ok(fullItem.includes('source_file:'));
});

test('a pack config names exactly the categories that hold an item, and carries no profile', () => {
  const pack = buildBundle(box.root, box.ctx.config, PACK_OPTS);
  const raw = JSON.parse(pack.files.find((f) => f.path === 'config.json').bytes.toString('utf8'));
  assert.deepEqual(Object.keys(raw), ['categories']);
  assert.deepEqual(Object.keys(raw.categories).toSorted(),
    [...new Set(selectedItems.map((i) => i.type))].toSorted());
});

test('a filtered export excludes items and NAMES every exclusion', () => {
  const bundle = buildBundle(box.root, box.ctx.config, { ...EXPORT_OPTS, filters: { type: 'rule' } });
  assert.equal(bundle.report.items, 1);
  assert.equal(bundle.report.excluded.length, box.allItems.length - 1);
  assert.ok(bundle.report.excluded.every((e) => e.reason.includes('--type')));
});

test('history is joined to the selection and can be suppressed', () => {
  const withHistory = buildBundle(box.root, box.ctx.config, EXPORT_OPTS);
  assert.ok(withHistory.report.historyRecords > 0);
  const without = buildBundle(box.root, box.ctx.config, { ...EXPORT_OPTS, history: false });
  assert.equal(without.files.some((f) => f.path === 'history.jsonl'), false);
  assert.equal(without.report.historyRecords, 0);
});

test('the manifest covers every file except itself, and every digest resolves', () => {
  const b = buildBundle(box.root, box.ctx.config, EXPORT_OPTS);
  const present = b.files.filter((f) => f.path !== 'manifest.json');
  assert.deepEqual(verifyManifest(b.manifest, present), { missing: [], extra: [], mismatched: [] });
});

test('an item file round-trips: parse(render(item)) equals the item that was selected', () => {
  // INV-markdown-is-the-source-of-truth, applied to the wire format. If an
  // exported item does not parse back to what was exported, the corpus that
  // arrives is not the corpus that was sent.
  for (const f of buildBundle(box.root, box.ctx.config, EXPORT_OPTS).files) {
    if (!f.path.startsWith('items/')) continue;
    const parsed = parseItem(f.bytes.toString('utf8'), f.path, 'project');
    assert.equal(renderItem(parsed), f.bytes.toString('utf8'));
  }
});
```

- [ ] **Step 2: Run it and see it fail.**

- [ ] **Step 3: Implement.** Order inside `buildBundle`: load the project layer → apply `filterItems` and record every exclusion with the flag that caused it → project each item for the kind → render → build the id set → build history → build the config projection → sort every file with the comparator → build and append the manifest.

- [ ] **Step 4: Run the test and see it pass** — 7 tests.

- [ ] **Step 5: Full gate and commit**

```bash
npx tsc --noEmit && npm test
git add src/pack/bundle.ts test/pack/bundle.test.ts
git commit -m "feat(pack): the allow-list bundle builder behind all four surfaces"
```

---

## Task 6: `dir-writer.ts` — the canonical rung

**Files:**
- Create: `src/pack/dir-writer.ts`
- Test: `test/pack/dir-writer.test.ts`

**Interfaces:**
- Consumes: `node:fs`, `node:path`; `retryOnTransientFsError` from `core/rebuild.ts`; `layout.ts`.
- Produces: `writeBundleDirectory(bundle: Bundle, outDir: string): string[]` — the absolute paths written, in bundle order.

This is the canonical format. A plain directory in workspace shape imports with `cp -r`, diffs per item, and needs no code to read.

**Rules.** `outDir` must not exist, or must exist and be empty — an export never merges into a directory that already holds something, because "which of these files did I just write" is not a question a user should have to answer. Directories are created with `recursive: true` as each file demands them. Each write goes through the transient-error retry wrapper, which is what makes this survive a Windows anti-virus handle. Paths are joined from POSIX segments with the platform separator, never by string concatenation.

- [ ] **Step 1: Write the failing test**

```ts
test('the directory is written in bundle shape and nothing else appears in it', () => { … });
test('an existing non-empty directory is refused, and nothing is written', () => { … });
test('an existing empty directory is accepted', () => { … });
test('writing twice into two directories produces byte-identical trees for one bundle', () => {
  // The determinism claim for the canonical rung, and it is unconditional here:
  // a directory has no container bytes to pin.
});
test('a bundle carrying an illegal path is refused before any file is created', () => {
  // Defence in depth: the bundle builder already refuses these. This asserts
  // the writer does not trust its input, because the ZIP writer will be the
  // second caller and a shared invariant enforced in one caller is not enforced.
});
```

- [ ] **Step 2: Run it and see it fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the test and see it pass** — 5 tests.
- [ ] **Step 5: Full gate and commit**

```bash
npx tsc --noEmit && npm test
git add src/pack/dir-writer.ts test/pack/dir-writer.test.ts
git commit -m "feat(pack): the canonical directory writer"
```

---

## Task 7: `zip.ts` — the deterministic archive, hand-written

**Files:**
- Create: `src/pack/zip.ts`
- Test: `test/pack/zip.test.ts`

**Interfaces:**
- Consumes: `node:zlib` (`crc32` on write, `inflateRawSync` on read); `layout.ts`.
- Produces:
  - `writeZip(files: ExportFile[]): Buffer`
  - `readZip(bytes: Buffer): ExportFile[]`
  - `refuseZipInput(files: ExportFile[]): string | null`

**Size, honestly.** Roughly 150–220 lines including the determinism pinning, the refusals and the reader — the survey's estimate, not the spec's. It is not the largest piece of this plan; the bundle builder is.

**Implement exactly the byte tables in the "Byte layouts" section above.** Every fixed value there is fixed for a reason stated there. Three points an implementer gets wrong once:

1. **`zlib.crc32(bytes) >>> 0`.** The header field is unsigned 32-bit; a signed value writes the wrong bytes for any digest with the high bit set. `zlib.crc32(Buffer.from('abc'))` is `0x352441c2` on the installed runtime — a fixture worth keeping in the test as the arithmetic check.
2. **Bit 11 of the general-purpose flag is set always.** Names are written as UTF-8 unconditionally, so an ASCII corpus and a corpus with a non-ASCII custom category produce the same header shape and the writer has one path, not two.
3. **The DOS date is `0x0021`, not `0x0000`.** Zero encodes day 0 of month 0, which some readers render as garbage and some reject; `0x0021` is 1980-01-01, the lowest date the encoding can express.

- [ ] **Step 1: Write the failing test**

```ts
// test/pack/zip.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, deflateRawSync } from 'node:zlib';
import { readZip, refuseZipInput, writeZip } from '../../src/pack/zip.ts';

const file = (path, body) => ({ path, bytes: Buffer.from(body, 'utf8') });
const FILES = [file('items/rule/RULE-b.md', 'bbbb'), file('config.json', '{}'), file('items/rule/RULE-a.md', 'aaaa')];

test('the archive is byte-identical across runs for one file set', () => {
  assert.deepEqual(writeZip(FILES), writeZip(FILES));
  // and across a re-ordered input, because entry order is the comparator's,
  // not the caller's.
  assert.deepEqual(writeZip(FILES), writeZip([...FILES].reverse()));
});

test('entries appear in UTF-8 byte order', () => {
  assert.deepEqual(readZip(writeZip(FILES)).map((f) => f.path),
    ['config.json', 'items/rule/RULE-a.md', 'items/rule/RULE-b.md']);
});

test('the local header carries the fixed values, at the documented offsets', () => {
  const z = writeZip([file('a.md', 'x')].map((f) => ({ ...f, path: 'config.json' })));
  assert.equal(z.readUInt32LE(0), 0x04034b50);
  assert.equal(z.readUInt16LE(4), 20, 'version needed');
  assert.equal(z.readUInt16LE(6), 0x0800, 'UTF-8 name flag, always');
  assert.equal(z.readUInt16LE(8), 0, 'method 0 — stored');
  assert.equal(z.readUInt16LE(10), 0x0000, 'time');
  assert.equal(z.readUInt16LE(12), 0x0021, 'date — 1980-01-01, the lowest DOS can express');
  assert.equal(z.readUInt32LE(14), crc32(Buffer.from('x', 'utf8')) >>> 0);
  assert.equal(z.readUInt16LE(28), 0, 'no extra field');
});

test('crc32 is written unsigned — the case a signed value corrupts', () => {
  // A payload whose CRC has the high bit set. If the writer stores the signed
  // value, readZip's own verification catches it, which is why this test reads
  // back rather than asserting the number.
  const payload = 'a'.repeat(3);           // crc 0x352441c2 has bit 31 clear
  const highBit = 'the quick brown fox';   // established by executing, see step 3
  for (const body of [payload, highBit]) {
    assert.deepEqual(readZip(writeZip([file('config.json', body)]))[0].bytes, Buffer.from(body, 'utf8'));
  }
});

test('the EOCD is the last 22 bytes and its counts and offsets agree with the directory', () => {
  const z = writeZip(FILES);
  const eocd = z.length - 22;
  assert.equal(z.readUInt32LE(eocd), 0x06054b50);
  assert.equal(z.readUInt16LE(eocd + 8), FILES.length);
  assert.equal(z.readUInt16LE(eocd + 10), FILES.length);
  assert.equal(z.readUInt32LE(eocd + 16) + z.readUInt32LE(eocd + 12), eocd);
});

test('the reader accepts method 8, because a user who zips the directory themselves produces it', () => {
  // Hand-build a one-entry deflated archive with the same header shape and
  // assert readZip inflates it. This is the only reason inflateRawSync is
  // imported at all.
});

test('the reader refuses a wrong CRC, a wrong size, an unknown method and a traversing name', () => { … });

test('oversize inputs are refused rather than silently truncated into a broken header', () => {
  assert.ok(refuseZipInput([{ path: 'config.json', bytes: { length: 2 ** 32 } }]));
  assert.ok(refuseZipInput(Array.from({ length: 70_000 }, (_, i) => file(`items/rule/R-${i}.md`, 'x'))));
});

test('the round trip is exact for every byte a corpus can hold', () => {
  const bodies = ['', 'a', 'אבג', '\u{1F600}', 'line1\nline2\n', 'x'.repeat(70_000)];
  for (const body of bodies) {
    assert.deepEqual(readZip(writeZip([file('config.json', body)]))[0].bytes, Buffer.from(body, 'utf8'));
  }
});
```

- [ ] **Step 2: Run it and see it fail.**

- [ ] **Step 3: Establish the high-bit CRC fixture by executing**

Run `node -e "const {crc32}=require('node:zlib'); for (const s of ['the quick brown fox','mycontext','pack']) console.log(s, (crc32(Buffer.from(s))>>>0).toString(16))"` and put a string whose CRC has bit 31 set into the test above, with the hex value in a comment. Do not guess one: the whole value of that test is that the fixture really exercises the sign.

- [ ] **Step 4: Implement.**

- [ ] **Step 5: Run the test and see it pass** — 9 tests.

- [ ] **Step 6: Full gate and commit**

```bash
npx tsc --noEmit && npm test
git add src/pack/zip.ts test/pack/zip.test.ts
git commit -m "feat(pack): deterministic ZIP writer and a tolerant reader, zero dependencies"
```

---

## Task 8: `screen.ts` — the Unicode screen at the door

**Files:**
- Create: `src/pack/screen.ts`
- Test: `test/pack/screen.test.ts`

**Interfaces:**
- Consumes: nothing but the standard library.
- Produces:
  - `screenText(text: string, where: string): ScreenFinding[]` — `{ where; codePoint: string; name: string; offset: number }`
  - `screenItem(item: Item): ScreenFinding[]` — title, body, every observation text/context/tag, every tag, every scope glob, every relation target, every `extra` value, and the id.
  - `screenPackMeta(name: string, version: string): ScreenFinding[]`
  - `SCREENED_RANGES` — the table, exported so the test and the message read the same list.

**What is refused, exactly:**

| Range | Name | Why |
|---|---|---|
| U+061C | Arabic letter mark | bidi |
| U+200E, U+200F | LRM, RLM | bidi |
| U+202A–U+202E | embedding and override | bidi |
| U+2066–U+2069 | isolates | bidi |
| U+200B | zero-width space | invisible |
| U+200C, U+200D | ZWNJ, ZWJ | invisible |
| U+2060 | word joiner | invisible |
| U+FEFF | BOM anywhere but offset 0 of a file | invisible |
| U+E0000–U+E007F | the Tags block | invisible, and the vector the Rules File Backdoor uses |
| U+0000–U+0008, U+000B, U+000C, U+000E–U+001F, U+007F–U+009F | C0 and C1 controls other than tab and newline | invisible |
| unpaired surrogates | — | not text |

**The cost, named rather than discovered.** U+200E and U+200F are legitimately used in mixed Hebrew/Latin text, and this repository ships a Hebrew README that uses directional markup elsewhere. Refusing them means a Hebrew- or Arabic-authored pack can be refused for content its author considers correct. That cost is accepted because an invisible reordering control inside a normative item can make a rule read as its opposite to a human while the model reads the other one — and the corpus is normative text, not prose for display. **There is no `--allow-bidi` flag**, for the reason the product refuses a `--trust` flag: a boundary a flag can override is not a boundary. The refusal names the item, the field, the code point and the offset, so an author can remove it in one edit.

**The screen never normalises.** Rewriting the text would change the bytes the manifest hashed, so the screen reports and refuses; it does not clean.

- [x] **Step 1: Write the failing test** — one case per row of the table above, plus:

```ts
test('a BOM at offset 0 of a file is accepted; a BOM anywhere else is refused', () => { … });
test('legitimate Hebrew, Arabic and emoji text with no controls passes untouched', () => { … });
test('the screen reports every finding, not the first — a report that stops early hides the rest', () => { … });
test('the message names the code point, the field and the offset', () => {
  assert.match(finding.message, /U\+200E/);
});
test('screenItem reaches every authored field, including extra values and relation targets', () => {
  // Constructed by taking one item and planting one control in each field in
  // turn: a silence audit, which is what catches a field the screen forgot.
});
```

- [x] **Step 2–4: fail, implement, pass.**
- [x] **Step 5: Full gate and commit**

```bash
npx tsc --noEmit && npm test
git add src/pack/screen.ts test/pack/screen.test.ts
git commit -m "feat(pack): the mandatory Unicode screen — bidi, zero-width and the Tags block"
```

---

## Task 9: `reader.ts` — sniff the format, verify the manifest, refuse the rest

**Files:**
- Create: `src/pack/reader.ts`
- Test: `test/pack/reader.test.ts`

**Interfaces:**
- Consumes: `node:fs`; `zip.ts`, `manifest.ts`, `history.ts`, `layout.ts`; `parseItem` from `core/item.ts`.
- Produces:
  - `sniffFormat(path: string): 'dir' | 'zip'` — a directory is `dir`; a file whose first four bytes are `50 4B 03 04` is `zip`; anything else is refused by name, and the refusal says what it found rather than guessing.
  - ```ts
    interface Artefact {
      format: 'dir' | 'zip';
      source: string;
      manifest: Manifest;
      verification: { missing: string[]; extra: string[]; mismatched: string[] };
      items: Item[];
      config: unknown;                 // raw JSON, unresolved and unmerged
      history: PackHistoryRecord[];
      unknownHistory: JsonlRow[];
    }
    function readArtefact(path: string): Artefact;
    ```

**Order, and it matters.** Sniff → read the byte set (a directory walk restricted by the path refusal, or the ZIP reader) → parse and verify the manifest → parse `config.json` → parse each item file → split the history. A manifest failure is a refusal: an artefact whose bytes did not arrive intact is not partially imported.

**The directory walk is the one place a walk exists in this plan**, so it is the one place a traversal can be introduced. It resolves every entry, rejects anything whose resolved path escapes the artefact root, and passes every relative path through the Task 1 refusal before reading it. A symlink is not followed — it is refused by name. `readArtefact` reads a stranger's directory, and a symlink there pointing at the importer's home directory is exactly what an allow-list is for.

- [x] **Step 1: Write the failing test**

```ts
test('a directory and a zip written from the same bundle read back identically', () => {
  const bundle = buildBundle(box.root, box.ctx.config, PACK_OPTS);
  writeBundleDirectory(bundle, dirOut);
  writeFileSync(zipOut, writeZip(bundle.files));
  const a = readArtefact(dirOut);
  const b = readArtefact(zipOut);
  assert.deepEqual(a.items, b.items);
  assert.deepEqual(a.manifest, b.manifest);
  assert.deepEqual(a.history, b.history);
});

test('a tampered item file fails manifest verification and the read is refused', () => { … });
test('a missing manifest is refused, and the message says which file it looked for', () => { … });
test('a file the manifest does not list is reported as extra and refused', () => { … });
test('a symlink inside the artefact directory is refused by name, never followed', () => { … });
test('a path escaping the artefact root is refused before it is opened', () => { … });
test('sniffFormat names what it found rather than guessing', () => {
  assert.throws(() => sniffFormat(someTextFile), /my_context: .*not a mycontext export/);
});
test('a history carrying an unknown op reads back with the record in unknownHistory', () => { … });
```

- [x] **Step 2–4: fail, implement, pass** — 8 tests.
- [x] **Step 5: Full gate and commit**

```bash
npx tsc --noEmit && npm test
git add src/pack/reader.ts test/pack/reader.test.ts
git commit -m "feat(pack): artefact reader — format sniff, manifest verification, traversal-proof walk"
```

---

## Task 10: `collide.ts` — the three buckets and their two renderers

**Files:**
- Create: `src/pack/collide.ts`
- Test: `test/pack/collide.test.ts`

**Interfaces:**
- Consumes: `itemContentHash` from `core/content-hash.ts`; `Store` reads; `layout.ts`; `format.ts`'s renderers.
- Produces:
  - `bucketise(incoming: Item[], existing: (id: string) => Item | null): Buckets` where `Buckets = { new: Item[]; changed: Changed[]; identical: Item[] }` and
    ```ts
    type Changed = {
      incoming: Item; existing: Item;
      existingHash: string; incomingHash: string;
      differs: string[];              // field names, in hashContent's own composition order
      overwritable: boolean;          // false when `blockedBy` is set
      blockedBy: string | null;       // the first differing field with no write path
    };
    ```
  - `diffFields(a: Item, b: Item): string[]` — the field-name list, exported so the renderer and the JSON share **one** definition and neither can drift from the predicate.
  - `renderCollisionReport(report: CollisionReport): string[]`
  - `collisionJson(report: CollisionReport): unknown`

**Why `Changed` grew three fields — §6n.7.** A pair of hashes says *that* something changed; §6n.7 requires the warning to carry *enough of the change to recognise it*, because the user is about to approve replacing their own writing. `differs` is that. `blockedBy` and `overwritable` are the other half of the same honesty: `UpdateInput` has no route to `observations` or `relations` (§0 item 7), so an item differing only there is warned about as **not overwritable here** rather than being quietly counted among the items an approval would replace. Both are computed in `bucketise`, not in the renderer, because the CLI and the JSON must not disagree about which items an approval covers.

**`diffFields` composes in `hashContent`'s order** — `type, title, body, steps, severity, always, scope, tags, observations, relations, extra` (`core/content-hash.ts` · `function hashContent(v: ContentShape): string {` · ~123) — and compares with the same normalisation that function applies, so a field can never appear in `differs` without having moved the hash, and the buckets and the warning cannot disagree.

**The predicate is the one the corpus already uses.** `itemContentHash` excludes `id`, `status` and `origin`, trims title and body, sorts `scope` and `tags` as sets and canonicalises key order — which is exactly the three-bucket rule, and is the same predicate the item creator runs. Reusing it means a stranger's hand-authored item and a parsed one bucket the same way. It shares the 64-bit truncation, which is fine for a **report** — a false "identical" needs a deliberate collision — and is not fit for the manifest, which is why the manifest uses the full digest.

**The fourth case the buckets do not cover, named in the report.** Ids are slugified titles and the creator allocates an id *family* (`base`, `base-2`, `base-3`). Two corpora that each independently captured two items with the same title will disagree about which is `-2`. Nothing in the code resolves that. The report therefore adds a **note**, not a bucket: when an incoming id's family base matches an existing id whose content differs and whose own family has more than one member, the line carries `family collision — these two ids may name different things in the two corpora`. It is a warning a human reads, not a rule the machine acts on.

- [x] **Step 1: Write the failing test**

```ts
test('the three counts sum to the incoming item count — the arithmetic form of nothing-dropped', () => {
  const b = bucketise(incoming, lookup);
  assert.equal(b.new.length + b.changed.length + b.identical.length, incoming.length);
});

test('a lookup returning null means new — the codebase spells absence as null, not undefined', () => {
  assert.deepEqual(bucketise([item], () => null).new, [item]);
});

test('the same content under the same id is identical even when status and origin differ', () => {
  const mine = { ...shared, status: 'active', origin: 'human' };
  const theirs = { ...shared, status: 'draft', origin: 'ingest' };
  assert.equal(bucketise([theirs], () => mine).identical.length, 1);
});

test('a differing body is changed, and both short hashes are carried for the report', () => { … });

test('empty buckets still render, with their zero', () => {
  const lines = renderCollisionReport(emptyReport).join('\n');
  for (const bucket of ['new', 'changed', 'identical']) assert.match(lines, new RegExp(`${bucket}\\s+0`));
});

test('ids render in UTF-8 byte order inside every bucket', () => { … });

// ── §6n.7: the changed bucket IS the warning, so it is tested as one ──

test('every changed id appears in the rendered warning, with at least one field name', () => {
  // "Some items will be replaced" is a notice; §6n.7 requires a warning.
  const text = renderCollisionReport(r).join('\n');
  for (const c of r.buckets.changed) {
    assert.ok(text.includes(c.incoming.id), c.incoming.id);
    for (const field of c.differs) assert.ok(text.includes(field), `${c.incoming.id}: ${field}`);
  }
});

test('differs names exactly the fields that moved, in hashContent order', () => {
  const existing = { ...shared, body: 'old', tags: ['b', 'a'] };
  const incoming = { ...shared, body: 'new', tags: ['a', 'b'], severity: 'hard' };
  // `tags` differs only in ORDER, which the hash sorts away, so it must not
  // be listed: a field named in the warning that did not move the hash would
  // teach the user to distrust the warning.
  assert.deepEqual(bucketise([incoming], () => existing).changed[0].differs, ['body', 'severity']);
});

test('an item differing only in observations is changed, and NOT overwritable', () => {
  const [c] = bucketise([withObservation], () => withoutObservation).changed;
  assert.deepEqual(c.differs, ['observations']);
  assert.equal(c.overwritable, false);
  assert.equal(c.blockedBy, 'observations');
});

test('an active item facing an overwrite is told it drops to draft; a draft one is not', () => {
  const text = renderCollisionReport(withActiveAndDraftChanges).join('\n');
  assert.match(text, /stops governing until you promote it again/);
  assert.equal(text.match(/stops governing/g).length, 1, 'said once, for the active one only');
});

test('the report never says a changed item is skipped unconditionally', () => {
  // The withdrawn design's own sentence. Asserted because this plan shipped
  // it in five places before §6n.7 withdrew it, and a §0 row does not stop a
  // renderer from being written from memory.
  const text = renderCollisionReport(r).join('\n');
  assert.doesNotMatch(text, /NOT applied|never applied|will not be applied/);
});

test('the json document carries every field the text does, in a fixed key order', () => {
  assert.deepEqual(Object.keys(collisionJson(r)), [
    'pack', 'version', 'kind', 'source', 'format', 'manifest', 'buckets',
    'config', 'history', 'notCarried', 'refused', 'applied',
    'overwriteApproved', 'overwritten', 'loadErrors',
  ]);
});

test('overwriteApproved and overwritten are present on every path, including a dry run', () => {
  const doc = collisionJson(dryRunReport);
  assert.equal(doc.overwriteApproved, false);
  assert.deepEqual(doc.overwritten, []);
});

test('a changed entry carries differs, existingStatus, overwritable and blockedBy', () => {
  assert.deepEqual(Object.keys(collisionJson(r).buckets.changed[0]), [
    'id', 'type', 'title', 'existingHash', 'incomingHash',
    'differs', 'existingStatus', 'overwritable', 'blockedBy',
  ]);
});
```

- [x] **Step 2–4: fail, implement, pass** — 14 tests.
- [x] **Step 5: Full gate and commit**

```bash
npx tsc --noEmit && npm test
git add src/pack/collide.ts test/pack/collide.test.ts
git commit -m "feat(pack): the three-bucket collision report, text and json"
```

---

## Task 11: `imported-audit.ts` — where a stranger's history lands, and what is counted

**Files:**
- Create: `src/pack/imported-audit.ts`
- Test: `test/pack/imported-audit.test.ts`

**Interfaces:**
- Consumes: `auditDir` from `core/audit.ts`; `ensureLogDir`, `appendJsonlLine`, `parseJsonlLog` from `core/jsonl-log.ts`; `normalizeForSlug` from `core/slug.ts`; `layout.ts`.
- Produces:
  - `importedDir(root: string): string` — `<root>/.audit/imported`
  - `packDir(root: string, name: string): string` — `<root>/.audit/imported/<normalizeForSlug(name)>`
  - `unknownDir(root: string): string` — `<root>/.audit/imported/unknown`
  - `writeImportedHistory(root, name, records): void`
  - `quarantine(root, name, rows, source): number` — returns the count, which the caller must report
  - `writeImportRecord(root, record: ImportRecord): string`
  - `readImportRecords(root: string): ImportRecord[]` — what `pack list` and `review promote --all --pack` read

**Why a subdirectory is free.** The live segment enumerator lists one directory and matches two name shapes, so a subdirectory is invisible to it and a foreign record can never be read as a local one. And the imported history carries its **own** protocol string, so even a stray copy into `.audit/` is refused on every line by the live reader rather than silently merged.

**Byte layout — the quarantine wrapper.** A quarantined row is not ours to validate, so it is wrapped rather than rewritten, and nothing of the original is lost:

```json
{"protocol":"my_context/imported-unknown@1","pack":"acme-security","at":"2026-08-20T09:12:44.031Z","source":"history.jsonl","line":42,"record":{"protocol":"my_context/pack-history@1","at":"…","kind":"mutation","op":"annotate","origin":"human","itemId":"RULE-b"}}
```

**Byte layout — the accepted records.** Each is the projected record with `protocol` rewritten to the imported protocol and `pack` added, key order `protocol, pack, at, kind, op, origin, itemId, fields, note`.

**Byte layout — `import.json`**, two-space JSON with one trailing newline, every key always present:

```json
{
  "protocol": "my_context/pack-import@1",
  "pack": "acme-security",
  "version": "2026-08 rev 3",
  "kind": "pack",
  "source": "../packs/acme-security.zip",
  "importedAt": "2026-08-20T09:12:44.031Z",
  "manifestFiles": 24,
  "items": ["CONST-node-24-or-newer", "RULE-never-log-a-token"],
  "historyRecords": 41,
  "quarantined": 2
}
```

`items` is the membership list, sorted with the comparator, and it is what makes bulk promotion possible without putting a tag on an item and changing its content hash.

- [x] **Step 1: Write the failing test**

```ts
test('imported history is invisible to the live audit reader', () => {
  writeImportedHistory(root, 'acme', records);
  assert.deepEqual(auditSegments(root).filter((f) => f.includes('imported')), []);
  assert.doesNotThrow(() => readAudit(root), 'the live reader must not even see it');
});

test('a stray copy of an imported record into audit.jsonl is refused by the live reader', () => {
  appendFileSync(auditLogPath(root), `${JSON.stringify(importedRecord)}\n`);
  assert.throws(() => readAudit(root), /my_context:/);
});

test('quarantine returns the count and loses nothing from the original row', () => {
  const n = quarantine(root, 'acme', [alienRow], 'history.jsonl');
  assert.equal(n, 1);
  const [wrapped] = readQuarantine(root);
  assert.deepEqual(wrapped.record, alienRow);
  assert.equal(wrapped.line, 1);
});

test('a pack name becomes a slug, and two packs never share a directory', () => { … });
test('a pack name that slugs to nothing is refused rather than writing to an unnamed directory', () => { … });
test('the import record round-trips and its items list is sorted', () => { … });
test('the .audit gitignore covers the new subdirectories', () => {
  assert.equal(readFileSync(join(importedDir(root), '.gitignore'), 'utf8'), '*\n');
});
```

- [x] **Step 2–4: fail, implement, pass** — 7 tests.
- [x] **Step 5: Full gate and commit**

```bash
npx tsc --noEmit && npm test
git add src/pack/imported-audit.ts test/pack/imported-audit.test.ts
git commit -m "feat(pack): .audit/imported protocol, quarantine with a count, and the import record"
```

---

## Task 12: `import.ts` — the one implementation behind both surfaces

**Files:**
- Create: `src/pack/import.ts`
- Test: `test/pack/import.test.ts`

**Interfaces:**
- Consumes: everything in `src/pack/` above; `createItem` and `MutationContext` from `core/mutate.ts`.
- Produces:
  - `planImport(artefact: Artefact, against: { existing: (id: string) => Item | null; rawConfig: unknown; local: Config }): ImportPlan`
  - `applyImport(ctx: MutationContext, plan: ImportPlan, options: { name: string; source: string; now: number; overwriteApproved: boolean }): ImportOutcome`

`planImport` is **pure and writes nothing**, which is what lets `init --pack` validate a pack before it creates a directory. `applyImport` takes an already-open mutation context, so both surfaces share it without either knowing how the other got one.

**`overwriteApproved` is a parameter of `applyImport`, not of `planImport`, and that placement is the §6n.7 rule in the type system.** The plan is computed before the user is asked anything — it is what the warning is *rendered from* — so a plan cannot carry an approval, and `applyImport` cannot overwrite without one being handed to it at the call site where the human just answered. `ImportOutcome` carries `overwritten: string[]`, `overwriteSkipped: string[]` and `overwriteBlocked: string[]`, and the three lists plus `imported` account for every id in the pack.

**`planImport`, in order — and every stage that finds something stops the plan rather than half-applying it:**

1. Manifest verification (already done by the reader; carried into the plan so the report can state it).
2. `refusePackConfig` against the importing build's resolved `Config` — the trust keys under §6n.1's two branches, and the importer-describing keys. A pack **defining** a category is legal here and is not a refusal; a pack **retiering** one is.
3. The Unicode screen over every item and over the pack name and version.
4. `valid_until` present on any item → refusal naming the ids.
5. `bucketise` against the existing corpus, which is where `differs`, `overwritable` and `blockedBy` are computed — the plan carries the warning's content, so nothing downstream has to recompute what the user was shown.
6. The config merge, computed but not written.
7. The history split, counted but not written.

**The plan carries no approval and cannot.** `ImportPlan` has no field for one; the approval reaches `applyImport` as an argument, from the call site where the human answered. That is why a plan can be rendered, printed, and then applied or abandoned without either surface having to remember which question was asked.

**`applyImport`, in order:**

1. For each item in the `new` bucket, one `createItem` call with:
   - the incoming `id`, verbatim — which is what makes the bucket rule mean anything;
   - `origin: 'ingest'`;
   - `status: 'draft'`, explicitly, on **both** tiers;
   - `sourceFile`/`sourceAnchor`/`sourceChecksum` passed through only when the artefact is a full export;
   - everything else verbatim.
2. **The overwrite pass — §6n.7 — and it runs only when `options.overwriteApproved` is `true`.** For each `changed` entry with `overwritable: true`, one `updateItem` call carrying the incoming `title`, `body`, `scope`, `tags`, `severity`, `always` and `extra`, plus `status: 'draft'` and `origin: 'human'`. Both of those last two are argued in §0 item 7 and neither is discretionary: `origin: 'human'` is what makes the write legal at all on a governing normative item, and `status: 'draft'` is §6m.5 still holding. Every call writes one `update` mutation record naming the moved fields, which is where the prior content stays recoverable. Entries with `overwritable: false` are **not** attempted — they are collected into `overwriteBlocked` and reported.
3. Write the merged config.
4. Write the imported history and the quarantine, and count both.
5. Write the import record with the membership list, which includes the overwritten ids: they are pack members now, and `review promote --all --pack <name>` is how an overwritten item that used to govern starts governing again.

**Creates come before overwrites, deliberately.** A failure part-way through the overwrite pass then leaves the new items landed and the audit log showing exactly which overwrites completed, rather than a corpus whose new half is missing and whose old half was rewritten. There is no transaction here and inventing one would be a much larger change; ordering the two passes so that the partial state is the readable one is what this codebase does everywhere else.

**Nothing in `identical` needs applying** — the creator's explicit-id branch already treats identical content as a no-op duplicate, so re-running an import with nothing approved is idempotent by construction rather than by a flag.

- [x] **Step 1: Write the failing test**

```ts
// The shared fixture. `overwriteApproved` is present and FALSE here, not
// absent and defaulted: the field is required by the type so that no call
// site can overwrite by omission, and the tests that approve one say so at
// the call, where a reader can see it.
const OPTS = { name: 'acme-security', source: src, now: FIXED_NOW, overwriteApproved: false };

test('every imported item lands draft, on BOTH tiers', () => {
  // A normative `rule` and a rationale `lesson`, both arriving `status: active`.
  // The normative one would be demoted by the trust layer anyway; the rationale
  // one would NOT, which is why the importer asks for draft explicitly.
  const outcome = applyImport(ctx, plan, OPTS);
  for (const id of outcome.imported) assert.equal(ctx.store.get(id).status, 'draft');
});

test('imported items carry origin ingest — no fourth origin is invented', () => {
  assert.equal(ctx.store.get(id).origin, 'ingest');
  assert.deepEqual(ORIGINS, ['human', 'agent', 'ingest'], 'the union is still closed');
});

test('incoming ids are preserved verbatim, so the bucket rule means something on re-import', () => { … });

test('re-importing the same pack is a no-op and reports every item as identical', () => {
  applyImport(ctx, plan, OPTS);
  const second = planImport(readArtefact(src), against(ctx));
  assert.equal(second.buckets.new.length, 0);
  assert.equal(second.buckets.identical.length, plan.buckets.new.length);
});

// ── §6n.7: the overwrite, and the four things it may not do without ──

test('WITHOUT approval a changed item is byte-identical afterwards', () => {
  // Edit one imported item locally, then re-import with no approval. This is
  // the declining path §6n.7 keeps, not the withdrawn design: the difference
  // is that the user was asked.
  const before = ctx.store.get(id);
  applyImport(ctx, planImport(readArtefact(src), against(ctx)), { ...OPTS, overwriteApproved: false });
  assert.deepEqual(ctx.store.get(id), before);
});

test('WITH approval a changed item takes the pack’s content', () => {
  const outcome = applyImport(ctx, plan, { ...OPTS, overwriteApproved: true });
  assert.deepEqual(outcome.overwritten, [id]);
  assert.equal(ctx.store.get(id).body, incomingBody);
});

test('an overwritten item lands draft, so it stops governing until it is promoted', () => {
  // The local item was `active`. §6m.5 is undisturbed by §6n.7, and the
  // alternative — leaving it active — would let pack content govern with no
  // review at all, which is the outcome the draft rule exists to prevent.
  assert.equal(ctx.store.get(activeId).status, 'draft');
});

test('every overwrite writes ONE update mutation record naming the moved fields', () => {
  const records = readAudit(box.root).filter((r) => r.op === 'update' && r.itemId === id);
  assert.equal(records.length, 1);
  assert.equal(records[0].origin, 'human');
  assert.ok(records[0].fields.includes('body'));
});

test('the prior content is recoverable from the log — the §6n.7 requirement, asserted', () => {
  // Not "an audit record exists": the point of the record is that the state
  // before the overwrite can be reconstructed from history.
  assert.ok(recoverPrevious(box.root, id).body.includes(originalBody));
});

test('an item blocked on observations is never attempted, even WITH approval', () => {
  const outcome = applyImport(ctx, blockedPlan, { ...OPTS, overwriteApproved: true });
  assert.deepEqual(outcome.overwritten, []);
  assert.deepEqual(outcome.overwriteBlocked, [blockedId]);
  assert.deepEqual(ctx.store.get(blockedId), beforeBlocked);
});

test('imported, overwritten, skipped and blocked account for every id in the pack', () => {
  const o = applyImport(ctx, plan, { ...OPTS, overwriteApproved: true });
  const seen = [...o.imported, ...o.overwritten, ...o.overwriteSkipped, ...o.overwriteBlocked];
  assert.equal(new Set(seen).size, seen.length, 'no id is counted twice');
  assert.deepEqual(seen.toSorted(comparePaths), plan.allIds.toSorted(comparePaths));
});

test('a pack setting a tier on a category that EXISTS here is refused, nothing written', () => {
  assert.throws(() => planImport(retierPack, against(ctx)), /boundary/);
  assert.equal(ctx.store.all().length, 0);
});

test('a pack DEFINING a category imports, and its items land under the new type — §6n.1', () => {
  // The half §6m.4 refused. The category arrives with tier and description,
  // resolveConfig accepts it, and the items are real items of a real type.
  const outcome = applyImport(ctx, planImport(vocabPack, against(ctx)), OPTS);
  assert.ok(outcome.imported.length > 0);
  assert.equal(ctx.store.get(outcome.imported[0]).type, 'threat_model');
  assert.equal(resolveConfig(readRawConfig(box.root)).categories.threat_model.tier, 'normative');
});

test('an item carrying valid_until is refused, and the refusal names the ids', () => {
  assert.throws(() => planImport(boundedPack, against(ctx)), /valid_until/);
});

test('valid_from is re-stamped and the plan says so before anything is written', () => {
  assert.ok(plan.notCarried.some((n) => n.field === 'valid_from' && n.items === 3));
});

test('budgets and watchedDocs survive an import untouched', () => {
  const before = JSON.parse(readFileSync(configPath, 'utf8'));
  applyImport(ctx, plan, OPTS);
  const after = JSON.parse(readFileSync(configPath, 'utf8'));
  assert.deepEqual(after.budgets, before.budgets);
  assert.deepEqual(after.watchedDocs, before.watchedDocs);
});

test('an unknown audit op is quarantined and counted, and the rest of the history lands', () => {
  const outcome = applyImport(ctx, plan, OPTS);
  assert.equal(outcome.quarantined, 2);
  assert.equal(outcome.historyRecords, 39);
});

test('planImport writes nothing at all — asserted by comparing the tree before and after', () => {
  const before = snapshotTree(box.root);
  planImport(readArtefact(src), against(ctx));
  assert.deepEqual(snapshotTree(box.root), before);
});

test('the membership list in the import record is exactly what was created, overwrites included', () => { … });

test('planImport still writes nothing when the pack is full of changed items', () => {
  // The approval is asked AFTER the plan is rendered, so the plan is what the
  // user reads before deciding. If planning could write, the warning would be
  // describing a corpus it had already altered.
  const before = snapshotTree(box.root);
  planImport(readArtefact(changedPack), against(ctx));
  assert.deepEqual(snapshotTree(box.root), before);
});
```

- [x] **Step 2–4: fail, implement, pass** — 20 tests.
- [x] **Step 5: Full gate and commit**

```bash
npx tsc --noEmit && npm test
git add src/pack/import.ts test/pack/import.test.ts
git commit -m "feat(pack): one import implementation — plan purely, apply once, everything lands draft"
```

---

## Task 13: `mycontext export` — the command, and the documentation it cannot land without

**Files:**
- Create: `src/cli/commands/export.ts`
- Modify: `src/cli/commands/index.ts` (one side-effect import line)
- Modify: `src/plugin/parity.ts` (one `CLI_WITHOUT_SLASH` entry, with its reason)
- Modify: `README.md`, `docs/README.he.md`
- Test: `test/cli/export.test.ts`

**Why the README edit is in this task and not at the end.** Both documents state the CLI command total, and the documentation suite computes that total from the usage banner the program prints. Registering a command without editing both documents in the same commit leaves the suite red, which this plan's ordering rule forbids. The same is true of the command tables, which are checked for the presence of every name.

**Usage:**

```
usage: mycontext export --out <path> [--format dir|zip]
                        [--as-pack --pack-name <name> --pack-version <text>]
                        [--type <category>] [--status <status>] [--tag <tag>]
                        [--no-history] [--dry-run] [--json]
```

- `ALLOWED = ['out', 'format', 'as-pack', 'pack-name', 'pack-version', 'type', 'status', 'tag', 'no-history', 'dry-run', 'json']`
- `VALUE_FLAGS = ['out', 'format', 'pack-name', 'pack-version', 'type', 'status', 'tag']`
- Refused before the corpus is opened, per the house rule.
- `--out` is required unless `--dry-run`. `--format` defaults to `dir`. `--as-pack` requires **both** `--pack-name` and `--pack-version`, and each refusal names the flag that is missing.
- `--pack-name` and `--pack-version` are refused outside `--as-pack`: accepting a name for a thing that is not a pack is the accepted-and-ignored shape this CLI refuses everywhere else.
- No `--yes` and no confirmation gate — Design decision 9. The preview is printed on every path, and `--dry-run` prints it and writes nothing.
- Exit code follows the F2 rule: an export that did its job exits 0 even with unrelated load errors, which are still reported.

**Preview, always printed before any write:**

```
about to export 22 item(s) to ../packs/acme-security.zip as a pack
  rule 6   standard 4   constraint 5   invariant 3   known_issue 4
  history: 41 mutation record(s), filtered to mutations and joined to these items
  not travelling: injections, hook actions, focus records, the index, session state,
                  revisions, ingest sessions and staged lessons
  dropped for a pack: source_file / source_anchor / source_checksum on 7 item(s)
  excluded by --type rule: 14 item(s)
```

The "not travelling" line is not decoration. It is the disclosure half of an allow-list: a user who exports a corpus should be told what stayed behind, in the same breath as what went.

- [x] **Step 1: Write the failing test**

```ts
// test/cli/export.test.ts
test('an unknown flag is refused before the corpus is opened, and nothing is written', () => { … });
test('--as-pack without --pack-version is refused, naming the flag', () => { … });
test('--pack-version without --as-pack is refused, naming the flag', () => { … });
test('--format dir writes the canonical shape and prints the preview', () => { … });
test('--format zip writes one file whose first four bytes are the local header signature', () => { … });
test('an existing --out is refused, and the existing content is untouched', () => { … });
test('--dry-run prints the preview and creates nothing', () => { … });
test('the preview names what does NOT travel', () => {
  assert.match(output, /not travelling/);
  for (const absent of ['revisions', 'ingest', 'index', 'session state']) assert.match(output, new RegExp(absent));
});
test('--json emits one parseable document with load errors inside it', () => { … });
test('a load error elsewhere in the corpus does not turn a successful export into a failure', () => {
  // The F2 rule, restated as a test because it is the rule a new command
  // most often gets wrong.
  assert.equal(exitCode, 0);
  assert.match(output, /could not be loaded/);
});
```

- [x] **Step 2: Run it and see it fail.**

- [x] **Step 3: Implement the command** by copying the shape of the shortest existing write-command: workspace guard, unknown-flag refusal, positional check, corpus open in a `try`/`finally`, one `my_context:`-prefixed line per message, load errors on every path.

- [x] **Step 4: Register it and add the parity entry**

One import line in the commands index. The parity entry:

```ts
  export: 'Writes an artefact to a path outside the workspace, which a slash command cannot ' +
    'choose safely on the user\'s behalf: the destination is the whole decision, and a prompt ' +
    'that guessed one would be writing a stranger-readable copy of the corpus somewhere the ' +
    'user did not name.',
```

- [x] **Step 5: Update both READMEs, and let the suite tell you where**

Run `npm test` and read the failures — do not hunt by hand. The documentation suite will name every number and table that now disagrees with the program. Edit **both** documents:

- the CLI command total in the surface diagram and above the command tables;
- the "N of the M CLI commands have no slash command" ratio;
- a row in the command table, and a subsection documenting `mycontext export` in the register the README already uses.

Content requirements for the subsection, in both languages:
- what travels and what does not, as a list, because the allow-list is the feature;
- the two formats and what each is for — the directory is canonical and needs no code to read; the ZIP is for a receiver with nothing;
- the manifest sentence, with its condition attached: *the manifest lets a receiver check the files arrived intact; it says nothing about whether the author is trustworthy*;
- the history sentence, with its condition attached: *mutation records travel so an item can be dated and attributed at all, because an item file carries no created or updated field; they are testimony from the sender and cannot justify trust*;
- and the `git bundle` recipe, as the documented alternative for a receiver who has git: export as a directory, commit it, `git bundle create`.

- [x] **Step 6: Full gate and commit**

```bash
npm test && npx tsc --noEmit && npm run test:perf && npm run verify:citations && npm run check:retired
git add src/cli/commands/export.ts src/cli/commands/index.ts src/plugin/parity.ts README.md docs/README.he.md test/cli/export.test.ts
git commit -m "feat(cli): mycontext export, with --as-pack and the deterministic zip"
```

---

## Task 14: `mycontext pack import` and `pack list`

**Files:**
- Create: `src/cli/commands/pack.ts`
- Modify: `src/cli/commands/index.ts`, `src/plugin/parity.ts`, `README.md`, `docs/README.he.md`
- Test: `test/cli/pack-import.test.ts`

**Usage** — one registered command named `pack` with subcommands, imitating the existing subcommand dispatch, because the registry has no two-word command support and is keyed on the first argument:

```
usage: mycontext pack import <path> [--name <text>] [--dry-run] [--json] [--yes]
                                    [--overwrite-changed]
       mycontext pack list [--json]
```

Per-subcommand flag tables, not one union — a `--yes` on `list` is meaningless and accepting it is the silent swallow the unknown-flag check exists to stop. `--overwrite-changed` is on `import` only, for the same reason.

**The order the command runs in, and every refusal comes before the preview:**

1. Read and verify the artefact.
2. Plan the import.
3. Print the collision report — **always**, and regardless of `--yes`, because the confirmation only asks its question on a TTY and the non-interactive refusal would otherwise never say what it declined. The `changed` bucket printed here **is** the §6n.7 warning: ids, differing fields, and what each overwrite costs.
4. `confirmAction` for the import, unless `--dry-run`.
5. **The second gate, and only if the `changed` bucket holds at least one `overwritable` entry** — §6n.7's "explicit and separate". A second `confirmAction` with its own question:

   ```
   overwrite the 1 changed item(s) marked above with the pack's version? [y/N]
   ```

   Non-interactively the approval is `--overwrite-changed`. **`--yes` does not imply it**, and the implementation must not reach for `hasFlag(args, 'yes')` here: `confirmAction` returns `true` on `--yes` by design (`cli/commands/review.ts` · `  if (hasFlag(args, 'yes')) return true;` · ~867), which is exactly right for gate 4 and exactly wrong for gate 5. Gate 5 therefore does **not** use `confirmAction` as-is; it calls it with a flag name of its own, or reads `--overwrite-changed` first and prompts only when the flag is absent and stdin is a TTY. Whichever spelling the implementer picks, the test below is the contract: `--yes` alone must leave the changed items untouched.
6. Apply with `overwriteApproved` set from step 5, then print the outcome.

**Declining step 5 is not an error and does not abort step 6.** The new items still land; the changed ones are reported and skipped, which is §6n.7's own wording for what declining means.

**The outcome message, which is the whole trust story:**

```
my_context: imported 12 item(s) from pack "acme-security" as drafts. Nothing governs yet.
            Review them one at a time with `mycontext review`, or promote the whole pack
            with `mycontext review promote --all --pack acme-security`, which is one human
            act taken after the corpus is visible rather than before.
            overwrote 1 item you had changed; it is a draft now too, and the previous
            version is in the audit log — `mycontext audit --item STD-commit-messages`.
            2 changed item(s) were left exactly as they are.
```

The last three lines print only when there was a `changed` bucket, and each prints only when its own count is non-zero — with one exception: the "left exactly as they are" line prints whenever anything was skipped, **including when everything was**, because that is the case a user most needs told.

- [x] **Step 1: Write the failing test**

```ts
test('an unknown subcommand is refused with the usage block', () => { … });
test('a flag legal on import is refused on list — including --overwrite-changed', () => { … });
test('the collision report prints before the confirmation, and on the non-interactive path too', () => { … });
test('declining the FIRST confirmation writes nothing at all', () => {
  assert.equal(ctx.store.all().length, 0);
  assert.equal(existsSync(importedDir(root)), false);
});
test('--dry-run prints the report and writes nothing, and the json says applied: false', () => { … });
test('a successful import lands every item draft and points at the bulk promote', () => {
  assert.match(output, /review promote --all --pack acme-security/);
});

// ── §6n.7: the second gate ──

test('the overwrite prompt is asked only after the import prompt, and only when changed is non-empty', () => {
  // Two packs, one with a changed bucket and one without: the second must
  // ask exactly one question. A prompt that appears when there is nothing to
  // approve trains the reflex the gate depends on.
  assert.equal(promptsFor(packWithNoChanges).length, 1);
  assert.deepEqual(promptsFor(packWithChanges).map(order), ['import', 'overwrite']);
});

test('--yes alone imports the new items and leaves every changed item untouched', () => {
  // §6n.7: approval is explicit and SEPARATE from choosing the pack, and
  // --yes is consent to the import the user described, not to replacing a
  // rule they wrote. This is the assertion the flag design exists to make.
  runCli(['pack', 'import', src, '--yes'], cwd, out);
  assert.deepEqual(ctx.store.get(changedId), beforeChanged);
  assert.match(output, /left exactly as they are/);
  assert.equal(JSON.parse(jsonOut).overwriteApproved, false);
});

test('--yes --overwrite-changed replaces the changed items and says which', () => {
  runCli(['pack', 'import', src, '--yes', '--overwrite-changed'], cwd, out);
  assert.equal(ctx.store.get(changedId).body, incomingBody);
  assert.match(output, new RegExp(`overwrote 1 item`));
  assert.match(output, new RegExp(`mycontext audit --item ${changedId}`));
});

test('declining ONLY the overwrite still imports the new items', () => {
  // §6n.7: declining leaves the changed items reported and skipped. It does
  // not abandon the import the user already confirmed.
  assert.ok(outcome.imported.length > 0);
  assert.equal(outcome.overwritten.length, 0);
});

test('the printed warning names every id it would overwrite, and no bare count stands alone', () => {
  for (const id of changedIds) assert.ok(output.includes(id), id);
  assert.doesNotMatch(output, /items will be replaced\.?$/m);
});

test('--overwrite-changed on a pack with no changed items is accepted and does nothing', () => {
  // Refusing it would make the flag unusable in a script that imports the
  // same pack repeatedly — the case §6d's "updating means importing again"
  // is entirely about.
  assert.equal(runCli(['pack', 'import', src, '--yes', '--overwrite-changed'], cwd, out), 0);
  assert.deepEqual(JSON.parse(jsonOut).overwritten, []);
});

test('importing a pack that RETIERS an existing category refuses and says why, nothing written', () => { … });
test('importing a pack that DEFINES a category succeeds, and pack list shows it', () => { … });
test('pack list names every pack imported here, with its version and item count', () => { … });
test('two imports of packs with the same name are kept apart, and list shows both', () => { … });
test('--json is one parseable document with load errors inside it', () => { … });
```

- [x] **Step 2–3: fail, implement.**
- [x] **Step 4: Register, add the parity entry, update both READMEs** — the same numbers, the same tables, the same procedure as Task 13. The parity entry for `pack` records that a slash command is deliberate future work rather than an absence: importing a stranger's corpus is a human act with a confirmation, and a slash command that ran it would be an agent taking that act.
- [x] **Step 5: Full gate and commit**

```bash
npm test && npx tsc --noEmit && npm run verify:citations && npm run check:retired
git add src/cli/commands/pack.ts src/cli/commands/index.ts src/plugin/parity.ts README.md docs/README.he.md test/cli/pack-import.test.ts
git commit -m "feat(cli): mycontext pack import and pack list"
```

---

## Task 15: `mycontext init --pack <path>`

**Files:**
- Modify: `src/cli/index.ts` — `cmdInit`, `INIT_USAGE`, `INIT_ARGUMENT_HINTS`
- Modify: `README.md`, `docs/README.he.md`
- Test: `test/cli/init-pack.test.ts`

**The two structural constraints, both from the code:**

1. **`init` is dispatched before the workspace is resolved and receives no workspace at all**, structurally — it is the one bare command, and it is bare because it must be able to create a workspace inside a directory whose *ancestor* workspace has a corrupt config. So `--pack` handling cannot reach for a resolved config. It builds its own by resolving the workspace itself, **after** the directory exists.
2. **`init` refuses every argument today.** `--pack` has to be accepted in that refusal first, and the refusal has to keep refusing everything else — including `--global`, whose hint is the reason the hint table exists.

**The order, and it is the order the code forces:**

1. Parse and refuse. `--pack` is the only accepted flag; `--pack` without a value is refused; a positional is still refused.
2. **Read and plan the pack, before anything is created.** `planImport` is pure, so a bad pack refuses with no `.my_context/` left behind — which matters because this command's success line says "initialized", and this codebase does not print that for a half-built workspace.
3. Create `items/`.
4. Write `config.json` as `mergePackConfig` over the shape `init` writes today. The pack's contribution is a merge, not a replacement, so the default `profile` and `budgets` survive — and there is nothing of the pack's to overwrite later, because a pack may not carry `watchedDocs` at all. **A sibling plan will add a `watchedDocs` write to `init` after this step; the seam is here and the order is: pack config first, then `watchedDocs`.**
5. Write `.gitignore`.
6. Resolve the workspace, open a mutation context, `applyImport`.
7. Print the shadowing warning if any, then the collision report, then the initialized line and the pointer at the bulk promote.
8. On any failure after step 3, remove the whole created tree with the retry shape this codebase uses for Windows handles (`{ recursive: true, force: true, maxRetries: 20, retryDelay: 25 }`) and print the failure alone.

**No confirmation on this path, and the reason is recorded so it is not read as an inconsistency:** the user named the pack on the command line of a command that creates a corpus, so there is nothing yet to protect and no state to lose. The gate that matters is the one every item still passes: everything lands `draft`.

**And no §6n.7 second gate either, for a stronger reason than convenience: on this path the `changed` bucket is empty by construction.** `init --pack` plans against a corpus that does not exist yet, so `bucketise`'s lookup returns `null` for every id and every item falls into `new` — `core/store.ts` · `  get(id: string): Item \| null {` · ~504. There is nothing to overwrite, so there is nothing to approve. `applyImport` is still called with `overwriteApproved: false`, **explicitly and not by default**, so that the one call site which could ever pass `true` is the one where a human answered a question. `init` accepts no `--overwrite-changed`; it stays in the refusal with every other argument, and its hint says the flag belongs to `mycontext pack import`.

- [x] **Step 1: Write the failing test**

```ts
test('init still refuses every argument except --pack, and --global still gets its hint', () => { … });
test('--pack with no value is refused, and nothing is created', () => { … });
test('a bad pack refuses and leaves NO .my_context behind', () => {
  assert.equal(runCli(['init', '--pack', retierPack], cwd, out), 1);
  assert.equal(existsSync(join(cwd, '.my_context')), false);
  assert.equal(output.includes('initialized'), false);
});
test('--overwrite-changed is refused on init, with a hint naming pack import', () => {
  // It cannot mean anything here — a corpus that does not exist has nothing
  // to overwrite — and accepting a flag that does nothing is the silent
  // swallow every other refusal in this file exists to stop.
  assert.equal(runCli(['init', '--pack', goodPack, '--overwrite-changed'], cwd, out), 1);
  assert.match(output, /mycontext pack import/);
});
test('a pack that DEFINES a category founds a corpus that can resolve its own config', () => {
  // §6n.1's whole point, at the surface where it matters most: init --pack is
  // the path with no existing vocabulary to fall back on.
  runCli(['init', '--pack', vocabPack], cwd, out);
  assert.doesNotThrow(() => resolveConfig(readRawConfig(join(cwd, '.my_context'))));
  assert.equal(itemsOf(cwd).every((i) => i.status === 'draft'), true);
});
test('a good pack founds a corpus whose every item is a draft', () => { … });
test('the config is the init default MERGED with the pack, so budgets survive', () => {
  const raw = JSON.parse(readFileSync(configPath, 'utf8'));
  assert.equal(raw.profile, 'standard');
  assert.ok(Object.hasOwn(raw, 'budgets'));
  assert.equal(raw.categories.rule.enabled, true);
});
test('the same pack through init --pack and through pack import produces the same corpus', () => {
  // The "one implementation behind both surfaces" claim, asserted rather than
  // stated: two workspaces, two commands, one deepEqual over the parsed items.
  assert.deepEqual(itemsOf(fromInit), itemsOf(fromImport));
});
test('an ancestor-workspace shadowing warning still prints, before the pack report', () => { … });
```

- [x] **Step 2–3: fail, implement.**
- [x] **Step 4: Update both READMEs** — `init`'s documented usage gains the flag in both languages. No count changes here: `init` is already registered.
- [x] **Step 5: Full gate and commit**

```bash
npm test && npx tsc --noEmit && npm run verify:citations && npm run check:retired
git add src/cli/index.ts README.md docs/README.he.md test/cli/init-pack.test.ts
git commit -m "feat(cli): mycontext init --pack, one implementation shared with pack import"
```

---

## Task 16: `review promote --all --pack <name>` — what makes the draft gate bearable

**Files:**
- Modify: `src/cli/commands/review.ts` — the promote flag table, the usage block, the promote branch
- Modify: `README.md`, `docs/README.he.md`
- Test: `test/cli/review-promote-all.test.ts`

**This is the other half of "everything lands draft".** A 40-item pack produces a 40-item review queue on an empty project, and a queue that size is bulk-approved unread — which is a worse outcome than no gate, not a better one. What that argument supports is making bulk review tractable, not skipping the gate. So the bulk act exists, it is one human confirmation, and it is taken **after** the corpus is visible rather than before.

**The rules, each of which is a refusal:**

- `--all` **requires** `--pack`. There is no unbounded bulk promote: the licence granted is for the corpus a human just chose to import, not for every draft in the workspace.
- `--pack <name>` must name a pack in the import records; an unknown name is refused and the message points at `mycontext pack list`.
- `--scope`, `--severity` and `--always` are refused with `--all`. They are per-item decisions and applying one of them to forty items is a bulk edit wearing a promotion's clothes.
- An id positional is refused with `--all`.
- Each item is promoted by the same single call the one-item path uses, with `origin: 'human'` — which is the only thing that evidences a human did it, and the only thing that makes the status change legal.

**Everything skipped is named**, because a bulk operation that reports only its successes is the exact shape of a silent drop. Four skip reasons, each counted and listed: not `draft` any more, not in the project layer, category not enabled, and no longer present.

**An overwritten item is a pack member and promotes with the rest.** §6n.7's overwrite lands the item `draft`, and Task 12 puts its id in the membership list, so an item the user approved being replaced comes back through this one act rather than needing a second, different route. Nothing here special-cases it: it is a draft in the record, which is all this command has ever asked for.

**The preview, printed before the gate and regardless of `--yes`:**

```
about to promote 12 draft(s) imported from pack "acme-security" — every one becomes active
and starts governing this project.
  rule 6   standard 4   constraint 2
skipping 3 of the 15 item(s) this pack imported:
  RULE-x        already active
  STD-y         category "standard" is not enabled here, so it would never be injected
  CONST-z       no longer present
```

- [x] **Step 1: Write the failing test**

```ts
test('--all without --pack is refused', () => { … });
test('--pack naming no imported pack is refused and points at pack list', () => { … });
test('--scope, --severity, --always and an id positional are each refused with --all', () => { … });
test('the preview prints before the gate, on the non-interactive path too', () => { … });
test('declining leaves every item a draft', () => { … });
test('confirming promotes exactly the pack’s drafts and nothing else in the queue', () => {
  // A locally authored draft in the same workspace must be untouched — the
  // licence is for the pack, not for the queue.
});
test('every skipped item is named with its reason, and the counts sum', () => {
  assert.equal(promoted + skipped, membership.length);
});
test('each promotion writes an audit record with origin human', () => { … });
test('the review queue definition is not widened — reviewQueue still means one thing', () => {
  // Asserted by calling reviewQueue directly before and after and comparing
  // it with the command's own view.
});
```

- [x] **Step 2–3: fail, implement.** Add `'all'` and `'pack'` to the promote row of the per-subcommand flag table, `'pack'` to the value flags, and the two new lines to the usage block — there is a test in the existing suite that holds the usage block and the subcommand list equal, and it will catch a half-update.
- [x] **Step 4: Update both READMEs** — the review section gains the bulk form in both languages, with the sentence that makes it honest: *this is one human act on a corpus you can see, not a way around the gate.*
- [x] **Step 5: Full gate and commit**

```bash
npm test && npx tsc --noEmit && npm run verify:citations && npm run check:retired
git add src/cli/commands/review.ts README.md docs/README.he.md test/cli/review-promote-all.test.ts
git commit -m "feat(cli): review promote --all --pack, behind one confirmation"
```

---

## Task 17: Discovery, and the audit-travel prose in both documents

**Files:**
- Create: `docs/TEMPLATES.md`
- Modify: `README.md`, `docs/README.he.md`
- Test: `test/docs/parity.test.ts` (existing) plus one new assertion in `test/pack/manifest.test.ts`'s spirit

**`docs/TEMPLATES.md` — the whole of discovery.** A curated list, in this repository, with a link and an author per entry. **There is no registry, no re-fetch, no update channel and no version check over the network**, and the document says so in its own first paragraph rather than leaving it to be inferred. Updating a pack means importing it again: the collision report shows what changed in three buckets, new items land as drafts, and an item you have edited is replaced only if you say so at a second prompt — §6n.7. Nothing applies unconfirmed, and nothing is replaced unnamed.

The document states, once, why a registry was rejected: centralisation did not prevent the thing a registry is supposed to prevent — the May 2026 supply-chain compromise shipped 639 malicious versions that **passed** provenance verification with forged attestations. And it states what the manifest does and does not do, in the same sentence, so a reader arriving from a pack link cannot come away thinking a verified manifest is a vetted author.

It ships with **no entries and an explanation of why it is empty**, which is honest: there are no published packs yet, and a document seeded with examples of packs that do not exist is a document that lies on the day it ships.

**The README change is an edit, not a write.** Both documents already carry a forward-looking callout saying the travel decision was taken and not built. Flip each one:

- the warning above it — "it is gitignored, so in this release it describes this machine only" — **stays**, because it is still true of the live log;
- the note below it changes from *decided and not built* to *shipped*, naming the command, the filter, `.audit/imported/`, the quarantine and its count;
- the sentence that says nothing in the log travels today is deleted in both languages;
- and the "history cannot justify trust" clause **stays word for word**, because it is the part that was always true and is the part a reader most needs.

Two source comments also carry the old promise and are updated in the same commit: the audit module's own header, and the log-directory helper's docstring.

- [ ] **Step 1: Establish the insertion points by executing**

Run `git grep -n "Decided for v2.0 and not built" README.md` and `git grep -n "ולא נבנה" docs/README.he.md`, and edit at those lines. Run `git grep -rn "never travels\|local to the machine" src/` for the two source comments.

- [ ] **Step 2: Write the new document and the two README edits.**

- [ ] **Step 3: Run the documentation suite and see it green**

Run: `npm test` — the structure-parity test holds the two documents equal, so editing one and not the other fails here first.

- [ ] **Step 4: Full gate and commit**

```bash
npm test && npx tsc --noEmit && npm run test:perf && npm run verify:citations && npm run check:retired
git add docs/TEMPLATES.md README.md docs/README.he.md src/core/audit.ts src/core/jsonl-log.ts
git commit -m "docs: pack discovery is a curated list; the audit log's travelling half has shipped"
```

---

## What this plan is NOT doing, and why

Named rather than left to be discovered mid-implementation.

1. **The `git bundle` rung — dropped from v2.0 by §6n.6, not deferred by this plan's preference.** The plain directory is canonical and a receiver with git bundles it in one line; the rung would be the first subprocess in shipped code, and `git subtree split` writes a commit and a ref into the exporter's own repository. **The ladder stays a `--format` flag over a shared bundle precisely so the rung costs one writer if it is ever wanted** — that reversibility is the reason the drop was safe, and it is a property a later implementer must preserve. §0 item 3.

2. **Overwriting an item whose difference is an `observations` or `relations` entry.** §6n.7 is implemented in full for every field `UpdateInput` can carry; those two fields are settable only at creation, so an item differing only there is named as **not overwritable here** and skipped whether or not the overwrite is approved (§0 item 7 carries the citations). Widening `UpdateInput` is a change to `core/mutate.ts`, which two sibling plans also touch, and doing it here would be this plan editing a core write path on the way past. It is a real gap, it is disclosed in the report's own text, and it is one field pair wide.

3. **A per-item overwrite choice.** §6n.7 requires one explicit, separate approval; this plan asks exactly one, covering the whole `changed` bucket, whose every member is named first. Asking per item would be a better surface for a large bucket and is not what was decided; a `--only <id>` selector is a feature, not a flag, and nothing here forecloses it.

4. **A whole-workspace `mycontext import`.** Only the two pack surfaces are in scope, so the replace-not-merge rule that §6 wrote for a whole-workspace import has no implementation here (§0 item 5). A directory export is imported with `cp -r`, which is the point of the canonical format.

5. **The audit segment format version.** §6n.5 decided it and the categories-and-runbooks plan owns it (§0 item 8). This plan depends on it, does not duplicate it, and is unaffected in either landing order — Task 4 states the three reasons and what to re-check when it lands.

6. **Signatures.** Optional and must never gate import; offering `ssh-keygen -Y sign` is a documentation change and a verification path, and both would sit beside a manifest that already must not be read as trust. Deferred rather than half-built, because a signature UI that appears next to a green "verified" line is precisely the confusion this plan spends a whole test preventing.

7. **A `doctor` check on the size of `.audit/imported/`.** The existing size report counts only what the segment enumerator returns, so imported history is outside it. That is a real disclosure gap, and it is small: imported history is bounded by the packs a user imported, not by their session count. Named here so it is a decision rather than an oversight.

8. **A slash command for `export` or `pack`.** Both get a `CLI_WITHOUT_SLASH` entry with its reason, which the parity test enforces in both directions. Importing a stranger's corpus is a human act behind a confirmation; a slash command that ran it would be an agent taking that act.

9. **Compressing the ZIP.** Design decision 10 — the writer stores, so determinism is unconditional. The reader accepts deflate, so a user who zips the directory themselves is not turned away.

10. **`sourceFile` rewriting on import.** A full export keeps provenance and a pack drops it; nothing tries to re-point a stranger's document path at a local file, because there is no correct answer and a wrong one produces a `doctor` finding that looks resolved.

---

## Self-Review

Performed against the spec with fresh eyes after writing.

**1. Decision coverage.**

| Decision | Where |
|---|---|
| §5 format ladder — directory canonical, ZIP otherwise | Tasks 6, 7; **§6n.6 drops the middle rung**, §0 item 3 |
| §5 travels: `items/**`, `config.json`, audit filtered to mutations | Tasks 4, 5 |
| §5 does not travel: index, seen files, focus, `.revisions/`, `.ingest/`, `.staging/` | Task 1 (the path allow-list), Task 5 (the walk that has nothing to widen) |
| §5 redaction of `discard` notes, joined to the item selection | Task 4 |
| §5 manifest is full SHA-256, per file, sorted | Task 3 |
| §5 / §6m.10 unknown ops quarantined and **counted**; local strictness stands | Tasks 4, 11, 12 |
| §6 selection by status, category, tag | Task 5 |
| §6 re-grading on arrival; no `--promote-all` on the import | Task 12, Task 14 |
| **§6n.1** a pack may declare `tier` for a name that does not exist here, never for one that does; `agentEdits` refused everywhere | Task 2, both branches; Tasks 12 and 15 assert it end to end |
| **§6n.5** the audit segment format version | **Not built here.** Owned by the categories-and-runbooks plan; Task 4 states the dependency and the three reasons this plan is unaffected |
| **§6n.6** the `git bundle` rung is dropped from v2.0, and the `--format` ladder keeps it one writer away | §0 item 3; "What this plan is not doing" item 1 |
| **§6n.7** a changed item is overwritten after a warning that names it and a separate approval | §0 item 7 maps all four requirements; Design decision 6; Byte layouts §4; Tasks 10, 12, 14, 15 |
| **§6o** three new categories, `runbook` unchanged | The scope split only — checked, and nothing else here names either category |
| §6 three-bucket collision report | Task 10 |
| §6 mandatory Unicode screen | Task 8 |
| §6c descriptive version, checksum with a timestamp | Task 3 |
| §6d discovery is a curated document; no registry, no re-fetch, no network | Task 17 |
| §6h contents: items + enabled categories + `prefix`/`scopePolicy`, plus `tier`/`description` for a category the receiver lacks (§6n.1); never `budgets`/`watchedDocs` | Task 2 |
| §6m.4 config merges field-wise, `budgets`/`watchedDocs` untouched — its `tier` half **superseded by §6n.1** | Task 2 |
| §6m.5 everything lands `draft`; bulk promote behind one confirmation | Tasks 12, 16 |
| §6h one implementation behind `--as-pack`, `pack import` and `init --pack` | Task 5 (the bundle), Task 12 (the import), asserted by Task 15's cross-surface `deepEqual` |
| §6h manifest never gates activation and is never described as trust | Task 3's last test; Tasks 13, 17's prose requirements |
| §6m/F10 `init --pack` applies config **first**, then `watchedDocs` | Task 15, step 4, with the seam named |

**2. Placeholder scan.** The plan contains three deliberate **establish-by-executing** points, each with the procedure and the artefact it must produce: Task 7 step 3 (the high-bit CRC fixture, executed rather than guessed), Task 13 step 5 and Task 17 step 1 (the documentation insertion points and the numbers, read from the failing suite rather than hunted by hand). These are not TBDs. There is no "add error handling", no "similar to Task N", and no test named without the assertion it makes.

**3. Type consistency.** `ExportFile` and `ArtefactKind` are defined once, in Task 1, and consumed by Tasks 3, 5, 6, 7 and 9. `Manifest` is defined in Task 3 and consumed by 5, 9 and 12. `Bundle` is defined in Task 5 and consumed by 6, 7 and 13. `Buckets` is defined in Task 10 and consumed by 12 and 14. `comparePaths` has exactly one definition and four callers. `PackHistoryRecord`'s key order is stated once as a byte layout and asserted in Task 4.

**4. Ordering.** Tasks 1–4 are independent of each other. 5 needs 1–4. 6 and 7 need 1 and 5. 8 is independent. 9 needs 1, 3, 4, 7. 10 needs 1. 11 needs 1. 12 needs 2, 8, 9, 10, 11. 13 needs 5, 6, 7. 14 and 15 need 12. 16 needs 11 (the membership record). 17 needs 13 and 14 to have landed their counts. Every task ends with a full gate and a commit, and the two that register a CLI command carry their README edits so the suite is never red between commits.

**Cross-plan ordering — one edge, in one direction.** §6n.5's audit segment version belongs to the categories-and-runbooks plan. This plan has **no ordering constraint against it**: it lands before or after with no change here, for the three reasons Task 4 states. That is asserted rather than assumed, and it is the only place the two plans touch the same file — `core/audit.ts`, which this plan only ever *reads*.

**Known deviations from the spec, named rather than silent:**
- The `git bundle` rung is not built. This is no longer a deviation from a decision — §6n.6 **is** the decision — but it remains a deviation from §5's three-rung table, and is recorded as one so nobody re-reads §5 and files a gap (§0 item 3).
- The ZIP stores rather than deflates (Design decision 10), which makes the determinism claim unconditional at the cost of size.
- An item whose only difference is an `observations` or `relations` entry is **not** overwritten, because `UpdateInput` has no route to those two fields. §6n.7 admits no exception; this one is disclosed in the report's own text and in "What this plan is not doing" item 2 rather than being absorbed silently, and closing it is a change to `core/mutate.ts` that this plan does not own (§0 item 7).
- Two things §6n.7 does not state are decided in §0 item 7 with their reasons — the overwrite's `origin` and the overwritten item's `status` — because an implementer cannot write the call without both.

---

## Produces summary — the interface later work consumes

```ts
// src/pack/layout.ts
const PACK_PROTOCOL = 'my_context/pack@1';
const PACK_HISTORY_PROTOCOL = 'my_context/pack-history@1';
const IMPORTED_PROTOCOL = 'my_context/imported@1';
const IMPORTED_UNKNOWN_PROTOCOL = 'my_context/imported-unknown@1';
const IMPORT_RECORD_PROTOCOL = 'my_context/pack-import@1';
type ExportFile = { path: string; bytes: Buffer };
type ArtefactKind = 'export' | 'pack';
function comparePaths(a: string, b: string): number;          // UTF-8 byte order, the ONE comparator
function refuseArtefactPath(p: string): string | null;        // the allow-list, on the path

// src/pack/manifest.ts
function buildManifest(files: ExportFile[], meta: { kind; name; version; now }): Manifest;
function renderManifest(m: Manifest): Buffer;                 // 2-space JSON + one \n
function parseManifest(bytes: Buffer): Manifest;
function verifyManifest(m: Manifest, present: ExportFile[]): { missing; extra; mismatched };

// src/pack/config-io.ts
function projectExportConfig(config: Config): RawConfigJson;
function projectPackConfig(config: Config, typesInPack: string[]): RawConfigJson;
function refusePackConfig(raw: unknown, local: Config): string[];   // §6n.1's two branches
function mergePackConfig(existingRaw: unknown, packRaw: unknown): RawConfigJson;

// src/pack/history.ts
function exportableHistory(root: string, itemIds: Set<string>): PackHistoryRecord[];
function compareHistory(a: PackHistoryRecord, b: PackHistoryRecord): number;
function parseHistory(bytes: Buffer, file: string): { records: PackHistoryRecord[]; unknown: JsonlRow[] };

// src/pack/bundle.ts
function buildBundle(root: string, config: Config, options: BundleOptions): Bundle;

// src/pack/dir-writer.ts   /  src/pack/zip.ts   /  src/pack/reader.ts
function writeBundleDirectory(bundle: Bundle, outDir: string): string[];
function writeZip(files: ExportFile[]): Buffer;   function readZip(bytes: Buffer): ExportFile[];
function sniffFormat(path: string): 'dir' | 'zip';   function readArtefact(path: string): Artefact;

// src/pack/screen.ts  /  src/pack/collide.ts  /  src/pack/imported-audit.ts  /  src/pack/import.ts
function screenItem(item: Item): ScreenFinding[];
function bucketise(incoming: Item[], existing: (id: string) => Item | null): Buckets;
function diffFields(a: Item, b: Item): string[];              // the §6n.7 warning's own content
function readImportRecords(root: string): ImportRecord[];     // what `pack list` and `promote --all` read
function planImport(artefact: Artefact, against: {…}): ImportPlan;   // PURE — writes nothing,
                                                                    // and carries NO approval
function applyImport(ctx: MutationContext, plan: ImportPlan,
                     options: { name; source; now; overwriteApproved: boolean }): ImportOutcome;

// CLI
mycontext export --out <path> [--format dir|zip] [--as-pack --pack-name <n> --pack-version <v>]
                 [--type <c>] [--status <s>] [--tag <t>] [--no-history] [--dry-run] [--json]
mycontext pack import <path> [--name <text>] [--dry-run] [--json] [--yes]
                             [--overwrite-changed]   // §6n.7 — --yes does NOT imply it
mycontext pack list [--json]
mycontext init --pack <path>
mycontext review promote --all --pack <name> [--yes]
```

Execution: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`, task by task, in the order above.
