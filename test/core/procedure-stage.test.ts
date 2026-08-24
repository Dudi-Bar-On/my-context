/**
 * `src/core/procedure-stage.ts` — the procedure lifecycle vocabulary, in ONE
 * place, reachable from a read surface.
 *
 * **Why this module exists at all.** `cli/commands/procedure.ts` imports
 * `updateItem` at its third line, because `activate` and `done` mutate. A read
 * surface may not reach that module at all — `test/ui/no-writes.test.ts` bans
 * `src/cli/index.ts` from `src/ui/` and the whole mutating command surface
 * comes with it — so the Procedures read model RE-SPELLED the three things it
 * needed out of it: `stageOf`, `STAGES` and `READY_TAG`. All three were
 * module-private there, so there was nothing to import even if the graph had
 * allowed it. The agent that did it named it as a defect it was creating
 * rather than a preference, and cited the original beside each spelling.
 *
 * A closed vocabulary written down twice will disagree eventually, and the
 * disagreement would have been between a CLI and a screen showing the same
 * lifecycle. So the assertion that matters here is not that `stageOf` is
 * correct — it is that there is only ONE of it, checked against the source of
 * both callers rather than against a memory of what they used to say.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { READY_TAG, STAGES, stageOf } from '../../src/core/procedure-stage.ts';
import type { Item, Status } from '../../src/core/types.ts';

const SRC = path.resolve(import.meta.dirname, '../../src');
const read = (rel: string): string => readFileSync(path.join(SRC, ...rel.split('/')), 'utf8');

/** The minimum an `Item` needs to be staged — status and tags, nothing else. */
function item(status: Status, tags: string[] = []): Item {
  return { id: 'PROC-x', type: 'procedure', title: 'x', status, tags } as unknown as Item;
}

test('the five stages are in lifecycle order, and the vocabulary is closed', () => {
  assert.deepEqual([...STAGES], ['proposed', 'ready', 'active', 'done', 'abandoned']);
  assert.equal(READY_TAG, 'ready');
});

test('stageOf: superseded is abandoned, and it is tested BEFORE the retired set', () => {
  // `superseded` is a member of RETIRED_STATUSES with a stage of its own.
  // An abandoned procedure reported as done is the wrong answer this order
  // exists to prevent.
  assert.equal(stageOf(item('superseded')), 'abandoned');
  assert.equal(stageOf(item('deprecated')), 'done');
  assert.equal(stageOf(item('validated')), 'done');
});

test('stageOf: active is active; a draft is ready only with the tag', () => {
  assert.equal(stageOf(item('active')), 'active');
  assert.equal(stageOf(item('draft')), 'proposed');
  assert.equal(stageOf(item('draft', [READY_TAG])), 'ready');
  assert.equal(stageOf(item('draft', ['other'])), 'proposed');
  // `active` wins over the tag: the tag marks a DRAFT as ready to run, and an
  // activated procedure that still carries it is active, not ready.
  assert.equal(stageOf(item('active', [READY_TAG])), 'active');
});

/**
 * THE POINT OF THE LIFT. Both callers must IMPORT the vocabulary, and neither
 * may declare its own. Written against the source text rather than against the
 * values, because two spellings that agree today is exactly the state this
 * test exists to refuse — comparing the values would pass in it.
 */
test('neither the CLI command nor the read model re-declares the vocabulary', () => {
  for (const rel of ['cli/commands/procedure.ts', 'ui/proc-model.ts']) {
    const text = read(rel);
    assert.match(
      text, /from '(\.\.\/)+core\/procedure-stage\.ts';/,
      `${rel} does not import core/procedure-stage.ts — the vocabulary was lifted so that ` +
      'both sides could share one spelling of it.',
    );
    for (const decl of [
      /^const STAGES\b/m,
      /^const READY_TAG\b/m,
      /^(export )?function stageOf\b/m,
    ]) {
      assert.doesNotMatch(
        text, decl,
        `${rel} declares its own ${String(decl)}. A closed vocabulary written down twice will ` +
        'disagree eventually, and the disagreement would be between a CLI and a screen ' +
        'showing the same lifecycle.',
      );
    }
  }
});

/**
 * The module has to be reachable FROM A READ SURFACE, which is the whole
 * reason it is not simply exported from `cli/commands/procedure.ts`. Same
 * shape as `test/core/vocabulary-graph.test.ts`'s check on `vocabulary.ts`.
 */
test('importing the stage vocabulary reaches no mutating function', () => {
  const MUTATORS = [
    'createItem', 'updateItem', 'supersedeItem', 'linkItems',
    'unlinkItems', 'stageRevision', 'promoteRevision', 'discardRevision',
  ];
  const seen = new Set<string>();
  const walk = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    let text: string;
    try { text = readFileSync(file, 'utf8'); } catch { return; }
    for (const m of text.matchAll(/^import\s+(?!type\b)([\s\S]*?)from\s+'(\.[^']+)';/gm)) {
      const bindings = m[1]!.replace(/[{}]/g, '').split(',').map((b) => b.trim()).filter(Boolean);
      if (bindings.length > 0 && bindings.every((b) => b.startsWith('type '))) continue;
      walk(path.resolve(path.dirname(file), m[2]!));
    }
    for (const m of text.matchAll(/^export\s+(?!type\b)\{[^}]*\}\s+from\s+'(\.[^']+)';/gm)) {
      walk(path.resolve(path.dirname(file), m[1]!));
    }
  };
  walk(path.join(SRC, 'core', 'procedure-stage.ts'));

  const exported = [...seen].flatMap((f) => {
    let text: string;
    try { text = readFileSync(f, 'utf8'); } catch { return []; }
    return [...text.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/gm)]
      .map((m) => m[1]!);
  });
  const found = MUTATORS.filter((m) => exported.includes(m));
  assert.deepEqual(
    found, [],
    `importing core/procedure-stage.ts reaches ${found.join(', ')}. The lift exists so a read ` +
    'surface can have the vocabulary without the write surface it used to sit beside.',
  );
});
