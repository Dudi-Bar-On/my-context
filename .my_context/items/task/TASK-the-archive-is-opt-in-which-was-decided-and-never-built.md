---
id: TASK-the-archive-is-opt-in-which-was-decided-and-never-built
type: task
title: the archive is opt-in, which was decided and never built
status: active
severity: soft
always: false
summary: A project chooses whether to keep a conversation archive at all; today every project has one whether it wanted it or not.
summary_of: 31cb23c5d980d1b0
scope:
  - src/ui/**
  - src/core/conversation-index.ts
  - e2e/**
tags:
  - v2
  - ui
  - archive
  - "plan:archive"
  - "seq:9"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: 9461b31932c0916e
plan: archive
seq: "9"
state: done
priority: "1"
---

# the archive is opt-in, which was decided and never built

The design spec settles this in a section that opens with the decision already taken: "the whole
thing is OPT-IN: a project either turns this on or works exactly as it does today ... One key,
defaulting to OFF ... A project that does not turn it on behaves exactly as it does today, AND
NOTHING SCANS A TRANSCRIPT."

THERE IS NO SUCH KEY. Config in src/core/config.ts carries profile, categories, budgets, watchedDocs,
ui, handover, dispatchGate and skippedKeys - and nothing else. The screen is in the rail for every
project, the routes always register, and mycontext conversation rebuild always scans. A conversation
key written into a config file today would land in skippedKeys as unknown.

THIS IS THE ONE SECTION OF THE DESIGN WITH NO LINE OF CODE BEHIND IT, and none of the six archive
items restates it - the requirement existed only in the spec. That is exactly
LESSON-a-requirement-given-in-conversation-and-never-captured-is-a one layer up: captured in a spec,
then not carried into the tasks that were actually dispatched.

IT MATTERS MORE THAN A SETTING. Scanning transcripts is the one thing this product does that reads
outside its own workspace, and the spec names the security consequence in the same breath (see
plan:archive seq:11). Off by default is the whole mitigation.

────────────────────────────────────────────────────────────────────────────
MEASURED 2026-09-09: THE OFF DEFAULT ALREADY HELD. WHAT WAS MISSING WAS THE WAY BACK.
────────────────────────────────────────────────────────────────────────────

THE SENTENCE ABOVE THAT IS NO LONGER TRUE: "THIS IS THE ONE SECTION OF THE DESIGN WITH NO LINE OF
CODE BEHIND IT." It has three, and they were checked rather than assumed on 2026-09-09:

  1. ConversationIndex.open is the only thing that creates these tables, and it is called from
     exactly ONE place in the whole product - inside rebuildConversations.
  2. rebuildConversations has exactly TWO callers. cli/commands/conversation.ts, which is a person
     typing, and hooks/stop.ts' stopConversationRefresh, which opens with openReadOnlyChecked purely
     as a GATE and returns null when no index exists. Its own comment: "a workspace nobody has ever
     scanned is still never opted in by a background hook."
  3. No read surface can build one at all, by construction, which test/ui/no-writes.test.ts holds by
     walking the import graph.

SO A PROJECT THAT NEVER RUNS THE COMMAND IS NEVER SCANNED. That is off-by-default, and in the
respect this item cares about most it is STRONGER than the key the spec asked for: a key is a FILE,
and a file arrives with a cloned repository. Nothing a repository ships can opt a reader's machine
into reading their transcripts - only their own keystroke can. The item is right that no config key
exists and right that it matters; what it got wrong is that nothing implemented the requirement.

WHAT WAS GENUINELY ABSENT: THE SWITCH HAD NO OFF POSITION. Once scanned, the Stop hook refreshed for
ever, and the only way to stop it was deleting .index.db - which is also the corpus' own item index,
so opting out of the archive meant discarding an unrelated cache. That is now `mycontext conversation
forget`: it DROPS the two tables (an emptied index is one the gate still opens, so a DELETE would be
an opt-out that silently undid itself on the next turn) and returns the workspace to the exact state
the hook declines to act on. It reports what left, and one rebuild brings all of it back from disk.
test/hooks/stop-conversation-refresh.test.ts - `forgetting the index puts the workspace back where
the refresh will not follow` - asserts the whole chain.

DELIBERATELY NOT A CONFIG KEY, AND .my_context/config.json WAS NOT TOUCHED. A key would be a fourth
thing to keep in step with the three enforcement points above, in the owner's own file, and it would
put the decision somewhere a repository can ship. Removing the state the existing gate already reads
makes the same three points work in both directions. If the owner still wants the key, the exact
line is `"conversation": { "enabled": false }` under a new top-level `conversation` block in
src/core/config.ts's schema - and today it would land in skippedKeys as unknown, exactly as this item
says.

WHAT forget COST ELSEWHERE, since it takes --yes: it joined the derived approval boundary, and it was
recorded in test/helpers/approval-boundary.ts' OUTSIDE_BOUNDARY rather than added to README section 7
- the same judgement already taken for `statusline install`. It creates no item, retires none, and
puts no text in front of a model; putting it in the table of things that change what governs would
have been a false claim in the one document whose value is that it is exact.
