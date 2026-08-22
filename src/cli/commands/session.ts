import { sessions, type SummaryRow } from '../../core/audit-db.ts';
import {
  readCarrySource, resolveCarry, SESSION_SHORT_ID, setCarrySource,
} from '../../core/continuity.ts';
import { readSeen, seenIds } from '../../core/seen-file.ts';
import { readSessionNames, setSessionName } from '../../core/session-names.ts';
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

export const SUBCOMMANDS = ['list', 'name', 'carry'] as const;

const USAGE = `usage: mycontext session [list] [--json]
       mycontext session name <session-id> <name>
       mycontext session carry <session-id> | --none | --show`;

/**
 * The flags each subcommand accepts, per subcommand rather than one union —
 * the shape `procedure` and `review` use. A `--json` silently accepted on
 * `name`, which writes, is exactly the swallow `unknownFlag` exists to stop:
 * it would look like a request for machine-readable output and be discarded.
 */
const SESSION_FLAGS: Record<string, { allowed: string[]; values: string[] }> = {
  list: { allowed: ['json'], values: [] },
  name: { allowed: [], values: [] },
  carry: { allowed: ['none', 'show'], values: [] },
};

/**
 * How many characters of a session id fit a label.
 *
 * Imported rather than declared here, because the carry disclosure injected
 * into a session falls back to exactly this prefix when the session has no name
 * (`core/continuity.ts` · `export const SESSION_SHORT_ID = 8;` · ~48). Two
 * spellings of one number would print two different handles for one session,
 * and the column below is where a user reads the handle they then type back.
 */
const SHORT = SESSION_SHORT_ID;

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

/**
 * The enumeration, once, for both subcommands.
 *
 * `name` resolves an id against **exactly the set `list` prints** rather than
 * against a wider read of the log, and that is the whole reason this is one
 * function instead of two. Its refusal points at `mycontext session list`, so
 * a set the pointer does not show would make the refusal a lie: the user would
 * be sent to a listing that does not contain the id they were told is unknown.
 * The residual, said rather than hidden: `AUDIT_TOP` caps both, so a session
 * older than the most recent ones cannot be named — the same cap, in the same
 * place, for both halves of the command.
 */
function enumerate(root: string): { rows: SessionRow[]; note: string } {
  const source = loadAuditSource(root, {});
  let summary: SummaryRow[];
  try {
    summary = source.db === null
      ? sessionsWithoutDb(source.records)
      : sessions(source.db, AUDIT_TOP);
  } finally {
    try { source.db?.close(); } catch { /* nothing left to do */ }
  }
  return { rows: rowsFor(root, summary), note: source.note };
}

/** `out` for a sentence rather than a line — `procedure`'s helper, same reason. */
function say(out: Emit, text: string, prefix = ''): void {
  for (const line of paragraph(text, prefix, undefined, ' '.repeat(prefix.length))) out(line);
}

