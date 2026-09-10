// @basis TASK-the-store-is-delivered-at-every-door-an-agent-starts-through, INV-hooks-fail-open
/**
 * **Every door records a delivery, and a later hook says when none did.**
 *
 * D41 spec §8.2, `plan:store seq:2` Task 7. Read that section before the
 * assertions, because it decides what they are allowed to claim:
 *
 * > *Nothing can inspect a model's context window. **What is verifiable is
 * > that we injected at every door and none was missed.***
 *
 * So nothing below asserts that a rule is in a context window. Each door test
 * asserts two separable facts — the text was composed, and a row was written —
 * and the assertion test asserts that a key with no row is REPORTED.
 *
 * ── WHY THERE ARE TWO ASSERTIONS PER DOOR, IN TWO PLACES ───────────────────
 *
 * `plan:store seq:1` learned this the expensive way and wrote it down: a
 * removal proof that reddens one assertion looked like a proof that covered
 * the file. So each door is proved twice, and the two would fail to different
 * removals:
 *
 *   1. **In-process**, through the exported builder, that the BLOCK is
 *      composed and appended. Removing the append breaks this and not the row.
 *   2. **Out-of-process**, by spawning the real hook binary, that a ROW
 *      reaches `state/rules-delivered.jsonl`. Removing the door's call from
 *      the binary breaks this and not the composition.
 *
 * ── AND WHY THE STORE IS A FIXTURE RATHER THAN THE SHIPPED ONE ─────────────
 *
 * The shipped store's only entry is `developer` tier, so in any workspace but
 * this repository the applicable set is EMPTY and correctly renders nothing —
 * which would make "the door delivered text" untestable against a sandbox.
 * `MYCONTEXT_RULES_DIR` (`rules/deliver.ts` · `RULES_DIR_ENV`) points the
 * doors at a fixture holding one `product` entry, exactly as
 * `MYCONTEXT_CORPUS_DIR` already lets a caller name a corpus.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { storeAppendix } from '../../src/hooks/session-start.ts';
import { buildSubagentStartOutput } from '../../src/hooks/subagent-start.ts';
import { runPreToolUse } from '../../src/hooks/pre-tool-use.ts';
import {
  DELIVERED_DIR, DELIVERED_FILE, deliveries, recordDelivery, wasDelivered, type DeliveryRecord,
} from '../../src/rules/delivered.ts';
import { RULES_DIR_ENV } from '../../src/rules/deliver.ts';
import { removeTree } from '../helpers/tmp.ts';

/** The one entry every door in this file is expected to carry. */
const MARKER = 'a body stops at the first ## heading';

const PRODUCT_ENTRY = [
  '---',
  'id: a-body-stops-at-the-first-heading',
  'kind: fact',
  'tier: product',
  `title: ${MARKER}`,
  'truth: everything from the first `## ` heading onwards is dropped when a body is stored',
  'breaks: the tail of a body is lost with no error, and the write reports success',
  'example: the 2026-09-07 item whose Observations block vanished on save',
  'check: "preventive:the write path refuses a body carrying a ## heading"',
  '---',
  '',
  'True for anyone who installs the tool.',
  '',
].join('\n');

/** A store with nothing in it, for a case that is about the record and not the text. */
function storeFixtureEmpty(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-store-empty-'));
}

function storeFixture(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-store-'));
  writeFileSync(path.join(dir, 'fact.md'), PRODUCT_ENTRY, 'utf8');
  return dir;
}

/** An initialized workspace with one corpus item, so no surface answers emptily. */
function workspace(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-door-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0, 'the sandbox workspace did not initialize');
  return cwd;
}

function rows(cwd: string): DeliveryRecord[] {
  const file = path.join(cwd, '.my_context', DELIVERED_DIR, DELIVERED_FILE);
  try {
    return readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() !== '')
      .map((l) => JSON.parse(l) as DeliveryRecord);
  } catch {
    return [];
  }
}

