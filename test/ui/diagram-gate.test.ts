/**
 * **The regeneration gate on the ten committed diagrams.**
 *
 * `DEC-markdown-it-is-vendored-as-the-tokeniser-and-the-drawings` ruled that
 * mermaid is a devDependency that never ships and that the READMEs' diagrams
 * are drawn ahead of time into SVGs `src/ui/public/diagrams/` carries. The
 * research spec's one objection to that is worth quoting, because this file is
 * the whole of the answer to it: pre-rendered SVGs are *"a tenth class of
 * derived artefact that can go stale"*, in a project whose recorded chronic
 * failure is exactly that — *"both READMEs went stale five times in two days"*.
 *
 * The answer is the one `docs/cli-ui-coverage.md` and
 * `scripts/gen-cli-ui-coverage.ts` shipped hours earlier: a generated artefact
 * is safe when the derivation is CHECKED. Drift goes red here rather than
 * unnoticed on a screen.
 *
 * ── WHAT "RE-DERIVED" MEANS HERE, PRECISELY ───────────────────────────────
 *
 * Drawing an SVG needs mermaid in a browser. `npm test` is `node --test` and
 * this repository deliberately keeps every Playwright spec out of `test/` (see
 * `e2e/playwright.config.ts`' own header: a Playwright spec is not a
 * `node:test` file, and `scripts/check-test-glob.ts` would catch one placed
 * here). So this file does not re-run mermaid. It checks the two edges that a
 * browser is not needed for, and between them they close both directions of
 * drift:
 *
 *   1. **Source → file name.** Every diagram's file name is a hash of its own
 *      definition (`diagramFile`). So the READMEs are re-parsed by the SAME
 *      renderer the browser uses, the names are recomputed, and the committed
 *      map must be exactly that. Change one character of a fence and the file
 *      it should point at does not exist — the omission fails, rather than an
 *      old picture quietly outliving its source.
 *   2. **File name → bytes.** `DIGESTS` records the SHA-256 the generator saw
 *      when it wrote each SVG. An SVG edited by hand, truncated, or replaced
 *      fails on its digest.
 *
 * Plus the two hygiene checks that make the set closed: no drawing on disk
 * that nothing points at, and no entry pointing at a drawing that is not there.
 *
 * `npm run gen:docs` is what makes all of this green again, and it is the only
 * thing that should.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  DIAGRAM_DIR, DIAGRAM_MODULE, DIAGRAM_SOURCES,
  collectDiagrams, diagramFile, digestOf, renderDiagramsModule,
} from '../../scripts/gen-diagrams.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const DIR = path.join(REPO, ...DIAGRAM_DIR.split('/'));
const MODULE_FILE = path.join(REPO, ...DIAGRAM_MODULE.split('/'));

/** What is committed, as the browser imports it. */
async function committed(): Promise<{
  DIAGRAMS: Record<string, string>;
  DIGESTS: Record<string, string>;
}> {
  return await import(pathToFileURL(MODULE_FILE).href) as {
    DIAGRAMS: Record<string, string>;
    DIGESTS: Record<string, string>;
  };
}

test('every mermaid fence in the two READMEs has a drawing, and it is the drawing named by its own source', async () => {
  const derived = await collectDiagrams(DIAGRAM_SOURCES);
  const { DIAGRAMS } = await committed();

  assert.equal(derived.length, 10,
    'the READMEs carry five diagrams each, in English and in Hebrew — a different count is a '
    + 'diagram added or removed, and `npm run gen:docs` is what settles it');

  assert.deepEqual(Object.keys(DIAGRAMS), derived.map((d) => d.source),
    `${DIAGRAM_MODULE} does not list the fences the READMEs contain, in order. A diagram was `
    + 'edited, added or removed and the drawings were not regenerated: npm run gen:docs');

  for (const diagram of derived) {
    assert.equal(DIAGRAMS[diagram.source], diagramFile(diagram.source),
      'a diagram is addressed by the hash of its own definition, so this can only differ if the '
      + `map was hand-edited: ${diagram.file}`);
  }
});

