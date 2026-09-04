import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  closeSync, mkdirSync, openSync, readdirSync, readFileSync, readSync,
  renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { retryOnTransientFsError } from './rebuild.ts';
import { readSessionNames } from './session-names.ts';

export type LedgerTier = 'pinned' | 'jit' | 'restored';

export interface LedgerEntry {
  itemId: string;
  tier: LedgerTier;
  injectedAt: string;
}

export interface Usage {
  itemId: string;
  useCount: number;
  lastUsed: string | null;
}

/**
 * One recorded injection, as `history()` returns it. `LedgerEntry` is the
 * same row minus `session_id`, because `entries()` is already scoped to one
 * session; this one spans sessions, so it has to carry the id.
 */
export interface InjectionEvent {
  sessionId: string;
  itemId: string;
  tier: LedgerTier;
  injectedAt: string;
}

/** One session's row in `sessionSummaries()`. */
export interface SessionSummary {
  sessionId: string;
  lastInjectedAt: string;
  itemCount: number;
  /**
   * The name `mycontext session name` gave this session, or `null` when nobody
   * named it — owner ruling 12.
   *
   * **`null` and never a fallback.** `core/continuity.ts` ·
   * `function labelFor(root: string, sessionId: string): string {` · ~200 derives
   * a label — the name, or the short prefix — because it has to print ONE string
   * into an injected block. This is a read model, and the picker draws the short
   * id in its own column beside this one: substituting the prefix here would
   * hand every surface a `name` that cannot be told from a real one.
   */
  name: string | null;
}

/**
 * `injected_at` is a value, not part of the key: a repeat injection a
 * millisecond later must collide, or once-per-session dedupe never fires.
 * `tier` is part of the key because pinned-then-restored is two real events.
 */
const LEDGER_SCHEMA = `
CREATE TABLE IF NOT EXISTS ledger (
  session_id  TEXT NOT NULL,
  item_id     TEXT NOT NULL,
  tier        TEXT NOT NULL,
  injected_at TEXT NOT NULL,
  PRIMARY KEY (session_id, item_id, tier)
);

CREATE INDEX IF NOT EXISTS idx_ledger_session ON ledger(session_id);
CREATE INDEX IF NOT EXISTS idx_ledger_item    ON ledger(item_id);

CREATE TABLE IF NOT EXISTS ledger_source (
  file  TEXT PRIMARY KEY,
  bytes INTEGER NOT NULL
) WITHOUT ROWID;
`;

/**
 * The ledger tables this file owns, and the columns each one declares. Read
 * by exactly one thing — `Ledger.openReadOnlyChecked` — because on a read
 * path this shape IS the version; see that method for why there is no
 * version number to compare instead.
 */
const LEDGER_TABLE_COLUMNS: [string, string[]][] = [
  ['ledger', ['session_id', 'item_id', 'tier', 'injected_at']],
  ['ledger_source', ['file', 'bytes']],
];

/**
 * The database is a real database and holds NO ledger tables at all: nothing
 * has ever been injected in this corpus. A legitimate empty state, not a
 * fault — a fresh corpus reaches exactly this, because `Store.open` creates
 * `schema_version` and `items` while the `ledger`/`ledger_source` tables are
 * created by `Ledger.open`, which no hook has run yet.
 *
 * It carries its own class for the same reason `store.ts` gives
 * `NewerSchemaError` one: so a caller can tell this state from damage
 * WITHOUT matching on a message. Collapsing the two is the failure
 * `INV-nothing-is-dropped-silently` forbids in both directions at once —
 * refusing to start against a fresh corpus, or reporting an empty ledger
 * where the file is actually broken.
 */
export class LedgerUninitializedError extends Error {}

export class Ledger {
  #db: DatabaseSync;
  #closed = false;

  private constructor(db: DatabaseSync) {
    this.#db = db;
  }

  /**
   * Unlike `Store.open`, this has no corruption self-heal and does not set
   * `journal_mode = WAL` — it relies on `Store.open` having already been
   * called first against the same `dbPath` in this process. Every
   * production caller (`pre-tool-use.ts`, `session-start.ts`,
   * `pre-compact.ts`) opens the `Store` before the `Ledger`, which is the
   * only reason a corrupt `.index.db` is survivable here: `Store.open`'s
   * self-heal already deleted-and-recreated it by the time `Ledger.open`
   * runs. A `Ledger`-only caller against a corrupt file gets an
   * unrecoverable throw here instead, and would create the database file in
   * rollback-journal mode rather than WAL. See `test/core/ledger.test.ts`
   * ("Ledger.open alone against a corrupt file throws" and "the same
   * corrupt file is survivable for Ledger once Store.open has run first")
   * for the pinned behaviour this depends on.
   */
  /**
   * `busyTimeoutMs` mirrors `OpenProfile.busyTimeoutMs` on `Store.open`, for
   * the same reason and with the same default: a hook must not wait 3s per
   * statement for a lock it should fail open against — hook callers pass
   * `HOOK_OPEN_PROFILE.busyTimeoutMs`, everything else takes the default.
   */
  static open(dbPath: string, busyTimeoutMs = 3000): Ledger {
    const db = new DatabaseSync(dbPath);
    try {
      db.exec(`PRAGMA busy_timeout = ${busyTimeoutMs};`);
      db.exec(LEDGER_SCHEMA);
    } catch (error) {
      // Close the handle if initialization fails, or it is orphaned: never
      // returned to a caller who could close it, never closed by us either.
      db.close();
      throw error;
    }
    return new Ledger(db);
  }

