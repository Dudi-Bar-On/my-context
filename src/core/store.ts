import { rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { sleepMs } from './sleep.ts';
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
CREATE INDEX IF NOT EXISTS idx_items_active_type ON items(status, type);
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
 * file — which discards not just the disposable `items` cache but also
 * whatever `ledger` rows it held, see the note on `Store.open` — anything
 * else must propagate so the caller sees the real cause instead of losing a
 * perfectly valid database to a passing lock.
 */
const CORRUPTION_RESULT_CODES = new Set([
  11, // SQLITE_CORRUPT — malformed database image
  26, // SQLITE_NOTADB  — not a database file at all (includes "file is encrypted or is not a database")
]);

/**
 * True only for a `node:sqlite` error whose primary result code names a
 * corrupt/malformed file — the sole gate on `Store.open`'s delete-the-file
 * self-heal.
 *
 * Exported for testing on purpose. Exercising it only THROUGH `Store.open`
 * proved nothing: adding `5` (SQLITE_BUSY) to `CORRUPTION_RESULT_CODES`
 * routes a merely-busy database straight into the unlink path, and the test
 * that was supposed to catch that stayed green — because on Windows `rmSync`
 * of a file another connection holds open fails with `EPERM`, so the OS,
 * not this code, prevented the catastrophe. On `ubuntu-latest` the unlink
 * would have succeeded and destroyed a live index. The predicate has to be
 * asserted directly.
 */
export function isCorruptionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const errcode = (error as Error & { errcode?: unknown }).errcode;
  if (typeof errcode !== 'number') return false;
  return CORRUPTION_RESULT_CODES.has(errcode & SQLITE_PRIMARY_CODE_MASK);
}

/**
 * How patient one `Store.open` is with a database another process holds:
 * how long each SQLite statement waits for the write lock (`busy_timeout`),
 * and how many times the whole open is retried when that wait is exhausted.
 *
 * Two named profiles instead of one hardcoded policy, because the right
 * patience depends on who is waiting. The MCP server and the CLI serve a
 * caller who asked for the operation and would rather wait seconds than get
 * a refusal — they keep `DEFAULT_OPEN_PROFILE`. The hooks serve a session
 * that did not ask and must not be stalled: `hooks.json` kills a hook at
 * 10s, so a policy whose worst case exceeds that (the default's is ~15–23s,
 * measured at 16.9s under a held write lock) does not even buy the retries
 * it stalls for — the process dies mid-wait and the injection vanishes with
 * no disclosure at all. `HOOK_OPEN_PROFILE` bounds the whole contended open
 * to ~1s so the hook survives to fail open and SAY SO (see `buildInjection`'s
 * catch). E4 in docs/ROADMAP.md is the record of this decision.
 *
 * `busyTimeoutMs` also governs every later statement on the returned
 * connection — a hook's `rebuild` transaction fails after ~500ms under
 * contention rather than 3000ms, which is intended: the hook's correct move
 * on ANY contention is to fail open fast and disclose, not to win the lock.
 */
export interface OpenProfile {
  busyTimeoutMs: number;
  attempts: number;
}

export const DEFAULT_OPEN_PROFILE: OpenProfile = { busyTimeoutMs: 3000, attempts: 5 };

/** Worst case ~1.06s: two attempts × 500ms busy wait, plus the 20ms+40ms backoff. */
export const HOOK_OPEN_PROFILE: OpenProfile = { busyTimeoutMs: 500, attempts: 2 };

/**
 * Whether this failure is SQLite's "another connection holds the lock" —
 * the one class of open/write error that is worth retrying, and the one
 * class the hook path turns into a disclosure instead of silence. One
 * spelling of the predicate; `withRetry` (mutate.ts) predates it and keeps
 * its own inline copy.
 */
export function isBusyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /busy|locked/i.test(message);
}

