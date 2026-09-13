---
id: TASK-three-prose-claims-that-the-web-surface-binds-no-writer-have
type: task
title: three prose claims that the web surface binds no writer have each drifted behind the enforced list
status: active
severity: soft
always: false
summary: Three separate places state in words a fact that a test already enforces, and all three have fallen out of date with it.
summary_of: 031c308283453f6d
scope:
  - src/ui/public/app.js
  - src/ui/security.ts
  - docs/capabilities/08-web-ui.md
tags:
  - v2
  - docs
  - hand-kept
  - drift
  - "plan:rulings"
  - "seq:79"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 4f71db3ece41d33e
plan: rulings
seq: "79"
state: todo
priority: "3"
---

# three prose claims that the web surface binds no writer have each drifted behind the enforced list

Raised by report 5 (`reports/2026-09-13-what-could-be-removed-or-done-differently.md`, section 1) as row 85 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. THREE separate prose claims that `src/ui/` binds no writer -- `app.js`'s `post()` docblock, `security.ts`'s header, and `docs/capabilities/08-web-ui.md` -- have EACH DRIFTED BEHIND `RULED_WRITES`, which currently holds 12 bindings across 5 files.

WHY IT IS D51 AND NOT A DOCUMENTATION CHORE. The three copies restate a fact A TEST ALREADY ENFORCES. `RULED_WRITES` is the single source, it is checked, and report 3 verified binding by binding that the no-writes guarantee itself HOLDS. The defect is purely that three prose copies exist to go stale, which is the exact defect `CLAUDE.md` opens with.

THE SHAPE OF THE FIX: delete the claims and point at the enforced list, or derive the sentence from it.
