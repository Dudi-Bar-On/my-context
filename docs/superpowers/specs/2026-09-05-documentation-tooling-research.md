# Documentation tooling — research and recommendation

**Status:** research, not a decision. Written 2026-09-05 under
`DEC-an-external-documentation-tool-may-be-embedded-and-it-may`, the owner's ruling that a
documentation tool may be brought in from outside "even it's a kind of dependency", scoped to the
documentation system and nowhere else. Its companion
`DEC-the-documentation-screen-is-a-help-system-built-from-the` says what the screen is for: a help
system built from `README.md` and `docs/README.he.md`, **drawings included**.

**No product code was written and `package.json` was not touched.** Adopting a dependency is the
owner's commit to make. Everything below that says "measured" was measured on this machine today,
against these two READMEs, and the method is stated so it can be re-run.

---

## 0. The one-paragraph answer

**Vendor two files into `src/ui/public/lib/`: `markdown-it@15.0.1`'s browser ESM build as a
TOKENISER, and `mermaid@11.17.2`'s single-file browser build, lazy-loaded on the Documentation
screen only.** Ship no syntax highlighter, no site generator, no docs SDK, no sanitiser. The
markdown-it half is not a taste preference and not "newer is better": the renderer in the repo
today puts **84% of `README.md` inside a `<pre>`**, loses **all 29 tables**, and prints **four of
the five mermaid diagrams as running prose**. The mermaid half is the thing the owner named. The
first is a prerequisite for the second — you cannot hand mermaid a fence the renderer cannot
identify as a fence.

---

## 1. What the material actually is — measured

Both READMEs, parsed with `markdown-it@15.0.1` (the reference parse; CommonMark + GFM tables):

| | `README.md` | `docs/README.he.md` |
|---|---|---|
| Size on disk | 435,749 B | 579,601 B |
| Headings | 98 | 98 |
| Tables / rows | 29 / 323 | 29 / 323 |
| Fenced code blocks | 117 | 117 |
| Text genuinely inside a fence | **16%** of source | **17%** of source |
| Fence info strings | `text` 90 · `json` 12 · `bash` 8 · `mermaid` 5 · none 2 | identical |
| Blockquotes | 25 | 24 |

Two structural facts drive everything:

1. **Both documents use CommonMark's variable-length fences.** Backtick-run census: 234 runs of
   three, **4 runs of four, 2 runs of five**. Those longer fences legitimately wrap **6 lines that
   themselves begin with three backticks** — the READMEs quote markdown at themselves. Correct
   pairing yields 117 blocks; naive pairing does not.
2. **The Hebrew mirror carries its bidi as raw HTML**: **130** `<div dir="rtl">` blocks and
   **1,134** `<span dir="ltr">` inline wrappers. Parsed with `html: true`, markdown-it reports 426
   `html_block` and 3,345 `html_inline` tokens for that file. These exist because GitHub renders
   the raw markdown; they are an artefact of the publishing target, not content.

Of the 117 fences, only **20** (12 `json` + 8 `bash`) carry a language a highlighter could colour.
90 are `text` — terminal transcripts that this project deliberately shows verbatim. That number
decides §5.

---

## 2. What the screen does today — measured, and it is worse than "ugly"

Method: load `src/ui/public/screens/docs.js` unmodified into Node against the two-method fake
document the repo's own `test/ui/docs-screen.test.ts` already uses, feed it each README whole, and
count the nodes that come out.

| | `README.md` today | `docs/README.he.md` today | truth |
|---|---|---|---|
| Rendered text sitting inside `<pre>` | **84%** | **83%** | 16–17% |
| `<table>` elements | **0** | **0** | 29 |
| `<h2>`/`<h3>`/`<h4>` | 9 / 11 / 17 | 9 / 11 / 17 | ≈8 / 17 / 75 |
| Largest single `<pre>` | **45,244 chars** | 40,258 chars | — |
| Mermaid diagrams in their own `<pre>` | **1 of 5** | **1 of 5** | 5 |
| Mermaid diagrams printed as `<p>` prose | **4 of 5** | **4 of 5** | 0 |
| Parse time | 3 ms | 2 ms | — |
| Refusals raised | 12 | 20 | — |

The largest `<pre>` begins, verbatim from the run:

> `**These rules are not complete coverage, and nothing here can make them so.** They are prefix
> matches on a command string…`

— 45 KB of prose, headings, blockquotes and lists, drawn as a code block.

