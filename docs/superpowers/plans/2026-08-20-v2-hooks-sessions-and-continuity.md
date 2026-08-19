# v2.0 Plan — hooks, sessions and cross-session continuity

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the four hook-and-session decisions v2.0 took — handle `source === 'clear'` in
`SessionStart`, take `PostToolUseFailure`, deliver the pinned tier plus the index to subagents
through `SubagentStart`, and give sessions names and a cross-session carry — without a second
injection path, without a second dedupe key, and without pretending an invariant covers a risk it
does not describe.

**Architecture:** Two new hook binaries beside the four that ship, both reusing what exists:
`SubagentStart` calls the same `buildInjection` the `SessionStart` hook and the `load_context` MCP
tool already share, and `PostToolUseFailure` copies `PreCompact`'s audit-only shape. Session
identity gets one workspace-scoped store under `state/`, following `focus.json`'s precedent, and the
CLI never guesses which session it is in. Cross-session continuity is a **priority and a marker
inside the existing index budget**, not a fifth tier and not a fifth budget.

**Tech Stack:** Node ≥ 24 built-ins only. No build step, no runtime dependency, erasable TypeScript
syntax only.

**Spec:** `docs/superpowers/specs/2026-08-19-v2-scope-decisions.md` — the binding authority, and
**§6m supersedes the earlier sections where they conflict.** The sections this plan implements are
§3, §6a, §6c, §6d, §6e, §6g, §6j and §6m (items 8 and 11).

**Survey:** `.superpowers/sdd/2026-08-19-v2-scope-decisions/survey-hooks-sessions.md` — the
file-level map this plan is built on. Its `file:line` numbers were re-resolved against the working
tree on 2026-08-20 and several had drifted; see §0.

**Scope split (binding):**
- **In this plan:** `hooks.json`, `src/hooks/**`, `src/core/inject.ts`, `src/core/seen-file.ts`, the
  index-tier half of `src/core/select.ts`, two new `src/core/` modules for session names and
  continuity, one new CLI command with three subcommands, and the two hand-written slash commands.
- **Not in this plan, and named so nobody schedules them twice:** `runbook` steps and the `## Steps`
  file-format change (§6a, §6i.1); `todo` and `note` (§1); export, packs and `git bundle` (§5, §6h);
  the FTS5 withdrawal and the `text`-predicate widening (§6m.6); the rule-file exporter and its
  `doctor` divergence check (§6m.7); the web UI's rendering of anything below. Where this plan
  produces a shape the UI must render, it says so and stops there.

---

## Global Constraints

- **Zero runtime dependencies.** Node 24 native type-stripping, no build step, `erasableSyntaxOnly`,
  explicit `.ts` import extensions on every relative import. No `enum`, no `namespace`, no
  constructor parameter properties.
- **Hooks fail open.** Any error yields empty output and exit 0. The `.my_context/` write-deny in
  `pre-tool-use.ts` is the single deliberate exception and this plan does not add a second.
- **Fail-open is a statement about error paths, not about latency, and this plan does not change
  that.** There is no in-process timeout for a hook that reads stdin synchronously — `readFileSync(0)`
  blocks the thread and no timer can preempt it — so the only bound on a hook's total runtime is the
  declared `"timeout"` in `hooks.json`, which is Claude Code killing the process. Taking
  `SubagentStart` therefore puts a hook that mycontext cannot cut short on the critical path of every
  subagent dispatch. Every task that touches that hook states this rather than implying the invariant
  covers it.
- **Nothing is ever dropped silently.** An item excluded for budget appears in `spilled`; a seen file
  that could not be deleted, a carried id that no longer resolves, and a hook payload that could not
  be read all appear in the audit note or the injected block. Additions are covered too: knowledge
  arriving from a session the user cannot see is the same defect pointed the other way.
- **Markdown is the source of truth.** Nothing in this plan writes to `.my_context/items/`.
- **Every stored path is POSIX-normalised.** `state/` filenames go through `sanitizeSessionId`, and
  no comparison is made against a backslash path.
- **Never write a comment, message, doc or corpus item asserting a property the code does not have.**
- **Every change needs a test that fails without it.** `npm run mutate` refuses a dirty tree — commit
  first.
- `npm test`, `npx tsc --noEmit`, `npm run test:perf`, `npm run verify:citations`,
  `npm run check:retired` clean; `git status --porcelain` clean at the end of every task.
- **Both documents, always** for any README change: `README.md` and `docs/README.he.md`.
- **Citations are `file` · `verbatim fragment` · `~line`.** The fragment is the identity; the line is
  a hint. `npm run verify:citations` resolves every one.

---

## 0. Corrections — where the spec, the survey and the working tree disagree

<!-- retired-phrases
renames the current session
applies at full force
needs its own design
four hook binaries
-->

**These corrections are enforced, not merely recorded.** The block above lists the phrases this plan
retires; `npm run check:retired` fails if any of them reappears anywhere below §0. §0 is exempt,
because its job is to quote the retired text.

Every row names the **class** of error, not only the instance.

| Was | Is | Class | Where |
|---|---|---|---|
| The survey quotes `hooks.json`'s commands as `node "${CLAUDE_PLUGIN_ROOT}/src/hooks/….ts"` | **All four commands carry `--disable-warning=ExperimentalWarning`** — `hooks/hooks.json` · `--disable-warning=ExperimentalWarning` · ~10. A new block copied from the survey's quotation writes an `ExperimentalWarning` to stderr on **every subagent dispatch** | A manifest is copied from the file it configures, never from a document quoting it | Tasks 7, 11 |
| The survey cites `preToolUseContext` at `io.ts:70-74`, `ledgerKey` at `:46-49`, `pre-tool-use.ts`'s entry guard at `:363-377` | `preToolUseContext` is at ~169, the entry guard at ~376. `ledgerKey` really is at ~46 | Survey line numbers are hints that drift; the verbatim fragment is the identity, and every citation below carries one | all tasks |
| The survey measured **15** `.seen.jsonl` files for one session id | On 2026-08-20 the same directory holds **47**: one parent, **45** `session::agent` siblings for the same session id, and one unrelated. Roughly a tripling in one day | A growth measurement taken once is a lower bound, not a rate | Tasks 6, 12 |
| The survey recommends the audit projection as the carry source, *"the strongest: it records the `index` tier too"* | This plan reads the **source session's seen file**. `core/audit.ts` · `the hook path calls this` · ~410 documents `readAudit` as off the hook path *by design*, and `SessionStart` carries a 500 ms budget. The cost is named in Task 18: an item the source session only ever saw as an index line is not carried | A read that is correct for a CLI surface is not automatically affordable on a latency-budgeted hook path | Task 18 |
| §6c / §6g / §6m.11: carried lines *"deduplicate against the new session's own index first"*, and what survives *"queues inside the same `budgets.index`"* | **The dedupe can leave no residue of extra lines.** `buildIndex`'s candidate set is every eligible normative item not already delivered in full — `core/select.ts` · `.filter((i) => isNormative(i, config) && !chosenIds.has(i.id))` · ~358 — so a carried id that still governs is **always already a candidate**. Carry is therefore a **priority and a marker on an existing candidate**, never an added line; a carried id that is *not* a candidate is not shown at all and is disclosed with a reason. Measured on this repository's own corpus: 44 items, 7 pinned, **18 index lines, 0 truncated** — a naive "add the carried lines" implementation would add nothing and report success | A dedupe rule stated over two sets that are, by construction, one set | Tasks 17, 19 |
| §6c: `SubagentStart` blocks, *"and `INV-hooks-fail-open` applies at full force"* | §6j corrects this and the corrected form is a Global Constraint above: the invariant is satisfied by an **external kill**, not by anything mycontext does. There is no in-process bound on the synchronous selection and this plan does not add one | An invariant named as covering a risk it does not describe | Tasks 9, 10, 11 |
| §6a: *"Clearing the seen file when the window is destroyed"* | **No delete or truncate exists anywhere in the module.** `core/seen-file.ts` exports `seenFilePath`, `appendSeen`, `readSeen`, `seenIds` and `restoredFor` and nothing else; the only removal path in the product is a 30-day mtime sweep behind a manual `mycontext rebuild`. And a per-session clear does not reach the 45 `session::agent` siblings | A decision that names an operation is checked against the module that would have to provide it | Tasks 6, 8 |
| §6g's first form of the naming command — *"`mycontext session name <name>` renames the current session"* | Withdrawn by §6m.8. `mycontext session name <id> <name>`, with `mycontext session list` to find the id. `core/focus.ts` · `has a trustworthy session id: the CLI runs in a terminal and is handed none,` · ~25 records the codebase hitting this and conceding it | A command's argument list is derived from what its process can actually know | Tasks 14, 15, 16 |
| §3 on cross-session continuity: *"It is unspecified and needs its own design"* | Corrected inside the spec — §6c, §6g and §6m.11 decide it. A planner reading §3 alone schedules a design that already exists | A superseded paragraph left standing is read as open work | Tasks 17, 18, 19 |
| `test/hooks/hook-binaries-e2e.test.ts`'s header — *"The four hook binaries, run as real OS processes over real stdio"* | After Tasks 7 and 11 there are **six**, and the header's second claim — that only `PostToolUse` reads stdin asynchronously — becomes false as well | A count in a test's own docstring is part of what the test asserts about the system | Tasks 7, 11 |
| §6a schedules `PostCompact` to *"restore sooner than the next tool call"* | Superseded by §6e on this project's own audit log: `PreCompact` captures and `SessionStart` fires with `source=compact` about two minutes later and performs the restore, across two real compactions. **It is not scheduled here** | A second mechanism for a working one is a second spelling | — |

---

## Verified facts this plan builds on

Resolved against the working tree on 2026-08-20. `npm run verify:citations` resolves every fragment
in this table and exits non-zero on a miss. Where the plan needs a fact it could not verify, the task
says "establish by executing" instead of asserting it.

### The hook layer

| Fact | Where verified |
|---|---|
| `ledgerKey` returns `session_id` alone for a parent and `session_id::agent_id` for a subagent | `hooks/io.ts` · `export function ledgerKey(input: HookInput): string` · ~46 |
| …and it reads only those two fields, so the same payload shape produces the same key at any event | `hooks/io.ts` · `return input.agent_id ?` · ~48 |
| `agent_id` is declared on `HookInput` and is the only subagent discriminator the hooks have | `hooks/io.ts` · `agent_id?: string;` · ~23 |
| `source` is declared as `SessionStart only`, with `clear` already named | `hooks/io.ts` · `SessionStart only: startup` · ~8 |
| Stdin is read **synchronously** in the shared IO module | `hooks/io.ts` · `return readFileSync(0, 'utf8');` · ~54 |
| The only output envelope builder is `PreToolUse`-specific | `hooks/io.ts` · `export function preToolUseContext(text: string): string {` · ~169 |
| …and its envelope shape is `hookSpecificOutput` + `additionalContext` | `hooks/io.ts` · `hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: text },` · ~171 |
| `io.ts` already records that `AUDIT_OPS` is closed and the reader refuses a whole segment on an unknown op | `hooks/io.ts` · `refuses a whole segment on an unknown op` · ~144 |
| `SessionStart` writes **raw text**, not a JSON envelope | `hooks/session-start.ts` · `if (text) process.stdout.write(text);` · ~59 |
| …and documents that it deliberately carries no runtime safety timer | `hooks/session-start.ts` · `// No runtime safety timer here: buildSessionStartOutput is fully` · ~39 |
| `PreToolUse` documents the same, and names `hooks.json` as the real bound | `hooks/pre-tool-use.ts` · `// No runtime safety timer here: runPreToolUse is fully synchronous, so a` · ~376 |
| `PreToolUse` keys its seen file on `ledgerKey`, not the bare session id | `hooks/pre-tool-use.ts` · `const dedupeKey = ledgerKey(input)!;` · ~135 |
| …on both the read | `hooks/pre-tool-use.ts` · `const seenState = readSeen(ws.projectRoot, dedupeKey);` · ~183 |
| `PostToolUse` is the **only** hook with an in-process timeout | `hooks/post-tool-use.ts` · `const timer = setTimeout(() => process.exit(0), 2000);` · ~121 |
| …and it works only because stdin is read asynchronously | `hooks/post-tool-use.ts` · `process.stdin.on('end', () => resolve(data));` · ~100 |
| …which the file states as the reason no timer can help the other three | `hooks/post-tool-use.ts` · `A synchronous readFileSync(0), by contrast, blocks the thread` · ~115 |
| `PreCompact` is the precedent for an audit-only hook that injects nothing | `hooks/pre-compact.ts` · `export function buildRestoreSnapshot(` · ~23 |
| …and for disclosing a state-file failure on stderr **and** in the audit log, still exiting 0 | `hooks/pre-compact.ts` · `SNAPSHOT WRITE FAILED (` · ~90 |
| `SessionStart`'s matcher already includes `clear`, so the hook fires on `/clear` today | `hooks/hooks.json` · `"matcher": "startup` · ~6 |
| Every registered command carries the warning suppressor | `hooks/hooks.json` · `--disable-warning=ExperimentalWarning` · ~10 |
| The main-entry guard every binary uses | `core/paths.ts` · `export function isMainEntry(entryFile: string` · ~187 |

