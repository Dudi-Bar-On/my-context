# Web UI Plan 1 of 3 — the server and the read surface

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `mycontext ui` — a loopback-only, token-guarded, read-only `node:http` server plus the hand-written browser app for the Core, Navigate, Report and Learn screens, with the static import-graph test that makes "the UI executes no writes" enforced rather than promised.

**Architecture:** A standalone server entry (`src/ui/server.ts`) whose runtime import graph reaches only read functions; every `/api` route composes the nine functions §3 of the spec names and never reimplements a rule. The browser app is hand-written ES modules and CSS (logical properties only, English/Hebrew string tables with a key-parity test), served statically by the same process. Ephemerality is an idle monitor that counts only non-stream `/api` requests; the token travels by a one-shot handoff nonce, never on a process command line.

**Tech Stack:** Node ≥ 24 built-ins only (`node:http`, `node:crypto`, `node:fs`, `node:sqlite` via existing core modules). No framework, no build step, no runtime dependency.

**Spec:** `docs/superpowers/specs/2026-08-16-web-ui-design.md` — the binding authority. This plan argues from it; executors read both.

**Mockup:** `docs/design/web-ui-mockup.html` — a static, owner-reviewed visual reference for every screen (open it in a browser). Good for layout, palette, and the intended rendering of each screen; its data is fabricated and several visible affordances are deliberately unimplemented. **The spec outranks it** — read `docs/design/web-ui-mockup.md` for what it is, what it is not, and the full divergence list before copying anything from it.

**Scope split (binding):** This is plan 1 of 3.
- **Plan 1 (this document):** §3 architecture (server, token, nonce, browser opening, string tables), §2 security (loopback, header token, Origin/Host, ephemerality/idle), `/api/select` with `seen` and the labelled cold-session variant, the read-only screens Core / Navigate / Report / Learn, and the §6 static import-graph test.
- **Plan 2 (not here):** the command palette, Work (review queue + diffs, overlap detection), Configure. Where plan 2 touches this surface it consumes the **Produces** blocks below (`registerRoute`, `ApiContext`, the string-table shape, `src/core/revision-log.ts`).
- **Plan 3 (not here):** Watch (audit live stream, status strip), Ask, the status line bridge (§4b). Plan 3 consumes `registerRoute` with `kind: 'stream'` (defined here, deliberately never called here), `readGitInfo` (built and tested here because it is a foundation read), and the session selector contract (`/api/sessions`).

---

## Global Constraints

- **Zero runtime dependencies.** Node 24 native TypeScript type-stripping, no build step, `erasableSyntaxOnly`, explicit `.ts` import extensions. No framework, no bundler, no CDN.
- **The UI executes no writes, anywhere.** No `/api` route may reach a mutating function. Enforced by a static import-graph test, not by discipline.
- **Never write a comment, message, doc or corpus item asserting a property the code does not have.** This project has 30+ recorded instances; several were introduced by tasks fixing other instances.
- **Nothing is ever dropped silently.** A field accepted and ignored is the one unacceptable failure.
- **Guarantee claims carry their condition in the same sentence** (`STD-guarantee-claims-carry-their-condition-in-the-same-sentence`).
- **Every change needs a test that fails without it.** `npm run mutate` refuses a dirty tree — commit first.
- `npm test`, `npx tsc --noEmit`, `npm run test:perf` clean; `git status --porcelain` clean.
- **Both documents, always** for any README change: `README.md` and `docs/README.he.md`.
- RTL is not retrofitted: logical CSS properties from the first stylesheet, one string table per language with a key-parity test.

---

## 0. Corrections — what this plan asserted that no longer holds

<!-- retired-phrases
ledger.seen(session) exactly as the hook does
seen: ledger.seen(sessionId)
|| 'status'
SCREENS.status;
pre-tool-use.ts:138
createItem `mutate.ts:1047`
-->

**These corrections are enforced, not merely recorded.** The block above lists the phrases this
pass retired; `npm run check:retired` fails if any of them reappears anywhere below §0. That check
exists because the first attempt at this pass wrote §0 and left four task bodies still saying
`seen: ledger.seen(session)` "exactly as the hook does", and `route()` twenty tasks later still
defaulting to a screen wave 1 does not build. A correct §0 tells you nothing about whether the body
agrees with it.

**Re-verified 2026-08-18** against `master`, per `2026-08-18-v2-decisions.md` §1. This plan was written
on `plan/web-ui-server`, based on `origin/spec/web-ui-amend` at `a866fc8` — **which is not an ancestor
of `master`.** It was written on a line that diverged and never merged back, so three refactors that
landed on the line that became `master` were invisible to it. Every citation below was re-resolved.

Every row names the **class** of error, not only the instance — the §0 discipline as
`2026-08-18-v2-decisions.md` §3 fixes it. A correction that does not generalise does not prevent its
own recurrence.

| Was | Is | Class | Where |
|---|---|---|---|
| The hook passes `seen: ledger.seen(sessionId)` | **The Ledger is gone from that path entirely.** The hook reads the **per-session seen file**: `readSeen(root, ledgerKey(input))` then `seenIds(state)`. `Ledger.seen` still exists and is a replayed projection topped up by `status`, `decay` and `audit replay-ledger` | A plan names the function the code calls today, not the one that answered the question when the plan was written | Tasks 7, 8 |
| The hook opens `Store` before `Ledger` (corruption self-heal ordering) and never rebuilds | **It opens `Store.openReadOnlyChecked` and no `Ledger` at all.** The comment on that line says the Ledger is gone from the path because dedupe state moved to the seen file, and that this hook "has no reason left to write SQLite" | An ordering constraint between two components is re-checked when either leaves the path | Tasks 7, 8 |
| The eight mutating functions all live in `mutate.ts` / `revision.ts`, at the lines listed | **`linkItems` and `unlinkItems` moved to `relations.ts`.** Every line number in that row was also wrong by hundreds of lines — `createItem` was cited at `mutate.ts:1047` in a file 878 lines long | An enforcement list names **symbols**; a list of files or line numbers silently stops covering a symbol that moves | Task 14 |
| `SelectContext { event; path?; seen?; restore? }` | **It declares five inputs.** `focus?: Focus \| null` is applied before every tier and before budgeting | A parameter list is re-read whole, not diffed from memory — an omitted input is a different function | Tasks 8, 17 |
| `Selection { full; index; spilled }` | **It also carries `focus: FocusReport \| null` and `tokens: number`** — the focus disclosure, and the estimated tokens the budgets were charged | A return shape is re-read whole; fields added since are exactly the ones a screen will not render | Tasks 8, 17 |
| `helpTopic(topic, config)` | **`helpTopic(topic, config, locale?)`** — it gained a locale parameter | A signature is re-resolved, not assumed stable, when the plan calls it | Task 11 |
| `Store.open(dbPath)` is the UI's entry point | **`Store.openReadOnlyChecked(dbPath)` is.** `Store.open` self-heals by `rmSync`-ing the database and both journals; the read-only open "never triggers the corruption self-heal" and is what the hooks already use | A read path uses the narrowest open that answers the question | Tasks 8–13 |

**Two facts moved far enough to be worth naming, though the fact itself held:** `select()` was cited at
`select.ts:324` and is at `~460`; `matchesScope` at `:149` and is at `~191`. Both cited lines now land
mid-comment in unrelated blocks. They are the two that were sampled; the rest of this table's rows were
re-resolved mechanically rather than spot-checked.

---

## Verified facts this plan builds on

**Re-verified against `master` on 2026-08-18.** Citations are `file` · `verbatim fragment` · `~line`,
per `2026-08-18-v2-decisions.md` §2: the **fragment is the identity** and the line is a hint that may
go stale. `npm run verify:citations` resolves every fragment in this table and exits non-zero on a
miss. Where the plan needs a fact it could not verify, the task says "establish by executing" instead
of asserting it.

| Fact | Where verified |
|---|---|
| `select(items, ctx, config): Selection` | `core/select.ts` · `export function select(items: Item[], ctx: SelectContext, config: Config): Selection {` · ~460 |
| `SelectContext` declares **five** inputs: `event`, `path?`, `seen?`, `restore?`, **`focus?`** | `core/select.ts` · `export interface SelectContext {` · ~19 |
| `SelectEvent = 'session-start' \| 'compact' \| 'tool' \| 'manual'` | `core/select.ts` · `export type SelectEvent = 'session-start' \| 'compact' \| 'tool' \| 'manual';` · ~17 |
| `Selection { full; index; spilled; focus; tokens }` | `core/select.ts` · `export interface Selection {` · ~72 |
| Seen items filtered **before** budgeting; comment says "must not be reverted" | `core/select.ts` · `hardening and must not be reverted: an already-injected item must not` · ~476 |
| Focus narrows the eligible set before every tier and before budgeting | `core/select.ts` · `const focus = ctx.focus ?? null;` · ~469 |
| The hook reads the **per-session seen file**, not the Ledger | `hooks/pre-tool-use.ts` · `const seenState = readSeen(ws.projectRoot, dedupeKey);` · ~183 |
| The dedupe key carries `agent_id` when present — `session_id::agent_id` for a subagent, the bare id for the parent | `hooks/io.ts` · `export function ledgerKey(input: HookInput): string \| null {` · ~46 |
| The hook opens the index **read-only and schema-checked**, and no Ledger | `hooks/pre-tool-use.ts` · `store = Store.openReadOnlyChecked(ws.dbPath);` · ~175 |
| The hook passes the focus it read | `hooks/pre-tool-use.ts` · `const focusState = readFocus(ws.projectRoot);` · ~199 |
| `matchesScope(item, target, config)` | `core/select.ts` · `export function matchesScope(item: Item, target: string, config: Config): boolean {` · ~191 |
| `isEligible(item, config)` | `core/select.ts` · `export function isEligible(item: Item, config: Config): boolean {` · ~123 |
| `isNormative` is **private** (no `export`) | `core/select.ts` · `function isNormative(item: Item, config: Config): boolean {` · ~129 |
| `itemCost` is **private** — Task 5 exports it | `core/select.ts` · `function itemCost(item: Item): number {` · ~119 |
| `estimateTokens(text)` — chars/4 | `core/select.ts` · `export function estimateTokens(text: string): number {` · ~106 |
| `reviewQueue(items, type?)` — takes a plain `Item[]` | `core/select.ts` · `export function reviewQueue(items: Item[], type: string \| null = null): Item[] {` · ~344 |
| `mergeLayers(items)` exported | `core/select.ts` · `export function mergeLayers(items: Item[]): Item[] {` · ~411 |
| `injectableTypes(config)` exported | `core/select.ts` · `export function injectableTypes(config: Config): string[] {` · ~144 |
| `injection(item, config): { phrase, injected }` | `cli/commands/injection.ts` · `export function injection(` · ~42 |
| `scopePolicyFor(config, type)` | `core/config.ts` · `export function scopePolicyFor(config: Config, type: string): ScopePolicy {` · ~138 |
| `agentEditsFor(config, type)` | `core/config.ts` · `export function agentEditsFor(config: Config, type: string): AgentEdits {` · ~160 |
| `resolveConfig(raw): Config` | `core/config.ts` · `export function resolveConfig(raw: unknown): Config {` · ~408 |
| `Config { profile; categories; budgets; watchedDocs }` | `core/config.ts` · `export interface Config {` · ~166 |
| `Budgets { pinned; jit; restored; index }` | `core/config.ts` · `export interface Budgets {` · ~5 |
| `Ledger.seen(sessionId)` — **a replayed projection, not live dedupe state** | `core/ledger.ts` · `seen(sessionId: string): string[] {` · ~179 |
| `Ledger.recentSessions(limit)` — ties broken `session_id DESC` | `core/ledger.ts` · `recentSessions(limit: number): string[] {` · ~242 |
| `Ledger.entries(sessionId): LedgerEntry[]` | `core/ledger.ts` · `entries(sessionId: string): LedgerEntry[] {` · ~186 |
| `Ledger.allUsage()` | `core/ledger.ts` · `allUsage(): Usage[] {` · ~225 |
| `Ledger.itemsUsedIn(sessionIds)` | `core/ledger.ts` · `itemsUsedIn(sessionIds: string[]): string[] {` · ~263 |
| `Ledger.sessionCount()` | `core/ledger.ts` · `sessionCount(): number {` · ~314 |
| Ledger schema: `PRIMARY KEY (session_id, item_id, tier)`, `injected_at` a value | `core/ledger.ts` · `PRIMARY KEY (session_id, item_id, tier)` · ~35 |
| `Ledger.open` relies on a writable open having run first against the same path | `core/ledger.ts` · `static open(dbPath: string, busyTimeoutMs = 3000): Ledger {` · ~76 |
| `readSnapshotMeta(root, sessionId)` reads a compact snapshot's item ids | `core/ledger.ts` · `export function readSnapshotMeta(root: string, sessionId: string): SnapshotMeta \| null {` · ~503 |
| `renderSelection(selection)` renders the injected text | `core/render.ts` · `export function renderSelection(selection: Selection): string {` · ~139 |
| **`Store.openReadOnlyChecked(dbPath)` — what this server must use** | `core/store.ts` · `static openReadOnlyChecked(dbPath: string): Store {` · ~402 |
| `Store.open(dbPath)` — **self-heals by deleting the file; not for a read path** | `core/store.ts` · `static open(dbPath: string, profile: OpenProfile = DEFAULT_OPEN_PROFILE, _retried = false): Store {` · ~337 |
| `store.all()` | `core/store.ts` · `all(): Item[] {` · ~489 |
| `store.activeInjectable(types)` | `core/store.ts` · `activeInjectable(types: string[]): Item[] {` · ~511 |
| `assertSelectOnly(sql)` — the barrier `readOnly: true` does **not** provide | `cli/commands/query.ts` · `export function assertSelectOnly(sql: string): void {` · ~114 |
| `resolveWorkspace(cwd): Workspace` | `core/workspace.ts` · `export function resolveWorkspace(cwd: string): Workspace {` · ~27 |
| `Workspace { projectRoot; globalRoot; dbPath; config }` | `core/workspace.ts` · `export interface Workspace {` · ~9 |
| `runChecks(opts): Finding[]` | `doctor/checks.ts` · `export function runChecks(opts: {` · ~748 |
| `Finding { level; code; message; item? }` | `doctor/checks.ts` · `export interface Finding {` · ~13 |
| `listRepoFiles(repoRoot, limit)` exported; skips `.git`, `node_modules`, … | `doctor/checks.ts` · `export function listRepoFiles(repoRoot: string, limit: number = FILE_LIMIT): string[] {` · ~73 |
| `computeDecay(input): DecayReport` | `core/decay.ts` · `export function computeDecay(input: DecayInput): DecayReport {` · ~93 |
| `DecayReport { window; sessionsRecorded; cold; warm; unrestricted }` | `core/decay.ts` · `export interface DecayReport {` · ~24 |
| `helpTopic(topic, config, locale?)` — **three parameters now** | `help/index.ts` · `export function helpTopic(topic: string, config: Config, locale?: HelpLocale): string {` · ~112 |
| `HELP_TOPICS = ['categories','scope','capture','workflow']` | `help/index.ts` · `export const HELP_TOPICS: HelpTopic[] = ['categories', 'scope', 'capture', 'workflow'];` · ~11 |
| `registerCommand(def)` | `cli/commands/registry.ts` · `export function registerCommand(def: CommandDef): void {` · ~46 |
| `CommandFn = (ws, args, out, cwd) => number` | `cli/commands/registry.ts` · `export type CommandFn = (ws: Workspace, args: string[], out: Emit, cwd: string) => number;` · ~6 |
| CLI main sets `process.exitCode` (never `process.exit`), so a live server keeps the process alive | `cli/index.ts` · `process.exitCode = runCli(process.argv.slice(2), process.cwd(), (s) => console.log(s));` · ~827 |
| `createItem` | `core/mutate.ts` · `export function createItem(` · ~184 |
| `updateItem` | `core/mutate.ts` · `export function updateItem(` · ~451 |
| `supersedeItem` | `core/mutate.ts` · `export function supersedeItem(ctx: MutationContext, input: SupersedeInput): MutationResult {` · ~746 |
| `linkItems` — **`relations.ts`, not `mutate.ts`** | `core/relations.ts` · `export function linkItems(ctx: MutationContext, input: LinkInput): MutationResult {` · ~74 |
| `unlinkItems` — **`relations.ts`, not `mutate.ts`** | `core/relations.ts` · `export function unlinkItems(ctx: MutationContext, input: LinkInput): MutationResult {` · ~244 |
| `stageRevision` | `core/revision.ts` · `export function stageRevision(` · ~865 |
| `promoteRevision` | `core/revision.ts` · `export function promoteRevision(` · ~1071 |
| `discardRevision` | `core/revision.ts` · `export function discardRevision(` · ~1176 |
| `revision.ts` imports `updateItem` from `mutate.ts` at runtime, so importing anything from `revision.ts` pulls `mutate.ts` in | `core/revision.ts` · `import { updateItem, type MutationContext, type MutationResult } from './mutate.ts';` · ~7 |
| `readLog(root)` | `core/revision.ts` · `export function readLog(root: string): LogLine[] {` · ~504 |
| `pendingRevisionCounts(revs)` | `core/revision.ts` · `export function pendingRevisionCounts(` · ~662 |
| `pendingRevisionLine(revs)` | `core/revision.ts` · `export function pendingRevisionLine(revs: PendingRevision[]): string {` · ~685 |
| `Item` has **no creation timestamp** | `core/types.ts` · `export interface Item {` · ~33 |
| `Relation { type: string; target: string }` | `core/types.ts` · `export interface Relation {` · ~28 |
| `VERSION` is read from `package.json`, not transcribed | `core/version.ts` · `export const VERSION = parseVersion(readFileSync(MANIFEST, 'utf8'), 'package.json');` · ~75 |
| tsconfig: `erasableSyntaxOnly` | `tsconfig.json` · `"erasableSyntaxOnly": true,` · ~10 |
| tsconfig: `allowImportingTsExtensions` | `tsconfig.json` · `"allowImportingTsExtensions": true,` · ~6 |
| tsconfig: `verbatimModuleSyntax` | `tsconfig.json` · `"verbatimModuleSyntax": true,` · ~9 |

**Facts that are absences, and cannot carry a fragment.** These are re-checked by execution, not by
citation — `verify-citations.ts` has nothing to resolve for a thing that does not exist:

| Fact | How it was re-checked |
|---|---|
| No `child_process` use anywhere in `src/` | `grep -rn child_process src/` — no matches, 2026-08-18 |
| `package.json` has no `dependencies` key | read; `devDependencies` holds only `typescript` and `@types/node` |
| `runChecks`' import graph reaches `rebuild.ts` (via `ingest/session.ts`) but **not** `mutate.ts`/`revision.ts` | import headers of `doctor/checks.ts`, `ingest/session.ts`, `ingest/chunk.ts`, `core/rebuild.ts` |
| E2E test pattern: spawn a real child, readiness-gated harness | `test/mcp/server-e2e.test.ts`, `test/helpers/stdio.ts` |
| Docs parity pattern, and its honesty docstring | `test/docs/parity.test.ts` |

**Task-1 preconditions, re-run against `master` on 2026-08-18** — §8.1 step 4. Executed, not read:

| Precondition | Result |
|---|---|
| `src/ui/` does not exist | ✅ absent — Task 1 starts clean |
| `test/ui/` does not exist | ✅ absent |
| `npm test`'s glob reaches a new `test/ui/` directory | ✅ `test/**/*.test.ts` |
| A plain browser `.js` module with named exports imports into `node --test` **without a build step** — the assumption the whole no-build-step string-table design rests on | ✅ **executed**: a probe module exporting `strings`/`dir`/`lang` was imported from a `node --test` file and all three named exports resolved. It works because `package.json` declares `"type": "module"`; that field is load-bearing for Task 1 and was not named in the original plan |

**The worktree fact this plan must not get wrong:** in a git worktree, `<repo>/.git` is a **file**
containing `gitdir: <path>`, not a directory. The developer building this works in worktrees daily
(this plan was itself written inside one, where `.git` is exactly such a file). Task 4 handles both
shapes and tests both.

---

## Design decisions this plan fixes (so no implementer has to guess)

