# Direction B — the component system

`reports/design-panel/dir-b/prototype.html` is a self-contained, built single-file HTML
document (React 19 + a small library stack, bundled by Vite, everything inlined — no CDN,
no network, `file://`-safe). It renders the **Injection preview** screen (mandatory, all
four experts build it) and **Audit stream** (my second screen), in **English and Hebrew**,
**light and dark**, with **motion actually running**. Built in the scratchpad at
`.../scratchpad/agents/dir-b/build/`; nothing was installed into the repository or its
`node_modules` junction.

**Read this straight: the library stack bought less than the brief that reopened this
argument implied it would, and it bought it at a real, measured byte cost.** Section 6 says
exactly how much, and where it went.

---

## 1. The stack, and why each piece is here

| Package | Used for | Why it earned its place |
|---|---|---|
| `react` 19 / `react-dom` 19 | Everything | Component state replaces module-scope globals; leaf-level i18n subscription (§5) is the concrete win over the vanilla mockup's `HEB=true` re-running all 21 `renderX()` |
| `radix-ui` (unified) — `Direction`, `Select`, `Popover`, `ToggleGroup` | Event selector, session/focus popovers, gate-ladder candidate picker | `RovingFocusGroup`'s direction-aware arrow keys (measured, §2) and Popper's collision-aware, RTL-correct positioning |
| `react-aria-components` — `I18nProvider`, `Virtualizer`+`ListLayout`+`ListBox` | RTL locale signal (Audit stream only needs this for the list); keyboard-accessible virtualized audit feed | The ONE place a plain primitive could not do the job: `aria-activedescendant` over a virtualized list is hard precisely because a virtualizer is also in play, and this is the reference-quality solution rather than composing two libraries not built to agree |
| `motion` (`motion/react`), `LazyMotion`+`domAnimation`, `strict` | Exactly one `m.div` — the session/focus popover's entrance | Deliberately minimal; see §3 for why almost nothing else in this build uses it, and §6 for what it cost anyway |
| **Not used**: `react-router-dom`, any state library, `@tanstack/react-virtual` | — | See §2/§4/§6 — each was evaluated and rejected or superseded on its merits, not skipped |

**No state library.** `useState` + three `useContext` providers, split by **change
frequency**, not by "how global it feels" (Context has no selectors — bundling volatile
with stable state re-renders every consumer on every change to either):

- `ThemeProvider` — theme, fed by `prefers-color-scheme` via `useSyncExternalStore` with a
  primitive `getSnapshot` (an object literal there would re-render everything, every render
  pass — React calls `getSnapshot` to detect tearing on every pass, not only on `subscribe`).
- `LocaleProvider` — language + `dir`, split from theme on the component-architect
  advisory's finding that a language toggle should invalidate text-bearing leaves and
  nothing else; `dir` is set imperatively on `<html>` in the same setter that changes
  language, never from a `useEffect` treating a side channel as render output.
- `SessionProvider` — session id + focus target only. **Not route** — a state-manager
  advisory defect I would have shipped: my first draft bundled `screen` into this provider
  alongside focus/session, which is a second source of truth for the same value the hash
  router already owns.

