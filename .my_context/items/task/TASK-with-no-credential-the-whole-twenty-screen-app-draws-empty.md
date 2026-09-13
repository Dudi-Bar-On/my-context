---
id: TASK-with-no-credential-the-whole-twenty-screen-app-draws-empty
type: task
title: with no credential the whole twenty-screen app draws empty around a good refusal, and reads as broken
status: active
severity: soft
always: false
summary: Without a sign-in the entire application is drawn completely blank around one correct message, so it looks broken rather than locked.
summary_of: 89b4de0f5745ed22
scope:
  - src/ui/public/app.js
  - src/ui/server.ts
tags:
  - v2
  - ui
  - auth
  - empty-state
  - "plan:walk"
  - "seq:153"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 5fd76d198adeb539
plan: walk
seq: "153"
state: todo
priority: "3"
---

# with no credential the whole twenty-screen app draws empty around a good refusal, and reads as broken

Raised by report 1 (`reports/2026-09-12-the-ui-reviewed-as-a-user.md`, 1.1) as row 88 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. With no credential, the bare URL draws THE ENTIRE TWENTY-SCREEN APP FULLY EMPTY -- every panel reading "not read", "◌" or "—" -- around a 401 refusal.

AND THE REFUSAL ITSELF IS GOOD. Report 1 calls it a model refusal: it names its cause, distinguishes itself from an empty corpus, explains why a reload cannot recover it, and prints the command. The defect is not the message; it is the FRAME around it. Twenty empty screens read as "this tool is broken" rather than "you are not signed in", and they are drawn before anybody reads the one correct sentence on the page.

THE SUBJECT. D44 is the app matched against its design of record: an unauthenticated shell is a state the design has an answer for, and the app draws the authenticated layout with nothing in it instead.
