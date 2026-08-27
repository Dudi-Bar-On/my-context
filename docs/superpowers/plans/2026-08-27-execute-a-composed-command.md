# Executing a composed command from the web UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A command the UI composes can be RUN from the UI — every command in the catalogue, each behind a confirm that names what it will do, with a single-use nonce bound to exactly what was shown, and one audit record per run.

**Architecture:** The client sends a catalogue ID and values, never a command. The server rebuilds argv from the same catalogue the browser composed from — one file, imported by both, so the two cannot drift — and runs it with `execFile` and no shell. Which confirm a command gets is DERIVED from the real argument parser, and an unclassified command gets the stronger one. The nonce that authorises a run is minted by the GET that rendered the confirm and is bound to the id and the resolved argv.

**Tech Stack:** Node >= 24 built-ins only — `node:child_process` `execFile`, `node:crypto`. No build step, no runtime dependency, erasable TypeScript syntax only. `node:test` with `node:assert/strict` for the server; Playwright for the confirm.

**Spec:** `docs/superpowers/specs/2026-08-26-execute-a-composed-command-design.md` — read §3 AND §6 together. §6.1 widened §3.2 and the two only make sense read as one.

## Global Constraints

- **No shell, ever.** `execFile` with an argv array. Not `exec`, not `spawn` with `shell: true`, not a template string. The boundary is enforced by construction, the same rule the markdown route took.
- **A catalogue id is not a command.** The client never sends argv. A request naming an id the catalogue does not have is a 400, not a sanitisation problem.
- **Nothing reaches outside the workspace.** Every run has the project root as its cwd, and there is no argument shape that names a path outside it.
- **A run that cannot be recorded does not happen.** The audit write precedes the execution and its failure aborts the run.
- **No kill switch.** `--no-execute` was declined and execute-off-by-default was declined. Do not add one back as a config key, a flag or an environment variable.
- **The residual is stated in the product**, in the confirm dialog and in §7 of BOTH READMEs: the gate proves a request came from a browser on this machine, never that a person asked.
- Node >= 24, zero runtime dependencies, `erasableSyntaxOnly`.
- Run the whole suite with `npm test` and the browser suite with `npm run test:e2e`. **Never run either from a subagent**, and stop every server you have running before the e2e gate.

---

### Task 1: One catalogue, read by the server

**Files:**
- Create: `src/ui/execute-catalogue.ts`
- Test: `test/ui/execute-catalogue.test.ts`

**Interfaces:**
- Consumes: `PALETTE` and `commandFor` from `src/ui/public/lib/palette-defs.js`.
- Produces:
  ```ts
  export interface ResolvedCommand { id: string; argv: string[]; boundary: boolean; }
  export function catalogueIds(): string[];
  export function resolveCommand(id: string, values: Record<string, unknown>): ResolvedCommand;
  ```
  `resolveCommand` throws a `CommandRefusal` carrying a human-readable reason. It never returns a partly-built command.

**Why the browser's file and not a second one.** `palette-defs.js` is plain ESM with no DOM reference, and `src/ui/capture-model.ts` already cites it as the authority. Two catalogues would drift, and the drift would be silent in exactly the direction that matters: the browser showing one command in a confirm while the server ran another.

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogueIds, resolveCommand } from '../../src/ui/execute-catalogue.ts';

test('every catalogue entry is resolvable by id — no entry is unreachable', () => {
  assert.ok(catalogueIds().length > 0);
  assert.ok(catalogueIds().includes('add'));
  assert.ok(catalogueIds().includes('doctor'));
});

test('an id the catalogue does not have is REFUSED, and the reason names the id', () => {
  assert.throws(() => resolveCommand('rm', {}), /rm/);
  assert.throws(() => resolveCommand('__proto__', {}), /__proto__/);
  assert.throws(() => resolveCommand('', {}), /./);
});

test('the argv is rebuilt from the catalogue, not from anything the caller sent', () => {
  const resolved = resolveCommand('pin', { id: 'RULE-something', yes: true });
  assert.deepEqual(resolved.argv, ['pin', 'RULE-something', '--yes']);
});

test('the leading `mycontext` is NOT in the argv — the server runs the CLI it ships with', () => {
  assert.equal(resolveCommand('doctor', {}).argv[0], 'doctor');
});

test('a missing required argument is refused, never composed half-built', () => {
  assert.throws(() => resolveCommand('pin', {}), /required/);
  assert.throws(() => resolveCommand('supersede', { id: 'A' }), /required/);
});

