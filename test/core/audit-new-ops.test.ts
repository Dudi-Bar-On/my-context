/**
 * **The two ops Tasks 7, 9 and 10 will write, registered before anything writes
 * them** (plan `2026-08-20-v2-hooks-sessions-and-continuity.md` Task 4).
 *
 * `specFor`'s validator refuses an op it does not know and takes the whole
 * SEGMENT with it, so a hook that writes an unregistered op produces a log that
 * rejects its own records — and a rejected audit record looks exactly like a
 * hook that silently did not run. `test/core/audit.test.ts`'s totality check
 * catches an op with no `KIND_OF` row; it cannot catch an op that was never
 * added at all. This file is the other half: it writes each new op through the
 * same writer the hooks use, reads it back, and pins the refusal that is the
 * reason the registration has to land first.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  AUDIT_OPS, AUDIT_PROTOCOL, auditLogPath, HOOK_OPS, INJECTION_OPS, kindOf, ledgerRows,
  parseAudit, readAudit, recordAudit,
  type AuditRecord,
} from '../../src/core/audit.ts';
import { readSeen, seenFilePath, SEEN_PROTOCOL } from '../../src/core/seen-file.ts';
import { removeTree } from '../helpers/tmp.ts';

function box(): { root: string; dispose(): void } {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-audit-new-ops-'));
  return { root, dispose: () => removeTree(root) };
}

test('subagent-start is an injection op and post-tool-use-failure is a hook op', () => {
  assert.ok(AUDIT_OPS.includes('subagent-start'), 'subagent-start is registered');
  assert.ok(AUDIT_OPS.includes('post-tool-use-failure'), 'post-tool-use-failure is registered');
  assert.equal(kindOf('subagent-start'), 'injection');
  assert.equal(kindOf('post-tool-use-failure'), 'hook');
});

/**
 * WHICH family each op joined, and where in it. The family is what decides the
 * kind (`KIND_OF` is written by hand, so the two can disagree), and the ORDER
 * is what the CLI's `--op` listing and the MCP schema's enum show a reader —
 * both derive from `AUDIT_OPS`, which is these arrays spread in sequence. A
 * member inserted rather than appended reorders a surface nobody edited.
 */
test('each new op is appended to its own family, moving no member before it', () => {
  assert.deepEqual(
    [...INJECTION_OPS],
    ['session-start', 'compact-restore', 'jit', 'manual', 'subagent-start'],
  );
  assert.deepEqual(
    [...HOOK_OPS],
    ['pre-compact', 'post-tool-use', 'deny', 'post-tool-use-failure', 'session-end',
      'post-compact'],
  );
});

/**
 * **`session-end` is registered because it records a DELETION.**
 *
 * The `SessionEnd` hook removes the seen files and restore snapshot of the
 * context window `/clear` destroyed — the only firing that carries that
 * window's id — and it is also the one hook in this project with no channel to
 * the user at all: Claude Code copies a `SessionEnd` hook's output to stderr
 * only when the hook FAILS, and `INV-hooks-fail-open` requires this one to exit
 * 0. So the row is not a convenience. It is the only place the deletion is ever
 * named, which is `INV-nothing-is-dropped-silently` at its narrowest.
 *
 * A `hook` op and not an `injection` one, for the reason `INJECTION_OPS`'
 * comment gives in the other direction: nothing was put in front of a model
 * here.
 */
/**
 * **`post-compact` closes the pair `pre-compact` opens.** `PreCompact` writes
 * the restore snapshot and the compaction can still throw afterwards, so a
 * `pre-compact` row with no `post-compact` row beside it is a compaction that
 * never finished. It is also the only row that can carry `trigger`: the proxy
 * this project used before — `SessionStart(source: 'compact')` — spells a
 * user-typed `/compact` and a window that filled up with the same string.
 */
test('post-compact is a hook op that joins pre-compact on the session', () => {
  assert.ok(AUDIT_OPS.includes('post-compact'), 'post-compact is registered');
  assert.equal(kindOf('post-compact'), 'hook');

  const b = box();
  try {
    recordAudit(b.root, {
      kind: 'hook', op: 'pre-compact', sessionId: 's1', hook: 'PreCompact',
      injected: [{ id: 'RULE-a', tier: 'snapshot' }], at: '2026-08-22T00:00:00.000Z',
    });
    const written = recordAudit(b.root, {
      kind: 'hook', op: 'post-compact', sessionId: 's1', hook: 'PostCompact',
      note: 'trigger=auto; summary 1200 chars; snapshot 1 id(s), 1 re-delivered by the restore ' +
        'tier, 1 still named in the summary',
      at: '2026-08-22T00:00:01.000Z',
    });
    assert.equal(written.written, true, written.error);

    const records = readAudit(b.root);
    assert.deepEqual(records.map((r) => r.op), ['pre-compact', 'post-compact']);
    assert.deepEqual(records.map((r) => r.hook), ['PreCompact', 'PostCompact']);
    assert.equal(new Set(records.map((r) => r.sessionId)).size, 1, 'the pair must join');

    const raw = readFileSync(auditLogPath(b.root), 'utf8');
    assert.deepEqual(
      parseAudit(raw, 'audit.jsonl').map((r) => r.op), ['pre-compact', 'post-compact'],
    );
  } finally { b.dispose(); }
});

