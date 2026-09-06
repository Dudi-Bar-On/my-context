# Choosing the external tree component for `library/2`

**Date** 2026-09-06 · **Status** research, no product code written · **Item**
`TASK-the-library-browses-the-corpus-files-and-a-file-opens` (`library/2`) ·
**Ruling that permits this** `DEC-an-external-documentation-tool-may-be-embedded-and-it-may`

The owner has ruled that the file tree is an external component and that the best one is to be
chosen. This document names it, prices it, says what it does not solve, and gives the vendoring
plan. Nothing here was installed; `package.json` is untouched. Every candidate was fetched from
its own registry or repository into a scratch directory and measured, and the recommended one was
driven in a real browser before being recommended.

**Recommendation: `<wa-tree>` / `<wa-tree-item>` from Web Awesome 3.12.0 (`@awesome.me/webawesome`,
MIT, released 2026-08-21), vendored as 26 files / 89,648 B under
`src/ui/public/lib/vendor/webawesome/chunks/`.** It is the only candidate that clears all ten
bars. It also costs a change to `scripts/check-vendor.ts`, and that change is the single most
important thing on this page.

---

## 1. The bar, restated as the ten questions each candidate was asked

These come from the dispatch and from the corpus, not from taste.

| # | Rule | Source |
|---|---|---|
| 1 | No build step — no webpack/rollup/JSX | `CONST-node-24-no-build-step` |
| 2 | Vendorable and offline; served under `src/ui/public/`, extension in `static.ts`'s five | `src/ui/public/lib/vendor/VENDOR.md`, `src/ui/static.ts` |
| 3 | No transitive UI dependency — no Bootstrap, Font Awesome, jQuery, CSS framework | dispatch; product has its own design system |
| 4 | Genuinely nested markup, not a flattened row list | owner, 2026-09-06, recorded in `library/2` |
| 5 | Drill down and back up, not only expand-in-place | owner, same day |
| 6 | `role="tree"`/`group`/`treeitem`, `aria-expanded`, real keyboard navigation | `library/2`; the button-inside-a-button defect already paid for |
| 7 | Correct under `dir="rtl"` | the Hebrew console is a first-class surface |
| 8 | Dark only — no light theme to fight | `DEC-an-external-documentation-tool…` states it |
| 9 | ~1,000 item files across 15 category folders | `library/2`; coverage's 1,245 nodes / 29 visible |
| 10 | Licence compatible with shipping inside an MIT plugin | repo `LICENSE`: MIT, © 2026 Dudi Bar-On |

Two of these are enforced mechanically today and are worth spelling out, because they decided the
outcome:

- **`src/ui/static.ts` serves five extensions** — `.html`, `.js`, `.css`, `.svg`, `.woff2`
  (`CONTENT_TYPES`, `src/ui/static.ts:103`). `.mjs` is not among them, which is why
  `markdown-it.esm.min.mjs` is committed as `.js`.
- **`scripts/check-vendor.ts` refuses a vendored file that contains any of**
  `fetch(`, `XMLHttpRequest`, `new Worker`, `importScripts`, `eval(`, `new Function`,
  `WebAssembly` (`FORBIDDEN`, `scripts/check-vendor.ts:66`) **or an `import` statement at all**
  (`/(^|[;\s(])import\s*[({'"[]/`). It also reads the vendor directory **flat**
  (`vendorFiles()` uses a single non-recursive `readdirSync`), so nothing in a subdirectory is
  pinned or audited today.

Rule 2 is therefore not one test but three: extension, no network reach, and a gate that as
written admits only a single self-contained file.

---

## 2. Comparison

Sizes are raw bytes of what would actually be vendored, measured on the fetched artefact — not a
figure from a README.

