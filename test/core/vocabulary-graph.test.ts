/**
 * **Reading a vocabulary must not require a module that can write.**
 *
 * `RELATION_TYPES` has had three homes. It began in `mutate.ts`, moved to
 * `relations.ts` when the relation operations were split out, and each of
 * those modules exports mutating functions — so every surface that only wanted
 * the list of legal relation names pulled the write machinery in behind it.
 *
 * That is not a stylistic complaint. The v2.0 web UI's central guarantee is
 * that no route reaches one of eight mutating functions, enforced by a static
 * import-graph test. Under that test, a browser-facing module importing
 * `RELATION_TYPES` from `relations.ts` fails the build — correctly, because
 * `relations.ts` exports `linkItems` and `unlinkItems` and imports
 * `persist.ts` at runtime. The vocabulary was going to have to move anyway;
 * this asserts that it stays moved.
 *
 * The second property here is the one that bites sooner. `vocabulary.ts`
 * imports nothing, and that is load-bearing rather than incidental: applying
 * the id grammar at the read boundary made `item.ts` import `validate.ts`,
 * which already imported `item.ts`. The cycle loaded cleanly only because both
 * bindings happened to be used inside function bodies rather than at module
 * evaluation — a property nobody had declared and nothing checked. A module
 * with no imports cannot participate in a cycle at all.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(import.meta.dirname, '../../src');

/**
 * The eight functions the web UI's no-writes guarantee names. Resolved as
 * SYMBOLS, not as file paths: `linkItems` and `unlinkItems` have already moved
 * once, and a ban list written against files would have kept passing while the
 * symbol it meant to catch moved out from under it.
 */
const MUTATORS = [
  'createItem', 'updateItem', 'supersedeItem', 'linkItems',
  'unlinkItems', 'stageRevision', 'promoteRevision', 'discardRevision',
];

/** Runtime imports only — `import type` is erased and cannot pull code in. */
function runtimeImports(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const out: string[] = [];
  for (const m of text.matchAll(/^import\s+(?!type\b)([\s\S]*?)from\s+'(\.[^']+)';/gm)) {
    const clause = m[1]!;
    const spec = m[2]!;
    // `import { type X, y } from` is a runtime import for `y`; a clause whose
    // every binding is `type`-prefixed is not.
    const bindings = clause.replace(/[{}]/g, '').split(',').map((b) => b.trim()).filter(Boolean);
    if (bindings.length > 0 && bindings.every((b) => b.startsWith('type '))) continue;
    out.push(path.resolve(path.dirname(file), spec));
  }
  // `export { X } from './y.ts'` re-exports at runtime too.
  for (const m of text.matchAll(/^export\s+(?!type\b)\{[^}]*\}\s+from\s+'(\.[^']+)';/gm)) {
    out.push(path.resolve(path.dirname(file), m[1]!));
  }
  return out;
}

function graphFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    try { statSync(f); } catch { continue; }
    for (const next of runtimeImports(f)) stack.push(next);
  }
  return seen;
}

function exportedSymbols(file: string): string[] {
  let text: string;
  try { text = readFileSync(file, 'utf8'); } catch { return []; }
  return [...text.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]!);
}

test('vocabulary.ts imports nothing — it cannot be in a cycle', () => {
  const imports = runtimeImports(path.join(SRC, 'core/vocabulary.ts'));
  assert.deepEqual(
    imports, [],
    'vocabulary.ts gained an import. Everything validates against these lists, so whatever ' +
    'module holds them is reachable from everywhere — and a module with no imports cannot ' +
    'participate in a cycle.',
  );
});

test('reading the relation vocabulary reaches no mutating function', () => {
  const graph = graphFrom(path.join(SRC, 'core/vocabulary.ts'));
  const reachable = [...graph].flatMap((f) => exportedSymbols(f));
  const found = MUTATORS.filter((m) => reachable.includes(m));
  assert.deepEqual(
    found, [],
    `importing the vocabulary reaches ${found.join(', ')}. That is what putting RELATION_TYPES ` +
    'beside linkItems caused, twice.',
  );
});

test('relations.ts still exposes RELATION_TYPES, so its guard comments stay true', async () => {
  const viaLeaf = await import('../../src/core/vocabulary.ts');
  const viaRelations = await import('../../src/core/relations.ts');
  assert.deepEqual(
    viaRelations.RELATION_TYPES, viaLeaf.RELATION_TYPES,
    're-export drift: relations.ts documents RELATION_TYPES as "the whole gate on linkItems", ' +
    'and that sentence is only true while both names mean the same list.',
  );
  // The same ARRAY, not a copy — a copy is a second spelling waiting to drift.
  assert.equal(viaRelations.RELATION_TYPES, viaLeaf.RELATION_TYPES);
});

test('the closed vocabulary is unchanged by the move', async () => {
  const { RELATION_TYPES } = await import('../../src/core/vocabulary.ts');
  assert.deepEqual(RELATION_TYPES, [
    'derived_from', 'constrains', 'supersedes', 'blocks',
    'mitigates', 'refines', 'relates_to', 'links_to',
    // Owner ruling 2026-09-02. `depends_on` was already in the corpus and in
    // `RELATION_CLASSIFICATION`; the other three are new names. `links_to` was
    // reviewed in the same ruling and RETAINED, so the vocabulary went 8 → 12
    // rather than 8 → 11.
    'depends_on', 'caused_by', 'conflicts_with', 'amends',
  ]);
  assert.equal(
    RELATION_TYPES.includes('superseded_by'), false,
    'superseded_by must stay OUT — relations.ts records that omission as the guard, not an ' +
    'oversight: RELATION_TYPES is the whole gate on linkItems, so a name absent from it cannot ' +
    'be forged through the link surfaces.',
  );
});

test('no module under src/core imports relations.ts merely for the vocabulary', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!entry.endsWith('.ts')) continue;
      const text = readFileSync(full, 'utf8');
      const m = /^import\s+\{([^}]*)\}\s+from\s+'[^']*relations\.ts';/m.exec(text);
      if (m === null) continue;
      const names = m[1]!.split(',').map((n) => n.trim()).filter(Boolean);
      if (names.length > 0 && names.every((n) => n === 'RELATION_TYPES')) {
        offenders.push(path.relative(SRC, full));
      }
    }
  };
  walk(SRC);
  assert.deepEqual(
    offenders, [],
    `${offenders.join(', ')} import relations.ts for RELATION_TYPES alone. Import it from ` +
    'core/vocabulary.ts instead — relations.ts brings linkItems, unlinkItems and persist.ts with it.',
  );
});
