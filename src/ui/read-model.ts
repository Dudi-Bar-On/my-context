/**
 * Every `/api` read handler, as a pure function of `(workspace, url)` — no
 * HTTP types, so each is testable by calling it.
 *
 * **Composition only.** The rules are `select`, `matchesScope`, `isEligible`,
 * `injection`, `scopePolicyFor`, `estimateTokens` and the `Ledger` reads (spec
 * §3's table), joined from Task 10 by `reviewQueue`, `runChecks`,
 * `computeDecay` and the revision-log reads. An endpoint here MAY NOT
 * reimplement one: this project has paid repeatedly for a second
 * implementation of a rule that already existed, and a server that answers
 * "what would Claude get" with its own arithmetic is that failure in a new
 * medium.
 *
 * **The server never rebuilds.** The hook reads the store as-is
 * (`hooks/pre-tool-use.ts`), and "see exactly what Claude gets" means reading
 * exactly what the hook reads. Staleness is doctor's `index_stale` finding,
 * surfaced by the status screen — never silently repaired here.
 *
 * **Nothing in this module writes.** Both database handles are opened through
 * read-only doors (`withStores`), and every filesystem read it reaches was
 * checked by reading the body rather than by grepping the module:
 * `readSeen` and `readFocus`; `runChecks`, whose whole `checks.ts` imports
 * only `accessSync`, `existsSync`, `readdirSync`, `readFileSync` and
 * `statSync` from `node:fs`; and `pendingRevisionSummaries`, which is Task 6's
 * extraction precisely so a read surface can count the queue without
 * importing `revision.ts`. That is enforced from two sides rather than
 * promised here: Task 14's static import-graph test over `src/ui/`, and Task
 * 13's runtime assertion that a real corpus is byte-identical after every read
 * route has been exercised.
 *
 * **The audit PROJECTION is never opened, by either door.** `openProjection`
 * creates the audit directory (`ensureLogDir`), can `rmSync` the projection
 * and both its WAL sidecars, and runs twelve `CREATE … IF NOT EXISTS`
 * statements; `openProjectionReadOnlyChecked` (`core/audit-db.ts`) exists for
 * a reader that needs the data, and no endpoint in this module does.
 * `/api/decay` is a LEDGER read and `/api/doctor` runs no audit-projection
 * check — `checkAuditSize` stats the JSONL segments. The three views that do
 * want `audit_item.role` joined to `audit.at` (§0.3 rows 4, 8 and 9) are
 * reported as unserved rather than approximated from what is here.
 *
 * **With one measured exception that belongs in the same sentence, because a
 * runtime byte-identical assertion will meet it.** Opening a WAL-mode database
 * READ-ONLY makes SQLite build the WAL index, and it creates `.index.db-shm`
 * and `.index.db-wal` to do it — a CLI-built corpus has neither, one
 * `Store.openReadOnlyChecked` has both, and only a WRITABLE close removes them
 * again (measured in `read-model.test.ts`, "reading a corpus that HAS a ledger
 * moves no byte"). No corpus byte moves and nothing in the index changes, but
 * two files appear under `.my_context/` on a pure read path. It is the engine,
 * not this module — and it is the difference between "no file changes" and "no
 * file appears", which Task 13 has to state rather than discover.
 */
import path from 'node:path';
import { computeDecay, type DecayReport } from '../core/decay.ts';
import {
  Ledger, LedgerUninitializedError, type InjectionEvent, type SessionSummary,
} from '../core/ledger.ts';
import { readFocus } from '../core/focus.ts';
import { renderSelection } from '../core/render.ts';
import { pendingRevisionCounts, pendingRevisionSummaries } from '../core/revision-log.ts';
import {
  itemCost, reviewQueue, select, tiersRun,
  type SelectContext, type SelectEvent, type Selection,
} from '../core/select.ts';
import { readSeen, seenIds, type SeenLine } from '../core/seen-file.ts';
import { Store } from '../core/store.ts';
import { VERSION } from '../core/version.ts';
import { runChecks, type Finding } from '../doctor/checks.ts';
import type { Budgets, Config } from '../core/config.ts';
import type { Item } from '../core/types.ts';
import type { Workspace } from '../core/workspace.ts';
import type { JsonResult } from './routes.ts';

export const badRequest = (error: string): JsonResult => ({ status: 400, body: { error } });

/**
 * Refuse any query parameter this endpoint does not act on
 * (INV-nothing-is-dropped-silently). `/api/select?sesion=x` answering the
 * cold-session question because a typo dropped `session` would be this
 * project's canonical defect wearing an HTTP status of 200.
 */
export function unknownParams(url: URL, allowed: string[]): string | null {
  // An empty allow-list is a real case — `/api/sessions` and
  // `/api/session/:session/injected` take no parameters at all — and it needs
  // its own wording: `accepts: ` followed by nothing named nothing.
  const accepts = allowed.length === 0
    ? 'this endpoint accepts no parameters'
    : `this endpoint accepts: ${allowed.join(', ')}`;
  for (const key of url.searchParams.keys()) {
    if (!allowed.includes(key)) {
      return `unknown parameter "${key}" — ${accepts}. ` +
        'A parameter accepted and ignored would silently answer a different question.';
    }
  }
  return null;
}

/**
 * Refuse a parameter given twice. `URLSearchParams.get` returns the FIRST
 * occurrence, so `?event=tool&event=manual` would answer about `tool` and
 * discard `manual` without saying so — the same silent drop as an unknown
 * parameter, arriving through a spelling the allow-list cannot see.
 */
