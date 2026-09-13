---
id: TASK-the-browser-shell-has-no-catch-and-no-storage-guard-so-a
type: task
title: the browser shell has no catch and no storage guard, so a blocked browser reads as a dead server
status: active
severity: soft
always: false
summary: When a browser refuses to store data the page never starts and shows nothing at all, so it looks as though the tool itself is broken.
summary_of: 4868609336b5158d
scope:
  - src/ui/public/app.js
  - src/ui/public/lane.js
  - src/ui/public/doc.js
tags:
  - v2
  - ui
  - silent-failure
  - boot
  - "plan:swallow"
  - "seq:2"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 10792fa93649d791
plan: swallow
seq: "2"
state: done
priority: "1"
---

# the browser shell has no catch and no storage guard, so a blocked browser reads as a dead server

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, B7) as row 5 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT THE CODE DOES. The browser shell ends `main()` with no `.catch`, and reads `localStorage` unguarded. Both defences already exist in `lane.js` and `doc.js`, and each of those files says in a comment that it follows "the same rule the shell follows" -- the shell does not follow it.

THE CONSEQUENCE FOR A USER. With site data blocked the app never boots at all and reads as a dead server: no error, no empty state, nothing that says the browser refused. A second symptom from the same missing observation point: pasting the URL while the server is still binding leaves the spent nonce sitting in the address bar.

WHY IT BELONGS IN THIS SUBJECT. It is not a catch that is too wide -- it is the absence of any observation point at all. There is nowhere for a failure in `main()` to be seen.
