---
id: RULE-a-commit-is-not-finished-until-it-is-on-the-remote
type: rule
title: a commit is not finished until it is on the remote
status: active
severity: soft
always: false
summary: Committing includes bringing the branch up to date and pushing it, so what is on the remote is never quietly behind what is done.
summary_of: e59e91ae3570e6b2
scope: []
tags:
  - v2
  - process
  - git
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: b41641cea2e2da13
---

# a commit is not finished until it is on the remote

Owner instruction 2026-09-06: "every time you commit, also merge if required and push to remote."

THIS IS A STANDING AUTHORISATION AND IT REPLACES AN EARLIER POSITION OF MINE. I had been holding
pushes until asked, on the reasoning that a push is outward-facing and leaves the machine. That was
right as a default and is now overruled deliberately: the owner watches this repository on GitHub,
and a commit that sits unpushed makes the remote say the work is hours old when it is minutes old.
He asked "why do i see at github that the last update was 9 hours ago" while 17 commits sat local.

THE RULE. Commit, then bring the branch up to date with the remote if it has moved, then push. Not
at the end of a batch and not when someone asks - as part of committing, every time.

"MERGE IF REQUIRED" IS THE HALF THAT NEEDS CARE. If the remote has moved, fetch and integrate BEFORE
pushing, and never force. RULE-check-the-author-of-every-commit-on-a-branch-before-merging applies
to whatever arrived: a commit on this branch that neither the owner nor this session wrote is a
thing to look at, not a thing to merge past. A conflict is a stop-and-report, never a resolution
improvised to make a push succeed.

AND VERIFY THE PUSH LANDED rather than trusting the command. Fetch and compare afterwards: the
count of unpushed commits should be zero and origin should name the commit just made. A push that
reports success into a stale view of the remote is the failure this sentence exists to catch.

THIS DOES NOT REACH A DELEGATED WORKER, and the distinction is the whole of
RULE-a-delegated-worker-runs-no-git-command-that-touches-the. A worker runs NO git command that
writes - not commit, not merge, not push, not checkout, not stash. That rule was broken twice on
2026-09-05 and once a worker silently reverted three corpus edits while reporting nothing was lost.
This authorisation is the assistant’s alone, in line with INSTR-all-work-goes-through-subagents-
and-only-the-assistant-runs.

ONE PRACTICAL CONSEQUENCE, learned the same day: stage EXPLICIT PATHS, never `git add -A`, while any
lane is running. Pushing more often means committing more often, and a bare `-A` swept a lane’s
half-finished work into an unrelated commit three times on 2026-09-06 - once by me, after a day of
telling workers not to touch git.
