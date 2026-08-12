# my_context Agent Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Claude a safe way to write into my_context — a shared mutation layer that never deletes and never lets an agent author governing knowledge unreviewed, an MCP server exposing it over stdio with zero dependencies, a help system compiled from one source, and a nudge that fires when a watched document changes.

**Architecture:** All writes funnel through one module, `src/core/mutate.ts`, which owns idempotency, the trust model, atomic file writes, and index updates. Everything above it — the MCP tools, the CLI, and Plan 4's ingestion — is a thin caller. The MCP server speaks JSON-RPC 2.0 over newline-delimited stdio by hand, because the zero-dependency constraint forbids the official SDK. Help topics are Markdown files that are the single source for tool descriptions, `mycontext_help`, and `mycontext help` alike.

**Tech Stack:** Node 24, TypeScript (no build step — Node 24 strips types natively), `node:sqlite`, `node:test`, `node:crypto`, `node:stream`. Zero runtime dependencies; `typescript` is a devDependency used only for `tsc --noEmit`.

**Spec:** `docs/superpowers/specs/2026-08-12-my-context-design.md`
**Depends on:** `docs/superpowers/plans/2026-08-12-my-context-foundation.md` (Plan 1) — completed. Every module it produced is consumed here unchanged.

## Global Constraints

- **Zero runtime dependencies.** devDependencies are limited to `typescript` and `@types/node`. The MCP server does **not** use `@modelcontextprotocol/sdk`; the wire protocol is written by hand.
- **Node >= 24.0.0.** Required for stable `node:sqlite` and native type stripping.
- **No build step.** Source is `.ts`, executed directly by Node. All relative imports carry an explicit `.ts` extension. Only erasable TypeScript syntax — no `enum`, no `namespace`, no parameter properties.
- **`node:sqlite` cannot bind booleans.** `.run(true)` throws; convert to `1 | 0`. `.get()` returns `undefined`, never `null`, for a missing row.
- **All stored paths are POSIX-normalized and layer-root-relative** (spec §5.4). No backslash ever reaches the database or a glob comparison.
- **Rendered Markdown uses `\n` line endings** regardless of platform.
- **Hooks fail open:** exit 0, empty stdout, on any error.
- **The MCP server's stdout carries MCP messages and nothing else.** No `console.log`, anywhere in any module the server imports. Diagnostics go to stderr.
- **MCP tool descriptions are loaded in every session.** Keep each under 200 characters; the test in Task 7 enforces it.
- **No `delete_item` tool, ever** (spec §8). Agents supersede or deprecate; both are reversible and both leave a trail.
- **Atomic writes throughout:** temp file + rename for Markdown, transaction + `busy_timeout` + retry for the index.
- **CI runs on `windows-latest` and `ubuntu-latest`.**
- **TDD:** every task writes a failing test first, watches it fail, then implements.
- **Commit at the end of every task.**

---

## File Structure

| File | Responsibility |
|---|---|
| `src/core/teach.ts` | Closest-match suggestion and the teaching error messages built on it |
| `src/core/mutate.ts` | **The shared mutation layer.** create / update / supersede / link, idempotency, the trust model, atomic write + index update, busy retry |
| `src/help/topics/categories.md` | Help topic source — the category table is generated into it |
| `src/help/topics/scope.md` | Help topic source — worked glob examples, not prose |
| `src/help/topics/capture.md` | Help topic source — **and the single source of every tool description** |
| `src/help/topics/workflow.md` | Help topic source — lifecycle, relations, review queue |
| `src/help/index.ts` | Topic loading, `{{CATEGORY_TABLE}}` expansion from config, tool-description extraction, worked examples |
| `src/mcp/protocol.ts` | JSON-RPC 2.0 framing over stdio, MCP method dispatch, version negotiation |
| `src/mcp/tools.ts` | The tool registry: schemas plus handlers over `mutate` / `store` / `help` |
| `src/mcp/server.ts` | Entry point: resolve the workspace, wire stdin/stdout |
| `src/hooks/post-tool-use.ts` | The live-capture nudge |
| `test/helpers/workspace.ts` | Sandbox fixture shared by the mutation, help and tool tests |
| `test/fixtures/concurrent-writer.ts` | Child process used by the concurrency test |
| `src/cli/index.ts` | **Modified:** adds `help [topic]` and `examples <type>` |
| `src/core/rebuild.ts` | **Modified:** temp filename made unique per write, not per process |
| `hooks/hooks.json` | **Modified:** registers `PostToolUse` |
| `.mcp.json` | **New:** registers the MCP server with the plugin |

**Why one mutation module rather than mutation logic in each tool:** the trust rule in spec §7.1 is a security boundary. A second write path that forgets to force `draft` silently defeats it, and the failure is invisible — an agent-authored constraint would simply start governing every future session. Plan 4's ingestion calls the same four functions, so the rule holds there by construction rather than by discipline.

---

## Verified MCP wire-format facts

Every message shape below was checked against the published specification before any code in this plan was written. They are recorded here because a hand-written protocol implementation has no SDK to correct it.

**Three revisions are live**, and Claude Code may present any of them:

| Revision | Era | Handshake |
|---|---|---|
| `2025-06-18` | legacy | `initialize` → `InitializeResult` → `notifications/initialized` |
| `2025-11-25` | legacy | same |
| `2026-07-28` | modern | **none** — every request carries `_meta["io.modelcontextprotocol/protocolVersion"]` |

Source: [Versioning and Compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning), [2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog).

**The server therefore implements both eras** — the spec's "dual-era server", which selects behaviour from how the client opens: a request carrying modern `_meta` is served statelessly; an `initialize` request selects legacy semantics. This is not gold-plating. A modern-only server fails a legacy client with no fall-forward path, and a legacy-only server fails a modern client; both failure modes are silent from the user's side ("the tools just aren't there").

**stdio framing** ([Transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)):
- Messages are UTF-8 JSON-RPC, **delimited by newlines**, and **MUST NOT contain embedded newlines**. `JSON.stringify` escapes `\n` inside strings, so a single `stringify` + `'\n'` satisfies this by construction.
- The server **MUST NOT** write anything to stdout that is not a valid MCP message. It **MAY** write UTF-8 logging to stderr.
- Node 24's type stripping writes nothing to stdout or stderr (measured in Plan 1), so running the server as `node src/mcp/server.ts` is safe.

**Legacy `initialize`** ([Lifecycle](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle)): request params are `{ protocolVersion, capabilities, clientInfo }`; the result is `{ protocolVersion, capabilities, serverInfo, instructions? }`. If the server supports the requested version it **MUST** echo that same version; otherwise it responds with the latest version it does support. The client then sends `notifications/initialized`, which takes **no response** — it has no `id`.

**`tools/list`** ([Tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)): result is `{ tools: [{ name, description, inputSchema }], nextCursor? }`. `nextCursor` is omitted when there is no next page. Tool order **SHOULD** be deterministic (2026-07-28 minor change 3) so client-side caching and prompt caching work.

**`tools/call`**: params `{ name, arguments }`; result `{ content: [{ type: "text", text }], isError }`. Two distinct error channels, and the difference matters for this plan: an **unknown tool** is a *protocol* error (`-32602`), while a **tool that ran and rejected its input** returns a normal result with `isError: true`. Teaching messages must travel by the second channel — a protocol error is machinery the model does not see as content.

**`server/discover`** ([Discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)), which modern servers **MUST** implement, returns `{ resultType, supportedVersions, capabilities, _meta["io.modelcontextprotocol/serverInfo"], instructions?, ttlMs, cacheScope }`.

**2026-07-28 result decoration:** every result carries a required `resultType` (`"complete"` for ordinary results), and list-shaped results additionally require `ttlMs` and `cacheScope`. Clients on earlier revisions must treat a missing `resultType` as `"complete"`, so the fields are emitted only when the negotiated version is `2026-07-28` or later. Version comparison is plain lexicographic string comparison — `YYYY-MM-DD` sorts correctly as text.

**Error codes:** `-32700` parse, `-32600` invalid request, `-32601` method not found, `-32602` invalid params (also used for unknown tool), `-32603` internal. `-32022` is `UnsupportedProtocolVersion`, renumbered from `-32004` in 2026-07-28, and its `data` is `{ supported, requested }`.

**Removed in 2026-07-28, kept anyway:** `ping` and `notifications/initialized`. Both are cheap — one returns `{}`, the other returns nothing — and dropping them would break the legacy clients this server exists to serve.

---

## Task 1: Teaching errors

**Files:**
- Create: `src/core/teach.ts`
- Test: `test/core/teach.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `HelpTopic = 'categories' | 'scope' | 'capture' | 'workflow'`
  - `levenshtein(a: string, b: string): number`
  - `closestMatch(value: string, candidates: string[], maxDistance?: number): string | null`
  - `enumError(field: string, value: string, allowed: string[], topic: HelpTopic): string`
  - `missingFieldError(field: string, tool: string, topic: HelpTopic): string`
  - `unknownIdError(id: string, knownIds: string[]): string`

Spec §9 calls error messages "the highest-leverage channel": they arrive at the exact moment the model is wrong and convert a failed call into a corrected one. That only works if every message names the closest valid value and points at a topic, which is why this is a module with tests rather than a string literal at each call site.

- [ ] **Step 1: Write the failing test**

`test/core/teach.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  levenshtein, closestMatch, enumError, missingFieldError, unknownIdError,
} from '../../src/core/teach.ts';

const CATEGORIES = ['constraint', 'invariant', 'rule', 'requirement', 'lesson', 'adr'];

test('levenshtein counts single edits', () => {
  assert.equal(levenshtein('rule', 'rule'), 0);
  assert.equal(levenshtein('rule', 'rules'), 1);
  assert.equal(levenshtein('rule', 'role'), 1);
  assert.equal(levenshtein('', 'abc'), 3);
});

test('closestMatch finds the intended category behind a typo', () => {
  assert.equal(closestMatch('requirment', CATEGORIES), 'requirement');
  assert.equal(closestMatch('constraints', CATEGORIES), 'constraint');
  assert.equal(closestMatch('Rule', CATEGORIES), 'rule');
});

test('closestMatch returns null rather than a nonsense suggestion', () => {
  assert.equal(closestMatch('xylophone', CATEGORIES), null);
});

test('closestMatch is deterministic on ties', () => {
  assert.equal(closestMatch('aaa', ['bbb', 'ccc']), null);
  assert.equal(closestMatch('rulf', ['rule', 'ruld']), 'ruld');
});

test('enumError names the field, the allowed set, the value and the topic', () => {
  const msg = enumError('type', 'requirment', CATEGORIES, 'categories');
  assert.match(msg, /"type"/);
  assert.match(msg, /constraint, invariant/);
  assert.match(msg, /You passed "requirment"/);
  assert.match(msg, /closest match is "requirement"/);
  assert.match(msg, /mycontext_help\("categories"\)/);
});

test('enumError omits the suggestion clause when nothing is close', () => {
  const msg = enumError('type', 'xylophone', CATEGORIES, 'categories');
  assert.equal(/closest match/.test(msg), false);
  assert.match(msg, /mycontext_help\("categories"\)/);
});

test('missingFieldError names the tool and the topic', () => {
  const msg = missingFieldError('title', 'create_item', 'capture');
  assert.match(msg, /create_item requires "title"/);
  assert.match(msg, /mycontext_help\("capture"\)/);
});

test('unknownIdError suggests the nearest id and points at query_items', () => {
  const msg = unknownIdError('CONST-pg-pool', ['CONST-pg-pool-cap', 'LESSON-a']);
  assert.match(msg, /no item with id "CONST-pg-pool"/);
  assert.match(msg, /CONST-pg-pool-cap/);
  assert.match(msg, /query_items/);
});

