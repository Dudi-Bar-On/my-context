---
id: TASK-the-library-browses-the-corpus-files-and-a-file-opens
type: task
title: the library browses the corpus files, and a file opens rendered in its own tab
status: active
severity: soft
always: false
summary: A reader walks the corpus as a nested folder tree, drilling into a folder and back out, and opens a file rendered in its own tab.
summary_of: 4f4717779c6cf198
summary_was:
  - 2026-09-06 A reader walks the corpus as a folder tree, reusing the tree control the coverage screen already has, and opens a file rendered in its own tab.
  - 2026-09-06 A reader can walk the corpus as folders and files and open any one of them formatted the way the documents already are.
scope:
  - src/ui/public/screens/library.js
  - src/ui/public/doc.js
  - src/ui/read-model.ts
  - src/doctor/checks.ts
tags:
  - v2
  - ui
  - library
  - docs
  - "plan:library"
  - "seq:2"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 3851bed331ab423f
plan: library
seq: "2"
state: done
priority: "3"
verified_on: 2026-09-06
---

# the library browses the corpus files, and a file opens rendered in its own tab

Owner requirement 2026-09-06 (plan D13, second half), with a follow-up the same day: the file
selection is to use "a special ui control that handles files explorer".

THAT CONTROL ALREADY EXISTS IN THIS PRODUCT AND MUST BE REUSED, NOT REBUILT OR IMPORTED. The Scope
coverage screen draws a repository tree, and the parts are already split the right way:

  lib/viewmodel.js  buildTree(files)   takes a FLAT FILE LIST and builds the directory tree.
                                       Generic - it is given files and knows nothing about scope.
                    treeRows(tree)     flattens to rows carrying depth, for rendering.
  screens/coverage.js                  the markup: role="treeitem" buttons, aria-expanded, and
                                       the toggle as a SIBLING button rather than nested inside
                                       the treeitem - a button inside a button is invalid and was
                                       fixed here once already.
  styles.css  .tree                    the whole vocabulary: .tree button, [aria-selected],
                                       [data-depth] indentation, all logical properties so it
                                       mirrors under dir=rtl for free.

So the work is a second CONSUMER of an existing control, not a third tree. The only coupling to
undo is that buildTree carries `governs` and `governedCount` on each node for coverage’s own
purpose; a browser ignores them or passes none.

AND IT ALREADY SOLVES THE SCALE PROBLEM. Coverage’s tree was shipped drawing every row expanded
and was rebuilt to collapse by default - 1,245 nodes with 29 visible, a 982 px page instead of
~52,700 px. The corpus holds roughly a thousand item files across fifteen category folders, the
same order of magnitude, so the answer is already proven at this size rather than hoped for.

THE RENDERING HALF IS ALSO DONE. /doc.html renders a document with the vendored
github-markdown-css, resolves an internal link or refuses to draw it, and opens in its own tab.
That is exactly what was asked for, already shipped.

WHAT IS NOT DONE IS A RULING RATHER THAN A BUILD. `isServableDocPath` (src/doctor/checks.ts ~835)
admits exactly three things: README.md, and anything under docs/ or reports/ ending .md.
`.my_context/items/**` is NOT servable, so the files to be browsed cannot be opened by the viewer
at all until that set is widened - and widening what a server hands out is not a screen decision.

AND A HARD REQUIREMENT POINTS THE OTHER WAY AND MUST BE READ FIRST.
REQ-a-repository-document-is-viewable-in-the-ui-only-once-it-is is severity HARD and says: "The UI
serves the corpus; it does not serve the checkout." Today the product does the exact opposite - it
serves docs/ and reports/, which are the checkout, and refuses .my_context/items/**, which is the
corpus. That contradiction was found once and left standing. This is the second time, and it
should be resolved on the record rather than stepped over again.

WHAT ALREADY VIEWS AN ITEM, so this is not built as a duplicate. Clicking any id opens `aside#pane`
with the item’s summary, scope, tier, body and provenance - rendered FROM THE INDEX. A file browser
shows the MARKDOWN ON DISK, frontmatter and all. Different artefact, different question: what is
actually written in the file. Both are legitimate, and the item should say which it answers so the
two do not converge into a worse version of either.

RENDERED AS A REAL TREE, NOT A FLATTENED LIST - owner, 2026-09-06.

The distinction is structural rather than visual. `buildTree(files)` already returns a genuinely
NESTED structure and is the half to keep. `treeRows(tree)` is the half to leave behind: it walks
that structure and returns a LINEAR array of rows each carrying a `depth`, which coverage.js draws
as sibling buttons indented by `[data-depth]`. It looks like a tree and is a flat list.

AND IT AVOIDS A DEFECT THIS PRODUCT HAS ALREADY PAID FOR. Because coverage’s rows are siblings,
collapsing a folder means hiding every descendant row by hand, and the rule doing it had to be
written `.tree .row[hidden]{display:none}` to beat `display:flex` at equal specificity. The
collapse markers looked broken, were reported by the owner, were explained away as stale cached
code, and were a real CSS specificity defect the whole time. In nested markup a collapsed folder
hides its subtree BY CONTAINMENT, and that bug cannot be written.

AND IT DRILLS DOWN AND BACK UP - owner, same day. A reader enters a folder and returns from it,
rather than only expanding it where it sits.

These two are not in tension and should not be built as if they were. Nesting is how the STRUCTURE
is expressed; drill-down is how a reader MOVES through it. What must be decided and written down is
what a click on a FOLDER does, because it cannot silently do both: expand in place, or descend into
it, with the other on a separate affordance.

The "go up" half has a precedent to follow rather than invent: /doc.html draws a breadcrumb of the
document path and a "Back to the console" row, in the vendored GitHub styling. A folder path is the
same shape of thing and should read the same way.

TWO MARKUP SHAPES ARE AVAILABLE AND BOTH ARE HONEST; pick with reasons rather than by habit.
Nested role="tree"/"group"/"treeitem" is the ARIA pattern and gives full keyboard semantics, but
every key must be implemented by hand. Nested <details>/<summary> is keyboard-reachable and
toggleable BY CONSTRUCTION with no script - which is why lib/disclosure.js uses a real <details>
pair rather than a div, and that reasoning is already on the record here.

Reusable either way: `buildTree`, and the `.tree` CSS vocabulary, whose indentation is in logical
properties so it mirrors under dir=rtl without a second rule.
