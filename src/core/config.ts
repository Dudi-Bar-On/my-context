// The only built-in this module needs, and it is needed for exactly one thing:
// `requireHandover` asks BOTH `path.win32` and `path.posix` whether a
// configured handover path is absolute. Bare `path.isAbsolute` answers for the
// host OS alone, and a `config.json` does not stay on one host — it is written
// on one machine, read on another, and travels inside packs — so the host's
// answer would accept `/etc/passwd` when read on Windows and `C:\...` when
// read on Linux. Asking both makes the refusal the same everywhere.
import path from 'node:path';
import {
  CATEGORIES, PROFILES,
  type CategoryUpdates, type ProfileName, type UpdatableName, type UpdateStore,
} from './categories.ts';
import { enumError } from './teach.ts';
import type { AgentEdits, ScopePolicy, Tier } from './types.ts';
// One direction only: `validate.ts` imports item.ts/teach.ts/vocabulary.ts and
// never this module, so this edge closes no cycle. It is here so the key
// grammar a config-declared extra field must satisfy is the SAME function the
// write path enforces — see `requireExtraFields`.
import { validateExtra } from './validate.ts';

export interface Budgets {
  pinned: number;
  jit: number;
  restored: number;
  index: number;
}

/**
 * What a session is allowed to be given, per tier, in `estimateTokens` units
 * (`select.ts`: characters ÷ 4, an approximation with error in both
 * directions and not a bound). 6,000 of these units is about 24,000
 * characters — roughly 3,700 English words, or a 370-line document.
 *
 * These were `{ pinned: 1500, jit: 500, restored: 2000, index: 150 }`, and
 * every one of them was too small to deliver the corpus it was budgeting.
 * Measured on this repository's own 42-item corpus before the raise:
 *
 * - `jit: 500` admitted **3 of the 9** items that match `README.md` (1,761
 *   needed) and **3 of the 14** that match `src/cli/**` (4,111 needed). The
 *   documentation standard written to stop this project overselling itself —
 *   `STD-guarantee-claims-carry-their-condition-in-the-same-sentence`, `hard`,
 *   scoped to the two READMEs — cost 357 and spilled every time, so it reached
 *   a model as a name in the omission note and never as a body.
 * - `index: 150` named **6 of the 19** governing items a session index is for
 *   (511 needed). Two thirds of what governs the project arrived as "+13 more".
 * - `pinned: 1500` was the one that fit (7 items, 1,072) — and with no room
 *   for an eighth.
 *
 * The new figures clear each of those totals. `jit` was set to 4,000 on those
 * measurements and raised again to 6,000 in the same change, because
 * annotating two scheduled requirements with their decisions grew the
 * `src/cli/**` selection to 4,478 — which is exactly the growth a budget is
 * supposed to absorb, arriving the same afternoon. `test/core/config.test.ts`
 * asserts each value against the total it has to clear, so the next such
 * growth fails there rather than turning into an omission note nobody reads.
 *
 * **This is not free, and `decay` is the reason it is not.** Every token here
 * is a token of the session's context window spent before the user's first
 * message, and the tiers compose: a SessionStart pays `pinned` + `index`
 * (up to 7,200) and each distinct file-triggered selection pays up to `jit`
 * on top — once per item per session, since the ledger dedupes. Against a
 * 200,000-token window that opening cost is ~3.6%. The lever for a corpus
 * that outgrows it is not a smaller budget, which spills silently into an
 * omission note; it is `mycontext decay`, which reports what has not been
 * injected and is the supported route to retiring it.
 */
export const DEFAULT_BUDGETS: Budgets = { pinned: 6000, jit: 6000, restored: 8000, index: 1200 };

/**
 * The extra sentence a retired profile name earns — the same `ARGUMENT_HINTS`
 * shape (mcp/tools.ts) and `CATEGORY_KEY_HINTS` shape below, and the same
 * reason: the difference between "no" and "here is what to write instead".
 *
 * `full` is the only entry, and it is here because it is the one refusal a
 * working project can walk into without changing anything: a `config.json`
 * written before the catalogue swap says `"profile": "full"`, and the honest
 * answer is not "unknown" but "that name was removed, and here is why it does
 * not cost you a category".
 */
const PROFILE_HINTS: Record<string, string> = {
  full:
    'The "full" profile was removed. It meant "every category in the catalogue" as against ' +
    '"standard" = "every category enabled by default", and the only difference between the ' +
    'two was policy, postmortem and taxonomy — which no longer exist. Use "standard": it ' +
    'enables the same categories "full" did on the day it was removed. To enable a category ' +
    'that ships switched off, set categories.<name>.enabled to true rather than naming a ' +
    'profile.',
};

export const DEFAULT_WATCHED_DOCS = [
  'docs/superpowers/specs/**',
  'docs/superpowers/plans/**',
  'docs/prd/**',
];

export interface ResolvedCategory {
  name: string;
  prefix: string;
  tier: Tier;
  enabled: boolean;
  description: string;
  extraFields: string[];
  agentEdits: AgentEdits;
  scopePolicy: ScopePolicy;
  /**
   * What may be updated on an item of this category, beyond what its TIER
   * already declares in `TIER_UPDATES` (core/categories.ts).
   *
   * Every resolved category has one; `{}` says "this category adds nothing of
   * its own", which is true of nineteen of the twenty-four shipped ones and is
   * a declaration rather than a gap.
   *
   * A CUSTOM category resolves to what its `config.json` entry declares, and
   * `{}` when it declares none — the owner's constraint, 2026-08-23: "custom
   * categories are created by humen and it should be written in a way a user
   * could edit and define it in the config". A BUILT-IN with an `updates`
   * override resolves to the catalogue's declaration EXTENDED by name; see
   * `requireUpdates` and the merge beside it in `resolveConfig` for why that
   * direction and not the other.
   */
  updates: CategoryUpdates;
}

/** Declaration order is the order the refusal lists them in — `enumError`
 * prints `allowed.join(', ')` verbatim — so it is user-facing, not incidental. */
export const AGENT_EDITS: AgentEdits[] = ['allow', 'review'];
export const SCOPE_POLICIES: ScopePolicy[] = ['global', 'required', 'inert'];
/**
 * The `store` vocabulary, in the same shape and here for the same reason: the
 * TYPE (`UpdateStore`) lives in categories.ts and erases to nothing at runtime,
 * exactly as `AgentEdits` lives in types.ts while `AGENT_EDITS` lives here —
 * the value list is what the LOADER checks a config against, and `requireEnum`
 * is the only thing that reads it.
 */
export const UPDATE_STORES: UpdateStore[] = ['field', 'tag'];

/**
 * The default splits by tier because that is where the difference is real:
 * spec §2 establishes that content on a normative item is what an agent is
 * *told to do*, while content on a rationale item is what it *knows*. An
 * agent rewriting a `rule` changes the instruction and should be reviewed;
 * an agent keeping a `lesson` current should not need a human in the loop.
 *
 * Callers must pass the **resolved** tier, not the catalogue's — a category
 * retiered in config takes the new tier's default.
 */
export function defaultAgentEdits(tier: Tier): AgentEdits {
  return tier === 'normative' ? 'review' : 'allow';
}

/**
 * `global` for every category: it is the semantics the product was corrected
 * to, and the only value that asks nothing of a user who has no restriction
 * to express. Not tier-dependent — an unscoped `lesson` and an unscoped
 * `rule` are equally "about the whole project" until someone says otherwise.
 */
export const DEFAULT_SCOPE_POLICY: ScopePolicy = 'global';

/**
 * The `scopePolicy` in force for an item of category `type` — the ONE lookup
 * every surface that interprets an empty scope goes through (`matchesScope`
 * in select.ts, the renderers in render-item.ts, the capture refusal in
 * mutate.ts, `decay`, `doctor`).
 *
 * `Object.hasOwn` guards the prototype-pollution hazard a bare index carries
 * on a type of `"constructor"` — the same guard `resolveCategory` and
 * `tierOf` (trust.ts) document. `resolveConfig` builds `categories` with a
 * null prototype, so this is belt-and-braces there, but this function is also
 * handed configs built by tests and by future callers.
 *
 * An item whose category is absent from config entirely (renamed or removed
 * after capture — `loadLayer` in rebuild.ts still indexes such items) resolves
 * to `DEFAULT_SCOPE_POLICY`. That is not a fail-open: such an item is not
 * `isEligible` for any full-text tier at all (select.ts), so the policy
 * decides nothing about its injection; what it does decide is how the field
 * RENDERS, and `(unrestricted)` — "this item declares no restriction" — is
 * the reading that stays true when nothing is known about the category.
 */
export function scopePolicyFor(config: Config, type: string): ScopePolicy {
  return Object.hasOwn(config.categories, type)
    ? config.categories[type].scopePolicy
    : DEFAULT_SCOPE_POLICY;
}

/**
 * The `agentEdits` policy in force for an item of category `type` — the ONE
 * lookup `updateItem` (mutate.ts) goes through, the sibling of
 * `scopePolicyFor` above, and `Object.hasOwn`-guarded for the same
 * prototype-pollution reason.
 *
 * Unlike `scopePolicyFor`, the missing-category branch does NOT resolve to a
 * fixed product default: it fails **closed** to `review`, the same direction
 * `tierOf` (trust.ts) fails closed to `normative`, and for the same reason. A
 * category renamed or removed after its items were captured leaves those items
 * indexed (`loadLayer`, rebuild.ts) with no policy of their own; reading that
 * as `allow` would hand an agent unreviewed edits to exactly the items whose
 * governing category just vanished from config. Expressed as
 * `defaultAgentEdits('normative')` rather than a literal so it cannot drift
 * from the tier default it means to borrow.
 */
