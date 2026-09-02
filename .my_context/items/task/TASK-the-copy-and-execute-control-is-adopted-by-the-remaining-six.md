---
id: TASK-the-copy-and-execute-control-is-adopted-by-the-remaining-six
type: task
title: the Copy-and-Execute control is adopted by the remaining six screens
status: active
severity: soft
always: false
summary: Roll the shared run-a-command button out to the six remaining screens, one at a time rather than all at once.
summary_of: c63f82eeb6387772
scope: []
tags:
  - v2
  - ui
  - execute
  - screens
  - "plan:execute"
  - "seq:6b"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: a2cacf35bcffa86c
plan: execute
seq: 6b
state: done
priority: "2"
source: owner, 2026-08-26 ruling; scoped 2026-08-27
---

# the Copy-and-Execute control is adopted by the remaining six screens

`plan:execute seq:6` builds the shared control and adopts the COMPOSER only. This is the other six: `doctor.js`, `packs.js`, `port.js`, `proc.js`, `work.js`, `capture.js`.

ONE SCREEN AT A TIME, running that screen's own test after each. They are not interchangeable: each composes its command differently and passes a different catalogue id, and batching them is how a wrong id ships behind a confirm that looks right.

TWO OF THE NINE COPY SITES GET NO EXECUTE, and the code says why rather than leaving it to be inferred:
  - `config.js` copies the BUDGETS TEXT, not a command. There is no command that edits a budget -- `cfg.nocmd` says so in the product's own words -- so there is nothing to execute.
  - `coverage.js` copies `EMPTY_COMMAND`, which composes nothing. Same reason Doctor composes nothing for `dead_scope`.

WATCH FOR THE HALF-RESET while you are in these files: `button{font:inherit;color:inherit}` sets colour and not background, so a classless button outside `.cmd`/`.bound`/`.segbar`/`.icon` renders light text on the user agent's near-white button face -- invisible. See KNOWN-a-classless-button-renders-light-text-on-the-ua-button. The shared control must carry its own background token precisely because it lands in six different containers.