test('every message is prefixed so callers can recognise it as ours', () => {
  assert.match(enumError('type', 'x', CATEGORIES, 'categories'), /^my_context: /);
  assert.match(missingFieldError('title', 'create_item', 'capture'), /^my_context: /);
  assert.match(unknownIdError('x', []), /^my_context: /);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/core/teach.test.ts`
Expected: FAIL — `Cannot find module '../../src/core/teach.ts'`

- [ ] **Step 3: Implement**

`src/core/teach.ts`:

```typescript
export type HelpTopic = 'categories' | 'scope' | 'capture' | 'workflow';

/** Classic two-row Levenshtein. Small inputs only — category names and ids. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[n];
}

/**
 * The nearest candidate, or null when nothing is near enough. Returning null
 * matters: "the closest match is 'adr'" for input 'xylophone' is worse than no
 * suggestion, because the model may believe it.
 */
export function closestMatch(
  value: string, candidates: string[], maxDistance = 4,
): string | null {
  const needle = value.trim().toLowerCase();
  let best: string | null = null;
  let bestDistance = Infinity;

  for (const candidate of [...candidates].sort()) {
    const distance = levenshtein(needle, candidate.toLowerCase());
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }

  const ceiling = Math.min(maxDistance, Math.max(1, Math.floor(needle.length / 2) + 1));
  return best !== null && bestDistance <= ceiling ? best : null;
}

export function enumError(
  field: string, value: string, allowed: string[], topic: HelpTopic,
): string {
  const near = closestMatch(value, allowed);
  return (
    `my_context: "${field}" must be one of: ${allowed.join(', ')}. ` +
    `You passed "${value}".` +
    (near ? ` The closest match is "${near}".` : '') +
    ` See mycontext_help("${topic}").`
  );
}

export function missingFieldError(field: string, tool: string, topic: HelpTopic): string {
  return (
    `my_context: ${tool} requires "${field}", which was missing or empty. ` +
    `See mycontext_help("${topic}").`
  );
}

export function unknownIdError(id: string, knownIds: string[]): string {
  const near = closestMatch(id, knownIds, 6);
  return (
    `my_context: no item with id "${id}".` +
    (near ? ` The closest match is "${near}".` : '') +
    ` Use query_items to find the right id — ids are never guessed.`
  );
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/core/teach.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/teach.ts test/core/teach.test.ts
git commit -m "feat: add teaching error messages with closest-match suggestions"
```

---

## Task 2: The mutation layer — createItem

**Files:**
- Create: `src/core/mutate.ts`, `test/helpers/workspace.ts`
- Test: `test/core/mutate-create.test.ts`

**Interfaces:**
- Consumes: `Config`, `ResolvedCategory` from `config.ts`; `Store` from `store.ts`; `writeItem` from `rebuild.ts`; `computeItemChecksum` from `item.ts`; `makeId`, `checksum` from `slug.ts`; `normalizePosix` from `paths.ts`; `enumError`, `missingFieldError` from `teach.ts`; `Item`, `Observation`, `Relation`, `Origin`, `Severity`, `Status` from `types.ts`
- Produces:
  - `MutationContext { root: string; store: Store; config: Config }`
  - `CreateInput { type: string; title: string; body?: string; status?: Status; severity?: Severity; always?: boolean; scope?: string[]; tags?: string[]; origin?: Origin; sourceFile?: string | null; sourceAnchor?: string | null; observations?: Observation[]; relations?: Relation[]; extra?: Record<string, string> }`
  - `MutationResult { id: string; created: boolean; status: Status; filePath: string; message: string }`
  - `contentHash(input: CreateInput): string`, `itemContentHash(item: Item): string`
  - `withRetry<T>(fn: () => T, attempts?: number): T`
  - `createItem(ctx: MutationContext, input: CreateInput): MutationResult`
- Test helper produced: `sandbox(rawConfig?: Record<string, unknown>): Sandbox` where `Sandbox { cwd: string; root: string; ctx: MutationContext; dispose(): void }`

Errors are thrown as plain `Error` whose message is already a teaching message prefixed `my_context:`. The MCP layer surfaces `err.message` verbatim as `isError: true` content, so no error class hierarchy is needed and none is introduced.

- [ ] **Step 1: Write the shared sandbox helper**

`test/helpers/workspace.ts`:

```typescript
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { Store } from '../../src/core/store.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import type { MutationContext } from '../../src/core/mutate.ts';

export interface Sandbox {
  cwd: string;
  root: string;
  ctx: MutationContext;
  dispose(): void;
}

/**
 * A throwaway project workspace with an in-memory index. The index is
 * `:memory:` deliberately — these tests exercise mutation semantics, not
 * SQLite durability, and an in-memory database cannot leave a locked file
 * behind on Windows when a test fails.
 */
export function sandbox(rawConfig?: Record<string, unknown>): Sandbox {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-mut-'));
  runCli(['init'], cwd, () => {});

  if (rawConfig) {
    writeFileSync(
      path.join(cwd, '.my_context', 'config.json'),
      JSON.stringify(rawConfig, null, 2) + '\n',
    );
  }

  const ws = resolveWorkspace(cwd);
  const root = ws.projectRoot!;
  const store = Store.open(':memory:');

  return {
    cwd,
    root,
    ctx: { root, store, config: ws.config },
    dispose() {
      try { store.close(); } catch { /* already closed */ }
      rmSync(cwd, { recursive: true, force: true });
    },
  };
}
```

- [ ] **Step 2: Write the failing test**

`test/core/mutate-create.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createItem } from '../../src/core/mutate.ts';
import { parseItem } from '../../src/core/item.ts';
import { sandbox } from '../helpers/workspace.ts';

test('createItem writes a Markdown file and indexes it', () => {
  const s = sandbox();
  const result = createItem(s.ctx, {
    type: 'constraint',
    title: 'Postgres pool capped at 20',
    body: 'RDS permits 25 connections.',
    scope: ['src/db/**'],
  });

  assert.equal(result.created, true);
  assert.equal(result.id, 'CONST-postgres-pool-capped-at-20');
  assert.equal(result.filePath, 'items/constraint/CONST-postgres-pool-capped-at-20.md');
  assert.ok(existsSync(path.join(s.root, ...result.filePath.split('/'))));
  assert.equal(s.ctx.store.get(result.id)?.title, 'Postgres pool capped at 20');
  s.dispose();
});

test('the file on disk parses back to the indexed item', () => {
  const s = sandbox();
  const result = createItem(s.ctx, {
    type: 'constraint',
    title: 'Pool cap',
    body: 'Body.',
    scope: ['src/db/**'],
    tags: ['database'],
    observations: [{ category: 'limit', text: 'Never exceed 20', tags: ['db'], context: null }],
  });

  const text = readFileSync(path.join(s.root, ...result.filePath.split('/')), 'utf8');
  const parsed = parseItem(text, result.filePath, 'project');
  assert.deepEqual(parsed, s.ctx.store.get(result.id));
  assert.equal(text.includes('\r'), false);
  s.dispose();
});

test('identical content at the same source anchor is already captured', () => {
  const s = sandbox();
  const input = {
    type: 'requirement',
    title: 'Users can reset their password',
    body: 'Via an emailed one-time link.',
    sourceFile: 'docs/prd/auth.md',
    sourceAnchor: '## Password reset',
  };

  const first = createItem(s.ctx, input);
  const second = createItem(s.ctx, { ...input });

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.id, first.id);
  assert.match(second.message, /already captured as REQ-users-can-reset-their-password/);
  assert.equal(s.ctx.store.all().length, 1);
  s.dispose();
});

test('a differently worded item at the same anchor directs to update_item', () => {
  const s = sandbox();
  const base = {
    type: 'requirement',
    title: 'Users can reset their password',
    sourceFile: 'docs/prd/auth.md',
    sourceAnchor: '## Password reset',
  };

  const first = createItem(s.ctx, { ...base, body: 'Via an emailed link.' });
  const second = createItem(s.ctx, { ...base, body: 'Via SMS, within 10 minutes.' });

  assert.equal(second.created, false);
  assert.equal(second.id, first.id);
  assert.match(second.message, /update_item/);
  assert.equal(s.ctx.store.all().length, 1);
  s.dispose();
});

test('source paths are normalized to POSIX before they are stored', () => {
  const s = sandbox();
  const result = createItem(s.ctx, {
    type: 'requirement',
    title: 'Windows path provenance',
    sourceFile: 'docs\\prd\\auth.md',
    sourceAnchor: '## X',
  });
  assert.equal(s.ctx.store.get(result.id)?.sourceFile, 'docs/prd/auth.md');
  s.dispose();
});

test('a colliding title with different content gets a suffixed id', () => {
  const s = sandbox();
  const first = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', body: 'One.' });
  const second = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', body: 'Two.' });

  assert.equal(first.id, 'CONST-pool-cap');
  assert.equal(second.id, 'CONST-pool-cap-2');
  assert.equal(second.created, true);
  s.dispose();
});

test('a colliding title with identical content is a duplicate, not a suffix', () => {
  const s = sandbox();
  createItem(s.ctx, { type: 'constraint', title: 'Pool cap', body: 'One.' });
  const second = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', body: 'One.' });

  assert.equal(second.created, false);
  assert.equal(second.id, 'CONST-pool-cap');
  assert.equal(s.ctx.store.all().length, 1);
  s.dispose();
});

test('an unknown type is refused with the closest category named', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, { type: 'requirment', title: 'X' }),
    /closest match is "requirement".*mycontext_help\("categories"\)/s,
  );
  s.dispose();
});

test('a disabled category is refused and says where to enable it', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, { type: 'policy', title: 'X' }),
    /"policy" is disabled.*config\.json/s,
  );
  s.dispose();
});

test('an empty title is refused by name', () => {
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, { type: 'constraint', title: '   ' }),
    /create_item requires "title"/,
  );
  s.dispose();
});

test('the checksum on disk covers the content', () => {
  const s = sandbox();
  const result = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', body: 'One.' });
  assert.match(s.ctx.store.get(result.id)!.checksum, /^[0-9a-f]{16}$/);
  s.dispose();
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/core/mutate-create.test.ts`
Expected: FAIL — `Cannot find module '../../src/core/mutate.ts'`

- [ ] **Step 4: Implement**

`src/core/mutate.ts`:

```typescript
import type { Config, ResolvedCategory } from './config.ts';
import { computeItemChecksum } from './item.ts';
import { normalizePosix } from './paths.ts';
import { writeItem } from './rebuild.ts';
import { checksum, makeId } from './slug.ts';
import type { Store } from './store.ts';
import { enumError, missingFieldError } from './teach.ts';
import type { Item, Observation, Origin, Relation, Severity, Status } from './types.ts';

export interface MutationContext {
  /** Absolute path to the project layer root, i.e. `<repo>/.my_context`. */
  root: string;
  store: Store;
  config: Config;
}

export interface CreateInput {
  type: string;
  title: string;
  body?: string;
  status?: Status;
  severity?: Severity;
  always?: boolean;
  scope?: string[];
  tags?: string[];
  origin?: Origin;
  sourceFile?: string | null;
  sourceAnchor?: string | null;
  observations?: Observation[];
  relations?: Relation[];
  extra?: Record<string, string>;
}

export interface MutationResult {
  id: string;
  /** False when the call was a no-op: a duplicate, or an already-present link. */
  created: boolean;
  status: Status;
  filePath: string;
  message: string;
}

interface ContentShape {
  type: string;
  title: string;
  body: string;
  scope: string[];
  tags: string[];
  observations: Observation[];
  relations: Relation[];
  extra: Record<string, string>;
}

/**
 * Identity of an item's *content*, deliberately excluding id, status, origin and
 * provenance. Two calls that say the same thing hash the same even though one
 * would receive a suffixed id, which is what makes create_item idempotent
 * (spec §7.3: idempotency lives in the tool, not in the model's discipline).
 */
function hashContent(v: ContentShape): string {
  return checksum(JSON.stringify({
    type: v.type,
    title: v.title.trim(),
    body: v.body.trim(),
    scope: [...v.scope].sort(),
    tags: [...v.tags].sort(),
    observations: v.observations,
    relations: v.relations,
    extra: v.extra,
  }));
}

export function contentHash(input: CreateInput): string {
  return hashContent({
    type: input.type,
    title: input.title,
    body: input.body ?? '',
    scope: input.scope ?? [],
    tags: input.tags ?? [],
    observations: input.observations ?? [],
    relations: input.relations ?? [],
    extra: input.extra ?? {},
  });
}

export function itemContentHash(item: Item): string {
  return hashContent(item);
}

/** Block the current thread without a dependency and without a busy loop. */
function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Retry a write that lost a race for the SQLite write lock. `busy_timeout` (set
 * in Store.open) covers most contention; this covers the rest. Anything that is
 * not a lock error rethrows immediately — retrying a schema error just makes the
 * failure slower.
 */
export function withRetry<T>(fn: () => T, attempts = 5): T {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return fn();
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      if (!/busy|locked/i.test(message)) throw err;
      sleepMs(20 * (attempt + 1));
    }
  }
  throw lastError;
}

