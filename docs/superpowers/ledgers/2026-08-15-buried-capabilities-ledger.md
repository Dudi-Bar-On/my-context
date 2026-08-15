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

**Task 5 — the lesson → rule flow.** `1ff6d10`. `README.md` §3 gains `#### From an incident to a
rule`, at the end of "Step 1 — you capture it" and before Step 2: the flow is another way an item
gets *created*, so it belongs to the capture step rather than after the three-step narrative closes.
`docs/README.he.md` mirrors it as `#### מתקרית לכלל`. §5's `lesson-accept` paragraph links to it.
Four generated blocks, the four commands Task 1 settled, and Task 1's measurements reproduced
exactly: the derivation request **77 lines / 283 columns**, `lesson-stage` 10/111, `lesson-accept`
8/118, `show` 25/80. 1832 tests, 1831 pass, 1 POSIX-only skip; `npx tsc --noEmit` and
`npm run test:perf` clean; `npm run gen:docs` reports both documents unchanged on a second run;
`git status --porcelain` clean; every probe and temp directory deleted.

**Both stated facts held when run.** Neither was taken from the survey.

- **`lesson-accept` creates an active rule with no confirmation.** One invocation prints
  `about to create this rule — review before it becomes active:` followed by the candidate, then
  `created RULE-retries-add-jitter-to-backoff (active) with derived_from
  [[LESSON-retry-storms-need-jitter]]`. There is no `--yes` on the command and no second step;
  `cmdLessonAccept`'s own comment says the peek "does not, and cannot, verify that a human actually
  read what was printed". The `> [!WARNING]` says the preview describes something already decided,
  and points at §7, which already counts the command among the eight.
- **Staging keys are content hashes.** `candidateKey` (`src/lesson/derive.ts:377`) hashes
  `{directive, lower-cased title, body, sorted scope, severity}` and takes eight characters.
  Reproduced: rewording one candidate's body and re-staging turned `47c76d53` into `838b1804`, and
  the command reported the old key under "1 previously pending candidate(s) dropped — this
  derivation did not produce them again". The already-accepted `99eb0e3d` carried forward and
  appeared in neither list, which is why the second stage reports **1** pending rather than 2. The
  section says re-staging replaces the pending set, names what it prints, and states that accepted
  and discarded candidates carry forward.

**`<details>` DOES render inside `<div dir="rtl">`** — unlike a GitHub alert callout, which Task 4
found does not. Verified through `gh api -X POST markdown -f mode=gfm`: the nested
`<details>`/`<summary>` survives with its Hebrew content intact. It is nevertheless placed
**outside** the RTL div here, because the fence it contains must be, per the file's own convention.
The form used: `<details>` outside, `<summary dir="rtl">` for the label, the fenced block directly
inside, and any prose in a nested `<div dir="rtl">`. Both forms were rendered through the API before
choosing. Task 4's alert-callout workaround is used verbatim for the `> [!WARNING]` and rendered
correctly (`markdown-alert markdown-alert-warning` with RTL content).

