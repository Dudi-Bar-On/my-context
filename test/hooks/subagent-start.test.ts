import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { auditLogPath, readAudit, type AuditRecord } from '../../src/core/audit.ts';
import { buildInjection } from '../../src/core/inject.ts';
import { SUBAGENT_PREAMBLE } from '../../src/core/render.ts';
import { readSeen, seenFilePath, seenIds } from '../../src/core/seen-file.ts';
import { trustedStatus } from '../../src/core/trust.ts';
import { findProjectRoot } from '../../src/core/workspace.ts';
import { ledgerKey, type HookInput } from '../../src/hooks/io.ts';
import { buildJitOutput } from '../../src/hooks/pre-tool-use.ts';
import { buildSubagentStartOutput } from '../../src/hooks/subagent-start.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * The `SubagentStart` binary: the envelope, the frame, the order of its two
 * writes, and the five ways it can fail without failing.
 *
 * The measured facts underneath, so nobody re-derives them from assertions:
 * `SubagentStart` fires with `session_id`, `transcript_path`, `cwd`,
 * `prompt_id`, `agent_id` and `agent_type`, and text returned in its
 * `additionalContext` really does land in the subagent's context; it BLOCKS
 * the dispatch it fires for (a 3,018 ms hook delayed the subagent's first tool
 * call by that much); and a bare imperative injected into a subagent was
 * reported by that subagent to its parent as a possible attack — which is why
 * the frame exists and why its wording is asserted here clause by clause.
 *
 * What `buildInjection`'s side of this event does — the selection, the
 * unconditional completion record, the composite seen key, the skipped index
 * refresh — is `test/core/inject-subagent.test.ts`, and is not repeated.
 */

const PARENT = 'parent-1';
const AGENT = 'agent-9';
/** The product's own key builder, never a composite spelled by hand. */
const KEY = ledgerKey({ session_id: PARENT, agent_id: AGENT })!;

const BINARY = fileURLToPath(new URL('../../src/hooks/subagent-start.ts', import.meta.url));

