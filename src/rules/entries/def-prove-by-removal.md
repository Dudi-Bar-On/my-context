---
id: def-prove-by-removal
kind: definition
tier: developer
title: proving by removal breaks the line an assertion rests on and watches that assertion go red
term: prove by removal
means: proving one assertion by BREAKING exactly the line it rests on, watching THAT assertion go red — identified by the failing stack’s line number, not by the test’s name — and then writing the original bytes back. One mutation per assertion, and where an earlier assertion masks the target, that one is neutralised too.
confusedWith: running the test and watching it pass, and planting an impossible value. A green run proves the test agrees with the code; removal proves what the test RESTS on. A planted sentinel tells you the test ran at all, which is the different question you ask when a removal comes back green.
example: on 2026-09-10 a harness reported the `test(...)` declaration line for helper-wrapped tests, so three separate mutations all looked like one line and the lane believed it had proved one assertion three times.
check: "none - the archive can see whether a lane REPORTED a removal-proof table; it cannot see whether the mutation was taken, and those are different facts. The measurable half is the weaker half, so a detective check here would overstate what is enforced. Nearest enforcement: RULE-a-regression-test-is-worth-nothing-until-you-have-watched-it."
---

The discipline exists because of what it keeps catching. Seven of eight lanes on 2026-09-10 found
at least one of their own assertions staying GREEN under removal; twelve in total. **An assertion
that stays green is a finding, not a pass** — it is reported and replaced.

The commonest cause, by a distance, is asserting a substring that some OTHER part of the output
also contains. The remedy is to assert on structure.

Never revert a mutation with git. A lane ran `git checkout -- <file>` on 2026-09-10 to undo a
hand-applied mutation and destroyed its own phase’s work on that file; the way back is to write
the original bytes.
