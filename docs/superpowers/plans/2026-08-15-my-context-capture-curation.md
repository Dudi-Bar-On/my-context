# my_context Capture and Curation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the corpus and keep it honest — batch-ingest documents into reviewable drafts, derive rules from lessons behind a mandatory approval gate, walk the draft queue, and report on health, drift and decay.

**Architecture:** Every generated item enters as `status: draft` and is written only by deterministic code. The nondeterministic half — reading a document and proposing items — is performed by the **host agent**, not by this plugin: the CLI and the MCP tool emit a structured *extraction request* (chunk text + JSON schema + callback instructions), Claude fills it in, and calls back with structured results that deterministic, fully-tested code validates, dedupes and stages. No API client, no API key, no runtime dependency.

**Tech Stack:** Node 24, TypeScript executed directly (no build step), `node:sqlite`, `node:test`, `node:crypto`, `node:fs`. Zero runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-08-12-my-context-design.md`

**Plan position:** Plan 4 of 4. Plan 1 (`2026-08-12-my-context-foundation.md`) built `core/paths`, `core/categories`, `core/config`, `core/slug`, `core/frontmatter`, `core/item`, `core/store`, `core/rebuild`, `core/select`, `core/render`, `core/workspace`, the CLI, and the `SessionStart` hook. Plan 2 owns the session ledger, the JIT tier and `PreCompact`. Plan 3 owns the MCP server framework, `core/mutate.ts` and the help system. **This plan consumes those; it never redefines them.**

## Global Constraints

- **Zero runtime dependencies.** devDependencies are limited to `typescript` and `@types/node`.
- **Node >= 24.0.0.** Required for stable `node:sqlite` and native type stripping.
- **No build step.** Source is `.ts`, executed directly by Node. All relative imports carry an explicit `.ts` extension. Only erasable TypeScript syntax — no `enum`, no `namespace`, no parameter properties.
- **`node:sqlite` bindings reject booleans.** `.run(true)` throws `Provided value cannot be bound to SQLite parameter`. Convert to `1`/`0`. `.get()` returns `undefined` for a missing row and yields null-prototype objects.
- **All stored paths are POSIX-normalized and layer-root-relative** (spec §5.4). No backslash ever reaches the database, a glob comparison, or a `source_file` field.
- **Slugs and filenames use one deterministic case:** uppercase category prefix, lowercase slug body.
- **Rendered Markdown and all emitted text use `\n` line endings** regardless of platform.
- **The plugin never calls an LLM.** There is no API client and no API key. Extraction and rule derivation are performed by the host agent through the two-phase request/callback protocol defined in Task 2.
- **Nothing generated reaches `status: active` without an explicit user command.** Ingested items are `draft`; derived rules sit in staging outside `items/` until accepted.
- **Extraction *quality* is never tested** (spec §11 — nondeterministic, must not gate a build). The staging, validation, dedupe, provenance and drift logic is tested exhaustively instead.
- **Atomic writes throughout.** Temp file + rename for every JSON and Markdown write.
- **CI runs on `windows-latest` and `ubuntu-latest`.**
- **TDD:** every task writes a failing test first, watches it fail, then implements.
- **Commit at the end of every task.**

---

## Interfaces consumed from Plans 2 and 3

These are the exact shapes this plan depends on. **Do not implement them here** — they belong to their owning plans. If an implementer finds the real signature differs, adapt the call site in this plan rather than duplicating the module.

### From Plan 2 — `src/core/ledger.ts` (spec §6.6)

```typescript
export interface LedgerEntry {
  sessionId: string;
  itemId: string;
  injectedAt: string;   // ISO-8601
  tier: string;         // 'pinned' | 'jit' | 'restored'
}

export interface UsageRow {
  itemId: string;
  useCount: number;
  lastUsed: string | null;   // ISO-8601, null if never injected
}

export class Ledger {
  static open(dbPath: string): Ledger;
  record(entry: LedgerEntry): void;
  seenInSession(sessionId: string): string[];
  /** One row per item id that has ever been injected. */
  usage(): UsageRow[];
  /** The most recent `limit` session ids, newest first. */
  recentSessions(limit: number): string[];
  /** Distinct item ids injected during any of the given sessions. */
  itemsUsedIn(sessionIds: string[]): string[];
  /** Total number of distinct sessions recorded. */
  sessionCount(): number;
  close(): void;
}
```

### From Plan 3 — `src/core/mutate.ts` (spec §7.1, §8)

```typescript
import type { Config } from './config.ts';
import type { Store } from './store.ts';
import type { Item, Observation, Origin, Relation, Severity, Status } from './types.ts';

export interface MutateContext {
  /** Absolute path to the layer root, i.e. `<project>/.my_context`. */
  root: string;
  config: Config;
  store: Store;
  /** Governs the trust model in spec §7.1: 'agent' forces normative items to draft. */
  caller: 'user' | 'agent';
}

export interface CreateItemInput {
  type: string;
  title: string;
  body?: string;
  /** Explicit id. When omitted, `makeId(prefix, title)` is used. */
  id?: string;
  status?: Status;
  severity?: Severity;
  always?: boolean;
  scope?: string[];
  tags?: string[];
  origin?: Origin;
  sourceFile?: string | null;
  sourceAnchor?: string | null;
  sourceChecksum?: string | null;
  extra?: Record<string, string>;
  observations?: Observation[];
  relations?: Relation[];
}

export interface MutationResult {
  item: Item;
  /** false when an existing item was returned unchanged. */
  created: boolean;
  message: string;
}

/** Writes the Markdown file atomically and upserts into `ctx.store`. */
export function createItem(ctx: MutateContext, input: CreateItemInput): MutationResult;
export function updateItem(ctx: MutateContext, id: string, patch: Partial<CreateItemInput>): MutationResult;
/** Marks `previousId` superseded, creates the replacement, wires `supersedes` on the new item. */
export function supersedeItem(ctx: MutateContext, previousId: string, input: CreateItemInput): MutationResult;
export function linkItems(ctx: MutateContext, fromId: string, relation: string, toId: string): MutationResult;
```

### From Plan 3 — `src/mcp/tools.ts`

```typescript
export interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ws: Workspace) => ToolResult;
}

/** Plan 3 owns the registry; Plan 4 registers additional tools into it. */
export function registerTool(def: ToolDef): void;
export const TOOLS: Map<string, ToolDef>;
```

---

## The extraction control flow — the central design decision

The plugin has zero runtime dependencies and no API key, so it **cannot** call a model. Rather than invent an API client, extraction is inverted: **the host agent is the extractor.**

```
  mycontext ingest docs/prd/auth.md
        │
        ▼
  [ deterministic ]  read file → normalize EOL → chunk on headings →
                     compute per-chunk checksums → open/resume an ingest
                     session under .my_context/.ingest/ → print an
                     EXTRACTION REQUEST for the first pending chunk
        │
        ▼
  [ the host agent ] Claude reads the request: the chunk text, the JSON
                     schema, the enabled category list with descriptions,
                     and the exact callback command. Claude performs the
                     extraction itself, in its own context.
        │
        ▼
  mycontext ingest-apply ING-auth-9f2a --anchor password-policy --stdin
        │
        ▼
  [ deterministic ]  validate against the schema → reject candidates whose
                     `quote` is not verbatim in the chunk → hash content →
                     dedupe → wire `supersedes` on material change → write
                     drafts via createItem() → record in the session →
                     print the next pending chunk's request
```

Three consequences, all deliberate:

1. **Every line of code in this plan is deterministic and testable.** The only nondeterministic step happens inside the agent's own reasoning and produces JSON that is then validated like any other untrusted input.
2. **A partial ingest keeps every success and names every failure** (spec §10). Each chunk is applied independently, and per-candidate validation issues are reported without aborting the batch.
3. **The `quote` field is the anti-hallucination anchor.** Each candidate must carry a verbatim span from the chunk. That is checked with string containment — deterministic, cheap, and it fails loudly when a candidate was invented rather than extracted. This tests *grounding*, not *quality*, so it does not violate spec §11.

The same request/callback protocol is reused verbatim for lesson → rule derivation in Task 7.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/ingest/chunk.ts` | Split a source document into anchored, checksummed chunks |
| `src/ingest/schema.ts` | The candidate JSON schema and its validator |
| `src/ingest/request.ts` | Build and render the extraction request handed to the host agent |
| `src/ingest/session.ts` | Persist an ingest session under `.my_context/.ingest/` |
| `src/ingest/apply.ts` | Candidates → drafts: hash, dedupe, supersede, provenance |
| `src/cli/commands/registry.ts` | Command registration so later plans add commands without editing a switch |
| `src/cli/commands/context.ts` | Build a `MutateContext` from a `Workspace` |
| `src/cli/commands/ingest.ts` | `ingest`, `ingest-apply`, `ingest-status` |
| `src/cli/commands/index.ts` | Side-effect imports that populate the registry |
| `src/mcp/tools/ingest.ts` | The `ingest_document` MCP tool — both phases |
| `src/lesson/derive.ts` | Rule-candidate staging and the approval gate |
| `src/cli/commands/lesson.ts` | `lesson`, `lesson-stage`, `lesson-accept`, `lesson-discard` |
| `src/cli/commands/review.ts` | The draft queue walker: list, show, promote, discard |
| `src/doctor/checks.ts` | The five doctor checks as independently testable functions |
| `src/cli/commands/doctor.ts` | `doctor` — runs the checks and renders findings |
| `src/core/decay.ts` | Pure decay computation from items + ledger usage |
| `src/cli/commands/decay.ts` | `decay` — wires the real ledger into the pure report |
| `src/cli/commands/query.ts` | `query` — read-only SQL passthrough with a SELECT-only guard |
| `src/cli/commands/status.ts` | The expanded `status` report |
| `src/core/store.ts` (modify) | Add `Store.openReadOnly` and `raw()` |
| `src/cli/index.ts` (modify) | Consult the command registry; generate usage from it |

---

## Task 1: Source chunking with stable anchors

**Files:**
- Create: `src/ingest/chunk.ts`
- Test: `test/ingest/chunk.test.ts`

**Interfaces:**
- Consumes: `checksum`, `slugify` from `src/core/slug.ts`
- Produces:
  - `Chunk { index: number; anchor: string; heading: string | null; text: string; checksum: string }`
  - `DEFAULT_MAX_CHARS: number`
  - `normalizeEol(text: string): string`
  - `sourceChecksum(text: string): string`
  - `chunkDocument(text: string, opts?: { maxChars?: number }): Chunk[]`

