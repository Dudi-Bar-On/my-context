---
id: TASK-documentation-a-code-span-inside-a-bold-run-loses-m-and-with
type: task
title: "Documentation: a code span inside a bold run loses .m, and with it the bidi isolation, twice on the one topic this screen serves"
status: active
severity: soft
always: false
summary: Code inside bold text loses its protection, so a path or a flag can display with its parts reordered inside right-to-left prose.
summary_of: 8c2b4d86a5ac89de
scope: []
tags:
  - v2
  - ui
  - walk
  - "screen:docs"
  - i18n
  - "plan:walk"
  - "seq:94"
  - "state:done"
origin: agent
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-29
valid_until: null
checksum: 84389af884e03dfd
plan: walk
seq: "94"
state: done
priority: "2"
progress: "0"
source: "plan:walk seq:27, measured against src/ui/public/screens/docs.js on 2026-08-29"
---

# Documentation: a code span inside a bold run loses .m, and with it the bidi isolation, twice on the one topic this screen serves

FOUND 2026-08-29 under plan:walk seq:27, from `screens/docs.js`'s own header, which reports it and does not fix it.

THE DEFECT, in the file's own words: "'Code spans win' is a TIE-BREAK, not a priority: a regex takes the leftmost match, so ``**`x`**`` is a bold run whose payload keeps its backticks as literal text and loses `.m` -- and with `.m` goes the `unicode-bidi:isolate` that makes a flag or a path read correctly inside RTL prose."

WHY IT IS NOT COSMETIC. `.m` is not decoration in this product; `styles.css` reserves it for "Direction KNOWN ltr: identifiers, paths, globs, commands, flags", and the isolation is what stops a glob or a `--flag` reordering mid-sentence on the Hebrew page. `e2e/bidi.spec.ts` exists because that reordering is real and was measured. So the failure mode is not "the backticks show" -- it is a path rendered with its segments reversed, inside a sentence that is telling the reader what the path is.

IT IS NOT HYPOTHETICAL AND IT IS ON THE ONLY DOCUMENT THIS SCREEN SERVES. The header records that the served `scope` topic "writes exactly that twice". `dv.t4` is the one Contents entry naming a topic in `UI_HELP_TOPICS`, so `§4 -- Scope` is what the second card renders on every visit -- both occurrences are on screen the first time anyone opens Documentation.

AND IT NOW REACHES THE CORPUS TOO. `plan:walk seq:37` pointed `screens/preview.js`'s `bodyNodes()` at `markdownNodes`, so any item body writing a path or a flag inside a bold run has the same loss.

WHAT THE FIX HAS TO WEIGH, because the header kept the behaviour deliberately and the reason is not silly: the alternation is the mockup's own, and changing which branch wins changes what a code span protects. So it is a DECISION about precedence and not a typo -- read `inlineNodes`' five-run order first, decide whether a code span inside an emphasis run nests or wins, and pin the answer with a test that asserts the `.m` survives. Measure the corpus for the inverse shape (a bold run inside a code span) before assuming the swap is free.

Filed under plan:walk seq:27. `screens/docs.js` reports this in its header and no task in the corpus carried it.
