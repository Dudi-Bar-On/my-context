import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { computeItemChecksum, renderItem } from '../../src/core/item.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * The global layer is read-only from a project, and `mycontext supersede`
 * refuses BOTH sides on that ground — the retiree and the replacement are
 * both persisted, so a global item on either side would have `persist()`
 * write a project-layer shadow file for an id the index still marks
 * `global`, leaving disk and index disagreeing about who owns it.
 *
 * This lives in its own file because `GLOBAL_DIR` (core/workspace.ts) is
 * `path.join(homedir(), '.my-context')`, resolved once at module load. The
 * only way to exercise the global layer without writing into the developer's
 * real home directory is to point `HOME`/`USERPROFILE` at a temp directory
 * BEFORE the module graph that reads it is loaded — hence the dynamic
 * import below, and hence a separate file (`node --test` runs each test file
 * in its own process, so this cannot leak into any other test's view of
 * home). The static imports above deliberately do not reach
 * `core/workspace.ts`.
 */
const home = mkdtempSync(path.join(tmpdir(), 'myctx-home-'));
process.env.HOME = home;
process.env.USERPROFILE = home;

const { runCli } = await import('../../src/cli/index.ts');
const { GLOBAL_DIR } = await import('../../src/core/workspace.ts');

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

/** A complete, checksum-correct global-layer item, written the way the
 * renderer writes one — never hand-assembled frontmatter, which would fail
 * its own checksum and be reported as a corpus error instead of exercising
 * the layer guard. */
function globalItem(id: string, title: string): void {
  const item: Item = {
    id, type: 'constraint', title, status: 'active', severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null, summaryWas: [], acknowledged: {},
    scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: '2026-01-01', validUntil: null, checksum: '',
    extra: {}, body: 'A global constraint.', steps: [], observations: [], relations: [],
    layer: 'global', filePath: `items/constraint/${id}.md`,
  };
  item.checksum = computeItemChecksum(item);
  const file = path.join(GLOBAL_DIR, 'items', 'constraint', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, renderItem(item), 'utf8');
}

test('the fake home actually took effect — otherwise every test below is vacuous', () => {
  assert.equal(GLOBAL_DIR, path.join(home, '.my-context'));
});

test('supersede refuses a global-layer item on either side, before any preview', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-supersede-global-'));
  try {
    runCli(['init'], cwd, () => {});
    globalItem('CONST-global-one', 'A global constraint');
    globalItem('CONST-global-two', 'Another global constraint');
    run(['add', '--summary-omitted', 'constraint', 'A project constraint', '--yes'], cwd);
    const projectId = 'CONST-a-project-constraint';

    // The global items are visible to this project (so the refusal below is
    // about the LAYER, not about a missing id).
    const listed = run(['list', 'constraint', '--full'], cwd);
    assert.match(listed.out, /CONST-global-one/, listed.out);

    const asRetiree = run(['supersede', 'CONST-global-one', '--by', projectId, '--yes'], cwd);
    assert.equal(asRetiree.code, 1);
    assert.match(asRetiree.out, /"CONST-global-one" belongs to the global layer/);
    assert.doesNotMatch(asRetiree.out, /about to supersede/);

    const asReplacement = run(['supersede', projectId, '--by', 'CONST-global-two', '--yes'], cwd);
    assert.equal(asReplacement.code, 1);
    assert.match(asReplacement.out, /"CONST-global-two" belongs to the global layer/);
    assert.doesNotMatch(asReplacement.out, /about to supersede/);

    // Nothing was written on either attempt: the project item is untouched,
    // and no project-layer shadow file was minted for a global id.
    const project = readFileSync(
      path.join(cwd, '.my_context', 'items', 'constraint', `${projectId}.md`), 'utf8');
    assert.match(project, /^status: active$/m);
    assert.doesNotMatch(project, /superseded_by/);
    assert.equal(
      run(['show', 'CONST-global-one'], cwd).out.includes('status: superseded'), false);
  } finally {
    removeTree(cwd);
  }
});

test.after(() => { removeTree(home); });
