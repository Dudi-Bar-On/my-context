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
 * RNG as "no seed" — `Math.random()` on every render. `MERMAID_CONFIG`'s
 * docblock in `scripts/gen-diagrams.ts` carries the full argument, and
 * `handDrawnSeed: 1` there is the fix.
 *
 * ── WHY THIS FILE, AND NOT A `node:test` FILE ─────────────────────────────
 *
 * This test first lived at `test/ui/diagram-determinism.test.ts`. CI run
 * 35722957764 (`b791b437`) failed it on both Ubuntu and Windows:
 * `browserType.launch: Executable doesn't exist at
 * …/ms-playwright/chromium_headless_shell-…` — `npm test` runs before the
 * headless shell is installed on Ubuntu, and Windows never installs one at
 * all. `test/ui/github-render.test.ts` makes the same point structurally, in
 * its own docblock: this repository's `node:test` suite is deliberately
 * DOM-free, and a browser only exists where `e2e/`'s Playwright suite runs
 * (`e2e/playwright.config.ts`'s own header explains the split). The
 * byte-equality proof belongs here, where a browser is guaranteed, not there.
 * `test/no-browser-in-unit-suite.test.ts` is the gate that stops it moving
 * back.
 *
 * ── WHY `page`, NOT `drawAll` ──────────────────────────────────────────────
 *
 * `drawAll` (`scripts/gen-diagrams.ts`) launches its OWN Chromium via a bare
 * Node-side `playwright` import — correct for the generator script, which has
 * no browser of its own, but wasteful here: this spec's `page` fixture IS
 * already a real browser page. So this test injects the same vendored
 * `mermaid.min.js` bundle `drawAll` injects, renders through it directly, and
 * runs the SAME re-serialisation `drawAll` runs (HTML in, XML out — see that
 * function's own docblock for why: `mermaid.render()`'s `<br>` is valid HTML
 * and fatal XML, and an SVG served through `<img src>` is parsed as XML).
 * `MERMAID_CONFIG` is imported, not retyped, so the seed value under test is
 * the exact one `gen:docs` uses rather than a second copy that could drift
 * from it — `CLAUDE.md`'s own naming for a copy of a rule is "the exact
 * defect this project spent 2026-09-07 measuring".
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DIAGRAM_SOURCES, MERMAID_CONFIG, collectDiagrams } from '../scripts/gen-diagrams.ts';

const REPO = path.resolve(import.meta.dirname, '..');
const BUNDLE = readFileSync(
  path.join(REPO, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js'), 'utf8');

test('the same diagram definition renders to the same SVG bytes on consecutive draws', async ({
  page,
}) => {
  const diagrams = await collectDiagrams(DIAGRAM_SOURCES);
  // Not just any fence: measurement showed the divergence lives in the
  // rounded-node border rough.js draws, so a flowchart made only of plain
  // rectangles never exercises it (verified against the first fence in the
  // READMEs, a rectangle-only flowchart, which stayed byte-identical across
  // two draws even with `handDrawnSeed` unset). A stadium node (`([...])`) or
  // a `stateDiagram-v2` both render a rounded border, so a fence with either
  // is one this test would actually have caught the bug on.
  const diagram = diagrams.find((d) => /\(\[|stateDiagram/.test(d.source));
  expect(diagram, 'no fence with a rounded node (stadium shape or stateDiagram-v2) was found in '
    + 'the READMEs — this test needs one, because that is where the bug lives').toBeTruthy();

  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: BUNDLE });

  const draw = async (): Promise<string> => page.evaluate(async ([elementId, source, config]) => {
    const mermaid = (globalThis as unknown as { mermaid: {
      initialize: (config: unknown) => void;
      render: (id: string, definition: string) => Promise<{ svg: string }>;
    } }).mermaid;
    mermaid.initialize(config);
    const { svg } = await mermaid.render(elementId as string, source as string);
    // HTML in, XML out — see drawAll's docblock in scripts/gen-diagrams.ts.
    const drawn = new DOMParser().parseFromString(svg, 'text/html').querySelector('svg');
    if (drawn === null) throw new Error(`${elementId}: mermaid returned no <svg>`);
    return new XMLSerializer().serializeToString(drawn);
  }, ['mmd-diagram-determinism', diagram!.source, MERMAID_CONFIG] as const);

  const first = await draw();
  const second = await draw();

  expect(second, 'the same fence drawn twice in the same run produced two different SVGs — '
    + 'gen-diagrams.ts is not idempotent (see MERMAID_CONFIG\'s docblock)').toEqual(first);
});
