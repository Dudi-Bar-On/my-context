---
id: TASK-thirteen-modules-still-refuse-to-key-a-string-on-a-strings
type: task
title: thirteen modules still refuse to key a string on a strings-parity direction that was dropped on 2026-08-26
status: active
severity: soft
always: false
summary: Thirteen parts of the app still refuse to translate their sentences, because of a rule that was dropped days ago.
summary_of: 69598681869563ed
scope: []
tags:
  - v2
  - ui
  - i18n
  - walk
  - strings
  - "plan:walk"
  - "seq:92"
  - "state:done"
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: 5a2214bd96d54b3c
plan: walk
seq: "92"
state: done
priority: "1"
progress: "0"
source: "plan:walk seq:27, measured against src/ui/public/screens/*.js and test/ui/strings-parity.test.ts on 2026-08-29"
---

# thirteen modules still refuse to key a string on a strings-parity direction that was dropped on 2026-08-26

FOUND 2026-08-29 under plan:walk seq:27, while reading the eight module headers seq:27 had left unread. It is the largest single finding of that pass and it is not a defect in any one screen.

THE PREMISE, QUOTED FROM SIX OF THOSE EIGHT HEADERS: a sentence cannot be given a key, because `test/ui/strings-parity.test.ts` "fails in the direction that names it" -- a key in a table that the design of record does not declare.

THAT DIRECTION NO LONGER EXISTS. `test/ui/strings-parity.test.ts` has ONE mockup-facing test today, `every sentence the mockup declares exists in the string tables -- the gap direction`, and its own docstring says why: "ONE DIRECTION SINCE 2026-08-26, and the other was dropped by an owner ruling rather than by anyone finding it inconvenient ... The direction removed was INVENTED: an app string with no mockup entry. Under this one it is ordinary development." The ruling is `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap`.

SO EVERY REFUSAL RESTING ON IT HAS BEEN UNBLOCKED FOR THREE DAYS AND NOBODY RE-READ THE GATE. `screens/preview.js` is the one file that did, on 2026-08-29, and it names the class in the sentence this task exists to generalise: "A constraint quoted from memory rather than from the gate is how a defect outlives its cause." It keyed its two sentences (`preview.notrun`, `preview.notrunn`) and left the other twelve modules citing the vanished rule.

THE THIRTEEN SITES, by module and by the thing each one refuses to word. Measured by grep over `src/ui/public/` on 2026-08-29; located by identifier rather than by line, which drifts:

  `screens/parts.js`     `errorNote` -- the SHARED refusal renderer. "Recorded as an open question for the owner rather than resolved." Every server refusal on every screen in this UI is unworded because of this one paragraph, so it is the site with the widest reach and should be read first.
  `screens/ask.js`       the operator select's `is` / `is not` labels (plan:walk seq:99).
  `screens/config.js`    the `parseError` / `resolveError` branch of `render()` (plan:walk seq:105).
  `screens/docs.js`      the markdown renderer's refusal labels (plan:walk seq:93).
  `screens/doctor.js`    the `CARDS` table's `error` and `warning` headings (plan:walk seq:98).
  `screens/proc.js`      the fifth stage's table row, in the header's FOUR ROWS, FIVE STAGES block; and the disclosure card's missing `<h3>` (plan:walk seq:96, seq:97).
  `screens/simulate.js`  `#readout`, in the header; and the fits chip's `of`, in the tier-row builder (plan:walk seq:6, seq:104).
  `screens/watch.js`     the `regime change - ` feed-row prefix; and the four refusal-check sentences in `whatOf`'s docstring.
  `screens/capture.js`   the four controls in the KNOWN_GAPS ledger, and the draft count that "has no string in the mockup, and is served anyway" -- the screen "still cannot tell a user that three drafts already sit in the scope they are about to file into".
  `screens/gaps.js`      the truncation disclosure, refused as "a string the design of record does not declare".
  `screens/palette.js`   three sentences the design asks for, refused because "the string tables carry exactly eight `pal.` keys and no more ... so a ninth cannot be invented here".
  `screens/tut.js`       the bold run, refused on this premise on top of the real one (`lib/i18n.js`'s grammar has no emphasis marker, which is a separate and STILL-VALID blocker -- see `TASK-the-string-grammar-has-no-bold-run-so-three-of-the-mockup`).

Three of those say "in BOTH directions", which was true when written and is now wrong twice over. `tut.js` is the one site where correcting the premise changes nothing, because its second reason still holds -- that is what makes it worth listing rather than assuming.

AND IT HAS ALREADY PROPAGATED INTO THE CORPUS. `plan:walk seq:91`, filed 2026-08-29, says "`strings-parity.test.ts` holds the key set equal to the mockup's `data-t` set in both directions, so the mockup gains the `data-t` ... then this screen draws the paragraph". `plan:walk seq:6` is built entirely on the same premise -- "the mockup builds both out of English and Hebrew literals inside its own script, under no `data-t`, so neither has a key in either string table ... which is why simulate.js refused to word it at all". Both are describing a gate that was retired before they were written. Neither is wrong about what the mockup contains; both are wrong about what stops the app.

WHAT THE WORK IS, IN THIS ORDER, AND THE FIRST STEP IS NOT AN EDIT:

1. RE-MEASURE, do not trust this item either. Run `npx tsc --noEmit` and `node --test test/ui/strings-parity.test.ts`, read the tests it actually declares, and record which directions exist on the day the work is done. This task is itself a constraint quoted in prose and inherits the failure mode it describes.
2. CORRECT THE THIRTEEN COMMENTS. Each one currently tells its next reader that a fix is forbidden. That is worse than silence: it is a wrong answer in the place a reader looks first, and it is what kept these strings English through three passes of the walk.
3. RE-READ plan:walk seq:6 and seq:91 with the corrected premise. seq:6's three-step order ("give the mockup a `data-t`" first) is a design preference now, not a gate requirement, and the owner should be told which it is before the next mockup sitting is scheduled around it.
4. THEN the keyings, which are filed separately per screen and all name this task in `needs`.

WHAT DOES **NOT** CHANGE, and it must be said or this task will be read as licence. The mockup-facing direction that survives is the one that catches a DROPPED string, and it still fails. The en/he comparison is untouched and is still bidirectional -- a key added to `en.js` alone still fails, and Hebrew is still not optional. `DEC-claude-drafts-the-mockup-and-the-owner-approves` still governs any edit to the design of record. What was dropped is only the claim that the app may not say anything the mockup has not said first.

Filed under plan:walk seq:27, from the module headers of ask, config, docs, doctor, parts, proc, simulate and watch.
