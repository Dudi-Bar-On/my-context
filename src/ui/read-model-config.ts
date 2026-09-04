/**
 * The Configure read model (web-UI plan 2, Tasks 6 and 7). Everything here
 * READS, VALIDATES and PREVIEWS; nothing writes, and nothing offers to.
 *
 * The deny hook's own words are the reason
 * (`pre-tool-use.ts` · ``changes to `.my_context/config.json` are the user`` · ~118):
 * configuration changes to `.my_context/config.json` are the user's to make. So
 * this endpoint set produces the answers a human needs in order to decide —
 * what the file says now, whether a candidate loads, and exactly what it would
 * do to the corpus — and the settlement is composed in the browser
 * (`lib/command.js`) and pasted into the user's own shell, exactly as the Work
 * screen does. A UI that wrote the file would be arguing with a rule this
 * product enforces against its own agent (spec §4, Configure).
 *
 * `test/ui/no-writes.test.ts` holds the import graph to that; this comment is
 * the rule, and the test is only the gate on it.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { injection } from '../cli/commands/injection.ts';
import { PROFILES } from '../core/categories.ts';
import {
  AGENT_EDITS, DEFAULT_BUDGETS, DEFAULT_SCOPE_POLICY, SCOPE_POLICIES, UPDATE_STORES, agentEditsFor,
  defaultAgentEdits, resolveConfig, scopePolicyFor, skippedKeyNotice, type Config,
} from '../core/config.ts';
import { select, type GateCode } from '../core/select.ts';
import type { Item, Tier } from '../core/types.ts';
import type { Workspace } from '../core/workspace.ts';
import { badRequest, parseSelectQuery, unknownParams, withStores } from './read-model.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';

/**
 * The runtime list for the `Tier` union (`types.ts` · `export type Tier = 'normative' | 'rationale';` · ~1),
 * pinned to it at COMPILE time because no runtime list exists anywhere in
 * `src/` (grepped; `isValidTier` in `config.ts` is a predicate and is not
 * exported). `erasableSyntaxOnly` means a union erases to nothing, so a screen
 * that needs to draw a tier control has to be given the members by someone —
 * and a hand-typed pair that silently stops matching the union is the drift
 * this project treats as a defect class. The `Exclude` below fails `tsc` the
 * day a third tier is added, which is the only moment this list is wrong.
 */
const TIERS = ['normative', 'rationale'] as const;
type TiersExhaustive = Exclude<Tier, (typeof TIERS)[number]> extends never ? true : never;
const tiersExhaustive: TiersExhaustive = true;
void tiersExhaustive;

/** `<projectRoot>/config.json` — the file the deny hook names, or null off-workspace. */
function configPath(ws: Workspace): string | null {
  return ws.projectRoot === null ? null : path.join(ws.projectRoot, 'config.json');
}

/**
 * `resolveConfig`'s `Config`, reshaped for JSON.
 *
 * Two things are not a straight `JSON.stringify` of it. The categories map is
 * null-prototype (`core/config.ts` · `  const categories: Record<string, ResolvedCategory> = Object.create(null);` · ~1140)
 * and unordered, so it becomes an array sorted by name — a list the editor can
 * render in a stable order rather than in whatever order the catalogue and the
 * user's overrides happened to compose.
 *
 * And `skippedNotice` is carried, which is a DUTY rather than a nicety.
 * `skippedKeys` (`core/config.ts` · `  skippedKeys: string[];` · ~352) says in its
 * own words that "a surface that shows config to a human and does not print
 * this notice has re-created the silent drop this field exists to end". The
 * browser cannot compose that sentence — `skippedKeyNotice` is a Node module —
 * so the server sends it, verbatim and worded once.
 *
 * `ui` is included because the loader reads five top-level keys, `ui` among
 * them (`core/config.ts` · `export const TOP_LEVEL_KEYS = [` · ~799).
 * A "resolved config" view that showed four of the five would be a screen
 * quietly disagreeing with the loader about what a config is.
 */
function serializable(config: Config): unknown {
  return {
    profile: config.profile,
    categories: Object.values(config.categories)
      .sort((a, b) => (a.name < b.name ? -1 : 1))
      .map((c) => ({
        name: c.name, prefix: c.prefix, tier: c.tier, enabled: c.enabled,
        agentEdits: c.agentEdits, scopePolicy: c.scopePolicy, description: c.description,
        extraFields: c.extraFields,
      })),
    budgets: config.budgets,
    watchedDocs: config.watchedDocs,
    ui: config.ui,
    skippedKeys: config.skippedKeys,
    skippedNotice: skippedKeyNotice(config),
  };
}

