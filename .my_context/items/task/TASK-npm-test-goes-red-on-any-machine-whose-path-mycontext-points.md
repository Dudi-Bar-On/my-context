---
id: TASK-npm-test-goes-red-on-any-machine-whose-path-mycontext-points
type: task
title: npm test goes red on any machine whose PATH mycontext points at another checkout, because the suite is not hermetic against PATH
status: active
severity: soft
always: false
summary: The test suite fails on a contributor's machine when a globally installed copy of the tool is on the PATH, because tests that run the doctor inherit the machine's PATH and the doctor rightly reports the mismatch.
summary_of: 336b63580fa9502e
scope: []
tags:
  - "plan:release"
  - "seq:12"
  - "state:doing"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-22
valid_until: null
checksum: 265753b4979af680
plan: release
seq: "12"
state: doing
---

# npm test goes red on any machine whose PATH mycontext points at another checkout, because the suite is not hermetic against PATH

Found by lane 1.3 on 2026-09-22 in a fresh clone on the owner's machine: 49 tests fail with doctor's cli_path_mismatch because the machine's global npm link (C:/Users/.../npm/node_modules/mycontext -> this repository) is on PATH and the clone is a different checkout. The doctor check (src/doctor/cli-on-path.ts:299) is correct and must not be silenced; the defect is that the suite inherits the machine's PATH. Closing condition: the suite spawns every CLI child with a PATH that carries no npm global bin directory (one place, inherited by every child - test/helpers/pin-rendering.ts is the preload every run passes through), a test proves a planted shim on PATH does not reach a child, and a fresh clone beside this checkout passes npm test with the global link still present. Files: test/helpers/pin-rendering.ts and whichever helper builds the child env; src/doctor/cli-on-path.ts untouched.
