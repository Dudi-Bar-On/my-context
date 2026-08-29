import { readdirSync, renameSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  appendJsonlLine, parseJsonlLog, readJsonlFile, type JsonlRow,
} from './jsonl-log.ts';
// The projection, imported by the appender so that the ONE place a record is
// appended is also the one place it is projected. That makes this module and
// `audit-db.ts` import each other, which is safe and is deliberate rather than
// overlooked: neither one calls the other at module evaluation — every use is
// inside a function body — so the cycle resolves whichever module is entered
// first. The alternative was a second appender wrapping this one, and a second
// appender is exactly how a projection falls behind again.
import { keepProjectionCurrent, type ProjectionUpkeep } from './audit-db.ts';
// Type-only, and erased at run time: this module gains no dependency and no
// import cost from it. The state union is IMPORTED rather than respelled so
// that "off | missing | read" has exactly one definition — `HandoverRead` is
// what produces the value, and a second copy here would be a vocabulary free
// to drift from the one the reader is actually handed.
import type { HandoverAskVerdict } from './handover-ask.ts';
import type { HandoverRead } from './handover.ts';
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
// does not travel with the corpus TODAY: it is local to the machine that
// produced it, a clone of this repository elsewhere carries no audit history,
// and wiping the machine wipes the log. (v2.0 narrows that: spec 5 decides
// that the MUTATION records travel with a corpus export, filtered, while
// injections, hook actions and focus records stay behind because they describe
// a machine rather than a corpus. Nothing implements it yet, and gitignoring
// stays right either way — an export is a deliberate act, not a side effect of
// committing.) That is the right default — the log records what
// one machine's sessions saw and did, it names local file paths and session
// ids, and an append-only file committed from several machines conflicts on
// every line — but it is a real limitation, so both READMEs state it in the
// section that documents this feature. Phase 1 made the revision log
// gitignored without disclosing the equivalent consequence, and the phase
// review recorded that as a defect; this is that defect not repeated.

/**
 * The version this build STAMPS on every record it writes (plan §6n.5).
 *
 * **`@2` since the `progress` kind landed, and the bump is the whole point.**
 * From `@2` a log may contain records whose `kind` is `progress`, and
 * `specFor`'s validator below refuses an unregistered kind and takes the whole
 * SEGMENT with it. So a log written here cannot be read by a build that
 * predates the kind — in this workspace or an imported one — and the only
 * question the bump settles is what such a build SAYS. `parseJsonlLog` checks
 * the protocol before it validates `kind` or `op` (`core/jsonl-log.ts`), so the
 * refusal is *this log is newer than I am* rather than a bad-op diagnosis that
 * blames a vocabulary for a version difference.
 *
 * Downgrading stays unsupported: this does not make a `@2` log readable by an
 * older build, and `CHANGELOG.md` names it as a one-way step.
 *
 * **`@2` covers the whole v2.0 vocabulary widening, not the `progress` kind
 * alone, and no further bump is due for one.** The same validator refuses an
 * unregistered OP by the same mechanism, so `subagent-start` and
 * `post-tool-use-failure` (hooks plan Task 4) put a log equally out of a v1.0.2
 * reader's reach. They are inside the break `@2` already declares — one
 * unreleased version step for one release's vocabulary — and a second bump
 * would spend a downgrade break that has not been paid back yet.
 */
export const AUDIT_PROTOCOL = 'my_context/audit@2';

/**
 * Every version this build READS. Wider than what it writes, and that is not
 * optional.
 *
 * The check is strict membership and runs on every line. Bumping
 * `AUDIT_PROTOCOL` without widening the read set would make this build refuse
 * every log a current user already has — `@1` on every line — on the first
 * command after the upgrade, and the audit log is the one file this product
 * refuses to treat as empty when it cannot read it. That failure lands on
 * UPGRADE, which is universal, rather than on downgrade, which is rare and
 * already unsupported: the fix would have shipped as a worse bug than the one
 * it fixes. Both halves land together or neither.
 */