/**
 * What the editor's controls are built from. A constant, because every field
 * is a closed vocabulary this build already owns; computing it per request
 * would only invite a per-request opinion about it.
 *
 * `AGENT_EDITS` and `SCOPE_POLICIES` are passed through in DECLARATION ORDER,
 * which is user-facing rather than incidental
 * (`core/config.ts` · ` * Declaration order is the order the refusal lists them in — \`enumError\`` · ~124):
 * the CLI's refusals list them in this order, so a picker that reordered them
 * would teach a different vocabulary from the one the refusal prints.
 */
const META = {
  profiles: Object.keys(PROFILES),
  tiers: TIERS,
  agentEdits: AGENT_EDITS,
  scopePolicies: SCOPE_POLICIES,
  defaultBudgets: DEFAULT_BUDGETS,
  // The `updates` vocabulary, added 2026-09-01 for `plan:config seq:3`'s
  // category wizard — the one closed set on that flow this object did not
  // already carry. `UPDATE_STORES` is the array `requireUpdatableName` itself
  // validates against, passed through for the same reason `AGENT_EDITS` is: a
  // picker built from a second spelling would offer a value the loader refuses
  // the day either list moves.
  updateStores: UPDATE_STORES,
  // **The defaults a wizard must PRE-SELECT rather than leave blank**, and the
  // reason they are computed here rather than written in the browser. The task
  // states it: *"agentEdits and scopePolicy are closed vocabularies with
  // defaults per tier"* — and `plan:builder seq:2`'s rule is DERIVE, DO NOT
  // COPY. These call `defaultAgentEdits` itself, once per member of `TIERS`, so
  // the segbar a reader sees pre-pressed is pressed on the value the loader
  // would have filled in had they left the key out altogether. `scopePolicy`'s
  // default is NOT tier-dependent — `DEFAULT_SCOPE_POLICY`'s own docstring says
  // so — and is passed through flat rather than duplicated per tier, because a
  // map with two identical values invites a reader to believe it can differ.
  defaultAgentEdits: Object.fromEntries(TIERS.map((tier) => [tier, defaultAgentEdits(tier)])),
  defaultScopePolicy: DEFAULT_SCOPE_POLICY,
};

/**
 * `GET /api/config` — the file, as it is on disk right now, and what it
 * resolves to.
 *
 * **It reads the FILE, not `ws.config`, and that is still true for a different
 * reason than it used to be.** This endpoint was once the only one that
 * re-read: `ws.config` was the snapshot taken when the server booted, so an
 * editor seeded from it would compose a settlement against text no longer in
 * the file. `liveWorkspace` (core/workspace.ts) ended that — every endpoint now
 * holds the config as this request read it — and what remains here is what
 * `ws.config` still cannot carry: `raw`, the text the user is editing, and the
 * two ways it can fail to become a `Config` at all.
 *
 * Neither failure is a 500: `parseError` and `resolveError` are FIELDS. A
 * config that does not parse, or does not load, is the state this screen exists
 * to help a user out of, and an endpoint that answered it with a server error
 * would take away the one view that can show them the text to fix. `raw` is
 * carried in both cases for exactly that reason.
 *
 * **`servingLastGood` is the disclosure that the fallback is not silent.** When
 * the file stops loading mid-session, `liveWorkspace` keeps serving the last
 * config that DID load rather than failing every request at once — the full
 * argument is in that function, and the short of it is that an endpoint set
 * that dies together would take this screen with it. That leaves a state a
 * person has to be told about: the ribbon, the governing set and every tier
 * decision on every other screen are being made against a config that is not
 * the file in front of them. It is derived rather than plumbed — the two errors
 * above are computed from a fresh read of the same file by the same loader, so
 * either of them being non-null IS the condition, and a second channel
 * reporting it could only disagree with this one.
 */
export function apiConfigGet(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  const file = configPath(ws);
  if (file === null) return { status: 404, body: { error: 'no workspace here' } };

  const exists = existsSync(file);
  let raw: unknown = null;
  let parseError: string | null = null;
  if (exists) {
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      parseError = err instanceof Error ? err.message : String(err);
    }
  }
  let resolved: unknown = null;
  let resolveError: string | null = null;
  if (parseError === null) {
    try {
      // `raw ?? {}` and not `raw`: an ABSENT file resolves to pure defaults,
      // which is what the workspace itself does, and is a different fact from
      // a file holding `null`. `resolveConfig` reads both the same way, so the
      // distinction is carried by `exists` rather than smuggled into a throw.
      resolved = serializable(resolveConfig(raw ?? {}));
    } catch (err) {
      resolveError = err instanceof Error ? err.message : String(err);
    }
  }
  return {
    status: 200,
    body: {
      path: file,
      exists,
      raw,
      parseError,
      resolveError,
      resolved,
      servingLastGood: parseError !== null || resolveError !== null,
      meta: META,
    },
  };
}

