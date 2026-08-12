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
