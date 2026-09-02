---
id: DEC-foreign-store-never-leaves-the-repository-so-the-question-of
type: decision
title: foreign_store never leaves the repository, so the question of where it may look is dissolved
status: active
severity: soft
always: false
summary: That check only looks inside the project and never at the rest of your machine, so there is no question of what it may read outside.
summary_of: d9222264807201ae
scope: []
tags:
  - v2
  - owner-ruling
  - security
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-26
valid_until: null
checksum: 2e6b0d9aceb0722e
---

# foreign_store never leaves the repository, so the question of where it may look is dissolved

OWNER RULING, 2026-08-26, closing `OPENQ-where-may-foreign-store-look-given-it-reads-outside-the`.

THE CHECK IS BUILT WITH ITS IN-REPO ROW ONLY. `docs/solutions/` -- another plugin writing durable learnings inside this repository -- is reported at `info`. The `~/.gsd/knowledge/` row the mockup also drew is DROPPED.

WHY THAT DISSOLVES THE QUESTION RATHER THAN ANSWERING IT. The open question asked what a check may read OUTSIDE the repository, and weighed three answers: a hard-coded list that goes stale, a configured list nobody fills in, and a scan that surprises people. With the home-directory row dropped the check never leaves the repository at all, so none of the three has to be chosen. `test/core/real-home-guard.test.ts` has nothing to guard here because nothing here can reach a home directory.

AND THE PROVENANCE IS WHY DROPPING IT WAS EASY. The whole of `foreign_store` came from two rows drawn in the mockup and marked PROPOSED -- no requirement, no lesson, no incident. The in-repo row answers a question nothing else asks and costs one `statSync`; the home-directory row was a guess at one specific other plugin. Keeping the first and dropping the second keeps the value and removes the surface.

IF A SECOND STORE EVER NEEDS NAMING, `FOREIGN_STORE_DIRS` is a one-line addition and the question reopens on evidence rather than on a drawing.

## Relations
- supersedes [[OPENQ-where-may-foreign-store-look-given-it-reads-outside-the]]
