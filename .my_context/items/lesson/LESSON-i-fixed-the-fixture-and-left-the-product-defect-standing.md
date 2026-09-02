---
id: LESSON-i-fixed-the-fixture-and-left-the-product-defect-standing
type: lesson
title: I fixed the fixture and left the product defect standing
status: active
severity: soft
always: false
summary: Fixing the version of a fault that shows up in testing is tempting because it turns the check green, and it leaves users with the fault.
summary_of: 4c3f24721029888d
scope: []
tags:
  - v2
  - ui
  - fixture
  - measurement
  - process
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 5ab6591c02054b5e
---

# I fixed the fixture and left the product defect standing

Found 2026-08-25, reading plan:ui3 seq:11x after the owner pointed out that the ui1/ui2/ui3 plans still hold unexecuted UI work.

ON 2026-08-24 I FIXED THE FIXTURE VERSION OF A DEFECT AND CALLED IT DONE. The e2e harness now syncs the audit projection before serving, so the SUITE measures a corpus that can answer. That change was correct and it un-hid four screens.

IT DID NOTHING FOR USERS. The same defect on a real corpus was measured on 2026-08-22, three days earlier, and written down: "the projection went from fresh to behind TWICE INSIDE FORTY MINUTES, purely because ordinary work appended to .audit/audit.jsonl. Nothing syncs it except someone running `mycontext audit`." Then `/api/watch/volume` and `/api/ask/audit` answer 503, the pulse is empty, the filter row collapses to All alone, and the table is empty.

THE OWNER HAS ALREADY SEEN THAT STATE and called it "far away from the mockup". It is not a rendering defect; it is the honest rendering of a stale projection.

THE TWO ARE ONE DEFECT AT TWO LEVELS, and I only fixed the level that made my own measurement look better. Worse, the known_issue I filed named the cause too narrowly -- "reading the demo corpus makes it stale". Reading ANY corpus appends `access` records, and ordinary WRITES append too. The fixture was where I noticed, not where it lives.

THE LESSON, and it is uncomfortable: a fix that turns a measurement green is the most tempting place to stop. The harness fix produced a dramatic before/after -- decay 86 to 549 nodes -- and that number is exactly what stopped me looking further. Nobody asked whether the same thing was true where it counted.

THE PRODUCT FIX IS UNRULED and plan:ui3 seq:11x names three options: keep the projection current as the log is appended to; sync once at `mycontext ui` startup, which is a write by a command the user typed rather than by a GET; or accept it and make the refusal ACTIONABLE, which this UI already has the machinery for -- `lib/command.js` and the compose-and-copy `.cmd` row that doctor and coverage use for exactly this shape.
