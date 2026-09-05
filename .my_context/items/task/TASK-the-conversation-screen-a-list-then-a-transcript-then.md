---
id: TASK-the-conversation-screen-a-list-then-a-transcript-then
type: task
title: "the conversation screen: a list, then a transcript, then folding and search"
status: active
severity: soft
always: false
summary: The screen that lists conversations and renders one, with prompts distinguished from answers.
summary_of: 512cc4daee46ad77
scope:
  - src/ui/public/screens/**
  - src/ui/public/strings/**
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:3"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 1ba4b2b62073e634
plan: archive
seq: "3"
state: todo
priority: "2"
---

# the conversation screen: a list, then a transcript, then folding and search

Step 3 of five in docs/superpowers/specs/2026-09-04-conversation-archive-design.md. Depends on the endpoints.

The owner asked for prompts to be visually distinguishable from answers and output - that is
the whole point of rendering rather than dumping a file - and for browsing and retrieval to
be a web feature rather than a terminal one.

Titles come from the transcript’s own aiTitle, shown as what it is, written by the model, and
overridable. The first prompt was considered and rejected as a title because first prompts
are routinely continue or ok go ahead, which names nothing.

Build it in the order the spec gives - list, then transcript view, then folding and search -
so each step is usable before the next begins.

It is a screen, so everything screens owe applies: both languages with every string keyed,
the shared circled question mark for depth rather than a rival, a measured zero drawn and
named, keyboard reachable, and verified in a browser as a person uses it.
