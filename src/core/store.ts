import { rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { Item, Layer } from './types.ts';

const SCHEMA_VERSION = 2;

/**
 * Created and read *before* the rest of `SCHEMA` is ever applied — see the
 * ordering note in `tryOpen`. Kept in its own constant so `tryOpen` can
 * ensure this one table exists without touching `items`, whose shape
 * depends on the version this creates the ability to read.
 */
const SCHEMA_VERSION_TABLE = `CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);`;

const SCHEMA = `
${SCHEMA_VERSION_TABLE}

CREATE TABLE IF NOT EXISTS items (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL,
  always      INTEGER NOT NULL,
  has_scope   INTEGER NOT NULL DEFAULT 0,
  layer       TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_type   ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_layer  ON items(layer);
CREATE INDEX IF NOT EXISTS idx_items_scoped ON items(status, has_scope);
`;

/**
 * A newer-schema database is deliberately not disposable: it may hold
 * structure this code doesn't understand, so it must never be silently
 * deleted the way a corrupt one is. Marked with its own class so
 * `Store.open`'s recovery path can tell the two apart.
 */
class NewerSchemaError extends Error {}

/**
 * Primary (base) SQLite result codes — `error.errcode` from `node:sqlite`
 * may carry an *extended* result code (e.g. 522 = `SQLITE_IOERR_SHORT_READ`,
 * 526 = `SQLITE_CANTOPEN_ISDIR`), whose low byte is the primary code this
 * masks down to. Verified empirically against `node:sqlite` (Node 24):
 * a truncated/garbage file yields `errcode: 26` (`SQLITE_NOTADB`); a locked
 * database yields `errcode: 5` (`SQLITE_BUSY`).
 */
const SQLITE_PRIMARY_CODE_MASK = 0xff;

/**
 * Result codes that mean the file itself is unreadable as a database —
 * corrupt, truncated, wrong format, or encrypted — as opposed to a
 * transient condition (lock contention) or an environmental one (wrong
 * path, permissions). Only these are safe to recover from by deleting the
 * disposable index; anything else must propagate so the caller sees the
 * real cause instead of losing a perfectly valid index to a passing lock.
 */
const CORRUPTION_RESULT_CODES = new Set([
  11, // SQLITE_CORRUPT — malformed database image
  26, // SQLITE_NOTADB  — not a database file at all (includes "file is encrypted or is not a database")
]);

/** True only for a `node:sqlite` error whose primary result code names a corrupt/malformed file. */
function isCorruptionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const errcode = (error as Error & { errcode?: unknown }).errcode;
  if (typeof errcode !== 'number') return false;
  return CORRUPTION_RESULT_CODES.has(errcode & SQLITE_PRIMARY_CODE_MASK);
}

function tryOpen(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  try {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA busy_timeout = 3000;');

    // Read the schema version *before* applying the rest of `SCHEMA`. The
    // full `SCHEMA` string references `has_scope` (in `items` and in
    // `idx_items_scoped`) — running it against an existing, older-shaped
    // `items` table throws `no such column: has_scope`, because `CREATE
    // TABLE IF NOT EXISTS` is a no-op once the table already exists and
    // never adds the missing column. That would make every pre-v2 database
    // permanently unopenable: the version check, and the migration it
    // guards, would never be reached. So only `schema_version` — whose
    // shape never changes across versions — is created up front; `items`
    // is created (fresh db), recreated (older db), or left alone (current
    // db) only after the version has been read and acted on.
    db.exec(SCHEMA_VERSION_TABLE);
    const row = db.prepare('SELECT version FROM schema_version LIMIT 1').get() as
      { version: number } | undefined;

    if (!row) {
      // No recorded version. Usually a genuinely fresh file — but the old
      // code wrote `items`'s schema and the `schema_version` row as two
      // separate autocommits, so a crash between them leaves an on-disk
      // `items` in the pre-v2 shape with no version row at all. `DROP
      // TABLE IF EXISTS` is a no-op on a truly empty file (nothing to
      // drop) and closes that window on an interrupted-migration
      // survivor: the index is disposable, so discarding an unversioned
      // `items` table is the correct call, not a loss.
      db.exec('DROP TABLE IF EXISTS items;');
      db.exec(SCHEMA);
      db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
    } else if (row.version < SCHEMA_VERSION) {
      // Older schema. The index is a disposable cache of the Markdown, so
      // migration is discard-and-refill — but a column-adding change like
      // `has_scope` needs the table actually recreated: `CREATE TABLE IF
      // NOT EXISTS` is a no-op once `items` already exists with the old
      // columns, so a plain `DELETE FROM items` would leave the new column
      // missing. `ledger`, opened over the same file by a separate
      // connection, is untouched: it is session state and cannot be
      // recovered from files.
      db.exec('DROP TABLE IF EXISTS items;');
      db.exec(SCHEMA);
      db.prepare('UPDATE schema_version SET version = ?').run(SCHEMA_VERSION);
    } else if (row.version > SCHEMA_VERSION) {
      // Newer schema: cannot downgrade, must upgrade my_context. Nothing
      // beyond the version-agnostic `schema_version` table has been
      // touched at this point.
      throw new NewerSchemaError(
        `my_context: database schema version ${row.version} is newer than this code understands (${SCHEMA_VERSION}). ` +
        'Upgrade my_context or delete the index file to have it rebuilt.'
      );
    }
    // else: already current — `items` and its indexes were already applied
    // when this database was last written at this version.
    return db;
  } catch (error) {
    // Close the handle if initialization fails
    db.close();
    throw error;
  }
}