| Candidate | Nested markup? | Build step? | Offline / vendorable | Transitive deps | a11y | RTL | Dark | Scale | Size to vendor | Licence | Last release | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Web Awesome `<wa-tree>`** 3.12.0 | **Yes** — nested `wa-tree-item`, `role="group"` in shadow | **No** — ES modules, relative `./chunk.*.js`, loads from `<script type="module">` | **Yes** — `.js` only; 0 off-origin requests measured | **None** — 0 bare specifiers in the vendored closure | `role=tree/treeitem/group`, `aria-expanded`, `aria-selected`, `aria-multiselectable`; ↑↓←→ Home End Enter Space | **Yes** — logical properties only; chevron flips on `localize.dir()`; ←/→ swap verified | **Yes** — 0 hard-coded colours, 0 `prefers-color-scheme`; 10 `--wa-*` tokens are the whole palette surface | No virtualisation. 1,020 items = 1,106 DOM nodes, upgraded in 156 ms; collapsed 15 rows, expanded-all 28,672 px | **89,648 B** (26 files) + 1,059 B licence | **MIT**, © 2025 Fonticons | **2026-08-21** | **ADOPT** |
| Shoelace `<sl-tree>` 2.20.1 | Yes — same lineage | No | **Fails** — its closure contains `sl-icon`, which calls `await fetch(url, {mode:"cors"})` | None bare, but pulls the icon component | Same ARIA vocabulary | Yes | Yes | Same, no virtualisation | 121,047 B (37 files) | MIT | 2025-03-11 | **Reject — superseded.** shoelace.style: *"Shoelace Is Sunset with no active development"*, *"Use Web Awesome for ongoing work."* Also fails rule 2's `fetch(` gate |
| simple-treeview / `VanillaTreeView` 0.0.9 | **No** — flat sibling `<div>`s in one root, `paddingLeft = ${level}em`, collapse = delete following siblings | No | Yes | Font Awesome for icons (`fa-folder`); the shipped example loads FA from a CDN | **None** — 0 occurrences of `role`, `aria-`, `tabindex` or `keydown` in `dist/treeview.vanilla.js`; nodes are `<div>`/`<label>`, not focusable | **No** — `padding-left`, `margin-right`, physical | No — light `rgba(32,64,128,…)` rows baked in | Lazy provider, but the row list it builds is the shape already rejected | 7,211 B + 1,087 B CSS | MIT | **2021-08-18** (v0.0.9, 5 years stale) | **Reject — rules 3, 4, 6, 7, 8** |
| "Plain Tree" | — | — | **Cannot be obtained.** cssscript's page links `github.com/metadream/plain-tree`; that URL returns **404** (both the API and the HTML page). The GitHub search for `plain-tree in:name` returns `lukeaus/plain-tree`, a tree **data-structure** library, not a view | — | — | — | — | — | — | (page says MIT) | repo gone | **Reject — rule 2.** Not vendorable: there is no source to pin. The "needs Bootstrap and Font Awesome" report in the dispatch is a conflation with **bs-treeview**, a different library, which *does* require both |
| Syncfusion EJ2 TreeView (`@syncfusion/ej2-navigations` 34.2.6) | Yes | Yes (7 sibling `@syncfusion/*` packages) | No | 7 Syncfusion packages | Good | Yes | Themed | Virtualises | — | **Commercial.** Its own `license` file: *"can be licensed either under the Syncfusion Community License Program or the Syncfusion commercial license… Under no circumstances can you use this product without (1) either a Community License or a commercial license"* | 2026-09-01 | **Reject by name — rule 10** |
| DHTMLX Tree | Yes | Yes | No | DHTMLX suite | Good | Yes | Themed | Virtualises | — | **Commercial**: $249–$2,239/year; the free edition is **GPL v2**, copyleft, incompatible with shipping inside an MIT plugin | current | **Reject by name — rule 10** |
| jstree 3.3.17 | Yes (`ul`/`li`) | No | Yes | **jQuery** (declared dependency) | Good | Partial | Themed light | Fine | — | MIT | 2024-09-10 | **Reject — rule 3** |
| Carbon `cds-tree-view` (`@carbon/web-components` 2.62.0) | Yes | Bundler expected; 4,808 files / 23.4 MB unpacked | No | `lit`, `@carbon/styles`, `@carbon/icons`, `flatpickr`, `lodash-es`, `@floating-ui/dom`, `@ibm/telemetry-js` | Good | Yes | Carbon themes | Fine | — | Apache-2.0 | 2026-08-27 | **Reject — rule 3.** `@carbon/styles` is a CSS framework and `@ibm/telemetry-js` is a telemetry package |
| SAP `ui5-tree` (`@ui5/webcomponents` 2.26.0) | Yes | No, but 2,629 files / 22.7 MB and a theming/i18n asset layer that loads at runtime | Poor | 6 `@ui5/*` packages incl. icons, theming, localization | Good | Yes | UI5 themes | Fine | — | Apache-2.0 | 2026-08-26 | **Reject — rules 2, 3** |
| `@zag-js/tree-view` 1.43.3 | You write the markup | Needs a bundler — 6 bare-specifier `@zag-js/*` deps | No | 6 packages | Excellent (state machine) | Yes | Unstyled | Yours | — | MIT | 2026-08-20 | **Reject — rule 1.** Headless: this is "build one" with an a11y machine attached, which is the answer already rejected |
| `@mui/x-tree-view`, `react-accessible-treeview` | Yes | **React + JSX** | No | React | Excellent | Yes | Themed | Virtualises (MUI) | — | MIT | 2026-09-04 / 2025-06-27 | **Reject — rule 1** |
| W3C APG treeview-1a reference | **Yes** — nested `ul[role=group]`/`li[role=treeitem]` | No | Yes | **None** | Excellent — the pattern's own reference; ↑↓←→ Home End Enter Space, type-ahead, `*` | **No** — `tree.css` uses `padding-left` three times | **No** — `#eee`, `#ddd`, `#333`, `#005a9c` hard-coded light | Renders all nodes | 14,077 B (4 files) | W3C Software and Document License (permissive) | maintained in w3c/aria-practices | **Reject as a component — rules 7, 8, and the vendor contract.** Ships as globals (`var Tree` / `var Treeitem`, 0 `export` statements), enhances pre-existing markup rather than taking data, and both defects are only fixable by editing it — which is exactly what `VENDOR.md` says a vendored file never gets. It is a **pattern to check our keyboard behaviour against**, not a dependency |

