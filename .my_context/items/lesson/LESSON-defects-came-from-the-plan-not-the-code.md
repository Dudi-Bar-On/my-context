---
id: LESSON-defects-came-from-the-plan-not-the-code
type: lesson
title: Nearly every defect originated in the plan, not in implementation
status: active
severity: soft
always: false
summary: Almost every serious fault came from the written plan rather than the coding, and re-reading your own plan is not what finds them; running the result is.
summary_of: 818596d9e0fbffb9
scope: []
tags:
  - process
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: 86a148fbccd047dc
---

# Nearly every defect originated in the plan, not in implementation

Across thirteen tasks, roughly 25 Important-or-Critical findings were caught, and
essentially all of them came from plan text that had already been self-reviewed.
None came from an implementer misreading a brief. Reviewing your own specification
finds contradictions between documents, not defects inside one.

## Observations
- [method] Three layers catch different classes: implementers find prose-vs-code contradictions by making it run, reviewers find untested input classes by reading the diff, a whole-branch pass finds seams no task owned
- [history] The two Critical bugs were found only by executing the assembled system, not by reading it
