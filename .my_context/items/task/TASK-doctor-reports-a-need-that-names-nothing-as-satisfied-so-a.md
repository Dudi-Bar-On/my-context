---
id: TASK-doctor-reports-a-need-that-names-nothing-as-satisfied-so-a
type: task
title: doctor reports a need that names nothing as satisfied, so a blocker no item answers reads as landed
status: active
severity: soft
always: false
summary: The blocker doctor said had landed really had landed, so the report was correct, and nothing in the corpus points at a task that does not exist.
summary_of: 1f885d4d9d194c6c
summary_was:
  - 2026-09-04 A needs entry pointing at an id that does not exist is reported as done rather than as naming nothing.
scope:
  - src/doctor/checks.ts
  - src/core/needs.ts
tags:
  - v2
  - doctor
  - needs
  - "plan:rulings"
  - "seq:60"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-04
valid_until: null
checksum: 001296580c63df74
plan: rulings
seq: "60"
state: done
priority: "1"
verified_on: 2026-09-04
---

# doctor reports a need that names nothing as satisfied, so a blocker no item answers reads as landed

Measured 2026-09-04 on the live corpus. TASK-make-mycontext-autonomous-from-the-first-second
sits at state blocked and names needs: hooks/16b. No item in this corpus carries seq 16b. Doctor
nevertheless reports, in its own words, that everything it waits on has landed and hooks/16b is
done, and asks the owner to move the task.

Nothing is done, because nothing is there. A reference to an item that does not exist is being
read as a satisfied one.

This is the same class of defect as the parity check that reported a command as wrapped by a
tool that did not wrap it, fixed the same day. A check that over-reports is worse than a missing
check, because it manufactures confidence in the exact place a person looks to find trouble.
Here it would have had the owner unblock a task whose blocker never shipped, and the failure
would surface much later as work that was started on ground that was not finished.

Establish before fixing: does resolution fail to find the id and default to satisfied, or does it
match loosely and land on the wrong item? A nearby item carries seq 16 and is at state doing, so
a prefix or fuzzy match would explain the report just as well as a not-found default, and the two
need different fixes. Say which it is with evidence.

What must be true at the end. A need naming an id that does not resolve is reported AS THAT, in
its own words, and never as satisfied. It is a defect in the item that names it rather than in
the item it names, so the finding belongs against the task carrying the dangling need, and the
remedy is to correct or remove the reference.

Read the general rule above the Finding interface in checks.ts before writing it: a check reports
a finding only when a person could do something about it. This one qualifies, because a person
can fix the reference. Doctor stands at 0 errors and the one warning that remains is this very
case, so the fix should end with the dangling reference reported honestly rather than with the
count going quiet.

INVESTIGATED 2026-09-04: the premise does not hold.

Checked directly against src/core/needs.ts (buildTaskIndex, refStatus) and the live corpus.
hooks/16b resolves - exactly, not loosely - to
TASK-readme-section-8-still-owes-the-sentence-that-the-id-is-not, which carries plan: hooks,
seq: 16b, state: done, verified_on: 2026-09-04. Resolution is a Map.get on the exact lowercased
plan/seq key; there is no prefix or fuzzy match anywhere in refStatus or buildTaskIndex, and no
default-to-satisfied path when a key is absent - refStatus returns unresolved in that case, never
satisfied.

The evidence this task opened with - grep -l 'seq: "16b"' returning nothing - was a false
negative from the grep pattern, not a gap in the corpus. This project's serializer only quotes an
extra value that would otherwise parse ambiguously (seq: "22", a bare-digit string YAML would
otherwise read as a number); seq: 16b is written unquoted because it already parses unambiguously
as a string. The quoted-form grep therefore misses every alphanumeric seq value, 16b included. A
grep for the unquoted form finds it in two files:
TASK-carry-the-mockup-s-screen-level-css-into-styles-css-or-the.md (ui1/16b, unrelated) and
TASK-readme-section-8-still-owes-the-sentence-that-the-id-is-not.md (hooks/16b, the one this task
names).

Doctor's line - "hooks/16b is done" - is therefore honest, not a false positive. Neither of the
two hypothesized causes applies: resolution neither defaults to satisfied on a miss nor matches
loosely; it found the real, done item the reference names.

Corpus-wide check for OTHER dangling needs: doctor reports zero needs_unresolved and zero
needs_malformed findings anywhere in the current corpus (mycontext doctor, full output, grep for
both codes, empty). A measured zero.

No change made to src/doctor/checks.ts or src/core/needs.ts. Existing tests already cover the
distinction this task asked about: test/doctor/task-needs.test.ts, "an unresolvable reference is
an INFO note, never an error - and never blocks", uses a reference (the/45) that genuinely
resolves to nothing and asserts needs_unresolved rather than blocked_needs_met; the seq:8 case in
the same file covers a genuine landing read as blocked_needs_met. The mechanism the two
hypotheses describe does not exist in this codebase; adding code to guard against it would be an
untested branch for a defect this corpus does not have.

No fix was written, so there is no red/green pair to show: TDD applies to a defect this
investigation would have to reproduce first, and it does not reproduce.

npx tsc --noEmit: 0 errors, against the unmodified tree.

npm test: run twice, and the two runs disagree with each other, which is the tell. Run 1
completed (exit 0) and named exactly three failures, all in test/ui/ -
test/ui/coverage-screen.test.ts ("no translated string is assigned"),
test/ui/live-invalidation.test.ts ("app.js routes 21 screens", found 20) and
test/ui/live-invalidation.test.ts ("SCREEN_INVALIDATION declares no screen app.js does not
route", found a stray "gaps"). Run 2, minutes later, completed (exit 0) with 6335 tests, 6333
pass, 0 fail, 2 skipped - 16 FEWER tests total than the stated baseline of 6351, and none of
run 1's three failures. That is not flake in the statusline-chain sense; it is the live
UI-rebuild lane (out of this task's scope by instruction - src/ui/**, e2e/**, test/ui/**) editing
files those two suites read while both runs were in flight, so the file on disk at read time
differed between them. Nothing under src/doctor/checks.ts or src/core/needs.ts was opened for
writing in this investigation, so neither run's result is a regression from anything done here.
`Get-CimInstance Win32_Process` also showed two independent `node --test` trees alive at once
during the second run's long stall partway through, each spawning `--test-isolation=process`
children for the same suite - lock contention on the shared live corpus, not a defect in the
change under investigation, because there is no change.
