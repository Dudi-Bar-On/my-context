# The case against each direction

**Panel: v2 visual direction. Seat: adversary. Written 2026-08-21 on `v2/dir-adv`.**

This document exists to be held against four prototypes it has not seen. The other four experts write
on their own branches; I cannot read their work and did not wait for it. So this is not a review of
their prototypes — it is the **set of gates each premise has to pass**, measured today, so that when a
prototype arrives the owner can put it against a number rather than against an opinion.

Provenance is marked on every claim, in the house style:

- `[M]` **measured today**, 2026-08-21, on this worktree — a browser, a Node process, or a command.
- `[V]` **verified** by reading the file today.
- `[R]` **reasoned** — an argument, not a measurement.

**The honest headline, before the attacks: one direction survives every gate, one survives with a
condition the owner has to accept out loud, and two do not survive as stated.** An adversary who kills
everything has told you nothing, so the survivor is named plainly in §7.

---

## 0. The four gates, and why they come before taste

Every direction on this panel is a proposal about **appearance**. Every gate below is about
**mechanism**. They are separate questions and the panel will conflate them if nobody separates them
first, because the owner's brief — *the last panel did not produce the wow effect* — is a taste brief,
and the natural response to a taste brief is to stop asking mechanical questions.

The four gates, in the order they kill things:

1. **The CSP.** What the shipped page is actually permitted to do. §1.
2. **The build step.** What happens when anything needs compiling. §2.
3. **Right-to-left.** What survives a mirrored layout. §3.
4. **Degradation.** Print, `forced-colors`, `prefers-reduced-transparency`, `prefers-reduced-motion`. §4.

Then §5 costs the gates against the board; the four direction sections put each premise through them;
§6 is the cost table; §7 says what survives; §8 names what the previous panel got right and must not be
spent in the enthusiasm; §9 is the one question to ask each expert. The Appendix records the two things
in this document I got wrong and had to re-measure.

---

## 1. Gate one — the CSP. Measured, not read off the header.

`[V]` `src/ui/server.ts:132` sends this on **every** response, static assets included:

```
default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:;
connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
```

`[V]` `test/ui/server-e2e.test.ts:79` asserts that exact string, so it is not adjustable without a
visible test change. No `'unsafe-inline'`, no `'unsafe-eval'`, no nonce, no `font-src`.

Reading a CSP is not the same as knowing what it blocks, and the interesting cases are the ones people
get wrong. `[M]` So I served a page under that exact header from a throwaway `node:http` server on
`127.0.0.1:7392` and probed it **from a real same-origin `<script src="/probe.js">`** — not through the
debugger, because CDP evaluation is exempt from the eval check and a probe run that way reports `eval`
as *working*. It does not. This is the table:

| Capability | Verdict `[M]` | Exact result |
|---|---|---|
| `eval('1+1')` | **BLOCKED** | `EvalError` |
| `new Function('return 2+2')()` | **BLOCKED** | `EvalError` |
| indirect `(0,eval)('3+3')` | **BLOCKED** | `EvalError` |
| `setTimeout('window.__st=1', 0)` | **BLOCKED, silently** | no throw; `window.__st` never set |
| `WebAssembly.compile(...)` | **BLOCKED** | `CompileError: … violates the following Content Security policy directive because 'unsafe-eval' is not an allowed source of script in … "script-src 'self'"` |
| `new Worker(blob:…)` | **BLOCKED** | worker error, no message in 800 ms |
| `new Worker('data:text/javascript,…')` | **BLOCKED** | worker error |
| `<script>` element injected from JS | **BLOCKED** | did not run |
| **`<style>` element injected from JS** | **BLOCKED** | `styleEl.sheet === null` — the sheet never attaches |
| **`new CSSStyleSheet()` + `adoptedStyleSheets`** | **ALLOWED** | 1 rule attached and applied |
| **`style="color:red"` attribute** | **BLOCKED** | computed colour stayed `rgb(0, 0, 0)` |
| **`el.style.setProperty(...)`** | **ALLOWED** | applied |
| **web font, `data:` URI** | **BLOCKED** | *"violates … `default-src 'none'`. Note that `'font-src'` was not explicitly set"* |
| **web font, `.woff2` from the SAME ORIGIN** | **BLOCKED** | identical message — `font-src` is absent, `default-src 'none'` catches it |
| web font, cross-origin (`fonts.gstatic.com`) | **BLOCKED** | identical message |

`[M]` And the same header applied to the mockup itself (`127.0.0.1:7391/csp`): `document.styleSheets`
went to **0 sheets, 0 rules** — down from 1 sheet / 252 rules — and the rendered element count fell
from **2,382 to 1,271**, because the inline script is blocked too and it builds 47% of the DOM. That is
only a property of the mockup, which says in its own header that the product may not copy its inline
`<style>`/`<script>`. `[R]` But it is a useful demonstration of how total the blocking is: nothing
degrades, it simply does not exist.

**What that table decides, before any direction is named.**

`[R]` Four whole families of library are excluded by mechanism, not by preference:

- **Runtime CSS-in-JS is dead.** Emotion, styled-components, JSS, goober, stitches — every one of them
  works by creating a `<style>` element and attaching rules to it. `[M]` `styleEl.sheet === null`. That
  is not "degraded styling"; the sheet object does not exist, so `insertRule` has nothing to call. This
  is a first-order fact about **MUI** and **Chakra UI**, both of which are emotion-based and have no
  other styling path.
- **Anything that compiles at runtime is dead.** `[M]` `new Function` throws `EvalError`. That covers
  Alpine.js (which ships a separate CSP build for exactly this reason), Vue's full build with runtime
  template compilation, any expression-formatter a charting library evaluates, and every "tiny template
  engine" whose implementation is `new Function('with(data){return \`…\`}')`.
- **The `style` attribute is not available.** `[M]` Blocked. `[V]` The spec already knows this and
  states the rule positively: *"every data-driven size is set through the CSSOM
  (`element.style.setProperty`), never as a `style` attribute: the shipped `style-src 'self'` blocks the
  attribute parser and permits the CSSOM"*. A library that writes `style="…"` into markup — which is
  most SVG chart output and all string-rendered markup — is not adaptable to this. It is a fork.
- **No web font can load — not even a same-origin one.** `[M]` Three CSP violations, Chrome's own
  wording: *"`'font-src'` was not explicitly set, so `'default-src'` is used as a fallback."* `[R]` This
  is not the static server's extension allowlist; it is the CSP, and it applies before the request. Any
  icon font, any custom typeface, any Google Font — including one vendored into the repo and served
  from `/`.
- **Constructible stylesheets are the one door that is open.** `[M]` `new CSSStyleSheet()` +
  `adoptedStyleSheets` attached and applied. `[R]` That is worth naming because it is the mechanism
  **Lit** uses, and it means a web-component direction has a legal styling path that React's popular
  styling stacks do not.

`[R]` One thing the table does **not** say: React itself is not excluded. React's `style` prop is
applied through CSSOM assignment, not through the attribute, so it survives. React's problem is §2, not
§1. I am saying that plainly because "React violates the CSP" is the kind of imprecise objection this
report exists to replace.

---

## 2. Gate two — the build step. This is the real cost, and it is not the dependency.

`[V]` `package.json` has **no `dependencies` key at all**. devDependencies are exactly three:
`@playwright/test`, `@types/node`, `typescript`. `[V]` `bin` is `"mycontext": "./src/cli/index.ts"` — a
**`.ts` file**. `[V]` There is no `build` script. `[V]` `tsconfig.json` is `noEmit: true`,
`allowImportingTsExtensions: true`, `erasableSyntaxOnly: true`, `verbatimModuleSyntax: true`.

`[M]` Node 24.14.0 runs that binary from source. I ran it: a `.ts` file with a type annotation executes
directly.

### 2.1 The measurement that decides the React question

`[M]` **Node 24.14.0 cannot execute a `.tsx` file.**

```
$ node p.tsx
const el = <div className="m">hi</div>;
           ^
SyntaxError: Unexpected token '<'
```

Type-stripping erases types. JSX is not a type — it is syntax that must be **transformed** into
function calls, and Node does not transform. There is no flag for it.

`[M]` **`node --test` cannot even load a `.tsx`:**

```
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".tsx"
```

It fails at module resolution, before it reaches the JSX. `[R]` So the **189-file** `node --test` suite
cannot execute a test that imports a component, and the fix is not a flag — it is a loader, which is a
runtime dependency, plus a DOM implementation, plus a rendering library, none of which exist here.

### 2.2 The guardrail that does not guard

`[R]` `erasableSyntaxOnly: true` exists to keep the source runnable by Node's stripper. You would
expect it to catch JSX. `[M]` It does not:

```
d.ts(1,6): error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.   ← an enum
c.tsx: (no error)                                                                          ← <div className="m">hi</div>
```

`[M]` `tsc` flags `enum` and says nothing about the JSX. `[R]` So a `.tsx` file passes
`npm run typecheck` **clean** and then fails at runtime with `SyntaxError`. Green typecheck, dead
binary. That is precisely the defect class this project records as its own — *asserting a property the
code does not have* — arriving through the one flag that was installed to prevent it.

### 2.3 What a build step costs here specifically

`[M]` `npm run typecheck` is **6.66 s** clean today. `[M]` 189 `*.test.ts` files, 103 `src/**/*.ts`,
578 tracked files, 12 MB working tree.

`[R]` Four ways to introduce a build, and what each one breaks:

| Who builds | What breaks |
|---|---|
| `prepare`/`prepack` on install | `bin` points at source. A plugin dropped into an arbitrary repo would now run a compiler on install — and `.claude-plugin/` installs are not npm installs, so the hook may not fire at all. |
| Commit built assets | `[V]` `.gitignore` already ignores `dist/`, so this either changes that rule or invents a second output directory. Every UI change becomes a source diff plus an unreviewable generated diff. `[R]` Five parallel worktrees exist right now on this very question; a merge conflict inside a bundle has no resolution other than rebuild-and-hope. |
| Build in CI, publish artifacts | Splits "what is in git" from "what runs", in a product whose central habit is deriving assertions from files on disk. Two of the test harnesses (§3.3) read the design of record off the filesystem. |
| Build on first `mycontext ui` | Puts a compiler in the latency path of a command whose whole selling point `[V]` is that *"hooks start in tens of milliseconds"*. |

`[R]` And the contributor workflow changes from `git clone && npm ci && npm test` — no build, ever — to
one with a stale-bundle failure mode. `[V]` Source maps do not help: `src/ui/static.ts:95` serves
**exactly four** content types, `.html` `.js` `.css` `.svg`. A `.map` request is refused. So is
`.woff2`, `.json`, `.wasm`, `.mjs` and `.png`.

`[V]` Node's own documentation (`nodejs.org/api/typescript.html`) states it in two lines that settle
this: **"`.tsx` files are unsupported"**, and **"No `tsconfig.json` support"** — the stripper does not
read the config at all, so no compiler option can rescue it. `[V]` The same page lists **decorators**
as unsupported for the same underlying reason: they *replace* syntax rather than erase it. `[R]` That
second item matters for a direction nobody has proposed yet — Lit with its `@customElement` /
`@property` decorators is out; Lit with static class fields is in.