### Injection, selection and the index

| Fact | Where verified |
|---|---|
| One injection implementation, shared on purpose | `core/inject.ts` · `this selection is precisely the divergence the single-write-path design` · ~21 |
| `InjectionEvent` is a two-member union today | `core/inject.ts` · `export type InjectionEvent = 'session-start'` · ~24 |
| `source` is branched on exactly once | `core/inject.ts` · `const compacting = options.source === 'compact';` · ~131 |
| The session id is dropped structurally on the manual path | `core/inject.ts` · `const sessionId = manual ? undefined : options.sessionId;` · ~169 |
| The seen file is read **after** that, and is what a clear must precede | `core/inject.ts` · `const seenState = sessionId ? readSeen(ws.projectRoot, sessionId) : null;` · ~181 |
| The injection path opens the store **writable** for a best-effort refresh | `core/inject.ts` · `store = Store.open(ws.dbPath, manual ? undefined : HOOK_OPEN_PROFILE);` · ~279 |
| …disclosed rather than swallowed when it is dropped | `core/inject.ts` · `// 3. BEST-EFFORT INDEX REFRESH` · ~266 |
| `source` already reaches the audit note | `core/inject.ts` · `if (options.source !== undefined) noteParts.push(` · ~359 |
| Seen entries are appended keyed on the bare session id | `core/inject.ts` · `appendSeen(ws.projectRoot, sessionId, selection.full.map((e) => ({` · ~410 |
| The MCP server's session id is a different id on a resumed session — measured, in this repository | `core/inject.ts` · `on a RESUMED session that value is a freshly-generated id that does` · ~139 |
| `SelectEvent` is a closed four-member union | `core/select.ts` · `export type SelectEvent = 'session-start'` · ~17 |
| `SelectContext` is where every input to selection arrives | `core/select.ts` · `export interface SelectContext {` · ~19 |
| The pinned tier is admitted for `session-start`, `compact` and `manual` — never `tool` | `core/select.ts` · `if (ctx.event === 'session-start' \|\| ctx.event === 'compact' \|\| ctx.event === 'manual') {` · ~487 |
| A tool event returns an **empty** index | `core/select.ts` · `index: emptyIndex(), spilled: trueSpills(spilled), focus: focusReport,` · ~535 |
| Seen items are removed before budgeting | `core/select.ts` · `const seen = new Set(ctx.seen ?? []);` · ~478 |
| `buildIndex`'s candidate set is every eligible normative item not delivered in full | `core/select.ts` · `.filter((i) => isNormative(i, config) && !chosenIds.has(i.id))` · ~358 |
| …ordered by id, and budgeted line by line with a spill for each miss | `core/select.ts` · `if (used + cost > config.budgets.index) {` · ~371 |
| …and it is called with the whole eligible set, not the seen-filtered one | `core/select.ts` · `buildIndex(eligible, merged, config, chosenIds);` · ~540 |
| `IndexSummary` is the shape every index consumer reads | `core/select.ts` · `export interface IndexSummary {` · ~52 |
| An index line's cost is the rendered line | `core/render-item.ts` · `export function renderIndexLine(entry: { id: string; type: string; title: string }): string {` · ~192 |
| The index heading the renderer emits | `core/render.ts` · `const lines: string[] = ['## my_context index'];` · ~16 |
| The full-text block's heading — the existing provenance frame | `core/render.ts` · `## my_context — these govern this project` · ~144 |
| Default budgets, index = 1200 | `core/config.ts` · `export const DEFAULT_BUDGETS: Budgets = { pinned: 6000, jit: 6000, restored: 8000, index: 1200 };` · ~51 |
| `select` may import only pure modules | `.my_context/items/invariant/INV-select-is-pure.md` · `- [invariant] select imports only types and config` · ~29 |

### The seen ledger and `state/`

| Fact | Where verified |
|---|---|
| The seen file path, and that the key is sanitised | `core/seen-file.ts` · `export function seenFilePath(root: string, key: string): string {` · ~39 |
| Accepted tiers are a closed set — `carried` is not one and must not become one | `core/seen-file.ts` · `const TIERS = new Set<string>(['pinned', 'jit', 'restored']);` · ~37 |
| The module's stated failure direction: unreadable means inject without dedupe and disclose | `core/seen-file.ts` · `unreadable seen file means "inject WITHOUT dedupe and disclose"` · ~18 |
| An append retries per line, with a named worst case | `core/seen-file.ts` · `= 200 ms of backoff PER LINE` · ~67 |
| Sanitisation is lossy for a composite key — a digest, not reversible | `core/ledger.ts` · `export function sanitizeSessionId(sessionId: string): string {` · ~353 |
| The restore snapshot lives beside the seen file, keyed the same way | `core/ledger.ts` · `export function snapshotPath(root: string, sessionId: string): string {` · ~361 |
| `state/` is gitignored by the file that writes into it | `core/ledger.ts` · `writeFileSync(path.join(dir, '.gitignore'), '*\n', 'utf8');` · ~406 |
| Reading a snapshot never throws | `core/ledger.ts` · `export function readSnapshotMeta(root: string, sessionId: string): SnapshotMeta` · ~503 |
| The only cleanup is age-based, 30 days by mtime | `core/ledger.ts` · `export const SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;` · ~434 |
| …its signature, including the per-file callback a caller needs to disclose what went | `core/ledger.ts` · `export function pruneSnapshots(` · ~456 |
| …and its only production caller is `mycontext rebuild` | `cli/index.ts` · `const pruned = pruneSnapshots(root, undefined, (name) => {` · ~664 |
| A contended writable store open is bounded at ~1.06 s | `core/store.ts` · `Worst case ~1.06s: two attempts` · ~122 |
| The transient-EPERM retry wrapper every filesystem write in `core/` goes through | `core/rebuild.ts` · `export function retryOnTransientFsError<T>(fn: () => T, attempts = 5): T {` · ~205 |

### Audit vocabulary

| Fact | Where verified |
|---|---|
| `INJECTION_OPS` is closed and does not name a subagent op | `core/audit.ts` · `export const INJECTION_OPS = ['session-start', 'compact-restore', 'jit', 'manual'] as const;` · ~94 |
| `HOOK_OPS` is closed and does not name a failure op | `core/audit.ts` · `export const HOOK_OPS = ['pre-compact', 'post-tool-use', 'deny'] as const;` · ~98 |
| `KIND_OF` is the one total table; a new op must appear here too | `core/audit.ts` · `const KIND_OF: Record<AuditOp, AuditKind> = {` · ~124 |
| `parseAudit` **refuses** an unregistered op | `core/audit.ts` · `which is not one of` · ~286 |
| The hook-name union names four hooks | `core/audit.ts` · `hook?: 'SessionStart'` · ~180 |
| `LEDGER_TIERS` is what a replayed ledger claims as delivered — `carried` must stay out of it | `core/audit.ts` · `const LEDGER_TIERS = new Set(['pinned', 'jit', 'restored']);` · ~567 |
| `readAudit` reads whole files and is documented as off the hook path | `core/audit.ts` · `the hook path calls this` · ~410 |
| The one filter implementation, which already takes a `sessionId` | `core/audit.ts` · `export interface AuditFilter {` · ~458 |
| The existing totality test — it catches an op with no kind, **not** a missing op | `test/core/audit.test.ts` · `for (const op of AUDIT_OPS) assert.ok(kindOf(op),` · ~225 |

### Sessions

| Fact | Where verified |
|---|---|
| Session enumeration over the audit projection, most recent first | `core/audit-db.ts` · `export function sessions(db: DatabaseSync, limit: number): SummaryRow[] {` · ~447 |
| …and the same answer without a projection | `cli/commands/audit.ts` · `function sessionsWithoutDb(list: AuditRecord[]): SummaryRow[] {` · ~492 |
| …already printed to users today | `cli/commands/audit.ts` · `my_context: sessions this log has recorded (most recent ` · ~421 |
| A third enumeration over the ledger projection | `core/ledger.ts` · `recentSessions(limit: number): string[] {` · ~242 |
| "What that session had", from the ledger | `core/ledger.ts` · `itemsUsedIn(sessionIds: string[]): string[] {` · ~263 |
| No writable surface has a trustworthy session id — the codebase already conceded this | `core/focus.ts` · `has a trustworthy session id: the CLI runs in a terminal and is handed none,` · ~25 |
| …and retreated to workspace scope, one file per workspace | `core/focus.ts` · `export function focusPath(root: string): string {` · ~285 |
| Command registration | `cli/commands/registry.ts` · `export function registerCommand(def: CommandDef): void {` · ~46 |
| Hand-written slash commands are excluded from generation by name | `scripts/gen-commands.ts` · `const KEEP = new Set(['LoadMyContext.md']);` · ~23 |
| …and from the parity test by the same list, kept separately | `test/plugin/commands.test.ts` · `const HAND_WRITTEN = new Set(['LoadMyContext.md']);` · ~38 |

### Tests and budgets

| Fact | Where verified |
|---|---|
| The e2e binary test's stdin-held-open asymmetry, which Task 11 must extend | `test/hooks/hook-binaries-e2e.test.ts` · `The stdin-held-open case is PostToolUse only, deliberately.` · ~15 |
| The SessionStart latency ceiling and the CI widener | `test/perf/session-start-latency.perf.ts` · `const CEILING_MS = perfCeiling(500);` · ~64 |
| …the helper itself | `test/helpers/perf.ts` · `export function perfCeiling(` · ~55 |
| `INV-hooks-fail-open`'s observation list carries a `[limit]` for two hooks only | `.my_context/items/invariant/INV-hooks-fail-open.md` · `- [limit] PreToolUse/JIT is held to p95 under 50ms; SessionStart to 500ms #performance` · ~30 |
| Recursive tree removal in tests goes through one owner | `test/no-bare-rmsync.test.ts` · `removeTree is the one owner` · ~42 |

### Facts that are absences — re-checked by execution, not by citation

`verify-citations.ts` has nothing to resolve for a thing that does not exist.

| Fact | How it was re-checked, 2026-08-20 |
|---|---|
| No `clearSeen`, `deleteSeen` or `truncateSeen` exists anywhere in `src/` | `grep -rn "clearSeen\|deleteSeen" src/` — no matches |
| No `SessionEnd`, `Stop`, `SubagentStart`, `SubagentStop`, `UserPromptSubmit` or `PostToolUseFailure` entry exists in `hooks/hooks.json` | read whole; four keys only |
| No `src/core/session-names.ts` or `src/core/continuity.ts` | absent |
| No `session` command is registered | `mycontext --help` lists 33 commands; `session` is not among them |
| `.my_context/state/` holds 47 entries: 1 parent `.seen.jsonl`, 45 `session::agent` siblings for the same session id, 1 unrelated, 0 `.restore.json` | `ls .my_context/state/` |
| `mycontext audit --sessions` prints two sessions today | executed |

### Measured facts, from the probes — not citable, and not re-derivable from the tree

Recorded in `docs/superpowers/specs/2026-08-19-v2-scope-decisions.md` §6b/§6c and
`reports/uiux/research/PROBE-RESULTS.md`, measured on Claude Code 2.1.234.

1. **`SubagentStart` fires and CAN inject**, via
   `{"hookSpecificOutput":{"hookEventName":"SubagentStart","additionalContext":"…"}}`, confirmed in
   the subagent's own transcript rather than by asking the model.
2. **It BLOCKS.** A 3,018 ms hook delayed the subagent's first tool call by that much. It sits on the
   critical path of every dispatch.
