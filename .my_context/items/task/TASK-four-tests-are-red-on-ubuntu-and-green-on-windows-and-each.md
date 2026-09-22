---
id: TASK-four-tests-are-red-on-ubuntu-and-green-on-windows-and-each
type: task
title: four tests are red on Ubuntu and green on Windows, and each passes here only because of something the owner's machine happens to have
status: active
severity: soft
always: false
summary: Four tests fail on the Linux CI job while passing on the owner's Windows machine, because each leans on a platform detail - terminal width, a Node warning, a filesystem race, or record ordering - instead of the behaviour it claims to test.
summary_of: 08d13b285c7d5b63
scope: []
tags:
  - "plan:release"
  - "seq:13"
  - "state:doing"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-22
valid_until: null
checksum: 93821c0d88ee11e1
plan: release
seq: "13"
state: doing
---

# four tests are red on Ubuntu and green on Windows, and each passes here only because of something the owner's machine happens to have

Measured on the Ubuntu job of CI run 35715432299 (commit 7a16c54f, 2026-09-22), before lane 1.3's fixes landed; the other nine reds in that run are 1.3's targets. These four are not:

1. test/cli/pack-import.test.ts:538 - asserts /2026-08\srev\s3/ over the human table of pack list; on Ubuntu the version cell wraps to two lines ("2026-08" / "rev 3"), so the regex misses. The table's column width depends on the terminal, so the assertion belongs on pack list --json (already run two lines later) or the version column must never wrap. Decide which and say why.

2. test/ui/execute-route.test.ts:723 - asserts body.stderr matches /./ after show NOPE. On Ubuntu stderr is empty. The assertion was satisfied on Windows only by the node:sqlite ExperimentalWarning that Node 24.14 prints and newer Node does not; find where the refusal for show NOPE actually goes (stdout? nowhere?) and assert the refusal text on the stream it belongs on. If a refusal is printed on stdout, that is a CLI defect to fix in src (a refusal is stderr), with a test.

3. test/core/jsonl-heal-race.test.ts:178 - the removal proof ("with the lock removed the harness must lose complete records") lost none over three rounds on Linux, where small O_APPEND writes do not tear the way the harness assumes. A proof that depends on a real race manifesting is not a proof on every platform. Make the loss deterministic by injecting the torn interleaving (a writer that splits one record across two writes with the lock removed) rather than racing processes; do not skip it and do not delete it.

4. test/ui/watch-model.test.ts:224 - /api/watch/context expected {injections: 2, tokens: 2200} bounded to this window and got {3, 6200}: the window bound did not apply on Linux. Find the platform-dependent input (record ordering, a timestamp comparison, an mtime resolution) and make the bound rest on something both platforms guarantee.

Closing condition: the four tests pass on the Ubuntu job (the Linux evidence) and still pass here; each fix carries a local test that reproduces the Linux condition deterministically (a narrow width, a warning-free stderr, an injected torn write, a shuffled input); no test is skipped or quarantined. Files: the four test files and whatever src each fix needs (src/cli/commands/format.ts for the table, the execute route, src/core/jsonl-log.ts, src/ui/watch-model.ts).
