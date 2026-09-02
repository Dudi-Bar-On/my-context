---
id: DEC-the-web-ui-lands-on-the-injection-preview-not-status
type: decision
title: The web UI lands on the injection preview, not status
status: active
severity: soft
always: false
summary: Opening the tool's pages shows what the next session will be given, rather than a general status page that nothing has yet justified keeping.
summary_of: 6a5c0ab2698197a0
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-18
valid_until: null
checksum: bf16cc97df091f03
---

# The web UI lands on the injection preview, not status

route() defaults to 'preview' at event=session-start on recentSessions(1)[0], rendering with no user input: SelectContext declares path as optional and the global session selector already defaults.

Forced as well as preferred. screens/status.js is built by plan 1 task 19, which wave 1 defers, so route()'s current default target does not exist in wave 1. Spec section 4 graded status a warning-exception justified by 'kept because it is the landing screen and something must be'; that justification is spent and the screen is re-justified on its own merits or dropped.
