---
id: TASK-the-browser-suite-returns-to-the-real-corpus-and-the
type: task
title: the browser suite returns to the real corpus, and the simulated one is retired
status: active
severity: soft
always: false
summary: The end-to-end tests stop running against a stand-in and run against the project itself, like everything else.
summary_of: b258290ab8bbf2a9
scope:
  - e2e/**
  - scripts/demo-corpus.ts
tags:
  - v2
  - testing
  - corpus
  - "plan:port"
  - "seq:100"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: 63fe409959b12797
plan: port
seq: "100"
state: todo
priority: "2"
---

# the browser suite returns to the real corpus, and the simulated one is retired

Owner ruling 2026-09-07: the simulated corpus should not be used any more. This supersedes
DEC-the-ui-is-developed-against-a-simulated-corpus-until-the, and it is the substance of the
already-filed port/99 - LAST UI TASK: return the UI to the real corpus. Do that work there rather
than opening a second front.

WHAT HE ASKED, in his words: "supersede the e2e tests that uses demo corpus, it should not be used
anymore". He also asked whether it harmed the project. Measured answer below, because the honest
reply is not simply yes or no.

THE SCOPE, measured: 69 e2e specs exist and 24 of them name the fixture or its CORPUS export. The
unit and integration suites - roughly six and a half thousand tests - always ran against the real
corpus. So this is one harness, not the project.

IT DID NOT HARM THE PRODUCT, and one datum settles it: the spec that started this ran 12 of 14
against the fixture and 12 of 14 against the LIVE corpus, identically. The defect was a race in
the test. The fixture was not hiding it and did not cause it.

WHAT IT DID COST is narrower and real: it cost a morning of MISDIAGNOSIS. I read a comment naming
the fixture and reached for it as the explanation, framed a fixture decision as the owner’s to
make, and nearly pulled port/99 forward to serve a test bug. A stand-in that is right for a gate
is still a second answer to "what is the app looking at", and a second answer is somewhere for a
wrong diagnosis to land.

AND THE REASON IT EXISTED IS NOT VOID - IT MUST BE ANSWERED, NOT DISCARDED. On 2026-08-23 the
parity ledger was measured BOTH WAYS: over the live corpus `ask` reported 17 absent kinds, `work`
17 more and `preview` 11, and not one was a line of code. They were what that corpus happened to
hold that day. screen-parity holds a SHRINK-ONLY ledger, so over data that changes daily it
records the day rather than the code.

SO THE WORK IS NOT "DELETE THE FIXTURE". It is: make the gates that needed determinism get it from
something other than a stand-in corpus. Each of the 24 specs is one of three cases - it never
needed the fixture and simply moves; it needs one specific state (a pending revision, an
undelivered session, a spill) which can be arranged in a scratch workspace per test the way
execute.spec.ts already does; or it is a shrink-only ledger, which needs its baseline re-derived
and is the only genuinely hard case. Classify all 24 before changing any.

AND THE POINT OF THE RETURN, in e2e/app.ts’s own words, is "precisely to find what a fixture hid".
Expect findings. They are the return working, not the return failing.
