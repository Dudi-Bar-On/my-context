import { DatabaseSync } from 'node:sqlite';
import { closeSync, openSync, readSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  auditDir, auditLogPath, auditSegments, parseAudit,
  type AuditFilter, type AuditRecord,
} from './audit.ts';
import { ensureLogDir } from './jsonl-log.ts';

// --- The audit projection ---------------------------------------------------
//
// **The JSONL is the truth; this database is derived and disposable.** That is
// deliberately the same relationship Markdown has to `.index.db`
// (`INV-markdown-is-the-source-of-truth`), so the product has ONE story about
// durability rather than two: the file is the record, the database is an index
// over it, and deleting the database loses nothing.
//
// Three reasons this shape rather than writing audit records straight to
// SQLite:
//
//  1. **The hot path.** The PreToolUse hook writes a record on every tool call
//     under a 50 ms p95 ceiling. One `appendFileSync` measures 0.55 ms p95 and
//     is flat in the size of the log. Opening a connection, inserting and
//     closing costs more, every call, forever — and this is the one place in
//     the product where per-call cost compounds. The numbers are in
//     `test/perf/audit-latency.perf.ts`.
//  2. **Durability.** A kill mid-append damages one line, at the tail, and
//     `healTornTail` truncates it. A kill mid-transaction against a database
//     is a recovery problem, and the thing being recovered is the audit trail.
//  3. **It closes a trap — and the destroyer is deletion, not `rebuild`.**
//     `rebuild` never was the threat: it re-derives only the `items` table
//     (`deleteByLayer` in rebuild.ts is `DELETE FROM items WHERE layer = ?`,
//     and nothing in that module touches the file or any other table). What
//     actually destroys `.index.db` is that the product DEFINES it as
//     disposable: users are invited to delete it as documented recovery
//     ("delete it, it rebuilds" — see `openProjection` below, and spec §5.2),
//     and `Store.open`'s corruption self-heal `rmSync`s the whole file — db,
//     WAL and shm — on its own, no human involved. The ledger table already
//     pays that price as a disclosed cost (see the note on `Store.open`);
//     audit history must not. So this database is a SEPARATE file under
//     `.audit/`, which nothing in `rebuild.ts` or `store.ts` can reach.
//     `test/core/audit-projection.test.ts` executes that separation rather
//     than asserting it.
//
// **The record is stored whole, as `jsonb`, and queried into.** Measured on
// Node 24.18 (SQLite 3.53.1) before committing to it: `jsonb()`, `->>`,
// `json_each`, VIRTUAL generated columns over a jsonb blob and expression
// indexes over them all work through `node:sqlite`, and a jsonb blob of a
// representative injection record is 452 bytes against 546 as text. What that
// buys is that a record shape which GROWS a field does not need a migration:
// the new field is already stored, already queryable with `->>`, and a
// generated column can be added later over data that is already there. The
// alternative — shredding every field into a real column — re-decides the
// schema every time the vocabulary moves, which for a log meant to be kept
// indefinitely is the wrong trade.

/** Bumped when the schema below changes; a mismatch discards and rebuilds. */
const PROJECTION_VERSION = 1;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS audit (
  seq        INTEGER PRIMARY KEY,
  src        TEXT NOT NULL,
  rec        BLOB NOT NULL,
  at         TEXT GENERATED ALWAYS AS (rec ->> '$.at')        VIRTUAL,
  kind       TEXT GENERATED ALWAYS AS (rec ->> '$.kind')      VIRTUAL,
  op         TEXT GENERATED ALWAYS AS (rec ->> '$.op')        VIRTUAL,
  origin     TEXT GENERATED ALWAYS AS (rec ->> '$.origin')    VIRTUAL,
  item_id    TEXT GENERATED ALWAYS AS (rec ->> '$.itemId')    VIRTUAL,
  session_id TEXT GENERATED ALWAYS AS (rec ->> '$.sessionId') VIRTUAL,
  path       TEXT GENERATED ALWAYS AS (rec ->> '$.path')      VIRTUAL
);

CREATE INDEX IF NOT EXISTS idx_audit_at      ON audit(at);
CREATE INDEX IF NOT EXISTS idx_audit_op      ON audit(op);
CREATE INDEX IF NOT EXISTS idx_audit_kind    ON audit(kind);
CREATE INDEX IF NOT EXISTS idx_audit_item    ON audit(item_id);
CREATE INDEX IF NOT EXISTS idx_audit_session ON audit(session_id);

-- One row per (record, item) mention, so "everything that happened to this
-- item" is an indexed lookup rather than a scan with json_each in the
-- predicate. \`role\` distinguishes the three ways a record can name an item,
-- which is itself a useful query: a 'spilled' row is an item that was eligible
-- and did not fit, and counting those by item is how a user finds a budget
-- that is too small.
CREATE TABLE IF NOT EXISTS audit_item (
  seq     INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  role    TEXT NOT NULL,
  tier    TEXT,
  PRIMARY KEY (seq, item_id, role)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_audit_item_id ON audit_item(item_id, role);

-- How much of each segment this projection has consumed. Staleness is the
-- comparison between this and the files on disk — see \`projectionState\`.
CREATE TABLE IF NOT EXISTS audit_source (
  file    TEXT PRIMARY KEY,
  bytes   INTEGER NOT NULL,
  records INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS audit_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) WITHOUT ROWID;
`;

export function auditDbPath(root: string): string {
  return path.join(auditDir(root), 'audit.db');
}

/**
 * How the projection stands relative to the log it is derived from.
 *
 * `diverged` is not "worse staleness": it means a segment SHRANK or vanished,
 * which the append-only log cannot do except by rotation or by a human moving
 * a file. Rows already projected from it can no longer be trusted to be in log
 * order, so the only correct response is to discard and rebuild — never to
 * append on top.
 */
export type ProjectionState = 'fresh' | 'behind' | 'diverged';

interface SourceRow { file: string; bytes: number; records: number }

function sources(db: DatabaseSync): Map<string, SourceRow> {
  const rows = db.prepare(
    'SELECT file, bytes, records FROM audit_source',
  ).all() as unknown as SourceRow[];
  return new Map(rows.map((r) => [r.file, { ...r, bytes: Number(r.bytes) }]));
}

function sizeOf(file: string): number {
  try {
    return statSync(file).size;
  } catch {
    return -1; // gone
  }
}

/**
 * Compares the projection against the log on disk. Pure: it opens no file for
 * reading and changes nothing.
 */
export function projectionState(root: string, db: DatabaseSync): ProjectionState {
  const known = sources(db);
  const onDisk = auditSegments(root);
  const seen = new Set<string>();

  // **Every segment is examined before answering, and `diverged` wins.**
  //
  // Returning on the first non-fresh segment was wrong, and a rotation is the
  // case that proves it: rotation renames `audit.jsonl` to a dated segment and
  // starts a fresh, small `audit.jsonl`. `auditSegments` lists the dated one
  // FIRST (it is older), so a first-match answer reported `behind` — never
  // reaching the shrunken `audit.jsonl` that makes this a divergence — and
  // `syncProjection` would then have appended the rotated segment's records on
  // top of the rows it had already projected from the same bytes under the old
  // name. Every record around a rotation would appear twice, in an audit log.
  // Found by `a rotation is survived`, not by reading.
  let answer: ProjectionState = 'fresh';
  for (const file of onDisk) {
    seen.add(file);
    const row = known.get(file);
    const size = sizeOf(file);
    if (row === undefined) { answer = answer === 'fresh' ? 'behind' : answer; continue; }
    if (size < row.bytes) return 'diverged'; // shrank — cannot be an append
    if (size > row.bytes) answer = answer === 'fresh' ? 'behind' : answer;
  }
  // A file the projection knows about that is no longer on disk: rotated under
  // a new name, moved aside after corruption, or deleted. Either way the rows
  // projected from it cannot be reconciled by appending.
  for (const file of known.keys()) if (!seen.has(file)) return 'diverged';
  return answer;
}