**Root cause, isolated.** `docs.js` line 302: `const FENCE = /^\s*```/`, and the block branch scans
`for (; i < lines.length && !FENCE.test(lines[i]); i += 1)`. It closes on the first line that starts
with three backticks, regardless of the opening fence's length. The 6 nested three-backtick lines
inside the four- and five-backtick blocks flip fence parity, and everything after each flip is
mis-classified until the next flip corrects it.

**The cheap fix, tried, and it is not enough.** I patched only that branch in a scratch copy — track
the opening run length, close only on a run at least as long with an empty info string. Result:

| | today | fence fix | markdown-it | truth |
|---|---|---|---|---|
| `README.md` text in `<pre>` | 84% | **30%** | **16%** | 16% |
| `<table>` | 0 | 17 | **29** | 29 |
| `<tr>` | 0 | 189 | **323** | 323 |
| headings (h2+h3+h4) | 37 | 91 | **98** | 98 |
| parse time | 5 ms | 6 ms | 38 ms | — |

A one-branch change recovers most of it and still leaves **a third of the document as code and 12
of 29 tables missing**, with a second, undiagnosed defect behind it. That is the honest reason the
"keep what we have plus CSS" answer does not survive contact with the measurement — and it is the
same mistake the ruling already records me making once.

---

## 3. Comparison table

Sizes are bytes of the actual published artefact, read from unpkg `?meta` and re-confirmed by
downloading and `wc -c`. Licences are the registry `license` field, cross-read against the
package's own `LICENSE` file.

| Candidate | What it does | Build step? | Embeddable in one `<div>`? | Offline / vendorable? | CSP | RTL | Dark | Size | Licence | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| **mermaid 11.17.2** | Renders `mermaid` fences to SVG | **No** — `dist/mermaid.min.js` is one self-contained classic script setting `globalThis.mermaid` | **Yes** — `render()` returns an SVG string you place yourself; never touches the page | **Yes** — measured **zero** external requests across 3 browser runs | No `eval`, no `new Function`, no WASM. **Needs `style-src-*: 'unsafe-inline'`** if a CSP returns (§6) | **Correct** — 5/5 Hebrew diagrams render under `dir="rtl"`, screenshot-verified | `theme:'dark'` built in | **3,572,661 B** (gzip −9: 975,709) | **MIT**, bundling DOMPurify 3.4.12 (`Apache-2.0 OR MPL-2.0`) + lodash/cytoscape MIT notices | **ADOPT** |
| **markdown-it 15.0.1** | Markdown → token array | **No** — `dist/browser/markdown-it.esm.min.mjs`, zero `import` statements | **Yes** — it is a parser; it renders nothing | **Yes** — one file, no deps | 0 `eval`, 0 `new Function` | Nothing RTL-specific; `dir="auto"` is the caller's job (§7) | N/A | **137,975 B** | **MIT** | **ADOPT as tokeniser** |
| **marked 18.0.11** | Markdown → HTML string | No — `lib/marked.esm.js` is pre-minified, zero imports | Yes | Yes | 0 `eval` | Nothing; `marked-bidi` plugin exists (MIT) | N/A | **43,800 B** | **MIT** | Runner-up — 3× smaller, but its documented path is HTML string + DOMPurify (a 2nd file, `MPL-2.0 OR Apache-2.0`), and the token API is off the happy path |
| **micromark 4.0.2** | Markdown → HTML string | **Effectively yes** | Yes | **No** — 0 prebuilt bundles; 30 packages, 82 files, 11 bare specifiers; its own README says use `esm.sh?bundle` | 0 `eval` | Nothing | N/A | 209,635 B unpacked, unbundled | MIT | **REJECT** — cannot be vendored without a bundler or a 30-entry import map |
| **highlight.js 11.12.0** | Syntax highlighting | No — `es/highlight.min.js` is real ESM | Yes | Yes, 2 files | Clean: class names only, no inline style | Themes declare no `text-align`/`direction` | 15 dark themes | ~130,000 B + 1,315 B CSS | **BSD-3-Clause** | **REJECT for lack of demand** — only 20 of 117 fences are highlightable |
| **Prism 1.30.0** | Syntax highlighting | No, but **not ESM** — classic scripts mutating `window.Prism` | Yes | Yes, ~12 files | Clean | **All 8 bundled themes hardcode `text-align:left`** | 4 dark | ~35,000 B | MIT | **REJECT** — v2 has no release and no npm dist-tag; maintainers accept security PRs only |
| **Shiki 4.4.3** | Syntax highlighting (TextMate) | No compiler, but **an import map for ~30 bare specifiers is mandatory** | Yes (`codeToHast` → AST) | Only with that plumbing | **Worst here**: emits inline `style` on every token span (needs `style-src 'unsafe-inline'`); default engine needs **`wasm-unsafe-eval`** unless you take the lossy JS engine | No `direction` emitted | ~40 dark, colours inline | **≈1.19 MiB / ~180 files** (JS engine); 1.59 MiB with WASM | MIT | **REJECT** — 10× the bytes and an import map, for 20 code blocks |
| **Docsify 5.0.0** | Runtime docs *site* | No — `dist/docsify.min.js` self-contained | **No** — hash routing, `_sidebar.md`, owns the page; it is a site framework, not a widget | Yes (serves your own `.md`) | **Fails** — contains `new Function(n)()` in `executeScript`, i.e. needs `script-src 'unsafe-eval'` and executes JS found in markdown | — | — | 185,377 B core (+152,626 B search) | MIT | **REJECT** — not embeddable, and `unsafe-eval` |
| **zero-md 3.1.8** | `<zero-md>` web component | No | Yes | **No** — `src/lib/presets.js` hard-codes `https://cdn.jsdelivr.net/...` and lazily `import()`s marked, highlight.js, KaTeX and mermaid at first render | — | — | — | 7,504 B shell + a CDN | ISC | **REJECT** — CDN-only distribution is the named fail |
| **@docsearch/js 5.0.5** | Docs search widget | UMD available | Yes | **No** — every query hits Algolia; requires `appId`/`apiKey` | — | — | — | 288,149–586,028 B | MIT | **REJECT** — hosted SaaS |
| **@mintlify/widget 0.0.164** | Docs assistant widget | Yes (React + 8 deps) | Yes | **No** — requires a Mintlify dashboard API key; script loaded from unpkg | — | — | — | — | **Elastic-2.0** (not OSI-approved) | **REJECT** — SaaS, and a licence this plugin cannot ship |
| **@gitbook/embed 0.5.1** | Docs embed | Yes | Yes | **No** — script served from your GitBook site, initialised with `siteURL` | — | — | — | — | **no `license` field** | **REJECT** — SaaS |
| **@readme/markdown 15.4.0** | ReadMe's MDX renderer | Yes — ~70 deps incl. React, MDX, Tailwind, PostCSS | — | No usable single-file dist | — | — | — | — | MIT | **REJECT** — build step |
| **Docusaurus / VitePress / Starlight / Nextra** | Static site generators | **Yes.** Docusaurus's own install page: *"a modern static website generator, so we need to build the website into a directory of static contents"* — `npm run build` → `/build`. VitePress's getting-started prescribes `"docs:build": "vitepress build docs"`. | — | — | — | — | — | — | MIT | **REJECT** — `CONST-node-24-no-build-step`. Verified rather than assumed, for the two whose docs state it outright; Starlight and Nextra are Astro and Next.js sites and inherit the same shape |

