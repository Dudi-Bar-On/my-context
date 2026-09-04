import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { auditLogPath, readAudit, type AuditRecord } from '../../src/core/audit.ts';
import { corpusRootLine, resolveCorpus } from '../../src/core/corpus-identity.ts';
import { buildInjection } from '../../src/core/inject.ts';
import { writeSnapshot } from '../../src/core/ledger.ts';
import { SUBAGENT_PREAMBLE } from '../../src/core/render.ts';
import { appendSeen, readSeen, seenFilePath, seenIds } from '../../src/core/seen-file.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { ledgerKey } from '../../src/hooks/io.ts';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * `buildInjection`'s subagent event: the selection a SubagentStart delivers,
 * the record it leaves, and the file it dedupes in.
 *
 * The measured facts these tests are built on, so nobody re-derives them from
 * the assertions: a subagent shares its parent's `session_id` and is told apart
 * only by `agent_id`; `ledgerKey` returns the SAME composite at SubagentStart
 * and at that subagent's first `PreToolUse`, which is what makes a birth entry
 * a dedupe; and `SubagentStart` blocks the dispatch it fires for, which is why
 * the writable store open is skipped here and nowhere else.
 */

const PARENT = 'parent-1';
const AGENT = 'agent-9';
/** Not spelled out by hand anywhere below: the product's own key builder. */
const KEY = ledgerKey({ session_id: PARENT, agent_id: AGENT })!;

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-subagent-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  return cwd;
}

