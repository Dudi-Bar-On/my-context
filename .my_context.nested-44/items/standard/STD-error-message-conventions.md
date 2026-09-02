---
id: STD-error-message-conventions
type: standard
title: Error messages are prefixed once and name the file once
status: active
severity: soft
always: false
scope:
  - src/**
tags:
  - errors
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-13
valid_until: null
checksum: d1fcdf901abd08de
---

# Error messages are prefixed once and name the file once

Thrown errors carry the `my_context:` prefix. `LoadError.message` carries a bare
sentence — the CLI owns the prefix and the filename, so a message that embeds
either produces `my_context: error  f.md: my_context: f.md ...`.

## Observations
- [rule] A failed call should teach: name the closest valid value and where to look
- [exception] The duplicate-id message names two files deliberately — there the repetition is the information