**On "an SDK meant for embedding docs into an existing app", which is what the ruling asked
about:** that category is, in practice, the SaaS category. Mintlify, ReadMe and GitBook all ship
widgets whose entire value is a hosted backend; DocSearch is a thin client over Algolia. The only
two non-SaaS members are Docsify — which owns the page and needs `unsafe-eval` — and zero-md, which
is a CDN loader wearing a web component's clothes. **There is no offline, build-free, embeddable
documentation SDK.** The shape that fits is a library, exactly as the ruling already concluded.

---

## 4. The recommendation

### 4.1 `mermaid@11.17.2` — `dist/mermaid.min.js`, vendored, lazy-loaded

This is the one the owner named and it clears every bar. Verified in Chromium via the Playwright
already in `devDependencies`, against a throwaway loopback server on an ephemeral port, three runs
(strict CSP / no CSP / no CSP + `dir="rtl"` + Hebrew):

- **All 5 English and all 5 Hebrew diagrams rendered.** No errors, no fallbacks.
- **Zero external network requests**, all three runs. A widely-repeated claim that mermaid's themes
  `@import` Manrope from Google Fonts is **false for 11.17.2** — the shipped bundle contains zero
  occurrences of `googleapis`, `Manrope` or any font URL, and the browser made no off-origin
  request. (The claim originates in a third-party issue tracker; I checked the artefact instead.)
- **Dark theme** via `theme: 'dark'`; `fontFamily: 'inherit'` makes it take the console's own stack.
- **RTL is correct**, screenshot-verified: Hebrew node labels, Hebrew edge labels, `<b>` bolding and
  `<br/>` line breaks all render; bidi neutrals fall where an RTL paragraph puts them. Mermaid does
  not mirror graph *direction* under `dir="rtl"` — a `flowchart LR` still flows left-to-right — which
  is the right behaviour for a diagram and is stated here so nobody reports it as a bug.
- **Cost: 540–590 ms** for page load + parse of the 3.5 MB script + render of 5 diagrams, cold.
- **Embeddable**: `await mermaid.render(id, def)` returns `{ svg }`. It never touches the document.
  The container is yours. Load with `mermaid.initialize({ startOnLoad: false })` and never call
  `mermaid.run()`, so nothing scans the page.
