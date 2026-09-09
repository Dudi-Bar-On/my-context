---
id: TASK-the-hebrew-readme-s-yes-row-is-hand-kept-and-had-drifted-by
type: task
title: the Hebrew README's --yes row is hand-kept and had drifted by five commands with nothing checking it
status: active
severity: soft
always: false
summary: The English flag table's --yes row is held to the real parser in both directions; the Hebrew mirror's is not, and it was five command strings behind before anybody looked.
summary_of: 660fc5f4a569e856
scope:
  - docs/README.he.md
  - test/plugin-assets.test.ts
tags:
  - v2
  - docs
  - "plan:archive"
  - "seq:36"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-09
valid_until: null
checksum: b669ba04d648972c
plan: archive
seq: "36"
state: done
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

---

DONE 2026-09-09, commit `32718cf0` — and the sixth round of hand-keeping cannot happen

WHAT THE ASSERTION NOW HOLDS. `test/plugin-assets.test.ts` carries a new test, `the Hebrew
mirror's --yes row names exactly the commands the parser gates`, which is
`assert.deepEqual(yesRowCommands(read('docs', 'README.he.md')), [...approvalBoundary().gated].sort())`
— a SET EQUALITY IN BOTH DIRECTIONS against the same derivation the English row is held to. Today
both rows and the probe agree on the same 24 command strings (the 20 gated commands plus `edit`'s
four named forms `pin`, `unpin`, `harden`, `soften`).

ONE PARSER FOR BOTH DOCUMENTS, NOT A SECOND COPY. There is one claim — *this row names the command
strings the parser accepts `--yes` on* — so the English assertion's inline row-reading was lifted
into a module-level `yesRowCommands(markdown, where)` and both documents are now held by it. Two
copies of the parser would have been the same defect this item is about, one layer down.

HOW THE ROW IS FOUND IN A RIGHT-TO-LEFT DOCUMENT. By its own `--yes` cell, never by the prose
around it, after stripping the `<span dir="ltr">` bidi wrappers the mirror puts around every Latin
run — including the `--yes` cell itself, which is why the strip is load-bearing rather than tidy: a
locator that did not strip them finds NO row in that document and would have had to be told by hand
what the row looks like there. No Hebrew sentence is read, and the test claims nothing about the
sentence around a command. That remains a review obligation.

THE PROOF THAT IT FAILS IN BOTH DIRECTIONS, run before it was shipped.

- REMOVAL. Dropping `` `carry`, `` from the Hebrew row's third cell reddens the new test, naming
  `carry` in the diff (`- 'carry'`). 17 pass, 1 fail.
- ADDITION. Adding `` `ui` `` to that row — a real registered command the boundary does not gate —
  reddens it naming `ui` (`+ 'ui'`). This is the direction the English row's replaced literal regex
  could not see, and the reason the row went stale at twelve of fourteen while its pin stayed green.

The document was restored with `git checkout --` after each run; the shipped commit touches
`test/plugin-assets.test.ts` only, because the row itself was already correct.

WHAT WAS CHECKED FOR THE SAME DEFECT AND IS NOT IN IT. §7's gate table is already held in BOTH
languages, both directions, by `both documents enumerate the whole approval boundary, and nothing
else` (`test/docs/counts.test.ts`), and the recommended `permissions.deny` block by `both documents
deny every command on the approval boundary` — so `--yes` was the outlier, not the first of a set.

WHAT IS STILL HAND-KEPT, MEASURED AND LEFT: §12's flag tables carry 77 rows in each document
(identical flag-name sets today) and `--yes` is the ONLY one whose "where it works" cell is held to
anything, in either language. The other 76 are hand-kept in both documents equally — an unheld gap,
not the asymmetry this item names — and holding them needs a generalization of `gatedCommands()` to
probe an arbitrary flag rather than `--yes`, which is a change to
`test/helpers/approval-boundary.ts` and its own piece of work.
