import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli, openStore } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * **Can `mycontext add` write an item under the id it already has?**
 *
 * `test/cli/add-faithful-recreation.test.ts` asked whether an existing item
 * could be re-created at all, and closed the last two fields that had no
 * spelling: an observation's kind, and `valid_from`. It left the field that
 * cannot be repaired afterwards. `add` derives an id from the TITLE
 * (`makeId`, slug.ts), and 36 of the 44 items in `.my_context.nested-44/`
 * have ids that do not derive from theirs — `ADR-build-rather-than-adopt`,
 * `CONST-zero-runtime-dependencies`, `STD-error-message-conventions`.
 *
 * **This is not hypothetical and it has already cost something.**
 * `STD-error-message-conventions` was re-captured on 2026-09-03 and landed as
 * `STD-error-messages-are-prefixed-once-and-name-the-file-once`. Its six
 * citation sites in `src/` and `test/` — `src/cli/commands/ack.ts:31`,
 * `src/core/context-occupancy.ts:202`, `src/mcp/provenance.ts:38`,
 * `test/cli/ack-all.test.ts:121`, `test/cli/add-faithful-recreation.test.ts:137`
 * and `test/hooks/subagent-start-nested-corpus.test.ts:214` — have resolved to
 * nothing ever since. An id is a public name: the key of every relation, every
 * audit record, and every citation typed into a source comment.
 *
 * **What each test below is for.** The happy path proves the id is carried
 * VERBATIM rather than normalised on the way through. The three refusals are
 * the three ways an explicit id is worse than a derived one — it can be a
 * path, it can name the wrong category, and it can already be taken — and the
 * last of those is the one where a silent success would destroy an item. The
 * final test is the boundary: this flag is on `add` and on nothing else.
 *
 * On `--yes`: stdin is not a TTY under `node --test`, so `confirmAction` takes
 * its non-interactive branch, and `--yes` is what gets a normative capture
 * past it.
 */

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-original-id-'));
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
 * The real migration, written out as a command line.
 *
 * The title, body, observations, scope, tags, severity and `valid_from` are
 * `.my_context.nested-44/items/standard/STD-error-message-conventions.md`
 * verbatim; the summary is this test's own, because the source item predates
 * the summary field and a capture is refused without one. The point of using
 * the REAL item rather than an invented one is the gap it exhibits: the id and
 * the title share not one word, so nothing but an explicit id can produce it.
 */
const MIGRATION = [
  'add', 'standard', 'Error messages are prefixed once and name the file once',
  '--original-id', 'STD-error-message-conventions',
  '--summary', 'Every error message names the problem once, without repeating its own prefix.',
  '--body',
  'Thrown errors carry the `my_context:` prefix. `LoadError.message` carries a bare\n' +
  'sentence — the CLI owns the prefix and the filename, so a message that embeds\n' +
  'either produces `my_context: error  f.md: my_context: f.md ...`.',
  '--observation',
  'rule=A failed call should teach: name the closest valid value and where to look',
  '--observation',
  'exception=The duplicate-id message names two files deliberately — there the repetition ' +
  'is the information',
  '--scope', 'src/**',
  '--tags', 'errors',
  '--valid-from', '2026-08-13',
  '--yes',
];

const ORIGINAL = 'STD-error-message-conventions';

/** What `add` would have called it without the flag — the whole problem, named. */
const DERIVED = 'STD-error-messages-are-prefixed-once-and-name-the-file-once';

test('the id is carried verbatim onto the item, its file name and its frontmatter', () => {
  const cwd = sandbox();
  const { code, out } = run(MIGRATION, cwd);
  assert.equal(code, 0, out);

  const item = get(cwd, ORIGINAL);
  assert.ok(item, `expected ${ORIGINAL}; the corpus holds ${
    items(cwd).map((i) => i.id).join(', ')}\n${out}`);
  assert.equal(
    get(cwd, DERIVED), null,
    'the title-derived id was minted as well as, or instead of, the one asked for. There is ' +
    'no second item here: an explicit id replaces the derivation, it does not race it.',
  );

  // The id is also a PATH and a frontmatter line, and a flag that produced the
  // right index entry over a file called something else would be worse than no
  // flag at all — the Markdown is the source of truth.
  assert.equal(item!.filePath, `items/standard/${ORIGINAL}.md`);
  const file = path.join(cwd, '.my_context', 'items', 'standard', `${ORIGINAL}.md`);
  assert.equal(existsSync(file), true, `${file} was not written`);
  assert.match(readFileSync(file, 'utf8'), new RegExp(`^id: ${ORIGINAL}$`, 'mu'));

  // And nothing else moved: the id was carried, not substituted for the rest
  // of the item. `valid_from` is checked beside it because the two are the
  // same act — an item copied in from somewhere it already existed.
  assert.equal(item!.title, 'Error messages are prefixed once and name the file once');
  assert.equal(item!.validFrom, '2026-08-13');
  assert.deepEqual(item!.observations.map((o) => o.category), ['rule', 'exception']);
  removeTree(cwd);
});

test('an id that is a path is refused, and nothing is written anywhere', () => {
  const cwd = sandbox();
  const { code, out } = run(
    ['add', '--summary-omitted', 'lesson', 'A lesson', '--original-id', '../../../evil'],
    cwd,
  );
  assert.equal(code, 1, out);
  // `validateExplicitId`'s own wording, reached through the flag. The refusal
  // has to say WHY an id is constrained at all — it becomes a file name — or
  // the rule reads as arbitrary strictness.
  assert.match(out, /--original-id contains a path separator or "\.\."/u);
  assert.match(out, /items\/<type>\/<id>\.md/u, 'the refusal does not say an id is a file name');
  assert.deepEqual(items(cwd), [], 'a refused capture created an item');
  // The specific hazard the guard exists for: a directory tree walked out of
  // the workspace, created on the way by `mkdirSync`.
  assert.equal(existsSync(path.join(cwd, 'evil.md')), false);
  removeTree(cwd);
});

