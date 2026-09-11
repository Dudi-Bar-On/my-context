---
id: never-a-git-command-that-writes-the-shared-tree
kind: prohibition
tier: developer
title: a lane runs no git command that writes the shared working tree
prohibition: "a lane runs no git command that writes, moves or discards: `stash`, `checkout`, `reset`, `clean`, `restore`, `add`, `commit`, `merge`, `rebase`, and anything with `force` in it. `git status`, `git diff` and `git log` are read-only and are fine."
why: lanes are dispatched in parallel and share ONE checkout. A git command that moves files does not know which changes belong to whom, so it is a whole-tree operation issued by someone holding a fraction of the tree — and the lane that fires it cannot see what it destroyed.
example: a lane ran `git stash` on 2026-09-05 while three other lanes were writing, and recovered its own files only by checking them out of the stash before the pop landed. The day before, a `git add -A` during a lane’s writes landed unrelated work under the wrong commit messages, and that had to be recorded in an empty commit because the history could not be untangled afterwards.
check: none - nothing gates what a lane types into a shell, and the archive records the command only when the lane reported it. The measurable half is weaker than the rule, so a detective check here would overstate what is enforced.
---

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

*Moved from `RULE-a-delegated-worker-runs-no-git-command-that-touches-the` on 2026-09-11; that item is retired and points here.*
