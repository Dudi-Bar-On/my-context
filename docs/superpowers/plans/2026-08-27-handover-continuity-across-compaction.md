# Handover continuity across a compaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a compaction the next session receives the project's handover file, bounded and honest about what it cut; and when the context window crosses a configured occupancy the model is asked, exactly once, to bring that handover up to date.

**Architecture:** Two config keys and one new core module carry the whole feature. `PostCompact` resolves the handover and records what it found, because it can read a file but cannot speak to the model. `SessionStart` delivers the bounded block, because its stdout is the one hook output the model receives. Occupancy is not computed: it is read from the status-line tee the product already writes, where `classifyContext` already returns a percentage. The ask is delivered through `Stop`'s `additionalContext` envelope, which this project has deliberately left empty until now.

**Tech Stack:** Node >= 24 built-ins only. No build step, no runtime dependency, erasable TypeScript syntax only. `node:test` with `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-08-27-handover-continuity-across-compaction-design.md`

## Global Constraints

- Node >= 24, native TypeScript type-stripping, `erasableSyntaxOnly`. No enums, no parameter properties, no namespaces.
- Zero runtime dependencies. `node:` built-ins only.
- No hook writes to stdout except `SessionStart`, whose stdout is raw text appended to the model's context, and `Stop`, which gains one JSON envelope in Task 6 and writes nothing otherwise.
- Every hook exits 0. A hook that throws must not break a session.
- An unreadable payload discloses on stderr through `hookParseErrorLine`. Nothing is dropped silently.
- A hook never writes, edits or reformats the handover document.
- New config keys are refused by name when malformed, in the style of `requireUi`, and nothing is loaded when a config is invalid.
- Tests are `node:test`; every new test file matches the project's test glob and lives under `test/<area>/`.
- Run the whole suite with `npm test`. Never run `npm test` or `test:e2e` from a subagent: they spin servers over one shared `.demo-corpus`.

---

### Task 1: The `handover` config key

**Files:**
- Modify: `src/core/config.ts`
- Test: `test/core/config-handover.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `interface HandoverConfig { path: string; marker: string; budgetTokens: number; }`, `const DEFAULT_HANDOVER_MARKER = '\u23ED'`, `const DEFAULT_HANDOVER_BUDGET_TOKENS = 1200`, and `Config.handover: HandoverConfig | null` — `null` meaning the key is absent and the whole feature is off.

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfigFrom } from '../../src/core/config.ts';

test('handover is absent by default, and absent means off', () => {
  const config = loadConfigFrom({});
  assert.equal(config.handover, null);
});

test('a handover object gets the marker and budget defaults', () => {
  const config = loadConfigFrom({ handover: { path: 'reports/V2-HANDOVER.md' } });
  assert.deepEqual(config.handover, {
    path: 'reports/V2-HANDOVER.md',
    marker: '\u23ED',
    budgetTokens: 1200,
  });
});

test('an unknown sub-key is refused BY NAME and nothing is loaded', () => {
  assert.throws(
    () => loadConfigFrom({ handover: { path: 'a.md', pathh: 'b.md' } }),
    /handover\.pathh/,
  );
});

test('a path that escapes the project root is refused', () => {
  assert.throws(() => loadConfigFrom({ handover: { path: '../elsewhere.md' } }), /handover\.path/);
  assert.throws(() => loadConfigFrom({ handover: { path: 'C:\\\\abs.md' } }), /handover\.path/);
});

test('a non-object handover is refused, and so is a missing path', () => {
  assert.throws(() => loadConfigFrom({ handover: true }), /handover/);
  assert.throws(() => loadConfigFrom({ handover: { marker: '!' } }), /handover\.path/);
});
```

