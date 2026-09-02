---
id: KNOWN-the-injected-endpoint-collapses-a-missing-seen-file-into-a
type: known_issue
title: the injected endpoint collapses a missing seen file into a measured zero, so the screen says a file nobody opened was read
status: deprecated
severity: soft
always: false
summary: A defect where a missing record of what a session read is reported as a measured zero, so the screen says nothing was read when nothing was checked.
summary_of: b69c77c44fb934f9
scope: []
tags:
  - v2
  - ui
  - api
  - "screen:injected"
  - read-model
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: 2026-08-31
checksum: 4699ae1e8a93160e
---

# the injected endpoint collapses a missing seen file into a measured zero, so the screen says a file nobody opened was read

MEASURED 2026-08-29, plan:walk seq:35. readJsonlFile swallows ENOENT (src/core/jsonl-log.ts), so readSeen answers a MISSING seen file and a seen file that was READ and held nothing with the same value - lines empty, error null - and apiInjected passes it on verbatim. The fact survives on disk right up to that branch and is discarded there. Consequence: screens/injected.js draws inj.zeroLines, "This session was read and has received nothing yet", over a session whose seen file does not exist. That is clause 2 of STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is, whose scope reaches read models for exactly this reason. It is reachable on the live corpus today - seven of nineteen sessions have ledger rows and no seen file - and on .demo-corpus at demo-session-a3f9c1-20. THE FIX, which is one field: InjectedBody gains seen, read or absent, filled from readSeen where the distinction still exists; then injected.js draws a second key beside inj.zeroLines. Proposed key inj.noSeenFile, English "No seen file was written for this session, so nothing was read here - the audit log may still record what it was given." test/ui/injected-endpoints.test.ts pins the collapse as it stands and fails the day the field lands.