function resolveCategory(ctx: MutationContext, type: string): ResolvedCategory {
  const category = ctx.config.categories[type];
  if (!category) {
    throw new Error(enumError('type', type, Object.keys(ctx.config.categories), 'categories'));
  }
  if (!category.enabled) {
    throw new Error(
      `my_context: category "${type}" is disabled in this project, so no new ` +
      `${type} items are accepted. Enable it in .my_context/config.json under ` +
      `categories.${type}.enabled, or pick another type — see mycontext_help("categories").`,
    );
  }
  return category;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeSource(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  return normalizePosix(value);
}

/** An id nobody else holds. Existing content is compared by the caller first. */
function allocateId(ctx: MutationContext, prefix: string, title: string): string {
  const base = makeId(prefix, title);
  if (!ctx.store.get(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!ctx.store.get(candidate)) return candidate;
  }
  throw new Error(
    `my_context: cannot allocate an id for "${title}" — 1000 variants already exist. ` +
    `Use a more specific title.`,
  );
}

/** Persist an item: Markdown first (the source of truth), then the index. */
export function persist(ctx: MutationContext, item: Item): void {
  item.checksum = computeItemChecksum(item);
  writeItem(ctx.root, item);
  withRetry(() => ctx.store.upsert(item));
}

export function createItem(ctx: MutationContext, input: CreateInput): MutationResult {
  const category = resolveCategory(ctx, input.type);

  const title = (input.title ?? '').trim();
  if (title === '') throw new Error(missingFieldError('title', 'create_item', 'capture'));

  const sourceFile = normalizeSource(input.sourceFile);
  const sourceAnchor = input.sourceAnchor ?? null;
  const hash = contentHash({ ...input, title });

  const anchored = sourceFile !== null && sourceAnchor !== null
    ? ctx.store.all().find((i) => i.sourceFile === sourceFile && i.sourceAnchor === sourceAnchor)
    : undefined;

  if (anchored) {
    const same = itemContentHash(anchored) === hash;
    return {
      id: anchored.id,
      created: false,
      status: anchored.status,
      filePath: anchored.filePath,
      message: same
        ? `my_context: already captured as ${anchored.id}. Nothing changed.`
        : `my_context: ${anchored.id} already covers ${sourceFile}#${sourceAnchor} with ` +
          `different wording. Call update_item(id: "${anchored.id}", ...) rather than ` +
          `creating a second item for the same passage.`,
    };
  }

  const byTitle = ctx.store.get(makeId(category.prefix, title));
  if (byTitle && itemContentHash(byTitle) === hash) {
    return {
      id: byTitle.id,
      created: false,
      status: byTitle.status,
      filePath: byTitle.filePath,
      message: `my_context: already captured as ${byTitle.id}. Nothing changed.`,
    };
  }

  const id = allocateId(ctx, category.prefix, title);
  const status: Status = input.status ?? 'active';
  const item: Item = {
    id,
    type: input.type,
    title,
    status,
    severity: input.severity ?? 'soft',
    always: input.always ?? false,
    scope: (input.scope ?? []).map((g) => normalizePosix(g)),
    tags: input.tags ?? [],
    origin: input.origin ?? 'human',
    sourceFile,
    sourceAnchor,
    sourceChecksum: null,
    validFrom: today(),
    validUntil: null,
    checksum: '',
    extra: input.extra ?? {},
    body: (input.body ?? '').trim(),
    observations: input.observations ?? [],
    relations: input.relations ?? [],
    layer: 'project',
    filePath: `items/${input.type}/${id}.md`,
  };

  persist(ctx, item);

  return {
    id,
    created: true,
    status: item.status,
    filePath: item.filePath,
    message: `my_context: created ${id} (${item.status}) at ${item.filePath}.`,
  };
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `node --test test/core/mutate-create.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/mutate.ts test/helpers/workspace.ts test/core/mutate-create.test.ts
git commit -m "feat: add the shared mutation layer with idempotent createItem"
```

---

## Task 3: The trust model

**Files:**
- Modify: `src/core/mutate.ts` (add `trustedStatus`, call it from `createItem`)
- Test: `test/core/mutate-trust.test.ts`

**Interfaces:**
- Consumes: everything from Task 2; `Tier` from `types.ts`
- Produces: `trustedStatus(origin: Origin, tier: Tier, requested: Status): Status`

Spec §7.1, stated exactly: capture is open to agents, governance is not. An item authored with `origin: 'agent'` whose category resolves to the **normative** tier is created as `draft` regardless of what the caller asked for. Drafts are indexed and searchable but the selector's first eligibility gate (`status === 'active'`) means they are never injected, so nothing an agent writes governs a future session until a human promotes it.

Two properties of the rule that the tests below pin down, because both are easy to get subtly wrong:

- **The tier comes from the resolved config, not from the built-in category table.** A project that declares `edge_case` normative gets the draft rule on agent-authored edge cases too. Reading `CATEGORIES` directly here would quietly exempt every project override.
- **The rule is not a default.** `status: 'active'` passed explicitly by an agent is overridden, not honoured. If it were merely a default, one argument would defeat the whole boundary.

- [ ] **Step 1: Write the failing test**

`test/core/mutate-trust.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createItem, trustedStatus } from '../../src/core/mutate.ts';
import { sandbox } from '../helpers/workspace.ts';

test('trustedStatus forces agent-authored normative items to draft', () => {
  assert.equal(trustedStatus('agent', 'normative', 'active'), 'draft');
  assert.equal(trustedStatus('agent', 'normative', 'draft'), 'draft');
});

test('trustedStatus leaves every other combination alone', () => {
  assert.equal(trustedStatus('agent', 'rationale', 'active'), 'active');
  assert.equal(trustedStatus('human', 'normative', 'active'), 'active');
  assert.equal(trustedStatus('human', 'rationale', 'active'), 'active');
  assert.equal(trustedStatus('ingest', 'normative', 'draft'), 'draft');
});

test('an agent-authored constraint lands as draft', () => {
  const s = sandbox();
  const result = createItem(s.ctx, {
    type: 'constraint', title: 'Pool capped at 20', origin: 'agent',
  });
  assert.equal(result.status, 'draft');
  assert.equal(s.ctx.store.get(result.id)?.status, 'draft');
  s.dispose();
});

test('an agent cannot request active for a normative item', () => {
  const s = sandbox();
  const result = createItem(s.ctx, {
    type: 'rule', title: 'Never log secrets', origin: 'agent', status: 'active',
  });
  assert.equal(result.status, 'draft');
  s.dispose();
});

test('an agent-authored lesson stays active — rationale is never injected anyway', () => {
  const s = sandbox();
  const result = createItem(s.ctx, {
    type: 'lesson', title: 'Migrations need an advisory lock', origin: 'agent',
  });
  assert.equal(result.status, 'active');
  s.dispose();
});

test('a human-authored constraint stays active', () => {
  const s = sandbox();
  const result = createItem(s.ctx, {
    type: 'constraint', title: 'Pool capped at 20', origin: 'human',
  });
  assert.equal(result.status, 'active');
  s.dispose();
});

test('the default origin is human, so the CLI is unaffected', () => {
  const s = sandbox();
  const result = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20' });
  assert.equal(result.status, 'active');
  s.dispose();
});

test('a project tier override extends the rule to that category', () => {
  const s = sandbox({ categories: { edge_case: { tier: 'normative' } } });
  const promoted = createItem(s.ctx, {
    type: 'edge_case', title: 'Empty cart at checkout', origin: 'agent',
  });
  assert.equal(promoted.status, 'draft');
  s.dispose();
});

test('a custom normative category gets the rule too', () => {
  const s = sandbox({
    categories: { sla: { enabled: true, tier: 'normative', description: 'Latency target' } },
  });
  const result = createItem(s.ctx, {
    type: 'sla', title: 'Checkout responds within 300ms', origin: 'agent',
  });
  assert.equal(result.status, 'draft');
  s.dispose();
});

test('the draft message tells the caller what happens next', () => {
  const s = sandbox();
  const result = createItem(s.ctx, {
    type: 'constraint', title: 'Pool capped at 20', origin: 'agent',
  });
  assert.match(result.message, /draft/);
  assert.match(result.message, /mycontext review/);
  s.dispose();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/core/mutate-trust.test.ts`
Expected: FAIL — `trustedStatus` is not exported, and the agent-authored constraint is `active`

- [ ] **Step 3: Implement**

Add to `src/core/mutate.ts`, importing `Tier` alongside the existing type imports:

```typescript
import type { Item, Observation, Origin, Relation, Severity, Status, Tier } from './types.ts';

/**
 * Spec §7.1. Agents capture freely; nothing they author governs future work
 * until a human promotes it. The tier argument must come from the *resolved*
 * config so per-project tier overrides and custom categories are covered.
 */
export function trustedStatus(origin: Origin, tier: Tier, requested: Status): Status {
  if (origin === 'agent' && tier === 'normative') return 'draft';
  return requested;
}
```

Then in `createItem`, replace the line that computes `status`:

```typescript
  const origin: Origin = input.origin ?? 'human';
  const status: Status = trustedStatus(origin, category.tier, input.status ?? 'active');
```

and use `origin` for the item's `origin` field instead of `input.origin ?? 'human'`:

```typescript
    origin,
```

Finally, extend the success message so the demotion is never silent:

```typescript
  const suffix = status === 'draft' && origin === 'agent'
    ? ` It is a draft because agent-authored ${category.tier} items are not injected ` +
      `until reviewed — run \`mycontext review\` to promote it.`
    : '';

  return {
    id,
    created: true,
    status: item.status,
    filePath: item.filePath,
    message: `my_context: created ${id} (${item.status}) at ${item.filePath}.${suffix}`,
  };
```

- [ ] **Step 4: Run the mutation suite and typecheck**

Run: `node --test test/core/mutate-trust.test.ts test/core/mutate-create.test.ts && npx tsc --noEmit`
Expected: PASS — including Task 2's tests, unchanged

- [ ] **Step 5: Commit**

```bash
git add src/core/mutate.ts test/core/mutate-trust.test.ts
git commit -m "feat: force agent-authored normative items to draft"
```

---

## Task 4: updateItem, supersedeItem, linkItems

**Files:**
- Modify: `src/core/mutate.ts`
- Test: `test/core/mutate-revise.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2 and 3; `unknownIdError` from `teach.ts`
- Produces:
  - `RELATION_TYPES: string[]`
  - `UpdateInput { id: string; title?: string; body?: string; scope?: string[]; tags?: string[]; severity?: Severity; always?: boolean; status?: Status; extra?: Record<string, string>; origin?: Origin }`
  - `SupersedeInput { id: string; by: string; reason?: string }`
  - `LinkInput { from: string; to: string; relation: string }`
  - `updateItem(ctx: MutationContext, input: UpdateInput): MutationResult`
  - `supersedeItem(ctx: MutationContext, input: SupersedeInput): MutationResult`
  - `linkItems(ctx: MutationContext, input: LinkInput): MutationResult`

Three rules these functions enforce, each from the spec:

- **Supersede never deletes and never drops content** (§10). The retired item keeps its file, its body, its observations and its relations; only `status` and `valid_until` change. The `supersedes` relation is written onto the *replacement*, matching the file format in §3.2, so the surviving item carries the pointer to its history.
- **A retitled item keeps its slug** (§3.2). `updateItem` never renames a file; changing a title changes the heading, not the id.
- **An agent may not change the status of a normative item.** Task 3 covers authorship; this covers the other route to the same outcome. Forcing `draft` on update would be wrong — it would let an agent demote a human's active constraint by editing its body — so status changes by an agent on a normative item are refused outright rather than rewritten.

- [ ] **Step 1: Write the failing test**

`test/core/mutate-revise.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createItem, linkItems, supersedeItem, updateItem } from '../../src/core/mutate.ts';
import { sandbox } from '../helpers/workspace.ts';

test('updateItem revises the body and keeps the id', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', body: 'Old.' });
  const updated = updateItem(s.ctx, { id: created.id, body: 'New reason.' });

  assert.equal(updated.id, created.id);
  assert.equal(s.ctx.store.get(created.id)?.body, 'New reason.');
  s.dispose();
});

test('updateItem bumps the checksum when content changes', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap', body: 'Old.' });
  const before = s.ctx.store.get(created.id)!.checksum;
  updateItem(s.ctx, { id: created.id, body: 'New.' });
  assert.notEqual(s.ctx.store.get(created.id)!.checksum, before);
  s.dispose();
});

test('a retitled item keeps its slug and its file', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  updateItem(s.ctx, { id: created.id, title: 'Connection pool capped at 20' });

  const item = s.ctx.store.get('CONST-pool-cap');
  assert.equal(item?.title, 'Connection pool capped at 20');
  assert.equal(item?.filePath, 'items/constraint/CONST-pool-cap.md');
  assert.equal(s.ctx.store.all().length, 1);
  s.dispose();
});

test('updateItem only touches the fields it was given', () => {
  const s = sandbox();
  const created = createItem(s.ctx, {
    type: 'constraint', title: 'Pool cap', body: 'Body.',
    scope: ['src/db/**'], tags: ['database'], severity: 'hard', always: true,
  });
  updateItem(s.ctx, { id: created.id, body: 'Rewritten.' });

  const item = s.ctx.store.get(created.id)!;
  assert.deepEqual(item.scope, ['src/db/**']);
  assert.deepEqual(item.tags, ['database']);
  assert.equal(item.severity, 'hard');
  assert.equal(item.always, true);
  s.dispose();
});

test('updateItem on an unknown id suggests the nearest', () => {
  const s = sandbox();
  createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => updateItem(s.ctx, { id: 'CONST-pool-capp', body: 'x' }),
    /no item with id "CONST-pool-capp".*CONST-pool-cap/s,
  );
  s.dispose();
});

test('an agent may edit a normative item but not its status', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });

  updateItem(s.ctx, { id: created.id, body: 'Extra rationale.', origin: 'agent' });
  assert.equal(s.ctx.store.get(created.id)?.body, 'Extra rationale.');

  assert.throws(
    () => updateItem(s.ctx, { id: created.id, status: 'deprecated', origin: 'agent' }),
    /cannot change the status of a normative item/i,
  );
  assert.equal(s.ctx.store.get(created.id)?.status, 'active');
  s.dispose();
});

test('an agent may change the status of a rationale item', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'lesson', title: 'Locks matter' });
  updateItem(s.ctx, { id: created.id, status: 'deprecated', origin: 'agent' });
  assert.equal(s.ctx.store.get(created.id)?.status, 'deprecated');
  s.dispose();
});

test('a human may change the status of a normative item', () => {
  const s = sandbox();
  const created = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  updateItem(s.ctx, { id: created.id, status: 'deprecated' });
  assert.equal(s.ctx.store.get(created.id)?.status, 'deprecated');
  s.dispose();
});

test('supersede retires the old item without deleting anything', () => {
  const s = sandbox();
  const old = createItem(s.ctx, {
    type: 'constraint', title: 'Pool capped at 10', body: 'The original reason.',
  });
  const next = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20' });

  supersedeItem(s.ctx, { id: old.id, by: next.id, reason: 'RDS instance resized.' });

  const retired = s.ctx.store.get(old.id)!;
  assert.equal(retired.status, 'superseded');
  assert.equal(retired.body, 'The original reason.');
  assert.match(retired.validUntil!, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(existsSync(path.join(s.root, ...retired.filePath.split('/'))));
  s.dispose();
});

test('supersede wires the relation onto the replacement', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 10' });
  const next = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20' });
  supersedeItem(s.ctx, { id: old.id, by: next.id });

  assert.deepEqual(s.ctx.store.get(next.id)?.relations, [
    { type: 'supersedes', target: old.id },
  ]);
  const text = readFileSync(path.join(s.root, 'items', 'constraint', `${next.id}.md`), 'utf8');
  assert.match(text, /- supersedes \[\[CONST-pool-capped-at-10\]\]/);
  s.dispose();
});

test('supersede records the reason as an observation on the replacement', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 10' });
  const next = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20' });
  supersedeItem(s.ctx, { id: old.id, by: next.id, reason: 'RDS instance resized.' });

  const observations = s.ctx.store.get(next.id)!.observations;
  assert.equal(observations[0].category, 'supersession');
  assert.match(observations[0].text, /RDS instance resized/);
  s.dispose();
});

test('supersede refuses to point an item at itself', () => {
  const s = sandbox();
  const only = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  assert.throws(() => supersedeItem(s.ctx, { id: only.id, by: only.id }), /itself/i);
  s.dispose();
});

test('supersede names the unknown side of the pair', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => supersedeItem(s.ctx, { id: old.id, by: 'CONST-nope' }),
    /no item with id "CONST-nope"/,
  );
  s.dispose();
});

test('supersede is idempotent', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 10' });
  const next = createItem(s.ctx, { type: 'constraint', title: 'Pool capped at 20' });
  supersedeItem(s.ctx, { id: old.id, by: next.id });
  const again = supersedeItem(s.ctx, { id: old.id, by: next.id });

  assert.equal(again.created, false);
  assert.equal(s.ctx.store.get(next.id)!.relations.length, 1);
  s.dispose();
});

test('linkItems adds a typed relation', () => {
  const s = sandbox();
  const a = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  const b = createItem(s.ctx, { type: 'adr', title: 'Use SQLite JSONB' });
  const result = linkItems(s.ctx, { from: a.id, to: b.id, relation: 'derived_from' });

  assert.equal(result.created, true);
  assert.deepEqual(s.ctx.store.get(a.id)?.relations, [
    { type: 'derived_from', target: b.id },
  ]);
  s.dispose();
});

test('linkItems is idempotent', () => {
  const s = sandbox();
  const a = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  const b = createItem(s.ctx, { type: 'adr', title: 'Use SQLite JSONB' });
  linkItems(s.ctx, { from: a.id, to: b.id, relation: 'derived_from' });
  const again = linkItems(s.ctx, { from: a.id, to: b.id, relation: 'derived_from' });

  assert.equal(again.created, false);
  assert.equal(s.ctx.store.get(a.id)!.relations.length, 1);
  s.dispose();
});

test('an unknown relation type is refused with the closest named', () => {
  const s = sandbox();
  const a = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  const b = createItem(s.ctx, { type: 'adr', title: 'Use SQLite JSONB' });
  assert.throws(
    () => linkItems(s.ctx, { from: a.id, to: b.id, relation: 'derives_from' }),
    /closest match is "derived_from".*mycontext_help\("workflow"\)/s,
  );
  s.dispose();
});

test('a link to an item that does not exist yet is allowed and flagged', () => {
  const s = sandbox();
  const a = createItem(s.ctx, { type: 'constraint', title: 'Pool cap' });
  const result = linkItems(s.ctx, { from: a.id, to: 'ADR-not-yet', relation: 'derived_from' });

  assert.equal(result.created, true);
  assert.match(result.message, /does not exist yet/i);
  assert.deepEqual(s.ctx.store.get(a.id)?.relations, [
    { type: 'derived_from', target: 'ADR-not-yet' },
  ]);
  s.dispose();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/core/mutate-revise.test.ts`
Expected: FAIL — `updateItem` is not exported from `../../src/core/mutate.ts`

- [ ] **Step 3: Implement**

Add `unknownIdError` to the `teach.ts` import in `src/core/mutate.ts`, then append:

```typescript
/**
 * The relation vocabulary. Closed deliberately: an open vocabulary produces
 * `derives_from`, `derivedFrom` and `derived-from` in one corpus, and then no
 * query finds all three.
 */
export const RELATION_TYPES = [
  'derived_from', 'constrains', 'supersedes', 'blocks',
  'mitigates', 'refines', 'relates_to', 'links_to',
];

export interface UpdateInput {
  id: string;
  title?: string;
  body?: string;
  scope?: string[];
  tags?: string[];
  severity?: Severity;
  always?: boolean;
  status?: Status;
  extra?: Record<string, string>;
  origin?: Origin;
}

export interface SupersedeInput {
  id: string;
  by: string;
  reason?: string;
}

export interface LinkInput {
  from: string;
  to: string;
  relation: string;
}

function requireItem(ctx: MutationContext, id: string): Item {
  const item = ctx.store.get(id);
  if (!item) throw new Error(unknownIdError(id, ctx.store.all().map((i) => i.id)));
  return item;
}

function tierOf(ctx: MutationContext, item: Item): Tier {
  return ctx.config.categories[item.type]?.tier ?? 'rationale';
}

export function updateItem(ctx: MutationContext, input: UpdateInput): MutationResult {
  const item = requireItem(ctx, input.id);
  const origin: Origin = input.origin ?? 'human';

  if (
    input.status !== undefined && input.status !== item.status &&
    origin === 'agent' && tierOf(ctx, item) === 'normative'
  ) {
    throw new Error(
      `my_context: an agent cannot change the status of a normative item. ` +
      `${item.id} stays "${item.status}". Every other field is editable; status ` +
      `changes go through \`mycontext review\`, or use supersede_item to retire it ` +
      `in favour of a replacement. See mycontext_help("capture").`,
    );
  }

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (title === '') throw new Error(missingFieldError('title', 'update_item', 'capture'));
    item.title = title;
  }
  if (input.body !== undefined) item.body = input.body.trim();
  if (input.scope !== undefined) item.scope = input.scope.map((g) => normalizePosix(g));
  if (input.tags !== undefined) item.tags = input.tags;
  if (input.severity !== undefined) item.severity = input.severity;
  if (input.always !== undefined) item.always = input.always;
  if (input.status !== undefined) item.status = input.status;
  if (input.extra !== undefined) item.extra = { ...item.extra, ...input.extra };

  persist(ctx, item);

  return {
    id: item.id,
    created: true,
    status: item.status,
    filePath: item.filePath,
    message: `my_context: updated ${item.id} (${item.status}).`,
  };
}

