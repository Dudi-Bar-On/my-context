// @basis TASK-the-differential-test-identical-behaviour-with-the-ui, REQ-r14-the-web-ui-is-optional-config-gated-slash-toggled-and, TASK-ui-enabled-is-accepted-strictly-validated-and-read-by, RULE-anything-you-start-for-a-human-to-look-at-must-outlive-the
/**
 * **The same work, run twice — once with the UI on and a real server serving
 * the corpus, once with `ui.enabled: false` — and what the product did compared
 * byte for byte.** `TASK-the-differential-test-identical-behaviour-with-the-ui`
 * (ruling R14.4), which is the proof obligation behind R14's third clause: the
 * UI's presence must not change what gets injected.
 *
 * ── WHAT THIS IS NOT, BECAUSE THE ITEM SAYS IT WILL BE OFFERED ─────────────
 *
 * It is not an import-graph check. `test/ui/no-writes.test.ts` already proves,
 * statically, that nothing outside `src/ui/` binds a write symbol and that the
 * UI's own write set is exactly one member. That is a fact about CODE, and the
 * item records it as a REJECTED alternative for exactly the reason it is
 * tempting: it is green, it is cheap, and it says nothing whatsoever about
 * BEHAVIOUR. The UI's presence reaches the product through four channels a
 * graph walk cannot see —
 *
 *   1. **the hook.** `upkeepUiServer` runs from the `Stop` hook on every
 *      assistant turn (`src/hooks/stop.ts` · `stopUpkeep`), and its slowest
 *      path — the stale restart — costs about 1.3 s inside a 3 s platform
 *      timeout. "UI on" is not a free observer.
 *   2. **files it writes or touches.** `state/ui-server-upkeep.json`, the
 *      liveness record, the session store.
 *   3. **audit rows it adds.** The freshness exchange's first step is
 *      `POST /api/nonce`, and the server writes a row for every credential it
 *      hands out (`src/ui/security.ts` · `recordNonceMint`).
 *   4. **timing.**
 *
 * So both sides here are REAL: the on side starts a real `src/ui/server.ts`
 * child over its own corpus and points `ui.port` at it, so the upkeep's probe
 * finds a live server and runs the whole freshness exchange against it. A test
 * that set `enabled: true` and started nothing would be comparing two runs of
 * the same code path and could never go red.
 *
 * ── BOTH DIRECTIONS, AND THE ENABLED ONE IS THE PRIMARY CASE ───────────────
 *
 * The item's second instruction, which it predicts will be skipped: the UI is
 * enabled by default (`DEFAULT_UI`), so the no-effect claim has to hold on the
 * path every install gets. Testing only that `false` behaves like today would
 * be testing the branch nobody is on. Every assertion below is a comparison of
 * the two, so neither side is the reference.
 *
 * ── THE THREE THINGS COMPARED, AND ONE MORE ────────────────────────────────
 *
 * The item names three — identical injection text, identical audit records,
 * identical exit codes — and this file adds the corpus files, because a write
 * the UI caused that changed no audit row would otherwise be invisible and is
 * the failure R14 exists to prevent wearing its worst hat.
 *
 * ── THE ONE DIFFERENCE THAT IS REAL TODAY, MEASURED NOT NORMALISED ─────────
 *
 * **With the UI on the workspace gains one `access` / `nonce-minted` audit row
 * and one file, `state/ui-server-upkeep.json`.** Both are the UI's own
 * bookkeeping — the `access` kind exists in `AuditOp` precisely to record the
 * UI gate handing out and refusing credentials, and the upkeep state file holds
 * the upkeep's clocks — and neither is a change to what the product decided.
 *
 * It is not normalised away. `kind: 'access'` rows are compared as their own
 * EQUALITY (the on side's access ops are exactly `['nonce-minted']`, the off
 * side's exactly `[]`), so a UI that grew a second kind of row, or wrote one
 * outside `access`, fails here. That is `no-writes.test.ts`'s argument applied
 * to the log: an allow-list is a set a test agrees not to look at and can only
 * grow; an exact set fails in both directions.
 *
 * ── WHAT IS NORMALISED, AND NOTHING ELSE IS ────────────────────────────────
 *
 * Two substitutions, both forced by the two sides living in two directories at
 * two moments, and both narrow enough to state:
 *
 *   - the workspace's own absolute path becomes `<WS>`, in all three spellings
 *     it appears in (native separators, forward slashes, and the doubled
 *     separators a JSON envelope carries).
 *   - ISO-8601 instants become `<TIME>`.
 *
 * `AuditRecord.at` is dropped for the same reason. **`checksumAfter` is NOT**,
 * and that is deliberate: the item `mycontext add` writes carries no instant at
 * all, so its hash is identical on both sides and comparing it is free. A field
 * dropped because it MIGHT have been volatile is an assertion given away for
 * nothing.
 *
 * ── SAFETY, AND THE OWNER'S SERVER ─────────────────────────────────────────
 *
 * The owner's UI server on 58888 is never touched. This file starts its own
 * child through `startUiChild`, which binds `--port 0` behind
 * `startOnSafePort`; the liveness record the upkeep probes is pinned out of
 * `~/.my-context` by `pin-sessions-dir.ts`, so the probe can only ever find
 * THIS file's server. `ui.port` on both sides is the harness port, so the
 * upkeep finds a live server and never spawns one.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { readAudit, type AuditRecord } from '../../src/core/audit.ts';
import { readUiServerRecord } from '../../src/core/ui-server-record.ts';
import { removeTree } from '../helpers/tmp.ts';
import '../helpers/pin-sessions-dir.ts';
import { startUiChild, type UiHarness } from './helpers.ts';

const REPO = fileURLToPath(new URL('../..', import.meta.url));
const HOOK = (name: string): string => path.join(REPO, 'src', 'hooks', `${name}.ts`);
const CLI = path.join(REPO, 'src', 'cli', 'index.ts');

/** Cold `node` start plus the whole injection import graph, on a loaded box. */
const RUN_BUDGET_MS = 60_000;

