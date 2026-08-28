import { AUDIT_PROTOCOL, auditDir, auditLogPath, type AuditInput } from '../../src/core/audit.ts';
import { appendJsonlLine } from '../../src/core/jsonl-log.ts';

/**
 * Appends one audit record to the log WITHOUT projecting it — the shortest
 * route to a projection that is `behind` its log.
 *
 * **`recordAudit` used to be that route, and deliberately is not any more.**
 * It keeps the projection current on the write path
 * (`core/audit-db.ts` · `export function keepProjectionCurrent(`), which is
 * the whole point of that change: the states below were being reached by
 * ordinary work, including by reads, because a refusal is itself an audit
 * record. Tests that need `behind` were reaching it as a side effect of the
 * defect, so they now ask for it directly.
 *
 * **`behind` has not stopped being reachable, which is why it has not stopped
 * being tested.** Four ways, none of them exotic:
 *
 *  - A record appended by a build older than the change, in a log that outlives
 *    the build that wrote it — which an append-only audit log is designed to.
 *  - A log or a `.audit/` directory copied in from another machine.
 *  - An append whose upkeep returned `failed`: the log is the authority and
 *    holds the record, and the projection is left behind and says so.
 *  - An append whose upkeep returned `diverged`. Repairing a divergence is a
 *    rebuild, a write path may not do one, so every append after it leaves the
 *    projection further behind until `mycontext audit` runs.
 *
 * This writes the line exactly as `recordAudit` writes it — same protocol,
 * same stamping rule for `at` — and then stops, which is precisely the state
 * all four leave behind.
 */
export function appendUnprojected(root: string, input: AuditInput): void {
  appendJsonlLine(auditDir(root), auditLogPath(root), {
    protocol: AUDIT_PROTOCOL,
    ...input,
    at: input.at ?? new Date().toISOString(),
  });
}