Anchors are the provenance key written into every ingested item's `source_anchor`, and the drift check in Task 9 re-derives them from the current file. They must therefore be **deterministic and stable across platforms**: derived from the heading slug, disambiguated by a numeric suffix in document order, never from a line number (which moves on every edit).

- [ ] **Step 1: Write the failing test**

`test/ingest/chunk.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkDocument, normalizeEol, sourceChecksum } from '../../src/ingest/chunk.ts';

const DOC = `Some preamble prose.

# Auth requirements

The system must support SSO.

## Password policy

Passwords must be at least 12 characters.

## Password policy

A second section with a colliding heading.
`;

test('an empty document yields no chunks', () => {
  assert.deepEqual(chunkDocument(''), []);
  assert.deepEqual(chunkDocument('\n\n   \n'), []);
});

test('preamble before the first heading becomes its own chunk', () => {
  const chunks = chunkDocument(DOC);
  assert.equal(chunks[0].anchor, '_preamble');
  assert.equal(chunks[0].heading, null);
  assert.equal(chunks[0].text, 'Some preamble prose.');
});

test('each heading starts a chunk anchored on its slug', () => {
  const chunks = chunkDocument(DOC);
  assert.deepEqual(
    chunks.map((c) => c.anchor),
    ['_preamble', 'auth-requirements', 'password-policy', 'password-policy-2'],
  );
});

test('the heading line is retained in the chunk text', () => {
  const chunks = chunkDocument(DOC);
  assert.match(chunks[1].text, /^# Auth requirements/);
  assert.match(chunks[1].text, /must support SSO/);
});

test('indexes are sequential and match array position', () => {
  const chunks = chunkDocument(DOC);
  chunks.forEach((c, i) => assert.equal(c.index, i));
});

test('an oversize section is split into numbered sub-chunks', () => {
  const doc = `# Big\n\n${'para one. '.repeat(40)}\n\n${'para two. '.repeat(40)}\n`;
  const chunks = chunkDocument(doc, { maxChars: 300 });
  assert.ok(chunks.length > 1, `expected a split, got ${chunks.length}`);
  assert.equal(chunks[0].anchor, 'big--1');
  assert.equal(chunks[1].anchor, 'big--2');
  for (const c of chunks) assert.ok(c.text.length <= 300, `chunk ${c.anchor} is ${c.text.length}`);
});

test('a single paragraph longer than the limit is hard-split rather than dropped', () => {
  const doc = `# Big\n\n${'x'.repeat(500)}\n`;
  const chunks = chunkDocument(doc, { maxChars: 200 });
  const joined = chunks.map((c) => c.text).join('');
  assert.ok(joined.includes('x'.repeat(200)));
  assert.equal(chunks.every((c) => c.text.length <= 200), true);
});

test('CRLF input produces identical chunks and checksums to LF input', () => {
  const lf = chunkDocument(DOC);
  const crlf = chunkDocument(DOC.replace(/\n/g, '\r\n'));
  assert.deepEqual(crlf, lf);
});

test('chunk checksums are stable and differ when the text changes', () => {
  const a = chunkDocument(DOC)[2];
  const b = chunkDocument(DOC)[2];
  assert.equal(a.checksum, b.checksum);
  const edited = chunkDocument(DOC.replace('12 characters', '16 characters'))[2];
  assert.notEqual(edited.checksum, a.checksum);
  assert.equal(edited.anchor, a.anchor, 'the anchor must survive an edit to the body');
});

test('normalizeEol removes every carriage return', () => {
  assert.equal(normalizeEol('a\r\nb\rc'), 'a\nb\nc');
});

test('sourceChecksum ignores line-ending and trailing-whitespace differences', () => {
  assert.equal(sourceChecksum('a\nb\n'), sourceChecksum('a\r\nb\r\n\n'));
  assert.notEqual(sourceChecksum('a\nb\n'), sourceChecksum('a\nc\n'));
});

