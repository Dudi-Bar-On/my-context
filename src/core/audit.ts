import { readdirSync, renameSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  appendJsonlLine, parseJsonlLog, readJsonlFile, type JsonlRow,
} from './jsonl-log.ts';
import type { Origin } from './types.ts';

// --- The run-time audit log -------------------------------------------------
//
// `REQ-changes-are-timestamped-and-audited` is a `hard` requirement in this
// project's own corpus, and until this module existed it was satisfied by
// nothing: git plus a frontmatter date, which is precisely what the
// requirement excludes ("Git is a development-time artifact and must NOT be
// relied on"). This is the log it asks for.
//
// **What it records (plan decision Q3): mutations and hook actions, including
// injections — an injection's SCOPE, not its content.** Which items, at which
// tier, and what the budget did with them; never the injected text. Two
// reasons, both load-bearing:
//
//  1. Size. The text of every governing item, re-recorded on every session
//     start and every matching tool call, would be many times the corpus per
//     day. Ids and tiers are tens of bytes per item.
//  2. Trust. The injected text is a copy of item bodies, and a second copy of
//     a governing item living in a file no checksum covers is the one shape
//     this project has ruled out everywhere else. Scope answers "what did this
//     session actually see" without duplicating the corpus into a log.
//
// **The log is authoritative and everything derived from it is rebuildable.**
// That is the same relationship Markdown has to the SQLite index, deliberately,
// so the project has one story about durability rather than two. In particular
// the injection ledger (`core/ledger.ts`) lives inside the disposable
// `.index.db` and dies with it — which is why this log is needed at all — and
// `ledgerRows` below reconstructs it from here.
//
// **Excluded from `computeItemChecksum`, and never read during rebuild or
// repair.** Nothing in this module is reachable from `item.ts`, `rebuild.ts`
// or `cli/commands/repair.ts`; an item's bytes do not depend on whether the
// log exists, is empty, or has a million lines. `test/core/audit-checksum.test.ts`
// executes that rather than asserting it.
//
// **Gitignored, and the consequence is disclosed rather than left to be
// discovered.** `ensureLogDir` writes `*` into `.audit/.gitignore`, so the log
// never travels with the corpus: it is local to the machine that produced it,
// a clone of this repository elsewhere carries no audit history, and wiping
// the machine wipes the log. That is the right default — the log records what
// one machine's sessions saw and did, it names local file paths and session
// ids, and an append-only file committed from several machines conflicts on
// every line — but it is a real limitation, so both READMEs state it in the
// section that documents this feature. Phase 1 made the revision log
// gitignored without disclosing the equivalent consequence, and the phase
// review recorded that as a defect; this is that defect not repeated.

export const AUDIT_PROTOCOL = 'my_context/audit@1';

/**
 * Three families, because a reader filtering the log wants exactly this cut:
 * what changed the corpus, what a session was shown, and what the hooks did
 * besides showing something.
 */
/**
 * Four families, because a reader filtering the log wants exactly this cut:
 * what changed the corpus, what a session was shown, what the hooks did besides
 * showing something, and what narrowed the corpus a session will be shown.
 *
 * **`focus` is its own kind rather than a `mutation`, and the reason is not
 * taste.** `mutation` means "changed an item" everywhere else in this module —
 * every op in `MUTATION_OPS` carries an `itemId`, and `fields` names the item
 * columns that moved. A focus change touches no item; it changes which of them
 * will be injected from now on. Filing it under `mutation` would make
 * `mycontext audit --kind mutation --item X` a question with a wrong answer,
 * and filing it under `injection` would claim text reached a model when none
 * did. It is genuinely a fourth thing, so it is a fourth kind.
 */
export type AuditKind = 'mutation' | 'injection' | 'hook' | 'focus';

/**
 * Every operation that changes an item. One record per act, not per write:
 * `refresh` and `promote` both apply through `updateItem`, and both record
 * their own name rather than a second, indistinguishable `update`.
 */
export const MUTATION_OPS = [
  'create', 'update', 'stage', 'promote', 'discard', 'supersede', 'accept', 'refresh',
  'link', 'unlink',
] as const;
export type MutationOp = (typeof MUTATION_OPS)[number];

/** Every act that puts corpus text in front of a model. */
export const INJECTION_OPS = ['session-start', 'compact-restore', 'jit', 'manual'] as const;
export type InjectionOp = (typeof INJECTION_OPS)[number];

