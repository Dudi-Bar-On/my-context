---
id: TASK-five-more-surfaces-show-a-time-that-does-not-say-which-clock
type: task
title: five more surfaces show a time that does not say which clock it is in, and one still shows UTC with the Z cut off
status: active
severity: soft
always: false
summary: Times on five other screens either show the wrong clock or the right clock without saying so, which is the same confusion that once made an hour of work look missing.
summary_of: 0b871b5bbe53ec0a
scope:
  - src/cli/commands/audit.ts
  - src/ui/public/screens/parts.js
  - src/ui/public/lib/viewmodel.js
tags:
  - v2
  - ui
  - time
  - "plan:walk"
  - "seq:142"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 6e07907aa01bfbf2
plan: walk
seq: "142"
state: todo
priority: "2"
---

# five more surfaces show a time that does not say which clock it is in, and one still shows UTC with the Z cut off

FOUND 2026-09-08 by the archive/18 lane, in the sweep it was told to do rather than assume: the
timestamp defect that cost the owner a false report of three missing hours exists on five more
surfaces, in TWO different shapes. Neither was fixed there, because plan:archive seq:18 is scoped to
the conversation viewer and a diff that argued two things would have been worse than a second item.

SHAPE ONE - AN ISO SLICE THAT DROPS THE ZONE, and it is the ORIGINAL defect verbatim.
`src/cli/commands/audit.ts` - `function stamp(at: string): string` - returns
`at.slice(5, 10) + ' ' + at.slice(11, 19)`. That is stored UTC with the `Z` cut off and nothing put
in its place, which is exactly what the conversations screen was doing when the owner reported hours
of his session missing. It renders the audit table's `when` column.

SHAPE TWO - THE CORRECT HALF WITHOUT THE NAMING HALF. `wallStamp` (`src/ui/public/lib/viewmodel.js`
- `export function wallStamp`), `clockOf` and `stampOf` (`src/ui/public/screens/parts.js`) all DO
convert to the reader's own clock, through `toLocaleString`/`toLocaleTimeString` pinned to `en-GB`.
So the digits are right. But there is not one `timeZoneName` between the three of them - measured,
`grep -c timeZoneName src/ui/public/screens/parts.js` is 0 - so a converted local time never says
which clock it is in. Surfaces: the Audit stream, Ask, the injection preview's `When`, and the wall
clock on BOTH status bars.

AND THE HAZARD IS THE COMBINATION, WHICH IS WORSE THAN EITHER ALONE. Shape one prints UTC that looks
local. Shape two prints local that could be anything. They appear near each other - the audit table
and the audit stream are the same subject on the same screen - so a reader comparing two stamps is
comparing two different clocks with neither of them saying so, and the arithmetic they do in their
head is silently wrong. That is a harder failure to catch than the original, because in the original
the digits were visibly odd once he thought to check; here both readings look plausible.

WHAT TO DO, and seq:18 already built the answer so this must not invent a second one:
`zonedStamp(at, timeZone)` exists in `src/ui/public/lib/viewmodel.js` with a TypeScript twin in
`src/cli/commands/format.ts`, kept in step by `test/ui/zoned-stamp-parity.test.ts`. It pins the
locale to `en-GB`, assembles the order from `formatToParts` so a locale cannot reorder it, uses
`hourCycle: 'h23'`, and names the zone as an OFFSET (`GMT+3`) rather than an abbreviation, because
an offset is readable without knowing what IST means. Use it. Do not grow a third spelling.

THREE THINGS TO DECIDE RATHER THAN ASSUME:
  - THE CLI IS NOT THE BROWSER. `audit.ts` runs in a terminal where the zone is the machine's, and
    that is legitimately the reader's zone there. Converting is right; the question is only whether
    a terminal column has room for the marker. If it does not, say so and shorten the DATE, never
    the zone - the marker is the entire point of this item.
  - `--json` OUTPUT MUST NOT MOVE. seq:18 left `conversation --json` on stored UTC deliberately. Any
    machine-readable output stays UTC; only human columns convert.
  - A STATUS BAR IS THE TIGHTEST SPACE IN THE PRODUCT. `GMT+3` is five characters that have to come
    from somewhere. Measure the bar before widening it.

AND THE BIDI RULE TRAVELS WITH THIS. Naming the zone makes a stamp THREE neutral runs instead of
two, and a previous lane already found `2026-09-08 09:00` drawn as `09:00 2026-09-08` on the Hebrew
page. Every surface that gains a marker needs the `dir="ltr"` the viewer has, and a test in Hebrew -
seq:18's own e2e assertions are the pattern.
