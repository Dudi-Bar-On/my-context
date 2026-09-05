# Vendored third-party code

Everything in this directory was written by somebody else and is committed here
unmodified. Nothing under `vendor/` is ever hand-edited: `scripts/check-vendor.ts`
recomputes each digest below and fails if a byte moved, so a patch, a tweak or a
silent upgrade is a red gate rather than a surprise six months later.

This directory exists because `CONST-zero-runtime-dependencies` holds:
`package.json`'s `dependencies` is empty and stays empty. These are **static
assets served out of `src/ui/public/`**, the same category as the nine
`.woff2` faces under `fonts/` beside their `LICENSE-OFL.txt` and the
`LICENSE-MIT.txt` under `icons/`. `package.json`'s `files` array already
includes `src/`, so they ship with the plugin and no install fetches anything.

## The pins

| File | Package | Version | Bytes | SHA-256 |
|---|---|---|---|---|
| `markdown-it.esm.min.js` | `markdown-it` | 15.0.1 | 137,975 | `6f98af51c9dafe4f8f666ad5f9cf087c08f13bbd069604b334aa692025d9c930` |
| `github-markdown-light.css` | `github-markdown-css` | 5.9.0 | 22,219 | `de2d14b5290b8cf2af74c95e92560d9c00642ae72de0b856cece3e4eddb2d885` |

Both are MIT. `LICENSE-markdown-it.txt` and `LICENSE-github-markdown-css.txt`
sit beside them, each the byte-identical copy of what the package publishes.

## How to re-fetch

```
curl -sSL -o src/ui/public/lib/vendor/markdown-it.esm.min.js \
  https://unpkg.com/markdown-it@15.0.1/dist/browser/markdown-it.esm.min.mjs
curl -sSL -o src/ui/public/lib/vendor/LICENSE-markdown-it.txt \
  https://unpkg.com/markdown-it@15.0.1/LICENSE
curl -sSL -o src/ui/public/lib/vendor/github-markdown-light.css \
  https://unpkg.com/github-markdown-css@5.9.0/github-markdown-light.css
curl -sSL -o src/ui/public/lib/vendor/LICENSE-github-markdown-css.txt \
  https://unpkg.com/github-markdown-css@5.9.0/license
node scripts/check-vendor.ts
```

Upgrading is a deliberate act, not a `curl` with a different number in it: new
file, new digest, a new row in the table above, and `npm test` re-run — the
renderer's behaviour is pinned by `test/ui/docs-screen.test.ts`, which is what
tells you whether the new version still parses this corpus the same way.

**The upstream file is published as `.mjs`; it is stored here as `.js`.** That
is the one difference between what unpkg serves and what is committed, and the
bytes are otherwise identical — the digest above is the digest of the file
unpkg serves. The rename is forced by the UI server's static allow-list, which
is five extensions (`.html`, `.js`, `.css`, `.svg`, `.woff2`) and does not
include `.mjs`; a file it will not serve is a file the browser 404s on. Adding
an extension to that table is a change to `src/ui/static.ts`, and renaming a
vendored asset is the smaller of the two.

## Why github-markdown-css, and only the light variant

`DEC-the-document-page-wears-github-styling-lists-the-readmes-and`, owner
ruling of 2026-09-05, given after the document page was reviewed and found to
be wearing the console's own stylesheet. His words: a page *"without the style
of mycontext"* that *"should look exactly as it is displayed in github"*.

This is the stylesheet **GitHub itself publishes** for a rendered Markdown
body — `sindresorhus/github-markdown-css`, generated from GitHub's own Primer
tokens by `generate-github-markdown-css` — so the appearance on `/doc.html` is
GitHub's own and not a second interpretation of it. The RENDERER was ruled
separately and did not change: markdown-it stays, GFM stays, and the honest
limit stays on the record — the appearance matches GitHub, the rendering
matches GFM, the renderer is not literally GitHub's.

**The LIGHT variant, and only it.** The package ships seven themes; this page
takes `github-markdown-light.css` and no switcher.

The dark one was tried first and was wrong, and the correction is worth
recording because the reasoning that produced it looks sound and is not. The
argument was: *this product has no light theme, therefore the document page is
dark.* Owner, on seeing it: *"now it looks correct just the background is dark
and i want it light."*

`CONST`-level dark-only governs the CONSOLE. This page is deliberately not the
console — dropping `styles.css` is the whole point of it — so the console's
palette rule has no reach here, and the instruction that DOES reach here is
*"should look exactly as it is displayed in github"*. GitHub's own default
rendering of a Markdown file is light. So light is not a departure from the
ruling; it is the ruling read correctly, and dark was the departure.

