import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, utimesSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli, openStore } from '../../src/cli/index.ts';
import { Store } from '../../src/core/store.ts';
import { GLOBAL_DIR, resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';
import { cells } from '../helpers/table.ts';

function sandbox(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-cli-'));
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

test('init creates the workspace and config', () => {
  const cwd = sandbox();
  const { code } = run(['init'], cwd);
  assert.equal(code, 0);
  assert.ok(existsSync(path.join(cwd, '.my_context', 'config.json')));
  assert.ok(existsSync(path.join(cwd, '.my_context', 'items')));
  removeTree(cwd);
});

test('init writes a gitignore for the index', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  const ignore = readFileSync(path.join(cwd, '.my_context', '.gitignore'), 'utf8');
  assert.match(ignore, /\.index\.db/);
  removeTree(cwd);
});

test('add creates an item file with a slug id', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  const { code, out } = run(['add', '--summary-omitted', 'constraint', 'Postgres pool capped at 20', '--yes'], cwd);
  assert.equal(code, 0);
  assert.match(out, /CONST-postgres-pool-capped-at-20/);
  assert.ok(existsSync(path.join(
    cwd, '.my_context', 'items', 'constraint', 'CONST-postgres-pool-capped-at-20.md')));
  removeTree(cwd);
});

/**
 * Disabled by the project's own config, not by the catalogue: since Phase 3
 * removed `policy`, `postmortem` and `taxonomy`, nothing ships switched off,
 * so `categories.<name>.enabled: false` is now the only way to reach this
 * refusal — and it is the one the README documents.
 */
test('add rejects a disabled category with a helpful message', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  writeFileSync(
    path.join(cwd, '.my_context', 'config.json'),
    JSON.stringify({ categories: { standard: { enabled: false } } }),
  );
  const { code, out } = run(['add', '--summary-omitted', 'standard', 'Some convention'], cwd);
  assert.equal(code, 1);
  assert.match(out, /standard/);
  // `cmdAdd` now routes through `createItem`, so this is `createItem`'s own
  // disabled-category wording ("is disabled ... Enable it in ...") rather
  // than cmdAdd's former, differently-worded copy of the same check.
  assert.match(out, /disabled/i);
  assert.match(out, /categories\.standard\.enabled/);
  removeTree(cwd);
});

test('add rejects an unknown category and suggests the closest', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  const { code, out } = run(['add', '--summary-omitted', 'constraints', 'Typo'], cwd);
  assert.equal(code, 1);
  assert.match(out, /constraint/);
  removeTree(cwd);
});

/**
 * F3: the old `cmdAdd` refused an exact-title repeat too (an `existsSync`
 * check on the derived path), so this specific case was never silently
 * duplicated. What `createItem` actually adds here is the trust/validation
 * layer around that refusal: the id-family dedup that also catches a
 * REWORDED repeat of the same content (which `existsSync` could not,
 * since it only compared the exact slug), plus `validateBody`/
 * `validateObservationText`/enum/extra-key checks the old path skipped
 * entirely. This test pins the exact-title case specifically: it still
 * reports the existing item rather than creating a second one — now via
 * `createItem`'s "already captured" message instead of cmdAdd's own.
 */
test('add with the same category and title twice reports the existing item, not a near-duplicate', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  run(['add', '--summary-omitted', 'constraint', 'Pool cap', '--yes'], cwd);
  const { code, out } = run(['add', '--summary-omitted', 'constraint', 'Pool cap', '--yes'], cwd);
  assert.equal(code, 0);
  assert.match(out, /already captured/i);
  assert.doesNotMatch(out, /CONST-pool-cap-2/);
  assert.ok(!existsSync(path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-pool-cap-2.md')));
  removeTree(cwd);
});

test('add still lands a human item as active — the trust model only demotes agent-authored items', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  const { out } = run(['add', '--summary-omitted', 'constraint', 'Pool cap', '--yes'], cwd);
  assert.doesNotMatch(out, /draft/i);
  const ws = resolveWorkspace(cwd);
  const { store } = openStore(ws);
  assert.equal(store.get('CONST-pool-cap')?.status, 'active');
  assert.equal(store.get('CONST-pool-cap')?.origin, 'human');
  store.close();
  removeTree(cwd);
});

