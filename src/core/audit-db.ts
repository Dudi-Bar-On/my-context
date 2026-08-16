import { DatabaseSync } from 'node:sqlite';
import { closeSync, openSync, readSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  auditDir, auditSegments, parseAudit, type AuditFilter, type AuditRecord,
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
//  3. **It closes a trap.** Had audit records lived in `.index.db`, `rebuild`
//     would destroy audit history — and the product tells users to run
//     `rebuild` freely, and every `query` runs one implicitly. This database
//     is a SEPARATE file under `.audit/`, which nothing in `rebuild.ts` or
//     `store.ts` can reach. `test/core/audit-projection.test.ts` executes that
//     separation rather than asserting it.
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

/** Reads `file` from `offset` to EOF, stopping at the last complete line. */
function readFrom(file: string, offset: number): { text: string; consumed: number } {
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

  db.exec('BEGIN');
  try {
    if (state === 'diverged') {
      // Discard everything. Row order in `audit` IS log order (rowids are
      // assigned in the order records are inserted, and segments are inserted
      // oldest-first), and that ordering cannot be repaired by appending once
      // a segment has moved — most commonly because a rotation renamed the
      // live log out from under it.
      db.exec('DELETE FROM audit_item; DELETE FROM audit; DELETE FROM audit_source;');
    }

    const known = state === 'diverged' ? new Map<string, SourceRow>() : sources(db);
    const upsert = db.prepare(
      `INSERT INTO audit_source (file, bytes, records) VALUES (?, ?, ?)
       ON CONFLICT(file) DO UPDATE SET bytes = excluded.bytes, records = excluded.records`,
    );

    for (const file of auditSegments(root)) {
      const row = known.get(file);
      const offset = row?.bytes ?? 0;
      const { text, consumed } = readFrom(file, offset);
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
    }

    db.prepare(
      `INSERT INTO audit_meta (key, value) VALUES ('version', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run(String(PROJECTION_VERSION));

    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* SQLite may have rolled back already */ }
    throw err;
  }
  return state;
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
 * `filterAudit`'s filters, expressed as SQL against the projection.
 *
 * This must agree with `filterAudit` (audit.ts) record-for-record on the same
 * data, because the CLI answers from here and the fallback path answers from
 * there — two implementations of one filter is exactly the drift this project
 * keeps finding. `test/core/audit-projection.test.ts` pins the agreement over
 * a corpus that exercises every filter, rather than trusting the reading.
 */
export function queryProjection(db: DatabaseSync, filter: AuditFilter): AuditRecord[] {
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

  const rows = db.prepare(sql).all(...params) as { rec: string }[];
  return rows.map((r) => JSON.parse(r.rec) as AuditRecord);
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
