---
id: LESSON-eight-copies-of-a-grammar-mean-eight-chances-to-disagree
type: lesson
title: eight copies of a grammar mean eight chances to disagree with it
status: active
severity: soft
always: false
summary: Identical copies of one rule look harmless until the rule changes, and then every copy is wrong at once and blames the wrong place.
summary_of: 5ab592e50e0a87d7
scope: []
tags:
  - v2
  - ui
  - strings
  - duplication
  - measurement
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: d46548ed2644a91a
---

# eight copies of a grammar mean eight chances to disagree with it

Found 2026-08-25, adding {m:b:} and {m:i:} to the run grammar.

The change to {m:lib/i18n.js} was correct and the screens rendered. Eighteen tests failed anyway, and not one of them was about the code under test: eight test files each carried their own {m:slotsOf}, every one the same {m:/\{(?:(mv|m):)?([^}]*)\}/} written before emphasis existed. All eight read {m:{b:} as a substitution named {m:b:...} and demanded the caller supply it.

A ninth copy sat in {m:simulate-screen.test.ts} in a different shape -- {m:en[key].replace(/\{m:([^}]*)\}/g, "$1")}, a flattener that knew ONE marker of five -- and compared rendered text against a template still carrying its bold.

THE FIX WAS TO DELETE THEM ALL. {m:slots()} is exported from i18n.js and reuses the ONE parser: a {m:value} that records instead of substituting and a {m:doc} that builds nothing. Emphasis recurses, so a slot nested inside a {m:b:} run is collected exactly as a top-level one is -- which no copy would have got right without being written a ninth time.

THE TELL, in hindsight: every copy was IDENTICAL. Duplication that has not yet diverged looks harmless and is simply a divergence that has not happened yet. The day the grammar moved, eight files were wrong at once and the failures pointed at the screens rather than at themselves.

This is the same shape as the {m:.delta}/{m:.blast} standoff and the three expired refusals: a fact written down in more than one place, where only one of them is the fact.
