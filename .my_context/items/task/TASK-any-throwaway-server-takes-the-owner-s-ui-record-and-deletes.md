---
id: TASK-any-throwaway-server-takes-the-owner-s-ui-record-and-deletes
type: task
title: any throwaway server takes the owner’s ui record and deletes it on the way out
status: active
severity: soft
always: false
summary: Sandbox a lane’s server record and refuse to overwrite a record whose server is still answering.
summary_of: f31b09a22c91653c
scope:
  - src/core/ui-server-upkeep.ts
  - src/core/ui-server-probe.ts
  - src/cli/commands/ui.ts
  - test/**
tags:
  - v2
  - "plan:rulings"
  - "seq:113"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-17
valid_until: null
checksum: 97cf6989531e3c52
plan: rulings
seq: "113"
state: todo
priority: "1"
---

# any throwaway server takes the owner’s ui record and deletes it on the way out

OWNER RULING, 2026-09-17: **"Both — sandbox and probe."**

── WHAT HAPPENED, TO HIM, TWICE IN ONE DAY ────────────────────

`~/.my-context/ui-server.json` is ONE FILE PER USER, written unconditionally at start and
**CLEARED AT EXIT**. A lane started a throwaway server on 58991; that server took the record from
the owner’s on 58888, and then DELETED IT when it exited.

Measured consequences, both observed:
  — While the lane ran, `mycontext ui --nonce` handed out a credential for **the lane’s server**
    rather than his. The URL worked, opened a real server on the same corpus, and looked correct.
  — After it exited, **no record existed at all**. His server on 58888 was still answering HTTP
    200 and was undiscoverable; the next `--nonce` would have SPAWNED A SECOND SERVER rather than
    found it, and the upkeep hook would not put his back.

This is the aggravated form of `KNOWN-ui-nonce-hands-you-a-credential-for-whichever-server-it`.
That one says the command guesses; this one says **anything can take the thing it guesses from,
and then remove it.**

── BOTH FIXES, AND WHY NEITHER IS SUFFICIENT ALONE ──────────────

**1. SANDBOX A LANE’S RECORD.** `MYCONTEXT_UI_SESSIONS_DIR` already does this — a lane used it for
its measurement server and the global file was never touched. Make it the documented path for any
server that is not the project’s own, and say so where a lane will meet it.
   *Not sufficient alone:* it holds until someone forgets, and a forgetting is silent.

**2. PROBE THE INCUMBENT BEFORE OVERWRITING.** `writeUiServerRecord` should connect to the port
the existing record names and refuse to replace a record whose server is still answering.
`src/core/ui-server-probe.ts` ALREADY DOES THE CONNECTING, and the module’s own header already
states that liveness is proved by connecting rather than by the file. **The code to decide this
correctly already exists and is not consulted at the one moment it matters.**
   *Not sufficient alone:* it fixes the theft, not the deletion — see below.

── THE THIRD THING, WHICH IS THE ACTUAL DATA LOSS ───────────────

**CLEARING AT EXIT MUST CLEAR ONLY YOUR OWN RECORD.** A server that never owned the record still
deletes it on the way out today — which is how the owner ended with no record at all rather than
merely the wrong one. Compare the pid (and port) before unlinking. A process removing a file it
did not write is the defect under both of the above.

── HOLD IT WITH PROOFS THAT GO RED ────────────────────────

  — A second server starting while the first answers does NOT replace the record.
  — A second server exiting does NOT delete a record it did not write.
  — A record naming a port nothing answers on IS replaced — or a crashed server would lock the
    file forever, which is the opposite failure and just as bad.

That third proof is the one to write first: it is the case where refusing is WRONG, and a
protection that cannot tell dead from alive has only moved the problem.
