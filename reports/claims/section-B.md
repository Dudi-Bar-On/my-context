# Section B — README lines 392–1300

94 claims: 86 verified, 6 contradicted, 2 unverified

Scope: `my-context/README.md` lines 392–1300 — "3. How it works, in three steps" (Step 1 capture,
the lesson→rule pipeline, the ingest pipeline, the reference/snapshot pipeline, Step 2 storage,
Step 3 injection).

Own-run citations were produced by materializing the plugin's committed documentation fixture
(`my-context/test/fixtures/docs-workspace`, via `scripts/doc-fixture.ts`) into `$TEMP` and running
`node my-context/src/cli/index.ts` there — never inside the repo. Those are cited as
`own-run/<label>`.

---

### B-001 · README:410
> about to create constraint "Uploads capped at 10 MB" — active, and governing this project at once.
> my_context: created CONST-uploads-capped-at-10-mb (active) at items/constraint/CONST-uploads-capped-at-10-mb.md.

**Verdict:** VERIFIED
**Citation:** `cli-capture/add-normative-with-yes` — stdout is these two lines verbatim, byte-for-byte.

### B-002 · README:415
> Everything after the title is an **option** — a `--name value` pair that sets one field on the item.

**Verdict:** VERIFIED
**Citation:** `cli-capture/add-body`, `cli-capture/add-scope-comma`, `cli-capture/add-tags` — each sets one field via `--name value` and exits 0; `cli-capture/add-equals-form` shows `--severity=hard` is the same option in its other spelling.

### B-003 · README:418
> `--body "…"` is the item's text: the paragraph Claude will actually be given.

**Verdict:** VERIFIED
**Citation:** `own-run/session-start-fixture` — the injected block for `CONST-postgres-pool-capped-at-20` is exactly that item's body text; `cli-capture/add-body` writes it.

### B-004 · README:422
> a **scope glob** — a file-path pattern, where `*` matches within one directory level and `**` matches across as many as it needs

**Verdict:** VERIFIED
**Citation:** `own-run/glob-semantics` over `src/core/paths.ts:44` (`matchesAnyGlob`) — `src/*` vs `src/api/x.ts` → false; `src/*/*.ts` vs `src/api/x.ts` → true; `src/**` vs `src/a/b/c/x.ts` → true; `src/*/x.ts` vs `src/a/b/c/x.ts` → false.

