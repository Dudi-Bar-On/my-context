---
id: LESSON-neither-readme-fits-in-a-snapshot-so-the-corpus-s-record-of
type: lesson
title: neither README fits in a snapshot, so the corpus's record of a watched document is not a copy of it
status: active
severity: soft
always: false
summary: Both readmes are far past the snapshot size limit, so the corpus records where a document is rather than holding a copy of it.
summary_of: 17e5477a39b3d94a
scope:
  - README.md
  - docs/README.he.md
  - src/core/reference.ts
  - src/doctor/checks.ts
tags:
  - v2
  - docs
  - corpus
  - "plan:docsys"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: d49f1e8d92a68c5d
---

# neither README fits in a snapshot, so the corpus's record of a watched document is not a copy of it

MEASURED 2026-09-05 while carrying out `docsys/4`, which was written to "copy the readmes under
the corpus if that is what it takes" per `REQ-a-repository-document-is-viewable-in-the-ui-only-once-it-is`.

THE MEASUREMENT. `readSnapshot` (src/core/reference.ts) refuses both files:
`README.md` is 435,749 bytes and `docs/README.he.md` is 579,601 bytes, against a
`SNAPSHOT_MAX_BYTES` of 262,144. Neither can be a `reference` snapshot, and the cap's own stated
reason applies exactly here rather than incidentally: a snapshot is re-read and re-parsed by every
command that rebuilds the index, so a 1 MB pair of them would slow `list`, `status` and `doctor`
for as long as the items existed. This project also retiers `reference` to the NORMATIVE tier in
its own config.json, so a copy of either README would additionally have become injectable
governing text.

SO THE RECORD IS NOT A COPY. The corpus's record of a watched document is the pair
(`watchedDocs` membership, a manifest entry served fresh off disk by `GET /api/doc/:id`), and
`apiDoc` re-reads the file on every request. That is a stronger guarantee than a refreshed copy
rather than a weaker one: the only thing that can be silently stale is a copy, and there is none.

AND THE GAP THAT REPLACES IT. The two boundaries were decided eleven days apart and nothing
measured that the narrow one fits inside the wide one — `watchedDocs` says which documents the
corpus CLAIMS, `isServableDocPath` says which a reader can OPEN. A glob widened past the route
would put a document in the corpus and out of every reader's reach, silently. `doctor`'s
`watched_doc_unserved` is what now reports that, and reads zero on this repository today.

WHAT WOULD HAVE TO CHANGE to take the copy route after all: an owner ruling raising
`SNAPSHOT_MAX_BYTES` past 566 KiB, which is a decision about how fast every command runs and not
a detail of the documentation system. Recorded here so it is a ruling somebody makes rather than a
constant somebody edits.
