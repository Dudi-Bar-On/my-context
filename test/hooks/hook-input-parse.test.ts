/**
 * `parseHookInput` and the disclosure it makes possible.
 *
 * The defect these tests pin: the old `parseHookInput` swallowed every
 * failure and returned `{}`, and `{}` looks almost exactly like a real
 * payload downstream. `session-start.ts` falls back to `process.cwd()`, which
 * is usually the right directory — so the workspace resolves, the corpus
 * loads, and the pinned tier injects normally. Only `source` and `session_id`
 * are lost, and losing them silently costs three measured things: `source:
 * 'compact'` never arrives so a compaction restores nothing, `session_id`
 * never arrives so `buildJitOutput` returns '' for every tool call, and
 * PreCompact has no session to key on so no snapshot is written. The result
 * is a plausible, complete-looking injection that discloses nothing, which is
 * strictly worse than a visibly broken one.
 *
 * The regression guard that matters MOST here is the empty-stdin case.
 * `readStdin` documents '' as the answer for an interactive run with no stdin
 * at all, so '' must stay silent on every channel. A fix that makes every
 * interactive run print a warning is a worse bug than the one being fixed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readAudit } from '../../src/core/audit.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { hookContext, hookParseErrorLine, parseHookInput, preToolUseContext } from '../../src/hooks/io.ts';
import { buildOutput } from '../../src/hooks/post-tool-use.ts';
import { buildSessionStartOutput } from '../../src/hooks/session-start.ts';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

function sandbox(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-parse-'));
}

function pin(cwd: string, id: string, title: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'constraint', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: constraint
title: ${title}
status: active
severity: hard
always: true
---

# ${title}

Body text.
`);
}

// ---------------------------------------------------------------------------
// 1. A real payload is carried through unchanged.
// ---------------------------------------------------------------------------

test('a valid JSON object parses with no error and is carried through unchanged', () => {
  const payload = {
    session_id: 'sess-1',
    hook_event_name: 'SessionStart',
    source: 'compact',
    cwd: '/repo',
    transcript_path: '/tmp/t.jsonl',
    agent_id: 'a1',
    agent_type: 'general-purpose',
  };
  const parsed = parseHookInput(JSON.stringify(payload));
  assert.equal(parsed.parseError, null);
  assert.deepEqual(parsed.input, payload);
});

test('an empty JSON object is a successful parse, not a failure', () => {
  const parsed = parseHookInput('{}');
  assert.equal(parsed.parseError, null);
  assert.deepEqual(parsed.input, {});
});

// ---------------------------------------------------------------------------
// 2. THE REGRESSION GUARD. Empty stdin is not an error and must stay silent.
// ---------------------------------------------------------------------------

test('empty and whitespace-only stdin report NO error — an interactive run is not a failure', () => {
  for (const raw of ['', ' ', '\n', '\r\n', '\t  \n  ']) {
    const parsed = parseHookInput(raw);
    assert.equal(
      parsed.parseError, null,
      `${JSON.stringify(raw)} was reported as malformed; interactive runs would go noisy`,
    );
    assert.deepEqual(parsed.input, {});
  }
});

test('nothing at all is written for empty stdin — the stderr line is empty too', () => {
  assert.equal(hookParseErrorLine(parseHookInput('').parseError), '');
  assert.equal(hookParseErrorLine(parseHookInput('   \n').parseError), '');
});

// ---------------------------------------------------------------------------
// 3. Invalid JSON: an error, and callers keep working.
// ---------------------------------------------------------------------------

test('invalid JSON reports an error and still hands back a usable empty input', () => {
  for (const raw of ['{ not json', 'not json at all {{{   ]]', '{"a":', '<html>']) {
    const parsed = parseHookInput(raw);
    assert.notEqual(parsed.parseError, null, `${JSON.stringify(raw)} passed as valid`);
    assert.match(String(parsed.parseError), /not valid JSON/);
    // Callers destructure `.input` and read optional fields off it. It must
    // stay a plain empty object so every one of them keeps working.
    assert.deepEqual(parsed.input, {}, JSON.stringify(raw));
  }
});

/**
 * The reason is always ONE line, whatever the payload contained.
 *
 * `JSON.parse`'s message quotes the offending input verbatim — `Unexpected
 * token 'o', "not json at all {{{\n" is not valid JSON` — so a payload with a
 * trailing newline, which is exactly what a real pipe delivers, used to drag
 * that newline into the disclosure and split a one-line stderr note across
 * two lines. Caught against the real binary, so it is pinned here against the
 * realistic input rather than the convenient one.
 */