test('a heading of only punctuation still yields a usable anchor', () => {
  const chunks = chunkDocument('# !!!\n\nbody\n');
  assert.equal(chunks[0].anchor, 'section');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/ingest/chunk.test.ts`
Expected: FAIL — `Cannot find module '../../src/ingest/chunk.ts'`

- [ ] **Step 3: Implement**

`src/ingest/chunk.ts`:

```typescript
import { checksum, slugify } from '../core/slug.ts';

export interface Chunk {
  /** Position in the document, 0-based. */
  index: number;
  /** Stable provenance key. Derived from the heading slug, never from a line number. */
  anchor: string;
  heading: string | null;
  text: string;
  checksum: string;
}

export const DEFAULT_MAX_CHARS = 6000;

const HEADING = /^(#{1,6})\s+(.*?)\s*$/;

/** Every path through this module normalizes first, so Windows CRLF never changes a checksum. */
export function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** Checksum of a whole source document, insensitive to line endings and edge whitespace. */
export function sourceChecksum(text: string): string {
  return checksum(normalizeEol(text).trim());
}

interface Section {
  heading: string | null;
  lines: string[];
}

function isBlank(section: Section): boolean {
  return section.heading === null && section.lines.join('\n').trim() === '';
}

/** Split on blank lines, falling back to a hard cut for a single oversize paragraph. */
function splitOversize(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const out: string[] = [];
  let current = '';

  for (const paragraph of text.split(/\n{2,}/)) {
    if (paragraph.length > maxChars) {
      if (current) { out.push(current); current = ''; }
      for (let i = 0; i < paragraph.length; i += maxChars) {
        out.push(paragraph.slice(i, i + maxChars));
      }
      continue;
    }
    const joined = current ? `${current}\n\n${paragraph}` : paragraph;
    if (joined.length > maxChars) {
      if (current) out.push(current);
      current = paragraph;
      continue;
    }
    current = joined;
  }

  if (current) out.push(current);
  return out;
}

export function chunkDocument(text: string, opts: { maxChars?: number } = {}): Chunk[] {
  const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS;

  const sections: Section[] = [];
  let current: Section = { heading: null, lines: [] };

  for (const line of normalizeEol(text).split('\n')) {
    const match = HEADING.exec(line);
    if (match) {
      if (!isBlank(current)) sections.push(current);
      current = { heading: match[2], lines: [line] };
      continue;
    }
    current.lines.push(line);
  }
  if (!isBlank(current)) sections.push(current);

  const seen = new Map<string, number>();
  const chunks: Chunk[] = [];

  for (const section of sections) {
    const body = section.lines.join('\n').trim();
    if (body === '') continue;

    const base = section.heading === null
      ? '_preamble'
      : (slugify(section.heading) || 'section');

    const parts = splitOversize(body, maxChars);
    parts.forEach((part, partIndex) => {
      let anchor = parts.length > 1 ? `${base}--${partIndex + 1}` : base;
      const count = seen.get(anchor) ?? 0;
      seen.set(anchor, count + 1);
      if (count > 0) anchor = `${anchor}-${count + 1}`;

      chunks.push({
        index: chunks.length,
        anchor,
        heading: section.heading,
        text: part,
        checksum: checksum(part),
      });
    });
  }

  return chunks;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/ingest/chunk.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ingest/chunk.ts test/ingest/chunk.test.ts
git commit -m "feat: add document chunking with stable provenance anchors"
```

---

## Task 2: The candidate schema and its validator

**Files:**
- Create: `src/ingest/schema.ts`
- Test: `test/ingest/schema.test.ts`

**Interfaces:**
- Consumes: `Config` from `src/core/config.ts`; `Chunk`, `normalizeEol` from `src/ingest/chunk.ts`
- Produces:
  - `Candidate { type, title, body, quote, severity?, scope?, tags?, observations?, extra? }`
  - `CANDIDATE_SCHEMA: Record<string, unknown>` — the JSON Schema embedded in every extraction request
  - `ValidationIssue { index: number; title: string | null; message: string }`
  - `ValidationResult { valid: Candidate[]; issues: ValidationIssue[] }`
  - `validateCandidates(raw: unknown, config: Config, chunk: Chunk): ValidationResult`

This is the trust boundary. Everything arriving from the host agent is untrusted JSON. Validation never throws on bad candidates — it partitions them, so a batch with one bad entry still lands nine good ones (spec §10). Error messages follow spec §9: they name the offending value and the closest legal one.

- [ ] **Step 1: Write the failing test**

`test/ingest/schema.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCandidates, CANDIDATE_SCHEMA } from '../../src/ingest/schema.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Chunk } from '../../src/ingest/chunk.ts';

const CONFIG = resolveConfig({});

const CHUNK: Chunk = {
  index: 0,
  anchor: 'password-policy',
  heading: 'Password policy',
  text: '# Password policy\n\nPasswords must be at least 12 characters.\nSessions expire after 30 minutes.',
  checksum: 'abc123',
};

function candidate(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'requirement',
    title: 'Passwords are at least 12 characters',
    body: 'Enforced at registration and at password change.',
    quote: 'Passwords must be at least 12 characters.',
    ...over,
  };
}

test('a well-formed candidate validates', () => {
  const result = validateCandidates([candidate()], CONFIG, CHUNK);
  assert.deepEqual(result.issues, []);
  assert.equal(result.valid.length, 1);
  assert.equal(result.valid[0].type, 'requirement');
  assert.equal(result.valid[0].title, 'Passwords are at least 12 characters');
});

test('a non-array payload is one issue, not a crash', () => {
  const result = validateCandidates({ items: [] }, CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.equal(result.issues.length, 1);
  assert.match(result.issues[0].message, /array/i);
});

test('an empty array is valid and produces nothing', () => {
  assert.deepEqual(validateCandidates([], CONFIG, CHUNK), { valid: [], issues: [] });
});

test('an unknown type is rejected with the closest legal match', () => {
  const result = validateCandidates([candidate({ type: 'requirements' })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /requirements/);
  assert.match(result.issues[0].message, /closest match is "requirement"/);
});

test('a disabled category is rejected even though it is a real category', () => {
  const result = validateCandidates([candidate({ type: 'policy' })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /enabled category/i);
});

test('a missing title is rejected', () => {
  const result = validateCandidates([candidate({ title: '   ' })], CONFIG, CHUNK);
  assert.match(result.issues[0].message, /"title" is required/);
});

test('an over-long title is rejected with both numbers', () => {
  const result = validateCandidates([candidate({ title: 'x'.repeat(201) })], CONFIG, CHUNK);
  assert.match(result.issues[0].message, /201/);
  assert.match(result.issues[0].message, /200/);
});

test('a quote that is not verbatim in the chunk is rejected', () => {
  const result = validateCandidates(
    [candidate({ quote: 'Passwords must be at least sixteen characters.' })], CONFIG, CHUNK);
  assert.equal(result.valid.length, 0);
  assert.match(result.issues[0].message, /does not appear in the source chunk/);
  assert.match(result.issues[0].message, /password-policy/);
});

test('quote matching ignores whitespace and line-break differences', () => {
  const result = validateCandidates(
    [candidate({ quote: 'Passwords   must be at\nleast 12 characters.' })], CONFIG, CHUNK);
  assert.deepEqual(result.issues, []);
});

test('a missing quote is rejected with instructions', () => {
  const result = validateCandidates([candidate({ quote: undefined })], CONFIG, CHUNK);
  assert.match(result.issues[0].message, /verbatim/);
});

test('a backslash in a scope glob is rejected', () => {
  const result = validateCandidates(
    [candidate({ scope: ['src\\auth\\**'] })], CONFIG, CHUNK);
  assert.match(result.issues[0].message, /backslash/);
});

test('a bare ** scope is rejected as defeating inert-by-default', () => {
  const result = validateCandidates([candidate({ scope: ['**'] })], CONFIG, CHUNK);
  assert.match(result.issues[0].message, /too broad/i);
});

test('an invalid severity is rejected', () => {
  const result = validateCandidates([candidate({ severity: 'critical' })], CONFIG, CHUNK);
  assert.match(result.issues[0].message, /severity/);
  assert.match(result.issues[0].message, /hard/);
});

test('good and bad candidates partition — every success is kept, every failure named', () => {
  const result = validateCandidates(
    [candidate(), candidate({ type: 'nonsense' }), candidate({ title: 'Sessions expire after 30 minutes', quote: 'Sessions expire after 30 minutes.' })],
    CONFIG, CHUNK);
  assert.equal(result.valid.length, 2);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].index, 1);
});

test('an issue carries the candidate title when there is one, for a readable report', () => {
  const result = validateCandidates([candidate({ type: 'nonsense' })], CONFIG, CHUNK);
  assert.equal(result.issues[0].title, 'Passwords are at least 12 characters');
});

test('observations are normalized to the item shape', () => {
  const result = validateCandidates(
    [candidate({ observations: [{ category: 'limit', text: 'At least 12 chars', tags: ['auth'] }] })],
    CONFIG, CHUNK);
  assert.deepEqual(result.valid[0].observations, [
    { category: 'limit', text: 'At least 12 chars', tags: ['auth'] },
  ]);
});

test('unknown extra keys are carried through as strings', () => {
  const result = validateCandidates([candidate({ extra: { kind: 'functional' } })], CONFIG, CHUNK);
  assert.deepEqual(result.valid[0].extra, { kind: 'functional' });
});

test('the published schema names every required field', () => {
  const required = (CANDIDATE_SCHEMA.items as { required: string[] }).required;
  assert.deepEqual(required.sort(), ['body', 'quote', 'title', 'type']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/ingest/schema.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`src/ingest/schema.ts`:

```typescript
import type { Config } from '../core/config.ts';
import { normalizeEol, type Chunk } from './chunk.ts';

export interface CandidateObservation {
  category: string;
  text: string;
  tags: string[];
}

export interface Candidate {
  type: string;
  title: string;
  body: string;
  /** A verbatim span from the source chunk. The grounding check, not a quality check. */
  quote: string;
  severity: 'hard' | 'soft';
  scope: string[];
  tags: string[];
  observations: CandidateObservation[];
  extra: Record<string, string>;
}

export const MAX_TITLE = 200;

/**
 * The JSON Schema embedded verbatim in every extraction request. It is data,
 * not executable validation — `validateCandidates` is the enforcing half, and
 * the two must be kept in step. The test asserts the required list matches.
 */
export const CANDIDATE_SCHEMA: Record<string, unknown> = {
  type: 'array',
  items: {
    type: 'object',
    required: ['type', 'title', 'body', 'quote'],
    additionalProperties: false,
    properties: {
      type: { type: 'string', description: 'One of the enabled categories listed in this request.' },
      title: { type: 'string', maxLength: MAX_TITLE, description: 'One declarative sentence stating what must hold.' },
      body: { type: 'string', description: 'The rationale: why this holds, and what breaks if it does not.' },
      quote: { type: 'string', description: 'A verbatim span copied from the chunk. Never paraphrase — a paraphrased quote is rejected.' },
      severity: { enum: ['hard', 'soft'], description: 'hard = a future enforcement candidate. Default soft.' },
      scope: {
        type: 'array', items: { type: 'string' },
        description: 'POSIX globs of the code this governs, e.g. "src/auth/**". Omit when unknown — an unscoped item is indexed but never auto-injected. A bare "**" is rejected.',
      },
      tags: { type: 'array', items: { type: 'string' } },
      observations: {
        type: 'array',
        items: {
          type: 'object', required: ['category', 'text'], additionalProperties: false,
          properties: {
            category: { type: 'string' },
            text: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      extra: {
        type: 'object', additionalProperties: { type: 'string' },
        description: 'Category-specific fields, e.g. {"kind":"functional"} for a requirement, {"directive":"dont"} for a rule.',
      },
    },
  },
};

export interface ValidationIssue {
  /** Position in the submitted array. -1 when the payload itself was malformed. */
  index: number;
  title: string | null;
  message: string;
}

export interface ValidationResult {
  valid: Candidate[];
  issues: ValidationIssue[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function stringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((e): e is string => typeof e === 'string').map((e) => e.trim()).filter(Boolean);
}

/** Collapse all whitespace so a quote survives re-wrapping between chunk and callback. */
function flatten(text: string): string {
  return normalizeEol(text).replace(/\s+/g, ' ').trim();
}

function closestCategory(name: string, known: string[]): string | null {
  return known.find((k) => k === name)
    ?? known.find((k) => k.startsWith(name) || name.startsWith(k))
    ?? known.find((k) => k.includes(name) || name.includes(k))
    ?? null;
}

export function validateCandidates(raw: unknown, config: Config, chunk: Chunk): ValidationResult {
  const valid: Candidate[] = [];
  const issues: ValidationIssue[] = [];

  if (!Array.isArray(raw)) {
    issues.push({
      index: -1,
      title: null,
      message:
        `expected a JSON array of candidate items, got ${raw === null ? 'null' : typeof raw}. ` +
        `Return [] when a chunk contains nothing normative.`,
    });
    return { valid, issues };
  }

  const enabled = Object.values(config.categories)
    .filter((c) => c.enabled)
    .map((c) => c.name)
    .sort();
  const haystack = flatten(chunk.text);

  raw.forEach((entry, index) => {
    const title = isObject(entry) && typeof entry.title === 'string' ? entry.title.trim() : null;
    const reject = (message: string): void => { issues.push({ index, title, message }); };

    if (!isObject(entry)) return reject(`entry is ${Array.isArray(entry) ? 'an array' : typeof entry}, expected an object`);

    if (typeof entry.type !== 'string' || entry.type.trim() === '') {
      return reject(`"type" is required. Expected one of: ${enabled.join(', ')}.`);
    }
    const type = entry.type.trim().toLowerCase();
    if (!enabled.includes(type)) {
      const near = closestCategory(type, enabled);
      return reject(
        `"type" must be an enabled category. You passed "${entry.type}".` +
        (near ? ` The closest match is "${near}".` : '') +
        ` Enabled here: ${enabled.join(', ')}. See help("categories").`,
      );
    }

    if (!title) return reject('"title" is required and must be a non-empty string.');
    if (title.length > MAX_TITLE) {
      return reject(`"title" is ${title.length} characters; the limit is ${MAX_TITLE}. Move the detail into "body".`);
    }

    const body = typeof entry.body === 'string' ? entry.body.trim() : '';

    if (typeof entry.quote !== 'string' || entry.quote.trim() === '') {
      return reject('"quote" is required: copy the verbatim sentence from the source chunk this item is drawn from.');
    }
    const quote = flatten(entry.quote);
    if (!haystack.includes(quote)) {
      return reject(
        `"quote" does not appear in the source chunk "${chunk.anchor}". ` +
        `Copy the text verbatim from the chunk; do not paraphrase, summarize, or quote a different section.`,
      );
    }

    let severity: 'hard' | 'soft' = 'soft';
    if (entry.severity !== undefined) {
      if (entry.severity !== 'hard' && entry.severity !== 'soft') {
        return reject(`"severity" must be "hard" or "soft". You passed ${JSON.stringify(entry.severity)}.`);
      }
      severity = entry.severity;
    }

    const scope = stringArray(entry.scope);
    const backslashed = scope.find((s) => s.includes('\\'));
    if (backslashed) {
      return reject(`scope glob "${backslashed}" contains a backslash. Scope globs are POSIX, e.g. "src/db/**".`);
    }
    const bare = scope.find((s) => s === '**' || s === '**/*' || s === '*');
    if (bare) {
      return reject(
        `scope glob "${bare}" is too broad — it matches the whole repository and defeats inert-by-default scoping. ` +
        `Name the directories this actually governs, or omit "scope" entirely. See help("scope").`,
      );
    }

    const observations: CandidateObservation[] = [];
    if (Array.isArray(entry.observations)) {
      for (const o of entry.observations) {
        if (!isObject(o)) continue;
        if (typeof o.category !== 'string' || typeof o.text !== 'string') continue;
        const text = o.text.trim();
        if (text === '') continue;
        observations.push({
          category: o.category.trim().toLowerCase(),
          text,
          tags: stringArray(o.tags),
        });
      }
    }

    const extra: Record<string, string> = {};
    if (isObject(entry.extra)) {
      for (const [key, value] of Object.entries(entry.extra)) {
        if (value === null || value === undefined || Array.isArray(value) || isObject(value)) continue;
        extra[key] = String(value);
      }
    }

    valid.push({
      type, title, body, quote,
      severity,
      scope,
      tags: stringArray(entry.tags),
      observations,
      extra,
    });
  });

  return { valid, issues };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/ingest/schema.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ingest/schema.ts test/ingest/schema.test.ts
git commit -m "feat: add the extraction candidate schema and grounding validator"
```

---

## Task 3: Ingest session persistence

**Files:**
- Create: `src/ingest/session.ts`
- Test: `test/ingest/session.test.ts`

**Interfaces:**
- Consumes: `chunkDocument`, `sourceChecksum`, `normalizeEol`, `Chunk` from `src/ingest/chunk.ts`; `slugify` from `src/core/slug.ts`
- Produces:
  - `ApplyRecord { candidateHash: string; itemId: string; action: 'created' | 'deduped' | 'superseded'; previousId?: string; at: string }`
  - `IngestSession { protocol; id; sourceFile; sourceChecksum; createdAt; chunks: Chunk[]; applied: Record<string, ApplyRecord[]> }`
  - `ingestDir(root: string): string`
  - `makeSessionId(sourceFileRel: string, docChecksum: string): string`
  - `openIngestSession(root: string, sourceFileRel: string, text: string): IngestSession`
  - `saveSession(root: string, session: IngestSession): string`
  - `loadSession(root: string, id: string): IngestSession`
  - `listSessions(root: string): IngestSession[]`
  - `pendingAnchors(session: IngestSession): string[]`

The session id is **derived**, not random: `ING-<source-slug>-<first 8 of the document checksum>`. Re-running `mycontext ingest` on an unchanged file therefore resumes the same session and skips chunks already applied, which is what makes ingestion interruptible. Editing the source produces a different id, so the previous session survives as a record of what was extracted from the old text.

Sessions are transient working state, not knowledge — `.my_context/.ingest/` gets its own `.gitignore` containing `*`.

- [ ] **Step 1: Write the failing test**

`test/ingest/session.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  openIngestSession, saveSession, loadSession, listSessions,
  pendingAnchors, makeSessionId, ingestDir,
} from '../../src/ingest/session.ts';

const DOC = `# Auth\n\nMust support SSO.\n\n# Storage\n\nPostgres only.\n`;

function root(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-ing-'));
}

test('a session id is derived from the source path and content', () => {
  const a = makeSessionId('docs/prd/auth.md', 'abcdef0123456789');
  assert.equal(a, 'ING-docs-prd-auth-md-abcdef01');
  assert.equal(a, makeSessionId('docs/prd/auth.md', 'abcdef0123456789'));
  assert.notEqual(a, makeSessionId('docs/prd/auth.md', 'ffffffff00000000'));
});

test('opening a session chunks the document and records provenance', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  assert.equal(s.sourceFile, 'docs/prd/auth.md');
  assert.deepEqual(s.chunks.map((c) => c.anchor), ['auth', 'storage']);
  assert.equal(s.applied.auth, undefined);
  rmSync(r, { recursive: true, force: true });
});

test('opening the same unchanged source resumes the existing session', () => {
  const r = root();
  const first = openIngestSession(r, 'docs/prd/auth.md', DOC);
  first.applied.auth = [{ candidateHash: 'h1', itemId: 'REQ-sso', action: 'created', at: '2026-08-15T00:00:00.000Z' }];
  saveSession(r, first);

  const second = openIngestSession(r, 'docs/prd/auth.md', DOC);
  assert.equal(second.id, first.id);
  assert.deepEqual(second.applied.auth, first.applied.auth);
  rmSync(r, { recursive: true, force: true });
});

test('an edited source opens a new session and leaves the old one intact', () => {
  const r = root();
  const first = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, first);
  const second = openIngestSession(r, 'docs/prd/auth.md', DOC + '\n# Extra\n\nMore.\n');
  saveSession(r, second);

  assert.notEqual(second.id, first.id);
  assert.deepEqual(listSessions(r).map((s) => s.id).sort(), [first.id, second.id].sort());
  rmSync(r, { recursive: true, force: true });
});

test('save then load round-trips the whole session', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  s.applied.storage = [{ candidateHash: 'h2', itemId: 'CONST-pg', action: 'created', at: '2026-08-15T00:00:00.000Z' }];
  saveSession(r, s);
  assert.deepEqual(loadSession(r, s.id), s);
  rmSync(r, { recursive: true, force: true });
});

test('the ingest directory is gitignored — sessions are working state, not knowledge', () => {
  const r = root();
  openIngestSession(r, 'docs/prd/auth.md', DOC);
  assert.equal(readFileSync(path.join(ingestDir(r), '.gitignore'), 'utf8').trim(), '*');
  rmSync(r, { recursive: true, force: true });
});

test('pendingAnchors lists chunks not yet applied, in document order', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  assert.deepEqual(pendingAnchors(s), ['auth', 'storage']);
  s.applied.auth = [];
  assert.deepEqual(pendingAnchors(s), ['storage']);
  rmSync(r, { recursive: true, force: true });
});

test('an applied chunk with zero extractions still counts as done', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  s.applied.auth = [];
  s.applied.storage = [];
  assert.deepEqual(pendingAnchors(s), []);
  rmSync(r, { recursive: true, force: true });
});

test('loading an unknown session fails with the id and the directory', () => {
  const r = root();
  assert.throws(() => loadSession(r, 'ING-nope-00000000'), /ING-nope-00000000/);
  rmSync(r, { recursive: true, force: true });
});

test('listSessions ignores unrelated files rather than throwing', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, s);
  assert.equal(listSessions(r).length, 1);
  rmSync(r, { recursive: true, force: true });
});

