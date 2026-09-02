---
id: DEC-the-procedure-done-command-belongs-to-each-procedure-card
type: decision
title: the procedure done command belongs to each procedure card
status: active
severity: soft
always: false
summary: A command that names one particular thing belongs on that thing's own card; one shared copy would be silently wrong for everything except the one it names.
summary_of: 0127b1f81b119458
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - tree-parity
  - "screen:proc"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: d4a17f94b30f0033
---

# the procedure done command belongs to each procedure card

OWNER RULING, 2026-08-24, on tree-parity findings proc #06 and #11.

The mockup draws one `.cmd` copy-block inside the prose card, between the third paragraph and the abandonment note. The app draws one inside EACH procedure card. THE APP IS RIGHT, and the MOCKUP is updated to match.

THE REASON: the command is `mycontext procedure done <ID>` and it carries a specific id. One shared block can only ever quote one procedure, so on a screen showing more than one it is silently wrong for every card but the one it names. The mockup s sample scene holds exactly one procedure, which is why the defect cannot be seen there -- the design is not wrong about the layout, it was drawn over a scene too small to expose the question.

THIS IS THE APP CORRECTING THE DESIGN, which is rare enough to name: the standing rule sends changes the other way. It is admitted here because the reason is a correctness one and not a taste one.

NOT A DEFECT, checked while ruling: PROC-RESTORE-A-CORPUS-FROM-AN-EXPORT renders no command row while the other two do. `doneCommand` returns null unless the stage is active, and that procedure is done. Offering to mark a done procedure done is the bug; not offering it is the fix already in place.

The work is plan:walk seq:3.
