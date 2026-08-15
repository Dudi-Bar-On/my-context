# User Surface Phase 1 — Editing Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a human a supported way to edit any item, with a gate that scales to what the edit can actually do, and make agent edits to content a per-category policy rather than an unguarded hole.

**Architecture:** Two new per-category config keys (`agentEdits`, `scopePolicy`) drive everything. Scope policy changes what an empty scope means at selection and at capture. Agent content edits either apply or become staged revisions that `review` surfaces as a diff. A new `edit` command carries the human path, with `pin`/`harden` as named entry points onto the same implementation.

**Tech Stack:** Node 24 native TypeScript type-stripping (no build step, `erasableSyntaxOnly`), `node:test`, `node:sqlite`. Zero runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-08-15-mycontext-user-surface-design.md`

## Global Constraints

- **Zero runtime dependencies.** Only `typescript` and `@types/node`, devDependencies only.
- **Node >= 24.0.0**, sources run directly. Only erasable syntax: no `enum`, no `namespace`, no parameter properties. Every relative import carries an explicit `.ts` extension.
- **Never write a comment, message, doc or corpus item asserting a property the code does not have.** 25+ recorded occurrences; four of the last review's six blockers were instances. If a claim cannot be verified, say so plainly instead.
- **Nothing is ever dropped silently** (`INV-nothing-is-dropped-silently`). A field accepted and ignored is the failure this codebase treats as unacceptable — it is the reason §3 and §4b exist.
- **Markdown is the source of truth**; `files → DB → files` must be byte-identical. Any new field must survive parse → render → parse.
- **Every change needs a test that fails without it.** Verify by reverting. Mutate each guard and confirm a test kills it. **Commit before mutating — five separate agents have lost work to `git checkout --` during mutation in this project. Commit first, without exception.**
- **Verify by executing, not by reading.** Every round of this project found that reviews which ran the code caught what reviews that read it did not, without exception. This plan's code sketches have been wrong before: `COMMANDS` is a `Map`, not an array; `rebuild(ws)` does not exist. **Treat every sketch below as a statement of intent and check the real signature.**
- **Documentation is pinned by four tests** (inventory parity, example verification, verbatim injection blocks, EN/HE structural parity). `npm run gen:docs` regenerates example blocks — **never hand-edit one**. Both `README.md` and `docs/README.he.md` must stay in step; the Hebrew uses `<span dir="ltr">` isolates inside `<div dir="rtl">` blocks.
- **Reports are held to a 100-column budget** (`OUTPUT_WIDTH`), enforced by a test that measures at hostile id length (67 characters). Any new output joins it.
- `npm test`, `npx tsc --noEmit` and `npm run test:perf` clean at every commit. `git status --porcelain` clean. Delete every probe, including temp dirs outside the repo.

---

### Task 1: Two new per-category config keys

**Files:**
- Modify: `src/core/config.ts` (`RawCategory`, `ResolvedCategory`, `resolveConfig`)
- Modify: `src/core/categories.ts` (defaults per category)
- Test: `test/core/config.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ResolvedCategory` gains `agentEdits: 'allow' | 'review'` and `scopePolicy: 'global' | 'required' | 'inert'`. Every later task reads these off the resolved config, never off `CATEGORIES`.

**Defaults, and they must be justified in the code, not merely set:** `agentEdits` defaults to `review` for normative categories and `allow` for rationale, because §2 establishes that only normative content changes what an agent is told to do. `scopePolicy` defaults to `global` for every category — that is the semantics the product was just corrected to, and the one requiring no input from a user with nothing to restrict.

- [ ] **Step 1: Write the failing tests**

```ts
// test/core/config.test.ts — add to the existing file
test('agentEdits defaults by tier and scopePolicy defaults to global', () => {
  const c = resolveConfig({});
  assert.equal(c.categories.rule.agentEdits, 'review');
  assert.equal(c.categories.lesson.agentEdits, 'allow');
  for (const cat of Object.values(c.categories)) assert.equal(cat.scopePolicy, 'global');
});

test('a retiered category takes the new tier default, not the catalogue one', () => {
  const c = resolveConfig({ categories: { lesson: { tier: 'normative' } } });
  assert.equal(c.categories.lesson.agentEdits, 'review');
});

test('an explicit setting beats the tier default', () => {
  const c = resolveConfig({ categories: { rule: { agentEdits: 'allow' } } });
  assert.equal(c.categories.rule.agentEdits, 'allow');
});

