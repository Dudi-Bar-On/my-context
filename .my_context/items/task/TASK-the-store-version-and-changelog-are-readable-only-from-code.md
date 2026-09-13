---
id: TASK-the-store-version-and-changelog-are-readable-only-from-code
type: task
title: the store version and changelog are readable only from code the published package excludes
status: active
severity: soft
always: false
summary: The shipped tool records which version of its rules it carries and offers nobody who installs it any way to read that.
summary_of: 191ec8a7940cc679
scope:
  - src/rules/**
  - package.json
tags:
  - v2
  - store
  - version
  - consumer-install
  - "plan:store"
  - "seq:9"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: fe22392a973b8733
plan: store
seq: "9"
state: done
priority: "2"
---

# the store version and changelog are readable only from code the published package excludes

Raised by report 6 (`reports/2026-09-13-store-cli-mcp-and-gates-reviewed.md`, S6) as row 56 of `reports/2026-09-13-the-consolidated-findings.md`.

WHAT WAS MEASURED. The rule store carries `version: 5`, a `publishedAt` and five changelog rows. The ONLY readers of any of that are inside `src/ui/maintenance/` -- which `package.json` EXCLUDES from the published package.

THE CONSEQUENCE. In a real install there is no way to answer "which store version do I have". The version exists, the changelog exists, and the surfaces that read them are the ones a consumer never receives.

RELATED, and deliberately not conflated: the exclusion of `src/ui/maintenance/**` from the package is correct and is the security model, asserted two ways -- report 5 examined it and would change nothing. The defect is that no SHIPPED surface answers the version question, not that the maintenance tool is excluded.