interface Run {
  /** What was run, for a failure message that names the operation. */
  label: string;
  code: number | null;
  stdout: string;
  stderr: string;
}

/**
 * One product operation, as a real OS process over real stdio.
 *
 * A child rather than an in-process call, because the thing being compared is
 * what the PRODUCT does — the binary Claude Code runs and the CLI a person
 * types — and because the upkeep's probe, its freshness exchange and the
 * server's audit write only happen at all when a real process performs them.
 *
 * `HOME`/`USERPROFILE` are pointed at a throwaway directory: `GLOBAL_DIR` is
 * computed from `homedir()` at module load, so a maintainer with a global
 * corpus would otherwise have their own items folded into both injections. The
 * pinned sessions dir rides through on `process.env`.
 */
function run(label: string, args: string[], payload: string, cwd: string, home: string): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath, ['--disable-warning=ExperimentalWarning', ...args],
      { cwd, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, HOME: home, USERPROFILE: home } },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c: string) => { stdout += c; });
    child.stderr.on('data', (c: string) => { stderr += c; });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${label} did not exit within ${RUN_BUDGET_MS}ms; stdout so far: ${stdout}`));
    }, RUN_BUDGET_MS);
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ label, code, stdout, stderr }); });
    child.stdin.write(payload);
    child.stdin.end();
  });
}

/**
 * The corpus both sides start from.
 *
 * Written as files rather than added through the CLI so the two sides are
 * byte-identical before a single operation runs — `mycontext add` stamps
 * `last_change`, and two seedings a second apart would start the comparison
 * already unequal.
 *
 * Two items and they earn their places: `CONST-pool` is `always: true`, so the
 * pinned tier has something to deliver on every injection door, and
 * `RULE-scoped` carries a `scope`, so `PreToolUse`'s JIT tier has something to
 * match. An injection of `''` compared against an injection of `''` is the
 * vacuous green this whole file is built to avoid, and `injection is non-empty`
 * below asserts it never happens.
 */
function seed(cwd: string): void {
  const items = path.join(cwd, '.my_context', 'items');
  mkdirSync(path.join(items, 'constraint'), { recursive: true });
  writeFileSync(path.join(items, 'constraint', 'CONST-pool.md'), `---
id: CONST-pool
type: constraint
title: Pool capped at 20
status: active
severity: hard
always: true
---

# Pool capped at 20

The connection pool is capped at 20.
`, 'utf8');
  mkdirSync(path.join(items, 'rule'), { recursive: true });
  writeFileSync(path.join(items, 'rule', 'RULE-scoped.md'), `---
