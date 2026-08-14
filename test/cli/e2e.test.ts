import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';
import { firstCell } from '../helpers/table.ts';

const DOC = `# Password policy

Passwords must be at least 12 characters.

# Storage

Postgres only, no MySQL.
`;

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-e2e-'));
  runCli(['init'], cwd, () => {});
  mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  writeFileSync(path.join(cwd, 'docs', 'prd.md'), DOC, 'utf8');
  return cwd;
}

test('ingest → apply → review → promote, with provenance intact at every step', () => {
  const cwd = project();
  try {
    // Phase one: the request is self-contained — chunk, schema, categories, callback.
    const request = run(['ingest', 'docs/prd.md'], cwd);
    assert.equal(request.code, 0);
    assert.match(request.out, /EXTRACTION REQUEST/);
    assert.match(request.out, /Passwords must be at least 12 characters/);
    assert.match(request.out, /"schema"/);
    assert.match(request.out, /"categories"/);
    assert.match(request.out, /ingest-apply/);
    const session = /ING-[a-z0-9-]+/.exec(request.out)![0];

    // Phase two: the canned candidate array stands in for the host agent.
    writeFileSync(path.join(cwd, 'c.json'), JSON.stringify([{
      type: 'requirement',
      title: 'Passwords are at least 12 characters',
      body: 'Enforced at registration and at password change.',
      quote: 'Passwords must be at least 12 characters.',
    }]), 'utf8');

    const applied = run(['ingest-apply', session, '--anchor', 'password-policy', '--file', 'c.json'], cwd);
    assert.equal(applied.code, 0);
    assert.match(applied.out, /created 1/);

    const id = 'REQ-passwords-are-at-least-12-characters';
    const file = path.join(cwd, '.my_context', 'items', 'requirement', `${id}.md`);
    const before = readFileSync(file, 'utf8');
    assert.match(before, /^status: draft$/m, 'nothing ingested is active');
    assert.match(before, /^origin: ingest$/m);
    assert.match(before, /^source_file: docs\/prd\.md$/m);
    assert.match(before, /^source_anchor: password-policy$/m);
    assert.match(before, /^source_checksum: /m);

    assert.match(run(['review'], cwd).out, new RegExp(id));

    // `review promote` gained a confirmation gate (Task 10) after this
    // walkthrough was originally drafted — `--yes` is required for a
    // non-interactive caller such as this test.
    const promoted = run(['review', 'promote', id, '--scope', 'src/auth/**', '--yes'], cwd);
    assert.equal(promoted.code, 0);
    const after = readFileSync(file, 'utf8');
    assert.match(after, /^status: active$/m);
    assert.match(after, /^\s+- src\/auth\/\*\*$/m);
    assert.match(run(['review'], cwd).out, /no drafts/i);
  } finally {
    removeTree(cwd);
  }
});

test('the approval gate: staging creates no rule, accepting creates exactly one', () => {
  const cwd = project();
  try {
    const lesson = run(['lesson', 'Hooks that throw break the session, so they must fail open'], cwd);
    assert.equal(lesson.code, 0);
    assert.match(lesson.out, /RULE DERIVATION REQUEST/);
    const lessonId = /LESSON-[a-z0-9-]+/.exec(lesson.out)![0];

    writeFileSync(path.join(cwd, 'r.json'), JSON.stringify([
      { title: 'Hooks must fail open', directive: 'do', body: 'A throwing hook takes the session with it.', scope: ['src/hooks/**'] },
      { title: 'Never let a hook throw', directive: 'dont', body: 'Same mechanism, stated as a prohibition.' },
    ]), 'utf8');

    const staged = run(['lesson-stage', lessonId, '--file', 'r.json'], cwd);
    assert.equal(staged.code, 0);
    // `0 item(s)`, not `''`: an empty list now states the count rather than
    // printing nothing at all (see cmdList in src/cli/index.ts).
    assert.equal(run(['list', 'rule'], cwd).out.trim(), '0 item(s)', 'staging must create nothing');

    const keys = [...staged.out.matchAll(firstCell('[0-9a-f]{8}', 'gm'))].map((m) => m[1]);
    assert.equal(keys.length, 2);

    const accepted = run(['lesson-accept', lessonId, keys[0]], cwd);
    assert.equal(accepted.code, 0);
    // Counted through `list --json`, not by counting text lines: the text
    // table now carries a header and a rule above the data, so a count
    // derived from line arithmetic would drift with the layout.
    const listed = JSON.parse(run(['list', 'rule', '--json'], cwd).out) as
      { items: { id: string; status: string }[]; count: number };
    assert.equal(listed.count, 1, 'exactly the accepted one');
    assert.equal(listed.items[0].status, 'active');
    assert.match(run(['show', 'RULE-hooks-must-fail-open'], cwd).out,
      new RegExp(`derived_from \\[\\[${lessonId}\\]\\]`));
  } finally {
    removeTree(cwd);
  }
});

test('the health commands agree with each other on a real corpus', () => {
  const cwd = project();
  try {
    run(['add', 'constraint', 'Pool capped at 20', '--yes'], cwd);

    assert.equal(run(['doctor'], cwd).code, 0);
    assert.match(run(['decay'], cwd).out, /never auto-injected|cold/);
    assert.match(run(['status'], cwd).out, /health:/);

    const counted = run(['query', 'SELECT type, COUNT(*) AS n FROM items GROUP BY type'], cwd);
    assert.equal(counted.code, 0);
    assert.match(counted.out, /constraint/);

    const refused = run(['query', 'DELETE FROM items'], cwd);
    assert.equal(refused.code, 1);
    assert.match(refused.out, /only SELECT/i);
    const after = JSON.parse(run(['list', '--json'], cwd).out) as { count: number };
    assert.equal(after.count, 1, 'nothing was deleted');
  } finally {
    removeTree(cwd);
  }
});
