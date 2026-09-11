/**
 * **The anchors file — the one durable copy of the bookmarks, and the truth the
 * `anchors` table is rebuilt from.** `plan:recall seq:6`,
 * `TASK-anchors-are-the-one-thing-in-the-index-that-cannot-be-re`.
 *
 * ── WHY THERE IS A FILE AT ALL ─────────────────────────────────────────────
 *
 * `.my_context/.index.db` is gitignored and DEFINED as disposable — the shape
 * is the version, delete it and it rebuilds. Everything in it comes back from
 * something else: conversations, lanes and prose from the transcripts, items
 * from Markdown. **Anchors were the one exception.** They survive a rebuild,
 * which is asserted in `test/core/anchors.test.ts`, and nothing brought them
 * back if the file itself went. There were 565 of them when this was written,
 * one of which the owner marked by hand.
 *
 * Owner ruling, 2026-09-11, after he asked whether a plain file would cost
 * database capability or speed and why not a second SQLite database — measured
 * on his own 565 rows before he ruled:
 *
 *                        565 (today)   10,000    100,000
 *     SQLite list all       1.5 ms      ~same     ~same
 *     SQLite label search   0.3 ms      ~same     ~same
 *     JSONL read + parse    2.0 ms     15.6 ms    185 ms
 *     JSONL list all sorted 2.7 ms     41.0 ms    444 ms
 *     JSONL label search    1.8 ms     26.8 ms    153 ms
 *     in-memory filter      0.013 ms    0.33 ms    3.3 ms
 *
 * *"file as truth, go with it"*. **The file is the truth and the table is
 * rebuilt from it** — the relationship Markdown items already have with the
 * index — so every query still hits SQLite at SQLite's speed and no caller of
 * `markAnchor`, `allAnchors` or `searchAnchors` learns that this file exists.
 * The file is paid for on a WRITE and on an OPEN, never on a read.
 *
 * A second SQLite database was declined in the same breath: it would have been
 * this project's first non-disposable database, a category of state nothing
 * else here has, and one that can corrupt with no way back. Every durable
 * thing in this repository is a file — `state/`, `delivered.jsonl`, the
 * revision log, `.staging/*.json`.
 *
 * ── A REWRITTEN DOCUMENT, NOT AN APPEND-ONLY LOG ───────────────────────────
 *
 * The two precedents here disagree and the choice was made against what the
 * writers actually do, not by habit. `revision-log.ts` and `audit.ts` are
 * append-only with a fold over the history; `.staging/*.json` and `state/` are
 * documents rewritten whole.
 *
 * **The automatic anchor pass relabels hundreds of anchors at once** — 345 in
 * the last run before this landed — and takes some back, every turn the Stop
 * hook fires. An append-only log would gain a few hundred records per turn to
 * describe 565 facts, and every reader would have to fold a history nobody
 * asked for: there is no question anywhere in this product about what a
 * bookmark's label USED to be. So it is a document: 565 lines in, 565 lines
 * out, rewritten whole on every change.
 *
 * The ENCODING is still JSONL — one `{…}\n` per anchor, the shape the
 * measurement above was taken against, greppable and diffable line by line,
 * and read by the SAME `jsonl-log.ts` reader every other record file here uses
 * rather than by a third parser with its own subtly different rules.
 *
 * ── THE ONE PLACE IT DIFFERS FROM A LOG, AND IT IS DELIBERATE ──────────────
 *
 * `parseJsonlLog` tolerates a damaged FINAL line when the file does not end in
 * a newline, because a killed appender is the failure an append-only log
 * exists to survive. This file cannot reach that state: `writeAnchorFile`
 * builds the whole document, writes it to a temp path and RENAMES it into
 * place, so the destination is either the old document or the new one and
 * every line it holds ends in a newline. A damaged line here is therefore
 * corruption or a hand edit, and it is refused — reading it as "fewer
 * bookmarks" is precisely the silent loss `INV-nothing-is-dropped-silently`
 * forbids, and the bookmarks are the thing that cannot be re-derived.
 *
 * ── WHY THIS IS A MODULE BESIDE THE INDEX AND NOT A METHOD ON IT ───────────
 *
 * The obvious home for this is `ConversationIndex.putAnchor`, and it was
 * written there first. `test/ui/conversations-endpoint.test.ts` caught it:
 * **`core/conversation-index.ts` must load NOTHING from this project at
 * runtime**, which is what lets the read-only UI open the index at all, and a
 * `writeFileSync` reachable from that module would spend the guarantee.
 *
 * So this composes the write from outside, which is the arrangement
 * `advanceMirrors` already has and for the same stated reason: the index
 * writes only through `node:sqlite`, and the filesystem half is a separate
 * module the WRITERS compose. The only thing this takes from the index is its
 * type, which native type stripping erases, so nothing is loaded in either
 * direction at runtime.
 *
 * **`markAnchor` and `unmarkAnchor` (`core/anchors.ts`) are the doors**, and
 * they have always been the doors — no caller changes. `putAnchor` and
 * `dropAnchor` are now half a write and say so in their own headers.
 */
import { renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { readJsonlFileState, type JsonlRow } from './jsonl-log.ts';
import type { AnchorRow, ConversationIndex } from './conversation-index.ts';

/** The value every line carries. A line that declares anything else is refused. */
export const ANCHOR_PROTOCOL = 'my_context/anchor@1';

/**
 * The file's name, beside the index it is the truth for.
 *
 * Dotted and beside `.index.db` rather than in a directory of its own, because
 * there is exactly one of it per workspace and `.my_context/.gitignore` — the
 * file `mycontext init` writes — is already the place this workspace says what
 * is disposable and what is private.
 */
export const ANCHOR_FILE_NAME = '.anchors.jsonl';

/**
 * Where the anchors of the index at `dbPath` live, or `null` when there is no
 * workspace to hold them.
 *
 * `null` is the off-workspace answer and not a failure: `resolveWorkspace`
 * gives `:memory:` for a directory with no corpus, and an in-memory index has
 * nowhere to be durable. Every caller treats `null` as "table only", which is
 * exactly what such a run had before this file existed.
 */
export function anchorFilePath(dbPath: string): string | null {
  if (dbPath === ':memory:' || dbPath === '') return null;
  return path.join(path.dirname(dbPath), ANCHOR_FILE_NAME);
}

/**
 * The path the document is built at before it is renamed into place.
 *
 * **Derived rather than random, and that is what makes the atomicity
 * testable.** `restore-store.ts` mixes the clock into its temp name; here the
 * pid alone is enough to keep two processes apart, sync code cannot interleave
 * two writes inside one process, and a name a test can compute is the only way
 * to assert what a failed write leaves behind — see
 * `test/core/anchor-durability.test.ts`.
 */
export function anchorTempPath(file: string): string {
  return `${file}.tmp-${process.pid}`;
}

/** What the file held, and whether there was a file at all. */
export interface AnchorFileRead {
  rows: AnchorRow[];
  /**
   * `absent` ONLY on an observed ENOENT. It is the fact adoption turns on: a
   * table with rows and no file is a corpus that predates this mechanism, and
   * its rows are the best truth there is. An unreadable file is neither state
   * and throws.
   */
  state: 'read' | 'absent';
}

function refuse(line: number, reason: string): Error {
  return new Error(
    `my_context: the anchors file is damaged — line ${line} ${reason}. These are the ` +
    'bookmarks into the conversation archive, and they are the one thing in the index that ' +
    'cannot be re-derived from anything else, so reading this file as a shorter list of them ' +
    'would lose them silently. The file is written whole and renamed into place, so a damaged ' +
    'line is corruption or a hand edit rather than an interrupted write.',
  );
}

function validate(row: JsonlRow): string | null {
  for (const key of ['id', 'sessionId', 'label', 'kind', 'origin', 'at']) {
    if (typeof row[key] !== 'string' || row[key] === '') return `has no ${key}`;
  }
  if (typeof row.byteOffset !== 'number' || !Number.isInteger(row.byteOffset)) {
    return 'has no integer byteOffset';
  }
  if (row.agentId !== null && typeof row.agentId !== 'string') {
    return 'has an agentId that is neither a string nor null';
  }
  return null;
}

function toRow(row: JsonlRow): AnchorRow {
  return {
    id: String(row.id),
    sessionId: String(row.sessionId),
    agentId: row.agentId === null ? null : String(row.agentId),
    byteOffset: Number(row.byteOffset),
    label: String(row.label),
    kind: String(row.kind),
    origin: String(row.origin),
    at: String(row.at),
  };
}

/**
 * The anchors on disk. Absent is `{ rows: [], state: 'absent' }`; a damaged
 * line throws; an unreadable file throws.
 */
export function readAnchorFile(file: string): AnchorFileRead {
  const read = readJsonlFileState({
    file,
    protocol: ANCHOR_PROTOCOL,
    validate,
    refuse,
    unreadable: (err) => new Error(
      `my_context: the anchors file at ${file} exists and could not be read ` +
      `(${err instanceof Error ? err.message : String(err)}). It holds the bookmarks into the ` +
      'conversation archive, which nothing else can re-derive, so this is reported rather than ' +
      'treated as an empty list.',
    ),
  });
  return { rows: read.rows.map(toRow), state: read.state };
}

/**
 * Write the whole document, atomically.
 *
 * Write-then-rename, as `writeStagedRestore` and the staging writer do, and it
 * matters more here than it does for either of them: a truncated anchors file
 * is now a way to LOSE bookmarks, and they are the only thing in the index
 * that no rebuild could put back. The destination is never opened for writing
 * — it is replaced by a rename — so a kill at any moment leaves either the
 * whole old document or the whole new one.
 *
 * Rows are written in id order so that writing the same set twice produces the
 * same bytes: a file whose line order moved on every write would be unreadable
 * as a diff, which is half of what a plain file is for.
 */
export function writeAnchorFile(file: string, rows: readonly AnchorRow[]): void {
  const ordered = [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const text = ordered
    .map((row) => `${JSON.stringify({ protocol: ANCHOR_PROTOCOL, ...row })}\n`)
    .join('');
  const tmp = anchorTempPath(file);
  try {
    writeFileSync(tmp, text, 'utf8');
    renameSync(tmp, file);
  } catch (err) {
    try { rmSync(tmp, { force: true }); } catch { /* best effort */ }
    throw err;
  }
}

/* ── THE INDEX SIDE: adoption, re-derivation, and the write path ─────────── */

/**
 * Indexes with an anchor transaction open right now.
 *
 * A `WeakSet` rather than a flag on the index, because the index must not
 * learn that this file exists — see the header. It is keyed by handle, so two
 * handles in one process cannot be confused for each other, and an index that
 * is dropped takes its entry with it.
 */
const IN_ANCHOR_TRANSACTION = new WeakSet<ConversationIndex>();

/** What a reconciliation did. Reported rather than assumed — the counts differ. */
export interface AnchorReconcile {
  /**
   *  - `adopted`  there was no file and the TABLE was written into one. Every
   *               corpus that predates this mechanism passes through here
   *               exactly once, his 565 rows included.
   *  - `restored` there was a file and the TABLE was re-derived from it. This
   *               is the ordinary state, and the one that makes `.index.db`
   *               disposable again.
   *  - `none`     no workspace to hold a file (`:memory:`). Table only, which
   *               is what such a run always had.
   */
  direction: 'adopted' | 'restored' | 'none';
  rows: number;
}

/**
 * **Bring the table and the file into agreement, in whichever direction the
 * disk says.**
 *
 * Called by the writers that run by themselves — `stopConversationRefresh` at
 * the end of every assistant turn, and `mycontext conversation rebuild` — and
 * again at the start of every anchor write. The owner never runs anything.
 *
 * The direction is decided by ONE fact: whether the file is there. That is why
 * `readAnchorFile` reports `absent` separately from empty — a corpus whose
 * table holds 565 bookmarks and whose file does not exist is not a corpus with
 * no bookmarks, and treating the two the same would delete every one of them.
 */
export function reconcileAnchors(index: ConversationIndex): AnchorReconcile {
  const file = anchorFilePath(index.dbPath);
  if (file === null) return { direction: 'none', rows: 0 };

  const onDisk = readAnchorFile(file);
  if (onDisk.state === 'absent') {
    const rows = index.anchorRows(null);
    writeAnchorFile(file, rows);
    return { direction: 'adopted', rows: rows.length };
  }
  index.replaceAnchors(onDisk.rows);
  return { direction: 'restored', rows: onDisk.rows.length };
}

/**
 * **Many anchor writes, one document** — the door the automatic pass uses.
 *
 * One `BEGIN IMMEDIATE`, one reconciliation at the start of it, the caller's
 * writes, and one write of the document before the COMMIT. The last run of the
 * automatic pass relabelled 345 anchors and took some back; this is what makes
 * that one file write rather than 345.
 *
 * **The order is the durability argument.** The document is renamed into place
 * while the database's write lock is still held and the COMMIT has not
 * happened, so: a failure to write the file rolls the table back, and a kill
 * between the two leaves the file AHEAD of the table — the direction that
 * costs nothing, because the table is rebuilt from the file. The other order
 * loses a bookmark.
 */
export function anchorTransaction<T>(index: ConversationIndex, fn: () => T): T {
  const file = anchorFilePath(index.dbPath);
  if (file === null) return index.transaction(fn);
  IN_ANCHOR_TRANSACTION.add(index);
  try {
    return index.transaction(() => {
      reconcileAnchors(index);
      const value = fn();
      writeAnchorFile(file, index.anchorRows(null));
      return value;
    });
  } finally {
    IN_ANCHOR_TRANSACTION.delete(index);
  }
}

/**
 * One anchor write, made durable — `markAnchor` and `unmarkAnchor` call this
 * and nothing else does.
 *
 * The reconciliation at the start is not symmetry with `anchorTransaction`; it
 * is what stops a stale table being published over somebody else's bookmark.
 * The document is rewritten WHOLE, so a process that has held its handle since
 * before another process marked an anchor would otherwise erase it. Both are
 * serialised by the same `BEGIN IMMEDIATE`.
 */
export function withAnchorWrite<T>(index: ConversationIndex, fn: () => T): T {
  const file = anchorFilePath(index.dbPath);
  if (file === null) return fn();
  if (index.inTransaction) {
    // **A transaction that is not an `anchorTransaction` would COMMIT the
    // table and never write the file**, and the next reconciliation would
    // delete the anchor as one the document does not have. That is silent loss
    // of the one thing here that cannot be re-derived, so it is refused rather
    // than risked — `INV-nothing-is-dropped-silently`.
    if (!IN_ANCHOR_TRANSACTION.has(index)) {
      throw new Error(
        'my_context: an anchor was written inside a transaction that is not an ' +
        '`anchorTransaction` (core/anchor-file.ts). The anchors file is the truth and the ' +
        'table is rebuilt from it, so a transaction that commits an anchor without writing ' +
        'the file loses that bookmark at the next reconciliation. Wrap the batch in ' +
        '`anchorTransaction`.',
      );
    }
    return fn();
  }
  return anchorTransaction(index, fn);
}
