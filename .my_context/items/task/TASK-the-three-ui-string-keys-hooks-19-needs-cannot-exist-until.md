---
id: TASK-the-three-ui-string-keys-hooks-19-needs-cannot-exist-until
type: task
title: the three UI string keys hooks 19 needs cannot exist until the mockup declares them
status: active
severity: soft
always: false
summary: Three sentences cannot be added until the design declares them first, and one of them already exists under a different name.
summary_of: ec68c3574bdd82c8
scope: []
tags:
  - "plan:hooks"
  - "seq:19b"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: b47ba41372bf20e1
plan: hooks
seq: 19b
state: done
priority: "1"
---

# the three UI string keys hooks 19 needs cannot exist until the mockup declares them

Task 19 names three string keys for the carry disclosure. Two of them cannot be added and one already exists under another name.

test/ui/strings-parity.test.ts refuses any key the mockup does not declare. The mockup ALREADY declares this exact sentence as preview.carried - '{lines} index lines carried from session {mv:session}...' - so index.carriedFrom would be a second key for a sentence that already has one. index.carriedDropped and index.carriedDisplaced appear nowhere in the mockup.

So the UI half of this task is blocked on the design of record: the mockup must declare the keys before en.js and he.js can carry them. That is the mockup's own rule working correctly - this file changes first, the implementation follows - not an obstacle to route around.

There is also a FOURTH renderable piece the plan's three keys do not cover: the 'Fetch any of these with mycontext show <id>' hint.

The agent touched neither the mockup nor the string tables, which was right: the mockup was under owner review at the time.
