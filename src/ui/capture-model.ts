/**
 * The Capture read model (web-UI plan `api`, seq 1): **what already governs a
 * scope, before a second item is filed into it.**
 *
 * The screen is `<section data-p="capture">`
 * (`docs/design/web-ui-mockup.html` · `  <section data-p="capture" hidden>` · ~1969),
 * and it states its own justification in one sentence
 * (`src/ui/public/strings/en.js` · `What it contributes over the CLI is the overlap check — the items already governing this scope.` · ~324).
 * That sentence is the whole contract of this file. Everything else the screen
 * draws — the heading, the note, the composed command, the warning — is
 * already owned somewhere else, and this module deliberately serves none of it.
 *
 * ── WHAT THIS MODULE WILL NOT DO, AND WHO OWNS EACH INSTEAD ───────────────
 *
 * **It does not compose the command.** The mockup's card ends in
 * `mycontext add constraint "…" --scope "src/billing/**" --severity hard`, and
 * every byte of that is already the browser's: `PALETTE`'s `add` entry carries
 * the argv shape AND an `overlap: true` marking for this very screen
 * (`src/ui/public/lib/palette-defs.js` · `name: 'add', kind: 'write', base: ['mycontext', 'add'], overlap: true, boundary: true,` · ~61),
 * and the quoting is one implementation with a checker over its own bytes
 * (`src/ui/public/lib/command.js` · `Command-string composition for every composed write in the UI — the ONE` · ~1).
 * A server-side compose would be a SECOND spelling of a quoting rule whose
 * first spelling is verified against the real argument parser by
 * `test/ui/palette-lib.test.ts`. Handing back a string this file quoted would
 * put an unchecked shell command on the user's clipboard, which is the one
 * outcome the whole composed-and-copied design exists to prevent. Reported to
 * the owner as a divergence from this task's own wording rather than taken
 * quietly — see the report, open question 1.
 *
 * **It does not run the command, and it writes nothing at all.** Not a
 * qualification of the above: `test/ui/no-writes.test.ts` holds this module's
 * whole import graph to it, and the imports below are the reason it can.
 * `core/select.ts` and `cli/commands/injection.ts` are already in the server's
 * graph through `read-model.ts` and `read-model-work.ts`; `core/focus.ts` is
 * reached for a TYPE only, so that statement erases and is not an edge at all
 * — which matters here rather than in general, because `focus.ts` binds
 * `recordAudit`.
 *
 * **It does not score, rank or reorder.** `cap.nosim` draws that line in the
 * mockup's own words
 * (`src/ui/public/strings/en.js` · `These are the items whose scope matches` · ~328),
 * and the spec of record repeats it as an instruction
 * (`docs/superpowers/specs/2026-08-16-web-ui-design.md` · `Build the scope match; do not build a similarity score.` · ~1030).
 * A similarity metric DOES exist in `src/ui/` now — `overlapScore`, behind
 * `POST /api/overlap` — and its own comment already says it must not reach a
 * screen until the owner rules
 * (`src/ui/read-model-work.ts` · `a ranked order must not be rendered until the owner rules` · ~282).
 * This endpoint is the OTHER answer, the one the mockup asks for, and the two
 * must not be conflated: nothing below reads `overlapScore`, and the response
 * carries no score field for a screen to sort on by accident.
 *
 * ── THE PREDICATE IS BORROWED, NOT INVENTED ───────────────────────────────
 *
 * "Which items already govern this scope" is `mycontext focus --scope`'s
 * question, and `matchesFocus` is the function that answers it. It is called
 * here with two empty axes and the scope axis filled, so the OR-within-an-axis
 * rule that makes `--scope "a/**,b/**"` mean "a or b" is the product's own line
 * rather than a re-spelling of it
 * (`src/core/select.ts` · `if (focus.scope.length > 0 && !focus.scope.some((s) => focusMatchesScope(item, s, config))) {` · ~305).
 *
 * `focusMatchesScope` — the per-pattern half — matches in BOTH directions on
 * purpose (`src/core/select.ts` · `export function focusMatchesScope(item: Item, value: string, config: Config): boolean {` · ~290),
 * and both are needed here. Against a candidate scope of `src/billing/**`, an
 * item scoped `src/**` is found by reading the candidate as a subject, and an
 * item scoped `src/billing/api/**` is found by reading it as a pattern. A
 * capture-time overlap check that could only see one direction would miss half
 * the items it exists to surface, and a missed overlap is this screen's whole
 * failure mode. Unscoped items are in, for the reason `search --path` gives for
 * including them
 * (`src/cli/commands/search.ts` · `governs a file and therefore returns the UNSCOPED items too, because an item with no` · ~55):
 * an item with no scope is unrestricted, so it governs this scope too — unless
 * the category's `scopePolicy` is `inert`, which `matchesScope` refuses on
 * every path and `injection()` reports as the `scope` gate.
 *
 * ── AND "GOVERNING" IS `injection()`, NOT "MATCHES" ───────────────────────
 *
 * The card's heading is `Already governing {mv:scope}`
 * (`src/ui/public/strings/en.js` · `'cap.already': 'Already governing {mv:scope}',` · ~325),
 * and "a draft governs nothing" is a sentence this product prints in a dozen
 * places. So the scope match is a FILTER and not the answer: an item is listed
 * only when `injection()` also says it is injected. That is the same verdict
 * `/api/items`, `/api/search` and `/api/review-queue` all serve, so no screen
 * can find this list disagreeing with those about what governs.
 *
 * The items that second filter removes are COUNTED and disclosed rather than
 * dropped (`INV-nothing-is-dropped-silently`) — see `notGoverning` below.
 */
