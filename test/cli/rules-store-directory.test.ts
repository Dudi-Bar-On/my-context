// @basis TASK-the-environment-variable-that-steers-every-door-is-ignored, TASK-the-store-version-and-changelog-are-readable-only-from-code, TASK-the-store-loads-refuses-what-it-cannot-parse-and-proves-it
/**
 * **`mycontext rules` answers about the store a DOOR is reading, and a real
 * install can ask which store version it has.**
 *
 * Two findings from report 6, filed as `store/8` and `store/9`.
 *
 * ── `store/8` — THE VARIABLE THAT STEERS EVERY DOOR ────────────────────────
 *
 * `MYCONTEXT_RULES_DIR` steers `deliverAtDoor` and `assertDoor`, and all three
 * `rules` subcommands ignored it: with the variable set, the doors delivered
 * directory X while `rules list` and `rules verify` described the package's
 * own. The sharp end is that `missedDoorLine` — the sentence the product
 * prints to somebody asking *"what was I given?"* — names those exact two
 * commands, so the product's own advice was guaranteed to answer about a
 * different store with nothing disclosing the divergence.
 *
 * ── `store/9` — A VERSION ONLY EXCLUDED CODE COULD READ ────────────────────
 *
 * The store carries `version: 5`, a `publishedAt` and five changelog rows, and
 * every reader of them lived under `src/ui/maintenance/`, which `package.json`
 * EXCLUDES from the published package. In a real install there was no way to
 * answer "which store version do I have". The exclusion is correct and is the
 * security model — report 5 examined it and would change nothing — so the fix
 * is a SHIPPED surface, not a smaller exclusion, and the test below asserts
 * both halves so a future repair cannot take the easy wrong one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { RULES_DIR_ENV, resolveStoreDir } from '../../src/rules/deliver.ts';
import { entriesDir } from '../../src/rules/store.ts';
import { readManifest } from '../../src/rules/manifest.ts';
import { missedDoorLine } from '../../src/rules/delivered.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO = path.resolve(import.meta.dirname, '..', '..');

interface Run { code: number; text: string }

function cli(argv: string[], cwd: string): Run {
  const lines: string[] = [];
  const code = runCli(argv, cwd, (s) => lines.push(s));
  return { code, text: lines.join('\n') };
}

/**
 * A scratch COPY of the shipped store, and the variable pointed at it for the
 * duration — restored in `finally`, because the variable steers every door in
 * this process and a leak would silently redirect every later test.
 */
function withSubstitutedStore(fn: (dir: string, cwd: string) => void): void {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-substituted-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-rulesdir-'));
  const before = process.env[RULES_DIR_ENV];
  try {
    cpSync(entriesDir(), dir, { recursive: true });
    assert.equal(runCli(['init'], cwd, () => {}), 0, 'the probe workspace did not initialize');
    assert.notEqual(
      path.resolve(dir), path.resolve(entriesDir()),
      'the scratch store IS the package store, so nothing below can tell the two apart',
    );
    process.env[RULES_DIR_ENV] = dir;
    fn(dir, cwd);
  } finally {
    if (before === undefined) delete process.env[RULES_DIR_ENV];
    else process.env[RULES_DIR_ENV] = before;
    removeTree(dir);
    removeTree(cwd);
  }
}

/* ══ 1. `store/8`: THE THREE SUBCOMMANDS FOLLOW THE VARIABLE ══════════════ */

test('`rules list` answers about the directory a door reads, and says it is not the package', () => {
  withSubstitutedStore((dir, cwd) => {
    assert.equal(
      path.resolve(resolveStoreDir()), path.resolve(dir),
      'the door resolver does not point at the scratch store, so the fixture is broken rather ' +
      'than the command',
    );
    const run = cli(['rules', 'list', '--json'], cwd);
    const body = JSON.parse(run.text) as { store: string; substituted: boolean };
    assert.equal(
      path.resolve(body.store), path.resolve(dir),
      'the command described a different store from the one every door reads (store/8)',
    );
    assert.equal(body.substituted, true, 'the divergence was not disclosed');
    assert.match(
      cli(['rules', 'list'], cwd).text, /NOT the installed package/,
      'the text surface answers about the substituted store and says nothing about it, which is ' +
      'the confident wrong answer this finding is about',
    );
  });
});