function tryOpen(dbPath: string, busyTimeoutMs: number): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  try {
    // busy_timeout must be set FIRST, and journal_mode must be set before
    // any transaction begins below — journal mode cannot be changed inside
    // a transaction, so this ordering is load-bearing, not cosmetic.
    //
    // Setting busy_timeout here does NOT make the WAL transition on the
    // next line wait out a concurrent opener, despite what an earlier
    // version of this comment claimed: SQLite does not invoke the busy
    // handler for a rollback-journal-to-WAL transition, so a second
    // process opening this file while a first is mid-transition gets an
    // immediate `database is locked`, busy_timeout notwithstanding. That
    // failure is real and was reproduced under concurrent first-open load;
    // `Store.open` retries the whole `tryOpen` call to cover it — see the
    // note there. Once the file is already WAL (i.e. every open after the
    // first), this pragma is a no-op and the window doesn't exist.
    db.exec(`PRAGMA busy_timeout = ${busyTimeoutMs};`);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');

    // schema_version is created up front, outside the transaction below,
    // because its shape never changes across versions and reading it is
    // what decides whether a transaction is even needed to touch `items`.
    db.exec(SCHEMA_VERSION_TABLE);

    // The read of schema_version and the DDL/DML it decides on must commit
    // as a single atomic unit. Without this, two processes opening the
    // same fresh (or stale-schema) database at the same moment each
    // independently see "no row" / "stale row" — `BEGIN`/`COMMIT` were not
    // wrapping the SELECT, only statements after it — and each runs its
    // own `DROP TABLE items`, so one process's DROP can land while a
    // *different*, already-open process is mid-rebuild against the same
    // table: that connection sees `no such table: items`, not a lock
    // error, so it doesn't get a bounded wait — it fails outright. Worse,
    // both processes' `INSERT INTO schema_version` can both succeed,
    // leaving two duplicate version rows silently forever (schema_version
    // has no primary key), which `SELECT ... LIMIT 1` masks from view.
    //
    // `BEGIN IMMEDIATE` (rather than a plain `BEGIN`, which defers taking
    // the write lock until the first write statement) takes the write lock
    // up front, before the SELECT — so a second process's `BEGIN
    // IMMEDIATE` blocks here until the first commits or rolls back
    // (covered by the ordinary `busy_timeout` wait, which — unlike the WAL
    // pragma above — SQLite does honour for this), then reads the
    // already-committed version and takes the "already current" branch
    // instead of racing a DROP against it. That ordering — write lock
    // before the read — is what makes the check-then-act atomic; it is
    // defense-in-depth and clarity of intent, not a measured performance
    // win over a plain `BEGIN` — under concurrent first-open load, retry
    // counts for both forms vary run to run and neither reliably beats the
    // other, so nothing here should be read as a claim about retry counts.
    // SQLite DDL is transactional, so DROP/CREATE/INSERT within this block
    // either all land or all roll back; no connection can ever observe
    // `items` mid-drop.
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = db.prepare('SELECT version FROM schema_version LIMIT 1').get() as
        { version: number } | undefined;

      if (!row) {
        // No recorded version. Usually a genuinely fresh file — but the old
        // code wrote `items`'s schema and the `schema_version` row as two
        // separate autocommits, so a crash between them leaves an on-disk
        // `items` in the pre-v2 shape with no version row at all. `DROP
        // TABLE IF EXISTS` is a no-op on a truly empty file (nothing to
        // drop) and closes that window on an interrupted-migration
        // survivor: the `items` table is a disposable cache of the Markdown,
        // so discarding an unversioned one is the correct call, not a loss.
        // (The `ledger` table living in the same file is not disposable — see
        // the note on `Store.open` — but this branch never touches it.)
        db.exec('DROP TABLE IF EXISTS items;');
        db.exec(SCHEMA);
        db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
      } else if (row.version < SCHEMA_VERSION) {
        // Older schema. `items` is a disposable cache of the Markdown, so its
        // migration is discard-and-refill — but a column-adding change like
        // `has_scope` needs the table actually recreated: `CREATE TABLE IF
        // NOT EXISTS` is a no-op once `items` already exists with the old
        // columns, so a plain `DELETE FROM items` would leave the new column
        // missing. `ledger`, opened over the same file by a separate
        // connection, is untouched here: it is session state, not a Markdown
        // cache, and cannot be recovered from files — see the note on
        // `Store.open` for what that costs when the whole file is deleted
        // instead. This branch has the same fresh-open race as the `!row`
        // one above, with a larger blast radius: it fires on an
        // *established* workspace whenever several processes open at once
        // right after a plugin upgrade, which is exactly when it's most
        // likely several processes open close together — hence it gets the
        // same `BEGIN IMMEDIATE` protection, not just the fresh-db case.
        db.exec('DROP TABLE IF EXISTS items;');
        db.exec(SCHEMA);
        db.prepare('UPDATE schema_version SET version = ?').run(SCHEMA_VERSION);
      } else if (row.version > SCHEMA_VERSION) {
        // Newer schema: cannot downgrade, must upgrade my_context. Nothing
        // beyond the version-agnostic `schema_version` table has been
        // touched at this point.
        throw new NewerSchemaError(
          `my_context: database schema version ${row.version} is newer than this code understands (${SCHEMA_VERSION}). ` +
          'Upgrade my_context, or delete the index file to have it rebuilt — deleting it rebuilds ' +
          'the item index from Markdown, but permanently discards this session\'s injection ' +
          'history and any pending compaction-restore state, neither of which can be recovered ' +
          'from Markdown.'
        );
      }
      // else: already current — `items` and its indexes were already applied
      // when this database was last written at this version.
      db.exec('COMMIT');
    } catch (error) {
      // A failure inside the transaction (including the NewerSchemaError
      // thrown above) must roll back before propagating, or the connection
      // is left mid-transaction and every later statement on it — including
      // the close below — fails too.
      try { db.exec('ROLLBACK'); } catch { /* no transaction is active */ }
      throw error;
    }
    return db;
  } catch (error) {
    // Close the handle if initialization fails
    db.close();
    throw error;
  }
}