export function supersedeItem(ctx: MutationContext, input: SupersedeInput): MutationResult {
  if (input.id === input.by) {
    throw new Error(`my_context: ${input.id} cannot supersede itself.`);
  }

  const retired = requireItem(ctx, input.id);
  const replacement = requireItem(ctx, input.by);

  const alreadyWired = replacement.relations.some(
    (r) => r.type === 'supersedes' && r.target === retired.id,
  );
  if (alreadyWired && retired.status === 'superseded') {
    return {
      id: retired.id,
      created: false,
      status: retired.status,
      filePath: retired.filePath,
      message: `my_context: ${retired.id} is already superseded by ${replacement.id}.`,
    };
  }

  // Content is never removed — only the lifecycle fields move (spec §10).
  retired.status = 'superseded';
  retired.validUntil = today();
  persist(ctx, retired);

  if (!alreadyWired) {
    replacement.relations.push({ type: 'supersedes', target: retired.id });
  }
  if (input.reason) {
    replacement.observations.push({
      category: 'supersession',
      text: `Replaces ${retired.id}: ${input.reason}`,
      tags: [],
      context: null,
    });
  }
  persist(ctx, replacement);

  return {
    id: retired.id,
    created: true,
    status: retired.status,
    filePath: retired.filePath,
    message:
      `my_context: ${retired.id} is now superseded by ${replacement.id}. ` +
      `Nothing was deleted — the file remains and the item stays searchable.`,
  };
}

export function linkItems(ctx: MutationContext, input: LinkInput): MutationResult {
  if (!RELATION_TYPES.includes(input.relation)) {
    throw new Error(enumError('relation', input.relation, RELATION_TYPES, 'workflow'));
  }

  const from = requireItem(ctx, input.from);
  const target = ctx.store.get(input.to);

  if (from.relations.some((r) => r.type === input.relation && r.target === input.to)) {
    return {
      id: from.id,
      created: false,
      status: from.status,
      filePath: from.filePath,
      message: `my_context: ${from.id} already ${input.relation} ${input.to}.`,
    };
  }

  from.relations.push({ type: input.relation, target: input.to });
  persist(ctx, from);

  // Unresolved links are permitted by design (spec §3.2) and resolve on the
  // next sync, so this is a note rather than an error.
  const note = target
    ? ''
    : ` Note: ${input.to} does not exist yet; the link resolves when it is created.`;

  return {
    id: from.id,
    created: true,
    status: from.status,
    filePath: from.filePath,
    message: `my_context: ${from.id} ${input.relation} ${input.to}.${note}`,
  };
}
```

- [ ] **Step 4: Run the mutation suite and typecheck**

Run: `node --test "test/core/mutate-*.test.ts" && npx tsc --noEmit`
Expected: PASS — all three mutation files

- [ ] **Step 5: Commit**

```bash
git add src/core/mutate.ts test/core/mutate-revise.test.ts
git commit -m "feat: add updateItem, supersedeItem and linkItems"
```

---

## Task 5: The help system

**Files:**
- Create: `src/help/topics/categories.md`, `src/help/topics/scope.md`, `src/help/topics/capture.md`, `src/help/topics/workflow.md`, `src/help/index.ts`
- Modify: `src/cli/index.ts` (route `help` and add `examples`)
- Test: `test/help/help.test.ts`

**Interfaces:**
- Consumes: `Config`, `ResolvedCategory` from `config.ts`; `Item` from `types.ts`; `renderItem`, `computeItemChecksum` from `item.ts`; `makeId` from `slug.ts`; `enumError`, `HelpTopic` from `teach.ts`
- Produces:
  - `HELP_TOPICS: HelpTopic[]`
  - `RESERVED_TOOLS: string[]`
  - `categoryTable(config: Config): string`
  - `helpTopic(topic: string, config: Config): string`
  - `toolDescriptions(): Record<string, string>`
  - `exampleItem(type: string, config: Config): string`

Spec §9 requires **one source**. The four Markdown files are it. `mycontext_help`, the CLI `help` command, and every MCP tool description are all reads of these files — there is no second copy to drift. Two mechanisms make that literal rather than aspirational:

- The category table is **generated from the resolved config** into `{{CATEGORY_TABLE}}`, so a disabled category disappears from the docs and a custom category documents itself.
- Tool descriptions are **parsed out of `capture.md`'s `## Tools` section**. Task 7 asserts that the documented set and the registered set are identical, so documentation cannot describe a tool that does not exist, and a tool cannot exist undocumented.

- [ ] **Step 1: Write the failing test**

`test/help/help.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HELP_TOPICS, categoryTable, exampleItem, helpTopic, toolDescriptions,
} from '../../src/help/index.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { parseItem } from '../../src/core/item.ts';
import { runCli } from '../../src/cli/index.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CONFIG = resolveConfig({});

test('there are exactly the four documented topics', () => {
  assert.deepEqual([...HELP_TOPICS].sort(), ['capture', 'categories', 'scope', 'workflow']);
});

test('every topic renders with no unexpanded placeholders', () => {
  for (const topic of HELP_TOPICS) {
    const text = helpTopic(topic, CONFIG);
    assert.ok(text.length > 200, `${topic} is suspiciously short`);
    assert.equal(text.includes('{{'), false, `${topic} has an unexpanded placeholder`);
  }
});

test('the category table is generated from the config, not hand-written', () => {
  const table = categoryTable(CONFIG);
  assert.match(table, /`constraint`/);
  assert.match(table, /`lesson`/);
  assert.equal(/`policy`/.test(table), false, 'policy is disabled by default');
});

test('a custom category documents itself', () => {
  const cfg = resolveConfig({
    categories: { sla: { enabled: true, tier: 'normative', description: 'Latency target' } },
  });
  const text = helpTopic('categories', cfg);
  assert.match(text, /`sla`/);
  assert.match(text, /Latency target/);
});

test('a project tier override shows the overridden tier', () => {
  const cfg = resolveConfig({ categories: { edge_case: { tier: 'normative' } } });
  const rows = categoryTable(cfg).split('\n').filter((l) => l.includes('`edge_case`'));
  assert.equal(rows.length, 1);
  assert.match(rows[0], /normative/);
});

test('help("categories") states the adr versus decision boundary', () => {
  const text = helpTopic('categories', CONFIG);
  assert.match(text, /`adr` vs `decision`/);
});

test('help("scope") is worked examples, not prose', () => {
  const text = helpTopic('scope', CONFIG);
  assert.match(text, /src\/db\/\*\*/);
  assert.match(text, /Too broad/i);
  assert.match(text, /Too narrow/i);
  const tableRows = text.split('\n').filter((l) => l.startsWith('| `') || l.startsWith('| "'));
  assert.ok(tableRows.length >= 8, `only ${tableRows.length} worked example rows`);
});

test('an unknown topic is refused with the closest named', () => {
  assert.throws(
    () => helpTopic('categorys', CONFIG),
    /closest match is "categories"/,
  );
});

test('tool descriptions parse out of capture.md and are terse', () => {
  const descriptions = toolDescriptions();
  assert.ok(descriptions.create_item, 'create_item is undocumented');
  assert.ok(descriptions.ingest_document, 'the reserved tool is undocumented');
  for (const [name, text] of Object.entries(descriptions)) {
    assert.ok(text.length <= 200, `${name} description is ${text.length} chars`);
    assert.ok(text.length >= 20, `${name} description is too thin`);
  }
});

test('every tool description says when not to use it', () => {
  for (const [name, text] of Object.entries(toolDescriptions())) {
    assert.match(text, /Not for:/, `${name} does not say when not to use it`);
  }
});

test('there is no delete tool documented anywhere', () => {
  assert.equal(Object.keys(toolDescriptions()).some((n) => /delete|remove/.test(n)), false);
  for (const topic of HELP_TOPICS) {
    assert.equal(/delete_item/.test(helpTopic(topic, CONFIG)), false, topic);
  }
});

test('every enabled category has an example that parses back', () => {
  for (const category of Object.values(CONFIG.categories)) {
    if (!category.enabled) continue;
    const text = exampleItem(category.name, CONFIG);
    const item = parseItem(text, `items/${category.name}/x.md`, 'project');
    assert.equal(item.type, category.name, category.name);
    assert.ok(item.id.startsWith(`${category.prefix}-`), `${category.name}: ${item.id}`);
    assert.ok(item.title.length > 0, category.name);
  }
});

test('a custom category gets a usable example rather than an error', () => {
  const cfg = resolveConfig({
    categories: { sla: { enabled: true, tier: 'normative', description: 'Latency target' } },
  });
  const item = parseItem(exampleItem('sla', cfg), 'items/sla/x.md', 'project');
  assert.equal(item.type, 'sla');
});

test('an unknown example type is refused with the closest named', () => {
  assert.throws(() => exampleItem('constraints', CONFIG), /closest match is "constraint"/);
});

test('the CLI lists topics when help is given no argument', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-help-'));
  let out = '';
  const code = runCli(['help'], cwd, (s) => { out += s + '\n'; });
  assert.equal(code, 0);
  for (const topic of HELP_TOPICS) assert.match(out, new RegExp(topic));
  rmSync(cwd, { recursive: true, force: true });
});

test('the CLI prints a topic and works outside a workspace', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-help-'));
  let out = '';
  const code = runCli(['help', 'scope'], cwd, (s) => { out += s + '\n'; });
  assert.equal(code, 0);
  assert.match(out, /Too broad/i);
  rmSync(cwd, { recursive: true, force: true });
});

test('the CLI rejects an unknown topic non-zero', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-help-'));
  let out = '';
  const code = runCli(['help', 'nonsense'], cwd, (s) => { out += s + '\n'; });
  assert.equal(code, 1);
  assert.match(out, /must be one of/);
  rmSync(cwd, { recursive: true, force: true });
});