test('a saved session leaves no temp file behind', () => {
  const r = root();
  const s = openIngestSession(r, 'docs/prd/auth.md', DOC);
  saveSession(r, s);
  const stray = readFileSync(path.join(ingestDir(r), `${s.id}.json`), 'utf8');
  assert.ok(stray.startsWith('{'));
  assert.equal(existsSync(path.join(ingestDir(r), `${s.id}.json.tmp-${process.pid}`)), false);
  rmSync(r, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/ingest/session.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`src/ingest/session.ts`:

```typescript
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { slugify } from '../core/slug.ts';
import { chunkDocument, sourceChecksum, type Chunk } from './chunk.ts';

export const SESSION_PROTOCOL = 'my_context/ingest-session@1';

export interface ApplyRecord {
  candidateHash: string;
  itemId: string;
  action: 'created' | 'deduped' | 'superseded';
  previousId?: string;
  at: string;
}

export interface IngestSession {
  protocol: string;
  id: string;
  /** POSIX, repo-relative. */
  sourceFile: string;
  /** Checksum of the whole document, not of a chunk. */
  sourceChecksum: string;
  createdAt: string;
  chunks: Chunk[];
  /** Keyed by chunk anchor. Presence of the key means "applied", even when empty. */
  applied: Record<string, ApplyRecord[]>;
}

export function ingestDir(root: string): string {
  return path.join(root, '.ingest');
}

export function makeSessionId(sourceFileRel: string, docChecksum: string): string {
  return `ING-${slugify(sourceFileRel)}-${docChecksum.slice(0, 8)}`;
}

function sessionFile(root: string, id: string): string {
  return path.join(ingestDir(root), `${id}.json`);
}

function ensureDir(root: string): string {
  const dir = ingestDir(root);
  mkdirSync(dir, { recursive: true });
  const ignore = path.join(dir, '.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '*\n', 'utf8');
  return dir;
}

/** Temp file + rename, so a crash mid-write never leaves a truncated session. */
export function saveSession(root: string, session: IngestSession): string {
  ensureDir(root);
  const target = sessionFile(root, session.id);
  const tmp = `${target}.tmp-${process.pid}`;
  try {
    writeFileSync(tmp, JSON.stringify(session, null, 2) + '\n', 'utf8');
    renameSync(tmp, target);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
  return target;
}

export function loadSession(root: string, id: string): IngestSession {
  const file = sessionFile(root, id);
  if (!existsSync(file)) {
    throw new Error(
      `my_context: no ingest session "${id}" under ${ingestDir(root)}. ` +
      `Run \`mycontext ingest <path>\` to start one, or \`mycontext ingest-status\` to list them.`,
    );
  }
  return JSON.parse(readFileSync(file, 'utf8')) as IngestSession;
}

