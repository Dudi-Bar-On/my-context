---
id: TASK-ruling-35-derive-the-readme-yes-flag-table-and-close-two
type: task
title: "ruling 35: derive the README --yes flag table, and close two more hand-kept lists in the skill"
status: active
severity: soft
always: false
summary: Three lists kept by hand where the code already knew the answer, one of them pinned stale by its own test, all since derived.
summary_of: 95c1440666447f33
summary_was:
  - 2026-09-03 Three more hand-kept lists that the code could produce on its own, one of them held stale in place by the test that was meant to protect it.
acknowledged:
  - citation_form@5620ba3c428bb635
scope: []
tags:
  - "plan:rulings"
  - "seq:35"
  - "state:done"
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: 1a1a7b6f6e7be936
plan: rulings
seq: "35"
state: done
priority: "2"
---

# ruling 35: derive the README --yes flag table, and close two more hand-kept lists in the skill

Found by ruling 34 while extracting the approval-boundary derivation. Three lists, same defect, all now cheap because the derivation is a shared helper.

**1. README's --yes table is stale in exactly the way SKILL.md was, and a test pins it there.** Around `README.md` · ``| `--yes` | confirm without being asked.`` · ~3707 it lists twelve command strings that take --yes. The parser accepts it on **fourteen**: **inbox-promote** and **refresh** are missing, both proven gated by the probe. `test/plugin-assets.test.ts` asserts that literal, so the stale row is pinned in place. The set is already computed as `approvalBoundary().gated` in `test/helpers/approval-boundary.ts`. This is one deepEqual.

**2. Nothing stops the skill naming a retired MCP tool.** `test/plugin-assets.test.ts` iterates a hand-written literal of four tool names against the fourteen in `TOOL_NAMES`, and the check is one-directional: every listed tool must be mentioned, but a tool the skill names that no longer exists passes. All eight names in SKILL.md are real today. The reverse check is derivable: backticked snake_case identifiers, minus the category names from `CATEGORIES`, must be a subset of `TOOL_NAMES`.

**3. Two more sentences in SKILL.md are hand-kept against constants that exist.** *Scope, always, severity and status stay refused either way* is `Object.keys(GUARDED_FIELDS)` union `status`, and `src/core/trust.ts` already asserts that pair in both directions at the type level. *Stages a change to title, body, tags or extra* is pinned as a literal rather than derived from `UPDATE_FIELD_POLICY`.

**And one gap in a checker.** `scripts/check-text-files.ts` scans src, test, scripts, commands, docs, hooks and e2e. It does **not** scan `skills/`, so an always-loaded shipped text file sits outside the NUL-byte gate.

Land each corrected value first and watch its pinned test go red before deriving it. A checker is not verified until it has been made red.
