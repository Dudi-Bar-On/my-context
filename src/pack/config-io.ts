/**
 * What a `config.json` inside an artefact may say, in both directions.
 *
 * Four functions: two that WRITE one (a whole-workspace export and a pack),
 * one that REFUSES a pack's, and one that MERGES a refused-clean pack's into
 * the config a workspace already has.
 *
 * ## The rule this module exists to hold
 *
 * **A pack may name knowledge this build has never heard of, and may not
 * re-describe knowledge it has.**
 *
 * That asymmetry is the whole of §6n.1. A pack MAY declare `tier` (and, with
 * it, `description`) for a category name that does NOT resolve here — there it
 * is mandatory, because `resolveConfig` will not load a custom category
 * without both, and it can override nothing, because there is nothing at that
 * name to override. It may NEVER declare `tier` for a name that already
 * resolves: `{"rule": {"tier": "rationale"}}` un-injects the importer's whole
 * normative corpus and opens it to unreviewed agent writes, in one key, from a
 * file they double-clicked. `agentEdits` is refused on every name, new or old,
 * because a new category's tier already decides it. `budgets`, `watchedDocs`
 * and `profile` never travel at all.
 *
 * ## Which module owns which refusal, and why it is split at all
 *
 * This module owns the rules that are about a PACK: what a stranger's file may
 * say to a build it did not write. `core/config.ts` owns the rules that are
 * about a CONFIG: what a tier, a prefix, a description or a scope policy may
 * be. So the value grammars are not restated here — `refusePackConfig` ASKS
 * the resolver, by resolving the pack's own category entry on its own, and
 * re-voices whatever comes back as a refusal of the pack. A second copy of the
 * prefix grammar would drift from the first, and the drift would show up as a
 * pack that this build accepts and the next one cannot load.
 *
 * The refusal still has to happen HERE rather than at the resolver, and that
 * is the part worth the code: it lands against the pack, before a corpus is
 * half-built, instead of as a config error the next time the workspace opens.
 *
 * ## Why the export projection is not a serialisation of the resolved config
 *
 * `ResolvedCategory` carries `name`, and `requireCategoryKeys` refuses `name`
 * as a key a category entry may not have — so serialising the resolved shape
 * writes a file this product cannot read back. It also carries the catalogue's
 * own `description` and `extraFields` for all 24 built-in categories, which
 * would freeze this build's catalogue into the file: a later build that
 * reworded a description would be silently overridden by an export taken
 * today. The projection therefore writes the RAW shape, deliberately, and the
 * round trip is asserted in the test rather than assumed here.
 *
 * ## Two keys the projections do not carry, both pinned by a test
 *
 * - **`extraFields` — OPEN, not decided.** §6n.1 enumerated the keys that move
 *   the trust boundary while `extraFields` was still refused by name, so it
 *   ruled on a key that could not appear. It is settable now: on a built-in
 *   category it EXTENDS by union, on a custom one it is the whole list.
 *   Neither projection writes it and `refusePackConfig` refuses it — not as a
 *   ruling, but because the permitted set is stated POSITIVELY, so a key is
 *   excluded until someone adds it deliberately. That is the direction a
 *   ruling can reverse without invalidating an artefact already written. **The
 *   cost of the refusal is real and is not hidden:** a pack that ships a
 *   custom category cannot ship the frontmatter fields that category declares,
 *   so its own items are refused on arrival by `unknownExtraFieldError` —
 *   which is most of what a custom category is for.
 * - **`ui`.** It joined `TOP_LEVEL_KEYS` after this projection's key list was
 *   written. It is a permission about the receiving machine rather than
 *   knowledge, so it is omitted like `profile` — but a whole-workspace export
 *   is meant to be faithful, and a UI switched off does not survive one.
 *
 * ## What this module never sees
 *
 * A path. `config.json` sits at a constant, `CONFIG_NAME`, and everything here
 * is the CONTENT of that one file. Nothing here builds an `ExportFile`, so
 * `refuseArtefactPath`/`refuseArtefactPaths` have nothing to be called on; the
 * set-level check belongs where a set of paths is assembled (the bundle walk)
 * and where one is read back (the reader).
 */
