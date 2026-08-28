# mycontext — never miss an injection, never lose a snapshot

**Date:** 2026-08-16
**Status:** **shipped in 1.0.0.** This read "design with a recommendation; pending owner review.
Nothing here is implemented" until 2026-08-18, which was two releases out of date: the per-session
seen file, the subagent dedupe key and the PreCompact snapshot are all in `master`. Kept as the
design record of work that has landed — read it for *why*, not for *what is pending*. Its `file:line`
citations predate three refactors and are being converted per `2026-08-18-v2-decisions.md` §2.
**Base:** `origin/phase-5/quality` (85318bd). E4's hook contention profile (`0c141d6`) and E2's
subagent dedupe key (`64bc73a`) live on side branches and are cited by branch where they differ.
**Inputs:** this document's own benchmarks, plus two research reports of the same date —
`research-sqlite-concurrency.md` (sqlite.org documentation survey) and
`research-sqlite-measured.md` (21,900-trial measurement campaign on this machine, probe scripts
preserved) — both folded in below with trial counts on every claim.
**Review:** an adversarial review (`review-never-miss.md`, same date, its own probes preserved)
re-executed the load-bearing claims independently and audited every `file:line` citation.
Verdict: sound with corrections. Its corrections are folded in below — §4.4 was rewritten on
its Critical finding — and the claims that *survived* attack are marked as verified where they
appear, with the review's trial counts. Each number below names who measured it: **[M/P]** this
design's own benchmarks / the measurement campaign, **[R]** the review's independent probes.
**Problem owner's framing:** *"Find a way that will make the index 100% not blocked, or a sync
mechanism, or a priority queue so hook requests are always prioritised, or some other way — but we
must find a solution to not miss injections or snapshots, as they are the core of mycontext."*

---

## 0. What was wrong, stated against the code of 2026-08-16

mycontext's hooks are short-lived processes sharing one SQLite file (`.index.db`) with the CLI and
the MCP server. The failure the owner names is real and has three distinct shapes, and the code as
it stood — including the just-landed E4 fix — closed none of them; E4 only made one of them
*visible*. Each finding below now carries what closed it.

**And the problem was misdiagnosed, by this design's own brief included.** The framing was
"index contention": readers and writers fighting, needing WAL, a snapshot, a daemon, or a
priority queue. The measurement campaign (§2) refutes that framing: across **21,900 read-only
trials under hammering writers, held transactions, TRUNCATE checkpoints and crash recovery, not
one read ever blocked or returned SQLITE_BUSY** — worst case 17.2 ms. The stall is not read
contention. It was that **every hook took SQLite's one write lock** (§0.1), and the whole of the
16.9 s failure reproduces from that single fact (§2.1, P4). The fix is correspondingly smaller
than any of the options the brief listed: the hook must not take a write lock.

**0.1 Every hook was a writer, even when it only wanted to read.** `Store.open` runs `tryOpen`,
which sets `PRAGMA journal_mode = WAL`
(`src/core/store.ts` · `db.exec('PRAGMA journal_mode = WAL;');` · ~155) and then takes the write
lock with `BEGIN IMMEDIATE` for its schema check
(`src/core/store.ts` · `db.exec('BEGIN IMMEDIATE');` · ~192) — on every open, and that included
the PreToolUse JIT path, whose docblock still calls itself "Single indexed SQLite read"
(`src/hooks/pre-tool-use.ts` · `Single indexed SQLite read, no rebuild, no LLM, no network` · ~122).
So a hook that would never modify an item still contended for the one write lock in the file.
**That is closed:** the JIT hook opens `Store.openReadOnlyChecked`
(`src/hooks/pre-tool-use.ts` · `store = Store.openReadOnlyChecked(ws.dbPath);` · ~202) and takes
no write lock at all. Measured on this machine against the real `store.ts` (§2.1, P4):
`Store.open` under a 30 s held write transaction stalls **16,881 ms then throws `database is
locked`** — E4's 16.9 s figure reproduced to three digits, and it is entirely
`openWithBusyRetry`'s 5 × 3,000 ms waits on that `BEGIN IMMEDIATE`. **`Store.openReadOnly` under
the identical 30 s hold returns in 0.2 ms.** The entire stall is the write lock the hook never
needed.

**0.2 The miss.** Before E4, `Store.open`'s retry policy (5 attempts × 3000 ms `busy_timeout` —
still the non-hook default:
`src/core/store.ts` · `export const DEFAULT_OPEN_PROFILE: OpenProfile = { busyTimeoutMs: 3000, attempts: 5 };` · ~120)
had a contended worst case of ~15–23 s — measured 16.9 s per the E4 commit — against
`hooks.json`'s 10 s kill (`hooks/hooks.json` · `"timeout": 10` · ~11, and the same figure on the
PreToolUse and PreCompact entries). The killed hook produced no output: a session silently
missing its project knowledge. E4 (branch `e4-e6-small-fixes`, `0c141d6`, since merged) gave
hooks a `2 × 500 ms` profile (worst case ~1.06 s —
`src/core/store.ts` · `export const HOOK_OPEN_PROFILE: OpenProfile = { busyTimeoutMs: 500, attempts: 2 };` · ~123),
a one-line disclosure and an audit record when it gives up. **That converts a silent miss into a
disclosed miss. The injection is still missed.** This document's job is the miss itself.

**0.3 The snapshot.** PreCompact opened both `Store` and `Ledger` with the *default* patient
profile — no profile argument even on the E4 branch, which was deliberate there: patience over
failure for a write that matters. Under contention that open could exceed the 10 s kill, and then
`buildRestoreSnapshot` never reached `writeSnapshot` — the one write whose loss E4's own framing
calls unacceptable. **That is closed:** the `Ledger` open is gone and the one database touch left
is a best-effort read-only one
(`src/hooks/pre-compact.ts` · `store = Store.openReadOnly(ws.dbPath);` · ~123). Note what the
snapshot write itself is: an atomic temp-file-then-rename to `state/<session>.restore.json`
(`src/core/ledger.ts` · `export function writeSnapshot(root: string, sessionId: string, itemIds: string[]): string {` · ~748).
**SQLite is not needed to write the snapshot; it is only consulted to decide its contents**
(`store.ids()` to filter known ids — `src/hooks/pre-compact.ts` · `const ids = store.ids();` · ~124;
the injected set was `ledger.seen()` and is now the per-session seen file,
`src/hooks/pre-compact.ts` · `const seenState = readSeen(ws.projectRoot, sessionId);` · ~106).
The durability problem was entirely self-inflicted.

**0.4 SessionStart was the biggest writer of all.** `buildInjection` ran a full `rebuild` —
delete-and-reinsert of the whole corpus inside one write transaction
(`src/core/inject.ts` · `const refreshErrors = rebuild(store, roots, ws.config, byLayer).errors;` · ~593,
`src/core/rebuild.ts` · `store.transaction(() => {` · ~452) — on every session start and *before*
the injection was built, then read back what it had just written with `store.all()` to feed
`select`; the selection now reads the parsed corpus directly
(`src/core/inject.ts` · `const items: Item[] = [...(byLayer.global ?? []), ...(byLayer.project ?? [])];` · ~249).
So the highest-traffic injection path was also the process most likely to be *holding* the write
lock that kills a concurrent hook. And `rebuild` discarded the very items it loaded: `loadLayer`
parses every Markdown file into `Item[]` (`src/core/rebuild.ts` · `export function loadLayer(` · ~103),
`rebuild` returns only `{ loaded, errors }`
(`src/core/rebuild.ts` · `): { loaded: number; errors: LoadError[] } {` · ~440), and the selection
then re-read those same items from the database it had just filled. The injection's *input* never
needed the database at all. **That is closed:** the rebuild moved behind the render and takes the
already-parsed corpus as `preloaded`
(`src/core/rebuild.ts` · `const items = preloaded?.[layer] ?? loadLayer(root, layer, errors, config);` · ~464).

