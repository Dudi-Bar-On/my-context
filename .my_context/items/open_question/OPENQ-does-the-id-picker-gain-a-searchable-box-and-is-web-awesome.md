---
id: OPENQ-does-the-id-picker-gain-a-searchable-box-and-is-web-awesome
type: open_question
title: does the id picker gain a searchable box, and is web awesome's select even the thing that would do it
status: active
severity: soft
always: false
summary: "The long-domain ruling D11 held: four options costed, and the vendored one measured out on capability rather than on cost."
summary_of: fa238f32f3264b72
scope:
  - src/ui/public/screens/palette.js
  - src/ui/public/lib/palette-defs.js
  - src/ui/public/lib/vendor/**
tags:
  - v2
  - ui
  - composer
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 8f1f3aa20c16f0e9
---

# does the id picker gain a searchable box, and is web awesome's select even the thing that would do it

Split out of builder/10 (D11) on 2026-09-06, which built the three fields it names and could
not answer this. The item asks: does the builder keep a plain `<select>` for a long domain, or
gain a searchable combobox? Four options were investigated and costed. The choice is the
owner's because one of them widens what this repository vendors.

WHAT IS ACTUALLY LONG, RE-MEASURED. The item says the `id` picker builds 938 `<option>`
elements. Measured live 2026-09-06 against this corpus: `/api/items` answers 950 items, so the
picker builds 951 options counting the blank, and it rebuilds them on every command switch.
The architecture review measured 935 on 2026-09-04 and the item 938 the same week — the number
moves because the corpus does, which is the argument for the mechanism and not against it.

AND WHAT IS NOT LONG. The item groups `finding` with the long domains and it is the opposite.
`ack <id> <code>` refuses a code doctor does not report on THAT item (`cli/commands/ack.ts`:
`if (!clear && !reported.includes(code))`), so `finding`'s honest list is per item: measured
here, 61 findings, 5 of them notes about a check rather than findings, 56 on an item, across 55
distinct items, 1-2 codes each. `pack` is 0 on this corpus and 1 on the fixture. So the long
domain is `id` alone, and it is `id` this question is about.

THE FOUR OPTIONS.

A. KEEP THE PLAIN `<select>`. Costs nothing, changes nothing, and keeps the case the item says
   a select serves worst: a reader who does not already know the answer cannot search 950
   options, only scroll them. Keyboard and RTL are free and correct. The 260px cap in
   styles.css already stops the width defect. This is the status quo and it is not absurd.

B. HAND-WRITE A COMBOBOX. No dependency, no build step — so `div[role="combobox"]` +
   `role="listbox"`, `aria-activedescendant`, `aria-expanded`, arrow/Home/End/PageUp/PageDown,
   type-ahead, Escape, click-outside, a popup positioned correctly under `dir="rtl"`, and a
   virtualised list if it is not to build 950 nodes anyway. Every one of those is a thing a
   `<select>` gives for free and this owes. Roughly 200-300 lines of browser JS plus CSS, in a
   file this project has no browser-side test runner for — `test/ui/palette-screen.test.ts`
   states in its own header that DOM rendering there has no test — so it would be held only by
   Playwright.

C. VENDOR WEB AWESOME'S SELECT. The brief raised this as newly credible after `4a8a800`, and
   the gate is indeed no longer the obstacle: `scripts/check-vendor.ts` already walks
   subdirectories and admits relative imports that resolve to pinned files, so a second closure
   needs NO further gate change — only new rows in VENDOR.md. Measured 2026-09-06 by running
   the repository's own `closureOf` over the pinned 3.12.0 tarball (digest verified against
   `scripts/vendor-webawesome.ts`'s pin): `<wa-select>` + `<wa-option>` is 31 files / 120,021 B,
   of which 20 files / 69,097 B are not already vendored for the tree; zero FORBIDDEN
   constructs; zero computed `import()`.

   IT DOES NOT DO THE JOB. Web Awesome 3.12.0 ships 70 components and NONE of them is a
   combobox. `<wa-select>`'s class chunk contains no `search` string at all — its properties
   are `multiple`, `maxOptionsVisible`, `withClear`, `placement`, `pill`, `appearance`,
   `getTag`, and its keyboard is `typeToSelect`, which is the single-key type-ahead a native
   `<select>` already has. It carries `role="combobox"` and `role="listbox"` as ARIA, not as a
   filter box. So 69,097 B and 20 new pinned files buy shadow-DOM styling work, a second custom
   element vocabulary, and one `<wa-option>` Lit element per corpus item — 950 components with
   950 shadow roots, strictly heavier than 950 `<option>` nodes — in exchange for the search
   this question exists to get, which it does not have.

   RECORDED SO IT IS NOT RE-PROPOSED: the objection to vendoring here is not the bytes and no
   longer the gate. It is that the component does not have the feature.

D. NATIVE `<input list>` + `<datalist>`. Named by nobody and it is what D11 built for its own
   three fields, driven in Chromium and Chrome in both languages. It is a text box the browser
   attaches a FILTERED suggestion popup to: typing narrows the list as you type, which is
   exactly the searchable combobox the item asks for. It is in the tab order for free
   (asserted), the popup is UA chrome so it follows the document direction under `dir="rtl"`
   for free (asserted), it needs no ARIA of our authorship, it adds zero bytes and zero
   dependencies, and unlike a `<select>` it has no min-content floor so it cannot reproduce the
   3,902px width defect (asserted, both languages).

   ITS COSTS, STATED. It builds the same N `<option>` nodes a `<select>` does — this is a
   search win, not a node-count win, and the id picker's rebuild cost is unchanged by it. The
   popup cannot be styled. It does not CONSTRAIN the value, which is a feature for `finding`
   and `pack` and a change in kind for `id`, where today only a listed item can be chosen.
   And its popup is browser chrome: CDP-synthesised keys do not open it and a Playwright
   screenshot cannot photograph it, so a test can assert the association and the data and not
   the picking. Measured in both projects, headed and headless, 2026-09-06.

THE RECOMMENDATION: D for `id`, and only after somebody rules on the constraint change it
carries. Today `id` is a closed picker and the command it composes can only name an item that
exists; a `<datalist>` would let a reader type an id that does not, and `mycontext pin
NOT-A-THING` is a refusal they would meet in their own shell rather than on the screen. That is
the same trade `--tags`, `finding` and `pack` already take deliberately, and it may well be
right here too — but it is a change to what the Composer promises, on nine commands, and D11
did not have the licence to take it.

WHAT IS NOT AT STAKE. Nothing built in D11 has to be undone whichever way this goes: `finding`
and `pack` are boxes because their FLAGS accept values no list can hold (`ack --clear` takes a
code doctor no longer reports; `--pack` takes any path), not because of anything about length.
