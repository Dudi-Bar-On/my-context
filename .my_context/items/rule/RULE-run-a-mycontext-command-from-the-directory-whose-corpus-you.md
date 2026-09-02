---
id: RULE-run-a-mycontext-command-from-the-directory-whose-corpus-you
type: rule
title: Run a mycontext command from the directory whose corpus you mean to read
status: active
severity: hard
always: false
summary: Run the tool from inside the project whose records you mean to read; from the wrong folder it will answer confidently about a different project.
summary_of: 6f859b1e0890ab74
scope: []
tags: []
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 4312cd0d47fbdf71
directive: do
---

# Run a mycontext command from the directory whose corpus you mean to read

Corpus resolution walks up from the working directory and stops at the first .my_context it finds. A repository that vendors another mycontext-bearing checkout therefore contains two corpora, and the working directory alone decides which one answers. Nothing in the output names the corpus that was opened, so a query can succeed against the wrong one and report a board, a rule set or a count that belongs to a different project.

## Relations
- derived_from [[LESSON-run-mycontext-against-this-repository-s-corpus-from-the]]