/**
 * Reads `file` from `offset` to EOF, stopping at the last complete line.
 * Exported for `core/ledger-replay.ts`, which runs the identical
 * position-tracked consumption over the same segments. Exported for the UI's
 * live audit tail (web-ui plan 3), which must consume lines under exactly this
 * torn-tail rule rather than re-spelling it.
 */
export function readCompleteLines(file: string, offset: number): { text: string; consumed: number } {
  const size = sizeOf(file);
  if (size <= offset) return { text: '', consumed: offset };
  const fd = openSync(file, 'r');
  try {
    const buf = Buffer.alloc(size - offset);
    readSync(fd, buf, 0, buf.length, offset);
    // Only COMPLETE lines are projected. A torn tail is left unconsumed, so
    // the next sync — after `healTornTail` or after the writer finishes the
    // record — picks it up from the same offset. This is what keeps the
    // projection from ever holding half a record.
    const lastNewline = buf.lastIndexOf(0x0a);
    if (lastNewline === -1) return { text: '', consumed: offset };
    return {
      text: buf.subarray(0, lastNewline + 1).toString('utf8'),
      consumed: offset + lastNewline + 1,
    };
  } finally {
    closeSync(fd);
  }
}

function insertRecords(db: DatabaseSync, file: string, records: AuditRecord[]): void {
  const insertRec = db.prepare('INSERT INTO audit (src, rec) VALUES (?, jsonb(?))');
  const insertItem = db.prepare(
    'INSERT OR IGNORE INTO audit_item (seq, item_id, role, tier) VALUES (?, ?, ?, ?)',
  );
  for (const record of records) {
    const seq = Number(insertRec.run(file, JSON.stringify(record)).lastInsertRowid);
    if (record.itemId !== undefined) insertItem.run(seq, record.itemId, 'subject', null);
    for (const entry of record.injected ?? []) {
      insertItem.run(seq, entry.id, 'injected', entry.tier);
    }
    for (const entry of record.spilled ?? []) {
      insertItem.run(seq, entry.id, 'spilled', entry.tier);
    }
  }
}

/**
 * Brings the projection up to date with the log, and returns what it had to
 * do. Throws only on an error that leaves the projection unusable — a caller
 * that catches it must say so rather than answering from what is there (see
 * `cli/commands/audit.ts`).
 *
 * The whole thing runs in one transaction, so a projection is never left
 * half-synced: either it advanced to a consistent point or it did not move.
 */
export function syncProjection(root: string, db: DatabaseSync): ProjectionState {
  const state = projectionState(root, db);
  if (state === 'fresh') return state;

  begin(db);
  try {
    if (state === 'diverged') {
      // Discard everything. Row order in `audit` IS log order (rowids are
      // assigned in the order records are inserted, and segments are inserted
      // oldest-first), and that ordering cannot be repaired by appending once
      // a segment has moved — most commonly because a rotation renamed the
      // live log out from under it.
      db.exec('DELETE FROM audit_item; DELETE FROM audit; DELETE FROM audit_source;');
    }

    advanceSources(root, db, state === 'diverged' ? new Map<string, SourceRow>() : sources(db));
    stampVersion(db);

    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* SQLite may have rolled back already */ }
    throw err;
  }
  return state;
}

/**
 * `BEGIN IMMEDIATE`, never bare `BEGIN`, for every transaction that projects
 * the log.
 *
 * A bare `BEGIN` is DEFERRED: the write lock is taken at the first INSERT,
 * which is AFTER `projectionState` and `sources` have already read the
 * offsets. Two processes could therefore read the same `audit_source.bytes`,
 * both consume the same bytes and both insert them — every record around the
 * overlap appearing twice, in an audit log. That was survivable while the only
 * writers were `mycontext audit` and `mycontext status`, which a person runs
 * one at a time. It is not survivable now that `recordAudit` projects on every
 * append: two hooks in two Claude sessions against one workspace is the
 * ordinary case, not the exotic one.
 *
 * `IMMEDIATE` takes the write lock before the first read, so the read of the
 * offsets and the write that advances them are one atomic step. The loser
 * waits out `PRAGMA busy_timeout` and then sees the winner's offsets.
 */
function begin(db: DatabaseSync): void {
  db.exec('BEGIN IMMEDIATE');
}

