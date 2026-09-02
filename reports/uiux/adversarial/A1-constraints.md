# A1 — Constraint adversary: what cannot be built as proposed

**Seat:** constraint adversary, adversarial pass · **Date:** 2026-08-19
**Read in full:** the nine expert reports, `REQUIREMENTS-ADDENDUM.md` (R1–R5), and all seven sketches.
**Checked against:** `docs/superpowers/specs/2026-08-16-web-ui-design.md`, `2026-08-18-v2-decisions.md`,
`2026-08-18-v2-expert-review-addendum.md`, the three web-UI plans, and the shipped source at HEAD.

**Marks.** `[V]` verified against source or spec, cited. `[M]` measured — the method is stated where the
number is. `[R]` reasoned from a constraint.

**Verdicts.** **BUILDABLE** — ships as proposed under every hard constraint. **BUILDABLE-WITH-CHANGES** —
the idea survives; a named part of it does not, and the change is named. **NOT AS PROPOSED** — as written
it breaks a constraint that may not be waived, and the nearest buildable thing is a different thing.

**143 panel proposals ruled on, plus 9 rulings on R1–R5.
BUILDABLE 104 · BUILDABLE-WITH-CHANGES 35 · NOT AS PROPOSED 13.**

---

## Three facts that change how everything below reads

**1. `[V]` The CSP is spec text. No plan implements it and nothing in `src/` mentions it.**
`grep -rn 'Content-Security-Policy|default-src|script-src|style-src'` over `src/`, `test/`, `scripts/`,
`commands/`, `hooks/` returns **zero hits in `src/`**. Plan 1's `sendJson`
(`plans/…web-ui-1…md:2991-2999`) sets `content-type` and `cache-control: no-store` and nothing else; the
static-asset path (`:3053-3054`) sets the same two. The full policy exists in exactly one place,
`web-ui-design.md:282`:

> `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`

and `docs/design/web-ui-mockup.md:27` already records the consequence — *"the CSP forbids inline script and
style, which the single-file mockup relies on entirely."* **So the constraint every ruling below enforces
is currently owned by no task.** It needs one, in wave 1, before a screen is written. Retrofitting
`style-src 'self'` after sixteen screens carry inline `style=` attributes is the same expense the spec
already argued about RTL, one layer over. Two of the eight directives also do real work nobody has
noticed: `img-src 'self' data:` **blocks the README's five `img.shields.io` badges** (see R2), and
`form-action 'none'` means no screen may ever use a real `<form>` submit.

**2. `[V]` There is no UI code, and there is no `.css` file anywhere in the repository.**
`src/ui/`, `src/web/`, `web/`, `public/` do not exist. The only `.html` in the tree is the mockup; the only
`.js` files are five scope-matching fixtures under `test/fixtures/`. `package.json` has
`name, version, license, type, engines, bin, scripts, devDependencies` — **no `dependencies` key** — no
build, bundle, compile, prepare or prepublish script, no `dist/`, and no `ui` script; `bin` points at
`./src/cli/index.ts` directly. `tsconfig.json:10` sets `erasableSyntaxOnly: true`. Everything the nine
reports discuss is greenfield. That is the good news: **not one ruling below is a retrofit, and every
"-WITH-CHANGES" is cheap now and expensive after wave 1.**

**3. `[M]` The "57,000-node tree" the addendum asks R5 to survive is not a measurement — it is the dataviz
sketch's fabricated corpus toggle.** `grep` for `57,000`, `57000` and `57 000` over the whole repository
returns nothing. The recorded numbers are in `2026-08-18-v2-expert-review-addendum.md` §2.6: 200 items ×
10,000 files = **960 ms** uncached and **371 ms** with the glob cache that shipped in `e96bd05`; 5,000
items × 500 files = **4,169 ms**; and `listRepoFiles` caps at `FILE_LIMIT = 20_000` (`doctor/checks.ts:44`),
so 20,000 paths is the most any endpoint can see. This matters: R5's gloss has to survive **~28 virtualised
rows and a few dozen cards**, not 57,000 live nodes. Quoting the sketch's number as if it were a
measurement is the defect class this project names most often, appearing inside a requirements document.

---

## Rulings

### 01 — Capability coverage · 16 rulings · B 11 · WC 4 · NAP 1

| # | Proposal | Verdict | Constraint / evidence | Nearest buildable thing |
|---|---|---|---|---|
| 1.1 | `#/item/:id` — the missing hub; 15 of 27 item fields get a rendering | **BUILDABLE** | `[V]` `/api/item/:id` already returns `{item, injection, usage}` (plan 1 Task 11); pure read, reaches no mutator symbol | ships as proposed |
| 1.2 | `#/agent` — 14 MCP tools, 62 params, schemas, the `agentEdits` join, firing counts | **BUILDABLE** | `[R]` documentation joined to the corpus and the projection. The tools speak stdio and are unreachable from `node:http` anyway; `create_item`/`update_item`/`supersede_item` are three of the eight banned symbols | ships as proposed, provided the screen renders schemas and never offers a "run" control |
| 1.3 | Inverse palette-coverage test — every `refuseUnknownFlag` allow-list reachable from a def | **BUILDABLE** | `[R]` a source scan, zero deps, same shape as plan 1 Task 14 | ships as proposed. Build it **first**: it is the only mechanism that stops 1.1–1.16 re-opening |
| 1.4 | Compose `mycontext focus --tag/--category/--scope` and `--clear` from the header | **BUILDABLE** | `[V]` compose-only. `pre-tool-use.ts:100` refuses direct writes to `state/focus.json`; spec §7 is *"Not a write path at all"* | ships as proposed. A UI that **set** focus over HTTP would be a write — it is not on the eight-symbol list, which is precisely why the list is not the whole rule |
| 1.5 | Render `focus --preview`'s cost before the paste (hidden, exempt-hard, dangling) | **BUILDABLE** | `[V]` `focus.ts:148` is pure; `FocusReport` carries `hidden[]`, `visible`, `exemptHard[]`, `dangling[]` | ships as proposed |
| 1.6 | Enum pickers for `RELATION_TYPES` (8) and `Status` (5, one refused) | **BUILDABLE** | `[V]` `vocabulary.ts:42-45`; `edit.ts:519-525`; `options: [...]` already exists in the def grammar | ships as proposed |
| 1.7 | `#/hooks` — matcher, timeout, installed?, last firing, gating config key | **BUILDABLE** | `[V]` `hooks/hooks.json` is the only registration; all four facts are file reads | ships as proposed |
| 1.8 | Editor controls for `watchedDocs`, `profile`, `prefix`, custom categories | **BUILDABLE-WITH-CHANGES** | `[V]` `pre-tool-use.ts:97` — *"Configuration changes to `.my_context/config.json` are the user's to make — ask, do not edit"*. An editor that writes is refused by the product's own hook against its own agent | a **composer** emitting the minimal diff plus `/api/config/check`'s `dropped[]`. Do not call them editors on screen. `profile` re-decides 13 `enabled` flags at once, so the diff *is* the feature |
| 1.9 | Watch gains an `op` facet; `#/status` gains the `audit --files` segment rollup | **BUILDABLE** | `[V]` `audit.ts:112-114` (19 ops); `AUDIT_MAX_BYTES` 8 MiB (`audit.ts:245`) | ships as proposed |
| 1.10 | `#/work` gains ingest + lesson queues; `ingest-apply --stdin <<'JSON'` heredoc composed | **BUILDABLE-WITH-CHANGES** | `[V]` `ingest.ts:113`, `lesson.ts:102`. A **quoted** heredoc delimiter suppresses `$` and backtick expansion, so §6.1's substitution hazard does not reach the body — but a payload line equal to `JSON` closes the heredoc early and silently truncates the paste | choose the delimiter by scanning the payload (`JSON`, `JSON_1`, … until unused); assert it appears on no line of the body; validate every interpolated id with `isUsableId` `[V]` (`vocabulary.ts:71`) before echoing it |
| 1.11 | The global layer `~/.my-context` becomes browsable | **BUILDABLE-WITH-CHANGES** | `[V]` `workspace.ts:7` — `GLOBAL_DIR = path.join(homedir(), '.my-context')`, outside the project root. Plan 1 Task 12's traversal guard protects `src/ui/public`, not a data root | read it through `Store.openReadOnlyChecked` `[V]` (spec §2 requires it for the project root and the same reasoning applies), resolve the path server-side from `homedir()`, and **never accept a root from the query string** |
| 1.12 | `link` composed as `/mycontext:link` plus the raw `link_items` JSON | **BUILDABLE** | `[V]` no `mycontext link` command exists among the 25 registered; `commands/link.md` says *"Call the `link_items` tool"*. Spec §2 lists `link` among writes that are *"composed and copied"* — **not achievable as written**, and 01 is right to say so | ships as proposed, with 01's label: *"this runs through Claude, not your shell"* — a different sentence, because the fourteen deny rules do not apply to it |
| 1.13 | `unlink` via a `words: 2` extension to the def grammar | **BUILDABLE** | `[V]` `edit.ts:377` requires `--unlink <relation> <target>`; `:371-375` refuses the `=` form; `commandFor` emits only `--name value` or a bare flag | ships as proposed. Also render the two relations that cannot be removed (`supersedes`, `superseded_by`) |
| 1.14 | The no-workspace state is a first-class **page** | **NOT AS PROPOSED** | `[V]` `workspace.ts:17-25` discovers `.my_context` by walking upward; with none there is no corpus, no config and no db path. A server that opens a store in a directory that does not exist is doing something mutation-shaped to answer a read — §2 spent four paragraphs on that class | `08-onboarding.md` is right: `mycontext ui` prints `mycontext init` and exits non-zero. Keep 01's **wording** (one sentence, one copyable command) and put it in the terminal |
| 1.15 | `rebuild`, `repair`, `audit replay-ledger` composed, distinguishing derived from corpus | **BUILDABLE** | `[V]` spec §5 — *"deleting the database loses nothing"*; `audit.ts:297` shows `replay-ledger` is undocumented and the UI is the cheapest documentation it will get | ships as proposed |
| 1.16 | `statusline install` composed, showing the setting it would replace | **BUILDABLE-WITH-CHANGES** | `[V]` `2026-08-18-v2-decisions.md` §6 — *"**There is no `statusline` command in shipped code.**"* It is plan 3 Task 4, unbuilt. Independently confirmed: the registered command set has no `statusline` | wave 1 ships the honest **not-installed** rendering, which is what makes the context number truthful (spec §7). The compose waits for plan 3 Task 4 |

### 02 — Information architecture · 12 rulings · B 8 · WC 2 · NAP 2