  /**
   * A read-only, shape-checked door onto the ledger tables — the `Ledger`
   * half of the pair `store.ts` already ships as
   * `Store.openReadOnly`/`Store.openReadOnlyChecked`, for a caller (the web
   * UI, per web-UI plan 1) that must READ injection history through a
   * connection the engine refuses to write through.
   *
   * **Why a second door and not the existing one.** `Ledger.open` is itself
   * a WRITE: it runs `db.exec(LEDGER_SCHEMA)` on every open — `CREATE TABLE
   * IF NOT EXISTS ledger`, `ledger_source`, and two indexes. Opening a
   * `Ledger` *is* a schema write, so a read path that swapped only its
   * `Store.open` call for `Store.openReadOnlyChecked` would still hand out a
   * writable ledger connection creating tables in a database nothing
   * prepared. That is why "the UI opens read-only" was unsatisfiable, rather
   * than merely unimplemented, until this existed.
   *
   * **`Ledger.open`'s `Store.open`-first prerequisite does not apply here,
   * and NEITHER HALF of it does.** That prerequisite exists only to make a
   * WRITABLE ledger safe: (a) `Store.open`'s corruption self-heal must have
   * deleted-and-recreated a corrupt file first, because `Ledger.open` has no
   * self-heal of its own; and (b) `Store.open` must have set
   * `journal_mode = WAL` first, because `Ledger.open` CREATES a missing
   * database and would create it in rollback-journal mode. A read-only
   * connection can commit neither error. It cannot create a database at all
   * — an absent path throws `SQLITE_CANTOPEN` and leaves nothing behind
   * (pinned by a test) — so there is no journal mode for it to get wrong.
   * And throwing on a corrupt file is the CORRECT answer for a read path
   * rather than something to heal: a reader cannot know a "malformed" report
   * is corruption rather than its own read-only view of a mid-write moment,
   * which is the same reasoning `Store.openReadOnlyChecked` gives for never
   * triggering the self-heal.
   *
   * **What "checked" verifies, given there is no version to compare.**
   * `Store.openReadOnlyChecked` compares `schema_version` against
   * `SCHEMA_VERSION` — but that row is Store's, covering `items`, and
   * `store.ts` says so explicitly while noting that the `ledger` table is
   * owned by this file though it lives in the same database. **The ledger
   * tables carry no version of their own, so there is nothing to compare and
   * the check is existence and SHAPE instead:** both `ledger` and
   * `ledger_source` present in `sqlite_master`, each declaring EXACTLY the
   * columns `LEDGER_SCHEMA` gives it. The shape is the only version there
   * is, which is why an extra column is refused rather than tolerated —
   * `Store.openReadOnlyChecked` refuses a version differing in EITHER
   * direction, and a column this build does not read is a different writer's
   * schema by the only evidence available.
   *
   * **What it does NOT verify, said rather than implied.** Not the primary
   * key `(session_id, item_id, tier)` — load-bearing for what the rows MEAN
   * (see `history()`) but not for whether these reads run. Not the two
   * indexes: a missing one costs speed, not correctness. Not column types,
   * which SQLite does not enforce anyway. Not row-level sanity — a ledger
   * holding nonsense rows is indistinguishable here from one holding real
   * ones. And not that the file is a my_context index at all: that is
   * `schema_version`, which belongs to `Store.openReadOnlyChecked`. A caller
   * wanting both facts opens both doors, as web-UI plan 1's `withStores`
   * does.
   *
   * **The three outcomes, kept apart on purpose.** A healthy corpus returns
   * a `Ledger`. A corpus whose ledger projection has **not been
   * built** is a perfectly healthy database with no ledger tables, and throws
   * `LedgerUninitializedError` — an empty state, not a fault, marked by
   * CLASS so it is never told from damage by a message. Everything else — a
   * corrupt or truncated file, an absent one, half a ledger, a shape this
   * build does not read — throws an ordinary `Error`, or the engine's own.
   * Half a ledger is deliberately in the second group: one table present and
   * one missing is damage, and reporting it as "nothing was ever injected"
   * would be the silent drop.
   *
   * **No `busy_timeout` is set** — the same call `Store.openReadOnlyChecked`
   * makes, and its measurement transfers exactly rather than by analogy: the
   * 18,300 contended read-only trials in which the busy handler never fired
   * [P6/P6b] were run against THIS FILE, since `items` and `ledger` share one
   * `.index.db`. `Ledger.open`'s `busyTimeoutMs` parameter exists for the
   * write path — a hook that must fail open in ~1s rather than wait 3s per
   * statement for a lock — and a connection that takes no write lock has
   * nothing to wait for. If contention ever does surface here it arrives as
   * an immediate throw, which is what a read door wants: the caller discloses
   * a failure instead of stalling on one.
   *
   * There is deliberately **no unchecked `Ledger.openReadOnly`** beside this.
   * `Store` exports one because `cmdQuery` and `pre-compact.ts` genuinely
   * call it; nothing calls an unchecked ledger open, this method does not
   * need one as a step (every check runs on the `DatabaseSync` before the
   * `Ledger` wrapper exists), and an exported door that skips the check is a
   * hole in an API whose entire purpose is that it cannot write.
   */
  static openReadOnlyChecked(dbPath: string): Ledger {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      // Positive evidence that this is a database, before "no tables" is
      // allowed to mean "nothing has ever been injected". A zero-length file
      // is a VALID empty SQLite database — it opens, and `sqlite_master` is
      // simply empty (verified) — so absence of tables alone cannot tell a
      // prepared corpus from a file truncated to nothing, and reporting
      // damage as an empty ledger is the failure this door exists to avoid.
      const pages = db.prepare('PRAGMA page_count').get() as
        { page_count?: number } | undefined;
      if (pages === undefined || Number(pages.page_count) === 0) {
        throw new Error(
          `my_context: ${dbPath} holds no database pages at all — an empty or truncated file, ` +
          'not a corpus whose ledger is empty. A read-only caller never repairs it.',
        );
      }

      const present: string[] = [];
      const missing: string[] = [];
      for (const [table] of LEDGER_TABLE_COLUMNS) {
        const row = db.prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        ).get(table) as { name: string } | undefined;
        (row === undefined ? missing : present).push(table);
      }

      if (present.length === 0) {
        throw new LedgerUninitializedError(
          `my_context: ${dbPath} has no ledger tables yet — nothing has ever been injected in ` +
          'this corpus. They are created by `Ledger.open`, which is a write, and a read-only ' +
          'caller never creates them. This is an empty state, not a damaged database.',
        );
      }
      if (missing.length > 0) {
        throw new Error(
          `my_context: ${dbPath} has ${present.join(', ')} but not ${missing.join(', ')}. ` +
          'Half a ledger is damage, not the not-yet-projected empty state, and this open refuses ' +
          'to report it as one.',
        );
      }

