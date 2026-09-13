---
id: TASK-a-glyph-makes-a-kind-recognisable-without-reading-in-every
type: task
title: a glyph makes a kind recognisable without reading, in every viewer case where that helps
status: active
severity: soft
always: false
summary: In the viewer a reader tells one kind of thing from another only by reading the word; a small, consistent set of symbols would make them recognisable at a glance.
summary_of: 96678cb9d537c31a
scope:
  - src/ui/public/**
  - e2e/**
tags:
  - ui
  - v2
  - "plan:screens"
  - "seq:26"
  - "state:todo"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/emoji-body.md"
source_anchor: null
source_checksum: eb02b8163a420571
valid_from: 2026-09-12
valid_until: null
checksum: 68ac7180b1b6b5c7
plan: screens
seq: "26"
state: todo
priority: "2"
---

# a glyph makes a kind recognisable without reading, in every viewer case where that helps

> OWNER INSTRUCTION 2026-09-13, in his own words: "yes, add emoji per kind, and for the ui if there are other cases in the viewer that emoji will make them more distinguishable and clearer, then find for every case it's suitable emoji and add".
>
> It arrived from a precise question - how an anchor is shown in the viewer - and the honest answer was that a marked point carries SIX facts in one line of words and NOT ONE GLYPH: the session name as the link, the kind, who marked it, the stamp, the lane when there is one, and the byte. Nothing on that row is scannable; a reader tells two kinds apart by reading.
>
> THE FIRST HALF IS DECIDED AND IS SMALL. The four anchor kinds are a closed set with a string key each - `note` ("you marked this"), `table` ("a table"), `report` ("a report"), `ruling` ("a ruling you gave") - so a glyph per kind is four additions beside four existing words.
>
> THE SECOND HALF IS A SURVEY AND IT IS THE LARGER PART. "Every case it is suitable" is a judgement over the whole viewer: twenty rail screens, the audit stream's record kinds, doctor's severities, the review queue, decay, status, the item pane's categories, the composer's field states, and every place a reader today distinguishes two things by reading a word.
>
> AND THERE IS A COUNTERWEIGHT ALREADY ON THE RECORD, which is why this item exists rather than a patch. The UI review of 2026-09-12 found that EVERY SCREEN HEADING CARRIES AN INTERNAL DESIGN VERDICT in a span - "✅ exit 1 loses the findings list", "⚠️ conditional pass" - and said plainly that a green tick beside a title READS TO A USER AS A HEALTH CLAIM ABOUT THE PRODUCT. So this product already uses glyphs, in the one place they mislead. A pass that adds more without settling that one makes the confusion worse, not better.
>
> WHAT THIS ASKS FOR, in order:
>
> 1. A SURVEY BEFORE A SINGLE GLYPH IS ADDED. Name every case in the viewer where a reader distinguishes two things by reading a word, and for each say whether a glyph helps or is decoration. The `ui-ux-pro-max` guidelines the owner approved are the rubric; cite the guideline.
>
> 2. ONE GLYPH PER MEANING, NEVER TWO FOR ONE, and never a glyph that means one thing on one screen and something else on another. The set is small enough to hold in the head or it is not doing its job.
>
> 3. THE GLYPH IS NEVER THE ONLY CARRIER. Every case keeps its word. A glyph that replaces text fails a screen reader, fails a reader who does not know the convention, and fails `screen-literals` - which is this project's gate that a sentence on screen has a key.
>
> 4. BOTH STRING TABLES, and BIDI. A glyph beside Hebrew text sits in a run whose direction is not the paragraph's; the same isolation `mono` already applies to an identifier applies here.
>
> 5. THE SCREEN-HEADING VERDICTS ARE SETTLED IN THE SAME PASS - keep, hide or reword - because they are the existing glyph usage and they are the one the review called misleading.
>
> WHERE THIS MUST NOT GO: a glyph is not a substitute for a sentence that is missing. `walk/144` records that 75 buttons across the screens carry 5 titles between them, and D50 is the subject for surfaces built to carry an explanation that nothing fills. AN EMOJI ON A CONTROL THAT STILL CANNOT SAY WHAT IT DOES IS THE DEFECT WEARING A NEW HAT.

## Request

yes, add emoji per kind, and for the ui if there are other cases in the viewer that emoji will make them more distinguishable and clearer, then find for every case it's suitable emoji and add
