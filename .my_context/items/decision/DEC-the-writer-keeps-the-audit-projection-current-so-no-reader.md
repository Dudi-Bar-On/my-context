---
id: DEC-the-writer-keeps-the-audit-projection-current-so-no-reader
type: decision
title: the writer keeps the audit projection current, so no reader meets a stale one
status: active
severity: soft
always: false
summary: The summary of past activity is kept up to date as the activity happens, so nobody opening a page finds it refusing to answer or showing blanks.
summary_of: b0c0f74df3d8dcfe
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - audit
  - api
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 55a2fbd02664a9f1
---

# the writer keeps the audit projection current, so no reader meets a stale one

OWNER RULING, 2026-08-25. It answers plan:ui3 seq:11x, open since 2026-08-22, which measured the defect and said plainly that the fix "is elsewhere, and it is a product decision".

THE DEFECT: on a real corpus the projection goes from `fresh` to `behind` twice inside forty minutes, purely because ordinary work appends to `.audit/audit.jsonl`. Nothing syncs it except someone running `mycontext audit`. Then `/api/watch/volume` and `/api/ask/audit` answer 503 -- correctly -- and the Audit stream shows an empty pulse, a filter row collapsed to All, and an empty table. The owner has seen that state and called it "far away from the mockup".

THE RULING: THE WRITER KEEPS IT CURRENT. The projection is appended to as the log is appended to, so a read surface never meets a stale one.

WHY THIS AND NOT THE OTHER THREE: it fixes the CAUSE rather than the symptom, and it fixes it for every reader at once -- the web UI, the statusline, and anything built later. Syncing once at `mycontext ui` startup was declined because the measured drift is twice in forty minutes: the screens would degrade during the very session that fixed them. Making the refusal actionable was declined AS THE WHOLE ANSWER -- it is honest and cheap and it leaves the product s most-used screens refusing by default with a chore attached.

THE READ-ONLY GUARANTEE IS UNTOUCHED. Nothing here lets a GET write. The write happens where writes already happen, on the path that appended to the log in the first place, and `test/ui/no-writes.test.ts` keeps asserting what it already asserts.

WHAT MUST NOT BE LOST, and it decides the failure mode: THE LOG IS THE SOURCE OF TRUTH and it is append-only (REQ, "The audit log is append-only"). A projection that cannot be updated must NOT fail the user s command and must NOT prevent the log append. The correct outcome of a failed projection write is a log that is ahead and a projection that says so -- which is exactly the state the read surface already refuses on, honestly. Silence is the one unacceptable outcome (INV-nothing-is-dropped-silently).

THE HARNESS FIX STAYS. e2e syncing before it serves is still right: an imported log, a corpus edited outside the tool, or a deleted projection can still produce a behind state, and a suite should begin from a corpus that can answer.
