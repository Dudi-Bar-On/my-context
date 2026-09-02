# Section C — README lines 1301–1702

**84 claims: 81 VERIFIED · 2 CONTRADICTED · 1 UNVERIFIED.**

Citation keys: `<surface>/<caseId>` = captured harness record; `LIVE-PASS.md#<section>` =
live-session observation; `file.ts:line` = plugin source; `own-run:<label>` = a hook or CLI
binary this audit executed against a materialized copy of `test/fixtures/docs-workspace` in
`$TEMP`, with `HOME`/`USERPROFILE` pointed at a scratch home. Nothing under `my-context/`
was modified.

The `own-run` labels used below:

- `own-run:jit-billing` — `pre-tool-use.ts`, fresh session, `src/billing/prices.js`
- `own-run:jit-catalogue` — `pre-tool-use.ts`, fresh session, `src/catalogue/search.js`
- `own-run:jit-repeat` — the same file, twice, in one session
- `own-run:session-start` — `session-start.ts`, `source: startup`
- `own-run:compact` — `pre-compact.ts` then `session-start.ts` with `source: compact`
- `own-run:budget-*` — the same, with a patched `budgets` block in the scratch workspace
- `own-run:global-*` — a real `~/.my-context` built by the README's own recipe in the scratch home
- `own-run:inert-policy` — two JIT runs on one index, differing only in `categories.<name>.scopePolicy`

---

### C-001 · README:1303
> There are four **injection tiers** — four routes by which an item's text can reach a session.

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:43` (`SelectionEntry.tier` = `'pinned' | 'jit' | 'restored'`) plus the index tier at `select.ts:52-70` / `Spill.tier` `'index'` (`select.ts:48`)

---

### C-002 · README:1304-1305
> the first, from section 2, is the normative/rationale split a category carries

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:129-131` — `isNormative` reads `config.categories[type].tier`, whose values are `normative`/`rationale`

---

### C-003 · README:1307-1308
> "Just in time" is often abbreviated **JIT**, including in the configuration file, where the budget for that tier is spelled `jit`.

**Verdict:** VERIFIED
**Citation:** `config/budgets-unknown-key-refused` — "Budgets accepts: pinned, jit, restored, index"; `src/core/config.ts:5-10`

---

### C-004 · README:1312
> **pinned** | every session start, and again after a compaction

**Verdict:** VERIFIED
**Citation:** `hooks/session-start-startup`, `hooks/session-start-clear`, `hooks/session-start-resume`, `hooks/session-start-compact` — all four inject `CONST-never-commit-a-secret` in full; `src/core/select.ts:487-492` admits the pinned tier for `session-start`, `compact` and `manual`; matcher `startup|clear|resume|compact` at `hooks/hooks.json:5`
**Note:** SessionStart is not yet live-verified inside Claude Code (`LIVE-PASS.md#SessionStart — deferred, not failed`); this is harness- and source-verified.

---

### C-005 · README:1312
> every active normative item marked `always: true`, in full

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:462` (`isEligible` → `status === 'active'`), `:473` (`isNormative` filter precedes every tier), `:488` (`fresh.filter((i) => i.always)`); `own-run:session-start` delivered `CONST-postgres-pool-capped-at-20` (the fixture's only `always: true` item) as a complete block

---

### C-006 · README:1313
> **just in time** | Claude is about to read or edit a file the item applies to — one matching its `scope`, or any file at all if it declares no scope

**Verdict:** VERIFIED
**Citation:** `hooks/pre-tool-use-scoped-hit` (scoped item matched), `hooks/pre-tool-use-scoped-miss` (scoped item withheld, unscoped items still delivered); matcher `Read|Edit|MultiEdit|Write|NotebookEdit` at `hooks/hooks.json:18`; `src/core/select.ts:191-194`

---

### C-007 · README:1313
> Contains … that item, in full

**Verdict:** VERIFIED
**Citation:** `own-run:jit-billing` — each of the four delivered items arrived as its complete rendered block (title line, body, scope annotation), byte-identical to README:1391-1420

---

### C-008 · README:1314
> **restored** | after a compaction | the items that were in context before it

**Verdict:** VERIFIED
**Citation:** `own-run:compact` — the four items JIT-injected earlier in session `sA` were re-injected in full at `SessionStart(source=compact)`; `src/core/select.ts:494-505`; `src/hooks/pre-compact.ts:63-65`

---

### C-009 · README:1315
> **index** | every session start, and after a compaction | one line per remaining normative item, plus counts for the rest

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:533-540` — the index is built for every event except `tool`; `own-run:session-start` and `own-run:compact` both emitted a `## my_context index` block with per-item lines plus `2 decision · 1 lesson · 1 drafts pending review · 1 retired`

---

### C-010 · README:1321
> **index** … one line: id · type · title

**Verdict:** VERIFIED
**Citation:** `src/core/render-item.ts:192-194` — `` `- ${id} · ${type} · ${title}` ``; `hooks/session-start-startup` stdout

---

### C-011 · README:1323
> **just in time** … injected in full, once per context window

**Verdict:** VERIFIED
**Citation:** `own-run:jit-repeat` — the second read of `src/billing/prices.js` in the same session emitted nothing; `LIVE-PASS.md#PreToolUse — injection arm, verified` ("Per-session dedupe verified")
**Note:** `hooks/session-start-dedupe-same-session` does *not* support this claim — that case runs in a fresh workspace (`setup: CORPUS` in `harness/cases/hooks.mjs:31`), so its seen file was empty and its stdout is identical to `session-start-startup`. It never reached the dedupe path.

