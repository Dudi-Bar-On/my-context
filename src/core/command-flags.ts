/**
 * **Each command's FLAG SPEC, in a module with no write surface.**
 *
 * What flags a command accepts, and which of them take the next token as a
 * value, is a fact about the command line — not about executing anything. It
 * lived inside the modules that execute, because that is where it was first
 * needed, and those modules import `updateItem`, `linkItems` and
 * `stageRevision`.
 *
 * That placement has one concrete consequence and it is the reason this module
 * exists. `test/ui/no-writes.test.ts` bans `src/cli/index.ts` from `src/ui/`,
 * and not as tidiness: `cli/commands/index.ts` is a column of bare side-effect
 * imports, one per command module, so reaching that entry point registers the
 * entire mutating command surface as an import side effect. A read surface
 * that wants to know what `mycontext search` takes may not go there. With the
 * specs module-private inside the commands, there was nothing to import even
 * where the graph allowed it, so a second surface that wanted them had to
 * write them down again — and a list written down twice will disagree
 * eventually. `core/procedure-stage.ts` is the same move at smaller scale, for
 * the same reason, on the same day.
 *
 * ── WHAT THIS MODULE IS NOT, YET ───────────────────────────────────────────
 *
 * It is a MOVE. `FlagSpec` is the shape the codebase already had — the exact
 * `{ allowed, values }` record that `PACK_FLAGS` (cli/commands/pack.ts),
 * `PROCEDURE_FLAGS`, `REVIEW_FLAGS` and `SESSION_FLAGS` are written in — and
 * nothing here declares a legal value, a placeholder or an example.
 * `REQ-every-command-the-ui-offers-is-built-checked-before-it-can` asks for
 * exactly that next ("a flag that declares its legal values drives the select;
 * a flag that declares a format hint and an example drives the placeholder and
 * the help; and both drive the check"). Inventing it in the same commit as the
 * move would have made the diff stop reading as a move, which is the one thing
 * a lift of this size cannot afford.
 *
 * ── WHAT IS HERE, AND WHAT IS DELIBERATELY NOT ─────────────────────────────
 *
 * MEASURED 2026-08-24 and corrected 2026-08-30, over the **39** commands the
 * CLI dispatches: 32 registered by `cli/commands/index.ts`'s column of
 * side-effect imports, and 7 more registered in `cli/index.ts` itself.
 *
 *   | 30 | have a SEPARABLE flag spec — a declarative list, liftable as it is |
 *   |  5 | read their flags INLINE where they are used, with no spec to lift  |
 *   |  1 | resists: `edit`, whose accepted set is computed per workspace      |
 *   |  3 | take no flags at all — `show`, `rebuild`, `help`                   |
 *
 * **This paragraph said 38, and 38 was neither number.** `COMMANDS` holds 32
 * when only `cli/commands/index.ts` has been imported and 39 once `cli/index.ts`
 * has, because seven commands — `init`, `add`, `list`, `show`, `examples`,
 * `help`, `rebuild` — are registered in the entry module rather than in a
 * module of their own; both READMEs say 39 and were right while this said 38.
 * A count in a comment is exactly the hand-kept number this repository keeps
 * finding stale, so it is no longer only a comment: `test/cli/command-flags.test.ts`
 * derives every figure above from the registry and from this map and fails if
 * the paragraph drifts, and it derives the INVENTORY below the same way — the
 * commands named as absent, plus the keys of `COMMAND_FLAGS`, must be exactly
 * the registered set, so a command cannot arrive and be silently uncounted.
 *
 * **21** of the 30 are here, and they are the ones whose spec was already a
 * declarative constant over a FLAT surface — one command, one flag set. What
 * is not here is recorded rather than left to be discovered:
 *
 *   - **`pack`, `procedure`, `review`, `session`, `statusline`** keep their
 *     specs, because those are keyed by SUBCOMMAND (`review promote`, `pack
 *     import`). Lifting them means deciding the key space of this map — a
 *     command STRING rather than a command NAME — and that is the decision the
 *     requirement above will make once, for the selects and the placeholders
 *     as well as the check. Their records are already this exact shape, so the
 *     move is mechanical the day that key is chosen.
 *   - **`add`, `list`, `examples`, `init`** live in `src/cli/index.ts` — the
 *     banned module itself, and therefore the specs that most need to be out
 *     of it. They are separable (`ADD_FLAGS`/`ADD_VALUE_FLAGS` are already
 *     constants); `init`'s is entangled with the hint table it prints.
 *   - **`edit`** cannot be a static entry at all: its accepted set is
 *     `[...ALLOWED, ...declaredFlags(ws.config)]`, computed per workspace from
 *     the flags this project's categories declare. A read surface can only
 *     have `edit`'s spec by being told which workspace it is asking about.
 *   - **`ingest`, `ingest-apply`, `lesson-stage`, `lesson-accept`,
 *     `lesson-discard`** have no spec to lift: they read flags inline where
 *     they are used and refuse no unknown flag at all. `palette-lib.test.ts`'s
 *     `NO_FLAG_PROBE` already records two of them as unreachable for exactly
 *     this reason. Writing a spec for them would be writing one, not moving it.
 *   - **`show`, `rebuild`, `help`** take no flags. The absence is the fact.
 */

