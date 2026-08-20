import { CATEGORIES, PROFILES, type ProfileName } from './categories.ts';
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
}

/** Declaration order is the order the refusal lists them in — `enumError`
 * prints `allowed.join(', ')` verbatim — so it is user-facing, not incidental. */
export const AGENT_EDITS: AgentEdits[] = ['allow', 'review'];
export const SCOPE_POLICIES: ScopePolicy[] = ['global', 'required', 'inert'];

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

export interface Config {
  profile: ProfileName;
  categories: Record<string, ResolvedCategory>;
  budgets: Budgets;
  watchedDocs: string[];
}

interface RawCategory {
  enabled?: boolean;
  tier?: Tier;
  description?: string;
  prefix?: string;
  agentEdits?: AgentEdits;
  scopePolicy?: ScopePolicy;
  extraFields?: string[];
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
 */
const CATEGORY_KEYS = [
  'enabled', 'tier', 'description', 'prefix', 'agentEdits', 'scopePolicy', 'extraFields',
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
 * case this closes: the file loaded, every limit stayed at its default, and
 * the only symptom was items quietly missing from sessions.
 */
const TOP_LEVEL_KEYS = ['profile', 'categories', 'budgets', 'watchedDocs'];

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

  const unknownTop = Object.keys(input).filter((key) => !TOP_LEVEL_KEYS.includes(key));
  if (unknownTop.length > 0) {
    throw new Error(
      `my_context: config declares ${unknownTop.map((k) => JSON.stringify(k)).join(', ')}, ` +
      `which ${unknownTop.length === 1 ? 'is not a key' : 'are not keys'} this config ` +
      `understands. Config accepts: ${TOP_LEVEL_KEYS.join(', ')}. Nothing was loaded — ` +
      `a setting that cannot be acted on is refused rather than ignored.`,
    );
  }

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
  }

  return {
    profile,
    categories,
    budgets: requireBudgets(input.budgets),
    watchedDocs: requireWatchedDocs(input.watchedDocs),
  };
}