import { CATEGORIES } from '../core/categories.ts';
import { resolveConfig, scopePolicyFor, type Config, type ResolvedCategory } from '../core/config.ts';
import type { AgentEdits, ScopePolicy, Tier } from '../core/types.ts';
import { comparePaths, PACK_PROTOCOL } from './layout.ts';

/**
 * A category entry as it appears in a `config.json` FILE — the raw shape
 * `resolveConfig` reads, not the resolved shape it returns.
 *
 * The index signature is not laxness: `mergePackConfig` clones a config this
 * build may not fully understand (R14.2 — a file written by a newer one), and
 * a type that could not hold the keys it does not know would be a type that
 * cannot express the merge's own promise to keep them.
 */
export interface RawCategoryJson {
  enabled?: boolean;
  tier?: Tier;
  description?: string;
  prefix?: string;
  agentEdits?: AgentEdits;
  scopePolicy?: ScopePolicy;
  [key: string]: unknown;
}

/** A whole `config.json`, in the same raw spelling. */
export interface RawConfigJson {
  profile?: string;
  categories: Record<string, RawCategoryJson>;
  budgets?: Record<string, number>;
  watchedDocs?: string[];
  [key: string]: unknown;
}

/** The six keys a whole-workspace export writes for every category. */
const EXPORT_KEYS = ['enabled', 'tier', 'description', 'prefix', 'agentEdits', 'scopePolicy'] as const;

/** What a pack may set on a category name that already resolves here. */
const PACK_KEYS_EXISTING = ['enabled', 'prefix', 'scopePolicy'];

/** …and on one that does not, where `tier` and `description` are required. */
const PACK_KEYS_NEW = ['enabled', 'tier', 'description', 'prefix', 'scopePolicy'];

/** The fields `mergePackConfig` will copy — the union of the two lists above. */
const MERGED_FIELDS = ['enabled', 'tier', 'description', 'prefix', 'scopePolicy'] as const;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function json(v: unknown): string {
  return JSON.stringify(v) ?? String(v);
}

/**
 * Assign a key without going through `[[Set]]`.
 *
 * `target[name] = value` walks the prototype chain, so a category literally
 * named `__proto__` sets the object's prototype instead of adding a member:
 * the entry vanishes from `JSON.stringify` and a stranger's object becomes the
 * config's prototype. Every category name in this module comes from a config
 * file — the exporter's own or a pack's — so every write goes through here.
 * `refusePackConfig` refuses the name as well; a guard whose only enforcement
 * is a caller remembering to ask is not a guard.
 */
function setKey<T>(target: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
}

/**
 * The whole workspace's config, in the shape a `config.json` is written in.
 *
 * Every category is written with every key that decides behaviour, rather than
 * only the ones that differ from a default, because "differs from a default"
 * is a fact about the build that wrote it: the receiving build's catalogue may
 * disagree, and a projection that omitted the agreements would be read there
 * as agreement with a different set of them.
 *
 * Sorted by category name, and the keys within each entry are written in a
 * fixed order, because `config.json`'s BYTES are hashed into the manifest —
 * two exports of one workspace that differ only in key order are two artefacts
 * that do not verify against each other.
 *
 * This writes what a PACK may not: `tier` and `description` on names the
 * receiver already has. That is not an oversight — an export is the author's
 * own workspace travelling whole, and `ArtefactKind` in the manifest is what
 * tells a reader which of the two it is holding. Nothing may feed this
 * projection through `mergePackConfig`.
 */
export function projectExportConfig(config: Config): RawConfigJson {
  const categories: Record<string, RawCategoryJson> = {};
  for (const name of Object.keys(config.categories).toSorted(comparePaths)) {
    const category: ResolvedCategory = config.categories[name];
    const entry: RawCategoryJson = {};
    for (const key of EXPORT_KEYS) setKey(entry as Record<string, unknown>, key, category[key]);
    setKey(categories, name, entry);
  }
  return {
    profile: config.profile,
    categories,
    budgets: { ...config.budgets },
    watchedDocs: [...config.watchedDocs],
  };
}

