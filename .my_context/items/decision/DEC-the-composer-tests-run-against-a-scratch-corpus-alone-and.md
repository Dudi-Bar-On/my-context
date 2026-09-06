---
id: DEC-the-composer-tests-run-against-a-scratch-corpus-alone-and
type: decision
title: the composer tests run against a scratch corpus, alone, and never against the real one
status: active
severity: soft
always: false
summary: The tests that execute real commands build their own throwaway workspace, and nothing else runs while they do.
summary_of: ec89afe7fe4a31c3
scope: []
tags:
  - v2
  - testing
  - composer
  - corpus
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 8fdd9e1f8087f466
---

# the composer tests run against a scratch corpus, alone, and never against the real one

Owner ruling 2026-09-06 (plan D12). He offered two shapes and asked me to choose, with one
constraint that decides it: "just keep our corpus and development process clean and not
contaminated". He also named the safeguard himself - "ensure nothing is running in parallel to
the tests".

CHOSEN: a scratch corpus, created and destroyed per run.

WHY NOT THE OTHER SHAPE, which was to run against the real corpus and supersede or retire what
was added. It is not clean; it is contamination with a label on it. Superseding leaves the
superseded item, the supersede relation, the mutation records and the audit rows in the corpus
permanently, and every one of them is real data a later reader has to discount by hand.

AND SOME OF IT CANNOT BE RETIRED AT ALL. 19 of the 30 catalogue entries are writes, and supersede
only answers for items. `rebuild` rewrites the index, `repair` re-stamps checksums, and `config`
writes config.json - none of those has an inverse. A run that fails halfway leaves debris nothing
can undo, on the corpus this project dogfoods.

THE MACHINERY IS ALREADY PROVEN HERE, which is what makes the scratch answer cheap. The hook and
CLI suites already build a real workspace with mkdtemp and runCli(["init"]) and throw it away;
test/ui/execute-budgets-route.test.ts and the handover tests do exactly this. So this is the
established pattern rather than a new one invented for D12.

HIS SAFEGUARD IS PROMOTED TO A REQUIREMENT: D12 RUNS ALONE. No other lane in flight while it
executes. Two collisions happened on 2026-09-05 and 2026-09-06 with far less at stake - a worker
ran `git checkout -- .` and reverted three corpus edits, and a second worker’s styles.css change
was swept into another lane’s commit. A test plan that executes 19 write commands is not the
thing to discover a third one with.

WHAT THE SCRATCH CORPUS MUST NOT LOSE, and it is the honest cost of this choice: the real corpus
has 936 items and a real audit log, and a defect that only appears at that scale will not appear
in a fresh workspace. Where a test genuinely needs scale, it seeds it deliberately and says so,
rather than reaching for the live corpus.
