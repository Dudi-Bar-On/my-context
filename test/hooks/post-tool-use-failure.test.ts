/**
 * **The degradation counter** (plan `2026-08-20-v2-hooks-sessions-and-continuity.md` Task 7).
 *
 * This hook is the only place in the product where a FAILED tool call leaves a
 * durable trace, and it exists because `INV-hooks-fail-open` is a policy whose
 * cost is invisible by design: a hook that returns '' on every error path
 * cannot, by construction, tell anyone how often it did. One audit row per
 * failure is the empirical check on that policy.
 *
 * So the assertions below are in two families, and the second is the one that
 * matters more:
 *
 *  1. What the row says — the tool's name, a reason when the payload supplies
 *     one, and NEVER the tool input. Read back off disk, through `readAudit`
 *     and once through the raw bytes, because a record that exists only in a
 *     return value is not a record.
 *  2. That every failure mode still returns without throwing and writes
 *     nothing it cannot justify: a payload that says nothing at all, a
 *     workspace that is not there, a `config.json` that makes
 *     `resolveWorkspace` THROW, and a log directory that cannot be created. A
 *     hook that fails closed is worse than no hook, and each of those four is
 *     a separate route to failing closed.
 *
 * The event itself is unverified — no probe has established that Claude Code
 * fires `PostToolUseFailure`, or what its payload names the failure reason
 * (plan Task 7, "Unverified, and treated as such"). Nothing here asserts a
 * payload shape: the reason tests pin the DEFENSIVE READ (a closed list of
 * plausible keys, a string or nothing) and the omission case pins what happens
 * when the guess is wrong, which is the case most likely to be real.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { recordToolFailure } from '../../src/hooks/post-tool-use-failure.ts';
import { runCli } from '../../src/cli/index.ts';
import { auditDir, auditLogPath, readAudit, type AuditRecord } from '../../src/core/audit.ts';
import type { HookInput } from '../../src/hooks/io.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-ptuf-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function root(cwd: string): string {
  const projectRoot = resolveWorkspace(cwd).projectRoot;
  assert.ok(projectRoot, 'the fixture must have a workspace');
  return projectRoot;
}

/** Every record the log holds, read back off disk rather than from a return value. */
function rows(cwd: string): AuditRecord[] {
  return readAudit(root(cwd));
}

/**
 * A payload whose extra fields no `HookInput` member describes.
 *
 * The cast is the point rather than a workaround: `PostToolUseFailure`'s
 * payload is unprobed, so the hook reads it as a bag of unknowns and these
 * tests hand it one. Widening `HookInput` with an asserted field would be the
 * shape claim plan Task 7 forbids.
 */
function payload(fields: Record<string, unknown>): HookInput {
  return fields as HookInput;
}

/** Runs `fn` with `process.stderr.write` captured — the pattern in pre-compact.test.ts. */
function capturingStderr<T>(fn: () => T): { value: T; stderr: string } {
  const chunks: string[] = [];
  const real = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    chunks.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
  try {
    return { value: fn(), stderr: chunks.join('') };
  } finally {
    process.stderr.write = real;
  }
}

// ---------------------------------------------------------------------------
// What the row says.
// ---------------------------------------------------------------------------

test('a failure payload writes exactly one hook record with no injected refs', () => {
  const cwd = sandbox();
  try {
    const result = recordToolFailure(
      { session_id: 's1', hook_event_name: 'PostToolUseFailure', cwd, tool_name: 'Write' },
      cwd,
    );
    assert.equal(result?.written, true, result?.error);

    const records = rows(cwd);
    assert.equal(records.length, 1, 'exactly one row per failure, not zero and not two');
    const record = records[0]!;
    assert.equal(record.kind, 'hook', 'nothing was put in front of the model');
    assert.equal(record.op, 'post-tool-use-failure');
    assert.equal(record.hook, 'PostToolUseFailure');
    assert.equal(record.sessionId, 's1');
    // `injected: []`, not absent and not populated: `ledgerRows` replays
    // `injected`, and a hook that delivered nothing must not look like a
    // delivery to the replay that rebuilds the ledger.
    assert.deepEqual(record.injected, []);

    // And the bytes are on disk, not merely in the object the reader built.
    const raw = readFileSync(auditLogPath(root(cwd)), 'utf8');
    assert.match(raw, /"op":"post-tool-use-failure"/);
    assert.match(raw, /"hook":"PostToolUseFailure"/);
  } finally { removeTree(cwd); }
});

