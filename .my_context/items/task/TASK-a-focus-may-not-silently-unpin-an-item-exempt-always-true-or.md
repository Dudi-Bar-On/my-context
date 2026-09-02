---
id: TASK-a-focus-may-not-silently-unpin-an-item-exempt-always-true-or
type: task
title: "a focus may not silently unpin an item - exempt always:true, or say what it hid"
status: active
severity: soft
always: false
summary: Narrowing a session can quietly drop items marked always-show; it must at least name them, and someone must decide whether it may drop them at all.
summary_of: a46a96a3b3836084
scope: []
tags:
  - v2
  - injection
  - focus
  - "plan:budget"
  - "seq:1b"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 4616f0381812ba90
plan: budget
seq: 1b
state: done
priority: "1"
source: measured 2026-08-27
---

# a focus may not silently unpin an item - exempt always:true, or say what it hid

See KNOWN-a-focus-silently-overrides-always-true-so-a-pinned-item.

TWO PARTS, and the second is not conditional on the first.

**PART 1 NEEDS THE OWNER.** Should `focusHides` exempt `always: true` the way it already exempts `severity: hard`? It changes what every session receives, so it is his. The argument FOR: `always` is the strongest claim an item can make about its own delivery, and a focus is a working convenience — a convenience should not be able to revoke a promise. The argument AGAINST: a focus exists to make a narrow session narrow, and 23 pinned items is a lot to force into one.

**PART 2 IS NOT OPTIONAL EITHER WAY.** A pinned item hidden by a focus is DISCLOSED and RECORDED distinctly. Today the note says `focus hid 467` — one count folding six broken promises in with 461 ordinary narrowings. Follow the shape `plan:budget seq:1` just landed: name the ids, on stderr, and record them on the injection row under their own field. A budget dropping a pinned item and a focus dropping one are the same class of fact and should read the same way.

WHERE: `src/core/select.ts` around `focusHides`, and the same three surfaces seq:1 uses — the selection, the audit row, the SessionStart stderr line.

DO NOT change `focusHides`' behaviour as part of part 2. Make the fact visible first; the ruling can then be taken against something a reader can see.

## Relations
- supersedes [[TASK-a-focus-stops-hiding-pinned-items]]
