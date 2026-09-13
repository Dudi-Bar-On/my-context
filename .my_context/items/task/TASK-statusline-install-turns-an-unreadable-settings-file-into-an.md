---
id: TASK-statusline-install-turns-an-unreadable-settings-file-into-an
type: task
title: statusline install turns an unreadable settings file into an empty one and overwrites the whole configuration
status: active
severity: soft
always: false
summary: Installing an optional extra can wipe a person's editor settings when the existing file cannot be read, and the backup kept for exactly that case is empty.
summary_of: 25cf7b8bc6ab2ec4
scope:
  - src/cli/commands/statusline-install.ts
  - src/cli/commands/statusline.ts
tags:
  - v2
  - cli
  - silent-failure
  - windows
  - "plan:swallow"
  - "seq:1"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: c0847c3b44e2ee4d
plan: swallow
seq: "1"
state: todo
priority: "1"
---

# statusline install turns an unreadable settings file into an empty one and overwrites the whole configuration

INFERRED, NOT REPRODUCED. The mechanism was traced line by line in the source; the incident was never made to happen. Report 3 derives the trigger from this repository's own measured `EPERM` on `rename` under Windows anti-virus, and says so. THE FIRST STEP OF THIS WORK IS TO REPRODUCE IT -- make the settings file unreadable for a reason other than absence, run the install, and observe the overwrite. If it cannot be reproduced, that is a legitimate outcome and this item says so rather than being softened.

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, B2) as row 2 of `reports/2026-09-13-the-consolidated-findings.md`, and ranked second of the five it would do first.

WHAT THE CODE DOES. `statusline install` reads the user's Claude Code `settings.json` inside a `catch` that covers every errno, not just "the file is not there". An unreadable file therefore becomes `{}`, and the install then writes a two-key settings file OVER the user's permissions, hooks, env, model and MCP servers.

AND THE BACKUP BUILT FOR EXACTLY THIS CASE CANNOT RESTORE IT. The same path saves `previousText: null`, so `statusline uninstall` has nothing to put back. This is the only row in the whole consolidation where the damage is unrecoverable.

THE FIX IS ONE LINE and is correct whether or not the Windows trigger is ever reproduced: narrow the catch to `err.code === 'ENOENT'`, reusing the wording the parse branch beside it already uses, and refuse on anything else.