| # | Proposal | Verdict | Constraint / evidence | Nearest buildable thing |
|---|---|---|---|---|
| 2.1 | `rail \| body \| detail`; three groups, eight destinations | **BUILDABLE** | `[R]` a CSS grid; mirrors on the inline axis for free with logical properties | ships as proposed |
| 2.2 | One universal detail pane, inline-end, shared by every screen | **BUILDABLE** | `[R]` a third grid column plus one URL parameter, per `07-arch.md` | ships as proposed |
| 2.3 | The provenance bar — one home for the six/seven qualifications | **BUILDABLE** | `[R]` converges with `07-arch.md`'s `{data, state, fetchedAt, reason}` return type; costs one band and a type | ships as proposed. **The highest-leverage IA move in the set** — it turns `INV-nothing-is-dropped-silently` from a habit into a signature |
| 2.4 | The global composer, replacing the palette screen | **BUILDABLE** | `[R]` an overlay driven by a URL parameter; emits text, calls no mutator | ships as proposed |
| 2.5 | The why-not panel — names **the first gate that failed**, in `select()`'s order | **NOT AS PROPOSED** | `[V]` `injection()` returns `{ phrase: string; injected: boolean }`. `injected: false` has **five distinct causes** and only English prose separates them (`05-dataviz.md` §1). A panel naming the binding gate must string-match `phrase` — the "thirteen renderings of an empty scope" defect in a new medium, which spec §3 forbids by name — or get a new field | build `05-dataviz.md`'s recommendation **first**: `injection()` additionally returns a stable `code`. `[V]` `erasableSyntaxOnly` makes it a string-literal union, never an `enum` (`RULE-erasable-syntax-only`). Then the panel keys on the code and prints the phrase and the two cannot disagree. **This is the highest-value screen in the design and it is gated on a source change, so the source change belongs in wave 1** |
| 2.6 | Cut `status` as a screen; the header counts link instead | **BUILDABLE-WITH-CHANGES** | `[V]` decision 5 already spent its justification. But `08-onboarding.md` argues status is the more useful exception *at zero*, and `[V]` the CLI prints three bare headings at zero because `table()` returns `[]` (`format.ts:235`) | cut the rail entry; keep the counts as links; keep one reachable `#/status` route so the zero state has somewhere to say what it counted |
| 2.7 | Cut `Learn` as a destination; reach help from the term it explains | **NOT AS PROPOSED** — overtaken by R2/R3/R4 | `[R]` the owner now requires a README viewer, a two-language tutorial viewer, and integrated help. Two of the three are destinations by definition. 02's argument was sound before the addendum | keep 02's **mechanism** as R4 (term-anchored disclosure) and add a **Docs** destination for R2/R3. They are layers: the disclosure deep-links into the doc viewer at the right heading |
| 2.8 | Cut the W1/W2/W3 badges | **BUILDABLE** | `[R]` a delivery schedule that has been given navigation | ships as proposed |
| 2.9 | Merge graph → detail pane; decay → stream; simulate → preview; gaps → coverage | **BUILDABLE** | `[R]` four datasets each answering two questions; the mode is a URL parameter | ships as proposed |
| 2.10 | *"3 items declare a scope one segment away"* — the `src/bill/**` case | **BUILDABLE-WITH-CHANGES** | `[V]` spec §3 — *"An endpoint may compose existing functions. It may not reimplement a rule."* A near-miss suggester is exactly the shape that becomes a second matcher | a **ranking over `matchesScope`'s recorded misses by longest shared directory prefix** — string arithmetic over data the map already computed, never a second matching pass. 02 says cut it if it cannot be built that way. Hold them to that |
| 2.11 | Every collection surface declares a cap and renders its truncation | **BUILDABLE** | `[V]` `INV-nothing-is-dropped-silently`; three `truncated` flags already exist in the plans | ships as proposed |
| 2.12 | Facet-first item list; no global search; ⌘K stays unbound | **BUILDABLE** | `[V]` `/api/search` refuses an unfiltered query (`anyFilterSet`); the spec commits to no global search | ships as proposed |

### 03 — Interaction · 15 rulings · B 9 · WC 3 · NAP 3

| # | Proposal | Verdict | Constraint / evidence | Nearest buildable thing |
|---|---|---|---|---|
| 3.1 | A composed command is an object with five fields and six states | **BUILDABLE** | `[R]` entirely client-side; the states are rendered, never stored server-side | ships as proposed |
| 3.2 | `POST /api/preview` over an in-memory candidate corpus, closed set of change kinds | **BUILDABLE-WITH-CHANGES** | `[V]` spec §2 bans routes reaching eight **symbols**; a pure computation over a candidate array reaches none. But the revision preview needs `applyRevisionFields` extracted from `promoteRevision`'s body, and `revision.ts` also holds `stageRevision`/`promoteRevision`/`discardRevision` — importing *anything* from that module hands the route's import graph an edge into all three | extract the pure helper into a **new module** (`revision-apply.ts`), exactly as plan 2 already split `revision-log.ts` and `revision-diff.ts`. Then §6's test stays clean by construction rather than by the test's precision. Without the extraction the preview re-derives a rule and must not be built — 03 says so itself |
| 3.3 | Corpus fingerprint on `/api/ping`; `visibilitychange` re-check; armed cards in `sessionStorage` | **BUILDABLE** | `[V]` plan 1 Task 16 already heartbeats only while visible; the ping returns `{ok:true}` today | ships as proposed. Prefer a **mutation-scoped** fingerprint: injections also append to the audit log, so a log-length signal fires once per tool call |
| 3.4 | argv as chips; **copy blocked** for a value that survives double-quoting | **BUILDABLE** | `[V]` `2026-08-18-v2-decisions.md` §6.1 demonstrates by execution that `DEC-$(echo SUBSTITUTED)` reaches a copy-paste-ready command, and *"the substitution runs in the user's own interactive shell, where none of the fourteen deny rules apply"*. §7 closes it at the load boundary in `1.0.2`; the UI is the last surface before the shell and should re-check | ships as proposed. **The strongest single safety finding in the nine reports, and it costs about twenty lines** |
| 3.5 | Copy label swaps in the `.then`; on rejection select the text and say "press Ctrl+C" | **BUILDABLE** | `[V]` plan 2 Task 11 neither awaits nor catches; the mockup swaps unconditionally (~679) | ships as proposed. The one place a silent failure puts the wrong string in a shell |
| 3.6 | The glob tester renders **two** answers as two labelled halves | **BUILDABLE** | `[V]` spec §3 records `query_items` collapsing exactly these two and *"consequently kept hiding unscoped items from a path query long after they had become injectable on that path"* | ships as proposed; bound the walk with the existing `SKIP_DIRS`/`SCOPE_SKIP_DIRS`/`FILE_LIMIT` rather than adding a second walk |
| 3.7 | The budget simulator is **exact and instant** — animate a cut line through a stable ranking | **NOT AS PROPOSED** | `[V]` `fitToBudget` is first-fit and its own comment insists: an over-budget item is `continue`d, not `break`ed, *"so a later, smaller, LOWER-priority item can still be admitted"*, and *"`spilled` is therefore **NOT a strict priority prefix** of the sorted candidates."* `05-dataviz.md` §3 shows the consequence: raising `jit` 4,000 → 4,300 admits a 3,900-token item and **evicts two**. Admission is not a prefix of a stable order, so a cut line through a fixed ranking draws a selector this product deliberately does not have | `05-dataviz.md`'s sweep — `/api/simulate?tier=jit&sweep=1` returns the selector's own result at every breakpoint in one request, the client scrubs with zero round trips and snaps to rungs, and the **downward** steps render as evictions. Same "instant", and true. 03 flagged the property `[?]`; it does not hold |
| 3.8 | `--yes` on by default only where the UI has already rendered the confirmation | **BUILDABLE** | `[V]` spec §2 — `--yes` buys *"an explicit, greppable token in the transcript"*, not security | ships as proposed |
| 3.9 | Deep-linkable builder at `#/palette?cmd=…&id=…` | **NOT AS PROPOSED** | `[V]` `07-arch.md` establishes that plan 1 uses `location.hash` for **both** the handoff nonce and the route, and `history.replaceState(null,'',location.pathname)` wipes the fragment — so a deep link cannot be opened with a nonce in the same URL, which is the only way the app is ever opened | 07's path routing: `/palette?cmd=supersede&id=…#<nonce>`. Same feature, and it is what makes `mycontext ui --at <path>` possible at all |
| 3.10 | `.was`/`.will` tokens; a preview may never render as a plain replaced value | **BUILDABLE** | `[R]` two classes and a rule; the sketch already does it once for `cfg.budgets` | ships as proposed. 03's test of the whole design — *pick any number at random, can you tell whether it is real* — should be a review checklist item |
| 3.11 | The settling state — local optimistic geometry, server-exact numbers, difference visible | **BUILDABLE-WITH-CHANGES** | `[R]` the rule is right; the geometry has to move without a `style=` attribute | write it as `el.style.setProperty('--fill', …)`. `[V]` `06-a11y.md` finding 22 states the exact boundary: `style-src` gates the `style` **attribute** and `setAttribute('style',…)`; CSSOM property assignment is **not** gated |
| 3.12 | Nine bindings including bare `n`, `c`, `x`, `a`, `r` bound globally | **NOT AS PROPOSED** | `[V]` `06-a11y.md`: WCAG 2.1.4 *Character Key Shortcuts* admits exactly three answers — turn off, remap, or active-on-focus-only — and a screen reader in browse mode has every printable key claimed as a quick-nav key (`H` heading, `T` table, `B` button). Bare printable keys bound globally fail the checkpoint and make the app unusable with a screen reader | 06's layer: off by default with a persisted toggle, `g` chords for navigation, single printable keys only inside a focused composite widget, `?` always live. Keep 03's *one table generates both the handlers and the sheet* rule — it is right, and CSP requires one delegated `keydown` listener anyway |
| 3.13 | Arrow semantics resolve against `document.dir`; letter shortcuts key on `event.code` | **BUILDABLE** | `[M]` `06-a11y.md`: on the standard Hebrew layout the physical `G` key emits `ע`, so `event.key === 'g'` never fires for the Hebrew-first user the spec exists to serve | ships as proposed |
| 3.14 | Bulk: N commands, newline-separated, fan-out preview with exclusions counted | **BUILDABLE** | `[V]` no batch form exists for `supersede`; `[V]` spec §2 — newlines keep each line an independent command string, which is what the fourteen Bash deny rules match on. `&&` and `;` would quietly weaken the protection this design exists to preserve | ships as proposed. The exclusions are the value: five commands two of which will error is worse than the terminal |
| 3.15 | Per-command landing — *"3 of 5 landed"* | **BUILDABLE-WITH-CHANGES** | `[V]` decision 4 — Work ships in wave 2 **without** stream-driven refresh, stated as a divergence | wave 2 resolves on the visibility-ping fingerprint and says **"not seen yet"**, never "not run"; wave 3 upgrades to the stream. When the server is gone it must say *"cannot check"* — a pending state whose observer is dead is not a negative observation |

### 04 — Visual direction · 14 rulings · B 7 · WC 5 · NAP 2

