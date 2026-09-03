---
id: REQ-the-focus-dialog-offers-the-tags-it-could-focus-on-with-the
type: requirement
title: The focus dialog offers the tags it could focus on, with the count each one would include
status: active
severity: soft
always: false
summary: The focus dialog should list the tags a person can focus on and how many items each would bring, instead of asking them to remember the names.
summary_of: de3d5839fceb8426
scope: []
tags:
  - ui
  - focus
  - v2
  - owner-requirement
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-03
valid_until: null
checksum: 927a5693b952c3a2
---

# The focus dialog offers the tags it could focus on, with the count each one would include

Owner request, 2026-09-02, in his own words: "nice now because you did it very nice and showed me what are my options and how many items it will include, i would like to have such a generated check box list with the item counts in the dialog so user could select there and not have to remember them, only question is are these tags final or there may be more ?"

WHAT IS REQUIRED

The focus dialog stops asking the reader to remember tag names. It offers the tags that exist, as a generated list, each carrying how many items choosing it would include. Selecting is done by picking, not by typing.

WHY IT IS NOT A SMALL FIELD ADDITION, MEASURED

Nothing serves tags. `ItemSummary` carries id, type, title, status, always, scope, injected, phrase, gate, summary, summaryState, relations and relationKinds - and no tags. No route among the forty-five serves a tag vocabulary. The picker mechanism has no slot for one either: `sourceLists` returns items, categories, drafts, revisions and topics, and `pickerOptions` answers an empty array for anything else, so a tag source would silently resolve to nothing - which is exactly the shape `LESSON-on-real-data-an-absent-feature-and-a-missing-feature-look` describes.

The COUNT is a second thing again. How many items a tag would include is what `mycontext focus --preview` answers, and the dialog composes no `--preview` today.

THE OWNER QUESTION AT THE END, STILL UNANSWERED BY A PERSON

"are these tags final or there may be more?" The design record answers the mechanism but not the presentation. `command-flags.ts` already declares `focus --tag` with `source: tags`, and the header beside it argues that such a set is per-workspace and must be asked for rather than listed, "because a static list of this project categories would be exactly the hand-copied vocabulary this table exists to remove". So the set is OPEN and derived.

But there are TWO CLASSES OF TAG and the record does not say how to show them together. Projected tags - `plan:`, `seq:`, `state:` - are generated from fields and refuse hand-writing. Free-form tags are unbounded. A checkbox list mixing several hundred `seq:` values with `v2` and `ui` is unusable, and that presentation question is the owner`s.

SEMANTICS THAT MUST SURVIVE THE BUILD

Tags are OR within their axis and AND across axes: an item matches if it carries ANY of the chosen tags, and must also satisfy the other axes. A picker that reads as AND would quietly narrow to nothing.