      for (const [table, columns] of LEDGER_TABLE_COLUMNS) {
        const actual = (db.prepare('SELECT name FROM pragma_table_info(?)').all(table) as
          { name: string }[]).map((r) => r.name).sort().join(', ');
        const expected = [...columns].sort().join(', ');
        if (actual !== expected) {
          throw new Error(
            `my_context: ${dbPath} declares ${table}(${actual}) where this build reads ` +
            `${table}(${expected}). The ledger tables carry no schema_version, so their shape ` +
            'is the only version there is, and a read-only caller never migrates.',
          );
        }
      }

      return new Ledger(db);
    } catch (error) {
      // The handle is CLOSED before the throw escapes — what `Ledger.open`
      // above does, and `openProjection`'s `fresh()` (audit-db.ts, which
      // cites `Ledger.open` for it), and for the sharper Windows reason that
      // file gives: an open handle PINS the file, so a leaked one blocks the
      // writer that would repair or replace it.
      try { db.close(); } catch { /* nothing usable to close */ }
      throw error;
    }
  }

  /**
   * Run `fn` inside a single transaction, mirroring `Store.transaction`.
   * Rolls back and rethrows on failure. `BEGIN` itself runs outside the
   * guarded `try`, so a `BEGIN` failure is not what the inner guard is
   * for — it propagates directly, before any transaction exists to roll
   * back. The guard is for the case where `fn()` or `COMMIT` fails via a
   * SQLite error (e.g. `SQLITE_BUSY`, `SQLITE_FULL`) that causes SQLite to
   * implicitly roll back the transaction itself: at that point there is no
   * longer an active transaction for our explicit `ROLLBACK` to act on, so
   * it throws "no transaction is active" and would mask the real cause if
   * left unguarded.
   */
  #transaction<T>(fn: () => T): T {
    this.#db.exec('BEGIN');
    try {
      const result = fn();
      this.#db.exec('COMMIT');
      return result;
    } catch (err) {
      try { this.#db.exec('ROLLBACK'); } catch { /* no transaction to roll back */ }
      throw err;
    }
  }

  /** True when this is the first time the item was injected in this session and tier. */
  record(
    sessionId: string, itemId: string, tier: LedgerTier,
    at: string = new Date().toISOString(),
  ): boolean {
    const result = this.#db.prepare(`
      INSERT INTO ledger (session_id, item_id, tier, injected_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(session_id, item_id, tier) DO NOTHING
    `).run(sessionId, itemId, tier, at);
    return Number(result.changes) > 0;
  }

  /** Records a batch in one transaction. Returns only the ids newly inserted. */
  recordMany(
    sessionId: string, itemIds: string[], tier: LedgerTier,
    at: string = new Date().toISOString(),
  ): string[] {
    return this.#transaction(() => {
      const inserted: string[] = [];
      for (const id of itemIds) {
        if (this.record(sessionId, id, tier, at)) inserted.push(id);
      }
      return inserted;
    });
  }

  /**
   * Records the `restored` tier, refreshing `injected_at` on conflict
   * instead of leaving it alone as `record` does. `record`'s
   * insert-or-ignore is right for a first-seen marker, but a restored row's
   * timestamp isn't that — it's an *identity marker*: the caller stamps it
   * with the triggering snapshot's own `capturedAt` and later compares for
   * EQUALITY against a snapshot's `capturedAt` (see session-start.ts) to
   * tell "the same compaction, fired again" (must not re-inject) from "a
   * later, distinct compaction, with its own different `capturedAt`" (must
   * re-inject).
   *
   * The refresh is what lets the marker move to a new generation. Without
   * it (i.e. using `record`'s insert-or-ignore instead), the row would stay
   * pinned at whichever `capturedAt` first wrote it forever: when a later,
   * distinct compaction restores the same item, the row would still equal
   * the OLD `capturedAt`, never the new one — so every firing of the NEW
   * compaction, not just a doubled one, would wrongly see the item as not
   * yet restored for it and re-inject indefinitely. Refreshing on every
   * restore call keeps the row's stamp equal to whichever compaction most
   * recently restored it, which is exactly what the equality comparison
   * needs: idempotent within one compaction (repeat firings write the same
   * stamp, so they keep matching) and correct across compactions (a new
   * one's firing moves the stamp forward, so it stops matching the old
   * generation and starts matching the new one).
   */
  recordRestored(sessionId: string, itemIds: string[], at: string = new Date().toISOString()): void {
    if (itemIds.length === 0) return;
    const stmt = this.#db.prepare(`
      INSERT INTO ledger (session_id, item_id, tier, injected_at)
      VALUES (?, ?, 'restored', ?)
      ON CONFLICT(session_id, item_id, tier) DO UPDATE SET injected_at = excluded.injected_at
    `);
    this.#transaction(() => {
      for (const id of itemIds) stmt.run(sessionId, id, at);
    });
  }

  /** Every item id this session has already been shown, in any tier. */
  seen(sessionId: string): string[] {
    const rows = this.#db.prepare(
      'SELECT DISTINCT item_id FROM ledger WHERE session_id = ? ORDER BY item_id',
    ).all(sessionId) as { item_id: string }[];
    return rows.map((r) => r.item_id);
  }

  /**
   * Every row this session has, one per `(item, tier)` first delivered —
   * `record`'s `ON CONFLICT DO NOTHING` is what makes this table already the
   * distinct-delivery view `core/context-share.ts` needs for the myctx share
   * (`TASK-myctx-sums-every-injection-ever-made-instead-of-what-is`,
   * 2026-09-04). That module does not call this method: it has no `tokens`
   * column to size what it names, so `shareOf`/`shareSql` re-derive the same
   * first-appearance rule directly over the audit log's own `injected`
   * field, which carries both the ids and the estimate this table does not.
   * This IS the proof the rule is sound, read here rather than re-argued
   * there.
   */
  entries(sessionId: string): LedgerEntry[] {
    const rows = this.#db.prepare(
      'SELECT item_id, tier, injected_at FROM ledger WHERE session_id = ? ORDER BY injected_at, item_id',
    ).all(sessionId) as { item_id: string; tier: string; injected_at: string }[];
    return rows.map((r) => ({
      itemId: r.item_id, tier: r.tier as LedgerTier, injectedAt: r.injected_at,
    }));
  }

  /**
   * An aggregate query always returns exactly one row, even with no matches —
   * `count` is then 0 and `last` is NULL, which is why this needs no
   * `undefined` branch beyond defensive typing.
   */
  usage(itemId: string): Usage {
    const row = this.#db.prepare(
      'SELECT COUNT(*) AS n, MAX(injected_at) AS last FROM ledger WHERE item_id = ?',
    ).get(itemId) as { n: number; last: string | null } | undefined;
    return {
      itemId,
      useCount: row ? Number(row.n) : 0,
      lastUsed: row?.last ?? null,
    };
  }

  mostUsed(limit: number): Usage[] {
    const rows = this.#db.prepare(`
      SELECT item_id, COUNT(*) AS n, MAX(injected_at) AS last
      FROM ledger
      GROUP BY item_id
      ORDER BY n DESC, item_id ASC
      LIMIT ?
    `).all(limit) as { item_id: string; n: number; last: string | null }[];
    return rows.map((r) => ({
      itemId: r.item_id, useCount: Number(r.n), lastUsed: r.last ?? null,
    }));
  }

  /** One row per item id that has ever been injected. Agrees with `usage(itemId)` on the same data. */
  allUsage(): Usage[] {
    const rows = this.#db.prepare(`
      SELECT item_id, COUNT(*) AS n, MAX(injected_at) AS last
      FROM ledger
      GROUP BY item_id
      ORDER BY item_id
    `).all() as { item_id: string; n: number; last: string | null }[];
    return rows.map((r) => ({
      itemId: r.item_id, useCount: Number(r.n), lastUsed: r.last ?? null,
    }));
  }

  /**
   * Every recorded injection, ordered `(injected_at, session_id, item_id)` so
   * the series is total and repeatable across runs. Nothing is filtered,
   * capped or aggregated: every row the table holds comes back, so this read
   * cannot drop what the replay put there.
   *
   * The raw per-`(session, item, tier)` stream, and what it is FOR: the
   * **audit stream** (its injection records, and the volume buckets behind
   * the activity pulse — web-UI plan 3's `/api/watch/volume`) and the
   * **provenance surfaces** that have to answer where a delivery came from.
   *
   * **It is NOT the decay chart's source, and must not be made one.** The
   * primary key is `(session_id, item_id, tier)` and `injected_at` is only a
   * value (see `LEDGER_SCHEMA`), so a repeat injection inside one session
   * COLLIDES into the row already there: this returns one marker per
   * `(session, item, tier)`, not an event stream, and any time series drawn
   * from it undercounts by exactly the repeats the key swallowed. Which stamp
   * survives a collision is tier-dependent, so the markers are not even
   * uniformly first-injections — `pinned` and `jit` keep the FIRST (`record`
   * inserts-or-ignores) while `restored` keeps the LATEST (`recordRestored`
   * refreshes in place, deliberately: see its docblock).
   *
   * Decay is measured in SESSIONS rather than against a clock, and is served
   * by `recentSessions` + `itemsUsedIn`. The 90-day delivery view is a
   * different measurement from a different source again: `audit_item.role`
   * joined to `audit.at`, not this table, which records deliveries only.
   *
   * One caveat every consumer inherits, a property of the table rather than
   * of this query: the ledger records **injection**, not reading or reliance.
   *
   * Added for web-UI plan 1 (Task 7).
   */
  history(): InjectionEvent[] {
    const rows = this.#db.prepare(`
      SELECT session_id, item_id, tier, injected_at
      FROM ledger
      ORDER BY injected_at, session_id, item_id
    `).all() as { session_id: string; item_id: string; tier: string; injected_at: string }[];
    return rows.map((r) => ({
      sessionId: r.session_id,
      itemId: r.item_id,
      tier: r.tier as LedgerTier,
      injectedAt: r.injected_at,
    }));
  }

  /**
   * Distinct session ids, most recently active first. Ties (same latest
   * `injected_at` across sessions) break on `session_id DESC` so the order
   * is total and repeatable across runs, not left to incidental row order.
   */
  recentSessions(limit: number): string[] {
    if (limit <= 0) return [];
    const rows = this.#db.prepare(`
      SELECT session_id
      FROM ledger
      GROUP BY session_id
      ORDER BY MAX(injected_at) DESC, session_id DESC
      LIMIT ?
    `).all(limit) as { session_id: string }[];
    return rows.map((r) => r.session_id);
  }

  /**
   * `recentSessions`, carrying the two extra fields web-UI plan 1 asks for.
   * The ordering clause is the SAME as `recentSessions`' and a test pins the
   * agreement (`sessionSummaries(n).map(s => s.sessionId)` equals
   * `recentSessions(n)`), so a picker built on one and a default chosen by the
   * other can never disagree.
   *
   * Two things this aggregate leaves out, stated rather than hidden:
   *
   *  - `itemCount` counts DISTINCT item ids, so one item injected in two tiers
   *    within a session counts ONCE. It is an item count, not a row count —
   *    `entries(sessionId)` is the unaggregated view of the same rows.
   *  - `limit` truncates. Sessions past the window are simply absent, with
   *    nothing in the result to say so; a caller that needs to know how many
   *    exist asks `sessionCount()`.
   *
   * **`root` is what turns a session id into a NAME** (owner ruling 12), and it
   * is a parameter rather than something this class holds because a `Ledger` is
   * opened from a `dbPath` and nothing else. Deriving the workspace from
   * `path.dirname(dbPath)` would be true of every caller today and silently
   * wrong for the `:memory:` one, so the caller that HAS a workspace says so.
   * `null` — the ledger's own tests, and any surface with no project root —
   * yields `name: null` on every row rather than a fabricated label.
   *
   * The store is read ONCE for the whole window, not once per row, and
   * `readSessionNames` fails open by design: a corrupt name file costs the
   * labels and never the sessions. That disclosure belongs to the surface that
   * has somewhere to print it (`cli/commands/session.ts` prints it under the
   * listing); a read model that dropped the ROWS over it would be the much
   * larger loss.
   */
  sessionSummaries(limit: number, root: string | null = null): SessionSummary[] {
    if (limit <= 0) return [];
    const rows = this.#db.prepare(`
      SELECT session_id, MAX(injected_at) AS last, COUNT(DISTINCT item_id) AS n
      FROM ledger
      GROUP BY session_id
      ORDER BY MAX(injected_at) DESC, session_id DESC
      LIMIT ?
    `).all(limit) as { session_id: string; last: string; n: number }[];
    const names = root === null ? null : readSessionNames(root).names;
    return rows.map((r) => ({
      sessionId: r.session_id,
      lastInjectedAt: r.last,
      itemCount: Number(r.n),
      name: names?.get(r.session_id)?.name ?? null,
    }));
  }

  /**
   * Distinct item ids injected during any of the given sessions.
   * `sessionIds` is spliced directly into an `IN (...)` placeholder list;
   * SQLite's default parameter cap (SQLITE_MAX_VARIABLE_NUMBER, 32766 on
   * builds since 3.32) is far above any realistic session count for a
   * decay report (recent-N sessions, N in the tens), so no chunking is
   * implemented here — a caller passing tens of thousands of ids would need
   * one, but nothing in this codebase does.
   */
  itemsUsedIn(sessionIds: string[]): string[] {
    if (sessionIds.length === 0) return [];
    const placeholders = sessionIds.map(() => '?').join(', ');
    const rows = this.#db.prepare(`
      SELECT DISTINCT item_id
      FROM ledger
      WHERE session_id IN (${placeholders})
      ORDER BY item_id
    `).all(...sessionIds) as { item_id: string }[];
    return rows.map((r) => r.item_id);
  }

  /** Consumed bytes for one audit segment; 0 when this projection has never seen it. */
  sourceBytes(file: string): number {
    const row = this.#db.prepare('SELECT bytes FROM ledger_source WHERE file = ?')
      .get(file) as { bytes: number } | undefined;
    return row ? Number(row.bytes) : 0;
  }

  /**
   * Every audit segment this projection has consumed from. The replayer
   * compares it against the segments on disk: a known file that is no longer
   * there is a divergence (rotated under a new name, moved aside, deleted),
   * exactly as `projectionState` (audit-db.ts) treats it.
   */
  sourceFiles(): string[] {
    const rows = this.#db.prepare('SELECT file FROM ledger_source ORDER BY file')
      .all() as { file: string }[];
    return rows.map((r) => r.file);
  }

  setSourceBytes(file: string, bytes: number): void {
    this.#db.prepare(`
      INSERT INTO ledger_source (file, bytes) VALUES (?, ?)
      ON CONFLICT(file) DO UPDATE SET bytes = excluded.bytes
    `).run(file, bytes);
  }

  /**
   * Divergence recovery for the replay: drop every projected row and every
   * position. Safe by construction AFTER the seen-file change: the hooks no
   * longer write here, so this table holds nothing that is not in the audit
   * JSONL — the same "delete it, it rebuilds" recovery audit.db has.
   */
  clearForReplay(): void {
    this.#transaction(() => {
      this.#db.exec('DELETE FROM ledger; DELETE FROM ledger_source;');
    });
  }

  /** How many distinct sessions the ledger has recorded. */
  sessionCount(): number {
    const row = this.#db.prepare(
      'SELECT COUNT(DISTINCT session_id) AS n FROM ledger',
    ).get() as { n: number } | undefined;
    return row ? Number(row.n) : 0;
  }

  /**
   * Whether the engine refuses a write through this connection — asked of the
   * ENGINE, not remembered from how the connection was opened. The same probe
   * `Store.isReadOnly` runs, deliberately duplicated rather than shared: the
   * two classes hold their own `DatabaseSync` behind `#db` and neither can
   * reach the other's.
   *
   * The probe is a `CREATE TABLE` inside a transaction that is always rolled
   * back. `BEGIN IMMEDIATE` is NOT usable for it: measured on this engine, it
   * SUCCEEDS on a `{ readOnly: true }` connection (re-verified here, not
   * taken on trust from `store.ts`), so the refusal does not arrive until a
   * statement actually writes a page. The rollback is what keeps the probe
   * side-effect-free.
   *
   * **What a `true` here does and does not mean.** It means one write was
   * refused. The other reason a write is refused is `SQLITE_BUSY` — a
   * concurrent writer holding the lock — and this getter does not distinguish
   * the two, so it is not a liveness check and nothing at runtime decides
   * anything on it. It exists so a test can assert, of the connection
   * `openReadOnlyChecked` actually opened, that writing through it is
   * refused. It must not be called from inside `#transaction`, whose `BEGIN`
   * is already open.
   *
   * It is narrower than "cannot write at all", for the reason `store.ts` sets
   * out on `Store.openReadOnly`: `VACUUM INTO` writes to a path the caller
   * names, never to this file, and a read-only connection does not stop it.
   */
  get isReadOnly(): boolean {
    try {
      this.#db.exec('BEGIN');
      this.#db.exec('CREATE TABLE __mycontext_ledger_write_probe (x)');
    } catch {
      try { this.#db.exec('ROLLBACK'); } catch { /* the BEGIN itself may not have taken */ }
      return true;
    }
    this.#db.exec('ROLLBACK');
    return false;
  }

  close(): void {
    if (!this.#closed) {
      this.#db.close();
      this.#closed = true;
    }
  }
}

export interface Snapshot {
  sessionId: string;
  capturedAt: string;
  itemIds: string[];
}

/**
 * Session ids arrive from hook stdin and become filenames. Never trust them —
 * and never let two DIFFERENT ids share a filename: the file is a dedupe
 * scope, so a collision is shared suppression, and the truncation shape even
 * folded a parent key into its `::agent` composites — a subagent's fresh
 * context window reading the parent's deliveries as its own, the exact
 * per-window miss E2 was fixed to eliminate (2026-08-16 review).
 *
 * A canonical id — lowercase, filename-legal, no leading dot, ≤128 chars,
 * i.e. every real Claude Code session id — passes through byte-stable, so
 * existing sessions keep their state files. Anything else takes a sha256
 * digest of the RAW spelling beside a folded base, which makes the mapping
 * injective (modulo a 48-bit digest collision) for every shape the folding
 * used to conflate: `a::b` vs `a__b`, ids past the 128-char cap, case
 * variants (digests are lowercase hex, so they differ in character VALUE —
 * a case-insensitive filesystem cannot fold them), and leading dots. Each
 * shape is pinned by a DECISION test in `seen-file.test.ts`.
 */
export function sanitizeSessionId(sessionId: string): string {
  if (/^[a-z0-9_-][a-z0-9._-]{0,127}$/.test(sessionId)) return sessionId;
  const base = sessionId.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '_').slice(0, 96);
  const digest = createHash('sha256').update(sessionId, 'utf8').digest('hex').slice(0, 12);
  return `${base === '' ? 'unknown' : base}-${digest}`;
}

/** `root` is the `.my_context` directory. */
export function snapshotPath(root: string, sessionId: string): string {
  return path.join(root, 'state', `${sanitizeSessionId(sessionId)}.restore.json`);
}

let snapshotWriteCounter = 0;

/**
 * Retry attempts for the snapshot's rename, passed to
 * `retryOnTransientFsError`. On NTFS, `renameSync` over an existing target
 * fails `EPERM` while ANY other process merely holds the target open for
 * reading — measured at 654/2,000 renames under a concurrent reader
 * (2026-08-16 review, probe p3-rename.mjs), and the realistic holder on a
 * user's machine is an antivirus or indexer sweeping `state/`. The default 5
 * attempts (~200 ms of backoff) suit hot paths; this is a compaction-time
 * write the product must not lose, so it gets more patience: 15 attempts is
 * a worst case of 20·(1+…+14) = 2,100 ms of backoff, chosen to sit an order
 * of magnitude past a scanner's typical hold while leaving most of the
 * PreCompact hook's 10-second kill budget (`hooks.json`) for the store open
 * and transcript scan that precede the write. Pinned by a test in
 * `snapshot.test.ts` so the budget cannot drift silently if the backoff
 * formula changes.
 */
export const SNAPSHOT_RENAME_ATTEMPTS = 15;

/**
 * Temp file then rename. Two properties, stated separately because an
 * earlier design conflated them:
 *
 *  - **Atomic against concurrent readers and crashes mid-write**: a reader
 *    sees the whole old snapshot or the whole new one, never a truncated or
 *    interleaved file (measured: 0 torn reads in 22,791 contended reads).
 *    The rename is retried against transient Windows sharing violations —
 *    see `SNAPSHOT_RENAME_ATTEMPTS` — and THROWS if it still fails, so the
 *    caller can disclose the loss rather than swallow it.
 *  - **NOT power-loss durable**: nothing here fsyncs the file or the
 *    directory, so a power cut can lose the rename or its data. Accepted
 *    deliberately: a power cut also ends the Claude Code session this
 *    snapshot serves, and a resumed session re-enters through
 *    SessionStart(resume), not SessionStart(compact), so there is no
 *    compaction left for the snapshot to restore across.
 */
export function writeSnapshot(root: string, sessionId: string, itemIds: string[]): string {
  const target = snapshotPath(root, sessionId);
  const dir = path.dirname(target);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, '.gitignore'), '*\n', 'utf8');

  const snapshot: Snapshot = {
    sessionId,
    capturedAt: new Date().toISOString(),
    itemIds: [...new Set(itemIds)].sort(),
  };

  const tmp = `${target}.tmp-${process.pid}-${snapshotWriteCounter++}`;
  try {
    writeFileSync(tmp, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
    retryOnTransientFsError(() => renameSync(tmp, target), SNAPSHOT_RENAME_ATTEMPTS);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
  return target;
}

/**
 * Default retention window for `state/` snapshots: 30 days. A restore
 * snapshot only has to outlive the gap between one PreCompact and the
 * matching SessionStart(compact), which is minutes, not weeks — 30 days is
 * a generous margin for an abandoned or very long-lived session, chosen so
 * routine `rebuild` runs never race a snapshot that is still in use, while
 * still bounding the directory's growth for a project used daily over
 * months.
 */
export const SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Deletes `state/` entries older than `maxAgeMs`: finished `*.restore.json`
 * snapshots, per-session `*.seen.jsonl` dedupe files, and orphaned `*.tmp-*`
 * files a crash mid-write left behind (`writeSnapshot`'s temp file is cleaned
 * up on a caught error, but not on a hard crash between the write and the
 * `catch`). A seen file only has to outlive its session; 30 days is the same
 * generous margin the snapshots get. Age is judged
 * by mtime, not the snapshot's own `capturedAt`, so it also works for a
 * malformed file whose content can't be parsed. Never throws: a missing
 * `state/` directory, an unreadable entry, or a permissions failure on one
 * file all degrade to "leave it" rather than aborting the whole sweep or
 * propagating to the caller — pruning is best-effort housekeeping, not
 * something a `rebuild` should fail over.
 *
 * `onPrune` receives each removed entry's filename, after removal succeeds:
 * a pruned seen file silently converts a >30-day-idle session's dedupe state
 * into future re-injection, and the prune is the ONE moment that consequence
 * can be disclosed (at the next injection it is indistinguishable from a
 * fresh session), so the caller needs the names to say so.
 */
export function pruneSnapshots(
  root: string, maxAgeMs: number = SNAPSHOT_MAX_AGE_MS, onPrune?: (name: string) => void,
): number {
  const dir = path.join(root, 'state');
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }

  const cutoff = Date.now() - maxAgeMs;
  let pruned = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!(entry.name.endsWith('.restore.json')
      || entry.name.endsWith('.seen.jsonl')
      || entry.name.includes('.tmp-'))) continue;
    const full = path.join(dir, entry.name);
    try {
      if (statSync(full).mtimeMs < cutoff) {
        rmSync(full, { force: true });
        pruned++;
        onPrune?.(entry.name);
      }
    } catch {
      // Could not stat or remove this one entry — leave it for a later sweep.
    }
  }
  return pruned;
}