Also looked at and not tabled because they fail on sight: `bs-treeview` (Bootstrap + Font Awesome,
rule 3), `patternfly-bootstrap-treeview` (2019, Bootstrap), `@widgetjs/tree` (last release
2019-11-13), `treeflex` (2018, CSS-only, no interaction), Kendo TreeView (commercial), `vue3-treeview`
and `ngx-treeview` (framework, rule 1).

---

## 3. The recommendation, and its reasoning

**Vendor Web Awesome's `<wa-tree>` and `<wa-tree-item>`.**

**Why it, and not Shoelace.** The dispatch named Shoelace as the strongest starting point, and it
was — Web Awesome is Shoelace, renamed and continued by Fonticons. Shoelace's own home page now
says *"Shoelace Is Sunset with no active development"* and *"Use Web Awesome for ongoing work,
issues, and features."* Its last release is 2.20.1 on 2025-03-11, eighteen months ago; Web Awesome
3.12.0 shipped on 2026-08-21. Adopting the sunset one would be adopting the maintenance burden the
dispatch warns about. There is also a hard technical difference: Shoelace's tree closure includes
`sl-icon`, whose `icon.component.ts` does `await fetch(url, { mode: "cors" })` — a string
`scripts/check-vendor.ts` refuses outright.

**Why it clears rule 4, structurally rather than visually.** `wa-tree-item`'s `connectedCallback`
does `this.setAttribute("slot", "children")` on a nested item, and its template renders
`<div class="children" part="children" role="group"><slot name="children"></slot></div>`. A child
item is a DOM child of its parent item. A collapsed folder hides its subtree **by containment**, so
the `.tree .row[hidden]{display:none}` specificity defect recorded in `library/2` cannot be written
here — there is nothing to hide by hand.

**Why it clears rule 6.** Measured in Chromium, not read off a README: `<wa-tree>` carries
`role="tree"`, every item carries `role="treeitem"`, folders carry `aria-expanded="false"`, items
carry `aria-selected="false"`, and the tree sets `aria-multiselectable`. The keyboard set in the
compiled source is `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Home`, `End`, `Enter`,
`Space` — the APG set. There is no button inside a button: the expand affordance is a
`part="expand-button"` region inside the item, and the item itself is the `treeitem`.

**Why it clears rule 7 in a way nothing else did.** The tree's own CSS uses only logical
properties — `margin-inline-end`, `border-inline-start`, `border-inline-end`, `inset-inline-start`
— and the chevron direction is computed from `this.localize.dir() === "rtl"`. Driven under
`dir="rtl"`: the tree mirrors, and **ArrowRight stops expanding while ArrowLeft starts** — which is
the correct APG behaviour under RTL, and is the kind of thing a hand-built tree gets wrong.

**Why it clears rule 8 with nothing to fight.** The vendored closure contains **zero** hard-coded
colours (no hex, no `rgb()`, no `hsl()`, no `white`/`black`) and **zero** `prefers-color-scheme`
queries. Its entire visual surface is ten custom properties:

