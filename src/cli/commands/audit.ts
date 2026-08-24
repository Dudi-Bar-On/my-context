import type { DatabaseSync } from 'node:sqlite';
import {
  AUDIT_KINDS, AUDIT_OPS, auditSize, filterAudit, parseWhen, readAudit,
  type AuditFilter, type AuditKind, type AuditOp, type AuditRecord,
} from '../../core/audit.ts';
import {
  auditDbPath, openProjection, queryProjection, sessions, syncProjection, topItems,
  type SummaryRow,
} from '../../core/audit-db.ts';
import { COMMAND_FLAGS } from '../../core/command-flags.ts';
import { Ledger } from '../../core/ledger.ts';
import { topUpLedger } from '../../core/ledger-replay.ts';
import { enumError } from '../../core/teach.ts';
import type { Origin } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { toCliMessage } from './context.ts';
import {
  emitJson, paragraph, refuseUnknownFlag, table, wantsJson,
} from './format.ts';
import { flag, registerCommand, type Emit } from './registry.ts';

const USAGE =
  'usage: mycontext audit [--since T] [--until T] [--item ID] [--session ID] [--kind K] ' +
  '[--op O] [--origin R] [--limit N] [--summary|--items [--role subject|injected|spilled]' +
  '|--sessions|--files] [--json]';

/**
 * This command's flag surface, LIFTED to `core/command-flags.ts` so a read
 * surface can have it without reaching a module that writes. Nothing about
 * what is accepted changed; the reasoning is in that module's header.
 */
const { allowed: ALLOWED, values: VALUE_FLAGS } = COMMAND_FLAGS.audit;

const DEFAULT_LIMIT = 50;
const DEFAULT_TOP = 20;

const ORIGINS: Origin[] = ['human', 'agent', 'ingest'];

/**
 * How an item can appear in a record, which is what `--role` selects between.
 *
 * These are the three branches `itemsWithoutDb` and `topItems` actually test.
 * The flag took any string at all until this list existed: `--role subjekt`
 * counted nothing and said nothing, which is the same silent-wrong-answer
 * failure `--kind` and `--op` are already guarded against by `enumError`.
 */
const AUDIT_ROLES = ['subject', 'injected', 'spilled'];

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
 * What the detail column says about a record carrying a `note`: that it has
 * one. Not what it says.
 *
 * The note itself is deliberately NOT rendered here, for the arithmetic reason
 * spelled out under `HEADERS` below. `table` (format.ts) narrows a table only
 * while the table's own longest unbreakable tokens still fit the 100-column
 * budget, and this one's floor is already 91 of those 100 on a corpus with
 * 38-character ids. The notes on these records are built out of ids, paths and
 * errno strings — `cross-layer duplicate id(s): <ids>` (core/inject.ts:320),
 * `dropped by the fallback (first: <file>)` (hooks/pre-tool-use.ts:270),
 * `SNAPSHOT WRITE FAILED (<message>)` (hooks/pre-compact.ts:90) — so their
 * longest token is unbounded in practice, not short. Measured on those three
 * note strings: appending them whole moves the floor to 123, 113 and 123,
 * `table` then declines to narrow at all, and the listing renders 178–209
 * columns wide for the terminal to rewrap mid-cell. That is the failure
 * `list --full` exists to avoid, and trading it for the one below would be no
 * trade at all.
 *
 * The marker hangs off the same ` — ` the mutation branch uses to hold a note
 * away from its fields, and that spacing is what makes it free: no existing
 * token grows, `note` is four characters against a six-character header, and
 * the measured floor stays exactly 91. `NOTE_LEGEND` says under the table
 * where the text went.
 */
const NOTE_MARK = ' — note';

/**
 * Whether this record's `note` reaches the reader as a marker only.
 *
 * One predicate for the cell and for the legend, because a legend printed over
 * rows carrying no marker — or a marker with no legend — is worse than either
 * alone.
 */
function noteIsMarkedOnly(record: AuditRecord): boolean {
  return (record.kind === 'injection' || record.op === 'pre-compact')
    && record.note !== undefined && record.note !== '';
}

/**
 * Printed under the listing when at least one row was marked, and only then: a
 * legend for a marker nothing on screen carries is noise.
 *
 * It names the degradations, because naming them is the point of the marker.
 * `INV-nothing-is-dropped-silently` was being defeated at the view layer: in a
 * workspace where two of four runs had been served from a broken index, all
 * four rows printed as `2 jit, ~54 tokens` — identical to the character — and
 * the note that said otherwise was stored and never shown.
 */