/** The version stamp `openProjectionReadOnlyChecked` reads back. */
function stampVersion(db: DatabaseSync): void {
  db.prepare(
    `INSERT INTO audit_meta (key, value) VALUES ('version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(String(PROJECTION_VERSION));
}

/**
 * The APPEND-ONLY half of a sync: consume every complete line past each
 * segment's stored offset, insert it, and advance the offset. Returns how many
 * records it projected.
 *
 * Extracted so that `syncProjection` and `keepProjectionCurrent` cannot drift:
 * one of them is allowed to discard and rebuild first and the other is not,
 * and that is the ONLY difference between them. A second spelling of the
 * consumption loop is how the two would quietly stop agreeing about torn
 * tails, about a new empty segment, or about what `parseAudit` throwing means.
 *
 * Must be called inside a transaction opened by `begin`.
 */
function advanceSources(root: string, db: DatabaseSync, known: Map<string, SourceRow>): number {
  const upsert = db.prepare(
    `INSERT INTO audit_source (file, bytes, records) VALUES (?, ?, ?)
     ON CONFLICT(file) DO UPDATE SET bytes = excluded.bytes, records = excluded.records`,
  );

  let applied = 0;
  for (const file of auditSegments(root)) {
    const row = known.get(file);
    const offset = row?.bytes ?? 0;
    const { text, consumed } = readCompleteLines(file, offset);
    if (text === '') {
      // Nothing new to consume, but the row may still be absent (a new,
      // empty segment). Record it so the next sync sees a known file.
      if (row === undefined) upsert.run(file, consumed, 0);
      continue;
    }
    // `parseAudit` applies the same three read outcomes the JSONL always
    // had: a damaged line that is not a torn tail THROWS, and the throw
    // escapes this transaction so the projection stays where it was rather
    // than silently absorbing a truncated history.
    const records = parseAudit(text, file);
    insertRecords(db, file, records);
    upsert.run(file, consumed, (row?.records ?? 0) + records.length);
    applied += records.length;
  }
  return applied;
}

// --- Keeping the projection current on the write path -----------------------
//
// **The projection used to fall behind by design, and that was the defect.**
// Every append left it one record further back and only `mycontext audit`
// caught it up: measured on this repository 2026-08-22, fresh to behind twice
// in forty minutes of ordinary work; measured on the demo corpus 2026-08-24,
// the last forty records were all `access`, so READS staled it too. The read
// surface is right to refuse a projection that cannot vouch for the log
// (owner ruling C1), but it should not have had to.
//
// **The boundary is not moved to fix it.** A read surface still may not sync,
// because syncing is a write. What changed is the other side: the path that
// APPENDS a record now also projects it, and that path is already a write, so
// there is no boundary to cross. `recordAudit` is the one place an audit
// record is appended anywhere in this product, which is why this has one home
// rather than fifteen.
//
// **Three properties, in the order they must hold:**
//
//  1. **The log append succeeds independently.** `recordAudit` decides
//     `written` before this function is reached, outside the try that could
//     report a projection problem as a lost record. The log is the authority;
//     a projection problem may never cost a record.
//  2. **A failed projection update never fails the command.** This function
//     returns its failure and never throws, exactly as `recordAudit` does.
//  3. **It is never silent.** A failure is carried on `AuditWriteResult` and
//     spoken by `auditFailureNote`; and the state it leaves behind — log
//     ahead, projection behind — is the one the read surface already reports
//     honestly. That state is the correct outcome, not a swallowed error.
//
// **It NEVER rebuilds, and that is the load-bearing restriction.** A rebuild
// on the hook path would put the cost of the whole log on one tool call. So
// this consumes only the bytes past each segment's stored offset — the append
// half of `syncProjection`, shared as `advanceSources` — and a `diverged`
// projection is reported and left alone for `mycontext audit`, which is
// entitled to discard and rebuild. `updated` therefore means "the projection
// is current"; it does not mean "this function did work".
//
// **It NEVER creates one either.** A workspace with no `.audit/audit.db` has
// never had a projection built, and that is a legitimate empty state which
// `ProjectionAbsentError` and the Watch screen both name as itself. Conjuring
// one here would silently make every workspace carry a database it never asked
// for, and would pay for the whole log on the first append. `openProjection`
// builds it, `mycontext audit` calls that, and until then there is nothing to
// keep current.

/**
 * What one append did to the projection beside it.
 *
 * **Five, and the four non-`updated` ones are kept apart on purpose.** They are
 * the same distinctions `openProjectionReadOnlyChecked` refuses to collapse on
 * the read side, arriving here for the same reason: "there is no projection to
 * keep current" and "the projection is damaged" are different facts about a
 * user's audit trail, and only one of them is a fault. Reporting damage as an
 * empty state is `INV-nothing-is-dropped-silently` broken in the direction that
 * is hardest to notice — everything looks fine and the trail quietly stops
 * being queryable.
 */
export type ProjectionUpkeepOutcome =
  /** The projection is current with the log — including when there was nothing to do. */
  | 'updated'
  /** No projection file exists. An empty state; a write path does not conjure one. */
  | 'unbuilt'
  /** A schema version this build does not read. Declined — a write path never migrates. */
  | 'foreign'
  /** A segment shrank or vanished. Repairing that is a rebuild, which this path may not do. */
  | 'diverged'
  /** Damage, or any other error. The log is intact and holds the record; the projection is not. */
  | 'failed';

export interface ProjectionUpkeep {
  outcome: ProjectionUpkeepOutcome;
  /** Records projected. Zero for every outcome but `updated`, and zero is possible there. */
  applied: number;
  /** The failure, for `failed` only. Never swallowed — `auditFailureNote` speaks it. */
  error?: string;
}

/** What `openProjectionForUpkeep` found. Damage is not one of these — it throws. */
type UpkeepDoor =
  | { kind: 'open'; db: DatabaseSync }
  | { kind: 'unbuilt' }
  | { kind: 'foreign' };

/**
 * One upkeep connection per projection, per process, held open — and the
 * measurement that made it necessary rather than nice.
 *
 * Measured 2026-08-28 on this machine, 200 appends after 20 warm-ups, one
 * injection record of ten items against a 1 MiB log and a current projection:
 *
 *     append alone                              p95 1.98 ms
 *     append + upkeep, connection per append    p95 12.29 ms
 *     append + upkeep, connection held          p95 3.58 ms
 *
 * The append is on the PreToolUse path, under a 50 ms p95 ceiling, on top of a
 * JIT hit that already costs 11–22 ms. 10 ms per record is not affordable and
 * 1.6 ms is. The 10 ms is not the insert — a held `BEGIN IMMEDIATE`/`COMMIT`
 * measures 0.017 ms — it is opening and closing: 2.2 ms for a bare open/close
 * with no writes, and the rest is the WAL checkpoint SQLite runs when the last
 * connection to a database it has written closes. There is no pragma that buys
 * that back; keeping the connection is what buys it back.
 *
 * **The lifetime is the PROCESS, which is what makes this safe rather than
 * merely fast.** The busiest writer by far is a hook: it starts, appends one or
 * two records, and exits, so it opens once and never checkpoints at all. The
 * long-lived writer is the UI server, which appends a refusal or an execute
 * record and keeps running — exactly the caller a held connection is for.
 *
 * **The handle is validated against the FILE on every use, not trusted.** A
 * projection can be discarded and rebuilt underneath this process by
 * `openProjection` in another one — `mycontext audit` is entitled to do that.
 * A cached handle would then be writing into an unlinked inode and reporting
 * `updated` for rows nothing will ever read, which is the silent failure this
 * whole task exists to remove. So the cache is keyed by the file's IDENTITY,
 * and a file that has been replaced is a cache miss.
 */
interface UpkeepHandle { db: DatabaseSync; identity: string }

const upkeepHandles = new Map<string, UpkeepHandle>();

/**
 * The file as a value: `null` when there is nothing to keep current.
 *
 * `dev:ino` is the identity a replaced file cannot fake. `birthtimeMs` is
 * carried beside it because Windows reports `ino` as `0` on some filesystems,
 * where the pair alone would make every projection look like every other one.
 * Neither is load-bearing on its own and a platform that supplies neither
 * degrades to "the file still exists", which is the check this had before —
 * not to a wrong answer.
 */
function fileIdentity(file: string): string | null {
  try {
    const st = statSync(file);
    // A zero-length file is a valid EMPTY SQLite database that opens clean and
    // reports no tables, and "never built" is a real state here — the same trap
    // `openProjectionReadOnlyChecked` guards with `PRAGMA page_count`.
    return st.size === 0 ? null : `${st.dev}:${st.ino}:${st.birthtimeMs}`;
  } catch {
    return null;
  }
}

/** Closes and forgets one cached handle. Safe to call for a file with none. */
function dropUpkeepHandle(file: string): void {
  const held = upkeepHandles.get(file);
  if (held === undefined) return;
  upkeepHandles.delete(file);
  try { held.db.close(); } catch { /* nothing usable to close */ }
}

/**
 * Releases every held upkeep connection.
 *
 * For a caller that is about to delete the files underneath them — which in
 * this repository means `test/helpers/tmp.ts` and nothing else. On Windows a
 * directory cannot be removed while a handle inside it is open, and a
 * process-lifetime handle over a temp corpus would turn `removeTree`'s
 * occasional, reported leak into a certain one on every run, burying the
 * signal that helper exists to give.
 *
 * Production never calls this: a hook exits, and the UI server wants the
 * connection for as long as it is serving. Calling it is not an error — the
 * next append reopens.
 */
export function closeProjectionUpkeep(): void {
  for (const file of [...upkeepHandles.keys()]) dropUpkeepHandle(file);
}

/**
 * A writable handle onto an EXISTING projection, or the reason there is none.
 *
 * Deliberately not `openProjection`, whose whole contract is the opposite of
 * what is wanted here: it creates the file when it is missing, runs the schema
 * on every open, and on a version mismatch or any failure `rmSync`s the
 * database and both sidecars and builds a new one. Every one of those is
 * correct for `mycontext audit`, which owns the projection, and wrong for an
 * append, which is only keeping one that already exists in step.
 *
 * So: nothing is created, nothing is repaired, and anything unexpected is
 * declined rather than fixed. The `audit_meta` read is also the shape probe —
 * a file that is not a database, or one missing the table, fails here.
 * `busy_timeout` is set because this connection takes the write lock and two
 * hooks in two sessions against one workspace is the ordinary case. It used to
 * say "unlike the read-only door"; since 2026-08-29 that door sets the same
 * 3000 ms, for the second half of the same reason — see its docblock.
 *
 * **Damage THROWS out of here rather than returning a state**, and that is the
 * whole reason this returns a union instead of `DatabaseSync | null`. `null`
 * for both meant a projection truncated to garbage was reported as one that had
 * never been built — the collapse `ProjectionAbsentError` exists on the read
 * side to prevent, arriving on the write side by the back door. Caught by
 * `a projection that cannot be written costs no record, no command, and no
 * silence`, which asked for the note and got an empty string.
 */
function openProjectionForUpkeep(root: string): UpkeepDoor {
  const file = auditDbPath(root);
  const identity = fileIdentity(file);
  if (identity === null) {
    // Gone, or truncated to nothing. Any handle onto what used to be there is
    // now a handle onto nothing and must not be reused.
    dropUpkeepHandle(file);
    return { kind: 'unbuilt' };
  }
  const held = upkeepHandles.get(file);
  if (held !== undefined) {
    if (held.identity === identity) return { kind: 'open', db: held.db };
    // Same path, different file: discarded and rebuilt by `openProjection` in
    // another process. The old handle is writing into an inode nothing will
    // ever read from.
    dropUpkeepHandle(file);
  }
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA busy_timeout = 3000;');
    // **`NORMAL`, not the default `FULL`, and this is the one place in the
    // product where that trade is right.** In WAL mode `NORMAL` skips the fsync
    // on every commit and keeps it for the checkpoint; measured on this machine
    // it takes one record's transaction from 2.10 ms p95 to 0.33 ms, which on a
    // path that runs on every tool call is most of what this upkeep costs.
    //
    // What it gives up is bounded and is exactly what this store can afford to
    // give up: WAL + `NORMAL` cannot corrupt the database, it can only lose
    // COMMITTED transactions in a power loss or an OS crash. Losing them here
    // means the projection is behind the log — a state the log's authority
    // makes harmless, that `projectionState` detects, that the read surfaces
    // report rather than answer from, and that `mycontext audit` ends. The
    // record itself is already durable: `appendJsonlLine` wrote it to the log
    // before this function was reached.
    //
    // Set on THIS connection only. `openProjection` keeps the default, because
    // `mycontext audit` is the caller that rebuilds and a rebuild it has to
    // repeat is a different cost from a row it has to re-derive.
    db.exec('PRAGMA synchronous = NORMAL;');
    const version = db.prepare(
      `SELECT value FROM audit_meta WHERE key = 'version'`,
    ).get() as { value: string } | undefined;
    // An ABSENT version is not a mismatch: `syncProjection` stamps it only on a
    // sync that did work, so a correct projection over an empty log carries
    // none. A version this build does not read is declined — a write path
    // never migrates, and never discards the way `openProjection` may.
    if (version !== undefined && version.value !== String(PROJECTION_VERSION)) {
      db.close();
      return { kind: 'foreign' };
    }
    upkeepHandles.set(file, { db, identity });
    return { kind: 'open', db };
  } catch (err) {
    try { db.close(); } catch { /* nothing usable to close */ }
    throw err;
  }
}

/**
 * Carries the projection across a rotation this process performed itself.
 *
 * Rotation renames the live log to a dated segment and starts a fresh one.
 * To `projectionState` that is a segment that SHRANK and a consumed file that
 * is no longer listed — a divergence, twice over — so without this every 8 MiB
 * of log would diverge the projection by the writer's own hand and leave it
 * there until someone ran `mycontext audit`. Nothing was lost and nothing
 * moved: the same bytes are under a new name, so the stored offset is still
 * exactly right for the renamed file and the rows already projected from it
 * are still in log order (the rotated segment sorts before the live log).
 *
 * Only ever called with a rename THIS process completed. A rotation another
 * process won is a divergence here and is reported as one — this function
 * cannot tell which bytes went where, and guessing is how a projection ends up
 * holding a history that never happened.
 *
 * `audit.src` is rewritten as well as `audit_source.file`. No query reads
 * `src` today; it is the provenance of the row, and provenance naming a path
 * that no longer exists is wrong in the one table whose job is to say where a
 * record came from. The scan happens once per `AUDIT_MAX_BYTES` — roughly one
 * append in 30,000 — and its cost is measured in
 * `test/perf/audit-latency.perf.ts`.
 */
function followRotation(db: DatabaseSync, live: string, rotatedTo: string): void {
  db.prepare('UPDATE audit_source SET file = ? WHERE file = ?').run(rotatedTo, live);
  db.prepare('UPDATE audit SET src = ? WHERE src = ?').run(rotatedTo, live);
}

/**
 * Brings the projection into step with the log after an append. Never throws.
 *
 * `rotatedTo` is the segment `recordAudit` renamed the live log to immediately
 * before its append, or `null` when it did not rotate.
 *
 * The whole thing — the rotation follow-up, the state check and the
 * consumption — runs inside ONE `BEGIN IMMEDIATE`, so the state this decides
 * on is the state it acts on. Reading `projectionState` outside the write lock
 * and acting on it inside is how two appending processes both consume the same
 * bytes; see `begin`.
 */
export function keepProjectionCurrent(
  root: string, rotatedTo: string | null = null,
): ProjectionUpkeep {
  try {
    const door = openProjectionForUpkeep(root);
    if (door.kind !== 'open') return { outcome: door.kind, applied: 0 };
    const db = door.db;

    try {
      begin(db);
      if (rotatedTo !== null) followRotation(db, auditLogPath(root), rotatedTo);
      const state = projectionState(root, db);
      if (state === 'diverged') {
        db.exec('ROLLBACK');
        // **And the handle goes with it.** There is nothing to keep current
        // until a rebuild happens, the rebuild belongs to `mycontext audit` in
        // another process, and on Windows the connection held here would pin
        // the very file that rebuild has to discard — this path would be
        // holding the door shut on its own remedy. Every append until then
        // pays one open and one `stat`, which is the right price for a state
        // that is supposed to end.
        dropUpkeepHandle(auditDbPath(root));
        return { outcome: 'diverged', applied: 0 };
      }
      const applied = state === 'behind' ? advanceSources(root, db, sources(db)) : 0;
      if (applied > 0 || rotatedTo !== null) stampVersion(db);
      db.exec('COMMIT');
      return { outcome: 'updated', applied };
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch { /* SQLite may have rolled back already */ }
      throw err;
    }
  } catch (err) {
    // The handle is DROPPED, not reused. Whatever went wrong, this connection
    // has just failed a transaction against this file and there is no cheap way
    // to establish that it is still good; the next append opens a fresh one and
    // finds out honestly. Holding on to it would make one failure permanent for
    // the life of the process — which for the UI server is the life of the
    // session.
    dropUpkeepHandle(auditDbPath(root));
    return {
      outcome: 'failed',
      applied: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Opens the projection, discarding and recreating it when it is unusable or
 * was written by a different schema version.
 *
 * Discarding is always safe and needs no ceremony: the database holds nothing
 * that is not in the JSONL. That is the point of the shape — the same
 * "delete it, it rebuilds" recovery the item index already has.
 */
export function openProjection(root: string): DatabaseSync {
  ensureLogDir(auditDir(root));
  const file = auditDbPath(root);

  /**
   * Removes the projection and its WAL sidecars.
   *
   * `maxRetries`, for the reason `test/helpers/tmp.ts` documents at length: on
   * Windows the OS can hold a handle to a just-closed SQLite file for a few
   * milliseconds, and a bare `rmSync` fails with EPERM. Failing to delete a
   * database we are about to replace is not worth propagating — the log is
   * untouched either way — so a delete that loses the race leaves `fresh()`
   * below to open whatever is there and report its own failure honestly.
   */
  const discard = (): void => {
    // **This process's own upkeep handle first.** `recordAudit` holds one
    // write connection per projection for the life of the process (see
    // `interface UpkeepHandle`), and on Windows an open handle pins the file:
    // a `discard()` that runs while it is still open silently removes nothing
    // and `fresh()` reopens the very database this was called to be rid of.
    // That is the same trap the closed-before-the-throw comment below records,
    // arriving from a different direction. A handle held by ANOTHER process is
    // not reachable from here and never was — `discard()` tolerates a failed
    // remove and says so.
    dropUpkeepHandle(file);
    for (const target of [file, `${file}-wal`, `${file}-shm`]) {
      try {
        rmSync(target, { force: true, maxRetries: 20, retryDelay: 25 });
      } catch {
        // See above: a stubborn handle is not a reason to fail the read.
      }
    }
  };

  /**
   * The handle is CLOSED before the throw escapes, mirroring `Ledger.open` and
   * for a sharper reason here: on Windows an open handle to the file pins it,
   * so a `discard()` that runs while the failed handle is still open silently
   * removes nothing and the retry opens the same corrupt file again. `new
   * DatabaseSync` succeeds on a non-database file — the failure surfaces at
   * the first `exec` — so this is the ordinary path for a corrupt projection,
   * not an exotic one. Found by `a corrupt projection is discarded and
   * rebuilt`, which failed with "file is not a database" on the second try.
   */
  const fresh = (): DatabaseSync => {
    const created = new DatabaseSync(file);
    try {
      created.exec('PRAGMA busy_timeout = 3000;');
      created.exec('PRAGMA journal_mode = WAL;');
      created.exec(SCHEMA);
    } catch (err) {
      try { created.close(); } catch { /* nothing usable to close */ }
      throw err;
    }
    return created;
  };

  let db: DatabaseSync;
  try {
    db = fresh();
    const version = db.prepare(
      `SELECT value FROM audit_meta WHERE key = 'version'`,
    ).get() as { value: string } | undefined;
    // No row at all is a brand-new database, which is not a version mismatch.
    if (version !== undefined && version.value !== String(PROJECTION_VERSION)) {
      db.close();
      discard();
      db = fresh();
    }
    return db;
  } catch {
    // Corrupt, or a schema this build cannot read. Delete and recreate — the
    // log is untouched, so nothing is lost. A failure from `fresh()` HERE
    // propagates, because at that point the projection genuinely cannot be
    // produced, and `cli/commands/audit.ts` turns that into a disclosed
    // fallback to reading the JSONL directly rather than a stale answer.
    discard();
    return fresh();
  }
}

/**
 * The tables this projection is made of and EVERY column each one declares —
 * the seven VIRTUAL generated columns on `audit` included. Read by exactly
 * one thing, `openProjectionReadOnlyChecked`, which is also why the list is
 * resolved with `pragma_table_xinfo` rather than `pragma_table_info`:
 * measured on this engine, `pragma_table_info('audit')` returns
 * `seq, src, rec` and NOTHING ELSE. The generated columns are hidden from it
 * (`hidden = 2` in `table_xinfo`), and they are exactly the columns
 * `queryProjection` filters on. A shape check written against
 * `pragma_table_info` — the pragma `Ledger.openReadOnlyChecked` correctly
 * uses, because the ledger tables have no generated columns — would have been
 * blind to `ALTER TABLE audit DROP COLUMN origin`, which succeeds, which
 * silently breaks `filter.origin`, and which this list catches.
 */
const PROJECTION_TABLE_COLUMNS: [string, string[]][] = [
  ['audit', ['seq', 'src', 'rec', 'at', 'kind', 'op', 'origin', 'item_id', 'session_id', 'path']],
  ['audit_item', ['seq', 'item_id', 'role', 'tier']],
  ['audit_source', ['file', 'bytes', 'records']],
  ['audit_meta', ['key', 'value']],
];

/**
 * There is no projection file at all: nothing has ever built one for this
 * root. An empty state, not a fault — `openProjection` creates the file, and
 * `openProjection` is a write, so a workspace whose owner has never run
 * `mycontext audit` reaches exactly this.
 *
 * It carries its own class for the reason `store.ts` gives `NewerSchemaError`
 * one and `ledger.ts` gives `LedgerUninitializedError` one: so a caller tells
 * it from damage by CLASS and never by matching a message.
 * `INV-nothing-is-dropped-silently` is broken in both directions if the two
 * are collapsed — a read surface that reports a corrupt projection as "not
 * built yet", or one that reports a never-built workspace as damage.
 */
export class ProjectionAbsentError extends Error {}

/**
 * The projection is a real, correctly shaped, correctly versioned database
 * that does not match the log it is derived from.
 *
 * **This is owner ruling C1 in code.** `syncProjection` would fix it, and
 * fixing it is a WRITE — it inserts, and on `diverged` it deletes every row
 * first. A read may not do that, so a read reports the state instead, and
 * `state` is on the error precisely so the report can name which one without
 * re-deriving it: `behind` (the log has grown) and `diverged` (a segment
 * shrank or vanished) are different facts about a user's audit trail, and a
 * screen that says "stale" for both has thrown away the interesting half.
 *
 * Rebuilding remains legitimate — for `mycontext audit`, for a hook, for
 * anything acting on an explicit instruction. It is not legitimate for a GET.
 */
export class ProjectionStaleError extends Error {
  readonly state: ProjectionState;

  constructor(message: string, state: ProjectionState) {
    super(message);
    this.state = state;
  }
}

/**
 * A read-only, checked door onto the audit projection — what
 * `Store.openReadOnly`/`Store.openReadOnlyChecked` and
 * `Ledger.openReadOnlyChecked` are for their databases, and the second half of
 * the defect the v2 expert-review addendum §2.3 records: *"And reads write…
 * the UI is not read-only, it is mutator-free."* The `Ledger` half shipped
 * first; this is `.audit/audit.db`.
 *
 * **Why a second door and not the existing one.** `openProjection` writes,
 * unconditionally and then some. `new DatabaseSync(file)` CREATES the file
 * when it is missing; `PRAGMA journal_mode = WAL` writes the header;
 * `db.exec(SCHEMA)` runs four `CREATE TABLE IF NOT EXISTS` and six
 * `CREATE INDEX IF NOT EXISTS` on every single open. And on a version mismatch
 * or any failure it calls `discard()`, which `rmSync`s the database and both
 * sidecars and builds a new one. Web-UI plan 3 routes `/api/ask/audit`,
 * `/api/ask/summary` and `/api/watch/spills` through
 * `openProjection` + `syncProjection`, so as planned a GET could delete and
 * rebuild a database on a surface whose entire premise is that it cannot
 * write. Swapping the `Store` and `Ledger` opens for their read-only doors
 * would not have touched it: this is a different file, opened by a different
 * function.
 *
 * **`openProjection` and `syncProjection` are deliberately left exactly as
 * they are.** The write path is correct for its real caller — `cmdAudit`'s
 * `load`, which owns the projection and is entitled to repair it. This door
 * sits beside them for the caller that is not.
 *
 * **What "checked" verifies, and why each check is here.** Unlike the ledger,
 * this projection HAS a version — `PROJECTION_VERSION`, stamped into
 * `audit_meta` — so that is used rather than reasoned around. But the version
 * alone is not enough here for a reason specific to this file, and the reason
 * is not caution:
 *
 *  1. **Positive evidence of a database: `PRAGMA page_count > 0`.** A
 *     zero-length file is a VALID empty SQLite database — it opens, and
 *     `sqlite_master` is simply empty (measured on this engine: `page_count`
 *     is 0 and the master table has no rows). Absence of tables ALONE would
 *     therefore report a file truncated to nothing as a projection that was
 *     merely never built, and "never built" is a legitimate state here. This
 *     is the guard `Ledger.openReadOnlyChecked` added for the same trap; it
 *     applies unchanged.
 *  2. **Every table, with EXACTLY its columns.** Not belt-and-braces over the
 *     version, because the two are stamped by DIFFERENT WRITERS:
 *     `openProjection` creates the tables, `syncProjection` writes the version
 *     row, and nothing makes them agree. A projection can carry `version = 1`
 *     and be missing `audit_item` entirely. `Store.openReadOnlyChecked` can
 *     lean on its version alone because `Store.open` creates `schema_version`
 *     and `items` in the same call; this file cannot.
 *  3. **The version, in either direction, when it is there.** A read-only
 *     caller never migrates, so a projection this build does not read is
 *     refused rather than tolerated — the rule `Store.openReadOnlyChecked`
 *     already sets.
 *  4. **The version's ABSENCE is not a mismatch, and that is measured rather
 *     than assumed.** `syncProjection` stamps `audit_meta` only on a sync that
 *     did work: a sync finding the log unchanged returns at
 *     `if (state === 'fresh') return state;` before the write. So
 *     `openProjection` + `syncProjection` over an EMPTY log leaves a perfectly
 *     correct, perfectly current projection with an empty `audit_meta` —
 *     measured, not inferred — and any workspace where `mycontext audit` ran
 *     before a hook ever fired is in that state. Refusing it would report an
 *     up-to-date projection as damage. What makes tolerating it safe is not
 *     trust: an unstamped projection is required to be UNCONSUMED
 *     (`audit_source` empty) as well, so its only possible answer is "no
 *     records" — and if the log holds anything at all, check 5 refuses it as
 *     `behind` on the next line. An unstamped projection that HAS consumed
 *     segments was written by something that did not follow `syncProjection`'s
 *     contract, and is damage.
 *  5. **`projectionState(root, db)` is `fresh`, or a `ProjectionStaleError`.**
 *     Owner ruling C1: a stale projection is a state to REPORT, not a thing to
 *     fix behind the user's back. `projectionState` is the right instrument
 *     because it is already pure — its own docblock says so — and it is the
 *     same comparison `syncProjection` makes before deciding what to write.
 *
 * **What it does NOT verify, said rather than implied.** Not the six indexes:
 * a missing one costs speed, not correctness. Not the `WITHOUT ROWID` clauses
 * or the primary keys — load-bearing for what `insertRecords` may write, not
 * for whether these reads answer. Not column types, which SQLite does not
 * enforce. Not that any `rec` blob is valid jsonb: a projection holding
 * nonsense is indistinguishable here from one holding real records, and
 * `queryProjection` would throw on it at `JSON.parse`, where the caller can
 * see it. And not the journal mode, which a read-only connection cannot set
 * and has no business setting.
 *
 * **The four outcomes, kept apart on purpose.** A healthy, current projection
 * returns a `DatabaseSync` the engine refuses to write through. No file at all
 * throws `ProjectionAbsentError` — an empty state. A shaped, versioned
 * projection behind or diverged from the log throws `ProjectionStaleError`
 * carrying which. Everything else — truncated, corrupt, half a projection, a
 * shape or a version this build does not read — throws an ordinary `Error`, or
 * the engine's own. The first three are told apart by CLASS, never by message.
 *
 * **Nothing is created and nothing is repaired.** No `ensureLogDir`: the
 * `.audit` directory is not conjured by a read. An absent database throws
 * `SQLITE_CANTOPEN` and leaves nothing behind (pinned by a test), so the
 * `sizeOf` check below is there to say WHICH state that is, not to avoid a
 * side effect. A corrupt projection is reported, never discarded —
 * `openProjection`'s `discard()` is a writer's remedy, and a reader cannot
 * tell "malformed" from its own read-only view of a mid-write moment, which is
 * the reasoning `Store.openReadOnlyChecked` already sets down.
 *
 * ── `busy_timeout` IS SET, AND IT WAS DELIBERATELY NOT, UNTIL 2026-08-29 ────
 *
 * This door used to set none. The sentence it set none on read: *"A read-only
 * connection takes no write lock; `Store.openReadOnlyChecked` sets none for
 * that reason over 18,300 contended trials, and `Ledger.openReadOnlyChecked`
 * re-measured it at 3,000. If contention ever surfaces here it arrives as an
 * immediate throw, which is what a read door wants: the caller discloses a
 * failure instead of stalling on one."*
 *
 * **The first half is true and was never sufficient, and the second half is
 * true of a different kind of failure than the one that actually arrives.**
 *
 *  1. **A reader that takes no write lock is still refused by one.** Not every
 *     moment of this database's life is a WAL moment. `openProjection`'s own
 *     `discard()` deletes the file and both sidecars and rebuilds it, and
 *     `new DatabaseSync(file)` + `PRAGMA journal_mode = WAL` is a window in
 *     which the file is not yet in WAL at all; a WAL checkpoint — which
 *     `openProjectionForUpkeep`'s own measurement names as the expensive part
 *     of a short-lived writer's close, 10 ms of a 12.29 ms p95 — takes locks a
 *     reader waits behind. `SQLITE_BUSY` reaches this connection. It reached
 *     it enough to be the standing explanation for this suite's e2e
 *     contention.
 *
 *  2. **The premise "there is one writer" expired.** The absence was decided
 *     when the only writer was `mycontext audit`, run by a person, one at a
 *     time. `recordAudit` now projects on the path that appends — see
 *     `keepProjectionCurrent` and `begin()`'s own note that "two hooks in two
 *     Claude sessions against one workspace is the ordinary case, not the
 *     exotic one" — and the UI server reads this file while those writes land.
 *     Both write doors wait 3000 ms for each other. A reader that waited zero
 *     was the guaranteed loser of every race in the system.
 *
 *  3. **"Disclose rather than stall" is right about a STATE and wrong about a
 *     MILLISECOND.** The four outcomes this door exists to keep apart —
 *     absent, stale, wrong shape, wrong version — are decided by the CHECKS
 *     below, and every one of them still throws immediately; a timeout cannot
 *     delay or soften any of them. `SQLITE_BUSY` is the one failure here that
 *     is transient by definition, and reporting a transient as a verdict is
 *     how `database is locked` came to be rendered into whichever UI card was
 *     mid-fetch. That is a message about the instant the fetch happened to
 *     land, not about the corpus — the same "a proxy, not the property"
 *     mistake this project has now caught six times.
 *
 * **3000 ms, the number both write doors already use** (`openProjection` and
 * `openProjectionForUpkeep`), rather than a fourth number to keep in step. A
 * held `BEGIN IMMEDIATE`/`COMMIT` on the upkeep connection measures 0.017 ms
 * and a whole open/append/close 12.29 ms p95, so the bound is ~250x the
 * realistic worst hold: it is not sized to make contention survivable, it is
 * sized so that anything still refused after it is a writer that is genuinely
 * stuck, which IS a state worth disclosing — and it is still disclosed, by the
 * engine's own `SQLITE_BUSY`, unchanged.
 *
 * **The cost, named rather than left to be discovered.** `DatabaseSync` is
 * synchronous, so this bound is also the longest a single caller — the UI
 * server's request thread included — can be held inside this open. That is the
 * trade: up to 3 s of waiting in a contended instant, against a certainty of a
 * false error rendered in it. `Store.openReadOnlyChecked` and
 * `Ledger.openReadOnlyChecked` are deliberately NOT changed with this: they
 * were each measured on their own databases and their own writers, and this
 * argument is about this file's second writer, not about theirs.
 *
 * There is deliberately **no unchecked `openProjectionReadOnly`** beside this,
 * for the reason `ledger.ts` gives: nothing calls one, the checked form never
 * needs one as a step, and an exported door that skips the check is a hole in
 * an API whose entire purpose is that it cannot write.
 */
export function openProjectionReadOnlyChecked(root: string): DatabaseSync {
  const file = auditDbPath(root);

  // Asked BEFORE the open, so the never-built state is named as itself. The
  // open would throw `SQLITE_CANTOPEN` here anyway and create nothing (pinned
  // by a test), but `SQLITE_CANTOPEN` is equally what a permission failure or
  // an unreadable directory produces, and reporting those as "never built" is
  // the collapse this door exists to refuse. `sizeOf` is this file's own
  // existence probe — `-1` is its "gone" — so no import moves for this.
  if (sizeOf(file) < 0) {
    throw new ProjectionAbsentError(
      `my_context: ${file} does not exist — the audit projection has never been built for this ` +
      'workspace. It is built by `openProjection`, which is a write, and a read-only caller ' +
      'never builds it. This is an empty state, not a damaged database: the append-only JSONL ' +
      'under .audit/ is the record, and it is untouched.',
    );
  }

  const db = new DatabaseSync(file, { readOnly: true });
  try {
    // The one knob this door sets, and the only statement here that is not a
    // question about the file. See the `busy_timeout` section on the docblock
    // for why the deliberate absence was reversed, why 3000 and not a new
    // number, and what it costs. It writes nothing: `busy_timeout` is a
    // per-connection setting, and this connection is one the engine refuses to
    // write the database through (`isProjectionReadOnly` below asks it).
    db.exec('PRAGMA busy_timeout = 3000;');
    // Positive evidence that this is a database, before "no tables" is allowed
    // to mean anything. See check 1 on the docblock: a zero-length file opens
    // clean and reports an empty `sqlite_master`. On a genuinely corrupt file
    // this is where `file is not a database` arrives — `new DatabaseSync`
    // succeeds on a non-database and the failure surfaces at the first
    // statement, exactly as `openProjection`'s `fresh()` records.
    const pages = db.prepare('PRAGMA page_count').get() as { page_count?: number } | undefined;
    if (pages === undefined || Number(pages.page_count) === 0) {
      throw new Error(
        `my_context: ${file} holds no database pages at all — an empty or truncated file, not ` +
        'a projection that was never built. A read-only caller never rebuilds it.',
      );
    }

    const missing: string[] = [];
    for (const [table] of PROJECTION_TABLE_COLUMNS) {
      const row = db.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      ).get(table) as { name: string } | undefined;
      if (row === undefined) missing.push(table);
    }
    if (missing.length > 0) {
      throw new Error(
        `my_context: ${file} is missing ${missing.join(', ')}. All four projection tables are ` +
        'created together by one statement, so a subset is damage rather than a partial build, ' +
        'and this open refuses to report it as one.',
      );
    }

    for (const [table, columns] of PROJECTION_TABLE_COLUMNS) {
      // `pragma_table_xinfo`, NOT `pragma_table_info` — see
      // `PROJECTION_TABLE_COLUMNS`. The columns every filter in
      // `queryProjection` reads are VIRTUAL and invisible to the latter.
      const actual = (db.prepare('SELECT name FROM pragma_table_xinfo(?)').all(table) as
        { name: string }[]).map((r) => r.name).sort().join(', ');
      const expected = [...columns].sort().join(', ');
      if (actual !== expected) {
        throw new Error(
          `my_context: ${file} declares ${table}(${actual}) where this build reads ` +
          `${table}(${expected}). A read-only caller never migrates a projection into shape.`,
        );
      }
    }

    const version = db.prepare(
      `SELECT value FROM audit_meta WHERE key = 'version'`,
    ).get() as { value: string } | undefined;
    if (version === undefined) {
      // Check 4 on the docblock. Unstamped is tolerated ONLY together with
      // unconsumed, which is the pair `syncProjection` actually produces over
      // an empty log; unstamped-but-consumed is a projection whose rows were
      // written by something that did not stamp itself, and provenance is
      // exactly what a version exists to establish.
      const consumed = db.prepare('SELECT COUNT(*) AS n FROM audit_source').get() as { n: number };
      if (Number(consumed.n) > 0) {
        throw new Error(
          `my_context: ${file} has consumed ${Number(consumed.n)} segment(s) but carries no ` +
          'audit_meta version. `syncProjection` stamps the version in the same transaction as ' +
          'the rows, so rows without a stamp were not written by it, and this build will not ' +
          'guess which schema they are in.',
        );
      }
    } else if (version.value !== String(PROJECTION_VERSION)) {
      throw new Error(
        `my_context: ${file} is projection version ${version.value} where this build reads ` +
        `${PROJECTION_VERSION}; read-only callers never migrate. \`mycontext audit\` rebuilds ` +
        'it — the JSONL is the record and nothing is lost.',
      );
    }

    // Owner ruling C1, and last because it is the only check that needs the
    // log as well as the database.
    const state = projectionState(root, db);
    if (state !== 'fresh') {
      throw new ProjectionStaleError(
        `my_context: ${file} is ${state} relative to the audit log` +
        (state === 'diverged'
          ? ' — a segment shrank or vanished, so its rows can no longer be trusted to be in log '
            + 'order and only a full rebuild fixes it.'
          : ' — the log has grown since it was last synced.') +
        ' Bringing it up to date is a WRITE (`syncProjection`), which a read may not perform: ' +
        'a stale projection is a state to report, not one to repair behind the user. ' +
        '`mycontext audit` performs the sync.',
        state,
      );
    }

    return db;
  } catch (error) {
    // The handle is CLOSED before the throw escapes — what `Ledger.open`,
    // `Ledger.openReadOnlyChecked` and `openProjection`'s `fresh()` all do,
    // and for the Windows reason `openProjection` sets out above: an open
    // handle PINS the file, so a leaked one silently blocks the `discard()`
    // that would replace it and the next `openProjection` reopens the same
    // broken file.
    try { db.close(); } catch { /* nothing usable to close */ }
    throw error;
  }
}