export function agentEditsFor(config: Config, type: string): AgentEdits {
  return Object.hasOwn(config.categories, type)
    ? config.categories[type].agentEdits
    : defaultAgentEdits('normative');
}

/**
 * Whether `mycontext ui` is PERMITTED to run, and — since 2026-08-27 — WHERE a
 * hook may put it back up.
 *
 * **What this comment used to say, and why it no longer says it.** It read
 * "Resolving this key opens no port, spawns no process and changes no
 * behaviour anywhere in the product; the web server starts when a user types
 * the command and at no other moment." That was true and is now false in both
 * halves, so it is replaced rather than left standing beside a contradiction.
 * `enabled` had been validated here, refused when malformed, rendered on the
 * Configure screen and consulted by NOTHING that decides anything; the spec
 * that changed it cites this very sentence as the evidence
 * (`2026-08-27-the-ui-server-outlives-the-session-design.md` §2). Its first
 * enforcement site is `cmdUi` (`src/cli/commands/ui.ts`), which refuses to
 * serve when this says `false`, before it binds.
 *
 * Resolving the key still starts nothing by itself — a `Config` is a value,
 * and reading one has never had an effect. What changed is that two things now
 * READ it, and one of them spawns a process.
 *
 * An OBJECT rather than the bare boolean `"ui": false`, and the reason is the
 * shape of what comes next rather than what is here today. A boolean has one
 * bit and no room: the first UI setting that is not a yes/no — a port, a bind
 * address, a browser-open preference — would force the VALUE's type to change,
 * and a value-type change is a second contract break for every config file
 * already written. Under R14.2 a config from the future keeps working because
 * an unknown TOP-LEVEL key is skipped, but `"ui": false` read by a build that
 * expects an object is not an unknown key; it is a known key with an
 * unreadable value, and this loader refuses those (see `requireUi`). Choosing
 * the object now means the growth is additive and no already-written file is
 * ever wrong. It also matches the two other structured keys — `budgets` and
 * `categories` are objects, and for the same reason.
 *
 * **That growth arrived on 2026-08-27, and it was a port.** `port` below is the
 * "first UI setting that is not a yes/no" the paragraph above predicted, added
 * with no contract break and no already-written `config.json` made wrong —
 * which is the whole return on having chosen an object when one boolean was
 * all anybody needed.
 */
export interface UiConfig {
  enabled: boolean;

  /**
   * The port a HOOK may put this server back up on, and `null` — absent — means
   * the whole upkeep mechanism is OFF. Spec §6.
   *
   * ── WHY THE KEY EXISTS AT ALL ─────────────────────────────────────────
   *
   * **A hook cannot use port 0.** `mycontext ui`'s default port is 0, meaning
   * "ask the operating system for a free one", which is right for a person who
   * is about to be handed the URL and wrong for everything else: an ephemeral
   * port is a URL nobody can bookmark, and the point of the upkeep feature is a
   * server that is there when the owner LOOKS. So the mechanism needs a number
   * that is the same tomorrow, and there is none this product could pick.
   *
   * ── WHY ABSENT IS OFF, WHICH IS A SAFETY CALL AND NOT A DEFAULT ───────
   *
   * This runs the opposite way to `enabled` beside it, and the asymmetry is the
   * same one `handover` documents: `enabled` grants a permission and costs a
   * user nothing, while the only thing that reads THIS key spawns a background
   * server. A plugin that starts one on every machine it is installed on,
   * because somebody installed it, is not acceptable. Setting `ui.port` is how
   * a user turns the mechanism on, per workspace, as a positive act — and
   * `enabled: false` then turns it off again WITHOUT unsetting the port, which
   * is what a disable switch beside an address is for.
   *
   * `null` rather than a `DEFAULT_UI` without the field, because the two states
   * must be distinguishable by reading the resolved value: `?? 0` on a missing
   * field is the ephemeral port this key exists to replace, arrived at by
   * accident.
   *
   * ── WHAT IT DOES NOT DECIDE ───────────────────────────────────────────
   *
   * Not the port `mycontext ui` binds when a person runs it with `--port`. The
   * flag wins when given; this is the fallback, and it is what a hook — which
   * has no command line to read — uses instead.
   */
  port: number | null;
}

/**
 * ENABLED when the key is absent — opt out, not opt in. Expressed as a default
 * object rather than as `input.ui?.enabled ?? false` at the point of use,
 * because that spelling is the bug this key is most likely to produce:
 * `undefined` falling to `false` reads an ABSENT key as a user who asked for
 * the UI to be off. Those are different states. Absent means "nobody has
 * expressed an opinion, and the product's answer is yes"; `false` means "a
 * user wrote the key and said no". Only the second is a refusal, and only the
 * second is something a `mycontext ui` command may report back as the user's
 * own choice.
 *
 * `port` is the other direction in the same object, and deliberately so: `null`
 * is OFF, because the reader of that field spawns a process. The two live
 * together because they are two halves of one question — `enabled` says
 * whether, `port` says where — and neither is derivable from the other.
 */
export const DEFAULT_UI: UiConfig = { enabled: true, port: null };

/**
 * Which handover document this project keeps, and how much of it a session may
 * be handed after a compaction. Spec §3.1.
 *
 * **This key runs the opposite way to `ui` directly above it, and the
 * asymmetry is the whole point.** `ui` is opt-OUT because resolving it grants a
 * permission and touches nothing; resolving THIS one means the product starts
 * READING A FILE IN SOMEBODY'S REPOSITORY, and no default may take that
 * decision on a user's behalf. So there is no `DEFAULT_HANDOVER` object beside
 * `DEFAULT_UI`: absent is `null` on `Config`, and `null` means the entire
 * feature is off and silent. A plugin does not read a repository's contents
 * because it was installed.
 *
 * The two defaults below exist because `marker` and `budgetTokens` are
 * refinements of a decision the user already took by writing `path`. `path`
 * has no default for the same reason the key has none: there is no file this
 * product could pick.
 */
export interface HandoverConfig {
  /**
   * Repo-relative, and ONE file.
   *
   * Not a glob, and that is a decision rather than an omission: a glob that
   * matches two handovers has to pick one, and picking is the act that would
   * need a rule nobody has written. "Newest wins" makes a stale file win after
   * a `touch`; "first alphabetically" is arbitrary; "deliver both" is the
   * unbounded read this key exists to bound. Naming the file leaves the choice
   * with the person who knows which document it is.
   *
   * Absolute paths and `..` segments are refused: this names a document in
   * THIS project, and a config that can address anything on the machine turns
   * an installed plugin into a file reader pointed wherever a `config.json`
   * says — including one that arrived in a pack.
   */
  path: string;
  /**
   * The heading prefix that marks the section written FOR the next session, so
   * the delivered block can be that section rather than the head of a document
   * that may be a thousand lines of history.
   */
  marker: string;
  /**
   * How much of the document may be delivered, in `estimateTokens` units
   * (characters / 4) like every other budget in this file. What does not fit
   * is NAMED in the delivered block and never dropped in silence
   * (INV-nothing-is-dropped-silently).
   */
  budgetTokens: number;
  /**
   * How full the context window has to be before `Stop` asks the model to bring
   * the handover up to date — spec §4.3, and the ONE thing this project's
   * otherwise-empty `Stop` envelope is now permitted to say.
   *
   * A percentage rather than a token count, and it is not a preference: the
   * only figure anybody has is a percentage. `context_window_size` lives in
   * Claude Code's status-line payload and nowhere else this product can reach,
   * so a token budget here would have to be compared against a window size this
   * config cannot know, and a budget of "180000" means something different on
   * every model.
   *
   * **Fractional values are accepted deliberately.** The whole point of
   * `PreCompact` recording the occupancy it fired at (spec §4.4) is that the
   * number the platform actually compacts at is a MEASUREMENT, and a
   * measurement is not obliged to be a whole number. Refusing 92.5 would make
   * the config unable to express the very reading the log was built to produce.
   *
   * **Optional here, where `marker` and `budgetTokens` above are resolved
   * eagerly, and the asymmetry is deliberate.** Those two are refinements of
   * the block that gets DELIVERED, so a resolved config carrying them is a
   * complete description of what a session will receive. This one is a question
   * that is still open: §4.4 records the standing concern that 98 may be a
   * threshold Claude Code's own auto-compaction never lets anything reach, and
   * `PreCompact` is at this moment logging the number that will settle it.
   * Absent therefore means *the user has not chosen a threshold*, which is a
   * different fact from *the user chose 98*, and one a later reader of a config
   * — or of the corpus row that quotes it — will want back.
   *
   * The safety an eager default would otherwise buy is bought by the type
   * instead: `number | undefined` cannot be compared with `<` under
   * `strictNullChecks`, so a consumer that forgets the default does not
   * silently end up with a threshold every turn crosses — it does not compile.
   * `handoverThresholdPercent` below is the single place the default is applied.
   */
  thresholdPercent?: number;
}

/**
 * U+23ED BLACK RIGHT-POINTING DOUBLE TRIANGLE WITH VERTICAL BAR — the "skip to
 * next" glyph, which is what a handover section is.
 *
 * Written as an escape and NEVER as the literal character: `npm run
 * check:text-files` gates non-ASCII in source, and it has already caught one
 * file today. The escape is also the only spelling that survives a terminal,
 * a diff and a patch unchanged.
 *
 * It is a DEFAULT rather than a constant because the convention is this
 * project's own — `### <marker> DO THIS FIRST, AFTER THE COMPACTION` — and a
 * project that marks its handover differently should not have to rename its
 * headings to be read.
 */