### 2.4 The supply-chain surface, counted

`[M]` Direct-dependency counts from the live npm registry (`npm view`, read-only, nothing installed —
`node_modules` here is a junction to the real checkout):

| Package | Direct deps | Note |
|---|---|---|
| `react` | **0** | |
| `react-dom` | **1** (`scheduler`) | 3 packages total with react |
| `preact` | **0** | |
| `htm` | **0** | 2 packages total |
| `lit` | **3** | `@lit/reactive-element`, `lit-element`, `lit-html` |
| **`radix-ui`** (unified) | **56** | all small `@radix-ui/*` packages |
| `@mui/material` | 12 | plus `@emotion/react` 8, `@emotion/styled` 6 |
| `chart.js` | **1** (`@kurkle/color`) | 2 packages total |
| **`recharts`** | **11** | including **`@reduxjs/toolkit`, `immer`, `d3-shape`, `d3-scale`, `es-toolkit`** |
| `jsdom` (test-only) | **21** | needed to render a component under `node --test` |

`[R]` The Recharts row is worth stopping on: a charting library that pulls **Redux internals** it does
not expose is 11 direct dependencies for something the spec already describes as a hand-written SVG.

`[R]` And the toolchain, not the library, is where the install cost is: Vite 8 ships `rolldown` and
`lightningcss` as **native binaries** with per-platform optional variants, and Tailwind v4 ships
`@tailwindcss/oxide`, a native Rust binary, the same way. `[R]` ESTIMATE for a React + Vite + Tailwind +
Radix tree: **150–300 unique packages, 150–350 MB of `node_modules`** — unmeasured, and deliberately so,
because measuring it means installing it and this worktree's `node_modules` is a junction into the real
checkout. Today: **6 top-level entries** for three devDependencies, and **zero** runtime dependencies
for an end user.

### 2.5 The dependency is genuinely not the problem

`[R]` I want to be fair to the pro-library case, because the owner has now allowed libraries and the
temptation is to treat that as settled by fiat. A vendored, prebuilt, dependency-free ESM file dropped
into `public/lib/` and served as `.js` **passes every gate in §1 and §2**. It is not a build step and it
is not an npm dependency. The mechanical objection is narrower and sharper than "no dependencies":
**it is to compilation, not to code you did not write.**

`[R]` But vendoring has one cost that should be said out loud rather than discovered: a vendored bundle
never appears in `package.json`, so it has **no `npm audit` and no Dependabot coverage at all.** For
supply-chain visibility that is *worse* than a declared dependency, not better — none of the existing
tooling knows the code is there. `[V]` And its source maps are refused by `static.ts`'s four-extension
allowlist, so a production stack trace maps to nothing.

### 2.6 The two escape hatches that actually survive, and the one that does not

`[M]` **`htm` does not use `eval` or `new Function`.** Verified by fetching `htm@3.1.1`'s published
`dist/htm.js` and searching it: the tagged-template parser is a hand-rolled state machine over the
`strings` array, not code generation. `[R]` So **Preact + htm passes §1's `EvalError` gate**, needs no
build (tagged template literals are plain ES2015 syntax), and is **2 packages with 0 dependencies
between them** — the smallest supply chain in this report. This is the honest "React-shaped without a
build" option and no direction on this panel has proposed it.

`[M]` **Import maps + an ESM CDN are dead twice over.** A `<script type="importmap">` is an **inline
script** for CSP purposes, so under `script-src 'self'` with no `'unsafe-inline'` and no nonce it is
blocked before it can register. And even if it registered, the remapped URL is still cross-origin,
which `script-src 'self'` refuses. `[M]` This is consistent with my own probe: an injected inline
`<script>` did not run.

`[R]` **Lit without decorators survives**: its `css` tagged template attaches through
`adoptedStyleSheets`, and `[M]` I measured constructible stylesheets as **ALLOWED** under this exact
CSP. Lit is the one component library on the shelf whose styling mechanism the CSP permits.

### 2.7 The ephemerality trap, which is not a styling question but will be decided by one

`[V]` `src/ui/idle.ts:2,9`: *"idle means NO **non-stream** `/api` request for fifteen minutes"*, and
`IDLE_MS = 15 * 60_000`. `[V]` The server shuts itself down. That is the ephemerality half of the
security model — `[V]` spec §2, *"Ephemerality, and the tab that would have defeated it"*.

`[R]` Every mainstream React data layer defeats it by default. TanStack Query ships
`refetchOnWindowFocus: true`; SWR ships `revalidateOnFocus: true`. Both issue a real `/api` request
every time the user alt-tabs back to the page. `[R]` The result is not a slow server — it is a server
that **never idles out**, because a background revalidation is indistinguishable from a user, and the
idle window is reset by a library default nobody wrote down. A direction that adopts one of these has
silently repealed a security property, and no test in the suite is looking at the idle clock from the
browser side.

---

## 3. Gate three — right-to-left, and the two harnesses that derive their own numbers

### 3.1 What the product actually holds

`[M]` I re-measured the mockup's sheet through the live CSSOM rather than by grep, because grep counts
text and the browser counts declarations:

- **2,794 CSS declarations** across **252 rules** in **1 sheet**.
- **206 of them are logical/direction-aware.** The inline-axis ones — the ones that actually flip:
  `padding-inline-start` 24, `padding-inline-end` 20, `margin-inline-start` 4, `margin-inline-end` 3,
  `inset-inline-start` 2, `inset-inline-end` 3, `border-inline-*` 12, `text-align` 8, `direction` 11,
  `unicode-bidi` 12. `[M]` Of the eight `text-align` declarations, **six are `start`, one is `end`, one
  is `center`** — so seven are logical and the eighth is direction-neutral. Not one is `left` or
  `right`.
- `[M]` **Zero** `margin-left|right`, `padding-left|right`, `text-align:left|right`, `float:left|right`,
  `border-left|right`. Confirmed by grep over the file and by the CSSOM enumeration above.

`[M]` And the strings: **396 keys in `en.js`, 396 in `he.js`, exact set parity, `dir` `ltr`/`rtl`
declared**, with **73 values carrying 112 substitution slots**. `[M]` In the live DOM: **406**
`[data-t]`, **12** `data-t-aria`, **5** `data-t-title`, **225** `.m` runs, **2,382** elements.

`[R]` This is a stronger RTL position than almost any shipping product has. That is exactly what makes
it fragile: everything below is a way of losing it without a test going red.

### 3.2 The flip-versus-logical distinction, which is the whole question

`[R]` There are two ways a library can support RTL and they are not interchangeable:

- **Natively logical** — the library's own CSS is written in `margin-inline-start` and friends, so the
  browser mirrors it and nothing has to run.
- **Flipped** — the library ships physical CSS and a tool rewrites `left`↔`right` at build or runtime
  (`stylis-plugin-rtl`, `rtlcss`, `postcss-rtlcss`).

`[R]` A codebase that is **already** 100% logical does not want a flipper anywhere near it. The product's
98 direction-dependent declarations are already correct; a pass whose job is to invert direction into a
sheet that is direction-neutral has no upside and a silent failure mode.

**And the failure mode is not the one people expect.** `[M]` I had the `rtlcss@4.3.0` property table
extracted from `lib/plugin.js`. It matches on `/left/im`, `/right/im`, `/^(margin|padding|border-(color|style|width))$/`,
`/border-radius/`, `/shadow/`, `/(?:transform|perspective)-origin/`, `/^(?!text-).*?transform$/`,
`/transition(-property)?$/`, `/(background|object)(-position(-x)?|-image)?$/`,
`/float|clear|text-align|justify-(content|items|self)/`, `/cursor/`, `/direction/`, `/^--/`.
**Not one logical property appears.** No logical property name contains the substring `left` or `right`;
the four-value matcher is anchored so `margin-inline` misses it; `border-start-start-radius` does not
contain `border-radius`. `[M]` `postcss-rtlcss@6.0.0` pins `rtlcss@4.3.0` exactly and **says so in its own
README**: *"it doesn't support CSS logical properties."* `[M]` And CSSJanus's README **recommends logical
properties instead of itself**.

`[R]` So a flipper does not mangle logical CSS. It **ignores** it — which produces four failures, in this
order of danger:

1. **The `transform` double-flip, and it is provable.** `[M]` rtlcss unconditionally negates
   `translate|translateX|translate3d|rotate|rotateZ|rotateY`, `skewX|skewY`, `matrix`, `matrix3d`,
   `rotate3d`. `[M]` postcss-rtlcss's own README shows `transform: translate(-50%, 50%)` becoming
   `[dir="rtl"] .test1 { transform: translate(50%, 50%) }`. `[R]` The canonical logical centring idiom is
   `inset-inline-start: 50%; transform: translateX(-50%)`. Under RTL the inset flips **natively** (the
   flipper ignored it) and the translate is flipped **again** by the tool. **Net displacement: 100% of the
   element's own width.** That is a real double-flip in a codebase written entirely in logical properties.
2. **`[dir="rtl"]` specificity outranks your logical properties.** `[R]` The tool emits
   `[dir="rtl"] .x { … }` at specificity (0,2,0); your logical declarations sit in `.x { … }` at (0,1,0).
   Every physical longhand the tool emits **wins** in RTL. `[M]` postcss-rtlcss ships `bothPrefix` and
   `safeBothPrefix` options that exist purely to patch this collision.
3. **Ordering against a logical→physical downlevel step is load-bearing.** `[M]` postcss-rtlcss issue
   **#494** (2025-04-07) is exactly this case — a logical-properties codebase where `postcss-logical` ran
   first — and the fix, PR #497 / the `runOnExit` option, shipped in **5.7.0**.
4. **Silent no-op.** `[R]` The default outcome is that nothing happens, CI is green, and the team believes
   it has RTL tooling. `[M]` Bootstrap's own docs put the price of that at **"20%–30%" stylesheet size
   increase**.

`[M]` **Bootstrap has reached this conclusion itself.** Issue **#42241, "Replace RTLCSS with logical
properties and no extra transform/build step"** — assigned to `mdo`, milestone **v6.0.0**, closed
*completed* on **2026-03-26**, describing the separate `*.rtl.css` build as *"a relic leftover from when
Bootstrap had to support RTL but browsers didn't have good standard support for it."* `[R]` Adopting the
flip model in 2026 is adopting a model its most prominent user has scheduled for removal.

`[M]` **Exactly one library in this review uses a flip step: MUI.** Its RTL guide mandates
`@mui/stylis-plugin-rtl`, whose `dependencies` are `{"cssjanus": "^2.3.1", "@babel/runtime": "…"}` —
CSSJanus is Wikimedia's blanket `left`↔`right` mirroring engine, and MUI ships a `/* @noflip */` escape
hatch precisely because the mirror is indiscriminate. `[R]` Your rules would pass through untouched while
MUI's are mirrored: two divergent direction models in one page. **That alone disqualifies MUI here**,
before Emotion and the CSP.

`[R]` This is the single most important library-selection criterion on this panel and it is the one a
prototype will never surface, because **a prototype is one screen and the flip bugs live in the
components a prototype does not use** — popover placement, slider fill, scroll-area shadows, date pickers.

### 3.3 Direction is a DOM fact here. Almost every React library makes it a context fact — on purpose.