import { injection } from '../cli/commands/injection.ts';
import { matchesFocus } from '../core/select.ts';
import type { FocusAxes } from '../core/focus.ts';
import type { Tier } from '../core/types.ts';
import type { Workspace } from '../core/workspace.ts';
import { badRequest, repeatedParams, unknownParams, withStores } from './read-model.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';

/**
 * One row of the mockup's table, and that table has exactly two cells per row:
 * `<td class="m">INV-prices-are-integer-cents</td>` and
 * `<td class="small">invariant, normative</td>`. So: an id, a category and a
 * tier — and the spec of record names the same three
 * (`docs/superpowers/specs/2026-08-16-web-ui-design.md` · `listing those items with their category and tier,` · ~1022).
 *
 * **`title` is absent on purpose, and that absence is the point of the rule
 * this task cites.** `/api/session/:session/injected` serves a joined title no
 * screen reads, and the owner has that on the table as either waste or an
 * unfinished intention
 * (`TASK-rule-on-injectedline-title-a-served-field-no-screen-reads`, plan:ui1
 * seq:17f). The Capture row draws an id and two words; adding a title here
 * would file the identical defect the same week it was named. If the card
 * should show titles, the mockup grows the column first.
 *
 * **`injected`, `phrase` and `gate` are absent for a stronger reason: here
 * they would be CONSTANTS.** Every member of this array passed `injection()`,
 * so `injected` is `true` and `gate` is `'passed'` for all of them, by
 * construction. A field that cannot vary is not a fact about the item.
 *
 * `tier` is the one field here that is arguably also a constant —
 * `injection()` refuses anything not normative
 * (`src/cli/commands/injection.ts` · `if (!normative) return no('tier', RATIONALE_NOT_INJECTED);` · ~111),
 * so every row's tier is `'normative'` today. It is served anyway, because the
 * alternative is a hardcoded English word in the view, and a screen that
 * invents `normative` is a screen asserting a property it never read. Here it
 * is read off the config, so it stays correct if the owner ever widens the
 * filter. Named in the report as open question 3 rather than settled here.
 */
export interface GoverningRow {
  id: string;
  /** The category name — `invariant`, `standard`, `constraint`. */
  type: string;
  /** `config.categories[type].tier`, the same value `injection()` gated on. */
  tier: Tier;
}

