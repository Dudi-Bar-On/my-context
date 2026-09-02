---
id: DEC-the-ui-upkeep-is-off-unless-a-port-is-configured-and-ui
type: decision
title: the UI upkeep is off unless a port is configured, and ui.enabled finally decides something
status: active
severity: soft
always: false
summary: The background web server stays entirely off until you choose an address for it, so installing the tool never starts a server nobody asked for.
summary_of: a12aac3acd6d52e1
scope: []
tags:
  - v2
  - owner-ruling
  - ui
  - config
  - security
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 3d41daa56f5cbe4f
---

# the UI upkeep is off unless a port is configured, and ui.enabled finally decides something

A hook CANNOT use port 0. The server's default port is an ephemeral one chosen by the operating system, and an ephemeral port is a URL nobody can bookmark -- while the whole point of this feature is a server that is there when the owner looks.

So ui.port joins ui.enabled in the configuration, and its default is ABSENT. Absent means the entire mechanism is off: no file written, no port probed, no process spawned.

WHY THAT IS A SAFETY CALL AND NOT A DEFAULT. A plugin that spawns a background server on every machine it is installed on, because somebody installed it, is not acceptable. Setting ui.port is how the owner turns this on, per workspace, as a positive act. ui.enabled: false then turns it off again without unsetting the port, which is what a disable switch is for.

The two keys divide cleanly: ui.port says WHERE, and answering that question at all is the opt-in; ui.enabled says WHETHER, and this gives it its FIRST enforcement site. It has been validated, refused when malformed, rendered on the Configure screen and consulted by nothing that decides anything since it shipped -- config.ts says so about itself.