export interface SnapshotMeta {
  itemIds: string[];
  /** When this snapshot was captured — used to scope restore idempotency to one compaction. */
  capturedAt: string;
}

/**
 * Reads back a snapshot written by `writeSnapshot`, surfacing `capturedAt`
 * alongside the id list. Callers that need to tell "this compaction's
 * snapshot" apart from "the previous one" — i.e. anything doing idempotent
 * restore — need `capturedAt`; this is the only reader in `src/`, so there
 * is no separate id-only variant to keep in sync. Never throws: missing
 * file, corrupt JSON, or a wrong-shaped payload all degrade to `null` (no
 * usable snapshot).
 */
export function readSnapshotMeta(root: string, sessionId: string): SnapshotMeta | null {
  try {
    const parsed = JSON.parse(readFileSync(snapshotPath(root, sessionId), 'utf8')) as
      Partial<Snapshot>;
    const itemIds = Array.isArray(parsed.itemIds)
      ? parsed.itemIds.filter((v): v is string => typeof v === 'string')
      : [];
    // A missing/non-string capturedAt degrades to "now": nothing recorded
    // yet can be after it, so the restore filter below excludes nothing —
    // the safe direction is over-restoring, never under-restoring.
    const capturedAt = typeof parsed.capturedAt === 'string'
      ? parsed.capturedAt
      : new Date().toISOString();
    return { itemIds, capturedAt };
  } catch {
    return null;
  }
}

