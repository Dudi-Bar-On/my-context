---
id: TASK-storemeta-answers-null-for-a-corrupt-manifest-exactly-as-for
type: task
title: storeMeta answers null for a corrupt manifest exactly as for a store that was never published
status: active
severity: soft
always: false
summary: When the rule store's manifest is damaged, the status and MCP surfaces say there is no store version, which is the same thing they say when nothing was ever published.
summary_of: 32e333cab8a544d9
scope: []
tags:
  - "plan:release"
  - "seq:31"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-23
valid_until: null
checksum: 7b2e62e5dfa37c20
plan: release
seq: "31"
state: todo
---

# storeMeta answers null for a corrupt manifest exactly as for a store that was never published

Found by task 4.9 on 2026-09-23: storeMeta() in src/rules returns null both for an absent manifest and for one that is present and unreadable (readManifestIfPresent now tells them apart and throws ManifestUnreadableError for the second), so mycontext status, status_report and the store surfaces print no store version where they should name damage and point at mycontext rules verify. Closing condition: storeMeta (or its callers) carry the unmeasured state with the manifest's own refusal sentence (manifestUnreadableDetail in src/rules/integrity.ts - one sentence, not a second), status and status_report print it in the shared could-not-measure shape task 3.2 built, and a test per surface plants a corrupt manifest and asserts the sentence rather than no store version. Files: src/rules (storeMeta), src/cli/commands/status.ts, src/mcp/tools.ts, their tests. Release phase 5 (CLI and store).
