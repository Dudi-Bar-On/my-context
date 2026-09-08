---
id: TASK-a-tool-call-keeps-160-characters-of-its-input-and-drops-the
type: task
title: a tool call keeps 160 characters of its input and drops the rest, so 92.8% of what was done is not in the archive
status: active
severity: soft
always: false
summary: Opening a step in a saved conversation shows what the tool was asked to do, not just a one-line label about it, so commands, written files and the questions you were asked are all there.
summary_of: 1966a98409c74bed
scope:
  - src/ui/read-model-conversation-document.ts
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:24"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: ff8effc5edfaa68a
plan: archive
seq: "24"
state: todo
priority: "1"
needs: archive/13
---

# a tool call keeps 160 characters of its input and drops the rest, so 92.8% of what was done is not in the archive

Owner report 2026-09-08, pasting his own terminal output back at me: a `Write(...)` call with the
file it wrote, and a `Bash(...)` call with the command it ran, are BOTH absent from the session he
is reading in the browser. "this kind of text is ommited from the session i see in the browser ...
fix it. and if there are more alike fix them too."

AND THERE ARE MORE ALIKE. It is 92.8% of every tool call in the file.

THIS IS A CAPTURE DEFECT, NOT A RENDERING ONE, which is why the fold being openable would not have
fixed it. The content is not hidden in the read model - it was never put there.

`toolDetail` (`src/ui/read-model-conversation-document.ts` - `function toolDetail`) takes a tool
call’s whole input object and reduces it to ONE line of at most 160 characters, by walking
`DETAIL_FIELDS` and taking THE FIRST NAME PRESENT. Everything else in the input is dropped on the
floor. There is no second field, no full-input path, and `DocStep.text` does not rescue it -
that field carries a record’s TEXT blocks, and a tool call’s payload lives in `input`, not in a
text block.

MEASURED ON HIS OWN TRANSCRIPT, and the numbers are the argument:

    tool_use records                       3,261
    records losing input content           3,027   (92.8%)
    characters of input never captured 3,886,886

THE ORDERING IS WHAT DOES THE DAMAGE, because `description` is first in the table and
`description` is the one field that is ABOUT the call rather than being the call:

    Bash              2,343 calls   description wins   THE COMMAND THAT RAN is lost
    Agent               206 calls   description wins   THE ENTIRE LANE BRIEF is lost
    Write               139 calls   file_path wins     THE FILE CONTENT is lost
    AskUserQuestion      71 calls   NOTHING wins       every question and option is lost

EACH ROW IS ITS OWN LOSS AND THEY ARE NOT EQUALLY BAD:

  - BASH. `description` is prose written ABOUT the command by whoever called it. The command is
    the fact. A reader auditing what happened to their machine is shown a summary and not the
    act - and the summary is written by the same party whose actions are being audited.
  - AGENT is the worst of the four by information lost. 206 lane briefs, each hundreds of lines of
    reasoning and constraint, each reduced to a 3-to-5-word label. That is the most valuable prose
    in the session and the archive keeps none of it. It also makes plan:archive seq:15 - open a
    subagent from the turn that dispatched it - unable to show what the subagent was ASKED, even
    once seq:12 indexes what it answered.
  - ASKUSERQUESTION CAPTURES NOTHING AT ALL, and the reason is a type mismatch rather than an
    ordering one: `questions` is an ARRAY, and `toolDetail`’s fallback loop only accepts a string
    value, so it returns null. This is exactly the defect plan:archive seq:16 reports from the
    reading end - the owner cannot see the choices he was offered - and seq:16 cannot be built on
    top of a capture layer that holds none of them. THIS ITEM IS SEQ:16’S MISSING FOUNDATION.
  - WRITE and EDIT. The path without the content says a file changed and not how. For Edit, both
    old_string and new_string are the change; neither is captured.

WHAT TO BUILD, and the shape matters because `detail` itself is not wrong:

KEEP `detail` AS THE SKIMMABLE LINE. It exists for a measured reason - 2,123 of 3,014 tool calls
were Bash, and a fold reading "Bash" forty times is a fold nobody can skim. A fold summary must
stay one line. Do not fix this by making the fold verbose.

ADD THE FULL INPUT AS STEP CONTENT, behind the fold, where the tool RESULT already lives. The
reader opens a step and sees what was asked as well as what came back. Today they get half a
conversation.

AND FIX THE ORDERING WHILE YOU ARE THERE: for a tool that has both, the ACT outranks the prose
about the act. `command` before `description` for Bash; `prompt` before `description` for Agent.
A reader who wants the summary has `detail`; a reader who opens the step wants the thing itself.

THREE THINGS TO DECIDE RATHER THAN ASSUME:
  - NON-STRING INPUTS. AskUserQuestion’s `questions` is an array of objects; a browser_evaluate
    carries a function body; some inputs are numbers and booleans. A capture layer that only
    understands strings is how 71 records ended up with nothing. Decide how a structured input is
    served and drawn - and seq:16 has opinions about how a question and its options should LOOK,
    so co-ordinate rather than guess.
  - SIZE. 3.9 MB of input across 3,261 records is why this was cheap to drop. plan:archive seq:7
    removed the text caps after measuring that the largest said node was 41% of a cap that never
    fired - do the same measurement here rather than inheriting either answer. The largest single
    input in this file is worth knowing before deciding whether anything needs bounding.
  - SECRETS. A command line or a written file can contain a token. Nothing in this product
    redacts, and it has never had to, because it never captured them. Say plainly whether that
    changes with this item, because "the archive now keeps every command in full" is a sentence
    the owner should read before it is true rather than after.

AND THE COUNT MUST STILL BE HONEST. `sum(span) === records` is asserted so a fold cannot quietly
drop a record. Adding content to steps must not disturb that, and a step that carries a structured
input must still be exactly one step.