function item(cwd: string, id: string, title: string, always: boolean): void {
  const file = path.join(cwd, '.my_context', 'items', 'constraint', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: constraint
title: ${title}
status: active
severity: hard
always: ${always}
---

# ${title}

Body of ${id}.
`);
}

/** One pinned item and one index-only item: both tiers are non-empty. */
function corpus(cwd: string): void {
  item(cwd, 'CONST-pool', 'Pool capped at 20', true);
  item(cwd, 'CONST-retry', 'Retries capped at 3', false);
}

function root(cwd: string): string {
  return resolveWorkspace(cwd).projectRoot!;
}

function injections(cwd: string): AuditRecord[] {
  return readAudit(root(cwd)).filter((r) => r.kind === 'injection');
}

function subagentInjection(cwd: string, over: Record<string, unknown> = {}): string {
  return buildInjection(cwd, {
    event: 'subagent', sessionId: PARENT, dedupeKey: KEY, agentId: AGENT, ...over,
  });
}

// --- 1. The selection is the session start's, deliberately -------------------

test('a subagent injection delivers the pinned tier in full AND the index', () => {
  const cwd = sandbox();
  corpus(cwd);
  const out = subagentInjection(cwd);
  assert.match(out, /## my_context — these govern this project/u);
  assert.match(out, /Body of CONST-pool\./u);
  assert.match(out, /## my_context index/u);
  assert.match(out, /CONST-retry/u);
  removeTree(cwd);
});

/**
 * The `'tool'` selection is the one wrong answer that still looks like an
 * answer: it admits no pinned tier and returns an empty index, so a subagent
 * would receive nothing at all while every record said it was served.
 *
 * **Equal after the frame, and only after it.** This assertion was byte
 * equality when Task 9 wrote it, and Task 9's §0 row described it as content
 * equivalence that Task 10's prepend could not falsify. It was not, and the
 * prepend did: `SUBAGENT_PREAMBLE` is the fifth divergence on `InjectionEvent`
 * and it lands in this string. The repair keeps every tooth the assertion had
 * — a `'tool'` selection still fails it, in both tiers — while saying the true
 * thing: the SELECTION is a session start's, the DELIVERY is not.
 */
test('the subagent selection is not the tool selection — both tiers are present', () => {
  const cwd = sandbox();
  corpus(cwd);
  const subagent = subagentInjection(cwd);
  const sessionStart = buildInjection(cwd, { event: 'session-start', sessionId: 'other' });
  const frame = `${SUBAGENT_PREAMBLE}\n\n`;
  assert.ok(subagent.startsWith(frame), 'the subagent block does not open with its frame');
  // **The one line the subagent block carries and the session-start block does
  // not**: the absolute corpus root it resolved (`core/corpus-identity.ts`).
  // A subagent's working directory is chosen by whoever dispatched it and is
  // invisible to the person who reads its work, so this is the injection whose
  // corpus can differ in silence — which it did, on 2026-08-27, for every
  // subagent dispatched into this repository's nested corpus. It is removed
  // here rather than tolerated so the REST of the block is still compared byte
  // for byte, which is what this test is about.
  const rootLine = `\n_${corpusRootLine(resolveCorpus(cwd))}_\n`;
  assert.ok(subagent.includes(rootLine),
    `the subagent block must name the corpus it resolved:\n${subagent}`);
  assert.equal(sessionStart.includes(rootLine), false,
    'a session start carries no standing root line — its cwd is the terminal the person is in');
  assert.equal(subagent.slice(frame.length).replace(rootLine, ''), sessionStart);
  assert.notEqual(sessionStart, '');
  removeTree(cwd);
});

/**
 * `'manual'` is tested before `compacting` in `select`'s event, and
 * `'subagent'` is tested there for the same reason: a SubagentStart payload
 * carries no `source`, and a stray one must not turn a subagent's birth
 * injection into a compaction restore against its PARENT's snapshot.
 */
test('a subagent injection ignores a stray source=compact — no restore, and the op still says subagent-start', () => {
  const cwd = sandbox();
  corpus(cwd);
  writeSnapshot(root(cwd), PARENT, ['CONST-retry']);
  const out = subagentInjection(cwd, { source: 'compact' });
  // The restored tier would have delivered CONST-retry IN FULL; the index
  // delivers it as one line. The body sentence is what tells them apart.
  assert.doesNotMatch(out, /Body of CONST-retry\./u);
  assert.match(out, /## my_context index/u);
  const [record] = injections(cwd);
  assert.equal(record?.op, 'subagent-start');
  removeTree(cwd);
});

// --- 2. The record ----------------------------------------------------------

test('the audit record carries op subagent-start, hook SubagentStart, and the PARENT sessionId', () => {
  const cwd = sandbox();
  corpus(cwd);
  subagentInjection(cwd);
  const records = injections(cwd);
  assert.equal(records.length, 1);
  assert.equal(records[0]!.op, 'subagent-start');
  assert.equal(records[0]!.hook, 'SubagentStart');
  // The parent's id, never the composite: `mycontext audit --session <parent>`
  // has to group a subagent's delivery under the session that dispatched it,
  // beside the `delivery=attempted` row the binary writes under the same id.
  assert.equal(records[0]!.sessionId, PARENT);
  assert.notEqual(records[0]!.sessionId, KEY);
  removeTree(cwd);
});

test('its note says delivery=complete with the agent_id', () => {
  const cwd = sandbox();
  corpus(cwd);
  subagentInjection(cwd);
  const [record] = injections(cwd);
  // `delivery=complete agent=<id>` leads the note, as it always has. `CONST-
  // retry` is a `constraint` — a GOVERNING category — and is not `always`, so
  // it reaches this session as a title only: the same governing disclosure
  // every other event carries (`TASK-a-governing-item-degraded-to-an-index-
  // line-looks-delivered`) follows it, counted rather than repeated in full
  // (`inject.ts`).
  assert.equal(
    record?.note,
    `delivery=complete agent=${AGENT}; 1 governing item(s) not delivered in full, 1 title-only`,
  );
  removeTree(cwd);
});

/**
 * §6n.3's whole point. The binary writes `delivery=attempted` BEFORE the work,
 * so "delivered nothing" and "was killed before it could deliver" must not
 * leave the same log — otherwise the evidence the ordering was built for says
 * nothing.
 */
test('a subagent injection that delivered nothing STILL writes its completion record', () => {
  const cwd = sandbox();
  const out = subagentInjection(cwd);
  assert.equal(out, '');
  const records = injections(cwd);
  assert.equal(records.length, 1);
  assert.equal(records[0]!.op, 'subagent-start');
  assert.deepEqual(records[0]!.injected, []);
  assert.equal(records[0]!.spilled, undefined);
  assert.equal(records[0]!.tokens, 0);
  assert.match(records[0]!.note ?? '', /delivery=complete/u);
  removeTree(cwd);
});

