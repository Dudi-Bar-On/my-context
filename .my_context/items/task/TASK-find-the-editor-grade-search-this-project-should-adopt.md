---
id: TASK-find-the-editor-grade-search-this-project-should-adopt
type: task
title: find the editor-grade search this project should adopt rather than write, and say what taking it would really cost
status: active
severity: soft
always: false
summary: Research which existing open-source search library or UI component could give the viewer a proper editor-style find, and what adopting one would cost.
summary_of: 5ae54c7f19ea01b7
scope:
  - src/core/conversation-search.ts
  - src/ui/public/screens/conversations.js
  - package.json
tags:
  - v2
  - recall
  - search
  - "plan:semantic"
  - "seq:6"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: 61e9038d84c3bc32
plan: semantic
seq: "6"
state: todo
priority: "1"
---

# find the editor-grade search this project should adopt rather than write, and say what taking it would really cost

THE OWNER RULED TWICE ON 2026-09-16, and the second reverses the first.

FIRST he ruled semantic search in, over `claude -p`. THEN lane AG measured it and he ruled it OUT: "ok so discard semantic search by using claude -p, agree it is bad idea, but you must find the best flexible way to implement smart and complex searches on a text file exactly as good editors do, so what i suggest is do a deep research over open source packages available in node if ui component exists it's an advantage and let's use such a solution without much effort."

WHAT HE IS ASKING FOR IS NOT WHAT THE LAST TWO RESEARCH PASSES ANSWERED. `semantic/2` asked which FEATURES to build and lane AC answered it well. This asks whether the thing should be WRITTEN HERE AT ALL, and the words "without much effort" and "if ui component exists it's an advantage" are the whole brief: he would rather adopt than author.

AND IT COLLIDES HEAD-ON WITH `CONST-zero-runtime-dependencies`, WHICH IS HARD. `dependencies` is empty and that emptiness is what makes this plugin install with no fetch and start in tens of milliseconds. Lane AC already surveyed the packages and recommended none FOR THAT REASON - so the survey is not what is missing. What is missing is the COST, stated plainly enough that the owner can decide whether to relax his own constraint. That decision is his and no lane may take it.

TWO SURFACES, AND THEY ARE DIFFERENT PROBLEMS. Every time he has said 'like Notepad++' he has been describing FIND IN THE DOCUMENT I AM READING - incremental, highlight-all, next/previous, whole word, case, regex, a count. That is an editor problem and editors have solved it. The other surface is SEARCH THE WHOLE ARCHIVE, which is 122 MB of transcripts behind a SQLite FTS5 index, and an in-memory library is a different proposition at that size. A recommendation that does not separate the two is not usable.
