---
id: TASK-a-rule-store-test-asserts-over-the-repository-s-own-live
type: task
title: a rule-store test asserts over the repository's own live corpus, so any concurrent writer turns it red
status: active
severity: soft
always: false
summary: One test takes a snapshot of this repository's real knowledge folder and expects it unchanged while it runs, so anyone editing an item at the same time makes the test fail for reasons that have nothing to do with the code under test.
summary_of: 6c69bdfbaaa7c777
scope: []
tags:
  - "plan:release"
  - "seq:35"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-23
valid_until: null
checksum: 2a3048607b623bb3
plan: release
seq: "35"
state: todo
---

# a rule-store test asserts over the repository's own live corpus, so any concurrent writer turns it red

Found by task 4.11 on 2026-09-23 and confirmed by its reviewer: test/mcp/rule-store-tools.test.ts lines 189-220 ('reading the rule store leaves the project corpus untouched') snapshots REPO/.my_context by file size and mtimeMs and deep-equals it after the read. It asserts over the live shared corpus the test does not own, so a concurrent corpus write (a lane filing an item, the owner editing) reddens it; it failed once in a whole-directory run and passed 11/11 alone while three lanes wrote in the tree. It can only fail red, never pass green by coincidence, but it fails for the wrong reason. Closing condition: the test proves 'reading leaves the corpus untouched' over a corpus it owns - a copy of the store in a mkdtemp box, or the frozen-corpus fixture the e2e suite uses - and never over REPO/.my_context; and test/no-test-writes-the-owners-audit-log.test.ts's sibling idea applies: a meta-guard that no unit test snapshots or asserts over REPO/.my_context (the read-only assertion class), listing the exemptions it allows and why. Files: test/mcp/rule-store-tools.test.ts, a new test/*.test.ts guard. Release phase 5 (test hygiene; the guard is the same shape as 4.15's).
