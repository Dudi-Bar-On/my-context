import { CATEGORIES, PROFILES, type ProfileName } from './categories.ts';
import { enumError } from './teach.ts';
import type { AgentEdits, ScopePolicy, Tier } from './types.ts';

export interface Budgets {
  pinned: number;
  jit: number;
  restored: number;
  index: number;
}

export const DEFAULT_BUDGETS: Budgets = { pinned: 1500, jit: 500, restored: 2000, index: 150 };

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
 * `tierOf` (mutate.ts) document. `resolveConfig` builds `categories` with a
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
 * `tierOf` (mutate.ts) fails closed to `normative`, and for the same reason. A
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
}

/**
 * Every key a category entry may carry — the ONE list, derived from nothing
 * because `RawCategory` is a compile-time type and erases to nothing at
 * runtime (`erasableSyntaxOnly`). Kept beside it so the two are read together.
 *
 * It exists because an entry key nobody reads used to be accepted and dropped
 * in silence, which is the one failure mode INV-nothing-is-dropped-silently
 * rules out. `extraFields` is the concrete case: a user reading the category
 * table — where `rule` declares `directive` and `risk` declares
 * `likelihood`/`impact` — reasonably writes `"extraFields": ["owner"]` in
 * config, and `resolveConfig` used to accept the whole entry and mint a
 * category with the catalogue's fields. It is refused BY NAME below rather
 * than merely listed, because "not a key" is not the useful answer for a field
 * that plainly exists on the resolved category.
 */
const CATEGORY_KEYS = [
  'enabled', 'tier', 'description', 'prefix', 'agentEdits', 'scopePolicy',
];

/**
 * The extra sentence one refused key earns — the same `ARGUMENT_HINTS` shape
 * (mcp/tools.ts) and the same reason: the difference between "no" and "here".
 */
const CATEGORY_KEY_HINTS: Record<string, string> = {
  extraFields:
    'extraFields is not settable in config: it is declared by the built-in category ' +
    'catalogue (src/core/categories.ts), and the MCP create_item schema is built from the ' +
    'union of what every category declares — so a field invented here would be advertised ' +
    'to every agent and accepted on every category. A custom category carries no extra ' +
    'fields; use `tags`, or `extra` on an item, for anything the catalogue does not name.',
};

function requireCategoryKeys(name: string, value: unknown): void {
  if (!isObject(value)) return;
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
 * The union, not per-category: `kind` on a `constraint` is accepted
 * deliberately (typical usage is a hint, not an enforced restriction), and
 * narrowing to the item's own category here would start silently dropping
 * fields again — the exact failure this exists to end.
 */
export function extraFieldNames(config: Config): string[] {
  const names = new Set<string>();
  for (const category of Object.values(config.categories)) {
    for (const field of category.extraFields) names.add(field);
  }
  return [...names].sort();
}

export function resolveConfig(raw: unknown): Config {
  const input = isObject(raw) ? raw : {};

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
        extraFields: [],
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
  }

  const rawBudgets = isObject(input.budgets) ? input.budgets : {};
  const budgets: Budgets = { ...DEFAULT_BUDGETS };
  for (const key of Object.keys(DEFAULT_BUDGETS) as (keyof Budgets)[]) {
    const value = rawBudgets[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) budgets[key] = value;
  }

  const watchedDocs = Array.isArray(input.watchedDocs)
    ? input.watchedDocs.filter((v): v is string => typeof v === 'string')
    : [...DEFAULT_WATCHED_DOCS];

  return { profile, categories, budgets, watchedDocs };
}