export function repeatedParams(url: URL): string | null {
  const seen = new Set<string>();
  for (const key of url.searchParams.keys()) {
    if (seen.has(key)) {
      return `parameter "${key}" was given more than once. Only the first value would be ` +
        'read, so the rest would be silently discarded; pass it exactly once.';
    }
    seen.add(key);
  }
  return null;
}

/**
 * **Both handles read-only, and both checked.** `Store.openReadOnlyChecked`
 * and `Ledger.openReadOnlyChecked` — the latter had to be built before the
 * first could be enough. `Ledger.open` execs `LEDGER_SCHEMA` on every call, so
 * opening a `Ledger` the ordinary way IS a schema write; swapping only the
 * `Store` call here would have left this function handing out a writable
 * ledger connection creating tables in a database the read path never
 * prepared — worse than before, not better.
 *
 * **`Ledger.open`'s "`Store.open` must have run first" prerequisite does not
 * apply, and neither half of it does.** It existed only to make a WRITABLE
 * ledger safe: `Store.open`'s corruption self-heal had to have
 * deleted-and-recreated a corrupt file first, and `Store.open` had to have set
 * `journal_mode = WAL` first because `Ledger.open` creates a missing database.
 * A read-only open can commit neither error — it cannot create a database at
 * all — and throwing on a corrupt file is the correct answer for a read path
 * rather than something to heal. The `Store` is still opened first, but only
 * because its `schema_version` check is what says this file is a my_context
 * index at all; nothing about the ledger open depends on it any more.
 *
 * **`ledger` is `Ledger | null`, and the null is a STATE, not a failure.** A
 * corpus whose ledger PROJECTION has not been built has `schema_version` and
 * `items` but no `ledger`/`ledger_source` tables at all. **That is not the
 * same as never having been injected into.** The table is a projection of the
 * audit log, and the only thing that writes it is `topUpLedger` — reached by
 * `mycontext status`, `mycontext decay` and `audit replay-ledger`, and by
 * nothing else. The hook stopped writing it when dedupe moved to the seen
 * file. So a corpus injected into a thousand times, on which no aggregate
 * CLI reader has ever run, arrives here with no tables. Refusing to serve the UI
 * against a fresh corpus would be wrong, so `Ledger.openReadOnlyChecked` marks
 * that one state with its own CLASS, `LedgerUninitializedError`, and only that
 * class is swallowed here. **The class is the whole test — never a message
 * match.** A corrupt file, a truncated one, half a ledger, or a table shape
 * this build does not read all propagate: `INV-nothing-is-dropped-silently`
 * cuts both ways, and reporting damage as an empty ledger is the same failure
 * as refusing a fresh corpus.
 *
 * **OPEN QUESTION for the owner, recorded rather than decided:** what each
 * screen renders when `ledger` is null — the mockup's zero-data view, an
 * explicit "nothing has been injected in this corpus yet", or a per-screen
 * mixture. Every caller that USES the ledger argument inherits it. That is a
 * product decision about ten screens, and this function does not settle it; it
 * only guarantees the state ARRIVES at the caller distinguishable from both an
 * empty result and a fault. The owner has since ruled the null renders as the
 * mockup's zero-data view; WHICH zero-data view is still unanswered for the
 * session picker, whose mockup has none.
 *
 * `withStores` is where the three outcomes are decided, so it is where they
 * are proved. Carrying one of them into a response body is the CALLER's job
 * and starts at `apiSessions` — see `LedgerPresence`, which exists because a
 * `null` ledger and an empty one are the same JSON without it.
 */
export function withStores<T>(ws: Workspace, fn: (store: Store, ledger: Ledger | null) => T): T {
  const store = Store.openReadOnlyChecked(ws.dbPath);
  let ledger: Ledger | null = null;
  try {
    try {
      ledger = Ledger.openReadOnlyChecked(ws.dbPath);
    } catch (err) {
      // The not-projected empty state, and only it. Everything else is a
      // fault and must reach the caller.
      if (!(err instanceof LedgerUninitializedError)) throw err;
    }
    return fn(store, ledger);
  } finally {
    try { ledger?.close(); } catch { /* already closed */ }
    try { store.close(); } catch { /* already closed */ }
  }
}

const SELECT_EVENTS: SelectEvent[] = ['session-start', 'compact', 'tool', 'manual'];

const SELECT_PARAMS = ['event', 'path', 'session', 'cold', 'focus', 'restore'];

/**
 * A parsed select query, plus what reading it disclosed.
 *
 * `seenUnreadable` and `focusUnreadable` carry `SeenState.error` /
 * `FocusState.error` verbatim when the corresponding file exists and cannot be
 * trusted. Both states are handled exactly as the hook handles them — the
 * selection is computed WITHOUT the narrowing, never refused, because a
 * suppression built on a guessed-at seen set is the one direction that loses
 * an item silently.
 *
 * **What is not settled, and is an OPEN QUESTION for the owner rather than a
 * decision taken here:** where the UI shows it. Design decision 7 pins
 * `/api/select` to `select()`'s serialization and nothing else, so the field
 * cannot ride on that response; `/api/render` and `/api/simulate` have shapes
 * the plan fixes; and the mockup has no string for "this session's seen file
 * could not be read" anywhere (its only mention of the state is a fabricated
 * audit row on the Watch screen, which is plan 3's). Task 9's
 * `/api/session/:session/injected` returns `SeenState.error` verbatim and is
 * the only surface in plan 1 that discloses it. So: read here, carried here,
 * and **not yet rendered anywhere a preview reader would see it.** Said
 * plainly because the alternative is a comment claiming a disclosure the
 * response does not make.
 */