export const DEFAULT_HANDOVER_MARKER = '\u23ED';

/**
 * Enough for a section that says what was being done, what was decided and
 * what comes first — and small enough that it cannot be a meaningful share of
 * the window it is delivered into. Delivering a handover whole into the
 * context it exists to protect would be the joke telling itself.
 */
export const DEFAULT_HANDOVER_BUDGET_TOKENS = 1200;

/**
 * 98, because the owner named 98 (requirement of 2026-08-27).
 *
 * **It ships with a standing concern attached, and the concern is not settled
 * by this constant.** Claude Code's own automatic compaction fires BELOW 98 on
 * current builds, in which case 98 is a threshold nothing ever reaches — the
 * compaction happens first and the handover is never asked for. The design's
 * answer (spec §4.4) is to measure rather than argue: every `pre-compact` row
 * now records the occupancy and the trigger it fired at, so after a handful of
 * automatic compactions the corpus holds the real number and this default can
 * be changed against evidence instead of against an opinion.
 *
 * Until then it is the number that was asked for, which is the right thing for
 * a default to be.
 */
export const DEFAULT_HANDOVER_THRESHOLD_PERCENT = 98;

/**
 * The threshold this handover is actually held to — the ONE place
 * `DEFAULT_HANDOVER_THRESHOLD_PERCENT` is applied.
 *
 * A function rather than a value on the resolved config, for the reason argued
 * on `HandoverConfig.thresholdPercent`: the config records what the user chose,
 * and an unchosen threshold stays unchosen there. This is the other half of
 * that split, and it exists so that "unchosen" has exactly one reading rather
 * than one per consumer — the failure `hookContext` names one surface over, *a
 * second copy is a second chance to be silently wrong*, and here the silently
 * wrong copy would be a `?? 0` that asks for a handover on the first turn of
 * every session.
 */
export function handoverThresholdPercent(handover: HandoverConfig): number {
  return handover.thresholdPercent ?? DEFAULT_HANDOVER_THRESHOLD_PERCENT;
}

export interface Config {
  profile: ProfileName;
  categories: Record<string, ResolvedCategory>;
  budgets: Budgets;
  watchedDocs: string[];
  ui: UiConfig;
  /**
   * `null` — the `handover` key absent — means the whole feature is OFF, and
   * that is the type rather than a comment for a reason: `HandoverConfig` with
   * an `enabled` boolean, or a `DEFAULT_HANDOVER` beside `DEFAULT_UI`, would
   * both give the "off" state a `path` field that some caller eventually
   * reads. There is nothing to read. Absent is absent (STD-absent-vs-zero),
   * and a consumer that wants to act has to narrow the `null` away first.
   */
  handover: HandoverConfig | null;
  /**
   * The top-level keys this build did not understand, in the order the file
   * wrote them — R14.2's half of INV-nothing-is-dropped-silently. Empty for
   * every config this build fully understands, which is nearly all of them.
   *
   * This is DATA and not a printed line because `resolveConfig` is a library
   * function with callers whose output disciplines contradict each other:
   * a hook's stdout IS the model's context and its stderr is surfaced to the
   * user, the MCP server's stdout is JSON-RPC framing that a stray byte
   * corrupts, and only the CLI has a channel where a sentence to a human
   * belongs. A module that cannot see its caller cannot pick that caller's
   * channel, and picking one would either spam a per-edit hook or corrupt a
   * protocol. So the skip is CARRIED, worded once by `skippedKeyNotice`, and
   * printed by the surface that has somewhere to print it.
   *
   * The consequence is a duty, not a convenience: a surface that shows config
   * to a human and does not print this notice has re-created the silent drop
   * this field exists to end.
   */
  skippedKeys: string[];
}

interface RawCategory {
  enabled?: boolean;
  tier?: Tier;
  description?: string;
  prefix?: string;
  agentEdits?: AgentEdits;
  scopePolicy?: ScopePolicy;
  extraFields?: string[];
  updates?: CategoryUpdates;
}

/**
 * Every key a category entry may carry — the ONE list, derived from nothing
 * because `RawCategory` is a compile-time type and erases to nothing at
 * runtime (`erasableSyntaxOnly`). Kept beside it so the two are read together.
 *
 * It exists because an entry key nobody reads used to be accepted and dropped
 * in silence, which is the one failure mode INV-nothing-is-dropped-silently
 * rules out.
 *
 * `extraFields` was the concrete case, and it is now a settable key. It used
 * to be refused BY NAME, and the reason the refusal gave was true when it was
 * written: the MCP `create_item` schema is the UNION of what every category
 * declares, and nothing validated an extra field against the item's OWN
 * category, so a field invented here would have been advertised to every agent
 * and accepted on every category. `unknownExtraFieldError` (trust.ts) closes
 * exactly that hole — `createItem`/`updateItem` now refuse a key the item's
 * category does not declare — so the reason is answered and the key is
 * accepted. The two halves shipped in ONE commit for that reason: validation
 * without this key would refuse every `task` item in the corpora the feature
 * was built for, since a custom category could declare nothing.
 *
 * `updates` is the eighth and the same argument one step further on. With
 * `extraFields` settable, a person could describe what their category's items
 * CARRY and had no way to describe how any of it is CHANGED — so a custom
 * category resolved to `{}` updates and taught nobody anything, which is the
 * sentence REQ-every-category-declares-what-may-be-updated-on-its-items-and
 * opens with. The owner's constraint, 2026-08-23: "custom categories are
 * created by humen and it should be written in a way a user could edit and
 * define it in the config". `task` is the measured case and is not a special
 * case: it is not named anywhere in `src/`, it is an entry in this repo's own
 * `.my_context/config.json` with a tier, a prefix, a description and seven
 * extra fields, exactly like any category a user defines.
 */
const CATEGORY_KEYS = [
  'enabled', 'tier', 'description', 'prefix', 'agentEdits', 'scopePolicy', 'extraFields',
  'updates',
];

/**
 * The extra sentence one refused key earns — the same `ARGUMENT_HINTS` shape
 * (mcp/tools.ts) and the same reason: the difference between "no" and "here".
 *
 * Deliberately EMPTY today: `extraFields` was its only entry and is now a key
 * this config understands. The mechanism stays because the next key that earns
 * a "here" needs it, and because the refusal below reads `CATEGORY_KEY_HINTS`
 * unconditionally — an empty map costs one lookup and no branch.
 */
const CATEGORY_KEY_HINTS: Record<string, string> = {};

function requireCategoryKeys(name: string, value: unknown): void {
  // A category entry that is not an object at all — `"rule": "off"`,
  // `"rule": true` — used to fall through this guard, resolve to an empty
  // override below, and change nothing while reporting nothing: the whole
  // entry accepted and dropped, which is the exact failure the key check
  // exists to stop, reached one level up.
  if (!isObject(value)) {
    throw new Error(
      `my_context: category "${name}" is ${JSON.stringify(value)}, not an object. ` +
      `A category entry is an object with any of: ${CATEGORY_KEYS.join(', ')} — e.g. ` +
      `{"enabled": false}. Nothing was loaded — a setting that cannot be acted on is ` +
      `refused rather than ignored.`,
    );
  }
  const unknown = Object.keys(value).filter((key) => !CATEGORY_KEYS.includes(key));
  if (unknown.length === 0) return;
  const hints = unknown
    .map((key) => CATEGORY_KEY_HINTS[key])
    .filter((hint): hint is string => hint !== undefined);
  throw new Error(
    `my_context: category "${name}" declares ${unknown.map((k) => JSON.stringify(k)).join(', ')}, ` +
    `which ${unknown.length === 1 ? 'is not a key' : 'are not keys'} this config understands. ` +
    `A category accepts: ${CATEGORY_KEYS.join(', ')}. Nothing was loaded — a setting that ` +
    `cannot be acted on is refused rather than ignored.` +
    (hints.length ? `\n${[...new Set(hints)].join('\n')}` : ''),
  );
}

/**
 * The id prefix a category mints ids under (`makeId`, slug.ts, which
 * upper-cases it), validated once for BOTH branches below.
 *
 * It was declared on `RawCategory`, honoured when defining a custom category,
 * and never read at all when overriding a built-in one: `"rule": {"prefix":
 * "POLICY"}` was accepted and every new rule still landed as `RULE-…`. That is
 * the same accepted-and-ignored shape as the rest of Phase 1C, reached through
 * a key the type already advertised.
 *
 * Alphanumerics only, and short. An id is `PREFIX-slug`, and a family variant
 * appends `-N` (`familyId`, mutate.ts) — a prefix carrying its own hyphen or a
 * path separator makes the id unreadable at best and unwritable at worst,
 * since the id is also the item's file name.
 */
function requirePrefix(name: string, value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9]{1,12}$/.test(value)) {
    throw new Error(
      `my_context: category "${name}" has invalid prefix ${JSON.stringify(value)}. ` +
      `Expected 1-12 letters or digits and nothing else — an id is "PREFIX-slug" and is also ` +
      `the item's file name, so a hyphen, a space or a path separator cannot appear in it.`,
    );
  }
  return value;
}

