---
id: TASK-a-question-its-options-the-answer-chosen-and-a-shell-command
type: task
title: a question, its options, the answer chosen, and a shell command are turns you can read
status: active
severity: soft
always: false
summary: The choices you were offered and the one you picked, and the commands that were run, are shown as part of the conversation instead of hidden as machinery.
summary_of: da0279ba0144381b
scope:
  - src/ui/**
  - src/core/conversation-index.ts
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:16"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: d853500d0e52dc27
plan: archive
seq: "16"
state: todo
priority: "1"
needs: archive/13
---

# a question, its options, the answer chosen, and a shell command are turns you can read

Owner ruling 2026-09-08: he wants to see the questions put to him, the suggestions offered, which
one he chose and what he answered - and the same for shell commands that were executed.

WHY THEY ARE MISSING TODAY, AND IT IS NOT THAT THEY ARE ABSENT. A question to the user and a shell
command are both tool_use / tool_result pairs inside a `message` object. classifyTurn
(src/core/conversation-index.ts) sorts every record that is not plainly a prompt or an answer into
MACHINERY, and the viewer folds machinery away. So they are present in the file, counted, and
collapsed as noise. That is what the 49 rows reading "Tool step ... 0 characters" on the first page
of his own session actually are.

SO THIS IS A CLASSIFICATION CHANGE, NOT A CAPTURE ONE. Machinery is currently one bucket doing two
jobs: things a reader never wants (file-history snapshots, mode changes, latches) and things a
reader wants MORE than the prose around them - a decision he was asked to make, and a command that
changed his machine.

WHAT MUST BE DRAWN, and each is a distinct shape rather than a paragraph:
  - THE QUESTION as asked, with EVERY option that was offered, not only the chosen one. The
    options he declined are the record of what was considered.
  - WHICH ONE HE CHOSE, marked, plus any free text he added.
  - THE SHELL COMMAND exactly as it ran, and its exit status. Its output belongs behind the fold;
    the command does not.

AND KEEP THE FOLD FOR THE REST. The value of folding is that 16,659 of 26,673 records in his
session carry no message object at all. Promoting everything would undo plan:archive seq:13.
Promote the two kinds he named; leave the rest folded.

ONE THING TO MEASURE BEFORE DESIGNING: how a question and its options are actually recorded in the
JSONL - the tool name, where the options live, and whether the ANSWER is in the tool_result or in
the following user turn. Measure it on his real transcript. classifyTurn is correct for the
archive’s counting and must not be broken to serve the viewer; add a kind, do not repurpose one.

## Relations
- depends_on [[TASK-a-tool-call-keeps-160-characters-of-its-input-and-drops-the]]