### B-005 · README:424
> Scope *restricts*, so a rule with no scope is not restricted to anything and applies to every file

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:192-194` — `matchesScope` returns `scopePolicyFor(...) !== 'inert'` when `item.scope.length === 0`, i.e. true for the default policy on every path.

### B-006 · README:427
> `--tags uploads` attaches free-form labels. They change nothing about when an item is injected; they are there so you can find it later.

**Verdict:** CONTRADICTED
**Citation:** `cli-retrieve/focus-preview` — `mycontext focus db --preview` reports "1 item(s) in focus, 5 hidden by focus (of the eligible corpus)" and names the five items removed from injection; the axis it filtered on is `tags: db`. The mechanism is `src/core/select.ts:228` (`matchesFocus` rejects an item whose `tags` do not intersect the focus tags) reached from `src/core/select.ts:470-472`, which narrows `eligible` before every tier.
**Note:** Expected: tags never influence injection. Actual: with a focus active, the tag axis decides whether a `soft` item is injected at all. The exception is `severity: hard`, which is exempt (`select.ts:244`). The claim is true only for a workspace with no focus set; it is stated without qualification. Same claim restated at README:1224 (B-077).

### B-007 · README:429
> `--yes` is required because this is a normative category. … Rationale categories need no confirmation.

**Verdict:** VERIFIED
**Citation:** `cli-capture/add-normative-without-yes` — exit 1, "refusing without confirmation"; `cli-capture/add-normative-with-yes` — exit 0, created; `cli-capture/add-rationale-without-yes` — `add decision "We chose Stripe"` with no `--yes`, exit 0, created active.

### B-008 · README:433
> The id, `CONST-uploads-capped-at-10-mb`, is derived from the title. You will see it in Claude's context, in `mycontext list`, and in the filename.

**Verdict:** VERIFIED
**Citation:** `cli-capture/add-normative-with-yes` — id and filename `items/constraint/CONST-uploads-capped-at-10-mb.md`; `own-run/list-fixture` — `mycontext list` prints an `id` column; `own-run/session-start-fixture` — ids appear in the injected block and index lines.

### B-009 · README:436
> All twenty-five options the CLI takes are listed together in [every flag, in one place](#every-flag-in-one-place).

**Verdict:** CONTRADICTED
**Citation:** The referenced table (README:2778–2812) has exactly 25 rows, but the CLI accepts many flags absent from it, each exercised at exit 0: `cli-retrieve/focus-preview` (`--preview`), `cli-retrieve/focus-clear` (`--clear`), `cli-retrieve/focus-show` (`--show`), `cli-retrieve/focus-relations` (`--relations`), `cli-retrieve/search-text-flag` (`--text`), `cli-retrieve/search-tag` (`--tag`), `cli-retrieve/search-path` (`--path`), `cli-retrieve/search-relation` (`--relation`), `cli-retrieve/audit-since-span` (`--since`), `cli-retrieve/audit-until` (`--until`), `cli-retrieve/audit-item` (`--item`), `cli-retrieve/audit-session` (`--session`), `cli-retrieve/audit-kind-injection` (`--kind`), `cli-retrieve/audit-op-create` (`--op`), `cli-retrieve/audit-origin-agent` (`--origin`), `cli-retrieve/audit-role` (`--role`), `cli-retrieve/audit-items` (`--items`), `cli-retrieve/audit-files` (`--files`), `cli-retrieve/focus-category` (`--category`).
**Note:** Expected: 25 is the complete set of CLI options. Actual: the table's 25 rows are correct as a count of rows, but at least 19 further accepted flags are not in it. README:2770 restates the same claim ("These twenty-five are all of them") — that line is outside this section's range.

### B-010 · README:439
> Claude can capture items too, using the `create_item` tool. A normative item captured that way lands as a draft and waits for you.

**Verdict:** VERIFIED
**Citation:** `mcp/create_item-minimal` — `create_item {type: constraint, title: "Uploads capped at 10 MB"}` returns "created CONST-uploads-capped-at-10-mb (draft) … It is a draft because non-human-authored normative items are not injected until reviewed".

### B-011 · README:448
> `mycontext lesson "<what was learned>"` records the lesson — rationale tier, so it is indexed and searchable and never injected uninvited — and prints a **rule-derivation request**: the lesson, a JSON schema, and instructions

**Verdict:** VERIFIED
**Citation:** `cli-pipelines/lesson-record` — first line "lesson LESSON-… recorded (rationale tier — indexed, never injected)", followed by the `my_context RULE DERIVATION REQUEST` block carrying `lessonBody`, `schema` and `instructions`.

### B-012 · README:451
> Hand it the id of a lesson that already exists instead of the text and it re-derives from that one rather than recording a second copy; … its first line says so — `already recorded — nothing was written by this call`

**Verdict:** VERIFIED
**Citation:** `cli-pipelines/lesson-existing-id-is-noop` — argv `["lesson","LESSON-retry-storms-need-jitter-we-learned-that-the-hard-way"]`, first line contains "already recorded — nothing was written by this call (rationale tier — indexed, never injected). Re-deriving rules from it:".

### B-013 · README:456
> my_context has no model of its own, and the request says so in its first line.

**Verdict:** VERIFIED
**Citation:** `cli-pipelines/lesson-record` — "You are deriving rules. my_context has no model of its own — it stages what you return and waits for a human."
**Note:** It is the request's first bullet, not literally the command's first output line (the "recorded" line and the header precede it).

### B-014 · README:460
> **The rule-derivation request, in full** — 77 lines, exactly as the model receives them

**Verdict:** VERIFIED
**Citation:** `own-run/lesson-linecount` — `mycontext lesson LESSON-retry-storms-need-jitter` against the committed doc fixture emits 77 lines; `cli-pipelines/lesson-record` and `cli-pipelines/lesson-existing-id-is-noop` are also 77 lines each. README:464-540 is 77 lines.

### B-015 · README:464-541
> (the full rule-derivation request text)

**Verdict:** VERIFIED
**Citation:** `cli-pipelines/lesson-existing-id-is-noop` — every bullet, the fenced `json` block, `schema`, `callback` and `instructions` match the README block verbatim; the only differences are the fixture's lesson id, `lessonTitle` and `lessonBody`.

### B-016 · README:478
> "protocol": "my_context/rule-derivation-request@1"

**Verdict:** VERIFIED
**Citation:** `cli-pipelines/lesson-record` — the emitted JSON carries exactly this protocol string.

### B-017 · README:484-525
> title maxLength 200 · directive enum ["do","dont"] · severity enum ["hard","soft"] · scope "POSIX globs this governs. Omit rather than guessing; a bare `**` is rejected."

**Verdict:** VERIFIED
**Citation:** `cli-pipelines/lesson-record` — the schema block matches field for field, including `required: ["title","directive","body"]` and `additionalProperties: false`.

### B-018 · README:528
> "cli": "mycontext lesson-stage LESSON-retry-storms-need-jitter --stdin"

**Verdict:** VERIFIED
**Citation:** `cli-pipelines/lesson-record` — `callback.cli` and the "Call back with:" bullet both carry `mycontext lesson-stage <lessonId> --stdin`.

### B-019 · README:546
> Staging writes nothing into your corpus — the candidates sit in a file under `.my_context/.staging/`

**Verdict:** VERIFIED
**Citation:** `own-run/lesson-stage-fixture` — after `lesson-stage`, `.my_context/.staging/` contains `LESSON-retry-storms-need-jitter.json` and no item was created; the command's own first line says "None of them exists as an item yet." Directory constant at `src/lesson/derive.ts:37`.

### B-020 · README:552-562
> my_context: 2 rule candidate(s) staged for LESSON-retry-storms-need-jitter. None of them exists as an item yet. … 99eb0e3d │ do │ Retries add jitter to backoff … 47c76d53 │ dont │ Never retry on a fixed interval

**Verdict:** VERIFIED
**Citation:** `own-run/lesson-stage-fixture` — reproduces the block exactly, including both 8-character keys, the box-drawing table and the two trailing "Accept with:" / "Discard with:" lines.

### B-021 · README:565
> The key is a hash of the candidate's own content — directive, title, body, scope and severity — and not its position in the list

**Verdict:** VERIFIED
**Citation:** `src/lesson/derive.ts:383-391` — `candidateKey` = first 8 chars of `checksum(JSON.stringify({directive, title.toLowerCase(), body, scope.sort(), severity}))`; no index or position is an input.

### B-022 · README:567
> `lesson-stage` replaces the pending set on each run, and it prints the pending candidates the new set did not produce again rather than dropping them silently. Anything you have already accepted or discarded is carried forward untouched: a discarded candidate cannot come back.

**Verdict:** VERIFIED
**Citation:** `src/lesson/derive.ts:421-443` — `settled` (accepted+discarded) is carried forward, `dropped` is the previously-pending set the new derivation did not reproduce; `src/cli/commands/lesson.ts:126-138` prints the dropped table; `src/lesson/derive.ts:504-506` refuses to accept a discarded key.

### B-023 · README:576-583
> my_context: about to create this rule — review before it becomes active: … my_context: created RULE-retries-add-jitter-to-backoff (active) with derived_from [[LESSON-retry-storms-need-jitter]].

**Verdict:** VERIFIED
**Citation:** `own-run/lesson-accept-fixture` — reproduces the block exactly, including `scope: (unrestricted)` and `severity: hard`.

### B-024 · README:588
> `lesson-accept` prints "review before it becomes active" and then creates the rule `active` — governing this project — in the same run. There is no second command and no `--yes` to withhold

**Verdict:** VERIFIED
**Citation:** `src/lesson/derive.ts:518-546` — `createItem(..., status: 'active', ...)`; `src/cli/commands/lesson.ts:267-285` prints the preview then calls `acceptStagedRule` unconditionally — the file contains no confirmation gate for this command. Confirmed live by `own-run/lesson-accept-fixture` (no `--yes` passed, rule created active).

### B-025 · README:591
> `--title`, `--scope`, `--severity` and `--directive` amend the candidate on the way through

**Verdict:** VERIFIED
**Citation:** `src/cli/commands/lesson.ts:207` — usage line `lesson-accept <LESSON-id> <key> [--title "…"] [--scope "a/**,b/**"] [--severity hard|soft] [--directive do|dont]`; `src/lesson/derive.ts:508-515` merges the edits onto the staged candidate and re-validates before creating.

### B-026 · README:592
> `mycontext lesson-discard <lesson> <key>` rejects one for good

**Verdict:** VERIFIED
**Citation:** `src/lesson/derive.ts:562-576` sets state `discarded` and persists it; `src/lesson/derive.ts:504-506` then refuses any later accept of that key.

### B-027 · README:597-627
> The rule that comes out is an ordinary item … with one relation recording where it came from. (frontmatter + `## Relations` / `- derived_from [[LESSON-retry-storms-need-jitter]]`)

