---
id: TASK-fields-store-tags-index-and-the-projection-is-generated
type: task
title: fields store, tags index - and the projection is generated, never typed
status: active
severity: soft
always: false
summary: Values that change should be stored properly and their labels generated from them, so a typo cannot quietly drop something out of every list.
summary_of: bf8c973d940be7b7
scope: []
tags:
  - "plan:categories"
  - "seq:18"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: f7bd06bd95dbd393
plan: categories
seq: "18"
state: done
---

# fields store, tags index - and the projection is generated, never typed

THE LIVE HOLE this requirement named, now measured rather than suspected.

MEASURED 2026-08-23 across 276 task items: all 276 carry a `state:` TAG. 213 ALSO carry a `state` frontmatter FIELD. Nothing syncs them and nothing checks them. Grepped the source: no code reads or validates the plan/seq/state tag prefixes at all. The corpus is clean by discipline, not by enforcement, and a `state:donee` typo would remove a task from every progress view with no gate noticing.

OWNER RULING 2026-08-23, and it is the design: update is not a legal operation on a tag. A tag is a MEMBERSHIP and a set supports add and remove; what looks like an update is a remove plus an add, which is why the one name that got updated hundreds of times is the one that drifted. So: a value that changes is a FIELD. Where a field must stay filterable, the tool PROJECTS a tag from it - generated, never hand-written, so the two cannot disagree and remove-then-add is atomic because a machine does both.

DO: `edit --state done` writes the field and rewrites the projected tag from it; a legal value comes from the declaration built in seq 13, so `state:donee` is refused; hand-writing a projected tag through `--tags` is refused with a sentence naming the command that does work; `doctor` reports any item where a field and its projection disagree.

GROUPING AND FILTERING MUST KEEP WORKING UNCHANGED. `focus`, `search --tag` and every progress view read tags today and must still resolve `plan:port` and `state:todo` afterwards. That is the whole point of projecting rather than deleting.
