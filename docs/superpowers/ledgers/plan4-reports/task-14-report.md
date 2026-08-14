# Task 14 report: read-only SQL passthrough

## What was implemented

- `Store.openReadOnly(dbPath)` — `src/core/store.ts`: opens `new DatabaseSync(dbPath, { readOnly: true })` with no schema DDL run against it (running DDL would itself be a write). Lives inside the `Store` class alongside the private constructor/`#db`, as required.
- `Store.prototype.raw(sql)` — `src/core/store.ts`: runs an arbitrary SQL string through `prepare().all()` and spreads each row into a plain object (node:sqlite returns null-prototype rows otherwise).
- `assertSelectOnly(sql)` and `cmdQuery` — `src/cli/commands/query.ts`: the UX-guard parser (strip comments/`'…'`/`"…"`, require one statement starting with `SELECT`/`WITH`, deny a keyword list) plus the `query` command, which rebuilds through a writable connection, closes it, then opens read-only and prints a table or `--json`.
- Registered in `src/cli/commands/index.ts` via `import './query.ts';`.
- `test/core/store-readonly.test.ts` and `test/cli/query.test.ts` — copied verbatim from the brief (both already encode the corrected multi-statement assertion, i.e. `/one statement/i` rather than `/read-only|only SELECT/i`, so no fix was needed there — the brief's own Step-4 code block already had it right; only the prose above the code block warned about an *earlier* draft's mistake).
- `test/cli/f2-registry.test.ts` — added a `query` entry to `SETUPS` (plant an item, plant an unrelated corrupt file, run a harmless `SELECT`) so the registry-driven F2 guard passes for the new command. This file is not listed as a Task 14 deliverable in the brief but the registry test iterates `COMMANDS` and fails without it — required to reach a green `npm test`.

## TDD evidence

1. `node --test test/core/store-readonly.test.ts` before implementing `Store.openReadOnly`/`raw`: 3 of 4 tests failed with `TypeError: Store.openReadOnly is not a function` (the 4th, "does not create a missing database", passed vacuously since any throw satisfies `assert.throws`). Failed for the right reason.
2. Added `openReadOnly`/`raw` to `store.ts` → all 4 store tests pass.
3. Wrote `test/cli/query.test.ts` and `src/cli/commands/query.ts` together (the brief supplies both in the same step); ran `node --test test/core/store-readonly.test.ts test/cli/query.test.ts` → all 17 pass.
4. `npx tsc --noEmit` → clean.
5. `npm test` → first run failed 2 F2-registry tests ("query" registered with no F2 setup). Added the `query` setup to `f2-registry.test.ts`. Re-ran full suite: **1091/1091 passing** (1073 baseline + 17 new query/store-readonly tests + 1 new F2-registry test for `query`).

## Mutation / attack results — every write attempted and what the connection did

All attacks run against a real `DatabaseSync(path, { readOnly: true })` (or through the full `mycontext query` CLI), then verified the underlying row count was unchanged.

**Direct engine-level attacks (bypassing `assertSelectOnly` entirely, calling `.exec()` straight on the read-only connection):**

| Attempt | Result |
|---|---|
| `DELETE FROM items` | blocked — `attempt to write a readonly database` |
| `INSERT INTO items VALUES (...)` | blocked — same |
| `UPDATE items SET ...` | blocked — same |
| `DROP TABLE items` | blocked — same |
| `CREATE TABLE evil (a)` | blocked — same |
| `PRAGMA journal_mode = DELETE` | blocked — `disk I/O error` (the pragma itself requires a write) |
| `ATTACH DATABASE '<new file>' AS other` then `CREATE TABLE other.x` / `INSERT` | blocked at the `ATTACH` step itself — `unable to open database: <path>` |
| `UPDATE sqlite_dbpage SET data = data WHERE pgno = 1` | blocked — `no such table: sqlite_dbpage` (not exposed without the loadable extension, but note it's not in the CLI's own denylist either — irrelevant here since the connection already refuses it) |
| `PRAGMA writable_schema = ON` then `UPDATE sqlite_master SET sql = sql WHERE name = 'items'` | blocked — `table sqlite_master may not be modified` |

Noteworthy: I specifically tried the `ATTACH`-then-write-to-the-attached-database trick, since `readOnly: true` in principle only constrains the *primary* connection — a naive implementation could let a query open a second, writable database via `ATTACH` and mutate that instead. On this `node:sqlite` build the `ATTACH` itself failed before any write was possible, so this path is closed. This is worth re-verifying if the Node/SQLite version changes, since it's not something `assertSelectOnly`'s denylist alone would catch if the engine ever behaved differently (it does deny `ATTACH` as a keyword too, so both layers currently agree, but the brief is explicit that the parser is not the thing to trust here).

