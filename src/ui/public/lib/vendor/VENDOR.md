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
| `webawesome/chunks/chunk.26QE47KB.js` | `@awesome.me/webawesome` | 3.12.0 | 280 | `ef6d98607a460410f76421b90e20b86158104003d5bb17254b795bff1bed8560` |
| `webawesome/chunks/chunk.4QWUDRS5.js` | `@awesome.me/webawesome` | 3.12.0 | 526 | `d4581daa488e6862b08203e42c26be2c08538303b39ccd2f32eaeeba14e3c9aa` |
| `webawesome/chunks/chunk.AG44H7MD.js` | `@awesome.me/webawesome` | 3.12.0 | 300 | `6deaa6b3b1ef89bd1d3ab01a4da76019cfe41edd9c7d0cdcc6bb3c39d408d7a3` |
| `webawesome/chunks/chunk.BKE5EYM3.js` | `@awesome.me/webawesome` | 3.12.0 | 10,602 | `93fc32cb9e779758bb24608542d3a5e594ccfbf399a07552c43e0dcdfa8286a1` |
| `webawesome/chunks/chunk.E2G7AAZ3.js` | `@awesome.me/webawesome` | 3.12.0 | 5,408 | `8fe72ff12a115007503dcd3f6fcaea7874a6c8d61a70d3df1d3c008f515f6e9c` |
| `webawesome/chunks/chunk.EFUXUR2V.js` | `@awesome.me/webawesome` | 3.12.0 | 762 | `a3b72d9813af6ee868bfa64ebc52f49c30560af93d86a10f714e155950d2a1fe` |
| `webawesome/chunks/chunk.FNFKITIN.js` | `@awesome.me/webawesome` | 3.12.0 | 587 | `05bd601319c91f3671b34a8fee0bf6aebbb3da6b3c586b3cd0b33a75209bbf17` |
| `webawesome/chunks/chunk.FYKN76UA.js` | `@awesome.me/webawesome` | 3.12.0 | 270 | `27d239411e4f90e13223b66b2bd505dc044eb2174ac925a031e47fafd449d202` |
| `webawesome/chunks/chunk.H23DVATU.js` | `@awesome.me/webawesome` | 3.12.0 | 735 | `36555f905166b76be1f6c93e6a910ac4f446f764dae934581ac4ffd42c8b5b49` |
| `webawesome/chunks/chunk.HOKYDFUG.js` | `@awesome.me/webawesome` | 3.12.0 | 4,113 | `ae04ea6e19a128ae93e15848dfafaf2a642ed69e337d483700b31f576177844e` |
| `webawesome/chunks/chunk.J7EXAHCE.js` | `@awesome.me/webawesome` | 3.12.0 | 3,598 | `0230f5cc476ffd7dbc4b7d67a37df98516b994816b29f898408b40609da265ee` |
| `webawesome/chunks/chunk.JHZRD2LV.js` | `@awesome.me/webawesome` | 3.12.0 | 3,116 | `35c27c488c8f96d942576c8835f6cd8f167857b0a48e5f290445a0a653a0d60b` |
| `webawesome/chunks/chunk.K5EDTD7G.js` | `@awesome.me/webawesome` | 3.12.0 | 1,184 | `4cf5a79d7ae1efae5da3ec7438d60bff9746c3af1e71128b91cac3f1eaba0898` |
| `webawesome/chunks/chunk.KWDPKKFO.js` | `@awesome.me/webawesome` | 3.12.0 | 1,401 | `f9b96c80ce837583334dfbd0cbe4eb85fd151ddf28590d807bb84967c14a29c2` |
| `webawesome/chunks/chunk.L6CIKOFQ.js` | `@awesome.me/webawesome` | 3.12.0 | 1,464 | `1e426869dee8e765fc800dad41835a4e60b2b8a2b674740b9535138f95598e6a` |
| `webawesome/chunks/chunk.LBLI4KS5.js` | `@awesome.me/webawesome` | 3.12.0 | 10,475 | `3ad5b0014413b8fcaa810e6df13e6b3ab92a4bbe1d918c115c66dae32569b24e` |
| `webawesome/chunks/chunk.LCFSCRUJ.js` | `@awesome.me/webawesome` | 3.12.0 | 340 | `6b77f5df8389a522074d7e167284d6481e4ee5e75fc69cf777d47a5edbbc4157` |
| `webawesome/chunks/chunk.O6IZ4I7T.js` | `@awesome.me/webawesome` | 3.12.0 | 800 | `fb07b6548d880ab1c0d494c16994c19745a4e93b5ab49d4fd2738994c0433330` |
| `webawesome/chunks/chunk.PZAN6FPN.js` | `@awesome.me/webawesome` | 3.12.0 | 917 | `50842247fdfad90b803024780aadba164feb4f944a55a5f485153493e67379a9` |
| `webawesome/chunks/chunk.Q6XMGFWJ.js` | `@awesome.me/webawesome` | 3.12.0 | 292 | `da8457dd69d2455f022fa9fec5e3c5a04e626a9a75a2fb5c5dc4385ad72acb86` |
| `webawesome/chunks/chunk.SJBMXU7J.js` | `@awesome.me/webawesome` | 3.12.0 | 17,602 | `39355595d386ed97fa848afe5eaad9c367af15a53cc1a6b22ea274f55d33d3f6` |
| `webawesome/chunks/chunk.T2SU5Q2S.js` | `@awesome.me/webawesome` | 3.12.0 | 11,782 | `8c680baafc94e973f89ecd1fa2b8e4b770b8f367385ee877d244652c4a604c13` |
| `webawesome/chunks/chunk.TLFIX76K.js` | `@awesome.me/webawesome` | 3.12.0 | 12,167 | `81f83a97c009f390a5360951af4bbdac15468008ac3ca791fa81393668571d8a` |
| `webawesome/chunks/chunk.U36KZLSQ.js` | `@awesome.me/webawesome` | 3.12.0 | 278 | `f379eb8e673a0caafb695ac399943c905116f467f0e024d713ecebf0392d5426` |
| `webawesome/chunks/chunk.YXOWVBUA.js` | `@awesome.me/webawesome` | 3.12.0 | 361 | `3b36128b36760bb3941a7a7e9b0a77b0448017898a687971b3a0182235a4bbe8` |
| `webawesome/chunks/chunk.ZSEFTQAO.js` | `@awesome.me/webawesome` | 3.12.0 | 288 | `b36dcde53a8e3b78195de0e1cee954c66c906e3137013f9372ddcc4f7f28530c` |

