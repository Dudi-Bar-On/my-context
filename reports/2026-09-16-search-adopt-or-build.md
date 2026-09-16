Deep research for `TASK-find-the-editor-grade-search-this-project-should-adopt` (`semantic/6`),
2026-09-16. The owner asked to ADOPT rather than author — *"do a deep research over open source
packages available in node if ui component exists it's an advantage and let's use such a solution
without much effort"* — and then removed the obstacle everyone assumed was fatal: *"importing a
library and or source code and embedding it in our code is not considered runtime dependency"*, now
recorded in `CONST-zero-runtime-dependencies`.

So this report does not ask *may we*. It asks **which source, which part of it, and what would this
project be taking on by owning it** — the shape
`DEC-markdown-it-is-vendored-as-the-tokeniser-and-the-drawings` already set.

Every package number below was taken by downloading the published tarball from
`registry.npmjs.org` and measuring the file, not by reading a README or a bundle-size badge.
Every corpus number is from this repository's own live index, read-only. Nothing was installed,
`package.json` was not touched, and no lane's files were edited.

---

# THE ANSWER IN TWO PARAGRAPHS, ONE PER SURFACE

**(A) FIND IN THE DOCUMENT I AM READING — adopt exactly one thing, and it is 123 lines.**
Every editor component fails here for a reason that has nothing to do with size: **the document is
not in the browser.** The session the owner opens is 133,232,086 bytes across 52,292 records, and
`conversations.js` holds only an outline (each turn's first ~140 characters) plus a windowed,
deliberately non-monotonic `bodies` cache filled from `/api/conversations/:id/nodes`. CodeMirror,
Monaco and Ace all require you to hand them the whole document; a DOM highlighter like mark.js
requires the text to be in the DOM, and in a virtualised scroll it is not. What IS adoptable is the
one piece of CodeMirror that never touches a document or a DOM: **`SearchCursor`, 123 lines, MIT,
which duck-types on five members** (`text.iterRange`, `text.length`, `iter.next`, `iter.value`,
`iter.done`) and can therefore be pointed at the span array this project already has. It buys one
measured thing — NFKD folding with the offsets mapped back to the original text — and on this
corpus that is worth **456 → 1,012 spans** for a reader who types `...` when the app wrote `…`.
Take it into `src/core/`, as the second stage behind FTS5, and take nothing else from CodeMirror.

**(B) SEARCH THE WHOLE ARCHIVE — embed nothing, and the evidence is not close.** Five in-memory
index libraries were built over the real 12.76 MiB prose corpus and measured. Every one of them is
a downgrade, and **Hebrew is what settles it, not size**: on three bare words the corpus writes with
a front particle glued on, the shipped trigram FTS5 index returns 15 / 6 / 8 spans in 0.01–0.04 ms,
MiniSearch returns 4 / 0 / 2, FlexSearch 6 / 0 / 2, and **Lunr and Orama return 0 / 0 / 0**. Fuse.js
gets Hebrew right and costs **827 ms a query** because it is a linear fuzzy scan with no index at
all. A JavaScript inverted index here is the `unicode61` tokenizer this project already measured at
51x worse, re-imported through a package. Lane AC's §6 refusal was right; it was right for the wrong
reason, and this report supplies the right one.

---

# 1. WHAT CHANGED SINCE LANE AC, AND WHAT DID NOT

AC surveyed the packages and recommended none, **citing `CONST-zero-runtime-dependencies`**. The
constraint now says in its own body that this was a misreading — *"reading a rule about downloads as
a rule about libraries… The answer it could have given was legal the whole time and sitting beside
three examples of itself."*

So the survey has to be re-run against the real gate, which is the other constraint.
`CONST-node-24-no-build-step`: source runs as shipped, only erasable TypeScript, the UI is plain
files a browser loads with no bundler. **That is now the sharpest edge, and it disqualifies more
candidates than the dependency rule ever did.**

What did NOT change, and is built on rather than re-derived: AC's §2 (what FTS5 supports under
trigram), §2.1 (`NEAR` is a distance in characters), §3 (Hebrew) and §4 (the corpus box versus the
archive box).

