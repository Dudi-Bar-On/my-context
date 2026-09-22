---
id: TASK-two-surfaces-still-describe-importing-a-full-export-after
type: task
title: two surfaces still describe importing a full export after the ruling withdrew it
status: active
severity: soft
always: false
summary: After the tool stopped accepting a whole-workspace export as something to import, one automated preview and one command still tell the user the old story, so a reader is pointed at a door that no longer opens.
summary_of: e19ebd37f8ac9841
scope: []
tags:
  - "plan:release"
  - "seq:20"
  - "state:doing"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-22
valid_until: null
checksum: ee1ca7aa785720c8
plan: release
seq: "20"
state: doing
---

# two surfaces still describe importing a full export after the ruling withdrew it

Found by lane 3.5 on 2026-09-22 while landing ruling C (DEC-a-full-export-is-an-archive-to-copy-back-never-an-artefact). Two sites outside that lane's files still carry the withdrawn behaviour: src/mcp/tools.ts:2039 - the MCP preview_pack_import tool answers a full export with the old message (pass --name); src/cli/index.ts:338 - planPack's comment or message points at the now-closed pack import --name workaround. Closing condition: both surfaces answer a kind:export artefact with the same one sentence pack import prints (a full export is an archive to copy back, not to import; --as-pack at export time makes the importable pack) - one sentence, one place, imported by all three; a test for the MCP tool feeds a real export projection and asserts the sentence; the index.ts site no longer names the withdrawn route. Files: src/mcp/tools.ts, src/cli/index.ts, the module that owns the sentence (src/pack/import.ts or a sibling), test/mcp/. Phase 3.
