---
id: TASK-write-the-id-vs-body-load-rule-into-skill-md-per-instr-an
type: task
title: write the id-vs-body load rule into SKILL.md per INSTR-an-item-arrives
status: active
severity: soft
always: false
summary: Delivery task for the id-vs-body reload rule, written into SKILL.md so an agent knows an id after compaction is not its body.
summary_of: 7c3fbefd7d61c596
scope:
  - skills/mycontext/SKILL.md
  - README.md
  - docs/README.he.md
  - test/plugin-assets.test.ts
  - test/docs/**
tags:
  - injection
  - agent-behaviour
  - v2
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 84506c9e89a2c22c
state: done
verified_on: 2026-09-04
---

# write the id-vs-body load rule into SKILL.md per INSTR-an-item-arrives

Deliver INSTR-an-item-arrives-one-of-two-ways-and-only-one-of-them-comes onto the always-read surface: extend SKILL.md's existing 'Query before assuming' section with the case-one/case-two rule (pinned/normative re-delivered; every other item's body must be loaded again with mycontext show <id> or get_item after a compaction, since only the id returns). Scope: skills/mycontext/SKILL.md, README.md, docs/README.he.md, test/plugin-assets.test.ts if the size cap needs raising.
