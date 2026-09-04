---
id: TASK-a-server-older-than-the-data-on-disk-calls-the-audit-log
type: task
title: a server older than the data on disk calls the audit log untrustworthy rather than calling itself stale
status: active
severity: soft
always: false
summary: A running server refuses the audit log as damaged when the only problem is that its own frozen code predates a record type just added.
summary_of: 03495194baf8278b
scope:
  - src/core/audit.ts
  - src/core/audit-tail.ts
  - src/core/code-identity.ts
tags:
  - v2
  - ui
  - live
  - audit
  - "plan:live"
  - "seq:14"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 1b0ab227ffa3cc2f
plan: live
seq: "14"
state: todo
priority: "1"
---

# a server older than the data on disk calls the audit log untrustworthy rather than calling itself stale

Reported by the owner on 2026-09-04, from the web status bar: "the stream refused to continue:
my_context: the audit log at ... audit.jsonl cannot be trusted - line 18". Nothing was wrong with
the log. Line 18 was a well-formed subagent-stop row from the previous day, the file had 650
lines with zero unparseable and zero out-of-order timestamps, and the CLI read the same file at
exit 0 the whole time.

The cause is a vocabulary skew rather than damage. specFor in core/audit.ts validates every row
against AUDIT_OPS, which is a CLOSED list, and a new op named agent-dispatched had been added to
that list an hour earlier. A UI server freezes its own modules at start, so the running server
held the list as it stood before the addition and refused a row written by code newer than
itself. The remedy was to restart the server; nothing needed repair.

Two things make this worse than a stale feature. The message is the most alarming one the product
owns, saying an audit trail that silently omits entries is worse than one that refuses to answer
and inviting the reader to inspect a damaged file that is not damaged. And the line number sends
them to the wrong place: the reader takes a tail, so line 18 was the eighteenth line of the tail
window and the offending row was line 644 of the file. A person following that message hunts for
corruption in a blameless row.

This is a DIFFERENT axis from live/12, which covers browser assets loaded newer than the server
that serves them and whose symptom is a feature that merely looks broken. Here the skew is
between a frozen reader and DATA already on disk, and it will recur every single time an op, a
kind or any other closed vocabulary gains a member while a server is running.

What to build: when a row is refused because its op or kind is not in the closed list, and the
reading process is older than the file it is reading, say THAT. Name the running code as the
suspect before the data, and tell the reader to restart. Distinguish an unknown-but-well-formed
op from a genuinely malformed row, because only the second is a reason to distrust the file.
Report the line number in the FILE, not in the tail window, or say plainly that it is an offset
within a tail. The existing staleCode signal already knows how to compare a running process
against what is on disk, so the question is whether this check can consult it rather than invent
a second answer.

A second, related consequence was measured the same day while making the e2e server worker-scoped
(walk/133). A server that lives for minutes rather than seconds sees source change underneath it,
so the skew banner appears mid-run, covers the page and physically intercepts clicks, failing
tests that were never about skew. The banner itself belongs to live/12; what belongs here is that
both symptoms come from one fact, which is that a long-lived reader and the code on disk drift
apart and nothing reconciles them.