test('a value not in a declared option set is refused BY VALUE', () => {
  assert.throws(() => resolveCommand('edit', { id: 'A', severity: 'medium' }), /medium/);
  assert.throws(() => resolveCommand('edit', { id: 'A', status: 'retired' }), /retired/);
});

test('a value that is not a string is refused — no coercion, ever', () => {
  for (const bad of [42, true, null, {}, ['a'], undefined]) {
    assert.throws(() => resolveCommand('pin', { id: bad }), /id/, String(bad));
  }
});

test('a value carrying a NUL, a newline or a bidi override is refused', () => {
  for (const bad of ['a\u0000b', 'a\nb', 'a\u202Eb', 'a\rb']) {
    assert.throws(() => resolveCommand('pin', { id: bad }));
  }
});

test('a key the entry does not declare is refused rather than dropped', () => {
  assert.throws(() => resolveCommand('doctor', { sneaky: 'x' }), /sneaky/);
});

test('a joined switch stays joined — `--always=false` is not `--always false`', () => {
  const resolved = resolveCommand('edit', { id: 'A', always: 'false' });
  assert.ok(resolved.argv.includes('--always=false'));
  assert.ok(!resolved.argv.includes('--always'));
});

test('the reads are below the boundary and the writes are on it, and both are EXPLICIT', () => {
  assert.equal(resolveCommand('add', { category: 'rule', title: 't' }).boundary, true);
  for (const id of ['doctor', 'status', 'decay', 'review revisions', 'rebuild']) {
    assert.equal(resolveCommand(id, {}).boundary, false);
  }
});

test('an entry that declares no boundary is TREATED AS ON IT', () => {
  // Against a SYNTHETIC entry, because every real one now declares the key.
  assert.equal(boundaryOf({}), true);
  assert.equal(boundaryOf({ boundary: false }), false);
});

test('EVERY catalogue entry declares the key, so an omission still means "unclassified"', () => {
  assert.deepEqual(catalogueEntries().filter((d) => d.boundary === undefined), []);
});
```

**THE CATALOGUE HAD TO CHANGE, and this is what the first draft of this plan got
wrong.** Measured 2026-08-27: fourteen entries carried `boundary: true` and ten
carried the key at all on no other — **there was no `boundary: false` anywhere in
`palette-defs.js`**. Under the fail-safe every entry therefore resolved as ON the
boundary, `doctor` included, and the assertion this plan first wrote
(`doctor` → `false`) was unsatisfiable by its own sketch.

The fix is not to weaken the fail-safe. It is that **a default only carries
information while omissions are rare**, so every entry was given the key
explicitly: the ten reads plus `rebuild` and `lesson-discard` now carry
`boundary: false` with the reason beside them, and an omission goes back to
meaning "nobody has classified this yet".

The NUL / newline / bidi test is not decoration: `pack import --name` shipped accepting a U+202E override and an embedded newline, measured, and the same class reaches here through any free-text argument.

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/ui/execute-catalogue.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
import { PALETTE, commandFor } from './public/lib/palette-defs.js';

/** A refusal a caller may be shown. Distinct from a bug, which is an Error. */
export class CommandRefusal extends Error {}

/**
 * Characters that must never reach an argument, whatever the shape says.
 *
 * `execFile` takes an argv array, so none of these can start a second command —
 * this is not shell escaping. They are refused because they LIE: a newline or a
 * bidi override renders as something other than what runs, and the confirm
 * dialog's whole job is that the two are the same. `pack import --name` shipped
 * accepting both, measured, which is why this is a refusal and not a strip.
 */
const DECEPTIVE = /[\u0000-\u001F\u007F\u200B\u202A-\u202E\u2066-\u2069]/;

const BY_ID = new Map(PALETTE.map((def) => [def.name, def]));

export function catalogueIds(): string[] {
  return [...BY_ID.keys()];
}

export function resolveCommand(id: string, values: Record<string, unknown>): ResolvedCommand {
  // Map lookup rather than property access: `values['__proto__']` and a
  // prototype-polluted object are not reachable through a Map, and an id is
  // caller-supplied text.
  const def = BY_ID.get(id);
  if (def === undefined) throw new CommandRefusal(`no command named "${String(id).slice(0, 60)}" is in the catalogue`);

  const declared = new Set([...def.args.map((a) => a.name), ...def.flags.map((f) => f.name)]);
  for (const key of Object.keys(values)) {
    if (!declared.has(key)) throw new CommandRefusal(`${id} does not take "${key}"`);
  }
  for (const [key, value] of Object.entries(values)) {
    const spec = [...def.args, ...def.flags].find((s) => s.name === key)!;
    if (spec.boolean === true) {
      if (typeof value !== 'boolean') throw new CommandRefusal(`${id}: ${key} is a switch and takes true or false`);
      continue;
    }
    if (typeof value !== 'string') throw new CommandRefusal(`${id}: ${key} must be text`);
    if (DECEPTIVE.test(value)) throw new CommandRefusal(`${id}: ${key} contains a character that would not display as it runs`);
    if (spec.options !== undefined && !spec.options.includes(value)) {
      throw new CommandRefusal(`${id}: ${key} is "${value.slice(0, 40)}" and takes one of: ${spec.options.join(', ')}`);
    }
  }

  let argv: string[];
  try { argv = commandFor(def, values); } catch (error) {
    throw new CommandRefusal((error as Error).message);   // "<name>: <arg> is required"
  }
  // `base` is `['mycontext', <verb>, …]` because it composes what a HUMAN types.
  // The server runs the CLI it ships with, so the program name is dropped here
  // rather than trusted from the catalogue.
  return {
    id,
    argv: argv.slice(1),
    // An entry with no `boundary` gets the STRONGER confirm. A stale
    // classification then costs ceremony, never a silent write — which is the
    // safe direction, and the reason Task 2 derives it rather than trusting it.
    boundary: def.boundary !== false,
  };
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test test/ui/execute-catalogue.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/execute-catalogue.ts test/ui/execute-catalogue.test.ts
git commit -m "ui: the server rebuilds argv from the catalogue the browser composed from"
```