- **No `eval`, no `new Function`, no WASM, no `document.write`.** Static scan of the shipped bundle:
  0 `eval(`, 0 `new Function`, 0 `WebAssembly`. There are 4 occurrences of `Function("return this")`
  — the lodash `globalThis` fallback — each short-circuited by
  `typeof self=="object"&&self&&self.Object===Object&&self`, so in a browser it is parsed and never
  called. CSP governs the call, not the parse. Stated precisely because "grep found `Function(`" is
  the kind of finding that gets a good candidate killed for the wrong reason.

### 4.2 `markdown-it@15.0.1` — `dist/browser/markdown-it.esm.min.mjs`, as a tokeniser only

`markdownNodes` keeps its name, its signature `(src, doc, labelFor)`, its `{ nodes, refusals }`
return, and its contract — **no HTML string is ever produced**. What changes is that the
hand-written block/inline scanner is replaced by `md.parse()` plus a walker over the flat token
array. `dv.mdnote`, the sentence drawn on the screen, stays true word for word: nodes are built with
`createElement`/`textContent`, images and unknown URL schemes are still *refused and shown as
refusals, not silently dropped*. **No DOMPurify.** markdown-it's own `docs/safety.md` states that
with HTML disabled "output will be safe without sanitizer", and we are not even taking its output —
we are taking its tokens.

Configuration:

- `html: true`, so the Hebrew mirror's 130 `<div dir="rtl">` and 1,134 `<span dir="ltr">` arrive as
  `html_block` / `html_inline` tokens instead of being escaped into visible `<span dir="ltr">` text.
  Handle them with a strict allow-list — `div[dir]`, `span[dir]`, `details`, `summary`, `b`, `br`
  materialised as real elements; **everything else refused**, which is the behaviour the screen
  already claims. This is the only place raw HTML is honoured and the list is closed by construction.
- `linkify: false`, `typographer: false` — neither is wanted and both add surprises.
- `md.parse()`, never `md.render()`. `MarkdownIt.Token` is exposed as a static in v15.

Why markdown-it over marked, which is 3× smaller: marked's documented path is `parse()` → HTML
string → *"use a sanitize library, like DOMPurify"*, which costs a second vendored file under
`MPL-2.0 OR Apache-2.0`. `marked.lexer()` avoids it but is the less-travelled path. markdown-it
publishes `parse()` as the supported way to write a custom renderer, its browser bundle is a single
file with zero imports, and it is the parser whose numbers matched ground truth exactly.

### 4.3 What this costs, plainly

- **3.71 MB of vendored third-party JavaScript in the repository and in the npm tarball.**
  `src/ui/public/` is 2,527,418 B today; this makes it 6,238,594 B. `package.json`'s `files`
  includes `src/`, so the published package carries it. **This is the trade-off.** It buys nothing
  at hook time — hooks never load the UI — and nothing at UI boot if mermaid is lazy-loaded, but it
  is real bytes in a plugin whose pitch is that it installs without fetching packages.
- **`CONST-zero-runtime-dependencies` is not violated.** `dependencies` stays empty; these are
  vendored static assets, the same category as `src/ui/public/fonts/*.woff2`. But the *spirit* of
  that constraint is dented and pretending otherwise would be dishonest. The ruling that permits it
  is scoped to documentation; nothing here licenses a fourth dependency anywhere else.
- **A renderer rewrite.** `markdownNodes`'s ~350 lines of block/inline scanning become a token
  walker. The node factories, the refusal machinery, `assignAnchors`, `headingKey` and every caller
  (`app.js:173`, `app.js:1301`, `tut.js`) are untouched. `test/ui/docs-screen.test.ts` asserts
  behaviour through the same two-method fake document and should mostly survive; the fence and
  raw-HTML cases will need new expectations, which is correct — they are asserting the old bug.
- **~35 ms of parse per README**, up from ~5 ms. Irrelevant against a 540 ms mermaid load.

---

## 5. What this does NOT solve

- **No syntax highlighting, and that is deliberate.** 20 of 117 fences carry a highlightable
  language (12 `json`, 8 `bash`). 90 are `text`. Shipping 130 KB (highlight.js) or 1.19 MiB (Shiki)
  to colour 20 blocks is not a trade this document can recommend. What `<pre>` needs is CSS — a
  border, a background one step off the page, a monospace stack that already exists in
  `src/ui/public/fonts/`, `direction: ltr; unicode-bidi: isolate` inside the RTL page, and the fence
  info string surfaced as a small corner label. If, after that, the owner still finds code blocks
  ugly, `@highlightjs/cdn-assets@11.12.0/es/highlight.min.js` (129,152 B, BSD-3-Clause, real ESM,
  class-names-only output, 15 dark themes) is the candidate to reach for and nothing else.
