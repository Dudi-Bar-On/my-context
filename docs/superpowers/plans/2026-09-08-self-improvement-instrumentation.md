# Self-improvement loop — Phase 1: instrumentation and the baseline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure, from data already on disk, how often each corpus item is
actually delivered into a session — split by who authored it — so that the
self-improvement loop can later be judged against a baseline rather than
believed.

**Architecture:** A pure reader over the existing audit log. `recordAudit`
already writes one `kind: 'injection'` record per delivery carrying
`injected: InjectedRef[]` and `spilled: SpilledRef[]`, so per-item contribution
is derivable **backwards through history** with no new write path and no change
to any hook. Phase 1 adds a core module, a CLI surface and a dated snapshot;
it changes nothing about what is written.

**Tech Stack:** TypeScript on Node 24 native type stripping, zero runtime
dependencies, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-08-self-improvement-loop-design.md`
— §15 (Instrumentation) and §9 (outcome-linked retirement, which consumes what
this produces).

## Global Constraints

- **Node >= 24.0.0**, no build step. Source is `.ts`, executed directly.
- **Only erasable TypeScript syntax**: no `enum`, no `namespace`, no parameter
  properties. Every relative import carries an explicit `.ts` extension.
- **Zero runtime dependencies.** `dependencies` is empty and stays empty.
- **Never write to `.my_context/`** from a test. Build fixtures in a temp
  directory.
- **Every new or edited test file carries a `// @basis` line** —
  `RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none` is pinned
  and severity `hard`. `none - <reason>` is legal; a bare `none` is not.
  `npm run check:basis` gates it.
- **Port 58888 is the owner's server.** Never kill, restart or bind to it.
- **The read surface writes nothing.** Nothing in this plan may be called from
  `src/ui/` request handling.

---

### Task 1: The contribution reader

A pure function over audit records. No filesystem, so it is testable without a
corpus.

**Files:**
- Create: `src/core/contribution.ts`
- Test: `test/core/contribution.test.ts`

**Interfaces:**
- Consumes: `AuditRecord`, `InjectedRef`, `SpilledRef` from `src/core/audit.ts`
  (already exported; `InjectedRef` is `{ id: string; tier: string; injectedAt?: string }`).
- Produces:
  - `export interface Contribution { id: string; delivered: number; spilled: number; tiers: string[]; firstAt: string | null; lastAt: string | null }`
  - `export function contributions(records: AuditRecord[]): Map<string, Contribution>`

- [ ] **Step 1: Write the failing test**

```ts
// @basis TASK-... (the D36 instrumentation item, once filed; until then:)
// @basis none - measures the audit log's existing shape, no ruling behind it yet
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contributions } from '../../src/core/contribution.ts';
import type { AuditRecord } from '../../src/core/audit.ts';

function injection(at: string, injected: { id: string; tier: string }[],
                   spilled: { id: string; tier: string; reason: string }[] = []): AuditRecord {
  return { kind: 'injection', op: 'session-start', at, injected, tokens: 0,
    ...(spilled.length === 0 ? {} : { spilled }) } as unknown as AuditRecord;
}

test('an item delivered twice is counted twice, and its tiers are collected', () => {
  const got = contributions([
    injection('2026-09-01T10:00:00.000Z', [{ id: 'RULE-a', tier: 'pinned' }]),
    injection('2026-09-02T10:00:00.000Z', [{ id: 'RULE-a', tier: 'jit' }]),
  ]);
  const a = got.get('RULE-a');
  assert.ok(a, 'RULE-a must appear');
  assert.equal(a.delivered, 2);
  assert.equal(a.spilled, 0);
  assert.deepEqual(a.tiers.slice().sort(), ['jit', 'pinned']);
  assert.equal(a.firstAt, '2026-09-01T10:00:00.000Z');
  assert.equal(a.lastAt, '2026-09-02T10:00:00.000Z');
});

test('a spilled item is counted as spilled and NOT as delivered', () => {
  const got = contributions([
    injection('2026-09-01T10:00:00.000Z', [], [{ id: 'RULE-b', tier: 'jit', reason: 'budget' }]),
  ]);
  const b = got.get('RULE-b');
  assert.ok(b, 'a spilled item must still appear — never delivered is the finding');
  assert.equal(b.delivered, 0);
  assert.equal(b.spilled, 1);
});

test('records that are not injections are ignored', () => {
  const got = contributions([
    { kind: 'mutation', op: 'create', at: '2026-09-01T10:00:00.000Z' } as unknown as AuditRecord,
  ]);
  assert.equal(got.size, 0);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/core/contribution.test.ts`