/**
 * Retry the whole `tryOpen` call when it fails with a lock/busy error.
 * `busy_timeout` (set inside `tryOpen`) covers ordinary contention on
 * statements after the WAL pragma, but not the WAL transition itself —
 * SQLite does not invoke the busy handler for that operation, so a second
 * process opening the same file while a first is mid-transition gets an
 * immediate `database is locked` no matter how high `busy_timeout` is set.
 * That window exists only on a database's first-ever open (every open
 * after that finds the file already in WAL mode, making the pragma a
 * no-op), which is exactly the moment several processes are most likely to
 * open at once — a fresh workspace with no `.index.db` yet.
 *
 * Deliberately separate from `Store.open`'s corruption self-heal below: a
 * busy database is perfectly valid and must never be deleted, only waited
 * out. Mixing the two would risk destroying another process's live index
 * over what is actually just a passing lock.
 *
 * Worst-case duration is NOT the ~200ms the sleeps alone suggest. The
 * backoff (20ms × attempt) is only the time spent between attempts; each
 * attempt can itself block for the full `busyTimeoutMs` set inside `tryOpen`
 * before failing, so the real bound is roughly attempts × busyTimeoutMs plus
 * change — ~15–23s for `DEFAULT_OPEN_PROFILE` (acceptable for a caller who
 * asked and is waiting on the answer), ~1s for `HOOK_OPEN_PROFILE` (the most
 * a hook is allowed to cost a session that did not ask; measured 16.9s under
 * a held write lock before the profiles existed — see `OpenProfile`).
 */
function openWithBusyRetry(dbPath: string, profile: OpenProfile): DatabaseSync {
  for (let attempt = 0; attempt < profile.attempts; attempt++) {
    try {
      return tryOpen(dbPath, profile.busyTimeoutMs);
    } catch (error) {
      if (!isBusyError(error) || attempt === profile.attempts - 1) throw error;
      sleepMs(20 * (attempt + 1));
    }
  }
  // Unreachable: the loop above always either returns or throws.
  throw new Error('my_context: openWithBusyRetry exhausted without throwing.');
}

