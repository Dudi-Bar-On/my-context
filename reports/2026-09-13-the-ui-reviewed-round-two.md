# The UI, reviewed again — round two

**2026-09-13 · a second, independent UI/UX review of the whole web application**

Driven in **one** Chrome page against the owner's running server at
`http://127.0.0.1:58888/`. Tools, all owner-approved: the `ui-ux-pro-max`
**119 UX guidelines** as an explicit rubric (the pack has grown from the 98 in
the brief — v2.13.0 ships 119, and I scored against all of them); the
`storybook-assistant` **accessibility-auditor** checklist (WCAG 2.2 A/AA/AAA,
accessible names, contrast, keyboard); the `frontend-excellence` css-expert /
component-architect / frontend-optimizer / state-manager lenses; and Chrome
DevTools MCP — Lighthouse, resource and navigation timing, the CSSOM, viewport
emulation, and scripted measurement in the page.

Round one is `reports/2026-09-12-the-ui-reviewed-as-a-user.md`. **This report
does not restate it.** Every one of its top five is re-measured below and given
a verdict; three of them come out differently.

**I changed no product code, no test and no corpus item. This file is my only
write.** I ran no git command that writes. I did not start, stop or signal the
server.

### What I created through the UI, and what I removed

The brief authorised exercising the writes. I made exactly one:

| | |
|---|---|
| Created | one anchor, `ZZ-ROUND-TWO-REVIEW-PROBE`, via **Mark this point** on an archive search hit |
| Then | renamed it to `ZZ-ROUND-TWO-REVIEW-PROBE-RENAMED` via **Rename** |
| Then | removed it via **Take it back** |
| Verified | `.my_context/.anchors.jsonl` is **684 lines, md5 `f7099a408b60de7dd3477b95fbaf4bca`** — byte-for-byte the baseline I took before touching anything, and `grep -c ZZ-ROUND-TWO` returns 0 |

I staged three retrieval briefs (they write nothing — `/api/retrieval` reports
`present: false`, and `.my_context/.retrieval` does not exist). **I approved no
staged restore**, because none existed to approve and staging one requires
running a helper agent in a fresh window, which is outside this review.

---

## The five things I would fix first

### 1. Two endpoints block the whole server for ~4 seconds each, on every call

**Screen:** all. **Severity: major. Size: half a day to confirm, unknown to fix.**

Round one measured 7 s to a usable page and blamed `app.js` (444 KB, "4,632 ms")
and `styles.css` (301 KB, "4,618 ms"). **That diagnosis is wrong, and the real
one is worse**, because round one's version is a one-time cold-load cost and the
real one recurs all day.

My cold load, cache bypassed, over loopback:

| | |
|---|---|
| DOMContentLoaded | 202 ms |
| **Rail and main usable** | **7,311 ms** |
| `app.js` (444 KB) | **21 ms** (4 ms TTFB + 15 ms download) |
| `styles.css` (301 KB) | **7 ms** |
| `/api/sessions` | 6,839 ms — of which **6,838 ms was TTFB and 0 ms download** |
| `/api/status` | 6,760 ms, same shape |
| `/api/watch/volume` | 6,829 ms, same shape |

Three independent requests returning within 80 ms of each other after waiting
6.8 s each, with zero download time, is not transfer cost. I proved the
mechanism directly — firing six endpoints serially, then in parallel:

| Endpoint | Alone | In parallel with the other five |
|---|---|---|
| `/api/status` | **4,288 ms** | 4,228 ms |
| `/api/doctor` | **5,385 ms** | 8,241 ms |
| `/api/meta` | 63 ms | **4,506 ms** |
| `/api/sessions` | **11 ms** | 8,437 ms |
| `/api/items` | 88 ms | 4,765 ms |
| `/api/watch/volume` | 70 ms | 8,428 ms |
| **Wall clock** | serial sum 9,905 ms | **8,437 ms** |

Parallel costs the same as serial: the server is **single-threaded and
synchronous**, so one slow handler parks every other request behind it. And the
six in-flight requests are also the browser's entire HTTP/1.1 connection pool
for the host — I measured exactly 6 in flight at t=3 s and t=5 s — which is why
`geist-mono-400.woff2` sat **5,748 ms before its request was even sent**.

`/api/sessions` costs **11 ms**. It was never the problem. The blockers are
**`/api/status` (3,829–4,669 ms) and `/api/doctor` (3,812–3,920 ms)**, and I
re-ran them three times each on a fully warm server to be sure they are not
cold-cache artefacts. They are not.

Guidelines **#49 Caching**, **#53 Render Blocking**, **#78 Loading
Indicators**.

Recommend, in order: (1) find what `/api/status` and `/api/doctor` do for four
seconds — everything under `src/ui/` uses synchronous `readdirSync`/`statSync`/
`readSync`, so a single directory walk over a 103 MB transcript archive
serialises the process; (2) move them off the boot path so the shell paints
without them; (3) then, and only then, compression and caching — which brings
me to:

**Still true, and confirmed:** `cache-control: no-store` on `/`, `/app.js`,
`/styles.css`, `/strings/en.js`, `/fonts/*` and `/api/status`; **no `ETag` on
anything**; **no `content-encoding` anywhere** (transfer 2,653,070 B against
decoded 2,642,570 B — a ratio of **1.004**). Fonts are immutable and re-fetched
every load. That is real but it is second-order: it costs tens of milliseconds
on loopback, not seven seconds.

### 2. Two of the four retrieval modes can never succeed

**Screen:** Conversations → *Reconstruct a subject*. **Severity: blocker.
Size: half a day.**

This is new today and it is the one blocker in this review.