## 1.1 The corpus, re-measured today

```
  archive index      470 source files, 1,241,841,802 bytes scanned
                     245,575 records  ->  11,214 prose spans, 13,376,813 chars indexed
                     FTS5 trigram index 82,153,472 B of an 89,853,952 B database
  the one session
  a reader opens     52,292 records, 133,232,086 bytes
                     967 prompts, 3,415 answers, 47,910 machinery records
                     4,394 prose spans, 5,549,737 UTF-16 units, 5,603,005 UTF-8 bytes
```

**Two facts to carry into everything below.**

  1. **Only prose is indexed.** `conversation_prose` holds `kind` in `{prompt, answer}` and nothing
     else — 13.4 MB of the 1.24 GB scanned, **1.08%**. Machinery (tool calls and their output) is
     96% of the bytes of a session and is searchable by nothing, on any surface, today. That is a
     design choice and probably the right one, but no candidate in this report changes it and a
     reader is nowhere told it.
  2. **The reader's document is 133 MB and the browser has ~140 characters of each turn.**
     `transcript-scroll.js` says so itself: *"The outline carries each turn's OPENING (`p`, 140
     characters) and the tools a run ran, not every word of a 61 MB file."* Bodies arrive in windows
     and `bodies` *"IS NOT MONOTONIC"* — `rebuildReplaced` clears the whole map.

---

# 2. SURFACE (A) — FIND IN THE DOCUMENT I AM READING

## 2.1 The fact that disqualifies the whole category, before any byte is counted

An editor component is a **document model plus a view over it**. Its find widget is fast and correct
precisely because the component owns every character. To use Monaco's find widget you must give
Monaco the document; to use CodeMirror's search panel you must give CodeMirror the document.

This screen cannot. 133 MB is not going into a browser tab, and the 9,977 lines of
`conversations.js` exist to avoid putting it there. Adopting an editor is therefore not "adopting a
find bar" — it is **replacing the renderer, the virtualiser, the anchor model, the lane links, the
ANSI and Markdown pipelines and the RTL handling** with an editor's own. That is the opposite of
*"without much effort"*, and it is worth saying plainly because the owner's instinct — *an editor
solved this, take the editor* — is correct everywhere except where the document is too big to hand
over.

**And the DOM half fails for the twin reason.** `mark.js` (8.11.1, MIT, 14,013 B, gz 5,361,
`NodeFilter` ×6, zero ESM exports, last release **2018-01-11**) walks text nodes. In a virtualised
scroll the rows that are not on screen are not text nodes. A DOM highlighter here does not perform
badly; it silently reports the wrong count, which `INV-nothing-is-dropped-silently` treats as worse
than failing.

## 2.2 The gate, run against each candidate's published files

`scripts/check-vendor.ts`'s seven `FORBIDDEN` constructs and the bare-specifier rule, applied to
what each package actually publishes:

| candidate | version | published shape | FORBIDDEN hits | bare specifiers | verdict |
|---|---|---|---|---|---|
| `monaco-editor` `min/vs/editor/editor.main.js` | 0.56.0 | AMD | **`new Worker`×5, `importScripts`×1** | — (AMD) | **refused** |
| `monaco-editor` `min/vs/loader.js` | 0.56.0 | AMD loader, 39,848 B | **`eval(`×2, `new Function`×2, `importScripts`×2** | — | **refused** |
| `ace-builds` `src-min-noconflict/ace.js` | 1.44.0 | UMD, 475,029 B | **`XMLHttpRequest`×1, `new Worker`×2, `importScripts`×2** | — | **refused** |
| `mark.js` `dist/mark.es6.min.js` | 8.11.1 | UMD, 14,013 B | none | — | admissible, **architecturally wrong** (§2.1) |
| `@codemirror/search` `dist/index.js` | 6.7.2 | ESM, 48,927 B (gz 11,603) | none | **`@codemirror/view`, `@codemirror/state`, `crelt`** | **refused as a file** |
| `@codemirror/state` `dist/index.js` | 6.7.5 | ESM, 147,396 B (gz 34,989) | none | **`@marijn/find-cluster-break`** | **refused as a file** |
| `@codemirror/view` `dist/index.js` | 6.43.12 | ESM, 492,050 B (gz 118,909) | none | **4** | **refused as a file** |