`[V]` The product's direction lives on the document element. `e2e/keyboard.spec.ts:59,66` asserts
`document.documentElement.dir`; `e2e/language.spec.ts:77-81` asserts it survives a round trip;
`e2e/bidi.spec.ts` measures `getComputedStyle(el).direction` on every one of the 225 `.m` runs.
`[M]` And the language toggle sets it — twenty round trips, `dir` correct every time (§4.2).

**So the question for every candidate is one question: does it read `<html dir>`?** Answers, verified:

| Library | Reads `<html dir="rtl">`? | Mechanism | Evidence |
|---|---|---|---|
| **Mantine** 9.5.1 | **YES — the only one** | `DirectionProvider({detectDirection: true})` reads `document.documentElement.getAttribute('dir')` **and installs a `MutationObserver` with `attributeFilter: ['dir']`** | `[M]` source |
| **Radix UI** 1.6.7 | **NO — formally declined** | `useDirection` returns `localDir \|\| globalDir \|\| Direction.LTR` | `[M]` issue **#3830** *"auto-detect RTL from HTML document"* closed **`not_planned` 2026-06-07**; PR **#3866** unmerged. Maintainer: *"No plans to implement at this time… would result in a hydration mismatch."* |
| **Ark UI / Zag** 5.38.2 | **NO — formally declined** | `LocaleProvider`; default `{dir:'ltr', locale:'en-US'}` | `[M]` `chakra-ui/zag` **#2960** *"Components should inherit `dir` from parents"* closed **`not_planned` 2026-02-14** |
| **React Aria** 1.20.0 | **NO — and there is no direction prop at all** | `I18nProvider` accepts **only `locale`**; `direction: isRTL(locale) ? 'rtl' : 'ltr'` | `[M]` source. Issue **#6469** *"Ability to manually set direction to RTL"* closed, still unimplemented |
| **Chakra UI** 3.36.1 | **NO — needs both** | `dir` prop **and** `LocaleProvider`; set one and you get a half-mirrored component | `[M]` official RTL guide uses both simultaneously |
| **Ant Design** 6.6.1 | **NO, and it sets no `dir` either** | `ConfigProvider direction="rtl"` is React context + `-rtl` class suffixes | `[M]` grep of shipped `es/config-provider/*.js` in 5.29.3 and 6.6.1: **zero** `dir` attribute emitted |
| **MUI** 9.3.1 | **partially, and it says so** | `dir` + `theme.direction` + the flip plugin | `[M]` MUI's own docs: *"Components that use React portals (like the Dialog) do **not** inherit the `dir` attribute from parents… You must apply the `dir` attribute directly to these components"* |
| **Headless UI** 2.2.10 | **N/A — zero direction code** | none | `[M]` repo-wide search for `rtl`: **6 files, every match a substring inside an identifier** (`assertLinkedWithLabel`, `assertListbox`). `direction: 'rtl'` → **0 results** |

`[R]` **Read the second column again.** Two of the most likely candidates — Radix and Zag, which between
them underpin shadcn/ui, Ark UI and Chakra v3 — were **asked** to read `<html dir>` and **said no**, with
reasons (SSR hydration) that are legitimate for their audience and irrelevant to a local, non-SSR,
single-user console.

`[R]` The consequence for this product is precise: adopting any of them creates a **second source of
truth for direction** that must be kept in sync with the attribute by hand, forever — and **the e2e suite
asserts the attribute, not the context.** A Hebrew page whose `<html dir="rtl">` is correct and whose
`DirectionProvider` was not updated renders LTR popovers inside an RTL page, and every existing assertion
passes. That is the same shape as §3.4: not a broken test, a test that stops covering the thing.

`[R]` React Aria's variant is the strangest and worth stating plainly: **you cannot ask it for RTL. You
can only ask it for a Hebrew locale**, which simultaneously changes number formatting, collation and
calendar. `[M]` The documented field workaround in open issue **#10112** is to pass a *false* locale to
get the direction you want and accept the wrong number formatting.

`[R]` The one library that does the right thing — Mantine — buys it with a global write: `setDirection`
writes to `document.documentElement`, so **an RTL subtree cannot be scoped**, and `initialDirection`
defaults to `'ltr'` with detection in an effect.

### 3.3b The shadcn/ui number, because it is the one most likely to be proposed

`[M]` All 61 component recipes in `apps/v4/registry/new-york-v4/ui/`, counted for direction-sensitive
Tailwind utilities at class boundaries:

> **84 physical, direction-unsafe utilities. Zero logical utilities.**

`[M]` Worst: `sidebar.tsx` 17, `menubar.tsx` 15, `dropdown-menu.tsx` 15, `context-menu.tsx` 15,
`calendar.tsx` 9, `navigation-menu.tsx` 8. Real lines from `dropdown-menu.tsx`: `data-[inset]:pl-8`,
`"… py-1.5 pr-2 pl-8 …"`, `<span className="… absolute left-2 …">`, `"ml-auto text-xs …"`.

`[R]` There is no flipper, so nothing double-flips — and equally **nothing mirrors**. `[M]` The three
newer bases (`bases/radix`, `bases/aria`, `bases/base`) are the same: 2 physical / 0 logical each.
`[M]` And the RTL bugs are not being triaged: **three competing open PRs** (#11477, #11401, #11203) for
one InputOTP RTL bug, plus open issue **#11201**, none merged.

`[R]` Against a product with **zero** physical properties in 2,794 declarations, adopting shadcn/ui means
hand-rewriting 84 utilities across 61 files before the first screen ships — and then maintaining that
divergence against upstream forever, because shadcn is copy-paste, not a dependency.

### 3.4 The two harnesses that derive their expected numbers from literal markup

`[R]` This is the failure mode I most want the owner to hold every direction against, because it turns
a red test into a **green** one.

`[V]` `test/ui/strings-parity.test.ts` derives its key set from the design of record with:

```js
/\sdata-t(?:-aria|-title)?="([^"]+)"/g   // over docs/design/web-ui-mockup.html
```

`[V]` `e2e/mockup.ts:56-71` derives its counts the same way, off the same file, and adds:

```js
/class="m(?=["\s])/g
```

`[V]` Both files say, in their own comments, that they derive rather than pin *because* a remembered
number fails for the wrong reason. That is correct reasoning and it has one dependency nobody has
written down: **the design of record must be literal, double-quoted HTML.**

`[R]` Now put a framework in front of it:

- `className="m"` does **not** match `class="m(?=["\s])`. `declaredMonospace()` returns **0**. `[V]` The
  assertion it feeds is *a floor* — "the page draws at least this many" — so a floor of zero is
  satisfied by anything. **The test goes vacuously green.** It does not fail; it stops meaning anything.
- `data-t={key}` does not match `\sdata-t="([^"]+)"`. Same outcome for the 396-key parity check: the
  mockup's declared set shrinks toward empty, the "INVENTED" assertion (*keys in the tables that the
  mockup does not show*) starts failing for a reason that has nothing to do with the defect it hunts,
  and the natural fix under deadline is to weaken it.
- A template literal that writes `data-t="${k}"` **does** match — and captures the literal string
  `${k}` as a key. A phantom key that is in neither table.

`[R]` `strings-parity.test.ts`'s first test is a guard — `assert.ok(design.size > 0)` — so total collapse
is caught. Partial collapse is not. That is the shape of this hazard: it is not that these directions
break the tests, it is that they **quietly reduce what the tests assert** while the suite stays green,
in a project whose recorded characteristic defect is asserting a property the code does not have.

### 3.5 Strings a library brings with it

`[R]` A component library that ships user-visible text — pagination labels, "Clear", "Select all",
"No data", month names, aria-labels with English in them — introduces strings that are **structurally
invisible to the parity system**. `strings-parity.test.ts` compares `en.js` ↔ `he.js` ↔ the mockup. A
string that lives inside a node module is in none of the three. It will render in English inside a
Hebrew page, and **every assertion in the file will pass.**

`[R]` And the two ways out are both bad. Adding the library's strings to the tables fails the INVENTED
assertion, because the mockup does not declare them. Adding them to the mockup means hand-writing a
library's internal DOM into the design of record, which is not a design decision and will drift on the
first upgrade.

**How much text each candidate actually brings, measured:**

| Library | User-facing strings it ships | Hebrew |
|---|---|---|
| **React Aria** | `@internationalized/string` + `intl-messageformat`, per-component JSON across **20 components × 34 locales** | `[M]` **Complete and professional** — correct ICU plurals in Hebrew grammar (`{count, plural, =0 {לא נבחרו פריטים} one {פריט # נבחר} other {# פריטים נבחרו}}`). One systematic gap: `dropzoneLabel: "DropZone"` untranslated in `he-IL` **and** `ar-AE` |
| **MUI core** | `@mui/material/locale`, 61 locales | `[M]` `heIL` complete — 26 keys, zero components missing |
| **MUI X DataGrid** | `heIL` | `[M]` **125 keys against `enUS`'s 214 — 89 missing, 42%.** The gaps are commented-out English in the source (`// noColumnsOverlayLabel: 'No columns'`, `// headerFilterClear: 'Clear filter'`) and **fall back to English at runtime** |
| **Ant Design 6.6.1** | `antd/locale/he_IL` + dayjs | `[M]` complete except `Carousel` — arrows announce *"Next slide"/"Previous slide"* in English to a Hebrew screen-reader user |
| **Ant Design 5.29.3** | same | `[M]` missing `QRCode`, `ColorPicker`, **5 of 17 `Table` keys**, 7 of 12 `Transfer` keys |
| **Mantine** | `[M]` **7 strings total**, all props with English defaults | nothing to localise centrally |
| **Radix** | `[M]` **2** — `'Notification'`, `'Notifications ({hotkey})'` (Toast) | none; you translate |
| **Ark UI / Zag, Headless UI** | per-machine `translations` props / none | none |

`[R]` Two things follow that a prototype cannot show.

First, **React Aria's excellence is itself the problem here.** `[M]` All 34 locales are inlined into the
bundle by default — **9.9 KB gzip of them**, verified by rebuilding with `--charset=utf8` and counting
194 Hebrew, 236 Arabic and 229 CJK characters in the output. A complete, correct, professional Hebrew
translation, shipped — **and not one of its keys is in `en.js`, `he.js` or the mockup.** The product would
have two translation systems, one of them invisible to the test that exists to catch exactly this.

Second, `[M]` **antd's `he_IL` does not set `direction`** — the `Locale` TypeScript interface has no such
field, and grep of the shipped `he_IL.js` returns zero. So `locale={heIL}` gives you Hebrew *words* in an
LTR layout, which is the failure this product has spent 396 keys and three e2e specs avoiding.

`[R]` And the worst case is not a missing string. It is **MUI X DataGrid's 42%**: a Hebrew user opening a
data grid and reading English filter labels, with the suite green, because those strings were never in
any of the three sets `strings-parity.test.ts` compares.

---

### 3.6 If the answer is Tailwind — the accurate version, because the folklore is out of date

`[R]` Tailwind is what both B and C most plausibly reach for, and the received objections to it are stale.
`[M]` Verified against **Tailwind 4.3.3** (CHANGELOG 2026-07-16):