test('the note carries the tool name and never the tool input', () => {
  const cwd = sandbox();
  try {
    recordToolFailure(payload({
      session_id: 's1',
      cwd,
      tool_name: 'Edit',
      // The two things a note must never carry: the path being edited and the
      // text being written. Both are content; the audit log records scope.
      tool_input: { file_path: '/home/u/private-credentials.txt', content: 'SECRET-BODY-TEXT' },
    }), cwd);

    const record = rows(cwd)[0]!;
    assert.match(record.note ?? '', /Edit/, 'the note names the tool that failed');
    assert.match(record.note ?? '', /failed/);

    // Asserted over the WHOLE record, not only the note: a later edit that
    // moved the file path into `path` or the input into a new field would slip
    // past an assertion aimed at one string.
    const serialized = JSON.stringify(record);
    assert.equal(
      serialized.includes('SECRET-BODY-TEXT'), false,
      'the tool input reached the audit log',
    );
    assert.equal(
      serialized.includes('private-credentials'), false,
      'the edited path reached the audit log',
    );
  } finally { removeTree(cwd); }
});

test('a payload with no session_id still records', () => {
  const cwd = sandbox();
  try {
    // A degradation counter that only counts the failures it can attribute
    // counts the wrong thing. PreCompact returns null without a session id
    // because a snapshot has nowhere to go; this row has somewhere to go.
    const result = recordToolFailure({ cwd, tool_name: 'Bash' }, cwd);
    assert.equal(result?.written, true, result?.error);

    const record = rows(cwd)[0]!;
    assert.equal(record.op, 'post-tool-use-failure');
    assert.equal(
      Object.hasOwn(record, 'sessionId'), false,
      'an absent session id is absent, never the string "undefined"',
    );
    assert.match(record.note ?? '', /Bash/);
  } finally { removeTree(cwd); }
});

test('the session id is recorded verbatim, never through the flattener the note uses', () => {
  const cwd = sandbox();
  try {
    // `mycontext audit --session <id>` matches on EQUALITY. The note's
    // helpers cap and collapse whitespace, which is right for prose a human
    // reads and wrong for an identifier: a capped id produces a row that
    // exists and cannot be found, which is a silent drop wearing the shape of
    // a record.
    const long = `sess-${'9'.repeat(300)}`;
    recordToolFailure({ session_id: long, cwd, tool_name: 'Write' }, cwd);
    assert.equal(rows(cwd)[0]!.sessionId, long);
  } finally { removeTree(cwd); }
});

test('a payload that never named its tool records the failure anyway, and says the name is missing', () => {
  const cwd = sandbox();
  try {
    recordToolFailure({ session_id: 's1', cwd, hook_event_name: 'PostToolUseFailure' }, cwd);
    const record = rows(cwd)[0]!;
    assert.match(record.note ?? '', /unknown tool/);
    assert.equal(
      (record.note ?? '').includes('undefined'), false,
      'a missing field is named, never stringified',
    );
  } finally { removeTree(cwd); }
});

// ---------------------------------------------------------------------------
// The reason: read defensively, because no probe established the field name.
// ---------------------------------------------------------------------------

test('a failure reason the payload supplies is flattened onto one line', () => {
  const cwd = sandbox();
  try {
    recordToolFailure(payload({
      session_id: 's1', cwd, tool_name: 'Write',
      error: 'EACCES: permission denied,\n  open /etc/hosts',
    }), cwd);

    const note = rows(cwd)[0]!.note ?? '';
    assert.match(note, /EACCES: permission denied, open \/etc\/hosts/);
    assert.equal(note.includes('\n'), false, 'a note is one line');
  } finally { removeTree(cwd); }
});

test('a reason nested under the tool response is found too', () => {
  const cwd = sandbox();
  try {
    recordToolFailure(payload({
      session_id: 's1', cwd, tool_name: 'Bash',
      tool_response: { error: 'command not found: mycontext' },
    }), cwd);

    assert.match(rows(cwd)[0]!.note ?? '', /command not found: mycontext/);
  } finally { removeTree(cwd); }
});

test('a long reason is capped, because the payload controls its length', () => {
  const cwd = sandbox();
  try {
    recordToolFailure(payload({
      session_id: 's1', cwd, tool_name: 'Write', error: 'x'.repeat(5000),
    }), cwd);

    const note = rows(cwd)[0]!.note ?? '';
    assert.ok(note.length < 400, `the note is ${note.length} chars — the cap did not apply`);
    assert.match(note, /\.\.\.$/, 'and the truncation is visible rather than silent');
  } finally { removeTree(cwd); }
});