const MAX_TRANSCRIPT_BYTES = 8 * 1024 * 1024;

/**
 * Uppercase category prefix, hyphen, lowercase slug body — the shape guaranteed
 * by `makeId`. Matches are still filtered against the real index, because prose
 * and code contain plenty of tokens with this shape.
 */
const ID_PATTERN = /\b[A-Z][A-Z0-9]{1,11}-[a-z0-9][a-z0-9-]*\b/g;

function readTail(file: string): string {
  const { size } = statSync(file);
  if (size <= MAX_TRANSCRIPT_BYTES) return readFileSync(file, 'utf8');
  const fd = openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(MAX_TRANSCRIPT_BYTES);
    readSync(fd, buffer, 0, MAX_TRANSCRIPT_BYTES, size - MAX_TRANSCRIPT_BYTES);
    return buffer.toString('utf8');
  } finally {
    closeSync(fd);
  }
}

/**
 * Item ids mentioned anywhere in the transcript that also exist in the index.
 *
 * `knownIds: null` means "no known-id filter: the index was unavailable (or
 * knew nothing) at capture time" (Task 10). Over-capture is the safe
 * direction — a snapshot id matching no live item selects nothing at restore
 * — and the universe is bounded by the 8 MB transcript tail and the strict
 * id shape either way.
 */