/** Cold start plus the whole injection import graph, on a loaded machine. */
const EXIT_BUDGET_MS = 60_000;

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-subagent-hook-'));
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
`, 'utf8');
}

/** One pinned item and one index-only item: both tiers are non-empty. */
function corpus(cwd: string): void {
  item(cwd, 'CONST-pool', 'Pool capped at 20', true);
  item(cwd, 'CONST-retry', 'Retries capped at 3', false);
}

/**
 * `findProjectRoot`, not `resolveWorkspace`: one of the modes below is a
 * `config.json` that makes `resolveWorkspace` THROW, and a helper that dies on
 * the fixture cannot read back what the fixture was built to show. It is the
 * same call, for the same reason, that the binary uses to place its attempt
 * record.
 */
function root(cwd: string): string {
  return findProjectRoot(cwd)!;
}

/** The payload shape the platform was measured to send. */
function payload(cwd: string, over: Partial<HookInput> = {}): HookInput {
  return {
    hook_event_name: 'SubagentStart',
    session_id: PARENT,
    agent_id: AGENT,
    agent_type: 'general-purpose',
    prompt_id: 'prompt-1',
    transcript_path: path.join(cwd, 'transcript.jsonl'),
    cwd,
    ...over,
  };
}

function records(cwd: string): AuditRecord[] {
  return readAudit(root(cwd));
}

/** The `additionalContext` the envelope carries, or `null` when there is none. */
function context(output: string): string | null {
  if (output === '') return null;
  const parsed = JSON.parse(output) as {
    hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
  };
  return parsed.hookSpecificOutput?.additionalContext ?? null;
}

// --- 1. The envelope --------------------------------------------------------

/**
 * Measured: the envelope must be stamped `SubagentStart`. Claude Code does not
 * reject one stamped with another event's name — it silently delivers nothing
 * — so a wrong name here is a hook that runs perfectly and reaches no one.
 */
test('the output is a SubagentStart envelope, not a PreToolUse one', () => {
  const cwd = sandbox();
  try {
    corpus(cwd);
    const out = buildSubagentStartOutput(payload(cwd), cwd);
    const parsed = JSON.parse(out) as { hookSpecificOutput: { hookEventName: string } };
    assert.equal(parsed.hookSpecificOutput.hookEventName, 'SubagentStart');
    assert.doesNotMatch(out, /PreToolUse/u);
    assert.match(context(out) ?? '', /CONST-pool/u);
  } finally { removeTree(cwd); }
});

/**
 * An envelope with an empty `additionalContext` is a hook that speaks on every
 * dispatch and says nothing. An empty corpus produces no bytes at all.
 */
test('an empty corpus produces no envelope, not an empty one', () => {
  const cwd = sandbox();
  try {
    assert.equal(buildSubagentStartOutput(payload(cwd), cwd), '');
  } finally { removeTree(cwd); }
});

test('the cwd falls back to the process one only when the payload carries none', () => {
  const cwd = sandbox();
  try {
    corpus(cwd);
    const out = buildSubagentStartOutput(payload(cwd, { cwd: undefined }), cwd);
    assert.match(context(out) ?? '', /CONST-pool/u);
  } finally { removeTree(cwd); }
});

// --- 2. The provenance frame ------------------------------------------------

/**
 * The frame comes FIRST. A frame after the block it frames is read after the
 * text it was supposed to explain, which is the whole failure it exists to
 * prevent.
 */
test('the injected text opens with the provenance frame, before the governing block', () => {
  const cwd = sandbox();
  try {
    corpus(cwd);
    const text = context(buildSubagentStartOutput(payload(cwd), cwd)) ?? '';
    assert.ok(text.startsWith(SUBAGENT_PREAMBLE), 'the frame is not the first thing in the block');
    assert.ok(
      text.indexOf(SUBAGENT_PREAMBLE) < text.indexOf('## my_context'),
      'the frame must precede the heading it accounts for',
    );
  } finally { removeTree(cwd); }
});

/**
 * **The three clauses, asserted one at a time.**
 *
 * This is the only test in the file whose subject is wording, and the wording
 * is the deliverable: a subagent that cannot tell this block from an injection
 * is correct to report it as one. Each assertion below is a separate clause so
 * that deleting any single one of them turns this test red on its own name
 * rather than on a golden-string diff nobody can read.
 */
test('the frame says where it came from, who wrote it, and that it is not the dispatcher', () => {
  // 1. Where it came from, and at what moment.
  assert.match(SUBAGENT_PREAMBLE, /my_context, the knowledge plugin installed in this repository/u);
  assert.match(SUBAGENT_PREAMBLE, /when this subagent started/u);
  // 2. Who wrote what it carries — and the mechanism, not an adjective.
  assert.match(SUBAGENT_PREAMBLE, /maintained by the people working on this project/u);
  assert.match(SUBAGENT_PREAMBLE, /staged as a draft and does not govern until a person promotes it/u);
  // 3. That it is not the dispatcher speaking.
  assert.match(SUBAGENT_PREAMBLE, /not part of the message that dispatched you/u);
  // And the two clauses that keep the frame from being the thing it defends
  // against: it can be checked, and it claims no authority over the reader's
  // own instructions.
  assert.match(SUBAGENT_PREAMBLE, /`mycontext show <id>`/u);
  assert.match(SUBAGENT_PREAMBLE, /do not replace the instructions you were given/u);
});

/**
 * The claim in clause 2 is the one that can go stale, so it is checked against
 * the code that enforces it rather than only against itself. Both halves:
 * nothing non-human reaches `active` in a normative category, and what is
 * staged instead never reaches the block. If either ever changes, the frame is
 * asserting a property the product no longer has — the one thing a provenance
 * frame must never do.
 */
test('the promotion clause is true: a non-human capture is staged, and a staged item is not injected', () => {
  // Half one: the rule, and it is a hard override rather than a default — an
  // explicit `status: 'active'` from a non-human caller is still forced down.
  assert.equal(trustedStatus('agent', 'normative', 'active'), 'draft');
  assert.equal(trustedStatus('ingest', 'normative', 'active'), 'draft');
  assert.equal(trustedStatus('human', 'normative', 'active'), 'active');

  // Half two: what a staged item gets in a subagent's block — a count, never
  // its title and never its text.
  const cwd = sandbox();
  try {
    corpus(cwd);
    const file = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-staged.md');
    writeFileSync(file, `---
id: CONST-staged
type: constraint
title: Staged claim about the pool
status: draft
severity: hard
always: true
---

# Staged claim about the pool