test('a reason under a key no probe established is omitted rather than guessed at', () => {
  const cwd = sandbox();
  try {
    // The case most likely to be real: the event fires and names its reason
    // something this hook does not know. The row still lands — the failure is
    // what is being counted — and the note simply has no reason clause.
    recordToolFailure(payload({
      session_id: 's1', cwd, tool_name: 'Write', why_it_broke: 'disk on fire',
    }), cwd);

    const record = rows(cwd)[0]!;
    assert.equal(record.op, 'post-tool-use-failure', 'the row lands with or without a reason');
    assert.equal((record.note ?? '').includes('disk on fire'), false);
    assert.equal(record.note, 'Write failed');
  } finally { removeTree(cwd); }
});

test('a reason that is not a string is not stringified into the note', () => {
  const cwd = sandbox();
  try {
    recordToolFailure(payload({
      session_id: 's1', cwd, tool_name: 'Write', error: { code: 13, bytes: [1, 2, 3] },
    }), cwd);

    const note = rows(cwd)[0]!.note ?? '';
    assert.equal(note, 'Write failed', `an object reason leaked into the note: ${note}`);
  } finally { removeTree(cwd); }
});

// ---------------------------------------------------------------------------
// Failing open. Four routes to failing closed, each executed.
// ---------------------------------------------------------------------------

test('a payload that says nothing at all records nothing', () => {
  const cwd = sandbox();
  try {
    // `parseHookInput` returns `{}` for BOTH an unreadable payload and an
    // interactive run with no stdin, and neither is evidence that a tool
    // failed. A row written from `{}` would be an invented event — the exact
    // defect this log exists to make impossible.
    assert.equal(recordToolFailure({}, cwd), null);
    assert.equal(
      existsSync(auditLogPath(root(cwd))), false,
      'an empty payload wrote a row anyway',
    );
  } finally { removeTree(cwd); }
});

test('no workspace anywhere above the cwd: nothing recorded, nothing thrown', () => {
  const bare = mkdtempSync(path.join(tmpdir(), 'myctx-ptuf-bare-'));
  try {
    let result: unknown = 'not called';
    assert.doesNotThrow(() => {
      result = recordToolFailure({ session_id: 's1', cwd: bare, tool_name: 'Write' }, bare);
    });
    assert.equal(result, null);
    assert.equal(
      existsSync(path.join(bare, '.my_context')), false,
      'a hook must not create a workspace to record into',
    );
  } finally { removeTree(bare); }
});

test('a config.json that makes resolveWorkspace throw is caught, not propagated', () => {
  const cwd = sandbox();
  try {
    // `resolveWorkspace` THROWS on unparseable config — the one call in this
    // hook that can. Uncaught, it would leave the process on a throw path with
    // the tool call already failed and nothing recorded about either.
    writeFileSync(path.join(root(cwd), 'config.json'), '{ not json', 'utf8');
    let result: unknown = 'not called';
    assert.doesNotThrow(() => {
      result = recordToolFailure({ session_id: 's1', cwd, tool_name: 'Write' }, cwd);
    });
    assert.equal(result, null);
  } finally { removeTree(cwd); }
});

test('an unwritable audit log is disclosed on stderr and returned, never thrown', () => {
  const cwd = sandbox();
  try {
    // A FILE where `.audit/` has to be: `mkdirSync` then fails on every
    // platform. Same simulation as `test/core/audit.test.ts`.
    writeFileSync(auditDir(root(cwd)), 'not a directory', 'utf8');

    const captured = capturingStderr(() => recordToolFailure(
      { session_id: 's1', cwd, tool_name: 'Write' }, cwd,
    ));

    assert.equal(captured.value?.written, false, 'the write could not have succeeded');
    assert.equal(typeof captured.value?.error, 'string');
    // The log is the channel this hook normally discloses on, and it is the
    // channel that just failed — so the failure goes to the only other one.
    assert.match(
      captured.stderr,
      /my_context: the PostToolUseFailure audit record could not be written/,
    );
    assert.match(captured.stderr, /post-tool-use-failure/, 'and names what to look for');
  } finally { removeTree(cwd); }
});

test('a second failure appends rather than disturbing the first', () => {
  const cwd = sandbox();
  try {
    recordToolFailure({ session_id: 's1', cwd, tool_name: 'Write' }, cwd);
    recordToolFailure({ session_id: 's1', cwd, tool_name: 'Edit' }, cwd);
    const notes = rows(cwd).map((r) => r.note);
    assert.deepEqual(notes, ['Write failed', 'Edit failed'], 'append-only, in order');
  } finally { removeTree(cwd); }
});
