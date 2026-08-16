# mycontext — never miss an injection, never lose a snapshot

**Date:** 2026-08-16
**Status:** design with a recommendation; pending owner review. Nothing here is implemented.
**Base:** `origin/phase-5/quality` (85318bd). E4's hook contention profile (`0c141d6`) and E2's
subagent dedupe key (`64bc73a`) live on side branches and are cited by branch where they differ.
**Problem owner's framing:** *"Find a way that will make the index 100% not blocked, or a sync
mechanism, or a priority queue so hook requests are always prioritised, or some other way — but we
must find a solution to not miss injections or snapshots, as they are the core of mycontext."*

---

## 0. What is wrong today, stated against the code

mycontext's hooks are short-lived processes sharing one SQLite file (`.index.db`) with the CLI and
the MCP server. The failure the owner names is real and has three distinct shapes, and the current
code — including the just-landed E4 fix — closes none of them; E4 only made one of them *visible*.

**0.1 Every hook is a writer, even when it only wants to read.** `Store.open` runs `tryOpen`,
which sets `PRAGMA journal_mode = WAL` (`src/core/store.ts:111`) and then takes the write lock
with `BEGIN IMMEDIATE` for its schema check (`src/core/store.ts:148`) — on every open, including
the PreToolUse JIT path whose docblock calls itself "Single indexed SQLite read"
(`src/hooks/pre-tool-use.ts:116`). So a hook that will never modify an item still contends for
the one write lock in the file. Measured on this machine (§2): that open sequence under a held
write transaction throws `database is locked` after its `busy_timeout` expires, while a
`{ readOnly: true }` open plus the same SELECT completes in ~28 ms p95 *under the same held lock*.

**0.2 The miss.** Before E4, `Store.open`'s retry policy (5 attempts × 3000 ms `busy_timeout`,
`src/core/store.ts:110,241`) had a contended worst case of ~15–23 s — measured 16.9 s per the E4
commit — against `hooks.json`'s 10 s kill (`hooks/hooks.json:11,23,34`). The killed hook produced
no output: a session silently missing its project knowledge. E4 (branch `e4-e6-small-fixes`,
`0c141d6`) gave hooks a `2 × 500 ms` profile (worst case ~1.06 s), a one-line disclosure and an
audit record when it gives up. **That converts a silent miss into a disclosed miss. The injection
is still missed.** This document's job is the miss itself.

**0.3 The snapshot.** PreCompact opens both `Store` and `Ledger` with the *default* patient
profile (`src/hooks/pre-compact.ts:30-31` — no profile argument even on the E4 branch, which is
deliberate there: patience over failure for a write that matters). Under contention that open can
exceed the 10 s kill, and then `buildRestoreSnapshot` never reaches `writeSnapshot` — the one
write whose loss E4's own framing calls unacceptable. Note what the snapshot write itself is: an
atomic temp-file-then-rename to `state/<session>.restore.json` (`src/core/ledger.ts:298-319`).
**SQLite is not needed to write the snapshot; it is only consulted to decide its contents**
(`store.ids()` to filter known ids, `ledger.seen()` for the injected set,
`src/hooks/pre-compact.ts:33-36`). The durability problem is entirely self-inflicted.

**0.4 SessionStart is the biggest writer of all.** `buildInjection` runs a full `rebuild` —
delete-and-reinsert of the whole corpus inside one write transaction (`src/core/inject.ts:54`,
`src/core/rebuild.ts:451-467`) — on every session start, then reads back what it just wrote with
`store.all()` to feed `select` (`src/core/inject.ts:163-171`). So the highest-traffic injection
path is also the process most likely to be *holding* the write lock that kills a concurrent
hook. And `rebuild` discards the very items it loaded: `loadLayer` parses every Markdown file
into `Item[]` (`src/core/rebuild.ts:458`), `rebuild` returns only `{ loaded, errors }`
(`src/core/rebuild.ts:437-439`), and the selection then re-reads those same items from the
database it just filled. The injection's *input* never needed the database at all.

