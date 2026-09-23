---
id: DEC-the-dispatch-gate-reads-an-item-id-as-a-known-prefix
type: decision
title: the dispatch gate reads an item id as a known prefix followed by a lowercase slug
status: active
severity: soft
always: false
summary: When the tool checks that a delegated worker was told which recorded item it serves, it now recognises only ids shaped the way this workspace mints them, so capitalised words in ordinary prose no longer count as ids.
summary_of: 9ea1f16cf045f6f8
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-22
valid_until: null
checksum: 4de7222b63a4f9a8
---

# the dispatch gate reads an item id as a known prefix followed by a lowercase slug

Owner ruling, 2026-09-21 (release prompt, OWNER ANSWERS), recorded in release phase 3 on 2026-09-22. Ruling F. The gate's token is built at verdict time from this workspace's category prefixes, requires a lowercase-led slug after the hyphen and a left boundary; READ-ONLY, SHA-256, UTF-8 and X-MYCONTEXT-TOKEN are prose. Landed as task 3.6 (B11) of release/3 in src/hooks/pre-tool-use.ts.
