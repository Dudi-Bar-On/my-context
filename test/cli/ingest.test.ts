import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { COMMANDS } from '../../src/cli/commands/registry.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';

const DOC = `# Password policy\n\nPasswords must be at least 12 characters.\n\n# Storage\n\nPostgres only, no MySQL.\n`;

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-cli-ing-'));
  runCli(['init'], cwd, () => {});
  mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  writeFileSync(path.join(cwd, 'docs', 'prd.md'), DOC, 'utf8');
  return cwd;
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function sessionId(out: string): string {
  const match = /ING-[a-z0-9-]+/.exec(out);
  assert.ok(match, `no session id in output:\n${out}`);
  return match[0];
}

test('ingest prints an extraction request for the first chunk', () => {
  const cwd = project();
  const { code, out } = run(['ingest', 'docs/prd.md'], cwd);
  assert.equal(code, 0);
  assert.match(out, /EXTRACTION REQUEST/);
  assert.match(out, /password-policy/);
  assert.match(out, /Passwords must be at least 12 characters/);
  rmSync(cwd, { recursive: true, force: true });
});

test('ingest accepts a native Windows-style relative path and stores it POSIX', () => {
  const cwd = project();
  const { out } = run(['ingest', 'docs\\prd.md'], cwd);
  assert.match(out, /"sourceFile": "docs\/prd\.md"/);
  rmSync(cwd, { recursive: true, force: true });
});

test('ingest on a missing file explains rather than throwing', () => {
  const cwd = project();
  const { code, out } = run(['ingest', 'docs/nope.md'], cwd);
  assert.equal(code, 1);
  assert.match(out, /docs\/nope\.md/);
  rmSync(cwd, { recursive: true, force: true });
});

test('ingest with no path prints its usage', () => {
  const cwd = project();
  const { code, out } = run(['ingest'], cwd);
  assert.equal(code, 1);
  assert.match(out, /usage: mycontext ingest/);
  rmSync(cwd, { recursive: true, force: true });
});

test('ingest --anchor jumps to a named chunk', () => {
  const cwd = project();
  const { out } = run(['ingest', 'docs/prd.md', '--anchor', 'storage'], cwd);
  assert.match(out, /Postgres only, no MySQL/);
  rmSync(cwd, { recursive: true, force: true });
});

test('ingest-apply writes drafts and then offers the next chunk', () => {
  const cwd = project();
  const id = sessionId(run(['ingest', 'docs/prd.md'], cwd).out);
  const payload = JSON.stringify([{
    type: 'requirement',
    title: 'Passwords are at least 12 characters',
    body: 'Enforced at registration.',
    quote: 'Passwords must be at least 12 characters.',
  }]);
  writeFileSync(path.join(cwd, 'c.json'), payload, 'utf8');

  const { code, out } = run(['ingest-apply', id, '--anchor', 'password-policy', '--file', 'c.json'], cwd);
  assert.equal(code, 0);
  assert.match(out, /created 1/);
  assert.match(out, /REQ-passwords-are-at-least-12-characters/);
  assert.match(out, /EXTRACTION REQUEST/, 'the next pending chunk is offered automatically');
  assert.match(out, /Postgres only/);

  const listed = run(['list'], cwd).out;
  assert.match(listed, /REQ-passwords-are-at-least-12-characters\s+requirement\s+draft/);
  rmSync(cwd, { recursive: true, force: true });
});

test('ingest-apply reports issues and still keeps the good candidates', () => {
  const cwd = project();
  const id = sessionId(run(['ingest', 'docs/prd.md'], cwd).out);
  writeFileSync(path.join(cwd, 'c.json'), JSON.stringify([
    { type: 'requirement', title: 'Good one', body: 'b', quote: 'Passwords must be at least 12 characters.' },
    { type: 'nonsense', title: 'Bad one', body: 'b', quote: 'Passwords must be at least 12 characters.' },
  ]), 'utf8');

  const { code, out } = run(['ingest-apply', id, '--anchor', 'password-policy', '--file', 'c.json'], cwd);
  assert.equal(code, 0, 'a partial success is still a success');
  assert.match(out, /created 1/);
  assert.match(out, /1 candidate rejected/);
  assert.match(out, /Bad one/);
  rmSync(cwd, { recursive: true, force: true });
});

