---
id: def-a-lane
kind: definition
tier: developer
title: a lane is one delegated subagent, with its own context window and its own brief
term: lane
means: one delegated subagent, dispatched with a written brief, that owns one unit of work and reports back. It runs in its own process with its own context window, it is told which files it may touch, and it commits nothing — the dispatching session commits, staging by explicit path.
confusedWith: "a thread, and a task. A lane is not concurrency inside one process and not a long-lived worker: it is one dispatch with a beginning, a report and an end. A task is the corpus ITEM that says what is to be done; a lane is who does it, and one task may be worked by several lanes over several days."
example: measured in this workspace on 2026-09-11, the archive holds 304 lane transcripts against 2 session transcripts — so a rule written only for sessions is a rule written for under one percent of the work.
check: "none - a lane is a unit of work, not an act, so there is nothing for a check to observe. What IS checked is what a lane may do: RULE-a-delegated-worker-runs-no-git-command-that-touches-the and RULE-a-delegated-worker-never-runs-a-command-that-reaches-beyond each govern one of its boundaries."
---

The word carries an obligation as well as a shape. A lane is dispatched against a brief, and the
brief is written for one: it names the files the lane owns, so that two lanes are disjoint BY FILE
rather than by topic (`RULE-prove-parallel-agents-are-disjoint-by-file-not-by-topic`).

The blast radius of the word is why it is defined here. "Run it in a lane" is a decision about
isolation, cost and who commits — not a synonym for "in the background".