1. **The server never rebuilds the index.** The hook reads the store as-is (`pre-tool-use.ts:129-138`); the flagship screen's promise is "see exactly what Claude gets", so `/api/select` must read exactly what the hook reads. Staleness is not hidden: `/api/doctor` surfaces `index_stale` (`doctor/checks.ts:146`), and the status screen renders it.
2. **The server opens `Store` before `Ledger` on every request that needs the ledger**, for the reason documented at `src/core/ledger.ts:48-63`.
3. **The import-graph test bans the two mutating modules, not just the eight names.** Because `revision.ts` imports `updateItem` at runtime (`revision.ts:5-8`), any module reachable from the server that imports *anything* from `revision.ts` or `mutate.ts` puts a mutating function in reach. The test therefore asserts: (a) neither `src/core/mutate.ts` nor `src/core/revision.ts` appears in the server's runtime import graph, (b) no reachable module names one of the eight functions in an import binding, and (c) no reachable module contains `require(` or a dynamic `import(` — which is what makes the static analysis sound. Type-only imports are erased by `verbatimModuleSyntax` and are skipped.
4. **Consequence of 3:** the status screen's pending-revisions count cannot come from `revision.ts`. Task 6 extracts the read-only log-reading half of `revision.ts` into `src/core/revision-log.ts` (no `mutate.ts` import), with `revision.ts` re-importing from it so every existing caller is untouched. This is a move, not a rewrite.
5. **Two nonce lifetimes, both one-shot.** The browser-opener URL carries a 10-second nonce (§3: visible in a process list for its lifetime). The `--no-open` / spawn-fallback URL is *printed*, never on a command line, so its nonce gets 10 minutes — long enough to paste into a browser by hand, still one-shot, still dead on server exit. The spec fixes only the opener's 10 seconds; the printed-URL lifetime is this plan's decision and the on-screen text says which URL kind it is.
6. **Unknown query parameters are refused with 400**, per INV-nothing-is-dropped-silently. `/api/select?sesion=x` answering the cold question because a typo dropped the session would be this project's canonical defect in a new medium.
7. **`/api/select` returns `select()`'s JSON serialization and nothing else** — the §6 parity test demands `assert.deepEqual(JSON.parse(body), JSON.parse(JSON.stringify(select(items, ctx, config))))`, so budget bars and rendered text come from two sibling endpoints (`/api/simulate`, `/api/render`) rather than from fields bolted onto the parity endpoint.
8. **Per-item cost comes from `select.ts` itself.** Task 5 exports the existing private `itemCost` (spec §3's "export it — but not both, and never neither" logic, applied to the cost rule instead of copying its one-line body into the simulator).
9. **The Learn screen's "most recent captures" cross-link uses the item file's mtime, labelled as such.** `Item` carries no creation timestamp (`types.ts:33-58`) and the ledger records injection, not capture. File mtime is the only recency signal that exists; the label carries the condition in the same sentence.

---

## File Structure

New files (created by this plan):

```
src/ui/
  server.ts            # entry point; http server, routing dispatch, security gate,
                       #   handoff, ping, idle wiring; also runnable as a main module
  routes.ts            # route table + registerRoute() — the extension point plans 2/3 consume
  security.ts          # token mint, constant-time compare, NonceStore, request validation
  idle.ts              # IdleMonitor — 15-minute idle exit, injectable clock
  git-info.ts          # readGitInfo(): branch/commit/upstream from .git *files*,
                       #   handling .git-as-file (worktree) and .git-as-directory
  open.ts              # per-platform browser opener; first child_process use in src/
  static.ts            # static asset serving for src/ui/public, traversal-proof
  read-model.ts        # every /api read handler as a pure, HTTP-free function
  public/
    index.html         # app shell
    styles.css         # logical properties ONLY (no left/right); print stylesheet
    app.js             # router, session selector, language switch, heartbeat, exit banner
    lib/
      bootstrap.js     # fragment-nonce → token exchange; history.replaceState
      heartbeat.js     # visibility-gated 60s ping
      i18n.js          # string-table selection, <html dir>/lang
      viewmodel.js     # pure screen view-models (coverage tree, graph layout, decay series)
    strings/
      en.js            # English string table
      he.js            # Hebrew string table (identical key set — tested)
    screens/
      preview.js       # Core: injection preview + budget bar + spills
      simulate.js      # Core: budget simulator
      injected.js      # Core: what is currently injected (per session)
      coverage.js      # Core+Navigate: coverage map, detail pane, gaps, printable mode
      graph.js         # Navigate: ego-graph (radius 1-2, 60-node cap, layered layout)
      status.js        # Report: landing screen (the recorded exception)
      doctor.js        # Report: findings grouped by code
      decay.js         # Report: decay chart
      learn.js         # Learn: help topics cross-linked to the corpus
src/core/revision-log.ts   # read-only revision-log reading, extracted from revision.ts
src/cli/commands/ui.ts     # `mycontext ui [--port N] [--no-open]`
test/ui/
  strings-parity.test.ts
  security.test.ts
  idle.test.ts
  git-info.test.ts
  read-model.test.ts       # select parity matrix + every read endpoint's pure function
  static.test.ts
  server-e2e.test.ts       # spawned process, real HTTP: security + handoff + ping + idle
  no-writes.test.ts        # THE import-graph test
  helpers.ts               # spawn-server harness (readiness-gated, like test/helpers/stdio.ts)
test/core/revision-log.test.ts
```

Modified files:

```
src/core/select.ts             # export itemCost (Task 5) — nothing else changes
src/core/revision.ts           # imports the moved read functions from revision-log.ts (Task 6)
src/core/ledger.ts             # + history(), sessionSummaries(limit) — read-only additions (Task 7)
src/cli/commands/index.ts      # + import './ui.ts'
README.md, docs/README.he.md   # document `mycontext ui` (Task 20, both documents)
```

---

## Task 1: The string tables and their key-parity test

**Files:**
- Create: `src/ui/public/strings/en.js`
- Create: `src/ui/public/strings/he.js`
- Test: `test/ui/strings-parity.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `strings` — a default-less named export from each of `src/ui/public/strings/en.js` and `he.js`: `export const strings = { [key: string]: string }`, plus `export const dir = 'ltr' | 'rtl'` and `export const lang = 'en' | 'he'`. Plans 2 and 3 add keys to **both** files in the same commit; the parity test fails on any asymmetric key. Keys are dot-namespaced by screen (`preview.title`, `common.coldSession`, …). Placeholders use `{name}` and are substituted by `t()` in `i18n.js` (Task 16).

The string files are plain browser ES modules (`.js`, no types) so both the browser and `node --test` can import them unmodified — this is why the parity test can exist without a build step.

- [ ] **Step 1: Write the failing test**

```ts
// test/ui/strings-parity.test.ts
/**
 * Key parity between the English and Hebrew UI string tables, in the spirit
 * of test/docs/parity.test.ts.
 *
 * What this test cannot do, stated so a green suite is not mistaken for
 * verified Hebrew: it compares KEY COVERAGE only, never translation
 * freshness. A Hebrew value left stale by an English edit passes every
 * assertion here. Translation freshness is a review obligation, not a
 * tested one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('en and he string tables declare identical key sets', async () => {
  const en = await import('../../src/ui/public/strings/en.js');
  const he = await import('../../src/ui/public/strings/he.js');
  assert.deepEqual(Object.keys(en.strings).sort(), Object.keys(he.strings).sort());
});

test('each table declares its direction and language', async () => {
  const en = await import('../../src/ui/public/strings/en.js');
  const he = await import('../../src/ui/public/strings/he.js');
  assert.equal(en.dir, 'ltr');
  assert.equal(en.lang, 'en');
  assert.equal(he.dir, 'rtl');
  assert.equal(he.lang, 'he');
});

test('no string value is empty — an empty translation is a dropped string', async () => {
  for (const mod of ['en', 'he']) {
    const { strings } = await import(`../../src/ui/public/strings/${mod}.js`);
    for (const [key, value] of Object.entries(strings)) {
      assert.ok(typeof value === 'string' && value.trim() !== '', `${mod}:${key} is empty`);
    }
  }
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/ui/strings-parity.test.ts`
Expected: FAIL — cannot find module `src/ui/public/strings/en.js`.

- [ ] **Step 3: Write the two tables**

`src/ui/public/strings/en.js` (the starting key set; later tasks add keys to both files as they add screens):

```js
export const lang = 'en';
export const dir = 'ltr';
export const strings = {
  'app.title': 'mycontext',
  'app.serverExited':
    'the mycontext UI server has exited — restart it with `mycontext ui`',
  'app.language': 'Language',
  'session.label': 'Session',
  'session.cold': 'cold session — what a brand-new session would get, not this session’s preview',
  'session.empty': 'no sessions recorded yet — only the cold-session question can be asked',
  'session.lastInjection': 'last injection {when}',
  'nav.core': 'Core',
  'nav.navigate': 'Navigate',
  'nav.report': 'Report',
  'nav.learn': 'Learn',
  'preview.title': 'Injection preview',
  'preview.pickFile': 'Pick a file',
  'preview.event': 'Event',
  'preview.spilled': 'Spilled — selected and did not fit',
  'preview.nothing': 'Nothing would be injected here.',
  'preview.renderedText': 'Exactly what Claude gets',
  'simulate.title': 'Budget simulator',
  'simulate.budget': 'Budget ({tier})',
  'simulate.fits': '{n} item(s) fit',
  'simulate.spills': '{n} item(s) spill',
  'injected.title': 'Currently injected',
  'injected.none': 'This session has been given nothing yet.',
  'coverage.title': 'Scope coverage map',
  'coverage.governs': 'Governs this path',
  'coverage.wouldInject': 'What would be injected',
  'coverage.gaps': 'Coverage gaps',
  'coverage.gapDirs': 'Directories no item governs',
  'coverage.emptyCategories': 'Empty categories',
  'coverage.print': 'Printable rendering',
  'coverage.truncated': 'file walk truncated at {n} files — the map is partial, not complete',
  'graph.title': 'Relation graph',
  'graph.focus': 'Focused item',
  'graph.radius': 'Radius',
  'graph.more': '+{n} more not shown',
  'graph.dangling': 'dangling — target does not exist',
  'status.title': 'Status',
  'status.items': '{n} item(s)',
  'status.drafts': '{n} draft(s) pending review',
  'status.revisions': '{revisions} pending revision(s) on {items} item(s)',
  'status.health': '{errors} error(s), {warnings} warning(s), {infos} note(s)',
  'doctor.title': 'Doctor',
  'doctor.repair': 'Repair command (composed, not run — paste it into your console)',
  'decay.title': 'Decay',
  'decay.caveat':
    'the ledger records injection, not reading or reliance — over a window of {window} session(s), of {recorded} recorded',
  'learn.title': 'Help',
  'learn.corpusLinks': 'In this project',
  'learn.recentCaptures': 'Most recent captures (by file modification time — items carry no creation timestamp)',
  'common.write': 'This is a write. It must be run in your own console — the UI never executes writes.',
  'common.copy': 'Copy',
  'common.loading': 'Loading…',
  'common.error': 'Request failed: {message}',
  'common.asOf': 'as of {when}',
};
```

`src/ui/public/strings/he.js` — same keys, Hebrew values, `dir = 'rtl'`, `lang = 'he'`. Write real Hebrew translations (the implementer writes them; the repo's own `docs/README.he.md` is the register to match). Example of the first entries so the shape is unambiguous:

```js
export const lang = 'he';
export const dir = 'rtl';
export const strings = {
  'app.title': 'mycontext',
  'app.serverExited':
    'שרת הממשק של mycontext הסתיים — הפעל אותו מחדש עם `mycontext ui`',
  'app.language': 'שפה',
  'session.label': 'סשן',
  // … every key from en.js, translated. The parity test enforces the set.
};
```

(The literal file must contain every key — the comment above is for this plan only and must not appear as a substitute for keys.)

- [ ] **Step 4: Run the test and see it pass**

Run: `node --test test/ui/strings-parity.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/public/strings test/ui/strings-parity.test.ts
git commit -m "feat(ui): English and Hebrew string tables with key-parity test"
```

---

## Task 2: `security.ts` — token, nonce store, request validation

**Files:**
- Create: `src/ui/security.ts`
- Test: `test/ui/security.test.ts`

**Interfaces:**
- Consumes: `node:crypto` only.
- Produces (plans 2 and 3 call none of these directly — the server gate applies them to every route, theirs included — but the signatures are fixed here):
  - `mintToken(): string` — 32 random bytes, hex (64 chars).
  - `TOKEN_HEADER = 'x-mycontext-token'` (Node lower-cases incoming header names; the browser sends `X-Mycontext-Token`).
  - `class NonceStore { mint(ttlMs: number, now?: number): string; redeem(nonce: string, now?: number): boolean }` — one-shot: `redeem` returns `true` at most once per nonce, and `false` after expiry.
  - `validateApiRequest(req: { headers: Record<string, string | string[] | undefined> }, expected: { token: string; port: number }): { ok: true } | { ok: false; status: number; reason: string }` — checks `Host`, `Origin` (when present), and the token header, in that order.

- [ ] **Step 1: Write the failing test**

```ts
// test/ui/security.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mintToken, NonceStore, TOKEN_HEADER, validateApiRequest,
} from '../../src/ui/security.ts';

test('mintToken returns 64 hex chars and never repeats across calls', () => {
  const a = mintToken();
  const b = mintToken();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
});

test('a nonce redeems exactly once', () => {
  const store = new NonceStore();
  const nonce = store.mint(10_000, 0);
  assert.equal(store.redeem(nonce, 1_000), true);
  assert.equal(store.redeem(nonce, 1_001), false);
});

test('a nonce is dead after its window', () => {
  const store = new NonceStore();
  const nonce = store.mint(10_000, 0);
  assert.equal(store.redeem(nonce, 10_001), false);
});

test('an unknown nonce never redeems', () => {
  const store = new NonceStore();
  store.mint(10_000, 0);
  assert.equal(store.redeem('not-a-nonce', 0), false);
});

function req(headers: Record<string, string>): { headers: Record<string, string> } {
  return { headers };
}

const EXPECT = { token: 'a'.repeat(64), port: 4111 };
const HOST = '127.0.0.1:4111';

test('the exact token with the right Host passes', () => {
  const verdict = validateApiRequest(
    req({ host: HOST, [TOKEN_HEADER]: EXPECT.token }), EXPECT,
  );
  assert.deepEqual(verdict, { ok: true });
});

test('a wrong token is 403', () => {
  const verdict = validateApiRequest(
    req({ host: HOST, [TOKEN_HEADER]: 'b'.repeat(64) }), EXPECT,
  );
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.equal(verdict.status, 403);
});

test('a missing token header is 401', () => {
  const verdict = validateApiRequest(req({ host: HOST }), EXPECT);
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.equal(verdict.status, 401);
});

test('a wrong Host is 403 even with the right token', () => {
  const verdict = validateApiRequest(
    req({ host: 'evil.example:4111', [TOKEN_HEADER]: EXPECT.token }), EXPECT,
  );
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.equal(verdict.status, 403);
});

test('a cross-origin Origin is 403; the loopback Origin and an absent Origin pass', () => {
  const bad = validateApiRequest(
    req({ host: HOST, origin: 'https://evil.example', [TOKEN_HEADER]: EXPECT.token }), EXPECT,
  );
  assert.equal(bad.ok, false);
  const good = validateApiRequest(
    req({ host: HOST, origin: `http://${HOST}`, [TOKEN_HEADER]: EXPECT.token }), EXPECT,
  );
  assert.deepEqual(good, { ok: true });
});

test('localhost is not 127.0.0.1 — the page is only ever served on 127.0.0.1, so a localhost Host is refused', () => {
  const verdict = validateApiRequest(
    req({ host: 'localhost:4111', [TOKEN_HEADER]: EXPECT.token }), EXPECT,
  );
  assert.equal(verdict.ok, false);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/ui/security.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/ui/security.ts
import { randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * The session token: 32 random bytes, minted per invocation, held in memory
 * on both sides and nowhere else. It is required in a custom header on every
 * /api request — the custom header is the CSRF defence: a cross-origin form
 * post cannot set one, and with no CORS headers the browser blocks the fetch
 * outright (spec §2).
 */
export function mintToken(): string {
  return randomBytes(32).toString('hex');
}

/** Node lower-cases incoming header names; the page sends `X-Mycontext-Token`. */
export const TOKEN_HEADER = 'x-mycontext-token';

/**
 * One-shot handoff nonces (spec §3, "Opening the browser"). A nonce is minted
 * with its own ttl — 10 seconds for a URL that transits a process command
 * line, longer for a URL that is only ever printed — and redeems at most
 * once. Redeemed and expired nonces are deleted; the store never grows past
 * the handful a single invocation mints.
 */
export class NonceStore {
  #nonces = new Map<string, number>(); // nonce -> expiry epoch ms

  mint(ttlMs: number, now: number = Date.now()): string {
    const nonce = randomBytes(16).toString('hex');
    this.#nonces.set(nonce, now + ttlMs);
    return nonce;
  }

  redeem(nonce: string, now: number = Date.now()): boolean {
    const expiry = this.#nonces.get(nonce);
    if (expiry === undefined) return false;
    this.#nonces.delete(nonce); // one-shot: spent OR expired, it is gone either way
    return now <= expiry;
  }
}

/** Constant-time comparison; length mismatch short-circuits (length is not secret here). */
function tokenEquals(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function headerValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * The per-request gate (spec §2): Host validated always, Origin validated
 * when the browser sends one (same-origin GETs may omit it; a PRESENT
 * mismatched Origin is always refused), token validated last. The server
 * binds 127.0.0.1 and the page is only ever opened on 127.0.0.1, so
 * `localhost` spellings are refused rather than aliased — an allowance for a
 * second spelling is a second thing to audit.
 */
export function validateApiRequest(
  req: { headers: Record<string, string | string[] | undefined> },
  expected: { token: string; port: number },
): { ok: true } | { ok: false; status: number; reason: string } {
  const wantHost = `127.0.0.1:${expected.port}`;
  const host = headerValue(req.headers.host);
  if (host !== wantHost) {
    return { ok: false, status: 403, reason: `Host ${JSON.stringify(host ?? '')} is not ${wantHost}` };
  }
  const origin = headerValue(req.headers.origin);
  if (origin !== undefined && origin !== `http://${wantHost}`) {
    return { ok: false, status: 403, reason: `Origin ${JSON.stringify(origin)} is not http://${wantHost}` };
  }
  const token = headerValue(req.headers[TOKEN_HEADER]);
  if (token === undefined) {
    return { ok: false, status: 401, reason: `missing ${TOKEN_HEADER} header` };
  }
  if (!tokenEquals(token, expected.token)) {
    return { ok: false, status: 403, reason: 'wrong token' };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run the test and see it pass**

Run: `node --test test/ui/security.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/security.ts test/ui/security.test.ts
git commit -m "feat(ui): token mint, one-shot nonce store and per-request validation"
```

---

## Task 3: `idle.ts` — the idle monitor

**Files:**
- Create: `src/ui/idle.ts`
- Test: `test/ui/idle.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `class IdleMonitor { constructor(idleMs: number, onIdle: () => void); touch(now?: number): void; expired(now?: number): boolean; start(): void; stop(): void }`. The server calls `touch()` for every **non-stream** `/api` request and never for anything else; plan 3's stream route is `kind: 'stream'` in the route table and the dispatch loop skips `touch()` for it — which is the whole §2 fix ("an open stream connection is explicitly not activity"). `IDLE_MS = 15 * 60_000` exported.

- [ ] **Step 1: Write the failing test**

```ts
// test/ui/idle.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IdleMonitor, IDLE_MS } from '../../src/ui/idle.ts';

test('IDLE_MS is fifteen minutes — the number the spec fixes', () => {
  assert.equal(IDLE_MS, 15 * 60_000);
});

test('expired() is false inside the window and true past it, measured from the last touch', () => {
  const monitor = new IdleMonitor(1_000, () => {});
  monitor.touch(0);
  assert.equal(monitor.expired(999), false);
  assert.equal(monitor.expired(1_001), true);
  monitor.touch(1_000);
  assert.equal(monitor.expired(1_999), false);
  assert.equal(monitor.expired(2_001), true);
});

test('start() fires onIdle once real time passes with no touch, and stop() cancels', async () => {
  let fired = 0;
  const monitor = new IdleMonitor(50, () => { fired++; });
  monitor.touch();
  monitor.start();
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(fired, 1);
  monitor.stop();
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/ui/idle.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/ui/idle.ts
/**
 * Ephemerality (spec §2): idle means NO non-stream /api request for fifteen
 * minutes. The caller decides what counts as activity — this class only
 * measures the gap since the last `touch()`. An open stream holding a
 * connection never calls `touch()`, so it cannot hold the server up; the
 * page's visibility-gated heartbeat (GET /api/ping, Task 16) is what keeps a
 * server alive exactly as long as a tab is actually visible.
 */
export const IDLE_MS = 15 * 60_000;

export class IdleMonitor {
  #idleMs: number;
  #onIdle: () => void;
  #lastTouch: number = Date.now();
  #timer: NodeJS.Timeout | null = null;

  constructor(idleMs: number, onIdle: () => void) {
    this.#idleMs = idleMs;
    this.#onIdle = onIdle;
  }

  touch(now: number = Date.now()): void {
    this.#lastTouch = now;
  }

  expired(now: number = Date.now()): boolean {
    return now - this.#lastTouch > this.#idleMs;
  }

  /**
   * Polls rather than re-arming a precise timeout on every touch: touches
   * arrive per request and a heartbeat arrives every minute, so a coarse
   * check every `idleMs / 10` (bounded below at 10ms so tests can use short
   * windows; production's 15-minute window polls every 90s) is exact enough —
   * the server exits within 10% past the idle window, never before it. The
   * timer is unref'd so it can never be the thing keeping the process alive.
   */
  start(): void {
    if (this.#timer) return;
    const interval = Math.max(10, Math.floor(this.#idleMs / 10));
    this.#timer = setInterval(() => {
      if (this.expired()) {
        this.stop();
        this.#onIdle();
      }
    }, interval);
    this.#timer.unref();
  }

  stop(): void {
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }
}
```

- [ ] **Step 4: Run the test and see it pass**

Run: `node --test test/ui/idle.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/idle.ts test/ui/idle.test.ts
git commit -m "feat(ui): idle monitor — non-stream requests only, 15-minute window"
```

---

## Task 4: `git-info.ts` — branch and commit from `.git` as files, worktree-safe

The status strip that renders this is **plan 3's** (§4 Watch). The reader is built and tested here because it is a pure read, because plan 3 must consume a tested interface rather than build one, and because the one way to get it wrong — assuming `.git` is a directory — breaks in the exact environment this repository is developed in (worktrees, where `.git` is a file containing `gitdir: …`).

**Files:**
- Create: `src/ui/git-info.ts`
- Test: `test/ui/git-info.test.ts`

**Interfaces:**
- Consumes: `node:fs`, `node:path`.
- Produces (plan 3 consumes this exactly):

```ts
export interface GitInfo {
  /** null when HEAD is detached. */
  branch: string | null;
  /** Full hex hash, or null when it cannot be resolved from files. */
  commit: string | null;
  /**
   * Spec §4 fixes the vocabulary: no ahead/behind counts, because those need
   * a revision walk and this reader only reads files.
   */
  upstream: 'in-sync' | 'differs' | 'no-upstream';
  detached: boolean;
}
export function readGitInfo(repoRoot: string): GitInfo | null; // null: not a git repo
```

Also exposed over HTTP in this plan as part of `GET /api/meta` (Task 13) so plan 3's strip is a pure rendering task.

- [ ] **Step 1: Write the failing test**

```ts
// test/ui/git-info.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readGitInfo } from '../../src/ui/git-info.ts';

const HASH = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);

function repo(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-git-'));
}

/** A normal repository: .git is a directory, the ref is loose. */
function normalRepo(root: string, opts: { upstreamHash?: string | null } = {}): void {
  const git = path.join(root, '.git');
  mkdirSync(path.join(git, 'refs', 'heads'), { recursive: true });
  writeFileSync(path.join(git, 'HEAD'), 'ref: refs/heads/main\n');
  writeFileSync(path.join(git, 'refs', 'heads', 'main'), `${HASH}\n`);
  if (opts.upstreamHash !== undefined && opts.upstreamHash !== null) {
    mkdirSync(path.join(git, 'refs', 'remotes', 'origin'), { recursive: true });
    writeFileSync(path.join(git, 'refs', 'remotes', 'origin', 'main'), `${opts.upstreamHash}\n`);
  }
}

test('a repository with a loose ref and a matching upstream: in-sync', () => {
  const root = repo();
  try {
    normalRepo(root, { upstreamHash: HASH });
    assert.deepEqual(readGitInfo(root), {
      branch: 'main', commit: HASH, upstream: 'in-sync', detached: false,
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('an upstream at a different commit: differs', () => {
  const root = repo();
  try {
    normalRepo(root, { upstreamHash: OTHER });
    assert.equal(readGitInfo(root)?.upstream, 'differs');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('no remote ref at all: no-upstream', () => {
  const root = repo();
  try {
    normalRepo(root);
    assert.equal(readGitInfo(root)?.upstream, 'no-upstream');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a packed ref resolves when the loose file is absent, for both branch and upstream', () => {
  const root = repo();
  try {
    const git = path.join(root, '.git');
    mkdirSync(git, { recursive: true });
    writeFileSync(path.join(git, 'HEAD'), 'ref: refs/heads/main\n');
    writeFileSync(path.join(git, 'packed-refs'),
      '# pack-refs with: peeled fully-peeled sorted \n' +
      `${HASH} refs/heads/main\n` +
      `${HASH} refs/remotes/origin/main\n`);
    assert.deepEqual(readGitInfo(root), {
      branch: 'main', commit: HASH, upstream: 'in-sync', detached: false,
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a WORKTREE: .git is a FILE containing gitdir, refs live in the commondir', () => {
  const root = repo();
  try {
    // Layout: <root>/main-repo/.git (real), <root>/wt (worktree checkout).
    const mainGit = path.join(root, 'main-repo', '.git');
    const wtGitDir = path.join(mainGit, 'worktrees', 'wt');
    mkdirSync(path.join(mainGit, 'refs', 'heads'), { recursive: true });
    mkdirSync(wtGitDir, { recursive: true });
    writeFileSync(path.join(mainGit, 'HEAD'), 'ref: refs/heads/main\n');
    writeFileSync(path.join(mainGit, 'refs', 'heads', 'main'), `${OTHER}\n`);
    writeFileSync(path.join(mainGit, 'refs', 'heads', 'feature'), `${HASH}\n`);
    writeFileSync(path.join(wtGitDir, 'HEAD'), 'ref: refs/heads/feature\n');
    writeFileSync(path.join(wtGitDir, 'commondir'), '../..\n');

    const wt = path.join(root, 'wt');
    mkdirSync(wt, { recursive: true });
    writeFileSync(path.join(wt, '.git'), `gitdir: ${wtGitDir}\n`);

    assert.deepEqual(readGitInfo(wt), {
      branch: 'feature', commit: HASH, upstream: 'no-upstream', detached: false,
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a detached HEAD: branch null, the hash is the commit', () => {
  const root = repo();
  try {
    const git = path.join(root, '.git');
    mkdirSync(git, { recursive: true });
    writeFileSync(path.join(git, 'HEAD'), `${HASH}\n`);
    assert.deepEqual(readGitInfo(root), {
      branch: null, commit: HASH, upstream: 'no-upstream', detached: true,
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('not a git repository: null, never a throw', () => {
  const root = repo();
  try {
    assert.equal(readGitInfo(root), null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/ui/git-info.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/ui/git-info.ts
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Branch, commit and upstream state, read from `.git` AS FILES — no shell-out,
 * no `git` binary, no porcelain parsing (spec §4, Watch). The vocabulary is
 * deliberately three-valued: ahead/behind counts need a revision walk, which
 * is not a file read, so 'differs' is as precise as this reader can honestly be.
 *
 * `.git` itself is a DIRECTORY in a normal checkout and a FILE in a worktree
 * (`gitdir: <path>`, absolute or relative to the checkout root). In a
 * worktree the per-worktree gitdir holds HEAD, and a `commondir` file names
 * the shared .git (relative to the gitdir) where refs/ and packed-refs live.
 * This repository is developed in worktrees, so the file shape is the one
 * this function will meet first.
 */
export interface GitInfo {
  branch: string | null;
  commit: string | null;
  upstream: 'in-sync' | 'differs' | 'no-upstream';
  detached: boolean;
}

function readText(file: string): string | null {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/** The per-checkout git directory: `.git` as a directory, or resolved through `.git` the file. */
function resolveGitDir(repoRoot: string): string | null {
  const dotGit = path.join(repoRoot, '.git');
  let stats;
  try {
    stats = statSync(dotGit);
  } catch {
    return null;
  }
  if (stats.isDirectory()) return dotGit;
  const content = readText(dotGit);
  const match = content?.match(/^gitdir:\s*(.+?)\s*$/m);
  if (!match) return null;
  return path.resolve(repoRoot, match[1]);
}

/** Where refs/ and packed-refs live: the gitdir itself, or the worktree's commondir. */
function resolveCommonDir(gitDir: string): string {
  const common = readText(path.join(gitDir, 'commondir'));
  if (common === null) return gitDir;
  return path.resolve(gitDir, common.trim());
}

const HASH_RE = /^[0-9a-f]{40,64}$/; // sha1 or sha256 repositories

/** A loose ref file, else the packed-refs line for `ref`, else null. */
function resolveRef(commonDir: string, ref: string): string | null {
  const loose = readText(path.join(commonDir, ...ref.split('/')));
  if (loose !== null) {
    const hash = loose.trim();
    return HASH_RE.test(hash) ? hash : null;
  }
  const packed = readText(path.join(commonDir, 'packed-refs'));
  if (packed === null) return null;
  for (const line of packed.split('\n')) {
    if (line.startsWith('#') || line.startsWith('^')) continue;
    const [hash, name] = line.trim().split(/\s+/);
    if (name === ref && hash !== undefined && HASH_RE.test(hash)) return hash;
  }
  return null;
}

export function readGitInfo(repoRoot: string): GitInfo | null {
  const gitDir = resolveGitDir(repoRoot);
  if (gitDir === null) return null;
  const head = readText(path.join(gitDir, 'HEAD'));
  if (head === null) return null;

  const refMatch = head.match(/^ref:\s*refs\/heads\/(.+?)\s*$/m);
  if (!refMatch) {
    const hash = head.trim();
    return {
      branch: null,
      commit: HASH_RE.test(hash) ? hash : null,
      upstream: 'no-upstream',
      detached: true,
    };
  }

  const branch = refMatch[1];
  const commonDir = resolveCommonDir(gitDir);
  const commit = resolveRef(commonDir, `refs/heads/${branch}`);
  // Spec §4 names the comparison target in its own words: "differs from
  // `origin/<branch>`". The remote name is fixed to `origin` because reading
  // the branch's real remote needs `.git/config` INI parsing — a fourth file
  // format for a decoration — and the strip's own label (plan 3) names
  // origin/<branch> explicitly, so what is compared is what is claimed.
  const upstreamTip = resolveRef(commonDir, `refs/remotes/origin/${branch}`);
  const upstream: GitInfo['upstream'] =
    upstreamTip === null ? 'no-upstream'
    : upstreamTip === commit ? 'in-sync'
    : 'differs';
  return { branch, commit, upstream, detached: false };
}
```

- [ ] **Step 4: Run the test and see it pass**

Run: `node --test test/ui/git-info.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Also run it against THIS repository by hand (a worktree), as a smoke check**

Run: `node -e "import('./src/ui/git-info.ts').then(m => console.log(m.readGitInfo(process.cwd())))"`
Expected: an object with the current branch name — not null, not a throw. (Not a committed test: it depends on the developer's checkout shape. The committed worktree test above is the pinned behaviour.)

- [ ] **Step 6: Commit**

```bash
git add src/ui/git-info.ts test/ui/git-info.test.ts
git commit -m "feat(ui): read branch/commit/upstream from .git as files, worktree-safe"
```

---

## Task 5: Export `itemCost` from `select.ts`

The budget simulator must show per-item cost. The cost rule is `itemCost` (`src/core/select.ts:77-79`), currently private. Spec §3's instruction for `isNormative` — "either call `injection()`, which already encapsulates it, or export it — but not both, and never neither" — is the governing logic: the UI must not copy the one-line body, so the function is exported.

**Files:**
- Modify: `src/core/select.ts:77` (add `export` to `itemCost`; update its comment)
- Test: extend `test/ui/read-model.test.ts`? No — this precedes read-model. Test: `test/core/select-itemcost.test.ts`

**Interfaces:**
- Consumes: existing `estimateTokens`, `renderItemBlock`.
- Produces: `itemCost(item: Item): number` — exported from `src/core/select.ts`. The number is the exact figure `select()` budgets with (rendered block + separator), so a UI bar built from it can never disagree with the selector.

- [ ] **Step 1: Write the failing test**

```ts
// test/core/select-itemcost.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemCost, estimateTokens, select } from '../../src/core/select.ts';
import { renderItemBlock } from '../../src/core/render-item.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Item } from '../../src/core/types.ts';

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: 'RULE-example', type: 'rule', title: 'Example', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'Body text.', observations: [], relations: [],
    layer: 'project', filePath: 'items/RULE-example.md',
    ...overrides,
  };
}

test('itemCost is the rendered block plus the block separator — the figure select budgets with', () => {
  const i = item();
  assert.equal(itemCost(i), estimateTokens(renderItemBlock(i)) + estimateTokens('\n\n'));
});

test('an item spills exactly when itemCost says it cannot fit', () => {
  const i = item({ always: true });
  const config = resolveConfig({ budgets: { pinned: itemCost(i) - 1 } });
  const sel = select([i], { event: 'session-start' }, config);
  assert.equal(sel.full.length, 0);
  assert.equal(sel.spilled.some((s) => s.id === i.id), true);

  const roomy = resolveConfig({ budgets: { pinned: itemCost(i) } });
  const sel2 = select([i], { event: 'session-start' }, roomy);
  assert.equal(sel2.full.length, 1);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/core/select-itemcost.test.ts`
Expected: FAIL — `itemCost` is not exported.

- [ ] **Step 3: Implement — the whole diff**

In `src/core/select.ts`, change line 77's `function itemCost(` to `export function itemCost(` and extend the comment above it with one sentence: `Exported for the UI's budget simulator (web-ui plan 1), which must show the same per-item figure select budgets with rather than re-deriving one.`

- [ ] **Step 4: Run the test and the full suite**

Run: `node --test test/core/select-itemcost.test.ts && npm test && npx tsc --noEmit`
Expected: PASS, suite green, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/core/select.ts test/core/select-itemcost.test.ts
git commit -m "feat(select): export itemCost so the UI cannot re-derive the cost rule"
```

---

## Task 6: Extract read-only revision-log reading into `src/core/revision-log.ts`

**Why (read this before objecting to the refactor):** the status screen must show the pending-revisions line (spec §4, *Report*). Its count lives behind `readLog`/`foldLog` in `src/core/revision.ts` — and `revision.ts` imports `updateItem` from `mutate.ts` at runtime (`src/core/revision.ts:5-8`), so any server module importing anything from `revision.ts` puts `updateItem` inside the server's import graph and Task 14's test rightly fails. The read half moves to a module with no mutating import; `revision.ts` imports it back so every existing caller is untouched. Plan 2's review-queue screen consumes this module too (and anything it needs beyond counts — decorated revisions, staleness — is plan 2's problem to solve on this same boundary, stated here so plan 2 does not import `revision.ts` from the server either).

**Files:**
- Create: `src/core/revision-log.ts`
- Modify: `src/core/revision.ts` (delete the moved code; import it from the new module; keep re-exports)
- Test: `test/core/revision-log.test.ts`

**Interfaces:**
- Consumes: `node:fs`, `node:path` (whatever the moved code already used — nothing else).
- Produces (server and plan 2 import from `src/core/revision-log.ts`; existing callers keep importing from `revision.ts`, which re-exports):
  - `REVISION_PROTOCOL: string`
  - `revisionDir(root: string): string`, `revisionLogPath(root: string): string`
  - `readLog(root: string): LogLine[]` — exactly the shipped behaviour (`revision.ts:480`): ENOENT → `[]`, unreadable → throw, damaged non-final line → throw, torn final line tolerated.
  - `foldLog(lines: LogLine[])` — moved as-is, exported.
  - `pendingRevisionSummaries(root: string): { revisionId: string; itemId: string }[]` — new thin composition: `foldLog(readLog(root))` filtered to `state === 'pending'` (the same filter `pendingRevisions` applies at `revision.ts:675-676`), WITHOUT the store-touching decoration.
  - `pendingRevisionCounts(revs: { itemId: string }[]): { revisions: number; items: number }` — moved; parameter widened from `PendingRevision[]` to the two fields it actually reads (`revision.ts:703-707`), so undecorated summaries and decorated revisions both satisfy it.

- [ ] **Step 1: Establish the move set by executing, then write the failing test**

The exact helper set `foldLog` needs was not enumerated when this plan was written. Establish it: open `src/core/revision.ts`, find `foldLog`, and list every function/constant/type it and `readLog` reference that is not already in the move list (`REVISION_PROTOCOL`, `LogLine`, `lastRowIndex`, `revisionDir`, `revisionLogPath`). Anything in that closure that touches `mutate.ts`, the `Store`, or the filesystem beyond reading the log stays behind — if such a dependency exists, split at the boundary above it and record what stayed in the module docstring. Then write:

```ts
// test/core/revision-log.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  pendingRevisionSummaries, pendingRevisionCounts, revisionLogPath,
} from '../../src/core/revision-log.ts';

test('revision-log.ts imports nothing from mutate.ts or revision.ts — the reason it exists', () => {
  const source = readFileSync(
    path.join(import.meta.dirname, '..', '..', 'src', 'core', 'revision-log.ts'), 'utf8');
  assert.doesNotMatch(source, /from '\.\/mutate\.ts'/);
  assert.doesNotMatch(source, /from '\.\/revision\.ts'/);
});

test('an absent log means no pending revisions; a staged line means one; a discard settles it', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-revlog-'));
  try {
    assert.deepEqual(pendingRevisionSummaries(root), []);

    // Write log lines in the shipped shape. Establish the exact line shape by
    // reading `appendLine` and `stageRevision`'s appended record in
    // revision.ts during implementation, and use THAT shape here — the test
    // must stage through the same serialization the product writes. If the
    // shape cannot be reproduced by hand safely, stage through the real
    // `stageRevision` in a scratch workspace instead and copy the log file.
    mkdirSync(path.dirname(revisionLogPath(root)), { recursive: true });
    // <lines written per the establish-by-executing note above>
    // After one staged revision on item RULE-x:
    //   assert.equal(pendingRevisionSummaries(root).length, 1);
    // After appending its discard line:
    //   assert.deepEqual(pendingRevisionSummaries(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('pendingRevisionCounts counts revisions and distinct items', () => {
  assert.deepEqual(
    pendingRevisionCounts([{ itemId: 'A' }, { itemId: 'A' }, { itemId: 'B' }]),
    { revisions: 3, items: 2 },
  );
});
```

The second test's commented assertions are not placeholders to skip — they are the assertions to write once the line shape has been read out of `stageRevision`; the test is not done until both fire against real serialized lines.

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/core/revision-log.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Move the code**

Create `src/core/revision-log.ts` with a module docstring:

```ts
// src/core/revision-log.ts
/**
 * Read-only access to the staged-revision log — extracted from revision.ts
 * (web-ui plan 1, Task 6) so that a read-only surface can count and list
 * pending revisions WITHOUT importing revision.ts, which imports updateItem
 * from mutate.ts at runtime. The UI server's no-writes test (test/ui/
 * no-writes.test.ts) bans mutate.ts and revision.ts from its import graph;
 * this module is what makes that ban compatible with reporting the queue.
 *
 * Everything here is moved verbatim from revision.ts; behaviour changes are
 * none, and revision.ts re-imports these symbols so its callers are untouched.
 */
```

Then: cut `REVISION_PROTOCOL`, the `LogLine` type, `revisionDir`, `revisionLogPath`, `lastRowIndex`, `readLog`, `foldLog` (plus the closure established in Step 1) and `pendingRevisionCounts` out of `revision.ts` and paste them here unchanged, except:

- `pendingRevisionCounts(revs: PendingRevision[])` becomes `pendingRevisionCounts(revs: { itemId: string }[])` — same body.
- Add the new composition:

```ts
/** The pending queue as (revisionId, itemId) — no store, no staleness decoration. */
export function pendingRevisionSummaries(root: string): { revisionId: string; itemId: string }[] {
  return foldLog(readLog(root))
    .filter((r) => r.state === 'pending')
    .map((r) => ({ revisionId: r.revisionId, itemId: r.itemId }));
}
```

In `src/core/revision.ts`, replace the moved definitions with:

```ts
import {
  foldLog, lastRowIndex, pendingRevisionCounts, readLog, revisionDir, revisionLogPath,
  REVISION_PROTOCOL, type LogLine,
} from './revision-log.ts';
export {
  foldLog, pendingRevisionCounts, readLog, revisionDir, revisionLogPath, REVISION_PROTOCOL,
};
export type { LogLine };
```

(Adjust the exact import/export list to the closure Step 1 established; every symbol previously exported from `revision.ts` must still be importable from `revision.ts` — `git grep -n "from './revision.ts'"` and `from '../../core/revision.ts'` enumerate the callers to hold harmless.)

- [ ] **Step 4: Run the new test and the whole suite**

Run: `node --test test/core/revision-log.test.ts && npm test && npx tsc --noEmit`
Expected: all green. The full suite is the proof the move changed nothing.

- [ ] **Step 5: Commit**

```bash
git add src/core/revision-log.ts src/core/revision.ts test/core/revision-log.test.ts
git commit -m "refactor(revision): extract read-only log reading so a no-writes surface can count the queue"
```

---

## Task 7: Ledger read additions — `history()` and `sessionSummaries()`

The decay screen needs injections per item **over time** (spec §4: "the ledger stores `injected_at` per `(session_id, item_id, tier)`… injections per item over time is a real series") and the session picker needs "each session's last injection time" (spec §3). Neither read exists (`ledger.ts` has per-session `entries()` and id-only `recentSessions()`); both are pure reads added beside the existing ones.

**Files:**
- Modify: `src/core/ledger.ts` (two new methods on `Ledger`, two new interfaces)
- Test: `test/core/ledger-reads.test.ts`

**Interfaces:**
- Consumes: the existing `Ledger` and its schema (`ledger.ts:27-38`).
- Produces:
  - `interface InjectionEvent { sessionId: string; itemId: string; tier: LedgerTier; injectedAt: string }` (exported from `ledger.ts`)
  - `Ledger.history(): InjectionEvent[]` — every row, ordered `injected_at, session_id, item_id` (total and repeatable).
  - `interface SessionSummary { sessionId: string; lastInjectedAt: string; itemCount: number }`
  - `Ledger.sessionSummaries(limit: number): SessionSummary[]` — same ordering contract as `recentSessions` (`MAX(injected_at) DESC, session_id DESC`, `ledger.ts:229-239`), so `sessionSummaries(n).map(s => s.sessionId)` equals `recentSessions(n)` — asserted, so the picker and the default can never disagree.

- [ ] **Step 1: Write the failing test**

```ts
// test/core/ledger-reads.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Ledger } from '../../src/core/ledger.ts';
import { Store } from '../../src/core/store.ts';

function open(): { ledger: Ledger; dir: string; close: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ledger-'));
  const dbPath = path.join(dir, '.index.db');
  const store = Store.open(dbPath); // Ledger.open relies on Store.open first (ledger.ts:48-63)
  const ledger = Ledger.open(dbPath);
  return { ledger, dir, close: () => { ledger.close(); store.close(); } };
}

test('history() returns every row in a total, repeatable order', () => {
  const { ledger, dir, close } = open();
  try {
    ledger.record('s1', 'RULE-a', 'pinned', '2026-08-01T10:00:00.000Z');
    ledger.record('s2', 'RULE-a', 'jit', '2026-08-02T10:00:00.000Z');
    ledger.record('s1', 'RULE-b', 'jit', '2026-08-01T11:00:00.000Z');
    assert.deepEqual(ledger.history(), [
      { sessionId: 's1', itemId: 'RULE-a', tier: 'pinned', injectedAt: '2026-08-01T10:00:00.000Z' },
      { sessionId: 's1', itemId: 'RULE-b', tier: 'jit', injectedAt: '2026-08-01T11:00:00.000Z' },
      { sessionId: 's2', itemId: 'RULE-a', tier: 'jit', injectedAt: '2026-08-02T10:00:00.000Z' },
    ]);
  } finally { close(); rmSync(dir, { recursive: true, force: true }); }
});

test('sessionSummaries agrees with recentSessions on order, and carries last time and item count', () => {
  const { ledger, dir, close } = open();
  try {
    ledger.record('s1', 'RULE-a', 'pinned', '2026-08-01T10:00:00.000Z');
    ledger.record('s1', 'RULE-b', 'jit', '2026-08-01T11:00:00.000Z');
    ledger.record('s2', 'RULE-a', 'jit', '2026-08-02T10:00:00.000Z');
    const summaries = ledger.sessionSummaries(20);
    assert.deepEqual(summaries.map((s) => s.sessionId), ledger.recentSessions(20));
    assert.deepEqual(summaries, [
      { sessionId: 's2', lastInjectedAt: '2026-08-02T10:00:00.000Z', itemCount: 1 },
      { sessionId: 's1', lastInjectedAt: '2026-08-01T11:00:00.000Z', itemCount: 2 },
    ]);
  } finally { close(); rmSync(dir, { recursive: true, force: true }); }
});

test('sessionSummaries(0) and an empty ledger both answer []', () => {
  const { ledger, dir, close } = open();
  try {
    assert.deepEqual(ledger.sessionSummaries(0), []);
    assert.deepEqual(ledger.sessionSummaries(5), []);
    assert.deepEqual(ledger.history(), []);
  } finally { close(); rmSync(dir, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/core/ledger-reads.test.ts`
Expected: FAIL — `ledger.history is not a function`.

- [ ] **Step 3: Implement — added to `ledger.ts` beside the existing reads**

Top-level, beside `LedgerEntry`:

```ts
export interface InjectionEvent {
  sessionId: string;
  itemId: string;
  tier: LedgerTier;
  injectedAt: string;
}

export interface SessionSummary {
  sessionId: string;
  lastInjectedAt: string;
  itemCount: number;
}
```

On the `Ledger` class, beside `recentSessions` (`:229`):

```ts
  /**
   * Every recorded injection, ordered (injected_at, session_id, item_id) so
   * the series is total and repeatable. This is the decay chart's raw data
   * (web-ui plan 1); the ledger records INJECTION, not use — every consumer
   * inherits that caveat.
   */
  history(): InjectionEvent[] {
    const rows = this.#db.prepare(`
      SELECT session_id, item_id, tier, injected_at
      FROM ledger
      ORDER BY injected_at, session_id, item_id
    `).all() as { session_id: string; item_id: string; tier: string; injected_at: string }[];
    return rows.map((r) => ({
      sessionId: r.session_id, itemId: r.item_id,
      tier: r.tier as LedgerTier, injectedAt: r.injected_at,
    }));
  }

  /**
   * `recentSessions`, with the two fields the UI's session picker shows.
   * SAME ordering clause as recentSessions — the test pins the agreement,
   * so the picker's list and the default session can never disagree.
   */
  sessionSummaries(limit: number): SessionSummary[] {
    if (limit <= 0) return [];
    const rows = this.#db.prepare(`
      SELECT session_id, MAX(injected_at) AS last, COUNT(DISTINCT item_id) AS n
      FROM ledger
      GROUP BY session_id
      ORDER BY MAX(injected_at) DESC, session_id DESC
      LIMIT ?
    `).all(limit) as { session_id: string; last: string; n: number }[];
    return rows.map((r) => ({
      sessionId: r.session_id, lastInjectedAt: r.last, itemCount: Number(r.n),
    }));
  }
```

- [ ] **Step 4: Run the test and the full suite**

Run: `node --test test/core/ledger-reads.test.ts && npm test && npx tsc --noEmit`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/core/ledger.ts test/core/ledger-reads.test.ts
git commit -m "feat(ledger): history() and sessionSummaries() read methods for the UI"
```

---

## Task 8: `routes.ts`, and the select/render/simulate read model

**Files:**
- Create: `src/ui/routes.ts`
- Create: `src/ui/read-model.ts`
- Test: `test/ui/read-model.test.ts`

**Interfaces:**
- Consumes: `select`, `itemCost` (Task 5), `renderSelection`, `Store`, `Ledger`, `Workspace`.
- Produces — **the route extension surface plans 2 and 3 build against**:

```ts
// src/ui/routes.ts
export interface ApiContext {
  ws: Workspace;
  repoRoot: string;
  url: URL;                          // parsed request URL
  params: Record<string, string>;    // :name segments from the route path
  body: unknown;                     // parsed JSON body on POST, else undefined
}
export interface JsonResult { status: number; body: unknown }
export type RouteHandler =
  | { kind: 'json'; handle(ctx: ApiContext): JsonResult | Promise<JsonResult> }
  | { kind: 'stream'; handle(ctx: ApiContext, res: ServerResponse): void };
export function registerRoute(method: 'GET' | 'POST', path: string, handler: RouteHandler): void;
export function matchRoute(method: string, pathname: string):
  { handler: RouteHandler; params: Record<string, string> } | null;
```

Notes fixed here, binding on all three plans: a `path` is literal segments plus `:name` parameters (`/api/item/:id`); registering a duplicate `(method, path)` throws (nothing is silently replaced); **`kind: 'stream'` exists for plan 3's audit stream and is deliberately unused in this plan** — the server dispatch (Task 13) skips the idle `touch()` for stream routes, which is how §2's "an open stream is not activity" is implemented before the stream exists; **every handler, theirs included, sits behind the Task 2 security gate — registering a route can never bypass it.**

- Produces — read-model functions (each pure of HTTP, testable directly):

```ts
// src/ui/read-model.ts
export function apiSelect(ws: Workspace, url: URL): JsonResult;    // GET /api/select
export function apiRender(ws: Workspace, url: URL): JsonResult;    // GET /api/render
export function apiSimulate(ws: Workspace, url: URL): JsonResult;  // GET /api/simulate
```

Query grammar (shared by the three, refused loudly on violation):
- `event` required: `session-start | compact | tool | manual`.
- `path` required iff `event=tool` (select ignores it otherwise — accepting it there would be accepted-and-ignored).
- exactly one of `session=<id>` or `cold=1`. `session` → `seen: seenIds(readSeen(ws.projectRoot, session))` exactly as the hook does (`hooks/pre-tool-use.ts` · `const seenState = readSeen(ws.projectRoot, dedupeKey);` · ~183). **NOT `ledger.seen(session)`** — §0 records why: the Ledger left that path entirely, and what remains is a replayed projection nothing in the UI updates. An unreadable seen file is a **disclosed** state, never an empty one.
- `focus`: the endpoint reads `readFocus(ws.projectRoot).focus` and passes it, and the response carries `Selection.focus`. `focus=off` passes `null` and is labelled as a different question, exactly as `cold=1` is. **Omitting it previews a different selection and a different spill set** — §0's first row.
- `cold=1` → no `seen`, and it is the caller's job to label it (the strings table already carries `session.cold`).
- `restore=<comma-separated ids>` allowed iff `event=compact` (spec §3: "`compact` additionally takes `restore`").
- `/api/simulate` additionally accepts `pinned`, `jit`, `restored`, `index` (non-negative integers) overriding `config.budgets`.
- any other parameter → `400` naming the parameter (INV-nothing-is-dropped-silently).

Response shapes:
- `/api/select` → the JSON serialization of `select(store.all(), ctx, config)` and **nothing else** — the §6 parity test depends on it. (`store.all()` rather than `activeInjectable`: the prefilter is a perf superset, documented at `select.ts:96-100`; `select` applies the real rules itself, and the index summary needs the unfiltered set.)
- `/api/render` → `{ text: renderSelection(selection) }` — the literal bytes a hook would inject.
- `/api/simulate` → `{ selection, budgets, costs }` where `costs: { id: string; tokens: number }[]` has one entry per id in `selection.full` ∪ `selection.spilled`, each `itemCost(item)` (Task 5).

- [ ] **Step 1: Write the failing tests**

```ts
// test/ui/read-model.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { Store } from '../../src/core/store.ts';
import { Ledger } from '../../src/core/ledger.ts';
import { select } from '../../src/core/select.ts';
import { apiSelect, apiRender, apiSimulate } from '../../src/ui/read-model.ts';
import { registerRoute, matchRoute } from '../../src/ui/routes.ts';

/** A real workspace with real items, built through the real CLI. */
function workspace(): { dir: string; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ui-'));
  runCli(['init'], dir, () => {});
  runCli(['add', 'rule', 'Always use POSIX paths', '--scope', 'src/**', '--body', 'Use POSIX.'], dir, () => {});
  runCli(['add', 'rule', 'Pin me', '--always', '--body', 'Pinned body.'], dir, () => {});
  runCli(['add', 'decision', 'We chose sqlite', '--body', 'Rationale body.'], dir, () => {});
  return { dir, done: () => rmSync(dir, { recursive: true, force: true }) };
}

function url(qs: string): URL {
  return new URL(`http://127.0.0.1:1/api/select?${qs}`);
}

test('/api/select equals select() as JSON, for a matrix of events, paths and seen sets', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const store = Store.open(ws.dbPath);
    const ledger = Ledger.open(ws.dbPath);
    const items = store.all();

    const matrix: { qs: string; ctx: Parameters<typeof select>[1] }[] = [
      { qs: 'event=session-start&cold=1', ctx: { event: 'session-start' } },
      { qs: 'event=manual&cold=1', ctx: { event: 'manual' } },
      { qs: 'event=tool&path=src/a.ts&cold=1', ctx: { event: 'tool', path: 'src/a.ts' } },
    ];
    for (const { qs, ctx } of matrix) {
      const result = apiSelect(ws, url(qs));
      assert.equal(result.status, 200, qs);
      assert.deepEqual(
        JSON.parse(JSON.stringify(result.body)),
        JSON.parse(JSON.stringify(select(items, ctx, ws.config))),
        qs,
      );
    }

    // The seen case, via a real seen-file append — the endpoint must pass
    // seenIds(readSeen(root, key)) exactly as the hook does. A ledger row would
    // NOT do: the Ledger is a replayed projection and is not what the hook reads.
    const ruleId = items.find((i) => i.title === 'Always use POSIX paths')!.id;
    ledger.record('sess-1', ruleId, 'jit');
    const seenResult = apiSelect(ws, url('event=tool&path=src/a.ts&session=sess-1'));
    assert.deepEqual(
      JSON.parse(JSON.stringify(seenResult.body)),
      JSON.parse(JSON.stringify(
        select(items, { event: 'tool', path: 'src/a.ts',
                        seen: seenIds(readSeen(ws.projectRoot, 'sess-1')),
                        focus: readFocus(ws.projectRoot).focus }, ws.config),
      )),
    );
    // And it differs from the cold answer — the correction §3 exists for.
    assert.notDeepEqual(
      JSON.parse(JSON.stringify(seenResult.body)),
      JSON.parse(JSON.stringify(apiSelect(ws, url('event=tool&path=src/a.ts&cold=1')).body)),
    );

    ledger.close();
    store.close();
  } finally { done(); }
});

test('unknown, missing and contradictory parameters are refused, never dropped', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    for (const bad of [
      'event=tool&path=x&cold=1&sesion=typo',       // unknown param
      'event=nope&cold=1',                           // bad event
      'event=tool&cold=1',                           // tool without path
      'event=session-start&path=x&cold=1',           // path outside tool
      'event=session-start',                         // neither session nor cold
      'event=session-start&session=s&cold=1',        // both
      'event=tool&path=x&cold=1&restore=RULE-a',     // restore outside compact
    ]) {
      const result = apiSelect(ws, url(bad));
      assert.equal(result.status, 400, bad);
      assert.ok(typeof (result.body as { error?: string }).error === 'string', bad);
    }
  } finally { done(); }
});

test('/api/render returns the rendered selection text', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const result = apiRender(ws, new URL('http://x/api/render?event=session-start&cold=1'));
    assert.equal(result.status, 200);
    const text = (result.body as { text: string }).text;
    assert.match(text, /Pin me/); // the pinned rule's block is in the injected text
  } finally { done(); }
});

test('/api/simulate applies budget overrides and prices every full and spilled id', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const tight = apiSimulate(ws, new URL('http://x/api/simulate?event=session-start&cold=1&pinned=1'));
    assert.equal(tight.status, 200);
    const body = tight.body as {
      selection: { full: unknown[]; spilled: { id: string }[] };
      budgets: { pinned: number };
      costs: { id: string; tokens: number }[];
    };
    assert.equal(body.budgets.pinned, 1);
    assert.equal(body.selection.full.length, 0); // nothing fits a 1-token pinned budget
    assert.ok(body.selection.spilled.length >= 1);
    const priced = new Set(body.costs.map((c) => c.id));
    for (const s of body.selection.spilled) assert.ok(priced.has(s.id));
    for (const c of body.costs) assert.ok(Number.isInteger(c.tokens) && c.tokens > 0);
  } finally { done(); }
});

test('registerRoute refuses a duplicate and matchRoute extracts :params', () => {
  registerRoute('GET', '/api/test-dup/:id', { kind: 'json', handle: () => ({ status: 200, body: {} }) });
  assert.throws(() =>
    registerRoute('GET', '/api/test-dup/:id', { kind: 'json', handle: () => ({ status: 200, body: {} }) }));
  const match = matchRoute('GET', '/api/test-dup/RULE-x');
  assert.ok(match);
  assert.deepEqual(match?.params, { id: 'RULE-x' });
  assert.equal(matchRoute('POST', '/api/test-dup/RULE-x'), null);
});
```

Non-vacuity note on the seen-differs assertion: if, when run, the seen body does NOT differ from the cold body (budgets roomy enough that removing the seen item changes `full` without changing `spilled`, and `full` differs anyway — then it does differ; the only way they can coincide is an empty selection both ways), the fixture is too thin: add a fourth `runCli(['add', 'rule', …, '--scope', 'src/**'])` item with a long body so the seen set demonstrably changes the outcome. The committed test must contain a passing, non-vacuous inequality — verify by commenting out the `ledger.record` line and watching `notDeepEqual` fail, then restore it.

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/ui/read-model.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `routes.ts`**

```ts
// src/ui/routes.ts
import type { ServerResponse } from 'node:http';
import type { Workspace } from '../core/workspace.ts';

/**
 * The route table — the ONE extension point. Plans 2 and 3 add routes by
 * calling registerRoute from their own modules (imported by server.ts); they
 * never touch the dispatch loop, and NOTHING a route registers can bypass
 * the security gate, which runs before dispatch (server.ts).
 *
 * `kind: 'stream'` exists for plan 3's audit stream. This plan registers no
 * stream route; the dispatch loop already treats stream routes as NOT
 * activity for the idle monitor (spec §2: an open stream never resets the
 * timer), so plan 3 inherits the ephemerality rule instead of remembering it.
 */
export interface ApiContext {
  ws: Workspace;
  repoRoot: string;
  url: URL;
  params: Record<string, string>;
  body: unknown;
}

export interface JsonResult { status: number; body: unknown }

export type RouteHandler =
  | { kind: 'json'; handle(ctx: ApiContext): JsonResult | Promise<JsonResult> }
  | { kind: 'stream'; handle(ctx: ApiContext, res: ServerResponse): void };

interface Route { method: string; segments: string[]; handler: RouteHandler }

const routes: Route[] = [];

export function registerRoute(method: 'GET' | 'POST', path: string, handler: RouteHandler): void {
  const segments = path.split('/').filter((s) => s !== '');
  const duplicate = routes.some((r) =>
    r.method === method && r.segments.length === segments.length &&
    r.segments.every((s, i) => s === segments[i]));
  if (duplicate) {
    throw new Error(`mycontext ui: route ${method} ${path} is already registered.`);
  }
  routes.push({ method, segments, handler });
}

export function matchRoute(method: string, pathname: string):
  { handler: RouteHandler; params: Record<string, string> } | null {
  const parts = pathname.split('/').filter((s) => s !== '');
  for (const route of routes) {
    if (route.method !== method || route.segments.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < parts.length; i++) {
      const seg = route.segments[i];
      if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(parts[i]);
      else if (seg !== parts[i]) { ok = false; break; }
    }
    if (ok) return { handler: route.handler, params };
  }
  return null;
}
```

- [ ] **Step 4: Implement the shared plumbing and the three handlers in `read-model.ts`**

```ts
// src/ui/read-model.ts
import { Ledger } from '../core/ledger.ts';
import { renderSelection } from '../core/render.ts';
import {
  itemCost, select, type SelectContext, type SelectEvent, type Selection,
} from '../core/select.ts';
import { Store } from '../core/store.ts';
import type { Config } from '../core/config.ts';
import type { Item } from '../core/types.ts';
import type { Workspace } from '../core/workspace.ts';
import type { JsonResult } from './routes.ts';

/**
 * Every /api read handler, as a pure function of (workspace, url) — no HTTP
 * types, so each is testable by calling it. Composition only: the rules are
 * select, matchesScope, isEligible, injection, scopePolicyFor, estimateTokens,
 * Ledger reads (spec §3's table). An endpoint here MAY NOT reimplement one.
 *
 * The server never rebuilds: the hook reads the store as-is
 * (pre-tool-use.ts:129-138), and "see exactly what Claude gets" means reading
 * exactly what the hook reads. Staleness is doctor's index_stale finding,
 * surfaced by the status screen — never silently repaired here.
 */

export const badRequest = (error: string): JsonResult => ({ status: 400, body: { error } });

/** Refuse any query parameter this endpoint does not act on. */
export function unknownParams(url: URL, allowed: string[]): string | null {
  for (const key of url.searchParams.keys()) {
    if (!allowed.includes(key)) {
      return `unknown parameter "${key}" — this endpoint accepts: ${allowed.join(', ')}. ` +
        'A parameter accepted and ignored would silently answer a different question.';
    }
  }
  return null;
}

/** Store FIRST, then Ledger — Ledger.open depends on it (ledger.ts:48-63). */
export function withStores<T>(ws: Workspace, fn: (store: Store, ledger: Ledger) => T): T {
  const store = Store.open(ws.dbPath);
  let ledger: Ledger | null = null;
  try {
    ledger = Ledger.open(ws.dbPath);
    return fn(store, ledger);
  } finally {
    try { ledger?.close(); } catch { /* already closed */ }
    try { store.close(); } catch { /* already closed */ }
  }
}

const SELECT_EVENTS: SelectEvent[] = ['session-start', 'compact', 'tool', 'manual'];

/** The shared grammar of /api/select, /api/render and /api/simulate. */
function parseSelectQuery(
  ws: Workspace, url: URL, extraAllowed: string[] = [],
): { ctx: SelectContext } | { error: string } {
  const bad = unknownParams(url, ['event', 'path', 'session', 'cold', 'restore', ...extraAllowed]);
  if (bad) return { error: bad };

  const event = url.searchParams.get('event');
  if (event === null || !SELECT_EVENTS.includes(event as SelectEvent)) {
    return { error: `event must be one of ${SELECT_EVENTS.join(', ')} (got ${JSON.stringify(event)})` };
  }

  const target = url.searchParams.get('path');
  if (event === 'tool' && (target === null || target === '')) {
    return { error: 'event=tool requires path=<repo-relative file>' };
  }
  if (event !== 'tool' && target !== null) {
    return {
      error: `path is only meaningful with event=tool — select ignores it for ${event}, ` +
        'and this endpoint refuses what it would ignore',
    };
  }

  const session = url.searchParams.get('session');
  const cold = url.searchParams.get('cold');
  if ((session === null) === (cold === null)) {
    return {
      error: 'pass exactly one of session=<id> (this session\'s preview) or cold=1 ' +
        '(a brand-new session\'s answer — a different question, labelled as one)',
    };
  }
  if (cold !== null && cold !== '1') return { error: 'cold takes exactly the value 1' };

  const restoreRaw = url.searchParams.get('restore');
  if (restoreRaw !== null && event !== 'compact') {
    return { error: 'restore is only meaningful with event=compact' };
  }

  const ctx: SelectContext = { event: event as SelectEvent };
  if (event === 'tool') ctx.path = target;
  if (restoreRaw !== null) ctx.restore = restoreRaw.split(',').filter((s) => s !== '');
  if (session !== null) {
    const state = readSeen(ws.projectRoot, session);
    ctx.seen = state.error === null ? seenIds(state) : [];
    // Disclosed, not swallowed: the hook records
    // 'seen file unreadable; injected without dedupe' and so must this.
    if (state.error !== null) ctx.seenUnreadable = true;
  }
  // Focus is the fifth narrowing input. Read it the way the hook does.
  ctx.focus = focusOff ? null : readFocus(ws.projectRoot).focus;
  return { ctx };
}

function runSelect(ws: Workspace, ctx: SelectContext): { items: Item[]; selection: Selection } {
  return withStores(ws, (store) => {
    const items = store.all();
    return { items, selection: select(items, ctx, ws.config) };
  });
}

export function apiSelect(ws: Workspace, url: URL): JsonResult {
  const parsed = parseSelectQuery(ws, url);
  if ('error' in parsed) return badRequest(parsed.error);
  return { status: 200, body: runSelect(ws, parsed.ctx).selection };
}

export function apiRender(ws: Workspace, url: URL): JsonResult {
  const parsed = parseSelectQuery(ws, url);
  if ('error' in parsed) return badRequest(parsed.error);
  return { status: 200, body: { text: renderSelection(runSelect(ws, parsed.ctx).selection) } };
}

const BUDGET_KEYS = ['pinned', 'jit', 'restored', 'index'] as const;

export function apiSimulate(ws: Workspace, url: URL): JsonResult {
  const parsed = parseSelectQuery(ws, url, [...BUDGET_KEYS]);
  if ('error' in parsed) return badRequest(parsed.error);

  const budgets = { ...ws.config.budgets };
  for (const key of BUDGET_KEYS) {
    const raw = url.searchParams.get(key);
    if (raw === null) continue;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) {
      return badRequest(`${key} must be a non-negative integer (got ${JSON.stringify(raw)})`);
    }
    budgets[key] = value;
  }
  const config: Config = { ...ws.config, budgets };

  return withStores(ws, (store) => {
    const items = store.all();
    const selection = select(items, { ...parsed.ctx }, config);
    const byId = new Map(items.map((i) => [i.id, i]));
    const ids = [...new Set([
      ...selection.full.map((e) => e.item.id),
      ...selection.spilled.map((s) => s.id),
    ])];
    const costs = ids.flatMap((id) => {
      const item = byId.get(id);
      return item ? [{ id, tokens: itemCost(item) }] : [];
    });
    return { status: 200, body: { selection, budgets, costs } };
  });
}
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `node --test test/ui/read-model.test.ts && npx tsc --noEmit`
Expected: PASS. Execute the non-vacuity check from Step 1's note (comment out the `ledger.record` line, confirm the `notDeepEqual` fails, restore).

- [ ] **Step 6: Commit**

```bash
git add src/ui/routes.ts src/ui/read-model.ts test/ui/read-model.test.ts
git commit -m "feat(ui): route table and the select/render/simulate read model with select() parity"
```

---

## Task 9: Read model — sessions and current injections

**Files:**
- Modify: `src/ui/read-model.ts`
- Test: extend `test/ui/read-model.test.ts`

**Interfaces:**
- Consumes: `Ledger.sessionSummaries` (Task 7), `Ledger.recentSessions`, `Ledger.entries`, `withStores`.
- Produces:
  - `apiSessions(ws: Workspace, url: URL): JsonResult` — `GET /api/sessions` → `{ default: string | null; sessions: SessionSummary[] }`. `default` is `Ledger.recentSessions(1)[0] ?? null` (spec §3 item 1); `sessions` is `sessionSummaries(20)` (spec §3 item 2). An empty ledger yields `{ default: null, sessions: [] }` and the client shows only the labelled cold option (spec §3 item 4). No parameters accepted.
  - `apiInjected(ws: Workspace, url: URL, params: { session: string }): JsonResult` — `GET /api/session/:session/injected` → `{ entries: (LedgerEntry & { title: string | null })[] }` — the ledger's rows for the session (live state, not a hypothetical — spec §4 Core), each joined to the item's current title, `title: null` when the item no longer exists (never dropped from the list: an injection of a since-deleted item still happened).

- [ ] **Step 1: Write the failing tests** (append to `test/ui/read-model.test.ts`)

```ts
import { apiSessions, apiInjected } from '../../src/ui/read-model.ts';

test('/api/sessions defaults to the most recent session and lists summaries', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const empty = apiSessions(ws, new URL('http://x/api/sessions'));
    assert.deepEqual(empty.body, { default: null, sessions: [] });

    const store = Store.open(ws.dbPath);
    const ledger = Ledger.open(ws.dbPath);
    const anyId = store.all()[0].id;
    ledger.record('s-old', anyId, 'jit', '2026-08-01T10:00:00.000Z');
    ledger.record('s-new', anyId, 'jit', '2026-08-02T10:00:00.000Z');
    const result = apiSessions(ws, new URL('http://x/api/sessions'));
    const body = result.body as { default: string; sessions: { sessionId: string }[] };
    assert.equal(body.default, 's-new');
    assert.deepEqual(body.sessions.map((s) => s.sessionId), ['s-new', 's-old']);
    ledger.close(); store.close();
  } finally { done(); }
});

test('/api/session/:session/injected joins titles and keeps rows for vanished items', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const store = Store.open(ws.dbPath);
    const ledger = Ledger.open(ws.dbPath);
    const item = store.all()[0];
    ledger.record('s1', item.id, 'jit', '2026-08-01T10:00:00.000Z');
    ledger.record('s1', 'RULE-gone', 'jit', '2026-08-01T11:00:00.000Z');
    const result = apiInjected(ws, new URL('http://x/api/session/s1/injected'), { session: 's1' });
    const entries = (result.body as { entries: { itemId: string; title: string | null }[] }).entries;
    assert.equal(entries.length, 2);
    assert.equal(entries.find((e) => e.itemId === item.id)?.title, item.title);
    assert.equal(entries.find((e) => e.itemId === 'RULE-gone')?.title, null);
    ledger.close(); store.close();
  } finally { done(); }
});
```

- [ ] **Step 2: Run and see the new tests fail**

Run: `node --test test/ui/read-model.test.ts`
Expected: the two new tests FAIL (`apiSessions` not exported); the rest pass.

- [ ] **Step 3: Implement** (append to `src/ui/read-model.ts`)

```ts
export function apiSessions(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  return withStores(ws, (_store, ledger) => ({
    status: 200,
    body: {
      default: ledger.recentSessions(1)[0] ?? null,
      sessions: ledger.sessionSummaries(20),
    },
  }));
}

export function apiInjected(
  ws: Workspace, url: URL, params: { session: string },
): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  return withStores(ws, (store, ledger) => {
    const titles = new Map(store.all().map((i) => [i.id, i.title]));
    const entries = ledger.entries(params.session).map((e) => ({
      ...e,
      // null, not dropped: the injection of a since-deleted item still happened.
      title: titles.get(e.itemId) ?? null,
    }));
    return { status: 200, body: { entries } };
  });
}
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `node --test test/ui/read-model.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/read-model.ts test/ui/read-model.test.ts
git commit -m "feat(ui): sessions and current-injections read model"
```

---

## Task 10: Read model — status, doctor, decay

**Files:**
- Modify: `src/ui/read-model.ts`
- Test: extend `test/ui/read-model.test.ts`

**Interfaces:**
- Consumes: `reviewQueue` (`select.ts:247`), `pendingRevisionSummaries`/`pendingRevisionCounts` (Task 6), `runChecks` (`doctor/checks.ts:675`), `computeDecay` (`decay.ts:93`), `Ledger.history` (Task 7), `VERSION` (`core/version.ts`).
- Produces:
  - `apiStatus(ws, url): JsonResult` — `GET /api/status` →

    ```ts
    {
      version: string;
      profile: string;
      items: { total: number; byCategory: Record<string, number>;
               byStatus: Record<string, number>; byOrigin: Record<string, number> };
      reviewQueue: { drafts: number; always: number; globalLayerDrafts: number };
      pendingRevisions: { revisions: number; items: number };
      health: { errors: number; warnings: number; infos: number };
    }
    ```

    Field semantics match `status --json` (`src/cli/commands/status.ts:209-280`): `reviewQueue.drafts` is the **project-layer** queue via core `reviewQueue(items)` — never a raw draft tally — with `globalLayerDrafts` named beside it exactly as `status` names it (`status.ts:163`). `health` is a level tally of `runChecks` findings (a presentation count, not a rule; the rule set is `runChecks` itself). The screen is the recorded §4 exception ("kept because it is the landing screen"), and this endpoint keeps it honest by composing the same functions `status` composes.
  - `apiDoctor(ws, url): JsonResult` — `GET /api/doctor` → `{ findings: Finding[] }`, `runChecks` verbatim, unfiltered, ungrouped — grouping by `code` and composing repair commands is the client's presentation (Task 19), so no finding can be dropped between the checker and the screen.
  - `apiDecay(ws, url): JsonResult` — `GET /api/decay?window=N` (default 20, positive integer) → `{ report: DecayReport; series: InjectionEvent[] }`. `report` is `computeDecay` fed exactly as `status.ts:182-189` feeds it; `series` is `Ledger.history()`. The chart's caveat text lives in the string tables (`decay.caveat`) and carries the window and sessions-recorded figures the spec requires the chart to disclose.

- [ ] **Step 1: Write the failing tests** (append to `test/ui/read-model.test.ts`)

```ts
import { apiStatus, apiDoctor, apiDecay } from '../../src/ui/read-model.ts';

test('/api/status composes the same queue and counts status --json reports', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const result = apiStatus(ws, new URL('http://x/api/status'));
    assert.equal(result.status, 200);
    const body = result.body as {
      version: string; profile: string;
      items: { total: number; byStatus: Record<string, number> };
      reviewQueue: { drafts: number; always: number; globalLayerDrafts: number };
      pendingRevisions: { revisions: number; items: number };
      health: { errors: number; warnings: number; infos: number };
    };
    assert.equal(body.items.total, 3);
    assert.equal(body.profile, ws.config.profile);
    // `mycontext add` through the CLI stamps origin human → active, so the
    // project-layer queue is empty and byStatus shows 3 active. (If this
    // fixture assumption is wrong when run, read the actual statuses from
    // store.all() and assert the DERIVED relationship instead: drafts equals
    // reviewQueue(items).length — that is the invariant, not the raw number.)
    assert.equal(body.reviewQueue.drafts + body.items.byStatus.active, 3 + body.reviewQueue.drafts);
    assert.deepEqual(body.pendingRevisions, { revisions: 0, items: 0 });
    assert.ok(body.health.errors >= 0);
  } finally { done(); }
});

test('/api/doctor returns runChecks findings verbatim', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const result = apiDoctor(ws, new URL('http://x/api/doctor'));
    assert.equal(result.status, 200);
    const findings = (result.body as { findings: { level: string; code: string; message: string }[] }).findings;
    assert.ok(Array.isArray(findings));
    for (const f of findings) {
      assert.ok(['error', 'warn', 'info'].includes(f.level));
      assert.equal(typeof f.code, 'string');
    }
  } finally { done(); }
});

test('/api/decay returns the report and the raw series, and validates window', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const store = Store.open(ws.dbPath);
    const ledger = Ledger.open(ws.dbPath);
    const anyId = store.all()[0].id;
    ledger.record('s1', anyId, 'jit', '2026-08-01T10:00:00.000Z');
    ledger.close(); store.close();

    const result = apiDecay(ws, new URL('http://x/api/decay'));
    assert.equal(result.status, 200);
    const body = result.body as {
      report: { window: number; sessionsRecorded: number; cold: unknown[] };
      series: { itemId: string; injectedAt: string }[];
    };
    assert.equal(body.report.window, 20);
    assert.equal(body.report.sessionsRecorded, 1);
    assert.equal(body.series.length, 1);
    assert.equal(body.series[0].itemId, anyId);

    assert.equal(apiDecay(ws, new URL('http://x/api/decay?window=0')).status, 400);
    assert.equal(apiDecay(ws, new URL('http://x/api/decay?window=abc')).status, 400);
    assert.equal(apiDecay(ws, new URL('http://x/api/decay?windw=5')).status, 400);
  } finally { done(); }
});
```

- [ ] **Step 2: Run and see the new tests fail**

Run: `node --test test/ui/read-model.test.ts`
Expected: new tests FAIL (not exported).

- [ ] **Step 3: Implement** (append to `src/ui/read-model.ts`; add the imports shown)

```ts
import path from 'node:path';
import { computeDecay } from '../core/decay.ts';
import { pendingRevisionCounts, pendingRevisionSummaries } from '../core/revision-log.ts';
import { reviewQueue } from '../core/select.ts';
import { VERSION } from '../core/version.ts';
import { runChecks } from '../doctor/checks.ts';

function tally(items: Item[], key: (i: Item) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
}

export function apiStatus(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  if (!ws.projectRoot) return { status: 404, body: { error: 'no workspace here' } };
  const projectRoot = ws.projectRoot;
  return withStores(ws, (store) => {
    const items = store.all();
    // The project-layer queue, via the ONE definition (select.ts reviewQueue) —
    // never a raw draft tally; the difference is named, as status.ts:163 names it.
    const queue = reviewQueue(items);
    const globalLayerDrafts = items.filter((i) => i.status === 'draft').length - queue.length;
    const findings = runChecks({
      root: projectRoot,
      repoRoot: path.dirname(projectRoot),
      dbPath: ws.dbPath,
      items,
      config: ws.config,
    });
    return {
      status: 200,
      body: {
        version: VERSION,
        profile: ws.config.profile,
        items: {
          total: items.length,
          byCategory: tally(items, (i) => i.type),
          byStatus: tally(items, (i) => i.status),
          byOrigin: tally(items, (i) => i.origin),
        },
        reviewQueue: {
          drafts: queue.length,
          always: queue.filter((i) => i.always).length,
          globalLayerDrafts,
        },
        pendingRevisions: pendingRevisionCounts(pendingRevisionSummaries(projectRoot)),
        health: {
          errors: findings.filter((f) => f.level === 'error').length,
          warnings: findings.filter((f) => f.level === 'warn').length,
          infos: findings.filter((f) => f.level === 'info').length,
        },
      },
    };
  });
}

export function apiDoctor(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  if (!ws.projectRoot) return { status: 404, body: { error: 'no workspace here' } };
  const projectRoot = ws.projectRoot;
  return withStores(ws, (store) => ({
    status: 200,
    body: {
      findings: runChecks({
        root: projectRoot,
        repoRoot: path.dirname(projectRoot),
        dbPath: ws.dbPath,
        items: store.all(),
        config: ws.config,
      }),
    },
  }));
}

export function apiDecay(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['window']);
  if (bad) return badRequest(bad);
  const raw = url.searchParams.get('window');
  const window = raw === null ? 20 : Number(raw);
  if (!Number.isInteger(window) || window <= 0) {
    return badRequest(`window must be a positive integer (got ${JSON.stringify(raw)})`);
  }
  return withStores(ws, (store, ledger) => {
    const items = store.all();
    const report = computeDecay({
      items,
      config: ws.config,
      usage: ledger.allUsage(),
      recentlyUsed: ledger.itemsUsedIn(ledger.recentSessions(window)),
      window,
      sessionsRecorded: ledger.sessionCount(),
    });
    return { status: 200, body: { report, series: ledger.history() } };
  });
}
```

(If `computeDecay`'s `DecayInput` field names differ from this call when typechecked — the shape was read from `src/core/decay.ts:60` and `status.ts:183-189` — follow the type, not this prose.)

- [ ] **Step 4: Run the tests and see them pass**

Run: `node --test test/ui/read-model.test.ts && npx tsc --noEmit`
Expected: PASS. If the status fixture assumption (3 active items) fails, apply the derived-relationship fallback written in the test comment — and delete the raw-number assertion, not the invariant.

- [ ] **Step 5: Commit**

```bash
git add src/ui/read-model.ts test/ui/read-model.test.ts
git commit -m "feat(ui): status, doctor and decay read model"
```

---

## Task 11: Read model — coverage, graph, items, help

**Files:**
- Modify: `src/ui/read-model.ts`
- Test: extend `test/ui/read-model.test.ts`

**Interfaces:**
- Consumes: `matchesScope` (`select.ts:149`), `injection` (`cli/commands/injection.ts:42`), `listRepoFiles` (`doctor/checks.ts:72`), `helpTopic`/`HELP_TOPICS` (`help/index.ts`), `scopePolicyFor` (`config.ts:138`), `Ledger.usage`.
- Produces:
  - `apiCoverage(ws, url): JsonResult` — `GET /api/coverage` →

    ```ts
    {
      files: { path: string; governs: string[] }[];   // ids of governing scoped/unscoped items per file
      pinned: string[];                                // always-items: govern every session, path-independent
      items: { id: string; type: string; title: string; scope: string[];
               always: boolean; injected: boolean; phrase: string }[];
      truncated: boolean;                              // listRepoFiles hit its 20k bound — the map is partial
    }
    ```

    **The rule composition §3 fixes, exactly:** an item colours a file iff `injection(item, config).injected` (which already encapsulates `isEligible`, the normative-tier test and `emptyScopeInjection` in `select`'s own order) **and** `matchesScope(item, file, config)`. **Never `matchesAnyGlob`** — that is the defect `select.ts:127-129` documents by name. Pinned (`always`) items are reported separately because they govern sessions, not paths. Coverage *gaps* (directories with no governing item; empty categories) are derived client-side from `files` + `/api/status` `byCategory` — a presentation over this data, not a second matcher.
  - `apiGraph(ws, url): JsonResult` — `GET /api/graph?focus=<id>&radius=1|2` →

    ```ts
    {
      focus: string;
      nodes: { id: string; title: string | null; type: string | null;
               status: string | null; missing: boolean }[];
      edges: { from: string; to: string; type: string; dangling: boolean }[];
      omitted: number;   // nodes beyond the 60 cap — explicit, never silent (spec §4)
    }
    ```

    Ego-graph only (spec §4): BFS from `focus` over `relations` in **both** directions, radius ≤ 2, deterministic order (neighbours sorted by relation type then id), hard cap 60 nodes with `omitted` counting the rest. A relation whose target is not in the corpus yields a `missing: true` node and a `dangling: true` edge — the thing worth seeing after a supersede. Unknown `focus` → 404. Layout is the client's (deterministic layered, Task 18); the server ships no coordinates.
  - `apiItems(ws, url): JsonResult` — `GET /api/items` → `{ items: { id; type; title; status; always; scope; injected; phrase }[] }` sorted by id — the link target for every screen.
  - `apiItem(ws, url, params: { id }): JsonResult` — `GET /api/item/:id` → `{ item: Item; injection: { phrase: string; injected: boolean }; usage: Usage }` (`Ledger.usage`, `ledger.ts:187`). Unknown id → 404.
  - `apiHelp(ws, url, params: { topic }): JsonResult` — `GET /api/help/:topic` → `{ topic; markdown; corpus }` where `markdown` is `helpTopic(topic, ws.config)` and `corpus` is the §4 Learn cross-link data — the join that justifies the screen ("built without it, this screen is a documentation viewer and should be cut"):
    - `scope` topic: `{ scoped: { id; title; scope }[]; unscoped: { id; title; policy: ScopePolicy }[] }` — policy via `scopePolicyFor`, so what an empty scope means is stated per item under **this** project's config.
    - `categories` topic: `{ counts: Record<string, number>; empty: string[] }` — enabled categories with zero items.
    - `capture` topic: `{ recent: { id; title; mtime: string }[] }` — five most recent **by file modification time** (`Item` has no creation timestamp — `types.ts:33-58`; the label in the strings table carries that condition: `learn.recentCaptures`).
    - `workflow` topic: `{ drafts: number; pendingRevisions: { revisions: number; items: number } }`.
    - Unknown topic → 404 listing `HELP_TOPICS`.

- [ ] **Step 1: Write the failing tests** (append to `test/ui/read-model.test.ts`)

```ts
import { apiCoverage, apiGraph, apiItems, apiItem, apiHelp } from '../../src/ui/read-model.ts';
import { writeFileSync, mkdirSync } from 'node:fs';

test('/api/coverage colours files with matchesScope + injection(), never a bare glob', () => {
  const { dir, done } = workspace();
  try {
    mkdirSync(path.join(dir, 'src'), { recursive: true });
    writeFileSync(path.join(dir, 'src', 'a.ts'), '');
    writeFileSync(path.join(dir, 'top.md'), '');
    const ws = resolveWorkspace(dir);
    const result = apiCoverage(ws, new URL('http://x/api/coverage'));
    assert.equal(result.status, 200);
    const body = result.body as {
      files: { path: string; governs: string[] }[];
      pinned: string[];
      items: { id: string; type: string; injected: boolean }[];
    };
    const store = Store.open(ws.dbPath);
    const items = store.all();
    store.close();
    const scopedRule = items.find((i) => i.title === 'Always use POSIX paths')!;
    const pinnedRule = items.find((i) => i.title === 'Pin me')!;
    const decision = items.find((i) => i.title === 'We chose sqlite')!;

    const srcFile = body.files.find((f) => f.path === 'src/a.ts')!;
    const topFile = body.files.find((f) => f.path === 'top.md')!;
    // The scoped rule governs src/** only; the pinned rule is path-independent;
    // the decision is RATIONALE tier — injection().injected is false, so it
    // must colour NOTHING (the false statement the spec names in §3).
    assert.ok(srcFile.governs.includes(scopedRule.id));
    assert.ok(!topFile.governs.includes(scopedRule.id));
    assert.deepEqual(body.pinned, [pinnedRule.id]);
    for (const f of body.files) assert.ok(!f.governs.includes(decision.id));
    assert.equal(body.items.find((i) => i.id === decision.id)?.injected, false);
  } finally { done(); }
});

test('/api/graph is an ego graph with dangling edges visible and a hard cap', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const store = Store.open(ws.dbPath);
    const ids = store.all().map((i) => i.id).sort();
    store.close();
    // Link two real items, then point a relation at a missing id by superseding
    // nothing — instead, use the CLI link command if present; otherwise this
    // fixture writes relations through `runCli(['add', …])`? Neither exists as
    // a read — so ESTABLISH BY EXECUTING: find how relations are created in
    // tests today (grep test/ for `relations:` fixtures or a link command) and
    // create: ids[0] -> ids[1] (real) and ids[0] -> 'RULE-ghost' (dangling).
    // The assertions below are the contract; the fixture mechanics follow the
    // codebase's existing pattern.
    const result = apiGraph(ws, new URL(`http://x/api/graph?focus=${ids[0]}&radius=1`));
    assert.equal(result.status, 200);
    const body = result.body as {
      nodes: { id: string; missing: boolean }[];
      edges: { from: string; to: string; dangling: boolean }[];
      omitted: number;
    };
    assert.ok(body.nodes.some((n) => n.id === ids[0] && !n.missing));
    assert.equal(typeof body.omitted, 'number');

    assert.equal(apiGraph(ws, new URL('http://x/api/graph?focus=NOPE&radius=1')).status, 404);
    assert.equal(apiGraph(ws, new URL(`http://x/api/graph?focus=${ids[0]}&radius=3`)).status, 400);
  } finally { done(); }
});

test('/api/items and /api/item/:id carry the injection phrase; unknown id is 404', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const list = apiItems(ws, new URL('http://x/api/items'));
    const items = (list.body as { items: { id: string; phrase: string }[] }).items;
    assert.ok(items.length === 3);
    for (const i of items) assert.equal(typeof i.phrase, 'string');

    const one = apiItem(ws, new URL(`http://x/api/item/${items[0].id}`), { id: items[0].id });
    assert.equal(one.status, 200);
    const body = one.body as { item: { id: string }; usage: { useCount: number } };
    assert.equal(body.item.id, items[0].id);
    assert.equal(body.usage.useCount, 0);

    assert.equal(apiItem(ws, new URL('http://x/api/item/NOPE'), { id: 'NOPE' }).status, 404);
  } finally { done(); }
});

test('/api/help/:topic joins the topic to this corpus; unknown topic is 404', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const scope = apiHelp(ws, new URL('http://x/api/help/scope'), { topic: 'scope' });
    assert.equal(scope.status, 200);
    const body = scope.body as {
      markdown: string;
      corpus: { scoped: { id: string }[]; unscoped: { id: string; policy: string }[] };
    };
    assert.ok(body.markdown.length > 0);
    assert.equal(body.corpus.scoped.length, 1);   // the src/** rule
    assert.equal(body.corpus.unscoped.length, 2); // pinned rule + decision
    for (const u of body.corpus.unscoped) assert.ok(['global', 'required', 'inert'].includes(u.policy));

    const categories = apiHelp(ws, new URL('http://x/api/help/categories'), { topic: 'categories' });
    const cats = categories.body as { corpus: { counts: Record<string, number>; empty: string[] } };
    assert.equal(cats.corpus.counts.rule, 2);
    assert.ok(cats.corpus.empty.includes('constraint'));

    assert.equal(apiHelp(ws, new URL('http://x/api/help/nope'), { topic: 'nope' }).status, 404);
  } finally { done(); }
});
```

The graph fixture's establish-by-executing note is a real instruction: how a test creates a relation (a `relations:` frontmatter fixture, a link CLI command, or the MCP tool) must be read out of the existing tests (`grep -rn "relations" test/ --include="*.ts" -l`), and the fixture written the way the codebase already writes them. The dangling-edge and cap-60 assertions must both end up in the committed test with real fixtures behind them (cap 60: create a focus item with 61+ relations in a loop and assert `omitted >= 1` and `nodes.length <= 60`).

- [ ] **Step 2: Run and see the new tests fail**

Run: `node --test test/ui/read-model.test.ts`
Expected: new tests FAIL.

- [ ] **Step 3: Implement** (append to `src/ui/read-model.ts`; add imports: `matchesScope` from `select.ts`, `injection` from `../cli/commands/injection.ts`, `listRepoFiles` from `../doctor/checks.ts`, `helpTopic, HELP_TOPICS` from `../help/index.ts`, `scopePolicyFor` from `../core/config.ts`, `statSync` from `node:fs`)

```ts
const FILE_WALK_LIMIT = 20_000; // listRepoFiles' own default bound (doctor/checks.ts:43)

export function apiCoverage(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  if (!ws.projectRoot) return { status: 404, body: { error: 'no workspace here' } };
  const repoRoot = path.dirname(ws.projectRoot);
  return withStores(ws, (store) => {
    const items = store.all();
    // injection() composes isEligible + the normative-tier test +
    // emptyScopeInjection(scopePolicyFor(...)) in select's own order
    // (cli/commands/injection.ts:42). NOT matchesAnyGlob — the defect
    // select.ts:127-129 documents by name.
    const decorated = items.map((item) => ({ item, verdict: injection(item, ws.config) }));
    const governing = decorated.filter((d) => d.verdict.injected && !d.item.always);
    const pinned = decorated.filter((d) => d.verdict.injected && d.item.always)
      .map((d) => d.item.id);
    const files = listRepoFiles(repoRoot);
    const coloured = files.map((file) => ({
      path: file,
      governs: governing
        .filter((d) => matchesScope(d.item, file, ws.config))
        .map((d) => d.item.id),
    }));
    return {
      status: 200,
      body: {
        files: coloured,
        pinned,
        items: decorated.map((d) => ({
          id: d.item.id, type: d.item.type, title: d.item.title,
          scope: d.item.scope, always: d.item.always,
          injected: d.verdict.injected, phrase: d.verdict.phrase,
        })),
        truncated: files.length >= FILE_WALK_LIMIT,
      },
    };
  });
}

const GRAPH_NODE_CAP = 60;

export function apiGraph(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['focus', 'radius']);
  if (bad) return badRequest(bad);
  const focus = url.searchParams.get('focus');
  if (!focus) return badRequest('focus=<item id> is required');
  const radiusRaw = url.searchParams.get('radius') ?? '1';
  const radius = Number(radiusRaw);
  if (radius !== 1 && radius !== 2) {
    return badRequest(`radius must be 1 or 2 (got ${JSON.stringify(radiusRaw)}) — an ego graph, not a hairball`);
  }
  return withStores(ws, (store) => {
    const items = store.all();
    const byId = new Map(items.map((i) => [i.id, i]));
    if (!byId.has(focus)) return { status: 404, body: { error: `no item ${focus}` } };

    // Adjacency in BOTH directions, deterministic: relation type, then id.
    const neighbours = new Map<string, { other: string; type: string; from: string; to: string }[]>();
    const push = (key: string, entry: { other: string; type: string; from: string; to: string }) => {
      const list = neighbours.get(key) ?? [];
      list.push(entry);
      neighbours.set(key, list);
    };
    for (const item of items) {
      for (const rel of item.relations) {
        push(item.id, { other: rel.target, type: rel.type, from: item.id, to: rel.target });
        push(rel.target, { other: item.id, type: rel.type, from: item.id, to: rel.target });
      }
    }
    for (const list of neighbours.values()) {
      list.sort((a, b) => a.type < b.type ? -1 : a.type > b.type ? 1 : a.other < b.other ? -1 : 1);
    }

    const kept = new Set<string>([focus]);
    const edges: { from: string; to: string; type: string; dangling: boolean }[] = [];
    const edgeKeys = new Set<string>();
    let omitted = 0;
    let frontier = [focus];
    for (let depth = 0; depth < radius; depth++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const n of neighbours.get(id) ?? []) {
          if (!kept.has(n.other)) {
            if (kept.size >= GRAPH_NODE_CAP) { omitted++; continue; }
            kept.add(n.other);
            next.push(n.other);
          }
          const key = `${n.from}${n.to}${n.type}`;
          if (kept.has(n.from) && kept.has(n.other) && !edgeKeys.has(key)) {
            edgeKeys.add(key);
            edges.push({ from: n.from, to: n.to, type: n.type, dangling: !byId.has(n.to) });
          }
        }
      }
      frontier = next;
    }

    const nodes = [...kept].map((id) => {
      const item = byId.get(id);
      return item
        ? { id, title: item.title, type: item.type, status: item.status, missing: false }
        : { id, title: null, type: null, status: null, missing: true };
    });
    return { status: 200, body: { focus, nodes, edges, omitted } };
  });
}

export function apiItems(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  return withStores(ws, (store) => ({
    status: 200,
    body: {
      items: store.all()
        .sort((a, b) => a.id < b.id ? -1 : 1)
        .map((i) => {
          const verdict = injection(i, ws.config);
          return {
            id: i.id, type: i.type, title: i.title, status: i.status,
            always: i.always, scope: i.scope,
            injected: verdict.injected, phrase: verdict.phrase,
          };
        }),
    },
  }));
}

export function apiItem(ws: Workspace, url: URL, params: { id: string }): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  return withStores(ws, (store, ledger) => {
    const item = store.all().find((i) => i.id === params.id);
    if (!item) return { status: 404, body: { error: `no item ${params.id}` } };
    return {
      status: 200,
      body: { item, injection: injection(item, ws.config), usage: ledger.usage(item.id) },
    };
  });
}

export function apiHelp(ws: Workspace, url: URL, params: { topic: string }): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  if (!(HELP_TOPICS as string[]).includes(params.topic)) {
    return { status: 404, body: { error: `no topic ${params.topic} — topics: ${HELP_TOPICS.join(', ')}` } };
  }
  if (!ws.projectRoot) return { status: 404, body: { error: 'no workspace here' } };
  const projectRoot = ws.projectRoot;
  return withStores(ws, (store) => {
    const items = store.all();
    const markdown = helpTopic(params.topic, ws.config);
    let corpus: unknown;
    switch (params.topic) {
      case 'scope': {
        corpus = {
          scoped: items.filter((i) => i.scope.length > 0)
            .map((i) => ({ id: i.id, title: i.title, scope: i.scope })),
          unscoped: items.filter((i) => i.scope.length === 0)
            .map((i) => ({ id: i.id, title: i.title, policy: scopePolicyFor(ws.config, i.type) })),
        };
        break;
      }
      case 'categories': {
        const counts: Record<string, number> = {};
        for (const i of items) counts[i.type] = (counts[i.type] ?? 0) + 1;
        const empty = Object.values(ws.config.categories)
          .filter((c) => c.enabled && (counts[c.name] ?? 0) === 0)
          .map((c) => c.name);
        corpus = { counts, empty };
        break;
      }
      case 'capture': {
        // By file mtime, labelled as such in the UI: Item carries no creation
        // timestamp (types.ts:33-58), and the ledger records injection, not
        // capture — mtime is the only recency signal that exists.
        const recent = items
          .map((i) => {
            try {
              return { id: i.id, title: i.title,
                mtime: statSync(path.join(projectRoot, i.filePath)).mtime.toISOString() };
            } catch {
              return null;
            }
          })
          .filter((r): r is { id: string; title: string; mtime: string } => r !== null)
          .sort((a, b) => b.mtime < a.mtime ? -1 : 1)
          .slice(0, 5);
        corpus = { recent };
        break;
      }
      default: { // 'workflow'
        corpus = {
          drafts: reviewQueue(items).length,
          pendingRevisions: pendingRevisionCounts(pendingRevisionSummaries(projectRoot)),
        };
      }
    }
    return { status: 200, body: { topic: params.topic, markdown, corpus } };
  });
}
```

`capture`'s mtime lookup joins against the **project layer** path; a global-layer item's `filePath` is relative to the global root, so restrict `recent` to `i.layer === 'project'` (add `.filter((i) => i.layer === 'project')` before the map) — a stat against the wrong root must not silently produce a wrong date; the try/catch above degrades a missing file to exclusion, and the layer filter makes the path base correct rather than lucky.

- [ ] **Step 4: Run the tests and see them pass**

Run: `node --test test/ui/read-model.test.ts && npm test && npx tsc --noEmit`
Expected: PASS, suite green.

- [ ] **Step 5: Commit**

```bash
git add src/ui/read-model.ts test/ui/read-model.test.ts
git commit -m "feat(ui): coverage, ego-graph, items and corpus-joined help read model"
```

---

## Task 12: `static.ts` — asset serving, traversal-proof

**Files:**
- Create: `src/ui/static.ts`
- Test: `test/ui/static.test.ts`

**Interfaces:**
- Consumes: `node:fs`, `node:path`.
- Produces: `serveStatic(pathname: string, publicDir: string): { status: number; contentType: string; body: Buffer } | null` — `null` for "not a static asset" (the caller 404s). `/` serves `index.html`. Static responses carry `Cache-Control: no-store` (the caller sets it; a token-guarded ephemeral app must not leave assets in a shared cache) — static GETs are **not** `/api` requests and never touch the idle monitor (§2's idle definition counts `/api` requests only).

- [ ] **Step 1: Write the failing test**

```ts
// test/ui/static.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { serveStatic } from '../../src/ui/static.ts';

const PUBLIC = path.join(import.meta.dirname, '..', '..', 'src', 'ui', 'public');

test('/ serves index.html as text/html', () => {
  const result = serveStatic('/', PUBLIC);
  assert.ok(result);
  assert.equal(result?.status, 200);
  assert.equal(result?.contentType, 'text/html; charset=utf-8');
});

test('a JS module and the stylesheet serve with correct types', () => {
  assert.equal(serveStatic('/strings/en.js', PUBLIC)?.contentType, 'text/javascript; charset=utf-8');
  assert.equal(serveStatic('/styles.css', PUBLIC)?.contentType, 'text/css; charset=utf-8');
});

test('path traversal cannot escape the public directory', () => {
  for (const evil of [
    '/../server.ts', '/..%2Fserver.ts', '/%2e%2e/server.ts',
    '/strings/../../security.ts', '/..\\server.ts',
  ]) {
    assert.equal(serveStatic(evil, PUBLIC), null, evil);
  }
});

test('a missing file is null, not a throw', () => {
  assert.equal(serveStatic('/nope.js', PUBLIC), null);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/ui/static.test.ts`
Expected: FAIL — module not found. (`index.html`, `styles.css` and `strings/en.js` must exist for the type tests; `strings/en.js` does since Task 1 — `index.html`/`styles.css` arrive in Step 3 as minimal placeholders that Task 16 replaces with the real shell, each containing one comment line saying Task 16 owns the content.)

- [ ] **Step 3: Implement**

```ts
// src/ui/static.ts
import { readFileSync } from 'node:fs';
import path from 'node:path';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/**
 * Static assets for the UI page. Decode-then-resolve-then-containment-check:
 * the resolved absolute path must stay inside publicDir, so no encoding of
 * `..` (raw, %2F, %2e) can escape — the check is on the RESOLVED path, not on
 * the spelling. Unknown extensions are refused (null) rather than served as
 * octet-streams: this directory contains exactly four kinds of file, and a
 * fifth kind appearing is a mistake to surface, not content to ship.
 */
export function serveStatic(
  pathname: string, publicDir: string,
): { status: number; contentType: string; body: Buffer } | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  if (relative.includes('\\')) return null; // never let win32 separators into the resolve
  const root = path.resolve(publicDir);
  const resolved = path.resolve(root, relative);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  const contentType = CONTENT_TYPES[path.extname(resolved)];
  if (!contentType) return null;
  try {
    return { status: 200, contentType, body: readFileSync(resolved) };
  } catch {
    return null;
  }
}
```

Also create the two placeholder assets (real content in Task 16):

`src/ui/public/index.html`:

```html
<!doctype html>
<!-- Shell content is Task 16's; this file exists so static serving is testable first. -->
<html lang="en" dir="ltr"><head><meta charset="utf-8"><title>mycontext</title></head>
<body></body></html>
```

`src/ui/public/styles.css`:

```css
/* Real stylesheet is Task 16's. Logical properties ONLY — see the plan's Global Constraints. */
```

- [ ] **Step 4: Run the test and see it pass**

Run: `node --test test/ui/static.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/static.ts src/ui/public/index.html src/ui/public/styles.css test/ui/static.test.ts
git commit -m "feat(ui): traversal-proof static serving for the app shell"
```

---

## Task 13: `server.ts` — wiring, handoff, ping, meta; the spawned-process E2E suite

**Files:**
- Create: `src/ui/server.ts`
- Create: `test/ui/helpers.ts`
- Test: `test/ui/server-e2e.test.ts`

**Interfaces:**
- Consumes: everything above (`routes`, `read-model`, `security`, `idle`, `static`, `git-info`), `resolveWorkspace`, `isMainEntry` (`core/paths.ts:161`).
- Produces — **the server contract plans 2 and 3 run inside**:

```ts
// src/ui/server.ts
export interface UiServerOptions {
  cwd: string;                       // workspace resolution root
  port?: number;                     // default 0 = OS-assigned
  host?: string;                     // MUST be '127.0.0.1'; anything else throws (spec §2.1)
  idleMs?: number;                   // default IDLE_MS; tests shrink it
  onExit?: (reason: 'idle' | 'closed') => void;
}
export interface RunningUiServer {
  port: number;
  /** URL carrying a fresh one-shot handoff nonce in the FRAGMENT. */
  urlWithNonce(ttlMs: number): string;
  close(): Promise<void>;
}
export function startUiServer(options: UiServerOptions): Promise<RunningUiServer>;
export const OPENER_NONCE_TTL_MS = 10_000;    // spec §3: ten seconds, command-line-visible
export const PRINTED_NONCE_TTL_MS = 600_000;  // plan decision 5: printed URLs, never on a command line
```

Built-in endpoints registered here (all others come from `read-model` registrations below; plans 2/3 add theirs the same way):
- `POST /api/handoff` `{ nonce }` → `{ token }` — **exempt from the token check** (it is how the page first gets the token; it is still Host/Origin-checked), one-shot, in-memory only; there is no POST that changes state on disk (§2).
- `GET /api/ping` → `{ ok: true }` — the heartbeat target; counts as activity.
- `GET /api/meta` → `{ version, projectRoot, repoRoot, git: GitInfo | null }` — `readGitInfo` (Task 4); plan 3's strip renders `git` and adds nothing server-side.

Dispatch order per request, binding: (1) non-`/api` paths → `serveStatic` (no token — the page itself must load; it contains no secrets, and `Cache-Control: no-store`); (2) `/api/handoff` → Host/Origin check then nonce exchange; (3) every other `/api` path → full `validateApiRequest` gate, **then** `idle.touch()` iff the matched route is not `kind: 'stream'`, then the handler. JSON bodies: `Content-Type: application/json; charset=utf-8`, no CORS headers of any kind (§2 — their absence is the defence).

- [ ] **Step 1: Write the spawn harness and the failing E2E tests**

```ts
// test/ui/helpers.ts
/**
 * Spawns `src/ui/server.ts` as a real child process (the way test/mcp/
 * server-e2e.test.ts spawns the MCP server) and waits for its readiness
 * line. The server prints exactly one line to stdout when listening:
 *   mycontext ui: http://127.0.0.1:<port>/#<nonce>
 * The harness parses port and nonce; the TEST exchanges the nonce for the
 * token over HTTP, which exercises the handoff path on every run.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SERVER = fileURLToPath(new URL('../../src/ui/server.ts', import.meta.url));

export interface UiHarness {
  port: number;
  nonce: string;
  child: ChildProcessWithoutNullStreams;
  stop(): Promise<void>;
}

export function startUiChild(cwd: string, extraArgs: string[] = []): Promise<UiHarness> {
  const child = spawn(process.execPath, [SERVER, '--port', '0', ...extraArgs], { cwd });
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error(`ui server never became ready; output so far: ${buffer}`)), 30_000);
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const match = buffer.match(/http:\/\/127\.0\.0\.1:(\d+)\/#([0-9a-f]+)/);
      if (match) {
        clearTimeout(timer);
        resolve({
          port: Number(match[1]),
          nonce: match[2],
          child,
          stop: () => new Promise((done) => { child.once('exit', () => done()); child.kill(); }),
        });
      }
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`ui server exited early (${code}): ${buffer}`));
    });
  });
}

export async function redeemNonce(port: number, nonce: string): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${port}/api/handoff`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nonce }),
  });
  if (response.status !== 200) throw new Error(`handoff refused: ${response.status}`);
  return ((await response.json()) as { token: string }).token;
}
```

```ts
// test/ui/server-e2e.test.ts
/**
 * Endpoints tested as the MCP server is: spawn a real process, make real
 * requests (spec §6). Security assertions are first-class here.
 *
 * A limit stated rather than papered over (spec §6): these tests exercise
 * every /api contract and the security gate; the browser-side RENDERING has
 * no test, because testing it would need a browser dependency this project
 * does not have. The view-model logic is tested in Node (test/ui/
 * viewmodel.test.ts); what the DOM looks like is not, and a green suite here
 * must not be read as pixels verified.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { TOKEN_HEADER } from '../../src/ui/security.ts';
import { startUiChild, redeemNonce, type UiHarness } from './helpers.ts';

function project(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ui-e2e-'));
  runCli(['init'], dir, () => {});
  runCli(['add', 'rule', 'Pin me', '--always', '--body', 'Pinned.'], dir, () => {});
  return dir;
}

async function api(h: UiHarness, token: string, pathname: string, headers: Record<string, string> = {}) {
  return fetch(`http://127.0.0.1:${h.port}${pathname}`, {
    headers: { [TOKEN_HEADER]: token, ...headers },
  });
}

test('handoff → token → authenticated read; the nonce is one-shot', async () => {
  const cwd = project();
  const h = await startUiChild(cwd);
  try {
    const token = await redeemNonce(h.port, h.nonce);
    await assert.rejects(() => redeemNonce(h.port, h.nonce)); // second use refused (spec §6)

    const ok = await api(h, token, '/api/select?event=session-start&cold=1');
    assert.equal(ok.status, 200);
    const body = await ok.json() as { full: unknown[]; index: unknown; spilled: unknown[] };
    assert.ok(Array.isArray(body.full));
  } finally { await h.stop(); rmSync(cwd, { recursive: true, force: true }); }
});

test('wrong token 403, missing header 401, bad Origin 403 — and no CORS headers anywhere', async () => {
  const cwd = project();
  const h = await startUiChild(cwd);
  try {
    const token = await redeemNonce(h.port, h.nonce);

    const wrong = await api(h, 'f'.repeat(64), '/api/ping');
    assert.equal(wrong.status, 403);

    const missing = await fetch(`http://127.0.0.1:${h.port}/api/ping`);
    assert.equal(missing.status, 401);

    const badOrigin = await api(h, token, '/api/ping', { origin: 'https://evil.example' });
    assert.equal(badOrigin.status, 403);

    const good = await api(h, token, '/api/ping');
    assert.equal(good.status, 200);
    assert.equal(good.headers.get('access-control-allow-origin'), null);
  } finally { await h.stop(); rmSync(cwd, { recursive: true, force: true }); }
});

test('an expired nonce is refused after its window', async () => {
  const cwd = project();
  const h = await startUiChild(cwd, ['--nonce-ttl-ms', '50']); // test-only flag, see Step 2
  try {
    await new Promise((r) => setTimeout(r, 200));
    await assert.rejects(() => redeemNonce(h.port, h.nonce));
  } finally { await h.stop(); rmSync(cwd, { recursive: true, force: true }); }
});

test('the page and static assets serve without a token; /api/meta carries git info', async () => {
  const cwd = project();
  const h = await startUiChild(cwd);
  try {
    const page = await fetch(`http://127.0.0.1:${h.port}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type') ?? '', /text\/html/);
    assert.equal(page.headers.get('cache-control'), 'no-store');

    const token = await redeemNonce(h.port, h.nonce);
    const meta = await api(h, token, '/api/meta');
    const body = await meta.json() as { version: string; git: unknown };
    assert.equal(typeof body.version, 'string');
    assert.ok('git' in body); // null in a tmpdir with no .git — present either way
  } finally { await h.stop(); rmSync(cwd, { recursive: true, force: true }); }
});

test('idle: with no /api request for the window, the process exits on its own', async () => {
  const cwd = project();
  const h = await startUiChild(cwd, ['--idle-ms', '300']); // test-only flag, see Step 2
  try {
    const token = await redeemNonce(h.port, h.nonce);
    assert.equal((await api(h, token, '/api/ping')).status, 200);
    const exited = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 5_000);
      h.child.once('exit', () => { clearTimeout(timer); resolve(true); });
    });
    assert.equal(exited, true, 'server did not exit after its idle window');
  } finally { await h.stop(); rmSync(cwd, { recursive: true, force: true }); }
});

test('non-loopback bind is refused at startup, not warned about', async () => {
  const cwd = project();
  await assert.rejects(() => startUiChild(cwd, ['--host', '0.0.0.0']));
  rmSync(cwd, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `node --test test/ui/server-e2e.test.ts`
Expected: FAIL — `src/ui/server.ts` does not exist.

- [ ] **Step 3: Implement `server.ts`**

```ts
// src/ui/server.ts
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { isMainEntry } from '../core/paths.ts';
import { resolveWorkspace, type Workspace } from '../core/workspace.ts';
import { VERSION } from '../core/version.ts';
import { readGitInfo } from './git-info.ts';
import { IdleMonitor, IDLE_MS } from './idle.ts';
import {
  apiCoverage, apiDecay, apiDoctor, apiGraph, apiHelp, apiInjected, apiItem, apiItems,
  apiRender, apiSelect, apiSessions, apiSimulate, apiStatus,
} from './read-model.ts';
import { matchRoute, registerRoute, type ApiContext, type JsonResult } from './routes.ts';
import { mintToken, NonceStore, TOKEN_HEADER, validateApiRequest } from './security.ts';
import { serveStatic } from './static.ts';

/** Ten seconds: the nonce that transits a process command line (spec §3). */
export const OPENER_NONCE_TTL_MS = 10_000;
/** Ten minutes: the nonce in a PRINTED url (--no-open / spawn fallback) — never on a command line. */
export const PRINTED_NONCE_TTL_MS = 600_000;

export interface UiServerOptions {
  cwd: string;
  port?: number;
  host?: string;
  idleMs?: number;
  onExit?: (reason: 'idle' | 'closed') => void;
  /** Test-only override for handoff nonce ttl; production callers omit it. */
  nonceTtlMs?: number;
}

export interface RunningUiServer {
  port: number;
  urlWithNonce(ttlMs: number): string;
  close(): Promise<void>;
}

const PUBLIC_DIR = path.join(import.meta.dirname, 'public');

function registerReadRoutes(): void {
  const json = (fn: (ws: Workspace, url: URL) => JsonResult) =>
    ({ kind: 'json' as const, handle: (ctx: ApiContext) => fn(ctx.ws, ctx.url) });
  registerRoute('GET', '/api/select', json(apiSelect));
  registerRoute('GET', '/api/render', json(apiRender));
  registerRoute('GET', '/api/simulate', json(apiSimulate));
  registerRoute('GET', '/api/sessions', json(apiSessions));
  registerRoute('GET', '/api/status', json(apiStatus));
  registerRoute('GET', '/api/doctor', json(apiDoctor));
  registerRoute('GET', '/api/decay', json(apiDecay));
  registerRoute('GET', '/api/coverage', json(apiCoverage));
  registerRoute('GET', '/api/graph', json(apiGraph));
  registerRoute('GET', '/api/items', json(apiItems));
  registerRoute('GET', '/api/session/:session/injected', {
    kind: 'json',
    handle: (ctx) => apiInjected(ctx.ws, ctx.url, { session: ctx.params.session }),
  });
  registerRoute('GET', '/api/item/:id', {
    kind: 'json', handle: (ctx) => apiItem(ctx.ws, ctx.url, { id: ctx.params.id }),
  });
  registerRoute('GET', '/api/help/:topic', {
    kind: 'json', handle: (ctx) => apiHelp(ctx.ws, ctx.url, { topic: ctx.params.topic }),
  });
}

let routesRegistered = false;

function sendJson(res: ServerResponse, result: JsonResult): void {
  const body = JSON.stringify(result.body);
  res.writeHead(result.status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    // Deliberately NO CORS headers: their absence is the cross-origin defence (spec §2).
  });
  res.end(body);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 64 * 1024) reject(new Error('body too large')); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export function startUiServer(options: UiServerOptions): Promise<RunningUiServer> {
  const host = options.host ?? '127.0.0.1';
  if (host !== '127.0.0.1') {
    // Refuse to start, not warn (spec §2.1): a bind beyond loopback exposes
    // the corpus to the network, and a warning is a property claim nobody reads.
    return Promise.reject(new Error(
      `mycontext ui: refusing to bind ${host} — the UI serves 127.0.0.1 only.`,
    ));
  }
  const ws = resolveWorkspace(options.cwd);
  if (!ws.projectRoot) {
    return Promise.reject(new Error('mycontext ui: no workspace here. Run `mycontext init` first.'));
  }
  const repoRoot = path.dirname(ws.projectRoot);
  const token = mintToken();
  const nonces = new NonceStore();
  const nonceTtl = options.nonceTtlMs;

  if (!routesRegistered) {
    registerReadRoutes();
    routesRegistered = true;
  }

  const server = createServer((req, res) => {
    void handle(req, res).catch((err) => {
      sendJson(res, { status: 500, body: { error: err instanceof Error ? err.message : String(err) } });
    });
  });

  const idle = new IdleMonitor(options.idleMs ?? IDLE_MS, () => {
    // On idle the server closes; open sockets (a stream, in plan 3) are
    // destroyed so close() completes and the page's next fetch fails, which
    // is what triggers the "server has exited" banner (no auto-reconnect).
    server.close(() => options.onExit?.('idle'));
    server.closeAllConnections();
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const port = (server.address() as { port: number }).port;
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);

    if (!url.pathname.startsWith('/api/')) {
      const asset = serveStatic(url.pathname, PUBLIC_DIR);
      if (!asset) { res.writeHead(404, { 'cache-control': 'no-store' }); res.end(); return; }
      res.writeHead(asset.status, { 'content-type': asset.contentType, 'cache-control': 'no-store' });
      res.end(asset.body);
      return;
    }

    // Host/Origin are validated for EVERY /api request, handoff included; the
    // token check is what handoff alone is exempt from (it is how the page
    // first obtains the token).
    const gate = validateApiRequest(req as { headers: Record<string, string | string[] | undefined> },
      { token, port });
    if (url.pathname === '/api/handoff' && req.method === 'POST') {
      if (!gate.ok && gate.status !== 401) { sendJson(res, { status: gate.status, body: { error: gate.reason } }); return; }
      let nonce: unknown;
      try { nonce = (JSON.parse(await readBody(req)) as { nonce?: unknown }).nonce; } catch { nonce = undefined; }
      if (typeof nonce !== 'string' || !nonces.redeem(nonce)) {
        sendJson(res, { status: 403, body: { error: 'invalid, expired or already-used handoff nonce' } });
        return;
      }
      sendJson(res, { status: 200, body: { token } });
      return;
    }
    if (!gate.ok) { sendJson(res, { status: gate.status, body: { error: gate.reason } }); return; }

    if (url.pathname === '/api/ping' && req.method === 'GET') {
      idle.touch();
      sendJson(res, { status: 200, body: { ok: true } });
      return;
    }
    if (url.pathname === '/api/meta' && req.method === 'GET') {
      idle.touch();
      sendJson(res, {
        status: 200,
        body: { version: VERSION, projectRoot: ws.projectRoot, repoRoot, git: readGitInfo(repoRoot) },
      });
      return;
    }

    const match = matchRoute(req.method ?? 'GET', url.pathname);
    if (!match) { sendJson(res, { status: 404, body: { error: `no route ${req.method} ${url.pathname}` } }); return; }

    let body: unknown;
    if (req.method === 'POST') {
      try { body = JSON.parse(await readBody(req)); } catch { body = undefined; }
    }
    const ctx: ApiContext = { ws, repoRoot, url, params: match.params, body };

    if (match.handler.kind === 'stream') {
      // NOT idle.touch(): an open stream is not activity (spec §2). Plan 3's
      // stream route inherits this without remembering it.
      match.handler.handle(ctx, res);
      return;
    }
    idle.touch();
    sendJson(res, await match.handler.handle(ctx));
  }

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, host, () => {
      idle.touch();
      idle.start();
      const port = (server.address() as { port: number }).port;
      resolve({
        port,
        urlWithNonce: (ttlMs: number) =>
          `http://127.0.0.1:${port}/#${nonces.mint(nonceTtl ?? ttlMs)}`,
        close: () => new Promise<void>((done) => {
          idle.stop();
          server.close(() => { options.onExit?.('closed'); done(); });
          server.closeAllConnections();
        }),
      });
    });
  });
}

/** Main-module entry: what `test/ui/helpers.ts` spawns and what Task 15's command reuses. */
if (isMainEntry(import.meta.filename, process.argv[1])) {
  const argv = process.argv.slice(2);
  const flag = (name: string): string | null => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] ?? null : null;
  };
  const port = flag('port');
  const idleMs = flag('idle-ms');
  const nonceTtlMs = flag('nonce-ttl-ms');
  const host = flag('host');
  startUiServer({
    cwd: process.cwd(),
    port: port === null ? 0 : Number(port),
    ...(host === null ? {} : { host }),
    ...(idleMs === null ? {} : { idleMs: Number(idleMs) }),
    ...(nonceTtlMs === null ? {} : { nonceTtlMs: Number(nonceTtlMs) }),
    onExit: () => process.exit(0),
  }).then((running) => {
    console.log(`mycontext ui: ${running.urlWithNonce(PRINTED_NONCE_TTL_MS)}`);
  }).catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run the E2E suite and see it pass**

