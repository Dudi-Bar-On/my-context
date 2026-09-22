// @basis TASK-gen-docs-is-not-idempotent-gen-diagrams-ts-renders-a
/**
 * `gen-diagrams.ts` is expected to be idempotent — the same fence drawn twice
 * must be the same bytes twice, because `test/ui/diagram-gate.test.ts` gates
 * the committed SVGs on a digest and a maintainer who reruns `gen:docs` on an
 * unchanged tree must see `git status` stay clean.
 *
 * Measured 2026-09-22: it was not. Two consecutive runs of the script drew a
 * different SVG for every diagram whose node has a rounded border, because
 * mermaid draws that border through rough.js seeded from `handDrawnSeed`,
 * whose own documented default (`0`) is falsy and so is read by rough.js's
 * RNG as "no seed" — `Math.random()` on every render. `drawAll`'s docblock in
 * `scripts/gen-diagrams.ts` carries the full argument.
 *
 * This test draws ONE real diagram TWICE in the same `drawAll` call (one
 * Chromium launch, sequential renders) and asserts the two SVGs are
 * byte-identical. It draws a real committed fence rather than a fixture that
 * could drift from what the generator is really asked to draw — but not just
 * any fence: measurement showed the divergence lives in the rounded-node
 * border rough.js draws, so a flowchart made only of plain rectangles never
 * exercised it (verified: index 0, a rectangle-only flowchart, stayed
 * byte-identical across two draws even with `handDrawnSeed` unset). The
 * diagram picked below is one of the six whose SVG was seen to change between
 * consecutive `gen-diagrams.ts` runs on 2026-09-22 — it has a stadium node
 * (`([...])`) or is a `stateDiagram-v2`, both of which render a rounded
 * border — so this test would actually have caught the bug it is named for.
 *
 * Removal proof (2026-09-22): reverting `handDrawnSeed: 1` to no seed at all
 * turned this test red — the two renders differed in exactly the class of
 * bytes described above — and restoring the line turned it green again.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIAGRAM_SOURCES, collectDiagrams, drawAll } from '../../scripts/gen-diagrams.ts';

test('the same diagram definition renders to the same SVG bytes on consecutive draws', async () => {
  const diagrams = await collectDiagrams(DIAGRAM_SOURCES);
  const diagram = diagrams.find((d) => /\(\[|stateDiagram/.test(d.source));
  assert.ok(diagram, 'no fence with a rounded node (stadium shape or stateDiagram-v2) was found '
    + 'in the READMEs — this test needs one, because that is where the bug lives');

  const [first, second] = await drawAll([diagram!.source, diagram!.source]);

  assert.equal(first, second,
    'the same fence drawn twice in the same run produced two different SVGs — gen-diagrams.ts '
    + 'is not idempotent (see this file\'s header and drawAll\'s docblock)');
});
