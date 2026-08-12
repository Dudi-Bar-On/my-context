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

**Reconciled against Plan 2 as written.** An earlier draft of this block guessed at
these signatures and guessed wrong in three ways: `record` takes positional
arguments rather than an object, the session query is `seen` not `seenInSession`,
and the type is `Usage` not `Usage`. What follows is Plan 2's actual API.
`allUsage`, `recentSessions`, and `itemsUsedIn` are added by Plan 2 Task 11,
which exists specifically to serve this plan's decay report.

```typescript
export type LedgerTier = 'pinned' | 'jit' | 'restored';

export interface Usage {
  itemId: string;
  useCount: number;
  lastUsed: string | null;   // ISO-8601, null if never injected
}

export class Ledger {
  static open(dbPath: string): Ledger;
  /** Returns false when this (session, item, tier) was already recorded. */
  record(sessionId: string, itemId: string, tier: LedgerTier, at?: string): boolean;
  recordMany(sessionId: string, itemIds: string[], tier: LedgerTier, at?: string): string[];
  seen(sessionId: string): string[];
  usage(itemId: string): Usage;
  mostUsed(limit: number): Usage[];
  /** One row per item id that has ever been injected. Plan 2 Task 11. */
  allUsage(): Usage[];
  /** The most recent `limit` session ids, newest first. Plan 2 Task 11. */
  recentSessions(limit: number): string[];
  /** Distinct item ids injected during any of the given sessions. Plan 2 Task 11. */
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

export interface CreateInput {
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
export function createItem(ctx: MutateContext, input: CreateInput): MutationResult;
export function updateItem(ctx: MutateContext, id: string, patch: Partial<CreateInput>): MutationResult;
/** Marks `previousId` superseded, creates the replacement, wires `supersedes` on the new item. */
export function supersedeItem(ctx: MutateContext, previousId: string, input: CreateInput): MutationResult;
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
- Consumes: `validateCandidates`, `Candidate`, `ValidationIssue` from `src/ingest/schema.ts`; `IngestSession`, `ApplyRecord` from `src/ingest/session.ts`; `checksum`, `makeId` from `src/core/slug.ts`; `createItem`, `supersedeItem`, `MutateContext`, `CreateInput` from `src/core/mutate.ts`
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
import { createItem, supersedeItem, type CreateInput, type MutateContext } from '../core/mutate.ts';
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

    const input: CreateInput = {
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
  - `flag(args: string[], name: string): string | null`, `hasFlag(args: string[], name: string): boolean`, `positionals(args: string[], valueFlags: string[]): string[]`
  - `openMutateContext(ws: Workspace): MutateContext`, `readPayload(args: string[], cwd: string): unknown`

A registry rather than more `switch` arms: Plan 3 adds commands to the same CLI, and two plans editing one `switch` is a guaranteed merge conflict. `src/cli/index.ts` is touched exactly once, here.

**Ordering correction — read before implementing this task.** Plans execute 1 → 2 → 3 → 4, so Plan 3 has *already* added its commands to the `switch` by the time this task runs. Introducing the registry therefore means **migrating** the existing commands, not merely adding new ones. Two consequences:

1. **Migrate every existing command into the registry**, not just the ingest ones: `init`, `add`, `list`, `show`, `rebuild`, `status` from Plan 1, plus **`help` and `examples` from Plan 3**. Restructuring the switch without moving Plan 3's commands would silently delete working features — and their tests would be the only thing that catches it, so run the full suite, not just this task's.
2. **`help` is claimed by both plans and needs one coherent behaviour.** Plan 3 defines `mycontext help <topic>` for topic content; this task's test expects `mycontext help` to list registered commands. Both are satisfied by dispatching on arity:
   - `mycontext help` (no argument) → usage plus the registered command list, generated from `COMMANDS`
   - `mycontext help <topic>` → Plan 3's topic content, with an error naming the valid topics if unknown
   - `mycontext --help` → unchanged from Plan 1, so its existing test still passes

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

## Task 7: The `ingest_document` MCP tool

**Files:**
- Create: `src/mcp/tools/ingest.ts`
- Modify: `src/mcp/tools.ts` — import `./tools/ingest.ts` alongside Plan 3's own tool modules so it registers
- Test: `test/mcp/ingest-tool.test.ts`

**Interfaces:**
- Consumes: `registerTool`, `ToolDef`, `ToolResult`, `TOOLS` from `src/mcp/tools.ts`; `Workspace` from `src/core/workspace.ts`; `Store`, `rebuild`; everything from `src/ingest/*`
- Produces: `ingestDocumentTool: ToolDef`, `handleIngestDocument(args: Record<string, unknown>, ws: Workspace): ToolResult`

One tool, two phases, selected by which arguments are present. That is deliberate: MCP tool definitions occupy context in every session (spec §8), so a second tool purely to carry the callback would be a permanent tax. The description states the protocol explicitly, and — per spec §9 — states when *not* to use it.

Note the trust asymmetry: this handler runs on behalf of an agent, so its `MutateContext` uses `caller: 'agent'`. Ingested items are `draft` regardless, so the two callers converge here; the field is set correctly anyway so that a future change to `applyCandidates` cannot silently grant agents `active` items.

- [ ] **Step 1: Write the failing test**

`test/mcp/ingest-tool.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { handleIngestDocument, ingestDocumentTool } from '../../src/mcp/tools/ingest.ts';
import { Store } from '../../src/core/store.ts';
import { rebuild } from '../../src/core/rebuild.ts';

const DOC = `# Password policy\n\nPasswords must be at least 12 characters.\n\n# Storage\n\nPostgres only.\n`;

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-mcp-ing-'));
  runCli(['init'], cwd, () => {});
  mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  writeFileSync(path.join(cwd, 'docs', 'prd.md'), DOC, 'utf8');
  return cwd;
}

function text(result: { content: { text: string }[] }): string {
  return result.content.map((c) => c.text).join('\n');
}

test('the tool description states the two-call protocol and when not to use it', () => {
  assert.match(ingestDocumentTool.description, /two calls/i);
  assert.match(ingestDocumentTool.description, /you perform the extraction/i);
  assert.match(ingestDocumentTool.description, /do not use/i);
  assert.equal(ingestDocumentTool.name, 'ingest_document');
});

test('phase one returns an extraction request', () => {
  const cwd = project();
  const ws = resolveWorkspace(cwd);
  const out = text(handleIngestDocument({ path: 'docs/prd.md' }, ws));
  assert.match(out, /EXTRACTION REQUEST/);
  assert.match(out, /password-policy/);
  rmSync(cwd, { recursive: true, force: true });
});

test('phase two stages drafts and returns the next request', () => {
  const cwd = project();
  const ws = resolveWorkspace(cwd);
  const first = text(handleIngestDocument({ path: 'docs/prd.md' }, ws));
  const session = /ING-[a-z0-9-]+/.exec(first)![0];

  const applied = handleIngestDocument({
    session, anchor: 'password-policy',
    candidates: [{
      type: 'requirement',
      title: 'Passwords are at least 12 characters',
      body: 'Enforced at registration.',
      quote: 'Passwords must be at least 12 characters.',
    }],
  }, ws);

  assert.notEqual(applied.isError, true);
  assert.match(text(applied), /created 1/);
  assert.match(text(applied), /EXTRACTION REQUEST/);

  const store = Store.open(':memory:');
  rebuild(store, { project: ws.projectRoot! });
  const item = store.get('REQ-passwords-are-at-least-12-characters');
  assert.equal(item?.status, 'draft');
  assert.equal(item?.origin, 'ingest');
  store.close();
  rmSync(cwd, { recursive: true, force: true });
});

test('a call with neither path nor session is an error naming both', () => {
  const cwd = project();
  const result = handleIngestDocument({}, resolveWorkspace(cwd));
  assert.equal(result.isError, true);
  assert.match(text(result), /"path"/);
  assert.match(text(result), /"session"/);
  rmSync(cwd, { recursive: true, force: true });
});

test('a missing document is an error, not a throw', () => {
  const cwd = project();
  const result = handleIngestDocument({ path: 'docs/nope.md' }, resolveWorkspace(cwd));
  assert.equal(result.isError, true);
  assert.match(text(result), /docs\/nope\.md/);
  rmSync(cwd, { recursive: true, force: true });
});

test('rejected candidates are reported to the agent with correcting messages', () => {
  const cwd = project();
  const ws = resolveWorkspace(cwd);
  const session = /ING-[a-z0-9-]+/.exec(text(handleIngestDocument({ path: 'docs/prd.md' }, ws)))![0];
  const result = handleIngestDocument({
    session, anchor: 'password-policy',
    candidates: [{ type: 'requirements', title: 'x', body: 'y', quote: 'Passwords must be at least 12 characters.' }],
  }, ws);
  assert.match(text(result), /closest match is "requirement"/);
  rmSync(cwd, { recursive: true, force: true });
});

test('an unknown session is an error naming the id', () => {
  const cwd = project();
  const result = handleIngestDocument(
    { session: 'ING-nope-00000000', anchor: 'x', candidates: [] }, resolveWorkspace(cwd));
  assert.equal(result.isError, true);
  assert.match(text(result), /ING-nope-00000000/);
  rmSync(cwd, { recursive: true, force: true });
});

test('the input schema documents both phases', () => {
  const props = ingestDocumentTool.inputSchema.properties as Record<string, { description: string }>;
  assert.ok(props.path.description.length > 0);
  assert.ok(props.session.description.length > 0);
  assert.ok(props.anchor.description.length > 0);
  assert.ok(props.candidates.description.length > 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/mcp/ingest-tool.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`src/mcp/tools/ingest.ts`:

```typescript
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { relPosix, toPosix } from '../../core/paths.ts';
import { rebuild } from '../../core/rebuild.ts';
import { Store } from '../../core/store.ts';
import type { MutateContext } from '../../core/mutate.ts';
import type { Workspace } from '../../core/workspace.ts';
import { applyCandidates } from '../../ingest/apply.ts';
import { CANDIDATE_SCHEMA } from '../../ingest/schema.ts';
import { buildExtractionRequest, nextRequest, renderExtractionRequest } from '../../ingest/request.ts';
import { loadSession, openIngestSession, pendingAnchors, saveSession } from '../../ingest/session.ts';
import { registerTool, type ToolDef, type ToolResult } from '../tools.ts';

function ok(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

function fail(text: string): ToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

function agentContext(ws: Workspace): MutateContext {
  const store = Store.open(ws.dbPath);
  rebuild(store, {
    project: ws.projectRoot as string,
    global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined,
  });
  return { root: ws.projectRoot as string, config: ws.config, store, caller: 'agent' };
}

function phaseOne(ws: Workspace, rawPath: string): ToolResult {
  const repo = path.dirname(ws.projectRoot as string);
  const absolute = path.resolve(repo, toPosix(rawPath));
  if (!existsSync(absolute)) {
    return fail(`my_context: no such file "${toPosix(rawPath)}" (looked in ${repo}).`);
  }

  const root = ws.projectRoot as string;
  const session = openIngestSession(root, relPosix(repo, absolute), readFileSync(absolute, 'utf8'));
  saveSession(root, session);

  const request = nextRequest(session, ws.config);
  if (!request) {
    return ok(
      `my_context: every chunk of ${session.sourceFile} has already been applied ` +
      `(session ${session.id}). The drafts are waiting in the review queue — list them with list_drafts.`,
    );
  }
  return ok(renderExtractionRequest(request));
}

function phaseTwo(
  ws: Workspace, sessionId: string, anchor: string, candidates: unknown,
): ToolResult {
  const root = ws.projectRoot as string;

  let session;
  try {
    session = loadSession(root, sessionId);
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }

  const ctx = agentContext(ws);
  try {
    const result = applyCandidates(ctx, session, anchor, candidates);
    saveSession(root, session);

    const lines = [
      `my_context: ${session.sourceFile} § ${anchor} — created ${result.created.length}, ` +
      `deduped ${result.deduped.length}, superseded ${result.superseded.length}. ` +
      `All new items are status "draft" and govern nothing until promoted.`,
    ];
    for (const id of result.created) lines.push(`  created     ${id}`);
    for (const id of result.deduped) lines.push(`  unchanged   ${id}`);
    for (const pair of result.superseded) lines.push(`  superseded  ${pair.previous} -> ${pair.next}`);

    if (result.issues.length) {
      lines.push('', `${result.issues.length} candidate(s) rejected — fix and resubmit only these:`);
      for (const issue of result.issues) {
        lines.push(`  [${issue.index}] ${issue.title ?? '(untitled)'}: ${issue.message}`);
      }
    }

    if (pendingAnchors(session).length === 0) {
      lines.push('', `Every chunk of ${session.sourceFile} is applied. Stop calling ingest_document for this document.`);
      return ok(lines.join('\n'));
    }

    const request = nextRequest(session, ws.config);
    if (request) lines.push('', renderExtractionRequest(request));
    return ok(lines.join('\n'));
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  } finally {
    ctx.store.close();
  }
}

export function handleIngestDocument(args: Record<string, unknown>, ws: Workspace): ToolResult {
  if (!ws.projectRoot) {
    return fail('my_context: this project has no .my_context workspace. Run `mycontext init` first.');
  }

  const sourcePath = typeof args.path === 'string' ? args.path : null;
  const session = typeof args.session === 'string' ? args.session : null;

  if (session) {
    const anchor = typeof args.anchor === 'string' ? args.anchor : null;
    if (!anchor) {
      return fail('my_context: "anchor" is required alongside "session". It is the anchor named in the extraction request you are answering.');
    }
    if (args.candidates === undefined) {
      return fail('my_context: "candidates" is required alongside "session". Pass [] if the chunk establishes nothing normative.');
    }
    return phaseTwo(ws, session, anchor, args.candidates);
  }

  if (sourcePath) return phaseOne(ws, sourcePath);

  return fail(
    'my_context: ingest_document takes two calls. First call it with "path" to receive an extraction request. ' +
    'Then call it again with "session", "anchor" and "candidates" to submit what you extracted. ' +
    'You passed neither "path" nor "session".',
  );
}

export const ingestDocumentTool: ToolDef = {
  name: 'ingest_document',
  description:
    'Extract normative items (constraints, requirements, rules, decisions) from a document into the review queue. ' +
    'This takes TWO calls and you perform the extraction yourself — my_context has no model of its own. ' +
    'Call 1: pass "path"; you receive a chunk of the document, the JSON schema, and the legal categories. ' +
    'Call 2: pass "session", "anchor" and the "candidates" array you produced; it validates, dedupes against ' +
    'previous ingests, and stages everything as drafts. Repeat call 2 until it reports no chunks remain. ' +
    'Everything lands as status "draft" and governs nothing until a human promotes it. ' +
    'Do NOT use this for a single fact established in conversation — use create_item. ' +
    'Do NOT use it to summarize a document, and do not paraphrase the "quote" field: it is checked verbatim.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Call 1 only. Repo-relative POSIX path of the document to ingest, e.g. "docs/prd/auth.md".',
      },
      session: {
        type: 'string',
        description: 'Call 2 only. The session id from the extraction request, e.g. "ING-docs-prd-auth-md-9f2a1b3c".',
      },
      anchor: {
        type: 'string',
        description: 'Call 2 only. The chunk anchor from the extraction request you are answering.',
      },
      candidates: {
        description: 'Call 2 only. The array of extracted items, matching the schema supplied in the request. Use [] when the chunk establishes nothing normative.',
        ...CANDIDATE_SCHEMA,
      },
    },
    additionalProperties: false,
  },
  handler: handleIngestDocument,
};

registerTool(ingestDocumentTool);
```

Then add to Plan 3's `src/mcp/tools.ts`, at the end of the file, alongside its own tool imports:

```typescript
import './tools/ingest.ts';
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/mcp/ingest-tool.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/mcp/tools/ingest.ts src/mcp/tools.ts test/mcp/ingest-tool.test.ts
git commit -m "feat: add the ingest_document MCP tool with the two-phase protocol"
```

---

## Task 8: Lessons to rules, behind the approval gate

**Files:**
- Create: `src/lesson/derive.ts`
- Test: `test/lesson/derive.test.ts`

**Interfaces:**
- Consumes: `checksum`, `makeId`, `slugify` from `src/core/slug.ts`; `createItem`, `linkItems`, `MutateContext` from `src/core/mutate.ts`; `Item` from `src/core/types.ts`; `Config` from `src/core/config.ts`
- Produces:
  - `RULE_REQUEST_PROTOCOL: string`, `STAGING_PROTOCOL: string`
  - `RuleCandidate { title: string; directive: 'do' | 'dont'; body: string; scope: string[]; severity: 'hard' | 'soft' }`
  - `StagedRule { key: string; candidate: RuleCandidate; state: 'pending' | 'accepted' | 'discarded'; ruleId: string | null }`
  - `LessonStaging { protocol; lessonId; createdAt; candidates: StagedRule[] }`
  - `stagingDir(root: string): string`, `loadStaging(root, lessonId): LessonStaging | null`, `saveStaging(root, staging): string`, `listStaging(root): LessonStaging[]`
  - `buildRuleRequest(lesson: Item, config: Config): Record<string, unknown>`, `renderRuleRequest(req: Record<string, unknown>): string`
  - `validateRuleCandidates(raw: unknown): { valid: RuleCandidate[]; issues: ValidationIssue[] }`
  - `stageRuleCandidates(root: string, lesson: Item, raw: unknown): { staging: LessonStaging; issues: ValidationIssue[] }`
  - `acceptStagedRule(ctx: MutateContext, staging: LessonStaging, key: string, edits?: Partial<RuleCandidate>): string`
  - `discardStagedRule(staging: LessonStaging, key: string): void`

**The approval gate is the point of this task** (spec §7.4): *"An LLM-invented invariant that is subtly wrong would be injected in full text indefinitely and would silently steer every future session."*

The gate is enforced structurally, not by convention: `stageRuleCandidates` writes only to `.my_context/.staging/`, never to `items/`, and never touches `createItem`. The only path from a candidate to an item is `acceptStagedRule`, which is reachable only from the explicit `mycontext lesson-accept` command and refuses any candidate not in state `accepted`.

- [ ] **Step 1: Write the failing test**

`test/lesson/derive.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  buildRuleRequest, renderRuleRequest, validateRuleCandidates, stageRuleCandidates,
  acceptStagedRule, discardStagedRule, loadStaging, listStaging, stagingDir,
} from '../../src/lesson/derive.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { Store } from '../../src/core/store.ts';
import { createItem, type MutateContext } from '../../src/core/mutate.ts';
import type { Item } from '../../src/core/types.ts';

function fixture(): { ctx: MutateContext; root: string; lesson: Item; cleanup: () => void } {
  const base = mkdtempSync(path.join(tmpdir(), 'myctx-lesson-'));
  const root = path.join(base, '.my_context');
  mkdirSync(path.join(root, 'items'), { recursive: true });
  const store = Store.open(':memory:');
  const ctx: MutateContext = { root, config: resolveConfig({}), store, caller: 'user' };
  const lesson = createItem(ctx, {
    type: 'lesson',
    title: 'Migrations deadlock when run during peak traffic',
    body: 'The 3pm deploy took an ACCESS EXCLUSIVE lock and queued every write for 40 seconds.',
  }).item;
  return { ctx, root, lesson, cleanup: () => { store.close(); rmSync(base, { recursive: true, force: true }); } };
}

function candidate(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'Run schema migrations outside peak traffic hours',
    directive: 'do',
    body: 'An ACCESS EXCLUSIVE lock queues every write for the duration.',
    scope: ['migrations/**'],
    ...over,
  };
}

test('the rule request names the lesson and demands do/dont form', () => {
  const { lesson, ctx, cleanup } = fixture();
  const req = buildRuleRequest(lesson, ctx.config);
  const text = renderRuleRequest(req);
  assert.match(text, /RULE DERIVATION REQUEST/);
  assert.match(text, new RegExp(lesson.id));
  assert.match(text, /Migrations deadlock when run during peak traffic/);
  assert.match(text, /directive/);
  assert.match(text, /"do"/);
  assert.match(text, /"dont"/);
  assert.match(text, /approval/i);
  cleanup();
});

test('a valid rule candidate passes', () => {
  const { valid, issues } = validateRuleCandidates([candidate()]);
  assert.deepEqual(issues, []);
  assert.equal(valid[0].directive, 'do');
  assert.equal(valid[0].severity, 'soft');
});

test('a missing or wrong directive is rejected naming both legal values', () => {
  assert.match(validateRuleCandidates([candidate({ directive: 'should' })]).issues[0].message, /"do".*"dont"/);
  assert.match(validateRuleCandidates([candidate({ directive: undefined })]).issues[0].message, /directive/);
});

test('a non-array payload is one issue', () => {
  const { issues } = validateRuleCandidates('nope');
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /array/i);
});

test('staging writes nothing into items/ — the approval gate', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const before = ctx.store.all().map((i) => i.id);
  stageRuleCandidates(root, lesson, [candidate(), candidate({ title: 'Never run migrations at 3pm', directive: 'dont' })]);

  assert.deepEqual(ctx.store.all().map((i) => i.id), before);
  assert.deepEqual(readdirSync(path.join(root, 'items')), ['lesson']);
  cleanup();
});

test('staged candidates start pending with no rule id', () => {
  const { root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  assert.equal(staging.candidates[0].state, 'pending');
  assert.equal(staging.candidates[0].ruleId, null);
  assert.ok(staging.candidates[0].key.length > 0);
  cleanup();
});

test('staging persists and reloads', () => {
  const { root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  assert.deepEqual(loadStaging(root, lesson.id), staging);
  assert.deepEqual(listStaging(root).map((s) => s.lessonId), [lesson.id]);
  cleanup();
});

test('re-staging the same lesson replaces the pending set rather than appending', () => {
  const { root, lesson, cleanup } = fixture();
  stageRuleCandidates(root, lesson, [candidate()]);
  const { staging } = stageRuleCandidates(root, lesson, [candidate({ title: 'Something else' })]);
  assert.equal(staging.candidates.length, 1);
  assert.equal(staging.candidates[0].candidate.title, 'Something else');
  cleanup();
});

test('accepting creates the rule with directive and a derived_from relation', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  const ruleId = acceptStagedRule(ctx, staging, staging.candidates[0].key);

  const rule = ctx.store.get(ruleId);
  assert.ok(rule);
  assert.equal(rule.type, 'rule');
  assert.equal(rule.extra.directive, 'do');
  assert.deepEqual(rule.scope, ['migrations/**']);
  assert.deepEqual(
    rule.relations.filter((r) => r.type === 'derived_from'),
    [{ type: 'derived_from', target: lesson.id }],
  );
  assert.equal(staging.candidates[0].state, 'accepted');
  assert.equal(staging.candidates[0].ruleId, ruleId);
  cleanup();
});

test('the lesson itself stays index-only — its rule is what gets injected', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  acceptStagedRule(ctx, staging, staging.candidates[0].key);
  assert.equal(ctx.store.get(lesson.id)?.type, 'lesson');
  assert.equal(ctx.config.categories.lesson.tier, 'rationale');
  cleanup();
});

test('an edit at acceptance time is honoured', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  const ruleId = acceptStagedRule(ctx, staging, staging.candidates[0].key, {
    title: 'Run migrations only between 02:00 and 05:00 UTC',
    scope: ['migrations/**', 'ops/deploy/**'],
  });
  const rule = ctx.store.get(ruleId);
  assert.equal(rule?.title, 'Run migrations only between 02:00 and 05:00 UTC');
  assert.deepEqual(rule?.scope, ['migrations/**', 'ops/deploy/**']);
  cleanup();
});

test('accepting twice is refused rather than duplicating', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  acceptStagedRule(ctx, staging, staging.candidates[0].key);
  assert.throws(() => acceptStagedRule(ctx, staging, staging.candidates[0].key), /already accepted/i);
  cleanup();
});

test('a discarded candidate can never be accepted', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  discardStagedRule(staging, staging.candidates[0].key);
  assert.equal(staging.candidates[0].state, 'discarded');
  assert.throws(() => acceptStagedRule(ctx, staging, staging.candidates[0].key), /discarded/i);
  assert.equal(ctx.store.all().filter((i) => i.type === 'rule').length, 0);
  cleanup();
});

test('an unknown key is refused and lists the real keys', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [candidate()]);
  assert.throws(
    () => acceptStagedRule(ctx, staging, 'not-a-key'),
    new RegExp(staging.candidates[0].key),
  );
  cleanup();
});

test('INVARIANT: no generated rule is ever active without an explicit accept', () => {
  const { ctx, root, lesson, cleanup } = fixture();
  const { staging } = stageRuleCandidates(root, lesson, [
    candidate(),
    candidate({ title: 'Never deploy on a Friday', directive: 'dont' }),
    candidate({ title: 'Always take a snapshot first' }),
  ]);

  // Nothing has been accepted. Nothing generated may exist at all, let alone be active.
  assert.equal(ctx.store.all().filter((i) => i.type === 'rule').length, 0);
  assert.equal(ctx.store.all().every((i) => i.type === 'lesson'), true);

  // Accept exactly one. Exactly one rule appears; the other two remain nowhere.
  acceptStagedRule(ctx, staging, staging.candidates[1].key);
  const rules = ctx.store.all().filter((i) => i.type === 'rule');
  assert.equal(rules.length, 1);
  assert.equal(rules[0].title, 'Never deploy on a Friday');
  assert.equal(rules[0].status, 'active', 'an explicitly accepted rule is active — that is the approval');
  assert.equal(staging.candidates[0].state, 'pending');
  assert.equal(staging.candidates[2].state, 'pending');
  cleanup();
});

test('the staging directory is gitignored working state', () => {
  const { root, lesson, cleanup } = fixture();
  stageRuleCandidates(root, lesson, [candidate()]);
  assert.ok(readdirSync(stagingDir(root)).includes('.gitignore'));
  cleanup();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/lesson/derive.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`src/lesson/derive.ts`:

```typescript
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Config } from '../core/config.ts';
import { createItem, linkItems, type MutateContext } from '../core/mutate.ts';
import { checksum, makeId } from '../core/slug.ts';
import type { Item } from '../core/types.ts';
import type { ValidationIssue } from '../ingest/schema.ts';

export const RULE_REQUEST_PROTOCOL = 'my_context/rule-derivation-request@1';
export const STAGING_PROTOCOL = 'my_context/lesson-staging@1';

export interface RuleCandidate {
  title: string;
  directive: 'do' | 'dont';
  body: string;
  scope: string[];
  severity: 'hard' | 'soft';
}

export interface StagedRule {
  /** Stable handle used by `mycontext lesson-accept`. */
  key: string;
  candidate: RuleCandidate;
  state: 'pending' | 'accepted' | 'discarded';
  ruleId: string | null;
}

