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

<!-- CONTINUE -->
