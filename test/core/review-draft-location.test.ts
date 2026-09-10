// @basis TASK-propose-drafts-nobody-has-to-trust-preferring-a-check-over-a,
// CONST-zero-runtime-dependencies
//
// **The third assertion is the point of this file.** `.my_context/` is
// committed, so an agent-invented draft under `items/` becomes a TEAM artefact
// the moment anybody clones — a rule nobody wrote and nobody approved, arriving
// on somebody else's machine attributed to this repository. The status field
// does not prevent that; the file layout does.
//
// So the property is asserted against real `git`, not against a string: the
// draft is created through the ordinary write path, and git is asked whether it
// would carry it. A test that asserted `filePath.startsWith('.drafts/')` would
// pass on a workspace whose `.gitignore` never got written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { DRAFT_DIR } from '../../src/core/drafts.ts';
import { createItem } from '../../src/core/mutate.ts';
import { sandbox } from '../helpers/workspace.ts';

/** `git` in `cwd`, or `null` when this machine has no git on PATH. */
function git(cwd: string, ...args: string[]): { code: number; out: string } | null {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (run.error !== undefined) return null;
  return { code: run.status ?? 1, out: `${run.stdout}${run.stderr}` };
}

test('an origin review create lands in the gitignored draft region', () => {
  const s = sandbox();
  const made = createItem(s.ctx, {
    type: 'lesson',
    title: 'A proposal nobody has approved',
    summary: 'One sentence.',
    body: 'Body.',
    origin: 'review',
  });

  assert.equal(made.filePath, `${DRAFT_DIR}/lesson/${made.id}.md`);
  assert.ok(existsSync(path.join(s.root, ...made.filePath.split('/'))));
  // The `*` ignore travels with the directory — see `core/drafts.ts` for why
  // it cannot be a line in this repository's own `.gitignore`.
  assert.equal(readFileSync(path.join(s.root, DRAFT_DIR, '.gitignore'), 'utf8'), '*\n');

  // A human capture is UNMOVED. The same call with the default origin is the
  // control: without it, a change that sent every item to `.drafts/` would pass
  // every assertion above.
  const human = createItem(s.ctx, {
    type: 'lesson', title: 'A lesson a person wrote', body: 'Body.',
  });
  assert.equal(human.filePath, `items/lesson/${human.id}.md`);
  s.dispose();
});

test('a draft is a first-class item: indexed, listed and shown', () => {
  const s = sandbox();
  const made = createItem(s.ctx, {
    type: 'rule',
    title: 'Something the pass would like checked',
    summary: 'One sentence.',
    body: 'Body.',
    scope: ['src/**'],
    origin: 'review',
  });

  // Indexed by the same `loadLayer` walk as everything else — the claim
  // `core/drafts.ts` makes is "same corpus, same index", and this is it.
  assert.equal(s.ctx.store.get(made.id)?.title, 'Something the pass would like checked');

  let printed = '';
  const code = runCli(['list'], s.cwd, (line) => { printed += `${line}\n`; });
  assert.equal(code, 0);
  assert.match(printed, new RegExp(made.id), 'a draft the tool cannot list is a draft nobody reviews');
  s.dispose();
});

test('git does not see the draft, and does see an ordinary item', () => {
  const s = sandbox();
  if (git(s.cwd, 'init', '-q') === null) {
    // No git on this machine. Reported rather than silently skipped: the whole
    // reason this file exists is the answer git gives.
    console.log('SKIPPED: no git binary on PATH — the ignore property was not verified here');
    s.dispose();
    return;
  }
  const draft = createItem(s.ctx, {
    type: 'lesson', title: 'A proposal', summary: 'One sentence.', body: 'Body.', origin: 'review',
  });
  const item = createItem(s.ctx, { type: 'lesson', title: 'A person wrote this', body: 'Body.' });

  const status = git(s.cwd, 'status', '--porcelain', '--untracked-files=all');
  assert.ok(status !== null && status.code === 0, 'git status must run in the sandbox');
  const lines = status.out.split('\n').map((l) => l.trim()).filter((l) => l !== '');

  assert.equal(
    lines.filter((l) => l.includes(DRAFT_DIR)).length, 0,
    `git offered the draft region to the index: ${status.out}`,
  );
  assert.equal(
    lines.filter((l) => l.includes(draft.id)).length, 0,
    'a proposal nobody approved must not be committable',
  );
  // The control, and it is not decoration: an ignore rule wide enough to hide
  // the draft could also hide the corpus, and that failure would look exactly
  // like a pass.
  assert.ok(
    lines.some((l) => l.includes(item.id)),
    `git must still see an ordinary item: ${status.out}`,
  );
  s.dispose();
});
