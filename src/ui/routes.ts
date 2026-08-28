/**
 * The route table — the ONE extension point the three web-UI plans share.
 *
 * Plans 2 and 3 add routes by calling `registerRoute` from their own modules
 * (imported by `server.ts`); they never touch the dispatch loop, and NOTHING a
 * route registers can bypass the security gate, which runs before dispatch
 * (`server.ts`, Task 13).
 *
 * `kind: 'stream'` exists for plan 3's audit stream. This plan registers no
 * stream route; the dispatch loop treats stream routes as NOT activity for the
 * idle monitor (spec §2: an open stream never resets the timer), so plan 3
 * inherits the ephemerality rule instead of having to remember it.
 *
 * Nothing here reads a corpus, so nothing here can write one. The table holds
 * handlers and matches paths; every fact about the project comes from the
 * handler bodies in `read-model.ts`.
 */
import type { ServerResponse } from 'node:http';
import type { Workspace } from '../core/workspace.ts';
import type { CodeIdentity } from './code-identity.ts';

export interface ApiContext {
  ws: Workspace;
  /**
   * `null` when `ws.config` above IS `config.json` as it stands on disk right
   * now. Otherwise the loader's own message for why the file no longer loads,
   * and `ws.config` is the last config that DID (`plan:live seq:13`).
   *
   * **Both fields come from ONE `live.now()` call, and that is the whole
   * design.** `WorkspaceNow` returns the config and the reason together
   * precisely so a caller cannot hold one without the other; splitting them
   * across two reads here would re-create the disagreement `liveWorkspace`
   * exists to end, one layer up. It is derived, never plumbed — the same
   * discipline `servingLastGood` follows on `/api/config`, which computes the
   * condition from the read it already performed rather than accepting it as a
   * payload from somewhere else.
   *
   * It is on the CONTEXT rather than on the one route that discloses it
   * because the fact is about every route: `/api/simulate`'s ribbon,
   * `/api/capture`'s filter and `/api/packs`' `carries` are all judged against
   * `ws.config`, so any of them may answer from the last good config. Today
   * `/api/meta` is the only one that SAYS so, and a second surface that needs
   * to say it inherits this answer rather than spelling a second one.
   */
  configError: string | null;
  /** The repository root — `path.dirname(ws.projectRoot)`, not the `.my_context` directory. */
  repoRoot: string;
  /**
   * What code this process is running, and whether the disk has moved on since
   * (`plan:live seq:12`).
   *
   * Here rather than read from a module-level singleton by whichever handler
   * wants it, for the reason `ws` is here: one value, built once per server,
   * handed to every route, so two surfaces cannot answer the same question
   * differently. `/api/ping` and `/api/meta` both disclose from THIS, and a
   * third that appears later inherits the same answer rather than a second
   * spelling of it. See `code-identity.ts`.
   */
  code: CodeIdentity;
  /** The parsed request URL, query string included. */
  url: URL;
  /** The `:name` segments this route matched, decoded. */
  params: Record<string, string>;
  /** The parsed JSON body on POST, else `undefined`. */
  body: unknown;
}

export interface JsonResult { status: number; body: unknown }

export type RouteHandler =
  | { kind: 'json'; handle(ctx: ApiContext): JsonResult | Promise<JsonResult> }
  | { kind: 'stream'; handle(ctx: ApiContext, res: ServerResponse): void };

interface Route {
  method: string;
  path: string;
  segments: string[];
  handler: RouteHandler;
}

const routes: Route[] = [];

function splitPath(pathname: string): string[] {
  return pathname.split('/').filter((s) => s !== '');
}

const isParam = (segment: string): boolean => segment.startsWith(':');

/**
 * Two registered paths COLLIDE when no request could ever tell them apart:
 * same method, same segment count, and every position either the same literal
 * or a parameter on both sides. `:id` and `:name` at the same position collide
 * — the parameter's NAME is the handler's private business and changes nothing
 * about which requests reach it — so `/api/item/:id` and `/api/item/:name` are
 * refused as the duplicate they are rather than registered as a second route
 * that can never match. That is the plan's "registering a duplicate throws
 * (nothing is silently replaced)", read as the property it is protecting: a
 * registration that can never be reached is a silently dropped registration.
 */
function collides(a: Route, method: string, segments: string[]): boolean {
  if (a.method !== method || a.segments.length !== segments.length) return false;
  return a.segments.every((seg, i) => {
    const other = segments[i];
    return isParam(seg) && isParam(other) ? true : seg === other;
  });
}

export function registerRoute(method: 'GET' | 'POST', path: string, handler: RouteHandler): void {
  const segments = splitPath(path);
  const clash = routes.find((r) => collides(r, method, segments));
  if (clash) {
    throw new Error(
      `mycontext ui: route ${method} ${path} is already registered as ${clash.method} ` +
      `${clash.path}. Nothing is replaced: two handlers behind one path would make which ` +
      'one answers depend on import order.',
    );
  }
  routes.push({ method, path, segments, handler });
}

/**
 * Match a request against the table. **The most specific route wins, and the
 * order routes were registered in never decides anything.**
 *
 * A linear "first registered wins" scan is what the alternative looks like,
 * and it makes `/api/item/count` unreachable whenever `/api/item/:id` happened
 * to be registered first — a route silently shadowed by an import order, which
 * is the failure `registerRoute` refuses in its own half of the problem. So
 * candidates are ordered by their first differing segment, literal before
 * parameter (`/api/item/count` beats `/api/item/:id`; `/a/b/:y` beats
 * `/a/:x/c`). Ties are impossible by construction: two candidates that agree
 * on literal-versus-parameter at every position and match the same request are
 * exactly what `collides` refuses at registration.
 */
export function matchRoute(method: string, pathname: string):
{ handler: RouteHandler; params: Record<string, string> } | null {
  const parts = splitPath(pathname);
  let best: Route | null = null;
  for (const route of routes) {
    if (route.method !== method || route.segments.length !== parts.length) continue;
    if (!route.segments.every((seg, i) => isParam(seg) || seg === parts[i])) continue;
    if (best === null || moreSpecific(route, best)) best = route;
  }
  if (best === null) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < parts.length; i++) {
    const seg = best.segments[i];
    if (isParam(seg)) params[seg.slice(1)] = decodeURIComponent(parts[i]);
  }
  return { handler: best.handler, params };
}

/** Leftmost literal wins. Both arguments already matched the same request. */
function moreSpecific(a: Route, b: Route): boolean {
  for (let i = 0; i < a.segments.length; i++) {
    const aParam = isParam(a.segments[i]);
    const bParam = isParam(b.segments[i]);
    if (aParam !== bParam) return bParam;
  }
  return false;
}

/**
 * Every `(method, path)` in the table, in registration order — for tests and
 * for Task 13's runtime no-write sweep, which has to exercise EVERY read route
 * and cannot do that from a list maintained by hand beside the real one.
 */
export function registeredRoutes(): { method: string; path: string }[] {
  return routes.map((r) => ({ method: r.method, path: r.path }));
}
