---
id: RULE-always-return-the-working-tree-to-master-when-work-is-not-in
type: rule
title: always return the working tree to master when work is not in progress
status: active
severity: soft
always: true
summary: Leave the project on its main line whenever you stop working, and say where any unfinished work is parked, so the next person starts where they expect.
summary_of: 88a843daa40baaf7
scope: []
tags:
  - workflow
  - git
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: db76c0a3ced89c33
---

# always return the working tree to master when work is not in progress

**The working tree sits on `master` whenever work is not actively in progress.** Branches and worktrees are where work happens; master is where the tree is left.

**In practice.** Branch for a body of work, or spin up worktrees for concurrent agents. When that work lands, merge it and **return the main working tree to master**. Do not leave the tree parked on a feature branch at the end of a session, at a pause, or after a handover.

**Why the owner asked for it.** They open the repository expecting master. A tree left on a feature branch means the next session starts somewhere unexpected — and an agent that reasonably assumes master will read the wrong files, cite the wrong lines, and branch from the wrong base. The cost is silent, and it lands on whoever comes next.

**The obligation it carries.** If the tree rests on master, then work that has not been merged is INVISIBLE from the resting state. So this rule comes with a duty: land the work, or say plainly that it is unlanded and where it lives. A branch nobody merges and nobody mentions is the same as lost.

**What it does not mean.** It is not a licence to commit directly to master, and it does not override giving a body of work its own branch. It also does not mean merging unfinished work just to get the tree back — park the branch, return to master, and say what is parked.

## Observations
- [supersession] Replaces RULE-master-is-the-resting-state-work-on-branches-always-return: the first capture used --file and left source_file pointing at a deleted temp path; this one carries the text inline

## Relations
- supersedes [[RULE-master-is-the-resting-state-work-on-branches-always-return]]