test('session-start with an empty selection still writes NO record — the relaxation is subagent-only', () => {
  const cwd = sandbox();
  assert.equal(buildInjection(cwd, { event: 'session-start', sessionId: PARENT }), '');
  assert.equal(buildInjection(cwd, { event: 'manual' }), '');
  assert.deepEqual(injections(cwd), []);
  removeTree(cwd);
});

// --- 3. The dedupe key ------------------------------------------------------

test('the seen entries land under the composite key, not the parent id', () => {
  const cwd = sandbox();
  corpus(cwd);
  subagentInjection(cwd);
  const r = root(cwd);
  assert.deepEqual(seenIds(readSeen(r, KEY)), ['CONST-pool']);
  // The file `pre-tool-use.ts` will look in at this subagent's first tool
  // call is the one just written — same key builder, same path builder.
  assert.ok(existsSync(seenFilePath(r, KEY)));
  assert.equal(existsSync(seenFilePath(r, PARENT)), false);
  removeTree(cwd);
});

/**
 * The regression the composite key exists to prevent, asserted through the two
 * functions that actually consume the parent's file: `pre-compact.ts` builds
 * its restore snapshot from `seenIds(readSeen(root, session_id))`, and
 * `pre-tool-use.ts` dedupes the JIT tier against the same call.
 */
test('the parent session can still be injected after a subagent was', () => {
  const cwd = sandbox();
  corpus(cwd);
  subagentInjection(cwd);
  const r = root(cwd);
  assert.deepEqual(seenIds(readSeen(r, PARENT)), []);

  buildInjection(cwd, { event: 'session-start', sessionId: PARENT });
  assert.deepEqual(seenIds(readSeen(r, PARENT)), ['CONST-pool']);
  removeTree(cwd);
});

/**
 * No fallback to the parent's key, ever. Writing the parent's file from a
 * subagent is a MISS — it suppresses the parent's own JIT tier and puts ids the
 * parent's window never held into the PreCompact snapshot. Writing nothing
 * costs one re-delivery, which is the direction this module accepts. It is not
 * silent either way.
 */
test('a subagent event with no dedupe key writes no seen entry at all, and says so', () => {
  const cwd = sandbox();
  corpus(cwd);
  const out = buildInjection(cwd, { event: 'subagent', sessionId: PARENT, agentId: AGENT });
  assert.match(out, /CONST-pool/u);
  const r = root(cwd);
  assert.equal(existsSync(seenFilePath(r, PARENT)), false);
  assert.deepEqual(seenIds(readSeen(r, PARENT)), []);
  const [record] = injections(cwd);
  assert.match(record?.note ?? '', /no dedupe key; no seen entry written/u);
  removeTree(cwd);
});

/**
 * The other direction. `dedupeKey` is honoured on the subagent event and on no
 * other, so a stray one can never file a parent's own deliveries under a name
 * PreCompact and the compaction restore never look at.
 */
test('a stray dedupeKey on session-start and on manual is ignored', () => {
  const cwd = sandbox();
  corpus(cwd);
  buildInjection(cwd, { event: 'session-start', sessionId: PARENT, dedupeKey: KEY });
  const r = root(cwd);
  assert.deepEqual(seenIds(readSeen(r, PARENT)), ['CONST-pool']);
  assert.equal(existsSync(seenFilePath(r, KEY)), false);

  buildInjection(cwd, { event: 'manual', dedupeKey: KEY });
  assert.equal(existsSync(seenFilePath(r, KEY)), false);
  removeTree(cwd);
});

/**
 * The seen file is READ under the composite key too, not only written under it
 * — the disclosure has to describe the file this event actually consults.
 */