const NOTE_LEGEND =
  'A row ending "— note" carries a note this column has no room for, and a degraded run is ' +
  'what those notes usually record: a tool call served from the Markdown fallback because the ' +
  'index could not be read, a session start whose index refresh was dropped, a PreCompact ' +
  'snapshot that failed to write. `mycontext audit --json` prints them in full.';

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
    const base = `${shown}${spilled === 0 ? '' : `, ${spilled} spilled`}`;
    const note = noteIsMarkedOnly(record) ? NOTE_MARK : '';
    if (record.kind !== 'injection') return base + note; // pre-compact captures, delivers nothing
    // `tokens` is the estimate the budget was spent against at injection time
    // (see AuditRecord.tokens). A record from before the field existed says so
    // in as many words: absent is "not recorded", and printing 0 — or nothing —
    // would turn "unknown" into a measurement.
    return (record.tokens === undefined
      ? `${base}, tokens not recorded`
      : `${base}, ~${record.tokens} tokens`) + note;
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
 * failure `list --full` exists to avoid. Without it the floor is 91 and the
 * table lands exactly on the budget.
 *
 * **What that does NOT buy, stated because the obvious reading is wrong:** it
 * does not hold the budget at the project's hostile id length of 67
 * characters. The `subject` column IS an id, so a 67-character id puts the
 * floor above 100 whatever else is dropped, and `table` then leaves the whole
 * thing at natural width — deliberately, since squeezing an unreachable table
 * buys nothing and costs five-line rows that still overflow (see `table`'s own
 * doc comment). `mycontext list` has the same property for the same reason.
 * Measured: 100 columns at 38-character ids, ~187 at 67. `--json` is the
 * surface that does not care.
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

  // `mycontext audit replay-ledger`: project the audit log's injection
  // records into the ledger table (`topUpLedger`). The command `audit.ts`'s
  // `ledgerRows` docblock promised — the caller that owns the write.
  if (args[0] === 'replay-ledger') {
    const ledger = Ledger.open(ws.dbPath);
    try {
      const { applied, diverged } = topUpLedger(ws.projectRoot, ledger);
      out(`replayed ${applied} row(s)${diverged ? ' after a full rebuild (log diverged)' : ''}.`);
      return 0;
    } finally {
      ledger.close();
    }
  }
  if (refuseUnknownFlag(args, ALLOWED, VALUE_FLAGS, USAGE, out)) return 1;

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

  // `--role` is read in exactly one place — the `--items` rollup — because a
  // role is how an item APPEARS IN a record, which is a question only the
  // per-item view asks. It was accepted everywhere and silently ignored
  // outside that view, so `mycontext audit --role injected` returned the
  // unfiltered log and said nothing about it: a filter that looks like it
  // worked. Refused here rather than quietly applied elsewhere, on the same
  // rule the rest of this CLI follows — a flag that would do nothing is
  // refused, not stored.
  const role = flag(args, 'role');
  if (role !== null) {
    if (!AUDIT_ROLES.includes(role)) {
      out(enumError('role', role, AUDIT_ROLES, 'workflow'));
      return 1;
    }
    if (!wantItems) {
      out(
        `my_context: --role classifies how an item appears in a record, so it only means ` +
        `something for the per-item rollup. Add --items to group by item, or drop --role ` +
        `and use --kind/--op/--origin, which filter the records themselves.`,
      );
      return 1;
    }
  }

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
          ? { items: topItems(source.db, role, DEFAULT_TOP) }
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
    if (source.records.some(noteIsMarkedOnly)) {
      out('');
      for (const line of paragraph(NOTE_LEGEND, '  ')) out(line);
    }
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

/**
 * The enumeration `mycontext session list` runs on, exported rather than
 * written a second time.
 *
 * Three implementations of "which sessions has this log seen" already exist —
 * `sessions` over the projection, `sessionsWithoutDb` over the records, and
 * the `--sessions` branch above that picks between them — and a fourth in
 * `cli/commands/session.ts` would be the hand-kept duplicate this project
 * keeps paying for: the two would answer differently the first time either
 * changed its ordering or its cap, and nothing would say so.
 *
 * So all four pieces of that one answer travel together:
 *
 *  - `loadAuditSource` is the projection-with-fallback loader, including the
 *    sentence it discloses when the projection could not be brought up to
 *    date. A second copy of that fallback is a second chance to forget the
 *    disclosure.
 *  - `sessionsWithoutDb` is the no-database sibling of `audit-db.ts`'s
 *    `sessions`, and was module-private until this export.
 *  - `AUDIT_TOP` is the cap BOTH halves apply — `sessionsWithoutDb` slices to
 *    it internally, so a caller passing anything else to `sessions` would get
 *    two different answers from the same log depending on whether a
 *    projection happened to be openable.
 *  - `auditStamp` is the timestamp column's rendering, so two tables over the
 *    same records do not spell the same instant two ways.
 */
export {
  cmdAudit,
  load as loadAuditSource,
  sessionsWithoutDb,
  stamp as auditStamp,
  DEFAULT_TOP as AUDIT_TOP,
};
export type { Source as AuditSource };
