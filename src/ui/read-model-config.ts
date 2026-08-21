/**
 * The Configure read model (web-UI plan 2, Task 6). Everything here
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
import { PROFILES } from '../core/categories.ts';
import {
  AGENT_EDITS, DEFAULT_BUDGETS, SCOPE_POLICIES, resolveConfig, skippedKeyNotice, type Config,
} from '../core/config.ts';
import type { Tier } from '../core/types.ts';
import type { Workspace } from '../core/workspace.ts';
import { badRequest, unknownParams } from './read-model.ts';
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
 * null-prototype (`config.ts` · `  const categories: Record<string, ResolvedCategory> = Object.create(null);` · ~671)
 * and unordered, so it becomes an array sorted by name — a list the editor can
 * render in a stable order rather than in whatever order the catalogue and the
 * user's overrides happened to compose.
 *
 * And `skippedNotice` is carried, which is a DUTY rather than a nicety.
 * `skippedKeys` (`config.ts` · `  skippedKeys: string[];` · ~233) says in its
 * own words that "a surface that shows config to a human and does not print
 * this notice has re-created the silent drop this field exists to end". The
 * browser cannot compose that sentence — `skippedKeyNotice` is a Node module —
 * so the server sends it, verbatim and worded once.
 *
 * `ui` is included because the loader reads five top-level keys, `ui` among
 * them (`config.ts` · `const TOP_LEVEL_KEYS = ['profile', 'categories', 'budgets', 'watchedDocs', 'ui'];` · ~452).
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
 * (`config.ts` · ` * Declaration order is the order the refusal lists them in — \`enumError\`` · ~96):
 * the CLI's refusals list them in this order, so a picker that reordered them
 * would teach a different vocabulary from the one the refusal prints.
 */
const META = {
  profiles: Object.keys(PROFILES),
  tiers: TIERS,
  agentEdits: AGENT_EDITS,
  scopePolicies: SCOPE_POLICIES,
  defaultBudgets: DEFAULT_BUDGETS,
};

/**
 * `GET /api/config` — the file, as it is on disk right now, and what it
 * resolves to.
 *
 * **Fresh on every call, deliberately.** `ws.config` is the snapshot taken when
 * the server booted, and the file is the user's to edit while it runs — that is
 * the entire premise of this screen. An editor seeded from the boot-time
 * snapshot would compose a settlement against text no longer in the file.
 *
 * Neither failure is a 500: `parseError` and `resolveError` are FIELDS. A
 * config that does not parse, or does not load, is the state this screen exists
 * to help a user out of, and an endpoint that answered it with a server error
 * would take away the one view that can show them the text to fix. `raw` is
 * carried in both cases for exactly that reason.
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
    body: { path: file, exists, raw, parseError, resolveError, resolved, meta: META },
  };
}

/**
 * The loader's remaining silence, named — and there is exactly ONE.
 *
 * Design decision 9 was written around three: an invalid `budgets` value, a
 * non-string `watchedDocs` entry, and an unknown top-level key. Two of them are
 * refusals now. `requireBudgets` refuses by name
 * (`config.ts` · `function requireBudgets(raw: unknown): Budgets {` · ~536) and
 * `requireWatchedDocs` refuses rather than filtering
 * (`config.ts` · `function requireWatchedDocs(raw: unknown): string[] {` · ~582),
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

export function registerConfigRoutes(): void {
  registerRoute('GET', '/api/config', {
    kind: 'json', handle: (ctx: ApiContext) => apiConfigGet(ctx.ws, ctx.url),
  });
  registerRoute('POST', '/api/config/check', {
    kind: 'json', handle: (ctx: ApiContext) => apiConfigCheck(ctx.ws, ctx.url, ctx.body),
  });
  // Task 7 adds /api/config/preview here.
}