```
--wa-color-brand-fill-loud   --wa-color-neutral-fill-quiet  --wa-color-surface-border
--wa-color-text-normal       --wa-color-text-quiet          --wa-focus-ring
--wa-focus-ring-offset       --wa-form-control-value-line-height
--wa-transition-easing       --wa-transition-normal
```

Web Awesome defines these in `dist/styles/themes/default.css` (16,773 B). **We do not vendor that
file.** `styles.css` defines the ten from the console's own palette, and the tree wears the
five-hue verdict palette natively. There is no light theme to override because there is no theme
at all — this is the opposite of the `github-markdown-css` situation, where a whole appearance was
adopted deliberately.

---

## 4. What it costs

### Bytes

| | Bytes |
|---|---|
| 26 vendored `.js` files | **89,648** |
| `LICENSE-webawesome.txt` | 1,059 |
| **Added to `src/ui/public/`** | **90,707** |
| `src/ui/public/` today (67 files) | 3,456,918 |
| After | 3,547,625 — **+2.62 %** |

For scale, the same directory already carries 137,975 B of `markdown-it`, 644 KB of pre-rendered
diagrams and 404 KB of `.woff2` faces. Vendoring mermaid was priced at 3,572,661 B and rejected;
this is 2.5 % of that.

### The change to `scripts/check-vendor.ts` — the real price

**This is the trade-off to weigh, not the bytes.** `auditVendor()` as written cannot accept this
component, for two independent reasons, and both are correct behaviour for a single-file asset:

1. **`vendorFiles()` is flat.** One non-recursive `readdirSync`, so files under
   `vendor/webawesome/chunks/` would be neither pinned nor scanned — silently unaudited, which is
   worse than rejected.
2. **Any `import` statement is a problem** — `"${pin.file} carries an import statement — it is no
   longer a single file"`. Every one of the 26 files is an ES module importing its siblings by
   relative path. The message is right about a lone `markdown-it.esm.min.js`; it is wrong about a
   module graph committed whole.

The gate must be widened to: *walk subdirectories; allow a **relative** `import`/`export … from`
whose resolved target is itself a pinned file in this directory; still refuse a bare specifier, a
dynamic `import()` of anything not pinned, and every string in `FORBIDDEN`.* That last clause needs
no relaxing at all — **the 26 files contain none of the seven forbidden constructs**, which is
precisely why this closure was chosen over the barrel-entry one (§5).

Widening a security gate to admit a dependency is exactly the shape of change that should be a
ruling rather than a commit. It is the one thing here that is not free.

### The other costs, stated plainly

- **Shadow DOM.** The `.tree` vocabulary in `styles.css` — `.tree button`, `[aria-selected]`,
  `[data-depth]` — does not reach inside `wa-tree-item`. Styling goes through the ten tokens and
  `::part(item)`, `::part(label)`, `::part(expand-button)`, `::part(indentation)`. The existing
  `.tree` rules stay where they are for the coverage screen and are not reused here.
- **Opaque filenames.** The 26 files are esbuild content-hashed chunks. They are stable within a
  release and change wholesale on upgrade. §5 makes the file set *derived* rather than guessed, and
  hides the hashes behind one shim of our own authorship.
- **A second element vocabulary in the console.** `wa-tree` is the first custom element in this
  product. It brings Lit's runtime (about 27 KB of the 89 KB) with it.
- **`innerHTML` appears once**, in Lit's template compiler, setting a detached `<template>`'s
  content from the component's own static tagged-template strings. It is not in `FORBIDDEN` and it
  is not attacker-reachable — corpus paths reach the DOM through text bindings. Recording it so it
  is not discovered later and mistaken for a hole.

---

## 5. The vendoring plan

### 5.1 Exactly which files, and why not the obvious ones

Web Awesome publishes two builds. `dist/` uses bare specifiers (`lit`, `@lit/context`, `nanoid`)
and needs a resolver — **out on rule 1**. `dist-cdn/` is fully self-resolving with relative
`./chunk.*.js` imports — **this is the one**. Within it there are two candidate entry points, and
the difference decides whether the product passes its own gate:

| Entry | Files | Bytes | `FORBIDDEN` hits |
|---|---|---|---|
| `components/tree/tree.js` + `components/tree-item/tree-item.js` (the documented barrels) | 49 | 206,017 | **`fetch(`** in `chunks/chunk.WSTNGCWW.js` |
| `chunks/chunk.T2SU5Q2S.js` (`WaTree`) + `chunks/chunk.SJBMXU7J.js` (`WaTreeItem`) | **26** | **89,648** | **none** |