export interface LessonStaging {
  protocol: string;
  lessonId: string;
  createdAt: string;
  candidates: StagedRule[];
}

export function stagingDir(root: string): string {
  return path.join(root, '.staging');
}

function stagingFile(root: string, lessonId: string): string {
  return path.join(stagingDir(root), `${lessonId}.json`);
}

function ensureDir(root: string): string {
  const dir = stagingDir(root);
  mkdirSync(dir, { recursive: true });
  const ignore = path.join(dir, '.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '*\n', 'utf8');
  return dir;
}

export function saveStaging(root: string, staging: LessonStaging): string {
  ensureDir(root);
  const target = stagingFile(root, staging.lessonId);
  const tmp = `${target}.tmp-${process.pid}`;
  try {
    writeFileSync(tmp, JSON.stringify(staging, null, 2) + '\n', 'utf8');
    renameSync(tmp, target);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
  return target;
}

export function loadStaging(root: string, lessonId: string): LessonStaging | null {
  const file = stagingFile(root, lessonId);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as LessonStaging;
  } catch {
    return null;
  }
}

export function listStaging(root: string): LessonStaging[] {
  let names: string[];
  try {
    names = readdirSync(stagingDir(root)).filter((n) => n.endsWith('.json'));
  } catch {
    return [];
  }

  const out: LessonStaging[] = [];
  for (const name of names) {
    try {
      const parsed = JSON.parse(readFileSync(path.join(stagingDir(root), name), 'utf8')) as LessonStaging;
      if (parsed.protocol === STAGING_PROTOCOL) out.push(parsed);
    } catch {
      // Working state, not knowledge. Skip.
    }
  }
  return out.sort((a, b) => a.lessonId.localeCompare(b.lessonId));
}

export const RULE_CANDIDATE_SCHEMA: Record<string, unknown> = {
  type: 'array',
  items: {
    type: 'object',
    required: ['title', 'directive', 'body'],
    additionalProperties: false,
    properties: {
      title: { type: 'string', maxLength: 200, description: 'The directive itself, phrased as an instruction: "Run migrations outside peak hours".' },
      directive: { enum: ['do', 'dont'], description: '"do" prescribes; "dont" prohibits.' },
      body: { type: 'string', description: 'Why. Cite the mechanism from the lesson, not the incident narrative.' },
      scope: { type: 'array', items: { type: 'string' }, description: 'POSIX globs this governs. Omit rather than guessing; a bare "**" is rejected.' },
      severity: { enum: ['hard', 'soft'] },
    },
  },
};

export function buildRuleRequest(lesson: Item, config: Config): Record<string, unknown> {
  return {
    protocol: RULE_REQUEST_PROTOCOL,
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    lessonBody: lesson.body,
    lessonObservations: lesson.observations.map((o) => `[${o.category}] ${o.text}`),
    ruleCategoryEnabled: config.categories.rule?.enabled ?? false,
    schema: RULE_CANDIDATE_SCHEMA,
    callback: {
      cli: `mycontext lesson-stage ${lesson.id} --stdin`,
    },
    instructions: [
      'You are deriving rules. my_context has no model of its own — it stages what you return and waits for a human.',
      'A lesson is descriptive ("this is what happened"); a rule is normative ("this is what must happen from now on"). Convert, do not restate.',
      'Emit a JSON array of rule candidates matching the schema. Two or three is usually right; return [] if the lesson supports no general rule.',
      'Each rule must be actionable by someone who was not present for the incident. Drop the dates, names and ticket numbers.',
      'Do not invent scope. If you cannot name the directories a rule governs, omit "scope" — an unscoped rule is still indexed and can be scoped during review.',
      'NOTHING you return is applied. Every candidate is staged pending explicit human approval, because a subtly wrong invariant would be injected into every future session indefinitely.',
      `Call back with: mycontext lesson-stage ${lesson.id} --stdin`,
    ],
  };
}

export function renderRuleRequest(request: Record<string, unknown>): string {
  const lines = [
    `my_context RULE DERIVATION REQUEST — ${String(request.lessonId)}`,
    '',
    ...(request.instructions as string[]).map((line) => `- ${line}`),
    '',
    '```json',
    JSON.stringify(request, null, 2),
    '```',
  ];
  return lines.join('\n').replace(/\r/g, '') + '\n';
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateRuleCandidates(raw: unknown): { valid: RuleCandidate[]; issues: ValidationIssue[] } {
  const valid: RuleCandidate[] = [];
  const issues: ValidationIssue[] = [];

  if (!Array.isArray(raw)) {
    issues.push({
      index: -1, title: null,
      message: `expected a JSON array of rule candidates, got ${raw === null ? 'null' : typeof raw}. Return [] if the lesson supports no general rule.`,
    });
    return { valid, issues };
  }

  raw.forEach((entry, index) => {
    const title = isObject(entry) && typeof entry.title === 'string' ? entry.title.trim() : null;
    const reject = (message: string): void => { issues.push({ index, title, message }); };

    if (!isObject(entry)) return reject('entry is not an object');
    if (!title) return reject('"title" is required and is the directive itself.');
    if (title.length > 200) return reject(`"title" is ${title.length} characters; the limit is 200.`);
    if (entry.directive !== 'do' && entry.directive !== 'dont') {
      return reject(`"directive" is required and must be "do" or "dont". You passed ${JSON.stringify(entry.directive)}.`);
    }

    const scope = Array.isArray(entry.scope)
      ? entry.scope.filter((s): s is string => typeof s === 'string').map((s) => s.trim()).filter(Boolean)
      : [];
    const backslashed = scope.find((s) => s.includes('\\'));
    if (backslashed) return reject(`scope glob "${backslashed}" contains a backslash. Scope globs are POSIX.`);
    const bare = scope.find((s) => s === '**' || s === '**/*' || s === '*');
    if (bare) return reject(`scope glob "${bare}" is too broad and defeats inert-by-default scoping. Name real directories or omit "scope".`);

    if (entry.severity !== undefined && entry.severity !== 'hard' && entry.severity !== 'soft') {
      return reject(`"severity" must be "hard" or "soft". You passed ${JSON.stringify(entry.severity)}.`);
    }

    valid.push({
      title,
      directive: entry.directive,
      body: typeof entry.body === 'string' ? entry.body.trim() : '',
      scope,
      severity: entry.severity === 'hard' ? 'hard' : 'soft',
    });
  });

  return { valid, issues };
}

/**
 * Stage candidates. This function deliberately does not import anything that
 * can write to `items/`: the only route from a candidate to an item is
 * `acceptStagedRule`, and that is reachable only from an explicit user command.
 */
export function stageRuleCandidates(
  root: string, lesson: Item, raw: unknown,
): { staging: LessonStaging; issues: ValidationIssue[] } {
  const { valid, issues } = validateRuleCandidates(raw);

  const previous = loadStaging(root, lesson.id);
  const settled = (previous?.candidates ?? []).filter((c) => c.state === 'accepted' || c.state === 'discarded');

  const staged: StagedRule[] = valid.map((candidate) => ({
    key: checksum(`${candidate.directive}|${candidate.title.toLowerCase()}`).slice(0, 8),
    candidate,
    state: 'pending',
    ruleId: null,
  }));

  const seen = new Set(settled.map((c) => c.key));
  const staging: LessonStaging = {
    protocol: STAGING_PROTOCOL,
    lessonId: lesson.id,
    createdAt: new Date().toISOString(),
    candidates: [...settled, ...staged.filter((c) => !seen.has(c.key))],
  };

  saveStaging(root, staging);
  return { staging, issues };
}

/**
 * The approval gate. Nothing else in this module writes an item, and this is
 * called only from `mycontext lesson-accept` — the user's explicit act of
 * approval. The rule is created `active` because a user command creates active
 * items (spec §7.1); the gate is the command itself, not a second status hop.
 */
export function acceptStagedRule(
  ctx: MutateContext, staging: LessonStaging, key: string, edits: Partial<RuleCandidate> = {},
): string {
  const staged = staging.candidates.find((c) => c.key === key);
  if (!staged) {
    throw new Error(
      `my_context: staging for ${staging.lessonId} has no candidate "${key}". ` +
      `Keys: ${staging.candidates.map((c) => c.key).join(', ')}.`,
    );
  }
  if (staged.state === 'accepted') {
    throw new Error(`my_context: candidate ${key} was already accepted as ${staged.ruleId}.`);
  }
  if (staged.state === 'discarded') {
    throw new Error(`my_context: candidate ${key} was discarded and cannot be accepted. Re-derive with \`mycontext lesson ${staging.lessonId}\`.`);
  }

  const merged: RuleCandidate = { ...staged.candidate, ...edits };
  const prefix = ctx.config.categories.rule.prefix;

  const outcome = createItem(ctx, {
    type: 'rule',
    id: makeId(prefix, merged.title),
    title: merged.title,
    body: merged.body,
    status: 'active',
    origin: 'agent',
    severity: merged.severity,
    scope: merged.scope,
    extra: { directive: merged.directive },
    relations: [{ type: 'derived_from', target: staging.lessonId }],
  });

  // Also index the reverse edge so the lesson shows what it produced.
  linkItems(ctx, staging.lessonId, 'produced_rule', outcome.item.id);

  staged.state = 'accepted';
  staged.ruleId = outcome.item.id;
  return outcome.item.id;
}

export function discardStagedRule(staging: LessonStaging, key: string): void {
  const staged = staging.candidates.find((c) => c.key === key);
  if (!staged) {
    throw new Error(
      `my_context: staging for ${staging.lessonId} has no candidate "${key}". ` +
      `Keys: ${staging.candidates.map((c) => c.key).join(', ')}.`,
    );
  }
  if (staged.state === 'accepted') {
    throw new Error(`my_context: candidate ${key} was already accepted as ${staged.ruleId}. Supersede or deprecate ${staged.ruleId} instead.`);
  }
  staged.state = 'discarded';
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/lesson/derive.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lesson/derive.ts test/lesson/derive.test.ts
git commit -m "feat: derive rules from lessons behind a structural approval gate"
```

---

## Task 9: The `lesson` CLI commands

**Files:**
- Create: `src/cli/commands/lesson.ts`
- Modify: `src/cli/commands/index.ts` (add `import './lesson.ts';`)
- Test: `test/cli/lesson.test.ts`

**Interfaces:**
- Consumes: everything from `src/lesson/derive.ts`; `openMutateContext`, `readPayload` from `src/cli/commands/context.ts`; `registerCommand`, `flag`, `positionals` from `src/cli/commands/registry.ts`; `createItem` from `src/core/mutate.ts`
- Produces: four registered commands — `lesson`, `lesson-stage`, `lesson-accept`, `lesson-discard`

`mycontext lesson "…"` does two things in one step: it records the lesson as a real item (active, rationale tier, so it is indexed but never injected) and prints the rule-derivation request. `mycontext lesson <existing-id>` re-derives from an item that already exists.

- [ ] **Step 1: Write the failing test**

`test/cli/lesson.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-cli-lesson-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

const CANDIDATES = JSON.stringify([
  { title: 'Run schema migrations outside peak traffic hours', directive: 'do', body: 'An ACCESS EXCLUSIVE lock queues writes.', scope: ['migrations/**'] },
  { title: 'Never deploy a migration on a Friday', directive: 'dont', body: 'Nobody is available to roll it back.' },
]);

function stage(cwd: string): { lessonId: string; keys: string[] } {
  const created = run(['lesson', 'Migrations deadlock when run during peak traffic'], cwd);
  const lessonId = /LESSON-[a-z0-9-]+/.exec(created.out)![0];
  writeFileSync(path.join(cwd, 'r.json'), CANDIDATES, 'utf8');
  const staged = run(['lesson-stage', lessonId, '--file', 'r.json'], cwd);
  const keys = [...staged.out.matchAll(/^\s{2}([0-9a-f]{8})\s/gm)].map((m) => m[1]);
  assert.equal(keys.length, 2, `expected 2 staged keys, output was:\n${staged.out}`);
  return { lessonId, keys };
}

test('lesson records the lesson and prints a derivation request', () => {
  const cwd = project();
  const { code, out } = run(['lesson', 'Migrations deadlock when run during peak traffic'], cwd);
  assert.equal(code, 0);
  assert.match(out, /LESSON-migrations-deadlock-when-run-during-peak-traffic/);
  assert.match(out, /RULE DERIVATION REQUEST/);
  rmSync(cwd, { recursive: true, force: true });
});

test('the recorded lesson is active but rationale — indexed, never injected', () => {
  const cwd = project();
  run(['lesson', 'Migrations deadlock during peak traffic'], cwd);
  assert.match(run(['list'], cwd).out, /LESSON-migrations-deadlock-during-peak-traffic\s+lesson\s+active/);
  rmSync(cwd, { recursive: true, force: true });
});

test('lesson with an existing id re-derives without creating a duplicate', () => {
  const cwd = project();
  const first = run(['lesson', 'Migrations deadlock during peak traffic'], cwd);
  const id = /LESSON-[a-z0-9-]+/.exec(first.out)![0];
  const again = run(['lesson', id], cwd);
  assert.equal(again.code, 0);
  assert.match(again.out, /RULE DERIVATION REQUEST/);
  assert.equal(run(['list', 'lesson'], cwd).out.trim().split('\n').length, 1);
  rmSync(cwd, { recursive: true, force: true });
});

test('lesson with no argument prints usage', () => {
  const cwd = project();
  const { code, out } = run(['lesson'], cwd);
  assert.equal(code, 1);
  assert.match(out, /usage: mycontext lesson/);
  rmSync(cwd, { recursive: true, force: true });
});

test('lesson-stage lists the staged candidates with their keys and creates no rules', () => {
  const cwd = project();
  const { keys } = stage(cwd);
  assert.equal(keys.length, 2);
  const listed = run(['list', 'rule'], cwd).out.trim();
  assert.equal(listed, '', `no rule may exist before acceptance, got:\n${listed}`);
  rmSync(cwd, { recursive: true, force: true });
});

test('lesson-stage reports rejected candidates without discarding the good ones', () => {
  const cwd = project();
  const created = run(['lesson', 'Deploys are risky'], cwd);
  const lessonId = /LESSON-[a-z0-9-]+/.exec(created.out)![0];
  writeFileSync(path.join(cwd, 'r.json'), JSON.stringify([
    { title: 'Good rule', directive: 'do', body: 'b' },
    { title: 'Bad rule', directive: 'maybe', body: 'b' },
  ]), 'utf8');
  const { code, out } = run(['lesson-stage', lessonId, '--file', 'r.json'], cwd);
  assert.equal(code, 0);
  assert.match(out, /1 candidate rejected/);
  assert.match(out, /Bad rule/);
  assert.match(out, /Good rule/);
  rmSync(cwd, { recursive: true, force: true });
});

test('lesson-accept creates exactly the accepted rule, with derived_from', () => {
  const cwd = project();
  const { lessonId, keys } = stage(cwd);
  const { code, out } = run(['lesson-accept', lessonId, keys[1]], cwd);
  assert.equal(code, 0);
  assert.match(out, /RULE-never-deploy-a-migration-on-a-friday/);

  const rules = run(['list', 'rule'], cwd).out.trim().split('\n').filter(Boolean);
  assert.equal(rules.length, 1);
  const shown = run(['show', 'RULE-never-deploy-a-migration-on-a-friday'], cwd).out;
  assert.match(shown, /directive: dont/);
  assert.match(shown, new RegExp(`derived_from \\[\\[${lessonId}\\]\\]`));
  rmSync(cwd, { recursive: true, force: true });
});

test('lesson-accept honours --title and --scope edits', () => {
  const cwd = project();
  const { lessonId, keys } = stage(cwd);
  run(['lesson-accept', lessonId, keys[0], '--title', 'Run migrations between 02:00 and 05:00 UTC', '--scope', 'migrations/**,ops/**'], cwd);
  const shown = run(['show', 'RULE-run-migrations-between-02-00-and-05-00-utc'], cwd).out;
  assert.match(shown, /- "migrations\/\*\*"/);
  assert.match(shown, /- "ops\/\*\*"/);
  rmSync(cwd, { recursive: true, force: true });
});

test('lesson-discard removes a candidate from consideration permanently', () => {
  const cwd = project();
  const { lessonId, keys } = stage(cwd);
  assert.equal(run(['lesson-discard', lessonId, keys[0]], cwd).code, 0);
  const { code, out } = run(['lesson-accept', lessonId, keys[0]], cwd);
  assert.equal(code, 1);
  assert.match(out, /discarded/i);
  assert.equal(run(['list', 'rule'], cwd).out.trim(), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('lesson-accept on a lesson with no staging explains the next step', () => {
  const cwd = project();
  const created = run(['lesson', 'Something happened'], cwd);
  const id = /LESSON-[a-z0-9-]+/.exec(created.out)![0];
  const { code, out } = run(['lesson-accept', id, 'deadbeef'], cwd);
  assert.equal(code, 1);
  assert.match(out, /lesson-stage/);
  rmSync(cwd, { recursive: true, force: true });
});

test('lesson-accept with an unknown key lists the real ones', () => {
  const cwd = project();
  const { lessonId, keys } = stage(cwd);
  const { code, out } = run(['lesson-accept', lessonId, 'ffffffff'], cwd);
  assert.equal(code, 1);
  assert.match(out, new RegExp(keys[0]));
  rmSync(cwd, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cli/lesson.test.ts`
Expected: FAIL — `unknown command "lesson"`

- [ ] **Step 3: Implement**

`src/cli/commands/lesson.ts`:

```typescript
import { createItem } from '../../core/mutate.ts';
import { makeId } from '../../core/slug.ts';
import type { Item } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import {
  acceptStagedRule, buildRuleRequest, discardStagedRule, loadStaging,
  renderRuleRequest, saveStaging, stageRuleCandidates, type RuleCandidate,
} from '../../lesson/derive.ts';
import { openMutateContext, readPayload } from './context.ts';
import { flag, positionals, registerCommand, type Emit } from './registry.ts';

function requireWorkspace(ws: Workspace, out: Emit): boolean {
  if (ws.projectRoot) return true;
  out('my_context: no workspace here. Run `mycontext init` to create one.');
  return false;
}

function cmdLesson(ws: Workspace, args: string[], out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;

  const subject = positionals(args, []).join(' ').trim();
  if (!subject) {
    out('usage: mycontext lesson "<what was learned>" | mycontext lesson <LESSON-id>');
    return 1;
  }

  const ctx = openMutateContext(ws);
  try {
    let lesson: Item | null = ctx.store.get(subject);
    if (lesson && lesson.type !== 'lesson') {
      out(`my_context: ${subject} is a ${lesson.type}, not a lesson. Rules are derived from lessons only.`);
      return 1;
    }

    if (!lesson) {
      const existing = ctx.store.get(makeId(ctx.config.categories.lesson.prefix, subject));
      lesson = existing ?? createItem(ctx, { type: 'lesson', title: subject, status: 'active', origin: 'human' }).item;
    }

    out(`my_context: lesson ${lesson.id} recorded (rationale tier — indexed, never injected).`);
    out('');
    out(renderRuleRequest(buildRuleRequest(lesson, ws.config)));
    return 0;
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  } finally {
    ctx.store.close();
  }
}

function cmdLessonStage(ws: Workspace, args: string[], out: Emit, cwd: string): number {
  if (!requireWorkspace(ws, out)) return 1;

  const [lessonId] = positionals(args, ['file']);
  if (!lessonId) {
    out('usage: mycontext lesson-stage <LESSON-id> (--file <path> | --stdin)');
    return 1;
  }

  const ctx = openMutateContext(ws);
  try {
    const lesson = ctx.store.get(lessonId);
    if (!lesson) { out(`my_context: no item with id "${lessonId}".`); return 1; }

    const payload = readPayload(args, cwd);
    const { staging, issues } = stageRuleCandidates(ws.projectRoot as string, lesson, payload);

    const pending = staging.candidates.filter((c) => c.state === 'pending');
    out(`my_context: ${pending.length} rule candidate(s) staged for ${lessonId}. None of them exists as an item yet.`);
    for (const staged of pending) {
      out(`  ${staged.key}  ${staged.candidate.directive.padEnd(4)}  ${staged.candidate.title}`);
    }

    if (issues.length) {
      out('');
      out(`${issues.length} candidate rejected:`);
      for (const issue of issues) out(`  [${issue.index}] ${issue.title ?? '(untitled)'}: ${issue.message}`);
    }

    out('');
    out(`Accept with:  mycontext lesson-accept ${lessonId} <key> [--title "…"] [--scope "a/**,b/**"]`);
    out(`Discard with: mycontext lesson-discard ${lessonId} <key>`);
    return 0;
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  } finally {
    ctx.store.close();
  }
}

function edits(args: string[]): Partial<RuleCandidate> {
  const patch: Partial<RuleCandidate> = {};
  const title = flag(args, 'title');
  if (title) patch.title = title;
  const scope = flag(args, 'scope');
  if (scope !== null) patch.scope = scope.split(',').map((s) => s.trim()).filter(Boolean);
  const severity = flag(args, 'severity');
  if (severity === 'hard' || severity === 'soft') patch.severity = severity;
  const directive = flag(args, 'directive');
  if (directive === 'do' || directive === 'dont') patch.directive = directive;
  return patch;
}

function withStaging(
  ws: Workspace, args: string[], out: Emit,
  action: (ctx: ReturnType<typeof openMutateContext>, staging: NonNullable<ReturnType<typeof loadStaging>>, key: string) => number,
): number {
  if (!requireWorkspace(ws, out)) return 1;

  const [lessonId, key] = positionals(args, ['title', 'scope', 'severity', 'directive']);
  if (!lessonId || !key) {
    out('usage: mycontext lesson-accept <LESSON-id> <key> | mycontext lesson-discard <LESSON-id> <key>');
    return 1;
  }

  const root = ws.projectRoot as string;
  const staging = loadStaging(root, lessonId);
  if (!staging) {
    out(`my_context: nothing staged for "${lessonId}". Run \`mycontext lesson ${lessonId}\` then \`mycontext lesson-stage ${lessonId} --stdin\`.`);
    return 1;
  }

  const ctx = openMutateContext(ws);
  try {
    const code = action(ctx, staging, key);
    saveStaging(root, staging);
    return code;
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  } finally {
    ctx.store.close();
  }
}

function cmdLessonAccept(ws: Workspace, args: string[], out: Emit): number {
  return withStaging(ws, args, out, (ctx, staging, key) => {
    const ruleId = acceptStagedRule(ctx, staging, key, edits(args));
    out(`my_context: created ${ruleId} (active) with derived_from [[${staging.lessonId}]].`);
    return 0;
  });
}

function cmdLessonDiscard(ws: Workspace, args: string[], out: Emit): number {
  return withStaging(ws, args, out, (_ctx, staging, key) => {
    discardStagedRule(staging, key);
    out(`my_context: discarded candidate ${key} for ${staging.lessonId}. It cannot be accepted later.`);
    return 0;
  });
}

registerCommand({
  name: 'lesson',
  usage: 'lesson "<text>" | <id>',
  summary: 'record a lesson and request candidate rules',
  run: cmdLesson,
});

registerCommand({
  name: 'lesson-stage',
  usage: 'lesson-stage <id>',
  summary: 'stage derived rule candidates for approval',
  run: cmdLessonStage,
});

registerCommand({
  name: 'lesson-accept',
  usage: 'lesson-accept <id> <key>',
  summary: 'approve a staged rule and create it',
  run: cmdLessonAccept,
});

registerCommand({
  name: 'lesson-discard',
  usage: 'lesson-discard <id> <key>',
  summary: 'permanently reject a staged rule',
  run: cmdLessonDiscard,
});
```

Add to `src/cli/commands/index.ts`:

```typescript
import './lesson.ts';
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/cli/lesson.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/lesson.ts src/cli/commands/index.ts test/cli/lesson.test.ts
git commit -m "feat: add the lesson command family with an explicit approval step"
```

---

## Task 10: `mycontext review` — the draft queue walker

**Files:**
- Create: `src/cli/commands/review.ts`
- Modify: `src/cli/commands/index.ts` (add `import './review.ts';`)
- Test: `test/cli/review.test.ts`

**Interfaces:**
- Consumes: `updateItem`, `MutateContext` from `src/core/mutate.ts`; `renderItem` from `src/core/item.ts`; `openMutateContext`; `registerCommand`, `flag`, `positionals`
- Produces: the registered `review` command with subcommands `list` (default), `show`, `promote`, `discard`

`promote` is the single gate through which anything an agent or an ingest produced becomes governing. It refuses to promote a non-draft, and refuses to promote into a disabled category — otherwise an item would be `active` yet permanently ineligible, which is exactly the silent wrongness spec §10 warns about.

`discard` sets `deprecated` rather than deleting. Deletion is not offered here at all: a trail is what makes a wrong promotion recoverable.

- [ ] **Step 1: Write the failing test**

`test/cli/review.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function draft(cwd: string, id: string, type: string, title: string, extra = ''): void {
  const file = path.join(cwd, '.my_context', 'items', type, `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: ${type}
title: ${title}
status: draft
severity: soft
always: false
origin: ingest
source_file: docs/prd.md
source_anchor: password-policy
${extra}---

# ${title}

Body text.
`, 'utf8');
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-review-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

test('review lists drafts with their type, origin and source', () => {
  const cwd = project();
  draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
  draft(cwd, 'CONST-b', 'constraint', 'Constraint B');
  const { code, out } = run(['review'], cwd);
  assert.equal(code, 0);
  assert.match(out, /REQ-a\s+requirement\s+ingest\s+docs\/prd\.md/);
  assert.match(out, /CONST-b/);
  assert.match(out, /2 draft/);
  rmSync(cwd, { recursive: true, force: true });
});

test('review reports an empty queue rather than printing nothing', () => {
  const cwd = project();
  const { code, out } = run(['review'], cwd);
  assert.equal(code, 0);
  assert.match(out, /no drafts/i);
  rmSync(cwd, { recursive: true, force: true });
});

test('review --type filters the queue', () => {
  const cwd = project();
  draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
  draft(cwd, 'CONST-b', 'constraint', 'Constraint B');
  const { out } = run(['review', 'list', '--type', 'constraint'], cwd);
  assert.match(out, /CONST-b/);
  assert.equal(/REQ-a/.test(out), false);
  rmSync(cwd, { recursive: true, force: true });
});

test('review show prints the full item and its provenance', () => {
  const cwd = project();
  draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
  const { code, out } = run(['review', 'show', 'REQ-a'], cwd);
  assert.equal(code, 0);
  assert.match(out, /Body text\./);
  assert.match(out, /docs\/prd\.md/);
  assert.match(out, /password-policy/);
  rmSync(cwd, { recursive: true, force: true });
});

test('promote moves a draft to active', () => {
  const cwd = project();
  draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
  const { code, out } = run(['review', 'promote', 'REQ-a'], cwd);
  assert.equal(code, 0);
  assert.match(out, /REQ-a.*active/);
  assert.match(run(['list'], cwd).out, /REQ-a\s+requirement\s+active/);
  rmSync(cwd, { recursive: true, force: true });
});

test('promote can set scope in the same step', () => {
  const cwd = project();
  draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
  run(['review', 'promote', 'REQ-a', '--scope', 'src/auth/**'], cwd);
  assert.match(run(['show', 'REQ-a'], cwd).out, /- "src\/auth\/\*\*"/);
  rmSync(cwd, { recursive: true, force: true });
});

test('promoting a non-draft is refused with its actual status', () => {
  const cwd = project();
  run(['add', 'constraint', 'Already active'], cwd);
  const { code, out } = run(['review', 'promote', 'CONST-already-active'], cwd);
  assert.equal(code, 1);
  assert.match(out, /active/);
  assert.match(out, /only drafts/i);
  rmSync(cwd, { recursive: true, force: true });
});

test('promoting into a disabled category is refused rather than creating a silently inert item', () => {
  const cwd = project();
  writeFileSync(
    path.join(cwd, '.my_context', 'config.json'),
    JSON.stringify({ profile: 'standard', categories: { requirement: { enabled: false } } }, null, 2),
    'utf8',
  );
  draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
  const { code, out } = run(['review', 'promote', 'REQ-a'], cwd);
  assert.equal(code, 1);
  assert.match(out, /not enabled/i);
  assert.match(out, /never be injected/i);
  rmSync(cwd, { recursive: true, force: true });
});

test('discard deprecates rather than deleting, leaving a trail', () => {
  const cwd = project();
  draft(cwd, 'REQ-a', 'requirement', 'Requirement A');
  const { code, out } = run(['review', 'discard', 'REQ-a'], cwd);
  assert.equal(code, 0);
  assert.match(out, /deprecated/);
  assert.match(run(['list'], cwd).out, /REQ-a\s+requirement\s+deprecated/);
  assert.match(run(['review'], cwd).out, /no drafts/i);
  rmSync(cwd, { recursive: true, force: true });
});

test('an unknown id is reported for every subcommand', () => {
  const cwd = project();
  for (const sub of ['show', 'promote', 'discard']) {
    const { code, out } = run(['review', sub, 'REQ-nope'], cwd);
    assert.equal(code, 1, sub);
    assert.match(out, /REQ-nope/, sub);
  }
  rmSync(cwd, { recursive: true, force: true });
});

test('an unknown subcommand prints usage', () => {
  const cwd = project();
  const { code, out } = run(['review', 'frobnicate'], cwd);
  assert.equal(code, 1);
  assert.match(out, /usage: mycontext review/);
  rmSync(cwd, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cli/review.test.ts`
Expected: FAIL — `unknown command "review"`

- [ ] **Step 3: Implement**

`src/cli/commands/review.ts`:

```typescript
import { renderItem } from '../../core/item.ts';
import { updateItem, type MutateContext } from '../../core/mutate.ts';
import type { Item } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { openMutateContext } from './context.ts';
import { flag, positionals, registerCommand, type Emit } from './registry.ts';

const USAGE = `usage: mycontext review [list] [--type <category>]
       mycontext review show <id>
       mycontext review promote <id> [--scope "a/**,b/**"] [--always] [--severity hard|soft]
       mycontext review discard <id>`;

function drafts(ctx: MutateContext, type: string | null): Item[] {
  return ctx.store.all()
    .filter((i) => i.status === 'draft')
    .filter((i) => type === null || i.type === type)
    .sort((a, b) => (a.type === b.type ? a.id.localeCompare(b.id) : a.type.localeCompare(b.type)));
}

function findDraftTarget(ctx: MutateContext, id: string, out: Emit): Item | null {
  const item = ctx.store.get(id);
  if (!item) {
    out(`my_context: no item with id "${id}". List the queue with \`mycontext review\`.`);
    return null;
  }
  return item;
}

function cmdReview(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  const valueFlags = ['type', 'scope', 'severity'];
  const [subcommand = 'list', id] = positionals(args, valueFlags);

  if (!['list', 'show', 'promote', 'discard'].includes(subcommand)) {
    out(`my_context: unknown review subcommand "${subcommand}".\n\n${USAGE}`);
    return 1;
  }

  const ctx = openMutateContext(ws);
  try {
    if (subcommand === 'list') {
      const type = flag(args, 'type');
      const queue = drafts(ctx, type);
      if (queue.length === 0) {
        out(type
          ? `my_context: no drafts of type "${type}".`
          : 'my_context: no drafts pending review.');
        return 0;
      }
      for (const item of queue) {
        out(
          `${item.id.padEnd(44)}${item.type.padEnd(14)}${item.origin.padEnd(8)}` +
          `${(item.sourceFile ?? '-').padEnd(30)}${item.title}`,
        );
      }
      out('');
      out(`${queue.length} draft(s) pending. Promote with \`mycontext review promote <id>\`.`);
      return 0;
    }

    if (!id) { out(USAGE); return 1; }

    const item = findDraftTarget(ctx, id, out);
    if (!item) return 1;

    if (subcommand === 'show') {
      out(renderItem(item));
      if (item.sourceFile) {
        out('');
        out(`provenance: ${item.sourceFile} § ${item.sourceAnchor ?? '(no anchor)'} ` +
            `checksum ${item.sourceChecksum ?? '(none)'}`);
      }
      return 0;
    }

    if (item.status !== 'draft') {
      out(
        `my_context: ${item.id} is "${item.status}", not "draft". ` +
        `review only drafts; use \`mycontext show ${item.id}\` to inspect it.`,
      );
      return 1;
    }

    if (subcommand === 'discard') {
      updateItem(ctx, item.id, { status: 'deprecated' });
      out(`my_context: ${item.id} is now deprecated. It is kept as a trail rather than deleted.`);
      return 0;
    }

    const category = ws.config.categories[item.type];
    if (!category?.enabled) {
      out(
        `my_context: category "${item.type}" is not enabled in this project, so ${item.id} ` +
        `would never be injected even as "active". Enable it in .my_context/config.json ` +
        `under categories.${item.type}.enabled, then promote.`,
      );
      return 1;
    }

    const patch: Record<string, unknown> = { status: 'active' };
    const scope = flag(args, 'scope');
    if (scope !== null) patch.scope = scope.split(',').map((s) => s.trim()).filter(Boolean);
    const severity = flag(args, 'severity');
    if (severity === 'hard' || severity === 'soft') patch.severity = severity;
    if (args.includes('--always')) patch.always = true;

    const result = updateItem(ctx, item.id, patch);
    const scoping = result.item.scope.length
      ? `scope ${result.item.scope.join(', ')}`
      : 'no scope — indexed and searchable, but never auto-injected';
    out(`my_context: ${item.id} is now active (${scoping}).`);
    return 0;
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  } finally {
    ctx.store.close();
  }
}

registerCommand({
  name: 'review',
  usage: 'review [show|promote|discard]',
  summary: 'walk the draft queue and promote what should govern',
  run: cmdReview,
});
```

Add to `src/cli/commands/index.ts`:

```typescript
import './review.ts';
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/cli/review.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/review.ts src/cli/commands/index.ts test/cli/review.test.ts
git commit -m "feat: add the review command to walk and promote the draft queue"
```

---

## Task 11: The doctor checks

**Files:**
- Create: `src/doctor/checks.ts`
- Test: `test/doctor/checks.test.ts`

**Interfaces:**
- Consumes: `relPosix`, `matchesAnyGlob` from `src/core/paths.ts`; `chunkDocument` from `src/ingest/chunk.ts`; `Item` from `src/core/types.ts`
- Produces:
  - `Finding { level: 'error' | 'warn' | 'info'; code: string; message: string; item?: string }`
  - `listRepoFiles(repoRoot: string, limit?: number): string[]`
  - `checkIndexFreshness(root: string, dbPath: string): Finding[]`
  - `checkOrphanRelations(items: Item[]): Finding[]`
  - `checkSourceDrift(repoRoot: string, items: Item[]): Finding[]`
  - `checkDeadScopes(repoRoot: string, items: Item[]): Finding[]`
  - `checkPermissions(root: string): Finding[]`
  - `runChecks(opts: { root: string; repoRoot: string; dbPath: string; items: Item[] }): Finding[]`

These are exactly the five checks named in spec §10. Each is an independent pure-ish function over a directory and a list of items, so each is tested in isolation and none can abort the others.

**Checksum drift never auto-resolves** (spec §10). `checkSourceDrift` re-chunks the current source file and compares the chunk's checksum against the `source_checksum` recorded at ingest. It reports; it never rewrites either side.

- [ ] **Step 1: Write the failing test**

`test/doctor/checks.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  listRepoFiles, checkIndexFreshness, checkOrphanRelations,
  checkSourceDrift, checkDeadScopes, checkPermissions, runChecks,
} from '../../src/doctor/checks.ts';
import { chunkDocument } from '../../src/ingest/chunk.ts';
import type { Item } from '../../src/core/types.ts';

const DOC = `# Password policy\n\nPasswords must be at least 12 characters.\n`;

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: '', observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

function repo(): { repoRoot: string; root: string; cleanup: () => void } {
  const repoRoot = mkdtempSync(path.join(tmpdir(), 'myctx-doc-'));
  const root = path.join(repoRoot, '.my_context');
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  mkdirSync(path.join(repoRoot, 'src', 'db'), { recursive: true });
  writeFileSync(path.join(repoRoot, 'src', 'db', 'writer.ts'), 'export const x = 1;\n');
  return { repoRoot, root, cleanup: () => rmSync(repoRoot, { recursive: true, force: true }) };
}

test('listRepoFiles returns POSIX paths and skips the usual noise', () => {
  const { repoRoot, cleanup } = repo();
  mkdirSync(path.join(repoRoot, 'node_modules', 'pkg'), { recursive: true });
  writeFileSync(path.join(repoRoot, 'node_modules', 'pkg', 'index.js'), '');
  mkdirSync(path.join(repoRoot, '.git'), { recursive: true });
  writeFileSync(path.join(repoRoot, '.git', 'HEAD'), '');

  const files = listRepoFiles(repoRoot);
  assert.ok(files.includes('src/db/writer.ts'));
  assert.equal(files.some((f) => f.includes('node_modules')), false);
  assert.equal(files.some((f) => f.includes('.git/')), false);
  assert.equal(files.some((f) => f.includes('.my_context')), false);
  assert.equal(files.some((f) => f.includes('\\')), false);
  cleanup();
});

test('index freshness: a missing index is informational, not an error', () => {
  const { root, cleanup } = repo();
  const findings = checkIndexFreshness(root, path.join(root, '.index.db'));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, 'info');
  assert.equal(findings[0].code, 'index_missing');
  cleanup();
});

test('index freshness: an index older than the newest item file is a warning', () => {
  const { root, cleanup } = repo();
  const db = path.join(root, '.index.db');
  writeFileSync(db, '');
  const old = new Date(Date.now() - 60_000);
  utimesSync(db, old, old);
  writeFileSync(path.join(root, 'items', 'constraint', 'CONST-a.md'), '---\nid: CONST-a\n---\n');

  const findings = checkIndexFreshness(root, db);
  assert.equal(findings[0].code, 'index_stale');
  assert.equal(findings[0].level, 'warn');
  assert.match(findings[0].message, /rebuild/);
  cleanup();
});

test('index freshness: a fresh index reports nothing', () => {
  const { root, cleanup } = repo();
  writeFileSync(path.join(root, 'items', 'constraint', 'CONST-a.md'), '---\nid: CONST-a\n---\n');
  const db = path.join(root, '.index.db');
  writeFileSync(db, '');
  assert.deepEqual(checkIndexFreshness(root, db), []);
  cleanup();
});

test('orphan relations name the source item and the missing target', () => {
  const findings = checkOrphanRelations([
    item({ id: 'CONST-a', relations: [{ type: 'derived_from', target: 'ADR-gone' }] }),
    item({ id: 'ADR-here', type: 'adr' }),
  ]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, 'orphan_relation');
  assert.equal(findings[0].item, 'CONST-a');
  assert.match(findings[0].message, /ADR-gone/);
  assert.match(findings[0].message, /derived_from/);
});

test('a resolved relation is not an orphan', () => {
  assert.deepEqual(checkOrphanRelations([
    item({ id: 'CONST-a', relations: [{ type: 'supersedes', target: 'CONST-b' }] }),
    item({ id: 'CONST-b' }),
  ]), []);
});

test('source drift: an unchanged source is clean', () => {
  const { repoRoot, cleanup } = repo();
  writeFileSync(path.join(repoRoot, 'prd.md'), DOC);
  const chunk = chunkDocument(DOC)[0];
  assert.deepEqual(checkSourceDrift(repoRoot, [item({
    sourceFile: 'prd.md', sourceAnchor: chunk.anchor, sourceChecksum: chunk.checksum,
  })]), []);
  cleanup();
});

test('source drift: an edited source is flagged and never auto-resolved', () => {
  const { repoRoot, cleanup } = repo();
  const chunk = chunkDocument(DOC)[0];
  writeFileSync(path.join(repoRoot, 'prd.md'), DOC.replace('12', '16'));

  const findings = checkSourceDrift(repoRoot, [item({
    id: 'REQ-pw', sourceFile: 'prd.md', sourceAnchor: chunk.anchor, sourceChecksum: chunk.checksum,
  })]);
  assert.equal(findings[0].code, 'source_drift');
  assert.equal(findings[0].level, 'warn');
  assert.equal(findings[0].item, 'REQ-pw');
  assert.match(findings[0].message, /prd\.md/);
  assert.match(findings[0].message, /update or supersede/i);
  assert.equal(chunkDocument(DOC)[0].checksum, chunk.checksum, 'the check must not rewrite anything');
  cleanup();
});

test('source drift: a deleted source file is an error', () => {
  const { repoRoot, cleanup } = repo();
  const findings = checkSourceDrift(repoRoot, [item({
    id: 'REQ-pw', sourceFile: 'gone.md', sourceAnchor: 'password-policy', sourceChecksum: 'abc',
  })]);
  assert.equal(findings[0].code, 'source_missing');
  assert.equal(findings[0].level, 'error');
  cleanup();
});

test('source drift: a renamed heading loses the anchor and says so', () => {
  const { repoRoot, cleanup } = repo();
  writeFileSync(path.join(repoRoot, 'prd.md'), DOC.replace('# Password policy', '# Credentials'));
  const findings = checkSourceDrift(repoRoot, [item({
    id: 'REQ-pw', sourceFile: 'prd.md', sourceAnchor: 'password-policy', sourceChecksum: 'abc',
  })]);
  assert.equal(findings[0].code, 'source_anchor_missing');
  assert.match(findings[0].message, /credentials/);
  cleanup();
});

test('items with no provenance are not drift-checked', () => {
  const { repoRoot, cleanup } = repo();
  assert.deepEqual(checkSourceDrift(repoRoot, [item()]), []);
  cleanup();
});

test('dead scopes: a glob matching nothing on disk is flagged', () => {
  const { repoRoot, cleanup } = repo();
  const findings = checkDeadScopes(repoRoot, [item({ id: 'CONST-a', scope: ['src/legacy/**'] })]);
  assert.equal(findings[0].code, 'dead_scope');
  assert.equal(findings[0].item, 'CONST-a');
  assert.match(findings[0].message, /src\/legacy\/\*\*/);
  cleanup();
});

test('dead scopes: a live glob is clean, and only the dead one is named', () => {
  const { repoRoot, cleanup } = repo();
  const findings = checkDeadScopes(repoRoot, [item({ scope: ['src/db/**', 'src/gone/**'] })]);
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /src\/gone/);
  cleanup();
});

test('dead scopes: only active items are checked — a draft is not rot', () => {
  const { repoRoot, cleanup } = repo();
  assert.deepEqual(checkDeadScopes(repoRoot, [item({ status: 'draft', scope: ['src/gone/**'] })]), []);
  cleanup();
});

test('permissions: a writable workspace is clean', () => {
  const { root, cleanup } = repo();
  assert.deepEqual(checkPermissions(root).filter((f) => f.level === 'error'), []);
  cleanup();
});

test('permissions: a missing gitignore for the index is a warning', () => {
  const { root, cleanup } = repo();
  const findings = checkPermissions(root);
  assert.ok(findings.some((f) => f.code === 'index_not_ignored'));
  cleanup();
});

test('permissions: an existing gitignore covering the index is clean', () => {
  const { root, cleanup } = repo();
  writeFileSync(path.join(root, '.gitignore'), '.index.db\n.index.db-*\n');
  assert.equal(checkPermissions(root).some((f) => f.code === 'index_not_ignored'), false);
  cleanup();
});

test('runChecks aggregates every check and one failing check does not hide the others', () => {
  const { repoRoot, root, cleanup } = repo();
  const findings = runChecks({
    root, repoRoot,
    dbPath: path.join(root, '.index.db'),
    items: [
      item({ id: 'CONST-a', scope: ['src/gone/**'], relations: [{ type: 'derived_from', target: 'ADR-gone' }] }),
      item({ id: 'REQ-b', sourceFile: 'gone.md', sourceAnchor: 'x', sourceChecksum: 'y' }),
    ],
  });
  const codes = new Set(findings.map((f) => f.code));
  assert.ok(codes.has('orphan_relation'));
  assert.ok(codes.has('dead_scope'));
  assert.ok(codes.has('source_missing'));
  assert.ok(codes.has('index_missing'));
  cleanup();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/doctor/checks.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`src/doctor/checks.ts`:

```typescript
import { accessSync, constants, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { matchesAnyGlob, relPosix } from '../core/paths.ts';
import type { Item } from '../core/types.ts';
import { chunkDocument } from '../ingest/chunk.ts';

export interface Finding {
  level: 'error' | 'warn' | 'info';
  code: string;
  message: string;
  item?: string;
}

const SKIP_DIRS = new Set([
  '.git', '.my_context', 'node_modules', 'dist', 'build', 'out',
  '.venv', 'venv', '__pycache__', '.next', '.turbo', 'coverage',
]);

const FILE_LIMIT = 20_000;

/** Repo-relative POSIX paths of every tracked-looking file, bounded so doctor stays fast. */
export function listRepoFiles(repoRoot: string, limit: number = FILE_LIMIT): string[] {
  const out: string[] = [];

  const walk = (dir: string): void => {
    if (out.length >= limit) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= limit) return;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
        continue;
      }
      if (entry.isFile()) out.push(relPosix(repoRoot, path.join(dir, entry.name)));
    }
  };

  walk(repoRoot);
  return out;
}

function newestMarkdownMtime(dir: string): number {
  let newest = 0;
  const walk = (current: string): void => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.md')) continue;
      try {
        newest = Math.max(newest, statSync(full).mtimeMs);
      } catch {
        // A file deleted mid-walk is not a doctor finding.
      }
    }
  };
  walk(dir);
  return newest;
}

export function checkIndexFreshness(root: string, dbPath: string): Finding[] {
  if (!existsSync(dbPath)) {
    return [{
      level: 'info', code: 'index_missing',
      message: `no index at ${dbPath}. It is disposable and will be built on the next command.`,
    }];
  }

  let indexMtime: number;
  try {
    indexMtime = statSync(dbPath).mtimeMs;
  } catch (err) {
    return [{
      level: 'error', code: 'index_unreadable',
      message: `cannot stat ${dbPath}: ${err instanceof Error ? err.message : String(err)}`,
    }];
  }

  const newest = newestMarkdownMtime(path.join(root, 'items'));
  if (newest > indexMtime) {
    return [{
      level: 'warn', code: 'index_stale',
      message:
        `the index is older than the newest item file ` +
        `(${new Date(indexMtime).toISOString()} vs ${new Date(newest).toISOString()}). ` +
        `Run \`mycontext rebuild\`.`,
    }];
  }
  return [];
}

export function checkOrphanRelations(items: Item[]): Finding[] {
  const known = new Set(items.map((i) => i.id));
  const findings: Finding[] = [];

  for (const item of items) {
    for (const relation of item.relations) {
      if (known.has(relation.target)) continue;
      findings.push({
        level: 'warn', code: 'orphan_relation', item: item.id,
        message:
          `relation "${relation.type} [[${relation.target}]]" points at an item that does not exist. ` +
          `Create it, or remove the line from ${item.filePath}.`,
      });
    }
  }
  return findings;
}

export function checkSourceDrift(repoRoot: string, items: Item[]): Finding[] {
  const findings: Finding[] = [];
  const cache = new Map<string, ReturnType<typeof chunkDocument> | null>();

  for (const item of items) {
    if (!item.sourceFile || !item.sourceAnchor || !item.sourceChecksum) continue;

    if (!cache.has(item.sourceFile)) {
      const absolute = path.resolve(repoRoot, ...item.sourceFile.split('/'));
      try {
        cache.set(item.sourceFile, chunkDocument(readFileSync(absolute, 'utf8')));
      } catch {
        cache.set(item.sourceFile, null);
      }
    }

    const chunks = cache.get(item.sourceFile);
    if (chunks === null || chunks === undefined) {
      findings.push({
        level: 'error', code: 'source_missing', item: item.id,
        message:
          `source document "${item.sourceFile}" is gone. The item still stands, but its provenance ` +
          `cannot be verified. Clear source_file, or restore the document.`,
      });
      continue;
    }

    const chunk = chunks.find((c) => c.anchor === item.sourceAnchor);
    if (!chunk) {
      findings.push({
        level: 'warn', code: 'source_anchor_missing', item: item.id,
        message:
          `"${item.sourceFile}" no longer has a section anchored "${item.sourceAnchor}" — it was probably ` +
          `renamed. Current anchors: ${chunks.map((c) => c.anchor).join(', ')}.`,
      });
      continue;
    }

    if (chunk.checksum !== item.sourceChecksum) {
      findings.push({
        level: 'warn', code: 'source_drift', item: item.id,
        message:
          `"${item.sourceFile}" § ${item.sourceAnchor} has changed since this item was captured ` +
          `(${item.sourceChecksum} → ${chunk.checksum}). Nothing was auto-resolved: read the section and ` +
          `update or supersede ${item.id} yourself.`,
      });
    }
  }

  return findings;
}

export function checkDeadScopes(repoRoot: string, items: Item[]): Finding[] {
  const scoped = items.filter((i) => i.status === 'active' && i.scope.length > 0);
  if (scoped.length === 0) return [];

  const files = listRepoFiles(repoRoot);
  const findings: Finding[] = [];

  for (const item of scoped) {
    for (const glob of item.scope) {
      if (files.some((f) => matchesAnyGlob(f, [glob]))) continue;
      findings.push({
        level: 'warn', code: 'dead_scope', item: item.id,
        message:
          `scope glob "${glob}" matches no file in the repository. ${item.id} will never activate ` +
          `through it — the clearest rot signal after a refactor. Re-scope it or drop the glob.`,
      });
    }
  }
  return findings;
}

export function checkPermissions(root: string): Finding[] {
  const findings: Finding[] = [];

  for (const target of [root, path.join(root, 'items')]) {
    try {
      accessSync(target, constants.R_OK | constants.W_OK);
    } catch (err) {
      findings.push({
        level: 'error', code: 'not_writable',
        message: `${target} is not readable and writable: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const ignore = path.join(root, '.gitignore');
  let ignored = false;
  try {
    ignored = readFileSync(ignore, 'utf8').split(/\r?\n/).some((line) => line.trim() === '.index.db');
  } catch {
    ignored = false;
  }
  if (!ignored) {
    findings.push({
      level: 'warn', code: 'index_not_ignored',
      message:
        `${ignore} does not ignore .index.db. The index is disposable and machine-specific; ` +
        `committing it produces binary merge conflicts. Add ".index.db" and ".index.db-*".`,
    });
  }

  return findings;
}

export function runChecks(opts: {
  root: string; repoRoot: string; dbPath: string; items: Item[];
}): Finding[] {
  const checks: (() => Finding[])[] = [
    () => checkIndexFreshness(opts.root, opts.dbPath),
    () => checkOrphanRelations(opts.items),
    () => checkSourceDrift(opts.repoRoot, opts.items),
    () => checkDeadScopes(opts.repoRoot, opts.items),
    () => checkPermissions(opts.root),
  ];

  const findings: Finding[] = [];
  for (const check of checks) {
    try {
      findings.push(...check());
    } catch (err) {
      // A check that throws must never suppress the others.
      findings.push({
        level: 'error', code: 'check_failed',
        message: `a doctor check threw: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
  return findings;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/doctor/checks.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/doctor/checks.ts test/doctor/checks.test.ts
git commit -m "feat: add the five doctor checks from spec section 10"
```

---

## Task 12: `mycontext doctor`

**Files:**
- Create: `src/cli/commands/doctor.ts`
- Modify: `src/cli/commands/index.ts` (add `import './doctor.ts';`)
- Test: `test/cli/doctor.test.ts`

**Interfaces:**
- Consumes: `runChecks`, `Finding` from `src/doctor/checks.ts`; `openMutateContext`; `registerCommand`, `hasFlag`
- Produces: the registered `doctor` command, and `summarize(findings: Finding[]): { errors: number; warnings: number; infos: number }` exported for the `status` report in Task 14

Exit code discipline: `0` when there are no `error`-level findings, `1` when there are. Warnings do not fail — a dead glob is worth surfacing but must not break someone's CI on the day they rename a directory.

- [ ] **Step 1: Write the failing test**

`test/cli/doctor.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { chunkDocument } from '../../src/ingest/chunk.ts';

const DOC = `# Password policy\n\nPasswords must be at least 12 characters.\n`;

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-cli-doc-'));
  runCli(['init'], cwd, () => {});
  mkdirSync(path.join(cwd, 'src', 'db'), { recursive: true });
  writeFileSync(path.join(cwd, 'src', 'db', 'writer.ts'), 'export const x = 1;\n');
  return cwd;
}

function writeItem(cwd: string, id: string, type: string, frontmatter: string): void {
  const file = path.join(cwd, '.my_context', 'items', type, `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---\nid: ${id}\ntype: ${type}\ntitle: ${id}\nstatus: active\n${frontmatter}---\n\n# ${id}\n\nBody.\n`, 'utf8');
}

test('a clean workspace passes with exit 0', () => {
  const cwd = project();
  writeItem(cwd, 'CONST-a', 'constraint', 'scope:\n  - "src/db/**"\n');
  const { code, out } = run(['doctor'], cwd);
  assert.equal(code, 0);
  assert.match(out, /0 error/);
  rmSync(cwd, { recursive: true, force: true });
});

test('a dead scope glob is warned about but does not fail', () => {
  const cwd = project();
  writeItem(cwd, 'CONST-a', 'constraint', 'scope:\n  - "src/legacy/**"\n');
  const { code, out } = run(['doctor'], cwd);
  assert.equal(code, 0, 'a warning must not break the build the day a directory is renamed');
  assert.match(out, /dead_scope/);
  assert.match(out, /src\/legacy/);
  assert.match(out, /1 warning/);
  rmSync(cwd, { recursive: true, force: true });
});

test('a missing source document is an error and exits 1', () => {
  const cwd = project();
  writeItem(cwd, 'REQ-a', 'requirement',
    'source_file: docs/gone.md\nsource_anchor: password-policy\nsource_checksum: abc123\n');
  const { code, out } = run(['doctor'], cwd);
  assert.equal(code, 1);
  assert.match(out, /source_missing/);
  assert.match(out, /docs\/gone\.md/);
  rmSync(cwd, { recursive: true, force: true });
});

test('source drift is detected against the live document', () => {
  const cwd = project();
  mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  const chunk = chunkDocument(DOC)[0];
  writeFileSync(path.join(cwd, 'docs', 'prd.md'), DOC.replace('12', '16'), 'utf8');
  writeItem(cwd, 'REQ-a', 'requirement',
    `source_file: docs/prd.md\nsource_anchor: ${chunk.anchor}\nsource_checksum: "${chunk.checksum}"\n`);

  const { code, out } = run(['doctor'], cwd);
  assert.equal(code, 0, 'drift is a warning: it needs a human, not a broken build');
  assert.match(out, /source_drift/);
  assert.match(out, /REQ-a/);
  rmSync(cwd, { recursive: true, force: true });
});

test('an orphan relation is reported with both ends', () => {
  const cwd = project();
  const file = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-a.md');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---\nid: CONST-a\ntype: constraint\ntitle: A\nstatus: active\n---\n\n# A\n\n## Relations\n- derived_from [[ADR-gone]]\n`, 'utf8');
  const { out } = run(['doctor'], cwd);
  assert.match(out, /orphan_relation/);
  assert.match(out, /ADR-gone/);
  rmSync(cwd, { recursive: true, force: true });
});

test('findings are grouped by code so a hundred dead globs read as one problem', () => {
  const cwd = project();
  for (let i = 0; i < 3; i++) writeItem(cwd, `CONST-${i}`, 'constraint', `scope:\n  - "src/gone${i}/**"\n`);
  const { out } = run(['doctor'], cwd);
  assert.equal((out.match(/^dead_scope/gm) ?? []).length, 1);
  assert.match(out, /dead_scope \(3\)/);
  rmSync(cwd, { recursive: true, force: true });
});

test('doctor --quiet prints only the summary line', () => {
  const cwd = project();
  writeItem(cwd, 'CONST-a', 'constraint', 'scope:\n  - "src/legacy/**"\n');
  const { out } = run(['doctor', '--quiet'], cwd);
  assert.equal(out.trim().split('\n').length, 1);
  assert.match(out, /1 warning/);
  rmSync(cwd, { recursive: true, force: true });
});

test('doctor outside a workspace explains how to make one', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-nodoc-'));
  const { code, out } = run(['doctor'], cwd);
  assert.equal(code, 1);
  assert.match(out, /mycontext init/);
  rmSync(cwd, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cli/doctor.test.ts`
Expected: FAIL — `unknown command "doctor"`

- [ ] **Step 3: Implement**

`src/cli/commands/doctor.ts`:

```typescript
import path from 'node:path';
import { runChecks, type Finding } from '../../doctor/checks.ts';
import type { Workspace } from '../../core/workspace.ts';
import { openMutateContext } from './context.ts';
import { hasFlag, registerCommand, type Emit } from './registry.ts';

export function summarize(findings: Finding[]): { errors: number; warnings: number; infos: number } {
  return {
    errors: findings.filter((f) => f.level === 'error').length,
    warnings: findings.filter((f) => f.level === 'warn').length,
    infos: findings.filter((f) => f.level === 'info').length,
  };
}

const ORDER: Record<Finding['level'], number> = { error: 0, warn: 1, info: 2 };

function cmdDoctor(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  const ctx = openMutateContext(ws);
  let findings: Finding[];
  try {
    findings = runChecks({
      root: ws.projectRoot,
      repoRoot: path.dirname(ws.projectRoot),
      dbPath: ws.dbPath,
      items: ctx.store.all(),
    });
  } finally {
    ctx.store.close();
  }

  const counts = summarize(findings);
  const summary =
    `my_context doctor: ${counts.errors} error(s), ${counts.warnings} warning(s), ` +
    `${counts.infos} note(s) across ${findings.length} finding(s).`;

  if (hasFlag(args, 'quiet')) {
    out(summary);
    return counts.errors > 0 ? 1 : 0;
  }

  const grouped = new Map<string, Finding[]>();
  for (const finding of findings) {
    const bucket = grouped.get(finding.code) ?? [];
    bucket.push(finding);
    grouped.set(finding.code, bucket);
  }

  const codes = [...grouped.entries()].sort((a, b) => {
    const byLevel = ORDER[a[1][0].level] - ORDER[b[1][0].level];
    return byLevel !== 0 ? byLevel : a[0].localeCompare(b[0]);
  });

  for (const [code, bucket] of codes) {
    out(`${code} (${bucket.length})  [${bucket[0].level}]`);
    for (const finding of bucket) {
      out(`  ${finding.item ? `${finding.item}: ` : ''}${finding.message}`);
    }
    out('');
  }

  out(summary);
  return counts.errors > 0 ? 1 : 0;
}

registerCommand({
  name: 'doctor',
  usage: 'doctor [--quiet]',
  summary: 'self-check: index freshness, orphans, drift, dead globs, permissions',
  run: cmdDoctor,
});
```

Add to `src/cli/commands/index.ts`:

```typescript
import './doctor.ts';
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/cli/doctor.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/doctor.ts src/cli/commands/index.ts test/cli/doctor.test.ts
git commit -m "feat: add the doctor command with grouped findings and error-only exit codes"
```

---

## Task 13: Decay reporting from the ledger

**Files:**
- Create: `src/core/decay.ts`, `src/cli/commands/decay.ts`
- Modify: `src/cli/commands/index.ts` (add `import './decay.ts';`)
- Test: `test/core/decay.test.ts`, `test/cli/decay.test.ts`

**Interfaces:**
- Consumes: `Ledger`, `Usage` from `src/core/ledger.ts` (**Plan 2 owns the table and the class — this task only reads it**); `Config` from `src/core/config.ts`; `Item` from `src/core/types.ts`; `isEligible` from `src/core/select.ts`
- Produces:
  - `DecayRow { id: string; type: string; title: string; scope: string[]; useCount: number; lastUsed: string | null }`
  - `DecayReport { window: number; sessionsRecorded: number; cold: DecayRow[]; warm: DecayRow[]; unscoped: DecayRow[] }`
  - `computeDecay(input: { items: Item[]; config: Config; usage: Usage[]; recentlyUsed: string[]; window: number; sessionsRecorded: number }): DecayReport`
  - the registered `decay` command

The computation is a pure function over plain data, so the whole report is tested without a ledger, a database or a session. The command is the only place the real `Ledger` is touched — five lines of wiring.

Three buckets, because "unused" has three different meanings and conflating them makes the report useless:

- **cold** — injectable, but not injected in the last N sessions. The decay signal proper.
- **warm** — injected in the window. Listed only under `--all`.
- **unscoped** — active, normative, and carrying no `scope`, so it *cannot* be JIT-injected at all. Not decay, a configuration gap, and reported separately so it does not drown the real signal.

- [ ] **Step 1: Write the failing test for the pure computation**

`test/core/decay.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDecay } from '../../src/core/decay.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Item } from '../../src/core/types.ts';

const CONFIG = resolveConfig({});

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A', status: 'active',
    severity: 'soft', always: false, scope: ['src/**'], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: '', observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

function report(over: Partial<Parameters<typeof computeDecay>[0]> = {}) {
  return computeDecay({
    items: [], config: CONFIG, usage: [], recentlyUsed: [], window: 20, sessionsRecorded: 50,
    ...over,
  });
}

test('an item never injected is cold with a zero count', () => {
  const r = report({ items: [item({ id: 'CONST-a' })] });
  assert.deepEqual(r.cold.map((c) => c.id), ['CONST-a']);
  assert.equal(r.cold[0].useCount, 0);
  assert.equal(r.cold[0].lastUsed, null);
});

test('an item injected inside the window is warm, not cold', () => {
  const r = report({
    items: [item({ id: 'CONST-a' })],
    usage: [{ itemId: 'CONST-a', useCount: 7, lastUsed: '2026-08-14T10:00:00.000Z' }],
    recentlyUsed: ['CONST-a'],
  });
  assert.deepEqual(r.cold, []);
  assert.deepEqual(r.warm.map((w) => w.id), ['CONST-a']);
  assert.equal(r.warm[0].useCount, 7);
});

test('an item used long ago but not in the window is cold, and keeps its history', () => {
  const r = report({
    items: [item({ id: 'CONST-a' })],
    usage: [{ itemId: 'CONST-a', useCount: 3, lastUsed: '2026-01-01T00:00:00.000Z' }],
    recentlyUsed: [],
  });
  assert.deepEqual(r.cold.map((c) => c.id), ['CONST-a']);
  assert.equal(r.cold[0].useCount, 3);
  assert.equal(r.cold[0].lastUsed, '2026-01-01T00:00:00.000Z');
});

test('an unscoped normative item is reported separately, not as decay', () => {
  const r = report({ items: [item({ id: 'CONST-a', scope: [] })] });
  assert.deepEqual(r.cold, []);
  assert.deepEqual(r.unscoped.map((u) => u.id), ['CONST-a']);
});

test('an always:true item is never unscoped — pinning ignores scope', () => {
  const r = report({ items: [item({ id: 'CONST-a', scope: [], always: true })] });
  assert.deepEqual(r.unscoped, []);
  assert.deepEqual(r.cold.map((c) => c.id), ['CONST-a']);
});

test('ineligible items are excluded entirely', () => {
  const r = report({
    items: [
      item({ id: 'CONST-draft', status: 'draft' }),
      item({ id: 'CONST-old', status: 'superseded' }),
      item({ id: 'LESSON-a', type: 'lesson' }),
      item({ id: 'POL-a', type: 'policy' }),
    ],
  });
  assert.deepEqual([...r.cold, ...r.warm, ...r.unscoped].map((x) => x.id), []);
});

test('a rationale category promoted to normative by config is included', () => {
  const cfg = resolveConfig({ categories: { edge_case: { tier: 'normative' } } });
  const r = report({ config: cfg, items: [item({ id: 'EDGE-a', type: 'edge_case' })] });
  assert.deepEqual(r.cold.map((c) => c.id), ['EDGE-a']);
});

test('cold items sort coldest first: never-used before long-ago, then by id', () => {
  const r = report({
    items: [item({ id: 'CONST-b' }), item({ id: 'CONST-a' }), item({ id: 'CONST-c' })],
    usage: [{ itemId: 'CONST-c', useCount: 2, lastUsed: '2026-05-01T00:00:00.000Z' }],
  });
  assert.deepEqual(r.cold.map((c) => c.id), ['CONST-a', 'CONST-b', 'CONST-c']);
});

test('the window is clamped to the number of sessions actually recorded', () => {
  const r = report({ window: 20, sessionsRecorded: 4, items: [item()] });
  assert.equal(r.window, 20);
  assert.equal(r.sessionsRecorded, 4);
});

test('scope is carried through so the report can suggest a fix', () => {
  const r = report({ items: [item({ scope: ['src/db/**'] })] });
  assert.deepEqual(r.cold[0].scope, ['src/db/**']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/core/decay.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the pure computation**

`src/core/decay.ts`:

```typescript
import type { Config } from './config.ts';
import type { Usage } from './ledger.ts';
import { isEligible } from './select.ts';
import type { Item } from './types.ts';

export interface DecayRow {
  id: string;
  type: string;
  title: string;
  scope: string[];
  useCount: number;
  lastUsed: string | null;
}

export interface DecayReport {
  /** How many sessions back the caller asked to look. */
  window: number;
  /** How many sessions the ledger actually holds. */
  sessionsRecorded: number;
  cold: DecayRow[];
  warm: DecayRow[];
  unscoped: DecayRow[];
}

export interface DecayInput {
  items: Item[];
  config: Config;
  usage: Usage[];
  /** Item ids injected during the most recent `window` sessions. */
  recentlyUsed: string[];
  window: number;
  sessionsRecorded: number;
}

function toRow(item: Item, usage: Map<string, Usage>): DecayRow {
  const row = usage.get(item.id);
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    scope: item.scope,
    useCount: row?.useCount ?? 0,
    lastUsed: row?.lastUsed ?? null,
  };
}

/** Never used, then least recently used, then id. Coldest first. */
function byColdest(a: DecayRow, b: DecayRow): number {
  if (a.lastUsed === null && b.lastUsed !== null) return -1;
  if (a.lastUsed !== null && b.lastUsed === null) return 1;
  if (a.lastUsed !== null && b.lastUsed !== null && a.lastUsed !== b.lastUsed) {
    return a.lastUsed < b.lastUsed ? -1 : 1;
  }
  return a.id.localeCompare(b.id);
}

export function computeDecay(input: DecayInput): DecayReport {
  const usage = new Map(input.usage.map((u) => [u.itemId, u]));
  const recent = new Set(input.recentlyUsed);

  const cold: DecayRow[] = [];
  const warm: DecayRow[] = [];
  const unscoped: DecayRow[] = [];

  for (const item of input.items) {
    if (!isEligible(item, input.config)) continue;
    if (input.config.categories[item.type]?.tier !== 'normative') continue;

    const row = toRow(item, usage);

    // An item with no scope and no pin cannot reach a session at all. That is a
    // configuration gap, not decay, and mixing the two hides the real signal.
    if (!item.always && item.scope.length === 0) { unscoped.push(row); continue; }

    (recent.has(item.id) ? warm : cold).push(row);
  }

  return {
    window: input.window,
    sessionsRecorded: input.sessionsRecorded,
    cold: cold.sort(byColdest),
    warm: warm.sort(byColdest),
    unscoped: unscoped.sort(byColdest),
  };
}
```

- [ ] **Step 4: Write the failing CLI test**

`test/cli/decay.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { Ledger } from '../../src/core/ledger.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-decay-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function scoped(cwd: string, id: string, title: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'constraint', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---\nid: ${id}\ntype: constraint\ntitle: ${title}\nstatus: active\nscope:\n  - "src/**"\n---\n\n# ${title}\n\nBody.\n`, 'utf8');
}

test('decay lists items never injected in the window', () => {
  const cwd = project();
  scoped(cwd, 'CONST-a', 'Never used');
  const { code, out } = run(['decay'], cwd);
  assert.equal(code, 0);
  assert.match(out, /CONST-a/);
  assert.match(out, /never/i);
  rmSync(cwd, { recursive: true, force: true });
});

test('an item injected in the window drops out of the cold list', () => {
  const cwd = project();
  scoped(cwd, 'CONST-a', 'Used recently');
  scoped(cwd, 'CONST-b', 'Never used');

  const ledger = Ledger.open(resolveWorkspace(cwd).dbPath);
  ledger.record('s1', 'CONST-a', 'jit', new Date().toISOString());
  ledger.close();

  const { out } = run(['decay'], cwd);
  assert.match(out, /CONST-b/);
  assert.equal(/^CONST-a/m.test(out), false);
  rmSync(cwd, { recursive: true, force: true });
});

test('unscoped normative items are reported separately from decay', () => {
  const cwd = project();
  run(['add', 'constraint', 'No scope at all'], cwd);
  const { out } = run(['decay'], cwd);
  assert.match(out, /never auto-injected/i);
  assert.match(out, /CONST-no-scope-at-all/);
  rmSync(cwd, { recursive: true, force: true });
});

test('decay --sessions narrows the window and says so', () => {
  const cwd = project();
  scoped(cwd, 'CONST-a', 'Never used');
  const { out } = run(['decay', '--sessions', '5'], cwd);
  assert.match(out, /last 5 session/);
  rmSync(cwd, { recursive: true, force: true });
});

test('decay --all also lists the warm items', () => {
  const cwd = project();
  scoped(cwd, 'CONST-a', 'Used recently');
  const ledger = Ledger.open(resolveWorkspace(cwd).dbPath);
  ledger.record('s1', 'CONST-a', 'jit', new Date().toISOString());
  ledger.close();

  assert.equal(/CONST-a/.test(run(['decay'], cwd).out), false);
  assert.match(run(['decay', '--all'], cwd).out, /CONST-a/);
  rmSync(cwd, { recursive: true, force: true });
});

test('an empty corpus reports nothing to decay rather than an empty screen', () => {
  const cwd = project();
  const { code, out } = run(['decay'], cwd);
  assert.equal(code, 0);
  assert.match(out, /nothing/i);
  rmSync(cwd, { recursive: true, force: true });
});

test('a non-numeric --sessions is rejected', () => {
  const cwd = project();
  const { code, out } = run(['decay', '--sessions', 'many'], cwd);
  assert.equal(code, 1);
  assert.match(out, /--sessions/);
  rmSync(cwd, { recursive: true, force: true });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `node --test test/cli/decay.test.ts`
Expected: FAIL — `unknown command "decay"`

- [ ] **Step 6: Implement the command**

`src/cli/commands/decay.ts`:

```typescript
import { computeDecay, type DecayRow } from '../../core/decay.ts';
import { Ledger } from '../../core/ledger.ts';
import type { Workspace } from '../../core/workspace.ts';
import { openMutateContext } from './context.ts';
import { flag, hasFlag, registerCommand, type Emit } from './registry.ts';

const DEFAULT_WINDOW = 20;

function line(row: DecayRow): string {
  const used = row.lastUsed === null
    ? 'never injected'
    : `${row.useCount}x, last ${row.lastUsed.slice(0, 10)}`;
  return `${row.id.padEnd(44)}${row.type.padEnd(14)}${used.padEnd(24)}${row.title}`;
}

function cmdDecay(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  const rawWindow = flag(args, 'sessions');
  let window = DEFAULT_WINDOW;
  if (rawWindow !== null) {
    const parsed = Number(rawWindow);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      out(`my_context: --sessions must be a positive whole number. You passed "${rawWindow}".`);
      return 1;
    }
    window = parsed;
  }

  const ctx = openMutateContext(ws);
  const ledger = Ledger.open(ws.dbPath);
  try {
    const recentSessions = ledger.recentSessions(window);
    const report = computeDecay({
      items: ctx.store.all(),
      config: ws.config,
      usage: ledger.allUsage(),
      recentlyUsed: ledger.itemsUsedIn(recentSessions),
      window,
      sessionsRecorded: ledger.sessionCount(),
    });

    if (report.cold.length === 0 && report.unscoped.length === 0 && report.warm.length === 0) {
      out('my_context: nothing to report — no active normative items in this project yet.');
      return 0;
    }

    out(
      `my_context decay — items not injected in the last ${report.window} session(s). ` +
      `The ledger holds ${report.sessionsRecorded} session(s).`,
    );

    if (report.sessionsRecorded < report.window) {
      out(`  (only ${report.sessionsRecorded} recorded, so "cold" mostly means "new")`);
    }

    out('');
    if (report.cold.length === 0) {
      out('cold: none — every scoped item activated inside the window.');
    } else {
      out(`cold (${report.cold.length}) — candidates for supersession or re-scoping:`);
      for (const row of report.cold) out(`  ${line(row)}`);
    }

    if (report.unscoped.length) {
      out('');
      out(
        `unscoped (${report.unscoped.length}) — active and normative but carrying no scope, ` +
        `so they are never auto-injected. Not decay: add a scope glob or set always: true.`,
      );
      for (const row of report.unscoped) out(`  ${line(row)}`);
    }

    if (hasFlag(args, 'all') && report.warm.length) {
      out('');
      out(`warm (${report.warm.length}) — injected inside the window:`);
      for (const row of report.warm) out(`  ${line(row)}`);
    }

    return 0;
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  } finally {
    ledger.close();
    ctx.store.close();
  }
}

registerCommand({
  name: 'decay',
  usage: 'decay [--sessions N] [--all]',
  summary: 'items that have not been injected lately',
  run: cmdDecay,
});
```

Add to `src/cli/commands/index.ts`:

```typescript
import './decay.ts';
```

- [ ] **Step 7: Run tests and typecheck**

Run: `node --test test/core/decay.test.ts test/cli/decay.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/core/decay.ts src/cli/commands/decay.ts src/cli/commands/index.ts test/core/decay.test.ts test/cli/decay.test.ts
git commit -m "feat: report decayed items from the session ledger"
```

---

## Task 14: Read-only SQL passthrough

**Files:**
- Modify: `src/core/store.ts` — add `Store.openReadOnly` and `raw`
- Create: `src/cli/commands/query.ts`
- Modify: `src/cli/commands/index.ts` (add `import './query.ts';`)
- Test: `test/core/store-readonly.test.ts`, `test/cli/query.test.ts`

**Interfaces:**
- Consumes: `DatabaseSync` from `node:sqlite`; `resolveWorkspace`
- Produces:
  - `Store.openReadOnly(dbPath: string): Store`
  - `Store.prototype.raw(sql: string): Record<string, unknown>[]`
  - `assertSelectOnly(sql: string): void`
  - the registered `query` command

Two independent defences, because either alone is a bad bet:

1. **`assertSelectOnly`** strips comments and string literals, then requires the statement to begin with `SELECT` or `WITH`, forbids a second statement, and rejects a denylist of mutating and side-effecting keywords (`ATTACH` and `PRAGMA` included — both can reach outside the database).
2. **A read-only connection.** `new DatabaseSync(path, { readOnly: true })` makes a write impossible at the SQLite layer even if the parser is outwitted. The test asserts a write through it throws, so if the option behaves differently than expected on this Node build, the test says so rather than the guarantee quietly evaporating.

`openReadOnly` must not run the schema DDL — that would be a write.

- [ ] **Step 1: Write the failing store test**

`test/core/store-readonly.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store } from '../../src/core/store.ts';
import { parseItem } from '../../src/core/item.ts';

function dbFile(): string {
  return path.join(mkdtempSync(path.join(tmpdir(), 'myctx-ro-')), 'index.db');
}

function seed(file: string): void {
  const store = Store.open(file);
  store.upsert(parseItem(
    '---\nid: CONST-a\ntype: constraint\ntitle: A constraint\nstatus: active\n---\n\n# A constraint\n',
    'items/constraint/CONST-a.md', 'project',
  ));
  store.close();
}

test('raw returns rows as plain objects', () => {
  const file = dbFile();
  seed(file);
  const store = Store.openReadOnly(file);
  const rows = store.raw("SELECT id, type, status FROM items ORDER BY id");
  assert.deepEqual(rows, [{ id: 'CONST-a', type: 'constraint', status: 'active' }]);
  store.close();
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('a read-only connection cannot write, whatever the SQL says', () => {
  const file = dbFile();
  seed(file);
  const store = Store.openReadOnly(file);
  assert.throws(() => store.raw("DELETE FROM items"), /readonly|read-only/i);
  store.close();

  const check = Store.open(file);
  assert.equal(check.all().length, 1);
  check.close();
  rmSync(path.dirname(file), { recursive: true, force: true });
});

test('openReadOnly does not create a missing database', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ro2-'));
  assert.throws(() => Store.openReadOnly(path.join(dir, 'absent.db')));
  rmSync(dir, { recursive: true, force: true });
});

test('a raw aggregate query works', () => {
  const file = dbFile();
  seed(file);
  const store = Store.openReadOnly(file);
  assert.deepEqual(store.raw('SELECT type, COUNT(*) AS n FROM items GROUP BY type'),
    [{ type: 'constraint', n: 1 }]);
  store.close();
  rmSync(path.dirname(file), { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/core/store-readonly.test.ts`
Expected: FAIL — `store.openReadOnly is not a function`

- [ ] **Step 3: Extend the store**

Add to `src/core/store.ts`, inside the `Store` class alongside `open`:

```typescript
  /**
   * A connection that SQLite itself refuses to write through. Used only by the
   * `query` passthrough, as a second line of defence behind `assertSelectOnly`.
   * Deliberately runs no DDL — creating the schema would be a write.
   */
  static openReadOnly(dbPath: string): Store {
    return new Store(new DatabaseSync(dbPath, { readOnly: true }));
  }

  /** Arbitrary SELECT. Callers are responsible for validating the SQL. */
  raw(sql: string): Record<string, unknown>[] {
    const rows = this.#db.prepare(sql).all() as Record<string, unknown>[];
    // node:sqlite yields null-prototype objects; spread them so callers can
    // treat rows as ordinary objects (JSON.stringify, deepEqual, Object.keys).
    return rows.map((row) => ({ ...row }));
  }
```

- [ ] **Step 4: Write the failing CLI test**

`test/cli/query.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { assertSelectOnly } from '../../src/cli/commands/query.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-query-'));
  runCli(['init'], cwd, () => {});
  runCli(['add', 'constraint', 'Pool capped at 20'], cwd, () => {});
  runCli(['add', 'lesson', 'Migrations need locks'], cwd, () => {});
  return cwd;
}

test('assertSelectOnly accepts SELECT and WITH', () => {
  assertSelectOnly('SELECT * FROM items');
  assertSelectOnly('  select id from items  ');
  assertSelectOnly('WITH t AS (SELECT id FROM items) SELECT * FROM t');
  assertSelectOnly('SELECT * FROM items; ');
});

test('assertSelectOnly rejects every mutating statement', () => {
  for (const sql of [
    'DELETE FROM items',
    'UPDATE items SET status = "active"',
    'INSERT INTO items VALUES (1)',
    'DROP TABLE items',
    'CREATE TABLE x (a)',
    'ALTER TABLE items ADD COLUMN x',
    'VACUUM',
    'PRAGMA journal_mode = DELETE',
    'ATTACH DATABASE "other.db" AS other',
    'BEGIN; DELETE FROM items; COMMIT',
  ]) {
    assert.throws(() => assertSelectOnly(sql), /read-only|only SELECT/i, sql);
  }
});

test('assertSelectOnly rejects a second statement smuggled after a SELECT', () => {
  assert.throws(() => assertSelectOnly('SELECT 1; DELETE FROM items'), /one statement/i);
});

test('assertSelectOnly is not fooled by a comment or a string literal', () => {
  assert.throws(() => assertSelectOnly('-- harmless\nDELETE FROM items'), /only SELECT/i);
  assert.throws(() => assertSelectOnly('/* SELECT */ DROP TABLE items'), /only SELECT/i);
  assertSelectOnly("SELECT * FROM items WHERE title = 'DELETE FROM items'");
  assertSelectOnly("SELECT * FROM items WHERE title = 'a -- b'");
});

test('assertSelectOnly rejects empty and whitespace-only SQL', () => {
  assert.throws(() => assertSelectOnly('   '), /empty/i);
});

test('query prints an aligned table', () => {
  const cwd = project();
  const { code, out } = run(['query', 'SELECT id, type FROM items ORDER BY id'], cwd);
  assert.equal(code, 0);
  assert.match(out, /^id\s+type$/m);
  assert.match(out, /CONST-pool-capped-at-20\s+constraint/);
  assert.match(out, /2 row/);
  rmSync(cwd, { recursive: true, force: true });
});

test('query --json emits parseable JSON', () => {
  const cwd = project();
  const { out } = run(['query', 'SELECT type, COUNT(*) AS n FROM items GROUP BY type', '--json'], cwd);
  const parsed = JSON.parse(out) as { type: string; n: number }[];
  assert.deepEqual(parsed.sort((a, b) => a.type.localeCompare(b.type)),
    [{ type: 'constraint', n: 1 }, { type: 'lesson', n: 1 }]);
  rmSync(cwd, { recursive: true, force: true });
});

test('query refuses to mutate and names the rule', () => {
  const cwd = project();
  const { code, out } = run(['query', 'DELETE FROM items'], cwd);
  assert.equal(code, 1);
  assert.match(out, /only SELECT/i);
  assert.equal(run(['list'], cwd).out.trim().split('\n').length, 2, 'nothing was deleted');
  rmSync(cwd, { recursive: true, force: true });
});

test('a SQL error is reported without a stack trace', () => {
  const cwd = project();
  const { code, out } = run(['query', 'SELECT nope FROM items'], cwd);
  assert.equal(code, 1);
  assert.match(out, /nope/);
  assert.equal(/at Object\./.test(out), false);
  rmSync(cwd, { recursive: true, force: true });
});

test('a query returning nothing says so', () => {
  const cwd = project();
  const { code, out } = run(['query', "SELECT * FROM items WHERE type = 'adr'"], cwd);
  assert.equal(code, 0);
  assert.match(out, /0 row/);
  rmSync(cwd, { recursive: true, force: true });
});

test('query with no SQL prints usage including the schema hint', () => {
  const cwd = project();
  const { code, out } = run(['query'], cwd);
  assert.equal(code, 1);
  assert.match(out, /usage: mycontext query/);
  assert.match(out, /items\(id, type, title, status, always, layer, file_path, updated_at, data\)/);
  rmSync(cwd, { recursive: true, force: true });
});
```

- [ ] **Step 5: Implement the query command**

`src/cli/commands/query.ts`:

```typescript
import { existsSync } from 'node:fs';
import { rebuild } from '../../core/rebuild.ts';
import { Store } from '../../core/store.ts';
import type { Workspace } from '../../core/workspace.ts';
import { hasFlag, positionals, registerCommand, type Emit } from './registry.ts';

const USAGE = `usage: mycontext query "SELECT ..." [--json]

Read-only. Only SELECT (or WITH ... SELECT) is accepted, and only one statement.

schema: items(id, type, title, status, always, layer, file_path, updated_at, data)
        data holds the full item as JSON — reach into it with json_extract(data, '$.scope').`;

const FORBIDDEN = [
  'INSERT', 'UPDATE', 'DELETE', 'REPLACE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE',
  'VACUUM', 'PRAGMA', 'ATTACH', 'DETACH', 'REINDEX', 'ANALYZE',
  'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'RELEASE',
];

/** Remove comments and string/identifier literals so keywords cannot hide inside them. */
function strip(sql: string): string {
  return sql
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
}

export function assertSelectOnly(sql: string): void {
  const bare = strip(sql).trim().replace(/;\s*$/, '');

  if (bare === '') {
    throw new Error('my_context: the query is empty. Pass a SELECT statement.');
  }
  if (bare.includes(';')) {
    throw new Error('my_context: pass exactly one statement. `;` may only appear at the very end.');
  }
  if (!/^\s*(select|with)\b/i.test(bare)) {
    throw new Error(
      `my_context: query is read-only — only SELECT (or WITH … SELECT) is accepted. ` +
      `Yours starts with "${bare.split(/\s+/)[0]}". Use the CLI commands to change items.`,
    );
  }

  const upper = bare.toUpperCase();
  for (const keyword of FORBIDDEN) {
    if (new RegExp(`\\b${keyword}\\b`).test(upper)) {
      throw new Error(
        `my_context: query is read-only — "${keyword}" is not allowed. ` +
        `Use the CLI commands to change items; the index is rebuilt from Markdown anyway.`,
      );
    }
  }
}

function renderTable(rows: Record<string, unknown>[]): string[] {
  if (rows.length === 0) return [];

  const columns = Object.keys(rows[0]);
  const cells = rows.map((row) => columns.map((c) => (row[c] === null ? 'NULL' : String(row[c]))));
  const widths = columns.map((c, i) =>
    Math.max(c.length, ...cells.map((row) => row[i].length)));

  const pad = (values: string[]): string =>
    values.map((v, i) => v.padEnd(widths[i])).join('  ').trimEnd();

  return [pad(columns), pad(widths.map((w) => '-'.repeat(w))), ...cells.map(pad)];
}

function cmdQuery(ws: Workspace, args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  const sql = positionals(args, []).join(' ');
  if (!sql.trim()) { out(USAGE); return 1; }

  try {
    assertSelectOnly(sql);
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  }

  // Bring the index up to date through a normal writable connection first, so a
  // read-only query never returns stale answers.
  const writer = Store.open(ws.dbPath);
  rebuild(writer, {
    project: ws.projectRoot,
    global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined,
  });
  writer.close();

  let store: Store | null = null;
  try {
    store = Store.openReadOnly(ws.dbPath);
    const rows = store.raw(sql);

    if (hasFlag(args, 'json')) {
      out(JSON.stringify(rows, null, 2));
      return 0;
    }

    for (const line of renderTable(rows)) out(line);
    if (rows.length) out('');
    out(`${rows.length} row(s)`);
    return 0;
  } catch (err) {
    out(`my_context: query failed — ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  } finally {
    try { store?.close(); } catch { /* already closed */ }
  }
}

registerCommand({
  name: 'query',
  usage: 'query "SELECT ..." [--json]',
  summary: 'read-only SQL over the index',
  run: cmdQuery,
});
```

Add to `src/cli/commands/index.ts`:

```typescript
import './query.ts';
```

- [ ] **Step 6: Run tests and typecheck**

Run: `node --test test/core/store-readonly.test.ts test/cli/query.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/core/store.ts src/cli/commands/query.ts src/cli/commands/index.ts test/core/store-readonly.test.ts test/cli/query.test.ts
git commit -m "feat: add a read-only SQL passthrough guarded twice over"
```

---

## Task 15: The expanded `status` report

**Files:**
- Create: `src/cli/commands/status.ts`
- Modify: `src/cli/index.ts` — remove `cmdStatus` and its `case 'status'` arm, and drop the hard-coded `status` line from `usage()`
- Modify: `src/cli/commands/index.ts` (add `import './status.ts';`)
- Test: `test/cli/status.test.ts`

**Interfaces:**
- Consumes: `openMutateContext`; `summarize`, and `runChecks` from `src/doctor/checks.ts`; `computeDecay` from `src/core/decay.ts`; `Ledger`; `listSessions`, `pendingAnchors` from `src/ingest/session.ts`; `listStaging` from `src/lesson/derive.ts`
- Produces: the registered `status` command, replacing Plan 1's

Plan 1's `status` counted items by category and by status. It keeps doing exactly that — **the existing assertions in `test/cli/cli.test.ts` must still pass unchanged** — and gains the five sections that only exist now: the review queue, ingest progress, pending rule approvals, a doctor summary line, and a decay count.

Ledger access is wrapped in `try`/`catch`: `status` is a report, and a ledger that Plan 2 has not yet populated must degrade to "no sessions recorded", never to a crash.

- [ ] **Step 1: Write the failing test**

`test/cli/status.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-status-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function draft(cwd: string, id: string, type: string): void {
  const file = path.join(cwd, '.my_context', 'items', type, `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---\nid: ${id}\ntype: ${type}\ntitle: ${id}\nstatus: draft\norigin: ingest\n---\n\n# ${id}\n\nBody.\n`, 'utf8');
}

test('the counts from Plan 1 are unchanged', () => {
  const cwd = project();
  run(['add', 'constraint', 'Pool cap'], cwd);
  run(['add', 'lesson', 'Migrations need locks'], cwd);
  const { code, out } = run(['status'], cwd);
  assert.equal(code, 0);
  assert.match(out, /constraint\s+1/);
  assert.match(out, /lesson\s+1/);
  assert.match(out, /active\s+2/);
  rmSync(cwd, { recursive: true, force: true });
});

test('the review queue is surfaced with the command that walks it', () => {
  const cwd = project();
  draft(cwd, 'REQ-a', 'requirement');
  draft(cwd, 'REQ-b', 'requirement');
  const { out } = run(['status'], cwd);
  assert.match(out, /2 draft\(s\) pending review/);
  assert.match(out, /mycontext review/);
  rmSync(cwd, { recursive: true, force: true });
});

test('a clean corpus says the queue is empty rather than omitting the section', () => {
  const cwd = project();
  run(['add', 'constraint', 'Pool cap'], cwd);
  assert.match(run(['status'], cwd).out, /0 draft\(s\) pending review/);
  rmSync(cwd, { recursive: true, force: true });
});

test('unfinished ingest sessions are listed with their progress', () => {
  const cwd = project();
  mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  writeFileSync(path.join(cwd, 'docs', 'prd.md'), '# A\n\nOne.\n\n# B\n\nTwo.\n', 'utf8');
  run(['ingest', 'docs/prd.md'], cwd);
  const { out } = run(['status'], cwd);
  assert.match(out, /ingest/);
  assert.match(out, /docs\/prd\.md\s+0\/2/);
  rmSync(cwd, { recursive: true, force: true });
});

test('pending rule approvals are surfaced', () => {
  const cwd = project();
  const lesson = run(['lesson', 'Migrations deadlock during peak traffic'], cwd);
  const id = /LESSON-[a-z0-9-]+/.exec(lesson.out)![0];
  writeFileSync(path.join(cwd, 'r.json'),
    JSON.stringify([{ title: 'Run migrations off-peak', directive: 'do', body: 'b' }]), 'utf8');
  run(['lesson-stage', id, '--file', 'r.json'], cwd);

  const { out } = run(['status'], cwd);
  assert.match(out, /1 rule candidate\(s\) awaiting approval/);
  assert.match(out, /lesson-accept/);
  rmSync(cwd, { recursive: true, force: true });
});

test('the doctor summary appears as a single line', () => {
  const cwd = project();
  const file = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-a.md');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---\nid: CONST-a\ntype: constraint\ntitle: A\nstatus: active\nscope:\n  - "src/gone/**"\n---\n\n# A\n\nBody.\n`, 'utf8');

  const { out } = run(['status'], cwd);
  assert.match(out, /health:.*0 error\(s\).*warning\(s\)/);
  assert.match(out, /mycontext doctor/);
  rmSync(cwd, { recursive: true, force: true });
});

test('status reports origin so agent-authored volume is visible', () => {
  const cwd = project();
  run(['add', 'constraint', 'Pool cap'], cwd);
  draft(cwd, 'REQ-a', 'requirement');
  const { out } = run(['status'], cwd);
  assert.match(out, /by origin/);
  assert.match(out, /human\s+1/);
  assert.match(out, /ingest\s+1/);
  rmSync(cwd, { recursive: true, force: true });
});

test('status degrades gracefully when the ledger holds nothing', () => {
  const cwd = project();
  run(['add', 'constraint', 'Pool cap'], cwd);
  const { code, out } = run(['status'], cwd);
  assert.equal(code, 0);
  assert.match(out, /no sessions recorded|0 session/);
  rmSync(cwd, { recursive: true, force: true });
});

test('status outside a workspace still explains how to create one', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-nostatus-'));
  const { code, out } = run(['status'], cwd);
  assert.equal(code, 1);
  assert.match(out, /mycontext init/);
  rmSync(cwd, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cli/status.test.ts`
Expected: FAIL — the draft, ingest, staging, health and origin sections are absent

- [ ] **Step 3: Move `status` out of `src/cli/index.ts`**

Delete the whole `cmdStatus` function from `src/cli/index.ts`, delete the arm

```typescript
    case 'status':  return cmdStatus(ws, out);
```

and remove this line from the fixed block inside `usage()`:

```
  status                      report counts, budgets and health
```

The registry now supplies it. Leave the rest of `usage()` untouched.

- [ ] **Step 4: Implement**

`src/cli/commands/status.ts`:

```typescript
import path from 'node:path';
import { computeDecay } from '../../core/decay.ts';
import { Ledger, type Usage } from '../../core/ledger.ts';
import type { Item } from '../../core/types.ts';
import type { Workspace } from '../../core/workspace.ts';
import { runChecks } from '../../doctor/checks.ts';
import { listSessions, pendingAnchors } from '../../ingest/session.ts';
import { listStaging } from '../../lesson/derive.ts';
import { summarize } from './doctor.ts';
import { openMutateContext } from './context.ts';
import { registerCommand, type Emit } from './registry.ts';

const DECAY_WINDOW = 20;

function tally(items: Item[], key: (i: Item) => string): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return [...counts].sort((a, b) => a[0].localeCompare(b[0]));
}

interface LedgerView {
  usage: Usage[];
  recentlyUsed: string[];
  sessionsRecorded: number;
}

/** A report must never crash on a ledger Plan 2 has not populated yet. */
function readLedger(dbPath: string): LedgerView {
  let ledger: Ledger | null = null;
  try {
    ledger = Ledger.open(dbPath);
    const recent = ledger.recentSessions(DECAY_WINDOW);
    return {
      usage: ledger.allUsage(),
      recentlyUsed: ledger.itemsUsedIn(recent),
      sessionsRecorded: ledger.sessionCount(),
    };
  } catch {
    return { usage: [], recentlyUsed: [], sessionsRecorded: 0 };
  } finally {
    try { ledger?.close(); } catch { /* nothing to close */ }
  }
}

function cmdStatus(ws: Workspace, _args: string[], out: Emit): number {
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  const ctx = openMutateContext(ws);
  try {
    const items = ctx.store.all();

    out(`my_context: ${items.length} item(s), profile "${ws.config.profile}"`);
    out('');
    out('by category');
    for (const [type, n] of tally(items, (i) => i.type)) out(`  ${type.padEnd(16)}${n}`);
    out('');
    out('by status');
    for (const [status, n] of tally(items, (i) => i.status)) out(`  ${status.padEnd(16)}${n}`);
    out('');
    out('by origin');
    for (const [origin, n] of tally(items, (i) => i.origin)) out(`  ${origin.padEnd(16)}${n}`);

    const drafts = items.filter((i) => i.status === 'draft');
    out('');
    out(`review queue: ${drafts.length} draft(s) pending review — walk it with \`mycontext review\`.`);

    const sessions = listSessions(ws.projectRoot).filter((s) => pendingAnchors(s).length > 0);
    if (sessions.length) {
      out('');
      out(`ingest: ${sessions.length} unfinished session(s) — continue with \`mycontext ingest <path>\`.`);
      for (const session of sessions) {
        const done = session.chunks.length - pendingAnchors(session).length;
        out(`  ${session.sourceFile.padEnd(40)}${done}/${session.chunks.length}   ${session.id}`);
      }
    }

    const pendingRules = listStaging(ws.projectRoot)
      .flatMap((s) => s.candidates.filter((c) => c.state === 'pending').map((c) => ({ lesson: s.lessonId, candidate: c })));
    if (pendingRules.length) {
      out('');
      out(
        `${pendingRules.length} rule candidate(s) awaiting approval. ` +
        `Nothing generated is active until you accept it — \`mycontext lesson-accept <lesson> <key>\`.`,
      );
      for (const entry of pendingRules) {
        out(`  ${entry.candidate.key}  ${entry.lesson.padEnd(44)}${entry.candidate.candidate.title}`);
      }
    }

    const ledger = readLedger(ws.dbPath);
    const decay = computeDecay({
      items, config: ws.config,
      usage: ledger.usage,
      recentlyUsed: ledger.recentlyUsed,
      window: DECAY_WINDOW,
      sessionsRecorded: ledger.sessionsRecorded,
    });

    out('');
    out(
      ledger.sessionsRecorded === 0
        ? 'usage: no sessions recorded yet — decay reporting starts once items begin to be injected.'
        : `usage: ${ledger.sessionsRecorded} session(s) recorded. ` +
          `${decay.cold.length} item(s) not injected in the last ${DECAY_WINDOW} — see \`mycontext decay\`.`,
    );
    if (decay.unscoped.length) {
      out(`  ${decay.unscoped.length} active normative item(s) carry no scope and are never auto-injected.`);
    }

    const findings = runChecks({
      root: ws.projectRoot,
      repoRoot: path.dirname(ws.projectRoot),
      dbPath: ws.dbPath,
      items,
    });
    const counts = summarize(findings);
    out('');
    out(
      `health: ${counts.errors} error(s), ${counts.warnings} warning(s), ${counts.infos} note(s) — ` +
      `details from \`mycontext doctor\`.`,
    );

    return 0;
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  } finally {
    ctx.store.close();
  }
}

registerCommand({
  name: 'status',
  usage: 'status',
  summary: 'counts, review queue, ingest progress, decay and health',
  run: cmdStatus,
});
```

Add to `src/cli/commands/index.ts`:

```typescript
import './status.ts';
```

- [ ] **Step 5: Run the status tests and Plan 1's CLI tests together**

Run: `node --test test/cli/status.test.ts test/cli/cli.test.ts && npx tsc --noEmit`
Expected: PASS — Plan 1's `status reports counts by category and status` must still pass unmodified.

- [ ] **Step 6: Commit**

```bash
git add src/cli/commands/status.ts src/cli/commands/index.ts src/cli/index.ts test/cli/status.test.ts
git commit -m "feat: expand status with review queue, ingest, approvals, decay and health"
```

---

## Verification

After Task 15, confirm the plan's goal end to end.

- [ ] **Step 1: Full suite and typecheck on this platform**

```bash
npm test
npm run typecheck
```

Expected: every suite passes, no type errors. Confirm the reported test-file count matches the number of files under `test/` — a lower count means the `test/**/*.test.ts` glob was expanded by the shell rather than by Node.

- [ ] **Step 2: Walk a real ingest by hand**

```bash
node src/cli/index.ts init
node src/cli/index.ts ingest docs/superpowers/specs/2026-08-12-my-context-design.md
```

Read the printed extraction request as a user would. Confirm it is genuinely self-contained: the chunk, the schema, the enabled categories, and the exact callback command. Then act as the extractor, write an array of candidates to `/tmp/c.json`, and:

```bash
node src/cli/index.ts ingest-apply <session-id> --anchor <anchor> --file /tmp/c.json
node src/cli/index.ts review
node src/cli/index.ts review promote <id> --scope "src/core/**"
```

Confirm the item was `draft` before the promote and `active` after, and that its Markdown file carries `origin: ingest`, `source_file`, `source_anchor` and `source_checksum`.

- [ ] **Step 3: Prove the approval gate by hand**

```bash
node src/cli/index.ts lesson "Hooks that throw break the session, so they must fail open"
node src/cli/index.ts lesson-stage LESSON-... --file /tmp/rules.json
node src/cli/index.ts list rule
```

Expected: `list rule` prints **nothing**. Then accept one candidate and confirm exactly one rule appears, `active`, carrying `derived_from [[LESSON-…]]`.

- [ ] **Step 4: Dogfood the health commands**

```bash
node src/cli/index.ts doctor
node src/cli/index.ts decay
node src/cli/index.ts status
node src/cli/index.ts query "SELECT type, COUNT(*) AS n FROM items GROUP BY type"
node src/cli/index.ts query "DELETE FROM items"    # must refuse, exit 1
```

- [ ] **Step 5: Confirm the MCP tool is registered**

Start the Plan 3 MCP server and list tools; `ingest_document` must appear with its two-phase description. Call it with `{"path": "<a doc>"}` and confirm the extraction request comes back as tool output.

- [ ] **Step 6: Confirm CI is green on both platforms**

Push and confirm the `windows-latest` and `ubuntu-latest` jobs both pass. The anchor slugs, checksums and POSIX `source_file` values must be identical on both — a divergence there means an item ingested on one platform will not drift-check on the other.

---

## Spec coverage across all four plans

Every section of `docs/superpowers/specs/2026-08-12-my-context-design.md`, and where it lands.

| Spec section | Covered by | Notes |
|---|---|---|
| §1 Purpose, §1.1 Non-goals | Plans 1–4 | Nothing here duplicates claude-mem: no activity capture, no session history |
| §2 Prior art | — | Analysis, no implementation |
| §3.1 Twenty categories | Plan 1 Task 2 | Full |
| §3.2 File format, slugs, inert scope | Plan 1 Tasks 4–6 | Full |
| §3.3 Category-specific fields | Plan 1 Task 2 (declaration), Plan 4 Tasks 2 & 8 (`extra` populated by ingest; `directive` by lesson→rule) | Full |
| §4 Configuration, profiles, custom categories | Plan 1 Task 3 | Full |
| §5.1 Layout, layer merge | Plan 1 Tasks 8, 10 | Full |
| §5.2 Modules | Plans 1–4 | `ingest/*` is Plan 4 |
| §5.3 Runtime, zero dependencies | Plan 1 Task 1 | Upheld by Plan 4: extraction runs in the host agent precisely so no client is needed |
| §5.4 Platform support | Plan 1 Task 1 | Plan 4 keeps it: anchors, checksums and `source_file` are POSIX and EOL-normalized |
| §6.1 Tiers — pinned, index | Plan 1 Tasks 9–11 | Full |
| §6.1 Tiers — JIT, restored | Plan 2 | — |
| §6.2 Hook wiring | Plan 1 Task 13 (`SessionStart`), Plan 2 (`PreToolUse`, `PreCompact`, write-deny), Plan 3 (`PostToolUse` nudge, `/LoadMyContext`) | — |
| §6.3 Bounded index | Plan 1 Tasks 9–11 | Full |
| §6.4 Budgets and spill | Plan 1 Task 9 | Full |
| §6.5 Failure posture | Plan 1 Task 13, Plan 2 | Plan 4 has no hooks; its commands are user-invoked and report errors loudly by design |
| §6.6 Ledger | Plan 2 (table and class) | **Plan 4 consumes it** for decay (Task 13) and the `status` usage line (Task 15) |
| §7.1 Trust model | Plan 3 (`core/mutate.ts`) | Plan 4 respects it: CLI uses `caller: 'user'`, the MCP tool `caller: 'agent'`, and ingest forces `draft` regardless |
| §7.2 Batch ingestion | **Plan 4 Tasks 1–7** | Chunking, extraction request, staging, dedupe by content hash, `supersedes` on material change, provenance |
| §7.3 Live capture — nudge hook, tool idempotency, drift flag | Plan 3 (nudge, `create_item` idempotency); **Plan 4 Task 11** (`source_drift` detection in `doctor`) | Full |
| §7.4 Lessons → rules, approval gate | **Plan 4 Tasks 8–9** | Gate enforced structurally and asserted directly |
| §8 Tool surface — `create_item`, `update_item`, `supersede_item`, `link_items`, `get_item`, `query_items`, `list_drafts`, `mycontext_help`, `mycontext_examples` | Plan 3 | — |
| §8 Tool surface — `ingest_document` | **Plan 4 Task 7** | Full |
| §8 No agent `delete_item` | Plan 3; **Plan 4 Task 10** upholds it — `review discard` deprecates, never deletes | Full |
| §9 Help and discoverability | Plan 3 | Plan 4's error messages follow the §9 pattern (name the bad value, name the closest legal one) |
| §10 `rebuild` lossless, atomic writes | Plan 1 Task 8 | Plan 4 writes every JSON artefact temp-file-then-rename |
| §10 `supersede` never drops content | Plan 3 (`supersedeItem`); **Plan 4 Task 4** exercises it on an ingest chain | Full |
| §10 Partial ingest keeps successes, names failures | **Plan 4 Tasks 2, 4, 6** | Asserted directly |
| §10 Checksum mismatch never auto-resolves | **Plan 4 Task 11** | `source_drift` reports and waits |
| §10 Concurrency, `busy_timeout` | Plan 1 Task 7 (pragma), Plan 3 (concurrent-writer tests) | — |
| §10 Schema versioning | Plan 1 Task 7 | — |
| §10 `doctor` — all five checks | **Plan 4 Tasks 11–12** | Full |
| §11 `core/select` coverage | Plan 1 Tasks 9–10, Plan 2 | — |
| §11 Ingestion tested for staging/dedupe/drift, **not** extraction quality | **Plan 4** | Held to strictly: the only assertion touching extraction content is that a `quote` is verbatim, which tests grounding, not judgement |
| §11 Chaos, Windows, cross-platform, performance | Plan 1 Task 1 (CI matrix), Plan 2 (latency ceilings), Plan 3 (chaos suite) | — |
| §12 Deferred | — | Unchanged; see below |
| §13 Decision log | Plans 1–4 | Each decision is reflected in code, not restated |
| §14 Implementation approach | All plans | Subagent-driven execution |

### Still deferred after all four plans

Unchanged from spec §12, and none of it is foreclosed:

- **Enforcement** — `PreToolUse` returning `permissionDecision: 'deny'` on a `severity: hard` violation. `severity` is stored, surfaced in `doctor` and honoured in budget ordering; nothing blocks an edit.
- **A `Stop`-hook proposer** writing candidate items at session end. The staging machinery built in Task 8 is exactly what it would write into, so this is now a small addition rather than a new subsystem.
- **graphify integration** as an analysis lens over `.my_context/`.
- **Bi-temporal queries** over `valid_from` / `valid_until`. The fields round-trip; `mycontext query` (Task 14) can already express such a query in raw SQL, but there is no first-class command.
- **Automatic ingestion on watched paths.** Deliberately manual — `watchedDocs` drives only the Plan 3 nudge. The draft queue becoming a backlog nobody reads would be equivalent to not capturing at all.

Two things this plan chose not to build, recorded so they are not mistaken for oversights:

- **No `review promote --all`.** Bulk-promoting a queue defeats the gate that the queue exists to provide.
- **No LLM client, of any kind.** The two-phase request/callback protocol is the whole design, not a workaround for a missing key. It also means extraction quality improves with the host model at no cost to this codebase, and that the plugin still installs and runs with zero dependencies and no configuration.