/**
 * The category-specific frontmatter fields a category declares — the list
 * `createItem`/`updateItem` check an item's `extra` against
 * (`unknownExtraFieldError`, trust.ts) and the list the MCP `create_item`
 * schema is the union of (`extraFieldNames` below).
 *
 * The key grammar is NOT restated here: `validateExtra` (validate.ts) already
 * owns what a frontmatter key may be — the `KEY_LINE` grammar, the reserved
 * frontmatter names, and `__proto__`, which cannot survive being written at
 * all — and this CALLS it rather than growing a second copy that can drift
 * from it. A field declared here but unwritable there would be a category
 * promising a field no item could ever carry, refused at capture by a rule the
 * config never mentioned. Each name is paired with a placeholder value so the
 * shared function can be reused as-is; only its key checks can fire, since a
 * non-empty single-line string passes its value checks by construction.
 *
 * The refusal is re-voiced rather than passed through, because
 * `validateExtra`'s wording is about an ITEM's extra field ("see
 * mycontext_help(\"capture\")") and this is a config file — a user told to
 * consult the capture help for a line in `config.json` has been sent to the
 * wrong place. The reused sentence still carries the actual rule.
 */
function requireExtraFields(name: string, value: unknown): string[] {
  if (!Array.isArray(value) || value.some((field) => typeof field !== 'string')) {
    throw new Error(
      `my_context: category "${name}" has invalid extraFields ${JSON.stringify(value)}. ` +
      `Expected an array of frontmatter field names, e.g. {"extraFields": ["plan", "seq"]} — ` +
      `use [] to declare none. Nothing was loaded — a setting that cannot be acted on is ` +
      `refused rather than ignored.`,
    );
  }
  const fields = value as string[];
  try {
    validateExtra(Object.fromEntries(fields.map((field) => [field, 'declared'])));
  } catch (err) {
    const because = (err instanceof Error ? err.message : String(err)).replace(/^my_context:\s*/, '');
    throw new Error(
      `my_context: category "${name}" declares an extraFields entry that cannot be a ` +
      `frontmatter key, so no ${name} could ever carry it: ${because} Nothing was loaded.`,
    );
  }
  return fields;
}

/**
 * Every key ONE update declaration may carry — the `CATEGORY_KEYS` shape a
 * level down, rendered verbatim in the refusal, and in the order a person
 * writes them. Only `store` is required.
 */
const UPDATE_KEYS = ['store', 'values', 'projectsTo', 'command', 'note'];

/** The shape, spelled ONCE so the two refusals that show it cannot drift into
 * two different examples of the same thing. */
const UPDATES_EXAMPLE =
  '{"updates": {"state": {"store": "field", "values": ["todo", "done"], ' +
  '"projectsTo": "state", "note": "Where this task is."}}}';

/**
 * The `updates` a category declares — what may be changed on one of its items,
 * beyond what its TIER already declares in `TIER_UPDATES` (categories.ts).
 *
 * ## The merge, stated here so a reader never has to find it out by experiment
 *
 * On a BUILT-IN category this **EXTENDS the catalogue's declaration BY NAME**,
 * and a name the config declares wins for that name, replacing the WHOLE entry.
 * On a CUSTOM category it is simply the declaration, because there is no
 * catalogue entry and "extend" and "replace" name the same operation there.
 *
 * Extend rather than replace, because `extraFields` extends and these are the
 * two halves of one description. `rule` declares the extra field `directive`,
 * and `extraFields` cannot remove it — it is part of what `rule` MEANS. Under a
 * replace reading of `updates`, a user adding one name of their own would leave
 * `directive` undroppable and its rules gone: a category still declaring a
 * field and no longer able to say one thing about changing it. Two halves of
 * one description following opposite rules is a category that can contradict
 * itself, which is why the asymmetry `watchedDocs` earns (see
 * `requireWatchedDocs`) is not earned here.
 *
 * Config wins on a name collision rather than the catalogue, because both
 * alternatives are worse. The catalogue winning is a setting a user wrote and
 * the product ignored — INV-nothing-is-dropped-silently, the failure this whole
 * file is a defence against. Refusing the collision would mean the next
 * category the catalogue teaches something about breaks a `config.json` that
 * was valid before the upgrade, turning a catalogue improvement into a load
 * failure on somebody else's machine.
 *
 * WHOLE ENTRY, not key by key, because an entry is one statement read together.
 * A per-key merge would let a config supply `values` and inherit a `note`
 * describing a different vocabulary, and it would make "absent `values` means
 * free text" — a real answer, per `UpdatableName` — inexpressible, because an
 * inherited vocabulary could never be cleared.
 */
function requireUpdates(name: string, value: unknown): CategoryUpdates {
  if (!isObject(value)) {
    throw new Error(
      `my_context: category "${name}" has invalid updates ${JSON.stringify(value)}. ` +
      `Expected an object mapping an updatable name to its rules, e.g. ${UPDATES_EXAMPLE} — ` +
      `use {} to declare none. Only "store" is required on an entry, and it is ` +
      `${UPDATE_STORES.join(' or ')}. Nothing was loaded — a setting that cannot be acted ` +
      `on is refused rather than ignored.`,
    );
  }
  const declared: [string, UpdatableName][] = Object.entries(value)
    .map(([updatable, entry]) => [updatable, requireUpdatableName(name, updatable, entry)]);
  // `Object.fromEntries`, never `result[updatable] = …`: every one of these
  // names comes from user-supplied JSON, and a plain assignment of
  // `"__proto__"` reaches the prototype SETTER — no own key created and the
  // whole declaration dropped in silence. That is this codebase's oldest bug
  // (see the null-prototype note on `categories` in `resolveConfig`, which
  // counted six occurrences) arriving through the one map added since it was
  // last found. `fromEntries` DEFINES the property, so the pathological name
  // resolves to a readable declaration like any other.
  return Object.fromEntries(declared);
}

/** One entry of `updates`, validated key by key. The refusals name the entry —
 * `updates.<name>.<key>` — because a person with a dozen of them needs to know
 * which one, and `enumError` has no slot for that context. */
function requireUpdatableName(category: string, updatable: string, raw: unknown): UpdatableName {
  if (updatable === '') {
    throw new Error(
      `my_context: category "${category}" declares an updates entry under the empty name "". ` +
      `An updatable name is the thing a person types to change it, so it cannot be empty. ` +
      `Nothing was loaded — a setting that cannot be acted on is refused rather than ignored.`,
    );
  }
  const where = `updates.${updatable}`;
  if (!isObject(raw)) {
    throw new Error(
      `my_context: category "${category}" has invalid ${where} ${JSON.stringify(raw)}. ` +
      `Expected an object with "store" (${UPDATE_STORES.join(' or ')}) and any of: ` +
      `${UPDATE_KEYS.slice(1).join(', ')} — e.g. ${UPDATES_EXAMPLE}. Nothing was loaded — ` +
      `a setting that cannot be acted on is refused rather than ignored.`,
    );
  }
  const unknown = Object.keys(raw).filter((key) => !UPDATE_KEYS.includes(key));
  if (unknown.length > 0) {
    throw new Error(
      `my_context: category "${category}" declares ` +
      `${unknown.map((k) => JSON.stringify(k)).join(', ')} on ${where}, which ` +
      `${unknown.length === 1 ? 'is not a key' : 'are not keys'} an update declaration ` +
      `understands. An update declaration accepts: ${UPDATE_KEYS.join(', ')} — and only ` +
      `"store" is required. Nothing was loaded — a setting that cannot be acted on is ` +
      `refused rather than ignored.`,
    );
  }
  // Absent gets its own sentence rather than falling through to `enumError`'s
  // `You passed "undefined"`: a missing `store` is not a mistyped value, it is
  // the one thing a declaration cannot leave out, and the reason is the ruling
  // that produced this key (categories.ts: "if you would ever want to update
  // it, it is a field").
  if (raw.store === undefined) {
    throw new Error(
      `my_context: category "${category}" declares ${where} with no "store". Every update ` +
      `declaration must say where the value lives: "field" for a value that changes, or ` +
      `"tag" for a membership fixed for the item's life. If you would ever want to update ` +
      `it, it is a field. Nothing was loaded — a setting that cannot be acted on is refused ` +
      `rather than ignored.`,
    );
  }
  // The vocabulary goes through `enumError` like `agentEdits` and `scopePolicy`
  // — the ONE wording this project has for "not one of the allowed values". A
  // second phrasing for that fact is the drift this codebase keeps producing,
  // and the shared one supplies a closest match ("feild" → "field") for free.
  const store = requireEnum(category, `${where}.store`, raw.store, UPDATE_STORES);

  const declaration: UpdatableName = {
    store,
    // `note` is REQUIRED on `UpdatableName` and OPTIONAL in config, and the two
    // are not in conflict: the ruling that made it required is about rendering
    // ("an absent note would mean this declaration cannot be rendered, and
    // rendering is half of what it exists for"), so what a config may omit is
    // the SENTENCE, not the slot. The filled one asserts only what this loader
    // actually knows — the store and the category — and says where to write a
    // better one. Inventing a description of what the name MEANS is the
    // fabrication the `requirement.kind` and `risk.likelihood` entries in the
    // catalogue were deliberately left open to avoid.
    note: requireUpdateLine(category, where, 'note', raw.note)
      ?? `A ${store} on a ${category} item. `
        + `No note was written for it in .my_context/config.json.`,
  };
  if (raw.values !== undefined) {
    if (
      !Array.isArray(raw.values) || raw.values.length === 0
      || raw.values.some((v) => typeof v !== 'string' || v.trim() === '')
    ) {
      throw new Error(
        `my_context: category "${category}" has invalid ${where}.values ` +
        `${JSON.stringify(raw.values)}. Expected a non-empty array of the values this name ` +
        `may take, e.g. ["todo", "doing", "done"] — omit "values" entirely to mean free ` +
        `text, which is a real answer and not a gap. An empty list would be a closed ` +
        `vocabulary with no members, which admits nothing. Nothing was loaded — a setting ` +
        `that cannot be acted on is refused rather than ignored.`,
      );
    }
    declaration.values = raw.values as string[];
  }
  if (raw.projectsTo !== undefined) {
    // Refused on a `tag` rather than accepted and never acted on. A projection
    // is what keeps a FIELD filterable — a machine writes the tag beside it and
    // rewrites it on change — and on a tag store the value already IS the tag.
    if (store === 'tag') {
      throw new Error(
        `my_context: category "${category}" declares ${where}.projectsTo on a "tag" store. ` +
        `A projection keeps a FIELD filterable by writing "<projectsTo>:<value>" beside it ` +
        `and rewriting it on change; a tag is already the tag, so there is nothing to ` +
        `project. Drop "projectsTo", or set "store": "field". Nothing was loaded — a ` +
        `setting that cannot be acted on is refused rather than ignored.`,
      );
    }
    if (typeof raw.projectsTo !== 'string' || !/^[A-Za-z0-9_-]+$/.test(raw.projectsTo)) {
      throw new Error(
        `my_context: category "${category}" has invalid ${where}.projectsTo ` +
        `${JSON.stringify(raw.projectsTo)}. Expected a tag prefix — letters, digits, "_" or ` +
        `"-" and nothing else — because the generated tag is "<projectsTo>:<value>", so a ` +
        `colon or a space in the prefix makes a tag nobody can filter on. Nothing was ` +
        `loaded — a setting that cannot be acted on is refused rather than ignored.`,
      );
    }
    declaration.projectsTo = raw.projectsTo;
  }
  const command = requireUpdateLine(category, where, 'command', raw.command);
  if (command !== undefined) declaration.command = command;
  return declaration;
}

