---
id: TASK-there-is-no-version-flag-and-the-argued-alternative-refuses
type: task
title: there is no version flag, and the argued alternative refuses outside a workspace
status: active
severity: soft
always: false
summary: There is no way to ask the tool which version it is, and the suggested substitute refuses to answer anywhere it has not been set up yet.
summary_of: 1d69881fc95cbc6e
scope:
  - src/cli/index.ts
tags:
  - v2
  - cli
  - version
  - first-second
  - "plan:hooks"
  - "seq:35"
  - "state:doing"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: f73dc04974963960
plan: hooks
seq: "35"
state: doing
priority: "3"
---

# there is no version flag, and the argued alternative refuses outside a workspace

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, C6) as row 113 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. There is no `--version` and no `-v`. And the argued alternative -- `status --json` -- EXITS 1 WITH "no workspace here" OUTSIDE A WORKSPACE.

THE CONSEQUENCE. The first fact any bug report needs is unobtainable from a fresh install. Somebody who has just installed the tool, in a directory that is not yet a workspace, has no way to say which version they have.

WHY D55. D55 is `mycontext` helping from the first second, unconfigured. This is the very first second, and the answer is a refusal.
