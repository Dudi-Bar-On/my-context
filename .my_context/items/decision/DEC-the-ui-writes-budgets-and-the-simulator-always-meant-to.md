---
id: DEC-the-ui-writes-budgets-and-the-simulator-always-meant-to
type: decision
title: the UI writes budgets, and the simulator always meant to
status: active
severity: soft
always: false
summary: The pages may save one thing only, the size limits you tried out, and only after showing you the before and after and asking you to confirm it.
summary_of: 7bd3871dbf42107a
scope: []
tags:
  - v2
  - owner-ruling
  - ui
  - config
  - budgets
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: c443f40aef25033e
---

# the UI writes budgets, and the simulator always meant to

OWNER RULING, 2026-08-27, correcting how this was framed to him: "i talked about the budget simulator that when a user decides about a fitting setup it has the capability to update the budgets from the ui, so it is the same - the ui writes the budget, this is one of the reasons that we have splitted the config to several parts".

I PUT IT TO HIM AS A REVERSAL OF `DEC-should-the-web-ui-be-allowed-to-write-config-json`. He answered that it is not a new direction at all: the Simulate screen exists so a user can drag budgets until a setup fits, and a simulator whose answer has to be retyped by hand into a file is a simulator that stops one step short of its purpose. **The config was split into parts for exactly this** -- so that a surface can own one part without being handed the whole file.

SO THE RULING IS: **the UI writes BUDGETS.** Narrowly, and the narrowness is the whole of it:

  - budgets ONLY. Never `categories`, never `watchedDocs`, never `profile`, never `ui`. Those remain the user's file to edit and the deny hook remains right about them.
  - behind the same confirm Execute's boundary commands get: field by field, before -> after, through `fieldView`. A budget change is a boundary crossing by any reading -- it changes what every future session is shown.
  - and it is a WRITE, so it lands in the audit log like any other.

WHAT DOES NOT CHANGE. `cfg.nocmd` says "There is no command that edits a budget. Configuration is a file, and the deny hook says so in those words." That stays TRUE for the CLI: no `mycontext` command edits a budget, and an agent still cannot. What gains the ability is the UI, driven by a person, behind a confirm -- which is the same distinction Execute drew between a catalogue command a human confirms and a shell an agent can reach.

THE SCREEN TEXT WILL HAVE TO MOVE WITH IT. `cfg.nocmd` is a user-facing string asserting that this cannot happen; when the write lands, that sentence becomes false and must be rewritten rather than left. It is drawn on the Configure screen, and the mockup declares it -- so the gap direction of `strings-parity` will hold it to being replaced rather than deleted.