test('an id whose shape no file name can hold is refused', () => {
  const cwd = sandbox();
  const { code, out } = run(
    ['add', '--summary-omitted', 'lesson', 'A lesson', '--original-id', 'LESSON-$(echo hi)'],
    cwd,
  );
  assert.equal(code, 1, out);
  assert.match(out, /--original-id is not a usable id/u);
  assert.deepEqual(items(cwd), []);
  removeTree(cwd);
});

test('an id carrying another category\'s prefix is refused', () => {
  const cwd = sandbox();
  const { code, out } = run(
    ['add', 'standard', 'A standard', '--summary-omitted',
      '--original-id', 'LESSON-something-learned', '--yes'],
    cwd,
  );
  assert.equal(code, 1, out);
  // Nothing downstream would ever object to this: the type is read from the
  // frontmatter, not from the name. That is exactly why it is refused here —
  // the id would simply go on naming the wrong kind of item forever.
  assert.match(out, /not an id of a standard/u);
  assert.match(out, /begin with "STD-"/u, 'the refusal does not name the prefix to use instead');
  assert.deepEqual(items(cwd), []);
  removeTree(cwd);
});

test('the prefix check reads the CATEGORY it is being filed under, not the id alone', () => {
  const cwd = sandbox();
  // The mirror of the test above, and it is what stops the check from being
  // satisfiable by any `STD-` string: a lowercase prefix is the SAME category
  // (`validateExplicitId` deliberately keeps loading the lowercase ids an
  // older corpus carries), so it is accepted, and case is not the question.
  const { code, out } = run(
    ['add', 'standard', 'A standard', '--summary-omitted',
      '--original-id', 'std-carried-in-lowercase', '--yes'],
    cwd,
  );
  assert.equal(code, 0, out);
  assert.ok(get(cwd, 'std-carried-in-lowercase'));
  removeTree(cwd);
});

test('an id an item already holds is refused, and the item on disk is untouched', () => {
  const cwd = sandbox();
  assert.equal(run(MIGRATION, cwd).code, 0);
  const file = path.join(cwd, '.my_context', 'items', 'standard', `${ORIGINAL}.md`);
  const before = readFileSync(file, 'utf8');

  const { code, out } = run(
    ['add', 'standard', 'A different standard entirely', '--summary-omitted',
      '--original-id', ORIGINAL, '--yes'],
    cwd,
  );
  assert.equal(code, 1, out);
  // `createItem`'s `occupiedError`, reached through the flag. A silent
  // overwrite here would destroy an item, so the refusal is the whole point of
  // the flag being safe to have at all — and it names the two commands that DO
  // change an existing item, per STD-error-message-conventions.
  assert.match(out, /already exists with different content/u);
  assert.match(out, /update_item|supersede_item/u);
  assert.equal(readFileSync(file, 'utf8'), before, 'the existing item was rewritten');
  assert.equal(items(cwd).length, 1, 'a second item was created under a collided id');
  removeTree(cwd);
});

test('the same id with the same content is the no-op it always was, not a refusal', () => {
  const cwd = sandbox();
  assert.equal(run(MIGRATION, cwd).code, 0);
  // The other half of the collision rule, and it has to keep working: a
  // migration run twice — the likeliest way this flag is ever used — must not
  // fail on its second pass. `createItem` compares content hashes and reports
  // the item it already has.
  const { code, out } = run(MIGRATION, cwd);
  assert.equal(code, 0, out);
  assert.match(out, new RegExp(`already captured as ${ORIGINAL}\\. Nothing changed\\.`, 'u'));
  assert.equal(items(cwd).length, 1);
  removeTree(cwd);
});

test('--original-id is single-valued: two of them is a refusal, not a silent choice', () => {
  const cwd = sandbox();
  const { code, out } = run(
    ['add', '--summary-omitted', 'lesson', 'A lesson',
      '--original-id', 'LESSON-one', '--original-id', 'LESSON-two'],
    cwd,
  );
  assert.equal(code, 1, out);
  // The REPEATED-flag refusal specifically, and it is asserted by its own
  // words on purpose: a bare `assert.match(out, /--original-id/)` here passes
  // when the flag does not exist at all — the unknown-option refusal names it
  // too — which is a test that cannot fail, and this project treats one of
  // those as worth nothing. Watched: with `--original-id` stripped from
  // `ADD_VALUE_FLAGS`, this is the only test in the file that stayed green
  // until the assertion below replaced it.
  assert.match(out, /--original-id was given 2 times \("LESSON-one", "LESSON-two"\)/u);
  assert.doesNotMatch(out, /unknown (?:flag|option)/u);
  assert.deepEqual(items(cwd), [], 'one of two ids was quietly picked and an item created');
  removeTree(cwd);
});

test('`edit` has no --original-id, because an id may not change after creation', () => {
  const cwd = sandbox();
  assert.equal(run(MIGRATION, cwd).code, 0);

  const { code, out } = run(['edit', ORIGINAL, '--original-id', 'STD-something-else'], cwd);
  assert.equal(code, 1, out);
  assert.match(
    out, /unknown (?:flag|option) "--original-id"/u,
    'edit accepted --original-id. Every relation, citation and audit record points AT an id, ' +
    'so an id that can change after creation breaks all of them at once and leaves a ' +
    'correct-looking audit trail of having done it. Renaming an item is `mycontext supersede`.',
  );
  // And the item still answers to the id it was created with.
  assert.ok(get(cwd, ORIGINAL));
  assert.equal(get(cwd, 'STD-something-else'), null);
  removeTree(cwd);
});
