import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Config, ResolvedCategory } from '../core/config.ts';
import { computeItemChecksum, renderItem } from '../core/item.ts';
import { makeId } from '../core/slug.ts';
import { enumError, type HelpTopic } from '../core/teach.ts';
import type { Item } from '../core/types.ts';

export const HELP_TOPICS: HelpTopic[] = ['categories', 'scope', 'capture', 'workflow'];

/** Documented but deliberately not registered. Empty now that Plan 4 implements
 * ingest_document; keep the export — it is what lets a tool be documented ahead
 * of its implementation without breaking the documented-set-equals-known-set test. */
export const RESERVED_TOOLS: string[] = [];

const TOPIC_DIR = path.join(import.meta.dirname, 'topics');

function readTopicFile(topic: string): string {
  return readFileSync(path.join(TOPIC_DIR, `${topic}.md`), 'utf8').replace(/\r\n/g, '\n');
}

/**
 * The raw text of capture.md. Exported so a test can build a MODIFIED COPY
 * and hand it to `toolDescriptions(source)` — see the note there — instead of
 * writing to the tracked file.
 */
export function captureTopicSource(): string {
  return readTopicFile('capture');
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
 * plus RESERVED_TOOLS, so neither can drift from the other.
 *
 * `source` overrides the text parsed, defaulting to capture.md itself. It
 * exists so the malformed-line tests can exercise this parser against a
 * string instead of temporarily rewriting `src/help/topics/capture.md` — a
 * TRACKED SOURCE FILE the shipped product reads at runtime. `node --test`
 * runs test files concurrently, so a test that corrupted it for even a few
 * milliseconds could be observed by any other test (or child process) that
 * calls `createRegistry`, and a suite killed mid-test would leave the
 * corrupted file behind in the working tree. No test may write to `src/`.
 *
 * Every non-blank line inside the section must be a well-formed
 * `- \`tool_name\`: description` line — a blank line is fine, and a `##`
 * heading ends the section as it always did, but anything else (a malformed
 * name, or a description wrapped onto a second line) throws rather than
 * being silently dropped or silently truncated. A wrapped-continuation line
 * does not start with `- `, so it cannot be caught by checking only lines
 * that do; requiring every non-blank line to match is what actually closes
 * that gap. "Nothing is dropped silently" is a project invariant, and this
 * is the one parse a later task depends on being complete.
 */
export function toolDescriptions(source?: string): Record<string, string> {
  const out: Record<string, string> = {};
  let inSection = false;

  const text = source ?? readTopicFile('capture');
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (/^##\s+/.test(line)) {
      inSection = /^##\s+Tools\s*$/.test(line);
      continue;
    }
    if (!inSection) continue;
    const trimmed = line.trim();
    if (trimmed === '') continue;
    const match = TOOL_LINE.exec(trimmed);
    if (!match) {
      throw new Error(
        `my_context: capture.md's Tools section has a line that does not match the ` +
        `expected "- \`tool_name\`: description" shape: ${JSON.stringify(trimmed)}`,
      );
    }
    out[match[1]] = match[2].trim();
  }

  return out;
}

/** `YYYY-MM-DD` for today, the same shape and slice `mutate.ts`'s own
 * `today()` writes into `valid_from`. Duplicated rather than imported: this
 * module deliberately depends on nothing in the write path, and a two-line
 * date format is not the kind of thing whose drift can hurt. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * A date roughly a year out, for example fields that are meant to name a
 * FUTURE deadline (`assumption.validate_by`). The literal `2026-12-01` this
 * replaces was the same defect as the frozen `valid_from` below, one step
 * subtler: an `assumption` example whose validate-by date has passed
 * illustrates an overdue assumption, i.e. exactly the state the field exists
 * to help a reader avoid. 365 days, not calendar arithmetic — the value is
 * illustrative, and only its being plausibly ahead of the reader matters.
 */
function aboutAYearFromNow(): string {
  return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
    extra: { validate_by: aboutAYearFromNow() },
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
  // `Object.hasOwn`, not a bare index: `config.categories[type]` on a
  // prototype-polluting `type` (e.g. `"constructor"`) resolves to
  // `Object.prototype.constructor` instead of `undefined`, producing a raw
  // `TypeError` deep inside this function rather than a teaching message —
  // the same hazard `mutate.ts`'s `resolveCategory` guards against twice.
  if (!Object.hasOwn(config.categories, type)) {
    throw new Error(enumError('type', type, Object.keys(config.categories), 'categories'));
  }
  const category = config.categories[type];

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
    // `today()`, not a literal: `createItem` (mutate.ts) stamps `valid_from`
    // with the day the item was written, and this function's whole contract
    // is "a complete, correct item, rendered exactly as it is stored". A
    // frozen literal made every `mycontext_examples` answer show the same
    // long-past capture date, which is the one field in the rendered example
    // a reader can check against their own clock and find wrong.
    validFrom: today(),
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