export function listSessions(root: string): IngestSession[] {
  const dir = ingestDir(root);
  let names: string[];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith('.json'));
  } catch {
    return [];
  }

  const out: IngestSession[] = [];
  for (const name of names) {
    try {
      const parsed = JSON.parse(readFileSync(path.join(dir, name), 'utf8')) as IngestSession;
      if (parsed.protocol === SESSION_PROTOCOL) out.push(parsed);
    } catch {
      // A corrupt session file is working state, not knowledge. Skip it.
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Open, or resume, the session for this exact document content. The id is
 * derived from the content, so an unchanged source always resumes and an
 * edited source always starts fresh without destroying the earlier record.
 */
export function openIngestSession(root: string, sourceFileRel: string, text: string): IngestSession {
  const docChecksum = sourceChecksum(text);
  const id = makeSessionId(sourceFileRel, docChecksum);

  const file = sessionFile(root, id);
  if (existsSync(file)) {
    try {
      const existing = JSON.parse(readFileSync(file, 'utf8')) as IngestSession;
      if (existing.protocol === SESSION_PROTOCOL && existing.sourceChecksum === docChecksum) {
        ensureDir(root);
        return existing;
      }
    } catch {
      // Fall through and rebuild it.
    }
  }

  ensureDir(root);
  return {
    protocol: SESSION_PROTOCOL,
    id,
    sourceFile: sourceFileRel,
    sourceChecksum: docChecksum,
    createdAt: new Date().toISOString(),
    chunks: chunkDocument(text),
    applied: {},
  };
}

export function pendingAnchors(session: IngestSession): string[] {
  return session.chunks
    .filter((c) => !Object.prototype.hasOwnProperty.call(session.applied, c.anchor))
    .map((c) => c.anchor);
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/ingest/session.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ingest/session.ts test/ingest/session.test.ts
git commit -m "feat: add resumable ingest sessions with content-derived ids"
```

---

## Task 4: Apply candidates — dedupe, supersede, provenance

**Files:**
- Create: `src/ingest/apply.ts`
- Test: `test/ingest/apply.test.ts`

**Interfaces:**
- Consumes: `validateCandidates`, `Candidate`, `ValidationIssue` from `src/ingest/schema.ts`; `IngestSession`, `ApplyRecord` from `src/ingest/session.ts`; `checksum`, `makeId` from `src/core/slug.ts`; `createItem`, `supersedeItem`, `MutateContext`, `CreateItemInput` from `src/core/mutate.ts`
- Produces:
  - `candidateHash(c: Candidate): string`
  - `ingestKey(anchor: string, baseId: string): string`
  - `ApplyResult { anchor: string; created: string[]; deduped: string[]; superseded: { previous: string; next: string }[]; issues: ValidationIssue[] }`
  - `applyCandidates(ctx: MutateContext, session: IngestSession, anchor: string, raw: unknown): ApplyResult`

This is the task that satisfies spec §7.2 — *"Re-ingesting the same source dedupes by content hash; a materially changed item gets `supersedes` wired to its predecessor rather than silently duplicating."*

Three identity rules, applied in this order:

1. **Content-hash match anywhere in the same source file → dedupe.** This also covers an item that moved to a different heading: identical content is the same knowledge.
2. **Ingest-key match (same anchor + same title slug) with a different hash → supersede.** The replacement is created with an explicit `-r2`, `-r3` … id so it never collides with its own predecessor, and `supersedeItem` wires the `supersedes` relation.
3. **Otherwise → create.**

Every write goes in as `status: 'draft'`, `origin: 'ingest'`, with `source_file`, `source_anchor` and `source_checksum` populated (spec §3.2). The content hash and ingest key are stored in `extra` so identity survives a `rebuild` from Markdown — nothing here depends on the disposable index.

- [ ] **Step 1: Write the failing test**

`test/ingest/apply.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { applyCandidates, candidateHash } from '../../src/ingest/apply.ts';
import { openIngestSession } from '../../src/ingest/session.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { Store } from '../../src/core/store.ts';
import type { MutateContext } from '../../src/core/mutate.ts';

const DOC = `# Password policy\n\nPasswords must be at least 12 characters.\nSessions expire after 30 minutes.\n`;

function fixture(): { ctx: MutateContext; root: string; cleanup: () => void } {
  const base = mkdtempSync(path.join(tmpdir(), 'myctx-apply-'));
  const root = path.join(base, '.my_context');
  mkdirSync(path.join(root, 'items'), { recursive: true });
  const store = Store.open(':memory:');
  const ctx: MutateContext = { root, config: resolveConfig({}), store, caller: 'user' };
  return { ctx, root, cleanup: () => { store.close(); rmSync(base, { recursive: true, force: true }); } };
}

function candidate(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'requirement',
    title: 'Passwords are at least 12 characters',
    body: 'Enforced at registration and at password change.',
    quote: 'Passwords must be at least 12 characters.',
    ...over,
  };
}

test('a new candidate is created as a draft with full provenance', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  const result = applyCandidates(ctx, session, 'password-policy', [candidate()]);

  assert.deepEqual(result.issues, []);
  assert.equal(result.created.length, 1);

  const item = ctx.store.get(result.created[0]);
  assert.ok(item);
  assert.equal(item.status, 'draft');
  assert.equal(item.origin, 'ingest');
  assert.equal(item.sourceFile, 'docs/prd/auth.md');
  assert.equal(item.sourceAnchor, 'password-policy');
  assert.equal(item.sourceChecksum, session.chunks[0].checksum);
  cleanup();
});

test('nothing ingested is ever active', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  applyCandidates(ctx, session, 'password-policy', [
    candidate(),
    candidate({ title: 'Sessions expire after 30 minutes', quote: 'Sessions expire after 30 minutes.' }),
  ]);
  assert.equal(ctx.store.all().length, 2);
  assert.equal(ctx.store.all().every((i) => i.status === 'draft'), true);
  cleanup();
});

test('re-applying identical candidates dedupes rather than duplicating', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  const first = applyCandidates(ctx, session, 'password-policy', [candidate()]);
  const second = applyCandidates(ctx, session, 'password-policy', [candidate()]);

  assert.deepEqual(second.created, []);
  assert.deepEqual(second.deduped, first.created);
  assert.equal(ctx.store.all().length, 1);
  cleanup();
});

test('identical content under a different anchor still dedupes', () => {
  const { ctx, root, cleanup } = fixture();
  const doc = `${DOC}\n# Repeated\n\nPasswords must be at least 12 characters.\n`;
  const session = openIngestSession(root, 'docs/prd/auth.md', doc);
  applyCandidates(ctx, session, 'password-policy', [candidate()]);
  const again = applyCandidates(ctx, session, 'repeated', [candidate()]);

  assert.equal(again.deduped.length, 1);
  assert.equal(ctx.store.all().length, 1);
  cleanup();
});

test('a materially changed item supersedes its predecessor instead of duplicating', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  const first = applyCandidates(ctx, session, 'password-policy', [candidate()]);
  const changed = applyCandidates(ctx, session, 'password-policy', [
    candidate({ body: 'Enforced at registration, change, and by the password reset flow.' }),
  ]);

  assert.equal(changed.superseded.length, 1);
  assert.equal(changed.superseded[0].previous, first.created[0]);
  assert.notEqual(changed.superseded[0].next, first.created[0]);

  const previous = ctx.store.get(first.created[0]);
  const next = ctx.store.get(changed.superseded[0].next);
  assert.equal(previous?.status, 'superseded');
  assert.equal(next?.status, 'draft');
  assert.deepEqual(
    next?.relations.filter((r) => r.type === 'supersedes'),
    [{ type: 'supersedes', target: first.created[0] }],
  );
  cleanup();
});

test('a second material change chains to r3 without colliding', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  applyCandidates(ctx, session, 'password-policy', [candidate()]);
  applyCandidates(ctx, session, 'password-policy', [candidate({ body: 'Second wording.' })]);
  const third = applyCandidates(ctx, session, 'password-policy', [candidate({ body: 'Third wording.' })]);

  assert.equal(third.superseded.length, 1);
  assert.equal(new Set(ctx.store.all().map((i) => i.id)).size, 3);
  assert.equal(ctx.store.all().filter((i) => i.status === 'draft').length, 1);
  cleanup();
});

test('a bad candidate is reported while its good siblings are still written', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  const result = applyCandidates(ctx, session, 'password-policy', [
    candidate(),
    candidate({ type: 'nonsense', title: 'Bad one' }),
  ]);

  assert.equal(result.created.length, 1);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].title, 'Bad one');
  assert.equal(ctx.store.all().length, 1);
  cleanup();
});

test('applying records the outcome on the session, including an empty extraction', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  applyCandidates(ctx, session, 'password-policy', []);
  assert.deepEqual(session.applied['password-policy'], []);
  cleanup();
});

test('an unknown anchor fails loudly and lists the real anchors', () => {
  const { ctx, root, cleanup } = fixture();
  const session = openIngestSession(root, 'docs/prd/auth.md', DOC);
  assert.throws(
    () => applyCandidates(ctx, session, 'not-a-heading', [candidate()]),
    /not-a-heading[\s\S]*password-policy/,
  );
  cleanup();
});