export interface CaptureBody {
  /**
   * The patterns as this endpoint PARSED them — comma-split, trimmed, empties
   * removed — echoed for the reason `/api/glob` echoes its own `patterns`: the
   * screen knows what it typed, and only the server knows what survived the
   * parse. `?scope=a/**,,b/**` is answered about two patterns, and this echo is
   * where that is visible instead of silent.
   */
  scope: string[];
  /** Ordered by id, ascending. **Not by relevance — there is no relevance here.** */
  governing: GoverningRow[];
  /**
   * How many items matched the scope and were then removed because they do not
   * govern: drafts, deprecated and superseded items, items in a disabled
   * category, items in a rationale category, and unscoped items under
   * `scopePolicy: "inert"`.
   *
   * **This number has no string in the mockup, and it is served anyway.** The
   * filter above is a drop, and `INV-nothing-is-dropped-silently` does not
   * exempt a drop the design did not anticipate. The precedent is
   * `read-model.ts`'s `seenUnreadable`: carried, and documented as *not yet
   * rendered anywhere a reader would see it*, rather than quietly not computed.
   * Said plainly so a green test is not read as a finished screen — **the
   * Capture screen cannot currently tell a user that three drafts already sit
   * in the scope they are about to file into.** Whether it should, and whether
   * the breakdown by gate is wanted (`injection().gate` would give it for
   * free), is the owner's; it is open question 2 in the report.
   */
  notGoverning: number;
}

const CAPTURE_PARAMS = ['scope'];

/**
 * `GET /api/capture?scope=a/**,b/**` — the items already governing a scope that
 * is about to have another item filed into it.
 *
 * Comma-separated exactly as `--scope` takes it and exactly as `/api/glob`
 * reads it, so the value the Composer's glob tester is previewing and the value
 * this endpoint answers about are one string in one grammar.
 *
 * **An absent or empty scope is a 400, not "the whole corpus".** The reasoning
 * is `/api/search`'s, and so is the shape of the wording: a filter that
 * restricts nothing matches everything, and everything is `/api/items`. It
 * matters more here than there — `mycontext add` with no `--scope` is a legal
 * capture, so this is a request a screen can really make, and answering it with
 * a corpus-wide list under a heading that reads *"Already governing"* would
 * tell a user that every item in the project governs the thing they are about
 * to write.
 *
 * **A repeated parameter is a 400 too**, which `/api/glob` does not do for its
 * own `pattern` and should. `URLSearchParams.get` returns the first occurrence,
 * so `?scope=src/**&scope=test/**` would answer about `src` and discard `test`
 * behind a 200
 * (`src/ui/read-model.ts` · `parameter "${key}" was given more than once. Only the first value would be ` · ~113).
 * On an endpoint whose only parameter IS the question, that is not a nicety.
 *
 * **No cap, and therefore nothing to disclose about one.** `/api/items` serves
 * the whole corpus uncapped and this is a subset of it, so a cap here would
 * make the narrow question answerable in less detail than the broad one. If a
 * corpus ever makes this list unrenderable, the cap and its disclosure land
 * together, the way `/api/search`'s `truncated` and `/api/glob`'s
 * `fileWalkTruncated` did.
 *
 * **Off-workspace is a named 404, not a 500.** `resolveWorkspace` outside a
 * project answers `dbPath: ':memory:'`, and `withStores` opens it and throws
 * `no such table: schema_version` — measured, not assumed. `apiRevisions`,
 * `apiGlob` and `apiConfigGet` all guard `projectRoot` and answer `no
 * workspace here`; `apiReviewQueue` does not, and throws that sentence at the
 * dispatch loop instead. This one guards, because "there is no corpus here" is
 * a state the Capture screen can render and a SQLite table name is not.
 * (The `/api/review-queue` gap is a defect in a file this task does not own
 * and is named in the report rather than fixed on the way past.)
 *
 * **The ITEMS are read fresh on every call; the CONFIG is not.** `store.all()`
 * reads the index as it stands, so an item captured while the server runs
 * appears on the next request — asserted, not assumed. `ws.config` is the
 * snapshot taken when the server booted, exactly as it is for `/api/items`,
 * `/api/search` and `/api/review-queue`, so a category disabled or retiered in
 * `config.json` mid-session does not move an item across this filter until the
 * server restarts. That is inherited rather than chosen here, and `/api/config`
 * is the one endpoint that deliberately re-reads. Recorded so a green test is
 * not read as proving more than it does.
 */