test('every drawing on disk is the one the generator wrote, byte for byte', async () => {
  const { DIAGRAMS, DIGESTS } = await committed();
  for (const file of Object.values(DIAGRAMS)) {
    const full = path.join(DIR, file);
    assert.equal(existsSync(full), true,
      `${DIAGRAM_DIR}/${file} is named by ${DIAGRAM_MODULE} and is not on disk`);
    const bytes = readFileSync(full, 'utf8');
    assert.equal(bytes.startsWith('<svg'), true, `${file} is not an SVG`);
    assert.equal(digestOf(bytes), DIGESTS[file],
      `${DIAGRAM_DIR}/${file} is not the file the generator produced — a drawing edited by hand `
      + 'is the stale artefact this gate exists to catch: npm run gen:docs');
  }
});

test('nothing is left behind: no drawing on disk that no fence points at', async () => {
  const { DIAGRAMS } = await committed();
  const wanted = new Set(Object.values(DIAGRAMS));
  const onDisk = readdirSync(DIR).filter((f) => f.endsWith('.svg')).sort();
  assert.deepEqual(onDisk, [...wanted].sort(),
    `${DIAGRAM_DIR} holds a drawing nothing renders, or is missing one something does. A diagram `
    + 'whose source moved leaves its old picture behind; npm run gen:docs removes it.');
});

test('the committed module is exactly what the generator writes from what is on disk', async () => {
  const derived = await collectDiagrams(DIAGRAM_SOURCES);
  const digests: Record<string, string> = {};
  for (const diagram of derived) {
    const full = path.join(DIR, diagram.file);
    if (existsSync(full)) digests[diagram.file] = digestOf(readFileSync(full, 'utf8'));
  }
  const rendered = renderDiagramsModule(derived, digests);
  const onDisk = readFileSync(MODULE_FILE, 'utf8').replaceAll('\r\n', '\n');
  assert.equal(onDisk, rendered,
    `${DIAGRAM_MODULE} is not what the generator produces from the READMEs and the drawings. `
    + 'It is generated output and must not be hand-edited: npm run gen:docs');
});

test('the renderer draws a figure for a fence it has a drawing for, and a pre for one it does not', async () => {
  const { markdownNodes } = await import(pathToFileURL(
    path.join(REPO, 'src', 'ui', 'public', 'lib', 'markdown.js')).href) as {
      markdownNodes: (src: string, doc: unknown) => { nodes: { tag: string; className: string }[] };
    };
  const element = (tag: string): Record<string, unknown> => {
    const node: Record<string, unknown> = {
      tag, className: '', textContent: '', attrs: {}, children: [],
      append(...kids: unknown[]): void { (node['children'] as unknown[]).push(...kids); },
      setAttribute(name: string, value: string): void {
        (node['attrs'] as Record<string, string>)[name] = value;
      },
    };
    return node;
  };
  const doc = {
    createElement: element,
    createTextNode: (text: string): Record<string, unknown> => {
      const node = element('#text');
      node['textContent'] = text;
      return node;
    },
  };

  const { DIAGRAMS } = await committed();
  const known = Object.keys(DIAGRAMS)[0]!;
  const drawn = markdownNodes(`\`\`\`mermaid\n${known}\`\`\`\n`, doc);
  assert.equal(drawn.nodes[0]!.tag, 'figure');
  assert.equal(drawn.nodes[0]!.className, 'mermaid');

  // A fence with no drawing on record is the `<pre>` any other fence would
  // have produced. Nothing is dropped, and nothing is invented.
  const unknown = markdownNodes('```mermaid\nflowchart TB\n  A --> B\n```\n', doc);
  assert.equal(unknown.nodes[0]!.tag, 'pre');
});