id: RULE-scoped
type: rule
title: Handlers validate before they dispatch
status: active
severity: soft
always: false
scope:
  - "src/**"
---

# Handlers validate before they dispatch

Every handler under src/ validates its input before dispatching.
`, 'utf8');
}

/** A workspace with the UI switched one way, and nothing else different. */
function makeWorkspace(enabled: boolean, port: number): string {
  const cwd = mkdtempSync(path.join(tmpdir(), `myctx-diff-${enabled ? 'on' : 'off'}-`));
  assert.equal(runCli(['init'], cwd, () => {}), 0, 'init failed in the differential harness');
  const file = path.join(cwd, '.my_context', 'config.json');
  const config = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  // THE ONE DIFFERENCE BETWEEN THE TWO SIDES. Same port on both, so the config
  // files differ in exactly one boolean and a diff of them says so.
  config['ui'] = { enabled, port };
  writeFileSync(file, JSON.stringify(config, null, 2) + '\n', 'utf8');
  seed(cwd);
  return cwd;
}

/**
 * Everything one side did.
 *
 * The operations are ordered, and the order is load bearing in one place: the
 * `Stop` hook runs LAST, because it is the one that carries the upkeep and its
 * audit row has to be written after everything else the side wrote.
 */
interface Side {
  cwd: string;
  runs: Run[];
  audit: AuditRecord[];
  files: Map<string, string>;
}

async function driveSide(cwd: string, home: string): Promise<Side> {
  const session = 'sess-differential';
  const runs: Run[] = [];
  const payload = (fields: Record<string, unknown>): string =>
    JSON.stringify({ session_id: session, cwd, ...fields });

  runs.push(await run('session-start', [HOOK('session-start')], payload({
    hook_event_name: 'SessionStart', source: 'startup',
  }), cwd, home));

  runs.push(await run('pre-tool-use', [HOOK('pre-tool-use')], payload({
    hook_event_name: 'PreToolUse', tool_name: 'Read',
    tool_input: { file_path: path.join(cwd, 'src', 'handlers.ts') },
  }), cwd, home));

  runs.push(await run('subagent-start', [HOOK('subagent-start')], payload({
    hook_event_name: 'SubagentStart', agent_id: 'agent-differential',
  }), cwd, home));

  runs.push(await run('cli-show', [CLI, 'show', 'CONST-pool'], '', cwd, home));
  runs.push(await run('cli-list', [CLI, 'list'], '', cwd, home));
  // A real MUTATION, not only reads: the UI must not change what a write does
  // either. `--summary` is required (`mycontext add` refuses a capture without
  // one), and the created item is byte-identical across two runs — `create`
  // stamps no `last_change` and `valid_from` is a date — so this contributes a
  // `mutation` audit row and a new item file to the comparison without
  // contributing a single normalisation.
  runs.push(await run(
    'cli-add',
    [CLI, 'add', 'task', 'A task the differential wrote', '--body', 'Body.',
      '--summary', 'A throwaway item a differential harness created.', '--yes'],
    '', cwd, home,
  ));

  // LAST, and see `Side`: this is the operation the UI's presence actually
  // reaches. With the UI on it probes, finds the harness server, asks it
  // whether its code is stale, and writes its clocks; with the UI off it
  // returns `{ did: 'nothing', why: 'disabled' }` before reading a byte.
  runs.push(await run('stop', [HOOK('stop')], payload({
    hook_event_name: 'Stop', stop_hook_active: false,
  }), cwd, home));

  const root = path.join(cwd, '.my_context');
  return { cwd, runs, audit: readAudit(root), files: snapshotCorpus(root) };
}

/**
 * Every file under `.my_context/`, by repo-relative path, with its contents.
 *
 * The whole tree rather than `items/` alone: a file the UI caused to appear
 * anywhere in the corpus is the thing being looked for, and a walk that only
 * visited the directory the items live in could not see one.
 */
function snapshotCorpus(root: string): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir).sort()) {
      const full = path.join(dir, entry);
      const rel = prefix === '' ? entry : `${prefix}/${entry}`;
      if (statSync(full).isDirectory()) walk(full, rel);
      else files.set(rel, readFileSync(full, 'utf8'));
    }
  };
  walk(root, '');
  return files;
}

/**
 * The two substitutions, and there are only two — see the header.
 *
 * Both separator spellings of the workspace path, because a hook writes
 * `C:\...\myctx-diff-on-ab12` into a note and JSON output carries the same path
 * escaped; and ISO-8601 instants, because the two sides ran at two moments.
 */
function stable(text: string, cwd: string): string {
  // THREE spellings of one path, and the third is the one that was missing on
  // the first run of this file: `SubagentStart`'s envelope is JSON, so the
  // Windows separators inside it arrive DOUBLED. Replacing only the raw and
  // forward-slash forms left `C:\Users\...` in both sides' envelopes and the
  // comparison failed on the harness rather than on the product.
  const escaped = JSON.stringify(cwd).slice(1, -1);
  const withSlashes = cwd.split(path.sep).join('/');
  return text
    .split(escaped).join('<WS>')
    .split(cwd).join('<WS>')
    .split(withSlashes).join('<WS>')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, '<TIME>');
}

/**
 * An audit record with the one field that cannot survive `stable` removed.
 *
 * `at` is the instant, and only `at`. **`checksumAfter` is deliberately KEPT**,
 * because it turned out to be comparable: `create` stamps no `last_change` and
 * `valid_from` is a date, so the item a side writes is byte-identical to the
 * one the other side writes and so is the hash of it. Dropping a field that
 * compares equal would be discarding an assertion for tidiness — and this is
 * the field that would catch a UI-caused change to written content that somehow
 * left the file comparison below green.
 */
function comparable(record: AuditRecord, cwd: string): unknown {
  const { at: _at, ...rest } = record;
  return JSON.parse(stable(JSON.stringify(rest), cwd)) as unknown;
}

const HOME_ON = mkdtempSync(path.join(tmpdir(), 'myctx-diff-home-on-'));
const HOME_OFF = mkdtempSync(path.join(tmpdir(), 'myctx-diff-home-off-'));

let harness: UiHarness | null = null;
let on: Side;
let off: Side;

/**
 * One setup for the whole file: a server, two workspaces, fourteen child
 * processes. Every assertion below reads the same two `Side` values, so each
 * one can fail on its own line without the cost being paid again.
 */
before(async () => {
  // The UI-on workspace has to exist before the server does — the server
  // resolves its corpus from its working directory — so it is created with a
  // placeholder port and rewritten once the port is known. The placeholder is a
  // legal port rather than `0`: `config.ts` refuses `0` by name, because "any
  // free port" is a URL nobody can bookmark. Nothing binds it — `startUiChild`
  // passes `--port 0` on the command line, which is where an ephemeral port is
  // legal, and `startOnSafePort` picks the one the harness keeps.
  const onCwd = makeWorkspace(true, 8765);
  harness = await startUiChild(onCwd, [], { ...process.env, HOME: HOME_ON, USERPROFILE: HOME_ON });
  const configFile = path.join(onCwd, '.my_context', 'config.json');
  const config = JSON.parse(readFileSync(configFile, 'utf8')) as Record<string, unknown>;
  config['ui'] = { enabled: true, port: harness.port };
  writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n', 'utf8');

  // A PRECONDITION, not an assertion about the product: if the liveness record
  // did not name this harness's server the upkeep would take the
  // `port-already-serving` branch instead of the freshness exchange, and the
  // UI-on side would quietly stop exercising the path this file exists for.
  // Failing here says "the harness is wrong"; failing below says "the product
  // is".
  const record = readUiServerRecord();
  assert.equal(
    record?.port, harness.port,
    'the liveness record does not name the harness server, so the upkeep would not probe it',
  );

  const offCwd = makeWorkspace(false, harness.port);
  on = await driveSide(onCwd, HOME_ON);
  off = await driveSide(offCwd, HOME_OFF);
}, { timeout: 10 * 60_000 });

after(async () => {
  if (harness !== null) await harness.stop();
  for (const dir of [on?.cwd, off?.cwd, HOME_ON, HOME_OFF]) {
    if (dir !== undefined) removeTree(dir);
  }
});

// ---------------------------------------------------------------------------
// 1. THE INJECTION TEXT.
// ---------------------------------------------------------------------------

/**
 * The guard against the vacuous green. Two empty strings are equal, and an
 * injection that delivered nothing would satisfy every comparison in this file
 * while proving nothing at all.
 */
test('the injection text is non-empty and carries the pinned item on both sides', () => {
  for (const side of [on, off]) {
    const injection = side.runs.find((r) => r.label === 'session-start');
    assert.ok(injection !== undefined);
    assert.match(injection.stdout, /CONST-pool/, `${side.cwd}: the pinned item was not delivered`);
    assert.ok(injection.stdout.length > 500, `${side.cwd}: injection was ${injection.stdout.length} bytes`);
  }
});

/**
 * **R14's third clause, as a fact.** Every door the product injects through —
 * `SessionStart`'s plain text, `PreToolUse`'s JIT envelope, `SubagentStart`'s
 * JSON envelope — byte for byte, with the UI serving and with it off.
 */
test('the injection text is identical with the UI on and off', () => {
  for (const label of ['session-start', 'pre-tool-use', 'subagent-start']) {
    const a = on.runs.find((r) => r.label === label);
    const b = off.runs.find((r) => r.label === label);
    assert.equal(
      stable(a!.stdout, on.cwd), stable(b!.stdout, off.cwd),
      `${label}: the UI's presence changed what was injected`,
    );
  }
});