**The good news, and it is real.** `[M]` `space-x-*` and `divide-x-*` are **logical in v4** — they emit
`margin-inline-start/end` and `border-inline-start/end-width`. That changed in **PR #14805**, merged
2024-10-28, which moved every `x`/`y` utility (`px-*`, `my-*`, `inset-y-*`, `scroll-px-*`) onto logical
properties. `[M]` The `rtl:` variant is `&:where(:dir(rtl), [dir="rtl"], [dir="rtl"] *)` — it uses
`:dir()`, so it matches a *computed* direction, not only an explicit attribute. That is the correct
selector and it is better than UnoCSS's `[dir="rtl"] &`, which cannot see `dir="auto"`.

**The utilities that are still physical and have NO logical equivalent** — this is the real list, and it
is the one to hold a Tailwind proposal against:

`[M]` `translate-x-*`, `rotate-*`, `skew-x-*`/`skew-y-*`, `origin-left`/`origin-right`/`origin-top-left`/…,
the gradient directions `bg-linear-to-r`/`-to-l`/`-to-tr`/…, `object-left`/`object-right`/…,
`bg-left`/`bg-right`/…, `overflow-x-*`/`overflow-y-*`, `overscroll-x-*`/`overscroll-y-*`,
`resize-x`/`resize-y`, `border-spacing-x-*`/`border-spacing-y-*`.

`[R]` `translate-x-*` is the dangerous one, for the reason in §3.2: it is exactly the half of the
centring idiom a flipper double-flips, and it has no logical form to escape to.

**Three costs a Tailwind proposal must state out loud:**

1. `[M]` **`print-color-adjust` utilities do not exist.** `tailwindcss.com/docs/print-color-adjust` is a
   **404**, and the CHANGELOG has no entry. `[R]` The default is `economy`, under which the UA drops
   backgrounds — so **every `bg-*` disappears on paper** unless hand-authored as `[print-color-adjust:exact]`.
   For a product with `[V]` a required print stylesheet and status chips that carry meaning, that is not
   a detail.
2. `[M]` **`start-*` and `end-*` were DEPRECATED in v4.2.0** in favour of `inset-s-*`/`inset-e-*`, and are
   slated for removal. Code written today against them is on a removal path.
3. `[M]` **The engine is `@tailwindcss/oxide` — a Rust native addon shipped as 12 platform-specific
   binaries.** `[M]` And the no-build escape (`@tailwindcss/browser`) is dead here: its source does
   `document.createElement('style')` → `document.head.append(...)` with **no nonce support**, and §1
   measured an injected `<style>` as **BLOCKED, `sheet === null`**. `[M]` Tailwind's own docs call the CDN
   *"designed for development purposes only, and is not intended for production."* **Build step or
   nothing.**

`[R]` For completeness, since it is the usual alternative: UnoCSS is eval-free and binary-free, but `[M]`
its `preset-wind3` still emits **physical** `mx-*`/`px-*`/`space-x-*` (its `directionMap` maps `x` to
`['-left','-right']`) and has **zero** forced-colors support; only `preset-wind4` is logical — and even
there `divide-x-*` is physical, because that rule carries its own local physical map. `[M]` Its
maintainer's recorded position on RTL, issue #3643: *"We currently have no plans for other languages,
English is spoken internationally."*

---

## 4. Gate four — degradation. Four queries, and the one that is currently absent.

`[V]` The mockup has exactly five media queries: `print`, `forced-colors:active`,
`prefers-reduced-transparency:reduce`, `prefers-contrast:more`, and two `max-width:1000px`.

**Print.** `[V]` The whole print system is fifteen lines and it works by **owning the DOM**:

```css
.top,.rail,.prov,.strip,.pop,.banner,.noprint{display:none!important}
[data-p]{display:none!important}
[data-p].printing{display:block!important}
```

`[R]` Two consequences nobody has stated. First, `.pop` — every popover — is hidden outright, so a
library whose popovers are essential to a screen prints an incomplete screen. Second, and worse:
**React portals render to `document.body`, outside every `[data-p]`.** Radix, MUI and Chakra all portal
dialogs and popovers by default. Portalled content matches neither `[data-p]` nor `[data-p].printing`,
so it is neither hidden by the first rule nor revealed by the second — it prints on **every** screen.

`[V]` And the standing defect: printing while dark yields **246** contrast failures against **17** in
light, because the print block resets `body` but never `color-scheme`, so `light-dark()` tokens keep
their dark values on white paper. `[V]` `e2e/print.spec.ts` asserts `bodyBg` and `bodyColor` and both
still pass. `[V]` `e2e/playwright.config.ts:58-61` pins the whole suite to

```ts
colorScheme: 'light', locale: 'en-US', timezoneId: 'UTC', viewport: { width: 1280, height: 720 },
```

so **no spec has ever printed from dark**. `[R]` That is the template for every gap in this section:
**the harness pins the axis along which the failure lives.** It is pinned for a good reason — the
config's own comment says determinism, and it is right — but the consequence is that every new
environmental axis a direction introduces (`prefers-reduced-motion`, a second colour scheme in print,
a forced-colors pass) needs a **new Playwright project**, not a new assertion, and a panel costing a
hover state will not price a project.

**`forced-colors` — and I re-measured this one, because the received wisdom about it is wrong.**

`[V]` The block names `.gloss, .gloss.float` and nothing else. `[M]` I ran the mockup through Playwright
1.62 / Chromium with `forcedColors: 'active'` against `'none'`, light theme, 1280×900:

| | `forced-colors: none` | **`forced-colors: active`** | forced? |
|---|---|---|---|
| `body` color / background | `rgb(23,23,27)` / `rgb(247,246,242)` | `rgb(0,0,0)` / `rgb(255,255,255)` | **yes** |
| `.card` background / border | `rgb(255,255,254)` / `rgb(141,136,122)` | `rgb(255,255,255)` / `rgb(0,0,0)` | **yes** |
| `.card` `background-image` / `box-shadow` | gradient / shadow | **`none` / `none`** | **yes** |
| `.seg` background / border | `rgb(138,109,20)` / `rgb(23,23,27)` | `rgb(255,255,255)` / `rgb(0,0,0)` | **yes — flattened** |
| `.dot` background / border | `rgb(138,109,20)` / `rgb(23,23,27)` | `rgb(255,255,255)` / `rgb(0,0,0)` | **yes — flattened** |
| **`svg line` `stroke`** | `rgb(226,223,214)` | **`rgb(226,223,214)`** | **NO** |
| **`svg circle` `stroke` / `fill`** | `rgb(147,48,47)` / `oklch(0.934 0.017 24.6)` | **unchanged, both** | **NO** |
| **`svg text` `fill`** | `rgb(101,99,93)` | **`rgb(101,99,93)`** | **NO** |

`[M]` Forced colors was unambiguously active in the second column — `matchMedia('(forced-colors:
active)').matches` was `true`, and the **CSS `color` property on those same SVG elements** went from
`rgb(23,23,27)` to `rgb(0,0,0)`. The `fill` and `stroke` beside it did not move.

`[R]` **This confirms the repo's D7 finding and contradicts the common reading of the spec.** CSS Color
Adjust lists SVG `fill` and `stroke` among the force-adjusted properties; Chromium, measured, leaves an
explicitly-authored `fill`/`stroke` alone. So the widely-repeated claim that *"SVG charts are
catastrophically flattened under forced-colors while canvas escapes"* is **backwards in Chromium** — and
Chromium is the only engine `[V]` `e2e/playwright.config.ts` runs.

`[R]` **What actually follows, and it still favours SVG — for a different reason than the usual one.**
An SVG chart and a canvas chart are equally unreadable on a forced palette: both keep their authored
colours on a ground the OS has repainted. The difference is the **remedy**. `fill` and `stroke` are CSS
properties, so `@media (forced-colors: active) { svg.chart .edge { stroke: CanvasText } }` fixes it in
one line — which is exactly the prior panel's proposed fix, and it works *because* Chromium does not
touch them. Canvas pixels are not CSS anything: the only remedy is
`matchMedia('(forced-colors: active)')` plus a full re-render in JavaScript, per chart, forever.

`[R]` One caution I owe the owner: this is an **engine-specific measurement**. A direction whose
correctness depends on Chromium leaving SVG paint alone is depending on an implementation detail that
the spec text reads against. That is another argument for `stroke: CanvasText` written by name — it is
correct under both behaviours.

**`prefers-reduced-transparency`.** `[V]` Covers the one decorative translucency and **none of the seven
data-carrying ones** — `.dot.n` at `.5` ("not examined"), `.notrun` at `.3`, `.rung.after` at `.42`,
`.mini i.u` at `.34`, `svg.chart .edge.bearing` at `.55`, `tr.regime .ln` at `.45`, `.legend .ln.bearing`
at `.55`. `[R]` The inversion is the finding: the decoration degrades correctly and the signal does not.

**`prefers-reduced-motion` — the absent one.** `[M]` I counted, in the mockup:

| | count |
|---|---|
| `transition*` | **0** |
| `animation*` | **0** |
| `@keyframes` | **0** |
| `will-change` | **0** |
| `prefers-reduced-motion` | **0** |

`[R]` The last row is correct **only because of the first four**. It is not a decision that has been
taken; it is an obligation that has not yet been incurred. The moment any direction adds a hover lift, a
page transition, a chart draw-in or a skeleton shimmer, `prefers-reduced-motion` becomes mandatory
across 21 screens — and there is no project in the Playwright config that emulates it, exactly as there
was no project that printed from dark. `[R]` The dark-print defect is what that costs, empirically:
246 failures that lived for months behind a green suite.

### 4.1 The performance floor, measured, because "restrained" is assumed to mean "fast"

`[M]` I traced the mockup over HTTP at **1280×900, 4× CPU throttle**, Chrome DevTools MCP:

| Metric | Value |
|---|---|
| LCP | **1,250 ms** |
| — TTFB | 5 ms |
| — **render delay** | **1,246 ms (99.7%)** |
| CLS | **0.2206** — one shift at 2,273 ms |
| Largest layout update | **783 ms**, 201 of 201 nodes |
| Second/third layout updates | 214 ms (476 nodes), 88 ms (135 of 401) |
| Style recalculation | 56 ms, 342 elements |
| Total elements | 2,379 |
| DOM depth | 13, deepest at `button.linkid.m` |
| **Largest single parent** | **`svg.chart` — 109 children** |

`[R]` Three things follow, and they cut in different directions.

1. **The zero-dependency page is not fast.** 99.7% of LCP is render delay and CLS is 0.22 — "needs
   improvement", one shift, caused by the page's own script building 1,111 of its 2,382 elements after
   first paint. Nobody should present "no dependencies" as a performance argument. It is not one here.
2. **The most expensive node in the document is the chart.** `svg.chart` has 109 children and the
   largest layout pass touches 201 nodes for 783 ms. `[V]` The spec already caps the graph at 60 nodes,
   radius 1–2, deterministic layout, no simulation — for cost. A data-first direction pushes on exactly
   the axis that is already measured as the most expensive.
3. **The server-side cost is real and is already pinned.** `[V]` `test/perf/glob-cache.perf.ts` records
   4,000 paths × 12 patterns at **28.0 ms uncached, ~2.7 ms cached**, with an asserted ceiling of 15 ms,
   because `matchesScope` is what answers "does this item govern this path" for every file the coverage
   map draws.

