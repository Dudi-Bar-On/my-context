---
id: REQ-markdown-documents-in-the-repository-are-browsable-and
type: requirement
title: markdown documents in the repository are browsable and viewable, rendered
status: active
severity: hard
always: false
summary: A reader can find a written document belonging to the project and read it properly formatted without leaving the application.
summary_of: 1c2ad9b21c209f9c
scope: []
tags:
  - v2
  - ui
  - owner-requirement
  - documentation
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 3f391dc69ca5c084
---

# markdown documents in the repository are browsable and viewable, rendered

OWNER REQUIREMENT, restated 2026-08-25: "i have added a requirement long time ago about browsing and viewing markdown files rendered".

IT IS NOT IN THE RECORD. Searched the same day: all 6 requirements, 22 rules and 338 tasks in this corpus; all seven design specs; the plans; and the mockup s twenty-one sections. THREE THINGS COME CLOSE AND NONE OF THEM IS THIS:

1. THE FILE BROWSER, in the web-ui spec under Navigate, marked "Merged": "The earlier version conceded it was the coverage map made navigable... It is now the coverage map s DETAIL PANE: select a node, get what governs it, what would be injected, and links to the items." That is built -- coverage s "What governs" card. It tells you what governs a file. IT NEVER SHOWS THE FILE.

2. THE DOCUMENTATION SCREEN renders markdown, but only the four reachable `mycontext help` topics.

3. THE ITEM DETAIL PANE renders a corpus ITEM s markdown in a bdi well (`pane.well`). An item is not a file.

SO THE REQUIREMENT IS RECORDED HERE FOR THE FIRST TIME. A reader can find a markdown document in this repository and READ IT, rendered, without leaving the UI.

WHY IT BELONGS: the corpus cites source documents by path and fragment; `source_drift` reports that one has changed; `watchedDocs` names the globs worth watching. Every one of those points at a document the UI can name and cannot open. A reader told "its source document changed since the snapshot" has nowhere to go and look.

TWO THINGS ARE DELIBERATELY NOT DECIDED HERE, and both are the owner s -- see the open question of the same date: WHICH SCREEN hosts it, and WHAT THE SERVER IS ALLOWED TO SERVE. The second is a security boundary, not a detail: no route serves an arbitrary path today, and docs.js already had to record that `README.md` is unreachable because it sits outside `src/ui/public/`.

DONE WHEN: a markdown document this corpus can name is reachable from the UI and rendered by the same subset renderer the Documentation screen uses, with the same refusals; and the set of documents it will serve is a decided, tested boundary rather than a path join.