/**
 * The vocabulary a pack carries, and nothing about the importer.
 *
 * One entry per type in `typesInPack` — the types that actually hold an item
 * in this pack, because a vocabulary entry with no items is a setting rather
 * than knowledge about a domain. `enabled: true` is explicit on every entry,
 * which is the additive half of what `profile` would have said wholesale.
 *
 * `tier` and `description` are written for a category this PRODUCT's catalogue
 * does not have, and withheld for one it does. The predicate is the catalogue
 * (`CATEGORIES`) rather than the exporting workspace's resolved config, since
 * the resolved config holds every built-in name too — and it is the exporter
 * GUESSING what the importer knows, which is the one thing about this format
 * that cannot be checked from here: a category this build ships and an older
 * one does not is written as built-in and refused on arrival as an unknown
 * name with no tier.
 *
 * `agentEdits` is written on neither branch, ever.
 */
export function projectPackConfig(config: Config, typesInPack: readonly string[]): RawConfigJson {
  const categories: Record<string, RawCategoryJson> = {};
  for (const type of [...new Set(typesInPack)].toSorted(comparePaths)) {
    // `Object.hasOwn` rather than a truthiness test: `config.categories` is
    // null-prototype by construction, and this is also the guard that makes a
    // type named `constructor` read as absent rather than as `Object`.
    if (!Object.hasOwn(config.categories, type)) {
      throw new Error(
        `my_context: cannot describe the category "${type}" in a pack, because this workspace's ` +
        `config has no category by that name — an item of a category that was renamed or removed ` +
        `after it was captured is still indexed, and this is one. There is no honest prefix, tier ` +
        `or description to invent for it, and a pack that declared nothing for it would carry ` +
        `items no build could accept. Nothing was written.`,
      );
    }
    const category: ResolvedCategory = config.categories[type];
    const entry: RawCategoryJson = { enabled: true };
    if (!Object.hasOwn(CATEGORIES, type)) {
      entry.tier = category.tier;
      entry.description = category.description;
    }
    entry.prefix = category.prefix;
    // The ONE lookup, shared with every surface that interprets an empty
    // scope. Its missing-category branch cannot fire here — the refusal above
    // has already run — and it is still what asks the question.
    entry.scopePolicy = scopePolicyFor(config, type);
    setKey(categories, type, entry);
  }
  return { categories };
}

function refuseTopLevel(key: string): string {
  if (key === 'profile') {
    return `my_context: this pack's config.json declares "profile", and a pack never carries one. ` +
      `A profile selects which categories are enabled wholesale, so carrying it would replace the ` +
      `selection you made rather than add to it. A pack's categories each arrive with an explicit ` +
      `"enabled": true instead, which is the additive half of the same fact. Nothing was imported.`;
  }
  if (key === 'budgets') {
    return `my_context: this pack's config.json declares "budgets", and a pack never carries one. ` +
      `Budgets decide how much of YOUR corpus reaches a session, which is a fact about your ` +
      `machine and your context window rather than knowledge about the author's domain. ` +
      `Nothing was imported.`;
  }
  if (key === 'watchedDocs') {
    return `my_context: this pack's config.json declares "watchedDocs", and a pack never carries ` +
      `one. It names documents in the author's own repository, which do not exist here, so ` +
      `importing it would watch globs you never wrote. Nothing was imported.`;
  }
  return `my_context: this pack's config.json declares ${json(key)}, and a pack's config carries ` +
    `only "categories". An unknown key is refused here rather than skipped: your own config skips ` +
    `one, because that file may have been written by a newer build, but nothing in a pack's ` +
    `config reaches you except its categories — so skipping this would be a silent drop rather ` +
    `than a safe read. A change to the artefact format is declared by its protocol, ` +
    `${PACK_PROTOCOL}. Nothing was imported.`;
}

/**
 * One verdict per key of one category entry, so no key is ever reported twice
 * and none is reported by a rule that did not decide it.
 */