**Verdict:** VERIFIED
**Citation:** `own-run/show-rule-fixture` — `mycontext show RULE-retries-add-jitter-to-backoff` reproduces the block exactly, checksum `66d3ef277acdc7ee` included, with a single `derived_from` relation.

### B-028 · README:642
> Point it at a file and it splits the document at its headings, takes the first section nobody has dealt with yet, and prints an **extraction request**: the section's text verbatim, the categories this project has enabled, a JSON schema for what to send back, and the command to send it with.

**Verdict:** VERIFIED
**Citation:** `own-run/ingest-fixture` — `mycontext ingest docs/prd.md` prints `§ bookstore-api-prd (chunk 1 of 3, 3 pending)`, the chunk text inside a fence, `categories` (21), `schema`, and `callback.cli`; `cli-pipelines/ingest-first-chunk` shows the same structure on the harness fixture.

### B-029 · README:646
> my_context has no model of its own and never calls one, and the request says so in its first line.

**Verdict:** VERIFIED
**Citation:** `cli-pipelines/ingest-first-chunk` — first bullet: "You are the extractor. my_context has no model of its own and never calls one — it hands you the text and validates what you return."
**Note:** First bullet of the request; the header line precedes it.

### B-030 · README:649
> **The extraction request, in full** — 244 lines, exactly as the model receives them

**Verdict:** CONTRADICTED
**Citation:** `own-run/ingest-linecount` — `mycontext ingest docs/prd.md` against the committed doc fixture emits **264** lines, and a line-by-line diff against README:653-916 reports 0 differences over 264/264 lines. README:653-916 is itself 264 lines.
**Note:** Expected 244, actual 264 — off by 20. The block's *content* is exact; only the summary's line count is wrong.

### B-031 · README:653
> my_context EXTRACTION REQUEST — docs/prd.md § bookstore-api-prd (chunk 1 of 3, 3 pending)

**Verdict:** VERIFIED
**Citation:** `own-run/ingest-fixture` — first line reproduced verbatim, session id `ING-docs-prd-md-dd2990c9-9e3efbae` matching README:667.

### B-032 · README:655-668
> (the fourteen instruction bullets of the extraction request)

**Verdict:** VERIFIED
**Citation:** `cli-pipelines/ingest-first-chunk` and `own-run/ingest-fixture` — all fourteen bullets match verbatim, including the quote rule, the 200-character single-line title rule, the heading-in-body warning, the array rules, the observation-category charset rule, the `extra`-key rule and the draft-status rule.

### B-033 · README:659
> Every candidate MUST carry a "quote" … It is checked by exact match after whitespace collapsing, and a paraphrase is rejected.

**Verdict:** VERIFIED
**Citation:** `own-run/ingest-paraphrase-fixture` — a candidate whose `quote` is not in the chunk is rejected with `"quote" does not appear in the source chunk "bookstore-api-prd"`; `cli-pipelines/ingest-apply-paraphrase-rejected` shows the same refusal on the harness fixture.

### B-034 · README:662
> "**", "*" and "**/*" are all rejected, because omitting "scope" already means exactly that

**Verdict:** VERIFIED
**Citation:** `own-run/ingest-badglob-fixture` — a candidate with `scope: ["**"]` is rejected: `scope glob "**" matches the whole repository, which is what a "global" scopePolicy already gives an item with no scope at all.`

### B-035 · README:666
> Everything you return lands as status "draft". Nothing you extract governs future work until a human promotes it

