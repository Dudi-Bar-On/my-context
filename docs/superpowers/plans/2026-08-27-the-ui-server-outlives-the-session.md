# The UI server outlives the session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a workspace opts in by naming a port, the UI server is there whenever the owner looks — restarted within one turn or one minute of dying, without a browser opening, without a spawn storm, and without doing anything at all on a machine that did not ask.

**Architecture:** A liveness record in the global directory says where a server should be; a three-step probe proves whether one is. The probe runs on `Stop`, which already fires every turn, floored at 60 seconds; the spawn it may trigger is rate-limited separately and gives up after three failures. `ui.enabled` gets its first enforcement site, and a new `ui.port` is the opt-in: absent means the whole mechanism is off.

**Tech Stack:** Node >= 24 built-ins only — `node:net`, `node:child_process`, `node:fs`. No build step, no runtime dependency, erasable TypeScript syntax only. `node:test` with `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-08-27-the-ui-server-outlives-the-session-design.md`

## Global Constraints

- Node >= 24, native TypeScript type-stripping, `erasableSyntaxOnly`.
- Zero runtime dependencies. `node:` built-ins only.
- The server binds `127.0.0.1` and refuses any other host. Nothing in this plan changes that.
- **Off unless configured.** With `ui.port` absent, no file is written, no port is probed and no process is spawned. A plugin does not start background servers because somebody installed it.
- No hook opens a browser. `--no-open`, always.
- Every hook exits 0 and never blocks. `Stop` runs on a 3-second timeout the platform genuinely waits on.
- Machine state lives in `GLOBAL_DIR`, never in a repository: a pid committed to git means something else on the next machine.
- Run the whole suite with `npm test`. Never run `npm test` or `test:e2e` from a subagent.

---

### Task 1: The liveness record

**Files:**
- Create: `src/core/ui-server-record.ts`
- Test: `test/core/ui-server-record.test.ts`

**Interfaces:**
- Consumes: `GLOBAL_DIR` from `src/core/workspace.ts`.
- Produces:
  ```ts
  export interface UiServerRecord {
    version: 1; pid: number; host: string; port: number;
    url: string; startedAt: number; workspace: string;
  }
  export function uiServerRecordPath(globalRoot?: string): string;
  export function writeUiServerRecord(record: UiServerRecord, globalRoot?: string): void;
  export function readUiServerRecord(globalRoot?: string): UiServerRecord | null;
  export function clearUiServerRecord(globalRoot?: string): void;
  ```

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  writeUiServerRecord, readUiServerRecord, clearUiServerRecord, uiServerRecordPath,
} from '../../src/core/ui-server-record.ts';

const RECORD = {
  version: 1 as const, pid: 4242, host: '127.0.0.1', port: 58888,
  url: 'http://127.0.0.1:58888/', startedAt: 1_756_300_000_000, workspace: 'D:\\repo',
};

test('a written record reads back exactly', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'uirec-'));
  writeUiServerRecord(RECORD, root);
  assert.deepEqual(readUiServerRecord(root), RECORD);
});

test('no record at all is null, not a throw', () => {
  assert.equal(readUiServerRecord(mkdtempSync(path.join(tmpdir(), 'uirec-'))), null);
});

test('unparseable, wrong-version and wrong-shape records are all null', () => {
  for (const body of ['{ not json', '{"version":2,"port":1}', '{"version":1}', '[]']) {
    const root = mkdtempSync(path.join(tmpdir(), 'uirec-'));
    writeFileSync(uiServerRecordPath(root), body, 'utf8');
    assert.equal(readUiServerRecord(root), null, body);
  }
});

test('clear removes it, and clearing nothing is not an error', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'uirec-'));
  writeUiServerRecord(RECORD, root);
  clearUiServerRecord(root);
  assert.equal(existsSync(uiServerRecordPath(root)), false);
  clearUiServerRecord(root);
});

