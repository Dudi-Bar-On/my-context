---
id: REQ-after-a-compaction-the-next-session-is-handed-the-handover
type: requirement
title: after a compaction, the next session is handed the handover the last one left it
status: active
severity: hard
always: false
summary: When a session's memory is condensed, the next one is handed the notes the last one left, and told plainly if any of it was cut or missing.
summary_of: 82ac66b8ca1cd752
scope: []
tags:
  - v2
  - owner-requirement
  - hooks
  - continuity
  - handover
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 66301bfc8d87ef82
kind: functional
---

# after a compaction, the next session is handed the handover the last one left it

OWNER REQUIREMENT, stated 2026-08-27: "on post compact hook, if a handover file exists read it".

WHAT IS BROKEN. A compaction is the one moment a session loses everything it has not written down. This project keeps a handover file for exactly that, and NOTHING IN EITHER REPOSITORY READS IT, WRITES IT, GENERATES IT, VALIDATES IT OR LINKS IT. Measured 2026-08-27 across every .ts, .js, .mjs, .json, .yml, .sh and .ps1 in both trees: the only non-Markdown occurrences of the word are inside Playwright accessibility snapshots, where the UI happens to be rendering a directory listing. The handover survives a compaction today because somebody remembers, which is not a mechanism -- LESSON-a-requirement-given-in-conversation-and-never-captured-is-a, again.

THE MECHANISM DIFFERS FROM THE WORDS, AND THAT IS RECORDED RATHER THAN QUIET. PostCompact CANNOT do it: build 2.1.239 declares no hookSpecificOutput variant for that event, so its stdout becomes a user-facing banner and the model never sees a byte. SessionStart with source 'compact' is the one hook whose stdout is appended to the model's context verbatim, and it already fires on a compaction. So PostCompact RESOLVES and RECORDS, SessionStart DELIVERS. See DEC-the-handover-is-delivered-by-sessionstart-because-postcompact.

DONE WHEN, and all four:
1. A compacted session receives the handover's marked section, bounded, after the corpus block.
2. The block DECLARES what it left out -- lines delivered of lines total, and the path. A block that quietly delivers 40 lines of 1,435 claims to be the handover and is not. REQ-every-list-and-table-declares-what-leaves-it-and-when-and applies: a truncated document is the same act as a truncated list.
3. A configured handover that is not there DISCLOSES on stderr. The silence is the defect this whole requirement answers.
4. An UNCONFIGURED handover changes nothing and says nothing. A plugin does not read files in somebody's repository because they installed it.

Design: docs/superpowers/specs/2026-08-27-handover-continuity-across-compaction-design.md. Plan: docs/superpowers/plans/2026-08-27-handover-continuity-across-compaction.md.
