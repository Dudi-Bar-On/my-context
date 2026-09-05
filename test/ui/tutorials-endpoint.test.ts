/**
 * `GET /api/tutorials` (`read-model.ts`'s `apiTutorials`) — the Tutorials
 * screen's twelve EN/HE cells, computed against THIS repository's own
 * `docs/TUTORIAL.md` and `docs/TUTORIAL-ADVANCED.md` rather than a fixture,
 * because the hand check `TASK-no-endpoint-serves-tutorial-state-so-twelve-
 * cells-are-hard` records was made against this same repository and a fixture
 * copy would let the two drift apart unnoticed.
 *
 * Three things are pinned:
 *
 *   1. The five rows with a real heading answer `done` for EN, over this
 *      repository as it stands today — the check `screens/tut.js` used to
 *      make once by hand, now made on every request.
 *   2. The second row — "when it did not fire" — names no heading anywhere to
 *      check FOR, and answers `unmeasured` rather than a guessed `todo`, for
 *      BOTH columns.
 *   3. Every HE cell answers `todo`: no `docs/TUTORIAL.he.md` or
 *      `docs/TUTORIAL-ADVANCED.he.md` exists in this repository, so a
 *      Hebrew tutorial is a real, computed absence and not a guess — the same
 *      `docs/README.he.md` naming convention this project already uses
 *      elsewhere, applied here and found (today) to have nothing behind it.
 *
 * `unknownParams` and the no-project state are each one line, shared with
 * every other endpoint in this module, and pinned here only so a regression in
 * either is caught by the route that would actually show it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveWorkspace, type Workspace } from '../../src/core/workspace.ts';
import { apiTutorials, type TutorialsBody } from '../../src/ui/read-model.ts';

const REPO = path.join(import.meta.dirname, '..', '..');

const url = (query = ''): URL => new URL(`http://127.0.0.1/api/tutorials${query ? `?${query}` : ''}`);

test('apiTutorials: the five rows with a real heading read done, over this repository', () => {
  const ws = resolveWorkspace(REPO);
  const result = apiTutorials(ws, url());
  assert.equal(result.status, 200);
  const body = result.body as TutorialsBody;
  assert.equal(body.tutorials.length, 6);
  // Index 0 is tu.1 ("first twenty minutes"), 2 through 5 are tu.3..tu.6 —
  // the mockup's own order, `screens/tut.js`'s `TUTORIAL_ROWS` and this
  // module's `TUTORIAL_TARGETS` both hold it.
  assert.equal(body.tutorials[0]!.en, 'done', 'tu.1 — docs/TUTORIAL.md\'s own title');
  assert.equal(body.tutorials[2]!.en, 'done', 'tu.3 — TUTORIAL-ADVANCED.md chapter 2');
  assert.equal(body.tutorials[3]!.en, 'done', 'tu.4 — TUTORIAL-ADVANCED.md chapter 4');
  assert.equal(body.tutorials[4]!.en, 'done', 'tu.5 — TUTORIAL-ADVANCED.md chapter 8');
  assert.equal(body.tutorials[5]!.en, 'done', 'tu.6 — TUTORIAL-ADVANCED.md chapter 6');
});

test('apiTutorials: the second row names no heading to check for, and reads unmeasured on both columns', () => {
  const ws = resolveWorkspace(REPO);
  const body = apiTutorials(ws, url()).body as TutorialsBody;
  assert.deepEqual(body.tutorials[1], { en: 'unmeasured', he: 'unmeasured' });
});

test('apiTutorials: every HE cell reads todo — no Hebrew tutorial file exists in this repository', () => {
  const ws = resolveWorkspace(REPO);
  const body = apiTutorials(ws, url()).body as TutorialsBody;
  const heStates = body.tutorials.map((row, i) => (i === 1 ? null : row.he)).filter((s) => s !== null);
  assert.deepEqual(heStates, ['todo', 'todo', 'todo', 'todo', 'todo']);
});

test('apiTutorials: an unknown query parameter is refused, like every other read here', () => {
  const ws = resolveWorkspace(REPO);
  const result = apiTutorials(ws, url('bogus=1'));
  assert.equal(result.status, 400);
});

test('apiTutorials: a workspace with no project root answers every cell unmeasured, never guessed', () => {
  const ws: Workspace = { ...resolveWorkspace(REPO), projectRoot: null };
  const result = apiTutorials(ws, url());
  assert.equal(result.status, 200);
  const body = result.body as TutorialsBody;
  assert.equal(body.tutorials.length, 6);
  for (const row of body.tutorials) assert.deepEqual(row, { en: 'unmeasured', he: 'unmeasured' });
});