export function scanTranscriptIds(
  transcriptPath: string | null | undefined, knownIds: Set<string> | null,
): string[] {
  if (!transcriptPath || (knownIds !== null && knownIds.size === 0)) return [];
  let text: string;
  try {
    if (!statSync(transcriptPath).isFile()) return [];
    text = readTail(transcriptPath);
  } catch {
    return [];
  }

  return scanTextIds(text, knownIds);
}

/**
 * The same scan over text a caller already holds, rather than a file.
 *
 * Split out of `scanTranscriptIds` for `hooks/post-compact.ts`, whose input is
 * the `compact_summary` on the payload — a string that exists nowhere on disk.
 * It is a split and not a second implementation on purpose: `ID_PATTERN` is
 * the one place that knows what an id looks like, and a second regex agreeing
 * with it today is a second regex to keep agreeing with `makeId` forever.
 *
 * `knownIds: null` means "no known-id filter", exactly as above, and the
 * safe direction is the same: over-capture, because every consumer of the
 * result re-checks the ids against something real.
 */
export function scanTextIds(text: string, knownIds: Set<string> | null): string[] {
  if (knownIds !== null && knownIds.size === 0) return [];
  const found = new Set<string>();
  for (const match of text.matchAll(ID_PATTERN)) {
    if (knownIds === null || knownIds.has(match[0])) found.add(match[0]);
  }
  return [...found].sort();
}

