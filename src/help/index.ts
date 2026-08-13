import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Config, ResolvedCategory } from '../core/config.ts';
import { computeItemChecksum, renderItem } from '../core/item.ts';
import { makeId } from '../core/slug.ts';
import { enumError, type HelpTopic } from '../core/teach.ts';
import type { Item } from '../core/types.ts';

export const HELP_TOPICS: HelpTopic[] = ['categories', 'scope', 'capture', 'workflow'];

/** Declared in the docs, deliberately not registered. Plan 4 implements it. */
export const RESERVED_TOOLS = ['ingest_document'];

const TOPIC_DIR = path.join(import.meta.dirname, 'topics');

function readTopicFile(topic: string): string {
  return readFileSync(path.join(TOPIC_DIR, `${topic}.md`), 'utf8').replace(/\r\n/g, '\n');
}

function tierRank(category: ResolvedCategory): number {
  return category.tier === 'normative' ? 0 : 1;
}

/** The category table, generated from the resolved config (spec §9). */
export function categoryTable(config: Config): string {
  const rows = Object.values(config.categories)
    .filter((c) => c.enabled)
    .sort((a, b) => tierRank(a) - tierRank(b) || a.name.localeCompare(b.name))
    .map((c) => `| \`${c.name}\` | ${c.tier} | \`${c.prefix}-\` | ${c.description} |`);

  return ['| type | tier | id prefix | use for |', '|---|---|---|---|', ...rows].join('\n');
}

/**
 * `split`/`join` rather than `String.replace`: a generated table can contain
 * `$` sequences that `replace` would interpret as capture-group references.
 */
function expand(text: string, token: string, value: string): string {
  return text.split(token).join(value);
}

export function helpTopic(topic: string, config: Config): string {
  if (!HELP_TOPICS.includes(topic as HelpTopic)) {
    throw new Error(enumError('topic', topic, HELP_TOPICS, 'workflow'));
  }
  return expand(readTopicFile(topic), '{{CATEGORY_TABLE}}', categoryTable(config));
}

const TOOL_LINE = /^-\s+`([a-z_]+)`:\s+(.+)$/;

/**
 * Tool descriptions, parsed from capture.md's `## Tools` section. This is the
 * single source: Task 7 asserts the documented set equals the registered set
 * plus RESERVED_TOOLS, so neither can drift from the other. A line that
 * starts with the list marker but does not fully match `TOOL_LINE` (a name
 * with a digit or hyphen, a description wrapped onto a second line, …) is
 * refused rather than silently dropped or truncated — "nothing is dropped
 * silently" is a project invariant, and this is the one parse a later task
 * depends on being complete.
 */
export function toolDescriptions(): Record<string, string> {
  const out: Record<string, string> = {};
  let inSection = false;

  for (const line of readTopicFile('capture').split('\n')) {
    if (/^##\s+/.test(line)) {
      inSection = /^##\s+Tools\s*$/.test(line);
      continue;
    }
    if (!inSection) continue;
    const trimmed = line.trim();
    if (trimmed === '') continue;
    const match = TOOL_LINE.exec(trimmed);
    if (!match) {
      if (trimmed.startsWith('- ')) {
        throw new Error(
          `my_context: capture.md's Tools section has a line that does not match the ` +
          `expected "- \`tool_name\`: description" shape: ${JSON.stringify(trimmed)}`,
        );
      }
      continue;
    }
    out[match[1]] = match[2].trim();
  }

  return out;
}

interface Seed {
  title: string;
  body: string;
  scope?: string[];
  tags?: string[];
  severity?: 'hard' | 'soft';
  always?: boolean;
  extra?: Record<string, string>;
  observations?: { category: string; text: string; tags: string[]; context: string | null }[];
  relations?: { type: string; target: string }[];
}