export const AUDIT_PROTOCOLS_READ = ['my_context/audit@1', AUDIT_PROTOCOL] as const;

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
 *
 * **`access` is the fifth, and it arrives by the same argument** (owner ruling
 * B4, 2026-08-20, plan `2026-08-16-web-ui-1-server-and-reads.md` §0.6). The web
 * UI's request gate records every request it REFUSES. A refused request changed
 * no item, was shown no corpus text and ran in no hook, so `mutation`,
 * `injection` and `hook` would each make `mycontext audit --kind …` a question
 * with a wrong answer. It is genuinely a fifth thing, so it is a fifth kind.
 *
 * **`progress` is the sixth, and it is a step tick rather than an edit** (plan
 * `2026-08-20-v2-categories-and-runbooks.md` Task 8). Ticking a step of a
 * procedure moves nothing under `items/`: the item's bytes, its `checksum` and
 * its rendered injection are all identical before and after. `mutation` means
 * "changed an item" everywhere in this module — every op in `MUTATION_OPS`
 * carries an `itemId` BECAUSE it moved that item's columns — so filing a tick
 * there would make `mycontext audit --kind mutation --item PROC-x` a question
 * with a wrong answer, and the other four kinds each claim something a tick did
 * not do. It is genuinely a sixth thing, so it is a sixth kind.
 *
 * **`execution` is the seventh, and it arrives by the sixth's argument applied
 * to something that changes MORE rather than less** (plan
 * `2026-08-27-execute-a-composed-command.md` Task 4, spec §3.4). A run of a
 * command the web UI composed may create an item, retire ten, rebuild the index
 * or touch nothing at all; the log cannot know which until the process exits,
 * and every mutation the run performs records itself under its own op anyway.
 *
 * **Why not `mutation`, specifically.** This log is ITEM-SHAPED. `mutation`
 * carries `itemId` and `fields`, and every op in `MUTATION_OPS` carries an
 * `itemId` BECAUSE it moved that item's columns. A run is not about one item and
 * may be about none. Folding it in would make every existing reader of that kind
 * wrong about what it is reading — `mycontext audit --kind mutation` would start
 * returning rows with no item and no fields, and `ui/port-model.ts`, which
 * carries `mutation` OUT of the workspace on an export and withholds every other
 * kind, would begin exporting a record of what ran on one machine. That is the
 * gap `DEC-should-the-web-ui-be-allowed-to-write-config-json` named when it
 * declined the write: a surface reading one kind as if it were another. The
 * other five kinds each claim something a run did not do — it put no corpus text
 * in front of a model, it ran in no hook, it refused no request, it ticked no
 * step. It is genuinely a seventh thing, so it is a seventh kind.
 */
export type AuditKind =
  'mutation' | 'injection' | 'hook' | 'focus' | 'access' | 'progress' | 'execution';

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

/**
 * Every act that puts corpus text in front of a model.
 *
 * **`subagent-start` is an injection and not a `hook` op, because a subagent is
 * a model** (plan `2026-08-20-v2-hooks-sessions-and-continuity.md` Tasks 9 and
 * 10). The `SubagentStart` event delivers selected items to a fresh agent that
 * has never seen this corpus; the only thing separating it from `session-start`
 * is which model received the text, and that is `sessionId`'s job rather than a
 * kind's. Filing it under `hook` — "hook actions that inject NOTHING" — would
 * make `mycontext audit --kind injection` under-report what models were shown,
 * which is the one question this log exists to answer.
 */
export const INJECTION_OPS = [
  'session-start', 'compact-restore', 'jit', 'manual', 'subagent-start',
] as const;
export type InjectionOp = (typeof INJECTION_OPS)[number];

/**
 * Hook actions that inject nothing.
 *
 * **`post-tool-use-failure` is its own op rather than a `post-tool-use` with a
 * flag** (plan Task 7). `PostToolUseFailure` is a separate Claude Code event
 * with a separate payload, and a reader asking "did the refresh after a FAILED
 * write ever run" wants a value it can pass to `--op`, not a `note` it has to
 * grep. It is also the honest spelling: a record whose op says `post-tool-use`
 * would claim an event that did not fire.
 *
 * **`session-end` records a DELETION, and that is why it exists at all.** The
 * `SessionEnd` hook removes the seen files and restore snapshot of the context
 * window `/clear` destroyed — the only firing that carries that window's id —
 * and a deletion with no record is `INV-nothing-is-dropped-silently` failing
 * at the one place it cannot be noticed later. It is also the ONLY channel that
 * event has: Claude Code echoes a `SessionEnd` hook's output to the user only
 * when the hook FAILS (`hooks/session-end.ts` · `NOTHING A SUCCESSFUL SessionEnd HOOK WRITES IS EVER SHOWN` · ~42),
 * so a hook that exits 0 — which `INV-hooks-fail-open` requires — is mute
 * everywhere else.
 *
 * **`post-compact` closes the pair `pre-compact` opens.** `PreCompact` writes
 * the restore snapshot; nothing said whether the compaction it was written for
 * then COMPLETED. A `pre-compact` row with no `post-compact` row beside it is a
 * compaction that threw after the snapshot was taken — the same
 * attempted/complete shape `subagent-start` uses, and the same reason. It and
 * `pre-compact` are the two rows that can carry `trigger`, because
 * `SessionStart(source: 'compact')` — the proxy this project inferred a
 * compaction from before `PostCompact` was registered — cannot tell a
 * user-typed `/compact` from one the context window forced. `pre-compact`
 * joined it on 2026-08-27, when the question stopped being "did a compaction
 * happen" and became "how full was the window when it did".
 *
 * **The ten OBSERVATION ops close the gap the hook survey found** (hooks plan
 * seq 21 and 2b). `file-changed`, `instructions-loaded`, `config-change`,
 * `permission-denied`, `subagent-stop`, `stop`, `setup`, `task-created`,
 * `task-completed` and `prompt-expansion` are one op per platform EVENT, for
 * `post-tool-use-failure`'s reason and no other: a reader asking "did a hand
 * edit of the corpus ever reach us" wants a value it can pass to `--op`, not a
 * `note` to grep, and an op that named a different event would claim a firing
 * that did not happen. They all inject nothing, so they are all `hook` and none
 * of them is an `injection` — the line `subagent-start` sits on the other side
 * of.
 *
 * They are inside the break `@2` already declares. `AUDIT_PROTOCOL`'s note
 * above rules that `@2` covers *the whole v2.0 vocabulary widening, not the
 * `progress` kind alone*, and these are that widening continuing: no new
 * `AuditKind`, no new field on `AuditRecord`, one unreleased version step for
 * one release's vocabulary. A second bump would spend a downgrade break that
 * has not been paid back yet.
 */
