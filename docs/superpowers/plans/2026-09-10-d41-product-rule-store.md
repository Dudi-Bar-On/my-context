# D41 — The product rule store · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ship a second, product-owned store of constants — facts, prohibitions, procedures, standards and definitions about my_context itself — delivered at every door an agent starts through, invisible to a user, maintained only by the owner.

**Architecture:** a directory inside the package with its own loader and its own integrity manifest. Markdown-with-frontmatter files, same parser as the corpus, narrower schema, **no lifecycle**. Two tiers decide who sees an entry. The corpus never learns it exists.

**Tech Stack:** Node 24 native type stripping · `node:sqlite` (already used) · the existing hook harness · the existing UI server for the developer-only maintenance surface.

**Spec:** `docs/superpowers/specs/2026-09-10-product-rule-store-design.md` — approved 2026-09-10. **Read it whole before Task 1.** This plan argues from it and does not repeat it.

## Global Constraints

Every task's requirements implicitly include these. They are not advice.

- `CONST-zero-runtime-dependencies` — `dependencies` is empty and stays empty, as do `optionalDependencies`, `peerDependencies`, `bundledDependencies`.
- `CONST-node-24-no-build-step` — source is `.ts` run directly. Only erasable TypeScript: no `enum`, no `namespace`, no parameter properties. Every relative import carries an explicit `.ts` extension.
- **The store is NOT a corpus category.** `doctor`, `list`, `ready`, the tier budgets, decay, supersede and the injection selector must each return nothing from it — asserted, not assumed (spec §7).
- **No raw NUL bytes in source.** Write `\u0000`. `npm run check:text-files` catches it and is NOT in `npm test`.
- **A test declares its basis** — `// @basis <ITEM-ID>, …` or `@basis none - <reason>`; `npm run check:basis` gates it.
- **Prove every assertion by REMOVAL.** Take the mechanism out, watch the test go red, restore it, and say so. **A removal proof that comes back GREEN is a finding, not a pass** — either the fix is unnecessary or the test did not run. Plant an impossible value to tell those apart.
- **Read a suite's own exit code**, never a pipeline's. A run with 88 failures reported exit 0 through `tail` on 2026-09-10.
- **A delegated worker runs no git command that writes.** `RULE-a-delegated-worker-runs-no-git-command-that-touches-the` is hard and active: the dispatching session commits, staging by explicit path.

---

## File Structure

| file | responsibility |
|---|---|
| `src/rules/schema.ts` | the five kinds, the template each requires, and the parse/validate of one entry |
| `src/rules/store.ts` | load the directory, apply the tier filter, expose the set — no fs writes outside the manifest |
| `src/rules/manifest.ts` | checksum per entry, verify, and the `Incomplete`-style refusal |
| `src/rules/deliver.ts` | render the applicable set for injection, and record that it was injected |
| `src/rules/entries/*.md` | the entries themselves |
| `src/cli/commands/rules.ts` | `mycontext rules verify --restore`, `list`, `show` — developer-only |
| `src/ui/maintenance/*` | the maintenance server and its screens (does not ship) |
| `test/rules/*.test.ts` | per-task tests |

`src/rules/` is a new top-level module directory, sibling to `src/core/`. It imports **nothing** from `src/core/` except what it genuinely needs (the Markdown frontmatter parser), because the corpus must not depend on it and it must not depend on the corpus.

---

## Phase 1 — The store, its schema, and its integrity

### Task 1: One entry parses, or it does not load

**Files:**
- Create: `src/rules/schema.ts`
- Test: `test/rules/schema.test.ts`

**Interfaces:**
- Produces: `parseEntry(text: string, path: string): Entry | EntryError`, `type Entry = { id, kind, tier, title, body, example, check, trigger?, request?, sourcePath }`, `type Kind = 'fact'|'prohibition'|'procedure'|'standard'|'definition'`, `type Check = { how: 'preventive'|'detective', name: string } | { how: 'none', why: string }`