/**
 * `command` and `note`: each is ONE line rendered to a person — by `mycontext
 * help` and `mycontext examples` — so a blank one is a blank row and an
 * embedded newline breaks the table it is rendered in. Absent is legal for
 * both; blank is not the same thing as absent and is not read as it.
 */
function requireUpdateLine(
  category: string, where: string, key: 'command' | 'note', value: unknown,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '' || /[\r\n]/.test(value)) {
    throw new Error(
      `my_context: category "${category}" has invalid ${where}.${key} ` +
      `${JSON.stringify(value)}. Expected one non-empty line — ` +
      (key === 'command'
        ? 'the change as it is typed, e.g. "mycontext edit <id> --extra state=done"'
        : 'the one line a person reads, rendered by `mycontext help` and `mycontext examples`') +
      `. Nothing was loaded — a setting that cannot be acted on is refused rather than ignored.`,
    );
  }
  return value;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isValidTier(v: unknown): v is Tier {
  return v === 'normative' || v === 'rationale';
}

/**
 * One refusal for both new keys, worded by `enumError` — the vocabulary the
 * `type`, `status`, `severity`, `origin`, `relation`, `topic` and `category`
 * surfaces already share. The category travels inside the field name
 * (`categories.rule.agentEdits`) because `enumError` has no slot for context
 * and a user with twenty categories needs to know which one is wrong; a
 * second wording for "not one of the allowed values" is the drift this
 * project keeps producing.
 */
function requireEnum<T extends string>(
  category: string, key: string, value: unknown, allowed: T[],
): T {
  if (typeof value !== 'string' || !(allowed as string[]).includes(value)) {
    const shown = typeof value === 'string' ? value : String(JSON.stringify(value));
    throw new Error(enumError(`categories.${category}.${key}`, shown, allowed, 'categories'));
  }
  return value as T;
}

/**
 * Every category-specific frontmatter field any category declares, sorted for
 * a stable tool schema (tools/list must be byte-stable for prompt caching).
 *
 * The MCP `create_item` surface is built from this — both the schema it
 * advertises and the fields its handler harvests — rather than from a
 * hardcoded list. The hardcoded list had already drifted:
 * `assumption.validated_on` and `open_question.blocks` were declared here and
 * missing there, so passing either returned success and dropped the value
 * with no message. Reading the config in the one place that consumes it is
 * what makes that drift unrepresentable rather than merely fixed once.
 *
 * The union, not per-category, and that is now a statement about the SCHEMA
 * alone. It used to be a statement about semantics too — `kind` on a
 * `constraint` was accepted deliberately — and it no longer is:
 * `unknownExtraFieldError` (trust.ts) refuses an extra key the item's own
 * category does not declare, at `createItem` and `updateItem`, so ownership is
 * enforced at validation. The schema stays a union because `tools/list` is
 * answered before any workspace is known and must be byte-stable across calls
 * for prompt caching; a per-category schema is not expressible in one flat
 * argument list anyway. What changed is that the union now ADVERTISES more
 * than any single category accepts, which is why `extraFieldSchema`
 * (mcp/tools.ts) names the owning categories in every field description.
 */
export function extraFieldNames(config: Config): string[] {
  const names = new Set<string>();
  for (const category of Object.values(config.categories)) {
    for (const field of category.extraFields) names.add(field);
  }
  return [...names].sort();
}

/**
 * Every key a config file may carry at the top level — the same ONE-list shape
 * as `CATEGORY_KEYS`, for the same reason: `Config` is a compile-time type and
 * erases to nothing at runtime, and a top-level key nobody reads used to be
 * accepted and dropped in silence. `"budget"` for `"budgets"` is the concrete
 * case that opened this list: the file loaded, every limit stayed at its
 * default, and the only symptom was items quietly missing from sessions.
 *
 * A key NOT on this list is now skipped and disclosed rather than refused
 * (R14.2) — see the `skippedKeys` collection in `resolveConfig`. The list is
 * still the ONE list; what changed is the verdict for a name that is not on
 * it, and only at this level.
 *
 * EXPORTED, and `as const` so that it carries its members as literal types.
 * `ui/packs-model.ts` draws the `pk.what` table over exactly this domain and
 * could not have the list while it was module-private, so it pinned a copy to
 * `keyof Config` instead and recorded that as a PROXY: a key added HERE that
 * `Config` does not carry would have slipped past that pin. `as const` is what
 * lets the copy go entirely rather than be re-pinned; the runtime value is
 * unchanged, and the one call site that asks `.includes` of an arbitrary string
 * widens it back at the call rather than weakening the type for every reader.
 */
export const TOP_LEVEL_KEYS = ['profile', 'categories', 'budgets', 'watchedDocs', 'ui', 'handover'] as const;

/**
 * Every key the `ui` section may carry — the `CATEGORY_KEYS` shape again, and
 * NOT derived from `DEFAULT_UI` the way `BUDGET_KEYS` is derived from
 * `DEFAULT_BUDGETS`. The derivation is safe for budgets because every budget
 * is the same kind of value and `requireBudgets` checks them in one loop; here
 * a second key would be a port or a host, needing its own check, and deriving
 * the accepted set from the defaults would accept `{"ui": {"port": "abc"}}`
 * the moment a `port` default appeared while the value check below still only
 * knew about `enabled` — a setting accepted and dropped, the exact failure
 * this list exists to stop. Extend this list and `requireUi` together.
 *
 * **That example stopped being hypothetical on 2026-08-27**, when `port`
 * arrived with exactly the `DEFAULT_UI` entry the paragraph above describes.
 * It was added HERE and in `requireUi` in the same change, which is the whole
 * of what keeps `{"ui": {"port": "abc"}}` refused rather than accepted and
 * dropped. The pairing is not a convention; it is the check.
 */
const UI_KEYS = ['enabled', 'port'];

/**
 * The `ui` section: whether `mycontext ui` may run at all.
 *
 * Absent resolves to `DEFAULT_UI` — ENABLED. That is the whole point of the
 * key's direction: the UI is opt-OUT, so a workspace that has never heard of
 * this key gets it, and a `config.json` written before the key existed keeps
 * working unchanged. `{"ui": {}}` — the section declared, empty — is also
 * enabled, because a user who wrote no `enabled` has still not said no.
 *
 * Everything else about this section is REFUSED rather than skipped, and the
 * boundary is deliberate: R14.2 makes an unknown TOP-LEVEL key survivable
 * because a config may legitimately come from a newer build, but `ui` is a
 * known block and a bad key or value inside it is a user's mistake in a
 * setting whose failure direction is one-way. `{"ui": {"enabld": false}}` and
 * `{"ui": {"enabled": "false"}}` both mean a user who tried to switch the UI
 * OFF and, under any lenient reading, is left with it ON while believing
 * otherwise. A permission that fails towards "permitted" in silence is not a
 * permission.
 *
 * `"ui": false` is refused for the same reason and not accepted as sugar: two
 * spellings of one setting means the CLI command that WRITES this key has to
 * choose which one to emit and to round-trip the other, and a file that can
 * hold either shape is a file whose next setting cannot be added to it.
 */