test('ingest-apply with malformed JSON names the parse error', () => {
  const cwd = project();
  const id = sessionId(run(['ingest', 'docs/prd.md'], cwd).out);
  writeFileSync(path.join(cwd, 'c.json'), '{ not json', 'utf8');
  const { code, out } = run(['ingest-apply', id, '--anchor', 'password-policy', '--file', 'c.json'], cwd);
  assert.equal(code, 1);
  assert.match(out, /not valid JSON/i);
  rmSync(cwd, { recursive: true, force: true });
});

test('re-running ingest on an unchanged document resumes and skips applied chunks', () => {
  const cwd = project();
  const id = sessionId(run(['ingest', 'docs/prd.md'], cwd).out);
  writeFileSync(path.join(cwd, 'c.json'), '[]', 'utf8');
  run(['ingest-apply', id, '--anchor', 'password-policy', '--file', 'c.json'], cwd);

  const { out } = run(['ingest', 'docs/prd.md'], cwd);
  assert.match(out, new RegExp(id));
  assert.match(out, /Postgres only/);
  // The applied chunk's text must not reappear: a request embeds only its own
  // chunk, so the password-policy sentence is absent iff that chunk was skipped.
  assert.equal(out.includes('Passwords must be at least 12 characters.'), false);
  rmSync(cwd, { recursive: true, force: true });
});

/**
 * The F2 ruling already established for `add`/`list`/`show`/`rebuild`
 * (`src/cli/index.ts`, `test/cli/cli.test.ts`) applies here too: a command
 * that did what it was asked exits 0 and reports an UNRELATED corpus problem
 * as a warning; only `status` and `doctor` exit non-zero on one. An earlier
 * version of this test asserted `code === 1` for exactly this case — that
 * was wrong (the brief that specified it was wrong too, and has been
 * corrected alongside this test): `ingest-apply` calling `openMutateContext`
 * does not make it exempt from F2, and the corrupt file must still never be
 * silently dropped from the output either way.
 */
