# SDD ledger — plan: docs/superpowers/plans/2026-08-15-buried-capabilities.md

Spec: `docs/superpowers/specs/2026-08-15-reference-and-catalogue-design.md` — §5, §5b, §5c.
Branch: `docs/buried-capabilities`, worktree `.claude/worktrees/my-context-plan4`.

## Rulings

**R1 — the custom-category example blocks are hand-verified, not generated.** The example harness runs
every marker against one shared fixture (`materializeDocFixture`), and declaring a custom category in
that fixture would rewrite the generated `help categories` block, whose whole job in §6 is to enumerate
the 17 categories the `standard` profile enables. There is also no CLI command that writes
`config.json`, so a `&&`-chained marker cannot create the category inside an example run either.
Extending the materializer to a second fixture config would change `runExampleInFixture`'s contract and
the marker format for one block. §6 already carries a dozen hand-verified `text` blocks
(`budgets`, `watchedDocs`, `enabled`), so this is the section's existing convention rather than a new
exception. *Cost if wrong:* these blocks can go stale without a test noticing — mitigated by an HTML
comment in both documents that says so and names the date they were produced.

## Task log

**Task 1 — fixture prerequisite.** `606079b`, `eb99218`. (Landed before this ledger existed.)

**Task 2 — custom categories.** `README.md` §6 gains "Categories you define yourself", placed
immediately after "What each category means"; `docs/README.he.md` mirrors it. 1829 tests, 1828 pass,
1 POSIX-only skip.

Verified by execution in a scratch workspace, not from the survey's report:

- A name absent from the catalogue, declared with `tier` + `description`, becomes a first-class
  category. `mycontext add security_control …` created `SECURI-all-admin-endpoints-require-mfa`; it
  appears in `help categories`, `list`, `examples`, `doctor`, the session index, just-in-time
  injection on `src/admin/**` (PreToolUse hook), and pinned injection after `mycontext pin`. The MCP
  `create_item` tool accepts it and lands the agent's version as a draft.
- Prefix derivation: first six `[a-z0-9]` of the name, uppercased. `security_control` → `SECURI-`.
- `prefix` on a **built-in** override is accepted and silently ignored — `{"rule":{"prefix":"POLICY"}}`
  loads clean and ids stay `RULE-`. `resolveConfig` reads `override.prefix` only in the
  custom-category branch (`src/core/config.ts:241`); no branch handles it for a built-in. Documented
  as a defect rather than a capability. Tracked as backlog item "Config overrides silently drop
  extraFields and prefix".
- Two custom names sharing their first six alphanumerics (`standard_ops`, `standardize`) resolve to
  the same prefix with no warning. Documented as the reason to set `prefix`.
- `extraFields: []` is hardcoded for a custom category (`config.ts:245`) and there is no config key to
  declare one. `create_item` **refuses** an undeclared field rather than dropping it, which is the
  stronger and more useful statement than "it will not be carried".

**One false statement found and corrected.** `README.md` §6 (`categories.<name>.enabled`) said
`npm run gen:commands` stops generating `/mycontext:add-standard` when the category is disabled.
`scripts/gen-commands.ts:28` calls `generateCommands(resolveConfig({}))` — the **default** config — so
the committed `commands/` directory does not follow a project's config at all. `generateCommands`
itself does read whatever config it is handed (custom categories included, and it refuses two names
that would produce the same command file), but nothing regenerates `commands/` from a user's config.
Corrected in both documents; the new section states the same boundary rather than repeating the
survey's "participates in the slash-command generator", which is true of the function and false of a
user's project.

**R2 — the global-layer example blocks are hand-verified, not generated.** `runExampleInFixture`
points every generated command's `HOME`/`USERPROFILE` at an empty directory (`emptyHome`,
`scripts/gen-doc-examples.ts`) precisely so that whether the generating machine has a `~/.my-context`
cannot decide what the documentation shows — the same guarantee `scripts/doc-fixture.ts` documents for
excluding the global layer from the fixture. Generating a block here would mean weakening it, or
adding a second committed corpus plus an opt-in marker syntax that materializes it into a scratch
`HOME`. And a `&&`-chained marker cannot build one inside an example run either: no `mycontext`
command creates or writes a global layer, so the only step that puts a corpus at `~/.my-context` is a
directory rename, which the harness cannot run. *Cost if wrong:* the same as R1 — mitigated by the
HTML comment in both documents naming the date and saying `examples.test.ts` does not cover them.