Expected: FAIL — `Cannot find module '../../src/core/contribution.ts'`

- [ ] **Step 3: Write the minimal implementation**

```ts
/**
 * How often each item was actually DELIVERED, read backwards out of the audit
 * log rather than measured going forward.
 *
 * `recordAudit` has always written one `kind: 'injection'` record per delivery
 * carrying `injected` and `spilled`, so this needs no new write path and can
 * answer for history that already happened. That is the whole reason Phase 1
 * is cheap: the instrument was already recording.
 *
 * A spilled item is reported with `delivered: 0` rather than omitted. "Chosen
 * and then cut for budget" and "never a candidate" are different facts, and an
 * item that is always spilled is the sharpest finding this file can produce.
 */
import type { AuditRecord } from './audit.ts';

export interface Contribution {
  id: string;
  delivered: number;
  spilled: number;
  tiers: string[];
  firstAt: string | null;
  lastAt: string | null;
}

function seen(map: Map<string, Contribution>, id: string): Contribution {
  const found = map.get(id);
  if (found !== undefined) return found;
  const made: Contribution = { id, delivered: 0, spilled: 0, tiers: [], firstAt: null, lastAt: null };
  map.set(id, made);
  return made;
}

function stamp(row: Contribution, at: string): void {
  if (row.firstAt === null || at < row.firstAt) row.firstAt = at;
  if (row.lastAt === null || at > row.lastAt) row.lastAt = at;
}

export function contributions(records: AuditRecord[]): Map<string, Contribution> {
  const out = new Map<string, Contribution>();
  for (const record of records) {
    if (record.kind !== 'injection') continue;
    const at = record.at;
    for (const ref of record.injected ?? []) {
      const row = seen(out, ref.id);
      row.delivered += 1;
      if (!row.tiers.includes(ref.tier)) row.tiers.push(ref.tier);
      stamp(row, at);
    }
    for (const ref of record.spilled ?? []) {
      const row = seen(out, ref.id);
      row.spilled += 1;
      stamp(row, at);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `node --test test/core/contribution.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

If `record.injected` is not on the `AuditRecord` union without narrowing, do
**not** cast it away — narrow on `record.kind === 'injection'` and, if the union
does not discriminate, report that as a finding rather than reaching for `any`.

- [ ] **Step 6: Commit**

```bash
git add src/core/contribution.ts test/core/contribution.test.ts
git commit -m "contribution: read per-item delivery backwards out of the audit log"
```

---

### Task 2: Split it by who wrote the item

A count on its own says nothing. **The comparison is the measurement** — §15
asks whether items promoted by the loop are delivered, superseded or retired
differently from human-authored ones.

**Files:**
- Modify: `src/core/contribution.ts`
- Test: `test/core/contribution.test.ts`

**Interfaces:**
- Consumes: `Item` from `src/core/types.ts`; `Origin` is `'human' | 'agent' | 'ingest'`.
- Produces:
  - `export interface Cohort { origin: string; items: number; neverDelivered: number; alwaysSpilled: number; medianDelivered: number }`
  - `export function cohorts(byId: Map<string, Item>, got: Map<string, Contribution>): Cohort[]`

- [ ] **Step 1: Write the failing test**

