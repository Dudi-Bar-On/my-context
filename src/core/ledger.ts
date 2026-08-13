import { DatabaseSync } from 'node:sqlite';

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
`;

export class Ledger {
  #db: DatabaseSync;
  #closed = false;

  private constructor(db: DatabaseSync) {
    this.#db = db;
  }

  static open(dbPath: string): Ledger {
    const db = new DatabaseSync(dbPath);
    try {
      db.exec('PRAGMA busy_timeout = 3000;');
      db.exec(LEDGER_SCHEMA);
    } catch (error) {
      // Close the handle if initialization fails, or it is orphaned: never
      // returned to a caller who could close it, never closed by us either.
      db.close();
      throw error;
    }
    return new Ledger(db);
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
    const inserted: string[] = [];
    this.#db.exec('BEGIN');
    try {
      for (const id of itemIds) {
        if (this.record(sessionId, id, tier, at)) inserted.push(id);
      }
      this.#db.exec('COMMIT');
    } catch (err) {
      this.#db.exec('ROLLBACK');
      throw err;
    }
    return inserted;
  }

  /** Every item id this session has already been shown, in any tier. */
  seen(sessionId: string): string[] {
    const rows = this.#db.prepare(
      'SELECT DISTINCT item_id FROM ledger WHERE session_id = ? ORDER BY item_id',
    ).all(sessionId) as { item_id: string }[];
    return rows.map((r) => r.item_id);
  }

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

  close(): void {
    if (!this.#closed) {
      this.#db.close();
      this.#closed = true;
    }
  }
}