test('the write is atomic — no temp file survives a completed write', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'uirec-'));
  writeUiServerRecord(RECORD, root);
  assert.deepEqual(readdirSync(root), ['ui-server.json']);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/core/ui-server-record.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Follow `src/core/ui-sessions.ts` exactly: same directory, same tmp-plus-rename, same never-throw posture on a read. A record that does not parse, carries another `version`, or is missing any field is `null` — this file is a hint, and a hint that cannot be understood is no hint.

```ts
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GLOBAL_DIR } from './workspace.ts';

const RECORD_FILE = 'ui-server.json';

export function uiServerRecordPath(globalRoot: string = GLOBAL_DIR): string {
  return path.join(globalRoot, RECORD_FILE);
}

export function writeUiServerRecord(record: UiServerRecord, globalRoot: string = GLOBAL_DIR): void {
  mkdirSync(globalRoot, { recursive: true });
  const target = uiServerRecordPath(globalRoot);
  const tmp = `${target}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  renameSync(tmp, target);
}

export function readUiServerRecord(globalRoot: string = GLOBAL_DIR): UiServerRecord | null {
  let raw: string;
  try { raw = readFileSync(uiServerRecordPath(globalRoot), 'utf8'); } catch { return null; }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const value = parsed as Record<string, unknown>;
  if (value.version !== 1) return null;
  const num = (key: string): number | null => (typeof value[key] === 'number' ? value[key] as number : null);
  const str = (key: string): string | null => (typeof value[key] === 'string' ? value[key] as string : null);
  const pid = num('pid'); const port = num('port'); const startedAt = num('startedAt');
  const host = str('host'); const url = str('url'); const workspace = str('workspace');
  if (pid === null || port === null || startedAt === null
      || host === null || url === null || workspace === null) return null;
  return { version: 1, pid, host, port, url, startedAt, workspace };
}