| # | Proposal | Verdict | Constraint / evidence | Nearest buildable thing |
|---|---|---|---|---|
| 4.1 | Real scales: 7 type steps, a 4px spacing base, 3 radii, 3 elevation tiers | **BUILDABLE** | `[R]` the diagnosis is right — nine ad-hoc font sizes and twelve spacing values is a scale problem, not a palette problem | ships as proposed, with 06's amendment: all sizes in `rem`, nothing below `0.75rem` |
| 4.2 | Derive accent tints by `color-mix(in oklch, var(--accent) 12%, var(--panel))` | **BUILDABLE-WITH-CHANGES** | `[R]` `color-mix` is CSS and CSP-clean. But it **breaks the audit method 06 used**: `06-a11y.md`'s ratios were computed by a script reading the mockup's literal `light-dark()` pairs. A `color-mix` value resolves at paint time, so a source-reading test cannot compute it | keep the formula, and implement oklab mixing per CSS Color 4 in the contrast test (~50 lines, zero deps). Mixing two in-gamut sRGB colours at 12% is in-gamut by construction, so the hand implementation and the browser cannot diverge on gamut mapping. **Do not adopt `color-mix` until the test can read it** — halving the tokens while blinding the only measurement that found five failures is a bad trade |
| 4.3 | Add `--panel-2`, an elevated surface tint, for anything that floats | **BUILDABLE-WITH-CHANGES** | `[M]` measured (WCAG 2.x relative-luminance script over the mockup's own tokens, compositing white over `--panel` at alpha α): in **dark mode** `--dim` on the lightened panel is 5.53 at α=0, 5.01 at α=0.04, **4.45 at α=0.08 — below 4.5**. In light mode `--panel` is `#fffffe`, so a white lift is a literal no-op | dark mode: `--panel-2` may be at most **7 % lighter** than `--panel`, or it carries `--ink` text only. Light mode: elevation must come from the shadow and the hairline, not from a lift, because there is no headroom above `#fffffe` |
| 4.4 | A dark-mode inset highlight (`box-shadow: inset 0 1px 0`) instead of more shadow | **BUILDABLE** | `[R]` correct and it is the cheap half of R5 — see §R5 | ships as proposed |
| 4.5 | Recheck and darken `--faint` | **BUILDABLE** | `[M]` reproduced independently: `--faint` on `--panel` **3.14** light / **3.07** dark; on `--paper` **2.91** / **3.29**. It colours every `th`, every card title, every rail group label and every count badge, and fails in both themes | required, not optional |
| 4.6 | **Reject** `backdrop-filter` glassmorphism and generic shine | **NOT AS PROPOSED** — overtaken by R5 | `[R]` the owner has required the gloss; a panel may not refuse a requirement. But 04's *reasoning* survives and decides the implementation | see §R5. The result honours both: `backdrop-filter` is refused **on its own merits** (it is a no-op against a flat backdrop), and the gloss is made to encode epistemic status, which is 04's own "shine that earns its place" test satisfied rather than waived |
| 4.7 | Give the measured number (0.55 ms p95) 30px mono; keep fabricated numbers at body size with an "illustrative" tag | **BUILDABLE** | `[R]` a design pattern that cannot be applied to a claim without a measurement is a forcing function against this project's defining defect | ships as proposed. Make it the elevation rule too (§R5) |
| 4.8 | Zebra striping, sticky `<thead>`, a `.num` utility with `tabular-nums` | **BUILDABLE-WITH-CHANGES** | `[R]` all three are right; two interlock with 06 | `.num` must be `text-align:end`, not `right` — `[V]` `06-a11y.md`: `td.m` sets `direction:ltr`, so `text-align:start` in that cell resolves to its *left* while every prose cell in the same RTL table aligns right. The sticky head must live **inside** the `overflow-x:auto` + `tabindex="0"` + `role="region"` wrapper 06 requires |
| 4.9 | Tree depth via an inline `--depth` custom property — `[role="treeitem"][style="--depth:n"]` | **NOT AS PROPOSED** | `[V]` `style-src 'self'` blocks the `style` **attribute**, in markup and in a `<template>`. The component inventory writes the attribute literally | `el.style.setProperty('--lvl', n)` — precisely what `06-a11y.html:579` already demonstrates, with the comment explaining why it survives. The same correction applies to every `--v` chart value (4.11) |
| 4.10 | Word-level `<ins>`/`<del>` inside the review-queue diff cells | **BUILDABLE** | `[R]` real semantic elements, announced without extra ARIA; a zero-dep LCS is ~80 lines. 04 is right that this is the strongest shine candidate because it is also the highest functional win | ships as proposed, building **nodes**, never a string — the diffed text is semi-trusted corpus body |
| 4.11 | Hand-rolled bars and sparklines via a `--v` custom property and `calc()` | **BUILDABLE-WITH-CHANGES** | `[R]` the approach is right — no charting library exists or is needed. But `05-dataviz.html` writes `.style.width` directly at nine sites instead of setting a custom property | `setProperty('--v', …)`, so the arithmetic stays in the stylesheet where the logical-property lint can see it |
| 4.12 | A CI lint that greps the stylesheet for physical properties and fails the build | **BUILDABLE** | `[V]` plan 1 states *"a physical `left`/`right`/`margin-left`/`text-align: left` anywhere in this file is a defect"* and ships no assertion | required. It is `07-arch.md`'s scan #2 and the two should be one file |
| 4.13 | Fifteen named primitives | **BUILDABLE** | `[R]` correctly scoped; `.cmd`, `.chip`, the tree and the diff cell carry the product's meaning | ships as proposed, with 4.9's correction to the tree row |
| 4.14 | Stay dense; no comfortable/compact toggle | **BUILDABLE-WITH-CHANGES** | `[V]` `06-a11y.md`: tree rows at `line-height:1.85` on 12px are ~22px, under WCAG 2.5.8's 24×24 CSS px minimum once they become clickable rows | keep one density and raise the clickable-row minimum to 24px. One density system, and it clears 2.5.8 |

### 05 — Data visualisation · 22 rulings · B 18 · WC 4 · NAP 0

| # | Proposal | Verdict | Constraint / evidence | Nearest buildable thing |
|---|---|---|---|---|
| 5.1 | Pinned coverage leaves the tree and becomes a band above it | **BUILDABLE** | `[V]` the addendum records that `/api/coverage` computes `pinned`, a test asserts it, *"and the screen colours that directory a gap"* — a false statement in the flagship graphic. The pinned tier never consults `matchesScope` | ships as proposed. It is the only change that makes "gap" mean the true thing |
| 5.2 | `injection()` additionally returns a stable `code` | **BUILDABLE-WITH-CHANGES** | `[V]` a change in `src/`, not the UI. `injection()` has three callers and its own comment says it exists because the fact *"had a long history of being spelled differently in each place that needed it"* | ship it, as a string-literal union `[V]` (`erasableSyntaxOnly`, `RULE-erasable-syntax-only`), with the existing pin-rendering tests re-run. **It unblocks 2.5 and 8.7, the two highest-value diagnostic surfaces in the design, so it is wave 1** |
| 5.3 | `/api/coverage` returns a directory rollup; per-file detail on `?dir=` | **BUILDABLE** | `[M]` 5,000 items × 500 files = 4,169 ms today; `07-arch.md` derives ~5.6 s at 20,000 files × 5,000 items, in a single-threaded server, which stalls the heartbeat and the idle timer | ships as proposed; it converges with `07-arch.md` item 9 and the two should be one task |
| 5.4 | The density rail as a text-free SVG docked to `inset-inline-end` | **BUILDABLE** | `[R]` inline SVG is markup, not a fetched resource — `default-src 'none'` does not touch it. Text-free means it mirrors by moving | ships as proposed |
| 5.5 | Tree rows as CSS boxes, never SVG | **BUILDABLE** | `[R]` and it is what makes the row chrome mirror while the path inside it does not | ships as proposed |
| 5.6 | A third expansion mode: "where coverage changes" | **BUILDABLE** | `[R]` opens exactly the informative subset | ships as proposed |
| 5.7 | The budget ribbon with a **positional** ghost lane | **BUILDABLE** | `[V]` `fitToBudget`'s own comment. Drawing spills as a tail under the bar would render priority truncation — a selector this product does not have | ships as proposed. The single most important honesty property on that screen |
| 5.8 | A tier the event never reaches is drawn **absent** (hatched), never empty | **BUILDABLE** | `[R]` "ran and delivered nothing" and "never ran" are different facts; an empty bar claims the first | ships as proposed |
| 5.9 | Add `cost: number` to `SpilledRef` | **BUILDABLE-WITH-CHANGES** | `[V]` spec §9 decision 4 pins the record shape as *"the spilled set as (id, tier, reason)"*. Adding a field changes the append-only JSONL and needs a projection schema bump — which §5 already handles: *"a diverged or version-mismatched projection is discarded and rebuilt whole"* | ship it, **and state the cost honestly**: every record already on disk lacks `cost`, so the proportional historical ghost the field exists to draw must render *"not recorded"* — the rule `AuditRecord.tokens` already carries — for all history to date. **The feature cannot see the past it was built to explain until new records accumulate.** Say that on the screen |
| 5.10 | The admission staircase, with breakpoints from `?sweep=1` | **BUILDABLE** | `[R]` membership can only change at a cumulative candidate cost, so the breakpoints are exact and finite | ships as proposed; it supersedes 3.7 |
| 5.11 | Downward steps rendered as **evictions**, with both sides named | **BUILDABLE** | `[V]` first-fit means raising a budget can evict. A monotone curve would draw a lie | ships as proposed. Nothing else in the product surfaces this |
| 5.12 | The recency comb on a log axis; `lastUsed: null` in its own terminal bucket | **BUILDABLE** | `[V]` `byColdest` already sorts `null` first for the same reason; never-injected is a different kind, not a large number | ships as proposed; switch to a histogram past a few hundred items with the cold tail listed by name |
| 5.13 | `unrestricted` drawn as a `∀` marker, never a third stacked bucket | **BUILDABLE** | `[V]` its own doc comment: *"NOT a fourth bucket … a consumer that sums `cold + warm + unrestricted` double-counts."* | ships as proposed. A cold **pinned** item gets its own ring and the sentence *"pinned, yet cold — it spilled"* |
| 5.14 | The 90-day delivered/spilled heatstrip from `audit_item` | **BUILDABLE** | `[V]` `idx_audit_item_id ON audit_item(item_id, role)` — one indexed query; drawn as a CSS grid so it mirrors free | ships as proposed |
| 5.15 | The ego graph as five directional columns, edges joining adjacent columns only | **BUILDABLE** | `[V]` six of eight `RELATION_TYPES` are directional, so direction is the layout and the crossing count is bounded by construction rather than minimised by search. O(n), ~40 lines, no simulation — satisfies spec §8's risk row | ships as proposed |
| 5.16 | Graph nodes carry **ids, never titles** | **BUILDABLE** | `[V]` `ID_GRAMMAR` guarantees an id is ASCII; a title is free text and may be Hebrew, and CSS cannot reach inside an SVG to fix bidi | ships as proposed. **The best single RTL decision in the nine reports** — it reduces the whole SVG mirroring problem to arithmetic |
| 5.17 | The pulse strip; a focus record drawn as a **rule across the feed**, not a row | **BUILDABLE** | `[V]` spec §5 — *"an audit view that streamed injections without focus changes would show items disappearing from a session with no visible cause"* | ships as proposed. The highest-value single decision on that screen |
| 5.18 | Prefix-prune the walk via `globPrefix(pattern)` in `paths.ts` | **BUILDABLE-WITH-CHANGES** | `[V]` spec §3's compose-don't-reimplement rule. A pruner is exactly the shape that becomes a second matcher | 05 states its own condition and it is the right one: `globPrefix` lives **in `paths.ts` beside `globToRegExp`** so glob grammar stays in one module, and it is pinned by a **property test** — the pruned result equals the unpruned result over a random corpus — not by reading |
| 5.19 | Two truncations, never merged into one word | **BUILDABLE** | `[V]` `FILE_LIMIT = 20_000` stops *mid-walk*; the coverage time budget stops *descending*. Different facts | ships as proposed. "We did not look" and "nothing governs it" must never share a colour |
| 5.20 | Virtualise to the visible ~28 rows; merge density-rail runs | **BUILDABLE** | `[M]` demonstrated in the sketch at 2,822 directories rendered as 48 `<rect>`s | ships as proposed |
| 5.21 | SVG mirroring by one projection function `X(u,W)` plus an anchor swap | **BUILDABLE** | `[V]` CSS cannot mirror an SVG's interior; `scale(-1,1)` mirrors the glyphs too | ships as proposed. Direction becomes a render parameter |
| 5.22 | 7a diverging bar (selected-but-not-delivered); 7b the session ribbon | **BUILDABLE-WITH-CHANGES** | 7a: `[V]` `audit_item.role` distinguishes `injected` from `spilled` and is indexed; the schema's own comment says counting spills by item *"is how a user finds a budget that is too small."* Ships as-is. 7b: the join half needs the status-line bridge, and `[V]` there is no `statusline` command in shipped code | build 7a in wave 3 and make it the budget simulator's entry point, which it currently lacks. Build 7b's mycontext half in wave 3 and render the real-context band only when the bridge is installed, saying so when it is not (spec §7's condition-in-the-same-sentence rule) |

### 06 — Accessibility and internationalisation · 15 rulings · B 15 · WC 0 · NAP 0

Every 06 proposal is buildable, most are required, and one of them is the cheapest structural win in the
whole review. Independent re-measurement (WCAG 2.x relative luminance over the mockup's own `light-dark()`
pairs, run here) **reproduces every published ratio exactly**: `--faint`/`--panel` 3.14 / 3.07,
`--faint`/`--paper` 2.91 / 3.29, gold/goldbg 4.31, ok/okbg 4.39, warn/warnbg 4.17, warn/sink 4.06,
rule/panel 1.33 / 1.19, edge/panel 1.65 / 1.59, goldln/goldbg 1.45 / 1.87, and **gold vs ok 1.04 / 1.43**.

