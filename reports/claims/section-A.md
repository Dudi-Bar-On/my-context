# Section A — README lines 1–391

64 claims: 60 verified, 1 contradicted, 3 unverified

Scope: `my-context/README.md` lines 1–391 (Contents, "1. The problem", "What it can do",
"2. The idea"). Source citations are paths relative to `my-context/`. Evidence-record
citations are `<surface>/<caseId>`. "Own run" citations are CLI/hook invocations made in
`$TEMP/mycx-audit-a` and `$TEMP/mycx-audit-b`, outside the repo, against the committed
documentation fixture (`scripts/doc-fixture.ts`).

---

### A-001 · README:10,15
> Node 24 or newer

**Verdict:** VERIFIED
**Citation:** `my-context/package.json:6` — `"engines": { "node": ">=24.0.0" }`

### A-002 · README:11,15
> Zero runtime dependencies / no runtime dependencies

**Verdict:** VERIFIED
**Citation:** `my-context/package.json` — no `dependencies` key at all; only
`devDependencies` (`typescript`, `@types/node`). `my-context/node_modules/` holds exactly
`typescript`, `@types/`, `undici-types` (transitive of `@types/node`).

### A-003 · README:12
> storage: markdown in your repo

**Verdict:** VERIFIED
**Citation:** own run — `materializeDocFixture` produces `.my_context/items/<type>/<ID>.md`,
one Markdown file per item, e.g. `.my_context/items/invariant/INV-prices-are-integer-cents.md`

### A-004 · README:13,16
> Licensed under the [MIT licence](LICENSE).

**Verdict:** VERIFIED
**Citation:** `my-context/package.json:4` — `"license": "MIT"`; `my-context/LICENSE:1` —
`MIT License`. The relative link target exists.

### A-005 · README:15
> no build step — the TypeScript sources are executed directly

**Verdict:** VERIFIED
**Citation:** `my-context/package.json:8` — `"bin": { "mycontext": "./src/cli/index.ts" }`;
own run `node .../src/cli/index.ts add invariant …` exited 0 with no compilation step. No
`build` script exists in `scripts`.

### A-006 · README:22
> mycontext add invariant "Prices are integer cents" --scope "src/billing/**" --yes

**Verdict:** VERIFIED
**Citation:** own run of that exact argument vector — exit 0,
`my_context: created INV-prices-are-integer-cents-2 (active) at items/invariant/…`.
Corroborated by `cli-capture/add-scope-comma` (same flag shape on `constraint`).

### A-007 · README:25–26
> The next time Claude is about to read or edit a file under `src/billing/`, that invariant
> is put in front of it — in full, unprompted

**Verdict:** VERIFIED
**Citation:** `hooks/pre-tool-use-scoped-billing-hit` — `PreToolUse` on a `src/billing/**`
path returns `additionalContext` containing `### INV-prices-are-integer-cents · invariant ·
Prices are integer cents` with `_scope: src/billing/**_`; own run against the doc fixture
returns the item's full body.

### A-008 · README:36
> **[התיעוד המלא בעברית](docs/README.he.md)** מקביל למסמך הזה פרק-פרק. (the full Hebrew
> documentation parallels this document chapter by chapter)

**Verdict:** VERIFIED
**Citation:** `my-context/docs/README.he.md` exists; `test/docs/parity.test.ts` and
`test/docs/injection.test.ts:47` (`DOCUMENTS = ['README.md', 'docs/README.he.md']`) assert
structural parity and identical injected blocks across both documents.
**Note:** Structural parity is asserted by tests; per-sentence translation fidelity was not
checked.

