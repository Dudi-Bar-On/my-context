---
id: TASK-the-hebrew-readme-s-yes-row-is-hand-kept-and-had-drifted-by
type: task
title: the Hebrew README's --yes row is hand-kept and had drifted by five commands with nothing checking it
status: active
severity: soft
always: false
summary: The English flag table's --yes row is held to the real parser in both directions; the Hebrew mirror's is not, and it was five command strings behind before anybody looked.
summary_of: a26c49f1a83ab8bd
scope:
  - docs/README.he.md
  - test/plugin-assets.test.ts
tags:
  - v2
  - docs
  - "plan:archive"
  - "seq:36"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: f3dca71435be82d8
plan: archive
seq: "36"
state: todo
---

# the Hebrew README's --yes row is hand-kept and had drifted by five commands with nothing checking it

Found by `plan:archive seq:4` while adding `mycontext conversation persist` to the gate lists, and
REPAIRED BY HAND rather than mechanically — which is exactly the shape of defect this repository
keeps finding, so the repair is not the fix.

WHAT WAS MEASURED, 2026-09-09. `test/plugin-assets.test.ts` holds `README.md`'s `--yes` row to
`approvalBoundary().gated` as a SET EQUALITY in both directions, and its own comment records why:
the row once named twelve of fourteen and the literal regex that pinned it "could only notice a
REMOVAL". Adding a fifteenth gated command reddened it immediately, which is the mechanism working.

THE HEBREW ROW IS NOT HELD TO ANYTHING. `docs/README.he.md`'s `--yes` row named eleven command
strings and the parser accepts fifteen. The five it was missing — `carry`, `config`,
`conversation forget`, `statusline install`, `statusline uninstall` — arrived over four separate
rounds, and no test in the suite reads that row at all.

WHY THE EXISTING HEBREW TEST DOES NOT COVER IT. `the Hebrew mirror carries the same deny list and
names the same gated commands` parses rows shaped `| \`mycontext <verb>\` |` out of the ENGLISH
document and requires each named command to appear somewhere in the Hebrew text. The `--yes` row is
shaped `| \`--yes\` |`, so it is not one of the rows that parser collects, and a command named only
there is invisible to it. The deny block IS compared element for element, because it is JSON — so
the half of the security section that is data is checked and the half that is prose is not.

WHAT WOULD ACTUALLY FIX IT, and it is small: command names are LATIN IN BOTH DOCUMENTS, which is
the property the existing Hebrew test already relies on. So the Hebrew `--yes` row can be held to
`approvalBoundary().gated` by exactly the assertion the English one carries, with the row located
by its own `--yes` cell rather than by prose. Nothing about the sentence around it needs reading.

WHAT THIS LANE DID INSTEAD: brought the row up to the parser's answer by hand, in the same commit
as the English one. That is the fifth round of hand-keeping, and it will drift again on the sixth.
