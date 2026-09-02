---
id: OPENQ-where-may-foreign-store-look-given-it-reads-outside-the
type: open_question
title: where may foreign_store look, given it reads outside the repository
status: superseded
severity: soft
always: false
summary: An unsettled question about which directories outside the project a diagnostic check may scan when looking for knowledge stores kept by other tools.
summary_of: 6b9b748931312266
scope: []
tags:
  - v2
  - ui
  - "screen:doctor"
  - doctor
  - security
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: 2026-08-26
checksum: 27b2b4359dfe4bf1
blocks: "plan:walk seq:19, the foreign_store check"
---

# where may foreign_store look, given it reads outside the repository

Raised 2026-08-25 with the ruling that `foreign_store` becomes a real check.

Every other doctor check reads the corpus or the repository. This one reads NEITHER: the mockup s own two rows name `~/.gsd/knowledge/` -- a path in the user s home directory -- and `docs/solutions/`, a directory belonging to another plugin.

THE QUESTION: what is it allowed to read, and how does it know where to look?

WHAT MAKES THIS THE OWNER S: a diagnostic that scans a home directory is a different KIND of thing from one that reads `.my_context/`. It can surprise a user, it can be slow, and on a shared machine it can see paths that are not the user s business. A hard-coded list of known stores is predictable and goes stale; a configured list is honest and needs someone to write it; a scan is thorough and is the one that surprises people.

RELATED, AND NOT THE SAME QUESTION: `test/core/real-home-guard.test.ts` exists because this project already had to stop code touching a real home directory. Whatever is decided must be testable without a test reaching one.

BLOCKS: plan:walk seq:19.

## Relations
- superseded_by [[DEC-foreign-store-never-leaves-the-repository-so-the-question-of]]