function requireUi(raw: unknown): UiConfig {
  if (raw === undefined) return { ...DEFAULT_UI };
  if (!isObject(raw)) {
    throw new Error(
      `my_context: "ui" is ${JSON.stringify(raw)}, not an object. Expected ` +
      `{"ui": {"enabled": false}} to switch the web UI off, or no "ui" key at all to ` +
      `leave it on. Nothing was loaded — a setting that cannot be acted on is refused ` +
      `rather than ignored.`,
    );
  }
  const unknown = Object.keys(raw).filter((key) => !UI_KEYS.includes(key));
  if (unknown.length > 0) {
    throw new Error(
      `my_context: ui declares ${unknown.map((k) => JSON.stringify(k)).join(', ')}, ` +
      `which ${unknown.length === 1 ? 'is not a key' : 'are not keys'} this config ` +
      `understands. ui accepts: ${UI_KEYS.join(', ')}. Nothing was loaded — accepting ` +
      `the key and keeping the default would mean a user who switched the web UI off ` +
      `still has it switched on.`,
    );
  }
  const ui: UiConfig = { ...DEFAULT_UI };
  if (raw.enabled !== undefined) {
    if (typeof raw.enabled !== 'boolean') {
      throw new Error(
        `my_context: ui.enabled is ${JSON.stringify(raw.enabled)}. Expected true or ` +
        `false. Nothing was loaded — every non-boolean is truthy or falsy by accident, ` +
        `and guessing which would decide whether the web UI may run.`,
      );
    }
    ui.enabled = raw.enabled;
  }

  // **`0` is refused with the out-of-range values rather than read as "any free
  // port", and that is the one decision in this check.** The CLI's `--port`
  // flag accepts 0 and means exactly that, so the two surfaces disagree on
  // purpose: a person passing `--port 0` is standing at the terminal and is
  // about to be handed the URL, while the only reader of THIS key is a hook,
  // which has nowhere to hand one. A config naming 0 would read as configured
  // and produce a liveness record pointing at a port that was never bound —
  // configured in form, silently useless in fact.
  //
  // Refused BY NAME rather than clamped or skipped, for `requireUi`'s standing
  // reason: the failure direction is one-way. A `port` accepted and dropped
  // leaves a user who asked for a server that is always there with one that is
  // never there, and no symptom anywhere except its absence.
  //
  // `null` is refused with the rest, and it is the near-miss worth naming: the
  // RESOLVED value of an absent key is `null`, so a user round-tripping what
  // they saw would write it. There is one spelling of "off" and it is removing
  // the key — the same argument that refuses `"ui": false` as sugar above.
  if (raw.port !== undefined) {
    if (
      typeof raw.port !== 'number' || !Number.isInteger(raw.port)
      || raw.port < 1 || raw.port > 65535
    ) {
      throw new Error(
        `my_context: ui.port is ${JSON.stringify(raw.port) ?? String(raw.port)}. Expected a ` +
        `whole number from 1 to 65535, or no "port" key at all to leave the background ` +
        `server off. Nothing was loaded — 0 is refused with the rest because it means ` +
        `"any free port", and a port nobody chose is a URL nobody can bookmark.`,
      );
    }
    ui.port = raw.port;
  }
  return ui;
}

/**
 * Every key the `handover` section may carry — the `UI_KEYS` shape again, and
 * kept as its own list for the same reason: the four values need four
 * different checks (a path, a non-empty string, a positive integer, a
 * percentage), so deriving the accepted set from anything would accept a key
 * whose value nothing validates. Extend this list and `requireHandover`
 * together — `thresholdPercent` was added to both on 2026-08-27 and the pairing
 * is the only thing that keeps a new key from being accepted unchecked.
 *
 * NOT derived from a defaults object, and here that is not merely a
 * preference: `path` has no default, so there is no object to derive from
 * without inventing a file name to hold its place.
 */
const HANDOVER_KEYS = ['path', 'marker', 'budgetTokens', 'thresholdPercent'];

/**
 * The `handover` section: which document a session is handed after a
 * compaction, and how much of it. Spec §3.1.
 *
 * **Absent resolves to `null`, which is off** — the opposite direction to
 * `requireUi` directly above, and the asymmetry is argued on `HandoverConfig`.
 * The short of it: `ui` grants a permission and a default `yes` costs a user
 * nothing, while this key makes the product read a file in the user's
 * repository, and no default may take that decision for them.
 *
 * Everything a user DID write is refused rather than skipped, and by the
 * offending sub-key's NAME, exactly as `requireUi` does. The boundary is the
 * same one `resolveConfig` documents: R14.2 makes an unknown TOP-LEVEL key
 * survivable because it may have come from a newer build, but `handover` is a
 * known block, and `"pathh"`, `"markr"` or `"budgetTokns"` have no reading in
 * which the user meant something this build could honour. The failure
 * direction is one-way here too: a sub-key accepted and dropped leaves a user
 * who configured a handover with a handover that was never delivered, and the
 * only symptom is a session that quietly knows nothing.
 */
function requireHandover(raw: unknown): HandoverConfig | null {
  if (raw === undefined) return null;
  if (!isObject(raw)) {
    throw new Error(
      `my_context: "handover" is ${JSON.stringify(raw)}, not an object. Expected ` +
      `{"handover": {"path": "reports/V2-HANDOVER.md"}}, or no "handover" key at all to ` +
      `leave the mechanism off. Nothing was loaded — a setting that cannot be acted on ` +
      `is refused rather than ignored.`,
    );
  }
  const unknown = Object.keys(raw).filter((key) => !HANDOVER_KEYS.includes(key));
  if (unknown.length > 0) {
    throw new Error(
      `my_context: handover declares ${unknown.map((k) => JSON.stringify(k)).join(', ')}, ` +
      `which ${unknown.length === 1 ? 'is not a key' : 'are not keys'} this config ` +
      `understands. handover accepts: ${HANDOVER_KEYS.join(', ')}. Nothing was loaded — ` +
      `accepting the key and keeping the default would mean the handover you configured ` +
      `is not the one delivered, and the only symptom is a session that knows less than ` +
      `you think it does.`,
    );
  }

  // REQUIRED, and it is the only sub-key that is. There is no file this
  // product could pick on a user's behalf, so a `handover` block without a
  // `path` is a block with nothing in it — which is why `{"handover": {}}` is
  // refused here where `{"ui": {}}` is accepted: an empty `ui` section is a
  // user who has still not said no, and an empty `handover` section is a user
  // who has not said which document.
  const file = raw.path;
  if (typeof file !== 'string' || file.trim() === '') {
    throw new Error(
      `my_context: handover.path is ${JSON.stringify(file)}. Expected a non-empty ` +
      `repo-relative path to ONE file, e.g. "reports/V2-HANDOVER.md". Nothing was ` +
      `loaded — handover.path is the whole of what this key names, and there is no ` +
      `document this product could choose for you.`,
    );
  }
  // Absolute in EITHER platform's grammar, and any `..` segment in either
  // separator. Two things are being kept out and they are different sizes: a
  // `..` escape is usually a mistake, while an absolute path is a
  // `config.json` — possibly one that arrived in a pack from a stranger —
  // pointing an installed plugin at any file on the machine.
  //
  // Not a glob either, and that refusal is structural rather than checked
  // here: a glob that matches two handovers has to pick one, and picking is
  // the act that would need a rule nobody has written. A `*` simply resolves
  // to no such file at read time and is reported as missing.
  if (
    path.win32.isAbsolute(file) || path.posix.isAbsolute(file)
    || file.split(/[\\/]/).includes('..')
  ) {
    throw new Error(
      `my_context: handover.path is ${JSON.stringify(file)}. Expected a path INSIDE ` +
      `this project — no drive letter, no leading separator, no "..". Nothing was ` +
      `loaded — a config that can name any file on the machine turns an installed ` +
      `plugin into a reader pointed wherever a config.json says, including one that ` +
      `arrived in a pack.`,
    );
  }

  const marker = raw.marker === undefined ? DEFAULT_HANDOVER_MARKER : raw.marker;
  if (typeof marker !== 'string' || marker === '') {
    throw new Error(
      `my_context: handover.marker is ${JSON.stringify(raw.marker)}. Expected a ` +
      `non-empty string, e.g. the default ${JSON.stringify(DEFAULT_HANDOVER_MARKER)}. ` +
      `Nothing was loaded — an empty marker matches the start of every heading, so the ` +
      `first heading in the file would be delivered as the section written for the next ` +
      `session.`,
    );
  }

  const budget = raw.budgetTokens === undefined ? DEFAULT_HANDOVER_BUDGET_TOKENS : raw.budgetTokens;
  // `0` is refused with the negatives rather than read as "deliver nothing":
  // that reading is already spelled by leaving the whole key out, and
  // accepting it here would mean a configured handover that delivers an empty
  // block — a promise kept in form and broken in fact.
  if (typeof budget !== 'number' || !Number.isInteger(budget) || budget <= 0) {
    throw new Error(
      `my_context: handover.budgetTokens is ${JSON.stringify(raw.budgetTokens)}. Expected ` +
      `a whole number greater than 0, in estimateTokens units (characters / 4); the ` +
      `default is ${DEFAULT_HANDOVER_BUDGET_TOKENS}. Nothing was loaded — to deliver no ` +
      `handover at all, remove the "handover" key.`,
    );
  }

  // Validated when present and left ABSENT when it is not — the one sub-key
  // that is not given its default here, argued on
  // `HandoverConfig.thresholdPercent` and applied by
  // `handoverThresholdPercent`. What is NOT relaxed by that is the refusal: a
  // `thresholdPercent` the user did write is checked exactly as hard as the
  // other three, because a threshold nothing can cross is a configured feature
  // that never runs, which is the silence this whole spec exists to answer.
  //
  // `1..100`, and both ends are refused rather than clamped. A `0` — or a
  // negative — is a threshold every turn of every session crosses, which turns
  // a once-per-crossing ask into an ask on the FIRST turn of every session,
  // about a window that is empty; and anything above 100 is a threshold the
  // arithmetic can never reach, so the mechanism would be silently off while
  // reading as configured. Clamping either would honour a config the user did
  // not write, which is `requireHandover`'s standing rule: a setting that
  // cannot be acted on is refused rather than reinterpreted.
  //
  // `Number.isFinite` and not `Number.isInteger`, unlike `budgetTokens` above:
  // the argument is on `HandoverConfig.thresholdPercent` — the number this is
  // eventually meant to be set from is a measurement, and `NaN`/`Infinity` are
  // excluded by the finiteness check rather than by rounding.
  let threshold: number | undefined;
  if (raw.thresholdPercent !== undefined) {
    const chosen = raw.thresholdPercent;
    if (typeof chosen !== 'number' || !Number.isFinite(chosen) || chosen < 1 || chosen > 100) {
      throw new Error(
        `my_context: handover.thresholdPercent is ${JSON.stringify(raw.thresholdPercent)}. ` +
        `Expected how full the context window must be before the handover is asked for, as a ` +
        `percentage between 1 and 100; the default is ${DEFAULT_HANDOVER_THRESHOLD_PERCENT}. ` +
        `Nothing was loaded — a threshold outside that range is either crossed on every turn ` +
        `or on none, and both of those read as a working configuration.`,
      );
    }
    threshold = chosen;
  }

  return {
    path: file,
    marker,
    budgetTokens: budget,
    ...(threshold === undefined ? {} : { thresholdPercent: threshold }),
  };
}