function cmdList(root: string, args: string[], out: Emit): number {
  const { rows, note } = enumerate(root);
  const nameStore = readSessionNames(root);

  if (wantsJson(args)) {
    emitJson(out, { count: rows.length, sessions: rows });
    return 0;
  }

  if (note !== '') { out(note); out(''); }

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

/** How one candidate is spelled in a refusal: the id, and its name if it has one. */
function candidate(row: SessionRow): string {
  return row.name === null ? row.session : `${row.session} (${JSON.stringify(row.name)})`;
}

/**
 * The two clauses of a refusal that describe what the caller was trying to do.
 *
 * `resolveSession` is shared by `name` and `carry` on purpose — both must
 * resolve against **exactly the set `list` prints**, and a second resolver
 * would be a second answer to "which sessions can this command reach". But a
 * refusal is not generic: `carry` reusing `name`'s sentences told a user with
 * an empty log that there was "nothing to attach a name to yet" when they had
 * asked to carry, which is a message about a command they did not run. A
 * reader who has to translate the refusal cannot act on it.
 *
 * So the SET is shared and the SENTENCES are per-subcommand. Each clause
 * completes a fixed opening, which is what keeps the two variants parallel
 * instead of drifting into two differently-shaped errors.
 */
interface SessionPurpose {
  /** Completes `my_context: there are no sessions in this log …`. */
  nothingToDo: string;
  /** Completes `my_context: no session in this log starts with "…". …`. */
  whyRefused: string;
}

const NAME_PURPOSE: SessionPurpose = {
  nothingToDo:
    'to name. A session appears here once a hook has recorded something for it — an injection ' +
    'at session start, or a just-in-time delivery against a file you touched — so there is ' +
    'nothing to attach a name to yet. `mycontext session list` shows the same emptiness.',
  whyRefused:
    'Naming a session this log has never seen is a typo, and accepting it would put an entry ' +
    'in the store that nothing can ever reach — so it is refused rather than written. ' +
    '`mycontext session list` prints every id this command can name.',
};

const CARRY_PURPOSE: SessionPurpose = {
  nothingToDo:
    'to carry from. A session appears here once a hook has recorded something for it — an ' +
    'injection at session start, or a just-in-time delivery against a file you touched — so ' +
    'there is no earlier session for a new one to carry forward from. ' +
    '`mycontext session list` shows the same emptiness.',
  whyRefused:
    'Carrying from a session this log has never seen is a typo, and storing it would leave a ' +
    'source that delivers nothing at the next session start and says nothing about why — so ' +
    'it is refused rather than written. `mycontext session list` prints every id this command ' +
    'can carry from.',
};

/**
 * The session `given` names, or why nothing was named.
 *
 * **A full id or an unambiguous prefix, and never a guess.** A prefix matching
 * two known sessions comes back as a refusal listing both, because the only
 * other options are worse in the same way: picking the first would attach the
 * name to a session the user did not mean and report success, and picking "the
 * most recent" would do the same thing while sounding reasonable. Neither is
 * recoverable by reading the output, since a name that landed on the wrong
 * session looks exactly like one that landed on the right one.
 *
 * An exact match wins outright, before prefixes are considered, so a full id
 * that also happens to be a prefix of a longer one still resolves.
 */
function resolveSession(
  rows: SessionRow[], given: string, purpose: SessionPurpose,
): { row: SessionRow | null; error: string | null } {
  if (rows.length === 0) {
    return {
      row: null,
      error: `my_context: there are no sessions in this log ${purpose.nothingToDo}`,
    };
  }

  const exact = rows.find((row) => row.session === given);
  if (exact) return { row: exact, error: null };

  const matches = rows.filter((row) => row.session.startsWith(given));
  if (matches.length === 0) {
    return {
      row: null,
      error: `my_context: no session in this log starts with ${JSON.stringify(given)}. ` +
        purpose.whyRefused,
    };
  }
  if (matches.length > 1) {
    return {
      row: null,
      error: `my_context: ${JSON.stringify(given)} is a prefix of ${matches.length} sessions, ` +
        `so it is refused rather than resolved to one of them: ` +
        `${matches.map(candidate).join(', ')}. Give enough of the id to pick one.`,
    };
  }
  return { row: matches[0], error: null };
}

/**
 * `mycontext session name <id> <name>` — give one session a handle a person
 * can type.
 *
 * **The id is explicit, and this command never guesses which session it is
 * in.** `core/focus.ts` ·
 * `has a trustworthy session id: the CLI runs in a terminal and is handed none,` · ~25
 * is the fact behind that: no writable CLI surface is handed a session id at
 * all, so "the current session" is not a thing this command could resolve even
 * if it wanted to. The id comes from `mycontext session list`, and a prefix of
 * it is accepted only while it picks out exactly one session.
 *
 * **This writes NO audit record, and that is a decision rather than an
 * oversight.** Naming is a user action on session *metadata*: it changes no
 * item, it changes nothing about what governs this project, and it puts no
 * text in front of a model. `AuditKind` (`core/audit.ts` ·
 * `export type AuditKind = 'mutation' | 'injection' | 'hook' | 'focus' | 'access' | 'progress';` · ~136)
 * is a closed union — `access` joined it on 2026-08-20 and `progress` on
 * 2026-08-21 — and none of its members describes this. Adding a seventh kind
 * for a label is a larger decision than the feature, taken by whoever needs the
 * record, not smuggled in beside it. Until then the name store itself is the
 * record: every entry carries the instant it was stamped
 * (`core/session-names.ts` · `at: string;` · ~50).
 *
 * Everything the name itself has to satisfy — non-empty, at most
 * `SESSION_NAME_MAX`, no control characters, and not already held by another
 * session — is `setSessionName`'s (`core/session-names.ts` ·
 * `export function setSessionName(root: string, sessionId: string, name: string): SessionNameWrite {` · ~230),
 * refused there and reported here verbatim. Restating those rules in this file
 * would be the second hand-kept copy that goes stale.
 */
function cmdName(root: string, args: string[], out: Emit): number {
  const [, given, name, ...extra] = positionals(args, []);
  if (given === undefined || name === undefined) { out(USAGE); return 1; }

  // Joined rather than refused, a name typed with two spaces in it would come
  // back with one — the silent normalisation `refuseName` exists to refuse,
  // arriving through the argument parser instead. So the shell has to be the
  // one that made it a single argument.
  if (extra.length > 0) {
    out(
      `my_context: \`mycontext session name\` takes exactly two arguments — an id and a name ` +
      `— and it was given ${extra.length + 2}. A name with a space in it has to be quoted, so ` +
      `that the shell hands it over as one argument: ` +
      `\`mycontext session name ${given} "${[name, ...extra].join(' ')}"\`. Joining them here ` +
      `would hand back a name nobody typed.\n\n${USAGE}`,
    );
    return 1;
  }

  const { rows, note } = enumerate(root);
  // The same note `list` prints, on the same terms: the answer below was read
  // from the authoritative log, so it is complete — but the derived index it
  // was NOT served from is stale, and that is worth saying beside a write.
  if (note !== '') { out(note); out(''); }

  const { row, error } = resolveSession(rows, given, NAME_PURPOSE);
  if (row === null) { out(error as string); return 1; }

  const previous = row.name;
  const write = setSessionName(root, row.session, name);
  if (!write.written) { out(write.error as string); return 1; }

  // The FULL id, never the prefix the user typed: a prefix that resolved has
  // to show what it resolved to, or the confirmation is about something the
  // reader cannot check. And a replaced name is said rather than dropped —
  // the old handle stops working at this line, and nothing else would tell
  // anyone that.
  out(previous === null || previous === name
    ? `my_context: session ${row.session} is now named ${JSON.stringify(name)}.`
    : `my_context: session ${row.session} is now named ${JSON.stringify(name)}. That replaces ` +
      `${JSON.stringify(previous)}, which now names nothing.`);
  return 0;
}

/**
 * `mycontext session carry` — which session a new one carries forward from.
 *
 * Three forms, and `--show` is not the convenience of the three: it is the only
 * way to read what the DEFAULT resolves to, and the default is what almost
 * every workspace is running. A selector whose current value can be read only
 * by starting a session and inspecting the injected block is a setting nobody
 * can check before it matters.
 *
 * **`carry <id>` refuses an id that is not carryable**, on the terms
 * `carryable` above describes: `state/` is swept at 30 days, so a session this
 * log still names can have nothing left on disk. Storing it would fail at the
 * next session start with nothing to say why — the user would choose, nothing
 * would arrive, and no surface would connect the two. The refusal lives here
 * rather than in `setCarrySource` because it needs the audit listing, and
 * `core/continuity.ts` is on the hook path and opens no database.
 *
 * **This writes no audit record**, for the reason `cmdName` gives at length:
 * `AuditKind` is a closed union and none of its members describes a change to
 * session metadata that puts no text in front of a model and changes nothing
 * about what governs this project.
 */
function cmdCarry(root: string, args: string[], out: Emit): number {
  const none = args.includes('--none');
  const show = args.includes('--show');
  if (none && show) {
    out(
      'my_context: `--none` sets the carry source and `--show` reads it, so the two together ' +
      `would report a value that was true for an instant. Run them separately.\n\n${USAGE}`,
    );
    return 1;
  }

  const [, given, ...extra] = positionals(args, []);
  if (extra.length > 0) {
    out(`my_context: \`mycontext session carry\` takes one session id.\n\n${USAGE}`);
    return 1;
  }
  if (given !== undefined && (none || show)) {
    out(
      `my_context: \`mycontext session carry ${given}\` and its flags are three separate forms ` +
      `of one command, not options on each other.\n\n${USAGE}`,
    );
    return 1;
  }

  if (none) {
    const write = setCarrySource(root, null);
    if (!write.written) { out(write.error as string); return 1; }
    say(out,
      'my_context: nothing is carried forward. New sessions get this project\'s index in its ' +
      'own order, with nothing marked. `mycontext session carry --show` reads that back, and ' +
      '`mycontext session carry <id>` turns it back on.');
    return 0;
  }

  if (given === undefined || show) return showCarry(root, out);

  const { rows, note } = enumerate(root);
  if (note !== '') { out(note); out(''); }

  const { row, error } = resolveSession(rows, given, CARRY_PURPOSE);
  if (row === null) { out(error as string); return 1; }
  if (!row.carryable) {
    say(out,
      `my_context: session ${row.session} has nothing left to carry — its dedupe state is no ` +
      'longer on disk, and `state/` is swept at 30 days. Choosing it would store a source that ' +
      'delivers nothing at the next session start and says nothing about why. ' +
      '`mycontext session list` marks every session carryable or not.');
    return 1;
  }

  const write = setCarrySource(root, row.session);
  if (!write.written) { out(write.error as string); return 1; }
  // The FULL id, never the prefix that was typed — the rule `cmdName` follows,
  // for the same reason: a prefix that resolved has to show what it resolved to
  // or the confirmation is about something the reader cannot check.
  out(
    `my_context: new sessions carry forward from ${row.session}` +
    `${row.name === null ? '' : ` (${JSON.stringify(row.name)})`}.`,
  );
  return 0;
}

/**
 * What a new session would carry today, and whether that is a choice or the
 * default.
 *
 * **The two are said apart.** "Nobody has chosen, and the rule picks X" and
 * "somebody chose X" behave identically until a newer session appears, at which
 * point the first silently moves and the second does not. A reader who cannot
 * tell them apart cannot predict either one.
 *
 * The current session id is `null` here, and has to be: no CLI surface is
 * handed one — `core/focus.ts` ·
 * `has a trustworthy session id: the CLI runs in a terminal and is handed none,` · ~25.
 * So this answer excludes no session as "the current one", where a live session
 * start excludes its own. That difference is stated in the note rather than
 * left to surprise somebody whose own session is the newest file in `state/`.
 */
function showCarry(root: string, out: Emit): number {
  const chosen = readCarrySource(root);
  if (chosen.error !== null) {
    say(out,
      `\`.my_context/state/continuity.json\` ${chosen.error}, so the choice in it is not in ` +
      'effect and the default below is what runs.', 'note: ');
    out('');
  }

  if (chosen.chosen && chosen.source === null) {
    say(out,
      'my_context: nothing is carried forward — `mycontext session carry --none` is in effect. ' +
      '`mycontext session carry <id>` turns it back on.');
    return 0;
  }

  const carry = resolveCarry(root, null);
  if (carry === null) {
    say(out, chosen.chosen
      ? `my_context: session ${chosen.source as string} is the chosen carry source and there is ` +
        'nothing left to carry from it — its dedupe state is no longer on disk. Nothing will be ' +
        'carried until another session is chosen.'
      : 'my_context: nothing would be carried forward. No session in this workspace has dedupe ' +
        'state left on disk, so the default has no source to pick.');
    return 0;
  }

  say(out,
    `my_context: new sessions carry ${carry.ids.length} item id(s) forward from ` +
    `${carry.sessionId} (${carry.label})` +
    (chosen.chosen
      ? ', chosen with `mycontext session carry`.'
      : ', by default — the most recent other session, which moves as new sessions run.'));
  out('');
  say(out,
    'a carried id is marked in the index and hoisted to the front of it; it is not delivered in ' +
    'full, and it shares `budgets.index` with every other line. An id the source session only ' +
    'ever saw as an index line is not carried at all. The CLI is handed no session id, so this ' +
    'answer excludes nothing as the current session — a live session start excludes its own.',
    'note: ');
  // **The number above is the source session's, and the number that matters is
  // decided later.** How many of these ids reach the index is settled at the
  // session start, against that moment's corpus and `budgets.index`, and the
  // injected block discloses the difference itself — by id and by reason. This
  // sentence NAMES that disclosure rather than restating any of it: a second
  // account of which ids got a line would be a second answer to a question one
  // surface already answers, and the reader would have no way to tell which of
  // the two happened.
  say(out,
    'this count is what the source session HAD. How many of those ids get an index line is ' +
    'decided at the next session start, and the injected block says which ones did not and ' +
    'why, under its index heading.',
    'note: ');
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
    if (subcommand === 'name') return cmdName(root, args, out);
    if (subcommand === 'carry') return cmdCarry(root, args, out);
    return cmdList(root, args, out);
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }
}

registerCommand({
  name: 'session',
  // Derived from SUBCOMMANDS, not restated: `review`'s comment explains why a
  // second hand-kept spelling of a subcommand list drifts.
  usage: `session [${SUBCOMMANDS.join('|')}] [<session-id>] [<name>] [--json]`,
  summary: 'the sessions this workspace has had, their names, and what is left to carry',
  run: (ws, args, out) => cmdSession(ws, args, out),
});

export { cmdSession };
