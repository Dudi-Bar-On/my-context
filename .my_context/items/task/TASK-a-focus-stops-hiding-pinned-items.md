---
id: TASK-a-focus-stops-hiding-pinned-items
type: task
title: a focus stops hiding pinned items
status: superseded
severity: soft
always: false
summary: A piece of work to make narrowing the delivered knowledge stop hiding items that were pinned to appear every time.
summary_of: f9ac5c51d4c33330
scope: []
tags:
  - v2
  - focus
  - injection
  - pinned
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: a103723ac97da9f6
valid_from: 2026-08-27
valid_until: 2026-08-28
checksum: b5710c3559ef6337
state: done
priority: "1"
source: owner, 2026-08-27 ruling
---

# a focus stops hiding pinned items

> `focusHides` exempts `severity: hard` and must also exempt `always: true`,
> per the owner's ruling of 2026-08-27
> (`DEC-a-focus-may-not-hide-a-pinned-item-focushides-exempts-always`).
>
> Done when: a focus whose tags do not match a pinned item still injects that
> item; a test drives the exact case measured on 2026-08-27 — a
> `tags: plan:walk` focus against a soft-severity `always: true` item — and
> fails before the change; and the existing `severity: hard` exemption is
> still covered, so the two are not accidentally collapsed into one condition
> that a later edit can drop wholesale.
>
> The regression test asserts the property, not the count: "no item marked
> `always` is absent from the injection under any focus" holds whatever the
> corpus contains, where "six items were hidden" is true only of the corpus on
> one day.

## Relations
- superseded_by [[TASK-a-focus-may-not-silently-unpin-an-item-exempt-always-true-or]]