test('the CLI prints an example item', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-help-'));
  let out = '';
  const code = runCli(['examples', 'constraint'], cwd, (s) => { out += s + '\n'; });
  assert.equal(code, 0);
  assert.match(out, /type: constraint/);
  rmSync(cwd, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/help/help.test.ts`
Expected: FAIL — `Cannot find module '../../src/help/index.ts'`

- [ ] **Step 3: Write the topic files**

`src/help/topics/categories.md`:

```markdown
# Categories

Every my_context item has a type. The type decides two things: whether the item
can be injected into a future session, and the prefix of its id.

- **Normative** types govern future work. With `always: true` they are injected
  in full at every session start; with a `scope` they are injected when a
  matching file is touched.
- **Rationale** types explain past reasoning. They are never injected. They
  appear in the session index as counts and are retrieved with `query_items`.

Only the types below are accepted in this project. Anything else is refused.

{{CATEGORY_TABLE}}

## Choosing between close neighbours

- `adr` vs `decision` — an ADR is heavyweight: drivers, considered options,
  outcome, consequences. A decision is one sentence plus its reason. If you
  would not write a "considered options" section, it is a `decision`.
- `constraint` vs `non_goal` — a constraint limits *how* something is built
  ("must run on Node 24 with no dependencies"). A non_goal excludes the thing
  itself ("we are not building offline sync").
- `rule` vs `standard` — a rule is a do/don't directive and carries
  `directive: do | dont`. A standard is a convention that shapes how code looks.
- `lesson` vs `rule` — a lesson is what happened. A rule is what must now hold.
  Capture the lesson; a human promotes it to a rule.
- `open_question` vs `assumption` — an open question is deliberately undecided
  and you must not decide it alone. An assumption is a premise someone already
  acted on that has not been verified yet.
- Functional versus non-functional requirements are the `kind` field on
  `requirement`, not two types.

## When you are unsure

Capture it as the closest type rather than not capturing it. A misfiled item is
recoverable with `update_item`; an uncaptured constraint is lost.
```

`src/help/topics/scope.md`:

```markdown
# Scope

`scope` is a list of globs, relative to the repository root, always POSIX —
forward slashes, no drive letter, no leading `./`. Globs are matched against
paths like `src/db/writer.ts`, never `C:\repo\src\db\writer.ts`.

An item with **no scope is never injected**. It is indexed and searchable, and
that is all. This is the default and it is deliberate: a corpus where everything
activates everywhere refills the context window as it grows.

## Supported syntax

| Pattern | Matches | Does not match |
|---|---|---|
| `src/db/**` | `src/db/writer.ts`, `src/db/a/b.ts` | `src/db`, `src/api/x.ts` |
| `src/*.ts` | `src/a.ts` | `src/x/a.ts` |
| `src/**/test.ts` | `src/test.ts`, `src/a/b/test.ts` | `src/test.tsx` |
| `**/*.sql` | `migrations/001.sql` | `migrations/001.py` |
| `**` | everything | nothing |

## Worked examples

| The item says | Scope to write | Why |
|---|---|---|
| "Postgres pool must never exceed 20" | `["src/db/**", "src/api/handlers/**"]` | The pool config *and* every caller that opens a connection |
| "Money is stored as integer cents" | `["src/billing/**", "src/models/**", "migrations/**"]` | Violated wherever money is defined or persisted |
| "React components use function syntax" | `["src/components/**/*.tsx"]` | Narrow by extension, broad by directory |
| "Never hand-edit generated protobuf output" | `["**/*_pb2.py", "**/*.pb.go"]` | The rule follows a file shape, not a directory |
| "Migrations run inside a transaction" | `["migrations/**"]` | One directory owns the concern |
| "Auth tokens are validated server-side" | `["src/api/**", "src/middleware/**"]` | The boundary where a token arrives |
| "Prefer composition over inheritance" | `[]` — none | A taste preference is not worth activating on every file |
| "Always run the linter before committing" | `[]` with `always: true` | Process guidance is relevant regardless of path |

## Two ways to get this wrong

**Too broad.** `["**"]`, or `["src/**"]` for a rule about one subsystem. Every
file operation anywhere then spends budget on it. If you are tempted by `**`,
what you want is `always: true` with no scope — that puts the item in the pinned
tier where it is budgeted once per session instead of on every tool call.

**Too narrow.** `["src/db/pool.ts"]`. The next refactor renames the file and the
constraint silently stops activating, which is indistinguishable from never
having written it. Scope the directory that owns the concern, not the file that
happens to hold it today.

Rule of thumb: name the directories in which a violation would appear.
```

`src/help/topics/capture.md`:

```markdown
# Capture

Capture knowledge **as it is established**, in the same turn it is agreed —
during a brainstorm, while writing a spec, when a review settles an argument.
A constraint recorded three sessions later is usually recorded wrong or not at
all.

## What is worth capturing

Anything that answers *what must hold* rather than *what happened*: a limit
somebody committed to, a decision with a reason, a requirement, a boundary
condition, something explicitly ruled out, a question deliberately left open.

Not worth capturing: what you did this session, a summary of a file, restating
something already in the corpus. Session activity belongs to claude-mem.

## What happens to what you write

Items you create with `origin: agent` — that is, everything created through
these tools — land as **drafts** when their type is normative. Drafts are
indexed and searchable but are never injected into a session. A human promotes
them with `mycontext review`. Rationale items (`lesson`, `adr`, `decision`,
`tradeoff`, …) are created active, because nothing in that tier is injected in
the first place.

This is not a reason to capture less. Capture freely; the gate is downstream.

## Calling create_item more than once is free

`create_item` is an upsert keyed on `(source_file, source_anchor)` plus a
content hash. Calling it twice with the same content returns
*"already captured as REQ-…"* and writes nothing. If the wording at a source
anchor has changed, it tells you to call `update_item` with the existing id
rather than creating a near-duplicate. You never need to check first.

## Tools

- `create_item`: Capture a new constraint, requirement, decision, lesson or other typed item. Idempotent — safe to call repeatedly. Not for: notes about this session's work, or restating an item that already exists.
- `update_item`: Revise an existing item's title, body, scope, tags or severity by id. Not for: creating something new, or retiring an item — use supersede_item for that.
- `supersede_item`: Retire an item in favour of a replacement, preserving both and wiring a supersedes relation. Not for: fixing a typo, and not for deleting — nothing is ever deleted.
- `link_items`: Record a typed relation between two items, such as derived_from or constrains. Not for: relations already present, which are ignored.
- `get_item`: Fetch one item in full by id, as Markdown. Not for: searching — use query_items when you do not know the id.
- `query_items`: Search and filter items by type, status, tag, text or file path. Not for: fetching a known id, which get_item does directly.
- `list_drafts`: List items awaiting human review, newest first. Not for: promoting them — only a human can do that.
- `mycontext_help`: Read guidance on one topic: categories, scope, capture, workflow. Not for: item content, which query_items retrieves.
- `mycontext_examples`: Show a complete, correct example item of a given type to copy. Not for: real project content.
- `ingest_document`: Reserved. Batch extraction from a document is not implemented yet; capture items individually with create_item.
```

`src/help/topics/workflow.md`:

```markdown
# Workflow

## Lifecycle

`draft` → reviewed by a human → `active` → later `superseded` or `deprecated`.

Only `active` items are injected. `draft`, `superseded`, `deprecated` and
`validated` remain indexed and searchable forever — supersession is how the
corpus stays small without losing history.

Nothing is ever deleted through these tools. There is no delete. An item that is
wrong is superseded or deprecated, both of which are reversible and both of
which leave a trail.

## Relations

Relations live in the Markdown file, so they survive a rebuild and merge like
text. The vocabulary is closed:

| Relation | Meaning |
|---|---|
| `derived_from` | This item came out of that one — a rule from a lesson, a constraint from an ADR |
| `constrains` | This item limits what that one may do |
| `supersedes` | This item replaces that one; written automatically by supersede_item |
| `blocks` | That item cannot be settled until this one is — mainly for open_question |
| `mitigates` | This item reduces that risk |
| `refines` | This item makes that one more specific |
| `relates_to` | Weak association, when nothing more precise fits |
| `links_to` | A bare mention |

A relation may point at an item that does not exist yet. It resolves when that
item is created.

## A typical sequence

1. Something is established in conversation or in a document.
2. `create_item` with a type, a title, a body giving the reason, and a `scope`
   if it should activate on particular files.
3. If it came from a document, pass `source_file` and `source_anchor` so the
   capture is idempotent and traceable.
4. `link_items` to whatever it derives from or constrains.
5. Later, when it changes: `create_item` for the new version, then
   `supersede_item` pointing the old one at the new one.

## Reviewing

`list_drafts` shows what is waiting. Promotion is a human action —
`mycontext review` in the terminal. An agent cannot promote its own draft, and
cannot change the status of a normative item at all.
```

- [ ] **Step 4: Implement the help module**

`src/help/index.ts`:

```typescript
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
 * `split`/`join` rather than `String.replace`: a generated table contains `$`
 * sequences that `replace` would interpret as capture-group references.
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
    const match = TOOL_LINE.exec(line.trim());
    if (match) out[match[1]] = match[2].trim();
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
```

- [ ] **Step 5: Wire the CLI**

In `src/cli/index.ts`, add the imports:

```typescript
import { HELP_TOPICS, exampleItem, helpTopic } from '../help/index.ts';
```

Add the two commands to `USAGE`, immediately above the `categories:` line:

```typescript
  help [topic]                guidance: ${HELP_TOPICS.join(', ')}
  examples <category>         print a complete example item
```

Add the two command functions:

```typescript
function cmdHelp(ws: Workspace, args: string[], out: Emit): number {
  const topic = args[0];
  if (!topic) {
    out(USAGE);
    out('');
    out(`help topics: ${HELP_TOPICS.join(', ')}`);
    out('  e.g. mycontext help scope');
    return 0;
  }
  try {
    out(helpTopic(topic, ws.config));
    return 0;
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

function cmdExamples(ws: Workspace, args: string[], out: Emit): number {
  const type = args[0];
  if (!type) { out(`usage: mycontext examples <category>`); return 1; }
  try {
    out(exampleItem(type, ws.config));
    return 0;
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  }
}
```

Then change the dispatch in `runCli`. The early-return branch loses `help`, which now needs the resolved config:

```typescript
  if (!command || command === '--help') { out(USAGE); return command ? 0 : 1; }
  if (command === 'init') return cmdInit(cwd, out);
```

and the switch gains two cases:

```typescript
    case 'help':     return cmdHelp(ws, args, out);
    case 'examples': return cmdExamples(ws, args, out);
```

`resolveWorkspace` returns a default config when there is no `.my_context` directory, so both commands work outside a workspace — which is exactly when someone is most likely to ask what a category is.

- [ ] **Step 6: Run the help suite, the CLI suite and typecheck**

Run: `node --test test/help/help.test.ts test/cli/cli.test.ts && npx tsc --noEmit`
Expected: PASS — Plan 1's CLI tests are unchanged by the new commands

- [ ] **Step 7: Commit**

```bash
git add src/help test/help/help.test.ts src/cli/index.ts
git commit -m "feat: add the help system compiled from topic files"
```

---

## Task 6: The MCP wire protocol

**Files:**
- Create: `src/mcp/protocol.ts`
- Test: `test/mcp/protocol.test.ts`

**Interfaces:**
- Consumes: nothing from this project
- Produces:
  - `LATEST_PROTOCOL_VERSION: string`, `SUPPORTED_PROTOCOL_VERSIONS: string[]`, `SERVER_INFO: { name: string; version: string }`
  - `ToolDefinition { name: string; description: string; inputSchema: Record<string, unknown> }`
  - `ToolRegistry { list(): ToolDefinition[]; call(name: string, args: Record<string, unknown>): string }`
  - `JsonRpcMessage`, `JsonRpcResponse`
  - `createSession(registry: ToolRegistry): { handle(message: JsonRpcMessage): JsonRpcResponse | null }`
  - `serveStdio(input: NodeJS.ReadableStream, output: NodeJS.WritableStream, session: { handle(message: JsonRpcMessage): JsonRpcResponse | null }): void`

Read the **Verified MCP wire-format facts** section at the top of this plan before implementing. Every shape below traces to a specific paragraph there, and the citations are the reason the code can be written without an SDK.

The session is pure in the sense that matters for testing: `handle` takes a parsed message and returns a response object or `null`. No streams, no process, no I/O. `serveStdio` is the only part that touches a stream, and it is fifteen lines. That split is what lets the whole protocol be tested with plain objects.

- [ ] **Step 1: Write the failing test**

`test/mcp/protocol.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import {
  LATEST_PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSIONS, createSession, serveStdio,
} from '../../src/mcp/protocol.ts';
import type { ToolRegistry } from '../../src/mcp/protocol.ts';

const registry: ToolRegistry = {
  list: () => [
    {
      name: 'echo',
      description: 'Echo the text back. Not for: anything useful.',
      inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    },
  ],
  call: (name, args) => {
    if (args.text === 'boom') throw new Error('my_context: "text" must not be "boom".');
    return `echo: ${String(args.text)}`;
  },
};

function session() {
  return createSession(registry);
}

test('initialize echoes a supported protocol version', () => {
  const response = session().handle({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'c', version: '1' } },
  })!;
  const result = response.result as Record<string, unknown>;
  assert.equal(response.id, 1);
  assert.equal(result.protocolVersion, '2025-06-18');
  assert.deepEqual(result.capabilities, { tools: { listChanged: false } });
  assert.equal((result.serverInfo as { name: string }).name, 'my-context');
});

test('initialize with an unknown version answers with the latest supported', () => {
  const result = session().handle({
    jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1900-01-01' },
  })!.result as Record<string, unknown>;
  assert.equal(result.protocolVersion, LATEST_PROTOCOL_VERSION);
});

test('a notification never produces a response', () => {
  assert.equal(session().handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.equal(session().handle({ jsonrpc: '2.0', method: 'notifications/cancelled' }), null);
  assert.equal(session().handle({ jsonrpc: '2.0', method: 'nonsense/unknown' }), null);
});

test('tools/list returns the registry and no cursor', () => {
  const result = session().handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' })!
    .result as Record<string, unknown>;
  const tools = result.tools as { name: string }[];
  assert.deepEqual(tools.map((t) => t.name), ['echo']);
  assert.equal('nextCursor' in result, false);
});

test('tools/call wraps the result as text content', () => {
  const result = session().handle({
    jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: { name: 'echo', arguments: { text: 'hi' } },
  })!.result as Record<string, unknown>;
  assert.deepEqual(result.content, [{ type: 'text', text: 'echo: hi' }]);
  assert.equal(result.isError, false);
});

test('a rejected tool call is a result with isError, not a protocol error', () => {
  const response = session().handle({
    jsonrpc: '2.0', id: 4, method: 'tools/call',
    params: { name: 'echo', arguments: { text: 'boom' } },
  })!;
  assert.equal(response.error, undefined);
  const result = response.result as Record<string, unknown>;
  assert.equal(result.isError, true);
  assert.match((result.content as { text: string }[])[0].text, /must not be "boom"/);
});

test('an unknown tool is a protocol error', () => {
  const response = session().handle({
    jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'nope', arguments: {} },
  })!;
  assert.equal(response.error?.code, -32602);
  assert.match(response.error!.message, /Unknown tool: nope/);
});

test('tools/call without arguments passes an empty object', () => {
  const result = session().handle({
    jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'echo' },
  })!.result as Record<string, unknown>;
  assert.deepEqual(result.content, [{ type: 'text', text: 'echo: undefined' }]);
});

test('an unknown method with an id is method-not-found', () => {
  const response = session().handle({ jsonrpc: '2.0', id: 7, method: 'resources/list' })!;
  assert.equal(response.error?.code, -32601);
});

test('ping answers empty for legacy clients', () => {
  assert.deepEqual(session().handle({ jsonrpc: '2.0', id: 8, method: 'ping' })!.result, {});
});

test('server/discover advertises every supported version', () => {
  const result = session().handle({ jsonrpc: '2.0', id: 9, method: 'server/discover' })!
    .result as Record<string, unknown>;
  assert.deepEqual(result.supportedVersions, SUPPORTED_PROTOCOL_VERSIONS);
  assert.deepEqual(result.capabilities, { tools: {} });
  assert.equal(result.resultType, 'complete');
  const meta = result._meta as Record<string, { name: string }>;
  assert.equal(meta['io.modelcontextprotocol/serverInfo'].name, 'my-context');
});

test('a modern client announcing 2026-07-28 in _meta gets decorated results', () => {
  const s = session();
  const result = s.handle({
    jsonrpc: '2.0', id: 10, method: 'tools/list',
    params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } },
  })!.result as Record<string, unknown>;
  assert.equal(result.resultType, 'complete');
  assert.equal(typeof result.ttlMs, 'number');
  assert.equal(result.cacheScope, 'public');
});

test('a legacy client gets no 2026 fields', () => {
  const s = session();
  s.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  const result = s.handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' })!
    .result as Record<string, unknown>;
  assert.equal('resultType' in result, false);
  assert.equal('ttlMs' in result, false);
});

test('an unsupported announced version is rejected with -32022 and the supported list', () => {
  const response = session().handle({
    jsonrpc: '2.0', id: 11, method: 'tools/list',
    params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '1900-01-01' } },
  })!;
  assert.equal(response.error?.code, -32022);
  const data = response.error!.data as Record<string, unknown>;
  assert.deepEqual(data.supported, SUPPORTED_PROTOCOL_VERSIONS);
  assert.equal(data.requested, '1900-01-01');
});

test('a message with no method and an id is an invalid request', () => {
  const response = session().handle({ jsonrpc: '2.0', id: 12 })!;
  assert.equal(response.error?.code, -32600);
});

function drive(lines: string[]): Promise<string[]> {
  return new Promise((resolve) => {
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on('data', (c: Buffer) => chunks.push(c.toString('utf8')));
    serveStdio(input, output, session());
    for (const line of lines) input.write(line);
    setImmediate(() => resolve(chunks.join('').split('\n').filter((l) => l !== '')));
  });
}

test('stdio framing reads newline-delimited messages, including split writes', async () => {
  const lines = await drive([
    '{"jsonrpc":"2.0","id":1,"method":"ping"}\n{"jsonrpc":"2.0","id":2,',
    '"method":"ping"}\n',
  ]);
  assert.equal(lines.length, 2);
  assert.deepEqual(JSON.parse(lines[0]), { jsonrpc: '2.0', id: 1, result: {} });
  assert.deepEqual(JSON.parse(lines[1]), { jsonrpc: '2.0', id: 2, result: {} });
});

test('every written line is a single line of valid JSON', async () => {
  const lines = await drive([
    '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":' +
    '{"name":"echo","arguments":{"text":"a\\nb"}}}\n',
  ]);
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]) as { result: { content: { text: string }[] } };
  assert.equal(parsed.result.content[0].text, 'echo: a\nb');
});

test('malformed JSON yields a parse error and does not kill the loop', async () => {
  const lines = await drive(['not json\n', '{"jsonrpc":"2.0","id":2,"method":"ping"}\n']);
  assert.equal(JSON.parse(lines[0]).error.code, -32700);
  assert.equal(JSON.parse(lines[1]).id, 2);
});