**Verdict:** VERIFIED
**Citation:** `own-run/review-list-fixture` — after applying all three chunks, all five ingest-created items appear in `mycontext review list` as pending drafts with `origin ingest`.

### B-036 · README:694-811
> (the 21 enabled categories with their descriptions and extraFields)

**Verdict:** VERIFIED
**Citation:** `own-run/ingest-fixture` — the request's `categories` array has 21 entries, in this order: adr, assumption, constraint, decision, edge_case, environment, glossary, instruction, invariant, known_issue, lesson, non_goal, open_question, pattern, reference, requirement, risk, rule, runbook, standard, tradeoff — matching README name-for-name, including `extraFields` (`assumption`: validate_by/validated_on; `open_question`: blocks; `requirement`: kind; `risk`: likelihood/impact; `rule`: directive).

### B-037 · README:813-904
> (the candidate JSON schema: required type/title/body/quote, additionalProperties false, title maxLength 200, observations shape, extra shape)

**Verdict:** VERIFIED
**Citation:** `own-run/ingest-fixture` — the schema block is byte-identical to README:813-904 (part of the 0-diff comparison in B-030).

### B-038 · README:905-914
> "callback": { "cli": "mycontext ingest-apply ING-… --anchor bookstore-api-prd --stdin", "mcp": { "tool": "ingest_document", "arguments": { "session": …, "anchor": … } } }

**Verdict:** VERIFIED
**Citation:** `own-run/ingest-fixture` — callback object reproduced exactly, session id included.

### B-039 · README:923
> An **anchor** is the heading a section sits under, lower-cased and hyphenated — `## Catalogue and search` becomes `catalogue-and-search`

**Verdict:** VERIFIED
**Citation:** `own-run/ingest-anchor-derivation` — a document with headings `# Bookstore API PRD`, `## Catalogue and search`, `## Checkout and payments` produced anchors `bookstore-api-prd`, `catalogue-and-search`, `checkout-and-payments` in `ingest-status --full`.

### B-040 · README:931
> A rejected candidate is named, is recorded in the session, and leaves its anchor pending.

**Verdict:** VERIFIED
**Citation:** `own-run/ingest-paraphrase-fixture` — the apply names `[0] Made up rule: …`; `ingest-status --full` afterwards shows `0/3` applied, `rejected 1`, and `pending  bookstore-api-prd` with the rejection recorded beneath it.

### B-041 · README:936
> the extraction returns `[]`, the apply reports zero created, zero deduped and zero superseded, and no item is written … a section that yields nothing is still marked done, so the run moves on rather than asking again

**Verdict:** VERIFIED
**Citation:** `own-run/ingest-apply-empty-fixture` — `ingest-apply … --anchor bookstore-api-prd` with the fixture's empty candidate file prints "bookstore-api-prd — created 0, deduped 0, superseded 0." and immediately returns the request for chunk 2; `ingest-status --full` then shows `1/3` with `applied  bookstore-api-prd`.

### B-042 · README:946-957
> (the `ingest-status --full` table and per-session anchor list)

**Verdict:** VERIFIED
**Citation:** `own-run/ingest-status-fixture` — reproduces README:947-957 exactly: `ING-docs-prd-md-dd2990c9-9e3efbae │ docs/prd.md │ 1/3 │ 0`, then `applied  bookstore-api-prd`, `pending  checkout-and-payments`, `pending  catalogue-and-search`.

### B-043 · README:962
> the session is a file in `.my_context/.ingest/`, its id is derived from the document's path and contents, and every apply appends to it

**Verdict:** VERIFIED
**Citation:** `own-run/ingest-session-file` — `.my_context/.ingest/ING-docs-prd-md-dd2990c9-9e3efbae.json`; a different document at the same path `docs/prd.md` produced `ING-docs-prd-md-dd2990c9-5afd7cc5`, i.e. the first component tracks the path and the second the content.

### B-044 · README:964
> Run `mycontext ingest` on the same file again … and you get the **next** pending section rather than the first one. Applying a section returns the next request automatically … `--anchor` re-requests one particular section

**Verdict:** VERIFIED
**Citation:** `own-run/ingest-resume-fixture` — after applying `bookstore-api-prd`, a bare `mycontext ingest docs/prd.md` returns `§ checkout-and-payments (chunk 2 of 3, 2 pending)`; `mycontext ingest docs/prd.md --anchor bookstore-api-prd` returns `§ bookstore-api-prd` again; the apply itself printed the next request inline.

### B-045 · README:966
> Because the id folds in a checksum of the document, editing the document opens a **new** session rather than silently re-cutting the old one's sections; `ingest-status` then lists both

**Verdict:** VERIFIED
**Citation:** `own-run/ingest-edit-fixture` — appending a `## Shipping` section produced `ING-docs-prd-md-dd2990c9-ddc441e4` (chunk 1 of 4), and `ingest-status` listed both it and `…-9e3efbae` (1/3).

### B-046 · README:969
> and the items the first one produced are unaffected

**Verdict:** UNVERIFIED
**Citation:** —
**Note:** The section applied before the document edit in `own-run/ingest-edit-fixture` was `bookstore-api-prd`, which creates zero items, so no run in evidence exercises an item-producing session surviving a document edit.

### B-047 · README:975-981
> my_context: checkout-and-payments — created 3, deduped 0, superseded 0. … my_context: every chunk of docs/prd.md is applied. Promote what you want with `mycontext review`.

