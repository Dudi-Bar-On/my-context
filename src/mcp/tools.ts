import { existsSync } from 'node:fs';
import { renderItem } from '../core/item.ts';
import {
  createItem, linkItems, supersedeItem, updateItem, withRetry,
  type MutationContext,
} from '../core/mutate.ts';
import { matchesAnyGlob, normalizePosix } from '../core/paths.ts';
import { rebuild } from '../core/rebuild.ts';
import { Store } from '../core/store.ts';
import { enumError, missingFieldError, unknownIdError } from '../core/teach.ts';
import type { Item, Observation, Severity, Status } from '../core/types.ts';
import { resolveWorkspace } from '../core/workspace.ts';
import { exampleItem, helpTopic, toolDescriptions } from '../help/index.ts';
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

function optStr(args: Args, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' ? value : undefined;
}

function optBool(args: Args, key: string): boolean | undefined {
  const value = args[key];
  return typeof value === 'boolean' ? value : undefined;
}

function optNum(args: Args, key: string, fallback: number): number {
  const value = args[key];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Arrays are validated rather than coerced. A model that passes a bare string
 * for `scope` has misunderstood the field, and silently wrapping it produces a
 * plausible-looking item with a glob that never matches.
 */
function optList(args: Args, key: string): string[] | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new Error(
      `my_context: "${key}" must be an array of strings, e.g. ["src/db/**"]. ` +
      `See mycontext_help("scope").`,
    );
  }
  return value as string[];
}

function optEnum<T extends string>(
  args: Args, key: string, allowed: string[], topic: 'categories' | 'workflow' | 'capture',
): T | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Error(enumError(key, String(value), allowed, topic));
  }
  return value as T;
}

function optObservations(args: Args): Observation[] | undefined {
  const value = args.observations;
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error(
      'my_context: "observations" must be an array of ' +
      '{ category, text } objects. See mycontext_help("capture").',
    );
  }
  return value.map((raw) => {
    const entry = (raw ?? {}) as Record<string, unknown>;
    return {
      category: typeof entry.category === 'string' ? entry.category : 'note',
      text: typeof entry.text === 'string' ? entry.text : String(entry.text ?? ''),
      tags: Array.isArray(entry.tags) ? (entry.tags as string[]) : [],
      context: typeof entry.context === 'string' ? entry.context : null,
    };
  });
}

/**
 * Open the workspace, refresh the index from Markdown, run, close. The rebuild
 * is per call by design: the CLI, the hooks and other sessions write the same
 * files, and a cached index would hand the model stale answers.
 */
function withWorkspace<T>(cwd: string, fn: (ctx: MutationContext) => T): T {
  const ws = resolveWorkspace(cwd);
  if (!ws.projectRoot) {
    throw new Error(
      `my_context: there is no .my_context workspace at or above ${cwd}. ` +
      `Ask the user to run \`mycontext init\` in the repository root.`,
    );
  }

  const store = Store.open(ws.dbPath);
  try {
    // rebuild() takes the resolved config as a required third argument — it
    // needs it to tell an unknown category from a disabled one when it
    // reports a LoadError for an item whose type config doesn't recognise.
    withRetry(() => rebuild(store, {
      project: ws.projectRoot ?? undefined,
      global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined,
    }, ws.config));
    return fn({ root: ws.projectRoot, store, config: ws.config });
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
      kind: { ...S_STRING, description: 'requirement only: functional | non_functional' },
      directive: { ...S_STRING, description: 'rule only: do | dont' },
    }, ['type', 'title']),
    // origin is never accepted from the schema above — every handler below
    // passes origin: 'agent' itself, so an argument the model could set would
    // make the whole trust boundary advisory.
    run: (cwd, args) => withWorkspace(cwd, (ctx) => {
      const extra: Record<string, string> = {};
      for (const key of ['kind', 'directive', 'likelihood', 'impact', 'validate_by']) {
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
    run: (cwd, args) => withWorkspace(cwd, (ctx) => {
      const type = optStr(args, 'type');
      const drafts = ctx.store.all()
        .filter((i) => i.status === 'draft' && (!type || i.type === type));
      return listOf(
        drafts, optNum(args, 'limit', 20),
        'my_context: no drafts are waiting for review.',
      );
    }),
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
