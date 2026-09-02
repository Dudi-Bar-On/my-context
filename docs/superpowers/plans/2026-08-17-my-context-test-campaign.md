# my-context Test Campaign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exercise every feature and option of the `mycontext` plugin v1.0.0, audit its documentation against actual behaviour, and produce a developer-facing findings report, a coverage matrix, and a new-user tutorial.

**Architecture:** A small Node harness drives the plugin's three real surfaces — the CLI as a subprocess, the MCP server as a newline-delimited JSON-RPC peer over stdio, and the four hook binaries via synthetic stdin payloads — recording one JSONL evidence record per case. Sweep tasks feed case tables to the harness; audit tasks compare recorded behaviour against README claims. Nothing is asserted from memory: every statement in the deliverables cites an evidence record id.

**Tech Stack:** Node 24 (built-in `node:test`, `node:child_process`, no dependencies — matching the plugin's own zero-dependency constraint), JSONL evidence files, Markdown deliverables.

## Global Constraints

- **Node `>=24.0.0`.** Verified v24.14.0. The plugin executes `.ts` sources directly via native type stripping; there is no build step and no `dist/`.
- **Zero runtime dependencies in the harness.** Use only the Node standard library. Adding a dependency would make the harness harder to run than the thing it tests.
- **Never write inside `my-context/.my_context/`.** That is the author's dogfooded corpus. Every case runs in a disposable workspace under `harness/.scratch/`.
- **CLI invocation is `node "<REPO>/src/cli/index.ts" <args>`** where `REPO` = `D:\Users\UserC\source\repos\test_mycontext_plugin\my-context`. Do not rely on `npm link` or a `mycontext` binary being on PATH.
- **MCP invocation is `node "<REPO>/src/mcp/server.ts"`** with `CLAUDE_PROJECT_DIR` set to the workspace, speaking newline-delimited JSON-RPC 2.0 on stdio.
- **stdout and stderr are captured separately, never merged.** Finding F1 exists because they were conflated; a harness that merges them cannot reproduce it.
- **Exit codes are first-class results.** `mycontext` bare exits 1; `mycontext --help` exits 0; only `status` and `doctor` exit non-zero on unrelated corpus load errors.
- **Rendering is pinned:** set `MYCONTEXT_WIDTH=100` and `MYCONTEXT_ASCII=1` for every case unless the case is specifically testing rendering. Table assertions must not depend on the terminal.
- **Known-red baseline is 11 tests** in `test/hooks/hook-binaries-e2e.test.ts` (9) and `test/mcp/server-e2e.test.ts` (2), all caused by `node:sqlite`'s `ExperimentalWarning` on stderr. Any other failure is new.
- **Every finding carries its environment scope.** Results are Windows 11 / Node 24.14.0. We do not claim Linux or macOS behaviour.
- **Every finding cites an evidence record id.** A claim that cannot be traced to a captured run is dropped, not softened.

---

## File Structure

| File | Responsibility |
|---|---|
| `harness/lib/workspace.mjs` | Create and destroy disposable `mycontext` workspaces |
| `harness/lib/run.mjs` | Run one subprocess case; capture stdout, stderr, exit code, duration |
| `harness/lib/mcp.mjs` | JSON-RPC stdio client: handshake, `tools/list`, `tools/call` |
| `harness/lib/hooks.mjs` | Drive the four hook binaries with synthetic payloads |
| `harness/lib/evidence.mjs` | Append and query JSONL evidence records |
| `harness/cases/cli-*.mjs` | Case tables, one module per CLI batch |
| `harness/cases/mcp.mjs` | Case table for the 14 MCP tools |
| `harness/cases/hooks.mjs` | Case table for the 4 hooks |
| `harness/cases/config.mjs` | Case table for config keys, profiles, 21 categories |
| `harness/sweep.mjs` | Entry point: runs a named case table, writes evidence |
| `harness/baseline.mjs` | Runs the plugin's own suite, diffs against the pinned known-red set |
| `harness/self-test/*.test.mjs` | Harness self-tests (`node --test`) |
| `harness/evidence/*.jsonl` | Captured evidence, one file per surface |
| `reports/FINDINGS.md` | Developer-facing defect report |
| `reports/COVERAGE.md` | Two-axis coverage matrix |
| `reports/TUTORIAL.md` | Quickstart walkthrough + reference appendix |

Harness code is split by responsibility rather than by surface, so a sweep task only has to write a case table — never plumbing.

---

## Task 1: Disposable workspace module

**Files:**
- Create: `harness/lib/workspace.mjs`
- Test: `harness/self-test/workspace.test.mjs`

**Interfaces:**
- Consumes: nothing
- Produces: `REPO` (string, absolute path to the plugin clone), `createWorkspace(): Promise<string>` returning an absolute path to a fresh initialised workspace, `destroyWorkspace(dir: string): Promise<void>`, `SCRATCH` (string, absolute path to `harness/.scratch`)

- [ ] **Step 1: Write the failing test**

```javascript
// harness/self-test/workspace.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createWorkspace, destroyWorkspace, REPO } from '../lib/workspace.mjs';

test('createWorkspace returns an initialised, isolated workspace', async () => {
  const ws = await createWorkspace();
  assert.ok(existsSync(join(ws, '.my_context', 'config.json')), 'config.json exists');
  assert.ok(existsSync(join(ws, '.my_context', 'items')), 'items/ exists');
  assert.ok(!ws.startsWith(REPO), 'workspace must live outside the plugin clone');
  await destroyWorkspace(ws);
  assert.ok(!existsSync(ws), 'workspace removed');
});

test('two workspaces are independent', async () => {
  const a = await createWorkspace();
  const b = await createWorkspace();
  assert.notEqual(a, b);
  await destroyWorkspace(a);
  assert.ok(existsSync(b), 'destroying one must not affect the other');
  await destroyWorkspace(b);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test harness/self-test/workspace.test.mjs`
Expected: FAIL — `Cannot find module '../lib/workspace.mjs'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// harness/lib/workspace.mjs
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const here = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the plugin clone under test. */
export const REPO = join(here, '..', '..', 'my-context');

/** Where disposable workspaces live. Never inside REPO. */
export const SCRATCH = join(here, '..', '.scratch');

export const CLI = join(REPO, 'src', 'cli', 'index.ts');

export async function createWorkspace() {
  await mkdir(SCRATCH, { recursive: true });
  const ws = await mkdtemp(join(SCRATCH, 'ws-'));
  await execFileAsync(process.execPath, [CLI, 'init'], { cwd: ws });
  return ws;
}

export async function destroyWorkspace(dir) {
  if (!dir.startsWith(SCRATCH)) {
    throw new Error(`refusing to remove a path outside SCRATCH: ${dir}`);
  }
  await rm(dir, { recursive: true, force: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test harness/self-test/workspace.test.mjs`
Expected: PASS, 2/2

- [ ] **Step 5: Commit**

```bash
git add harness/lib/workspace.mjs harness/self-test/workspace.test.mjs
git commit -m "feat(harness): disposable mycontext workspaces"
```

---

## Task 2: Case runner with separated streams

**Files:**
- Create: `harness/lib/run.mjs`
- Test: `harness/self-test/run.test.mjs`

**Interfaces:**
- Consumes: `REPO`, `CLI` from `harness/lib/workspace.mjs`
- Produces: `runCli(args: string[], opts: {cwd: string, env?: object}): Promise<{argv, cwd, exitCode, stdout, stderr, durationMs}>`

- [ ] **Step 1: Write the failing test**

```javascript
// harness/self-test/run.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace, destroyWorkspace } from '../lib/workspace.mjs';
import { runCli } from '../lib/run.mjs';

test('bare invocation exits 1, --help exits 0', async () => {
  const ws = await createWorkspace();
  const bare = await runCli([], { cwd: ws });
  const help = await runCli(['--help'], { cwd: ws });
  assert.equal(bare.exitCode, 1, 'bare mycontext exits 1');
  assert.equal(help.exitCode, 0, '--help exits 0');
  await destroyWorkspace(ws);
});

test('stdout and stderr are captured separately', async () => {
  const ws = await createWorkspace();
  const r = await runCli(['status'], { cwd: ws });
  assert.match(r.stderr, /ExperimentalWarning/, 'known node:sqlite warning lands on stderr');
  assert.doesNotMatch(r.stdout, /ExperimentalWarning/, 'stdout must stay clean');
  await destroyWorkspace(ws);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test harness/self-test/run.test.mjs`
Expected: FAIL — `Cannot find module '../lib/run.mjs'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// harness/lib/run.mjs
import { spawn } from 'node:child_process';
import { CLI } from './workspace.mjs';

/** Pinned so table assertions never depend on the terminal. */
const PINNED_ENV = { MYCONTEXT_WIDTH: '100', MYCONTEXT_ASCII: '1' };

export function runCli(args, { cwd, env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd,
      env: { ...process.env, ...PINNED_ENV, ...env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({
        argv: args,
        cwd,
        exitCode,
        stdout,
        stderr,
        durationMs: Date.now() - started,
      });
    });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test harness/self-test/run.test.mjs`
Expected: PASS, 2/2

- [ ] **Step 5: Commit**

```bash
git add harness/lib/run.mjs harness/self-test/run.test.mjs
git commit -m "feat(harness): CLI case runner with separated streams"
```

---

## Task 3: MCP stdio client

**Files:**
- Create: `harness/lib/mcp.mjs`
- Test: `harness/self-test/mcp.test.mjs`

**Interfaces:**
- Consumes: `REPO` from `harness/lib/workspace.mjs`
- Produces: `openMcp(cwd: string): Promise<{listTools(), callTool(name, args), initializeResult, stderr(): string, close()}>` — `listTools()` resolves to the `tools` array, `callTool()` resolves to the full JSON-RPC `result` object (so both `content` and `isError` are observable)

Verified protocol shape: newline-delimited JSON-RPC 2.0; `initialize` → `notifications/initialized` → requests. The server returned 14 tools and `serverInfo` `{"name":"mycontext","version":"0.1.0"}`.

- [ ] **Step 1: Write the failing test**

```javascript
// harness/self-test/mcp.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace, destroyWorkspace } from '../lib/workspace.mjs';
import { openMcp } from '../lib/mcp.mjs';

test('handshake succeeds and lists 14 tools', async () => {
  const ws = await createWorkspace();
  const mcp = await openMcp(ws);
  const tools = await mcp.listTools();
  assert.equal(tools.length, 14);
  assert.ok(tools.some((t) => t.name === 'load_context'));
  await mcp.close();
  await destroyWorkspace(ws);
});

test('an undeclared argument is refused', async () => {
  const ws = await createWorkspace();
  const mcp = await openMcp(ws);
  const res = await mcp.callTool('load_context', { nope: 1 });
  const text = JSON.stringify(res);
  assert.match(text, /nope/, 'the refusal names the offending argument');
  await mcp.close();
  await destroyWorkspace(ws);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test harness/self-test/mcp.test.mjs`
Expected: FAIL — `Cannot find module '../lib/mcp.mjs'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// harness/lib/mcp.mjs
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { REPO } from './workspace.mjs';

const SERVER = join(REPO, 'src', 'mcp', 'server.ts');

export async function openMcp(cwd) {
  const child = spawn(process.execPath, [SERVER], {
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
  });

  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d; });

  const pending = new Map();
  let nextId = 1;

  const rl = createInterface({ input: child.stdout });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });

  function request(method, params) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  }

  function notify(method, params) {
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
  }

  const initializeResult = await request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'mycontext-harness', version: '1.0.0' },
  });
  notify('notifications/initialized', {});

  return {
    initializeResult,
    async listTools() {
      const r = await request('tools/list', {});
      return r.tools;
    },
    // Resolves rather than throws on a tool-level refusal, so `isError`
    // responses are observable evidence instead of harness exceptions.
    async callTool(name, args) {
      try {
        return await request('tools/call', { name, arguments: args });
      } catch (err) {
        return { protocolError: err.message };
      }
    },
    stderr: () => stderr,
    async close() {
      rl.close();
      child.stdin.end();
      child.kill();
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test harness/self-test/mcp.test.mjs`
Expected: PASS, 2/2

- [ ] **Step 5: Commit**

```bash
git add harness/lib/mcp.mjs harness/self-test/mcp.test.mjs
git commit -m "feat(harness): MCP stdio JSON-RPC client"
```

---

## Task 4: Hook driver

**Files:**
- Create: `harness/lib/hooks.mjs`
- Test: `harness/self-test/hooks.test.mjs`

**Interfaces:**
- Consumes: `REPO` from `harness/lib/workspace.mjs`
- Produces: `HOOKS` (object mapping `sessionStart|preToolUse|preCompact|postToolUse` to absolute script paths), `runHook(hookKey: string, payload: object|string, opts: {cwd: string}): Promise<{exitCode, stdout, stderr, durationMs}>`

Payload shapes, from the plugin's hook contract: `SessionStart` takes `{session_id, source}`; `PreToolUse` takes `{session_id, tool_name, tool_input:{file_path,...}}`; `PostToolUse` adds `tool_response`; `PreCompact` takes `{session_id, transcript_path}`. Passing a string rather than an object writes it to stdin verbatim, which is how the garbage-input and empty-input cases are driven.

- [ ] **Step 1: Write the failing test**

```javascript
// harness/self-test/hooks.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace, destroyWorkspace } from '../lib/workspace.mjs';
import { runHook } from '../lib/hooks.mjs';

test('session-start emits the injection block on stdout', async () => {
  const ws = await createWorkspace();
  const r = await runHook('sessionStart', { session_id: 's1', source: 'startup' }, { cwd: ws });
  assert.equal(r.exitCode, 0, 'hooks fail open');
  assert.match(r.stdout, /my_context/, 'injection block reaches stdout');
  await destroyWorkspace(ws);
});

test('hooks fail open on garbage stdin', async () => {
  const ws = await createWorkspace();
  const r = await runHook('preToolUse', 'not json at all', { cwd: ws });
  assert.equal(r.exitCode, 0, 'exit 0 even on unparseable input');
  await destroyWorkspace(ws);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test harness/self-test/hooks.test.mjs`
Expected: FAIL — `Cannot find module '../lib/hooks.mjs'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// harness/lib/hooks.mjs
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { REPO } from './workspace.mjs';

const dir = join(REPO, 'src', 'hooks');

export const HOOKS = {
  sessionStart: join(dir, 'session-start.ts'),
  preToolUse: join(dir, 'pre-tool-use.ts'),
  preCompact: join(dir, 'pre-compact.ts'),
  postToolUse: join(dir, 'post-tool-use.ts'),
};

export function runHook(hookKey, payload, { cwd } = {}) {
  const script = HOOKS[hookKey];
  if (!script) throw new Error(`unknown hook: ${hookKey}`);
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(process.execPath, [script], {
      cwd,
      env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({ hook: hookKey, exitCode, stdout, stderr, durationMs: Date.now() - started });
    });
    child.stdin.write(body);
    child.stdin.end();
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test harness/self-test/hooks.test.mjs`
Expected: PASS, 2/2

- [ ] **Step 5: Commit**

```bash
git add harness/lib/hooks.mjs harness/self-test/hooks.test.mjs
git commit -m "feat(harness): hook binary driver"
```

---

## Task 5: Evidence store

**Files:**
- Create: `harness/lib/evidence.mjs`
- Test: `harness/self-test/evidence.test.mjs`

**Interfaces:**
- Consumes: nothing
- Produces: `record(surface: string, id: string, data: object): Promise<string>` returning the evidence id it wrote, `load(surface: string): Promise<object[]>`, `EVIDENCE_DIR` (string)

Evidence ids are `<surface>/<caseId>` so a finding can cite `cli/add-body-and-file-conflict` and a reader can locate the exact record.

- [ ] **Step 1: Write the failing test**

```javascript
// harness/self-test/evidence.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { record, load, EVIDENCE_DIR } from '../lib/evidence.mjs';

test('records round-trip and carry their id', async () => {
  await rm(join(EVIDENCE_DIR, 'selftest.jsonl'), { force: true });
  const id = await record('selftest', 'case-one', { exitCode: 0, stdout: 'hi' });
  assert.equal(id, 'selftest/case-one');
  const rows = await load('selftest');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'selftest/case-one');
  assert.equal(rows[0].stdout, 'hi');
  await rm(join(EVIDENCE_DIR, 'selftest.jsonl'), { force: true });
});

test('a duplicate case id is rejected, not silently overwritten', async () => {
  await rm(join(EVIDENCE_DIR, 'selftest.jsonl'), { force: true });
  await record('selftest', 'dup', { exitCode: 0 });
  await assert.rejects(() => record('selftest', 'dup', { exitCode: 1 }), /duplicate/);
  await rm(join(EVIDENCE_DIR, 'selftest.jsonl'), { force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test harness/self-test/evidence.test.mjs`
Expected: FAIL — `Cannot find module '../lib/evidence.mjs'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// harness/lib/evidence.mjs
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const EVIDENCE_DIR = join(here, '..', 'evidence');

function file(surface) {
  return join(EVIDENCE_DIR, `${surface}.jsonl`);
}

export async function load(surface) {
  const path = file(surface);
  if (!existsSync(path)) return [];
  const text = await readFile(path, 'utf8');
  return text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

export async function record(surface, caseId, data) {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const id = `${surface}/${caseId}`;
  const existing = await load(surface);
  // A silently overwritten record would make a finding untraceable.
  if (existing.some((r) => r.id === id)) {
    throw new Error(`duplicate evidence id: ${id}`);
  }
  await appendFile(file(surface), `${JSON.stringify({ id, surface, caseId, ...data })}\n`);
  return id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test harness/self-test/evidence.test.mjs`
Expected: PASS, 2/2

- [ ] **Step 5: Commit**

```bash
git add harness/lib/evidence.mjs harness/self-test/evidence.test.mjs
git commit -m "feat(harness): JSONL evidence store with duplicate-id refusal"
```

---

## Task 6: Sweep runner and baseline pin

**Files:**
- Create: `harness/sweep.mjs`
- Create: `harness/baseline.mjs`
- Test: `harness/self-test/sweep.test.mjs`

**Interfaces:**
- Consumes: `createWorkspace`, `destroyWorkspace`, `runCli`, `openMcp`, `runHook`, `record`
- Produces: `runTable(surface: string, cases: Case[]): Promise<void>` where `Case = {id: string, kind: 'cli'|'mcp'|'hook', argv?: string[], tool?: string, args?: object, hook?: string, payload?: object|string, setup?: string[][], note?: string}`. `setup` is a list of CLI argv arrays run in the workspace before the case, so a case can describe the corpus state it needs.

- [ ] **Step 1: Write the failing test**

```javascript
// harness/self-test/sweep.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { runTable } from '../sweep.mjs';
import { load, EVIDENCE_DIR } from '../lib/evidence.mjs';

test('runTable records one evidence row per case, including setup state', async () => {
  await rm(join(EVIDENCE_DIR, 'sweepselftest.jsonl'), { force: true });
  await runTable('sweepselftest', [
    { id: 'help', kind: 'cli', argv: ['--help'] },
    {
      id: 'list-after-add',
      kind: 'cli',
      setup: [['add', 'constraint', 'Probe rule', '--yes']],
      argv: ['list', 'constraint'],
    },
  ]);
  const rows = await load('sweepselftest');
  assert.equal(rows.length, 2);
  assert.equal(rows.find((r) => r.caseId === 'help').exitCode, 0);
  assert.match(rows.find((r) => r.caseId === 'list-after-add').stdout, /Probe rule/);
  await rm(join(EVIDENCE_DIR, 'sweepselftest.jsonl'), { force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test harness/self-test/sweep.test.mjs`
Expected: FAIL — `Cannot find module '../sweep.mjs'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// harness/sweep.mjs
import { createWorkspace, destroyWorkspace } from './lib/workspace.mjs';
import { runCli } from './lib/run.mjs';
import { openMcp } from './lib/mcp.mjs';
import { runHook } from './lib/hooks.mjs';
import { record } from './lib/evidence.mjs';

async function runOne(kase) {
  // Each case gets a pristine workspace: no case may depend on another's leftovers.
  const ws = await createWorkspace();
  try {
    for (const argv of kase.setup ?? []) {
      await runCli(argv, { cwd: ws });
    }
    if (kase.kind === 'cli') {
      return await runCli(kase.argv, { cwd: ws, env: kase.env });
    }
    if (kase.kind === 'hook') {
      return await runHook(kase.hook, kase.payload, { cwd: ws });
    }
    if (kase.kind === 'mcp') {
      const mcp = await openMcp(ws);
      const started = Date.now();
      const result = kase.tool === '__list__'
        ? { tools: await mcp.listTools(), initializeResult: mcp.initializeResult }
        : await mcp.callTool(kase.tool, kase.args ?? {});
      const stderr = mcp.stderr();
      await mcp.close();
      return { tool: kase.tool, args: kase.args, result, stderr, durationMs: Date.now() - started };
    }
    throw new Error(`unknown case kind: ${kase.kind}`);
  } finally {
    await destroyWorkspace(ws);
  }
}

export async function runTable(surface, cases) {
  for (const kase of cases) {
    let outcome;
    try {
      outcome = await runOne(kase);
    } catch (err) {
      // A harness crash is itself evidence — never swallow it.
      outcome = { harnessError: err.message, stack: err.stack };
    }
    await record(surface, kase.id, { note: kase.note ?? null, ...outcome });
  }
}

const [, , surfaceArg, moduleArg] = process.argv;
if (surfaceArg && moduleArg) {
  const mod = await import(moduleArg);
  await runTable(surfaceArg, mod.cases);
  console.log(`swept ${mod.cases.length} cases into evidence/${surfaceArg}.jsonl`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test harness/self-test/sweep.test.mjs`
Expected: PASS, 1/1

- [ ] **Step 5: Write the baseline pin script**

```javascript
// harness/baseline.mjs
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { REPO } from './lib/workspace.mjs';

const execFileAsync = promisify(execFile);

/** The 11 failures caused by node:sqlite's ExperimentalWarning reaching stderr. */
export const KNOWN_RED = new Set([
  'session-start exits 0 and says nothing when stdin is garbage',
  'session-start exits 0 and says nothing when stdin is empty',
  'pre-tool-use exits 0 and says nothing when stdin is garbage',
  'pre-tool-use exits 0 and says nothing when stdin is empty',
  'pre-compact exits 0 and says nothing when stdin is garbage',
  'pre-compact exits 0 and says nothing when stdin is empty',
  'session-start writes the injected context on stdout for a real payload',
  'pre-tool-use emits the deny envelope for a write into the managed directory',
  'pre-compact writes a restore snapshot and keeps stdout clean',
  'nothing but MCP messages reaches stdout',
  'load_context runs over stdio without a byte of stray stdout',
]);

const { stdout } = await execFileAsync('npm', ['test'], { cwd: REPO, shell: true })
  .catch((e) => ({ stdout: e.stdout ?? '' }));

const failed = [...stdout.matchAll(/^\s*\u2716 (.+?) \(\d/gm)].map((m) => m[1]);
const unexpected = failed.filter((n) => !KNOWN_RED.has(n));
const fixed = [...KNOWN_RED].filter((n) => !failed.includes(n));

console.log(`failed: ${failed.length}  known-red: ${KNOWN_RED.size}`);
if (fixed.length) console.log(`no longer failing:\n  ${fixed.join('\n  ')}`);
if (unexpected.length) {
  console.error(`NEW FAILURES:\n  ${unexpected.join('\n  ')}`);
  process.exit(1);
}
console.log('baseline matches the pin');
```

- [ ] **Step 6: Run the baseline to confirm the pin matches**

Run: `node harness/baseline.mjs`
Expected: `failed: 11  known-red: 11` then `baseline matches the pin`, exit 0

- [ ] **Step 7: Commit**

```bash
git add harness/sweep.mjs harness/baseline.mjs harness/self-test/sweep.test.mjs
git commit -m "feat(harness): sweep runner and pinned baseline diff"
```

---

## Task 7: CLI sweep — capture and inspection commands

**Files:**
- Create: `harness/cases/cli-capture.mjs`
- Evidence: `harness/evidence/cli-capture.jsonl`

**Interfaces:**
- Consumes: the `Case` shape from Task 6
- Produces: `cases` (array of `Case`) — exported for `sweep.mjs`

Covers `init`, `add`, `list`, `show`, `status`, `doctor`, `help`, `examples`, `rebuild`. Every flag from the inventory gets at least one accept case and one reject case where a rejection is specified.

- [ ] **Step 1: Write the case table**

```javascript
// harness/cases/cli-capture.mjs
const ADD = ['add', 'constraint', 'Uploads capped at 10 MB'];

export const cases = [
  // --- init ---
  { id: 'init-bare', kind: 'cli', argv: ['init'], note: 'exit 0, creates .my_context' },
  { id: 'init-global-refused', kind: 'cli', argv: ['init', '--global'],
    note: 'README 4494: refused, names the global root' },
  { id: 'init-unknown-arg', kind: 'cli', argv: ['init', '--nope'],
    note: 'README 2841 lists init as NOT checking unknown flags — contradicts 4494' },

  // --- add: accepted flags ---
  { id: 'add-normative-without-yes', kind: 'cli', argv: [...ADD],
    note: 'normative category should require --yes' },
  { id: 'add-normative-with-yes', kind: 'cli', argv: [...ADD, '--yes'] },
  { id: 'add-rationale-without-yes', kind: 'cli', argv: ['add', 'decision', 'We chose Stripe'],
    note: 'rationale needs no --yes' },
  { id: 'add-body', kind: 'cli', argv: [...ADD, '--body', 'Gateway rejects larger bodies.', '--yes'] },
  { id: 'add-scope-comma', kind: 'cli', argv: [...ADD, '--scope', 'src/api/**,src/db/**', '--yes'] },
  { id: 'add-scope-repeated', kind: 'cli',
    argv: [...ADD, '--scope', 'src/api/**', '--scope', 'src/db/**', '--yes'],
    note: 'README 1926: comma and repeat forms must be equivalent' },
  { id: 'add-tags', kind: 'cli', argv: [...ADD, '--tags', 'uploads,api', '--yes'] },
  { id: 'add-severity-hard', kind: 'cli', argv: [...ADD, '--severity', 'hard', '--yes'] },
  { id: 'add-severity-soft', kind: 'cli', argv: [...ADD, '--severity', 'soft', '--yes'] },
  { id: 'add-note-repeated', kind: 'cli',
    argv: [...ADD, '--note', 'first', '--note', 'second', '--yes'],
    note: 'repeatable: one observation per occurrence' },
  { id: 'add-equals-form', kind: 'cli', argv: [...ADD, '--severity=hard', '--yes'] },

  // --- add: refusals ---
  { id: 'add-body-and-file-conflict', kind: 'cli',
    argv: [...ADD, '--body', 'x', '--file', 'README.md', '--yes'],
    note: 'README 1928: --body and --file together refused' },
  { id: 'add-repeated-single-value', kind: 'cli',
    argv: [...ADD, '--body', 'x', '--body', 'y', '--yes'],
    note: 'README 1927: single-valued flag twice is refused' },
  { id: 'add-unknown-flag', kind: 'cli', argv: [...ADD, '--nope', '--yes'] },
  { id: 'add-value-flag-with-nothing-after', kind: 'cli', argv: [...ADD, '--body'] },
  { id: 'add-unknown-category', kind: 'cli', argv: ['add', 'nosuchtype', 'X', '--yes'] },
  { id: 'add-yes-maybe', kind: 'cli', argv: [...ADD, '--yes=maybe'],
    note: 'README 2830: --yes=maybe refused' },
  { id: 'add-yes-false', kind: 'cli', argv: [...ADD, '--yes=false'],
    note: 'declines rather than confirms' },
  { id: 'add-severity-hard-on-rationale', kind: 'cli',
    argv: ['add', 'decision', 'X', '--severity', 'hard'],
    note: 'README 3974: refused on rationale' },

  // --- list / show ---
  { id: 'list-bare', kind: 'cli', setup: [[...ADD, '--yes']], argv: ['list'] },
  { id: 'list-category', kind: 'cli', setup: [[...ADD, '--yes']], argv: ['list', 'constraint'] },
  { id: 'list-full', kind: 'cli', setup: [[...ADD, '--yes']], argv: ['list', '--full'] },
  { id: 'list-short', kind: 'cli', setup: [[...ADD, '--yes']], argv: ['list', '--short'] },
  { id: 'list-summary', kind: 'cli', setup: [[...ADD, '--yes']], argv: ['list', '--summary'] },
  { id: 'list-json', kind: 'cli', setup: [[...ADD, '--yes']], argv: ['list', '--json'] },
  { id: 'list-two-detail-levels', kind: 'cli', argv: ['list', '--full', '--short'],
    note: 'two levels at once is an error' },
  { id: 'list-unknown-category', kind: 'cli', argv: ['list', 'nosuchtype'] },
  { id: 'show-existing', kind: 'cli', setup: [[...ADD, '--yes']],
    argv: ['show', 'CONST-uploads-capped-at-10-mb'] },
  { id: 'show-missing', kind: 'cli', argv: ['show', 'CONST-does-not-exist'] },
  { id: 'show-unknown-flag', kind: 'cli', setup: [[...ADD, '--yes']],
    argv: ['show', 'CONST-uploads-capped-at-10-mb', '--nope'],
    note: 'README 2841: show does NOT check unknown flags' },

  // --- status / doctor ---
  { id: 'status-bare', kind: 'cli', argv: ['status'] },
  { id: 'status-json', kind: 'cli', argv: ['status', '--json'] },
  { id: 'status-summary', kind: 'cli', argv: ['status', '--summary'] },
  { id: 'status-full', kind: 'cli', argv: ['status', '--full'] },
  { id: 'status-unknown-flag', kind: 'cli', argv: ['status', '--nope'] },
  { id: 'doctor-bare', kind: 'cli', argv: ['doctor'] },
  { id: 'doctor-quiet', kind: 'cli', argv: ['doctor', '--quiet'] },
  { id: 'doctor-quiet-and-full', kind: 'cli', argv: ['doctor', '--quiet', '--full'],
    note: 'README 2785: --quiet wins and nothing says so' },
  { id: 'doctor-json', kind: 'cli', argv: ['doctor', '--json'] },

  // --- help / examples / rebuild ---
  { id: 'help-bare', kind: 'cli', argv: ['help'] },
  { id: 'help-categories', kind: 'cli', argv: ['help', 'categories'] },
  { id: 'help-scope', kind: 'cli', argv: ['help', 'scope'] },
  { id: 'help-capture', kind: 'cli', argv: ['help', 'capture'] },
  { id: 'help-workflow', kind: 'cli', argv: ['help', 'workflow'] },
  { id: 'help-query-refused', kind: 'cli', argv: ['help', 'query'],
    note: 'README 4483: refused by name' },
  { id: 'help-config-refused', kind: 'cli', argv: ['help', 'config'] },
  { id: 'examples-rule', kind: 'cli', argv: ['examples', 'rule'] },
  { id: 'examples-short', kind: 'cli', argv: ['examples', 'rule', '--short'] },
  { id: 'examples-unknown', kind: 'cli', argv: ['examples', 'nosuchtype'] },
  { id: 'rebuild-bare', kind: 'cli', setup: [[...ADD, '--yes']], argv: ['rebuild'] },
  { id: 'rebuild-with-args-dropped', kind: 'cli', argv: ['rebuild', '--nope'],
    note: 'args deliberately dropped at index.ts:811' },

  // --- top level ---
  { id: 'bare-invocation', kind: 'cli', argv: [], note: 'exits 1' },
  { id: 'help-flag', kind: 'cli', argv: ['--help'], note: 'exits 0' },
  { id: 'unknown-command', kind: 'cli', argv: ['nosuchcommand'] },
];
```

- [ ] **Step 2: Run the sweep**

Run: `node harness/sweep.mjs cli-capture ./cases/cli-capture.mjs`
Expected: `swept 56 cases into evidence/cli-capture.jsonl`

- [ ] **Step 3: Verify every case produced a record with an exit code**

Run:
```bash
node -e "const {load}=await import('./harness/lib/evidence.mjs');const r=await load('cli-capture');console.log(r.length, r.filter(x=>x.exitCode===undefined&&!x.harnessError).length)" --input-type=module
```
Expected: first number equals the case count, second is `0` (no case missing an exit code)

- [ ] **Step 4: Commit**

```bash
git add harness/cases/cli-capture.mjs harness/evidence/cli-capture.jsonl
git commit -m "test(sweep): capture and inspection CLI commands"
```

---

## Task 8: CLI sweep — mutation and lifecycle commands

**Files:**
- Create: `harness/cases/cli-mutate.mjs`
- Evidence: `harness/evidence/cli-mutate.jsonl`

**Interfaces:**
- Consumes: the `Case` shape from Task 6
- Produces: `cases` (array of `Case`)

Covers `edit`, `pin`, `unpin`, `harden`, `soften`, `supersede`, `refresh`, `repair`, `link`/`unlink` via `edit --unlink`, and the `review` subcommand family.

- [ ] **Step 1: Write the case table**

```javascript
// harness/cases/cli-mutate.mjs
const SEED = ['add', 'constraint', 'Pool capped at 20', '--yes'];
const ID = 'CONST-pool-capped-at-20';
const SEED2 = ['add', 'constraint', 'Pool capped at 50', '--yes'];
const ID2 = 'CONST-pool-capped-at-50';
const seed = [SEED];
const seedTwo = [SEED, SEED2];

export const cases = [
  // --- edit ---
  { id: 'edit-title', kind: 'cli', setup: seed, argv: ['edit', ID, '--title', 'New title', '--yes'] },
  { id: 'edit-body', kind: 'cli', setup: seed, argv: ['edit', ID, '--body', 'New body', '--yes'] },
  { id: 'edit-scope', kind: 'cli', setup: seed, argv: ['edit', ID, '--scope', 'src/db/**', '--yes'] },
  { id: 'edit-tags', kind: 'cli', setup: seed, argv: ['edit', ID, '--tags', 'db,pool', '--yes'] },
  { id: 'edit-severity', kind: 'cli', setup: seed, argv: ['edit', ID, '--severity', 'hard', '--yes'] },
  { id: 'edit-status-validated', kind: 'cli', setup: seed,
    argv: ['edit', ID, '--status', 'validated', '--yes'] },
  { id: 'edit-status-superseded-refused', kind: 'cli', setup: seed,
    argv: ['edit', ID, '--status', 'superseded', '--yes'],
    note: 'edit.ts:519 explicitly refuses superseded' },
  { id: 'edit-always-true', kind: 'cli', setup: seed, argv: ['edit', ID, '--always', '--yes'] },
  { id: 'edit-always-false', kind: 'cli', setup: seed, argv: ['edit', ID, '--always=false', '--yes'] },
  { id: 'edit-extra-repeated', kind: 'cli', setup: seed,
    argv: ['edit', ID, '--extra', 'kind=perf', '--extra', 'impact=high', '--yes'] },
  { id: 'edit-unlink-two-words', kind: 'cli', setup: seedTwo,
    argv: ['edit', ID, '--unlink', 'relates_to', ID2, '--yes'] },
  { id: 'edit-unlink-equals-refused', kind: 'cli', setup: seed,
    argv: ['edit', ID, `--unlink=relates_to`, '--yes'],
    note: 'the --unlink= form is refused; it takes two words' },
  { id: 'edit-no-yes-declines', kind: 'cli', setup: seed, argv: ['edit', ID, '--title', 'X'],
    note: 'non-TTY without --yes must refuse, not proceed' },
  { id: 'edit-unknown-flag', kind: 'cli', setup: seed, argv: ['edit', ID, '--nope', '--yes'] },
  { id: 'edit-missing-id', kind: 'cli', argv: ['edit', 'CONST-nope', '--title', 'X', '--yes'] },

  // --- named entry points (all equal edit with one field) ---
  { id: 'pin', kind: 'cli', setup: seed, argv: ['pin', ID, '--yes'] },
  { id: 'unpin', kind: 'cli', setup: seed, argv: ['unpin', ID, '--yes'] },
  { id: 'harden', kind: 'cli', setup: seed, argv: ['harden', ID, '--yes'] },
  { id: 'soften', kind: 'cli', setup: seed, argv: ['soften', ID, '--yes'] },
  { id: 'pin-rejects-other-flags', kind: 'cli', setup: seed,
    argv: ['pin', ID, '--severity', 'hard', '--yes'],
    note: 'NAMED_ALLOWED is [yes] only' },
  { id: 'pin-on-rationale-reference', kind: 'cli',
    setup: [['add', 'reference', 'Roadmap', '--file', 'README.md']],
    argv: ['pin', 'REF-roadmap', '--yes'],
    note: 'README 1168: refused, names the two routes' },

  // --- supersede ---
  { id: 'supersede-ok', kind: 'cli', setup: seedTwo, argv: ['supersede', ID, '--by', ID2, '--yes'] },
  { id: 'supersede-with-reason', kind: 'cli', setup: seedTwo,
    argv: ['supersede', ID, '--by', ID2, '--reason', 'raised the cap', '--yes'] },
  { id: 'supersede-missing-by', kind: 'cli', setup: seed, argv: ['supersede', ID, '--yes'],
    note: '--by is required' },
  { id: 'supersede-unknown-flag', kind: 'cli', setup: seedTwo,
    argv: ['supersede', ID, '--by', ID2, '--nope', '--yes'] },

  // --- refresh / repair ---
  { id: 'refresh-reference', kind: 'cli',
    setup: [['add', 'reference', 'Roadmap', '--file', 'README.md']],
    argv: ['refresh', 'REF-roadmap', '--yes'] },
  { id: 'refresh-non-snapshot-refused', kind: 'cli', setup: seed, argv: ['refresh', ID, '--yes'],
    note: 'refuses items that are not file snapshots' },
  { id: 'repair-without-yes-lists-only', kind: 'cli', setup: seed, argv: ['repair'],
    note: 'lists and changes nothing' },
  { id: 'repair-with-yes', kind: 'cli', setup: seed, argv: ['repair', '--yes'] },
  { id: 'repair-unknown-flag', kind: 'cli', argv: ['repair', '--nope'] },

  // --- review family: per-subcommand flags ---
  { id: 'review-list-default', kind: 'cli', argv: ['review'] },
  { id: 'review-list-explicit', kind: 'cli', argv: ['review', 'list'] },
  { id: 'review-list-full', kind: 'cli', argv: ['review', 'list', '--full'] },
  { id: 'review-list-json', kind: 'cli', argv: ['review', 'list', '--json'] },
  { id: 'review-list-type', kind: 'cli', argv: ['review', 'list', '--type', 'constraint'] },
  { id: 'review-list-unknown-flag', kind: 'cli', argv: ['review', 'list', '--nope'] },
  { id: 'review-show-missing', kind: 'cli', argv: ['review', 'show', 'CONST-nope'] },
  { id: 'review-promote-missing', kind: 'cli', argv: ['review', 'promote', 'CONST-nope', '--yes'] },
  { id: 'review-promote-flags', kind: 'cli',
    argv: ['review', 'promote', 'CONST-nope', '--scope', 'src/**', '--severity', 'hard', '--always', '--yes'] },
  { id: 'review-discard-missing', kind: 'cli', argv: ['review', 'discard', 'CONST-nope', '--yes'] },
  { id: 'review-revisions', kind: 'cli', setup: seed, argv: ['review', 'revisions'] },
  { id: 'review-revisions-full', kind: 'cli', setup: seed, argv: ['review', 'revisions', '--full'] },
  { id: 'review-promote-revision-missing', kind: 'cli', setup: seed,
    argv: ['review', 'promote-revision', ID, '--yes'] },
  { id: 'review-promote-revision-force', kind: 'cli', setup: seed,
    argv: ['review', 'promote-revision', ID, '--force', '--yes'] },
  { id: 'review-discard-revision-reason', kind: 'cli', setup: seed,
    argv: ['review', 'discard-revision', ID, '--reason', 'superseded', '--yes'] },
  { id: 'review-unknown-subcommand', kind: 'cli', argv: ['review', 'nosuchsub'] },
];
```

- [ ] **Step 2: Run the sweep**

Run: `node harness/sweep.mjs cli-mutate ./cases/cli-mutate.mjs`
Expected: `swept 45 cases into evidence/cli-mutate.jsonl`

- [ ] **Step 3: Confirm the author's corpus was not touched**

Run: `git -C my-context status --short`
Expected: empty output — no modification to `my-context/.my_context/`

- [ ] **Step 4: Commit**

```bash
git add harness/cases/cli-mutate.mjs harness/evidence/cli-mutate.jsonl
git commit -m "test(sweep): mutation and lifecycle CLI commands"
```

---

## Task 9: CLI sweep — retrieval, audit and focus

**Files:**
- Create: `harness/cases/cli-retrieve.mjs`
- Evidence: `harness/evidence/cli-retrieve.jsonl`

**Interfaces:**
- Consumes: the `Case` shape from Task 6
- Produces: `cases` (array of `Case`)

Covers `search`, `query`, `audit` (all 12 flags including the two undocumented ones), `decay`, and `focus`.

- [ ] **Step 1: Write the case table**

```javascript
// harness/cases/cli-retrieve.mjs
const SEED = ['add', 'constraint', 'Pool capped at 20', '--scope', 'src/db/**', '--tags', 'db', '--yes'];
const seed = [SEED];

export const cases = [
  // --- search ---
  { id: 'search-positional', kind: 'cli', setup: seed, argv: ['search', 'pool'] },
  { id: 'search-text-flag', kind: 'cli', setup: seed, argv: ['search', '--text', 'pool'] },
  { id: 'search-both-forms-refused', kind: 'cli', setup: seed,
    argv: ['search', 'pool', '--text', 'pool'], note: 'bare positional and --text together refused' },
  { id: 'search-no-filter-refused', kind: 'cli', setup: seed, argv: ['search'],
    note: 'at least one filter required' },
  { id: 'search-type', kind: 'cli', setup: seed, argv: ['search', '--type', 'constraint'] },
  { id: 'search-tag', kind: 'cli', setup: seed, argv: ['search', '--tag', 'db'] },
  { id: 'search-path', kind: 'cli', setup: seed, argv: ['search', '--path', 'src/db/writer.ts'] },
  { id: 'search-status', kind: 'cli', setup: seed, argv: ['search', '--status', 'active'] },
  { id: 'search-relation', kind: 'cli', setup: seed, argv: ['search', '--relation', 'relates_to'] },
  { id: 'search-relation-invalid', kind: 'cli', setup: seed, argv: ['search', '--relation', 'nope'] },
  { id: 'search-limit', kind: 'cli', setup: seed, argv: ['search', '--type', 'constraint', '--limit', '1'] },
  { id: 'search-json', kind: 'cli', setup: seed, argv: ['search', '--type', 'constraint', '--json'] },
  { id: 'search-unknown-flag', kind: 'cli', setup: seed, argv: ['search', 'pool', '--nope'] },

  // --- query ---
  { id: 'query-select', kind: 'cli', setup: seed,
    argv: ['query', 'SELECT id, type FROM items ORDER BY id'] },
  { id: 'query-json', kind: 'cli', setup: seed,
    argv: ['query', 'SELECT id FROM items', '--json'],
    note: 'shape must be {rows,rowCount,truncated,limit,loadErrors}' },
  { id: 'query-limit', kind: 'cli', setup: seed, argv: ['query', 'SELECT id FROM items', '--limit', '1'] },
  { id: 'query-limit-zero-refused', kind: 'cli', setup: seed,
    argv: ['query', 'SELECT id FROM items', '--limit', '0'], note: 'minimum is 1' },
  { id: 'query-detail-flag-rejected', kind: 'cli', setup: seed,
    argv: ['query', 'SELECT id FROM items', '--full'],
    note: 'query.ts:189 rejects detail flags' },
  { id: 'query-insert-refused', kind: 'cli', setup: seed,
    argv: ['query', "INSERT INTO items VALUES ('x')"] },
  { id: 'query-drop-refused', kind: 'cli', setup: seed, argv: ['query', 'DROP TABLE items'] },
  { id: 'query-pragma-refused', kind: 'cli', setup: seed, argv: ['query', 'PRAGMA table_info(items)'] },
  { id: 'query-with-cte-allowed', kind: 'cli', setup: seed,
    argv: ['query', 'WITH x AS (SELECT id FROM items) SELECT * FROM x'] },
  { id: 'query-ledger-missing-table', kind: 'cli', setup: [SEED, ['rebuild']],
    argv: ['query', 'SELECT * FROM ledger'],
    note: 'README 2551: rebuild creates no ledger tables' },
  { id: 'query-double-dash-separator', kind: 'cli', setup: seed,
    argv: ['query', '--', '-- a comment\nSELECT id FROM items'] },

  // --- audit: every one of the 12 flags ---
  { id: 'audit-bare', kind: 'cli', setup: seed, argv: ['audit'] },
  { id: 'audit-since-span', kind: 'cli', setup: seed, argv: ['audit', '--since', '7d'] },
  { id: 'audit-since-hours', kind: 'cli', setup: seed, argv: ['audit', '--since', '12h'] },
  { id: 'audit-since-iso', kind: 'cli', setup: seed, argv: ['audit', '--since', '2026-08-01'] },
  { id: 'audit-until', kind: 'cli', setup: seed, argv: ['audit', '--until', '2026-12-31'],
    note: 'UNDOCUMENTED: appears zero times in README' },
  { id: 'audit-item', kind: 'cli', setup: seed, argv: ['audit', '--item', 'CONST-pool-capped-at-20'] },
  { id: 'audit-session', kind: 'cli', setup: seed, argv: ['audit', '--session', 'abc'] },
  { id: 'audit-kind-injection', kind: 'cli', setup: seed, argv: ['audit', '--kind', 'injection'] },
  { id: 'audit-kind-focus', kind: 'cli', setup: seed, argv: ['audit', '--kind', 'focus'] },
  { id: 'audit-kind-invalid', kind: 'cli', setup: seed, argv: ['audit', '--kind', 'nope'] },
  { id: 'audit-op-create', kind: 'cli', setup: seed, argv: ['audit', '--op', 'create'] },
  { id: 'audit-op-invalid', kind: 'cli', setup: seed, argv: ['audit', '--op', 'nope'] },
  { id: 'audit-origin-agent', kind: 'cli', setup: seed, argv: ['audit', '--origin', 'agent'] },
  { id: 'audit-role', kind: 'cli', setup: seed, argv: ['audit', '--role', 'human'],
    note: 'UNDOCUMENTED: accepted at audit.ts:25, absent from USAGE and README' },
  { id: 'audit-limit', kind: 'cli', setup: seed, argv: ['audit', '--limit', '5'] },
  { id: 'audit-summary', kind: 'cli', setup: seed, argv: ['audit', '--summary'] },
  { id: 'audit-items', kind: 'cli', setup: seed, argv: ['audit', '--items'] },
  { id: 'audit-sessions', kind: 'cli', setup: seed, argv: ['audit', '--sessions'] },
  { id: 'audit-files', kind: 'cli', setup: seed, argv: ['audit', '--files'] },
  { id: 'audit-json', kind: 'cli', setup: seed, argv: ['audit', '--json'] },
  { id: 'audit-replay-ledger', kind: 'cli', setup: seed, argv: ['audit', 'replay-ledger'],
    note: 'hidden positional subcommand at audit.ts:230' },
  { id: 'audit-unknown-flag', kind: 'cli', setup: seed, argv: ['audit', '--nope'] },

  // --- decay ---
  { id: 'decay-bare', kind: 'cli', setup: seed, argv: ['decay'] },
  { id: 'decay-sessions', kind: 'cli', setup: seed, argv: ['decay', '--sessions', '5'] },
  { id: 'decay-sessions-zero-refused', kind: 'cli', setup: seed, argv: ['decay', '--sessions', '0'] },
  { id: 'decay-all', kind: 'cli', setup: seed, argv: ['decay', '--all'] },
  { id: 'decay-summary-still-prints-caveat', kind: 'cli', setup: seed, argv: ['decay', '--summary'],
    note: 'README 2273: caveat prints at every detail level' },
  { id: 'decay-json', kind: 'cli', setup: seed, argv: ['decay', '--json'] },
  { id: 'decay-unknown-flag', kind: 'cli', setup: seed, argv: ['decay', '--nope'] },

  // --- focus ---
  { id: 'focus-bare-reports', kind: 'cli', setup: seed, argv: ['focus'] },
  { id: 'focus-positional-tag', kind: 'cli', setup: seed, argv: ['focus', 'db'] },
  { id: 'focus-two-tags', kind: 'cli', setup: seed, argv: ['focus', 'db', 'api'] },
  { id: 'focus-tag-flag', kind: 'cli', setup: seed, argv: ['focus', '--tag', 'db'],
    note: 'advertised in commands/focus.md, absent from README' },
  { id: 'focus-category', kind: 'cli', setup: seed, argv: ['focus', '--category', 'constraint'] },
  { id: 'focus-scope-path', kind: 'cli', setup: seed, argv: ['focus', '--scope', 'src/db/writer.ts'] },
  { id: 'focus-scope-glob', kind: 'cli', setup: seed, argv: ['focus', '--scope', 'src/db/**'] },
  { id: 'focus-preview', kind: 'cli', setup: seed, argv: ['focus', 'db', '--preview'] },
  { id: 'focus-show', kind: 'cli', setup: seed, argv: ['focus', '--show'],
    note: 'real per focus.ts:43, under-documented' },
  { id: 'focus-relations', kind: 'cli', setup: seed, argv: ['focus', '--relations'] },
  { id: 'focus-json', kind: 'cli', setup: seed, argv: ['focus', '--json'] },
  { id: 'focus-clear', kind: 'cli', setup: seed, argv: ['focus', '--clear'] },
  { id: 'focus-clear-with-axis-refused', kind: 'cli', setup: seed,
    argv: ['focus', '--clear', '--tag', 'db'], note: 'focus.ts:108 refuses the combination' },
  { id: 'focus-hard-item-never-hidden', kind: 'cli',
    setup: [['add', 'constraint', 'Never commit a secret', '--severity', 'hard', '--yes'], SEED],
    argv: ['focus', 'db', '--preview'],
    note: 'README 2484: focus never hides a severity:hard item' },
];
```

- [ ] **Step 2: Run the sweep**

Run: `node harness/sweep.mjs cli-retrieve ./cases/cli-retrieve.mjs`
Expected: `swept 60 cases into evidence/cli-retrieve.jsonl`

- [ ] **Step 3: Commit**

```bash
git add harness/cases/cli-retrieve.mjs harness/evidence/cli-retrieve.jsonl
git commit -m "test(sweep): retrieval, audit and focus CLI commands"
```

---

## Task 10: CLI sweep — ingest and lesson pipelines

**Files:**
- Create: `harness/cases/cli-pipelines.mjs`
- Evidence: `harness/evidence/cli-pipelines.jsonl`

**Interfaces:**
- Consumes: the `Case` shape from Task 6
- Produces: `cases` (array of `Case`)

Covers `ingest`, `ingest-apply`, `ingest-status`, `lesson`, `lesson-stage`, `lesson-accept`, `lesson-discard`. These are two-call protocols, so cases assert the request envelope and the refusal paths rather than driving a full model round trip.

- [ ] **Step 1: Write a fixture document the ingest cases consume**

```javascript
// harness/cases/cli-pipelines.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Written into each workspace by the setup step below.
export const FIXTURE_NAME = 'prd.md';
export const FIXTURE_BODY = [
  '# Bookstore API PRD',
  '',
  '## Rate limits',
  '',
  'Every client is capped at 100 requests per minute. Exceeding the cap returns 429.',
  '',
  '## Identifiers',
  '',
  'An ISBN is unique per tenant, not globally.',
  '',
].join('\n');

export function writeFixture(ws) {
  writeFileSync(join(ws, FIXTURE_NAME), FIXTURE_BODY, 'utf8');
}

const LESSON = ['lesson', 'Retry storms need jitter, we learned that the hard way'];

export const cases = [
  // --- ingest ---
  { id: 'ingest-missing-path', kind: 'cli', argv: ['ingest', 'nosuchfile.md'] },
  { id: 'ingest-no-args', kind: 'cli', argv: ['ingest'] },
  { id: 'ingest-status-empty', kind: 'cli', argv: ['ingest-status'] },
  { id: 'ingest-status-full', kind: 'cli', argv: ['ingest-status', '--full'] },
  { id: 'ingest-status-json', kind: 'cli', argv: ['ingest-status', '--json'] },
  { id: 'ingest-status-unknown-flag', kind: 'cli', argv: ['ingest-status', '--nope'] },
  { id: 'ingest-apply-missing-anchor', kind: 'cli',
    argv: ['ingest-apply', 'ING-nope', '--stdin'], note: '--anchor is required' },
  { id: 'ingest-apply-missing-payload', kind: 'cli',
    argv: ['ingest-apply', 'ING-nope', '--anchor', 'rate-limits'],
    note: 'exactly one of --file / --stdin required' },
  { id: 'ingest-apply-both-payloads', kind: 'cli',
    argv: ['ingest-apply', 'ING-nope', '--anchor', 'rate-limits', '--stdin', '--file', 'x.json'] },

  // --- lesson ---
  { id: 'lesson-record', kind: 'cli', argv: [...LESSON] },
  { id: 'lesson-existing-id-is-noop', kind: 'cli', setup: [[...LESSON]],
    argv: ['lesson', 'LESSON-retry-storms-need-jitter-we-learned-that-the-hard-way'],
    note: 'README 453: prints "already recorded — nothing was written by this call"' },
  { id: 'lesson-stage-missing-payload', kind: 'cli', setup: [[...LESSON]],
    argv: ['lesson-stage', 'LESSON-retry-storms-need-jitter-we-learned-that-the-hard-way'] },
  { id: 'lesson-stage-missing-id', kind: 'cli', argv: ['lesson-stage', 'LESSON-nope', '--stdin'] },
  { id: 'lesson-accept-missing-key', kind: 'cli', setup: [[...LESSON]],
    argv: ['lesson-accept', 'LESSON-retry-storms-need-jitter-we-learned-that-the-hard-way'] },
  { id: 'lesson-accept-unknown-key', kind: 'cli', setup: [[...LESSON]],
    argv: ['lesson-accept', 'LESSON-retry-storms-need-jitter-we-learned-that-the-hard-way', 'deadbeef'] },
  { id: 'lesson-discard-unknown-key', kind: 'cli', setup: [[...LESSON]],
    argv: ['lesson-discard', 'LESSON-retry-storms-need-jitter-we-learned-that-the-hard-way', 'deadbeef'] },
];
```

- [ ] **Step 2: Teach the sweep runner to write fixtures**

Add to `harness/sweep.mjs` inside `runOne`, immediately after `createWorkspace()`:

```javascript
    if (kase.fixture) kase.fixture(ws);
```

Then in `cli-pipelines.mjs`, add `fixture: writeFixture` to the three cases that need the document:

```javascript
// append to the cases array in cli-pipelines.mjs
cases.push(
  { id: 'ingest-first-chunk', kind: 'cli', fixture: writeFixture, argv: ['ingest', FIXTURE_NAME],
    note: 'emits my_context/extraction-request@1 for the first pending section' },
  { id: 'ingest-anchor-rerequest', kind: 'cli', fixture: writeFixture,
    argv: ['ingest', FIXTURE_NAME, '--anchor', 'rate-limits'] },
  { id: 'ingest-status-after-open', kind: 'cli', fixture: writeFixture,
    setup: [['ingest', FIXTURE_NAME]], argv: ['ingest-status', '--full'] },
);
```

- [ ] **Step 3: Run the sweep**

Run: `node harness/sweep.mjs cli-pipelines ./cases/cli-pipelines.mjs`
Expected: `swept 19 cases into evidence/cli-pipelines.jsonl`

- [ ] **Step 4: Commit**

```bash
git add harness/cases/cli-pipelines.mjs harness/sweep.mjs harness/evidence/cli-pipelines.jsonl
git commit -m "test(sweep): ingest and lesson pipeline commands"
```

---

## Task 11: MCP tool sweep

**Files:**
- Create: `harness/cases/mcp.mjs`
- Evidence: `harness/evidence/mcp.jsonl`

**Interfaces:**
- Consumes: the `Case` shape from Task 6, `kind: 'mcp'`
- Produces: `cases` (array of `Case`)

All 14 tools, each with a valid call, an undeclared-argument refusal, and the specific refusals the trust boundary promises.

- [ ] **Step 1: Write the case table**

```javascript
// harness/cases/mcp.mjs
const SEED = ['add', 'constraint', 'Pool capped at 20', '--scope', 'src/db/**', '--yes'];
const ID = 'CONST-pool-capped-at-20';
const seed = [SEED];

export const cases = [
  { id: 'handshake-and-list', kind: 'mcp', tool: '__list__',
    note: 'serverInfo.version is 0.1.0 while the plugin is 1.0.0 — F3' },

  // create_item
  { id: 'create_item-minimal', kind: 'mcp', tool: 'create_item',
    args: { type: 'constraint', title: 'Uploads capped at 10 MB' },
    note: 'normative capture by an agent must land as draft' },
  { id: 'create_item-rationale', kind: 'mcp', tool: 'create_item',
    args: { type: 'decision', title: 'We chose Stripe' }, note: 'rationale lands active' },
  { id: 'create_item-full', kind: 'mcp', tool: 'create_item',
    args: { type: 'constraint', title: 'Full', body: 'b', scope: ['src/**'], tags: ['t'],
            severity: 'hard', always: true,
            observations: [{ category: 'limit', text: 'o', tags: ['x'], context: 'c' }] } },
  { id: 'create_item-idempotent', kind: 'mcp', tool: 'create_item',
    args: { type: 'constraint', title: 'Pool capped at 20' }, setup: seed,
    note: 'README 2707: reports the existing item rather than duplicating' },
  { id: 'create_item-relations-refused', kind: 'mcp', tool: 'create_item',
    args: { type: 'constraint', title: 'X', relations: [] },
    note: 'README 2725: refuses relations by name' },
  { id: 'create_item-origin-refused', kind: 'mcp', tool: 'create_item',
    args: { type: 'constraint', title: 'X', origin: 'human' },
    note: 'README 4070: no tool takes origin' },
  { id: 'create_item-unknown-arg', kind: 'mcp', tool: 'create_item',
    args: { type: 'constraint', title: 'X', nope: 1 } },
  { id: 'create_item-missing-required', kind: 'mcp', tool: 'create_item', args: { title: 'X' } },
  { id: 'create_item-hard-on-rationale', kind: 'mcp', tool: 'create_item',
    args: { type: 'decision', title: 'X', severity: 'hard' } },
  { id: 'create_item-always-on-rationale', kind: 'mcp', tool: 'create_item',
    args: { type: 'decision', title: 'X', always: true } },

  // update_item
  { id: 'update_item-title', kind: 'mcp', tool: 'update_item', setup: seed,
    args: { id: ID, title: 'New' }, note: 'may stage rather than apply under agentEdits: review' },
  { id: 'update_item-status-on-normative-refused', kind: 'mcp', tool: 'update_item', setup: seed,
    args: { id: ID, status: 'active' }, note: 'README 2708' },
  { id: 'update_item-scope-on-governing-refused', kind: 'mcp', tool: 'update_item', setup: seed,
    args: { id: ID, scope: ['x/**'] } },
  { id: 'update_item-always-on-governing-refused', kind: 'mcp', tool: 'update_item', setup: seed,
    args: { id: ID, always: true } },
  { id: 'update_item-severity-on-governing-refused', kind: 'mcp', tool: 'update_item', setup: seed,
    args: { id: ID, severity: 'soft' } },
  { id: 'update_item-extra', kind: 'mcp', tool: 'update_item', setup: seed,
    args: { id: ID, extra: { kind: 'perf' } } },
  { id: 'update_item-missing-id', kind: 'mcp', tool: 'update_item', args: { title: 'X' } },
  { id: 'update_item-unknown-arg', kind: 'mcp', tool: 'update_item', setup: seed,
    args: { id: ID, nope: 1 } },

  // the rest
  { id: 'get_item-ok', kind: 'mcp', tool: 'get_item', setup: seed, args: { id: ID } },
  { id: 'get_item-missing', kind: 'mcp', tool: 'get_item', args: { id: 'CONST-nope' } },
  { id: 'get_item-unknown-arg', kind: 'mcp', tool: 'get_item', setup: seed,
    args: { id: ID, nope: 1 } },
  { id: 'query_items-bare', kind: 'mcp', tool: 'query_items', setup: seed, args: {} },
  { id: 'query_items-type', kind: 'mcp', tool: 'query_items', setup: seed,
    args: { type: 'constraint' } },
  { id: 'query_items-all-filters', kind: 'mcp', tool: 'query_items', setup: seed,
    args: { type: 'constraint', status: 'active', tag: 'db', text: 'pool',
            path: 'src/db/w.ts', relation: 'relates_to', limit: 5 } },
  { id: 'query_items-bad-status', kind: 'mcp', tool: 'query_items', args: { status: 'nope' } },
  { id: 'query_items-unknown-arg', kind: 'mcp', tool: 'query_items', args: { nope: 1 } },
  { id: 'list_drafts-bare', kind: 'mcp', tool: 'list_drafts', args: {} },
  { id: 'list_drafts-type-limit', kind: 'mcp', tool: 'list_drafts',
    args: { type: 'constraint', limit: 5 } },
  { id: 'load_context-bare', kind: 'mcp', tool: 'load_context', setup: seed, args: {} },
  { id: 'load_context-any-arg-refused', kind: 'mcp', tool: 'load_context', args: { limit: 1 },
    note: 'no arguments are allowed at all' },
  { id: 'link_items-ok', kind: 'mcp', tool: 'link_items',
    setup: [SEED, ['add', 'constraint', 'Pool capped at 50', '--yes']],
    args: { from: ID, to: 'CONST-pool-capped-at-50', relation: 'relates_to' } },
  { id: 'link_items-supersedes-refused', kind: 'mcp', tool: 'link_items',
    setup: [SEED, ['add', 'constraint', 'Pool capped at 50', '--yes']],
    args: { from: ID, to: 'CONST-pool-capped-at-50', relation: 'supersedes' } },
  { id: 'link_items-missing-relation', kind: 'mcp', tool: 'link_items',
    args: { from: ID, to: 'X' } },
  { id: 'supersede_item-governing-refused', kind: 'mcp', tool: 'supersede_item', setup: seed,
    args: { id: ID, by: 'CONST-nope' }, note: 'README 2710: refuses governing normative items' },
  { id: 'refresh_item-non-snapshot', kind: 'mcp', tool: 'refresh_item', setup: seed,
    args: { id: ID } },
  { id: 'audit_log-bare', kind: 'mcp', tool: 'audit_log', setup: seed, args: {} },
  { id: 'audit_log-actor', kind: 'mcp', tool: 'audit_log', setup: seed, args: { actor: 'agent' } },
  { id: 'audit_log-origin-refused', kind: 'mcp', tool: 'audit_log', args: { origin: 'agent' },
    note: 'README 2715: the argument is actor, not origin' },
  { id: 'audit_log-since-span', kind: 'mcp', tool: 'audit_log', setup: seed, args: { since: '7d' } },
  { id: 'audit_log-all-filters', kind: 'mcp', tool: 'audit_log', setup: seed,
    args: { item: ID, session: 's', op: 'create', kind: 'mutation', actor: 'human',
            since: '12h', limit: 5 } },
  { id: 'mycontext_help-categories', kind: 'mcp', tool: 'mycontext_help',
    args: { topic: 'categories' } },
  { id: 'mycontext_help-scope', kind: 'mcp', tool: 'mycontext_help', args: { topic: 'scope' } },
  { id: 'mycontext_help-capture', kind: 'mcp', tool: 'mycontext_help', args: { topic: 'capture' } },
  { id: 'mycontext_help-workflow', kind: 'mcp', tool: 'mycontext_help', args: { topic: 'workflow' } },
  { id: 'mycontext_help-invalid-topic', kind: 'mcp', tool: 'mycontext_help', args: { topic: 'query' } },
  { id: 'mycontext_examples-rule', kind: 'mcp', tool: 'mycontext_examples', args: { type: 'rule' } },
  { id: 'mycontext_examples-invalid', kind: 'mcp', tool: 'mycontext_examples',
    args: { type: 'nosuchtype' } },
  { id: 'focus_context-empty-reports-only', kind: 'mcp', tool: 'focus_context', setup: seed,
    args: {} },
  { id: 'focus_context-tags', kind: 'mcp', tool: 'focus_context', setup: seed,
    args: { tags: ['db'] } },
  { id: 'focus_context-preview', kind: 'mcp', tool: 'focus_context', setup: seed,
    args: { tags: ['db'], preview: true } },
  { id: 'focus_context-clear', kind: 'mcp', tool: 'focus_context', setup: seed,
    args: { clear: true } },
  { id: 'focus_context-clear-with-axis-refused', kind: 'mcp', tool: 'focus_context', setup: seed,
    args: { clear: true, tags: ['db'] } },
  { id: 'ingest_document-no-args', kind: 'mcp', tool: 'ingest_document', args: {} },
  { id: 'ingest_document-session-without-anchor', kind: 'mcp', tool: 'ingest_document',
    args: { session: 'ING-nope' }, note: 'anchor and candidates required alongside session' },
];
```

- [ ] **Step 2: Run the sweep**

Run: `node harness/sweep.mjs mcp ./cases/mcp.mjs`
Expected: `swept 54 cases into evidence/mcp.jsonl`

- [ ] **Step 3: Verify the tool list is byte-stable across two runs**

Run:
```bash
node -e "const {openMcp}=await import('./harness/lib/mcp.mjs');const {createWorkspace,destroyWorkspace}=await import('./harness/lib/workspace.mjs');const ws=await createWorkspace();const a=await openMcp(ws);const x=JSON.stringify(await a.listTools());await a.close();const b=await openMcp(ws);const y=JSON.stringify(await b.listTools());await b.close();console.log(x===y?'byte-stable':'DRIFT');await destroyWorkspace(ws)" --input-type=module
```
Expected: `byte-stable` (README 2722)

- [ ] **Step 4: Commit**

```bash
git add harness/cases/mcp.mjs harness/evidence/mcp.jsonl
git commit -m "test(sweep): all 14 MCP tools and their refusals"
```

---

## Task 12: Hook sweep

**Files:**
- Create: `harness/cases/hooks.mjs`
- Evidence: `harness/evidence/hooks.jsonl`

**Interfaces:**
- Consumes: the `Case` shape from Task 6, `kind: 'hook'`
- Produces: `cases` (array of `Case`)

- [ ] **Step 1: Write the case table**

```javascript
// harness/cases/hooks.mjs
const SEED_PINNED = ['add', 'constraint', 'Always applies', '--yes'];
const SEED_SCOPED = ['add', 'constraint', 'Db rule', '--scope', 'src/db/**', '--yes'];
const seed = [SEED_PINNED, SEED_SCOPED];

const pre = (file, tool = 'Read') => ({
  session_id: 's1', tool_name: tool, tool_input: { file_path: file },
});

export const cases = [
  // SessionStart
  { id: 'session-start-startup', kind: 'hook', hook: 'sessionStart', setup: seed,
    payload: { session_id: 's1', source: 'startup' } },
  { id: 'session-start-resume', kind: 'hook', hook: 'sessionStart', setup: seed,
    payload: { session_id: 's1', source: 'resume' } },
  { id: 'session-start-compact', kind: 'hook', hook: 'sessionStart', setup: seed,
    payload: { session_id: 's1', source: 'compact' } },
  { id: 'session-start-clear', kind: 'hook', hook: 'sessionStart', setup: seed,
    payload: { session_id: 's1', source: 'clear' } },
  { id: 'session-start-empty-stdin', kind: 'hook', hook: 'sessionStart', payload: '' },
  { id: 'session-start-garbage-stdin', kind: 'hook', hook: 'sessionStart', payload: 'not json' },
  { id: 'session-start-empty-corpus', kind: 'hook', hook: 'sessionStart',
    payload: { session_id: 's1', source: 'startup' },
    note: 'a workspace with nothing in it must still exit 0' },
  { id: 'session-start-dedupe-same-session', kind: 'hook', hook: 'sessionStart', setup: seed,
    payload: { session_id: 's1', source: 'startup' },
    note: 'compare against session-start-startup: each item arrives once per session' },

  // PreToolUse — JIT injection
  { id: 'pre-tool-use-scoped-hit', kind: 'hook', hook: 'preToolUse', setup: seed,
    payload: pre('src/db/writer.ts'), note: 'scoped item should be injected' },
  { id: 'pre-tool-use-scoped-miss', kind: 'hook', hook: 'preToolUse', setup: seed,
    payload: pre('src/api/handler.ts'), note: 'no matching scope: nothing injected' },
  { id: 'pre-tool-use-edit-tool', kind: 'hook', hook: 'preToolUse', setup: seed,
    payload: pre('src/db/writer.ts', 'Edit') },
  { id: 'pre-tool-use-write-tool', kind: 'hook', hook: 'preToolUse', setup: seed,
    payload: pre('src/db/writer.ts', 'Write') },
  { id: 'pre-tool-use-notebook-edit', kind: 'hook', hook: 'preToolUse', setup: seed,
    payload: pre('nb.ipynb', 'NotebookEdit') },

  // PreToolUse — the deny path
  { id: 'pre-tool-use-deny-items', kind: 'hook', hook: 'preToolUse', setup: seed,
    payload: pre('.my_context/items/constraint/x.md', 'Write'),
    note: 'must emit the deny envelope with a per-path reason' },
  { id: 'pre-tool-use-deny-focus', kind: 'hook', hook: 'preToolUse', setup: seed,
    payload: pre('.my_context/state/focus.json', 'Write') },
  { id: 'pre-tool-use-deny-index', kind: 'hook', hook: 'preToolUse', setup: seed,
    payload: pre('.my_context/.index.db', 'Edit') },
  { id: 'pre-tool-use-deny-read-allowed', kind: 'hook', hook: 'preToolUse', setup: seed,
    payload: pre('.my_context/items/constraint/x.md', 'Read'),
    note: 'deny applies to Edit|Write only — Read must pass' },
  { id: 'pre-tool-use-deny-dotdot', kind: 'hook', hook: 'preToolUse', setup: seed,
    payload: pre('src/../.my_context/items/x.md', 'Write'),
    note: 'canonicalization must catch the traversal' },
  { id: 'pre-tool-use-deny-backslash', kind: 'hook', hook: 'preToolUse', setup: seed,
    payload: pre('.my_context\\items\\x.md', 'Write'),
    note: 'Windows separator must be normalized' },
  { id: 'pre-tool-use-deny-case', kind: 'hook', hook: 'preToolUse', setup: seed,
    payload: pre('.MY_CONTEXT/items/x.md', 'Write'),
    note: 'README 4185: matched case-insensitively' },
  { id: 'pre-tool-use-empty-stdin', kind: 'hook', hook: 'preToolUse', payload: '' },
  { id: 'pre-tool-use-garbage-stdin', kind: 'hook', hook: 'preToolUse', payload: 'not json' },
  { id: 'pre-tool-use-no-file-path', kind: 'hook', hook: 'preToolUse',
    payload: { session_id: 's1', tool_name: 'Read', tool_input: {} } },

  // PostToolUse — the watched-docs nudge
  { id: 'post-tool-use-watched', kind: 'hook', hook: 'postToolUse', setup: seed,
    payload: { session_id: 's1', tool_name: 'Write',
               tool_input: { file_path: 'docs/superpowers/specs/x.md' },
               tool_response: { success: true } },
    note: 'default watchedDocs includes docs/superpowers/specs/**' },
  { id: 'post-tool-use-unwatched', kind: 'hook', hook: 'postToolUse', setup: seed,
    payload: { session_id: 's1', tool_name: 'Write',
               tool_input: { file_path: 'src/index.ts' }, tool_response: { success: true } } },
  { id: 'post-tool-use-inside-my-context', kind: 'hook', hook: 'postToolUse', setup: seed,
    payload: { session_id: 's1', tool_name: 'Write',
               tool_input: { file_path: '.my_context/items/x.md' },
               tool_response: { success: true } },
    note: 'README 3922: writes inside .my_context never nudge' },
  { id: 'post-tool-use-empty-stdin', kind: 'hook', hook: 'postToolUse', payload: '' },
  { id: 'post-tool-use-garbage-stdin', kind: 'hook', hook: 'postToolUse', payload: 'not json' },

  // PreCompact
  { id: 'pre-compact-basic', kind: 'hook', hook: 'preCompact', setup: seed,
    payload: { session_id: 's1', transcript_path: 'nonexistent.jsonl' },
    note: 'writes a restore snapshot, keeps stdout clean' },
  { id: 'pre-compact-empty-stdin', kind: 'hook', hook: 'preCompact', payload: '' },
  { id: 'pre-compact-garbage-stdin', kind: 'hook', hook: 'preCompact', payload: 'not json' },
];
```

- [ ] **Step 2: Run the sweep**

Run: `node harness/sweep.mjs hooks ./cases/hooks.mjs`
Expected: `swept 31 cases into evidence/hooks.jsonl`

- [ ] **Step 3: Verify the fail-open invariant holds for every hook case**

Run:
```bash
node -e "const {load}=await import('./harness/lib/evidence.mjs');const r=await load('hooks');const bad=r.filter(x=>x.exitCode!==0);console.log(bad.length?'FAIL-OPEN VIOLATED: '+bad.map(b=>b.caseId).join(', '):'all '+r.length+' hook cases exit 0')" --input-type=module
```
Expected: `all 31 hook cases exit 0` — the plugin's `INV-hooks-fail-open` invariant

- [ ] **Step 4: Commit**

```bash
git add harness/cases/hooks.mjs harness/evidence/hooks.jsonl
git commit -m "test(sweep): all four hooks, injection, deny and fail-open"
```

---

## Task 13: Config, categories and profiles sweep

**Files:**
- Create: `harness/cases/config.mjs`
- Evidence: `harness/evidence/config.jsonl`

**Interfaces:**
- Consumes: the `Case` shape from Task 6; adds `configPatch: object` written to `.my_context/config.json` before the case runs
- Produces: `cases` (array of `Case`)

- [ ] **Step 1: Teach the sweep runner to apply config patches**

Add to `harness/sweep.mjs` inside `runOne`, after the `fixture` line:

```javascript
    if (kase.configPatch) {
      const { writeFileSync } = await import('node:fs');
      const { join } = await import('node:path');
      writeFileSync(
        join(ws, '.my_context', 'config.json'),
        JSON.stringify(kase.configPatch, null, 2),
        'utf8',
      );
    }
```

- [ ] **Step 2: Write the case table**

```javascript
// harness/cases/config.mjs
const CATEGORIES = [
  'constraint', 'invariant', 'rule', 'requirement', 'standard', 'pattern', 'glossary',
  'instruction', 'non_goal', 'open_question', 'runbook', 'environment', 'known_issue',
  'adr', 'decision', 'lesson', 'tradeoff', 'assumption', 'edge_case', 'risk', 'reference',
];

const NORMATIVE = new Set([
  'constraint', 'invariant', 'rule', 'requirement', 'standard', 'pattern', 'glossary',
  'instruction', 'non_goal', 'open_question', 'runbook', 'environment', 'known_issue',
]);

// One add and one list per category — 42 cases proving all 21 are enabled by default.
const perCategory = CATEGORIES.flatMap((c) => [
  {
    id: `add-${c}`,
    kind: 'cli',
    argv: c === 'reference'
      ? ['add', 'reference', `A ${c}`, '--file', 'README.md']
      : ['add', c, `A ${c}`, ...(NORMATIVE.has(c) ? ['--yes'] : [])],
    note: `${NORMATIVE.has(c) ? 'normative' : 'rationale'} tier`,
  },
  { id: `list-${c}`, kind: 'cli', argv: ['list', c] },
]);

export const cases = [
  ...perCategory,

  // --- profiles ---
  { id: 'profile-minimal', kind: 'cli', configPatch: { profile: 'minimal' }, argv: ['status', '--json'],
    note: 'minimal enables exactly 8 categories' },
  { id: 'profile-minimal-disabled-category', kind: 'cli', configPatch: { profile: 'minimal' },
    argv: ['add', 'runbook', 'X', '--yes'], note: 'runbook is not in minimal' },
  { id: 'profile-standard', kind: 'cli', configPatch: { profile: 'standard' }, argv: ['status', '--json'] },
  { id: 'profile-full-refused', kind: 'cli', configPatch: { profile: 'full' }, argv: ['status'],
    note: 'README 2864: full was removed and is refused by name' },
  { id: 'profile-unknown-refused', kind: 'cli', configPatch: { profile: 'nope' }, argv: ['status'] },

  // --- budgets ---
  { id: 'budgets-defaults', kind: 'cli', argv: ['status', '--json'],
    note: 'pinned 6000, jit 6000, restored 8000, index 1200' },
  { id: 'budgets-override', kind: 'cli',
    configPatch: { budgets: { pinned: 100, jit: 100, restored: 100, index: 50 } },
    argv: ['status'] },
  { id: 'budgets-unknown-key-refused', kind: 'cli', configPatch: { budgets: { nope: 1 } },
    argv: ['status'] },
  { id: 'budgets-negative-refused', kind: 'cli', configPatch: { budgets: { pinned: -1 } },
    argv: ['status'] },
  { id: 'budgets-non-number-refused', kind: 'cli', configPatch: { budgets: { pinned: 'lots' } },
    argv: ['status'] },
  { id: 'budgets-spill-note', kind: 'hook', hook: 'sessionStart',
    configPatch: { budgets: { pinned: 50, jit: 6000, restored: 8000, index: 1200 } },
    setup: [['add', 'constraint', 'A very long constraint title that will not fit the budget',
             '--body', 'x'.repeat(4000), '--yes']],
    payload: { session_id: 's1', source: 'startup' },
    note: 'README 1686: spilled items must be named, never silently dropped' },

  // --- top-level keys ---
  { id: 'unknown-top-level-key-refused', kind: 'cli', configPatch: { budget: {} }, argv: ['status'],
    note: 'README 3905: refused by name, nothing loads' },
  { id: 'watched-docs-override', kind: 'hook', hook: 'postToolUse',
    configPatch: { watchedDocs: ['notes/**'] },
    payload: { session_id: 's1', tool_name: 'Write', tool_input: { file_path: 'notes/x.md' },
               tool_response: { success: true } },
    note: 'README 3994: watchedDocs replaces the defaults' },
  { id: 'watched-docs-override-hides-default', kind: 'hook', hook: 'postToolUse',
    configPatch: { watchedDocs: ['notes/**'] },
    payload: { session_id: 's1', tool_name: 'Write',
               tool_input: { file_path: 'docs/superpowers/specs/x.md' },
               tool_response: { success: true } } },

  // --- per-category overrides ---
  { id: 'category-disabled', kind: 'cli', configPatch: { categories: { runbook: { enabled: false } } },
    argv: ['add', 'runbook', 'X', '--yes'] },
  { id: 'category-prefix-override', kind: 'cli',
    configPatch: { categories: { rule: { prefix: 'POLICY' } } },
    argv: ['add', 'rule', 'Write the failing test first', '--yes'],
    note: 'README 3625: mints POLICY-...' },
  { id: 'category-prefix-invalid', kind: 'cli',
    configPatch: { categories: { rule: { prefix: 'not-valid!' } } }, argv: ['status'] },
  { id: 'category-tier-override', kind: 'cli',
    configPatch: { categories: { decision: { tier: 'normative' } } }, argv: ['status', '--json'] },
  { id: 'category-agentEdits-allow', kind: 'cli',
    configPatch: { categories: { constraint: { agentEdits: 'allow' } } }, argv: ['status'] },
  { id: 'category-agentEdits-invalid', kind: 'cli',
    configPatch: { categories: { constraint: { agentEdits: 'nope' } } }, argv: ['status'] },
  { id: 'category-scopePolicy-required', kind: 'cli',
    configPatch: { categories: { constraint: { scopePolicy: 'required' } } },
    argv: ['add', 'constraint', 'No scope given', '--yes'],
    note: 'README 3866: required refuses at capture' },
  { id: 'category-scopePolicy-inert', kind: 'cli',
    configPatch: { categories: { constraint: { scopePolicy: 'inert' } } }, argv: ['doctor'] },
  { id: 'category-extraFields-refused', kind: 'cli',
    configPatch: { categories: { rule: { extraFields: ['x'] } } }, argv: ['status'],
    note: 'README 3640: refused by name with a dedicated hint' },
  { id: 'category-unknown-key-refused', kind: 'cli',
    configPatch: { categories: { rule: { nope: 1 } } }, argv: ['status'] },
  { id: 'custom-category-complete', kind: 'cli',
    configPatch: { categories: { security_control: { tier: 'normative', description: 'A control' } } },
    argv: ['add', 'security_control', 'All admin endpoints require MFA', '--yes'],
    note: 'README 3616: derived prefix should be SECURI' },
  { id: 'custom-category-missing-tier', kind: 'cli',
    configPatch: { categories: { security_control: { description: 'A control' } } }, argv: ['status'] },
  { id: 'custom-category-missing-description', kind: 'cli',
    configPatch: { categories: { security_control: { tier: 'normative' } } }, argv: ['status'] },
  { id: 'unknown-category-still-indexed', kind: 'cli',
    setup: [['add', 'runbook', 'A runbook', '--yes']],
    configPatch: { categories: { runbook: { enabled: false } } },
    argv: ['doctor'], note: 'README 3699: one unknown_category warning per item' },
];
```

- [ ] **Step 3: Run the sweep**

Run: `node harness/sweep.mjs config ./cases/config.mjs`
Expected: `swept 72 cases into evidence/config.jsonl`

- [ ] **Step 4: Confirm all 21 categories accepted a capture**

Run:
```bash
node -e "const {load}=await import('./harness/lib/evidence.mjs');const r=await load('config');const adds=r.filter(x=>x.caseId.startsWith('add-'));const bad=adds.filter(x=>x.exitCode!==0);console.log(adds.length+' category adds, '+bad.length+' failed'+(bad.length?': '+bad.map(b=>b.caseId).join(', '):''))" --input-type=module
```
Expected: `21 category adds, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add harness/cases/config.mjs harness/sweep.mjs harness/evidence/config.jsonl
git commit -m "test(sweep): config schema, profiles and all 21 categories"
```

---

## Task 14: Slash command static audit

**Files:**
- Create: `harness/cases/slash-audit.mjs`
- Evidence: `harness/evidence/slash.jsonl`

**Interfaces:**
- Consumes: `record` from `harness/lib/evidence.mjs`, `REPO` from `harness/lib/workspace.mjs`
- Produces: a standalone script (run directly, not through `sweep.mjs`) that records one row per assertion

Slash commands cannot be invoked outside a Claude Code session, so this task audits them statically — file count, frontmatter validity, `disable-model-invocation`, quoted `argument-hint`, and generator parity. Behavioural verification happens in Task 15.

- [ ] **Step 1: Write the audit script**

```javascript
// harness/cases/slash-audit.mjs
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { REPO } from '../lib/workspace.mjs';
import { record } from '../lib/evidence.mjs';

const execFileAsync = promisify(execFile);
const dir = join(REPO, 'commands');
const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));

await record('slash', 'file-count', {
  expected: 66, actual: files.length, pass: files.length === 66,
  note: 'README 1723 claims 66 slash commands',
});

const addFiles = files.filter((f) => f.startsWith('add-'));
const listFiles = files.filter((f) => f.startsWith('list-'));
await record('slash', 'add-count', { expected: 21, actual: addFiles.length, pass: addFiles.length === 21 });
await record('slash', 'list-count', { expected: 21, actual: listFiles.length, pass: listFiles.length === 21 });

const missingDisable = [];
const unquotedHint = [];
const noFrontmatter = [];

for (const f of files) {
  const text = await readFile(join(dir, f), 'utf8');
  if (!text.startsWith('---')) { noFrontmatter.push(f); continue; }
  const fm = text.slice(3, text.indexOf('\n---', 3));
  if (f !== 'LoadMyContext.md' && !/disable-model-invocation:\s*true/.test(fm)) {
    missingDisable.push(f);
  }
  const hint = fm.match(/argument-hint:\s*(.*)/);
  // An unquoted hint containing [ or | is invalid YAML — the defect README 1886 describes.
  if (hint && !/^".*"$/.test(hint[1].trim()) && /[[|]/.test(hint[1])) unquotedHint.push(f);
}

await record('slash', 'frontmatter-present', {
  offenders: noFrontmatter, pass: noFrontmatter.length === 0,
});
await record('slash', 'disable-model-invocation', {
  offenders: missingDisable, pass: missingDisable.length === 0,
  note: 'README 1882: all 65 carry it, LoadMyContext is the sole exception',
});
await record('slash', 'loadmycontext-is-the-exception', {
  pass: !(await readFile(join(dir, 'LoadMyContext.md'), 'utf8')).includes('disable-model-invocation'),
});
await record('slash', 'argument-hint-quoted', {
  offenders: unquotedHint, pass: unquotedHint.length === 0,
  note: 'README 1886: nineteen once shipped invalid YAML; hints are quoted now',
});

// Generator parity: regenerating must not change any committed file.
// Guard first — the restore below is `git checkout --`, which would discard
// pre-existing uncommitted work in the clone. Refuse rather than destroy it.
const preState = await execFileAsync('git', ['status', '--short', 'commands'], { cwd: REPO });
if (preState.stdout.trim() !== '') {
  throw new Error(`refusing to run: my-context/commands is dirty:\n${preState.stdout}`);
}
const gen = await execFileAsync('npm', ['run', 'gen:commands'], { cwd: REPO, shell: true })
  .catch((e) => ({ stdout: e.stdout ?? '', stderr: e.stderr ?? '' }));
const status = await execFileAsync('git', ['status', '--short', 'commands'], { cwd: REPO });
await record('slash', 'generator-parity', {
  stdout: gen.stdout, gitStatus: status.stdout, pass: status.stdout.trim() === '',
  note: 'README 1878: a test fails if committed files and the generator disagree',
});

// Restore the clone regardless of outcome.
await execFileAsync('git', ['checkout', '--', 'commands'], { cwd: REPO });

console.log(`slash audit recorded ${8} assertions`);
```

- [ ] **Step 2: Run the audit**

Run: `node harness/cases/slash-audit.mjs`
Expected: `slash audit recorded 8 assertions`

- [ ] **Step 3: Confirm the clone is clean afterwards**

Run: `git -C my-context status --short`
Expected: empty output

- [ ] **Step 4: Commit**

```bash
git add harness/cases/slash-audit.mjs harness/evidence/slash.jsonl
git commit -m "test(audit): slash command static audit and generator parity"
```

---

## Task 15: Live pass in Claude Code

**Files:**
- Create: `reports/LIVE-PASS.md`

**Interfaces:**
- Consumes: nothing from earlier tasks — this validates the real integration path
- Produces: `reports/LIVE-PASS.md`, a checklist with observed results, referenced by `COVERAGE.md`

This is the only task requiring the user. Batch every restart-dependent check so the user is interrupted twice, not repeatedly.

- [ ] **Step 1: Install the plugin exactly as the README documents**

```bash
cd D:/Users/UserC/source/repos/test_mycontext_plugin/my-context
claude plugin marketplace add ./
claude plugin install mycontext@mycontext
```

Record the exact output. README 1762 claims *"The install survives a restart."*

- [ ] **Step 2: Verify the component inventory the README promises**

Run: `claude plugin details mycontext@mycontext`
Expected per README 1780: *"the 38 commands and the `mycontext` skill, the four hooks … and the one MCP server"*.
The inventory actually holds 66 commands. **Record the real number** — this confirms or refutes the suspected stale-count defect in the installation instructions.

- [ ] **Step 3: Ask the user to restart Claude Code**

Tell the user: the plugin is installed; a restart is needed for hooks, slash commands and the MCP server to load. Ask them to restart and say when they're back.

- [ ] **Step 4: After restart, confirm the interference audit held**

Verify `task-orchestrator` no longer injects at SessionStart (v3.6.0 ships no `hooks.json`), and that no GSD hook fires on Write/Edit. Record both. This is the assumption §2 of the spec explicitly refused to take on faith.

- [ ] **Step 5: Observe session-start injection**

Check whether the session opened with the `## my_context — these govern this project` block, whether pinned items appear in full, whether the index block follows, and whether the rationale count line and the `→ use mycontext list…` line are present. Record verbatim.

- [ ] **Step 6: Exercise the slash commands**

In a workspace with a seeded corpus, run and record: `/mycontext:status`, `/mycontext:list-constraint --full`, `/mycontext:search`, `/mycontext:show`, `/mycontext:add-constraint`, `/mycontext:review`, `/mycontext:LoadMyContext`, `/mycontext:focus`, `/mycontext:audit`, `/mycontext:doctor`.

For each write command, confirm README 1837's claim that it *"previews by running the CLI command without `--yes`"* and declines rather than acting.

- [ ] **Step 7: Observe JIT injection and the deny envelope live**

Read a file matching a scoped item's glob; record whether the scoped item is injected. Then attempt a Write into `.my_context/items/` and record the deny message the user actually sees.

- [ ] **Step 8: Confirm the MCP server is connected and reports its version**

Run: `claude mcp list`
Record the `mycontext` row. Cross-reference with Finding F3 — clients see `0.1.0`.

- [ ] **Step 9: Write the live pass report**

Write `reports/LIVE-PASS.md` with one row per check: what was run, what was expected (with README line reference where applicable), what was observed, and pass/fail.

- [ ] **Step 10: Commit**

```bash
git add reports/LIVE-PASS.md
git commit -m "test(live): in-session verification of hooks, slash commands and MCP"
```

---

## Task 16: README claim audit

**Files:**
- Create: `harness/claims.mjs`
- Create: `reports/CLAIMS.md`

**Interfaces:**
- Consumes: `load` from `harness/lib/evidence.mjs`; all evidence files from Tasks 7–15
- Produces: `reports/CLAIMS.md` — one row per claim with verdict and evidence id

The claim set is the ~180 numbered assertions extracted from the README with file and line references, grouped A–I: counts and inventory, hooks and injection, budgets, configuration semantics, CLI behaviour, focus, trust boundary, capture/ingest/lessons/references, and meta/process.

- [ ] **Step 1: Write the claim table and verdict helper**

```javascript
// harness/claims.mjs
import { load } from './lib/evidence.mjs';

/**
 * Each claim names the README wording, its location, and the evidence id that
 * settles it. `check` receives the evidence record and returns true/false.
 * A claim with no evidence id is reported as UNVERIFIED, never as passing.
 */
export const claims = [
  {
    id: 'A4', section: 'counts',
    text: 'claude plugin details prints "the 38 commands"',
    where: 'README.md:1780',
    evidence: 'slash/file-count',
    check: (r) => r.actual === 38,
  },
  {
    id: 'A1', section: 'counts',
    text: '66 slash commands',
    where: 'README.md:1723',
    evidence: 'slash/file-count',
    check: (r) => r.actual === 66,
  },
  {
    id: 'E68', section: 'cli',
    text: 'A single-valued flag given twice is refused',
    where: 'README.md:1927',
    evidence: 'cli-capture/add-repeated-single-value',
    check: (r) => r.exitCode !== 0,
  },
  {
    id: 'E69', section: 'cli',
    text: '--body and --file together are refused',
    where: 'README.md:1928',
    evidence: 'cli-capture/add-body-and-file-conflict',
    check: (r) => r.exitCode !== 0,
  },
  {
    id: 'E72', section: 'cli',
    text: 'init does NOT check unknown flags',
    where: 'README.md:2841',
    evidence: 'cli-capture/init-unknown-arg',
    check: (r) => r.exitCode === 0,
  },
  {
    id: 'H134', section: 'global',
    text: 'mycontext init --global is refused, and the refusal names the global root',
    where: 'README.md:4494',
    evidence: 'cli-capture/init-global-refused',
    check: (r) => r.exitCode !== 0 && /my-context/.test(r.stdout + r.stderr),
  },
  {
    id: 'G111', section: 'trust',
    text: 'No tool takes an origin argument',
    where: 'README.md:4070',
    evidence: 'mcp/create_item-origin-refused',
    check: (r) => JSON.stringify(r.result).includes('origin'),
  },
  {
    id: 'G114', section: 'trust',
    text: 'create_item refuses relations by name',
    where: 'README.md:2725',
    evidence: 'mcp/create_item-relations-refused',
    check: (r) => JSON.stringify(r.result).includes('relations'),
  },
  {
    id: 'B20', section: 'hooks',
    text: 'Bash is not matched by PreToolUse',
    where: 'README.md:4178',
    evidence: null, // settled by reading hooks/hooks.json, recorded in COVERAGE.md
    check: null,
  },
  {
    id: 'F104', section: 'focus',
    text: 'Focus never hides a severity: hard item',
    where: 'README.md:2484',
    evidence: 'cli-retrieve/focus-hard-item-never-hidden',
    check: (r) => /Never commit a secret/.test(r.stdout),
  },
  {
    id: 'D50', section: 'config',
    text: 'An unknown profile name is an error at load time, and that includes full',
    where: 'README.md:2864',
    evidence: 'config/profile-full-refused',
    check: (r) => r.exitCode !== 0 || /full/.test(r.stdout + r.stderr),
  },
  {
    id: 'C39', section: 'budgets',
    text: 'Defaults: pinned 6000, jit 6000, restored 8000, index 1200',
    where: 'README.md:1640',
    evidence: 'config/budgets-defaults',
    check: (r) => r.exitCode === 0,
  },
  {
    id: 'I176', section: 'meta',
    text: 'One test fails if the four places that declare the version drift apart',
    where: 'README.md:4517',
    evidence: 'mcp/handshake-and-list',
    check: (r) => r.result?.initializeResult?.serverInfo?.version === '1.0.0',
  },
];

export async function verdicts() {
  const cache = new Map();
  const out = [];
  for (const c of claims) {
    if (!c.evidence || !c.check) {
      out.push({ ...c, verdict: 'UNVERIFIED' });
      continue;
    }
    const [surface] = c.evidence.split('/');
    if (!cache.has(surface)) cache.set(surface, await load(surface));
    const row = cache.get(surface).find((r) => r.id === c.evidence);
    if (!row) { out.push({ ...c, verdict: 'NO-EVIDENCE' }); continue; }
    let verdict;
    try { verdict = c.check(row) ? 'PASS' : 'FAIL'; }
    catch (err) { verdict = `ERROR: ${err.message}`; }
    out.push({ ...c, verdict });
  }
  return out;
}
```

- [ ] **Step 2: Extend the table to the full claim set**

Add the remaining claims from the extracted list, keeping the same shape. Every claim needs `id`, `section`, `text`, `where`, and either an `evidence`+`check` pair or an explicit `null` marking it unverifiable by the harness. Never invent an evidence id — a claim with no matching case is `UNVERIFIED`, and that is a finding in itself.

Where a claim needs a case that does not yet exist, add the case to the relevant table in Tasks 7–13 and re-run that sweep.

- [ ] **Step 3: Generate the claims report**

```bash
node -e "const {verdicts}=await import('./harness/claims.mjs');const v=await verdicts();const by=(k)=>v.filter(x=>x.verdict===k).length;console.log('PASS',by('PASS'),'FAIL',by('FAIL'),'UNVERIFIED',by('UNVERIFIED'),'NO-EVIDENCE',by('NO-EVIDENCE'));const rows=v.map(c=>'| '+[c.id,c.section,c.text.replace(/\|/g,'\\\\|'),c.where,c.evidence??'—',c.verdict].join(' | ')+' |').join('\n');const md='# README claim audit\n\n| Claim | Section | Assertion | Where | Evidence | Verdict |\n|---|---|---|---|---|---|\n'+rows+'\n';await (await import('node:fs/promises')).writeFile('reports/CLAIMS.md',md)" --input-type=module
```
Expected: counts printed, `reports/CLAIMS.md` written

- [ ] **Step 4: Commit**

```bash
git add harness/claims.mjs reports/CLAIMS.md
git commit -m "test(audit): README claim verification against captured evidence"
```

---

## Task 17: FINDINGS.md

**Files:**
- Create: `reports/FINDINGS.md`

**Interfaces:**
- Consumes: all evidence files, `reports/CLAIMS.md`, `reports/LIVE-PASS.md`
- Produces: `reports/FINDINGS.md` — the artifact handed to the plugin's author

- [ ] **Step 1: Write the header and the three findings already established**

```markdown
# my-context v1.0.0 — findings

**Environment:** Windows 11 Pro 26300, Node v24.14.0, Claude Code 2.1.233.
Commit `2f306ad`, tag `v1.0.0`. Linux and macOS were not exercised; every finding
below is scoped to this environment unless stated otherwise.

**How to read this:** each finding names what was run, what was expected and why,
what actually happened, and a suggested fix. Evidence ids refer to records in
`harness/evidence/*.jsonl` — every claim here is traceable to a captured run.

---

## F1 — 11 tests fail on Node 24.14.0 (node:sqlite warning reaches stderr)

**Severity:** high — the suite is red on a supported Node version
**Surface:** test suite, hooks, MCP server
**Evidence:** baseline run; reproduced directly via `harness/lib/hooks.mjs`

**Expected.** `npm test` green on Node `>=24.0.0`, the plugin's stated floor.

**Actual.** 2308 pass, 11 fail — 9 in `test/hooks/hook-binaries-e2e.test.ts`, 2 in
`test/mcp/server-e2e.test.ts`. All assert stderr is byte-empty. On Node 24.14.0
`node:sqlite` emits `ExperimentalWarning: SQLite is an experimental feature` to
stderr, so every hook binary and the MCP server inherit 169 bytes of warning.
Running `src/hooks/session-start.ts` directly confirms it: stdout correct, exit 0,
warning on stderr.

**Compounding documentation defect.** The plugin's own `CONST-node-24-no-build-step`
item states *"Node >= 24.0.0 — required for stable node:sqlite"*. That is false on
24.14.0; `node:sqlite` is still experimental and still warns.

**Why CI did not catch it.** `.github/workflows/ci.yml` pins `node-version: '24'`,
which floats. CI was green on whatever 24.x was current at release and has gone red
since on an unchanged commit.

**Suggested fix.** Add `--no-warnings=ExperimentalWarning` (or
`process.removeAllListeners('warning')` at hook and server entry points) so the
plugin's own processes do not emit it, rather than relaxing the assertions —
`RULE-never-weaken-byte-identity` argues against weakening the test. Then correct
the constraint item's wording, and consider pinning CI to a specific 24.x so the
matrix is reproducible.

---

## F2 — `.mcp.json` cannot resolve `${CLAUDE_PLUGIN_ROOT}` in project scope

**Severity:** low — affects contributors, not end users
**Surface:** packaging
**Evidence:** `claude mcp list` diagnostics

**Expected.** Opening the repo in Claude Code should not produce a broken MCP entry.

**Actual.** Claude Code reports
`[Warning] [mycontext] mcpServers.mycontext: Missing environment variables: CLAUDE_PLUGIN_ROOT`.
`.mcp.json` sits at the repo root and is therefore also read as a *project* MCP
config whenever the repo is the working directory, where that variable is undefined.

**Scope.** Both documented install paths (`claude plugin install mycontext@mycontext`
and `claude --plugin-dir …`) set the variable, so end users are unaffected. This
bites the author and contributors working inside the repo.

**Suggested fix.** Either add `mycontext` to `disabledMcpjsonServers` in the repo's
own `.claude/settings.json`, or document the warning as expected when working in the
repo. There is no way to make one file correct in both scopes.

---

## F3 — MCP `serverInfo.version` is `0.1.0` while the plugin is `1.0.0`

**Severity:** medium — every MCP client sees the wrong version
**Surface:** MCP server
**Evidence:** `mcp/handshake-and-list`

**Expected.** `initialize` reports the shipped version. `VERSIONING.md:107` promises
*"one test fails if the four places that declare it drift apart"*.

**Actual.** The handshake returns `{"name":"mycontext","version":"0.1.0"}`.
`src/mcp/protocol.ts:33` hardcodes it:

    export const SERVER_INFO = { name: 'mycontext', version: '0.1.0' };

**Root cause.** `serverInfo.version` is a **fifth** version declaration site. The
parity test covers four — `package.json`, `plugin.json`, and `marketplace.json` twice
— and never learned about this one, so it drifted by a full major version unnoticed.

**Suggested fix.** Import the version from `src/core/version.ts` rather than
hardcoding, and extend the version-parity test to cover `SERVER_INFO.version` so the
fifth site is guarded like the other four.
```

- [ ] **Step 2: Add every FAIL from the claim audit as a finding**

For each `FAIL` row in `reports/CLAIMS.md`, write a finding in the same shape. Group
documentation-only defects (the README says X, the code does Y, and Y is correct)
under a single **F-DOC** section with a table, since each needs the same fix — a text
correction — and a reader should not have to page through twenty near-identical entries.

Known documentation defects to include, each already located: the stale "38 commands"
in the installation instructions; §8's claim that nothing is tagged when `v1.0.0` is;
§8's claim that Linux is uncertified when the ROADMAP records certification; *"These
twenty-five are all of them"* over a flag table missing at least 15 real flags; `init`
listed among commands that ignore unknown flags while `init --global` is refused;
*"There is no slash command for ingest"* contradicted by `commands/ingest.md`;
`VERSIONING.md` still describing the project as `0.x` with 12/28/64 counts; and *"the
same twenty categories"* against a catalogue of 21.

- [ ] **Step 3: Add every undocumented-but-real behaviour as a doc-gap finding**

At minimum `audit --until`, `audit --role`, `audit replay-ledger`, `focus --show`,
and `focus --tag`. Each needs its evidence id and a one-line suggested doc addition.

- [ ] **Step 4: Sort by severity and add a summary table at the top**

Highest severity first. The summary table gives id, severity, surface, and a
one-line description, so the author can triage without reading the whole document.

- [ ] **Step 5: Add the environment-restoration appendix**

Repeat the four restore commands from the spec verbatim, so the author (or the user)
can undo the test environment without hunting through this conversation.

- [ ] **Step 6: Commit**

```bash
git add reports/FINDINGS.md
git commit -m "docs(reports): developer-facing findings for my-context v1.0.0"
```

---

## Task 18: COVERAGE.md

**Files:**
- Create: `reports/COVERAGE.md`

**Interfaces:**
- Consumes: all evidence files, `reports/CLAIMS.md`, `reports/LIVE-PASS.md`
- Produces: `reports/COVERAGE.md`

- [ ] **Step 1: Generate the per-surface coverage tables**

```bash
node -e "const {load}=await import('./harness/lib/evidence.mjs');const surfaces=['cli-capture','cli-mutate','cli-retrieve','cli-pipelines','mcp','hooks','config','slash'];let md='# Coverage\n\n## Cases run per surface\n\n| Surface | Cases | Harness errors |\n|---|---|---|\n';let total=0;for(const s of surfaces){const r=await load(s);total+=r.length;md+='| '+s+' | '+r.length+' | '+r.filter(x=>x.harnessError).length+' |\n';}md+='| **Total** | **'+total+'** | |\n';await (await import('node:fs/promises')).writeFile('reports/COVERAGE.md',md);console.log('total cases:',total)" --input-type=module
```
Expected: a total in the high 300s, 0 harness errors

- [ ] **Step 2: Write the two-axis matrix by hand beneath the generated tables**

Four sections, one per quadrant: verified (documented and correct), defects
(documented and wrong), doc gaps (undocumented and correct), latent bugs
(undocumented and wrong). Each row names the element, its evidence id, and its
finding id where one exists.

- [ ] **Step 3: Write the explicit not-covered section**

State plainly what this campaign did **not** establish, with the reason:

- Linux and macOS behaviour — CI covers Linux; we ran Windows only.
- Performance ceilings beyond the repo's own `test:perf` suite.
- Subagent injection behaviour — needs a live subagent, only partially observable.
- Compaction restore end to end — `PreCompact` snapshot writing is covered; the
  restore path depends on a real compaction event.
- Any claim marked `UNVERIFIED` in `reports/CLAIMS.md`, listed individually.

An audit that hides its own gaps is worse than one that admits them; this section
is the point of the document.

- [ ] **Step 4: Commit**

```bash
git add reports/COVERAGE.md
git commit -m "docs(reports): two-axis coverage matrix with explicit gaps"
```

---

## Task 19: TUTORIAL.md

**Files:**
- Create: `reports/TUTORIAL.md`

**Interfaces:**
- Consumes: evidence records for every command shown; `reports/LIVE-PASS.md` for the in-session steps
- Produces: `reports/TUTORIAL.md`

Every command and every output block is copied from a captured run. Nothing is written from memory — if an output block has no evidence id behind it, it does not go in.

- [ ] **Step 1: Write the quickstart walkthrough**

Sections, in order, each with the real command and its real output:

1. **What this is for** — three sentences: you keep repeating project rules to Claude; my-context stores them as Markdown and injects the relevant ones automatically.
2. **Install** — the two halves, verbatim from README 1741–1760, with the real output of each. Note the Node 24 requirement up front, since it is a hard gate.
3. **Initialise** — `mycontext init`, showing the three things it creates and why the directory should be committed.
4. **Capture your first rule** — `mycontext add constraint "Uploads capped at 10 MB" --body … --yes`, showing the preview line and the creation line, and explaining why `--yes` was needed here but not for a `decision`.
5. **See it come back** — restart, and show the `## my_context — these govern this project` block. This is the moment the tool justifies itself; give it room.
6. **Scope it to a directory** — add a scoped constraint, then read a matching file and show the just-in-time injection. Explain that the trigger is a file path, not a decision.
7. **Let Claude capture something** — show `create_item` landing a normative item as a `draft`, then `mycontext review` and promoting it. Explain the trust boundary: an agent can propose, only a human can make it govern.
8. **Find things later** — `mycontext search`, `mycontext show`, and one `mycontext query` example.
9. **When something looks wrong** — `mycontext doctor`, and the "delete the index, it rebuilds" recovery.

- [ ] **Step 2: Write the reference appendix**

Four tables: all 30 CLI commands with their flags and verified status; all 14 MCP
tools; all 66 slash commands; all 21 categories with tier and prefix. Status column
values are `verified`, `defect (Fn)`, or `not covered`, matching `COVERAGE.md`.

- [ ] **Step 3: Verify every command block in the tutorial has evidence**

Run:
```bash
node -e "const fs=await import('node:fs/promises');const t=await fs.readFile('reports/TUTORIAL.md','utf8');const cmds=[...t.matchAll(/^\\\$ (mycontext .+)$/gm)].map(m=>m[1]);console.log(cmds.length+' commands shown');cmds.forEach(c=>console.log('  '+c))" --input-type=module
```
Then confirm by inspection that each corresponds to a captured evidence record. Any
command shown but never run is removed or run and captured — the tutorial must not
contain a single invented output.

- [ ] **Step 4: Commit**

```bash
git add reports/TUTORIAL.md
git commit -m "docs(reports): new-user tutorial with reference appendix"
```

---

## Task 20: Restore the environment and close out

**Files:**
- Modify: `C:/Users/UserC/.claude/settings.json`

**Interfaces:**
- Consumes: `reports/FINDINGS.md` (the restoration appendix)
- Produces: a restored environment and a final summary for the user

- [ ] **Step 1: Re-run the baseline to confirm nothing we did changed the plugin**

Run: `node harness/baseline.mjs`
Expected: `baseline matches the pin` — the same 11 known-red failures, no more

- [ ] **Step 2: Confirm the plugin clone is clean apart from any deliberate fix branch**

Run: `git -C my-context status --short && git -C my-context branch`
Expected: clean working tree; any fixes live on their own branch, unpushed

- [ ] **Step 3: Ask the user whether to restore the disabled plugins now**

The plugin stays installed — that was the goal. But the four disabled items were
disabled for testing, and the user may want them back. Ask before restoring; they may
prefer to keep the quieter environment.

- [ ] **Step 4: Restore on confirmation**

```bash
# GSD hooks: copy the "hooks" block back from the backup
#   C:/Users/UserC/.claude/settings.backup-2026-08-17-mycontext-test.json
claude mcp add gsd-2 -s user -- gsd --mode mcp
claude plugin enable agentic-awesome-skills@antigravity-awesome-skills
claude plugin enable context-management@claude-code-workflows
claude plugin enable agent-orchestration@claude-code-workflows
```

- [ ] **Step 5: Commit and summarise**

```bash
git add -A
git commit -m "chore: close out the my-context test campaign"
```

Report to the user: total cases run, findings by severity, claim pass/fail counts,
what was not covered, and where the three deliverables live.

---

## Self-Review

**Spec coverage.** Every section of the design maps to a task: §2 environment → Task 20
(restoration) and Task 15 step 4 (verifying the `task-orchestrator` assumption); §3 baseline
→ Task 6 and Task 20 step 1; §4 inventory → Tasks 7–14; §5 two-axis model → Tasks 16 and 18;
§6 harness → Tasks 1–6; §7 phases → Tasks 1–19; §8 deliverables → Tasks 17–19; §9 risks →
the disposable-workspace rule in Task 6, the corpus check in Task 8 step 3, the fail-open
check in Task 12 step 3, and the evidence-id requirement in Task 16; §10 findings F1/F2 →
Task 17 step 1, joined by F3 found while probing.

**Placeholder scan.** No TBDs. Tasks 16 step 2, 17 steps 2–3, 18 step 2 and 19 steps 1–2
describe work whose *content* depends on results that do not exist yet — the claim verdicts
and the findings they produce. Each states its shape, its source, and its acceptance rule
rather than deferring the decision, which is the most that can be specified before the
sweeps run.

**Type consistency.** `REPO`, `SCRATCH` and `CLI` are defined once in `workspace.mjs` and
imported everywhere. `createWorkspace`/`destroyWorkspace`, `runCli`, `openMcp`, `runHook`,
`record`/`load` keep the same signatures across every task that uses them. The `Case` shape
introduced in Task 6 gains `fixture` in Task 10 step 2 and `configPatch` in Task 13 step 1,
both by explicit edits to `sweep.mjs` rather than by assumption. Evidence ids are
`<surface>/<caseId>` throughout, and the surface names used in `claims.mjs` match the sweep
invocations exactly.
