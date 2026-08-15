/**
 * Every surface that renders an item's `scope` field must give the SAME answer
 * for an empty one.
 *
 * This is the project's recurring defect class rather than a cosmetic one: two
 * commands disagreeing about the same field of the same item is what the audit
 * found five instances of in a single plan, and it is what happened here.
 * While an unscoped item was never injected, `list --full` and
 * `review list --full` printed `-`, `decay --full` printed `(every file)`, and
 * the two approval-gate previews printed a third wording — four surfaces, one
 * fact, three answers, in one release. Under the corrected rule (scope
 * restricts, so declaring none is the WIDEST setting there is) `-` is not
 * merely inconsistent: it reads as the narrowest setting there is.
 *
 * There are now TWO right answers rather than one, because what an empty scope
 * means is per-category configuration (`scopePolicy`, spec §4b):
 * `(unrestricted)` under `global`/`required`, and `(inert)` under `inert`,
 * where the item is restricted to nothing rather than to everything. The
 * agreement is enforced for each of them separately — a surface that ignored
 * the policy would pass the first enumeration and fail the second.
 *
 * THREE tests, because no two of them are sufficient:
 *
 * - The agreement test executes EVERY surface — including the lesson-to-rule
 *   approval gate, which was briefly a test of its own until a mutant that
 *   made only that preview disagree left this assertion green. A surface
 *   checked separately is a surface excluded from the agreement.
 * - The structural test reads the sources instead, so a SEVENTH surface added
 *   later that hand-rolls its own literal fails even though nothing
 *   enumerates it. That is the half that makes an eighth wording impossible
 *   rather than merely unlikely.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { SCOPE_INERT, SCOPE_UNRESTRICTED } from '../../src/core/render-item.ts';
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

/**
 * Every surface, executed, for ONE workspace. Returned as a map so a
 * disagreement names the surface that disagreed rather than merely failing.
 */
function renderings(cwd: string): Record<string, string> {
  // One unscoped ACTIVE item (list, decay, query_items) and one unscoped
  // DRAFT (review list, review promote), because the two sets of surfaces
  // read different statuses.
  writeItem(cwd, 'CONST-active', 'constraint', 'active');
  writeItem(cwd, 'CONST-draft', 'constraint', 'draft');
  run(['rebuild'], cwd);

  const out: Record<string, string> = {
    'list --full': scopeLine(run(['list', 'constraint', '--full'], cwd)),
    'decay --full': scopeLine(run(['decay', '--full'], cwd)),
    'review list --full': scopeLine(run(['review', 'list', '--full'], cwd)),
    'review promote': scopeLine(run(['review', 'promote', 'CONST-draft', '--yes'], cwd)),
  };

  // The MCP list line is the same fact in a different shape (` · scope <v>`).
  const mcp = createRegistry(cwd).call('query_items', { type: 'constraint' });
  const mcpScope = /· scope (.+)$/m.exec(mcp);
  assert.ok(mcpScope, `no scope on the MCP list line:\n${mcp}`);
  out['MCP query_items'] = mcpScope[1].trim();

  // The lesson->rule approval gate, in the same set rather than a test of
  // its own: while it sat outside this enumeration, a mutant that made ONLY
  // this preview disagree left the agreement assertion green. A surface
  // checked separately is a surface excluded from the agreement.
  const created = run(['lesson', 'Deploys are risky'], cwd);
  const lessonId = /LESSON-[a-z0-9-]+/.exec(created)![0];
  writeFileSync(path.join(cwd, 'r.json'), JSON.stringify([
    { title: 'Unscoped rule', directive: 'do', body: 'Because.' },
  ]), 'utf8');
  const staged = run(['lesson-stage', lessonId, '--file', 'r.json'], cwd);
  // `lesson-stage` mints the key; it is a hex digest, not an ordinal.
  const key = /\b[0-9a-f]{8}\b/.exec(staged)?.[0];
  assert.ok(key, `no staged key in:\n${staged}`);
  out['lesson-accept'] = scopeLine(run(['lesson-accept', lessonId, key], cwd));

  return out;
}

/** The agreement itself, stated as a set: every surface said `expected`. */
function assertAgreement(surfaces: Record<string, string>, expected: string): void {
  const distinct = [...new Set(Object.values(surfaces))];
  assert.equal(
    distinct.length, 1,
    `surfaces disagree about an empty scope:\n${
      Object.entries(surfaces).map(([k, v]) => `  ${k}: ${v}`).join('\n')}`,
  );
  assert.equal(distinct[0], expected, JSON.stringify(surfaces));
  for (const [surface, value] of Object.entries(surfaces)) {
    assert.equal(value, expected, `${surface} regressed to "${value}"`);
  }
}

test('every surface renders an empty scope with the same words', () => {
  const cwd = project();
  try {
    // And specifically not the two spellings that read as the NARROWEST
    // setting for what is the widest — the defect, not just the drift.
    assertAgreement(renderings(cwd), SCOPE_UNRESTRICTED);
  } finally {
    removeTree(cwd);
  }
});

/**
 * The same enumeration under `scopePolicy: "inert"`, where `(unrestricted)` is
 * a LIE: the item is restricted to nothing — never JIT-injected, an index line
 * only (spec §4b). The agreement has to hold for the new word too, or the six
 * surfaces have simply been given a second thing to disagree about.
 *
 * Both categories that appear above are set: `constraint` for the items
 * `renderings` writes, `rule` for the one `lesson-accept` is about to create.
 */
test('every surface renders an empty scope with the same words under inert', () => {
  const cwd = project();
  try {
    writeFileSync(
      path.join(cwd, '.my_context', 'config.json'),
      JSON.stringify({
        categories: {
          constraint: { scopePolicy: 'inert' },
          rule: { scopePolicy: 'inert' },
        },
      }, null, 2) + '\n',
      'utf8',
    );
    const surfaces = renderings(cwd);
    assertAgreement(surfaces, SCOPE_INERT);
    assert.notEqual(SCOPE_INERT, SCOPE_UNRESTRICTED, 'the two must not collapse into one word');
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

/**
 * The other structural direction, and the one the `inert` value made
 * necessary: the ternary scan above catches a site that computes the empty
 * case itself, but not one that COPIES the finished word — `out(\`scope
 * (unrestricted)\`)` — which drifts the moment the constant changes, and now
 * changes per category as well. Either word appearing anywhere in `src/`
 * outside its definition file is that copy.
 */
test('no site hardcodes the words themselves', () => {
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.ts')) continue;
      if (full.endsWith(path.join('core', 'render-item.ts'))) continue;
      // Comment lines are dropped first: this file's whole discipline is
      // written down in doc comments, and several of them quote the words in
      // order to explain them. What must not exist is a copy in CODE.
      const text = readFileSync(full, 'utf8')
        .split('\n')
        .filter((l) => {
          const t = l.trim();
          return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
        })
        .join('\n');
      for (const word of [SCOPE_UNRESTRICTED, SCOPE_INERT]) {
        if (text.includes(word)) offenders.push(`${path.relative(SRC, full)}: ${word}`);
      }
    }
  };
  walk(SRC);

  assert.deepEqual(
    offenders, [],
    'these carry a copy of the rendered word instead of calling `scopeField`/`scopeCell`/' +
    `\`emptyScopeLabel\` from core/render-item.ts:\n  ${offenders.join('\n  ')}`,
  );
});
