# v2.0 Plan — the `todo`, `note` and `procedure` categories, and the one-shot `procedure` lifecycle

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the two inbox categories `todo` and `note` on the rationale tier with their own
listing and promotion surfaces, and ship the **new** normative category `procedure` — the one-shot
sibling of the already-shipped, repeatable `runbook` — with a one-shot lifecycle: a first-class
`## Steps` field, an activation that is two deliberate human writes, a completion that retires it,
and step progress recorded outside `items/` so the corpus never moves when somebody makes progress.
**`runbook` itself is not changed by this plan**: it keeps its shipped description, its shipped
seed, and its absence of any lifecycle (§6o).

**Architecture:** Three separable pieces, in this order. (1) Three `def()` entries in
`src/core/categories.ts` plus the 22 hand-typed sites a category name has to reach — closed in one
atomic commit because they are pinned to each other by set-equality tests, and guarded afterwards by
one new meta-test. (2) `Item.steps` as a first-class field: a `## Steps` section that `parseItem`
reads, `renderItem` writes, `computeItemChecksum` and `itemContentHash` hash, and `renderItemBlock`
emits — the last of which makes `itemCost` correct for free. (3) The lifecycle itself, expressed
entirely in shipped `Status` values plus the `always` flag, with progress living in a new `progress`
kind of audit record and nowhere else. Plus one guard the vocabulary now needs: a test that the
`runbook`/`procedure` boundary is stated everywhere an author is choosing between them.

**Tech Stack:** Node ≥ 24 built-ins only. No framework, no build step, no runtime dependency.

**Spec:** `docs/superpowers/specs/2026-08-19-v2-scope-decisions.md` — the binding authority. The
reading order is **§6o first, then §6n, then §6m, then the earlier sections**: §6m supersedes §2,
§6f, §6g and §6h where they conflict; §6n supersedes §6m where they conflict; and **§6o reverses
§6m.1 outright** — both `runbook` and `procedure` exist, and everything §6m and §6n decided about
the one-shot lifecycle attaches to `procedure`. Executors read §1, §2 (with §2.1–§2.3), §6a, §6g,
§6i, §6m, §6n.3/§6n.4/§6n.5 and §6o.

**Survey:** `.superpowers/sdd/2026-08-19-v2-scope-decisions/survey-categories.md` — the file-level
map this plan is built on, and the source of most citations below. It was written against a draft
spec that added a third category, which §6m.1 withdrew and §6o reinstated, so it is correct about
the code and has been wrong about the vocabulary in both directions; §0 records every place it and
this plan part.

**Scope split (binding):** This plan covers §1 (both inbox categories, the promotion path, the
`todo` listing surface), §2 with §2.1–§2.3 (the `procedure` lifecycle), §6a's `## Steps` ruling,
§6g's step progress, §6i.1/§6i.2/§6i.4/§6i.5, §6m.2/§6m.3/§6m.9/§6m.12, §6n.3/§6n.4/§6n.5, and
§6o in full — the third category and the boundary documentation its risk demands. Everything else in
that spec — export, packs, imports, sessions, hooks, `watchedDocs`, the rule-file exporter,
cross-session continuity — is out of scope and belongs to sibling plans. **"What this plan is not
doing" below names the parts of even the in-scope sections that are deliberately left unbuilt.**

---

## Global Constraints

- **Zero runtime dependencies, no build step.** Node 24 native TypeScript type-stripping, source
  executed as shipped. `CONST-zero-runtime-dependencies`, `CONST-node-24-no-build-step`.
- **Erasable syntax only.** No `enum`, no `namespace`, no constructor parameter properties. A
  category list and a status vocabulary are exactly where `enum` is tempting; the shipped answer is
  string-literal union types and plain objects. `RULE-erasable-syntax-only`, enforced by
  `tsconfig.json` · `"erasableSyntaxOnly": true,`.
- **Every relative import carries an explicit `.ts` extension.**
- **`INV-markdown-is-the-source-of-truth`.** `files → DB → files` must be byte-identical and every
  `Item` field must survive parse → render → parse unchanged. The SQLite index is a **disposable
  projection**: "delete the index, it rebuilds" is the documented recovery, and that promise is only
  real while the round trip is lossless. This is the hardest constraint on Task 5.
- **`INV-nothing-is-dropped-silently`.** A field accepted and ignored, a step line parsed and then
  destroyed on the next `persist()`, a `ready` procedure that reaches no index line and no count — all
  three are the same defect. Every exclusion this plan creates is surfaced somewhere a person reads.
- **The trust boundary is the category's tier, and nothing else.** `trustedStatus` demotes every
  non-human origin on a normative category unconditionally. `todo` and `note` are rationale, so an
  agent writes them directly; `procedure` is normative, so an agent-authored one lands as a draft.
  **No branch, flag or exception is added to `trustedStatus` anywhere in this plan.**
- **`runbook` is not touched.** §6o: it ships today as the **repeatable** ordered-step category and
  keeps its `CategoryDef` description verbatim, its `RUN` prefix, its normative tier and its absence
  of a lifecycle, states, `## Steps` field or commands. The only `runbook` edits in this plan are the
  ones §6o's own mitigation requires: the boundary sentence, in the four places an author is choosing
  (Task 10). Anything else touching `runbook` is out of scope and is a defect.
- **Nothing is added to the `Status` union**, and its three copies therefore stay in agreement
  because none of them moves.
- **`UPDATE_FIELD_POLICY` is untouched.** `FieldPolicy` stays `'content' | 'gated'` and the four
  `Assert<>` types keep their compile-time guarantee. Nothing here adds a field to `UpdateInput`.
- **Never write a comment, message, doc or corpus item asserting a property the code does not
  have.** This project has 30+ recorded instances, several introduced by tasks fixing others.
- **Guarantee claims carry their condition in the same sentence**
  (`STD-guarantee-claims-carry-their-condition-in-the-same-sentence`).
- **Every change needs a test that fails without it.** `npm run mutate` refuses a dirty tree —
  commit first.
- `npm test`, `npx tsc --noEmit`, `npm run test:perf`, `npm run verify:citations`,
  `npm run check:retired`, `npm run check:test-glob` clean; `git status --porcelain` clean.
- **Both documents, always** for any README change: `README.md` and `docs/README.he.md`.

---

## 0. Corrections — where the survey and the spec part, and where either parts from the code

<!-- retired-phrases
mycontext runbook
runbookProgress
items/runbook/
two new categories
twenty-three
becomes one-shot
-->

**These corrections are enforced, not merely recorded.** The block above lists the phrases this plan
retired; `npm run check:retired` fails if any of them reappears anywhere below §0. This plan has now
been written against **two opposite rulings** on the same question — §6m.1 withdrew the third
category, §6o reinstated it — so the leak this checker guards runs in both directions: a survey row
copied verbatim, and a sentence left standing from the version of this plan that made `runbook` the
one-shot thing.

Every row names the **class** of error, not only the instance.

| Was | Is | Class | Where it lands |
|---|---|---|---|
| **This plan's own first version**, written against §6m.1: no `procedure` category is created, `runbook` absorbs the one-shot lifecycle, and its description, seed, both topic sources and both READMEs are rewritten to say it is performed once (the withdrawn Task 10) | **§6o reverses §6m.1. Both categories exist.** `runbook` ships **unchanged** — normative, prefix `RUN`, *"The steps for a named operation, in the order they must be taken"* (`categories.ts` · `runbook:       def('runbook', 'RUN', 'normative', true,` · ~40) — and is the **repeatable** one. `procedure` is **new**: normative, prefix `PROC`, performed once and then done, and it carries the lifecycle, the steps and the injected-only-while-active rule. Everything §6m and §6n decided about the lifecycle now attaches to `procedure` | **A plan is written against a decision, not against a document, and a reversed decision invalidates the plan's conclusions even where every citation still resolves.** §6o's own reasoning is the general form: §6m.1 read *"runbook (or to call it with different name)"* as naming an existing category when it was proposing a new one. When a ruling turns on what somebody meant, re-read the words before building 2,600 lines on the reading | Everywhere. Tasks 2 and 10 structurally; every task by rename |
| Survey §7.3 row 12: add `24: { en: 'twenty-four', … }` to `CATEGORY_WORDS` | **Correct after all, and the double reversal is why.** The catalogue goes 21 → **24**, and `counts.test.ts` · `const CATEGORY_WORDS: Record<number, { en: string; he: string }> = {` · ~282 stopped at 23 when this row was written — **Task 2 step 7 has executed and it spells 24 now** | A correction written against a ruling that is later reversed is wrong twice, and the second time it is invisible because it reads as settled. Re-derive every count from the current decision — never from the survey, and never from this plan's own earlier arithmetic | Task 2 |
| Survey §7.3 rows 9/11: `21` → `24` in the catalogue tests | **`21` → `24`, as the survey said**, in both places (`core/categories.test.ts` · `test('there are 21 categories', () => {` · ~5 and `core/categories.test.ts` · `  assert.equal(PROFILES.standard.length, 21);` · ~70) <!-- historical-citation: §0 quotes the pre-24 catalogue assertions Task 2 step 1 replaces --> | as above | Task 2 |
| Survey §7.2: the new categories add **6** generated command files | **6** — `add-todo.md`, `list-todo.md`, `add-note.md`, `list-note.md`, `add-procedure.md`, `list-procedure.md` | as above | Task 2 |
| **This plan's own first version:** the shipped `runbook` seed's `1. `/`2. `/`3. ` body must change shape, and the committed assertion pinning it is work | **Withdrawn.** `runbook` keeps its seed, so that assertion stays green and there is nothing to do to it. What Task 10 does to the seed instead is additive and does not touch the numbered lines: one sentence saying which of the two categories this is | A withdrawn claim takes its citation with it. A citation left behind still resolves, which is exactly why it survives a re-read: the checker is happy and the sentence beside it is false | Task 10 |
| §6m's controller ruling on F6 lists *"a `validateBody` carve-out"* among the work | **No behavioural carve-out is needed.** Steps never enter `body`, so `validateBody` (`validate.ts` · `export function validateBody(body: string): void {` · ~234) is correct exactly as written. What *is* needed is that its message names the new route, because a user pasting a whole procedure is refused with a message that today offers only observations | A cost estimate written before the shape was fixed can over-state as well as under-state. Verify each named site against the code before scheduling it | Task 5 |
| Survey §3.3 and §6i.4: a third `FieldPolicy` member *"or a write path outside `updateItem`"* | **Neither.** §6m.3 moved progress out of the item entirely, so `steps` is **create-only** — the `observations` precedent (`mutate.ts` · `export interface UpdateInput {` · ~407 declares no `observations` either) — and `UPDATE_FIELD_POLICY` is not consulted at all | An implementation choice left open by one section is often closed by a later one. Read the superseding section before costing the open choice | Tasks 5, 7, 8 |
| §6m.6 records *"extend the `text` predicate to observations and `extra`"* as work still to take | **Already implemented.** `core/search.ts` · `function searchableText(item: Item): string {` · ~60 already reads title, body, every observation's text and context, and every `extra` value | A spec's "taken instead" list can be overtaken by a commit between the ruling and the plan. Re-check "still to do" against the tree | Task 3 — it is why `search --type todo --text …` needs no change |
| §6g: progress lives in *"session state or the audit log"* | **The audit log, and it cannot be session state.** No CLI surface has a trustworthy session id — `core/focus.ts` · `// has a trustworthy session id: the CLI runs in a terminal and is handed none,` · ~25 records the codebase hitting this before and conceding it by retreating to workspace scope. `mycontext procedure step` is a CLI command, so a session-keyed progress file would be written under a key nothing reads | An either/or in a spec is a decision delegated to the plan, and one of the two options may be closed by a constraint recorded elsewhere in the same document | Tasks 8, 9 |
| Nobody named it | **`mycontext add --note` already means an observation category spelled `note`** (`cli/index.ts` · `const NOTE_CATEGORY = 'note';` · ~207), and this plan adds an *item* category with the same spelling. They are different namespaces and the parser cannot confuse them; a reader can | A new name is checked against every vocabulary in the product, not only the one it joins | Tasks 2, 3 |

