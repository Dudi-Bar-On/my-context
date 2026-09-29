---
id: TASK-a-question-put-to-the-owner-is-invisible-in-the-viewer-and
type: task
title: a question put to the owner is invisible in the viewer, and the check cannot see it either
status: active
severity: soft
always: false
summary: When a decision is put to the owner through the picker, the options he chose between and the one marked as recommended are missing from the viewer, so his answer is shown with nothing to read it against.
summary_of: 26a15b5979d9a9e6
summary_was:
  - 2026-09-13 When a decision is put to the owner through the picker, the options he saw, the one recommended and the one he chose are all missing from the conversation viewer.
scope:
  - src/ui/public/screens/conversations.js
  - src/ui/read-model-conversation-document.ts
  - scripts/check-ask-numbering.ts
tags:
  - v2
  - ui
  - archive
  - "plan:screens"
  - "seq:27"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 6910f855cfec4255
plan: screens
seq: "27"
state: todo
priority: "1"
---

# a question put to the owner is invisible in the viewer, and the check cannot see it either

> OWNER REPORT 2026-09-13: "why did you stop to show on the viewer when you ask me a question: the numbered options, your recomendation and the chosen ? why they were removed ?"
>
> NOTHING WAS REMOVED FROM THE PRODUCT. The dispatching session changed how it asks: from writing numbered options into the message text to calling the `AskUserQuestion` tool. In the terminal that renders a picker and marks the recommendation, which is why it still looked right there. THE OPTIONS, THE RECOMMENDATION AND THE ANSWER NOW LIVE IN TOOL-CALL JSON, AND THE VIEWER RENDERS PROSE. So they are invisible in the one surface built for re-reading a conversation.

CORRECTED BY THE OWNER WITHIN A MINUTE OF FILING, and the correction narrows the defect: "the chosen i can see just the numbers are missing". HIS ANSWER IS VISIBLE - it is his own turn and the viewer renders it. WHAT IS MISSING IS THE OPTIONS HE CHOSE BETWEEN AND WHICH ONE WAS RECOMMENDED. A reader sees an answer with nothing to read it against: "1", with the list it selected from nowhere on the page. THE FIRST FILING SAID THE ANSWER WAS MISSING TOO. THAT WAS WRONG, and it is recorded here rather than quietly deleted.
>
> MEASURED 2026-09-13 with the store's own detective, `scripts/check-ask-numbering.ts`: 118 questions put to the owner, 2 held the standard (1.7%), 86 UNNUMBERED. When the rule was written on 2026-09-11 it was 108 questions and 0 held. The behaviour change is visible in the numbers and the direction is wrong.
>
> AND THE CHECK HAS THE SAME BLIND SPOT AS THE VIEWER, which is the part that makes this a product defect rather than only a habit: it reads the turn's TEXT, so a question asked through the tool counts as `unnumbered` EVEN WHEN THE TERMINAL SHOWED THE OWNER A NUMBERED LIST WITH A MARKED RECOMMENDATION. The standard is now under-reported as well as under-obeyed, and the two cannot be told apart from the number alone.
>
> WHY THIS MATTERS MORE THAN ITS SIZE. The store's first entry records the rationale as a measured one and not a preference: he answers by number, so an unnumbered list makes his answer depend on an order he inferred rather than one he can see, and A MIS-MAPPED NUMBER IS A SILENT WRONG RULING. A decision, its options, which was recommended and WHICH ONE HE CHOSE is the most re-read thing in an archive. Today the archive holds all four and shows one: the answer.
>
> WHAT THIS ASKS FOR:
>
> 1. THE VIEWER RENDERS A QUESTION AS A QUESTION. Options in their given order, the recommendation marked as the recommendation, and the answer marked among them. The answer itself already renders and needs nothing. The data is already in the transcript; nothing needs to be captured that is not already there.
>
> 2. THE CHECK READS BOTH SHAPES. A question asked through the tool must be judged on the options it actually carried, not on the prose around them. Until it does, its own figure is a floor for a second reason it does not currently disclose - and `INV-nothing-is-dropped-silently` applies to a measurement as much as to an item.
>
> 3. AND THE ANSWER BELONGS IN THE RECORD NEXT TO THE QUESTION. Today "1" or "why 1 and not 2" is a separate turn that a reader must re-associate by position. When the options are rendered, the chosen one should be marked in the same block.
>
> WHAT THIS DOES NOT ASK FOR: it does not say stop using the tool. The picker is better for the owner in the terminal than a prose list he has to count. The defect is that the record and the check cannot see what the picker showed him.

## Request

by the way why did you stop to show on the viewer when you ask me a question: the numbered options, your recomendation and the chosen ? why they were removed ?