The barrels carry side-effect imports for every component `wa-tree-item`'s template *can* render —
`wa-icon`, `wa-spinner`, `wa-checkbox` — and `wa-icon` is where the `fetch(` lives. The two chunks
are the component classes and their transitive closure, and they self-register:
`customElements.define` appears twice in the set. **Taking the smaller closure is not a trick to
dodge the gate; it is declining three components we do not use**, and the three things we give up
are named in §6.

The 26 files land at `src/ui/public/lib/vendor/webawesome/chunks/`, unmodified, each `.js` — no
rename is needed, unlike `markdown-it.esm.min.mjs`, because `.js` is already in `static.ts`'s
allow-list. `LICENSE-webawesome.txt` sits beside them, the byte-identical `LICENSE.md` the package
publishes (1,059 B, MIT, © 2025 Fonticons, Inc.).

One file of **our** authorship, outside `vendor/`, hides the hashes and is the single place an
upgrade edits:

```js
// src/ui/public/lib/wa-tree.js  — ours, not vendored
export { default as WaTree }     from './vendor/webawesome/chunks/chunk.T2SU5Q2S.js';
export { default as WaTreeItem } from './vendor/webawesome/chunks/chunk.SJBMXU7J.js';
```

### 5.2 How it is pinned

`VENDOR.md` gains a section and 26 rows in the existing table format, which `readPins()` already
parses — `| file | package | version | bytes | sha256 |`. The `file` column becomes a
directory-relative path (`webawesome/chunks/chunk.T2SU5Q2S.js`), which is the change that makes the
recursive walk necessary. The digests, measured today from the published tarball:

| File | Bytes | SHA-256 |
|---|---|---|
| `chunks/chunk.26QE47KB.js` | 280 | `ef6d98607a460410f76421b90e20b86158104003d5bb17254b795bff1bed8560` |
| `chunks/chunk.4QWUDRS5.js` | 526 | `d4581daa488e6862b08203e42c26be2c08538303b39ccd2f32eaeeba14e3c9aa` |
| `chunks/chunk.AG44H7MD.js` | 300 | `6deaa6b3b1ef89bd1d3ab01a4da76019cfe41edd9c7d0cdcc6bb3c39d408d7a3` |
| `chunks/chunk.BKE5EYM3.js` | 10,602 | `93fc32cb9e779758bb24608542d3a5e594ccfbf399a07552c43e0dcdfa8286a1` |
| `chunks/chunk.E2G7AAZ3.js` | 5,408 | `8fe72ff12a115007503dcd3f6fcaea7874a6c8d61a70d3df1d3c008f515f6e9c` |
| `chunks/chunk.EFUXUR2V.js` | 762 | `a3b72d9813af6ee868bfa64ebc52f49c30560af93d86a10f714e155950d2a1fe` |
| `chunks/chunk.FNFKITIN.js` | 587 | `05bd601319c91f3671b34a8fee0bf6aebbb3da6b3c586b3cd0b33a75209bbf17` |
| `chunks/chunk.FYKN76UA.js` | 270 | `27d239411e4f90e13223b66b2bd505dc044eb2174ac925a031e47fafd449d202` |
| `chunks/chunk.H23DVATU.js` | 735 | `36555f905166b76be1f6c93e6a910ac4f446f764dae934581ac4ffd42c8b5b49` |
| `chunks/chunk.HOKYDFUG.js` | 4,113 | `ae04ea6e19a128ae93e15848dfafaf2a642ed69e337d483700b31f576177844e` |
| `chunks/chunk.J7EXAHCE.js` | 3,598 | `0230f5cc476ffd7dbc4b7d67a37df98516b994816b29f898408b40609da265ee` |
| `chunks/chunk.JHZRD2LV.js` | 3,116 | `35c27c488c8f96d942576c8835f6cd8f167857b0a48e5f290445a0a653a0d60b` |
| `chunks/chunk.K5EDTD7G.js` | 1,184 | `4cf5a79d7ae1efae5da3ec7438d60bff9746c3af1e71128b91cac3f1eaba0898` |
| `chunks/chunk.KWDPKKFO.js` | 1,401 | `f9b96c80ce837583334dfbd0cbe4eb85fd151ddf28590d807bb84967c14a29c2` |
| `chunks/chunk.L6CIKOFQ.js` | 1,464 | `1e426869dee8e765fc800dad41835a4e60b2b8a2b674740b9535138f95598e6a` |
| `chunks/chunk.LBLI4KS5.js` | 10,475 | `3ad5b0014413b8fcaa810e6df13e6b3ab92a4bbe1d918c115c66dae32569b24e` |
| `chunks/chunk.LCFSCRUJ.js` | 340 | `6b77f5df8389a522074d7e167284d6481e4ee5e75fc69cf777d47a5edbbc4157` |
| `chunks/chunk.O6IZ4I7T.js` | 800 | `fb07b6548d880ab1c0d494c16994c19745a4e93b5ab49d4fd2738994c0433330` |
| `chunks/chunk.PZAN6FPN.js` | 917 | `50842247fdfad90b803024780aadba164feb4f944a55a5f485153493e67379a9` |
| `chunks/chunk.Q6XMGFWJ.js` | 292 | `da8457dd69d2455f022fa9fec5e3c5a04e626a9a75a2fb5c5dc4385ad72acb86` |
| `chunks/chunk.SJBMXU7J.js` | 17,602 | `39355595d386ed97fa848afe5eaad9c367af15a53cc1a6b22ea274f55d33d3f6` |
| `chunks/chunk.T2SU5Q2S.js` | 11,782 | `8c680baafc94e973f89ecd1fa2b8e4b770b8f367385ee877d244652c4a604c13` |
| `chunks/chunk.TLFIX76K.js` | 12,167 | `81f83a97c009f390a5360951af4bbdac15468008ac3ca791fa81393668571d8a` |
| `chunks/chunk.U36KZLSQ.js` | 278 | `f379eb8e673a0caafb695ac399943c905116f467f0e024d713ecebf0392d5426` |
| `chunks/chunk.YXOWVBUA.js` | 361 | `3b36128b36760bb3941a7a7e9b0a77b0448017898a687971b3a0182235a4bbe8` |
| `chunks/chunk.ZSEFTQAO.js` | 288 | `b36dcde53a8e3b78195de0e1cee954c66c906e3137013f9372ddcc4f7f28530c` |