Run: `node --test test/ui/server-e2e.test.ts && npx tsc --noEmit`
Expected: PASS (6 tests). The idle test takes under a second (300ms window, 30ms poll).

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/ui/server.ts test/ui/helpers.ts test/ui/server-e2e.test.ts
git commit -m "feat(ui): http server with security gate, handoff nonce, ping, meta and idle exit"
```

---

## Task 14: The static import-graph test — **the enforcement of "no UI writes"**

This is the single most important test in the project (spec §6, §8's risk table): it is what turns "the UI executes no writes" from discipline into a property. It must fail if anyone, in any later plan, imports a mutating function — or a module containing one — anywhere the server can reach.

**Files:**
- Test: `test/ui/no-writes.test.ts`

**Interfaces:**
- Consumes: the server entry path `src/ui/server.ts`; the filesystem.
- Produces: the invariant plans 2 and 3 must design within — **their route modules will be imported by `server.ts` and therefore live inside this graph.** A plan-2 screen that needs revision data uses `src/core/revision-log.ts` (Task 6), never `revision.ts`; a screen that needs anything from `mutate.ts` cannot exist as specified and must go back to the spec.

- [ ] **Step 1: Write the test — it passes against Task 13's server, and that is expected: its value is failing FOREVER AFTER**

```ts
// test/ui/no-writes.test.ts
/**
 * THE no-writes enforcement (spec §2, §6): no module reachable from the UI
 * server's entry point imports or calls a mutating function. This test is the
 * mechanism behind the §8 risk row "a UI write silently voids the user's Bash
 * deny rules" — the deny rules match command STRINGS, an HTTP route is not a
 * command string, so the only acceptable number of write-capable routes is
 * zero, checked statically.
 *
 * Three assertions make the static analysis sound rather than hopeful:
 *  1. Neither src/core/mutate.ts nor src/core/revision.ts appears in the
 *     runtime import graph AT ALL. (revision.ts imports updateItem at runtime
 *     — revision.ts:5-8 — so banning the modules, not just the names, is what
 *     closes the transitive route. Read-only revision data comes from
 *     src/core/revision-log.ts, extracted for exactly this purpose.)
 *  2. No reachable module names a banned function in an import binding, from
 *     ANY module — so a re-export laundered through a third module still trips.
 *  3. No reachable module uses require() or dynamic import() — the escape
 *     hatches that would blind a static import walk. (`import type` is erased
 *     by erasableSyntaxOnly/verbatimModuleSyntax and is skipped: a type
 *     cannot be called.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');
const ENTRY = path.join(REPO, 'src', 'ui', 'server.ts');

const BANNED_MODULES = ['src/core/mutate.ts', 'src/core/revision.ts'].map((p) =>
  path.join(REPO, ...p.split('/')));

const BANNED_NAMES = [
  'createItem', 'updateItem', 'supersedeItem', 'linkItems', 'unlinkItems',
  'stageRevision', 'promoteRevision', 'discardRevision',
];

/**
 * Value imports/re-exports of relative modules. `import type { … }` and
 * `export type { … }` are erased at runtime and skipped. Node built-ins
 * (node:*) are not walked.
 */