const BUDGET_KEYS = Object.keys(DEFAULT_BUDGETS) as (keyof Budgets)[];

/**
 * The `budgets` section, validated key by key and value by value — because
 * budgets decide what reaches a session at all. A typo'd key
 * (`"pined": 9000`) or an invalid value (`"6000"`, `-1`, `null`) used to be
 * skipped by the merge loop, so the user thought they raised a limit, the
 * default stayed in force, and the only symptom was items quietly missing
 * from their context. That is INV-nothing-is-dropped-silently on the surface
 * with the least visible failure, so both are refused BY NAME here.
 */
function requireBudgets(raw: unknown): Budgets {
  if (raw === undefined) return { ...DEFAULT_BUDGETS };
  if (!isObject(raw)) {
    throw new Error(
      `my_context: "budgets" is ${JSON.stringify(raw)}, not an object. Expected e.g. ` +
      `{"pinned": ${DEFAULT_BUDGETS.pinned}}. Nothing was loaded — a setting that cannot ` +
      `be acted on is refused rather than ignored.`,
    );
  }
  const unknown = Object.keys(raw).filter(
    (key) => !(BUDGET_KEYS as string[]).includes(key),
  );
  if (unknown.length > 0) {
    throw new Error(
      `my_context: budgets declares ${unknown.map((k) => JSON.stringify(k)).join(', ')}, ` +
      `which ${unknown.length === 1 ? 'is not a budget' : 'are not budgets'} this config ` +
      `understands. Budgets accepts: ${BUDGET_KEYS.join(', ')}. Nothing was loaded — ` +
      `accepting the key and keeping the default would mean the limit you set was never ` +
      `in force and items were silently missing from sessions.`,
    );
  }
  const budgets: Budgets = { ...DEFAULT_BUDGETS };
  for (const key of BUDGET_KEYS) {
    const value = raw[key];
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error(
        `my_context: budgets.${key} is ${JSON.stringify(value)}. Expected a number >= 0, ` +
        `in estimateTokens units (characters / 4). Nothing was loaded — keeping the ` +
        `default (${DEFAULT_BUDGETS[key]}) silently would mean the limit you set was ` +
        `never in force.`,
      );
    }
    budgets[key] = value;
  }
  return budgets;
}

/**
 * The `watchedDocs` list, refused rather than filtered: a non-string entry
 * used to be dropped by a `filter`, so `"watchedDocs": ["docs/prd/**", 42]`
 * watched one glob and said nothing about the other — and a non-array value
 * (`"docs/prd/**"` without the brackets) was silently replaced with the
 * DEFAULT list, which is worse: the user's setting not merely narrowed but
 * inverted, with the product watching globs the user never wrote.
 */
function requireWatchedDocs(raw: unknown): string[] {
  if (raw === undefined) return [...DEFAULT_WATCHED_DOCS];
  if (!Array.isArray(raw)) {
    throw new Error(
      `my_context: "watchedDocs" is ${JSON.stringify(raw)}, not an array. Expected an ` +
      `array of glob strings, e.g. ["docs/prd/**"]. Nothing was loaded — a setting that ` +
      `cannot be acted on is refused rather than ignored.`,
    );
  }
  const bad = raw.filter((v) => typeof v !== 'string');
  if (bad.length > 0) {
    throw new Error(
      `my_context: watchedDocs contains ${bad.map((v) => JSON.stringify(v)).join(', ')}, ` +
      `which ${bad.length === 1 ? 'is not a string' : 'are not strings'}. Every entry is ` +
      `a glob string. Nothing was loaded — dropping the entry silently would mean a ` +
      `document you asked to be watched was not.`,
    );
  }
  return raw as string[];
}

