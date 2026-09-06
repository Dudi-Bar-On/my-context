---
id: REQ-a-repository-document-is-viewable-in-the-ui-only-once-it-is
type: requirement
title: a repository document is viewable in the UI only once it is part of the corpus
status: active
severity: hard
always: false
summary: A document becomes viewable only once it has been brought into the collection; sitting somewhere in the project is not enough on its own.
summary_of: f55793e935243c6b
scope: []
tags:
  - v2
  - ui
  - owner-requirement
  - design
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-26
valid_until: null
checksum: 1d86b8f7cf7f264c
---

# a repository document is viewable in the UI only once it is part of the corpus

OWNER REQUIREMENT, 2026-08-26, given with the route ruling: "Readme is in the repo but to be displayed it should also be located as part of the corpus even copied to there if required (when it is changed) including the hebrew version too and this rule is relevant also for any tutorial and document that are in the repo but we want them to be viewed in the ui".

THE RULE. Being in the repository does not make a document viewable. Being IN THE CORPUS does -- reachable through `watchedDocs`, and copied under the corpus if that is what it takes, with the copy refreshed when the source changes. The UI serves the corpus; it does not serve the checkout.

THIS IS WHAT MAKES THE ROUTE BOUNDARY HOLD. `DEC-the-markdown-viewer-lives-in-coverage-and-renders-by-id` narrows the route to what `watchedDocs` matches, and the obvious objection is "then README is unreachable" -- which `docs.js` already records as a live defect. This requirement is the answer: the fix is to bring the document INTO the corpus, not to widen the route until the checkout is exposed. The narrow boundary and the wide reach are not in tension once the document moves.

NAMED EXPLICITLY BY THE OWNER: `README.md`, ITS HEBREW VERSION, and every tutorial. The Hebrew one matters twice over -- it is the case where a "just serve the repo file" shortcut would have quietly served one language and not the other.

WHAT IS NOT YET DECIDED, and must be before this is built: WHO REFRESHES THE COPY and WHEN. A copy that goes stale silently is worse than no copy, because the reader has no way to tell which one they are looking at. The candidates are the same three this project always faces -- a hook on write, a check in `doctor`, or a step in `init`/`refresh` -- and the answer has to make staleness VISIBLE rather than merely unlikely.

IT ALSO TOUCHES `watchedDocs` S OTHER JOB: the same list drives the capture nudge in `src/hooks/post-tool-use.ts`. Adding a document to it to make it VIEWABLE also makes editing it NUDGE. That may well be right -- a document worth reading in the UI is plausibly a document worth capturing from -- but it is a consequence, not a coincidence, and whoever builds this has to say so out loud.

AMENDED 2026-09-06, ON THE OWNER'S OWN RULING, AND THE SENTENCE BEING CORRECTED IS NAMED RATHER THAN QUIETLY REWRITTEN. The clause "The UI serves the corpus; it does not serve the checkout" above stood while the product did the opposite of both halves, and that contradiction was found twice and stepped over twice. The owner ruled to resolve it on the record: "widen the served set AND fix the requirement that contradicts it" (`reports/V2-HANDOVER.md`, carried at 90%, 93%, 94%, 95% and 96%). The full working, the security envelope and the shape of the fix are `DEC-the-ui-serves-the-corpus-through-its-own-route-rather-than`; what follows is only what this requirement now MEANS.

THE POSITIVE HALF IS NOW TRUE, AND IT WAS UNBUILT UNTIL TODAY. `GET /api/corpus` and `GET /api/corpus/:id` serve `.my_context/items/**/*.md` off the index's own `file_path` column, and the Library browses them as a nested tree. Until this shipped, the corpus was the one thing the UI could not serve.

THE NEGATIVE HALF WAS ALREADY NARROWED BY THE OWNER, ELEVEN DAYS AFTER THIS ITEM WAS WRITTEN, AND NOBODY RECORDED IT HERE. `DEC-the-documentation-system-is-hand-built-over-a-wide-glob`, owner ruling 2026-09-05: "The boundary is the wider glob over docs and reports rather than watchedDocs alone. A documentation system that cannot show a report is not one, and most of what this project actually knows is written in reports." That is a later ruling by the same person on the same question, and it is why `reports/**` -- which `watchedDocs` does not claim -- is served today. The requirement was never amended to say so, so for eleven days the record read as a live contradiction when the decision had in fact been taken.

WHAT IS IN FORCE, AFTER BOTH RULINGS. Two boundaries, each enumerated and each measured, and nothing outside either:

  THE CORPUS. `isCorpusFilePath` (`src/doctor/checks.ts`) -- Markdown under the workspace's own `items/`, rostered from the index rather than from a walk, every id a key and never a path.

  THE DOCUMENTS. `isServableDocPath` (same file) -- `README.md`, and `.md` under `docs/` or `reports/`. This is the owner's wide-glob ruling, not an accident, and it is unchanged by today's work.

WHAT REMAINS FORBIDDEN, which is what this requirement was actually written against: serving the CHECKOUT AT LARGE. Neither boundary may be widened into "whatever is on disk", no route may join a caller's string onto a path, and a document that is neither in the corpus nor in the named document set is not viewable by being in the repository. Bringing a document INTO the corpus is still the way to make it viewable, and that is still the answer to "then README is unreachable".

EVERY OTHER CLAUSE OF THIS REQUIREMENT IS UNCHANGED, AND TWO OF THEM ARE STILL OPEN. Who refreshes a copy and when is still undecided, and `watchedDocs`' second job -- driving the capture nudge -- is still a consequence anyone adding to that list has to say out loud.
