#!/usr/bin/env node
/**
 * Draws every ```` ```mermaid ```` fence in the two READMEs into a committed
 * SVG, and regenerates `src/ui/public/lib/diagrams.js` — the map the browser
 * renderer looks a fence up in.
 *
 *   npm run gen:docs
 *
 * `DEC-markdown-it-is-vendored-as-the-tokeniser-and-the-drawings`, owner ruling
 * of 2026-09-05: **mermaid is a devDependency that NEVER SHIPS.** Vendoring it
 * to draw in the browser was the researcher's recommendation and was priced
 * first: 3,572,661 B, 96% of the whole change, taking `src/ui/public` from
 * 2.5 MB to 6.2 MB in a plugin whose pitch is installing without fetching
 * packages. Ten committed SVGs are ~630 KB and cost the shipped product
 * nothing but the bytes on screen.
 *
 * ── WHY A GENERATED ARTEFACT IS SAFE HERE, WHICH IS THE ONLY REAL OBJECTION ─
 *
 * The research spec rejected pre-rendered SVG as *"a tenth class of derived
 * artefact that can go stale"*, in a project whose recorded chronic failure is
 * exactly that. It is a fair worry and it is answerable: `docs/cli-ui-coverage.md`
 * and `scripts/gen-cli-ui-coverage.ts` shipped hours earlier as precisely this
 * shape — a generated file held by a regeneration gate, so drift goes RED
 * rather than unnoticed. `test/ui/diagram-gate.test.ts` is that gate here, and
 * it checks both directions: a fence whose source moved no longer names a file
 * that exists, and an SVG edited by hand no longer matches its recorded digest.
 * Derivation is not the risk when the derivation is checked.
 *
 * ── ONE PARSER, WHICH IS THE WHOLE POINT OF THE RULING ────────────────────
 *
 * This script does NOT scan for fences. It asks `src/ui/public/lib/markdown.js`
 * — the browser renderer — which mermaid blocks a document contains, through
 * the same vendored markdown-it it renders with. A second fence scanner written
 * here would be the fourth copy of the rule whose third copy is what this whole
 * change exists to retire.
 *
 * ── HOW IT DRAWS ──────────────────────────────────────────────────────────
 *
 * mermaid is a browser library; there is no Node renderer. Playwright is
 * already a devDependency and already downloads Chromium for `npm run
 * test:e2e:install`, so the diagrams are drawn in that Chromium: a blank page,
 * `node_modules/mermaid/dist/mermaid.min.js` injected as a script, and
 * `mermaid.render(id, definition)` per diagram. The id is derived from the
 * definition, so the ids inside the SVG are stable across runs and the output
 * is byte-identical when the input is.
 *
 * Importing this module has no side effect (the `isMainEntry` gate every
 * generator in this repository uses), so the test can call `renderDiagramsModule`
 * directly and compare.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isMainEntry } from '../src/core/paths.ts';

/** The repository root, from this file. */
const REPO = path.join(import.meta.dirname, '..');

/** The two documents the requirement calls the base of the documentation system. */
export const DIAGRAM_SOURCES = ['README.md', 'docs/README.he.md'];

/** Where the drawings live, repo-relative, and how the browser addresses them. */
export const DIAGRAM_DIR = 'src/ui/public/diagrams';

/** The generated map, repo-relative. */
export const DIAGRAM_MODULE = 'src/ui/public/lib/diagrams.js';

/** One diagram: the fence's exact source, and the file drawn from it. */
export interface Diagram {
  source: string;
  file: string;
}

/**
 * The file a definition is drawn into. **Content-addressed, deliberately.** A
 * name derived from the source is what makes the gate cheap and total: change
 * one character of a diagram and the name it should have no longer exists on
 * disk, so the omission is a failure rather than a stale picture.
 */
export function diagramFile(source: string): string {
  return `d-${createHash('sha256').update(source, 'utf8').digest('hex').slice(0, 16)}.svg`;
}

/**
 * Every mermaid fence in the given documents, deduplicated, in document order.
 * The English and Hebrew diagrams are full translations of one another rather
 * than copies, so ten distinct definitions are expected; a definition that DID
 * repeat would correctly be drawn once.
 */