**Task 3 — the global layer.** `README.md` §4 gains "The global layer — knowledge that follows you
across projects" (with `#### Creating one, today`), placed before "The budget…" so the term is defined
before the tie-break paragraph uses it; that paragraph's duplicated two-sentence definition is
replaced by a link. §8 gains "Creating and writing a global layer (unscheduled)". The §9 glossary row
links to the new section. `docs/README.he.md` mirrors all three. 1829 tests, 1828 pass, 1 POSIX-only
skip; `npx tsc --noEmit` and `npm run test:perf` clean; `npm run gen:docs` reports both documents
unchanged.

Verified by execution in a scratch `HOME` (`HOME` **and** `USERPROFILE`, as `gen-doc-examples.ts`
does), never from the survey:

- **`cd ~ && mycontext init` really does produce `~/.my_context`** — the underscore spelling, which
  nothing reads. Confirmed by running it.
- **A global layer loads from `items/` alone.** `loadLayer` walks `<root>/items`; a `config.json` at
  the global root is never read, because `resolveWorkspace` takes configuration from the project only.
  Consequence, verified: a global item whose category the project has disabled is still indexed and
  listed, and appears in the session index as `1 postmortem (disabled/unknown category)`, but is never
  selected for injection there.
- **A global item governs.** After `mycontext pin`, the SessionStart hook injected it in full under
  `## my_context — these govern this project`. A global item with `scope: src/**` was injected by the
  PreToolUse hook on `src/app.ts` and not on `docs/x.md`, so scope is matched against the project you
  are in.
- **Project wins and shadows.** Same id in both layers: `mycontext list --full` shows `layer project`
  and `mycontext rebuild` exits 0 while reporting the collision. The message names the id and both
  layers — but **both file paths are relative to their own layer's root, so for the same category and
  id they read identically**. The task brief's "naming both files" is literally true and practically
  misleading; the section says so explicitly rather than implying two distinguishable paths.
- **Every write refuses.** `edit`, `pin`, `harden` and `supersede` all print the one
  `globalLayerRefusal` sentence and exit 1. `mycontext repair` re-stamps project items only and names
  the global ones it skipped, telling you to run it "from the global layer's own workspace".
- **The route that works, verified end to end:** `mycontext init` in a scratch directory, `mycontext
  add` the items, then rename `<dir>/.my_context` to `~/.my-context`. Every item is written by the
  code that writes any item, so checksums are computed rather than typed — materially better than the
  survey's "hand-author the files", and the honest paragraph says that instead. Renaming it back makes
  it an ordinary project again, which is exactly the workspace `repair` tells you to run from and the
  route for editing a global item later. Documented as a gap, not a design, in both §4 and §8.
- **A symlink at `~/.my-context` was NOT verified and is not documented.** MSYS `ln -s` on this
  machine copied the directory instead of linking it (`test -L` false), so the probe proved nothing.
  Nothing was written about it.

`init --global` is named in §8 only, in the conditional ("would close it"), with the explicit
statement that neither it nor a way to direct a capture at the global layer exists or is placed in a
wave. No present tense.

