---
id: TASK-a-conversation-is-rendered-as-a-document-who-spoke-when-and
type: task
title: "a conversation is rendered as a document: who spoke, when, and the machinery folded away"
status: active
severity: soft
always: false
summary: A saved conversation reads like a transcript of a discussion, with each speaker and time marked and the tool activity tucked out of the way.
summary_of: e13a04691c127f8a
scope:
  - src/ui/**
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:13"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: c8a1defd3a18fd75
plan: archive
seq: "13"
state: todo
priority: "1"
needs: archive/7
---

# a conversation is rendered as a document: who spoke, when, and the machinery folded away

Owner ruling 2026-09-08. He supplied the format by example rather than by description: the exported
conversation at "D:\Claude-Hermes agent self-improvement loop implementation-20260908-1025.md", and
asked that the archive render a conversation that way.

THE SHAPE, read off that file:
  - a heading per turn naming the speaker - "## User:" / "## Assistant:"
  - the timestamp on its own quoted line directly under the heading
  - TOOL ACTIVITY FOLDED INTO A QUOTED BLOCK, summarised rather than transcribed:
      > Fetched 5 pages, searched the web
      > - Hermes agent "nudge" interval config
      > - **Done**
  - the spoken content as ordinary prose below it, with its own headings intact
  - a horizontal rule between exchanges, and sources collected at the end

WHY IT IS BETTER THAN WHAT seq:7 SAYS TODAY. seq:7 asks for one continuous scrollable document with
markers for prompts and answers. This is that, made concrete - and the part it adds is the FOLDING:
the machinery is present but collapsed to one summarised line, so a reader sees the CONVERSATION and
can open the machinery when they want it. On his own session that is the difference between reading
2,119 turns and reading 26,673 records.

IT COMPOSES WITH seq:8 RATHER THAN COMPETING. This format is the DOCUMENT SKELETON - who spoke,
when, what is folded. seq:8 renders the CONTENT of a turn as the terminal showed it, with its
formatting and colour. Skeleton from here, cell content from there.

AND ONE THING TO CHECK BEFORE COPYING IT WHOLE: that file is an EXPORT, written once. A live viewer
is scrolled, searched and virtualised. Whatever of this format survives virtualised scrolling is what
to keep - a heading per turn survives, a horizontal rule between exchanges probably does, and
"sources collected at the end" is an export-only affordance that has no meaning in a scroll.