- [x] **Step 1: Write the failing test — a prohibition without a `why` does not load**

```ts
// @basis none - the schema this file defines does not exist yet; it rests on
// the D41 spec's §4 table and nothing in the corpus.
test('a prohibition without a why does not load', () => {
  const bad = parseEntry(entry({ kind: 'prohibition', why: undefined }), 'x.md');
  assert.equal('error' in bad, true);
  assert.match((bad as EntryError).error, /why/);
});
```

- [x] **Step 2: Run it and watch it fail** — `node --import ./test/helpers/pin-rendering.ts --test test/rules/schema.test.ts`. Expected: `parseEntry is not defined`.

- [x] **Step 3: Implement `parseEntry` with the per-kind template table**

The table is the schema. Every kind additionally requires `example` and `check`:

```ts
const REQUIRED: Record<Kind, readonly string[]> = {
  fact: ['truth', 'breaks'],
  prohibition: ['prohibition', 'why'],
  procedure: ['steps', 'proof'],
  standard: ['trigger', 'shape'],
  definition: ['term', 'means', 'confusedWith'],
};
const ALWAYS = ['example', 'check'] as const;
```

- [x] **Step 4: One test per kind, each asserting its own missing part** — five tests, five different messages. A single generic test would pass over four kinds silently.

- [x] **Step 5: `check` parses into its three shapes**, and `none` requires a reason:

```ts
test('check: none must carry a reason', () => { … });
test('check: detective names a check', () => { … });
```

- [ ] **Step 6: Commit** — `src/rules/schema.ts`, `test/rules/schema.test.ts`.

### Task 2: The store loads a directory and applies the tier

**Files:**
- Create: `src/rules/store.ts`
- Test: `test/rules/store.test.ts`

**Interfaces:**
- Consumes: `parseEntry` from Task 1.
- Produces: `loadRules(root: string, workspaceIsMyContext: boolean): { entries: Entry[]; refused: EntryError[] }`

- [x] **Step 1: Write the failing test — a developer entry is absent in a foreign workspace**

Assert by **loading against a foreign workspace**, never by reading the flag:

```ts
const inHere = loadRules(RULES, true).entries.map((e) => e.id);
const elsewhere = loadRules(RULES, false).entries.map((e) => e.id);
assert.ok(inHere.includes('never-git-add-all'));
assert.equal(elsewhere.includes('never-git-add-all'), false);
```

- [x] **Step 2: Run it, watch it fail.**
- [x] **Step 3: Implement `loadRules`** — read `*.md`, parse each, partition by tier.
- [x] **Step 4: An unparseable entry is REFUSED and NAMED, never skipped silently** (`INV-nothing-is-dropped-silently`). Assert the refusal carries the path.
- [ ] **Step 5: Commit.**

### Task 3: The corpus never sees the store

**Files:**
- Test: `test/rules/isolation.test.ts`

- [x] **Step 1: Write the tests first — one per surface.** `doctor`, `list`, `ready`, and the injection selector each return nothing from `src/rules/entries/`. Four separate assertions with four messages; a loop would hide which surface leaked.
- [x] **Step 2: Run them.** They should PASS immediately — nothing knows about the store yet. **That is a vacuous pass and it is expected**: this file's value is as a guard against a later task wiring the store into a corpus surface by accident.
- [x] **Step 3: Prove it can fail** — temporarily point `list` at the rules directory, watch it go red, revert. **Record that you did this**, because a guard nobody has seen fail is not a guard.
- [ ] **Step 4: Commit.**

### Task 4: The integrity manifest

**Files:**
- Create: `src/rules/manifest.ts`
- Test: `test/rules/manifest.test.ts`

**Interfaces:**
- Produces: `writeManifest(dir): void`, `verifyManifest(dir): { ok: true } | { ok: false; entry: string; why: 'missing' | 'altered' }`

