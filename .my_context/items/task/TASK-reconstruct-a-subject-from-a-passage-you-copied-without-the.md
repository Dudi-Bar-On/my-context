---
id: TASK-reconstruct-a-subject-from-a-passage-you-copied-without-the
type: task
title: reconstruct a subject from a passage you copied, without the noise reaching your context
status: active
severity: soft
always: false
summary: Copy something from the viewer and get back a short, cited account of it, checked against the code and the history.
summary_of: 32d5d24a22fa106f
scope:
  - src/core/retrieval/**
  - src/ui/**
  - .gitignore
  - test/**
  - e2e/**
tags:
  - v2
  - recall
  - "plan:recall"
  - "seq:2"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-10
valid_until: null
checksum: c0e9d5567cbc6c25
plan: recall
seq: "2"
state: todo
priority: "1"
needs: recall/1
---

# reconstruct a subject from a passage you copied, without the noise reaching your context

D42 PHASE 2. Plan: docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md Tasks 6-12. Design: docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md sections 3, 4, 5, 6, 8, 9, 10.

THE PRIMARY WAY IN IS A PASSAGE HE COPIED. A selection is not a guess at the subject - it IS the
subject. And it works because a passage worth copying is dense in NAMES: as FTS5 queries, item-id
slugs matched 68% where headings matched 4%.

RETRIEVAL NEVER WRITES INTO THE LIVE CONTEXT. It writes a MISSION for a subagent that reads in a
fresh window, verifies against the CODEBASE AND GIT rather than the corpus - a ruling can stand in
the corpus while the code that implemented it was reverted weeks ago - pulls complementary detail
out of code and documents, and returns something small, chronological and CITED.

IT MUST CITE, because the distilling subagent is itself a model and can be confidently wrong. Every
claim points at a turn, a commit, or a file and line, so the result is verifiable rather than
trusted - and a result whose citations no longer resolve can SAY it has aged.

TWO BOUNDARIES THAT CANNOT BE GOT WRONG. Result files are GITIGNORED: they hold conversation text,
and his ruling is that conversation files stay out of git. And NOTHING reaches his context until he
chooses it - then dated, marked a record, and a superseded ruling says so on arrival.

Noise reuses the document’s own said/work/deed classification plus his repeat rule. Do NOT build a
lexical noise classifier: punctuation density measured AUC 0.499, a coin flip. Do NOT build MinHash
or LSH: an exact 8-gram index found 60 pairs in 629ms against 4,065ms, and brute force over
3,136,260 pairs took 20ms.
