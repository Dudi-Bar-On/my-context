---
id: TASK-superseding-an-item-asks-which-tests-rest-on-it-and-proves
type: task
title: superseding an item asks which tests rest on it, and proves the answer names real files
status: active
severity: soft
always: false
summary: When a rule is replaced, the person replacing it says which tests assumed the old one, so those tests are not left quietly asserting something reversed.
summary_of: 7a5b4b3ce93a732b
scope:
  - src/core/**
  - src/cli/**
  - src/mcp/**
  - test/**
tags:
  - v2
  - governance
  - corpus
  - "plan:contra"
  - "seq:2"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: f6b87139b4bd4cb4
plan: contra
seq: "2"
state: todo
priority: "1"
needs: contra/1
---

# superseding an item asks which tests rest on it, and proves the answer names real files

Design of record: docs/superpowers/specs/2026-09-07-contradiction-gate-design.md section 8. Owner ruling 2026-09-07, in his words: all the tests that
rely on the superseded item must be updated or deleted - every test, including TDD, regression,
unit and e2e.

WHY THIS CANNOT BE A SCANNER, and it was measured the same day. budget/16 reversed an admission
rule. It reddened 26 fixtures across 10 files and NOT ONE was a logic failure - every one asserted
an absence the reversed rule had made true. ZERO OF THE 26 NAMED THE RULE THEY RESTED ON. They
encoded it: a golden string, a bare pinned: 1500, an item titled "Only an index line", a helper
comment reading "one pinned item and one index-only item" with no id in it. One is worse than
silent - it CITES an item that is still in force while the assertion above it rested on the rule
being reversed, so a reader checking that citation concludes the test is covered. There is no token
to match on.

BUT THERE IS ONE MOMENT WHEN SOMEBODY KNOWS: supersedeItem (src/core/mutate.ts). It is already a
single guarded write path, already stops a human for a confirm, and already accepts a free-text
reason. So it asks one more question - which tests assert what this reverses - at the one moment the
answer is known.

THE ANSWER IS VALIDATED, NOT MERELY STORED. checkDeadScopes already proves a scope glob matches real
files; the same walk proves each named test file exists. A named test since renamed or deleted
becomes a doctor finding, and THAT is the finding that matters six months later. The cheapest
version needs no new field at all: the successor existing scope can carry the test paths and
checkDeadScopes validates them today.

AND THE SENTENCE THAT MUST BE WRITTEN INTO THE CODE OR THIS GROWS A GATE WITHIN A MONTH:
COMPLETENESS CAN NEVER BE CHECKED. "No tests named" is indistinguishable from "no tests affected".
So this field can never be an error and can never gate - the same shape as the owner ruling that
check-cited-items reports rather than gates, one layer up.

TWO DECISIONS LEFT TO THE OWNER, not to be taken by a lane: whether the answer is a new frontmatter
field or an observation by convention (a frontmatter change alters every recorded checksum shape -
the continuity/summary conditional-key problem), and whether an agent may write it at all, given
that relations.ts already refuses an agent the ability to supersede a governing normative item in
either direction.