- [x] **Step 1: Failing test — an altered entry is named**, not merely reported. The message must contain the entry id.
- [x] **Step 2: Failing test — a missing entry is named**, and distinguished from an altered one.
- [x] **Step 3: Implement** using the existing checksum helper rather than a second hash.
- [x] **Step 4: Failing test — a damaged store REFUSES WRITES AND ALLOWS READS.** Two assertions, and the second matters as much as the first: blocking reads punishes a user for an install they can still recover from.
- [x] **Step 5: A comment states the distinction spec §13 draws** — this refusal is not §10's budget refusal. One refuses because we overspent; the other because we cannot say what is true.
- [ ] **Step 6: Commit.**

### Task 5: `mycontext rules` — verify, restore, list, show

**Files:**
- Create: `src/cli/commands/rules.ts`
- Modify: `src/cli/commands/index.ts`, `src/core/command-flags.ts`
- Test: `test/cli/rules.test.ts`

- [x] **Step 1: Failing test — `rules verify` exits non-zero on a planted mismatch and names the entry.**
- [x] **Step 2: Failing test — `--restore` restores from the installed package**, and the network is not consulted. Assert by running with no network path available at all.
- [x] **Step 3: Implement.**
- [x] **Step 4: Add the command to the catalogue partition** in `test/ui/palette-lib.test.ts` — either catalogued, or `UNCATALOGUED` with a reason. **`every command string is catalogued or named as a gap, in BOTH directions` will go red otherwise**, and that gate spent a day red in September because a command shipped without a row.
- [x] **Step 5: Both READMEs.** If the command is gated, the `--yes` row is held to `approvalBoundary().gated` in **both languages** and will fail otherwise. That is the mechanism working.
- [ ] **Step 6: Commit.**

---

## Phase 2 — Delivery, and proving it arrived

### Task 6: Render the applicable set

**Files:**
- Create: `src/rules/deliver.ts`
- Test: `test/rules/deliver.test.ts`

- [ ] **Step 1: Failing test — the rendered text contains every applicable entry and no inapplicable one.**
- [ ] **Step 2: Failing test — `request` is NEVER in the rendered text** (spec §6). Plant an entry with a distinctive request string and assert its absence.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Commit.**

### Task 7: Injection at every door, recorded

**Files:**
- Modify: `src/hooks/session-start.ts`, `src/hooks/pre-compact.ts`, and the subagent-start path
- Create: `src/rules/delivered.ts` (the record)
- Test: `test/rules/delivery.test.ts`

**Interfaces:**
- Produces: `recordDelivery(root, op)`, `wasDelivered(root, sessionId): boolean`

- [ ] **Step 1: Failing test — each door records a delivery.** One test per door, named for the door. The measured op mix says which matters: **1,082 `subagent-start` against 54 `session-start`** in 36,024 records — a design that guards only session start guards the rarest event.
- [ ] **Step 2: Failing test — a later hook asserts the session has had one**, and the assertion fails when a door is removed.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Removal proof, per door.** Remove one door, watch exactly that door's test go red, restore.
- [ ] **Step 5: Commit.**

### Task 8: Precedence, and saying so

**Files:**
- Modify: the injection assembly point
- Modify (corpus, via CLI only): `STD-the-precedence-order-when-four-sources-of-truth-disagree`
- Test: `test/rules/precedence.test.ts`

- [ ] **Step 1: Failing test — a product entry wins over a conflicting corpus item, and the conflict is REPORTED.** Both halves asserted; a silent win teaches a user their rule is being obeyed when it is not.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Update the precedence standard through the CLI** — it now has a fifth source, and leaving it stale would make the corpus disagree with the product. **Never hand-edit the item file.**
- [ ] **Step 4: Commit.**

---

## Phase 3 — The maintenance tool

### Task 9: The server that does not ship

**Files:**
- Create: `src/ui/maintenance/server.ts`
- Modify: `package.json` (`files`)
- Test: `test/rules/maintenance-absent.test.ts`