**0.5 One asserted property the code does not have**, found while verifying this document:
`src/core/audit.ts:532` says the ledger replay "caller (`mycontext audit replay-ledger`) owns the
write" — no such command exists anywhere in `src/` (verified by grep over `src/cli` and
`src/mcp`). `ledgerRows` (`src/core/audit.ts:539`) has no production caller. Whatever option is
chosen, that comment must be corrected or the surface built; §4.2 builds it.

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

### 2.1 Measured on this machine (2026-08-16, Node 24.18.0 / SQLite 3.53.1, Windows 11, NVMe)

Benchmark script: corpus of `constraint` items written with `writeItem`, indexed via
`mycontext rebuild`, contention held by a child process in `BEGIN IMMEDIATE` with one UPDATE
applied. 15–50 iterations after warmup.

| # | What | Result |
| --- | --- | --- |
| M1 | `loadLayer` + `select` (event `tool`) straight from Markdown, **no database** | 500 items: **28.1 ms** p95 · 2,000: **245.5 ms** · 5,000: **597.7 ms** (of which `select` itself is 1.4 / 4.1 / 8.8 ms — parsing dominates) |
| M2 | `{ readOnly: true }` open + indexed SELECT of 5,000 rows, **while another process holds a write transaction** | **28.1 ms p95** (max 29.5) — the reader does not block |
| M3 | Same read, no contention | 24.6 ms p95 — contention cost the reader ~3 ms, not 16 s |
| M4 | Today's writable open sequence (`busy_timeout=500` + WAL pragma + `BEGIN IMMEDIATE`) under the same held lock | throws `database is locked` after **616 ms** — the writer path is the thing that blocks |
| M5 | `file:…?immutable=1` read-only open + COUNT under the held write lock | **0.7 ms** — no locks taken at all |
| M6 | Read-only open after a writer was **SIGKILLed mid-transaction** (leftover `-wal` + `-shm`) | opens and reads correctly; the uncommitted row is invisible. (One machine, Windows, `-shm` present; the general guarantee is conditional — see 2.2.) |
| M7 | `journal_mode` after a normal `Store.open` + close | persists as `wal` in the file — WAL is already on for every `.index.db` ever opened by this code (`src/core/store.ts:111`), so "adopt WAL" is not a change, it is the status quo |

Prior measurements this document reuses rather than re-running: JIT whole-hook hit path
~10.5–22.7 ms p95 on a 5,000-item corpus (`test/perf/focus-latency.perf.ts:18-21`); SessionStart
~55 ms p95 on 500 items, ~124 ms with compact restore (`test/perf/session-start-latency.perf.ts:22-33`);
audit append 0.55 ms p95, flat from empty to 32 MiB (`src/core/audit-db.ts:20-25`,
`test/perf/audit-latency.perf.ts`).

### 2.2 Documented SQLite guarantees (research: `research-sqlite-concurrency.md`, 2026-08-16)

The companion research verified these against sqlite.org; the load-bearing ones:

