/**
 * **The corpus file browser's SERVER half** — `TASK-the-library-browses-the-
 * corpus-files-and-a-file-opens` (`library/2`), and the owner's served-path
 * ruling of 2026-09-06 recorded as
 * `DEC-the-ui-serves-the-corpus-through-its-own-route-rather-than`.
 *
 * Widening what a server hands out is not a screen decision, so the traversal
 * cases below are written as ATTACKS rather than as edge cases: each one is a
 * spelling somebody would actually try, and each is asserted to answer 404
 * rather than merely "not to crash".
 *
 * **What is deliberately NOT asserted here.** That the tree renders, that a
 * folder collapses, that the chevron and the name do two different things —
 * every one of those needs a browser and is held in `e2e/corpus-tree.spec.ts`.
 * This file is the boundary and the bodies.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isCorpusFilePath, isServableDocPath } from '../../src/doctor/checks.ts';
import { apiCorpusFile, apiCorpusList } from '../../src/ui/read-model.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { splitFrontmatter } from '../../src/core/item.ts';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO_ROOT = path.join(import.meta.dirname, '..', '..');

/** The live corpus, which is what this project dogfoods against. */
const here = () => resolveWorkspace(REPO_ROOT);

const list = (ws = here()) => {
  const result = apiCorpusList(ws, new URL('http://127.0.0.1/api/corpus'));
  assert.equal(result.status, 200);
  return result.body as {
    root: string; files: string[]; indexed: number; truncated: boolean;
  };
};

const open = (id: string, ws = here()) =>
  apiCorpusFile(ws, new URL('http://127.0.0.1/api/corpus/x'), { id });

/* ══ THE BOUNDARY PREDICATE ════════════════════════════════════════════════ */

test('isCorpusFilePath admits Markdown under items/ and nothing else', () => {
  assert.equal(isCorpusFilePath('items/task/TASK-x.md'), true);
  assert.equal(isCorpusFilePath('items/adr/ADR-y.md'), true);
  // Deeper is still inside: a corpus may nest its categories.
  assert.equal(isCorpusFilePath('items/a/b/c/d.md'), true);

  // Not Markdown, not under items/, or not a file path at all.
  assert.equal(isCorpusFilePath('config.json'), false);
  assert.equal(isCorpusFilePath('state/index.db'), false);
  assert.equal(isCorpusFilePath('items/task/x.json'), false);
  assert.equal(isCorpusFilePath('items'), false);
  assert.equal(isCorpusFilePath('items/'), false);
  assert.equal(isCorpusFilePath(''), false);
  assert.equal(isCorpusFilePath('.audit/audit.jsonl'), false);
  // `itemsX/` starts with the letters but is not the directory.
  assert.equal(isCorpusFilePath('itemsX/task/x.md'), false);
});

test('isCorpusFilePath refuses every traversal spelling — a hostile INDEX ROW, not a hostile request', () => {
  // The roster is the index's `file_path` column, and the index is a SQLite
  // file some other process wrote. Each of these is what a poisoned row would
  // look like, and none of them may become a servable key.
  for (const hostile of [
    '../config.json',
    '../../.ssh/id_rsa.md',
    'items/../config.json',
    'items/../../etc/shadow.md',
    'items/task/../../../secret.md',
    './items/task/x.md',
    'items//task/x.md',
    'items/./task/x.md',
    'items/task/./x.md',
    '/items/task/x.md',
    '/etc/passwd.md',
    'C:/Windows/win.ini.md',
    'items/task/x.md/',
    'items/task/x.md/.',
  ]) {
    assert.equal(isCorpusFilePath(hostile), false, `admitted a hostile path: ${hostile}`);
  }
});

test('the two boundaries are disjoint — the corpus route did not widen the document route', () => {
  // `REQ-a-repository-document-is-viewable-in-the-ui-only-once-it-is` is
  // discharged by ADDING a corpus route, not by loosening the checkout one.
  // These four assertions are what says the checkout boundary did not move.
  assert.equal(isServableDocPath('README.md'), true);
  assert.equal(isServableDocPath('docs/anything.md'), true);
  assert.equal(isServableDocPath('reports/anything.md'), true);
  assert.equal(isServableDocPath('.my_context/items/task/x.md'), false);
  // And no corpus path is a document path, or the reverse.
  assert.equal(isCorpusFilePath('README.md'), false);
  assert.equal(isCorpusFilePath('docs/x.md'), false);
});

/* ══ THE ROSTER ════════════════════════════════════════════════════════════ */