test('blank lines and CRLF endings are tolerated', async () => {
  const lines = await drive(['\n', '{"jsonrpc":"2.0","id":1,"method":"ping"}\r\n']);
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).id, 1);
});

test('a notification writes nothing at all', async () => {
  const lines = await drive(['{"jsonrpc":"2.0","method":"notifications/initialized"}\n']);
  assert.deepEqual(lines, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/mcp/protocol.test.ts`
Expected: FAIL — `Cannot find module '../../src/mcp/protocol.ts'`

- [ ] **Step 3: Implement**

`src/mcp/protocol.ts`:

```typescript
export const LATEST_PROTOCOL_VERSION = '2026-07-28';

/** Newest first. Advertised verbatim by server/discover and in -32022 data. */
export const SUPPORTED_PROTOCOL_VERSIONS = [
  '2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26',
];

/** The revision at which results gained resultType / ttlMs / cacheScope. */
const MODERN_FROM = '2026-07-28';

/** Assumed when a client never announces one — the last handshake revision. */
const ASSUMED_VERSION = '2025-06-18';

const META_VERSION = 'io.modelcontextprotocol/protocolVersion';
const META_SERVER_INFO = 'io.modelcontextprotocol/serverInfo';

export const SERVER_INFO = { name: 'my-context', version: '0.1.0' };

const INSTRUCTIONS =
  'Project constraints, requirements, decisions and lessons. Capture normative ' +
  'knowledge as it is established; call mycontext_help("capture") first if unsure.';

export const ERROR_PARSE = -32700;
export const ERROR_INVALID_REQUEST = -32600;
export const ERROR_METHOD_NOT_FOUND = -32601;
export const ERROR_INVALID_PARAMS = -32602;
export const ERROR_INTERNAL = -32603;
/** UnsupportedProtocolVersion, renumbered from -32004 in revision 2026-07-28. */
export const ERROR_UNSUPPORTED_VERSION = -32022;

export interface JsonRpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcErrorBody {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcErrorBody;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolRegistry {
  list(): ToolDefinition[];
  /** Returns the text shown to the model. Throws to signal a tool-level error. */
  call(name: string, args: Record<string, unknown>): string;
}

export interface Session {
  handle(message: JsonRpcMessage): JsonRpcResponse | null;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function ok(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function fail(
  id: string | number | null, code: number, message: string, data?: unknown,
): JsonRpcResponse {
  const error: JsonRpcErrorBody = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: '2.0', id, error };
}

export function createSession(registry: ToolRegistry): Session {
  let negotiated = ASSUMED_VERSION;

  /** ISO dates compare correctly as plain strings; no date parsing needed. */
  const isModern = (): boolean => negotiated >= MODERN_FROM;

  function decorate(result: Record<string, unknown>, cacheable: boolean): Record<string, unknown> {
    if (!isModern()) return result;
    const out: Record<string, unknown> = {
      ...result,
      resultType: 'complete',
      _meta: { [META_SERVER_INFO]: SERVER_INFO },
    };
    if (cacheable) {
      out.ttlMs = 300_000;
      out.cacheScope = 'public';
    }
    return out;
  }

  function announcedVersion(params: Record<string, unknown>): string | null {
    const meta = params._meta;
    if (!isObject(meta)) return null;
    const version = meta[META_VERSION];
    return typeof version === 'string' ? version : null;
  }

  function callTool(id: string | number | null, params: Record<string, unknown>): JsonRpcResponse {
    const name = typeof params.name === 'string' ? params.name : '';
    const args = isObject(params.arguments) ? params.arguments : {};

    if (!registry.list().some((tool) => tool.name === name)) {
      return fail(id, ERROR_INVALID_PARAMS, `Unknown tool: ${name}`);
    }

    // A tool that ran and refused its input is a *result* with isError, not a
    // protocol error: only result content reaches the model, and the teaching
    // message is the entire point of refusing.
    try {
      const text = registry.call(name, args);
      return ok(id, decorate({ content: [{ type: 'text', text }], isError: false }, false));
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      return ok(id, decorate({ content: [{ type: 'text', text }], isError: true }, false));
    }
  }

  function handle(message: JsonRpcMessage): JsonRpcResponse | null {
    const id = message.id ?? null;
    const isNotification = message.id === undefined || message.id === null;
    const params = isObject(message.params) ? message.params : {};

    const announced = announcedVersion(params);
    if (announced !== null) {
      if (!SUPPORTED_PROTOCOL_VERSIONS.includes(announced)) {
        if (isNotification) return null;
        return fail(
          id, ERROR_UNSUPPORTED_VERSION, 'Unsupported protocol version',
          { supported: SUPPORTED_PROTOCOL_VERSIONS, requested: announced },
        );
      }
      negotiated = announced;
    }

    // Notifications never receive a response, whatever they say.
    if (isNotification) return null;

    const method = message.method;
    if (typeof method !== 'string' || method === '') {
      return fail(id, ERROR_INVALID_REQUEST, 'Missing "method".');
    }

    switch (method) {
      case 'initialize': {
        const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
        negotiated = SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
          ? requested
          : LATEST_PROTOCOL_VERSION;
        return ok(id, {
          protocolVersion: negotiated,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        });
      }

      case 'server/discover':
        return ok(id, {
          resultType: 'complete',
          supportedVersions: SUPPORTED_PROTOCOL_VERSIONS,
          capabilities: { tools: {} },
          _meta: { [META_SERVER_INFO]: SERVER_INFO },
          instructions: INSTRUCTIONS,
          ttlMs: 3_600_000,
          cacheScope: 'public',
        });

      case 'ping':
        return ok(id, {});

      case 'tools/list':
        return ok(id, decorate({ tools: registry.list() }, true));

      case 'tools/call':
        return callTool(id, params);

      default:
        return fail(id, ERROR_METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
  }

  return { handle };
}

function writeMessage(output: NodeJS.WritableStream, response: JsonRpcResponse): void {
  // JSON.stringify escapes every newline inside strings, so the payload can
  // never contain a raw \n — which the stdio transport forbids.
  output.write(JSON.stringify(response) + '\n');
}

export function serveStdio(
  input: NodeJS.ReadableStream, output: NodeJS.WritableStream, session: Session,
): void {
  let buffer = '';
  input.setEncoding('utf8');

  input.on('data', (chunk: string) => {
    buffer += chunk;

    for (;;) {
      const newline = buffer.indexOf('\n');
      if (newline < 0) break;

      const line = buffer.slice(0, newline).replace(/\r$/, '');
      buffer = buffer.slice(newline + 1);
      if (line.trim() === '') continue;

      let message: JsonRpcMessage;
      try {
        message = JSON.parse(line) as JsonRpcMessage;
      } catch {
        writeMessage(output, fail(null, ERROR_PARSE, 'Parse error'));
        continue;
      }

      let response: JsonRpcResponse | null;
      try {
        response = session.handle(message);
      } catch (err) {
        response = fail(
          message.id ?? null, ERROR_INTERNAL,
          err instanceof Error ? err.message : String(err),
        );
      }
      if (response) writeMessage(output, response);
    }
  });
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/mcp/protocol.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/mcp/protocol.ts test/mcp/protocol.test.ts
git commit -m "feat: add hand-written MCP JSON-RPC stdio protocol"
```

---

## Task 7: The tool registry

**Files:**
- Create: `src/mcp/tools.ts`
- Test: `test/mcp/tools.test.ts`

**Interfaces:**
- Consumes: `ToolDefinition`, `ToolRegistry` from `protocol.ts`; `createItem`, `updateItem`, `supersedeItem`, `linkItems`, `withRetry`, `MutationContext` from `mutate.ts`; `toolDescriptions`, `RESERVED_TOOLS`, `helpTopic`, `exampleItem` from `../help/index.ts`; `resolveWorkspace` from `workspace.ts`; `Store` from `store.ts`; `rebuild` from `rebuild.ts`; `renderItem` from `item.ts`; `matchesAnyGlob` from `paths.ts`; `enumError`, `missingFieldError`, `unknownIdError` from `teach.ts`
- Produces: `TOOL_NAMES: string[]`, `createRegistry(cwd: string): ToolRegistry`

Nine tools, exactly the set in spec §8 minus `ingest_document`, which is reserved and documented as such but not registered. Every handler passes `origin: 'agent'` and the schemas do **not** expose an `origin` field — an argument the model could set would make the trust boundary advisory.

Each call re-opens the store and rebuilds from Markdown before running. That is not laziness: the server is long-lived while the CLI, the hooks and a second Claude session all write to the same files, so a cached index would serve stale answers within minutes. A rebuild over a few thousand items is single-digit milliseconds and this is a tool call, not a hook.

- [ ] **Step 1: Write the failing test**

`test/mcp/tools.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TOOL_NAMES, createRegistry } from '../../src/mcp/tools.ts';
import { RESERVED_TOOLS, toolDescriptions } from '../../src/help/index.ts';
import { runCli } from '../../src/cli/index.ts';

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-tools-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

test('the registry exposes exactly the nine implemented tools', () => {
  assert.deepEqual([...TOOL_NAMES].sort(), [
    'create_item', 'get_item', 'link_items', 'list_drafts', 'mycontext_examples',
    'mycontext_help', 'query_items', 'supersede_item', 'update_item',
  ]);
});

test('there is no delete tool', () => {
  assert.equal(TOOL_NAMES.some((n) => /delete|remove|purge/.test(n)), false);
});

test('ingest_document is reserved, documented, and not registered', () => {
  assert.equal(TOOL_NAMES.includes('ingest_document'), false);
  assert.ok(RESERVED_TOOLS.includes('ingest_document'));
  assert.ok(toolDescriptions().ingest_document);
});

test('documentation and the registry describe exactly the same tools', () => {
  const documented = Object.keys(toolDescriptions()).sort();
  const known = [...TOOL_NAMES, ...RESERVED_TOOLS].sort();
  assert.deepEqual(documented, known);
});

test('every listed tool has a terse description and an object schema', () => {
  const cwd = project();
  for (const tool of createRegistry(cwd).list()) {
    assert.ok(tool.description.length > 0, tool.name);
    assert.ok(tool.description.length <= 200, `${tool.name}: ${tool.description.length} chars`);
    assert.equal(tool.inputSchema.type, 'object', tool.name);
  }
  rmSync(cwd, { recursive: true, force: true });
});

test('tools are listed in a deterministic order', () => {
  const cwd = project();
  const first = createRegistry(cwd).list().map((t) => t.name);
  const second = createRegistry(cwd).list().map((t) => t.name);
  assert.deepEqual(first, second);
  assert.deepEqual(first, [...first].sort());
  rmSync(cwd, { recursive: true, force: true });
});

test('create_item creates a draft because the caller is an agent', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  const text = registry.call('create_item', {
    type: 'constraint', title: 'Pool capped at 20', body: 'RDS permits 25.',
    scope: ['src/db/**'],
  });
  assert.match(text, /CONST-pool-capped-at-20/);
  assert.match(text, /draft/);
  rmSync(cwd, { recursive: true, force: true });
});

test('create_item ignores an origin argument', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap', origin: 'human' });
  assert.match(registry.call('get_item', { id: 'CONST-pool-cap' }), /status: draft/);
  assert.match(registry.call('get_item', { id: 'CONST-pool-cap' }), /origin: agent/);
  rmSync(cwd, { recursive: true, force: true });
});

test('create_item is idempotent across calls and across processes', () => {
  const cwd = project();
  createRegistry(cwd).call('create_item', { type: 'lesson', title: 'Locks matter' });
  const second = createRegistry(cwd).call('create_item', { type: 'lesson', title: 'Locks matter' });
  assert.match(second, /already captured as LESSON-locks-matter/);
  rmSync(cwd, { recursive: true, force: true });
});

test('create_item with a bad type returns a teaching message', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('create_item', { type: 'requirment', title: 'X' }),
    /closest match is "requirement"/,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('create_item with a non-array scope is corrected, not coerced silently', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('create_item', {
      type: 'constraint', title: 'X', scope: 'src/db/**',
    }),
    /"scope" must be an array of strings/,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('get_item returns the full Markdown and query_items finds it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', {
    type: 'lesson', title: 'Migrations need locks', body: 'Two deploys collided.',
    tags: ['database'],
  });

  assert.match(registry.call('get_item', { id: 'LESSON-migrations-need-locks' }), /Two deploys/);
  assert.match(registry.call('query_items', { type: 'lesson' }), /LESSON-migrations-need-locks/);
  assert.match(registry.call('query_items', { tag: 'database' }), /LESSON-migrations/);
  assert.match(registry.call('query_items', { text: 'deploys' }), /LESSON-migrations/);
  rmSync(cwd, { recursive: true, force: true });
});

test('query_items filters by the file path an item scopes', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap', scope: ['src/db/**'] });
  registry.call('create_item', { type: 'constraint', title: 'Token check', scope: ['src/api/**'] });

  const hits = registry.call('query_items', { path: 'src/db/writer.ts' });
  assert.match(hits, /CONST-pool-cap/);
  assert.equal(/CONST-token-check/.test(hits), false);
  rmSync(cwd, { recursive: true, force: true });
});

test('query_items accepts a Windows path and normalizes it', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap', scope: ['src/db/**'] });
  assert.match(registry.call('query_items', { path: 'src\\db\\writer.ts' }), /CONST-pool-cap/);
  rmSync(cwd, { recursive: true, force: true });
});

test('query_items says so when nothing matches', () => {
  const cwd = project();
  assert.match(createRegistry(cwd).call('query_items', { type: 'adr' }), /no items match/i);
  rmSync(cwd, { recursive: true, force: true });
});

test('query_items bounds its output and discloses the remainder', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  for (let i = 0; i < 30; i++) {
    registry.call('create_item', { type: 'lesson', title: `Lesson number ${i}` });
  }
  const out = registry.call('query_items', { type: 'lesson', limit: 5 });
  assert.equal(out.split('\n').filter((l) => l.startsWith('LESSON-')).length, 5);
  assert.match(out, /25 more/);
  rmSync(cwd, { recursive: true, force: true });
});

test('list_drafts is the review queue', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  registry.call('create_item', { type: 'lesson', title: 'Locks matter' });

  const drafts = registry.call('list_drafts', {});
  assert.match(drafts, /CONST-pool-cap/);
  assert.equal(/LESSON-locks-matter/.test(drafts), false);
  rmSync(cwd, { recursive: true, force: true });
});

test('supersede_item retires without deleting', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool capped at 10' });
  registry.call('create_item', { type: 'constraint', title: 'Pool capped at 20' });

  const text = registry.call('supersede_item', {
    id: 'CONST-pool-capped-at-10', by: 'CONST-pool-capped-at-20', reason: 'RDS resized.',
  });
  assert.match(text, /superseded by CONST-pool-capped-at-20/);
  assert.match(registry.call('get_item', { id: 'CONST-pool-capped-at-10' }), /status: superseded/);
  rmSync(cwd, { recursive: true, force: true });
});

test('update_item cannot change the status of a normative item', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => registry.call('update_item', { id: 'CONST-pool-cap', status: 'active' }),
    /cannot change the status of a normative item/i,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('link_items records a relation', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  registry.call('create_item', { type: 'adr', title: 'Managed Postgres' });
  registry.call('link_items', {
    from: 'CONST-pool-cap', to: 'ADR-managed-postgres', relation: 'derived_from',
  });
  assert.match(
    registry.call('get_item', { id: 'CONST-pool-cap' }),
    /- derived_from \[\[ADR-managed-postgres\]\]/,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('get_item on an unknown id suggests the nearest', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  registry.call('create_item', { type: 'constraint', title: 'Pool cap' });
  assert.throws(
    () => registry.call('get_item', { id: 'CONST-pool-capp' }),
    /closest match is "CONST-pool-cap"/,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('mycontext_help and mycontext_examples answer from the topic files', () => {
  const cwd = project();
  const registry = createRegistry(cwd);
  assert.match(registry.call('mycontext_help', { topic: 'scope' }), /Too broad/i);
  assert.match(registry.call('mycontext_examples', { type: 'constraint' }), /type: constraint/);
  assert.throws(() => registry.call('mycontext_help', { topic: 'scopes' }), /closest match is "scope"/);
  rmSync(cwd, { recursive: true, force: true });
});

test('a missing required argument is named', () => {
  const cwd = project();
  assert.throws(
    () => createRegistry(cwd).call('create_item', { type: 'constraint' }),
    /create_item requires "title"/,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('calling a tool outside a workspace explains how to create one', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-bare-'));
  assert.throws(
    () => createRegistry(cwd).call('create_item', { type: 'constraint', title: 'X' }),
    /mycontext init/,
  );
  rmSync(cwd, { recursive: true, force: true });
});

test('help works without a workspace, since that is when it is most needed', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-bare-'));
  assert.match(createRegistry(cwd).call('mycontext_help', { topic: 'categories' }), /constraint/);
  rmSync(cwd, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/mcp/tools.test.ts`
Expected: FAIL — `Cannot find module '../../src/mcp/tools.ts'`

- [ ] **Step 3: Implement**

`src/mcp/tools.ts`:

```typescript
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
    withRetry(() => rebuild(store, {
      project: ws.projectRoot ?? undefined,
      global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined,
    }));
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
    run: (cwd, args) => withWorkspace(cwd, (ctx) => supersedeItem(ctx, {
      id: str(args, 'id', 'supersede_item'),
      by: str(args, 'by', 'supersede_item'),
      reason: optStr(args, 'reason'),
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
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/mcp/tools.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/mcp/tools.ts test/mcp/tools.test.ts
git commit -m "feat: add the nine-tool MCP registry over the mutation layer"
```

---

## Task 8: The server entry point and plugin registration

**Files:**
- Create: `src/mcp/server.ts`, `.mcp.json`
- Test: `test/mcp/server-e2e.test.ts`

**Interfaces:**
- Consumes: `createSession`, `serveStdio` from `protocol.ts`; `createRegistry` from `tools.ts`
- Produces: `resolveServerCwd(env: NodeJS.ProcessEnv, fallback: string): string`; a module entry point that serves MCP on stdio

This is the task where the protocol meets a real process, so it is tested by spawning the server and speaking to it over pipes. Unit tests cannot catch the failure that matters here — a stray byte on stdout corrupting the stream — because that byte comes from module loading, not from the code under test.

- [ ] **Step 1: Write the failing test**

`test/mcp/server-e2e.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { resolveServerCwd } from '../../src/mcp/server.ts';

const SERVER = fileURLToPath(new URL('../../src/mcp/server.ts', import.meta.url));

interface Harness {
  send(message: unknown): void;
  responses(count: number): Promise<Record<string, unknown>[]>;
  stderr(): string;
  stop(): void;
}

function start(cwd: string): Harness {
  const child: ChildProcessWithoutNullStreams = spawn(process.execPath, [SERVER], {
    cwd, stdio: ['pipe', 'pipe', 'pipe'],
  });

  let out = '';
  let err = '';
  const seen: Record<string, unknown>[] = [];
  const waiters: (() => void)[] = [];

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    out += chunk;
    for (;;) {
      const newline = out.indexOf('\n');
      if (newline < 0) break;
      const line = out.slice(0, newline);
      out = out.slice(newline + 1);
      if (line.trim() !== '') seen.push(JSON.parse(line) as Record<string, unknown>);
    }
    for (const notify of waiters.splice(0)) notify();
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => { err += chunk; });

  return {
    send: (message) => child.stdin.write(JSON.stringify(message) + '\n'),
    async responses(count) {
      const deadline = Date.now() + 15_000;
      while (seen.length < count && Date.now() < deadline) {
        await new Promise<void>((resolve) => {
          waiters.push(resolve);
          setTimeout(resolve, 100);
        });
      }
      assert.ok(seen.length >= count, `expected ${count} responses, got ${seen.length}; stderr: ${err}`);
      return seen.slice(0, count);
    },
    stderr: () => err,
    stop: () => { child.stdin.end(); child.kill(); },
  };
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-e2e-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

test('resolveServerCwd prefers CLAUDE_PROJECT_DIR', () => {
  assert.equal(resolveServerCwd({ CLAUDE_PROJECT_DIR: '/repo' }, '/elsewhere'), '/repo');
  assert.equal(resolveServerCwd({}, '/elsewhere'), '/elsewhere');
  assert.equal(resolveServerCwd({ CLAUDE_PROJECT_DIR: '' }, '/elsewhere'), '/elsewhere');
});

test('a legacy client can initialize, list and call tools over stdio', async () => {
  const cwd = project();
  const harness = start(cwd);

  harness.send({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: {
      protocolVersion: '2025-06-18', capabilities: {},
      clientInfo: { name: 'test', version: '1' },
    },
  });
  harness.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  harness.send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  harness.send({
    jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: {
      name: 'create_item',
      arguments: { type: 'constraint', title: 'Pool capped at 20', scope: ['src/db/**'] },
    },
  });

  const [init, list, call] = await harness.responses(3);

  assert.equal((init.result as Record<string, unknown>).protocolVersion, '2025-06-18');
  const tools = (list.result as { tools: { name: string }[] }).tools;
  assert.equal(tools.length, 9);
  assert.ok(tools.some((t) => t.name === 'create_item'));

  const content = (call.result as { content: { text: string }[] }).content;
  assert.match(content[0].text, /CONST-pool-capped-at-20/);
  assert.match(content[0].text, /draft/);

  harness.stop();
  rmSync(cwd, { recursive: true, force: true });
});

test('a modern client works without any handshake', async () => {
  const cwd = project();
  const harness = start(cwd);

  const meta = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' };
  harness.send({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: meta } });
  harness.send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: { _meta: meta } });

  const [discover, list] = await harness.responses(2);
  const discovered = discover.result as Record<string, unknown>;
  assert.ok((discovered.supportedVersions as string[]).includes('2026-07-28'));
  assert.equal((list.result as Record<string, unknown>).resultType, 'complete');

  harness.stop();
  rmSync(cwd, { recursive: true, force: true });
});

test('a rejected call arrives as content the model can read', async () => {
  const cwd = project();
  const harness = start(cwd);

  harness.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  harness.send({
    jsonrpc: '2.0', id: 2, method: 'tools/call',
    params: { name: 'create_item', arguments: { type: 'requirment', title: 'X' } },
  });

  const [, call] = await harness.responses(2);
  const result = call.result as { isError: boolean; content: { text: string }[] };
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /closest match is "requirement"/);

  harness.stop();
  rmSync(cwd, { recursive: true, force: true });
});

test('nothing but MCP messages reaches stdout', async () => {
  const cwd = project();
  const harness = start(cwd);
  harness.send({ jsonrpc: '2.0', id: 1, method: 'ping' });
  const [pong] = await harness.responses(1);
  assert.deepEqual(pong, { jsonrpc: '2.0', id: 1, result: {} });
  harness.stop();
  rmSync(cwd, { recursive: true, force: true });
});

test('the server survives a workspace it cannot use', async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-bare-'));
  const harness = start(cwd);

  harness.send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  harness.send({
    jsonrpc: '2.0', id: 2, method: 'tools/call',
    params: { name: 'create_item', arguments: { type: 'constraint', title: 'X' } },
  });

  const [list, call] = await harness.responses(2);
  assert.equal((list.result as { tools: unknown[] }).tools.length, 9);
  const result = call.result as { isError: boolean; content: { text: string }[] };
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /mycontext init/);

  harness.stop();
  rmSync(cwd, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/mcp/server-e2e.test.ts`
Expected: FAIL — `Cannot find module '../../src/mcp/server.ts'`

- [ ] **Step 3: Implement the entry point**

`src/mcp/server.ts`:

```typescript
import { createSession, serveStdio } from './protocol.ts';
import { createRegistry } from './tools.ts';

/**
 * Where to look for `.my_context`. Claude Code sets CLAUDE_PROJECT_DIR for
 * plugin processes; process.cwd() is the fallback when the server is launched
 * by hand, which is also how the tests drive it.
 */
export function resolveServerCwd(env: NodeJS.ProcessEnv, fallback: string): string {
  const configured = env.CLAUDE_PROJECT_DIR;
  return configured && configured !== '' ? configured : fallback;
}

if (import.meta.filename === process.argv[1]) {
  const cwd = resolveServerCwd(process.env, process.cwd());
  // Any throw here must not print to stdout — stderr only, per the stdio
  // transport rules. A dead server is recoverable; a corrupt stream is not.
  try {
    serveStdio(process.stdin, process.stdout, createSession(createRegistry(cwd)));
    process.stdin.resume();
  } catch (err) {
    process.stderr.write(
      `my_context: MCP server failed to start: ` +
      `${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exitCode = 1;
  }
}
```

- [ ] **Step 4: Register the server with the plugin**

`.mcp.json` at the repository root:

```json
{
  "mcpServers": {
    "mycontext": {
      "type": "stdio",
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/src/mcp/server.ts"]
    }
  }
}
```

`command` is a bare `node` and the script path is a separate argument, so no shell is involved and no quoting rule differs between platforms — the same constraint that shaped the hook command in Plan 1 (spec §5.4: no shell-specific assumptions).

- [ ] **Step 5: Verify the registration in a real session**

Run:

```bash
node src/cli/index.ts init
claude --plugin-dir .
```

In the session, run `/mcp` and confirm a `mycontext` server is listed with nine tools. Then ask Claude to call `mycontext_help` with topic `scope` and confirm the topic text comes back.

If the server is not listed, move the `mcpServers` block from `.mcp.json` into `.claude-plugin/plugin.json` as a top-level `"mcpServers"` key, restart, and check again. Record whichever one works as a `decision` item in my_context — this is exactly the kind of fact the project exists to hold, and it is the second dogfooding entry after Plan 1's hook-shell finding.

- [ ] **Step 6: Run the whole suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/mcp/server.ts .mcp.json test/mcp/server-e2e.test.ts
git commit -m "feat: serve the MCP tool surface over stdio and register it with the plugin"
```

---

## Task 9: The live-capture nudge

**Files:**
- Create: `src/hooks/post-tool-use.ts`
- Modify: `hooks/hooks.json`
- Test: `test/hooks/post-tool-use.test.ts`

**Interfaces:**
- Consumes: `resolveWorkspace` from `workspace.ts`; `matchesAnyGlob`, `relPosix` from `paths.ts`
- Produces:
  - `HookInput { tool_name?: string; tool_input?: { file_path?: string }; cwd?: string }`
  - `nudgeFor(input: HookInput, fallbackCwd: string): string` — the additionalContext text, or `''`
  - `buildOutput(text: string): string` — the JSON line, or `''`
  - A module entry point that reads stdin, prints, and exits 0

Spec §7.3: the nudge fires exactly when the content exists and costs nothing otherwise. Two properties keep it from becoming noise the user disables:

- **It is scoped to `watchedDocs`.** An edit to `src/db/writer.ts` produces nothing at all.
- **It is ~30 tokens and it names the file.** A generic "remember to capture things" reminder on every edit is the fastest route to a disabled hook.

Verified hook contract (Claude Code documentation, PostToolUse): stdin carries `{ session_id, cwd, hook_event_name, tool_name, tool_input, tool_response, … }`; stdout takes `{ "hookSpecificOutput": { "hookEventName": "PostToolUse", "additionalContext": "…" } }` with exit 0, and `additionalContext` is capped at 10,000 characters. The matcher filters on tool name and accepts `Edit|Write` alternation.

- [ ] **Step 1: Write the failing test**

`test/hooks/post-tool-use.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildOutput, nudgeFor } from '../../src/hooks/post-tool-use.ts';
import { runCli } from '../../src/cli/index.ts';

function project(watchedDocs?: string[]): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-nudge-'));
  runCli(['init'], cwd, () => {});
  if (watchedDocs) {
    writeFileSync(
      path.join(cwd, '.my_context', 'config.json'),
      JSON.stringify({ profile: 'standard', watchedDocs }, null, 2) + '\n',
    );
  }
  return cwd;
}

test('a watched document produces a nudge naming the file', () => {
  const cwd = project(['docs/prd/**']);
  const text = nudgeFor({
    tool_name: 'Write',
    tool_input: { file_path: path.join(cwd, 'docs', 'prd', 'auth.md') },
    cwd,
  }, cwd);

  assert.match(text, /docs\/prd\/auth\.md/);
  assert.match(text, /create_item/);
  assert.ok(text.length < 320, `nudge is ${text.length} chars — budget is ~30 tokens`);
  rmSync(cwd, { recursive: true, force: true });
});

test('an unwatched file produces nothing', () => {
  const cwd = project(['docs/prd/**']);
  const text = nudgeFor({
    tool_name: 'Edit',
    tool_input: { file_path: path.join(cwd, 'src', 'db', 'writer.ts') },
    cwd,
  }, cwd);
  assert.equal(text, '');
  rmSync(cwd, { recursive: true, force: true });
});

test('a Windows-style path still matches a POSIX glob', () => {
  const cwd = project(['docs/prd/**']);
  const text = nudgeFor({
    tool_name: 'Write',
    tool_input: { file_path: `${cwd}\\docs\\prd\\auth.md` },
    cwd,
  }, cwd);
  assert.match(text, /docs\/prd\/auth\.md/);
  rmSync(cwd, { recursive: true, force: true });
});

test('a file outside the repository produces nothing', () => {
  const cwd = project(['docs/prd/**']);
  const outside = path.join(tmpdir(), 'docs', 'prd', 'elsewhere.md');
  assert.equal(nudgeFor({ tool_name: 'Write', tool_input: { file_path: outside }, cwd }, cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('my_context items never nudge about themselves', () => {
  const cwd = project(['**/*.md']);
  const item = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-a.md');
  assert.equal(nudgeFor({ tool_name: 'Write', tool_input: { file_path: item }, cwd }, cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('a tool other than Write or Edit produces nothing', () => {
  const cwd = project(['docs/prd/**']);
  const file = path.join(cwd, 'docs', 'prd', 'auth.md');
  assert.equal(nudgeFor({ tool_name: 'Read', tool_input: { file_path: file }, cwd }, cwd), '');
  assert.equal(nudgeFor({ tool_name: 'Bash', tool_input: {}, cwd }, cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('no workspace, malformed input and a missing path all fail open', () => {
  const bare = mkdtempSync(path.join(tmpdir(), 'myctx-bare-'));
  assert.equal(nudgeFor({
    tool_name: 'Write', tool_input: { file_path: path.join(bare, 'docs', 'prd', 'a.md') }, cwd: bare,
  }, bare), '');
  assert.equal(nudgeFor({}, bare), '');
  assert.equal(nudgeFor({ tool_name: 'Write', tool_input: {} }, bare), '');
  rmSync(bare, { recursive: true, force: true });
});

test('a corrupt config fails open rather than throwing', () => {
  const cwd = project();
  writeFileSync(path.join(cwd, '.my_context', 'config.json'), '{ not json');
  assert.equal(nudgeFor({
    tool_name: 'Write', tool_input: { file_path: path.join(cwd, 'docs', 'prd', 'a.md') }, cwd,
  }, cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('the default watchedDocs cover spec and plan directories', () => {
  const cwd = project();
  const file = path.join(cwd, 'docs', 'superpowers', 'specs', '2026-08-12-design.md');
  assert.match(nudgeFor({ tool_name: 'Write', tool_input: { file_path: file }, cwd }, cwd), /specs/);
  rmSync(cwd, { recursive: true, force: true });
});

test('buildOutput emits the documented hook JSON on one line', () => {
  const line = buildOutput('You edited docs/prd/auth.md.');
  const parsed = JSON.parse(line) as {
    hookSpecificOutput: { hookEventName: string; additionalContext: string };
  };
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'PostToolUse');
  assert.equal(parsed.hookSpecificOutput.additionalContext, 'You edited docs/prd/auth.md.');
  assert.equal(line.includes('\n'), false);
});

test('buildOutput emits nothing for an empty nudge', () => {
  assert.equal(buildOutput(''), '');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/hooks/post-tool-use.test.ts`
Expected: FAIL — `Cannot find module '../../src/hooks/post-tool-use.ts'`

- [ ] **Step 3: Implement**

`src/hooks/post-tool-use.ts`:

```typescript
import path from 'node:path';
import { matchesAnyGlob, relPosix } from '../core/paths.ts';
import { resolveWorkspace } from '../core/workspace.ts';

export interface HookInput {
  tool_name?: string;
  tool_input?: { file_path?: string };
  cwd?: string;
}

const WRITING_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

/**
 * The nudge text, or '' when this edit is none of our business. Returns rather
 * than throws on every failure path: a hook that breaks an edit is worse than
 * a hook that says nothing (spec §6.5).
 */
export function nudgeFor(input: HookInput, fallbackCwd: string): string {
  try {
    if (!input.tool_name || !WRITING_TOOLS.has(input.tool_name)) return '';

    const filePath = input.tool_input?.file_path;
    if (!filePath) return '';

    const cwd = input.cwd && input.cwd !== '' ? input.cwd : fallbackCwd;
    const ws = resolveWorkspace(cwd);
    if (!ws.projectRoot) return '';

    // watchedDocs globs are repo-relative, and projectRoot is `<repo>/.my_context`.
    const repoRoot = path.dirname(ws.projectRoot);
    const relative = relPosix(repoRoot, filePath);
    if (relative === '' || relative.startsWith('..')) return '';
    if (relative.startsWith('.my_context/')) return '';
    if (!matchesAnyGlob(relative, ws.config.watchedDocs)) return '';

    return (
      `You edited ${relative}. If it established a new requirement, decision or ` +
      `constraint, capture it now with mycontext create_item ` +
      `(source_file: "${relative}"). Skip if nothing new was decided.`
    );
  } catch {
    return '';
  }
}

export function buildOutput(text: string): string {
  if (text === '') return '';
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text },
  });
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

if (import.meta.filename === process.argv[1]) {
  const timer = setTimeout(() => process.exit(0), 2000);
  timer.unref();

  readStdin()
    .then((raw) => {
      let parsed: HookInput = {};
      try {
        parsed = JSON.parse(raw) as HookInput;
      } catch {
        return;
      }
      const line = buildOutput(nudgeFor(parsed, process.cwd()));
      if (line) process.stdout.write(line + '\n');
    })
    .catch(() => { /* fail open */ })
    .finally(() => { process.exitCode = 0; });
}
```

- [ ] **Step 4: Register the hook**

Add to `hooks/hooks.json`, as a sibling of the existing `SessionStart` key:

```json
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/src/hooks/post-tool-use.ts\"",
            "timeout": 5
          }
        ]
      }
    ]
```

The matcher narrows by tool name; the glob check inside the hook narrows by path. Both are needed — the matcher saves a process spawn on `Bash`, the glob saves the model's attention on `src/**`.

- [ ] **Step 5: Verify the hook end to end from a shell**

Run:

```bash
node src/cli/index.ts init
mkdir -p docs/prd
echo '{"tool_name":"Write","tool_input":{"file_path":"docs/prd/auth.md"},"cwd":"."}' \
  | node src/hooks/post-tool-use.ts
echo '{"tool_name":"Write","tool_input":{"file_path":"src/db/writer.ts"},"cwd":"."}' \
  | node src/hooks/post-tool-use.ts
```

Expected: the first prints one line of JSON containing `additionalContext`; the second prints nothing. Both exit 0.

- [ ] **Step 6: Run the whole suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/hooks/post-tool-use.ts hooks/hooks.json test/hooks/post-tool-use.test.ts
git commit -m "feat: nudge Claude to capture requirements when a watched doc changes"
```

---

## Task 10: Genuinely concurrent writers

**Files:**
- Create: `test/fixtures/concurrent-writer.ts`
- Modify: `src/core/rebuild.ts` (`writeItem` temp filename)
- Test: `test/core/concurrency.test.ts`

**Interfaces:**
- Consumes: `createRegistry` from `../mcp/tools.ts`
- Produces: no new exports; `writeItem(root: string, item: Item): string` keeps its signature

Spec §10 asks for this test *"with genuinely concurrent writers"*, and Plan 1 deliberately deferred it because a single-process CLI has nothing to contend with. That changed in this plan: the MCP server, the PostToolUse hook, the CLI and a second Claude session can all write the same `.index.db` and the same `items/` tree at the same time. Two processes writing to one SQLite file is the real scenario, so the test spawns real processes; a test that awaits promises in one process proves nothing about file locks.

Two defects this exposes, both of which are only visible under real concurrency:

- **`busy_timeout` alone is not enough** when a writer holds the lock longer than the timeout. `withRetry` from Task 2 covers the tail; this test is what proves it.
- **`${target}.tmp-${process.pid}` is not unique** when one process writes the same item twice concurrently, and on Windows a rename onto a path another handle still holds fails outright. The fix is a per-write counter, and the test below is what motivates it.

- [ ] **Step 1: Write the child-process writer**

`test/fixtures/concurrent-writer.ts`:

```typescript
/**
 * Argv: <cwd> <label> <count>
 * Creates <count> items through the real MCP tool path, exactly as a second
 * Claude session would. Exits 0 on success, 1 with a message on stderr on
 * failure, so the parent can report which writer lost.
 */
import { createRegistry } from '../../src/mcp/tools.ts';

const [cwd, label, countArg] = process.argv.slice(2);
const count = Number(countArg);

try {
  const registry = createRegistry(cwd);
  for (let i = 0; i < count; i++) {
    registry.call('create_item', {
      type: 'lesson',
      title: label === 'same' ? 'A contended lesson' : `Lesson ${label} ${i}`,
      body: 'Written under contention.',
    });
  }
  process.exitCode = 0;
} catch (err) {
  process.stderr.write(`${label}: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
}
```

- [ ] **Step 2: Write the failing test**

`test/core/concurrency.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { Store } from '../../src/core/store.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';

const WRITER = fileURLToPath(new URL('../fixtures/concurrent-writer.ts', import.meta.url));

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-conc-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function writer(cwd: string, label: string, count: number): Promise<{ code: number; err: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [WRITER, cwd, label, String(count)], {
      cwd, stdio: ['ignore', 'ignore', 'pipe'],
    });
    let err = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => { err += chunk; });
    child.on('close', (code) => resolve({ code: code ?? 1, err }));
  });
}

/** Read the corpus from Markdown — the source of truth, not the index. */
function itemsOnDisk(cwd: string): string[] {
  const ws = resolveWorkspace(cwd);
  const store = Store.open(':memory:');
  rebuild(store, { project: ws.projectRoot ?? undefined });
  const ids = store.all().map((i) => i.id);
  store.close();
  return ids;
}

function strayTempFiles(cwd: string): string[] {
  const dir = path.join(cwd, '.my_context', 'items', 'lesson');
  try {
    return readdirSync(dir).filter((name) => name.includes('.tmp-'));
  } catch {
    return [];
  }
}

test('eight concurrent writers all land, none lost', async () => {
  const cwd = project();
  const results = await Promise.all(
    Array.from({ length: 8 }, (_unused, i) => writer(cwd, `w${i}`, 5)),
  );

  for (const [i, result] of results.entries()) {
    assert.equal(result.code, 0, `writer ${i} failed: ${result.err}`);
  }
  assert.equal(itemsOnDisk(cwd).length, 40);
  assert.deepEqual(strayTempFiles(cwd), []);

  rmSync(cwd, { recursive: true, force: true });
});

test('the index agrees with the files after concurrent writes', async () => {
  const cwd = project();
  await Promise.all(Array.from({ length: 6 }, (_unused, i) => writer(cwd, `x${i}`, 4)));

  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  const indexed = store.all().map((i) => i.id).sort();
  store.close();

  assert.deepEqual(indexed, itemsOnDisk(cwd).sort());
  rmSync(cwd, { recursive: true, force: true });
});

test('concurrent writers racing on identical content produce one item', async () => {
  const cwd = project();
  const results = await Promise.all(
    Array.from({ length: 8 }, () => writer(cwd, 'same', 3)),
  );

  for (const result of results) assert.equal(result.code, 0, result.err);
  assert.deepEqual(itemsOnDisk(cwd), ['LESSON-a-contended-lesson']);
  assert.deepEqual(strayTempFiles(cwd), []);

  rmSync(cwd, { recursive: true, force: true });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/core/concurrency.test.ts`
Expected: FAIL — writers exit 1 with `SQLITE_BUSY`-family messages, or a stray `.tmp-<pid>` file survives a rename collision. Record which failure you actually see before fixing it; the fix in Step 4 addresses the temp-file half and Task 2's `withRetry` the lock half.

- [ ] **Step 4: Make the temp filename unique per write**

In `src/core/rebuild.ts`, add a module-level counter and use it in `writeItem`:

```typescript
/** Distinguishes concurrent writes from the same process; pid alone does not. */
let writeCounter = 0;

export function writeItem(root: string, item: Item): string {
  const target = path.join(root, ...item.filePath.split('/'));
  mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp-${process.pid}-${writeCounter++}`;
  try {
    writeFileSync(tmp, renderItem(item), 'utf8');
    renameSync(tmp, target);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
  return target;
}
```

`renameSync` over an existing file is atomic on both platforms, so the loser of a race writes identical bytes over identical bytes rather than corrupting anything. Nothing else in `writeItem` changes.

- [ ] **Step 5: Run the concurrency test and the full suite**

Run: `node --test test/core/concurrency.test.ts && npm test && npm run typecheck`
Expected: PASS. If a writer still fails with a lock error, raise `withRetry`'s `attempts` in `src/core/mutate.ts` from 5 to 8 rather than raising `busy_timeout` — a longer timeout blocks the hook path too, and the hook has a latency ceiling.

- [ ] **Step 6: Commit**

```bash
git add src/core/rebuild.ts test/fixtures/concurrent-writer.ts test/core/concurrency.test.ts
git commit -m "test: prove concurrent writers from separate processes all land"
```

---

## Verification

After Task 10, confirm the plan's goal is met:

```bash
npm test                 # every suite passes on this platform
npm run typecheck        # no type errors
```

Confirm the test-file count in the output matches the number of files under `test/` — a lower count means the glob was expanded by the shell rather than by Node.

Then exercise the surface the way Claude will:

```bash
node src/cli/index.ts init
node src/cli/index.ts help scope
node src/cli/index.ts examples constraint
claude --plugin-dir .
```

In the session:

1. `/mcp` lists `mycontext` with nine tools and no `delete_item`.
2. Ask Claude to record a constraint. Confirm it lands as a **draft** — `node src/cli/index.ts list` shows `draft`, and a new session does not inject it.
3. Promote it by editing `status: active` in the file, start a new session, and confirm it is injected.
4. Edit a file under `docs/prd/` and confirm the nudge appears in the transcript.
5. Ask Claude to create an item with a deliberately wrong type (`requirment`) and confirm it self-corrects from the returned message without further prompting. This is the single best signal that the teaching-error design works.

Finally, dogfood: record this plan's own decisions in my_context — the dual-era MCP server, the hand-written protocol, the per-call rebuild, and whichever of `.mcp.json` or `plugin.json` actually registered the server.

## What this plan does not cover

Deliberately deferred, so the boundaries are explicit:

- **Plan 2 owns the rest of the injection engine:** JIT activation via `PreToolUse`, the session ledger, the `PreCompact` snapshot and restore, and the `.my_context/` write-deny. This plan's tools write freely to `.my_context/` because the deny hook does not exist yet; when it does, the MCP server writes through the filesystem directly and is unaffected by a `PreToolUse` decision, which applies to Claude's own file tools.
- **Plan 4 owns batch and generative work:** `ingest_document` (reserved here, documented as reserved, not registered), lesson→rule generation with its approval gate, `doctor`, and decay reporting. Plan 4 consumes `createItem`, `updateItem`, `supersedeItem` and `linkItems` from `src/core/mutate.ts` unchanged, and inherits the trust model by construction.
- **`mycontext review`**, the promotion command, is referenced by the help text and by error messages but is **not implemented here**. It is a human-facing CLI command over the draft queue; `list_drafts` is its read half and exists. Until it ships, promotion is editing `status:` in the file, which is legitimate — Markdown is the source of truth.

Three spec requirements are consciously absent, so they are not mistaken for oversights:

- **Checksum drift detection (spec §7.3).** `source_checksum` is written as `null` and no item is ever flagged `source_drift`. `createItem` refuses to duplicate at a known anchor and points the caller at `update_item`, which prevents the silent-duplicate failure, but it does not detect a source document that was reworded after capture. Detection requires reading the source document and comparing anchor content, which is ingestion machinery — Plan 4.
- **A `PostToolUse` latency assertion.** Plan 1 asserts a latency ceiling on `SessionStart` because it reads the whole corpus. The nudge reads only the config and one glob list, so there is nothing to regress; the assertion would test Node's startup time, not this code.
- **FTS5 search.** `query_items` filters with `String.includes` over the in-memory corpus. At 5,000 items that is under a millisecond, and it keeps the query path identical to the selector's. If the corpus reaches a size where it matters, the fix is an FTS5 table in `core/store`, not a change to the tool surface.
