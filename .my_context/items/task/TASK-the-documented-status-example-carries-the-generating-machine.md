---
id: TASK-the-documented-status-example-carries-the-generating-machine
type: task
title: the documented status example carries the generating machine's session count, so the doc-example fixture is not hermetic
status: active
severity: soft
always: false
summary: The README's worked example for the status command was generated on the owner's machine and records one session; on any other machine the same fixture records none, so the documentation drift test fails for everyone but the owner.
summary_of: 983b262ddf78ca4a
scope: []
tags:
  - "plan:release"
  - "seq:14"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-22
valid_until: null
checksum: ed171e9d560df576
plan: release
seq: "14"
state: done
---

# the documented status example carries the generating machine's session count, so the doc-example fixture is not hermetic

Measured 2026-09-22 by lanes 1.3 and release/12 in a fresh clone beside this checkout (global link neutralised): test/docs/examples.test.ts:289 (every documented example matches what the command actually prints) and :559 (…when today is a different day) fail on the mycontext status block alone — the committed block says one session was recorded, the clone's fixture run says none. status takes sessionsRecorded from ledger.sessionCount() (src/cli/commands/status.ts:109); the fixture is built by materializeDocFixture(dir) and run by runExampleInFixture (scripts/gen-doc-examples.ts:484). Something the fixture runs on the owner's machine records a session into the fixture's ledger that the same steps do not record elsewhere - find it (a hook that fires because of the owner's environment, a transcript directory resolved from the host rather than the fixture, an env variable the generator inherits) and cut the leak at the fixture, never by editing the block by hand.

Closing condition: runExampleInFixture('mycontext status') yields byte-identical output on this machine and in a fresh clone (proved locally by a test that runs the fixture with the host's session sources pointed at an empty directory and asserts equality with the normal run), README.md and docs/README.he.md are regenerated with node scripts/gen-doc-examples.ts alone (not gen:docs, which drives Chromium), and test/docs/examples.test.ts passes on the Ubuntu job. Files: scripts/gen-doc-examples.ts, test/docs/examples.test.ts, README.md, docs/README.he.md.
