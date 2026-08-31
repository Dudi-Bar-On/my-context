import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { auditLogPath } from './audit.ts';

/**
 * **The gap the audit log does not cover, measured rather than assumed**
 * (`plan:live seq:4`, decided by the measurement in `seq:5`).
 *
 * Everything the UI knows about a changing corpus, it learns from the audit
 * log: `AuditTail` follows the JSONL, the stream pushes what lands, and
 * `SCREEN_INVALIDATION` decides which screen that makes stale. Every one of
 * those steps is downstream of an append. **A Markdown item edited in an
 * editor, by another tool, or by a branch switch appends NOTHING**, so a served
 * page can be looking at a corpus that has moved under it and say nothing at
 * all. That silence is the failure `INV-nothing-is-dropped-silently` names.
 *
 * ── WHY THIS IS A SWEEP AND NOT `fs.watch` ──────────────────────────────────
 *
 * `fs.watch` is the obvious tool and it was MEASURED on this platform before
 * being trusted (`plan:live seq:5`, Windows 11 26340 / Node 24.14, 2026-08-31),
 * because "replacing a poll with a watcher on Windows without measuring" is how
 * this project has been burned before. It fires accurately and fast on a quiet
 * tree — one event, 0.6ms, for the `appendFileSync` this product's audit writer
 * performs. It then loses **every named event** in a burst:
 *
 *   - 20 item files saved the way an editor saves them (write-temp-then-rename)
 *     overflow the notification buffer; 50 rewritten in place do the same. Past
 *     that point the callback delivers TWO events for the whole storm, neither
 *     of which names a changed file.
 *   - An item edit made while 60 other files were being rewritten around it was
 *     missed **10 times out of 10**. At 30 files, 1 in 10. At 10 files, none.
 *   - There are 724 item files in this corpus, so a branch switch or a repair
 *     run is one to two orders of magnitude past that cliff.
 *
 * The loss is signalled — libuv delivers `filename === null` when the buffer
 * overflows, and in every measured loss it did — but a watcher that knows only
 * "something was dropped" has exactly one correct response, which is to re-read
 * everything. That is this sweep, reached by a more expensive road: an idle
 * recursive watcher cost 96ms CPU per minute and a quiet one 1,121ms, against
 * **6.24ms per minute** for the sweep below over the whole real corpus.
 *
 * So the answer to `live/4` is DISCLOSURE, not detection-by-watcher — and this
 * function is what keeps the disclosure from being a permanent shrug. A page
 * that can only say "an edit made elsewhere might not have reached me" says the
 * same thing whether or not one has; `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`
 * asks for the difference, and a stat sweep is what can tell it.
 *
 * ── WHAT IT COMPARES, AND WHY THAT IS THE RIGHT PAIR ────────────────────────
 *
 * The newest mtime under `items/` against the mtime of the LIVE audit log.
 * Every write this product makes puts the item file down first and appends the
 * record after, so a corpus changed THROUGH mycontext leaves the log at least
 * as new as the item — the measured-good answer is `drifted: false`, and it is
 * an answer rather than an absence. A file written by anything else leaves the
 * item newer than the log, which is the whole of the finding.
 *
 * Directory mtimes are swept too, not only files: a file DELETED outside the
 * log raises no surviving file's mtime, but it does raise its directory's. An
 * add or a delete is a corpus change like any other and would otherwise be the
 * one shape of drift this could not see.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ────────────────────────────────────────
 *
 * It does not refresh anything and it is not a second change feed. It answers a
 * question on `/api/ping`, the heartbeat the shell already sends once a minute,
 * for exactly the reason `staleCode` rides that request rather than one of its
 * own: a second channel is a second thing to keep in step. What the reader does
 * with the finding is `SCREEN_INVALIDATION`'s and `CHROME_INVALIDATION`'s to
 * decide, unchanged.
 *
 * It also never repairs, re-indexes, or writes. It is a read, and `/api/ping`
 * is a route that must stay one (`test/ui/no-writes.test.ts`).
 */
export interface CorpusDrift {
  /**
   * `true` when something under `items/` is newer than the last thing the audit
   * log recorded — a change this page's live channel cannot have seen.
   *
   * `false` is a MEASUREMENT: the sweep ran, reached everything it meant to,
   * and found nothing newer. `null` is the honest unknown — no audit log to
   * compare against yet, or the sweep could not read the corpus — and a surface
   * drawing this must say "not known", never "no".
   */
  drifted: boolean | null;
  /**
   * How far ahead of the log the corpus is, in milliseconds, when `drifted` is
   * `true`. `null` otherwise. Disclosed because "an edit landed since you
   * opened this tab" and "an edit landed last Tuesday" are different sentences
   * and the reader is the one who can tell which matters.
   */
  aheadByMs: number | null;
  /** Entries examined — files and directories both. Disclosed so the bound below is legible. */
  scanned: number;
  /**
   * `true` when the sweep hit `SWEEP_MAX_ENTRIES` before it finished.
   *
   * The bound is declared rather than silent, the way `BACKLOG_SCAN_BYTES` and
   * `SPILL_RECORD_WINDOW` are: a truncated sweep that answered `drifted: false`
   * would be claiming a corpus is clean on the strength of the part of it that
   * fit. So a truncated sweep that found nothing answers `null`, not `false`.
   */
  truncated: boolean;
}

