// @basis TASK-three-checks-enforce-this-repository-s-own-conventions-on-a, TASK-a-scanner-enumerates-what-it-will-skip-not-what-it-will-scan

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkNestedCorpus } from '../../src/doctor/checks.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * **`checkNestedCorpus`' skip list was this repository's own directory names.**
 *
 * The check walks for a second `.my_context` shadowing the workspace's own,
 * and skips the places a corpus is a FIXTURE rather than somewhere anyone
 * works. Its list read `test, tests, fixtures, harness, .scratch,
 * .demo-corpus` — the directories THIS repository happens to have. A stranger
 * keeping fixtures in `__fixtures__/`, `spec/` or `e2e/` got one `nested_corpus`
 * note per directory, about their own test scaffolding, on a repository the
 * tool had just been installed into.
 *
 * Measured on a `mycontext init` workspace created 2026-09-14 (row 69 of the
 * consolidated findings, and the measurement nobody had taken): a corpus
 * planted under `__fixtures__/`, `spec/` and `e2e/` drew three findings, and
 * the same corpus under `test/` drew none. The check's own docblock says a
 * check whose true positives are outnumbered three to one is one people learn
 * to scroll past — this was three false positives against zero.
 *
 * These tests are per DIRECTORY NAME and not one table-driven sweep, because
 * the assertion is about one name each: a sweep that loops the same list the
 * product loops proves the list equals itself.
 */

function workspace(): { repoRoot: string; root: string; cleanup: () => void } {
  const repoRoot = mkdtempSync(path.join(tmpdir(), 'myctx-nested-'));
  const root = path.join(repoRoot, '.my_context');
  mkdirSync(root, { recursive: true });
  return { repoRoot, root, cleanup: () => removeTree(repoRoot) };
}

function withNestedCorpusIn(dirs: string[], fn: (found: string[]) => void): void {
  const { repoRoot, root, cleanup } = workspace();
  try {
    for (const dir of dirs) {
      mkdirSync(path.join(repoRoot, ...dir.split('/'), '.my_context'), { recursive: true });
    }
    fn(checkNestedCorpus(root, repoRoot).map((f) => f.message));
  } finally {
    cleanup();
  }
}

for (const dir of ['__fixtures__', '__tests__', 'spec', 'specs', 'e2e', 'fixture']) {
  test(`a consumer's ${dir}/ corpus is a fixture, not a nested corpus`, () => {
    withNestedCorpusIn([dir], (found) => {
      assert.deepEqual(found, [], `${dir}/ was reported as a nested corpus`);
    });
  });
}

for (const dir of ['test', 'tests', 'fixtures', 'harness', '.scratch', '.demo-corpus']) {
  test(`${dir}/ was already skipped and still is`, () => {
    withNestedCorpusIn([dir], (found) => {
      assert.deepEqual(found, [], `${dir}/ regressed into being reported`);
    });
  });
}

test('AND IT GOES RED: a corpus somewhere a person actually works is still reported', () => {
  // The whole point of the widening is that it does not become a blanket
  // silence. `packages/api/` is not a fixture directory under any spelling,
  // and shadowing the workspace root from there is the real hazard the check
  // was written for — a session started at or below that path silently gets a
  // different board.
  withNestedCorpusIn(['packages/api'], (found) => {
    assert.equal(found.length, 1);
    assert.match(found[0]!, /packages\/api\/\.my_context/);
    assert.match(found[0]!, /a second corpus is nested at/);
  });
});

test('AND IT GOES RED: the skip is by directory NAME, not by anything under it', () => {
  // A corpus at `src/spec-runner/` must not be waved through by `spec` being
  // on the list — a prefix match here would silence real hits whose names
  // merely begin the same way.
  withNestedCorpusIn(['src/spec-runner'], (found) => {
    assert.equal(found.length, 1, 'a directory whose name only STARTS with a skip word was skipped');
    assert.match(found[0]!, /src\/spec-runner\/\.my_context/);
  });
});

test('the workspace\'s own corpus is never reported as shadowing itself', () => {
  const { repoRoot, root, cleanup } = workspace();
  try {
    assert.deepEqual(checkNestedCorpus(root, repoRoot), []);
  } finally {
    cleanup();
  }
});