### 4.2 The stability floor, measured — because the page is meant to stay open for fifteen minutes

`[V]` `src/ui/idle.ts` sets a **fifteen-minute** idle window. `[R]` So this is a long-lived page with an
SSE stream on it, and node drift or a listener leak across language toggles is a real class of defect,
not a theoretical one.

`[M]` I clicked `#lang` **twenty times** on the served mockup and sampled every fifth toggle:

| After | `dir` | elements | `.m` runs | `[data-t]` | JS heap |
|---|---|---|---|---|---|
| start | ltr | 2,382 | 225 | 406 | 3.06 MB |
| 5 | rtl | 2,305 | **225** | **406** | 3.38 MB |
| 10 | ltr | 2,382 | **225** | **406** | 3.49 MB |
| 15 | rtl | 2,305 | **225** | **406** | 2.46 MB |
| 20 | ltr | **2,382** | **225** | **406** | **2.30 MB** |

`[M]` **Zero drift.** Element counts return exactly; `.m` holds at 225 in *both* writing directions;
`[data-t]` holds at 406; the heap ends **below** where it started, so nothing is retained.

`[R]` That is a genuinely good result and it is the bar. `[V]` But note what tests it: `bidi.spec.ts`
does **one** round trip (`expect(back.mono.count).toBe(ltr.mono.count)`). Nothing does twenty, and
nothing looks at memory at all. A framework introduces mount/unmount lifecycles, portal roots and
subscription cleanup — the standard sources of exactly this leak — into a page that stays open for
fifteen minutes, and the suite has no assertion that would notice.

`[R]` The 57,000-node figure in the mockup's own CSS comment is fabricated — the prior panel found it
appears exactly once in the whole repository, in that comment, and measured the Coverage screen at 122
elements and 0.6 ms. `[R]` I am repeating that here for one reason: **it is the number a direction
would cite to justify its own optimisation story**, and it will not survive being asked where it came
from.

---

## 5. The board — what each direction invalidates, counted

`[M]` Queried from the outer root `D:/Users/UserC/source/repos/test_mycontext_plugin` via
`node my-context/src/cli/index.ts search --type task --tag plan:ui{1,2,3}`, then each task's `state`
field read individually.

| Plan | Tasks | done | **todo** |
|---|---|---|---|
| ui1 — server and reads | 20 | 15 | **5** |
| ui2 — palette and work | 14 | 1 | **13** |
| ui3 — watch and ask | 15 | 2 | **13** |
| **Total** | **49** | **18** | **31** |

`[R]` The brief says 29 unstarted; the measured figure today is **31**, and the difference does not
matter — what matters is which ones are *browser* tasks, because those are the ones a visual direction
can invalidate.

`[M]` The plans name **25 distinct browser ES-module paths**, at **133 mentions** across the three plan
documents — `public/lib/viewmodel.js` (21 mentions), `public/lib/command.js` (8),
`public/lib/palette-defs.js` (7), `public/lib/config-edit.js` (7), `public/lib/sse.js` (5),
`public/lib/i18n.js` (5), `public/screens/work.js` (5), `public/screens/watch.js` (4),
`public/screens/palette.js` (4), `public/screens/configure.js` (4), `public/screens/ask.js` (4), and
fourteen more.

**The 12 open tasks that are written against those paths, by name:**

| Task | Why a direction change invalidates it |
|---|---|
| `TASK-ui1-task-16-the-app-shell` | Specifies the shell, the hash router and `public/lib/bootstrap.js`. A framework replaces all three. |
| `TASK-ui1-task-17-nav-inj-screens` | `public/screens/{preview,gaps,simulate,injected}.js` |
| `TASK-ui1-task-18-scope-coverage-with-detail-pane-and-print-mode` | `public/screens/coverage.js` **plus the print mode** — §4's `[data-p].printing` mechanism |
| `TASK-ui1-task-19-doctor-decay-status-and-learn-screens` | `public/screens/{doctor,decay,status,learn}.js` |
| `TASK-ui2-task-9-lib-command-js` | `public/lib/command.js` |
| `TASK-ui2-task-10-lib-palette-defs-js` | `public/lib/palette-defs.js` |
| `TASK-ui2-task-11-the-work-screen` | `public/screens/work.js` |
| `TASK-ui2-task-12-the-command-palette-screen` | `public/screens/palette.js` |
| `TASK-ui2-task-13-the-configure-screen` | `public/screens/configure.js` |
| `TASK-ui3-task-10-browser-pure-logic` | browser-side pure logic modules |
| `TASK-ui3-task-11-screens-watch-js-and-window-myctx-stream` | `public/screens/watch.js` + the SSE surface |
| `TASK-ui3-task-12-screens-ask-js` | `public/screens/ask.js` |

**Plus three that are affected without being rewritten:** `TASK-ui2-task-8-e2e` and
`TASK-ui3-task-8-server-wiring-and-the-e2e-proof-that-idle-fires` (the harnesses in §3.4), and
`TASK-ui3-task-9-the-watch-ask-string-keys` (the parity system in §3.5). **Plus three documentation
tasks** (`ui1-20`, `ui2-14`, `ui3-13`) that document whatever ships.

`[R]` The remaining **13 open tasks are server-side** — `src/core/revision-diff.ts`, the work and
configure read models, `src/core/audit-tail.ts`, `src/core/statusline-tee.ts`, the statusline install —
and **no visual direction touches them.** That is the honest ceiling on this whole argument: the worst
case is 12 rewritten and 6 disturbed out of 31, not 31 out of 31.

---

## The case against Direction A — the zero-dependency "restrained instrument"

**The strongest reason not to choose it: it is the only direction whose failure mode is already
measured, and the measurement says restraint has been buying correctness with fabrication.**

`[V]` Four instances, all in the record:

1. `[V]` `test/ui/no-writes.test.ts` — the static half of the no-writes enforcement, which guards the
   product's central security invariant — **parses TypeScript with regular expressions**, and says why
   in its own header: *"Zero runtime dependencies and `erasableSyntaxOnly`: there is no parser library
   to reach for, so this reads source with regexes."* It is careful, it asserts its own soundness
   conditions in both directions, and it is still a hand-rolled parser standing between the UI and a
   write.
2. `[V]` The prior panel's contrast harness normalised colours through a `<canvas>`, which cannot parse
   `light-dark()`, and an invalid `fillStyle` fails silently — producing **645 contrast "failures",
   every one an artefact.** Caught only because it was cross-checked.
3. `[V]` D11 — the `--mono` stack has no Hebrew face, and the prior panel's own note on the fix is that
   it *"needs a font decision the zero-dependency constraint may refuse."* An accessibility defect
   deferred by the constraint rather than by a judgement.
4. `[V]` D12 — a fabricated 57,000-node figure is load-bearing inside the design of record, justifying a
   rule that is correct for other reasons.

`[M]` And the performance case for restraint does not survive measurement: LCP 1,250 ms with 99.7%
render delay, CLS 0.2206, a 783 ms layout pass. `[R]` Restraint here is a **licensing** decision, not a
performance one, and it should be argued on those terms.

**The maintainability charge, which is the one that matters for 31 open tasks.** `[V]` D10:
the type scale is *declared and not enforced* — six declared steps, **fourteen rendered sizes**,
`--fs-4` (22px) used by nothing, smallest rendered text **8px**. `[R]` That happened with one author
across 21 screens and no framework to drift against. There is no component layer, so the only thing
holding 25 hand-written modules to one visual language is a 3,375-line HTML file and whoever is reading
it carefully that day. Three future agents will produce a fifteenth font size, and nothing will go red.

**Where it survives, and it does survive.** `[R]` Direction A passes every gate in §1–§4 by
construction, invalidates **zero** of the 31 open tasks, and is the only direction that can be executed
by an agent who did not design it — because the specification is markup, and markup is copyable.
Its deficit is the owner's actual complaint, and that complaint is legitimate. The correct attack on A
is not that it is wrong; it is that **nothing in it answers the brief**, and it will be tempting to
re-adopt it out of relief that it is safe.

---

## The case against Direction B — the React component system

**The strongest reason not to choose it: `bin` points at a `.ts` file, Node 24 refuses `.tsx`, and the
one compiler flag installed to catch that class of mistake does not catch it.**

`[M]` Measured today, all three:

```
node p.tsx                    → SyntaxError: Unexpected token '<'
node --test t.test.tsx        → ERR_UNKNOWN_FILE_EXTENSION: Unknown file extension ".tsx"
tsc (erasableSyntaxOnly:true) → flags `enum` (TS1294); says NOTHING about <div className="m">
```

`[R]` So the direction requires a build step (§2), the build step has no good owner (§2.3), and
`npm run typecheck` will go green on files that cannot run. Everything below is additional.

**The second reason, and it is separable: the styling story.** `[M]` A `<style>` element injected from a
same-origin script gets `sheet === null` under the shipped CSP. **MUI and Chakra UI are excluded by
that measurement** — both are emotion-based and emotion has no path that is not a `<style>` element or
a nonce, and there is no nonce here. `[R]` Radix survives it, because Radix ships unstyled — but the
usual answer to "Radix is unstyled" is Tailwind, which is a build step, which returns to §2.

**Third: direction becomes a context value, not a DOM fact — and the maintainers have said they will not
change that.** `[M]` Radix issue **#3830** (auto-detect RTL from the HTML document) closed
**`not_planned` on 2026-06-07**; Zag **#2960** (inherit `dir` from parents) closed **`not_planned` on
2026-02-14**; React Aria has **no direction prop at all**, only a locale. `[V]` Three e2e specs assert
the DOM attribute. `[M]` Of eight candidate libraries, **exactly one — Mantine — reads `<html dir>`**
(§3.3). Two sources of truth, and the tests watch the one the library ignores.

**Third-and-a-half, if the proposal is shadcn/ui:** `[M]` **84 physical, direction-unsafe Tailwind
utilities and zero logical ones across all 61 recipes** (§3.3b), against a product with **zero** physical
properties in 2,794 declarations. `[M]` And shadcn ships **`.tsx` source copied into your repository**,
which — given the measurement above — mandates a bundler with no alternative.

**Fourth: portals defeat the print system.** `[V]` `[data-p]{display:none!important}` /
`[data-p].printing{display:block!important}` selects the printed screen structurally. `[M]` Radix's
portal, verified through context7 against `packages/react/portal/src/portal.tsx`:

```ts
const container = containerProp || (mounted && globalThis?.document?.body);
```

`[M]` It defaults to `document.body`, and `Dialog`, `Popover`, `Tooltip` and `Select` all portal
through it. `[R]` Portalled content is outside every `[data-p]`, so it is matched by **neither** print
rule — not hidden by the first, not revealed by the second. It prints on every screen.

`[R]` There **is** a mitigation and I should name it: `container` is a public prop, so a direction could
portal into the currently-printing `[data-p]`. But that has to be threaded through every portal on
every screen, the target changes with the router, and `[V]` nothing in the six e2e specs would catch a
single one that was missed — `print.spec.ts` asserts `body` colours, not portal parentage.

`[M]` One thing that does survive: Radix's popper writes its positioning through the **React `style`
prop** as `--radix-popper-*` custom properties, and React applies custom properties via
`setProperty` — which §1 measured as **ALLOWED**. So Radix positions correctly under this CSP. The
objection is the portal, not the positioning.