test('the reason stays one line even when the payload carries newlines', () => {
  for (const raw of [
    'not json at all {{{\n',
    '{ not json\r\n',
    'line one\nline two\nline three\n',
    '\t{ "a":\n\n  broken\n',
  ]) {
    const reason = String(parseHookInput(raw).parseError);
    assert.equal(
      /[\r\n]/.test(reason), false,
      `the reason spans lines: ${JSON.stringify(reason)}`,
    );
    const line = hookParseErrorLine(parseHookInput(raw).parseError);
    assert.equal(
      line.trimEnd().includes('\n'), false,
      `the stderr disclosure spans lines: ${JSON.stringify(line)}`,
    );
  }
});

test('a pathologically long payload cannot make the disclosure unreadable', () => {
  const reason = String(parseHookInput(`{${'x'.repeat(50_000)}`).parseError);
  assert.ok(reason.length <= 240, `the reason is ${reason.length} characters long`);
});

// ---------------------------------------------------------------------------
// 4. Valid JSON of the wrong shape: a DIFFERENT, distinguishable error.
// ---------------------------------------------------------------------------

test('valid JSON that is not a plain object is an error, distinguishable from bad syntax', () => {
  for (const raw of ['[]', '[1,2]', 'null', '42', '"a string"', 'true']) {
    const parsed = parseHookInput(raw);
    assert.notEqual(parsed.parseError, null, `${raw} passed as an object`);
    const message = String(parsed.parseError);
    // The two causes are different — a truncated pipe versus a caller sending
    // the wrong shape — so the messages must not be interchangeable.
    assert.match(message, /valid JSON but/, raw);
    assert.doesNotMatch(message, /not valid JSON/, raw);
    assert.deepEqual(parsed.input, {}, raw);
  }
});

test('the wrong-shape message names the shape it actually got', () => {
  assert.match(String(parseHookInput('[]').parseError), /an array/);
  assert.match(String(parseHookInput('null').parseError), /null/);
  assert.match(String(parseHookInput('42').parseError), /a number/);
  assert.match(String(parseHookInput('"s"').parseError), /a string/);
  assert.match(String(parseHookInput('true').parseError), /a boolean/);
});

// ---------------------------------------------------------------------------
// 5. The stderr line: one line, prefixed, naming what was lost.
// ---------------------------------------------------------------------------

test('the stderr line names the lost fields and the three features they cost', () => {
  const line = hookParseErrorLine(parseHookInput('{ not json').parseError);
  assert.ok(line.startsWith('my_context: '), line);
  assert.equal(line.endsWith('\n'), true);
  assert.equal(line.trimEnd().includes('\n'), false, 'the disclosure must be ONE line');
  assert.match(line, /source/);
  assert.match(line, /session_id/);
  assert.match(line, /compaction restore/);
  assert.match(line, /JIT/);
  assert.match(line, /snapshot/);
  // The reason is carried, not just the consequence.
  assert.match(line, /not valid JSON/);
  // INV-hooks-fail-open, said out loud: a user reading this mid-task needs to
  // know their tool call was not blocked.
  assert.match(line, /failed open/);
});

// ---------------------------------------------------------------------------
// 6. session-start: the injected block still arrives, AND it discloses.
// ---------------------------------------------------------------------------

test('a malformed payload still injects the pinned tier and says the payload was unreadable', () => {
  const cwd = sandbox();
  try {
    runCli(['init'], cwd, () => {});
    pin(cwd, 'CONST-pool', 'Pool capped at 20');

    // Newline-terminated, because that is what a real pipe delivers.
    const { input, parseError } = parseHookInput('not json at all {{{   ]]\n');
    assert.notEqual(parseError, null, 'premise: the payload really is malformed');

    // Exactly what the hook's entry guard does: fall back to the process cwd
    // and thread the reason through.
    const out = buildSessionStartOutput(input.cwd ?? cwd, {
      source: input.source,
      sessionId: input.session_id,
      parseError,
    });

    // The normal injection is untouched — the disclosure is added, never
    // substituted for the context the session needs.
    assert.match(out, /CONST-pool/);
    assert.match(out, /Pool capped at 20/);

    // And the block says so, in the channel the model actually reads.
    assert.match(out, /my_context: the SessionStart hook payload could not be read/);
    assert.match(out, /source/);
    assert.match(out, /session_id/);
    assert.match(out, /compaction restore cannot fire/);
    assert.match(out, /just-in-time/);
    assert.match(out, /not valid JSON/);

    // The note is a single paragraph, not a sentence split by whatever the
    // payload happened to contain.
    const note = out.split('\n').find((l) => l.includes('could not be read'));
    assert.ok(note, 'the disclosure is not on a line of its own');
    assert.ok(note.endsWith('_'), `the note is torn across lines: ${JSON.stringify(note)}`);
  } finally { removeTree(cwd); }
});