export class Store {
  #db: DatabaseSync;
  #closed = false;

  private constructor(db: DatabaseSync) {
    this.#db = db;
  }

  /**
   * The index is disposable by definition (see spec §5.2: "corrupting it
   * costs a rebuild and nothing else"). A genuine corruption failure — the
   * file itself is not a readable database, as opposed to the newer-schema
   * case above (never auto-deleted) or a transient lock/busy failure from a
   * concurrent process (also never auto-deleted: the database is perfectly
   * valid, just momentarily unavailable) — is recovered from automatically:
   * delete the database file (and its WAL/SHM siblings) and retry the open
   * exactly once. Without this, a corrupt index silences the plugin
   * permanently: every later session hits the same open failure with no way
   * for the user to know a rebuild would fix it. A lock/busy error is
   * re-thrown unchanged instead; the CLI/hook already fails open, so a busy
   * database yields empty output for that session rather than destroying a
   * valid index another process is using.
   */
  static open(dbPath: string, _retried = false): Store {
    try {
      return new Store(tryOpen(dbPath));
    } catch (error) {
      if (error instanceof NewerSchemaError) throw error;
      if (!isCorruptionError(error)) throw error;
      if (dbPath === ':memory:' || _retried) throw error;
      try {
        rmSync(dbPath, { force: true });
        rmSync(`${dbPath}-wal`, { force: true });
        rmSync(`${dbPath}-shm`, { force: true });
      } catch {
        // Could not clear the disposable index (e.g. dbPath is a directory,
        // or a permissions issue) — surface the original open failure
        // rather than a confusing secondary one.
        throw error;
      }
      return Store.open(dbPath, true);
    }
  }

  upsert(item: Item): void {
    this.#db.prepare(`
      INSERT INTO items (id, type, title, status, always, has_scope, layer, file_path, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type, title = excluded.title, status = excluded.status,
        always = excluded.always, has_scope = excluded.has_scope, layer = excluded.layer,
        file_path = excluded.file_path, data = excluded.data,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      item.id, item.type, item.title, item.status,
      item.always ? 1 : 0, item.scope.length > 0 ? 1 : 0,
      item.layer, item.filePath, JSON.stringify(item),
    );
  }

  get(id: string): Item | null {
    const row = this.#db.prepare('SELECT data FROM items WHERE id = ?').get(id) as
      { data: string } | undefined;
    return row ? (JSON.parse(row.data) as Item) : null;
  }

  all(): Item[] {
    const rows = this.#db.prepare('SELECT data FROM items ORDER BY id').all() as
      { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as Item);
  }

  /**
   * Active items that declare at least one scope glob — the only rows the JIT
   * hook can possibly inject. Deserializing the whole corpus on every Read
   * would not fit the 50ms budget.
   */
  activeScoped(): Item[] {
    const rows = this.#db.prepare(
      "SELECT data FROM items WHERE status = 'active' AND has_scope = 1 ORDER BY id",
    ).all() as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as Item);
  }

  /** Every indexed id, without deserializing any bodies. */
  ids(): string[] {
    const rows = this.#db.prepare('SELECT id FROM items ORDER BY id').all() as { id: string }[];
    return rows.map((r) => r.id);
  }

  deleteByLayer(layer: Layer): void {
    this.#db.prepare('DELETE FROM items WHERE layer = ?').run(layer);
  }

  /**
   * Run `fn` inside a single transaction. Without this, each statement
   * commits (and WAL-flushes) individually — fine for a handful of writes,
   * but on the hundreds of upserts a full rebuild performs, per-statement
   * fsync overhead dominates: ~1s for 500 items versus ~30ms batched.
   * Rolls back and rethrows on failure, so a caller mid-transaction never
   * observes a half-applied rebuild.
   */
  transaction<T>(fn: () => T): T {
    this.#db.exec('BEGIN');
    try {
      const result = fn();
      this.#db.exec('COMMIT');
      return result;
    } catch (err) {
      this.#db.exec('ROLLBACK');
      throw err;
    }
  }

  close(): void {
    if (!this.#closed) {
      this.#db.close();
      this.#closed = true;
    }
  }
}