interface ParsedSelect {
  ctx: SelectContext;
  seenUnreadable: string | null;
  focusUnreadable: string | null;
}

/** The shared grammar of /api/select, /api/render and /api/simulate. */
export function parseSelectQuery(
  ws: Workspace, url: URL, extraAllowed: string[] = [],
): { parsed: ParsedSelect } | { error: string } {
  const allowed = [...SELECT_PARAMS, ...extraAllowed];
  const bad = unknownParams(url, allowed) ?? repeatedParams(url);
  if (bad) return { error: bad };

  const event = url.searchParams.get('event');
  if (event === null || !SELECT_EVENTS.includes(event as SelectEvent)) {
    return {
      error: `event must be one of ${SELECT_EVENTS.join(', ')} (got ${JSON.stringify(event)})`,
    };
  }

  const target = url.searchParams.get('path');
  if (event === 'tool' && (target === null || target === '')) {
    return { error: 'event=tool requires path=<repo-relative file>' };
  }
  if (event !== 'tool' && target !== null) {
    return {
      error: `path is only meaningful with event=tool — select ignores it for ${event}, ` +
        'and this endpoint refuses what it would ignore',
    };
  }

  const session = url.searchParams.get('session');
  const cold = url.searchParams.get('cold');
  if ((session === null) === (cold === null)) {
    return {
      error: 'pass exactly one of session=<id> (this session\'s preview) or cold=1 ' +
        '(a brand-new session\'s answer — a different question, labelled as one)',
    };
  }
  if (cold !== null && cold !== '1') return { error: 'cold takes exactly the value 1' };
  if (session !== null && session === '') {
    return { error: 'session=<id> needs an id; pass cold=1 for a brand-new session\'s answer' };
  }

  const focusParam = url.searchParams.get('focus');
  if (focusParam !== null && focusParam !== 'off') {
    return {
      error: 'focus takes exactly the value off (preview WITHOUT the active focus — a ' +
        'different question, labelled as one). Omit it to preview with the focus the hook ' +
        'would apply.',
    };
  }

  const restoreRaw = url.searchParams.get('restore');
  if (restoreRaw !== null && event !== 'compact') {
    return { error: 'restore is only meaningful with event=compact' };
  }

  const ctx: SelectContext = { event: event as SelectEvent };
  if (event === 'tool') ctx.path = target;
  if (restoreRaw !== null) ctx.restore = restoreRaw.split(',').filter((s) => s !== '');

  // Both file reads are scoped to the project layer, so a workspace with no
  // `.my_context` directory has neither file — and cannot get past
  // `withStores` either, since `resolveWorkspace` gives it a `:memory:`
  // dbPath that `Store.openReadOnlyChecked` refuses. The request fails there,
  // loudly, rather than being answered from a fabricated empty state here.
  const root = ws.projectRoot;

  let seenUnreadable: string | null = null;
  if (session !== null && root !== null) {
    // `seenIds(readSeen(root, key))`, exactly as the hook does — NOT
    // `ledger.seen(session)`. The Ledger left that path entirely; what
    // remains there is a replayed projection nothing in the UI updates, and
    // it would answer with a different number.
    const state = readSeen(root, session);
    ctx.seen = state.error === null ? seenIds(state) : [];
    seenUnreadable = state.error;
  }

  // Focus is the fifth narrowing input, read the way the hook reads it.
  // `focus=off` passes null and is a different question, exactly as `cold=1`
  // is: omitting it previews a different selection AND a different spill set.
  let focusUnreadable: string | null = null;
  if (focusParam === 'off' || root === null) {
    ctx.focus = null;
  } else {
    const state = readFocus(root);
    ctx.focus = state.focus;
    focusUnreadable = state.error;
  }

  return { parsed: { ctx, seenUnreadable, focusUnreadable } };
}

function runSelect(ws: Workspace, ctx: SelectContext): { items: Item[]; selection: Selection } {
  return withStores(ws, (store) => {
    // `store.all()` rather than `activeInjectable`: the prefilter is a
    // performance superset (`select.ts`), `select` applies the real rules
    // itself, and the index summary needs the unfiltered set.
    const items = store.all();
    return { items, selection: select(items, ctx, ws.config) };
  });
}

/**
 * `GET /api/select` — **`select()`'s JSON serialization and nothing else.**
 *
 * Design decision 7, and the §6 parity test depends on it: budget bars and
 * rendered text come from the two sibling endpoints below rather than from
 * fields bolted onto the endpoint whose entire value is that it is the same
 * answer the hook gets.
 */
export function apiSelect(ws: Workspace, url: URL): JsonResult {
  const parsed = parseSelectQuery(ws, url);
  if ('error' in parsed) return badRequest(parsed.error);
  return { status: 200, body: runSelect(ws, parsed.parsed.ctx).selection };
}

/** `GET /api/render` — the literal bytes a hook would inject for this context. */
export function apiRender(ws: Workspace, url: URL): JsonResult {
  const parsed = parseSelectQuery(ws, url);
  if ('error' in parsed) return badRequest(parsed.error);
  return {
    status: 200,
    body: { text: renderSelection(runSelect(ws, parsed.parsed.ctx).selection) },
  };
}

const BUDGET_KEYS = ['pinned', 'jit', 'restored', 'index'] as const;

/**
 * `GET /api/simulate` — the same selection under overridden budgets, priced.
 *
 * `costs` has one entry per id in `selection.full` ∪ `selection.spilled`, each
 * `itemCost(item)` — `select.ts`'s own cost rule, exported rather than copied.
 * It is a lookup table and its order is not a drawing order: **the ghost lane
 * draws `selection.spilled` in `selection.spilled`'s order**, which is the
 * order the selector considered each item, tier by tier. A client that
 * re-sorts spills by size or id is drawing a different algorithm.
 *
 * `costs` sizes three of the four ribbon tracks. The fourth, `index`, admits
 * LINES rather than items (`selection.index.normative`), and per-line index
 * costs are exposed by no endpoint in this plan — recorded as a gap, not
 * designed.
 */
