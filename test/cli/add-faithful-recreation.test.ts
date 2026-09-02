import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli, openStore } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * **Can `mycontext add` write an item that already exists?**
 *
 * That is one question, not a bag of flag tests, and it is the question a
 * migration asks: an item being carried into this corpus from somewhere else
 * has observations under kinds like `[limit]`, `[exception]` and `[invariant]`,
 * and it has its own start date. Until `--observation` and `--valid-from`
 * existed, neither documented write path could produce it — `mycontext add`
 * could write only `[note]` observations and stamped `valid_from` from the
 * clock, and the MCP `create_item` tool passes `origin: 'agent'`, which
 * `trustedStatus` demotes to `draft` for any normative category. So the CLI
 * path lost the kinds and the MCP path lost the status.
 *
 * The last test in this file is the one that actually settles it: an item is
 * created through `add` and its file on disk is compared, byte for byte,
 * against a fixture written by hand. Every assertion above it is a narrower
 * claim about one field, kept separate so that a failure names which field
 * moved rather than printing two files.
 *
 * On `--yes`: stdin is not a TTY under `node --test`, so `confirmAction` takes
 * its non-interactive branch — the same branch a hook or a script hits — and
 * `--yes` is what gets a normative capture past it.
 */

const FIXTURE = path.join(
  import.meta.dirname, '..', 'fixtures', 'migrated-constraint.md',
);

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-faithful-'));
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

/**
 * The invocation the byte-identity test uses, and the one every field test
 * below reads a single field out of. Written once: two spellings of the same
 * capture would let a field test pass against a command line the fixture test
 * never runs.
 */
const CAPTURE = [
  'add', 'constraint', 'Connection pools are capped at twenty',
  '--summary', 'Every worker shares one small fixed budget of database connections.',
  '--body',
  'The database allows a hundred connections and four services share it, so no service ' +
  'may take more than a quarter of them.',
  '--observation', 'limit=Pool size must never exceed 20 across all workers',
  '--note', 'Recovered from the 2026-08-13 incident review.',
  '--observation', 'exception=The migration runner may open a second pool while a migration runs',
  '--observation',
  "invariant=`max_connections` is 100 and the four services share it, so a worker's own retry " +
  'loop counts against the cap [admin sessions included]',
  '--scope', 'src/db/**,migrations/**',
  '--tags', 'database,ops',
  '--severity', 'hard',
  '--valid-from', '2026-08-13',
  '--yes',
];

const ID = 'CONST-connection-pools-are-capped-at-twenty';

// --- the kinds themselves ---

test('every observation kind reaches the item, exactly as written and in order', () => {
  const cwd = sandbox();
  const { code, out } = run(CAPTURE, cwd);
  assert.equal(code, 0, out);
  const item = get(cwd, ID);
  assert.ok(item, `expected ${ID}\n${out}`);
  assert.deepEqual(
    item!.observations.map((o) => o.category),
    ['limit', 'note', 'exception', 'invariant'],
    'the kinds are what `--observation kind=text` was given, and `--note` keeps its place ' +
    'BETWEEN them: the two flags are read in one command-line scan, because `## Observations` ' +
    'is a list and an item whose observations came back regrouped by flag is not the item it ' +
    'was copied from.',
  );
  assert.equal(
    item!.observations[0].text, 'Pool size must never exceed 20 across all workers',
    'the text is everything after the FIRST "=", taken whole',
  );
  removeTree(cwd);
});

test('observation text carries backticks, brackets, commas and apostrophes intact', () => {
  const cwd = sandbox();
  assert.equal(run(CAPTURE, cwd).code, 0);
  const item = get(cwd, ID);
  assert.equal(
    item!.observations[3].text,
    "`max_connections` is 100 and the four services share it, so a worker's own retry loop " +
    'counts against the cap [admin sessions included]',
    'the value is one argv token split once on "=", so nothing in it is re-parsed: a further ' +
    '"=", a comma, a backtick, a bracket and an apostrophe all reach the file unchanged.',
  );
  removeTree(cwd);
});

