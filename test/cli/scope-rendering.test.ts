/**
 * Every surface that renders an item's `scope` field must give the SAME answer
 * for an empty one.
 *
 * This is the project's recurring defect class rather than a cosmetic one: two
 * commands disagreeing about the same field of the same item is what the audit
 * found five instances of in a single plan, and it is what happened here.
 * While an unscoped item was never injected, `list --full` printed `-`,
 * `decay --full` printed `(every file)`, `review list --full` printed `-`, and
 * the two approval-gate previews printed `(none — applies to every file)` —
 * four surfaces, one fact, three answers, in one release. Under the corrected
 * rule (scope restricts; no scope means every file) `-` is not merely
 * inconsistent, it reads as the narrowest possible setting for what is the
 * widest.
 *
 * TWO tests, because one of them alone is not enough:
 *
 * - `agreement` executes every command that renders the field and asserts the
 *   outputs agree. It proves the shipped behaviour, but it can only check the
 *   surfaces it lists, so a seventh surface added later is invisible to it.
 * - `no site inlines its own spelling` reads the sources instead, so a new site
 *   that hand-rolls `scope.length ? … : '-'` fails even though nothing
 *   enumerates it. That is the half that makes an eighth wording impossible
 *   rather than merely unlikely.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { SCOPE_UNRESTRICTED } from '../../src/core/render-item.ts';
import { createRegistry } from '../../src/mcp/tools.ts';
import { removeTree } from '../helpers/tmp.ts';

/** A real on-disk workspace: these tests read what the commands PRINT. */
function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-scope-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  return cwd;
}

const SRC = path.join(import.meta.dirname, '..', '..', 'src');

function run(args: string[], cwd: string): string {
  let out = '';
  runCli(args, cwd, (s) => { out += s + '\n'; });
  return out;
}

function writeItem(cwd: string, id: string, type: string, status: string): void {
  const file = path.join(cwd, '.my_context', 'items', type, `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: ${type}
title: ${id} title
status: ${status}
severity: soft
always: false
---

# ${id} title

Body text.
`, 'utf8');
}

/** The `scope` value a record view printed, from its `  scope   <value>` line. */
function scopeLine(out: string, label = 'scope'): string {
  const line = out.split('\n').find((l) => new RegExp(`^\\s+${label}:?\\s`).test(l));
  assert.ok(line !== undefined, `no "${label}" line in:\n${out}`);
  return line.trim().replace(new RegExp(`^${label}:?\\s+`), '');
}

test('every surface renders an empty scope with the same words', () => {
  const cwd = project();
  try {
    // One unscoped ACTIVE item (list, decay, query_items) and one unscoped
    // DRAFT (review list, review promote), because the two sets of surfaces
    // read different statuses.
    writeItem(cwd, 'CONST-active', 'constraint', 'active');
    writeItem(cwd, 'CONST-draft', 'constraint', 'draft');
    run(['rebuild'], cwd);

    const renderings: Record<string, string> = {
      'list --full': scopeLine(run(['list', 'constraint', '--full'], cwd)),
      'decay --full': scopeLine(run(['decay', '--full'], cwd)),
      'review list --full': scopeLine(run(['review', 'list', '--full'], cwd)),
      'review promote': scopeLine(run(['review', 'promote', 'CONST-draft', '--yes'], cwd)),
    };

    // The MCP list line is the same fact in a different shape (` · scope <v>`).
    const mcp = createRegistry(cwd).call('query_items', { type: 'constraint' });
    const mcpScope = /· scope (.+)$/m.exec(mcp);
    assert.ok(mcpScope, `no scope on the MCP list line:\n${mcp}`);
    renderings['MCP query_items'] = mcpScope[1].trim();

    // The assertion is agreement, stated as a set: the failure message names
    // every surface and what it said, so a disagreement is diagnosed rather
    // than merely detected.
    const distinct = [...new Set(Object.values(renderings))];
    assert.equal(
      distinct.length, 1,
      `surfaces disagree about an empty scope:\n${
        Object.entries(renderings).map(([k, v]) => `  ${k}: ${v}`).join('\n')}`,
    );
    assert.equal(distinct[0], SCOPE_UNRESTRICTED, JSON.stringify(renderings));

    // And specifically not the two spellings that read as the NARROWEST
    // setting for what is the widest — the defect, not just the drift.
    for (const [surface, value] of Object.entries(renderings)) {
      assert.equal(value, SCOPE_UNRESTRICTED, `${surface} regressed to "${value}"`);
    }
  } finally {
    removeTree(cwd);
  }
});

test('the lesson-accept preview agrees too', () => {
  const cwd = project();
  try {
    const created = run(['lesson', 'Deploys are risky'], cwd);
    const lessonId = /LESSON-[a-z0-9-]+/.exec(created)![0];
    writeFileSync(path.join(cwd, 'r.json'), JSON.stringify([
      { title: 'Unscoped rule', directive: 'do', body: 'Because.' },
    ]), 'utf8');
    const staged = run(['lesson-stage', lessonId, '--file', 'r.json'], cwd);
    // `lesson-stage` mints the key; it is a hex digest, not an ordinal.
    const key = /\b[0-9a-f]{8}\b/.exec(staged)?.[0];
    assert.ok(key, `no staged key in:\n${staged}`);
    const preview = run(['lesson-accept', lessonId, key], cwd);
    assert.equal(scopeLine(preview), SCOPE_UNRESTRICTED, preview);
  } finally {
    removeTree(cwd);
  }
});

/**
 * The structural half. It walks `src/` looking for the shape that caused the
 * drift — a `scope.length` ternary whose empty branch is a string literal —
 * and allows it in exactly one file, the one that defines the constant.
 *
 * Deliberately a source scan rather than a lint rule: this repository has no
 * runtime dependencies and therefore no linter, and the property is worth a
 * test on its own terms. It is narrow on purpose (it does not try to
 * understand the code) so that it fails on the one pattern it is about and
 * cannot start failing on unrelated edits.
 */
test('no site inlines its own spelling of an empty scope', () => {
  const offenders: string[] = [];
  // `scope.length` (or `Scope.length`) used as a ternary condition whose else
  // branch is a bare string literal — `? a.join(' ') : '-'`.
  const inlined = /[Ss]cope\.length\s*\?[^;\n]*?:\s*'[^']*'/g;

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.ts')) continue;
      // The definition site is the one place the literal is allowed to exist.
      if (full.endsWith(path.join('core', 'render-item.ts'))) continue;
      const text = readFileSync(full, 'utf8');
      for (const match of text.matchAll(inlined)) {
        offenders.push(`${path.relative(SRC, full)}: ${match[0].trim()}`);
      }
    }
  };
  walk(SRC);

  assert.deepEqual(
    offenders, [],
    'these render an empty scope with their own literal instead of `scopeField`/' +
    '`scopeCell` from core/render-item.ts — that is how four surfaces ended up ' +
    `with three wordings:\n  ${offenders.join('\n  ')}`,
  );
});
