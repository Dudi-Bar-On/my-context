---
id: KNOWN-node-test-spawned-from-inside-a-test-inherits-node-test
type: known_issue
title: node --test spawned from inside a test inherits NODE_TEST_CONTEXT and runs nothing, exiting 0
status: active
severity: soft
always: false
summary: A test that starts a second Node test run as a child process gets a child that quietly runs no tests and reports success, because the child believes it is already inside a test runner.
summary_of: 1e0fd198b5fab549
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-23
valid_until: null
checksum: 0160b9e548c05846
---

# node --test spawned from inside a test inherits NODE_TEST_CONTEXT and runs nothing, exiting 0

Found by task 4.15 on 2026-09-23 and confirmed by its reviewer as rediscovered twice (test/core/real-home-guard.test.ts:190 already deletes the variable): a child spawned with node --test <file> from inside a running test inherits NODE_TEST_CONTEXT from the parent runner, and Node's test runner then treats the child as a worker, runs no files, prints nothing and exits 0 - so a fixture written to fail exits 0 that way and 1 without the variable, and a meta-test built on it is vacuously green. The escape (delete childEnv.NODE_TEST_CONTEXT) is not always available: src/rules/delivered.ts routes the delivery record on that same variable, so a child without it writes the real delivered.jsonl. What to do: never prove a gate by spawning node --test from a test; measure the effect the gate protects (4.15 measures the owner's audit segments) or run the fixture as a plain node script with an explicit exit code. Every test that spawns node --test today should be read against this.