export function resolveConfig(raw: unknown): Config {
  // `null`/`undefined` mean "no config file", and resolve to pure defaults.
  // Anything else that is not an object — a config.json holding `[]` or a
  // bare string parses fine — used to be silently read as `{}`, i.e. an
  // entire config file accepted and dropped in one move.
  if (raw !== undefined && raw !== null && !isObject(raw)) {
    throw new Error(
      `my_context: config is ${JSON.stringify(raw)}, not an object. Expected a JSON ` +
      `object with any of: ${TOP_LEVEL_KEYS.join(', ')}. Nothing was loaded — a config ` +
      `that cannot be acted on is refused rather than ignored.`,
    );
  }
  const input = isObject(raw) ? raw : {};

  // R14.2: SKIPPED and disclosed, where this used to refuse the entire config.
  //
  // The refusal was right about the failure it named — `"budget"` for
  // `"budgets"` really does leave every limit at its default — and wrong about
  // the direction of the risk at THIS level. A top-level key is how a new
  // feature arrives, so a config carrying one is not only a typo: it is also a
  // file written for a build newer than the one reading it. Refusing the whole
  // file for that turns "this build is older than your config" into "the
  // plugin does nothing at all", which is the outcome R14's third clause
  // exists to forbid, and it would have made `ui` — and every top-level key
  // after it — unshippable to anyone who had not upgraded first.
  //
  // Skipping alone would be the silent drop this list was added to end, so the
  // skip is CARRIED on the resolved config (`skippedKeys`) and worded by
  // `skippedKeyNotice`. The typo case loses nothing it had: the user still
  // learns that `"budget"` was not read, from a sentence rather than from a
  // dead plugin.
  //
  // The boundary stops here, at the top level, and is not one function: the
  // two nested unknown-key checks — `requireCategoryKeys` for a category entry
  // and `requireBudgets` for a budget entry, plus `requireUi` for the section
  // added alongside this change — all still refuse, unchanged and with the
  // messages they had. Nothing inside a known block ever arrives from the
  // future: the block's own key list is what a newer build would extend, and a
  // typo there (`"sevrity"`, `"pined"`, `"enabld"`) has no reading in which the
  // user meant something this build could honour.
  //
  // Insertion order, not sorted: these are keys as the user wrote them, and
  // the notice is read next to the file.
  const skippedKeys = Object.keys(input)
    .filter((key) => !(TOP_LEVEL_KEYS as readonly string[]).includes(key));

  const profile = (input.profile ?? 'standard') as ProfileName;
  if (!Object.hasOwn(PROFILES, profile)) {
    throw new Error(
      `my_context: unknown profile "${String(profile)}". ` +
      `Expected one of: ${Object.keys(PROFILES).join(', ')}.` +
      (PROFILE_HINTS[profile as string] === undefined ? '' : `\n${PROFILE_HINTS[profile as string]}`),
    );
  }

  const enabledByProfile = new Set(PROFILES[profile]);
  // Null-prototype, deliberately: every key of this map comes from
  // user-supplied config JSON or from an item's `type` field, and a plain
  // object answers `categories["constructor"]` with `Object` itself. That has
  // now bitten this codebase six times, and the sixth was the worst: the
  // override loop below resolved `existing` to `Object.prototype.constructor`
  // and then wrote `.enabled`/`.tier`/`.description` onto the global `Object`
  // function, while the category the user declared never gained an own key —
  // a config entry accepted and silently dropped (INV-nothing-is-dropped-
  // silently). Removing the prototype removes the hazard for every consumer
  // at once, including the bare `config.categories[item.type]` lookups in
  // select.ts and decay.ts, rather than asking each call site to remember a
  // guard. `config.test.ts` pins the prototype so this cannot be undone
  // silently.
  const categories: Record<string, ResolvedCategory> = Object.create(null);
  for (const def of Object.values(CATEGORIES)) {
    categories[def.name] = {
      name: def.name,
      prefix: def.prefix,
      tier: def.tier,
      enabled: enabledByProfile.has(def.name),
      description: def.description,
      extraFields: [...def.extraFields],
      agentEdits: defaultAgentEdits(def.tier),
      scopePolicy: DEFAULT_SCOPE_POLICY,
      updates: def.updates,
    };
  }

  // Present-but-not-an-object is refused, not defaulted: `"categories": []`
  // used to resolve every category to its default and say nothing.
  if (input.categories !== undefined && !isObject(input.categories)) {
    throw new Error(
      `my_context: "categories" is ${JSON.stringify(input.categories)}, not an object. ` +
      `Expected e.g. {"rule": {"enabled": false}}. Nothing was loaded — a setting that ` +
      `cannot be acted on is refused rather than ignored.`,
    );
  }
  const rawCategories = isObject(input.categories) ? input.categories : {};
  for (const [name, value] of Object.entries(rawCategories)) {
    // Before anything is read out of it: a key this loop cannot act on is a
    // setting the user wrote and the product ignored.
    requireCategoryKeys(name, value);
    const override = (isObject(value) ? value : {}) as RawCategory;
    // A bare index is safe here only because `categories` above has no
    // prototype — this is the loop that wrote onto `Object` when it did.
    const existing = categories[name];

    if (!existing) {
      if (!override.tier || !override.description) {
        throw new Error(
          `my_context: unknown category "${name}". To define a custom category it must ` +
          `declare both "tier" (normative | rationale) and "description".`,
        );
      }
      if (!isValidTier(override.tier)) {
        throw new Error(
          `my_context: custom category "${name}" has invalid tier ${JSON.stringify(override.tier)}. ` +
          `Expected 'normative' or 'rationale'.`,
        );
      }
      if (typeof override.description !== 'string') {
        throw new Error(
          `my_context: custom category "${name}" has invalid description ${JSON.stringify(override.description)}. ` +
          `Expected a string.`,
        );
      }
      categories[name] = {
        name,
        // Validated rather than trusted, and by the same function the built-in
        // branch below uses: a custom category with `"prefix": "a/b"` used to
        // produce ids containing a path separator, which are also file names.
        prefix: override.prefix === undefined
          ? name.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase()
          : requirePrefix(name, override.prefix),
        tier: override.tier,
        enabled: override.enabled ?? true,
        description: override.description,
        // The half of this feature a custom category never had. It was
        // hardcoded `[]` with no key to set it, so a project category could
        // carry no category-specific frontmatter at all — and the 49 `task`
        // items in this product's own outer corpus, each carrying `plan`,
        // `seq`, `state`, `progress` and `source`, are exactly what that cost.
        //
        // The whole list, not an extension of anything: a custom category has
        // no catalogue entry, so there is nothing here for the built-in branch
        // below to protect and "extend" and "replace" mean the same thing.
        extraFields: override.extraFields === undefined
          ? []
          : requireExtraFields(name, override.extraFields),
        agentEdits: override.agentEdits === undefined
          ? defaultAgentEdits(override.tier)
          : requireEnum(name, 'agentEdits', override.agentEdits, AGENT_EDITS),
        scopePolicy: override.scopePolicy === undefined
          ? DEFAULT_SCOPE_POLICY
          : requireEnum(name, 'scopePolicy', override.scopePolicy, SCOPE_POLICIES),
        // The rules half of what a person may author, and the sibling of
        // `extraFields` directly above: until this key existed a custom
        // category could describe what its items CARRY and nothing about how
        // any of it is CHANGED, so it resolved to `{}` and taught nobody
        // anything. The owner's constraint, 2026-08-23: "custom categories are
        // created by humen and it should be written in a way a user could edit
        // and define it in the config".
        //
        // The whole declaration, not an extension of anything, for the same
        // reason `extraFields` is the whole list on this branch: a custom
        // category has no catalogue entry, so there is nothing here to protect
        // and "extend" and "replace" name the same operation. Its TIER still
        // declares the general rules (`TIER_UPDATES`, categories.ts); this is
        // the category's own, which is all `CategoryDef.updates` ever carries.
        //
        // `{}` when the key is absent, and it stays a declaration rather than a
        // gap: it says this category adds nothing of its own.
        updates: override.updates === undefined
          ? {}
          : requireUpdates(name, override.updates),
      };
      continue;
    }

    if (override.enabled !== undefined) {
      if (typeof override.enabled !== 'boolean') {
        throw new Error(
          `my_context: category "${name}" has invalid enabled ${JSON.stringify(override.enabled)}. ` +
          `Expected a boolean.`,
        );
      }
      existing.enabled = override.enabled;
    }
    if (override.tier !== undefined) {
      if (!isValidTier(override.tier)) {
        throw new Error(
          `my_context: category "${name}" has invalid tier ${JSON.stringify(override.tier)}. ` +
          `Expected 'normative' or 'rationale'.`,
        );
      }
      existing.tier = override.tier;
    }
    if (override.description !== undefined) {
      if (typeof override.description !== 'string') {
        throw new Error(
          `my_context: category "${name}" has invalid description ${JSON.stringify(override.description)}. ` +
          `Expected a string.`,
        );
      }
      existing.description = override.description;
    }
    // After `tier`, deliberately: the default is a function of the *resolved*
    // tier, so a category retiered here takes the new tier's default rather
    // than the catalogue's. An explicit value still wins over both.
    if (override.agentEdits !== undefined) {
      existing.agentEdits = requireEnum(name, 'agentEdits', override.agentEdits, AGENT_EDITS);
    } else if (override.tier !== undefined) {
      existing.agentEdits = defaultAgentEdits(existing.tier);
    }
    if (override.scopePolicy !== undefined) {
      existing.scopePolicy = requireEnum(name, 'scopePolicy', override.scopePolicy, SCOPE_POLICIES);
    }
    // `prefix`, which this branch never read: `"rule": {"prefix": "POLICY"}`
    // was accepted whole and every new rule still landed as `RULE-…`. Items
    // already on disk keep the ids they were minted with — an id is immutable
    // (`makeId` runs once, at capture) — so this governs ids minted from here
    // on, and `mycontext list rule` still finds both.
    if (override.prefix !== undefined) {
      existing.prefix = requirePrefix(name, override.prefix);
    }
    // EXTENDS the catalogue's list; it does not replace it. `{"rule":
    // {"extraFields": ["owner"]}}` resolves to `['directive', 'owner']`, and
    // there is no config spelling that yields `['owner']` alone.
    //
    // This is the ONE list key on this branch that does not replace, and the
    // asymmetry is deliberate rather than an oversight — a reader who finds it
    // beside `watchedDocs`, which DOES replace ("not merely narrowed but
    // inverted", `requireWatchedDocs` below), and sees no reason will "fix"
    // one of them. The two dangers point opposite ways. For `watchedDocs` the
    // hazard is silently GAINING globs the user never wrote, and the worst
    // case of replacing is watching fewer files. Here the hazard is silently
    // LOSING a field the corpus already depends on: `rule` items really do
    // carry `directive` (a survey of all 118 items in this machine's two
    // corpora confirmed it), so under replace, a user adding `owner` to `rule`
    // would drop `directive` from the category — and every existing rule item
    // carrying it would then be refused by `unknownExtraFieldError`, the
    // validation added in this very commit. The change would break the corpus
    // it was built to protect. `tier` and `agentEdits` are scalars, where
    // replace is the only coherent semantics, so they settle nothing here.
    //
    // The limit this creates is intended, not a gap: a catalogue field can
    // never be removed from config. `directive` is part of what `rule` MEANS,
    // not a preference. A config entry that omits it is an addition and
    // nothing else — never read as a removal request, and never warned about.
    //
    // Catalogue fields first, then the new ones, and a name already in the
    // catalogue collapses instead of appearing twice: the list is rendered
    // verbatim in `unknownExtraFieldError`'s refusal and in the ingest
    // extraction request, where a repeat reads as a mistake by the product.
    if (override.extraFields !== undefined) {
      const added = requireExtraFields(name, override.extraFields);
      existing.extraFields = [...new Set([...existing.extraFields, ...added])];
    }
    // EXTENDS the catalogue's declaration BY NAME, the same direction as
    // `extraFields` directly above — and deliberately so, because these are the
    // two halves of ONE description of a category and halves that follow
    // opposite rules can contradict each other. `extraFields` cannot remove
    // `directive` from `rule`; under a replace reading here, a user adding one
    // update name of their own would leave `directive` undroppable and its
    // rules gone. `requireUpdates` above carries the full argument, including
    // why a name the config declares wins for that name and replaces the WHOLE
    // entry rather than merging into it.
    //
    // A fresh object every time: `existing.updates` is still the catalogue's
    // own `CategoryDef.updates` at this point, shared by every config this
    // process resolves, and spreading is what keeps one workspace's override
    // out of the next one's categories.
    if (override.updates !== undefined) {
      existing.updates = { ...existing.updates, ...requireUpdates(name, override.updates) };
    }
  }

  return {
    profile,
    categories,
    budgets: requireBudgets(input.budgets),
    watchedDocs: requireWatchedDocs(input.watchedDocs),
    ui: requireUi(input.ui),
    // `null` when the key is absent, which is the feature switched off. See
    // `requireHandover` for why this key defaults the other way to `ui`.
    handover: requireHandover(input.handover),
    skippedKeys,
  };
}

/**
 * The one wording for "this build did not read that key", or `''` when there
 * is nothing to disclose — so a caller is a two-line change (`const notice =
 * skippedKeyNotice(config); if (notice !== '') out(notice);`) and cannot
 * invent a second phrasing for the same fact.
 *
 * It names BOTH readings, because the resolver cannot tell them apart and the
 * user can: a misspelled key means the setting they wrote is not in force, and
 * a key from a newer my_context means this build is older than their config.
 * Only the first is theirs to fix, and a notice that asserted either one would
 * be wrong half the time.
 *
 * "this build understands" rather than the nested refusals' "this config
 * understands", deliberately: at this level the sentence is about a version
 * gap between the reader and the file, and "config" would point the user at
 * the file for something that may be entirely correct in it.
 *
 * Returns a string and writes nothing. Called on any path, including a hook's,
 * it cannot throw, cannot block, and cannot emit a byte — which is what lets
 * the hooks that must fail open call it or ignore it freely.
 */
export function skippedKeyNotice(config: Config): string {
  const keys = config.skippedKeys;
  if (keys.length === 0) return '';
  const one = keys.length === 1;
  return (
    `my_context: config declares ${keys.map((k) => JSON.stringify(k)).join(', ')}, ` +
    `which ${one ? 'is not a key' : 'are not keys'} this build understands. ` +
    `${one ? 'It was' : 'They were'} skipped and the rest of the config loaded. ` +
    `Config accepts: ${TOP_LEVEL_KEYS.join(', ')}. A misspelled key means the setting ` +
    `you wrote is not in force; a key from a newer my_context means this build is ` +
    `older than your config.`
  );
}