**Fifth: the derivation harnesses go quiet.** `[R]` §3.4 in full. `className="m"` does not match
`class="m`; `data-t={key}` does not match `\sdata-t="`. The monospace floor becomes 0 and its assertion
becomes vacuous.

**Sixth: the no-writes walker stops at the package boundary.** `[V]` `test/ui/no-writes.test.ts:438`:
`if (s.spec === null || !s.spec.startsWith('.')) continue;` — bare specifiers are not followed. `[R]`
Today every edge under `src/ui/` is relative, so the walker sees the whole graph and its **equality**
assertion over write bindings is a claim about all of it. The first bare import from `src/ui/` turns
that into a claim about the relative fraction, with no test change and no comment change.

**Seventh:** `[V]` `static.ts` serves four content types. React itself is a `.js` file and fine; source
maps, locale `.json`, icon fonts and `.wasm` are 404.

**Eighth: testing a component costs jsdom.** `[M]` `node --test` cannot load `.tsx` at all, so a
component test needs a loader hook (esbuild or `@swc/core`), a DOM (**`jsdom` — 21 direct
dependencies**), and `@testing-library/react` + `@testing-library/dom` (1 + 8 deps). `[R]` That is a
minimum of five new direct devDependencies pulling an estimated 50–80 transitive packages, into a tree
that has **three**.

**Ninth: the data layer repeals ephemerality.** `[R]` §2.7. TanStack Query's `refetchOnWindowFocus` and
SWR's `revalidateOnFocus` both default to **on**, both hit `/api`, and `[V]` `idle.ts` defines idle as
no non-stream `/api` request for fifteen minutes. A tab left open never lets the server exit.

**The numbers.** `[M]` A comparable dashboard — provider + button + dialog + tabs + table — bundled with
esbuild 0.28.2, minified, React externalised, `gzip -9`, on **2026-08-21**:

| Library | min | **min+gzip** | Reads `<html dir>`? |
|---|---|---|---|
| **Radix UI** 1.6.7 | 55,237 B | **18.1 KB** | no (declined) |
| Headless UI 2.2.10 | 67,355 B | **22.9 KB** | **no RTL code at all** |
| Ark UI 5.38.2 | 74,142 B | **23.6 KB** | no (declined) |
| **Mantine** 9.5.1 | 114,005 B | **33.8 KB + 5.0 KB CSS = 38.8 KB** | **yes** |
| React Aria Components 1.20.0 | 218,522 B | **66.4 KB** (56.7 with locales pruned) | no — locale only |
| Ant Design 6.6.1 | 692,823 B | **218.0 KB** | no |
| Ant Design 5.29.3 | 741,771 B | **229.7 KB** | no |

`[R]` Add the React runtime on top of every row (~40–45 KB gzip, ESTIMATE — bundlephobia's React 19
figures resolve the root re-export shim, not `react-dom/client`, so I will not report them as measured).
`[M]` MUI is not in the table because it is excluded twice over — Emotion needs an injected `<style>`
(§1) and its RTL is a CSSJanus flip (§3.2) — but for scale: `@mui/material@9.3.1` full import is
**153.3 KB gzip**, plus Emotion 13.1 KB, plus `@mui/stylis-plugin-rtl` 2.3 KB, plus `cssjanus` 1.9 KB.

`[R]` The interesting row is the collision between the two columns. **The cheapest option is Radix at
18.1 KB and it declined to read `<html dir>`. The only option that reads `<html dir>` is Mantine, at
twice the size, and it needs a bundler for its CSS.** There is no cell that is both.

**Cost:** 12 open browser tasks rewritten, 3 disturbed, 25 named module paths void.

**What would make it survive.** `[R]` React is not excluded by the CSP — only by the build step and the
harnesses. A **headless** kit (Radix or React Aria), styled by a plain `public/styles.css`, with
**`createElement` and no JSX**, would run under Node's stripper and pass §1. Nobody wants to write
React without JSX, which is the point: the honest version of this direction is *"accept a build step",*
and it should be argued as that rather than smuggled in as a component choice.

---

## The case against Direction C — the distinctive-identity direction

**The strongest reason not to choose it: the three levers identity normally pulls are each already
measured as unavailable here, and the fourth is the one the previous panel spent a real contrast
failure to close.**

**Lever 1 — a typeface. `[M]` Not loadable, and it is locked twice.**

Lock one: `[V]` `src/ui/static.ts:95` CONTENT_TYPES is `.html`, `.js`, `.css`, `.svg`. A `.woff2`
request is refused before it is read.

Lock two, and this is the one that settles it: `[M]` I served a page under the shipped CSP and called
`new FontFace(...).load()` three ways. All three were blocked, and Chrome named the reason:

> `Loading the font 'data:font/woff2;base64,…' violates the following Content Security Policy
> directive: "default-src 'none'". **Note that 'font-src' was not explicitly set, so 'default-src' is
> used as a fallback.** The action has been blocked.`

`[M]` The identical message for **`http://127.0.0.1:7393/x.woff2` — same origin** — and for
`https://fonts.gstatic.com/…`. Three CSP violations, one issue report, zero fonts loaded.

`[R]` So it is not merely that the static server will not serve a font. **Even a same-origin font, served
correctly, is blocked by the CSP**, because `font-src` is absent and `default-src 'none'` catches it.
`img-src` was given `data:` explicitly; `font-src` was given nothing. `[R]` This direction's type story
is therefore limited to system stacks — which is what it already has — and `[V]` D11 records that the
mono stack has no Hebrew face, so the one typographic problem the product actually has is the one this
lever cannot fix. Changing it means changing `static.ts`'s allowlist **and** the CSP string **and** the
test at `server-e2e.test.ts:79` that pins it.

**Lever 2 — motion. `[M]` It costs a media query the product has never had.** Zero transitions, zero
animations, zero keyframes, zero `will-change`, and therefore zero `prefers-reduced-motion`. `[R]` The
absence is currently correct and stops being correct on the first `transition`. `[V]` And the
Playwright config has no reduced-motion project, exactly as it had no dark-print project — which is
how 246 print failures lived behind a green suite. Adding motion here means adding a media query, a
Playwright project, and a pass over 21 screens, and the panel will price the hover state and not the
other three.

**Lever 3 — colour. `[V]` It is spoken for, and re-spending it re-opens a closed failure.** `[V]` The
four semantic accents are mutually indistinguishable by luminance — `--ok` vs `--warn` 1.05:1 light,
1.03:1 dark; `--warn` vs `--dim` 1.01:1 — and the four chip backgrounds sit within 1.01–1.06:1 of each
other. `[V]` What makes the product legible is that `.dot.g` is a **circle**, `.dot.o` a **square**,
`.dot.w` a **dashed outline**, `.dot.n` a **half-opacity circle**, and every chip prints a glyph through
`::before{content:attr(data-g)}`. `[R]` Any identity move that recruits colour back as the signal
un-does that, and it will be tempting, because colour is what "distinctive" usually means.

**Lever 4 — depth and surface. `[V]` It lands on a degradation path that is already incomplete.**
`prefers-reduced-transparency` covers one decorative use and **none of the seven data-carrying ones**;
`forced-colors` flattens the four-tier ribbon to one state and leaves the SVG at ~1.16:1. `[R]` Every
new surface is a new row in both of those tables, and both tables are currently short.

**The maintainability charge, which is the real one.** `[R]` Identity is the least transferable property
on this panel. A token file transfers. A type scale transfers — `[V]` except that it *did not*: D10
measures six declared steps against **fourteen rendered sizes** and one heading larger than the screen
title above it, with a single author and 21 screens. `[R]` "Feel" does not transfer at all, and 12 of
the 31 open tasks are screens that will be written by agents who did not design it. A direction that is
stunning and unreproducible is worse than a plain one that three agents can extend, and this is the
direction where that risk is highest by construction.

**What would make it survive.** `[R]` If the identity is expressed **entirely in tokens, the type scale,
and shape vocabulary** — no webfont, no motion, no new colour semantics — it passes every gate and
invalidates **zero** tasks, because `[V]` the prior panel already established that its own palette,
type and depth recommendations touch no string, no element count and no directional property. That is a
real and available version of this direction. The version that reaches for motion and a typeface is not.

---

## The case against Direction D — the data-first direction

**The strongest reason not to choose it: it concentrates its work on the exact three things this
product measures as most expensive — the chart node, the forced-colors gap, and `matchesScope` — and
the library shelf it would reach for fails the CSP by mechanism.**

**First, charting libraries against the §1 table.** `[M]` `new Function` and `eval` throw `EvalError`;
`WebAssembly.compile` is refused by name; `blob:` and `data:` workers fail; the `style` attribute does
not apply. `[R]` Those four cover most of what a charting library does that is not drawing: runtime
formatter compilation, off-main-thread layout, and per-node `style="…"`. `[V]` And the spec already
wrote the rule this implies — *"every data-driven size is set through the CSSOM
(`element.style.setProperty`), never as a `style` attribute"* — which means a library that emits style
attributes is not configurable into compliance. It is a fork.

**First-and-a-half: ECharts is excluded by a single measured line.** `[M]` ECharts 6.1.0 ships
`new Function('return (' + source + ');')()` in `src/coord/geo/GeoJSONResource.ts:163-165`. `[M]` My CSP
probe: `new Function` throws **`EvalError`**. `[M]` The security report **#21626** was closed
**"not planned"**; the fix, **PR #21640** by an Apache committer, milestone 6.1.1, **is still open**.
`[R]` The constructor is in the full bundle unless `./lib/coord/geo` is tree-shaken out — which requires
a build step, which is §2. `[M]` And ECharts has no RTL either: **#16419 closed "not planned"**, #19609
and #20351 open, and **#21465** (open, Jan 2026) reports that *its own canvas and SVG renderers disagree
with each other on RTL text.*

**Second, on forced-colors: I measured this and the conventional answer is wrong (§4).** `[M]` In
Chromium, `body`, `.card`, `.seg` and `.dot` are all force-adjusted while **SVG `fill` and `stroke` are
not** — the graph keeps `stroke: rgb(147,48,47)` even though `color` on the same element goes to black.
`[R]` So SVG is **not** "catastrophically flattened", and canvas does **not** get a free pass: both keep
their authored colours on a repainted ground. The difference is the remedy — `stroke: CanvasText` inside
the existing `@media (forced-colors: active)` block for SVG, versus
`matchMedia('(forced-colors: active)')` plus a full JavaScript re-render, per chart, forever, for canvas.
`[M]` Chart.js's High Contrast bug, **#10372**, has been **open since 2022-05-24 with zero maintainer
replies**: *"the chart legend and axis labels are not visible clearly."*

**Second-and-a-half: only one charting library has any RTL API, and it does not cover axes.** `[M]`
Chart.js exposes `plugins.tooltip.rtl`, `plugins.tooltip.textDirection`, `plugins.legend.rtl`,
`plugins.legend.textDirection` — **and nothing on scales or axes.** Axis position, tick alignment and
category order do not flip. `[M]` Recharts: a GitHub issue search for `RTL OR "right-to-left"` returns
**no RTL issues at all** — not even a rejected request — and context7 has no RTL documentation for it.
`[M]` visx: one `rtl` hit in the whole repo, and it is a diagonal **hatch pattern**. `[M]` Observable
Plot: the RTL PR **#2396** is still open. `[M]` uPlot: its README does not mention RTL, i18n, print or
accessibility at all.

