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
 * ── THE TWO HALVES OF THIS MODULE, AND WHY THEY ARE SEPARATE ───────────────
 *
 * `COMMAND_FLAGS` is a MOVE. `FlagSpec` is the shape the codebase already had
 * — the exact `{ allowed, values }` record that `PACK_FLAGS`
 * (cli/commands/pack.ts), `PROCEDURE_FLAGS`, `REVIEW_FLAGS` and
 * `SESSION_FLAGS` are written in — and it answers one question: would the
 * parser accept this token.
 *
 * `FLAG_DECLARATIONS`, at the bottom of the file, answers the other one:
 * what does the flag MEAN, and what may be put in it.
 * `REQ-every-command-the-ui-offers-is-built-checked-before-it-can` asks for
 * exactly that ("a flag that declares its legal values drives the select; a
 * flag that declares a format hint and an example drives the placeholder and
 * the help; and both drive the check"), and `plan:builder seq:2` built it.
 *
 * They stayed two tables rather than becoming one richer record, and the
 * reason is the reason they arrived in different commits: `allowed` and
 * `values` are what `refuseUnknownFlag` and `positionals` are HANDED, argument
 * for argument, by thirty commands. Folding a description into the object
 * those two walk would have turned a lift into a signature change across every
 * command in the CLI, and the description would then be load-bearing on the
 * parser — so a wrong note could break a refusal. Two tables, one key space,
 * and a test that requires them to cover exactly the same flags.
 *
 * ── WHAT IS HERE, AND WHAT IS DELIBERATELY NOT ─────────────────────────────
 *
 * MEASURED 2026-08-24 and corrected 2026-08-30, over the **40** commands the
 * CLI dispatches: 33 registered by `cli/commands/index.ts`'s column of
 * side-effect imports, and 7 more registered in `cli/index.ts` itself.
 *
 *   | 36 | have a SEPARABLE flag spec — a declarative list, liftable as it is |
 *   |  0 | read their flags INLINE where they are used, with no spec to lift  |
 *   |  1 | resists: `edit`, whose accepted set is computed per workspace      |
 *   |  3 | take no flags at all — `show`, `rebuild`, `help`                   |
 *
 * **The second row is kept at zero rather than deleted, and the zero is the
 * news.** It read 5 until `plan:builder seq:1c`, and those five had no spec
 * because they refused no unknown flag: a command with nothing to disagree
 * with cannot be checked, so nothing could tell a builder that the command it
 * had composed was wrong. They were given parsers rather than an exception,
 * and the row stays so that the partition still covers all 40 — and so that a
 * sixth command written the same way lands in a row that has a name.
 *
 * **This paragraph said 38, and 38 was neither number.** `COMMANDS` holds 32
 * when only `cli/commands/index.ts` has been imported and 39 once `cli/index.ts`
 * has, because seven commands are registered in the entry module rather than in
 * a module of their own — `show`, `help` and `rebuild`, which take no flags,
 * and the four whose specs the map below now holds; both READMEs say 39 and
 * were right while this said 38.
 * A count in a comment is exactly the hand-kept number this repository keeps
 * finding stale, so it is no longer only a comment: `test/cli/command-flags.test.ts`
 * derives every figure above from the registry and from this map and fails if
 * the paragraph drifts, and it derives the INVENTORY below the same way — the
 * commands named as absent, plus the keys of `COMMAND_FLAGS`, must be exactly
 * the registered set, so a command cannot arrive and be silently uncounted.
 *
 * **31** of the 36 are here. Twenty-one arrived with the first lift, and they
 * are the ones whose spec was already a declarative constant over a FLAT
 * surface — one command, one flag set. The other four arrived with
 * `plan:builder seq:1b` and came out of `src/cli/index.ts` itself — the entry
 * module `test/ui/no-writes.test.ts` bans from `src/ui/`, which made them the
 * only four specs a read surface could not reach AT ALL: not module-private in
 * a module the graph merely discourages, but inside the one module the graph
 * forbids. Two were already constants there and two had never been constants
 * anywhere, written inline at the refusal that used them.
 *
 * The last five arrived with `plan:builder seq:1c` and are the only entries
 * here that were WRITTEN rather than moved, because the commands they describe
 * had no spec to move and refused no unknown flag at all. That is a behaviour
 * change, it was measured against every invocation in this repository before it
 * was made, and the entries themselves carry the measurement.
 *
 * All nine are named in the map below and deliberately not here, because the
 * inventory test reads a backticked command name in this header as the claim
 * that its spec is ABSENT. What is absent is recorded rather than left to be
 * discovered:
 *
 *   - **`pack`, `procedure`, `review`, `session`, `statusline`** keep their
 *     specs, because those are keyed by SUBCOMMAND (`review promote`, `pack
 *     import`). Lifting them means deciding the key space of this map — a
 *     command STRING rather than a command NAME — and that is the decision the
 *     requirement above will make once, for the selects and the placeholders
 *     as well as the check. Their records are already this exact shape, so the
 *     move is mechanical the day that key is chosen.
 *   - **`edit`** cannot be a static entry at all: its accepted set is
 *     `[...ALLOWED, ...declaredFlags(ws.config)]`, computed per workspace from
 *     the flags this project's categories declare. A read surface can only
 *     have `edit`'s spec by being told which workspace it is asking about.
 *   - **`show`, `rebuild`, `help`** take no flags. The absence is the fact.
 */

import { AUDIT_KINDS, AUDIT_OPS } from './audit.ts';
import { ORIGINS, SEVERITIES, STATUSES } from './validate.ts';
import { RELATION_TYPES } from './vocabulary.ts';
import type { ArtefactFormat } from '../pack/reader.ts';

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
 * `add`'s value-taking flags, named because its `allowed` is DERIVED from
 * them: the command accepts every flag that takes a value, plus the
 * confirmation, and that is the sentence `ADD_FLAGS = [...ADD_VALUE_FLAGS,
 * 'yes']` said in `cli/index.ts`. Spelling these names a second time
 * inside `allowed` would be the duplicate this module exists to remove —
 * the same reason `[...DETAIL_FLAGS, 'quiet']` below is still a spread.
 *
 * `observation` and `valid-from` joined the list when `add` grew the ability to
 * re-create an item that already exists: an observation under a kind other than
 * `note`, and the day the item started holding. Both take a value; neither is
 * comma-split.
 *
 * `original-id` is the third of that group and the last field an item carries
 * that no write path could express: the id itself. It is on `add` and it is on
 * no other command, which is a rule and not an omission — see its declaration.
 */
const ADD_VALUE_FLAGS = [
  'body', 'file', 'note', 'observation', 'step', 'summary', 'scope', 'tags', 'severity',
  'valid-from', 'original-id', 'extra',
];

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
   * Two bare switches and two positionals. `<id>` and `<code>` are operands
   * rather than flags because they are the whole of what the command is about
   * — the same shape `supersede <id>` and `show <id>` already have.
   *
   * **`--all --code <code> [--count <n>]` is the SECOND form**, added
   * 2026-09-03 under
   * `DEC-doctor-gets-a-bulk-settlement-overturning-the-no-bulk-ruling`. Three
   * flags rather than one, and each is a refusal:
   *
   *  - `--all` is bare and means nothing on its own; it needs `--code`, for
   *    `review promote`'s reason — the licence a bulk act can be given is for
   *    a NAMED, BOUNDED set, never for "everything acknowledgeable here".
   *  - `--code` NAMES that set, and it is a flag rather than the existing
   *    `<code>` positional because the two forms take different operands: the
   *    single form's first positional is an item id, and a bulk form that read
   *    its code out of that slot would be one typo away from being read as an
   *    id it does not have.
   *  - `--count` is the CONSENT, and there is deliberately no `--yes` — see
   *    `cli/commands/ack.ts`, which argues why at length.
   */
  ack: { allowed: ['clear', 'list', 'all', 'code', 'count'], values: ['code', 'count'] },
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
  /**
   * **`--yes` is here, and it is accepted by the COMMAND while being answered
   * by only two of its five forms** — owner ruling 2026-09-04, *"writes take
   * the boundary, the read does not"*, under
   * `DEC-the-focus-dialog-earns-execute-by-putting-focus-on-the`.
   *
   * This table answers exactly one question — would the parser accept this
   * token — and it is FLAT per command because `refuseUnknownFlag` and
   * `positionals` are handed `{ allowed, values }` argument for argument by
   * thirty commands. There is no shape here that could say "on `--clear` and
   * on setting axes, but not on `--show`", and inventing one would make the
   * accept-list conditional on the rest of argv for one command's sake.
   *
   * So the acceptance is stated here and the SPLIT is stated where every other
   * conditional flag in this CLI states it: as a refusal in the command body.
   * `focus --clear` and `focus <axes>` go through `confirmAction`; `--show`,
   * `--preview` and `--relations` refuse `--yes` BY NAME rather than ignoring
   * it. That is the same shape `ack` already has one entry above — `--code`
   * "means nothing without --all and is refused rather than ignored" — and it
   * is what keeps the owner's ruling executable instead of merely written
   * down: putting `--yes` on focus wholesale would ask "are you sure you want
   * to report something?", and a flag silently ignored on a read is that
   * question asked in a quieter voice.
   */
  focus: {
    allowed: ['tag', 'category', 'scope', 'clear', 'show', 'preview', 'relations', 'json', 'yes'],
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

  /**
   * ── THE FOUR OUT OF `src/cli/index.ts` (plan:builder seq:1b) ─────────────
   *
   * `add`, `list`, `examples` and `init` are registered in the entry module
   * rather than in a module of their own, and their specs were written there
   * too. That is the one placement a read surface cannot work around:
   * `test/ui/no-writes.test.ts` BANS `src/cli/index.ts` from `src/ui/`,
   * because `cli/commands/index.ts` is a column of bare side-effect imports
   * and reaching the entry point registers every mutating command. So these
   * four were not merely private — they were unreachable, and a builder that
   * wanted to compose `mycontext add` had no choice but to write the list
   * down again.
   *
   * A MOVE, like the rest of this map. `list` and `examples` had no constant
   * to move: their flag lists were argument expressions at the
   * `refuseUnknownFlag` call that used them, which is the same defect one
   * step earlier — a spec with no name is a spec nothing can import.
   */

  /**
   * `--yes` is the gate; everything else supplies a field.
   *
   * `allowed` is still DERIVED from `values`, plus the three BARE switches this
   * command takes. `summary-omitted` is deliberately outside `ADD_VALUE_FLAGS`
   * for `edit`'s `summary-unchanged` reason (edit-flags.ts): it consumes no
   * token, and a composed `--summary-omitted "<something>"` would be offering
   * to write the summary the flag exists to say nobody wrote.
   *
   * `always` is the third, and it is a switch on the SAME terms `edit` reads
   * it on — `boolFlag`, so `--always=false` is a value ON the token rather
   * than the token after it. Putting it in `values` would be the disagreement
   * `FlagSpec` warns about above: `positionals` would swallow the word after
   * `--always` as its value, so `mycontext add --always invariant "…"` would
   * lose its category and build a title out of the rest. It is a pin, not a
   * field with an argument.
   */
  add: {
    allowed: [...ADD_VALUE_FLAGS, 'always', 'summary-omitted', 'yes'],
    values: ADD_VALUE_FLAGS,
  },
  /**
   * The detail levels and nothing else — `list`'s category filter is a
   * POSITIONAL, so the one thing a reader might expect to find here is
   * absent for a reason rather than by omission.
   */
  list: { allowed: DETAIL_FLAGS, values: [] },
  /** `--short` picks the four-to-six-line form; the category is positional. */
  examples: { allowed: ['short'], values: [] },
  /**
   * `init`'s one flag, and `allowed` and `values` are the SAME list because
   * that is the fact: the only flag it takes consumes the next token.
   *
   * What did not move with it is `INIT_ARGUMENT_HINTS`, and that is the
   * distinction this entry is worth reading for. `init` does not call
   * `refuseUnknownFlag`: it refuses every argument it cannot act on —
   * unknown flags AND bare positionals — in one sentence of its own, then
   * prints a hint for three flag names it wants to answer rather than merely
   * decline (`--global`, `--yes`, `--overwrite-changed`). Those hints are
   * help TEXT about flags this command does NOT accept, so they are not part
   * of the accepted set and would be false in it. The spec is what the
   * command parses with; the hints are what it says. Only the first is here.
   */
  init: { allowed: ['pack'], values: ['pack'] },

  /**
   * ── THE FIVE THAT HAD NO SPEC AT ALL (plan:builder seq:1c) ───────────────
   *
   * These five are the one entry in this map that is NOT a move. `ingest`,
   * `ingest-apply`, `lesson-stage`, `lesson-accept` and `lesson-discard` read
   * their flags inline where each one is used — `flag(args, 'anchor')`,
   * `readPayload`'s `flag(args, 'file')`, `edits()`'s four — and refused no
   * unknown flag at all. There was nothing to lift, so the sets below were
   * WRITTEN, by reading every `flag`/`hasFlag`/`listFlag` call each command
   * reaches, and each command now refuses against the same record.
   *
   * **That is a behaviour change and it was measured before it was made.**
   * A command given a refusal it never had breaks any caller that was passing
   * something it ignored. Every invocation of the five in this repository —
   * both READMEs, `docs/`, `skills/`, `commands/`, the corpus under
   * `.my_context/`, the tests and the e2e specs — was enumerated first, and
   * the flags they carry are `--anchor`, `--stdin`, `--file`, `--title`,
   * `--scope`, `--severity` and `--directive`. All seven are accepted below;
   * nothing that was being passed is now refused.
   *
   * **Why it had to happen here rather than being written off.**
   * `REQ-every-command-the-ui-offers-is-built-checked-before-it-can` asks that
   * a composed command be refused until it passes the CLI's OWN parser. For
   * these five there was no parser to pass: a builder could compose
   * `mycontext lesson-accept <id> <key> --whatever` and nothing in this
   * product could say otherwise. The alternative was a named exception in the
   * requirement, and an unstated exception is the failure mode a stated one
   * exists to replace — so the parser was the cheaper of the two, given that
   * the accepted sets were already knowable by reading.
   */

  /** `--anchor` narrows the request to one heading of the document. */
  ingest: { allowed: ['anchor'], values: ['anchor'] },
  /**
   * `--stdin` is BARE and is the one flag here that nothing reads: with no
   * `--file`, `readPayload` reads fd 0 regardless. It is in `allowed`
   * because it is in the usage line, in both READMEs and in the request
   * `mycontext ingest` prints for the extractor to call back with — a flag a
   * command advertises and would then refuse is worse than one it ignores.
   */
  'ingest-apply': { allowed: ['anchor', 'file', 'stdin'], values: ['anchor', 'file'] },
  /** The same payload pair as `ingest-apply`, and `--stdin` is bare here too. */
  'lesson-stage': { allowed: ['file', 'stdin'], values: ['file'] },
  /**
   * `edits()`'s four overrides, every one of which takes a value.
   *
   * `--agent` is NOT here, and its refusal stays where it is rather than
   * being folded into this one. `cmdLessonAccept` refuses it by name with a
   * paragraph explaining that accepting a staged candidate IS the approval
   * gate and an agent spelling of a gate is the gate's absence. Reduced to
   * `unknown option "--agent"` that sentence is gone, and it is the sentence
   * that matters: this is the one command in the product whose flag refusal
   * is a security boundary rather than a typo check.
   */
  'lesson-accept': {
    allowed: ['title', 'scope', 'severity', 'directive'],
    values: ['title', 'scope', 'severity', 'directive'],
  },
  /**
   * Two positionals and no flags — the empty set is the fact, and stating it
   * here is what lets the command refuse rather than absorb.
   *
   * `cmdLessonDiscard` still passes `accept`'s value flags to `positionals`,
   * and that is not dead now that the refusal runs first: it keeps the two
   * sibling commands reading one argv the same way, which is the asymmetry
   * its own comment was written about.
   */
  'lesson-discard': { allowed: [], values: [] },
};

/**
 * ═══ WHAT A FLAG MEANS, AND WHAT MAY BE PUT IN IT (plan:builder seq:2) ═════
 *
 * Everything above answers "would the parser accept this token". Nothing above
 * answers the question the owner actually asked on 2026-08-24 — that a user
 * "does not know what is the correct format what is legal and what is not".
 * `--severity` and `--scope` are indistinguishable in `{ allowed, values }`:
 * both are names that take a value. One has two legal values and the other has
 * an infinite number in a particular shape, and that difference is the whole of
 * what a person needs.
 *
 * **The shape is `UpdatableName`'s, one level up.** `core/categories.ts`
 * already decided how to describe a value a person may set: a closed `values`
 * vocabulary, an ABSENT `values` meaning free text — a real answer rather than
 * a gap — and a `note` a person reads. This extends that idea to a flag rather
 * than inventing a second vocabulary language, and it adds the one thing a flag
 * needs that a field did not: free text is not FORMLESS. `--scope` takes
 * comma-separated globs, `--tags` a comma-separated list, `--body` prose,
 * `--limit` a positive whole number and `--item` an existing item id. Those are
 * five different kinds of free text and, until this table, nothing in the
 * product could tell them apart.
 *
 * ── ONE DECLARATION, FOUR CONSUMERS ───────────────────────────────────────
 *
 * A `values` vocabulary drives a SELECT and the refusal. A `format` and an
 * `example` drive the PLACEHOLDER and the help. The `note` is the sentence
 * beside the control. They are one record because the alternative is four
 * descriptions of one flag, and this repository has now paid four times over
 * for two descriptions of one thing.
 *
 * ── DERIVE, DO NOT COPY — WHICH IS WHY FOUR VOCABULARIES MOVED HERE ────────
 *
 * A `values` list that is a second spelling of what the parser enforces is the
 * defect this plan exists to end, so every closed vocabulary below is either
 * imported from the module that enforces it (`SEVERITIES`, `STATUSES`,
 * `AUDIT_KINDS`, `AUDIT_OPS`, `RELATION_TYPES`, `DETAIL_FLAGS`, `ORIGINS`) or
 * is declared here and imported BY the module that enforces it.
 *
 * Four had to move, because each was a closed vocabulary living beside the
 * operation that checks it — exactly the placement `core/vocabulary.ts`'s
 * header describes as the reason `RELATION_TYPES` moved three times before it
 * settled. `AUDIT_ROLES` was module-private in `cli/commands/audit.ts`,
 * `ARTEFACT_FORMATS` in `cli/commands/export.ts`, and `RULE_DIRECTIVES` was a
 * JSON-schema enum literal in `lesson/derive.ts`.
 *
 * The fourth did not come here at all, and that is the more useful half of the
 * story. `--origin`'s vocabulary is `Origin`'s, and `core/validate.ts` already
 * enforced it on every created item — while `cli/commands/audit.ts` kept a
 * SECOND copy of the same three words for the filter. Two spellings of one
 * union, one of them unreachable from any read surface, and a 2026-08-20 plan
 * document had already recorded the duplication as a fact ("enforced twice")
 * without anything failing over it. So `ORIGINS` was exported from the module
 * that had the older claim on it rather than moved into this one: a
 * declaration's job is to name where a vocabulary lives, not to collect them.
 *
 * `test/cli/command-flags.test.ts` holds the gate: a declared vocabulary must
 * be the SAME ARRAY as the constant the parser uses — identity, not contents —
 * or be named there with a reason. Equal contents is the state that drifts.
 *
 * ── WHAT IS NOT DECIDED HERE, AND IS NOT A GAP ────────────────────────────
 *
 * Some flags have a closed vocabulary this process cannot know: `--type`,
 * `--category` and `--to` take a category name, and which names are legal is
 * whatever THIS workspace enables. Those declare a `source` — the name of the
 * set a builder must ask the server for — alongside the format and example
 * every free-text flag carries. `edit` is the whole command in that position
 * and is why `plan:builder seq:2b` exists; `source` is the same answer at flag
 * granularity, and it is deliberately a NAME rather than a value, because a
 * static list of this project's categories would be exactly the hand-copied
 * vocabulary this table exists to remove.
 */

/** How an item can appear in an audit record — what `audit --role` selects. */
export const AUDIT_ROLES = ['subject', 'injected', 'spilled'];

/** What `export --format` writes: a directory tree, or one zip file. */
export const ARTEFACT_FORMATS: ArtefactFormat[] = ['dir', 'zip'];

/** Whether a rule prescribes or prohibits — `lesson-accept --directive`. */
export const RULE_DIRECTIVES = ['do', 'dont'];

/**
 * One flag, and everything a person, a select, a placeholder or a refusal
 * needs to know about it.
 *
 * `note` is required and the rest is absent when it does not apply, which is
 * `UpdatableName`'s asymmetry and it is deliberate for the same reason: an
 * absent `values` means free text, which is an answer, whereas an absent `note`
 * would mean the flag cannot be rendered, and rendering is half of what this
 * exists for.
 */
export interface FlagDeclaration {
  /**
   * The closed vocabulary, or absent for free text.
   *
   * Never written out where a constant exists: it is the array the parser
   * checks against, by identity.
   */
  values?: readonly string[];
  /**
   * What shape the free text takes, as a phrase completing "it takes …".
   * Required whenever the flag consumes a value and has no `values`.
   */
  format?: string;
  /** One legal value, as it would be typed. Required alongside `format`. */
  example?: string;
  /**
   * The set a builder must ASK for, when the vocabulary is real but
   * per-workspace. A name, never the values — see the header.
   */
  source?: 'categories' | 'items' | 'tags' | 'plans' | 'sessions';
  /** One line a person reads, beside the control or in the help. */
  note: string;
}

/** Every flag of one command, by name. */
export type FlagDeclarations = Readonly<Record<string, FlagDeclaration>>;

/**
 * The four detail levels, declared once. They are BARE — each is a switch, not
 * a value — so none carries a format, and that absence is the fact.
 */
const DETAIL: FlagDeclarations = {
  full: { note: 'Every field of every row, bodies included.' },
  short: { note: 'Four to six lines per row - the form both READMEs print.' },
  summary: { note: 'Counts only. No rows.' },
  json: { note: 'One JSON document instead of a table, for a program to read.' },
};

/** `--limit`, wherever it caps a report. */
const LIMIT: FlagDeclaration = {
  format: 'a positive whole number', example: '50',
  note: 'How many rows at most. Omit it to take the command\'s own default.',
};

/** `--yes`, on the commands whose gate it answers. */
/**
 * `--summary`, declared ONCE and read by both `add` and `edit`.
 *
 * The two commands take the same field under the same bar, and the note is
 * what a person reads before they write one — so a second wording of it here
 * and in `edit-flags.ts` would be two answers to "what is a summary for", on
 * the one field whose whole purpose is being read at a glance. `edit-flags.ts`
 * imports this rather than restating it, and adds only the sentence that is
 * true of `edit` alone: the empty value clears it.
 */
export const SUMMARY_FLAG: FlagDeclaration = {
  format: 'one plain sentence, at most 160 characters',
  example: 'A screen says it checked a session and found nothing, when it never checked at all.',
  note: 'What this item is and why it matters, in plain words for somebody who does NOT know '
    + 'this codebase - no ids, no file paths, no measurements, and never how it was found. '
    + 'The body keeps all the precision.',
};

const YES: FlagDeclaration = {
  note: 'Answer the confirmation without a prompt. This is the approval boundary: anything '
    + 'holding a shell can type it, so a command that takes it can change what governs this '
    + 'project with no human in the loop.',
};

/** An item id, wherever a flag takes one. */
const ITEM_ID: FlagDeclaration = {
  format: 'the id of an item that already exists', example: 'RULE-never-log-secrets',
  source: 'items',
  note: 'Ids are printed by `mycontext list`, `mycontext search` and every report.',
};

/** A category name: closed, but per-workspace — see the header. */
const CATEGORY: FlagDeclaration = {
  format: 'one category name this workspace has enabled', example: 'rule',
  source: 'categories',
  note: 'Which names are legal depends on the profile and on `categories` in config.json; '
    + '`mycontext help categories` prints the resolved set.',
};

/** A tag filter, wherever one is accepted. */
const TAG_FILTER = (what: string): FlagDeclaration => ({
  format: 'one tag, or several comma-separated', example: 'v2,ui',
  source: 'tags',
  note: `Only ${what} carrying one of these tags.`,
});

/** `--since`/`--until`, whose grammar is `parseWhen`'s and is worth stating. */
const WHEN = (edge: string): FlagDeclaration => ({
  format: 'an ISO-8601 instant, a date read as UTC midnight, or a span back from now',
  example: '7d',
  note: `${edge} of the window. "2026-08-16T09:00:00Z", "2026-08-16", "7d", "12h" and "30m" `
    + 'are all accepted; anything else is refused by name.',
});

/**
 * What each flag means and what may be put in it, keyed exactly as
 * `COMMAND_FLAGS` is.
 *
 * The test requires this to cover every flag of every command in that map and
 * nothing else, in BOTH directions — a declaration for a flag the command
 * refuses is as much a defect as a flag nobody described.
 */
export const FLAG_DECLARATIONS: Record<string, FlagDeclarations> = {
  ack: {
    clear: {
      note: 'Withdraw an acknowledgement instead of making one. It is the only spelling that '
        + 'accepts a code doctor is no longer reporting - an entry left behind by a retired '
        + 'check has to be removable.',
    },
    list: {
      note: 'Print every finding doctor reports on the item and whether each one is '
        + 'acknowledged, lapsed or open, and change nothing. The code operand is not needed.',
    },
    all: {
      note: 'Rule on every finding of ONE code, across the corpus, in one act. It needs '
        + '--code, and it takes no item id: the two name different acts and this command '
        + 'refuses to guess between them.',
    },
    code: {
      format: 'one doctor finding code, exactly as the report prints it',
      example: 'body_disagrees_with_meta',
      note: 'The class --all rules on. Findings of one code share one argument, so this is '
        + 'one thing read once rather than many things skipped. It means nothing without '
        + '--all and is refused rather than ignored.',
    },
    count: {
      format: 'the number of findings the run will settle, as the preview names it',
      example: '34',
      note: 'The consent for --all, and the only one: it cannot be typed without having read '
        + 'the preview that names it, and it is refused when the corpus has moved since. There '
        + 'is no --yes here.',
    },
  },
  audit: {
    ...DETAIL,
    since: WHEN('The earliest record shown, inclusive'),
    until: WHEN('The latest record shown, exclusive'),
    item: { ...ITEM_ID, note: 'Only records that name this item, in any role.' },
    session: {
      format: 'a session id as the sessions report prints it', example: 'sess-01J8Z',
      source: 'sessions',
      note: 'Only records written during that session; `mycontext audit --sessions` lists them.',
    },
    kind: {
      values: AUDIT_KINDS,
      note: 'The family of operation. A kind is a group of ops, not a second name for one.',
    },
    op: {
      values: AUDIT_OPS,
      note: 'One operation exactly. Every op belongs to exactly one kind.',
    },
    origin: { values: ORIGINS, note: 'Who or what performed it.' },
    role: {
      values: AUDIT_ROLES,
      note: 'How the item appears in the record: the subject of the mutation, injected into a '
        + 'session, or spilled from one for budget.',
    },
    limit: LIMIT,
    items: { note: 'Report by ITEM rather than by record - what was touched, and how often.' },
    sessions: { note: 'Report by SESSION rather than by record.' },
    files: { note: 'Report by FILE rather than by record.' },
  },
  decay: {
    ...DETAIL,
    sessions: {
      format: 'a positive whole number of sessions', example: '10',
      note: 'How far back "lately" reaches: an item not injected within this many sessions is '
        + 'reported as decaying.',
    },
    all: { note: 'Include items never injected at all, not only the lapsed ones.' },
  },
  doctor: {
    ...DETAIL,
    quiet: {
      note: 'Print nothing when every check passes. The exit code still carries the answer.',
    },
  },
  export: {
    out: {
      format: 'a path outside the workspace, absolute or relative to the current directory',
      example: './corpus-export',
      note: 'Where the artefact is written. Required - there is no default, because a default '
        + 'would put somebody\'s corpus somewhere they never named.',
    },
    format: {
      values: ARTEFACT_FORMATS,
      note: 'A directory tree, or a single zip file. `dir` when omitted.',
    },
    'pack-name': {
      format: 'a slug', example: 'team-conventions',
      note: 'The name the pack introduces itself by where it is imported. With --as-pack only.',
    },
    'pack-version': {
      format: 'a version string', example: '1.0.0',
      note: 'What an importer records as the version it took. With --as-pack only.',
    },
    type: { ...CATEGORY, note: `Export only items of this category. ${CATEGORY.note}` },
    status: { values: STATUSES, note: 'Export only items in this lifecycle status.' },
    tag: TAG_FILTER('items'),
    'as-pack': { note: 'Write an importable PACK rather than a copy of the corpus.' },
    'no-history': { note: 'Leave the revision and audit history out of the artefact.' },
    'dry-run': { note: 'Report what would be written, and write nothing.' },
    json: DETAIL.json,
  },
  focus: {
    tag: {
      format: 'one tag, or several comma-separated', example: 'v2,ui',
      source: 'tags',
      note: 'Narrow injection to items carrying these tags.',
    },
    category: { ...CATEGORY, note: `Narrow injection to this category. ${CATEGORY.note}` },
    scope: {
      format: 'comma-separated path globs', example: 'src/**,docs/*.md',
      note: 'Narrow injection to items whose own scope overlaps these paths.',
    },
    clear: { note: 'Remove the focus entirely; injection goes back to the whole corpus.' },
    show: { note: 'Print the focus in force, and change nothing.' },
    preview: { note: 'Print what this focus WOULD inject, without setting it.' },
    relations: {
      note: 'Pull in items related to the matched ones, not only the ones that match.',
    },
    json: DETAIL.json,
    /**
     * **The one `--yes` that is NOT the shared `YES`, and the difference is
     * the owner's ruling rather than a wording preference.**
     *
     * `YES` says, of every other command that carries it, that the command
     * "can change what governs this project with no human in the loop". That
     * sentence is true of two of focus's five forms and false of the other
     * three, and this is the line a person reads beside the control — so the
     * shared note would be advertising a confirmation on `--show`, which is
     * exactly what the ruling forbids.
     *
     * A reader gets the split from here; the parser gets it from
     * `cli/commands/focus.ts`, which refuses the flag by name on the reads.
     */
    yes: {
      note: 'Answer the confirmation on the two forms that WRITE - `--clear`, and setting an '
        + 'axis. It is refused by name on `--show`, `--preview` and `--relations`, which change '
        + 'nothing and have no confirmation to answer. This is the approval boundary: anything '
        + 'holding a shell can type it, so the forms that take it narrow what every later '
        + 'session receives with no human in the loop.',
    },
  },
  'inbox-promote': {
    to: { ...CATEGORY, note: `The category the note or todo becomes an item in. ${CATEGORY.note}` },
    title: {
      format: 'one line of prose', example: 'Never log secrets',
      note: 'The promoted item\'s title. Omit it to keep the note\'s own first line.',
    },
    yes: YES,
  },
  'ingest-status': DETAIL,
  lesson: {
    agent: {
      note: 'Record the lesson as origin "agent" rather than "human" - the one claim a shell '
        + 'cannot truthfully make on its own. `lesson-accept` refuses it by name.',
    },
  },
  query: {
    json: DETAIL.json,
    limit: { ...LIMIT, note: 'How many rows at most. The hard cap is 1000 either way.' },
  },
  ready: {
    ...DETAIL,
    plan: {
      format: 'one plan name', example: 'builder',
      source: 'plans',
      note: 'Only tasks belonging to this plan.',
    },
    limit: LIMIT,
    held: {
      note: 'Also list the tasks a blocker is holding, which the report otherwise only counts.',
    },
  },
  refresh: { yes: YES },
  repair: { yes: YES },
  search: {
    ...DETAIL,
    text: {
      format: 'words to match in a title or body', example: 'migrations',
      note: 'Free text, and the same match the bare positional makes.',
    },
    type: { ...CATEGORY, note: `Only items of this category. ${CATEGORY.note}` },
    tag: TAG_FILTER('items'),
    path: {
      format: 'one repository path', example: 'src/core/store.ts',
      note: 'Only items whose scope globs match this path - what would activate if you edited it.',
    },
    status: { values: STATUSES, note: 'Only items in this lifecycle status.' },
    relation: {
      values: RELATION_TYPES,
      note: 'Only items on this side of a relation. These are the types that may be WRITTEN, and '
        + 'the vocabulary is closed deliberately: an open one produces derives_from, derivedFrom '
        + 'and derived-from in one corpus. As a READ filter it is a floor rather than the whole '
        + 'answer - search also accepts any type your corpus actually carries, superseded_by '
        + 'included, which only mycontext supersede can write.',
    },
    limit: LIMIT,
  },
  status: DETAIL,
  supersede: {
    by: {
      ...ITEM_ID,
      note: 'The replacement that takes over. REQUIRED - a retirement with no successor is not '
        + 'offered, because both directions are recorded.',
    },
    reason: {
      format: 'one or two sentences of prose', example: 'Replaced by the derived check.',
      note: 'Why the retirement happened. It is written as a supersession observation on the '
        + 'REPLACEMENT, reading "Replaces <old id>: <your text>".',
    },
    yes: YES,
  },
  todo: {
    ...DETAIL,
    tag: TAG_FILTER('todos'),
    limit: LIMIT,
    all: { note: 'Include the todos already promoted or dropped, not only the open ones.' },
  },
  ui: {
    port: {
      format: 'a TCP port number', example: '58888',
      note: 'Where to listen on 127.0.0.1. Omit it to take the first free port.',
    },
    'no-open': { note: 'Do not launch a browser; print the URL instead.' },
    'idle-ms': {
      format: 'a whole number of milliseconds', example: '28800000',
      note: 'How long the server may sit unused before it exits. The default is eight hours '
        + '(28800000) and the ceiling is a day; a working day, so a server started in the '
        + 'morning is still there in the afternoon.',
    },
    nonce: {
      note: 'Print a fresh one-shot credential for a server already running, and do nothing '
        + 'else. Mutually exclusive with the other three, which this command refuses rather '
        + 'than silently ignores.',
    },
  },
  pin: { yes: YES },
  unpin: { yes: YES },
  harden: { yes: YES },
  soften: { yes: YES },
  add: {
    body: {
      format: 'prose - the whole body of the item',
      example: 'Secrets in logs outlive the incident.',
      note: 'What the item says. Mutually exclusive with --file, which is refused rather than '
        + 'resolved by precedence.',
    },
    file: {
      format: 'a path inside this repository', example: 'docs/prd.md',
      note: 'The body is a SNAPSHOT of that file, and the item records where it came from, so '
        + '`mycontext doctor` reports it when the two diverge.',
    },
    note: {
      format: 'one sentence', example: 'Captured from the incident review.',
      note: 'Adds one "[note]" observation. Repeatable, in the order given, and NOT comma-split '
        + '- an observation is a sentence, and sentences contain commas.',
    },
    observation: {
      format: 'kind=text, one observation per flag',
      example: 'limit=Pool size must never exceed 20 across all workers',
      note: 'One observation under a kind of your choosing - what `--note` does for `[note]`, '
        + 'for `[limit]`, `[exception]`, `[invariant]` or any other. The kind is written as '
        + '"[kind]" in the Markdown and must be lowercase letters, digits, underscore or hyphen; '
        + 'anything else is refused, because the parser that reads the item back would drop the '
        + 'whole line. The text is taken whole after the first "=", commas and further "=" '
        + 'included. Repeatable, and it keeps command-line order with --note.',
    },
    step: {
      format: 'one sentence, one step', example: 'Take the database out of the load balancer.',
      note: 'One step of a `procedure`. Repeatable, keeps command-line order, not comma-split, '
        + 'and no later command can edit or tick it.',
    },
    'valid-from': {
      format: 'a date, as YYYY-MM-DD', example: '2026-08-13',
      note: 'The day this item started holding. Today when omitted, which is right for something '
        + 'captured now and wrong for an item copied in from somewhere it already existed. A '
        + 'date that does not exist is refused rather than rounded.',
    },
    // `--original-id`, and NOT `source: "items"`: every other flag that takes
    // an id names one that already exists here, and this one names the exact
    // opposite - an id that must NOT. A picker built from `items` would offer
    // a list on which every choice is refused.
    'original-id': {
      format: 'the id this item already carries in the corpus it is coming from',
      example: 'STD-error-message-conventions',
      note: 'Carry an existing item\'s id across instead of deriving a new one from its title. '
        + 'This is for MIGRATION and nothing else: an id derived from a title cannot be the id '
        + 'an item already has, so every citation and relation pointing at the old one would '
        + 'break the moment it were re-created under a new name. It is on `add` alone - an id '
        + 'that could change after creation is the same breakage with an audit trail. The id '
        + 'must be one safe filename segment and must begin with the category\'s own prefix, '
        + 'and an id already taken here is refused rather than overwritten.',
    },
    scope: {
      format: 'comma-separated path globs', example: 'src/**,docs/*.md',
      note: 'The paths this item attaches to. Omitting it means the whole repository.',
    },
    tags: {
      format: 'a comma-separated list', example: 'v2,ui',
      source: 'tags',
      note: 'Free-form labels. They change nothing about injection until a focus is set.',
    },
    severity: {
      values: SEVERITIES,
      note: 'hard items are admitted to a budget before soft ones. Any other word is refused.',
    },
    // `--always` at CAPTURE time, spelled the way `edit` spells it. No
    // `values` list, unlike `edit`'s: this surface offers the pin and does not
    // offer the negative, because "not pinned" is what a capture already is
    // (`always: input.always ?? false`, mutate.ts). `--always=false` is still
    // ACCEPTED - refusing it would make the same word an error here and an
    // unpin there - and it is identical to leaving the flag out.
    always: {
      note: 'Pin this item at capture: inject it in full at every session start, whatever files '
        + 'are touched. The pinned tier is a shared, finite budget, so this is the most '
        + 'expensive thing a capture can ask for and it is permanent until something unpins it '
        + '- the confirmation names the budget before you approve it. It is refused on a '
        + 'rationale-tier category, where selection never admits the item and the field would '
        + 'be stored governing nothing. Omitting it captures the item unpinned; '
        + '`--always=false` says the same thing in words, and `mycontext pin <id>` is the '
        + 'second-act route for an item that already exists.',
    },
    // `SUMMARY_FLAG`'s format, example and shared note, plus the one sentence
    // that is true of a CAPTURE and not of an edit - the mirror of what
    // `edit-flags.ts` does with the clear. It is not in the shared
    // declaration because `--summary-omitted` exists only on this command,
    // and a hint on `edit` naming a flag `edit` refuses is worse than none.
    summary: {
      ...SUMMARY_FLAG,
      note: `${SUMMARY_FLAG.note} A capture must carry one, or say \`--summary-omitted\` in `
        + 'so many words: an item created without a summary can never afterwards be asked '
        + 'for one, because every check that would ask compares a summary against the text '
        + 'it was written against and an absent one has neither.',
    },
    'summary-omitted': {
      note: 'Say that this item is being captured with NO summary, and that it is deliberate. '
        + 'A capture without one is otherwise refused, because an item born with no summary can '
        + 'never afterwards be required to have one - `mycontext doctor` reports it as '
        + '`summary_absent` and nothing else will ever ask. This is the named way to mean it: it '
        + 'is never a default, it is refused beside `--summary`, and the audit row records '
        + '`summary-omitted` so that nobody wrote one is visible rather than assumed.',
    },
    extra: {
      format: 'key=value, one key per flag', example: 'directive=do',
      note: 'One category-specific field - a rule\'s directive, a requirement\'s kind. '
        + 'Repeatable, and the value is taken whole, commas included.',
    },
    yes: YES,
  },
  list: DETAIL,
  examples: {
    short: {
      note: 'The example item alone, four to six lines, without the updatable surface.',
    },
  },
  init: {
    pack: {
      format: 'a path to a directory or .zip that already exists', example: './team-pack.zip',
      note: 'Found the workspace from an artefact somebody else exported. Everything it brings '
        + 'in lands `draft` and governs nothing until a person promotes it.',
    },
  },
  ingest: {
    anchor: {
      format: 'a heading from the document', example: 'Authentication',
      note: 'Ask for one section rather than the whole document. Omit it to take the next '
        + 'pending anchor.',
    },
  },
  'ingest-apply': {
    anchor: {
      format: 'the anchor the candidates were extracted for', example: 'Authentication',
      note: 'REQUIRED: it names which part of the session these candidates answer.',
    },
    file: {
      format: 'a path to a JSON file of candidates', example: './candidates.json',
      note: 'Where the extracted candidates are read from.',
    },
    stdin: {
      note: 'Read the candidates from standard input. Required explicitly, so that a command '
        + 'with neither flag fails with usage instead of blocking forever on a terminal.',
    },
  },
  'lesson-stage': {
    file: {
      format: 'a path to a JSON file of rule candidates', example: './candidates.json',
      note: 'Where the derived candidates are read from.',
    },
    stdin: { note: 'Read the candidates from standard input rather than from a file.' },
  },
  'lesson-accept': {
    title: {
      format: 'one line of prose', example: 'Run migrations outside peak hours',
      note: 'Replace the staged candidate\'s title with your own wording before the rule exists.',
    },
    scope: {
      format: 'comma-separated path globs', example: 'migrations/**,ops/**',
      note: 'The paths the created rule attaches to. It may be repeated, and every occurrence is '
        + 'unioned rather than the first one winning.',
    },
    severity: {
      values: SEVERITIES,
      note: 'The created rule\'s severity. Passed through as typed and re-validated against the '
        + 'merged candidate, so a value outside this list is refused rather than dropped.',
    },
    directive: {
      values: RULE_DIRECTIVES,
      note: '"do" prescribes; "dont" prohibits. It is the field that decides which, so a '
        + 'silently dropped value would invert the rule.',
    },
  },
  'lesson-discard': {},
};