- **It does not serve the READMEs.** No route answers `README.md` today. `read-model.ts`'s
  `UI_HELP_TOPICS` is four strings and `README.md` sits outside `src/ui/public/`, so the static
  handler cannot reach it either. The serving question belongs to
  `DEC-markdown-is-served-from-a-manifest-rendered-by-one-renderer` and
  `TASK-serve-markdown-documents-to-the-ui-behind-a-decided-boundary` (`walk/25`), and is not
  re-decided here. **A renderer with nothing to render is not a help system**; this spec is one
  half of a screen.
- **It does not index or cross-link anything.**
  `REQ-the-two-readmes-are-the-base-of-a-documentation-system-that` asks for documentation that is
  "indexed, with links, the way a real documentation package works" — a reader who navigates rather
  than scrolls one long file. A tokeniser gives you the raw material for that (markdown-it's token
  stream carries every heading with its level, which is what a real contents tree is built from) and
  none of the navigation. **That is the half of the requirement a library cannot buy**, and it is
  the half that a site generator would have given us for free if a site generator were admissible.
  Worth stating plainly: the reason no external tool solves this project's documentation problem
  outright is that the tools which index are the tools which build.
- **It does not design the screen.** The ruling also said both screens "look very bad" and that the
  work is to be done with UI/UX expertise. Tokenising correctly is a precondition for that work, not
  a substitute for it.
- **It does not handle `> [!NOTE]` alerts.** Both READMEs use GitHub's alert syntax inside
  blockquotes; markdown-it renders them as ordinary blockquotes. Recognising the marker is a small
  addition to the walker, listed here so it is not discovered later.
- **It does not decide what happens to the 5 shields.io badges.** They are network images at the
  top of `README.md`. `dv.mdnote` says images are refused; for an offline tool that is arguably
  right, but five refusal boxes above the fold is not a good first impression either. Someone has to
  choose: refuse them, drop them silently, or drop the badge block from the READMEs.
- **It does not restore the CSP.** See §6.

---

## 6. CSP — the one place mermaid costs something

**The server sends no `Content-Security-Policy` today.** `SECURITY_HEADERS` in `src/ui/security.ts`
is four headers and the CSP is suspended by owner decision of 2026-08-22, with
`server-e2e.test.ts` asserting the absence so it cannot come back by drift. So mermaid's CSP
behaviour blocks nothing now. It matters for the day the CSP returns, and that file already names
the shape it would return in.

Measured, same Chromium harness, same 5 diagrams:

| Policy | Violations | Result |
|---|---|---|
| `style-src 'self'` | **583** | **Renders, and the output is destroyed** — nodes become solid black boxes, arrows mangle, geometry collapses to container width. Screenshot-verified. |
| `style-src-elem 'self'; style-src-attr 'unsafe-inline'` | 16 | Layout right, **theme CSS lost** — the `<style>` block inside each generated SVG is blocked |
| `style-src-elem 'self' 'unsafe-inline'; style-src-attr 'unsafe-inline'` | **0** | Pixel-identical to no CSP |
| `script-src 'self'` (all runs) | 0 | Fine — the bundle loads as a same-origin `<script src>` and calls no `eval` |

`security.ts` already anticipates naming the two halves separately —
"`style-src-elem 'self'` to keep a stylesheet from being injected, `style-src-attr 'unsafe-inline'`
for the attribute". **Mermaid needs `'unsafe-inline'` on both halves**, because each diagram carries
its theme in a `<style>` element inside its own SVG. The directive worth having back is
`script-src 'self'` — the one that guards agent-authored item bodies — and mermaid costs nothing
there.

If the style half must be strict, there is a mitigation and it is not free: after `render()`, lift
the SVG's `<style>` text out and inject it through the CSSOM (`CSSStyleSheet.insertRule`), which
`style-src` does not govern — `security.ts` records that same distinction from its own 2026-08-22
browser test. That leaves only the style *attributes*, which still need `style-src-attr`. Recorded
as a known route, not recommended work.

---

## 7. RTL