/**
 * Whether the ENGINE refuses a write through this connection — asked of the
 * engine, not remembered from how the connection was opened. The probe
 * `Store.isReadOnly` and `Ledger.isReadOnly` run, as a free function because
 * `openProjection` and the door above hand out a bare `DatabaseSync` rather
 * than a wrapper class.
 *
 * The probe is a `CREATE TABLE` inside a transaction that is always rolled
 * back. **`BEGIN IMMEDIATE` is not usable for it** — `store.ts` records that
 * it was tried first and SUCCEEDS on a `{ readOnly: true }` connection,
 * re-verified here on this engine rather than taken on trust, because the
 * refusal does not arrive until a statement actually writes a page. Measured:
 * `BEGIN IMMEDIATE` returns cleanly, and the `CREATE TABLE` after it fails
 * with `attempt to write a readonly database`. The rollback is what keeps the
 * probe side-effect-free.
 *
 * **What a `true` here does and does not mean.** It means one write was
 * refused. The other reason a write is refused is `SQLITE_BUSY` — a concurrent
 * writer holding the lock — and this does not distinguish the two, so it is
 * not a liveness check and nothing at runtime decides anything on it. It
 * exists so a test can assert, of the connection
 * `openProjectionReadOnlyChecked` actually opened, that writing through it is
 * refused. It must not be called on a connection with a transaction already
 * open.
 *
 * It is narrower than "cannot write at all", for the reason `store.ts` sets
 * out on `Store.openReadOnly`: `VACUUM INTO` writes to a path the caller
 * names, never to this file, and a read-only connection does not stop it.
 */
