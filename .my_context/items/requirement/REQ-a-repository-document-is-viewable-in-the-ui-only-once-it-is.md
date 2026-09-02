---
id: REQ-a-repository-document-is-viewable-in-the-ui-only-once-it-is
type: requirement
title: a repository document is viewable in the UI only once it is part of the corpus
status: active
severity: hard
always: false
summary: A document becomes viewable only once it has been brought into the collection; sitting somewhere in the project is not enough on its own.
summary_of: 0a0184956d9898e0
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
checksum: ce209501f1676436
---

# a repository document is viewable in the UI only once it is part of the corpus

OWNER REQUIREMENT, 2026-08-26, given with the route ruling: "Readme is in the repo but to be displayed it should also be located as part of the corpus even copied to there if required (when it is changed) including the hebrew version too and this rule is relevant also for any tutorial and document that are in the repo but we want them to be viewed in the ui".

THE RULE. Being in the repository does not make a document viewable. Being IN THE CORPUS does -- reachable through `watchedDocs`, and copied under the corpus if that is what it takes, with the copy refreshed when the source changes. The UI serves the corpus; it does not serve the checkout.

THIS IS WHAT MAKES THE ROUTE BOUNDARY HOLD. `DEC-the-markdown-viewer-lives-in-coverage-and-renders-by-id` narrows the route to what `watchedDocs` matches, and the obvious objection is "then README is unreachable" -- which `docs.js` already records as a live defect. This requirement is the answer: the fix is to bring the document INTO the corpus, not to widen the route until the checkout is exposed. The narrow boundary and the wide reach are not in tension once the document moves.

NAMED EXPLICITLY BY THE OWNER: `README.md`, ITS HEBREW VERSION, and every tutorial. The Hebrew one matters twice over -- it is the case where a "just serve the repo file" shortcut would have quietly served one language and not the other.

WHAT IS NOT YET DECIDED, and must be before this is built: WHO REFRESHES THE COPY and WHEN. A copy that goes stale silently is worse than no copy, because the reader has no way to tell which one they are looking at. The candidates are the same three this project always faces -- a hook on write, a check in `doctor`, or a step in `init`/`refresh` -- and the answer has to make staleness VISIBLE rather than merely unlikely.

IT ALSO TOUCHES `watchedDocs` S OTHER JOB: the same list drives the capture nudge in `src/hooks/post-tool-use.ts`. Adding a document to it to make it VIEWABLE also makes editing it NUDGE. That may well be right -- a document worth reading in the UI is plausibly a document worth capturing from -- but it is a consequence, not a coincidence, and whoever builds this has to say so out loud.
