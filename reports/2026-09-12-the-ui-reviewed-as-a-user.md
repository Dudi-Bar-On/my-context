# The UI, reviewed as a user

**2026-09-12 · a professional UI/UX review of the whole web application**

Driven in one Chrome session against the owner's running server at
`http://127.0.0.1:58888/`. Twenty screens visited, both languages, three
viewport widths. Tools: Chrome DevTools MCP — Lighthouse, the accessibility
tree, console and network readers, viewport emulation, plus scripted
measurement in the page for contrast, target size, bidi resolution, frame
times and layout collision. Every number below was measured, not estimated.
Screenshots are in the session scratchpad and are named per finding.

**Standing caveat.** Another lane was editing `src/ui/public/**` throughout.
The server serves those files raw, so the page was reporting *"This page is
newer than the server answering it"* for the whole review. Where that state is
the cause of a finding, I say so and do not count it against the design. It
did not affect any measurement below except where noted.

**I changed no product code.** This file is the only thing I wrote.

---

## The five things I would fix first

### 1. Seven seconds of an empty gradient on every cold load

**Screen:** the whole app. **Severity: major. Size: a day** (one to find the
stall, a few hours to add compression and caching, an hour for a skeleton).

What a user experiences: you open the URL and get a purple-to-teal wash with
nothing on it. No rail, no content, no spinner, no word. Then, all at once,
the app appears.

Measured on a hard reload with the cache bypassed, over loopback:

| | |
|---|---|
| First contentful paint | **100 ms** — but the thing painted is the empty gradient |
| DOMContentLoaded | 63 ms |
| **Rail usable** | **7,046 ms** |
| **Main content usable** | **7,046 ms** |
| Footer stats | 7,047 ms |
| Transferred | 2.59 MB over 35 requests |

On an earlier load the shape was the same but distributed differently:
`app.js` (444 KB) took **4,632 ms** and `styles.css` (301 KB) took **4,618 ms**
to arrive from `127.0.0.1`, and in a later window `/api/sessions`,
`/api/status`, `/api/watch/volume` and two font files *all* took ~4.6 s while
`/api/injection-history` took 6.08 s. Requests for static fonts blocking for
four seconds behind API calls is the signature of a blocked event loop, not of
transfer cost.

Two contributing facts I can state flatly:

- **Nothing is compressed.** Total `transferSize` 2,913,250 bytes against
  `decodedBodySize` 2,895,850 — a ratio of 1.006. No gzip, no brotli, anywhere.
- **Nothing is cached.** `cache-control: no-store` on `/`, `/app.js`,
  `/styles.css` and `/strings/en.js`. Every reload — and every language
  toggle, which is a full reload — re-downloads ~1 MB of uncompressed
  JavaScript, CSS and string tables.

Recommend, in order of cost:

1. A skeleton or a single line of text during the gap. Right now the app is
   indistinguishable from a broken one for seven seconds, and the *only* thing
   drawn in that window is a red error banner (see finding 4.2). **1 hour.**
2. `content-encoding: gzip` on the text responses, and
   `cache-control: no-cache` + `ETag` instead of `no-store` for
   `/app.js`, `/styles.css`, `/strings/*` and `/fonts/*`. The fonts in
   particular are immutable and are re-fetched on every load. **2–3 hours.**
3. Find the stall. Something on the server blocks for 4–6 s during boot-time
   API calls and holds static file serving behind it. I did not profile the
   server process (see *What I could not assess*), so I cannot name it — but
   the evidence that it exists is that `geist-mono-500.woff2` took 3,983 ms.
   **Half a day to locate.**

### 2. Copy and Execute confirm nothing a sighted user can see

**Screen:** Composer, and anywhere `announce()` is used. **Severity: major.
Size: 2 hours.**

I clicked **Copy** on the Composer. The command went to the clipboard. The
button did not change. Nothing appeared. Nothing flashed. I clicked it again
to check I had not missed it. Nothing again.

The confirmation exists — `"Copied to the clipboard."` is written into
`span#announce`. That span measures **1 × 1 px** with
`position:absolute; clip-path:inset(50%); overflow:hidden`. It is
screen-reader-only. A sighted operator gets no feedback at all from the single
most-used control on that screen.

This is deliberate and the code says so, at `src/ui/public/app.js` ~5118:

> **It is announced, not seen.** … drawing words into the 26px provenance band
> would be inventing visible chrome the owner has not approved.

So this is a decision waiting on the owner, not a bug. My recommendation as
the reviewer: **approve the visible half.** A 1.5-second text swap on the
button itself (`Copy` → `Copied`) costs no new chrome, no new slot, no layout,
and closes the gap. Keep the live region exactly as it is — it is correct.

### 3. Keyboard operation is 23 tab stops from useful, and 49 from what you just opened

**Screen:** all. **Severity: major. Size: 3 hours.**

Three measurements:

- **No skip link.** The first focusable is the header's `focus` button; the
  first control inside `<main>` is **tab stop 23**, because the rail's twenty
  buttons sit between them. Every screen change starts that walk again.
  WCAG 2.4.1 Bypass Blocks.
