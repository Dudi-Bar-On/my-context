---
id: TASK-a-glyph-makes-a-kind-recognisable-without-reading-in-every
type: task
title: a glyph makes a kind recognisable without reading, in every viewer case where that helps
status: active
severity: soft
always: false
summary: Symbols now tell the kinds of bookmark apart and the misleading ticks beside screen headings are gone; the survey of every other place in the viewer is still to do.
summary_of: 1f7a4bd3f11ec654
summary_was:
  - 2026-09-16 In the viewer a reader tells one kind of thing from another only by reading the word; a small, consistent set of symbols would make them recognisable at a glance.
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
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-12
valid_until: null
checksum: a40f7723694be38b
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

── STILL OPEN 2026-09-16, AND THIS IS WHAT REMAINS ─────────────────────

NAMED-BUT-OPEN 06cb85e7 — the heading verdicts are settled and ten marks ship; the SURVEY this item asks for first, over every viewer case, is not done

WHAT LANDED: point 5 in full and point 1 in part. `screenHead` LOST ITS `glyph` PARAMETER ENTIRELY — there is no longer a door to pass one through — and every screen verdict is now a keyed chip, across seventeen call sites (measured, not nineteen: four screens never called it). The default hue is the NEUTRAL and not green, on the argument that an `ok` green on sixteen headings is the same health claim in a second channel. Where the review said DELETE four internal verdicts and the owner ruled "reword — not keep, not hide", the owner won, because deleting four is hiding four. Ten marks ship, each beside its word, each `aria-hidden`, each isolated for bidi, and `glyphed()` THROWS IF GIVEN NO WORD, so point 3 is enforced in code rather than documented.

WHAT REMAINS is the larger half this item calls the survey: naming every case in the viewer where a reader tells two things apart BY READING A WORD — twenty rail screens, the audit stream's record kinds, doctor's severities, the review queue, decay, status, the item pane's categories, the composer's field states — and saying for each whether a glyph helps or is decoration, citing the rubric. Point 1 says explicitly that this comes BEFORE a single glyph is added, and the ten that shipped were the closed set the owner named directly.

The `NAMED-BUT-OPEN` line above is read by `npm run check:board`.

## Request

yes, add emoji per kind, and for the ui if there are other cases in the viewer that emoji will make them more distinguishable and clearer, then find for every case it's suitable emoji and add