**Verdict:** VERIFIED
**Citation:** `own-run/ingest-apply-all-fixture` — reproduces the block exactly, including the three `created` lines in the same order (`CONST-carts-expire-in-30-minutes`, `REQ-refunds-use-payment-intents`, `NOGOAL-guest-checkout-is-excluded`).

### B-048 · README:984
> **Everything ingest creates is a draft.** … all five are sitting in the review queue with `origin ingest` and the file they came from

**Verdict:** VERIFIED
**Citation:** `own-run/review-list-fixture` — the five ingest-created ids appear with `origin` = `ingest` and `source` = `docs/prd.md`, under "6 draft(s) pending".

### B-049 · README:987
> Five items came out of that PRD

**Verdict:** VERIFIED
**Citation:** `own-run/ingest-apply-all-fixture` — bookstore-api-prd created 0, catalogue-and-search created 2, checkout-and-payments created 3.

### B-050 · README:991-1015
> (the `review list` table, "6 draft(s) pending", and the pending-revision notice)

**Verdict:** VERIFIED
**Citation:** `own-run/review-list-fixture` — reproduces README:992-1015 exactly, including the sixth row `RULE-cache-keys-include-tenant-id │ rule │ agent │ no │ - │ …` and the two-line pending-revision notice.

### B-051 · README:1021
> `origin` is the column that says where each item came from, and no tool lets a caller set it.

**Verdict:** VERIFIED
**Citation:** `mcp/create_item-origin-refused` — passing `origin: "human"` is refused with `isError: true`: "origin is never taken from a tool call: every tool that writes on an agent's behalf records origin \"agent\" itself".

### B-052 · README:1042
> Claude can run both legs itself with the `ingest_document` tool, which carries the candidates and the callback in one call.

**Verdict:** VERIFIED
**Citation:** `src/mcp/tools/ingest.ts:126-146` — one schema with `path` (call 1) and `session`/`anchor`/`candidates` (call 2); `src/mcp/tools/ingest.ts:149-181` routes both phases through `runIngestDocument`.
**Note:** It is two calls to one tool, not one call — the tool's own error text says "ingest_document takes two calls". The captured MCP records for it (`mcp/ingest_document-no-args`, `mcp/ingest_document-session-without-anchor`) are argument refusals that reach neither phase, so this rests on source.

### B-053 · README:1043
> There is no slash command for ingest; the CLI and the tool are the two surfaces it has

**Verdict:** CONTRADICTED
**Citation:** `slash/non-per-category-inventory` — the command inventory includes `{"name":"ingest","description":"Extract candidate items from a document, one chunk at a time","argumentHint":"[the path to a document]"}`. The file is `my-context/commands/ingest.md`, and `slash/command-references-real-surface` records it referencing the `ingest`, `ingest-apply` and `ingest-status` subcommands.
**Note:** Expected: two surfaces (CLI + MCP tool). Actual: three — a `/mycontext:ingest` slash command ships and drives the CLI. `slash/file-count` counts 66 command files, `slash/add-count` + `slash/list-count` account for 42 of them; `ingest` is among the remaining non-per-category commands.

### B-054 · README:1053
> `mycontext add reference "<title>" --file <path>` captures the file instead. The body becomes a **snapshot** of it, and the item records where the snapshot came from

**Verdict:** VERIFIED
**Citation:** `own-run/add-reference` — the created item carries `source_file: docs/roadmap.md` and `source_checksum: b4870a16d4017508`, with the file's text as its body.

### B-055 · README:1058-1060
> my_context: snapshotting docs/roadmap.md — 10 line(s), 260 bytes, ~65 estimated tokens … my_context: created REF-billing-roadmap (active) at items/reference/REF-billing-roadmap.md.

**Verdict:** VERIFIED
**Citation:** `own-run/add-reference` — all three lines reproduced verbatim, including the rationale-tier sentence; `config/add-reference` shows the same three-line shape on a different file.

### B-056 · README:1064
> The snapshot is stored **quoted** — every line prefixed with `> `

**Verdict:** VERIFIED
**Citation:** `own-run/show-reference` — every body line of `REF-billing-roadmap` is prefixed `> ` (blank lines as a bare `>`); `src/core/reference.ts:89-91` (`snapshotBody`).

### B-057 · README:1065
> An item's body is the prose before its first `## ` section

**Verdict:** VERIFIED
**Citation:** `src/core/item.ts:101` (`splitSections`) — everything from a `## ` line onward is moved into a named section; `src/core/reference.ts:70-77` states this is why the snapshot is quoted.

### B-058 · README:1067
> the recorded checksum is taken over the file itself rather than over the quoted form, so the number in the frontmatter is the one you get by checksumming the file by hand

**Verdict:** VERIFIED
**Citation:** `own-run/checksum-by-hand` — `sha256(normalizeEol(file).trim()).slice(0,16)` = `b4870a16d4017508`, exactly the `source_checksum` in the item; `src/core/reference.ts:266` passes `text` (the file), not `body` (the quoted form).
**Note:** "By hand" requires CRLF→LF normalization and a trim first (`src/core/reference.ts:57-59`).

### B-059 · README:1073-1106
> (the full `show REF-billing-roadmap` output)

**Verdict:** VERIFIED
**Citation:** `own-run/show-reference` — reproduces README:1074-1105 exactly, including `source_checksum: b4870a16d4017508`, `checksum: 4f599b3a1340122c`, the quoted body and `## Observations` / `- [note] The dates move; …`.

### B-060 · README:1109
> **The file is not read again on its own.** … Two commands read it: this one, and `mycontext refresh`. Everything else reads the item.