Monaco is 24 MB of `min/` and its editor chrome alone is a 350,112 B stylesheet. Ace is 53.8 MB
unpacked. Neither number is the reason either is refused — **five of the seven forbidden constructs
appear between them**, and both need a module loader this project does not have.

The CodeMirror refusals say *"as a file"* deliberately. Every `dist/index.js` is clean of all seven
constructs and would pass the offline scan; it fails only the bare-specifier rule — which is exactly
why `VENDOR.md` rejected Web Awesome's `dist/` build: *"its imports are bare (`lit`,
`@lit/context`, `nanoid`) and need a resolver, which `CONST-node-24-no-build-step` does not permit."*
Unlike Web Awesome, CodeMirror publishes **no** self-resolving CDN build. So the vendor road is
closed for CodeMirror, and the source road is the only one.

## 2.3 The one part worth taking, and the five members it needs

`@codemirror/search/src/cursor.ts` — **123 lines** — is the entire `SearchCursor`. Measured against
its own source, it reaches into CodeMirror for exactly this:

```
  text.iterRange   text.length   iter.next   iter.value   iter.done
```

**That is a duck-typed interface, not a dependency.** Anything with `length` and an `iterRange(from,
to)` returning `{next(), value, done}` satisfies it — and this project already holds the session as
an array of span strings, which is three lines away from being one. **None of the 583-line `Text`
rope is needed, none of the 480 kB editor view, none of the search panel.** This is the same shape
as *"markdown-it as a TOKENISER ONLY"* and *"only twenty-six chunks of it"*.

It also needs five characters' worth of helpers — `codePointAt`, `codePointSize`, `fromCodePoint`
from `@codemirror/state/src/char.ts`, which are **25 of that file's 37 lines** and depend on nothing
(`findClusterBreak`, the one function that pulls `@marijn/find-cluster-break`, is not used by
`cursor.ts`).

**Total adoptable surface: ~148 lines, MIT.**

### What it buys, measured on this corpus

`SearchCursor` normalises both the query and the text with `.normalize("NFKD")` unconditionally, and
then does the genuinely hard part: **maps the match back to offsets in the ORIGINAL text even when
normalisation changed the length.**

That is not theoretical here. Across the whole archive, **806 of 11,251 spans change under NFKD**;
within one session, **394 of 4,394 change and 376 of those change length**. The characters
responsible, counted rather than guessed:

```
  U+2026 "…"  x3062      U+2011 "‑"  x66       U+2260 "≠"  x47
  U+2460 "①"  x19        U+2139 "ℹ"  x16       U+00B2 "²"  x11
  U+00B5 "µ"  x8         U+FF5C "｜" x3        U+00F6 "ö"  x3
```

So the win has a name: **the ellipsis.** This product writes `…` everywhere — in truncations, in
snippets, in its own docblocks — and a reader types three dots.

```
  spans containing literal "…"                  752
  a reader types "..."  — FTS5 trigram          456
  a reader types "..."  — plain indexOf         456
  a reader types "..."  — NFKD-folded           1012     <- what SearchCursor does
```

**456 → 1,012 spans, a 2.2x gain on one query a reader would plausibly type**, and neither the
shipped index nor a hand-written `indexOf` has it. Typing `-` finds the 27 spans carrying a
non-breaking hyphen for the same reason.

