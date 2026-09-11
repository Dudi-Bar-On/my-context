/**
 * **The write primitives for session-restore staging, and the one-shot spend
 * the injection calls — a module small enough to sit on the
 * injection-critical path.**
 *
 * `plan:restore seq:2`. `core/restore-staging.ts` is the read half;
 * `core/restore-stage.ts` is the half a PERSON drives — build, review, stage,
 * approve. This is the narrow middle: putting a record on disk, taking one
 * away, and handing the approved one to `core/inject.ts` exactly once.
 *
 * ── WHY IT IS A THIRD FILE AND NOT PART OF `restore-stage.ts` ──────────────
 *
 * Measured, and it is the whole reason this file exists. `restore-stage.ts`
 * imports `core/session-summary.ts` — it has to; building a summary is what it
 * does — and `session-summary.ts` VALUE-IMPORTS `classifyTurn` from
 * `core/conversation-index.ts`, which loads `node:sqlite` and the entire
 * conversation index. When `core/inject.ts` imported `spendApprovedRestore`
 * from `restore-stage.ts`, every session start in this product began loading
 * the archive's index to find out whether a summary was waiting.
 *
 * That is precisely the property `buildInjectionResult` is built around —
 * *"the database is not on the injection-critical path"* — so the spend moved
 * here, where the import list is `node:fs`, `node:path` and the read half.
 * `test/core/restore-delivery.test.ts` walks the injection's runtime graph and
 * fails if `conversation-index.ts` or `node:sqlite` ever becomes reachable
 * through the restore again, so this stays true rather than being remembered.
 *
 * Nothing here can inject either. `core/inject.ts` imports THIS module; no
 * restore module imports `core/inject.ts`, in any direction.
 */
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  approvedRestore, loadStagedRestore, restoreStagingFile, type StagedRestore,
} from './restore-staging.ts';

/**
 * Write a staged restore, atomically, and put a `.gitignore` beside it.
 *
 * `.staging/` is working state rather than corpus — `lesson/derive.ts` keeps
 * its own records out of git the same way — and it matters more here: a staged
 * restore holds a verbatim account of a conversation, which is the last thing
 * that should reach a commit because nobody looked.
 *
 * Throws on failure. Every caller turns that into a sentence about whether it
 * is safe to clear, which is the one thing it must never guess at.
 */
export function writeStagedRestore(root: string, record: StagedRestore): void {
  const file = restoreStagingFile(root, record.key);
  const dir = path.dirname(file);
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, '.gitignore'), '*\n', 'utf8');
  try {
    writeFileSync(tmp, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    renameSync(tmp, file);
  } catch (err) {
    try { rmSync(tmp, { force: true }); } catch { /* best effort */ }
    throw err;
  }
}

/** Withdraw a staged restore. `removed` is false when it is still there. */
export function discardStagedRestore(root: string, key: string): { removed: boolean } {
  const file = restoreStagingFile(root, key);
  try {
    rmSync(file, { force: true, maxRetries: 5, retryDelay: 25 });
  } catch {
    return { removed: false };
  }
  let still: StagedRestore | null = null;
  try { still = loadStagedRestore(root, key); } catch { still = null; }
  return { removed: still === null };
}

/** What the injection got, and what it cost if anything went wrong. */
export interface SpentRestore {
  /** The payload to deliver, or null when there was nothing approved. */
  payload: string | null;
  key: string | null;
  /** Set when a staged restore existed but could not be spent. Never thrown. */
  error: string | null;
}

/**
 * **Read the approved restore and mark it spent, in one call — the one-shot
 * half of the contract, and `spendCarryOnce`'s contract in the same words.**
 *
 * The only caller is `core/inject.ts`, once per injection. A restore is spent
 * by being HANDED to that injection, not by being read by a person: a second
 * session start must not receive the same summary again, because the window it
 * was built for is no longer empty.
 *
 * **It never throws.** `INV-hooks-fail-open`: a staged restore that cannot be
 * read or cannot be marked must cost the restore and never the injection. A
 * knowledge base that breaks a session is worse than one that says nothing,
 * and that is truest on the session start that follows a clear.
 *
 * **The record is kept, marked `delivered`, rather than deleted.** `carry`
 * empties its queue because a spent mark is a line the reader has already
 * seen; this one holds a verbatim account of a conversation the owner may want
 * to look at again, and `mycontext restore --show` is where he does. It is
 * never eligible twice — `approvedRestore` reads `approved` and nothing else.
 */
export function spendApprovedRestore(root: string, sessionId: string | null): SpentRestore {
  try {
    const { record, skipped } = approvedRestore(root);
    // Whatever could not be READ is disclosed whether or not something else
    // was delivered. A staged restore that turned to junk reads, to the owner,
    // exactly like a workspace where nothing was ever staged — and he has just
    // cleared a window on the strength of the approval he gave it.
    const skipNote = skipped.length === 0 ? null
      : `${skipped.length} staged restore(s) could not be read: ` +
        skipped.map((s) => `${s.file} (${s.reason})`).join('; ');
    if (record === null) return { payload: null, key: null, error: skipNote };

    const spent: StagedRestore = {
      ...record,
      state: 'delivered',
      deliveredAt: new Date().toISOString(),
      deliveredTo: sessionId,
    };
    try {
      writeStagedRestore(root, spent);
    } catch (err) {
      // The mark could not be written. Delivering anyway would re-deliver the
      // same summary at every session start until somebody noticed, so the
      // delivery is dropped and the reason is disclosed — the same direction
      // `spendCarryOnce` takes, and never a silent one.
      return {
        payload: null, key: record.key,
        error: `a restore was approved but could not be marked delivered (${
          err instanceof Error ? err.message : String(err)}), so it was NOT delivered — it would ` +
          'otherwise arrive again at every session start.' +
          (skipNote === null ? '' : ` Also: ${skipNote}`),
      };
    }
    return { payload: record.payload, key: record.key, error: skipNote };
  } catch (err) {
    return { payload: null, key: null, error: err instanceof Error ? err.message : String(err) };
  }
}