### A-009 · README:43–62 (Contents and TIP)
> every term … is defined in the [glossary](#9-glossary), and every command-line option is in
> one table … (plus all section/subsection links in the Contents)

**Verdict:** VERIFIED (link resolution)
**Citation:** own run — all 79 in-document `](#anchor)` links appearing in lines 1–391 resolve
against the 100 headings in README.md under GitHub slugification; both relative file links
(`LICENSE`, `docs/README.he.md`) exist.
**Note:** Verifies that the links resolve. Whether the flag table is *exhaustive* is a
section-5 property and is not checked here.

### A-010 · README:91
> `CLAUDE.md` … Claude Code loads it automatically

**Verdict:** UNVERIFIED
**Reason:** a property of the Claude Code host, not of the plugin; no evidence surface in this
campaign exercises it.

### A-011 · README:95–104
> [`CLAUDE.md`] It is static … It is unscoped … It is undifferentiated … It grows until it is
> skimmed.

**Verdict:** UNVERIFIED
**Reason:** assertions about a different product (`CLAUDE.md`), outside the plugin under test
and outside every evidence surface.

### A-012 · README:135
> mycontext add invariant "Prices are integer cents" --scope "src/billing/**" --yes

**Verdict:** VERIFIED
**Citation:** own run — see A-006 (same command, restated in "In one screen").

### A-013 · README:140–141
> this is in Claude's context — the real output of the hook, quoted verbatim and re-derived
> from the running code by `test/docs/injection.test.ts` on every test run

**Verdict:** VERIFIED
**Citation:** own run — `node --test test/docs/injection.test.ts` → 3 pass, 0 fail, including
"the just-in-time block in section 4 is what the hook emits", which asserts the README quotes
the hook's `additionalContext` verbatim (`test/docs/injection.test.ts:110-122`, assertion at
`:92-101`). The file matches the `test/**/*.test.ts` glob in `package.json`'s `test` script,
so it runs on every test run.

### A-014 · README:143–174
> [the injected block, from `## my_context — these govern this project` through
> `_scope: src/**_`]

**Verdict:** VERIFIED
**Citation:** own run — `pre-tool-use.ts` fed
`{tool_name:"Edit", tool_input:{file_path:"src/billing/prices.js"}}` against the doc fixture
emitted text byte-identical to README:144–173, including the header, the four
`### ID · category · Title` lines, all four bodies, and both `_scope:_` lines. Header string
also at `src/core/render.ts:144`.

### A-015 · README:178–181
> **The trigger was the file.** `src/billing/**` matched `src/billing/prices.js`, and the hook
> that runs before Claude reads or edits a file selected on that path and injected before the
> tool ran.

**Verdict:** VERIFIED
**Citation:** `src/hooks/pre-tool-use.ts:136-150` — resolves `file_path` against the repository
root (`path.dirname(ws.projectRoot)`) and selects on the relative POSIX path;
`hooks/pre-tool-use-scoped-billing-hit` vs `hooks/pre-tool-use-scoped-billing-miss` show the
path is what discriminates.

### A-016 · README:182–184
> The other three arrived on the same call because nothing excluded them: two declare no scope
> at all, and the third is scoped `src/**`, which `src/billing/prices.js` is under.

**Verdict:** VERIFIED
**Citation:** own run of the doc fixture item files —
`CONST-postgres-pool-capped-at-20` `scope: []`, `REQ-checkout-completes-in-two-steps`
`scope: []`, `RULE-never-log-customer-email` `scope: [src/**]`. The fixture's fifth normative
item `STD-api-errors-use-problem-json` is scoped `src/api/**` and is correctly absent from the
block.

### A-017 · README:183
> They arrive once each

