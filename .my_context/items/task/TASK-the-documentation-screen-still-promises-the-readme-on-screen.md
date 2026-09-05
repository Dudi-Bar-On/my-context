---
id: TASK-the-documentation-screen-still-promises-the-readme-on-screen
type: task
title: the Documentation screen still promises the README on screen, a ruling three weeks old that was never carried into the mockup or either string table
status: active
severity: soft
always: false
summary: Corrects a shipped screen sentence that still promises the README, three weeks after the owner ruled it should say it serves help topics instead.
summary_of: bac72b7295910b1e
scope:
  - docs/design/web-ui-mockup.html
  - src/ui/public/strings/en.js
  - src/ui/public/strings/he.js
tags:
  - v2
  - ui
  - documentation
  - "screen:docs"
  - "plan:docsys"
  - "seq:1"
  - "state:done"
origin: human
source_file: "C:/Users/UserC/AppData/Local/Temp/claude/D--Users-UserC-source-repos-my-context/595db3b1-a481-4553-b4c0-7248c31b2655/scratchpad/docsys/1.md"
source_anchor: null
source_checksum: d6934660463ba297
valid_from: 2026-09-05
valid_until: null
checksum: 342fe09cfc481838
plan: docsys
seq: "1"
state: done
priority: "1"
verified_on: 2026-09-05
---

# the Documentation screen still promises the README on screen, a ruling three weeks old that was never carried into the mockup or either string table

> Found 2026-09-05 under `reports/2026-09-05-documentation-screen-definition.md`, researching the
> Documentation screen for `REQ-the-two-readmes-are-the-base-of-a-documentation-system-that`.
>
> `docs/design/web-ui-mockup.html:3690`, `src/ui/public/strings/en.js:1205` and
> `src/ui/public/strings/he.js:830` (`dv.sub`) still read "The README in this repository, rendered
> here … addressed by heading ordinal." `dv.v` still reads "cross-linked to your own corpus, which a
> docs site cannot do." Both were found false and RULED on 2026-08-25 by
> `DEC-the-documentation-screen-serves-the-help-topics-and-says-so`: "the screen serves `mycontext
> help` topics, and `dv.sub` is corrected to say so." That correction was never carried into the
> mockup or either string table — three weeks later, the shipped app still asserts the promise the
> owner's own ruling found false.
>
> `dv.v`'s claim is a second, independent instance of the same pattern: `docs.js`'s own module header
> records that the corpus data it fetches "is fetched and NOT drawn" on this screen, and
> `src/ui/read-model.ts:3054-3057` names cross-linking to the corpus as `learn.js`'s job, not this
> screen's.
>
> WHAT CHANGES: `dv.sub` restated to describe what the screen actually renders (a `mycontext help`
> topic); `dv.v` restated to drop the cross-linking claim. Both are mockup edits under
> `DEC-claude-drafts-the-mockup-and-the-owner-approves`, landed in the mockup, `en.js` and `he.js`
> together, exactly the route `.md h4` and the refusal-label keys took on 2026-08-28/30.
>
> VERIFICATION: existing string-key parity tests continue to pass unchanged (no key added or
> removed); a person reads the corrected sentence against what the screen actually fetches.
>
> This is the cheapest, most visible item in the documentation-system gap list and has no
> dependency — it can land the same day it is read.
