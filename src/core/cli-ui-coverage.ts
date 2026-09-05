/**
 * CLI-versus-UI coverage: which CLI commands have a UI route that reads the
 * same data, which do not, and which UI routes answer a question the CLI has
 * no command for.
 *
 * `TASK-disclose-where-cli-and-ui-coverage-differ-derived-from-the`
 * (`plan:docsys seq:7`), building
 * `docs/superpowers/specs/2026-09-05-documentation-screen-design.md` §3 and
 * the clause of `REQ-the-two-readmes-are-the-base-of-a-documentation-system-that`
 * that requires it: *"Where a capability exists on one surface and not the
 * other, the documentation says so, because a reader needs to know which can
 * do what."*
 *
 * **Both inputs are passed in, never imported here.** `src/core/` may not
 * reach into `src/ui/`, and a derivation that reads its own inputs cannot be
 * asked what it would say about a command that does not exist — which is the
 * one behaviour `docsys/7`'s verification names ("a manually-added CLI
 * command with no UI equivalent is asserted to render as explicitly
 * uncovered, never silently absent from the table"). The caller supplies
 * `COMMANDS`' own definitions and `registeredRoutes()`' own table;
 * `scripts/gen-cli-ui-coverage.ts` and `test/docs/doc-system.test.ts` both do
 * exactly that, from the running program.
 *
 * **What the match is, stated plainly, because a reader of the generated
 * table is entitled to know what "covered" measured.** A route covers a
 * command when the route's own path NAMES it: some path segment, singularised,
 * equals the command name, singularised. `/api/decay` covers `decay`;
 * `/api/sessions` covers `session`; `/api/session/:session/injected` covers
 * `session`. Nothing here reads a handler, follows an import graph, or judges
 * whether the two produce the same bytes — name agreement is the whole rule,
 * and it is the same rule `test/docs/inventory.test.ts` already uses in the
 * other direction for the README.
 *
 * **`DECLARED` is the small, pinned exception list for the pairs whose names
 * disagree**, in the shape `scripts/build-tutorial-manifest.ts`'s `CLUSTERS`
 * and `scripts/gen-commands.ts`'s `KEEP` already take: a judgement no glob can
 * make, written once, and held closed by a test in both directions —
 * `test/docs/doc-system.test.ts` fails when an entry names a command that does
 * not exist, names a route that is not registered, or restates a pair the name
 * rule already found. Without it `mycontext list` and `mycontext show` would
 * both print "CLI only" beside a UI that plainly lists and shows items, which
 * is a worse lie than the one this table exists to prevent.
 *
 * **What this table does NOT say, so the generated document cannot be read as
 * saying it.** A route that reads the same data is not the same capability as
 * a command that CHANGES that data. The UI is read-only by design and by test
 * (`test/ui/no-writes.test.ts` holds its import graph to one ruled write
 * symbol), so the writing half of every mutating command is CLI-only whatever
 * this table's verdict column says. The generated document states that once,
 * above the table, rather than repeating a guess per row.
 */

/** One CLI command, as `COMMANDS` itself carries it. */
export interface CliCommandFact {
  name: string;
  summary: string;
}

/** One registered route, as `registeredRoutes()` itself carries it. */
export interface UiRouteFact {
  method: string;
  path: string;
}

/** How a row's route list was arrived at. */
export type CoverageBasis = 'named' | 'declared' | 'none';

export interface CoverageRow {
  command: string;
  summary: string;
  /** The routes that read the same data, in table order. Empty when none. */
  routes: string[];
  basis: CoverageBasis;
  /**
   * The sentence the generated table prints in its last column: what the UI
   * can do for this command, or that it can do nothing. Derived for `named`
   * and `none`; the declared entry's own words for `declared`.
   */
  note: string;
}

/** A route no CLI command names — the other direction of the same question. */
export interface UiOnlyRoute {
  method: string;
  path: string;
}

export interface CliUiCoverage {
  rows: CoverageRow[];
  uiOnly: UiOnlyRoute[];
  /** Rows with at least one route. */
  covered: number;
  /** Rows with none. */
  cliOnly: number;
}

/**
 * One hand-made equivalence, for a pair whose NAMES disagree. Every field is
 * checked by `test/docs/doc-system.test.ts` against the running program, so an
 * entry cannot outlive the command or the route it names.
 */
