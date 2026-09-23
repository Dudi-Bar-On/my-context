---
id: TASK-an-install-whose-sources-cannot-be-walked-reports-its-code
type: task
title: an install whose sources cannot be walked reports its code as current, so the stale banner can never fire
status: active
severity: soft
always: false
summary: If the tool cannot examine its own files it reports that it is up to date, so a server could run old code indefinitely with no warning.
summary_of: 4e06946dbbcf4f52
scope:
  - src/core/**
  - src/ui/read-model.ts
tags:
  - v2
  - core
  - staleness
  - silent-failure
  - inferred
  - "plan:live"
  - "seq:28"
  - "state:doing"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-13
valid_until: null
checksum: 5a4182d334d9b22c
plan: live
seq: "28"
state: doing
priority: "3"
---

# an install whose sources cannot be walked reports its code as current, so the stale banner can never fire

INFERRED, NOT REPRODUCED, AND THE EVIDENCE IS PARTIAL IN A WAY THAT MUST BE SAID. The finding rests on `/api/meta` serving `staleCode` from `CodeIdentity.isStale()` and nowhere else -- GREP-VERIFIED, HANDLER NOT READ. No install was ever made unwalkable and the false `staleCode: false` was never observed. THE FIRST STEP OF THIS WORK IS TO READ THE HANDLER AND THEN REPRODUCE IT.

Raised by report 3 (`reports/2026-09-12-silent-failures-reviewed.md`, m8) as row 111 of `reports/2026-09-13-the-consolidated-findings.md`.

THE MECHANISM AS READ. An install whose sources cannot be walked serves `staleCode: false`. So the owner's server would run stale code indefinitely, with the in-tab banner that exists to say so unable to fire.

WHY IT IS D56. D56 is the mechanism that keeps the server up being what keeps taking it down; this is the neighbouring case -- the mechanism that tells the owner his server is out of date failing silently in the direction that says everything is current.