The **tarball** is pinned too, so "which chunks" is reproducible rather than folklore:

```
https://registry.npmjs.org/@awesome.me/webawesome/-/webawesome-3.12.0.tgz
  2,484,536 B   sha256 8fb34b5d18c0161bf934d264d39dae649aabd8f4e31135e9cd8bfbae5fa3078d
```

### 5.3 How it is re-fetched — a script, not a `curl` line

`markdown-it` is one file, so `VENDOR.md` re-fetches it with `curl`. Twenty-six content-hashed
chunks cannot be. A small `scripts/vendor-webawesome.ts` (dev-time, never shipped, the same
category as `scripts/gen-diagrams.ts`) does it deterministically:

1. Fetch the tarball; refuse unless its SHA-256 matches the pin above.
2. Read `dist-cdn/components/tree/tree.js` and `…/tree-item/tree-item.js`, and take the **one**
   chunk each names in its `import { WaTree } from "…"` / `import { WaTreeItem } from "…"` line.
   This is the stable rule; the hashes are its output, not its input.
3. Walk the transitive closure of relative `import`/`export … from`/`import()` specifiers from
   those two. Abort on any bare specifier or missing file.
4. Copy the closure verbatim into `src/ui/public/lib/vendor/webawesome/chunks/`, copy `LICENSE.md`
   to `LICENSE-webawesome.txt`, and print the pin table for `VENDOR.md`.
5. Run `npm run check:vendor`.

An upgrade is then the deliberate act `VENDOR.md` already demands: new tarball digest, new file
set, new rows, tests re-run.

### 5.4 How `check-vendor.ts` gates it

After the widening in §4:

- **Digest and byte count** per pinned file — unchanged, and it now covers a subtree.
- **Every file present is pinned, and every pin is present** — unchanged, and it is what stops a
  chunk being dropped or an extra one appearing after an upgrade.
- **`FORBIDDEN`** — unchanged, and it passes today: `fetch(`, `XMLHttpRequest`, `new Worker`,
  `importScripts`, `eval(`, `new Function`, `WebAssembly` are all **zero** across the 26 files.
- **Imports** — a relative specifier resolving to another pinned file is allowed and its resolution
  is *asserted*; a bare specifier is a failure (measured: **zero** bare specifiers). This is
  strictly stronger than today's rule for a graph: it proves the graph is closed.
