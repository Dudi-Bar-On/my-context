# Section D2 — README lines 2301–2846

**91 claims: 80 VERIFIED · 7 CONTRADICTED · 4 UNVERIFIED.**

Surfaces used: `cli-retrieve` and `mcp` captured runs, `reports/LIVE-PASS.md`, `my-context/src/**`,
and own CLI/MCP runs in `%TEMP%\d2-sandbox`, `d2-mcp`, `d2-focus`, `d2-flags`, `d2-lesson`,
`d2-ingest`, `d2-git` (all outside the repo). Own runs are cited as `own-run/<label>` with the
argv or tool call that produced them.

---

### D2-001 · README:2301–2306
> `mycontext audit --op promote` … `--origin agent` … `--summary` … `--items` … `--sessions` … `--files`

**Verdict:** VERIFIED
**Citation:** `cli-retrieve/audit-op-create` (exit 0), `cli-retrieve/audit-op-invalid` (exit 1 on a
bad op), `cli-retrieve/audit-origin-agent`, `cli-retrieve/audit-summary`, `cli-retrieve/audit-items`,
`cli-retrieve/audit-sessions`, `cli-retrieve/audit-files` — all exit 0.

### D2-002 · README:2309
> `--json` on any of them.

**Verdict:** VERIFIED
**Citation:** `cli-retrieve/audit-json` — exit 0.

### D2-003 · README:2309–2310
> `--since` takes an ISO-8601 instant, a bare date (read as **UTC** midnight, matching the stamps), or a span back from now: `7d`, `12h`, `30m`.

**Verdict:** VERIFIED
**Citation:** `cli-retrieve/audit-since-span` (`7d`), `cli-retrieve/audit-since-hours` (`12h`),
`cli-retrieve/audit-since-iso` (`2026-08-01`), all exit 0; `own-run/audit-since-30m`
(`audit --since 30m`, exit 0) and `own-run/audit-since-bare-date` (`audit --since 2026-08-17`,
exit 0) cover the two forms no captured record exercised.

### D2-004 · README:2314–2315
> An injection record holds the ids and the tiers of what was delivered, plus what the budget spilled and why. It never holds the injected text.

**Verdict:** VERIFIED
**Citation:** `src/core/inject.ts:290–320` builds the record from `injected` (id + tier) and
`spilled` only; the comment at `inject.ts:301–307` states "Counts only — the ids are in
`.my_context/state/focus.json` and in the injected block, and the log records scope, not content."
Corroborated by the tool's own answer in `mcp/audit_log-actor`: "injections by SCOPE (which items at
which tier), never their text".

### D2-005 · README:2328–2335
> **Plus one number: `tokens`** … Records written before this field existed simply lack it, and every surface shows those as **"tokens not recorded" — never as zero**.

**Verdict:** VERIFIED
**Citation:** `src/cli/commands/audit.ts:107–113` — `record.tokens === undefined ? \`${base}, tokens
not recorded\` : \`${base}, ~${record.tokens} tokens\``, with the comment "printing 0 — or nothing —
would turn 'unknown' into a measurement".

### D2-006 · README:2340–2346
> `audit.jsonl` the record … `audit.db` a derived query index — safe to delete at any time … It rebuilds on the next `mycontext audit`.

**Verdict:** VERIFIED
**Citation:** `own-run/audit-db-deleted` — deleted `.my_context/.audit/audit.db`, then
`mycontext audit` printed "4 audit record(s), oldest first" (exit 0) and `ls .audit/` showed
`audit.db` recreated alongside `audit.jsonl`.

### D2-007 · README:2350–2352
> measured at 0.55 ms per record and flat from an empty log to 32 MiB

**Verdict:** UNVERIFIED
**Note:** A performance measurement; no captured record carries timings for hook append at any log
size, and reproducing a 32 MiB log was out of scope here.

### D2-008 · README:2353–2355
> A process killed mid-write damages at most the final line, and the next write truncates it. A damaged line anywhere else is **refused**, loudly, rather than skipped.

**Verdict:** VERIFIED
**Citation:** `own-run/audit-damaged-middle-line` — inserted `{not json` as line 2 of `audit.jsonl`;
`mycontext audit` exited 1 with "the audit log at … cannot be trusted — line 2 is not valid JSON …
Refusing to read it … Only a damaged FINAL line is tolerated". `own-run/audit-damaged-final-line` —
appended `{trunca` to the file; `mycontext audit` exited 0 and printed all 4 records.

### D2-009 · README:2356–2357
> `mycontext audit` brings the index up to date before every query … If it *cannot*, it reads the JSONL directly and says so in the output.

**Verdict:** VERIFIED
**Citation:** `src/cli/commands/audit.ts:193–215` — `load()` calls `syncProjection` first and, on
throw, returns `filterAudit(readAudit(root), filter)` with the note "the audit query index could not
be brought up to date (…). These results were read directly from the append-only log…".

### D2-010 · README:2362–2364
> `.my_context/.audit/` carries a `.gitignore` containing `*`, written by the code that creates it.

**Verdict:** VERIFIED
**Citation:** `src/core/jsonl-log.ts:76` — `writeFileSync(path.join(dir, '.gitignore'), '*\n',
'utf8')`. `own-run/git-check-ignore` in a real repo: `git check-ignore -v
.my_context/.audit/audit.jsonl` → `.my_context/.audit/.gitignore:1:*`, exit 0.

### D2-011 · README:2371–2374
> A hook that fails to write its record does not tell you … Mutations are the opposite: a `create` or `promote` whose record could not be written says so in the message you get back.

**Verdict:** VERIFIED
**Citation:** `src/core/audit.ts` exports `auditFailureNote`, appended to the mutation message at
`src/cli/commands/focus.ts:118` and `focus.ts:161` (`…restores it.${auditFailureNote(audit)}`);
the hook path in `src/core/inject.ts:325–340` calls `recordAudit` without surfacing a failure.

### D2-012 · README:2378–2383
> The live log rotates to a dated segment at 8 MiB … `mycontext doctor` reports the segment count and total size once it passes 32 MiB and names the rotated segments as yours to archive or remove.

**Verdict:** VERIFIED
**Citation:** `src/core/audit.ts:245` — `AUDIT_MAX_BYTES = 8 * 1024 * 1024`; `audit.ts:248` —
`AUDIT_REPORT_BYTES = 32 * 1024 * 1024`; `src/doctor/checks.ts:700–718` — `checkAuditSize` returns
`[]` below `AUDIT_REPORT_BYTES` and otherwise reports file count, total MiB, and "The N rotated
segment(s) are yours to archive or delete".

### D2-013 · README:2385
> The model's equivalent is the `audit_log` MCP tool

