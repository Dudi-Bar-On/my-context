---
id: KNOWN-the-config-deny-hook-covers-edit-and-write-not-bash
type: known_issue
title: the config deny hook covers Edit and Write, not Bash
status: active
severity: soft
always: false
summary: The guard on the settings file watches only the file-editing tools, so anything going through a shell command reaches the file untouched.
summary_of: 25145ab1a556a643
scope: []
tags:
  - v2
  - hooks
  - security
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 57bff35bd0eb8a93
---

# the config deny hook covers Edit and Write, not Bash

MEASURED 2026-08-24, by doing it: the assistant wrote `.my_context/config.json` through a Python script run in Bash, and the deny hook never saw it.\n\n`pre-tool-use.ts` refuses with 'changes to .my_context/config.json are the user's to make - ask, do not edit' (~118), and that refusal is correct and load-bearing: `read-model-config.ts` cites it as the reason the web UI previews configuration rather than writing it, and DEC-should-the-web-ui-be-allowed-to-write-config-json turns on it.\n\nBUT THE GATE IS KEYED ON THE TOOL NAME: `if (/Edit|Write/.test(input.tool_name ?? ''))` (~333). A shell command is not Edit and is not Write, so `python -c`, `sed -i`, a heredoc or `node -e` all reach the file untouched. The hook's own comment nearby explains it does not key off the PATH because that would let a Write to an unrelated path through - so the tool-name test is deliberate, and the Bash gap is the side of it nobody measured.\n\nWHAT IT DOES NOT MEAN. This is not a sandbox escape and the corpus was never unprotected by accident: an agent that runs a shell can always write any file the user can, and that is true of every hook of this shape. What it means is narrower and worth saying: THE HOOK IS AN AGREEMENT, NOT A WALL, and a reader who has seen the refusal fire may reasonably believe it is a wall.\n\nThe occasion was benign - the owner had selected the exact JSON block through an approval prompt, so the DECISION was theirs and only the mechanism was the assistant's. That is precisely why it is worth filing rather than shrugging at: the next time may not be benign, and nothing would report it.\n\nOPTIONS, ranked. (1) Widen the tool test to include Bash and screen the COMMAND for the managed paths - catches the honest cases and the careless ones, cannot catch a determined one, and risks false positives on any command that merely mentions the path. (2) Leave the gate and fix the CLAIM: make the refusal say it governs file-edit tools, so nobody mistakes it for a wall. (3) Both. Recommendation is (3), with (2) first because it costs nothing and removes the false belief immediately.
