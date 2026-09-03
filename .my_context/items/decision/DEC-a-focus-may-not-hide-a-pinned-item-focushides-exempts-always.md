---
id: DEC-a-focus-may-not-hide-a-pinned-item-focushides-exempts-always
type: decision
title: "a focus may not hide a pinned item: focusHides exempts always: true"
status: active
severity: soft
always: false
summary: Narrowing what you see down to one topic must never hide the things you marked to stay in view at all times.
summary_of: 4ca25a5a8820d0c8
scope: []
tags:
  - v2
  - focus
  - injection
  - pinned
origin: human
source_file: null
source_anchor: null
source_checksum: 2b0b8c0134e4112a
valid_from: 2026-08-27
valid_until: null
checksum: cde632dcc62436ee
---

# a focus may not hide a pinned item: focusHides exempts always: true

> Ruled by the owner 2026-08-27.
>
> **`focusHides` must exempt `always: true` as it already exempts
> `severity: hard`.** A focus is a lens for narrowing attention, not a mechanism
> for suppressing what was pinned precisely so it would never fall out of
> context.
>
> The mechanism currently disagrees with a ruling the owner had already given —
> that pinned items are first priority to stay in context, to the point that a
> budget that cannot fit them should prompt the user to raise it. A focus that
> silently removes them contradicts that at the one moment it matters.
>
> Measured cost of the current behaviour: a focus set on 2026-08-24 with
> `tags: plan:walk` hid six soft-severity pinned items for three days, including
> `INSTR-use-my-context-for-everything…` and
> `INSTR-query-and-display-the-task-item…` — the instruction to use the product
> for every fitting category was itself hidden by the product. Nothing said so;
> the absence was found by counting what should have been injected against what
> was.
>
> Not chosen: disclosing what a focus hides instead of exempting. Disclosure is
> the right treatment for a deliberate drop, and this is not one — the items are
> marked as never droppable.

## Relations
- supersedes [[DEC-focus-discloses-and-allows-rather-than-refusing-to-hide]]
