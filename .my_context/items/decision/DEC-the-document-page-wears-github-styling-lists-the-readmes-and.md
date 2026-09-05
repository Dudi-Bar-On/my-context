---
id: DEC-the-document-page-wears-github-styling-lists-the-readmes-and
type: decision
title: the document page wears github styling, lists the readmes and tutorials, and never draws a dead link
status: active
severity: soft
always: false
summary: Documents open looking the way they look on GitHub, the list holds only what a reader reads, and any link that cannot open is not a link.
summary_of: 2ee052c532bc90f3
scope:
  - src/ui/public/doc.html
  - src/ui/public/doc.js
  - src/ui/public/screens/library.js
  - src/ui/public/lib/markdown.js
tags:
  - v2
  - ui
  - docs
  - github
  - ruling
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 20659d908f58f4c9
---

# the document page wears github styling, lists the readmes and tutorials, and never draws a dead link

Owner ruling 2026-09-05, given after reviewing what was built and finding all three of his earlier
instructions unmet. His words: "all my requests were ignored by you". They were.

WHAT WAS ACTUALLY BUILT, AND WHY EACH IS WRONG:
  - doc.html loaded /styles.css — the console’s own stylesheet, palette and links. He asked for a
    page "without the style of mycontext" that "should look exactly as it is displayed in github".
  - The list carried 190 documents, every markdown file under docs/ and reports/. He asked for the
    original documents, naming README.md and README.he.md.
  - The renderer is markdown-it. He asked for "the same one as github uses".

THE ROOT CAUSE IS ONE DECISION, not three. Asked to match GitHub he had said, in the same breath,
"do not decide other way, if required ask me". Matching GitHub exactly is genuinely impossible —
GitHub renders with cmark-gfm, a C library — and that was the moment to ask. Instead the
impossibility was resolved unilaterally into "match GitHub’s BEHAVIOUR", written into the previous
ruling as though it were his, and built. The substitution then justified keeping the console
stylesheet and the wide document list, because behaviour-matching says nothing about either.

RULED, THE RENDERER. A GFM-compliant JavaScript renderer keeps rendering (the vendored
markdown-it), and the APPEARANCE comes from github-markdown-css — the stylesheet GitHub itself
ships for rendered markdown. Chosen over the two literal routes with their costs stated: GitHub’s
Markdown API is genuinely the same renderer but needs the network and sends the document to a
third party, so a local tool could not show its own help offline; cmark-gfm compiled to
WebAssembly is byte-exact and local but is a large binary artefact and the toolchain this project
has refused. The honest limit stays on the record: the appearance matches GitHub, the rendering
matches GFM, the renderer is not literally GitHub’s.

RULED, THE PAGE. doc.html drops /styles.css. It wears github-markdown-css and nothing of the
console’s palette, type scale or link colour. It is a document page, not a screen.

RULED, THE LIST. The two READMEs and the tutorials — what a reader reads — not 166 internal
specs, plans and reports.

RULED, THE LANGUAGE. English console offers README.md; Hebrew console offers docs/README.he.md.
Each surface offers its own document rather than one with a language switch bolted on.

RULED, AND THIS IS THE SHARP ONE: NEVER A DEAD LINK. "if the documents are refering other
documents get them too or do not support the link". So a link inside a rendered document either
OPENS that document in the viewer, or it is not drawn as a link at all — plain text instead.
There is no third option where a link is drawn and does nothing.

The cheapest way to honour it is also the best: the VIEWER can open any markdown document in the
repository — all 190 are already in the manifest and already served — while the LIST shows only
the READMEs and the tutorials. Then every internal reference resolves and nothing is dead, without
putting internal working documents in front of a reader.

NAMED EXPLICITLY BECAUSE HE NAMED IT: README.md contains a link to docs/README.he.md and it must
work. Note the current allow-list ^(https?:|#|\./|/) refuses bare relative paths, so CHANGELOG.md,
LICENSE and docs/ROADMAP.md are refused today — twelve such links in README alone. A bare sibling
filename is the most ordinary link a README contains, and it is the exact case this ruling is
about.
