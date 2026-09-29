---
id: TASK-review-4-audit-all-39-skills-against-the-contract-and-rule
type: task
title: "review 4: audit all 39 skills against the contract, and rule on the shape"
status: deprecated
severity: soft
always: false
summary: Judge every skill already written against that standard, and decide whether the set is the right shape or several things wearing one name.
summary_of: 18f6599c76fd0b49
scope: []
tags:
  - "plan:review"
  - "seq:4"
  - "state:todo"
  - v2
  - review
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: 2026-09-22
checksum: d4f07418da697784
plan: review
seq: "4"
state: todo
priority: "2"
needs: review/3
---

# review 4: audit all 39 skills against the contract, and rule on the shape

Follows review 3.

For each of the 39 skills: does it earn being a separate skill, is its description the thing that makes it fire correctly, is it the right size, and does it duplicate another. Report per skill, then rule on the **shape of the set** — 39 may be right, or may be several skills wearing one name each.

`test/plugin-assets.test.ts` resolves the skills and its doc comment records a past install run. That comment is already stale about the hook count, so treat it as a record rather than as a fact.

Ruling 34 handles the deny-list staleness separately; do not duplicate it here.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, after seq:3. Nothing supersedes it and no other task in the corpus looks at the skills at all. Worth noting for whoever runs it: the skills are one of the two documents plan:rulings seq:48 found unprotected by verify:citations, alongside both READMEs -- so any claim a skill makes about a command is currently unchecked by anything.

Retired 2026-09-22 (release phase 2, owner ruling H, runbook §7.2): there is one skill; the 39 no longer exist.
