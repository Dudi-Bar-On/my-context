import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { buildJitOutput, runPreToolUse } from '../../src/hooks/pre-tool-use.ts';
import { runCli } from '../../src/cli/index.ts';
import { readAudit } from '../../src/core/audit.ts';
import { Ledger } from '../../src/core/ledger.ts';
import { readSeen, seenFilePath, seenIds } from '../../src/core/seen-file.ts';
import { Store } from '../../src/core/store.ts';
import { DEFAULT_BUDGETS } from '../../src/core/config.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-jit-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function addItem(cwd: string, id: string, type: string, scope: string[], body: string): void {
  const file = path.join(cwd, '.my_context', 'items', type, `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  const scopeBlock = scope.length
    ? `scope:\n${scope.map((s) => `  - "${s}"`).join('\n')}\n`
    : 'scope: []\n';
  writeFileSync(file, `---
id: ${id}
type: ${type}
title: ${id} title
status: active
severity: hard
always: false
${scopeBlock}---

# ${id} title

${body}
`);
}

/** Index the workspace the way SessionStart would, so the JIT hook can read it. */
function index(cwd: string): void {
  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  rebuild(store, { project: ws.projectRoot ?? undefined }, ws.config);
  store.close();
}

function toolInput(
  cwd: string, sessionId: string, filePath: string, tool = 'Read', agentId?: string,
): string {
  return JSON.stringify({
    session_id: sessionId,
    hook_event_name: 'PreToolUse',
    cwd,
    tool_name: tool,
    tool_input: { file_path: filePath },
    ...(agentId === undefined ? {} : { agent_id: agentId, agent_type: 'general-purpose' }),
  });
}

function context(raw: string): string {
  const parsed = JSON.parse(raw) as {
    hookSpecificOutput: { additionalContext?: string };
  };
  return parsed.hookSpecificOutput.additionalContext ?? '';
}

test('reading a file in scope injects the matching item once', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);

  const out = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);
  const text = context(out);
  assert.match(text, /CONST-pool/);
  assert.match(text, /Pool capped at 20\./);
  // Pins the invariant `buildJitOutput` relies on when it hands the whole
  // Selection to renderSelection: a tool event's IndexSummary is always
  // empty, so no "## my_context index" block is emitted here.
  assert.doesNotMatch(text, /my_context index/);

  removeTree(cwd);
});

test('the second read in the same session injects nothing', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);

  const first = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);
  assert.match(context(first), /CONST-pool/);

  const second = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/reader.ts')), cwd);
  assert.equal(second, '');

  removeTree(cwd);
});

test('dedupe is per-item, not per-session: a second, distinct item still arrives', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  addItem(cwd, 'CONST-api', 'constraint', ['src/api/**'], 'Rate limited to 100/min.');
  index(cwd);

  const first = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);
  assert.match(context(first), /CONST-pool/);

  // Same session, different item, different scope: this must still inject —
  // an implementation that merely recorded "this session was already served"
  // (rather than deduping per item id) would wrongly suppress it.
  const second = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/api/handler.ts')), cwd);
  const text = context(second);
  assert.match(text, /CONST-api/);
  assert.doesNotMatch(text, /CONST-pool/);

  removeTree(cwd);
});

test('a different session gets its own first injection', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);

  runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);
  const other = runPreToolUse(toolInput(cwd, 's2', path.join(cwd, 'src/db/writer.ts')), cwd);
  assert.match(context(other), /CONST-pool/);

  removeTree(cwd);
});

/**
 * Measured, not assumed (ROADMAP E2): a probe hook under a real `claude -p`
 * run whose prompt dispatched a Task subagent logged the subagent's Write
 * arriving with the PARENT's `session_id` and an `agent_id` field as the only
 * discriminator — and no SessionStart fired for the subagent at all. A
 * subagent starts with an empty context window, so an item the parent already
 * received does not exist for it; deduping both under the bare session id
 * gave the subagent nothing while the ledger claimed delivery.
 */
test('a subagent is its own dedupe scope: the parent having seen an item does not starve it', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);

  // The parent session receives the item first.
  const parent = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);
  assert.match(context(parent), /CONST-pool/);

  // A subagent's tool call carries the same session_id plus agent_id. Its
  // context window contains none of what the parent was injected with, so the
  // item must arrive again.
  const sub = runPreToolUse(
    toolInput(cwd, 's1', path.join(cwd, 'src/db/reader.ts'), 'Read', 'agent-a'), cwd);
  assert.match(context(sub), /CONST-pool/);

  // Within the same subagent, dedupe applies as usual.
  const subAgain = runPreToolUse(
    toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts'), 'Read', 'agent-a'), cwd);
  assert.equal(subAgain, '');

  // A second, distinct subagent is a third context window: it gets its own copy.
  const other = runPreToolUse(
    toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts'), 'Read', 'agent-b'), cwd);
  assert.match(context(other), /CONST-pool/);

  removeTree(cwd);
});

test('a subagent delivery does not mark the parent as seen, and is keyed separately', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);

  // The subagent touches the path first: recording that under the bare
  // session id would silently drop the parent's own first injection.
  const sub = runPreToolUse(
    toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts'), 'Read', 'agent-a'), cwd);
  assert.match(context(sub), /CONST-pool/);

  const parent = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);
  assert.match(context(parent), /CONST-pool/);

  // The records are keyed apart — one seen file per context window — so the
  // PreCompact snapshot, which reads the bare session id, captures the
  // parent's context and only that.
  const ws = resolveWorkspace(cwd);
  assert.deepEqual(seenIds(readSeen(ws.projectRoot!, 's1')), ['CONST-pool']);
  assert.deepEqual(seenIds(readSeen(ws.projectRoot!, 's1::agent-a')), ['CONST-pool']);

  removeTree(cwd);
});

test('the injection is recorded in the seen file under the jit tier', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);
  runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);

  const ws = resolveWorkspace(cwd);
  const state = readSeen(ws.projectRoot!, 's1');
  assert.equal(state.error, null);
  assert.deepEqual(state.lines.map((l) => [l.id, l.tier]), [['CONST-pool', 'jit']]);

  removeTree(cwd);
});

test('an overlong session id cannot fold the parent and subagent dedupe scopes together', () => {
  // The exact failure E2 was fixed to eliminate, reachable again through the
  // old sanitizer's 128-char truncation: a session id past the cap made the
  // bare parent key and every `::agent` composite share one seen file, so a
  // subagent's fresh context window had its FIRST injection suppressed — a
  // per-window miss. Pinned at the hook level so no filename scheme can
  // reintroduce it.
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);

  const long = `sess-${'x'.repeat(150)}`;
  const parent = runPreToolUse(toolInput(cwd, long, path.join(cwd, 'src/db/writer.ts')), cwd);
  assert.match(context(parent), /CONST-pool/);
  const sub = runPreToolUse(
    toolInput(cwd, long, path.join(cwd, 'src/db/writer.ts'), 'Read', 'agent-7'), cwd);
  assert.match(context(sub), /CONST-pool/);

  removeTree(cwd);
});

test('a file outside every scope injects nothing', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);
  assert.equal(runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'docs/readme.md')), cwd), '');
  removeTree(cwd);
});

test('a file outside the repository injects nothing', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-any', 'constraint', ['**'], 'Applies everywhere.');
  index(cwd);
  const outside = path.join(tmpdir(), 'elsewhere', 'file.ts');
  assert.equal(runPreToolUse(toolInput(cwd, 's1', outside), cwd), '');
  removeTree(cwd);
});

test('a cross-drive path injects nothing rather than matching by accident', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-any', 'constraint', ['**'], 'Applies everywhere.');
  index(cwd);
  const spelling = path.parse(cwd).root.startsWith('Z') ? 'Y:\\other\\file.ts' : 'Z:\\other\\file.ts';
  if (process.platform === 'win32') {
    // path.relative(repoRoot, target) returns an ABSOLUTE path (not
    // '..'-prefixed) when the two paths resolve to different drive roots — an
    // absolute string that neither the empty check nor a '..' prefix check
    // would catch. A drive letter unrelated to the sandbox's own drive forces
    // exactly that path through path.relative without needing the drive to
    // actually exist (path.relative/path.resolve are purely syntactic).
    assert.equal(runPreToolUse(toolInput(cwd, 's1', spelling), cwd), '');
  } else {
    // There is no cross-drive case on POSIX: `Z:\other\file.ts` is an
    // ordinary RELATIVE filename (`:` and `\` are legal name characters), so
    // it resolves to a child of the repo and a `**` scope matches it. That is
    // the correct reading of the string on this platform, not a bypass —
    // asserted so the divergence is pinned rather than skipped over, and so a
    // change that starts parsing drive letters on POSIX shows up here.
    assert.match(runPreToolUse(toolInput(cwd, 's1', spelling), cwd), /CONST-any/);
  }
  removeTree(cwd);
});

/**
 * End-to-end through the real hook, because `select`'s rule is not the only
 * place this lived: the hook pre-filters the corpus in SQL, and that filter
 * used to be `has_scope = 1`. With the selector inverted but the SQL left
 * alone, `select` would never see an unscoped row and the whole change would
 * be a no-op in production while the unit tests went green. Two unrelated
 * paths, so a stray glob cannot make this pass by accident.
 */
test('an unscoped item activates on every path — scope restricts, it does not enable', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-unrestricted', 'constraint', [], 'Applies everywhere.');
  index(cwd);
  for (const target of ['src/db/writer.ts', 'docs/unrelated/notes.md']) {
    const out = runPreToolUse(toolInput(cwd, `s-${target}`, path.join(cwd, target)), cwd);
    assert.match(out, /CONST-unrestricted/, `expected an injection on ${target}`);
  }
  removeTree(cwd);
});

test('a scoped item is still restricted to its globs through the hook', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-db', 'constraint', ['src/db/**'], 'Only the db layer.');
  index(cwd);
  assert.equal(runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'docs/notes.md')), cwd), '');
  removeTree(cwd);
});

test('a rationale item never activates however well it matches', () => {
  const cwd = sandbox();
  addItem(cwd, 'LESSON-db', 'lesson', ['src/db/**'], 'Migrations need locks.');
  index(cwd);
  assert.equal(runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd), '');
  removeTree(cwd);
});

test('a write to .my_context is denied and injects nothing', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-any', 'constraint', ['**'], 'Applies everywhere.');
  index(cwd);

  const out = runPreToolUse(
    toolInput(cwd, 's1', path.join(cwd, '.my_context/items/rule/RULE-x.md'), 'Write'), cwd);
  const parsed = JSON.parse(out) as {
    hookSpecificOutput: { permissionDecision?: string; additionalContext?: string };
  };
  assert.equal(parsed.hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(parsed.hookSpecificOutput.additionalContext, undefined);

  removeTree(cwd);
});

test('an unindexed workspace injects FROM MARKDOWN rather than missing or throwing', () => {
  // This used to pin '' — the disclosed-miss outcome of a workspace whose
  // index never existed. The never-miss design (C) removed exactly that: a
  // reader cannot create the index, so the fallback serves the corpus with
  // no special case, disclosed inline.
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Never indexed.');
  const out = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);
  const text = context(out);
  assert.match(text, /Never indexed\./);
  assert.match(text, /served from Markdown; the index was unavailable/);
  removeTree(cwd);
});

test('a corrupt config yields empty output rather than a throw', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);
  writeFileSync(path.join(cwd, '.my_context', 'config.json'), '{ not json');
  assert.equal(runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd), '');
  removeTree(cwd);
});

test('a missing session id injects nothing — there would be nowhere to dedupe', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);
  const raw = JSON.stringify({
    cwd, tool_name: 'Read', tool_input: { file_path: path.join(cwd, 'src/db/writer.ts') },
  });
  assert.equal(runPreToolUse(raw, cwd), '');
  removeTree(cwd);
});

test('a seen-file append failure does not discard the already-rendered injection', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);

  // A DIRECTORY squatting on the seen file's own path makes both the read
  // and the append fail unconditionally — the successor to the retired
  // "recordMany throws" simulation. The render has already happened by the
  // time the append can fail, and the injection must still be returned:
  // a failed dedupe record costs a future duplicate, never this delivery.
  const ws = resolveWorkspace(cwd);
  mkdirSync(seenFilePath(ws.projectRoot!, 's1'), { recursive: true });
  const out = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);
  assert.match(context(out), /CONST-pool/);
  assert.match(context(out), /Pool capped at 20\./);

  removeTree(cwd);
});

test('a spilled item is not recorded as seen, so it can still arrive later', () => {
  const cwd = sandbox();
  // Derived from the budget rather than typed: a literal sized to one
  // particular `jit` value stops exercising the spill path the moment the
  // default moves, and does so silently — the item simply fits.
  const big = 'x'.repeat((DEFAULT_BUDGETS.jit + 100) * 4);
  addItem(cwd, 'CONST-huge', 'constraint', ['src/db/**'], big);
  index(cwd);

  const out = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);
  assert.match(context(out), /omitted/i);

  const ws = resolveWorkspace(cwd);
  const state = readSeen(ws.projectRoot!, 's1');
  assert.equal(state.error, null);
  assert.deepEqual(state.lines, []);

  removeTree(cwd);
});

test('JIT dedupe survives with no ledger: the seen file is the dedupe state', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);

  const first = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);
  assert.match(context(first), /CONST-pool/);
  const second = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/reader.ts')), cwd);
  assert.equal(second, '');

  // The dedupe state is the seen FILE, not the database:
  const ws = resolveWorkspace(cwd);
  const state = readSeen(ws.projectRoot!, 's1');
  assert.equal(state.error, null);
  assert.deepEqual(seenIds(state), ['CONST-pool']);

  removeTree(cwd);
});

test('an unreadable seen file injects WITHOUT dedupe and discloses in the audit note', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);
  const ws = resolveWorkspace(cwd);

  const first = runPreToolUse(toolInput(cwd, 's2', path.join(cwd, 'src/db/writer.ts')), cwd);
  assert.match(context(first), /CONST-pool/);

  // Corrupt a MIDDLE line (a torn tail would be healed, not refused):
  const file = seenFilePath(ws.projectRoot!, 's2');
  writeFileSync(file, 'garbage line\n' + readFileSync(file, 'utf8'), 'utf8');

  // Re-injection, not suppression — the accepted failure direction:
  const again = runPreToolUse(toolInput(cwd, 's2', path.join(cwd, 'src/db/writer.ts')), cwd);
  assert.match(context(again), /CONST-pool/);
  const note = readAudit(ws.projectRoot!)
    .filter((r) => r.op === 'jit' && r.sessionId === 's2')
    .at(-1)?.note ?? '';
  assert.match(note, /seen file unreadable; injected without dedupe/);

  removeTree(cwd);
});

test('the JIT hook writes nothing to the index database', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);
  const ws = resolveWorkspace(cwd);
  const before = statSync(ws.dbPath).mtimeMs;

  const out = runPreToolUse(toolInput(cwd, 's3', path.join(cwd, 'src/db/writer.ts')), cwd);
  assert.match(context(out), /CONST-pool/);

  // Ledger.open would run its DDL and recordMany would insert — both write.
  // The mtime is the cheap proxy, asserted BEFORE this test's own Ledger.open
  // below can checkpoint the WAL back into the file; the load-bearing
  // assertion is the ledger row count.
  assert.equal(statSync(ws.dbPath).mtimeMs, before);
  const ledger = Ledger.open(ws.dbPath);
  assert.deepEqual(ledger.seen('s3'), []);
  ledger.close();

  removeTree(cwd);
});

test('a held write lock costs the JIT hook milliseconds, not seconds', (t) => {
  const cwd = sandbox();
  t.after(() => removeTree(cwd));
  addItem(cwd, 'CONST-lock', 'constraint', ['src/**'], 'Survives a held write lock.');
  index(cwd);
  const ws = resolveWorkspace(cwd);

  const holder = new DatabaseSync(ws.dbPath);
  holder.exec('BEGIN IMMEDIATE');
  t.after(() => { try { holder.exec('ROLLBACK'); } catch { /* done */ } holder.close(); });

  const input = {
    session_id: 'sess-lock', tool_name: 'Read',
    tool_input: { file_path: 'src/app.ts' }, cwd,
  };
  const started = performance.now();
  const output = buildJitOutput(input, cwd, 'src/app.ts');
  const elapsed = performance.now() - started;
  assert.match(output, /Survives a held write lock\./, 'the held lock cost the injection itself');
  // Generous CI bound; the measured p95 is 1.72 ms contended [P6]. The point
  // pinned here is the ORDER OF MAGNITUDE: before this task the same
  // scenario burned HOOK_OPEN_PROFILE's ~1.06 s (E4) or, pre-E4, 16.9 s.
  assert.ok(elapsed < 1000, `took ${elapsed}ms under a held write lock`);
});

test('no index file at all: JIT serves from Markdown and DISCLOSES', (t) => {
  const cwd = sandbox();
  t.after(() => removeTree(cwd));
  addItem(cwd, 'CONST-nofile', 'constraint', ['src/**'], 'Served without an index.');
  const ws = resolveWorkspace(cwd);
  rmSync(ws.dbPath, { force: true });
  rmSync(`${ws.dbPath}-wal`, { force: true });
  rmSync(`${ws.dbPath}-shm`, { force: true });

  const input = {
    session_id: 'sess-nofile', tool_name: 'Read',
    tool_input: { file_path: 'src/app.ts' }, cwd,
  };
  const output = buildJitOutput(input, cwd, 'src/app.ts');
  assert.match(output, /Served without an index\./);
  assert.match(output, /served from Markdown; the index was unavailable/);
  const note = readAudit(ws.projectRoot!)
    .filter((r) => r.op === 'jit' && r.sessionId === 'sess-nofile').at(-1)?.note ?? '';
  assert.match(note, /markdown fallback/);
});

test('a corrupt index file: fallback fires and the file is NOT deleted by the hook', (t) => {
  const cwd = sandbox();
  t.after(() => removeTree(cwd));
  addItem(cwd, 'CONST-corrupt', 'constraint', ['src/**'], 'Survives index corruption.');
  const ws = resolveWorkspace(cwd);
  writeFileSync(ws.dbPath, 'garbage, not a database', 'utf8');

  const input = {
    session_id: 'sess-corrupt', tool_name: 'Read',
    tool_input: { file_path: 'src/app.ts' }, cwd,
  };
  const output = buildJitOutput(input, cwd, 'src/app.ts');
  assert.match(output, /Survives index corruption\./);
  // The self-heal stays on the WRITER path (store.ts): a hook must never
  // delete a database it cannot distinguish from a mid-write moment.
  assert.equal(readFileSync(ws.dbPath, 'utf8'), 'garbage, not a database');
});

test('the fallback dedupes against the seen file exactly like the primary path', (t) => {
  const cwd = sandbox();
  t.after(() => removeTree(cwd));
  addItem(cwd, 'CONST-once', 'constraint', ['src/**'], 'Once per session.');
  const ws = resolveWorkspace(cwd);
  rmSync(ws.dbPath, { force: true });

  const first = runPreToolUse(toolInput(cwd, 'sess-fb-dedupe', path.join(cwd, 'src/app.ts')), cwd);
  assert.match(context(first), /CONST-once/);
  // Re-created by the first call's readOnly open? No — a reader never
  // creates. The second call must dedupe via the seen file, not re-inject.
  const second = runPreToolUse(toolInput(cwd, 'sess-fb-dedupe', path.join(cwd, 'src/other.ts')), cwd);
  assert.equal(second, '');
});

test('a healthy index serves WITHOUT the fallback note — the fallback claim must never appear on the primary path', (t) => {
  // Direct pin, in this file, of the "always-fallback-on-healthy" mutant the
  // review found was killed only incidentally by a README-example test: a
  // hook that claimed fallback mode on every call would make the disclosure
  // meaningless noise, and only the doc test noticed.
  const cwd = sandbox();
  t.after(() => removeTree(cwd));
  addItem(cwd, 'CONST-healthy', 'constraint', ['src/**'], 'Served from the index.');
  index(cwd);
  const ws = resolveWorkspace(cwd);

  const out = runPreToolUse(toolInput(cwd, 'sess-healthy', path.join(cwd, 'src/app.ts')), cwd);
  const text = context(out);
  assert.match(text, /Served from the index\./);
  assert.doesNotMatch(text, /served from Markdown/);
  const note = readAudit(ws.projectRoot!)
    .filter((r) => r.op === 'jit' && r.sessionId === 'sess-healthy').at(-1)?.note ?? '';
  assert.doesNotMatch(note, /markdown fallback/);
});

test('a fallback that drops an unparseable item file DISCLOSES it inline and in the audit (review I-3)', (t) => {
  const cwd = sandbox();
  t.after(() => removeTree(cwd));
  addItem(cwd, 'CONST-good', 'constraint', ['src/**'], 'The healthy item.');
  const ws = resolveWorkspace(cwd);
  writeFileSync(
    path.join(ws.projectRoot!, 'items', 'constraint', 'CONST-broken.md'),
    'no frontmatter here\n', 'utf8',
  );
  rmSync(ws.dbPath, { force: true });

  const output = buildJitOutput(
    { session_id: 'sess-drop', tool_name: 'Read', tool_input: { file_path: 'src/app.ts' }, cwd },
    cwd, 'src/app.ts',
  );
  assert.match(output, /The healthy item\./);
  // The dropped file is named where the model reads it — the injected block,
  // not only the audit (INV-nothing-is-dropped-silently).
  assert.match(output, /could not be read/);
  assert.match(output, /CONST-broken\.md/);
  const note = readAudit(ws.projectRoot!)
    .filter((r) => r.op === 'jit' && r.sessionId === 'sess-drop').at(-1)?.note ?? '';
  assert.match(note, /1 item file\(s\) dropped/);
});

test('a fallback whose ONLY matching item failed to parse still speaks — silence would read as "no rules apply"', (t) => {
  const cwd = sandbox();
  t.after(() => removeTree(cwd));
  const ws = resolveWorkspace(cwd);
  mkdirSync(path.join(ws.projectRoot!, 'items', 'constraint'), { recursive: true });
  writeFileSync(
    path.join(ws.projectRoot!, 'items', 'constraint', 'CONST-broken.md'),
    'no frontmatter here\n', 'utf8',
  );
  rmSync(ws.dbPath, { force: true });

  const output = buildJitOutput(
    { session_id: 'sess-only-broken', tool_name: 'Read', tool_input: { file_path: 'src/app.ts' }, cwd },
    cwd, 'src/app.ts',
  );
  assert.notEqual(output, '', 'a dropped file with an empty selection is a potential MISS, not a true nothing');
  assert.match(output, /could not be read/);
});

test('an empty fallback selection stays silent — a disclosure with no content is noise', (t) => {
  const cwd = sandbox();
  t.after(() => removeTree(cwd));
  // No items at all: a fresh workspace with no index. `openReadOnlyChecked`
  // cannot create one, C serves it with no special case, and "nothing
  // applies" from the truth is a true nothing.
  const ws = resolveWorkspace(cwd);
  rmSync(ws.dbPath, { force: true });
  const output = buildJitOutput(
    { session_id: 'sess-empty', tool_name: 'Read', tool_input: { file_path: 'src/app.ts' }, cwd },
    cwd, 'src/app.ts',
  );
  assert.equal(output, '');
});

/* -------------------------------------------------------------------------- *
 * The workspace is the FILE'S, not the session's cwd.
 *
 * **This is the defect that cost a whole day of work on 2026-08-26, and it is
 * the one failure this product cannot survive.** A session was started with
 * `cwd` at the user's home directory and spent the day editing a governed
 * repository on another drive. `findProjectRoot` walks UP from `cwd`; from a
 * home directory it reaches the filesystem root and returns null, so BOTH
 * injection tiers took the same branch — `if (!ws.projectRoot) return ''` —
 * and the corpus reached the model exactly never.
 *
 * Nothing said so. Exit 0, empty stdout, no stderr, and no audit record,
 * because with no workspace there is nowhere to write one. The failure was
 * indistinguishable from success at every observable point, which is why it
 * survived a full day and was found by the owner asking a question rather than
 * by any check.
 *
 * **`cwd` was never the right authority for this tier.** The JIT tier's whole
 * promise is "you are about to touch THIS FILE; here is what governs it". What
 * governs a file is the workspace the FILE lives in. Resolving from `cwd`
 * answers a different question — "what governs the directory the terminal
 * happened to be in" — and the two coincide only by convention.
 * -------------------------------------------------------------------------- */

test('a governed file injects its own workspace\'s items even when cwd is outside it', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);

  // A cwd with no `.my_context` above it, anywhere — the shape of a session
  // started in a home directory. `tmpdir()` itself is used rather than a child
  // of `cwd`, so nothing in the walk upward can find the sandbox.
  const elsewhere = mkdtempSync(path.join(tmpdir(), 'myctx-no-workspace-'));

  const out = runPreToolUse(
    toolInput(elsewhere, 's-away', path.join(cwd, 'src/db/writer.ts')), elsewhere,
  );
  assert.match(context(out), /CONST-pool/,
    'the file lives in a governed workspace and its rule did not arrive. The session cwd is '
    + 'outside that workspace, which is the 2026-08-26 defect: the corpus reaches the model '
    + 'never, and nothing anywhere says so.');

  removeTree(elsewhere);
  removeTree(cwd);
});

test('a file in no workspace at all still injects nothing — the fix is not a licence to guess', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);

  // Both the cwd AND the file are outside any workspace. Resolving from the
  // file must not fall back to something it found near the cwd, and must not
  // walk anywhere it was not asked to: silence is the correct answer here and
  // the previous test must not have bought itself noise everywhere else.
  const elsewhere = mkdtempSync(path.join(tmpdir(), 'myctx-no-workspace-'));
  const stray = path.join(elsewhere, 'src/db/writer.ts');

  assert.equal(runPreToolUse(toolInput(elsewhere, 's-none', stray), elsewhere), '');

  removeTree(elsewhere);
  removeTree(cwd);
});