**Verdict:** VERIFIED
**Citation:** `readSnapshot` has exactly three call sites in the source: `src/cli/index.ts:229` (`add … --file`), `src/cli/commands/refresh.ts:100` (`mycontext refresh`) and `src/mcp/tools.ts:588` (the `refresh_item` MCP tool). No rebuild, injection or hook path calls it.
**Note:** The third caller is a tool, not a command, and README:1125 names it explicitly two paragraphs later — so "everything else reads the item" holds for every non-refresh path.

### B-061 · README:1121
> `mycontext doctor` compares the file against the snapshot and raises a `source_drift` warning naming the item, both checksums, and the command that resolves it.

**Verdict:** VERIFIED
**Citation:** `cli-mutate/refresh-drifted-readback` — `source_drift (1) [warn]` naming `REF-roadmap`, both checksums (`3cdacd0c3aed7926 → d31b7f593545ee79`) and "run `mycontext refresh REF-roadmap` to take a fresh snapshot".

### B-062 · README:1123
> `mycontext refresh <id>` re-reads the file, shows you the size change before and after, and asks before it writes

**Verdict:** VERIFIED
**Citation:** `cli-mutate/refresh-drifted-no-yes` — prints `checksum 3cdacd0c3aed7926 -> d31b7f593545ee79`, `size 3 -> 3 line(s), ~14 -> ~13 estimated tokens`, then "refusing without confirmation" and exits 1.

### B-063 · README:1125
> Claude has its own route, `refresh_item`, which reads the file server-side rather than composing a body, and which is **staged for your review** rather than applied wherever `agentEdits` says so.

**Verdict:** VERIFIED
**Citation:** `src/mcp/tools.ts:588` — the handler itself calls `readSnapshot` and passes `body: snapshot.body`; `src/mcp/tools.ts:597` writes through `updateItem(..., origin: 'agent', 'refresh')`, and `src/core/mutate.ts:623` routes a non-human content edit to a staged pending revision when `agentEditsFor(config, type) === 'review'`.
**Note:** `mcp/refresh_item-non-snapshot` is a guard refusal (`isError: true`) and does not reach this path; the verdict rests on source.

### B-064 · README:1131
> `reference` is a rationale category, and a rationale item is never injected in full — so a snapshot of any size costs the injection budget nothing … It is stored, searchable by `query_items`, counted in the session index

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:473` — `injectable = eligible.filter(isNormative)`, so no rationale item reaches any full-text tier; `src/core/reference.ts:318-324` is the exact rationale-tier line printed at capture; `own-run/session-start-fixture` shows rationale types reduced to the count line "2 decision · 1 lesson".

### B-065 · README:1136
> If you retier the category to `normative` … the snapshot starts competing for the injection budget like any other item … and one that does not fit spills whole and is disclosed by id … The capture line changes with the tier and tells you which of the two you are getting.

**Verdict:** VERIFIED
**Citation:** `src/core/reference.ts:315-333` — `snapshotBudgetLine` branches on tier; the normative branch names the largest full-text budget and says an item that does not fit "will spill, and every session it spills from is told so by id". Spill records are produced by `src/core/select.ts:281-292` (`fitToBudget`).

### B-066 · README:1144
> **There is a size limit, and it is stated rather than silent.** A file over 256 KiB is refused at capture, with the number and the reason

**Verdict:** VERIFIED
**Citation:** `own-run/reference-oversize` — a 307,200-byte file is refused, exit 1: "docs/big.md is 307200 bytes, over the 262144-byte limit on a reference snapshot. The limit is not about the injection budget — a file far smaller than this already spills — it is that the snapshot is re-read and re-parsed by every command that rebuilds the index…"; `src/core/reference.ts:46` (`SNAPSHOT_MAX_BYTES = 256 * 1024`).

### B-067 · README:1148
> every capture prints the size in lines, bytes and estimated tokens, and every refresh prints the before-and-after in lines and estimated tokens

**Verdict:** VERIFIED
**Citation:** `own-run/add-reference` ("10 line(s), 260 bytes, ~65 estimated tokens"), `config/add-reference` ("1 line(s), 24 bytes, ~6 estimated tokens"), `cli-mutate/refresh-drifted-no-yes` ("size 3 -> 3 line(s), ~14 -> ~13 estimated tokens").
**Note:** The bytes figure is the *stored* (quoted) size, not the file's. For `docs/roadmap.md` the file is 244 bytes and the printed figure is 260 — deliberate, per `src/core/reference.ts:158-163` and `:267`.

### B-068 · README:1153
> On the rationale tier scope does not decide injection — nothing in that tier is injected — but it is read on every item by the path query

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:473` (nothing rationale is injected) and `src/core/select.ts:167-172` — `matchesScope` is documented and exported precisely so the JIT tier and `query_items`'s `path` filter ask the same function, on every item regardless of tier.

### B-069 · README:1162
> `scopePolicy` applies to `reference` exactly as it applies to any other category, and it is **not** tier-dependent: a project that sets `categories.reference.scopePolicy` to `"required"` has every reference refused at capture until it names a glob

**Verdict:** VERIFIED
**Citation:** `own-run/reference-scopepolicy-required` — with `categories.reference.scopePolicy = "required"`, `add reference "R1" --file docs/r.md` is refused (exit 1) with "every reference must declare at least one scope glob", while the same command with `--scope "src/**"` succeeds (exit 0). `reference` is on the rationale tier in both runs, as the capture line states.

