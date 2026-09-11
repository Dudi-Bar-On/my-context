---
id: TASK-the-browser-suite-returns-to-the-real-corpus-and-the
type: task
title: the browser suite returns to the real corpus, and the simulated one is retired
status: active
severity: soft
always: false
summary: The end-to-end tests stop running against a stand-in and run against the project itself, with the four states this corpus no longer holds arranged in a private copy that is deleted afterwards.
summary_of: 7fd8aaa7909ad806
summary_was:
  - 2026-09-11 The end-to-end tests stop running against a stand-in and run against the project itself, like everything else.
scope:
  - e2e/**
  - scripts/demo-corpus.ts
tags:
  - v2
  - testing
  - corpus
  - "plan:port"
  - "seq:100"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-07
valid_until: null
checksum: 3d8e7b3cb45e7d3e
plan: port
seq: "100"
state: done
priority: "2"
verified_on: 2026-09-11
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

DONE 2026-09-11, and what the return actually found.

RE-MEASURED FIRST, because the figures this task was filed on had moved. A full chromium run before
any change: 422 passed, 78 failed, 32.7 minutes. After: chromium 471 passed / 34 failed / 1 skipped in 32.3 minutes, and Google Chrome 475 passed /
32 failed / 1 skipped in 32.3 minutes - so the seeded copies cost no wall clock at all. The earlier reading of "67 distinct failures, 41 of
them corpus state" was close in kind and low in number.

THE FOUR STATES THIS CORPUS NO LONGER HOLDS, each measured rather than assumed:

  selection.spilled is 0 on every question the preview asks. The real budgets (pinned 30,000, jit
  32,000, index 8,000) are larger than this corpus needs, so nothing overflows and every spec that
  pages a spilled list was measuring an empty container.

  BOTH HALVES of the review queue are empty - reviewQueue.drafts 0 and pendingRevisions.revisions 0.
  The revisions log and the staging directory DO both exist, which the earlier reading had wrong;
  what is true is that both revisions in it were promoted on 2026-08-29 and the staging files are
  accepted lesson candidates, so neither queue draws.

  ALL 78 doctor findings route to acknowledge, 18 of them open. Not one run-routed finding exists,
  so Doctor's repair confirm could not be reached at all.

  NO SESSION carries a spilled injection, and the demo-session-a3f9c1-* ids three specs still named
  by hand belong to the retired fixture and are in no corpus anywhere. served-shape.spec.ts does NOT
  name one, which the earlier reading had wrong; session-picker.spec.ts does, which it had missed.

AND TWO THE RETURN FOUND THAT NOBODY HAD LOOKED FOR:

  src/api/handler.ts and RULE-handlers-validate-at-the-boundary were both .demo-corpus artefacts.
  This repository has neither, so four preview-spilled tests were waiting thirty seconds for a
  picker option that does not exist and reporting it as the screen. Both paths that test names are
  now DERIVED from the payload; the negative direction - a path nothing scopes to - turns out to be
  unreachable on this corpus and the test says so and skips rather than asserting the opposite of
  what it says.

  THE CONTRADICTION GATE (2026-09-08) refuses a fixture's own seeding, and it refuses `pin` and
  `edit` as well as `add`. Five specs were red on it. The answer is the settlement a person makes -
  --distinct for every item the refusal names - and four of the five now make it. The fifth cannot,
  and that turned out to be a product finding rather than a fixture problem; it is written up at the
  foot of this item.

HOW THE STATE IS ARRANGED. The owner approved one exception on 2026-09-11 and it is recorded on
INSTR-testing-happens-against-the-current-corpus-and-an-exception: a private throwaway copy of THIS
corpus, seeded with the one state a test needs, deleted afterwards. e2e/seeds.ts holds the seeds,
each named and each carrying its own measurement; a spec declares what it needs on its first line,
which is the thing the fixture hid. e2e/scratch-seeds.spec.ts is the gate on the machinery AND on
the promise: it snapshots every authored byte under .my_context/, builds and drives a fully seeded
copy, and requires the snapshot to be byte-identical afterwards. A second test there proves that
comparison can fail, by running it over a tree that really changed.

THIS IS NOT .demo-corpus RETURNING. The copy is of the live corpus - the same items, the same ids,
the same scale - and the seeds only turn budgets down, stage a proposal, draft an item, drift a
source file, or run the real hooks. There is still one answer to "what is the app looking at".

WHAT IS LEFT, NAMED RATHER THAN COUNTED. Of the 34 that remain on chromium and the 32 on Chrome, none is a spec still
leaning on the retired fixture. They divide as: five on the Conversations screen, which draws two
filter cards and two find boxes and so breaks every strict-mode locator on it; one on
screen-parity and one on tree-parity, which are port/101; one on runs, because the app has a `gaps`
screen the mockup's rail does not list; one on rules-maintenance, which is a lane's own subject;
and the rest are LOAD failures - "never settled", "did not measure every screen it walked" - which
this suite's own messages already tell a reader to re-run alone.

ONE OF THEM IS CORPUS STATE AND IS NOT REPAIRED HERE, and it is worth naming because it is the same
shape as the four above: the preview's DEFAULT question is WARM, and on this repository the default
session is the one the run is part of, which has already been delivered everything - so the ribbon
draws no segment, and `app-layout` and `chip-hue-authority` have nothing to measure a segment's look
against. The seed that would answer it is squeeze-inject-restore: deliver under a small budget, then
put the budget back, so a session has genuinely seen part of a corpus that now offers more. It is
not done here because both files are about the shell AT REAL SCALE and are already the two most
load-sensitive in the suite.

AND ONE THE RETURN FOUND IN THE PRODUCT, which is what the return is for.
`mycontext lesson-accept` CREATES a rule and therefore meets the contradiction gate, and on a corpus
of 1,086 items that gate is lexical enough to find a neighbour for anything - three completely
different candidate texts were each refused against a different item, one of them about gardening.
The refusal names the settlement, `--distinct <id>`, and `lesson-accept` does not take it
(`command-flags.ts` allows it only --title, --scope, --severity and --directive), nor does the
Composer screen offer any control for settling one. So a staged candidate this corpus objects to
cannot be accepted by any route a person has. `composer-write-execute.spec.ts`'s lesson-accept entry
is red on that and is left red.

AND A SECOND. `doctor-outcome.spec.ts` reports TWO rows carrying one `data-cmdkey` after an
Execute-driven refresh, while `/api/doctor` answers no duplicate (item, code) pair at all - measured
both ways, 82 findings live and 93 on a twin, zero duplicates in either. The duplication is the
SCREEN's, and it is the same shape as the two-renders defect `preview-overlap.spec.ts` was written
for.
