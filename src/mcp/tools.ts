import { existsSync } from 'node:fs';
import { renderItem } from '../core/item.ts';
import {
  createItem, linkItems, supersedeItem, updateItem, withRetry,
  type MutationContext,
} from '../core/mutate.ts';
import { extraFieldNames, resolveConfig, type Config } from '../core/config.ts';
import { buildInjection } from '../core/inject.ts';
import { matchesAnyGlob, normalizePosix } from '../core/paths.ts';
import { loadErrorNote, rebuild } from '../core/rebuild.ts';
import { Store } from '../core/store.ts';
import { enumError, missingFieldError, unknownIdError } from '../core/teach.ts';
import type { Item, Observation, Severity, Status } from '../core/types.ts';
import { resolveWorkspace } from '../core/workspace.ts';
import { exampleItem, helpTopic, toolDescriptions } from '../help/index.ts';
import { INGEST_DOCUMENT_SCHEMA, runIngestDocument } from './tools/ingest.ts';
import type { ToolDefinition, ToolRegistry } from './protocol.ts';

const STATUSES = ['active', 'draft', 'superseded', 'deprecated', 'validated'];
const SEVERITIES = ['hard', 'soft'];

type Args = Record<string, unknown>;

function str(args: Args, key: string, tool: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(missingFieldError(key, tool, 'capture'));
  }
  return value;
}

/**
 * Absent keys are fine — every field on this whole surface (`optStr`,
 * `optBool`, `optNum`, `optList`, `optEnum`, `optObservations`, `optExtra`)
 * is optional, and an explicit JSON `null` is treated the same as absent
 * everywhere: it is a common way a model spells "not set", not a
 * wrong-typed value — the same reading `optObservations`'s per-entry
 * `context: null` already relies on one level down. A *present, non-null*
 * key of the wrong type is not fine: silently ignoring it (the previous
 * behaviour) reports success while changing nothing, e.g.
 * `update_item({title: 12345})` returned "updated" without ever touching
 * the title. Every helper below applies that same reasoning to its own
 * shape — scalars, arrays, enums, or the observations/extra objects.
 */
function optStr(args: Args, key: string): string | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new Error(`my_context: "${key}" must be a string. You passed ${JSON.stringify(value)}.`);
  }
  return value;
}

function optBool(args: Args, key: string): boolean | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') {
    throw new Error(`my_context: "${key}" must be a boolean. You passed ${JSON.stringify(value)}.`);
  }
  return value;
}

/** `undefined` or explicit `null` keeps the caller's fallback; a
 * present-and-non-null but invalid `limit` (non-number, zero, negative,
 * non-finite) is refused rather than silently replaced by the fallback, for
 * the same reason `optStr`/`optBool` refuse. */
function optNum(args: Args, key: string, fallback: number): number {
  const value = args[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`my_context: "${key}" must be a positive number. You passed ${JSON.stringify(value)}.`);
  }
  return value;
}

/**
 * Arrays are validated rather than coerced. A model that passes a bare string
 * for `scope` has misunderstood the field, and silently wrapping it produces a
 * plausible-looking item with a glob that never matches. `null` is absent,
 * same as every other optional field on this surface — only a genuinely
 * wrong type (a string, a number, an array with a non-string element) throws.
 */
function optList(args: Args, key: string): string[] | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new Error(
      `my_context: "${key}" must be an array of strings, e.g. ["src/db/**"]. ` +
      `See mycontext_help("scope").`,
    );
  }
  return value as string[];
}

/** `null` is absent, same as every other optional field on this surface —
 * only a present value that is not a string, or not a member of `allowed`,
 * is a genuine enum violation. */
function optEnum<T extends string>(
  args: Args, key: string, allowed: string[], topic: 'categories' | 'workflow' | 'capture',
): T | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Error(enumError(key, String(value), allowed, topic));
  }
  return value as T;
}

/**
 * `category` and `text` are required strings, not defaulted or coerced: a
 * missing `category` silently becoming `'note'`, or a non-string `text`
 * silently going through `String()`, is the same plausible-looking-but-wrong
 * outcome `optStr`/`optBool` refuse above — an observation the model thinks
 * it wrote correctly is instead stored as something else entirely.
 * `observations: null` (the whole field) is absent, same as every other
 * optional field on this surface; a per-entry `context: null` below is a
 * different, deliberate case — see that check — and is left exactly as is.
 */
