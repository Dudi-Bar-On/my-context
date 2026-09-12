---
id: TASK-ui-nonce-falls-back-to-a-stale-record-and-hands-you-a
type: task
title: ui --nonce falls back to a stale record and hands you a credential for somebody else's server
status: active
severity: soft
always: false
summary: Asking for a web-UI credential now refuses when the only note of a running server points at somebody else's, instead of quietly handing you a working key to it.
summary_of: e7c0d40acb4623f3
summary_was:
  - 2026-09-11 When the liveness record cannot be written, the nonce command points at whatever server the global record last named.
acknowledged:
  - task_unverified@a2d86e7b89c84fd3
scope:
  - src/cli/commands/ui.ts
  - src/ui/**
tags:
  - v2
  - ui
  - safety
  - "plan:live"
  - "seq:19"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: a273e532a4c39cfb
plan: live
seq: "19"
state: done
priority: "1"
---

# ui --nonce falls back to a stale record and hands you a credential for somebody else's server

Measured twice on 2026-09-05, by two different callers, hours apart.

mycontext ui --nonce is the documented way back into a running UI when a browser has no credential. It is supposed to answer for YOUR server. Twice it answered for a different one.

The second case is the serious one and it was reported by the caller rather than discovered afterwards. A lane started its own throwaway server on port 0. The per-user ui-server.json write failed with EPERM, so nothing recorded that server. Asking for a nonce then fell back to the stale global record, which named a pre-existing instance on another port, and the lane killed that process believing it was cleaning up after itself. It was not its server. It said so plainly in its report, which is the only reason this is known.

The first case, earlier the same day: --nonce returned a link to a port that was not the running 58888 instance but a newly spawned one, and that stray was killed too.

So the failure has two halves and both matter. A write that fails leaves the caller with no record and no warning, and a lookup that finds no record of its own silently answers from a global one. Neither half is wrong on its own; together they hand somebody a credential and an implied target for a server they do not own.

What must be true at the end: a nonce request that cannot identify the caller's own server REFUSES and says why, rather than answering for another. A refusal a reader can act on is this project's standard and it applies exactly here - name the record that was missing, and what to run instead.

Establish before building: why the EPERM happened, and whether the record path is per user, per workspace or global. If one server per user is the design, then a second server is the unhandled case and the fix is to say so. If it is meant to be per workspace, the fallback is reading the wrong scope entirely.

And decide what --nonce should do when several servers are running, which is the normal state here: lanes start their own on port 0 constantly. Answering for the newest, or for the one matching this workspace, are different answers - state which and why.

CLOSED 2026-09-11. Reproduced first, then fixed.

WHAT THE EPERM WAS. Windows MoveFileEx onto a destination another handle holds, or onto a
read-only one. It was reproduced directly: the record was made unwritable, the write failed
after 56ms - one 50ms retry and then the real failure - and the PREVIOUS record survived
untouched, because the write is temp-plus-rename. So a failed write does not clear the
address; it leaves the old one standing.

THE SCOPE, ESTABLISHED. The record is PER USER and global - one file in the home directory,
holding one pid, one port and one workspace. That is right and stays: a pid is a fact about a
machine. What follows from it is the part nobody had written down - a SECOND server is an
unrecorded server, and the file goes on naming whichever one wrote it last. Nothing bounds how
old that is; a record is only replaced by a server that starts AND succeeds in writing.

THE RULING ON SEVERAL SERVERS. It answers for THE ONE SERVING THIS WORKSPACE, never the newest.
The newest is the newest only by accident of write order, which is a race between unrelated
processes; and a credential minted at a server redeems at THAT server for THAT server's corpus.
So a live server whose recorded workspace is not the caller's is refused, before the mint, and
the refusal names the record, the port, the pid, the workspace that server is serving and the
workspace that asked. The one widening that stays is the address a person wrote down in this
workspace's own ui.port - and it is skipped when it IS the foreign server's port.

MEASURED BEFORE: exit 0, and a redeemable credential for another workspace's server, with no
sentence saying whose. MEASURED AFTER, same fixture: exit 1 and no credential.
