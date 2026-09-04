---
id: TASK-doctor-two-of-the-three-card-headings-are-unkeyed-literals
type: task
title: "Doctor: two of the three card headings are unkeyed literals, so a Hebrew reader is told the severity in English"
status: active
severity: soft
always: false
summary: Two of the three severity headings stay in English, and here the heading is the only thing telling a reader how serious a problem is.
summary_of: 8714142787f61b17
scope: []
tags:
  - v2
  - ui
  - i18n
  - walk
  - "screen:doctor"
  - "plan:walk"
  - "seq:98"
  - "state:done"
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: ac1bdbfd8b9d60aa
plan: walk
seq: "98"
state: done
priority: "2"
progress: "0"
needs: walk/92
source: "plan:walk seq:27, measured against src/ui/public/screens/doctor.js on 2026-08-29"
---

# Doctor: two of the three card headings are unkeyed literals, so a Hebrew reader is told the severity in English

WHAT THE SCREEN IS, so it can be built without opening the mockup. `nav.ev` -- **Doctor**, `<section data-p="doctor">`. `runChecks`' findings kept whole, because `doc.v` says "a findings list flattened to 'exit 1' is what a terminal loses". THREE CARDS, ONE PER LEVEL -- `error`, `warning`, `notice` -- each holding a table whose first cell is the finding code, with `groupFindings` ordering the codes worst-first inside each card. The message is the CHECKER'S OWN TEXT, unedited, with the literals HE delimited isolated by `messageRuns` and nothing else touched. The repair is COMPOSED and never run: one `.cmd` row per distinct command per card, and a row whose code composes nothing wears `doc.norepair` rather than drawing bare. A clean corpus draws three EMPTY cards, not an empty screen (owner ruling); a refusal is drawn INSTEAD of the data, in the endpoint's own words.

WHAT IT OWES: **the level is said by the card's heading, and two of the three headings cannot be translated.**

`screens/doctor.js`'s `CARDS` is `error` / `warning` / `notice`, and only the third is keyed (`doc.notice`). The first two are LITERALS with no `data-t` in the design of record, so they are transcribed as literals here. Its own comment calls this "an open question for the owner and not a decision taken here" -- and no open question and no task in the corpus carries it.

WHY IT MATTERS MORE ON THIS SCREEN THAN ON MOST. The heading is not a caption here, it is the ONLY place severity is said. This screen deliberately gives the three levels NO hue -- the repaint's own argument, one section earlier, is that "a glyph beside it repeats what the reader has already been told", and a `.chip.crit` on every row of a card headed `error` is exactly that repetition. The colour was given up because the word was carrying the meaning. On the Hebrew page two of the three words are in the wrong language, so nothing carries it.

NOTE THE HEADING IS NOT THE LEVEL VALUE. `runChecks` emits `warn` and `info`; the mockup writes "warning" and "notice". The level is the join key and the heading is the label, and they are allowed to differ -- so this is a label question and not a rename of anything the server sends.

THE REASON THE FILE GIVES FOR NOT ADDING `doc.error` / `doc.warning` HAS EXPIRED. It says the tables "would fail `test/ui/strings-parity.test.ts` in the direction that names it: a key in a table that the design of record does not declare". That direction was dropped on 2026-08-26. See plan:walk seq:92, which this task waits on.

TWO ROUTES, AND THE OWNER PICKS ONE: give the mockup `data-t` on the two headings and key all three the ordinary way, or rule that these three words are product vocabulary like a tier name and a record kind, and record THAT -- in which case `doc.notice` is the odd one out and should go, because a set of three labels where one translates and two do not is worse than either consistent answer.
