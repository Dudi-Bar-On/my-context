---
id: TASK-review-3-establish-what-a-skill-should-be-from-the-authority
type: task
title: "review 3: establish what a skill should be, from the authority rather than from our own repo"
status: active
severity: soft
always: false
summary: Establish from the official documentation what a skill is for and what earns being one, before judging the ones already written.
summary_of: d08b70e96559f878
scope: []
tags:
  - "plan:review"
  - "seq:3"
  - "state:todo"
  - v2
  - review
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 9304afe643104144
plan: review
seq: "3"
state: todo
priority: "2"
---

# review 3: establish what a skill should be, from the authority rather than from our own repo

The prior question to auditing our 39 skills: **what is a skill for, and what earns being one?**

Do not infer this from the plugin's own contents — that reasons from the thing under review. Claude Code's skill contract is documented and there is a `claude-code-guide` agent whose purpose is authoritative answers about Claude Code's own features. Ask it: how a skill is selected and invoked, what the description field actually does, what progressive disclosure means in practice, what belongs in `SKILL.md` versus a bundled reference, and what makes a skill fire when it should and stay quiet when it should not.

Output is a short contract we can audit against. **No edits to `skills/**` in this task.**

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, unblocked, and independent of everything else on the board -- it touches no UI file and no plan the walk covered. Its framing is the reason it must come before seq:4: what is a skill FOR, and what earns being one, established FROM THE AUTHORITY rather than from our own repo. Auditing 39 skills against a contract derived from those same 39 skills would measure consistency and call it correctness -- the same error as tuning a gate to a green run.