| # | Proposal | Verdict | Note |
|---|---|---|---|
| 6.1 | String table: named placeholders, **no markup in any value**, node substitution via `fill()` | **BUILDABLE** | **Build this first.** One change closes four things at once: the bidi isolation (10 of 114 Hebrew values ship a bare Latin run), CSP compliance, the `innerHTML` trust boundary, and the plural contract. `[V]` `07-arch.md` reaches the same rule from the data layer: *"A string table value may not contain `<`."* Retrofitting it after wave 2 costs five times what it costs now |
| 6.2 | Four tests — key parity, **placeholder parity**, no bare technical runs, plural completeness | **BUILDABLE** | Placeholder parity has no analogue in `parity.test.ts` and is where the real bugs live. `[M]` `he → ['one','two','other']` and `select(2) === 'two'`; never hard-code `n === 1` |
| 6.3 | Native `Intl` for all dates/times/numbers; **sanitise bidi controls from anything clipboard-bound** | **BUILDABLE** | `[M]` CLDR emits real U+200E characters inside its own output. An invisible LRM inside `mycontext review promote-revision …` is a command that fails naming a character the user cannot see. Numbers inside a `<code>` use `String(n)` — `--budget jit=8,000` is a syntax error |
| 6.4 | `.m`/`<code>` for known-LTR runs; `<bdi>` for anything read off disk | **BUILDABLE** | `unicode-bidi: plaintext` is the tempting wrong answer and `bidi-override` is worse. Isolation is CSS and elements, **never characters** — U+2066/U+2069 survive a copy |
| 6.5 | ARIA tree with roving tabindex; three live regions; labels, captions, `scope`, one `<h1>`, skip links | **BUILDABLE** | `[V]` the mockup has zero of each. The stream is `role="log"`, appended never re-rendered, with a **coalesced** count on a ≥1.5 s timer — forty records is one utterance |
| 6.6 | Delete `overflow:hidden`/`100vh`; `rem` sizes; container-responsive grid | **BUILDABLE** | WCAG 1.4.10. `repeat(auto-fit, minmax(min(28rem,100%),1fr))` needs no media query and survives text-only zoom |
| 6.7 | Shortcut layer off by default; `g` chords; `event.code` | **BUILDABLE** | Supersedes 3.12. Never bind Ctrl/Cmd+`K`, F1–F12, `Insert`, `CapsLock`, or `Ctrl+Alt+<letter>` (AltGr on Windows) |
| 6.8 | Six palette tokens corrected | **BUILDABLE** | Required. Only six tokens move and the palette's character is unchanged |
| 6.9 | Shape redundancy for the tier dots — `◆` filled / `○` hollow / `△` — plus the word in the accessible name | **BUILDABLE** | `[M]` and it is worse than a colour-blindness problem: converted to sRGB grey, `--gold` → `#70`, `--ok` → `#6d`, `--warn` → `#72`. **Three of the four semantic accents land within 5/255 of each other on a monochrome printout**, and the spec *requires* a real print stylesheet. Colour is not a print channel here at all |
| 6.10 | A `forced-colors` block | **BUILDABLE** | This is a Windows-first project whose whole audit corpus is Windows-tested. Not an exotic mode here |
| 6.11 | `prefers-reduced-motion`, plus one "pause live updates" control | **BUILDABLE** | WCAG 2.2.2. Use `animation-duration:.01ms`, not `0s` — a zero duration can skip `transitionend` and hang a state machine waiting for it |
| 6.12 | Fix the print block | **BUILDABLE** | `[V]` it hides every screen but `coverage` and **never removes `coverage`'s `hidden` attribute**, so `Ctrl+P` from the landing screen prints a blank page |
| 6.13 | Focus management table — screen swap, popover open/close, banner, tree, copy | **BUILDABLE** | The banner is `role="alert"` and does **not** take focus; the copy button announces through the polite region rather than mutating its own accessible name twice in 1.4 s |
| 6.14 | A blue focus ring instead of gold | **BUILDABLE** | Gold is the product's meaning colour; using it for focus overloads it and it also clears the 4.15:1 marginal case |
| 6.15 | `td.num { text-align: end }` inside RTL tables | **BUILDABLE** | The subtle one: it only shows up in Hebrew, so English review cannot catch it |

### 07 — Frontend architecture · 16 rulings · B 12 · WC 4 · NAP 0

| # | Proposal | Verdict | Constraint / evidence | Nearest buildable thing |
|---|---|---|---|---|
| 7.1 | The URL is the store; three parameter tiers; unknown params refused client-side too | **BUILDABLE** | `[R]` it is the whole answer to sharing the session selector without a framework, and it makes modes, the detail pane and the composer overlay cost zero new state mechanism | ships as proposed. Language stays out of the URL — a shared link must not change the recipient's language |
| 7.2 | `<template>` + field binding; `textContent` the only text sink; `replaceChildren()` never `innerHTML=''` | **BUILDABLE** | `[R]` the decisive argument is right: it makes the anti-XSS rule *negative and greppable*, which is this project's culture. **This collides head-on with R1 and the collision is resolvable** — see §R1 | ships as proposed, with R1's amendment stated in the same rule: a renderer may **create elements from a closed tag allow-list**; it may never assign markup |
| 7.3 | Seven source-scan invariants under `public/` | **BUILDABLE** | `[R]` highest value per line in the whole suite; each catches a class that is otherwise invisible | ships as proposed. Merge scan #2 with 4.12 |
| 7.4 | Add `require-trusted-types-for 'script'; trusted-types 'none'` | **BUILDABLE-WITH-CHANGES** | `[R]` it converts a grep into a runtime mechanism, is inert elsewhere, costs one directive. But `[V]` **no plan emits any CSP header at all** (fact 1) | add the eight-directive header from `web-ui-design.md:282` as a wave-1 task first; then this. Also verify it in the target browser rather than assuming — the guarantee is Chromium-shaped |
| 7.5 | A ~150-line DOM double, golden trees, and screen/endpoint contract tests | **BUILDABLE** | `[R]` banning `innerHTML` is what makes the required DOM surface small enough to double. The escaping rule and the testability rule are the same rule | ships as proposed. Its docstring states what it cannot check, in the register of `parity.test.ts` |
| 7.6 | Path routing; the fragment reserved for the nonce; `mycontext ui --at <path>` | **BUILDABLE-WITH-CHANGES** | `[V]` the fragment collision is real and it is the only way the app is ever opened. But serving `index.html` for *any* non-`/api`, non-asset GET is a new rule on a server whose static path is traversal-proof by allow-list | keep the allow-list and put the SPA fallback **after** it, never before, or the fallback becomes the traversal escape. Handle the no-credential deep link as a first-class state, not a 401 wall |
| 7.7 | One refcounted stream owned by the shell | **BUILDABLE** | `[R]` four consumers otherwise open four idle-exempt sockets and four parsers | ships as proposed, moved from plan 3 Task 11 into the shell |
| 7.8 | The screen contract gains a teardown | **BUILDABLE** | `[V]` plan 1 Task 16 holds `const sessionListeners = []` with **no removal path anywhere in the plan**, while `route()` mounts on every hash change. One session change after three navigations costs 6–9 requests with no ordering guarantee, plus a detached tree per navigation | ships as proposed. It is a defect, not a style preference |
| 7.9 | `X-Myctx-Generation` on every response + four cache classes | **BUILDABLE-WITH-CHANGES** | `[V]` the proposed generation is *"count + max mtime over `.my_context/items/**`"*. That covers the corpus and **not** `config.json`, **not** `state/focus.json`, and **not** the per-session seen files — all three of which change what `/api/select` returns. A `session`-class entry invalidated only by the corpus generation serves a stale preview after `mycontext focus --tag x`, which is the single most consequential thing a user can do between two page loads | the generation is a tuple over `items/**` + `config.json` + `state/` mtimes, or three counters. Without that, the caching layer manufactures exactly the "preview shows a selection Claude never got" risk spec §8 lists |
| 7.10 | Memoize `select()` server-side across select/render/simulate | **BUILDABLE-WITH-CHANGES** | `[V]` `INV-select-is-pure` — *"no I/O, no filesystem, no clock"* — makes memoization sound. The key is the problem, not the technique | land it **after** 7.9. The memo key must contain everything 7.9's generation now covers, or the 3× saving is bought with a stale flagship screen |
| 7.11 | `/api/bootstrap`; `modulepreload`; paint the shell chrome before any network call | **BUILDABLE** | `[V]` the current sequence is ~6 dependent round trips for a screen the spec says renders *"with no user input at all"* | ships as proposed |
| 7.12 | Heartbeat gate becomes `visible && lastInteraction < 30 min` | **BUILDABLE** | `[R]` `visibilityState === 'visible'` is true for a tab sitting on a second monitor, which is a very common way to forget a tab — so the visibility gate does not close the case §2 says it closes | ships as proposed; it is a pure predicate and extends the existing `shouldPing` test |
| 7.13 | Build into a `DocumentFragment`, swap at the end | **BUILDABLE** | `[R]` `t()` throwing mid-render otherwise leaves a half-built screen | ships as proposed |
| 7.14 | A checker that every §0 correction landed in the task it names | **BUILDABLE** | `[V]` two §0 rows — `focus`, and `readSeen` not `Ledger.seen` — are recorded and unimplemented in the very tasks those rows name; decision 5's landing screen is a third | ships as proposed. **The cheapest high-leverage item in the entire review**, and it is not architectural |
| 7.15 | Performance budgets as assertable ceilings | **BUILDABLE** | `[M]` a 5.6 s handler in a single event loop stalls `/api/ping`, the heartbeat, every other screen and the idle monitor's own timer — it looks like a hang, not a slow screen | ships as proposed, at the sizes the perf suite already uses (`CORPUS_SIZE = 5000`) |
| 7.16 | A `<datalist>` from `/api/files?prefix=&limit=50` instead of 20,000 `<option>`s | **BUILDABLE** | `[V]` `preview.js` fetches `/api/coverage` **only to fill a file `<select>`** | ships as proposed. A file picker must never cost a repo walk |

### 08 — Onboarding and first run · 10 rulings · B 7 · WC 3 · NAP 0

| # | Proposal | Verdict | Constraint / evidence | Nearest buildable thing |
|---|---|---|---|---|
| 8.1 | Every empty region names **which of five zeroes** it is | **BUILDABLE** | `[R]` `INV-nothing-is-dropped-silently` applied to zero. Zeroes 3–5 are false empties and the user's instinct on all three is to conclude zero 1 | ships as proposed. Zero 5 — *a read that failed is never rendered as a read that returned nothing* — generalises a prohibition the spec already makes once for a rejected token |
| 8.2 | Suppress a per-row marker when the value is uniform **and** its cause is global | **BUILDABLE** | `[R]` 1,284 dashed dots are 1,284 correct renderings of one sentence. The fix is *no dot*, and one sentence | ships as proposed, as a rule for every collection surface |
| 8.3 | `mycontext ui` refuses in an uninitialised repo | **BUILDABLE** | `[V]` `init` already has the precedent — it refuses arguments rather than ignoring them | ships as proposed; it beats 1.14 |
| 8.4 | The terminal line names the zero before the browser does | **BUILDABLE** | `[R]` the empty page becomes confirmation rather than a suspected bug | ships as proposed. `mycontext init` printing a next step is the cheapest onboarding improvement in the product and it is outside the UI |
| 8.5 | The Start-here strip: four **predicates over observed state**, no wizard state | **BUILDABLE** | `[R]` the mutator-free constraint turned into the feature — the UI cannot store wizard state, so nothing can be skipped or falsely completed, and it retires by growth | ships as proposed. Step 4 naming *the file in your repo that will make your item fire* is a genuine capability offered at the moment it is worth something |
| 8.6 | The bootstrap scan — *"these read like they contain rules"* | **BUILDABLE-WITH-CHANGES** | `[R]` it reads **file contents**, which nothing else in the UI does. `[V]` `listRepoFiles` caps at 20,000 **paths**; reading 20,000 files' bodies on a first-paint path is a different order of cost and is `07-arch.md`'s ranked #1 failure mode — a stalled single event loop | cap the candidate set by name and size before any read, keep it off the landing path (08 already puts it on the coverage empty state), and honour all three honesty constraints — label it a guess, show the evidence sentence, **count nothing** |
| 8.7 | The recovery ladder — six rungs, the **binding** rung only | **BUILDABLE-WITH-CHANGES** | same dependency as 2.5 | gated on 5.2's `injection().code`. Rungs 1–4 are `injection()`, rung 5 is the seen file, rung 6 is `select()`'s spill reason; nothing is re-derived once the code exists |
| 8.8 | `watchedDocs` is wrong on arrival, and Configure's day-one job is to say so | **BUILDABLE** | `[V]` `config.ts:74-78` — the three defaults are the plugin author's own paths and the list **replaces rather than merges**, so on a typical repository zero documents match and the PostToolUse nudge never fires | ships as proposed. A setting that silently does nothing is the exact defect shape this project keeps paying for |
| 8.9 | Never hide a screen because it has nothing to say | **BUILDABLE-WITH-CHANGES** | tension with 2.6 and 2.7, which delete two destinations | reconciled: 02 removes two *destinations*; 08's rule governs the ones that remain. A screen with nothing to say says what would put something in it, and badges show `0` in neutral type with only the review queue ever amber |
| 8.10 | A screen whose statistic needs a minimum sample states the minimum and the distance to it | **BUILDABLE** | `[V]` `decay` already does this in the CLI and it is the best honesty precedent in the product | ships as proposed, inherited by every chart |

### 09 — Workflows · 23 rulings · B 17 · WC 5 · NAP 1

