---
id: DEC-v2-ships-as-2-0-0-and-package-json-waits-for-the-tag
type: decision
title: v2 ships as 2.0.0, and package.json waits for the tag
status: active
severity: soft
always: false
summary: This counts as a major release because it changes behaviour people were relying on, and the new version number is only claimed once it is actually released.
summary_of: 86d595248cb04c5f
scope: []
tags:
  - v2
  - release
  - owner-ruling
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 959fe5c493892c32
---

# v2 ships as 2.0.0, and package.json waits for the tag

OWNER RULING, 2026-08-24, settling plan:rulings seq:41.

The release carries `2.0.0`. `package.json` stays at `1.0.2` until the tag, which is VERSIONING.md's own rule: a version in preparation is spelled 'Unreleased - 2.0.0 when tagged' and nothing claims to be released before it is.

THE CASE, read from the code by the changelog agent across 399 commits, and accepted:

1. The cross-session carry is ON BY DEFAULT. `continuity.ts` falls through to the most recent other session when `state/continuity.json` is absent, no config key gates it, and carried lines are hoisted to the front of `budgets.index` where they can DISPLACE this session's own. That is behaviour changing on an unchanged corpus with an unchanged config - and MINOR's carve-out is for new behaviour an existing config does not switch on, which this is not. The strongest single item.

2. `extra` is refused on a category that does not declare it: a capture that succeeded on 1.0.2 is refused until config.json gains `extraFields`. The one entry that can require a user to edit a file.

3. `audit@2`: upgrade is free, downgrade is ONE-WAY. After a single 2.0 write a 1.0.2 build refuses the whole audit read. A minor version that cannot be rolled back is the number lying.

4. An unknown top-level config key is now skipped and disclosed rather than refused, which REVERSES a change 1.0.0 itself recorded under Breaking.

AND ONE CANDIDATE ARGUED DOWN, which is why the list is trustworthy: `## Steps` is NOT breaking. `computeItemChecksum` adds the steps key only when steps exist, so every stepless item hashes byte-identically; making it unconditional would redden doctor on every corpus at once.