---

### Task 2: The boundary is derived, and the catalogue is held to it — ALREADY BUILT

**Files:**
- Read: `test/ui/palette-lib.test.ts` (~357), `test/helpers/approval-boundary.ts`
- Test: nothing new

**Status: DONE, and it was done before this plan was written.** Recorded here
rather than deleted, because the finding matters more than the task.

`test/ui/palette-lib.test.ts` already derives the classification from the REAL
argument parser and fails when the catalogue disagrees with it, in both
directions and for `--yes` as well as for `boundary`. It caught the one change
this plan's Task 1 made to the catalogue, immediately and by name:

```
lesson-discard: boundary=true but the parser says false
```

**And it was RIGHT and the change was wrong.** `lesson-discard` permanently
rejects a staged rule, which reads as something that should need ceremony — but
the boundary is about what GOVERNS this project, and a staged candidate governs
nothing yet. `review discard`, which looks like the same act, IS derived as gated
because a draft in that queue can be promoted into something that does.

So **destructive and boundary-crossing are two different axes**, `lesson-discard`
is the entry that separates them, and the derivation knew that when a hand-marked
flag did not. That is the whole argument for deriving, arriving unprompted.

What was missing and is now added, in `test/ui/execute-catalogue.test.ts`: an
assertion that **every entry declares the key**. The gate above compares flags
against the parser; it says nothing about an entry that carries no flag, and the
fail-safe only carries information while omissions are rare.

Two disagreements between catalogue and parser stand, both flagged `boundary:
true` and both correct: `lesson-accept` and `lesson-discard`'s neighbour cases
are documented in `approval-boundary.ts`'s own `UNGATED` map, which exists
because a command with no `--yes` gives the probe nothing to find.

---

### Task 3: The execution nonce, bound to what was shown

**Files:**
- Create: `src/ui/execute-nonce.ts`
- Test: `test/ui/execute-nonce.test.ts`

**Interfaces:**
- Consumes: nothing. Model it on `NonceStore` in `src/ui/security.ts` — read that class first, especially its one-shot delete-on-attempt discipline.
- Produces:
  ```ts
  export class ExecutionNonceStore {
    mint(id: string, argv: string[], ttlMs?: number, now?: number): string;
    redeem(nonce: string, id: string, argv: string[], now?: number): boolean;
  }
  export const EXECUTION_NONCE_TTL_MS = 120_000;
  ```

**What this is for, stated once.** The session token proves a browser. This proves that THIS run is the one a confirm dialog rendered. With §6.1 widening what may run, it is the only thing between a silent local page and a corpus mutation — §6.3 says so in those terms. It is not optional and it is not deferred.

- [ ] **Step 1: Write the failing test**

