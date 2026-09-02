---
id: DEC-a-dead-watched-docs-list-earns-a-one-command-repair
type: decision
title: a dead watched-docs list earns a one-command repair
status: active
severity: soft
always: false
summary: When a setting silently does nothing because it matches no files, the tool should offer one command to fix it rather than sending you to edit a file.
summary_of: 6b812e89a51db5d3
scope: []
tags:
  - v2
  - ui
  - owner-ruling
  - "screen:doctor"
  - doctor
  - cli
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: 96dd4a798ea73bfa
---

# a dead watched-docs list earns a one-command repair

OWNER RULING, 2026-08-25, in the doctor walkthrough.

The mockup offers `mycontext init --rewrite-watched` to repair `watched_docs_no_match`. THAT FLAG DOES NOT EXIST -- it appears nowhere in `src/` -- and `repairCommandFor` earns a command for exactly four codes (`index_stale`, `audit_log_size`, `corpus_size_fallback_ceiling`, `source_drift`), none of them this one. The design proposed a repair nobody built.

THE RULING: BUILD IT. The flag, and the `repairCommandFor` entry that offers it.

THE REASON: the finding says zero files match any watched glob, so the capture nudge can never fire. That is a DEAD CONFIGURATION -- a feature silently doing nothing -- and it is the most actionable thing on the screen. `init` already knows how to write `watchedDocs` from what the repository actually has, so the repair is a flag on an existing command rather than a new one.

WHAT WAS WEIGHED AGAINST IT: dropping it from the mockup and letting the user edit `config.json` themselves, which is the deny hook s posture anyway. Declined because it leaves the most actionable finding on the screen with no action beside it. A third option -- linking to the config screen s composer instead -- was declined for a sharper reason: a `.cmd` block IS a command to copy, and making it a link on one screen changes what that block means everywhere.