function optObservations(args: Args): Observation[] | undefined {
  const value = args.observations;
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new Error(
      'my_context: "observations" must be an array of ' +
      '{ category, text } objects. See mycontext_help("capture").',
    );
  }
  return value.map((raw, i) => {
    const entry = (raw ?? {}) as Record<string, unknown>;
    if (typeof entry.category !== 'string' || entry.category.trim() === '') {
      throw new Error(
        `my_context: observations[${i}] is missing "category", a required string. ` +
        `See mycontext_help("capture").`,
      );
    }
    if (typeof entry.text !== 'string' || entry.text.trim() === '') {
      throw new Error(
        `my_context: observations[${i}] is missing "text", a required string. ` +
        `See mycontext_help("capture").`,
      );
    }
    if (entry.tags !== undefined && (!Array.isArray(entry.tags) || entry.tags.some((t) => typeof t !== 'string'))) {
      throw new Error(`my_context: observations[${i}].tags must be an array of strings.`);
    }
    if (entry.context !== undefined && entry.context !== null && typeof entry.context !== 'string') {
      throw new Error(`my_context: observations[${i}].context must be a string.`);
    }
    return {
      category: entry.category,
      text: entry.text,
      tags: (entry.tags as string[] | undefined) ?? [],
      context: (entry.context as string | undefined) ?? null,
    };
  });
}

/** `update_item`'s `extra` merges into the item's existing extra fields
 * (`mutate.ts`'s `updateItem` does the merge and validates keys/collisions);
 * this only checks the shape at the boundary — an object of string values.
 * An explicit `extra: null` is treated the same as omitting `extra`
 * entirely, same as every other optional field here. */
function optExtra(args: Args): Record<string, string> | undefined {
  const value = args.extra;
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(
      'my_context: "extra" must be an object of string values, e.g. {"kind": "functional"}. ' +
      'See mycontext_help("capture").',
    );
  }
  const out: Record<string, string> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v !== 'string') {
      throw new Error(`my_context: "extra.${key}" must be a string. You passed ${JSON.stringify(v)}.`);
    }
    out[key] = v;
  }
  return out;
}

/**
 * Open the workspace, refresh the index from Markdown, run, close. The rebuild
 * is per call by design: the CLI, the hooks and other sessions write the same
 * files, and a cached index would hand the model stale answers.
 */
function withWorkspace(cwd: string, fn: (ctx: MutationContext) => string): string {
  const ws = resolveWorkspace(cwd);
  if (!ws.projectRoot) {
    throw new Error(
      `my_context: there is no .my_context workspace at or above ${cwd}. ` +
      `Ask the user to run \`mycontext init\` in the repository root.`,
    );
  }
  // A plain local, not `ws.projectRoot` repeated: narrowing a property access
  // does not survive into the `withRetry` closure below, so re-reading
  // `ws.projectRoot` there would widen back to `string | null` and force a
  // pointless `?? undefined` — this one binding stays `string` everywhere.
  const projectRoot = ws.projectRoot;

  const store = Store.open(ws.dbPath);
  try {
    // rebuild() takes the resolved config as a required third argument — it
    // needs it to tell items whose declared type is not defined in
    // config.categories at all (a typo, or a category removed from config)
    // — see rebuild.ts's loadLayer, which reports exactly that case, not a
    // merely-disabled one (a disabled category is still present in config
    // and produces no LoadError here).
    const { errors } = withRetry(() => rebuild(store, {
      project: projectRoot,
      global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined,
    }, ws.config));
    return fn({ root: projectRoot, store, config: ws.config }) + loadErrorNote(errors);
  } finally {
    try { store.close(); } catch { /* nothing left to do */ }
  }
}

function line(item: Item): string {
  const scope = item.scope.length ? ` · scope ${item.scope.join(' ')}` : '';
  return `${item.id} · ${item.type} · ${item.status} · ${item.title}${scope}`;
}

function listOf(items: Item[], limit: number, empty: string): string {
  if (items.length === 0) return empty;
  const shown = items.slice(0, limit).map(line);
  if (items.length > limit) {
    shown.push(`… ${items.length - limit} more. Narrow the filter or raise "limit".`);
  }
  return shown.join('\n');
}