test('list shows added items', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  run(['add', '--summary-omitted', 'constraint', 'Pool cap', '--yes'], cwd);
  const { out } = run(['list'], cwd);
  assert.match(out, /CONST-pool-cap/);
  removeTree(cwd);
});

test('show prints the full item', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  run(['add', '--summary-omitted', 'constraint', 'Pool cap', '--yes'], cwd);
  const { out } = run(['show', 'CONST-pool-cap'], cwd);
  assert.match(out, /Pool cap/);
  removeTree(cwd);
});

test('status reports counts by category and status', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  run(['add', '--summary-omitted', 'constraint', 'Pool cap', '--yes'], cwd);
  run(['add', '--summary-omitted', 'lesson', 'Migrations need locks'], cwd);
  const { out } = run(['status'], cwd);
  assert.match(out, cells('constraint', '1'));
  assert.match(out, cells('lesson', '1'));
  assert.match(out, cells('active', '2'));
  removeTree(cwd);
});

test('usage lists only categories the workspace actually accepts', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  writeFileSync(
    path.join(cwd, '.my_context', 'config.json'),
    JSON.stringify({ categories: { standard: { enabled: false } } }),
  );
  const { code, out } = run([], cwd);
  assert.equal(code, 1);
  assert.match(out, /categories:.*\bconstraint\b/);
  // A category this project has switched off is refused by `resolveCategory`,
  // so the banner must not advertise a capture `mycontext add` will reject.
  // Written against a config-disabled category rather than a
  // catalogue-disabled one because Phase 3 removed the three that shipped off
  // — there is no longer a category that is disabled for everybody.
  assert.doesNotMatch(out, /categories:.*\bstandard\b/);
  removeTree(cwd);
});

test('an unknown command exits non-zero with usage', () => {
  const cwd = sandbox();
  const { code, out } = run(['frobnicate'], cwd);
  assert.equal(code, 1);
  assert.match(out, /usage/i);
  removeTree(cwd);
});

test('commands outside a workspace explain how to create one', () => {
  const cwd = sandbox();
  const { code, out } = run(['list'], cwd);
  assert.equal(code, 1);
  assert.match(out, /mycontext init/);
  removeTree(cwd);
});

function corruptItem(cwd: string): void {
  const dir = path.join(cwd, '.my_context', 'items', 'constraint');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'CONST-broken.md'), 'no frontmatter here\n');
}

/**
 * F2: `list` did what it was asked — list the good items — and a corrupt,
 * unrelated item elsewhere in the corpus must not turn that success into a
 * non-zero exit. The error is still reported (see the two tests below that
 * check the output text), but only `status` and `doctor` — the commands
 * whose whole job is to report corpus health — exit non-zero on a load
 * error. This is a behavior change from `list`'s previous exit code; see
 * `status surfaces a rebuild error...` below, which pins the unchanged case.
 */
test('list surfaces a rebuild error for a corrupt item as a warning but still exits 0', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  run(['add', '--summary-omitted', 'constraint', 'Good item', '--yes'], cwd);
  corruptItem(cwd);
  const { code, out } = run(['list'], cwd);
  assert.equal(code, 0);
  assert.match(out, /CONST-good-item/);
  assert.match(out, /my_context:.*error.*CONST-broken\.md/is);
  removeTree(cwd);
});

// `status`'s whole job is reporting corpus health, so it keeps the old
// behavior: a load error is exactly the kind of health problem it exists to
// surface, and it fails the exit code deliberately so CI notices.
test('status surfaces a rebuild error for a corrupt item and exits non-zero', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  run(['add', '--summary-omitted', 'constraint', 'Good item', '--yes'], cwd);
  corruptItem(cwd);
  const { code, out } = run(['status'], cwd);
  assert.equal(code, 1);
  assert.match(out, cells('constraint', '1'));
  assert.match(out, /my_context:.*error.*CONST-broken\.md/is);
  removeTree(cwd);
});

