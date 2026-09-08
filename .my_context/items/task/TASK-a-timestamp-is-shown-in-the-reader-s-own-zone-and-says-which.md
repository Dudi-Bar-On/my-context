---
id: TASK-a-timestamp-is-shown-in-the-reader-s-own-zone-and-says-which
type: task
title: a timestamp is shown in the reader's own zone, and says which zone that is
status: active
severity: soft
always: false
summary: Times in a saved conversation are shown in the reader's local clock and name the zone, instead of silently showing a different one.
summary_of: 8566d99fb6a0d775
scope:
  - src/ui/**
  - src/cli/commands/conversation.ts
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:18"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: c546940ccd6fb9ab
plan: archive
seq: "18"
state: done
priority: "1"
---

# a timestamp is shown in the reader's own zone, and says which zone that is

Found 2026-09-08 by the owner, and his diagnosis was better than mine. He reported "about 3 hours
missing" from the archive. It is not missing: THE VIEWER RENDERS THE STORED UTC STAMP RAW, and he is
UTC+3. Measured the same minute: 14:11Z here, 17:11 on his clock. Every time in the document reads
exactly three hours behind, so a session that ran until 17:00 looks like it stopped at 14:00.

NOTHING IS ABSENT. This is a formatting defect and it produced a false report of data loss, which is
the more expensive kind: it sent me to measure a stale index when the screen was simply lying about
the clock.

AND IT IS NOT THE SAME BUG AS plan:archive seq:14, though they were reported together. seq:14 is
real and separate: the index still says his session ended 2026-09-07T00:50 while the file is
current. One is a day of missing CONTENT; this is three hours of wrong PRESENTATION.

WHAT TO BUILD: render in the reader's local zone AND NAME THE ZONE. A bare local time is only
unambiguous to someone who already knows which clock it is - and a transcript is exactly the artefact
somebody reads on a different machine, in a different country, months later. The stored value stays
UTC; only the display moves.

THE TRAP, and it will bite whoever does this: THIS PROJECT PINS RENDERING FOR DETERMINISM.
test/helpers/pin-rendering.ts exists, and a lane had to pin toLocaleString('en-US') for a thousands
separator because a bare locale call differs by machine. A naive toLocaleString() here makes the
tests machine-dependent and the failure will look like flake. Pin the locale; take the ZONE from the
reader.

AND THE HEBREW STAMP IS ALREADY DELICATE: the viewer lane found a stamp reordering to
"09:00 2026-09-08" under RTL, because a date and a time are two neutral runs, and fixed it with
dir="ltr" on the <time> element. Whatever formatting lands must keep that.

ONE QUESTION TO ANSWER RATHER THAN ASSUME: whether the LIST and the CLI table need the same
treatment. `mycontext conversation list` prints the raw Z stamp too. A reader comparing the screen
against the terminal must not see two different times for one session.

CLOSED 2026-09-08.

ONE SPELLING, AND IT IS `zonedStamp(at, timeZone)` - `src/ui/public/lib/viewmodel.js`, with a
TypeScript twin in `src/cli/commands/format.ts` because viewmodel.js is untyped browser JS, kept
in step by `test/ui/zoned-stamp-parity.test.ts` across six zones by six instants. It renders
2026-09-08 17:11 GMT+3.

THE TRAP THIS ITEM NAMED WAS AVOIDED, and by more than pinning the locale. The locale is pinned to
en-GB, but the ORDER is assembled from formatToParts rather than trusted to the locale, so no ICU
build can reorder the fields; hourCycle h23 rather than hour12 false, which some ICU builds
disagree about; and one cached Intl.DateTimeFormat per zone. The zone is passed through, so
undefined means the RUNTIME reader - the browser - and never the server.

AND THE ZONE IS AN OFFSET, NOT AN ABBREVIATION. GMT+3 rather than IST, because an offset is
readable by someone who does not know what IST stands for, and the reader who needed this was
reading a clock he already knew.

A REFUSAL RATHER THAN A GUESS: `zonedStampOf` returns null instead of raw text when the instant
will not parse, so the archive draws NO stamp rather than an unzoned one. The `datetime` attribute
and `conversation --json` both still carry stored UTC - the value never moved, only the display.

THE ITEM WAS WRONG ABOUT ONE THING, and the correction matters more than the fix. It said the
Hebrew bidi case was protected by a browser test. It was not: `time.tvat` appeared once in e2e/
asserting only the datetime attribute, and the dir="ltr" repair was carried by a code comment and
a screenshot - nothing executable. The missing test now exists, with computed-direction and
Range-based visual-order assertions, plus a describe block running the browser in Asia/Jerusalem
to prove the three-hour shift on both the document and the list. Naming the zone made the stamp
THREE neutral runs rather than two, so the bidi rule had a third field to move and now has a test.

VERIFIED: tsc clean; 13/13 on the two unit files; and the browser suite 54/54 through
e2e/playwright.config.ts across both projects.

AND HOW THAT SUITE IS RUN IS PART OF THE RECORD, because getting it wrong produced a false
regression report. `npx playwright test e2e/<spec>` from the repo root does NOT load
e2e/playwright.config.ts, so it runs with NO pinned colorScheme, locale, timezone or viewport -
and this is the first work in the file whose assertions depend on that pin. Run it as package.json
does: `playwright test --config e2e/playwright.config.ts`. Read wrongly, a correct test asserting
GMT+0 fails with GMT+3 on a UTC+3 machine and looks exactly like the machine-dependence this item
warned about.

FOUND AND NOT FIXED, deliberately and filed as plan:walk seq:142: the same defect in two shapes on
five more surfaces - audit.ts stamp() still slices the Z off, and wallStamp/clockOf/stampOf convert
correctly but carry no timeZoneName at all.
