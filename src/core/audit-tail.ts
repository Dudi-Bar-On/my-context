import { statSync } from 'node:fs';
import { auditLogPath, auditSegments, parseAudit, type AuditRecord } from './audit.ts';
import { readCompleteLines } from './audit-db.ts';

/**
 * A live tail over the audit log for the web UI's Watch stream (web-ui plan 3).
 *
 * The JSONL is the truth and this reads it directly — no projection sits
 * between an append and the screen. Offsets are per segment file; only
 * COMPLETE lines are consumed (`readCompleteLines`, the projection's own
 * rule), so a hook killed mid-append never puts half a record on a screen.
 *
 * **Divergence resyncs; it never replays.** Divergence has two faces, and a
 * rotation shows the second one more often than the first. A file this tail
 * has consumed may shrink or vanish, and then the byte offsets no longer mean
 * "already emitted". But a rotation that renames the live log aside and
 * immediately starts a fresh one leaves a file at the SAME path with a size
 * that need not be smaller (measured on this repo's own rotation: 151 bytes
 * primed, 152 bytes after), so the shrink-or-vanish test alone does not see
 * it. What is always true of a rotation is that a ROTATED SEGMENT appears
 * that this tail has never read — and reading such a file from zero is
 * exactly the replay to avoid, since its records predate this tail. So an
 * unknown segment other than the live log is divergence too.
 *
 * Re-reading from zero would show every record around the rotation
 * twice, in an audit view. So the tail resets to the current EOFs and reports
 * `resync: true`; the consumer (the stream route, then the screen) refetches
 * its backlog through the query surface, which reads the projection and is
 * immune to the rename. Nothing is dropped silently: the resync is an event
 * the screen renders, not a condition it swallows.
 *
 * `poll()` throws what `parseAudit` throws: a damaged COMPLETE line means the
 * log cannot be trusted, and the audit read contract (audit.ts, `specFor`)
 * refuses rather than skips. The stream route turns that into a disclosed
 * `fault` event and ends the stream.
 */
export interface TailResult {
  records: AuditRecord[];
  resync: boolean;
}

function sizeOf(file: string): number {
  try {
    return statSync(file).size;
  } catch {
    return -1; // gone
  }
}

export class AuditTail {
  #root: string;
  #offsets = new Map<string, number>();

  constructor(root: string) {
    this.#root = root;
    for (const file of auditSegments(root)) this.#offsets.set(file, sizeOf(file));
  }

  #resetToEof(files: string[]): void {
    this.#offsets = new Map();
    for (const file of files) this.#offsets.set(file, sizeOf(file));
  }

  poll(): TailResult {
    const files = auditSegments(this.#root);
    const present = new Set(files);
    const live = auditLogPath(this.#root);

    for (const [file, offset] of this.#offsets) {
      if (!present.has(file) || sizeOf(file) < offset) {
        this.#resetToEof(files);
        return { records: [], resync: true };
      }
    }

    // The other face of divergence: a rotated segment this tail has never
    // read. Its records predate this tail, so reading it from 0 would replay
    // them; and the rotation that produced it also replaced the live log
    // under a path whose offset now means nothing. Checked separately because
    // the loop above cannot see it — after a rotation the live log exists
    // again, at a size that need not have shrunk.
    for (const file of files) {
      if (file !== live && !this.#offsets.has(file)) {
        this.#resetToEof(files);
        return { records: [], resync: true };
      }
    }

    const records: AuditRecord[] = [];
    for (const file of files) {
      // The only file that can still be unknown here is a brand-new live log
      // (the first record in an empty workspace): read it from 0, because
      // everything in it was appended after this tail was constructed.
      const offset = this.#offsets.get(file) ?? 0;
      const { text, consumed } = readCompleteLines(file, Math.max(0, offset));
      if (text !== '') records.push(...parseAudit(text, file));
      this.#offsets.set(file, consumed);
    }
    return { records, resync: false };
  }
}
