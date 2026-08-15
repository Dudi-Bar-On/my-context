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
  if (!(profile in PROFILES)) {
    throw new Error(
      `my_context: unknown profile "${String(profile)}". ` +
      `Expected one of: ${Object.keys(PROFILES).join(', ')}.`,
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
        prefix: override.prefix ?? name.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase(),
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
