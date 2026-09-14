---
id: TASK-the-file-roster-serves-seven-unaccepted-drafts-as-corpus
type: task
title: the file roster serves seven unaccepted drafts as corpus items, and the predicate beside it disagrees with its own docblock
status: active
severity: soft
always: false
summary: Seven staged drafts nobody has accepted yet are being served as if they were real corpus items, and two rules in the same file disagree about whether that is allowed.
summary_of: 26ded081aecb4ba7
scope:
  - src/ui/read-model.ts
  - test/ui/corpus-files.test.ts
tags:
  - v2
  - ui
  - silent-failure
  - "plan:dxfindings"
  - "seq:5"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-14
valid_until: null
checksum: 55ae0eb20805cd0a
plan: dxfindings
seq: "5"
state: todo
priority: "2"
---

# the file roster serves seven unaccepted drafts as corpus items, and the predicate beside it disagrees with its own docblock

THREE SEPARATE LANES HIT THIS ON THE NIGHT OF 2026-09-13/14 AND EACH ONE CORRECTLY
DECLINED IT, which is why it is filed rather than fixed in passing: the rule store lane,
the CLI exit-code lane and the type-invariant lane all reported
`test/ui/corpus-files.test.ts` red, each proved it was not their change (the checks-file
lane proved it by a controlled revert), and each stopped because the repair lives in a
file another lane held.

WHAT FAILS. `the roster reaches nothing in .my_context except Markdown under items/`
finds seven paths under `.my_context/.drafts/task/`. They were written by the review
pass between 21:35 and 01:14 that night — drafts awaiting a human decision, gitignored
by `.my_context/.drafts/.gitignore` which is a single `*`.

IT IS A DEFECT AGAINST THE MODULE’S OWN WRITTEN BOUNDARY, not a product question, and
that is the finding. `src/ui/read-model.ts` states in its own words that a corpus file
is required to sit under the resolved `items/` directory and that the roster carries
every `.md` file under `.my_context/items/` AND NOTHING ELSE. A draft is not an item:
it is a candidate that a person has not yet accepted. The roster is built off the index,
not off a walk, so the drafts are in the INDEX — `mycontext list` answers 1,245.

AND TWO BOUNDARIES IN ONE FILE DISAGREE, which is the part worth fixing rather than
papering over. The neighbouring test asserts `isCorpusFilePath(file)` for every roster
path and it PASSES on these same seven — so the predicate admits `.drafts/` while the
docblock above it says `items/` only. One of the two is wrong and they cannot both stay.

WHERE THE REPAIR COULD GO, and this is the decision the item carries rather than
presumes:
  1. THE INDEXER stops indexing `.my_context/.drafts/**`. Widest blast radius, and the
     most likely to be right — a draft is not an item anywhere, not only on this screen.
     Everything downstream of the index inherits the fix.
  2. `isCorpusFilePath` narrows to `items/**.md`. Smallest change, and it makes the
     predicate agree with the sentence written directly above it.
  3. The Library deliberately SHOWS drafts, and the test is what is wrong. Possible, but
     nothing in the corpus says so and the docblock says the opposite.

RECOMMENDATION: 2 first, because it closes the disagreement the file already contains
and is provable in one assertion; then measure whether 1 is owed, because an indexed
draft may be reaching more than this one roster. Do NOT take 3 without an owner ruling.

A NOTE ON REPRODUCING IT: it only appears when drafts exist, so it is invisible on a
clean corpus and will come and go as the review pass stages and a person promotes. That
is what let it sit: it looks like flakiness and is not.