**0.5 One asserted property the code did not have**, found while verifying this document. The
`ledgerRows` docblock named a caller that was never built —
`src/core/audit.ts` · ``opens no database: the caller (`mycontext audit`` · ~532 <!-- historical-citation: §0 surveys the pre-1.0.0 comment; §4.2's fix rewrote it to name `topUpLedger` -->
— and no such command existed anywhere in `src/` (verified by grep over `src/cli` and
`src/mcp`); `ledgerRows`
(`src/core/audit.ts` · `export function ledgerRows(records: AuditRecord[]): ReplayRow[] {` · ~906)
had no production caller. That comment had to be corrected or the surface built, and **§4.2 built
it**: the command exists
(`src/cli/commands/audit.ts` · `if (args[0] === 'replay-ledger') {` · ~302), the write is owned by
`topUpLedger`
(`src/core/ledger-replay.ts` · `export function topUpLedger(root: string, ledger: Ledger): { applied: number; diverged: boolean } {` · ~15),
and the docblock now says so
(`src/core/audit.ts` · `audit log and this one opens no database: the write is owned by` · ~897).

---

## 1. The two requirements, separated

They are different and the design must not let one answer paper over the other:

| Event | Requirement | Acceptable degradation |
| --- | --- | --- |
| **Injection** (SessionStart, PreToolUse JIT) | Output is always produced | Slightly stale content; a rare slow hook; a duplicate injection. **Not** a missing one. |
| **PreCompact snapshot** | The write lands, durably | Over-capture (extra ids). **Not** staleness, **not** loss. |

Standing constraints: zero runtime dependencies (`node:sqlite` only, Node 24, no build step);
50 ms p95 on the JIT hot path; 10 s harness kill; one developer, one machine;
`INV-markdown-is-the-source-of-truth` (`files → DB → files` byte-identical, the index disposable);
`INV-nothing-is-dropped-silently` (a degraded path must say so); `INV-hooks-fail-open`.

---

## 2. Facts this design rests on

### 2.1 Measured on this machine (2026-08-16, Node 24.18.0 / SQLite 3.53.1, Windows 11, NTFS)

Two independent campaigns: this document's own benchmark (M-rows: corpus of `constraint` items
written with `writeItem`, indexed via `mycontext rebuild`, contention held by a child process in
`BEGIN IMMEDIATE`; 15–50 iterations after warmup) and the dedicated probe campaign (P-rows:
`research-sqlite-measured.md`, probe scripts preserved under `sqlite-probes/`, 21,900 read
trials total). Where both measured the same thing they agree; every figure carries its trial
count.

| # | What | Result |
| --- | --- | --- |
| M1 | `loadLayer` + `select` (event `tool`) straight from Markdown, **no database** (15 iter/size) | 500 items: **28.1 ms** p95 · 2,000: **245.5 ms** · 5,000: **597.7 ms** (of which `select` itself is 1.4 / 4.1 / 8.8 ms — parsing dominates) |
| P4 | **The real `Store.open` (imported from `src/core/store.ts`) vs a 30 s held write transaction** | **16,881 ms then `database is locked`** — E4's 16.9 s reproduced to three digits, and the review reproduced it again independently at **16,914 ms, same error** [R]; `Store.openReadOnly` under the identical hold: **0.2 ms** open-only [P], **0.67 ms worst-of-30 including a query** [R] — same conclusion, sub-millisecond either way. Uncontended: `Store.open` 1.1 ms established / 16.2 ms first-ever |
| P6 | Fresh `{ readOnly: true }` open + select vs a **hammering commit loop** (5,000 trials, `busy_timeout=0`) | p50 **1.02** / p95 **1.72** / p99 3.41 / p99.9 12.9 / max **17.2 ms** — **0 failures**; `busy_timeout=2000` indistinguishable (the busy handler never fires on this path); baseline without writer p50 0.53 |
| P6b | 4 concurrent reader processes × 2,000 trials each under **TRUNCATE-checkpoint** load | p95 ≈ 1.49 ms, max 12.3 ms, **0 failures in 8,000 trials**; zero torn reads (pair invariant) across all 18,300 read-only trials |
| P6c | Whole hook-shaped cost **including node process spawn**, contended (300 trials) | p50 38 / p95 110 / max 117 ms — the spawn dwarfs the database |
| M2/M3 | This document's own read-only open + 5,000-row SELECT, held write lock vs none (50 iter) | 28.1 ms p95 contended vs 24.6 uncontended — corroborates P6: contention costs milliseconds; the extra ~25 ms over P6 is the 5,000-row deserialization, not locking |
| P2c | Read-only open after a writer **killed mid-transaction** (8.3 MB `-wal` left behind) | succeeds in **12.3 ms** even with `busy_timeout=0` — the read-only connection itself performs full WAL recovery via the leftover `-shm`; sees all committed rows, none of the uncommitted |
| P2e | The **one measured read failure mode**: `-shm` absent AND directory unwritable | hard fail `unable to open database file` in **0.57 ms** — a fast, detectable failure, never a hang. Cannot arise while `.index.db` sits in a user-writable project directory |
| P2d | Read-only open of a clean-closed WAL db | succeeds — **and creates `-wal` and `-shm` itself** when the directory allows: "read-only" refers to the connection, not the filesystem |
| P3 | `file:…?immutable=1` opened fresh **against a live writer** (200 trials) | **113/200 errored `database disk image is malformed`; 2/200 returned silently inconsistent data AS SUCCESS** (`count(*)` ≠ `max(id)` on a pair-invariant table). The file itself was intact throughout (`integrity_check` ok after the run) |
| P5 | Windows lock hygiene | write lock reacquirable **4.2 ms** after `taskkill /F` of the holder; `rmSync` of `.db`/`-wal`/`-shm` fails `EPERM` while any handle lives — validating `retryOnTransientFsError` (`src/core/rebuild.ts` · `export function retryOnTransientFsError<T>(fn: () => T, attempts = 5): T {` · ~205) and `Store.open`'s EPERM note (`src/core/store.ts` · ``fails with `EPERM`, so the OS,`` · ~81) |
| M7 | `journal_mode` after a normal `Store.open` + close | persists as `wal` — **WAL is already on** for every `.index.db` this code has ever opened (`src/core/store.ts` · `db.exec('PRAGMA journal_mode = WAL;');` · ~155). WAL is the status quo, not a remedy, and P4 shows it cannot fix a write-lock stall |
| R1 | **Fallback ≡ primary selection**, executed on the 44-item dogfood corpus [R] | `select(loadLayer(…))` vs `select(store.all())` (session-start) and vs the JS-filtered `activeInjectable` shape (tool event): **IDENTICAL in 5/5 comparisons**, including under a deliberately shrunken pinned budget. The structural reasons: `select` is pure and order-insensitive (`fitToBudget` sorts internally, `select.ts` · `bands.flatMap((band) => [...band].sort(byPriority))` · ~362), and `items.id` PRIMARY KEY reproduces `mergeLayers`' project-over-global resolution |
| R2 | Concurrent seen-file appends, 2 processes × 3,000 interleaved [R] | **6,000/6,000 lines intact**; the heal-then-append race against a file that *starts torn*: 0 damaged lines, 0 lost records in 3,000 races. The analytical worst case (a heal truncating a rival's just-appended whole line) is a lost seen-record → one re-injection, the accepted direction |
| R3 | NTFS `renameSync` over an existing target vs a concurrent reader of that target [R] | **654 of 2,000 renames failed `EPERM`** — rename-over-open-target is *unavailable*, not atomic-but-slow. The successful renames were clean: **0 torn or empty reads in 22,791 contended read trials**. See §4.4, which this finding rewrote |
| R4 | Read-only open that must recover a **936 MB** crashed WAL [R] | recovery + query completed in **1,062 ms** — the one pre-fallback cost that scales with leftover WAL size (it required a deliberately checkpoint-suppressed writer to construct); within the 10 s budget by 9× even at that absurd size |
| R5 | Markdown fallback at scale, cold vs warm cache [R] | 10,000 items **cold-cache: 9,903 ms — at the kill threshold**; 20,000 items: 11,128 ms cold, 1,445–3,679 ms warm (`select` itself 27–50 ms). This supersedes this document's earlier ~40k estimate; the real cold-cache ceiling is ~10k (§6, risk 3) |

A correction this document owes its own first draft: an earlier single-trial probe here measured
`immutable=1` at "0.7 ms, ok" under a held lock. One lucky trial. P3's 200-trial run is the real
distribution — 56% errors and, worse, ~1% *silently wrong answers presented as success* — and it
supersedes that figure entirely (§3, Option F).

Prior measurements this document reuses rather than re-running: JIT whole-hook hit path
~10.5–22.7 ms p95 on a 5,000-item corpus
(`test/perf/focus-latency.perf.ts` · `hook with that focus applied measured p95 10.5 ms on the same run, inside the` · ~20);
SessionStart ~55 ms p95 on 500 items, ~124 ms with compact restore — the pre-reorder baseline the
perf file still carries
(`test/perf/session-start-latency.perf.ts` · `plain max-of-20 ~54.9–55.5ms; compact ~123.9ms.` · ~83),
re-derived after the change at ~45.6–46.3 ms and ~149.1–163.6 ms;
audit append 0.55 ms p95, flat from empty to 32 MiB
(`src/core/audit-db.ts` · `measures 0.55 ms p95 and` · ~21, `test/perf/audit-latency.perf.ts`).

### 2.2 Documented SQLite guarantees (research: `research-sqlite-concurrency.md`, 2026-08-16)

The companion documentation research verified these against sqlite.org; the load-bearing ones,
annotated with what the measurements then showed:

- **WAL removes reader/writer blocking in steady state but documents three residual
  `SQLITE_BUSY` cases for readers**: crash recovery, last-connection close cleanup, and a peer
  in `locking_mode=EXCLUSIVE` (https://sqlite.org/wal.html). Measured on this machine, the
  first two never produced a blocked or failed read in 21,900 trials — recovery was performed
  *by the read-only connection itself* in 12.3 ms (P2c), and the close-cleanup window never
  surfaced under 4-process churn (P6b). They remain documented possibilities the design must
  tolerate (C covers them), not behaviours observed here. The third is avoided by convention:
  nothing in this codebase sets `locking_mode=EXCLUSIVE` (verified by grep), and nothing may
  start to. The file-control that would close the cleanup window, `SQLITE_FCNTL_PERSIST_WAL`,
  is **not exposed by `node:sqlite`** (no `fileControl` surface in Node v24.x
  `src/node_sqlite.cc`).
- **No priority, no fairness, no queue.** SQLite's entire contention policy is the busy handler
  — poll-and-retry — and its documentation states the handler is not even guaranteed to be
  invoked under contention (https://sqlite.org/c3ref/busy_handler.html). There is no API by
  which one connection's lock acquisition can be preferred. The compile-time blocking-lock
  option (`SQLITE_ENABLE_SETLK_TIMEOUT`) is absent from Node's bundled build and POSIX-only.
- **`immutable=1` skips all locking *and all change detection*** (https://sqlite.org/uri.html);
  the documentation warns of wrong results or `SQLITE_CORRUPT` if the file changes, and P3
  turned that warning into numbers against a live writer. It is sound only for a file that is
  genuinely never written while open — P3b confirmed a long-lived immutable connection on a
  quiescent, checkpointed file stays consistent (and permanently frozen at its open snapshot).
- **`BEGIN CONCURRENT` and WAL2 are branch-only**, in no release including 3.53.1. Measured on
  this build: `BEGIN CONCURRENT` is a syntax error, and — a trap worth naming — **`PRAGMA
  journal_mode=WAL2` silently returns `wal`**, no error, no WAL2 (P1). Code that "enabled WAL2"
  would appear to work while doing nothing.
- **The one pattern with an unconditional never-miss capture guarantee** in systems with this
  requirement is: the hot path appends to a flat file and never touches the shared database;
  a separate step projects the log into SQLite later. mycontext had already shipped exactly this
  pattern once, for the audit log
  (`src/core/audit-db.ts` · `**The JSONL is the truth; this database is derived and disposable.**` · ~11);
  §4.2 shipped it a second time, as the per-session seen file
  (`src/core/seen-file.ts` · `export function appendSeen(` · ~96).

### 2.3 What the code already gives us, unclaimed

Three assets are lying in place, and the recommendation is mostly connecting them:

1. **The audit log was already the first write on every injection path.** `recordAudit` (JSONL
   append, never throws,
   `src/core/audit.ts` · `export function recordAudit(root: string, input: AuditInput): AuditWriteResult {` · ~720)
   ran *before* the ledger write on both SessionStart and JIT, and it still goes first — what it
   now precedes is the per-session seen-file append, the ledger write having left the hook path
   altogether
   (`src/core/inject.ts` · `// 5. THE SEEN-FILE APPEND (was: the ledger write)` · ~799;
   `src/hooks/pre-tool-use.ts` · `// The dedupe record: an append to the per-session seen file` · ~325).
   The ledger was already documented as "a derived cache, rebuildable from here" with `ledgerRows`
   as the replayer
   (`src/core/audit.ts` · `ledger STAYS, as a derived cache, and is rebuildable from here.` · ~849).
   The hooks' SQLite *writes* were already redundant records of facts the JSONL holds — with one
   field doing load-bearing work: the restored tier's identity marker survives only because
   `InjectedRef.at` carries the snapshot's `capturedAt` into the audit record
   (`src/core/inject.ts` · `? { at: snapshotCapturedAt }` · ~663); the redundancy claim rests on
   that field, and §4.2 preserved it.
2. **`select` is pure over `Item[]`**
   (`src/core/select.ts` · `export function select(items: Item[], ctx: SelectContext, config: Config): Selection {` · ~833,
   `INV-select-is-pure`), and `loadLayer` produces `Item[]` from Markdown alone
   (`src/core/rebuild.ts` · `export function loadLayer(` · ~103). The complete
   injection decision can be computed with zero database access — M1 says what that costs.
3. **The snapshot write is already durable by construction** (atomic rename,
   `src/core/ledger.ts` · `retryOnTransientFsError(() => renameSync(tmp, target), SNAPSHOT_RENAME_ATTEMPTS);` · ~763)
   — §4.4 is where the review cut that word down to what it can carry —
   and a snapshot containing ids the corpus no longer has is
   harmless: the restore path re-selects through `select`, and an id matching no live item
   simply selects nothing
   (`src/core/select.ts` · `fresh.filter((i) => restoreIds.has(i.id) && !alreadyChosen.has(i.id))` · ~872).
   Over-capture is the safe direction, which `readSnapshotMeta` already exploits for a missing
   `capturedAt`
   (`src/core/ledger.ts` · `// A missing/non-string capturedAt degrades to "now": nothing recorded` · ~856).

---

## 3. The options, each taken seriously

### Option A — "WAL mode, with the read path opened read-only"

The option as posed is half status quo and half the whole answer, and the two halves must be
separated. **WAL is not a remedy on offer: it is already on** — `tryOpen` sets it on every open
and it persists in the file (`src/core/store.ts` · `db.exec('PRAGMA journal_mode = WAL;');` · ~155, M7) — and P4 proves it cannot fix the
stall, because the stall is write-lock contention on the schema transaction, not journal mode.
The half that matters is the second: **the hook must not take a write lock.** Every writable open
still does, via `BEGIN IMMEDIATE` (`src/core/store.ts` · `db.exec('BEGIN IMMEDIATE');` · ~192);
that one fact reproduces the whole
16,881 ms failure (P4). `Store.openReadOnly` already exists, deliberately runs no DDL
(`src/core/store.ts` · `static openReadOnly(dbPath: string): Store {` · ~382), and under the
identical 30 s hold returns in 0.2 ms.

- **What it buys, measured rather than argued:** 18,300 contended read-only open+select trials
  — hammering writers, held transactions, TRUNCATE checkpoints, 4 concurrent reader processes —
  **0 failures, 0 torn reads, worst case 17.2 ms** (P6, P6b) against the 10,000 ms kill: a
  ~580× margin. A read-only connection even performs full WAL crash recovery itself (12.3 ms,
  P2c). No `busy_timeout` is needed on this path — 0 and 2,000 were indistinguishable because
  the busy handler never fires (P6).
- **What it still is not, and must not be claimed to be:** an unconditional guarantee. The
  residual documented `SQLITE_BUSY` windows (§2.2) were never *observed* in 21,900 trials but
  are not disproved by them, and one read failure mode was measured directly: `-shm` absent
  with the directory unwritable hard-fails in 0.57 ms (P2e). Every one of these fails *fast* —
  which is precisely what makes a fallback viable inside the budget. Separately, a read-only
  open cannot create a missing database, migrate a stale schema, or trigger `Store.open`'s
  corruption self-heal (`src/core/store.ts` · `if (!isCorruptionError(error)) throw error;` · ~342) — the fresh-workspace, post-upgrade and
  corrupt-index cases need another answer. Two surprises to design around: a "read-only"
  connection still **creates `-wal`/`-shm` sidecar files** when the directory allows (P2d), and
  performs recovery — read-only describes the connection, not the filesystem footprint.
- **What blocked it then:** the hook paths *could not* open read-only while they still wrote the
  ledger and, on SessionStart, the index itself. Option B was the enabler, not a separate remedy,
  and it landed: the ledger write is gone from both hooks
  (`src/hooks/pre-tool-use.ts` · `appendSeen(ws.projectRoot, dedupeKey, selection.full.map((e) => ({` · ~330,
  `src/core/inject.ts` · `appendSeen(stateRoot, seenKey, selection.full.map((e) => ({` · ~813),
  and the index write moved behind the render as a best-effort refresh
  (`src/core/inject.ts` · `store = Store.open(ws.dbPath, manual ? undefined : HOOK_OPEN_PROFILE);` · ~585).
- **Verdict: adopt — this is the core of the answer — with B required to make it possible and
  C required behind it** for the fast-failing cases it cannot serve.

### Option B — move the hook's writes off the database entirely

The hooks write two things: ledger rows (dedupe bookkeeping) and, on SessionStart, the rebuilt
index. B removes both from the hook path. **Its role is enabler, not headline**: the 0.2 ms
read-only path (P4) exists only for a hook with no reason to open writable, and the ledger
write is that reason.

- **Ledger rows.** The durable record already exists before the ledger write happens (§2.3.1).
  What the ledger uniquely served on the *hot path* was `seen(sessionId)`
  (`src/core/ledger.ts` · `seen(sessionId: string): string[] {` · ~391) — the once-per-session
  dedupe read, now served from the file
  (`src/hooks/pre-tool-use.ts` · `const seenState = readSeen(ws.projectRoot, dedupeKey);` · ~210).
  Replace the hot write with an append to a **per-session seen file** —
  `state/<key>.seen.jsonl`, one
  `{id, tier, at}\n` line per delivery, `<key>` being `sanitizeSessionId` (`src/core/ledger.ts` · `export function sanitizeSessionId(sessionId: string): string {` · ~699)
  applied to E2's dedupe key — `session_id::agent_id`, then on branch `e2-subagent-injection` and
  since merged (`src/hooks/io.ts` · `export function ledgerKey(input: HookInput): string | null {` · ~208).
  Appending is the audit log's own machinery
  (`appendJsonlLine`/`healTornTail`, `src/core/jsonl-log.ts` · `export function appendJsonlLine(` · ~192) at its measured 0.55 ms,
  wrapped in the same transient-EPERM retry (`src/core/seen-file.ts` · `export function appendSeen(` · ~96);
  reading it back is O(one session's deliveries) — tens of lines, not the corpus.
- **The ledger table stays, as the projection it is already documented to be**, maintained off
  the hot path: non-hook writers top it up from the audit log via
  `ledgerRows`, using the same position-tracking pattern `audit-db.ts` already ships
  (`src/core/audit-db.ts` · `CREATE TABLE IF NOT EXISTS audit_source (` · ~97). This also builds
  the `replay-ledger` surface §0.5 found missing — it exists now
  (`src/cli/commands/audit.ts` · `if (args[0] === 'replay-ledger') {` · ~302), reached by
  `status`, `decay` and `audit replay-ledger` rather than by `rebuild` or the mutation paths.
  `decay` and `usage` keep their indexed
  aggregates (`src/core/ledger.ts` · `usage(itemId: string): Usage {` · ~412) — they never ran on the hot path.
- **The honest cost, stated rather than implied:** a dedupe read served by a projection that is
  behind its log **will re-inject** — and with the per-session file that window narrows to "the
  file could not be appended or read", since session-scoped dedupe no longer consults the
  projection at all. A duplicate injection costs tokens and a moment of reader confusion; a
  missed injection costs a session operating without its governing rules. **The re-injection is
  accepted, explicitly**, and the audit record of both deliveries makes it diagnosable. What the
  projection's staleness *does* still affect is `decay`/`usage` reporting accuracy, off the hot
  path, healed by the next top-up.
- **SessionStart's rebuild** becomes best-effort (see the design, §4.3): the injection is
  computed from the `Item[]` that `loadLayer` already produced, and the index write is attempted
  with E4's `HOOK_OPEN_PROFILE` and dropped — disclosed in the audit record — if the lock is
  held. A stale index costs nothing to injections (they no longer read it at SessionStart) and
  costs JIT at most a stale-but-consistent read until the next writer lands.
- **Verdict: adopt.** After B, no hook holds or waits for the SQLite write lock, ever. This is
  the research's pattern 1, and the only shape with an unconditional capture guarantee.

### Option C — fall back to the Markdown source when the index cannot be read

`INV-markdown-is-the-source-of-truth` makes the index derived and disposable; a hook that cannot
open it is holding the truth in the same directory. C's place in the design was resized by the
measurements: it is not a main path and not a frequent one — **every measured way the read-only
open can fail, fails fast** (0.57 ms for the shm-uncreatable case, P2e; an exception, not a
hang, for absent file / stale schema / corruption), which leaves essentially the whole 10 s
budget for the fallback to run in. C is the answer to a rare, fast, *detectable* failure. M1
prices it warm: 28 ms at 500 items, 246 ms at 2,000, 598 ms at 5,000 — parsing dominates,
`select` itself is single-digit ms. The review priced it cold and large (R5): **9,903 ms at
10,000 items cold-cache** — the ceiling is ~10k items, not the ~40k this document first
estimated, and §6 risk 3 states what happens past it. C's equivalence to the primary path is
not asserted from purity alone: the review executed both against the dogfood corpus and got
**identical selections in 5/5 comparisons**, including under a tightened budget (R1).

- Against the 50 ms p95 JIT ceiling, files-only is affordable to ~700 items and over budget at
  5,000. **As the steady state it is therefore wrong for JIT; as the contention fallback it is
  exactly right** — p95 is a distribution bound, the fallback fires only in the residual windows
  A leaves open, and a rare 600 ms tool call is inside the 10 s kill by 16×. Real corpora are
  also far smaller than the perf suite's stress size: this repository, the product's own
  dogfooding corpus, has 54 item files.
- For SessionStart (500 ms budget, once per session) files-only is affordable at any measured
  size except 5,000 (598 ms) — and SessionStart *already* paid the full `loadLayer` parse inside
  `rebuild` then (§0.4), so C is not new cost there; it is the same cost minus the database.
- The disclosure duty (`INV-nothing-is-dropped-silently`): a fallback-served injection carries
  one appended line naming the degradation ("served from Markdown; the index was unavailable")
  and an audit record with a `note` saying the same — the E4 disclosure pattern
  (`src/core/inject.ts` catch on branch `e4-e6-small-fixes`), inverted: disclose *how* it was
  served, not that it wasn't.
- **First run:** a fresh workspace has no `.index.db` at all; `openReadOnly` cannot create one.
  C serves it from files with no special case — the new user's first injection works before any
  writer has ever run. This is the case that kills Option F (below), and C answers it for free.
- **Verdict: adopt, as the guarantee layer.** Its guarantee is conditional only on the Markdown
  being readable — and a workspace whose Markdown is unreadable has no knowledge to inject by
  the product's own definition of truth.

### Option D — a single-writer daemon

All writes funneled through one long-lived process; hooks become IPC clients. This is what
Firefox and Chrome do in-process, and it would genuinely serialise everything.

- **What it would really mean here:** mycontext today has no long-running process — hooks, CLI
  and MCP server are all invoke-and-exit (the MCP server lives only as long as Claude Code holds
  it). A daemon adds: an installation/startup story per OS (no systemd on the target machine;
  Windows services or login tasks); a liveness protocol (who starts it, who restarts it, what a
  hook does when it is down — which must be answered with… all of the above options anyway, as
  the fallback); a version-skew story (plugin upgraded while the daemon runs old code); a
  shutdown story on uninstall; and a second IPC surface to secure and test. Every failure mode
  of the daemon becomes a new way to miss an injection, and the fallback for each is the design
  we would have built without it.
- **Verdict: reject.** For one developer on one machine with contention windows measured in
  milliseconds, this buys serialisation the A+B+C combination already achieves structurally,
  at the price of the largest architectural change the project could make.

### Option E — a priority mechanism for hook access

The owner named this directly, so it gets a direct answer: **SQLite offers nothing to build on.**
Lock acquisition has no queue, no fairness, and no priority API; the busy handler is
poll-and-retry and its invocation is explicitly not guaranteed (§2.2, second bullet). Any
priority scheme must therefore be built beside SQLite — an advisory lock file that non-hook
writers check-and-yield on, or a lease protocol. That machinery: a second locking protocol with
its own stale-lock, crash-cleanup and clock problems; cooperation required from every current
and future writer (one non-cooperating path and the guarantee is void); and at the end the hook
still *waits* — priority reorders the queue, it does not remove it. After B, hooks are not in
the write queue at all, which is strictly stronger than being first in it.
**Verdict: reject.** The problem priority would solve is dissolved, not solved, by B.

### Option F — snapshot-on-write, hooks read an `immutable=1` copy

**Dead — and it is the option a future reader will most plausibly rediscover and think is
clever, so the numbers that kill it are recorded here in full.** On paper it is the most
attractive line in this document: `immutable=1` skips all locking, so the read *cannot block*,
and an early single-trial probe here measured it at 0.7 ms under a held write lock. The
200-trial measurement (P3) is what one trial could not show. Fresh `?immutable=1` opens against
a live writer:

- **113/200 trials errored `database disk image is malformed`** — a false corruption report
  about a file that was intact the whole time (`integrity_check` ok after the run);
- **2/200 returned silently inconsistent data as success**: `count(*)` = 23,300 against
  `max(id)` = 22,292 on a table whose invariant makes those equal — internally impossible
  answers, no error raised.

The second line is the disqualifying one. This product's entire trust posture is built on never
asserting what is not so (`INV-nothing-is-dropped-silently`, the checksum machinery, the audit
log's refuse-don't-skip reader `src/core/jsonl-log.ts` · `unreadable      → THROW ("cannot read" is never "there is nothing")` · ~21); an injection built on a silently
inconsistent read would deliver *wrong governing rules as if they were right* — strictly worse
than the missing injection this design exists to prevent. The mechanism is documented, not
mysterious: `immutable=1` skips locking *and change detection* (https://sqlite.org/uri.html),
so with WAL sidecars present at open it reads a moving file with no synchronization.

Could the full snapshot-publish design (writers `VACUUM INTO` a fresh file + atomic pointer
swap; hooks open only genuinely quiescent snapshots — the shape P3b measured as safe) evade
P3's failure? Yes, if implemented perfectly — the failure was measured against the *live* file,
and a published snapshot nobody writes is the one topology the flag is documented for. But the
design would stand a publisher protocol, a pointer file, snapshot GC against Windows
delete-while-open EPERM (P5), a staleness window unbounded by time (writer cadence is
user-action-driven), and a first-run gap (no snapshot before the first writer — falling back to
exactly Option C) between the product and a failure mode measured at *silently wrong data
presented as success* — reachable again through any bug that lets the flag near a written file.
A+B+C reaches a stronger guarantee with none of that machinery, because the Markdown corpus
already *is* an atomically-published snapshot (`writeItem`'s exclusive-create — `src/core/rebuild.ts` · `fd = openSync(target, 'wx');` · ~345 — and rename path,
`src/core/rebuild.ts` · `retryOnTransientFsError(() => renameSync(tmp, resolved));` · ~418) — in a format whose reader does not lie when it races.

**Verdict: rejected. Do not build it, and do not let `immutable=1` near `.index.db` in any
future change** — P3 is the citation to bring to that review.

---

## 4. The design: B + A + C, layered

One sentence: **hooks never write SQLite and never require it — reads go read-only to the index
when it is available and to the Markdown when it is not, session dedupe state lives in a
per-session append-only file, and everything SQLite held that mattered is already in, or moves
to, append-only JSONL that a projection catches up with later.**

### 4.1 The read path (both injection hooks)

```
resolveWorkspace
  → try Store.openReadOnly(dbPath), no busy_timeout               [A: 0 failures in 18,300
      (P6: the busy handler never fires on this path)                contended trials, P6/P6b]
      · file absent, schema absent/stale, corrupt, shm-uncreatable ─┐   (every case fails fast:
  → loadLayer(project) + loadLayer(global) → Item[]                 ├─ [C: guarantee, M1]
      + one-line disclosure in the output, note in audit record    ─┘    0.57 ms measured, P2e)
  → select(items, ctx, config)                                     [pure, select.ts:439]
```

- The read-only connection sets no pragmas and runs no DDL (that is `openReadOnly` today,
  `src/core/store.ts` · `static openReadOnly(dbPath: string): Store {` · ~382). Schema staleness is
  detected by reading `schema_version` and falling back — never migrating — because migration is a
  write and writes belong to writers; that check shipped as `openReadOnlyChecked`
  (`src/core/store.ts` · `static openReadOnlyChecked(dbPath: string): Store {` · ~402).
- One pre-fallback cost is unbounded in principle and must be named: a read-only open that has
  to perform WAL crash recovery takes time proportional to the leftover WAL — a *slow success*,
  not a failure, so C never fires for it. Measured bound: 936 MB of WAL recovered in 1,062 ms
  (R4), and a WAL that size takes a deliberately checkpoint-suppressed writer to construct;
  normal leftovers recover in ~12 ms (P2c).
- JIT keeps its indexed `activeInjectable` query on the fast path (`src/core/store.ts` · `activeInjectable(types: string[]): Item[] {` · ~532);
  the fallback applies the same status/type filter in JS over `loadLayer`'s output (measured
  inside M1's totals) — **and the filter must be applied before `select`, not only to the
  tiers**: `activeInjectable` pre-filters the candidate set, so on the DB path `select`'s
  focus-report universe (`buildFocusReport` over `eligibleAll`, `src/core/select.ts` · `function buildFocusReport(` · ~693)
  contains normative items only. A fallback that fed `select` the unfiltered corpus would
  produce identical *injections* (R1) but different focus-disclosure *counts* — a
  disclosure-consistency defect the review caught (its I3). Same rule, both paths, including
  the report.
- The corruption self-heal stays where it is, on the writer path (`src/core/store.ts` · `if (!isCorruptionError(error)) throw error;` · ~342):
  a hook that meets a corrupt index falls back to files and *discloses*; the next writer heals.
  A hook must never delete a database (it cannot know the error is corruption and not its own
  read-only view of a mid-write moment).

### 4.2 The write path (dedupe and history)

- **Delivery record:** unchanged — `recordAudit` first, JSONL, never throws
  (`src/core/audit.ts` · `export function recordAudit(root: string, input: AuditInput): AuditWriteResult {` · ~720).
  This was already the durable truth.
- **Session dedupe:** the hook appends delivered `{id, tier, at}` lines to
  `state/<sanitized-ledger-key>.seen.jsonl` and reads the same file for `seen` — replacing
  `Ledger.recordMany`/`Ledger.seen` on the hot path. Torn-tail handling and the atomicity
  argument are `jsonl-log.ts`'s, verbatim (`src/core/jsonl-log.ts` · `export function healTornTail(file: string): void {` · ~157). The restored tier's
  identity-marker semantics (`injected_at = capturedAt`, equality-compared —
  `src/core/ledger.ts` · `recordRestored(sessionId: string, itemIds: string[], at: string = new Date().toISOString()): void {` · ~378,
  `src/core/inject.ts` · `? { at: snapshotCapturedAt }` · ~663) carried over unchanged: the marker
  is data in the line, and last-line-wins per `(id, tier)` on read reproduces
  `recordRestored`'s refresh
  (`src/core/seen-file.ts` · `export function restoredFor(state: SeenState, capturedAt: string): Set<string> {` · ~149).
- **The ledger table** becomes what `audit.ts` already says it is — a derived projection
  (`src/core/audit.ts` · `ledger STAYS, as a derived cache, and is rebuildable from here.` · ~849)
  — and gains the missing replayer: a top-up step (audit-log position tracking per
  `src/core/audit-db.ts` · `CREATE TABLE IF NOT EXISTS audit_source (` · ~97) run before an
  aggregate is read. Shipped as `topUpLedger`, called by `status`, `decay` and `audit
  replay-ledger` — not, in the end, by `rebuild` or the mutation paths. §0.5's false comment is
  corrected by making it true.
- **Seen-file lifecycle and key equivalence — two properties the SQL ledger had that the file
  scheme loses, stated so they are decided here rather than found later** (the review's I4):
  `pruneSnapshots` removed only `*.restore.json` and `*.tmp-*`, so `*.seen.jsonl` files — one per
  session, one per subagent under E2 — would have accumulated forever; the pruning pattern gained
  the third arm this asked for, with the same 30-day retention
  (`src/core/ledger.ts` · `entry.name.endsWith('.seen.jsonl')` · ~818; `SNAPSHOT_MAX_AGE_MS`,
  `src/core/ledger.ts` · `export const SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;` · ~780).
  And `sanitizeSessionId` folded every character outside `[A-Za-z0-9._-]` to `_`, so E2's composed
  key `a::b` shared a filename with a hypothetical session `a__b` — an equivalence class the
  raw-string SQL key did not have. **That narrowing was not accepted: it was closed.** A
  non-canonical id now carries a sha256 digest of its raw spelling beside the folded base, which
  makes the mapping injective for exactly that shape
  (`src/core/ledger.ts` · `injective (modulo a 48-bit digest collision) for every shape the folding` · ~693,
  `src/core/ledger.ts` · `const digest = createHash('sha256').update(sessionId, 'utf8').digest('hex').slice(0, 12);` · ~702),
  and each shape is pinned by a decision test in `seen-file.test.ts`.
- **Accepted degradation, named:** if the seen file cannot be read, the hook injects without
  dedupe — a *re*-injection, disclosed in the audit note, never a miss. If it cannot be
  written, the next matching event re-injects once more. Both are the safe direction. The
  review hunted for a path by which this scheme could produce a *miss* — a seen-set claiming a
  delivery that never happened — and found none with one pre-existing exception: the seen line
  is appended before the hook's output is confirmed delivered downstream, so output lost after
  the hook exits leaves a seen entry for an undelivered item. That window was not new —
  `ledger.recordMany` had the identical one, at the same point in the same function, and the
  seen-file append inherited its position
  (`src/hooks/pre-tool-use.ts` · `appendSeen(ws.projectRoot, dedupeKey, selection.full.map((e) => ({` · ~330) —
  and the file append narrows it by being faster; "re-injection is the worst *new* case" is exact.

### 4.3 SessionStart specifically

`buildInjection` reorders to: `loadLayer` → `select` over those items → render → disclose →
*then* best-effort index refresh with `HOOK_OPEN_PROFILE`, dropped without prejudice if the lock
is held (the drop recorded in the audit note; the next writer or the next uncontended
SessionStart refreshes). The corpus is parsed once, not twice (§0.4) — shipped the other way
round from what this predicted: `rebuild` still returns only `{ loaded, errors }`, and the caller
hands it the items it already parsed as `preloaded`
(`src/core/rebuild.ts` · `const items = preloaded?.[layer] ?? loadLayer(root, layer, errors, config);` · ~464).
Net effect on the numbers: the injection-critical work is what M1 prices; the 500-item p95
(~55 ms) should *fall*, since the write transaction leaves the critical path — it did, to
~45.6–46.3 ms
(`test/perf/session-start-latency.perf.ts` · `Everything recorded before 2026-08-23 was a max-of-20, and is kept here` · ~78).
The 5,000-item figure (598 ms) exceeds the
500 ms perf ceiling — that ceiling was set assuming rebuild cost
(`test/perf/session-start-latency.perf.ts` · `The 500ms budget itself is correct and unchanged from the plan: it is` · ~14)
and was re-derived, not silently widened, as part of implementation.

### 4.4 PreCompact — the durability answer, separately

The snapshot must land. The design removes every blocking dependency from its path rather than
prioritising its lock acquisition:

```
seen set      ← state/<key>.seen.jsonl          (file read; was ledger.seen, pre-compact.ts:34)
cited set     ← scanTranscriptIds               (file read, unchanged, ledger.ts:428-445)
known filter  ← Store.openReadOnly, best-effort (was Store.open + store.ids, pre-compact.ts:30,33)
                 · unavailable → skip the filter: over-capture is safe (§2.3.3, select.ts:470-475)
writeSnapshot ← atomic temp+rename, unchanged   (ledger.ts:298-319)
recordAudit   ← JSONL append, unchanged         (pre-compact.ts:53)
```

After this, PreCompact performs **zero SQLite writes and zero blocking SQLite reads**. Its
worst case is file I/O measured in milliseconds against a 10 s kill. Staleness never enters
the answer: every input is read at capture time from session-scoped or source files. The E4
decision to keep PreCompact on the patient profile becomes moot: there is no lock left to be
patient for.

**What this section claimed before, and why it was wrong.** The first version of this section
ended: *"The durability guarantee becomes the filesystem's rename atomicity … conditional only
on the disk accepting writes."* The adversarial review refuted that sentence by measurement,
and it conflated two properties that must be stated separately:

- **Atomicity against concurrent readers — real, and now measured.** In 22,791 contended read
  trials against a rename loop, **zero** reads saw torn or empty snapshot content (R3): when
  the rename lands, a reader sees the old complete file or the new complete file, never a
  mixture.
- **Availability of the rename — NOT unconditional on NTFS.** `renameSync` over an existing
  target fails `EPERM` whenever *any* process merely holds the target open for reading: **654
  of 2,000 replacement renames failed** under a concurrent reader (R3). `writeSnapshot`
  applied no retry — `retryOnTransientFsError` existed for exactly this error class twenty
  lines away (`src/core/rebuild.ts` · `export function retryOnTransientFsError<T>(fn: () => T, attempts = 5): T {` · ~205)
  and was not used on this path — and `buildRestoreSnapshot`'s catch swallowed the throw and
  returned `null`, with `recordAudit` sitting *after* `writeSnapshot`, so the failure produced
  **no snapshot, no audit record, no disclosure**. That was the same silent loss this design was
  chartered to eliminate, relocated from SQLite to the filesystem — and it is precisely where the
  uncleared antivirus risk (§6, risk 4) lands: a scanner or backup sweep holding `state/` files
  open at the moment PreCompact fires reproduces the probe's condition on a user's machine.
  **The fix below landed:** the rename is retried through the same guard
  (`src/core/ledger.ts` · `retryOnTransientFsError(() => renameSync(tmp, target), SNAPSHOT_RENAME_ATTEMPTS);` · ~763),
  `writeSnapshot` throws rather than swallowing
  (`src/core/ledger.ts` · ``see `SNAPSHOT_RENAME_ATTEMPTS` — and THROWS if it still fails, so the`` · ~739),
  and the caller discloses the loss twice, in an audit record and on stderr
  (`src/hooks/pre-compact.ts` · `SNAPSHOT WRITE FAILED` · ~160).
- **Durability across power loss — absent, and now said.** `writeSnapshot` is `writeFileSync`
  + `renameSync` with no fsync of file or directory
  (`src/core/ledger.ts` · `**NOT power-loss durable**: nothing here fsyncs the file or the` · ~741),
  so across a power cut the rename may land with unflushed data or not land at all. The practical
  exposure is small — a power loss also kills the session the snapshot serves — but "small"
  is a judgement the document owes the reader, not a gap it hides behind the word "durable".

**The required property, stated for the fix rather than implemented here** (it was in flight on
`fix/snapshot-rename-durability` at the time of this amendment, and has since landed): the
snapshot write must retry the rename through `retryOnTransientFsError`
(the same backoff P5 validated the reason for), and on final failure must still emit the audit
record, carrying the failure in its note — `recordAudit` moves out of the success-only path so
that `INV-nothing-is-dropped-silently` holds on the one write §1 declares must not be lost. The
shipped retry budget is 15 attempts rather than the default 5, sized against a scanner's hold
(`src/core/ledger.ts` · `export const SNAPSHOT_RENAME_ATTEMPTS = 15;` · ~729).
With that in place, §4.4's guarantee reads correctly as: **atomic against concurrent readers
(measured), retried against transient Windows sharing violations, disclosed on failure, and
not durable across power loss** — each clause carrying its condition.

### 4.5 What each invariant gets

| Invariant | How the design holds it |
| --- | --- |
| `INV-markdown-is-the-source-of-truth` | Strengthened into a runtime property: the truth now *serves* when the index cannot (C). |
| `INV-nothing-is-dropped-silently` | Fallback-served output says so inline; dropped index refreshes and dedupe degradations carry audit notes; E4's disclosure remains for the (now unreachable-by-design) total-failure case. |
| `INV-hooks-fail-open` | Unchanged; the catch-all `''` remains as the last resort behind C. |
| `INV-select-is-pure` | Load-bearing: it is what makes C a fallback rather than a fork of the selection rule. |
| Zero runtime dependencies | Nothing added: `node:fs`, `node:sqlite`, existing modules. |

---

## 5. Decision table

| Option | Miss stopped? | Snapshot durable? | Hot-path cost | New machinery | First-run story | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| A. Read-only hook access (WAL itself is status quo, `store.ts` · `db.exec('PRAGMA journal_mode = WAL;');` · ~155) | Yes for every observed case: 0 failures / 18,300 contended trials, max 17.2 ms (P6, P6b); doc'd busy windows remain possible, all measured failure shapes fail fast (P2e 0.57 ms) | No (read-side only) | 0.2 ms open (P4); faster than today (drops the schema txn) | None — `openReadOnly` exists (`store.ts` · `static openReadOnly(dbPath: string): Store {` · ~382) | Fails fast (cannot create db) → C | **Adopt — the core** |
| B. Writes off the DB | It is the enabler: removes the hook's only reason to take the write lock | Yes (removes the ledger dependency) | +0.55 ms append; seen-file read O(session) | Seen file; projection top-up (pattern shipped in `audit-db.ts`) | Trivial (append creates) | **Adopt — the enabler** |
| C. Markdown fallback | **Yes — given readable Markdown and a corpus ≲ 10k items** (measured ceiling: 9.9 s cold at 10k, R5); the answer to A's rare, fast-failing residue | Supplies the known-id filter's fallback | 0 steady-state; 28–598 ms warm when firing (M1), seconds cold at scale (R5) | None — `loadLayer`+`select` exist | **The best story: works with nothing else present** | **Adopt — the guarantee** |
| D. Single-writer daemon | Yes, while the daemon lives; new misses when it doesn't | Same caveat | IPC round-trip | Install, lifecycle, liveness, skew, uninstall | Worst: daemon not yet running | **Reject** |
| E. Priority / lease | No — reorders the wait, doesn't remove it; no SQLite mechanism exists [DOC], and B removes hooks from the queue entirely | No | Lock-file checks everywhere | Second locking protocol, all writers must cooperate | Unaffected | **Reject** |
| F. Snapshot + `immutable=1` | Worse than a miss: against a written file, 113/200 opens error and **2/200 return silently wrong data as success** (P3) | Read-side only | 0.33 ms when it works — and lying when it doesn't | Publisher, pointer file, GC vs Windows EPERM (P5), staleness window | Fails without C | **Reject — dead. Keep `immutable=1` away from `.index.db`** |

**Recommendation: B + A + C as one change, in that causal order.** They are not alternatives;
each exists for the next: B removes the hook's writes, which is what lets A open read-only —
the sub-millisecond path that no measured contention touches — and C answers the rare,
fast-failing residue A cannot serve, making "no output" unreachable while Markdown is readable
and the corpus is under the fallback ceiling (§6, risk 3). The headline is A's number; the
enabler is B; the guarantee is C.

**The recommendation survived adversarial review unchanged, and the review's negative results
are part of its evidence.** What was attacked and held: the fallback's equivalence to the
primary selection (identical in 5/5 executed comparisons, R1, with the structural reasons
named); the absence of any new miss vector in the dedupe scheme (no mechanism found by which
the seen-set can claim an undelivered item beyond the window `recordMany` already had then,
§4.2); concurrent seen-file appends (6,000/6,000 intact plus a clean heal-race, R2); and every
`file:line` citation in this document, audited 100% against source — including §0.5's finding
that the code asserted a surface it did not have. What the review corrected is folded in
above: §4.4 was rewritten on its Critical finding (the rename-availability refutation, R3),
the fallback ceiling moved from ~40k to a measured ~10k cold (R5), and the WAL-recovery slow
success is now priced (R4). None of it moved the choice between options — it moved the
conditions the chosen options carry, which is what conditions are for.

## 6. Residual risks, named

1. **Duplicate injections** when a seen file is unreadable/unwritable or a projection is behind
   — accepted (§4.2), disclosed in audit notes, bounded to one session's scope.
2. **A stale index serving JIT** between a dropped SessionStart refresh and the next writer —
   bounded staleness, consistent reads (WAL snapshot isolation), corrected by any writer; the
   items shown are real items, at their last-indexed revision.
3. **The fallback has a measured ceiling: ~10,000 items on a cold cache.** This document
   first estimated ~40,000 by extrapolating M1's warm-cache curve; the review measured the
   real thing (R5): **9,903 ms at 10,000 items cold** — at the kill threshold — and 11,128 ms
   cold / 1,445–3,679 ms warm at 20,000. The first fallback fire after a reboot or a cache
   flush is the cold case, i.e. the ceiling binds at exactly the moment the fallback is
   needed. **Past the ceiling, stated rather than implied:** the fallback hook is killed at
   10 s and the injection degrades to E4's disclosed miss — the design's guarantee is
   therefore *conditional on corpus size ≲ 10k items*, two orders of magnitude above the
   54-item dogfood corpus. The mitigation trigger (a `loadLayer` fast-parse mode — skip
   checksum verification and body parsing on the fallback path; NOT Option F, which P3
   closed) is pinned to ~5–10k items, and `doctor` warns as a corpus approaches it — shipped at
   the low edge of that band
   (`src/doctor/checks.ts` · `export const FALLBACK_CEILING_WARN_ITEMS = 5000;` · ~726).
4. **Antivirus interference is documented-elsewhere, not cleared — and it can no longer be
   parked as documentation-only, because §4.4 is where it lands.** Defender's real-time
   protection is off on the measurement machine, so no probe could exhibit or refute the
   sporadic scanner `EPERM/EBUSY` hazard — but the review showed the *mechanism* is real
   without any AV: any process holding a file open makes rename-over-it fail `EPERM` (R3) and
   deletion fail `EPERM` (P5). A scanner is simply a process that holds files open at
   unpredictable moments; on the A+C read path it can only slow reads or spuriously trigger
   the fallback, but on the snapshot path it reproduces §4.4's silent-loss condition exactly —
   which is why the retry-plus-disclosure fix there is required, not advisory. The seen-file
   append inherits the same exposure and uses the same guard
   (`retryOnTransientFsError`, `src/core/rebuild.ts` · `if (!code || !TRANSIENT_RENAME_CODES.has(code) || attempt === attempts - 1) throw err;` · ~211),
   with its own attempt budget
   (`src/core/seen-file.ts` · `}), SEEN_APPEND_ATTEMPTS);` · ~109).
5. **Read-only open during WAL crash recovery** is now measured on Windows: the read-only
   connection itself performed full recovery through the crashed writer's leftover `-shm` in
   12.3 ms, and even with the directory write-denied it still succeeded while that `-shm`
   survived (P2c, P2e). The remaining unknowns: Linux behaviour (E1-certified platform,
   explicitly out of the measurement's scope), and the `-shm`-deleted-plus-unwritable-directory
   corner, which hard-fails in 0.56 ms — C catches it, but it should be *known* on Linux too,
   not discovered.
6. **The perf ceilings move** (§4.3): SessionStart's 500 ms assertion was priced on a rebuild
   the path no longer performs; JIT's 50 ms p95 now excludes a rare priced fallback. Both
   ceilings held. SessionStart re-derived its baseline against the new shape and kept the 500 ms
   figure, per the project's rule that a widened ceiling records why
   (`test/perf/focus-latency.perf.ts` · `own observed numbers rather than replacing this baseline silently.` · ~22);
   `jit-latency.perf.ts` kept its pre-change baseline and the fallback was priced in a suite of
   its own instead (`test/perf/fallback-latency.perf.ts`).
7. **Three branches had to land first or be folded in**, and all three did: E4
   (`e4-e6-small-fixes`) supplied the profile and disclosure machinery §4 reuses; E2
   (`e2-subagent-injection`) supplied the dedupe key the seen file is named by; and
   `fix/snapshot-rename-durability` closed §4.4's Critical — this design assumed its
   retry-plus-disclosure property was in place, and it is (§4.4). The design was written against
   their union with `phase-5/quality`.