export function projectionIsReadOnly(db: DatabaseSync): boolean {
  try {
    db.exec('BEGIN');
    db.exec('CREATE TABLE __mycontext_projection_write_probe (x)');
  } catch {
    try { db.exec('ROLLBACK'); } catch { /* the BEGIN itself may not have taken */ }
    return true;
  }
  db.exec('ROLLBACK');
  return false;
}

/**
 * `filterAudit`'s filters, expressed as SQL against the projection.
 *
 * This must agree with `filterAudit` (audit.ts) record-for-record on the same
 * data, because the CLI answers from here and the fallback path answers from
 * there — two implementations of one filter is exactly the drift this project
 * keeps finding. `test/core/audit-projection.test.ts` pins the agreement over
 * a corpus that exercises every filter, rather than trusting the reading.
 */
export function queryProjection(db: DatabaseSync, filter: AuditFilter): AuditRecord[] {
  const { sql, params } = filterSelect(filter);
  const rows = db.prepare(sql).all(...params) as { rec: string }[];
  return rows.map((r) => JSON.parse(r.rec) as AuditRecord);
}

/**
 * The SELECT `queryProjection` runs, exposed so the UI's query builder can
 * SHOW the SQL it executes (web-ui plan 3) without a second spelling of the
 * filter — two implementations of one filter is exactly the drift this
 * project keeps finding. The limit form selects the newest n and re-orders
 * oldest-first, like every other read of this log.
 */
