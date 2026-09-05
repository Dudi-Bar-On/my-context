/**
 * `GET /api/tutorials/:id` (`read-model.ts`'s `apiTutorialDoc`) — one
 * tutorial's markdown, served by manifest id —
 * `TASK-get-api-doc-colon-id-serves-one-tutorial-by-manifest-id`
 * (`plan:tuts seq:3`).
 *
 * **Not `/api/doc/:id`.** That path is already registered, serving a wider,
 * differently-keyed manifest (`apiDoc`, the `docs/`+`reports/` walk). See
 * `apiTutorialDoc`'s own header in `read-model.ts` for the collision this
 * discovered and why this endpoint is nested under `/api/tutorials` instead.
 *
 * The security property under test throughout: `id` is looked up as an exact
 * key against the manifest's own entries, and the path actually opened comes
 * from the MANIFEST's `enFile`/`heFile`, never from the client string. A
 * `../` id and an absolute-path id are both just strings that match no key —
 * refused as an unknown id, the same shape as a plain typo, never resolved.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace, type Workspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';
import {
  apiTutorialDoc, TUTORIAL_DOC_MAX_CHARS, type TutorialDocBody,
} from '../../src/ui/read-model.ts';
import type { TutorialManifestEntry } from '../../src/core/tutorial-manifest.ts';

const url = (query = ''): URL => new URL(`http://127.0.0.1/api/tutorials/x${query ? `?${query}` : ''}`);

function entry(id: string, overrides: Partial<TutorialManifestEntry> = {}): TutorialManifestEntry {
  return {
    id, title: `Do the ${id} thing`, tier: 'advanced',
    cli: [], slash: [], screens: [], categories: [],
    enFile: `docs/tutorials/${id}.md`, heFile: `docs/tutorials/${id}.he.md`,
    ...overrides,
  };
}

function fixture(manifest: TutorialManifestEntry[]): { ws: Workspace; root: string; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-tutdoc-'));
  assert.equal(runCli(['init'], dir, () => {}), 0);
  mkdirSync(path.join(dir, 'docs', 'tutorials'), { recursive: true });
  writeFileSync(path.join(dir, 'docs', 'tutorials', 'manifest.json'), JSON.stringify(manifest, null, 2));
  return { ws: resolveWorkspace(dir), root: dir, done: () => removeTree(dir) };
}

function write(root: string, relFile: string, text: string): void {
  const full = path.join(root, ...relFile.split('/'));
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, text);
}

test('apiTutorialDoc: a known id with lang omitted returns the English markdown', () => {
  const { ws, root, done } = fixture([entry('focus')]);
  try {
    write(root, 'docs/tutorials/focus.md', '## What it is for\n\nFocus narrows a session.\n');
    const result = apiTutorialDoc(ws, url(), { id: 'focus' });
    assert.equal(result.status, 200);
    const body = result.body as TutorialDocBody;
    assert.equal(body.lang, 'en');
    assert.match(body.markdown, /Focus narrows a session/);
    assert.equal(body.title, 'Do the focus thing');
    assert.equal(body.tier, 'advanced');
    assert.equal(body.truncated, false);
  } finally { done(); }
});

test('apiTutorialDoc: lang=en explicitly is the same as omitted', () => {
  const { ws, root, done } = fixture([entry('focus')]);
  try {
    write(root, 'docs/tutorials/focus.md', 'English text.\n');
    const result = apiTutorialDoc(ws, url('lang=en'), { id: 'focus' });
    assert.equal(result.status, 200);
    assert.match((result.body as TutorialDocBody).markdown, /English text/);
  } finally { done(); }
});

test('apiTutorialDoc: lang=he with an existing Hebrew file returns it, not the English one', () => {
  const { ws, root, done } = fixture([entry('focus')]);
  try {
    write(root, 'docs/tutorials/focus.md', 'English text.\n');
    write(root, 'docs/tutorials/focus.he.md', 'טקסט עברי.\n');
    const result = apiTutorialDoc(ws, url('lang=he'), { id: 'focus' });
    assert.equal(result.status, 200);
    const body = result.body as TutorialDocBody;
    assert.equal(body.lang, 'he');
    assert.match(body.markdown, /טקסט עברי/);
    assert.doesNotMatch(body.markdown, /English text/);
  } finally { done(); }
});

test('apiTutorialDoc: lang=he with no Hebrew file is refused by name, never a fallback to English', () => {
  const { ws, root, done } = fixture([entry('focus')]);
  try {
    write(root, 'docs/tutorials/focus.md', 'English text.\n');
    // focus.he.md deliberately absent.
    const result = apiTutorialDoc(ws, url('lang=he'), { id: 'focus' });
    assert.equal(result.status, 404);
    const body = result.body as { error: string };
    assert.match(body.error, /focus/);
    assert.match(body.error, /no Hebrew file/i);
  } finally { done(); }
});

test('apiTutorialDoc: an id not in the manifest is refused, naming the count and where to list them', () => {
  const { ws, done } = fixture([entry('focus')]);
  try {
    const result = apiTutorialDoc(ws, url(), { id: 'not-a-real-tutorial' });
    assert.equal(result.status, 404);
    const body = result.body as { error: string };
    assert.match(body.error, /not-a-real-tutorial/);
    assert.match(body.error, /GET \/api\/tutorials/);
  } finally { done(); }
});

test('apiTutorialDoc: a "../" id is refused as an unknown id, never resolved as a path', () => {
  const { ws, root, done } = fixture([entry('focus')]);
  try {
    write(root, 'docs/tutorials/focus.md', 'English text.\n');
    // Something a naive path-join would escape the docs/tutorials directory
    // with, if this handler ever built a path from the client string.
    const traversal = '../../../../etc/passwd';
    const result = apiTutorialDoc(ws, url(), { id: traversal });
    assert.equal(result.status, 404);
    const body = result.body as { error: string };
    assert.match(body.error, /no tutorial/);
  } finally { done(); }
});

test('apiTutorialDoc: an absolute-path id is refused as an unknown id, never resolved as a path', () => {
  const { ws, root, done } = fixture([entry('focus')]);
  try {
    write(root, 'docs/tutorials/focus.md', 'English text.\n');
    const absolute = process.platform === 'win32' ? 'C:\\Windows\\System32\\drivers\\etc\\hosts' : '/etc/passwd';
    const result = apiTutorialDoc(ws, url(), { id: absolute });
    assert.equal(result.status, 404);
    assert.match((result.body as { error: string }).error, /no tutorial/);
  } finally { done(); }
});

test('apiTutorialDoc: an id naming a manifest entry whose English file does not exist yet is refused, not served empty', () => {
  const { ws, done } = fixture([entry('unwritten')]);
  try {
    const result = apiTutorialDoc(ws, url(), { id: 'unwritten' });
    assert.equal(result.status, 404);
    assert.match((result.body as { error: string }).error, /unwritten/);
  } finally { done(); }
});

test('apiTutorialDoc: an invalid lang value is refused with 400, not silently coerced', () => {
  const { ws, root, done } = fixture([entry('focus')]);
  try {
    write(root, 'docs/tutorials/focus.md', 'English text.\n');
    const result = apiTutorialDoc(ws, url('lang=fr'), { id: 'focus' });
    assert.equal(result.status, 400);
  } finally { done(); }
});

test('apiTutorialDoc: an unknown query parameter besides lang is refused', () => {
  const { ws, root, done } = fixture([entry('focus')]);
  try {
    write(root, 'docs/tutorials/focus.md', 'English text.\n');
    const result = apiTutorialDoc(ws, url('bogus=1'), { id: 'focus' });
    assert.equal(result.status, 400);
  } finally { done(); }
});

test('apiTutorialDoc: a workspace with no project root refuses, naming the id', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-tutdoc-noproj-'));
  try {
    const ws: Workspace = { ...resolveWorkspace(dir), projectRoot: null };
    const result = apiTutorialDoc(ws, url(), { id: 'focus' });
    assert.equal(result.status, 404);
    assert.match((result.body as { error: string }).error, /focus/);
  } finally { removeTree(dir); }
});

test('apiTutorialDoc: markdown past the bound is truncated, and says so', () => {
  const { ws, root, done } = fixture([entry('long')]);
  try {
    write(root, 'docs/tutorials/long.md', 'x'.repeat(TUTORIAL_DOC_MAX_CHARS + 500));
    const result = apiTutorialDoc(ws, url(), { id: 'long' });
    assert.equal(result.status, 200);
    const body = result.body as TutorialDocBody;
    assert.equal(body.truncated, true);
    assert.equal(body.markdown.length, TUTORIAL_DOC_MAX_CHARS);
  } finally { done(); }
});

test('apiTutorialDoc: markdown under the bound is not truncated', () => {
  const { ws, root, done } = fixture([entry('short')]);
  try {
    write(root, 'docs/tutorials/short.md', 'short.\n');
    const result = apiTutorialDoc(ws, url(), { id: 'short' });
    const body = result.body as TutorialDocBody;
    assert.equal(body.truncated, false);
  } finally { done(); }
});