| # | Proposal | Verdict | Constraint / evidence | Nearest buildable thing |
|---|---|---|---|---|
| 9.1 | Cap 1 — retrospective miss autopsy ("why didn't it fire *then*") | **BUILDABLE** | `[V]` the record shape carries `injected[]`, `spilled[]{id,tier,reason}`, `tokens`, `note`; `audit_item` indexes one row per (record, item) **including spills** | ships as proposed. **Build it first.** It is the only surface that can say *"the rule was delivered and ignored"*, and both that and *"it spilled at 14:03"* end the hunt |
| 9.2 | Cap 2 — spill onset, the day it stopped fitting | **BUILDABLE-WITH-CHANGES** | proportional ghosts need 5.9's `cost`, which no existing record carries | ship the colour-only strip (delivered / spilled / not-selected) now; add proportional widths once `cost` has accumulated, and mark the boundary date on the chart |
| 9.3 | Cap 3 — the rent roll | **BUILDABLE** | `[V]` `tokens`, `injected[]` with tiers, `estimateTokens`, `itemCost`, `always`. Exclude `tier:'snapshot'` (delivers nothing) and mark `tier:'restored'` (its `injected_at` is an identity marker, not a clock reading) | ships as proposed. The only proposal in the paper whose output is a **deletion** |
| 9.4 | Cap 4 — compaction survival report | **BUILDABLE** | `[V]` the PreCompact manifest is already an audit record at pseudo-tier `'snapshot'`, and `compact-restore` carries what returned; both share `sessionId` and both are in `audit_item`. **A self-join the projection already indexes** — no new mechanism | ships as proposed. It makes the product's founding promise measurable for the first time |
| 9.5 | Cap 5 — nudge conversion, is `watchedDocs` earning its keep | **BUILDABLE** | `[V]` the `post-tool-use` record is written **only when the nudge actually fires** | ships as proposed. The only capability that improves the *model's* experience |
| 9.6 | Cap 6 — the deny wall | **BUILDABLE** | `[V]` `HOOK_OPS` includes `deny` with `path` and note | ships as proposed. Cheapest screen in the paper: a repeated deny is a route that does not exist |
| 9.7 | Cap 7 — agent authority, what took effect with no human act | **BUILDABLE** | `[V]` `audit.ts:96-108` — *"An agent that narrows its own context and then reports on 'the rules for this project' is describing a corpus it chose"* | ships as proposed |
| 9.8 | Cap 8 — the degradation counter | **BUILDABLE** | `[V]` four `note` strings in `pre-tool-use.ts:252-272` plus four doctor codes; `INV-hooks-fail-open` makes failure invisible by design | ships as proposed. It is the empirical check on the invariant |
| 9.9 | Cap 9 — the reverse glob tester (files → candidate globs, ranked) | **BUILDABLE-WITH-CHANGES** | `[V]` spec §3's compose-don't-reimplement rule. A glob *generator* that decided coverage would be a second matcher | generate-and-test: propose candidates by string arithmetic over the selected paths, then **score each one with `matchesAnyGlob`/`matchesScope`**. Reuse `doctor`'s bounded walk (`SKIP_DIRS`, `SCOPE_SKIP_DIRS`, `FILE_LIMIT`), never a second one |
| 9.10 | Cap 10 Tier A — governing-set diff from the mutation log | **BUILDABLE** | `[V]` `MUTATION_OPS` with `fields[]`, `origin`, `itemId`, `at` | ships as proposed, labelled *"this machine, since <date>"* |
| 9.11 | Cap 10 Tier B — inflate loose git objects with `node:zlib` | **NOT AS PROPOSED** | `[V]` spec §7: *"**Not a git client.** Branch and commit are read from `.git` as files; there are no ahead/behind counts and no working-tree status."* Reconstructing a past corpus from commit/tree/blob objects is a git client by any definition. Zero-deps is satisfied (`node:zlib` is a builtin) — the refusal is the non-goal **and the yield**: any repository git has auto-gc'd has essentially everything packed, and 09 names packed objects as the limit, so the feature is usually unavailable | 09's own alternative: a **second read-only workspace root** pointed at a `git worktree`, with the two governing sets diffed by pure functions. Zero git parsing, and it delivers the PR-review story Tier B was reaching for |
| 9.12 | Cap 11 — the standing overlap report, with body similarity | **BUILDABLE-WITH-CHANGES** | `[V]` `NOGOAL-not-a-claude-mem-replacement` refuses *"semantic search over past work"* | a **lexical** overlap ranking (trigram/Jaccard, ~40 lines, zero deps) over the **current** corpus is on the right side of that line. Label it lexical on screen and never as "similar meaning" — and say what it cannot see, because two items saying the same thing in different words hash differently and dedupe never fires |
| 9.13 | Cap 12 — lifecycle debt, open questions still asking | **BUILDABLE** | `[V]` a stale `open_question` is an active brake injected into every relevant session | ships as proposed |
| 9.14 | Cap 13 — ingest yield, grouped by rejection message | **BUILDABLE** | `[V]` `.rejected.jsonl` is append-only and **never pruned by a later success**; `validateCandidates` generates ~30 distinct messages that cluster into actionable groups | ships as proposed. Nothing reads this file today |
| 9.15 | Cap 14 — three health series | **BUILDABLE-WITH-CHANGES** | `[V]` mutation records carry `fields[]` — *which* fields changed — and **not their values**. So "% of active normative items carrying a scope" **cannot be reconstructed for any past date**: you can see that `scope` changed on 12 July and not what it changed from | ship **(b)** pinned count and token cost and **(c)** days since the queue was empty as real series, from `session-start` records and `create`/`promote`/`discard`. Ship **(a)** as a current number with the reason it has no line. Do not draw a line the data cannot support — that is the defect class this whole review exists to police |
| 9.16 | Cap 15 — subagent coverage | **BUILDABLE** | `[V]` `ledgerKey` is `session_id::agent_id`; this repo's own `state/` holds 32 subagent seen files under one session id. README §8 documents the gap as one *"nothing in a plugin can close today"* | ships as proposed. A gap nothing can close must at least be visible |
| 9.17 | Cap 16 — revision store watchdog | **BUILDABLE** | `[V]` README §8, verbatim: *"`mycontext doctor` has no check for the directory at all"* | ships as proposed |
| 9.18 | Cap 17 — one unfinished-work queue over **four** stores | **BUILDABLE** | `[V]` all four are already assembled by `mycontext status --json` and nothing renders them together. Queues 3 and 4 rot for a *designed* reason — the lesson flow stops deliberately, and nothing reminds the human | ships as proposed. **The highest-value S in the whole review** |
| 9.19 | Cap 18 — lesson yield | **BUILDABLE** | `[V]` the `produced` edge is deliberately not written, so this is the **only** way to walk lesson → rule; the graph cannot do it | ships as proposed |
| 9.20 | Two workspaces side by side (a second read-only root) | **BUILDABLE-WITH-CHANGES** | `[R]` a root **per request** is an arbitrary-path read primitive over HTTP, on a server whose entire security model is loopback + one token + idle-out | accept a root only **per instance** (a second `mycontext ui` on a second port) or from a server-side allow-list minted at startup — never from a query string. That preserves the model and needs no path validation at all |
| 9.21 | *"This machine, since <date>"* on every history-based surface | **BUILDABLE** | `[V]` five stores each write their own `.gitignore` containing `*`; the knowledge travels and every piece of evidence about its use stays behind | ships as proposed, as a **label**, not a caveat |
| 9.22 | The PR-effect view — a scope diff rendered as files gained and lost | **BUILDABLE** | `[R]` computable from the checkout alone by pure functions, with no history and no git parsing | ships as proposed. **The highest-value team capability available under the constraints, and it needs nothing that does not exist** |
| 9.23 | Delivery is never rendered as compliance | **BUILDABLE** | `[V]` `decay`'s own preamble — *"the ledger records injection, not reading or reliance"*. A "rule effectiveness" score would be exactly the class of false claim `STD-guarantee-claims-carry-their-condition-in-the-same-sentence` exists to refuse | ships as a rule |

---

## The sketches, extracted

**Measured `[M]`** by exhaustive occurrence counts over all nine files (7,015 lines), excluding
self-documenting prose mentions, which several files contain because they are *about* the CSP.

### What is actually there

| File | lines | `<style>` / CSS lines | inline `<script>` / JS lines | `style="…"` attrs | `innerHTML` | `.style.X=` | `setProperty('--` | `<template>` |
|---|---|---|---|---|---|---|---|---|
| `00-mockup-before.html` | 841 | 1 / 179 | 1 / 138 | **89** (78 static + **11 emitted from JS strings**) | 8 | 2 | 0 | 0 |
| `00-mockup-current.html` | 802 | 1 / 188 | 1 / 219 | 25 | 11 | 2 | 0 | 0 |
| `02-ia.html` | 465 | 1 / 154 | 1 / 33 | 26 | 0 | 0 | 0 | 0 |
| `03-interaction.html` | 893 | 1 / 200 | 1 / 560 | 9 | 14 | 7 | 0 | 0 |
| `04-visual.html` | 406 | 1 / 239 | 1 / 41 | 17 | 2 | 0 | 0 | 0 |
| `05-dataviz.html` | 1429 | 1 / 291 | 1 / 792 | 38 | **0** | 9 | 0 | 0 |
| `06-a11y.html` | 768 | 1 / 219 | 1 / 396 | **0** | **0** | 0 | **1** | 0 |
| `07-arch.html` | 655 | 1 / 52 | 1 / 493 (`type="module"`) | **0** | **0** | 0 | 0 | **5** |
| `08-onboarding.html` | 756 | 1 / 191 | 1 / 35 | 9 | 0 | 0 | 0 | 0 |
| **total** | **7,015** | **9 / 1,713** | **9 / 2,707** | **213** | **35** | **20** | **1** | **5** |