test('an unreadable PARENT seen file is not the subagent event’s problem; its own is', () => {
  const cwd = sandbox();
  corpus(cwd);
  const r = root(cwd);
  mkdirSync(path.dirname(seenFilePath(r, PARENT)), { recursive: true });
  writeFileSync(seenFilePath(r, PARENT), 'this is not jsonl\n');
  subagentInjection(cwd);
  assert.doesNotMatch(injections(cwd)[0]?.note ?? '', /seen file unreadable/u);

  writeFileSync(seenFilePath(r, KEY), 'this is not jsonl either\n');
  subagentInjection(cwd);
  assert.match(injections(cwd)[1]?.note ?? '', /seen file unreadable/u);
  removeTree(cwd);
});

// --- 4. The skipped index refresh -------------------------------------------

/**
 * Design decision 3, asserted by absence of the artefact rather than by a spy:
 * `Store.open` CREATES a missing database, so a deleted `.index.db` that is
 * still missing afterwards is proof the writable open never happened. The
 * second half of the test is the control — the same corpus on a session start
 * puts the file straight back.
 */
test('the subagent path opens no writable store', () => {
  const cwd = sandbox();
  corpus(cwd);
  const dbPath = resolveWorkspace(cwd).dbPath;
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${dbPath}${suffix}`, { force: true });

  const out = subagentInjection(cwd);
  assert.match(out, /CONST-pool/u, 'the injection itself is unaffected — it reads Markdown');
  assert.equal(existsSync(dbPath), false, 'the subagent event refreshed the index');

  buildInjection(cwd, { event: 'session-start', sessionId: 'other' });
  assert.ok(existsSync(dbPath), 'the control: a session start still refreshes');
  removeTree(cwd);
});

/**
 * A skip is not a drop, and the two must stay distinguishable in the log: the
 * `index refresh dropped` note is for a refresh that was ATTEMPTED and failed.
 */
test('the skipped refresh is not reported as a dropped one', () => {
  const cwd = sandbox();
  corpus(cwd);
  subagentInjection(cwd);
  assert.doesNotMatch(injections(cwd)[0]?.note ?? '', /index refresh/u);
  removeTree(cwd);
});

// --- 5. The three existing events, byte for byte ----------------------------

/**
 * The golden. These three strings were captured from this function BEFORE the
 * subagent event existed — with `src/core/inject.ts` stashed back to its
 * pre-task bytes and the same fixture built — so they are a comparison against
 * the old implementation, not against the new one describing itself.
 *
 * `GOLDEN_SESSION_START` carries one more clause than that original capture:
 * `CONST-retry` is a `constraint` — a GOVERNING category — delivered as a
 * title only, so `TASK-a-governing-item-degraded-to-an-index-line-looks-
 * delivered`'s disclosure now names it before the index it explains.
 * `GOLDEN_COMPACT` is untouched: on that path `CONST-retry` is delivered in
 * FULL TEXT by the `restored` tier, so nothing governing goes bodyless there.
 */
const GOLDEN_SESSION_START =
  '## my_context — these govern this project\n\n' +
  '### CONST-pool · constraint · Pool capped at 20\n\n' +
  'Body of CONST-pool.\n\n' +
  '_1 governing item(s) below carry a title only — the body was not delivered: CONST-retry. ' +
  'A title names a rule; it does not tell you what it requires. Read each with ' +
  '`mycontext show <id>` before treating it as satisfied. Delivering every one of them in ' +
  'full this session would cost ~19 estimated tokens._\n\n' +
  '## my_context index\n' +
  '- CONST-retry · constraint · Retries capped at 3\n';

const GOLDEN_COMPACT =
  '## my_context — these govern this project\n\n' +
  '### CONST-pool · constraint · Pool capped at 20\n\n' +
  'Body of CONST-pool.\n\n' +
  '### CONST-retry · constraint · Retries capped at 3\n\n' +
  'Body of CONST-retry.\n';

test('session-start, compact and manual are byte-identical to before', () => {
  const cwd = sandbox();
  corpus(cwd);
  assert.equal(
    buildInjection(cwd, { event: 'session-start', sessionId: PARENT }),
    GOLDEN_SESSION_START,
  );
  assert.equal(buildInjection(cwd, { event: 'manual' }), GOLDEN_SESSION_START);

  const cwd2 = sandbox();
  corpus(cwd2);
  writeSnapshot(root(cwd2), PARENT, ['CONST-retry']);
  assert.equal(
    buildInjection(cwd2, { event: 'session-start', source: 'compact', sessionId: PARENT }),
    GOLDEN_COMPACT,
  );
  removeTree(cwd);
  removeTree(cwd2);
});

test('the three existing events still record their own ops, hooks and keys', () => {
  const cwd = sandbox();
  corpus(cwd);
  buildInjection(cwd, { event: 'session-start', sessionId: PARENT });
  buildInjection(cwd, { event: 'manual' });
  const records = injections(cwd);
  assert.deepEqual(records.map((r) => r.op), ['session-start', 'manual']);
  assert.deepEqual(records.map((r) => r.hook), ['SessionStart', undefined]);
  assert.deepEqual(records.map((r) => r.sessionId), [PARENT, undefined]);
  // Both now carry the governing note — `CONST-retry` reaches each event as a
  // title only, and `inject.ts` records that count regardless of which of
  // these two events it was (`TASK-a-governing-item-degraded-to-an-index-
  // line-looks-delivered`).
  assert.deepEqual(records.map((r) => r.note), [
    '1 governing item(s) not delivered in full, 1 title-only',
    '1 governing item(s) not delivered in full, 1 title-only',
  ]);
  removeTree(cwd);
});

