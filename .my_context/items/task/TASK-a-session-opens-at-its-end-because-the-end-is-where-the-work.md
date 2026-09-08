---
id: TASK-a-session-opens-at-its-end-because-the-end-is-where-the-work
type: task
title: a session opens at its end, because the end is where the work is and where the follow starts
status: active
severity: soft
always: false
summary: Opening a conversation lands you at the newest turns rather than at the very first one, which is also what lets it start keeping up straight away.
summary_of: 2404196d9159641e
scope:
  - src/ui/public/screens/conversations.js
tags:
  - v2
  - archive
  - ui
  - "plan:archive"
  - "seq:23"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: d7feafb3c9e61e6d
plan: archive
seq: "23"
state: todo
priority: "1"
needs: archive/19
---

# a session opens at its end, because the end is where the work is and where the follow starts

Owner ruling 2026-09-08: "when the session is opened in conversation, scroll it to the end by
default."

WHAT HAPPENS TODAY, measured: a session opens at the TOP. `mountDocument` ends by calling
`applyFilter()`, and `applyFilter` contains `scroll.scrollTop = 0`. So every session opens at record
zero - which for the owner's own session means opening 28,998 records away from the part he is
actually working in.

AND IT COMPOSES WITH plan:archive seq:19 RATHER THAN MERELY BEING CONVENIENT. Opening at the end
means the reader opens AT THE TAIL, which is the state in which the document follows a live session.
Opening at the top means a reader who wants to watch his session fill up must first travel to the
end before the feature he asked for starts working. So this is the missing half of the follow, not a
preference about scroll position.

TRAP ONE, AND IT IS THE REASON THIS IS NOT A ONE-LINE CHANGE. `applyFilter` IS ALSO THE FILTER
HANDLER - `find.addEventListener('input', applyFilter)`. Resetting to the top on a filter change is
CORRECT and must stay: a reader who types a query wants the matches from the start of the session,
not the end of them. So the initial position cannot be changed by editing `applyFilter`; the mount
path and the filter path have to stop sharing that line. Whoever does this must not make typing in
the find box jump the reader to the bottom.

TRAP TWO: `scroller.total` IS A MEASUREMENT, NOT A CONSTANT, and this file already learned that the
hard way. The `stickUntil` deadline exists because `refill` sets a scroll to the end, `paint` then
asks the server for the bodies it is missing, and the measurement pass that follows moves
`scroller.total` UNDER the reader - the first draft counted paints instead of time and both were
spent before the new rows existed, leaving the reader a screenful above where they should have been.
A jump to the end at MOUNT hits exactly that, and worse, because at mount nothing has been measured
at all. So the landing must be held until the rows are really there, the way the follow path holds
it, rather than set once and hoped for.

AND IT MUST NOT BECOME A PIN. The three seconds `STICK_MS` buys are a ceiling released the moment
the reader touches `wheel`, `keydown` or `pointerdown`. Whatever holds the mount landing must be
released the same way: a reader who opens a session and immediately scrolls up is expressing intent,
and fighting them for three seconds is the wrong `seq:19` names in the other direction.

ONE THING TO DECIDE RATHER THAN ASSUME: whether "the end" is the last node or the last UNFILTERED
node when a filter is already applied at mount. Today no filter can be present at mount, so the two
are the same and the cheap answer is right - but say which one was chosen, because seq:10 adds
filtering across sessions and the two will diverge.

AND THE Top / End BUTTONS ALREADY EXIST (`toTop`, `toEnd`, both `button.tvjump`) and already do this
on click. This ruling changes the DEFAULT, and the buttons must keep working unchanged - in
particular Top must still go to the top, which is the affordance a reader needs MORE once the
default moves to the end.