const SEEDS: Record<string, Seed> = {
  constraint: {
    title: 'Postgres connection pool capped at 20',
    body: 'RDS permits 25 connections; 5 are reserved for migrations and the admin console.',
    scope: ['src/db/**', 'src/api/handlers/**'],
    tags: ['database', 'performance'],
    severity: 'hard',
    observations: [
      { category: 'limit', text: 'Pool size must never exceed 20 across all workers', tags: ['database'], context: null },
    ],
    relations: [{ type: 'derived_from', target: 'ADR-managed-postgres' }],
  },
  invariant: {
    title: 'Order total always equals the sum of its line items',
    body: 'Any divergence means a rounding or currency bug and must fail loudly.',
    scope: ['src/billing/**'],
    severity: 'hard',
  },
  rule: {
    title: 'Never log request bodies on auth endpoints',
    body: 'Bodies carry passwords and reset tokens; logs are retained for 90 days.',
    scope: ['src/api/auth/**'],
    extra: { directive: 'dont' },
  },
  requirement: {
    title: 'Users can reset their password without support',
    body: 'A one-time link is emailed and expires after 30 minutes.',
    scope: ['src/api/auth/**'],
    extra: { kind: 'functional' },
  },
  standard: {
    title: 'Every exported function carries a doc comment',
    body: 'Internal helpers do not need one; the public surface does.',
    scope: ['src/**/*.ts'],
  },
  pattern: {
    title: 'Repository objects wrap every query, handlers never open a connection',
    body: 'Keeps pool accounting in one place and makes the pool cap enforceable.',
    scope: ['src/db/**'],
  },
  glossary: {
    title: 'Tenant means a paying organisation, not a user',
    body: 'Say "tenant" for the billing entity and "member" for a person inside it. Never "account".',
  },
  instruction: {
    title: 'Run the test suite before proposing a change is complete',
    body: 'A claim of completion without a test run has been wrong often enough to be a rule.',
    always: true,
  },
  non_goal: {
    title: 'We are not building offline support',
    body: 'Every client is assumed online. Do not add local queues or sync reconciliation.',
  },
  open_question: {
    title: 'Do we shard by tenant or by region?',
    body: 'Both are viable; the decision waits on Q3 traffic data. Do not assume either.',
  },
  adr: {
    title: 'Use SQLite with JSONB for the local index',
    body: 'Context, drivers, considered options and consequences follow the MADR shape.',
    observations: [
      { category: 'driver', text: 'Zero runtime dependencies is non-negotiable', tags: [], context: null },
      { category: 'option', text: 'Rejected: an embedded document store, which adds a dependency', tags: [], context: null },
      { category: 'consequence', text: 'Requires Node 24 for stable node:sqlite', tags: [], context: null },
    ],
  },
  decision: {
    title: 'Slug ids rather than sequential ids',
    body: 'Sequential ids collide on branch merge; slugs are self-describing when cited.',
  },
  lesson: {
    title: 'Migrations need an advisory lock',
    body: 'Two deploys ran migrations concurrently and left the schema half-applied.',
    observations: [
      { category: 'symptom', text: 'Duplicate column errors on the second deploy', tags: [], context: null },
    ],
  },
  tradeoff: {
    title: 'Hand-written YAML subset instead of a parser dependency',
    body: 'Bought zero dependencies and fast startup; cost is that unsupported syntax throws.',
  },
  assumption: {
    title: 'Peak traffic stays under 500 requests per second',
    body: 'Based on the last two quarters. The pool cap depends on it.',
    extra: { validate_by: '2026-12-01' },
  },
  edge_case: {
    title: 'Checkout with an empty cart',
    body: 'Reachable via a stale tab. Must return 409, not a 500 from the totals code.',
  },
  risk: {
    title: 'Vendor rate limit could throttle bulk imports',
    body: 'The importer has no backoff today.',
    extra: { likelihood: 'medium', impact: 'high' },
    relations: [{ type: 'mitigates', target: 'CONST-import-batch-size' }],
  },
};

function seedFor(category: ResolvedCategory): Seed {
  return SEEDS[category.name] ?? {
    title: `Example ${category.name.replace(/_/g, ' ')}`,
    body: `${category.description}. Replace this body with the real content and reason.`,
  };
}

/** A complete, correct item of the given type, rendered exactly as it is stored. */
export function exampleItem(type: string, config: Config): string {
  const category = config.categories[type];
  if (!category) {
    throw new Error(enumError('type', type, Object.keys(config.categories), 'categories'));
  }

  const seed = seedFor(category);
  const id = makeId(category.prefix, seed.title);

  const item: Item = {
    id,
    type: category.name,
    title: seed.title,
    status: 'active',
    severity: seed.severity ?? 'soft',
    always: seed.always ?? false,
    scope: seed.scope ?? [],
    tags: seed.tags ?? [],
    origin: 'human',
    sourceFile: null,
    sourceAnchor: null,
    sourceChecksum: null,
    validFrom: '2026-08-14',
    validUntil: null,
    checksum: '',
    extra: seed.extra ?? {},
    body: seed.body,
    observations: seed.observations ?? [],
    relations: seed.relations ?? [],
    layer: 'project',
    filePath: `items/${category.name}/${id}.md`,
  };
  item.checksum = computeItemChecksum(item);

  return renderItem(item);
}
