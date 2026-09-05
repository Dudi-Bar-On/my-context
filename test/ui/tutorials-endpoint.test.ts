/**
 * `GET /api/tutorials` (`read-model.ts`'s `apiTutorials`) — widened from six
 * hard-coded rows to one row per `docs/tutorials/manifest.json` entry, plus
 * `heRollup` — `TASK-get-api-tutorials-reads-the-manifest-and-adds-a-hebrew`
 * (`plan:tuts seq:2`), resting on the manifest `plan:tuts seq:1` derives.
 *
 * Two groups of tests:
 *
 *   1. **A fixture workspace** with its own small, hand-written manifest and
 *      tutorial files, so the arithmetic (row count, `heRollup`, the
 *      done/todo/unmeasured states) is pinned against KNOWN inputs rather
 *      than against this repository's own, still-unwritten
 *      `docs/tutorials/*.md` — content authoring is a later task
 *      (`plan:tuts seq:5`), so today every real row reads `unmeasured`.
 *   2. **This repository itself**, proving the endpoint reads the real,
 *      checked-in manifest and answers the true — currently all-zero —
 *      Hebrew rollup, rather than only a fixture.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace, type Workspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';
import { apiTutorials, type TutorialsBody } from '../../src/ui/read-model.ts';
import { loadTutorialManifest, type TutorialManifestEntry } from '../../src/core/tutorial-manifest.ts';

const REPO = path.join(import.meta.dirname, '..', '..');

const url = (query = ''): URL => new URL(`http://127.0.0.1/api/tutorials${query ? `?${query}` : ''}`);

const REQUIRED = [
  '## What it is for', '## How it works', '## From the CLI', '## From the UI',
];

function entry(id: string, overrides: Partial<TutorialManifestEntry> = {}): TutorialManifestEntry {
  return {
    id, title: `Do the ${id} thing`, tier: 'basic',
    cli: [], slash: [], screens: [], categories: [],
    enFile: `docs/tutorials/${id}.md`, heFile: `docs/tutorials/${id}.he.md`,
    ...overrides,
  };
}

/** A throwaway project with a hand-built manifest and whatever tutorial files `write` adds. */
function fixture(manifest: TutorialManifestEntry[]): { ws: Workspace; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-tut-'));
  assert.equal(runCli(['init'], dir, () => {}), 0);
  mkdirSync(path.join(dir, 'docs', 'tutorials'), { recursive: true });
  writeFileSync(path.join(dir, 'docs', 'tutorials', 'manifest.json'), JSON.stringify(manifest, null, 2));
  const ws = resolveWorkspace(dir);
  return { ws, done: () => removeTree(dir) };
}

function writeTutorial(wsRoot: string, relFile: string, headings: string[]): void {
  const full = path.join(wsRoot, ...relFile.split('/'));
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, headings.map((h) => `${h}\n\nSome text.\n`).join('\n'));
}

test('apiTutorials: a manifest with N entries produces N rows, not six', () => {
  const manifest = [entry('a'), entry('b'), entry('c')];
  const { ws, done } = fixture(manifest);
  try {
    const body = apiTutorials(ws, url()).body as TutorialsBody;
    assert.equal(body.tutorials.length, 3);
    assert.deepEqual(body.tutorials.map((t) => t.id), ['a', 'b', 'c']);
  } finally { done(); }
});

test('apiTutorials: a file with all four required headings reads done', () => {
  const manifest = [entry('written')];
  const { ws, done } = fixture(manifest);
  try {
    writeTutorial(path.dirname(ws.projectRoot!), 'docs/tutorials/written.md', REQUIRED);
    const body = apiTutorials(ws, url()).body as TutorialsBody;
    assert.equal(body.tutorials[0]!.en, 'done');
  } finally { done(); }
});

test('apiTutorials: a file missing one required heading reads todo, not done', () => {
  const manifest = [entry('partial')];
  const { ws, done } = fixture(manifest);
  try {
    writeTutorial(path.dirname(ws.projectRoot!), 'docs/tutorials/partial.md', REQUIRED.slice(0, 3));
    const body = apiTutorials(ws, url()).body as TutorialsBody;
    assert.equal(body.tutorials[0]!.en, 'todo');
  } finally { done(); }
});

test('apiTutorials: a file that does not exist reads unmeasured, on both columns', () => {
  const manifest = [entry('nowhere')];
  const { ws, done } = fixture(manifest);
  try {
    const body = apiTutorials(ws, url()).body as TutorialsBody;
    assert.deepEqual({ en: body.tutorials[0]!.en, he: body.tutorials[0]!.he }, { en: 'unmeasured', he: 'unmeasured' });
  } finally { done(); }
});