export function clearUiServerRecord(globalRoot: string = GLOBAL_DIR): void {
  try { rmSync(uiServerRecordPath(globalRoot)); } catch { /* already gone is the goal */ }
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test test/core/ui-server-record.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/ui-server-record.ts test/core/ui-server-record.test.ts
git commit -m "core: a liveness record for the UI server, in the global directory"
```

---

### Task 2: The server writes it, and takes it back

**Files:**
- Modify: `src/ui/server.ts`
- Test: `test/ui/server-record.test.ts`

**Interfaces:**
- Consumes: `writeUiServerRecord`, `clearUiServerRecord` from Task 1.
- Produces: nothing new. This is the second write the UI server performs; the first is `recordSessionDigest`.

- [ ] **Step 1: Write the failing test**

```ts
test('a listening server leaves a record naming its real bound port', async () => {
  const { server, port, globalRoot } = await startForTest();
  const record = readUiServerRecord(globalRoot);
  assert.equal(record.port, port);
  assert.equal(record.pid, process.pid);
  assert.equal(record.host, '127.0.0.1');
  assert.match(record.url, new RegExp(`127\\.0\\.0\\.1:${port}`));
  await close(server);
});

test('closing takes the record back', async () => {
  const { server, globalRoot } = await startForTest();
  await close(server);
  assert.equal(readUiServerRecord(globalRoot), null);
});

test('the recorded port is the BOUND one, not the requested one', async () => {
  const { server, globalRoot } = await startForTest({ port: 0 });
  assert.notEqual(readUiServerRecord(globalRoot).port, 0);
  await close(server);
});

test('an idle exit takes the record back too', async () => {
  const { server, globalRoot } = await startForTest({ idleMs: 30 });
  await onceClosed(server);
  assert.equal(readUiServerRecord(globalRoot), null);
});
```

That third assertion is the one that matters: the default port is 0, and a record saying `0` would send every probe to the wrong place forever.

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/ui/server-record.test.ts`
Expected: FAIL — nothing writes a record.

- [ ] **Step 3: Write the implementation**

In `src/ui/server.ts`, after `server.listen` resolves and the bound port has been read back from `server.address()`, write the record. Clear it in the same place the idle monitor's close callback runs and on any other close path, so there is exactly one removal site per exit route. Never throw out of either: a server that cannot write its own record still serves.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test test/ui/`
Expected: PASS. `test/ui/no-writes.test.ts` will FAIL until its allow-list gains this write — the file holds `src/ui/` to exactly two ruled-in writes, both outside any request path. This is the third, it is outside any request path, and it must be added there with the same one-line reason the other two carry.

- [ ] **Step 5: Commit**

```bash
git add src/ui/server.ts test/ui/server-record.test.ts test/ui/no-writes.test.ts
git commit -m "ui: the server records where it is listening, and takes it back on exit"
```

---

### Task 3: Proving a server is alive

**Files:**
- Create: `src/core/ui-server-probe.ts`
- Test: `test/core/ui-server-probe.test.ts`

**Interfaces:**
- Consumes: `readUiServerRecord`, `clearUiServerRecord` from Task 1.
- Produces:
  ```ts
  export type Liveness =
    | { state: 'alive'; port: number; url: string }
    | { state: 'no-record' }
    | { state: 'dead'; why: 'pid' | 'port'; port: number };
  export function probeUiServer(globalRoot?: string, timeoutMs?: number): Promise<Liveness>;
  ```

- [ ] **Step 1: Write the failing test**

```ts
test('no record is no-record, and nothing is deleted', async () => {
  assert.deepEqual(await probeUiServer(emptyRoot()), { state: 'no-record' });
});

test('a record naming a dead pid is dead, and the record is REMOVED', async () => {
  const root = withRecord({ pid: 999_999, port: 1 });
  assert.equal((await probeUiServer(root)).why, 'pid');
  assert.equal(readUiServerRecord(root), null);
});

test('a live pid whose port refuses is dead by port, and removed', async () => {
  const root = withRecord({ pid: process.pid, port: await closedPort() });
  assert.equal((await probeUiServer(root)).why, 'port');
  assert.equal(readUiServerRecord(root), null);
});

test('a live pid on a listening port is ALIVE, and the record survives', async () => {
  const listener = await listen();
  const root = withRecord({ pid: process.pid, port: listener.port });
  const live = await probeUiServer(root);
  assert.equal(live.state, 'alive');
  assert.equal(live.port, listener.port);
  assert.notEqual(readUiServerRecord(root), null);
  await listener.close();
});

test('the probe is bounded — an unresponsive port does not hang the turn', async () => {
  const started = Date.now();
  await probeUiServer(withRecord({ pid: process.pid, port: 1 }), 50);
  assert.ok(Date.now() - started < 1000);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/core/ui-server-probe.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
import net from 'node:net';
import { readUiServerRecord, clearUiServerRecord } from './ui-server-record.ts';

/** Bounded hard: this runs on a hook the platform waits for. */
const PROBE_TIMEOUT_MS = 250;

export async function probeUiServer(
  globalRoot?: string, timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<Liveness> {
  const record = readUiServerRecord(globalRoot);
  if (record === null) return { state: 'no-record' };

  // Step 2: the pid. Cheap, and it catches the common case — a killed server.
  // It is NOT sufficient: pids are reused, which is why step 3 exists and why
  // step 3 is the one that decides.
  try { process.kill(record.pid, 0); } catch {
    clearUiServerRecord(globalRoot);
    return { state: 'dead', why: 'pid', port: record.port };
  }

  // Step 3: the port. THIS is the measurement. Everything above it is a claim.
  const listening = await connects(record.host, record.port, timeoutMs);
  if (!listening) {
    clearUiServerRecord(globalRoot);
    return { state: 'dead', why: 'port', port: record.port };
  }
  return { state: 'alive', port: record.port, url: record.url };
}

function connects(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (answer: boolean): void => { socket.destroy(); resolve(answer); };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test test/core/ui-server-probe.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/ui-server-probe.ts test/core/ui-server-probe.test.ts
git commit -m "core: liveness is proved on the port, never claimed by a file"
```

---

### Task 4: `ui.port`, and `ui.enabled` finally means something

**Files:**
- Modify: `src/core/config.ts`, `src/cli/commands/ui.ts`
- Test: `test/core/config-ui-port.test.ts`, `test/cli/ui-enabled.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `UiConfig.port: number | null`, default `null`.

- [ ] **Step 1: Write the failing test**

```ts
test('ui.port defaults to null, which is what keeps the mechanism off', () => {
  assert.equal(loadConfigFrom({}).ui.port, null);
  assert.equal(loadConfigFrom({ ui: { enabled: true } }).ui.port, null);
});

test('a port is a whole number in 1..65535 and anything else is refused BY NAME', () => {
  assert.equal(loadConfigFrom({ ui: { port: 58888 } }).ui.port, 58888);
  for (const bad of [0, -1, 65_536, 1.5, '58888', true]) {
    assert.throws(() => loadConfigFrom({ ui: { port: bad } }), /ui\.port/, String(bad));
  }
});

test('ui.enabled false REFUSES mycontext ui, and says which key did it', async () => {
  const run = await cli(['ui', '--no-open'], { config: { ui: { enabled: false } } });
  assert.equal(run.code, 1);
  assert.match(run.out, /ui\.enabled/);
  assert.match(run.out, /config\.json/);
});

test('ui.enabled true, and absent, both serve — the default is opt-out', async () => {
  assert.equal((await cli(['ui', '--no-open', '--idle-ms', '30'], { config: {} })).code, 0);
  assert.equal((await cli(['ui', '--no-open', '--idle-ms', '30'], { config: { ui: { enabled: true } } })).code, 0);
});
```

The third test is the one this task exists for: `ui.enabled` has been validated, displayed and enforced by nothing since it shipped, and `src/core/config.ts` says so about itself.

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/core/config-ui-port.test.ts test/cli/ui-enabled.test.ts`
Expected: FAIL — `ui.port` is not a key, and `ui.enabled: false` starts a server.

- [ ] **Step 3: Write the implementation**

In `src/core/config.ts`: add `'port'` to `UI_KEYS`, add `port: number | null` to `UiConfig`, default `null` in `DEFAULT_UI`, and validate in `requireUi` with the same message shape as `enabled`.

In `src/cli/commands/ui.ts`: load the workspace config — `cmdUi` does not today — and refuse before binding when `ui.enabled === false`:

```
my_context: ui.enabled is false in .my_context/config.json, so the web UI is off.
Set it to true, or remove the key, to serve. Configuration is a file and is yours
to edit; nothing here writes it.
```

That wording is the deny hook's own line, and it is deliberate: the product should say the same thing everywhere it declines to write a config.

The CLI's `--port` flag still wins over `ui.port` when given. `ui.port` is what a hook uses, and what the CLI falls back to when no flag is passed.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test test/core/ test/cli/`
Expected: PASS. `test/core/config.test.ts` asserts on `UI_KEYS` and must stay green.

- [ ] **Step 5: Commit**

```bash
git add src/core/config.ts src/cli/commands/ui.ts test/core/config-ui-port.test.ts test/cli/ui-enabled.test.ts
git commit -m "config: ui.port names where, ui.enabled finally decides whether"
```

---

### Task 5: The hook that keeps it up

**Files:**
- Create: `src/core/ui-server-upkeep.ts`
- Modify: `src/hooks/stop.ts`
- Test: `test/core/ui-server-upkeep.test.ts`, `test/hooks/stop-ui-upkeep.test.ts`

**Interfaces:**
- Consumes: `probeUiServer` from Task 3; `UiConfig` from Task 4.
- Produces:
  ```ts
  export const PROBE_FLOOR_MS = 60_000;
  export const SPAWN_INTERVAL_MS = 5 * 60_000;
  export const MAX_CONSECUTIVE_SPAWN_FAILURES = 3;
  export type Upkeep =
    | { did: 'nothing'; why: 'off' | 'disabled' | 'too-soon' | 'alive' | 'stood-down' }
    | { did: 'spawned'; port: number }
    | { did: 'stood-down'; failures: number };
  export function upkeepUiServer(projectRoot: string, config: Config, now: number): Promise<Upkeep>;
  ```

- [ ] **Step 1: Write the failing test**

```ts
test('with ui.port absent nothing happens and NOTHING is written', async () => {
  const state = freshState();
  assert.deepEqual(await upkeepUiServer(root, config({}), now), { did: 'nothing', why: 'off' });
  assert.deepEqual(readdirSync(state.dir), []);
});

test('with ui.enabled false nothing happens even when a port is set', async () => {
  const result = await upkeepUiServer(root, config({ ui: { enabled: false, port: 58888 } }), now);
  assert.deepEqual(result, { did: 'nothing', why: 'disabled' });
});

test('a live server is left alone', async () => {
  const listener = await listenOn(58888);
  assert.deepEqual(await upkeepUiServer(root, PORT_CONFIG, now), { did: 'nothing', why: 'alive' });
  await listener.close();
});

test('a dead server is spawned back — once', async () => {
  assert.equal((await upkeepUiServer(root, PORT_CONFIG, now)).did, 'spawned');
});

test('the PROBE is floored at 60 seconds', async () => {
  await upkeepUiServer(root, PORT_CONFIG, now);
  assert.deepEqual(await upkeepUiServer(root, PORT_CONFIG, now + 59_000), { did: 'nothing', why: 'too-soon' });
  assert.notEqual((await upkeepUiServer(root, PORT_CONFIG, now + 61_000)).why, 'too-soon');
});

test('the SPAWN is floored at 5 minutes, separately from the probe', async () => {
  await upkeepUiServer(root, PORT_CONFIG, now);                       // spawns
  assert.equal((await upkeepUiServer(root, PORT_CONFIG, now + 61_000)).did, 'nothing');
  assert.equal((await upkeepUiServer(root, PORT_CONFIG, now + 301_000)).did, 'spawned');
});

test('three failed spawns stand the mechanism down for the session', async () => {
  let at = now;
  for (let i = 0; i < 3; i += 1) { await upkeepUiServer(root, FAILING_CONFIG, at); at += 301_000; }
  const result = await upkeepUiServer(root, FAILING_CONFIG, at + 301_000);
  assert.deepEqual(result, { did: 'nothing', why: 'stood-down' });
});

test('a successful probe resets the failure counter', async () => {
  let at = now;
  for (let i = 0; i < 2; i += 1) { await upkeepUiServer(root, FAILING_CONFIG, at); at += 301_000; }
  const listener = await listenOn(58888);
  await upkeepUiServer(root, PORT_CONFIG, at + 301_000);
  await listener.close();
  assert.equal((await upkeepUiServer(root, FAILING_CONFIG, at + 602_000)).did, 'spawned');
});

test('the spawn is detached, ignores its stdio, and never opens a browser', async () => {
  const call = await captureSpawn(() => upkeepUiServer(root, PORT_CONFIG, now));
  assert.deepEqual(call.options, { detached: true, stdio: 'ignore' });
  assert.ok(call.args.includes('--no-open'));
  assert.ok(call.args.includes('--port') && call.args.includes('58888'));
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/core/ui-server-upkeep.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Two clocks, in state beside the other per-workspace state: `lastProbeAt` and `lastSpawnAt`, plus `consecutiveSpawnFailures`.

```ts
/**
 * How often the PROBE may run. Not derived from how long a server lives —
 * IDLE_MS is eight hours, and an interval derived from that would be a
 * mechanism that is never there when it is wanted. Derived instead from how
 * long the owner would sit looking at a dead tab.
 */
export const PROBE_FLOOR_MS = 60_000;

/**
 * How often a SPAWN may be attempted. A different number from the probe's on
 * purpose: probing is a socket connect, spawning is a process, and a hook that
 * retries a failing spawn every minute forever is the only path here that can
 * overload a machine.
 */
export const SPAWN_INTERVAL_MS = 5 * 60_000;

/** After this many, stand down and say so. A refusal is a state to leave. */
export const MAX_CONSECUTIVE_SPAWN_FAILURES = 3;
```

The order of the guards is the order of their cost, cheapest first: `off`, `disabled`, `stood-down`, `too-soon`, then the probe, then the spawn floor, then the spawn. The spawn itself:

```ts
const child = spawn(process.execPath, [cliEntry, 'ui', '--port', String(port), '--no-open'],
  { detached: true, stdio: 'ignore' });
child.unref();
```

`detached` and `unref` are not optional. `Stop` runs on a 3-second timeout the platform genuinely waits on, and a child holding the parent's event loop open turns every turn into a pause.

A spawn counts as FAILED when the next probe after `SPAWN_INTERVAL_MS` still finds nothing — not when `spawn` itself throws. A detached child that exits one second later throws nothing, and that is the failure this counter is for.

Then in `src/hooks/stop.ts`, call it. `observeStop` already returns a note every turn; the upkeep result joins that note so the audit log carries what was done, and the hook writes nothing to stdout for it. The handover ask from the other plan owns `context`; upkeep never sets it.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test test/core/ui-server-upkeep.test.ts test/hooks/stop-ui-upkeep.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/ui-server-upkeep.ts src/hooks/stop.ts test/core/ui-server-upkeep.test.ts test/hooks/stop-ui-upkeep.test.ts
git commit -m "hooks: the UI server is put back up, once a minute at most and never a storm"
```

---

### Task 6: The gates and the docs

**Files:**
- Modify: `README.md`, `docs/README.he.md`
- Test: the whole suite

- [ ] **Step 1: Run every gate the way the project runs it**

```bash
npm run typecheck && npm test && npm run check:text-files && npm run check:retired && npm run check:test-glob && npm run verify:citations && npm run test:e2e
```

Stop every server you have running first: the e2e suite spins its own over the same `.demo-corpus`, and two servers over one fixture produce failures belonging to nobody.

- [ ] **Step 2: Document it in both READMEs**

`test/docs/parity.test.ts` holds the two READMEs to the same sections. Four things: `ui.port` is the opt-in, `ui.enabled` is the off switch and now does something, the server restarts within a minute of dying, and an already-open tab survives the restart because previously issued session digests are honoured.

- [ ] **Step 3: Re-run the gates**

Same command. Expected: all exit 0.

- [ ] **Step 4: Close the corpus tasks**

```bash
mycontext edit <id> --extra state=done
```

- [ ] **Step 5: Commit**

```bash
git add README.md docs/README.he.md
git commit -m "docs: the UI server's upkeep, its two intervals and its off switch"
```

---

## Self-review

**Spec coverage.** §3's record is Tasks 1 and 2, §3's three-step proof is Task 3, §4's nonce answer needs no code — it is `ui-sessions.json` behaving as built, and it is asserted end to end in Task 6's e2e run rather than mocked. §5.1 and §5.2 are Task 5's two floors and its stand-down. §5.3 is Task 5's spawn shape, asserted. §6's opt-in is Task 4. §7's four prohibitions: no browser is Task 5's assertion, no wedged-server restart is the definition of `alive` in Task 3, `--idle-ms` is untouched everywhere, and the subagent restriction goes on `observeStop` in Task 5. §8 is the owner's and is not a task.

**Placeholders.** None. Every code step carries code; the two steps that say *follow the existing module* name it and say which property of it to copy.

**Type consistency.** `UiServerRecord` is produced in Task 1 and consumed in Tasks 2 and 3. `Liveness` is produced in Task 3 and consumed in Task 5. `UiConfig.port` is produced in Task 4 and consumed in Task 5. `probeUiServer` and `upkeepUiServer` keep their names and their signatures throughout.

**One thing an executor must not do.** Task 2 adds the third write in `src/ui/`, a directory a test holds to read-only on purpose. Add it to that test's allow-list with its reason. Do not widen the test.