/**
 * One command's flag surface.
 *
 * `allowed` is every flag NAME the command accepts, `--` stripped, and
 * `values` are the ones that consume the next token. `values` must be a subset
 * of `allowed`: `unknownFlag` and `positionals` walk argv with the identical
 * value-flag skip, and whatever one swallows as a value the other must not
 * then read as a flag name.
 *
 * Mutable `string[]` rather than `readonly`, because that is what
 * `refuseUnknownFlag` and `positionals` take and narrowing them would have
 * turned a move into a signature change across every command.
 */
export interface FlagSpec {
  allowed: string[];
  values: string[];
}

/**
 * The flag names every reporting command accepts, spelled once beside
 * `DETAIL_USAGE` so a command whose usage line advertises the detail levels
 * cannot forget to accept them (or accept ones it does not advertise).
 *
 * Moved here from `cli/commands/format.ts`, which re-exports it so that its
 * nine importers are unmoved: nine of the specs below are written in terms of
 * it, and a `core/` module reaching back into `cli/` for a list of four
 * strings would put the dependency the wrong way round.
 */
export const DETAIL_FLAGS = ['full', 'short', 'summary', 'json'];

/**
 * The lifted specs, keyed by the command name the registry knows.
 *
 * Every derivation is preserved rather than flattened. `[...DETAIL_FLAGS,
 * 'quiet']` stays a spread: writing out `['full', 'short', 'summary', 'json',
 * 'quiet']` here would be a second spelling of the detail levels, created by
 * the very commit that exists to remove one.
 */
export const COMMAND_FLAGS: Record<string, FlagSpec> = {
  /**
   * The nine value flags are the query surface; `items`/`sessions`/`files`
   * choose which projection is reported.
   */
  audit: {
    allowed: [
      ...DETAIL_FLAGS,
      'since', 'until', 'item', 'session', 'kind', 'op', 'origin', 'limit', 'role',
      'items', 'sessions', 'files',
    ],
    values: ['since', 'until', 'item', 'session', 'kind', 'op', 'origin', 'limit', 'role'],
  },
  decay: { allowed: [...DETAIL_FLAGS, 'sessions', 'all'], values: ['sessions'] },
  doctor: { allowed: [...DETAIL_FLAGS, 'quiet'], values: [] },
  export: {
    allowed: [
      'out', 'format', 'pack-name', 'pack-version', 'type', 'status', 'tag',
      'as-pack', 'no-history', 'dry-run', 'json',
    ],
    values: ['out', 'format', 'pack-name', 'pack-version', 'type', 'status', 'tag'],
  },
  focus: {
    allowed: ['tag', 'category', 'scope', 'clear', 'show', 'preview', 'relations', 'json'],
    values: ['tag', 'category', 'scope'],
  },
  'inbox-promote': { allowed: ['to', 'title', 'yes'], values: ['to', 'title'] },
  'ingest-status': { allowed: DETAIL_FLAGS, values: [] },
  /**
   * `--agent` is the only flag `lesson` takes. `lesson-accept` refuses it BY
   * NAME with a sentence of its own and is not lifted — see the header.
   */
  lesson: { allowed: ['agent'], values: [] },
  /**
   * `query` hand-rolls its refusal rather than calling `refuseUnknownFlag`,
   * because it names the detail levels it does NOT take. The spec it refuses
   * against is this one.
   */
  query: { allowed: ['json', 'limit'], values: ['limit'] },
  /**
   * `--plan` narrows to one plan; `--held` adds the rows the report would
   * otherwise only COUNT. There is no `--all`: "ready" is a derived answer
   * about open work, and a flag that widened it to finished work would be
   * asking a different question under the same name.
   */
  ready: { allowed: ['plan', 'limit', 'held', ...DETAIL_FLAGS], values: ['plan', 'limit'] },
  refresh: { allowed: ['yes'], values: [] },
  /** `repair` also hand-rolls its refusal; same spec, same reading. */
  repair: { allowed: ['yes'], values: [] },
  search: {
    allowed: ['text', 'type', 'tag', 'path', 'status', 'relation', 'limit', ...DETAIL_FLAGS],
    values: ['text', 'type', 'tag', 'path', 'status', 'relation', 'limit'],
  },
  status: { allowed: DETAIL_FLAGS, values: [] },
  supersede: { allowed: ['by', 'reason', 'yes'], values: ['by', 'reason'] },
  todo: { allowed: ['tag', 'limit', 'all', ...DETAIL_FLAGS], values: ['tag', 'limit'] },
  // `nonce` is a bare flag (owner ruling 2026-08-28): it takes no value and is
  // mutually exclusive with the other three, which `cmdUi` refuses rather
  // than silently ignores — see `src/cli/commands/ui.ts`.
  ui: { allowed: ['port', 'no-open', 'idle-ms', 'nonce'], values: ['port', 'idle-ms'] },

  /**
   * The four NAMED EDITORS — `pin`, `unpin`, `harden`, `soften`. Each is
   * `mycontext edit <id> --<field>=<value>` under a name, so the only flag a
   * caller may pass is the confirmation; the field is the command.
   *
   * Four entries rather than one shared object: they are four commands as far
   * as the registry, the approval boundary and any builder over this map are
   * concerned, and a single shared array would make "which commands take
   * `--yes`" unanswerable by reading this map.
   */
  pin: { allowed: ['yes'], values: [] },
  unpin: { allowed: ['yes'], values: [] },
  harden: { allowed: ['yes'], values: [] },
  soften: { allowed: ['yes'], values: [] },
};
