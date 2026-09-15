---
id: TASK-eight-closed-repairs-disclose-on-stderr-and-nobody-has
type: task
title: eight closed repairs disclose on stderr, and nobody has checked which hook events show it
status: active
severity: soft
always: false
summary: A run of fixes all report their problem down the same channel, and nobody has confirmed the user ever sees that channel.
summary_of: 934b2cc41ca4caf6
scope:
  - src/hooks/**
tags:
  - v2
  - hooks
  - silent-failure
  - measurement
  - "plan:swallow"
  - "seq:16"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-15
valid_until: null
checksum: c4983e13c0112153
plan: swallow
seq: "16"
state: todo
priority: "1"
---

# eight closed repairs disclose on stderr, and nobody has checked which hook events show it

NAMED BY THE CONSOLIDATION AS A PRECONDITION AND NEVER FILED. `reports/2026-09-13-the-consolidated-findings.md`, under "Known unknowns that block a fix rather than a finding", says in its own words: "Whether Claude Code surfaces stderr on each event. Most of report 3s recommendations route a disclosure there, and the hook files assert it confidently for SessionStart/PreToolUse/SubagentStart and assert the OPPOSITE for SessionEnd. None of it was verified against a build. Where stderr is discarded, the fix must be the audit row instead - THIS IS A PRECONDITION FOR ROUGHLY A THIRD OF THE SILENT-FAILURE FIXES ABOVE."

Found unfiled 2026-09-15 by the audit at `rulings/90`. Searched the corpus for any item asking the question: none.

IT IS NO LONGER A PRECONDITION. IT IS NOW A DEBT. Eight of the twelve D66 items are CLOSED, and the disclosures they added write to stderr: `test/hooks/config-unreadable-disclosure.test.ts` asserts `r.stderr` at every one of the six delivery paths, and `session-start.ts` writes `unrecordedDeliveryLine` there for D70 as well. If the platform discards stderr on some of those events, those repairs are green in the suite and silent in the product - which is the exact defect they were written to end.

THE CONTRADICTION IS IN THE SOURCE AND IS THE STARTING EVIDENCE. `src/hooks/session-end.ts` states that the platform copies a SessionEnd hooks output to stderr ONLY ON THE FAILURE BRANCH, and that `INV-hooks-fail-open` requires exit 0 - so it writes the line anyway and says so. `src/hooks/session-start.ts` treats stderr as "the channel", the one that reaches the USER and never the model. Both cannot be the general rule.

WHAT ANSWERING IT LOOKS LIKE: drive a live `claude` session, make each hook event fire with a disclosure on stderr, and record per event whether it appeared - SessionStart, PreToolUse, PostToolUse, SubagentStart, SubagentStop, Stop, PreCompact, PostCompact, SessionEnd. The deliverable is a table, not a fix. Where an event discards stderr, the fix for every disclosure on that event is the audit row instead, and that is then a second item with a known size.