test('a wrong-shape payload discloses its own reason, not the syntax one', () => {
  const cwd = sandbox();
  try {
    runCli(['init'], cwd, () => {});
    pin(cwd, 'CONST-pool', 'Pool capped at 20');
    const { parseError } = parseHookInput('[]');
    const out = buildSessionStartOutput(cwd, { parseError });
    assert.match(out, /could not be read/);
    assert.match(out, /valid JSON but an array/);
  } finally { removeTree(cwd); }
});

// ---------------------------------------------------------------------------
// 7. The other half of the guard: a GOOD payload discloses nothing.
// ---------------------------------------------------------------------------

test('a valid payload injects with no disclosure anywhere in the block', () => {
  const cwd = sandbox();
  try {
    runCli(['init'], cwd, () => {});
    pin(cwd, 'CONST-pool', 'Pool capped at 20');

    const { input, parseError } = parseHookInput(JSON.stringify({
      session_id: 'sess-ok', hook_event_name: 'SessionStart', source: 'startup', cwd,
    }));
    assert.equal(parseError, null);

    const out = buildSessionStartOutput(input.cwd ?? cwd, {
      source: input.source,
      sessionId: input.session_id,
      parseError,
    });

    assert.match(out, /CONST-pool/);
    assert.doesNotMatch(out, /could not be read/);
    assert.doesNotMatch(out, /payload/);
    assert.doesNotMatch(out, /session_id/);
  } finally { removeTree(cwd); }
});

/**
 * The empty-stdin case end to end, not just at the parser. An interactive
 * `node session-start.ts` with no payload must produce the same injected text
 * it always did, with nothing added.
 */
test('empty stdin injects exactly what a session start injected before, byte for byte', () => {
  const cwd = sandbox();
  try {
    runCli(['init'], cwd, () => {});
    pin(cwd, 'CONST-pool', 'Pool capped at 20');

    const { input, parseError } = parseHookInput('');
    const withEmptyStdin = buildSessionStartOutput(input.cwd ?? cwd, {
      source: input.source,
      sessionId: input.session_id,
      parseError,
    });
    assert.equal(withEmptyStdin, buildSessionStartOutput(cwd));
    assert.notEqual(withEmptyStdin, '');
  } finally { removeTree(cwd); }
});

/**
 * The audit trail carries the same fact, inside the EXISTING `session-start`
 * op — `AUDIT_OPS` is a closed vocabulary and `parseAudit` refuses a whole
 * segment on an unknown op, so a new op would be a separate, larger decision.
 * Without this the log shows a `session-start` with no `source=` at all,
 * which reads as "SessionStart sent none" rather than "the payload was
 * garbage".
 */
test('the audit note records the unreadable payload under the existing session-start op', () => {
  const cwd = sandbox();
  try {
    runCli(['init'], cwd, () => {});
    pin(cwd, 'CONST-pool', 'Pool capped at 20');
    const out = buildSessionStartOutput(cwd, { parseError: parseHookInput('[]').parseError });
    assert.notEqual(out, '', 'nothing was injected, so this case proves nothing');

    const root = resolveWorkspace(cwd).projectRoot!;
    const record = readAudit(root).find((r) => r.kind === 'injection' && r.op === 'session-start');
    assert.ok(record, 'SessionStart recorded no injection');
    assert.match(String(record.note), /hook payload unreadable/);
    assert.match(String(record.note), /valid JSON but an array/);
    // No new `op` was invented: `AUDIT_OPS` is closed and `parseAudit`
    // refuses the whole segment on an unknown one.
    assert.equal(record.op, 'session-start');
  } finally { removeTree(cwd); }
});

// ---------------------------------------------------------------------------
// 8. One envelope builder (plan Task 5).
//
// Two hand-rolled copies of the same JSON shape existed before this: this
// module's `preToolUseContext` and `post-tool-use.ts`'s `buildOutput`. They
// differ in exactly one character sequence — the event name — and that is the
// field with no failure mode: Claude Code does not reject an envelope stamped
// with the wrong `hookEventName`, it simply never delivers the context. A
// second copy is therefore a second chance to write a name that is silently
// wrong, which is why there is now one builder and the copies delegate.
// ---------------------------------------------------------------------------

test('hookContext builds the envelope each event needs', () => {
  assert.deepEqual(JSON.parse(hookContext('SubagentStart', 'hello')), {
    hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: 'hello' },
  });
  assert.deepEqual(JSON.parse(hookContext('PostToolUse', 'hello')), {
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 'hello' },
  });
  assert.deepEqual(JSON.parse(hookContext('PreToolUse', 'hello')), {
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: 'hello' },
  });
});

