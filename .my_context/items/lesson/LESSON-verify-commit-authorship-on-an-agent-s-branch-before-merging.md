---
id: LESSON-verify-commit-authorship-on-an-agent-s-branch-before-merging
type: lesson
title: Verify commit AUTHORSHIP on an agent's branch before merging it, not only its diff and its gates. Five dispatched agents produced six commits authored 'x <x@y>' and 'Claude <noreply@anthropic.com>', overriding the repository's configured identity, and every one was merged and pushed because the merge procedure checks gates and files and never runs git log --format=%an. GitHub attributes commits to accounts BY EMAIL, so the invented placeholder x@y credited four commits in a public repository to a dormant stranger's account that has no access and wrote nothing.
status: active
severity: soft
always: false
summary: Check who wrote a commit before you merge it. The changes can look right while the author is wrong.
summary_of: f8cd06c1e34f3610
scope: []
tags: []
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: fd55e38ce844e0f2
---

# Verify commit AUTHORSHIP on an agent's branch before merging it, not only its diff and its gates. Five dispatched agents produced six commits authored 'x <x@y>' and 'Claude <noreply@anthropic.com>', overriding the repository's configured identity, and every one was merged and pushed because the merge procedure checks gates and files and never runs git log --format=%an. GitHub attributes commits to accounts BY EMAIL, so the invented placeholder x@y credited four commits in a public repository to a dormant stranger's account that has no access and wrote nothing.
