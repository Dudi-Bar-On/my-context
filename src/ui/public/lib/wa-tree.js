/**
 * `<wa-tree>` and `<wa-tree-item>`, behind one name of our own.
 *
 * **This file is OURS. Everything it imports is vendored and never edited.**
 * It exists for one reason: the two modules below are esbuild content-hashed
 * chunks — `chunk.T2SU5Q2S.js`, `chunk.SJBMXU7J.js` — and those names are an
 * output of Web Awesome's build, not a name anybody chose. They are stable
 * within a release and change WHOLESALE on upgrade. Importing them by hash from
 * a screen would scatter the hashes across the product and make an upgrade a
 * search-and-replace; importing them here makes an upgrade a two-line edit to
 * one file, in exactly the same place `scripts/vendor-webawesome.ts` re-derives
 * them.
 *
 * **Importing this module REGISTERS the two elements.** Each chunk ends in
 * Web Awesome's `customElement` decorator — `t("wa-tree")`, `t("wa-tree-item")`
 * — so evaluation calls `customElements.define` itself. Nothing here has to,
 * and nothing here should: defining them twice throws.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ──────────────────────────────────────────
 *
 * The DOCUMENTED entry points are `components/tree/tree.js` and
 * `components/tree-item/tree-item.js`, and they are not what is vendored. Each
 * is a barrel carrying ~45 side-effect imports that register every component
 * `wa-tree-item`'s template CAN render — `wa-icon`, `wa-spinner`,
 * `wa-checkbox`. One of them, `wa-icon`, does
 * `await fetch(url, { mode: "cors" })`, which `scripts/check-vendor.ts` refuses
 * and which this plugin's whole offline claim refuses. Taking the two component
 * classes instead is 26 files rather than 49 and 89,648 B rather than 206,017,
 * and it is not a trick to dodge the gate — it is declining three components
 * this product does not use.
 *
 * What that costs, so the next reader is not surprised by it:
 *
 *   - **No `wa-icon`.** The expand affordance's slot fallback renders a
 *     `<wa-icon>` that is now an undefined element: zero-sized, inert, and NOT
 *     a request. So a caller SLOTS ITS OWN chevron —
 *     `<svg slot="expand-icon">` / `<svg slot="collapse-icon">` on the
 *     `<wa-tree>` itself, which `WaTree.initTreeItem` clones onto every item.
 *     `tree-proof.html` is the worked example.
 *   - **No `wa-spinner`**, so `lazy` expansion has no built-in loading
 *     affordance; draw one.
 *   - **No `wa-checkbox`**, so `selection="multiple"` and `"leaf-multiple"` are
 *     not available. Single selection is what a file browser wants.
 *
 * Full working: `docs/superpowers/specs/2026-09-06-tree-component-evaluation.md`.
 */
export { WaTree } from './vendor/webawesome/chunks/chunk.T2SU5Q2S.js';
export { WaTreeItem, treeItemContext } from './vendor/webawesome/chunks/chunk.SJBMXU7J.js';