- [ ] **Step 1: Failing test — the published file list does not include the maintenance directory.** Read `files` from `package.json` and assert. This is the whole security model (spec §11.1), so it is asserted rather than assumed.
- [ ] **Step 2: Failing test — it binds to loopback only, and never to 58888.**
- [ ] **Step 3: Implement**, choosing a free port at start.
- [ ] **Step 4: Commit.**

### Task 10: CRUD, where the form IS the template

**Files:**
- Create: `src/ui/maintenance/screens/*`
- Test: `test/rules/maintenance-form.test.ts`, `e2e/rules-maintenance.spec.ts`

- [ ] **Step 1: Failing test — the form for each kind offers exactly that kind's required parts**, derived from the same table as the schema. If the form and the schema can disagree, the template has stopped being one thing.
- [ ] **Step 2: Failing test — a prohibition cannot be saved without a `why`.**
- [ ] **Step 3: Implement.** Text areas are real editing surfaces — entries are prose, and a one-line input produces one-line thinking.
- [ ] **Step 4: Failing test — an entry moves between tiers, both directions.**
- [ ] **Step 5: Browser proof, BOTH projects**, reading Playwright's own exit code.
- [ ] **Step 6: Commit.**

### Task 11: Budget shown here, enforced at publish

**Files:**
- Modify: `src/ui/maintenance/screens/*`, `src/rules/manifest.ts`
- Test: `test/rules/budget.test.ts`

- [ ] **Step 1: Failing test — publishing REFUSES when the production tier is over budget, and names what to move.**
- [ ] **Step 2: Failing test — a user's install NEVER refuses on budget** (spec §10). The two live in one file so nobody reads one without the other.
- [ ] **Step 3: Failing test — per-entry size is computed, never persisted.** Assert no size appears in any entry file.
- [ ] **Step 4: Failing test — only the production tier counts toward the budget**; the developer tier reports a total and is not counted.
- [ ] **Step 5: Implement.**
- [ ] **Step 6: Commit.**

### Task 12: Publish, with a diff and a question

**Files:**
- Modify: `src/ui/maintenance/*`, `src/rules/manifest.ts`
- Test: `test/rules/publish.test.ts`

- [ ] **Step 1: Failing test — publish shows a diff and does nothing until confirmed.**
- [ ] **Step 2: Failing test — publish regenerates the manifest.**
- [ ] **Step 3: Failing test — the store version and changelog move.**
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Commit.**

### Task 13: A store update under a running session

**Files:**
- Modify: `src/rules/deliver.ts`, the session-scope doors
- Test: `test/rules/update-correction.test.ts`

- [ ] **Step 1: Failing test — the correction carries only the DIFF**, never the whole store.
- [ ] **Step 2: Failing test — it is phrased as supersession and NAMES what it replaces.** Assert the wording, because an update that reads as an addition produces the defect `CLAUDE.md` opens with: five superseded instructions acted on as current.
- [ ] **Step 3: Failing test — session-scope doors only**; a subagent gets the new store outright and no correction.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Commit.**

---

## Phase 4 — Seeding and migration

### Task 14: The first seed entry, and it is the one we were not enforcing

**Files:**
- Create: `src/rules/entries/ask-options-are-numbered.md`
- Create: `scripts/check-ask-numbering.ts`
- Test: `test/rules/seed-numbering.test.ts`

- [ ] **Step 1: Write the entry** — `standard`, tier `developer`; trigger *putting a decision to the owner*; shape *options numbered `1 —`, `2 —`, recommendation first and marked*; example *the question that produced this ruling*; check `detective:ask-numbering`.
- [ ] **Step 2: Failing test — the detective check finds a question in the archive whose options are not numbered.** Plant one.
- [ ] **Step 3: Implement the check** over the conversation archive (D37 indexes every tool call).
- [ ] **Step 4: Run it over the real archive and RECORD THE NUMBER** — how often the standard held before it existed. That number is the store's first piece of evidence about itself.
- [ ] **Step 5: Commit.**

