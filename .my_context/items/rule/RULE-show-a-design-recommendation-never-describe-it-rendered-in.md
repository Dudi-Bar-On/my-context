---
id: RULE-show-a-design-recommendation-never-describe-it-rendered-in
type: rule
title: show a design recommendation, never describe it — rendered, in both themes, before beside after
status: active
severity: hard
always: false
summary: Show a design suggestion as a real page someone can look at, old beside new and in both light and dark, rather than describing it in words.
summary_of: ee1b4b56d7bc1ee9
scope: []
tags:
  - ui
  - review
  - reporting
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 93580fd36737bfd1
---

# show a design recommendation, never describe it — rendered, in both themes, before beside after

Any recommendation about colour, type, spacing, depth or layout is delivered **rendered**. The owner's words, 2026-08-21: *do not give me a colour code, show it to me on a form to look at it* — and it applies to every recommendation, not only colour.

What that means in practice. A **self-contained HTML page** beside the markdown report, openable on its own: no external CSS, no CDN, no network, screenshots embedded as data URIs.

- **A contrast finding renders the pair** — the real foreground text on the real background swatch, at the size and weight it actually appears at, with the measured ratio beside it. The reader should see the failure, not read that one exists.
- **A palette option is applied to the interface**, not shown as swatches alone. A panel, a heading, a row of table text, a warning chip. Swatches answer a different question than the one being asked.
- **A type scale renders a specimen** — every level at its real size in the real face, using real sentences from the product, with the current scale beside the proposed one at the same width.
- **A depth treatment renders the actual card**, flat beside each proposed elevation.
- **Before and after sit side by side**, at the same size, so the comparison is the page's job rather than the reader's.

**Both themes, always.** The mockup uses light-dark(), so a light-only page hides half of every recommendation. Hebrew RTL wherever the recommendation touches text.

**Why.** A hex code is not a decision anyone can make. *Could the palette go blue* is only answerable by looking at blue applied to this interface. A ranked list the reader has to imagine is a report that hands the work back to the person who commissioned it.

The markdown stays as the reasoning and provenance record. The rendered page is what gets ruled from, and the ranking is visible on it with the recommendation marked.