/**
 * The most entries one sweep will stat.
 *
 * Measured on this repository's own corpus on 2026-08-31: 724 `.md` files
 * swept in 5.50ms wall / 6.24ms CPU, warm. This ceiling is roughly seven times
 * that, so the bound only bites in a corpus an order of magnitude larger than
 * the one it was sized against — and there it costs a bounded ~40ms on a
 * request that is made once a minute per visible tab, rather than an unbounded
 * walk on a route that must stay fast.
 */
export const SWEEP_MAX_ENTRIES = 5000;

/**
 * The newest mtime under `dir`, over files matching `.md` and over every
 * directory walked.
 *
 * Stops early — `newerThan` is the audit log's mtime, and one entry past it is
 * the whole finding. The expensive case is therefore the HEALTHY one, which is
 * the right way round: a corpus that has not drifted pays a full 6ms sweep, and
 * one that has answers as soon as it finds its first piece of evidence.
 */
function newestMtime(
  dir: string,
  newerThan: number,
  budget: { left: number },
): { newest: number; scanned: number; truncated: boolean } {
  let newest = 0;
  let scanned = 0;
  const stack: string[] = [dir];
  while (stack.length > 0) {
    if (budget.left <= 0) return { newest, scanned, truncated: true };
    const current = stack.pop() as string;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue; // vanished under us, or unreadable: not evidence either way
    }
    try {
      const m = statSync(current).mtimeMs;
      if (m > newest) newest = m;
    } catch {
      // same
    }
    scanned += 1;
    budget.left -= 1;
    if (newest > newerThan) return { newest, scanned, truncated: false };
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.name.endsWith('.md')) continue;
      if (budget.left <= 0) return { newest, scanned, truncated: true };
      scanned += 1;
      budget.left -= 1;
      try {
        const m = statSync(full).mtimeMs;
        if (m > newest) {
          newest = m;
          if (newest > newerThan) return { newest, scanned, truncated: false };
        }
      } catch {
        // a file that disappeared between readdir and stat is not evidence
      }
    }
  }
  return { newest, scanned, truncated: false };
}

/**
 * Has this corpus moved in a way the audit log did not record?
 *
 * Never throws. This is called from `/api/ping`, whose whole job is to answer
 * a heartbeat, and a corpus that cannot be swept is an UNKNOWN rather than a
 * failed request — `drifted: null`, which the page draws as "not known" and
 * never as "no". `INV-hooks-fail-open`'s reasoning, applied to the one route
 * that must always answer.
 */
export function measureCorpusDrift(projectRoot: string | null): CorpusDrift {
  const unknown: CorpusDrift = { drifted: null, aheadByMs: null, scanned: 0, truncated: false };
  if (projectRoot === null) return unknown;

  let logMs: number;
  try {
    logMs = statSync(auditLogPath(projectRoot)).mtimeMs;
  } catch {
    // No log at all: a fresh corpus that has never been written through
    // mycontext. There is nothing to be behind, and nothing measured either.
    return unknown;
  }

  // `projectRoot` IS the `.my_context` directory — the same value `auditDir`
  // and `dbPath` are derived from, and this project's usual spelling for the
  // repository is `path.dirname` of it (`core/workspace.ts`).
  const itemsDir = path.join(projectRoot, 'items');
  const budget = { left: SWEEP_MAX_ENTRIES };
  let swept;
  try {
    swept = newestMtime(itemsDir, logMs, budget);
  } catch {
    return unknown;
  }
  if (swept.newest === 0 && swept.scanned === 0) return unknown;

  const drifted = swept.newest > logMs;
  if (!drifted && swept.truncated) {
    // The bound cut the sweep short and it found nothing. "Nothing here" is
    // then a statement about the part that fit, which is not the question.
    return { drifted: null, aheadByMs: null, scanned: swept.scanned, truncated: true };
  }
  return {
    drifted,
    aheadByMs: drifted ? Math.round(swept.newest - logMs) : null,
    scanned: swept.scanned,
    truncated: swept.truncated,
  };
}
