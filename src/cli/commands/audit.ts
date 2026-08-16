import type { DatabaseSync } from 'node:sqlite';
import {
  AUDIT_KINDS, AUDIT_OPS, auditSize, filterAudit, parseWhen, readAudit,
  type AuditFilter, type AuditKind, type AuditOp, type AuditRecord,
} from '../../core/audit.ts';
import {
  auditDbPath, openProjection, queryProjection, sessions, syncProjection, topItems,
  type SummaryRow,
} from '../../core/audit-db.ts';
import { enumError } from '../../core/teach.ts';
import type { Origin } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { toCliMessage } from './context.ts';
import {
  DETAIL_FLAGS, emitJson, paragraph, refuseUnknownFlag, table, wantsJson,
} from './format.ts';
import { flag, registerCommand, type Emit } from './registry.ts';

const USAGE =
  'usage: mycontext audit [--since T] [--until T] [--item ID] [--session ID] [--kind K] ' +
  '[--op O] [--origin R] [--limit N] [--summary|--items|--sessions|--files] [--json]';

const VALUE_FLAGS = ['since', 'until', 'item', 'session', 'kind', 'op', 'origin', 'limit', 'role'];
const OWN_FLAGS = [...VALUE_FLAGS, 'items', 'sessions', 'files'];

const DEFAULT_LIMIT = 50;
const DEFAULT_TOP = 20;

const ORIGINS: Origin[] = ['human', 'agent', 'ingest'];

function buildFilter(args: string[]): AuditFilter {
  const filter: AuditFilter = {};

  const since = flag(args, 'since');
  if (since !== null) filter.since = parseWhen(since, "--since");
  const until = flag(args, 'until');
  if (until !== null) filter.until = parseWhen(until, "--until");

  const item = flag(args, 'item');
  if (item !== null) filter.itemId = item;
  const session = flag(args, 'session');
  if (session !== null) filter.sessionId = session;

  const kind = flag(args, 'kind');
  if (kind !== null) {
    if (!AUDIT_KINDS.includes(kind as AuditKind)) {
      throw new Error(enumError('kind', kind, AUDIT_KINDS, 'workflow'));
    }
    filter.kind = kind as AuditKind;
  }

  const op = flag(args, 'op');
  if (op !== null) {
    if (!AUDIT_OPS.includes(op as AuditOp)) {
      throw new Error(enumError('op', op, AUDIT_OPS, 'workflow'));
    }
    filter.op = op as AuditOp;
  }

  const origin = flag(args, 'origin');
  if (origin !== null) {
    if (!ORIGINS.includes(origin as Origin)) {
      throw new Error(enumError('origin', origin, ORIGINS, 'workflow'));
    }
    filter.origin = origin as Origin;
  }

  const limit = flag(args, 'limit');
  if (limit !== null) {
    const parsed = Number(limit);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(
        `my_context: --limit must be a positive whole number. You passed ${JSON.stringify(limit)}. ` +
        `Omit it to take the most recent ${DEFAULT_LIMIT}.`,
      );
    }
    filter.limit = parsed;
  }
  return filter;
}

/** `2026-08-16T09:14:02.123Z` → `08-16 09:14:02`, which is what fits a table. */
function stamp(at: string): string {
  return at.length >= 19 ? `${at.slice(5, 10)} ${at.slice(11, 19)}` : at;
}

/**
 * The one-line "what" of a record.
 *
 * An injection prints a COUNT and the tiers, not the ids — a session start on
 * this repository's own corpus delivers a dozen items, and a table cell
 * holding twelve 40-character ids is not a table. `--json` and `--item` are
 * how a reader gets the ids; this column is how they find the record.
 */
function detailCell(record: AuditRecord): string {
  if (record.kind === 'injection' || record.op === 'pre-compact') {
    const tiers = new Map<string, number>();
    for (const entry of record.injected ?? []) {
      tiers.set(entry.tier, (tiers.get(entry.tier) ?? 0) + 1);
    }
    const shown = [...tiers].map(([tier, n]) => `${n} ${tier}`).join(', ') || 'nothing';
    const spilled = (record.spilled ?? []).length;
    return `${shown}${spilled === 0 ? '' : `, ${spilled} spilled`}`;
  }
  const fields = (record.fields ?? []).join(', ');
  return [fields, record.note].filter((s) => s !== undefined && s !== '').join(' — ');
}

/**
 * `kind` is deliberately NOT a column.
 *
 * It is not dropped information: `kindOf` is a total function from `op` to
 * `kind`, so every row's kind is readable off the row it is on, and `--kind`
 * still filters and `--json` still carries the field. It is dropped because of
 * arithmetic. `table` (format.ts) narrows a table only when its own longest
 * unbreakable tokens fit the 100-column budget; with `kind` present, this
 * table's floor is 109 columns on a corpus whose ids run to 38 characters, so
 * it would be left at natural width and rewrapped by the terminal — the same
 * failure `list --full` exists to avoid. Without it the floor is 91, and the
 * table narrows to the budget at hostile id length.
 */