test('GET /api/corpus lists this corpus\'s own item files, off the index and off no walk', () => {
  const body = list();
  assert.equal(body.root, '.my_context');
  assert.ok(body.files.length > 100, `expected a real corpus, found ${body.files.length} files`);
  assert.equal(body.truncated, false);
  // Every path the boundary admits, and no path it does not.
  for (const file of body.files) {
    assert.equal(isCorpusFilePath(file), true, `roster carries a path the boundary refuses: ${file}`);
  }
  // Sorted, so two reads of one corpus draw the same tree.
  assert.deepEqual(body.files, [...body.files].sort());
  // De-duplicated: a `Set` is what builds it, and this is the assertion that
  // says so rather than the implementation detail that does.
  assert.equal(new Set(body.files).size, body.files.length);
  // Nothing was dropped between the index and the roster on this corpus, and
  // the endpoint states the count either way.
  assert.equal(body.indexed, body.files.length);
});

test('the roster reaches nothing in .my_context except Markdown under items/', () => {
  const body = list();
  const outside = body.files.filter((file) => !file.startsWith('items/') || !file.endsWith('.md'));
  assert.deepEqual(outside, [], 'the roster reaches outside items/, or reaches a non-Markdown file');
  // The three things a reader must never be handed, named rather than implied.
  for (const forbidden of ['config.json', 'state', '.audit']) {
    assert.equal(
      body.files.some((file) => file.split('/')[0] === forbidden), false,
      `the roster reaches ${forbidden}`,
    );
  }
});

test('an unknown query parameter is refused rather than ignored', () => {
  const ws = here();
  assert.equal(apiCorpusList(ws, new URL('http://127.0.0.1/api/corpus?limit=5')).status, 400);
  assert.equal(
    apiCorpusFile(ws, new URL('http://127.0.0.1/api/corpus/x?lang=he'), { id: 'x' }).status, 400,
  );
});

/* ══ ONE FILE ══════════════════════════════════════════════════════════════ */

test('GET /api/corpus/:id serves the file as it is on disk, frontmatter apart from body', () => {
  const body = list();
  const id = body.files[0]!;
  const result = open(id);
  assert.equal(result.status, 200);
  const served = result.body as {
    id: string; path: string; frontmatter: string | null; markdown: string; bytes: number;
  };
  assert.equal(served.id, id);
  assert.equal(served.path, `.my_context/${id}`);

  const abs = path.join(REPO_ROOT, '.my_context', ...id.split('/'));
  const raw = readFileSync(abs, 'utf8');
  // `bytes` is the WHOLE file, which is the number that says the two halves
  // above are the whole of it.
  assert.equal(served.bytes, Buffer.byteLength(raw, 'utf8'));
  assert.equal(served.bytes, statSync(abs).size);

  // The split is `splitFrontmatter`'s, shared with `parseItem` — one spelling
  // of "where does the frontmatter end", asserted rather than assumed.
  const split = splitFrontmatter(raw);
  assert.notEqual(split, null);
  assert.equal(served.frontmatter, split!.frontmatter);
  assert.equal(served.markdown, split!.body);
  // And nothing was dropped getting there: the two halves plus the fence are
  // the file, byte for byte.
  assert.equal(`---\n${served.frontmatter}\n---\n${served.markdown}`, raw.replace(/\r\n?/g, '\n'));
});

test('every id in the roster round-trips, and every file it names is readable', () => {
  const body = list();
  // **A SAMPLE, and the size is stated rather than left to be inferred.**
  // `apiCorpusFile` opens the store once per call, exactly as `apiItem` does,
  // so 951 calls is ~11 s of SQLite opens for a claim a spread of forty
  // already carries: measured 2026-09-06. Every category directory is
  // reached, because the stride walks the sorted roster end to end.
  const stride = Math.max(1, Math.floor(body.files.length / 40));
  const sample = body.files.filter((_file, at) => at % stride === 0);
  assert.ok(sample.length >= 20, `the sample collapsed to ${sample.length}`);
  const failures: string[] = [];
  for (const id of sample) {
    const result = open(id);
    if (result.status !== 200) failures.push(`${id}: ${result.status}`);
  }
  assert.deepEqual(failures, [], 'the roster names files this route cannot serve');
});

test('an id outside the roster is refused, and the refusal says what IS served', () => {
  const result = open('items/task/TASK-there-is-no-such-item.md');
  assert.equal(result.status, 404);
  const error = (result.body as { error: string }).error;
  assert.match(error, /GET \/api\/corpus/);
  assert.match(error, /looked up as a key, never joined onto a path/);
});

