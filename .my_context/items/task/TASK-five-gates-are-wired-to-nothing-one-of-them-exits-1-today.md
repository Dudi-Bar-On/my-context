---
id: TASK-five-gates-are-wired-to-nothing-one-of-them-exits-1-today
type: task
title: five gates are wired to nothing, one of them exits 1 today and only a tag cut runs it
status: active
severity: soft
always: false
summary: Five automated checks exist and nothing runs them, and one of them would fail right now on the only occasion it is ever used.
summary_of: 2a8fd2e3d405e8f7
scope:
  - package.json
  - .github/workflows/**
  - scripts/**
tags:
  - v2
  - gates
  - ci
  - "plan:gates"
  - "seq:2"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 15568cb47935066e
plan: gates
seq: "2"
state: done
priority: "1"
---

# five gates are wired to nothing, one of them exits 1 today and only a tag cut runs it

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, G1) as row 16 of `reports/2026-09-13-the-consolidated-findings.md`, and ranked fifth of the five it would do first.

WHAT WAS MEASURED. Five gates exist and are wired to nothing: `check:needs-cycles`, `check:handover`, `check:dependencies`, `check:cited-items`, and `verify:citations` (release workflow only). There is no pre-commit hook.

TWO OF THEM MATTER TODAY, NOT IN PRINCIPLE:
- `verify:citations` EXITS 1 RIGHT NOW, and runs only in `release.yml`. So every tag cut today fails at a gate that no pull request exercises.
- `check:dependencies` guards `CONST-zero-runtime-dependencies`, this product's headline promise, and runs in NEITHER workflow.

WHY IT IS THE CHEAPEST ROW IN THE CONSOLIDATION. Each of the five runs in seconds, and four of the twelve blockers in the same table would have been caught by gates that already exist. It changes what the NEXT defect costs.

THIS IS THE UNWIRED member of the three ways a gate can be green over red; the vacuous member is row 11 and the report-only member is row 70.