test('candidateHash ignores whitespace but not wording', () => {
  const base = { type: 'requirement', title: 'A', body: 'B', quote: 'q', severity: 'soft' as const, scope: [], tags: [], observations: [], extra: {} };
  assert.equal(candidateHash(base), candidateHash({ ...base, title: '  A  ' }));
  assert.equal(candidateHash(base), candidateHash({ ...base, quote: 'a different quote' }));
  assert.notEqual(candidateHash(base), candidateHash({ ...base, body: 'C' }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/ingest/apply.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`src/ingest/apply.ts`:

```typescript
import { checksum, makeId } from '../core/slug.ts';
import { createItem, supersedeItem, type CreateItemInput, type MutateContext } from '../core/mutate.ts';
import type { Item } from '../core/types.ts';
import { validateCandidates, type Candidate, type ValidationIssue } from './schema.ts';
import type { ApplyRecord, IngestSession } from './session.ts';

/**
 * The dedupe key. Covers what the item *says*, deliberately excluding `quote`
 * and `scope`: re-quoting a different sentence for the same requirement is not
 * a material change, and re-scoping is an edit the user makes during review.
 */
export function candidateHash(c: Candidate): string {
  const flat = (s: string): string => s.trim().replace(/\s+/g, ' ');
  return checksum(JSON.stringify({
    type: c.type,
    title: flat(c.title),
    body: flat(c.body),
    severity: c.severity,
    observations: c.observations.map((o) => [o.category, flat(o.text)]),
    extra: Object.entries(c.extra).sort(([a], [b]) => a.localeCompare(b)),
  }));
}

/** Identity of "the same item, re-extracted": same heading, same title slug. */
export function ingestKey(anchor: string, baseId: string): string {
  return `${anchor}::${baseId}`;
}

export interface ApplyResult {
  anchor: string;
  created: string[];
  deduped: string[];
  superseded: { previous: string; next: string }[];
  issues: ValidationIssue[];
}

/** CONST-a → CONST-a-r2 → CONST-a-r3. Never reuses a live id. */
function nextRevisionId(baseId: string, taken: Set<string>): string {
  if (!taken.has(baseId)) return baseId;
  for (let revision = 2; ; revision++) {
    const candidate = `${baseId}-r${revision}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export function applyCandidates(
  ctx: MutateContext, session: IngestSession, anchor: string, raw: unknown,
): ApplyResult {
  const chunk = session.chunks.find((c) => c.anchor === anchor);
  if (!chunk) {
    throw new Error(
      `my_context: ingest session ${session.id} has no chunk "${anchor}". ` +
      `Known anchors: ${session.chunks.map((c) => c.anchor).join(', ')}.`,
    );
  }

  const { valid, issues } = validateCandidates(raw, ctx.config, chunk);
  const result: ApplyResult = { anchor, created: [], deduped: [], superseded: [], issues };

  const everything = ctx.store.all();
  const takenIds = new Set(everything.map((i) => i.id));
  const fromSource = everything.filter((i) => i.sourceFile === session.sourceFile);

  const byHash = new Map<string, Item>();
  const byKey = new Map<string, Item>();
  for (const item of fromSource) {
    const hash = item.extra.content_hash;
    if (hash && !byHash.has(hash)) byHash.set(hash, item);
    const key = item.extra.ingest_key;
    // The head of a supersession chain is the one that is not itself superseded.
    if (key && item.status !== 'superseded') byKey.set(key, item);
  }

  const records: ApplyRecord[] = session.applied[anchor] ?? [];
  const at = new Date().toISOString();

  for (const candidate of valid) {
    const hash = candidateHash(candidate);
    const prefix = ctx.config.categories[candidate.type].prefix;
    const baseId = makeId(prefix, candidate.title);
    const key = ingestKey(anchor, baseId);

    const identical = byHash.get(hash);
    if (identical) {
      result.deduped.push(identical.id);
      records.push({ candidateHash: hash, itemId: identical.id, action: 'deduped', at });
      continue;
    }

    const input: CreateItemInput = {
      type: candidate.type,
      title: candidate.title,
      body: candidate.body,
      status: 'draft',
      origin: 'ingest',
      severity: candidate.severity,
      always: false,
      scope: candidate.scope,
      tags: candidate.tags,
      sourceFile: session.sourceFile,
      sourceAnchor: anchor,
      sourceChecksum: chunk.checksum,
      extra: { ...candidate.extra, content_hash: hash, ingest_key: key },
      observations: candidate.observations.map((o) => ({
        category: o.category, text: o.text, tags: o.tags, context: null,
      })),
      relations: [],
    };

    const previous = byKey.get(key);
    if (previous) {
      input.id = nextRevisionId(baseId, takenIds);
      const outcome = supersedeItem(ctx, previous.id, input);
      takenIds.add(outcome.item.id);
      byHash.set(hash, outcome.item);
      byKey.set(key, outcome.item);
      result.superseded.push({ previous: previous.id, next: outcome.item.id });
      records.push({ candidateHash: hash, itemId: outcome.item.id, action: 'superseded', previousId: previous.id, at });
      continue;
    }

    input.id = nextRevisionId(baseId, takenIds);
    const outcome = createItem(ctx, input);
    takenIds.add(outcome.item.id);
    byHash.set(hash, outcome.item);
    byKey.set(key, outcome.item);
    result.created.push(outcome.item.id);
    records.push({ candidateHash: hash, itemId: outcome.item.id, action: 'created', at });
  }

  session.applied[anchor] = records;
  return result;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/ingest/apply.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ingest/apply.ts test/ingest/apply.test.ts
git commit -m "feat: apply extracted candidates as drafts with dedupe and supersession"
```

---

## Task 5: The extraction request — the half the host agent reads

**Files:**
- Create: `src/ingest/request.ts`
- Test: `test/ingest/request.test.ts`

**Interfaces:**
- Consumes: `CANDIDATE_SCHEMA`, `MAX_TITLE` from `src/ingest/schema.ts`; `Chunk` from `src/ingest/chunk.ts`; `IngestSession`, `pendingAnchors` from `src/ingest/session.ts`; `Config` from `src/core/config.ts`
- Produces:
  - `EXTRACTION_PROTOCOL: string`
  - `ExtractionRequest { protocol; session; sourceFile; anchor; chunkIndex; totalChunks; remaining; heading; categories; schema; chunk; callback; instructions }`
  - `buildExtractionRequest(session: IngestSession, chunk: Chunk, config: Config): ExtractionRequest`
  - `renderExtractionRequest(request: ExtractionRequest): string`
  - `nextRequest(session: IngestSession, config: Config): ExtractionRequest | null`

This is the artefact that makes host-agent extraction work. It must be **self-contained**: an agent reading only this block must know what to produce, what the legal categories are in *this* project, and the exact command to call back with. Nothing may be left to convention.

- [ ] **Step 1: Write the failing test**

`test/ingest/request.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExtractionRequest, renderExtractionRequest, nextRequest, EXTRACTION_PROTOCOL } from '../../src/ingest/request.ts';
import { openIngestSession } from '../../src/ingest/session.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DOC = `# Auth\n\nMust support SSO.\n\n# Storage\n\nPostgres only.\n`;
const CONFIG = resolveConfig({});

function session() {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-req-'));
  const s = openIngestSession(root, 'docs/prd/auth.md', DOC);
  return { s, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('a request carries the chunk, its position and its provenance', () => {
  const { s, cleanup } = session();
  const req = buildExtractionRequest(s, s.chunks[0], CONFIG);
  assert.equal(req.protocol, EXTRACTION_PROTOCOL);
  assert.equal(req.session, s.id);
  assert.equal(req.sourceFile, 'docs/prd/auth.md');
  assert.equal(req.anchor, 'auth');
  assert.equal(req.chunkIndex, 0);
  assert.equal(req.totalChunks, 2);
  assert.match(req.chunk, /Must support SSO/);
  cleanup();
});

test('only enabled categories are offered, each with its description', () => {
  const { s, cleanup } = session();
  const req = buildExtractionRequest(s, s.chunks[0], CONFIG);
  const names = req.categories.map((c) => c.name);
  assert.ok(names.includes('constraint'));
  assert.equal(names.includes('policy'), false, 'policy is off in the standard profile');
  assert.ok(req.categories.every((c) => c.description.length > 0));
  cleanup();
});

test('a category with extra fields advertises them so the agent can fill them', () => {
  const { s, cleanup } = session();
  const req = buildExtractionRequest(s, s.chunks[0], CONFIG);
  const rule = req.categories.find((c) => c.name === 'rule');
  assert.deepEqual(rule?.extraFields, ['directive']);
  cleanup();
});

test('the callback names both the CLI command and the MCP tool call', () => {
  const { s, cleanup } = session();
  const req = buildExtractionRequest(s, s.chunks[0], CONFIG);
  assert.match(req.callback.cli, /ingest-apply/);
  assert.match(req.callback.cli, new RegExp(s.id));
  assert.match(req.callback.cli, /--anchor auth/);
  assert.equal(req.callback.mcp.tool, 'ingest_document');
  assert.equal(req.callback.mcp.arguments.session, s.id);
  assert.equal(req.callback.mcp.arguments.anchor, 'auth');
  cleanup();
});

test('the instructions state that the agent is the extractor and must not paraphrase quotes', () => {
  const { s, cleanup } = session();
  const req = buildExtractionRequest(s, s.chunks[0], CONFIG);
  const text = req.instructions.join(' ');
  assert.match(text, /you are the extractor/i);
  assert.match(text, /verbatim/i);
  assert.match(text, /\[\]/, 'must say to return an empty array when nothing is normative');
  cleanup();
});

test('nextRequest walks pending chunks in order and returns null when done', () => {
  const { s, cleanup } = session();
  assert.equal(nextRequest(s, CONFIG)?.anchor, 'auth');
  s.applied.auth = [];
  assert.equal(nextRequest(s, CONFIG)?.anchor, 'storage');
  s.applied.storage = [];
  assert.equal(nextRequest(s, CONFIG), null);
  cleanup();
});

test('remaining counts chunks still pending, including this one', () => {
  const { s, cleanup } = session();
  assert.equal(buildExtractionRequest(s, s.chunks[0], CONFIG).remaining, 2);
  s.applied.auth = [];
  assert.equal(buildExtractionRequest(s, s.chunks[1], CONFIG).remaining, 1);
  cleanup();
});

test('the rendered block embeds parseable JSON and uses LF only', () => {
  const { s, cleanup } = session();
  const text = renderExtractionRequest(buildExtractionRequest(s, s.chunks[0], CONFIG));
  assert.equal(text.includes('\r'), false);
  const json = text.slice(text.indexOf('```json') + 7, text.lastIndexOf('```'));
  const parsed = JSON.parse(json) as { protocol: string };
  assert.equal(parsed.protocol, EXTRACTION_PROTOCOL);
  cleanup();
});

test('the rendered block leads with a human-readable heading naming the source', () => {
  const { s, cleanup } = session();
  const text = renderExtractionRequest(buildExtractionRequest(s, s.chunks[0], CONFIG));
  assert.match(text.split('\n')[0], /EXTRACTION REQUEST/);
  assert.match(text, /docs\/prd\/auth\.md/);
  cleanup();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/ingest/request.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`src/ingest/request.ts`:

```typescript
import type { Config } from '../core/config.ts';
import type { Chunk } from './chunk.ts';
import { CANDIDATE_SCHEMA, MAX_TITLE } from './schema.ts';
import { pendingAnchors, type IngestSession } from './session.ts';

export const EXTRACTION_PROTOCOL = 'my_context/extraction-request@1';

export interface RequestCategory {
  name: string;
  description: string;
  extraFields: string[];
}

export interface ExtractionRequest {
  protocol: string;
  session: string;
  sourceFile: string;
  anchor: string;
  chunkIndex: number;
  totalChunks: number;
  /** Chunks still pending, counting this one. */
  remaining: number;
  heading: string | null;
  categories: RequestCategory[];
  schema: Record<string, unknown>;
  chunk: string;
  callback: {
    cli: string;
    mcp: { tool: string; arguments: Record<string, unknown> };
  };
  instructions: string[];
}

function instructionsFor(request: Omit<ExtractionRequest, 'instructions'>): string[] {
  return [
    'You are the extractor. my_context has no model of its own and never calls one — it hands you the text and validates what you return.',
    `Read the chunk below, taken from ${request.sourceFile} under the anchor "${request.anchor}", and extract every piece of NORMATIVE knowledge it establishes: things that must hold, must be built, must not be done, or are deliberately left open.`,
    'Do not extract narrative, status updates, or descriptions of what was done — that is claude-mem\'s job, not this one.',
    `Emit a JSON array matching the "schema" field. Return [] when the chunk establishes nothing normative — that is a correct and common answer.`,
    'Every candidate MUST carry a "quote": a span copied VERBATIM from the chunk. It is checked by exact match after whitespace collapsing, and a paraphrase is rejected. This is how an invented item is caught.',
    `Titles are one declarative sentence, at most ${MAX_TITLE} characters. Put the reasoning in "body".`,
    'Set "scope" only to the directories the item actually governs, as POSIX globs such as "src/auth/**". A bare "**" is rejected. Omitting scope is safe: the item is still indexed and searchable, it is simply never auto-injected.',
    'Everything you return lands as status "draft". Nothing you extract governs future work until a human promotes it with `mycontext review promote <id>`.',
    `Then call back with the results. CLI: ${request.callback.cli}   MCP: ${request.callback.mcp.tool} with {"session": "${request.session}", "anchor": "${request.anchor}", "candidates": [...]}.`,
    request.remaining > 1
      ? `${request.remaining} chunks remain in this document; the callback returns the next request automatically.`
      : 'This is the last pending chunk in this document.',
  ];
}

export function buildExtractionRequest(
  session: IngestSession, chunk: Chunk, config: Config,
): ExtractionRequest {
  const categories: RequestCategory[] = Object.values(config.categories)
    .filter((c) => c.enabled)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ name: c.name, description: c.description, extraFields: c.extraFields }));

  const pending = pendingAnchors(session);
  const remaining = pending.includes(chunk.anchor) ? pending.length : pending.length + 1;

  const partial: Omit<ExtractionRequest, 'instructions'> = {
    protocol: EXTRACTION_PROTOCOL,
    session: session.id,
    sourceFile: session.sourceFile,
    anchor: chunk.anchor,
    chunkIndex: chunk.index,
    totalChunks: session.chunks.length,
    remaining,
    heading: chunk.heading,
    categories,
    schema: CANDIDATE_SCHEMA,
    chunk: chunk.text,
    callback: {
      cli: `mycontext ingest-apply ${session.id} --anchor ${chunk.anchor} --stdin`,
      mcp: {
        tool: 'ingest_document',
        arguments: { session: session.id, anchor: chunk.anchor, candidates: '<your JSON array here>' },
      },
    },
  };

  return { ...partial, instructions: instructionsFor(partial) };
}

export function renderExtractionRequest(request: ExtractionRequest): string {
  const header = [
    `my_context EXTRACTION REQUEST — ${request.sourceFile} § ${request.anchor} ` +
    `(chunk ${request.chunkIndex + 1} of ${request.totalChunks}, ${request.remaining} pending)`,
    '',
    ...request.instructions.map((line) => `- ${line}`),
    '',
    '```json',
    JSON.stringify(request, null, 2),
    '```',
  ];
  return header.join('\n').replace(/\r/g, '') + '\n';
}

/** The next chunk awaiting extraction, in document order. */
export function nextRequest(session: IngestSession, config: Config): ExtractionRequest | null {
  const anchor = pendingAnchors(session)[0];
  if (anchor === undefined) return null;
  const chunk = session.chunks.find((c) => c.anchor === anchor);
  return chunk ? buildExtractionRequest(session, chunk, config) : null;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/ingest/request.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ingest/request.ts test/ingest/request.test.ts
git commit -m "feat: emit self-contained extraction requests for the host agent"
```

---

## Task 6: The command registry and the `ingest` CLI commands

**Files:**
- Create: `src/cli/commands/registry.ts`, `src/cli/commands/context.ts`, `src/cli/commands/ingest.ts`, `src/cli/commands/index.ts`
- Modify: `src/cli/index.ts` (turn `USAGE` into `usage()`, consult the registry)
- Test: `test/cli/ingest.test.ts`

**Interfaces:**
- Consumes: `Workspace`, `resolveWorkspace` from `src/core/workspace.ts`; `Store` from `src/core/store.ts`; `rebuild` from `src/core/rebuild.ts`; `MutateContext` from `src/core/mutate.ts`; everything from `src/ingest/*`
- Produces:
  - `Emit = (s: string) => void`
  - `CommandFn = (ws: Workspace, args: string[], out: Emit, cwd: string) => number`
  - `CommandDef { name: string; usage: string; summary: string; run: CommandFn }`
  - `COMMANDS: Map<string, CommandDef>`, `registerCommand(def: CommandDef): void`
  - `openMutateContext(ws: Workspace): MutateContext`, `flag(args: string[], name: string): string | null`, `hasFlag(args: string[], name: string): boolean`, `readPayload(args: string[]): unknown`

A registry rather than more `switch` arms: Plan 3 adds commands to the same CLI, and two plans editing one `switch` is a guaranteed merge conflict. `src/cli/index.ts` is touched exactly once, here.

- [ ] **Step 1: Write the failing test**

`test/cli/ingest.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';

const DOC = `# Password policy\n\nPasswords must be at least 12 characters.\n\n# Storage\n\nPostgres only, no MySQL.\n`;

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-cli-ing-'));
  runCli(['init'], cwd, () => {});
  mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  writeFileSync(path.join(cwd, 'docs', 'prd.md'), DOC, 'utf8');
  return cwd;
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function sessionId(out: string): string {
  const match = /ING-[a-z0-9-]+/.exec(out);
  assert.ok(match, `no session id in output:\n${out}`);
  return match[0];
}

test('ingest prints an extraction request for the first chunk', () => {
  const cwd = project();
  const { code, out } = run(['ingest', 'docs/prd.md'], cwd);
  assert.equal(code, 0);
  assert.match(out, /EXTRACTION REQUEST/);
  assert.match(out, /password-policy/);
  assert.match(out, /Passwords must be at least 12 characters/);
  rmSync(cwd, { recursive: true, force: true });
});

test('ingest accepts a native Windows-style relative path and stores it POSIX', () => {
  const cwd = project();
  const { out } = run(['ingest', 'docs\\prd.md'], cwd);
  assert.match(out, /"sourceFile": "docs\/prd\.md"/);
  rmSync(cwd, { recursive: true, force: true });
});

test('ingest on a missing file explains rather than throwing', () => {
  const cwd = project();
  const { code, out } = run(['ingest', 'docs/nope.md'], cwd);
  assert.equal(code, 1);
  assert.match(out, /docs\/nope\.md/);
  rmSync(cwd, { recursive: true, force: true });
});

test('ingest with no path prints its usage', () => {
  const cwd = project();
  const { code, out } = run(['ingest'], cwd);
  assert.equal(code, 1);
  assert.match(out, /usage: mycontext ingest/);
  rmSync(cwd, { recursive: true, force: true });
});

test('ingest --anchor jumps to a named chunk', () => {
  const cwd = project();
  const { out } = run(['ingest', 'docs/prd.md', '--anchor', 'storage'], cwd);
  assert.match(out, /Postgres only, no MySQL/);
  rmSync(cwd, { recursive: true, force: true });
});

test('ingest-apply writes drafts and then offers the next chunk', () => {
  const cwd = project();
  const id = sessionId(run(['ingest', 'docs/prd.md'], cwd).out);
  const payload = JSON.stringify([{
    type: 'requirement',
    title: 'Passwords are at least 12 characters',
    body: 'Enforced at registration.',
    quote: 'Passwords must be at least 12 characters.',
  }]);
  writeFileSync(path.join(cwd, 'c.json'), payload, 'utf8');

  const { code, out } = run(['ingest-apply', id, '--anchor', 'password-policy', '--file', 'c.json'], cwd);
  assert.equal(code, 0);
  assert.match(out, /created 1/);
  assert.match(out, /REQ-passwords-are-at-least-12-characters/);
  assert.match(out, /EXTRACTION REQUEST/, 'the next pending chunk is offered automatically');
  assert.match(out, /Postgres only/);

  const listed = run(['list'], cwd).out;
  assert.match(listed, /REQ-passwords-are-at-least-12-characters\s+requirement\s+draft/);
  rmSync(cwd, { recursive: true, force: true });
});

test('ingest-apply reports issues and still keeps the good candidates', () => {
  const cwd = project();
  const id = sessionId(run(['ingest', 'docs/prd.md'], cwd).out);
  writeFileSync(path.join(cwd, 'c.json'), JSON.stringify([
    { type: 'requirement', title: 'Good one', body: 'b', quote: 'Passwords must be at least 12 characters.' },
    { type: 'nonsense', title: 'Bad one', body: 'b', quote: 'Passwords must be at least 12 characters.' },
  ]), 'utf8');

  const { code, out } = run(['ingest-apply', id, '--anchor', 'password-policy', '--file', 'c.json'], cwd);
  assert.equal(code, 0, 'a partial success is still a success');
  assert.match(out, /created 1/);
  assert.match(out, /1 candidate rejected/);
  assert.match(out, /Bad one/);
  rmSync(cwd, { recursive: true, force: true });
});

test('ingest-apply with malformed JSON names the parse error', () => {
  const cwd = project();
  const id = sessionId(run(['ingest', 'docs/prd.md'], cwd).out);
  writeFileSync(path.join(cwd, 'c.json'), '{ not json', 'utf8');
  const { code, out } = run(['ingest-apply', id, '--anchor', 'password-policy', '--file', 'c.json'], cwd);
  assert.equal(code, 1);
  assert.match(out, /not valid JSON/i);
  rmSync(cwd, { recursive: true, force: true });
});

test('re-running ingest on an unchanged document resumes and skips applied chunks', () => {
  const cwd = project();
  const id = sessionId(run(['ingest', 'docs/prd.md'], cwd).out);
  writeFileSync(path.join(cwd, 'c.json'), '[]', 'utf8');
  run(['ingest-apply', id, '--anchor', 'password-policy', '--file', 'c.json'], cwd);

  const { out } = run(['ingest', 'docs/prd.md'], cwd);
  assert.match(out, new RegExp(id));
  assert.match(out, /Postgres only/);
  assert.equal(/Passwords must be at least 12 characters\.\\n/.test(out), false);
  rmSync(cwd, { recursive: true, force: true });
});

test('ingest reports completion once every chunk is applied', () => {
  const cwd = project();
  const id = sessionId(run(['ingest', 'docs/prd.md'], cwd).out);
  writeFileSync(path.join(cwd, 'c.json'), '[]', 'utf8');
  run(['ingest-apply', id, '--anchor', 'password-policy', '--file', 'c.json'], cwd);
  run(['ingest-apply', id, '--anchor', 'storage', '--file', 'c.json'], cwd);

  const { code, out } = run(['ingest', 'docs/prd.md'], cwd);
  assert.equal(code, 0);
  assert.match(out, /every chunk applied/i);
  rmSync(cwd, { recursive: true, force: true });
});

test('ingest-status lists sessions with their progress', () => {
  const cwd = project();
  const id = sessionId(run(['ingest', 'docs/prd.md'], cwd).out);
  writeFileSync(path.join(cwd, 'c.json'), '[]', 'utf8');
  run(['ingest-apply', id, '--anchor', 'password-policy', '--file', 'c.json'], cwd);
  const { out } = run(['ingest-status'], cwd);
  assert.match(out, new RegExp(`${id}\\s+docs/prd\\.md\\s+1/2`));
  rmSync(cwd, { recursive: true, force: true });
});

test('the registered commands appear in usage', () => {
  const cwd = project();
  const { out } = run(['help'], cwd);
  assert.match(out, /ingest <path>/);
  assert.match(out, /ingest-apply/);
  rmSync(cwd, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cli/ingest.test.ts`
Expected: FAIL — `Cannot find module '../../src/cli/commands/registry.ts'` (via `src/cli/index.ts`)

- [ ] **Step 3: Implement the registry**

`src/cli/commands/registry.ts`:

```typescript
import type { Workspace } from '../../core/workspace.ts';

export type Emit = (s: string) => void;

/** Returns the process exit code. Never throws — commands report and return 1. */
export type CommandFn = (ws: Workspace, args: string[], out: Emit, cwd: string) => number;

export interface CommandDef {
  name: string;
  /** The usage column, e.g. "ingest <path>". */
  usage: string;
  summary: string;
  run: CommandFn;
}

export const COMMANDS = new Map<string, CommandDef>();

export function registerCommand(def: CommandDef): void {
  if (COMMANDS.has(def.name)) {
    throw new Error(`my_context: command "${def.name}" is already registered.`);
  }
  COMMANDS.set(def.name, def);
}

/** `--name value` → value; `--name=value` → value; absent → null. */
export function flag(args: string[], name: string): string | null {
  const long = `--${name}`;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === long) return args[i + 1] ?? null;
    if (args[i].startsWith(`${long}=`)) return args[i].slice(long.length + 1);
  }
  return null;
}

export function hasFlag(args: string[], name: string): boolean {
  const long = `--${name}`;
  return args.some((a) => a === long || a.startsWith(`${long}=`));
}

/** Positional arguments, i.e. everything that is not a flag or a flag's value. */
export function positionals(args: string[], valueFlags: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const name = arg.slice(2).split('=')[0];
      if (valueFlags.includes(name) && !arg.includes('=')) i++;
      continue;
    }
    out.push(arg);
  }
  return out;
}
```

- [ ] **Step 4: Implement the mutate context helper**

`src/cli/commands/context.ts`:

```typescript
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { rebuild } from '../../core/rebuild.ts';
import { Store } from '../../core/store.ts';
import type { MutateContext } from '../../core/mutate.ts';
import type { Workspace } from '../../core/workspace.ts';
import { flag } from './registry.ts';

/**
 * A fully indexed MutateContext. Commands in this plan are user-invoked, so
 * `caller` is always 'user' — the trust model in spec §7.1 draws its line at
 * the caller, and the CLI is the user. Agent-side calls arrive through the MCP
 * server, which builds its own context with caller: 'agent'.
 */
export function openMutateContext(ws: Workspace): MutateContext {
  if (!ws.projectRoot) {
    throw new Error('my_context: no workspace here. Run `mycontext init` to create one.');
  }
  const store = Store.open(ws.dbPath);
  rebuild(store, {
    project: ws.projectRoot,
    global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined,
  });
  return { root: ws.projectRoot, config: ws.config, store, caller: 'user' };
}

/**
 * Read a JSON payload from `--file <path>` or `--stdin`. Reading fd 0
 * synchronously is how a `node --test` process and a piping shell both work
 * without an async CLI.
 */
export function readPayload(args: string[], cwd: string): unknown {
  const file = flag(args, 'file');
  const source = file
    ? readFileSync(path.resolve(cwd, file), 'utf8')
    : readFileSync(0, 'utf8');
  try {
    return JSON.parse(source);
  } catch (err) {
    throw new Error(
      `my_context: the candidates payload is not valid JSON: ` +
      `${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
```

- [ ] **Step 5: Implement the ingest commands**

`src/cli/commands/ingest.ts`:

```typescript
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { relPosix, toPosix } from '../../core/paths.ts';
import { applyCandidates } from '../../ingest/apply.ts';
import { buildExtractionRequest, nextRequest, renderExtractionRequest } from '../../ingest/request.ts';
import { listSessions, loadSession, openIngestSession, pendingAnchors, saveSession } from '../../ingest/session.ts';
import type { Workspace } from '../../core/workspace.ts';
import { openMutateContext, readPayload } from './context.ts';
import { flag, positionals, registerCommand, type Emit } from './registry.ts';

/** The repo root is the parent of `.my_context`. Source paths are relative to it. */
function repoRoot(ws: Workspace): string {
  return path.dirname(ws.projectRoot as string);
}

function requireWorkspace(ws: Workspace, out: Emit): boolean {
  if (ws.projectRoot) return true;
  out('my_context: no workspace here. Run `mycontext init` to create one.');
  return false;
}

function cmdIngest(ws: Workspace, args: string[], out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;

  const [target] = positionals(args, ['anchor']);
  if (!target) {
    out('usage: mycontext ingest <path> [--anchor <anchor>]');
    return 1;
  }

  const repo = repoRoot(ws);
  const absolute = path.resolve(repo, toPosix(target));
  if (!existsSync(absolute)) {
    out(`my_context: no such file "${toPosix(target)}" (looked in ${repo}).`);
    return 1;
  }

  const rel = relPosix(repo, absolute);
  const session = openIngestSession(ws.projectRoot as string, rel, readFileSync(absolute, 'utf8'));
  saveSession(ws.projectRoot as string, session);

  const anchor = flag(args, 'anchor');
  if (anchor) {
    const chunk = session.chunks.find((c) => c.anchor === anchor);
    if (!chunk) {
      out(
        `my_context: session ${session.id} has no chunk "${anchor}". ` +
        `Known anchors: ${session.chunks.map((c) => c.anchor).join(', ')}.`,
      );
      return 1;
    }
    out(renderExtractionRequest(buildExtractionRequest(session, chunk, ws.config)));
    return 0;
  }

  const request = nextRequest(session, ws.config);
  if (!request) {
    out(
      `my_context: session ${session.id} for ${rel} has every chunk applied ` +
      `(${session.chunks.length}/${session.chunks.length}). ` +
      `Review what it produced with \`mycontext review\`.`,
    );
    return 0;
  }

  out(renderExtractionRequest(request));
  return 0;
}

function cmdIngestApply(ws: Workspace, args: string[], out: Emit, cwd: string): number {
  if (!requireWorkspace(ws, out)) return 1;

  const [id] = positionals(args, ['anchor', 'file']);
  const anchor = flag(args, 'anchor');
  if (!id || !anchor) {
    out('usage: mycontext ingest-apply <session-id> --anchor <anchor> (--file <path> | --stdin)');
    return 1;
  }

  const root = ws.projectRoot as string;
  let payload: unknown;
  let session;
  try {
    session = loadSession(root, id);
    payload = readPayload(args, cwd);
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  }

  const ctx = openMutateContext(ws);
  try {
    const result = applyCandidates(ctx, session, anchor, payload);
    saveSession(root, session);

    out(
      `my_context: ${anchor} — created ${result.created.length}, ` +
      `deduped ${result.deduped.length}, superseded ${result.superseded.length}.`,
    );
    for (const created of result.created) out(`  created     ${created}`);
    for (const deduped of result.deduped) out(`  unchanged   ${deduped}`);
    for (const pair of result.superseded) out(`  superseded  ${pair.previous} -> ${pair.next}`);

    if (result.issues.length) {
      out('');
      out(`${result.issues.length} candidate rejected — every valid sibling above was still written:`);
      for (const issue of result.issues) {
        out(`  [${issue.index}] ${issue.title ?? '(untitled)'}: ${issue.message}`);
      }
    }

    const remaining = pendingAnchors(session);
    out('');
    if (remaining.length === 0) {
      out(
        `my_context: every chunk of ${session.sourceFile} is applied. ` +
        `Promote what you want with \`mycontext review\`.`,
      );
      return 0;
    }

    const request = nextRequest(session, ws.config);
    if (request) out(renderExtractionRequest(request));
    return 0;
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  } finally {
    ctx.store.close();
  }
}

function cmdIngestStatus(ws: Workspace, args: string[], out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;

  const sessions = listSessions(ws.projectRoot as string);
  if (sessions.length === 0) {
    out('my_context: no ingest sessions. Start one with `mycontext ingest <path>`.');
    return 0;
  }

  for (const session of sessions) {
    const done = session.chunks.length - pendingAnchors(session).length;
    out(`${session.id.padEnd(40)}${session.sourceFile.padEnd(40)}${done}/${session.chunks.length}`);
  }
  return 0;
}

registerCommand({
  name: 'ingest',
  usage: 'ingest <path>',
  summary: 'emit an extraction request for a document (you are the extractor)',
  run: cmdIngest,
});

registerCommand({
  name: 'ingest-apply',
  usage: 'ingest-apply <id> --anchor <a>',
  summary: 'apply extracted candidates as drafts',
  run: cmdIngestApply,
});

registerCommand({
  name: 'ingest-status',
  usage: 'ingest-status',
  summary: 'list ingest sessions and their progress',
  run: cmdIngestStatus,
});
```

`src/cli/commands/index.ts`:

```typescript
/**
 * Side-effect imports. Each module registers its commands on load, so
 * `src/cli/index.ts` needs no knowledge of what exists.
 */
import './ingest.ts';
```

- [ ] **Step 6: Wire the registry into the CLI**

In `src/cli/index.ts`, add the imports at the top of the import block:

```typescript
import './commands/index.ts';
import { COMMANDS } from './commands/registry.ts';
```

Replace the `USAGE` constant:

```typescript
const USAGE = `usage: mycontext <command> [args]
```

…through its closing backtick, with a function so registrations are reflected:

```typescript
function usage(): string {
  const registered = [...COMMANDS.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => `  ${c.usage.padEnd(28)}${c.summary}`)
    .join('\n');

  return `usage: mycontext <command> [args]

  init                        create .my_context in the current directory
  add <category> <title>      create a new item
  list [category]             list items
  show <id>                   print an item
  rebuild                     rebuild the index from Markdown
  status                      report counts, budgets and health
${registered}

categories: ${Object.keys(CATEGORIES).join(', ')}`;
}
```

Replace the two `out(USAGE)` call sites with `out(usage())`, and replace the `default` arm of the dispatch switch:

```typescript
    default: {
      const registered = COMMANDS.get(command);
      if (registered) return registered.run(ws, args, out, cwd);
      out(`my_context: unknown command "${command}".\n\n${usage()}`);
      return 1;
    }
```

Static imports are evaluated before the importing module's body, so `COMMANDS` is fully populated before `usage()` can be called.

- [ ] **Step 7: Run tests and typecheck**

Run: `node --test test/cli/ingest.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 8: Run the whole suite**

Run: `npm test`
Expected: PASS — Plan 1's `test/cli/cli.test.ts` must still pass, including the unknown-command and usage assertions.

- [ ] **Step 9: Commit**

```bash
git add src/cli/commands src/cli/index.ts test/cli/ingest.test.ts
git commit -m "feat: add the CLI command registry and the ingest command family"
```

---

<!-- PLAN4-APPEND-HERE -->
