---
id: TASK-status-report-drops-every-could-not-measure-disclosure-and
type: task
title: status_report drops every could-not-measure disclosure and then prints zero errors, zero warnings, zero notes
status: active
severity: soft
always: false
summary: The summary an assistant reads most often says everything is fine by leaving out everything it was unable to check.
summary_of: 37a72218210e34ab
scope:
  - src/mcp/tools.ts
  - src/ui/read-model.ts
tags:
  - v2
  - mcp
  - measured-zero
  - disclosure
  - "plan:walk"
  - "seq:146"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 7108efd51dc2bcdb
plan: walk
seq: "146"
state: done
priority: "1"
---

# status_report drops every could-not-measure disclosure and then prints zero errors, zero warnings, zero notes

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, B10) as row 7 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT THE CODE DOES. `status_report` filters out every "I could not measure this" disclosure and then prints `health: 0 error(s), 0 warning(s), 0 note(s)`. It never computes them at all.

THE COMPARISON THAT MAKES IT A DEFECT RATHER THAN A CHOICE. The MCP `doctor` tool makes the same split and PRINTS the disclosures. Two tools on the same surface answer the same question two different ways, and the one that hides them is the surface an agent reaches for most.

THE CONSEQUENCE FOR AN AGENT. A zero here means "nothing was found". It is being drawn over "nothing was looked at". That is exactly what `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` exists to forbid, on the highest-traffic read surface in the product.