export function apiSimulate(ws: Workspace, url: URL): JsonResult {
  const parsed = parseSelectQuery(ws, url, [...BUDGET_KEYS]);
  if ('error' in parsed) return badRequest(parsed.error);
  const { ctx } = parsed.parsed;

  const budgets: Budgets = { ...ws.config.budgets };
  for (const key of BUDGET_KEYS) {
    const raw = url.searchParams.get(key);
    if (raw === null) continue;
    // Digits only, deliberately, rather than `Number(raw)`: `Number('')` is 0
    // and `Number(' 2 ')` is 2, so a caller who sent `?pinned=` or a stray
    // space would get a budget it never asked for and a chart to match.
    if (!/^[0-9]+$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
      return badRequest(
        `${key} must be a non-negative integer written in digits (got ${JSON.stringify(raw)})`,
      );
    }
    budgets[key] = Number(raw);
  }
  const config: Config = { ...ws.config, budgets };

  return withStores(ws, (store) => {
    const items = store.all();
    const selection = select(items, ctx, config);
    const byId = new Map(items.map((i) => [i.id, i]));
    const ids = [...new Set([
      ...selection.full.map((e) => e.item.id),
      ...selection.spilled.map((s) => s.id),
    ])];
    const costs = ids.map((id) => {
      const item = byId.get(id);
      if (item === undefined) {
        // Structurally impossible: both sets come from the `items` array this
        // same call passed to `select`. It is a throw rather than a skipped
        // entry because a `costs` array quietly one shorter than its
        // selection is exactly the silent drop this project keeps paying for.
        throw new Error(
          `mycontext ui: /api/simulate priced a selection naming ${id}, which is not in the ` +
          'item set the selection was computed from. The two disagree; nothing is guessed.',
        );
      }
      return { id, tokens: itemCost(item) };
    });
    // Which tiers this event reached, from `select.ts`'s own dispatch. A tier
    // that never runs is drawn as absent-and-named; an empty track would
    // claim it ran and delivered nothing, which is a different fact.
    return { status: 200, body: { selection, budgets, costs, tiersRun: tiersRun(ctx) } };
  });
}

// --- The session selector, and what a context window actually received ------

/**
 * Which of `withStores`' two ledger outcomes a response was built from, as a
 * value the body can carry.
 *
 * `withStores` hands the ledger over as `Ledger | null` and documents the null
 * as a STATE — the ledger projection has not been built — told from damage by
 * CLASS rather than by a message. **It says nothing about whether anything
 * was ever injected**; the injections live in `.audit/` and the seen files,
 * and only `topUpLedger` turns them into this table. That distinction dies at the JSON boundary
 * unless something says which one happened: `{ default: null, sessions: [] }`
 * is equally what an initialised ledger holding no rows produces. The owner
 * ruled that both render as the mockup's zero-data view; rendering alike is
 * not being alike, and `INV-nothing-is-dropped-silently` is about the second.
 *
 * **This is a machine field, not a screen.** What a client DRAWS for
 * `not-projected` is the mockup's business, and the mockup's zero-data
 * toggle (`#empty`) swaps only the coverage screen — it has no zero-data view
 * for the session picker at all. Recorded as an open question for the owner;
 * answering it here would be inventing a screen.
 */
export type LedgerPresence = 'ready' | 'not-projected';

export function ledgerPresence(ledger: Ledger | null): LedgerPresence {
  return ledger === null ? 'not-projected' : 'ready';
}

/**
 * The picker's window: spec §3 item 2 lists twenty sessions. Exported so a
 * test can pin the VALUE rather than restate it, and so the fixture that has
 * to overflow the window cannot drift away from the number it overflows.
 */
export const SESSIONS_LIMIT = 20;

/**
 * `GET /api/sessions`' body — the session selector contract, which plan 3
 * consumes for the status-line bridge as well.
 *
 * `sessions` is `sessionSummaries` VERBATIM, never re-shaped field by field:
 * the `name` the owner ruled onto `SessionSummary` then reaches the picker
 * without this endpoint being touched.
 *
 * `sessionCount` is the total the window truncates against, and `null` when
 * there is no ledger to count in — `0` there would claim a count was taken.
 * `sessionSummaries(limit)` truncates and, in its own words, leaves *"nothing
 * in the result to say so"*; this is the caller it names as the route to the
 * total, so the disclosure is made here rather than left to a client that
 * cannot know it happened.
 */
export interface SessionsBody {
  ledger: LedgerPresence;
  default: string | null;
  sessions: SessionSummary[];
  sessionCount: number | null;
}

/**
 * `GET /api/sessions` — the default session, the picker's list, and which
 * ledger state answered.
 *
 * `default` is `recentSessions(1)[0]` (spec §3 item 1) rather than
 * `sessions[0]`, which is the second query it looks like: `ledger.ts` pins
 * the two orderings as equal, and this endpoint asks the question the spec
 * names instead of quietly substituting the cheaper one.
 *
 * A not-projected corpus answers `{ ledger: 'not-projected', default: null,
 * sessions: [], sessionCount: null }` — a 200 with a state in it, never a 500
 * and never a fabricated empty ledger. The client shows only the labelled cold
 * option either way (spec §3 item 4).
 */
