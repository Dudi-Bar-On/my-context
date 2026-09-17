---
id: TASK-the-find-panel-s-counts-move-as-you-type-and-the-regex-mode
type: task
title: the find panel's counts move as you type and the regex mode has examples but no reference
status: active
severity: soft
always: false
summary: Pin the match counts in one place under the search box, make them stand out, and give regular expressions a proper syntax reference.
summary_of: 8883a8c094b821ba
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/public/lib/fold.js
  - src/ui/public/lib/panel.js
  - src/ui/public/styles.css
  - src/ui/public/strings/**
  - test/**
  - e2e/**
tags:
  - v2
  - recall
  - search
  - "plan:semantic"
  - "seq:14"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: 9df030d40fb40143
plan: semantic
seq: "14"
state: done
priority: "1"
---

# the find panel's counts move as you type and the regex mode has examples but no reference

THE OWNER, 2026-09-17, after using the panel: "looked at the search dialog and you did it very weell, small improvements: pleaes put the counts it a statis place up under the edit search expression and it would be nice to see them in blue so they would be more observable, about regex - add more examples and also add a full syntax help because it is complicated and hard to remember. taht's all and it will be perfect".

THREE THINGS.

1. THE COUNTS GET A FIXED PLACE, directly under the query field. Today they sit below the mode radios and the option checkboxes, so they move as the panel's contents change and the eye has to hunt for them. He wants to glance at one spot.

2. THEY SHOULD BE BLUE, AND THERE IS ALREADY A BLUE. Do not mint a sixth hue. `--carry: #8b9ce6` is the blue in the five-hue budget (`--gold`, `--ok`, `--carry`, `--crit`, `--warn`, styles.css:147), governed by `DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn`.

BUT A MEANING HUE CARRIES A MEANING. Read what `carry` means in this product before spending it on a count. If a count is not that meaning, SAY SO rather than quietly widening the hue - and say what you would do instead. The owner owns the budget and can rule; what he must not get is a sixth meaning silently minted, or an existing meaning quietly diluted, in answer to the word "blue". Note also that the contrast gates are real: `--crit` was refused on a surface at a measured 4.06:1, so whatever is chosen has to pass on the dark ground.

3. REGEX NEEDS A REFERENCE, NOT ONLY EXAMPLES. His words: "it is complicated and hard to remember". Fifteen worked examples shipped and he still wants a syntax help - so the gap is a LOOKUP TABLE: the character classes, the quantifiers, the anchors, the groups, the escapes, what each one does, in one place he can scan. Examples teach the first use; a reference serves the fiftieth.

More examples too, and the standing rule for them holds: every example RUNS against his own archive and clicking it puts it in the box. An example that finds nothing teaches nothing - one was already replaced for that reason.

AND SAY WHAT THIS ENGINE WILL NOT DO. A reference that lists a construct the scan refuses is worse than none: `(X+)+` is refused statically because a real pattern took 108,785 ms inside one span and a runtime canary was measured unsound. That belongs in the reference, not only in the help above it.