**The clean bill is as important as the violations.** Confirmed **zero occurrences across all nine files**
of: `<script src>`, `<link rel=stylesheet>`, `@import`, `@font-face`, any `http(s)://` in a `src`/`href`
(the two hits in `05-dataviz.html:653` are the SVG and XHTML **namespace URIs**, not fetches), `data:`
URIs, base64 blobs, `javascript:` URLs, inline `on*=` HTML attributes, `eval(`, `new Function(`,
`document.write`, string-form timers, `document.createElement('style')`, `cssText`, `<canvas>`,
`<iframe>`/`<object>`/`<embed>`, `<img>`, `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
`localStorage` and `sessionStorage`.

**So the entire CSP exposure is exactly three things**: one `<style>` block per file (1,713 CSS lines),
one inline `<script>` block per file (2,707 JS lines), and 213 `style=` attributes. Nothing needs a remote
asset, an event-handler attribute, or `eval`. **That is a far better starting position than the mockup
suggested**, and it means extraction is mechanical for seven of the nine.

### What survives extraction, and what does not

**Survives verbatim** — move the `<style>` block to `app.css` and the `<script>` block to a module:
`02-ia.html`, `06-a11y.html`, `07-arch.html`, `08-onboarding.html`. `08-onboarding.html:721-722` already
prefaces its script with a note that `script-src 'self'` forbids it and names the file it belongs in.

**Survives with mechanical edits:** `04-visual.html` (17 `style=` attrs, 2 `innerHTML`),
`05-dataviz.html` (38 `style=` attrs, zero `innerHTML` — every chart is built through an `el()` helper over
`createElementNS`), `03-interaction.html` (**7 of its 14 `innerHTML` sites are just `host.innerHTML = ''`**,
a one-for-one swap to `replaceChildren()`, and the file already has an `el()` builder and five
`createTextNode` calls — the good path exists and is simply not used everywhere).

**Does not survive.** Five patterns, and one of them is the reason 06's string-table fix is first:

1. **The i18n round-trip — `el.dataset.en = el.innerHTML` then `el.innerHTML = translation`.** Nine sites
   across three files (`00-mockup-current.html:656,657,661`; `03-interaction.html:370,371,375`;
   `04-visual.html:389,392`). It **serializes live markup into an attribute and re-parses it on every
   language flip**, and `textContent` cannot replace it because the values *are* markup. This is
   `06-a11y.md` finding 1 and `07-arch.md`'s "a string table value may not contain `<`" seen from the
   sketch side. **One fix — named placeholders with node substitution — kills all nine sites, the bidi
   defect and the CSP violation together.**
2. **Dictionaries whose values are HTML strings.** `00-mockup-before.html:804-806` (`SP`) and `:815-816`
   (`AE`) hold raw markup **with six embedded `style="…"` attributes inside the strings**. Data and markup
   are fused; no template can be cloned without splitting the dictionary first.
3. **Functions that return HTML.** `00-mockup-current.html:789` — `$('#ctx').innerHTML = CTX[ci]()`. The
   return type has to change to a `DocumentFragment`.
4. **`style=` attributes emitted from JS string literals.** Eleven of `00-mockup-before.html`'s 89
   (`:752,753,804,805×3,806×2,815,816×2`). **These survive a markup-only sweep and die only at runtime** —
   which is exactly why `07-arch.md`'s scan must run over the JS, not just the HTML.
5. **Attribute-position interpolation.** `00-mockup-current.html:689-691` interpolates into
   `data-sid="${id}" aria-selected="${i===0}"`; `:764-765` and `:775-776` interpolate a computed
   `class="chip ${…}"`. Text-position interpolation has an easy answer; attribute-position needs
   `setAttribute` and `classList.toggle`, which is a different rewrite.

**The migration target already exists in-repo and can be lifted verbatim.** `07-arch.html` is the
reference: five real `<template>` elements, `tpl.content.cloneNode(true)`, a `fields().text()` filler,
and `root.replaceChildren(frag)` with the comment *"never innerHTML, not even `''`"*. It also carries a
live XSS probe as fixture data (`:348`, an `<img src=x onerror=…>` string in a title) that is rendered
safely — the only `onerror` in the whole set, and it is a test, not a violation. `06-a11y.html` is the
second reference: zero `style=` attributes, zero `innerHTML`, six `replaceChildren`, and the one CSSOM
write the tree needs — `tw.style.setProperty("--lvl", lvl)` at `:579`, documented in place as surviving
`style-src 'self'`.

### Four things the sketches say by omission

- **`prefers-reduced-transparency` appears zero times in all nine files**, while five of them carry
  `light-dark(rgba(…))` shadows. R5 will multiply that gap.
- **`backdrop-filter`, `filter:` and `mix-blend-mode` appear zero times.** **Nobody has sketched R5.**
  The gloss is the only owner requirement with no drawing behind it, which is why §R5 below is a
  specification rather than a critique.
- **`forced-colors` appears once**, in `06-a11y.html:223`. `@media print` appears twice
  (`00-mockup-current.html:195`, `06-a11y.html:237`). `prefers-reduced-motion` three times.
- **`03-interaction.html` contains non-UTF-8 bytes and ripgrep classifies it as binary**, so it needs
  `-a`/`--text` to scan at all. That is the same defect class as plan 1's two NUL bytes at line 2338,
  which `2026-08-18-v2-decisions.md` §8 already records as making `grep` truncate its own output. A
  review artefact that hides from the tools used to review it should be fixed before it is cited.

---

## R1 and R2 — the markdown problem

### The ruling, first

**R1 — a markdown viewer, in-app: BUILDABLE-WITH-CHANGES.** Buildable as a **subset renderer that emits a
DOM tree**, never as a CommonMark renderer and never as an HTML producer. The change is that it must be
specified as a subset, named on screen, and must render its own refusals.

**R2 — README and documentation in the UI: split verdict.** The **English README is
BUILDABLE-WITH-CHANGES**. Three parts of R2 are **NOT AS PROPOSED**: the Hebrew README as it stands, the
five mermaid diagrams, and the five badge images. **Mintlify is refused**, on four independent grounds.

### Why the trust boundary actually moves

`07-arch.md`'s defence is that *"`textContent` is the only text sink … there is no escape function, because
there is nothing to escape."* That is correct and it is the right architecture. **A markdown renderer
changes the premise, not the mechanism.** Today a corpus body is *text that cannot become structure*. With
a renderer, a corpus body is *text whose purpose is to become structure*. The `innerHTML` ban does not
resolve that; it only decides *how* the structure is produced.

So the reconciliation, stated as a rule that a grep can enforce:

> **A renderer may create elements from a closed, hard-coded allow-list of tag names and set attributes
> from a closed, hard-coded allow-list of names and validated values. It may never assign markup, and every
> text leaf still goes through `textContent`.**

That keeps all seven of `07-arch.md`'s source scans intact — the renderer contains no `innerHTML`, no
`insertAdjacentHTML`, no `setAttribute('style'|'href'|'src'|'srcdoc')` — while letting `<h2>`, `<ul>`,
`<code>` and `<table>` exist. `[V]` It also composes with `require-trusted-types-for 'script'`: a
DOM-building renderer never touches a Trusted-Types sink, so the runtime enforcement stays on.

### What is safely renderable, and what must be refused

**Render (the subset).** ATX and setext headings (level-shifted so a document `#` never becomes the page's
`<h1>` — 06's heading contract), paragraphs, hard breaks, emphasis, strong, inline code, fenced and
indented code blocks, blockquotes, ordered and unordered lists, GFM task-list items (as a disabled
`<input type=checkbox>` or a glyph), thematic breaks, GFM tables, and GFM strikethrough. Every one of
these is **structure only** — no construct in that list carries a URL, a script, a style or a remote
fetch. `[V]` A tested precedent for the hard half already exists in-repo: `test/helpers/markdown.ts` (119
lines) implements a real CommonMark **fence tracker** — not a `/^```/` toggle, and its docstring records
that the toggle *"was wrong and stayed green by luck"* against the five-backtick blocks both READMEs carry
— plus heading extraction and GitHub anchor slugs. That is the block-structure spine, already written,
already tested, already zero-dependency.

**Refuse, and render the refusal.**

| Construct | Why | Treatment |
|---|---|---|
| **Raw HTML blocks and inline HTML** | CommonMark passes it through. This is the whole attack surface and it must not be reachable from an item body | render the source verbatim in a `<pre>` via `textContent`, marked *"raw HTML — shown as source"*. Never parse it. **One narrow exception for R2, below** |
| **Links** | the URL is attacker-controlled, and `07-arch.md`'s layer-4 discipline says *"nothing in the corpus produces a URL, so no corpus value ever reaches `href`/`src`"* — a renderer breaks that by design | allow-list schemes `http:`, `https:`, `mailto:` **after** HTML-entity decoding and percent-decoding, because `&#x6a;avascript:` is the classic bypass and the check must run last, not first. Everything else renders as inert text with the URL visible. Add `rel="noopener noreferrer"` and mark external links |
| **Images** | `img-src 'self' data:` permits `data:` — and an SVG data URI is a payload shape nobody wants aimed at agent-authored text | **refuse images in item bodies outright**; render `![alt](src)` as text. For R2 only, allow `self`-origin repo-relative images through a dedicated, traversal-guarded route |
| **Autolinks `<http://…>`** | same URL problem, and lexically indistinguishable from raw HTML | same allow-list as links |
| **Reference-style links and link reference definitions** | indirection makes the URL check easy to place wrongly | supported, with the scheme check applied at **resolution**, not at definition |
| **Info strings on fences** | a language tag becoming a class name is an attribute-injection primitive | put it in `data-lang` via `setAttribute` with an `[A-Za-z0-9+#.-]{0,20}` check. There is no highlighter and there must not be one — it would be a dependency |
| **Footnotes, definition lists, math, directives, front-matter** | not needed and each adds grammar | refuse silently; they render as literal text |

**And the boundary is made visible rather than assumed** — which is what R1 actually asks. Every rendered
document sits inside a bordered region with three things: (1) a header naming its provenance (item id +
`filePath`, or the doc path), (2) a **"view source"** toggle showing the raw bytes in a `<pre>`, and (3) a
footer that states what was not rendered — *"2 raw HTML blocks, 1 link to an unsupported scheme and 3
images were shown as source."* That is `INV-nothing-is-dropped-silently` applied to a renderer, and it is
the honest answer to *"what does it not render"*: the renderer **says so, per document, every time**. A
renderer that silently drops constructs is the same defect as a chart that silently drops rows.

**Size.** A strict CommonMark implementation is ~3,000 lines and is a maintenance liability. The subset
above is **~450–600 lines** plus the existing fence tracker. It must be named a subset in the UI and in its
own docstring, never described as "markdown support" — `STD-guarantee-claims-carry-their-condition-in-the-same-sentence`
applies to a renderer's own claim about itself.

### R2, measured

`[M]` Counts taken over the real files, excluding fenced blocks and inline code spans:

| | `README.md` | `docs/README.he.md` | `docs/TUTORIAL.md` | `docs/TUTORIAL-ADVANCED.md` |
|---|---|---|---|---|
| lines | 4,704 | 5,112 | 335 | 476 |
| Hebrew-containing lines | 5 | 2,383 | **0** | **0** |
| raw HTML outside fences | `<div>` 2, `<details>` 4, `<summary>` 4, `<b>` 4 | **`<div>` 240, `<span>` 1,837**, `<details>` 4, `<summary>` 4, `<b>` 4 | none | none |
| code fences | 212 | 212 | 36 | 36 |
| table rows | 240 | 240 | — | — |
| images | 5 | 5 | 0 | 0 |
| ```` ```mermaid ```` blocks | 5 | 5 | 0 | 0 |

**The Hebrew README's correctness is raw HTML — NOT AS PROPOSED.** `docs/README.he.md` carries **120
`<div dir="rtl">` blocks and 918 `<span dir="ltr">` runs**, and its own header comment explains why, having
been *"established by rendering this file through GitHub's own markdown API and reading the result in a
browser rather than by reasoning about the source"*: without the wrapper `<id>` renders with its angle
brackets mirrored and `--json` renders as `json--`. A renderer that refuses raw HTML — which it must, for
item bodies — renders the Hebrew README either as LTR-jumbled prose or with 1,838 visible literal tags.
**This is the single hardest thing in the addendum and it has a cheap, honest answer:**

> **A closed two-tag exception, applied only on the documentation route and never to item bodies.**
> Permit exactly `<div>` and `<span>`, with exactly one attribute, `dir`, whose value must be exactly one
> of `rtl`, `ltr`, `auto`. Every other tag, attribute and value is refused as raw HTML. Verified: those two
> tags with that one attribute are **100 % of the raw HTML in `docs/README.he.md`** — there is nothing
> else to allow. The exception is ten lines, greppable, and pinned by a test asserting that the two
> documentation files contain no raw HTML outside that grammar, so a future edit that adds an `<a>` fails
> CI rather than the renderer.

`<details>`/`<summary>` (4 each, in **both** documents) needs the same treatment or the English README
loses its collapsible sections; both are structural, attribute-free and safe, so extend the allow-list to
four tags. `<b>` appears only inside mermaid node labels, i.e. inside fences, and needs nothing.

**The five badges — NOT AS PROPOSED.** All five are `https://img.shields.io/badge/…` and `[V]` the CSP is
`img-src 'self' data:`, so every one is **blocked by the product's own header**. Nearest buildable: the
viewer detects `img.shields.io` (and any off-origin image) and renders the badge's *text* — `version 1.0.2`,
`node ≥ 24`, `runtime dependencies 0` — as a chip. That is better than the image on a local tool, needs no
network, and is honest. The alternative — relaxing `img-src` — trades a header directive against five
decorative images and must not be taken.

**The five mermaid diagrams — NOT AS PROPOSED.** A mermaid renderer is a parser, a layout engine and an
SVG emitter; it is a dependency in every sense and it is not being hand-written. Two buildable options,
and the first is the honest one: **(a)** render the fence as a labelled code block — *"diagram source;
rendered on GitHub"* — which costs nothing and claims nothing; **(b)** commit hand-authored SVGs beside the
document and serve them from `self`, which is CSP-clean and *not* a build step (a committed asset is a
source file), but creates a generated artefact that will drift, so it needs a freshness checker in the
style of `parity.test.ts` — assert the SVG's embedded source string still equals the fence. Recommend
**(a)** for wave 2 and **(b)** only if the diagrams turn out to matter.

**Mintlify — REFUSED, on four independent grounds, any one of which is fatal.**

1. `[V]` **It is a build step.** `CONST-node-24-no-build-step`: *"There is no compile step and no `dist/`."*
   `package.json` has **no build, bundle, compile, prepare or prepublish script** and `bin` points at
   `./src/cli/index.ts` directly. Mintlify's model is source-in, static-site-out.
