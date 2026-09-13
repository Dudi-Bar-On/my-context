---
id: TASK-a-file-dropped-into-the-rule-store-entries-directory-is
type: task
title: a file dropped into the rule store entries directory is delivered as a governing constant and no door asks the manifest
status: active
severity: soft
always: false
summary: Anything placed in one folder is handed to every assistant as an official rule of this tool, and the check that would notice is run by nothing.
summary_of: b6bbb21b08ba42e8
scope:
  - src/rules/**
tags:
  - v2
  - store
  - tamper
  - gate
  - "plan:store"
  - "seq:6"
  - "state:todo"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 363e071ed5b65040
plan: store
seq: "6"
state: todo
priority: "1"
---

# a file dropped into the rule store entries directory is delivered as a governing constant and no door asks the manifest

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, S2) as row 14 of `reports/2026-09-13-the-consolidated-findings.md`.

PROVED, NOT INFERRED. Report 6 built a scratch copy of the store, dropped a Markdown file named `evil.md` into `src/rules/entries/`, and ran both paths: `verifyManifest` reports it as `unexpected`; `loadRules` DELIVERS it. The manifest is right and nobody asks it.

WHAT THAT MEANS. Any Markdown file placed in the entries directory is delivered to every model at every door as a governing constant of this product. The one mechanism that would catch it -- `rules verify` -- is run by nothing: not a hook, not a door, not `doctor`, not CI.

THE CONSEQUENCE. The store's tamper-evidence is real and unreachable. Its value depends entirely on somebody choosing to run a command that nothing runs.

THE SHAPE OF THE FIX is a door that asks the manifest before it delivers, or a `doctor` check that fails when the two disagree -- and a gate, so the answer is taken rather than available.
