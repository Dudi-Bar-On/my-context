import { statSync } from 'node:fs';
import { readCompleteLines } from './audit-db.ts';
import { auditSegments, ledgerRows, parseAudit } from './audit.ts';
import type { Ledger, LedgerTier } from './ledger.ts';

/**
 * Projects the audit log's injection records into the ledger table — the
 * replayer `audit.ts`'s `ledgerRows` docblock promises. Position-tracked per
 * segment (the audit-db.ts pattern): each call consumes only complete new
 * lines past the stored offset, so the cost is O(new records), not O(log).
 * A segment that shrank or vanished is a divergence — the projection is
 * discarded and rebuilt whole, never appended on top (the audit-db.ts
 * rotation lesson, verbatim).
 */
export function topUpLedger(root: string, ledger: Ledger): { applied: number; diverged: boolean } {
  const onDisk = auditSegments(root);
  const sizeOf = (file: string): number => {
    try { return statSync(file).size; } catch { return -1; }
  };
  // Divergence, both directions the append-only log cannot produce by
  // appending: a listed segment that SHRANK below its consumed offset, and a
  // consumed segment that is NO LONGER LISTED at all (rotated under a new
  // name, moved aside, deleted) — the same two checks `projectionState`
  // (audit-db.ts) makes, for the same reason.
  const onDiskSet = new Set(onDisk);
  const diverged = onDisk.some((file) => sizeOf(file) < ledger.sourceBytes(file))
    || ledger.sourceFiles().some((file) => !onDiskSet.has(file));
  if (diverged) ledger.clearForReplay();

  let applied = 0;
  for (const file of onDisk) {
    const offset = ledger.sourceBytes(file);
    const { text, consumed } = readCompleteLines(file, offset);
    if (text === '') {
      if (offset === 0) ledger.setSourceBytes(file, consumed);
      continue;
    }
    for (const row of ledgerRows(parseAudit(text, file))) {
      if (row.tier === 'restored') ledger.recordRestored(row.sessionId, [row.itemId], row.at);
      else ledger.record(row.sessionId, row.itemId, row.tier as LedgerTier, row.at);
      applied++;
    }
    ledger.setSourceBytes(file, consumed);
  }
  return { applied, diverged };
}