2. `[V]` **It is a dependency.** `CONST-zero-runtime-dependencies`: *"No runtime dependency may be added to
   `package.json`."* `package.json` has no `dependencies` key and `devDependencies` is exactly
   `typescript` and `@types/node`.
3. `[V]` **The product has already refused it by name.** `NOGOAL-not-a-claude-mem-replacement` carries the
   boundary *"Not a general knowledge base, and **not a documentation site generator**."* That is pinned,
   `severity: hard`, `always: true`, and injected into every session on this repo. Adopting a documentation
   site generator would require superseding the product's own non-goal, not arguing an exception to a
   constraint.
4. `[R]` **Its output does not run under this CSP.** A generated docs site is a client-side framework
   application: inline bootstrap scripts, remote fonts, a hosted search index, analytics. Under
   `default-src 'none'; script-src 'self'; style-src 'self'` with no `'unsafe-inline'`, it renders as an
   unstyled document. And it is a hosted service, which a loopback-only, mutator-free, idle-out server has
   no business depending on.

**What is lost by refusing it, stated plainly:** generated navigation, full-text search, versioned docs,
OpenAPI rendering, and the visual polish. **What replaces it, at a fraction of the cost:** the subset
renderer produces the heading tree as a by-product, so the table of contents and in-page navigation are
free; `parity.test.ts` already holds EN/HE structure; `capabilities.test.ts` already resolves links to
anchors using the same `headings()` helper. Search is the only real loss, and the spec has already
committed to not having one.

### R3 — tutorials, EN + HE

**BUILDABLE-WITH-CHANGES.** The *viewer* is R1's renderer with no new mechanism, and `[V]` both tutorials
contain **zero raw HTML and zero Hebrew** — they are the easiest documents in the repository to render.
Three findings shape the work:

- **The Hebrew tutorials are new writing, not a build problem.** `docs/TUTORIAL.he.md` and
  `TUTORIAL-ADVANCED.he.md` do not exist; `docs/README.he.md` is the only mirrored document. 811 English
  lines to mirror.
- **The refactor to do first is the missing net.** `[V]` both tutorials have no generated block and no
  parity test, recorded in `CHANGELOG.md` as *"a known gap, recorded here rather than discovered later."*
  Extend `scripts/gen-doc-examples.ts` to cover them and `parity.test.ts` to a third and fourth document
  **before** anything is translated, or the Hebrew is written against prose that is already stale.
- **"How does a tutorial stay true" has a concrete, cheap answer.** `[V]` every CLI command already
  declares an allow-list (`ADD_VALUE_FLAGS`, `edit.ts`'s `ALLOWED`, `review.ts`'s per-subcommand
  `allowed`, `REPAIR_FLAGS`, …). A ~60-line test that scans every `mycontext <cmd> …` invocation in every
  tutorial code fence and asserts each flag is in that command's allow-list catches "teaches a flag that
  no longer exists" mechanically, in CI, forever. It is the same enforcement shape as 1.3's inverse palette
  test and the two should share a helper. **This is the highest-value part of R3 and it is not the viewer.**

### R4 — integrated help

**BUILDABLE-WITH-CHANGES**, and the mechanism is decided by one constraint the addendum names and one it
does not.

