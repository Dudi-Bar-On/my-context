---
id: TASK-a-task-notification-is-3-9-mb-of-what-a-lane-reported-drawn
type: task
title: a task notification is 3.9 MB of what a lane reported, drawn as the word queue-operation
status: active
severity: soft
always: false
summary: The results that helpers report back are readable in a saved conversation instead of appearing as a bare label, and a row that can never have content says so once rather than repeatedly.
summary_of: 774382b91d81067b
scope:
  - src/ui/read-model-conversation-document.ts
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:28"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 9628674d4cd63523
plan: archive
seq: "28"
state: todo
priority: "1"
needs: archive/24
---

# a task notification is 3.9 MB of what a lane reported, drawn as the word queue-operation

Owner report 2026-09-08, reading his own session after seq:24 landed: "still i see lines like these
30562 attachment / 30563 queue-operation / 30564 thinking, is it ok ?"

MEASURED ON HIS OWN TRANSCRIPT, and the answer is different for each of the three. Two are not ok.

  QUEUE-OPERATION   1,551 records, 1,331 carrying content, 3,940,700 CHARACTERS
  ATTACHMENT        4,796 records, 0 with a `rendered` string - the content is in `attachment.type`
  THINKING          2,048 blocks, EVERY ONE OF THEM 0 CHARACTERS, 0 total

── QUEUE-OPERATION IS THE DEFECT, AND IT IS BIGGER THAN THE ONE seq:24 JUST FIXED ────────────

3.9 MB of content is drawn as the single word "queue-operation". seq:24 recovered 4.45 MB of tool
INPUT; this is the same size of loss one field over. And it is not incidental content: the sample
is a `<task-notification>` block - THE WAY A SUBAGENT REPORTS BACK. Every lane completion, every
result a dispatched agent returned, arrives in this record type. So the archive currently shows
that a lane finished and not one word of what it said.

THE REASON IS THE SAME SHAPE AS seq:24’S. The read model reaches for a record’s `message` object
and its text blocks. A `queue-operation` has no `message` - its payload is a TOP-LEVEL `content`
field. So nothing was hidden and nothing was capped: the field was never read.

── ATTACHMENT IS HALF NOISE AND HALF CONTENT, AND THE VIEWER CANNOT TELL THEM APART ──────────

`rendered` is null on all 4,796, so there is nothing to draw from there. The meaning is in
`attachment.type`, and the distribution decides the design:

    total_tokens_reminder      3,597    pure bookkeeping - a reader never wants this
    hook_success                 668    a hook ran and said something
    queued_command               226    a command the owner queued
    hook_additional_context       77    context a hook injected
    file                          26    a file attached
    deferred_tools_record         20    tool schemas loaded

So 3,597 of 4,796 are genuinely noise and the current bare row is arguably right for them - but
991 are not, and they all render identically. A reader cannot distinguish "the harness counted
tokens" from "a hook injected context into this turn", and the second is something that CHANGED
THE CONVERSATION.

AT MINIMUM THE TYPE MUST BE ON THE ROW. "attachment" names the envelope; `total_tokens_reminder`
and `hook_additional_context` name the thing. This is exactly the argument seq:13 already won for
tool calls - a fold that says `Bash` forty times is unskimmable - applied to the one record type
that never got it.

── THINKING IS HONEST AND USELESS, WHICH IS ITS OWN PROBLEM ───────────────────────────────────

2,048 thinking blocks and ALL 2,048 hold zero characters. Claude Code does not persist thinking
text to the transcript at all. So the row saying "thinking" with nothing beside it is TRUE - and it
will be true for every thinking block that will ever be written, because the text is not there to
find. This is not a capture bug and there is nothing to recover.

WHICH MAKES IT A DISCLOSURE QUESTION, NOT A RENDERING ONE. 2,048 rows that can never carry content
are noise by construction, and the honest options are to fold them without a row each, or to say
ONCE that thinking is not recorded rather than 2,048 times that a thinking block existed. What must
NOT happen is drawing them as though the content were merely missing this time -
`STD-absent-vs-zero` is exactly about not letting "never recorded" look like "empty today".

AND IT IS WORTH SAYING OUT LOUD IN THE ITEM, because it will be asked again: the archive can never
show the assistant's reasoning. It can show that reasoning happened. If the owner wants the
reasoning itself, the only source is a different one - and `plan:archive seq:12`'s subagent
transcripts are the nearest thing, which is why that item says the session holds the REPORT and the
subagent transcripts hold the REASONING.

── WHAT TO BUILD ─────────────────────────────────────────────────────────────────────────────

  1. READ `content` ON A RECORD WITH NO `message`. That is the 3.9 MB. `queue-operation` is the
     measured case; sweep for any other type carrying a top-level payload rather than fixing this
     one type by name, or the next type to appear repeats it.
  2. PUT `attachment.type` ON THE ROW, so 991 meaningful attachments stop looking like 3,597
     bookkeeping ones.
  3. DECIDE WHAT A THINKING BLOCK LOOKS LIKE when its text can never exist, and say it once.

ONE THING TO MEASURE BEFORE CHOOSING, because it decides whether 3.9 MB can simply be drawn: what
the LARGEST single `queue-operation` content is, and what it does to the worst window. seq:24 took
no cap after measuring that its largest input was 22,382 chars - 37% of the largest step text
already served uncapped - and that the worst 24-node window grew 26%. Take the same measurement
here rather than inheriting either answer.

AND THE COUNT MUST STAY HONEST: `sum(span) === records` is asserted so a fold cannot quietly drop a
record. None of the three changes above may disturb it.