function refuseCategoryKey(name: string, key: string, value: unknown, known: boolean): string | null {
  if (key === 'tier') {
    if (!known) return null;
    return `my_context: this pack sets categories.${name}.tier, and "${name}" is a category this ` +
      `build already has, so a pack may not. A tier override moves the boundary in whichever ` +
      `direction it is written: retiering "${name}" to "rationale" lands every future ` +
      `agent-authored ${name} "active" instead of "draft", and stops every ${name} you already ` +
      `have being injected at all — strictly more power than a --trust flag, which this product ` +
      `refuses for the same reason: a boundary a flag can override is not a boundary. Nothing was ` +
      `imported. (A pack MAY declare a tier for a category name this build does not have; there ` +
      `it can override nothing, and the config resolver requires it.)`;
  }
  if (key === 'agentEdits') {
    return `my_context: this pack sets categories.${name}.agentEdits, and a pack may not, on any ` +
      `category name. agentEdits decides whether an agent's edit applies to your corpus straight ` +
      `away or waits for a human to review it, so it is the trust boundary itself rather than a ` +
      `setting near it. A category this build does not have needs no value from a pack either: ` +
      `its tier already decides it — normative reviews, rationale allows. Nothing was imported.`;
  }
  if (key === 'description') {
    if (!known) return null;
    return `my_context: this pack sets categories.${name}.description, and "${name}" is a category ` +
      `this build already has. A pack may name knowledge this build has never heard of; it may ` +
      `not re-describe knowledge it has, because the description is what your own build tells ` +
      `every agent that category means. Nothing was imported.`;
  }
  if (key === 'enabled') {
    if (value === true) return null;
    return `my_context: this pack sets categories.${name}.enabled to ${json(value)}, and a pack ` +
      `may only set it to true. A pack adds vocabulary; any other value switches the category ` +
      `off, which stops every item in it being injected at all — a pack silencing a corpus ` +
      `rather than adding to one. Nothing was imported.`;
  }
  if (key === 'prefix' || key === 'scopePolicy') return null;
  return `my_context: this pack sets categories.${name}.${key}, which is not a key a pack may ` +
    `carry for a category this build ${known ? 'already has' : 'does not have'}. For such a ` +
    `category a pack may set: ${(known ? PACK_KEYS_EXISTING : PACK_KEYS_NEW).join(', ')}. ` +
    `Nothing was imported.`;
}

/**
 * The value grammars, asked of the module that owns them rather than restated.
 *
 * Resolving the pack's entry ALONE is what makes the question answerable
 * without the importer's own config: a name that does not resolve here does
 * not resolve in an empty config either, so the resolver reaches exactly the
 * branch this pack would reach on arrival. The message is re-voiced with the
 * pack named and its whitespace collapsed, because a report prints one refusal
 * per line and `core/config.ts` writes for a thrown error.
 */