**One harness defect found and fixed; Task 6 would have hit it on its first block.** The derivation
request embeds a ```` ```json ```` payload. CommonMark ends a fenced block at the first line whose
backtick run is at least as long as the opener's, so pasting that output into a three-backtick
example block ended the block at the payload's closing fence: GitHub rendered the remaining 40 lines
as prose and **swallowed the `</details>`**. Nothing in the harness noticed — `collectExamples`
matches a fence line only when the closing marker follows it, so the parse was correct, the
generator wrote the block, and `examples.test.ts` compared it happily. Only the rendered page was
wrong, and it was found by rendering it. Two changes to `scripts/gen-doc-examples.ts`: the opening
fence may now be three backticks or more and the closing one is derived from it (so the
four-backtick block the request needs is closed by four, and a bare fence inside it is body); and
`assertFenceHolds`, called from `renderExamples`, refuses to write a body that would close its own
block and names the width to widen to. Four tests, including one that holds **every** block in both
READMEs to it, so the next command whose output grows a fence fails the suite rather than the page.
`mycontext ingest` prints the same shape of payload — Task 6's extraction-request block will need a
four-backtick fence, and will now be told so if it forgets.

**Nothing in `src/` was touched.** The only non-documentation changes are the example harness and
its tests.

**One thing deliberately not claimed.** `mycontext lesson <LESSON-id>` prints `lesson <id> recorded`
even on the re-derive path, where nothing was recorded because the item already existed (`cmdLesson`,
`src/cli/commands/lesson.ts` — the id branch is checked first and never calls `createItem`). The
walkthrough uses that path, since the fixture's lesson carries a real body worth deriving from. The
prose therefore says the command "records the lesson" for the text form and "re-derives from that one
rather than recording a second copy" for the id form, and never says the walkthrough's first block
created anything. The misleading output line is a small defect in the command, not in the
documentation; it is not fixed here (Global Constraints), and it is worth a backlog item.

**Task 6 — ingest, as a capability.** `8bb0577`. `README.md` §3 gains `#### From a document to
draft items`, at the end of "Step 1 — you capture it" and immediately after Task 5's
`#### From an incident to a rule`: ingest is capture at scale, so it belongs to the capture step
rather than to the command reference where it had been three table rows at line 946.
`docs/README.he.md` mirrors it as `#### ממסמך לפריטי טיוטה`. Five generated blocks, the five
commands Task 1 settled, in Task 1's order: the extraction request **244 lines / 494 columns**
(inside `<details>`), `ingest-status --full` 10/72, the third apply 6/97, `review list` 23/100,
`review promote` 11/122. Promoting the **invariant** rather than the `non_goal` holds the last
block to 122 columns instead of 167, as Task 1 measured. 1832 tests, 1831 pass, 1 POSIX-only skip;
`npx tsc --noEmit` and `npm run test:perf` clean; `npm run gen:docs` reports both documents
unchanged on a second run; `git status --porcelain` clean; every probe and temp directory deleted.

**Task 5's fence warning was right, and its measurement was one backtick short.** The extraction
request embeds **two** fenced payloads, not one: a ```` ```json ```` request object *and* a
four-backtick fence around the CHUNK, because the chunk is a Markdown document that may itself
contain fences. So the example block needs **five** backticks, not four. `assertFenceHolds` caught
it on the first `npm run gen:docs` and named the width to widen to, exactly as Task 5 built it to —
the harness fix paid for itself on the very next task. Verified in the rendered page: all 244 lines
land in one `<pre>` inside the `<details>`, both inner fences survive as literal text, and nothing
after them is swallowed.

**All three stated facts held when run.** None was taken from the survey.

- **The model is the extractor.** `mycontext ingest docs/prd.md` prints a request, never a result:
  the chunk verbatim, the 17 enabled categories with their `extraFields`, the JSON schema, and both
  callbacks (CLI `--stdin` and the `ingest_document` arguments). Its first bullet says "You are the
  extractor. my_context has no model of its own and never calls one."
- **Candidates land as drafts.** The three applies created five items, and `review list` shows all
  five with `origin ingest` and `source docs/prd.md`, in the same queue as the fixture's
  agent-captured draft. `review promote INV-isbn-is-unique-per-tenant --yes` is what makes one
  active.
- **The first chunk applies `[]` and creates nothing.** `ingest-apply` on `bookstore-api-prd` prints
  `created 0, deduped 0, superseded 0` and writes no item, and `ingest-status --full` then reports
  `1/3` with that anchor `applied`. The anchor is marked done rather than re-asked: re-running
  `mycontext ingest docs/prd.md` afterwards returns **chunk 2**, not chunk 1.

**Two further behaviours verified rather than assumed, because the section states them.**

- **Resumption.** Re-running `ingest` with nothing applied returns the same chunk; after an apply it
  returns the next pending one. `--anchor` re-requests a specific chunk. An apply returns the next
  chunk's request automatically, which is why the walkthrough's blocks end on
  `checkout-and-payments` — applying `catalogue-and-search` last would end the block with the next
  244-line request.
- **Editing the document opens a new session.** The id folds in a checksum of the document
  (`makeSessionId`), so appending a `## Shipping` section produced
  `ING-docs-prd-md-dd2990c9-6a7fa17b` alongside `…-9e3efbae`; `ingest-status --full` listed both
  (0/4 and 1/3), and the items the first session produced were untouched. Run and observed, not read
  off the code.