Route is `useHashRoute()`, its own `useSyncExternalStore` over `hashchange`
(`src/lib/hash-router.ts`), never a Context: `getSnapshot` returns the raw hash **string** —
a primitive, which cannot tear — and parsing is pushed downstream into a per-consumer
`useMemo`. `react-router-dom@7` measures 61.7KB gzip (not v6's ~10KB reputation) for ~21
flat screens with no nesting and no data loaders; not worth it.

The **audit ring buffer** (`src/lib/audit-store.ts`) is the one place store-shaped
architecture is earned — hand-rolled, not a library. Fixed-capacity ring (8,000 records) +
separate `totalSeen`; pushes coalesced on `requestAnimationFrame` (SSE-shaped arrival is
independent async ticks — React's own batching does not save you, 100 records/sec becomes
~100 renders/sec without this); `getSnapshot` returns a **cached, versioned snapshot
pointer**, swapped once per flush — never the live mutable array (stale reads) and never a
freshly-filtered array computed inside `getSnapshot` (infinite-loop or force-render-everyone,
since `getSnapshot` runs on every render pass). Per-kind arrays are written at push time so a
filter switch is instant. Connection lifecycle is a 5-state map, not a state-machine library.
It is genuinely running — the Audit stream screen has a real 1.4s-interval simulated feed and
a seeded history, all flowing through this store.

## 2. RTL verdict — measured, not assumed

**Radix ignores `<html dir="rtl">`.** Read directly from the installed
`node_modules/radix-ui`'s `@radix-ui/react-direction` source: `useDirection` is `localDir ||
globalDir || 'ltr'` — a hardcoded LTR fallback. `<html dir="rtl">` does nothing to it; the
document-level attribute is never consulted. `DirectionRoot` (`src/lib/direction.tsx`)
wraps `Direction.Provider` explicitly, fed by the same `LocaleProvider` signal that also
sets `<html dir>` and drives `react-aria-components`' `I18nProvider`.

**I tested the positive claim empirically, not just by reading source.** With the UI in
Hebrew, I focused the gate-ladder's `ToggleGroup` on its first item (`STD-...`, DOM index 0)
and pressed `ArrowLeft`. Focus moved to `document.activeElement.textContent ===
"ADR-markdown-plus-disposable-index"` — index 1, the **next** item in DOM order. Under LTR,
`ArrowLeft` moves to the *previous* item; this is `RovingFocusGroup`'s direction reversal,
genuinely firing, and it only fires because `DirectionRoot` is there — I did not additionally
re-test the negative case (removing the provider) to double-confirm by omission, but the
source inspection plus this positive result corroborate each other.

**Everything else was checked by looking, not just building and hoping:**
- CSS Grid's column order (`.app`, `.stripe`) is direction-aware natively — verified in
  screenshots: the nav rail, topbar controls, and the Delivered-table/Literal-panel pair all
  swap sides correctly under `dir="rtl"` with zero extra rules, because I never hardcoded a
  physical column order.
- The tier-chip glyph (`◆`/`●`) visually moved from before the label to after it under RTL —
  correct, and it is *only* correct because I never special-cased direction in the component;
  the flex child order plus `direction:rtl` did it.
- `box-shadow` offsets are **not** logical-property-aware (no `inset-inline-start` variant
  exists) — I used `border-inline-start` for the active-nav indicator specifically to avoid
  needing a `[dir="rtl"]` override, which the shipped mockup does need for the same
  indicator. This is a real category of bug logical-properties discipline alone does not
  catch; a stylelint rule banning `left`/`right` literals would not have caught it either,
  since `box-shadow`'s offset isn't such a property.
- **One real gap I found and fixed, not one I'm claiming clean:** the audit stream's "what"
  column (free-form log text — commands, paths) was inheriting the RTL row's start-aligned
  flow, which is technically legible but structurally wrong for text whose direction the UI
  does not control. Wrapped in `<bdi>` (§5's design system already declares
  `bdi{unicode-bidi:isolate}` globally; I just hadn't applied it there). This is exactly the
  category the corpus's own RTL notes call out: "every library reviewed has at least one
  dated real RTL bug on record" — mine did too, and it's a **prose isolation** bug, not a
  library bug.
- `react-aria-components`' `I18nProvider` is doing real work too — it is what makes
  `Virtualizer`+`ListBox`'s internals RTL-aware, not just `Direction.Provider`; the two
  providers are not redundant, they cover different library ecosystems and both were needed.

**What I did NOT build or verify:** Radix Popover's collision-aware repositioning under RTL
at a real viewport edge (I only confirmed it opens on the correct side, `align="start"`, in a
centered layout); the literal panel's own bidi handling for a **Hebrew-authored corpus**
(mine is English-only demo data, deliberately — see the code comment in `LiteralPanel.tsx`);
and Popover focus-trap-and-restore across the RTL flip specifically. These are gaps, stated
as gaps.

## 3. Motion vs View Transitions — the finding held, precisely

**Screen navigation uses the native View Transitions API, not Motion.** Motion's `x:` /
`translateX` compiles to a CSS `transform`, and `dir="rtl"` never mirrors a transform — every
slide axis needs its sign inverted by hand, and Hebrew as a live toggle makes that
per-animation surface area, not a one-time fix. `startViewTransition` interpolates
already-laid-out boxes instead of operating in transform space, so with logical CSS (this
stylesheet has none of the sides `left`/`right`/`top`/`bottom` used physically outside two
audited `box-shadow` cases) it cross-fades two already-correct snapshots with no
axis-inversion failure mode to have. Verified: navigating rail→"Audit stream" under `dir=rtl`
produced zero console errors and a clean transition; `usePrefersReducedMotion()` (its own
`useSyncExternalStore` over `matchMedia`) falls it back to a plain hash change.

**The budget ribbon's segment widths animate on plain CSS `transition: inline-size`** — no
JS, no library. `inline-size` is a layout property, not a transform; it mirrors under RTL for
free, and a spring library would have bought nothing here a browser doesn't already do.

**Motion is used exactly once**, deliberately: the session/focus popover's entrance
(opacity + scale only — never a translate axis, so nothing for `dir=rtl` to get backwards).
This is the frequency law working as designed (Linear's rule, carried into this build): an
occasional action (opening a popover) is allowed the animation a 100-times-a-day action
(selection, filtering, keyboard nav — none of which animate anywhere in this build) is
denied. One real integration gotcha, found and fixed: Radix's Popper positions
`Popover.Content` via its own inline `transform`, recalculated on scroll/resize; putting
Motion's `scale` on the *same* node means two libraries fighting over `style.transform` on
one element. Fixed by nesting — Radix's transform stays on `Content`, Motion's `m.div` is
the child underneath it, never the same node.

## 4. What I evaluated and did NOT use

- **`@tanstack/react-virtual`** was installed by the prior advisory round and I planned to
  use it for the Audit stream. Once I actually needed `aria-activedescendant`-correct
  keyboard navigation over the virtualized list — not just fast scrolling — I found
  `react-aria-components` ships its own `Virtualizer`+`ListLayout` that composes natively
  with `ListBox`'s existing collection/focus model. `@tanstack/react-virtual` is never
  imported anywhere in `src/` (grep-verified); it costs 0 bytes in the shipped bundle since
  nothing references it, but it should be dropped from `package.json` — dead weight, an
  honest cleanup item this report is surfacing rather than quietly leaving.
- **No state library**, detailed in §1 — Zustand/Jotai/TanStack Store/Redux Toolkit/XState
  all evaluated against this app's actual shape (≈8 enumerable globals, no writes, no fan-out
  problem) and all rejected on the same grounds the prior advisory found: correct against its
  own interest, and I did not find a case in *building* the thing that reopened it.

## 5. What happens to the 396-key string system

This prototype implements a **working subset** (~95 keys) of the real product's 396-key,
EN/HE, three-brace-grammar system (`{name}` bidi-isolated value slot, `{mv:name}` the same
but mono, `{m:...}` literal mono text identical in both languages) — `src/lib/strings.ts`,
`src/lib/locale.tsx`. Most of those ~95 keys are **transcribed verbatim** from the real
`src/ui/public/strings/{en,he}.js` — the design of record's own translations, not
re-authored — for every string this prototype's two screens actually render; a handful of
new keys (the literal panel, which the shipped mockup does not have) are added under their
own namespace in the same grammar, with their own Hebrew.

**The mechanism, concretely:** `useT()` is called at the **leaf**, not threaded down as a
prop from a container — `RungRow` calls `useT()` itself rather than receiving a translated
string, so a language toggle re-renders text-bearing leaves and nothing else. This is the
specific, named reconciliation win over the shipped vanilla-JS mockup, which re-runs all 21
`renderX()` functions in full on every `HEB=true` flip. A second hook, `useTStr()`, exists
because `aria-label`/`title` are contractually plain strings — `ReactNode` cannot go there —
degrading the same template to text-only substitution.

**What real 396-key parity would need, honestly:**
1. Port the full `en.js`/`he.js` tables into `strings.ts` (mechanical — same shape, more
   rows).
2. `test/ui/strings-parity.test.ts` — the real bidirectional key-coverage test against
   `docs/design/web-ui-mockup.html`'s `data-t`/`data-t-aria`/`data-t-title` declarations — is
   **completely untouched and unaffected** by this prototype; it tests a different corpus
   (the mockup + the shipped string tables) and this prototype never modified either.
3. **If this direction were adopted**, that test's *pattern* — not its file — would need a
   new source of truth to check against, since there is no `data-t` DOM attribute in a React
   tree calling `t('key')` from inside component logic. The replacement is mechanically
   easier, not harder: a TS AST walk (or even a regex over `t\(['"]([\w.]+)['"]` call sites)
   finds every key a component actually asks for, which is a more reliable enumeration than
   grepping HTML attributes was.
4. **A concrete upgrade I did not build here**: `STRINGS`'s type is `Record<Lang,
   Record<string, string>>` — a typo'd key degrades to a visible `⟨key⟩` at runtime, not a
   compile error. Typing `TranslationKey` as a literal union and indexing both language
   tables by it turns every missing/misspelled key into a `tsc` failure, which is strictly
   stronger than the current runtime-visible fallback and easy to add.

## 6. The build step, and the bundle size actually produced

**Build step, stated plainly:** Vite 7 + `@vitejs/plugin-react` + `vite-plugin-singlefile` +
TypeScript, in a `package.json` scoped entirely to `.../scratchpad/agents/dir-b/build/` —
never installed into the repository or its `node_modules` junction. `vite-plugin-singlefile`
inlines the JS/CSS bundle as `<script>`/`<style>` tags rather than emitting hashed
`<script type="module" src=...>` references, which is also the honest fix for `file://`: a
normal Vite build's module-script semantics break under `file://`'s same-origin
restrictions, and pointing `baseURL` at a real server (what production does anyway) was the
alternative the prior advisory named. **Nothing is committed to the repo except the one
built `prototype.html`** — this file, produced by a build step that exists only in the
scratchpad, is the entire "committed `dist/`" decision for this prototype. A real adoption
would still face that decision for the shipped product: commit built assets (clone-and-run,
minified diff noise) or add an operational build dependency the zero-runtime-dependency CLI
does not have today.

**The shipped bundle, measured directly from the actual build, not estimated:**

| | Raw | Gzip |
|---|---|---|
| **Final shipped `prototype.html`** | **566.76 KB** | **181.19 KB** |
| Before `motion` was wired in anywhere (react 19 + radix-ui[Select/Popover/ToggleGroup/Direction] + react-aria-components[I18nProvider/Virtualizer/ListLayout/ListBox] + all app code) | 490.62 KB | 154.64 KB |
| **Motion's measured delta** (`LazyMotion`+`domAnimation`, `strict`, exactly one `m.div`) | **+76.05 KB** | **+26.53 KB** |

**The honest finding: Motion cost more than the prior advisory's estimate, and the reason is
specific, not vague.** The estimate was "`LazyMotion` + `domAnimation`: ~4.6KB initial +
~15KB async chunk" — the ~15KB is supposed to be deferred to an async chunk, loaded only
when a `m.*` component first mounts. **`vite-plugin-singlefile` disables code-splitting by
design** (`cssCodeSplit: false`, everything forced into one file) — the exact mechanism this
prototype's whole delivery format requires (a single self-contained HTML file) is the
mechanism that defeats `LazyMotion`'s entire lazy-loading value proposition. In a
code-split build, the ~15KB chunk genuinely would not ship until the popover first opens; in
this one, it ships in the initial payload regardless, for a feature used exactly once. **This
is the single clearest "bought less than expected" line in this whole report.**

**A second, larger, more surprising number**, from a per-module bundle analysis
(`rollup-plugin-visualizer`, proportional pre-minify attribution — these percentages are
relative-size evidence, not additive to the two real gzip numbers above, since gzip does not
distribute linearly across concatenated modules):

| Group | Share of pre-minify bundle |
|---|---|
| `react` + `react-dom` + `scheduler` | 36.3% |
| `react-aria` + `react-stately` + `react-aria-components` + `@internationalized` | **28.9%** |
| `motion-dom` + `framer-motion` + `motion-utils` + `motion` | 14.6% |
| `@radix-ui/*` (all four primitives + their shared internals) | 9.6% |
| `@floating-ui/*` (pulled in by Radix's Popper) | 4.4% |
| **This prototype's own code** — every screen, component, hook, and the fixture data | **3.7%** |

**`react-aria-components` costs more than the entire `radix-ui` stack (all four primitives:
Select, Popover, ToggleGroup, Direction) plus the Floating UI it pulls in — combined** (28.9%
vs. 14.0%), for exactly one feature earned from it beyond the RTL locale signal: a
keyboard-accessible virtualized list. Four working, fully-wired interactive primitives from
Radix cost proportionally *less* than one virtualized listbox from React Aria. That is not
what I expected going in, and it is the second "less than expected" finding this report
owes: **react-aria-components is the single most expensive dependency in this build relative
to what it was asked to do**, and I would not reach for it again for a feature this narrow —
`Virtualizer`+`ListLayout`+`ListBox` earns its place only because the alternative (composing
`@tanstack/react-virtual` with hand-rolled `aria-activedescendant`) was flagged as genuinely
hard, not merely inconvenient.

**What this prototype's own code costs: 3.7%.** The overwhelming majority of every byte
shipped is library infrastructure — focus management, collision detection, i18n plumbing,
collection/virtualization machinery — not this screen's actual logic. That ratio is the
honest answer to "what does the library stack buy": it buys infrastructure this app would
otherwise have to hand-build (and the RTL/a11y findings in §2 suggest hand-building focus
trap, roving tabindex, and virtualized `aria-activedescendant` correctly is genuinely hard,
not merely tedious) — at a cost of ~96% of the bundle being that infrastructure rather than
this product's own screens.

## 7. What the unstarted UI tasks would be re-planned into

I did not have access to whatever produced the "29" figure in the panel brief. What I could
verify directly, against git history: the three shipped UI plan documents
(`docs/superpowers/plans/2026-08-16-web-ui-{1,2,3}-*.md`) declare 20 + 14 + 13 = 47 tasks;
cross-referencing every `## Task N` heading against `git log --all` (both the `"ui1/ui2/ui3
task N"` merge-commit convention and earlier differently-worded commits, keyword-matched
per task title) shows **31 unstarted**: 5 remaining in plan 1 (`web-ui-1`, tasks 16–20 —
tasks 1–15 are merged), 13 in plan 2 (`web-ui-2`, only task 1 merged), 13 in plan 3
(`web-ui-3`, only prep tasks 0/0b merged, none of the numbered 1–13). I'm reporting my own
directly-verified count and method rather than asserting a number I couldn't check.

**Of those 31, most are not screen-rendering work at all** and are entirely unaffected by
this direction's stack choice — they are `src/ui/*.ts` server-side read-model and route
handlers (ui2 tasks 2–10: `/api/revisions`, `/api/search`, `/api/overlap`, `/api/config`,
etc.; ui3 tasks 1–8: `audit-tail.ts`, `statusline-tee.ts`, the SSE bridge command). A
component-library decision changes nothing about a Node route handler.

**The subset that IS screen-rendering work, and how each would re-plan:**

- **ui1 Task 16** (app shell — bootstrap, heartbeat, i18n, router, exit banner) — this task's
  entire scope is what `main.tsx` + the three providers + `hash-router.ts` + `DirectionRoot`
  already *are*. Re-planned as: adopt this provider stack, add a small heartbeat hook.
- **ui1 Task 17** (nav.inj screens: injection preview, budget simulator, injected now) — one
  of its three screens is what this prototype built. The other two reuse the same
  `GateLadder`/`BudgetRibbon`/`EventSelect` components already proven out here; the budget
  simulator additionally needs a Radix `Slider` (already in the same unified package, zero
  new dependency).
- **ui1 Task 18** (scope coverage tree + detail pane + coverage gaps + relations) — a
  filterable file tree with roving keyboard nav is exactly the case the RTL research flagged
  as "worth taking from a library" (subtle bugs, not simple ones); `react-aria-components`
  ships a `Tree`/`TreeItem` built for this, already paid for once `I18nProvider` is in the
  tree.
- **ui2 Tasks 11–13** (Work screen, command palette, Configure screen) — the command palette
  specifically is a `cmdk`-shaped feature, and `cmdk` was flagged in the prior research as
  RTL-safe by construction (its keyboard model is vertical-only, so there is no
  Arrow-Left/Right to get backwards) — a good, narrow addition for exactly that screen, not a
  blanket recommendation.
- **ui3 Task 9** (string keys) — directly extends `strings.ts`'s existing pattern; no new
  design decision.
- **ui3 Task 10** (SSE parser + view-models) and **Task 11** (the Watch screen) — this
  prototype's `audit-store.ts` + `AuditStream.tsx` **is** a working proof of this shape,
  swapping the simulated `startLiveFeed()` for a real `EventSource`; the ring-buffer/rAF/
  per-kind-cache architecture carries over unchanged.
- **ui3 Task 12** (Ask — the query builder) — a genuinely new screen with no direct analog
  built here; would likely want React Aria's `ComboBox` for the same reasons `Virtualizer`
  earned its place, though at that point the §6 cost finding argues for scrutinizing whether
  it is solving a problem this narrow again.

**The honest summary of this section:** roughly 8–10 of the 31 unstarted tasks are actual
screen composition work this direction's component set directly reshapes; the rest (~21–23)
are backend plumbing and documentation, orthogonal to whether the frontend is React or
hand-written DOM.