- **mermaid**: verified correct under `dir="rtl"` with Hebrew content, no configuration needed.
- **markdown-it**: does nothing RTL-specific — grep for `rtl`, `dir=` and `direction:` across the
  browser bundle returns zero. Upstream has twice declined to put bidi in core
  (markdown-it #635, #750) in favour of plugins, and the one plugin, `markdown-it-bidi@0.2.0`, is
  **LGPL-3.0-or-later** and therefore not vendorable here.
- **This is a feature, given the walker.** Because we build the DOM ourselves, set `dir="auto"` on
  every block element as it is created, and `dir="ltr"` on the inline-code spans. That reproduces
  structurally what the Hebrew README's 130 `<div dir="rtl">` and 1,134 `<span dir="ltr">` wrappers
  do by hand — which is the argument for recognising those wrappers and dropping them rather than
  drawing them.
- `pre code { direction: ltr; unicode-bidi: isolate; }` inside the RTL page, for all 117 fences.

---

## 8. Vendoring plan

### 8.1 Where the files live

There is already a precedent in this repository and it should be followed exactly:
`src/ui/public/fonts/` holds nine `.woff2` files beside `LICENSE-OFL.txt`, and
`src/ui/public/icons/` holds `LICENSE-MIT.txt`.

```
src/ui/public/lib/vendor/
  mermaid.min.js                 3,572,661 B   mermaid 11.17.2
  markdown-it.esm.min.mjs          137,975 B   markdown-it 15.0.1
  LICENSE-mermaid.txt                          MIT + the bundle's own third-party notices
  LICENSE-markdown-it.txt                      MIT
  VENDOR.md                                    the pin table below, and the refresh command
```

`vendor/` as a subdirectory of the existing `lib/`, so that "which of these files did we write" has
a one-word answer, and so a future `check:` script can assert that nothing under `vendor/` is ever
hand-edited.

**Licences.** mermaid is MIT. Its single-file build embeds, with legal comments preserved by
esbuild: DOMPurify 3.4.12 (`Apache-2.0 OR MPL-2.0`), lodash-es (MIT), cytoscape (MIT), and two
further MIT notices. All permissive, all compatible with shipping inside this MIT plugin, and the
banner block at the end of `mermaid.min.js` must be preserved verbatim — it is the attribution.
markdown-it is MIT with no embedded third parties.

### 8.2 How they are pinned

Exact versions and content hashes, recorded in `VENDOR.md` and asserted by a test:

| File | Version | Bytes | SHA-256 |
|---|---|---|---|
| `mermaid.min.js` | 11.17.2 | 3,572,661 | `581ed7d74bd9048d0e3a91363927d72ef22942d7722546b27f7cc29e35390eb8` |
| `markdown-it.esm.min.mjs` | 15.0.1 | 137,975 | `6f98af51c9dafe4f8f666ad5f9cf087c08f13bbd069604b334aa692025d9c930` |

Provenance, for a refresh:

```
curl -sSL -o mermaid.min.js            https://unpkg.com/mermaid@11.17.2/dist/mermaid.min.js
curl -sSL -o markdown-it.esm.min.mjs   https://unpkg.com/markdown-it@15.0.1/dist/browser/markdown-it.esm.min.mjs
```

A `scripts/check-vendor.ts` in the shape of the existing `check:*` scripts recomputes both digests
and fails if either file changed — so a vendored file cannot be edited, patched or silently
upgraded. Upgrading is a deliberate act: new file, new digest, new line in `VENDOR.md`.

`package.json` is **not** modified. No `dependencies` entry, no `devDependencies` entry. These are
static assets under `src/`, already covered by the `files` array.

### 8.3 How mermaid is loaded

Not by `import`. `mermaid.min.js` is a classic script whose last line is
`globalThis["mermaid"] = globalThis.__esbuild_esm_mermaid_nm["mermaid"].default;`. The Documentation
screen injects `<script src="/lib/vendor/mermaid.min.js">` **on first sight of a `mermaid` fence**,
awaits `onload` once, memoises the promise, then calls `mermaid.initialize({ startOnLoad: false,
theme: 'dark', securityLevel: 'strict', fontFamily: 'inherit' })`. A same-origin external script is
allowed under `script-src 'self'`; nothing inline is injected. Screens without a diagram never pay
the 3.5 MB.

`markdown-it.esm.min.mjs` is a normal ES module and is imported by `docs.js` the way every other
module in `src/ui/public/` is.

### 8.4 How someone verifies offline operation

Three checks, in increasing strength:

1. **Static.** `grep -c 'https\?://' src/ui/public/lib/vendor/mermaid.min.js` — no CDN, no
   `fonts.googleapis.com`, no `unpkg`. The URLs that remain are licence-notice text.
2. **Automated, in the e2e suite.** The repo already runs Playwright. Add a spec that opens the
   Documentation screen, subscribes to `page.on('request')`, and **fails if any request leaves the
   loopback origin**, asserting alongside it that five `<svg>` elements exist. That is the assertion
   that keeps this true after an upgrade; it is the exact harness used to produce §4.1's numbers.
3. **By hand.** Disable the network adapter, start `mycontext ui`, open Documentation in both
   languages. Five diagrams in each, no console errors.

Per `Verify UI in Playwright before saying fixed`: a lane's report that the diagrams render is a
claim. Check 2 is the evidence.

---

## 9. The five mermaid diagrams, specifically

They live at `README.md` lines 125, 405, 1426, 1914, 5693 and `docs/README.he.md` lines 159, 443,
1512, 2012, 6154 — four `flowchart` (TB, LR, LR, TB) and one `stateDiagram-v2`, 294–604 bytes each.
The Hebrew set is a full translation, not a copy: Hebrew node text, Hebrew edge labels, `<b>` and
`<br/>` markup inside labels.

**Today four of the five are printed as paragraphs of prose and the fifth as a code block, in both
languages.** That is the defect the owner called ugly and unreadable, and its cause is the fence
bug of §2 — not the absence of mermaid. **Fix the parser first.** Wiring a renderer to fences the
tokeniser cannot see would leave four diagrams still printed as prose and the fifth as a code block,
and the change would look like it had failed.

Once markdown-it is in, the hookup is three lines in the walker: markdown-it hands the fence as
`{ type: 'fence', info: 'mermaid', content: 'flowchart TB\n  A --> B\n' }` — verified — so the
walker emits a placeholder `<figure>` for `info === 'mermaid'`, and a pass after the document is in
the DOM renders each one:

```
const { svg } = await mermaid.render(uniqueId, def);
figure.replaceChildren(new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement);
```

`DOMParser` rather than `innerHTML`, because this codebase does not assemble markup from strings and
should not start; the SVG is mermaid's own output, already DOMPurify-sanitised under
`securityLevel: 'strict'`, and parsing it as `image/svg+xml` keeps the no-HTML-string rule intact.
Render sequentially and let each `render()` reject independently — a diagram that fails becomes a
refusal block naming itself, which is what the screen already promises for everything else it
cannot draw. Keep the source text in the DOM behind a disclosure, so a broken diagram is still
readable.

**Why runtime rendering rather than pre-rendered SVG files.** A `scripts/gen-diagrams.ts` producing
ten committed SVGs (~630 KB total, measured from the probe output) would be 5.7× smaller than
vendoring mermaid, would need no runtime dependency at all, and would fit this repo's existing
`gen:commands` / `gen:tutorials` / `gen:docs` pattern. It is a real option and it is rejected for
one reason: it creates a tenth class of derived artefact that can go stale, in a project whose
recorded chronic failure is exactly that — "both READMEs went stale five times in two days", in the
ruling's own words. Runtime rendering makes drift structurally impossible: the drawing IS the fence.
It also generalises — the moment a mermaid fence appears in a tutorial or an item body, it draws,
with no script to remember to run. If the 3.5 MB is later judged too expensive, this is the
fallback, and it is a swap behind the same walker.

---

## 10. Sources

Every version, size and licence below was read today; nothing is recalled. Measurements attributed
to "this machine" were produced by the scratch harnesses described in §2, §4.1 and §6 and are
reproducible from the method given there.

**mermaid** — https://registry.npmjs.org/mermaid/latest (version 11.17.2, `license: "MIT"`) ·
https://unpkg.com/mermaid@11.17.2/dist/?meta (`mermaid.min.js` 3,572,661 B; `mermaid.esm.min.mjs`
30,255 B **plus a `chunks/` tree of hundreds of files**, which is why the single-file classic build
is the vendorable one) · https://mermaid.js.org/config/usage.html (`const { svg } = await
mermaid.render(id, def)`; `startOnLoad`; `securityLevel`) ·
https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/themes/theme-default.js
(default `fontFamily: '"trebuchet ms", verdana, arial, sans-serif'` — no Google Fonts import) ·
the Manrope/Google-Fonts claim as circulated: https://github.com/nesquena/hermes-webui/issues/1044
— **not reproduced against 11.17.2; the shipped bundle contains no such URL.**

**markdown-it** — https://registry.npmjs.org/markdown-it (15.0.1, MIT, published 2026-08-27) ·
https://unpkg.com/markdown-it@15.0.1/?meta (`dist/browser/markdown-it.esm.min.mjs` 137,975 B) ·
https://github.com/markdown-it/markdown-it/blob/master/CHANGELOG.md (v15.0.0 added the
`markdown-it/browser` export and moved the bundles under `dist/browser/`; the old
`dist/markdown-it.min.js` is the v14 layout) ·
https://github.com/markdown-it/markdown-it/blob/master/docs/safety.md ·
https://github.com/markdown-it/markdown-it/blob/master/src/markdownit.ts (`parse()` "until you write
custom renderer (for example, to produce AST)") · RTL declined in core:
https://github.com/markdown-it/markdown-it/issues/635 ·
https://github.com/markdown-it/markdown-it/issues/750 ·
https://registry.npmjs.org/markdown-it-bidi (0.2.0, **LGPL-3.0-or-later**).

**marked** — https://registry.npmjs.org/marked (18.0.11, MIT) ·
https://unpkg.com/marked@18.0.11/?meta (`lib/marked.esm.js` 43,800 B) ·
https://github.com/markedjs/marked/releases/tag/v16.0.0 (`marked.min.js` removed) ·
https://github.com/markedjs/marked#usage ("Marked does not sanitize the output HTML… use DOMPurify")
· https://marked.js.org/using_pro (`marked.lexer()`) ·
https://github.com/markedjs/marked/issues/2304 (bidi is an extension, not core).

**micromark** — https://registry.npmjs.org/micromark (4.0.2, MIT) ·
https://unpkg.com/micromark@4.0.2/?meta (no `dist/`, no bundle, 75 files) ·
https://github.com/micromark/micromark#readme (browser story is `https://esm.sh/micromark@3?bundle`).

