import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli, openStore } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

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
    // `--relations`, not `--note`: `--note` became a real flag when `--file`
    // landed (a snapshot's body is somebody else's text, so the WHY needs
    // somewhere of its own), and a test whose "unknown flag" is a flag the
    // command accepts stops testing anything the moment it is accepted.
    ['add', 'lesson', 'Never log secrets', '--relations', 'something'], cwd,
  );
  assert.equal(code, 1);
  assert.match(out, /unknown option "--relations"/);
  assert.deepEqual(items(cwd), [], 'no item may be created by a refused invocation');
  removeTree(cwd);
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
  removeTree(cwd);
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
  removeTree(cwd);
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
  removeTree(cwd);
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
  removeTree(cwd);
});

test('a value flag with nothing after it is refused, not silently dropped', () => {
  const cwd = sandbox();
  const { code, out } = run(['add', 'lesson', 'A lesson', '--body'], cwd);
  assert.equal(code, 1);
  assert.match(out, /--body needs a value/);
  assert.deepEqual(items(cwd), []);
  removeTree(cwd);
});

test('a value flag followed by another option is refused, not read as its value', () => {
  const cwd = sandbox();
  const { code, out } = run(['add', 'lesson', 'A lesson', '--body', '--scope', 'src/**'], cwd);
  assert.equal(code, 1);
  assert.match(out, /--body was followed by "--scope"/);
  assert.deepEqual(items(cwd), []);
  removeTree(cwd);
});

test('a body that cannot survive the round trip is still refused by createItem', () => {
  // The flag plumbing must not become a way around the write-boundary guards
  // the MCP path goes through: `--body` reaches the same `validateBody`.
  const cwd = sandbox();
  const { code, out } = run(['add', 'lesson', 'A lesson', '--body', '## Heading'], cwd);
  assert.equal(code, 1);
  assert.match(out, /heading/i);
  assert.deepEqual(items(cwd), []);
  removeTree(cwd);
});

// --- D1: a repeated flag is never silently reduced to its first occurrence ---

/**
 * Found by dogfooding, on a real corpus item:
 *
 *   mycontext add rule "..." --scope "src/api/**" --scope "src/db/**" --scope "src/web/**"
 *
 * created an item scoped to `src/api/**` alone and printed the ordinary
 * success line. Two scopes were accepted, dropped, and never mentioned — it
 * was noticed only because someone opened the resulting Markdown file. The
 * flag being list-valued is what makes collecting the right answer here;
 * `--body` below gets the other answer, for the reason stated there.
 */
test('every --scope is kept, not just the first', () => {
  const cwd = sandbox();
  const { code } = run(
    ['add', 'lesson', 'Three scopes', '--scope', 'src/api/**',
      '--scope', 'src/db/**', '--scope', 'src/web/**'],
    cwd,
  );
  assert.equal(code, 0);
  assert.deepEqual(
    get(cwd, 'LESSON-three-scopes')?.scope,
    ['src/api/**', 'src/db/**', 'src/web/**'],
  );
  removeTree(cwd);
});

test('every --tags is kept too — the same helper, so the same guarantee', () => {
  const cwd = sandbox();
  const { code } = run(
    ['add', 'lesson', 'Three tags', '--tags', 'security', '--tags', 'ops,db'], cwd,
  );
  assert.equal(code, 0);
  assert.deepEqual(get(cwd, 'LESSON-three-tags')?.tags, ['security', 'ops', 'db']);
  removeTree(cwd);
});

test('the repeated and comma-separated forms compose, in command-line order', () => {
  const cwd = sandbox();
  const { code } = run(
    ['add', 'lesson', 'Both forms', '--scope', 'a/**,b/**', '--scope=c/**'], cwd,
  );
  assert.equal(code, 0);
  assert.deepEqual(get(cwd, 'LESSON-both-forms')?.scope, ['a/**', 'b/**', 'c/**']);
  removeTree(cwd);
});

test('a scope repeated verbatim is stored once, not twice', () => {
  const cwd = sandbox();
  run(['add', 'lesson', 'Dupes', '--scope', 'a/**', '--scope', 'a/**,b/**'], cwd);
  assert.deepEqual(get(cwd, 'LESSON-dupes')?.scope, ['a/**', 'b/**']);
  removeTree(cwd);
});