test('add succeeds and reports an unrelated corpus load error as a warning, not a failure', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  corruptItem(cwd);
  const { code, out } = run(['add', '--summary-omitted', 'lesson', 'A fresh lesson'], cwd);
  assert.equal(code, 0);
  assert.match(out, /LESSON-a-fresh-lesson/);
  assert.match(out, /my_context:.*error.*CONST-broken\.md/is);
  removeTree(cwd);
});

test('show succeeds and reports an unrelated corpus load error as a warning, not a failure', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  run(['add', '--summary-omitted', 'constraint', 'Good item', '--yes'], cwd);
  corruptItem(cwd);
  const { code, out } = run(['show', 'CONST-good-item'], cwd);
  assert.equal(code, 0);
  assert.match(out, /Good item/);
  assert.match(out, /my_context:.*error.*CONST-broken\.md/is);
  removeTree(cwd);
});

test('rebuild disclosing a pruned session dedupe file names the re-injection consequence', () => {
  // INV-nothing-is-dropped-silently, applied to pruning: a session idle past
  // the retention window loses its seen file, and its next injection is a
  // duplicate indistinguishable from a fresh session at injection time. The
  // ONE moment the information exists is the prune itself, so the disclosure
  // lives here (2026-08-16 task-3-4 review, minor 2).
  const cwd = sandbox();
  run(['init'], cwd);
  const stateDir = path.join(cwd, '.my_context', 'state');
  mkdirSync(stateDir, { recursive: true });
  const seen = path.join(stateDir, 'old-sess.seen.jsonl');
  writeFileSync(seen, '{"protocol":"mycontext-seen/1","id":"CONST-a","tier":"jit","at":"T"}\n');
  const stale = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
  utimesSync(seen, stale, stale);

  const { code, out } = run(['rebuild'], cwd);
  assert.equal(code, 0);
  assert.match(out, /pruned 1 stale/);
  assert.match(out, /1 of those were session dedupe file/);
  assert.match(out, /re-receive/);
  removeTree(cwd);
});

test('rebuild succeeds and reports an unrelated corpus load error as a warning, not a failure', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  run(['add', '--summary-omitted', 'constraint', 'Good item', '--yes'], cwd);
  corruptItem(cwd);
  const { code, out } = run(['rebuild'], cwd);
  assert.equal(code, 0);
  assert.match(out, /my_context:.*error.*CONST-broken\.md/is);
  removeTree(cwd);
});

test('init inside a subdirectory of an existing workspace warns and still succeeds', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  const sub = path.join(cwd, 'packages', 'a');
  mkdirSync(sub, { recursive: true });
  const { code, out } = run(['init'], sub);
  assert.equal(code, 0);
  assert.match(out, /warning/i);
  assert.match(out, new RegExp(path.join(cwd, '.my_context').replace(/\\/g, '\\\\')));
  assert.ok(existsSync(path.join(sub, '.my_context', 'config.json')));
  removeTree(cwd);
});

test('init in a fresh directory produces no ancestor warning', () => {
  const cwd = sandbox();
  const { out } = run(['init'], cwd);
  assert.doesNotMatch(out, /warning/i);
  removeTree(cwd);
});

/**
 * 1C.3 — `init` used to take `(cwd, out)` and never see argv at all, so every
 * flag and every positional was swallowed whole. `init --global` printed
 * "initialized …\.my_context" and created a PROJECT layer; so did
 * `init --nonsense-flag zzz`.
 *
 * `--pack <path>` was later accepted INSIDE this refusal, which is why the
 * sentence names one flag rather than none. Everything below is still refused,
 * and `test/cli/init-pack.test.ts` holds the other half — that the one
 * accepted flag is accepted.
 */