export interface DeclaredEquivalence {
  command: string;
  routes: string[];
  /** What the UI actually offers here — printed verbatim in the table. */
  why: string;
}

/**
 * The five pairs the name rule cannot see. Each one was read out of the
 * module that answers the route before it was written down, and each says
 * what the UI does NOT do as well as what it does — a half-equivalence
 * recorded as a full one would be the same over-claim as a silent omission.
 */
export const DECLARED: DeclaredEquivalence[] = [
  {
    command: 'list',
    routes: ['GET /api/items'],
    why: "the Work screen's item list is the same read",
  },
  {
    command: 'show',
    routes: ['GET /api/item/:id'],
    why: 'an item opens in the browser with the same body and the same governing set',
  },
  {
    command: 'review',
    routes: ['GET /api/review-queue', 'GET /api/revisions'],
    why: 'the queue is browsable; promoting, rejecting and editing a draft stay CLI-only',
  },
  {
    command: 'query',
    routes: ['GET /api/ask/corpus'],
    why: 'Ask reads the same index through a fixed set of filters — it accepts no SQL, ' +
      'so an arbitrary SELECT has no UI equivalent',
  },
  {
    command: 'export',
    routes: ['GET /api/port'],
    why: 'the Export screen describes what an export would carry and composes the command; ' +
      'it never writes the artefact',
  },
];

/** `items` → `item`; `decay` → `decay`. Short words are left alone so `ui`
 * and `pack` are not mangled into something no route could match. */
function singular(word: string): string {
  return word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
}

/**
 * The name-bearing segments of a route path: everything after `/api`, with
 * `:params` dropped. `/api/session/:session/injected` → `session`, `injected`.
 */
export function routeSegments(routePath: string): string[] {
  return routePath
    .split('/')
    .filter((s) => s !== '' && s !== 'api' && !s.startsWith(':'));
}

/** Whether `route` names `command`, by the rule this module's header states. */
export function routeNamesCommand(command: string, routePath: string): boolean {
  const wanted = singular(command);
  return routeSegments(routePath).some((segment) => singular(segment) === wanted);
}

/** `GET /api/doc/:id`, the spelling every row and every declared entry uses. */
export function routeLabel(route: UiRouteFact): string {
  return `${route.method} ${route.path}`;
}

/**
 * The whole table, derived from the two inputs and nothing else.
 *
 * Rows come out sorted by command name, and EVERY command supplied gets a row
 * — a command with no route is present and says so, never absent. That is the
 * property `docsys/7`'s verification asks for, and the reason this function
 * builds from `commands` rather than from the routes it managed to match.
 */
export function deriveCliUiCoverage(
  commands: CliCommandFact[],
  routes: UiRouteFact[],
  declared: DeclaredEquivalence[] = DECLARED,
): CliUiCoverage {
  const labels = new Set(routes.map(routeLabel));
  const byCommand = new Map(declared.map((d) => [d.command, d]));
  const matched = new Set<string>();

  const rows = [...commands]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((command): CoverageRow => {
      const named = routes.filter((r) => routeNamesCommand(command.name, r.path)).map(routeLabel);
      if (named.length > 0) {
        for (const label of named) matched.add(label);
        return {
          command: command.name,
          summary: command.summary,
          routes: named,
          basis: 'named',
          note: 'a route reads the same data',
        };
      }
      const entry = byCommand.get(command.name);
      // A declared route that is no longer registered is dropped here and
      // reported as a failure by the gate, never silently printed as a link to
      // an endpoint that does not answer.
      const live = entry === undefined ? [] : entry.routes.filter((r) => labels.has(r));
      if (entry !== undefined && live.length > 0) {
        for (const label of live) matched.add(label);
        return {
          command: command.name,
          summary: command.summary,
          routes: live,
          basis: 'declared',
          note: entry.why,
        };
      }
      return {
        command: command.name,
        summary: command.summary,
        routes: [],
        basis: 'none',
        note: 'no UI route reads this — CLI only',
      };
    });

  const uiOnly = routes
    .filter((r) => !matched.has(routeLabel(r)))
    .map((r) => ({ method: r.method, path: r.path }));

  return {
    rows,
    uiOnly,
    covered: rows.filter((r) => r.routes.length > 0).length,
    cliOnly: rows.filter((r) => r.routes.length === 0).length,
  };
}