`github-markdown.css`, the `prefers-color-scheme` switcher, is still not used:
it would hand a dark page to a reader whose OS says dark, which is the thing
that was just corrected. One appearance, chosen, and no theme toggle — he asked
for light.

**THE TEN MERMAID DRAWINGS WERE THE SAME CONFLATION, ONE LAYER DOWN, AND ARE
FIXED IN `37591be`.** `scripts/gen-diagrams.ts` initialised mermaid with
`theme: 'dark'`, justified in its own docblock as *"because there is no light
theme in this product"* — the identical argument that put `styles.css` on
`doc.html`, and wrong for the identical reason: it is true of the console and
false of a document page. On the light page those drawings measured `#ccc`
label text at 1.61:1 and `lightgrey` connectors at 1.50:1 against `#ffffff`,
where text needs 4.5:1 and a meaningful non-text graphic needs 3:1. Redrawn
with `theme: 'default'` — lavender nodes, `#333` text, dark arrows, which is
what GitHub renders on a light page. The filenames did not move: a drawing is
addressed by the hash of its SOURCE, and only the rendering changed.

**No rename was needed.** `.css` is already in `src/ui/static.ts`'s five-
extension allow-list, so unlike `markdown-it.esm.min.mjs` this file is
committed under the name upstream publishes.

**The class contract is the package's own, read off its README rather than
assumed**: *"Import the `github-markdown.css` file and add a `markdown-body`
class to the container of your rendered Markdown and set a width for it.
GitHub uses `980px` width and `45px` padding, and `15px` padding for
mobile."* `doc.html` does exactly that. Its `<!doctype html>` is load-bearing
for the reason the README gives under "Troubleshooting": without it the browser
falls into quirks mode and renders table fonts wrong.

Every rule in the file is scoped to `.markdown-body`, so nothing it carries can
reach the console — and `doc.html` no longer loads `styles.css` at all, so
nothing the console carries can reach a document.

## Why markdown-it, and only as a tokeniser

`DEC-markdown-it-is-vendored-as-the-tokeniser-and-the-drawings`, owner ruling of
2026-09-05, on measurement rather than preference: the hand-written renderer it
replaces put 84% of `README.md` inside a `<pre>`, lost all 29 tables, and kept
37 of ~100 headings, because its fence rule could not see CommonMark's
variable-length fences. Full working in
`docs/superpowers/specs/2026-09-05-documentation-tooling-research.md`.

`src/ui/public/lib/markdown.js` calls `md.parse()` and never `md.render()`, runs
with `html: false`, and builds every node with `createElement` / `textContent`.
No HTML string is produced, so no sanitiser is vendored and none is needed.

**mermaid is NOT here, and that is the other half of the same ruling.** It is a
devDependency that never ships; `scripts/gen-diagrams.ts` draws the READMEs' ten
diagrams ahead of time into `src/ui/public/diagrams/` and
`test/ui/diagram-gate.test.ts` keeps the drawings and their sources in step.
Vendoring mermaid to draw in the browser was priced at 3,572,661 B — 96% of the
whole change — and rejected.

## Offline

Neither the library nor the renderer fetches anything.

```
grep -c 'https\?://' src/ui/public/lib/vendor/markdown-it.esm.min.js
```

returns **3**, and all three were read rather than counted:
`https://github.com/markdown-it/markdown-it` in the licence banner on line 1,
and two bare `http://` scheme prefixes inside the linkify normaliser
(`` `http://${e.url}` ``) — string concatenation, not an address, and linkify is
off anyway. Measured across the whole file: **0** `import` statements, **0**
`fetch(`, **0** `XMLHttpRequest`, **0** `new Worker`, **0** `importScripts`,
**0** `eval(`, **0** `new Function`, **0** `WebAssembly`.
`scripts/check-vendor.ts` asserts every one of those mechanically. The
Playwright run in `e2e/` is the stronger check: it fails if the Documentation
screen makes any request that leaves the loopback origin.

The stylesheet is measured the same way:

```
grep -c 'url(' src/ui/public/lib/vendor/github-markdown-light.css
```

returns **2**, and both were read rather than counted: the
`-webkit-mask-image` and `mask-image` halves of ONE
`url("data:image/svg+xml,…")` carrying GitHub's inline link octicon, which
fetches nothing. The two `http` occurrences in the file are both the
`http://www.w3.org/2000/svg` namespace INSIDE that data URI. Measured across
the whole file: **0** `@import`, **0** `@font-face`, **0** remote `url()`, and
**0** of every construct in `FORBIDDEN`. So the page loads no font, no image
and no sheet from anywhere but this server — the same offline guarantee the
tokeniser gives.