export function apiSessions(ws: Workspace, url: URL): JsonResult {
  // `repeatedParams` is subsumed, not forgotten: with an empty allow-list
  // every parameter is refused already, a repeat of one included.
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  return withStores(ws, (_store, ledger): JsonResult => {
    // One body, and every field answers the not-projected state on its own
    // line — so a field added later cannot inherit a `0` or a `[]` there by
    // being written before anyone thought about it.
    const body: SessionsBody = {
      ledger: ledgerPresence(ledger),
      default: ledger === null ? null : ledger.recentSessions(1)[0] ?? null,
      sessions: ledger === null ? [] : ledger.sessionSummaries(SESSIONS_LIMIT),
      sessionCount: ledger === null ? null : ledger.sessionCount(),
    };
    return { status: 200, body };
  });
}

/** One delivery, as the `injected` screen draws it: the seen line plus a join. */
export interface InjectedLine extends SeenLine {
  title: string | null;
}

export interface InjectedBody {
  lines: InjectedLine[];
  error: string | null;
}

/**
 * `GET /api/session/:session/injected` — **the per-session seen file's lines**,
 * each joined to the item's current title.
 *
 * **Not `Ledger.entries`, and not `Ledger.seen`.** The screen says its own
 * source twice: *"from the per-session seen file — the parent thread's, keyed
 * as the hook keys it"* (`inj.sub`) and *"Read from the seen file, not
 * `Ledger.seen` — that is a replayed projection nothing here updates, and it
 * would show a different number"* (`inj.note`). `Ledger.entries` is that same
 * projection read one session at a time, so the note rules it out on its own
 * reasoning. `SeenLine { id; tier; at }` carries exactly the three columns the
 * table draws (`th.item` / `th.tier` / `th.when`), so nothing is synthesised.
 *
 * **The bare session id, and one file.** `readSeen` takes the dedupe key, and
 * `ledgerKey` gives a subagent `session_id::agent_id` and the parent the bare
 * id. *"Previews are of the parent thread. A subagent has its own dedupe key
 * and its deliveries are not folded in here"* (`sess.parent`), so `:session`
 * is the bare id and no other file is merged into the answer.
 *
 * **One row per DELIVERY, in the file's own order.** `seenIds` — what
 * `/api/select` needs — dedupes and sorts; this screen is a list of what
 * arrived, so a second delivery of an item is a second row, and an item the
 * corpus no longer holds keeps its row with `title: null` (the injection still
 * happened). Nothing here is sorted, grouped or collapsed.
 *
 * `error` is `SeenState.error` verbatim: an unreadable seen file is a
 * DISCLOSED state, never an empty one. This is the only surface in plan 1 that
 * passes that string on — `/api/select` reads the same state and has nowhere
 * to put it. **The mockup has no string for rendering it**, on this screen or
 * any other; the response carries the fact and where it is drawn is an open
 * question for the owner.
 */
export function apiInjected(ws: Workspace, url: URL, params: { session: string }): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  if (params.session === '') {
    return badRequest(
      'the :session path segment needs a session id. An empty one is not refused by ' +
      '`sanitizeSessionId` — it folds to an `unknown-<digest>` filename — so answering it ' +
      'would report about a fabricated key as though it were a session.',
    );
  }
  return withStores(ws, (store): JsonResult => {
    // Structurally unreachable, and a throw rather than an empty answer: a
    // fabricated `{ lines: [], error: null }` here would say "this session
    // received nothing" about a corpus that does not exist. See
    // `projectRootAfterOpen`, which holds that reasoning for all three
    // endpoints that need the root after the index has opened.
    const root = projectRootAfterOpen(ws, '/api/session/:session/injected');
    // The SEEN FILE, not the Ledger: this screen shows live delivery state.
    const state = readSeen(root, params.session);
    const titles = new Map(store.all().map((i) => [i.id, i.title]));
    const body: InjectedBody = {
      lines: state.lines.map((line) => ({ ...line, title: titles.get(line.id) ?? null })),
      error: state.error,
    };
    return { status: 200, body };
  });
}

// --- The landing-adjacent reads: status, doctor and decay -------------------

/**
 * A tally keyed by one field of `Item`, as `status --json` emits it.
 *
 * **A second spelling of `status.ts`'s `tally`, and that is a defect this
 * function cannot fix from here.** That one is private, returns
 * `[string, number][]` and is turned into an object by its three call sites
 * (`status.ts`, `byCategory`/`byStatus`/`byOrigin`). Importing it is not
 * possible without exporting it from a CLI command module, and importing that
 * module is worse than the duplication: `cli/commands/status.ts` pulls in
 * `openMutateContext`, the command registry and `mutate.ts` behind it — the
 * entire write surface — to reach nine lines of counting. Counting is not a
 * rule (the rules here are `reviewQueue`, `runChecks` and `computeDecay`, and
 * every one of them is imported rather than restated), so the copy is bounded
 * and named. Reported to the owner as the small refactor it wants: `tally`
 * belongs beside `Item`, not inside a command.
 */
function tallyBy(items: Item[], key: (i: Item) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
}

/**
 * The project root, asked for AFTER `withStores` has opened the index.
 *
 * Structurally unreachable, and it is a throw rather than an empty answer for
 * the reason every caller shares: a workspace with no project has `:memory:`
 * for a dbPath, and `Store.openReadOnlyChecked` inside `withStores` has
 * already refused that (no `schema_version` to read) before any callback runs.
 * If it were ever reached, the index and the workspace would be disagreeing
 * about whether this directory is a corpus, and a fabricated answer built on
 * one of them would report about a project that does not exist.
 *
 * **One spelling, three callers.** `/api/status` and `/api/doctor` need the
 * root for `runChecks` and `pendingRevisionSummaries`;
 * `/api/session/:session/injected` needs it for `readSeen`. A second wording
 * of the same impossible state is how two endpoints end up disagreeing about
 * what it means.
 */