/**
 * The loader's remaining silence, named — and there is exactly ONE.
 *
 * Design decision 9 was written around three: an invalid `budgets` value, a
 * non-string `watchedDocs` entry, and an unknown top-level key. Two of them are
 * refusals now. `requireBudgets` refuses by name
 * (`core/config.ts` · `function requireBudgets(raw: unknown): Budgets {` · ~1004) and
 * `requireWatchedDocs` refuses rather than filtering
 * (`core/config.ts` · `function requireWatchedDocs(raw: unknown): string[] {` · ~1050),
 * so both reach this module as a `resolveConfig` throw and leave through
 * `ok: false` with the loader's own wording. Reporting them here as findings
 * would describe leniency the product no longer has.
 *
 * The third is not a silence either, and that is the point: an unknown
 * top-level key is SKIPPED AND DISCLOSED (R14.2), because a config carrying one
 * may have been written for a newer build. The disclosure is `skippedKeys`, and
 * its wording is `skippedKeyNotice`'s — used verbatim rather than paraphrased,
 * because that function's docstring says a caller "cannot invent a second
 * phrasing for the same fact", and an editor screen inventing one would be two
 * wordings for one drop in the one screen built to prevent drops.
 *
 * So `dropped` is one entry per skipped key: `where` points the editor at the
 * key, `message` is the ONE sentence. It stays empty for every config this
 * build fully understands, and it grows again only if a later loader change
 * opens a new silence.
 */
function droppedFrom(config: Config): { where: string; message: string }[] {
  const notice = skippedKeyNotice(config);
  return config.skippedKeys.map((key) => ({ where: key, message: notice }));
}

/**
 * `POST /api/config/check` with body `{ candidate: unknown }` — would this text
 * load, and what would it leave behind?
 *
 * A refusal is `200 { ok: false, error }` rather than a 4xx, because the
 * question was answered: "no, and here is why" is this endpoint's success case.
 * The message is `resolveConfig`'s, VERBATIM, which is what makes the editor's
 * refusal wording identical to the CLI's by construction rather than by
 * agreement (spec §4: "with the same wording"). It IS the same code path.
 *
 * A malformed BODY is a different answer and takes a different status: a 400
 * that names the field. "Your config is invalid" and "I could not read what you
 * sent me" must never share a response.
 */
export function apiConfigCheck(ws: Workspace, url: URL, body: unknown): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  if (typeof body !== 'object' || body === null || Array.isArray(body) || !('candidate' in body)) {
    return badRequest(
      'POST /api/config/check takes a JSON body: { candidate: <the config.json content> }');
  }
  const candidate = (body as { candidate: unknown }).candidate;
  try {
    const resolved = resolveConfig(candidate);
    return {
      status: 200,
      body: { ok: true, resolved: serializable(resolved), dropped: droppedFrom(resolved) },
    };
  } catch (err) {
    return {
      status: 200,
      body: { ok: false, error: err instanceof Error ? err.message : String(err) },
    };
  }
}

/**
 * `POST /api/config/preview?event=…&cold=1|session=…[&path=…][&restore=…]` with
 * body `{ candidate: unknown }` — what this change would do to THIS corpus,
 * before it is made.
 *
 * The screen's whole justification (spec §4: "shows what a change would do to
 * the current corpus, before it is made… the preview is exact rather than
 * estimated, and needs no writes to compute"). Exact is not a claim made here;
 * it is a consequence of every answer below being computed by the function that
 * will actually run — `injection` for the governing set, `agentEditsFor` and
 * `scopePolicyFor` for the policy diffs, `select` for the budget half. Nothing
 * in this function estimates anything, and nothing in it re-implements a rule.
 *
 * The select context comes from the QUERY STRING, through the one parser
 * `/api/select` uses (`read-model.ts` · `export function parseSelectQuery(` · ~231):
 * the same grammar, cold labelled by the same rule, `seen` and `focus` read the
 * same way. So "what starts spilling" is answered for the session the user has
 * selected, by the selector that will actually run. The candidate rides in the
 * body because a config does not fit in a URL.
 *
 * An unloadable candidate is a 400 carrying `resolveConfig`'s message verbatim,
 * and here — unlike `check` above — a 4xx is right: a preview of a config that
 * cannot load is a preview of nothing, so there is no answer to return.
 */
