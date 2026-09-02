---
id: TASK-the-confirm-is-rendered-read-and-only-then-run-in-a-real
type: task
title: every executable screen is driven from the UI, in a real browser
status: active
severity: soft
always: false
summary: Test every screen that can run a command the way a person uses it, since only a browser can prove that what you read is what runs.
summary_of: 9e725e001784b7d4
scope: []
tags:
  - v2
  - ui
  - execute
  - security
  - e2e
  - "plan:execute"
  - "seq:7"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: f6cae6844969746c
plan: execute
seq: "7"
state: done
priority: "2"
source: owner, 2026-08-26 ruling; plan written 2026-08-27
---

# every executable screen is driven from the UI, in a real browser

WIDENED BY THE OWNER, 2026-08-27: "after completing execute implementation, i want you to add a playwright test that go over every executable screen you handled and test it from the ui".

So this is no longer one screen's confirm. It is EVERY screen that offers Execute -- the composer plus the six of `seq:6b` -- driven the way a person drives it: pick the command, press Execute, read the confirm, run it, see what came back.

WHY IT HAS TO BE THE UI AND NOT THE ENDPOINT. `execute-route.test.ts` already proves the server: the ordering, the nonce, the refusals, the audit pair. What no server test can prove is that the string a person READ is the argv that RAN -- that is a property of the screen, the confirm and the endpoint agreeing, and it only exists in a browser. RULE-a-ui-change-is-not-verified-until-someone-has-looked-at-it says the same thing about looking.

PER SCREEN, at minimum: the control is VISIBLE (see the half-reset below); Execute opens a confirm before anything runs; the confirm names the command a person would recognise; a boundary command shows the field-by-field diff and a read does not; the residual sentence is on it verbatim; cancel runs nothing; run reports the exit code.

**THE HAZARD THAT WILL OTHERWISE PRODUCE MYSTERY FAILURES.** These tests RUN COMMANDS. The e2e suite drives one shared `.demo-corpus`, `e2e/app.ts` refuses to start without it, and workers run in parallel -- so a test that executes `add` or `pin` mutates the fixture underneath every other spec, and the damage lands somewhere else entirely as a failure belonging to nobody. That is the exact shape that cost two red runs on 2026-08-26 and one unexplained one on 2026-08-27.

So: a spec that executes a WRITE gets its own workspace, or the suite restores the fixture around it. Decide which and say why in the file. Reads may share. Do not discover this at 2am.

ALSO CHECK, because it is what the owner found by looking: every button the control draws has a background. `button{font:inherit;color:inherit}` sets colour and not background, so a classless button outside the four styling containers is light text on the UA's near-white face. See `plan:rulings seq:51`, which is the gate for the class.

Stop every UI server before running the e2e gate.
