import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Config, ResolvedCategory } from '../core/config.ts';
import { computeItemChecksum, renderItem } from '../core/item.ts';
import { snapshotBody, snapshotChecksum, snapshotText } from '../core/reference.ts';
import { makeId } from '../core/slug.ts';
import { enumError, type HelpTopic } from '../core/teach.ts';
import type { Item } from '../core/types.ts';
import { HE_CATEGORY_DESCRIPTIONS, HE_TABLE_HEADER } from './he.ts';

export const HELP_TOPICS: HelpTopic[] = ['categories', 'scope', 'capture', 'workflow'];

/**
 * The one non-English source language a topic can carry. The CLI itself is
 * NOT localized — `mycontext help` speaks English on every terminal — and
 * this type exists for exactly one caller: the documentation generator, which
 * fills `docs/README.he.md`'s `help categories` block from the Hebrew source
 * so the Hebrew document's largest section is not English prose inside it.
 */
export type HelpLocale = 'he';

/**
 * The locale the documentation harness asked for, read from the environment
 * the way `MYCONTEXT_DOC_CLOCK` is: an undocumented pin for the generator and
 * its drift test, not a user surface. Unset means English; anything that is
 * set and is not a known locale throws rather than being silently English —
 * a typo'd value would otherwise regenerate the Hebrew document's block in
 * English and every test would agree it is fine.
 */
export function docLocale(): HelpLocale | undefined {
  const value = process.env.MYCONTEXT_DOC_LOCALE;
  if (value === undefined || value === '') return undefined;
  if (value === 'he') return 'he';
  throw new Error(
    `my_context: MYCONTEXT_DOC_LOCALE is "${value}", which is not a known locale ("he"). ` +
    'Unset it for English.',
  );
}

/** Documented but deliberately not registered. Empty now that Plan 4 implements
 * ingest_document; keep the export — it is what lets a tool be documented ahead
 * of its implementation without breaking the documented-set-equals-known-set test. */
export const RESERVED_TOOLS: string[] = [];

const TOPIC_DIR = path.join(import.meta.dirname, 'topics');

/**
 * A localized topic lives beside its English source as `<topic>.<locale>.md`.
 * A locale whose file does not exist throws with the path to create rather
 * than falling back to English: a silent fallback is how the Hebrew README's
 * categories section came to be English in the first place, and "nothing is
 * dropped silently" is this project's rule for exactly that shape of failure.
 */
function readTopicFile(topic: string, locale?: HelpLocale): string {
  const file = path.join(TOPIC_DIR, locale ? `${topic}.${locale}.md` : `${topic}.md`);
  try {
    return readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  } catch (err) {
    if (locale && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `my_context: the topic "${topic}" has no "${locale}" source (${file} does not exist). ` +
        'Translate the topic before asking for it in that locale.',
      );
    }
    throw err;
  }
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

/**
 * The category table, generated from the resolved config (spec §9).
 *
 * The `locale` changes ONLY the language column and the header. Name, tier
 * and id prefix are printed from the resolved config in every locale — they
 * are identifiers a user types into config and ids, and machine facts a test
 * can check — so the Hebrew table cannot disagree with the English one about
 * anything but words. A custom category has no translation and keeps the
 * description its own project wrote.
 */
export function categoryTable(config: Config, locale?: HelpLocale): string {
  const describe = (name: string, description: string): string =>
    (locale === 'he' ? HE_CATEGORY_DESCRIPTIONS[name] ?? description : description);
  const rows = Object.values(config.categories)
    .filter((c) => c.enabled)
    .sort((a, b) => tierRank(a) - tierRank(b) || a.name.localeCompare(b.name))
    .map((c) => `| \`${c.name}\` | ${c.tier} | \`${c.prefix}-\` | ${describe(c.name, c.description)} |`);

  const header = locale === 'he' ? HE_TABLE_HEADER : '| type | tier | id prefix | use for |';
  return [header, '|---|---|---|---|', ...rows].join('\n');
}

/**
 * `split`/`join` rather than `String.replace`: a generated table can contain
 * `$` sequences that `replace` would interpret as capture-group references.
 */
function expand(text: string, token: string, value: string): string {
  return text.split(token).join(value);
}