Body of CONST-staged.
`, 'utf8');
    const text = context(buildSubagentStartOutput(payload(cwd), cwd)) ?? '';
    assert.match(text, /Body of CONST-pool\./u, 'the control: an active item is delivered');
    assert.doesNotMatch(text, /Body of CONST-staged\./u, 'a staged item governed');
    assert.doesNotMatch(text, /Staged claim about the pool/u);
    assert.match(text, /1 drafts pending review/u, 'and it is counted rather than hidden');
  } finally { removeTree(cwd); }
});

/** Scaffolding, not budget: the frame is outside the number the budgets were spent against. */
test('the frame is not counted in the recorded token total', () => {
  const cwd = sandbox();
  try {
    corpus(cwd);
    buildSubagentStartOutput(payload(cwd), cwd);
    const complete = records(cwd).find((r) => r.note?.includes('delivery=complete'))!;
    assert.ok(complete.tokens !== undefined);
    assert.ok(
      complete.tokens < SUBAGENT_PREAMBLE.length / 4,
      `the frame appears to have been charged to a budget (tokens=${complete.tokens})`,
    );
  } finally { removeTree(cwd); }
});

/** No frame without a block: a frame alone would introduce items that are not there. */
test('nothing is framed when nothing was selected', () => {
  const cwd = sandbox();
  try {
    assert.equal(buildSubagentStartOutput(payload(cwd), cwd), '');
    assert.equal(
      readFileSync(auditLogPath(root(cwd)), 'utf8').includes(SUBAGENT_PREAMBLE.slice(0, 40)),
      false,
      'the audit log records scope, never the rendered block',
    );
  } finally { removeTree(cwd); }
});

/**
 * The frame is the subagent event's alone. The two other paths that deliver
 * this project's knowledge into a context window are unchanged: a session
 * start is read by a human who was present when it fired, and a JIT injection
 * arrives mid-task in a window that already holds one.
 */
test('neither a session start nor a JIT injection carries the frame', () => {
  const cwd = sandbox();
  try {
    corpus(cwd);
    const sessionStart = buildInjection(cwd, { event: 'session-start', sessionId: 'other' });
    assert.match(sessionStart, /CONST-pool/u);
    assert.doesNotMatch(sessionStart, /knowledge plugin installed in this repository/u);
    const jit = buildJitOutput(payload(cwd), cwd, path.join(cwd, 'src', 'app.ts'));
    assert.doesNotMatch(jit, /knowledge plugin installed in this repository/u);
  } finally { removeTree(cwd); }
});

// --- 3. The agent_id gate ---------------------------------------------------

/**
 * `ledgerKey` returns the BARE session id when `agent_id` is absent, so an
 * injection here would write the PARENT's seen file with items only a subagent
 * received — suppressing the parent's own JIT tier and putting ids the
 * parent's window never held into the PreCompact snapshot. Both are misses.
 *
 * And no attempt record either: an attempt record is a claim that a subagent
 * lost context, and a payload naming no subagent never owed one any.
 */
test('a payload with no agent_id injects nothing, writes no seen entry AND no attempt record', () => {
  const cwd = sandbox();
  try {
    corpus(cwd);
    assert.equal(buildSubagentStartOutput(payload(cwd, { agent_id: undefined }), cwd), '');
    assert.deepEqual(records(cwd), []);
    assert.equal(existsSync(seenFilePath(root(cwd), PARENT)), false);
    assert.deepEqual(seenIds(readSeen(root(cwd), PARENT)), []);
  } finally { removeTree(cwd); }
});

/**
 * The parent's next injection is the thing that gate protects, so it is
 * asserted through the parent rather than through the absence of a file.
 */
test('after a payload with no agent_id, the parent still has its whole injection to come', () => {
  const cwd = sandbox();
  try {
    corpus(cwd);
    buildSubagentStartOutput(payload(cwd, { agent_id: undefined }), cwd);
    const jit = buildJitOutput(
      { session_id: PARENT }, cwd, path.join(cwd, 'src', 'app.ts'),
    );
    assert.match(jit, /CONST-pool/u, "the parent's own JIT tier was suppressed");
  } finally { removeTree(cwd); }
});

/**
 * A missing `session_id` is NOT that gate. `ledgerKey` returns `null`, which
 * can collide with nothing, so there is nothing to corrupt — and withholding
 * the delivery would be a miss against a subagent that has nothing at all.
 * `buildInjection` discloses the absent key in its note.
 */
test('a payload with no session_id still delivers, and says it could not dedupe', () => {
  const cwd = sandbox();
  try {
    corpus(cwd);
    const out = buildSubagentStartOutput(payload(cwd, { session_id: undefined }), cwd);
    assert.match(context(out) ?? '', /CONST-pool/u);
    const complete = records(cwd).find((r) => r.note?.includes('delivery=complete'))!;
    assert.match(complete.note ?? '', /no dedupe key; no seen entry written/u);
    assert.equal(complete.sessionId, undefined);
  } finally { removeTree(cwd); }
});

// --- 4. The order of the two writes (spec §6n.3) ----------------------------

/**
 * **Order, not presence.** A test that only asserted both records exist would
 * pass with the ordering reversed, and the reversal is the exact failure the
 * ruling is about: a record written after the work records every delivery that
 * succeeded and none that was killed. So the assertion is over LINE positions
 * in the JSONL.
 */
test('the delivery=attempted record is on disk BEFORE the delivery=complete one', () => {
  const cwd = sandbox();
  try {
    corpus(cwd);
    buildSubagentStartOutput(payload(cwd), cwd);
    const lines = readFileSync(auditLogPath(root(cwd)), 'utf8').trim().split('\n');
    const attempt = lines.findIndex((l) => l.includes('delivery=attempted'));
    const complete = lines.findIndex((l) => l.includes('delivery=complete'));
    assert.notEqual(attempt, -1, 'no attempt record was written');
    assert.notEqual(complete, -1, 'no completion record was written');
    assert.ok(attempt < complete, `attempt is line ${attempt}, completion is line ${complete}`);
  } finally { removeTree(cwd); }
});

test('both records carry the parent session id, the same agent, and one op', () => {
  const cwd = sandbox();
  try {
    corpus(cwd);
    buildSubagentStartOutput(payload(cwd), cwd);
    const rows = records(cwd);
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.equal(row.op, 'subagent-start');
      assert.equal(row.kind, 'injection');
      assert.equal(row.hook, 'SubagentStart');
      // The PARENT's id on both, so `mycontext audit --session <parent>` shows
      // the pair side by side. Never the composite.
      assert.equal(row.sessionId, PARENT);
      assert.notEqual(row.sessionId, KEY);
      assert.match(row.note ?? '', new RegExp(`agent=${AGENT}$`, 'u'));
    }
    assert.match(rows[0]!.note ?? '', /^delivery=attempted /u);
    assert.match(rows[1]!.note ?? '', /^delivery=complete /u);
  } finally { removeTree(cwd); }
});

/** Scope, not content: neither record may carry the payload or the block. */
test('the attempt record carries no item text and no payload', () => {
  const cwd = sandbox();
  try {
    corpus(cwd);
    buildSubagentStartOutput(payload(cwd), cwd);
    const attempt = records(cwd)[0]!;
    assert.deepEqual(attempt.injected, []);
    assert.equal(attempt.tokens, 0);
    assert.equal(attempt.spilled, undefined);
    const raw = JSON.stringify(attempt);
    assert.doesNotMatch(raw, /Body of CONST-pool/u);
    assert.doesNotMatch(raw, /prompt-1/u, 'the prompt id is payload, not scope');
    assert.doesNotMatch(raw, /transcript/u);
  } finally { removeTree(cwd); }
});

/**
 * **The failure the ordering was built for, made deterministic.**
 *
 * The work is broken with an unparseable `config.json`: `resolveWorkspace`
 * throws inside `buildInjection`, which fails open and returns '' before it
 * reaches its own record. The attempt is left standing alone — the same shape
 * a killed process leaves, produced without a race and without a sleep.
 *
 * This is also the only place in the product where an unparseable
 * `config.json` leaves any trace at all: every binary exits 0 with both
 * streams empty, and a full corpus injects nothing and says nothing
 * (`test/hooks/hook-binaries-e2e.test.ts` pins that as it is). The attempt
 * record does not fix that — it is evidence after the fact, which is what
 * §6n.3 asked for and all it asked for.
 */
test('work that fails after the attempt record leaves the attempt behind, alone', () => {
  const cwd = sandbox();
  try {
    corpus(cwd);
    writeFileSync(path.join(cwd, '.my_context', 'config.json'), '{ "watchedDocs": ', 'utf8');
    assert.equal(buildSubagentStartOutput(payload(cwd), cwd), '');
    const rows = records(cwd);
    assert.equal(rows.length, 1);
    assert.match(rows[0]!.note ?? '', /^delivery=attempted agent=agent-9$/u);
    assert.equal(
      rows.some((r) => r.note?.includes('delivery=complete')), false,
      'a completion was recorded for a delivery that never happened',
    );
  } finally { removeTree(cwd); }
});

/**
 * The other half of that pair, and the reason the completion is written
 * unconditionally: an empty delivery and a killed hook must not leave the same
 * log.
 */
test('a delivery that carried nothing is delivery=complete, not an unmatched attempt', () => {
  const cwd = sandbox();
  try {
    assert.equal(buildSubagentStartOutput(payload(cwd), cwd), '');
    const rows = records(cwd);
    assert.equal(rows.length, 2);
    assert.match(rows[0]!.note ?? '', /delivery=attempted/u);
    assert.match(rows[1]!.note ?? '', /delivery=complete/u);
    assert.deepEqual(rows[1]!.injected, []);
  } finally { removeTree(cwd); }
});

/**
 * `readAudit` refuses a whole SEGMENT on a row it cannot validate, so a
 * malformed attempt row would take every record in the file down with it.
 */
test('both records survive the audit log round trip', () => {
  const cwd = sandbox();
  try {
    corpus(cwd);
    buildSubagentStartOutput(payload(cwd), cwd);
    const raw = readFileSync(auditLogPath(root(cwd)), 'utf8');
    assert.equal(raw.trim().split('\n').length, 2);
    assert.equal(records(cwd).length, 2, 'a row was refused, taking the segment with it');
  } finally { removeTree(cwd); }
});

// --- 5. What the birth entry dedupes, and what it does not ------------------

/**
 * **The measured fact this hook rests on:** `ledgerKey` returns the identical
 * string at `SubagentStart` and at that subagent's first `PreToolUse`, so the
 * entry written at birth is the entry the JIT tier reads. Without it the
 * subagent's first tool call re-delivers everything it was handed a moment
 * earlier — the same item twice, in a context window that started empty.
 */
test('a PreToolUse from that same subagent, after the birth entry, delivers nothing twice', () => {
  const cwd = sandbox();
  try {
    corpus(cwd);
    const target = path.join(cwd, 'src', 'app.ts');

    // The control, in a workspace where no birth entry exists: the JIT tier
    // does deliver this item on a tool call.
    const fresh = sandbox();
    corpus(fresh);
    assert.match(
      buildJitOutput(payload(fresh), fresh, path.join(fresh, 'src', 'app.ts')),
      /CONST-pool/u,
      'premise: without a birth entry the JIT tier delivers the pinned item',
    );
    removeTree(fresh);

    buildSubagentStartOutput(payload(cwd), cwd);
    assert.deepEqual(seenIds(readSeen(root(cwd), KEY)), ['CONST-pool']);
    assert.doesNotMatch(
      buildJitOutput(payload(cwd), cwd, target), /Body of CONST-pool/u,
      'the birth entry did not dedupe the subagent’s first tool call',
    );
  } finally { removeTree(cwd); }
});

/**
 * **What the birth entry does NOT dedupe, pinned as it is.**
 *
 * Task 10's own test list asks for "a second SubagentStart for the same
 * agent_id delivers nothing — the birth entry deduped it". It does not, and
 * cannot without a change nobody asked for: `buildInjection` never passes
 * `seen` to `select` on any event — the seen file feeds the JIT tier and the
 * PreCompact snapshot, not the session-start-shaped selection this event uses.
 * A second `SubagentStart` for one `agent_id` never happens (one birth per
 * subagent), so this is pinned as the behaviour rather than filed as a defect
 * — but it is pinned, so that "the birth entry dedupes" is never read wider
 * than it is true.
 */
test('a second SubagentStart for the same agent delivers again — the seen file is not a selection input', () => {
  const cwd = sandbox();
  try {
    corpus(cwd);
    const first = context(buildSubagentStartOutput(payload(cwd), cwd));
    const second = context(buildSubagentStartOutput(payload(cwd), cwd));
    assert.equal(second, first);
    assert.equal(records(cwd).length, 4, 'two dispatches, two records each');
  } finally { removeTree(cwd); }
});

/** Two subagents of one parent are two context windows, and two seen files. */
test('a sibling subagent gets its own delivery and its own key', () => {
  const cwd = sandbox();
  try {
    corpus(cwd);
    buildSubagentStartOutput(payload(cwd), cwd);
    const sibling = 'agent-10';
    assert.match(
      context(buildSubagentStartOutput(payload(cwd, { agent_id: sibling }), cwd)) ?? '',
      /Body of CONST-pool/u,
    );
    const siblingKey = ledgerKey({ session_id: PARENT, agent_id: sibling })!;
    assert.deepEqual(seenIds(readSeen(root(cwd), siblingKey)), ['CONST-pool']);
    assert.equal(existsSync(seenFilePath(root(cwd), PARENT)), false);
  } finally { removeTree(cwd); }
});

// ---------------------------------------------------------------------------
// 6. The binary, as a real OS process — INV-hooks-fail-open.
//
// Everything above imports a function. That leaves the part Claude Code
// actually runs — `node <file>` with JSON on stdin, an exit code, and whatever
// landed on stdout — with nothing that could fail if the entry guard, the
// stdin read or the write to stdout were removed.
//
// This binary is deliberately NOT added to `hook-binaries-e2e.test.ts`'s
// battery here: that file's header states how many binaries exist and Task 11,
// which registers this one in `hooks.json`, owns that count. Registering it
// there and counting it there is one edit, in one commit, or the count and the
// manifest drift apart — which is the defect §0's first row already records.
// ---------------------------------------------------------------------------

interface Run {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

function runBinary(raw: string, cwd: string, options: { holdStdin?: boolean } = {}): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath, ['--disable-warning=ExperimentalWarning', BINARY],
      { cwd, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c: string) => { stdout += c; });
    child.stderr.on('data', (c: string) => { stderr += c; });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(
        `subagent-start did not exit within ${EXIT_BUDGET_MS}ms. ` +
        `stdout: ${JSON.stringify(stdout)}; stderr: ${JSON.stringify(stderr)}`,
      ));
    }, EXIT_BUDGET_MS);
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
    child.stdin.write(raw);
    if (!options.holdStdin) child.stdin.end();
  });
}

test('the binary writes the envelope on stdout for a real payload', async () => {
  const cwd = sandbox();
  try {
    corpus(cwd);
    const run = await runBinary(JSON.stringify(payload(cwd)), cwd);
    assert.equal(run.code, 0, `stderr: ${run.stderr}`);
    assert.equal(run.stderr, '');
    const parsed = JSON.parse(run.stdout) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    assert.equal(parsed.hookSpecificOutput.hookEventName, 'SubagentStart');
    assert.ok(parsed.hookSpecificOutput.additionalContext.startsWith(SUBAGENT_PREAMBLE));
    assert.equal(records(cwd).length, 2);
  } finally { removeTree(cwd); }
});

// A NUL as an ESCAPE, never a raw byte: a literal NUL makes git treat this
// whole file as binary — no diff, no review, an unresolvable merge conflict.
// The bytes sent are identical either way.
const GARBAGE = 'not json at all {{{ \u0000 ]]';

/**
 * The two disclosures this binary adds, both on stderr, because it has no
 * other channel: an unreadable payload and a payload naming no subagent both
 * mean a subagent ran with none of this project's knowledge, and neither can
 * be recorded in the log (the first has no agent to name, the second is not a
 * subagent at all).
 */
test('garbage on stdin produces empty output, exit 0, and says what was lost', async () => {
  const cwd = sandbox();
  try {
    corpus(cwd);
    const run = await runBinary(GARBAGE, cwd);
    assert.equal(run.code, 0);
    assert.equal(run.signal, null);
    assert.equal(run.stdout, '');
    assert.match(run.stderr, /hook payload unreadable/u);
    assert.match(run.stderr, /starts with none of this project's knowledge/u);
    assert.deepEqual(records(cwd), [], 'an unreadable payload named no agent to record');
  } finally { removeTree(cwd); }
});

test('an empty stdin is not an error and says nothing', async () => {
  const cwd = sandbox();
  try {
    corpus(cwd);
    const run = await runBinary('', cwd);
    assert.equal(run.code, 0);
    assert.equal(run.stdout, '');
    // An interactive run with no stdin at all is not a malformed payload, and
    // a hook that goes noisy on one is a worse defect than the silence.
    assert.equal(run.stderr, '');
  } finally { removeTree(cwd); }
});

test('a payload that names no subagent is disclosed, once, on stderr', async () => {
  const cwd = sandbox();
  try {
    corpus(cwd);
    const run = await runBinary(JSON.stringify(payload(cwd, { agent_id: undefined })), cwd);
    assert.equal(run.code, 0);
    assert.equal(run.stdout, '');
    assert.match(run.stderr, /arrived with no `agent_id`/u);
  } finally { removeTree(cwd); }
});

/**
 * The unref'd 2s timer, which bounds exactly one failure: a pipe the caller
 * opened and never closed. It bounds nothing else — `buildInjection` is
 * synchronous once it starts and no timer can preempt synchronous work — and
 * this test says only what it proves.
 */
test('the binary exits on its own when stdin is never closed', async () => {
  const cwd = sandbox();
  try {
    corpus(cwd);
    const run = await runBinary(JSON.stringify(payload(cwd)), cwd, { holdStdin: true });
    assert.equal(run.code, 0);
    assert.equal(run.stdout, '', 'the read resolved while the pipe was still open');
  } finally { removeTree(cwd); }
});

/**
 * INV-hooks-fail-open, one failure mode at a time, at the binary level. The
 * two modes above are where this hook does the LEAST work; these are where it
 * does the most and then hits a wall.
 *
 * None of them relies on file permissions: `chmod` is close to a no-op on
 * Windows, and a test that quietly does nothing on the platform this project
 * is developed on is worse than no test. A directory replaced by a regular
 * FILE is refused by `mkdirSync` everywhere.
 */
const FAILURE_MODES: { name: string; prepare: () => string; expectInjection: boolean }[] = [
  {
    // No `.my_context` above the cwd: no workspace, nowhere to record, nothing
    // to inject — and no attempt record either, because the log lives inside
    // the workspace that is not there.
    name: 'no workspace at all',
    prepare: () => mkdtempSync(path.join(tmpdir(), 'myctx-sub-nows-')),
    expectInjection: false,
  },
  {
    // The one call on this path that THROWS rather than returning a falsy
    // answer. The attempt record is written before it (`findProjectRoot` reads
    // no config), so this mode is also the deterministic half of the ordering
    // test above.
    name: 'config.json that makes resolveWorkspace throw',
    prepare: () => {
      const cwd = sandbox();
      corpus(cwd);
      writeFileSync(path.join(cwd, '.my_context', 'config.json'), '{ "watchedDocs": ', 'utf8');
      return cwd;
    },
    expectInjection: false,
  },
  {
    // Every directory this hook writes into replaced by a regular file, so the
    // seen-file append and both audit appends fail at `mkdirSync`. The
    // delivery still happens: the corpus is read from Markdown, and a log that
    // cannot be written costs the record, never the injection.
    name: 'a corpus nothing can be written into',
    prepare: () => {
      const cwd = sandbox();
      corpus(cwd);
      for (const blocked of ['state', '.audit']) {
        const target = path.join(cwd, '.my_context', blocked);
        removeTree(target);
        writeFileSync(target, 'not a directory\n', 'utf8');
      }
      return cwd;
    },
    expectInjection: true,
  },
];

for (const mode of FAILURE_MODES) {
  test(`subagent-start fails open with ${mode.name}`, async () => {
    const cwd = mode.prepare();
    try {
      const run = await runBinary(JSON.stringify(payload(cwd)), cwd);
      assert.equal(run.code, 0, `exit ${run.code}; stderr: ${run.stderr}`);
      assert.equal(run.signal, null, 'the hook died rather than failing open');
      // Whatever it decided to say must still be readable by Claude Code: a
      // half-written JSON object breaks the dispatch by a different route than
      // a non-zero exit.
      if (run.stdout.trimStart().startsWith('{')) JSON.parse(run.stdout);
      assert.equal(
        run.stdout.includes('additionalContext'), mode.expectInjection,
        `injection presence for "${mode.name}" is not what this mode was built to show`,
      );
    } finally { removeTree(cwd); }
  });
}

/**
 * The unwritable mode is only worth its runtime if it BITES, and "exited 0" is
 * also what a hook that declined early looks like. So the delivery is asserted
 * to survive the very failure that erased its record.
 */
test('an unwritable log costs the record, never the delivery', async () => {
  const cwd = FAILURE_MODES[2]!.prepare();
  try {
    const run = await runBinary(JSON.stringify(payload(cwd)), cwd);
    assert.equal(run.code, 0);
    assert.match(run.stdout, /CONST-pool/u, 'the injection was lost with the log');
    assert.equal(existsSync(auditLogPath(root(cwd))), false, 'premise: nothing could be recorded');
  } finally { removeTree(cwd); }
});