export const HOOK_OPS = [
  'pre-compact', 'post-tool-use', 'deny', 'post-tool-use-failure', 'session-end', 'post-compact',
  'file-changed', 'instructions-loaded', 'config-change', 'permission-denied', 'subagent-stop',
  'stop', 'setup', 'task-created', 'task-completed', 'prompt-expansion',
] as const;
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

/**
 * A request the web UI's gate REFUSED (owner ruling B4, 2026-08-20, plan §0.6)
 * — or a caller was handed a fresh credential (owner ruling 2026-08-28,
 * `KNOWN-a-locked-out-tab-can-only-be-recovered-by-the-restart-that-locks-
 * out-the-next-one`).
 *
 * **Two ops, and the reason it grew from one is worth stating rather than
 * quietly widening.** `ui-refused` was the gate's only recordable outcome for
 * as long as the gate could only ever refuse or serve, and "a request that
 * PASSES the gate is not recorded" was true because a served read changes
 * nothing worth writing down. `POST /api/nonce` (`src/ui/server.ts`) breaks
 * that symmetry: it is token-EXEMPT, same as `/api/handoff`, and its whole job
 * is to hand a caller holding NO credential a fresh one. A credential coming
 * into existence is a security event whether or not anything was refused, so
 * it earns its own op rather than riding along inside a family whose name
 * says the opposite of what happened. `nonce-minted` is still `access` and not
 * `mutation` — no item moved — and still not `injection` or `hook`, for the
 * reasons those two already state above. `RefusalDetail.check` stays the
 * closed vocabulary for WHY the gate said no; `nonceMint` below is the
 * sibling shape for what a caller was handed instead.
 */
export const ACCESS_OPS = ['ui-refused', 'nonce-minted'] as const;
export type AccessOp = (typeof ACCESS_OPS)[number];

/**
 * A step of a procedure ticked, un-ticked, or a whole run started over
 * (plan `2026-08-20-v2-categories-and-runbooks.md` Task 8).
 *
 * **Three ops rather than one, and each earns its place.** `step-done` alone
 * has no reset boundary, so a procedure activated a second time would inherit
 * the first run's ticks — and a procedure is one-shot precisely so that "is
 * this finished" has an answer. `step-reset` is written when a procedure is
 * activated and is the replay anchor `procedureProgress` (`core/progress.ts`)
 * counts forward from. `step-undone` exists because the log is append-only:
 * without it the only way to correct a mis-tick is a reset, which discards the
 * whole run.
 *
 * **No field is added to `AuditRecord` for it.** The procedure is `itemId`, who
 * ran the command is `origin`, and WHICH step is `note` (`step 3`) — the same
 * short, non-content `note` a discard reason and a SessionStart source use.
 * The count itself is never stored: `progressLine` computes "3 of 5" from the
 * records every time it is asked, which is what keeps a tally from disagreeing
 * with the log that is supposed to be authoritative.
 *
 * **Progress is per WORKSPACE, not per session, and that is a disclosed limit
 * rather than a claim.** No CLI surface is handed a trustworthy session id —
 * `core/focus.ts` measured exactly that and conceded it, sending focus to
 * workspace scope — so a session-keyed progress record would be written under a
 * key nothing reads. The consequence is that two terminals working one
 * procedure share one record set, which is unmeasured against the concurrency
 * case; the command discloses it in its own output.
 */
export const PROGRESS_OPS = ['step-done', 'step-undone', 'step-reset'] as const;
export type ProgressOp = (typeof PROGRESS_OPS)[number];