**Where this plan could not verify something, it says so rather than asserting it.** Three such
places, each carried into the task that owns it: whether `/clear` preserves `session_id` (unprobed —
and this plan depends on it nowhere, see "What this plan is not doing"); whether workspace-scoped
step progress is the right granularity when two terminals share one workspace (unmeasured — Task 8
states the limit in the command's own output rather than hiding it); and the exact character budget
`skills/mycontext/SKILL.md` needs after three names and their reflow (Task 2 establishes it by
executing, not by predicting).

**And where §6o decides less than an implementer needs, this plan says which answer it chose and
that the spec did not choose it.** §6o fixes `procedure`'s name, prefix, tier and meaning and
nothing else, so five questions are answered here rather than there, each marked **Reported as an
under-specification** at the decision that answers it: the `CategoryDef` description string
(Design decision 17 and Task 2's exact-values table); whether `procedure` joins `PROFILES.minimal`
(17); whether `extraFields` is empty (17); whether `steps` are refused on a category other than
`procedure` — including on `runbook`, which §6o says has no `## Steps` field (Design decision 19);
and which category is `runbook`'s tagged nearest neighbour once a nearer one exists (18). None of the five
changes the shape of the work; all five would otherwise be guessed silently, differently, by whoever
reached them first.

---

## Verified facts this plan builds on

Citations are `` `file` · `verbatim fragment` · ~line ``, per `2026-08-18-v2-decisions.md` §2: **the
fragment is the identity** and the line is a hint that may go stale. `npm run verify:citations`
resolves every fragment below and exits non-zero on a miss. A fact that is an *absence* cannot carry
a fragment and is re-checked by execution instead — the second table.

### The category registry

| Fact | Where verified |
|---|---|
| A category is six fields and nothing else — no injection knob, no lifecycle field, no body-section field | `categories.ts` · `export interface CategoryDef {` · ~3 |
| The catalogue is a literal map of `def(...)` calls | `categories.ts` · `export const CATEGORIES: Record<string, CategoryDef> = {` · ~19 |
| `runbook` already ships — normative, prefix `RUN`, enabled — and this plan does not change one character of it (§6o) | `categories.ts` · `runbook:       def('runbook', 'RUN', 'normative', true,` · ~40 |
| The normative block ends at `known_issue` and the rationale block begins at `adr`, so a new normative entry has one correct position: beside `runbook` | `categories.ts` · `  known_issue:   def('known_issue', 'KNOWN', 'normative', true,` · ~57 |
| `standard` is **derived** from `defaultEnabled`, so a new entry joins it for free | `categories.ts` · `  standard: Object.values(CATEGORIES)` · ~118 |
| `minimal` is a hand-written list of eight names; a new category joins it only by being typed in | `categories.ts` · `  minimal: [` · ~114 |
| Nothing may ship disabled by default, and that is asserted | `core/categories.test.ts` · `test('the catalogue ships no category disabled by default', () => {` · ~37 |
| The tier decides the edit-policy default | `config.ts` · `export function defaultAgentEdits(tier: Tier): AgentEdits {` · ~106 |
| A user may add or retier a category through `config.json`; the accepted keys are pinned, and `extraFields` is **one of the seven** — it joined the list on 2026-08-20, and the comment above the list says why | `config.ts` · `const CATEGORY_KEYS = [` · ~197 |
| The resolved shape the rest of the code reads | `config.ts` · `export interface ResolvedCategory {` · ~80 |

### The tier, and why `todo` and `note` are nearly free

| Fact | Where verified |
|---|---|
| `Tier` is closed | `types.ts` · `export type Tier = 'normative' \| 'rationale';` · ~1 |
| The full-text tier admits normative items only — this is the whole of "never injected" | `select.ts` · `const injectable = eligible.filter((i) => isNormative(i, config));` · ~473 |
| The index names normative items and reduces every rationale type to a bare count | `select.ts` · `    if (isNormative(item, config)) continue;` · ~384 |
| The split is a **category** lookup, never a per-item one | `select.ts` · `function isNormative(item: Item, config: Config): boolean {` · ~129 |
| `status === 'active'` is a hard precondition for any injection at all, index line included | `select.ts` · `export function isEligible(item: Item, config: Config): boolean {` · ~123 |
| An agent-authored normative item is forced to `draft`, with no parameter and no override | `trust.ts` · `export function trustedStatus(origin: Origin, tier: Tier, requested: Status): Status {` · ~166 |
| One of its two call sites — `cli/commands/inbox-promote.ts` has the other | `mutate.ts` · `  const status: Status = trustedStatus(origin, category.tier, input.status ?? 'active');` · ~272 |

### The status vocabulary the lifecycle maps onto

| Fact | Where verified |
|---|---|
| Five members, and this plan adds none | `types.ts` · `export type Status = 'active' \| 'draft' \| 'superseded' \| 'deprecated' \| 'validated';` · ~2 |
| Second copy | `validate.ts` · `export const STATUSES: Status[] = ['active', 'draft', 'superseded', 'deprecated', 'validated'];` · ~22 |
| Third copy | `mcp/tools.ts` · `const STATUSES = ['active', 'draft', 'superseded', 'deprecated', 'validated'];` · ~34 |
| `deprecated` is counted in `retired`, so a finished procedure stays in a session-visible number | `select.ts` · `const RETIRED_STATUSES = new Set(['superseded', 'deprecated', 'validated']);` · ~308 |
| `validated` would be **wrong** for `done` — it still governs | `trust.ts` · `export function governsNormatively(ctx: MutationContext, item: Item): boolean {` · ~230 |
| The review queue is `status === 'draft' && layer === 'project'`, one definition for four surfaces | `select.ts` · `export function reviewQueue(items: Item[], type: string \| null = null): Item[] {` · ~344 |
| A non-human caller cannot change the status of a normative item — §2.2's "human-only" already ships | `mutate.ts` · `    input.status !== undefined && input.status !== item.status &&` · ~561 |
| `always` is a guarded field, so setting it is human-only too | `trust.ts` · `export const GUARDED_FIELDS = {` · ~246 |
| `edit --status superseded` is refused on purpose; `supersede --by` is the route | `cli/commands/edit.ts` · `      if (status === 'superseded') {` · ~474 |

### The file format, and why `## Steps` is a format change

| Fact | Where verified |
|---|---|
| `validateBody` refuses **any** body line starting with a Markdown heading | `validate.ts` · `export function validateBody(body: string): void {` · ~234 |
| …with the comment that changing the format is a much larger decision than the guard | `validate.ts` · `const HEADING_LINE = /^#{1,6}\s/;` · ~217 |
| `splitSections` is already generic — it collects **every** `##` section into a map | `item.ts` · `function splitSections(body: string): { prose: string; sections: Map<string, string[]> } {` · ~102 |
| …but only two were read when this row was written — **`steps` is the third since Task 5 executed** — so any *other* section is still parsed and then destroyed on the next `persist()` | `item.ts` · `    observations: parseObservations(sections.get('observations') ?? []),` · ~207 |
| The line grammar a step regex sits beside | `item.ts` · `const OBSERVATION = /^-\s+\[([a-z0-9_-]+)\]\s+(.*)$/i;` · ~7 |
| The reader it is modelled on | `item.ts` · `function parseObservations(lines: string[]): Observation[] {` · ~126 |
| The writer, and the fixed section order | `item.ts` · `    parts.push('## Observations', ...item.observations.map(renderObservation), '');` · ~260 |
| The checksum, which must learn `steps` or a step edit is invisible to `doctor` | `item.ts` · `export function computeItemChecksum(item: Item): string {` · ~215 |
| Content identity, which must learn `steps` or two procedures differing only in steps dedupe onto each other | `content-hash.ts` · `interface ContentShape {` · ~13 |
| …and its item-side entry point | `content-hash.ts` · `export function itemContentHash(item: Item): string {` · ~104 |
| The injected block, which must emit steps or an `active` procedure arrives without the content it exists to deliver | `render-item.ts` · `export function renderItemBlock(item: Item): string {` · ~172 |
| Budgeting is derived from that exact text, so emitting steps makes `itemCost` correct with no second change | `select.ts` · `function itemCost(item: Item): number {` · ~119 |
| `Item` today | `types.ts` · `export interface Item {` · ~33 |
| **No DDL change**: an item is stored as JSON in a `TEXT` column and `rebuild` re-parses from Markdown | `store.ts` · `  data        TEXT NOT NULL` · ~29 |
| `observations` is create-only — the precedent `steps` follows | `mutate.ts` · `export interface UpdateInput {` · ~407 |
| Where a create input declares its fields | `mutate.ts` · `export interface CreateInput {` · ~45 |
| Revisions carry four fields, and `steps` must be explicitly none of them | `revision-log.ts` · `export const REVISION_FIELDS = ['title', 'body', 'tags', 'extra'] as const;` · ~291 |
| The compile-time table this plan must leave alone | `trust.ts` · `const UPDATE_FIELD_POLICY = {` · ~323 |

### Audit, relations, search

| Fact | Where verified |
|---|---|
| **Six** audit kinds today — `access` joined 2026-08-20, `progress` 2026-08-21, for `ui-refused` | `core/audit.ts` · `export type AuditKind = 'mutation' \| 'injection' \| 'hook' \| 'focus' \| 'access' \| 'progress';` · ~80 |
| The runtime list the CLI and MCP `--kind` enums derive from | `core/audit.ts` · `export const AUDIT_KINDS: AuditKind[] = [` · ~121 |
| One total table, so no caller can classify an op twice | `core/audit.ts` · `const KIND_OF: Record<AuditOp, AuditKind> = {` · ~124 |
| `mutation` means "changed an item" | `core/audit.ts` · `export const MUTATION_OPS = [` · ~87 |
| The precedent for a kind that touches no item: *"It is genuinely a fourth thing, so it is a fourth kind."* | `core/audit.ts` · `export const FOCUS_OPS = ['focus-set', 'focus-clear'] as const;` · ~112 |
| The record shape a progress record fits into unchanged (`itemId`, `origin`, `note`) | `core/audit.ts` · `export interface AuditRecord {` · ~161 |
| The reader refuses an unregistered kind, so a new kind must be registered in all three places at once | `core/audit.ts` · `      if (typeof row.kind !== 'string' \|\| !AUDIT_KINDS.includes(row.kind as AuditKind)) {` · ~288 |
| The closed op vocabulary the new ops join | `core/audit.ts` · `export const AUDIT_OPS: AuditOp[] = [` · ~117 |
| `RELATION_TYPES` is closed and `derived_from` is in it | `vocabulary.ts` · `  'derived_from', 'constrains', 'supersedes', 'blocks',` · ~43 |
| `search --type <category>` already filters by category exactly | `core/search.ts` · `export interface ItemFilters {` · ~25 |
| …and the text predicate already reads observations and `extra` | `core/search.ts` · `function searchableText(item: Item): string {` · ~60 |

### The enumeration surface

| Fact | Where verified |
|---|---|
| Slash commands are generated from the resolved config and committed | `plugin/commands.ts` · `export function generateCommands(config: Config): CommandFile[] {` · ~924 |
| A category is named in code exactly twice today, both times for singled-out behaviour, not enumeration | `plugin/commands.ts` · `const SNAPSHOT_CATEGORY = 'reference';` · ~138 |
| …and | `cli/commands/lesson.ts` · `    if (lesson && lesson.type !== 'lesson') {` · ~48 |
| Hebrew descriptions are pinned to the catalogue by set equality | `categories-he.test.ts` · `'HE_CATEGORY_DESCRIPTIONS (src/help/he.ts) no longer covers the catalogue exactly — a ' +` · ~133 |
| …their source | `help/he.ts` · `export const HE_CATEGORY_DESCRIPTIONS: Record<string, string> = {` · ~24 |
| Worked specimens are pinned: no category may fall back to the placeholder seed | `help/index.ts` · `const SEEDS: Record<string, Seed> = {` · ~213 |
| The topic file needs one ≥150-character entry per enabled category, each naming a nearest neighbour | `categories-topic.test.ts` · `test('every enabled category has an entry saying what it is for', () => {` · ~55 |
| The skill's tier bullets are asserted to be exactly the enabled set, in both directions | `skills/mycontext/SKILL.md` · ``- **Rationale** (`adr`, `decision`, `lesson`, `tradeoff`, `assumption`,`` · ~25 |
| …under a character ceiling raised six times, each with a recorded reason | `plugin-assets.test.ts` · `  assert.ok(text.length <= 5325,` · ~765 <!-- historical-citation: enumeration survey quotes the pre-raise ceiling Task 2 step 6 replaces --> |
| The non-per-category slash commands are pinned as an exact set | `test/plugin/commands.test.ts` · `const GENERIC = [` · ~129 |
| Both READMEs' hand-written counts | `README.md` · `The catalogue holds **21** categories` · ~3789 <!-- historical-citation: enumeration survey quotes the pre-24 README count Task 2 step 8 replaces --> |
| …and | `README.md` · ``Two profiles: `minimal` (8 categories) and `standard` (all 21, the default)`` · ~2987 <!-- historical-citation: enumeration survey quotes the pre-24 README profile line Task 2 step 8 replaces --> |
| The Hebrew mirror | `docs/README.he.md` · `הקטלוג מחזיק **21** קטגוריות` · ~4085 <!-- historical-citation: enumeration survey quotes the pre-24 Hebrew README count Task 2 step 8 replaces --> |
| Category lists no test pins today | `docs/TUTORIAL.md` · `- **Normative** categories (13 of them:` · ~252 <!-- historical-citation: enumeration survey quotes the pre-change TUTORIAL tier bullet Task 2 step 8 replaces --> |
| …and | `docs/TUTORIAL-ADVANCED.md` · `**The 13 normative categories:**` · ~461 <!-- historical-citation: enumeration survey quotes the pre-change TUTORIAL-ADVANCED tier heading Task 2 step 8 replaces --> |
| Every CLI command must be named in `README.md`, and `README.md` must name no command that does not exist | `inventory.test.ts` · ` * Documentation inventory parity: every CLI command, slash command and MCP` · ~2 |
| Every CLI command must have a slash counterpart or a **written reason** it has none | `plugin/parity.ts` · `export const CLI_WITHOUT_SLASH: Record<string, string> = {` · ~104 |
| The precedent for making a checker red before trusting it | `check-retired.ts` · `// watching it pass: a checker is not verified until it has been made red.` · ~100 |

### Facts that are absences, and cannot carry a fragment

| Fact | How it was checked |
|---|---|
| No `## Steps` parser, no `Step` type, no `steps` field exists anywhere in `src/` | `grep -rn "## Steps\|parseSteps\|steps" src/` — no matches for any of the three, 2026-08-20 |
| No `progress` audit kind and no `step-` op exists | `grep -rn "step-done\|'progress'" src/core/audit.ts` — no matches |
| `commands/` holds 66 files: 42 per-category, 23 generic, plus `LoadMyContext.md` | `ls commands/`, partitioned by the `^(add\|list)-` rule `test/docs/counts.test.ts` uses |
| `todo`, `note` and `procedure` contain no `_`, so the slug generator produces no collision | read the slug-clash throw in `plugin/commands.ts`; `commandSlug` only rewrites `_` |
| `CATEGORY_WORDS` spells 19 through 23 and **stops there**, so 24 has to be added | read `test/docs/counts.test.ts` ~282-288, 2026-08-20 |
| No category named `procedure` exists, and no `PROC` prefix is taken | `grep -rn "procedure\|'PROC'" src/core/categories.ts src/help/he.ts src/help/index.ts` — no matches, 2026-08-20 |
| ~19 hand-rolled `function item(over: Partial<Item> = {}): Item` factories exist in `test/`, plus one `const item: Item = {` in `src/help/index.ts` and one spread in `src/core/rebuild.ts` | `grep -rn "function item(\|function makeItem\|: Item = {" test/ src/` — this is the full blast radius of adding a required field to `Item` |
| `npm run verify:citations` exits 0 on the tree this plan was revised against — **0 broken, 0 moved for this document** — and `npm run check:retired` reports nothing in this document | executed, 2026-08-20, after the §6o rewrite. Both totals move under the sibling plans landing concurrently and are deliberately not pinned here; **0 broken** is the fact, and the `~line` beside every fragment is a hint the script itself calls stale-able |

---

## Design decisions this plan fixes (so no implementer has to guess)

1. **`todo` and `note` are prefixes `TODO` and `NOTE`, tier `rationale`, `defaultEnabled: true`.**
   The tier is not a taxonomy judgement here, it is the whole feature: on that tier they are never
   injected in full, never named in the index, reduced to a bare count, and writable by an agent
   with no draft queue — with **zero new code in `select` or `trust`**. `defaultEnabled: true`
   because the catalogue ships nothing switched off and that is asserted; shipping either one off
   would have to re-argue `categories.test.ts`'s own test.
2. **Neither joins `PROFILES.minimal`.** `minimal` is the smallest useful *normative* vocabulary; an
   inbox is not part of it. The per-category `"enabled": true` escape already exists and says which
   category is being switched on. Recorded as a comment beside the list, so the next reader does not
   have to re-derive it.
3. **The review queue is not widened; `mycontext todo` is a separate surface.** §6m.9. A rationale
   item is never forced to `draft`, so `todo` could never have reached `reviewQueue` — the surface is
   new because the question is new, not because the queue was too narrow.
4. **`mycontext inbox-promote <id> --to <category>` is the promotion command, and it is deliberately
   not called `promote`.** `/mycontext:promote` already exists and means `mycontext review promote`
   — promoting a *draft* so it governs. A second `promote` meaning "move a capture into a real
   category" is the second-spelling defect this project has paid for four times. "Inbox" is the
   spec's own noun for these two categories (§1.2: *"The inbox."*), and one verb covers both because
   the id decides which category is being promoted.
5. **A promoted origin becomes `deprecated`, not `superseded`.** §1.3 says "marks the origin
   resolved" and does not say which status. `deprecated` because `cli/commands/edit.ts` already
   documents it as the status meaning retirement with no replacement, and because a `decision`
   derived from a `note` does not *replace* the note. `deprecated` is in `RETIRED_STATUSES`, so a
   promoted origin stays counted rather than vanishing. **Reported as an under-specification.**
6. **The link back is `derived_from`, written on the NEW item, pointing at the origin.** §6i.5 rules
   the type; the direction is this plan's and the spec does not fix it. `derived_from` on the target
   reads *"`DEC-x` derived from `NOTE-y`"*, which is true. The reverse reads *"`NOTE-y` derived from
   `DEC-x`"*, which is false.
7. **`Step` is `{ text: string; checked: boolean }`, and the parser accepts exactly `- [ ] ` and
   `- [x] `.** Any other non-blank line inside `## Steps` is a **parse error**, not a skipped line.
   This is the only shape satisfying both invariants at once: `[ ]`/`[x]` round-trip byte-identically,
   and a `- [X]` or a bare `- foo` inside the section produces a per-file load error naming the line
   instead of being destroyed on the next `persist()`. `checked` is stored because a human may tick a
   box by hand and Markdown is the source of truth; **nothing in this plan ever writes
   `checked: true`.**
8. **`## Steps` renders before `## Observations`.** Steps are what a procedure *is*; observations are
   commentary on it. The order is fixed and pinned by a test, because a floating order breaks
   byte-identity the first time an item carries both.
9. **`steps` is create-only.** Absent from `UpdateInput`, exactly as `observations` is. That is what
   keeps `UPDATE_FIELD_POLICY` and its four `Assert<>` types untouched (§6m.3), and it means a step
   is corrected by editing the Markdown and running `mycontext repair` — the route any other hand
   edit takes. **Stated in the command's own help text**, not left to be discovered.
10. **`ready` is a tag, not an `extra` field.** §6m.2 permits either. A tag is free, searchable today
    (`search --tag ready`), round-trips, and needs no `CategoryDef` change; an `extra` field would
    have to join `procedure.extraFields`, which flows into the MCP `create_item` schema built from the
    default config and would advertise `ready` on `constraint` and `adr` too.
11. **Activation is one command performing two writes, human-only by construction.**
    `mycontext procedure activate <id>` issues a single `updateItem` carrying both `status: 'active'`
    and `always: true`. Both are gated; the CLI passes `origin: 'human'` and an agent can reach
    neither. The command exists because §2.1 says in as many words that setting only the status
    ships a procedure that is merely eligible — indexed, not delivered.
12. **Progress is workspace-scoped and lives in the audit log.** Not session state: no CLI surface
    has a trustworthy session id. Three ops in a new `progress` kind — `step-done`, `step-undone`,
    `step-reset` — and "3 of 5" is counted by replaying the records for that item since its most
    recent `step-reset`, which `procedure activate` writes. **The cost is stated in the command's own
    output:** two terminals working one procedure in one workspace share one record set.
13. **`activate` writes the `step-reset` record BEFORE the `updateItem`, and §6n.3 is why.** The
    rule §6n.3 settled for the hook is general: *record the intent before doing the work*, so that a
    process killed between the two leaves evidence rather than silence. Applied here the two orders
    are not symmetric. Reset-then-activate, interrupted, leaves a cleared progress set on an item
    that is still a draft — nothing reads it, and the next `activate` writes another reset over it.
    Activate-then-reset, interrupted, leaves an **`active` procedure carrying the previous run's
    ticks**, which is exactly the "is this finished" question the one-shot lifecycle exists to
    answer, answered wrongly and silently. Ordering is free; the wrong order is not.
14. **A new `AuditKind`, not a new `MUTATION_OPS` member.** A step tick changes no item, so filing it
    under `mutation` would make `mycontext audit --kind mutation --item PROC-x` a question with a
    wrong answer — the identical argument `core/audit.ts` makes for `focus` being a fourth kind.
    This is the sixth — `access` took the fifth on 2026-08-20.
15. **Injection never carries progress.** `renderItemBlock` emits the stored steps and nothing else.
    An injected procedure is the knowledge; progress is a display concern of `mycontext procedure show`.
    Anything else would make two sessions receive different text for the same item.
16. **`mycontext todo` lists; there is no `mycontext note` command.** §6m.9 names one surface and this
    ships exactly that one. `mycontext search --type note` answers the other question with no new
    code.
17. **`procedure` is prefix `PROC`, tier `normative`, `defaultEnabled: true`, `extraFields: []`, and
    it does *not* join `PROFILES.minimal`.** §6o fixes the name, the prefix, the tier and the
    meaning; it fixes none of the rest, and the rest is not free. `defaultEnabled: true` because the
    catalogue ships nothing switched off and `core/categories.test.ts` · `test('the catalogue ships no category disabled by default', () => {` · ~37
    asserts it. `extraFields: []` because the lifecycle is expressed entirely in `status`, `always`
    and one tag (Design decisions 10 and 11), so there is no field left for `extraFields` to carry —
    and because anything added there is advertised in the MCP `create_item` schema built from the
    default config. Not in `minimal` because `minimal` is the smallest useful normative vocabulary a
    project can start from, and a one-shot migration record is not something a new corpus needs on
    day one; the per-category `"enabled": true` escape switches it on and says which category it
    switched on. **All four reported as under-specifications.** The description string is
    fixed in Task 2's exact-values table for the same reason.
18. **`runbook`'s tagged nearest neighbour becomes `procedure`, and the `instruction` contrast stays
    in the entry as prose.** `categories-topic.test.ts` requires exactly one
    `**Nearest neighbour: \`x\`.**` line per entry, so the two contrasts cannot both be tagged. The
    tagged one is `procedure` because the nearest neighbour is the category a reader will actually
    file into by mistake, and after §6o that is no longer `instruction`: an instruction and a
    runbook differ by *standing versus conditional*, which nobody confuses, while a runbook and a
    procedure differ by *repeatable versus once*, which is the confusion §6l F7 predicted and §6o
    accepted the risk of. `procedure`'s tagged neighbour is `runbook`, symmetrically.
    **Reported as an under-specification:** §6o requires the boundary to be stated in
    `mycontext help categories` and says nothing about which entry's neighbour line carries it.
19. **`--step` and `create_item{steps}` are category-agnostic; nothing refuses steps on a
    non-`procedure` category.** §6o says `runbook` has "no `## Steps` field", and the honest reading
    of that in this codebase is *documentary, not enforced*: `parseItem` has no access to `Config`
    (`item.ts` · `function splitSections(body: string): { prose: string; sections: Map<string, string[]> } {` · ~102
    is reached with a file and a layer and nothing else), so a per-category refusal cannot live in
    the parser without handing it the config — a much larger change than §6o asks for. It would have
    to live in `createItem`, where it would be the first category-conditional field rule in the
    product; `observations`, `scope` and `tags` are all accepted on every category. So this plan
    accepts them everywhere and makes `procedure` the only category whose documentation, seed and
    commands mention steps at all. **Reported as an under-specification, and it is the one with the
    largest blast radius if the owner meant the other thing:** enforcing it later is a breaking
    change for any corpus that took the offer.

---

## What this plan is **not** doing, and why

- **No `ready` injection, and no per-item injection mode in `select()`.** §2.1 is explicit:
  *"Nothing may be built on 'index line only' until that is decided."* `isEligible` admits `active`
  only, so a `ready` procedure — a draft carrying a tag — reaches no index line today. This plan does
  not add a per-item mode and does not add a `Status` member. What it does instead is make the
  consequence visible: `mycontext procedure list` prints, for every `ready` procedure, that the model
  does not know it exists until it is activated. That is `INV-nothing-is-dropped-silently` applied to
  a deliberate gap rather than to an accident.
- **No fourth new category, and nothing at all done to `runbook`'s meaning.** §6o. The
  repeatable-sequence category is `runbook`, it already ships, and this plan changes neither its
  `CategoryDef` description nor its tier nor its prefix nor its seed's numbered body. Task 10 adds
  one sentence to its topic entry and one to its seed body — the boundary, which §6o requires — and
  that is the whole of it.
- **No enforcement of "`runbook` has no `## Steps` field".** Design decision 19: it is documented,
  not refused, and the refusal is not built here.
- **No `origin` change, no `trustedStatus` branch, no new `Origin` member.** Out of scope here and
  refused there (§6m.5).
- **No FTS5, no ranking, no search change at all.** §6m.6 withdrew the adoption and the replacement
  it named has already landed (§0).
- **No widening of `reviewQueue`.** §6m.9.
- **No step editing through `updateItem`.** Design decision 9.
- **No execution of procedure steps.** A procedure is knowledge delivered to a model; a command that ran
  its steps would be a second, unreviewed execution surface.
- **No export, pack, import, session-naming, cross-session-continuity, hook or `watchedDocs` work.**
  Sibling plans own those, and this plan consumes nothing from them.
- **No `mycontext note` command and no `mycontext inbox` listing.** Design decision 16.
- **No migration and no schema version bump.** Nothing on disk changes shape: an item with no
  `## Steps` section parses to `steps: []` and renders identically to today. Asserted by the raw
  byte-identity fixture in Task 5, not assumed.

---

## The 22 hand-typed enumeration sites

This is the "half-added category" hazard the survey names, and it is why Task 2 is one commit rather
than five. **Most of these sites are pinned to `CATEGORIES` by set-equality tests**, so they cannot
be staged: adding a Hebrew description for a category that does not yet exist fails the same
assertion that adding a category without a Hebrew description fails. The sites pinned by **nothing**
are the dangerous ones, and Task 1 exists to close exactly those.

**Two of the three new names are rationale and one is normative, and the difference is not cosmetic
at these sites.** Six of the twenty-two partition by tier — the skill's bullets, both tutorials'
lists, and the two topic sources' ordering — so `procedure` lands on the *other* side from `todo`
and `note` and moves a different count. A pass that adds three names to the rationale side is green
in `categories.test.ts` and red in Task 1's guard, which is what Task 1 is for.

| # | Site | What must change for `todo` + `note` + `procedure` | Pinned by |
|---|---|---|---|
| 1 | `src/core/categories.ts` (`CATEGORIES`) | three `def()` entries — `procedure` in the normative block beside `runbook`, `todo` and `note` after `reference` | — (it is the source) |
| 2 | `src/core/categories.ts` (`PROFILES.minimal`) | **no change** — decisions 2 and 17, recorded as one comment covering all three | the size assertion in `categories.test.ts` |
| 3 | `src/help/he.ts` | three Hebrew descriptions | set equality against `CATEGORIES` |
| 4 | `src/help/index.ts` (`SEEDS`) | three worked specimens | the no-placeholder assertion |
| 5 | `src/help/topics/categories.md` | three sections, ≥150 chars, each naming a nearest neighbour; **plus** the boundary sentence in `runbook`'s existing section (Task 10) | two assertions, and Task 10's guard |
| 6 | `src/help/topics/categories.he.md` | the Hebrew mirror, section for section, same order | heading-structure and entry-set equality |
| 7 | `skills/mycontext/SKILL.md` | `todo` and `note` in the **Rationale** bullet, `procedure` in the **Normative** bullet | set equality, both directions |
| 8 | `test/plugin-assets.test.ts` | raise the character ceiling, with a recorded reason | the ceiling itself |
| 9 | `test/core/categories.test.ts` | `21` → `24` | itself |
| 10 | `test/core/categories.test.ts` | three rows in the pinned `(name, prefix, tier, defaultEnabled)` table, each in catalogue order — so `procedure`'s row sits in the normative block, not beside `todo`'s | itself |
| 11 | `test/core/categories.test.ts` | `PROFILES.standard.length` `21` → `24` | itself |
| 12 | `test/docs/counts.test.ts` (`CATEGORY_WORDS`) | **add `24: { en: 'twenty-four', he: … }`** — the table stops at 23 (§0) | itself |
| 13 | `README.md` | four hand-written counts | `test/docs/counts.test.ts` |
| 14 | `docs/README.he.md` | the Hebrew counts, digits **and** number-words | the same tests, `he` branch |
| 15 | `README.md` / `docs/README.he.md` | three `<!-- example: examples <name> --short -->` marker blocks each, plus the prose around them | the markers are hand-typed — **Task 1's test** |
| 16 | `test/docs/counts.test.ts` slash-command breakdown | per-category 42 → 48, and the totals in both READMEs' §5 sentences | itself, against `commands/` |
| 17 | `test/plugin/commands.test.ts` (`GENERIC`) | grows once per new generic command (Tasks 3, 4, 9, 11) | itself |
| 18 | `docs/TUTORIAL.md` | **both** tier bullets: rationale `8` → `10`, normative `13` → `14` | **nothing today — Task 1** |
| 19 | `docs/TUTORIAL-ADVANCED.md` | **both** appendix lists: rationale `8` → `10`, normative `13` → `14` | **nothing today — Task 1** |
| 20 | `CHANGELOG.md` | a v2.0 entry | `scripts/changelog-section.ts` in CI |
| 21 | `docs/ROADMAP.md` | tracking rows | explicitly **not** tested |
| 22 | `commands/*.md` | six generated files | byte-identity against the generator |

---

## File Structure

New files (created by this plan):

```
src/core/progress.ts              # step-progress replay over the audit log (Task 8)
src/cli/commands/todo.ts          # `mycontext todo` (Task 3)
src/cli/commands/inbox-promote.ts # `mycontext inbox-promote` (Task 4)
src/cli/commands/procedure.ts     # `mycontext procedure list|show|activate|done|step` (Task 9)
commands/add-todo.md              # generated (Task 2)
commands/list-todo.md             # generated (Task 2)
commands/add-note.md              # generated (Task 2)
commands/list-note.md             # generated (Task 2)
commands/add-procedure.md         # generated (Task 2)
commands/list-procedure.md        # generated (Task 2)
commands/todo.md                  # generated (Task 3)
commands/inbox-promote.md         # generated (Task 4)
commands/procedure.md             # generated (Task 9)
commands/add.md                   # generated — the generic /mycontext:add (Task 11)
test/core/catalogue-completeness.test.ts  # THE meta-test (Task 1)
test/core/steps.test.ts           # parse/render/round-trip/checksum/content-hash (Task 5)
test/core/steps-injection.test.ts # renderItemBlock + budget (Task 6)
test/core/progress.test.ts        # replay semantics (Task 8)
test/cli/todo.test.ts             # (Task 3)
test/cli/inbox-promote.test.ts    # (Task 4)
test/cli/procedure.test.ts        # (Task 9)
test/help/category-boundary.test.ts       # the runbook/procedure boundary guard (Task 10)
test/fixtures/procedure-with-steps.md     # RAW fixture for byte-identity (Task 5)
```

Modified files:

```
src/core/categories.ts        # + todo, note, procedure — runbook UNTOUCHED (Task 2)
src/core/types.ts             # + Step; + steps on Item (Task 5)
src/core/item.ts              # STEP regex, parseSteps, renderStep, checksum (Task 5)
src/core/content-hash.ts      # steps in ContentShape + a canonicaliser (Task 5)
src/core/validate.ts          # + validateStepText; validateBody's MESSAGE only (Task 5)
src/core/revision.ts          # a comment recording that steps is not stageable (Task 5)
src/core/render-item.ts       # renderItemBlock emits steps (Task 6)
src/core/mutate.ts            # CreateInput.steps + normalisation (Task 7)
src/core/audit.ts             # + 'progress' kind, + PROGRESS_OPS, + KIND_OF rows (Task 8)
src/mcp/tools.ts              # create_item.steps (Task 7)
src/ingest/schema.ts          # an explicit refusal of "steps" on a candidate (Task 7)
src/cli/index.ts              # + --step on add; register three new commands (Tasks 3, 4, 7, 9)
src/plugin/commands.ts        # + four generic command files (Tasks 3, 4, 9, 11)
src/plugin/parity.ts          # the CLI_WITHOUT_SLASH / TOOL_PARITY judgements (Tasks 3, 4, 9)
src/help/he.ts                # + three Hebrew descriptions — runbook's untouched (Task 2)
src/help/index.ts             # + three SEEDS; Seed.steps; exampleItemShort renders steps;
                              #   SEEDS.procedure gains steps and SEEDS.runbook gains ONE
                              #   boundary sentence — its numbered body is untouched (Tasks 2, 5, 10)
src/help/topics/categories.md, .he.md  # + three sections; runbook's section gains the
                              #   boundary sentence and its neighbour line (Tasks 2, 10)
skills/mycontext/SKILL.md     # + todo, note in Rationale; + procedure in Normative (Task 2)
test/docs/counts.test.ts      # CATEGORY_WORDS gains 24 (Task 2)
README.md, docs/README.he.md  # counts, specimens, new commands, the lifecycle, the boundary
                              #   (Tasks 2, 3, 4, 9, 10, 12)
docs/TUTORIAL.md, docs/TUTORIAL-ADVANCED.md  # category lists, BOTH tiers (Task 2)
test/help/help.test.ts        # the procedure specimen's assertions (Task 10)
CHANGELOG.md, docs/ROADMAP.md # (Task 12)
```

**Execution order:** 1 → 2 → 3 → 4 (categories and their surfaces); 5 → 6 → 7 (the `## Steps`
format); 8 → 9 → 10 (the lifecycle); 11; 12 last. Tasks 5-7 do not depend on Tasks 1-4 and may be
done first if that suits; nothing else may be reordered. Each task leaves `npm test` green.

---

## Task 1: The catalogue-completeness test — the sites nothing pins today

**Files:**
- Test: `test/core/catalogue-completeness.test.ts` (create)

**Interfaces:**
- Consumes: `CATEGORIES` from `src/core/categories.ts`; the four documents named below, read from disk.
- Produces: nothing importable. It is a guard, and Task 2 is the first thing it guards.

**Why this task exists and why it is first.** Most enumeration sites are already pinned to
`CATEGORIES` by set equality — the Hebrew descriptions, the two topic sources, the skill's tier
bullets, the worked seeds. Four are pinned by **nothing**: `docs/TUTORIAL.md`'s tier lists,
`docs/TUTORIAL-ADVANCED.md`'s appendix lists, and the hand-typed
`<!-- example: examples <name> --short -->` markers in each README. A category can be added, ship,
and be described nowhere in either tutorial with a fully green suite. That is the exact shape of the
defect this project keeps paying for, and it needs a checker rather than more discipline —
`check-retired.ts` · `// watching it pass: a checker is not verified until it has been made red.` · ~100 is the precedent for both the reasoning and the way this task is verified.

- [ ] **Step 1: Write the test**

```ts
// test/core/catalogue-completeness.test.ts
/**
 * The category-enumeration sites that no other test pins.
 *
 * Adding a category touches 22 hand-typed places. Eighteen of them are held by
 * set-equality assertions elsewhere in this suite (HE_CATEGORY_DESCRIPTIONS,
 * both topic sources, SKILL.md's tier bullets, SEEDS, the generated command
 * files, the counts derived from Object.keys(CATEGORIES).length). These four
 * are held by nothing, so a half-added category ships documented nowhere and
 * the suite stays green:
 *
 *   - docs/TUTORIAL.md's two tier bullets
 *   - docs/TUTORIAL-ADVANCED.md's two appendix lists
 *   - README.md's per-category specimen markers
 *   - docs/README.he.md's per-category specimen markers
 *
 * What this test cannot do, stated so a green suite is not mistaken for
 * reviewed prose: it checks that every category is NAMED on the correct side
 * and that the counts beside those names are right. It cannot check that the
 * sentence around the name says anything true or useful. The same disclaimer
 * test/docs/inventory.test.ts carries, for the same reason.
 *
 * Deliberately NOT re-asserted here: that each category has an add-/list-
 * command file. test/plugin/commands.test.ts already holds the committed
 * files byte-identical to generateCommands(config)'s output, which is derived
 * from the resolved config, so the names are covered at their source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CATEGORIES } from '../../src/core/categories.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const read = (...p: string[]): string => readFileSync(path.join(REPO, ...p), 'utf8');

const NAMES = Object.keys(CATEGORIES).sort();
const BY_TIER = (tier: string): string[] =>
  Object.values(CATEGORIES).filter((c) => c.tier === tier).map((c) => c.name).sort();

/** Every `name` inside a backtick pair, in order. */
function ticked(text: string): string[] {
  return [...text.matchAll(/`([a-z_]+)`/g)].map((m) => m[1]!);
}

test('TUTORIAL.md names every category on the side its tier puts it', () => {
  const doc = read('docs', 'TUTORIAL.md');
  for (const tier of ['Normative', 'Rationale']) {
    const found = new RegExp(
      `- \\*\\*${tier}\\*\\* categories \\((\\d+)[^:]*:([\\s\\S]*?)\\) —`,
    ).exec(doc);
    assert.ok(found, `docs/TUTORIAL.md no longer carries a "**${tier}** categories (N: …)" bullet. ` +
      `If the wording changed, update this pattern; do not delete the test.`);
    const expected = BY_TIER(tier.toLowerCase());
    assert.deepEqual(
      ticked(found[2]!).sort(), expected,
      `docs/TUTORIAL.md's ${tier} list is not the catalogue's ${tier} tier. Nothing else in ` +
      `this suite reads that file, so a category added without it ships undocumented there.`,
    );
    assert.equal(
      Number(found[1]), expected.length,
      `docs/TUTORIAL.md says ${found[1]} ${tier} categories; there are ${expected.length}.`,
    );
  }
});

test('TUTORIAL-ADVANCED.md names every category on the side its tier puts it', () => {
  const doc = read('docs', 'TUTORIAL-ADVANCED.md');
  for (const tier of ['normative', 'rationale']) {
    const found = new RegExp(
      `\\*\\*The (\\d+) ${tier} categories:\\*\\*([\\s\\S]*?)\\n\\n`,
    ).exec(doc);
    assert.ok(found, `docs/TUTORIAL-ADVANCED.md no longer carries a "**The N ${tier} ` +
      `categories:**" list. If the wording changed, update this pattern; do not delete the test.`);
    const expected = BY_TIER(tier);
    assert.deepEqual(ticked(found[2]!).sort(), expected,
      `docs/TUTORIAL-ADVANCED.md's ${tier} appendix list is not the catalogue's ${tier} tier.`);
    assert.equal(Number(found[1]), expected.length,
      `docs/TUTORIAL-ADVANCED.md says ${found[1]} ${tier} categories; there are ${expected.length}.`);
  }
});