**The quote check was exercised, not merely quoted.** A candidate whose `quote` was invented
("Auth tokens expire after fifteen minutes.") was refused with `"quote" does not appear in the
source chunk`, the anchor stayed `pending`, and the rejection was recorded durably and shown under
that anchor by `ingest-status --full`. The prose says my_context looks for the quote in the
section's own text "forgiving nothing but a difference in whitespace", which is `flatten`
(`src/ingest/schema.ts:153`, `:297`) rather than the looser "exact match" the request's own wording
would have licensed.

**No false statement was found in what already existed.** §5's three-row ingest paragraph and the
two glossary entries were re-read against the running commands and are accurate; the new section
links from nothing that had to be corrected. This is the first task in this plan to find nothing
wrong.

**Rendering verified through `gh api -X POST /markdown -f mode=gfm`, then in a browser.** Both full
documents render identically in structure: 2 `<details>`, 70 `<pre>`, 6 alert callouts, zero literal
`[!` leaks. The Hebrew uses Task 5's `<details>` form verbatim — `<details>` outside the RTL div,
`<summary dir="rtl">`, the fence directly inside, prose in nested RTL divs — and screenshots confirm
RTL prose with LTR box-drawing tables inside the code blocks. **The 244-line block is 4277px tall
expanded and scrolls horizontally inside its own `<pre>` (3291px of content in a 987px box); the
page body does not scroll.** Collapsed, it is one line of summary, which is the point of putting it
in `<details>`.

**No slash command claim.** The section says ingest has two surfaces, the CLI and the
`ingest_document` tool, and points at §8's "One surface for every operation (Wave 5)", which already
counts the three `ingest*` commands among those with no slash command. `/mycontext:ingest` is not
named and no present tense is used for it, per spec §5.

**One thing the section deliberately does not claim.** Nothing is said about what happens when two
sections of a document share a heading, or about anchor collisions — neither was probed, and the
plan's rule is that an unverified property is not written down.

**Nothing in `src/` was touched.**

**Task 7 — the skill, subtraction, and the `decay` correction.** `8fde8f7` (English + CHANGELOG),
`e9dd10a` (Hebrew). 1832 tests, 1831 pass, 1 POSIX-only skip; `npx tsc --noEmit` and
`npm run test:perf` clean; `npm run gen:docs` reports both documents unchanged;
`git status --porcelain` clean; every probe and both temp workspaces deleted.

**The skill gets `### What the model reads: the skill`**, placed in §5 immediately after the MCP
tool table and before the flag reference, so §5 now reads: what you type, what you run, what the
model calls, what the model reads. `docs/README.he.md` mirrors it as
`### מה שהמודל קורא: המיומנות` — מיומנות is the term §5 already used for it at the
`claude plugin details` line, so no new vocabulary was invented. The section describes the file
after reading it, not its name: capture **in the turn the thing is agreed**, on the skill's own
stated grounds that a constraint recorded three sessions later is usually recorded wrong; **the
tier decides where a capture lands, not the model** — normative as a draft, rationale active, with
the consequence the skill spells out, that a `decision` is live at once; **query before asserting**
and never guess an id; and **print the human's command rather than run it**, which the skill states
alongside its own admission that nothing in the plugin stops an agent with a shell. The section
closes on the boundary: it is instruction, not enforcement, and what actually holds is §7's draft
rule. Every sentence is a claim about what the file says, never about what a model then does.

**The `decay` claim held, and was verified by running the hook rather than by reading
`inject.ts`.** A scratch workspace with one pinned constraint and one unpinned rule; the
SessionStart hook fed real JSON on stdin with a session id. The injection carried the constraint in
full and the rule as an index line, and the `ledger` table afterwards held **exactly one row** —
the constraint, tier `pinned`. After a second session `mycontext decay` reported the rule as
`never injected` while the constraint showed `2x`. The mechanism, confirmed in the source after the
observation rather than before it: only `selection.full` is recorded (`src/core/inject.ts`), and
the index summary is rendered and never written. The new `> [!WARNING]` says an index line is not
an injection, names the three tiers that *are* recorded, and says the command's own caveat does not
mention it. Two traps met on the way, recorded for whoever runs a hook next: Git Bash's `echo`
mangles the backslashes in a Windows path, and an unparseable hook input degrades silently to `{}`,
so the hook runs with **no session id** and records nothing — which looks exactly like the bug
under investigation. And `mycontext query` cannot be used to inspect the ledger at all, because
every query rebuilds `.index.db` and `rebuild` does not create that table.