All three are MIT. `LICENSE-markdown-it.txt`, `LICENSE-github-markdown-css.txt`
and `webawesome/LICENSE-webawesome.txt` sit beside the code each covers, every
one the byte-identical copy of what the package publishes.

**The `File` column is a path, not a name.** It used to be a bare filename
because everything vendored here was a single self-contained file in one flat
directory. `webawesome/chunks/chunk.T2SU5Q2S.js` is a module GRAPH, and
`scripts/check-vendor.ts` walks subdirectories to find it — see **The vendor
gate, widened** below for what changed and why the widening makes the check
stronger rather than looser.

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

Web Awesome is **not** re-fetched with `curl`, and that is not a stylistic
choice — see **Why Web Awesome, and only twenty-six chunks of it** below.

```
node scripts/vendor-webawesome.ts   # fetches the pinned tarball, re-derives the closure
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

## Why Web Awesome, and only twenty-six chunks of it

`docs/superpowers/specs/2026-09-06-tree-component-evaluation.md`, 2026-09-06:
eleven tree components were fetched from their own registries and **measured**,
not read off a README, and one of them cleared all ten bars —
`<wa-tree>` / `<wa-tree-item>` from **Web Awesome 3.12.0**
(`@awesome.me/webawesome`, MIT © 2025 Fonticons, released 2026-08-21).

**It is Shoelace, continued.** The dispatch named Shoelace as the strongest
starting point and it was; Web Awesome is the same project, renamed and carried
on by Fonticons. shoelace.style now says *"Shoelace Is Sunset with no active
development"* and *"Use Web Awesome for ongoing work."* Shoelace's last release
is 2.20.1, 2025-03-11. Adopting the sunset one would have been adopting a
maintenance burden, and it fails this directory's own gate anyway: its tree
closure includes `sl-icon`, whose `icon.component.ts` does
`await fetch(url, { mode: "cors" })`.

**Twenty-six chunks, and NOT the two documented entry points.** This is the
load-bearing sentence on this page. Web Awesome publishes two builds and, within
the CDN build, two ways in:

| Entry | Files | Bytes | `FORBIDDEN` hits |
|---|---|---|---|
| `components/tree/tree.js` + `components/tree-item/tree-item.js` — the documented barrels | 49 | 206,017 | **`fetch(`**, in `chunk.WSTNGCWW.js` |
| `chunks/chunk.T2SU5Q2S.js` (`WaTree`) + `chunks/chunk.SJBMXU7J.js` (`WaTreeItem`) | **26** | **89,648** | **none** |

Each barrel carries ~45 side-effect imports registering every component
`wa-tree-item`'s template *can* render — `wa-icon`, `wa-spinner`, `wa-checkbox` —
and `wa-icon` is where the `fetch(` lives. The two named imports reach the
component classes and their transitive closure, which self-register through Web
Awesome's own `customElement` decorator. **Taking the smaller closure is not a
trick to dodge the gate; it is declining three components this product does not
use**, and what that costs is written down rather than discovered later:

- **No `wa-icon`.** We slot our own inline `<svg>` chevrons — `tree-proof.html`
  is the worked example, and `<wa-tree>` clones one pair onto every item. A
  slotted SVG does not mirror itself the way `wa-icon` did, so `styles.css`
  carries one `[dir="rtl"] wa-tree svg.wa-chev{transform:scaleX(-1)}` rule.
- **No `wa-spinner`**, so `lazy` expansion has no built-in loading affordance.
- **No `wa-checkbox`**, so `selection="multiple"` is unavailable. Single
  selection is what a file browser wants.

The `dist/` build was rejected outright: its imports are bare (`lit`,
`@lit/context`, `nanoid`) and need a resolver, which `CONST-node-24-no-build-step`
does not permit. `dist-cdn/` resolves itself with relative `./chunk.*.js`
specifiers, which is exactly what a browser loads from a static directory.

**No rename was needed.** All 26 files are `.js`, already in `src/ui/static.ts`'s
five-extension allow-list — so unlike `markdown-it.esm.min.mjs` these are
committed under the names upstream publishes. `test/ui/webawesome.test.ts`
checks every extension against that table rather than trusting the sentence.

### How it is re-fetched, and why a script rather than a curl line

The 26 filenames are **esbuild content hashes**. They are an output of Web
Awesome's build, stable within a release and changing wholesale on upgrade, so a
list of `curl` lines would be twenty-six pieces of folklore nobody could
re-derive. `scripts/vendor-webawesome.ts` writes down the RULE instead and lets
the hashes be its output:

1. Fetch the tarball and refuse it unless it matches, byte count and SHA-256:

   ```
   https://registry.npmjs.org/@awesome.me/webawesome/-/webawesome-3.12.0.tgz
     2,484,536 B   sha256 8fb34b5d18c0161bf934d264d39dae649aabd8f4e31135e9cd8bfbae5fa3078d
   ```

2. Read the two documented entry points and take the ONE chunk each names in its
   `import { WaTree } from '…'` / `import { WaTreeItem } from '…'` line.
3. Walk the transitive closure of relative specifiers from those two roots.
   Abort on a bare specifier or a missing file.
4. Copy the closure verbatim, and `LICENSE.md` to `webawesome/LICENSE-webawesome.txt`
   (1,059 B, `e024db6c0a83b08f33eedda3eb92d90439169903f7d9d7cfeb200c989cd62881`).
5. Print the pin rows above.

An upgrade is then the deliberate act this document already demands: a new
tarball digest in the script, a re-derived file set, new rows here, tests re-run.

### The vendor gate, widened — and why that made it stronger

`scripts/check-vendor.ts` could not have accepted this, for two reasons that
were both *correct behaviour for a single self-contained file*:

1. **It read this directory flat** — one non-recursive `readdirSync` — so a file
   in a subdirectory was not merely unpinned, it was **invisible**: no digest, no
   byte count, no `FORBIDDEN` scan, and no complaint. That is worse than a
   rejection.
2. **It refused any `import` statement at all**, with the message *"it is no
   longer a single file"*. Right about a lone `markdown-it.esm.min.js`; wrong
   about a module graph committed whole.

Owner ruling, 2026-09-06: *"Widen it: walk subdirectories, and allow a relative
import only when it resolves to another file in the pinned manifest — still
refusing bare specifiers."*

That is what it now does, and the new rule is **strictly stronger over a graph
than the old one was over a file**. "No imports" says a file is alone. "Every
import resolves to another pin" says the graph is **closed**: nothing in this
directory can reach a byte that this table has not pinned and that scan has not
read. A bare specifier fails, a relative specifier landing outside this table
fails, and an `import()` whose argument is not a literal fails because nothing
can say where it goes. `test/scripts/vendor-gate.test.ts` plants each of those
and watches the gate refuse.

**`FORBIDDEN` was not relaxed, and must not be.** All seven strings — `fetch(`,
`XMLHttpRequest`, `new Worker`, `importScripts`, `eval(`, `new Function`,
`WebAssembly` — are **zero** across the 26 files, which is precisely why the
26-file closure was chosen over the 49-file one. A vendored set that trips one
is a set to re-derive, never a reason to shorten the list.

### Offline

Measured the same way as the other two:

```
grep -c 'https\?://' src/ui/public/lib/vendor/webawesome/chunks/*.js
```

returns **28** across the set, from exactly **two** distinct strings, both read
rather than counted: `https://webawesome.com/license` in each file's copyright
banner, and a `https://webawesome.com/docs/components/${…}` template inside a
console warning message. Neither is a request. Also measured across the 26:
**0** `@import`, **0** `url(`, **0** `sendBeacon`, **0** `EventSource`, **0**
`WebSocket`, **0** `localStorage`, **0** `document.write`, **0** `import.meta`,
**0** bare specifiers.

**`innerHTML` appears once**, in Lit's template compiler, setting a detached
`<template>`'s content from the component's own static tagged-template strings.
It is not in `FORBIDDEN`, it is not attacker-reachable — corpus paths reach the
DOM through text bindings — and it is recorded here so it is not discovered
later and mistaken for a hole.

The strong check is the browser one. `e2e/wa-tree.spec.ts` opens
`/tree-proof.html` on the real server and counts every request the page makes:
one document, one stylesheet, the 26 modules and the shim — and **zero off
origin**, in `dir="ltr"` and `dir="rtl"`.

### The palette: ten custom properties, and no theme

The vendored closure contains **zero** hard-coded colours (no hex, no `rgb()`,
no `hsl()`, no `white`/`black`) and **zero** `prefers-color-scheme` queries. Its
entire visual surface is ten `--wa-*` custom properties. Web Awesome defines
them in `dist/styles/themes/default.css` (16,773 B); **that file is not
vendored.** `styles.css` defines all ten from this product's own dark tokens, in
one block scoped to `wa-tree` so the foreign vocabulary cannot leak onto a
screen — and there is no light theme to override because there is no theme at
all. This is the opposite of the `github-markdown-css` situation above, where a
whole appearance was adopted on purpose.
