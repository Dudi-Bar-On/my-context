---
id: def-known-red
kind: definition
tier: developer
title: known-red means already failing at HEAD, counted, and recorded with a reason
term: known-red
means: "a test or gate that was ALREADY failing before your change — verified at HEAD, counted, and recorded with the reason it is red. The point of the label is the count: if the baseline is eleven, any twelfth failure is yours."
confusedWith: a flaky test, and a failure you may ignore. A flaky test fails sometimes and is a defect of the test; a known-red fails deterministically and is a defect somebody has named. And known-red is a MEASUREMENT, not a permission — the label without a reason attached is what lets a lane work around a gate instead of reading it.
example: archive/47’s lane recorded four separate lanes working around a red gate because it was labelled "known-red" with no reason attached.
check: none - nothing can tell a pre-existing failure from a new one except running the suite at HEAD, which is a thing a lane does rather than a thing a gate observes. The nearest enforcement is RULE-run-a-gate-the-way-the-project-runs-it-never-through-an, which stops the count itself being read through a pipe.
---

The claim "known-red" is a claim about the baseline, so it is worth exactly what the baseline
measurement is worth. Stated properly it reads like this, from the campaign handover:

> `node harness/baseline.mjs` → `failed: 11  known-red: 11`. 2308 pass / 11 known-red. Any twelfth
> failure is ours.

That is a number somebody else can re-derive. "It was already failing" is not.
