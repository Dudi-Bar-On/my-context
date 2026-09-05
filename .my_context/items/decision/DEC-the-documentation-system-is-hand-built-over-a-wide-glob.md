---
id: DEC-the-documentation-system-is-hand-built-over-a-wide-glob
type: decision
title: the documentation system is hand-built over a wide glob, Learn keeps its cross-links, and the tutorial files stay as pointers
status: active
severity: soft
always: false
summary: Four rulings taken together so the documentation and tutorial work can start without further questions.
summary_of: 6111a8fdf7ce014f
scope:
  - docs/**
  - src/ui/public/screens/docs.js
  - src/ui/public/screens/learn.js
  - src/ui/public/screens/tut.js
tags:
  - v2
  - docs
  - tutorials
  - learn
  - scope
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 1c9a6694185963ec
---

# the documentation system is hand-built over a wide glob, Learn keeps its cross-links, and the tutorial files stay as pointers

Owner rulings 2026-09-05, taken in one sitting after three screens were defined from the record.

LEARN KEEPS ITS CROSS-LINKS. The spec makes cross-linking the whole justification for the screen - built without it, this is a documentation viewer and should be cut. It already satisfies that for two of four rows. So finish walk/88's categories row, make its ids clickable like the other seven screens, and the condition is met.

His own requirements addendum R4 argued the screen should not be a rail destination at all, replaced by help anchored on confusing terms wherever the user acts. That ruling never reached the spec correction or the shipped mockup. It is not overturned here so much as deferred: the screen stays, and R4 remains a real idea for after v2.0 rather than a live contradiction sitting unresolved in two documents.

The stale comment goes with it. learn.js's header says the item-detail pane has not been built; the pane shipped two and a half hours after that comment was written, on the same day. Learn's two ids are the last inert ones in the product.

DOCUMENTATION HOSTS THE VIEWER, OVER A WIDE GLOB. Two owner decisions eight days apart named different homes - Coverage on 2026-08-26, Documentation's Contents card on 2026-08-28 - and neither claimed to supersede the other. The later one wins, and it agrees with the requirement given today that Documentation becomes where a reader finds every detail about the app.

The boundary is the wider glob over docs and reports rather than watchedDocs alone. A documentation system that cannot show a report is not one, and most of what this project actually knows is written in reports.

BUILT BY HAND, NOT BY A GENERATOR. The owner had said a third-party tool could be used if required; it is not required. One would cost a fourth devDependency and very likely a build step, changing zero-runtime-dependencies and no-build-step at once, for a renderer that already exists and is already trusted for its CSP-safety property and already shared with the item-body view. The alternative extends machinery that is already load-bearing for both READMEs - the command table, the flag reference and the category keys are derived from the running program today.

The constraint is honoured rather than waived: a fourth dependency remains a ruling to record, and this ruling is that we do not take one.

THE NON-GOAL DOES NOT CONSTRAIN THIS. Not a documentation site generator means this product does not generate documentation sites for other people. It does not mean this product may not document itself well. The two are different claims and only the first is a non-goal.

AND THE TUTORIAL FILES STAY AS POINTERS. docs/TUTORIAL.md and TUTORIAL-ADVANCED.md keep one-line pointers after migration rather than being deleted. They have inbound links, and TUTORIAL.md carries a promise that everything in it was actually run against a fresh workspace - a promise that moves with the content and should not be quietly dropped along with the file.