// --- The one-shot carry: a judgement about NOW, spent at the next injection -
//
// Owner ruling 2026-09-04: a person who decides a SPILLING item is required
// right now needs a way to say so without pricing the shared `pinned` tier
// (`always: true`, competing there forever) and without `focus` narrowing
// everything ELSE a session receives. `mycontext carry <id>` is that third
// option — it marks one id, and the mark is consumed the next time an
// injection runs, whether or not the corpus was already carrying something
// from a previous session at that moment.
//
// **Never accumulates into a second, invisible pin.** The two open questions
// the item names are answered here, not left to be inferred from behaviour:
//
//  1. **A carry nobody spends just waits.** This file holds a small, visible
//     queue (`mycontext carry --show` reads it back) rather than a timer or a
//     TTL. It does not expire on its own and it does not widen on its own —
//     the only two things that change it are a person marking another id and
//     an injection spending the whole queue at once. So it can sit for a day
//     with nobody starting a session, and it costs nothing while it sits: no
//     budget, no extra tier, nothing rendered. The day an injection finally
//     runs, it is spent — never renewed, never reinforced by simply existing.
//  2. **Carrying an item already in context is ALLOWED, not refused.** This
//     module has no notion of "what a given session's window currently
//     holds" — that is a per-session fact the seen file and the ledger track,
//     and answering it here would mean re-deriving the spilled-items list a
//     separate surface already owns, which is exactly the parallel store this
//     file is written not to become. Marking an id that turns out to already
//     be delivered costs one wasted front-of-queue index line, never a wrong
//     answer, so the safer direction is to allow it and let the reader check
//     first — the spilled-items list is where "is this actually missing"
//     is answered, not here.
//
// **Reuses the `carried` machinery `core/select.ts` already has** — the
// cross-session carry's OWN field (`SelectContext.carried`, `IndexLine.carried`,
// `CarriedSummary`) — rather than a fourth tier: an id marked here is handed to
// `select` as a `carried` entry exactly as a previous session's ids are, so it
// gets the SAME front-of-queue placement in the bounded index, the SAME
// disclosure when it is admitted, dropped or displaces one of this session's
// own lines, and the SAME accounting in the audit log (`tier: 'carried'`,
// `core/inject.ts`). No second disclosure format, no second budget rule.
//
// **A SEPARATE small store, not a parallel `carried`.** What is new here is
// only the QUEUE of ids a person marked — a fact `core/continuity.ts`'s
// session-scoped carry has no field for and must not be repurposed to hold,
// because that store is one person's standing choice of WHICH SESSION to
// continue and this is a one-shot list of WHICH ITEMS to force, cleared the
// moment it is used. `core/inject.ts` is what turns the two into one
// `SelectContext.carried` value per injection.

