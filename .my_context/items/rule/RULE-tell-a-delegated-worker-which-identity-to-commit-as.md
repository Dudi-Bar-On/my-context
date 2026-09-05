---
id: RULE-tell-a-delegated-worker-which-identity-to-commit-as
type: rule
title: Tell a delegated worker which identity to commit as
status: active
severity: soft
always: false
summary: Name the identity a delegated worker must commit under, in the same instruction that gives it the branch.
summary_of: 650c1b6f537333e0
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 0cc7adef6caee3af
directive: do
---

# Tell a delegated worker which identity to commit as

A worker given a branch, a file set and a definition of done will still choose an identity if nothing names one, and a placeholder is the cheapest thing to choose. The repository's configured identity is not self-enforcing: any commit can override it, and nothing refuses. Name the identity in the instruction that names the branch, because that is the moment the choice is made.

## Relations
- derived_from [[LESSON-verify-commit-authorship-on-an-agent-s-branch-before-merging]]
