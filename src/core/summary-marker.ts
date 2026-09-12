/**
 * **The loop guard's sentinel, on its own, so that a module which must not
 * reach a writer can still carry it.**
 *
 * It lived in `core/session-summary.ts` and still reads from there: that file
 * re-exports both names, every existing importer is untouched, and this is not
 * a second definition of anything — `CLAUDE.md` opens by measuring what a
 * second copy of a rule costs, and a second spelling of a protocol string is
 * that defect in its purest form.
 *
 * ── WHY IT MOVED, MEASURED RATHER THAN PREFERRED ──────────────────────────
 *
 * `plan:recall seq:2`. A retrieval return carries this marker in its payload —
 * it must, or the next summary pass over the window it lands in would re-ingest
 * it — and the marking that writes it is reached from the UI's read surface,
 * which shows the owner exactly what would arrive before anything happens.
 *
 * Importing `session-summary.ts` to get one string pulled that whole module
 * into the server's reachable graph, and `test/ui/no-writes.test.ts` went red
 * on the dynamic `import()` inside `crossCheckAgainstIndex` — correctly: a
 * dynamic edge is an edge the static walk cannot see through, so every
 * assertion in that file would have been weaker than it read. The same walk
 * would also have reached `core/restore-stage.ts`' staging WRITER through the
 * same import. Neither was noticed by design; the gate found both.
 *
 * So the sentinel sits in a file that imports nothing, and the modules that
 * only need to RECOGNISE or EMIT it no longer have to drag a transcript reader
 * and a writer along behind them.
 */

/**
 * The loop guard's sentinel, in this project's protocol-string form —
 * `CARRY_ONCE_PROTOCOL` (`core/ledger.ts`) is `mycontext-carry-once/1` and
 * this is its neighbour.
 *
 * The version suffix is not decoration. When the payload's shape changes, a
 * reader that only knows `/1` must still recognise a `/2` payload as ours and
 * skip it, which is why `isMarkedSummary` matches the stem and not the whole
 * string.
 */
export const SESSION_SUMMARY_MARKER = 'mycontext-session-summary/1';

/** The stem every version of the marker shares. Matched, not the full string. */
const MARKER_STEM = 'mycontext-session-summary/';

/**
 * Does this text carry a summary this feature produced?
 *
 * Deliberately a substring test on the STEM. A record holding the payload
 * carries the marker somewhere in it; a record holding a future `/2` payload
 * carries a different version of it; both are ours and both must be skipped.
 */
export function isMarkedSummary(text: string): boolean {
  return text.includes(MARKER_STEM);
}
