/**
 * The three walks behind a confirm reported "nothing there" for a directory
 * they could not read — `plan:swallow seq:10`.
 *
 * WHAT WAS WRONG. `symlinksUnder` is the assertion that `dereference: true`
 * held: it hunts for a symlink that survived the copy, and a symlink is how a
 * dry run once wrote straight through into the owner's real corpus. It answered
 * "no symlinks" for a directory it could not `readdir`. `markdownUnder` and
 * `elsewhereInCorpus` did the same, which silently narrows the effect table the
 * reader approves the command on.
 *
 * THE RULE IT BREACHED IS THIS PROJECT'S OWN, in `ui/execute.ts` · §3.2 where
 * `EffectRefusal` is answered as a 400: *"a command whose effect cannot be
 * shown does not get a weaker confirm — it does not run."* Here the effect
 * could not be shown, the confirm was quietly weakened, and the command ran.
 *
 * WHAT IS ASSERTED. A walk that could not read a directory refuses, and the
 * refusal names the directory and the errno. The CONTROL beside it — the same
 * corpus and the same command with nothing forced — must derive an effect, or
 * the refusal above would be proving only that the fixture is broken.
 *
 * @basis INV-nothing-is-dropped-silently
 */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { removeTree } from '../helpers/tmp.ts';

const CLI = fileURLToPath(new URL('../../src/cli/index.ts', import.meta.url));
const FIXTURE = fileURLToPath(new URL('../fixtures/force-readdir-failure.ts', import.meta.url));

const scratches: string[] = [];
after(() => {
  for (const dir of scratches) removeTree(dir);
});

function project(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-blind-walk-'));
  scratches.push(dir);
  execFileSync(process.execPath, [CLI, 'init'], { cwd: dir, stdio: 'ignore' });
  execFileSync(
    process.execPath,
    [CLI, 'add', '--summary-omitted', 'rule', 'a rule to change', '--body', 'a body', '--yes'],
    { cwd: dir, stdio: 'ignore' },
  );
  return dir;
}

function derive(cwd: string, blind: string): { effect?: number; refused?: string; isEffectRefusal?: boolean } {
  const out = spawnSync(
    process.execPath,
    [FIXTURE, cwd, CLI, blind, 'pin', 'RULE-a-rule-to-change', '--yes'],
    { encoding: 'utf8' },
  );
  assert.equal(out.status, 0, out.stderr);
  return JSON.parse(out.stdout.trim().split('\n').at(-1)!) as ReturnType<typeof derive>;
}

test('with nothing blinded the effect derives — the control the refusals below rest on', () => {
  const answer = derive(project(), '-');
  assert.equal(answer.refused, undefined, 'the corpus and the command are fine on their own');
  assert.ok((answer.effect ?? 0) > 0, 'and the command really does change something');
});

test('a walk that could not read a directory refuses the confirm rather than narrowing it', () => {
  // `items/rule` holds the item the command changes. A walk that stops there
  // used to answer "the scratch copy holds 0 item files" — or worse, a
  // non-zero count that was missing the file the confirm is about.
  const answer = derive(project(), '/items/rule');
  assert.equal(answer.effect, undefined, 'the effect must NOT be derived from a partial walk');
  assert.equal(answer.isEffectRefusal, true, 'and the refusal is the one §3.2 answers as a 400');
  assert.match(String(answer.refused), /could not be read in full/u);
  assert.match(String(answer.refused), /EACCES/u, 'the reason travels with the refusal');
  assert.match(String(answer.refused), /items[\\/]rule/u, 'and so does the directory that refused');
});

test('the symlink guard refuses instead of reporting all clear over a directory it could not walk', () => {
  // The guard asserts a NEGATIVE — that no symlink survived `dereference: true`
  // — so blindness makes it answer "all clear" over exactly where the thing it
  // hunts would be. The scratch corpus ROOT is the one directory `symlinksUnder`
  // walks that `markdownUnder(items)` does not, so the refusal below cannot
  // have come from the items walk that runs before it.
  const answer = derive(project(), '/.my_context');
  assert.equal(answer.effect, undefined);
  assert.equal(answer.isEffectRefusal, true);
  assert.match(String(answer.refused), /checked for surviving symlinks/u);
  assert.match(String(answer.refused), /EACCES/u);
});
