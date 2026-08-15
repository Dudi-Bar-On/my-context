# Buried Capabilities Documentation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make six capabilities that already work discoverable to a reader, and raise the document's presentation from adequate to professional — without adding a single claim the code does not support.

**Architecture:** A fixture prerequisite unblocks two generated walkthroughs, then one task per buried capability, then subtraction (closed-issue archaeology out), then a presentation pass, then the capabilities summary written last so it maps the document that ships. Every task does both languages.

**Tech Stack:** Markdown rendered by GitHub, Mermaid, GitHub alert callouts. `node:test` for the four documentation tests. Zero runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-08-15-reference-and-catalogue-design.md` — §5, §5b, §5c.

## Global Constraints

- **Every capability here already works.** Nothing in this plan changes behaviour. If a task finds it must change code to make a sentence true, **stop and report** rather than changing it.
- **Never write a sentence asserting a property the code does not have.** Verify by executing. The last documentation pass found seven flags whose real behaviour differed from what was documented; Phase 1 made seven statements false. Treat this as likely, not possible.
- **Present tense is reserved for what ships today.** Planned work lives in §8 and may not use it.
- **Both documents, every task.** `docs/README.he.md` is a structural mirror; `test/docs/parity.test.ts` fails if heading sequences diverge. The Hebrew uses `<span dir="ltr">` isolates inside `<div dir="rtl">` blocks, and fenced blocks sit **outside** the RTL divs — an RTL container reverses box-drawing tables. Terminology rule, from the user: **use the professional Hebrew term where one exists; where none does, leave the English.** `shell` was once rendered קונכייה — seashell.
- **Four tests pin the documentation**: inventory parity, example verification, verbatim injection blocks, EN/HE structural parity. `npm run gen:docs` regenerates example blocks — **never hand-edit one.**
- **Do not put `mycontext <name>` in a code span or fenced block for a command that does not exist** — the inventory test extracts from both, including Mermaid diagrams.
- **Commit before mutating.** Six agents have lost work to `git checkout --` in this project, one of them destroying a full pass of README edits. **Commit first, without exception.**
- `npm test`, `npx tsc --noEmit` and `npm run test:perf` clean. `git status --porcelain` clean. Delete every probe including temp dirs outside the repo.

---

### Task 1: Fixture prerequisite for the two walkthroughs

**Files:**
- Modify: `test/fixtures/docs-workspace/` (add a source document and a staged-rules file)
- Modify: `scripts/doc-fixture.ts` if the materializer needs to carry them
- Test: `test/docs/fixture.test.ts`

**Interfaces:**
- Produces: a fixture that can run `ingest`, `ingest-apply --file`, `lesson`, `lesson-stage --file` and `lesson-accept` end to end. Tasks 4 and 5 depend on this.

The example generator runs `node src/cli/index.ts <command>` with **no stdin**, so `ingest-apply` and `lesson-stage` need `--file`. The ingest session id is deterministic (`ING-<slug>-<pathHash>-<docChecksum>`), so a committed source document makes the whole flow reproducible.

- [ ] **Step 1: Establish what each walkthrough needs**

Run `mycontext ingest`, `ingest-apply`, `lesson`, `lesson-stage` and `lesson-accept` by hand against a scratch copy of the fixture. Write down the exact files and arguments a generated example would need. **Do not guess** — the previous fixture task found `rebuild(ws)` did not exist and the materializer had to copy a whole workspace, not just `.my_context`.

- [ ] **Step 2: Add a source document to the fixture**

A short PRD-shaped Markdown file for the fictional Bookstore API, long enough to chunk meaningfully and short enough that its extraction request is readable in a code block. It must be internally consistent with the existing fixture items.

- [ ] **Step 3: Add the candidate and rule-candidate JSON files**

Whatever `ingest-apply --file` and `lesson-stage --file` consume. These are the model's output in real use; in the fixture they are committed so the walkthrough is deterministic.

- [ ] **Step 4: Verify end to end and check the widths**

Run every command against the materialized fixture. Every block that will be pasted must fit the 100-column budget or be legible at its natural width — check before Tasks 4 and 5 build on it.

- [ ] **Step 5: Commit**

```bash
git add test/fixtures/docs-workspace scripts/ test/docs/fixture.test.ts
git commit -m "test: fixture material for the ingest and lesson walkthroughs"
```

---

### Task 2: Custom categories

**Files:** `README.md`, `docs/README.he.md`, and `src/help/topics/categories.md` if the help topic should carry it too.

**This is the finding that most changes what a reader thinks the product is.** §6 currently reads end to end as a closed set — three profiles, "the definitions live in the catalogue", an enumeration titled "What each category means". A reader whose domain needs `security_control` or `slo` concludes the product does not fit and files the fact under the wrong built-in, which the documentation elsewhere correctly warns is unfixable since `type` cannot change after creation.

The truth: declare a name absent from the catalogue with a `tier` and `description` and you get a first-class category with its own id prefix, participating in tiers, scope, injection and the slash-command generator.

- [ ] **Step 1: Verify it by doing it**

In a scratch workspace, declare a custom category, add an item, and confirm it appears in `help categories`, gets a prefix, and generates slash commands. **Report what you observe**, including anything that does not work as the survey described.

- [ ] **Step 2: Write the section**

Placed immediately after "What each category means", so it lands where the closed-set impression forms. Include the JSON, the resulting item, and **two facts stated plainly**: the id prefix derives from the name unless `prefix` is set, and a custom category gets **no** `extraFields`, so `create_item` will not carry category-specific frontmatter for it.

- [ ] **Step 3: Decide whether the example can be generated**

`materializeDocFixture` supports one fixture config. A custom-category example needs a second. Either extend it or use a hand-verified block — and if hand-verified, say so in a comment so a future reader knows it is not covered by the example test.

- [ ] **Step 4: Hebrew, then verify, then commit**

---

### Task 3: The global layer

**Files:** `README.md`, `docs/README.he.md`

"Rules I follow on *every* project, with the project winning on conflict" is a headline. It is currently two sentences **inside a paragraph about tie-breaking order within a budget**, plus a glossary row — so a reader comes away thinking "layer" is an implementation detail of sorting, which is literally the sentence it appears in.

> [!IMPORTANT]
> **Documenting this surfaces a product gap, and that is a reason to do it, not a reason to stop.** There is no supported way to create a global layer. `mycontext init` creates `.my_context` (underscore) in the cwd; the global root is `.my-context` (hyphen) in the home directory, so `cd ~ && mycontext init` produces a directory nothing reads. No command writes to the global layer — `repair` skips global items, `requireWritableItem` refuses every non-project write.

- [ ] **Step 1: Verify the behaviour and the gap**

Confirm by execution what loads, what wins on a duplicate id, and that no command creates or writes a global layer. `test/core/rebuild.test.ts` and `test/cli/supersede-global-layer.test.ts` pin the behaviour; read them.

- [ ] **Step 2: Write the section**

What it is for, the project-wins-and-shadows rule, and **an honest paragraph on how to create one today**. Do not imply a route that does not exist. Whether to add `init --global` is a product decision, not a documentation one — note it in §8 as planned work if you judge that right, using no present tense.

- [ ] **Step 3: Decide the example**

`scripts/doc-fixture.ts` deliberately excludes `~/.my-context` so the generating machine cannot decide what the docs show. So either a hand-verified block, or extend the materializer with a global-layer fixture. Justify your choice.

- [ ] **Step 4: Hebrew, verify, commit**

---

### Task 4: `query` — the schema and the trap

**Files:** `README.md`, `docs/README.he.md`

Three mentions, none giving a table or column name. There is not one `SELECT` in the whole document beyond the literal string in a table cell.

The command's own usage text already carries the schema **and** a warning the README does not:

> `updated_at` is index write time, not a Markdown timestamp: every query rebuilds the index first, so `updated_at` is rewritten to "now" on every row, every run.

A reader who writes `ORDER BY updated_at DESC` gets a meaningless ordering and no signal. **Lift it, and give it a `> [!WARNING]` callout** — this is exactly the content those exist for.

- [ ] **Step 1: Read the usage text and verify every claim in it by running a query.**
- [ ] **Step 2: Write the subsection** under "Find and read": the schema table, and **three generated worked queries** — a group-by, a `json_extract` on scope, and one answering a question a user would actually ask.
- [ ] **Step 3: Hebrew, regenerate, verify, commit**

---

### Task 5: The lesson → rule flow

**Files:** `README.md`, `docs/README.he.md`

**Depends on Task 1.**

Better framed than ingest was — it has a bolded lead-in — but no worked output and no place in §§1–4, the narrative that teaches what the product does.

- [ ] **Step 1: Run the whole flow** against the fixture and capture what a user sees.
- [ ] **Step 2: Write the section**, positioned where a reader learns what the product does, with a complete generated walkthrough: record a lesson, stage candidates, accept one, see the `derived_from` relation.
- [ ] **Step 3: State two facts plainly.** `lesson-accept` creates an **active** rule with **no confirmation** — it prints "review before it becomes active" and creates it in the same breath. And staged candidates are keyed by a content hash, so re-staging changes the keys. Give the first a `> [!WARNING]`; it is a gate that does not gate.
- [ ] **Step 4: Hebrew, regenerate, verify, commit**

---

### Task 6: Ingest, as a capability rather than three table rows

**Files:** `README.md`, `docs/README.he.md`

**Depends on Task 1.**

**The user read the documentation and concluded this feature did not exist.** It is documented as three rows in a command table 946 lines in. For the capability that turns an existing PRD into reviewable project knowledge, that is a product-sized failure.

- [ ] **Step 1: Write the section**, positioned **beside capture — because it is capture at scale**, not in the command reference.
- [ ] **Step 2: A complete generated walkthrough**: point at a document, see the extraction request, apply candidates as drafts, see them in `review`, promote one.
- [ ] **Step 3: State the two facts that surprise people.** The **model is the extractor** — this surprises anyone expecting a parser, and it is why the output is a *request* rather than a result. And candidates land as **drafts**, which is the answer to "what if it extracts nonsense" and the property that makes ingest safe to try.
- [ ] **Step 4: Cover resumption and `ingest-status`**, since a real PRD is many chunks.
- [ ] **Step 5: Hebrew, regenerate, verify, commit**

---

### Task 7: The skill, and subtraction

**Files:** `README.md`, `docs/README.he.md`

Two unrelated things, batched because both are small and both touch the same file.

**The skill.** `skills/mycontext/SKILL.md` is what makes the model capture knowledge *as it is established* rather than only when asked. It is the whole answer to "will this actually happen without me remembering to do it" — the first question a non-developer has — and it is mentioned once, as an item in a list of what `claude plugin details` prints. Give it a paragraph in §5.

**Subtraction.** Roughly 60 lines of closed-issue archaeology, in a document that gives the global layer two sentences: a 33-line post-mortem of a *fixed* column-width bug sitting in §8 — the section reserved for what does **not** exist — and the `argument-hint` YAML defect told twice at length. **Keep the one durable sentence from each; the rest belongs in `CHANGELOG.md`, which now exists.** Verify nothing else depends on those passages before cutting.

**One correction.** `decay` reports items "not injected lately" and its caveat carefully distinguishes injection from reading — but an item delivered only as an **index line** records nothing in the ledger, so an item Claude sees by name every session reads as stone cold. Add the missing sentence: *an index line is not an injection.* Verify it by running the SessionStart hook and checking the ledger.

- [ ] **Steps: verify, write, cut, Hebrew, regenerate, commit**

---

### Task 8: Presentation

**Files:** `README.md`, `docs/README.he.md`

The document is honest and complete. It does not yet look like a product someone would choose.

**What is available in GitHub Markdown, and what each is for:**

- **Alert callouts** — `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]` render as coloured boxes. This document is full of exactly their content — trust-boundary warnings, "this surprises people" facts, the `updated_at` trap — and all of it is currently flat prose, so the load-bearing warnings look identical to ordinary paragraphs. **Use them where they carry weight and nowhere else**; a document where everything is a callout has no callouts.
- **`<details>`** for reference material that would otherwise bury the narrative — the flag tables are the obvious candidate. **Never to hide substance.**
- **Above the fold** — the first screen decides whether someone reads the rest. Value proposition, badges that reflect something true, and the single most characteristic thing about the product.
- **Mermaid** — five diagrams exist. Check each still renders and still says something true after Phase 1.
- **Consistent heading depth and a table of contents** that survives the new sections.

> [!IMPORTANT]
> Two principles carried from `frontend-design`, which is otherwise about UI and does not apply here: **structure should encode something true rather than decorate it**, and **the opening is a thesis rather than a template**. A device used because it is available is decoration.

- [ ] **Step 1: Audit what exists** — every heading, every table, every diagram — and say what each is doing for the reader.
- [ ] **Step 2: Apply the devices where they earn their place**, and say in your report which you rejected and why.
- [ ] **Step 3: Verify the rendering, not the source.** Render through GitHub's own API (`gh api -X POST /markdown -f mode=gfm`), load it in a browser, screenshot it, and read the screenshots. The Hebrew pass found three defects this way that reading the source could not produce — including maintainer notes leaking above the first heading.
- [ ] **Step 4: Hebrew — and check the RTL interaction.** Alert callouts and `<details>` inside `<div dir="rtl">` are untested territory. Screenshot them.
- [ ] **Step 5: Commit**

---

### Task 9: The capabilities summary

**Files:** `README.md`, `docs/README.he.md`, `test/docs/capabilities.test.ts`

**Written last, deliberately** — it maps the document that ships, not the one that was planned.

A reader who wants to know **what this thing can do** currently has to infer it from 1900 lines. Add a section near the top — after the problem statement, before the mechanics — summarising the capabilities in a form someone can scan in under a minute.

- [ ] **Step 1: Write it.** One line per capability, each linking to its section: capture by hand, capture from a document, derive rules from lessons, inject automatically at four tiers, review what an agent proposes, share knowledge across projects, query the corpus, diagnose it. **It is a map, not a second document.**

- [ ] **Step 2: Pin the correspondence**

```ts
// test/docs/capabilities.test.ts
test('every capability line links to a section that exists', () => {
  // extract the anchors from the summary; assert each resolves to a heading
});

