---
id: TASK-readme-still-says-there-is-no-export-command-and-that-is-now
type: task
title: README still says there is no export command, and that is now false
status: active
severity: soft
always: false
summary: The main guide still says a feature does not exist, weeks after it shipped, and the same false claim survives in a second place.
summary_of: 4d91e883d2adce37
scope: []
tags:
  - "plan:export"
  - "seq:13r"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: b03435ef4b23c6a7
plan: export
seq: 13r
state: done
priority: "1"
---

# README still says there is no export command, and that is now false

The 'Decided for v2.0 and not built' callout - English near line 2484 and its Hebrew mirror - says there is no export command in this release and nothing in the log travels today. mycontext export shipped, and pack import carries a stranger's history into .audit/imported/. Both halves are false now.

The export 13 agent left it alone deliberately and correctly: the plan assigns that flip to Task 17, explicitly and with its own instructions.

Recording it because the sentence has changed character. It was a forward-looking note; it is now a live falsehood sitting in the most-read document in the repository, and Task 17 is not scheduled yet.

CONFIRMED with a real run, 2026-08-23.

README.md:2600 reads "this is built: there is no export command in this release, and nothing in the log travels". Ran `mycontext export --dry-run` against the live corpus: 325 items, 856 mutation records, exit 0, nothing written. Both halves of that sentence are false.

Related and already corrected on the same day: the audit-travel prose this task shares with plan:export seq:17 said three audit kinds are withheld from an export. There are five - `access` and `progress` both landed after that sentence was written. The mockup and both string tables now say five, and the read model derives the list from AUDIT_KINDS so it cannot drift again. Whoever takes seq:17 should know the endpoint is now the authority on that count.

VERIFIED PARTIAL 2026-08-26. The sentence this task names IS gone from both READMEs, and both now document `mycontext export` (README.md:3572, docs/README.he.md:3187). But a SAME-FAMILY FALSEHOOD SURVIVES IN BOTH: README.md:5666 still says a corpus export carrying the mutation half of the log is "decided and not built" — mirrored at docs/README.he.md:6143 - and README.md:3572 contradicts it in the same document. The task is not done until that sentence goes too.
