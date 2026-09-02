---
id: TASK-a-test-asserts-every-category-has-an-updates-declaration
type: task
title: a test asserts every category has an updates declaration
status: active
severity: soft
always: false
summary: A check that every kind of item, including ones people define themselves, says what can be changed on it and names only parts that really exist.
summary_of: 93e349110095860f
scope: []
tags:
  - "plan:categories"
  - "seq:17"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 8957b54207c88a56
plan: categories
seq: "17"
state: done
---

# a test asserts every category has an updates declaration

The catalogue-completeness test (plan:categories seq 1) already asserts every category is complete in the six fields it had. This is its sibling for the seventh.

DO: assert that every category - SHIPPED OR CONFIG-DEFINED - carries an `updates` declaration, and that every name it mentions is either a real frontmatter field or a declared tag convention. A declaration naming a field that does not exist is worse than none: it teaches a reader something false and no other gate would catch it.

The config-defined half is the half that matters. A test over the shipped catalogue alone would pass forever while a person's own category declared nothing.
