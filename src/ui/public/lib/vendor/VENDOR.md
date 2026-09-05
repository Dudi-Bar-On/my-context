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

## How to re-fetch

```
curl -sSL -o src/ui/public/lib/vendor/markdown-it.esm.min.js \
  https://unpkg.com/markdown-it@15.0.1/dist/browser/markdown-it.esm.min.mjs
curl -sSL -o src/ui/public/lib/vendor/LICENSE-markdown-it.txt \
  https://unpkg.com/markdown-it@15.0.1/LICENSE
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