**Verdict:** VERIFIED
**Citation:** own run — `session-start.ts` with `session_id: S1` pinned
`CONST-postgres-pool-capped-at-20`; `pre-tool-use.ts` with the *same* `S1` on
`src/billing/prices.js` then returned exactly `INV-…`, `REQ-…`, `RULE-…` and **not** the
already-delivered `CONST-…`. Mechanism at `src/core/select.ts:475-477` ("Seen items are
removed before budgeting") and `src/core/seen-file.ts`.

### A-018 · README:183
> hardest-first

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:260` — `SEVERITY_RANK = { hard: 0, soft: 1 }`; `:268-271`
"Hard severity first, then most-recently-relevant, then id for determinism", applied at
`:284` before budget fitting. Corroborated: the fixture's only `severity: hard` item
(`CONST-postgres-pool-capped-at-20`) is rendered first in the block at README:146.

### A-019 · README:184
> inside [a budget] that names whatever did not fit

**Verdict:** VERIFIED
**Citation:** `config/budgets-spill-pinned` — with the pinned budget squeezed, the output
carries `_2 item(s) omitted from full text for budget: CONST-first-long-constraint,
CONST-second-long-constraint. Fetch with mycontext show <id>._`; `config/budgets-index-overflow`
shows the index tier's `- … +1 more (fetch with mycontext show <id>)`.

### A-020 · README:186–188
> A session that started normally would have had the one `always: true` item
> [pinned](#…) at its start instead, and seen the other three here.

**Verdict:** VERIFIED
**Citation:** own run (see A-017) — `CONST-postgres-pool-capped-at-20` is the fixture's only
`always: true` item and is the sole full-text block at session start; the subsequent JIT call
in the same session carried exactly the other three.

### A-021 · README:196–200
> delivery is chosen per event: pinned at a session start, just in time before a file is read
> or edited, restored after a compaction, and an index line for everything else

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:43` — `tier: 'pinned' | 'jit' | 'restored'` plus the `index`
tier at `:48`; `hooks/session-start-startup` (pinned + index),
`hooks/pre-tool-use-scoped-billing-hit` (jit), `hooks/session-start-compact` (post-compaction
delivery), `src/core/config.ts:51` (`restored` budget).

### A-022 · README:201–202
> Here, `scope` is a list of globs, and the file Claude is about to touch is what decides which
> items it gets.

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:191-194` (`matchesScope` → `matchesAnyGlob`);
`hooks/pre-tool-use-scoped-hit` vs `hooks/pre-tool-use-scoped-miss`. Item files carry `scope`
as a YAML list (own run, fixture frontmatter).

### A-023 · README:203–206
> an item's tier decides whether it may steer the model at all (normative text is injected in
> full; rationale is only counted, indexed and searched), and its severity decides which items
> reach a full budget first

**Verdict:** VERIFIED
**Citation:** `cli-capture/help-categories` — "**Rationale** types explain past reasoning. They
are never injected. They appear in the session index as counts and are retrieved with
`query_items`"; `src/core/select.ts:129-131` (`isNormative`) and `:260-271` (severity ordering
inside `fitToBudget`). `hooks/session-start-startup` shows rationale as `1 decision · 1 lesson`
only.

### A-024 · README:207–209
> every tier has a token budget

**Verdict:** VERIFIED
**Citation:** `src/core/config.ts:51` —
`DEFAULT_BUDGETS = { pinned: 6000, jit: 6000, restored: 8000, index: 1200 }`, one per delivery
route; `config/budgets-unknown-key-refused` shows the set is closed.

### A-025 · README:208–211
> `mycontext decay` reports which items have not been *injected* in the last window of
> sessions. Injected, not used: the report prints that caveat about itself, because an item
> read through `mycontext show` leaves no trace in the ledger and looks identical to an
> abandoned one.

**Verdict:** VERIFIED
**Citation:** `cli-retrieve/decay-bare` — "items not injected in the last 20 session(s)" and
the caveat block: "the ledger records injection, not reading or reliance, so a new item, and
any item consulted via `show`, MCP `get_item`, or the Markdown file directly, look exactly
like an abandoned one here." `cli-retrieve/decay-summary-still-prints-caveat` shows it survives
`--summary`.

### A-026 · README:215–216
> `src/hooks/pre-tool-use.ts` resolves the path Claude is about to open against the repository
> root and selects on it.

**Verdict:** VERIFIED
**Citation:** `src/hooks/pre-tool-use.ts:140-150` — `const repoRoot = path.dirname(ws.projectRoot);
const abs = path.resolve(cwd, filePath); … const target = relPosix(repoRoot, abs);` then
`select(...)` on `target`. The file exists at the stated path.

### A-027 · README:220–222
> **What actually reached the model is recorded, per session**, keyed on session, item and
> tier

**Verdict:** VERIFIED
**Citation:** `src/core/audit.ts:133-136` — `InjectedRef { id, tier }` ("which item, at which
tier"), carried on an `AuditRecord` keyed by `sessionId` (`:547`, `:571`);
`src/core/inject.ts:329` `recordAudit(...)`.

### A-028 · README:222–223
> the audit log records every delivery first, and a per-session seen file is what makes an item
> arrive once rather than on every file

**Verdict:** VERIFIED
**Citation:** `src/core/inject.ts:260-262` — "4. AUDIT — first and durable (`recordAudit` never
throws …) — then the seen-file append"; `src/core/seen-file.ts` (`appendSeen`/`readSeen`), used
at `src/hooks/pre-tool-use.ts:182,302`. Behavioural confirmation in A-017.

### A-029 · README:223–225
> The usage ledger that `mycontext decay` is computed from is a projection rebuilt from that
> audit log

**Verdict:** VERIFIED
**Citation:** `src/core/ledger-replay.ts:6-14` — "Projects the audit log's injection records
into the ledger table"; `src/core/audit.ts:522` "every injection is recorded here first, and
`ledgerRows` replays them". Own run: after two session starts, `audit replay-ledger` reported
`replayed 6 row(s)`.

### A-030 · README:226–229
> Every candidate pulled out of a document must carry a span copied verbatim from the chunk it
> came from; the span is checked by exact match after whitespace collapsing, and a paraphrase
> is rejected.

**Verdict:** VERIFIED
**Citation:** `cli-pipelines/ingest-first-chunk` — the emitted request states it verbatim;
`cli-pipelines/ingest-apply-paraphrase-rejected` shows the enforcement:
`[0] Rate limit is 100 requests per minute.: "quote" does not appear in the source chunk
"rate-limits". Copy the text verbatim from the chunk; do not paraphrase…` with `created 0`.
Implementation at `src/ingest/schema.ts:153` (whitespace collapse) and `:295-301` (rejection).

### A-031 · README:229–230
> my_context ships no model of its own … there is no API key and no inference cost anywhere in
> it.

**Verdict:** VERIFIED
**Citation:** `cli-pipelines/ingest-first-chunk` — "my_context has no model of its own and
never calls one — it hands you the text and validates what you return"; own run — a
case-insensitive grep of `my-context/src/` for `fetch(`, `https?://api`, `api[_-]?key`,
`anthropic`, `openai`, `node:http`, `node:https` returned zero matches.

### A-032 · README:232–234
> A normative item Claude captures *through the MCP tools* lands as a `draft`

**Verdict:** VERIFIED
**Citation:** `mcp/create_item-minimal` — `create_item({type:"constraint", …})` →
"created CONST-uploads-capped-at-10-mb (draft) … non-human-authored normative items are not
injected until reviewed".

### A-033 · README:234–235
> the shell fallback the slash commands name is `mycontext add --yes`, which lands `active`,
> and says so where it is offered

**Verdict:** VERIFIED
**Citation:** `cli-capture/add-normative-with-yes` — "created CONST-uploads-capped-at-10-mb
(active)"; `my-context/commands/add-constraint.md:23-27` offers the shell fallback with `--yes`
and states "the item lands **active** rather than as a draft and governs this project the
moment it is written". The same paragraph appears in 13 further `commands/add-*.md` files.

### A-034 · README:236–238
> `draft` is admitted to no injection tier at all: the selector drops anything whose status is
> not `active` before a budget is even consulted.

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:123-127` — `isEligible()` returns false on
`item.status !== 'active'`, applied before `fitToBudget` (`:278-296`);
`mcp/create_item-constraint-readback` — a freshly created draft appears in `list_drafts` and
`query_items({status:"active"})` returns "no items match that query".

### A-035 · README:240–243
> One file per item in your repository, each carrying a checksum re-stamped on every write; the
> SQLite index is derived from those files

**Verdict:** VERIFIED
**Citation:** own run — every fixture item file carries a `checksum:` frontmatter key;
`src/core/persist.ts:95` — `item.checksum = computeItemChecksum(item)` inside `writeItem`;
`src/core/open-store.ts:55-64` — the index is rebuilt from Markdown, "unconditional and per
call by design".

### A-036 · README:243
> `mycontext rebuild` recreates it from scratch

**Verdict:** VERIFIED
**Citation:** `cli-capture/rebuild-bare` — exit 0, "my_context: indexed 1 item(s)";
`src/core/rebuild.ts` reads the Markdown tree and repopulates the store.

### A-037 · README:244–245
> [the usage ledger] a projection of the append-only audit log, which `mycontext audit
> replay-ledger` rebuilds whole

**Verdict:** CONTRADICTED
**Citation:** own run in `$TEMP/mycx-audit-b` — after two session-start injections,
`mycontext audit replay-ledger` printed `replayed 6 row(s).`; running it **again** printed
`replayed 0 row(s).`, and a third time `replayed 0 row(s).` Implementation:
`src/cli/commands/audit.ts:230-238` calls `topUpLedger`, which is position-tracked per segment
(`src/core/ledger-replay.ts:6-14`: "each call consumes only complete new lines past the stored
offset, so the cost is O(new records), not O(log)") and discards-and-rebuilds *only* on
divergence (`:28` `if (diverged) ledger.clearForReplay();`).
**Expected:** the command rebuilds the ledger whole on invocation.
**Actual:** it tops up incrementally; a whole rebuild happens only when the log has diverged or
when the stored offsets are gone.
**Note:** The conclusion the clause supports does hold — see A-038. The defect is the
unconditional wording "rebuilds whole" applied to a command that is incremental in the ordinary
case.

### A-038 · README:245
> so deleting the database loses nothing

**Verdict:** VERIFIED
**Citation:** own run — after `rm .my_context/.index.db*`, `mycontext audit replay-ledger`
printed `replayed 6 row(s).`, restoring the full ledger from the audit log; the item corpus
itself is the Markdown, re-indexed by `openStore`'s unconditional rebuild
(`src/core/open-store.ts:55-64`).

### A-039 · README:250–252
> Everything below works today … [Section 8] is the one place where behaviour that does **not**
> exist yet is written down; nothing on this list is there.

**Verdict:** UNVERIFIED
**Reason:** deciding whether a section-8 entry is "on this list" requires a judgement of
capability identity that the evidence cannot settle — section 8 carries
"### Creating and writing a global layer" and "### Custom categories: two gaps, one of them
silent" (README:4261–4575), both of which qualify capabilities that lines 288–295 do list,
though the list itself flags the global-layer gap in the same bullet.

### A-040 · README:254–256
> **Capture a rule by hand** — one `mycontext add` from the terminal, or ask Claude to record
> it and it lands as a draft for you to promote.

**Verdict:** VERIFIED
**Citation:** `cli-capture/add-normative-with-yes` (terminal → active) and
`mcp/create_item-minimal` (agent → draft, promotable with `mycontext review promote`);
`cli-mutate/review-promote-flags` shows the promotion path succeeding.

### A-041 · README:257–260
> point at a PRD and my_context prepares the extraction request; the model fills it in, and
> what comes back lands as drafts, each checked against a quote from the source

**Verdict:** VERIFIED
**Citation:** `cli-pipelines/ingest-first-chunk` (request prepared, chunked "chunk 1 of 3"),
`cli-pipelines/ingest-apply-real-session` (`created 1 … CONST-clients-are-rate-limited-…`),
`cli-pipelines/ingest-apply-real-session-readback` (`review list --full` shows the queue),
`cli-pipelines/ingest-apply-paraphrase-rejected` (quote check enforced).

### A-042 · README:261–265
> a snapshot of a roadmap … with where it came from recorded, drift reported by `doctor`, and
> one command to take a fresh snapshot

**Verdict:** VERIFIED
**Citation:** `cli-mutate/refresh-drifted-readback` — doctor emits
`source_drift (1) [warn] REF-roadmap: "ROADMAP.md" has changed since REF-roadmap snapshotted it
(3cdacd0c3aed7926 → d31b7f593545ee79) … run \`mycontext refresh REF-roadmap\``;
`cli-mutate/refresh-reference` shows the refresh command on an unchanged source.

### A-043 · README:266–268
> **Turn an incident into a rule** — record the lesson, derive rule candidates from it, and
> accept the ones worth keeping

**Verdict:** VERIFIED
**Citation:** `cli-pipelines/lesson-record` ("lesson … recorded (rationale tier …)" followed by
a RULE DERIVATION REQUEST), `cli-pipelines/lesson-stage-real-payload` ("1 rule candidate(s)
staged … Accept with: mycontext lesson-accept …"),
`cli-pipelines/lesson-accept-unknown-key` (the accept surface exists and validates keys).

### A-044 · README:269–271
> one file per item, reviewed in a pull request like anything else, with the index derived from
> the files rather than the reverse

**Verdict:** VERIFIED
**Citation:** see A-035; `src/core/open-store.ts:55-64` states the derivation direction
explicitly ("Open the workspace's index and rebuild it from Markdown").

### A-045 · README:272–278
> pinned … just in time … restored … named in an index … all inside a budget you set

**Verdict:** VERIFIED
**Citation:** see A-021 for the four routes; `config/budgets-override` and
`config/budgets-defaults` show `budgets` is user-settable in `.my_context/config.json`, with
`config/budgets-unknown-key-refused`, `config/budgets-negative-refused` and
`config/budgets-non-number-refused` validating it.

### A-046 · README:280–282
> a normative item Claude captures is a draft, and a draft is selected for no injection tier at
> all

**Verdict:** VERIFIED
**Citation:** see A-032 and A-034.

### A-047 · README:283–287
> nothing in the way on a draft or a rationale item, a preview and a confirmation on an item
> that governs, and an agent's rewrite staged rather than applied for every normative category
> unless you say otherwise

**Verdict:** VERIFIED
**Citation:** own run — `edit DEC-use-stripe-for-payments --title …` (rationale, no `--yes`)
exit 0 "updated"; `edit RULE-cache-keys-include-tenant-id --title …` (draft, no `--yes`) exit 0
"updated". `cli-mutate/edit-no-yes-declines` — on the governing item the CLI prints the
`about to edit:` preview with a `- old / + new` diff and then refuses without confirmation
(exit 1). `mcp/update_item-title` — an agent's rewrite returns "NOT applied — staged as
revision REV-e820aecd8897 for review". Default at `src/core/config.ts:106-108` —
`defaultAgentEdits(tier) = tier === 'normative' ? 'review' : 'allow'`; overridable per
`config/category-agentEdits-allow`.

### A-048 · README:288–291
> a global layer whose items load beside the project's, with the project winning on a conflict.
> Creating one today is a documented workaround rather than a command.

**Verdict:** VERIFIED
**Citation:** `src/core/rebuild.ts:435` — `LAYER_ORDER: Layer[] = ['global', 'project']`, with
`:515-516` "duplicate id … the project copy wins and the global one is [ignored]";
`cli-capture/init-global-refused` — "The global layer is C:\Users\UserC\.my-context, and no
command creates one or writes to one: build an ordinary workspace somewhere else and move the
directory it made into that path."

### A-049 · README:292–295
> a name that is not among them becomes a first-class category with its own id prefix, tier and
> scope

**Verdict:** VERIFIED
**Citation:** `config/custom-category-complete` — a declared `security_control` category
accepts `add security_control "All admin endpoints require MFA" --yes` and mints
`SECURI-all-admin-endpoints-require-mfa` at `items/security_control/…`;
`config/custom-category-missing-tier` and `config/custom-category-missing-description` show
tier is a required part of the declaration.

### A-050 · README:296–298
> read-only SQL over the index, which is rebuilt from the Markdown before every query

**Verdict:** VERIFIED
**Citation:** `cli-retrieve/query-insert-refused` and `cli-retrieve/query-drop-refused` —
"query is read-only — only SELECT (or WITH … SELECT) is accepted";
`cli-retrieve/query-pragma-refused`; `cli-retrieve/query-with-cte-allowed` (exit 0).
Rebuild-before-query at `src/core/open-store.ts:55-64` ("The rebuild is unconditional and per
call by design") and stated in the command's own help at `src/cli/commands/query.ts:47`.

### A-051 · README:299–302
> `mycontext status` for the shape of the corpus, `mycontext doctor` for drift, dead globs and
> permissions, `mycontext decay` for what has not been injected lately — with the caveat the
> report prints about itself

**Verdict:** VERIFIED
**Citation:** `cli-capture/status-bare` (by category / by status / by origin / review queue /
usage / health); `src/doctor/checks.ts:240,305` (`source_drift`), `:384` (`dead_scope`),
`:473` (`not_writable`), with `cli-mutate/refresh-drifted-readback` showing a live
`source_drift` finding; `cli-retrieve/decay-bare` for the caveat (see A-025).

### A-052 · README:303–307
> the slash commands you type, the CLI you run, the MCP tools the model calls, and the skill
> that tells it to capture a rule

**Verdict:** VERIFIED
**Citation:** `slash/file-count` (66 command files in `commands/`, pass);
`cli-capture/help-bare` (CLI usage banner); `mcp/handshake-and-list` (tool listing) plus the
62 `mcp/*` records; `my-context/skills/` exists and `slash/loadmycontext-is-the-exception`
passes.

### A-053 · README:309–312
> The review gate above — the one that keeps a draft from governing — is enforced by your Bash
> permissions and by nothing else

**Verdict:** VERIFIED
**Citation:** `cli-capture/add-normative-with-yes` — a non-interactive shell invocation of
`mycontext add constraint … --yes` creates an `active`, immediately governing normative item
with no approval step of any kind; `cli-capture/add-normative-without-yes` shows `--yes` is the
only gate the CLI itself applies.
**Note:** The positive half is cited. The exhaustive "and by nothing else" is an
absence-of-enforcement claim about the host's permission system and cannot be closed from
inside the plugin.

### A-054 · README:318–321
> **Normative knowledge** … Constraints, invariants, rules, requirements, standards, patterns,
> glossary terms, instructions, non-goals, open questions.

**Verdict:** VERIFIED
**Citation:** `cli-capture/help-categories` — all ten named types are rows with
`tier = normative`.
**Note:** Not exhaustive: `help categories` lists 13 normative types; `environment`,
`known_issue` and `runbook` are omitted from this sentence. The sentence does not claim to be a
complete list.

### A-055 · README:323–325
> **Rationale** … Decisions, ADRs, lessons, tradeoffs, assumptions, edge cases, risks.

**Verdict:** VERIFIED
**Citation:** `cli-capture/help-categories` — all seven named types are rows with
`tier = rationale`.
**Note:** `reference` is the eighth rationale type and is omitted here.

### A-056 · README:339–341
> Every category — `constraint`, `decision`, `rule`, `lesson`, and the rest — carries one [a
> tier], and you can change which

**Verdict:** VERIFIED
**Citation:** `cli-capture/help-categories` — every row in the table carries a tier;
`config/category-tier-override` — `categories.<name>.tier` in `.my_context/config.json` is
accepted (exit 0) and reflected in `status --json`.

### A-057 · README:341–342
> [section 4](#4-when-it-comes-back-and-what) calls its four delivery routes *injection tiers*

**Verdict:** VERIFIED
**Citation:** `src/core/config.ts:51` — exactly four budgets (`pinned`, `jit`, `restored`,
`index`); `src/core/select.ts:43,48` — the same four tier names.

### A-058 · README:344–345
> The set of items in your project — everything under `.my_context/items/`, whatever its tier or
> status — is its **corpus**.

**Verdict:** VERIFIED
**Citation:** own run — the doc fixture's ten items all live under
`.my_context/items/<type>/`, including the `draft` (`RULE-cache-keys-include-tenant-id`) and
the `superseded` (`OPENQ-which-search-engine`).

### A-059 · README:348–363
> [the `mycontext list --summary` table: constraint 1, decision 2, invariant 1, lesson 1,
> open_question 1, requirement 1, rule 2, standard 1 — 10 item(s)]

**Verdict:** VERIFIED
**Citation:** own run — `MYCONTEXT_UNICODE=1 mycontext list --summary` against the doc fixture
produced that table byte-for-byte, including the box-drawing borders and the trailing
`10 item(s)`.
**Note:** `cli-capture/list-summary` renders ASCII borders (`+---+`) rather than box-drawing;
that is the documented environment-dependent fallback (`src/cli/commands/format.ts:34-59`,
pinned to ASCII for the test suite by `test/helpers/pin-rendering.ts`), not a discrepancy in
the README.

### A-060 · README:367
> Seven of its ten items are normative and three are rationale.

**Verdict:** VERIFIED
**Citation:** cross of the A-059 table with `cli-capture/help-categories` tiers — normative:
constraint 1 + invariant 1 + open_question 1 + requirement 1 + rule 2 + standard 1 = 7;
rationale: decision 2 + lesson 1 = 3; total 10.

### A-061 · README:368
> `mycontext help categories` prints the full list of types with the tier each one belongs to.

**Verdict:** VERIFIED
**Citation:** `cli-capture/help-categories` — exit 0; the `| type | tier | id prefix | use for |`
table lists all 21 built-in categories with their tier.

### A-062 · README:376–377
> Normative text is injected into Claude's context in full, unprompted

**Verdict:** VERIFIED
**Citation:** own run and `hooks/pre-tool-use-scoped-billing-hit` — the full body of each
selected normative item is returned as `additionalContext` with no request from the model (see
A-014).

### A-063 · README:380–382
> Rationale never enters a session that way. At the start of a session it contributes a count —
> "2 decision · 1 lesson" — and nothing more.

**Verdict:** VERIFIED
**Citation:** own run — `session-start.ts` against the doc fixture (2 decisions, 1 lesson)
emitted the line `2 decision · 1 lesson · 1 drafts pending review · 1 retired`, and neither
decision nor the lesson appears in the index or in full text.
`hooks/session-start-startup` shows the same shape (`1 decision · 1 lesson`).

### A-064 · README:385–387
> When Claude captures a normative item, it lands as a **draft** and governs nothing until a
> human promotes it. When Claude captures a rationale item, it is simply recorded.

**Verdict:** VERIFIED
**Citation:** `mcp/create_item-constraint-readback` — draft created, absent from
`query_items({status:"active"})`, present in `list_drafts`;
`mcp/create_item-decision-readback` — "created DEC-agent-decision-test (active)", present in
`query_items({status:"active"})`, absent from `list_drafts`.