const IMPORT_RE = /(?:^|\n)\s*(import|export)\s+(?!type\b)([^;]*?)\s*from\s*['"]([^'"]+)['"]/g;

function imports(file: string): { spec: string; bindings: string }[] {
  const source = readFileSync(file, 'utf8');
  const out: { spec: string; bindings: string }[] = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    out.push({ spec: match[3], bindings: match[2] });
  }
  return out;
}

function walkGraph(entry: string): Map<string, { spec: string; bindings: string }[]> {
  const seen = new Map<string, { spec: string; bindings: string }[]>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    const found = imports(file);
    seen.set(file, found);
    for (const { spec } of found) {
      if (!spec.startsWith('.')) continue; // node: builtins; no bare deps exist (zero-dependency)
      queue.push(path.resolve(path.dirname(file), spec));
    }
  }
  return seen;
}

test('no module reachable from the UI server imports a mutating module or function', () => {
  const graph = walkGraph(ENTRY);

  // 1. Module-level ban.
  for (const banned of BANNED_MODULES) {
    assert.ok(!graph.has(banned),
      `${path.relative(REPO, banned)} is reachable from src/ui/server.ts — the UI executes no writes`);
  }

  // 2. Name-level ban, belt and braces against re-export laundering.
  for (const [file, found] of graph) {
    for (const { spec, bindings } of found) {
      for (const name of BANNED_NAMES) {
        assert.ok(!new RegExp(`\\b${name}\\b`).test(bindings),
          `${path.relative(REPO, file)} imports ${name} (from ${spec})`);
      }
    }
  }

  // 3. Soundness: no dynamic escape hatches inside the graph.
  for (const file of graph.keys()) {
    const source = readFileSync(file, 'utf8');
    assert.ok(!/\brequire\s*\(/.test(source),
      `${path.relative(REPO, file)} uses require() — the static walk cannot see through it`);
    assert.ok(!/\bimport\s*\(/.test(source),
      `${path.relative(REPO, file)} uses dynamic import() — the static walk cannot see through it`);
  }

  // The graph is real: it must contain the read model and the core selector,
  // or this test is scanning nothing.
  assert.ok(graph.has(path.join(REPO, 'src', 'ui', 'read-model.ts')));
  assert.ok(graph.has(path.join(REPO, 'src', 'core', 'select.ts')));
});

test('the test itself fails when a banned import is introduced (self-check by construction)', () => {
  // Simulate: a graph in which some module imports promoteRevision. The
  // name-level regex must catch every spelling an ESM import can take.
  for (const bindings of [
    '{ promoteRevision }',
    '{ promoteRevision as apply }',
    '{ readLog, promoteRevision }',
  ]) {
    assert.ok(/\bpromoteRevision\b/.test(bindings), bindings);
  }
  // Namespace imports carry no names — which is why assertion 1 bans the
  // MODULES: `import * as revision from './revision.ts'` is caught by the
  // module ban, not the name ban. This assertion documents that division.
  assert.ok(!/\bpromoteRevision\b/.test('* as revision'));
});
```

- [ ] **Step 2: Run it and see it pass — then see it fail on a planted violation**

Run: `node --test test/ui/no-writes.test.ts` → PASS.

Now the step that proves the test is alive (every change needs a test that fails without it — here the "change" is the invariant, so the proof is a planted violation): add `import { createItem } from '../core/mutate.ts';` to the top of `src/ui/read-model.ts`, run the test again, and watch **both** assertion 1 (module ban) and assertion 2 (name ban) fire. Remove the planted line. Run once more: PASS. Do not skip this step; record its output in the task's commit message body.

- [ ] **Step 3: Run the whole suite**

Run: `npm test && npx tsc --noEmit`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add test/ui/no-writes.test.ts
git commit -m "test(ui): static import-graph proof that no /api route reaches a mutating function

Planted-violation check performed: importing createItem into read-model.ts
fails both the module ban and the name ban; removed before commit."
```

---

## Task 15: `open.ts` and the `mycontext ui` command

**Files:**
- Create: `src/ui/open.ts`
- Create: `src/cli/commands/ui.ts`
- Modify: `src/cli/commands/index.ts` (add `import './ui.ts';`)
- Test: `test/ui/open.test.ts`

**Interfaces:**
- Consumes: `startUiServer`, `OPENER_NONCE_TTL_MS`, `PRINTED_NONCE_TTL_MS` (Task 13), `registerCommand` (`registry.ts:34`).
- Produces:
  - `openBrowser(url: string, platform?: NodeJS.Platform, spawnFn?: typeof spawn): { command: string; args: string[] } | null` — returns what it spawned (for tests and for the fallback decision), `null` when the spawn failed. **This is the first `child_process` use in `src/`** — there were none before (verified by grep); zero dependencies is intact, "zero moving parts" is not, and this comment says so in the module rather than letting a reader assume it (spec §3).
  - The `ui` command: `mycontext ui [--port N] [--no-open]`, registered via `registerCommand` (the name is neither registered nor shadowed — `registry.ts:30-32`). The command starts the server in-process; the CLI main sets `process.exitCode` and never calls `process.exit` (`cli/index.ts:761-762`), so the live server keeps the event loop — and the process — alive until idle exit or Ctrl-C.

Token-channel rules, restated where they are implemented: the **spawned** URL carries a 10-second nonce (`OPENER_NONCE_TTL_MS`); the **printed** URL (`--no-open`, or fallback when the spawn fails) carries a `PRINTED_NONCE_TTL_MS` nonce; the token itself appears in neither, and never on any process command line.

- [ ] **Step 1: Write the failing test**

```ts
// test/ui/open.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openBrowser } from '../../src/ui/open.ts';

function fakeSpawn(): { calls: { command: string; args: string[] }[]; fn: any } {
  const calls: { command: string; args: string[] }[] = [];
  return {
    calls,
    fn: (command: string, args: string[]) => {
      calls.push({ command, args });
      return { unref() {}, on() {} };
    },
  };
}

test('win32 spawns cmd /c start with an empty title argument', () => {
  const { calls, fn } = fakeSpawn();
  const result = openBrowser('http://127.0.0.1:1/#n', 'win32', fn);
  assert.deepEqual(result, { command: 'cmd', args: ['/c', 'start', '', 'http://127.0.0.1:1/#n'] });
  assert.equal(calls.length, 1);
});

test('darwin uses open, linux uses xdg-open', () => {
  const { fn } = fakeSpawn();
  assert.equal(openBrowser('u', 'darwin', fn)?.command, 'open');
  assert.equal(openBrowser('u', 'linux', fn)?.command, 'xdg-open');
});

test('a spawn failure returns null — never a throw, never a hang (spec §3)', () => {
  const result = openBrowser('u', 'linux', () => { throw new Error('ENOENT'); });
  assert.equal(result, null);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/ui/open.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `open.ts`**

```ts
// src/ui/open.ts
import { spawn } from 'node:child_process';

/**
 * THE FIRST child_process USE IN src/. There were none before this module
 * (spec §3 says so and it was re-verified by grep at implementation time).
 * Zero runtime DEPENDENCIES is intact; "zero moving parts" is not, and this
 * comment exists so nobody assumes otherwise.
 *
 * The URL handed to this function carries a one-shot ~10-second handoff
 * nonce, never the token: on Windows the command line below is readable by
 * every local account for the lifetime of the spawn (spec §2 point 4), which
 * is exactly why the token must not be in it.
 *
 * The empty '' after `start` is the TITLE argument — `start` would otherwise
 * consume the quoted URL as a window title and open nothing (spec §3).
 */
export function openBrowser(
  url: string,
  platform: NodeJS.Platform = process.platform,
  spawnFn: typeof spawn = spawn,
): { command: string; args: string[] } | null {
  const [command, args] =
    platform === 'win32' ? ['cmd', ['/c', 'start', '', url] as string[]]
    : platform === 'darwin' ? ['open', [url]]
    : ['xdg-open', [url]];
  try {
    const child = spawnFn(command, args, { stdio: 'ignore', detached: true });
    child.unref();
    return { command, args };
  } catch {
    return null; // the caller prints the URL instead — never an error, never a hang
  }
}
```

- [ ] **Step 4: Implement the command**

```ts
// src/cli/commands/ui.ts
import type { Workspace } from '../../core/workspace.ts';
import { openBrowser } from '../../ui/open.ts';
import {
  OPENER_NONCE_TTL_MS, PRINTED_NONCE_TTL_MS, startUiServer,
} from '../../ui/server.ts';
import { flag, hasFlag, registerCommand, type Emit } from './registry.ts';

/**
 * Read-only web UI (web-ui spec). The server binds 127.0.0.1 only and exits
 * after 15 idle minutes — idle counts /api requests other than a stream, so
 * a forgotten background tab does not hold it up. Every write shown in the
 * UI is composed and pasted into the user's own shell; none executes here.
 */
function cmdUi(ws: Workspace, args: string[], out: Emit, cwd: string): number {
  let port: number;
  try {
    const raw = flag(args, 'port');
    port = raw === null ? 0 : Number(raw);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      out(`my_context: --port must be an integer 0-65535 (got ${JSON.stringify(raw)})`);
      return 1;
    }
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  }
  const noOpen = hasFlag(args, 'no-open');

  // The server outlives this function: runCli returns, the CLI main sets
  // process.exitCode without calling process.exit (cli/index.ts:761-762),
  // and the listening socket keeps the event loop alive until idle exit.
  startUiServer({ cwd, port, onExit: () => process.exit(0) })
    .then((running) => {
      if (noOpen) {
        out(`mycontext ui: ${running.urlWithNonce(PRINTED_NONCE_TTL_MS)}`);
        return;
      }
      const spawned = openBrowser(running.urlWithNonce(OPENER_NONCE_TTL_MS));
      if (spawned === null) {
        // Fallback IS the --no-open path (spec §3): print, never error.
        out(`mycontext ui: could not open a browser — visit ` +
          `${running.urlWithNonce(PRINTED_NONCE_TTL_MS)}`);
      } else {
        out(`mycontext ui: serving on 127.0.0.1:${running.port} (idle exit after 15 minutes)`);
      }
    })
    .catch((err) => {
      out(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    });
  return 0;
}

registerCommand({
  name: 'ui',
  usage: 'ui [--port N] [--no-open]',
  summary: 'read-only web UI on 127.0.0.1 — preview, coverage, reports',
  run: cmdUi,
});
```

Add to `src/cli/commands/index.ts`, in alphabetical position:

```ts
import './ui.ts';
```

Add a registration test (append to `test/ui/open.test.ts`):

```ts
import '../../src/cli/commands/index.ts';
import { COMMANDS } from '../../src/cli/commands/registry.ts';

test('mycontext ui is a registered command with the documented flags in its usage', () => {
  const def = COMMANDS.get('ui');
  assert.ok(def);
  assert.match(def!.usage, /--port/);
  assert.match(def!.usage, /--no-open/);
});
```

- [ ] **Step 5: Run the tests, the suite, and the typecheck**

Run: `node --test test/ui/open.test.ts && npm test && npx tsc --noEmit`
Expected: green. Note the no-writes test (Task 14) still passes: `cmd/ui.ts` imports `server.ts`, but the graph walked starts AT `server.ts`, and `server.ts` does not import the CLI.

- [ ] **Step 6: Commit**

```bash
git add src/ui/open.ts src/cli/commands/ui.ts src/cli/commands/index.ts test/ui/open.test.ts
git commit -m "feat(cli): mycontext ui command with per-platform browser opening and printed-URL fallback"
```

---

## Task 16: The app shell — bootstrap, heartbeat, i18n, router, exit banner

> **Mockup:** `docs/design/web-ui-mockup.html` shows the intended shell — top bar, nav rail grouped Core/Navigate/Watch/Work/Configure/Report/Ask & learn, footer strip, panel styling, light/dark tokens. Caution: its global search box and session-picker button are decoration (see `docs/design/web-ui-mockup.md`), its CSS uses physical properties this plan forbids, and it has no exit banner, heartbeat or language switch — those come from the spec, not the mockup.

Browser code is plain `.js` ES modules (no types — the browser cannot strip them). The pure logic lives in `lib/` modules that `node --test` imports directly; the DOM glue is thin and, per spec §6, untested — the test file says so.

**Files:**
- Create: `src/ui/public/lib/bootstrap.js`, `src/ui/public/lib/heartbeat.js`, `src/ui/public/lib/i18n.js`
- Replace: `src/ui/public/index.html`, `src/ui/public/styles.css` (the Task 12 placeholders)
- Create: `src/ui/public/app.js`
- Test: `test/ui/viewmodel.test.ts` (starts here; Tasks 17-19 extend it)

**Interfaces:**
- Consumes: `POST /api/handoff`, `GET /api/ping`, `GET /api/sessions`, `GET /api/meta`, the string tables (Task 1).
- Produces (screens in Tasks 17-19, and plans 2/3's screens, use these):
  - `bootstrap.js`: `extractNonce(hash: string): string | null` (pure), and `exchangeNonce(fetchFn, nonce): Promise<string | null>`.
  - `heartbeat.js`: `shouldPing(visibilityState: string): boolean` (pure — the §2 rule in one line), `startHeartbeat(doc, pingFn, intervalMs)`.
  - `i18n.js`: `pickLanguage(stored, navigatorLang): 'en' | 'he'` (pure), `t(strings, key, subs): string` (pure — `{name}` substitution; a missing key **throws**, so a screen referencing an undeclared key fails in development rather than rendering blank), `applyLanguage(documentEl, table)` sets `<html dir>` and `lang` (spec §3).
  - `app.js`: `window.myctx = { api(path): Promise<any>, t(key, subs), session(): string | null | 'cold', onSessionChange(fn), navigate(hash) }` — the screen contract. `api()` adds the token header; any network failure (server gone) renders the `app.serverExited` banner and **does not reconnect** (spec §2: silent reconnection would reintroduce the daemon by another name).

- [ ] **Step 1: Write the failing tests for the pure logic**

```ts
// test/ui/viewmodel.test.ts
/**
 * Pure browser-module logic, tested in Node. THE LIMIT, stated rather than
 * papered over (spec §6): the DOM rendering in app.js and screens/*.js has no
 * test — that would need a browser dependency this project does not have. A
 * green run here verifies the view-models, not the pixels.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('extractNonce reads the fragment and rejects junk', async () => {
  const { extractNonce } = await import('../../src/ui/public/lib/bootstrap.js');
  assert.equal(extractNonce('#abc123'), 'abc123');
  assert.equal(extractNonce(''), null);
  assert.equal(extractNonce('#'), null);
  assert.equal(extractNonce('#not hex!'), null);
});

test('shouldPing is the visibility rule and nothing else', async () => {
  const { shouldPing } = await import('../../src/ui/public/lib/heartbeat.js');
  assert.equal(shouldPing('visible'), true);
  assert.equal(shouldPing('hidden'), false);
  assert.equal(shouldPing('prerender'), false);
});

test('t() substitutes placeholders and THROWS on a missing key', async () => {
  const { t } = await import('../../src/ui/public/lib/i18n.js');
  const strings = { 'a.b': 'hello {name}, {n} items' };
  assert.equal(t(strings, 'a.b', { name: 'x', n: 3 }), 'hello x, 3 items');
  assert.throws(() => t(strings, 'a.missing'));
});

test('pickLanguage prefers the stored choice, then the navigator, then en', async () => {
  const { pickLanguage } = await import('../../src/ui/public/lib/i18n.js');
  assert.equal(pickLanguage('he', 'en-US'), 'he');
  assert.equal(pickLanguage(null, 'he-IL'), 'he');
  assert.equal(pickLanguage(null, 'fr-FR'), 'en');
  assert.equal(pickLanguage('nonsense', 'he-IL'), 'he'); // junk storage is ignored, not honoured
});
```

- [ ] **Step 2: Run and see them fail**

Run: `node --test test/ui/viewmodel.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the lib modules**

```js
// src/ui/public/lib/bootstrap.js
// The page receives a one-shot handoff NONCE in the URL fragment — never the
// token, and the fragment is never sent to the server or a referrer (spec §2).
// It exchanges the nonce once, then history.replaceState()s the fragment away.

export function extractNonce(hash) {
  const value = hash.startsWith('#') ? hash.slice(1) : '';
  return /^[0-9a-f]+$/.test(value) ? value : null;
}

export async function exchangeNonce(fetchFn, nonce) {
  const response = await fetchFn('/api/handoff', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nonce }),
  });
  if (!response.ok) return null;
  return (await response.json()).token;
}
```

```js
// src/ui/public/lib/heartbeat.js
// The page heartbeats ONLY while visible (spec §2): a tab in a background
// window stops pinging, so a forgotten tab stops holding the server up
// within one idle window.

export function shouldPing(visibilityState) {
  return visibilityState === 'visible';
}

export function startHeartbeat(doc, pingFn, intervalMs) {
  const timer = setInterval(() => {
    if (shouldPing(doc.visibilityState)) pingFn();
  }, intervalMs);
  return () => clearInterval(timer);
}
```

```js
// src/ui/public/lib/i18n.js
export function pickLanguage(stored, navigatorLang) {
  if (stored === 'en' || stored === 'he') return stored;
  return String(navigatorLang || '').toLowerCase().startsWith('he') ? 'he' : 'en';
}

// A missing key THROWS: a screen naming an undeclared key must fail loudly in
// development, not render a blank — the parity test keeps en/he equal, and
// this keeps screens honest against both.
export function t(strings, key, subs = {}) {
  const template = strings[key];
  if (template === undefined) throw new Error(`missing string key: ${key}`);
  return template.replace(/\{(\w+)\}/g, (m, name) =>
    Object.prototype.hasOwnProperty.call(subs, name) ? String(subs[name]) : m);
}

export function applyLanguage(documentEl, table) {
  documentEl.setAttribute('lang', table.lang);
  documentEl.setAttribute('dir', table.dir); // <html dir> follows the language (spec §3)
}
```

- [ ] **Step 4: Write the shell**

`src/ui/public/index.html` (replaces the placeholder):

```html
<!doctype html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>mycontext</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header id="topbar">
    <span id="app-title"></span>
    <nav id="nav"></nav>
    <label id="session-box"><span id="session-label"></span>
      <select id="session-picker"></select>
    </label>
    <label id="lang-box"><span id="lang-label"></span>
      <select id="lang-picker">
        <option value="en">English</option>
        <option value="he">עברית</option>
      </select>
    </label>
  </header>
  <main id="screen"></main>
  <div id="banner" hidden></div>
  <script type="module" src="/app.js"></script>
</body>
</html>
```

`src/ui/public/styles.css` (replaces the placeholder) — **logical properties only; a physical `left`/`right`/`margin-left`/`text-align: left` anywhere in this file is a defect** (spec §3). The full starting stylesheet:

```css
:root {
  --ink: #1a1a1a; --paper: #ffffff; --line: #d0d0d0;
  --accent: #205a9e; --warn: #a05a00; --bad: #a01a1a; --dim: #6a6a6a;
}
* { box-sizing: border-box; }
body {
  margin: 0; color: var(--ink); background: var(--paper);
  font: 15px/1.5 system-ui, sans-serif;
}
#topbar {
  display: flex; align-items: center; gap: 1rem;
  padding-block: 0.5rem; padding-inline: 1rem;
  border-block-end: 1px solid var(--line);
}
#nav { display: flex; gap: 0.75rem; margin-inline-end: auto; }
#nav a { color: var(--accent); text-decoration: none; }
#nav a.active { text-decoration: underline; }
#screen { padding-block: 1rem; padding-inline: 1rem; max-inline-size: 72rem; }
#banner {
  padding-block: 0.75rem; padding-inline: 1rem;
  background: var(--bad); color: var(--paper);
  position: sticky; inset-block-start: 0;
}
table { border-collapse: collapse; }
td, th { border: 1px solid var(--line); padding-block: 0.25rem; padding-inline: 0.5rem; text-align: start; }
code, pre { font-family: ui-monospace, monospace; }
/* Paths and code stay LTR inside an RTL page — a path is not prose (spec §3,
   "honestly out of scope"), a decision and not a bug. */
[dir="rtl"] code, [dir="rtl"] pre, [dir="rtl"] .path { direction: ltr; unicode-bidi: isolate; }
.spill { color: var(--warn); }
.gap { color: var(--bad); }
.dim { color: var(--dim); }
.bar { block-size: 1rem; background: var(--accent); }
.bar-track { inline-size: 100%; background: var(--line); }
@media print {
  /* The coverage map's printable rendering (spec §4: the onboarding view
     survives as the map's print stylesheet — same artefact, no second
     implementation, still the thing you screenshot). */
  #topbar, #banner, .no-print { display: none; }
  #screen { max-inline-size: none; }
}
```

`src/ui/public/app.js`:

```js
import { extractNonce, exchangeNonce } from '/lib/bootstrap.js';
import { startHeartbeat } from '/lib/heartbeat.js';
import { applyLanguage, pickLanguage, t as translate } from '/lib/i18n.js';

const SCREENS = {
  preview: () => import('/screens/preview.js'),
  simulate: () => import('/screens/simulate.js'),
  injected: () => import('/screens/injected.js'),
  coverage: () => import('/screens/coverage.js'),
  graph: () => import('/screens/graph.js'),
  status: () => import('/screens/status.js'),
  doctor: () => import('/screens/doctor.js'),
  decay: () => import('/screens/decay.js'),
  learn: () => import('/screens/learn.js'),
};
const NAV = [
  ['nav.core', ['preview', 'simulate', 'injected']],
  ['nav.navigate', ['coverage', 'graph']],
  ['nav.report', ['status', 'doctor', 'decay']],
  ['nav.learn', ['learn']],
];

let token = null;
let table = null;
let sessionValue = 'cold';
const sessionListeners = [];

function banner(text) {
  const el = document.getElementById('banner');
  el.textContent = text;
  el.hidden = false;
}

async function api(path) {
  let response;
  try {
    response = await fetch(path, { headers: { 'X-Mycontext-Token': token } });
  } catch {
    // The server has exited (idle or closed). Say so; NEVER reconnect —
    // silent reconnection would reintroduce the daemon by another name (§2).
    banner(translate(table.strings, 'app.serverExited'));
    stopHeartbeat();
    throw new Error('server exited');
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || String(response.status));
  return body;
}

let stopHeartbeat = () => {};

function currentSession() { return sessionValue; }

async function loadSessions() {
  const picker = document.getElementById('session-picker');
  const data = await api('/api/sessions');
  picker.innerHTML = '';
  const cold = document.createElement('option');
  cold.value = 'cold';
  cold.textContent = translate(table.strings, 'session.cold');
  for (const s of data.sessions) {
    const opt = document.createElement('option');
    opt.value = s.sessionId;
    opt.textContent = `${s.sessionId} — ${translate(table.strings, 'session.lastInjection', { when: s.lastInjectedAt })}`;
    picker.append(opt);
  }
  picker.append(cold); // cold is last, explicitly labelled — never the default when a session exists
  if (data.sessions.length === 0) {
    cold.textContent = translate(table.strings, 'session.empty');
    sessionValue = 'cold';
  } else {
    sessionValue = data.default; // Ledger.recentSessions(1)[0] — repeatable across loads (§3)
  }
  picker.value = sessionValue;
  picker.onchange = () => {
    sessionValue = picker.value;
    for (const fn of sessionListeners) fn(sessionValue);
  };
}

function renderNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = '';
  for (const [groupKey, names] of NAV) {
    const group = document.createElement('span');
    group.append(`${translate(table.strings, groupKey)}: `);
    for (const name of names) {
      const a = document.createElement('a');
      a.href = `#/${name}`;
      a.textContent = name;
      a.className = location.hash === `#/${name}` ? 'active' : '';
      group.append(a, ' ');
    }
    nav.append(group);
  }
}

async function route() {
  // Decision 5: the landing screen is the injection preview, at
  // event=session-start on the most recent session, rendering with no input.
  // NOT 'status' -- that screen is built by Task 19 and deferred to wave 3.
  const name = (location.hash.replace(/^#\//, '') || 'preview');
  const loader = SCREENS[name] || SCREENS.preview;
  renderNav();
  const root = document.getElementById('screen');
  root.textContent = translate(table.strings, 'common.loading');
  const mod = await loader();
  await mod.render(root, window.myctx);
}

async function main() {
  const lang = pickLanguage(localStorage.getItem('myctx-lang'), navigator.language);
  table = await import(`/strings/${lang}.js`);
  applyLanguage(document.documentElement, table);
  document.getElementById('app-title').textContent = translate(table.strings, 'app.title');
  document.getElementById('session-label').textContent = translate(table.strings, 'session.label');
  document.getElementById('lang-label').textContent = translate(table.strings, 'app.language');
  const langPicker = document.getElementById('lang-picker');
  langPicker.value = lang;
  langPicker.onchange = () => { localStorage.setItem('myctx-lang', langPicker.value); location.reload(); };

  const nonce = extractNonce(location.hash);
  if (nonce !== null) {
    token = await exchangeNonce(fetch.bind(window), nonce);
    history.replaceState(null, '', location.pathname); // the fragment dies here (§2)
  }
  if (token === null) {
    banner(translate(table.strings, 'app.serverExited'));
    return;
  }

  window.myctx = {
    api,
    t: (key, subs) => translate(table.strings, key, subs),
    session: currentSession,
    onSessionChange: (fn) => sessionListeners.push(fn),
    navigate: (hash) => { location.hash = hash; },
  };

  await loadSessions();
  stopHeartbeat = startHeartbeat(document, () => api('/api/ping').catch(() => {}), 60_000);
  window.addEventListener('hashchange', route);
  await route();
}

main();
```

Routing note: the nonce arrives in the fragment, so `route()` runs only after the exchange (`main` awaits it before wiring `hashchange`); the default screen is `status` — the recorded landing-screen exception.

- [ ] **Step 5: Run the pure-logic tests and the suite**

Run: `node --test test/ui/viewmodel.test.ts && npm test`
Expected: green (the server E2E from Task 13 still passes — it fetches `/`, which now serves the real shell).

- [ ] **Step 6: Smoke it by hand once**

Run: `node src/cli/index.ts ui --no-open` in this repository, open the printed URL, and confirm: the shell loads, the session picker shows cold (or sessions), Hebrew flips `dir` to rtl, and killing the server makes the next click show the exit banner without reconnecting. (Manual because rendering is untestable — the limit §6 states.)

- [ ] **Step 7: Commit**

```bash
git add src/ui/public test/ui/viewmodel.test.ts
git commit -m "feat(ui): app shell — nonce bootstrap, visibility-gated heartbeat, i18n with RTL, exit banner"
```

---

## Task 17: Core screens — injection preview, budget simulator, current injections

> **Mockup:** the "Injection preview", "Budget simulator" and "Injected now" sections of `docs/design/web-ui-mockup.html` show the intended rendering (terminal-style preview with the spill note, budget bar with delivered/spilled/free, considered table, per-session delivered table). Its data is fabricated and its simulator is a greedy loop over a hard-coded list — the real screens call `/api/select`/`/api/simulate`. Spec outranks it (`docs/design/web-ui-mockup.md`).

**Files:**
- Create: `src/ui/public/screens/preview.js`, `src/ui/public/screens/simulate.js`, `src/ui/public/screens/injected.js`
- Create: `src/ui/public/lib/viewmodel.js` (shared pure helpers; grows in Tasks 18-19)
- Test: extend `test/ui/viewmodel.test.ts`

**Interfaces:**
- Consumes: `window.myctx` (Task 16), `/api/select`, `/api/render`, `/api/simulate`, `/api/coverage` (file list for the picker), `/api/session/:id/injected`.
- Produces: each screen module exports `render(root: HTMLElement, ctx): Promise<void>`; `viewmodel.js` exports `selectQuery(event, path, session, extra?): string` (pure — builds the query string all three Core screens share, cold labelled by construction) and `budgetBar(used, budget): { pct: number, over: boolean }` (pure).

- [ ] **Step 1: Failing tests for the pure helpers** (append to `test/ui/viewmodel.test.ts`)

```ts
test('selectQuery builds the shared grammar, cold vs session', async () => {
  const { selectQuery } = await import('../../src/ui/public/lib/viewmodel.js');
  assert.equal(selectQuery('tool', 'src/a.ts', 'cold'), 'event=tool&path=src%2Fa.ts&cold=1');
  assert.equal(selectQuery('session-start', null, 's1'), 'event=session-start&session=s1');
  assert.equal(selectQuery('tool', 'a b.ts', 's1', { jit: 100 }), 'event=tool&path=a+b.ts&session=s1&jit=100');
});

test('budgetBar computes fill and overflow', async () => {
  const { budgetBar } = await import('../../src/ui/public/lib/viewmodel.js');
  assert.deepEqual(budgetBar(50, 200), { pct: 25, over: false });
  assert.deepEqual(budgetBar(300, 200), { pct: 100, over: true });
  assert.deepEqual(budgetBar(0, 0), { pct: 0, over: false });
});
```

- [ ] **Step 2: See them fail, then implement `viewmodel.js`**

```js
// src/ui/public/lib/viewmodel.js
export function selectQuery(event, path, session, extra = {}) {
  const qs = new URLSearchParams();
  qs.set('event', event);
  if (path !== null && path !== undefined) qs.set('path', path);
  if (session === 'cold') qs.set('cold', '1');
  else qs.set('session', session);
  for (const [key, value] of Object.entries(extra)) qs.set(key, String(value));
  return qs.toString();
}

export function budgetBar(used, budget) {
  if (budget <= 0) return { pct: 0, over: used > 0 ? true : false };
  return { pct: Math.min(100, Math.round((used / budget) * 100)), over: used > budget };
}
```

- [ ] **Step 3: Implement the three screens**

```js
// src/ui/public/screens/preview.js
// Core §4: pick a file and a session; see exactly what Claude gets, with the
// budget bar and what spilled. Rests on /api/select WITH seen — wrong in a
// way nobody would notice without it (spec §3).
import { selectQuery, budgetBar } from '/lib/viewmodel.js';

export async function render(root, ctx) {
  root.innerHTML = '';
  const h = document.createElement('h1');
  h.textContent = ctx.t('preview.title');
  root.append(h);

  const coverage = await ctx.api('/api/coverage');
  const picker = document.createElement('select');
  for (const f of coverage.files) {
    const opt = document.createElement('option');
    opt.value = f.path; opt.textContent = f.path; opt.className = 'path';
    picker.append(opt);
  }
  const label = document.createElement('label');
  label.append(`${ctx.t('preview.pickFile')}: `, picker);
  root.append(label);

  const out = document.createElement('div');
  root.append(out);

  async function show() {
    out.textContent = ctx.t('common.loading');
    const qs = selectQuery('tool', picker.value, ctx.session());
    const [selection, sim, rendered] = await Promise.all([
      ctx.api(`/api/select?${qs}`),
      ctx.api(`/api/simulate?${qs}`),
      ctx.api(`/api/render?${qs}`),
    ]);
    out.innerHTML = '';
    if (selection.full.length === 0 && selection.spilled.length === 0) {
      out.append(ctx.t('preview.nothing'));
      return;
    }
    const used = sim.costs
      .filter((c) => selection.full.some((e) => e.item.id === c.id))
      .reduce((sum, c) => sum + c.tokens, 0);
    const bar = budgetBar(used, sim.budgets.jit);
    const track = document.createElement('div');
    track.className = 'bar-track';
    const fill = document.createElement('div');
    fill.className = 'bar';
    fill.style.inlineSize = `${bar.pct}%`;
    track.append(fill);
    out.append(track, `${used} / ${sim.budgets.jit}`);

    const list = document.createElement('ul');
    for (const entry of selection.full) {
      const li = document.createElement('li');
      const cost = sim.costs.find((c) => c.id === entry.item.id);
      li.append(`${entry.item.id} [${entry.tier}] ${entry.item.title} (${cost ? cost.tokens : '?'})`);
      list.append(li);
    }
    out.append(list);

    if (selection.spilled.length > 0) {
      const sh = document.createElement('h2');
      sh.textContent = ctx.t('preview.spilled');
      out.append(sh);
      const spills = document.createElement('ul');
      for (const s of selection.spilled) {
        const li = document.createElement('li');
        li.className = 'spill';
        li.append(`${s.id} [${s.tier}] — ${s.reason}`);
        spills.append(li);
      }
      out.append(spills);
    }

    const th = document.createElement('h2');
    th.textContent = ctx.t('preview.renderedText');
    const pre = document.createElement('pre');
    pre.textContent = rendered.text;
    out.append(th, pre);
  }

  picker.onchange = show;
  ctx.onSessionChange(show);
  await show();
}
```

```js
// src/ui/public/screens/simulate.js
// Core §4: drag the budget, watch what fits — the screen that would have made
// the 1.0 default-budget change a five-second exercise.
import { selectQuery } from '/lib/viewmodel.js';

const TIERS = [['pinned', 'session-start'], ['jit', 'tool']];

export async function render(root, ctx) {
  root.innerHTML = '';
  const h = document.createElement('h1');
  h.textContent = ctx.t('simulate.title');
  root.append(h);

  const coverage = await ctx.api('/api/coverage');
  const firstPath = coverage.files.length > 0 ? coverage.files[0].path : null;

  for (const [tier, event] of TIERS) {
    const section = document.createElement('section');
    const title = document.createElement('h2');
    title.textContent = ctx.t('simulate.budget', { tier });
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = '0'; slider.max = '20000'; slider.step = '100';
    const value = document.createElement('span');
    const result = document.createElement('p');
    section.append(title, slider, value, result);
    root.append(section);

    async function run() {
      value.textContent = ` ${slider.value}`;
      if (event === 'tool' && firstPath === null) { result.textContent = ''; return; }
      const qs = selectQuery(event, event === 'tool' ? firstPath : null, ctx.session(),
        { [tier]: slider.value });
      const sim = await ctx.api(`/api/simulate?${qs}`);
      result.textContent =
        `${ctx.t('simulate.fits', { n: sim.selection.full.length })}, ` +
        `${ctx.t('simulate.spills', { n: sim.selection.spilled.length })}`;
    }
    let pending = null;
    slider.oninput = () => { clearTimeout(pending); pending = setTimeout(run, 150); };
    const defaults = await ctx.api(`/api/simulate?${selectQuery(event, event === 'tool' ? firstPath : null, 'cold')}`);
    slider.value = String(defaults.budgets[tier]);
    await run();
  }
}
```

```js
// src/ui/public/screens/injected.js
// Core §4: live state for the selected session, from the ledger — not a hypothetical.
export async function render(root, ctx) {
  root.innerHTML = '';
  const h = document.createElement('h1');
  h.textContent = ctx.t('injected.title');
  root.append(h);
  const out = document.createElement('div');
  root.append(out);

  async function show() {
    const session = ctx.session();
    if (session === 'cold') { out.textContent = ctx.t('injected.none'); return; }
    const data = await ctx.api(`/api/session/${encodeURIComponent(session)}/injected`);
    out.innerHTML = '';
    if (data.entries.length === 0) { out.append(ctx.t('injected.none')); return; }
    const table = document.createElement('table');
    for (const e of data.entries) {
      const tr = document.createElement('tr');
      for (const cell of [e.itemId, e.tier, e.injectedAt, e.title ?? '—']) {
        const td = document.createElement('td');
        td.textContent = String(cell);
        tr.append(td);
      }
      table.append(tr);
    }
    out.append(table);
  }
  ctx.onSessionChange(show);
  await show();
}
```

- [ ] **Step 4: Run tests, suite, and smoke**

Run: `node --test test/ui/viewmodel.test.ts && npm test`, then repeat Task 16's manual smoke on the three screens.
Expected: green; screens render against this repository's own corpus.

- [ ] **Step 5: Commit**

```bash
git add src/ui/public/lib/viewmodel.js src/ui/public/screens test/ui/viewmodel.test.ts
git commit -m "feat(ui): Core screens — preview with seen, budget simulator, current injections"
```

---

## Task 18: Navigate — coverage map with detail pane, gaps and print mode; ego graph

> **Mockup:** the "Coverage map", "Coverage gaps" and "Relations" sections of `docs/design/web-ui-mockup.html` show the intended rendering — tree with density dots and gap styling, detail pane, gap panels, and a radius-1 ego-graph SVG with a dangling edge. Its "Printable" button is a toast, not a print mode, and its data is fabricated. Spec outranks it (`docs/design/web-ui-mockup.md`).

**Files:**
- Create: `src/ui/public/screens/coverage.js`, `src/ui/public/screens/graph.js`
- Modify: `src/ui/public/lib/viewmodel.js` (tree building, gap derivation, layered layout — all pure)
- Test: extend `test/ui/viewmodel.test.ts`

**Interfaces:**
- Consumes: `/api/coverage`, `/api/graph`, `/api/select` (detail pane), `/api/items`.
- Produces (pure, in `viewmodel.js`):
  - `buildTree(files: { path, governs }[]): TreeNode` where `TreeNode = { name, path, children: TreeNode[], governs: string[], fileCount: number, governedCount: number }` — directories aggregate; a directory's `governs` is the union of its files'.
  - `coverageGaps(tree: TreeNode): string[]` — directory paths whose `governedCount === 0` (the §4 inverse view; empty categories come from `/api/status`).
  - `layoutGraph(nodes, edges, focusId): { id, x, y }[]` — deterministic layered layout: focus at column 0, neighbours in columns by BFS depth, rows sorted by (relation type of the connecting edge, id) — no force simulation, no physics (spec §4).

- [ ] **Step 1: Failing tests** (append to `test/ui/viewmodel.test.ts`)

```ts
test('buildTree aggregates governance up directories; coverageGaps names the ungoverned', async () => {
  const { buildTree, coverageGaps } = await import('../../src/ui/public/lib/viewmodel.js');
  const tree = buildTree([
    { path: 'src/a.ts', governs: ['RULE-1'] },
    { path: 'src/b.ts', governs: [] },
    { path: 'docs/x.md', governs: [] },
  ]);
  const src = tree.children.find((c) => c.name === 'src');
  const docs = tree.children.find((c) => c.name === 'docs');
  assert.deepEqual(src?.governs, ['RULE-1']);
  assert.equal(src?.fileCount, 2);
  assert.equal(src?.governedCount, 1);
  assert.equal(docs?.governedCount, 0);
  assert.deepEqual(coverageGaps(tree), ['docs']);
});

test('layoutGraph is deterministic and layered by BFS depth', async () => {
  const { layoutGraph } = await import('../../src/ui/public/lib/viewmodel.js');
  const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
  const edges = [
    { from: 'A', to: 'B', type: 'supersedes' },
    { from: 'A', to: 'C', type: 'relates' },
  ];
  const first = layoutGraph(nodes, edges, 'A');
  const second = layoutGraph(nodes, edges, 'A');
  assert.deepEqual(first, second); // deterministic — run twice, same pixels
  const a = first.find((p) => p.id === 'A');
  const b = first.find((p) => p.id === 'B');
  const c = first.find((p) => p.id === 'C');
  assert.equal(a?.x, 0);
  assert.equal(b?.x, 1);
  assert.equal(c?.x, 1);
  assert.notEqual(b?.y, c?.y);
});
```

- [ ] **Step 2: See them fail, implement the view-models** (append to `viewmodel.js`)

```js
export function buildTree(files) {
  const root = { name: '', path: '', children: [], governs: [], fileCount: 0, governedCount: 0 };
  const dirs = new Map([['', root]]);
  const ensureDir = (dirPath) => {
    if (dirs.has(dirPath)) return dirs.get(dirPath);
    const idx = dirPath.lastIndexOf('/');
    const parent = ensureDir(idx === -1 ? '' : dirPath.slice(0, idx));
    const node = {
      name: idx === -1 ? dirPath : dirPath.slice(idx + 1),
      path: dirPath, children: [], governs: [], fileCount: 0, governedCount: 0,
    };
    parent.children.push(node);
    dirs.set(dirPath, node);
    return node;
  };
  for (const file of files) {
    const idx = file.path.lastIndexOf('/');
    const dir = ensureDir(idx === -1 ? '' : file.path.slice(0, idx));
    const leaf = {
      name: idx === -1 ? file.path : file.path.slice(idx + 1),
      path: file.path, children: [], governs: [...file.governs].sort(),
      fileCount: 1, governedCount: file.governs.length > 0 ? 1 : 0,
    };
    dir.children.push(leaf);
    for (let d = dir; d; d = dirs.get(d.path.includes('/') ? d.path.slice(0, d.path.lastIndexOf('/')) : (d.path === '' ? null : ''))) {
      d.fileCount += 1;
      if (leaf.governedCount) d.governedCount += 1;
      for (const id of leaf.governs) if (!d.governs.includes(id)) d.governs.push(id);
      if (d.path === '') break;
    }
  }
  const sortRec = (node) => {
    node.children.sort((a, b) => (a.children.length > 0) !== (b.children.length > 0)
      ? (a.children.length > 0 ? -1 : 1)
      : a.name < b.name ? -1 : 1);
    node.governs.sort();
    node.children.forEach(sortRec);
  };
  sortRec(root);
  return root;
}

export function coverageGaps(tree) {
  const gaps = [];
  const walk = (node) => {
    if (node.path !== '' && node.children.some((c) => c.children.length > 0 || c.fileCount === 1) &&
        node.children.length > 0 && node.governedCount === 0) {
      gaps.push(node.path);
      return; // the deepest ungoverned ancestor is the useful name; children add noise
    }
    node.children.filter((c) => c.children.length > 0).forEach(walk);
  };
  walk(tree);
  return gaps.sort();
}

export function layoutGraph(nodes, edges, focusId) {
  const depth = new Map([[focusId, 0]]);
  const adjacency = new Map();
  for (const e of edges) {
    for (const [a, b] of [[e.from, e.to], [e.to, e.from]]) {
      if (!adjacency.has(a)) adjacency.set(a, []);
      adjacency.get(a).push({ other: b, type: e.type });
    }
  }
  for (const list of adjacency.values()) {
    list.sort((a, b) => a.type < b.type ? -1 : a.type > b.type ? 1 : a.other < b.other ? -1 : 1);
  }
  const order = [focusId];
  for (let i = 0; i < order.length; i++) {
    for (const n of adjacency.get(order[i]) ?? []) {
      if (!depth.has(n.other) && nodes.some((node) => node.id === n.other)) {
        depth.set(n.other, depth.get(order[i]) + 1);
        order.push(n.other);
      }
    }
  }
  const rows = new Map();
  return order.map((id) => {
    const x = depth.get(id);
    const y = rows.get(x) ?? 0;
    rows.set(x, y + 1);
    return { id, x, y };
  });
}
```

Run the two tests; if `buildTree`'s upward aggregation loop proves wrong against them (the parent-walk is the fiddly part), fix the loop until the assertions pass — the assertions, not the loop, are the contract.

- [ ] **Step 3: Implement the two screens**

```js
// src/ui/public/screens/coverage.js
// The coverage map (spec §3/§4): matchesScope + injection() SERVER-side —
// this module renders and never re-derives a matching rule. The gaps are the
// point; the print stylesheet is the onboarding view; the detail pane is the
// file browser, merged (spec §4).
import { buildTree, coverageGaps, selectQuery } from '/lib/viewmodel.js';

export async function render(root, ctx) {
  root.innerHTML = '';
  const h = document.createElement('h1');
  h.textContent = ctx.t('coverage.title');
  root.append(h);

  const data = await ctx.api('/api/coverage');
  if (data.truncated) {
    const warn = document.createElement('p');
    warn.className = 'spill';
    warn.textContent = ctx.t('coverage.truncated', { n: data.files.length });
    root.append(warn);
  }
  const status = await ctx.api('/api/status');
  const tree = buildTree(data.files);
  const itemsById = new Map(data.items.map((i) => [i.id, i]));

  const printBtn = document.createElement('button');
  printBtn.className = 'no-print';
  printBtn.textContent = ctx.t('coverage.print');
  printBtn.onclick = () => print();
  root.append(printBtn);

  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.gap = '2rem';
  const treeBox = document.createElement('div');
  const detail = document.createElement('div');
  wrap.append(treeBox, detail);
  root.append(wrap);

  function nodeLine(node) {
    const line = document.createElement('div');
    const label = document.createElement('span');
    label.className = node.governedCount === 0 ? 'gap path' : 'path';
    label.textContent = `${node.name || '/'} `;
    const meta = document.createElement('span');
    meta.className = 'dim';
    meta.textContent = `(${node.governedCount}/${node.fileCount})`;
    line.append(label, meta);
    label.style.cursor = 'pointer';
    label.onclick = () => showDetail(node);
    return line;
  }

  function renderTree(node, into, indent) {
    const line = nodeLine(node);
    line.style.paddingInlineStart = `${indent}rem`;
    into.append(line);
    for (const child of node.children) renderTree(child, into, indent + 1);
  }
  renderTree(tree, treeBox, 0);

  async function showDetail(node) {
    detail.innerHTML = '';
    const t1 = document.createElement('h2');
    t1.textContent = ctx.t('coverage.governs');
    detail.append(t1);
    const list = document.createElement('ul');
    for (const id of node.governs) {
      const item = itemsById.get(id);
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#/graph';
      a.onclick = () => sessionStorage.setItem('myctx-focus', id);
      a.textContent = `${id} — ${item ? item.title : ''}`;
      li.append(a, ` (${item ? item.phrase : ''})`);
      list.append(li);
    }
    detail.append(list);
    if (node.children.length === 0) {
      const t2 = document.createElement('h2');
      t2.textContent = ctx.t('coverage.wouldInject');
      detail.append(t2);
      const sel = await ctx.api(`/api/select?${selectQuery('tool', node.path, ctx.session())}`);
      const ul = document.createElement('ul');
      for (const e of sel.full) {
        const li = document.createElement('li');
        li.textContent = `${e.item.id} [${e.tier}]`;
        ul.append(li);
      }
      detail.append(ul);
    }
  }

  const gapsH = document.createElement('h2');
  gapsH.textContent = ctx.t('coverage.gaps');
  root.append(gapsH);
  const gapDirs = document.createElement('p');
  gapDirs.textContent = `${ctx.t('coverage.gapDirs')}: ${coverageGaps(tree).join(', ') || '—'}`;
  gapDirs.className = 'path';
  const emptyCats = Object.entries(status.items.byCategory).length >= 0
    ? Object.values(await ctx.api('/api/help/categories').then((r) => r.corpus.empty)) : [];
  const catLine = document.createElement('p');
  catLine.textContent = `${ctx.t('coverage.emptyCategories')}: ${emptyCats.join(', ') || '—'}`;
  root.append(gapDirs, catLine);
}
```

```js
// src/ui/public/screens/graph.js
// An ego-graph, not a hairball (spec §4): one focus, radius 1-2, layered
// deterministic layout, 60-node cap with an explicit "+N more", no physics.
import { layoutGraph } from '/lib/viewmodel.js';

const CELL_X = 220; const CELL_Y = 48;

export async function render(root, ctx) {
  root.innerHTML = '';
  const h = document.createElement('h1');
  h.textContent = ctx.t('graph.title');
  root.append(h);

  const items = await ctx.api('/api/items');
  const picker = document.createElement('select');
  for (const i of items.items) {
    const opt = document.createElement('option');
    opt.value = i.id; opt.textContent = `${i.id} — ${i.title}`;
    picker.append(opt);
  }
  const stored = sessionStorage.getItem('myctx-focus');
  if (stored && items.items.some((i) => i.id === stored)) picker.value = stored;
  sessionStorage.removeItem('myctx-focus');

  const radius = document.createElement('select');
  for (const r of ['1', '2']) {
    const opt = document.createElement('option');
    opt.value = r; opt.textContent = r;
    radius.append(opt);
  }
  const controls = document.createElement('p');
  controls.append(`${ctx.t('graph.focus')}: `, picker, ` ${ctx.t('graph.radius')}: `, radius);
  root.append(controls);
  const box = document.createElement('div');
  root.append(box);

  async function show() {
    box.innerHTML = '';
    const data = await ctx.api(
      `/api/graph?focus=${encodeURIComponent(picker.value)}&radius=${radius.value}`);
    const placed = layoutGraph(data.nodes, data.edges, data.focus);
    const pos = new Map(placed.map((p) => [p.id, p]));
    const width = (Math.max(...placed.map((p) => p.x)) + 1) * CELL_X;
    const height = (Math.max(...placed.map((p) => p.y)) + 1) * CELL_Y;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', String(width));
    for (const e of data.edges) {
      const a = pos.get(e.from); const b = pos.get(e.to);
      if (!a || !b) continue;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(a.x * CELL_X + 100));
      line.setAttribute('y1', String(a.y * CELL_Y + 14));
      line.setAttribute('x2', String(b.x * CELL_X + 100));
      line.setAttribute('y2', String(b.y * CELL_Y + 14));
      line.setAttribute('stroke', e.dangling ? '#a01a1a' : '#888');
      if (e.dangling) line.setAttribute('stroke-dasharray', '4 3');
      svg.append(line);
    }
    for (const p of placed) {
      const node = data.nodes.find((n) => n.id === p.id);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(p.x * CELL_X));
      text.setAttribute('y', String(p.y * CELL_Y + 18));
      text.textContent = node.missing ? `${p.id} (${ctx.t('graph.dangling')})` : p.id;
      if (node.missing) text.setAttribute('fill', '#a01a1a');
      svg.append(text);
    }
    box.append(svg);
    if (data.omitted > 0) {
      const more = document.createElement('p');
      more.textContent = ctx.t('graph.more', { n: data.omitted });
      box.append(more);
    }
  }
  picker.onchange = show;
  radius.onchange = show;
  await show();
}
```

- [ ] **Step 4: Run tests, suite, smoke (including print preview for the coverage map)**

Run: `node --test test/ui/viewmodel.test.ts && npm test`; manual smoke per Task 16 Step 6.

- [ ] **Step 5: Commit**

```bash
git add src/ui/public/screens/coverage.js src/ui/public/screens/graph.js src/ui/public/lib/viewmodel.js test/ui/viewmodel.test.ts
git commit -m "feat(ui): coverage map with detail pane, gaps and print mode; deterministic ego graph"
```

---

## Task 19: Report and Learn screens

> **Mockup:** the "Doctor", "Decay", "Status" and "Help" sections of `docs/design/web-ui-mockup.html` show the intended rendering — findings grouped by code with levels distinct and a composed repair command, the decay chart with its window caveat, the three status panels, and a help topic cross-linked to the corpus. Its Help shows only a fragment of one topic and its data is fabricated. Spec outranks it (`docs/design/web-ui-mockup.md`).

**Files:**
- Create: `src/ui/public/screens/status.js`, `src/ui/public/screens/doctor.js`, `src/ui/public/screens/decay.js`, `src/ui/public/screens/learn.js`
- Modify: `src/ui/public/lib/viewmodel.js` (+ `groupFindings`, `decayBuckets`, `renderMarkdown` — pure)
- Test: extend `test/ui/viewmodel.test.ts`

**Interfaces:**
- Consumes: `/api/status`, `/api/doctor`, `/api/decay`, `/api/help/:topic`, `/api/item/:id`.
- Produces (pure): `groupFindings(findings): Map<code, Finding[]>` (level order error→warn→info inside each group); `repairCommandFor(code, item): string | null` — the **composed, never run** repair command per doctor code (`index_stale` → `mycontext rebuild`, `source_drift`/`source_missing` → `mycontext repair <id>`, `orphan_relation` → `mycontext repair <id>`, others → null; establish the exact command per code by reading `src/doctor/checks.ts`'s finding messages during implementation — each message already names its remedy, and the composed command must match the message's own recommendation, not this table); `decayBuckets(series, days): { day: string; count: number }[]`; `renderMarkdown(md): string` (minimal, safe: headings, fenced code, lists, inline code, paragraphs — all text escaped; no raw HTML pass-through).

- [ ] **Step 1: Failing tests** (append to `test/ui/viewmodel.test.ts`)

```ts
test('groupFindings groups by code and keeps level order', async () => {
  const { groupFindings } = await import('../../src/ui/public/lib/viewmodel.js');
  const groups = groupFindings([
    { level: 'info', code: 'b', message: 'i' },
    { level: 'error', code: 'a', message: 'e' },
    { level: 'warn', code: 'a', message: 'w' },
  ]);
  assert.deepEqual([...groups.keys()], ['a', 'b']); // error-bearing groups first
  assert.deepEqual(groups.get('a')!.map((f) => f.level), ['error', 'warn']);
});

test('decayBuckets counts injections per UTC day', async () => {
  const { decayBuckets } = await import('../../src/ui/public/lib/viewmodel.js');
  const buckets = decayBuckets([
    { injectedAt: '2026-08-01T10:00:00.000Z' },
    { injectedAt: '2026-08-01T23:59:00.000Z' },
    { injectedAt: '2026-08-03T00:00:00.000Z' },
  ]);
  assert.deepEqual(buckets, [
    { day: '2026-08-01', count: 2 },
    { day: '2026-08-03', count: 1 },
  ]);
});

test('renderMarkdown escapes HTML and renders structure', async () => {
  const { renderMarkdown } = await import('../../src/ui/public/lib/viewmodel.js');
  const html = renderMarkdown('# T\n\n<script>x</script>\n\n- a\n- b\n\n`code`');
  assert.match(html, /<h1>T<\/h1>/);
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<li>a<\/li>/);
  assert.match(html, /<code>code<\/code>/);
});
```

- [ ] **Step 2: See them fail, implement the view-models** (append to `viewmodel.js`)

```js
const LEVEL_ORDER = { error: 0, warn: 1, info: 2 };

