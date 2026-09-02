---
id: TASK-carry-the-mockup-s-screen-level-css-into-styles-css-or-the
type: task
title: carry the mockup's screen-level CSS into styles.css, or the screens render unstyled
status: active
severity: soft
always: false
summary: Most of the design's styling was never copied into the app, so screens render as raw unstyled elements even though nothing is actually broken.
summary_of: 240080b6d0206568
scope: []
tags:
  - "plan:ui1"
  - "seq:16b"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 65ea4644e259db73
plan: ui1
seq: 16b
state: done
priority: "1"
---

# carry the mockup's screen-level CSS into styles.css, or the screens render unstyled

The seam between ui1 task 16 and task 17, and it is why the first render looks wrong.

Task 16 shipped styles.css with the :root token blocks and the ten primitive selectors, copied byte-for-byte from the mockup, with styles-parity.test.ts holding them identical - 21 tests that fail the day either file drifts. That was its stated scope.

Task 17's screens then wrote against the mockup's SCREEN-level class names, which is correct - the mockup is the design of record and its markup is what a screen copies. Those classes are not in styles.css: .card .phd .psub .verdict .rows .lit.linked .blk .idfull .idkind .idslug .linkid .icon-open .segbar .simctl .helpbox .small .m .v .spill .path, and the .nav and .grp rules the rail needs, and the .app grid that puts the rail beside the body.

So on screen right now the rail is raw blue anchors running together and the two-plane scene tilts off the page. Nothing is broken; the CSS simply has not been carried across.

Extend styles.css and extend the parity test with it, so the new blocks are held byte-identical to the mockup the same way the primitives are. Do not hand-write a screen rule that the mockup already spells - that is the drift the parity test exists to prevent.

Task 16's own report names this as deferred and says which rules it deliberately did not ship and why (.bar, .gap, .edge exist in the mockup in shapes that do not match the plan's sketch).