export const CARRY_ONCE_PROTOCOL = 'mycontext-carry-once/1';

/** `root` is the `.my_context` directory. */
export function carryOncePath(root: string): string {
  return path.join(root, 'state', 'carry-once.json');
}

/** One marked id, with who marked it and when — never invented, only read back. */
export interface CarryOnceEntry {
  id: string;
  setAt: string;
  setBy: 'human' | 'agent';
}

function readCarryOnceEntries(root: string): { entries: CarryOnceEntry[]; error: string | null } {
  let raw: string;
  try {
    raw = readFileSync(carryOncePath(root), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { entries: [], error: null };
    return { entries: [], error: `could not be read (${(err as Error).message})` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { entries: [], error: `is not valid JSON (${(err as Error).message})` };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { entries: [], error: 'is not a JSON object' };
  }
  const store = parsed as { protocol?: unknown; ids?: unknown };
  if (store.protocol !== CARRY_ONCE_PROTOCOL) {
    return { entries: [], error: `declares protocol ${JSON.stringify(store.protocol)}, not ${CARRY_ONCE_PROTOCOL}` };
  }
  if (!Array.isArray(store.ids)) return { entries: [], error: 'carries no usable "ids" array' };
  const entries: CarryOnceEntry[] = [];
  for (const row of store.ids) {
    if (typeof row === 'object' && row !== null && typeof (row as { id?: unknown }).id === 'string') {
      const r = row as { id: string; setAt?: unknown; setBy?: unknown };
      entries.push({
        id: r.id,
        setAt: typeof r.setAt === 'string' ? r.setAt : '',
        setBy: r.setBy === 'agent' ? 'agent' : 'human',
      });
    }
  }
  return { entries, error: null };
}

/**
 * What is currently marked, in the order it was marked. **Never throws** — a
 * corrupt file degrades to "nothing is carried" and says so, the same
 * direction every state file in `state/` fails.
 */
export function readCarryOnce(root: string): { ids: string[]; error: string | null } {
  try {
    const { entries, error } = readCarryOnceEntries(root);
    return { ids: entries.map((e) => e.id), error };
  } catch {
    return { ids: [], error: null };
  }
}

let carryOnceWriteCounter = 0;

function writeCarryOnceEntries(root: string, entries: CarryOnceEntry[]): { written: boolean; error: string | null } {
  const target = carryOncePath(root);
  const dir = path.dirname(target);
  const tmp = `${target}.tmp-${process.pid}-${carryOnceWriteCounter++}`;
  try {
    mkdirSync(dir, { recursive: true });
    // Beside the file, on every write — the same reason `continuity.ts` and
    // `focus.ts` write one here: `state/` may have no `.gitignore` yet if
    // nothing else has written into it in this workspace.
    writeFileSync(path.join(dir, '.gitignore'), '*\n', 'utf8');
    const body = `${JSON.stringify({ protocol: CARRY_ONCE_PROTOCOL, ids: entries }, null, 2)}\n`;
    writeFileSync(tmp, body, 'utf8');
    retryOnTransientFsError(() => renameSync(tmp, target));
    return { written: true, error: null };
  } catch (err) {
    try { rmSync(tmp, { force: true }); } catch { /* best effort */ }
    return {
      written: false,
      error: `the carry queue could not be written (${(err as Error).message}), so nothing was recorded.`,
    };
  }
}

/**
 * Marks one id for delivery at the next injection. **Idempotent**: marking an
 * id already in the queue changes nothing and reports `already: true` rather
 * than moving it to the back or duplicating it — the queue is a SET of ids
 * with the order they were first marked, not a log of every time someone
 * asked.
 *
 * Does not check whether `id` names a real item — the caller (`mycontext
 * carry`) has the store open and refuses an unknown id before this is called,
 * the same division `setCarrySource` draws with session ids.
 */
export function markCarryOnce(
  root: string, id: string, actor: 'human' | 'agent',
): { already: boolean; written: boolean; error: string | null } {
  const { entries } = readCarryOnceEntries(root);
  if (entries.some((e) => e.id === id)) return { already: true, written: false, error: null };
  const next = [...entries, { id, setAt: new Date().toISOString(), setBy: actor }];
  const { written, error } = writeCarryOnceEntries(root, next);
  return { already: false, written, error };
}

/**
 * Withdraws every pending mark, for `mycontext carry --clear`. Returns the ids
 * that WERE pending, so the command can say what it removed rather than only
 * that it removed something.
 */
export function clearCarryOnce(
  root: string,
): { ids: string[]; written: boolean; error: string | null } {
  const { entries } = readCarryOnceEntries(root);
  if (entries.length === 0) return { ids: [], written: true, error: null };
  const { written, error } = writeCarryOnceEntries(root, []);
  return { ids: entries.map((e) => e.id), written, error };
}

/**
 * **Read and clear in one call — the one-shot half of the contract.** The
 * only caller is `core/inject.ts`, once per injection, and it calls this
 * whether or not the ids it gets back end up admitted anywhere: a mark is
 * spent by being OFFERED to `select` at the next injection, not by being
 * delivered. `select` still decides, under budget, exactly as it does for a
 * cross-session carry — `CarriedSummary.dropped` is how a mark that spilled
 * anyway is disclosed, and it is disclosed exactly where a cross-session
 * carry's drop already is, because both travel through the same `carried`
 * field.
 *
 * A read that fails (corrupt file) spends nothing and reports the error
 * rather than throwing — `INV-hooks-fail-open`: a broken carry queue must
 * cost the carry, never the injection.
 */
export function spendCarryOnce(root: string): { ids: string[]; error: string | null } {
  try {
    const { entries, error } = readCarryOnceEntries(root);
    if (entries.length === 0) return { ids: [], error };
    const { error: writeError } = writeCarryOnceEntries(root, []);
    return { ids: entries.map((e) => e.id), error: writeError ?? error };
  } catch (err) {
    return { ids: [], error: (err as Error).message };
  }
}