export function filterSelect(filter: AuditFilter): { sql: string; params: (string | number)[] } {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (filter.since !== undefined) { where.push('at >= ?'); params.push(filter.since); }
  if (filter.until !== undefined) { where.push('at < ?'); params.push(filter.until); }
  if (filter.kind !== undefined) { where.push('kind = ?'); params.push(filter.kind); }
  if (filter.op !== undefined) { where.push('op = ?'); params.push(filter.op); }
  if (filter.origin !== undefined) { where.push('origin = ?'); params.push(filter.origin); }
  if (filter.sessionId !== undefined) {
    where.push('session_id = ?');
    params.push(filter.sessionId);
  }
  if (filter.itemId !== undefined) {
    // Any of the three roles: the item this record is ABOUT, an item this
    // injection delivered, or an item it spilled. All three are true answers
    // to "what happened to this item", and the spill is the one a user cannot
    // get anywhere else.
    where.push('seq IN (SELECT seq FROM audit_item WHERE item_id = ?)');
    params.push(filter.itemId);
  }

  const clause = where.length === 0 ? '' : `WHERE ${where.join(' AND ')}`;
  // The limit keeps the NEWEST n — taken in descending order and reversed, so
  // the result is still oldest-first like every other read of this log.
  const limited = filter.limit !== undefined && filter.limit > 0;
  const sql = limited
    ? `SELECT json(rec) AS rec FROM (
         SELECT seq, rec FROM audit ${clause} ORDER BY seq DESC LIMIT ?
       ) ORDER BY seq ASC`
    : `SELECT json(rec) AS rec FROM audit ${clause} ORDER BY seq ASC`;
  if (limited) params.push(filter.limit!);
  return { sql, params };
}