test('apiTutorials: heRollup.done counts only rows whose he is done', () => {
  const manifest = [entry('one'), entry('two'), entry('three')];
  const { ws, done } = fixture(manifest);
  try {
    const root = path.dirname(ws.projectRoot!);
    writeTutorial(root, 'docs/tutorials/one.md', REQUIRED);
    writeTutorial(root, 'docs/tutorials/one.he.md', REQUIRED);
    writeTutorial(root, 'docs/tutorials/two.md', REQUIRED);
    // two.he.md deliberately absent — todo, not done.
    writeTutorial(root, 'docs/tutorials/three.md', REQUIRED);
    writeTutorial(root, 'docs/tutorials/three.he.md', REQUIRED.slice(0, 2)); // missing headings — todo.
    const body = apiTutorials(ws, url()).body as TutorialsBody;
    assert.equal(body.heRollup.done, 1);
  } finally { done(); }
});

test('apiTutorials: heRollup.total counts every row whose en is not unmeasured', () => {
  const manifest = [entry('written'), entry('partial'), entry('missing')];
  const { ws, done } = fixture(manifest);
  try {
    const root = path.dirname(ws.projectRoot!);
    writeTutorial(root, 'docs/tutorials/written.md', REQUIRED);
    writeTutorial(root, 'docs/tutorials/partial.md', REQUIRED.slice(0, 1));
    // missing.md deliberately absent.
    const body = apiTutorials(ws, url()).body as TutorialsBody;
    // written -> done, partial -> todo: both count. missing -> unmeasured: does not.
    assert.equal(body.heRollup.total, 2);
  } finally { done(); }
});

test('apiTutorials: he is unmeasured (never a guessed todo) when en itself does not exist', () => {
  const manifest = [entry('nowhere')];
  const { ws, done } = fixture(manifest);
  try {
    // Even if a stray Hebrew file exists with no English counterpart, he reads
    // unmeasured: there is no English tutorial for it to be a translation OF.
    writeTutorial(path.dirname(ws.projectRoot!), 'docs/tutorials/nowhere.he.md', REQUIRED);
    const body = apiTutorials(ws, url()).body as TutorialsBody;
    assert.equal(body.tutorials[0]!.he, 'unmeasured');
  } finally { done(); }
});

test('apiTutorials: the response shape is { tutorials, heRollup }', () => {
  const { ws, done } = fixture([entry('x')]);
  try {
    const body = apiTutorials(ws, url()).body as Record<string, unknown>;
    assert.deepEqual(Object.keys(body).sort(), ['heRollup', 'tutorials']);
  } finally { done(); }
});

test('apiTutorials: an unknown query parameter is refused, like every other read here', () => {
  const { ws, done } = fixture([entry('x')]);
  try {
    assert.equal(apiTutorials(ws, url('bogus=1')).status, 400);
  } finally { done(); }
});

test('apiTutorials: a workspace with no project root answers an empty list, never guessed', () => {
  const ws: Workspace = { ...resolveWorkspace(REPO), projectRoot: null };
  const result = apiTutorials(ws, url());
  assert.equal(result.status, 200);
  const body = result.body as TutorialsBody;
  assert.deepEqual(body, { tutorials: [], heRollup: { done: 0, total: 0 } });
});

test('apiTutorials: a workspace whose manifest cannot be parsed answers an empty list, not a 500', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-tut-bad-'));
  try {
    assert.equal(runCli(['init'], dir, () => {}), 0);
    mkdirSync(path.join(dir, 'docs', 'tutorials'), { recursive: true });
    writeFileSync(path.join(dir, 'docs', 'tutorials', 'manifest.json'), 'not json at all');
    const ws = resolveWorkspace(dir);
    const result = apiTutorials(ws, url());
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { tutorials: [], heRollup: { done: 0, total: 0 } });
  } finally { removeTree(dir); }
});

test('apiTutorials over this repository: reads the real, checked-in manifest', () => {
  const ws = resolveWorkspace(REPO);
  const manifest = loadTutorialManifest(REPO);
  const body = apiTutorials(ws, url()).body as TutorialsBody;
  assert.equal(body.tutorials.length, manifest.length);
  assert.deepEqual(body.tutorials.map((t) => t.id).sort(), manifest.map((e) => e.id).sort());
});

test('apiTutorials over this repository: the Hebrew rollup is a measured, stated zero today', () => {
  // No docs/tutorials/*.md exist in this repository yet (content authoring is
  // plan:tuts seq:5, not this task) — STD-a-measured-zero-is-drawn-and-
  // named-an-unmeasured-thing-is: the zero must be a fact this endpoint
  // states, not an absence a reader has to notice by counting chips.
  const ws = resolveWorkspace(REPO);
  const body = apiTutorials(ws, url()).body as TutorialsBody;
  assert.deepEqual(body.heRollup, { done: 0, total: 0 });
  for (const row of body.tutorials) assert.deepEqual({ en: row.en, he: row.he }, { en: 'unmeasured', he: 'unmeasured' });
});