- **WAL removes reader/writer blocking in steady state but is not a guarantee.** A reader can
  still get `SQLITE_BUSY` in three documented cases: crash **recovery** by the first connection
  after an unclean shutdown (exclusive lock held while the WAL index is rebuilt); the
  **last-connection close cleanup** (exclusive lock while the WAL/SHM files are removed) — and
  this case is *structural* for mycontext, whose every process is short-lived, so "last
  connection closing" is the steady state, not an edge; and a peer in
  `locking_mode=EXCLUSIVE` (https://sqlite.org/wal.html). The file-control that avoids the
  cleanup case, `SQLITE_FCNTL_PERSIST_WAL`, is **not exposed by `node:sqlite`** (no
  `fileControl` surface in Node v24.x `src/node_sqlite.cc`).
- **No priority, no fairness, no queue.** SQLite's entire contention policy is the busy handler
  — poll-and-retry — and its documentation states the handler is not even guaranteed to be
  invoked under contention (https://sqlite.org/c3ref/busy_handler.html). There is no API by
  which one connection's lock acquisition can be preferred. The compile-time blocking-lock
  option (`SQLITE_ENABLE_SETLK_TIMEOUT`) is absent from Node's bundled build and POSIX-only.
- **A guaranteed non-blocking read exists only against a file nobody writes**: `immutable=1`
  skips all locking and change detection (https://sqlite.org/uri.html) — and against a file that
  *does* change it is documented wrong-results / `SQLITE_CORRUPT` territory, so it is only sound
  against a published, never-rewritten snapshot. `node:sqlite` passes `SQLITE_OPEN_URI`
  unconditionally, so this works today (verified, M5).
- **`BEGIN CONCURRENT` and WAL2 are branch-only**, in no release including 3.53.1 — unusable
  under the zero-dependency constraint.
- **The one pattern with an unconditional never-miss capture guarantee** in systems with this
  requirement is: the hot path appends to a flat file and never touches the shared database;
  a separate step projects the log into SQLite later. mycontext has already shipped exactly this
  pattern once, for the audit log (`src/core/audit-db.ts:9-15`).

A second research stream (measured `node:sqlite` latency distributions, `immutable=1` correctness
verdict, Windows locking) had not landed when this document was written
(`research-sqlite-measured.md` absent at time of writing); the points that depend on it are
marked **pending verification** where they occur.

### 2.3 What the code already gives us, unclaimed

Three assets are lying in place, and the recommendation is mostly connecting them:

1. **The audit log is already the first write on every injection path.** `recordAudit` (JSONL
   append, never throws, `src/core/audit.ts:354-375`) runs *before* the ledger write on both
   SessionStart (`src/core/inject.ts:289-304` before `:306-326`) and JIT
   (`src/hooks/pre-tool-use.ts:207` before `:229`), and the ledger is already documented as "a
   derived cache, rebuildable from here" with `ledgerRows` as the replayer
   (`src/core/audit.ts:480-551`). The hooks' SQLite *writes* are already redundant records of
   facts the JSONL holds.
2. **`select` is pure over `Item[]`** (`src/core/select.ts:439`, `INV-select-is-pure`), and
   `loadLayer` produces `Item[]` from Markdown alone (`src/core/rebuild.ts:103`). The complete
   injection decision can be computed with zero database access — M1 says what that costs.
3. **The snapshot write is already durable by construction** (atomic rename,
   `src/core/ledger.ts:298-319`), and a snapshot containing ids the corpus no longer has is
   harmless: the restore path re-selects through `select`, and an id matching no live item
   simply selects nothing (`src/core/select.ts:470-475`). Over-capture is the safe direction,
   which `readSnapshotMeta` already exploits for a missing `capturedAt`
   (`src/core/ledger.ts:394-398`).

---

## 3. The options, each taken seriously

### Option A — WAL for the index, hook reads opened read-only

WAL is already on (M7); what A actually means here is **hooks stop opening writers**. Today's
open path takes the write lock for a schema check every hook touches (`src/core/store.ts:148`);
`Store.openReadOnly` already exists, deliberately runs no DDL (`src/core/store.ts:332-334`), and
under a held write lock costs 28 ms p95 (M2) where the writable open dies (M4).

- **What it buys:** the common contention case — one CLI/MCP writer, hooks reading — stops
  failing at all. The JIT hot path gets *faster* (no `BEGIN IMMEDIATE`, no schema transaction).
- **What it does not buy, and must not be claimed to:** a guarantee. The three documented
  reader-blocking windows of §2.2 remain, and one of them (last-close cleanup) is structural for
  this fleet of short-lived processes; `node:sqlite` exposes no `SQLITE_FCNTL_PERSIST_WAL` to
  close it. A read-only open also cannot create a missing database or migrate a stale schema —
  the fresh-workspace and post-upgrade cases *need* another answer — and it does not trigger
  `Store.open`'s corruption self-heal (`src/core/store.ts:287-308`), so a corrupt index needs
  another answer too.
- **Verdict: adopt, as the fast path — with Option C required behind it** for exactly the cases
  it cannot serve. Alone it narrows the miss; it does not stop it.

### Option B — move the hook's writes off the database entirely

The hooks write two things: ledger rows (dedupe bookkeeping) and, on SessionStart, the rebuilt
index. B removes both from the hook path.

- **Ledger rows.** The durable record already exists before the ledger write happens (§2.3.1).
  What the ledger uniquely serves on the *hot path* is `seen(sessionId)` — the once-per-session
  dedupe read (`src/hooks/pre-tool-use.ts:169`, `src/core/ledger.ts:166-171`). Replace the hot
  write with an append to a **per-session seen file** — `state/<key>.seen.jsonl`, one
  `{id, tier, at}\n` line per delivery, `<key>` being `sanitizeSessionId` (`src/core/ledger.ts:285-288`)
  applied to E2's dedupe key (`session_id::agent_id`, `src/hooks/io.ts:46-49` on branch
  `e2-subagent-injection`). Appending is the audit log's own machinery
  (`appendJsonlLine`/`healTornTail`, `src/core/jsonl-log.ts:138-177`) at its measured 0.55 ms;
  reading it back is O(one session's deliveries) — tens of lines, not the corpus.
- **The ledger table stays, as the projection it is already documented to be**, maintained off
  the hot path: non-hook writers (rebuild, mutations, `decay`) top it up from the audit log via
  `ledgerRows`, using the same position-tracking pattern `audit-db.ts` already ships
  (`src/core/audit-db.ts:89-93`). This also builds the `replay-ledger` surface that
  `src/core/audit.ts:532` falsely asserts exists (§0.5). `decay` and `usage` keep their indexed
  aggregates (`src/core/ledger.ts:187-209`) — they never ran on the hot path.
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
open it is holding the truth in the same directory. M1 prices the fallback: 28 ms at 500 items,
246 ms at 2,000, 598 ms at 5,000 — parsing dominates, `select` itself is single-digit ms.

- Against the 50 ms p95 JIT ceiling, files-only is affordable to ~700 items and over budget at
  5,000. **As the steady state it is therefore wrong for JIT; as the contention fallback it is
  exactly right** — p95 is a distribution bound, the fallback fires only in the residual windows
  A leaves open, and a rare 600 ms tool call is inside the 10 s kill by 16×. Real corpora are
  also far smaller than the perf suite's stress size: this repository, the product's own
  dogfooding corpus, has 54 item files.
- For SessionStart (500 ms budget, once per session) files-only is affordable at any measured
  size except 5,000 (598 ms) — and SessionStart *already* pays the full `loadLayer` parse inside
  `rebuild` today (§0.4), so C is not new cost there; it is the same cost minus the database.
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

### Option F — snapshot-on-write, hooks read a published immutable copy

The strongest rejected option, and the one this document most wanted to recommend after M5
(0.7 ms, zero locks, guaranteed by documentation rather than by measurement). Developed
honestly:

- **Mechanics:** every successful writer (rebuild, mutations), on commit, publishes
  `VACUUM INTO 'state/snapshot-<n>.db'` (documented to produce a consistent snapshot without
  taking the source's write lock) and atomically updates a pointer file; hooks resolve the
  pointer and open `file:…?immutable=1`. Readers holding snapshot N−1 while N is published are
  unaffected (they hold their own file); stale snapshots are garbage-collected by the next
  writer when unreferenced — which on Windows is observable as "delete fails while open", the
  EPERM behaviour `Store.open`'s own comments document (`src/core/store.ts:79-84`).
- **What it guarantees, with its condition:** a non-blocking read *iff a snapshot exists and is
  never modified in place*. Both conditions are the problem:
  - **First run / first impression:** before any writer has ever succeeded there is no snapshot,
    and the fresh-workspace hook must fall back — to exactly Option C. F cannot stand alone.
  - **Staleness window:** bounded by writer cadence, which in this product is user-action-driven
    and therefore unbounded in time. An item captured mid-session is invisible to JIT until the
    next publish. C's fallback reads the current truth; F's steady state reads the past.
  - **New machinery:** a publish step on every write path, a pointer protocol, GC with Windows
    file-sharing semantics (**pending verification** — the rename/delete-while-open behaviour is
    the one [UNK] the concurrency research flagged), and a second database file whose
    divergence from `.index.db` is a new thing `doctor` must check.
- **Verdict: reject for now — on cost, not on soundness.** A+B+C reach the same guarantee with
  no new files and no publisher protocol, because the Markdown corpus *is already* the published
  snapshot F would invent: it is the source of truth, updated atomically per item
  (`writeItem`'s exclusive-create and rename path, `src/core/rebuild.ts:256-330,390`), and C
  reads it directly. F becomes worth its machinery only if corpora grow to where M1's fallback
  cost breaks the 10 s kill — three orders of magnitude beyond the 54-item dogfood corpus — or
  if the measured-research stream returns an `immutable=1` verdict so strong that the 20 ms
  saved per JIT call justifies the publisher. Revisit then.

---

## 4. The design: A + B + C, layered

One sentence: **hooks never write SQLite and never require it — reads go read-only to the index
when it is available and to the Markdown when it is not, session dedupe state lives in a
per-session append-only file, and everything SQLite held that mattered is already in, or moves
to, append-only JSONL that a projection catches up with later.**

### 4.1 The read path (both injection hooks)

```
resolveWorkspace
  → try Store.openReadOnly(dbPath) with busy_timeout ≈ 25 ms     [A: fast path, M2/M3 ~25 ms]
      · file absent, schema absent/stale, busy window, corrupt   ─┐
  → loadLayer(project) + loadLayer(global) → Item[]               ├─ [C: guarantee, M1]
      + one-line disclosure in the output, note in audit record  ─┘
  → select(items, ctx, config)                                    [pure, select.ts:439]
```

- The read-only connection sets no pragmas and runs no DDL (that is `openReadOnly` today,
  `src/core/store.ts:332-334`). Schema staleness is detected by reading `schema_version` and
  falling back — never migrating — because migration is a write and writes belong to writers.
- JIT keeps its indexed `activeInjectable` query on the fast path (`src/core/store.ts:426-433`);
  the fallback applies the same status/type filter in JS over `loadLayer`'s output (measured
  inside M1's totals).
- The corruption self-heal stays where it is, on the writer path (`src/core/store.ts:287-308`):
  a hook that meets a corrupt index falls back to files and *discloses*; the next writer heals.
  A hook must never delete a database (it cannot know the error is corruption and not its own
  read-only view of a mid-write moment).

### 4.2 The write path (dedupe and history)

- **Delivery record:** unchanged — `recordAudit` first, JSONL, never throws
  (`src/core/audit.ts:354-375`). This was already the durable truth.
- **Session dedupe:** the hook appends delivered `{id, tier, at}` lines to
  `state/<sanitized-ledger-key>.seen.jsonl` and reads the same file for `seen` — replacing
  `Ledger.recordMany`/`Ledger.seen` on the hot path. Torn-tail handling and the atomicity
  argument are `jsonl-log.ts`'s, verbatim (`src/core/jsonl-log.ts:98-177`). The restored tier's
  identity-marker semantics (`injected_at = capturedAt`, equality-compared —
  `src/core/ledger.ts:128-163`, `src/core/inject.ts:105-150`) carry over unchanged: the marker
  is data in the line, and last-line-wins per `(id, tier)` on read reproduces
  `recordRestored`'s refresh.
- **The ledger table** becomes what `src/core/audit.ts:480-498` already says it is — a derived
  projection — and gains the missing replayer: a top-up step (audit-log position tracking per
  `src/core/audit-db.ts:89-93`) run by non-hook writers and by `decay`/`usage` readers before
  they aggregate. §0.5's false comment is corrected by making it true.
- **Accepted degradation, named:** if the seen file cannot be read, the hook injects without
  dedupe — a *re*-injection, disclosed in the audit note, never a miss. If it cannot be
  written, the next matching event re-injects once more. Both are the safe direction.

### 4.3 SessionStart specifically

`buildInjection` reorders to: `loadLayer` → `select` over those items → render → disclose →
*then* best-effort index refresh with `HOOK_OPEN_PROFILE`, dropped without prejudice if the lock
is held (the drop recorded in the audit note; the next writer or the next uncontended
SessionStart refreshes). `rebuild` returns the items it loaded instead of discarding them
(§0.4) so the corpus is parsed once, not twice. Net effect on the numbers: the injection-
critical work is what M1 prices; the current 500-item p95 (~55 ms) should *fall*, since the
write transaction leaves the critical path. The 5,000-item figure (598 ms) exceeds the current
500 ms perf ceiling — that ceiling was set assuming rebuild cost (`test/perf/
session-start-latency.perf.ts:14-16`) and is re-derived, not silently widened, as part of
implementation.

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
worst case is file I/O measured in milliseconds against a 10 s kill. The durability guarantee
becomes the filesystem's rename atomicity — the same guarantee the corpus itself rests on —
conditional only on the disk accepting writes, and a disk that refuses writes has already lost
things mycontext cannot save. Staleness never enters the answer: every input is read at
capture time from session-scoped or source files. The E4 decision to keep PreCompact on the
patient profile becomes moot: there is no lock left to be patient for.

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
| A. WAL + read-only reads | Narrowed, not stopped (3 doc'd busy windows, one structural) | No (read-side only) | −(schema txn); ~25 ms read (M2) | None — `openReadOnly` exists | Fails (cannot create db) | **Adopt as fast path** |
| B. Writes off the DB | Yes, for the write side — hooks leave the lock queue entirely | Yes (removes the ledger dependency) | +0.55 ms append; seen-file read O(session) | Seen file; projection top-up (pattern shipped in `audit-db.ts`) | Trivial (append creates) | **Adopt** |
| C. Markdown fallback | **Yes — unconditional given readable Markdown** | Supplies the known-id filter's fallback | 0 steady-state; 28–598 ms when firing (M1) | None — `loadLayer`+`select` exist | **The best story: works with nothing else present** | **Adopt as guarantee** |
| D. Single-writer daemon | Yes, while the daemon lives; new misses when it doesn't | Same caveat | IPC round-trip | Install, lifecycle, liveness, skew, uninstall | Worst: daemon not yet running | **Reject** |
| E. Priority / lease | No — reorders the wait, doesn't remove it; no SQLite mechanism exists [DOC] | No | Lock-file checks everywhere | Second locking protocol, all writers must cooperate | Unaffected | **Reject** |
| F. Snapshot + `immutable=1` | Yes *iff a snapshot exists* — first run falls back to C anyway | Read-side only | 0.7 ms (M5) — the best measured number here | Publisher on every write, pointer file, GC, Windows semantics **pending verification** | Fails without C | **Reject for now; revisit at ~10³ items or on the measured-research verdict** |

**Recommendation: A + B + C as one change.** They are not alternatives; each covers the others'
holes: A makes the common case fast, B makes hooks structurally unable to block or be blocked on
writes, C makes "no output" unreachable while Markdown is readable. F is the named runner-up,
rejected on machinery-for-equal-guarantee grounds, with its re-entry condition stated.

## 6. Residual risks, named

1. **Duplicate injections** when a seen file is unreadable/unwritable or a projection is behind
   — accepted (§4.2), disclosed in audit notes, bounded to one session's scope.
2. **A stale index serving JIT** between a dropped SessionStart refresh and the next writer —
   bounded staleness, consistent reads (WAL snapshot isolation), corrected by any writer; the
   items shown are real items, at their last-indexed revision.
3. **M1's cost curve is superlinear in corpus size** (25 ms → 564 ms for 10× items;
   checksum verification and per-file I/O dominate). At ~40,000+ items the fallback itself
   would threaten the 10 s kill. Mitigation if ever reached: Option F's snapshot, or a
   `loadLayer` fast-parse mode. Marked, not solved.
4. **Windows EPERM on renames/appends under antivirus** — already handled by
   `retryOnTransientFsError` (`src/core/rebuild.ts:205-216`); the seen-file append inherits the
   same exposure and should use the same guard.
5. **Read-only open during WAL crash recovery on other platforms** — M6 passed on Windows with
   `-shm` present; the documented `SQLITE_READONLY_RECOVERY` case needs the filesystem write
   permission the dev machine has. **Pending verification** on Linux (E1 certified platform)
   and against the measured-research findings when they land. If it fails there, C catches it —
   that is the design working, but it should be *known*, not discovered.
6. **The perf ceilings move** (§4.3): SessionStart's 500 ms assertion was priced on a rebuild
   the path no longer performs; JIT's 50 ms p95 now excludes a rare priced fallback. Both perf
   files re-derive their baselines as part of implementation, per the project's rule that a
   widened ceiling records why (`test/perf/focus-latency.perf.ts:21-22`).
7. **Two branches must land first or be folded in**: E4 (`e4-e6-small-fixes`) supplies the
   profile and disclosure machinery §4 reuses; E2 (`e2-subagent-injection`) supplies the dedupe
   key the seen file is named by. This design is written against their union with
   `phase-5/quality`.
