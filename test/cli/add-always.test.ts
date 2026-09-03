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
 * **Can `mycontext add` capture an item that is already PINNED?**
 *
 * `test/cli/add-original-id.test.ts` closed the id; this file closes the last
 * field in `reports/CONTINUE-HERE.md`'s verbatim list that `add` could not
 * express. Seven of the 44 items in `.my_context.nested-44/items/` carry
 * `always: true` — `CONST-node-24-no-build-step`,
 * `CONST-zero-runtime-dependencies`, `INV-markdown-is-the-source-of-truth`,
 * `INV-nothing-is-dropped-silently`, `INV-posix-normalized-paths`,
 * `NOGOAL-not-a-claude-mem-replacement` and `RULE-erasable-syntax-only` — and
 * before this flag every one of them had to be captured unpinned and then
 * pinned by a second command, which is two audit records for one intent and a
 * window in which the item exists NOT doing the thing it exists to do.
 * `CreateInput.always` already existed; only the spelling was missing.
 *
 * **What each test below is for.** The happy path proves `always: true`
 * reaches the frontmatter, which is the source of truth — an index entry over
 * a file that says `false` would be worse than no flag. The absent case pins
 * the default, because a capture that pinned by accident is the expensive
 * mistake. `--always=false` is the same word `edit` uses, so the two commands
 * are asserted to agree about it rather than merely to compile. The refusals
 * are the three ways the flag can be wrong: an unreadable value, both answers
 * at once, and a tier where `always` governs nothing. And the preview is
 * asserted because the `--yes` gate is the whole of this flag's consent: a
 * gate that does not say the item will be pinned is a gate approving something
 * else.
 *
 * On `--yes`: stdin is not a TTY under `node --test`, so `confirmAction` takes
 * its non-interactive branch, and `--yes` is what gets a normative capture
 * past it.
 */

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-add-always-'));
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

function markdown(cwd: string, type: string, id: string): string {
  return readFileSync(path.join(cwd, '.my_context', 'items', type, `${id}.md`), 'utf8');
}

/**
 * A real pinned item, carried across as a command line.
 *
 * `INV-posix-normalized-paths` is one of the seven, and it is used rather than
 * an invented item so that the flags under test are the ones the merge will
 * actually type: an id that does not derive from the title, a severity, a
 * `valid_from` from before this repository, and the pin.
 */
const PINNED = [
  'add', 'invariant', 'Stored paths are POSIX-normalized',
  '--original-id', 'INV-posix-normalized-paths',
  '--summary', 'Every path this project stores uses forward slashes, whatever the machine.',
  '--body', 'Paths written to the index and to frontmatter use forward slashes on every '
    + 'platform. A backslash reaching disk makes the same file two files.',
  '--severity', 'hard',
  '--always',
  '--valid-from', '2026-08-13',
  '--yes',
];

const PINNED_ID = 'INV-posix-normalized-paths';

test('--always writes always: true to the frontmatter, not merely to the index', () => {
  const cwd = sandbox();
  const { code, out } = run(PINNED, cwd);
  assert.equal(code, 0, out);

  const item = get(cwd, PINNED_ID);
  assert.ok(item, `expected ${PINNED_ID}; the corpus holds ${
    items(cwd).map((i) => i.id).join(', ')}\n${out}`);
  assert.equal(item!.always, true, 'the item was captured unpinned');
  // The Markdown is the source of truth (INV-markdown-is-the-source-of-truth),
  // so an index that said `true` over a file that said `false` would survive
  // until the next `mycontext rebuild` and then silently unpin the item.
  assert.match(markdown(cwd, 'invariant', PINNED_ID), /^always: true$/mu);
  // And the pin did not arrive at the cost of the rest of the capture: this is
  // one act, not a capture followed by a second one.
  assert.equal(item!.severity, 'hard');
  assert.equal(item!.validFrom, '2026-08-13');
  removeTree(cwd);
});

test('a capture without --always is not pinned, and says so on disk', () => {
  const cwd = sandbox();
  const { code, out } = run(
    ['add', 'invariant', 'Stored paths are POSIX-normalized', '--summary-omitted',
      '--body', 'Forward slashes everywhere.', '--yes'],
    cwd,
  );
  assert.equal(code, 0, out);
  const item = items(cwd)[0];
  assert.equal(item.always, false, 'a capture that named no pin was pinned anyway');
  assert.match(markdown(cwd, 'invariant', item.id), /^always: false$/mu);
  // The pinned tier is finite and shared. A flag that defaulted on would spend
  // that budget on every capture, and the spill is silent to the person who
  // typed the command — it surfaces at the next session start, in a hook.
  assert.doesNotMatch(out, /pinned/u, 'an unpinned capture reported a pin');
  removeTree(cwd);
});

test('--always=false means the same thing here as it does on `edit`: not pinned', () => {
  const cwd = sandbox();
  // The word must not mean two things. `edit --always=false` UNPINS, so
  // `add --always=false` has to be "not pinned" and not "pinned" — which is
  // what it would be if this flag were read by presence rather than by value.
  const { code, out } = run(
    ['add', 'invariant', 'Stored paths are POSIX-normalized', '--summary-omitted',
      '--body', 'Forward slashes everywhere.', '--always=false', '--yes'],
    cwd,
  );
  assert.equal(code, 0, out);
  assert.equal(items(cwd)[0].always, false, '--always=false pinned the item');
  removeTree(cwd);
});