export class Store {
  #db: DatabaseSync;
  #closed = false;

  private constructor(db: DatabaseSync) {
    this.#db = db;
  }

  /**
   * The `items` table this class owns is disposable by definition (see spec
   * §5.2: "corrupting it costs a rebuild and nothing else") — but the
   * `ledger` table (owned by `Ledger`, in `ledger.ts`) lives in the same
   * physical file, and that table is NOT disposable: it is this session's
   * injection history and compaction-restore state, and none of it can be
   * rebuilt from Markdown. The self-heal below still deletes the whole file
   * on genuine corruption, because a corrupt file already can't serve
   * either table — but callers and users should understand that recovery
   * here costs ledger state, not just an index rebuild.
   *
   * A genuine corruption failure — the file itself is not a readable
   * database, as opposed to the newer-schema case above (never
   * auto-deleted) or a transient lock/busy failure from a concurrent
   * process (also never auto-deleted: the database is perfectly valid, just
   * momentarily unavailable) — is recovered from automatically: delete the
   * database file (and its WAL/SHM siblings) and retry the open exactly
   * once. Without this, a corrupt index silences the plugin permanently:
   * every later session hits the same open failure with no way for the user
   * to know a rebuild would fix it. A lock/busy error is re-thrown
   * unchanged instead; the CLI fails open, and the SessionStart path
   * discloses the contention in its output and in the audit log (see
   * `buildInjection`'s catch) rather than destroying a valid index (and
   * ledger) another process is using.
   *
   * `profile` decides how patiently the open waits out that contention —
   * see `OpenProfile`. Hooks pass `HOOK_OPEN_PROFILE`; everything else
   * takes the default.
   */
  static open(dbPath: string, profile: OpenProfile = DEFAULT_OPEN_PROFILE, _retried = false): Store {
    try {
      return new Store(openWithBusyRetry(dbPath, profile));
    } catch (error) {
      if (error instanceof NewerSchemaError) throw error;
      if (!isCorruptionError(error)) throw error;
      if (dbPath === ':memory:' || _retried) throw error;
      try {
        rmSync(dbPath, { force: true });
        rmSync(`${dbPath}-wal`, { force: true });
        rmSync(`${dbPath}-shm`, { force: true });
      } catch {
        // Could not clear the file (e.g. dbPath is a directory, or a
        // permissions issue) — surface the original open failure rather
        // than a confusing secondary one. Note that a successful clear here
        // discards not just the disposable `items` cache but also whatever
        // `ledger` rows the file held; see the note on `Store.open`.
        throw error;
      }
      return Store.open(dbPath, profile, true);
    }
  }

  /**
   * A connection that SQLite refuses to write THROUGH — to the tables in the
   * file this opened. That is narrower than "cannot write at all", and the
   * gap is not theoretical: `VACUUM INTO '<any path>'` runs successfully on a
   * connection opened with `{ readOnly: true }` and writes a full copy of the
   * database to a filesystem path of the caller's choosing. For that one
   * statement (and anything else that targets a *different* file rather than
   * this one — an `ATTACH`ed database is the other shape of the same gap,
   * though attaching itself currently fails on this engine) `assertSelectOnly`
   * in `query.ts` is the thing actually stopping the write, not this
   * connection. Do not treat `readOnly: true` as a blanket guarantee against
   * every write a statement could perform; it guarantees only that the
   * `items`/`ledger`/`schema_version` tables in `dbPath` itself cannot be
   * mutated through it.
   *
   * Deliberately runs no DDL: creating the schema would itself be a write to
   * this file. Callers must have opened and closed a writable connection
   * first, both so the read reflects a fresh rebuild and so that close
   * checkpoints the WAL — see `cmdQuery`'s comment on that ordering, and its
   * caveat that "cannot recover a WAL" is not something this code has
   * actually verified to be true.
   */
  static openReadOnly(dbPath: string): Store {
    return new Store(new DatabaseSync(dbPath, { readOnly: true }));
  }