3. **`ledgerKey` returns an identical key** at `SubagentStart` and at the subagent's first
   `PreToolUse`, so a seen entry written at birth prevents double delivery. **No keying change is
   needed.**
4. **A bare imperative injected into a subagent was reported to its parent as a possible attack.**
   Injected text needs provenance framing to be legible. This is a design requirement, not a nicety.
5. **`PostCompact` is dropped** on evidence from this project's own audit log. It is not scheduled.
6. **`prompt_id` exists** on `PreToolUse`, `SubagentStart` and `SubagentStop`, and `PreToolUse` also
   carries `permission_mode`, `effort` and `tool_use_id` — none of which `HookInput` declares.

### Measured here, 2026-08-20 — this repository's own corpus

Executed: `select(loadLayer(global) ++ loadLayer(project), { event: 'session-start' }, config)`.

```
items total 44 | full (pinned) 7 | index lines 18 | truncated 0 | tokens 1542 | budgets.index 1200
```

**The index is not exhausted on this corpus.** That is the measurement behind §0's carry correction
and behind Task 17's design: with nothing truncated, every eligible normative item already has a
line, so there is nothing a carry could add.

---

## Design decisions this plan fixes (so no implementer has to guess)

1. **`SubagentStart` reuses `buildInjection`.** `core/inject.ts` · `this selection is precisely the
   divergence the single-write-path design` · ~21 says what a second selection path costs, and this
   project names "a second spelling of one concept" as the defect class it has paid for four times.
   The hook binary is a thin wrapper, exactly as `session-start.ts` is.
2. **`SelectEvent` does not change.** A subagent gets the `'session-start'` selection: pinned in full
   plus the index. A distinct `'subagent'` member would need three new branches
   (`core/select.ts` · `if (ctx.event === 'session-start' \|\| ctx.event === 'compact' \|\| ctx.event === 'manual') {` · ~487
   and two more) to arrive at the same answer. `InjectionEvent` **does** change, because the audit op,
   the hook name and the dedupe key differ.
3. **The subagent injection skips the best-effort index refresh.** That refresh opens the store
   **writable** (`core/inject.ts` · `store = Store.open(ws.dbPath, manual ? undefined : HOOK_OPEN_PROFILE);` · ~279)
   with a ~1.06 s contended worst case, on a path that now runs once per dispatch. The parent's
   `SessionStart` already refreshed; a subagent adds nothing but latency and lock contention.
4. **The dedupe key is `ledgerKey(input)`, never the bare `session_id`.** Writing the parent's file
   from a subagent would suppress the parent's next injection. This is expressed as a new
   `InjectionOptions.dedupeKey` that defaults to `sessionId`, so no existing caller changes
   behaviour.
5. **The `SubagentStart` timeout in `hooks.json` is 5, not 10.** 10 is a ten-second stall per
   dispatch in the worst case. 5 halves it and still leaves ~30× headroom over the in-process work
   the SessionStart perf test measures. **The cost, named:** a subagent dispatched while another
   process holds the index write lock can lose its context entirely, and a killed hook has no
   disclosure path — nothing is written, so nothing says it happened.
6. **Async stdin bounds the wait, not the work.** `SubagentStart` copies `post-tool-use.ts`'s
   async-stdin + unref'd-timer shape, and that buys exactly one thing: a pipe that never closes
   cannot hang the dispatch. Once `buildInjection` starts it is synchronous and no timer can preempt
   it. Both halves are stated in the binary's own docstring so the next reader does not infer a
   bound that is not there.
7. **No new audit op for the clear.** The `session-start` record is written anyway
   (`core/inject.ts` · `if (options.source !== undefined) noteParts.push(` · ~359 already puts
   `source=clear` in its note); the clear's outcome joins it there. A new op would have to be
   registered in three places and would record a second row for one event.
8. **A clear removes the restore snapshot as well as the seen files.** A pre-clear snapshot describes
   a context window that no longer exists; a post-clear compaction restoring it would deliver items
   the current window never had. That is not over-restore within one window, it is restoring a
   different one. Deleting is safe — `core/ledger.ts` · `export function readSnapshotMeta(root: string, sessionId: string): SnapshotMeta` · ~503
   degrades a missing file to `null`.
9. **Carry is a priority and a marker, never an added index line.** See §0. A carried id that is
   already a candidate is hoisted to the front of the by-id order and marked; a carried id that is
   not a candidate produces no line and is disclosed with a reason. **This is where the ordering
   ruling lives, and §6m.11 does not make it:** front-of-queue is what makes carry do anything at all
   on an exhausted index, and its cost is that a displaced line spills — visibly, through the
   existing `spilled` path. Reversing it is a one-line change to the partition order in `buildIndex`
   and Task 17 says exactly where.
10. **The carry source is the source session's seen file**, not the audit log. See §0. It holds the
    three delivery tiers, it is one small file, it needs no database, and `readSeen` already never
    throws.
11. **The carry *selection* is persisted, because a hook takes no flags.** `state/continuity.json`,
    workspace-scoped like `focus.json`, written by `mycontext session carry <id>` and by a slash
    command, read by `inject.ts`. Absent, the default is the most recent **parent** session other
    than the current one.
12. **Session names live in `state/session-names.json`**, workspace-scoped, gitignored, never
    travelling with the corpus. Duplicate names are **refused at write**, with an error naming the
    session that holds it, so selection by name never has to be ambiguous.
13. **Unnamed sessions get nothing invented.** `session list` shows the full id, its 8-character
    short prefix, and an empty name column.
14. **The prune trigger is `SessionStart`, after stdout is written.** It is once per session rather
    than once per tool call, and the model already has its text by then. `mycontext rebuild` remains
    the other caller. **The cost, named:** a project whose sessions never start never prunes, which
    is the same project that never rebuilds.

---

## Decisions this plan deliberately does NOT make

Each is a task below whose *outcome* selects between stated branches. None of them is guessed at
here.

- **Whether `SessionStart` ever reports `source === 'clear'`, and whether `/clear` preserves
  `session_id`.** Unprobed. Task 1 measures it; Tasks 6 and 8 carry a decision table for each of the
  four outcomes.
- **Which hook a slash command reaches, and whether it carries `session_id`.** §6m.8 rules that it
  does; no probe in the record names the event. Task 2 measures it; Task 16 branches.
- **Whether a carried line may displace a line the new session's own index would otherwise show**,
  when the index budget is exhausted. This plan implements front-of-queue (decision 9) because the
  alternative is a feature that provably does nothing, and names the single line that reverses it.

---

## File Structure

New files:

```
src/hooks/subagent-start.ts             # SubagentStart binary: async stdin, unref'd timer, envelope
src/hooks/post-tool-use-failure.ts      # PostToolUseFailure binary: one audit append, injects nothing
src/core/session-names.ts               # state/session-names.json reader/writer; never throws
src/core/continuity.ts                  # carry source resolution + state/continuity.json
src/cli/commands/session.ts             # mycontext session [list|name|carry]
commands/session-name.md                # hand-written slash command (KEEP + HAND_WRITTEN)
commands/session-carry.md               # hand-written slash command (KEEP + HAND_WRITTEN)
test/core/seen-clear.test.ts
test/core/session-names.test.ts
test/core/continuity.test.ts
test/core/carried-index.test.ts
test/core/audit-new-ops.test.ts
test/hooks/session-start-clear.test.ts
test/hooks/subagent-start.test.ts
test/hooks/post-tool-use-failure.test.ts
test/cli/session.test.ts
test/perf/subagent-start-latency.perf.ts
.superpowers/probes/2026-08-20-clear-and-prompt-hooks.md   # Tasks 1 and 2's recorded results
```

Modified files:

```
hooks/hooks.json                # + SubagentStart, + PostToolUseFailure (Tasks 7, 11)
src/hooks/io.ts                 # + hookContext(), + readStdinAsync(), + prompt_id (Task 5)
src/hooks/post-tool-use.ts      # uses io.ts's readStdinAsync (Task 5)
src/core/audit.ts               # + two ops, + KIND_OF rows, + hook union members (Task 4)
src/core/seen-file.ts           # + clearSeen (Task 6)
src/core/inject.ts              # clear branch, subagent event, dedupeKey, carry read (Tasks 8, 9, 18)
src/core/select.ts              # SelectContext.carried, buildIndex priority + marker (Task 17)
src/core/render-item.ts         # renderIndexLine marks a carried line (Task 17)
src/core/render.ts              # subagent preamble + carry disclosure (Tasks 10, 19)
src/cli/commands/index.ts       # + import './session.ts'
src/cli/index.ts                # (no change; named because pruneSnapshots' other caller lives here)
scripts/gen-commands.ts         # KEEP gains the two hand-written commands (Task 16)
test/plugin/commands.test.ts    # HAND_WRITTEN gains the same two (Task 16)
test/hooks/hook-binaries-e2e.test.ts  # six binaries; held-open case extended (Tasks 7, 11)
.my_context/items/invariant/INV-hooks-fail-open.md  # + a [limit] line (Task 11 — HUMAN ONLY)
README.md, docs/README.he.md    # §8 and the command/hook tables (Task 20)
```

---

## Task 1: Measure `/clear` — **BLOCKED on an interactive session**

`claude -p` cannot produce a `/clear`. This task requires a human at a terminal. Nothing downstream
is blocked on it *structurally* — Task 6 ships a tested function either way — but Tasks 6 and 8 each
carry a decision table this task resolves.

**Files:**
- Create: `.superpowers/probes/2026-08-20-clear-and-prompt-hooks.md`

**Interfaces:**
- Consumes: nothing.
- Produces: two recorded answers, quoted from a real payload, consumed by Tasks 6, 8 and 12.

**The two questions, and why neither may be assumed.** `hooks/io.ts` · `SessionStart only: startup`
· ~8 lists `clear` as a `source` value and `hooks/hooks.json` · `"matcher": "startup` · ~6 already
matches it — but *listing a value in a comment and a matcher is not evidence the platform ever sends
it*, and nothing in the code or either spec records whether `/clear` mints a new `session_id`. Both
answers change what the clear handler is for.

- [ ] **Step 1: Write the probe hook**

A throwaway `SessionStart` hook that appends its raw payload to a file. Do **not** modify
`src/hooks/session-start.ts`. Put it outside `src/`:

```ts
// .superpowers/probes/echo-session-start.ts  (throwaway; delete after Step 4)
import { appendFileSync, readFileSync } from 'node:fs';
let raw = '';
try { raw = readFileSync(0, 'utf8'); } catch { /* interactive */ }
appendFileSync(
  new URL('./session-start-payloads.jsonl', import.meta.url),
  `${new Date().toISOString()} ${raw.replace(/\s+/gu, ' ')}\n`,
);
process.exitCode = 0;
```

Register it as a **second** `SessionStart` entry in a local settings file, not in
`hooks/hooks.json` — the manifest is shipped and this hook is not.

- [ ] **Step 2: Run the interactive sequence**

In one terminal, in this repository:

1. `claude` — note the session id printed by `mycontext audit --sessions` afterwards.
2. Do one tool call, so at least one item lands in the seen file.
3. `/clear`.
4. Do one more tool call.
5. Exit.

- [ ] **Step 3: Record the answers verbatim**