### B-070 · README:1166
> `"inert"` makes an unscoped reference match no path

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:192-193` — `matchesScope` returns `scopePolicyFor(config, item.type) !== 'inert'` for an empty scope, i.e. false under `inert`, for every category.

### B-071 · README:1168
> `always: true` … is **refused** on a rationale `reference`, not stored and ignored … `mycontext pin` on a reference says so and names the two routes.

**Verdict:** VERIFIED
**Citation:** `cli-mutate/pin-on-rationale-reference` — exit 1, "Nothing was changed. Two things work instead: retier the category, by setting categories.reference.tier to \"normative\" … or capture this as an item in a normative category". `mcp/create_item-always-on-rationale` shows the same refusal on the tool surface.

### B-072 · README:1178
> Every item is one file under `.my_context/items/<type>/<id>.md`, in your repository, in plain Markdown.

**Verdict:** VERIFIED
**Citation:** `cli-capture/add-normative-with-yes` ("at items/constraint/CONST-uploads-capped-at-10-mb.md"); `own-run/add-reference` ("at items/reference/REF-billing-roadmap.md") and the on-disk file at `.my_context/items/reference/REF-billing-roadmap.md`.

### B-073 · README:1183-1209
> (the full `show CONST-postgres-pool-capped-at-20` output)

**Verdict:** VERIFIED
**Citation:** `own-run/show-const-fixture` — reproduces README:1184-1209 exactly, including `valid_from: 2026-08-14`, `checksum: a81dff73a154242e`, `origin: agent`, `always: true` and the two tags.

### B-074 · README:1220
> `status` | `draft`, `active`, `superseded`, `deprecated` or `validated`. **Only `active` is ever injected**

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:123-127` — `isEligible` returns false unless `item.status === 'active'`, and every tier draws from `eligible`. `src/core/select.ts:308` names `superseded`/`deprecated`/`validated` as the retired set; `draft` is the review queue (`select.ts:344-346`).

### B-075 · README:1221
> `severity` | `hard` or `soft`. It does not change whether an item is injected, only the order: hard items are admitted to a budget first

**Verdict:** CONTRADICTED
**Citation:** `cli-retrieve/focus-hard-item-never-hidden` — with a focus active, `CONST-never-commit-a-secret` is reported as "1 severity:hard item(s) do not match this focus and are injected anyway — focus never hides one", while soft items that equally fail the focus are hidden. Mechanism: `src/core/select.ts:244` — `focusHides` returns false for `item.severity === 'hard'` before any match is attempted.
**Note:** Expected: severity affects only ordering. Actual: severity also decides *whether* an item is injected when a focus is active. The ordering half of the claim is correct (`src/core/select.ts:260`, `:270` — `SEVERITY_RANK { hard: 0, soft: 1 }` sorted first in `fitToBudget`).

### B-076 · README:1222
> `always` | `true` pins the item — injected in full at every session start, whatever files you touch

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:487-488` — on `session-start`/`compact`/`manual` the pinned tier is `fresh.filter(i => i.always)` with no path consulted; `own-run/session-start-fixture` shows `CONST-postgres-pool-capped-at-20` (`always: true`) injected in full with no file event.
**Note:** Subject to `budgets.pinned` — an over-budget pinned item spills and is disclosed (`select.ts:281-292`) — and to the per-session `seen` filter (`select.ts:478-479`).

### B-077 · README:1223
> `scope` | … Empty means unrestricted: it applies to every file — unless the category's `scopePolicy` says otherwise

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:192-194` — empty scope returns true for every path unless the category's policy is `inert`.

### B-078 · README:1224
> `tags` | free-form labels for finding it later. They affect nothing about injection

**Verdict:** CONTRADICTED
**Citation:** `cli-retrieve/focus-preview` — a tag focus (`focus db`) removes five items from injection; `src/core/select.ts:228` is the tag test inside `matchesFocus`, reached from `select.ts:470-472` which narrows the eligible set feeding every tier.
**Note:** Same defect as B-006, restated in the field table. Correct only when no focus is set.

### B-079 · README:1225
> `origin` | who wrote it: `human`, `agent` … or `ingest` … and no tool lets a caller set it

**Verdict:** VERIFIED
**Citation:** `mcp/create_item-origin-refused` — `origin` is refused as an unknown argument with an explicit explanation; `own-run/review-list-fixture` shows all three values in use (`ingest` for extracted items, `agent` for the tool-authored draft, `human` elsewhere).

### B-080 · README:1226
> `source_file`, `source_anchor`, `source_checksum` | … the path, the heading within it, and a hash of that text so drift is detectable

**Verdict:** VERIFIED
**Citation:** `own-run/show-reference` (`source_file: docs/roadmap.md`, `source_checksum: b4870a16d4017508`, `source_anchor: null`); `cli-mutate/refresh-drifted-readback` shows the checksum being used to detect drift.

### B-081 · README:1227
> `valid_until` is filled in when an item is retired … and cleared again if it is brought back … It is a **record, not a control**: nothing selects on it, and no item stops being injected because of a date

**Verdict:** VERIFIED
**Citation:** `src/core/persist.ts:251-253` — `validUntil` is set to `today()` on retirement and reset to `null` otherwise; a repository-wide grep for `validUntil` finds it only in `content-hash.ts`, `item.ts`, `mutate.ts`, `persist.ts`, `relations.ts`, `types.ts` and `help/index.ts` — never in `select.ts` or `store.ts`, the two places selection is decided.

### B-082 · README:1228
> `checksum` | a hash of the item's own content, re-stamped on every write. It is how `mycontext doctor` notices a file that was edited by hand

**Verdict:** VERIFIED
**Citation:** `own-run/hand-edit-doctor` — editing `.my_context/items/reference/REF-billing-roadmap.md` by hand makes `mycontext doctor` report `checksum mismatch for "REF-billing-roadmap": recorded 4f599b3a1340122c, content hashes to fe843572fb134336`; `cli-mutate/review-promote-flags` shows the same check on a different item.

