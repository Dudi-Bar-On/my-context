---
id: TASK-a-selected-passage-copies-as-something-a-terminal-will
type: task
title: a selected passage copies as something a terminal will accept
status: active
severity: soft
always: false
summary: Selecting part of a conversation and copying it puts text on the clipboard that can be pasted somewhere else without carrying invisible formatting.
summary_of: 9fbdbf75c121bd80
scope:
  - src/ui/**
  - src/core/conversation-index.ts
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:17"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: b2521e17ca291e5f
plan: archive
seq: "17"
state: done
priority: "1"
needs: archive/13,archive/15
verified_on: 2026-09-10
---

# a selected passage copies as something a terminal will accept

Owner ruling 2026-09-08: he wants to mark a section and copy it for pasting into a context window,
and asked which source is right - the rendered browser text, or the raw session file.

THE ANSWER IS NEITHER, AND THE REASON IS SPECIFIC TO THIS PROJECT.

NOT THE RENDERED DOM. This UI deliberately inserts bidi control characters and isolation wrappers -
116 `dir` wrappers were added in one pass, and a Hebrew conversion removed 344 RLM marks and 249
non-breaking hyphens precisely because they had been pasted around. A DOM selection copies those
invisible characters into the clipboard, and they will travel into whatever he pastes into.
Whitespace is also a casualty: CSS collapses it, folded blocks are absent from the selection
entirely, and an ANSI-coloured span copies as text with its colour lost but its structure already
rewritten.

NOT THE RAW JSONL EITHER. A record is a JSON object with the text escaped inside it. Pasting that
gives him \n and \" and an envelope, not a conversation.

OWNER AMENDMENT, SAME DAY: "you can actually allow the user both formats for different purposes."
That is the better answer, and it makes it THREE rather than two - because the one that is best for
a terminal is neither of the two he named:

  1. MESSAGE TEXT - the record’s text with no JSON envelope and no presentation layer. THE DEFAULT,
     and the one he asked for: pasteable into a context window or a terminal. For a shell command
     it is the command exactly as it ran.
  2. RENDERED TEXT - what he can see, for pasting somewhere the visible form is the point. It
     carries the bidi marks named above, so it must SAY it is the rendered form.
  3. RAW RECORD - the JSONL exactly as created, for reproducing a bug or feeding a tool.

EACH IS NAMED BY WHAT IT IS FOR, not by its format. A menu offering "text / rendered / raw" makes a
reader guess; one offering "paste into a prompt / paste as it looks / the exact record" does not.

THE RIGHT DEFAULT IS THE THIRD THING: the MESSAGE TEXT taken from the record, without the JSON
envelope and without the browser’s presentation layer. For an assistant turn that is the markdown
as written. For a shell command it is the command exactly as it ran - which is what a terminal will
accept, and is the case he named.

THE HARD PART IS THE MAPPING, and it should be said now rather than discovered: a browser selection
is a DOM range, and the clipboard must be filled from the RECORD range it corresponds to. In a
VIRTUALISED document the rows around the selection may not even be in the DOM. That is the same
anchor problem as plan:archive seq:15’s cursor return, and the two should be solved once.

AND THE COPY MUST NOT LIE ABOUT WHAT IT TOOK. If a selection spans a folded block, either include
its content or say it was omitted - INV-nothing-is-dropped-silently. A clipboard that quietly drops
the middle of a passage is worse than one that refuses.
