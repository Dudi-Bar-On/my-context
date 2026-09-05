/**
 * `GET /api/doc` and `GET /api/doc/:id` (`read-model.ts`'s `apiDocList` and
 * `apiDoc`) — the Documentation screen's manifest.
 *
 * `TASK-serve-markdown-documents-to-the-ui-behind-a-decided-boundary`
 * (`plan:walk seq:25`), consumed by `docsys/4`, `docsys/5` and `docsys/6`.
 * The boundary is `DEC-the-documentation-system-is-hand-built-over-a-wide-
 * glob`'s: every `.md` under `docs/` and `reports/`, plus `README.md`
 * itself — not `watchedDocs` alone.
 *
 * Two fixtures, for two different questions. The first four groups run
 * against THIS repository, the same way `test/ui/tutorials-endpoint.test.ts`
 * does, because the claim under test ("the real README parses to real
 * headings, and its worked example's fenced `###` lines are not among
 * them") is a claim about this repository and a copy would let it drift
 * unnoticed. The security and live-read groups run against a throwaway
 * workspace, because they need to plant a symlink, a traversal id and a
 * mid-test edit — none of which this repository may be made to hold.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync, mkdtempSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace, type Workspace } from '../../src/core/workspace.ts';
import {
  apiDoc, apiDocList, buildDocManifest, docHeadings,
  type DocBody, type DocListBody,
} from '../../src/ui/read-model.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO = path.join(import.meta.dirname, '..', '..');

const listUrl = (query = ''): URL =>
  new URL(`http://127.0.0.1/api/doc${query ? `?${query}` : ''}`);
const oneUrl = (query = ''): URL =>
  new URL(`http://127.0.0.1/api/doc/x${query ? `?${query}` : ''}`);

/* ---------------------------------------------------------------------------
 * 1 · The manifest, over this repository.
 * ------------------------------------------------------------------------- */

test('apiDocList admits README.md, docs/README.he.md and both tutorial files', () => {
  const ws = resolveWorkspace(REPO);
  const result = apiDocList(ws, listUrl());
  assert.equal(result.status, 200);
  const body = result.body as DocListBody;
  assert.equal(body.truncated, false, 'this repository must not hit the walk\'s file limit');
  const ids = body.documents.map((d) => d.id);
  for (const expected of [
    'README.md', 'docs/README.he.md', 'docs/TUTORIAL.md', 'docs/TUTORIAL-ADVANCED.md',
  ]) {
    assert.ok(ids.includes(expected), `manifest is missing ${expected}: ${ids.join(', ')}`);
  }
});

test('apiDocList admits reports/ documents — the ruling\'s whole point', () => {
  const ws = resolveWorkspace(REPO);
  const body = apiDocList(ws, listUrl()).body as DocListBody;
  const reportIds = body.documents.map((d) => d.id).filter((id) => id.startsWith('reports/'));
  assert.ok(
    reportIds.length > 0,
    'no reports/ document reached the manifest — the wide glob is not wide',
  );
});

test('README.md and docs/README.he.md both read hasHebrewMirror: true; docs/TUTORIAL.md reads false', () => {
  const ws = resolveWorkspace(REPO);
  const body = apiDocList(ws, listUrl()).body as DocListBody;
  const byId = new Map(body.documents.map((d) => [d.id, d]));
  assert.equal(byId.get('README.md')?.hasHebrewMirror, true, 'docs/README.he.md exists on disk');
  assert.equal(
    byId.get('docs/README.he.md')?.hasHebrewMirror, true,
    'a document already written in Hebrew answers this trivially true',
  );
  assert.equal(byId.get('docs/README.he.md')?.language, 'he');
  assert.equal(byId.get('README.md')?.language, 'en');
  assert.equal(
    byId.get('docs/TUTORIAL.md')?.hasHebrewMirror, false,
    'no docs/TUTORIAL.he.md exists in this repository — measured the same way ' +
    'test/ui/tutorials-endpoint.test.ts measures it',
  );
});