- **Opening an item does not move focus into it.** I focused the
  `REF-v2-handover-…` row, activated it, and the pane opened in 163 ms with
  `document.activeElement` still on the row. The first control inside the pane
  is **49 tab stops away**. WCAG 2.4.3 Focus Order.
- **No h1 anywhere, and the document title never changes.** It is
  `mycontext Console` on all twenty screens. A screen-reader user who moves by
  heading lands on an `<h2>` with no page-level heading above it, and cannot
  tell from the tab title which screen is open. There is also one empty
  heading: `<h3 class="m" id="paneid">—</h3>`.

Recommend: a skip link as the first focusable; `pane.querySelector('h3')`
given `tabindex="-1"` and `.focus()` on open (Escape already returns focus
correctly, because focus never left); one `<h1>` per screen, visually hidden
if the design does not want it, and `document.title = screen + ' · mycontext'`.

The *good* news, and it is genuinely good: the focus ring is
`2px solid #eab308` at `2px` offset on
`:where(button, a, input, select, summary):focus-visible`, which measures
about **10:1** against the page ground — comfortably past the 3:1 that
WCAG 2.2 SC 1.4.11 asks for. There are no positive `tabindex` values. The rail
carries `aria-current="page"`. The bones are right; it is the two moves above
that are missing.

### 4. Hebrew: the numbers you read all day render backwards

**Screen:** the footer strip, everywhere; the item summary on Injection
preview. **Severity: major. Size: 4 hours.**

The Hebrew mirror is far better than I expected — see *What is genuinely
good*. But two bidi faults land on the most-read text in the app.

**4a. Number-and-unit runs are split across sibling spans in an RTL
context.** In the footer, `6` and `% · ` are two separate `<span class="uval">`
elements, both resolving `direction: rtl; unicode-bidi: normal`. The bidi
algorithm therefore puts the neutral `%` on the wrong side. What renders:

| Intended | Rendered in Hebrew |
|---|---|
| `6%` | `%6` |
| `42%` | `%42` |
| `21.8%` | `%21.8` |
| `$7607.12` | `7607.12$` |
| `high · think · 200k+` | `+high · think · 200k` |

Eight instances in the footer alone, and the footer is the thing the owner
glances at constantly. Screenshot: `08-hebrew-preview.png`, bottom strip.

**4b. Corpus-authored English text takes the paragraph's direction.** The item
summary `span.rowsum` resolves `direction: rtl; unicode-bidi: normal`, so
*"What the last session learned, so this one does not start over."* renders
with its full stop at the **left** end. This is exactly the defect the project
already knows about and already has a fix for — the Watch feed's detail
strings *are* wrapped in `<bdi>` and are correct. Screenshot:
`10-narrow-900.png`, DELIVERED card.

The mechanism is mostly right: I counted **180** Latin runs correctly forced
to `direction: ltr`, against **36** left in RTL. But
`unicode-bidi: plaintext` / `dir="auto"` appears **zero** times in the whole
document, and that is the real gap. Hard-coding a direction per string-table
key works for chrome, whose language you know at build time. It cannot work
for item summaries, bodies and titles, which an agent wrote and which may be
in either language.

Recommend: (i) wrap every `number + unit` pair in one `<bdi>` so the pair is a
single isolated run; (ii) put `dir="auto"` on every element that carries
corpus content — `.rowsum`, item titles, bodies, and the document titles on
the Help screen. `dir="auto"` is the one rule that is right whatever the
author wrote.

### 5. The footer overlaps itself and silently drops data below about 1,200 px

**Screen:** the status footer, all screens. **Severity: major. Size: 3 hours.**

The four footer rows are `display:flex; flex-wrap:nowrap` with a fixed 12 px
gap, `overflow-x: hidden`, inside a `body` that is itself `overflow: hidden`.
At 1,350 px the row content is 1,326 px and just fits. Narrower than that, flex
shrinks every item below its content width and the text draws over its
neighbour.

Measured at **900 × 800**, in English:

- **32 pairs of footer elements overlap** (`session name` ⨯ `size`,
  `MyContext V2.0` ⨯ `no focus set`, `MyContext V2.0` ⨯ `1107`, …).
- **13 leaf items are pushed entirely off-screen** — the whole `WHERE` and
  `LIMITS` groups: `cwd`, `my-context`, `corpus`, `limits`, `5h`, the rate
  bar, `6`, `3h36m`, `7d`… With `overflow:hidden` on both the row and the
  body, there is no scrollbar and no indication anything is missing.

In Hebrew at the same size: 29 overlapping pairs, and the garbling is visible
to the naked eye — `38 הערות דוקטור` is drawn on top of `לא הוגדר מיקוד`.
Screenshots: `11-narrow-en-900.png`, `10-narrow-900.png`.

Even at the default 1,350 px the `SESSION / WINDOW` row is truncated
mid-sentence: *"21.8% (217.9k / 1.0M) — as"*. Screenshot:
`13-final-preview.png`.