test('both READMEs carry one specimen marker per category, and no marker for a non-category', () => {
  for (const doc of ['README.md', path.join('docs', 'README.he.md')]) {
    const text = read(doc);
    const marked = [...text.matchAll(/<!-- example: examples ([a-z_]+) --short -->/g)]
      .map((m) => m[1]!)
      .sort();
    assert.deepEqual(
      marked, NAMES,
      `${doc}'s specimen markers are not the catalogue. The marker lines are hand-typed — ` +
      `\`npm run gen:docs\` only FILLS them — so a new category gets no specimen block until ` +
      `somebody writes the marker, and nothing else notices.`,
    );
  }
});
```

- [ ] **Step 2: Prove it red before trusting it**

A guard that has never failed is a guard nobody has checked. Make it fail, in the working tree only:

```bash
# 1. Add a throwaway entry to CATEGORIES, immediately after the `reference:` line.
#    probe: def('probe', 'PROBE', 'rationale', true, 'A throwaway, reverted below'),
node --test test/core/catalogue-completeness.test.ts
# EXPECT: 3 failing tests, naming `probe` as missing from
#   docs/TUTORIAL.md, docs/TUTORIAL-ADVANCED.md, README.md and docs/README.he.md.
# 2. Revert the entry.
git checkout -- src/core/categories.ts
node --test test/core/catalogue-completeness.test.ts
# EXPECT: 3 passing tests.
```

Record in the commit message that this was done and what the failure named. **Do not commit the
probe entry.**

- [ ] **Step 3: Full gate**

Run: `npm test && npx tsc --noEmit && npm run check:test-glob && git status --porcelain`
Expected: all green; the new file is inside `test/**/*.test.ts` so the glob check confirms it runs.

- [ ] **Step 4: Commit**

```bash
git add test/core/catalogue-completeness.test.ts
git commit -m "test(categories): pin the four enumeration sites nothing else holds"
```

---

## Task 2: Add `todo`, `note` and `procedure`, and close all 22 enumeration sites in one commit

**Files:**
- Modify: `src/core/categories.ts`, `src/help/he.ts`, `src/help/index.ts`,
  `src/help/topics/categories.md`, `src/help/topics/categories.he.md`,
  `skills/mycontext/SKILL.md`, `README.md`, `docs/README.he.md`, `docs/TUTORIAL.md`,
  `docs/TUTORIAL-ADVANCED.md`
- Modify (tests): `test/core/categories.test.ts`, `test/plugin-assets.test.ts`,
  `test/docs/counts.test.ts`
- Create (generated): `commands/add-todo.md`, `commands/list-todo.md`, `commands/add-note.md`,
  `commands/list-note.md`, `commands/add-procedure.md`, `commands/list-procedure.md`

**Interfaces:**
- Consumes: Task 1's guard.
- Produces: three `ResolvedCategory` entries reachable by every surface that resolves through
  `resolveConfig` — `mycontext add todo …`, `create_item{type:"todo"}`, `search --type note`,
  `mycontext add procedure …`, `/mycontext:add-todo`, `/mycontext:add-procedure`. **Nothing else in
  this plan may assume they exist before this task lands** — Tasks 9 and 10 in particular operate on
  `procedure` items and cannot run before it.

**This is one commit and cannot be split.** The sites are pinned to each other by set-equality
assertions: a Hebrew description for a category that does not exist fails the same assertion a
category without a Hebrew description fails. Staging it produces a red suite in both directions with
no intermediate green.

**The third name is not a third copy of the first two, and every step below says where it diverges.**
`todo` and `note` are rationale; `procedure` is **normative**, and on that tier three things are
true of it that are false of the other two: it **is** injected in full when it is `active` and
`always`, it **is** named in the session index, and an agent authoring one gets a `draft` from
`trustedStatus` with no parameter and no override (`trust.ts` · `export function trustedStatus(origin: Origin, tier: Tier, requested: Status): Status {` · ~166).
That asymmetry is the whole reason `procedure` can carry a lifecycle and `todo` cannot, and it is
also why `procedure` lands on the other side of every tier-partitioned enumeration site.

**Exact values, so no implementer chooses them:**

| | `todo` | `note` | `procedure` |
|---|---|---|---|
| `name` | `todo` | `note` | `procedure` |
| `prefix` | `TODO` | `NOTE` | `PROC` |
| `tier` | `rationale` | `rationale` | **`normative`** |
| `defaultEnabled` | `true` | `true` | `true` |
| `description` | `Something to build or fix later, captured the moment it occurs to you` | `Anything that arose during development and must not be lost` | `An ordered operation performed once and then finished; a repeatable one is a runbook` |
| `extraFields` | none | none | none |
| joins `PROFILES.minimal` | **no** | **no** | **no** |
| position in `CATEGORIES` | after `reference` | after `todo` | in the normative block, immediately after `runbook` |

**`procedure`'s description is this plan's, not §6o's, and it is chosen to carry the boundary.**
§6o gives the meaning (*"performed once and then done — a migration, a fix, a one-time correction"*)
and no string. The string above names `runbook` inside itself because this description is what
`/mycontext:add-procedure`, `mycontext help`, the generated category table in both READMEs and the
MCP `create_item` enum all print, and §6o's mitigation is that the difference must be statable at
capture time. A description that said only "performed once" would be true and would still leave the
author to discover the sibling. **Reported as an under-specification** (Design decision 17).

- [ ] **Step 1: Make the counting tests fail first**

Edit `test/core/categories.test.ts` only, and run it:

- `test('there are 21 categories', …)` → rename to `24` and assert `24`
  (`core/categories.test.ts` · `test('there are 21 categories', () => {` · ~5). <!-- historical-citation: Task 2 step 1 quotes the assertion it replaces -->
- `assert.equal(PROFILES.standard.length, 21);` → `24`
  (`core/categories.test.ts` · `  assert.equal(PROFILES.standard.length, 21);` · ~70). <!-- historical-citation: Task 2 step 1 quotes the assertion it replaces -->
- Add three rows to the pinned table, **each in catalogue order rather than all three together**
  (`core/categories.test.ts` · `test('the full (name, prefix, tier, defaultEnabled) table is pinned', () => {` · ~87).
  `procedure` goes in the NORMATIVE block, immediately after `runbook`'s row; `todo` and `note` go
  at the end of the rationale block. Getting this wrong is a test failure rather than a defect, but
  it is the first place the tier asymmetry bites and it will bite again at five more sites:

```ts
    // …in the normative block, after runbook's row:
    ['procedure', 'PROC', 'normative', true],
    // …at the end of the rationale block:
    ['todo', 'TODO', 'rationale', true],
    ['note', 'NOTE', 'rationale', true],
```

Run: `node --test test/core/categories.test.ts`
Expected: FAIL — 21 ≠ 24, and the pinned table has three rows the catalogue does not.

- [ ] **Step 2: Add the three entries**

Two edits in `src/core/categories.ts`
(`categories.ts` · `export const CATEGORIES: Record<string, CategoryDef> = {` · ~19), and they are
in different blocks of the same literal.

**(a) `procedure`, in the normative block, immediately after the `runbook:` entry**
(`categories.ts` · `runbook:       def('runbook', 'RUN', 'normative', true,` · ~40) — **adjacent on
purpose**, so the next person editing either one sees the other:

```ts
  // The one-shot sibling of `runbook`, and the pair is deliberate (spec §6o).
  // `runbook` is REPEATABLE: it is performed whenever the named operation comes
  // up, and it governs for as long as the operation exists. A `procedure` is
  // performed ONCE — a migration, a data fix, a one-time correction — and then
  // it is finished, which is why it is the category that carries a lifecycle
  // and `runbook` is not. Collapsing the two would lose the property that makes
  // the one-shot honest: it stops being injected when it is done.
  //
  // The test an author applies, and it is the same sentence the topic file,
  // both READMEs and both `examples` outputs give: will you do this again next
  // time the situation arises? Then it is a `runbook`. Is it done once and then
  // finished? Then it is a `procedure`.
  //
  // NORMATIVE, like `runbook`, and unlike `todo`/`note` below: an active
  // procedure is injected in full, is named in the index, and an agent-authored
  // one lands `draft` through `trustedStatus` with no exception anywhere.
  procedure:     def('procedure', 'PROC', 'normative', true,
    'An ordered operation performed once and then finished; a repeatable one is a runbook'),
```

**(b) `todo` and `note`, after the `reference:` entry** — the end of the rationale block:

```ts
  // The inbox, and the tier is the feature rather than a taxonomy judgement.
  // Every other category expects the author to already know what kind of
  // knowledge they have; at the moment a thought arrives mid-development they
  // do not, and the friction of choosing is what stops it being recorded at
  // all. RATIONALE means `select` never admits either to a full-text tier
  // (`isNormative` is consulted before `always` and `scope` are read) and
  // `buildIndex` reduces both to a bare count — so twenty unbuilt things do
  // not arrive in every session as twenty things the model is told to care
  // about and cannot act on. It also means `trustedStatus` does not force an
  // agent's capture to `draft`: a `todo` asserts nothing, it records an
  // intention, and draft-gating the one operation that must have no friction
  // would defeat the reason both exist.
  todo:          def('todo', 'TODO', 'rationale', true,
    'Something to build or fix later, captured the moment it occurs to you'),
  note:          def('note', 'NOTE', 'rationale', true,
    'Anything that arose during development and must not be lost'),
```

**`runbook`'s own entry is not edited in this step, or in any step of this task.** §6o.

And beside `PROFILES.minimal` (`categories.ts` · `  minimal: [` · ~114) add a comment recording the
decision rather than leaving it to be re-derived — **one comment covering all three**, because a
comment naming two of the three new names invites the third to be added later without an argument:

```ts
  // `todo`, `note` and `procedure` are all deliberately absent, for two
  // different reasons. `minimal` is the smallest useful NORMATIVE vocabulary
  // for a project that wants one: an inbox is orthogonal to that, and a
  // one-shot operation record is not something a corpus needs on day one.
  // The per-category `"enabled": true` in config already switches any of them
  // on and says which.
```

Run: `node --test test/core/categories.test.ts` → PASS. Run `npm test` → many other failures, which
are Steps 3-8.

- [ ] **Step 3: Hebrew descriptions**

`src/help/he.ts` (`help/he.ts` · `export const HE_CATEGORY_DESCRIPTIONS: Record<string, string> = {` · ~24).
`procedure` goes beside `runbook`, `todo` and `note` after `reference` — the same two positions as
Step 2, because this table is read row for row against the catalogue:

```ts
  procedure: 'פעולה מסודרת שמבוצעת פעם אחת ואז נגמרת; פעולה שחוזרת על עצמה היא runbook',
  todo: 'משהו לבנות או לתקן בהמשך, שנלכד ברגע שהוא עולה בדעתכם',
  note: 'כל דבר שעלה במהלך הפיתוח ואסור שיאבד',
```

Verified by `categories-he.test.ts` · `'HE_CATEGORY_DESCRIPTIONS (src/help/he.ts) no longer covers the catalogue exactly — a ' +` · ~133,
which also asserts each value actually contains Hebrew. **`runbook`'s Hebrew row is not touched**,
and the `procedure` row keeps the Latin word `runbook` inside it deliberately: it is a category
name, and a translated category name would not match anything the reader can type.

- [ ] **Step 4: Three worked seeds**

`src/help/index.ts` (`help/index.ts` · `const SEEDS: Record<string, Seed> = {` · ~213). Real
specimens, not filler — the no-placeholder assertion in `test/help/help.test.ts` fails on the
generic body, and both READMEs print these:

```ts
  procedure: {
    title: 'Backfill the tenant_id column on invoices',
    body:
      'One-time correction after the multi-tenant migration: rows written before 2026-07 '
      + 'carry a null tenant_id. Run it once, in this order; the reconciliation query is '
      + 'meaningless until the backfill has finished. Done once and then finished — the '
      + 'nightly job that keeps the column correct from here on is a `runbook`.',
    scope: ['src/billing/invoices/**'],
    tags: ['migration', 'billing'],
  },
  todo: {
    title: 'Retry the webhook dispatcher on 5xx',
    body:
      'Stripe retries for 3 days; we drop on the first 5xx from our own handler, '
      + 'so a 30-second outage loses the events that arrived during it.',
    scope: ['src/billing/webhooks/**'],
    tags: ['billing', 'reliability'],
  },
  note: {
    title: 'The staging seed script leaves orphaned carts',
    body:
      'Noticed while debugging something else; not characterised yet. If it turns out '
      + 'to be real it is a `known_issue`, and if it turns out to be the seed data it is '
      + 'nothing at all.',
    tags: ['bug'],
  },
```

The `note` seed carries `tags: ['bug']` on purpose: §1.4 makes `note --tag bug` → understood →
promoted to `known_issue` the documented lifecycle for a bug nobody has characterised yet, and the
specimen is where a reader meets it.

**`procedure`'s seed has no `steps:` yet, and that is the ordering, not an omission.** `Seed.steps`
does not exist until Task 5 puts `steps` on `Item` and Task 10 threads it through `exampleItemOf`;
this task runs before both. Task 10 adds the array and the assertions that pin it, and until then
the specimen is a body that says *when* to run the thing — which is the half a `runbook` specimen
does not have and is what makes the two distinguishable even in this intermediate state.

- [ ] **Step 5: The two topic sources, English and Hebrew**

`src/help/topics/categories.md` and `src/help/topics/categories.he.md`. Three `### ` sections in
each, **in the same position in both files** — the Hebrew source is checked heading-for-heading and
entry-for-entry against the English one, and both are checked against the catalogue.

Each entry must be **≥150 characters** and must contain exactly the string
`**Nearest neighbour: \`x\`.**` naming a real, different category
(`categories-topic.test.ts` · `test('every enabled category has an entry saying what it is for', () => {` · ~55).

- `procedure` — nearest neighbour **`runbook`**, and this is the one entry where the neighbour
  paragraph is the point rather than a courtesy. Write: a `procedure` is performed once and then it
  is finished; a `runbook` is performed again every time the named operation comes up. Then the
  lifecycle in one clause — a procedure is injected while it is `active` and stops being injected
  when it is done, which a runbook never does because a runbook is never done. **Task 10 adds the
  verbatim one-sentence test to this entry and to `runbook`'s**, and adds the guard that keeps both
  there; this step only has to leave an entry Task 10 can extend.
- `todo` — nearest neighbour **`requirement`**. The distinction to write: a `requirement` is what
  must be built and it governs; a `todo` is what somebody intends to build and governs nothing. A
  `todo` that survives review becomes a `requirement`; a `requirement` is never demoted to a `todo`.
- `note` — nearest neighbour **`lesson`**. The distinction: a `lesson` is what you concluded; a
  `note` is what you noticed and have not concluded anything about yet. Also say what neither is: an
  observation attaches to an existing item, and a `note` exists precisely because there is nothing
  to attach it to.

- [ ] **Step 6: The skill's tier bullets, and the ceiling**

`skills/mycontext/SKILL.md` (`skills/mycontext/SKILL.md` · ``- **Rationale** (`adr`, `decision`, `lesson`, `tradeoff`, `assumption`,`` · ~25):
add `` `todo` `` and `` `note` `` to the **Rationale** bullet **and `` `procedure` `` to the
Normative bullet**. They are not optional text — the bullets are asserted to be exactly the enabled
set in both directions, so omitting one fails and putting `procedure` in the Rationale bullet with
its two siblings fails differently. This is the first of the six tier-partitioned sites and the
easiest one to get wrong, because the three names arrived together.

Then **establish the new ceiling by executing**, not by predicting:

```bash
node -e "console.log(require('node:fs').readFileSync('skills/mycontext/SKILL.md','utf8').length)"
```

Raise `test/plugin-assets.test.ts` · `  assert.ok(text.length <= 5325,` · ~765 <!-- historical-citation: Task 2 step 6 quotes the ceiling it raises --> to that number
**+ 50**, keeping the ~50-character headroom every previous raise kept, and add a paragraph to the
comment block above it in the register the six previous raises use: which three names were added,
which bullet each went in, why they are not optional (the bullets are the tier table), and the
measured cost.

- [ ] **Step 7: `CATEGORY_WORDS` gains 24, and regenerate**

`test/docs/counts.test.ts` · `const CATEGORY_WORDS: Record<number, { en: string; he: string }> = {` · ~282
stopped at 23 (§0) when this step was written — **it spells 24 now; this step has executed** — and both
READMEs spell the catalogue size as a word in three places. Add:

```ts
  24: { en: 'twenty-four', he: 'עשרים וארבעה' },
```

The test's own message says to add the row rather than delete the test, and it is right: this number
has now drifted four times.

```bash
npm run gen:commands   # writes add-/list- for todo, note AND procedure — six files
npm run gen:docs       # fills the specimen blocks — AFTER Step 8 adds their markers
```

- [ ] **Step 8: Both READMEs, both tutorials**

Every value below is compared against a number the test computes, so get them from the program, not
from this plan:

| Where | 21 → 24 |
|---|---|
| `README.md` · ``Two profiles: `minimal` (8 categories) and `standard` (all 21, the default)`` · ~2987 <!-- historical-citation: Task 2 step 8 quotes the README line it replaces --> | yes |
| `README.md`, the generated category table's row count sentence | yes |
| `README.md` · `The catalogue holds **21** categories` · ~3789, <!-- historical-citation: Task 2 step 8 quotes the README line it replaces -->, and the "enables all **21**" beside it | yes |
| `README.md`, "twenty-one specimens, twenty-one types" and "not a fixed list of twenty-one nouns" | → **twenty-four** |
| `docs/README.he.md` · `הקטלוג מחזיק **21** קטגוריות` · ~4085 <!-- historical-citation: Task 2 step 8 quotes the Hebrew README line it replaces --> and its three siblings | digits **and** the number-word `עשרים וארבעה` |
| Both, §5's slash-command breakdown | per-category `42` → `48`; the "All N carry `disable-model-invocation: true`" total `65` → `71` |
| Both, §8's per-category command count | `21` → `24` |

Then, in **both** documents, add three marker blocks —
`<!-- example: examples procedure --short -->`, `<!-- example: examples todo --short -->` and
`<!-- example: examples note --short -->` — with their surrounding prose, **each in catalogue
order**: `procedure`'s beside the other normative specimens and immediately after `runbook`'s, the
other two beside the rationale ones. Then re-run `npm run gen:docs` to fill them.

Placing `procedure`'s specimen next to `runbook`'s is not tidiness. Both READMEs print these blocks
in one long sequence, and the two categories a reader has to tell apart are the two whose worked
examples should be adjacent — the same argument Step 2 makes for their `def()` entries.

Then the two tutorials, which Task 1 now pins — **both tier lists in each file, not just the
rationale one**:

- `docs/TUTORIAL.md` · `- **Normative** categories (13 of them:` · ~252 <!-- historical-citation: Task 2 step 8 quotes the TUTORIAL bullet it replaces --> — this bullet goes to
  `(14 of them: …)` and gains `procedure`; the **Rationale** bullet below it goes from `(8: …)` to
  `(10: …)` and gains `todo` and `note`.
- `docs/TUTORIAL-ADVANCED.md` · `**The 13 normative categories:**` · ~461 <!-- historical-citation: Task 2 step 8 quotes the TUTORIAL-ADVANCED heading it replaces --> — becomes
  `**The 14 normative categories:**` and gains `procedure`; the rationale list below it goes from
  `**The 8 rationale categories:**` to `**The 10 rationale categories:**` and gains the other two.

If Task 1's guard passes after editing only the rationale halves, Task 1's guard is broken and that
is the finding — it reads both tiers by construction (`BY_TIER`), so a green run there means the
regex stopped matching the normative bullet rather than that the normative bullet is right.

- [ ] **Step 9: Full gate**

Run: `npm test && npx tsc --noEmit && npm run test:perf && npm run check:retired && git status --porcelain`

The tests that must go from red to green in this task, named so a partial pass is visible:
`test/core/categories.test.ts`, `test/core/catalogue-completeness.test.ts`,
`test/help/categories-he.test.ts`, `test/help/categories-topic.test.ts`, `test/help/help.test.ts`,
`test/docs/counts.test.ts`, `test/docs/examples.test.ts`, `test/plugin/commands.test.ts`,
`test/plugin-assets.test.ts`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(categories): add todo, note and procedure, and close every enumeration site"
```

---

## Task 3: `mycontext todo` — the inbox listing surface

**Files:**
- Create: `src/cli/commands/todo.ts`
- Modify: `src/cli/index.ts` (import the module so it registers),
  `src/plugin/commands.ts` (a `todo.md` generic command), `README.md`, `docs/README.he.md`
- Modify (tests): `test/plugin/commands.test.ts` (`GENERIC`)
- Create (generated): `commands/todo.md`
- Test: `test/cli/todo.test.ts`

**Interfaces:**
- Consumes: the `todo` category (Task 2); `filterItems` from `src/core/search.ts`;
  `openMutateContext`/`emitLoadErrors` from `src/cli/commands/context.ts`; `table` from
  `src/cli/commands/format.ts`; `registerCommand` from `src/cli/commands/registry.ts`.
- Produces: `mycontext todo [--tag <t>] [--all] [--limit <n>]` and `/mycontext:todo`. Nothing else
  in this plan consumes it.

**Why a command rather than a widened queue.** §6m.9. `reviewQueue` is
`status === 'draft' && layer === 'project'` and is the single definition four surfaces read; a
rationale item is never forced to `draft`, so a `todo` could never appear there however the queue
were widened. An inbox and a draft queue answer different questions — *"what did I jot down"*
against *"what am I being asked to let govern"*.

**`search --type todo` already works and this task adds nothing for it.** `core/search.ts` · `export interface ItemFilters {` · ~25 filters on `type` exactly, and
`core/search.ts` · `function searchableText(item: Item): string {` · ~60 already reads observations
and `extra`. The test below asserts it rather than the plan claiming it.

- [ ] **Step 1: Write the failing test**

```ts
// test/cli/todo.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCli } from '../../src/cli/index.ts';
import { withWorkspace } from '../helpers/workspace.ts';   // establish the real helper name by
                                                           // reading test/helpers/workspace.ts

test('`mycontext todo` lists todos and nothing else', () => {
  withWorkspace((dir) => {
    const out: string[] = [];
    runCli(['add', 'todo', 'Retry the dispatcher on 5xx', '--yes'], dir, (s) => out.push(s));
    runCli(['add', 'note', 'Seed script leaves orphaned carts', '--yes'], dir, (s) => out.push(s));
    runCli(['add', 'decision', 'Use Postgres', '--yes'], dir, (s) => out.push(s));

    const lines: string[] = [];
    const code = runCli(['todo'], dir, (s) => lines.push(s));
    const text = lines.join('\n');
    assert.equal(code, 0);
    assert.match(text, /TODO-retry-the-dispatcher-on-5xx/);
    assert.doesNotMatch(text, /NOTE-/);
    assert.doesNotMatch(text, /DEC-/);
  });
});

test('`mycontext todo` says what a todo is NOT, in the same output', () => {
  withWorkspace((dir) => {
    const lines: string[] = [];
    runCli(['add', 'todo', 'Retry the dispatcher on 5xx', '--yes'], dir, () => {});
    runCli(['todo'], dir, (s) => lines.push(s));
    const text = lines.join('\n');
    // A guarantee claim carries its condition in the same sentence, and the
    // condition here is the one a reader will otherwise get wrong: a todo is
    // never injected and is NOT in the review queue.
    assert.match(text, /never injected/);
    assert.match(text, /review queue/);
  });
});

test('an empty inbox says so rather than printing an empty table', () => {
  withWorkspace((dir) => {
    const lines: string[] = [];
    const code = runCli(['todo'], dir, (s) => lines.push(s));
    assert.equal(code, 0);
    assert.match(lines.join('\n'), /no todo items/i);
  });
});

test('--tag narrows, and an unknown flag is refused rather than absorbed', () => {
  withWorkspace((dir) => {
    runCli(['add', 'todo', 'Retry the dispatcher', '--tags', 'billing', '--yes'], dir, () => {});
    runCli(['add', 'todo', 'Rename the config key', '--yes'], dir, () => {});

    const kept: string[] = [];
    runCli(['todo', '--tag', 'billing'], dir, (s) => kept.push(s));
    assert.match(kept.join('\n'), /Retry the dispatcher/);
    assert.doesNotMatch(kept.join('\n'), /Rename the config key/);

    const bad: string[] = [];
    assert.equal(runCli(['todo', '--tags', 'billing'], dir, (s) => bad.push(s)), 1);
    assert.match(bad.join('\n'), /unknown option "--tags"/);
  });
});

test('retired todos are hidden by default and shown with --all, with the count disclosed', () => {
  withWorkspace((dir) => {
    runCli(['add', 'todo', 'Retry the dispatcher', '--yes'], dir, () => {});
    runCli(['edit', 'TODO-retry-the-dispatcher', '--status', 'deprecated', '--yes'], dir, () => {});

    const shown: string[] = [];
    runCli(['todo'], dir, (s) => shown.push(s));
    // INV-nothing-is-dropped-silently: hidden is fine, unmentioned is not.
    assert.match(shown.join('\n'), /1 retired/);

    const all: string[] = [];
    runCli(['todo', '--all'], dir, (s) => all.push(s));
    assert.match(all.join('\n'), /TODO-retry-the-dispatcher/);
  });
});

test('`search --type todo` already answers the same question', () => {
  withWorkspace((dir) => {
    runCli(['add', 'todo', 'Retry the dispatcher on 5xx', '--yes'], dir, () => {});
    const lines: string[] = [];
    assert.equal(runCli(['search', '--type', 'todo'], dir, (s) => lines.push(s)), 0);
    assert.match(lines.join('\n'), /TODO-retry-the-dispatcher-on-5xx/);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/cli/todo.test.ts`
Expected: FAIL — `mycontext todo` is not a command. (The last test, `search --type todo`, passes
already; that is the point of including it.)

- [ ] **Step 3: Write the command**

`src/cli/commands/todo.ts`, modelled on `src/cli/commands/search.ts` for flag handling and on
`src/cli/commands/lesson.ts` for workspace/context handling:

- Flags: `--tag <t>` (single value), `--all` (bare), `--limit <n>` (default 50). Anything else is
  refused by name through the same `unknownFlag` route `add` uses — a flag accepted and ignored is
  the failure this project rules out.
- Selection: `filterItems(ctx.store.all(), { type: 'todo', tag }, ctx.config)`, then `layer` is not
  filtered (a global-layer todo is still yours to read), then `status === 'active'` unless `--all`.
- Output: `table(['id', 'status', 'tags', 'title'], …)`, sorted by id.
- **Two disclosure lines, always printed, both carrying their condition:**
  - `"todo is on the rationale tier: never injected, not named in the session index, and not in the review queue — a rationale item is never forced to draft. \`mycontext inbox-promote <id> --to <category>\` is how one leaves the inbox."`
  - when items were hidden: `"N retired (deprecated/superseded/validated) — \`mycontext todo --all\` shows them."`
- Empty: `"my_context: no todo items."` plus the tier line, and exit 0. An empty inbox is not an
  error.
- `emitLoadErrors(errors, out)` at the end, exit 0 on an unrelated load error, following
  `cli/commands/lesson.ts` · `    if (lesson && lesson.type !== 'lesson') {` · ~48's sibling
  reasoning: this command did what it was asked.

Register it, and add `import './todo.ts';` wherever `src/cli/index.ts` imports the other command
modules (establish the exact line by reading the import block — do not guess it).

- [ ] **Step 4: The slash command**

In `src/plugin/commands.ts`'s `genericCommands()` array, add a `todo.md` entry beside the existing
generic ones, with `disable-model-invocation: true` like its siblings, whose body runs
`mycontext todo $ARGUMENTS` and tells the agent to print the list and stop — an inbox is for a
human to triage, and an agent that promotes from it unasked is doing the thing §1.3's "promotion is
not laundering" exists to prevent.

Then add `'todo.md'` to `test/plugin/commands.test.ts` · `const GENERIC = [` · ~129, and run
`npm run gen:commands`.

- [ ] **Step 5: Both READMEs**

Two obligations, both enforced:

1. `test/docs/inventory.test.ts` requires every CLI command to be named in `README.md`. Document
   `mycontext todo` where the other read commands are documented, in **both** documents.
2. `test/docs/counts.test.ts` compares the §5 enumeration of non-per-category slash commands as a
   **set**, not a count. Add `` `todo` `` to that enumeration in both documents and move the count
   `23` → `24` and the total `71` → `72`.

`src/plugin/parity.ts` needs no change: `todo` has a slash counterpart, and it answers no MCP tool.

- [ ] **Step 6: Run the suite and see it pass**

Run: `npm test && npx tsc --noEmit && git status --porcelain`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(cli): mycontext todo, the inbox listing surface"
```

---

## Task 4: `mycontext inbox-promote` — the way out of the inbox

**Files:**
- Create: `src/cli/commands/inbox-promote.ts`
- Modify: `src/cli/index.ts`, `src/plugin/commands.ts`, `README.md`, `docs/README.he.md`
- Modify (tests): `test/plugin/commands.test.ts` (`GENERIC`)
- Create (generated): `commands/inbox-promote.md`
- Test: `test/cli/inbox-promote.test.ts`

**Interfaces:**
- Consumes: `createItem` and `updateItem` from `src/core/mutate.ts`; the `todo`/`note` categories.
- Produces: `mycontext inbox-promote <id> --to <category> [--title <text>] [--yes]` and
  `/mycontext:inbox-promote`.

**The name.** Not `promote`: `/mycontext:promote` already exists and means `mycontext review
promote` — promoting a *draft* so it governs. Two commands called `promote` meaning different things
is the second-spelling defect this document names four times. "Inbox" is §1.2's own noun.

**Exactly what it does, in order:**

1. Resolve `<id>`. If it does not exist, or its `type` is neither `todo` nor `note`, refuse by name
   — the shape `cli/commands/lesson.ts` · `    if (lesson && lesson.type !== 'lesson') {` · ~48
   already uses.
2. Refuse `--to todo` and `--to note`: a promotion that stays in the inbox is not one.
3. Create the target with `createItem`, carrying:
   - `type` = `--to`, validated by `resolveCategory`'s own `enumError` (unknown or disabled
     categories fail there, in one place, with the real message),
   - `title` = `--title` if given, else the origin's title,
   - `body` = the origin's body,
   - `tags` = the origin's tags,
   - `relations: [{ type: 'derived_from', target: origin.id }]` — §6i.5 rules the type, and the
     **direction is on the new item pointing back**, because `derived_from` on the target reads
     *"`DEC-x` derived from `NOTE-y`"*, which is the true sentence,
   - `origin` = **the origin item's `origin`, carried forward unchanged.**
4. `updateItem({ id: origin.id, status: 'deprecated', origin: 'human' })`.
5. Print what landed, including the target's **actual** status and why.

**Why step 3's origin is carried forward and not set to `'human'`.** §1.3: *"The trust boundary
applies unchanged on arrival: promoting into a normative category produces the same draft an
agent-authored normative item produces. Promotion is not laundering."* Carrying the origin forward
is what implements that sentence **with no new code at all**: `trustedStatus` sees `'agent'`, the
category is normative, and the target lands `draft`. A human's own note promoted to a `rule` lands
`active`, which is the same thing `mycontext add rule` does and is consistent with the CLI being the
user everywhere else in this product. **Recorded as an interpretation:** §1.3 can also be read as
"always a draft", and this plan chose the reading that needs no exception inside `trustedStatus` —
the function whose whole value is having none.

- [ ] **Step 1: Write the failing test**

```ts
// test/cli/inbox-promote.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCli } from '../../src/cli/index.ts';
import { withWorkspace } from '../helpers/workspace.ts';

test('a note promoted to a decision creates the decision and links back with derived_from', () => {
  withWorkspace((dir) => {
    runCli(['add', 'note', 'Maybe we should pin the pool size', '--yes'], dir, () => {});
    const out: string[] = [];
    const code = runCli(
      ['inbox-promote', 'NOTE-maybe-we-should-pin-the-pool-size', '--to', 'decision', '--yes'],
      dir, (s) => out.push(s),
    );
    assert.equal(code, 0);

    const shown: string[] = [];
    runCli(['show', 'DEC-maybe-we-should-pin-the-pool-size'], dir, (s) => shown.push(s));
    assert.match(shown.join('\n'), /derived_from/);
    assert.match(shown.join('\n'), /NOTE-maybe-we-should-pin-the-pool-size/);
  });
});

test('the origin is marked resolved, not deleted, and stays counted', () => {
  withWorkspace((dir) => {
    runCli(['add', 'note', 'Maybe we should pin the pool size', '--yes'], dir, () => {});
    runCli(['inbox-promote', 'NOTE-maybe-we-should-pin-the-pool-size',
      '--to', 'decision', '--yes'], dir, () => {});

    const shown: string[] = [];
    assert.equal(
      runCli(['show', 'NOTE-maybe-we-should-pin-the-pool-size'], dir, (s) => shown.push(s)), 0,
      'the origin must still exist — §1.3 marks it resolved rather than deleting it',
    );
    assert.match(shown.join('\n'), /deprecated/);
  });
});

test('an agent-authored note promoted into a normative category lands as a draft', () => {
  withWorkspace((dir) => {
    // Authored through the MCP write path, which hardcodes origin: 'agent'.
    // Establish the exact helper by reading test/mcp/*.test.ts; the assertion
    // is what matters and must not be weakened to a CLI-authored note.
    createAgentNote(dir, 'The retry loop swallows 5xx');
    runCli(['inbox-promote', 'NOTE-the-retry-loop-swallows-5xx',
      '--to', 'known_issue', '--yes'], dir, () => {});
    const shown: string[] = [];
    runCli(['show', 'KNOWN-the-retry-loop-swallows-5xx'], dir, (s) => shown.push(s));
    assert.match(shown.join('\n'), /draft/,
      'promotion is not laundering: trustedStatus must still see a non-human origin');
  });
});

test('promoting into todo or note is refused', () => {
  withWorkspace((dir) => {
    runCli(['add', 'note', 'Something', '--yes'], dir, () => {});
    const out: string[] = [];
    assert.equal(
      runCli(['inbox-promote', 'NOTE-something', '--to', 'todo', '--yes'], dir, (s) => out.push(s)),
      1,
    );
    assert.match(out.join('\n'), /stays in the inbox/i);
  });
});

test('promoting an item that is not a todo or a note is refused by name', () => {
  withWorkspace((dir) => {
    runCli(['add', 'decision', 'Use Postgres', '--yes'], dir, () => {});
    const out: string[] = [];
    assert.equal(
      runCli(['inbox-promote', 'DEC-use-postgres', '--to', 'adr', '--yes'], dir, (s) => out.push(s)),
      1,
    );
    assert.match(out.join('\n'), /is a decision, not a todo or a note/);
  });
});

test('an unknown target category fails once, with the catalogue named', () => {
  withWorkspace((dir) => {
    runCli(['add', 'note', 'Something', '--yes'], dir, () => {});
    const out: string[] = [];
    assert.equal(
      runCli(['inbox-promote', 'NOTE-something', '--to', 'nonsense', '--yes'], dir,
        (s) => out.push(s)),
      1,
    );
    assert.match(out.join('\n'), /nonsense/);
    assert.match(out.join('\n'), /decision/);   // the enum error lists the real categories
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/cli/inbox-promote.test.ts` → FAIL, no such command.

- [ ] **Step 3: Write the command**

Follow `src/cli/commands/supersede.ts` for the confirmation/`--yes` shape and
`src/cli/commands/lesson.ts` for context handling. Two details that are easy to get wrong:

- **Both writes are one human act, and a half-completed promotion is worse than none.** Create the
  target first; only if that succeeds, deprecate the origin. If the deprecation throws, the message
  must say the target exists and name the one command that finishes the job
  (`mycontext edit <origin> --status deprecated`) — nothing is left in a state the user was not
  told about.
- **The success message states the target's real status and the reason.** For a `draft` outcome say
  it landed a draft because a non-human origin authored the content, and name
  `mycontext review promote <id>`. `core/mutate.ts` · `  const status: Status = trustedStatus(origin, category.tier, input.status ?? 'active');` · ~272
  already appends the standard explanation to `createItem`'s own message; print that message rather
  than composing a second one.

- [ ] **Step 4: Slash command, GENERIC list, both READMEs**

Same three obligations as Task 3, step by step: a `inbox-promote.md` entry in `genericCommands()`;
`'inbox-promote.md'` added to `test/plugin/commands.test.ts` · `const GENERIC = [` · ~129;
`npm run gen:commands`; the command named in `README.md` (inventory) and added to the
non-per-category **enumeration set** in both documents with the counts moved `24` → `25` and
`72` → `73`.

**In the same edit, disambiguate the two `promote`s in both READMEs**, because two commands with
that word is exactly the confusion a reader will otherwise resolve wrongly: `review promote` moves a
**draft** into governing; `inbox-promote` moves a **capture** into a real category.

- [ ] **Step 5: Full gate and commit**

```bash
npm test && npx tsc --noEmit && git status --porcelain
git add -A
git commit -m "feat(cli): mycontext inbox-promote — a todo or note becomes a real item, linked back"
```

---

## Task 5: `Item.steps` — the `## Steps` file-format change

**Files:**
- Modify: `src/core/types.ts`, `src/core/item.ts`, `src/core/content-hash.ts`,
  `src/core/validate.ts`, `src/core/revision.ts` (comment only), `src/help/index.ts`
  (the `Item` literal)
- Modify (tests): every hand-rolled `item()` / `makeItem()` factory under `test/`
- Create: `test/core/steps.test.ts`, `test/fixtures/procedure-with-steps.md`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export interface Step { text: string; checked: boolean }` in `src/core/types.ts`
  - `steps: Step[]` on `Item`, positioned immediately **before** `observations`
  - `export function validateStepText(text: string, where: string): void` in `src/core/validate.ts`
  - Tasks 6, 7, 9 and 10 consume all three.

**Why this is a file-format change and not a parser reuse.** `validate.ts` · `export function validateBody(body: string): void {` · ~234 refuses any body line starting with a
Markdown heading, with the comment at `validate.ts` · `const HEADING_LINE = /^#{1,6}\s/;` · ~217
saying that changing the file format is a much larger decision than the guard. So `## Steps` cannot
live in `body` at all. And an unrecognised section is not merely unread: `splitSections` collects it
(`item.ts` · `function splitSections(body: string): { prose: string; sections: Map<string, string[]> } {` · ~102)
and `parseItem` read only two of them when this was written (`item.ts` · `    observations: parseObservations(sections.get('observations') ?? []),` · ~207)
— **`steps` is the third since this task executed** — so a `## Steps` block written before that was
**destroyed on the next `persist()`**. §6m's controller
ruling on F6: *"Sized as a parser change it will be discovered as a format change."*

**Two decisions this task fixes, both load-bearing:**

**(a) The parser is strict, and a malformed step line fails the item rather than being skipped.**
`STEP` accepts exactly `- [ ] text` and `- [x] text`, lower-case `x` only, with no `/i` flag. Any
other non-blank line inside `## Steps` throws. `loadLayer` catches a `parseItem` throw per file
(`rebuild.ts` · `      item = parseItem(readFileSync(file, 'utf8'), rel, layer);` · ~119) and records
a `LoadError`, so the item is reported, not silently emptied — which is the treatment every other
unparseable item file already gets. **Rejected alternative, recorded so it is not re-litigated:**
storing the raw marker character (`{ text, mark }`) would let `- [X]` round-trip too, but a bare
`- do the thing` inside `## Steps` still cannot round-trip into a `Step`, so a parse error is needed
regardless; a second field to rescue one narrow spelling is not worth carrying in the model.

**(b) `steps` enters `computeItemChecksum` ONLY when the item has any, and the key sits between
`body` and `observations`. This is now the spec's own ruling, not just this plan's:** §6n.4 decides
it in as many words — `...(item.steps.length ? { steps: item.steps } : {})` — and adds the warning
that making the key unconditional later is a one-character change that silently invalidates the
recorded checksum of every item in every corpus in existence. **The condition is load-bearing and
must be commented as such.** The reasoning below was written before §6n.4 and is kept because it is
the executable half: it names the two tests that catch a regression.
`computeItemChecksum` hashes `JSON.stringify` of a fixed-order object,
so adding a key unconditionally changes the checksum of **every item in every existing corpus**.
This is not hypothetical: `test/core/corpus-checksums.test.ts` · `const MY_CONTEXT_ROOT = path.join(REPO_ROOT, '.my_context');` · ~22 hashes this repository's own
committed corpus and asserts every recorded checksum still matches, and
`rebuild.ts` · `      const expected = computeItemChecksum(item);` · ~157 turns any disagreement into
a `checksum mismatch` LoadError. An unconditional key would therefore (i) fail the suite immediately,
and (ii) if shipped, redden every user's `doctor` at once and destroy the one signal
`cli/commands/repair.ts` · `    .filter((i) => i.checksum !== '' && computeItemChecksum(i) !== i.checksum)` · ~32
exists to preserve — the stale checksum that is the only remaining evidence a file was altered.
Conditional inclusion makes a stepless item hash exactly as it does today, by construction.

`itemContentHash` is different and takes `steps` **unconditionally**: it is never persisted (it is
recomputed on both sides of every `createItem` dedupe — `mutate.ts` · `    if (itemContentHash(item) === hash) return { duplicate: item, base, nextN: n };` · ~153), so
there is nothing to go stale. Omitting it would make two procedures differing only in their steps
dedupe onto each other.

- [ ] **Step 1: Write the failing test**

```ts
// test/core/steps.test.ts
/**
 * `## Steps` as a first-class Item field.
 *
 * The two invariants this file exists to hold, and they pull against each
 * other, which is why the assertions come in pairs:
 *
 *  - INV-markdown-is-the-source-of-truth: `renderItem(parseItem(f)) === f`,
 *    byte for byte, over a RAW fixture rather than one this code produced.
 *  - INV-nothing-is-dropped-silently: a line inside `## Steps` that is not a
 *    checkbox is REPORTED, never skipped. Skipping it is the exact failure
 *    mode an unrecognised `##` section already has today — parsed into the
 *    section map, read by nobody, destroyed on the next persist().
 *
 * What this test cannot do: prove that no OTHER `##` section is still
 * silently discarded. `## Steps` is now read; a `## Notes` section is not,
 * and still round-trips to nothing. That is unchanged by this task and is
 * named here so a green file is not mistaken for a general guarantee.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { computeItemChecksum, parseItem, renderItem } from '../../src/core/item.ts';
import { itemContentHash } from '../../src/core/content-hash.ts';
import { validateStepText } from '../../src/core/validate.ts';

const FIXTURE = path.join(import.meta.dirname, '..', 'fixtures', 'procedure-with-steps.md');
const REL = 'items/procedure/PROC-rotate-the-stripe-webhook-secret.md';

test('a `## Steps` section parses into steps, in file order', () => {
  const item = parseItem(readFileSync(FIXTURE, 'utf8'), REL, 'project');
  assert.deepEqual(item.steps, [
    { text: 'Deploy STRIPE_WEBHOOK_SECRET_NEXT beside the live secret; accept both.', checked: false },
    { text: 'Roll the endpoint secret in Stripe.', checked: false },
    { text: 'Promote NEXT to STRIPE_WEBHOOK_SECRET, drop NEXT, deploy again.', checked: false },
  ]);
});

test('the raw fixture round-trips byte for byte', () => {
  const raw = readFileSync(FIXTURE, 'utf8');
  assert.equal(renderItem(parseItem(raw, REL, 'project')), raw);
});

test('a hand-ticked box round-trips as ticked — the file is the source of truth', () => {
  const raw = readFileSync(FIXTURE, 'utf8').replace('- [ ] Roll', '- [x] Roll');
  const item = parseItem(raw, REL, 'project');
  assert.equal(item.steps[1]!.checked, true);
  assert.equal(renderItem(item), raw);
});

test('`## Steps` renders before `## Observations`, always', () => {
  const raw = readFileSync(FIXTURE, 'utf8');
  const rendered = renderItem(parseItem(raw, REL, 'project'));
  assert.ok(rendered.indexOf('## Steps') < rendered.indexOf('## Observations'));
});

test('a non-checkbox line inside `## Steps` fails the item and names the line', () => {
  const raw = readFileSync(FIXTURE, 'utf8').replace('- [ ] Roll', '- Roll');
  assert.throws(() => parseItem(raw, REL, 'project'), /- Roll/);
});

test('an upper-case [X] is refused rather than silently rewritten to [x]', () => {
  const raw = readFileSync(FIXTURE, 'utf8').replace('- [ ] Roll', '- [X] Roll');
  assert.throws(() => parseItem(raw, REL, 'project'), /\[X\]/);
});

test('a stepless item hashes EXACTLY as it did before steps existed', () => {
  // The literal below is the checksum this repo records for the shipped
  // specimen today. If this assertion fails, `steps` entered
  // computeItemChecksum unconditionally and every corpus on earth just went
  // red — see test/core/corpus-checksums.test.ts.
  const raw = [
    '---', 'id: CONST-a', 'type: constraint', 'title: A', 'status: active',
    'severity: soft', 'always: false', 'origin: human', '---', '', '# A', '', 'Body.', '',
  ].join('\n');
  const item = parseItem(raw, 'items/constraint/CONST-a.md', 'project');
  assert.deepEqual(item.steps, []);
  // Establish the expected value by running this once against the PRE-change
  // implementation and pasting it in; do not compute it from the new code.
  assert.equal(computeItemChecksum(item), STEPLESS_CHECKSUM);
});

test('two procedures differing only in their steps do not dedupe onto each other', () => {
  const a = parseItem(readFileSync(FIXTURE, 'utf8'), REL, 'project');
  const b = { ...a, steps: [...a.steps.slice(0, 2)] };
  assert.notEqual(itemContentHash(a), itemContentHash(b));
});

test('validateStepText refuses what would corrupt the line, and permits what would not', () => {
  assert.throws(() => validateStepText('two\nlines', 'a step'), /line break/);
  assert.throws(() => validateStepText('   ', 'a step'), /empty/);
  // `#` is NOT refused: unlike an observation, a step line has no tag grammar,
  // so a step reading `bump the #2 replica` survives the round trip intact.
  assert.doesNotThrow(() => validateStepText('bump the #2 replica', 'a step'));
});
```

Write `test/fixtures/procedure-with-steps.md` by hand — **not** by rendering it — with frontmatter, a
title heading, a prose body, a `## Steps` section of three unchecked lines, a `## Observations`
section and a `## Relations` section, in that order, and a `checksum:` value you compute once and
paste. A fixture generated by the code under test proves only that the code agrees with itself.

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/core/steps.test.ts` → FAIL: no `steps` on `Item`, no `validateStepText`.

- [ ] **Step 3: The type**

`src/core/types.ts`, beside `Observation` (`types.ts` · `export interface Item {` · ~33):

```ts
/**
 * One line of a `## Steps` section.
 *
 * The field is on `Item` rather than on one category, because `parseItem` is
 * handed a file and a layer and never a `Config` — it cannot know what type
 * it is reading until it has read it. `procedure` is the category the
 * product documents, seeds and commands around steps (spec §6o); nothing
 * refuses them elsewhere.
 *
 * `checked` exists because Markdown is the source of truth and a person may
 * tick a box in the file by hand; it round-trips so that doing so is not
 * destroyed by the next write. **Nothing in this product ever sets it.**
 * Progress made through `mycontext procedure step` is recorded in the audit
 * log and never in the item — spec §6m.3, which §6o attaches to `procedure`
 * — so the file on disk does not move when somebody makes progress,
 * `checksum` stays stable, and `UPDATE_FIELD_POLICY` (trust.ts) is never
 * asked to classify a third kind of field.
 */
export interface Step {
  text: string;
  checked: boolean;
}
```

and `steps: Step[];` on `Item`, immediately before `observations`, with a one-line comment saying
it is create-only.

**Adding a required field to `Item` is a compile error at every construction site, and that is the
point.** Roughly 19 hand-rolled `function item(over: Partial<Item> = {}): Item` factories under
`test/`, plus `src/help/index.ts` · `  const item: Item = {` · ~463. Add `steps: []` to each; `tsc`
enumerates them, so nothing has to be remembered.

- [ ] **Step 4: Parse and render**

`src/core/item.ts`:

```ts
const STEP = /^-\s+\[([ x])\]\s+(.*)$/;
```

**No `/i` flag, deliberately, and the two reasons are different from `OBSERVATION`'s.** `OBSERVATION`
carries `/i` because it must parse files this product already wrote with mixed-case categories, and
it lower-cases what it captures. A step marker has no such history and no such normalisation: if
`[X]` matched, `renderStep` would write `[x]` back and the file would not round-trip. The two regexes
also overlap — `- [x] foo` matches `OBSERVATION` with category `x` — which is harmless while they
live in different sections and **must not be resolved by widening either one**.

```ts
function parseSteps(lines: string[]): Step[] {
  const out: Step[] = [];
  for (const line of lines) {
    const raw = line.trimEnd();
    if (raw.trim() === '') continue;
    const m = STEP.exec(raw);
    if (m === null) {
      throw new Error(
        `my_context: the line ${JSON.stringify(raw)} is inside a "## Steps" section but is ` +
        `not a step. A step is written "- [ ] text" (or "- [x] text" once done), with a ` +
        `lower-case x. This line is refused rather than skipped, because a skipped line is ` +
        `deleted the next time this item is written back. Fix the line, or move it into the ` +
        `body above the first "## " section.`,
      );
    }
    out.push({ text: m[2]!, checked: m[1] === 'x' });
  }
  return out;
}

function renderStep(s: Step): string {
  return `- [${s.checked ? 'x' : ' '}] ${s.text}`;
}
```

Wire it in `parseItem` immediately before `observations`
(`item.ts` · `    observations: parseObservations(sections.get('observations') ?? []),` · ~207):

```ts
    steps: parseSteps(sections.get('steps') ?? []),
```

and in `renderItem`, immediately **before** the observations block
(`item.ts` · `    parts.push('## Observations', ...item.observations.map(renderObservation), '');` · ~260):

```ts
  if (item.steps.length) {
    parts.push('## Steps', ...item.steps.map(renderStep), '');
  }
```

- [ ] **Step 5: The two hashes**

`computeItemChecksum` (`item.ts` · `export function computeItemChecksum(item: Item): string {` · ~215)
becomes a built object rather than a literal, so the key can be conditional. **Keep every existing
key in its existing order** — the hash is over `JSON.stringify`, so order is identity:

```ts
export function computeItemChecksum(item: Item): string {
  const shape: Record<string, unknown> = {
    id: item.id, type: item.type, title: item.title, status: item.status,
    severity: item.severity, always: item.always, scope: item.scope, tags: item.tags,
    origin: item.origin, extra: item.extra, body: item.body,
  };
  // Added ONLY when there are steps, and the reason is compatibility rather
  // than tidiness: this hash is RECORDED in every item's frontmatter, and an
  // unconditional key would change it for every item in every corpus at once
  // — reddening `doctor` everywhere and destroying the stale-checksum signal
  // that is the only evidence a file was ever altered outside my_context.
  // A stepless item therefore hashes byte-identically to how it hashed
  // before this field existed, by construction. Pinned by
  // test/core/steps.test.ts and by test/core/corpus-checksums.test.ts, which
  // hashes this repository's own committed corpus.
  if (item.steps.length > 0) shape.steps = item.steps;
  shape.observations = item.observations;
  shape.relations = item.relations;
  return checksum(JSON.stringify(shape));
}
```

`src/core/content-hash.ts`: add `steps: Step[]` to `ContentShape`
(`content-hash.ts` · `interface ContentShape {` · ~13), a `canonicalStep` beside `canonicalObservation`
(fixed key order, `{ text, checked }`), `steps: v.steps.map(canonicalStep)` in `hashContent` between
`body` and `observations`, and `steps: input.steps ?? []` in `contentHash`. **Unconditional here**,
with a comment saying why the two hashes differ: this one is never persisted.

- [ ] **Step 6: `validateStepText`, and `validateBody`'s message**

`src/core/validate.ts`, beside `validate.ts` · `export function validateObservationText(text: string, where: string): void {` · ~247:

```ts
export function validateStepText(text: string, where: string): void { … }
```

Refuse exactly two things, and say why in the message: a line break (the whole step line stops
matching `STEP` and the step disappears), and empty-or-whitespace-only text (it renders to a line
with trailing whitespace that does not round-trip). **Do not copy the observation rules for `#` or a
trailing parenthetical** — a step line has no tag grammar and no `context` field, so both are safe,
and a comment must say so or the next reader will "fix" the omission.

`validateBody` itself is **not** changed in behaviour — steps never enter `body`, so it is correct
exactly as written (§0). Its **message** gains one clause: a user pasting a whole procedure is refused
today with a message that offers only observations, and it must now also name
`mycontext add procedure --step "<text>"`.

- [ ] **Step 7: Record that `steps` is not stageable**

`src/core/revision-log.ts` · `export const REVISION_FIELDS = ['title', 'body', 'tags', 'extra'] as const;` · ~291
does not change (web-UI plan 2 Task 1 moved it there from `revision.ts`, which re-exports it); add to the comment above it that `steps` is deliberately absent for the same reason
`observations` is — it is create-only and never appears in `UpdateInput`, so there is nothing for a
revision to carry. Add an assertion to `test/core/steps.test.ts`:

```ts
test('steps is create-only, so the field-policy table is never asked about it', () => {
  assert.ok(!(REVISION_FIELDS as readonly string[]).includes('steps'));
  // UpdateInput has no `steps`; this is what keeps UPDATE_FIELD_POLICY's four
  // Assert<> types compiling untouched (spec §6m.3).
  const update: UpdateInput = { id: 'PROC-x' };
  assert.ok(!Object.hasOwn(update, 'steps'));
});
```

- [ ] **Step 8: Run the suite and see it pass**

Run: `npm test && npx tsc --noEmit`
`test/core/corpus-checksums.test.ts` staying green is the load-bearing result of this task — it is
the executable proof that no existing corpus moved.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(items): ## Steps as a first-class Item field, round-tripped and hashed"
```

---

## Task 6: `renderItemBlock` emits steps, and budgeting follows for free

**Files:**
- Modify: `src/core/render-item.ts`
- Test: `test/core/steps-injection.test.ts` (create)

**Interfaces:**
- Consumes: `Item.steps` (Task 5).
- Produces: nothing new; it changes what `renderItemBlock` returns, which Task 9 and every injection
  path consume.

**Why this is its own task and marked high-risk.** `select.ts` · `function itemCost(item: Item): number {` · ~119 derives cost from exactly this text, so emitting
steps makes the budget correct **with no second change** — and *not* emitting them would make an
`active` procedure inject without the content it exists to deliver **and** under-count its budget, so
the failure is silent in both directions at once.

**And injection carries no progress.** The block is the stored steps and nothing else. Progress is a
display concern of `mycontext procedure show` (Task 9). Anything else would make two sessions receive
different text for the same item, which no budget and no ledger could then describe.

- [ ] **Step 1: Write the failing test**

```ts
// test/core/steps-injection.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderItemBlock } from '../../src/core/render-item.ts';
import { estimateTokens } from '../../src/core/select.ts';

const PROCEDURE = { /* a full Item literal with three steps, one observation and a scope */ };

test('the injected block carries the steps, in order, as checkbox lines', () => {
  const text = renderItemBlock(PROCEDURE);
  assert.match(text, /- \[ \] Deploy STRIPE_WEBHOOK_SECRET_NEXT/);
  assert.ok(text.indexOf('Deploy') < text.indexOf('Roll the endpoint'));
});

test('steps come before observations in the block, as they do in the file', () => {
  const text = renderItemBlock(PROCEDURE);
  assert.ok(text.indexOf('- [ ] Deploy') < text.indexOf('- [limit]'));
});

test('the block never shows progress — an injected procedure is the same text in every session', () => {
  assert.doesNotMatch(renderItemBlock(PROCEDURE), /\d+ of \d+/);
});

test('the budget charges for the steps, because cost is derived from this exact text', () => {
  const withSteps = estimateTokens(renderItemBlock(PROCEDURE));
  const without = estimateTokens(renderItemBlock({ ...PROCEDURE, steps: [] }));
  assert.ok(withSteps > without,
    'itemCost reads renderItemBlock; if the block omits steps the selector under-counts a ' +
    'procedure and admits it to a tier it does not fit');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/core/steps-injection.test.ts` → FAIL: the block contains no step lines.

- [ ] **Step 3: Emit the steps**

`src/core/render-item.ts` · `export function renderItemBlock(item: Item): string {` · ~172 — insert a
steps block **between the body and the observations**, mirroring the file's own order, and add a
comment recording that `itemCost` (select.ts) budgets against this exact string so anything added
here is charged for and anything omitted is not.

- [ ] **Step 4: Full gate**

Run: `npm test && npx tsc --noEmit && npm run test:perf`
`test:perf` matters here: the block is on the hook path.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(injection): an injected procedure carries its steps, and the budget charges for them"
```

---

## Task 7: The write surfaces for steps — `add --step`, `create_item`, ingest

**Files:**
- Modify: `src/core/mutate.ts` (`CreateInput.steps` + normalisation), `src/cli/index.ts`
  (`--step` on `add`), `src/mcp/tools.ts` (`create_item`), `src/ingest/schema.ts`
- Test: extend `test/core/steps.test.ts`; add cases to the existing CLI-add and MCP-create suites
  (establish their filenames by reading `test/core/mutate-create.test.ts` and `test/mcp/`)

**Interfaces:**
- Consumes: Task 5.
- Produces: `steps?: string[]` on `CreateInput`; `mycontext add procedure "<title>" --step "<text>"`
  (repeatable); `create_item{steps: string[]}`. Task 10's seed and Task 9's `procedure show` consume
  the result.

**Every write surface takes `string[]`, never `Step[]`.** A caller cannot set `checked`, so
"nothing in this product ever writes `checked: true`" is true **by construction at the boundary**
rather than by convention — which is the difference between a property and a hope. A box is ticked
only by a human editing the Markdown.

**And every write surface accepts steps on any category, `runbook` included.** Design decision 19:
§6o says `runbook` has no `## Steps` field, and this plan makes that documentary rather than
enforced — no category check is added to `createItem`, because there is no category-conditional
field rule anywhere in the product to follow (`observations`, `scope` and `tags` are accepted on
every category) and adding the first one is a larger decision than §6o took. What this task does
instead is make `procedure` the only category the *offer* is made for: `--step`'s help text, the
`create_item` schema description and the generated `add-procedure.md` all name `procedure` and say
what steps are for. **Reported as an under-specification**, and the direction of the risk is worth
naming: if the owner meant the refusal, adding it later breaks any corpus that took the offer.

- [ ] **Step 1: Write the failing tests**

```ts
test('`add --step` is repeatable and keeps command-line order', () => {
  withWorkspace((dir) => {
    runCli(['add', 'procedure', 'Rotate the webhook secret',
      '--step', 'Deploy the next secret beside the live one',
      '--step', 'Roll the endpoint secret',
      '--step', 'Promote and redeploy', '--yes'], dir, () => {});
    const item = readItem(dir, 'PROC-rotate-the-webhook-secret');
    assert.deepEqual(item.steps.map((s) => s.text), [
      'Deploy the next secret beside the live one',
      'Roll the endpoint secret',
      'Promote and redeploy',
    ]);
    assert.deepEqual(item.steps.map((s) => s.checked), [false, false, false]);
  });
});

test('a step is not comma-split — a step is a sentence and sentences contain commas', () => {
  withWorkspace((dir) => {
    runCli(['add', 'procedure', 'X', '--step', 'Stop the worker, then drain the queue', '--yes'],
      dir, () => {});
    assert.equal(readItem(dir, 'PROC-x').steps.length, 1);
  });
});

test('a step containing a line break is refused, and nothing is written', () => {
  withWorkspace((dir) => {
    const out: string[] = [];
    assert.equal(runCli(['add', 'procedure', 'X', '--step', 'a\nb', '--yes'], dir,
      (s) => out.push(s)), 1);
    assert.match(out.join('\n'), /line break/);
    assert.equal(runCli(['show', 'PROC-x'], dir, () => {}), 1);
  });
});

test('create_item accepts steps and they land unchecked', async () => {
  // through the real MCP registry, the surface the model actually uses
});

test('an ingest candidate carrying "steps" is refused by name, not accepted and ignored', () => {
  // INV-nothing-is-dropped-silently: the one unacceptable outcome is a
  // candidate that reports success with its steps dropped.
});
```

- [ ] **Step 2: `CreateInput.steps`**

`src/core/mutate.ts` · `export interface CreateInput {` · ~45 gains `steps?: string[];`. Normalise it
beside the existing observation normalisation into `{ text, checked: false }`, calling
`validateStepText` on each with a `where` naming the index (`steps[2]`), and pass the normalised
array to both `contentHash` and the item. **`UpdateInput` is not touched** — that is what keeps
`trust.ts` · `const UPDATE_FIELD_POLICY = {` · ~323 and its four `Assert<>` types compiling
unchanged (§6m.3), and it is the same shape `observations` already has.

- [ ] **Step 3: `mycontext add --step`**

`src/cli/index.ts`: add `'step'` to `ADD_VALUE_FLAGS`
(`cli/index.ts` · `const ADD_VALUE_FLAGS = ['body', 'file', 'note', 'scope', 'tags', 'severity', 'extra'];` · ~185), <!-- historical-citation: Task 7 step 3 quotes the pre-`step` flag list it replaces -->
add `[--step <text>]` to `ADD_USAGE`, and read it with `addValues(args, 'step')` — **every
occurrence in command-line order**, the same call `--note` uses, and explicitly *not* comma-split.

Two things the unknown-flag message must now say, because it currently claims more than will be
true: it names `create_item` as the only route for things `add` cannot express, and steps are no
longer one of them. And add, to `--step`'s own help text, three sentences: that it is **for
`procedure`** — an operation done once, where a repeatable one is a `runbook` and keeps its steps in
the body; that it is repeatable and keeps command-line order; and that **steps cannot be edited
afterwards through any command**, so correcting one means editing the Markdown and running
`mycontext repair`. Stating a limitation is cheaper than a user discovering it, and naming the
category here is the capture-time half of §6o's mitigation: `--step` is where an author who reached
for the wrong category finds out, if they are going to find out at all.

**Also update the `NOTE_CATEGORY` doc comment** (`cli/index.ts` · `const NOTE_CATEGORY = 'note';` · ~207):
after Task 2 there is an *item* category spelled `note`, and this constant is an *observation*
category spelled `note`. The parser cannot confuse them; a reader can. One sentence naming both
namespaces closes it (§0).

- [ ] **Step 4: `create_item`**

`src/mcp/tools.ts`, beside `mcp/tools.ts` · `      observations: {` · ~460:

```ts
      steps: {
        type: 'array',
        items: { ...S_STRING },
        description:
          'Ordered steps for a `procedure` — an operation performed once and then finished. ' +
          'Stored as "- [ ] text" lines; progress is never stored in the item. A repeatable ' +
          'sequence is a `runbook`, and it keeps its steps in the body.',
      },
```

and read it with an `optList`-style reader in the handler. Nothing about `checked` is exposed.

- [ ] **Step 5: Ingest — establish the current behaviour by executing, then decide in the open**

Run an `ingest-apply` with a candidate carrying a `"steps"` key and record what happens today
(`src/ingest/schema.ts` · `    name: 'observations', required: false, schema: {` · ~94 is the sibling
field). Two outcomes are possible and they need different work:

- if the entry validator already refuses unknown keys, **improve the message** to name
  `mycontext add procedure --step` and stop;
- if it silently ignores unknown keys, **add an explicit refusal** — a candidate whose steps are
  accepted and dropped is precisely `INV-nothing-is-dropped-silently`.

Either way the outcome is a refusal, not support: ingest builds candidates from prose, and a step
list inferred from prose is exactly the kind of normative content the trust boundary exists to keep
out of `items/` unreviewed. Record that sentence in the code.

- [ ] **Step 6: Full gate and commit**

```bash
npm test && npx tsc --noEmit && git status --porcelain
git add -A
git commit -m "feat(capture): steps on add, create_item, and an explicit refusal in ingest"
```

---

## Task 8: A sixth audit kind — step progress, recorded outside `items/`

**Files:**
- Modify: `src/core/audit.ts`, `src/core/jsonl-log.ts` (the accepted-protocol set, §6n.5)
- Create: `src/core/progress.ts`
- Test: `test/core/progress.test.ts`; extend `test/core/audit.test.ts` and the `jsonl-log` suite
  (establish its filename by reading `test/core/`)

**Interfaces:**
- Consumes: `recordAudit`, `readAudit`, `filterAudit` from `src/core/audit.ts`.
- Produces:
  - `AUDIT_PROTOCOL` at `'my_context/audit@2'`, with `@1` still readable (§6n.5)
  - `PROGRESS_OPS = ['step-done', 'step-undone', 'step-reset']` and `AuditKind` gaining `'progress'`
  - `export function procedureProgress(records: AuditRecord[], itemId: string): Set<number>` in
    `src/core/progress.ts`
  - `export function progressLine(done: Set<number>, total: number): string` — the "3 of 5" string,
    computed and never stored
  - Task 9 is the only consumer.

**Why a fifth kind and not a `MUTATION_OPS` member.** `core/audit.ts` · `export const MUTATION_OPS = [` · ~87 says `mutation` means "changed an item", and every op there
carries an `itemId` **because it moved that item's columns**. A step tick moves nothing: the item's
bytes, its `checksum` and its rendered injection are all identical before and after. Filing it under
`mutation` would make `mycontext audit --kind mutation --item PROC-x` a question with a wrong answer.
`core/audit.ts` · `export const FOCUS_OPS = ['focus-set', 'focus-clear'] as const;` · ~112 is the
precedent and states the rule: *"It is genuinely a fourth thing, so it is a fourth kind."* This is
the sixth — `access` took the fifth on 2026-08-20.

**Why the audit log and not session state.** §6g permits either, and one of the two is closed.
`mycontext procedure step` is a CLI command, and `core/focus.ts` · `// has a trustworthy session id: the CLI runs in a terminal and is handed none,` · ~25 records this
codebase measuring exactly that and conceding it — focus escaped to **workspace** scope. A
session-keyed progress file would be written under a key nothing reads. **The cost, which the
command discloses rather than hides: progress is per workspace, so two terminals working one procedure
share one record set.** That is unmeasured against the concurrency case R7 exists to serve, and it is
recorded here as a known limit rather than a claim.

**Why three ops and not one.** `step-done` alone has no reset boundary, so a procedure activated a
second time would inherit the first run's ticks — and a procedure is one-shot precisely so that "is
this finished" has an answer. `step-reset` is written by `procedure activate` (Task 9) and is the
replay anchor. `step-undone` exists because the log is append-only: without it the only way to
correct a mis-tick is a reset, which discards the whole run.

**One consequence that must be written down, not discovered.** `core/audit.ts` · `      if (typeof row.kind !== 'string' || !AUDIT_KINDS.includes(row.kind as AuditKind)) {` · ~288
refuses an unregistered kind and takes the whole segment with it. So **a log containing `progress`
records cannot be read by v1.0.2**, in this workspace or an imported one. That is §6l F11's finding
arriving for real. This plan does not make such a log readable — quarantine-on-import belongs to the
export/import plan, §6m.10, and downgrading stays unsupported, named in `CHANGELOG.md` (Task 12) as
a one-way step. What it **does** do, because §6n.5 rules it and this task is the reason §6n.5 exists,
is make the refusal say the true thing: *this log is newer than I am*, rather than blaming an op.
Step 3a.

**§6n.5, and what the code already provides.** The machinery is shipped and correctly ordered — this
was checked before it was scheduled. Every record already carries a version:
`core/audit.ts` · `export const AUDIT_PROTOCOL = 'my_context/audit@2';` · ~59, stamped by
`recordAudit`. And the reader checks it **before** it validates `kind` or `op`:
`core/jsonl-log.ts` · `    if (typeof row.protocol !== 'string' || !accepted.includes(row.protocol)) {` · ~227 throws with a message that
already ends *"(it may have been written by a different version)"*, and the field's own doc says a
mismatch is version skew rather than a torn write
(`core/jsonl-log.ts` · ``   * The value every line's `protocol` field must equal. A mismatch is refused`` · ~42).
So §6n.5 does not need a new mechanism; it needs this plan to stop shipping a **new vocabulary under
the old version number**, which is the whole of what makes v1.0.2 blame `progress`.

**And it needs one widening that is not optional.** `protocol` is compared with `!==` against a
single string, so bumping the constant alone would make v2.0 refuse **every existing user's `@1`
log** — a worse failure than the one being fixed, and one that hits on upgrade rather than on
downgrade. The reader must accept a set. Step 3a does both halves together or neither.

**Reported as an under-specification:** §6n.5 says *"a version per segment"*, and what ships is a
version **per line** — every record carries `protocol`, and `readAudit` reads segments as lines. This
plan keeps the per-line form, because a per-segment header would be a format change to the log
itself and would have no answer for a segment whose lines disagree. The behaviour §6n.5 asks for is
delivered either way, since the first line of a segment decides it.

- [ ] **Step 1: Write the failing test**

```ts
// test/core/progress.test.ts
/**
 * Step progress, replayed from the audit log.
 *
 * The property under test is that progress is DERIVED, never stored: there is
 * no "3" anywhere in the corpus, in the index, or in the item file. The
 * number is counted from records, exactly as the drafts count in the session
 * banner is counted from `reviewQueue` rather than kept as a tally.
 *
 * What this cannot check: that two terminals in one workspace get a sensible
 * answer. Progress is workspace-scoped because no CLI surface has a session
 * id (core/focus.ts), and the concurrent case is unmeasured — the CLI says so
 * in its own output rather than this test pretending to cover it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { procedureProgress, progressLine } from '../../src/core/progress.ts';
import type { AuditRecord } from '../../src/core/audit.ts';

const rec = (at: string, op: string, note: string): AuditRecord =>
  ({ protocol: '1', at, kind: 'progress', op, itemId: 'PROC-x', origin: 'human', note }) as AuditRecord;

test('done ticks accumulate, in log order', () => {
  const done = procedureProgress([
    rec('2026-08-20T10:00:00Z', 'step-reset', 'activated'),
    rec('2026-08-20T10:01:00Z', 'step-done', 'step 1'),
    rec('2026-08-20T10:02:00Z', 'step-done', 'step 3'),
  ], 'PROC-x');
  assert.deepEqual([...done].sort(), [1, 3]);
  assert.equal(progressLine(done, 5), '2 of 5');
});

test('step-undone removes exactly one step', () => {
  const done = procedureProgress([
    rec('2026-08-20T10:00:00Z', 'step-reset', 'activated'),
    rec('2026-08-20T10:01:00Z', 'step-done', 'step 1'),
    rec('2026-08-20T10:02:00Z', 'step-undone', 'step 1'),
  ], 'PROC-x');
  assert.deepEqual([...done], []);
});

test('step-reset is the replay anchor — a second activation starts clean', () => {
  const done = procedureProgress([
    rec('2026-08-20T10:00:00Z', 'step-reset', 'activated'),
    rec('2026-08-20T10:01:00Z', 'step-done', 'step 1'),
    rec('2026-08-20T10:02:00Z', 'step-done', 'step 2'),
    rec('2026-08-21T09:00:00Z', 'step-reset', 'activated'),
    rec('2026-08-21T09:05:00Z', 'step-done', 'step 1'),
  ], 'PROC-x');
  assert.deepEqual([...done], [1]);
});

test('records for another procedure are not counted', () => {
  const other = { ...rec('2026-08-20T10:01:00Z', 'step-done', 'step 1'), itemId: 'PROC-y' };
  assert.deepEqual([...procedureProgress([other], 'PROC-x')], []);
});

test('no records at all is zero of N — never "unknown" and never a crash', () => {
  assert.equal(progressLine(procedureProgress([], 'PROC-x'), 5), '0 of 5');
});
```

And in `test/core/audit.test.ts`, extend the existing totality checks (`AUDIT_OPS` unique, every op
has a kind) — they are already written as loops over `AUDIT_OPS`, so they cover the three new ops the
moment `KIND_OF` classifies them, and `KIND_OF`'s `Record<AuditOp, AuditKind>` type makes forgetting
one a compile error rather than a test failure. Add one explicit assertion:

```ts
test('every progress op is classified progress, and none is a mutation', () => {
  for (const op of PROGRESS_OPS) assert.equal(kindOf(op), 'progress');
  for (const op of PROGRESS_OPS) assert.ok(!(MUTATION_OPS as readonly string[]).includes(op));
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test test/core/progress.test.ts` → FAIL: no `src/core/progress.ts`.

- [ ] **Step 3: Register the kind and the ops**

`src/core/audit.ts`, five edits that must land together or `parseAudit` rejects what `recordAudit`
writes:

1. `AuditKind` gains `'progress'` as a SIXTH kind — `access` landed 2026-08-20 (`core/audit.ts` · `export type AuditKind = 'mutation' \| 'injection' \| 'hook' \| 'focus' \| 'access' \| 'progress';` · ~80),
   with a doc paragraph in the register the `focus` paragraph above it uses: what it means, and why
   it is not a `mutation`.
2. `export const PROGRESS_OPS = ['step-done', 'step-undone', 'step-reset'] as const;` and its type,
   beside `FOCUS_OPS`.
3. `AuditOp` gains `ProgressOp`.
4. `AUDIT_OPS` gains `...PROGRESS_OPS` (`core/audit.ts` · `export const AUDIT_OPS: AuditOp[] = [` · ~117).
5. `AUDIT_KINDS` gains `'progress'`, and `KIND_OF` gains the three rows.

`AuditRecord` does **not** change: a progress record uses `itemId` for the procedure, `origin` for who
ran the command, and `note` for the step (`step 3`) — the same non-content `note` a discard reason or
a SessionStart source uses. The CLI's `--kind` enum and the MCP tool's both derive from
`AUDIT_KINDS`, so they gain `progress` with no edit; assert that rather than assuming it.

- [ ] **Step 3a: The log declares its format version, and keeps reading the old one (§6n.5)**

**Both halves in one commit**, because either alone is a regression.

1. `core/audit.ts` · `export const AUDIT_PROTOCOL = 'my_context/audit@2';` · ~59 becomes
   `'my_context/audit@2'`. This is the value **written**, and the comment above it must say what the
   bump means: from `@2` a log may contain `progress` records, and a reader that does not know the
   kind should say so as version skew rather than as a bad op.
2. `src/core/jsonl-log.ts`: `JsonlLogSpec` gains an **accepted set** alongside the write value, and
   `core/jsonl-log.ts` · `    if (typeof row.protocol !== 'string' || !accepted.includes(row.protocol)) {` · ~227 tests membership instead
   of equality. Default it to `[spec.protocol]` so `focus.ts`, `revision.ts` and `seen-file.ts` —
   which pass one protocol each and must not change behaviour — are untouched by construction.
   `specFor` in `audit.ts` then accepts `['my_context/audit@1', 'my_context/audit@2']`.

**Why the widening is not optional, stated because skipping it looks harmless.** The check is strict
inequality and runs on every line. Bumping the constant without it makes v2.0 refuse **every log a
current user already has** — `@1` on every line — on the first command after upgrade, and the audit
log is the one file this product refuses to treat as empty when it cannot read it. That failure
lands on upgrade, which is universal, rather than on downgrade, which is rare and already
unsupported. The fix §6n.5 asks for would have shipped as a worse bug than the one it fixes.

Three assertions, and the third is the one §6n.5 is actually about:

```ts
test('a v1 log still reads after the bump', () => { /* @1 lines, every kind v1 knew */ });
test('a v2 log carrying progress records reads', () => { /* @2 lines, kind: progress */ });
test('an unknown FUTURE protocol is refused as version skew, naming no op', () => {
  // '@3' with a kind this build has never heard of.
  // The message must name the protocol and must NOT name the kind: blaming the
  // op is precisely the diagnosis §6n.5 exists to stop a reader from giving.
  assert.match(err.message, /protocol/);
  assert.doesNotMatch(err.message, /is not one of/);
});
```

- [ ] **Step 4: `src/core/progress.ts`**

One exported replay and one exported formatter, both pure — no I/O, so a caller supplies the records:

```ts
export function procedureProgress(records: AuditRecord[], itemId: string): Set<number> {
  const done = new Set<number>();
  for (const r of records) {
    if (r.kind !== 'progress' || r.itemId !== itemId) continue;
    if (r.op === 'step-reset') { done.clear(); continue; }
    const n = stepNumber(r.note);        // parses "step 3"; ignores a record it cannot read
    if (n === null) continue;
    if (r.op === 'step-done') done.add(n);
    if (r.op === 'step-undone') done.delete(n);
  }
  return done;
}
```

`readAudit` (`core/audit.ts` · `export function readAudit(root: string): AuditRecord[] {` · ~413)
returns every record across **every segment, oldest first**, so a `step-reset` that has since rotated
out of the live log is still found — no segment-window special case is needed and none should be
added.

The one case that needs a decision rather than a default: a `progress` record whose `note` this build
cannot parse is **skipped in the count and reported by the caller** — Task 9's `procedure show` prints
"N progress record(s) could not be read" when any were skipped. Counting them as done, or as not
done, would both be claims; saying how many were unreadable is the only honest option.

- [ ] **Step 5: Full gate and commit**

```bash
npm test && npx tsc --noEmit
git add -A
git commit -m "feat(audit): a progress kind, and audit@2 so an older reader blames the version"
```

---

## Task 9: `mycontext procedure` — list, show, activate, done, step

**Files:**
- Create: `src/cli/commands/procedure.ts`
- Modify: `src/cli/index.ts`, `src/plugin/commands.ts`, `README.md`, `docs/README.he.md`
- Modify (tests): `test/plugin/commands.test.ts` (`GENERIC`)
- Create (generated): `commands/procedure.md`
- Test: `test/cli/procedure.test.ts`

**Interfaces:**
- Consumes: `Item.steps` (Task 5), `procedureProgress`/`progressLine` (Task 8), `updateItem`,
  `readAudit`/`recordAudit`.
- Produces: `mycontext procedure list|show <id>|activate <id>|done <id>|step <id> <n> [--undo]` and
  `/mycontext:procedure`.

**This command exists for `procedure` and refuses every other category by name, `runbook`
included.** §6o: a runbook has no lifecycle because it is never finished, so `procedure activate` on
one is not a missing feature to be added later but a category error, and the refusal message is one
of the four places §6o requires the boundary to be statable (Task 10 pins the other three).

**The lifecycle this command implements, mapped onto what ships (§6m.2, attached to `procedure` by
§6o — nothing is added to `Status`):**

| Stage | Representation | What injects | Command |
|---|---|---|---|
| proposed | `status: draft` | nothing | `mycontext add procedure …` (an agent's lands here by `trustedStatus`) |
| ready | `status: draft` **+ tag `ready`** | **nothing, and not even an index line** | `mycontext edit <id> --tags …` |
| active | `status: active` **+ `always: true`** | the full block, every session | `mycontext procedure activate <id>` |
| done | `status: deprecated` | nothing; counted in `retired` | `mycontext procedure done <id>` |
| abandoned | `status: superseded` | nothing | `mycontext supersede <id> --by <id>` (unchanged, §6d) |

**Activation is two writes and this command makes them one act.** §2.1: `status: active` makes the
item *eligible*; `always: true` is what delivers it **in full** every session rather than as an index
line — "injected in full" is a property of the `always` flag and its tier membership, never of a
status. A command that set only the status would ship a procedure that is merely eligible: indexed, not
delivered, and silently not doing the one thing this lifecycle exists for. Both fields are guarded
(`trust.ts` · `export const GUARDED_FIELDS = {` · ~246 for `always`;
`mutate.ts` · `    input.status !== undefined && input.status !== item.status &&` · ~561 for
`status`), so a non-human caller can reach neither — §2.2's human-only gate is **already implemented
and this task adds no new gate**.

**`done` is `deprecated`, not `validated`.** `trust.ts` · `export function governsNormatively(ctx: MutationContext, item: Item): boolean {` · ~230 treats
`validated` as still governing, so a completed procedure filed there would keep its guarded-field
refusals switched on for the rest of its life. `deprecated` is in
`select.ts` · `const RETIRED_STATUSES = new Set(['superseded', 'deprecated', 'validated']);` · ~308,
so a finished procedure still appears in a session-visible number instead of vanishing from every tally.

**`ready` produces nothing today, and `list` says so.** `select.ts` · `export function isEligible(item: Item, config: Config): boolean {` · ~123 admits `active` only, and
`buildIndex` enumerates only eligible items — so a `ready` procedure reaches no index line. §2.1 forbids
building on "index line only" until that is decided, so this task builds nothing and **discloses**
instead. Silence here would be the `INV-nothing-is-dropped-silently` failure exactly.

- [x] **Step 1: Write the failing test**

```ts
// test/cli/procedure.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCli } from '../../src/cli/index.ts';
import { withWorkspace } from '../helpers/workspace.ts';

function seed(dir: string): void {
  runCli(['add', 'procedure', 'Rotate the webhook secret',
    '--body', 'Run this when the shared secret leaks.',
    '--step', 'Deploy the next secret beside the live one',
    '--step', 'Roll the endpoint secret',
    '--step', 'Promote and redeploy', '--yes'], dir, () => {});
}

test('activate sets BOTH status and always — a procedure that is only eligible is a bug', () => {
  withWorkspace((dir) => {
    seed(dir);
    assert.equal(runCli(['procedure', 'activate', 'PROC-rotate-the-webhook-secret', '--yes'],
      dir, () => {}), 0);
    const shown: string[] = [];
    runCli(['show', 'PROC-rotate-the-webhook-secret'], dir, (s) => shown.push(s));
    assert.match(shown.join('\n'), /status:\s*active/);
    assert.match(shown.join('\n'), /always:\s*true/);
  });
});

test('an activated procedure is injected in full at session start', () => {
  withWorkspace((dir) => {
    seed(dir);
    runCli(['procedure', 'activate', 'PROC-rotate-the-webhook-secret', '--yes'], dir, () => {});
    const injected: string[] = [];
    runCli(['inject', '--event', 'session-start'], dir, (s) => injected.push(s));
    // The steps are the point: an injected procedure without them is the
    // silent under-delivery Task 6 exists to prevent.
    assert.match(injected.join('\n'), /- \[ \] Roll the endpoint secret/);
  });
});

test('done retires it to deprecated, and it stays counted as retired', () => {
  withWorkspace((dir) => {
    seed(dir);
    runCli(['procedure', 'activate', 'PROC-rotate-the-webhook-secret', '--yes'], dir, () => {});
    runCli(['procedure', 'done', 'PROC-rotate-the-webhook-secret', '--yes'], dir, () => {});
    const shown: string[] = [];
    runCli(['show', 'PROC-rotate-the-webhook-secret'], dir, (s) => shown.push(s));
    assert.match(shown.join('\n'), /deprecated/);
    const injected: string[] = [];
    runCli(['inject', '--event', 'session-start'], dir, (s) => injected.push(s));
    assert.doesNotMatch(injected.join('\n'), /Roll the endpoint secret/);
    assert.match(injected.join('\n'), /retired/);
  });
});

test('step records progress WITHOUT touching the item — checksum and file do not move', () => {
  withWorkspace((dir) => {
    seed(dir);
    runCli(['procedure', 'activate', 'PROC-rotate-the-webhook-secret', '--yes'], dir, () => {});
    const before = readFileBytes(dir, 'items/procedure/PROC-rotate-the-webhook-secret.md');
    runCli(['procedure', 'step', 'PROC-rotate-the-webhook-secret', '2'], dir, () => {});
    const after = readFileBytes(dir, 'items/procedure/PROC-rotate-the-webhook-secret.md');
    assert.equal(after, before, 'progress must never enter items/ — spec §6m.3');
    const shown: string[] = [];
    runCli(['procedure', 'show', 'PROC-rotate-the-webhook-secret'], dir, (s) => shown.push(s));
    assert.match(shown.join('\n'), /1 of 3/);
    assert.match(shown.join('\n'), /- \[x\] Roll the endpoint secret/);  // rendered, not stored
  });
});

test('doctor stays clean after progress — the checksum never moved', () => {
  withWorkspace((dir) => {
    seed(dir);
    runCli(['procedure', 'activate', 'PROC-rotate-the-webhook-secret', '--yes'], dir, () => {});
    runCli(['procedure', 'step', 'PROC-rotate-the-webhook-secret', '2'], dir, () => {});
    const out: string[] = [];
    runCli(['doctor'], dir, (s) => out.push(s));
    assert.doesNotMatch(out.join('\n'), /checksum mismatch/);
  });
});

test('re-activating clears the previous run', () => {
  withWorkspace((dir) => {
    seed(dir);
    runCli(['procedure', 'activate', 'PROC-rotate-the-webhook-secret', '--yes'], dir, () => {});
    runCli(['procedure', 'step', 'PROC-rotate-the-webhook-secret', '1'], dir, () => {});
    runCli(['procedure', 'done', 'PROC-rotate-the-webhook-secret', '--yes'], dir, () => {});
    runCli(['procedure', 'activate', 'PROC-rotate-the-webhook-secret', '--yes'], dir, () => {});
    const shown: string[] = [];
    runCli(['procedure', 'show', 'PROC-rotate-the-webhook-secret'], dir, (s) => shown.push(s));
    assert.match(shown.join('\n'), /0 of 3/);
  });
});

test('step on a procedure that is not active is refused, and names activate', () => {
  withWorkspace((dir) => {
    seed(dir);
    const out: string[] = [];
    assert.equal(runCli(['procedure', 'step', 'PROC-rotate-the-webhook-secret', '1'],
      dir, (s) => out.push(s)), 1);
    assert.match(out.join('\n'), /procedure activate/);
  });
});

test('a step number outside the list is refused rather than recorded', () => {
  withWorkspace((dir) => {
    seed(dir);
    runCli(['procedure', 'activate', 'PROC-rotate-the-webhook-secret', '--yes'], dir, () => {});
    const out: string[] = [];
    assert.equal(runCli(['procedure', 'step', 'PROC-rotate-the-webhook-secret', '9'],
      dir, (s) => out.push(s)), 1);
    assert.match(out.join('\n'), /3 step/);
  });
});

test('`procedure list` discloses that a ready procedure reaches no index line', () => {
  withWorkspace((dir) => {
    seed(dir);
    runCli(['edit', 'PROC-rotate-the-webhook-secret', '--tags', 'ready', '--yes'], dir, () => {});
    const out: string[] = [];
    runCli(['procedure', 'list'], dir, (s) => out.push(s));
    assert.match(out.join('\n'), /ready/);
    assert.match(out.join('\n'), /not injected and not named in the index/);
  });
});

test('an item that is not a procedure is refused by name', () => {
  withWorkspace((dir) => {
    runCli(['add', 'rule', 'Never log secrets', '--yes'], dir, () => {});
    const out: string[] = [];
    assert.equal(runCli(['procedure', 'show', 'RULE-never-log-secrets'], dir, (s) => out.push(s)), 1);
    assert.match(out.join('\n'), /is a rule, not a procedure/);
  });
});

test('a RUNBOOK is refused, and the refusal says which of the two this is', () => {
  withWorkspace((dir) => {
    // The confusable pair, and the one refusal a user will actually hit.
    // §6l F7 predicted that two ordered-step categories would be filed
    // interchangeably; §6o accepted that risk on the condition that the
    // difference is statable wherever an author is choosing. This message is
    // the fourth of those places, and it is the only one that reaches somebody
    // who has ALREADY chosen wrongly.
    runCli(['add', 'runbook', 'Rotate the webhook secret', '--yes'], dir, () => {});
    const out: string[] = [];
    assert.equal(runCli(['procedure', 'activate', 'RUN-rotate-the-webhook-secret'],
      dir, (s) => out.push(s)), 1);
    const text = out.join('\n');
    assert.match(text, /is a runbook, not a procedure/);
    // Not "unsupported", not "coming soon": a runbook has no lifecycle because
    // it is never finished, and the message has to say so or the user will
    // wait for the feature.
    assert.match(text, /repeatable/);
    assert.match(text, /done once/);
  });
});
```

- [x] **Step 2: Run it and see it fail**

Run: `node --test test/cli/procedure.test.ts` → FAIL, no such command.

- [x] **Step 3: Write the command**

`src/cli/commands/procedure.ts`. Subcommand dispatch modelled on `src/cli/commands/review.ts`;
confirmation/`--yes` on `activate` and `done` modelled on `src/cli/commands/supersede.ts`.

- **`list`** — every `procedure` in the corpus, grouped by lifecycle stage as the table above names
  them, each row `id · stage · N of M · title`. Two disclosure lines, both carrying their condition:
  - for `ready` rows: `"a ready procedure is not injected and not named in the index — the model does
    not learn it exists until \`mycontext procedure activate\` runs. Nothing is lost: it is a draft,
    and \`mycontext procedure list\` is where it is visible."`
  - always: `"progress is recorded per workspace, not per session — two terminals on this workspace
    share one record set."`
- **`show <id>`** — the rendered item, with the stored `- [ ]` lines **overlaid** by the session's
  progress: a step in `procedureProgress` prints `- [x]`. Say in the same output that the tick is
  *rendered from the audit log* and the file on disk is unchanged, or a reader will believe the file
  moved. Print `progressLine(done, item.steps.length)` and, when any progress record was unreadable,
  the count of those.
- **`activate <id>`** — **the `recordAudit` FIRST, then the `updateItem`** (Design decision 13,
  §6n.3): after confirmation, write
  `recordAudit(root, { kind: 'progress', op: 'step-reset', itemId: id, origin: 'human', note: 'activated' })`
  and only then `updateItem({ id, status: 'active', always: true, origin: 'human' })`. The other
  order is the one that fails badly: interrupted between the two, it leaves an `active` procedure
  carrying the previous run's ticks, and "is this finished" — the question the one-shot lifecycle
  exists to answer — is then answered wrongly and silently. **Put the reason in a comment beside the
  two calls**, because the order looks arbitrary and the next person to touch this will otherwise
  tidy it into "do the real work first, then log it".
  The preview before confirmation must say what the two writes do **separately** — eligible, and
  delivered in full every session — because that is the distinction §2.1 says a plan gets wrong.
  Refuse a procedure with no steps? **No** — allow it, and say in the output that it has none, so a
  half-written procedure is visible rather than blocked.
- **`done <id>`** — `updateItem({ id, status: 'deprecated', origin: 'human' })`, behind a preview
  that prints the progress line. **It never runs itself from a completion check:** §2.2's failure
  mode is a procedure left `active` forever, and its guard is that an agent may *ask* and a human
  decides.
- **`step <id> <n> [--undo]`** — refuse unless the item is a `procedure` **and** `status === 'active'`
  (a procedure not yet initiated has no run to record against; the message names `procedure activate`);
  refuse `n` outside `1..steps.length` naming the real count; otherwise one `recordAudit` with
  `op: 'step-done'` or `'step-undone'` and `note: \`step ${n}\``. **It writes no item and takes no
  write lock.**
- **Every subcommand's category refusal is one shared message, and it names both categories.** A
  `runbook` reaching any of the five gets *"`RUN-x` is a runbook, not a procedure"* followed by the
  boundary in one sentence — a runbook is repeatable, so it has no lifecycle to activate or finish;
  a procedure is done once and then finished. Any other category gets the same refusal without the
  second sentence, because `RULE-x` is not a near miss and the extra prose would be noise.

Register the command and add `import './procedure.ts';` to `src/cli/index.ts`'s command-module import
block.

- [x] **Step 4: The slash command, and what an agent may and may not run**

`procedure.md` in `genericCommands()`, following `commands/promote.md`'s shape, and stating the split
explicitly:

- `procedure list`, `procedure show` and `procedure step` — **the agent may run these.** `step` changes no
  item, crosses no trust boundary and takes no lock.
- `procedure activate` and `procedure done` — **the agent must not run these.** Use `commands/promote.md`'s
  own sentence: they pass `origin: 'human'`, which is the one claim an agent cannot make, and they are
  on the deny list this plugin's README recommends. The agent may *report* that the steps look
  complete and *ask*.

Then `'procedure.md'` into `test/plugin/commands.test.ts` · `const GENERIC = [` · ~129, and
`npm run gen:commands`.

**Record the honest limit in the same file:** the CLI passes `origin: 'human'` on every write, so a
`step` record an agent produced is indistinguishable in the log from one a person typed. That is the
same bargain every CLI command already makes, and it is acceptable here specifically because progress
governs nothing — but it must be written down rather than implied by silence.

- [x] **Step 5: Both READMEs**

`mycontext procedure` named in `README.md` (inventory test), added to the non-per-category
**enumeration set** in both documents, counts moved `25` → `26` and `73` → `74`.

- [x] **Step 6: Full gate and commit**

```bash
npm test && npx tsc --noEmit && npm run test:perf && git status --porcelain
git add -A
git commit -m "feat(cli): mycontext procedure — the one-shot lifecycle, with progress outside items/"
```

---

## Task 10: The `runbook` / `procedure` boundary, stated where an author is choosing

**Files:**
- Modify: `src/help/topics/categories.md`, `src/help/topics/categories.he.md`,
  `src/help/index.ts` (`Seed.steps`, `exampleItemOf`, `exampleItemShort`, `SEEDS.procedure`,
  `SEEDS.runbook`'s body), `README.md`, `docs/README.he.md`
- Modify (tests): `test/help/help.test.ts`
- Create: `test/help/category-boundary.test.ts`
- Regenerate: both READMEs' generated specimen blocks

**Interfaces:**
- Consumes: Task 2 (both categories must exist and have entries), Tasks 5-7 (`Item.steps`,
  `Seed.steps` needs somewhere to go, and `add --step` must work before a seed can teach it), and
  Task 9 (the commands this text names must exist before the text names them).
- Produces: documentation, and **one guard**. Nothing imports it.

**What this task replaces, and why it is not the task that used to be here.** The withdrawn Task 10
converted `runbook` into the one-shot category everywhere it is described — its `CategoryDef`
description, its Hebrew description, its seed, `exampleItemShort`, both topic sources and both
READMEs. §6o reverses that: `runbook` ships unchanged, and none of those edits happen. §0 records it.

**Why a documentation task earns a place in an implementation plan, and a test.** §6l F7 argued that
two normative ordered-step categories differing only by *repeatable* versus *once* is a **second
spelling of one concept** — the defect this project has paid for four times. §6o does not dismiss
that argument. It accepts the risk knowingly, on one stated condition:

> The friction §1 warns about is not two categories existing; it is two categories whose difference
> nobody can state at capture time.

**This task is that condition, so it gets a checker rather than good intentions.** The failure mode
is not that somebody deletes the boundary sentence on purpose; it is that one of the two
descriptions gets reworded a year from now by somebody who has never read §6o, the two entries stop
distinguishing each other, and nothing anywhere goes red. That is the same shape as the four
enumeration sites Task 1 exists to pin, and it takes the same answer:
`check-retired.ts` · `// watching it pass: a checker is not verified until it has been made red.` · ~100.

**The four places an author is choosing, named by §6o:**

| Where | What it must answer | Held by |
|---|---|---|
| `mycontext help categories` | both entries, each naming the other and saying which is which | Step 1's guard |
| `mycontext examples runbook` | one sentence: this is the repeatable one | Step 1's guard |
| `mycontext examples procedure` | one sentence: this is the once-only one | Step 1's guard |
| `README.md` and `docs/README.he.md` | the verbatim test, once, in both | Step 1's guard |

A fifth place is already held elsewhere and is not re-asserted here: `mycontext procedure`'s refusal
message when it is handed a `runbook` (Task 9), which is the only one of the five that reaches
somebody who has already chosen wrongly.

**The one-sentence test, verbatim from §6o, and it is copied character for character into every one
of the four:**

> Will you do this again next time the situation arises? Then it is a `runbook`. Is it done once and
> then finished? Then it is a `procedure`.

- [x] **Step 1: Write the guard, and make it red before trusting it**

```ts
// test/help/category-boundary.test.ts
/**
 * `runbook` and `procedure` must each say which one they are.
 *
 * Spec §6o creates a second normative ordered-step category, over an explicit
 * objection (§6l F7) that two categories differing only by repeatable-versus-
 * once are a second spelling of one concept. §6o accepts that risk on one
 * condition: that the difference is statable at capture time, in
 * `mycontext help categories`, in `mycontext examples <either>`, and in both
 * READMEs. This file is that condition, expressed as an assertion.
 *
 * It fails if EITHER category's documented description stops distinguishing
 * them — not only if the boundary sentence is deleted. A reworded `runbook`
 * entry that no longer mentions `procedure` fails here even though every
 * other test in the suite stays green, which is the whole reason this file
 * exists.
 *
 * What it cannot do, stated so a green run is not mistaken for a reviewed
 * document: it checks that both names appear, that the discriminating words
 * appear, and that the verbatim test sentence is present where §6o requires
 * it. It cannot check that the surrounding prose is true or useful. Same
 * disclaimer as test/docs/inventory.test.ts, for the same reason.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CATEGORIES } from '../../src/core/categories.ts';
import { exampleItemShort } from '../../src/help/index.ts';
import { CONFIG } from '../helpers/config.ts';   // establish the real helper by reading
                                                 // test/help/help.test.ts's own import block

const REPO = path.join(import.meta.dirname, '..', '..');
const read = (...p: string[]): string => readFileSync(path.join(REPO, ...p), 'utf8');

/** §6o's words, and they are not paraphrased anywhere this test looks. */
const TEST_SENTENCE =
  'Will you do this again next time the situation arises? Then it is a `runbook`. ' +
  'Is it done once and then finished? Then it is a `procedure`.';

/** The `### \`name\`` section of a topic source, heading excluded. */
function entry(doc: string, name: string): string {
  const found = new RegExp(`\\n### \`${name}\`\\n([\\s\\S]*?)(?=\\n### |$)`).exec(doc);
  assert.ok(found, `the categories topic has no \`${name}\` entry`);
  return found[1]!;
}

test('the two CategoryDef descriptions distinguish each other', () => {
  const run = CATEGORIES.runbook!.description;
  const proc = CATEGORIES.procedure!.description;
  assert.notEqual(run, proc);
  // `procedure` names its sibling in its own description, because that string
  // is what /mycontext:add-procedure, `mycontext help`, the generated category
  // table in both READMEs and the MCP create_item enum all print. Removing the
  // name is how the boundary quietly stops being reachable at capture time.
  assert.match(proc, /runbook/,
    "`procedure`'s description no longer names `runbook`. Spec §6o requires the difference " +
    'to be statable where an author is choosing, and this description is the shortest of ' +
    'those places — it is printed by every add surface.');
  assert.match(proc, /once/);
  // `runbook`'s description is the SHIPPED one and §6o keeps it verbatim; it
  // is pinned here so a future "let us make them symmetrical" edit is a
  // decision somebody takes deliberately rather than a diff nobody reviews.
  assert.equal(run, 'The steps for a named operation, in the order they must be taken');
});

test('`mycontext help categories` states the boundary, in both directions', () => {
  const doc = read('src', 'help', 'topics', 'categories.md');
  const run = entry(doc, 'runbook');
  const proc = entry(doc, 'procedure');

  assert.match(run, /`procedure`/, "`runbook`'s entry no longer mentions `procedure`");
  assert.match(proc, /`runbook`/, "`procedure`'s entry no longer mentions `runbook`");
  for (const [name, body] of [['runbook', run], ['procedure', proc]] as const) {
    assert.ok(body.includes(TEST_SENTENCE),
      `the \`${name}\` entry no longer carries §6o's one-sentence test verbatim:\n` +
      `${TEST_SENTENCE}\nIt is quoted rather than paraphrased on purpose — a paraphrase in ` +
      `one entry and not the other is how the two stopped agreeing last time.`);
  }
  // The tagged neighbours point at each other (design decision 18). The
  // `instruction` contrast stays in runbook's entry as prose; only the tagged
  // line moves.
  assert.match(run, /\*\*Nearest neighbour: `procedure`\.\*\*/);
  assert.match(proc, /\*\*Nearest neighbour: `runbook`\.\*\*/);
});

test('the Hebrew topic source states the boundary too, in both directions', () => {
  const doc = read('src', 'help', 'topics', 'categories.he.md');
  // The category NAMES are Latin in the Hebrew source — they are identifiers a
  // reader types, not words. The sentence itself is Hebrew, so only the names
  // and the neighbour markers are asserted here; the entry-set and
  // heading-structure equality with the English source is already held by
  // test/help/categories-topic.test.ts.
  assert.match(entry(doc, 'runbook'), /procedure/);
  assert.match(entry(doc, 'procedure'), /runbook/);
});

test('`mycontext examples <either>` says which of the two it is', () => {
  const run = exampleItemShort('runbook', CONFIG);
  const proc = exampleItemShort('procedure', CONFIG);
  // Each specimen names the other category. This is the narrowest possible
  // assertion that survives a rewrite of either body: a specimen that stops
  // mentioning its sibling has stopped answering "which one is this?", which
  // is the question §6o says these two commands must answer.
  assert.match(run, /procedure/,
    'the `runbook` specimen no longer mentions `procedure`. Both READMEs print this block, ' +
    'and it is where a reader meets the pair.');
  assert.match(proc, /runbook/,
    'the `procedure` specimen no longer mentions `runbook`.');
  // And they are shaped differently, which is the non-verbal half of the
  // answer: a procedure carries `## Steps` checkboxes, a runbook does not.
  assert.match(proc, /- \[ \] /);
  assert.doesNotMatch(run, /- \[ \] /);
  assert.doesNotMatch(proc, /- \[x\]/);   // a shipped specimen never teaches stored progress
});

test('both READMEs carry the boundary sentence', () => {
  for (const doc of ['README.md', path.join('docs', 'README.he.md')]) {
    assert.ok(read(doc).includes(TEST_SENTENCE),
      `${doc} no longer carries §6o's one-sentence test. It is the sentence a reader uses to ` +
      `choose, and it is verbatim in all four places on purpose.`);
  }
});
```

**Prove it red, in the working tree only** — a guard that has never failed is a guard nobody has
checked, and this one guards prose, where a passing run is especially easy to believe:

```bash
# 1. Delete the word `procedure` from runbook's entry in
#    src/help/topics/categories.md, and delete the TEST_SENTENCE from README.md.
node --test test/help/category-boundary.test.ts
# EXPECT: 2 failing tests, one naming the topic entry and one naming README.md.
# 2. Revert both.
git checkout -- src/help/topics/categories.md README.md
node --test test/help/category-boundary.test.ts
# EXPECT: 5 passing tests.
```

Record in the commit message that this was done and what the failures named.

- [x] **Step 2: Both topic sources — `procedure`'s entry, and `runbook`'s**

`src/help/topics/categories.md` and `src/help/topics/categories.he.md`, same position and same order
in both (`categories-topic.test.ts` holds them heading for heading).

**`procedure`'s entry** (created in Task 2, extended here) gains: §6o's test sentence verbatim; the
lifecycle in prose — a procedure is injected while it is `active` and stops being injected when it
is `done`, which is what makes the one-shot honest; and `**Nearest neighbour: \`runbook\`.**`

**`runbook`'s entry** — and this is the only change this plan makes to `runbook`'s documentation —
gains §6o's test sentence verbatim, and its tagged neighbour line moves from `instruction` to
`procedure` (Design decision 18). **The existing `instruction` paragraph stays**, unedited, below
the new one: an instruction is a *standing* directive and a runbook is *conditional and procedural*,
which is still true and still worth saying. Only the tag moves, because the tag names the category a
reader will actually file into by mistake.

The entry still says what it said: a runbook is the steps for a named operation, in the order they
must be taken. Nothing about "performed once" is added to it, and its `CategoryDef` description is
not touched — that was the withdrawn task.

- [x] **Step 3: The seeds, and `exampleItemShort`**

Three edits in `src/help/index.ts`, and the first two are what let a `procedure` specimen exist at
all:

1. `Seed` gains `steps?: string[]`, and `exampleItemOf` threads it through: the `Item` literal at
   `help/index.ts` · `  const item: Item = {` · ~463 gained `steps: []` in Task 5, and it becomes
   `seed.steps?.map((text) => ({ text, checked: false })) ?? []`.
2. **`exampleItemShort` must render steps**
   (`help/index.ts` · `export function exampleItemShort(type: string, config: Config): string {` · ~414),
   or the READMEs' `procedure` specimen shows a procedure with no steps — a specimen teaching the
   opposite of the category. Emit the `- [ ] ` lines after the body, and add to the function's doc
   comment why steps earn their place on the same terms `source_file` and the `extra` fields do:
   they are the frontmatter-equivalent that differs *because of* the category.
3. `SEEDS.procedure` (created in Task 2) gains its `steps:` array and one sentence of boundary:

```ts
  procedure: {
    title: 'Backfill the tenant_id column on invoices',
    body:
      'One-time correction after the multi-tenant migration: rows written before 2026-07 '
      + 'carry a null tenant_id. Run it once, in this order; the reconciliation query is '
      + 'meaningless until the backfill has finished. Done once and then finished — the '
      + 'nightly job that keeps the column correct from here on is a `runbook`.',
    steps: [
      'Take the invoices table out of the nightly reconciliation job.',
      'Backfill tenant_id in batches of 5,000, oldest first.',
      'Re-run the reconciliation query and compare against the pre-migration total.',
      'Put the table back in the nightly job.',
    ],
    scope: ['src/billing/invoices/**'],
    tags: ['migration', 'billing'],
  },
```

4. **`SEEDS.runbook` gains exactly one sentence and nothing else.** Its `1. `/`2. `/`3. ` numbered
   body is **not** touched — that was the withdrawn task, and `help.test.ts` · ``  for (const step of ['1. ', '2. ', '3. ']) assert.ok(runbook.includes(step), runbook);`` · ~268 stays green because of it. Append to the body: that this is run **every time** the secret is
   rotated, which is what makes it a `runbook` rather than a `procedure`. One clause, at the end,
   after the existing three numbered lines.

**Establish by executing, do not predict:** `exampleItemShort` prints `item.body.trim()` in full
today, but both READMEs print these blocks and the added clause changes their length. Run
`node --test test/docs/examples.test.ts` and `npm run gen:docs` after the edit and read the diff
before committing it — if a length or width assertion moves, that is the finding, not a nuisance.

- [x] **Step 4: `test/help/help.test.ts` — pin the `procedure` specimen**

The existing test named *"the three new categories carry the knowledge that distinguishes them"*
already pins `runbook`, `environment` and `known_issue`. `runbook`'s block is **unchanged**. Add a
`procedure` block beside it, in the same register:

```ts
  // `procedure`'s value is that it is DONE ONCE, and the specimen has to carry
  // both halves of that: ordered steps in `## Steps` (which is what the
  // category adds over a body), and the sentence saying it is finished
  // afterwards. A procedure specimen that reads like a runbook would teach the
  // exact confusion §6l F7 predicted and §6o accepted the risk of.
  const procedure = exampleItemShort('procedure', CONFIG);
  for (const step of ['- [ ] ', '- [ ] ', '- [ ] ']) assert.ok(procedure.includes(step), procedure);
  assert.ok(procedure.indexOf('Take the invoices table') < procedure.indexOf('Put the table back'),
    procedure);
  // The box is EMPTY: the shipped specimen must not teach that progress is
  // stored in the file. It is not — it is audit records (Task 8).
  assert.doesNotMatch(procedure, /- \[x\]/);
```

- [x] **Step 5: Both READMEs**

The specimen blocks and the counts landed in Task 2. What lands here is the prose a reader chooses
by, in **both** documents (`test/docs/parity.test.ts` holds their structures equal):

- §6o's test sentence, **verbatim**, once in each document, beside the category catalogue where the
  two names first appear together;
- one sentence each way: a `runbook` is performed again every time the named operation comes up and
  therefore never finishes; a `procedure` is performed once, carries `## Steps`, and stops being
  injected when it is done;
- and the consequence that makes the distinction load-bearing rather than taxonomic — a `procedure`
  leaves the session's context when it is finished, and that is the only reason the pair is worth
  two categories.

Do **not** restate the lifecycle here; Task 12 step 3 owns it, in the same two documents. This step
owns only the choice between the two.

- [x] **Step 6: Regenerate and re-check**

```bash
npm run gen:docs       # the category table and BOTH specimens in both READMEs
npm run gen:commands   # add-procedure.md / list-procedure.md carry the description from Task 2
```

`git diff commands/` must show **no change to `add-runbook.md` or `list-runbook.md`.** If either
moved, something edited `runbook`'s description or its seed, which §6o forbids and this plan's
Global Constraints call a defect. That diff is the cheapest check that the withdrawn task did not
partially survive.

- [x] **Step 7: Full gate and commit**

```bash
npm test && npx tsc --noEmit && npm run check:retired && git status --porcelain
git add -A
git commit -m "docs(categories): state the runbook/procedure boundary everywhere an author chooses"
```

---

## Task 11: One generic `/mycontext:add` for custom and pack-defined categories

**Files:**
- Modify: `src/plugin/commands.ts`
- Modify (tests): `test/plugin/commands.test.ts` (`GENERIC`)
- Create (generated): `commands/add.md`
- Modify: `README.md`, `docs/README.he.md`

**Interfaces:**
- Consumes: nothing in this plan.
- Produces: `/mycontext:add <category> <title> …`.

**The gap, exactly (§6m.12, on §6l F15).** The `commands/*.md` files are generated at build time from
the plugin's **own** defaults and committed
(`plugin/commands.ts` · `export function generateCommands(config: Config): CommandFile[] {` · ~924).
A category a user defines in `config.json` — or one a pack enables — therefore reaches **no slash
command at all**, so a vocabulary that works everywhere else has no way to be filled from the surface
most users reach for. One generic command accepting any resolved category closes it, with nothing
generated at install time.

**The committed per-category files and their CI parity test are untouched.** This is an addition, not
a replacement, and the reason is in `plugin/commands.ts`'s own header: a disabled category keeps no
command, because the generated set is derived from the resolved config. That property is preserved —
`mycontext add` refuses a disabled category through `resolveCategory`'s one `enumError`, which is
what "fails in one place with a real message" means.

- [ ] **Step 1: Write the failing test**

```ts
test('a generic add command exists and is not per-category', () => {
  const files = generateCommands(resolveConfig({})).map((f) => f.file);
  assert.ok(files.includes('add.md'));
  // It must not be mistaken for a per-category file by the partition every
  // counting test uses.
  assert.ok(!/^add-/.test('add.md'));
});

test('the generic add command names no category, so a custom one is reachable', () => {
  const file = generateCommands(resolveConfig({})).find((f) => f.file === 'add.md')!;
  for (const name of Object.keys(CATEGORIES)) {
    assert.doesNotMatch(file.content, new RegExp(`add ${name}\\b`),
      'a generic command that hardcodes a category is a per-category command with a wrong name');
  }
  assert.match(file.content, /help categories/);
});
```

- [ ] **Step 2: Add the entry**

In `genericCommands()`, an `add.md` whose frontmatter carries `disable-model-invocation: true` like
its siblings and whose body:

- runs `mycontext add $ARGUMENTS`,
- says the first argument is the category and points at `mycontext help categories` for the list —
  **generated from nothing**, so a category added to `config.json` after install is reachable
  immediately,
- says that a disabled or unknown category is refused by name with the catalogue listed, and that
  this is the same refusal every other surface gives,
- and points at `/mycontext:add-<type>` for the built-ins, since those carry the category's own
  description and example and are the better prompt when one exists.

Add `'add.md'` to `test/plugin/commands.test.ts` · `const GENERIC = [` · ~129 and run
`npm run gen:commands`.

- [ ] **Step 3: Both READMEs**

Add `` `add` `` to the non-per-category **enumeration set** in both documents, counts `26` → `27` and
`74` → `75`, and one sentence in §5 saying what it is for: a category you defined yourself, or one a
pack enabled, has no generated command and this is how you fill it.

`src/plugin/parity.ts` needs no change — `TOOL_PARITY` already pairs `create_item` with
`cli: 'add', slash: 'add'`, and this makes that pairing literally rather than by the hyphen-prefix
rule.

- [ ] **Step 4: Full gate and commit**

```bash
npm test && npx tsc --noEmit && git status --porcelain
git add -A
git commit -m "feat(plugin): a generic /mycontext:add so config- and pack-defined categories are reachable"
```

---

## Task 12: Documentation — both documents, always

**Files:**
- Modify: `README.md`, `docs/README.he.md`, `CHANGELOG.md`, `docs/ROADMAP.md`

**Interfaces:**
- Consumes: everything above.
- Produces: user documentation. `test/docs/parity.test.ts` holds the two READMEs' structures equal;
  `test/docs/inventory.test.ts` and `test/docs/counts.test.ts` hold the surfaces and the numbers.

Tasks 2, 3, 4, 9, 10 and 11 already made the **enforced** edits — counts, enumerations, command
names, and the `runbook`/`procedure` boundary sentence, which Task 10's guard holds. This task
writes the prose those numbers sit in, which no test can check and which is therefore the part most
likely to be skipped.

**Do not re-state the boundary here.** Task 10 owns the choice between the two categories and pins
it; this task owns the lifecycle `procedure` has and `runbook` does not. A second, unpinned copy of
the boundary sentence is how the two copies start disagreeing.

- [ ] **Step 1: Establish the insertion points by executing**

Run `git grep -n "^#\{2,4\} " README.md` and find (a) where the category catalogue is discussed,
(b) where the CLI commands are documented, (c) where the audit log's kinds are described. Place each
new subsection at the same depth and position in **both** documents; `test/docs/parity.test.ts` is
the failing-test half of this task — add to one document, run `npm test`, see parity fail, add to the
other, see it pass.

- [ ] **Step 2: The inbox (English, then Hebrew)**

- What `todo` and `note` are for, in §0's own words: every other category expects the author to
  already know what kind of knowledge they have, and at the moment a thought arrives they do not.
- **The condition, in the same sentence as the claim:** both are rationale, so an agent may write one
  with no draft queue **and** neither is ever injected or named in the index — the inbox costs a
  session nothing.
- `mycontext todo`, `mycontext search --type note`, and why the review queue is **not** where they
  appear: an inbox and a draft queue answer different questions.
- `mycontext inbox-promote <id> --to <category>`, the `derived_from` edge it writes, the origin left
  `deprecated` rather than deleted, and the one sentence that stops the obvious misreading:
  **`inbox-promote` moves a capture into a real category; `review promote` moves a draft into
  governing. They are different commands.**
- The bug lifecycle §1.4 names, because it is the clearest example: `note --tags bug` → understood →
  `inbox-promote --to known_issue`.
- **The known cost, recorded rather than solved** (§1.1): every other item is true until superseded;
  a `todo` is true until someone does it, and the corpus has no way to learn that happened.
  Promotion is the mitigation, not a fix.

- [ ] **Step 3: The procedure lifecycle (English, then Hebrew)**

- The five-row table from Task 9, verbatim in meaning: which shipped `Status` each stage is, and
  what injects in each.
- **Activation is two writes and the command does both** — with the reason, because it is the thing
  a reader will otherwise get wrong.
- `done` is `deprecated`, not `validated`, and why: a `validated` procedure would keep governing.
- **What a `ready` procedure does today: nothing.** It is a draft with a tag; it is not injected and
  not named in the index, so the model does not learn it exists until it is activated. Say that this
  is a deliberate open question (spec §2.1) rather than an oversight, and that `mycontext procedure
  list` is where a `ready` procedure is visible.
- `## Steps` as a file-format feature: the syntax, that steps are **create-only**, and that
  correcting one means editing the Markdown and running `mycontext repair`.
- **Progress never enters the corpus**: it is audit records, counted at display time; the file on
  disk and its checksum do not move when you tick a step; a tick shown in `procedure show` is rendered
  over the stored list. And the limit in the same breath: progress is per **workspace**, not per
  session.
- A procedure is performed **once**, and **that is why it is the category with a lifecycle**: it
  stops being injected when it is done. A `runbook` never finishes, so there is nothing for it to
  stop being. One clause, pointing at the boundary section Task 10 wrote — not a second copy of it.

- [ ] **Step 4: The audit log gains a sixth kind, and a version**

Two paragraphs in both documents, beside the existing description of `--kind`:

- `progress` records step ticks against a procedure, changes no item, and is separate from
  `mutation` for the reason `focus` is.
- **The log now declares `my_context/audit@2`** (§6n.5, Task 8 step 3a). A v2.0 build reads `@1` and
  `@2`; anything else is refused as version skew with a message saying the log was written by a
  different version, rather than blaming a record kind it does not recognise. State the direction
  plainly: **upgrading is safe, downgrading is not.**

- [ ] **Step 5: `CHANGELOG.md`**

A v2.0 entry naming, at minimum:

- **three** categories added — `todo`, `note` and `procedure` — catalogue 21 → 24, and one sentence
  saying `runbook` is unchanged and how to tell the two apart, because a user who already has
  runbooks will read "an ordered-step category was added" and reasonably assume theirs moved;
- `## Steps` as a **file-format addition** — a stepless item's bytes and checksum are unchanged, and
  say so, because the first question a user with a corpus will ask is whether they have to migrate
  (they do not);
- the `procedure` lifecycle and the three new commands;
- **the audit log format version**: `my_context/audit@2`. A v2.0 build reads both `@1` and `@2`, so
  an existing log keeps working across the upgrade with no action — say that explicitly, since a
  version bump in a changelog reads as a migration until it says otherwise;
- **and the one-way step:** an audit log containing `progress` records cannot be read by v1.0.2,
  because `AUDIT_OPS`/`AUDIT_KINDS` are closed vocabularies and the reader refuses a whole segment on
  an unknown one — and from v2.0 it refuses on the **protocol** first, so the diagnosis is "this log
  is newer than I am" rather than a complaint about an op. Downgrading is not supported. This is the
  kind of consequence that must be in the changelog rather than discovered.

Run `scripts/changelog-section.ts` the way CI does and confirm it is satisfied.

- [ ] **Step 6: `docs/ROADMAP.md`**

Tracking rows. Explicitly **not** a tested artefact; keep it short and true.

- [ ] **Step 7: Full gate**

Run:
`npm test && npx tsc --noEmit && npm run test:perf && npm run verify:citations && npm run check:retired && npm run check:test-glob && git status --porcelain`

- [ ] **Step 8: Commit**

```bash
git add README.md docs/README.he.md CHANGELOG.md docs/ROADMAP.md
git commit -m "docs: the inbox categories and the one-shot procedure lifecycle, in both documents"
```

---

## Self-Review

Performed against the spec with fresh eyes after writing, per the writing-plans skill.

**1. Spec coverage (this plan's scope only):**

| Spec requirement | Task |
|---|---|
| §1 / §1.1 `todo`, rationale tier, never injected | 2 (the tier does it; no `select` change) |
| §1.1 `todo` gets its own listing surface — `mycontext todo`, `search --type todo` | 3 |
| §1.1 the review queue is **not** widened (§6m.9) | 3, and asserted by omission — no change to `reviewQueue` |
| §1.1 the known cost (a `todo` is true until someone does it) recorded, not solved | 12 |
| §1.2 `note`, same tier and injection rule | 2 |
| §1.3 the promotion path: create the target, link back, mark the origin resolved | 4 |
| §1.3 "promotion is not laundering" | 4 (the origin is carried forward, so `trustedStatus` still sees a non-human origin) |
| §1.4 the bug lifecycle `note --tag bug` → `known_issue` | 2 (the seed) and 12 (the prose) |
| §6o **both categories exist**: `runbook` unchanged and repeatable, `procedure` new and one-shot | 2 (the category), 5-9 (the lifecycle it carries), 10 (the boundary), and stated in Global Constraints |
| §6o the difference must be statable at capture time — `help categories`, both `examples`, both READMEs | 10, with a guard that fails if either description stops distinguishing them |
| §2.1 / §6m.2 the lifecycle mapped onto shipped statuses; nothing added to `Status` | 9 |
| §2.1 activation is **two** human writes | 9 |
| §2.1 `done` is `deprecated`, **not** `validated` | 9 |
| §2.1 `ready` yields no index line, and nothing may be built on "index line only" | **deliberately unbuilt** — 9 discloses it, "What this plan is not doing" names it |
| §2.2 completion: a command exists; the agent may ask, never decides | 9 (the command), 9 step 4 (the slash command's split) |
| §2.3 / §6a / §6i.1 `## Steps` as a first-class field, sized as a file-format change | 5, 6, 7 |
| §6g / §6m.3 progress in session state or the audit log, never in the item | 8, 9 |
| §6g `UPDATE_FIELD_POLICY` untouched, `checksum` never moves on a tick | 5 (create-only), 9 (the byte-equality assertion) |
| §6i.4 how the write path is expressed in the type system, left to the plan | 5 — create-only, on the `observations` precedent |
| §6i.5 promotion links back with `derived_from` | 4 |
| §6m.12 one generic `/mycontext:add` | 11 |
| §6n.3 the audit record is written **before** the work it records | 9 step 3 (`activate` writes `step-reset` first), Design decision 13 |
| §6n.4 `steps` enters the checksum only when non-empty | 5 step 5, and the condition is commented as load-bearing |
| §6n.5 the audit log gains a format version, now | 8 step 3a — `audit@2` written, `@1` and `@2` read |
| The 22 enumeration sites, and a test that proves none was missed | 1, 2 |

Out of scope, deliberately, and named in "What this plan is not doing": §3, §4, §5, §6, §6b-§6f,
§6h, §6j, §6k, §6m.4-§6m.8, §6m.10, §6m.11, §6n.1/§6n.2/§6n.6/§6n.7/§6n.8.

**§6m.1 is not in this table, and its absence is the point.** §6o reverses it, so the plan
implements §6o instead; §0's first row records the reversal and the retired-phrases block enforces
that no sentence written against §6m.1 survived.

**2. Placeholder scan.** This plan contains **eight explicit establish-by-executing points**, each
naming what to run, what to read and what the committed artefact must contain afterwards: Task 1
step 2 (make the guard red with a throwaway category, then revert); Task 2 step 6 (measure
`SKILL.md`'s length rather than predicting the ceiling); Task 5 step 1 (compute the pre-change
stepless checksum against the old implementation and paste it); Task 7 step 5 (run an ingest with a
`steps` key and branch on what actually happens); Task 10 step 1 (make the boundary guard red by
deleting one word and one sentence, then revert); Task 10 step 3 (run `gen:docs` and read the
specimen diff rather than predicting whether the added clause moves a width assertion); Task 10
step 6 (`git diff commands/` must show `add-runbook.md` unchanged — the check that the withdrawn
task did not partially survive); Task 12 step 1 (find the insertion points by grepping the
headings). Four test files name a helper by shape rather than by import path (`withWorkspace`,
`readItem`, `readFileBytes`, `createAgentNote`, `CONFIG`) with an instruction to establish the real
name by reading the neighbouring suite — that is a lookup, not a decision, and the assertion beside
it is fully specified. No "add error handling", no "similar to Task N", no test named without its
assertions.

**3. Type consistency.** `Step { text: string; checked: boolean }` is defined once (Task 5) and
consumed in Tasks 6, 7, 9, 10 with the same two fields. Every **write** surface takes `string[]`
(Task 7) and never `Step[]`, which is what makes "nothing writes `checked: true`" structural.
`PROGRESS_OPS` is spelled `'step-done' | 'step-undone' | 'step-reset'` identically in Tasks 8 and 9.
`procedureProgress(records, itemId): Set<number>` and `progressLine(done, total): string` have one
signature each, given in Task 8 and called in Task 9. The three new CLI command names —
`todo`, `inbox-promote`, `procedure` — are spelled identically in their own task, in
`test/plugin/commands.test.ts`'s `GENERIC` list, in the generated filename, and in the README
enumeration; the slash-command counts move monotonically 23 → 24 → 25 → 26 → 27 across Tasks 3, 4, 9
and 11 and each task states both numbers it is responsible for.

**Known deviations from the spec, named rather than silent:**

- **The promoted item's status is not unconditionally `draft`** (Task 4). §1.3 can be read that way;
  this plan carries the origin item's `origin` forward instead, which produces a draft in the case
  §1.3 was written about (an agent's note) and needs no exception inside `trustedStatus`.
- **The promoted origin becomes `deprecated`.** §1.3 says "resolved" and names no status.
- **`ready` is a tag rather than an `extra` field.** §6m.2 permits either; the reason is in Design
  decision 10.
- **Progress is workspace-scoped, not session-scoped.** §6g offers "session state or the audit log";
  §6j closes the first option for a CLI surface. The consequence is disclosed in the command's own
  output.
- **`validateBody` gets a message change, not a behavioural carve-out**, against §6m's wording. §0.
- **`computeItemChecksum` includes `steps` conditionally.** No longer a deviation: §6n.4 rules it
  the same way, for the same reason. Kept in this list because the plan reached it first and the
  agreement is worth recording.
- **`mycontext inbox-promote` is not called `promote`.** The spec names no command for §1.3.

**What §6o leaves for an implementer to guess, answered here rather than guessed silently.** Each is
also flagged at the decision that answers it, and §0 lists all five in one place:

- **`procedure`'s `CategoryDef` description string.** §6o gives the meaning, not the words. Task 2's
  exact-values table fixes it, and the string names `runbook` inside itself because that string is
  what every add surface prints. Design decision 17.
- **Whether `procedure` joins `PROFILES.minimal`.** It does not. Design decision 17.
- **Whether `procedure` has `extraFields`.** It does not — the lifecycle is `status`, `always` and
  one tag, so there is nothing left for a field to carry. Design decision 17.
- **Which entry's tagged nearest neighbour carries the boundary.** Both: `runbook`'s moves from
  `instruction` to `procedure`, `procedure`'s is `runbook`, and the `instruction` contrast stays as
  untagged prose. Design decision 18.
- **Whether `steps` are refused outside `procedure`.** They are not. §6o says `runbook` has no
  `## Steps` field; this plan makes that documentary rather than enforced, because `parseItem` has
  no `Config` and `createItem` has no category-conditional field rule to follow. Design decision 19,
  and **this is the one whose blast radius is asymmetric**: if the owner meant the refusal, adding
  it later breaks any corpus that took the offer.

- **§6n.5's "version per segment" ships as a version per line**, because that is the shape the log
  already has. The behaviour §6n.5 asks for is delivered either way. Task 8 step 3a.

---

## Produces summary — the interface later work consumes

```ts
// src/core/types.ts
export interface Step { text: string; checked: boolean }   // checked is NEVER written by this product
export interface Item { /* … */ steps: Step[]; observations: Observation[]; /* … */ }

// src/core/item.ts   (no new exports; behaviour changes)
//   parseItem   reads  sections.get('steps')   -> Item.steps
//   renderItem  writes '## Steps' BEFORE '## Observations'
//   computeItemChecksum includes `steps` ONLY when non-empty, keyed between body and observations

// src/core/content-hash.ts
//   ContentShape gains `steps: Step[]`, hashed unconditionally (never persisted)

// src/core/validate.ts
export function validateStepText(text: string, where: string): void;

// src/core/mutate.ts
export interface CreateInput { /* … */ steps?: string[] }   // create-only; UpdateInput unchanged

// src/core/audit.ts
export const AUDIT_PROTOCOL = 'my_context/audit@2';   // written; @1 and @2 are both READ (§6n.5)
export type AuditKind = 'mutation' | 'injection' | 'hook' | 'focus' | 'progress';
export const PROGRESS_OPS = ['step-done', 'step-undone', 'step-reset'] as const;
//   a progress record: { kind: 'progress', op, itemId: '<PROC-id>', origin, note: 'step <n>' }

// src/core/jsonl-log.ts
//   JsonlLogSpec gains an accepted-protocol set, defaulting to [spec.protocol] so focus.ts,
//   revision.ts and seen-file.ts are unchanged by construction

// src/core/progress.ts
export function procedureProgress(records: AuditRecord[], itemId: string): Set<number>;
export function progressLine(done: Set<number>, total: number): string;   // "3 of 5"

// categories (src/core/categories.ts)
//   todo      · TODO · rationale · enabled  — never injected, never indexed, no draft gate
//   note      · NOTE · rationale · enabled  — same
//   procedure · PROC · normative · enabled  — NEW. Done once and then finished: it carries the
//                                             lifecycle, `## Steps`, and injection only while active
//   runbook   · RUN  · normative · enabled  — UNCHANGED. The repeatable one. No lifecycle, no
//                                             states, no `## Steps`, no commands. §6o

// CLI
mycontext todo [--tag <t>] [--all] [--limit <n>]
mycontext inbox-promote <id> --to <category> [--title <text>] [--yes]
mycontext procedure list
mycontext procedure show <id>
mycontext procedure activate <id> [--yes]     # step-reset FIRST, then status=active AND always=true
mycontext procedure done <id> [--yes]         # status=deprecated
mycontext procedure step <id> <n> [--undo]    # writes an audit record; touches no item
//   every subcommand refuses a non-`procedure` id by name, and a `runbook` gets the boundary
mycontext add <category> "<title>" [--step <text>]…   # --step repeatable, order preserved

// slash commands (all disable-model-invocation: true)
/mycontext:todo  /mycontext:inbox-promote  /mycontext:procedure  /mycontext:add
/mycontext:add-todo  /mycontext:list-todo  /mycontext:add-note  /mycontext:list-note
/mycontext:add-procedure  /mycontext:list-procedure

// MCP
create_item{ …, steps?: string[] }          # no `checked` is exposed
audit_log{ kind: 'progress' }               # derived from AUDIT_KINDS, no schema edit
```

Execution: use `superpowers:subagent-driven-development` (recommended) or
`superpowers:executing-plans`, task by task. 1 → 2 → 3 → 4, 5 → 6 → 7, 8 → 9 → 10, 11, 12.
Tasks 5-7 are independent of Tasks 1-4 and may run first; nothing else may be reordered. **Task 10
now needs 2, 7 and 9** — 2 for both categories and their entries, 7 for `--step`, 9 for the commands
its prose names. Every task ends with `npm test` green.