function projectRootAfterOpen(ws: Workspace, endpoint: string): string {
  const root = ws.projectRoot;
  if (root === null) {
    throw new Error(
      `mycontext ui: ${endpoint} reached a workspace with no project root after its index ` +
      'opened; the two disagree and nothing is guessed.',
    );
  }
  return root;
}

/**
 * `GET /api/status`' body — the same document `status --json` emits, minus the
 * fields that describe a CLI invocation rather than a corpus.
 *
 * **What is here is `status --json`'s, field for field and name for name**
 * (`cli/commands/status.ts`): `version`, `profile`, `items`, `reviewQueue`,
 * `pendingRevisions` and `health` are the same keys carrying the same numbers
 * from the same functions. A script that reads one reads the other.
 *
 * **What is deliberately NOT here**, so the difference is a decision and not
 * an omission: `loadErrorCount`, `loadErrors` and `exitCode` are facts about
 * one CLI run — an exit code is not a thing an HTTP read has — and `usage` is
 * `/api/decay`'s subject, served there in full rather than as five summary
 * numbers here.
 *
 * **Two rows the mockup's status screen draws and this body cannot fill.**
 * `<section data-p="status">` has five rows and the string table ships all
 * five: `st.items`, `st.drafts`, `st.pending`, `st.staged` (*"Staged
 * lessons"*) and `st.ingest` (*"Unfinished ingests"*) — and `st.four` states
 * why they share one table: *"There are four unfinished-work queues, not
 * one."* This endpoint serves the first three. The last two are `listStaging`
 * (`lesson/derive.ts`) and `listSessions` + `pendingAnchors`
 * (`ingest/session.ts`), which is exactly what `status --json` composes for
 * its own `stagedRules` and `unfinishedIngest` fields — but `lesson/derive.ts`
 * imports `createItem` from `core/mutate.ts`, so serving `st.staged` would put
 * the mutation surface into this server's runtime import graph for the first
 * time. That is a decision about the boundary §0.5 is the owner's ruling on,
 * not a field to add on the way past. **Reported, not invented** — this task's
 * Produces block has neither field, and §0.3's survey covered the eighteen
 * graphical views and never reached this table.
 */
export interface StatusBody {
  version: string;
  profile: string;
  items: {
    total: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
    byOrigin: Record<string, number>;
  };
  reviewQueue: { drafts: number; always: number; globalLayerDrafts: number };
  pendingRevisions: { revisions: number; items: number };
  health: { errors: number; warnings: number; infos: number };
}

/**
 * `GET /api/status` — the corpus counts, two of the four queues, and a health
 * tally, each composed from the function that already owns it.
 *
 * `reviewQueue.drafts` is `select.ts`'s `reviewQueue(items)` — **project-layer
 * drafts, never a raw draft tally.** `items.byStatus.draft` is the raw count
 * over both layers, and the two differ by exactly `globalLayerDrafts`, which
 * is named beside them for the reason `status.ts` names it: a reader who sees
 * `draft 6` above `5 draft(s) pending` cannot otherwise tell that from a bug.
 * The tally is not filtered to reconcile them — hiding a global-layer draft
 * from the corpus tally would make those drafts disappear from every surface
 * at once.
 *
 * `health` is a LEVEL TALLY of `runChecks`' findings and nothing else: a
 * presentation count, not a rule. The rule set is `runChecks` itself, and
 * `/api/doctor` serves it unflattened — *"a findings list flattened to 'exit
 * 1' is what a terminal loses"* (`doc.v`) is as true of a JSON number as of an
 * exit status. The three lines below are `summarize`'s three lines
 * (`cli/commands/doctor.ts`), duplicated for the reason `tallyBy` records and
 * with the same recommendation attached.
 *
 * **`runChecks` runs while this module's read-only handles are open, and
 * `status.ts`' reason for closing first does not transfer.** That command
 * closes its WRITABLE store before `checkIndexFreshness` stats the database,
 * because a WAL connection that has written but not checkpointed leaves the
 * file's mtime older than the rebuild it just performed — reporting
 * `index_stale` for an index that invocation had refreshed a line earlier.
 * Nothing here writes, so there is no un-checkpointed page of ours for the
 * mtime to hide behind, and the freshness this endpoint reports is the
 * freshness any other reader would see at the same moment.
 *
 * The server never rebuilds and never repairs: `index_stale` arrives here as a
 * FINDING, which is the whole of what this surface does about it.
 *
 * **A revision log that cannot be read THROWS, and is allowed to.** `readLog`
 * refuses a damaged log rather than skipping the bad line, because the skipped
 * line could be the `discard` that settled a revision and dropping it would
 * put that proposal back in the pending queue. `status` makes the same call
 * and lets it fail for the same reason: reporting `{ revisions: 0 }` for a log
 * this endpoint failed to read would hide every proposal in the workspace
 * behind a health report, which is the one report that must not do that.
 */
