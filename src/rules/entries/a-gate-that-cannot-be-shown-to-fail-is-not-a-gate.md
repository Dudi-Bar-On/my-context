---
id: a-gate-that-cannot-be-shown-to-fail-is-not-a-gate
kind: standard
tier: developer
title: a gate is not wired until somebody has broken the thing it guards and watched it go red there
trigger: adding a check, wiring one into CI or a hook, or claiming a guarantee is enforced
shape: two separate proofs, and a gate needs both — that the CHECKER works (break its subject, run the checker, see it exit non-zero) and that the checker RUNS (break its subject, run the pipeline the way the machine will, see the pipeline go red at that step). A check with only the first is a script; a step with only the second is a ritual
example: "on 2026-09-13 every one of this project's gates had a test proving the checker works and NONE proving the checker is run — four of them were in no workflow at all, one exited 1 on master while appearing only in the release job, so every tag cut failed at a gate no pull request exercised"
check: "detective:test/scripts/workflow-gates.test.ts — asserts wiring only: that each gate appears in the workflows and the hook that must run it, and that a gate deliberately excluded carries its recorded reason beside it"
request: do we have more lessons we learned today and yesterday that worth putting in the store as part of the product ?
---

**Four of the twelve blockers found by six independent reviews would have been caught by gates
that already existed.** They existed, they worked, and nothing ran them.

There are **three ways a gate can be green over red**, and they are separate defects that look
identical from the outside:

1. **UNWIRED** — the checker is correct and no pipeline invokes it.
2. **VACUOUS** — the pipeline invokes it and it cannot fail. `test/ui/icon-sprite.test.ts` scanned
   a file with a regex matching neither of the two strings in it, so its assertion was
   `deepEqual([], [])` — green forever, over the wrong file.
3. **REPORT-ONLY** — it runs, it can fail, and its failure is not a failure. A `continue-on-error`
   step, or a check whose non-zero exits are all anti-vacuity guards rather than findings.

**Wiring an unwired gate non-blocking converts it into the third kind.** That is the same family,
one door over, and it is why a red gate is fixed before it is wired rather than wired quietly.

And the converse is a real answer: **`check:cited-items` was deliberately NOT wired**, because its
only non-zero exits are anti-vacuity guards and its own source says so. A commit excluded it on the
record — *"a never-gating check there prints 224 lines into a green log and manufactures the
appearance of coverage."* **A gate that cannot go red does not belong in a pipeline, and its
absence needs the reason recorded beside it** or the next reader will helpfully add it.

One corollary, learned the same day: **an uninstalled hook is itself a gate wired to nothing**, and
**a gate carried only by a hook is gated by each developer's local configuration, which is not
gating.** Everything a hook enforces must also run in CI; the hook buys speed, never safety.