const HEADERS = ['when', 'op', 'who', 'subject', 'detail'];

/** The actor: the origin for a mutation, the session for a hook action. */
function whoCell(record: AuditRecord): string {
  if (record.origin !== undefined) return record.origin;
  // Truncated to the first 8 characters, which is enough to tell two sessions
  // apart in a listing; `--sessions` prints them in full, and `--session`
  // accepts the full id.
  return record.sessionId === undefined ? 'hook' : record.sessionId.slice(0, 8);
}

function cells(record: AuditRecord): string[] {
  return [
    stamp(record.at),
    record.op,
    whoCell(record),
    record.itemId ?? record.path ?? '',
    detailCell(record),
  ];
}

function summaryRows(out: Emit, rows: SummaryRow[], what: string): void {
  if (rows.length === 0) {
    out(`  (no ${what} recorded)`);
    return;
  }
  for (const line of table(
    [what, 'count', 'last'],
    rows.map((r) => [r.label, String(r.count), r.last === null ? '' : stamp(r.last)]),
    { indent: '  ' },
  )) out(line);
}

/**
 * How the records for this invocation were obtained, and whether that has to
 * be disclosed.
 *
 * **The projection is derived and the JSONL is the truth, so a failure to
 * bring the projection up to date is never allowed to produce a stale
 * answer.** The command syncs first; if the sync fails it falls back to
 * reading the JSONL directly and SAYS SO. Answering from a projection that is
 * known to be behind, without saying it is behind, is the silent-wrong-answer
 * class this project keeps fixing — and an audit log is the last place it
 * belongs.
 */
interface Source {
  records: AuditRecord[];
  db: DatabaseSync | null;
  note: string;
}

function load(root: string, filter: AuditFilter): Source {
  let db: DatabaseSync | null = null;
  try {
    db = openProjection(root);
    // Always synced before it is queried, so a read can never be served from a
    // projection that is behind the log. `syncProjection` throws on a damaged
    // log line, which is the case the fallback below exists for.
    syncProjection(root, db);
    return { records: queryProjection(db, filter), db, note: '' };
  } catch (err) {
    try { db?.close(); } catch { /* already unusable */ }
    // The log itself is authoritative and is read directly. If IT is damaged
    // too, the throw propagates and the command reports it — which is right:
    // a damaged audit log must be reported, not worked around.
    return {
      records: filterAudit(readAudit(root), filter),
      db: null,
      note:
        `my_context: the audit query index could not be brought up to date ` +
        `(${err instanceof Error ? err.message : String(err)}). These results were read ` +
        `directly from the append-only log, which is the authoritative record, so they are ` +
        `complete — but they were not served from ${auditDbPath(root)}, and that index is ` +
        `stale until the underlying error is fixed. Deleting it is safe: it is derived and ` +
        `rebuilds from the log.`,
    };
  }
}