- **Reach**, measured the way `VENDOR.md` measures `markdown-it`: `grep -c 'https\?://'` over the
  26 files returns **28**, from exactly **two** distinct strings, both read rather than counted —
  `https://webawesome.com/license` in each file's copyright banner, and
  `` `https://webawesome.com/docs/components/${this.localName.replace(…)}` `` inside a console
  warning message. Neither is a request. Also measured across the set: **0** `@import`, **0**
  `url(`, **0** `sendBeacon`, **0** `EventSource`, **0** `WebSocket`, **0** `localStorage`,
  **0** `document.write`, **0** `import.meta`.

### 5.5 How someone proves offline operation

Three ways, in increasing strength — the first two are static and belong in `check:vendor`, the
third is the one that actually settles it.

1. `npm run check:vendor` — the reach scan above.
2. A unit test beside `test/ui/fonts.test.ts` asserting the 26 files are served by
   `serveStatic()` (i.e. every one ends `.js` and resolves inside `public/`).
3. **The e2e run.** `e2e/` already fails if a screen makes any request that leaves the loopback
   origin; the Library screen becomes a case in it. This was rehearsed before recommending: the
   26 files plus a page were served from a throwaway static server on 127.0.0.1:58991 and driven
   with the repo's own Playwright. **Off-origin requests: 0**, in `dir="ltr"` and `dir="rtl"`.
   Total requests: 27 — one document and 26 modules. Page errors: 0.

---

## 6. What it does NOT solve

Stated plainly, because each of these is work that remains ours.

1. **It does not drill down.** `wa-tree` expands in place. Nothing in it re-roots, and there is no
   breadcrumb. Rule 5 is built around the component — §7.
2. **It does not virtualise.** No occurrence of "virtual" anywhere in the tree source. Every node
   is a real element. Measured with the corpus's own shape — 15 folders × 67 files = 1,005 files,
   1,020 items:

   | | Visible rows | Page height | DOM nodes |
   |---|---|---|---|
   | Collapsed (default) | 15 | fits the viewport | 1,106 |
   | All 15 folders expanded | 1,020 | **28,672 px** | 1,106 |

   Upgrade to `role="tree"` took 156 ms from navigation start. **Collapsed-by-default is
   load-bearing**, exactly as it was when coverage's tree was rebuilt from 1,245 rows to 29, and
   exactly as the 942-option `<select>` that opened a page to 3,962 px yesterday shows. Better
   still, `wa-tree-item`'s `lazy` attribute fires `wa-lazy-load` on first expand — build the
   fifteen folder nodes and let each fetch its own children, and the 1,005 leaves never exist until
   asked for. That is the recommended usage and it makes the 28,672 px figure unreachable in
   practice.
3. **It does not build the tree from a file list.** `buildTree(files)` in
   `src/ui/public/lib/viewmodel.js` still does that and is still the half to keep; `treeRows()` is
   still the half to leave behind. What changes is only the rendering: walk the nested structure
   `buildTree` already returns and emit nested `wa-tree-item`s instead of flattening it. The
   `governs` / `governedCount` fields coverage puts on each node are simply not read.
4. **It does not answer the `isServableDocPath` question**, and that question still blocks the
   whole item. `src/doctor/checks.ts` admits `README.md`, `docs/**.md` and `reports/**.md` and
   refuses `.my_context/items/**` — the opposite of what
   `REQ-a-repository-document-is-viewable-in-the-ui-only-once-it-is` (severity HARD) says. No
   component fixes that. It is a ruling, it is the second time it has been found, and choosing a
   tree does not make it smaller.
5. **It gives up three of its own components** by taking the 26-file closure: `wa-spinner` (the
   built-in loading affordance during `lazy` expansion — we draw our own), `wa-checkbox` (the
   `selection="multiple"` / `"leaf-multiple"` modes — unused; single selection is what a file
   browser wants), and `wa-icon` (we slot our own inline `<svg>`, which is what keeps `fetch(` out
   of the vendor directory). If any of those three is later wanted, the file set grows to 49 files
   / 206,017 B and `FORBIDDEN` has to be argued with. Worth knowing before, not after.
6. **The slotted chevron does not mirror itself.** `wa-icon` flips its own chevron on
   `localize.dir()`; a plain slotted `<svg>` does not. One CSS rule
   (`[dir="rtl"] .chev { transform: scaleX(-1) }`) or two path variants closes it. Seen in the RTL
   screenshot, so recorded rather than left to be found.