test('init refuses an argument rather than creating a workspace anyway', () => {
  for (const args of [
    ['init', '--global'],
    ['init', '--nonsense-flag', 'zzz'],
    ['init', '../elsewhere'],
    ['init', '--global=true'],
  ]) {
    const cwd = sandbox();
    const { code, out } = run(args, cwd);
    assert.equal(code, 1, `\`${args.join(' ')}\` must not exit 0:\n${out}`);
    assert.match(out, /init takes one flag, --pack <path>/);
    // The refusal is what it claims to be: nothing was created.
    assert.equal(
      existsSync(path.join(cwd, '.my_context')), false,
      `\`${args.join(' ')}\` created a workspace it said it refused to create`,
    );
    assert.doesNotMatch(out, /initialized/);
    removeTree(cwd);
  }
});

/**
 * `--global` earns a sentence naming what it cannot do and where the global
 * layer actually is — the difference between "no" and "here". It is the
 * sharpest of the four cases above: the user asked for the global corpus and
 * silently got a project one.
 */
test('init --global names the global root and the documented route to one', () => {
  const cwd = sandbox();
  const { code, out } = run(['init', '--global'], cwd);
  assert.equal(code, 1);
  assert.ok(out.includes(GLOBAL_DIR), `the refusal does not name ${GLOBAL_DIR}:\n${out}`);
  assert.match(out, /no command creates one or writes to one/i);
  removeTree(cwd);
});

/** A bare `init` is unaffected — the refusal is about arguments, not about
 * the command. */
test('init with no arguments still initializes', () => {
  const cwd = sandbox();
  const { code, out } = run(['init'], cwd);
  assert.equal(code, 0, out);
  assert.ok(existsSync(path.join(cwd, '.my_context', 'config.json')));
  removeTree(cwd);
});

test('a command whose store operation throws still closes the handle', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  // Force Store.open to fail after the workspace exists: the db path is a
  // directory instead of a file.
  mkdirSync(path.join(cwd, '.my_context', '.index.db'), { recursive: true });
  const { code, out } = run(['list'], cwd);
  assert.equal(code, 1);
  assert.match(out, /my_context:/);
  assert.doesNotMatch(out, /at Object|at Module|node:internal/);
  // If the store handle leaked, this throws on Windows.
  removeTree(cwd);
});

test('openStore closes the handle when rebuild throws AFTER a successful open — the real leak-guard path', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  run(['add', '--summary-omitted', 'constraint', 'Good item', '--yes'], cwd);
  const ws = resolveWorkspace(cwd);

  // Store.open succeeds fully (unlike the directory-as-dbPath test above,
  // which never opens a handle at all); rebuild() throws only once inside
  // the transaction, exercising openStore's catch(store.close(); throw err;).
  const original = Store.prototype.deleteByLayer;
  Store.prototype.deleteByLayer = function (): never { throw new Error('simulated deleteByLayer failure'); };
  try {
    assert.throws(() => openStore(ws), /simulated deleteByLayer failure/);
  } finally {
    Store.prototype.deleteByLayer = original;
  }

  // If the handle leaked, removing the workspace (which deletes the open db
  // file) throws on Windows.
  removeTree(cwd);
});

test('the rendered CLI error line names the broken file exactly once', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  corruptItem(cwd);
  const { out } = run(['list'], cwd);
  const line = out.split('\n').find((l) => l.includes('CONST-broken.md'));
  assert.ok(line, 'expected an error line naming CONST-broken.md');
  const occurrences = line!.split('CONST-broken.md').length - 1;
  assert.equal(occurrences, 1, `expected the filename exactly once, got: ${line}`);
  removeTree(cwd);
});

test('LoadError text is never doubly prefixed with "my_context:"', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  corruptItem(cwd);
  const { out } = run(['list'], cwd);
  assert.doesNotMatch(out, /my_context:[^\n]*my_context:/);
  removeTree(cwd);
});

test('an unexpected exception surfaces as a my_context message, not a stack trace', () => {
  const cwd = sandbox();
  run(['init'], cwd);
  writeFileSync(path.join(cwd, '.my_context', 'config.json'), '{ not valid json');
  const { code, out } = run(['list'], cwd);
  assert.equal(code, 1);
  assert.match(out, /my_context:/);
  assert.doesNotMatch(out, /at Object|at Module|node:internal/);
  removeTree(cwd);
});
