import { CATEGORIES, PROFILES, type ProfileName } from './categories.ts';
import type { Tier } from './types.ts';

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
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isValidTier(v: unknown): v is Tier {
  return v === 'normative' || v === 'rationale';
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
  const categories: Record<string, ResolvedCategory> = {};
  for (const def of Object.values(CATEGORIES)) {
    categories[def.name] = {
      name: def.name,
      prefix: def.prefix,
      tier: def.tier,
      enabled: enabledByProfile.has(def.name),
      description: def.description,
      extraFields: [...def.extraFields],
    };
  }

  const rawCategories = isObject(input.categories) ? input.categories : {};
  for (const [name, value] of Object.entries(rawCategories)) {
    const override = (isObject(value) ? value : {}) as RawCategory;
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