**One pre-existing defect found, not fixed (out of Task 3's scope).** `docs/README.he.md` carries a
link to `#התקציב-ומה-קורה-כשזה-לא-נכנס` while the heading slugs to
`#התקציב-ומה-קורה-כשלא-נכנסים-בו` — a broken anchor that predates this task. Verified by rendering
through `gh api -X POST markdown`. Task 8 owns link and rendering verification.

**Task 4 — `query`: the schema and the trap.** `README.md` gains `#### The index schema, and how to
query it`, placed at the end of "What you run: the CLI" (immediately before "Detail levels, and
`--json`", whose existing `query --json` paragraph it now sits beside), with the "Find and read"
table's `query` row linking to it so the pointer lands where the "this is for someone else"
impression forms. `docs/README.he.md` mirrors it as `#### הסכמה של האינדקס, ואיך לתשאל אותה`. Three
generated example blocks, **34, 54 and 49 columns wide** — all inside the 100-column budget. 1829
tests, 1828 pass, 1 POSIX-only skip; `npx tsc --noEmit` and `npm run test:perf` clean; `git status
--porcelain` clean; every probe and the temp fixture directory deleted.

Every claim verified by execution against a materialized doc fixture, never lifted from the usage
text on trust:

- **The usage text is accurate.** `items(id, type, title, status, always, has_scope, layer,
  file_path, updated_at, data)` matches `sqlite_master` exactly, and the `updated_at` warning is true
  as written. Nothing in it was found wrong — the first usage string this documentation pass has
  checked that survived verification unchanged.
- **The `updated_at` trap, reproduced.** The same `SELECT id, updated_at` run twice against an
  untouched fixture returned `17:49:26` and then `17:49:30`. `CURRENT_TIMESTAMP` is UTC and matched
  `date -u` on this machine, so "UTC" is stated rather than assumed.
- **What the usage text omits, documented here for the first time.** Two more tables share
  `.index.db`: `schema_version(version)` (one row, holding `2` today — the section says "the version
  of the index format", not the number) and `ledger(session_id, item_id, tier, injected_at)`, which
  `mycontext decay` reads. `Ledger.open` creates the latter, not `rebuild`, so a freshly-materialized
  fixture has no `ledger` at all: `SELECT * FROM ledger` there fails with `no such table: ledger`,
  while the same query in this repository returns rows. Both halves were run.
- **`data` is camelCase; the frontmatter is snake_case.** The file says `valid_from`/`source_file`;
  the JSON says `validFrom`/`sourceFile`, and adds `body`, `observations`, `relations` and `extra`.
  `json_extract(data, '$.valid_from')` returns `NULL` rather than erroring, so the misspelling reads
  as an empty field. A trap of the same class as `updated_at`, and it had no mention anywhere.
- **The security boundary, taken from `query.ts`'s own comments rather than from memory.** The
  section says two mechanisms and neither is a complete SQL sandbox: the prefix/keyword check
  (explicitly incomplete — a denylist over a full grammar cannot be complete) plus a read-only
  connection, which is what the engine enforces for writes to the three tables in `dbPath`. It names
  `VACUUM INTO '<path>'` as the one statement the read-only connection does not stop, for which the
  keyword check is the only barrier. `VACUUM INTO` was confirmed refused by that check; no attempt
  was made to defeat it. No stronger guarantee is implied anywhere in the section.
- **The 1000-row cap and `--json` were re-confirmed**, since README §5 already described both:
  `--limit 2` printed `2 row(s) shown — capped, there are more` plus the widening notice, and
  `--json --limit 2` emitted `{ rows, rowCount, truncated, limit, loadErrors }` with
  `truncated: true`. Both already-documented statements are true; nothing was changed.
- **The third worked query answers something the CLI cannot.** "Which items are tagged `privacy`" —
  `query_items` filters by tag and no CLI command does, checked against the flag table rather than
  asserted. Its first draft, `FROM items, json_each(…)`, failed with `ambiguous column name: id`
  (`json_each` has an `id` column of its own); the shipped `EXISTS` form was run and its real output
  pasted by `npm run gen:docs`.

**One rendering defect found in RTL, and worked around rather than left as a limitation.** A GitHub
alert callout does **not** render inside `<div dir="rtl">`: `gh api -X POST markdown -f mode=gfm`
returns a plain `<blockquote>` containing the literal text `[!WARNING]`. The working form, also
verified through the API, is the alert **outside** the RTL div with a nested `<div dir="rtl">` inside
the blockquote — that renders as `markdown-alert markdown-alert-warning` with right-to-left content.
Both READMEs were rendered end to end through the API and the new sections read correctly. Task 8
should adopt this pattern for every Hebrew callout it adds: the "fences outside the RTL div" rule now
has a second member.