/**
 * A command from the UI's catalogue was RUN (plan
 * `2026-08-27-execute-a-composed-command.md` Task 4, spec §3.4).
 *
 * **One op, not one per command.** Which command ran is `command.id`, a value a
 * reader can filter on and a value that grows every time the catalogue does; an
 * op per catalogue entry would put the catalogue inside a closed vocabulary that
 * `parseAudit` refuses a whole SEGMENT over, so adding a command to the palette
 * would make yesterday's log unreadable. The op answers *did anything run*; the
 * record answers *what*.
 *
 * **TWO ops, because a run is a two-phase fact and this log cannot be amended.**
 * `execute` is written BEFORE the run; `execute-done` is appended after it. That
 * is the same attempted/complete shape `pre-compact`/`post-compact` and
 * `subagent-start` use, and it is here for the same reason: the log is
 * append-only, so a fact that is only known later is written as a second row
 * rather than by going back and changing the first.
 *
 * **An `execute` row with no `execute-done` beside it is a run that never
 * returned.** That is the fact the pair exists to make visible, and it is a fact
 * the old single-row design could not express at all — a lone row still reading
 * `exitCode: null` was indistinguishable from a run whose completion write had
 * merely failed. The pair separates them: the first row says a run was
 * authorised and started, the second says how it ended.
 *
 * **What was weighed against it, and why it lost: amending the first row in
 * place.** That is what `ui/execute.ts` used to do — `readFileSync` the whole
 * log, mutate one line in memory, `writeFileSync` it back — bought for the
 * tidiness of one row per run. It is not available here. Every hook appends to
 * this log from its own process and none of them takes a lock
 * (`core/jsonl-log.ts` · `appendJsonlLine` is a bare `appendFileSync`), so a row
 * appended by ANY other writer between that read and that write is destroyed
 * outright: the rewrite truncates the file to content that predates it. That was
 * measured, not feared — a second process appending continuously across the
 * rewrite lost between 1 and 21 rows per run. Destroying another writer's record,
 * in the log that IS the accountability story for the one feature that runs
 * commands, is worse than any number of rows a reader has to join. Do not
 * reintroduce the rewrite as a simplification.
 *
 * **The pair is correlated by `at` plus `command.id`.** Both rows are stamped
 * with the SAME instant deliberately — `recordAudit` takes an `at` for exactly
 * this case — so a reader joins them by equality rather than by guessing which
 * `execute` a later `execute-done` belongs to, an ambiguity that is real the
 * moment one command is run twice inside one millisecond. Nothing is lost by
 * sharing the stamp: `durationMs` is measured around the run itself, so the end
 * of the run is `at` plus `durationMs` and was never `execute-done`'s own clock
 * reading. No run id was invented — that would be a new concept for a question
 * two existing fields already answer, and `subagent-start`'s pair has none
 * either.
 *
 * **There is no `execute-refused` op beside them.** A run refused before it
 * started is a refusal by the request gate, and that is already `ui-refused`
 * under `access` — a second spelling of the same event would split one question
 * across two ops. A run that started and FAILED is still a run: it is recorded
 * here, with the process's non-zero `exitCode`.
 *
 * They are inside the break `@2` already declares. `AUDIT_PROTOCOL`'s note above
 * rules that `@2` covers *the whole v2.0 vocabulary widening*; this adds a kind,
 * a field and two ops to that widening, and all of them are refused by an older
 * reader through the same validator that already refuses `progress`. A second
 * bump would spend a downgrade break that has not been paid back yet.
 */
export const EXECUTION_OPS = ['execute', 'execute-done'] as const;
export type ExecutionOp = (typeof EXECUTION_OPS)[number];

export type AuditOp =
  MutationOp | InjectionOp | HookOp | FocusOp | AccessOp | ProgressOp | ExecutionOp;

export const AUDIT_OPS: AuditOp[] = [
  ...MUTATION_OPS, ...INJECTION_OPS, ...HOOK_OPS, ...FOCUS_OPS, ...ACCESS_OPS, ...PROGRESS_OPS,
  ...EXECUTION_OPS,
];

/**
 * Appended, never inserted. The order is what the CLI's `--kind` error and the
 * MCP tool's enum show a reader, and what `ui/port-model.ts` counts against; a
 * new kind slotted into the middle would silently renumber a list users read.
 */
export const AUDIT_KINDS: AuditKind[] = [
  'mutation', 'injection', 'hook', 'focus', 'access', 'progress', 'execution',
];

