---
id: TASK-the-version-number-for-the-release-is-the-owner-s-call-the
type: task
title: "the version number for the release is the owner's call: the evidence supports 2.0.0"
status: active
severity: soft
always: false
summary: The case for calling the next release a major one, argued from what actually changed rather than from what was written down.
summary_of: 4d87eb274f8d3e96
scope: []
tags:
  - "plan:rulings"
  - "seq:41"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: d6cd18337545d9e1
plan: rulings
seq: "41"
state: done
priority: "1"
---

# the version number for the release is the owner's call: the evidence supports 2.0.0

The changelog agent read 399 commits, 282 of them non-merge, and wrote the section from the code rather than the log. It recommends 2.0.0 and wrote the heading as 'Unreleased - 2.0.0 when tagged', which is VERSIONING.md's own spelling for a version in preparation. package.json is untouched at 1.0.2, so nothing is claimed as released.

Its case, four items, argued in the file itself:

1. The cross-session carry is ON BY DEFAULT. continuity.ts falls through to the most recent other session when state/continuity.json is absent, and no config key gates it. Carried lines are hoisted to the front of budgets.index and can DISPLACE this session's own. That is what comes back given an unchanged corpus and an unchanged config, moving with no user action - and MINOR's carve-out is new behaviour an existing config does not switch on, which this is not. The strongest single case.

2. extra refused on a category that does not declare it: a capture that succeeded on 1.0.2 is refused until config.json gains extraFields. The one entry that can require a user to edit a file.

3. audit@2: upgrade is free, downgrade is one-way. After one 2.0 write a 1.0.2 build refuses the whole audit read.

4. An unknown top-level config key is now skipped and disclosed rather than refused - which REVERSES a change 1.0.0 recorded under Breaking. An unchanged config.json that refused yesterday loads today.

What it argues is NOT breaking, and the evidence is good: ## Steps. computeItemChecksum adds the steps key only when steps exist, so every stepless item hashes byte-identically. Making it unconditional would redden doctor on every corpus at once.

Nothing else was decided. Set the number when you tag.