```ts
test('a minted nonce redeems once, for the exact id and argv it was minted for', () => {
  const store = new ExecutionNonceStore();
  const nonce = store.mint('pin', ['pin', 'A', '--yes']);
  assert.equal(store.redeem(nonce, 'pin', ['pin', 'A', '--yes']), true);
});

test('it is ONE-SHOT — the second attempt fails even when everything else matches', () => {
  const store = new ExecutionNonceStore();
  const nonce = store.mint('pin', ['pin', 'A', '--yes']);
  store.redeem(nonce, 'pin', ['pin', 'A', '--yes']);
  assert.equal(store.redeem(nonce, 'pin', ['pin', 'A', '--yes']), false);
});

test('a nonce minted for one command does not authorise another', () => {
  const store = new ExecutionNonceStore();
  const nonce = store.mint('pin', ['pin', 'A', '--yes']);
  assert.equal(store.redeem(nonce, 'unpin', ['unpin', 'A', '--yes']), false);
});

test('a nonce minted for one ARGV does not authorise a different one', () => {
  const store = new ExecutionNonceStore();
  const nonce = store.mint('pin', ['pin', 'A', '--yes']);
  assert.equal(store.redeem(nonce, 'pin', ['pin', 'B', '--yes']), false);
  assert.equal(store.redeem(nonce, 'pin', ['pin', 'A']), false);
});

test('a MISMATCHED attempt spends the nonce too — one attempt is all it gets', () => {
  const store = new ExecutionNonceStore();
  const nonce = store.mint('pin', ['pin', 'A']);
  store.redeem(nonce, 'pin', ['pin', 'B']);
  assert.equal(store.redeem(nonce, 'pin', ['pin', 'A']), false,
    'a nonce that survives a wrong guess is a nonce an attacker may guess against');
});

test('it expires, and an expired nonce is gone rather than reusable', () => {
  const store = new ExecutionNonceStore();
  const nonce = store.mint('pin', ['pin', 'A'], 1000, 0);
  assert.equal(store.redeem(nonce, 'pin', ['pin', 'A'], 1001), false);
});

test('an unminted nonce never redeems, whatever it looks like', () => {
  const store = new ExecutionNonceStore();
  assert.equal(store.redeem('', 'pin', ['pin', 'A']), false);
  assert.equal(store.redeem('0'.repeat(32), 'pin', ['pin', 'A']), false);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/ui/execute-nonce.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Bind by a digest of the id and the argv, so the store holds no command text:

```ts
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Two minutes: long enough to read a field-by-field diff of a real item, short
 * enough that a nonce left in a tab a user walked away from is not an authority
 * an hour later. Deliberately NOT the printed-URL nonce's ten minutes — that one
 * bounds getting from a terminal to a browser, and this one bounds reading one
 * dialog.
 */
export const EXECUTION_NONCE_TTL_MS = 120_000;

function bind(id: string, argv: string[]): string {
  // JSON of the array, not a join: a join would let ['a b'] and ['a','b']
  // produce the same binding, and those are two different commands.
  return createHash('sha256').update(JSON.stringify([id, argv])).digest('hex');
}
```

`redeem` deletes the entry FIRST, then compares the binding with `timingSafeEqual`. Deleting first is what makes a wrong guess cost the nonce, and it mirrors `NonceStore`, which deletes the moment redemption is attempted.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test test/ui/execute-nonce.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/execute-nonce.ts test/ui/execute-nonce.test.ts
git commit -m "ui: a single-use execution nonce bound to the exact id and argv shown"
```

---

### Task 4: The audit record a run cannot happen without

**Files:**
- Modify: `src/core/audit.ts`
- Test: `test/core/audit-execution.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `AuditKind` gains `'execution'`; `EXECUTION_OPS = ['execute'] as const`; `AuditRecord` gains `command?: { id: string; argv: string[]; exitCode: number | null; durationMs: number }`.

**Why a new kind.** The audit log is item-shaped: `mutation` carries `itemId` and `fields`. A run is not about one item and may be about none. Folding it into `mutation` would make every existing reader of that kind wrong about what it is reading, which is the gap `DEC-should-the-web-ui-be-allowed-to-write-config-json` named when it declined the write.

- [ ] **Step 1: Write the failing test**

```ts
test('execute is its own kind, and kindOf says so', () => {
  assert.equal(kindOf('execute'), 'execution');
});