### B-083 · README:1230
> `mycontext examples <category>` prints a correct specimen of any type, extra fields included.

**Verdict:** VERIFIED
**Citation:** `cli-capture/examples-rule` — prints a complete `rule` specimen carrying the category-specific `directive: dont` field; `cli-capture/examples-unknown` exits 1 for a name no category has.

### B-084 · README:1239
> There *is* a database — `.my_context/.index.db`, SQLite — but it is derived, never authored. … Delete it and `mycontext rebuild` recreates it from the Markdown.

**Verdict:** VERIFIED
**Citation:** `own-run/rebuild-after-delete` — removing `.my_context/.index.db*` and running `mycontext rebuild` prints "indexed 1 item(s)" and recreates the file; `cli-capture/rebuild-bare` exits 0.

### B-085 · README:1243
> the hooks never *require* the index. They open it read-only when it is readable, and when it cannot be read at all they serve the injection straight from the Markdown files and say so inline — `my_context: served from Markdown; the index was unavailable.`

**Verdict:** VERIFIED
**Citation:** `src/core/markdown-fallback.ts:13-14` — `FALLBACK_NOTE` is exactly that string; `src/hooks/pre-tool-use.ts:176-179` opens with `Store.openReadOnlyChecked` and falls back to `loadCorpusItems` in the catch; `src/hooks/pre-tool-use.ts:236` emits the note.
**Note:** Only the PreToolUse hook has an index path to fall back from. SessionStart never uses the index for injection at all — `src/core/inject.ts:44-48` and `:100-108` parse the corpus from Markdown unconditionally — so it never emits this note. The guarantee ("never require the index") holds for both.

### B-086 · README:1246
> layers are merged project-over-global before any filter, the same order the index is built in — so the two paths choose the same items

**Verdict:** VERIFIED
**Citation:** `src/core/markdown-fallback.ts` (`activeInjectableFromItems`) — `mergeLayers(items).filter(...)`, with the module comment recording that filtering before the merge was executed and shown to diverge (3/3 shadow cases) and that global is loaded before project to match `rebuild`'s `LAYER_ORDER`.

### B-087 · README:1250
> the fallback was measured at 9,903 ms for 10,000 items on a cold file cache against Claude Code's 10-second hook kill

**Verdict:** UNVERIFIED
**Citation:** —
**Note:** The figure matches the codebase's own recorded measurement (`src/core/markdown-fallback.ts:21-22`, `src/doctor/checks.ts:723`, `:739-742`), but no captured run or run of mine re-measures it, so the number is corroborated only by the text making the claim.

### B-088 · README:1252
> `mycontext doctor` warns from 5,000 items

**Verdict:** VERIFIED
**Citation:** `src/doctor/checks.ts:725` — `export const FALLBACK_CEILING_WARN_ITEMS = 5000;`, with the warning text at `:739-742`.

### B-089 · README:1255
> do not hand-edit an item file. Every write path recomputes the item's `checksum` field, and a hand edit does not … `mycontext doctor` reports that mismatch from then on.

**Verdict:** VERIFIED
**Citation:** `own-run/hand-edit-doctor` — after a hand edit, `doctor` reports "1 error(s)" with the checksum mismatch and continues to do so; every CLI-written item in the same workspace passes.

### B-090 · README:1261
> When a session starts, Claude Code runs my_context's *hooks* … The session-start hook selects the items that apply and hands them to Claude as context.

**Verdict:** VERIFIED
**Citation:** `hooks/session-start-startup` — the SessionStart hook returns the injection block; `own-run/session-start-fixture` reproduces it on the doc fixture.

### B-091 · README:1265-1285
> (the injected block: `## my_context — these govern this project`, the pinned item in full, `## my_context index` lines, the counts line, the browse hint, and the pending-revision line)

**Verdict:** VERIFIED
**Citation:** `own-run/session-start-fixture` — running the SessionStart hook against the freshly materialized doc fixture emits README:1266-1284 verbatim, including `2 decision · 1 lesson · 1 drafts pending review · 1 retired`, `→ use mycontext list or mycontext show <id> to browse these`, and the full `REV-76627cb9f4c6 → RULE-never-log-customer-email` sentence.

### B-092 · README:1287
> One item arrived in full, because it is pinned. Four arrived as a single line each … The rationale items arrived as a count.

**Verdict:** VERIFIED
**Citation:** `own-run/session-start-fixture` — one full block (`CONST-postgres-pool-capped-at-20`, `always: true`), four index lines, and `2 decision · 1 lesson` as counts. Line format `### <id> · <type> · <title>` / `- <id> · <type> · <title>` at `src/core/render-item.ts:173`, `:193`.

### B-093 · README:1295
> A workspace with an empty revision queue gets no such line.

**Verdict:** VERIFIED
**Citation:** `hooks/session-start-startup` — the harness workspace's injection ends at the browse hint with no pending-revision sentence, while `own-run/session-start-fixture` (a workspace with one staged revision) carries it.

### B-094 · README:1298
> A second hook runs before Claude reads or edits a file

**Verdict:** VERIFIED
**Citation:** `hooks/pre-tool-use-scoped-hit` (a scope match delivers the item) and `hooks/pre-tool-use-scoped-miss`; `hooks/pre-tool-use-edit-tool`, `hooks/pre-tool-use-write-tool` and `hooks/pre-tool-use-notebook-edit` confirm the hook fires on edit tools as well as reads.
