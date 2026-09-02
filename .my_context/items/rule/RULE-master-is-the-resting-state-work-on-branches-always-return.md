---
id: RULE-master-is-the-resting-state-work-on-branches-always-return
type: rule
title: master is the resting state - work on branches, always return to master
status: superseded
severity: soft
always: false
summary: A rule that work happens on branches and the main working tree is always left back on the default branch when work pauses.
summary_of: cd12e5e4f43b79a3
scope: []
tags:
  - workflow
  - git
origin: human
source_file: null
source_anchor: null
source_checksum: 397bce468bf69cb1
valid_from: 2026-08-20
valid_until: 2026-08-20
checksum: 79944e9e7ffae9f3
---

# master is the resting state - work on branches, always return to master

**The working tree sits on `master` whenever work is not actively in progress.** Branches and worktrees are where work happens; master is where the tree is left.

**In practice.** Branch for a body of work, or spin up worktrees for concurrent agents. When that work lands, merge it and **return the main working tree to master**. Do not leave the tree parked on a feature branch at the end of a session, at a pause, or after a handover.

**Why the owner asked for it.** They open the repository expecting master. A tree left on a feature branch means the next session starts somewhere unexpected — and an agent that reasonably assumes master will read the wrong files, cite the wrong lines, and branch from the wrong base. The cost is silent, and it lands on whoever comes next.

**The obligation it carries.** If the tree rests on master, then work that has not been merged is INVISIBLE from the resting state. So this rule comes with a duty: land the work, or say plainly that it is unlanded and where it lives. A branch nobody merges and nobody mentions is the same as lost.

**What it does not mean.** It is not a licence to commit directly to master, and it does not override giving a body of work its own branch. It also does not mean merging unfinished work just to get the tree back — park the branch, return to master, and say what is parked.

## Relations
- superseded_by [[RULE-always-return-the-working-tree-to-master-when-work-is-not-in]]
