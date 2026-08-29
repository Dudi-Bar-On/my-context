/**
 * `GET /api/injection-history` — **when each item last really was delivered,
 * and when it last really did spill.**
 *
 * ── WHY THIS IS A SEPARATE FACT FROM THE SCREEN THAT DRAWS IT ─────────────
 *
 * The injection preview is a SIMULATION OF NOW. Nothing on it is being
 * injected as the reader looks at it: `select()` is asked what a session start
 * *would* get, and the answer is a hypothetical. A timestamp on one of those
 * rows is therefore a DIFFERENT FACT from the row it sits on — "the last time
 * this actually happened", read out of the audit — and two rows in one preview
 * can carry times weeks apart without either being wrong.
 *
 * That is the whole reason this is its own endpoint rather than three more
 * columns on `/api/select`. Design decision 7 pins that response to `select()`'s
 * serialization and nothing else, and it is right to: a field that answers a
 * question about the PAST, riding on the endpoint whose entire value is that it
 * is the answer the hook gets, is how a stale reading comes to look like a live
 * one. `screens/preview.js` labels every one of these as the past, and it can
 * only do that honestly because they arrive separately.
 *
 * ── WHY THE WHOLE CORPUS, AND NOT THE IDS BEING DRAWN ─────────────────────
 *
 * One query, one round trip, cached for the life of the screen — the same
 * treatment `/api/items` already gets there. The alternative was an endpoint
 * taking the select grammar and answering for `full ∪ spilled`, which would
 * have run `select()` a THIRD time on the landing screen's first paint (once
 * for `/api/select`, once for `/api/simulate`, once here) to narrow an answer
 * that is not selection-dependent in the first place: these are facts about the
 * log, and they do not move when the reader changes the event. Measured on this
 * repository's own audit database, 2026-08-29: 6,936 `injected` rows and 1,031
 * `spilled` rows group down to **904** `(item, role, tier)` triples. The whole
 * answer is smaller than one screen's worth of item bodies.
 *
 * ── THE GRAIN IS `(item, role, tier)`, AND THE TIER IS NOT DECORATION ─────
 *
 * `audit_item` carries the tier beside the role, and a preview row already
 * names the tier that admitted or dropped it. Matching tier-blind shows the
 * wrong instant: measured on this corpus, one item has spilled from `jit` (last
 * at `2026-08-29T04:19:06.910Z`) and from `pinned` (last at
 * `2026-08-29T04:33:33.557Z`), and a row about the `jit` spill that showed
 * 04:33 would be reporting a different event. So the grain is the finest one
 * the projection holds, and the CLIENT decides which triple a given row is
 * about — preferring its own tier, falling back to the item's most recent
 * record under any tier and NAMING that tier when it does.
 *
 * ── THE PROJECTION MAY REFUSE, AND THAT MUST NOT TAKE THE SCREEN WITH IT ──
 *
 * `readProjection` is the one door and the one policy: `fresh` answers,
 * `absent` is an empty state rather than a fault, and `behind`/`diverged`/
 * `damaged` refuse with 503 and the state named — because syncing is a write
 * and a read surface may not perform one. That policy is not re-spelled here.
 *
 * What IS this module's business is that the refusal stays contained. The
 * preview fetches this SEPARATELY from `/api/select` and `/api/simulate`, with
 * its own catch, so a projection that is behind costs the reader the When
 * column and a sentence saying why — never the selection. Folding these times
 * into `/api/simulate` would have made a stale projection refuse the landing
 * screen outright, which is a strictly worse answer than the one it was meant
 * to improve.
 */
import type { Workspace } from '../core/workspace.ts';
import { badRequest, repeatedParams, unknownParams } from './read-model.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';
import { readProjection } from './watch-model.ts';