### Task 15: Seed the definitions

**Files:**
- Create: `src/rules/entries/def-*.md`

- [ ] **Step 1:** one entry each for *lane*, *spill*, *stand down*, *the corpus*, *known-red*, *the ration*, *a door*, *prove by removal*. Each needs term, meaning, what it is confused with, an example, and a `check` (most will be `none — <reason>`, honestly).
- [ ] **Step 2: Commit.**

### Task 16: Migrate the candidates, reversibly

**Files:**
- Create: `src/rules/entries/*.md`
- Modify (via CLI only): the migrated corpus items
- Test: `test/rules/migration.test.ts`

- [ ] **Step 1: Failing test — a migrated rule exists in exactly ONE place.** The corpus item is retired and points at its new home; the rule text is not in both.
- [ ] **Step 2: Migrate the product-fact candidates** (spec §15): a body stops at the first `##` · `progress` is not a declared task field · a retired item still exists · `createItem`/`updateItem` are the only write paths · an unknown category means a possible wrong corpus.
- [ ] **Step 3: Migrate the developer candidates**: never `git add -A` · commit with a pathspec · one lane at a time when a lane drives a browser · prove a test by removal · run both browser projects · 58888 is the owner's.
- [ ] **Step 4: Retire each source item through the CLI**, with a pointer. Retiring now also stands it down correctly (D38).
- [ ] **Step 5: Prove it is reversible** — restore one migrated item and assert the corpus is as it was.
- [ ] **Step 6: Commit.**

---

## Phase 5 — The corpus request field (spec §16a)

### Task 17: The field

**Files:**
- Modify: `src/core/content-hash.ts`, the item schema, `createItem`/`updateItem`
- Test: `test/core/request-field.test.ts`

- [ ] **Step 1: Failing test — `request` is NOT in the summary basis.** Add a request, assert the summary does not read stale.
- [ ] **Step 2: Failing test — `request` is never injected.**
- [ ] **Step 3: Failing test — it is optional**, and an agent- or ingest-origin item without one is not a defect.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Commit.**

### Task 18: The backfill, by extraction

**Files:**
- Create: `scripts/backfill-requests.ts`
- Test: `test/core/backfill-requests.test.ts`

- [ ] **Step 1: Failing test — a LANE'S DISPATCH BRIEF IS NEVER TREATED AS THE OWNER'S REQUEST.** This is the load-bearing test of the whole task: a lane's brief is stored as a `type:'user'` record, and a naive sweep finds **1,453,700 characters of person-side text across 280 lanes — 33× the 44,006 he actually typed, none of it his.** Use `loop/2`'s filter.
- [ ] **Step 2: Failing test — an ambiguous mapping SKIPS.** An empty field is honest; a wrong one is not.
- [ ] **Step 3: Implement**, defining "reliable" **before** the sweep runs.
- [ ] **Step 4: The report says WHY, not only how many** — what made one reliable and another not. A coverage number nobody can interrogate is one nobody can trust; `state_unaudited`'s disclosure is the worked example.
- [ ] **Step 5: Prove reversible** — clear the field without touching body, summary or checksum.
- [ ] **Step 6: Run it, and report the real numbers.**
- [ ] **Step 7: Commit.**

---

## Self-review notes for the executor

- **Phase 1 must be whole before Phase 2 starts.** Delivering a store whose integrity is unverified is worse than not delivering it.
- **Task 3 is the one most likely to rot.** It passes trivially today; its value is entirely as a tripwire. If a later task makes it fail, that task is wrong, not the test.
- **Task 18 is the one most likely to do quiet damage.** It writes to 1,076 real items. Run it against a copy first and diff.
- **If a task's test cannot be made to fail, stop and say so.** That is the finding, not an obstacle.
