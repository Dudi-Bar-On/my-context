---
id: TASK-an-edit-made-outside-claude-code-either-reaches-the-page-or
type: task
title: an edit made outside Claude Code either reaches the page or is disclosed
status: active
severity: soft
always: false
summary: A file edited in another program never reaches the open page, so either watch for such changes or tell the reader the page cannot see them.
summary_of: 712d36464b00111c
scope: []
tags:
  - v2
  - ui
  - live
  - "plan:live"
  - "seq:4"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: a2d986a0fbe92bde
plan: live
seq: "4"
state: done
priority: "2"
source: owner, 2026-08-27
---

# an edit made outside Claude Code either reaches the page or is disclosed

THE GAP THE AUDIT LOG DOES NOT COVER, and it must not be left to be inferred from a page that did not update.

`file-changed` is a Claude Code HOOK. It fires while a session runs. A Markdown item edited in another editor, with no session open, changes the corpus and appends NOTHING -- so a served page cannot learn about it from the log, however good the stream is.

TWO HONEST ANSWERS, and the choice needs measuring rather than taste:

  1. **The server watches `.my_context/items/` itself.** Closes the gap completely. `fs.watch` is the obvious tool and is unreliable in ways that matter here: it silently misses events on some network filesystems and behaves differently per platform. A change feed that MISSES is worse than one that is a second late, so this needs measuring on Windows before it is trusted -- and if it is adopted, its own failure has to be visible rather than assumed.
  2. **Disclose the limit.** The page says it reflects changes made through mycontext and a session, and names what it cannot see.

Answer 2 is correct until answer 1 is measured, and answer 2 is required EVEN IF answer 1 lands, for the interval where the watch is not running.
