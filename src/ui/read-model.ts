/**
 * Every `/api` read handler, as a pure function of `(workspace, url)` — no
 * HTTP types, so each is testable by calling it.
 *
 * **Composition only.** The rules are `select`, `matchesScope`, `isEligible`,
 * `injection`, `scopePolicyFor`, `estimateTokens` and the `Ledger` reads (spec
 * §3's table). An endpoint here MAY NOT reimplement one: this project has paid
 * repeatedly for a second implementation of a rule that already existed, and a
 * server that answers "what would Claude get" with its own arithmetic is that
 * failure in a new medium.
 *
 * **The server never rebuilds.** The hook reads the store as-is
 * (`hooks/pre-tool-use.ts`), and "see exactly what Claude gets" means reading
 * exactly what the hook reads. Staleness is doctor's `index_stale` finding,
 * surfaced by the status screen — never silently repaired here.
 *
 * **Nothing in this module writes.** Both database handles are opened through
 * read-only doors (`withStores`), and the two file reads it makes —
 * `readSeen`, `readFocus` — contain no write call in their bodies. That is
 * enforced from two sides rather than promised here: Task 14's static
 * import-graph test over `src/ui/`, and Task 13's runtime assertion that a
 * real corpus is byte-identical after every read route has been exercised.
 */
import { Ledger, LedgerUninitializedError } from '../core/ledger.ts';
import { readFocus } from '../core/focus.ts';
import { renderSelection } from '../core/render.ts';
import {
  itemCost, select, tiersRun,
  type SelectContext, type SelectEvent, type Selection,
} from '../core/select.ts';
import { readSeen, seenIds } from '../core/seen-file.ts';
import { Store } from '../core/store.ts';
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
  for (const key of url.searchParams.keys()) {
    if (!allowed.includes(key)) {
      return `unknown parameter "${key}" — this endpoint accepts: ${allowed.join(', ')}. ` +
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
 * corpus no hook has ever injected into has `schema_version` and `items` but
 * no `ledger`/`ledger_source` tables at all — those are created by
 * `Ledger.open`, a write nothing has performed. Refusing to serve the UI
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
 * empty result and a fault.
 *
 * No `/api` endpoint in this task reads the ledger. `withStores` is where the
 * three outcomes are decided, so it is where they are proved.
 */
export function withStores<T>(ws: Workspace, fn: (store: Store, ledger: Ledger | null) => T): T {
  const store = Store.openReadOnlyChecked(ws.dbPath);
  let ledger: Ledger | null = null;
  try {
    try {
      ledger = Ledger.openReadOnlyChecked(ws.dbPath);
    } catch (err) {
      // The never-injected empty state, and only it. Everything else is a
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
