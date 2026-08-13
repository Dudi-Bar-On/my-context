---
id: DEC-sessionstart-injection-verified
type: decision
title: SessionStart injection is verified working, with no shell field
status: active
severity: soft
always: false
scope: []
tags:
  - verification
  - hooks
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: ed1fc6fd7f3724af
---

# SessionStart injection is verified working, with no shell field

Verified end to end on 2026-08-13 with an unguessable canary phrase placed in a
pinned item in a scratch workspace. A headless session — `claude -p … --plugin-dir`
— reproduced the phrase, which exists nowhere but the injected item. A negative
control in a directory with no workspace answered NONE and started clean.

This settles three assumptions that had been carried, untested, through all of
Plan 1.

## Observations
- [fact] The SessionStart matcher fires and plain stdout reaches the model as context
- [fact] ${CLAUDE_PLUGIN_ROOT} interpolates correctly on Windows without a shell
- [fact] No "shell" field is needed in hooks.json — a bare `node "path"` command works, so the hard dependency on git-bash was correctly avoided
- [method] A canary phrase makes the test unambiguous: the model either has information available nowhere else, or it does not #testing
- [method] Always pair with a negative control — otherwise "fired and found nothing" is indistinguishable from "never fired" #testing

## Relations
- answers [[OPENQ-does-sessionstart-injection-actually-work]]
- unblocks [[REQ-plan-2-precision-injection]]