/** Hook actions that inject nothing. */
export const HOOK_OPS = ['pre-compact', 'post-tool-use', 'deny'] as const;
export type HookOp = (typeof HOOK_OPS)[number];

/**
 * Setting and clearing the session focus.
 *
 * **A focus change is audited, and it has to be.** It is the one operation on
 * this surface that changes what every later session is shown without changing
 * a single item, and it is reachable by an agent through the `focus_context`
 * MCP tool. An agent that narrows its own context and then reports on "the
 * rules for this project" is describing a corpus it chose; `origin` on these
 * records is what makes that visible afterwards. The record carries the axes as
 * a `note` — scope, not content, the same rule injections follow.
 */
export const FOCUS_OPS = ['focus-set', 'focus-clear'] as const;
export type FocusOp = (typeof FOCUS_OPS)[number];

export type AuditOp = MutationOp | InjectionOp | HookOp | FocusOp;

export const AUDIT_OPS: AuditOp[] = [
  ...MUTATION_OPS, ...INJECTION_OPS, ...HOOK_OPS, ...FOCUS_OPS,
];

export const AUDIT_KINDS: AuditKind[] = ['mutation', 'injection', 'hook', 'focus'];

/** Which kind an op belongs to. One table, so no caller can classify one twice. */
const KIND_OF: Record<AuditOp, AuditKind> = {
  create: 'mutation', update: 'mutation', stage: 'mutation', promote: 'mutation',
  discard: 'mutation', supersede: 'mutation', accept: 'mutation', refresh: 'mutation',
  link: 'mutation', unlink: 'mutation',
  'session-start': 'injection', 'compact-restore': 'injection', jit: 'injection',
  manual: 'injection',
  'pre-compact': 'hook', 'post-tool-use': 'hook', deny: 'hook',
  'focus-set': 'focus', 'focus-clear': 'focus',
};

export function kindOf(op: AuditOp): AuditKind {
  return KIND_OF[op];
}

/** One item's presence in an injection: which item, at which tier. Never its text. */
export interface InjectedRef {
  id: string;
  tier: string;
  /**
   * The ledger stamp for this entry, when it is NOT the record's own `at`.
   *
   * Exactly one tier needs it. A `restored` row's `injected_at` is not a clock
   * reading at all — it is an identity marker for one compaction, set to the
   * triggering snapshot's `capturedAt` and later compared for EQUALITY (see
   * `Ledger.recordRestored`). Recording only the record's wall-clock `at`
   * would make `ledgerRows` replay a marker that matches no snapshot, and
   * restore idempotency would be lost on the rebuild that is supposed to
   * restore it.
   */
  at?: string;
}

/** One item the budget excluded, and why — `select`'s own `Spill`, flattened. */
export interface SpilledRef extends InjectedRef {
  reason: string;
}

export interface AuditRecord {
  protocol: string;
  /** UTC ISO-8601, always. Items and logs travel between machines. */
  at: string;
  kind: AuditKind;
  op: AuditOp;
  /** Mutations: who made it. Absent on injections and hook actions. */
  origin?: Origin;
  /** Mutations: the item acted on. */
  itemId?: string;
  /** Mutations: which fields the write actually changed, sorted. */
  fields?: string[];
  /**
   * Injections and hook actions: the session, when one is known. The `manual`
   * op never has one — the MCP server has no trustworthy session id, which is
   * the same disclosed limitation `inject.ts` records for the ledger.
   */
  sessionId?: string;
  /** Injections and hook actions: which hook ran. Absent for `manual`. */
  hook?: 'SessionStart' | 'PreToolUse' | 'PreCompact' | 'PostToolUse';
  /** Injections: what was delivered, by tier. THE SCOPE, NOT THE CONTENT. */
  injected?: InjectedRef[];
  /**
   * Injections: the estimated token count of what `injected` delivered,
   * COMPUTED AT INJECTION TIME. It is `Selection.tokens` verbatim — the sum of
   * the chars/4 estimates (`estimateTokens`, select.ts) the selector charged
   * its budgets for every admitted full-text block (with its joining
   * separator) and every index line. Spilled items and un-budgeted
   * scaffolding — section headers, the "+N more" line, the focus/spill/
   * revision/load-error notes — are outside the budgets and outside this
   * number.
   *
   * Recorded rather than derived later, deliberately: the corpus moves, so
   * recomputing over today's items gives a wrong answer for any injection
   * that predates an edit, supersede or retirement — drifting fastest for
   * exactly the corpus being maintained most actively. This field is the
   * number the budget was actually spent against, frozen at the moment it
   * was spent.
   *
   * ABSENT on records written before this field existed, and absence means
   * "not recorded" — never zero. Zero is a real measurement (an injection
   * record whose every candidate spilled delivered nothing); a reader that
   * defaults a missing value to 0 turns "unknown" into a claim. Every read
   * surface says "not recorded" for the old records instead.
   */
  tokens?: number;
  /** Injections: what the budget excluded, with the reason `select` gave. */
  spilled?: SpilledRef[];
  /** PreToolUse: the repo-relative path that triggered the event. */
  path?: string;
  /** A short, non-content note: a discard reason, a supersede target, a SessionStart source. */
  note?: string;
}

