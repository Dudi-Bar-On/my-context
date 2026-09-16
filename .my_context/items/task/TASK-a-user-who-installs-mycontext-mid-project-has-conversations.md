---
id: TASK-a-user-who-installs-mycontext-mid-project-has-conversations
type: task
title: a user who installs mycontext mid-project has conversations nobody can mark, because the pass has no corpus to recognise
status: active
severity: soft
always: false
summary: Someone who adds this tool halfway through a project gets none of their existing conversations bookmarked.
summary_of: 599525115dfbe314
scope:
  - src/core/anchor-pass.ts
  - src/cli/commands/conversation.ts
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - recall
  - "plan:anchors"
  - "seq:13"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: fc3c74fa653209a6
plan: anchors
seq: "13"
state: todo
priority: "1"
---

# a user who installs mycontext mid-project has conversations nobody can mark, because the pass has no corpus to recognise

OWNER REQUEST 2026-09-16: "i want to add a capability that will backfill a conversation with
anchores as we did, only by reading the conversation and trying to find points to be anchored as
much as possible when no corpus exists, it is intended for a user that installs mycontext at the
middle of development so it’s conversation was created before mycontext was installed."

THE CASE IS REAL AND IS THE COMMON ONE. Nobody starts a project by installing this. A new user
runs `mycontext init` in a repository that already has months of Claude Code sessions sitting in
`~/.claude/projects/`, and the archive indexes all of them — they appear under Conversations
immediately. What they do NOT get is marks.

WHY THE CURRENT PASS IS THIN THERE, and this is the whole problem: of the three grammars, TWO
DEPEND ON THIS PRODUCT ALREADY BEING IN USE.
  — A RULING is a turn the owner typed containing `always`/`never`/`must`/`the rule`/`i approve`.
    This one works with no corpus — it reads his words, not the corpus. It is the only one that
    transfers intact.
  — A LANE REPORT needs `subagents` rows, which exist for any Claude Code project that dispatched
    agents. Also transfers.
  — A TABLE is a GFM table. Transfers, and is 68% of the marks here — but here is a project whose
    owner writes tables constantly. IT MAY NOT TRANSFER AT ALL to someone who does not.

SO THE REAL QUESTION IS NOT "run the pass over old conversations" — `conversation rebuild` already
does exactly that, unscoped, and it works. THE QUESTION IS WHETHER WHAT IT FINDS IS WORTH HAVING
IN A PROJECT THAT IS NOT THIS ONE.

AND THE HONEST RISK IS THE OPPOSITE OF TOO FEW: `anchors/11` measured that a grammar marking 40%
of turns is DISQUALIFIED, and that 1,155 marks over 13 days was already enough to make the rare
kinds hard to find. A first-run backfill over six months of somebody else’s history could produce
thousands of marks in one act — and their first sight of the feature would be a list that is
useless. FEWER AND BETTER IS THE STANDARD, exactly as it was here.

WHAT TO MEASURE, and it cannot be measured on this repository alone — that is the trap. This
corpus is the one the grammars were tuned against. Find at least one OTHER real Claude Code
project directory under `~/.claude/projects/` (there are several; this machine has 13 sessions
for THIS project and others besides) and report, for each grammar: marks produced, marks per
thousand turns, and a sample a stranger could judge.

WHAT THE CAPABILITY MUST DO BEYOND RUNNING THE PASS:
  1. SAY WHAT IT IS ABOUT TO DO BEFORE IT DOES IT. A count, and per kind, so a reader can refuse.
     A first run over a long history is not a thing to start silently.
  2. BE UNDOABLE. Every row it writes is `origin: automatic`, and the pass already takes those
     back when they no longer qualify — so a backfill is reversible BY DESIGN. Prove it: run,
     count, revert, count.
  3. NEVER READ AN `origin: owner` ROW. Standing property; a backfill must not be the thing that
     breaks it.
  4. BE REACHABLE FROM THE SCREEN. D57 ruled that every anchor capability is, and the sweep button
     already exists — this is its first-run shape, not a new surface, unless measurement says so.

AND SAY PLAINLY WHETHER A NEW GRAMMAR IS NEEDED AT ALL. If the three transfer well enough, the
answer is a better first-run EXPERIENCE around the pass that exists — disclosure, consent, a
count — and no new grammar. That is a legitimate and likely outcome. `anchors/11` refused eleven
candidates on measurement; do not reopen them without new numbers from a foreign project.