test('the record carries the id, the resolved argv and the exit code', () => {
  const row = recordAndRead({ op: 'execute', command: { id: 'pin', argv: ['pin', 'A'], exitCode: 0, durationMs: 12 } });
  assert.deepEqual(row.command.argv, ['pin', 'A']);
  assert.equal(row.command.exitCode, 0);
});

test('a run that has not finished records a null exit code, never a zero', () => {
  const row = recordAndRead({ op: 'execute', command: { id: 'pin', argv: ['pin', 'A'], exitCode: null, durationMs: 0 } });
  assert.equal(row.command.exitCode, null);
});

test('an execution row is NOT a mutation, so no mutation reader picks it up', () => {
  const rows = readAudit().filter((r) => r.kind === 'mutation');
  assert.equal(rows.some((r) => r.op === 'execute'), false);
});
```

`null` versus `0` is the `STD-absent-vs-zero` standard on a field where the wrong reading is "it succeeded".

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/core/audit-execution.test.ts`
Expected: FAIL — `kindOf('execute')` throws or returns the wrong kind.

- [ ] **Step 3: Write the implementation**

Add the ops array, extend the `AuditOp` union and the `kindOf` map, and add the `command` field with a comment saying it is SCOPE not content — the argv is what ran, and no output is recorded.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test test/core/audit-execution.test.ts test/core/audit.test.ts`
Expected: PASS. Every existing audit test must stay green.

- [ ] **Step 5: Commit**

```bash
git add src/core/audit.ts test/core/audit-execution.test.ts
git commit -m "audit: execution is its own kind — a run is not a mutation of one item"
```

---

### Task 5: `POST /api/execute`

**Files:**
- Create: `src/ui/execute.ts`
- Modify: `src/ui/server.ts` (route registration only)
- Test: `test/ui/execute-route.test.ts`

**Interfaces:**
- Consumes: `resolveCommand` (Task 1), `ExecutionNonceStore` (Task 3), the `execute` audit op (Task 4), `registerRoute` from `src/ui/routes.ts`.
- Produces:
  ```ts
  export function registerExecuteRoutes(nonces: ExecutionNonceStore, cliEntry: string): void;
  ```
  Two routes: `GET /api/execute/confirm?id=…&…` mints a nonce and returns what the dialog must show; `POST /api/execute` runs.

- [ ] **Step 1: Write the failing test**

```ts
test('the confirm GET returns the resolved argv, the boundary and a nonce', async () => {
  const body = await get('/api/execute/confirm?id=pin&id_arg=RULE-x&yes=true');
  assert.deepEqual(body.argv, ['pin', 'RULE-x', '--yes']);
  assert.equal(body.boundary, true);
  assert.match(body.nonce, /^[0-9a-f]{32}$/);
  assert.match(body.residual, /not that you asked/);
});

test('POST with a good nonce runs, and answers with the exit code', async () => {
  const confirm = await get('/api/execute/confirm?id=doctor');
  const body = await post('/api/execute', { id: 'doctor', values: {}, nonce: confirm.nonce });
  assert.equal(body.exitCode, 0);
});

test('POST with NO nonce is 403 and nothing runs', async () => {
  const before = auditRows('execute').length;
  assert.equal((await postRaw('/api/execute', { id: 'doctor', values: {} })).status, 403);
  assert.equal(auditRows('execute').length, before);
});

test('a nonce minted for another command does not authorise this one', async () => {
  const confirm = await get('/api/execute/confirm?id=doctor');
  assert.equal((await postRaw('/api/execute', { id: 'rebuild', values: {}, nonce: confirm.nonce })).status, 403);
});

test('the same nonce cannot run twice', async () => {
  const confirm = await get('/api/execute/confirm?id=doctor');
  await post('/api/execute', { id: 'doctor', values: {}, nonce: confirm.nonce });
  assert.equal((await postRaw('/api/execute', { id: 'doctor', values: {}, nonce: confirm.nonce })).status, 403);
});

test('an unknown id is 400 and never reaches execFile', async () => {
  assert.equal((await postRaw('/api/execute', { id: 'rm', values: {}, nonce: 'x' })).status, 400);
});

test('the client cannot send argv — a body carrying one is refused', async () => {
  const confirm = await get('/api/execute/confirm?id=doctor');
  const res = await postRaw('/api/execute', { id: 'doctor', values: {}, argv: ['rm', '-rf'], nonce: confirm.nonce });
  assert.equal(res.status, 400);
});