/**
 * The most `(item, role, tier)` triples this endpoint will serve.
 *
 * Measured at 904 on this repository (see the header), so the cap is roughly
 * five times the real figure rather than a number the corpus is near. It exists
 * because a bound nobody wrote is a bound the first pathological corpus
 * discovers in the browser — and because `truncated` can then say the answer
 * was cut, which is what keeps a partial history from being read as a complete
 * one. `INV-nothing-is-dropped-silently`, on the one axis this endpoint can
 * drop something along.
 */
export const HISTORY_ROW_CAP = 5_000;

/** One `(item, role, tier)` triple and the last instant it happened. */
export interface HistoryRow {
  id: string;
  /** `audit_item.role` — `injected` or `spilled`, the projection's own words. */
  role: 'injected' | 'spilled';
  /**
   * `audit_item.tier` — the tier of the record, NOT of any current selection.
   *
   * Its vocabulary is wider than the five selection tracks: an index line is
   * written under `carried`, so a client matching against `Spill['tier']` must
   * treat an unmatched tier as "no record at this tier" and never as an error.
   */
  tier: string;
  /** `audit.at`, ISO-8601 UTC — the LAST time this triple was recorded. */
  at: string;
}

/**
 * `MAX(a.at)` per triple, ordered newest first so the cap keeps the rows a
 * reader is most likely to be looking at.
 *
 * `role IN ('injected','spilled')` deliberately drops the third role the
 * projection holds. `subject` means the record was ABOUT the item — a capture,
 * an edit, a supersede — which is a different question from whether the item
 * reached a context window, and answering it in the same array would put an
 * edit's timestamp under a column headed "last delivered".
 */
const HISTORY_SQL = `
  SELECT i.item_id AS id, i.role AS role, i.tier AS tier, MAX(a.at) AS at
    FROM audit_item i JOIN audit a ON a.seq = i.seq
   WHERE i.role IN ('injected', 'spilled')
   GROUP BY i.item_id, i.role, i.tier
   ORDER BY at DESC, id ASC
   LIMIT ?
`;

export function apiInjectionHistory(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, []) ?? repeatedParams(url);
  if (bad !== null) return badRequest(bad);
  const root = ws.projectRoot;
  if (root === null) return { status: 500, body: { error: 'no project workspace' } };

  // One past the cap, so "exactly the cap" and "more than the cap" are
  // distinguishable — `/api/coverage`'s own trick, for the same reason: a
  // `rows.length === cap` test cannot tell a corpus that filled the bound from
  // one that happens to sit on it.
  const read = readProjection(root, (db) =>
    db.prepare(HISTORY_SQL).all(HISTORY_ROW_CAP + 1) as unknown as HistoryRow[]);
  if (!read.ok) return read.refusal;

  // `null` is the projection that was never built: an empty state, and the
  // screen says so in those words rather than drawing "never delivered" beside
  // every row — which would be a claim about the corpus made out of a missing
  // file.
  if (read.value === null) {
    return {
      status: 200,
      body: { projectionState: read.state, rows: null, truncated: false, cap: HISTORY_ROW_CAP },
    };
  }
  const truncated = read.value.length > HISTORY_ROW_CAP;
  return {
    status: 200,
    body: {
      projectionState: read.state,
      rows: truncated ? read.value.slice(0, HISTORY_ROW_CAP) : read.value,
      truncated,
      // The bound travels with the answer so the screen can SAY it without
      // holding a second copy of this number — the two-spellings defect, on a
      // constant rather than on a rule.
      cap: HISTORY_ROW_CAP,
    },
  };
}

/**
 * Registered from `server.ts` alongside the other read models, inside the same
 * guarded block, for the two reasons that block's own comment gives:
 * `startUiServer` runs more than once in one process under test, and
 * `server-e2e.test.ts` asks the route table what it holds.
 */
export function registerPreviewHistoryRoutes(): void {
  registerRoute('GET', '/api/injection-history', {
    kind: 'json',
    handle: (ctx: ApiContext) => apiInjectionHistory(ctx.ws, ctx.url),
  });
}