Read `src/core/config.ts` first and use the loader entry point it actually exports; `loadConfigFrom` above stands for whatever that spelling is, and the existing `test/core/config.test.ts` shows it in use for `ui`.

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/core/config-handover.test.ts`
Expected: FAIL — `config.handover` is undefined and no refusal happens.

- [ ] **Step 3: Implement the minimal code**

Add beside the `ui` block in `src/core/config.ts`:

```ts
export interface HandoverConfig {
  /** Repo-relative, one file. Not a glob: a glob that matches two has to pick. */
  path: string;
  /** A heading prefix that marks the section written FOR the next session. */
  marker: string;
  /** How much of it may be delivered. The rest is named, never dropped silently. */
  budgetTokens: number;
}

export const DEFAULT_HANDOVER_MARKER = '\u23ED';
export const DEFAULT_HANDOVER_BUDGET_TOKENS = 1200;

const HANDOVER_KEYS = ['path', 'marker', 'budgetTokens'];

function requireHandover(raw: unknown): HandoverConfig {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('my_context: handover is not an object. Expected { "path": "<repo-relative file>" }.');
  }
  const value = raw as Record<string, unknown>;
  for (const key of Object.keys(value)) {
    if (!HANDOVER_KEYS.includes(key)) {
      throw new Error(`my_context: handover.${key} is not a key handover takes. Expected any of: ${HANDOVER_KEYS.join(', ')}.`);
    }
  }
  const file = value.path;
  if (typeof file !== 'string' || file.trim() === '') {
    throw new Error('my_context: handover.path is required and must be a non-empty repo-relative path.');
  }
  if (path.isAbsolute(file) || file.split(/[\\/]/).includes('..')) {
    throw new Error(`my_context: handover.path is ${file}. Expected a path inside the project, with no ".." and no drive or root.`);
  }
  const marker = value.marker === undefined ? DEFAULT_HANDOVER_MARKER : value.marker;
  if (typeof marker !== 'string' || marker === '') {
    throw new Error('my_context: handover.marker must be a non-empty string.');
  }
  const budget = value.budgetTokens === undefined ? DEFAULT_HANDOVER_BUDGET_TOKENS : value.budgetTokens;
  if (typeof budget !== 'number' || !Number.isInteger(budget) || budget <= 0) {
    throw new Error('my_context: handover.budgetTokens must be a positive whole number of tokens.');
  }
  return { path: file, marker, budgetTokens: budget };
}
```

Add `'handover'` to `TOP_LEVEL_KEYS`, add `handover: HandoverConfig | null` to `Config`, and wire `requireHandover` into the loader beside the `requireUi` call, defaulting to `null` when the key is absent.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test test/core/config-handover.test.ts test/core/config.test.ts`
Expected: PASS. `config.test.ts` must stay green — `TOP_LEVEL_KEYS` is asserted there.

- [ ] **Step 5: Commit**

```bash
git add src/core/config.ts test/core/config-handover.test.ts
git commit -m "config: a handover key, absent by default, refused by name when wrong"
```

---

### Task 2: Reading a bounded handover block

**Files:**
- Create: `src/core/handover.ts`
- Test: `test/core/handover.test.ts`

**Interfaces:**
- Consumes: `HandoverConfig` from Task 1.
- Produces:
  ```ts
  export type HandoverRead =
    | { state: 'off' }
    | { state: 'missing'; path: string }
    | { state: 'read'; path: string; text: string; deliveredLines: number; totalLines: number; source: 'marker' | 'head' };
  export function readHandover(projectRoot: string, config: HandoverConfig | null): HandoverRead;
  export function handoverBlock(read: HandoverRead): string;
  ```

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readHandover, handoverBlock } from '../../src/core/handover.ts';

const CONFIG = { path: 'reports/H.md', marker: '\u23ED', budgetTokens: 1200 };

function workspace(body: string): string {
  const root = mkdtempSync(path.join(tmpdir(), 'handover-'));
  mkdirSync(path.join(root, 'reports'), { recursive: true });
  writeFileSync(path.join(root, 'reports', 'H.md'), body, 'utf8');
  return root;
}

test('no config is off, and off says nothing at all', () => {
  assert.deepEqual(readHandover('/nowhere', null), { state: 'off' });
  assert.equal(handoverBlock({ state: 'off' }), '');
});

