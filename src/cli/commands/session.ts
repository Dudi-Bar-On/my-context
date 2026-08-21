import { sessions, type SummaryRow } from '../../core/audit-db.ts';
import { readSeen, seenIds } from '../../core/seen-file.ts';
import { readSessionNames } from '../../core/session-names.ts';
import type { Workspace } from '../../core/workspace.ts';
import { AUDIT_TOP, auditStamp, loadAuditSource, sessionsWithoutDb } from './audit.ts';
import { toCliMessage } from './context.ts';
import { emitJson, paragraph, refuseUnknownFlag, table, wantsJson } from './format.ts';
import { positionals, registerCommand, type Emit } from './registry.ts';

/**
 * `mycontext session` — which sessions this workspace has had, and which of
 * them there is still anything to carry from.
 *
 * **Nothing new is enumerated here.** The audit log already knows every
 * session it has recorded, over the projection (`core/audit-db.ts` ·
 * `export function sessions(db: DatabaseSync, limit: number): SummaryRow[] {` · ~781)
 * and without one (`cli/commands/audit.ts` ·
 * `function sessionsWithoutDb(list: AuditRecord[]): SummaryRow[] {` · ~492),
 * and `mycontext audit --sessions` prints one such listing today. This command
 * imports that pair rather than growing a fourth copy of the question — see
 * the export block at the foot of `audit.ts` for why all four pieces travel
 * together.
 *
 * What it adds is the two columns a *selector* needs and a summary row does
 * not have: the name a person gave the session, and whether anything of that
 * session survives to be carried.
 *
 * **Nothing is invented for an unnamed session.** No derived label, no
 * "session from Tuesday", not even the short prefix moved into the name
 * column: a derived name can be wrong, and naming is precisely the moment you
 * know what a session was for. The short prefix is a poor label and an honest
 * one, and it has a column of its own.
 */

export const SUBCOMMANDS = ['list'] as const;

const USAGE = 'usage: mycontext session [list] [--json]';

/**
 * The flags each subcommand accepts, per subcommand rather than one union —
 * the shape `procedure` and `review` use. Tasks 15 and 18 add subcommands to
 * this file, and a `--json` silently accepted on a subcommand that writes is
 * exactly the swallow `unknownFlag` exists to stop.
 */
const SESSION_FLAGS: Record<string, { allowed: string[]; values: string[] }> = {
  list: { allowed: ['json'], values: [] },
};

/** How many characters of a session id fit a label. */
const SHORT = 8;

/**
 * One row of the listing.
 *
 * `name` is `null` rather than `''` for an unnamed session, and the two are
 * not the same claim: `null` is "nobody named this", which is what a JSON
 * consumer has to be able to tell from a name that happens to be empty — a
 * name that cannot exist, because `setSessionName` refuses one.
 */
export interface SessionRow {
  session: string;
  short: string;
  name: string | null;
  /** How many records this log holds for the session. */
  activity: number;
  /** ISO-8601 of the most recent record, or `null` if the log carries none. */
  last: string | null;
  /** Whether a seen file still holds ids for this session — see `carryable`. */
  carryable: boolean;
}

/**
 * **`carryable` is not decoration.**
 *
 * Carrying items forward reads the source session's seen file, and `state/` is
 * swept at 30 days by mtime (`core/ledger.ts` ·
 * `export function pruneSnapshots(` · ~770), so a session the audit log still
 * names can have nothing left on disk. A selector that offered such a session
 * would fail silently at the next session start — the user would choose it,
 * nothing would arrive, and no surface would say why. This column answers "is
 * there anything left to carry" before the choice is made.
 *
 * It is computed from the ids the seen file yields, not from the file's
 * existence: a file that exists and parses to nothing carries nothing, and
 * saying "yes" about it would be the same silent failure one step later.
 */
function carryable(root: string, sessionId: string): boolean {
  return seenIds(readSeen(root, sessionId)).length > 0;
}

function rowsFor(root: string, summary: SummaryRow[]): SessionRow[] {
  const { names } = readSessionNames(root);
  return summary.map((row) => ({
    session: row.label,
    short: row.label.slice(0, SHORT),
    name: names.get(row.label)?.name ?? null,
    activity: row.count,
    last: row.last,
    carryable: carryable(root, row.label),
  }));
}

/** `out` for a sentence rather than a line — `procedure`'s helper, same reason. */
function say(out: Emit, text: string, prefix = ''): void {
  for (const line of paragraph(text, prefix, undefined, ' '.repeat(prefix.length))) out(line);
}

function cmdList(root: string, args: string[], out: Emit): number {
  const source = loadAuditSource(root, {});
  let summary: SummaryRow[];
  try {
    summary = source.db === null
      ? sessionsWithoutDb(source.records)
      : sessions(source.db, AUDIT_TOP);
  } finally {
    try { source.db?.close(); } catch { /* nothing left to do */ }
  }

  const rows = rowsFor(root, summary);
  const nameStore = readSessionNames(root);

  if (wantsJson(args)) {
    emitJson(out, { count: rows.length, sessions: rows });
    return 0;
  }

  if (source.note !== '') { out(source.note); out(''); }

  if (rows.length === 0) {
    say(out,
      'my_context: no sessions in this log yet. A session appears here once a hook has ' +
      'recorded something for it — an injection at session start, or a just-in-time delivery ' +
      'against a file you touched.');
    return 0;
  }

  out(`my_context: sessions this workspace has recorded (most recent ${AUDIT_TOP}):`);
  for (const line of table(
    ['session', 'short', 'name', 'activity', 'last', 'carryable'],
    rows.map((row) => [
      row.session,
      row.short,
      // Empty, deliberately: see this module's doc comment.
      row.name ?? '',
      String(row.activity),
      row.last === null ? '' : auditStamp(row.last),
      row.carryable ? 'yes' : 'no',
    ]),
    { indent: '  ' },
  )) out(line);

  out('');
  say(out,
    '`carryable` is whether that session\'s dedupe state is still on disk. `state/` is swept ' +
    'at 30 days, so a session this log still names can have nothing left to carry.',
    'note: ');
  // Failing open costs labels and nothing else — but a listing full of empty
  // name cells is indistinguishable from a workspace where nobody has named a
  // session, which is the difference this sentence exists to make.
  if (nameStore.error !== null) {
    say(out,
      `\`.my_context/state/session-names.json\` ${nameStore.error}, so the names below it are ` +
      `not shown. The listing itself is complete — it comes from the audit log.`,
      'note: ');
  }
  return 0;
}

function cmdSession(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }
  const root = ws.projectRoot;

  const [subcommand = 'list'] = positionals(args, []);
  if (!(SUBCOMMANDS as readonly string[]).includes(subcommand)) {
    out(`my_context: unknown session subcommand "${subcommand}".\n\n${USAGE}`);
    return 1;
  }

  const { allowed, values } = SESSION_FLAGS[subcommand];
  if (refuseUnknownFlag(args, allowed, values, USAGE, out)) return 1;

  try {
    return cmdList(root, args, out);
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }
}

registerCommand({
  name: 'session',
  usage: 'session [list] [--json]',
  summary: 'the sessions this workspace has had, their names, and what is left to carry',
  run: (ws, args, out) => cmdSession(ws, args, out),
});

export { cmdSession };