test('ingest-apply reports a corrupt unrelated item file as a warning but still succeeds', () => {
  const cwd = project();
  const id = sessionId(run(['ingest', 'docs/prd.md'], cwd).out);
  mkdirSync(path.join(cwd, '.my_context', 'items', 'constraint'), { recursive: true });
  writeFileSync(path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-broken.md'), 'no frontmatter here\n');
  writeFileSync(path.join(cwd, 'c.json'), '[]', 'utf8');

  const { code, out } = run(['ingest-apply', id, '--anchor', 'password-policy', '--file', 'c.json'], cwd);
  assert.equal(code, 0, 'ingest-apply did what it was asked; the unrelated corpus problem is a warning');
  assert.match(out, /my_context: error\s+.*CONST-broken\.md/);
  // It really did apply, not silently skip: the anchor no longer shows as
  // pending, and this same corrupt file must never be silently dropped.
  const status = run(['ingest-status'], cwd).out;
  assert.match(status, new RegExp(`${id}\\s+docs/prd\\.md\\s+1/2`));
  rmSync(cwd, { recursive: true, force: true });
});

test('ingest reports completion once every chunk is applied', () => {
  const cwd = project();
  const id = sessionId(run(['ingest', 'docs/prd.md'], cwd).out);
  writeFileSync(path.join(cwd, 'c.json'), '[]', 'utf8');
  run(['ingest-apply', id, '--anchor', 'password-policy', '--file', 'c.json'], cwd);
  run(['ingest-apply', id, '--anchor', 'storage', '--file', 'c.json'], cwd);

  const { code, out } = run(['ingest', 'docs/prd.md'], cwd);
  assert.equal(code, 0);
  assert.match(out, /every chunk applied/i);
  rmSync(cwd, { recursive: true, force: true });
});

test('ingest-status lists sessions with their progress', () => {
  const cwd = project();
  const id = sessionId(run(['ingest', 'docs/prd.md'], cwd).out);
  writeFileSync(path.join(cwd, 'c.json'), '[]', 'utf8');
  run(['ingest-apply', id, '--anchor', 'password-policy', '--file', 'c.json'], cwd);
  const { out } = run(['ingest-status'], cwd);
  assert.match(out, new RegExp(`${id}\\s+docs/prd\\.md\\s+1/2`));
  rmSync(cwd, { recursive: true, force: true });
});

test('the registered commands appear in usage', () => {
  const cwd = project();
  const { out } = run(['help'], cwd);
  assert.match(out, /ingest <path>/);
  assert.match(out, /ingest-apply/);
  rmSync(cwd, { recursive: true, force: true });
});

test('usage still lists the commands the registry did not take over', () => {
  const cwd = project();
  const { out } = run(['help'], cwd);
  for (const line of [/init\s+create \.my_context/, /add <category> <title>/, /list \[category\]/,
                      /show <id>/, /rebuild\s+rebuild the index/, /status/,
                      /help \[topic\]/, /examples <category>/]) {
    assert.match(out, line);
  }
  // Plan 3's no-arg help behaviour, pinned by test/help/help.test.ts too.
  assert.match(out, /help topics:/);
  assert.match(out, /e\.g\. mycontext help scope/);
  rmSync(cwd, { recursive: true, force: true });
});

/**
 * `readPayload` (context.ts) reads fd 0 whenever `--file` is absent. Without
 * this check, running `ingest-apply` with neither flag blocks on stdin
 * instead of ever reaching a usage message — a real hang, not just a
 * cosmetic wrong-message bug, so this test would time out (not merely fail
 * an assertion) against an implementation missing the guard.
 */
test('ingest-apply with neither --file nor --stdin prints its usage instead of blocking', () => {
  const cwd = project();
  const id = sessionId(run(['ingest', 'docs/prd.md'], cwd).out);
  const { code, out } = run(['ingest-apply', id, '--anchor', 'password-policy'], cwd);
  assert.equal(code, 1);
  assert.match(out, /usage: mycontext ingest-apply/);
  rmSync(cwd, { recursive: true, force: true });
});

test('ingest on a directory reports it is not a file, rather than a raw EISDIR', () => {
  const cwd = project();
  const { code, out } = run(['ingest', 'docs'], cwd);
  assert.equal(code, 1);
  assert.match(out, /is not a file/);
  assert.doesNotMatch(out, /EISDIR/);
  assert.doesNotMatch(out, /at Object|at Module|node:internal/);
  rmSync(cwd, { recursive: true, force: true });
});

test('ingest-apply pluralizes "candidates rejected" for more than one issue', () => {
  const cwd = project();
  const id = sessionId(run(['ingest', 'docs/prd.md'], cwd).out);
  writeFileSync(path.join(cwd, 'c.json'), JSON.stringify([
    { type: 'nonsense', title: 'Bad one', body: 'b', quote: 'Passwords must be at least 12 characters.' },
    { type: 'also-nonsense', title: 'Bad two', body: 'b', quote: 'Passwords must be at least 12 characters.' },
  ]), 'utf8');
  const { out } = run(['ingest-apply', id, '--anchor', 'password-policy', '--file', 'c.json'], cwd);
  assert.match(out, /2 candidates rejected/);
  rmSync(cwd, { recursive: true, force: true });
});

/**
 * `CommandFn`'s contract (registry.ts) is "never throws". Calling the
 * registered function DIRECTLY — not through `runCli`, which has its own
 * top-level catch that would mask a `cmdIngestApply` that itself throws —
 * is what actually pins that `cmdIngestApply` honors the contract on its
 * own. This forces `openMutateContext` to throw AFTER `acquireApplyLock` has
 * already succeeded (the db path is a directory, so `Store.open` fails) and
 * checks three things: the call does not throw past its own boundary, the
 * message is a clean `my_context:` line (not a raw stack trace), and the
 * lock is still released — the outer `finally` runs regardless of which
 * `try` threw.
 */
test('ingest-apply (called directly, bypassing runCli) never throws and still releases its lock', () => {
  const cwd = project();
  const id = sessionId(run(['ingest', 'docs/prd.md'], cwd).out);
  writeFileSync(path.join(cwd, 'c.json'), '[]', 'utf8');
  mkdirSync(path.join(cwd, '.my_context', '.index.db'), { recursive: true });

  const cmd = COMMANDS.get('ingest-apply');
  assert.ok(cmd, 'ingest-apply must be registered');
  const ws = resolveWorkspace(cwd);
  let out = '';
  let code: number | undefined;
  assert.doesNotThrow(() => {
    code = cmd!.run(ws, [id, '--anchor', 'password-policy', '--file', 'c.json'], (s) => { out += s + '\n'; }, cwd);
  });
  assert.equal(code, 1);
  assert.match(out, /my_context:/);
  assert.doesNotMatch(out, /at Object|at Module|node:internal/);

  const lockDir = path.join(cwd, '.my_context', '.ingest');
  let leaked: string[] = [];
  try {
    leaked = readdirSync(lockDir).filter((f) => f.endsWith('.lock'));
  } catch { /* dir may not exist; fine */ }
  assert.deepEqual(leaked, []);
  rmSync(cwd, { recursive: true, force: true });
});