function cmdAudit(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }
  if (refuseUnknownFlag(args, [...DETAIL_FLAGS, ...OWN_FLAGS], VALUE_FLAGS, USAGE, out)) return 1;

  const root = ws.projectRoot;
  let filter: AuditFilter;
  let json: boolean;
  try {
    filter = buildFilter(args);
    json = wantsJson(args);
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }

  // `--files` answers a question about the log on disk, not about its records,
  // so it needs no projection and no filter.
  if (args.includes('--files')) {
    const { files, bytes } = auditSize(root);
    if (json) {
      emitJson(out, { files, bytes, projection: auditDbPath(root) });
      return 0;
    }
    out(`my_context: ${files.length} audit log segment(s), ${(bytes / 1024).toFixed(1)} KiB total.`);
    for (const file of files) out(`  ${file}`);
    out('');
    for (const line of paragraph(
      `The append-only JSONL above is the record. ${auditDbPath(root)} is a derived query ` +
      `index over it and is safe to delete — it rebuilds on the next \`mycontext audit\`. ` +
      `Rotated segments are never deleted by my_context; archiving or removing one removes ` +
      `that stretch of history for good.`,
    )) out(line);
    return 0;
  }

  const wantSummary = args.includes('--summary');
  const wantItems = args.includes('--items');
  const wantSessions = args.includes('--sessions');

  // Only the record listing gets a default limit. A summary counts everything
  // in range by definition — silently summarising the most recent 50 records
  // and calling it a summary would be a wrong answer, not a short one.
  if (!wantSummary && !wantItems && !wantSessions && filter.limit === undefined) {
    filter.limit = DEFAULT_LIMIT;
  }

  let source: Source;
  try {
    source = load(root, wantSummary || wantItems || wantSessions ? { ...filter, limit: undefined } : filter);
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }

  try {
    if (json) {
      emitJson(out, {
        ...(source.note === '' ? {} : { warning: source.note }),
        count: source.records.length,
        ...(wantItems && source.db
          ? { items: topItems(source.db, flag(args, 'role'), DEFAULT_TOP) }
          : {}),
        ...(wantSessions && source.db ? { sessions: sessions(source.db, DEFAULT_TOP) } : {}),
        ...(wantSummary ? { byOp: summarise(source) } : {}),
        ...(wantSummary || wantItems || wantSessions ? {} : { records: source.records }),
      });
      return 0;
    }

    if (source.note !== '') {
      for (const line of paragraph(source.note)) out(line);
      out('');
    }

    if (wantSummary) {
      out(`my_context: ${source.records.length} audit record(s) in range, by operation:`);
      summaryRows(out, summarise(source), 'op');
      return 0;
    }
    if (wantItems) {
      const role = flag(args, 'role');
      out(
        `my_context: the items this log names most` +
        `${role === null ? '' : ` as "${role}"`} (top ${DEFAULT_TOP}):`,
      );
      summaryRows(
        out,
        source.db === null ? itemsWithoutDb(source.records, role) : topItems(source.db, role, DEFAULT_TOP),
        'item',
      );
      return 0;
    }
    if (wantSessions) {
      out(`my_context: sessions this log has recorded (most recent ${DEFAULT_TOP}):`);
      summaryRows(
        out,
        source.db === null ? sessionsWithoutDb(source.records) : sessions(source.db, DEFAULT_TOP),
        'session',
      );
      return 0;
    }

    if (source.records.length === 0) {
      out(
        'my_context: no audit records match. The log records mutations and hook actions ' +
        '(injections by scope — which items at which tier — never their text); a workspace ' +
        'that has done neither since it was created has an empty one.',
      );
      return 0;
    }

    out(
      `my_context: ${source.records.length} audit record(s), oldest first` +
      `${filter.limit === undefined ? '' : ` (most recent ${filter.limit})`}:`,
    );
    for (const line of table(HEADERS, source.records.map(cells), { indent: '  ' })) out(line);
    return 0;
  } finally {
    try { source.db?.close(); } catch { /* nothing left to do */ }
  }
}

/** `summaryByOp` over records already loaded, so the fallback path can answer too. */
function summarise(source: Source): SummaryRow[] {
  const byOp = new Map<string, SummaryRow>();
  for (const record of source.records) {
    const row = byOp.get(record.op) ?? { label: record.op, count: 0, last: null };
    row.count++;
    if (row.last === null || record.at > row.last) row.last = record.at;
    byOp.set(record.op, row);
  }
  return [...byOp.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** The `--items` answer without a projection — same shape, same ordering. */
function itemsWithoutDb(list: AuditRecord[], role: string | null): SummaryRow[] {
  const counts = new Map<string, SummaryRow>();
  const bump = (id: string, at: string): void => {
    const row = counts.get(id) ?? { label: id, count: 0, last: null };
    row.count++;
    if (row.last === null || at > row.last) row.last = at;
    counts.set(id, row);
  };
  for (const record of list) {
    if ((role === null || role === 'subject') && record.itemId !== undefined) {
      bump(record.itemId, record.at);
    }
    if (role === null || role === 'injected') {
      for (const e of record.injected ?? []) bump(e.id, record.at);
    }
    if (role === null || role === 'spilled') {
      for (const e of record.spilled ?? []) bump(e.id, record.at);
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, DEFAULT_TOP);
}

/** The `--sessions` answer without a projection. */
function sessionsWithoutDb(list: AuditRecord[]): SummaryRow[] {
  const counts = new Map<string, SummaryRow>();
  for (const record of list) {
    if (record.sessionId === undefined) continue;
    const row = counts.get(record.sessionId)
      ?? { label: record.sessionId, count: 0, last: null };
    row.count++;
    if (row.last === null || record.at > row.last) row.last = record.at;
    counts.set(record.sessionId, row);
  }
  return [...counts.values()]
    .sort((a, b) => (b.last ?? '').localeCompare(a.last ?? '') || b.label.localeCompare(a.label))
    .slice(0, DEFAULT_TOP);
}

registerCommand({
  name: 'audit',
  usage: 'audit [--since T] [--item ID] [--op O] [--limit N]',
  summary: 'the run-time log of mutations and hook actions',
  run: cmdAudit,
});

export { cmdAudit };