For a project whose own invariant is `INV-nothing-is-dropped-silently`, a
status bar that discards half its groups without saying so is the wrong
failure mode.

Recommend: `flex-wrap: wrap` with `min-inline-size: 0` on the items, so rows
reflow instead of colliding; or, if the four-row height is fixed by design,
`overflow-x: auto` on each row so the hidden groups are at least reachable.
Either is small. Wrapping is the better answer for an operator who resizes.

---

## Full findings

Severity: **blocker** (cannot complete the job) · **major** (completes it
slower, or wrongly) · **minor** (friction) · **polish**.

### 1. First impression and information architecture

**1.1 · The bare URL draws the entire app, fully empty. minor · 1 hour.**
With no credential, every screen renders in full with every panel reading
"not read", "◌", "—", and a refusal in the content area. The refusal copy
itself is excellent — it names the cause (`401 No credential on this page`),
distinguishes it from an empty corpus, explains why a reload cannot help (the
nonce lives only in the fragment), and gives the exact command:
`mycontext ui --nonce`. That is a model refusal. What is wrong is the frame
around it: a fully-drawn twenty-screen application with every number blank
reads as "this tool is broken", not as "you are not signed in". Recommend
collapsing to the refusal alone until a credential is held. Screenshot:
`01-injection-preview.png`.

**1.2 · The rail's grouping is right; its ordering buries the reads. minor ·
1 hour.** Four groups — *Injection — what arrives* / *Evidence — why it did or
didn't* / *Change — composed, never run* / *Read* — is a genuinely good
taxonomy: it is organised by the user's question, not by the data model.
The problem is the fourth group. `Conversations`, `Help` and `Learn` sit
below the fold at 1440 × 900 and are reachable only by scrolling the rail,
whose only affordance is a scrollbar heavier than the nav items themselves.
`Help` and `Learn` are the two things a new user needs, and they are the two
things they cannot see. Recommend moving `Read` above `Change`, or pinning
Help to the header.

**1.3 · Twenty screens, no way to jump. minor · 3 hours.** There are exactly
two `keydown` listeners in the app and both handle `Escape`. No screen
switching by key, no `/` to focus a search, no command palette. For a tool one
expert uses every day, a `Ctrl+K`-style jump to a screen would repay itself in
a week. Cost is small — the screen list is already declarative (`data-s`).

**1.4 · The group headings are not programmatically groups. minor · 30
minutes.** The rail is `<nav aria-label="Screens">` containing
`<div class="grp"><p>Injection — what arrives</p><button>…` — the heading is a
bare `<p>`. A screen-reader user hears twenty flat buttons with no grouping.
`role="group"` + `aria-labelledby` on each `.grp` fixes it.

**1.5 · The rail badge and its own screen report different numbers. minor ·
30 minutes.** The rail says **Doctor 38**; the Doctor screen says
*"findings: 95 · with an automated repair: 1 · yours to settle: 94 · already
ruled on: 49 · notes about the checks: 6"*. Both are correct — the badge is
`health.errors + health.warnings` (`doctorNoticeCount`, app.js ~5772) — but
nothing on the screen reconciles them, and 38 appears in none of the five
numbers the screen prints. Recommend adding "…of which **38** are errors and
warnings — the number on the rail" to that count line.

### 2. Task flows

**2.1 · Read an item — good, with one keyboard hole. minor.** Click an id
anywhere → pane opens in **163 ms** with id, summary, type, status, tier,
scope, governs, file path, a twelve-week delivery sparkline, and the body as
authored. That is a genuinely strong detail view and it is fast. Two notes:
the pane is 330 px wide on a 1,350 px viewport (there is a `⤢` expand, so this
is a default, not a limit); and focus does not follow (finding 3 above).