test('every major section is named in the summary', () => {
  // the harder direction: a section with no line is invisible again.
  // Decide what counts as "major" and pin the list, so adding a section
  // without a line fails rather than silently un-mapping the document.
});
```

The inventory test already does exactly this shape for commands and tools. Follow it.

- [ ] **Step 3: Verify both directions by mutation** — remove a line, remove a section; each must redden.
- [ ] **Step 4: Hebrew, regenerate, full verification, commit**

---

## Self-Review

**Spec coverage.** §5 ingest → Task 6. §5b's six findings → Tasks 2, 3, 4, 5, 7 (skill), and the `agentEdits` item **already closed by Phase 1 Task 9** — verify rather than repeat it. §5b's subtraction and the `decay` correction → Task 7. §5c capabilities summary → Task 9. Presentation, which the user asked for during planning → Task 8.

**Placeholders.** Task 9 carries described tests rather than written ones, because what counts as a "major section" depends on the document Tasks 2–8 produce. Named explicitly rather than left implicit.

**Ordering.** Task 1 unblocks 5 and 6. Task 8 must follow 2–7 or it audits a document about to change. Task 9 must be last.

**One risk worth naming:** Tasks 2–7 all edit `README.md` and `docs/README.he.md`. They must run **sequentially**, never in parallel — two agents editing a 1900-line document produces a conflict nobody can review.