/**
 * `--body` is single-valued, so a repeat gets the other honest answer. There
 * is no reading of two `--body` values in which the caller gets both:
 * concatenating invents a body nobody typed, and keeping either one is the
 * drop this file exists to prevent.
 */
test('a repeated --body is refused, and nothing is created', () => {
  const cwd = sandbox();
  const { code, out } = run(
    ['add', 'lesson', 'Two bodies', '--body', 'First.', '--body', 'Second.'], cwd,
  );
  assert.equal(code, 1);
  assert.match(out, /--body was given 2 times/);
  assert.match(out, /"First\.", "Second\."/);
  assert.deepEqual(items(cwd), []);
  removeTree(cwd);
});

test('the per-occurrence checks apply to every occurrence, not only the first', () => {
  // The second `--scope` has nothing after it: without a per-occurrence
  // check, the first would be stored and the second would vanish.
  const cwd = sandbox();
  const { code, out } = run(['add', 'lesson', 'Late empty', '--scope', 'a/**', '--scope'], cwd);
  assert.equal(code, 1);
  assert.match(out, /--scope needs a value/);
  assert.deepEqual(items(cwd), []);
  removeTree(cwd);
});

// --- D2: --severity is expressible at the moment of capture ---

test('--severity hard is stored on the item', () => {
  const cwd = sandbox();
  const { code } = run(
    ['add', 'constraint', 'Uploads capped at 10 MB', '--severity', 'hard', '--yes'], cwd,
  );
  assert.equal(code, 0);
  assert.equal(get(cwd, 'CONST-uploads-capped-at-10-mb')?.severity, 'hard');
  removeTree(cwd);
});

test('severity still defaults to soft when the flag is absent', () => {
  const cwd = sandbox();
  run(['add', 'constraint', 'Uploads capped at 10 MB', '--yes'], cwd);
  assert.equal(get(cwd, 'CONST-uploads-capped-at-10-mb')?.severity, 'soft');
  removeTree(cwd);
});

test('a bogus --severity is refused in the same words every other surface uses', () => {
  const cwd = sandbox();
  const { code, out } = run(
    ['add', 'constraint', 'Uploads capped', '--severity', 'critical', '--yes'], cwd,
  );
  assert.equal(code, 1);
  // `enumError`'s wording, shared with create_item/update_item and
  // `review promote --severity` — not a fourth sentence for one enum.
  assert.match(out, /"severity" must be one of: hard, soft/);
  assert.deepEqual(items(cwd), []);
  removeTree(cwd);
});

test('a bogus --severity is refused before the normative capture is previewed', () => {
  // The reason `review promote` validates its own --severity up front: a
  // human must not be asked to confirm a capture that was never going to
  // land.
  const cwd = sandbox();
  const { out } = run(['add', 'rule', 'Never log secrets', '--severity', 'critical'], cwd);
  assert.doesNotMatch(out, /about to create/);
  removeTree(cwd);
});

test('a repeated --severity is refused, like every other single-valued flag', () => {
  const cwd = sandbox();
  const { code, out } = run(
    ['add', 'lesson', 'Two severities', '--severity', 'hard', '--severity', 'soft'], cwd,
  );
  assert.equal(code, 1);
  assert.match(out, /--severity was given 2 times/);
  assert.deepEqual(items(cwd), []);
  removeTree(cwd);
});

// --- C4: a normative capture needs --yes ---

test('add on a normative category refuses without --yes and creates nothing', () => {
  const cwd = sandbox();
  const { code, out } = run(['add', 'rule', 'Never log secrets'], cwd);
  assert.equal(code, 1);
  assert.match(out, /--yes/);
  assert.deepEqual(items(cwd), []);
  removeTree(cwd);
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
  removeTree(cwd);
});

test('add on a normative category with --yes creates an active item', () => {
  const cwd = sandbox();
  const { code, out } = run(['add', 'rule', 'Never log secrets', '--yes'], cwd);
  assert.equal(code, 0);
  assert.match(out, /RULE-never-log-secrets/);
  assert.equal(get(cwd, 'RULE-never-log-secrets')?.status, 'active');
  removeTree(cwd);
});