test('apiDoc(README.md) serves the real file, with a real heading index and no fenced-block leakage', () => {
  const ws = resolveWorkspace(REPO);
  const result = apiDoc(ws, oneUrl(), { id: 'README.md' });
  assert.equal(result.status, 200);
  const body = result.body as DocBody;
  assert.equal(body.id, 'README.md');
  assert.equal(body.headings[0]?.level, 1);
  assert.equal(body.headings[0]?.text, 'my_context');
  assert.equal(body.headings[0]?.anchor, 'my_context');
  assert.ok(body.headings.some((h) => h.level === 2 && h.text === 'Contents'));
  // README.md's §3 worked example fences a block containing a literal
  // "## my_context — these govern this project" line and four "###" item
  // headers (INV-, RULE-, CONST-, REQ-) — prose about the hook's output, not
  // headings of this document. None of them may appear in the index.
  assert.ok(
    !body.headings.some((h) => h.text.includes('INV-prices-are-integer-cents')),
    'a heading inside a fenced code block leaked into the index',
  );
  assert.ok(markdownHasNoCarriageReturn(body.markdown));
});

function markdownHasNoCarriageReturn(s: string): boolean {
  return !s.includes('\r');
}

test('apiDocList and apiDoc agree on every field but markdown, for the same id', () => {
  const ws = resolveWorkspace(REPO);
  const listed = (apiDocList(ws, listUrl()).body as DocListBody).documents
    .find((d) => d.id === 'docs/TUTORIAL.md');
  assert.ok(listed);
  const single = (apiDoc(ws, oneUrl(), { id: 'docs/TUTORIAL.md' }).body as DocBody);
  assert.equal(single.title, listed.title);
  assert.equal(single.language, listed.language);
  assert.equal(single.hasHebrewMirror, listed.hasHebrewMirror);
  assert.deepEqual(single.headings, listed.headings);
});

/* ---------------------------------------------------------------------------
 * 2 · Refusals — unknown parameters, unknown ids, and the manifest boundary.
 * ------------------------------------------------------------------------- */

test('apiDocList refuses an unknown query parameter', () => {
  const ws = resolveWorkspace(REPO);
  assert.equal(apiDocList(ws, listUrl('bogus=1')).status, 400);
});

test('apiDoc refuses an unknown query parameter', () => {
  const ws = resolveWorkspace(REPO);
  assert.equal(apiDoc(ws, oneUrl('bogus=1'), { id: 'README.md' }).status, 400);
});

test('apiDoc names what it refused, and how many documents the manifest holds', () => {
  const ws = resolveWorkspace(REPO);
  const result = apiDoc(ws, oneUrl(), { id: 'not-a-real-document.md' });
  assert.equal(result.status, 404);
  const body = result.body as { error: string };
  assert.match(body.error, /not-a-real-document\.md/);
  assert.match(body.error, /\d+ document\(s\) in the manifest/);
});

test('a workspace with no project root answers an empty manifest, and every id 404s', () => {
  const ws: Workspace = { ...resolveWorkspace(REPO), projectRoot: null };
  const listed = apiDocList(ws, listUrl()).body as DocListBody;
  assert.deepEqual(listed, { documents: [], truncated: false });
  assert.equal(apiDoc(ws, oneUrl(), { id: 'README.md' }).status, 404);
});

/* ---------------------------------------------------------------------------
 * 3 · The security boundary, over a throwaway workspace: `../`, an absolute
 * path, and a symlink that points outside docs/ and reports/ entirely.
 * ------------------------------------------------------------------------- */

function scratchWorkspace(): { dir: string; ws: Workspace; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-doc-endpoint-'));
  assert.equal(runCli(['init'], dir, () => {}), 0);
  return { dir, ws: resolveWorkspace(dir), done: () => removeTree(dir) };
}

