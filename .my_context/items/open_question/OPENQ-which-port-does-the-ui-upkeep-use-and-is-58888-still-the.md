---
id: OPENQ-which-port-does-the-ui-upkeep-use-and-is-58888-still-the
type: open_question
title: which port does the UI upkeep use, and is 58888 still the number?
status: active
severity: soft
always: false
summary: Which port should the viewing application use, and is the number that has only ever been typed by hand the one to write down as a setting?
summary_of: 0e092cfc80b08150
scope: []
tags:
  - v2
  - owner-question
  - ui
  - config
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 052c0001d673aed9
blocks: "plan:upkeep — the whole mechanism is off until a port is named"
---

# which port does the UI upkeep use, and is 58888 still the number?

The upkeep mechanism is off until ui.port is set, and setting it is the owner's act: .my_context/config.json is a file, and the deny hook says changes to it are the user's to make.

58888 IS NOT IN THE PRODUCT. Measured 2026-08-27: no file under src/ contains it. It lives in the handover, in two corpus items, in a printed hint in the demo-corpus script and in a test asserting it is an ordinary port. It has been a number the owner types into a command, and this would be the first time it is written down as configuration.

WHAT THE ANSWER DECIDES: whether the upkeep runs in this workspace at all, and on which port his bookmark points at. The demo corpus and the real corpus are different workspaces with different config files, so the answer may be different for each -- and today the server he looks at is served from .demo-corpus.

Design: docs/superpowers/specs/2026-08-27-the-ui-server-outlives-the-session-design.md section 8.