Write `.superpowers/probes/2026-08-20-clear-and-prompt-hooks.md` with, for each firing: the raw
payload line, the `hook_event_name`, the `source` value **exactly as received** (including "the field
was absent"), and the `session_id`.

Then answer the two questions in a table:

| Question | Answer | Evidence |
|---|---|---|
| Does `SessionStart` fire after `/clear` at all? | yes / no | payload line N |
| If it fires, what is `source`? | `clear` / something else / absent | payload line N |
| Is `session_id` after the clear the same as before? | same / different | payload lines N and M |

- [ ] **Step 4: Delete the probe hook and its settings entry**

The recorded payloads stay; the hook does not.

- [ ] **Step 5: Commit**

```bash
git add .superpowers/probes/2026-08-20-clear-and-prompt-hooks.md
git commit -m "probe: what SessionStart reports on /clear, and whether session_id survives"
```

**Decision table — consumed by Tasks 6 and 8:**

| `source` | `session_id` | What Tasks 6 and 8 do |
|---|---|---|
| `clear` | preserved | The full handler: clear the parent seen file, sweep the `session::agent` siblings, remove the restore snapshot, disclose in the note. This is the case §6a was written for |
| `clear` | new id | The branch still runs and is a no-op by construction (a fresh id has no state). Task 8 keeps it — it costs one comparison — but the disclosure must say *"no prior state for this session id"* rather than claiming a clear happened |
| not `clear` (some other value) | either | Task 8's branch is written against **the measured value**, not against `'clear'`. Record the real value in the probe file and use it |
| no `SessionStart` firing at all | — | Task 8 ships **no branch**. `clearSeen` from Task 6 stays (it is the removal primitive `state/` has never had and Task 12 uses it too), and the negative result is recorded in the probe file. Do not ship a branch that cannot fire and a disclosure that cannot appear |

---

## Task 2: Measure the slash-command carrier — **BLOCKED on an interactive session**

§6m.8 rules that the slash command *"arrives as a prompt and therefore reaches a hook that does carry
`session_id`"*. **No probe in the record names that event**, and mycontext registers no hook that
fires on a prompt. This task establishes which event exists, before Task 16 is written against it.

**Files:**
- Modify: `.superpowers/probes/2026-08-20-clear-and-prompt-hooks.md` (a second section)

**Interfaces:**
- Consumes: nothing.
- Produces: the event name and payload shape Task 16 branches on.

- [ ] **Step 1: Register echo hooks for every candidate prompt event**

Reuse the Step-1 echo binary from Task 1, registered under each of `UserPromptSubmit`,
`SubagentStart` and `SubagentStop` in the local settings file (not `hooks/hooks.json`), each writing
to its own file. If an event does not exist, Claude Code will simply never invoke it — that is the
negative answer, and it is recorded as one.

- [ ] **Step 2: Run the interactive sequence**

In one terminal: `claude`, then type `/mycontext:add-rule` (any existing slash command — the point is
that a slash command is submitted as a prompt), then a plain prompt, then exit.

- [ ] **Step 3: Record**

For each candidate event: did it fire, on a slash command and/or on a plain prompt, and does its
payload carry `session_id`? Quote one raw payload per event that fired.

- [ ] **Step 4: Delete the probe hooks and settings entries. Commit.**

```bash
git add .superpowers/probes/2026-08-20-clear-and-prompt-hooks.md
git commit -m "probe: which hook a slash command reaches, and whether it carries session_id"
```

**Decision table — consumed by Task 16:**

| Outcome | What Task 16 does |
|---|---|
| A prompt event fires and carries `session_id` | Register it in `hooks/hooks.json`, with a binary that recognises a sentinel line the slash command emits and calls `setSessionName` / `setCarrySource`. **State its cost in the same commit:** it is a hook on every prompt, and the Global Constraint about the absent in-process bound applies to it exactly as it does to `SubagentStart` |
| A prompt event fires but carries no `session_id` | No hook. The slash command becomes documentation: it tells the user to run `mycontext session list` and then `mycontext session name <id> <name>`. Record in the probe file and in `README.md` §8 that the "supplies the id automatically" half of §6m.8 is **not delivered**, and why |
| No prompt event fires at all | As above. **Do not substitute a claim protocol** — a pending-name file stamped by whichever hook fires next — without a separate ruling: `core/inject.ts` · `on a RESUMED session that value is a freshly-generated id that does` · ~139 is this project's record of what writing under a mismatched key costs, and a claim race between two terminals on one workspace is the concurrency case R7 exists to serve |

---

## Task 3: Measure the carry set on this repository's own history

Measurable now. No interactive session. This is the evidence Task 17's ordering rests on, and it
follows §6e's method note: read what the product already records before probing anything.

**Files:**
- Create: `.superpowers/probes/2026-08-20-carry-set.md`

**Interfaces:**
- Consumes: `.my_context/state/*.seen.jsonl`, `.my_context/.audit/`, the corpus.
- Produces: three numbers Task 17 and Task 19 cite.

- [ ] **Step 1: Write a throwaway measurement script and run it**

For the most recent parent session's seen file, and for the current corpus:

```
A = distinct item ids in that session's seen file
B = index lines the new session's own index would show   (select(..., 'session-start').index.normative)
C = index lines that would be truncated                  (.index.truncated)
D = |A ∩ B|      carried ids that are already candidates → marked, not added
E = |A \ (B ∪ full)|  carried ids that are candidates for NOTHING → disclosed with a reason
```

- [ ] **Step 2: Record the five numbers, the corpus size, and `budgets.index`**

Then answer, in one sentence each: *"on this corpus, does carry change which lines appear?"* and
*"if not, what does it change?"* The expected answer given the corpus measurement above (18 lines, 0
truncated) is *"it changes ordering and labelling, not content"* — but record what you measure, not
what this paragraph predicts.

- [ ] **Step 3: Commit**

```bash
git add .superpowers/probes/2026-08-20-carry-set.md
git commit -m "probe: what a cross-session carry would actually carry, on this corpus"
```

---

## Task 4: Register the two new audit ops

Nothing writes them yet. This lands first because `core/audit.ts` · `which is not one of` · ~286
**refuses** an unregistered op, and a hook whose audit record is rejected looks exactly like a hook
that silently did not run.

**Files:**
- Modify: `src/core/audit.ts`
- Test: `test/core/audit-new-ops.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `'subagent-start'` as an `InjectionOp`, `'post-tool-use-failure'` as a `HookOp`, and
  `'SubagentStart' | 'PostToolUseFailure'` as `AuditRecord['hook']` members. Tasks 7, 9 and 10 write
  records using them.

**Three edits, and all three are required.** `core/audit.ts` · `export const INJECTION_OPS = ['session-start', 'compact-restore', 'jit', 'manual'] as const;` · ~94
and `core/audit.ts` · `export const HOOK_OPS = ['pre-compact', 'post-tool-use', 'deny'] as const;` · ~98
declare the vocabulary; `core/audit.ts` · `const KIND_OF: Record<AuditOp, AuditKind> = {` · ~124 maps
each to a kind; `core/audit.ts` · `hook?: 'SessionStart'` · ~180 names which hook ran. `KIND_OF` is
typed `Record<AuditOp, AuditKind>`, so omitting a row is a **compile** error — but adding an op
without a writer is not, which is why the test below writes one.

**`LEDGER_TIERS` is not touched.** `core/audit.ts` · `const LEDGER_TIERS = new Set(['pinned', 'jit', 'restored']);` · ~567
decides what a replayed ledger claims was delivered. `'carried'` (Task 17) must stay out of it and
out of `core/seen-file.ts` · `const TIERS = new Set<string>(['pinned', 'jit', 'restored']);` · ~37,
or a rebuilt ledger claims deliveries that never happened.

- [ ] **Step 1: Write the failing test**

```ts
// test/core/audit-new-ops.test.ts
/**
 * `parseAudit` refuses an op it does not know, so a hook that writes an
 * unregistered op produces a log that rejects its own records — a failure that
 * looks exactly like the hook silently not running. The existing totality test
 * catches an op with no KIND_OF row; it cannot catch an op that was never added.
 * This test is the other half: it writes each new op and reads it back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUDIT_OPS, kindOf, parseAudit, recordAudit, readAudit } from '../../src/core/audit.ts';

test('subagent-start is an injection op and post-tool-use-failure is a hook op', () => {
  assert.ok(AUDIT_OPS.includes('subagent-start'));
  assert.ok(AUDIT_OPS.includes('post-tool-use-failure'));
  assert.equal(kindOf('subagent-start'), 'injection');
  assert.equal(kindOf('post-tool-use-failure'), 'hook');
});

test('a record written with each new op parses back', () => {
  // Build one JSONL line per new op through the same writer the hooks use,
  // then read it back through parseAudit. A missing registration throws here.
  // (Use the repo's existing temp-workspace helper; removeTree for cleanup.)
});

test('carried is not a ledger tier and not a seen tier', async () => {
  const seen = await import('../../src/core/seen-file.ts');
  assert.equal(seen.SEEN_PROTOCOL, 'mycontext-seen/1');
  // A seen line with tier 'carried' must be refused by the seen file's
  // validator — asserted through readSeen on a hand-written file.
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/core/audit-new-ops.test.ts` — Expected: FAIL, `AUDIT_OPS` does not include
`subagent-start`.

- [ ] **Step 3: Make the three edits**

Add `'subagent-start'` to `INJECTION_OPS`; `'post-tool-use-failure'` to `HOOK_OPS`; the two `KIND_OF`
rows; and widen the `hook?:` union with `'SubagentStart' | 'PostToolUseFailure'`. Nothing else.

- [ ] **Step 4: Run the test and the suite**

Run: `node --test test/core/audit-new-ops.test.ts` then `npm test`. Both green.

- [ ] **Step 5: Commit**

```bash
git add src/core/audit.ts test/core/audit-new-ops.test.ts
git commit -m "feat(audit): register subagent-start and post-tool-use-failure ops"
```

---

## Task 5: One envelope builder and one async stdin reader in `io.ts`

**Files:**
- Modify: `src/hooks/io.ts`, `src/hooks/post-tool-use.ts`
- Test: `test/hooks/hook-input-parse.test.ts` (extend)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export type HookEventName = 'PreToolUse' | 'PostToolUse' | 'SubagentStart';` — the events whose
    output is a `hookSpecificOutput` envelope. `SessionStart` is deliberately absent: it writes raw
    text (`hooks/session-start.ts` · `if (text) process.stdout.write(text);` · ~59) and must keep
    doing so.
  - `export function hookContext(event: HookEventName, text: string): string` — the generalisation of
    `hooks/io.ts` · `export function preToolUseContext(text: string): string {` · ~169.
    `preToolUseContext` stays, as a one-line wrapper, so its two existing call sites and their tests
    do not move in this task.
  - `export function readStdinAsync(): Promise<string>` — moved verbatim from
    `hooks/post-tool-use.ts` · `process.stdin.on('end', () => resolve(data));` · ~100, which then
    imports it. One implementation, because Task 10 needs the same one.
  - `prompt_id?: string;` declared on `HookInput`, measured present on `PreToolUse`, `SubagentStart`
    and `SubagentStop`. `permission_mode`, `effort` and `tool_use_id` are **not** added: nothing in
    this plan reads them, and a declared field nothing reads is a claim about the payload that no
    test can hold up.

- [ ] **Step 1: Write the failing test** — extend `test/hooks/hook-input-parse.test.ts`:

```ts
test('hookContext builds the envelope each event needs', () => {
  assert.deepEqual(JSON.parse(hookContext('SubagentStart', 'hello')), {
    hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: 'hello' },
  });
  assert.equal(hookContext('PreToolUse', 'x'), preToolUseContext('x'));
});

test('readStdinAsync resolves to empty string when stdin is closed with nothing', async () => {
  assert.equal(typeof (await readStdinAsync()), 'string');
});

test('prompt_id survives parseHookInput', () => {
  assert.equal(parseHookInput('{"prompt_id":"p1"}').input.prompt_id, 'p1');
});
```

- [ ] **Step 2: Run it and see it fail.** `node --test test/hooks/hook-input-parse.test.ts`.

- [ ] **Step 3: Implement**

`hookContext` returns `JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } })`.
`preToolUseContext(text)` becomes `hookContext('PreToolUse', text)`. Move the async reader; delete
the copy in `post-tool-use.ts` and import it. Add `prompt_id?: string;` beside `agent_type`.

- [ ] **Step 4: Run `npm test` and `npx tsc --noEmit`.** Both green — `post-tool-use.ts`'s behaviour
  is unchanged, which its own tests assert.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/io.ts src/hooks/post-tool-use.ts test/hooks/hook-input-parse.test.ts
git commit -m "refactor(hooks): one envelope builder and one async stdin reader in io.ts"
```

---

## Task 6: `clearSeen` — the removal primitive `state/` has never had

**Files:**
- Modify: `src/core/seen-file.ts`
- Test: `test/core/seen-clear.test.ts`

**Interfaces:**
- Consumes: `sanitizeSessionId`, `retryOnTransientFsError`.
- Produces:
  ```ts
  export interface ClearSeenReport {
    /** File names removed, relative to `state/`. */
    removed: string[];
    /** One entry per file that existed and could not be removed. */
    failed: { file: string; reason: string }[];
    /**
     * false when the `session::agent` siblings could not be identified from the
     * parent id — see the sweep rule below. The caller must disclose it.
     */
    sweptSiblings: boolean;
  }
  export function clearSeen(root: string, sessionId: string): ClearSeenReport;
  ```
  Task 8 calls it on a clear; Task 12 does not (pruning stays age-based).

**The sibling sweep, and exactly when it is sound.** `core/seen-file.ts` · `export function seenFilePath(root: string, key: string): string {` · ~39
sanitises the key, and `core/ledger.ts` · `export function sanitizeSessionId(sessionId: string): string {` · ~353
passes a canonical id through byte-stable while turning a composite `sid::agent` into
`sid__agent-<12 hex>`. Measured in `.my_context/state/` today: the parent file is
`9e5b6b17-…-775b4eccd9e7.seen.jsonl` and the 45 siblings are
`9e5b6b17-…-775b4eccd9e7__a<agent>-<digest>.seen.jsonl`. So:

- Remove `` `${san}.seen.jsonl` `` where `san = sanitizeSessionId(sessionId)` — always.
- Remove every `state/*.seen.jsonl` whose name starts with `` `${san}__` `` — **only when
  `san === sessionId && sessionId.length <= 96`.** Outside that window the composite's base is either
  a different digested string or truncated by `.slice(0, 96)`, and the prefix no longer holds. Set
  `sweptSiblings: false` and let the caller say so.
- Anchor on the exact prefix, never on `san` alone: a bare prefix match would also delete a *different*
  session whose id begins with this one.

**Never throws**, per `core/seen-file.ts` · `unreadable seen file means "inject WITHOUT dedupe and disclose"` · ~18.
A file that cannot be removed is one entry in `failed`, never an exception. Each removal goes through
`core/rebuild.ts` · `export function retryOnTransientFsError<T>(fn: () => T, attempts = 5): T {` · ~205,
for the same Windows reason `appendSeen` does — a scanner holding a handle open for a moment must
cost a retry, not a lost clear. Use `rmSync(file, { force: true })` on single files; this removes no
directory tree, so `removeTree` does not apply.

**Deleting a live subagent's dedupe state is possible and is the safe direction.** It costs that
subagent one re-injection. The opposite error — leaving state that suppresses everything — is the one
this task exists to fix.

- [ ] **Step 1: Write the failing test**

```ts
// test/core/seen-clear.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
// build a temp workspace with the repo's existing helper; removeTree for cleanup

test('clearSeen removes the parent file and every session::agent sibling', () => {
  // appendSeen(root, 'sess-1', …); appendSeen(root, 'sess-1::a1', …);
  // appendSeen(root, 'sess-1::a2', …); appendSeen(root, 'sess-2', …);
  // const report = clearSeen(root, 'sess-1');
  // assert.equal(report.removed.length, 3);
  // assert.equal(report.sweptSiblings, true);
  // sess-2's file is untouched — the prefix is anchored
});

test('a session id that begins with another session id is not collateral', () => {
  // appendSeen(root, 'sess-1', …); appendSeen(root, 'sess-10', …);
  // clearSeen(root, 'sess-1') leaves sess-10's file in place
});

test('a non-canonical session id clears its own file and reports the sweep as not done', () => {
  // key with a character sanitizeSessionId digests, e.g. 'a/b'
  // assert.equal(report.sweptSiblings, false);
});

test('clearSeen never throws when state/ does not exist', () => {
  // fresh root, no state/ — returns an empty report
});

test('a file that cannot be removed lands in failed, and clearSeen still returns', () => {
  // make the file read-only on the platform under test, or skip with a reason
});
```

- [ ] **Step 2: Run it and see it fail.** `node --test test/core/seen-clear.test.ts`.

- [ ] **Step 3: Implement `clearSeen`** in `src/core/seen-file.ts`, beside `seenFilePath`.

- [ ] **Step 4: `npm test` green.**

- [ ] **Step 5: Commit**

```bash
git add src/core/seen-file.ts test/core/seen-clear.test.ts
git commit -m "feat(seen): clearSeen removes a session's dedupe state and its subagent siblings"
```

---

## Task 7: The `PostToolUseFailure` hook

The cheapest of the three hooks and the one with no injection: one audit append on a rare event,
feeding the degradation counter that is the empirical check on a fail-open policy whose cost is
invisible by design.

**Files:**
- Create: `src/hooks/post-tool-use-failure.ts`, `test/hooks/post-tool-use-failure.test.ts`
- Modify: `hooks/hooks.json`, `test/hooks/hook-binaries-e2e.test.ts`

**Interfaces:**
- Consumes: `parseHookInput`, `readStdin` (`io.ts`), `recordAudit` and the `'post-tool-use-failure'`
  op from Task 4.
- Produces: `export function recordToolFailure(input: HookInput, fallbackCwd: string): AuditWriteResult | null`.

**Shape to copy:** `hooks/pre-compact.ts` · `export function buildRestoreSnapshot(` · ~23 — a hook
that injects nothing, writes one audit record, discloses a write failure on stderr **and** in the
log, and exits 0. Synchronous stdin is correct here: this hook produces no output the model reads, so
a stalled read costs nothing but the process, and the existing three-hook pattern is the precedent.

**No matcher.** `PostToolUse` is matched to `Write|Edit|MultiEdit` because `watchedDocs` is about
documents; a degradation counter is tool-agnostic. `PreCompact`'s entry is the precedent for an
unmatched event. Registration:

```jsonc
"PostToolUseFailure": [
  { "hooks": [ { "type": "command",
                 "command": "node --disable-warning=ExperimentalWarning \"${CLAUDE_PLUGIN_ROOT}/src/hooks/post-tool-use-failure.ts\"",
                 "timeout": 5 } ] }
]
```

The command **must** carry `--disable-warning=ExperimentalWarning`, matching every other entry —
see §0's first row.

**The record.** `kind: 'hook'` (nothing was put in front of the model), `op: 'post-tool-use-failure'`,
`hook: 'PostToolUseFailure'`, `sessionId` from the payload, `injected: []`, and a `note` carrying
**scope, not content**: the tool name and, when the payload supplies one, a one-line flattened reason.
Never the tool input and never the file's contents — the same rule every injection record follows.

**Unverified, and treated as such:** whether this event fires, and what its payload names its failure
reason. This task does not depend on either. If it never fires, nothing is written and nothing
breaks; if the reason field is named something else, the note simply omits it. Do not write a field
accessor that asserts a payload shape no probe established — read defensively and record what
arrived.

- [ ] **Step 1: Write the failing test** — `test/hooks/post-tool-use-failure.test.ts`:

```ts
test('a failure payload writes exactly one hook record with no injected refs', () => { /* … */ });
test('the note carries the tool name and never the tool input', () => { /* … */ });
test('a payload with no session_id still records', () => { /* … */ });
test('garbage on stdin writes nothing and exits 0', () => { /* … */ });
```

- [ ] **Step 2: Run it and see it fail.**

- [ ] **Step 3: Write the binary**, entry-guarded with `isMainEntry`, `try/catch` around everything,
  `process.exitCode = 0` unconditionally.

- [ ] **Step 4: Register it in `hooks/hooks.json`.**

- [ ] **Step 5: Extend the binaries e2e test**

`test/hooks/hook-binaries-e2e.test.ts` enumerates the binaries and asserts two contracts each:
garbage on stdin exits 0 and says nothing; a real payload produces the envelope Claude Code reads.
Add this binary to the enumeration — its "envelope" is empty stdout, which is the contract. Update
the header's count to **six** (Task 11 adds the other one; if Task 11 has not landed, write **five**
and Task 11 corrects it).

- [ ] **Step 6: `npm test` green. Commit.**

```bash
git add src/hooks/post-tool-use-failure.ts test/hooks/post-tool-use-failure.test.ts hooks/hooks.json test/hooks/hook-binaries-e2e.test.ts
git commit -m "feat(hooks): PostToolUseFailure records one audit row per failed tool call"
```

---

## Task 8: Handle `source === 'clear'` in `SessionStart`

**Depends on Task 1's decision table and Task 6's `clearSeen`.** If Task 1's outcome is "no
`SessionStart` firing at all", skip this task and record why in the probe file — do not ship a branch
that cannot fire.

**Files:**
- Modify: `src/core/inject.ts`
- Test: `test/hooks/session-start-clear.test.ts`

**Interfaces:**
- Consumes: `clearSeen` (Task 6), `snapshotPath` (`core/ledger.ts`).
- Produces: no new export. The behaviour is observable through the injected block's note and through
  the audit record's `note` field.

**Where the branch goes, and why the order is the whole task.** `core/inject.ts` · `const compacting = options.source === 'compact';` · ~131
is the single decision point. Add beside it:

```ts
const clearing = options.source === 'clear';
```

and run the clear **before** `core/inject.ts` · `const seenState = sessionId ? readSeen(ws.projectRoot, sessionId) : null;` · ~181.
Running it after would read the state it is about to delete, and the window would come up empty while
the knowledge base believed it was full — which is precisely today's behaviour and the defect this
task fixes.

**What is removed:** the parent seen file, the `session::agent` siblings (Task 6), **and** the restore
snapshot at `core/ledger.ts` · `export function snapshotPath(root: string, sessionId: string): string {` · ~361 —
design decision 8.

**What is disclosed, and where.** `core/inject.ts` · `if (options.source !== undefined) noteParts.push(` · ~359
already records `source=clear`. Push one further note built from the `ClearSeenReport`:

- everything removed: `cleared N seen file(s) and the restore snapshot for this session`;
- `sweptSiblings === false`: `… subagent dedupe files could not be identified from this session id and were left`;
- any `failed` entry: `… N seen file(s) could not be removed (<reason>); items already delivered may be suppressed`;
- Task 1 outcome "new id on clear": `no prior state for this session id` — **not** a claim that a
  clear happened.

The same note reaches the model, because a cleared window that silently receives fewer items than it
should is exactly the addition-shaped omission `INV-nothing-is-dropped-silently` covers in both
directions.

**A failed delete over-injects, which is the safe direction** — state that in the code comment, not
only here.

- [ ] **Step 1: Write the failing test** — `test/hooks/session-start-clear.test.ts`:

```ts
test('a clear removes the seen files before the seen file is read, so items arrive again', () => {
  // seed a seen file with an id that is pinned; buildSessionStartOutput(cwd, { source: 'clear', sessionId })
  // asserts the item appears in the output — today it does not
});
test('a clear removes the restore snapshot', () => { /* … */ });
test('a clear that removed nothing says so rather than claiming it cleared', () => { /* … */ });
test('a seen file that cannot be removed is disclosed in the note and the injection still happens', () => { /* … */ });
test('startup and resume are unchanged — no clear, no note', () => { /* … */ });
test('compact is unchanged — the restore still fires', () => { /* … */ });
```

The last two matter as much as the first: `core/inject.ts` · `const compacting = options.source === 'compact';` · ~131
is read by every injection surface including the `load_context` MCP tool, and
`core/inject.ts` · `const sessionId = manual ? undefined : options.sessionId;` · ~169 must stay true —
a manual load must never clear anything.

- [ ] **Step 2: Run it and see it fail.**

- [ ] **Step 3: Implement the branch and the notes.**

- [ ] **Step 4: `npm test` and `npm run test:perf` green.** The clear adds one `readdirSync` of
  `state/` to a `SessionStart` whose ceiling is
  `test/perf/session-start-latency.perf.ts` · `const CEILING_MS = perfCeiling(500);` · ~64 — confirm
  the perf test still passes rather than assuming it does.

- [ ] **Step 5: Commit**

```bash
git add src/core/inject.ts test/hooks/session-start-clear.test.ts
git commit -m "feat(inject): a cleared window clears its dedupe state, and says what it cleared"
```

---

## Task 9: `buildInjection` learns a subagent event and an explicit dedupe key

Core-only. No hook yet, so the suite stays green with nothing calling the new path but its tests.

**Files:**
- Modify: `src/core/inject.ts`
- Test: `test/hooks/manual-load-restore.test.ts` (extend) or a new `test/core/inject-subagent.test.ts`

**Interfaces:**
- Consumes: Task 4's `'subagent-start'` op and `'SubagentStart'` hook name.
- Produces:
  - `InjectionEvent` gains `'subagent'` — `core/inject.ts` · `export type InjectionEvent = 'session-start'` · ~24.
  - `InjectionOptions` gains `dedupeKey?: string` — *"the seen-file key, when it is not `sessionId`.
    `SubagentStart` passes `ledgerKey(input)`; every other caller leaves it unset."*
  Task 10 consumes both.

**Four behaviours the subagent event must have, each different from `'session-start'`:**

1. **The selection is identical.** It calls `select` with `event: 'session-start'`, which admits the
   pinned tier at `core/select.ts` · `if (ctx.event === 'session-start' \|\| ctx.event === 'compact' \|\| ctx.event === 'manual') {` · ~487
   and builds the index at `core/select.ts` · `buildIndex(eligible, merged, config, chosenIds);` · ~540.
   **Never `'tool'`** — a tool event returns
   `core/select.ts` · `index: emptyIndex(), spilled: trueSpills(spilled), focus: focusReport,` · ~535,
   so the subagent would get the pinned tier and no index at all.
2. **The audit record differs:** `op: 'subagent-start'`, `hook: 'SubagentStart'`, `sessionId` still the
   **parent's** id so `mycontext audit --session` groups a subagent's delivery under the session it
   belongs to, and the `agent_id` in the note — scope, not content. `AuditRecord` has no agent field
   and this task does not add one.
3. **The seen key is `dedupeKey`, not `sessionId`.** Replace `sessionId` with
   `dedupeKey ?? sessionId` at `core/inject.ts` · `const seenState = sessionId ? readSeen(ws.projectRoot, sessionId) : null;` · ~181
   and at `core/inject.ts` · `appendSeen(ws.projectRoot, sessionId, selection.full.map((e) => ({` · ~410.
   **Leave the snapshot read alone** — `readSnapshotMeta` stays parent-keyed, because `PreCompact` is a
   parent-only event by measurement and a composite key there would write dedupe records no restore can
   ever find.
4. **The best-effort index refresh is skipped** — design decision 3. Guard
   `core/inject.ts` · `store = Store.open(ws.dbPath, manual ? undefined : HOOK_OPEN_PROFILE);` · ~279
   so the subagent event never reaches it, and say in the comment beside
   `core/inject.ts` · `// 3. BEST-EFFORT INDEX REFRESH` · ~266 that the parent's SessionStart already
   refreshed. A skip is not a drop: nothing is lost, so nothing needs disclosing — but the comment must
   say which caller skips and why, or the next reader will restore it.

- [ ] **Step 1: Write the failing test**

```ts
test('a subagent injection delivers the pinned tier in full AND the index', () => {
  // buildInjection(cwd, { event: 'subagent', sessionId: 's', dedupeKey: 's::a1' })
  // asserts the output contains both headings
});
test('the seen entries land under the composite key, not the parent id', () => { /* … */ });
test('the parent session can still be injected after a subagent was', () => {
  // the regression the composite key exists to prevent
});
test('the subagent path opens no writable store', () => {
  // assert the index mtime/rebuild did not run — or assert via an injected Store spy
});
test('the audit record carries op subagent-start, hook SubagentStart, and the parent sessionId', () => { /* … */ });
test('session-start, compact and manual are byte-identical to before', () => {
  // a golden-output assertion over the three existing events
});
```

- [ ] **Step 2: Run it and see it fail.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: `npm test`, `npx tsc --noEmit`, `npm run test:perf` green. Commit.**

```bash
git add src/core/inject.ts test/core/inject-subagent.test.ts
git commit -m "feat(inject): a subagent event, keyed on ledgerKey, skipping the index refresh"
```

---

## Task 10: The `SubagentStart` binary, with provenance framing

**Files:**
- Create: `src/hooks/subagent-start.ts`, `test/hooks/subagent-start.test.ts`
- Modify: `src/core/render.ts`

**Interfaces:**
- Consumes: `hookContext` and `readStdinAsync` (Task 5), `ledgerKey` (`io.ts`), `buildInjection` with
  `event: 'subagent'` (Task 9).
- Produces: `export function buildSubagentStartOutput(input: HookInput, fallbackCwd: string): string`
  — the envelope, or `''`. Task 11 registers the binary.

**The envelope is `SubagentStart`'s own**, measured: `hookSpecificOutput.hookEventName` must be
`'SubagentStart'`, not `'PreToolUse'`. `hookContext('SubagentStart', text)` builds it.

**The stdin shape, and exactly what it buys.** Copy
`hooks/post-tool-use.ts` · `const timer = setTimeout(() => process.exit(0), 2000);` · ~121 —
`readStdinAsync()` plus an unref'd timer. That bounds **one** failure: a pipe that never closes. It
does **not** bound the selection, because `buildInjection` is synchronous once it starts and, as
`hooks/post-tool-use.ts` · `A synchronous readFileSync(0), by contrast, blocks the thread` · ~115
explains for the mirror case, nothing can preempt synchronous work. Write both halves into the
binary's docstring. Do not write, in the binary or anywhere else, that this hook is bounded by
mycontext — the Global Constraints say what bounds it.

**No `agent_id` means no injection.** `ledgerKey` returns the bare session id when `agent_id` is
absent, and writing the parent's seen file from a subagent event would suppress the parent's next
injection. If `agent_id` is absent, return `''` and exit 0 — an unbounded payload change is not worth
a wrong dedupe record.

**The provenance frame.** Add to `src/core/render.ts`, beside
`core/render.ts` · `## my_context — these govern this project` · ~144, a preamble rendered **only**
for the subagent event, and prepended by `buildInjection`:

> _This block was delivered by my_context, the knowledge plugin installed in this repository, at the
> start of this subagent — it is not part of the message that dispatched you. The items below are
> this project's recorded knowledge: they were written by people working on it and reviewed before
> they were allowed to govern. Read them and act on them. `mycontext show <id>` fetches anything the
> index names._

Three things it must contain, and all three are the measured requirement rather than style: **where
it came from** (a plugin, at a named moment), **who wrote what it carries** (people, reviewed), and
**that it is not the dispatcher speaking**. A bare imperative was reported to the parent as a
possible out-of-band attack, which is the model behaving correctly; an instruction with no account
of its origin is indistinguishable from an injection.

**It is scaffolding, not budget.** Like the spill and focus notes, the preamble is outside
`budgets.pinned` and `budgets.index`. Say so in the comment beside it, or the next person to read
`Selection.tokens` will believe it is counted.

- [ ] **Step 1: Write the failing test** — `test/hooks/subagent-start.test.ts`:

```ts
test('the output is a SubagentStart envelope, not a PreToolUse one', () => { /* … */ });
test('the injected text opens with the provenance frame, before the governing block', () => { /* … */ });
test('a payload with no agent_id injects nothing and writes no seen entry', () => { /* … */ });
test('a second SubagentStart for the same agent_id delivers nothing — the birth entry deduped it', () => { /* … */ });
test('a PreToolUse from that same subagent, after the birth entry, delivers nothing twice', () => {
  // ledgerKey returns the same string at both events — the measured fact this rests on
});
test('garbage on stdin produces empty output and exit 0', () => { /* … */ });
```

- [ ] **Step 2: Run it and see it fail.**

- [ ] **Step 3: Write the preamble renderer and the binary.**

- [ ] **Step 4: `npm test` green. Commit.**

```bash
git add src/hooks/subagent-start.ts src/core/render.ts test/hooks/subagent-start.test.ts
git commit -m "feat(hooks): SubagentStart delivers pinned plus index, framed with its provenance"
```

---

## Task 11: Register `SubagentStart`, bound it as honestly as it can be bounded

This is the highest-risk task in the plan. It is the moment a hook mycontext cannot cut short goes on
the critical path of every subagent dispatch.

**Files:**
- Modify: `hooks/hooks.json`, `test/hooks/hook-binaries-e2e.test.ts`,
  `.my_context/items/invariant/INV-hooks-fail-open.md`
- Create: `test/perf/subagent-start-latency.perf.ts`

**Interfaces:**
- Consumes: Task 10's binary.
- Produces: the registration, the latency budget, and the amended invariant.

**Registration**, `PreCompact`'s unmatched shape, with the warning suppressor every other entry
carries:

```jsonc
"SubagentStart": [
  { "hooks": [ { "type": "command",
                 "command": "node --disable-warning=ExperimentalWarning \"${CLAUDE_PLUGIN_ROOT}/src/hooks/subagent-start.ts\"",
                 "timeout": 5 } ] }
]
```

**Why 5** — design decision 5, with its cost restated in the commit message: a subagent dispatched
while another process holds the index write lock
(`core/store.ts` · `Worst case ~1.06s: two attempts` · ~122) plus the per-line append backoff
(`core/seen-file.ts` · `= 200 ms of backoff PER LINE` · ~67, multiplied by the number of pinned items
delivered at birth) can be killed, and **a killed hook writes nothing, so nothing records that the
subagent got no context.** That is the one hole this plan opens and does not close.

**The perf test.** `test/perf/subagent-start-latency.perf.ts`, modelled on
`test/perf/session-start-latency.perf.ts` · `const CEILING_MS = perfCeiling(500);` · ~64 and using
`test/helpers/perf.ts` · `export function perfCeiling(` · ~55. Same 500 ms p95 ceiling and the same
500-item corpus, because it does the same selection. It is what turns "5 seconds is enough" from an
assertion into a measurement — and it measures the **in-process** function, not `node` startup, which
the test's own docstring must say.

**The invariant amendment — HUMAN ONLY.** `.my_context/items/invariant/INV-hooks-fail-open.md` · `- [limit] PreToolUse/JIT is held to p95 under 50ms; SessionStart to 500ms #performance` · ~30
names two hooks. It is `severity: hard` and it is injected, so leaving it silent about the one hook
that stalls dispatch is the invariant describing a system that no longer exists. Add one observation:

```
- [limit] SubagentStart is held to p95 under 500ms and blocks every dispatch; nothing in-process bounds it #performance
```

**The `PreToolUse` deny hook refuses agent writes to `.my_context/items/`, so an agent cannot make
this edit.** It is a human step: edit the file, then `mycontext repair --yes` to re-stamp the
checksum, or `doctor` will redden on a drifted checksum. If the human step is not available, **stop
and say so** — do not work around the deny hook, and do not ship the registration with the invariant
still describing the old system.

- [ ] **Step 1: Write the perf test and watch it fail** (no binary registered yet is fine — it
  imports the function).

- [ ] **Step 2: Register the hook in `hooks/hooks.json`.**

- [ ] **Step 3: Extend the binaries e2e test**

Add `subagent-start.ts` to the enumeration. **And extend the stdin-held-open assertion to it** —
`test/hooks/hook-binaries-e2e.test.ts` · `The stdin-held-open case is PostToolUse only, deliberately.` · ~15
says why that case was PostToolUse-only, and after Task 10 it is no longer only. That assertion is
the one property in the suite that would catch a dispatch-stalling hook; leaving it unextended leaves
the new hook's one real bound untested. Rewrite the header: six binaries, and two of them read stdin
asynchronously.

- [ ] **Step 4: Amend the invariant (human), then `mycontext repair --yes`.**

- [ ] **Step 5: `npm test`, `npm run test:perf`, `mycontext doctor` all green. Commit.**

```bash
git add hooks/hooks.json test/perf/subagent-start-latency.perf.ts test/hooks/hook-binaries-e2e.test.ts .my_context/items/invariant/INV-hooks-fail-open.md
git commit -m "feat(hooks): register SubagentStart at timeout 5, with a latency budget and an amended invariant"
```

---

## Task 12: A second prune trigger, before the seen files outgrow the fix

`.my_context/state/` held 15 files when the survey ran and **47** a day later, 45 of them subagent
siblings for one session id. `SubagentStart` creates a seen file for **every** subagent, including
the ones that touch no file tool and therefore create nothing today — a strict increase, on the hot
dispatch path, with the same unbounded-between-rebuilds retention. Shipping Task 11 without this
makes a known problem measurably worse.

**Files:**
- Modify: `src/hooks/session-start.ts`
- Test: `test/hooks/session-start.test.ts` (extend), `test/perf/session-start-latency.perf.ts` (extend)

**Interfaces:**
- Consumes: `core/ledger.ts` · `export function pruneSnapshots(` · ~456.
- Produces: no new export.

**Where it runs, and why there.** In the entry guard, **after**
`hooks/session-start.ts` · `if (text) process.stdout.write(text);` · ~59. The model already has its
text, so the sweep cannot delay the injection it follows; it is once per session rather than once per
tool call; and it is best-effort in a `try/catch` that cannot change the exit code. `pruneSnapshots`
never throws and takes a per-file callback so the caller can disclose what went — and the disclosure
matters here for the reason the function's own docstring gives: at the next injection a pruned seen
file is indistinguishable from a fresh session.

**Disclosure:** when the sweep removes any `.seen.jsonl`, write one line to stderr naming the count.
Not to the injected block — the items it affects are ones that will simply arrive again, and a note
in every session about routine housekeeping is how a reader learns to skim.

**What this does not fix, stated rather than glossed:** a project whose sessions never start never
prunes, and the retention is still 30 days by mtime. `mycontext rebuild` remains the other caller,
and `doctor` gains nothing here.

- [ ] **Step 1: Write the failing test** — a workspace with an old-mtime seen file and a fresh one;
  after `SessionStart`, only the old one is gone, and stderr names it.

- [ ] **Step 2: Run it and see it fail.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Extend the SessionStart perf test** with a `state/` directory holding 200 files, and
  assert the p95 still fits `perfCeiling(500)`. A `readdirSync` plus a `statSync` per entry is the
  cost; measure it rather than assuming it is free.

- [ ] **Step 5: `npm test`, `npm run test:perf` green. Commit.**

```bash
git add src/hooks/session-start.ts test/hooks/session-start.test.ts test/perf/session-start-latency.perf.ts
git commit -m "feat(hooks): SessionStart sweeps stale state/ entries after it has written its output"
```

---

## Task 13: The session-name store

**Files:**
- Create: `src/core/session-names.ts`, `test/core/session-names.test.ts`

**Interfaces:**
- Consumes: `sanitizeSessionId` is **not** used here — this file is keyed by raw session id inside
  JSON, not by filename.
- Produces:
  ```ts
  export const SESSION_NAMES_PROTOCOL = 'mycontext-session-names/1';
  export interface SessionNameEntry { name: string; at: string }
  /** Never throws. `error !== null` means the file exists and cannot be trusted. */
  export function readSessionNames(root: string): { names: Map<string, SessionNameEntry>; error: string | null };
  export function setSessionName(root: string, sessionId: string, name: string):
    { written: boolean; error: string | null };
  export function sessionNamesPath(root: string): string;   // state/session-names.json
  ```
  Tasks 14, 15, 16 and 19 consume it.

**Why a new store, and why it is workspace-scoped.**
`core/focus.ts` · `has a trustworthy session id: the CLI runs in a terminal and is handed none,` · ~25
is the precedent: no writable surface knows which session it is in, so focus retreated to
`core/focus.ts` · `export function focusPath(root: string): string {` · ~285 — one file per workspace.
A session name **cannot take that escape**, because telling one session from another *within* a
workspace is the entire point of the name. So the file is workspace-scoped and the **key is
explicit**: the caller always supplies the id. That is §6m.8's ruling expressed in a data shape.

**Write mechanics:** temp file then rename through
`core/rebuild.ts` · `export function retryOnTransientFsError<T>(fn: () => T, attempts = 5): T {` · ~205,
the same shape `writeSnapshot` uses, and write a `.gitignore` of `*` beside it exactly as
`core/ledger.ts` · `writeFileSync(path.join(dir, '.gitignore'), '*\n', 'utf8');` · ~406 does — because
`state/` may not have one yet if no snapshot has ever been written, and a name file that reaches git
is a session identifier travelling with the corpus.

**Validation, refusing rather than silently normalising:**
- empty or whitespace-only name → refused;
- longer than 64 characters → refused, with the length in the message;
- any control character, newline or tab → refused (this string goes into a table and into an injected
  disclosure);
- a name already held by a **different** session id → refused, naming the holder and saying that
  renaming that session frees it. Refusing at write is what lets every selector treat a name as
  unambiguous.

**Never throws on read**, matching `core/seen-file.ts` · `unreadable seen file means "inject WITHOUT dedupe and disclose"` · ~18:
a corrupt name file costs labels, never an injection.

- [ ] **Step 1: Write the failing test** — round trip; each refusal with its own assertion; corrupt
  JSON degrades to an empty map plus an `error`; the `.gitignore` is written; concurrent writes from
  two processes do not lose an entry (last writer wins on the same id, and the test says so rather
  than pretending otherwise).

- [ ] **Step 2: Run it and see it fail. Step 3: Implement. Step 4: `npm test` green.**

- [ ] **Step 5: Commit**

```bash
git add src/core/session-names.ts test/core/session-names.test.ts
git commit -m "feat(sessions): a workspace-scoped session-name store, keyed by explicit session id"
```

---

## Task 14: `mycontext session list`

**Files:**
- Create: `src/cli/commands/session.ts`, `test/cli/session.test.ts`
- Modify: `src/cli/commands/index.ts`

**Interfaces:**
- Consumes: `core/audit-db.ts` · `export function sessions(db: DatabaseSync, limit: number): SummaryRow[] {` · ~447,
  its no-database sibling `cli/commands/audit.ts` · `function sessionsWithoutDb(list: AuditRecord[]): SummaryRow[] {` · ~492,
  and `readSessionNames` (Task 13).
- Produces: one registered command `session`, with subcommand dispatch, via
  `cli/commands/registry.ts` · `export function registerCommand(def: CommandDef): void {` · ~46.
  Tasks 15 and 18 add subcommands to the same file.

**Nothing new is needed to enumerate.** Three implementations already exist and
`cli/commands/audit.ts` · `my_context: sessions this log has recorded (most recent ` · ~421 already
prints one today. `sessionsWithoutDb` is currently module-private — export it, rather than writing a
fourth enumeration.

**Columns:** `session` (the full id), `short` (first 8 characters), `name` (**empty** when unnamed),
`activity` (the record count), `last`, `carryable`. Plus `--json`.

**`carryable` is not decoration.** Task 18 reads the carry set from the source session's seen file,
and `state/` is swept at 30 days, so a session the audit log still names can have no seen file left.
A selector that offered it would fail silently at the next session start. The column answers "is
there anything left to carry", and `session carry <id>` refuses an id whose answer is no.

**Nothing is invented for an unnamed session** — §6d rejects deriving a name on the user's behalf,
because a derived name can be wrong and naming is precisely the moment you know what a session is
for. The short prefix is a poor label and an honest one.

- [ ] **Step 1: Write the failing test** — `test/cli/session.test.ts`: the table lists both sessions
  the fixture log knows; a named one shows its name and an unnamed one shows an empty cell (**not**
  a placeholder); `--json` round-trips; the command works with no projection database present;
  `carryable` is false for a session with no seen file.

- [ ] **Step 2: Run it and see it fail. Step 3: Implement. Step 4: `npm test` green.**

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/session.ts src/cli/commands/index.ts src/cli/commands/audit.ts test/cli/session.test.ts
git commit -m "feat(cli): mycontext session list, over the enumeration that already shipped"
```

---

## Task 15: `mycontext session name <id> <name>`

**Files:**
- Modify: `src/cli/commands/session.ts`, `test/cli/session.test.ts`

**Interfaces:**
- Consumes: `setSessionName` (Task 13), the enumeration from Task 14.
- Produces: the `name` subcommand.

**The id is explicit, and the command never guesses.** §6m.8, on
`core/focus.ts` · `has a trustworthy session id: the CLI runs in a terminal and is handed none,` · ~25.
Accept a **full id or an unambiguous prefix** — a prefix that matches two known sessions is refused
with both candidates listed, never resolved by picking one. An id the log has never seen is refused
with a pointer to `mycontext session list`; naming a session that does not exist is a typo, and
accepting it would put an unreachable entry in the store.

**Audit.** Naming is a user action on session metadata, not on an item, and it puts no text in front
of a model. It writes **no audit record**: `AuditKind` is a closed four-member union and a fifth kind
for this is a larger decision than the feature. Say so in the command's docstring, so the absence
reads as a decision rather than an oversight.

- [ ] **Step 1: Write the failing test** — name and read back; ambiguous prefix refused with both
  candidates; unknown id refused; duplicate name refused naming the holder; over-long name refused
  with the length; a name containing a newline refused.

- [ ] **Step 2: Run it and see it fail. Step 3: Implement. Step 4: `npm test` green.**

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/session.ts test/cli/session.test.ts
git commit -m "feat(cli): mycontext session name takes an explicit id and never guesses"
```

---

## Task 16: The slash commands — **BLOCKED on Task 2**

Write this task against Task 2's **recorded** outcome. Its decision table is in Task 2 and is not
repeated here; what follows is common to every branch.

**Files:**
- Create: `commands/session-name.md`, `commands/session-carry.md`
- Modify: `scripts/gen-commands.ts`, `test/plugin/commands.test.ts`
- Conditional on Task 2's outcome: `hooks/hooks.json`, a new binary, `src/core/audit.ts`

**Interfaces:**
- Consumes: Tasks 13, 15, 18.
- Produces: the two slash commands §6d and §6g require, so session selection works without the web UI.

**Both files are hand-written and must be excluded from generation, in two places.**
`scripts/gen-commands.ts` · `const KEEP = new Set(['LoadMyContext.md']);` · ~23 stops the generator
deleting them; `test/plugin/commands.test.ts` · `const HAND_WRITTEN = new Set(['LoadMyContext.md']);` · ~38
stops the parity test failing on them. **The two lists are kept separately and both must be edited** —
that is exactly the two-hand-kept-lists drift this project has found repeatedly, and it bites here.

- [ ] **Step 1: Extend the parity test first**

Add an assertion that every file named in `gen-commands.ts`'s `KEEP` is also in the test's
`HAND_WRITTEN`, and vice versa. That is the drift guard, and it is worth more than the two commands.
Run it; it passes today with one entry, and it is what fails if a later task adds to one list only.

- [ ] **Step 2: Write the two command files**, following `commands/LoadMyContext.md`'s frontmatter
  shape (`description:` only).

- [ ] **Step 3: If and only if Task 2's outcome is "a prompt event fires and carries `session_id`"** —
  register the event in `hooks/hooks.json` with the warning suppressor, add its op to `HOOK_OPS` and
  `KIND_OF` and its name to the `hook?:` union (the Task 4 pattern, which
  `core/audit.ts` · `which is not one of` · ~286 makes mandatory), and write the binary. Its docstring
  must state that it runs on **every prompt** and that the Global Constraint about the absent
  in-process bound applies to it.

- [ ] **Step 4: `npm test` green** — the parity test is the one that proves this landed.

- [ ] **Step 5: Commit**

```bash
git add commands/ scripts/gen-commands.ts test/plugin/commands.test.ts
git commit -m "feat(commands): slash commands for session naming and carry selection"
```

---

## Task 17: Carried index lines — a priority and a marker inside `budgets.index`

The core of cross-session continuity, and the task §0's fifth row rewrote.

**Files:**
- Modify: `src/core/select.ts`, `src/core/render-item.ts`
- Test: `test/core/carried-index.test.ts`

**Interfaces:**
- Consumes: nothing on disk. **`select` reads no files** —
  `.my_context/items/invariant/INV-select-is-pure.md` · `- [invariant] select imports only types and config` · ~29 —
  so carried ids arrive through `SelectContext`.
- Produces:
  ```ts
  // in SelectContext
  /** Item ids a previous session had, plus how to label where they came from. */
  carried?: { sessionId: string; label: string; ids: string[] } | null;

  // in IndexSummary
  carried: {
    sessionId: string; label: string;
    /** Carried ids that got a line, after the budget. */
    shown: number;
    /** Carried ids that could get no line, and why. */
    dropped: { id: string; reason: string }[];
  } | null;

  // each entry of IndexSummary.normative
  { id: string; type: string; title: string; carried?: true }
  ```
  Tasks 18 and 19 consume both; the web UI reads `IndexSummary.carried` verbatim, because
  `/api/select` serialises `select()`'s output and nothing else.

**The rule, stated once.** `buildIndex`'s candidate set is
`core/select.ts` · `.filter((i) => isNormative(i, config) && !chosenIds.has(i.id))` · ~358 — every
eligible normative item not already delivered in full. So:

- A carried id **in** that candidate set is **marked**, and hoisted to the front of the by-id order.
  It is never a second line: the dedupe §6m.11 requires is by construction, because a candidate
  appears exactly once.
- A carried id **not** in that candidate set gets **no line at all**, and lands in `dropped` with the
  reason: `delivered in full this session` (it is in `chosenIds`), `no longer eligible` (retired,
  superseded, deprecated, or its category disabled), `not a normative category`, or `unknown id`. That
  disclosure is the whole of `INV-nothing-is-dropped-silently` here — an item the previous session
  relied on that this one will not see must be visible, not absent.
- A carried, marked line that still does not fit the budget spills exactly as any other index line
  does, through `core/select.ts` · `if (used + cost > config.budgets.index) {` · ~371, with tier
  `'index'`. **No fifth budget, no new config key.**

**Where the ordering ruling lives, and how to reverse it.** The partition is two lines:

```ts
const carriedIds = new Set(ctx.carried?.ids ?? []);
const ordered = [
  ...normativeItems.filter((i) => carriedIds.has(i.id)),
  ...normativeItems.filter((i) => !carriedIds.has(i.id)),
];
```

Front-of-queue is what makes carry do anything on an exhausted index; §6m.11 says "queues" and does
not say where. **To reverse it, swap the two `filter` calls** — and then say, in the same commit, that
carry is a no-op whenever `budgets.index` is already full, because a feature that silently does
nothing is the defect this project names most often.

**The marker must be inside the costed line.** `core/render-item.ts` · `export function renderIndexLine(entry: { id: string; type: string; title: string }): string {` · ~192
is called twice for every line: once by `estimateTokens` to charge the budget and once by the
renderer. If the marker is appended anywhere else, the budget is charged for a line shorter than the
one delivered — and mis-sizing injection is exactly the failure §6a names. Widen the parameter type,
append `` ` · carried` `` when the flag is set, and let both call sites see the same string.

- [ ] **Step 1: Write the failing test** — `test/core/carried-index.test.ts`:

```ts
test('a carried id that is already a candidate is marked, not duplicated', () => { /* … */ });
test('carried candidates come first in the index, ahead of the by-id order', () => { /* … */ });
test('with an exhausted budget, a carried line displaces a non-carried one, and the displaced one spills', () => { /* … */ });
test('a carried id delivered in full this session is dropped with that reason, and gets no line', () => { /* … */ });
test('a carried id that is now superseded is dropped with "no longer eligible"', () => { /* … */ });
test('a carried id nothing knows is dropped with "unknown id"', () => { /* … */ });
test('the budget charged equals the rendered length, marker included', () => {
  // the mis-sizing guard: estimateTokens(renderIndexLine(line)) over the SAME line object
});
test('carried: null is byte-identical to today', () => {
  // a golden Selection over the repo's own fixture corpus
});
test('select still reads nothing from disk', () => {
  // the INV-select-is-pure guard: assert the module's import list
});
```

- [ ] **Step 2: Run it and see it fail. Step 3: Implement. Step 4: `npm test`, `npx tsc --noEmit` green.**

- [ ] **Step 5: Commit**

```bash
git add src/core/select.ts src/core/render-item.ts test/core/carried-index.test.ts
git commit -m "feat(select): carried index lines take priority and carry a marker, inside budgets.index"
```

---

## Task 18: Resolving what to carry, and from where

**Files:**
- Create: `src/core/continuity.ts`, `test/core/continuity.test.ts`
- Modify: `src/core/inject.ts`, `src/cli/commands/session.ts`

**Interfaces:**
- Consumes: `readSeen`/`seenIds` (`core/seen-file.ts`), `readSessionNames` (Task 13),
  `SelectContext.carried` (Task 17).
- Produces:
  ```ts
  export interface CarrySelection { sessionId: string; label: string; ids: string[] }
  /** Never throws. null when there is nothing to carry. */
  export function resolveCarry(root: string, currentSessionId: string | null): CarrySelection | null;
  export function setCarrySource(root: string, sessionId: string | null): { written: boolean; error: string | null };
  export function carrySourcePath(root: string): string;   // state/continuity.json
  ```
  Task 19 renders it; the `session carry` subcommand writes it.

**Where the ids come from — the seen file, and the cost of that.** §0's fourth row: the survey
recommends the audit projection, and `core/audit.ts` · `the hook path calls this` · ~410 is why this
plan does not follow it — `readAudit` reads whole files and is documented as off the hook path, and
this read happens inside a `SessionStart` bounded at 500 ms. The seen file holds the three delivery
tiers, is one small file, and `readSeen` already never throws. **The cost, named in the module's
docstring:** an item the source session only ever saw as an *index line* is not carried. What is
carried is what that session actually had in context, which is the stronger evidence anyway.

**Which session, when nobody chose one.** A hook takes no flags, so the choice is persisted in
`state/continuity.json` (design decision 11). Absent, the default is **the most recent parent session
other than the current one** — most recent by mtime over `state/*.seen.jsonl` whose name contains no
`__`, which is the sibling marker
(`core/ledger.ts` · `export function sanitizeSessionId(sessionId: string): string {` · ~353).
Excluding the current id is not optional: on a resume the current session is already the most recent
thing in `state/`, and carrying from yourself is a no-op that reports success.

**Why `state/` mtimes here and the audit projection in `session list`.** Two surfaces, two budgets:
the hook must not open a database, the CLI may. They can disagree — a session the log names whose
seen file was swept at 30 days is not carryable — and Task 14's `carryable` column is where that
disagreement is shown rather than hidden.

**`mycontext session carry`,** three forms, all in Task 14's command file: `carry <id>` (refused if
the id is not carryable), `carry --none`, `carry --show`.

**Wiring into `inject.ts`:** call `resolveCarry` on the `'session-start'` and `'subagent'` events
only — never `'compact'` (a compaction is the same window continuing; carrying into it would
duplicate the restore) and never `'manual'` (which has no session id at all, structurally:
`core/inject.ts` · `const sessionId = manual ? undefined : options.sessionId;` · ~169). Pass the
result through `SelectContext.carried`.

- [ ] **Step 1: Write the failing test** — `test/core/continuity.test.ts`: the default is the most
  recent *other* parent session; the current session is never its own source; sibling files are never
  chosen as a source; an explicit selection wins over the default; `--none` yields `null`; a corrupt
  `continuity.json` degrades to the default and never throws; a source whose seen file is gone yields
  `null` rather than an empty carry that claims success.

- [ ] **Step 2: Run it and see it fail. Step 3: Implement. Step 4: `npm test`, `npm run test:perf` green** —
  the perf run is not a formality: this adds a `readdirSync` plus a small file read to `SessionStart`
  **and** to every subagent dispatch.

- [ ] **Step 5: Commit**

```bash
git add src/core/continuity.ts src/core/inject.ts src/cli/commands/session.ts test/core/continuity.test.ts
git commit -m "feat(continuity): resolve a carry source from state/, defaulting to the most recent other session"
```

---

## Task 19: The same provenance in the CLI and the UI

**Files:**
- Modify: `src/core/render.ts`, `src/cli/commands/session.ts`
- Test: `test/core/carried-index.test.ts` (extend), `test/cli/session.test.ts` (extend)

**Interfaces:**
- Consumes: `IndexSummary.carried` (Task 17).
- Produces: one rendered disclosure, and the note text the audit record carries.

**The line, under the index heading** (`core/render.ts` · `const lines: string[] = ['## my_context index'];` · ~16):

```
_12 index line(s) carried from session `auth-refactor` (3 no longer available: KNOWN-x superseded, …)_
```

**The count is what actually arrived** — after the dedupe and after any spill — not what somebody
hoped to send. That is §6g's own condition and it is the reason `IndexSummary.carried.shown` is
computed inside `buildIndex` rather than taken from the input length.

**The label is the session's name when it has one, and its short prefix when it does not.** Nothing
is invented.

**The audit record.** Add the carried ids to the existing injection record's `injected` array with
`tier: 'carried'`. That works with no type change: `InjectedRef.tier` is `string`,
`core/audit.ts` · `const LEDGER_TIERS = new Set(['pinned', 'jit', 'restored']);` · ~567 filters it
out of `ledgerRows` by construction, and
`core/seen-file.ts` · `const TIERS = new Set<string>(['pinned', 'jit', 'restored']);` · ~37 refuses it
in the seen file. **Do not widen either set.** A carried line is not a delivery of full text, and a
replayed ledger that claimed it was would be claiming a delivery that never happened — the exact
failure the `index` tier's own treatment was written to prevent.

**The UI gets this for free and is not built here.** `/api/select` returns `select()`'s JSON
serialisation and nothing else, so `IndexSummary.carried` and the per-entry `carried` flag arrive at
the browser unchanged. Rendering them is the web-UI plan's task; two string-table keys are needed —
`index.carriedFrom` and `index.carriedDropped` — and they must be added to **both** `en.js` and
`he.js` in the same commit, which that plan's key-parity test enforces. This plan produces the shape
and stops.

- [ ] **Step 1: Write the failing tests** — the line names the session's name when named and its
  short prefix when not; the count matches the number of marked lines actually rendered, not the
  input; the dropped list appears with reasons; `carried: null` renders nothing at all; the audit
  record carries `tier: 'carried'` refs and the replayed ledger contains none of them.

- [ ] **Step 2: Run them and see them fail. Step 3: Implement. Step 4: `npm test` green.**

- [ ] **Step 5: Commit**

```bash
git add src/core/render.ts src/core/inject.ts src/cli/commands/session.ts test/
git commit -m "feat(continuity): one carry disclosure, rendered the same in the CLI and served to the UI"
```

---

## Task 20: Documentation, in both languages

**Files:**
- Modify: `README.md`, `docs/README.he.md`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing code reads.

- [ ] **Step 1: Update the hook table** — six hooks, with `SubagentStart`'s timeout and the sentence
  that mycontext does not bound its runtime. Do not write that it is bounded.

- [ ] **Step 2: Update §8** — a subagent now receives the pinned tier in full plus the index, at
  birth, framed with its provenance. The section's title claim stays true (`SessionStart` still does
  not fire for a subagent) and the remaining gap changes shape: it is now a **latency and kill** gap,
  not a delivery gap. Say which.

- [ ] **Step 3: Document the new commands** — `session list`, `session name <id> <name>`,
  `session carry`. Include the sentence that the CLI cannot know which session it is in and the
  one-line reason, because a user who does not know that reads the explicit id as clumsiness.

- [ ] **Step 4: Document `/clear`** — against Task 1's measured outcome, and only that. If Task 1
  found no firing, the README says the clear handler does not exist and why.

- [ ] **Step 5: Document the carry** — what it carries, what it does not (index-tier-only sightings),
  that it shares `budgets.index`, and that a carried line can displace one of this session's own.

- [ ] **Step 6: `npm test` green** (the docs parity test compares the two documents' structure), then
  `npm run verify:citations` and `npm run check:retired`. Commit.

```bash
git add README.md docs/README.he.md
git commit -m "docs: six hooks, session commands, the clear handler and the cross-session carry"
```

---

## What this plan is not doing, and why

- **`PostCompact`.** Superseded by §6e on this project's own audit log — `PreCompact` captures and
  `SessionStart` performs the restore about two minutes later, across two real compactions. A second
  mechanism for a working one is a second spelling.
- **`FileChanged`.** Not taken into v2.0 scope by §6a, and nothing since has re-opened it.
- **A distinct `SelectEvent` member for subagents.** Design decision 2: it would need three new
  branches to arrive at the answer `'session-start'` already gives.
- **Widening `LedgerTier`, `SelectionEntry['tier']`, `LEDGER_TIERS` or the seen file's `TIERS`.** A
  carried line is not a delivery of full text.
- **A fifth budget or a new config key for the carry.** §6m.11, and §6f's *"retrieval is bounded by
  the index budget"* keeps describing the system.
- **A `SessionEnd` hook to prune.** Unprobed, and Task 12's trigger does the job with a hook that is
  already registered. If a later probe finds `SessionEnd` fires, it is a better home and this is where
  to move it.
- **Reading Claude Code's own session name.** §6d records a negative probe on 2.1.234: no session name
  is visible anywhere a hook can reach — not the transcript JSONL, not a sidecar, not
  `~/.claude/config.json`, and `claude --help` exposes no naming flag. mycontext owns the name, and a
  later positive probe would remove the problem rather than change the design.
- **A fifth `AuditKind` for session-metadata actions.** Task 15 records nothing; the union stays four.
- **Rendering anything in the web UI.** Task 19 produces the shape and names the two string keys; the
  UI plan renders them.
- **Extending the deny hook to anything outside `.my_context/items/`.** Not this plan's surface, and
  the detection-not-refusal bargain §6m.7 struck for the rule-file exporter is the one this product
  makes everywhere.
