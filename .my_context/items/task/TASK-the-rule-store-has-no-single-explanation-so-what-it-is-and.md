---
id: TASK-the-rule-store-has-no-single-explanation-so-what-it-is-and
type: task
title: the rule store has no single explanation, so what it is and how it is managed lives only in a conversation
status: active
severity: soft
always: false
summary: "Write one Hebrew document explaining the rule store: what it is, what it holds, how it works and how we look after it."
summary_of: bb2ef1b43673b705
scope:
  - docs/**
  - src/rules/**
tags:
  - v2
  - docs
  - rules
  - he
  - "plan:rulings"
  - "seq:94"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-16
valid_until: null
checksum: 77a758e0fb376ba6
plan: rulings
seq: "94"
state: done
priority: "1"
---

# the rule store has no single explanation, so what it is and how it is managed lives only in a conversation

THE OWNER ASKED FOR IT, 2026-09-16, and framed it as two things at once: a document he wants, and a TEST of whether a whole subject can be captured out of a conversation.

His words: "go over the conversation from the begining, only from it if you find a document that you need to read go and read it, if you find that you need to read a subagent transcript go read it, the Goal is to generate an enhanced document in hebrew which explains in simple words what is the store, what it's fucntionalities and capabilities, what does it contains now, how it works all the mechanism, how we manage it and it's content - all in a single document".

WHICH STORE. The rule store - `src/rules/entries/` - and not the corpus and not the index. The project's own vocabulary settles it: `def-the-corpus` names its confusable as "the index, and this store", and the owner's own past words are recorded verbatim in the entries' `request:` fields - "worth putting in the store as part of the product".

WHY IT IS WORTH HAVING. The store is the one thing this product ships that OUTRANKS every other source in a consuming session, and there is no single place that explains it. What exists is scattered: a definition entry, a manifest, an integrity module, a CLI command, a tier system, and a day's worth of defects found in conversation. A reader who installs this plugin meets the store's output without ever meeting the store.

AND THE TEST MATTERS AS MUCH AS THE DOCUMENT. He wants to know how well a conversation serves as a source for capturing a subject. So whatever is produced must also report on THAT: what the conversation gave, what it could not, and what had to be read from the code instead.