export function apiStatus(ws: Workspace, url: URL): JsonResult {
  // `repeatedParams` is subsumed: with an empty allow-list every parameter is
  // refused already, a repeat of one included.
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  return withStores(ws, (store): JsonResult => {
    const root = projectRootAfterOpen(ws, '/api/status');
    const items = store.all();
    const queue = reviewQueue(items);
    const findings = runChecks({
      root,
      // The repository, not the workspace: `projectRoot` IS
      // `<repo>/.my_context` (`findProjectRoot`), so the checks that walk
      // source files take its parent — the argument `status` and `doctor`
      // both pass.
      repoRoot: path.dirname(root),
      dbPath: ws.dbPath,
      items,
      config: ws.config,
    });
    const body: StatusBody = {
      version: VERSION,
      profile: ws.config.profile,
      items: {
        total: items.length,
        byCategory: tallyBy(items, (i) => i.type),
        byStatus: tallyBy(items, (i) => i.status),
        byOrigin: tallyBy(items, (i) => i.origin),
      },
      reviewQueue: {
        drafts: queue.length,
        always: queue.filter((i) => i.always).length,
        globalLayerDrafts: items.filter((i) => i.status === 'draft').length - queue.length,
      },
      pendingRevisions: pendingRevisionCounts(pendingRevisionSummaries(root)),
      health: {
        errors: findings.filter((f) => f.level === 'error').length,
        warnings: findings.filter((f) => f.level === 'warn').length,
        infos: findings.filter((f) => f.level === 'info').length,
      },
    };
    return { status: 200, body };
  });
}

/** `GET /api/doctor`' body — `runChecks` output, carried and not reshaped. */
export interface DoctorBody { findings: Finding[] }

/**
 * `GET /api/doctor` — **`runChecks` verbatim: unfiltered, ungrouped, unsorted.**
 *
 * The screen groups by `code`, keeps the three levels apart and composes a
 * repair command per group (`doc.sub`), and every one of those is
 * PRESENTATION over this array. None of it happens here, because a finding
 * dropped between the checker and the screen is undetectable from the screen —
 * and `doc.v` is this endpoint's whole reason for existing: *"a findings list
 * flattened to 'exit 1' is what a terminal loses"*.
 *
 * `Finding` is `{ level, code, message, item? }`, and `item` stays OPTIONAL:
 * `watched_docs_no_match` and `audit_log_size` name no item, and a `''` or a
 * `null` invented here would put an empty cell where the mockup draws an em
 * dash for the finding that names none.
 *
 * **The exit code is not here, and it is not an oversight.** `doctor`'s exit
 * code comes from `exitCode(findings, loadErrorCount)`
 * (`cli/commands/doctor.ts`), whose second argument counts files `runChecks`
 * never examined — a load error, which this server has no equivalent of: it
 * reads the INDEX, and a file that failed to parse never entered it. Emitting
 * a number that looks like `doctor`'s exit code but is derived from half its
 * inputs would be the read-clean-next-to-a-failure trap `doctor --json` was
 * fixed for.
 */
export function apiDoctor(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  return withStores(ws, (store): JsonResult => {
    const root = projectRootAfterOpen(ws, '/api/doctor');
    const body: DoctorBody = {
      findings: runChecks({
        root,
        repoRoot: path.dirname(root),
        dbPath: ws.dbPath,
        items: store.all(),
        config: ws.config,
      }),
    };
    return { status: 200, body };
  });
}

/**
 * `/api/decay`'s window when the caller names none — `DEFAULT_WINDOW` in
 * `cli/commands/decay.ts` and `DECAY_WINDOW` in `cli/commands/status.ts`, both
 * `20`, both private. Exported here so a test can pin the VALUE rather than
 * restate it, and so the third copy of the number is at least a named one.
 * **Three private constants holding one product decision is a finding, not a
 * design**: the window belongs beside `DecayInput` in `core/decay.ts`, where
 * both CLI surfaces and this one could read it.
 */
export const DECAY_WINDOW_DEFAULT = 20;

/**
 * `GET /api/decay`' body.
 *
 * `report` is `null` for a not-projected corpus and a `DecayReport`
 * otherwise; `ledger` says which, so neither is inferred from the shape of the
 * answer. See `apiDecay` for why `null` rather than a report computed from
 * three fabricated inputs.
 */
export interface DecayBody {
  ledger: LedgerPresence;
  report: DecayReport | null;
  series: InjectionEvent[];
}

