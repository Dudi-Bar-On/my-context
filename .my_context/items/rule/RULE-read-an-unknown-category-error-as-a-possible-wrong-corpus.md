---
id: RULE-read-an-unknown-category-error-as-a-possible-wrong-corpus
type: rule
title: Read an unknown-category error as a possible wrong-corpus error before rewriting the flag
status: active
severity: soft
always: false
summary: When a tool rejects a name as unknown, check that you are pointed at the right place before assuming you spelled it wrong; one message means both.
summary_of: 3fe8dca0e1e86f38
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 639e73cd893db3da
directive: do
---

# Read an unknown-category error as a possible wrong-corpus error before rewriting the flag

Categories are per-corpus configuration, so a category name that is valid in one corpus is invalid in another. The refusal names the accepted list and never names the corpus it consulted, which makes one message carry two meanings: the name is misspelled, or the command is pointed at a corpus that does not define it. Check which .my_context answered before changing the spelling of the flag.

## Relations
- derived_from [[LESSON-run-mycontext-against-this-repository-s-corpus-from-the]]