**Verdict:** VERIFIED
**Citation:** `own-run/mcp-tools-list` — `audit_log` present among the 14 tools;
`mcp/audit_log-bare`, `mcp/audit_log-all-filters` exercise it.

### D2-014 · README:2394–2396
> `mycontext ingest <path>` / `mycontext ingest-apply <id> --anchor <a>` / `mycontext ingest-status`

**Verdict:** VERIFIED
**Citation:** `src/cli/commands/ingest.ts:343`, `:350`, `:357` register all three;
`own-run/ingest-flow` ran `ingest docs/prd.md` and `ingest-apply <session> --anchor rate-limits
--stdin` successfully.

### D2-015 · README:2398–2401
> `mycontext ingest docs/prd.md` prints a chunk of the document plus instructions and a JSON schema … and the next chunk's request comes back automatically.

**Verdict:** VERIFIED
**Citation:** `own-run/ingest-request` — output began "my_context EXTRACTION REQUEST — prd.md § spec
(chunk 1 of 2, 2 pending)" followed by instructions; the successful `ingest-apply` in
`own-run/ingest-verbatim-accepted` ended with the next chunk's JSON request block.

### D2-016 · README:2403–2405
> An **anchor** is the heading a chunk of the document sits under, lower-cased and hyphenated — `## Rate limits` becomes `rate-limits`

**Verdict:** VERIFIED
**Citation:** `own-run/ingest-anchor` — a document containing `## Rate limits` accepted
`ingest-apply <session> --anchor rate-limits`; a candidate against that anchor was validated against
the "rate-limits" chunk ("`quote` does not appear in the source chunk \"rate-limits\"").

### D2-017 · README:2408–2409
> Every candidate must quote its source span verbatim — a paraphrase is rejected — and everything applied lands as a **draft**.