/** Which kind an op belongs to. One table, so no caller can classify one twice. */
const KIND_OF: Record<AuditOp, AuditKind> = {
  create: 'mutation', update: 'mutation', stage: 'mutation', promote: 'mutation',
  discard: 'mutation', supersede: 'mutation', accept: 'mutation', refresh: 'mutation',
  link: 'mutation', unlink: 'mutation',
  'session-start': 'injection', 'compact-restore': 'injection', jit: 'injection',
  manual: 'injection',
  'pre-compact': 'hook', 'post-tool-use': 'hook', deny: 'hook',
  'focus-set': 'focus', 'focus-clear': 'focus',
  'ui-refused': 'access', 'nonce-minted': 'access',
  'step-done': 'progress', 'step-undone': 'progress', 'step-reset': 'progress',
  'subagent-start': 'injection',
  'post-tool-use-failure': 'hook',
  'session-end': 'hook', 'post-compact': 'hook',
  'file-changed': 'hook', 'instructions-loaded': 'hook', 'config-change': 'hook',
  'permission-denied': 'hook', 'subagent-stop': 'hook', stop: 'hook', setup: 'hook',
  'task-created': 'hook', 'task-completed': 'hook', 'prompt-expansion': 'hook',
  // Both halves of one run, and both `execution`: a reader filtering
  // `--kind execution` wants the run, not half of it.
  execute: 'execution', 'execute-done': 'execution',
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

/**
 * The PINNED tier's undelivered items and the two numbers that size them —
 * `select`'s own `PinnedSpill`, flattened, exactly as `SpilledRef` flattens
 * `Spill`.
 *
 * **Re-declared here rather than imported from `core/select.ts`, and that is
 * the same choice `SpilledRef` makes.** An `AuditRecord` is a DURABLE on-disk
 * contract — records written today are read back by every future build — while
 * `Selection` is an in-memory shape that changes whenever the selector does.
 * Importing would tie the log's format to a type that is free to move, so a
 * refactor of the selector would silently redefine what old lines mean. The two
 * are copied field-by-field at the single call site (`core/inject.ts`), which is
 * what makes a divergence a compile error rather than a quiet reinterpretation.
 *
 * **Why the numbers are recorded rather than re-derived, and it is
 * `AuditRecord.tokens`' argument at its sharpest**: the corpus MOVES. An item
 * edited, pinned, unpinned or retired after this injection costs differently or
 * does not exist, so a `cost` recomputed over today's items is wrong for
 * precisely the corpus being maintained most actively. This is the figure the
 * budget was actually measured against, frozen at the moment it was measured.
 *
 * The ids also appear in `spilled` at `tier: 'pinned'`, and that is deliberate
 * duplication, not redundancy: `spilled` is the per-item list the audit
 * projection reads (`audit_item.role = 'spilled'`), while this is the tier-level
 * fact — *how much was asked for, how much was allowed* — which no per-item row
 * can carry. Reading it out of the reasons would mean parsing English.
 */
export interface PinnedSpillRef {
  /** The undelivered ids, in the selector's own priority order. */
  ids: string[];
  /** Estimated tokens the whole pinned candidate set cost, admitted and spilled. */
  cost: number;
  /** The `budgets.pinned` in force for this injection. */
  budget: number;
}

/**
 * Which check of the web UI's request gate refused (owner ruling B4, plan §0.6).
 *
 * A closed vocabulary, and deliberately NOT the gate's developer-facing
 * `reason` string: `reason` is prose ABOUT the check, `check` IS the check, and
 * a reader filtering the log wants the value it can filter on.
 *
 * **It is onto `validateApiRequest`'s refusing exits, not one-to-one with
 * them** — plan §0.6 field rule 1 says one-to-one, and owner ruling C6 made
 * that no longer true by splitting the Host refusal in two (no Host header at
 * all, versus a Host that is not loopback). Both carry `check: 'host'`; what
 * tells them apart in the log is `RefusalDetail.host`, which is `null` for the
 * first and the submitted value for the second. No fifth member was added,
 * because the record already distinguishes them by a field rule that exists
 * for its own reasons.
 */
export type RefusalCheck = 'host' | 'origin' | 'token-missing' | 'token-mismatch';

/**
 * What the gate refused, and what it was handed (owner ruling B4, plan §0.6).
 *
 * Built and capped by `recordRefusal` (`src/ui/security.ts`), which is the only
 * thing that writes one. The token is NOT here in any form — not the value, not
 * its length, not a prefix, not a hash: it is the secret the gate exists to
 * protect, and an audit log is a file on disk.
 */
export interface RefusalDetail {
  check: RefusalCheck;
  /** The code the sender received, so the log and the wire cannot disagree. */
  status: 401 | 403;
  method: string;
  /** `url.pathname`. NEVER `url.search` — a query string is unbounded caller text. */
  route: string;
  /** As submitted. `null` when the header was absent; `''` when it was sent empty. */
  host: string | null;
  origin: string | null;
}

/**
 * What `POST /api/nonce` was handed, on the mint it always performs (owner
 * ruling 2026-08-28). The sibling of `RefusalDetail`, at a smaller scale: this
 * route has one outcome, not four, so there is no `check` and no `status` —
 * every record means "a nonce was minted", and `host`/`origin` are kept for
 * the same reason `RefusalDetail` keeps them, so a reader does not have to
 * take on faith that the gate actually ran.
 *
 * Built and capped by `recordNonceMint` (`src/ui/security.ts`), the only
 * thing that writes one. **The minted nonce is NOT here, in any form** — it
 * is a credential and an audit log is a file on disk, the same rule
 * `RefusalDetail` states for the token it sits beside.
 */
export interface NonceMintDetail {
  /** As submitted. Always `127.0.0.1:<port>` — the gate refused anything else before this ran. */
  host: string;
  /** As submitted. `null` when the caller sent none — the ordinary case for a script, not a page. */
  origin: string | null;
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
  hook?: 'SessionStart' | 'PreToolUse' | 'PreCompact' | 'PostToolUse' | 'SubagentStart' |
    'PostToolUseFailure' | 'SessionEnd' | 'PostCompact' |
    // The observation events (hooks plan seq 21 and 2b). Spelled exactly as
    // the platform spells them in `hook_event_name`, because that is the
    // string a reader of the log will have seen in `hooks/hooks.json` and in
    // Claude Code's own diagnostics; a friendlier spelling here would be a
    // second name for one event.
    'FileChanged' | 'InstructionsLoaded' | 'ConfigChange' | 'PermissionDenied' | 'SubagentStop' |
    'Stop' | 'Setup' | 'TaskCreated' | 'TaskCompleted' | 'UserPromptExpansion';
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
  /**
   * Injections: what the PINNED tier failed to deliver, and by how much.
   *
   * Beside `injected` and beside `spilled` — the log's answer to *what did this
   * session not get* has to be readable without re-deriving it from a corpus
   * that has since moved, and without parsing a `SpilledRef.reason` apart. See
   * `PinnedSpillRef`.
   *
   * **ABSENT means nothing pinned was dropped**, and never an empty-shaped
   * claim: a record written before this field existed and a record for a tier
   * that fitted perfectly are both silent here, and both are correctly read as
   * "no undelivered pinned item is recorded". `STD-absent-vs-zero` — a reader
   * that turns an absence into `{ ids: [], cost: 0 }` would be asserting a
   * measurement nobody took.
   *
   * **Pinned only.** The other three tiers spill by design; this field is for
   * the one tier whose semantics is *always*, where a partial delivery reads as
   * a kept promise.
   */
  pinnedSpill?: PinnedSpillRef;
  /** PreToolUse: the repo-relative path that triggered the event. */
  path?: string;
  /**
   * A short, non-content note: a discard reason, a supersede target, a
   * SessionStart source, the axes of a focus change, or — on a `progress`
   * record — which step was ticked, written `step 3` and parsed back by
   * `core/progress.ts`.
   */
  note?: string;
  /**
   * `access` records only: what the gate refused, and what it was handed.
   *
   * **`AuditRecord.origin` and `RefusalDetail.origin` are different things**
   * (plan §0.6 field rule 6). The first is the origin of a MUTATION — who made
   * it; the second is the HTTP `Origin` header. The nesting is what keeps them
   * apart, and a flat `origin` here would have collided with a field that
   * already means something else. An `access` record carries no
   * `AuditRecord.origin`, no `itemId` and no `sessionId`: a refused request has
   * none of them.
   */
  refusal?: RefusalDetail;
  /**
   * `access` records only, `op: 'nonce-minted'`: a caller with no credential
   * was handed a fresh one, and what it was handed on.
   *
   * Present exactly when `refusal` is not, and never both: one record either
   * describes the gate saying no or describes a mint, and the two ops
   * (`ui-refused` / `nonce-minted`) already say which. Same nesting reason as
   * `refusal` — the HTTP `Origin` header lives here, never as a flat `origin`,
   * so it cannot collide with `AuditRecord.origin` (who made a MUTATION,
   * which a mint is not).
   */
  nonceMint?: NonceMintDetail;
  /**
   * `execution` records only: which catalogue command ran, what it ran AS, how
   * it ended, and how long it took (spec §3.4).
   *
   * **This is SCOPE, not content — the same rule `injected` follows, and for a
   * sharper reason.** `argv` is *what ran*. No stdout, no stderr, no output of
   * any kind is recorded here, by this field or beside it. The audit log is a
   * file on disk that travels between machines — that is the whole premise of
   * `at` being UTC — and a run's output is unbounded text this module never
   * chose: `mycontext show` prints an item's body, `doctor` prints file paths,
   * `ask` prints whatever a corpus contains. Recording it would put a second,
   * unchecksummed copy of corpus text in a log, which is the shape this project
   * has ruled out everywhere else, and it would do it to text a person may have
   * written expecting it to stay in one workspace. Even `argv` is only safe
   * because it is rebuilt by `resolveCommand` from the catalogue rather than
   * taken from a caller — an argument can still carry a title or an id a person
   * would not send anywhere, so nothing wider than the argv is kept.
   *
   * **TWO rows carry this field, and they say different things.** `execute` is
   * written BEFORE the run and ALWAYS carries `exitCode: null` and
   * `durationMs: 0` — at that instant nothing has exited and nothing has been
   * measured, and writing it first is what makes "a run that cannot be recorded
   * does not happen" an ordering rather than a wish. `execute-done` is appended
   * AFTER the run and carries the real exit code and the measured duration.
   * **An `execute` row with no `execute-done` beside it is a run that never
   * returned.** The two are joined by `at` plus `command.id`, which are equal
   * across the pair; `EXECUTION_OPS` above has the whole argument, including why
   * the first row is never amended in place.
   *
   * **`exitCode: null` is NOT `0`, and this is the field where getting that
   * wrong is dangerous.** `null` means the run did not finish under this
   * process's observation — it was killed on the run timeout, or (on an
   * `execute` row) the row was written before the process exited.
   * `0` is a positive claim that the command succeeded. `STD-absent-vs-zero`
   * governs hardest here because the wrong reading is the reassuring one: a
   * reader that defaults a missing exit code to 0 reports "it worked" for a run
   * nobody watched end. So the field is written explicitly as `null` rather than
   * omitted — `JSON.stringify` drops `undefined`, and an absent key would be
   * indistinguishable from a record written before this field existed.
   *
   * `durationMs` is measured, not derived from `at`: `at` is stamped when the
   * row is written, which is BEFORE the run, so an end-minus-start over the log
   * would time the wrong interval.
   */
  command?: {
    /** The catalogue id the client named. Never a command line the client sent. */
    id: string;
    /** As `resolveCommand` rebuilt it, without the leading `mycontext`. */
    argv: string[];
    /** The process's exit code, or `null` for a run that did not finish. Never 0 for that. */
    exitCode: number | null;
    /** Wall-clock milliseconds around the run itself. */
    durationMs: number;
  };
  /**
   * `pre-compact` and `post-compact`: WHY the compaction fired.
   *
   * `'manual'` or `'auto'` as the platform sends them, or the literal
   * `'<absent>'` when the payload did not say — one spelling across both hooks,
   * because a compaction is one event written down twice and a reader joining
   * the pair must not have to learn two vocabularies for the same fact.
   */
  trigger?: string;
  /**
   * `pre-compact`: how full the context window was when the compaction fired,
   * as a percentage, or `null` when it could not be measured.
   *
   * **This field exists to settle an argument with a measurement.** The owner
   * asked for a handover to be written at 98% (2026-08-27), and the concern
   * raised against it is that Claude Code's own automatic compaction fires
   * BELOW that — so the threshold might never be reached. Rather than pick a
   * number, every compaction records the one the platform actually chose, and
   * `trigger` says whether the platform chose it or a person did. After a
   * handful of automatic compactions the corpus knows the answer.
   *
   * **Written explicitly as `null`, never omitted and never 0**, for the same
   * reason `command.exitCode` is: `JSON.stringify` drops `undefined`, so an
   * absent key is indistinguishable from a row written before this field
   * existed — and the reassuring wrong reading here is "the window was empty".
   * The reason it could not be measured goes in `note`, because a reader who
   * wants the number does not want three sentinel numbers to learn.
   */
  occupancyPercent?: number | null;
  /**
   * `post-compact`: WHICH handover document the compaction resolved, what
   * state it was found in, and how many lines it held. Spec §2, plan Task 4.
   *
   * **Why three FIELDS rather than a sentence in `note`.** The question these
   * exist to answer is *did the handover this project configured actually
   * survive to the compaction that needed it* — asked across every row in the
   * log, by a person who wants a count and not a reading. `note` is prose, and
   * the same argument `pre-compact.ts` made today for `trigger` and
   * `occupancyPercent` applies unchanged: a fact worth querying does not go
   * behind a regex over English. The note keeps only what no field can carry —
   * the reason the config could not be read at all.
   *
   * **Why not `path` above.** That field means "the repo-relative path that
   * TRIGGERED the event", which a handover did not do: the compaction was not
   * caused by it, and the hook merely looked for it afterwards. Reusing it
   * would put two unrelated meanings in one column, so a reader filtering
   * `path` would get PreToolUse's tool-call paths and this hook's configured
   * handovers mixed together with nothing to tell them apart.
   *
   * **`handoverState` is not derivable from the other two, and that is the
   * point of the task.** It is tempting to read the state off the absences —
   * no `handoverPath` means off, a path with no lines means missing — and that
   * is exactly the inference `STD-absent-vs-zero` forbids: an absent key also
   * means "written before this field existed", so every historical row would
   * silently become `off`. And the two values it would confuse are the two
   * that matter most: `off` is "nobody configured a handover", `missing` is
   * "a handover was configured and is not there", which is a BROKEN AGREEMENT
   * and the whole reason this feature was written. They are recorded
   * explicitly so that no reader has to reconstruct the difference.
   *
   * All three are ABSENT, never defaulted, when the workspace's `config.json`
   * could not be read or resolved: nobody looked, and `off` is a claim that
   * somebody looked and found no `handover` key. The reason goes in `note`.
   *
   * `handoverLines` is the file's TOTAL line count, not what any session was
   * handed — this hook resolves and cannot deliver, so a delivered count here
   * would describe a delivery that did not happen. Absent when there was no
   * file to count; never 0, which would be a measurement of an empty file.
   *
   * They are inside the break `@2` already declares, with `trigger`,
   * `occupancyPercent` and `command`: an older reader refuses the whole
   * vocabulary widening through the same validator, and a second protocol bump
   * would spend a downgrade break that has not been paid back yet.
   */
  handoverState?: HandoverRead['state'];
  /** The path AS CONFIGURED, repo-relative. Absent for `off`, and for an unread config. */
  handoverPath?: string;
  /** Total lines in the file, present only for `read`. */
  handoverLines?: number;
  /**
   * `pre-compact` and `session-end`: whether the handover this session was
   * ASKED for was actually written. Plan `handover` seq:9.
   *
   * **This is the field that makes an ask falsifiable.** `Stop` asks the model
   * to bring the handover up to date at the occupancy threshold and records
   * that it asked; until this existed, nothing recorded whether anything
   * happened — so a row saying an ask went out read exactly like a mechanism
   * that worked. That is the shape of failure this project measured in a
   * neighbouring mechanism and ruled on in
   * `DEC-the-ask-and-the-writing-are-two-turns-apart-so-a-flag-is`, whose
   * load-bearing sentence is *the flag is not a claim, it is a comparison*:
   * the handover's mtime against the wall clock of the ask.
   *
   * **It goes on the two events that DESTROY a context window**, because those
   * are the two moments where the answer still changes anything: `PreCompact`,
   * which runs before a compaction, and `SessionEnd` with `reason: 'clear'`.
   * `PostCompact` is too late — it can only report — which is why the three
   * fields above are its and this one is not.
   *
   * A FIELD and not a sentence in `note`, for `trigger` and `occupancyPercent`'s
   * reason: *how often is the handover we ask for actually written* is a
   * question asked across every row in the log by somebody who wants a count,
   * and a fact worth querying does not go behind a regex over English. The note
   * carries what no field can — which ask, when, and when the file was last
   * written.
   *
   * The five values are `core/handover-ask.ts`'s and are argued there. Two of
   * them look redundant and are not: `off` is "nobody configured a handover"
   * and `not-asked` is "somebody did and this session never crossed the
   * threshold", the same distinction `handoverState` keeps between `off` and
   * `missing`. And `unverifiable` is never folded into `ignored`: an accusation
   * nothing supports is the same defect as a guarantee nothing supports.
   *
   * Inside the break `@2` already declares, with `trigger`, `occupancyPercent`,
   * `command` and the three `handover*` fields above.
   */
  handoverAsk?: HandoverAskVerdict;
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
    accepts: AUDIT_PROTOCOLS_READ,
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
 *
 * **Returns the segment it renamed the log to, or `null`**, because the
 * projection has to be told. A rename is the one thing an append-only log does
 * that a position-tracked projection cannot reconcile by appending — the same
 * bytes reappear under a name it has never heard of, and the live log it HAS
 * heard of has shrunk to nothing. `keepProjectionCurrent` carries the offsets
 * across the rename when it is handed the new name, and reports a divergence
 * when it is not; `null` is therefore an answer this function must be honest
 * about, and a rotation another process won returns `null` here because this
 * one did not perform it.
 */
function rotateIfFull(root: string, file: string): string | null {
  let size: number;
  try {
    size = statSync(file).size;
  } catch {
    return null; // no log yet
  }
  if (size < AUDIT_MAX_BYTES) return null;
  const stamp = new Date().toISOString().replace(/[-:.]/g, '');
  const rotated = path.join(auditDir(root), `audit.${stamp}-${process.pid}.jsonl`);
  try {
    renameSync(file, rotated);
    return rotated;
  } catch {
    // Another process may have rotated it out from under us, or the rename may
    // have been refused. Either way the append below is still correct.
    return null;
  }
}

/** What an append did. See `recordAudit` for why this is returned rather than thrown. */
export interface AuditWriteResult {
  written: boolean;
  /** The failure, when `written` is false. Never swallowed — callers disclose it. */
  error?: string;
  /**
   * What the same call did to the audit projection beside the log. Present
   * whenever `written` is true, and absent when it is false — there is nothing
   * to project when nothing was appended.
   *
   * Four outcomes and only one of them is a fault: `updated` (the projection
   * is current), `unbuilt` (there is no projection to keep current, which is an
   * empty state), `diverged` (a rebuild is owed, and a rebuild is
   * `mycontext audit`'s to do), `failed` (a fault, spoken by
   * `auditFailureNote`).
   */
  projection?: ProjectionUpkeep;
}

/**
 * The sentence a caller appends to its own message when the audit record could
 * not be written, or when it was written and the projection beside it could
 * not be updated. Spelled once so no surface invents a softer wording for it.
 *
 * The two are different failures and are worded as such. A record that never
 * reached the LOG is missing from the history for good. A record that reached
 * the log but not the PROJECTION costs nothing durable — the log is the
 * authority and holds it — and leaves the projection behind, which the read
 * surfaces already report honestly and `mycontext audit` ends. Reporting the
 * second in the first's words would tell a user their audit trail has a hole
 * in it when it does not.
 *
 * `unbuilt` and `diverged` are deliberately silent here. Neither is a fault:
 * one is a workspace that has never built a projection, the other is a state
 * the read surface names precisely and a rebuild resolves. The task that asked
 * for this said so exactly — the correct outcome is that state, not an error
 * pressed into every caller's output.
 */
export function auditFailureNote(result: AuditWriteResult): string {
  if (!result.written) {
    return (
      ` NOTE: the operation succeeded but its audit record could NOT be written ` +
      `(${result.error}). This operation is missing from \`mycontext audit\`. Fix the underlying ` +
      `error before relying on the log being complete.`
    );
  }
  if (result.projection?.outcome === 'failed') {
    return (
      ` NOTE: the audit record was written, but the audit PROJECTION could not be updated ` +
      `(${result.projection.error}). No record was lost — the log is the authority and holds it ` +
      `— but the projection is now behind the log, which read surfaces report rather than answer ` +
      `from. \`mycontext audit\` catches it up.`
    );
  }
  return '';
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
  let rotatedTo: string | null = null;
  // **The log append gets its own try, and the projection is outside it.**
  // Not tidiness: a projection error caught by THIS block would be returned as
  // `written: false` for a record that is on disk, and a caller would tell a
  // user their operation is missing from the audit log when it is not. The
  // authority is settled here and reported below; the derived store is dealt
  // with afterwards or not at all.
  try {
    const file = auditLogPath(root);
    rotatedTo = rotateIfFull(root, file);
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
  } catch (err) {
    return { written: false, error: err instanceof Error ? err.message : String(err) };
  }
  // The record is in the log. Everything from here is upkeep on a derived
  // store: `keepProjectionCurrent` never throws, never rebuilds, and never
  // creates a projection that does not exist, so the worst it can do is leave
  // the projection exactly where the old behaviour left it after EVERY append
  // — one record behind — and say so.
  return { written: true, projection: keepProjectionCurrent(root, rotatedTo) };
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
 *  - `continuity` is excluded for a THIRD reason, and it is not the one above:
 *    that tier really does deliver full text. Its `at` is a WINDOW identity
 *    marker, like a restored row's, so replaying it needs `recordRestored`'s
 *    refresh and not `record`'s insert-or-ignore — and `recordRestored` writes
 *    the literal tier `'restored'`. The seen FILE is the authority for
 *    continuity dedupe (`continuityFor`, seen-file.ts) and nothing asks the
 *    ledger about it, so the row would answer no question while being able to
 *    answer it wrongly. Stated here rather than left as an absence.
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
