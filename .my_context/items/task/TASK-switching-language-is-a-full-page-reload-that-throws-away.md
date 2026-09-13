---
id: TASK-switching-language-is-a-full-page-reload-that-throws-away
type: task
title: switching language is a full page reload that throws away every cached screen, and now costs seven seconds
status: active
severity: soft
always: false
summary: Changing the language reloads everything from scratch, losing your place and every screen already loaded, and now costs the full slow start.
summary_of: 8299fd39cac69966
scope:
  - src/ui/public/app.js
  - src/ui/public/strings/**
tags:
  - v2
  - ui
  - i18n
  - reload
  - "plan:walk"
  - "seq:155"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: acc6fd54d007fb2e
plan: walk
seq: "155"
state: todo
priority: "3"
---

# switching language is a full page reload that throws away every cached screen, and now costs seven seconds

FOUND BY BOTH UI REVIEWS. Row 93 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. Switching language is a FULL PAGE RELOAD. The execution context, every cached screen, the scroll position and the open pane are all thrown away.

AND IT GOT MORE EXPENSIVE SINCE IT WAS FIRST FILED. With row 18 in place -- two endpoints blocking the server for about four seconds per call -- a language switch now costs the seven-second cold load rather than a warm swap.

THE SUBJECT. D44 is the app matched against its design of record. The string table is already a runtime structure; a reload is not the mechanism the design implies.