/** What a caller supplies; `protocol` and `at` are stamped here. */
export type AuditInput = Omit<AuditRecord, 'protocol' | 'at'> & { at?: string };

export function auditDir(root: string): string {
  return path.join(root, '.audit');
}

export function auditLogPath(root: string): string {
  return path.join(auditDir(root), 'audit.jsonl');
}

/**
 * The size at which the live log is rotated to a dated segment and a fresh one
 * started: 8 MiB, which is roughly 20,000–40,000 records.
 *
 * **Growth is decided here rather than deferred in silence.** The revision log
 * shipped in Phase 1 with no compaction and no `doctor` check, and the phase
 * review recorded that as an undisclosed liability; this log is written on
 * every tool call, so repeating it would be worse. What rotation does and does
 * not do, stated exactly:
 *
 *  - It bounds the size of any ONE file, which is what keeps `mycontext audit`
 *    and the read path from having to parse an unbounded file to answer a
 *    question about last Tuesday.
 *  - It does NOT delete anything and never will from inside this module.
 *    Rotation renames; every record ever written is still on disk in a
 *    segment. Deleting audit records is a decision for the person being
 *    audited, not for the thing doing the auditing.
 *  - Total growth is therefore still unbounded, and that is disclosed:
 *    `doctor`'s `audit_log_size` check reports the segment count and total
 *    bytes once they pass `AUDIT_REPORT_BYTES` and names the segments as safe
 *    to archive or delete. A user who does nothing gets a slowly growing
 *    directory of bounded files and is told so, rather than one unbounded file
 *    and no signal.
 */
export const AUDIT_MAX_BYTES = 8 * 1024 * 1024;

/** The total size at which `doctor` starts mentioning the log. */
export const AUDIT_REPORT_BYTES = 32 * 1024 * 1024;

/** `audit.<compact ISO>-<pid>.jsonl` — sorts chronologically by name. */
const SEGMENT_PATTERN = /^audit\.[0-9TZ]+-\d+\.jsonl$/;

/**
 * Every segment of the log, oldest first, with the live `audit.jsonl` last.
 *
 * Rotated segments are named from a UTC timestamp with the punctuation
 * stripped, so a lexicographic sort of the names is a chronological sort of
 * the records — no file has to be opened to put the segments in order.
 */
export function auditSegments(root: string): string[] {
  const dir = auditDir(root);
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const rotated = names.filter((n) => SEGMENT_PATTERN.test(n)).sort();
  const out = rotated.map((n) => path.join(dir, n));
  if (names.includes('audit.jsonl')) out.push(auditLogPath(root));
  return out;
}

