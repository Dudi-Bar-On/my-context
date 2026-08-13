import { DatabaseSync } from 'node:sqlite';
import {
  closeSync, mkdirSync, openSync, readFileSync, readSync,
  renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';

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

export interface Snapshot {
  sessionId: string;
  capturedAt: string;
  itemIds: string[];
}

/** Session ids arrive from hook stdin and become filenames. Never trust them. */
export function sanitizeSessionId(sessionId: string): string {
  const safe = sessionId.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '_').slice(0, 128);
  return safe === '' ? 'unknown' : safe;
}

/** `root` is the `.my_context` directory. */
export function snapshotPath(root: string, sessionId: string): string {
  return path.join(root, 'state', `${sanitizeSessionId(sessionId)}.restore.json`);
}

let snapshotWriteCounter = 0;

/** Atomic: temp file then rename, so a crash mid-write never leaves a truncated snapshot. */
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
    renameSync(tmp, target);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
  return target;
}

export interface SnapshotMeta {
  itemIds: string[];
  /** When this snapshot was captured — used to scope restore idempotency to one compaction. */
  capturedAt: string;
}

/**
 * Like `readSnapshot`, but also surfaces `capturedAt`. Callers that need to
 * tell "this compaction's snapshot" apart from "the previous one" — i.e.
 * anything doing idempotent restore — need this, not the id-only shape.
 * Never throws: missing file, corrupt JSON, or a wrong-shaped payload all
 * degrade to `null` (no usable snapshot), matching `readSnapshot`'s degrade
 * behavior for the id list.
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

export function readSnapshot(root: string, sessionId: string): string[] {
  return readSnapshotMeta(root, sessionId)?.itemIds ?? [];
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

/** Item ids mentioned anywhere in the transcript that also exist in the index. */
export function scanTranscriptIds(
  transcriptPath: string | null | undefined, knownIds: Set<string>,
): string[] {
  if (!transcriptPath || knownIds.size === 0) return [];
  let text: string;
  try {
    if (!statSync(transcriptPath).isFile()) return [];
    text = readTail(transcriptPath);
  } catch {
    return [];
  }

  const found = new Set<string>();
  for (const match of text.matchAll(ID_PATTERN)) {
    if (knownIds.has(match[0])) found.add(match[0]);
  }
  return [...found].sort();
}
