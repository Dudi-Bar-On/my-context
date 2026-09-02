---
id: TASK-refuseopaquemeta-has-two-unbounded-echo-branches-a-stranger
type: task
title: refuseOpaqueMeta has two unbounded echo branches a stranger can reach
status: active
severity: soft
always: false
summary: Two error paths print text from a stranger's file at unlimited length, so it can flood the terminal; cap them as a third path already does.
summary_of: b2bf32ce6667ccbd
scope: []
tags:
  - "plan:export"
  - "seq:20"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 1b1155c709e4e171
state: done
plan: export
seq: "20"
---

# refuseOpaqueMeta has two unbounded echo branches a stranger can reach

Found 2026-08-23 while bounding the `--name` echo.

`refuseOpaqueMeta` (src/pack/manifest.ts) caps the value it echoes - but TWO branches fire BEFORE the length rule and echo without a bound: the all-whitespace branch and the trim-mismatch branch.

REACHABLE FROM A STRANGER'S FILE, which is what makes it worth filing: both are reached from a pack's own `manifest.json` through `parseManifest`, not only from a flag the local user typed. A 5,000-character name in somebody else's artefact reaches the terminal through those two branches.

Bounded on the `pack import --name` surface already (seq 15s), where the cap sits on the VALUE rather than the message - measured, capping the message kept the attacker's 5,000 characters and threw away the sentence saying what was wrong, because the value is printed first. Do the same here, and reuse `REFUSAL_VALUE_MAX`'s 256 rather than picking a second number.