test('an id shaped like a traversal is refused exactly like any other unknown id — nothing is resolved as a path', () => {
  const { dir, ws, done } = scratchWorkspace();
  try {
    mkdirSync(path.join(dir, 'docs'), { recursive: true });
    writeFileSync(path.join(dir, 'docs', 'safe.md'), '# Safe\n');
    // A secret OUTSIDE the repository the traversal id below would reach if
    // it were ever joined onto repoRoot instead of looked up as a key.
    const secretDir = mkdtempSync(path.join(tmpdir(), 'myctx-doc-secret-'));
    writeFileSync(path.join(secretDir, 'secret.md'), '# Secret\n');
    try {
      for (const attempt of [
        `../${path.basename(secretDir)}/secret.md`,
        path.join(secretDir, 'secret.md'), // absolute
        '../../../../../../etc/passwd',
        'docs/../../README.md',
      ]) {
        const result = apiDoc(ws, oneUrl(), { id: attempt });
        assert.equal(result.status, 404, `"${attempt}" must be refused, not resolved`);
        const body = result.body as { error: string };
        assert.ok(!body.error.includes('Secret'), 'the refusal must never carry the secret\'s content');
      }
    } finally {
      removeTree(secretDir);
    }
  } finally {
    done();
  }
});

test('a symlink under docs/ pointing outside the repository is not admitted to the manifest', (t) => {
  const { dir, ws, done } = scratchWorkspace();
  try {
    mkdirSync(path.join(dir, 'docs'), { recursive: true });
    writeFileSync(path.join(dir, 'docs', 'real.md'), '# Real\n');
    const outsideDir = mkdtempSync(path.join(tmpdir(), 'myctx-doc-outside-'));
    writeFileSync(path.join(outsideDir, 'outside.md'), '# Outside\n');
    try {
      try {
        symlinkSync(
          path.join(outsideDir, 'outside.md'), path.join(dir, 'docs', 'linked.md'), 'file',
        );
      } catch {
        t.skip('this platform refused to create a symlink (needs elevation on some Windows setups)');
        return;
      }
      const body = apiDocList(ws, listUrl()).body as DocListBody;
      const ids = body.documents.map((d) => d.id);
      assert.ok(ids.includes('docs/real.md'));
      assert.ok(
        !ids.includes('docs/linked.md'),
        'a symlinked file reached the manifest — coverageFiles\'s walk must skip it, ' +
        'the same guarantee code-identity.ts\'s own walk() already relies on',
      );
    } finally {
      removeTree(outsideDir);
    }
  } finally {
    done();
  }
});

/* ---------------------------------------------------------------------------
 * 4 · No copy, so no staleness: apiDoc reads the file fresh on every call.
 * ------------------------------------------------------------------------- */

test('editing a document on disk changes what apiDoc serves on the very next call — nothing is cached or copied', () => {
  const { dir, ws, done } = scratchWorkspace();
  try {
    mkdirSync(path.join(dir, 'docs'), { recursive: true });
    const file = path.join(dir, 'docs', 'live.md');
    writeFileSync(file, '# First\n');
    const first = apiDoc(ws, oneUrl(), { id: 'docs/live.md' });
    assert.equal(first.status, 200);
    assert.equal((first.body as DocBody).headings[0]?.text, 'First');

    writeFileSync(file, '# Second\n');
    const second = apiDoc(ws, oneUrl(), { id: 'docs/live.md' });
    assert.equal(second.status, 200);
    assert.equal(
      (second.body as DocBody).headings[0]?.text, 'Second',
      'apiDoc served stale content — it must read the file fresh, never a cached copy',
    );
  } finally {
    done();
  }
});

/* ---------------------------------------------------------------------------
 * 5 · docHeadings and buildDocManifest, unit-level.
 * ------------------------------------------------------------------------- */

test('docHeadings skips a fenced block and dedupes repeated anchors', () => {
  const headings = docHeadings([
    '# Title',
    '## Same',
    'text',
    '```text',
    '### not a heading',
    '```',
    '## Same',
  ].join('\n'));
  assert.deepEqual(headings.map((h) => h.anchor), ['title', 'same', 'same-1']);
  assert.deepEqual(headings.map((h) => h.ordinal), [1, 2, 3]);
});

test('buildDocManifest reports truncated: false against a small repository', () => {
  const { dir, ws, done } = scratchWorkspace();
  try {
    void ws;
    mkdirSync(path.join(dir, 'docs'), { recursive: true });
    writeFileSync(path.join(dir, 'docs', 'a.md'), '# A\n');
    const { entries, truncated } = buildDocManifest(dir);
    assert.equal(truncated, false);
    assert.deepEqual(entries.map((e) => e.id), ['docs/a.md']);
  } finally {
    done();
  }
});
