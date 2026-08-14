import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli, openStore } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import type { Item } from '../../src/core/types.ts';

/**
 * `mycontext add`'s argument surface: what it accepts, what it refuses, and
 * the `--yes` gate on a normative category.
 *
 * The bug this file exists for: `cmdAdd` built its title from
 * `args.slice(1).join(' ')`, so every token it did not understand — including
 * every flag — became part of the title. `mycontext add rule "Never log
 * secrets" --body "..." --scope "src/**"` created an ACTIVE rule literally
 * titled `Never log secrets --body ... --scope src/**` and reported success.
 * That invocation shape is not hypothetical: it is the fallback named in
 * every generated `add-<type>.md`.
 *
 * Note on `--yes`: stdin is not a TTY under `node --test`, so `confirmAction`
 * takes its non-interactive branch and refuses. That is the same code path a
 * hook or a script hits, which is the path that matters here.
 */

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-add-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function items(cwd: string): Item[] {
  const { store } = openStore(resolveWorkspace(cwd));
  const all = store.all();
  store.close();
  return all;
}

function get(cwd: string, id: string): Item | null {
  return items(cwd).find((i) => i.id === id) ?? null;
}

// --- I1: unknown flags are refused, never folded into the title ---

test('an unknown option is refused, and nothing is created', () => {
  const cwd = sandbox();
  const { code, out } = run(
    ['add', 'lesson', 'Never log secrets', '--note', 'something'], cwd,
  );
  assert.equal(code, 1);
  assert.match(out, /unknown option "--note"/);
  assert.deepEqual(items(cwd), [], 'no item may be created by a refused invocation');
  rmSync(cwd, { recursive: true, force: true });
});

test('an unknown option in --name=value form is refused too', () => {
  const cwd = sandbox();
  const { code, out } = run(['add', 'lesson', 'A lesson', '--observations=x'], cwd);
  assert.equal(code, 1);
  assert.match(out, /unknown option "--observations"/);
  // The message has to name a route that actually exists for the fields the
  // CLI cannot express, rather than leaving the caller with no next step.
  assert.match(out, /create_item/);
  assert.deepEqual(items(cwd), []);
  rmSync(cwd, { recursive: true, force: true });
});

test('no accepted flag ever reaches the title', () => {
  const cwd = sandbox();
  const { code } = run(
    ['add', 'lesson', 'Never log secrets', '--body', 'Logs are shipped offsite.',
      '--scope', 'src/**', '--tags', 'security'],
    cwd,
  );
  assert.equal(code, 0);
  const item = get(cwd, 'LESSON-never-log-secrets');
  assert.ok(item, 'expected LESSON-never-log-secrets');
  assert.equal(item!.title, 'Never log secrets');
  rmSync(cwd, { recursive: true, force: true });
});

// --- I1 ruling (a): body, scope and tags are expressible ---

test('--body, --scope and --tags are stored on the item', () => {
  const cwd = sandbox();
  const { code } = run(
    ['add', 'lesson', 'Migrations need locks', '--body', 'A concurrent DDL wedged staging.',
      '--scope', 'src/db/**, migrations/**', '--tags', 'database, ops'],
    cwd,
  );
  assert.equal(code, 0);
  const item = get(cwd, 'LESSON-migrations-need-locks');
  assert.ok(item);
  assert.equal(item!.body, 'A concurrent DDL wedged staging.');
  assert.deepEqual(item!.scope, ['src/db/**', 'migrations/**']);
  assert.deepEqual(item!.tags, ['database', 'ops']);
  rmSync(cwd, { recursive: true, force: true });
});

test('the --flag=value form works for every value flag', () => {
  const cwd = sandbox();
  const { code } = run(
    ['add', 'lesson', 'Equals form', '--body=Because.', '--scope=src/**', '--tags=a,b'], cwd,
  );
  assert.equal(code, 0);
  const item = get(cwd, 'LESSON-equals-form');
  assert.equal(item?.body, 'Because.');
  assert.deepEqual(item?.scope, ['src/**']);
  assert.deepEqual(item?.tags, ['a', 'b']);
  rmSync(cwd, { recursive: true, force: true });
});

test('a value flag with nothing after it is refused, not silently dropped', () => {
  const cwd = sandbox();
  const { code, out } = run(['add', 'lesson', 'A lesson', '--body'], cwd);
  assert.equal(code, 1);
  assert.match(out, /--body needs a value/);
  assert.deepEqual(items(cwd), []);
  rmSync(cwd, { recursive: true, force: true });
});

test('a value flag followed by another option is refused, not read as its value', () => {
  const cwd = sandbox();
  const { code, out } = run(['add', 'lesson', 'A lesson', '--body', '--scope', 'src/**'], cwd);
  assert.equal(code, 1);
  assert.match(out, /--body was followed by "--scope"/);
  assert.deepEqual(items(cwd), []);
  rmSync(cwd, { recursive: true, force: true });
});

test('a body that cannot survive the round trip is still refused by createItem', () => {
  // The flag plumbing must not become a way around the write-boundary guards
  // the MCP path goes through: `--body` reaches the same `validateBody`.
  const cwd = sandbox();
  const { code, out } = run(['add', 'lesson', 'A lesson', '--body', '## Heading'], cwd);
  assert.equal(code, 1);
  assert.match(out, /heading/i);
  assert.deepEqual(items(cwd), []);
  rmSync(cwd, { recursive: true, force: true });
});