export function helpTopic(topic: string, config: Config, locale?: HelpLocale): string {
  if (!HELP_TOPICS.includes(topic as HelpTopic)) {
    throw new Error(enumError('topic', topic, HELP_TOPICS, 'workflow'));
  }
  return expand(readTopicFile(topic, locale), '{{CATEGORY_TABLE}}', categoryTable(config, locale));
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
  /**
   * The file this specimen is a SNAPSHOT of. Set only for `reference`, and it
   * is the distinguishing fact about that category — an item whose body came
   * from a file rather than from someone typing it. `exampleItemOf` derives
   * `source_checksum` from the body rather than taking a literal, so the
   * specimen satisfies the invariant `persist` (core/persist.ts) maintains on a real
   * one: a snapshot's recorded checksum is the checksum of the text it holds.
   */
  sourceFile?: string;
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
  runbook: {
    title: 'Rotating the Stripe webhook secret',
    body:
      '1. Deploy STRIPE_WEBHOOK_SECRET_NEXT beside the live secret; accept both.\n' +
      '2. Roll the endpoint secret in Stripe; rolling it before 1 ships loses events.\n' +
      '3. Promote NEXT to STRIPE_WEBHOOK_SECRET, drop NEXT, deploy again.',
    scope: ['src/billing/webhooks/**'],
    tags: ['billing', 'operations'],
  },
  // Beside `runbook`'s for the same reason their `def()` entries are adjacent:
  // both READMEs print the two specimens next to each other, and the two
  // categories a reader has to tell apart are the two whose worked examples
  // should be read together. `runbook`'s body is the ORDER; this one's body is
  // the WHEN — a one-time correction, and the sentence that names the sibling
  // that keeps doing the job afterwards.
  procedure: {
    title: 'Backfill the tenant_id column on invoices',
    body:
      'One-time correction after the multi-tenant migration: rows written before 2026-07 '
      + 'carry a null tenant_id. Run it once, in this order; the reconciliation query is '
      + 'meaningless until the backfill has finished. Done once and then finished — the '
      + 'nightly job that keeps the column correct from here on is a `runbook`.',
    scope: ['src/billing/invoices/**'],
    tags: ['migration', 'billing'],
  },
  environment: {
    title: 'Staging talks to the real Stripe API, local does not',
    body:
      'Local: the Stripe CLI mock. Staging: the real API with test keys.\n'
      + 'Production: the real API with live keys, and the only place retries happen.\n'
      + 'A signature bug therefore looks fine in local and staging, and only bites live.',
    scope: ['src/billing/**'],
    tags: ['billing', 'environments'],
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
  reference: {
    title: 'Billing roadmap',
    // The body is what `docs/billing-roadmap.md` said when it was captured —
    // a snapshot, not a summary of one — because that is what the category
    // does, and a specimen that showed a paraphrase would teach the opposite.
    body:
      '# Billing roadmap\n\n'
      + '- Q3: usage-based pricing behind a flag, invoices unchanged.\n'
      + '- Q3: dunning emails move to the billing service.\n'
      + '- Q4: proration. Blocked on the tax vendor decision (OPENQ-tax-vendor).',
    sourceFile: 'docs/billing-roadmap.md',
    scope: ['src/billing/**'],
    tags: ['billing', 'planning'],
    observations: [
      { category: 'why', text: 'The dates move; the ordering has not, and it decides what is safe to build against', tags: [], context: null },
      { category: 'staleness', text: 'Run mycontext doctor after pulling; source_drift means the file moved on and this snapshot did not', tags: [], context: null },
    ],
  },
  known_issue: {
    title: 'The Stripe sandbox declines 3DS test cards at random',
    body:
      'About one checkout test in five fails with card_declined on a card that should pass.\n'
      + 'The same card succeeds on retry: it is the sandbox, not our code. Do not chase it.\n'
      + 'Untrue the day Stripe closes SUP-41022 — check there, and retire this item then.',
    scope: ['test/billing/**'],
    tags: ['billing', 'flaky'],
  },
  todo: {
    title: 'Retry the webhook dispatcher on 5xx',
    body:
      'Stripe retries for 3 days; we drop on the first 5xx from our own handler, '
      + 'so a 30-second outage loses the events that arrived during it.',
    scope: ['src/billing/webhooks/**'],
    tags: ['billing', 'reliability'],
  },
  // `tags: ['bug']` is not decoration. §1.4 makes `note --tag bug` → understood
  // → promoted to `known_issue` the documented route for a bug nobody has
  // characterised yet, and this specimen is where a reader meets it: the body
  // says out loud that it has not been characterised, and names both of the
  // two things it could turn out to be.
  note: {
    title: 'The staging seed script leaves orphaned carts',
    body:
      'Noticed while debugging something else; not characterised yet. If it turns out '
      + 'to be real it is a `known_issue`, and if it turns out to be the seed data it is '
      + 'nothing at all.',
    tags: ['bug'],
  },
};

/**
 * The specimen for a category. Every category in the built-in catalogue has a
 * real one above — `test/help/help.test.ts` asserts that, so a category added
 * without a worked example fails rather than shipping the placeholder below.
 *
 * The placeholder is reached only by a CUSTOM category, where it is the honest
 * answer: this catalogue has never seen the name, so it can offer the shape of
 * an item and the description the project itself wrote, and nothing more. It
 * used to be reached by `policy`, `postmortem` and `taxonomy` as well — three
 * built-ins that shipped disabled — so `mycontext examples policy` printed
 * "Replace this body with the real content and reason." for a category the
 * product itself supplied. Phase 3 removed those three.
 */
function seedFor(category: ResolvedCategory): Seed {
  return SEEDS[category.name] ?? {
    title: `Example ${category.name.replace(/_/g, ' ')}`,
    body: `${category.description}. Replace this body with the real content and reason.`,
  };
}

/** A complete, correct item of the given type, rendered exactly as it is stored. */
export function exampleItem(type: string, config: Config): string {
  return renderItem(exampleItemOf(type, config));
}

/**
 * The same specimen, cut to what distinguishes its category: the id, the
 * title, the category-specific frontmatter fields, and the body.
 *
 * Why a second rendering exists at all. `exampleItem` prints the item exactly
 * as it is stored — every frontmatter key, most of them identical across every
 * category (`status: active`, `origin: human`, three `source_*` nulls, a
 * checksum). That is the right answer for "show me the file shape" and the
 * wrong one for "show me one of each": twenty of those blocks is ~500 lines of
 * near-identical YAML per document, which teaches less per line than the
 * comparisons above it and would make the categories section the largest in
 * the README by some distance.
 *
 * What is kept is what a reader cannot infer from the other blocks:
 *
 * - `id` and `title`, because the id is a slug of the title and that is worth
 *   seeing once per prefix.
 * - Every field the item's `extra` carries. Those are the category-specific
 *   frontmatter fields — `directive` on `rule`, `kind` on `requirement`,
 *   `likelihood`/`impact` on `risk` — and they are the one part of the
 *   frontmatter that differs *because of the category*.
 * - `severity: hard` and `always: true` ONLY when set. Both have a default
 *   (`soft`, `false`) that most specimens take, so printing them everywhere
 *   would say nothing; printing them where a specimen departs from the default
 *   is the whole signal.
 * - The observation categories, when the specimen has observations, because
 *   the shape of an `adr`'s drivers and consequences is a fact about `adr`.
 * - The body.
 *
 * What is dropped is dropped from the *rendering*, not from the item: the full
 * form is one command away and is what both READMEs show for `rule`. Four to
 * six lines, which is what makes one block per category affordable.
 */
export function exampleItemShort(type: string, config: Config): string {
  const item = exampleItemOf(type, config);

  const lines = [`id: ${item.id}`, `title: ${item.title}`];
  // `source_file` earns its place here on exactly the terms the `extra` fields
  // below do: it is the frontmatter that differs BECAUSE of the category. It
  // is what makes the body below a snapshot of a file rather than text
  // somebody typed, and without it the specimen's quoted body reads as a
  // stylistic choice instead of the format it is.
  if (item.sourceFile !== null) lines.push(`source_file: ${item.sourceFile}`);
  for (const [field, value] of Object.entries(item.extra)) lines.push(`${field}: ${value}`);
  if (item.severity === 'hard') lines.push('severity: hard');
  if (item.always) lines.push('always: true');
  if (item.observations.length > 0) {
    lines.push(`observations: ${item.observations.map((o) => o.category).join(', ')}`);
  }
  lines.push('', item.body.trim());
  return lines.join('\n');
}

/**
 * The specimen itself, before it is rendered either way. Shared so the two
 * renderings cannot show different items — a short form built from its own
 * seed would be a second copy of the catalogue's worked examples, free to
 * drift from the full one the same document prints a few hundred lines above.
 */
function exampleItemOf(type: string, config: Config): Item {
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

  // A specimen with a `sourceFile` is a SNAPSHOT, and it is built the way a
  // real one is rather than by writing out what one looks like: the body is
  // the seed's text quoted (`snapshotBody`), and `source_checksum` is the
  // checksum of the unquoted text — which is the invariant `persist`
  // (mutate.ts) maintains on every real snapshot. Written this way, the
  // specimen cannot show a shape the write path would not produce.
  const snapshot = seed.sourceFile !== undefined;
  const body = snapshot ? snapshotBody(snapshotText(seed.body)) : seed.body;

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
    sourceFile: seed.sourceFile ?? null,
    sourceAnchor: null,
    sourceChecksum: snapshot ? snapshotChecksum(seed.body) : null,
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
    body,
    // No seed carries steps: `SeedItem` has no `steps` field, and the one
    // category that documents them (`procedure`) states its steps in the
    // seed's prose. An empty list also keeps every seed's rendered checksum
    // exactly where it was — `computeItemChecksum` adds its `steps` key only
    // when there are steps.
    steps: [],
    observations: seed.observations ?? [],
    relations: seed.relations ?? [],
    layer: 'project',
    filePath: `items/${category.name}/${id}.md`,
  };
  item.checksum = computeItemChecksum(item);

  return item;
}
