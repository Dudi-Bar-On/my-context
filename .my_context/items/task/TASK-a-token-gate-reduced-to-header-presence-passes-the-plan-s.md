---
id: TASK-a-token-gate-reduced-to-header-presence-passes-the-plan-s
type: task
title: a token gate reduced to header-presence passes the plan's own security test
status: active
severity: soft
always: false
summary: A security test that only tries the missing-password case cannot tell a real check from one that accepts absolutely anything.
summary_of: b3ce85640de166fb
acknowledged:
  - state_unaudited@12499047ce7ac684
scope: []
tags:
  - "plan:rulings"
  - "seq:39"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-22
valid_until: null
checksum: 389b376d703007db
plan: rulings
seq: "39"
state: done
priority: "1"
---

# a token gate reduced to header-presence passes the plan's own security test

Found by ui2 task 8 while proving the gate, and it is the reason that task's evidence was worth asking for.

The plan's test sends a request with no token and asserts 401. An implementation that checked only whether the header is PRESENT - not whether it matches - passes every assertion the plan makes. The agent demonstrated it: narrowing the gate to accept any non-empty token left the plan's version fully green.

It added a wrong-token pass, which reddens with 'answered 200 to a wrong token, 200 !== 403'. Four deliberate breaks in total, each reverted, each recorded in the file header and the commit body.

Two smaller things worth carrying: the probe list is DERIVED - the test starts with an empty route table, calls the two register functions and demands set equality with the probes, so it cannot silently shrink - and the method is part of that equality, which structurally closes the hole where a POST route decays into an uncovered one because the sweep compares paths only.

Recorded because the lesson generalises past this test: an authorisation test that only exercises the absent case cannot tell a real check from a presence check.
