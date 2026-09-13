---
id: TASK-a-default-branch-carries-a-third-policy-s-real-prose-so-an
type: task
title: a default branch carries a third policy's real prose, so an unknown fourth gets a confidently wrong sentence
status: active
severity: soft
always: false
summary: When an unrecognised setting appears the tool explains it using another setting's wording, so the wrong answer reads exactly like a right one.
summary_of: 4cfed930fda6dd42
scope:
  - src/doctor/checks.ts
  - src/core/trust.ts
tags:
  - v2
  - doctor
  - types
  - fail-open
  - "plan:rulings"
  - "seq:87"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 2c4fe6bfd2dcf5b2
plan: rulings
seq: "87"
state: todo
priority: "2"
---

# a default branch carries a third policy's real prose, so an unknown fourth gets a confidently wrong sentence

FOUND TWICE AT THE SAME LINES. Report 4 (`reports/2026-09-13-type-design-reviewed.md`, section 5) found it as a swallowing switch; report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, G6) found it as a failure message that is "worse than no message". Row 66 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. `deletingTheGlob`'s `default:` branch carries A THIRD POLICY'S REAL PROSE. So a fourth `ScopePolicy` -- one nobody has written yet -- gets a confidently wrong sentence claiming the item is unrestricted and injects on every file.

WHY IT IS THE WORST SHAPE OF THIS CLASS. The default branch is not empty and it is not generic: it is a specific, well-written, TRUE-OF-SOMETHING-ELSE sentence. A reader has no way to tell it apart from a correct answer.

THIS IS D64: the unlisted input takes the benign branch, and here the benign branch also explains itself persuasively.