**2.2 · Build and copy a command — 4 steps, one of them invisible.
major · half a day.** Composer → pick a command → fill required fields →
Copy. The chip rendering of arguments is excellent and the stated reason for
it is right ("shell syntax in a value is visible before it reaches your
clipboard"). Three problems:

- **It opens on `ack · write`**, the first of thirty options in one flat
  `<select>`, because `ack` sorts first. `ack` is a rare write. `search` and
  `show` — the two commands anyone reaches for — are at positions 29 and 28.
  Recommend a `— pick a command —` placeholder, or defaulting to `search`.
  **1 hour.**
- **The Glob tester is always shown**, taking roughly half the screen, even
  when the selected command has no scope argument at all (as `ack` and
  `search` do not). Recommend showing it only when a scope field is in the
  form. **2 hours.**
- **Copy gives no visible confirmation** (finding 2).

**2.3 · The Glob tester says 1,558 and shows 200, without saying so.
major · 2 hours.** The count line reads `1,558 / 1,558`. The list contains
exactly **200** rows. Nothing says the list is capped. The explanatory
sentence directly beneath it argues the opposite case:

> A bare count — "1,558 files" — cannot be inspected: an empty and a
> near-empty result look the same until you see which files.

The cap is `GLOB_SAMPLE_CAP = 200` in `src/ui/read-model-work.ts`, and
`src/ui/public/screens/palette.js` ~113 already records the defect in its own
words: *"the reader is nonetheless shown 200 files while the line says
1,558"*. This is the clearest silent truncation in the app, and it is a
one-line fix in the copy — every other bounded list in the product already
does this correctly (see 3.4).

**2.4 · Search — there is no search screen. minor.** The brief named one;
the app has none. What exists instead is `Ask` (structured audit/corpus
filters, no SQL box) and `search · read` in the Composer, which composes a
CLI command rather than showing results. Corpus search from the UI therefore
means: Composer → select `search` → type → Copy → paste into a terminal. That
is a reasonable line to hold for a tool whose whole premise is
*"composed, never run"* — but the Execute button exists, so the line is
already crossed for other commands. Worth an owner decision, not a fix.

**2.5 · Browse a conversation — strong. No finding.** Session list with
counts, sizes, branch, duration; a name search that honestly states what it
does and does not read (*"It does not read the transcripts — they are far too
large to search on a keystroke. To search inside one session, open it."*); a
separate full-text box; and a staleness chip, *"Behind by 1.4 KB"*, with the
rebuild command beside it. This is the best-designed screen in the
application.

**2.6 · Change a setting in Configure — good flow, two readability faults.
minor · 3 hours.** The no-op state is exemplary: *"No change — this is the
configuration in force. Nothing starts or stops governing, delivery does not
move, and all 1107 items are unaffected."* The apply instructions give the
exact absolute path with a Copy button and numbered steps. But:

- **The same sentence is drawn three times on one screen** (twice visible at
  once), once for Profile and once for Budgets, with nothing naming which is
  which. Recommend "What changes — profile" / "What changes — budgets".
- **`→` means two different things on the same screen.** In the Budgets table,
  `6000 → 30000` means *shipped default → value in force* — it is not a
  pending change. In the Profile delta plate directly beside it, `→` means
  *old → new*. With the page also saying "No change", `6000 → 30000` reads as
  a staged edit. The table has no `<thead>` and no `<caption>`, so nothing
  labels the columns. Recommend a header row: `default | in force | new`.
- The config path sits in a 319 px `<input>` with an internal horizontal
  scrollbar, truncated at `D:\Users\UserC\source\repos\my-context\.my_`. The
  instruction above it says "it is the exact file this server read"; you
  cannot read it. Use a wrapping `<code>` block.

**2.7 · Read the live feed — works, but shows a third of the rows it could.
major · 2 hours.** The Audit stream is live over SSE with an activity pulse
and kind filters carrying counts. The table, though, is `table-layout: auto`
with no column sizing: the **Op** column gets **95 px** and the
**Who / subject** column gets **175 px** — so `subagent-stop-untyped` wraps
onto three lines and every row becomes **71 px** tall, while the column beside
it holds a single `—`. About seven rows fit where twenty would. For a feed
this is the whole point of the screen. Recommend explicit column widths, or
`white-space: nowrap` on Op with the fallback of shrinking `Who / subject`.
Screenshot: `03-watch.png`.

**2.8 · Doctor — 95 findings, 20,180 px, nothing to narrow it with.
major · half a day.** The page is **20,180 px** tall (28 viewports),
1,883 nodes, 291 controls, grouped into `error` / `warning` / `notice` — and
carries **no filter, no sort, no search, no collapse, no in-page nav**. Every
other list in the app pages properly. Scrolling is smooth (median frame
18.9 ms, p95 23.2 ms, zero frames over 50 ms on my scroll test), so this is
purely a navigability problem. Recommend the same paging control the other
lists already use, plus collapsing the three groups.

### 3. Feedback and state

**3.1 · Refusals mostly do say what would unblock them — this is better than
its reputation.** The brief flags "a refusal that does not say what would
unblock it" as a standing defect. I went looking and found the opposite in
most places:

- 401: names the cause, distinguishes it from an empty corpus, explains why a
  reload will not help, and prints `mycontext ui --nonce`.
- Budgets: *"No `mycontext` command edits a budget, and no agent can — the hook
  says so verbatim… A person can, behind a confirm showing every value."*
- Composer: *"Required inputs are missing — fill them in to compose a command."*
- Scope gate: *"How many the event path excludes is **unmeasured**:
  `matchesScope` has no endpoint, so dropped items are absent, not counted.
  Not a zero — no list can be drawn."*

That last one is the standard the rest should be held to. The defect is not
widespread. It is concentrated in the three places below.

**3.2 · The loading state is the two words "not read yet". major · 2 hours.**
Every screen's first visit shows literally `not read yet` for as long as its
data takes — I measured Scope coverage at 796 ms, Decay 345 ms, Watch 272 ms,
and on first boot the whole shell at ~7 s. No spinner, no "loading", no
skeleton. "Not read yet" is a *state* label, correct and honest, but it reads
as a terminal condition rather than as work in progress. Recommend the same
word plus motion, or "reading…".

**3.3 · The version-skew banner blocks content, and dismissing it does not
stick. minor · 2 hours. (In-flight condition — see caveat.)** A fixed,
centred overlay is drawn over the middle of the content area, dismissed with
OK, and redrawn on the next re-render. I dismissed it on Injection preview
and it was back on Audit stream. It is also the *only* thing on screen during
the seven-second cold load, so the first impression of a cold start is "an
error". It is also the single accessibility failure Lighthouse found
(finding 5.1). Recommend: move it to a non-overlapping strip, and make the
dismissal last for the session. The cause — a lane editing `src/ui/public/**`
against a server loaded hours earlier — is temporary; the banner's behaviour
is not.

**3.4 · Bounded lists are handled very well, with one exception.** The
standard pattern is exact and repeated: *"Showing the first 20 of 36, in the
order the selector admitted them. **A display limit.** All 36 were in the
injection — none were dropped."* with `Previous` / `Next` / `Show all 36`. Ask
does the same: *"Showing the first 50 of 635."* The one exception is the Glob
tester (2.3).

**3.5 · Empty states are a strength.** *"A measured zero — every item was put
to this gate and none stopped here, not a rung nobody checked."* ·
*"Absent, not empty — this event never reaches the tier at all."* ·
*"No procedure in this corpus. The lifecycle above is what one would be;
nothing has been written yet."* · *"Nothing has been asked yet. When a helper
writes one, it appears here."* These distinguish *measured zero* from
*unmeasured* from *not applicable*, which almost no product does. No finding.

**3.6 · The Execute confirm is the best copy in the app. No finding.**
*"This runs on your machine, now. The UI can tell it came from your browser —
not that you asked. Only run what you recognise here."* It is inline rather
than modal, shows the exact argv, and offers `Run it` / `Cancel`. Keep it
exactly as it is.

**3.7 · `aria-invalid` with no error message. minor · 1 hour.** The
Composer's required inputs carry `aria-invalid="true"` while empty, with no
`aria-errormessage` or `aria-describedby`. The "Required inputs are missing"
paragraph is a plain `<p>` with no `role="status"`, so it is never announced
when it appears or clears. The visible labels are correct (`<label>` wraps the
input), so this is narrow.

### 4. Visual design and consistency

**4.1 · Eleven font sizes on one screen, three of them fractional.
minor · half a day.** Measured on Injection preview: 10.5, 11, 11.31, 12,
12.615, 13, 13.92, 14.5, 15, 16, 18 px. The fractional values are `em`
compounding inside already-sized containers. A designed scale has five to
seven steps. **134 text elements are under 12 px**, including 10.5 px in the
footer. Recommend collapsing to the five declared tokens and raising the floor
to 12 px.

**4.2 · The type scale is in absolute pixels. minor · 2 hours.** The tokens
resolve to `--fs-00: 12px`, `--fs-0: 13px`, `--fs-1: 14.5px`,
`--fs-2: 16px`, `--fs-3: 18px`. A user who raises their browser's default font
size gets no change at all; only full-page zoom works. For an operator reading
11 px status text for hours this matters. Recommend `rem` with the same
computed values at a 16 px root — no visual change, but the preference then
lands.

**4.3 · Twenty-five distinct button styles. minor · a day.** Measured across
`<main>`: 25 distinct computed combinations of font-size, family, padding,
border and radius. Border widths of `0.666667px` and `2px`; radii of 0, 3, 5
and 8 px; `Geist` and `Geist Mono` used for the same role. Concretely,
**Copy / Execute** on the Composer (13 px Geist, 3 × 8 px padding, 0.67 px
border, radius 5) and **Clear** on Conversations (12 px Geist Mono, 4 × 8 px,
2 px border, radius 3) are the same kind of control in two visual languages on
adjacent screens. Recommend three button roles (primary / secondary /
quiet-link) as tokens and migrating to them.

**4.4 · No maximum line length. minor · 1 hour.** `<main>` has
`max-width: none`. At 1,920 px the explanatory paragraphs — and this app is
built out of explanatory paragraphs — run to **1,659 px at 13 px**, roughly
**250 characters per line** against a comfortable 45–90. This is the single
cheapest visual improvement available: `max-inline-size: 78ch` on prose
blocks. Screenshot: `12-wide-1920.png`.

**4.5 · Two-column cards do not balance. polish · 2 hours.** On Injection
preview at 1,920 px, `DELIVERED` ends after a third of its column while
`WHY NOT` continues — leaving a large empty rectangle with a full-strength
gradient in it. Recommend `align-items: start` plus allowing the short column
to shrink.

**4.6 · The background gradient competes with the content. polish ·
1 hour.** A saturated purple-to-teal wash covers the whole content area at
full strength. It carries no information, it varies the effective background
behind every card, and at the seven-second cold load it is the only thing on
screen. Text contrast survives it (see 5.2), so this is taste, not a defect —
but I would reduce it to about a third of its current chroma. It is the one
thing in the visual design that reads as decoration rather than as signal, and
everything else in this UI is signal.

### 5. Accessibility

**5.1 · Lighthouse.** Chrome DevTools MCP's Lighthouse excludes the
performance category; I measured that separately (finding 1).

| | Busiest screen (Injection preview, navigation) | Quiet screen (Status, snapshot) |
|---|---|---|
| Accessibility | **95** | **95** |
| Best Practices | **100** | **100** |
| SEO | 90 | 75 |
| Agentic Browsing | **100** | **100** |
| Passed / failed | 44 / 2 | 27 / 2 |

Both runs failed on exactly the same two audits:

- **`color-contrast`** — the version-skew banner only: `#ef4444` on `#321d1b`
  = **4.2:1**, against the 4.5:1 required at 12.6 px / 14.5 px. Fix:
  `#f87171` on that ground reaches 5.6:1.
- **`meta-description`** — irrelevant for a localhost operator tool. Ignore it;
  it is why the SEO number moves between runs.

Best Practices 100 and Agentic Browsing 100 on both screens are a real result
and worth stating plainly.

**5.2 · Contrast is a strength — I measured it independently.** Walking every
leaf text node and computing the ratio against its resolved background, the
**lowest ratio in the app outside that banner is 5.19:1**, and the typical
range is **6.4:1 to 10.2:1**. Specifically: `#f97316` on `#17171c` = 6.37,
`#8b9ce6` on `#17171c` = 6.80, `#a9a6b8` on `#0b0c11` = 8.22, `#22c55e` on
`#0b0c11` = 8.57, `#eab308` on `#0b0c11` = 10.19. No finding.

**5.3 · 629 of 1,918 visible controls are under 24 CSS px. major · 3 hours.**
Almost all of them fail on height, at 17–20 px: `.convrowopen` (19 px),
`.convlanelink` (17 px), `.convanchoropen` (17 px), disclosure triangles
(20 px). **WCAG 2.2 SC 2.5.8 Target Size (Minimum), AA** asks for 24 × 24.
Even for a mouse-only desktop expert, 17 px targets stacked in a dense list
produce mis-clicks. Recommend `min-block-size: 24px` plus vertical padding on
interactive rows and inline links — no layout change of consequence, since
these already sit in taller containers.

**5.4 · Reduced motion is done correctly — better than most production apps.**
I walked the CSSOM: **zero unconditional `transition` or `animation`
declarations**, and every motion rule sits inside
`@media (prefers-reduced-motion: no-preference)`. That is the opt-in
direction, which is the right one and the rarer one. No finding.

**5.5 · Landmarks and live regions are correct.** `header` / `nav "Screens"` /
`main` / `aside "Item detail"` / `footer`, one of each. Live regions use
`aria-live` with `aria-atomic` and choose politeness per announcement
(`assertive` for the disconnect banner, `polite` for counts). `aria-current="page"`
marks the open screen. No positive `tabindex`. No finding.

**5.6 · Badge names concatenate. polish · 30 minutes.** The Doctor rail
button's accessible name computes to `"Doctor38"` — the count span's `title`
("awaiting attention: 38") does not reach the name. `aria-label="Doctor, 38
awaiting attention"` fixes it. Same for `"Review queue0"`.

**5.7 · Not assessed: forced-colors mode, 400% reflow (SC 1.4.10), print, and
real screen-reader output.** See *What I could not assess*.

### 6. Hebrew / RTL parity

I drove the Hebrew mirror through thirteen screens, not a glance.

**6.1 · The chrome translation is complete, and that is a real achievement.**
I scanned every visible leaf node on each screen for English sentences that
were not ids, paths, commands or monospace. Result: **zero English leaks** on
Configure, Ask, Procedures, Export / import, Template packs, Learn, Review
queue and Status. The layout mirrors properly — rail to the right, footer
reversed, scrollbars on the correct side — and dates render `12/09/2026` in
`he-IL` order. No horizontal overflow on any Hebrew screen.

**6.2 · Bidi faults in the footer and the item summary.** Finding 4 above.
**major.**

**6.3 · The Help screen shows English titles while claiming 24 Hebrew
translations exist. major · 2 hours.** The screen says
*"עברית: 24 מתוך 24 נכתבו, נמדד על הדיסק"* — "Hebrew: 24 of 24 written,
measured on disk" — and every row carries an `HE ✅` chip. Every title in the
list is nonetheless in English: *"Capture what you just decided, before you
forget it"*, *"Find the item you're thinking of, from the CLI or the UI"*, and
22 more. The row is reading the English document's `docname` regardless of
language. Worse, each English title is right-aligned as RTL, so a two-line
title wraps with its continuation pushed to the right —
*"Capture what you just decided, before you / forget it"*. Screenshot:
`09-hebrew-help.png`. Fix: read the `he` document's name when `lang === 'he'`,
and `dir="auto"` on `.docname` for the case where it genuinely is English.

**6.4 · Command descriptions in the Composer are English-only. minor ·
depends on catalogue.** e.g. *"record that a person has ruled on a doctor
finding, anchored to the item as it stood"* — these come from the CLI
catalogue rather than the string table, so a Hebrew reader gets English help
for the command they are composing. Two instances measured; presumably one per
command.

**6.5 · No plural rules. minor · 2 hours.** `1 פריטים` — "1 items". Hebrew
needs singular/dual/plural agreement. The English table has the same shape
(`1 items, 7,197 of 40,000 tokens`), so this is one fix for both.

**6.6 · Switching language is a full page reload. minor · a day, or accept
it.** The execution context is destroyed; every screen's cached DOM is thrown
away; the ~7 s cold load is paid again; scroll position and open pane are
lost. Given the cold-load cost in finding 1, fixing that first makes this much
cheaper to live with.

### 7. Copy and microcopy

**7.1 · Every screen title carries an internal design verdict.
major · 1 hour.** Beside each `<h2>` sits
`<span class="verdict">` holding the team's own answer to "does this screen
justify existing outside a terminal?":

| Screen | What the user reads |
|---|---|
| Doctor | ✅ `"exit 1" loses the findings list` |
| Learn | ⚠️ `conditional pass — the corpus cross-links earn it` |
| Status | `a table is a terminal's home ground — a recorded exception` |
| Configure | ✅ `the strongest "a terminal cannot do this"` |
| Review queue | ✅ `the diff is the capability; the approval is a paste` |

Some of these are good taglines — *"filters, for people who do not write SQL"*
(Ask) and *"read, never recorded"* (Conversations) tell a user something true
and useful. But a green tick beside a screen title reads as a **health
claim**, and "conditional pass" reads as "this screen is partly broken". They
are neither. This is the clearest case in the app of process vocabulary
reaching the product surface. Recommend: keep the ones that describe the
screen to its user, drop the tick and the verdict language from the rest.

**7.2 · Button labels say what happens. No finding.** `Run it`, `Cancel`,
`Copy the path`, `Show all 150`, `Write budgets`, `Cold session no seen set`.
No "Submit", no "OK" doing real work. Good.

**7.3 · Field-level jargon is mostly explained in place.** `scopePolicy:
inert`, `matchesScope`, `itemCost`, `Selection.spilled` all appear with a
sentence saying what they mean. That is the right instinct for an expert tool
whose user also maintains the code.

**7.4 · The Capture example is one 600-character line. minor · 1 hour.** The
Capture screen demonstrates `mycontext add` with every flag present at once on
a single unwrapped line. It is a reference, not an example. Recommend a
minimal example plus a disclosure for the full flag set.

### 8. Performance as felt

**8.1 · Time to first useful paint: ~7 s cold, ~110 ms warm.** Finding 1. The
warm number is excellent — switching between already-visited screens measured
104–119 ms, and even Scope coverage (15,445 retained nodes) came back in
796 ms on first visit.

**8.2 · Scrolling does not jank.** On Doctor — 20,180 px, 1,883 nodes — a
40-step scroll gave a **median frame of 18.9 ms**, **p95 23.2 ms**, worst
25 ms, and **zero frames over 50 ms**. No finding.

**8.3 · The live feed polls on top of its own stream. minor · 2 hours.** With
an SSE connection open on `/api/watch/stream`, the page additionally polls
`/api/watch/context` roughly every 7 s and `/api/watch/volume` roughly every
10 s — measured over a 20-second window: 3 and 2 requests respectively. Given
`/api/watch/context` is documented in-source at "4.69 ms p50, grows with the
session's size", this is not expensive today, but it is duplicated work
against a server that already demonstrably stalls (finding 1). Recommend
pushing those two payloads down the existing stream.

**8.4 · The DOM only grows. minor · 3 hours.** Screens are retained with the
`hidden` attribute and never released. Over the review the document went from
**3,124 to 35,028 nodes** — Scope coverage holds 15,445 and Conversations
11,031 of them. JS heap stayed modest at 21 MB, and `hidden` correctly keeps
them out of both the tab order and the accessibility tree, so this is not
urgent. But this is a tool left open all day, and nothing ever shrinks.
Recommend discarding a screen's subtree after, say, three screens away.

**8.5 · 30 MB transferred over a browsing session on loopback.** A
consequence of `no-store` (finding 1) compounded by the full reload on every
language toggle (6.6).

### 9. Anything else that struck me

**9.1 · Zero console messages and zero failed requests, across twenty screens
and two languages.** I checked after every phase. Nothing logged, nothing
4xx/5xx once the credential was held. For an application this large that is
unusual and worth stating.

**9.2 · This UI teaches, and that is its real differentiator.** *"Gates run in
order: eligible, tier, focus, scope, seen, budget — as `select()` uses them.
The first to fail is the answer: above passed, below never reached."* ·
*"First-fit is greedy: same costs in another order spill a different item."* ·
*"The strip holds one **specimen** per gate — the first item that fails there —
so it stays still as selection moves."* A user does not merely see what
happened; they are shown the rule that produced it. Most of my findings above
are about the packaging of that material — line length, type scale, loading
state. The material itself is the best thing here and none of the fixes should
touch it.

**9.3 · The security surface is visible rather than hidden, and the copy is
honest about its own limits.** *"The UI can tell it came from your browser —
not that you asked."* · *"There is no `--trust` flag: a boundary a flag can
override is not a boundary."* · *"No query text crosses the wire."* This is
how security microcopy should read.

**9.4 · The measurement vocabulary is unusually disciplined.** The app
consistently separates *measured zero* ("every item was put to this gate and
none stopped here") from *unmeasured* ("`matchesScope` has no endpoint, so
dropped items are absent, not counted") from *absent* ("this event never
reaches the tier at all"). Three states most products collapse into one blank
space. Keep this; it is the project's signature.

---

## Counts

| Severity | Count |
|---|---|
| Blocker | 0 |
| Major | 12 |
| Minor | 19 |
| Polish | 3 |
| **Total** | **34** |

Majors: cold-load blank (1) · invisible Copy/Execute confirmation (2) ·
keyboard skip + focus order (3) · Hebrew number/unit bidi (4a) · Hebrew corpus
text bidi (4b) · footer overlap and data loss (5) · Composer defaults and
always-on glob panel (2.2) · Glob tester's silent 200 cap (2.3) · Watch table
column sizing (2.7) · Doctor with no narrowing (2.8) · loading state (3.2) ·
target size under 24 px (5.3) · Help screen English titles (6.3) · screen
"verdict" chips (7.1).

---

## What is genuinely good

Said plainly, because a review that only lists faults is not calibrated.

1. **Refusal and empty-state copy.** The 401 names its cause, distinguishes it
   from an empty corpus, explains why a reload cannot recover it, and prints
   the command. The budget refusal quotes the hook verbatim and then says who
   *can* do it and how. The gate explanations distinguish measured zero from
   unmeasured from absent. This is a higher standard than most commercial
   products reach, and the project's reputation for the opposite is, on the
   evidence I gathered, out of date.

2. **Contrast.** Lowest measured ratio outside one transient banner: **5.19:1**.
   Typical: **6.4–10.2:1**. The focus ring measures about **10:1**.

3. **Reduced motion.** Zero unconditional transitions or animations; all motion
   gated behind `prefers-reduced-motion: no-preference`. The correct
   direction, and rare.

4. **The Hebrew mirror is real.** Complete chrome translation across every
   screen I tested, correct layout mirroring, correct date order, no
   horizontal overflow, and `<bdi>` already applied to the untrusted audit
   detail strings. The faults I found are three specific classes, not a
   half-finished translation.

5. **Bounded-list honesty.** *"Showing the first 20 of 36… A display limit.
   All 36 were in the injection — none were dropped."* Every list but one.

6. **The information architecture.** Four rail groups organised by the user's
   question — what arrives / why it did or didn't / what I could change / what
   I can read — rather than by the data model.

7. **Execute's confirm.** Inline rather than modal, shows the exact argv, and
   states the one thing that matters: the UI cannot tell that *you* asked.

8. **It is fast once warm.** 104–119 ms to switch screens; 163 ms to open an
   item pane; smooth scrolling on a 20,000-pixel page.

9. **Zero console noise, zero failed requests.**

10. **Lighthouse Best Practices 100 and Agentic Browsing 100** on both the
    busiest and the quietest screen.

---

## What I could not assess, and why

- **Anything behind a write.** I ran no mutating command. So: the Capture flow
  past composition, Review queue promote/discard, `pack import`, Export/import
  actually importing, and `Write budgets`. The Review queue was empty
  ("None — everything captured is already settled"), so I never saw its
  populated state, which is the state that matters.
- **The cause of the server stall.** I measured that static files block for
  4–6 s behind API calls, which points at the event loop, but I did not
  profile the server process — it is the owner's and off limits as a process.
- **The Relations graph rendered.** The screen listed candidate centres; I did
  not select one and did not see a drawn ego-graph. A corpus item warns the
  demo corpus has no relations at all, so this may behave differently there.
- **Real screen-reader output.** I read the accessibility tree and computed
  accessible names; I did not run NVDA, JAWS or VoiceOver. Names, roles,
  landmarks and live-region politeness are verified; *spoken* order and
  verbosity are not.
- **Lighthouse's performance category** — excluded by the MCP tool. I measured
  navigation, resource and frame timings directly instead; those are the
  numbers in finding 1 and section 8.
- **Forced-colors / high-contrast mode, print, 400% reflow (WCAG 1.4.10), and
  touch.** Out of the time I had, and the last two are arguably out of scope
  for a desktop operator tool — though 1.4.10 is not, and given finding 5 it
  is likely to fail.
- **The anchors work in flight.** Another lane was editing `src/ui/public/**`
  throughout. Screens can have changed between my screenshot and this
  sentence, and the version-skew banner was present for the whole review. I
  re-checked every layout finding after a reload before recording it.
- **The demo corpus.** Everything here was measured against the live
  `my-context` corpus: 1,107 items, 95 doctor findings, 635 audit rows.
  Several `KNOWN-` items describe demo-corpus-specific behaviour I did not
  exercise.