**DOMPurify** — https://registry.npmjs.org/dompurify (3.4.14, `(MPL-2.0 OR Apache-2.0)`;
`dist/purify.min.js` 29,204 B). The copy inside mermaid's bundle is 3.4.12, per its own preserved
banner.

**Highlighters** — https://registry.npmjs.org/highlight.js (11.12.0, **BSD-3-Clause**) ·
`@highlightjs/cdn-assets@11.12.0`: `es/highlight.min.js` 129,152 B, `styles/github-dark.min.css`
1,315 B, 36 grammars, real ESM, `element.innerHTML = result.value` in `highlightElement` ·
https://registry.npmjs.org/prismjs (1.30.0, MIT, published 2025-03-10; `dist-tags` is
`{"latest":"1.30.0"}` only) · https://github.com/orgs/PrismJS/discussions/3531 (v2: no date, no
release, security PRs only) · https://registry.npmjs.org/shiki (4.4.3, MIT) ·
https://shiki.style/guide/bundles ("Full bundle 6.4 MB (minified), 1.2 MB (gzip)"; web bundle
"3.8 MB / 695 KB") · https://shiki.style/guide/regex-engines (JS engine avoids WASM; "strict by
default"; `forgiving` "can result in highlighting mismatches") ·
https://github.com/shikijs/shiki/issues/671 (inline-style CSP) ·
https://github.com/vercel/streamdown/issues/384 (the WASM CSP error verbatim) ·
https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src
(`'wasm-unsafe-eval'`) · https://registry.npmjs.org/lowlight (3.3.0, MIT, hast output).

