---
id: RULE-a-delegated-worker-runs-no-git-command-that-touches-the
type: rule
title: a delegated worker runs no git command that touches the working tree, because the tree is shared
status: active
severity: hard
always: false
summary: Lanes share one working tree, so any git command that moves files can destroy work belonging to a lane that never ran it.
summary_of: e8e34671a5738579
scope: []
tags:
  - v2
  - lanes
  - git
  - safety
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: fca9565a730c306a
---

# a delegated worker runs no git command that touches the working tree, because the tree is shared

Owner ruling 2026-09-05, after it happened. A lane ran git stash while three other lanes were
writing to the same working tree. It stashed everything, including work that was not its own,
then popped it back. That lane recovered its own files by checking them out of the stash before
the pop landed, and verified the diffs matched. Nothing was lost. Nothing about the situation
made that outcome likely.

The reason this is a rule and not a preference. Lanes are dispatched in parallel and they share
ONE checkout. A git command that moves files does not know which changes belong to whom, so a
stash, a checkout, a reset or a clean is a whole-tree operation issued by someone holding a
fraction of the tree. The blast radius is every other lane’s uncommitted work, and the lane that
fires it cannot see what it destroyed.

It is also not hypothetical twice over. The day before, a git add -A during a lane’s writes
landed unrelated work under the wrong commit messages, and that had to be recorded in an empty
commit because the history could not be untangled afterwards.

What is forbidden: any git command that writes, moves or discards. stash, checkout, reset,
clean, restore, add, commit, merge, rebase, and anything with force in it. This holds even when
the lane believes it is only touching its own files, because the command does not.

What is allowed: nothing is needed. A lane knows which files it edited because it edited them. If
a lane wants to see the tree, git status and git diff are read-only and harmless, but wanting
them is usually a sign the lane has lost track of its own change set, which is worth saying out
loud rather than working around.

Who commits: the dispatching session, and nobody else, staging by explicit path and never with
-A or a bare dot. That is also what keeps every commit under the owner’s identity, which two
sibling rules already require.

For whoever writes the brief: say this in it. A lane that has not been told will reach for git
the moment it wants to know what changed, and the rule that stops it must arrive before the
moment does.
