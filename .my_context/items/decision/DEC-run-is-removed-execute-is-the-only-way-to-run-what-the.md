---
id: DEC-run-is-removed-execute-is-the-only-way-to-run-what-the
type: decision
title: Run is removed; Execute is the only way to run what the Composer composed
status: active
severity: soft
always: false
summary: The command builder keeps one button that really runs things, instead of two that could disagree.
summary_of: 96034178877ce0fa
scope:
  - src/ui/public/lib/palette-defs.js
  - src/ui/public/screens/palette.js
tags:
  - v2
  - ui
  - composer
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-06
valid_until: null
checksum: 861156d6244d4a4f
---

# Run is removed; Execute is the only way to run what the Composer composed

Owner ruling 2026-09-06, after asking the question nobody had: "why do we need run? because after
execute we get run it so maybe the run actually not required?"

MEASURED, and it is the answer: RUN PREDATES EXECUTE. `readTarget` arrived in `e5696b9` when this
console was strictly read-only and could not run anything at all, so Run fetched a read endpoint
that served an EQUIVALENT answer. Execute arrived later in `3702b1a` - "a command can be composed
without being licensed to run" - and runs the real command. Run covers about six read entries;
Execute covers twenty-nine. EVERY entry with Run also has Execute.

So Run is not a second feature, it is the older mechanism kept past the arrival of the thing that
replaced it - and for `list` and `help` its approximation had become simply wrong: `mycontext list
rule` answered 966 rows of every type where the CLI answers 52.

WHY REMOVAL RATHER THAN REPAIR. Fixing the two entries patches two instances of a class; removing
the mechanism deletes the class. No tenth entry can drift later, because there is no longer a
second answer to drift from. It also removes the Hebrew defect by removing one of the two buttons -
`pal.run` and `exec.btn` were both `הרצה`, two adjacent controls with the identical label. The
owner had chosen `הצגה` for Run; that ruling is now moot and is recorded here so nobody applies it.

WHAT IS LOST, stated rather than glossed: Run rendered STRUCTURED ROWS from a JSON endpoint, while
Execute shows the CLI’s own ASCII table. That is a real difference in presentation. It is affordable
because `builder/13` made ids clickable in BOTH - the structured cell and the text output - so the
gesture a reader actually uses survives the removal.

AND IT SHRINKS D12. `builder/11` tests this surface exhaustively and its bar is "execute and run
return correct results". With one verb there is one thing to prove per entry rather than two plus
their agreement.