**Docs systems and widgets** — https://registry.npmjs.org/docsify (5.0.0, MIT;
`dist/docsify.min.js` 185,377 B; `new Function(n)()` in `executeScript`, documented at
https://github.com/docsifyjs/docsify/blob/develop/docs/configuration.md#executescript) ·
https://unpkg.com/zero-md@3.1.8/src/lib/presets.js (hard-coded `cdn.jsdelivr.net`) ·
https://registry.npmjs.org/@docsearch/js (5.0.5; requires `appId`/`apiKey`) ·
https://unpkg.com/@mintlify/widget@0.0.164/README.md ("get an API key by visiting the Mintlify
dashboard"; `license: Elastic-2.0`) · https://unpkg.com/@gitbook/embed@0.5.1/README.md (script from
your GitBook site; **no `license` field**) · https://registry.npmjs.org/@readme/markdown (15.4.0,
~70 deps) · https://docusaurus.io/docs/installation ("we need to build the website into a directory
of static contents"; `npm run build` → `/build`) · https://vitepress.dev/guide/getting-started
(`"docs:build": "vitepress build docs"`).

**In this repository** — `src/ui/security.ts` (`SECURITY_HEADERS`; "THE CSP IS SUSPENDED,
DELIBERATELY"; `style-src-elem` / `style-src-attr` named as the shape a returning CSP would take) ·
`src/ui/public/screens/docs.js` (`FENCE`, line 302; `markdownNodes`, line 699; the `dv.mdnote`
contract in the file header) · `test/ui/docs-screen.test.ts` (the fake-document harness reused for
§2) · `src/ui/public/fonts/LICENSE-OFL.txt` and `src/ui/public/icons/LICENSE-MIT.txt` (the vendoring
precedent) · `package.json` (`files: ["src/", …]`, empty `dependencies`).

**Could not verify.** Whether `'unsafe-eval'` alone permits WebAssembly instantiation in current
Chrome — MDN says it does and overrides `'wasm-unsafe-eval'`, but the browser error text in
streamdown#384 names `'unsafe-eval'` as missing; the tension does not affect any recommendation
here, since no candidate we adopt uses WASM. Starlight and Nextra were not fetched individually;
they are rejected as Astro and Next.js site builds by inheritance from those toolchains' build
steps, which is a weaker claim than the one made for Docusaurus and VitePress and is flagged as
such. The residual ~14 points of `<pre>` after the fence-only fix in §2 were not diagnosed — the
experiment was run to test whether a cheap fix suffices, and it established that it does not.