test('ATTACKS — every traversal spelling answers 404, and none of them reads a file', () => {
  const ws = here();
  const bs = String.fromCharCode(92);
  const attacks = [
    // Straight traversal, at every depth.
    '../config.json',
    '../../package.json',
    'items/../config.json',
    'items/task/../../config.json',
    'items/task/../../../README.md',
    // Absolute, POSIX and Windows.
    '/etc/passwd',
    'C:' + bs + 'Windows' + bs + 'win.ini',
    `${REPO_ROOT}/package.json`,
    // Separator confusion.
    'items' + bs + 'task' + bs + 'x.md',
    'items//task/x.md',
    // Already-decoded and still-encoded traversal: the route is reached with
    // the value the router decoded, and a second encoding is not a second
    // chance because the id is a KEY either way.
    '..%2Fconfig.json',
    '%2e%2e/config.json',
    'items/task/%2e%2e/%2e%2e/config.json',
    // The corpus's own non-Markdown, which is what a reader must never get.
    'config.json',
    'state/index.db',
    '.audit/audit.jsonl',
    // Degenerate.
    '',
    '.',
    '..',
    'items',
    'items/',
  ];
  const survived: string[] = [];
  for (const attack of attacks) {
    const result = apiCorpusFile(ws, new URL('http://127.0.0.1/api/corpus/x'), { id: attack });
    if (result.status !== 404) survived.push(`${JSON.stringify(attack)} -> ${result.status}`);
  }
  assert.deepEqual(survived, [], 'an attack reached something other than a refusal');
});

/* ══ THE SYMLINK ESCAPE ════════════════════════════════════════════════════ */

/**
 * **The one attack the id cannot be checked for**, and the reason
 * `apiCorpusFile` resolves the realpath before it reads.
 *
 * `rebuild`'s walk FOLLOWS symlinks, so a symlinked `.md` inside `items/` is a
 * legal member of a corpus and its id is a perfectly ordinary roster key. The
 * file it lands on is the thing that has to be inside the corpus, and nothing
 * about the id can say whether it is.
 *
 * Creating a symlink on Windows needs Developer Mode or an elevated process,
 * so this skips rather than fails where it cannot be built — a skipped guard
 * that says why is honest; a guard that quietly passed because the fixture was
 * never made would not be.
 */
test('a symlink out of the corpus is REFUSED, not followed', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-corpus-'));
  try {
    assert.equal(runCli(['init'], dir, () => {}), 0, 'fixture command failed: init');
    assert.equal(
      runCli(
        ['add', '--summary-omitted', 'note', 'A real note', '--body', 'Real body.', '--yes'],
        dir, () => {},
      ), 0,
      'fixture command failed: add',
    );
    const ws = resolveWorkspace(dir);
    const before = apiCorpusList(ws, new URL('http://127.0.0.1/api/corpus')).body as
      { files: string[] };
    assert.ok(before.files.length >= 1, 'the fixture corpus is empty');

    // The secret, outside the workspace entirely, and the link to it inside.
    // It is a VALID item file — the real one this fixture just captured, under
    // a second id — because an unparsable file is never indexed, an id that is
    // never indexed is never a roster key, and a refusal of a key that does
    // not exist would prove nothing about the symlink at all.
    const real = path.join(dir, '.my_context', ...before.files[0]!.split('/'));
    const secretPath = path.join(dir, 'SECRET.md');
    writeFileSync(
      secretPath,
      readFileSync(real, 'utf8').replace(/^id: .*$/m, 'id: NOTE-leak'),
      'utf8',
    );
    const linkPath = path.join(dir, '.my_context', 'items', 'note', 'NOTE-leak.md');
    try {
      symlinkSync(secretPath, linkPath, 'file');
    } catch (err) {
      t.skip(`this platform will not create a symlink here: ${String(err)}`);
      return;
    }
    assert.equal(runCli(['rebuild'], dir, () => {}), 0, 'fixture command failed: rebuild');

    const after = apiCorpusList(resolveWorkspace(dir), new URL('http://127.0.0.1/api/corpus'))
      .body as { files: string[] };
    const leaked = after.files.filter((file) => file.endsWith('NOTE-leak.md'));
    // **ANTI-VACUITY.** `rebuild`'s walk follows symlinks, so the linked item
    // IS indexed and its id IS a roster key — that is the premise of this
    // test, not a defect, and a run where it were absent would assert nothing
    // while passing.
    assert.equal(leaked.length, 1,
      'the symlinked item is not in the roster, so the refusal below tests nothing');
    // What must not happen is the READ.
    for (const id of leaked) {
      const result = apiCorpusFile(
        resolveWorkspace(dir), new URL('http://127.0.0.1/api/corpus/x'), { id },
      );
      assert.equal(result.status, 404, 'a symlink out of the corpus was followed and served');
      assert.match((result.body as { error: string }).error, /resolves outside/);
    }
  } finally {
    removeTree(dir);
  }
});
