---
id: TASK-the-ask-says-handover-due-and-could-say-what-is-actually
type: task
title: the ask says "handover due" and could say what is actually true of it
status: active
severity: soft
always: false
summary: Both surfaces describe the handover in a unit that hides how far behind it is, and neither says that more requests are coming.
summary_of: 70652c6ef149962c
scope:
  - src/cli/commands/statusline.ts
  - src/ui/public/strings/en.js
  - src/ui/public/strings/he.js
  - src/ui/watch-model.ts
tags:
  - v2
  - handover
  - ui
  - statusline
  - "plan:handover"
  - "seq:13"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: c559c9b9e4780f29
plan: handover
seq: "13"
state: done
priority: "2"
needs: handover/12
---

# the ask says "handover due" and could say what is actually true of it

Owner instruction 2026-09-06, immediately after D14 landed: the ASK on the status line and the web
status bar "currently shows handover due and in my opinion should be more informative".

HE IS RIGHT, AND D14 IS WHAT MAKES IT FIXABLE. Before today the mechanism knew two things - whether
an ask had fired and whether the file had been touched since. There was nothing more informative to
say. It now knows the percent the ask fired at, the percent now, whether the answer is still
current, and how many of the sixteen steps remain.

WHAT IS SHOWN TODAY:

  strip.hoActed     "handover written {age} ago"
  strip.hoIgnored   "handover asked for and not written"
  strip.hoNotAsked  "handover not yet asked"
  strip.ctxWarn     "handover near"
  strip.ctxCrit     "{b:handover due}"
  statusline        ASK <bar> 34% (28.5 / 85) +56.5

AND THE FIRST ONE IS NOT MERELY THIN, IT IS THE MEASURE THAT HID THE DEFECT. "written {age} ago" is
AGE, and age is a proxy for currency. The handover review measured three windows where the row said
acted-on and the handover was 2h39m, 1h24m and 3h06m behind - written at 85% and carried to 99.9%,
96.1% and 96.6%. A reader glancing at "written 3h ago" learns the wrong thing twice: that something
happened, and that time is the unit that matters. The unit that matters is PERCENT.

AND THE STATUS LINE IS NOW STALE BY CONSTRUCTION. "(28.5 / 85) +56.5" is progress toward THE ask.
Since D14 there is no such thing - there are up to sixteen, one per whole percent from the threshold
to 100. A bar that fills once and then means nothing for the remaining fifteen percent of the window
is worse than no bar, because it reads as finished.

WHAT WOULD BE INFORMATIVE, and each of these is now derivable rather than guessed: the percent the
standing handover was written at and the percent now, so its staleness is visible as the number that
caused it; whether the current ask has been answered IN THIS PERCENT; and that more asks are coming,
so a reader is not surprised by the next one.

TWO THINGS NOT TO BREAK. The strip deliberately keeps two questions apart in two fields with two
colours - "how much room is left" and "has the ask fired" - and title.fillOk says so in its own
words. Do not merge them to save space. And every string here is keyed in both tables; Hebrew moves
with English or the two drift, which is the failure this project spent a day closing.
