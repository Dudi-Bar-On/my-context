---
id: TASK-a-malformed-config-returns-an-empty-injection-from-six
type: task
title: a malformed config returns an empty injection from six delivery paths, and the audit log says healthy
status: active
severity: soft
always: false
summary: One bad character in a settings file can make a session start with none of the project's knowledge, while the log that records what happened keeps saying everything is fine.
summary_of: 197215552e46e18c
scope:
  - src/core/**
  - src/hooks/**
tags:
  - v2
  - core
  - injection
  - silent-failure
  - "plan:walk"
  - "seq:145"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 260eb7235cbd9ff5
plan: walk
seq: "145"
state: done
priority: "1"
---

# a malformed config returns an empty injection from six delivery paths, and the audit log says healthy

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, B1) as row 1 of `reports/2026-09-13-the-consolidated-findings.md` — the first of the five it would do first.

WHAT WAS MEASURED. A single trailing comma in `.my_context/config.json` makes the config parse throw. Six delivery paths catch that throw and return an empty `Injection`, so a session starts with zero project knowledge: no rules, no JIT tier, no compaction restore, no subagent constants. Nothing on any surface says the corpus was not read.

WHY IT IS FIRST. The recording paths deliberately avoid the same throw, so the audit log keeps writing healthy rows for the whole session. The evidence actively EXONERATES the failure: every other defect in the review can be found by looking, and this one makes looking answer "fine".

THE CONSEQUENCE FOR AN AGENT. An agent dispatched into a session with an empty `Injection` behaves exactly as if the project had no governing items at all, and neither it nor the owner can tell that from a project that is simply quiet.

THE SHAPE OF THE FIX, from the report: a `failure?: string` on `Injection` that every delivery path sets when it caught rather than read, plus one stderr line per hook naming the file and the parse error. The sentence to print already exists in the parse branch and is already well worded.

THIS IS `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` at the largest possible blast radius: an empty injection is an unmeasured corpus drawn as an empty one.

Row 1 of the consolidated findings table.