function requireItem(ctx: MutationContext, id: string): Item {
  const item = ctx.store.get(id);
  if (!item) throw new Error(unknownIdError(id, ctx.store.all().map((i) => i.id)));
  return item;
}

interface ToolSpec {
  name: string;
  schema: Record<string, unknown>;
  run(cwd: string, args: Args): string;
}

function object(
  properties: Record<string, unknown>, required: string[] = [],
): Record<string, unknown> {
  return { type: 'object', properties, required };
}

const S_STRING = { type: 'string' };
const S_STRINGS = { type: 'array', items: { type: 'string' } };

/**
 * Hand-written value hints for the extra fields, keyed by field name. Purely
 * cosmetic: the SET of extra fields comes from the config (see
 * `extraFieldNames`), and a field with no hint here still appears in the
 * schema with a generated description. A missing hint therefore costs a
 * slightly vaguer description, never a dropped field — which is the failure
 * mode the hardcoded list used to have.
 */
const EXTRA_FIELD_HINTS: Record<string, string> = {
  kind: 'functional | non_functional',
  directive: 'do | dont',
  likelihood: 'e.g. low | medium | high',
  impact: 'e.g. low | medium | high',
  validate_by: 'a date to revisit it',
  validated_on: 'the date it was confirmed',
  blocks: 'what this question is blocking',
};

/**
 * The `<field>: {type, description}` schema properties for every extra field
 * the category table declares, with "Typically <categories>" derived from
 * which categories actually declare it — so renaming or re-homing a field in
 * `categories.ts` updates the advertised description too.
 */
function extraFieldSchema(config: Config): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const field of extraFieldNames(config)) {
    const owners = Object.values(config.categories)
      .filter((c) => c.extraFields.includes(field))
      .map((c) => c.name)
      .sort();
    const hint = EXTRA_FIELD_HINTS[field];
    props[field] = {
      ...S_STRING,
      description: `Typically ${owners.join(', ')}${hint ? `: ${hint}` : ''}`,
    };
  }
  return props;
}

/**
 * The schema is static (it must be byte-stable across calls for prompt
 * caching, and `tools/list` is answered before any workspace is known), so it
 * is built from the DEFAULT resolved config — which contains every built-in
 * category regardless of profile, and therefore every built-in extra field.
 * A project-defined custom category carries no `extraFields` of its own (see
 * `resolveConfig`), so this cannot fall behind a project's config.
 */
const DEFAULT_CONFIG = resolveConfig({});