```ts
test('an item that exists but was never delivered is counted in its cohort', () => {
  const items = new Map([
    ['RULE-h', { id: 'RULE-h', origin: 'human' } as unknown as Item],
    ['RULE-a', { id: 'RULE-a', origin: 'agent' } as unknown as Item],
  ]);
  const got = contributions([
    injection('2026-09-01T10:00:00.000Z', [{ id: 'RULE-h', tier: 'pinned' }]),
  ]);
  const rows = cohorts(items, got);
  const human = rows.find((r) => r.origin === 'human');
  const agent = rows.find((r) => r.origin === 'agent');
  assert.ok(human && agent);
  assert.equal(human.items, 1);
  assert.equal(human.neverDelivered, 0);
  assert.equal(agent.items, 1);
  assert.equal(agent.neverDelivered, 1, 'an item with no injection record has never been delivered');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/core/contribution.test.ts`
Expected: FAIL — `cohorts` is not exported.

- [ ] **Step 3: Implement**

```ts
import type { Item } from './types.ts';

export interface Cohort {
  origin: string;
  items: number;
  neverDelivered: number;
  alwaysSpilled: number;
  medianDelivered: number;
}

function median(ns: number[]): number {
  if (ns.length === 0) return 0;
  const sorted = ns.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function cohorts(byId: Map<string, Item>, got: Map<string, Contribution>): Cohort[] {
  const buckets = new Map<string, number[]>();
  const never = new Map<string, number>();
  const spilledOnly = new Map<string, number>();
  for (const item of byId.values()) {
    const origin = item.origin ?? 'human';
    const row = got.get(item.id);
    const delivered = row?.delivered ?? 0;
    const list = buckets.get(origin) ?? [];
    list.push(delivered);
    buckets.set(origin, list);
    if (delivered === 0) never.set(origin, (never.get(origin) ?? 0) + 1);
    if (delivered === 0 && (row?.spilled ?? 0) > 0) {
      spilledOnly.set(origin, (spilledOnly.get(origin) ?? 0) + 1);
    }
  }
  return [...buckets.entries()].map(([origin, list]): Cohort => ({
    origin,
    items: list.length,
    neverDelivered: never.get(origin) ?? 0,
    alwaysSpilled: spilledOnly.get(origin) ?? 0,
    medianDelivered: median(list),
  })).sort((a, b) => (a.origin < b.origin ? -1 : 1));
}
```

- [ ] **Step 4: Run and watch pass**

Run: `node --test test/core/contribution.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/contribution.ts test/core/contribution.test.ts
git commit -m "contribution: split delivery by who authored the item, because the comparison is the measurement"
```

---

### Task 3: The CLI surface

**Files:**
- Create: `src/cli/commands/contribution.ts`
- Modify: `src/cli/index.ts` (register the command in the same place `decay` is
  registered — find `'decay'` in the command table and follow that pattern
  exactly, including its help line)
- Test: `test/cli/contribution.test.ts`

**Interfaces:**
- Consumes: `contributions`, `cohorts` from `src/core/contribution.ts`;
  `readAudit(root)` from `src/core/audit.ts` (already exported, returns
  `AuditRecord[]`); the workspace resolver the other commands use — copy how
  `src/cli/commands/decay.ts` opens its store rather than inventing a path.
- Produces: `mycontext contribution [--json]`.

- [ ] **Step 1: Read `decay.ts` first**

Run: `sed -n '1,80p' src/cli/commands/decay.ts`

Do not write this command until you have read how `decay` resolves the
workspace, formats a table and handles an empty corpus. **Follow it. Do not
invent a second way.** `src/cli/commands/format.ts` states that nothing is
truncated and nothing collides; use its helpers.

- [ ] **Step 2: Write the failing test**

