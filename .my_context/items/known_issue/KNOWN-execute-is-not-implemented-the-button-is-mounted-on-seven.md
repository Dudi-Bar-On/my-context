---
id: KNOWN-execute-is-not-implemented-the-button-is-mounted-on-seven
type: known_issue
title: "Execute is not implemented: the button is mounted on seven screens and runs nothing"
status: deprecated
severity: hard
always: false
summary: A report that the Execute button appears across the interface without actually running anything behind it.
summary_of: 9ca5eb505933a8df
scope: []
tags:
  - v2
  - ui
  - execute
  - owner-blocking
  - must-fix
origin: human
source_file: null
source_anchor: null
source_checksum: 7e4ec37ffcc4110d
valid_from: 2026-08-27
valid_until: 2026-08-29
checksum: a7319352a8ecdc07
---

# Execute is not implemented: the button is mounted on seven screens and runs nothing

**MEASURED FALSE, 2026-08-29 — this describes a world that ended at `plan:execute seq:5b`.**

Driven in a real browser against disposable corpus copies, on the Review queue screen, all four settlements:

* **Reject a draft** → the confirm rendered the field table (`status draft→deprecated`, `validUntil → 2026-08-29`) → *Run it* → `exit 0`; on disk `status: deprecated`; the audit carries `execute` / `update` / `execute-done`.
* **Reject a stale revision** → confirm rendered → *Run it* → `exit 0`; `review revisions` then reports 0 pending.
* **Accept a draft** → `exit 0`, `status: active` on disk.
* **Accept a stale revision** → the confirm GET refuses with the CLI's own *"revision … is STALE"* sentence, mints no nonce, and offers no Run button.

That last one is the approval boundary working, not a dead control — and the Reject beside it is the settlement that lands.

So the button is not mounted on a hole. Retired rather than superseded: there is no replacement item to point at, because there is no longer a defect to describe.