// --- C4: a normative capture needs --yes ---

test('add on a normative category refuses without --yes and creates nothing', () => {
  const cwd = sandbox();
  const { code, out } = run(['add', 'rule', 'Never log secrets'], cwd);
  assert.equal(code, 1);
  assert.match(out, /--yes/);
  assert.deepEqual(items(cwd), []);
  rmSync(cwd, { recursive: true, force: true });
});

test('the refusal names the item it declined to create, before creating it', () => {
  const cwd = sandbox();
  const { out } = run(['add', 'rule', 'Never log secrets'], cwd);
  // `confirmAction` asks its question only on a TTY, so the non-interactive
  // refusal is preceded by a line naming the capture — otherwise a script or
  // hook gets "refusing without confirmation" about nothing in particular.
  assert.match(out, /about to create rule "Never log secrets"/);
  // Never described as protection against an agent: anything that can run
  // this command can pass --yes. What the gate buys is a greppable token in
  // the transcript, and no user-facing string may claim more than that.
  assert.doesNotMatch(out, /agent/i);
  rmSync(cwd, { recursive: true, force: true });
});

test('add on a normative category with --yes creates an active item', () => {
  const cwd = sandbox();
  const { code, out } = run(['add', 'rule', 'Never log secrets', '--yes'], cwd);
  assert.equal(code, 0);
  assert.match(out, /RULE-never-log-secrets/);
  assert.equal(get(cwd, 'RULE-never-log-secrets')?.status, 'active');
  rmSync(cwd, { recursive: true, force: true });
});

test('--yes=false declines: the spelling an operator reaches for to say no', () => {
  // `hasFlag` once matched any `--yes=` prefix, so this CONFIRMED. The fix
  // lives in registry.ts's `boolFlag`; this pins that `add` inherits it.
  for (const spelling of ['--yes=false', '--yes=no', '--yes=0', '--yes=off']) {
    const cwd = sandbox();
    const { code } = run(['add', 'rule', 'Never log secrets', spelling], cwd);
    assert.equal(code, 1, spelling);
    assert.deepEqual(items(cwd), [], spelling);
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('--yes=maybe is refused rather than guessed in either direction', () => {
  const cwd = sandbox();
  const { code, out } = run(['add', 'rule', 'Never log secrets', '--yes=maybe'], cwd);
  assert.equal(code, 1);
  assert.match(out, /--yes accepts/);
  assert.deepEqual(items(cwd), []);
  rmSync(cwd, { recursive: true, force: true });
});

test('a rationale category is ungated — nothing in that tier is auto-injected', () => {
  const cwd = sandbox();
  const { code } = run(['add', 'lesson', 'Migrations need locks'], cwd);
  assert.equal(code, 0);
  assert.equal(get(cwd, 'LESSON-migrations-need-locks')?.status, 'active');
  rmSync(cwd, { recursive: true, force: true });
});

test('the gate follows a per-project tier override, not the built-in catalog', () => {
  // `lesson` is rationale in the built-in catalog. A project that declares it
  // normative must get the gate, or the tier override would be honoured by
  // `trustedStatus` and ignored by the one CLI command that writes items.
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-add-'));
  runCli(['init'], cwd, () => {});
  writeFileSync(
    path.join(cwd, '.my_context', 'config.json'),
    JSON.stringify({ profile: 'standard', categories: { lesson: { tier: 'normative' } } }),
  );
  const { code, out } = run(['add', 'lesson', 'Now normative here'], cwd);
  assert.equal(code, 1);
  assert.match(out, /--yes/);
  assert.deepEqual(items(cwd), []);
  rmSync(cwd, { recursive: true, force: true });
});

test('an unknown category is still refused by name, not swallowed by the gate', () => {
  const cwd = sandbox();
  const { code, out } = run(['add', 'constraints', 'Typo'], cwd);
  assert.equal(code, 1);
  assert.match(out, /constraint/);
  assert.doesNotMatch(out, /--yes/);
  rmSync(cwd, { recursive: true, force: true });
});

test('a disabled category is refused on its own terms, without a confirmation detour', () => {
  const cwd = sandbox();
  const { code, out } = run(['add', 'policy', 'Some policy'], cwd);
  assert.equal(code, 1);
  assert.match(out, /disabled/i);
  assert.doesNotMatch(out, /Create policy/);
  rmSync(cwd, { recursive: true, force: true });
});

test('the usage banner advertises the flags the command actually accepts', () => {
  const cwd = sandbox();
  const { out } = run([], cwd);
  for (const name of ['--body', '--scope', '--tags', '--yes']) {
    assert.match(out, new RegExp(name), name);
  }
  rmSync(cwd, { recursive: true, force: true });
});

test('add with no title still prints its usage, and that usage names the flags', () => {
  const cwd = sandbox();
  const { code, out } = run(['add', 'lesson'], cwd);
  assert.equal(code, 1);
  assert.match(out, /usage: mycontext add <category> <title>/);
  assert.match(out, /--body/);
  rmSync(cwd, { recursive: true, force: true });
});