test('the two spellings agree: what `add --always` pins, `edit --always=false` unpins', () => {
  const cwd = sandbox();
  assert.equal(run(PINNED, cwd).code, 0);
  assert.equal(get(cwd, PINNED_ID)!.always, true);

  const { code, out } = run(['edit', PINNED_ID, '--always=false', '--yes'], cwd);
  assert.equal(code, 0, out);
  assert.equal(get(cwd, PINNED_ID)!.always, false,
    'an item pinned at capture could not be unpinned by the command that owns the word');
  assert.match(markdown(cwd, 'invariant', PINNED_ID), /^always: false$/mu);
  removeTree(cwd);
});

test('--always with a word that is neither true nor false is refused, not guessed', () => {
  const cwd = sandbox();
  const { code, out } = run(
    ['add', 'invariant', 'A thing', '--summary-omitted', '--always=maybe', '--yes'],
    cwd,
  );
  assert.equal(code, 1, out);
  // `boolFlag`'s own wording, reached through the flag. Guessing "true" pins
  // an item nobody asked to pin; guessing "false" drops a flag somebody typed.
  assert.match(out, /--always accepts/u);
  assert.deepEqual(items(cwd), [], 'a refused capture created an item');
  removeTree(cwd);
});

test('--always given as both true and false is refused rather than resolved', () => {
  const cwd = sandbox();
  const { code, out } = run(
    ['add', 'invariant', 'A thing', '--summary-omitted', '--always', '--always=false', '--yes'],
    cwd,
  );
  assert.equal(code, 1, out);
  assert.match(out, /--always was given as both true and false/u);
  // Asserted by its own words on purpose: a bare /--always/ here passes when
  // the flag does not exist at all, because the unknown-option refusal names
  // it too — a test that cannot fail is worth nothing.
  assert.doesNotMatch(out, /unknown (?:flag|option)/u);
  assert.deepEqual(items(cwd), []);
  removeTree(cwd);
});

test('--always on a rationale-tier category is refused, and names both remedies', () => {
  const cwd = sandbox();
  // `lesson` is rationale-tier: `select` filters `isNormative` before it ever
  // reads `always`, so `always: true` here is a field that is stored and then
  // governs nothing. Refused rather than stored, exactly as `--severity hard`
  // on a `decision` is — `inertFieldError` owns the rule and the wording, and
  // this asserts it arrives through THIS flag.
  const { code, out } = run(
    ['add', 'lesson', 'Something learned', '--summary-omitted',
      '--body', 'A lesson.', '--always'],
    cwd,
  );
  assert.equal(code, 1, out);
  assert.match(out, /only governs on the normative tier/u);
  assert.match(out, /Nothing was written\./u,
    'the refusal must say the capture did not land; a rationale-tier pin that half-wrote '
    + 'would be worse than one that was stored inertly');
  // Both remedies, because both are real — retier the category, or capture it
  // under one whose tier already decides what an agent is told to do.
  assert.match(out, /tier to "normative"/u);
  assert.match(out, /capture this as an item in a normative category/u);
  assert.deepEqual(items(cwd), [], 'an inert pin was written anyway');
  removeTree(cwd);
});

test('the normative gate is told about the pin, and it is the gate --always relies on', () => {
  const cwd = sandbox();
  // WITHOUT `--yes`, non-interactively: the capture is declined, and the
  // preview is still on screen. That is the whole consent story for this flag
  // — it adds no gate of its own because every capture it can land on is a
  // normative one, and those are already gated.
  const { code, out } = run(PINNED.filter((a) => a !== '--yes'), cwd);
  assert.equal(code, 1, out);
  assert.match(out, /about to create invariant/u, 'the preview never printed');
  assert.match(out, /pinned: injected in full at every session start/u,
    'the gate asked a human to approve a capture without saying it would be pinned. `always` '
    + 'has the largest injection footprint of any field, and the pinned budget is finite: an '
    + 'approval that does not name it is an approval of something else.');
  assert.deepEqual(items(cwd), [], 'a declined capture was written');

  // And the same invocation WITH `--yes` lands. The gate is a gate, not a wall.
  assert.equal(run(PINNED, cwd).code, 0);
  assert.equal(get(cwd, PINNED_ID)!.always, true);
  removeTree(cwd);
});

test('the pinned budget is named in the preview, in the figure this workspace uses', () => {
  const cwd = sandbox();
  const { out } = run(PINNED.filter((a) => a !== '--yes'), cwd);
  const budget = resolveWorkspace(cwd).config.budgets.pinned;
  assert.ok(out.includes(String(budget)),
    `the preview does not name the pinned budget (${budget}). 7 of 23 pinned items in this `
    + 'project once failed to reach a session, costing ~17237 tokens against 16000, and the '
    + `person spending that budget is the one being asked to approve the capture.\n${out}`);
  removeTree(cwd);
});