const SPECS: ToolSpec[] = [
  {
    name: 'create_item',
    schema: object({
      type: { ...S_STRING, description: 'Category — see mycontext_help("categories")' },
      title: { ...S_STRING, description: 'One sentence, the item as a claim' },
      body: { ...S_STRING, description: 'Why it holds' },
      scope: { ...S_STRINGS, description: 'Repo-relative globs — see mycontext_help("scope")' },
      tags: S_STRINGS,
      severity: { ...S_STRING, enum: SEVERITIES },
      always: { type: 'boolean', description: 'Inject at every session start' },
      observations: {
        type: 'array',
        items: object({ category: S_STRING, text: S_STRING }, ['category', 'text']),
      },
      source_file: { ...S_STRING, description: 'Document this came from' },
      source_anchor: { ...S_STRING, description: 'Heading within that document' },
      ...extraFieldSchema(DEFAULT_CONFIG),
    }, ['type', 'title']),
    // origin is never accepted from the schema above. Every handler that
    // writes on an agent's behalf — create_item, update_item, supersede_item
    // — passes origin: 'agent' itself, so an argument the model could set
    // would make the whole trust boundary advisory. link_items is the one
    // exception, and it cannot be otherwise: `LinkInput` has no `origin` at
    // all, because adding a relation crosses no trust boundary — `linkItems`
    // never touches status, severity, scope, always or the item's body.
    run: (cwd, args) => withWorkspace(cwd, (ctx) => {
      const extra: Record<string, string> = {};
      // Driven from the resolved config, not a literal: see `extraFieldNames`.
      for (const key of extraFieldNames(ctx.config)) {
        const value = optStr(args, key);
        if (value !== undefined) extra[key] = value;
      }
      return createItem(ctx, {
        type: str(args, 'type', 'create_item'),
        title: str(args, 'title', 'create_item'),
        body: optStr(args, 'body'),
        scope: optList(args, 'scope'),
        tags: optList(args, 'tags'),
        severity: optEnum<Severity>(args, 'severity', SEVERITIES, 'capture'),
        always: optBool(args, 'always'),
        observations: optObservations(args),
        sourceFile: optStr(args, 'source_file') ?? null,
        sourceAnchor: optStr(args, 'source_anchor') ?? null,
        extra,
        origin: 'agent',
      }).message;
    }),
  },
  {
    name: 'update_item',
    schema: object({
      id: S_STRING,
      title: S_STRING,
      body: S_STRING,
      scope: S_STRINGS,
      tags: S_STRINGS,
      severity: { ...S_STRING, enum: SEVERITIES },
      always: { type: 'boolean' },
      status: { ...S_STRING, enum: STATUSES, description: 'Rationale items only' },
      extra: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: 'Category-specific fields to merge in, e.g. kind, directive, likelihood',
      },
    }, ['id']),
    run: (cwd, args) => withWorkspace(cwd, (ctx) => updateItem(ctx, {
      id: str(args, 'id', 'update_item'),
      title: optStr(args, 'title'),
      body: optStr(args, 'body'),
      scope: optList(args, 'scope'),
      tags: optList(args, 'tags'),
      severity: optEnum<Severity>(args, 'severity', SEVERITIES, 'capture'),
      always: optBool(args, 'always'),
      status: optEnum<Status>(args, 'status', STATUSES, 'workflow'),
      extra: optExtra(args),
      origin: 'agent',
    }).message),
  },
  {
    name: 'supersede_item',
    schema: object({
      id: { ...S_STRING, description: 'The item being retired' },
      by: { ...S_STRING, description: 'The replacement, which must already exist' },
      reason: S_STRING,
    }, ['id', 'by']),
    // origin: 'agent' here is load-bearing, not cosmetic: supersedeItem
    // refuses to let an agent retire a normative item that currently governs
    // (active or validated) — the exact security boundary updateItem's
    // status rule exists to protect. Defaulting to 'human' here (as the
    // omitted argument would) bypasses that guard entirely.
    run: (cwd, args) => withWorkspace(cwd, (ctx) => supersedeItem(ctx, {
      id: str(args, 'id', 'supersede_item'),
      by: str(args, 'by', 'supersede_item'),
      reason: optStr(args, 'reason'),
      origin: 'agent',
    }).message),
  },
  {
    name: 'link_items',
    schema: object({
      from: S_STRING,
      to: S_STRING,
      relation: { ...S_STRING, description: 'See mycontext_help("workflow")' },
    }, ['from', 'to', 'relation']),
    run: (cwd, args) => withWorkspace(cwd, (ctx) => linkItems(ctx, {
      from: str(args, 'from', 'link_items'),
      to: str(args, 'to', 'link_items'),
      relation: str(args, 'relation', 'link_items'),
    }).message),
  },
  {
    name: 'get_item',
    schema: object({ id: S_STRING }, ['id']),
    run: (cwd, args) => withWorkspace(cwd, (ctx) =>
      renderItem(requireItem(ctx, str(args, 'id', 'get_item')))),
  },
  {
    name: 'query_items',
    schema: object({
      type: S_STRING,
      status: { ...S_STRING, enum: STATUSES },
      tag: S_STRING,
      text: { ...S_STRING, description: 'Substring of the title or body' },
      path: { ...S_STRING, description: 'Repo-relative file path; matches item scopes' },
      relation: { ...S_STRING, description: 'Items carrying this relation type' },
      limit: { type: 'number' },
    }),
    run: (cwd, args) => withWorkspace(cwd, (ctx) => {
      const type = optStr(args, 'type');
      const status = optEnum<Status>(args, 'status', STATUSES, 'workflow');
      const tag = optStr(args, 'tag');
      const text = optStr(args, 'text')?.toLowerCase();
      const subject = optStr(args, 'path');
      const relation = optStr(args, 'relation');

      const hits = ctx.store.all().filter((item) => {
        if (type && item.type !== type) return false;
        if (status && item.status !== status) return false;
        if (tag && !item.tags.includes(tag)) return false;
        if (relation && !item.relations.some((r) => r.type === relation)) return false;
        if (subject && !matchesAnyGlob(normalizePosix(subject), item.scope)) return false;
        if (text && !`${item.title}\n${item.body}`.toLowerCase().includes(text)) return false;
        return true;
      });

      return listOf(
        hits, optNum(args, 'limit', 20),
        'my_context: no items match that query. Try fewer filters, or ' +
        'mycontext_help("categories") to check the type name.',
      );
    }),
  },
  {
    name: 'list_drafts',
    schema: object({ type: S_STRING, limit: { type: 'number' } }),
    // Newest first, as the tool description promises — `store.all()` comes
    // back `ORDER BY id`, which is alphabetical, not chronological.
    // `validFrom` is day-granularity, so items captured the same day sort
    // only by id (ascending, for determinism), not by time of day.
    run: (cwd, args) => withWorkspace(cwd, (ctx) => {
      const type = optStr(args, 'type');
      const drafts = ctx.store.all()
        .filter((i) => i.status === 'draft' && (!type || i.type === type))
        .sort((a, b) => {
          const byDate = (b.validFrom ?? '').localeCompare(a.validFrom ?? '');
          return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
        });
      return listOf(
        drafts, optNum(args, 'limit', 20),
        'my_context: no drafts are waiting for review.',
      );
    }),
  },
  {
    name: 'load_context',
    // No properties at all, and none may be added: the one argument this
    // tool could plausibly want is a session id, and the model has no way to
    // know it — it would have to invent one, and a fabricated ledger key is
    // exactly the silent corruption `buildInjection` refuses. See the note
    // there on why the manual path records nothing.
    schema: object({}),
    // Deliberately NOT wrapped in `withWorkspace`: this is a read path that
    // must not behave like a mutation. `buildInjection` does its own
    // workspace resolution and rebuild, and fails open with '' — the same
    // text SessionStart would have produced, produced by the same code.
    run: (cwd) => buildInjection(cwd, { event: 'manual' }) || (
      `my_context: nothing to inject. Either there is no .my_context workspace ` +
      `at or above ${cwd} — ask the user to run \`mycontext init\` — or nothing ` +
      `has been captured in it yet. See mycontext_help("capture").`
    ),
  },
  {
    name: 'mycontext_help',
    schema: object({
      topic: { ...S_STRING, enum: ['categories', 'scope', 'capture', 'workflow'] },
    }, ['topic']),
    // Help must work without a workspace: not knowing what a category is and
    // not having a workspace are the same moment.
    run: (cwd, args) => helpTopic(
      str(args, 'topic', 'mycontext_help'), resolveWorkspace(cwd).config,
    ),
  },
  {
    name: 'mycontext_examples',
    schema: object({ type: S_STRING }, ['type']),
    run: (cwd, args) => exampleItem(
      str(args, 'type', 'mycontext_examples'), resolveWorkspace(cwd).config,
    ),
  },
  {
    name: 'ingest_document',
    schema: INGEST_DOCUMENT_SCHEMA,
    // No `origin` argument, here or in the schema: applyCandidates writes as
    // 'ingest' and asserts the result is a draft. See create_item's note above.
    run: (cwd, args) => withWorkspace(cwd, (ctx) => runIngestDocument(ctx, args)),
  },
];

/** Sorted so tools/list is byte-stable across calls, which prompt caching needs. */
const SORTED = [...SPECS].sort((a, b) => a.name.localeCompare(b.name));

export const TOOL_NAMES = SORTED.map((spec) => spec.name);

export function createRegistry(cwd: string): ToolRegistry {
  const descriptions = toolDescriptions();

  const definitions: ToolDefinition[] = SORTED.map((spec) => {
    const description = descriptions[spec.name];
    if (!description) {
      throw new Error(
        `my_context: tool "${spec.name}" has no description in ` +
        `src/help/topics/capture.md. Tool descriptions have exactly one source.`,
      );
    }
    return { name: spec.name, description, inputSchema: spec.schema };
  });

  const byName = new Map(SORTED.map((spec) => [spec.name, spec]));

  return {
    list: () => definitions,
    call: (name, args) => {
      const spec = byName.get(name);
      if (!spec) throw new Error(enumError('tool', name, TOOL_NAMES, 'capture'));
      return spec.run(cwd, args);
    },
  };
}
