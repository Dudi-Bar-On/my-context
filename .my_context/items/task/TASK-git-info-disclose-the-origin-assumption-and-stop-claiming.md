---
id: TASK-git-info-disclose-the-origin-assumption-and-stop-claiming
type: task
title: "git-info: disclose the origin assumption, and stop claiming detached on no evidence"
status: active
severity: soft
always: false
summary: Write down which remote the branch comparison assumes, and stop reporting a repository state that nothing has actually observed.
summary_of: 1c26482bebdb904a
scope: []
tags:
  - "plan:rulings"
  - "seq:24"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: ed42aa5cfe264685
plan: rulings
seq: "24"
state: done
progress: "100"
priority: "1"
source: "reports/V2-HANDOVER.md#twelve-owner-rulings"
last_change: "2026-08-20T17:09:50Z"
---

# git-info: disclose the origin assumption, and stop claiming detached on no evidence

Rulings B2 and B3, both in src/ui/git-info.ts.

B2 - upstream means origin/<branch> and nothing else. A branch tracking a fork or a second remote reports no-upstream, or silently compares against an unrelated origin/<same-name> if one exists. The INI parser that would fix it properly stays rejected. DISCLOSE the assumption in the code and in what the strip means, so the silent-wrong-comparison becomes a written limitation rather than a surprise.

B3 - an unreadable HEAD is currently reported as detached: true with commit: null. Detached is a user-visible claim about the repository made on no evidence. Reuse the unknown state that landed with ruling 8 - strip.unknownTip already exists for exactly this class of ignorance, so there is no new state and no new string.
