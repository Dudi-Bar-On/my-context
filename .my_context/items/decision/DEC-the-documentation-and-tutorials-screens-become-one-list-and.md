---
id: DEC-the-documentation-and-tutorials-screens-become-one-list-and
type: decision
title: the documentation and tutorials screens become one list, and a document opens rendered in a new tab
status: active
severity: soft
always: false
summary: Both screens are replaced by a single list of titles, and reading a document happens on its own page rather than inside the console.
summary_of: e44598a669b634bd
scope:
  - src/ui/public/screens/library.js
  - src/ui/public/doc.js
  - src/ui/public/doc.html
  - src/ui/public/lib/sanitize.js
  - src/ui/public/lib/markdown.js
tags:
  - v2
  - ui
  - docs
  - tutorials
  - ruling
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 4ed716550007c359
---

# the documentation and tutorials screens become one list, and a document opens rendered in a new tab

Owner ruling 2026-09-05, after the Documentation screen was built wrong twice and the Tutorials
screen once. It cancels most of the remaining design work rather than redirecting it again.

THE SHAPE. One console page replaces both screens. It lists every document and tutorial BY TITLE,
never by file path, with the measured EN/HE state beside each. Opening one opens a RENDERED page
in a new browser tab. The console stops trying to be a documentation site.

THE RENDERING TARGET IS GITHUB, and it is a target rather than a preference: "use exactly the same
renderer and viewing as it is implemented in github, do not decide other way, if required ask me."
So the standalone page behaves as a GitHub markdown view does - GFM tables and task lists,
GitHub’s sanitized HTML allow-list, its heading anchors, its dark presentation, and the mermaid
diagrams drawn rather than printed.

WHAT CANNOT BE PROMISED, said here so nobody later claims a parity that does not exist. GitHub
renders with cmark-gfm, a C implementation; this renders with the vendored markdown-it. Behaviour
can be matched; byte-identical output cannot. Where the two would differ on something a reader
would notice, that is a question for the owner rather than a judgement call.

AND IT DISSOLVES THE REFUSAL PROBLEM RATHER THAN ANSWERING IT. GitHub admits a sanitized subset of
HTML, which includes the <div dir="rtl"> and <span dir="ltr"> wrappers docs/README.he.md is built
from, and renders HTML comments as nothing at all. Matching GitHub therefore removes ~119 of the
Hebrew page’s 457 refusal boxes and all 118 of the English page’s comment markers, without a
separate ruling about which constructs are legitimate. The refusal MECHANISM stays for everything
outside the allow-list - INV-nothing-is-dropped-silently is why it exists.

TWO PRESENTATION RULINGS, given in the same breath and both about the list page:
  - a document is named by its TITLE, not its path. "docs/tutorials/injection-tiers.md" tells a
    reader nothing they wanted to know.
  - the entries are not to be styled as ordinary links - "the link style is not looking good".
    Buttons, or another treatment; the card-role system landed the same day and has the vocabulary.

WHAT SURVIVES, and it is most of the day’s cost. The vendored markdown-it, the fence fix, the ten
generated SVG diagrams and the .md reading typography are all exactly what a full-page document
view needs - arguably better used there than in a console card, because a full page can hold the
72ch measure honestly. What this cancels is UI speculation, not infrastructure.

WHAT IS TRADED AWAY, stated rather than discovered later: a new tab leaves the console, so there is
no deep link from a screen into a heading and no cross-linking from a document to a corpus item.
The Documentation screen never did the cross-linking - that is Learn, and Learn is untouched.

WHY THIS IS THE RIGHT TRADE. Both screens were built to a premise nobody could state, twice, and
each time the work was real and closed nothing. "A list, and the document rendered in a tab" is a
definition that fits in a sentence, which is exactly what the two previous attempts lacked.