test('a configured file that is not there is MISSING, never silently off', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'handover-'));
  assert.deepEqual(readHandover(root, CONFIG), { state: 'missing', path: 'reports/H.md' });
});

test('the marked section wins, and it stops at the next same-level heading', () => {
  const root = workspace([
    '# Handover',
    'preamble nobody needs',
    '### \u23ED DO THIS FIRST',
    'the one instruction',
    'and its second line',
    '### SOMETHING ELSE',
    'not this',
  ].join('\n'));
  const read = readHandover(root, CONFIG);
  assert.equal(read.state, 'read');
  assert.equal(read.source, 'marker');
  assert.match(read.text, /DO THIS FIRST/);
  assert.match(read.text, /and its second line/);
  assert.doesNotMatch(read.text, /not this/);
  assert.doesNotMatch(read.text, /preamble nobody needs/);
});

test('a deeper heading inside the marked section is KEPT', () => {
  const root = workspace(['## \u23ED NEXT', 'a', '#### detail', 'b', '## OTHER', 'c'].join('\n'));
  const read = readHandover(root, CONFIG);
  assert.match(read.text, /#### detail/);
  assert.doesNotMatch(read.text, /OTHER/);
});

test('no marker falls back to the HEAD, cut at a section boundary', () => {
  const body = ['# Handover', 'one', '## Second', 'two', '## Third', 'three'].join('\n');
  const read = readHandover(workspace(body), { ...CONFIG, budgetTokens: 4 });
  assert.equal(read.source, 'head');
  assert.match(read.text, /# Handover/);
  assert.doesNotMatch(read.text, /Third/);
});

test('the block DECLARES what it left behind — the hard list requirement', () => {
  const lines = ['### \u23ED NOW', 'do it'];
  for (let i = 0; i < 200; i += 1) lines.push(`filler ${i}`);
  const read = readHandover(workspace(lines.join('\n')), CONFIG);
  const block = handoverBlock(read);
  assert.match(block, /reports\/H\.md/);
  assert.match(block, new RegExp(`${read.deliveredLines} of ${read.totalLines}`));
});

test('a MISSING handover renders a line that names the path — silence is the defect', () => {
  const block = handoverBlock({ state: 'missing', path: 'reports/H.md' });
  assert.match(block, /reports\/H\.md/);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/core/handover.test.ts`
Expected: FAIL — `Cannot find module '../../src/core/handover.ts'`.

- [ ] **Step 3: Write the implementation**

```ts
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { HandoverConfig } from './config.ts';

/** The same rough estimate the selector uses: four characters to a token. */
const CHARS_PER_TOKEN = 4;

export type HandoverRead =
  | { state: 'off' }
  | { state: 'missing'; path: string }
  | {
      state: 'read';
      path: string;
      text: string;
      deliveredLines: number;
      totalLines: number;
      source: 'marker' | 'head';
    };

const HEADING = /^(#{1,6})\s+(.*)$/;

export function readHandover(projectRoot: string, config: HandoverConfig | null): HandoverRead {
  if (config === null) return { state: 'off' };
  const abs = path.resolve(projectRoot, config.path);
  let raw: string;
  try {
    if (!statSync(abs).isFile()) return { state: 'missing', path: config.path };
    raw = readFileSync(abs, 'utf8');
  } catch {
    return { state: 'missing', path: config.path };
  }
  const lines = raw.split(/\r?\n/);
  const budgetChars = config.budgetTokens * CHARS_PER_TOKEN;

  const start = lines.findIndex((line) => {
    const heading = HEADING.exec(line);
    return heading !== null && heading[2].trimStart().startsWith(config.marker);
  });

  if (start !== -1) {
    const level = HEADING.exec(lines[start]!)![1]!.length;
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i += 1) {
      const heading = HEADING.exec(lines[i]!);
      if (heading !== null && heading[1]!.length <= level) { end = i; break; }
    }
    const kept = capToBudget(lines.slice(start, end), budgetChars);
    return {
      state: 'read', path: config.path, text: kept.join('\n'),
      deliveredLines: kept.length, totalLines: lines.length, source: 'marker',
    };
  }

  const head = capToSection(lines, budgetChars);
  return {
    state: 'read', path: config.path, text: head.join('\n'),
    deliveredLines: head.length, totalLines: lines.length, source: 'head',
  };
}

/** Take whole lines until the budget is spent. Never cuts inside a line. */
function capToBudget(lines: string[], budgetChars: number): string[] {
  const kept: string[] = [];
  let spent = 0;
  for (const line of lines) {
    if (spent + line.length + 1 > budgetChars && kept.length > 0) break;
    kept.push(line);
    spent += line.length + 1;
  }
  return kept;
}

/** As `capToBudget`, then back up to the last heading so the cut lands on a boundary. */
function capToSection(lines: string[], budgetChars: number): string[] {
  const kept = capToBudget(lines, budgetChars);
  if (kept.length === lines.length) return kept;
  for (let i = kept.length - 1; i > 0; i -= 1) {
    if (HEADING.test(kept[i]!)) return kept.slice(0, i);
  }
  return kept;
}

export function handoverBlock(read: HandoverRead): string {
  if (read.state === 'off') return '';
  if (read.state === 'missing') {
    return `## handover — NOT FOUND\n\n`
      + `\`${read.path}\` is configured as this project's handover and is not there. `
      + `Nothing was carried across the boundary. Either the file moved or the key is wrong.\n`;
  }
  const held = read.totalLines - read.deliveredLines;
  return `## handover — what the last session left for this one\n\n`
    + `${read.text}\n\n`
    + `_${read.deliveredLines} of ${read.totalLines} lines, from the ${read.source === 'marker' ? 'marked section' : 'head'} of \`${read.path}\`. `
    + `${held} lines are NOT here; read the file for them._\n`;
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test test/core/handover.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/handover.ts test/core/handover.test.ts
git commit -m "core: read a bounded handover block, and say what it left behind"
```

---

### Task 3: `SessionStart` delivers it

**Files:**
- Modify: `src/hooks/session-start.ts`
- Test: `test/hooks/session-start-handover.test.ts`

**Interfaces:**
- Consumes: `readHandover`, `handoverBlock` from Task 2; `Config.handover` from Task 1.
- Produces: nothing new. The handover text is appended to whatever `buildInjection` already returns.

- [ ] **Step 1: Write the failing test**

Mirror the harness the existing `test/hooks/session-start*.test.ts` uses — a temp workspace, a JSON payload on stdin, stdout and stderr captured. Assertions:

```ts
test('a compacted session receives the handover after the corpus block', async () => {
  const run = await sessionStart({ source: 'compact', handover: '### \u23ED NOW\ndo the thing' });
  assert.match(run.stdout, /## my_context/);
  assert.match(run.stdout, /do the thing/);
  assert.ok(run.stdout.indexOf('## my_context') < run.stdout.indexOf('do the thing'),
    'the corpus governs and comes first; the handover is what one session left another');
});

test('every source except resume gets it', async () => {
  for (const source of ['startup', 'clear', 'compact', 'fork']) {
    assert.match((await sessionStart({ source, handover: '### \u23ED NOW\nx' })).stdout, /### \u23ED NOW/);
  }
  assert.doesNotMatch((await sessionStart({ source: 'resume', handover: '### \u23ED NOW\nx' })).stdout, /\u23ED NOW/);
});

test('a configured handover that is not there DISCLOSES on stderr and never in context', async () => {
  const run = await sessionStart({ source: 'compact', configureOnly: 'reports/gone.md' });
  assert.match(run.stderr, /reports\/gone\.md/);
  assert.doesNotMatch(run.stdout, /NOT FOUND/);
});

test('an unconfigured handover is silent in both streams', async () => {
  const run = await sessionStart({ source: 'compact' });
  assert.doesNotMatch(run.stdout, /handover/i);
  assert.doesNotMatch(run.stderr, /handover/i);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/hooks/session-start-handover.test.ts`
Expected: FAIL — no handover text on stdout.

- [ ] **Step 3: Write the implementation**

In `src/hooks/session-start.ts`, after the existing injection text is built and before it is written:

```ts
const HANDOVER_SOURCES = new Set(['startup', 'clear', 'compact', 'fork']);

// `resume` is the only source that KEEPS the window it had, so it is the only
// one with nothing to be told. Every other source arrives empty.
if (ws.projectRoot !== null && HANDOVER_SOURCES.has(input.source ?? '')) {
  const read = readHandover(ws.projectRoot, ws.config.handover);
  if (read.state === 'missing') {
    // The silence IS the defect. stderr reaches the user, never the model.
    process.stderr.write(
      `my_context: handover.path is ${read.path} and there is no file there. `
      + `Nothing was carried across this boundary.\n`,
    );
  } else if (read.state === 'read') {
    text += (text === '' ? '' : '\n') + handoverBlock(read);
  }
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test test/hooks/`
Expected: PASS. Every existing session-start test must stay green — the block is additive and absent by default.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/session-start.ts test/hooks/session-start-handover.test.ts
git commit -m "hooks: a compacted session is handed the handover, bounded and disclosed"
```

---

### Task 4: `PostCompact` records what it resolved

**Files:**
- Modify: `src/hooks/post-compact.ts`
- Test: `test/hooks/post-compact-handover.test.ts`

**Interfaces:**
- Consumes: `readHandover` from Task 2.
- Produces: three fields on the existing `op: 'post-compact'` audit row — `handoverPath`, `handoverState` (`off | missing | read`), `handoverLines`.

- [ ] **Step 1: Write the failing test**

```ts
test('the post-compact row records which handover was resolved, and its size', async () => {
  const row = await postCompactRow({ handover: '### \u23ED NOW\na\nb' });
  assert.equal(row.handoverState, 'read');
  assert.equal(row.handoverPath, 'reports/H.md');
  assert.equal(row.handoverLines, 3);
});

test('a missing handover is recorded as missing, not as absent', async () => {
  const row = await postCompactRow({ configureOnly: 'reports/gone.md' });
  assert.equal(row.handoverState, 'missing');
});

test('no handover key records off, and writes no path', async () => {
  const row = await postCompactRow({});
  assert.equal(row.handoverState, 'off');
  assert.equal(row.handoverPath, undefined);
});

test('post-compact still writes NOTHING to stdout', async () => {
  assert.equal((await runPostCompact({ handover: '### \u23ED NOW\na' })).stdout, '');
});
```

That last assertion is the point of the task: `PostCompact` reads and records, and the reason this feature is split across two hooks is that it cannot speak.

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/hooks/post-compact-handover.test.ts`
Expected: FAIL — the row has no `handoverState`.

- [ ] **Step 3: Write the implementation**

In `src/hooks/post-compact.ts`, beside the existing `captured` / `survived` / `restored` counts, resolve the handover and add the three fields to the audit record. Do not write to stdout. Do not act on what was read.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test test/hooks/post-compact-handover.test.ts test/hooks/post-compact.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/post-compact.ts test/hooks/post-compact-handover.test.ts
git commit -m "hooks: post-compact records which handover it resolved, and stays silent"
```

---

### Task 5: Reading the context occupancy

**Files:**
- Create: `src/core/context-occupancy.ts`
- Test: `test/core/context-occupancy.test.ts`

**Interfaces:**
- Consumes: `readTee`, `classifyContext`, `teePath` from `src/core/statusline-tee.ts`.
- Produces:
  ```ts
  export type UnmeasurableWhy = 'no-bridge' | 'no-sample' | 'unknown-shape';
  export type Occupancy =
    | { state: 'unmeasurable'; why: UnmeasurableWhy }
    | { state: 'known'; percent: number; usedTokens: number; windowSize: number };
  export function readOccupancy(root: string, sessionId: string): Occupancy;
  export function occupancyStandDownLine(why: UnmeasurableWhy): string;
  ```

  The `unmeasurable` arm carries NO `percent` field at all, so a caller cannot
  write `occupancy.percent ?? 0`. `STD-absent-vs-zero` enforced by the type
  rather than by a comment.

  **`classifyContext` has a FOURTH state the sketch below swallows.**
  `not-yet-known` is returned when `current_usage` is `null`, which is exactly
  what Claude Code sends between a compaction and the next API call. Mapping it
  to `unknown-shape` would report "Claude Code's schema has moved" at the moment
  a handover mechanism is most likely to be reading, over a payload that is
  perfectly well formed and simply has nothing yet. It maps to `no-sample`.

- [ ] **Step 1: Write the failing test**

```ts
test('no .statusline directory at all is no-bridge, and never a number', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'occ-'));
  assert.deepEqual(readOccupancy(root, 'sess-1'), { state: 'unmeasurable', why: 'no-bridge' });
});

test('a bridge with no sample for THIS session is no-sample', () => {
  const root = withStatusline({ 'other-session': sample(50) });
  assert.deepEqual(readOccupancy(root, 'sess-1'), { state: 'unmeasurable', why: 'no-sample' });
});

test('a sample Claude Code no longer shapes the same way degrades to unknown-shape', () => {
  const root = withStatusline({ 'sess-1': { context_window: { current_usage: 'nope' } } });
  assert.deepEqual(readOccupancy(root, 'sess-1'), { state: 'unmeasurable', why: 'unknown-shape' });
});

test('a real sample gives the percentage Claude Code itself reports', () => {
  const root = withStatusline({ 'sess-1': sampleOf({ window: 200_000, input: 90_000, cacheRead: 106_000, cacheCreation: 0 }) });
  const occupancy = readOccupancy(root, 'sess-1');
  assert.equal(occupancy.state, 'known');
  assert.equal(occupancy.usedTokens, 196_000);
  assert.equal(Math.round(occupancy.percent), 98);
});

test('every unmeasurable reason produces a line that NAMES the reason', () => {
  for (const why of ['no-bridge', 'no-sample', 'unknown-shape'] as const) {
    assert.match(occupancyStandDownLine(why), /statusline|sample|shape/);
  }
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/core/context-occupancy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

A thin adapter. It computes nothing: `classifyContext` already returns `percent`, and there is deliberately no fallback that derives one from the transcript, because `context_window_size` is not in the transcript and a model-to-window table would go stale in silence.

```ts
export function readOccupancy(root: string, sessionId: string): Occupancy {
  if (!existsSync(statuslineDir(root))) return { state: 'unmeasurable', why: 'no-bridge' };
  const tee = readTee(root, sessionId);
  if (tee === null) return { state: 'unmeasurable', why: 'no-sample' };
  const sample = classifyContext(tee.payload);
  if (sample.state !== 'known' || sample.percent === null || sample.windowSize === null
      || sample.usedTokens === null) {
    return { state: 'unmeasurable', why: 'unknown-shape' };
  }
  return {
    state: 'known', percent: sample.percent,
    usedTokens: sample.usedTokens, windowSize: sample.windowSize,
  };
}
```

Read `src/core/statusline-tee.ts` for the exact `readTee` signature and return shape before writing this; the module is documented in full at its head.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test test/core/context-occupancy.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/context-occupancy.ts test/core/context-occupancy.test.ts
git commit -m "core: read the context occupancy the status-line bridge already collects"
```

---

### Task 6: `Stop` asks for the handover, once

**Files:**
- Modify: `src/hooks/io.ts`, `src/hooks/observe.ts`, `src/hooks/stop.ts`, `src/core/config.ts`
- Test: `test/hooks/stop-handover-ask.test.ts`

**Interfaces:**
- Consumes: `readOccupancy` from Task 5; `Config.handover` from Task 1.
- Produces: `Observation.context?: string`; `'Stop'` added to `HookEventName`; `handover.thresholdPercent` on `HandoverConfig`, default `98`.

- [ ] **Step 1: Write the failing test**

```ts
test('below the threshold Stop writes NOTHING to stdout, as it always has', async () => {
  assert.equal((await runStop({ percent: 40, threshold: 98 })).stdout, '');
});

test('at the threshold Stop emits ONE additionalContext envelope naming the file and the number', async () => {
  const run = await runStop({ percent: 98.4, threshold: 98, handoverPath: 'reports/H.md' });
  const envelope = JSON.parse(run.stdout);
  assert.equal(envelope.hookSpecificOutput.hookEventName, 'Stop');
  assert.match(envelope.hookSpecificOutput.additionalContext, /reports\/H\.md/);
  assert.match(envelope.hookSpecificOutput.additionalContext, /98/);
});

test('it asks ONCE — a second turn over the threshold is silent', async () => {
  const session = freshSession();
  assert.notEqual((await runStop({ session, percent: 99, threshold: 98 })).stdout, '');
  assert.equal((await runStop({ session, percent: 99, threshold: 98 })).stdout, '');
});

test('with no handover configured it never asks, whatever the occupancy', async () => {
  assert.equal((await runStop({ percent: 99, threshold: 98, handoverPath: null })).stdout, '');
});

test('unmeasurable stands down on STDERR once and never guesses a number', async () => {
  const session = freshSession();
  const first = await runStop({ session, bridge: false });
  assert.equal(first.stdout, '');
  assert.match(first.stderr, /statusline/);
  assert.equal((await runStop({ session, bridge: false })).stderr, '');
});

test('the audit row Stop already wrote is still written, every turn', async () => {
  assert.equal((await runStop({ percent: 40 })).rows.filter((r) => r.op === 'stop').length, 1);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/hooks/stop-handover-ask.test.ts`
Expected: FAIL — `Stop` writes nothing and `HookEventName` has no `'Stop'`.

- [ ] **Step 3: Write the implementation**

Three small changes and one latch.

1. `src/hooks/io.ts`: add `'Stop'` to `HookEventName`. The union exists so an envelope cannot be built for an event that does not declare one; `Stop` does declare one, and `src/hooks/observe.ts` already records the platform's own description of it.

2. `src/hooks/observe.ts`: `Observation` gains `context?: string`, and `runObservationHook` writes `JSON.stringify(hookContext(spec.hook, observation.context))` when it is present. Nothing else changes: a spec that never sets it behaves exactly as before, which is nine of the ten.

3. `src/hooks/stop.ts`: `observeStop` reads the occupancy, compares, latches, and sets `context`. The latch is a file in the workspace state directory keyed by session id, beside the other per-session state; it holds the threshold that was already asked for, so lowering the threshold mid-session can ask again and raising it cannot.

```ts
export function observeStop(input: HookInput): Observation | null {
  const active = input.stop_hook_active === true;
  const base = `stop_hook_active=${active ? 'true' : 'false'}; the assistant turn ended`
    + (active ? ', continuing because another stop hook asked it to' : '');

  const ask = handoverAsk(input);           // null when off, below threshold, or already asked
  return ask === null
    ? { note: base }
    : { note: `${base}; asked for a handover at ${ask.percent.toFixed(1)}%`, context: ask.text };
}
```

The text it asks with, which is the whole product surface of this feature:

```
The context window is 98.4% full. Update reports/V2-HANDOVER.md NOW, before the
compaction: what you were doing, what you decided and why, and what the next
session must do first. You have this turn. Nothing else carries across.
```

4. `src/core/config.ts`: `thresholdPercent` joins `HANDOVER_KEYS`, default `98`, refused unless a number in `1..100`.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test test/hooks/ test/core/`
Expected: PASS. `test/hooks/self-register.test.ts` must stay green — no hook registration changes here.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/io.ts src/hooks/observe.ts src/hooks/stop.ts src/core/config.ts test/hooks/stop-handover-ask.test.ts
git commit -m "hooks: Stop asks for the handover once, at the threshold, and only for that"
```

---

### Task 7: `PreCompact` records the occupancy it fired at

**Files:**
- Modify: `src/hooks/pre-compact.ts`
- Test: `test/hooks/pre-compact-occupancy.test.ts`

**Interfaces:**
- Consumes: `readOccupancy` from Task 5.
- Produces: `occupancyPercent` (number or `null`) and `trigger` on the existing `op: 'pre-compact'` audit row.

This task is what turns the threshold from an argument into a measurement. `trigger` distinguishes an automatic compaction from a manual one, and the percentage beside it is the number the platform actually compacted at.

- [ ] **Step 1: Write the failing test**

```ts
test('the pre-compact row carries the trigger, verbatim, and absent stays absent', async () => {
  assert.equal((await preCompactRow({ trigger: 'auto' })).trigger, 'auto');
  assert.equal((await preCompactRow({ trigger: 'manual' })).trigger, 'manual');
  assert.equal((await preCompactRow({})).trigger, '<absent>');
});

test('the row carries the occupancy when it is measurable', async () => {
  const row = await preCompactRow({ trigger: 'auto', percent: 92.7 });
  assert.equal(Math.round(row.occupancyPercent * 10), 927);
});

test('an unmeasurable occupancy is null, never zero and never a guess', async () => {
  assert.equal((await preCompactRow({ trigger: 'auto', bridge: false })).occupancyPercent, null);
});
```

`'<absent>'` is the spelling `src/hooks/post-compact.ts` already uses for an absent `trigger`; reuse it rather than inventing a second one.

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/hooks/pre-compact-occupancy.test.ts`
Expected: FAIL — the row has neither field.

- [ ] **Step 3: Write the implementation**

Read `input.trigger` — `pre-compact.ts` does not read it today although `io.ts` declares it — and `readOccupancy(root, input.session_id)`, and put both on the audit record. Nothing else about the hook changes; the snapshot write is untouched.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test test/hooks/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/pre-compact.ts test/hooks/pre-compact-occupancy.test.ts
git commit -m "hooks: pre-compact records the occupancy and trigger it fired at"
```

---

### Task 8: The gates, the docs and the corpus

**Files:**
- Modify: `README.md`, `docs/README.he.md`
- Test: the whole suite

- [ ] **Step 1: Run every gate the way the project runs it**

```bash
npm run typecheck && npm test && npm run check:text-files && npm run check:retired && npm run check:test-glob && npm run verify:citations
```

Never a hand-assembled invocation: that is a pinned rule.

- [ ] **Step 2: Document the two config keys in both READMEs**

`test/docs/parity.test.ts` holds `README.md` and `docs/README.he.md` to the same sections, so a key documented in one must be documented in the other. Say three things about `handover`: what it delivers, that it is off unless configured, and that `thresholdPercent` needs the status-line bridge or it stands down.

- [ ] **Step 3: Re-run the gates**

Same command. Expected: all exit 0.

- [ ] **Step 4: Close the corpus tasks**

```bash
mycontext edit <id> --extra state=done
```

`--tags` is REFUSED for a projected tag; `state` is a field and the tag is generated from it.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/README.he.md
git commit -m "docs: the handover key, and what it does when the bridge is absent"
```

---

## Self-review

**Spec coverage.** §3.1 is Task 1, §3.2 Task 2, §3.3 and §3.4 Task 3, §2's division of labour is Tasks 3 and 4, §4.1 Task 5, §4.3 Task 6, §4.4 Tasks 6 and 7, §5's cost bound is the shape of Task 5 (no transcript scan on a per-turn path), §6's four prohibitions are assertions in Tasks 3, 4 and 6. §7 is the owner's and is not a task.

**Placeholders.** None: every code step carries the code, and the two places that say *read the module first* name the module and say what to look for, which is a step, not a gap.

**Type consistency.** `HandoverConfig` is produced in Task 1 and consumed by name in Tasks 2, 3, 4 and 6. `HandoverRead` is produced in Task 2 and consumed in Tasks 3 and 4. `Occupancy` is produced in Task 5 and consumed in Tasks 6 and 7. `handoverBlock` and `readHandover` keep their names throughout.

**One thing an executor must not do.** Task 6 puts text on `Stop`'s stdout for the first time in this project's history. It is scoped to one purpose by the spec and by the owner ruling recorded in the corpus. Do not use the envelope for anything else while you are in there.
