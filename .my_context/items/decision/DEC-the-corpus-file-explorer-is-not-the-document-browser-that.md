---
id: DEC-the-corpus-file-explorer-is-not-the-document-browser-that
type: decision
title: the corpus file explorer is not the document browser that was rejected
status: active
severity: soft
always: false
summary: A file explorer over the corpus is a different feature from the document list that was turned down, and is not a reversal of it.
summary_of: d2b4a0252d85fb7d
scope: []
tags:
  - v2
  - ui
  - library
  - corpus
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: f2e366c2c9896ccb
---

# the corpus file explorer is not the document browser that was rejected

Owner clarification 2026-09-06, given while ruling on the served-path boundary, and it prevents a
reasonable misreading of the record.

HIS WORDS: "when it was defined you already created on the screen a tree list of corpus files that
in conjuction to the readme files display was wrong especially the implementation but now it is a
new requirement that will use a special component for file exploring, that’s different".

WHAT WAS REJECTED, on 2026-09-05: a picker over all 190 manifest documents with a filter box and a
per-document heading index, on the Documentation screen ALONGSIDE the README rendering. It answered
"which documents exist", which nobody asked, and it was rejected on both its purpose and its
implementation. That rejection stands and is not reversed.

WHAT IS BEING BUILT NOW answers a different question: a FILE EXPLORER over the corpus, using a
dedicated external component, with genuine nesting, drill-down and return - reached from the
Library rather than mixed into a document reader. "Which file is where, and what is actually
written in it" is not "which documents exist", and the two should not share a fate because both
involve a list of files.

WHY THIS NEEDED SAYING. DEC-the-documentation-and-tutorials-screens-become-one-list-and cancelled
five items for being that browser. Anyone reading the record without this note would reasonably
conclude the new requirement re-opens a settled decision. It does not.