function specFor(file: string) {
  return {
    file,
    protocol: AUDIT_PROTOCOL,
    validate: (row: JsonlRow): string | null => {
      if (typeof row.at !== 'string') return 'is missing or mistypes "at"';
      if (typeof row.op !== 'string' || !AUDIT_OPS.includes(row.op as AuditOp)) {
        return `declares op ${JSON.stringify(row.op)}, which is not one of ${AUDIT_OPS.join(', ')}`;
      }
      if (typeof row.kind !== 'string' || !AUDIT_KINDS.includes(row.kind as AuditKind)) {
        return `declares kind ${JSON.stringify(row.kind)}, which is not one of ` +
          `${AUDIT_KINDS.join(', ')}`;
      }
      return null;
    },
    refuse: (line: number, reason: string): Error => new Error(
      `my_context: the audit log at ${file} cannot be trusted — line ${line} ${reason}. ` +
      `Refusing to read it, because a line this code skipped could be the record of a ` +
      `mutation or an injection, and an audit trail that silently omits entries is worse ` +
      `than one that refuses to answer. Only a damaged FINAL line is tolerated (that is what ` +
      `a process killed mid-append leaves). Inspect the file: it is one JSON object per line, ` +
      `each with "at", "kind" and "op" fields. Moving the damaged segment aside preserves ` +
      `every other segment — see \`mycontext audit --files\`.`,
    ),
    unreadable: (err: unknown): Error => new Error(
      `my_context: could not read the audit log at ${file} ` +
      `(${err instanceof Error ? err.message : String(err)}). This is NOT the same as "nothing ` +
      `has been recorded" — reading it that way would report an empty audit history for a ` +
      `workspace that has one, which is the single answer an audit trail must never give. ` +
      `Investigate the underlying error before retrying.`,
    ),
  };
}

/**
 * Rotates the live log if it has reached `AUDIT_MAX_BYTES`.
 *
 * A rename, never a rewrite: no byte of any completed record is touched, which
 * is what keeps the whole thing append-only across the rotation boundary. The
 * pid is in the name because two processes can reach the threshold in the same
 * millisecond, and a rename onto an existing segment would destroy it.
 *
 * Best-effort: a rotation that fails leaves the live log where it is and the
 * append proceeds. An oversized log is a growth problem; a lost record is an
 * audit problem, and only one of the two is worth failing a write over.
 */
function rotateIfFull(root: string, file: string): void {
  let size: number;
  try {
    size = statSync(file).size;
  } catch {
    return; // no log yet
  }
  if (size < AUDIT_MAX_BYTES) return;
  const stamp = new Date().toISOString().replace(/[-:.]/g, '');
  try {
    renameSync(file, path.join(auditDir(root), `audit.${stamp}-${process.pid}.jsonl`));
  } catch {
    // Another process may have rotated it out from under us, or the rename may
    // have been refused. Either way the append below is still correct.
  }
}

/** What an append did. See `recordAudit` for why this is returned rather than thrown. */
export interface AuditWriteResult {
  written: boolean;
  /** The failure, when `written` is false. Never swallowed — callers disclose it. */
  error?: string;
}

/**
 * The sentence a caller appends to its own message when the audit record could
 * not be written. Spelled once so no surface invents a softer wording for it.
 */
export function auditFailureNote(result: AuditWriteResult): string {
  if (result.written) return '';
  return (
    ` NOTE: the operation succeeded but its audit record could NOT be written ` +
    `(${result.error}). This operation is missing from \`mycontext audit\`. Fix the underlying ` +
    `error before relying on the log being complete.`
  );
}

/**
 * Appends one record. Never throws.
 *
 * **Not throwing is not the same as failing silently, and the difference is
 * the whole design here.** By the time this runs, the mutation has already
 * been written to Markdown and to the index, or the injection has already been
 * rendered — throwing would report failure for something that succeeded, and
 * on the hook path it would break a session, which `INV-hooks-fail-open`
 * forbids outright. So the failure is RETURNED, and the two callers do
 * different, correct things with it:
 *
 *  - Mutations (`persist` in mutate.ts, the settlements in revision.ts) put
 *    `auditFailureNote` into the message the human or agent reads, so a
 *    mutation missing from the log says so at the moment it happens.
 *  - Hooks discard it, because there is no one to tell — a hook's stdout is
 *    the model's context, and a warning about log I/O does not belong there.
 *    `doctor`'s `audit_log_size` check reads the same directory, so a log that
 *    has stopped being writable is still discoverable; what is NOT recoverable
 *    is the specific hook record that was lost. That is the disclosed cost of
 *    failing open, stated here and in both READMEs rather than papered over.
 */
