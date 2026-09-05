---
id: RULE-check-the-author-of-every-commit-on-a-branch-before-merging
type: rule
title: Check the author of every commit on a branch before merging it
status: active
severity: hard
always: false
summary: Check who each commit on a branch claims to be from before merging it; the diff and the tests never show an identity that was overridden.
summary_of: 8180b9330fba3c4d
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 6a07ae17cc69d668
directive: do
---

# Check the author of every commit on a branch before merging it

A branch's diff, its tests and its gates say nothing about who the commits claim to be from. An agent working in a worktree can override the repository's configured identity, and the override is invisible to every check that reads file contents. Authorship is published on the first push and, on a public host, is attributed to a real account by matching the author email, so a placeholder address credits a stranger with work they never saw and never had access to. Run the author list as a gate, beside the test suite.

## Relations
- derived_from [[LESSON-verify-commit-authorship-on-an-agent-s-branch-before-merging]]
