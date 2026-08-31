import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { computeItemChecksum, renderItem } from '../../src/core/item.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * The global layer is read-only from a project, and `mycontext edit` refuses
 * on that ground BEFORE it prints a preview — the ordering every refusal on
 * this command keeps, and the reason it does not simply let
 * `requireWritableItem` throw from inside `updateItem`: a human shown what an
 * edit will do, asked to approve it, and only then told it was never going to
 * land is the defect `review promote` was already fixed for.
 *
 * This lives in its own file for the reason `supersede-global-layer.test.ts`
 * does: `GLOBAL_DIR` (core/workspace.ts) is resolved once at module load from
 * `homedir()`, so the only way to exercise the layer without writing into the
 * developer's real home directory is to point `HOME`/`USERPROFILE` at a temp
 * directory BEFORE the module graph that reads it loads — hence the dynamic
 * import below, and hence a separate file.
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

/** A complete, checksum-correct global-layer item, written the way the renderer
 * writes one — never hand-assembled frontmatter, which would fail its own
 * checksum and be reported as a corpus error instead of exercising the guard. */
function globalItem(id: string, title: string): string {
  const item: Item = {
    id, type: 'constraint', title, status: 'active', severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null,
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
  return file;
}

test('the fake home actually took effect — otherwise every test below is vacuous', () => {
  assert.equal(GLOBAL_DIR, path.join(home, '.my-context'));
});

test('edit refuses a global-layer item, before any preview, and writes nothing', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-edit-global-'));
  try {
    runCli(['init'], cwd, () => {});
    const file = globalItem('CONST-global-one', 'A global constraint');
    const before = readFileSync(file, 'utf8');

    // Visible to this project, so the refusal below is about the LAYER rather
    // than about a missing id.
    assert.match(run(['list', 'constraint', '--full'], cwd).out, /CONST-global-one/);

    const { code, out } = run(['edit', 'CONST-global-one', '--body', 'Rewritten.', '--yes'], cwd);
    assert.equal(code, 1, out);
    assert.match(out, /"CONST-global-one" belongs to the global layer/);
    assert.doesNotMatch(out, /about to edit/, 'the refusal must precede the preview');

    // Neither the global file nor a project-layer shadow of it was written.
    assert.equal(readFileSync(file, 'utf8'), before);
    assert.equal(
      run(['show', 'CONST-global-one'], cwd).out.includes('Rewritten.'), false);
  } finally {
    removeTree(cwd);
  }
});

test.after(() => { removeTree(home); });