test('session-end is a hook op, and a record written under it parses back', () => {
  assert.ok(AUDIT_OPS.includes('session-end'), 'session-end is registered');
  assert.equal(kindOf('session-end'), 'hook');

  const b = box();
  try {
    const written = recordAudit(b.root, {
      kind: 'hook', op: 'session-end', sessionId: 's1', hook: 'SessionEnd',
      note: 'reason=clear; cleared 2 seen file(s)', at: '2026-08-22T00:00:00.000Z',
    });
    assert.equal(written.written, true, written.error);

    const records = readAudit(b.root);
    assert.deepEqual(records.map((r) => r.op), ['session-end']);
    assert.equal(records[0].hook, 'SessionEnd');
    assert.equal(records[0].kind, 'hook');

    // …and through the raw-bytes parser, which is what a segment reader calls.
    const raw = readFileSync(auditLogPath(b.root), 'utf8');
    assert.deepEqual(parseAudit(raw, 'audit.jsonl').map((r) => r.op), ['session-end']);
  } finally { b.dispose(); }
});

test('a record written with each new op parses back, hook name included', () => {
  const b = box();
  try {
    const first = recordAudit(b.root, {
      kind: 'injection', op: 'subagent-start', sessionId: 's1', hook: 'SubagentStart',
      injected: [{ id: 'RULE-a', tier: 'pinned' }], tokens: 12,
      at: '2026-08-21T00:00:00.000Z',
    });
    const second = recordAudit(b.root, {
      kind: 'hook', op: 'post-tool-use-failure', sessionId: 's1', hook: 'PostToolUseFailure',
      path: 'src/thing.ts', at: '2026-08-21T00:00:01.000Z',
    });
    assert.equal(first.written, true, first.error);
    assert.equal(second.written, true, second.error);

    // Through the read surface the CLI and the MCP tool use…
    const records = readAudit(b.root);
    assert.deepEqual(records.map((r) => r.op), ['subagent-start', 'post-tool-use-failure']);
    assert.deepEqual(records.map((r) => r.kind), ['injection', 'hook']);
    assert.deepEqual(records.map((r) => r.hook), ['SubagentStart', 'PostToolUseFailure']);
    assert.equal(records[0].protocol, AUDIT_PROTOCOL);

    // …and through the raw-bytes parser, which is what a segment reader calls.
    const raw = readFileSync(auditLogPath(b.root), 'utf8');
    assert.deepEqual(parseAudit(raw, 'audit.jsonl').map((r) => r.op), records.map((r) => r.op));
  } finally { b.dispose(); }
});

/**
 * The failure this task exists to prevent, executed rather than described: an
 * op that is NOT registered still takes the whole segment down, and the message
 * names the op it refused. Registration is the only thing separating the two
 * records above from this one.
 */
test('an unregistered op is still refused, and the refusal names it', () => {
  const line = `${JSON.stringify({
    protocol: AUDIT_PROTOCOL, at: '2026-08-21T00:00:00.000Z',
    kind: 'hook', op: 'subagent-stop',
  })}\n`;
  assert.throws(
    () => parseAudit(line, 'audit.jsonl'),
    (err: Error) => {
      assert.match(err.message, /declares op "subagent-stop", which is not one of/);
      assert.match(err.message, /subagent-start/, 'the message lists the vocabulary it does know');
      return true;
    },
  );
});

/**
 * `carried` (Task 17) is a delivery the SELECTOR knows about and neither of
 * these two files does. A replayed ledger that claimed it, or a seen file that
 * accepted it, would suppress items that were never injected — so both closed
 * sets stay closed, and this asserts it from outside them.
 */
test('carried is neither a ledger tier nor a seen tier', () => {
  const record: AuditRecord = {
    protocol: AUDIT_PROTOCOL, at: '2026-08-21T00:00:00.000Z',
    kind: 'injection', op: 'subagent-start', sessionId: 's1',
    injected: [{ id: 'RULE-carried', tier: 'carried' }, { id: 'RULE-pinned', tier: 'pinned' }],
  };
  assert.deepEqual(ledgerRows([record]).map((r) => r.itemId), ['RULE-pinned']);

  const b = box();
  try {
    assert.equal(SEEN_PROTOCOL, 'mycontext-seen/1');
    const file = seenFilePath(b.root, 's1');
    mkdirSync(path.dirname(file), { recursive: true });
    // Newline-terminated, so it is not a torn tail and gets no tolerance.
    writeFileSync(file, `${JSON.stringify({
      protocol: SEEN_PROTOCOL, id: 'RULE-carried', tier: 'carried', at: '2026-08-21T00:00:00.000Z',
    })}\n`, 'utf8');
    const state = readSeen(b.root, 's1');
    assert.notEqual(state.error, null, 'a carried seen line is refused');
    assert.match(state.error ?? '', /has no usable "tier"/);
    assert.deepEqual(state.lines, [], 'no partial answers');
  } finally { b.dispose(); }
});