export function apiConfigPreview(ws: Workspace, url: URL, body: unknown): JsonResult {
  const parsed = parseSelectQuery(ws, url);
  if ('error' in parsed) return badRequest(parsed.error);
  if (typeof body !== 'object' || body === null || Array.isArray(body) || !('candidate' in body)) {
    return badRequest(
      'POST /api/config/preview takes a JSON body: { candidate: <the config.json content> }');
  }
  let candidate: Config;
  try {
    candidate = resolveConfig((body as { candidate: unknown }).candidate);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : String(err));
  }
  const current = ws.config;
  const ctx = parsed.parsed.ctx;

  return withStores(ws, (store) => {
    const items = store.all();

    // 1. The governing-set diff, per item: `injection()` — eligibility, then
    //    tier, then `always`/`scope`/empty-scope policy, in `select`'s own
    //    order — asked twice. This ONE composition covers `enabled`, `tier`
    //    and `scopePolicy` changes uniformly, which is what spec §4 means by
    //    "shown as a diff of the governing set, not as a warning": a warning
    //    would be this module's opinion, and a diff is the system's answer.
    //
    //    `gateAfter` rides on the STOPS bucket and on that bucket alone, and
    //    the asymmetry is the information rather than an oversight: everywhere
    //    else the gate is a constant the bucket already states — `passed` for
    //    anything that becomes or stays injected, and `passed` BEFORE for
    //    anything that stops. What no bucket can say is WHICH gate the
    //    candidate config closes: rung 1 when a category is disabled, rung 2
    //    when its tier drops to rationale, rung 4 when `scopePolicy` goes
    //    `inert`. That is one field off `after`, never a second reading of
    //    the config (`GateCode`, core/select.ts).
    const becomesInjected: { id: string; title: string; type: string; phraseAfter: string }[] = [];
    const stopsBeingInjected: {
      id: string; title: string; type: string;
      phraseBefore: string; phraseAfter: string; gateAfter: GateCode;
    }[] = [];
    let unchanged = 0;
    for (const item of items) {
      const before = injection(item, current);
      const after = injection(item, candidate);
      if (before.injected === after.injected) { unchanged++; continue; }
      if (after.injected) {
        becomesInjected.push({
          id: item.id, title: item.title, type: item.type, phraseAfter: after.phrase,
        });
      } else {
        stopsBeingInjected.push({
          id: item.id, title: item.title, type: item.type,
          phraseBefore: before.phrase, phraseAfter: after.phrase, gateAfter: after.gate,
        });
      }
    }

    // 2 + 3. The policy diffs, per category, through the ONE lookup each
    //    (`core/config.ts` · `export function agentEditsFor(config: Config, type: string): AgentEdits {` · ~201
    //    and `core/config.ts` · `export function scopePolicyFor(config: Config, type: string): ScopePolicy {` · ~179).
    //    The union of both configs' category names, because a candidate may
    //    DECLARE a category the current config has never had, and a category
    //    appearing from nowhere is a change a preview must not omit.
    const categoryNames = [...new Set([
      ...Object.keys(current.categories), ...Object.keys(candidate.categories),
    ])].sort();
    const agentEdits = categoryNames.flatMap((name) => {
      const before = agentEditsFor(current, name);
      const after = agentEditsFor(candidate, name);
      if (before === after) return [];
      // Counted AND named (spec §4): "17 items" is a number a reader has to
      // trust, and a list is one they can check.
      const affected = items
        .filter((i: Item) => i.type === name)
        .map((i: Item) => ({ id: i.id, title: i.title, status: i.status }));
      return [{ category: name, before, after, items: affected }];
    });
    const scopePolicy = categoryNames.flatMap((name) => {
      const before = scopePolicyFor(current, name);
      const after = scopePolicyFor(candidate, name);
      if (before === after) return [];
      // The UNSCOPED items specifically: they are the ones whose reach this
      // setting decides, and under `inert` they are the ones that become
      // injectable nowhere. A scoped item's reach does not move.
      const unscopedItems = items
        .filter((i: Item) => i.type === name && i.scope.length === 0)
        .map((i: Item) => ({ id: i.id, title: i.title }));
      return [{ category: name, before, after, unscopedItems }];
    });

    // 4. The budget half: the REAL selector, twice, over the same context and
    //    the same items. `select` is what the hook runs, so `after.spilled` is
    //    what would actually start spilling rather than an estimate of it.
    const selection = { before: select(items, ctx, current), after: select(items, ctx, candidate) };

    return {
      status: 200,
      body: {
        governing: { becomesInjected, stopsBeingInjected, unchanged },
        agentEdits,
        scopePolicy,
        selection,
      },
    };
  });
}

export function registerConfigRoutes(): void {
  registerRoute('GET', '/api/config', {
    kind: 'json', handle: (ctx: ApiContext) => apiConfigGet(ctx.ws, ctx.url),
  });
  registerRoute('POST', '/api/config/check', {
    kind: 'json', handle: (ctx: ApiContext) => apiConfigCheck(ctx.ws, ctx.url, ctx.body),
  });
  registerRoute('POST', '/api/config/preview', {
    kind: 'json', handle: (ctx: ApiContext) => apiConfigPreview(ctx.ws, ctx.url, ctx.body),
  });
}