test('setting one category does not reset another', () => {
  const c = resolveConfig({
    categories: { rule: { agentEdits: 'allow' }, pattern: { scopePolicy: 'required' } },
  });
  assert.equal(c.categories.rule.scopePolicy, 'global');
  assert.equal(c.categories.pattern.agentEdits, 'review');
  assert.equal(c.categories.constraint.enabled, true);
});

test('an invalid value is refused, naming the key and the valid set', () => {
  assert.throws(() => resolveConfig({ categories: { rule: { agentEdits: 'maybe' } } }),
    /agentEdits.*allow.*review/s);
  assert.throws(() => resolveConfig({ categories: { rule: { scopePolicy: 'everywhere' } } }),
    /scopePolicy.*global.*required.*inert/s);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test test/core/config.test.ts`
Expected: FAIL — the properties do not exist.

- [ ] **Step 3: Implement**

Add to `RawCategory` and `ResolvedCategory`, with validators shaped like the existing `isValidTier`. **Reuse `enumError` from `src/core/mutate.ts`** — it is already the single vocabulary for "that is not one of the allowed values" across four surfaces; a fifth wording is the drift this project keeps producing.

Note that the tier default must be computed from the **resolved** tier, so a category retiered in config takes the new tier's default. The third test above pins that.

- [ ] **Step 4: Run to verify they pass, then mutate**

Run: `node --test test/core/config.test.ts`, then `npm test`.
Commit, then mutate: swap the tier used for the default; drop each validator; make the merge replace instead of merging. Each must be killed.

- [ ] **Step 5: Commit**

```bash
git add src/core/config.ts src/core/categories.ts test/core/config.test.ts
git commit -m "feat: per-category agentEdits and scopePolicy settings"
```

---

### Task 2: Scope policy at selection and capture

**Files:**
- Modify: `src/core/select.ts` (`matchesScope`)
- Modify: `src/core/mutate.ts` (capture refusal)
- Modify: `src/core/render-item.ts` (`SCOPE_UNRESTRICTED` and friends)
- Test: `test/core/select.test.ts`, `test/core/mutate.test.ts`, `test/cli/scope-rendering.test.ts`

**Interfaces:**
- Consumes: Task 1's `scopePolicy`.
- Produces: `matchesScope(item, target, config)` — **the signature changes**; every caller must pass config. Find them all: the previous scope change found the rule had *two* implementations, one of them a `has_scope` filter in SQL. Search for both the function and any other place an empty scope is interpreted.

**Three requirements from spec §4b, each of which has bitten this codebase:**

1. **`required` refuses at capture, not at injection.** An item that exists but can never be injected is the defect just removed — do not reintroduce it under a config key. Refuse at `add`, `create_item` and ingest apply, naming the flag to pass.
2. **`inert` makes `(unrestricted)` a lie.** That word is now the single spelling across six surfaces via `SCOPE_UNRESTRICTED`. Under `inert` the item is restricted to *nothing*. Whatever renders must be true under all three policies and must go through the shared helper — `test/cli/scope-rendering.test.ts` already fails if any surface inlines its own wording, including a structural half that catches a brand-new site.
3. **Changing policy does not rewrite items.** An item captured under `global` and read under `inert` changes behaviour without its file changing. That is legitimate, but `doctor` should be able to say so and the documentation must state it.

- [ ] **Step 1: Write the failing tests**

```ts
test('an unscoped item injects everywhere under global', () => { /* existing behaviour, keep */ });

test('an unscoped item is never JIT-injected under inert', () => {
  // config: { categories: { rule: { scopePolicy: 'inert' } } }
  // assert the item appears in the index tier and never in jit, for any path
});

test('capture without a scope is refused under required, naming the flag', () => {
  // assert the message names --scope, and assert NO file was written and NO db row exists
});

test('required refuses on every capture surface', () => {
  // add, create_item (MCP), ingest apply — all three
});
```

- [ ] **Step 2: Run to verify they fail**

- [ ] **Step 3: Implement, and find every caller**

Do not assume `matchesScope` is the only place. Run the suite after changing its signature and read every compile error as a checklist; then grep for `scope.length`, `has_scope`, and any SQL filtering on scope.

- [ ] **Step 4: Verify the budget and the renderings**

Run the scope-rendering agreement test and the layout-budget test. Whatever `inert` renders as must fit and must agree everywhere.

- [ ] **Step 5: Commit**

```bash
git add src/core test/
git commit -m "feat: scope policy governs what an empty scope means"
```

---

### Task 3: Inert fields are refused on the rationale tier

**Files:**
- Modify: `src/core/mutate.ts` (validation on create and update)
- Test: `test/core/mutate.test.ts`

**Interfaces:**
- Consumes: the resolved tier.
- Produces: a refusal every write surface inherits, since they all reach `createItem`/`updateItem`.

Setting `--always` or `--severity` on a rationale item is accepted today and does nothing: `select` filters `isNormative` **before** it filters `always`, and severity gates nothing outside the normative tier. That is a silent drop.

**Decide `scope` separately and justify it.** Unlike the other two, `scope` on a rationale item is inert *for injection* but is not meaningless: it records which part of the codebase a decision was about, and `query_items({path})` uses it. Refusing it would break that. Do not assume the three behave alike because the spec lists them together — this is the open sub-question in spec §3, and your answer belongs in the report and in a code comment.

- [ ] **Step 1: Write the failing tests**

```ts
test('always on a rationale item is refused, not ignored', () => {
  assert.throws(() => createItem(ctx, { type: 'decision', title: 'x', always: true, origin: 'human' }),
    /always.*normative/s);
});

test('severity on a rationale item is refused, not ignored', () => { /* same shape */ });

test('the refusal names why, not just what', () => {
  // the message must explain that the field exists on every item but only governs
  // on the normative tier, and name the alternative (retier the category, or
  // capture it as a normative item)
});

test('a retiered category follows the resolved tier, not the catalogue', () => {
  // lesson retiered to normative: always is now accepted
});
```

- [ ] **Step 2: Run to verify they fail. Step 3: Implement. Step 4: Mutate and confirm killed.**

- [ ] **Step 5: Commit**

```bash
git commit -m "fix: refuse fields that would be inert rather than accepting them"
```

---

### Task 4: Staged revisions — the store

**Files:**
- Create: `src/core/revision.ts`
- Test: `test/core/revision.test.ts`

**Interfaces:**
- Consumes: nothing from Tasks 1–3.
- Produces: `stageRevision(ctx, itemId, changes, origin)`, `pendingRevisions(ctx)`, `revisionFor(ctx, itemId)`, `promoteRevision(ctx, itemId)`, `discardRevision(ctx, itemId)`. Tasks 5–7 call these. **Settle the exact signatures here and record them in the ledger** — later tasks cannot see this file's history.

**Reuse rather than invent.** This codebase already solves "propose, hold, approve or reject" twice: lesson staging (`src/lesson/derive.ts`, `.staging/`) and ingest sessions (`src/ingest/session.ts`, append-only JSONL, `hasApplied`/`setApplied` accessors, a workspace lock). Both took multiple rounds to get right on interrupt and concurrency. **Read both, choose one to model on, and say which and why.**

Non-negotiable properties:

- A staged revision is **never injected**. Test it against the real selection path, not just the store.
- A revision is **not an item**: it must not appear in `list`, be selectable, or move any count of what governs.
- Discarding must not lose the proposal silently — the corrupt-staging defect (`loadStaging` returning `null` for both "absent" and "unparseable", so a discarded candidate came back pending) is the failure to avoid.
- **Decide what happens to a stale revision** — one whose base text a human has since changed — and to a second revision arriving while one is pending. The wrong outcome is a promotion that silently discards an intervening human edit. Spec §4 names this; your answer must be visible to the user, not just correct.

- [ ] **Step 1: Write the failing tests, including the two hard cases**

At minimum: stage → read back; stage → promote → item changed and revision gone; stage → discard → item unchanged and the proposal recoverable or explicitly reported as destroyed; a revision is invisible to `select`; a stale revision behaves as you decided and says so; two revisions behave as you decided.

- [ ] **Step 2–4: Red, implement, mutate.**

Mutation must include: deleting the never-injected guard; making discard silent; making promote ignore staleness.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: staged revisions for agent content edits"
```

---

### Task 5: Route agent content edits through the policy

**Files:**
- Modify: `src/core/mutate.ts` (`updateItem`)
- Test: `test/core/mutate.test.ts`, `test/mcp/tools.test.ts`

**Interfaces:**
- Consumes: Task 1's `agentEdits`, Task 4's `stageRevision`.
- Produces: `updateItem`'s existing return shape, extended to report that a change was staged rather than applied. Tasks 6–7 render it.

An agent's edit to **title, body, observations or tags** consults the category's `agentEdits`:

- `allow` → applies immediately, as today.
- `review` → staged; the item is unchanged and keeps governing.

**`agentEdits: allow` must not read as "agents may do anything to this category."** `scope`, `always`, `severity` and `status` on a governing normative item stay human-only regardless — that guard is `guardedChange` and it is not yours to widen. A test must pin that `allow` does not open it.

The response an agent receives must make clear its edit did **not** take effect, and how a human sees it. An agent told "updated" for a staged change would go on to reason about text that is not in force.

- [ ] **Step 1: Write the failing tests**

```ts
test('under review, an agent content edit is staged and the item is unchanged', () => {
  // assert the file on disk is byte-identical, the store row is unchanged,
  // and the returned message says staged, not updated
});

test('under allow, an agent content edit applies immediately', () => { /* … */ });

test('agentEdits: allow does not open the reach-and-force gate', () => {
  // agent sets severity on a governing item under allow → still refused
});

test('a human edit is never staged', () => { /* origin human applies directly */ });
```

- [ ] **Steps 2–4: Red, implement, mutate.** Commit before mutating.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: agent content edits follow the category's agentEdits policy"
```

---

### Task 6: `review` surfaces pending revisions

**Files:**
- Modify: `src/cli/commands/review.ts`
- Modify: `src/cli/commands/status.ts` (counts)
- Test: `test/cli/review.test.ts`, `test/cli/status.test.ts`

**Interfaces:**
- Consumes: Task 4's `pendingRevisions`/`promoteRevision`/`discardRevision`.
- Produces: nothing later tasks consume.

`review` currently walks the draft queue. It gains a second queue: items with a pending revision, shown as a **diff against the current text** so the reviewer approves a change rather than a hash.

Requirements:

- The diff must show what is actually changing. `review promote`'s preview was criticised in audit for omitting `always`, the field with the largest injection footprint — do not repeat that shape by showing a truncated diff.
- The two queues must not be confused in any count. **Every number that appears in more than one place must agree** — five contradictions of exactly this kind shipped in one plan, and `status` and `review` disagreeing about a queue length is the same defect.
- Output joins the layout budget test at every detail level, measured at hostile id length.
- Promotion and rejection use the existing `confirmAction` gate.

- [ ] **Step 1: Write the failing tests, including the agreement test**

```ts
test('status and review agree about the number of pending revisions', () => {
  // parse both outputs; assert the numbers match. One helper, enumerated once —
  // a surface checked separately is a surface excluded from the agreement.
});
```

- [ ] **Steps 2–5: Red, implement, mutate, commit.**

```bash
git commit -m "feat: review walks pending revisions as well as drafts"
```

---

### Task 7: The `edit` command

**Files:**
- Create: `src/cli/commands/edit.ts`
- Modify: `src/cli/commands/registry.ts` (registration)
- Test: `test/cli/edit.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `mycontext edit <id> [--title|--body|--scope|--tags|--severity|--always|--status] [--yes]`, and the internal function Task 8's named commands call.

**The gate scales — spec §2's table is the specification:**

| case | gate |
|---|---|
| Rationale item, content | none |
| Rationale item, reach or force | refused (Task 3) |
| Normative draft, anything | none |
| Normative active/validated, content | preview, then confirm |
| Normative active/validated, reach or force | preview showing what governs before and after, then confirm |

Follow `review promote` and `supersede` for the preview-then-confirm shape. The preview must name what is actually being approved: the field, its old and new value, and **what it means for injection** — and it must not claim an item will be injected when it will not. A preview that said exactly that was caught during `supersede`'s implementation, because `select` filters `isNormative` before scope.

`edit` becomes the **sixth** entry on the approval-gate list. That list is pinned by `test/plugin-assets.test.ts` across `README.md`, `docs/README.he.md`, `skills/mycontext/SKILL.md` and `src/help/topics/workflow.md`. Extend the pin; do not add a fifth place to remember.

Register through `COMMANDS` (a `Map`), so `edit` inherits unknown-flag refusal, the F2 exit-code rule and the detail-level conventions. `test/cli/f2-registry.test.ts` iterates the live registry and will exercise it automatically.

- [ ] **Step 1: Write the failing tests, one per row of the table above**, plus: unknown flag refused; `--yes=false` refuses; a non-existent id reports clearly; a global-layer item is refused as `review promote` refuses one.

- [ ] **Steps 2–5: Red, implement, mutate, commit.**

```bash
git commit -m "feat: mycontext edit, with a gate that scales to the change"
```

---

### Task 8: `pin` / `unpin` / `harden` / `soften`

**Files:**
- Modify: `src/cli/commands/edit.ts` (shared implementation), `src/cli/commands/registry.ts`
- Test: `test/cli/edit.test.ts`

**Interfaces:**
- Consumes: Task 7's implementation.
- Produces: four commands that are entry points onto it, not reimplementations.

`pin <id>` is `edit <id> --always true`. `harden <id>` is `edit <id> --severity hard`. Same preview, same gate, same result.

**The two mechanisms must stay consistent or they drift**, and this is the shape that finally retired the F2 exit-code defect after five recurrences: **one test enumerating every entry point in a single assertion**, not one test per command. A surface checked separately is a surface excluded from the agreement — proven in this project when a per-preview test stayed green on a mutant that made one preview disagree.

- [ ] **Step 1: Write the enumerating agreement test**

```ts
test('the named commands and their edit equivalents produce identical results', () => {
  for (const [named, equivalent] of [
    [['pin', id], ['edit', id, '--always', 'true']],
    [['unpin', id], ['edit', id, '--always', 'false']],
    [['harden', id], ['edit', id, '--severity', 'hard']],
    [['soften', id], ['edit', id, '--severity', 'soft']],
  ]) {
    // run each in its own fresh workspace; assert identical stdout and identical item file
  }
});
```

- [ ] **Step 2: Verify it fails.** Then implement, then mutate: make one named command diverge and confirm this test — not another — catches it.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: pin, unpin, harden and soften as named entry points"
```

---

### Task 9: Documentation and dogfooding

**Files:**
- Modify: `README.md`, `docs/README.he.md`, `src/help/topics/*.md`, `skills/mycontext/SKILL.md`
- Modify: `CHANGELOG.md`
- Test: the four documentation tests

**Interfaces:** consumes everything above.

- [ ] **Step 1: Document the two config keys**

`agentEdits` and `scopePolicy` in §6 of both READMEs, each shown changing an actual outcome. State the defaults and where they come from. State plainly that `agentEdits` covers title, body, observations **and tags** — a user who reads "bodies" and gets title too should find that written down.

- [ ] **Step 2: Document `edit` and the named commands**

Including the gate table from spec §2, in the reader's language rather than the spec's.

- [ ] **Step 3: Update the approval-gate list in all four pinned places**

- [ ] **Step 4: Regenerate and verify**

Run `npm run gen:docs`, then `npm test`. The inventory test fails if `edit`, `pin`, `unpin`, `harden` or `soften` is undocumented.

- [ ] **Step 5: Dogfood it**

Use the new commands against this repo's own corpus — set `agentEdits: review` on a category, have an agent edit an item, walk it through `review`. Read every output as a user would. **This practice found more defects in Plan 4 than any other technique**, including three that every test had passed.

- [ ] **Step 6: Commit**

```bash
git commit -m "docs: the editing surface and its configuration"
```

---

## Self-Review

**Spec coverage.** §2 gating → Task 7's table, one test per row. §3 inert fields → Task 3, with `scope` explicitly left open. §4 `agentEdits` → Tasks 1, 5. §4 staged revisions → Tasks 4, 6, including the stale-revision question. §4b `scopePolicy` → Tasks 1, 2, with all three of its named hazards. §6 named commands → Task 8's enumerating test. §9 unchanged things → respected: no task touches ids, the file format, the tiers, or adds a delete.

**Not in this plan, by design:** §5's slash surface, §6's asking flow and §7's SQL help are Phase 2.

**Placeholders.** Task 2's and Task 4's test bodies are described rather than written, because both depend on decisions the implementer must make first (which callers exist; which staging mechanism to model on). Every other test step carries real code. Those two tasks name exactly what must be asserted.

**Type consistency.** `ResolvedCategory`'s two new fields (Task 1) are read by Tasks 2, 3, 5. `matchesScope`'s signature change (Task 2) is flagged as breaking for every caller. Task 4's five function names are used by Tasks 5–7 and must be settled in Task 4 and recorded in the ledger.

**One risk worth naming:** Task 4 is much larger than the others and is the only one introducing new persistent state. If it proves bigger than one task, split it — store first, then lifecycle — rather than letting it sprawl.