`[M]` **And Chart.js's canvas sizing is the `style` attribute.** Issue **#8108** (2020-11-26), verbatim:
*"the canvas element still uses a `style` attribute for setting the width and height, which still
requires `style-src 'unsafe-inline'` to work."* Closed with no visible maintainer resolution. `[M]` I
measured the `style` attribute as **BLOCKED** under this CSP.

**Third, tooltips are where `innerHTML` comes back — and it is documented, not incidental.** `[V]` The
mockup's own comment records that `innerHTML` was removed and that *"removing innerHTML did NOT finish
the job, and this comment used to claim it"*. `[M]` Chart.js's docs say, verbatim: *"**Note**: If you need
more visual customizations, please use an HTML tooltip"* — via `plugins.tooltip.external`, whose
canonical sample builds `innerHTML`. The same note appears on the legend. `[M]` ECharts' primary
documented pattern is a `tooltip.formatter` returning an HTML string, with `renderMode: 'html'` as the
default. `[R]` This is a door that was closed once, expensively, and this direction is the one that
reopens it — through the front, as the vendor-recommended path.

**Fourth, strings arrive through the one gap in the parity system.** `[R]` §3.5: "No data", axis
defaults, legend labels, locale number formatting. `[M]` The tables hold **396 keys at exact parity**
with 112 substitution slots; a library's own strings are in neither table nor the mockup, so they are in
none of the three sets `strings-parity.test.ts` compares. They will render English inside a Hebrew page
and the suite will be green. `[R]` For a *data-first* direction this is not a footnote — chart chrome is
where most of a data UI's text lives.

**Fifth, the cost is on the axis already measured as expensive.** `[M]` `svg.chart` is the largest
parent in the document at **109 children**; the largest layout pass is **783 ms over 201 nodes** at 4×
CPU. `[V]` The spec caps the relation graph at 60 nodes, radius 1–2, deterministic layout, no
simulation, for cost. `[V]` Server-side, `matchesScope` over 4,000 paths × 12 patterns is 28.0 ms
uncached / ~2.7 ms cached with a 15 ms asserted ceiling. `[R]` "More data on screen" is the one product
change that pushes on all three at once.

**Sixth, the constraint that is easiest to trip.** `[V]` *"An endpoint may compose existing functions.
It may not reimplement a rule."* `[V]` The spec names the precise trap: the coverage map must call
`matchesScope`, not `matchesAnyGlob`, because an unscoped item matches every path under the default
`scopePolicy` and no path under `inert`, and `matchesAnyGlob` cannot know which — a defect that already
shipped once in `query_items`. `[R]` A denser data direction adds derived figures, and every derived
figure is an opportunity to re-derive a rule.

**Seventh, the numbers.** `[M]` bundlephobia, 2026-08-21, with the RTL verdict beside each:

| | min | **gzip** | direct deps | RTL |
|---|---|---|---|---|
| **uPlot** 1.6.32 | 50,830 B | **21.9 KB** | **0** | none; canvas-only |
| **Chart.js** 4.5.1 | 200,823 B | **68.4 KB** | **1** | tooltip + legend only |
| **@visx/xychart** 4.0.0 | 151,491 B | **49.9 KB** | 16 | none |
| **@nivo/bar** 0.99.0 | 244,367 B | **79.9 KB** | 16 | fragments, no API |
| **Observable Plot** 0.6.17 | 384,511 B | **128.0 KB** | 3 | PR #2396 open |
| **Recharts** 3.10.1 | 566,278 B | **151.5 KB** | **11** | **zero issues, zero API** |
| **@tremor/react** 3.18.7 | 819,716 B | **222.5 KB** | 7 | none (pinned to recharts **2.x**) |
| **ECharts** 6.1.0 | 1,128,161 B | **372.2 KB** | 2 | declined; **ships `new Function`** |
| hand-written SVG, 6 chart kinds | — | ~3–8 KB, ESTIMATE | **0** | native |

`[R]` **Recharts' eleven direct dependencies include `@reduxjs/toolkit`, `immer`, `d3-shape`, `d3-scale`
and `es-toolkit`.** A charting library that ships a state-management library it does not expose is
151.5 KB gzip and a Redux tree, for a job the spec already describes as deterministic layered SVG with a
60-node cap. `[R]` And Tremor is **222.5 KB gzip for a Recharts wrapper** that is pinned to Recharts 2.x
while Recharts is at 3.10.1.

`[R]` The honest shape of that table: the two cheapest options (uPlot at 21.9 KB, Chart.js at 68.4 KB)
are both **canvas**, which §4 shows is the one rendering target with no CSS remedy under forced colors.
Everything with a CSS surface costs 50–372 KB gzip and has **no RTL API whatsoever.**

**Cost:** `[R]` it invalidates the **fewest** open tasks — the screen tasks survive because the screens
survive — but it is the direction most likely to disturb the **13 done** read-model tasks, which is the
more expensive kind of change. `[R]` And like B, a client data layer with focus-revalidation defaults
(§2.7) would repeal the fifteen-minute idle shutdown.

**What would make it survive.** `[R]` Hand-written SVG with `stroke`/`fill` set by CSS class and every
data-driven dimension set through `element.style.setProperty` passes all four gates, keeps the
`forced-colors` fix to one line, prints, and adds no strings. `[V]` That is what the spec already
specifies. The honest question for this direction is whether it needs a library at all, or whether it
needs **more screens of the kind that already exist.**

---

## 6. The cost table