export function recordAudit(root: string, input: AuditInput): AuditWriteResult {
  try {
    const file = auditLogPath(root);
    rotateIfFull(root, file);
    // `at` is written AFTER the spread, not before it: a caller that passes
    // `at: undefined` explicitly (which `exactOptionalPropertyTypes` does not
    // forbid) would otherwise spread that `undefined` over a good stamp and
    // produce a record with no timestamp at all. A caller passes a real `at`
    // when several records must share one instant — a session start's
    // injection and the ledger rows beside it — rather than drifting apart by
    // a millisecond.
    const record: AuditRecord = {
      protocol: AUDIT_PROTOCOL,
      ...input,
      at: input.at ?? new Date().toISOString(),
    };
    appendJsonlLine(auditDir(root), file, record);
    return { written: true };
  } catch (err) {
    return { written: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Every record in the log, oldest first, across every segment.
 *
 * Reads whole files: this is the READ surface, not the hot path. Nothing on
 * the hook path calls this — `recordAudit` appends without reading — which is
 * what keeps a growing log from making every tool call slower.
 */
export function readAudit(root: string): AuditRecord[] {
  const out: AuditRecord[] = [];
  for (const file of auditSegments(root)) {
    out.push(...(readJsonlFile(specFor(file)) as unknown as AuditRecord[]));
  }
  return out;
}

/** For a caller that already holds the bytes (a test, or a segment reader). */
export function parseAudit(raw: string, file: string): AuditRecord[] {
  return parseJsonlLog(raw, specFor(file)) as unknown as AuditRecord[];
}

/**
 * `--since 7d`, `--since 2026-08-16` and a full ISO-8601 instant all work.
 *
 * A bare date is read as UTC midnight, deliberately, matching the `Z` stamp
 * every record carries. Reading it as local midnight would make the same query
 * select different records on two machines, which for an audit question is the
 * wrong kind of convenience.
 *
 * It lives here rather than beside the CLI command that first needed it,
 * because the `audit_log` MCP tool accepts the same spellings and the two must
 * not drift — and because an MCP server importing a module whose top level
 * registers CLI commands is a side effect nobody asked for.
 */
export function parseWhen(raw: string, flagName: string): string {
  const relative = /^(\d+)([dhm])$/.exec(raw.trim());
  if (relative) {
    const n = Number(relative[1]);
    const ms = { d: 86_400_000, h: 3_600_000, m: 60_000 }[relative[2] as 'd' | 'h' | 'm'];
    return new Date(Date.now() - n * ms).toISOString();
  }
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw.trim()) ? `${raw.trim()}T00:00:00.000Z` : raw.trim();
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      `my_context: ${flagName} must be an ISO-8601 instant ("2026-08-16T09:00:00Z"), a date ` +
      `("2026-08-16", read as UTC midnight), or a span back from now ("7d", "12h", "30m"). ` +
      `You passed ${JSON.stringify(raw)}.`,
    );
  }
  return parsed.toISOString();
}

export interface AuditFilter {
  /** Inclusive lower bound, ISO-8601. */
  since?: string;
  /** Exclusive upper bound, ISO-8601. */
  until?: string;
  itemId?: string;
  sessionId?: string;
  kind?: AuditKind;
  op?: AuditOp;
  origin?: Origin;
  /**
   * Keep the LAST n records after every other filter — the newest, which is
   * what "recent operations" means. Applied last so a limit never hides a
   * record the filters selected in favour of one they did not.
   */
  limit?: number;
}

/**
 * The one filter implementation. The CLI command, the MCP tool and every test
 * ask this function, so `mycontext audit --item X` and `audit_log({item: X})`
 * can never disagree about what "records for X" means — the class of drift
 * this project has found five times.
 *
 * An injection record matches `itemId` when the item appears in `injected` OR
 * in `spilled`. Both are true answers to "what happened to this item in this
 * session", and a spill is the more interesting half: it is the record of an
 * item that was eligible and did not fit.
 */
export function filterAudit(records: AuditRecord[], filter: AuditFilter): AuditRecord[] {
  const matches = (r: AuditRecord): boolean => {
    if (filter.since !== undefined && r.at < filter.since) return false;
    if (filter.until !== undefined && r.at >= filter.until) return false;
    if (filter.kind !== undefined && r.kind !== filter.kind) return false;
    if (filter.op !== undefined && r.op !== filter.op) return false;
    if (filter.origin !== undefined && r.origin !== filter.origin) return false;
    if (filter.sessionId !== undefined && r.sessionId !== filter.sessionId) return false;
    if (filter.itemId !== undefined) {
      const named = r.itemId === filter.itemId
        || (r.injected ?? []).some((e) => e.id === filter.itemId)
        || (r.spilled ?? []).some((e) => e.id === filter.itemId);
      if (!named) return false;
    }
    return true;
  };
  const kept = records.filter(matches);
  if (filter.limit === undefined || filter.limit <= 0 || kept.length <= filter.limit) return kept;
  return kept.slice(kept.length - filter.limit);
}