const HOOKS = path.dirname(fileURLToPath(new URL('../../src/hooks/x', import.meta.url)));

function spawnHook(name: string, payload: unknown, cwd: string, storeDir: string): {
  status: number | null; stdout: string; stderr: string;
} {
  const run = spawnSync(
    process.execPath,
    ['--disable-warning=ExperimentalWarning', path.join(HOOKS, name)],
    {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      env: { ...process.env, [RULES_DIR_ENV]: storeDir },
    },
  );
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

/**
 * Each door runs once per case with the fixture named through the
 * environment, and the variable is restored afterwards — a test that leaks it
 * would point every later test in this process at a directory that has been
 * deleted.
 */
function withStore<T>(dir: string, fn: () => T): T {
  const before = process.env[RULES_DIR_ENV];
  process.env[RULES_DIR_ENV] = dir;
  try { return fn(); } finally {
    if (before === undefined) delete process.env[RULES_DIR_ENV];
    else process.env[RULES_DIR_ENV] = before;
  }
}

/* ══ 1. THE SESSION-START DOOR ═════════════════════════════════════════════ */

test('door: session start composes the block and records the delivery', () => {
  const cwd = workspace();
  const store = storeFixture();
  try {
    const text = storeAppendix(cwd, { sessionId: 's-new', source: 'startup', storeDir: store });
    assert.ok(text.includes(MARKER), 'the session-start door delivered no constant');

    const recorded = rows(cwd).filter((r) => r.kind === 'delivered' && r.door === 'session-start');
    assert.equal(recorded.length, 1, 'the session-start door wrote no delivery row');
    assert.equal(recorded[0].key, 's-new');
    assert.equal(recorded[0].entries, 1);
    assert.ok(wasDelivered(path.join(cwd, '.my_context'), 's-new'));
  } finally { removeTree(cwd); removeTree(store); }
});

/**
 * **The measured reason this door is recorded apart from the one above.** 23
 * `compact-restore` against 54 `session-start` in 36,024 records: a design
 * that cannot tell two doors apart cannot say which of them was missed.
 */
test('door: compact-restore is a door of its own, and is recorded as one', () => {
  const cwd = workspace();
  const store = storeFixture();
  try {
    const text = storeAppendix(cwd, { sessionId: 's-c', source: 'compact', storeDir: store });
    assert.ok(text.includes(MARKER), 'the compact-restore door delivered no constant');
    assert.deepEqual(
      rows(cwd).filter((r) => r.kind === 'delivered').map((r) => r.door), ['compact-restore'],
      'a compaction restore was recorded under the wrong door, so a session-start that never ' +
      'ran would look as though it had',
    );
  } finally { removeTree(cwd); removeTree(store); }
});

test('door: a RESUMED session is delivered to, unlike the handover', () => {
  const cwd = workspace();
  const store = storeFixture();
  try {
    const text = storeAppendix(cwd, { sessionId: 's-r', source: 'resume', storeDir: store });
    assert.ok(
      text.includes(MARKER),
      'a resumed session got no constants. It is the source most easily argued away — it keeps ' +
      'the window it had — and nothing can inspect that window to find out whether the ' +
      'constants are still in it (spec §8.2).',
    );
  } finally { removeTree(cwd); removeTree(store); }
});

test('door: the session-start BINARY writes the row and puts the block on stdout', () => {
  const cwd = workspace();
  const store = storeFixture();
  try {
    const run = spawnHook(
      'session-start.ts', { session_id: 'bin-1', source: 'startup', cwd }, cwd, store,
    );
    assert.equal(run.status, 0, 'INV-hooks-fail-open: a session start may never fail');
    assert.ok(
      run.stdout.includes(MARKER),
      `the hook binary put no constant on stdout. stderr was: ${run.stderr}`,
    );
    const recorded = rows(cwd).filter((r) => r.key === 'bin-1');
    assert.equal(recorded.length, 1, 'the binary wrote no delivery row');
    assert.equal(recorded[0].door, 'session-start');
  } finally { removeTree(cwd); removeTree(store); }
});

/* ══ 2. THE DOOR THAT CARRIES THE WEIGHT ══════════════════════════════════ */

/**
 * 1,082 `subagent-start` against 54 `session-start` in 36,024 records. A
 * design guarding only session start guards the rarest event, and this is the
 * assertion that stops that being the shape of this one.
 */
test('door: subagent start composes the block and records under the AGENT key', () => {
  const cwd = workspace();
  const store = storeFixture();
  try {
    const text = withStore(store, () => buildSubagentStartOutput(
      { session_id: 'p1', agent_id: 'a1', cwd }, cwd,
    ));
    assert.ok(text.includes(MARKER), 'the subagent door delivered no constant');

    const recorded = rows(cwd).filter((r) => r.kind === 'delivered');
    assert.equal(recorded.length, 1, 'the subagent door wrote no delivery row');
    assert.equal(recorded[0].door, 'subagent-start');
    assert.equal(
      recorded[0].key, 'p1::a1',
      'the subagent delivery was filed under the PARENT\'s key. A subagent shares its parent\'s ' +
      'session id, so a row under the bare id would tell the assertion that the parent had been ' +
      'delivered to when only a child had.',
    );
    assert.equal(
      wasDelivered(path.join(cwd, '.my_context'), 'p1'), false,
      'the parent now looks delivered-to because its child was',
    );
  } finally { removeTree(cwd); removeTree(store); }
});

test('door: the subagent-start BINARY writes the row and puts the block in its envelope', () => {
  const cwd = workspace();
  const store = storeFixture();
  try {
    const run = spawnHook(
      'subagent-start.ts', { session_id: 'bin-2', agent_id: 'ag-2', cwd }, cwd, store,
    );
    assert.equal(run.status, 0, 'INV-hooks-fail-open: a dispatch may never be failed by this hook');
    assert.ok(
      run.stdout.includes(MARKER),
      `the subagent hook binary carried no constant. stderr was: ${run.stderr}`,
    );
    const envelope = JSON.parse(run.stdout.trim()) as {
      hookSpecificOutput?: { additionalContext?: string };
    };
    assert.ok(
      envelope.hookSpecificOutput?.additionalContext?.includes(MARKER),
      'the constants are on stdout but not inside the `additionalContext` the platform reads',
    );
    assert.deepEqual(rows(cwd).map((r) => r.key), ['bin-2::ag-2']);
  } finally { removeTree(cwd); removeTree(store); }
});

/* ══ 3. THE RECORD IS ABOUT THE DOOR, NOT ABOUT THE PAYLOAD ═══════════════ */

test('a delivery that carried NOTHING still writes a row', () => {
  const cwd = workspace();
  const empty = mkdtempSync(path.join(tmpdir(), 'myctx-empty-'));
  try {
    const text = storeAppendix(cwd, { sessionId: 's-e', source: 'startup', storeDir: empty });
    assert.equal(text, '', 'the empty store rendered something, so this case is not the empty one');
    const recorded = rows(cwd).filter((r) => r.kind === 'delivered');
    assert.equal(
      recorded.length, 1,
      'an empty delivery wrote no row. A store with nothing applicable and a hook killed ' +
      'mid-render would then leave the IDENTICAL evidence — none — and the assertion would ' +
      'report a missed door for a door that ran perfectly.',
    );
    assert.equal(recorded[0].entries, 0);
  } finally { removeTree(cwd); removeTree(empty); }
});

/* ══ 4. THE ASSERTION: A MISSED DOOR IS REPORTED ══════════════════════════ */

/**
 * **The assertion has two products, and neither of them is the model's channel.**
 *
 * A first draft folded the sentence into `additionalContext` and reddened five
 * tests whose subject is a property worth more than the disclosure:
 * `runPreToolUse` says nothing about a file it has no opinion on. The person,
 * not the model, is the one who can fix a door that did not run — the fix is a
 * hook registration or a permission — so the sentence goes to stderr, which
 * Claude Code surfaces to them. The durable half is the `missed` row, which is
 * what spec §8.2 asks for when it says *"a count instead of a promise"*.
 */
test('the assertion reports a key that no door delivered to, on the USER\'s channel', () => {
  const cwd = workspace();
  const store = storeFixture();
  try {
    const run = spawnHook(
      'pre-tool-use.ts',
      { session_id: 'never', cwd, tool_name: 'Read', tool_input: { file_path: 'a.md' } },
      cwd, store,
    );
    assert.equal(run.status, 0, 'INV-hooks-fail-open: a tool call may never be failed by this hook');
    assert.match(
      run.stderr, /no record of the product rule store being delivered/,
      'a session with no delivery row reached a tool call and nothing said so. That is exactly ' +
      'the state "pinned therefore delivered" is already in — 71 measured deliveries of a ' +
      'pinned rule and not one at session start — and this mechanism exists so the store does ' +
      'not join it.',
    );
    assert.match(run.stderr, /never/, 'the report does not name the key, so the row cannot be found');
    assert.ok(
      !run.stdout.includes('no record of the product rule store'),
      'the assertion reached the MODEL\'s channel. `runPreToolUse` says nothing about a file it ' +
      'has no opinion on, and a plugin that speaks on a tool call it was not asked about is its ' +
      'own defect.',
    );
    assert.deepEqual(
      deliveries(path.join(cwd, '.my_context'), 'never').map((r) => r.kind), ['missed'],
      'the durable half — the row spec §8.2 asks to be counted — was not written',
    );
  } finally { removeTree(cwd); removeTree(store); }
});

test('the assertion is SILENT once a door has delivered', () => {
  const cwd = workspace();
  const store = storeFixture();
  try {
    storeAppendix(cwd, { sessionId: 'quiet', source: 'startup', storeDir: store });
    runPreToolUse(
      JSON.stringify({ session_id: 'quiet', cwd, tool_name: 'Read', tool_input: { file_path: 'a.md' } }),
      cwd,
    );
    assert.deepEqual(
      deliveries(path.join(cwd, '.my_context'), 'quiet').map((r) => r.kind), ['delivered'],
      'the assertion fired against a session that WAS delivered to. A check that reports a ' +
      'failure on a healthy run is a check people turn off.',
    );
  } finally { removeTree(cwd); removeTree(store); }
});

test('the assertion speaks ONCE per key, and the count it leaves is one', () => {
  const cwd = workspace();
  try {
    const payload = JSON.stringify(
      { session_id: 'once', cwd, tool_name: 'Read', tool_input: { file_path: 'a.md' } },
    );
    runPreToolUse(payload, cwd);
    runPreToolUse(payload, cwd);
    assert.equal(
      deliveries(path.join(cwd, '.my_context'), 'once').filter((r) => r.kind === 'missed').length, 1,
      'a `missed` count that grew per tool call would measure tool calls rather than doors — and ' +
      'the row IS the latch, so a second row also means a second stderr line on every tool call, ' +
      'which is a line nobody reads',
    );
  } finally { removeTree(cwd); }
});

test('a subagent that was never delivered to is caught at its first tool call', () => {
  const cwd = workspace();
  try {
    runPreToolUse(
      JSON.stringify({
        session_id: 'par', agent_id: 'child', cwd,
        tool_name: 'Read', tool_input: { file_path: 'a.md' },
      }),
      cwd,
    );
    assert.deepEqual(
      deliveries(path.join(cwd, '.my_context'), 'par::child').map((r) => r.kind), ['missed'],
      'the subagent key was not the key asserted against. 1,082 subagent starts against 54 ' +
      'session starts is the whole reason this is the key that matters.',
    );
    assert.deepEqual(
      deliveries(path.join(cwd, '.my_context'), 'par'), [],
      'the PARENT was reported missed because its child was',
    );
  } finally { removeTree(cwd); }
});

test('a subagent that WAS delivered to does not report its parent as missed, or the reverse', () => {
  const cwd = workspace();
  const store = storeFixture();
  const root = path.join(cwd, '.my_context');
  try {
    withStore(store, () => buildSubagentStartOutput({ session_id: 'P', agent_id: 'C', cwd }, cwd));
    runPreToolUse(
      JSON.stringify({
        session_id: 'P', agent_id: 'C', cwd, tool_name: 'Read', tool_input: { file_path: 'a.md' },
      }),
      cwd,
    );
    assert.deepEqual(
      deliveries(root, 'P::C').map((r) => r.kind), ['delivered'],
      'the delivered child was reported as missed',
    );
    runPreToolUse(
      JSON.stringify({ session_id: 'P', cwd, tool_name: 'Read', tool_input: { file_path: 'a.md' } }),
      cwd,
    );
    assert.deepEqual(
      deliveries(root, 'P').map((r) => r.kind), ['missed'],
      'the parent was treated as delivered-to because its child was — the exact key collision ' +
      '`dedupeKey` exists to prevent, arriving through the record instead of through the ledger',
    );
    assert.equal(wasDelivered(root, 'P::C'), true);
    assert.equal(wasDelivered(root, 'P'), false);
  } finally { removeTree(cwd); removeTree(store); }
});

/* ══ 5. THE RECORD ITSELF ═════════════════════════════════════════════════ */

test('an unreadable record answers "not delivered" rather than throwing', () => {
  const cwd = workspace();
  const root = path.join(cwd, '.my_context');
  try {
    mkdirSync(path.join(root, DELIVERED_DIR), { recursive: true });
    writeFileSync(path.join(root, DELIVERED_DIR, DELIVERED_FILE), 'not json at all\n{"key":\n', 'utf8');
    assert.equal(
      wasDelivered(root, 'anything'), false,
      'reporting a delivery nobody can find is the wrong reading of a record that cannot be read',
    );
    assert.deepEqual(deliveries(root, 'anything'), []);
  } finally { removeTree(cwd); }
});

test('one damaged line does not cost the rows around it', () => {
  const cwd = workspace();
  const root = path.join(cwd, '.my_context');
  try {
    recordDelivery(root, { kind: 'delivered', key: 'k', door: 'session-start', entries: 1 });
    writeFileSync(path.join(root, DELIVERED_DIR, DELIVERED_FILE), `{ not json\n${
      readFileSync(path.join(root, DELIVERED_DIR, DELIVERED_FILE), 'utf8')}`, 'utf8');
    assert.equal(wasDelivered(root, 'k'), true, 'a damaged first line cost every row after it');
  } finally { removeTree(cwd); }
});

test('a record written into a root that does not exist fails without throwing', () => {
  assert.equal(
    recordDelivery(path.join(tmpdir(), 'myctx-nope', 'nowhere', 'deeper'), {
      kind: 'delivered', key: 'k', door: 'session-start', entries: 0,
    }),
    true,
    'the directory is created on demand — a first delivery must not be lost to a missing state/',
  );
  removeTree(path.join(tmpdir(), 'myctx-nope'));
});

/* ══ 6. THE SECOND ASSERTION SITE, WHICH COVERS THE KEY THE FIRST CANNOT ══ */

/**
 * **`PreCompact` is in spec §8.1's list of doors and measurement says it is
 * not one** — see `hooks/pre-compact.ts` for the platform code that settles
 * it. What it IS good for is the other half of §8.2, and it is the only hook
 * that catches a session whose every tool call was a `Bash`: `PreToolUse` is
 * registered under `Read|Edit|MultiEdit|Write|NotebookEdit|Agent` and never
 * fires for one.
 */
test('the assertion also runs at PreCompact, which PreToolUse\'s matcher cannot reach', () => {
  const cwd = workspace();
  const store = storeFixture();
  try {
    const run = spawnHook(
      'pre-compact.ts', { session_id: 'bash-only', cwd, trigger: 'auto' }, cwd, store,
    );
    assert.equal(run.status, 0, 'INV-hooks-fail-open: a compaction may never be failed by this hook');
    assert.equal(
      run.stderr, '',
      'PreCompact wrote to stderr. This file already ruled on that channel: a compaction is the ' +
      'one moment where an unsolicited paragraph of ours competes with Claude Code\'s own ' +
      'compaction notice for a user who did not ask for either.',
    );
    assert.deepEqual(
      deliveries(path.join(cwd, '.my_context'), 'bash-only').map((r) => r.kind), ['missed'],
      'a session reached its compaction with no delivery row and nothing recorded it. This is ' +
      'the one hook that sees a session whose every tool call was a Bash — PreToolUse is ' +
      'registered under Read|Edit|MultiEdit|Write|NotebookEdit|Agent and never fires for one.',
    );
    assert.match(
      readFileSync(path.join(cwd, '.my_context', '.audit', 'audit.jsonl'), 'utf8'),
      /PRODUCT RULE STORE NOT DELIVERED/,
      'the compaction row does not carry the verdict, so nothing that reads the log can see it',
    );
  } finally { removeTree(cwd); removeTree(store); }
});

/* == 7. A MISS WITH NOTHING TO MISS IS RECORDED, NOT REPORTED ============= */

/**
 * The measurement that produced this rule: the first draft reported
 * unconditionally and reddened `pre-tool-use emits the deny envelope for a
 * write into the managed directory`, which asserts that hook's stderr is
 * EMPTY. Every sandbox in this suite is in the state that test is in — the
 * shipped store's only entry is `developer` tier, so nothing applies — and so
 * is every stranger's install until the store carries its first `product`
 * entry.
 */
test('a key with nothing applicable is RECORDED as missed and not REPORTED', () => {
  const cwd = workspace();
  const empty = storeFixtureEmpty();
  try {
    const run = spawnHook(
      'pre-tool-use.ts',
      { session_id: 'nothing-to-miss', cwd, tool_name: 'Read', tool_input: { file_path: 'a.md' } },
      cwd, empty,
    );
    assert.equal(
      run.stderr, '',
      'a sentence saying a reader may be missing the constants — when there were none for them ' +
      'to miss — is a check crying wolf, and this one has to be believed the day it fires',
    );
    const recorded = deliveries(path.join(cwd, '.my_context'), 'nothing-to-miss');
    assert.deepEqual(
      recorded.map((r) => r.kind), ['missed'],
      'the row was withheld along with the sentence. "No door ran for this key" is true ' +
      'whatever the store held, and it is the fact spec §8.2 asks to be countable.',
    );
    assert.match(
      recorded[0].note ?? '', /0 constant/,
      'the row does not say how much the miss cost, so the count cannot be read either way',
    );
  } finally { removeTree(cwd); removeTree(empty); }
});

test('PreCompact emits NOTHING on stdout, because its stdout is not context', () => {
  const cwd = workspace();
  const store = storeFixture();
  try {
    const run = spawnHook('pre-compact.ts', { session_id: 'pc', cwd, trigger: 'auto' }, cwd, store);
    assert.equal(
      run.stdout, '',
      'PreCompact put text on stdout. On build 2.1.261 the consumer returns each hook\'s stdout ' +
      'as `newCustomInstructions`, which REPLACES whatever the user typed after `/compact` and ' +
      'becomes the summariser\'s brief — so a rule store emitted here would both discard a ' +
      'user\'s instruction and hand a summariser a page of product rules. The window after a ' +
      'compaction is opened by SessionStart(source: compact), which IS a door.',
    );
  } finally { removeTree(cwd); removeTree(store); }
});
