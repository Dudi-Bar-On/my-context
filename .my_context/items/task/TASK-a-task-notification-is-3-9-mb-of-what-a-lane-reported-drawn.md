---
id: TASK-a-task-notification-is-3-9-mb-of-what-a-lane-reported-drawn
type: task
title: a task notification is 3.9 MB of what a lane reported, drawn as the word queue-operation
status: active
severity: soft
always: false
summary: The results that helpers report back are readable in a saved conversation instead of appearing as a bare label, and a row that can never have content says so once rather than repeatedly.
summary_of: c0059db1cb30ed26
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
checksum: 4b33320af1095eaf
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

AND A SECOND DEFECT ON THE SAME RECORDS, REPORTED BY THE OWNER 2026-09-09 FROM THE SCREEN. He saw
a turn drawn as:

    You
    Background task finished
    2026-09-09 00:01 GMT+3

and read it as his own input being overridden - "the You lost it's color and the Background task
finished overides the text that supposed to be near You (it's a guess i do not real see so not
realy know)".

NOTHING IS BEING OVERRIDDEN, and that half is worth writing down because it is the reading anybody
would reach for. `conv.doc.syn.task` is a STRING-TABLE SENTENCE - "Background task finished" /
"משימת רקע הסתיימה" - so the viewer is REPLACING the raw `<task-notification>` payload with a
readable line. There is no input of his behind it: the turn has none. The dimming is the synthetic
marker working as designed (`syntheticLabel`, which already counts 194 task-notifications among the
525 records `classifyTurn` calls prompts).

THE DEFECT IS THE ATTRIBUTION. The turn is headed "You" for something the owner did not say. A
synthetic marker that dims the turn and a heading that names him as the speaker are two statements
in the same row that contradict each other, and the heading is the one a reader believes - it is
larger, it is first, and it is the thing every other turn uses to mean "this person typed this".

SO A SYNTHETIC TURN MUST NOT CARRY A PERSON'S NAME. Options, and the choice is a visual ruling:
give it its own speaker (the harness, the system), or give it no speaker at all and let the
sentence stand alone as the machinery it is. What it must not do is claim he spoke.

AND THE ORDER LOOKS WRONG TOO, which is worth checking rather than assuming from his paste:
seq:13 rules the shape as heading, then THE TIMESTAMP ON ITS OWN LINE DIRECTLY UNDER THE HEADING,
then the content. His paste shows heading, content, timestamp. Either the synthetic path builds the
row in a different order from every other turn, or he transcribed it loosely. MEASURE IT IN THE
BROWSER before changing anything - and if the synthetic path really does differ, that is the
defect rather than the ordering rule.

THIS COMPOSES WITH THE 3.9 MB ABOVE RATHER THAN COMPETING. That half makes the notification's
CONTENT reachable - what the lane actually reported. This half stops the row lying about WHO said
it. Both are the same records and the same file, so they are one piece of work: a reader should be
able to see that a lane finished, read what it said, and never think they said it themselves.

OWNER RULING 2026-09-09, on the speaker: "it's Claude / Shell / Subagent or none select the
correct one". So it is a PER-KIND MAPPING and not one label for all of them, and the kinds were
measured on his own session before assigning any:

    SYNTHETIC USER-SIDE TURNS                269 total
      task-notification                      215
        Agent "..." finished                 175   -> SUBAGENT
        Background command completed/failed   24   -> SHELL
        Monitor event                         15   -> NONE
        no completion record found             1   -> NONE
      meta                                    25   -> NONE
      slash-command                           23   -> YOU (see below)
      harness compaction summary               6   -> NONE

AND THE FIRST FINDING IS THAT ONE OF HIS FOUR OPTIONS IS NEVER CORRECT. Claude is the speaker of
none of these. Every one is something delivered TO the assistant - by a finished lane, by a shell,
by a monitor, by the harness - so attributing any of them to Claude would repeat the exact error
this ruling exists to fix, one name over.

SUBAGENT IS THE BIGGEST GROUP BY FAR, 175 of 269, and it is the one with somewhere to point:
plan:archive seq:12 landed the subagent index, and every one of these notifications is a lane
reporting back. So the row that currently says "You" should say SUBAGENT - and once seq:15 lands,
that row is the natural place to link INTO the lane's own transcript. This item and seq:15 meet
here.

SHELL, 24, is a background command finishing - `Background command "..." completed` or `failed
with exit code N`. The exit code matters and the viewer already has a vocabulary for it
(`.exitcode` / `.exitcode.bad`), so a failed background command should read as failed rather than
merely finished.

NONE covers 47 records across three kinds - monitor events, `isMeta` bookkeeping and the harness's
own compaction carry-over. These have no speaker in any honest sense; they are the harness talking
to itself, and giving them an invented name would be worse than giving them nothing.

SLASH-COMMAND IS THE ONE CASE WHERE THE CURRENT BEHAVIOUR IS RIGHT, and it is worth saying so
rather than sweeping all 269 into the change. The wrapper text is machinery, but the ACT was his:
he typed the slash command. So "You" is the correct speaker for those 23, and the fix must not
catch them. A change that renames every synthetic turn would take his own invocations away from
him.

SO THE RULE IS: the speaker follows WHO CAUSED THE TURN, not whether the text was typed by a
person. He caused a slash command; a lane caused its own completion; nobody caused a monitor tick.

AND THE CLASSIFIER HAS TO GET FINER TO DO THIS. `syntheticLabel` returns one string per kind and
stops at `task-notification` - it does not look inside the payload, so it cannot tell the 175 from
the 24 from the 15. The `<summary>` line is where the distinction lives and it is reliable across
all 215. Read it. Do NOT infer the subtype from the record type or from the queue operation, which
carry the same shape for all three.

AND THE ORDERING SUSPICION ABOVE IS WITHDRAWN, by the owner, the same day it was raised. He showed
the regular shape:

    Claude
    2026-09-09 00:01 GMT+3

and ruled: "this is how a regular text header is, You have the same format and it is correct". So
speaker-then-timestamp is the format, it is consistent between Claude and You, and the seq:13 rule
is being honoured. His earlier paste put the sentence between the two because he was describing
what he saw rather than transcribing it - NOT because the synthetic path builds the row
differently. No lane should go looking for an ordering defect; there is none.

THE ROW THEREFORE HAS EXACTLY ONE DEFECT, which is worth stating plainly now that the other
candidate is gone: the heading names the wrong speaker. Everything else about it - the format, the
timestamp, the dimming, the readable sentence in place of raw XML - is correct and must survive the
fix.