**The mechanism.** Help is a **term-anchored disclosure**, not a destination and not a tooltip. The string
table already substitutes *nodes* for named placeholders (6.1), so every technical term rendered anywhere
in the app already passes through one function. Make that function attach the disclosure: the term is a
`<button>` with `aria-expanded`/`aria-controls` opening one paragraph plus a link into the doc viewer at
the right heading (R2's anchor helper, already written). **One glossary, keyed by term, rendered wherever
the term appears.** A source scan asserts every term used has exactly one entry and no entry's text is
duplicated into a string-table value — which is what stops it becoming a fifth spelling.

**The "how will you know it worked" half** is 03's landing predicate written into the glossary entry for
each composed command: the help text for `review promote-revision` says what will change and what the UI
will accept as proof, which the user has agreed to before the paste.

**Two obstacles the addendum does not mention, both `[V]`:**

1. **Three of the four existing help topics have no Hebrew source at all.** `src/help/topics/` has
   `categories.he.md` and nothing else; `scope.md`, `capture.md` and `workflow.md` are English-only. So
   "help in English and Hebrew" is new writing for three-quarters of the existing corpus of help before a
   single new glossary entry is authored.
2. **`/api/help/:topic` will throw on day one in Hebrew.** `src/help/index.ts:54-64` builds the path as
   `` `${topic}.${locale}.md` `` and a missing locale file **throws rather than falling back**. The UI's
   Hebrew help route hits that on `scope`, `capture` and `workflow` immediately. Nearest buildable: a
   deliberate, disclosed fallback — serve the English topic with a visible *"not yet translated"* band —
   because silently serving English under a Hebrew UI is the same class of lie as an unlabelled empty
   region. Do not add a silent fallback in `src/`; the throw is correct for the generator, and the UI is
   the caller that should decide.

Also `[V]`: **the CLI is deliberately not localised** — `src/help/index.ts:13-19` states *"The CLI itself
is NOT localized — `mycontext help` speaks English on every terminal"*, and `MYCONTEXT_DOC_LOCALE` is
*"an undocumented pin for the generator and its drift test, not a user surface."* So **the UI is the first
localised user surface this product has**, and it cannot reuse a single byte of the CLI's Hebrew output.
That is a scope fact worth stating before R4 is estimated.

---

## R5 — the gloss

**BUILDABLE-WITH-CHANGES**, and the changes are specific. `[M]` Everything numeric below was measured here
with a WCAG 2.x relative-luminance script compositing sRGB over the mockup's own `light-dark()` token
pairs; the baseline reproduces `06-a11y.md`'s published table exactly, which is why the deltas can be
trusted.

### `backdrop-filter` is refused — on its own merits, not on 04's taste

CSP does not block `backdrop-filter`; it is a CSS property, not a resource. The refusal is arithmetic.
**A backdrop blur only does something when there is something behind it to blur.** In this design a card
sits on `--paper` — a flat colour. Blurring a flat colour returns the flat colour. `backdrop-filter` would
promote every card to its own compositing layer and read back the backdrop **for a visually identical
result**, and the coverage map already has a measured performance problem in the same screen. A
`brightness()`/`saturate()` backdrop would do something, but that is a tint, and a tint is
`background: color-mix(…)` at zero compositing cost. **So: no `backdrop-filter` anywhere.** This is also
`04-visual.md`'s conclusion reached by a different road, which is how the owner's requirement and the
panel's refusal are reconciled without either being overruled.

### What actually produces "3D, above the surface" — four opaque mechanisms and one translucent one

| Mechanism | Print | `forced-colors` | `prefers-reduced-transparency` | Cost |
|---|---|---|---|---|
| A lightness step (`--panel-2`) | survives as a grey | replaced by system `Canvas` | unaffected — it is opaque | free |
| A 1px **inset** top highlight | must be nulled | dropped | unaffected | free |
| A two-layer shadow: a tight contact shadow + a soft ambient one | must be nulled | dropped | **must go opaque or off** | one paint |
| A hairline border, darker at the block-end than the block-start | survives | replaced by `ButtonBorder` | unaffected | free |
| **The gloss** — a low-alpha `linear-gradient` in `::before`, `pointer-events:none` | **must be nulled** | **must be nulled explicitly** | **must go to `opacity:0`** | one paint |

The first four carry almost all of the "above the surface" reading and none of them costs contrast.
The gloss is the fifth, and it is the one with the constraints.

### The measurements that decide the gloss

**1. A gloss painted *over* content makes every existing near-miss worse and improves nothing.**
`[M]` compositing white at alpha α over the card and its contents:

| α | light: `--gold` on `--goldbg` | light: `--faint` on `--panel` | dark: `--gold` on `--goldbg` | gold vs ok |
|---|---|---|---|---|
| 0 (today) | 4.31 ✗ | 3.14 ✗ | 7.82 | 1.04 ✗ |
| 0.04 | **4.00** | 2.97 | 7.19 | 1.04 |
| 0.08 | **3.73** | 2.81 | 6.54 | 1.04 |
| 0.14 | **3.35** | 2.60 | 5.59 | 1.03 |
| 0.20 | **3.03** | 2.40 | 4.75 | 1.03 |

Three of the four already-failing light-mode chips lose a further 0.3–1.3 of ratio at alphas that are
visually subtle. **Rule: the gloss never overlays text or a status chip.** It lives in a band with nothing
under it — the card's top header strip — or it is a border-region treatment only.

**2. In dark mode the entire gloss budget is 7 %.** `[M]` white over `--panel` `#17171c`, measuring
`--dim` (the colour of every `.small` and `.psub`):

| α | 0 | 0.04 | 0.07 | **0.08** | 0.14 | 0.20 |
|---|---|---|---|---|---|---|
| `--dim` on the lifted panel | 5.53 | 5.01 | 4.59 | **4.45 ✗** | 3.64 ✗ | 2.94 ✗ |

**α = 0.07 is the ceiling in dark mode**, for `--panel-2` (4.3) and for any gloss behind text alike.
`--ink` stays comfortable to α ≈ 0.25, so a card whose only text is `--ink` has headroom — but that is a
per-card licence, not a global one, and it has to be written into the primitive.

**3. In light mode a white gloss is a no-op.** `--panel` is `#fffffe`. There is no headroom above it, so
"lighter and above" cannot be expressed as a lift. `[M]` white over `--sink` *does* work (`--dim` 5.08 →
5.26 at α=0.20), so the gloss in light mode is a **specular highlight over the darker surfaces and a
shadow/hairline treatment on the panel**, not a wash. **The light and dark implementations are not the
same rule with different values; they are different rules.** That is the single most important thing to
know before this is built.

**4. A gradient gloss cannot be audited by a single contrast number.** `[M]` a 0.18 → 0.00 vertical
gradient over `--panel` in dark mode gives `--dim`:

`3.16` at the top · `3.64` · `4.17` · `4.73` · `5.27` · `5.53` at the bottom.

Contrast becomes a function of vertical position, and `06-a11y.md`'s method — one ratio per token pair —
stops describing the design. **Either the gloss uses a uniform alpha over any region containing text, or
the region it gradates contains no text.** Take the second: it is what the "band with nothing under it"
rule already buys, and it keeps the contrast test a table of numbers rather than a rendering harness.

### The 1.04:1, and why the gloss cannot be blamed for it and must not be allowed to touch it

`--gold` against `--ok` is **1.04:1 in light and 1.43:1 in dark** — the coverage map's central
distinction, invisible to a dichromat. `[M]` the gloss moves it to 1.03. So the gloss neither causes nor
meaningfully worsens it. But `[M]` converted to sRGB grey for print, `--gold` → `#70`, `--ok` → `#6d`,
`--warn` → `#72`: **three of the four semantic accents land within 5/255 of each other.** On the printed
coverage map the spec *requires*, colour carries no information at all. **Shape redundancy (6.9) is not a
gloss requirement and not optional; the gloss must simply not overlap the dots**, because at α > 0 it eats
what little separation the ink has.

### The four media queries, written out

```css
@media print {
  .card::before { background-image: none; }
  .card { box-shadow: none; border-color: #999; background: #fff; }
}
@media (forced-colors: active) {
  .card::before { display: none; }        /* background-image survives forced colors — null it explicitly */
  .card { border: 1px solid ButtonBorder; box-shadow: none; }
}
@media (prefers-reduced-transparency: reduce) {
  .card::before { opacity: 0; }
  :root { --panel-2: <opaque value>; }
}
@media (prefers-reduced-motion: reduce) {
  .card { transition: none; }             /* a gloss that moves on hover is motion */
}
```

The `forced-colors` line is the trap: forced colours replace `background-color` and **do not remove
`background-image`**, so a gradient gloss survives High Contrast unless it is nulled by name. `[M]`
`forced-colors` appears exactly once in all nine sketches and `prefers-reduced-transparency` appears zero
times, so both are new work.

### The one change that makes the gloss earn its place

`04-visual.md` argues for *shine that encodes meaning* and warns that spreading the accent dilutes the one
place it carries information. R5 asks for a gloss. **They converge if elevation encodes epistemic
status** — which is 04's own 30px-measured-number idea generalised from type to depth:

> **A card is raised, and carries the gloss, when its content is observed and recorded. A card is flat,
> recessed and unglossed when its content is predicted, counterfactual or illustrative.**

The injection preview of a real session start is raised. The budget *simulator* is flat. Recorded audit
records are raised; the why-not panel's live re-derivation is flat. `.was`/`.will` values (3.10) can never
appear on a raised surface. Then the answer to *"pick any number at random — can you tell whether it is
real?"* is visible from across the room, the gloss is a third channel for the one distinction this product
keeps getting wrong, and it is achromatic — white and black at low alpha — so **gold's rarity is
untouched**. The owner gets the 3D-above-the-surface effect; the panel gets shine that cannot be applied
to an unbacked claim; and both are testable, because "is this card raised" is a class name a golden-tree
test can assert.

---

## Conflicts

Eleven pairs where two experts propose incompatible things. In each, the cheaper thing to give up is named.

| # | The pair | The incompatibility | Give up |
|---|---|---|---|
| 1 | `03-interaction` §Preview 4 (cut line through a stable ranking, 60 fps, exact) vs `05-dataviz` §3 (staircase with **downward** steps) | They describe different selectors. `[V]` `fitToBudget` is first-fit; raising a budget can evict. Both pictures cannot be of the same function | **Give up 03's cut line.** 05's sweep is the same "instant" and it is true. 03 flagged the property `[?]`; it does not hold |
| 2 | `03-interaction` §Deep-linkable (`#/palette?…`) vs `07-arch` §Routing (fragment reserved for the nonce) | `[V]` `history.replaceState` wipes the fragment on load, so a hash route and a handoff nonce cannot coexist in one URL — and every open is a handoff | **Give up hash routing.** 07's path routing preserves the whole feature and enables `mycontext ui --at` |
| 3 | `03-interaction` §Keyboard (bare `n`/`c`/`x`/`a`/`r` globally) vs `06-a11y` §Shortcut layer (off by default, never bare printable keys globally) | WCAG 2.1.4, and screen-reader browse mode claims every printable key | **Give up the bare keys.** Keep 03's binding-table-generates-the-sheet rule, which 06 does not contradict |
| 4 | `04-visual` §Decoration ("reject `backdrop-filter` glassmorphism") vs **R5** (owner requires the gloss) | a panel may not refuse a requirement | **Give up `backdrop-filter`, not the gloss.** It is a no-op against a flat backdrop, so the refusal survives on its own merits and the requirement is met by other mechanisms (§R5) |
| 5 | `04-visual` §Dense surfaces (`[role="treeitem"][style="--depth:n"]`) vs the CSP | `[V]` `style-src 'self'` blocks the `style` attribute, in markup and in a `<template>` | **Give up the attribute.** `el.style.setProperty('--lvl', n)`, as `06-a11y.html:579` already demonstrates |
| 6 | `04-visual` §Palette (`color-mix(in oklch, …)` derived tints) vs `06-a11y` §Colour (a script over literal token pairs) | a computed value cannot be read from source; the audit that found five failures goes blind | **Give up nothing — pay for it.** Implement oklab mixing in the contrast test (~50 lines). But do **not** adopt `color-mix` before the test can read it |
| 7 | `01-coverage` "cannot be exposed" §6 (no-workspace is a first-class **page**) vs `08-onboarding` (`mycontext ui` refuses at the CLI) | a server with no `.my_context` has no corpus, no config and no db path to open | **Give up the page.** Keep 01's wording and print it from the CLI |
| 8 | `02-ia` §Cut (`Learn` deleted as a destination; `status` cut) vs `08-onboarding` ("never hide a screen") and **R2/R3** (a docs and tutorial viewer is a destination) | 02 predates the addendum | **Give up the cut of `Learn`.** Keep 02's mechanism as R4 and add a Docs destination; keep `status` reachable from the counts. They are layers, not rivals |
| 9 | `07-arch` §Rendering (`textContent` is the only sink; `innerHTML` banned by source scan) vs **R1** (a renderer is an HTML producer) | the ban and the requirement are both non-negotiable | **Give up neither.** The renderer emits a **DOM tree from a closed tag allow-list**; text leaves still go through `textContent`; all seven scans stay green (§R1) |
| 10 | `07-arch` §Data (generation = items count + max mtime) vs spec §3 (`/api/select` takes `focus` and `seen`) | `[V]` the generation does not cover `config.json`, `state/focus.json` or the seen files, so the `session` cache serves a stale preview after a focus change | **Give up the single-source generation.** Make it a tuple over items + config + `state/`. Otherwise the cache manufactures the exact risk spec §8 lists |
| 11 | A safe markdown renderer (refuses raw HTML) vs `docs/README.he.md` (1,838 `dir` wrappers carry the bidi contract) | refusing raw HTML destroys the Hebrew README; permitting it aims a parser at agent-authored text | **Give up "no raw HTML" only on the documentation route**, and only for four tags with one attribute and three permitted values, pinned by a test. Item bodies keep the absolute refusal |

---

## Cost ranking

S = a screen or a rule over reads that exist · M = a real projection, a new join, or a source change
· L = a new mechanism. Waves are decision 4's: **W1** plan 1 Tasks 1–17 + the coverage map · **W2**
plan 2 · **W3** plan 3 + plan 1 Tasks 18–19.

### Wave 1 — the things that get more expensive every day they are not done

| Cost | Item | Why now |
|---|---|---|
| **S** | **Emit the CSP header** (all eight directives) | It exists in no plan. Every ruling above depends on it, and it costs three lines *before* any screen exists |
| **S** | **The string table: named placeholders, no markup, node substitution** | Closes bidi isolation, `innerHTML`, CSP and plurals in one change. 06: retrofitting after wave 2 costs 5× |
| **S** | **The seven source scans + the physical-property CSS lint + the §0-landed checker** | The cheapest high-leverage items in the review. Enforcement over discipline is this project's culture |
| **S** | `<template>` + `fields()`; `replaceChildren` never `innerHTML=''`; build-then-swap | Sets the idiom before sixteen screens set a different one |
| **S** | Screen teardown; one refcounted stream; heartbeat `visible && interacted` | `[V]` a verified leak and a verified request-amplification bug |
| **S** | The six palette tokens; `--faint`; shape redundancy on the dots; the blue focus ring | `[M]` five measured failures, one at 1.04:1 |
| **S** | `forced-colors`, `prefers-reduced-motion`, `prefers-reduced-transparency`, the fixed print block | Four media queries. Three of the four appear nowhere in nine sketches |
| **S** | Reflow: delete `overflow:hidden`/`100vh`, `rem` sizes, container-responsive grid | WCAG 1.4.10, and it is four edits now versus a re-layout later |
| **S** | **R5's gloss**, specified as §R5 | A translucent layer retrofitted after fifteen primitives is the RTL argument again |
| **S** | The provenance bar | One band; it is the seventeenth screen's insurance |
| **S** | Path routing, URL-as-store, per-screen param schemas | `[V]` the fragment collision breaks the only way the app opens |
| **S** | Pinned coverage leaves the tree; two truncations never merged; empty states name which zero | Three false statements in the flagship screen |
| **M** | **`injection()` returns a stable `code`** | Unblocks the why-not panel and the recovery ladder, the two highest-value diagnostics |
| **M** | The generation tuple + four cache classes + `/api/bootstrap` + memoized `select()` | In that order; the memo is unsafe before the tuple |
| **M** | `/api/coverage` directory rollup + prefix prune (property-tested) + virtualise + `<datalist>` | `[M]` a 5.6 s handler stalls the whole server, not one screen |
| **M** | The item detail pane; the why-not panel; ARIA tree; three live regions; focus management | The spine, and the a11y floor |
| **M** | The DOM double, golden trees, endpoint-contract tests | Turns "the rendering is untested" into a named, small residue |

### Wave 2 — the composer and the documents

| Cost | Item |
|---|---|
| **S** | The inverse palette-coverage test; enum pickers for the two closed vocabularies; `words: 2` for `unlink` |
| **S** | argv chips with copy blocked on an unsafe value; the copy `.then`/`.catch`; `--yes` as a decision |
| **S** | The global composer; deep-linked compose from every finding; `#/hooks` |
| **S** | Cap 17 — one unfinished-work queue over four stores. **The best value/effort in the whole review** |
| **S** | Cap 12 lifecycle debt; cap 16 revision watchdog; the `watchedDocs` day-one mismatch |
| **S** | Start-here strip; the fingerprint ping; per-command landing at "not seen yet" |
| **M** | The glob tester's two answers; bulk fan-out with counted exclusions |
| **M** | `POST /api/preview` — **after** `revision-apply.ts` is extracted |
| **M** | Word-level `<ins>`/`<del>`; the Configure diff with `dropped[]`; the composed `config.json` |
| **M** | **R1 — the subset markdown renderer (~450–600 lines) + the provenance frame + the refusal footer** |
| **M** | **R2 — the English README/docs viewer**, the four-tag `dir` allow-list, badge-as-chip, mermaid-as-source |
| **M** | **R4 — the term-anchored glossary + the one-entry-per-term scan + the disclosed Hebrew fallback** |
| **M** | `#/agent` — 14 tools, 62 params, the `agentEdits` join; the global layer; cap 9 reverse glob tester |
| **M** | The bootstrap doc scan, capped and off the landing path |

### Wave 3 — the record

| Cost | Item |
|---|---|
| **S** | Cap 6 deny wall; cap 5 nudge conversion; cap 8 degradation counter; cap 15 subagent coverage; cap 18 lesson yield |
| **S** | Cap 10A governing-set diff; cap 14 (b) and (c) as series, (a) as a number |
| **S** | Watch's `op` facet; the `audit --files` rollup; the focus-record rule across the feed; the pulse |
| **M** | **Cap 1 — the retrospective miss autopsy. If only one thing ships in wave 3, ship this** |
| **M** | Cap 4 compaction survival (a self-join the projection already indexes); cap 3 the rent roll |
| **M** | Cap 13 ingest yield; cap 7 agent authority; cap 11 lexical overlap report |
| **M** | The staircase + `?sweep=1` + eviction markers; the budget ribbon's positional ghost lane; 7a the diverging bar |
| **M** | The ego graph (five columns, ids not titles); the recency comb; the 90-day heatstrip |
| **M** | **R3 — the tutorial refactor, the generated blocks, the flag-existence checker, then `TUTORIAL.he.md` ×2** |
| **M** | `SpilledRef.cost` + the projection bump, with "not recorded" for all prior history |
| **L** | The status-line bridge (plan 3 Task 4) and 7b's session ribbon; cap 9's full authoring assistant |
| **L** | 9.20 two workspaces side by side — **an owner decision, and per-instance only, never a root per request** |

### Refused, and therefore costing nothing

`backdrop-filter` · Mintlify · a mermaid renderer · remote badge images · git object inflation (cap 10B) ·
in-UI writes of `config.json` or `focus.json` · a hash-routed deep link · a root-per-request server ·
bare printable-key shortcuts · a client-side budget cut line · inline `style=` anywhere.

---

## Headline

**The hard constraints are survivable and almost everything the panel proposed survives them — 104 of 143
proposals ship as written, 35 need a named change, and only 13 are refused — but the constraint doing the
most work in this review is currently owned by nobody: `grep` finds the Content-Security-Policy in exactly
one line of spec text and in zero lines of `src/` or of the three plans, whose only response headers are
`content-type` and `cache-control`.** The seven sketches are in far better shape than the mockup implied —
their entire CSP exposure is nine `<style>` blocks, nine inline `<script>` blocks and 213 `style=`
attributes, with zero remote assets, zero inline event handlers and zero `eval` — and the one pattern that
genuinely does not extract, the `dataset.en = innerHTML` i18n round-trip in nine sites across three files,
is killed by the same node-substituting string table that closes the bidi defect, the `innerHTML` trust
boundary and the plural contract, which is why it is the first thing to build. **R1 and R2 are buildable
only as a ~500-line subset renderer that emits a DOM tree from a closed tag allow-list and prints its own
refusals per document — Mintlify is refused four times over, once by the product's own pinned non-goal
*"not a documentation site generator"*, and the Hebrew README needs a four-tag, one-attribute exception
because 1,838 `dir` wrappers, not markdown, are what make it readable — while R5's gloss is achievable
with a measured ceiling of 7 % white in dark mode, never over text, never as a gradient where text sits
beneath it, nulled in print and forced-colors and reduced-transparency, and with `backdrop-filter` refused
on the arithmetic that blurring a flat backdrop returns the flat backdrop.**