/**
 * The predefined queries — the questions a user actually asks of an audit log,
 * answered by name rather than by hand-writing SQL.
 *
 * They live here, over the projection, because that is what the projection is
 * for and because the web UI's structured queries over audit history will want
 * exactly these shapes. Each returns plain rows so a caller can table them or
 * emit them as JSON without a second transformation.
 */
export interface SummaryRow { label: string; count: number; last: string | null }

export function summaryByOp(db: DatabaseSync, filter: AuditFilter = {}): SummaryRow[] {
  const scoped = queryProjection(db, filter);
  const byOp = new Map<string, SummaryRow>();
  for (const record of scoped) {
    const row = byOp.get(record.op) ?? { label: record.op, count: 0, last: null };
    row.count++;
    if (row.last === null || record.at > row.last) row.last = record.at;
    byOp.set(record.op, row);
  }
  return [...byOp.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Which items this log has seen the most of, in either direction. */
export function topItems(db: DatabaseSync, role: string | null, limit: number): SummaryRow[] {
  const sql = role === null
    ? `SELECT i.item_id AS label, COUNT(*) AS n, MAX(a.at) AS last
       FROM audit_item i JOIN audit a ON a.seq = i.seq
       GROUP BY i.item_id ORDER BY n DESC, label ASC LIMIT ?`
    : `SELECT i.item_id AS label, COUNT(*) AS n, MAX(a.at) AS last
       FROM audit_item i JOIN audit a ON a.seq = i.seq
       WHERE i.role = ? GROUP BY i.item_id ORDER BY n DESC, label ASC LIMIT ?`;
  const params: (string | number)[] = role === null ? [limit] : [role, limit];
  const rows = db.prepare(sql).all(...params) as
    { label: string; n: number; last: string | null }[];
  return rows.map((r) => ({ label: r.label, count: Number(r.n), last: r.last }));
}

/** Every session the log knows about, most recent first. */
export function sessions(db: DatabaseSync, limit: number): SummaryRow[] {
  const rows = db.prepare(`
    SELECT session_id AS label, COUNT(*) AS n, MAX(at) AS last
    FROM audit WHERE session_id IS NOT NULL
    GROUP BY session_id ORDER BY last DESC, label DESC LIMIT ?
  `).all(limit) as { label: string; n: number; last: string | null }[];
  return rows.map((r) => ({ label: r.label, count: Number(r.n), last: r.last }));
}