/**
 * stdout is what the model reads; stderr is what the USER reads, and a UI that
 * added a line of its own to a hook's stderr would be changing the product's
 * output on every turn. Compared for the same reason and in the same breath.
 */
test('every operation writes the same thing on both channels with the UI on and off', () => {
  for (const [a, b] of zip(on.runs, off.runs)) {
    assert.equal(stable(a.stdout, on.cwd), stable(b.stdout, off.cwd), `${a.label}: stdout differs`);
    assert.equal(stable(a.stderr, on.cwd), stable(b.stderr, off.cwd), `${a.label}: stderr differs`);
  }
});

// ---------------------------------------------------------------------------
// 2. THE EXIT CODES.
// ---------------------------------------------------------------------------

test('every operation exits with the same code with the UI on and off', () => {
  for (const [a, b] of zip(on.runs, off.runs)) {
    assert.equal(a.code, b.code, `${a.label}: exit code ${a.code} with the UI on, ${b.code} with it off`);
  }
});

// ---------------------------------------------------------------------------
// 3. THE AUDIT RECORDS.
// ---------------------------------------------------------------------------

/**
 * **Everything the PRODUCT recorded, in order, field for field.** The `access`
 * kind is held out and asserted separately below, as an equality rather than as
 * an exemption — see the header.
 */