export async function collectDiagrams(documents: string[]): Promise<Diagram[]> {
  const { mermaidBlocks } = await renderer();
  const seen = new Set<string>();
  const out: Diagram[] = [];
  for (const relative of documents) {
    const text = readFileSync(path.join(REPO, ...relative.split('/')), 'utf8');
    for (const source of mermaidBlocks(text) as string[]) {
      if (seen.has(source)) continue;
      seen.add(source);
      out.push({ source, file: diagramFile(source) });
    }
  }
  return out;
}

/**
 * The browser renderer, loaded from Node. It takes its `doc` as an argument
 * and imports nothing but its own vendored tokeniser, so it runs here exactly
 * as it runs in the page — which is the only reason one function can answer
 * "which fences are diagrams" for both.
 *
 * The specifier is computed so that `tsc` does not try to type a vendored
 * minified `.mjs`; the module is plain ES and Node resolves it directly.
 */
async function renderer(): Promise<{ mermaidBlocks: (src: string) => string[] }> {
  const file = path.join(REPO, 'src', 'ui', 'public', 'lib', 'markdown.js');
  return await import(pathToFileURL(file).href) as { mermaidBlocks: (src: string) => string[] };
}

/**
 * The generated module, as a string. Pure — it is handed the diagrams and the
 * digests, so the test can build the same text from what is on disk and diff
 * it against what is committed.
 */
export function renderDiagramsModule(
  diagrams: Diagram[],
  digests: Record<string, string>,
): string {
  const lines: string[] = [];
  lines.push('/**');
  lines.push(' * GENERATED by `scripts/gen-diagrams.ts` (`npm run gen:docs`).');
  lines.push(' *');
  lines.push(' * Do not edit this file: `test/ui/diagram-gate.test.ts` re-derives it from the');
  lines.push(' * READMEs and fails on any difference.');
  lines.push(' *');
  lines.push(' * `DIAGRAMS` maps a ```` ```mermaid ```` fence\'s exact source to the SVG that');
  lines.push(' * was drawn from it; `DIGESTS` maps that file to the SHA-256 of the bytes the');
  lines.push(' * generator wrote, so an SVG edited by hand is caught as loudly as a diagram');
  lines.push(' * whose source moved.');
  lines.push(' */');
  lines.push('export const DIAGRAMS = {');
  for (const diagram of diagrams) {
    lines.push(`  ${JSON.stringify(diagram.source)}: ${JSON.stringify(diagram.file)},`);
  }
  lines.push('};');
  lines.push('');
  lines.push('export const DIGESTS = {');
  for (const diagram of diagrams) {
    lines.push(`  ${JSON.stringify(diagram.file)}: ${JSON.stringify(digests[diagram.file] ?? '')},`);
  }
  lines.push('};');
  lines.push('');
  return lines.join('\n');
}