/**
 * The audit log is JSONL beside the database, and `readAudit` refuses a whole
 * segment on an unknown op. A `subagent-start` row that any reader would reject
 * would take every record in the file down with it, so the round trip is
 * asserted rather than assumed.
 */
test('the subagent record survives the audit log round trip', () => {
  const cwd = sandbox();
  corpus(cwd);
  subagentInjection(cwd);
  buildInjection(cwd, { event: 'session-start', sessionId: 'other' });
  const raw = readFileSync(auditLogPath(root(cwd)), 'utf8');
  assert.match(raw, /"op":"subagent-start"/u);
  assert.equal(injections(cwd).length, 2);
  removeTree(cwd);
});

// --- 5. The carry: the parent's session, by id ------------------------------

/**
 * The sixth divergence, and the one that was wrong until 2026-08-22: a
 * SubagentStart payload's `session_id` is the PARENT's, so passing it as "the
 * current session" made `resolveCarry` EXCLUDE the parent and hand back the
 * most recent other session — a stranger's ids, in front of a child's index,
 * under a label naming a session nobody in the dispatch was in. The owner ruled
 * that the parent is exactly the session a child should continue.
 *
 * The fixture is built so the two answers cannot be confused: the stranger's
 * seen file is written LAST, so it is the most recent thing in `state/` and is
 * what the old rule returned.
 */
test('a subagent carries from the session in its payload, not from the most recent other session', () => {
  const cwd = sandbox();
  corpus(cwd);
  appendSeen(root(cwd), PARENT, [{ id: 'CONST-retry', tier: 'jit', at: '2026-08-20T00:00:00Z' }]);
  appendSeen(root(cwd), 'stranger-9', [{ id: 'CONST-pool', tier: 'jit', at: '2026-08-21T00:00:00Z' }]);

  const out = subagentInjection(cwd);
  assert.match(out, /carried from session `parent-1`/u,
    'the child carried from somewhere other than its parent');
  assert.doesNotMatch(out, /carried from session `stranger`/u);
  // Not merely announced: the line itself is marked, which is what the
  // disclosure claims about the list below it.
  assert.match(out, /CONST-retry.* · carried/u);
  removeTree(cwd);
});

/**
 * The parent with nothing on disk. `null` is the answer, and the old rule's
 * fallback — the most recent other session — is exactly what must not happen
 * here: a carry a reader cannot trace to their own dispatch is worse than none.
 */
test('a subagent whose parent has no dedupe state carries nothing, not a stranger', () => {
  const cwd = sandbox();
  corpus(cwd);
  appendSeen(root(cwd), 'stranger-9', [{ id: 'CONST-retry', tier: 'jit', at: '2026-08-21T00:00:00Z' }]);

  const out = subagentInjection(cwd);
  assert.doesNotMatch(out, /carried from session/u);
  removeTree(cwd);
});
