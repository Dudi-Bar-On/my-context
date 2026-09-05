---
id: TASK-lesson-accept-creates-a-rule-with-no-summary-so-the-accept
type: task
title: lesson-accept creates a rule with no summary, so the accept path bypasses a requirement every other creation enforces
status: active
severity: soft
always: false
summary: A rule born from an accepted lesson candidate arrives with no summary and is reported by doctor the moment it is created.
summary_of: d8d7b9d906469d52
scope:
  - src/cli/commands/lesson.ts
  - src/lesson/derive.ts
tags:
  - v2
  - lesson
  - capture
  - "plan:rulings"
  - "seq:65"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-05
valid_until: null
checksum: 97418f67609d7a98
plan: rulings
seq: "65"
state: todo
priority: "2"
---

# lesson-accept creates a rule with no summary, so the accept path bypasses a requirement every other creation enforces

Measured 2026-09-05, immediately after accepting two candidates that had been staged since 2026-08-21.

Both rules were created active and governing, and both raised summary_absent in the very next doctor run. Nothing was wrong with either item: they load, inject and govern. What they could not do is be summarised to anyone who had not opened them.

The gap is in the path rather than in the items. mycontext add refuses a capture with no summary, and says so in words that explain why. lesson-accept builds a rule from a staged candidate and does not, so the one route that creates an item WITHOUT a person typing its text is also the one route that does not ask for the sentence a reader needs.

That ordering is backwards. A candidate is derived rather than written, so it is exactly the case where a human sentence matters most, and the accept command is the moment a person is present and has just read the body in order to decide.

The candidate record itself carries title, directive, body, scope and severity, and no summary field at all, so this is not a value being dropped in transit - it was never collected. Whoever fixes this should decide where the sentence comes from: asked for at accept time, required on the candidate when it is staged, or derived and then shown for confirmation. Deriving it silently is the one answer to avoid, because a generated summary that nobody read is the thing summary_absent exists to catch.

Both rules created today were given summaries by hand straight after, so the corpus is clean; the path is not.