---

### C-012 · README:1325
> "yes, no match" → nothing — the item stays out of the way

**Verdict:** VERIFIED
**Citation:** `hooks/pre-tool-use-scoped-miss` — the `src/db/**` item is absent from an injection on `src/api/handler.ts`; `own-run:jit-catalogue` — `INV-prices-are-integer-cents` (`src/billing/**`) absent on `src/catalogue/search.js`

---

### C-013 · README:1333-1334
> An item with `always: true` in its frontmatter is injected in full at every session start, whatever you are working on, whatever files you touch.

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:487-492` — the pinned tier consults no path at all; `own-run:session-start` (no file touched, item delivered in full)

---

### C-014 · README:1335
> In the example above, that is `CONST-postgres-pool-capped-at-20`

**Verdict:** VERIFIED
**Citation:** `test/fixtures/docs-workspace/.my_context/items/constraint/CONST-postgres-pool-capped-at-20.md` — `always: true`, `scope: []`, `severity: hard`; it is the fixture's only `always: true` item

---

### C-015 · README:1338-1339
> The pinned tier has its own budget, and everything you pin competes for it against everything else you pinned.

**Verdict:** VERIFIED
**Citation:** `config/budgets-spill-pinned` — two pinned items against a 40-token `pinned` budget; both spilled and were named; `src/core/select.ts:488` passes `config.budgets.pinned` to `fitToBudget`

---

### C-016 · README:1341-1343
> An item is set to `always: true` by promoting it with `mycontext review promote <id> --always` while it is still a draft

**Verdict:** VERIFIED
**Citation:** `cli-mutate/review-promote-flags` (preview prints `always yes (from --always) — pinned: injected in full at every session start`) and `cli-mutate/review-promote-flags-readback` (`always: true` on disk)

---

### C-017 · README:1342-1344
> or by `mycontext pin <id>` once it governs — the second asks you to confirm, and shows what changes about the item's injection before it does

**Verdict:** VERIFIED
**Citation:** `cli-mutate/pin` — prints `about to edit: … today  no scope — unrestricted, so nothing narrows it and it is injected on the first file touched in a session / changing: always no -> yes / after …`; `cli-mutate/pin-no-yes-declines` exits 1 without `--yes`; `LIVE-PASS.md#Verified-correct, live` row L21

---

### C-018 · README:1344
> `mycontext unpin <id>` takes it back out.

**Verdict:** VERIFIED
**Citation:** `cli-mutate/unpin-from-pinned` (preview shows `always yes -> no`) and `cli-mutate/unpin-from-pinned-readback` (`always: false` on disk)

---

### C-019 · README:1348-1350
> `scope` is a list of file patterns, and it is a **restriction** … When Claude is about to read or edit a file, my_context looks for active normative items that apply to that path and injects them, in full, before the tool runs.

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:191-194` (`matchesScope`), `:473` (`isNormative`), `:508-515` (tool tier); `LIVE-PASS.md#PreToolUse — injection arm, verified`

---