### What it does NOT buy, said before it is offered

  - **It does nothing for Hebrew.** NFKD does not fold case, does not strip niqqud (of which this
    archive has **one span**), and does not touch a glued front particle — the one Hebrew problem
    `semantic/1` and `semantic/2` both measured. `hebrewVariants` remains the only answer to that.
  - **Its offsets are UTF-16 code units and this project uses BYTE offsets.** They genuinely differ:
    53,268 bytes over one session's 4,394 spans, with a single span diverging by 943. The conversion
    is the caller's and is not free.
  - **It contains one parameter property** — `constructor(… private test?: …)` on line 37 — which
    `CONST-node-24-no-build-step` forbids by name (*"no enum, no namespace, no parameter
    properties"*). One mechanical edit, and it is the edit that turns a pinnable vendored file into
    **our source**, which is the real price: `check-vendor.ts` can no longer verify it against
    upstream.
  - **`RegExpCursor` is a different proposition and is not recommended.** 193 lines, but it needs
    `text.lineAt`, `text.slice`, `text.charCodeAt` and `iter.lineBreak` — the real rope, 583 lines —
    and carries three parameter properties. And AC's §6 already refused regex on the stronger ground
    that it cannot use the index at all.

### Where it goes, and why not `vendor/`

**`src/core/`, not `src/ui/public/lib/vendor/`.** Three reasons, in order of weight:

  1. **The text is on the server** (§2.1). A browser-side matcher has nothing to match.
  2. **It must be hand-translated** (the parameter property, and `.ts` → the UI's plain `.js` if it
     ever moved), so it is not byte-identical to anything upstream publishes and cannot carry a
     SHA-256 pin. `VENDOR.md`'s whole contract is *"committed here unmodified"*. Putting a modified
     file under that heading would weaken the gate for every file already there.
  3. **It is the second stage of a two-stage search, and the first stage is already here.**

### The two-stage shape, and the gap in FTS5 that makes the second stage necessary

**FTS5 has no `offsets()`.** Verified against the live index: `offsets(conversation_prose)` fails
with *"unable to use function offsets in the requested context"* — it is an FTS3/4 function.
`highlight()` and `snippet()` work but return *marked-up text*, not positions. So a find bar that
needs a hit COUNT, a next/previous walk and a byte offset per hit **cannot get them from FTS5 at
all**, and that is true today, independent of anything recommended here.

The shape that follows:

```
  stage 1  FTS5 trigram, scoped to the session   ->  candidate spans
  stage 2  SearchCursor over those spans only    ->  every hit, NFKD-folded, with offsets
  stage 3  caller maps UTF-16 -> byte offsets, and drives Scroller.top()
```

Measured cost of each stage on the real index, median of 25:

```
  FTS5 scoped to one session   "byte offset"     1.29 ms      30 spans
                               "trigram"         0.77 ms      21 spans
                               NEAR(…, 30)       1.35 ms      42 spans
                               "the"            27.15 ms   3,964 spans   <- the pathological one
  naive JS over the WHOLE session, lowercase cached
                               "byte offset"     1.91 ms      45 hits
                               "trigram"         3.64 ms      40 hits
                               "the"             9.33 ms  62,767 hits
```

Stage 2 runs over the spans stage 1 returned — tens of KB, not 5.6 MB — so it is free. **And note
the last row honestly: for a common word, scanning the whole session in JavaScript is three times
FASTER than asking FTS5 for it.** The index earns its place on selectivity, not on every query.

## 2.4 The highlight half: adopt nothing, the platform now has it

`mark.js` and every library like it wrap matches in `<mark>` elements. In this document that is
actively harmful — mutating the DOM inside a virtualised scroll re-measures rows, and `paint`'s
anchor-node arithmetic exists to stop exactly that kind of movement.

The **CSS Custom Highlight API** highlights `Range` objects through `CSS.highlights` and
`::highlight()` **without touching the DOM at all**. Chrome/Edge 105 (Aug 2022), Safari 17.2
(Dec 2023), Firefox 140 (Jun 2025) — **Baseline "newly available" since June 2025 and an Interop
2026 focus area**. Zero bytes vendored, no licence, nothing to re-sync, and it is the only
highlighter whose failure mode under virtualisation is "the range is not rendered" rather than "the
layout moved".

This repo does not use it yet (`grep` for `CSS.highlights` in `src/ui/public/` returns nothing) and
already has the `<mark>` habit at `conversations.js:2297`.

## 2.5 And "if ui component exists it's an advantage" — it does not exist

Searched for, and the honest answer: **there is no standalone find-bar web component.** What exists
is (a) editor find widgets, inseparable from their editor; (b) DOM highlighters — `mark.js`,
`highlight-text`, `find-in-nw` — all of which walk text nodes; (c) browser-extension APIs
(`browser.find.find`) unavailable to a page. Web Awesome, already vendored here, ships no such
component either.

So the UI half of surface (A) is this project's to draw, and it is small: an input, a count, two
arrows. VS Code has held that surface to exactly three toggles for eight years, and AC's §5 already
argued the right number of new controls here is zero.

---

# 3. SURFACE (B) — SEARCH THE WHOLE ARCHIVE

## 3.1 Every candidate, built over the real corpus

Not estimated. Each library was imported from its extracted tarball and made to index all **11,251
prose spans / 13,377,130 characters (12.76 MiB)**, on Node 24 with `--expose-gc`, heap measured by
`v8.getHeapStatistics()` after a forced collection.

| engine | version | licence | build | heap | `"byte offset"` | Hebrew שורה / פרויקט / רמת |
|---|---|---|---|---|---|---|
| **FTS5 trigram (ships today)** | SQLite 3.51.2 | public domain, in Node | **already built** | **0 JS heap** | 0.44 ms | **15 / 6 / 8** |
| substring baseline (`indexOf`) | — | — | 25 ms | +25.3 MiB | 3.97 ms | **15 / 6 / 8** |
| MiniSearch | 7.2.0 | MIT | 1,793 ms | +63.8 MiB | 0.61 ms | 4 / 0 / 2 |
| FlexSearch | 0.8.212 | Apache-2.0 | 2,376 ms | +84.2 MiB | 0.11 ms † | 6 / 0 / 2 |
| Orama | 3.1.18 | Apache-2.0 | 5,306 ms | +130.4 MiB | — | **0 / 0 / 0** |
| Lunr | 2.3.9 | MIT | 2,845 ms | +243.1 MiB | 2.05 ms | **0 / 0 / 0** |
| Fuse.js | 7.5.0 | Apache-2.0 | 44 ms | +3.6 MiB | **826.89 ms** | 30 / 6 / 8 |

† FlexSearch's default result limit is 100, so its counts are capped and not comparable as reach.

**The Hebrew column is the whole decision.** Those three queries are bare words taken from the
corpus's own 571 Hebrew word types, each of which the corpus writes with a particle glued on the
front (`השורה`, `הפרויקט`, `ברמת`) — the exact failure `semantic/1` measured at trigram 1.3% versus
unicode61 0.03%. **Lunr and Orama return nothing for any of them.** MiniSearch and FlexSearch return
a fraction. The shipped index returns all of them in 0.01–0.04 ms.

This is not a tuning problem. Every one of these libraries tokenises on word boundaries and stems
for English; Orama ships stemmers for 31 languages and [`he` is not one of
them](https://github.com/oramasearch/orama/tree/main/packages/stemmers/lib), and HebMorph — the real
work — is Java/.NET and needs hspell's ~460k-word dictionary. **A JavaScript inverted index here is
`unicode61` reintroduced through a package**, which is the thing this project measured and rejected.

Fuse.js is the mirror image: it LOSES no Hebrew hit, because it has no tokenizer at all — but read
its 30 against the baseline's 15 as what it is, an approximate scan over-returning rather than a
better answer. And it pays **827 ms per query** for that scan. At 20,000x the shipped latency it is
not a search box.

## 3.2 And these numbers are the optimistic ones

The 12.76 MiB is the *indexed prose* — 1.08% of the 1.24 GB scanned. If machinery were ever indexed,
the in-memory engines scale roughly linearly: Lunr's +243 MiB becomes a multi-gigabyte heap, and
Orama's 5.3 s build becomes minutes. **FTS5 grows on disk and costs no JS heap at all.** The
direction of the gap widens with the corpus; it does not close.

## 3.3 So: embed nothing for surface (B)

A real inverted index, BM25-ranked, character-level so Hebrew works, already exists in the file and
in the runtime — and `matchProse` already orders by `bm25()`. **A library that duplicates FTS5 in
JavaScript is a downgrade dressed as an upgrade**, and that is what the measurements say it is.

---

# 4. HOW THIS RELATES TO WHAT LANE AF IS LANDING

AF is implementing AC's recommendation — one query read three ways (phrase, `NEAR 30`, `AND`) shown
in tiers — in `src/core/conversation-search.ts` and `src/ui/public/screens/conversations.js`.
Neither file was read for edit here and neither was touched.

**Nothing in this report replaces it, and nothing makes it unnecessary.**

  - **Surface (B): AF's work IS the answer.** §3 says embed nothing, which means the tiers are the
    whole of the improvement available on the archive box. Landing them is more valuable after this
    report than before it, because the alternative has now been priced and refused.
  - **Surface (A): the SearchCursor recommendation sits BESIDE AF's, one stage downstream.** AF
    decides *which spans*; `SearchCursor` would decide *which offsets inside them*. The tiering
    survives unchanged — a find bar wants hits within the phrase tier — and AF's per-term short-word
    disclosure (its TWO) is what a find bar's count line should reuse rather than re-invent.
  - **One conflict to flag, not to resolve:** AF's tiers de-duplicate spans across tiers, and a find
    bar needs every hit in document order. Those are different orderings of the same result set, so
    whoever lands the find bar should take the tier as a *label* on a hit and not as its sort key.

---

# 5. THE COSTED TABLE

Everything measured; nothing estimated. "Lines" is the part actually needed, not the package.

| candidate | version / licence | what you would embed | lines | shippable size | transitive | upstream | passes the gates? | what the owner buys / pays |
|---|---|---|---|---|---|---|---|---|
| **`SearchCursor`** (`@codemirror/search`) | 6.7.2, **MIT** © 2018-2021 Marijn Haverbeke | `src/cursor.ts` + 25 lines of `char.ts` | **~148** | ~5 kB of source | **none** — duck-types on 5 members | 4 releases/12 mo, 45 total, **1 maintainer** | source yes, after erasing **1 parameter property**; **not** vendorable as a file (bare specifiers) | **Buys** NFKD folding with offsets mapped back — 456 → 1,012 spans on `...`. **Pays** ~148 lines this project now owns, a UTF-16 → byte conversion, and no help for Hebrew. |
| CSS Custom Highlight API | web platform | nothing | 0 | **0 B** | none | Baseline Jun 2025, Interop 2026 | yes, trivially | **Buys** highlight-all that cannot perturb a virtualised layout. **Pays** nothing. |
| `mark.js` | 8.11.1, MIT | `mark.es6.min.js` | — | 14,013 B (gz 5,361) | 0 | **last release 2018-01-11** | gate yes | **Buys** nothing here — walks text nodes that are not in the DOM. Superseded by the line above. |
| `monaco-editor` | 0.56.0, MIT | the editor | — | 24 MB `min/` + 350 kB CSS | 2 | active, 7 maintainers | **NO** — `new Worker`, `importScripts`, `eval(`, `new Function`; AMD | **Pays** the renderer, the virtualiser, the anchors, the ANSI/Markdown pipelines. Not a find bar; a different project. |
| `ace-builds` | 1.44.0, BSD-3 | the editor | — | 475,029 B (gz 126,124) | 0 | active | **NO** — `XMLHttpRequest`, `new Worker`, `importScripts`; UMD | as above. |
| `@codemirror/*` full editor | MIT | 7 packages | — | 771,692 B raw / 185,857 B gz | 14 | active, 1 maintainer | **NO** as files — bare specifiers throughout | as above. |
| MiniSearch | 7.2.0, MIT | index + BM25 | — | 807 kB unpacked | 0 | active, 1 maintainer | source yes | **Buys** 0.61 ms queries. **Pays** 1.8 s build, +63.8 MiB heap, and **Hebrew 4 / 0 / 2 against 15 / 6 / 8**. |
| FlexSearch | 0.8.212, **Apache-2.0** | index | — | 2.28 MB unpacked | 0 | active, 1 maintainer | source yes | **Pays** 2.4 s, +84.2 MiB, Hebrew 6 / 0 / 2, **plus a NOTICE obligation**. |
| Orama | 3.1.18, **Apache-2.0** | index | — | 2.14 MB, 571 files | 0 | active, 2 maintainers | source yes | **Pays** 5.3 s, +130.4 MiB, **Hebrew 0 / 0 / 0**, a NOTICE obligation, and no `he` stemmer. |
| Lunr | 2.3.9, MIT | index | — | 953 kB | 0 | **last release 2020-08-19** | source yes | **Pays** 2.8 s, **+243.1 MiB**, **Hebrew 0 / 0 / 0**, unmaintained. |
| Fuse.js | 7.5.0, **Apache-2.0** | fuzzy scanner | — | 407 kB | 0 | active, 1 maintainer | source yes | **Buys** correct Hebrew and typo tolerance. **Pays 827 ms a query** and a NOTICE obligation. |

**On licences, since embedding makes them load-bearing.** MIT and BSD-3 require the copyright notice
and permission text to travel with the copy — one header on the file plus a `LICENSE-*.txt` beside
it, exactly as `LICENSE-markdown-it.txt` already does. **Apache-2.0 is different and costs more**:
§4(d) requires carrying any `NOTICE` file's attributions, and §4(b) requires marking modified files
as changed. FlexSearch, Orama and Fuse.js are all Apache-2.0 — a third reason, on top of the two
measured ones, not to embed any of them. **Nothing surveyed is copyleft**; no GPL, LGPL or MPL
candidate reached the shortlist, and if one had it would be a separate ruling, not a table row.

---

# 6. WHAT THE OWNER IS BEING ASKED TO TRADE — ONE LINE

**Nothing on the constraint, and ~148 lines of somebody else's MIT source on the maintenance
ledger:** the dependency question is already settled in his favour, the only real trade is that
`SearchCursor` becomes this project's code to keep, in exchange for a find that folds `…` into `...`
and can report a hit count FTS5 cannot produce at all.

---

# 7. IF HE SAYS "KEEP THE CONSTRAINT" — WHICH IS NO LONGER THE QUESTION, BUT THE ANSWER MUST EXIST

The constraint as written already permits this, so "keep it" and "adopt SearchCursor" are not in
tension. If he instead means **"embed nothing at all, write it here"**, the answer is small and the
report does not change shape:

  - **Surface (B): identical.** §3 recommends embedding nothing already. AF's tiers land unchanged.
  - **Surface (A): write ~40 lines instead of taking ~148.** Normalise both sides with
    `.normalize('NFKD')` before matching — that is one line and captures the 456 → 1,012 ellipsis
    win. What the remaining ~40 lines buy is the part that is easy to get wrong: mapping a match
    found in normalised text back to an offset in the original, when 376 spans in a single session
    change length under normalisation. Hand-written, that is the defect class `DEC-markdown-it`
    describes — *"real, and half a fix"*.
  - **The highlight half costs nothing either way**, because §2.4 recommends a platform API.

So the honest ranking is: adopting is better, but the gap is ~40 lines of subtle offset arithmetic,
not a feature. **This is emphatically not a case where refusing the library costs the owner the
feature** — unlike the markdown-it ruling, where patching the regex reached 30% against 100%.

---

# 8. WHAT I WOULD DO, IN ORDER

  1. **Let AF land.** It is the whole of surface (B) and the first stage of surface (A).
  2. **Draw the find bar with no new library**: an input, a count, two arrows, `CSS.highlights` for
     highlight-all, `Scroller.top()` to land on a hit. Zero vendored bytes.
  3. **Then, and only if the count line proves it is wanted**, embed `SearchCursor` as the offset
     stage — `src/core/`, MIT header preserved, `LICENSE-codemirror.txt` beside it, a `VENDOR.md`
     section titled *"Why CodeMirror's SearchCursor, and only the cursor"* recording the five
     members it needs, the parameter property that was erased, and the re-fetch line
     `https://raw.githubusercontent.com/codemirror/search/6.7.2/src/cursor.ts`.
  4. **Say the 1.08% out loud somewhere a reader can see it.** Machinery is 96% of a session and is
     searchable by nothing. That is the largest honest gap in this product's search and no library
     in this report touches it.

---

# 9. WHAT WOULD MAKE THESE NUMBERS WRONG

  - **The in-memory benchmarks used default configuration.** Each library has knobs — MiniSearch
    takes a custom `tokenize`, FlexSearch has `tokenize: 'full'` — and a character-level
    configuration would improve the Hebrew column at a large cost in build time and heap that was
    not measured. The claim made here is about their defaults and their design, not their ceiling.
  - **FlexSearch's counts are capped at its default limit of 100**, so its reach column is not
    comparable with the others'. Its Hebrew column, being below 100, is.
  - **Three Hebrew queries is a small fixture.** They were chosen from the corpus's own 571 Hebrew
    word types by frequency, and the corpus holds Hebrew in only 166 of 11,214 spans. The mechanism
    they demonstrate is the one `semantic/1` measured at scale on the UI string table; these three
    are that mechanism confirmed on real traffic, not a replacement for it.
  - **Heap figures are Node's, not a browser's**, and they include the document array the harness
    itself holds (the baseline row's +25.3 MiB is that array). The deltas between engines are the
    comparable part.
  - **`SearchCursor`'s five-member interface was read off its source, not exercised.** The file was
    not executed here, because executing it needs either a bundler or the rope — and that it needs
    neither is the claim. A lane implementing it should pin the ellipsis case as a test first.
  - **The NFKD win is measured as spans REACHED, not as spans a reader wanted.** 456 → 1,012 is
    recall; nothing here says the extra 556 are relevant.
  - **The corpus grows under the measurement.** This session is itself being indexed: the archive was
    11,214 spans at the start of this lane and the session's own record count moved during it. Every
    figure is right for the run printed beside it.
  - **`monaco-editor` and `ace-builds` were gate-scanned on their minified builds only.** Their ESM
    trees (31 MB and the `src/` tree) were not scanned; the refusal rests on the builds a page would
    actually load.

---

# FOUND AND DELIBERATELY NOT FIXED

  1. **Only 1.08% of the scanned archive is searchable.** 13,376,813 indexed characters against
     1,241,841,802 bytes scanned; `conversation_prose.kind` is `{prompt, answer}` and machinery —
     47,910 of one session's 52,292 records — is in no index. Not a defect, but nothing on any
     surface tells a reader the scope of what they just searched, which is the shape
     `INV-nothing-is-dropped-silently` covers.

  2. **FTS5 offers no `offsets()`, and nothing says so.** `offsets(conversation_prose)` fails with
     *"unable to use function offsets in the requested context"*. Any future find-next/find-previous
     work will meet this; it is recorded here so it is met as a known bound rather than as a
     surprise.

  3. **`src/ui/public/lib/highlight.js` priced highlight.js at 49,091 B and refused it on
     proportion** — *"49,091 vendored bytes to colour 25 blocks"* — citing
     `CONST-zero-runtime-dependencies` as *"a library arrives as vendored bytes with a SHA-256 pin"*.
     That reasoning is sound and unaffected by the owner's clarification, which changes what is
     permitted and not what is proportionate. Named because the file's header will look like it
     rests on the misreading the constraint has since corrected, and it does not.

  4. **The phantom id `STD-nothing-to-do-and-could-not-look-are-different-answers` is still cited**
     in `src/core/conversation-search.ts` and `src/core/anchor-pass.ts`, as AC's finding 6 reported.
     It resolves to no item. Still not this lane's to fix, and `src/core/conversation-search.ts` is
     held by AF.