export function groupFindings(findings) {
  const groups = new Map();
  for (const f of findings) {
    if (!groups.has(f.code)) groups.set(f.code, []);
    groups.get(f.code).push(f);
  }
  for (const list of groups.values()) list.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  return new Map([...groups.entries()].sort((a, b) => {
    const worst = (list) => Math.min(...list.map((f) => LEVEL_ORDER[f.level]));
    return worst(a[1]) - worst(b[1]) || (a[0] < b[0] ? -1 : 1);
  }));
}

export function decayBuckets(series) {
  const counts = new Map();
  for (const e of series) {
    const day = e.injectedAt.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return [...counts.entries()].sort().map(([day, count]) => ({ day, count }));
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderMarkdown(md) {
  const lines = md.replaceAll('\r\n', '\n').split('\n');
  const out = [];
  let inCode = false; let inList = false; let paragraph = [];
  const flushP = () => {
    if (paragraph.length > 0) {
      out.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  const inline = (text) =>
    escapeHtml(text).replace(/`([^`]+)`/g, (m, code) => `<code>${code}</code>`);
  for (const line of lines) {
    if (line.startsWith('```')) {
      flushP(); closeList();
      out.push(inCode ? '</pre>' : '<pre>');
      inCode = !inCode;
      continue;
    }
    if (inCode) { out.push(escapeHtml(line)); continue; }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushP(); closeList();
      const n = heading[1].length;
      out.push(`<h${n}>${inline(heading[2])}</h${n}>`);
      continue;
    }
    if (line.startsWith('- ')) {
      flushP();
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    if (line.trim() === '') { flushP(); closeList(); continue; }
    paragraph.push(line);
  }
  flushP(); closeList();
  if (inCode) out.push('</pre>');
  return out.join('\n');
}

export function repairCommandFor(code, item) {
  // Composed, never run (spec §4 Report): the exact remedy per code was
  // established by reading src/doctor/checks.ts's finding messages — each
  // message names its own remedy, and this mapping must agree with it.
  if (code === 'index_stale' || code === 'index_missing') return 'mycontext rebuild';
  if ((code === 'source_drift' || code === 'source_missing' || code === 'orphan_relation') && item) {
    return `mycontext repair ${item}`;
  }
  return null;
}
```

(`repairCommandFor`'s mapping is the establish-by-executing point: verify each code's remedy against the message text in `src/doctor/checks.ts` — e.g. `:146`, `:171`, `:225`, `:239` — and correct the mapping to what the messages themselves recommend before committing; add a unit assertion per corrected row.)

- [ ] **Step 3: Implement the four screens**

```js
// src/ui/public/screens/status.js
// The landing screen — §4's recorded EXCEPTION: a table is a terminal's home
// ground, kept because something has to be the landing screen. It stays a
// table and claims nothing more.
export async function render(root, ctx) {
  root.innerHTML = '';
  const h = document.createElement('h1');
  h.textContent = ctx.t('status.title');
  root.append(h);
  const s = await ctx.api('/api/status');
  const meta = await ctx.api('/api/meta');
  const lines = [
    `mycontext ${s.version} — ${ctx.t('status.items', { n: s.items.total })}, profile ${s.profile}`,
    ctx.t('status.drafts', { n: s.reviewQueue.drafts }),
    ctx.t('status.revisions', s.pendingRevisions),
    ctx.t('status.health', s.health),
  ];
  for (const text of lines) {
    const p = document.createElement('p');
    p.textContent = text;
    root.append(p);
  }
  for (const [title, counts] of [['byCategory', s.items.byCategory], ['byStatus', s.items.byStatus], ['byOrigin', s.items.byOrigin]]) {
    const table = document.createElement('table');
    for (const [name, n] of Object.entries(counts)) {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td'); td1.textContent = name;
      const td2 = document.createElement('td'); td2.textContent = String(n);
      tr.append(td1, td2);
      table.append(tr);
    }
    const cap = document.createElement('h2');
    cap.textContent = title;
    root.append(cap, table);
  }
  // meta.git is plan 3's strip data; the landing screen shows nothing of it
  // here — rendering it is Watch's task, and this line exists so nobody
  // "helpfully" adds it to this screen ahead of plan 3.
  void meta;
}
```

```js
// src/ui/public/screens/doctor.js
// Findings grouped by code, three levels visually distinct, each linked to
// the item it names and to the command that repairs it — COMPOSED, NOT RUN
// (spec §4): a findings list flattened to "exit 1" is what a terminal loses.
import { groupFindings, repairCommandFor } from '/lib/viewmodel.js';

export async function render(root, ctx) {
  root.innerHTML = '';
  const h = document.createElement('h1');
  h.textContent = ctx.t('doctor.title');
  root.append(h);
  const data = await ctx.api('/api/doctor');
  for (const [code, findings] of groupFindings(data.findings)) {
    const section = document.createElement('section');
    const title = document.createElement('h2');
    title.textContent = code;
    section.append(title);
    const list = document.createElement('ul');
    for (const f of findings) {
      const li = document.createElement('li');
      li.className = f.level === 'error' ? 'gap' : f.level === 'warn' ? 'spill' : 'dim';
      li.append(`[${f.level}] ${f.message}`);
      const repair = repairCommandFor(code, f.item);
      if (repair) {
        const cmdBox = document.createElement('div');
        const cmd = document.createElement('code');
        cmd.textContent = repair;
        const note = document.createElement('span');
        note.className = 'dim';
        note.textContent = ` — ${ctx.t('doctor.repair')}`;
        const copy = document.createElement('button');
        copy.textContent = ctx.t('common.copy');
        copy.onclick = () => navigator.clipboard.writeText(repair);
        cmdBox.append(cmd, ' ', copy, note);
        li.append(cmdBox);
      }
      list.append(li);
    }
    section.append(list);
    root.append(section);
  }
}
```

```js
// src/ui/public/screens/decay.js
// Decay over time is a chart, not a table (spec §4) — and the chart carries
// decay's own caveat about its window, because a report that hides its
// measurement window overstates its confidence.
import { decayBuckets } from '/lib/viewmodel.js';

export async function render(root, ctx) {
  root.innerHTML = '';
  const h = document.createElement('h1');
  h.textContent = ctx.t('decay.title');
  root.append(h);
  const data = await ctx.api('/api/decay');
  const caveat = document.createElement('p');
  caveat.className = 'dim';
  caveat.textContent = ctx.t('decay.caveat', {
    window: data.report.window, recorded: data.report.sessionsRecorded,
  });
  root.append(caveat);

  const buckets = decayBuckets(data.series);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const W = Math.max(300, buckets.length * 14); const H = 120;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', String(W));
  buckets.forEach((b, i) => {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const height = Math.round((b.count / max) * 100);
    rect.setAttribute('x', String(i * 14));
    rect.setAttribute('y', String(H - height));
    rect.setAttribute('width', '10');
    rect.setAttribute('height', String(height));
    rect.setAttribute('fill', '#205a9e');
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${b.day}: ${b.count}`;
    rect.append(title);
    svg.append(rect);
  });
  root.append(svg);

  const cold = document.createElement('h2');
  cold.textContent = 'cold';
  root.append(cold);
  const list = document.createElement('ul');
  for (const row of data.report.cold) {
    const li = document.createElement('li');
    li.textContent = `${row.id} (${row.type}) — last: ${row.lastUsed ?? '—'}`;
    list.append(li);
  }
  root.append(list);
}
```

```js
// src/ui/public/screens/learn.js
// §4's conditional pass: every topic cross-links to YOUR corpus — the join is
// the whole justification; without it this is a documentation viewer and
// should be cut.
import { renderMarkdown } from '/lib/viewmodel.js';

const TOPICS = ['categories', 'scope', 'capture', 'workflow'];

export async function render(root, ctx) {
  root.innerHTML = '';
  const h = document.createElement('h1');
  h.textContent = ctx.t('learn.title');
  root.append(h);
  const picker = document.createElement('select');
  for (const topic of TOPICS) {
    const opt = document.createElement('option');
    opt.value = topic; opt.textContent = topic;
    picker.append(opt);
  }
  root.append(picker);
  const doc = document.createElement('article');
  const corpusBox = document.createElement('aside');
  root.append(doc, corpusBox);

  async function show() {
    const data = await ctx.api(`/api/help/${picker.value}`);
    doc.innerHTML = renderMarkdown(data.markdown); // escaped inside renderMarkdown
    corpusBox.innerHTML = '';
    const ch = document.createElement('h2');
    ch.textContent = ctx.t('learn.corpusLinks');
    corpusBox.append(ch);
    const list = document.createElement('ul');
    const c = data.corpus;
    if (picker.value === 'scope') {
      for (const i of c.scoped) list.append(li(`${i.id} — ${i.scope.join(', ')}`));
      for (const i of c.unscoped) list.append(li(`${i.id} — (no scope; policy: ${i.policy})`));
    } else if (picker.value === 'categories') {
      for (const [name, n] of Object.entries(c.counts)) list.append(li(`${name}: ${n}`));
      list.append(li(`${ctx.t('coverage.emptyCategories')}: ${c.empty.join(', ') || '—'}`));
    } else if (picker.value === 'capture') {
      const label = document.createElement('p');
      label.className = 'dim';
      label.textContent = ctx.t('learn.recentCaptures');
      corpusBox.append(label);
      for (const r of c.recent) list.append(li(`${r.id} — ${r.mtime}`));
    } else {
      list.append(li(ctx.t('status.drafts', { n: c.drafts })));
      list.append(li(ctx.t('status.revisions', c.pendingRevisions)));
    }
    corpusBox.append(list);
  }
  function li(text) {
    const el = document.createElement('li');
    el.textContent = text;
    return el;
  }
  picker.onchange = show;
  await show();
}
```

Add any string keys these screens introduced to **both** tables (the parity test enforces it).

- [ ] **Step 4: Run everything**

Run: `node --test test/ui/viewmodel.test.ts && npm test && npx tsc --noEmit`; manual smoke of all four screens, both languages.

- [ ] **Step 5: Commit**

```bash
git add src/ui/public test/ui/viewmodel.test.ts
git commit -m "feat(ui): Report screens (status, doctor, decay chart) and corpus-joined Learn"
```

---

## Task 20: Documentation — both documents, always

**Files:**
- Modify: `README.md` (new subsection under the CLI commands section: `mycontext ui`)
- Modify: `docs/README.he.md` (the same subsection, same position, Hebrew, inside `<div dir="rtl">` as the document already does)

**Interfaces:**
- Consumes: everything shipped above.
- Produces: user documentation; `test/docs/parity.test.ts` (existing) holds the two structures equal.

- [ ] **Step 1: Establish the insertion point by executing**

Run `git grep -n "## " README.md | head -50` and find where commands are documented; place the new heading at the same depth and position in both documents. The parity test (structure and order) is the failing-test half of this task: adding the section to one document and running `npm test` shows the parity failure; adding it to the other clears it.

- [ ] **Step 2: Write the section (English), covering exactly what shipped**

Content requirements (prose, not a spec dump — write it in the README's own register):
- `mycontext ui [--port N] [--no-open]` — read-only web UI on `127.0.0.1`.
- **What it can never do, with the mechanism in the same sentence:** the UI executes no writes — no `/api` route reaches a mutating function, enforced by a static import-graph test — and every write it shows is composed for pasting into your own shell, so your Bash permission rules keep matching command strings.
- The token model in two sentences: per-invocation token, custom header, one-shot handoff nonce in the URL fragment; the token never appears on a process command line.
- Ephemerality: exits after 15 minutes with no `/api` request; a page in a background window stops heartbeating; the page says when the server has exited and does not reconnect.
- The screens, one line each (preview with per-session `seen`, coverage map with gaps and print mode, budget simulator, current injections, ego graph, status/doctor/decay, corpus-linked help; English and Hebrew).
- Condition-carrying claims only (`STD-guarantee-claims-carry-their-condition-in-the-same-sentence`): e.g. "the preview equals the hook's selection **when given the same session**; the cold option answers a different question and is labelled as one."

- [ ] **Step 3: Run the parity test and see it fail (one document updated), then write the Hebrew section and see it pass**

Run: `npm test` (specifically `test/docs/parity.test.ts`) — fail, then green.

- [ ] **Step 4: Full gate**

Run: `npm test && npx tsc --noEmit && npm run test:perf && git status --porcelain`
Expected: all green, tree clean after commit. (`test:perf` guards the hook budget; nothing in this plan touches the hook path, and the run proves it.)

- [ ] **Step 5: Commit**

```bash
git add README.md docs/README.he.md
git commit -m "docs: document mycontext ui in both READMEs"
```

---

## Self-Review

Performed against the spec with fresh eyes after writing, per the writing-plans skill.

**1. Spec coverage (plan-1 scope only):**

| Spec requirement | Task |
|---|---|
| §2.1 loopback only, refuse otherwise | 13 (throw), E2E test `non-loopback bind is refused` |
| §2.2 token, custom header, Origin/Host, no CORS, fragment handoff | 2, 13, 16 |
| §2.3 idle = no non-stream /api for 15 min; stream not activity; heartbeat while visible; exit banner, no reconnect | 3, 8 (stream kind), 13, 16 |
| §3 zero deps, no framework/build; compose-don't-reimplement; the nine named functions | Global Constraints; 8-11 compose them; `isNormative` handled via `injection()` (11), `itemCost` exported not copied (5) |
| §3 `/api/select` with `seen`, session selector contract, cold labelled, empty-ledger case | 8, 9, 16 |
| §3 English/Hebrew structurally mirrored; logical CSS; `<html dir>`; LTR paths inside RTL | 1, 16 (styles.css + i18n) |
| §3 browser opening: per-platform spawn, empty title arg, first child_process in src/, nonce not token in URL, `--no-open` prints and spawn-failure falls back | 15 |
| §4 Core: preview, coverage map (+detail pane = file browser merged, print = onboarding merged), budget simulator, currently injected | 17, 18 |
| §4 Navigate: ego graph (radius, 60 cap, "+N more", no physics, dangling edges), coverage gaps | 11, 18 |
| §4 Report: doctor grouped by code with composed repairs; status as recorded exception; decay as a chart with its window caveat | 10, 19 |
| §4 Learn: topics cross-linked to the corpus, or cut | 11, 19 |
| §4 Watch status strip's git constraint (read `.git` as files, no ahead/behind, no working tree) | 4 builds and tests the reader + `/api/meta` (13); rendering is plan 3's |
| §6 endpoints tested by spawning a real process; security assertions first-class; nonce refused on reuse and after window | 13 |
| §6 the inverted write test — static import graph | 14 |
| §6 `/api/select` = `select()` as JSON structural equality incl. a seen-changes-outcome case | 8 |
| §6 string-table parity with the honesty docstring | 1 |
| §6 the rendering-untested limit stated in the test file | 13 (E2E header), 16 (viewmodel header) |
| §7 "not a write path at all", "not a git client", single-user/localhost/ephemeral | 13, 14, 4 |
| §8 risk rows in plan-1 scope | each maps to the tasks above |
| §9 decisions 3 and 5 | 11 (matchesScope+injection), 9/16 (session selector) |

Out of plan-1 scope, deliberately: §4 Work/Configure (plan 2); §4 Watch audit stream, §4b bridge, Ask, §5 entirely (plan 3 — the audit log and its projection do not exist on this branch; `src/core/audit.ts` is on `phase-5/quality`).

**2. Placeholder scan:** the plan contains four **explicit establish-by-executing points**, each with the concrete procedure and the assertion that must exist afterwards (Task 6 log-line shape and `foldLog` closure; Task 11 graph-relation fixture mechanics and the cap-60 fixture; Task 19 `repairCommandFor` mapping verified against checks.ts messages; Task 20 insertion point). These are not TBDs: each names what to execute, what to read, and what the committed artefact must contain. No "add error handling", no "similar to Task N", no test named without its code.

**3. Type consistency:** `JsonResult` is defined once (routes.ts, Task 8) and consumed by read-model and server; `SessionSummary`/`InjectionEvent` defined in Task 7 and consumed in 9/10; `GitInfo` defined in Task 4 and consumed in 13; `RouteHandler.kind` spelling (`'json' | 'stream'`) is identical in 8 and 13; the eight banned names in Task 14 match the grep-verified export list in the Verified Facts table; `TOKEN_HEADER` lower-case server-side (2), sent as `X-Mycontext-Token` by app.js (16) — Node lower-cases on receipt, stated in Task 2. `pendingRevisionCounts`'s widened parameter (Task 6) is consumed with summaries in Task 10 and with the same shape in Task 11.

**Known deviations from the spec, named rather than silent:**
- The printed-URL nonce lifetime (10 minutes) is a plan decision the spec does not fix; the spec fixes only the opener's 10 seconds (Design decision 5).
- `localhost` spellings are refused, not aliased (Task 2) — the spec says loopback-only and names `127.0.0.1` throughout; one accepted spelling is one thing to audit.
- The Learn screen's "most recent captures" uses file mtime with an on-screen label, because no creation timestamp exists anywhere in the item schema (Design decision 9) — the honest rendering of a spec sentence whose data does not exist.

---

## Produces summary — the interface plans 2 and 3 consume

```ts
// src/ui/routes.ts
interface ApiContext { ws: Workspace; repoRoot: string; url: URL; params: Record<string, string>; body: unknown }
interface JsonResult { status: number; body: unknown }
type RouteHandler =
  | { kind: 'json'; handle(ctx: ApiContext): JsonResult | Promise<JsonResult> }
  | { kind: 'stream'; handle(ctx: ApiContext, res: ServerResponse): void };  // plan 3's stream slot; never idle-touched
function registerRoute(method: 'GET' | 'POST', path: string, handler: RouteHandler): void;

// src/ui/server.ts
function startUiServer(options: UiServerOptions): Promise<RunningUiServer>;
const OPENER_NONCE_TTL_MS = 10_000; const PRINTED_NONCE_TTL_MS = 600_000;

// src/ui/git-info.ts  (plan 3 renders it; /api/meta already serves it)
interface GitInfo { branch: string | null; commit: string | null; upstream: 'in-sync' | 'differs' | 'no-upstream'; detached: boolean }
function readGitInfo(repoRoot: string): GitInfo | null;

// src/core/revision-log.ts  (plan 2 reads the queue from HERE, never revision.ts)
function readLog(root: string): LogLine[];
function foldLog(lines: LogLine[]): /* folded records; state/'pending' filterable */;
function pendingRevisionSummaries(root: string): { revisionId: string; itemId: string }[];
function pendingRevisionCounts(revs: { itemId: string }[]): { revisions: number; items: number };

// src/core/ledger.ts additions
Ledger.history(): InjectionEvent[];              // { sessionId; itemId; tier; injectedAt }
Ledger.sessionSummaries(limit): SessionSummary[]; // { sessionId; lastInjectedAt; itemCount }

// src/core/select.ts addition
function itemCost(item: Item): number;

// HTTP surface (all GET unless noted; token header X-Mycontext-Token; unknown params → 400)
POST /api/handoff { nonce } → { token }
GET  /api/ping → { ok: true }
GET  /api/meta → { version, projectRoot, repoRoot, git: GitInfo | null }
GET  /api/select?event=&path=&session=|cold=1[&restore=] → Selection (select() JSON, exactly)
GET  /api/render?…same → { text }
GET  /api/simulate?…same[&pinned=&jit=&restored=&index=] → { selection, budgets, costs }
GET  /api/sessions → { default, sessions }
GET  /api/session/:session/injected → { entries }
GET  /api/status | /api/doctor | /api/decay?window= | /api/coverage | /api/graph?focus=&radius= |
     /api/items | /api/item/:id | /api/help/:topic

// browser modules (plans 2/3 screens)
window.myctx = { api(path), t(key, subs), session(), onSessionChange(fn), navigate(hash) };
strings tables: src/ui/public/strings/{en,he}.js — add keys to BOTH; parity test enforces.
```

Execution: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`, task by task, in order — Tasks 1-7 are independent of each other except 5→8 and 6→10; 8-11 build read-model incrementally; 12-13-14-15 must run in that order; 16-19 need 13; 20 last.