test('ONE audit row per run, carrying the argv that actually ran', async () => {
  const confirm = await get('/api/execute/confirm?id=doctor');
  await post('/api/execute', { id: 'doctor', values: {}, nonce: confirm.nonce });
  const rows = auditRows('execute');
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].command.argv, ['doctor']);
});

test('a run that CANNOT be recorded does not happen', async () => {
  withUnwritableAuditLog(async () => {
    const confirm = await get('/api/execute/confirm?id=rebuild');
    const res = await postRaw('/api/execute', { id: 'rebuild', values: {}, nonce: confirm.nonce });
    assert.equal(res.status, 500);
    assert.equal(indexRebuiltAt(), UNCHANGED);
  });
});

test('a non-zero exit is REPORTED, not swallowed — a refusal is a state to leave', async () => {
  const confirm = await get('/api/execute/confirm?id=supersede&id_arg=NOPE&by=ALSO-NOPE');
  const body = await post('/api/execute', { id: 'supersede', values: { id: 'NOPE', by: 'ALSO-NOPE' }, nonce: confirm.nonce });
  assert.notEqual(body.exitCode, 0);
  assert.match(body.stderr, /./);
});

test('the run is bounded — a command that never exits is killed and recorded as killed', async () => {
  // Use the injected runner seam rather than a real hanging command.
  const body = await runWithRunner(() => new Promise(() => {}), { timeoutMs: 20 });
  assert.equal(body.exitCode, null);
  assert.match(body.error, /timed out/);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/ui/execute-route.test.ts`
Expected: FAIL — no such route.

- [ ] **Step 3: Write the implementation**

```ts
import { execFile } from 'node:child_process';

/**
 * A run is bounded. `doctor` and `rebuild` are the slow ones and both finish in
 * seconds on a corpus of this size; a minute is far above that and far below
 * "the tab is wedged". A command that outlives it is killed and RECORDED as
 * killed — `exitCode: null`, never 0, because "we stopped watching" and "it
 * succeeded" are different facts.
 */
const RUN_TIMEOUT_MS = 60_000;
```

The order inside the POST handler is the whole security story and must be exactly this:

1. body shape — refuse any key that is not `id`, `values`, `nonce`. **An `argv` in the body is a 400**, asserted above: a client that sends one has misunderstood the contract, and the day the server starts ignoring it quietly is the day someone starts relying on it.
2. `resolveCommand(id, values)` — a `CommandRefusal` is a 400.
3. `nonces.redeem(nonce, id, resolved.argv)` — false is a 403. **Redeem AFTER resolving**, so the nonce is checked against the argv the server built rather than against anything the client described.
4. Write the audit row with `exitCode: null`. **A failed write aborts with 500 and nothing runs.**
5. `execFile(process.execPath, [cliEntry, ...resolved.argv], { cwd: projectRoot, timeout: RUN_TIMEOUT_MS, shell: false })`.
6. Update the row with the exit code and duration.

Take the runner as an injected function defaulting to `execFile`, so the timeout test above does not need a real hanging process.

Register the routes from `startUiServer` with a per-server `ExecutionNonceStore` — per server, never module-global: two servers in one test process must not authorise each other's runs.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test test/ui/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/execute.ts src/ui/server.ts test/ui/execute-route.test.ts
git commit -m "ui: POST /api/execute takes an id and a nonce, and runs execFile with no shell"
```

---

### Task 6: One control, not nine — Copy and Execute together

**Files:**
- Create: `src/ui/public/lib/command-actions.js`
- Modify: `src/ui/public/screens/palette.js`, `doctor.js`, `packs.js`, `port.js`, `proc.js`, `work.js`, `capture.js`
- Test: `test/ui/command-actions.test.ts`

**Interfaces:**
- Consumes: `composeCommand` from `lib/command.js`.
- Produces: `export function commandActions({ argv, id, values, onDone })` returning an element carrying both controls.

**Why this task exists.** Measured: **nine** `navigator.clipboard.writeText` sites across the screens, each with its own button, its own error handling and its own words. Adding Execute nine times would be nine chances to get the confirm wrong, and the confirm is the security boundary. One control, adopted everywhere a command is composed.

**Two of the nine do not get Execute, and the reason is stated in the code:**

- `config.js:365` copies the BUDGETS TEXT, not a command. There is no command that edits a budget — `cfg.nocmd` says so in the product's own words — so there is nothing to execute and the copy stands alone.
- `coverage.js:473` copies `EMPTY_COMMAND`. Read it before touching it; if it is a placeholder for a command that composes nothing, it gets no Execute either, for the same reason Doctor composes nothing for `dead_scope`.

- [ ] **Step 1: Write the failing test**

```ts
test('the control draws BOTH actions, and Copy still does what it always did', async () => {
  const el = commandActions({ argv: ['doctor'], id: 'doctor', values: {} });
  assert.deepEqual(kindsOf(el), ['button.copy', 'button.exec', 'div.cmdactions']);
});

test('an entry with no catalogue id gets Copy ALONE — nothing composed outside the catalogue runs', async () => {
  const el = commandActions({ argv: ['mycontext', 'whatever'], id: null, values: {} });
  assert.equal(el.querySelector('button.exec'), null);
});

test('Execute opens a confirm that names the resolved command before anything runs', async () => {
  const el = commandActions({ argv: ['doctor'], id: 'doctor', values: {} });
  el.querySelector('button.exec').click();
  await tick();
  assert.match(dialogText(), /mycontext doctor/);
  assert.equal(fetchCalls().filter((c) => c.method === 'POST').length, 0);
});

test('the confirm carries the residual sentence, verbatim', async () => {
  await openConfirm('doctor');
  assert.match(dialogText(), /The UI can tell it came from your browser — not that you asked/);
});

test('a boundary command shows a field-by-field diff, before then after', async () => {
  await openConfirm('pin', { id: 'RULE-x' });
  assert.ok(kindsOf(dialog()).includes('table.diff'));
  assert.match(dialogText(), /always/);
  assert.match(dialogText(), /false/);
  assert.match(dialogText(), /true/);
});

test('a command below the boundary shows the plain confirm and NO diff', async () => {
  await openConfirm('doctor');
  assert.equal(dialog().querySelector('table.diff'), null);
});

test('cancelling runs nothing and spends nothing', async () => {
  await openConfirm('pin', { id: 'RULE-x' });
  dialog().querySelector('button.cancel').click();
  assert.equal(fetchCalls().filter((c) => c.method === 'POST').length, 0);
});

test('the diff is drawn by fieldView — this screen builds no second one', async () => {
  // viewmodel.js's fieldView was lifted into lib/ on 2026-08-26 for exactly this.
  assert.ok(commandActionsSource().includes('fieldView'));
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/ui/command-actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation, then adopt it**

Build `command-actions.js` against the test, then replace each of the seven screens' hand-rolled copy button with it, ONE SCREEN AT A TIME, running that screen's own test file after each. Do not batch the seven: each screen composes its command differently and the id it must pass is different in each.

No `innerHTML` anywhere — CSSOM and `createElement` only, per the CSP this product ships under.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test test/ui/`
Expected: PASS, including every per-screen test.

- [ ] **Step 5: Commit**

```bash
git add src/ui/public/lib/command-actions.js src/ui/public/screens/ test/ui/command-actions.test.ts
git commit -m "ui: one Copy-and-Execute control, adopted by the seven screens that compose a command"
```

---

### Task 7: The confirm in a real browser

**Files:**
- Create: `e2e/execute.spec.ts`
- Test: itself

- [ ] **Step 1: Write the failing test**

```ts
test('a read command runs from the UI and the screen shows what it did', async ({ page }) => {
  await open(page, '#/palette');
  await compose(page, 'doctor');
  await page.getByRole('button', { name: /execute/i }).click();
  await expect(page.getByText('mycontext doctor')).toBeVisible();
  await page.getByRole('button', { name: /run it/i }).click();
  await expect(page.getByText(/exit 0/)).toBeVisible();
});

test('a boundary command shows every field that changes, before and after, and only then runs', async ({ page }) => {
  await open(page, '#/palette');
  await compose(page, 'pin', { id: SEEDED_ITEM });
  await page.getByRole('button', { name: /execute/i }).click();
  await expect(page.getByRole('table', { name: /changes/i })).toBeVisible();
  await expect(page.getByText(/not that you asked/)).toBeVisible();
  await page.getByRole('button', { name: /run it/i }).click();
  await expect(page.getByText(/exit 0/)).toBeVisible();
  await expect(page.getByText(/always/)).toBeVisible();
});

test('the run is in the audit stream, as one execution record', async ({ page }) => {
  await open(page, '#/watch');
  await expect(page.getByText(/execute/)).toBeVisible();
});
```

- [ ] **Step 2: Run it and watch it fail, then pass**

**Stop every UI server you have running first.** Run: `npm run test:e2e -- execute`

- [ ] **Step 3: Look at it**

`RULE-a-ui-change-is-not-verified-until-someone-has-looked-at-it`. Take a screenshot of both confirms and read them as a person would. The diff is the security surface: if a field that changes is not on it, the confirm is lying.

- [ ] **Step 4: Commit**

```bash
git add e2e/execute.spec.ts
git commit -m "e2e: the confirm is rendered, read and only then run, in a real browser"
```

---

### Task 8: The read path stays read-only, and the product says what it cannot prove

**Files:**
- Modify: `test/ui/no-writes.test.ts`, `README.md`, `docs/README.he.md`
- Test: the whole suite

- [x] **Step 1: Narrow `no-writes.test.ts`** — DONE 2026-08-27, and not the way this step first proposed.

The step said to narrow the test to `read-model*.ts` and their graph. **That is wider than the change needs and it would have thrown away three working guards.** Wiring the route made exactly three assertions go red, and each wanted a different, smaller answer:

1. **the write-symbol ban** — `RULED_WRITES` gains ONE entry, `src/ui/execute.ts binds recordAudit`, with the ruling and the three properties that bound it. What stopped being true is *"the UI never writes"*; what still holds, and still fails, is *"a READ path never writes"* — every read module is untouched and the new write is named one symbol at a time.
2. **the dynamic-import ban** — a `DYNAMIC_EDGES` entry naming the module loaded and the test that holds THAT module instead (`palette-lib.test.ts`, over its bytes). Verified in both directions, so an entry whose file no longer has a dynamic import fails as itself rather than quietly covering the next one.
3. **the over-blanking guard** — no change to the test at all. A doc comment in `execute-catalogue.ts` quoted an import in the `from '…'` form, which reads as a statement the masker swallowed. **The comment moved; the guard stays exact.**

The lesson is worth more than the diff: *narrowing a gate is not one move. Read what each assertion is actually protecting before deciding which of them your change is allowed to cost you.*

- [ ] **Step 2: Write §7 of both READMEs**

Beside the existing trust boundary, in these words or better:

> The UI can run the commands it composes. Every run is behind a confirm that names the command and, for anything that changes what governs the project, every field it will change. **The gate proves a request came from a browser on this machine. It never proves that a person asked.** There is no way to turn execution off short of not running `mycontext ui`.

`test/docs/parity.test.ts` holds the two READMEs to the same sections, so both change together.

- [ ] **Step 3: Run every gate the way the project runs it**

```bash
npm run typecheck && npm test && npm run check:text-files && npm run check:retired && npm run check:test-glob && npm run verify:citations && npm run test:e2e
```

- [ ] **Step 4: Close the corpus tasks**

```bash
mycontext edit <id> --extra state=done
```

- [ ] **Step 5: Commit**

```bash
git add test/ui/no-writes.test.ts README.md docs/README.he.md
git commit -m "docs: the UI executes, and says plainly what its gate cannot prove"
```

---

## Self-review

**Spec coverage.** §3.1 is Task 1. §3.2 and §6.1 are Tasks 2 and 6 together — the derivation gates the flag, the flag chooses the confirm, and the confirm is where the diff lives. §3.3 and §6.3's raised stakes are Task 3, and the residual sentence is asserted in Tasks 5, 6 and 7 and written in Task 8. §3.4 is Task 4, with "a run that cannot be recorded does not happen" as its own assertion in Task 5. §3.5 is Task 8. §5's three exclusions are enforced by construction in Task 1 — there is no path that takes text, no argument shape that leaves the workspace, and no route that bypasses the catalogue. §6.2 is a Global Constraint: no task adds a switch.

**Placeholders.** None. Every code step carries code. Three steps say *read this module first* and each names the module and the specific property to copy.

**Type consistency.** `ResolvedCommand` is produced in Task 1 and consumed in Tasks 2 and 5. `ExecutionNonceStore` is produced in Task 3 and consumed in Task 5. The `execute` op and the `command` field are produced in Task 4 and consumed in Task 5 and asserted in Task 7. `commandActions` keeps its name in Tasks 6 and 7.

**Two things an executor must not do.** Do not let the client send argv, anywhere, even as a hint — Task 5 asserts the refusal and the assertion is the point. And do not add a way to turn execution off: it was declined twice, with the residual in front of the owner both times, and re-adding it as a "safety" config key would quietly reverse a decision he took deliberately.
