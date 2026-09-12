---
id: TASK-more-than-half-the-delivery-log-is-tests-and-the-file-has-no
type: task
title: more than half the delivery log is tests, and the file has no reader
status: active
severity: soft
always: false
summary: The recorder now forks a test-written row into a sibling file, so delivered.jsonl holds product deliveries only; the 157 legacy test rows were moved rather than deleted, and the file does have a reader - the assertion - but no reporting surface.
summary_of: c0c11f85e55985c3
summary_was:
  - 2026-09-12 A log that records what the product delivered is mostly records of tests, and nothing reads it, so the one count it exists to support is fiction.
scope:
  - src/rules/deliver.ts
  - test/rules/**
  - .my_context/.rules/**
tags:
  - v2
  - store
  - "plan:rulings"
  - "seq:71"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/pollute.md"
source_anchor: null
source_checksum: 1687f342b35a86bc
valid_from: 2026-09-12
valid_until: null
checksum: deebcc3f0fd980fd
plan: rulings
seq: "71"
state: done
priority: "1"
---

# more than half the delivery log is tests, and the file has no reader

> OWNER INSTRUCTION 2026-09-13: "fix the test that writes into my workspace". The instruction is right and the diagnosis behind it needs correcting first, because the obvious fix would break something that is load-bearing.
>
> THE TEST IS NOT ROGUE. `test/rules/lane-still-gets-the-no-git-rule.test.ts` writes into the real workspace DELIBERATELY, with the argument written above it: `workspaceIsMyContext` compares the workspace's parent against `packageRoot()`, so THE DEVELOPER TIER IS IN FORCE IN EXACTLY ONE DIRECTORY ON THE MACHINE and a temporary workspace cannot stand in for it. A fixture store under `MYCONTEXT_RULES_DIR` would prove the renderer works and prove nothing about the entry that shipped. Moving this test to a temp directory would delete the only proof that a lane actually receives the no-git rule.
>
> WHAT THE ARGUMENT DID NOT ANTICIPATE is the whole defect. It says "the cost is accepted and bounded: the door appends one row to `.my_context/.rules/delivered.jsonl`". Bounded per run - NOT bounded over a thousand runs. Measured 2026-09-13: of 275 rows, 105 carry a `test::` key and 51 more carry `lane-still-gets-the-no-git-rule` as their first segment. ABOUT 156 OF 275 ROWS ARE TESTS. Spec section 8.2 defines a count over this file, and that count is now more than half fiction.
>
> AND THE MARKING IS ALREADY THERE, INCONSISTENTLY, WHICH IS THE REAL FINDING. Some test rows use a `test::` prefix and some do not. So the file already tried to distinguish them and nothing enforces the convention or reads it.
>
> WHAT THIS ASKS FOR:
>
> 1. ONE CONVENTION FOR A TEST-WRITTEN ROW, APPLIED EVERYWHERE. Every row a test causes is identifiable by the recorder, not by a reader's guess about a key's spelling.
>
> 2. THE PRODUCTION LOG MEANS WHAT THE SPEC SAYS. Either a test row does not reach `delivered.jsonl` at all, or it reaches a separate file, or the readers exclude it - the doer chooses and argues. THE DELIVERY ITSELF MUST STILL BE REAL: the test's value is that the actual door runs against the actual store in the one directory where the developer tier applies. It is the RECORD that must stop polluting, not the delivery.
>
> 3. THE EXISTING 156 ROWS. Decide and say: leave them and filter on read, or remove them and say how a reader knows the file was pruned. Do not silently rewrite a log.
>
> 4. A REMOVAL PROOF THAT A TEST ROW CANNOT REACH THE PRODUCTION COUNT. Deleting the guard must redden an assertion at its own line.
>
> AND WHILE THIS IS OPEN, TWO FACTS FROM THE SAME MEASUREMENT that belong to this subject rather than a separate one: NOTHING READS `delivered.jsonl` AT ALL - not the CLI, not MCP, not doctor, not the UI - so a file written at every door has no reader; and THE `session-start` DOOR HAS NEVER ONCE DELIVERED SUCCESSFULLY, zero rows in its whole life against one `missed`, while the subagent door joins cleanly against the audit log at 83 injections to 81 rows with one real miss the assertion caught. The second of those is either a real hole or a recording gap, and this item is where the question sits until it is answered.