**Full-stack attacks through `mycontext query`, attempting to defeat `assertSelectOnly`'s comment/string stripping specifically:**

| SQL | assertSelectOnly's verdict | What happened | Rows before/after |
|---|---|---|---|
| `WITH x AS (DEL/**/ETE FROM items) SELECT 1` | **accepted** — `strip()` turns `DEL/**/ETE` into `DEL ETE`, breaking the `\bDELETE\b` regex, so the keyword scan misses it | Passed to `store.raw()`, which handed it to SQLite — **rejected by the SQL parser itself**: `near "DEL": syntax error`. A comment cannot legally split a keyword token, so the "bypass" is not valid SQL in the first place. | 1 / 1 — no loss |
| `WITH x AS (DELETE FROM items RETURNING *) SELECT * FROM x` (the brief's own CTE-DML example) | rejected — the keyword scan catches the bare `DELETE` substring even though the prefix check passes on `WITH` | never reached the database | 1 / 1 |
| `SELECT [delete] FROM items` | rejected — `[delete]` is bracket-quoted (a legal SQLite identifier, and `strip()` does not know that), but the keyword regex has a word boundary at `[` and `]`, so `\bDELETE\b` still matches the substring by coincidence | never reached the database | 1 / 1 |
| `` SELECT `type` FROM items `` | accepted (correctly — this is a genuine read) | ran normally, returned the one row | 1 / 1 |

Conclusion from the attack pass: I could not get a single write through. The one place `assertSelectOnly` was actually fooled (the comment-split-keyword case) was still caught — not by the parser, but by SQLite's own grammar rejecting the malformed token, and even if it hadn't been, the underlying `DatabaseSync` is opened `readOnly: true` and every direct write attempt above (including the ATTACH escape hatch) failed at the engine. This is exactly the two-layer story the ruling describes: the parser is a UX nicety that can be — and here demonstrably is — wrong in either direction (over-blocking `[delete]`, under-blocking the comment trick), while the connection is unconditional.

## The WAL detail

`cmdQuery` opens `Store.open(ws.dbPath)` (writable), runs `rebuild`, and closes it — that close is what checkpoints the WAL and removes the `-wal`/`-shm` siblings — before opening `Store.openReadOnly(ws.dbPath)`. I verified this ordering is necessary and correctly implemented; empirically, though, I want to report exactly what I observed rather than restate the brief's claim unverified:

I built a standalone repro (writable connection in WAL mode, one insert, **deliberately left open** so `-wal`/`-shm` were live) and then opened a *second*, read-only connection against the same file while the writer was still open. On this Node 24 / `node:sqlite` build on Windows, that read-only open **succeeded and returned the correct (non-stale) row** — it did not fail, and it did not read stale data, contradicting the strongest phrasing in the brief ("fails or reads stale data"). I could not reproduce an actual failure or staleness in the time available; it's plausible the failure mode is narrower than stated (e.g. only on a *never-yet-read* WAL with no `-shm` initialized, or platform-dependent, or dependent on whether the reader is the very first opener of the file) rather than universal.

This does not change what the code should do: the rebuild-then-close-then-read-only-open ordering is still correct practice regardless of whether this particular build happens to tolerate reading through a live WAL — it guarantees a clean, checkpointed, single-writer-then-reader handoff instead of relying on an engine behavior I could not fully characterize. I did not weaken or remove that ordering. I'm flagging the discrepancy so nobody treats "reads stale data" as an empirically-confirmed failure mode of *this* environment — it wasn't, in my one repro — while the design decision to keep the current ordering stands independent of that.

## Other things I looked at per the brief's prompts

- **Large/expensive query (cartesian join, huge result set):** `cmdQuery` has no `LIMIT`, no timeout, and calls `.all()` (materializes every row) before printing. A query like `SELECT * FROM items a, items b, items c` on a large corpus would allocate an unbounded result set and block the CLI process until SQLite finishes; there's no guard against it. This is a real gap but the brief's Step 5 code is prescriptive and doesn't add one, so I implemented it as given and am flagging it here rather than silently deviating from the brief's literal implementation.
- **Index missing or mid-rebuild:** handled — `cmdQuery` always opens `Store.open` (which creates the schema if absent) and runs `rebuild` before ever opening read-only, so a first-time query against a workspace with no `.index.db` yet just works rather than erroring. "Mid-rebuild" (another process rebuilding concurrently) falls under `Store.open`'s existing busy-retry logic, unrelated to this task.
- **Does an error leak the absolute DB path?** Checked directly: `new DatabaseSync(<missing path>, { readOnly: true })` throws `unable to open database file` with no path in the message. `raw()`'s SQL errors (e.g. `SELECT nope FROM items` → `no such column: nope`) likewise don't include the filesystem path. No leak found.
- **Could a query result contradict the Markdown?** No — `cmdQuery` always rebuilds from Markdown into the writable connection immediately before the read-only open, so the queried index is never stale relative to disk at the moment of the query (barring a genuine race with a concurrent writer, which is the pre-existing `busy_timeout`/retry story, not new to this task).

## Test/typecheck summary

- `node --test test/core/store-readonly.test.ts test/cli/query.test.ts`: 17/17 pass.
- `npx tsc --noEmit`: clean.
- `npm test`: **1091/1091 passing** (1073 baseline + 18 new: 4 store-readonly + 13 query + 1 f2-registry).

## Commit

`1a0efba` — "feat: add a read-only SQL passthrough guarded twice over"

## Concerns

1. No row/size limit on `query`'s result set — an expensive or huge query is not bounded (see above). Left as-is per the brief's literal Step 5 code, but worth a follow-up.
2. The WAL "fails or reads stale data" claim in the brief did not reproduce in my one repro on this platform/build (see WAL section above) — the design (rebuild → close → read-only open) is still correct and unchanged, but I did not independently confirm the specific failure mode the brief describes as load-bearing motivation.
3. `f2-registry.test.ts` required a change not listed in the brief's file list, to keep the suite green (a structural guard the plan already put in place). Included in the same commit since it's inseparable from a passing `npm test`.

---

## Review round 2 — fixes applied

The reviewer ran 18 engine-level and 14 full-stack attacks and confirmed the headline result (no write reached the index) but found three comment-accuracy issues (one security-relevant) and two real bugs. All five addressed below; three are mutation-tested to confirm the new/changed test actually catches the defect it claims to.

### CRITICAL 1 — `VACUUM INTO` writes through the "read-only" connection to an arbitrary path

Confirmed directly: `store.raw("VACUUM INTO '<path>'")` on a `Store.openReadOnly` connection succeeds and writes a full database copy to the given path — `readOnly: true` only refuses writes to the tables in the opened file, not every write a statement could perform. Fixed:

- `src/core/store.ts`: rewrote `openReadOnly`'s doc comment to state the guarantee precisely ("refuses to write THROUGH — to the tables in the file this opened") and name `VACUUM INTO` as the counterexample, with a pointer to the `ATTACH` case (currently closed only because `ATTACH` itself fails on this engine, not because writing to an attached db is blocked in principle).
- `src/cli/commands/query.ts`: rewrote `assertSelectOnly`'s doc comment to say plainly that for `VACUUM INTO` specifically, this function — not the engine — is the actual write barrier, with a matching note on `strip`.
- New test `store-readonly.test.ts`: "openReadOnly does not block VACUUM INTO an arbitrary path" — runs `VACUUM INTO` through a real read-only `Store` and asserts the copy file is created.
- New test `query.test.ts`: "assertSelectOnly rejects VACUUM INTO, the one FORBIDDEN entry where it — not the read-only connection — is the actual write barrier" — asserts both the bare and subquery-nested forms are rejected.
- Mutation-tested: removing `'VACUUM'` from `FORBIDDEN` makes both the new subquery-nesting denylist test and the dedicated VACUUM INTO test fail.

### IMPORTANT 2 — `updated_at` in the schema hint answers a question the Markdown contradicts

`cmdQuery` rebuilds (delete + re-upsert) on every invocation, so `updated_at` is always "now", identical across every row of a single query, and advances on every subsequent run regardless of whether anything changed on disk. Fixed:

- `USAGE` in `query.ts` now documents `updated_at` as "INDEX WRITE TIME, not a Markdown timestamp", explains it is rewritten every run, and points to the Markdown/git history for real change history.
- Added the missing `has_scope` column to the schema hint (previously omitted despite being a real column).
- New test `query.test.ts`: "updated_at is index write time, not a Markdown timestamp" — asserts two items created seconds apart get an identical `updated_at` from one query, and that an unchanged corpus advances `updated_at` on the very next run 1.1s later.
- Updated "query with no SQL prints usage including the schema hint" to match the new hint text.

### IMPORTANT 3 — the WAL comment asserted engine behavior that does not hold

Both comments claimed "a read-only connection cannot create or recover a WAL", used as the stated reason not to reorder rebuild → close → read-only-open. The reviewer verified (and I could not contradict) that on this engine a read-only open against both a *live* and an *orphaned* `-wal` succeeds and returns correct data, recovering the orphaned case rather than failing. Fixed: rewrote the comments in both `store.ts` and `query.ts` to state the correction plainly, keep the ordering (unchanged — still correct and required for freshness, independent of WAL mechanics), and re-ground "why not reorder" in the real reason: the rebuild must happen before the read to guarantee the query reflects Markdown as of that invocation.

### 4 — `query` discarded corpus load errors, satisfying only half of F2

`cmdQuery` called `rebuild(writer, …)` but never read `{ errors }` or called `emitLoadErrors`, so it exited 0 on an unrelated corrupt item but printed nothing — the F2 rule is "reports AND exits 0"; only the exit code half was met. Fixed:

- `query.ts` now captures `{ errors }` from `rebuild` and calls `emitLoadErrors(errors, out)` on both the table and `--json` output paths, with a comment noting a trailing error line after `--json` means the output is only strictly parseable as pure JSON when there are no errors — `Emit` has no separate channel, same constraint every other command here has, and reporting per F2 takes priority.
- New test `query.test.ts`: "query reports an unrelated corpus load error, not just a 0 exit code" — direct regression pin.
- Strengthened `test/cli/f2-registry.test.ts`'s registry-driven loop itself, per the reviewer's explicit ask: it previously asserted only `code === 0`. It now also asserts the corrupt file's name appears in `out`, for every command whose success path actually calls `rebuild` (verified per-command by reading source) — added a `DOES_NOT_REBUILD` exclusion set for the three commands that don't (`ingest`, `ingest-status` — session-file-only, never touch `items`; `lesson-discard` — rewrites only the staging file). Mutation-tested: reintroducing the exact original bug (discard `errors`, drop both `emitLoadErrors` calls) makes the strengthened `f2-registry.test.ts` loop fail specifically on `query`.

### 5 — the "rejects every mutating statement" test never reached the denylist

Every case in that test (`DELETE FROM items`, `DROP TABLE items`, etc.) starts with its own forbidden keyword, so `assertSelectOnly`'s prefix check rejects it first — the keyword denylist scan is never exercised, so a keyword silently deleted from `FORBIDDEN` (except the bracket-identifier coincidence) would not have been caught. Fixed:

- Renamed the existing test to "assertSelectOnly rejects every mutating statement, by whichever check fires first" with a comment explaining what it does and does not prove.
- Added a new test, "assertSelectOnly's keyword denylist actually catches a mutating keyword nested inside a SELECT", with one case per `FORBIDDEN` entry (19 keywords) in the shape `SELECT * FROM (<keyword> …)`, forcing the keyword scan to be the thing that catches it.
- Mutation-tested: removing `'INSERT'` from `FORBIDDEN` makes only the new test fail — the old test stays green throughout, confirming it genuinely could not have caught this class of regression.

### Follow-ups recorded, not fixed (per instruction)

- Unbounded result sets: a ~50s run against a 300-item corpus with a cartesian-join-shaped query **crashed the process** with `FATAL ERROR: Reached heap limit`, in the same suite that asserts SQL errors are reported without a stack trace. Not fixed; recorded as a real gap in `cmdQuery`'s lack of a `LIMIT`/timeout/streaming strategy.
- `writer.close()`'s ordering is pinned only incidentally and only on Windows (`rmSync` on a leaked handle fails `EPERM` there but likely wouldn't on `ubuntu-latest`). Not fixed.
- Deleting the `rebuild()` call in `cmdQuery` entirely survives the current suite because `query.test.ts`'s `project()` fixture populates the index via `runCli(['add', …])`, which itself rebuilds. Not fixed — a coverage gap, not a behavior bug.
- SQL beginning with `--` is silently eaten by the CLI's flag/positional parser before it ever reaches `assertSelectOnly`. Not fixed.

## Re-verification

- `node --test test/core/store-readonly.test.ts test/cli/query.test.ts test/cli/f2-registry.test.ts` — 34/34 pass.
- `npx tsc --noEmit` — clean.
- `npm test` — run twice: **1096/1096** both times.
- Mutation-tested three of the new/changed tests directly against reintroduced bugs (VACUUM removed from FORBIDDEN, INSERT removed from FORBIDDEN, the original query.ts F2 bug reintroduced) — each caught by exactly the test/guard meant to catch it, confirmed by temporarily reverting the fix, observing the expected failure, then restoring.
- `git status --short` — clean tree, only the five touched files.

## Commit (round 2)

`78f6453` — "fix: correct read-only guarantee claims, close F2 gap in query, strengthen denylist coverage"