| | **A** — zero-dependency | **B** — React components | **C** — distinctive identity | **D** — data-first |
|---|---|---|---|---|
| **npm dependencies added** | **0** (today: 0 runtime, 3 dev, `[M]` 6 top-level entries) | `[M]` react+react-dom = 3 pkgs, but `radix-ui` = **56 direct**; MUI+emotion = 26 direct; **+ jsdom (21 direct) to test**; `[R]` ESTIMATE **150–300 unique** with a Vite/Tailwind toolchain | 0 if tokens-only; a font pipeline if not | 0 if hand-written SVG; `[M]` chart.js = **1 direct**, recharts = **11 direct** incl. `@reduxjs/toolkit` |
| **Bundle shipped to browser** | `[M]` 31 KB CSS (252 rules) + 96 KB JS uncompressed, as the mockup stands | `[M]` Radix dialog alone **12.6 KB gzip**; MUI full **153 KB gzip** + emotion **8 KB**; + React runtime (~40–45 KB gzip, ESTIMATE) | unchanged if tokens-only | `[M]` chart.js **68.4 KB gzip** full / ~20–40 tree-shaken; **recharts 151.5 KB gzip**; hand-written SVG ~3–8 KB |
| **Build step** | **none** `[V]` | **required** `[M]` — `.tsx` does not run: `SyntaxError: Unexpected token '<'` | none if tokens-only | none if hand-written |
| **RTL verdict** | `[M]` **passes** — 206 logical declarations, 98 direction-dependent, zero physical | `[M]` **fails on the DOM question** — of 8 candidates only **Mantine** reads `<html dir>`; Radix (#3830) and Zag (#2960) closed it **`not_planned`**; React Aria has no direction prop; shadcn is **84 physical / 0 logical** | `[R]` **passes** if tokens-only. `[M]` A flip pass is the hazard: rtlcss *ignores* logical CSS but **negates `transform`**, so `inset-inline-start:50%` + `translateX(-50%)` double-flips by 100% of width | `[M]` **weakest of the four** — only Chart.js has an RTL API and it covers tooltip + legend, never axes; Recharts has **zero RTL issues in its entire history** |
| **Print verdict** | `[V]` passes; the standing dark-print defect (246 vs 17) is one `color-scheme` line | `[M]` **fails as specified** — Radix `Portal` defaults to `document.body`, outside every `[data-p]`; `.pop` is hidden outright | `[R]` each new surface is a new print liability | `[R]` SVG prints; canvas prints at whatever DPR it was composited at |
| **`forced-colors` verdict** | `[M]` incomplete but **fixable in CSS** — `.seg`/`.dot` flatten (measured); SVG `fill`/`stroke` are **not** force-adjusted, so `stroke: CanvasText` fixes it in one line | `[R]` a library's own component CSS is a new surface the existing block does not name | `[R]` worsens it — every new depth treatment is a new row | `[M]` **SVG is fixable in one CSS line; canvas needs `matchMedia` + a JS re-render per chart.** Chart.js's HC bug **#10372 has been open since 2022 with no maintainer reply** |
| **`prefers-reduced-motion`** | `[M]` absent and correct — 0 transitions/animations/keyframes | `[R]` most kits ship animated open/close; the query becomes mandatory | `[R]` **this is the direction that incurs it** | `[R]` incurred if charts animate in |
| **Web font available?** | `[M]` **No — for any direction.** Chrome: *"`'font-src'` was not explicitly set, so `'default-src'` is used as a fallback."* Blocked for `data:`, cross-origin **and same-origin** alike | same | `[M]` **this is the direction that needs one, and cannot have one** without editing the CSP, `static.ts` and the pinning test | same |
| **Ephemerality (15-min idle shutdown)** | `[V]` intact | `[R]` **repealed** by TanStack Query / SWR focus-revalidation defaults | `[V]` intact | `[R]` repealed if a client data layer is adopted |
| **The two derivation harnesses** | `[V]` intact | `[R]` **go vacuously green** — `className="m"` ≠ `class="m`, `data-t={k}` ≠ `data-t="` | `[V]` intact (styling only) | `[V]` intact unless markup generation changes |
| **396-key parity** | `[V]` intact | `[R]` library strings sit outside all three compared sets | `[V]` intact — no recommendation adds visible text | `[R]` chart chrome is text, and it lands in the gap |
| **Open tasks invalidated** (of 31) | **0** | **12 rewritten, 3 disturbed, 3 docs** | **0** if tokens-only | **0–2**, but most likely to disturb the 13 *done* read-model tasks |
| **`npm run typecheck` (6.66 s today)** | unchanged | `[M]` goes green on files Node cannot run — `erasableSyntaxOnly` flags `enum`, not JSX | unchanged | unchanged |
| **`node --test` (189 files)** | unchanged | `[M]` **cannot load a `.tsx` at all** — `ERR_UNKNOWN_FILE_EXTENSION` | unchanged | unchanged |
| **Who can maintain it** | `[R]` any agent — the spec is copyable markup. But `[V]` D10 shows it already drifted to 14 sizes from 6 with one author | `[R]` an agent who knows React **and** this repo's build; the smallest pool on the panel | `[R]` **narrowest** — "feel" does not transfer; the designer, or nobody | `[R]` wide if hand-written SVG; narrow if a chart library's config surface |

`[M]` = measured on this worktree today. Bundle-size cells marked with a runtime rather than a number
are the ones I would not put a figure on without installing, which I will not do — `node_modules` here
is a junction to the real checkout.

---

## 7. What survives, plainly

`[R]` **A survives every gate and answers none of the brief.** It is correct and it is the reason this
panel exists. Adopting it again is a decision to accept the current appearance, and it should be taken
as that decision rather than arrived at by elimination.

`[R]` **C survives, conditionally, and it is the one I would put money on.** Restricted to tokens, the
type scale, depth on an allowlist, and shape vocabulary — **no webfont, no motion, no new colour
semantics** — it passes §1–§4, invalidates **zero** of the 31 open tasks, and is the only direction that
can change how the product looks without changing what it is. The condition is not a technicality: the
moment it reaches for a typeface or a transition it acquires a servable-asset problem and a media query
the suite cannot currently see.

`[R]` **D survives if it does not reach for a chart library.** Hand-written SVG, classes not style
attributes, dimensions through `setProperty`. `[V]` That is what the spec already says. If D's answer is
"more and better screens of the kind that exist", it is strong. If its answer is a library, §1 and the
canvas argument end it.

`[R]` **B does not survive as stated.** Not because React is heavy — because `bin` points at a `.ts`
file, `[M]` Node refuses `.tsx`, `[M]` `node --test` cannot load one, `[M]` the flag that exists to catch
that does not, and `[M]` of eight candidate libraries exactly **one** reads the `dir` attribute the whole
product and its e2e suite are built on. `[M]` Node's own tracking issue for JSX support, **#56822**, was
**closed as stale on 2026-08-09 — twelve days ago** — so this is not a "coming soon".

`[R]` There are two honest versions and the panel should make B pick one out loud:

- **"Accept a build step."** Then the argument is §2, and it is winnable — but it must be argued as a
  change to how the product is built and shipped, not slipped in as a component choice.
- **"No build."** Then it is not React. `[M]` **Preact + `htm`** is the shape that survives: 2 packages,
  0 dependencies between them, tagged templates that are plain ES2015, and — verified by reading
  `htm@3.1.1`'s published source — **no `eval`, no `new Function`**, so it clears §1's `EvalError` gate.
  `[R]` Or Lit without decorators, whose `css` templates attach through `adoptedStyleSheets`, which
  §1 measured as **ALLOWED**. Neither is on this panel, and one of them probably should be.

`[R]` And if B insists on a component library, the least-bad candidate is not the popular one. `[M]`
**Mantine** is the only library that reads `<html dir>`, at 38.8 KB gzip with per-component CSS, ships
**7** English strings in total, and is `[M]` 56 `margin-inline*` / 94 `padding-inline*` / 70
`inset-inline*` against **zero** `margin-left`/`margin-right` in its shipped sheet. `[R]` Its costs are
real and should be stated: it needs a bundler for its CSS, its detection runs in an effect so SSR/first
paint is LTR, `setDirection` writes to `document.documentElement` so **an RTL subtree cannot be scoped**,
and `[M]` its current release 9.5.1 has a live RTL regression — `Drawer position="right"` renders on the
physical **left** under `dir="rtl"`, because `DrawerRoot.mjs` sets `--drawer-justify: flex-end`, which is
direction-relative, while `rtlTransitions` animates it `slide-right`. `[M]` Fixed in master 2026-08-15;
**not in the published release.** `[R]` Which is the whole lesson: mantine.dev claims *"All Mantine
components support right-to-left direction out of the box"* with no caveats, and the caveat is shipping.

---

## 8. What the previous panel got right, and must not be spent

`[V]` **Shape carries meaning; colour is redundant.** `.dot.g` is a circle, `.dot.o` a square, `.dot.w`
a dashed outline, `.dot.n` a half-opacity circle, and every chip prints its glyph through
`::before{content:attr(data-g)}`.

`[R]` This is the most valuable decision in the record and it is the one most at risk from a panel
convened to produce *wow*, for three reasons:

1. **It was paid for.** `[V]` `--gold` vs `--ok` measured 1.04:1 and now measures 1.30:1 light / 1.43:1
   dark — still under 3:1. The four accents remain mutually indistinguishable by luminance. The colours
   were never fixed; the **encoding** was changed so that they did not need to be.
2. **It is the only thing that survives all four degradation modes at once.** `[V]` A glyph is
   `content`, and content is not forced — so the chips survive `forced-colors` where the ribbon does
   not. A shape survives a monochrome printout where a hue does not. `[V]` The prior panel corrected its
   own predecessor here and the correction strengthens the point: the luma spread is 31 levels in light,
   not 5, and 1 level between `--ok` and `--dim` in dark — so the hues are *worse* than believed in the
   place that matters, and shape is what makes the printout legible either way.
3. **It is invisible in a prototype.** A single beautiful screen shows the colours and hides the
   redundancy, because redundancy only pays when one channel fails. Every one of the four directions can
   produce a prototype that looks better than the mockup by quietly making colour load-bearing again,
   and nothing in the suite will catch it.

`[R]` **The rule to write down before any direction is chosen, in one line:** *no new component may
signal state by colour alone; every state that has a colour must also have a shape, a glyph, or a
pattern.* `[V]` The prior panel said the same thing and gave the reason — the current position is not a
defect *while shape is redundant*, and becomes one the moment it is not. It belongs in writing before
twelve screens are built, not after.

---

## 9. The one question to ask each expert — the one their prototype will not answer

Each of these is chosen because a prototype is **one screen, opened from `file:`, in English, on
screen, in light mode, on a fast machine** — and every gate in this document lives outside that
envelope.

**To A, the zero-dependency direction:**
> Your prototype is one screen you designed and it is consistent. `[V]` D10 measures fourteen rendered
> font sizes against six declared, from one author across twenty-one screens. **What in your direction
> would have gone red at the seventh size** — and if the answer is "review", say who reviews, given that
> twelve of the remaining screens will be written by agents.

**To B, the React component system:**
> **Which line of your prototype reads `document.documentElement.dir`?** `[M]` Of eight candidate
> libraries only Mantine does; Radix (#3830) and Zag (#2960) closed that request **`not_planned`**, and
> React Aria has no direction prop at all — only a locale. `[V]` Our language toggle sets the attribute
> and three e2e specs assert it. Then, not "does it build": show me **from a clean clone with no prior
> build** that `npm ci && npm run typecheck && npm test` is green, say who runs the build and where the
> output lives given `[V]` `.gitignore` already ignores `dist/`, and `[M]` show me your dialog
> **printed** — it portals to `document.body`, outside every `[data-p]`, and the print block hides
> `.pop` outright.

**To C, the distinctive-identity direction:**
> **Name every font family your prototype paints in, and tell me which is not already on the machine** —
> because `[M]` a web font does not load here at all, not even served from our own origin: Chrome's
> refusal is *"'font-src' was not explicitly set, so 'default-src' is used as a fallback"*, and lifting
> it means editing the CSP string, `static.ts`'s allowlist and the test that pins the header.
> Then four screenshots of the same screen, not one: **in Hebrew**, under **`forced-colors: active`**,
> **printed from the dark theme**, and under **`prefers-reduced-motion: reduce`**. `[V]` The last is a
> query that does not exist in the product today because there is no motion in the product today — so
> if your prototype has any, say which of the twenty-one screens now needs it and which **Playwright
> project** will catch it, because `[V]` the config pins `colorScheme: 'light'` and `locale: 'en-US'`,
> and that is exactly how 246 dark-print failures survived a green suite.

**To D, the data-first direction:**
> `[M]` Your prototype almost certainly ran without a CSP, because a `file:` page has none. Serve it
> under `default-src 'none'; script-src 'self'; style-src 'self'` and show me the same chart — knowing
> that `[M]` `new Function` throws `EvalError`, `WebAssembly.compile` is refused by name, `blob:` and
> `data:` workers fail, an injected `<style>` gets `sheet === null`, and `style="…"` does not apply.
> **Then name every user-visible string your charts draw** — "No data", axis and legend defaults,
> number formatting — and tell me which of the 396 keys each one is.

**And to all four, the question that is really one question:**
> `[M]` There are **31 open tasks**, **12** of them browser screens, and they will be executed by agents
> who did not design your direction, against `[V]` a 3,375-line mockup that is the specification. **Show
> me one of those twelve, written by someone else, against your direction.** Not the screen you designed
> — the next one.

---

## Appendix — method, and where I was wrong

`[R]` Two things in this report changed after I measured them, and both are recorded rather than
quietly corrected, because a panel that hides its own reversals is asking to be trusted rather than read.

1. **The CSP probe, first attempt.** I probed `eval` and `new Function` through the DevTools protocol and
   got "allowed". That is wrong: **CDP evaluation is exempt from the CSP eval check.** Re-run from a real
   same-origin `<script src="/probe.js">`, both throw `EvalError`. Every §1 row is from the second
   harness. `[R]` This is the same shape of mistake the prior panel recorded about its canvas colour
   parser, and it is worth naming twice: **a measurement harness is exactly as capable of asserting a
   property the code does not have as a product is.**
2. **Forced colors, and SVG.** I wrote, and one of my research threads confirmed from the spec text, that
   SVG `fill`/`stroke` are force-adjusted and canvas escapes — so SVG charts would be catastrophically
   flattened. `[M]` Measured in Chromium with `forcedColors: 'active'`, that is **false**: `color` on an
   SVG element is forced to black while `fill` and `stroke` beside it are untouched. The repo's own D7
   finding was right and the spec-reading was wrong for this engine. §4 carries the measurement and the
   caveat that it is engine-specific.

*Measured 2026-08-21 on `v2/dir-adv`, read-only over the product; nothing in the mockup, the string
tables, the specs or the plans was edited to produce this. I did not read the other four experts'
prototypes — a `dir-c` prototype appeared in the shared browser mid-session and was left unopened.
No package was installed: `node_modules` in this worktree is a junction into the main checkout, and
every registry figure came from `npm view` / bundlephobia reads.*

*Browser work: Chrome DevTools MCP — performance trace at 1280×900 / 4× CPU throttle, DOM and CSSOM
enumeration, a twenty-toggle stability run, and a same-origin CSP capability probe served from a
throwaway `node:http` server on `127.0.0.1`; plus Playwright 1.62 / Chromium driven directly for the
`forcedColors: 'active'` comparison, which the DevTools `emulate` tool does not expose. Node work: Node
24.14.0 and TypeScript 5.9.3 from the repository's own devDependencies. Board figures:
`mycontext search --type task --tag plan:ui{1,2,3}` run from the outer root
`D:/Users/UserC/source/repos/test_mycontext_plugin`.*

*Skills consulted per `RULE-ui-work-consults-every-installed-design-frontend-and-browser`:
**`chrome-devtools-mcp:a11y-debugging`** (shaped the DOM/contrast/tap-target probing and the use of
`list_console_messages` with `types: ["issue"]`, which is what surfaced Chrome's verbatim `font-src`
refusal), **`chrome-devtools-mcp:debug-optimize-lcp`** (the LCP-subpart breakdown and the 4× CPU /
reload-trace method in §4.1), **`chrome-devtools-mcp:memory-leak-debugging`** (the retained-node framing
behind the twenty-toggle run in §4.2), **`webapp-testing`** and
**`frontend-excellence:frontend-optimizer`** (the build-step and bundle costing in §2), and **`context7`**
for library facts (`radix-ui/primitives`, `recharts/recharts`), supplemented by direct reads of published
package sources and GitHub issue history where context7 had no answer.*