test('the product audit records are identical with the UI on and off', () => {
  const productRows = (side: Side): unknown[] =>
    side.audit.filter((r) => r.kind !== 'access').map((r) => comparable(r, side.cwd));
  const a = productRows(on);
  const b = productRows(off);
  // The guard against the vacuous green again: two empty logs are equal.
  assert.ok(a.length >= 4, `only ${a.length} product audit row(s) were written`);
  assert.deepEqual(a, b, "the UI's presence changed what the product recorded");
});

/**
 * **The UI's whole footprint on the log, as an EQUALITY.**
 *
 * `nonce-minted` is the row `POST /api/nonce` writes when the upkeep's
 * freshness exchange asks the running server whether its code is stale
 * (`src/core/ui-server-probe.ts` · `askServerFreshness`,
 * `src/ui/security.ts` · `recordNonceMint`). It is the UI recording its own
 * gate, which is what `ACCESS_OPS` is for, and it is the ONLY row the UI's
 * presence adds. Written as an exact list in both directions so that a second
 * kind of row fails here, and so does this one disappearing.
 */
test("the UI's only mark on the audit log is the one access row it minted", () => {
  // A PRECONDITION, and it is here so that machine contention cannot be read as
  // a product finding. `probeUiServer` caps its connect at 250 ms; on a box
  // running three lanes that cap can be reached against a server that is
  // perfectly alive, and the upkeep then takes the `port-already-serving`
  // branch, which asks the server nothing and mints no credential. The row
  // below would be absent for a reason that has nothing to do with the UI's
  // effect on the product, and the failure would accuse the wrong thing.
  const upkeep = JSON.parse(on.files.get('state/ui-server-upkeep.json') ?? '{}') as
    Record<string, unknown>;
  assert.equal(
    upkeep['lastOutcome'], 'alive',
    'the upkeep did not find the harness server alive, so the UI-on side never ran the '
    + 'freshness exchange — this is the harness losing a race on a loaded machine, not the '
    + 'product behaving differently',
  );
  assert.deepEqual(
    on.audit.filter((r) => r.kind === 'access').map((r) => r.op), ['nonce-minted'],
    "the UI on side's access rows are not exactly the one credential the upkeep asked for",
  );
  assert.deepEqual(
    off.audit.filter((r) => r.kind === 'access').map((r) => r.op), [],
    'the UI off side wrote an access row, so something reached the gate with the UI disabled',
  );
});