```ts
// @basis none - CLI wiring for a reader that has its own unit tests
test('contribution prints a row per cohort and exits 0 on a corpus with no audit log', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-contrib-'));
  try {
    execFileSync('node', [CLI, 'init', '--yes'], { cwd: dir, encoding: 'utf8' });
    const out = execFileSync('node', [CLI, 'contribution'], { cwd: dir, encoding: 'utf8' });
    assert.match(out, /never delivered/i,
      'an empty log must still say what it measured, not print nothing');
  } finally { removeTree(dir); }
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `node --test test/cli/contribution.test.ts`
Expected: FAIL — `unknown command "contribution"`.

- [ ] **Step 4: Implement, following `decay.ts`'s shape**

The command body: read the audit log with `readAudit`, build the map with
`contributions`, load items the way `decay` does, call `cohorts`, print one
table. **The empty case must print the cohort table with zeros and a sentence
saying the log holds no injection records yet — never an empty output.** An
empty result that looks like a broken command is the failure this project has
recorded elsewhere as a screen drawing an error card containing nothing.

- [ ] **Step 5: Run and watch pass**

Run: `node --test test/cli/contribution.test.ts`
Expected: PASS.

- [ ] **Step 6: Run it on the real corpus and read the output**

Run: `node src/cli/index.ts contribution`

**Read what it says.** This is the baseline. If every item shows
`delivered: 0`, the audit log is not carrying what Task 1 assumed — stop and
report that, because the whole plan rests on it.

- [ ] **Step 7: Commit**

```bash
git add src/cli/commands/contribution.ts src/cli/index.ts test/cli/contribution.test.ts
git commit -m "contribution: a command, so the baseline can be read before anything is built on it"
```

---

### Task 4: Snapshot the baseline, dated

Drift is only detectable as a **change**. A number that exists only when you run
the command cannot show a change, so Phase 1 ends by writing the baseline down.

**Files:**
- Create: `reports/2026-09-08-contribution-baseline.md`
- Test: none — this task's deliverable is a committed measurement, and a test
  asserting the contents of a dated snapshot would fail every time the corpus
  moves, which is the opposite of what it is for.

- [ ] **Step 1: Generate it**

```bash
node src/cli/index.ts contribution --json > /tmp/contrib.json
node src/cli/index.ts contribution
```

- [ ] **Step 2: Write the report**

It must carry, in prose a reader can check later: the date, the corpus size, the
number of injection records the log held, the cohort table, and — stated
plainly — **what this baseline is for**: that no self-improvement capture exists
yet, so these numbers are the control against which a later corpus is compared.

Include the honest caveat from §15: the research is contested, effects flip by
model, and nobody has measured a loop like this in a real long-running coding
workflow.

- [ ] **Step 3: Commit**

```bash
git add reports/2026-09-08-contribution-baseline.md
git commit -m "the contribution baseline, measured before anything was built on it"
```

---

## What Phase 1 deliberately does NOT build

No fork. No trigger. No proposal. No queue. No decline ledger. No indicator.

**Phase 1 is the control for an experiment**, and it is independently useful
without any of them: a corpus of 1,011 items where nobody has ever known which
ones are actually delivered will answer that question for the first time.

**Phase 2 is planned only after this has run**, because §9's retirement
thresholds and §10's queue ration are numbers that must be derived from this
corpus rather than copied from a paper.

---

## Self-review

**Spec coverage.** This plan implements §15 in full and the measurement half of
§9. §§2–8, 10–14 and 16 are Phase 2 and later, deliberately — recorded above so
the gap is a decision rather than an omission.

**Placeholders.** None: every code step carries the code, and the one step that
says "follow `decay.ts`" names the file to read first and forbids inventing a
second way.

**Type consistency.** `Contribution` and `Cohort` are defined in Task 1 and
Task 2 and used unchanged in Task 3. `InjectedRef` is `{ id, tier, injectedAt? }`
as exported from `src/core/audit.ts:680`; `SpilledRef` carries `{ id, tier,
reason }`. `Origin` is `'human' | 'agent' | 'ingest'`, so `cohorts` keys on a
string rather than a closed union — deliberate, because §4 adds a fourth origin
(`'review'`) in Phase 2 and this must not need editing when it does.

**One risk named rather than hidden.** Task 1 assumes `AuditRecord`
discriminates on `kind` well enough to reach `injected` without a cast. If it
does not, Task 1 Step 5 says to report it rather than cast — because a cast
there would silently produce zeros, and zeros would look like a finding.