**Verdict:** VERIFIED
**Citation:** `own-run/ingest-paraphrase-rejected` — candidate with
`quote: "Requests are limited to 100 each minute."` (source says "Calls are capped at 100 per
minute.") was rejected: "\"quote\" does not appear in the source chunk \"rate-limits\". Copy the text
verbatim from the chunk; do not paraphrase, summarize, or quote a different section."
`own-run/ingest-verbatim-accepted` — the verbatim candidate applied and `mycontext list` shows
`CONST-rate-limit | constraint | draft`.

### D2-018 · README:2410
> The model's equivalent is the `ingest_document` tool, which does both legs in one place.

**Verdict:** VERIFIED
**Citation:** `own-run/mcp-schema-dump` — `ingest_document | props=[path,session,anchor,candidates]`,
i.e. both the request leg (`path`) and the apply leg (`session`, `anchor`, `candidates`).

### D2-019 · README:2416–2419
> `mycontext lesson` / `lesson-stage` / `lesson-accept` / `lesson-discard`

**Verdict:** VERIFIED
**Citation:** `src/cli/commands/lesson.ts:329`, `:336`, `:343`, `:350` register all four;
`own-run/lesson-flow` exercised `lesson`, `lesson-stage --stdin` and `lesson-accept`.

### D2-020 · README:2421
> `mycontext lesson` records the lesson (rationale tier — indexed, never injected)

**Verdict:** VERIFIED
**Citation:** `own-run/lesson-record` — "my_context: lesson LESSON-retry-storms-need-jitter recorded
(rationale tier — indexed, never injected)."

### D2-021 · README:2426
> Note that `lesson-accept` creates an **active** rule directly

**Verdict:** VERIFIED
**Citation:** `own-run/lesson-accept` — "my_context: created RULE-add-jitter-to-retries (active) with
derived_from [[LESSON-retry-storms-need-jitter]]", and `mycontext list` shows the rule at status
`active`, not `draft`.

### D2-022 · README:2438–2445
> `mycontext focus billing` / `billing invoicing` / `--category rule` / `--scope src/api/**` / `--preview` / bare / `--clear` / `--relations`

**Verdict:** VERIFIED
**Citation:** `cli-retrieve/focus-positional-tag`, `focus-two-tags`, `focus-category`,
`focus-scope-glob`, `focus-scope-path`, `focus-preview`, `focus-bare-reports`, `focus-clear`,
`focus-relations` — all exit 0.

### D2-023 · README:2448–2449
> **Axes combine: every axis you give must match, and within one axis any value may**

**Verdict:** VERIFIED
**Citation:** `src/cli/commands/focus.ts:64–70` builds `{tags, categories, scope}` as separate axes
and `src/core/select.ts` applies them conjunctively; the CLI usage banner reproduced in
`cli-retrieve/focus-clear-with-axis-refused` states the same rule verbatim.

### D2-024 · README:2456
> **Focus hides exactly what you asked it to hide, and reports the cost.** It never refuses a hide because something still visible points at the item.

**Verdict:** VERIFIED
**Citation:** `own-run/focus-dangling` — corpus with `OPENQ-how-do-refunds-settle blocks
REQ-orders-must-be-idempotent`, only the REQ tagged `billing`. `mycontext focus billing` exited 0,
hid the OPENQ, and reported "1 load-bearing relation(s) dangling — one end is hidden, the other is
not: OPENQ-how-do-refunds-settle (hidden) / blocks → REQ-orders-must-be-idempotent". It hid, it did
not refuse, and it reported.

### D2-025 · README:2461–2465
> What it reports is two numbers … `7 item(s) hidden by focus, 2 load-bearing relation(s) now dangling`

**Verdict:** CONTRADICTED
**Citation:** `own-run/focus-dangling` and `cli-retrieve/focus-preview`. Expected (per the README
block, presented as this command's output): one line reading
`N item(s) hidden by focus, M load-bearing relation(s) now dangling`. Actual: two separate lines,
neither matching — `2 item(s) in focus, 1 hidden by focus (of the eligible corpus).` and
`1 load-bearing relation(s) dangling — one end is hidden, the other is not:` (the word "now" does not
appear). Produced by `focusReportLines` at `src/core/focus.ts:465` and `:478–482`.
**Note:** The quoted string *is* verbatim-correct for the **injected block**, which is a different
renderer (`src/core/render.ts:112–137`). See D2-029, which is VERIFIED. The error is that the string
is presented at 2464 as what `mycontext focus` prints.

### D2-026 · README:2467
> A **dangling** relation is an edge with one end hidden and the other still on screen.

**Verdict:** VERIFIED
**Citation:** `src/core/focus.ts:170` — "One load-bearing relation with exactly one end hidden by
focus"; `focus.ts:195` `danglingEdges(visible, hidden)`. Behaviour shown in `own-run/focus-dangling`.

### D2-027 · README:2473–2479
> **Load-bearing** … `blocks`, `unblocks`, `depends_on`, `constrains`, `answers`, `enforces`, `enforced_by`, `refines`. **Referential** … `derived_from`, `relates_to`, `links_to`, `discovered_by`, `produced`, `mitigates`, `supersedes`, `superseded_by`. A relation type the table does not list counts as load-bearing.

**Verdict:** VERIFIED
**Citation:** `cli-retrieve/focus-relations` — the printed table lists exactly those eight as
load-bearing and exactly those eight as referential, and states "An unlisted relation type counts as
load-bearing."

### D2-028 · README:2484–2487
> **Focus never hides a `severity: hard` item.** … The report says how many were kept for that reason

**Verdict:** VERIFIED
**Citation:** `cli-retrieve/focus-hard-item-never-hidden` — "1 severity:hard item(s) do not match
this focus and are injected anyway — focus never hides one: CONST-never-commit-a-secret". Reproduced
independently in `own-run/focus-dangling`, where `CONST-never-commit-a-secret` survived a `billing`
focus it does not match.

### D2-029 · README:2489–2492
> A hidden item is **hidden, not gone**: it is still in the corpus, still in `mycontext list`, still readable with `mycontext show`, still findable by `mycontext search` and by `query_items`.

**Verdict:** VERIFIED
**Citation:** `own-run/focus-hidden-not-gone` — with `focus billing` active and
`OPENQ-how-do-refunds-settle` hidden: `mycontext list` still lists it, `mycontext show
OPENQ-how-do-refunds-settle` still prints it, and `mycontext search --text refunds` still returns it.

### D2-030 · README:2496–2502
> The disclosure is in **the injected block** … `_Focus is active (tags: billing). 7 item(s) hidden by focus, 2 load-bearing relation(s) now dangling: OPENQ-a blocks REQ-b; REQ-c depends_on DEC-d. Nothing is deleted: \`mycontext focus --show\` lists what is hidden, \`mycontext focus --clear\` restores it._`

**Verdict:** VERIFIED
**Citation:** `src/core/render.ts:112–137` — `renderFocus` composes exactly
`_Focus is active (${describeFocus(report.axes)}). ${subject}, ${dangling}. Nothing is deleted:
\`mycontext focus --show\` lists what is hidden, \`mycontext focus --clear\` restores it.${exempt}_`,
with `subject` = `${n} item(s) hidden by focus` and `dangling` =
`${n} load-bearing relation(s) now dangling: ${named}`, `named` being `from type to` joined by `; `.

### D2-031 · README:2507–2508
> **A focus belongs to the workspace, not to one session** … It is stored in `.my_context/state/focus.json`

**Verdict:** VERIFIED
**Citation:** `own-run/focus-file` — after `mycontext focus billing`, `.my_context/state/focus.json`
contains `{"protocol":"my_context/focus@1","tags":["billing"],"categories":[],"scope":[],
"setAt":"2026-08-17T14:03:11.196Z","setBy":"human"}`. Written by `writeFocus`,
`src/core/focus.ts:383–392`.

### D2-032 · README:2508–2509
> `.my_context/state/focus.json`, which is **gitignored** generated state — so it is local to your machine and never narrows a teammate's injection.

**Verdict:** CONTRADICTED
**Citation:** `own-run/git-check-ignore` in a real `git init` repo (`%TEMP%\d2-git`):
`git check-ignore -v .my_context/state/focus.json` exits **1** (not ignored), while the same command
on `.my_context/.audit/audit.jsonl` exits 0 matching `.my_context/.audit/.gitignore:1:*`.
`git status --porcelain -uall` lists `?? .my_context/state/focus.json` as untracked-and-committable,
while `git status --ignored` lists only `.my_context/.audit/.gitignore`,
`.my_context/.audit/audit.jsonl` and `.my_context/.index.db` as ignored.
**Note:** `mycontext init` writes exactly one `.gitignore` under `.my_context/`
(`src/cli/index.ts:174`: `'.index.db\n.index.db-*\n'`), which does not cover `state/`. Unlike
`.audit/` (`src/core/jsonl-log.ts:76`) and the ledger dir (`src/core/ledger.ts:406`), no code writes
a `.gitignore` into `state/`, and none exists there after a focus is set. A `git add -A` would
commit the focus and narrow a teammate's injection.

### D2-033 · README:2516–2518
> every focus change is written to the audit log with its origin — so `mycontext audit --kind focus` answers "who narrowed this, and when"

**Verdict:** VERIFIED
**Citation:** `own-run/audit-kind-focus` — after `mycontext focus billing`, `mycontext audit --kind
focus` printed one row: `08-17 14:03:11 | focus-set | human | | tags: billing`. Also
`cli-retrieve/audit-kind-focus` (exit 0).

### D2-034 · README:2519–2520
> a focus file that cannot be read fails **open**, hiding nothing, and says so in the injected block

**Verdict:** VERIFIED
**Citation:** `src/core/focus.ts:374–380` — `focusErrorNote` emits
"_my_context: `.my_context/state/focus.json` …, so NO focus is in effect and nothing is hidden…_";
`src/core/inject.ts:317` pushes the audit note `'focus file unreadable, no focus applied'` on the same
condition.

### D2-035 · README:2524–2526
> `mycontext query` runs one read-only SQL statement against `.my_context/.index.db`. The index is a cache … `mycontext rebuild` recreates the database from them

**Verdict:** VERIFIED
**Citation:** `src/cli/commands/query.ts:304–309` — `openRebuiltStore(ws)` then
`Store.openReadOnly(ws.dbPath)`; `own-run/rebuild` — `mycontext rebuild` printed "indexed 1 item(s)".

### D2-036 · README:2530–2543
> **`items` — one row per item** … `id`, `type`, `title`, `status`, `always`, `has_scope`, `layer`, `file_path`, `updated_at`, `data`

**Verdict:** VERIFIED
**Citation:** `own-run/query-pragma-table-info` —
`mycontext query "SELECT name FROM pragma_table_info('items')"` returned exactly, in order:
`id, type, title, status, always, has_scope, layer, file_path, updated_at, data` (10 rows).

### D2-037 · README:2537
> Only `active` is ever injected

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:124` — `if (item.status !== 'active') return false;` in the
eligibility predicate.

### D2-038 · README:2545–2553
> `schema_version(version)` holds a single row … `rebuild` creates none of these, so a query against an index that has only ever been rebuilt fails with `no such table: ledger`.

**Verdict:** VERIFIED
**Citation:** `cli-retrieve/query-ledger-missing-table` — `query "SELECT * FROM ledger"` exits 1 with
"my_context: query failed — no such table: ledger". `own-run/query-schema-version` —
`SELECT version FROM schema_version` returned a single row (`2`). `own-run/sqlite-master` —
`SELECT name FROM sqlite_master` on a rebuilt-only index lists `items`, `schema_version` and five
indexes, and neither `ledger` nor `ledger_source`.
**Note:** The column lists for `ledger(session_id, item_id, tier, injected_at)` and
`ledger_source(file, bytes)` were not reachable from a rebuilt-only index, so those two column lists
are unverified; the "rebuild creates none of these" claim they are attached to is verified.

### D2-039 · README:2555–2559
> **`data` is camelCase; the Markdown frontmatter is snake_case.** … `json_extract(data, '$.valid_from')` returns `NULL` rather than an error

**Verdict:** VERIFIED
**Citation:** `own-run/query-camelcase` —
`SELECT json_extract(data,'$.valid_from') AS snake, json_extract(data,'$.validFrom') AS camel`
returned `snake = NULL`, `camel = 2026-08-17`, exit 0. `own-run/query-data-keys` — `json_each` over
`data` yields `id, type, title, status, severity, always, scope, tags, origin, sourceFile,
sourceAnchor, sourceChecksum, validFrom, validUntil, checksum, extra, body, observations, relations,
layer, filePath` — camelCase throughout, and `body`, `observations`, `relations`, `extra` all present.

### D2-040 · README:2561–2567
> **`updated_at` is index write time, not a Markdown timestamp.** Every `mycontext query` rebuilds the index before it reads, so `updated_at` is rewritten to *now* on every row on every run, whether or not the underlying Markdown changed.

**Verdict:** VERIFIED
**Citation:** `own-run/query-updated-at` — two consecutive
`query "SELECT id, updated_at FROM items ORDER BY id LIMIT 2"` runs one second apart, with no
Markdown change between them, returned `2026-08-17 14:08:43` then `2026-08-17 14:08:44` for both rows.

### D2-041 · README:2571–2588, 2595–2607, 2612–2622
> the three `<!-- example: query … -->` output blocks

**Verdict:** UNVERIFIED
**Note:** Generated against this repository's own 39-item corpus, which no captured record and no
scratch workspace reproduces; the row values cannot be checked without the same corpus.

### D2-042 · README:2591–2593
> `scope` is not a column — it is a JSON array inside `data`, and `has_scope` is the indexed flag

**Verdict:** VERIFIED
**Citation:** `own-run/query-pragma-table-info` — the `items` column list contains `has_scope` and no
`scope`; `own-run/query-scope-json` — `json_extract(data,'$.scope')` returns the array.

### D2-043 · README:2609–2610
> the `query_items` tool filters by tag, and **no CLI command does**

**Verdict:** CONTRADICTED
**Citation:** `cli-retrieve/search-tag` — `mycontext search --tag db`, exit 0. Reproduced in
`own-run/search-tag`: after tagging `RULE-write-the-failing-test-first` with `privacy,db`,
`mycontext search --tag privacy` returned that one item, exit 0. `mycontext search --tag` is a CLI
command that filters by tag.
**Note:** `--tag` is advertised in `search`'s own registry usage, and `src/cli/commands/search.ts`
registers it; this is not an undocumented back door.

### D2-044 · README:2625–2626
> `query` refuses anything that is not a single statement beginning with `SELECT` or `WITH`

**Verdict:** VERIFIED
**Citation:** Prefix half: `cli-retrieve/query-insert-refused`, `query-drop-refused`,
`query-pragma-refused` — each exits 1 with "only SELECT (or WITH … SELECT) is accepted. Yours starts
with \"X\"". Single-statement half (not exercised by any captured record):
`own-run/query-multi-statement` — `query "SELECT 1; DROP TABLE items"` exits 1 with "my_context: pass
exactly one statement. `;` may only appear at the very end." `WITH` accepted:
`cli-retrieve/query-with-cte-allowed`, exit 0.
**Note:** The three captured refusals above all fire from the **prefix** check, not the keyword
denylist — see D2-045, which needed its own runs.

### D2-045 · README:2626–2627
> and refuses a list of statement keywords — `INSERT`, `DROP`, `PRAGMA`, `ATTACH`, `VACUUM` and the rest — wherever they appear outside a string literal or a comment

**Verdict:** VERIFIED
**Citation:** Keyword-scan half, with the keyword mid-statement so the prefix check cannot fire —
`own-run/query-keyword-midstatement`: `query "SELECT id FROM items VACUUM"` → exit 1, "query is
read-only — \"VACUUM\" is not allowed"; same for `… DROP` → "\"DROP\" is not allowed", `… ATTACH` →
"\"ATTACH\" is not allowed", `… DELETE` → "\"DELETE\" is not allowed". The "outside a string literal
or a comment" qualifier, tested in both directions — `own-run/query-keyword-in-literal`:
`query "SELECT 'DROP TABLE items' AS s"` exits 0 and returns the string;
`query "SELECT id FROM items -- DROP TABLE items"` exits 0;
`query "SELECT id /* VACUUM INTO 'x' */ FROM items"` exits 0.
**Note:** The full list at `src/cli/commands/query.ts:53–57` is INSERT, UPDATE, DELETE, REPLACE, DROP,
CREATE, ALTER, TRUNCATE, VACUUM, PRAGMA, ATTACH, DETACH, REINDEX, ANALYZE, BEGIN, COMMIT, ROLLBACK,
SAVEPOINT, RELEASE — all five named in the README are on it.

### D2-046 · README:2627–2629
> It then opens the database on a read-only connection, and that is what the engine enforces against writes to `items`, `ledger` and `schema_version` in that file.

**Verdict:** VERIFIED
**Citation:** `src/cli/commands/query.ts:309` — `store = Store.openReadOnly(ws.dbPath)`;
`src/core/store.ts:382–384` — `new DatabaseSync(dbPath, { readOnly: true })`.
`own-run/readonly-engine-probe` — on a `{readOnly:true}` connection to a copy of a real
`.my_context/.index.db`: `DELETE FROM items` → "attempt to write a readonly database";
`UPDATE schema_version SET version=99` → same; `INSERT INTO items (id) VALUES ('x')` → same.

### D2-047 · README:2629–2631
> The keyword list is deliberately not the guarantee: a denylist over a full SQL grammar cannot be complete, and this one is not.

**Verdict:** VERIFIED
**Citation:** `own-run/query-pragma-function` —
`query "SELECT name FROM pragma_table_info('items')"` exits 0 and returns all ten column names: the
`\bPRAGMA\b` word-boundary scan does not match `pragma_table_info`. `own-run/query-sqlite-master` —
`SELECT name FROM sqlite_master` exits 0 and enumerates the schema. Both are read-only, so they
demonstrate the disclosed incompleteness rather than a write path. Corroborated by the source's own
statement at `src/cli/commands/query.ts:93–97` ("it has no entry for `sqlite_dbpage` or
`writable_schema`, and `strip` above does not understand backtick or `[bracket]` identifiers").

### D2-048 · README:2631–2633
> The exception worth knowing is `VACUUM INTO '<path>'`, which writes a full copy of the database to a path the caller names rather than to the index — the read-only connection does not stop it

**Verdict:** VERIFIED
**Citation:** `own-run/readonly-engine-probe` — on the same `{readOnly:true}` connection that refused
`DELETE`/`UPDATE`/`INSERT` above, `VACUUM INTO '<tempdir>/vac-out.db'` SUCCEEDED and produced a
36,864-byte database file on disk.

### D2-049 · README:2633–2634
> so for that one statement the keyword check is the only barrier there is

**Verdict:** CONTRADICTED
**Citation:** `own-run/query-wrap-barrier`. `cmdQuery` never sends the caller's SQL as written: it
sends `withRowCap(sql, limit+1)` = `SELECT * FROM (\n<sql>\n) LIMIT n`
(`src/cli/commands/query.ts:260–262`, called at `:314`). Executing exactly that wrapped form —
`SELECT * FROM (\nVACUUM INTO '<tempdir>/wrapped-out.db'\n) LIMIT 1001` — on a `{readOnly:true}`
connection was refused by the engine with `near "INTO": syntax error`, and no file was written. The
row-cap wrap is therefore a second, independent barrier to `VACUUM INTO` through `mycontext query`;
the keyword check is not the only one.
**Note:** This is a documentation inaccuracy in the conservative direction — the README understates
the protection. `mycontext query "VACUUM INTO '<path>'"` is refused in practice
(`own-run/query-vacuum-into`, exit 1), and no run produced a file at a caller-named path. The
statement it makes about the *engine* (D2-048) is correct.

### D2-050 · README:2638–2639
> Every reporting command — `status`, `list`, `decay`, `review list`, `doctor`, `ingest-status` — takes `--full`, `--short` (the default) and `--summary`, and `--json`.

**Verdict:** VERIFIED
**Citation:** `test/cli/unknown-flag-refusal.test.ts:102–116` asserts each of `--full --short
--summary --json` exits 0 with no "unknown option" on every command in `REPORTING`, which
`:78–83` pins to `['decay','doctor','ingest-status','list','review','search','status']`.

### D2-051 · README:2640–2646
> `--full` is **not** a wider table: it prints one stanza per item, every field on its own labelled line … Nothing is dropped or elided at any level; what does not fit on a line is wrapped onto the next.

**Verdict:** VERIFIED
**Citation:** `own-run/doctor-full` — `mycontext doctor --full` printed
`warn  dead_scope` then `item`, `message` on their own labelled lines, with the message wrapped
across four continuation lines and nothing elided.

### D2-052 · README:2648–2650
> Everything is laid out to 100 columns. That is a constant, not your terminal's width … Set `MYCONTEXT_WIDTH` to lay out to a different one.

**Verdict:** VERIFIED
**Citation:** `own-run/width-default` — longest line of `mycontext doctor --full` = 98 characters.
`own-run/width-60` — the same command under `MYCONTEXT_WIDTH=60` produced a longest line of 75
characters.

### D2-053 · README:2651–2655
> no column is ever narrowed below its longest single token … A table whose own tokens are wider than the budget … is therefore left at its natural width

**Verdict:** VERIFIED
**Citation:** `own-run/width-40` — `MYCONTEXT_WIDTH=40 mycontext list` still rendered the full
35-character `id` column (`LESSON-retry-storms-need-jitter` etc.) and left the table at its natural
width rather than truncating any id.

### D2-054 · README:2655–2656
> Every report in this repository's own corpus now fits: the widest, `list`, is 97 columns.

**Verdict:** UNVERIFIED
**Note:** A measurement over this repository's own 39-item corpus, which no captured record or
scratch workspace reproduces.

### D2-055 · README:2658–2660
> `--json` … carries any corpus load errors inside the document so it stays parseable

**Verdict:** VERIFIED
**Citation:** `cli-retrieve/query-json` — the document is
`{ "rows": […], "rowCount": 1, "truncated": false, "limit": 1000, "loadErrors": [] }`;
`loadErrors` is inside the JSON, not appended after it. Source: `src/cli/commands/query.ts:334–340`.

### D2-056 · README:2661–2662
> An option none of them recognises is refused, not silently ignored — all six, checked against the command registry by `test/cli/unknown-flag-refusal.test.ts` rather than command by command.

**Verdict:** VERIFIED
**Citation:** `test/cli/unknown-flag-refusal.test.ts:61–66` builds `DISCOVERED` from
`COMMANDS.values()` filtered by `c.usage.includes(DETAIL_USAGE)` — registry-driven, not a hand list —
and `:85–101` asserts exit 1 plus `unknown option "--ful"` for every member. All six reporting
commands the README names at 2638–2639 are covered (`review` is added at `:66` because its registry
usage string is a subcommand list).
**Note on the reconciliation asked for:** the test's registry-discovered set is
`['decay','doctor','ingest-status','list','search','status']` — six, but not the same six: it adds
`search` and reaches `review` by hand. Separately, the 10 commands the README lists at 2841–2843 as
skipping the shared refusal are not in tension with this claim: 2661 is scoped to the *reporting*
commands only, and none of the 10 is one. Two of those 10 are nevertheless misfiled — see D2-075.

### D2-057 · README:2663–2664
> `review promote` and `review discard` are checked against their own flag sets

**Verdict:** VERIFIED
**Citation:** `test/cli/unknown-flag-refusal.test.ts:147–166` — `review promote REQ-nope --json`
exits 1 with `unknown option "--json"`, and `review discard REQ-nope --scope a/**` exits 1 with
`unknown option "--scope"`, while `review list --type requirement` exits 0.

### D2-058 · README:2669–2683
> the `<!-- example: status --summary -->` output block

**Verdict:** UNVERIFIED
**Note:** Generated against this repository's own corpus ("10 item(s)", "1 draft(s) pending"), which
no scratch workspace reproduces.

### D2-059 · README:2686–2689
> Tables are drawn with box characters where the terminal supports them and plain ASCII where it does not … Set `MYCONTEXT_ASCII=1` to force it, or `MYCONTEXT_UNICODE=1` to force the other way.

**Verdict:** VERIFIED
**Citation:** `own-run/ascii-unicode` — `MYCONTEXT_ASCII=1 mycontext list` rendered
`+-----+---+---+` / `| id | type | status |`; `MYCONTEXT_UNICODE=1 mycontext list` rendered
`┌───┬───┬───┐` / `│ id │ type │ status │`.

### D2-060 · README:2691–2692
> `mycontext query` … takes `--json` and `--limit <n>` only, and refuses anything else

**Verdict:** VERIFIED
**Citation:** `cli-retrieve/query-detail-flag-rejected` — `query "SELECT id FROM items" --full` exits
1 with "unknown flag \"--full\" for `query`. It accepts --json and --limit only". Source:
`src/cli/commands/query.ts:25–26, 189–197`.

### D2-061 · README:2693–2695
> Its `--json` is a document — `{ rows, rowCount, truncated, limit, loadErrors }` — not a bare array: results are capped at 1000 rows by default, and `truncated` is how a machine learns the answer was cut.

**Verdict:** VERIFIED
**Citation:** `cli-retrieve/query-json` — keys exactly `rows, rowCount, truncated, limit, loadErrors`
with `limit: 1000`. `own-run/query-cap-1000` — a 2000-row recursive CTE under default settings
returned `rowCount 1000, truncated true, limit 1000`. `own-run/query-cap-notice` — with `--limit 5`
the table form printed "5 row(s) shown — capped, there are more" plus "my_context: this result was
CAPPED at 5 row(s) and more rows matched".

### D2-062 · README:2695–2696
> Put a `--` before SQL that begins with a `--` comment.

**Verdict:** VERIFIED
**Citation:** `cli-retrieve/query-double-dash-separator` — `query -- "-- a comment\nSELECT id FROM
items"` exits 0 and returns rows. Without the separator, `own-run/query-comment-no-separator` exits 1
with the unknown-flag message, which names `--` as the way through.

### D2-063 · README:2788
> `--limit <n>` … Default 1000, minimum 1; there is no unlimited setting.

**Verdict:** VERIFIED
**Citation:** `cli-retrieve/query-limit-zero-refused` — `--limit 0` exits 1: "--limit takes a whole
number of rows, 1 or more (got \"0\"). There is no unlimited setting". Default 1000 from
`cli-retrieve/query-json` (`"limit": 1000`).

### D2-064 · README:2700–2703
> Fourteen tools, served over stdio by `src/mcp/server.ts` … every item write it makes through them is stamped as an agent write

**Verdict:** VERIFIED
**Citation:** `own-run/mcp-tools-list` — `tools/list` returned exactly 14: `audit_log, create_item,
focus_context, get_item, ingest_document, link_items, list_drafts, load_context, mycontext_examples,
mycontext_help, query_items, refresh_item, supersede_item, update_item`. Agent stamping:
`src/mcp/tools.ts:539` (`update_item` → `origin: 'agent'`), `:598` (`refresh_item`), `:617`
(`supersede_item`), `:635` (`link_items`).

### D2-065 · README:2707
> `create_item` … Idempotent: calling it twice reports the existing item rather than duplicating it

**Verdict:** VERIFIED
**Citation:** `mcp/create_item-idempotent` and its readback `mcp/create_item-idempotent-readback`.

### D2-066 · README:2708
> `update_item` … It **refuses** `scope`, `always` and `severity` on a governing normative item

**Verdict:** VERIFIED
**Citation:** `own-run/mcp-update-guards` against an `active` `constraint`:
`update_item{scope:["src/**"]}` → isError, "a non-human caller cannot change the scope of a governing
normative item"; `update_item{always:true}` → isError, "…the always flag…";
`update_item{severity:"hard"}` → isError, "…the severity…". Guard at
`src/core/mutate.ts:511–557` via `guardedChange` (`src/core/trust.ts:283–290`).
**Note:** `mcp/update_item-severity-on-governing-refused` does NOT verify this claim despite its
name: it passed `severity:"soft"` to an item already at `soft`, so `guardedChange`
(`trust.ts:288`, `input.severity !== item.severity`) returned null, the guard never ran, and the
result was "my_context: updated CONST-pool-capped-at-20 (active)." with `isError: false`. The scope
and always records did reach the guard.

### D2-067 · README:2708
> and `status` on any normative item

**Verdict:** VERIFIED
**Citation:** `own-run/mcp-update-status` — `update_item{id:"CONST-pool-capped-at-20",
status:"deprecated"}` on an active constraint → isError, "a non-human caller cannot change the status
of a normative item. CONST-pool-capped-at-20 stays \"active\"". Guard at `src/core/mutate.ts:560–603`.
Tier discrimination confirmed: the same call against the rationale-tier `DEC-we-chose-stripe`
succeeded ("updated DEC-we-chose-stripe (deprecated)"), matching "any **normative** item".
**Note:** `mcp/update_item-status-on-normative-refused` does NOT verify this claim: it passed
`status:"active"` to an already-active item, so the `input.status !== item.status` condition at
`mutate.ts:561` was false, the guard never ran, and the result was "updated …" with `isError: false`.

### D2-068 · README:2708
> A change to title, body, tags or `extra` is applied or **staged as a pending revision** according to the category's `agentEdits` setting, which defaults to staging for every normative category

**Verdict:** VERIFIED
**Citation:** `own-run/mcp-update-title` — `update_item{title:"Pool capped at twenty"}` on the
governing constraint returned "NOT applied — staged as revision REV-c691ba1a3aea for review.
CONST-pool-capped-at-20 is unchanged". Also `mcp/update_item-title` and `mcp/update_item-extra` (both
staged). Default: `src/core/mutate.ts:621–623` — "`agentEditsFor` fails closed to `review` for a
category absent from config".

### D2-069 · README:2709
> `refresh_item` … the server re-reads the item's own `source_file` and replaces the body … It takes an id and no body.

**Verdict:** VERIFIED
**Citation:** `own-run/mcp-refresh` — created `REF-spec-snapshot` from `spec.md`, appended a line to
`spec.md`, then `refresh_item{id:"REF-spec-snapshot"}` → "updated REF-spec-snapshot (active)" and
`mycontext show` confirmed the body now carries both lines. `refresh_item{id, body:"pasted"}` →
isError, "refresh_item does not take \"body\". It accepts: id." Second call with the file unchanged →
"already current — \"spec.md\" is unchanged since it was snapshotted".

### D2-070 · README:2709
> Applied or **staged for review** on the same `agentEdits` terms as `update_item`

**Verdict:** VERIFIED
**Citation:** `src/mcp/tools.ts:598` — `refresh_item` ends in
`updateItem(ctx, { id, body: snapshot.body, origin: 'agent' }, 'refresh')`, i.e. the same routing at
`src/core/mutate.ts:623`. Applied half shown in `own-run/mcp-refresh` on the rationale-tier
`reference` category.
**Note:** The staged half was not exercised by a run — it requires a `reference` category retiered to
normative — so it rests on the shared code path rather than an observed staging message.

### D2-071 · README:2709
> and refused on an ingested item, whose body is an extraction rather than a copy

**Verdict:** VERIFIED
**Citation:** `src/core/reference.ts:127–129` — `isSnapshot` requires `item.sourceAnchor === null`,
and an ingested item is exactly the item that carries a `source_anchor`;
`src/mcp/tools.ts:577–585` throws on `!isSnapshot(item)` with a message naming that case.
**Note:** `mcp/refresh_item-non-snapshot` and `own-run/mcp-refresh-non-snapshot` both fired this
refusal from a plain item with no `source_file` at all, not from an ingested item, so the ingested
branch is verified by the predicate rather than by a run that carried a `source_anchor`.

### D2-072 · README:2710
> `supersede_item` … It **refuses** to retire a governing normative item — that decision is a human's

**Verdict:** VERIFIED
**Citation:** `own-run/mcp-supersede-governing` —
`supersede_item{id:"CONST-pool-capped-at-20", by:"CONST-pool-capped-at-50"}` with **both ids
existing** → isError, "a non-human caller cannot supersede a governing normative item.
CONST-pool-capped-at-20 is currently \"active\", a status only a human sets; retiring it is a human
decision." Origin stamping at `src/mcp/tools.ts:617`.
**Note:** `mcp/supersede_item-governing-refused` does NOT verify this claim despite its name and its
`README 2710` note: it passed `by: "CONST-nope"`, and the refusal that fired was the id-existence
guard — "no item with id \"CONST-nope\". Use query_items to find the right id" — which never reached
the governing check.

### D2-073 · README:2713–2719
> `query_items` … filter by type, status, tag, relation, text or file path · `audit_log` … Filter by item, session, op, actor or time. The argument is `actor`, not `origin`: no tool schema on this surface exposes a property named `origin` · `mycontext_help` … categories, scope, capture, workflow

**Verdict:** VERIFIED
**Citation:** `own-run/mcp-schema-dump` — `query_items | props=[type,status,tag,text,path,relation,
limit]`; `audit_log | props=[item,session,op,kind,actor,since,limit]`;
`mycontext_help | props=[topic]` with `enum` `['categories','scope','capture','workflow']`
(`src/mcp/tools.ts:836`). Scanning all 14 schemas for a property named `origin` returned none.
`mcp/audit_log-origin-refused` — `{origin:"agent"}` → isError, "audit_log does not take \"origin\".
It accepts: item, session, op, kind, actor, since, limit." `mcp/audit_log-actor` — `{actor:"agent"}`
accepted, `isError: false`.
**Note:** Consistent with `reports/LIVE-PASS.md`, which records the MCP parameter as `actor` while
the CLI flag and the record field are both `origin` (`cli-retrieve/audit-origin-agent`).

### D2-074 · README:2716
> `load_context` … inject the pinned items and index now, exactly as a session start does

**Verdict:** VERIFIED
**Citation:** `mcp/load_context-bare` (accepted) and `mcp/load_context-any-arg-refused`
(`{limit:1}` refused); `own-run/mcp-schema-dump` shows `load_context | props=[] | required=[]`.

### D2-075 · README:2719
> `focus_context` … `preview` reports without changing anything; `clear` removes the focus. It cannot hide a `severity: hard` item, and every focus change is recorded in the audit log with its origin

**Verdict:** VERIFIED
**Citation:** `mcp/focus_context-preview` (`{tags:["db"],preview:true}`), `mcp/focus_context-clear`,
`mcp/focus_context-clear-with-axis-refused`, `mcp/focus_context-effect`. `reports/LIVE-PASS.md`
records `focus_context` with `preview:true` reporting the cost and changing nothing. Hard-item
exemption at `src/mcp/tools.ts:859–863` and `:963` ("severity:hard items stay visible regardless");
audit recording via `auditFailureNote(audit)` on the same line, and `own-run/audit-kind-focus`
(D2-033) shows the `focus-set` record carrying `who = human`.

### D2-076 · README:2722–2725
> The tool list is sorted and byte-stable across calls … Every tool declares its complete argument list and refuses anything else

**Verdict:** VERIFIED
**Citation:** `own-run/mcp-tools-list` — the 14 names came back in sorted order (`SORTED? true`) and
two consecutive `tools/list` calls produced byte-identical JSON (`BYTE-STABLE? true`).
`own-run/mcp-unknown-arg-sweep` — calling each of all 14 tools with `{zzznope:1}` produced
`isError: true` and "…does not take \"zzznope\". It accepts: …" in every case, 14 of 14.

### D2-077 · README:2725–2728
> `create_item` in particular refuses `relations` by name … `link_items` will not write [a retirement edge], because it asserts a lifecycle change it does not perform

**Verdict:** VERIFIED
**Citation:** `mcp/create_item-relations-refused` — "create_item does not take \"relations\" …
Relations are added after the item exists". `mcp/link_items-supersedes-refused` — "\"supersedes\"
cannot be added with link_items — it asserts a lifecycle change, not just a relation, and link_items
never touches status."

### D2-078 · README:2732
> The plugin ships one **skill**, `skills/mycontext/SKILL.md`

**Verdict:** VERIFIED
**Citation:** `own-run/skill-file` — `ls my-context/skills/mycontext/` returns exactly `SKILL.md`.

### D2-079 · README:2771
> These twenty-five are all of them.

**Verdict:** CONTRADICTED
**Citation:** The three tables below the sentence list exactly 25 flag names (9 + 12 + 4), but many
CLI flags are absent from all three — including six documented **in this same section** at
README:2298–2306: `audit --since`, `--item`, `--session`, `--op`, `--origin`, and (at 2518)
`--kind`. Also absent and demonstrably real: `audit --until` and `--role`
(`cli-retrieve/audit-until`, `cli-retrieve/audit-role`, both exit 0); `focus --preview`, `--clear`,
`--show`, `--relations`, `--tag`, `--category` (`cli-retrieve/focus-preview`, `focus-clear`,
`focus-show`, `focus-relations`, `focus-tag-flag`, `focus-category`, all exit 0, and
`src/cli/commands/focus.ts:38`); `search --text`, `--path`, `--relation`, `--status`
(`cli-retrieve/search-text-flag`, `search-path`, `search-relation`, `search-status`); and
`edit --unlink` (in `edit`'s own usage banner, `own-run/edit-usage`).
**Note:** Several "Where it works" cells are narrower than reality for the same reason —
e.g. `--limit` is listed as `query` only but `audit --limit` and `search --limit` both work
(`cli-retrieve/audit-limit`, `cli-retrieve/search-limit`), and `--summary`/`--sessions` are listed as
reporting-command flags but `audit --summary` and `audit --sessions` are documented at README:2303
and 2305.

### D2-080 · README:2781
> On `mycontext examples` the same word [`--short`] means something else and is *not* the default

**Verdict:** VERIFIED
**Citation:** `own-run/examples-usage` — `mycontext examples --zzznope` prints
`usage: mycontext examples <category> [--short]`, and `mycontext examples rule` with no flag printed
the whole stored file (frontmatter first), not the cut-down specimen.

### D2-081 · README:2785
> `--quiet` … on `mycontext doctor` only, an older spelling of `--summary`. If you pass both `--quiet` and a detail level, `--quiet` wins and nothing says so

**Verdict:** VERIFIED
**Citation:** `own-run/doctor-quiet-full` — `mycontext doctor --quiet --full` printed exactly one
line, "my_context doctor: 0 error(s), 2 warning(s), 0 note(s) across 2 finding(s).", with no notice
that `--full` had been discarded; `mycontext doctor --full` alone printed the full stanza form.
`test/cli/unknown-flag-refusal.test.ts:119–128` pins `--quiet` as accepted on `doctor`.

### D2-082 · README:2786
> `--sessions <n>` … Default 20; must be a whole number above zero

**Verdict:** VERIFIED
**Citation:** `own-run/decay-default` — bare `mycontext decay` printed "items not injected in the
last 20 session(s)". `cli-retrieve/decay-sessions-zero-refused` — `decay --sessions 0` exits 1;
`cli-retrieve/decay-sessions` — `--sessions 5` exits 0.

### D2-083 · README:2789
> `--type <category>` … A name no category has simply matches nothing — it is not an error

**Verdict:** VERIFIED
**Citation:** `own-run/review-list-bad-type` — `mycontext review list --type nosuchcategory` printed
"my_context: no drafts of type \"nosuchcategory\"." and exited **0**.

### D2-084 · README:2799
> `--severity hard|soft` … Any other word is refused.

**Verdict:** VERIFIED
**Citation:** `own-run/edit-severity-bogus` — `mycontext edit <id> --severity bogus --yes` exits 1
with "\"severity\" must be one of: hard, soft. You passed \"bogus\"."

### D2-085 · README:2804
> `--status <name>` … `superseded` is **refused** here, because a retirement names its replacement

**Verdict:** VERIFIED
**Citation:** `own-run/edit-status-superseded` — `mycontext edit <id> --status superseded --yes`
exits 1, and the message names `mycontext supersede <id> --by <replacement id>` as the route, adding
"To retire an item with no replacement, `--status deprecated` is the status that means exactly that."

### D2-086 · README:2805
> `--by <id>` … **Required** — retirement without a successor is not offered

**Verdict:** VERIFIED
**Citation:** `own-run/supersede-no-by` — `mycontext supersede <id> --yes` exits 1 and prints
`usage: mycontext supersede <retired id> --by <replacement id> [--reason <text>] [--yes]`.

### D2-087 · README:2819–2824
> `--scope` and `--tags` are lists, so a repeat means "and also" … Every other value flag holds a single value, and giving it twice is refused outright — `--body x --body y` stops with a message naming both.

**Verdict:** VERIFIED
**Citation:** `own-run/repeat-scope` — `add constraint "Two scopes" --scope "src/a/**" --scope
"src/b/**" --yes` exits 0 and `mycontext show CONST-two-scopes` lists both globs under `scope:`.
`own-run/repeat-body` — `add constraint "Dup body" --body x --body y --yes` exits 1 with "--body was
given 2 times (\"x\", \"y\"), and it takes a single value … so pass it once."

### D2-088 · README:2828–2833
> `--yes`, `--yes=true`, `--yes=yes`, `--yes=on` and `--yes=1` all confirm; `--yes=false` … decline, leaving the command exactly where it would be with no `--yes` at all — it asks, or refuses if there is no terminal to ask in. Anything else, such as `--yes=maybe`, is refused rather than guessed, and passing both a true and a false spelling of the same flag is refused too.

**Verdict:** VERIFIED
**Citation:** `own-run/yes-variants` on `mycontext edit <id> --title T2`: `--yes=on` → exit 0,
"updated RULE-write-the-failing-test-first (active)"; `--yes=false` → exit 1, "refusing without
confirmation — stdin is not interactive. Rerun with --yes to confirm"; `--yes=maybe` → exit 1,
"--yes accepts true/yes/on/1 or false/no/off/0 (got \"maybe\")"; `--yes --yes=false` → exit 1,
"--yes was given as both true and false … pass it once."

### D2-089 · README:2836–2839
> The commands that check are `add`, `list`, `status`, `decay`, `doctor`, `review` …, `ingest-status`, `query`, `repair`, `supersede` and `edit`.

**Verdict:** CONTRADICTED
**Citation:** `own-run/unknown-flag-sweep` — passing `--zzznope` to every registered command. All 11
named do refuse, but so do five commands the sentence omits, each exiting 1 with `unknown option
"--zzznope"`: **`focus`** (`src/cli/commands/focus.ts:86`, `refuseUnknownFlag`), **`audit`**
(corroborated by `cli-retrieve/audit-unknown-flag`, exit 1), **`search`** (corroborated by
`cli-retrieve/search-unknown-flag`, exit 1), **`refresh`**, and **`examples`**. The list is presented
as the complete set of checking commands and is not.

### D2-090 · README:2839–2841
> `mycontext help` refuses one too, by a different route: it reads whatever follows as a topic name, and `--anything` is not one of its four topics.

**Verdict:** VERIFIED
**Citation:** `own-run/help-unknown-flag` — `mycontext help --zzznope` exits 1 with
"\"topic\" must be one of: categories, scope, capture, workflow. You passed \"--zzznope\"."

### D2-091 · README:2841–2845
> The ones that do **not** check are `init`, `show`, `rebuild`, `examples`, `ingest`, `ingest-apply`, `lesson`, `lesson-stage`, `lesson-accept`, `lesson-discard`: a flag those do not know is ignored without a word. Verified by running each of them.

**Verdict:** CONTRADICTED
**Citation:** `own-run/unknown-flag-sweep`, two of the ten are misfiled.
**`examples`** — `mycontext examples --zzznope` and `mycontext examples rule --zzznope` both exit 1
with "my_context: unknown option \"--zzznope\"." followed by
`usage: mycontext examples <category> [--short]`. That is the shared refusal, verbatim, on a command
the sentence says does not check.
**`init`** — `mycontext init --zzznope` exits 1 with "my_context: init takes no arguments, and
\"--zzznope\" was passed. Nothing was created — an argument this command cannot act on is refused
rather than ignored." Not "ignored without a word"; the message says the opposite in as many words.
**Note:** The other eight are correct as stated: `show <id> --zzznope`, `rebuild --zzznope`,
`ingest <path> --zzznope` and `lesson "<text>" --zzznope` all exit 0 with the flag silently dropped
(the bare forms of `show`/`ingest`/`lesson` fail only because the flag is consumed as the missing
positional). The `lesson-stage`, `lesson-accept`, `lesson-discard` and `ingest-apply` bare forms
likewise print usage rather than an unknown-option refusal.