// ---------------------------------------------------------------------------
// 4. THE CORPUS FILES.
// ---------------------------------------------------------------------------

/**
 * **`state/ui-server-upkeep.json` is the one file the UI's presence adds**, and
 * it is the upkeep's own clocks (`src/core/ui-server-upkeep.ts` · `STATE_FILE`).
 * Named here as an exact difference for the same reason the access row is: a
 * second file, or this one appearing with the UI off, fails.
 */
test('the UI adds exactly one file to the corpus and changes no other', () => {
  const onlyOn = [...on.files.keys()].filter((f) => !off.files.has(f));
  const onlyOff = [...off.files.keys()].filter((f) => !on.files.has(f));
  assert.deepEqual(onlyOn, ['state/ui-server-upkeep.json'], 'the UI left more than its own clocks');
  assert.deepEqual(onlyOff, [], 'the UI off side wrote a file the UI on side did not');
});

/**
 * **The experiment's independent variable, asserted rather than assumed.**
 *
 * The most dangerous way for a differential test to be green is for the two
 * sides to have been the same side all along — a config that failed to write, a
 * key spelled wrong, a validator that dropped it. So the two configs are
 * compared to each other and required to differ in `ui.enabled` and in NOTHING
 * else: same port, same profile, same budgets.
 */
test('the two sides differ in exactly one setting, and it is ui.enabled', () => {
  const config = (side: Side): Record<string, unknown> =>
    JSON.parse(side.files.get('config.json')!) as Record<string, unknown>;
  const a = config(on);
  const b = config(off);
  assert.deepEqual(a['ui'], { enabled: true, port: harness!.port });
  assert.deepEqual(b['ui'], { enabled: false, port: harness!.port });
  delete a['ui'];
  delete b['ui'];
  assert.deepEqual(a, b, 'the two sides differ somewhere other than the UI switch');
});

test('every file the two sides share is byte-identical after the same work', () => {
  const shared = [...on.files.keys()].filter((f) => off.files.has(f));
  assert.ok(shared.length >= 4, `only ${shared.length} shared corpus file(s)`);
  for (const file of shared) {
    // `.index.db` is SQLite's binary projection of the Markdown and is rebuilt
    // from it; comparing two binary files written at two moments compares page
    // headers, not knowledge. The items it is a projection OF are compared
    // above, which is the stronger instrument.
    if (file.endsWith('.db') || file.endsWith('.db-wal') || file.endsWith('.db-shm')) continue;
    // The audit log is compared RECORD BY RECORD two tests up, where the one
    // `access` row the UI's presence adds is held out and pinned as its own
    // equality. Comparing the same bytes again here would restate that known
    // difference as an unexplained one, and the record comparison is the
    // stronger of the two — it reads fields, not lines.
    if (file === path.join('.audit', 'audit.jsonl').split(path.sep).join('/')) continue;
    // `config.json` is the INDEPENDENT VARIABLE. It is the one file that must
    // differ, and the test below asserts it differs in exactly one boolean —
    // which is also the guard against the worst version of this whole file
    // going green: two sides that were never actually set differently.
    if (file === 'config.json') continue;
    assert.equal(
      stable(on.files.get(file)!, on.cwd), stable(off.files.get(file)!, off.cwd),
      `${file} differs between the UI on and UI off runs`,
    );
  }
});

/** Pairs the two sides' runs, failing loudly if they did not run the same work. */
function zip(a: Run[], b: Run[]): [Run, Run][] {
  assert.equal(a.length, b.length, 'the two sides did not run the same number of operations');
  return a.map((run, index) => {
    assert.equal(run.label, b[index]!.label, `operation ${index} differs between the sides`);
    return [run, b[index]!] as [Run, Run];
  });
}