  /**
   * Whether the engine refuses a write through this connection — asked of the
   * engine, not remembered from how the connection was opened.
   *
   * The probe is a `CREATE TABLE` inside a transaction that is always rolled
   * back. `BEGIN IMMEDIATE` was tried first and is NOT usable here: measured on
   * this engine, it succeeds on a `{ readOnly: true }` connection, so the
   * refusal does not arrive until a statement actually writes a page. The
   * rollback is what keeps the probe side-effect-free — verified by execution:
   * after running it on a writable connection, `sqlite_master` holds only the
   * pre-existing tables.
   *
   * **What a `true` here does and does not mean.** It means one write was
   * refused. The other reason a write is refused is `SQLITE_BUSY` — a
   * concurrent writer holding the lock — and this getter does not distinguish
   * the two, so it is not a liveness check and nothing at runtime decides
   * anything on it. It exists so a test can assert, of the connection a
   * command actually opened, that writing through it is refused;
   * `test/cli/query-readonly-pin.test.ts` is the only caller, and it has no
   * concurrent writer. It also must not be called from inside `transaction`,
   * whose `BEGIN` is already open.
   *
   * It is narrower than "cannot write at all", for the reason set out on
   * `openReadOnly`: `VACUUM INTO` writes to a path the caller names, never to
   * this file.
   */
  get isReadOnly(): boolean {
    try {
      this.#db.exec('BEGIN');
      this.#db.exec('CREATE TABLE __mycontext_write_probe (x)');
    } catch {
      try { this.#db.exec('ROLLBACK'); } catch { /* the BEGIN itself may not have taken */ }
      return true;
    }
    this.#db.exec('ROLLBACK');
    return false;
  }

  /** Arbitrary SELECT. Callers are responsible for validating the SQL. */
  raw(sql: string): Record<string, unknown>[] {
    const rows = this.#db.prepare(sql).all() as Record<string, unknown>[];
    // node:sqlite yields null-prototype objects; spread them so callers can
    // treat rows as ordinary objects (JSON.stringify, deepEqual, Object.keys).
    return rows.map((row) => ({ ...row }));
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
   * Active items in the given types — the only rows the JIT hook can possibly
   * inject. Callers pass the enabled NORMATIVE category names, because the JIT
   * tier injects nothing else (`select`'s `isNormative` filter).
   *
   * The filter is by type, not by scope. An unscoped item is unrestricted and
   * therefore JIT-eligible on every path (see `matchesScope`), so a
   * `has_scope = 1` predicate here would silently re-impose the old
   * inert-by-default rule below `select` and make its inversion a no-op in
   * production. The type filter is what keeps the cost off the whole corpus:
   * deserializing every row on every Read would not fit the 50ms budget, and
   * the rationale tier — the bulk of a mature corpus — never JIT-injects.
   *
   * An empty `types` array selects nothing, which is correct: no enabled
   * normative category means nothing is JIT-injectable at all.
   */
  activeInjectable(types: string[]): Item[] {
    if (types.length === 0) return [];
    const placeholders = types.map(() => '?').join(', ');
    const rows = this.#db.prepare(
      `SELECT data FROM items WHERE status = 'active' AND type IN (${placeholders}) ORDER BY id`,
    ).all(...types) as { data: string }[];
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
      // BEGIN runs outside this try, so a BEGIN failure is not what this
      // guard is for — it propagates directly, before any transaction
      // exists to roll back. The guard is for `fn()` or COMMIT failing via
      // a SQLite error (e.g. SQLITE_BUSY, SQLITE_FULL) that causes SQLite
      // to implicitly roll back the transaction itself: at that point
      // there is no longer an active transaction for our explicit ROLLBACK
      // to act on, so it throws "no transaction is active" and would mask
      // the real cause (`err`) if left unguarded.
      try { this.#db.exec('ROLLBACK'); } catch { /* no transaction to roll back */ }
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