/**
 * `GET /api/decay?window=N` — the decay report, and the raw injection series.
 *
 * `report` is `computeDecay` fed exactly as `cli/commands/decay.ts` and
 * `cli/commands/status.ts` feed it, **minus the one thing both of them do
 * first**: `topUpLedger`. See the staleness section below, which is the most
 * important paragraph on this endpoint.
 *
 * **`window` is digits only.** `Number(raw)` — what this task's own code block
 * uses — accepts `' 20 '`, `'1e3'`, `'0x10'` and `'+5'`, and answers about a
 * window the caller never wrote. `/api/simulate` already refuses budgets on
 * exactly that reasoning; this is the same kind of parameter and gets the same
 * rule. `window=0` is refused separately: a zero window makes
 * `recentSessions(0)` return `[]`, which classifies every item as cold — a
 * full screen of alarm produced by a parameter rather than by a corpus. And
 * `?window=5&window=9` is refused rather than silently answered about `5`.
 *
 * **`report` is `null` when there is no ledger; it is not a report of
 * zeroes.** `DecayInput` takes three readings — `usage`, `recentlyUsed` and
 * `sessionsRecorded` — and a not-projected corpus has taken none of them.
 * Feeding `[]`, `[]` and `0` into `computeDecay` returns a well-formed
 * `DecayReport` whose `cold` list is every eligible normative item in the
 * corpus, and the screen draws exactly that: `dec.badpin` rings *"pinned and
 * cold — a defect signal, not decay"* around every `always: true` item in a
 * corpus that has simply never run. That is not an empty state rendered
 * plainly; it is a screenful of false alarms manufactured from a measurement
 * that did not happen. `series` stays `[]` rather than `null` for the same
 * reason `/api/sessions`' `sessions` does: the array is the answer's shape,
 * `ledger` is its provenance, and only one of them can carry provenance.
 *
 * **WHICH zero-data view the decay screen draws for `report: null` is an open
 * question for the owner.** The mockup's `∅` toggle swaps the coverage screen
 * and nothing else, and `data-p="decay"` has no empty state at all — the same
 * gap `/api/sessions` recorded for the session picker.
 *
 * ## `series` is `Ledger.history()`, and it is NOT the comb's source
 *
 * Its own docstring says so twice, and names the mechanism: the primary key is
 * `(session_id, item_id, tier)` with `injected_at` only a value, so a repeat
 * injection inside one session collides into the row already there. What comes
 * back is *"one marker per (session, item, tier), not an event stream"*, and
 * the markers are not even uniformly first-injections — `pinned` and `jit`
 * keep the FIRST stamp, `restored` keeps the LATEST.
 *
 * It is carried here because this task's Produces block fixes it, and because
 * it is where §0.3 row 7 routed the comb's *"never injected"* state
 * (*"/api/items minus the ids in `series`"*). **That routing is the long way
 * round, and this same response already holds the short one**:
 * `DecayRow.useCount === 0` IS not-projected, and `DecayRow.always` is the
 * pinned half of `dec.badpin` — `decay.ts` says in as many words that `always`
 * rides on the row precisely so a renderer is not left guessing. Both live
 * inside `report`, computed by the function that owns the rule, and neither
 * needs a second endpoint joined to it.
 *
 * **What neither field serves is the comb's axis, and that gap is real.**
 * `#comb` plots one tooth per item at *"sessions since last injection"*, on a
 * log axis out to sixty, with a separate bucket for never. `DecayReport` gives
 * a BINARY split at the window and a `lastUsed` TIMESTAMP; the axis wants an
 * ORDINAL, in sessions, past the window. Deriving it from `series` in the
 * browser means re-deriving `recentSessions`' ordering (`MAX(injected_at)
 * DESC, session_id DESC`) in `.js`, over every row the ledger holds, to
 * produce one scalar per item — the copied-rule defect §0.3 row 14 objects to,
 * paid for with an unbounded transfer. **Needs: `sessionsAgo: number | null`
 * per row, computed where the ordering lives.** Reported, not invented — §0.3
 * row 7 marks this view *"✅ yes, served"*, and it is not.
 *
 * ## The staleness this endpoint cannot repair, and cannot yet disclose
 *
 * **The ledger table is a projection of the audit log, and the only thing that
 * writes it is `topUpLedger` — called by `status`, `decay` and `audit
 * replay-ledger`, and by nothing else.** The hook stopped writing it when
 * dedupe state moved to the seen file. Two consequences, both of them this
 * endpoint's to carry and neither of them its to fix:
 *
 *  - On a corpus where no aggregate CLI reader has ever run, the ledger TABLES
 *    DO NOT EXIST, `Ledger.openReadOnlyChecked` throws
 *    `LedgerUninitializedError`, and this endpoint answers `not-projected` —
 *    **about a corpus that may have been injected into a thousand times.** The
 *    injections are on disk, in `.audit/` and in the per-session seen files;
 *    what is missing is the projection, not the history. A test below records
 *    that state by producing it.
 *  - Where the tables DO exist, they are as fresh as the last `status` or
 *    `decay` run and no fresher — so `mycontext decay` and this endpoint can
 *    report different numbers about the same corpus at the same moment, and
 *    this one is always the stale one, because reading the CLI's answer is
 *    what makes it fresh.
 *
 * **Neither is repaired here**, which is the ruling this module opens with:
 * the server never rebuilds, because *"see exactly what Claude gets"* means
 * reading what is there. But index staleness has somewhere to go — doctor's
 * `index_stale`, surfaced by `/api/status` — and **projection staleness has
 * nowhere**: `ledger-replay.ts` exports only the writer, no read-only probe of
 * how far behind the projection is exists, and no doctor check reports it.
 * `Ledger.sourceFiles()`/`sourceBytes()` hold one half of that comparison and
 * the audit segments on disk hold the other, so the answer is derivable — by
 * code that does not exist and is not invented here. **Reported to the owner
 * as the sharpest thing this task found**, because it makes
 * `LedgerPresence`'s `'not-projected'` mean *"the projection was never
 * built"* rather than what its name says, on every endpoint that carries it.
 */
export function apiDecay(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['window']) ?? repeatedParams(url);
  if (bad) return badRequest(bad);

  let window = DECAY_WINDOW_DEFAULT;
  const raw = url.searchParams.get('window');
  if (raw !== null) {
    if (!/^[0-9]+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) === 0) {
      return badRequest(
        `window must be a positive integer written in digits (got ${JSON.stringify(raw)})`,
      );
    }
    window = Number(raw);
  }

  return withStores(ws, (store, ledger): JsonResult => {
    const items = store.all();
    // One body, and every field answers the not-projected state on its own
    // line — the discipline `/api/sessions` set, for the same reason: a field
    // added later must not inherit a zero by being written before anyone
    // thought about it.
    const body: DecayBody = {
      ledger: ledgerPresence(ledger),
      report: ledger === null ? null : computeDecay({
        items,
        config: ws.config,
        usage: ledger.allUsage(),
        recentlyUsed: ledger.itemsUsedIn(ledger.recentSessions(window)),
        window,
        sessionsRecorded: ledger.sessionCount(),
      }),
      series: ledger === null ? [] : ledger.history(),
    };
    return { status: 200, body };
  });
}