/**
 * One injection-ledger row, as the audit log remembers it.
 *
 * **This is what settles the ledger's disposition, and the decision is: the
 * ledger STAYS, as a derived cache, and is rebuildable from here.**
 *
 * It is not subsumed, because the two have different jobs and different access
 * patterns. The ledger answers `seen(sessionId)` on the hot path — a point
 * query the PreToolUse hook makes on every tool call inside a 50 ms p95
 * ceiling — and `decay` is computed from its `usage`/`recentSessions`
 * aggregates. Serving either from an append-only JSONL means scanning the
 * whole history per call, which is exactly the unbounded per-tool-call cost
 * `recordAudit` is written to avoid. An indexed table is the right shape for
 * both.
 *
 * What was wrong before was not that the ledger existed but that it was the
 * ONLY record, and it lives inside `.index.db`, which `rebuild` discards and
 * `Store.open`'s corruption self-heal deletes outright. So the injection
 * history died with a file the product describes as disposable. It no longer
 * does: every injection is recorded here first, and `ledgerRows` replays them.
 *
 * Two honest limits, stated rather than glossed:
 *
 *  - Only injections carrying a `sessionId` can be replayed. The `manual`
 *    op (`load_context`) has none, for the reason `inject.ts` documents at
 *    length — the MCP server has no trustworthy session id — so a manual load
 *    is in the audit log but contributes no ledger row, exactly as it
 *    contributes none today.
 *  - The `restored` tier's `injected_at` is an identity marker for one
 *    compaction, not a wall-clock reading (see `Ledger.recordRestored`).
 *    Replay restores the recorded `at`, which is that same marker, so restore
 *    idempotency survives a replay of a completed compaction. A replay that
 *    lands mid-compaction can re-restore once; that is the safe direction.
 *  - Only the three tiers `Ledger` itself stores are replayed. The audit log
 *    additionally records `index` (a session-start index LINE, which is text
 *    the model saw but not a full-text delivery) and `snapshot` (a PreCompact
 *    capture, which delivered nothing at all). Replaying either would make a
 *    rebuilt ledger claim deliveries the live one never made, and `seen` —
 *    which the selector consults on the hot path — would then suppress items
 *    that were never actually injected.
 */
export interface ReplayRow {
  sessionId: string;
  itemId: string;
  tier: string;
  at: string;
}

/**
 * The ledger rows implied by the audit log, oldest first.
 *
 * Kept separate from `core/ledger.ts` so that module keeps no knowledge of the
 * audit log and this one opens no database: the write is owned by
 * `topUpLedger` (`core/ledger-replay.ts`), which the `mycontext audit
 * replay-ledger` subcommand runs. Duplicates are left in — `Ledger.record` is
 * insert-or-ignore and `recordRestored` refreshes, so replaying in order
 * reproduces the same table the live writes did.
 */
/** Exactly the tiers `core/ledger.ts` stores — see `ledgerRows`' third limit. */
const LEDGER_TIERS = new Set(['pinned', 'jit', 'restored']);

export function ledgerRows(records: AuditRecord[]): ReplayRow[] {
  const out: ReplayRow[] = [];
  for (const r of records) {
    if (r.kind !== 'injection' || r.sessionId === undefined) continue;
    for (const entry of r.injected ?? []) {
      if (!LEDGER_TIERS.has(entry.tier)) continue;
      out.push({
        sessionId: r.sessionId, itemId: entry.id, tier: entry.tier, at: entry.at ?? r.at,
      });
    }
  }
  return out;
}

/** Total bytes and segment count on disk, for `doctor` and for `audit --files`. */
export function auditSize(root: string): { files: string[]; bytes: number } {
  const files = auditSegments(root);
  let bytes = 0;
  for (const file of files) {
    try {
      bytes += statSync(file).size;
    } catch {
      // A segment removed between the listing and the stat contributes nothing.
    }
  }
  return { files, bytes };
}