7. **Folder labels need bidi isolation.** `adr/` rendered as `/adr` under `dir="rtl"` in the
   rehearsal — a Unicode bidi effect on the trailing slash, not a component defect. Wrap a path
   segment in `<bdi>`.

---

## 7. How drill-down and back-up are achieved

**By the component for the "expand" half; built around it for the "descend" half.** The component
makes this cheap because it already separates the two affordances — from `WaTree.handleClick`:

```js
const isExpandButton = event.composedPath().some(el => el?.classList?.contains("expand-button"));
if (isExpandButton) { treeItem.expanded = !treeItem.expanded; }
else                { this.selectItem(treeItem); }
```

So the answer to the question `library/2` says must be decided and written down — *what does a
click on a folder do, because it cannot silently do both* — is given by the component's own
structure rather than invented:

- **The chevron expands in place.** Keyboard equivalent: `ArrowRight` (`ArrowLeft` under RTL), which
  is the ARIA pattern and comes free.
- **The label descends.** It raises `wa-selection-change`; the screen reads the selected item, and
  if it is a folder, re-renders `<wa-tree>` rooted at that node and pushes the segment onto a
  breadcrumb. If it is a file, it opens `/doc.html` in its own tab — the half that is already
  shipped.
- **Going back up is the breadcrumb**, and it follows the precedent `library/2` points at rather
  than inventing a shape: `/doc.html` already draws a breadcrumb of the document path and a "Back
  to the console" row. A folder path is the same shape of thing and reads the same way. Each
  crumb re-roots the tree at that ancestor; the first crumb is the corpus root.

Re-rooting is a re-render of nested `wa-tree-item`s from the same `buildTree` output, so the two
requirements compose instead of competing: **nesting is how the structure is expressed, drill-down
is how a reader moves through it.**

---

## 8. If the `check-vendor.ts` change is refused

That is a legitimate ruling, and it should be made knowingly, so: **if the gate may not be widened,
nothing clears the bar.** Every component that renders genuinely nested, accessible, RTL-correct,
theme-neutral markup without a build step is a module graph, and a module graph cannot be pinned by
a checker that reads one flat directory and rejects the word `import`. The remaining options would
then be the W3C APG reference implementation copied and adapted — which is building one, with
better keyboard code — and that is the answer the owner already rejected, correctly.

---

## Sources

Every claim above was taken from one of these, and each was fetched or executed on 2026-09-06.

**In this repo** — `src/ui/public/lib/vendor/VENDOR.md`; `scripts/check-vendor.ts`;
`src/ui/static.ts`; `src/ui/public/screens/coverage.js`; `src/ui/public/lib/viewmodel.js`;
`LICENSE`; `package.json`; `.my_context/items/decision/DEC-an-external-documentation-tool-may-be-embedded-and-it-may.md`;
`.my_context/items/task/…the-library-browses-the-corpus-files…`.

**Registries and packages** (npm registry metadata; tarballs unpacked and measured locally) —
`@awesome.me/webawesome` 3.12.0, `@shoelace-style/shoelace` 2.20.1, `simple-treeview` 0.0.9,
`@syncfusion/ej2-navigations` 34.2.6 (its `license` file quoted), `@carbon/web-components` 2.62.0,
`@ui5/webcomponents` 2.26.0, `@zag-js/tree-view` 1.43.3, `jstree` 3.3.17, `@mui/x-tree-view` 9.13.0,
`react-accessible-treeview` 2.11.2.

**Web** — https://shoelace.style/ (sunset notice) · https://webawesome.com/docs/components/tree/ ·
https://dhtmlx.com/docs/products/dhtmlxTree/ (pricing and GPL v2) ·
https://www.w3.org/WAI/ARIA/apg/patterns/treeview/examples/treeview-1a/ and its
`tree.js` / `treeitem.js` / `treeitemClick.js` / `tree.css`
· https://www.cssscript.com/best-tree-view/ · https://www.cssscript.com/hierarchical-data-plain-tree/
(links `github.com/metadream/plain-tree`, which returns 404) ·
https://github.com/petrbroz/simple-treeview.

**Executed** — `@playwright/test` 1.62.1 from this repo's `node_modules`, driving Chromium against
the 26 candidate files served from a throwaway static server on 127.0.0.1:58991. The server on
58888 was not touched; it answered 200 before and after.