### C-020 · README:1351-1353
> An item that declares none is not restricted at all, so it applies everywhere

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:192` — an empty scope matches unless the category's `scopePolicy` is `inert`; `hooks/pre-tool-use-scoped-miss` (unscoped items arrive on a path no glob names)
**Note:** True under the default `scopePolicy`, which is what this passage is describing. The same statement restated as a guarantee at README:1434 is scored separately — see C-026.

---

### C-021 · README:1355
> `INV-prices-are-integer-cents` carries `scope: src/billing/**`

**Verdict:** VERIFIED
**Citation:** `test/fixtures/docs-workspace/.my_context/items/invariant/INV-prices-are-integer-cents.md` — `scope:\n  - src/billing/**`; the block at README:1358-1385 is generated (`<!-- example: show INV-prices-are-integer-cents -->`)

---

### C-022 · README:1388-1421
> So the moment Claude opens `src/billing/prices.js`, this is what it receives first: [30-line block]

**Verdict:** VERIFIED
**Citation:** `own-run:jit-billing` — the hook's `additionalContext` is **byte-identical** to README lines 1391-1420 (compared programmatically after JSON decode; result `IDENTICAL`)
**Note:** This block carries no generator marker, so it is hand-maintained; it is nonetheless exactly correct today.

---

### C-023 · README:1423-1425
> Four items applied. Two of them named this file … The other two declare no scope at all — the pool constraint and the checkout requirement

**Verdict:** VERIFIED
**Citation:** `own-run:jit-billing` — four blocks; `INV-prices-are-integer-cents` (`_scope: src/billing/**_`) and `RULE-never-log-customer-email` (`_scope: src/**_`) carry scope annotations, `CONST-postgres-pool-capped-at-20` and `REQ-checkout-completes-in-two-steps` carry none (`scope: []` in the fixture)

---

### C-024 · README:1426-1427
> Notice that the pool constraint arrives even though it is also pinned: it is delivered by whichever tier reaches it first in a session, and only once.

**Verdict:** VERIFIED
**Citation:** `own-run` sequence in session `sPQ`: `session-start.ts` delivered `CONST-postgres-pool-capped-at-20` at the pinned tier; the immediately following `pre-tool-use.ts` on `src/billing/prices.js` delivered the other three items and **not** the pool constraint. `src/core/inject.ts:359-366` (pinned delivery appended to the seen file) and `src/hooks/pre-tool-use.ts:182,203` (JIT reads it back as `seen`).
**Note:** The pinned tier itself does not consult the seen file (`inject.ts:170-178` passes no `seen`), so two SessionStart firings under one session id re-inject — confirmed by execution. That is consistent with the README, which states at 1312 that pinned fires again after a compaction; the guarantee is per context window, not per session id.

---

### C-025 · README:1429-1430
> Open `src/catalogue/search.js` instead and the billing invariant drops out … The other three still arrive.

**Verdict:** VERIFIED
**Citation:** `own-run:jit-catalogue` — exactly three blocks: `CONST-postgres-pool-capped-at-20`, `REQ-checkout-completes-in-two-steps`, `RULE-never-log-customer-email`

---

### C-026 · README:1434-1436
> **No scope means no restriction.** An item with no scope patterns applies to every file, so this tier delivers it on the first file Claude touches.

**Verdict:** CONTRADICTED
**Citation:** `own-run:inert-policy` — a controlled pair of JIT runs on `src/catalogue/search.js` against one unchanged index, differing only in `config.json`. With the default policy the unscoped `REQ-checkout-completes-in-two-steps` was delivered; with `categories.requirement.scopePolicy: "inert"` the same item was **not** delivered, while the other four items were unchanged. Source: `src/core/select.ts:191-193` — `if (item.scope.length === 0) return scopePolicyFor(config, item.type) !== 'inert';` — and the rendering constant `SCOPE_INERT = '(inert)'` at `src/core/render-item.ts:34-53`, which exists precisely because "`(unrestricted)` becomes a lie there".
**Note:** Expected: an unscoped item applies to every file. Actual: under a supported per-category setting it applies to **no** file and survives as an index line only. The condition is carried elsewhere in the same document — README:1223 ("Empty means unrestricted: it applies to every file — unless the category's `scopePolicy` says otherwise") and README:3864 — but not in this bolded guarantee, which is the one a reader of section 4 meets first. The nearby unbolded restatement at README:1351-1353 (C-020) has the same gap.

---

### C-027 · README:1438-1441
> an unscoped item competes for the `jit` budget on every file operation, so a corpus with many large unscoped items will spill — visibly

**Verdict:** VERIFIED
**Citation:** `own-run:budget-jit120` — with `jit: 120`, `src/billing/prices.js` delivered one item and emitted `_3 item(s) omitted from full text for budget: INV-prices-are-integer-cents, REQ-checkout-completes-in-two-steps, RULE-never-log-customer-email. Fetch with mycontext show <id>._`; `src/core/select.ts:509-515`

---

### C-028 · README:1442-1443
> **Each item arrives once per context window.** my_context records what it has already injected, so editing ten billing files does not deliver the same invariant ten times.

**Verdict:** VERIFIED
**Citation:** `own-run:jit-repeat` (second read of the same file in one session emits nothing); `LIVE-PASS.md#PreToolUse — injection arm, verified`

---

### C-029 · README:1444-1446
> A subagent shares the session's id but starts with an empty window of its own, so the record is kept per subagent: the parent having seen an item does not starve a subagent of it, and each subagent receives it at most once.

**Verdict:** VERIFIED
**Citation:** `src/hooks/io.ts:46-49` (`ledgerKey` appends `::agent_id`). Executed: in session `sPQ`, after the parent had already received `CONST-postgres-pool-capped-at-20`, a payload with `agent_id: A1` received it again in full; and in session `sSub`, subagent `A9`'s second read of the same path emitted nothing while the parent's first read still injected. Two seen files exist on disk: `sSub-….seen.jsonl` and `sSub__A9-….seen.jsonl`.

---

### C-030 · README:1448
> The record behind this is a per-session seen file — `.my_context/state/<session>.seen.jsonl`

**Verdict:** VERIFIED
**Citation:** `src/core/seen-file.ts:39-41` — `path.join(root, 'state', `${sanitizeSessionId(key)}.seen.jsonl`)`; files of that shape were created by every `own-run`
**Note:** `sanitizeSessionId` (`ledger.ts:353-358`) returns a lowercase/`-`/`_`/`.` id verbatim — which a real Claude Code session id is — and only appends a 12-hex digest to ids that need escaping.

---

### C-031 · README:1448-1449
> machine-local generated state, pruned on the same 30-day retention as restore snapshots

**Verdict:** VERIFIED
**Citation:** `src/core/ledger.ts:434` (`SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000`) and `:437-441` — `pruneSnapshots` deletes both `*.restore.json` and `*.seen.jsonl` on that window; `writeSnapshot` writes `state/.gitignore` containing `*` (`ledger.ts:407`)

---

### C-032 · README:1450
> not the SQLite index

**Verdict:** VERIFIED
**Citation:** `src/core/seen-file.ts:6-22` (module header: "Session dedupe state, off the database"); `src/hooks/pre-tool-use.ts:153-164` — the JIT hook's only SQLite touch is a read-only open

---

### C-033 · README:1450-1452
> When that file cannot be read, my_context re-injects rather than suppresses, and the delivery's audit record says so

**Verdict:** VERIFIED
**Citation:** `src/hooks/pre-tool-use.ts:203-204` (`seen: seenState.error === null ? seenIds(seenState) : []`) and `:262-264` (audit note `seen file unreadable; injected without dedupe`); `src/core/seen-file.ts:103-121`

---

### C-034 · README:1453-1454
> **This tier carries no index.** A file-triggered injection contains the items that applied and nothing else.

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:533-538` — a `tool` event returns `emptyIndex()`; no JIT record in the corpus contains a `## my_context index` block (`hooks/pre-tool-use-scoped-hit`, `own-run:jit-billing`)

---

### C-035 · README:1463-1466
> my_context takes a snapshot immediately before that happens, recording which items were in play — both the ones it injected and any that were referenced by id in the transcript. When the session resumes after compaction, those items are re-injected, alongside the pinned tier and the index.

**Verdict:** VERIFIED
**Citation:** `src/hooks/pre-compact.ts:36-65` (union of seen file and `scanTranscriptIds`). Executed: `own-run:compact` wrote a snapshot containing the four seen ids plus `DEC-use-stripe-for-payments` and `STD-api-errors-use-problem-json`, which appeared only in the transcript; the following `SessionStart(compact)` re-injected the pinned item, the restored items and the index in one block.

---

### C-036 · README:1468-1471
> The session's seen file is keyed on the session id that the hooks receive, and `/mycontext:LoadMyContext` has no trustworthy session id to record against — so a manual load is never in the seen file.

**Verdict:** VERIFIED
**Citation:** `src/core/inject.ts:133` — `const sessionId = manual ? undefined : options.sessionId;` — and `:359`, where `appendSeen` is gated on `sessionId`; reasoning recorded at `inject.ts:100-113`

---

### C-037 · README:1471-1474
> But the snapshot also scans the transcript for item ids, and a manual load puts its ids there by delivering them.

**Verdict:** VERIFIED
**Citation:** `src/hooks/pre-compact.ts:64` (`scanTranscriptIds`); `src/core/ledger.ts:549-575`. Executed in `own-run:compact`: two ids present only in the transcript were captured into the snapshot.

---

### C-038 · README:1476-1478
> The snapshot path performs no SQLite writes and no blocking SQLite reads: it reads the session's seen file and the transcript, and consults the index only through a best-effort read-only open it can proceed without.

**Verdict:** VERIFIED
**Citation:** `src/hooks/pre-compact.ts:49-61` — `Store.openReadOnly` inside a try/catch whose failure sets `knownSkipReason` and continues; no write path in the function

---

### C-039 · README:1478-1481
> The snapshot write itself is retried against transient Windows sharing violations, and when it lands it is atomic against concurrent readers — but it is not durable across a power loss

**Verdict:** VERIFIED
**Citation:** `src/core/ledger.ts:383` (`SNAPSHOT_RENAME_ATTEMPTS = 15`), `:385-402` (the two properties stated separately: "Atomic against concurrent readers and crashes mid-write" / "NOT power-loss durable"), `:412-421` (temp file then retried `renameSync`)

---

### C-040 · README:1481-1482
> A write that still fails after its retries is recorded in the audit log with the failure named in its note, and compaction is never blocked.

**Verdict:** VERIFIED
**Citation:** `src/hooks/pre-compact.ts:81-104` — `recordAudit` with `note: 'SNAPSHOT WRITE FAILED (…)'` plus a stderr line, then `return null`; `:150` sets `process.exitCode = 0` unconditionally. `hooks/pre-compact-basic` exits 0 with clean stdout on the success path.
**Note:** The failure branch itself is not exercised by any captured record; source-verified only.

---

### C-041 · README:1485-1486
> Rationale items — decisions, ADRs, lessons — are never restored in full … they stay counted in the index.

**Verdict:** VERIFIED
**Citation:** `own-run:compact` — `DEC-use-stripe-for-payments` was captured into the snapshot (it is in `itemIds`) yet was **not** re-injected in full; it remained inside the index's `2 decision` count. `src/core/select.ts:473` filters `isNormative` before any tier runs.

---

### C-042 · README:1487-1488
> The scan reads the last 8MB of the transcript, so an id whose only mention is older than that is missed.

**Verdict:** VERIFIED
**Citation:** `src/core/ledger.ts:522` — `const MAX_TRANSCRIPT_BYTES = 8 * 1024 * 1024;` — and `readTail` at `:531-541`, which seeks to `size - MAX_TRANSCRIPT_BYTES`

---

### C-043 · README:1488-1489
> And restoration is bounded by its own budget, like every other tier: what does not fit drops to an index line and is named in the omission note.

**Verdict:** VERIFIED
**Citation:** `own-run:budget-restored60` — with `restored: 60`, the compaction restore delivered nothing at that tier and emitted both `_3 item(s) omitted from full text for budget: INV-prices-are-integer-cents, RULE-never-log-customer-email, STD-api-errors-use-problem-json. Fetch with mycontext show <id>._` **and** an index line for each of the three; `src/core/select.ts:494-505`

---

### C-044 · README:1493-1494
> Whatever the tiers above did not deliver in full, the index lists. One line per remaining active normative item: id, type, title.

**Verdict:** VERIFIED
**Citation:** `own-run:session-start` — four index lines in `id · type · title` form for the four active normative items not delivered in full; `src/core/select.ts:357-359`; `src/core/render-item.ts:192-194`

---

### C-045 · README:1497-1499
> Rationale items are not listed individually. They are counted by type — `2 decision`, `1 lesson` — along with the number of drafts waiting for review and the number of retired items.

**Verdict:** VERIFIED
**Citation:** `own-run:session-start` — `2 decision · 1 lesson · 1 drafts pending review · 1 retired`, literally including the two counts the README quotes; `src/core/render.ts:20-24`; `src/core/select.ts:382-390`

---

### C-046 · README:1499-1500
> An item whose category has been disabled in configuration is counted too, labelled as such, so turning a category off never makes its items disappear without a trace.

**Verdict:** VERIFIED
**Citation:** `own-run:disabled-category` — with `categories: { requirement: { enabled: false } }`, the index read `2 decision · 1 lesson · 1 drafts pending review · 1 retired · 1 requirement (disabled/unknown category)`; `src/core/render.ts:27`; `src/core/select.ts:396-401`

---

### C-047 · README:1502-1503
> An item that was already delivered in full gets no index line.

**Verdict:** VERIFIED
**Citation:** `own-run:session-start` — `CONST-postgres-pool-capped-at-20` is delivered in full and absent from the index list, while `own-run:budget-pinned10` (same corpus, `pinned: 10`) shows it *in* the index once it spills; `src/core/select.ts:357-358` (`!chosenIds.has(i.id)`)

---

### C-048 · README:1513-1516
> A **`.my-context` directory in your home folder** — note the hyphen; a project's own directory is `.my_context`, with an underscore — is loaded as the **global layer** alongside the project's, by every command that reads the corpus and by every injection.

**Verdict:** VERIFIED
**Citation:** `src/core/workspace.ts:6-7` — `DIR_NAME = '.my_context'`, `GLOBAL_DIR = path.join(homedir(), '.my-context')`; `cli-capture/init-global-refused` names `C:\Users\UserC\.my-context`. Executed: with a scratch `~/.my-context`, `own-run:global-list` showed its items under `mycontext list --full` and `own-run:global-session-start` / `own-run:global-jit` injected them.

---

### C-049 · README:1517-1518
> `mycontext list --full` shows both corpora, and the `layer` field says which one each item came from.

**Verdict:** VERIFIED
**Citation:** `cli-capture/list-full` shows the `layer   project` field in exactly the README's field order; `own-run:global-list` returned twelve entries mixing `layer   global` and `layer   project` from one command

---

### C-050 · README:1537-1561
> [the three-entry `list --full` block: `layer global` / `layer project` / `layer global`, `scope (unrestricted)` / `src/**`]

**Verdict:** VERIFIED
**Citation:** `own-run:global-list` reproduced the exact rendering for all three ids named in the block — `CONST-never-commit-a-secret` (`layer global`, `scope (unrestricted)`), `RULE-never-log-customer-email` (`layer project`, `scope src/**`), `RULE-write-the-failing-test-first` (`layer global`, `scope (unrestricted)`) — after building the global layer with the README's own recipe; `src/core/render-item.ts:32` defines `(unrestricted)`
**Note:** This block is explicitly excluded from `test/docs/examples.test.ts` (README:1520-1535). It is nonetheless correct.

---

### C-051 · README:1563-1564
> Pin one and it is injected in full at the start of every session, in whatever project you are in.

**Verdict:** VERIFIED
**Citation:** `own-run:global-pinned` — a `always: true` global constraint (`CONST-never-commit-a-secret-globally`) was injected in full at `SessionStart` inside the unrelated fixture project, beside the project's own pinned item

---

### C-052 · README:1564-1567
> Leave it unpinned and it is injected when a file matches its scope — matched against the project you are working in … and listed in the index when nothing it applies to has been touched.

**Verdict:** VERIFIED
**Citation:** `own-run:global-jit` — the unscoped global `CONST-never-commit-a-secret` was JIT-delivered on `src/api/errors.js` in the project; `own-run:global-session-start` listed the same id as an index line when no file had been touched

---

### C-053 · README:1569-1571
> When a project item and a global item compete for the same budget space, the project's is admitted first.

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:261` (`LAYER_RANK = { project: 0, global: 1 }`) and `:269-275` (`byPriority`: severity, then layer, then id), consumed by `fitToBudget` at `:284`

---

### C-054 · README:1571-1573
> And when the two share an **id**, the project's copy is what governs and the global one is not indexed at all — shadowed, not merged. No part of the global item survives into this project's view of it.

**Verdict:** VERIFIED
**Citation:** `own-run:global-collision` — with both layers declaring `RULE-write-the-failing-test-first`, `mycontext show` returned the project copy's body (`PROJECT VERSION OF THE BODY`) and `mycontext rebuild` reported "the project copy wins and the global one is not indexed"; `src/core/select.ts:411-420` (`mergeLayers`)

---

### C-055 · README:1577-1583
> Every command that rebuilds the index reports the collision, naming the id and both layers — this is `mycontext rebuild`: [message]

**Verdict:** VERIFIED
**Citation:** `own-run:global-collision` reproduced the quoted sentence verbatim from `my_context: error  items/rule/RULE-write-the-failing-test-first.md: duplicate id "…" declared in both the global layer (…) and the project layer (…); the project copy wins and the global one is not indexed. Rename one of them.`; `src/core/rebuild.ts:515-517`; the same message also reached the injected block (`src/core/inject.ts:90-93`)
**Note:** The README's leading `my_context: indexed 4 item(s)` reflects its own scratch corpus; the run here printed `indexed 13 item(s)`. The count is corpus-dependent, not a claim.

---

### C-056 · README:1585-1586
> Both paths are relative to their own layer's root, so in a case like this one — the same category and the same id — they read identically.

**Verdict:** VERIFIED
**Citation:** `own-run:global-collision` — both parenthesised paths printed as `items/rule/RULE-write-the-failing-test-first.md`; `src/core/rebuild.ts:503-518` takes each file path from its own layer's map

---

### C-057 · README:1588-1594
> **Global items are read-only from a project.** … every write path refuses one. This is `mycontext edit` on a global item: [message]

**Verdict:** VERIFIED
**Citation:** `own-run:global-edit` — `mycontext edit RULE-write-the-failing-test-first --title "nope" --yes` printed the quoted two lines verbatim, wrapping at the same point; `src/core/persist.ts:209-214` (`globalLayerRefusal`), enforced at `persist.ts:192-194` for every `requireWritableItem` caller

---

### C-058 · README:1597-1598
> `pin`, `unpin`, `harden`, `soften`, `supersede` and `review promote` refuse in the same words.

**Verdict:** CONTRADICTED
**Citation:** `own-run:global-refusals`. Five of the six do: `pin` printed the `globalLayerRefusal` sentence verbatim (`src/cli/commands/edit.ts:549`, reached by `pin`/`unpin`/`harden`/`soften` as named entry points onto `edit`, `edit.ts:805-826`), and so did `supersede` (`src/cli/commands/supersede.ts:92`). **`review promote` does not.** Executed against a global-layer draft it printed:
> `my_context: RULE-global-draft-probe-item belongs to the global layer and cannot be promoted or discarded from this project — global items are read-only here. See mycontext_help("categories").`

Expected (the sentence README:1593-1594 quotes): `my_context: "<id>" belongs to the global layer and cannot be **modified** from this project — …`. Two differences: the id is unquoted, and "modified" is replaced by "promoted or discarded". Source: `src/cli/commands/review.ts:691-696`, a hand-written literal rather than a call to `globalLayerRefusal`.
**Note:** The divergence looks deliberate (the wording is more accurate for that command) and the second half of the sentence is identical. The defect is in the README's "in the same words", not in the CLI.

---

### C-059 · README:1598-1599
> `mycontext repair` re-stamps project items only, and names the global ones it did not touch rather than skipping them in silence.

**Verdict:** VERIFIED
**Citation:** `own-run:global-repair` — after tampering with a global item's body, `mycontext repair --yes` printed `my_context: nothing to re-stamp in this project.` followed by `my_context: 1 global-layer item(s) also disagree with their checksum and are NOT repaired from here … They are: CONST-never-commit-a-secret.`; `src/cli/commands/repair.ts:180-186`

---

### C-060 · README:1601-1602
> One thing the layer does **not** carry is its configuration. A `config.json` inside `~/.my-context` is not read — configuration comes from the project you are in.

**Verdict:** VERIFIED
**Citation:** `src/core/workspace.ts:27-48` — `resolveWorkspace` reads config only from `projectRoot/config.json`; `globalRoot` is returned but never used as a config source. Executed (`own-run:global-hostile-config`): a `~/.my-context/config.json` declaring `budgets: {pinned:1, jit:1, restored:1, index:1}` had no effect — the session start still delivered two pinned items in full and a four-line index.

---

### C-061 · README:1602-1605
> So a global item whose category that project has turned off is still listed by `mycontext list`, and still counted in the index as a disabled category, but is never selected for injection there.

**Verdict:** VERIFIED
**Citation:** `own-run:global-disabled` — with the project config setting `rule: { enabled: false }`, the global `RULE-write-the-failing-test-first` was still printed by `mycontext list --full`, was counted in the session index as `2 rule (disabled/unknown category)`, and was absent from a JIT injection on `src/api/errors.js` that delivered five other items; `src/core/select.ts:123-127`, `:396-401`

---

### C-062 · README:1609-1612
> **No command creates a global layer, and no command writes to one.** `mycontext init` creates `.my_context` in the directory you run it in, so `cd ~ && mycontext init` produces `~/.my_context` — the underscore spelling, which nothing reads.

**Verdict:** VERIFIED
**Citation:** `cli-capture/init-global-refused` — exit 1, and the refusal states "this command creates a PROJECT workspace in the directory it is run in, and there is no flag that changes that. The global layer is C:\Users\UserC\.my-context, and no command creates one or writes to one"; `src/core/workspace.ts:6-7`. Executed: `mycontext init` in a scratch directory printed `initialized …\.my_context`.

---

### C-063 · README:1617-1623
> [the `mkdir ~/global-context && cd … / mycontext init / mycontext add rule … / mycontext add constraint … / mv ~/global-context/.my_context ~/.my-context` recipe]

**Verdict:** VERIFIED
**Citation:** `own-run:global-build` — the five steps were executed literally (with a scratch `HOME`) and produced a working global layer: `mycontext add rule "Write the failing test first" --yes` created `RULE-write-the-failing-test-first`, `mycontext add constraint "Never commit a secret" --severity hard --yes` created `CONST-never-commit-a-secret`, and after the rename both were visible from an unrelated project as `layer global`

---

### C-064 · README:1626-1627
> Every item there is written by the same code that writes a project item — ids derived, checksums computed

**Verdict:** VERIFIED
**Citation:** `own-run:global-build` — ids were derived from the titles by `mycontext add` (`RULE-write-the-failing-test-first` from "Write the failing test first"); `own-run:global-repair` shows the checksum recorded in the moved file being validated by `mycontext doctor`/`repair` (`recorded b0884a661916c67a, content hashes to 4093d55d35103669` after tampering, i.e. the stored checksum was correct before it)

---

### C-065 · README:1630-1631
> that is also what `mycontext repair` means when it tells you to run it "from the global layer's own workspace"

**Verdict:** VERIFIED
**Citation:** `own-run:global-repair` — "Run \`mycontext repair\` from the global layer's own workspace."; `src/cli/commands/repair.ts:184-185`

---

### C-066 · README:1631-1633
> The workspace's own `config.json` and `.index.db` come along with it; neither is read from the global root, and neither does any harm.

**Verdict:** VERIFIED
**Citation:** `own-run:global-build` moved a `.my_context` containing both files into `~/.my-context`; `own-run:global-hostile-config` proved the global `config.json` is inert (C-060), and every injection above succeeded with the global `.index.db` present — the injection path parses Markdown and only ever opens `ws.dbPath` (the *project* index) at `src/core/inject.ts:238` and `src/hooks/pre-tool-use.ts:174`

---

### C-067 · README:1640-1645
> | `pinned` | 6000 | … | `jit` | 6000 | … | `restored` | 8000 | … | `index` | 1200 |

**Verdict:** VERIFIED
**Citation:** `src/core/config.ts:51` — `export const DEFAULT_BUDGETS: Budgets = { pinned: 6000, jit: 6000, restored: 8000, index: 1200 };`; `config/budgets-negative-refused` independently echoes `keeping the default (6000)` for `pinned`; `config/budgets-defaults` is recorded with the note "pinned 6000, jit 6000, restored 8000, index 1200"
**Note:** `config/budgets-defaults` runs `status --json`, whose output does **not** print the budgets; the record's note is the harness author's assertion, not the run's. The source line is the load-bearing citation.

---

### C-068 · README:1647-1649
> The unit is estimated tokens … it is the character count divided by four. my_context ships with no runtime dependencies and therefore no tokenizer, so this is an approximation that can err in either direction, not a guaranteed ceiling.

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:106-108` — `Math.ceil(text.length / 4)`, documented at `:97-105` as "chars/4 approximation with symmetric error in either direction — not a guaranteed bound"; `my-context/package.json` declares `dependencies: {}` (2 devDependencies)

---

### C-069 · README:1649-1651
> In round terms, 6,000 of these units is about 24,000 characters — roughly 3,700 English words, or a 370-line document.

**Verdict:** VERIFIED
**Citation:** 6000 × 4 = 24,000, from `src/core/select.ts:107`; the sentence is `src/core/config.ts:15-16` verbatim
**Note:** The word and line figures are rules of thumb with no operative definition in the code; only the character figure is checkable, and it is right.

---

### C-070 · README:1653-1655
> a session start pays `pinned` plus `index`, up to about 7,200 estimated tokens, before you have typed anything

**Verdict:** VERIFIED
**Citation:** 6000 + 1200 = 7200 against `src/core/config.ts:51`; `src/core/select.ts:487-492` and `:539-547` are the only two tiers a `session-start` event can charge (`tokens: tokens + indexUsed`); matches `config.ts:43-44`

---

### C-071 · README:1655-1657
> each distinct file-triggered injection pays up to `jit` on top — once per item per context window (each subagent is its own), since the per-session dedupe record never delivers the same item twice to the same window

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:508-515`; dedupe demonstrated at C-028/C-029 (`own-run:jit-repeat`, `own-run` subagent sequence); `LIVE-PASS.md#PreToolUse — injection arm, verified`

---

### C-072 · README:1658
> Against a 200,000-token context window that opening cost is around 3.6%.

**Verdict:** VERIFIED
**Citation:** 7200 / 200000 = 3.6%; the same figure at `src/core/config.ts:46`
**Note:** Live measurement on the campaign's own corpus put the always-on cost at ~1,643 tokens (`LIVE-PASS.md#Smaller observations`), i.e. well under the ceiling — consistent, since 7,200 is a bound and not an expectation.

---

### C-073 · README:1660-1661
> They were four to twelve times smaller

**Verdict:** VERIFIED
**Citation:** `src/core/config.ts:18` — the previous defaults were `{ pinned: 1500, jit: 500, restored: 2000, index: 150 }`. Ratios against `config.ts:51`: pinned ×4, jit ×12, restored ×4, index ×8 — the range is exactly 4 to 12.

---

### C-074 · README:1661-1664
> Measured on this repository's own corpus at the old defaults, `jit: 500` delivered 3 of the 9 items scoped to `README.md` and 3 of the 14 scoped to `src/cli/**`, and `index: 150` named 6 of the 19 items that govern the project.

**Verdict:** UNVERIFIED
**Citation:** —
**Note:** The figures agree exactly with `src/core/config.ts:22-29`, but that is the same author restating them, not independent confirmation. The measurement is historical (a 42-item corpus at superseded defaults) and no captured record reproduces it; the corpus it was taken against no longer exists in that state.

---

### C-075 · README:1664-1665
> The rest arrived as a name in an omission note or as "+13 more"

**Verdict:** VERIFIED
**Citation:** The two disclosure mechanisms exist and produce exactly those forms — `config/budgets-spill-pinned` (omission note naming ids) and `config/budgets-index-overflow` (`- … +1 more (fetch with mycontext show <id>)`). The specific "+13" follows from 19 − 6 at `src/core/config.ts:28-29`.

---

### C-076 · README:1667-1670
> `mycontext decay` reports which items have not been injected in the window it covers

**Verdict:** VERIFIED
**Citation:** `cli-retrieve/decay-bare` — "my_context decay — items not injected in the last 20 session(s)", with the caveat block defining "cold" as "not auto-injected in the last window of sessions"; `cli-retrieve/decay-sessions` shows `--sessions 5` moving the window
**Note:** That record's ledger held 0 sessions, so no item was actually reported cold. The claim verified is what the command reports and over what window, which the header and `cli-retrieve/decay-json`'s `"window": 20` state directly.

---

### C-077 · README:1670-1671
> Lowering a budget instead leaves every item in force and spills the surplus into a note.

**Verdict:** VERIFIED
**Citation:** `own-run:budget-pinned10` and `config/budgets-spill-pinned` — the spilled items remain active in the corpus (they still appear in the index and in `mycontext list`) and are named in the omission note; `src/core/select.ts:291-298` records a `Spill` and never mutates the item

---

### C-078 · README:1673-1675
> Items are admitted hardest-first — `severity: hard` before `severity: soft`, then project layer before global, then by id so the result is deterministic.

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:260-275` — `SEVERITY_RANK = { hard: 0, soft: 1 }`, then `LAYER_RANK = { project: 0, global: 1 }`, then `compareStrings(a.id, b.id)`; applied at `:284` (`[...candidates].sort(byPriority)`). `compareStrings` is ordinal rather than locale-dependent (`:263-266`), which is what makes it deterministic.

---

### C-079 · README:1676-1677
> An item too large for the remaining space is skipped rather than ending the pass, so a smaller item behind it can still be admitted.

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:291-297` — the over-budget branch pushes a spill and `continue`s (the comment at `:286-290` names the choice: "First-fit, not strict priority truncation … `continue`, not `break`")

---

### C-080 · README:1677-1679
> An item skipped this way is said to have **spilled** — that is the word the code uses

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:46-50` (`export interface Spill`), `:279` (`spilled: Spill[]`), `:292` (`spilled.push`); the audit record field is `spilled` (`src/core/inject.ts:341-345`, `src/hooks/pre-tool-use.ts:284-288`)

---

### C-081 · README:1681-1690
> an item that a full-text tier could not fit appears twice: named in a one-line note under the injection, `_1 item(s) omitted from full text for budget: CONST-postgres-pool-capped-at-20. Fetch with mycontext show <id>._` and again as an ordinary line in the index

**Verdict:** VERIFIED
**Citation:** `own-run:budget-pinned10` emitted that line **character-for-character** — `_1 item(s) omitted from full text for budget: CONST-postgres-pool-capped-at-20. Fetch with mycontext show <id>._` — together with `- CONST-postgres-pool-capped-at-20 · constraint · Postgres pool capped at 20` in the index above it. Independently, `config/budgets-spill-pinned` shows the two-item form. `src/core/render.ts:66-69`; `src/core/select.ts:357-358` is why the spilled item earns its index line.

---

### C-082 · README:1692-1697
> when the *index itself* runs out of budget, the lines that do not fit are replaced by a count. `- … +2 more (fetch with mycontext show <id>)`

**Verdict:** VERIFIED
**Citation:** `config/budgets-index-overflow` — five normative items against a 60-token index budget produced `- … +1 more (fetch with mycontext show <id>)`; reproduced independently at `own-run:budget-index60`; `src/core/render.ts:18`
**Note:** The README's `+2` is illustrative; the literal string, punctuation and parenthetical all match.

---

### C-083 · README:1694-1697
> the lines that do not fit are replaced by a count … Everywhere else, what was excluded is named where it was excluded.

**Verdict:** VERIFIED
**Citation:** `src/core/render.ts:53-60` — `renderSpill` deliberately drops entries whose only tier is `index` ("already disclosed by the index's '+N more' line"), so the index overflow is the one un-named exclusion; every other tier's spill is named by id at `render.ts:62-69`, confirmed by `own-run:budget-pinned10` and `own-run:budget-jit120`

---

### C-084 · README:1699
> The count is never wrong, and `mycontext list` shows the whole corpus from the terminal

**Verdict:** VERIFIED
**Citation:** `src/core/select.ts:404` — `truncated: spilled.length`, i.e. the count is the exact length of the list of index lines that were dropped, not an estimate; `own-run:budget-index60` (`+1 more` with exactly one index spill) and `config/budgets-index-overflow`. For the second half, `cli-capture/list-full` / `own-run:global-list` show `mycontext list` enumerating every item in both layers with no budget applied.

---

## Not treated as claims

Skipped as marketing prose, analogy or restatement: the "handful that always apply" / "stays out of the way" framings (1331, 1325), "the honest default … the shorter thing to type" (1436-1437), "a duplicate is disclosed and cheap; a missed rule is neither" (1451-1452), "a budget too small does not make a corpus smaller; it makes it invisible" (1665), "That is how a project overrides a habit" (1575), and the section-2/7/8 cross-references. The Mermaid diagram's structural nodes are covered by C-010 to C-012.

## Two claims worth a second look but not scored as defects

- **README:1427 "only once"** — accurate for the pinned↔JIT interaction it describes (C-024), but the pinned tier itself does not read the seen file, so two SessionStart firings under one session id re-inject. The README's own 1312 row makes the per-window reading explicit.
- **README:1448 `<session>.seen.jsonl`** — the on-disk name is `sanitizeSessionId(session)`, which is the session id verbatim for a normal Claude Code id and a `base-<12 hex>` form otherwise (`ledger.ts:353-358`).