test('--yes=false declines: the spelling an operator reaches for to say no', () => {
  // `hasFlag` once matched any `--yes=` prefix, so this CONFIRMED. The fix
  // lives in registry.ts's `boolFlag`; this pins that `add` inherits it.
  for (const spelling of ['--yes=false', '--yes=no', '--yes=0', '--yes=off']) {
    const cwd = sandbox();
    const { code } = run(['add', 'rule', 'Never log secrets', spelling], cwd);
    assert.equal(code, 1, spelling);
    assert.deepEqual(items(cwd), [], spelling);
    removeTree(cwd);
  }
});

test('--yes=maybe is refused rather than guessed in either direction', () => {
  const cwd = sandbox();
  const { code, out } = run(['add', 'rule', 'Never log secrets', '--yes=maybe'], cwd);
  assert.equal(code, 1);
  assert.match(out, /--yes accepts/);
  assert.deepEqual(items(cwd), []);
  removeTree(cwd);
});

test('a rationale category is ungated — nothing in that tier is auto-injected', () => {
  const cwd = sandbox();
  const { code } = run(['add', 'lesson', 'Migrations need locks'], cwd);
  assert.equal(code, 0);
  assert.equal(get(cwd, 'LESSON-migrations-need-locks')?.status, 'active');
  removeTree(cwd);
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
  removeTree(cwd);
});

test('an unknown category is still refused by name, not swallowed by the gate', () => {
  const cwd = sandbox();
  const { code, out } = run(['add', 'constraints', 'Typo'], cwd);
  assert.equal(code, 1);
  assert.match(out, /constraint/);
  assert.doesNotMatch(out, /--yes/);
  removeTree(cwd);
});

test('a disabled category is refused on its own terms, without a confirmation detour', () => {
  const cwd = sandbox();
  // Disabled by this project's config: nothing ships disabled since Phase 3
  // removed the three categories that did.
  writeFileSync(
    path.join(cwd, '.my_context', 'config.json'),
    JSON.stringify({ categories: { standard: { enabled: false } } }),
  );
  const { code, out } = run(['add', 'standard', 'Some convention'], cwd);
  assert.equal(code, 1);
  assert.match(out, /disabled/i);
  assert.doesNotMatch(out, /Create standard/);
  removeTree(cwd);
});

test('the usage banner advertises the flags the command actually accepts', () => {
  const cwd = sandbox();
  const { out } = run([], cwd);
  for (const name of ['--body', '--scope', '--tags', '--severity', '--extra', '--yes']) {
    assert.match(out, new RegExp(name), name);
  }
  removeTree(cwd);
});

test('add with no title still prints its usage, and that usage names the flags', () => {
  const cwd = sandbox();
  const { code, out } = run(['add', 'lesson'], cwd);
  assert.equal(code, 1);
  assert.match(out, /usage: mycontext add <category> <title>/);
  assert.match(out, /--body/);
  removeTree(cwd);
});

test('--extra sets category fields at creation, in one command', () => {
  const cwd = sandbox();
  const { code } = run(
    ['add', 'rule', 'Never log a customer email',
     '--body', 'PII must not reach the log.',
     '--extra', 'directive=dont', '--yes'],
    cwd,
  );
  assert.equal(code, 0);
  const file = path.join(
    cwd, '.my_context', 'items', 'rule', 'RULE-never-log-a-customer-email.md',
  );
  // The point of the flag: the field is present on the FIRST write, so the
  // item never exists in a state where its category-specific meaning is
  // missing, and there is one audit record rather than two.
  assert.match(readFileSync(file, 'utf8'), /^directive: dont$/m);
  removeTree(cwd);
});

test('--extra refuses a reserved frontmatter key, with the same message edit gives', () => {
  const cwd = sandbox();
  const { code, out } = run(
    ['add', 'lesson', 'Something learned', '--extra', 'status=active', '--yes'],
    cwd,
  );
  assert.equal(code, 1);
  assert.match(out, /reserved frontmatter field/);
  removeTree(cwd);
});

test('--extra without an = is refused, and says what the shape is', () => {
  const cwd = sandbox();
  const { code, out } = run(
    ['add', 'lesson', 'Something learned', '--extra', 'directive', '--yes'],
    cwd,
  );
  assert.equal(code, 1);
  assert.match(out, /--extra takes key=value/);
  removeTree(cwd);
});