export function apiCapture(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, CAPTURE_PARAMS) ?? repeatedParams(url);
  if (bad) return badRequest(bad);

  const raw = url.searchParams.get('scope');
  const patterns = (raw ?? '').split(',').map((s) => s.trim()).filter((s) => s !== '');
  if (patterns.length === 0) {
    return badRequest(
      'scope=<glob>[,<glob>…] is required — the same comma form --scope takes. A scope that ' +
      'restricts nothing governs everything, which is /api/items, not the overlap check');
  }
  // AFTER the request is understood and BEFORE anything is opened, which is
  // `apiGlob`'s order: a request this endpoint cannot parse is refused as a
  // bad request wherever it was sent, and only a well-formed one earns an
  // answer about whether there is a corpus here to answer it from.
  if (ws.projectRoot === null) return { status: 404, body: { error: 'no workspace here' } };

  // Two empty axes and one filled: `matchesFocus` is asked ONLY about scope, so
  // its AND-across-axes rule is inert and its OR-within-an-axis rule is exactly
  // the comma semantics above. Spelling `patterns.some(…)` here instead would
  // be a private second copy of one line of `matchesFocus`.
  const axes: FocusAxes = { tags: [], categories: [], scope: patterns };

  return withStores(ws, (store): JsonResult => {
    const governing: GoverningRow[] = [];
    let notGoverning = 0;
    for (const item of store.all()) {
      if (!matchesFocus(item, axes, ws.config)) continue;
      const verdict = injection(item, ws.config);
      if (!verdict.injected) { notGoverning++; continue; }
      // `injection()` returned `injected: true`, which it can only do after
      // reading this category's tier, so the lookup below cannot be undefined.
      // `Object.hasOwn` is not needed for the same reason: the key is one
      // `injection()` has already resolved on the same null-prototype map.
      governing.push({ id: item.id, type: item.type, tier: ws.config.categories[item.type].tier });
    }
    // `apiItems`' comparator, character for character: the two lists are read
    // on adjacent screens and must not sort differently.
    governing.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const body: CaptureBody = { scope: patterns, governing, notGoverning };
    return { status: 200, body };
  });
}

/**
 * The wiring the orchestrator calls, shaped exactly like `registerWorkRoutes`
 * and `registerConfigRoutes` so the merge is one import and one call inside
 * `registerReadRoutes`' guarded block — never beside it, for the two reasons
 * `server.ts` records there: `startUiServer` is called repeatedly in one
 * process by `test/ui/server.test.ts`, and `server-e2e.test.ts`'s no-write
 * sweep asks `registerReadRoutes()` what the table holds.
 *
 * **Until that call lands, `test/ui/no-writes.test.ts` FAILS**, and it is
 * supposed to: its first assertion equates every `src/ui/` module on disk with
 * the set reachable from `server.ts`, and its message for the difference is
 * *"either dead code or a route nobody wired"*. This module is the second of
 * those two until the merge. That failure is not routed around here — editing
 * `server.ts` from this branch is what the plan forbids, and adding this file
 * to `OFF_SERVER_GRAPH` would record a permanent exception for a temporary
 * state. Measured, reported, and left as the accurate signal it is.
 */
export function registerCaptureRoutes(): void {
  registerRoute('GET', '/api/capture', {
    kind: 'json', handle: (ctx: ApiContext) => apiCapture(ctx.ws, ctx.url),
  });
}