/**
 * Each event gets its OWN name. Asserted over all three at once because the
 * mutation that matters is a builder that ignores its argument and stamps one
 * constant — every single-event assertion above still passes for whichever
 * constant it happens to have picked.
 */
test('hookContext stamps the event it was given, never a fixed one', () => {
  const stamped = (['PreToolUse', 'PostToolUse', 'SubagentStart'] as const).map((event) =>
    (JSON.parse(hookContext(event, 't')) as {
      hookSpecificOutput: { hookEventName: string };
    }).hookSpecificOutput.hookEventName);
  assert.deepEqual(stamped, ['PreToolUse', 'PostToolUse', 'SubagentStart']);
});

/**
 * `preToolUseContext` survives as a one-line wrapper so its two call sites in
 * `pre-tool-use.ts` and their tests do not move in this task. The assertion is
 * that the wrapper changed nothing on the wire: same keys, same order, same
 * bytes as the literal it replaced.
 */
test('preToolUseContext is the shared envelope, byte for byte what it emitted before', () => {
  assert.equal(hookContext('PreToolUse', 'x'), preToolUseContext('x'));
  assert.equal(
    preToolUseContext('x'),
    '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"x"}}',
  );
});

/**
 * `post-tool-use.ts` delegates to the same builder and keeps the one thing the
 * builder deliberately does not do: '' in, '' out. Nearly every edit in a
 * session is one this hook has no opinion on, so without that guard the model
 * would be handed an envelope carrying an empty `additionalContext` on almost
 * every write — a hook that speaks constantly and says nothing.
 */
test('post-tool-use emits the shared envelope and still says nothing about nothing', () => {
  assert.equal(buildOutput('note'), hookContext('PostToolUse', 'note'));
  assert.equal(buildOutput(''), '');
});

/**
 * ONE stdin reader of each kind, and the structural guard that keeps it that
 * way. The duplication this task removes was not introduced by carelessness —
 * `post-tool-use.ts` needed an async read that `io.ts` did not offer, so it
 * grew its own, and the next hook that needs one would have done the same.
 *
 * `readStdinAsync` itself is exercised over REAL stdio in
 * `test/hooks/hook-binaries-e2e.test.ts`, never here. Measured, not reasoned
 * about: a `node --test` file that awaits it never finishes — the pending
 * 'data'/'end' listeners are themselves a ref on the event loop and the
 * runner's stdin does not end, so the file hangs until something outside kills
 * it. Racing it against an unref'd timer does not help; the assertion passes
 * and the file stays hung.
 */
test('src/hooks reads stdin in exactly two places, both of them io.ts', () => {
  const dir = path.join(import.meta.dirname, '../../src/hooks');
  // Comments are stripped first, and that is not a detail: three of these
  // files DISCUSS both readers by name — `post-tool-use-failure.ts` explains
  // why synchronous is right for it, `post-tool-use.ts` why it is wrong for
  // itself — and a check that could not tell a sentence from a call would
  // either fail on prose or be quietly weakened until it matched nothing.
  const code = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//gu, ' ').replace(/(^|[^:])\/\/[^\n]*/gu, '$1');
  const offenders: string[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.ts') || name === 'io.ts') continue;
    const source = code(readFileSync(path.join(dir, name), 'utf8'));
    if (/process\.stdin\b/u.test(source)) offenders.push(`${name}: process.stdin`);
    if (/readFileSync\(\s*0\b/u.test(source)) offenders.push(`${name}: readFileSync(0)`);
  }
  assert.deepEqual(offenders, [], `a second stdin reader grew back: ${offenders.join(', ')}`);
});

// ---------------------------------------------------------------------------
// 9. `prompt_id` — declared, and the three fields beside it that are not.
// ---------------------------------------------------------------------------

/**
 * Measured present on `PreToolUse`, `SubagentStart` and `SubagentStop` on
 * Claude Code 2.1.234 (plan §"Measured facts, from the probes", item 6).
 * `permission_mode`, `effort` and `tool_use_id` were measured on the same
 * payloads and are deliberately NOT declared: nothing in the product reads
 * them, and a declared field nothing reads is a claim about the payload that
 * no test can hold up.
 */
test('prompt_id survives parseHookInput', () => {
  assert.equal(parseHookInput('{"prompt_id":"p1"}').input.prompt_id, 'p1');
});

test('a payload carrying prompt_id is still an ordinary successful parse', () => {
  const parsed = parseHookInput(JSON.stringify({
    session_id: 'sess-p', hook_event_name: 'PreToolUse', prompt_id: 'p-42', cwd: '/repo',
  }));
  assert.equal(parsed.parseError, null);
  assert.equal(parsed.input.prompt_id, 'p-42');
  assert.equal(hookParseErrorLine(parsed.parseError), '');
});
