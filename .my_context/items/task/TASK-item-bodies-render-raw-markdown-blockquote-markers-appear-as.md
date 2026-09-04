---
id: TASK-item-bodies-render-raw-markdown-blockquote-markers-appear-as
type: task
title: "item bodies render raw markdown: blockquote markers appear as literal text"
status: active
severity: soft
always: false
summary: The inline formatting was repaired, and quoted passages still show their punctuation as stray characters because that part is a design decision, not a bug.
summary_of: 6ba9409d0b74ffde
summary_was:
  - 2026-09-03 Quoted passages in an item show their punctuation as stray characters mid-sentence, and fixing it is a decision about the design, not a bug.
acknowledged:
  - body_disagrees_with_meta@91ba2ad248254faa
  - citation_form@91ba2ad248254faa
  - state_unaudited@91ba2ad248254faa
scope: []
tags:
  - v2
  - ui
  - "screen:preview"
  - tree-parity
  - "plan:walk"
  - "seq:37"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 3b62178f52a51b57
plan: walk
seq: "37"
state: done
priority: "1"
source: "owner request 2026-08-25: preview, app vs mockup, on the REAL corpus"
---

# item bodies render raw markdown: blockquote markers appear as literal text

LANDED 2026-08-25 under `plan:walk seq:37`, code 18d4477. What landed is the INLINE half, and it is not the half the title names; the owner has ruled that the blockquote remainder is a concern of its own rather than this work's unfinished tail, and `TASK-serve-markdown-documents-to-the-ui-behind-a-decided-boundary` already reads this work as satisfied and carries that caution forward as its own.

WHAT LANDED, and it was a real app gap against the design of record. The owner looked at the delivered pane and said the text was "not formated as in the mockup". He was right, and the cause was a THIRD thing, neither the app being mistaken about blockquotes nor the mockup's sample being short:

  `preview.js`'s `bodyNodes()` rendered `<p>` and `<ul>` and NOTHING INLINE.
  The mockup's `.blkbody` is authored markup carrying `<b>20</b>` and
  `<span class="m">pgbouncer</span>`. So a body written `**20**` reached the
  delivered pane with its asterisks showing — on the one screen whose whole
  promise is "exactly what Claude gets".

That is closed: `bodyNodes()` was made to delegate to `markdownNodes`, the mockup's own renderer, which already emits exactly the four shapes `.blkbody` authors by hand. Re-measured 2026-09-03, and the repair held while the code moved under it: neither `bodyNodes` nor the header quoted below survives in `screens/preview.js` at all, and the item pane now calls `markdownNodes` out of `screens/docs.js` directly from `app.js`.

WHAT WAS NOT DONE, said plainly: blockquotes. Both renderers are the same renderer now and it has no blockquote branch, because the mockup's has none. A body written with `>` still reaches the pane with its markers showing, exactly as the finding below describes. Rendering them needs a mockup change first, drafted under `DEC-claude-drafts-the-mockup-and-the-owner-approves`: add a blockquote branch to the mockup's renderer and a `.md blockquote` rule to its stylesheet, then carry both. Still worth doing — this corpus is full of blockquotes and they are the ugliest thing on the screen — and still a change to the DESIGN that the owner decides, rather than a defect in the app.

WHAT THIS WAS FILED AS, kept whole because the reasoning is the part worth having.

FOUND 2026-08-25 by owner request 2026-08-25: preview, app vs mockup, on the REAL corpus. THE MOST VISIBLE DIFFERENCE ON THE SCREEN, and it had no task anywhere.

WHAT THE OWNER SEES. The mockup draws an item body as formatted prose with a bulleted list. The app draws THIS, verbatim from the running server:

    > A regression test is worth nothing until you have watched it fail
    without the > fix. Break the fix on purpose, run the test, see it red,
    then restore. > > Measured on 2026-08-23, twice in one session...

The `>` characters are rendered as TEXT, and because the newlines that separated them collapse, they land MID-SENTENCE. "without the > fix" is not a typo in the corpus; it is the screen printing a markdown marker as prose.

THE CAUSE, and it is honest rather than careless. `screens/preview.js` said so in its own header, at lines 181-224 as that file stood on 2026-08-25: "Not a markdown renderer". `bodyNodes()` handled exactly TWO shapes -- prose paragraphs, and `-`/`*` bullets -- because those are "the ONE structural shape the design of record draws inside a block". It was built to the mockup and the mockup's sample bodies use bullets. The cited code is gone rather than moved: neither that header nor `bodyNodes` is in that file any more, so the line range is recorded as the reading that was taken and there is nothing to repoint it at.

THE FIXTURE HID IT, FOR THE SIXTH TIME. `.demo-corpus` bodies use bullets, which `bodyNodes` rendered correctly. The REAL corpus is written by people who use blockquotes, and this project's own items are full of them. Every measurement ever taken of this screen was taken against the fixture.

WHAT IT NEEDS -- AND IT IS AN OWNER DECISION BEFORE IT IS WORK, because the honest answers differ in size:
  A. Render the shapes the corpus actually contains -- blockquote, fenced code, inline backticks, headings. That is a markdown renderer, with zero runtime dependencies, and it is a real feature.
  B. Render the shapes the MOCKUP draws and STRIP the markers it does not, so a blockquote shows as prose without a stray `>`. Small, honest, and loses the quotation.
  C. Draw the body as preformatted text, markers and line breaks intact. Smallest, ugliest, and never lies.

MEASURE FIRST: count which markdown shapes actually occur across the 489 items of this corpus. The answer decides between A and B and it is one query.

IT IS ADJACENT TO BUT NOT THE SAME AS `plan:walk seq:25` (serve markdown DOCUMENTS to the UI). That one is about files on disk behind a route; this is about an item's own body, already served, already on screen, rendered wrongly.

CORRECTED 2026-08-25, BEFORE ANY CODE WAS WRITTEN, and the correction matters more than the finding it displaced.

It was filed as an APP defect: "the mockup draws a formatted body, the app prints raw `>` markers". THE APP IS 1:1 WITH THE MOCKUP HERE. Read against `docs/design/web-ui-mockup.html`'s own `renderMarkdown()`: it branches on raw HTML (refused), fenced code, `#{1,3}` headings and `-`/`*` lists, and EVERYTHING ELSE falls to a `<p>` carrying its own source. There is no blockquote branch. Given the same body the mockup prints the same `>` characters.

HOW THE MISTAKE WAS MADE, because it is a repeatable one: I compared the app rendering a REAL corpus body against the mockup rendering its own SAMPLE body, and attributed the difference to the renderer. The mockup's samples are two clean paragraphs and a bulleted list -- exactly the shapes its renderer knows. That is the same error as reading a fixture gap as a code gap, in the other direction.

`screens/docs.js` already documents the limit precisely and refuses to exceed it: "pipe tables, BLOCK QUOTES, ordered lists, horizontal rules ... all become paragraphs carrying their own source", and inventing a branch "the design of record has no CSS rule for (`.md` styles h1/h2/h3, p, ul and pre and nothing else) would be this file deciding something the owner has not."

SO THE WORK IS A MOCKUP CHANGE FIRST, under `DEC-claude-drafts-the-mockup-and-the-owner-approves`: add a blockquote branch to the mockup's renderer and a `.md blockquote` rule to its stylesheet, then carry both. STILL WORTH DOING -- this corpus is full of blockquotes and they are the ugliest thing on the screen -- but it is a change to the DESIGN, not a defect in the app, and the owner decides it.

MEASURE FIRST, as the task already said: count which markdown shapes actually occur across the corpus. That decides how many branches the mockup needs.