function refuseByResolver(name: string, value: unknown): string | null {
  try {
    resolveConfig({ categories: { [name]: value } });
    return null;
  } catch (err) {
    const because = (err instanceof Error ? err.message : String(err))
      .replace(/^my_context:\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
    return `my_context: this pack's config.json would not load here: ${because} Nothing was imported.`;
  }
}

/**
 * Every reason this pack's config may not be merged, in one list, or empty.
 *
 * `local` is the importing build's RESOLVED config rather than a bare name
 * predicate, because §6n.1 needs the names it already has and the prefix
 * report needs the prefixes those names already hold — and one argument that
 * carries both cannot go out of step with itself. `resolveConfig({})` is a
 * legal value for it, and is how a build that has never heard of a given name
 * is constructed in a test.
 *
 * Order: the top-level keys, then the categories in the order the pack wrote
 * them, then one verdict per key of each entry. A category that has already
 * produced a refusal is not also resolved, so no input is refused twice.
 */
export function refusePackConfig(raw: unknown, local: Config): string[] {
  if (!isObject(raw)) {
    return [
      `my_context: this pack's config.json is ${json(raw)}, not an object. A pack's config is a ` +
      `JSON object carrying one key, "categories". Nothing was imported.`,
    ];
  }

  const refusals: string[] = [];
  for (const key of Object.keys(raw)) {
    if (key !== 'categories') refusals.push(refuseTopLevel(key));
  }

  const rawCategories = raw.categories;
  if (rawCategories === undefined) return refusals;
  if (!isObject(rawCategories)) {
    refusals.push(
      `my_context: this pack's config.json has "categories" = ${json(rawCategories)}, which is ` +
      `not an object. Expected e.g. {"categories": {"rule": {"enabled": true}}}. Nothing was ` +
      `imported.`,
    );
    return refusals;
  }

  /** UPPER-CASED prefix -> the category holding it. `makeId` upper-cases, so
   *  "Rule" and "RULE" mint the same ids and must collide with each other. */
  const prefixOwners = new Map<string, string>();
  for (const category of Object.values(local.categories)) {
    prefixOwners.set(category.prefix.toUpperCase(), category.name);
  }

  for (const [name, value] of Object.entries(rawCategories)) {
    const before = refusals.length;
    if (name === '__proto__') {
      refusals.push(
        `my_context: this pack declares a category named "__proto__", which this product will ` +
        `not write into a config file: assigning that name walks an object's prototype chain ` +
        `instead of adding a member, so the category would vanish from the file it was merged ` +
        `into and leave a stranger's object as that file's prototype. Nothing was imported.`,
      );
      continue;
    }
    const known = Object.hasOwn(local.categories, name);
    if (isObject(value)) {
      for (const key of Object.keys(value)) {
        const refusal = refuseCategoryKey(name, key, value[key], known);
        if (refusal !== null) refusals.push(refusal);
      }
      if (typeof value.prefix === 'string') {
        const holder = prefixOwners.get(value.prefix.toUpperCase());
        if (holder !== undefined && holder !== name) {
          refusals.push(
            `my_context: this pack sets categories.${name}.prefix to ${json(value.prefix)}, and ` +
            `"${holder}" already mints ids with that prefix here. An id is "PREFIX-slug" and the ` +
            `prefix is upper-cased when it is minted, so two categories sharing one prefix ` +
            `collide across categories — the pack's items and yours would compete for the same ` +
            `names. Nothing was imported.`,
          );
        }
      }
    }
    // Only when nothing above decided: the resolver refuses several of the
    // same inputs for reasons of its own, and two sentences about one key
    // read as two problems.
    if (refusals.length > before) continue;
    const refusal = refuseByResolver(name, value);
    if (refusal !== null) refusals.push(refusal);
  }
  return refusals;
}

/**
 * A pack's categories, merged FIELD-WISE into a config that already exists.
 *
 * Never a replacement, at either level. Every top-level key the existing file
 * carries survives untouched **by construction** — the merge starts from a
 * clone of it and only ever writes inside `categories` — which is what keeps
 * `budgets`, `watchedDocs` and a key written by a NEWER build (R14.2) intact
 * across an import that rewrites the file. A merge that rebuilt the object
 * from the keys this build understands would delete the last of those, which
 * is the silent drop R14.2 exists to stop, reached from the writing side.
 *
 * Inside a category the same rule again: each permitted field is assigned
 * individually onto the entry that is there, so a pack adding `prefix` to a
 * category the importer configured with `extraFields` leaves the `extraFields`
 * alone. An entry the pack does not name is not touched at all.
 *
 * Only the five permitted fields are copied, and `enabled` only when it is
 * exactly `true`. `refusePackConfig` is what TELLS a user about the rest; this
 * is what holds if a caller ever forgets to ask, because a boundary that is
 * enforced only in the sentence a caller may skip is not a boundary.
 */
export function mergePackConfig(existingRaw: unknown, packRaw: unknown): RawConfigJson {
  if (existingRaw !== undefined && existingRaw !== null && !isObject(existingRaw)) {
    throw new Error(
      `my_context: the workspace config a pack would merge into is ${json(existingRaw)}, not an ` +
      `object. Nothing was merged — a config that cannot be read is not a config a pack may be ` +
      `written into.`,
    );
  }
  const merged = (isObject(existingRaw) ? structuredClone(existingRaw) : {}) as RawConfigJson;
  if (!isObject(merged.categories)) {
    // Absent is the ordinary case for a freshly initialised workspace. A
    // present-but-unreadable `categories` is replaced rather than merged into,
    // and it cannot reach here from a loaded workspace: `resolveConfig`
    // refuses that file before anything asks for a merge.
    setKey(merged as Record<string, unknown>, 'categories', {});
  }
  const categories = merged.categories;

  const packCategories = isObject(packRaw) && isObject(packRaw.categories) ? packRaw.categories : {};
  for (const [name, entry] of Object.entries(packCategories)) {
    if (!isObject(entry)) continue;
    let target: RawCategoryJson;
    if (Object.hasOwn(categories, name) && isObject(categories[name])) {
      target = categories[name];
    } else {
      target = {};
      setKey(categories, name, target);
    }
    for (const field of MERGED_FIELDS) {
      if (!Object.hasOwn(entry, field)) continue;
      const value = entry[field];
      if (field === 'enabled' && value !== true) continue;
      setKey(target as Record<string, unknown>, field, value);
    }
  }
  return merged;
}