The mode picker offers four ways in. Two of them take a pasted passage. The
other two — **"I am lost — what was being worked on?"** and **"where were the
fixed points?"** — do not, and the UI correctly hides the passage box for them
(`conversations.js:1923` reads the server's `needsText` flag to do it).

Both then fail, identically, every time. What the user gets:

> Nothing in that passage can be matched against the archive. … **Paste
> something that names things**: an item id, a file path, a function name.

…in a mode that has no paste field. And the brief it writes tells the helper:

> **Nothing was matched on.** Do not guess a subject: report that the passage
> named nothing the archive could be queried with, and stop.
>
> `| # | session | lane | record | byte offset | … |`
>
> **0 points.**

`/api/retrieval` itself declares these two modes as `needsText: false`:

```json
{"mode":"list-subjects","needsText":false},{"mode":"list-anchors","needsText":false}
```

**"where were the fixed points?" returning 0 points is provably wrong** — there
are **684 anchors** on the same screen, and `list-anchors` is what that mode is
named after. The passage-taking modes work well by contrast: I pasted four item
ids and file paths and got a correct pointer table in **1,015 ms**.

So the entry point a user reaches for *precisely when they have nothing to
paste* — the "I am lost" case, the highest-value one in the feature — is a dead
end, and it advises them to do the one thing that mode does not let them do.

Guidelines **#90 No Results** ("dead ends frustrate users"), **#33 Error
Feedback**, **#80 Error Recovery**.

Recommend: make the two passage-less modes gather their own material
(every session for `list-subjects`, the anchor store for `list-anchors`), and
give them their own empty-state copy. Until then they should not be offered.

### 3. 684 anchors render unpaged — and cost 1.2 s per keystroke

**Screen:** Conversations → *Points you marked*. **Severity: major. Size: a day.**

The new anchors panel says **"684 marked."** and then draws all 684. That
section alone holds **11,996 DOM nodes — 92% of the entire document** (13,025).
The screen carries **2,117 visible controls**.

There is **no paging control anywhere on the screen**. This breaks the app's own
established pattern, which round one rightly called a strength and which is
still correct everywhere else — *"Showing the first 20 of 36, in the order the
selector admitted them. A display limit. All 36 were in the injection — none
were dropped."*

The cost lands on the one control you must use to find anything in 684 rows.
Typing `INV-` into **Find by name**, measured per keystroke:

| Keystroke | Latency |
|---|---|
| `I` | **1,097 ms** |
| `IN` | **1,901 ms** |
| `INV` | **2,017 ms** |
| `INV-` | **2,017 ms** |

A clean single keystroke measured **1,199 ms**. Google's "poor" INP threshold is
200 ms; "needs improvement" ends at 500 ms. This is 2.4× the poor threshold, on
loopback, on a fast machine. Typing a four-character query costs about seven
seconds of blocked main thread.

The list also has no grouping: `INV-nothing-is-dropped-silently` appears **nine
times in the first twelve rows**, at nine different byte offsets, all from the
automatic sweep.

Guidelines **#84 Truncation**, **#52 Bundle Size**, **#47 Lazy Loading**,
**#78 Loading Indicators**, **#91 Bulk Actions**.

Recommend: page it with the component the other eleven lists already use;
de-duplicate identical labels into one row with a count; debounce the filter and
filter the model, not the DOM.

### 4. Every new write drops focus to `<body>`, announces nothing, and one of them deletes without asking

**Screen:** Conversations — mark, rename, drop. **Severity: major. Size: 3 hours.**

I drove all three write paths. The *opening* half of each is genuinely good:
**Mark this point** opens an inline form, **moves focus into a labelled,
pre-filled input**, and explains itself well. **Rename** does the same. That is
better focus management than anything round one found.

The *closing* half is where it falls down, consistently:

- **Focus is thrown to `document.body`** after mark, after rename, and after
  drop. I measured `activeElement` as `BODY` at every sample from 150 ms to
  6 s. The keyboard user is dumped to the very start of the tab order — and the
  first control inside `<main>` is **tab stop 24**, so they walk 24 stops back
  to where they were, after every single write. WCAG 2.4.3, guideline **#28**.
- **Nothing is announced.** The screen *has* the right affordance:
  `<p class="small convmarksaid" aria-live="polite">` — and it is **created at
  `conversations.js:1144` and never written to anywhere in the file.** I
  confirmed it empty in the browser after a successful write. A dead
  confirmation slot. Guidelines **#34 Success Feedback**, **#83 Confirmation
  Messages**, **#118 Contextual Live Badge Updates**.
- **"Take it back" deletes immediately** — no confirm, no undo, no
  announcement. The row vanishes and focus is gone. Guideline **#35
  Confirmation Dialogs** (High): *prevent accidental destructive actions.*

The last one matters more than it looks. The sweep's own copy says it *"only
ever changes points it marked itself, and never one you marked or named"* — so
a **hand-marked, hand-named anchor is not recoverable** by re-running the sweep.
That is the one class of anchor that is genuinely unrecoverable, and it is
deleted by a single click on a button labelled "Take it back", 684 of which are
on the page with identical accessible names.

That the app confirms an *Execute* — inline, with the exact argv, in the best
copy in the product — and does not confirm this, is the inconsistency to fix.

Recommend: focus the row (or the next row) after a write, not `body`; write the
one sentence into `.convmarksaid` that the element was built for; and put drop
behind the same inline confirm Execute already uses.

### 5. Below 1,000 px the app silently discards content, and at 400% zoom it discards most of it

**Screen:** the footer everywhere; the whole app under zoom. **Severity: major.
Size: 4 hours.**

The root cause is one line of CSS and three media queries. **The entire
responsive design of this twenty-screen application is three rules**, all
`@media (max-width: 1000px)`, and all three do the same thing:

```
.pair { grid-template-columns: 1fr; }
.two  { grid-template-columns: 1fr; }
.sim  { grid-template-columns: 1fr; }
```

The rail never collapses. The footer never wraps. And `body { overflow: hidden }`
means nothing that overflows can be scrolled to.

**Footer at 900 × 800 — round one's finding, confirmed almost exactly:**

| | Round one | Me |
|---|---|---|
| Overlapping footer pairs | 32 | **38** |
| Leaf items pushed off-screen | 13 | **13** |
| First row `scrollWidth` / `clientWidth` | — | **1,440 / 876**, `overflow-x: hidden` |
| Page horizontal scrollbar | none | **none** |

Same casualties round one named: `cwd`, `my-context`, `corpus`, `limits`, `5h`,
`7d`. Overlapping samples: `session name ⨯ size`, `session name ⨯ 103.6 MB`,
`MyContext V2.0 ⨯ no focus set`, `MyContext V2.0 ⨯ 1109`.

**WCAG 1.4.10 Reflow at 320 CSS px** — which is exactly 400% zoom on a 1280 px
display, the condition the success criterion names. Round one listed this as
unassessed and guessed it would fail. It fails badly:

| | |
|---|---|
| Viewport | 320 px |
| `<nav>` rail keeps | **214 px — 67% of the screen** |
| `<main>` is left | **106 px** |
| Text elements pushed off the right edge | **2,318** |
| Page scrolls horizontally to reach them | **no** |
| Elements clipped by `overflow: hidden` | 13 |

Guideline **#112 Text Reflow and Spacing (Critical)**, **#69 Horizontal
Scroll**, **#16 Overflow Hidden**, **#21 Container Width**, **#65 Breakpoint
Testing**.

For a project whose own invariant is `INV-nothing-is-dropped-silently`, a
status bar that discards half its groups and a zoom level that discards 2,318
elements — both with no scrollbar and no notice — is the wrong failure mode.
Recommend: `flex-wrap: wrap` + `min-inline-size: 0` on the footer items; a
breakpoint that collapses the rail; and remove `overflow: hidden` from `body`
so what does not fit remains reachable.

---

## Round one's five: confirm or refute

| # | Round one's claim | Verdict | My measurement |
|---|---|---|---|
| 1 | 7,046 ms to usable; `app.js` **4,632 ms** and `styles.css` **4,618 ms** from 127.0.0.1; nothing compressed; all `no-store` | **Confirmed in effect, refuted in cause** | 7,311 ms to usable — confirmed. But `app.js` **21 ms**, `styles.css` **7 ms**. The stall is `/api/status` **3.8–4.7 s** and `/api/doctor` **3.9 s**, every call, warm, serialised on a single thread. Compression ratio **1.004** and `no-store` + no `ETag`: confirmed. |
| 2 | Copy/Execute confirm only into a 1×1 px span; code calls the visible version *"chrome the owner has not approved"* | **Confirmed, but now self-contradicted by newer code** | `#announce` is still **1×1 px, `clip-path: inset(50%)`**, and `app.js:5118–5122` is unchanged. **But** the new Conversations code ships a *visible* confirmation beside its Copy button — `conv.recall.copied`: *"Copied. Nothing has been sent anywhere — paste it where you want it."* — with a refusal path too. The question the comment says is unapproved has already been settled the other way, on another screen. |
| 3 | 23 tab stops to content, no skip link; 49 from an item link to its pane; no `h1`; same `document.title` on all 20 screens | **Confirmed, unchanged** | First control inside `<main>` is **tab stop 24** of 77. **No skip link** (`a[href^="#"]`: none). **`h1` count: 0**. `document.title` is `mycontext Console` on every screen. Rail groups still `<div class="grp"><p>…` with **no `role="group"`**. Badges still concatenate: `Doctor4`, `Review queue0`. |
| 4 | Hebrew bidi: `%43`, `%14`, `7607.12$`; `dir="auto"`/`plaintext` appear **zero** times; 36 Latin runs not forced LTR | **Largely refuted — this was fixed today** | `dir="auto"`: **0 → 1,371**. `unicode-bidi: isolate`: **0 → 6,762** elements. **Split number-and-unit runs: 0** (was 8 in the footer alone). Runs with a bidi-neutral at either edge left unisolated: **0**. The footer now renders `33%`, `51%`, `50.8%`, `56%`, `100.0%` correctly. **The one place it was not applied is the place round one found it**: see 6.1 below. |
| 5 | Footer overlaps below ~1,200 px — 32 pairs at 900×800, 13 leaf items off-screen, `overflow:hidden` so no scrollbar | **Confirmed, unchanged** | **38 overlapping pairs**, **13 leaf items off-screen**, row `scrollWidth` 1,440 vs `clientWidth` 876, `overflow-x: hidden`, `body { overflow: hidden }`, no page scrollbar. Same items lost. |
| — | Lighthouse: accessibility **95**, best practices **100**, failing `color-contrast` on the skew banner (4.2:1) and `meta-description` | **Improved** | Accessibility **100**, Best Practices **100**, SEO **90**, Agentic Browsing **100**. **49 passed, 1 failed** — `meta-description` only. `color-contrast` now **passes**. Audited on a fully credentialed, 12,528-node Conversations screen. |

---

## Full findings

Severity: **blocker** (cannot complete the job) · **major** · **minor** · **polish**.

### 1. Performance and the server boundary

**1.1 · `/api/status` and `/api/doctor` block everything. major · half a day.**
Finding 1 above.

**1.2 · Nothing compressed, nothing cached, no `ETag`. minor · 2 hours.**
Ratio 1.004 across 35 requests / 2.65 MB. `no-store` on every text asset and on
the immutable fonts. Real, but worth far less than 1.1 — it is milliseconds on
loopback. Guideline **#49**.

**1.3 · No `Content-Security-Policy` header and no CSP `<meta>`. minor · 2 hours.**
`x-content-type-options: nosniff` is set; CSP is absent entirely. For a local
server that composes and executes shell commands, a CSP that forbids remote
origins is cheap insurance. Not a live vulnerability — nothing on the page
loads cross-origin — so minor.

**1.4 · 1.2 s per keystroke in the anchors filter. major.** Finding 3.

**1.5 · The DOM still only grows.** Conversations alone holds **12,124** of the
document's 13,025 nodes. Round one measured 3,124 → 35,028 over a session; the
shape is unchanged. Screens are retained with `hidden` and never released.
`hidden` does keep them out of the tab order and the accessibility tree, so
this is **minor · 3 hours**, but the anchors panel has made one screen an
order of magnitude heavier than round one saw.

### 2. The new write flows

**2.1 · Two retrieval modes always fail. blocker.** Finding 2.

**2.2 · Focus to `<body>` after every write. major.** Finding 4.

**2.3 · `.convmarksaid` is a live region that is never written. major · 1 hour.**
Created once at `conversations.js:1144`, referenced nowhere else. Guideline
**#118**.

**2.4 · "Take it back" deletes with no confirm and no undo. major · 2 hours.**
Finding 4. Guideline **#35**.

**2.5 · Rename has no Cancel and ignores Escape. minor · 1 hour.** Opening the
rename editor leaves the row showing `Rename | Take it back | Save the name`.
I dispatched `Escape` on the input: the editor stayed open. There is no way to
back out of a rename except to save one. Guideline **#80 Error Recovery**.

**2.6 · 684 rows × 3 controls, all with identical accessible names.
major · 3 hours.** Every row's link computes `Open the conversation at this
point`; every rename button computes `Rename`; every drop button computes
`Take it back`. None carries an `aria-label`, `title` or `aria-describedby`
naming *which* anchor. A screen-reader user moving by control hears the same
three names 684 times. The visible row does carry the name — so the fix is
`aria-label="Rename ZZ-…"` / `aria-label="Take back ZZ-…"`. Guidelines
**#40 ARIA Labels**, **#117 Compact Control Semantics (Critical)**.

**2.7 · The mode picker is a `radiogroup` that does not behave like one.
minor · 2 hours.** Credit first: `role="radiogroup"`, `aria-label="How do you
want to come at it?"`, `role="radio"` and **correct `aria-checked`** on each
button. But **all four carry `tabindex="0"`** instead of roving tabindex, so
the group costs four tab stops rather than one; and **ArrowRight/ArrowLeft do
nothing** — I focused the checked radio, dispatched `ArrowRight`, and neither
focus nor selection moved. A screen reader announces "radio button, 3 of 4" and
the keys that announcement promises are inert. ARIA APG radiogroup pattern;
guideline **#41 Keyboard Navigation**.

**2.8 · Selection state is carried by colour alone for sighted users.
minor · 1 hour.** The checked mode differs only in text and border colour
(`#eab308` vs `#a9a6b8`); `font-weight` is 600 on all four and no shape, icon or
underline changes. `aria-checked` covers assistive tech, so this affects
sighted users with colour-vision deficiency only. Guideline **#37 Color Only**.

**2.9 · Filtering the anchor list hides the total. minor · 30 minutes.** With
a filter applied the count line reads `1 marked.` — the 684 is gone. Every other
bounded list in the app says "the first N **of M**". Guideline **#90**.

**2.10 · The mark flow is genuinely well made — see *What is good*.**

### 3. Accessibility

**3.1 · Lighthouse: accessibility 100, best practices 100, SEO 90, agentic
browsing 100.** 49 passed, 1 failed (`meta-description`, irrelevant for a
localhost tool). `color-contrast` passes — round one's only real a11y failure,
the skew banner at 4.2:1, did not reproduce (no lane was editing
`src/ui/public/**` during my review, so the banner never appeared).

**But state plainly what that 100 does not cover.** Of 76 accessibility audits,
**42 were not applicable and 10 are manual-only — 24 actually ran.** Lighthouse
did not and cannot catch: the missing `h1`; the constant `document.title`; the
absent skip link; 684 identical accessible names; the radiogroup without arrow
keys; focus thrown to `body` after a write; `dir="auto"` missing on the Help
screen; or the 1.4.10 reflow failure. A 100 here is a floor, not a ceiling.

**3.2 · No `h1`, no skip link, one `document.title` for twenty screens.
major · 3 hours.** Confirmed unchanged. First control in `<main>` is tab stop
24 of 77. Guidelines **#39 Heading Hierarchy**, **#45 Skip Links**,
**#41 Keyboard Navigation**.

**3.3 · Rail groups are not programmatic groups. minor · 30 minutes.**
`<nav aria-label="Screens">` → four `<div class="grp">` each headed by a bare
`<p>`, none with `role="group"` or `aria-labelledby`. Twenty flat buttons to a
screen reader. Unchanged from round one.

**3.4 · Badge names concatenate. polish · 30 minutes.** `Doctor4`,
`Review queue0`. The count's `title` does not reach the accessible name.
Partially addressed — one rail button now carries `title="5 doctor notices"` —
but a `title` is ignored for the accessible name when the element has text
content. `aria-label="Doctor, 4 awaiting attention"` is the fix. Same for the
language toggle, whose name is `א/A` with `title="English / עברית"`.

**3.5 · `forced-colors` is entirely unsupported. minor · 3 hours.** I walked
the CSSOM: **810 rules, 0 `@media (forced-colors: …)`, 0
`@media (prefers-contrast: …)`**. Windows High Contrast Mode is unhandled, on a
tool whose owner runs Windows 11. The palette is built on CSS custom
properties, which High Contrast does not override — so the app will keep its own
colours and ignore the user's. Guideline **#36**. Round one listed this
unassessed; it is unsupported.

**3.6 · WCAG 1.4.10 Reflow fails at 400% zoom. major.** Finding 5.

**3.7 · Round one's "629 of 1,918 controls under 24 px" is overstated —
downgrade to polish.** I measured **710 of 2,117 (34%)** under 24 px, which
looks like agreement, but the composition matters and WCAG 2.5.8 has explicit
exceptions:

| Class | Count | Size | Verdict |
|---|---|---|---|
| `a.convanchoropen` | 684 | 96×17 | **Exempt** — `display: inline`, inside a sentence (`"MyContext V2.0 a table · marked for you · …"`). SC 2.5.8's *inline* exception. |
| `a.convhitopen` | 23 | 96×17 | **Exempt**, same reason. |
| `button.convhead` | 2 | 566×19 | **Fails** — a block button, no exception. |
| `summary` | 1 | 161×20 | **Fails** — no exception. |

And the controls round one would have worried about most are fine: **Rename is
63×26 and Take it back is 106×26**, both compliant, with 89 px between centres.
Lighthouse's `target-size` audit **passes**, and it is right to. So the honest
finding is *three* genuinely non-compliant controls, not six hundred.

I also want to correct something I nearly wrote myself: I measured a 4 px gap
between Rename and Take it back and was about to call it a mis-click hazard.
With both 26 px tall and 89 px between centres, it is not. The missing
confirmation on delete stands on its own; the spacing does not support it.

**3.8 · Reduced motion remains exemplary. No finding.** 810 CSS rules,
**zero unconditional `transition` or `animation` declarations**, four
`prefers-reduced-motion` blocks, all opt-in. Confirmed independently. Guideline
**#9**.

**3.9 · One console issue, no errors.** `A form field element should have an id
or name attribute (count: 4)` — a DevTools autofill hint, guideline **#58**.
Otherwise zero console output and zero failed requests. **polish.**

### 4. Hebrew / RTL

**4.1 · The bidi fix landed broadly and is a real result.** `dir="auto"` 1,371
occurrences, 6,762 isolated runs, zero split number/unit pairs, zero
neutral-edged unisolated runs. Round one's `%6` / `%42` / `7607.12$` do not
reproduce. Credit where it is due.

**4.2 · The Help screen still shows 25 English titles while claiming 24 Hebrew
translations. major · 2 hours.** Unchanged from round one's 6.3, and now one
row worse. The screen says *"עברית: 24 מתוך 24 נכתבו, נמדד על הדיסק"* and every
`.docname` is English: *"Capture what you just decided, before you forget it"*,
*"Find the item you're thinking of, from the CLI or the UI"*, and 23 more.
**All 25 have `dir` attribute `null`** and compute `direction: rtl` with
`text-align: start` — so English sentences are right-aligned and wrap RTL. This
is the exact element the app's own 1,371 `dir="auto"` attributes did not reach.
Two-line fix: read the `he` document's name when `lang === 'he'`, and put
`dir="auto"` on `.docname`.

**4.3 · Currency renders as `8050.80$` in Hebrew — I do not call this a
defect.** Round one flagged `7607.12$`. The symbol still trails the digits. But
a bidi-neutral currency symbol at the edge of a number in an RTL paragraph
taking the paragraph's side is the *correct* Unicode outcome, and Hebrew
typography routinely writes currency with a trailing symbol. I could not resolve
it from the DOM (the symbol is not in a text node adjacent to the digits, so my
Range-based glyph-position test found no pairs to measure) and judged it from
rendering. **Round one over-flagged this one.** No finding.

**4.4 · Date inputs show `dd/mm/yyyy` in the Hebrew UI. polish.** Native
`<input type="date">` placeholders follow the browser locale, not the app's.
Cosmetic.

**4.5 · Language toggle is still a full reload. minor.** Unchanged, and it now
costs the 7 s boot from finding 1 rather than a warm switch.

### 5. Layout, type and visual design

**5.1 · The responsive design is three media queries. major.** Finding 5.

**5.2 · Print support is genuinely good, and round one listed it unassessed.**
**21 print rules** across two `@media print` blocks: the full palette flips to
black on white (`--ground: #fff`, `--ink: #000`, every accent to `#000`), chrome
is hidden (`.hdr, .rail, .prov, .strip, .pop, .banner, .noprint`), scrollers
unroll (`.tvscroll { block-size: auto; overflow: visible; border: 0 }`), work
steps get `break-inside: avoid`, and syntax highlighting collapses to black.
That is a deliberate, well-made print stylesheet. **No finding — credit.**

**5.3 · Line length, type scale and button variety.** I did not re-measure
round one's 4.1–4.4 in depth; nothing I saw contradicts them, and `<main>` still
has no `max-inline-size`. Guidelines **#73 Line Length**, **#74 Font Size
Scale**. **minor**, as round one had it.

### 6. Copy and microcopy

**6.1 · The teaching copy remains the product's best asset.** New examples from
today's code: *"measured against this archive, item ids matched 68% of the time
where headings matched 4%"*; *"a word-bag matched 32% against the archive where
names matched 68%, and a guess that resolves is worse than silence"*; *"Safe to
press again: it only ever changes points it marked itself, and never one you
marked or named. On a full archive this takes about nine seconds."* A control
that states its own cost and its own idempotency before you press it is rare.
**No finding.**

**6.2 · The screen "verdict" chips. major · 2 hours.** Round one's 7.1, now
with the mechanism identified — see the glyph survey below, where it is settled.

---

## The glyph survey and proposed set

*Added to this review at the owner's instruction, 2026-09-13, and filed as
`TASK-a-glyph-makes-a-kind-recognisable-without-reading-in-every`
(`plan:screens seq:26`). This section is the design of record for the build
lane.*

### The rule I applied

A glyph earns its place when a reader must **tell members of a closed set apart
at a glance, repeatedly, in a dense list**. It is decoration when the set is
open-ended, when the distinction is already carried by something else on the
same row, or when it is continuous rather than categorical.

Four constraints, from the owner, which I have held to throughout:

1. **One glyph per meaning**, never two, and never one glyph meaning different
   things on different screens.
2. **The glyph is never the only carrier.** Every case keeps its word.
3. **Both string tables, and bidi.**
4. **A glyph is not a substitute for a missing sentence.**

### Settle the existing usage first — and it is a precondition, not a courtesy

`screens/parts.js:527` defines the shared screen header:

```js
export function screenHead(ctx, root, titleKey, verdictKey, subKey, glyph = '✅', verdictChip = null)
```

**Nineteen of twenty-one screens open with `✅`. Status and Learn open with
`⚠️`.** In the DOM the glyph is a bare text node, a sibling of the translated
span:

```html
<span class="verdict">✅ <span>the READMEs and the tutorials, by title, opened in its own tab</span></span>
```

Three facts about it:

- It has **no `aria-hidden`**, so a screen reader announces *"white heavy check
  mark"* before the verdict on nineteen screens.
- It has **no string-table key** — I grepped both tables and there is not one
  emoji in either. It carries meaning with no translatable text, which is
  exactly the "glyph as sole carrier" failure.
- It reads as a **health claim about the product**. "✅ *real pickers and a live
  glob tester*" looks like a status light, not a design note. Round one said
  this and I agree.

**And it blocks the rest of this proposal.** `⚠️` currently means *"Learn is a
conditional pass"*. Any coherent severity set needs `⚠️` to mean *warning*. One
glyph cannot mean both. So the verdicts must be settled before a single new
glyph is added — which is precisely why the owner's item says so.

**The mechanism already exists and the question was already ruled on.** The same
function takes `verdictChip`, which *"swaps the emoji sibling for a `.chip` of
the named hue carrying the verdict text itself"*. `parts.js` records that
`TASK-ui1-task-19-…`'s verification pass on **2026-08-26** settled it in so many
words: *"a real verdict chip is the `.chip` primitive with a meaning hue, not an
emoji."* Status was migrated. The other nineteen were left on the default
because the change was made opt-in to avoid touching them.

**My recommendation: reword — finish the rollout that was already ruled correct.**
Not "keep" (it misleads, it blocks the set, and it is unreadable to a screen
reader). Not "hide" (hiding it leaves nineteen screens carrying a design verdict
the user never asked for). Migrate the remaining nineteen to `verdictChip`, give
each chip a meaning hue and its existing keyed text, and **drop the tick
entirely**. Where a verdict is genuinely useful *to the user* — `ask.v`
*"filters, for people who do not write SQL"*, `conv.v` *"read, never
recorded"*, `gr.v` *"an ego-graph, not a hairball"* — keep the sentence as the
subtitle it already is. Where it is an internal design argument — `doc.v`
*'"exit 1" loses the findings list'*, `cfg.v` *'the strongest "a terminal cannot
do this"'*, `st.v` *"a recorded exception"*, `ln.v` *"conditional pass"* —
delete it from the product surface. It belongs in the design record, not beside
a heading. **Size: 4 hours** — 19 call sites and the copy decisions.

Guidelines **#37 Color Only**, **#114 Compact Label Semantics**, **#40 ARIA
Labels**, **#113 Essential Text Truncation**.

### How a glyph must be rendered here

The project already has the right primitives; the proposal is to reuse them,
not invent.

```html
<span class="g" aria-hidden="true">📌</span><bdi data-t="conv.anchors.kind.note">you marked this</bdi>
```

- **`aria-hidden="true"` on the glyph.** The word beside it is the accessible
  name. This satisfies constraint 2 and keeps screen readers clean — and it is
  what the current `✅` fails to do.
- **The word keeps its key**, so `screen-literals` is satisfied unchanged. The
  glyph needs no key precisely because it says nothing a reader must read.
- **Isolation for bidi.** Emoji are bidi-neutral (Unicode class `ON`), so a
  glyph beside a Latin word inside a Hebrew paragraph will jump to the wrong
  side of it. Wrap the glyph-plus-word pair in one isolated run — the same
  `unicode-bidi: isolate` that `styles.css:418–423` already applies to `.m`,
  `.v` and `bdi`. **This is not optional; without it the Hebrew mirror gets the
  glyph on the wrong end of every row.**
- **A `data-g` convention already exists** — `conversations.js:3574` and `:3999`
  set `bad.dataset.g = '⚠'`. Standardise on it rather than adding a second
  spelling, and reconcile that `⚠` with the severity set below.

### 1. Anchor kinds — the case he asked about. **Glyph helps.**

A marked point carries six facts in words and no glyph, in a list I measured at
**684 rows**. This is the strongest case in the product: a closed four-member
set, repeated hundreds of times, in the densest list in the app. Guideline
**#114 Compact Label Semantics**, **#84 Truncation**.

| Key | Word today (en) | Word today (he) | Proposed | Why |
|---|---|---|---|---|
| `conv.anchors.kind.note` | you marked this | סימנתם את זה | **📌** | A pin — the one a person placed by hand. It is also the only kind the sweep will never touch, which is worth making visible. |
| `conv.anchors.kind.table` | a table | טבלה | **▦** | Tabular data. A geometric glyph, not an emoji — it sits on the text baseline, needs no colour font, and cannot be confused with a chart. |
| `conv.anchors.kind.report` | a report | דוח | **📄** | A document. |
| `conv.anchors.kind.ruling` | a ruling you gave | הכרעה שנתתם | **⚖️** | Scales — a judgement. Unambiguous, and it distinguishes the kind that carries the most weight. |

I deliberately chose **▦ over 📊** for *table*: 📊 reads as "chart", and the
Decay screen is the app's chart screen. Keeping them apart matters more than
matching emoji style.

### 2. Doctor severities. **Glyph helps.**

Three levels, plus a settled state, on a screen that round one measured at
20,180 px with no filter. Shape carries the meaning, not colour — **#37 Color
Only** forbids three coloured dots.

| Key | Word | Proposed | Shape |
|---|---|---|---|
| `doc.error` | error | **🛑** | octagon |
| `doc.warning` | warning | **⚠️** | triangle |
| `doc.notice` | notice | **ℹ️** | circle |
| `doc.acked` | acknowledged | **✅** | tick — **available only once the verdict tick is retired** |

That last row is the dependency made concrete.

### 3. Audit stream record kinds. **Glyph helps.**

`watch.sub` names exactly six: *"mutations, injections, hook actions, focus
changes, access refusals, progress steps"* — a closed set, in a live feed, in a
table round one measured at 71 px per row where about seven rows fit.

| Kind | Proposed | Why |
|---|---|---|
| mutation | **✏️** | something was written |
| injection | **📥** | context delivered inbound |
| hook action | **🪝** | literal, and unmistakable |
| focus change | **🎯** | and it is a *regime change* — see below |
| access refusal | **🔒** | refused, not failed — distinct from 🛑 |
| progress step | **👣** | a lane step |

I chose **🔒 rather than 🚫** for refusal specifically so it cannot be confused
with 🛑 *error*. Note also that `watch.regime` calls a focus change *"a rule
across the feed, not a row"* — the glyph should mark the rule, not be repeated
on every row beneath it.

### 4. Review queue states. **Glyph helps, weakly.**

`/api/staging` exposes `pending` / `accepted` / `discarded`. Small set, but the
queue was empty in both reviews, so I am proposing against a state I have not
seen populated. **⏳ pending · ✅ accepted · 🗑️ discarded**, with ✅ again
conditional on the verdict tick being retired. Low confidence; low cost.

### 5. Conversation row kinds. **Glyph helps.**

The screen already promises *"Prompts, answers and machinery are marked
apart"*, and a `◆ Claude` marker exists. In a 103 MB transcript this is the
densest scanning task in the product. **🧑 prompt · 🤖 answer · ⚙️ machinery.**
Reconcile with the existing `◆` rather than adding a second marker.

### 6. Where a glyph is decoration — say no

| Case | Verdict | Why |
|---|---|---|
| **Corpus item types** (`RULE-`, `INV-`, `CONST-`, `TASK-`, `LESSON-`…) | **Decoration.** | The distinction is already carried, in text, by the id prefix sitting on the same row — and the id is the thing the project insists you cite. A glyph duplicates an existing carrier and costs ten new symbols against the "small enough to hold in the head" constraint. This is the biggest set and the clearest no. |
| **Decay** | **Decoration.** | Decay is a continuum, and `dec.v` already says *"a chart, not a table"*. Glyphs are for categories. |
| **Status screen** | **Decoration.** | A table of facts with no kind vocabulary. |
| **Scope coverage / Budget simulator gates** | **Decoration.** | The gates are ordered and explained in prose (*"eligible, tier, focus, scope, seen, budget — the first to fail is the answer"*). Order is the information; a glyph per gate would compete with it. |
| **Composer field states** | **Fix the sentence first.** | Round one's 3.7 found `aria-invalid="true"` on required inputs with **no** `aria-errormessage` and a "Required inputs are missing" paragraph with no `role="status"`. Putting ❗ on that field is the defect wearing a new hat. Wire the message, then reconsider. |
| **The 75 buttons carrying 5 titles between them** (`walk/144`) | **Fix the sentence first.** | I confirmed the shape on the Composer: **24 visible buttons, 2 with a `title`, 2 distinct titles.** A glyph on a control that still cannot say what it does is exactly what the owner's item warns against. This is D50's subject, not this one's. |

### The set, entire

Fourteen glyphs, four of them conditional on retiring the verdict tick:

> 📌 hand-marked · ▦ table · 📄 report · ⚖️ ruling
> 🛑 error · ⚠️ warning · ℹ️ notice · ✅ settled
> ✏️ mutation · 📥 injection · 🪝 hook · 🎯 focus change · 🔒 refusal · 👣 step
> 🧑 prompt · 🤖 answer · ⚙️ machinery

Each appears once and means one thing everywhere. No glyph replaces a word. No
glyph carries colour as its only difference. Every one is isolated for bidi and
hidden from assistive tech, with the keyed word beside it doing the talking.

---

## What round one missed, and what it got wrong

This section is the point of running the review twice.

**Got wrong — the cause of the seven seconds.** Round one named `app.js`
(444 KB, 4,632 ms) and `styles.css` (301 KB, 4,618 ms) as the stall and
recommended compression as the second-priority fix. Those files take **21 ms
and 7 ms**. Compression would not have moved the number. The stall is two
synchronous endpoints on a single-threaded server, it recurs on every call
rather than once per load, and it also explains the "4.6 s font" round one found
puzzling — the fonts were queued behind the API calls on an exhausted HTTP/1.1
connection pool. Round one had the right instinct ("the signature of a blocked
event loop") and the wrong culprit; the parallel-versus-serial test settles it.

**Got wrong — target size.** Round one called *"629 of 1,918 visible controls
under 24 CSS px"* a **major** finding. WCAG 2.5.8 exempts targets inline in a
sentence, and 707 of the 710 I measured are exactly that — inline links inside a
row of prose. Lighthouse's `target-size` audit passes and is correct to. The
real count is **three** non-compliant controls. That is polish, not major.

**Got wrong — the Hebrew currency.** `8050.80$` is the correct bidi outcome for
a neutral symbol at the edge of a number in an RTL paragraph, and is acceptable
Hebrew typography. Round one listed it beside the genuine `%6`/`%42` defects; it
does not belong there.

**Missed — print support exists and is good.** Listed as unassessed. There are
21 print rules doing a full palette inversion, chrome suppression and scroller
unrolling. It deserved credit, not a blank.

**Missed — the reflow failure is severe.** Round one guessed 1.4.10 "is likely
to fail". It fails with **2,318 elements pushed off-screen and unreachable**,
and `<main>` reduced to 106 px of a 320 px viewport. That is a different order
of problem from the footer finding it was appended to.

**Missed — `forced-colors` has zero support.** Listed unassessed; it is 0 rules
out of 810, on a Windows machine.

**Missed — the copy-confirmation question has already been answered.** Round one
correctly quoted `app.js:5118` calling a visible confirmation *"chrome the owner
has not approved"* and framed it as a decision awaiting the owner. Newer code on
Conversations already ships the visible version, with a refusal path. The
inconsistency, not the permission, is the finding now.

**Missed — Lighthouse's 100 covers a quarter of its own audits.** Round one
reported 95 and 100 without noting that 42 of 76 accessibility audits were not
applicable. The number moved to 100 while three of round one's four
accessibility majors are unchanged. Worth saying whenever the score is quoted.

**Where round one was right and I want to reinforce it:** the footer at 900 px
(I got 38 pairs to its 32, and the same 13 casualties); the keyboard findings,
all unchanged; the Help screen's English titles, unchanged and one row worse;
and `no-store` everywhere.

---

## What is genuinely good

Specifically, because a review that only lists faults is not calibrated.

1. **The bidi fix that landed today is a real engineering result.** Zero to
   1,371 `dir="auto"`, zero to 6,762 isolated runs, and every split
   number-and-unit pair round one found now renders correctly. That is the
   hardest class of finding in round one and it was closed properly, with the
   mechanism round one recommended.

2. **The mark flow's opening is textbook.** Click *Mark this point* → an inline
   form opens, **focus moves into a labelled input** (`Why keep it?`),
   pre-filled with your search term, under copy that states where it is stored
   and that it is reversible: *"It is kept in this project, never in your
   repository, and you can rename it or take it back at any time."* Guidelines
   **#28**, **#54**, **#59**, **#62** — all satisfied. Round one found no focus
   management anywhere; the new code has it. The closing half needs the same
   care.

3. **Controls that state their own cost before you press them.** *"Safe to
   press again: it only ever changes points it marked itself… On a full archive
   this takes about nine seconds."* I have reviewed a lot of software and I do
   not remember another button that tells you its own idempotency guarantee and
   its own runtime.

4. **The retrieval feature's honesty about its own precision.** *"a word-bag
   matched 32% against the archive where names matched 68%, and a guess that
   resolves is worse than silence."* It refuses rather than guesses, and it says
   why with a measurement. The two broken modes are a defect *in* a genuinely
   well-conceived feature.

5. **Print.** 21 rules, full palette inversion, chrome hidden, scrollers
   unrolled, `break-inside: avoid` on work steps.

6. **Reduced motion.** 810 rules, zero unconditional transitions or animations,
   all motion opt-in behind `prefers-reduced-motion: no-preference`. Still the
   right direction and still rare.

7. **`aria-checked` on the mode picker, and zero unlabelled inputs.** I went
   looking for missing form labels on the busiest screen and found **14 visible
   inputs, 0 without an accessible name**. I expected to find several; I was
   wrong, and I would rather say so than quietly drop it.

8. **Lighthouse Best Practices 100 and Agentic Browsing 100**, and
   accessibility up 95 → 100.

9. **Bounded-list honesty everywhere except the new panel.** The pattern is
   still exact and still repeated. The anchors list is the first list in the
   product to break it, which is itself evidence of how consistently the rest
   holds.

10. **Deep linking works and survives a reload.** The nonce is consumed from the
    fragment, the fragment is then used for routing (`#/conversations`), and a
    plain reload restores both the credential and the screen. Guideline **#5**.

---

## Counts

| Severity | Count |
|---|---|
| **Blocker** | **1** |
| Major | 12 |
| Minor | 12 |
| Polish | 4 |
| **Total** | **29** |

Blocker: the two passage-less retrieval modes (2.1).

Majors: `/api/status` + `/api/doctor` blocking (1.1) · anchors filter INP (1.4)
· focus to `body` after every write (2.2) · `.convmarksaid` never written (2.3)
· delete without confirm (2.4) · 684 identical accessible names (2.6) · no `h1`
/ no skip link / constant title (3.2) · WCAG 1.4.10 reflow (3.6) · footer
overlap and data loss (5.1) · Help screen English titles (4.2) · unpaged 684-row
list (3) · screen verdict chips (6.2).

---

## What I could not assess, and why

- **The staged-restore approve path.** `/api/retrieval/approve` and
  `/api/retrieval/approve/confirm` exist, and the two-step shape is right. But
  `/api/retrieval` reports `present: false` with no results, and reaching a
  staged state requires running a helper agent in a fresh window against the
  owner's corpus. The brief forbade approving a restore I did not stage, and I
  could not stage one without that helper. **The only part of the new work I did
  not reach.**
- **Why `/api/status` and `/api/doctor` take four seconds.** I proved *that*
  they do and that they serialise everything else. I did not profile the server
  process — it is the owner's and off limits.
- **Review queue populated, pack import, Write budgets, Capture past
  composition.** Still unexercised. The review queue still reports `0`.
- **The Relations graph rendered.** Not reached this round either.
- **Real screen-reader output.** I computed accessible names, roles, live-region
  politeness and focus order, and tested keyboard behaviour directly. I did not
  run NVDA, JAWS or VoiceOver, so *spoken* verbosity and order remain unverified.
- **Lighthouse's performance category** — still excluded by the MCP tool. I
  measured navigation, resource and long-task timing directly instead.
- **Touch.** No touch device and no pointer-coarse emulation; the app is a
  desktop operator tool and the brief did not prioritise it.
- **The Composer's Copy button end-to-end.** The visible picker is a custom
  control over a hidden `<select>`, and my scripted selection drove the select
  without driving the picker, so I could not reach a composed command's Copy
  button. I settled round one's finding 2 from the source instead
  (`app.js:5118–5122` unchanged; `conversations.js:2493` ships the visible
  alternative). I did confirm the placeholder round one asked for now exists —
  the select's first option is empty and nothing is preselected.
- **The demo corpus.** Everything here was measured against the live
  `my-context` corpus: 1,110 items, 684 anchors, 103 MB of transcript.