/** The SHA-256 of a file's bytes, as the module records it. */
export function digestOf(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Draws every definition in one Chromium, in order, and returns the SVG text.
 *
 * `securityLevel: 'strict'` is mermaid's own DOMPurify pass.
 *
 * **`theme: 'default'` — mermaid's LIGHT theme — and the reason it is not
 * `'dark'` is worth stating, because the wrong answer was written here first
 * with a plausible justification.** That justification read "`theme: 'dark'`
 * because there is no light theme in this product", which is true of the
 * CONSOLE and false of these drawings. They are not drawn for a screen; they
 * are drawn for the document page, which deliberately wears GitHub's own
 * stylesheet and none of the console's — the whole reason `doc.html` does not
 * load `styles.css`. Owner, 2026-09-05, on seeing them: "why the graphics
 * colors are not the same as in github", and before that "the background is
 * dark and i want it light".
 *
 * The same conflation put `styles.css` on the document page in the first
 * place. The rule that this product has no light theme governs the console;
 * it says nothing about a page built to look like GitHub, and reading it as
 * though it did produced dark drawings on a white ground.
 *
 * **`fontFamily` is an explicit stack and NOT `'inherit'`, and that is forced
 * by the `<img>`.** A drawing is addressed as `<img src="/diagrams/x.svg">`,
 * and an image document is a separate, isolated document: it inherits none of
 * the page's CSS and cannot load the page's `@font-face` faces, so `inherit`
 * resolves to the SVG default and every label came out in a serif face against
 * a UI that has none. Screenshot-verified, both ways. `Geist` is therefore of
 * no use here — it is a vendored `.woff2` the image document cannot reach — so
 * the stack below is the tail of `styles.css`'s own `--sans`, the part that
 * resolves from the operating system.
 *
 * ── WHY THE OUTPUT IS RE-SERIALISED RATHER THAN WRITTEN AS RETURNED ───────
 *
 * `mermaid.render()` returns HTML-serialised markup, and the drawings put
 * their node labels in a `<foreignObject>` — so a `<br/>` an author wrote in a
 * label comes back as `<br>`, an unclosed void element. That is valid HTML and
 * **fatal XML**, and an SVG loaded through `<img src>` is parsed as XML: the
 * browser showed a broken-image glyph and its alt text, which is exactly what
 * the first run of this script produced. Measured, not anticipated.
 *
 * So the returned markup is parsed as HTML (lenient, and the parser puts SVG
 * and its foreign content in the right namespaces by itself) and re-emitted
 * with `XMLSerializer`, which closes every void element and writes the
 * namespaces out. The result is then parsed BACK as `image/svg+xml` and the
 * script throws on a `parsererror` — a drawing that a browser cannot load is
 * not a drawing, and it must not reach a commit.
 */
async function drawAll(definitions: string[]): Promise<string[]> {
  const { chromium } = await import('playwright');
  const bundle = readFileSync(
    path.join(REPO, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js'), 'utf8');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ content: bundle });
    const out: string[] = [];
    for (const definition of definitions) {
      const id = `mmd-${createHash('sha256').update(definition, 'utf8').digest('hex').slice(0, 12)}`;
      out.push(await page.evaluate(async ([elementId, source]) => {
        const mermaid = (globalThis as unknown as { mermaid: {
          initialize: (config: unknown) => void;
          render: (id: string, definition: string) => Promise<{ svg: string }>;
        } }).mermaid;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'strict',
          fontFamily: 'system-ui, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        });
        const { svg } = await mermaid.render(elementId as string, source as string);
        // HTML in, XML out — see this function's docblock.
        const drawn = new DOMParser().parseFromString(svg, 'text/html').querySelector('svg');
        if (drawn === null) throw new Error(`${elementId}: mermaid returned no <svg>`);
        const xml = new XMLSerializer().serializeToString(drawn);
        const reparsed = new DOMParser().parseFromString(xml, 'image/svg+xml');
        const fault = reparsed.querySelector('parsererror');
        if (fault !== null) {
          throw new Error(`${elementId}: the drawing is not well-formed XML — ${fault.textContent}`);
        }
        return xml;
      }, [id, definition]));
    }
    return out;
  } finally {
    await browser.close();
  }
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  const diagrams = await collectDiagrams(DIAGRAM_SOURCES);
  const dir = path.join(REPO, ...DIAGRAM_DIR.split('/'));
  mkdirSync(dir, { recursive: true });

  const drawn = await drawAll(diagrams.map((d) => d.source));
  const digests: Record<string, string> = {};
  for (let i = 0; i < diagrams.length; i += 1) {
    const svg = `${drawn[i]!.trimEnd()}\n`;
    writeFileSync(path.join(dir, diagrams[i]!.file), svg, 'utf8');
    digests[diagrams[i]!.file] = digestOf(svg);
  }

  // A diagram that was removed or edited leaves its old drawing behind, and a
  // file nothing points at is the stale artefact this whole arrangement exists
  // to prevent.
  const wanted = new Set(diagrams.map((d) => d.file));
  for (const entry of readdirSync(dir)) {
    if (entry.endsWith('.svg') && !wanted.has(entry)) rmSync(path.join(dir, entry));
  }

  const modulePath = path.join(REPO, ...DIAGRAM_MODULE.split('/'));
  const rendered = renderDiagramsModule(diagrams, digests);
  const before = existsSync(modulePath)
    ? readFileSync(modulePath, 'utf8').replaceAll('\r\n', '\n')
    : '';
  writeFileSync(modulePath, rendered, 'utf8');
  console.log(
    before === rendered
      ? `${DIAGRAM_MODULE} is unchanged (${diagrams.length} diagram(s))`
      : `wrote ${DIAGRAM_MODULE} and ${diagrams.length} drawing(s) into ${DIAGRAM_DIR}`,
  );
}