**Subtraction: 52 lines out of `README.md`, 57 out of the Hebrew.** Three passages, each reduced to
what is true today, with the history moved to `CHANGELOG.md` rather than deleted:

- §8's 33-line column-width post-mortem is now a 12-line entry, `### Reports on a corpus of long
  ids`. What was kept is the one thing §8 is for — the residual property — and it was
  **re-measured rather than carried over**: a 64-character id puts `mycontext list` at **101
  columns** against the 100-column budget, run in a scratch workspace. The inherited "112 columns
  on a 67-character id" was **not** kept in either document. It depends on the category name's
  width (`security_control` on the same id gives ~117) and could not be reproduced as stated, so
  the CHANGELOG entry states the arithmetic instead of the figure.
- The `argument-hint` defect, told at 11 lines in §5 and 6 more in §8, is now six lines in §5 and
  nothing in §8 — a shipped fix has no business in the section reserved for what does not exist.
  What survives in §5 is the durable half: `disable-model-invocation` is in effect, and the test
  parses the frontmatter rather than matching it with a regex, which is why the earlier one never
  saw it.
- `CHANGELOG.md` gains both stories under **Fixed** — the `argument-hint` one in full, including
  Claude Code's own message and `claude plugin validate .`, and `review list --full`'s 210-column
  table becoming a stanza. Neither was there. The column-width and title-column stories **were**
  already there, which is why §8's telling was pure duplication.

**Nothing depended on the cut passages.** Checked before cutting: no anchor in either document
links to `#reports-that-fit-on-a-screen--now-closed` or its Hebrew equivalent, and the one
cross-reference that existed — §8's "[Section 5](#5-using-it) tells that story in full" — was
inside the deleted paragraph and went with it. `test/docs/counts.test.ts` anchors on the sentence
"N of the M CLI commands" and deliberately not on any other ratio in the document, so removing
"19 of the 38" could not disturb it. Both documents were then rendered through
`gh api -X POST /markdown -f mode=gfm` and **every internal link resolved against the computed
heading slugs**: the only broken anchor in either document is the pre-existing Hebrew
`#התקציב-ומה-קורה-כשזה-לא-נכנס` Task 3 recorded, which Task 8 owns. The Hebrew callout uses Task 4's
form — the alert outside the RTL div, a nested `<div dir="rtl">` inside the blockquote — and renders
as `markdown-alert markdown-alert-warning` with RTL content; both documents render nine alert
elements and zero literal `[!` leaks.

**The three carried items.**

- **`prefix` on a built-in, and no slash command for a custom category — §8 gains one entry**,
  `### Configuration that is accepted and not acted on (unscheduled)`, a bullet each. Both were
  re-verified by execution rather than taken from the Task 2 log: `{"rule":{"prefix":"POLICY"}}`
  loaded with no error, no warning and **no `mycontext doctor` finding**, and the id was still
  `RULE-never-log-customer-email`, while the same config's custom `security_control` produced
  `SECURI-`. §6 already names both facts in its body, but §8 is where a key that is declared and
  verifiably not in effect belongs, and the missing slash command is a product gap rather than a
  footnote. No present tense for either fix; the entry says neither is placed in a wave.
- **`mycontext lesson <id>` printing "recorded" — §8 was the wrong home, so it went to §3.** §8's
  opening paragraph scopes the section to capabilities the project does not have, and a message
  with a wrong word in it is not one; widening that paragraph to admit it would cost more than the
  item is worth. It is instead one clause beside the generated block that exhibits it, in
  `#### From an incident to a rule` — the only place a reader meets the contradiction, since the
  prose says the id form re-derives rather than recording while the output above says `recorded`.
  Re-verified by running `mycontext add lesson …` and then `mycontext lesson LESSON-…`. Backlog #94
  stays open.

**Nothing in `src/` was touched.** No sentence written in this task needed a code change to be
true.

**One thing deliberately not claimed.** The skill section says nothing about whether a model
follows the skill, or about when Claude Code decides to load it — neither was measured. It says
what the file instructs, and what is enforced independently of it.
