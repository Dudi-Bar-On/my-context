import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';

/**
 * A throwaway HOME, installed BEFORE any `src/` module is imported —
 * `core/workspace.ts` computes `GLOBAL_DIR = homedir()/.my-context` once at
 * import time, and these tests need a global layer this test owns so the
 * fallback's two-layer load can be compared against the DB path without the
 * machine's real global corpus polluting either side (the established
 * pattern of inject-cross-layer.test.ts).
 */
const HOME = mkdtempSync(path.join(tmpdir(), 'myctx-fallback-home-'));
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;
const GLOBAL_ROOT = path.join(HOME, '.my-context');
process.on('exit', () => { removeTree(HOME); });

const { runCli } = await import('../../src/cli/index.ts');
const { activeInjectableFromItems, loadCorpusItems } =
  await import('../../src/core/markdown-fallback.ts');
const { rebuild } = await import('../../src/core/rebuild.ts');
const { injectableTypes, select } = await import('../../src/core/select.ts');
const { Store } = await import('../../src/core/store.ts');
const { resolveWorkspace } = await import('../../src/core/workspace.ts');

function itemFile(
  root: string, type: string, id: string,
  over: { status?: string; tags?: string[]; scope?: string[] } = {},
): void {
  const file = path.join(root, 'items', type, `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  const tags = over.tags?.length ? `tags:\n${over.tags.map((t) => `  - ${t}`).join('\n')}\n` : '';
  const scope = over.scope?.length ? `scope:\n${over.scope.map((s) => `  - "${s}"`).join('\n')}\n` : '';
  writeFileSync(file, `---
id: ${id}
type: ${type}
title: ${id} title
status: ${over.status ?? 'active'}
${tags}${scope}---

# ${id} title

Body of ${id}.
`, 'utf8');
}

/** active+draft, normative+rationale, both layers. */
function mixedCorpus(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-fallback-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  const project = path.join(cwd, '.my_context');
  itemFile(project, 'constraint', 'CONST-active', { scope: ['src/**'], tags: ['billing'] });
  itemFile(project, 'constraint', 'CONST-draft', { status: 'draft' });
  itemFile(project, 'lesson', 'LESSON-rationale');
  itemFile(project, 'requirement', 'REQ-auth', { tags: ['auth'] });
  itemFile(GLOBAL_ROOT, 'constraint', 'CONST-global', { tags: ['billing'] });
  itemFile(GLOBAL_ROOT, 'constraint', 'CONST-global-draft', { status: 'draft' });
  return cwd;
}

test('EQUIVALENCE, executed not argued: fallback candidates == activeInjectable candidates', (t) => {
  const cwd = mixedCorpus();
  t.after(() => removeTree(cwd));
  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  try {
    rebuild(store, { project: ws.projectRoot!, global: GLOBAL_ROOT }, ws.config);
    const fromDb = store.activeInjectable(injectableTypes(ws.config));
    const fromFiles = activeInjectableFromItems(loadCorpusItems(ws), ws.config);
    assert.deepEqual(
      fromFiles.map((i) => i.id).sort(),
      fromDb.map((i) => i.id).sort(),
    );
    // The set is non-trivial: it filtered out the drafts and the rationale
    // tier and kept both layers' active normative items.
    assert.deepEqual(
      fromFiles.map((i) => i.id).sort(),
      ['CONST-active', 'CONST-global', 'REQ-auth'],
    );
  } finally {
    store.close();
  }
});

test('FOCUS-REPORT PARITY (review I3): both paths count the same universe', (t) => {
  const cwd = mixedCorpus();
  t.after(() => removeTree(cwd));
  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  // A focus that hides something: REQ-auth carries only the `auth` tag.
  const focus = {
    tags: ['billing'], categories: [], scope: [],
    setAt: '2026-08-16T00:00:00.000Z', setBy: 'human' as const,
  };
  const ctx = { event: 'tool' as const, path: 'src/app.ts', seen: [], focus };
  try {
    rebuild(store, { project: ws.projectRoot!, global: GLOBAL_ROOT }, ws.config);
    const viaDb = select(store.activeInjectable(injectableTypes(ws.config)), ctx, ws.config);
    const viaFiles = select(
      activeInjectableFromItems(loadCorpusItems(ws), ws.config), ctx, ws.config);
    // hidden/visible/dangling counts identical — a fallback that fed select
    // the unfiltered corpus would produce identical INJECTIONS but different
    // focus-disclosure COUNTS (the review I3 defect).
    assert.deepEqual(viaFiles.focus, viaDb.focus);
    assert.notEqual(viaFiles.focus, null, 'the focus must actually hide something here');
    assert.deepEqual(
      viaFiles.full.map((e) => e.item.id),
      viaDb.full.map((e) => e.item.id),
    );
  } finally {
    store.close();
  }
});

test('load errors are collected, not thrown, and the broken file does not sink the rest', (t) => {
  const cwd = mixedCorpus();
  t.after(() => removeTree(cwd));
  const ws = resolveWorkspace(cwd);
  writeFileSync(
    path.join(ws.projectRoot!, 'items', 'constraint', 'CONST-broken.md'),
    'no frontmatter here\n', 'utf8',
  );
  const errors: { file: string; message: string }[] = [];
  const items = loadCorpusItems(ws, errors);
  assert.equal(errors.length, 1);
  assert.match(errors[0].file, /CONST-broken\.md$/);
  assert.ok(items.some((i) => i.id === 'CONST-active'), 'the healthy corpus still loads');
});