test('`rules verify` reports damage in the substituted store, not health in the package', () => {
  withSubstitutedStore((dir, cwd) => {
    // The package store is intact; only the copy is damaged. A command still
    // reading the package would answer 0 here, which is the defect exactly.
    writeFileSync(path.join(dir, 'planted.md'), '---\nid: planted\n---\n', 'utf8');
    const run = cli(['rules', 'verify'], cwd);
    assert.equal(
      run.code, 1,
      'verify exited 0 while the store every door reads carries a file nobody shipped (store/8)',
    );
    assert.match(run.text, /planted\.md/, 'the damaged entry was not named');
  });
});

test('the two commands `missedDoorLine` sends the reader to are the two that follow the door', () => {
  const sentence = missedDoorLine('k');
  // Anti-vacuity: if the sentence stops naming them, this test must fail
  // rather than quietly assert nothing.
  assert.match(sentence, /mycontext rules list/);
  assert.match(sentence, /mycontext rules verify/);
  withSubstitutedStore((dir, cwd) => {
    for (const argv of [['rules', 'list', '--json'], ['rules', 'verify', '--json']]) {
      const body = JSON.parse(cli(argv, cwd).text) as { store: string };
      assert.equal(
        path.resolve(body.store), path.resolve(dir),
        `\`mycontext ${argv.slice(0, 2).join(' ')}\` — named in the sentence a reader is given ` +
        'when a door may have been missed — describes a different store from the one the doors ' +
        'read. The product\'s own advice for "what was I given?" answers about somewhere else.',
      );
    }
  });
});

test('`verify --restore` is reachable code once the two directories can differ', () => {
  withSubstitutedStore((dir, cwd) => {
    const victim = 'def-a-door.md';
    rmSync(path.join(dir, victim));
    const run = cli(['rules', 'verify', '--restore'], cwd);
    assert.match(
      run.text, /restored 1 entry\(s\)/,
      'nothing was restored. `restoreEntries` was unreachable while both names resolved to the ' +
      'package directory; if it is unreachable again, the honest report is the only behaviour ' +
      'left and this assertion is what says so.',
    );
    assert.ok(
      readFileSync(path.join(dir, victim), 'utf8').length > 0,
      'the command reported a restore and the file is not back',
    );
  });
});

/* ══ 2. `store/9`: THE VERSION, FROM A SURFACE THAT SHIPS ═════════════════ */

test('a real install can read which store version it has', () => {
  const expected = readManifest(entriesDir()).store;
  assert.ok(expected !== undefined, 'the shipped manifest carries no store metadata to read');
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-storever-'));
  try {
    assert.equal(runCli(['init'], cwd, () => {}), 0, 'the probe workspace did not initialize');
    const body = JSON.parse(cli(['rules', 'verify', '--json'], cwd).text) as
      { storeVersion: number | null; publishedAt: string | null };
    assert.equal(body.storeVersion, expected.version, 'the shipped surface reports a different version');
    assert.equal(body.publishedAt, expected.publishedAt);
    assert.match(
      cli(['rules', 'verify'], cwd).text, new RegExp(`store version ${expected.version}`),
      'the version is in --json only, so a person at a terminal still cannot answer the question',
    );
  } finally { removeTree(cwd); }
});

/**
 * **The fix had to be a shipped surface, and NOT a smaller exclusion.**
 *
 * The maintenance tool's exclusion is the security model, asserted two ways
 * and examined by report 5, which would change nothing. So this pins both
 * sides: the tool stays out of the package, and the command that now answers
 * the version question is in it.
 */
test('the version is answered by code the package ships, and the maintenance tool still is not', () => {
  const files = (JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8')) as
    { files: string[] }).files;
  assert.ok(
    files.includes('!src/ui/maintenance/'),
    'the maintenance tool is no longer excluded from the published package. That exclusion is ' +
    'the security model; answering the store-version question by shipping the tool is the ' +
    'wrong repair (store/9).',
  );
  const answering = path.join('src', 'cli', 'commands', 'rules.ts');
  assert.ok(
    files.some((f) => !f.startsWith('!') && answering.startsWith(f.replaceAll('/', path.sep))),
    `${answering} is not inside anything package.json ships, so the surface answering the ` +
    'version question does not reach a real install',
  );
  // An IMPORT, not a mention: the file's own comment explains the exclusion,
  // and a scan that could not tell prose from an edge would force the
  // explanation out of the one place it is useful.
  const imports = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]/g;
  const reached = [...readFileSync(path.join(REPO, answering), 'utf8').matchAll(imports)]
    .map((m) => m[1]).filter((s) => s.includes('maintenance'));
  assert.deepEqual(
    reached, [],
    'the shipped command imports from the excluded maintenance tree, so the version it prints ' +
    'comes from code a real install never receives',
  );
});