test('an observation kind the format cannot store is refused, and nothing is created', () => {
  const cwd = sandbox();
  const { code, out } = run(
    ['add', '--summary-omitted', 'lesson', 'A lesson',
      '--observation', 'root cause=the pool leaked'],
    cwd,
  );
  assert.equal(code, 1);
  // The refusal is `validateObservationCategory`'s, which reads the parser's
  // own grammar out of item.ts rather than a second list kept beside it. It
  // has to say what IS acceptable and what to write instead, per
  // STD-error-message-conventions: "name the closest valid value and where to
  // look".
  assert.match(out, /--observation's kind is "root cause"/);
  assert.match(out, /\[a-z0-9_-\]\+/, 'the message does not name what a kind may contain');
  assert.match(out, /letters, digits, underscore and hyphen only/);
  assert.match(out, /"root-cause"/, 'the message does not offer the corrected spelling');
  assert.deepEqual(items(cwd), [], 'no item may be created by a refused invocation');
  removeTree(cwd);
});

test('a kind that is merely mis-cased is refused as mis-cased, not as unstorable', () => {
  const cwd = sandbox();
  const { code, out } = run(
    ['add', '--summary-omitted', 'lesson', 'A lesson', '--observation', 'Limit=too many'], cwd,
  );
  assert.equal(code, 1);
  assert.match(out, /not all-lowercase/,
    'the two failures are different — one line is DROPPED on read-back, the other is silently ' +
    'REWRITTEN — and the product distinguishes them by name.',
  );
  assert.match(out, /"limit"/);
  assert.deepEqual(items(cwd), []);
  removeTree(cwd);
});

test('--observation without a kind says what the shape is, and names --note', () => {
  const cwd = sandbox();
  const { code, out } = run(
    ['add', '--summary-omitted', 'lesson', 'A lesson', '--observation', 'just some text'], cwd,
  );
  assert.equal(code, 1);
  assert.match(out, /--observation takes kind=text/);
  assert.match(out, /--note/, 'the refusal has to name the flag that takes bare text');
  assert.deepEqual(items(cwd), []);
  removeTree(cwd);
});

// --- valid_from ---

test('--valid-from round-trips onto the item and into the file', () => {
  const cwd = sandbox();
  assert.equal(run(CAPTURE, cwd).code, 0);
  const item = get(cwd, ID);
  assert.equal(item!.validFrom, '2026-08-13');
  const file = readFileSync(path.join(cwd, '.my_context', ...item!.filePath.split('/')), 'utf8');
  assert.match(file, /^valid_from: 2026-08-13$/m);
  removeTree(cwd);
});

test('without --valid-from the clock still supplies the day', () => {
  const cwd = sandbox();
  assert.equal(run(['add', '--summary-omitted', 'lesson', 'No date given'], cwd).code, 0);
  assert.match(get(cwd, 'LESSON-no-date-given')!.validFrom!, /^\d{4}-\d{2}-\d{2}$/);
  removeTree(cwd);
});

test('a date that does not exist is refused rather than rounded', () => {
  const cwd = sandbox();
  const { code, out } = run(
    ['add', '--summary-omitted', 'lesson', 'A lesson', '--valid-from', '2026-02-31'], cwd,
  );
  assert.equal(code, 1);
  assert.match(out, /--valid-from is "2026-02-31"/);
  assert.match(out, /YYYY-MM-DD/, 'the refusal has to say what shape is wanted');
  assert.match(out, /a day that exists/);
  assert.deepEqual(items(cwd), [], '2026-02-31 must not land as 2026-03-03');
  removeTree(cwd);
});

test('a date the parser would silently re-spell is refused too', () => {
  const cwd = sandbox();
  for (const bad of ['2026-8-13', '13/08/2026', 'yesterday', '2026-08-13T00:00:00Z']) {
    const { code, out } = run(
      ['add', '--summary-omitted', 'lesson', 'A lesson', '--valid-from', bad], cwd,
    );
    assert.equal(code, 1, `${bad} was accepted:\n${out}`);
  }
  assert.deepEqual(items(cwd), []);
  removeTree(cwd);
});

test('valid_from is still refused as an --extra key, which would bypass the check', () => {
  const cwd = sandbox();
  const { code, out } = run(
    ['add', '--summary-omitted', 'lesson', 'A lesson', '--extra', 'valid_from=not-a-date'], cwd,
  );
  assert.equal(code, 1);
  assert.match(out, /reserved frontmatter field/);
  assert.deepEqual(items(cwd), []);
  removeTree(cwd);
});

// --- the trust boundary the CLI path exists for ---

test('a normative capture through add is origin human and status active', () => {
  const cwd = sandbox();
  assert.equal(run(CAPTURE, cwd).code, 0);
  const item = get(cwd, ID);
  assert.equal(item!.origin, 'human');
  assert.equal(
    item!.status, 'active',
    'this is the half the MCP route cannot do: create_item passes origin "agent" and ' +
    'trustedStatus demotes a normative agent capture to draft.',
  );
  removeTree(cwd);
});

// --- and the whole item, byte for byte ---

/**
 * **The property the migration actually needs.**
 *
 * A hand-written item, and the same item produced by `mycontext add` — compared
 * as bytes, not as fields, because a field-by-field comparison cannot see the
 * things that make a corpus reload differently: key order in the frontmatter,
 * the blank line before `## Observations`, the checksum the file records over
 * its own contents.
 *
 * The fixture is authored, not captured: it is what somebody migrating a corpus
 * would write by hand, down to the `checksum:` line, which is the one field
 * nobody types from memory — it is the item's own hash over its content, and a
 * fixture carrying a stale one fails here rather than anywhere later.
 */
test('an item created through add is byte-identical to the same item written by hand', () => {
  const cwd = sandbox();
  const { code, out } = run(CAPTURE, cwd);
  assert.equal(code, 0, out);
  const written = readFileSync(
    path.join(cwd, '.my_context', 'items', 'constraint', `${ID}.md`), 'utf8',
  );
  assert.equal(
    written, readFileSync(FIXTURE, 'utf8').replaceAll('\r\n', '\n'),
    '`mycontext add` no longer reproduces an item that already exists. Compare the two files: ' +
    'if the difference is a field the command cannot express, that is the defect this test ' +
    'exists for — do not edit the fixture to match the command.',
  );
  removeTree(cwd);
});
