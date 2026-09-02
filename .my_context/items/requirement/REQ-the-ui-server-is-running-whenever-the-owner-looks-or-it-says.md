---
id: REQ-the-ui-server-is-running-whenever-the-owner-looks-or-it-says
type: requirement
title: the UI server is running whenever the owner looks, or it says why it is not
status: active
severity: hard
always: false
summary: The viewing application is running whenever someone looks, or says why not, and is proved alive rather than assumed from a leftover record.
summary_of: af4f4958f36da400
scope: []
tags:
  - v2
  - owner-requirement
  - hooks
  - ui
  - server
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-27
valid_until: null
checksum: 722a38b15aecee86
kind: functional
---

# the UI server is running whenever the owner looks, or it says why it is not

OWNER REQUIREMENT, stated 2026-08-27: "on the most suitable hooks, check if the app server is running, if not running and not disabled start it up, find the correct interval for this test to not overload the system".

THIS IS AN EXISTING RULE BECOMING A MECHANISM. RULE-anything-you-start-for-a-human-to-look-at-must-outlive-the has been enforced by remembering, and remembering has failed: the owner reported the server not working three times, and every time it was either dead or answering a spent nonce.

WHAT DOES NOT EXIST TODAY, measured 2026-08-27: there is NO liveness record of any kind. No pidfile, no lockfile, no port probe, no EADDRINUSE branch. ui-sessions.json holds sha256 digests of issued tokens and nothing else -- no port, no pid, no URL -- so it cannot answer "is a server running" and was never meant to. A second mycontext ui --port 58888 surfaces a raw bind error. And 58888 is not in the product at all: no file under src/ contains it. It is a number the owner types.

LIVENESS IS PROVED, NEVER CLAIMED. A record in the global directory is a HINT; a crashed server leaves it behind and pids are reused. So: the record parses, then the pid is alive, then a TCP connect to the port succeeds -- and only the third step decides. This is the pattern of 2026-08-26 applied on purpose: measure the thing, not its proxy. The proxy here is exactly the shape of the audit projection that said the corpus was loading for nine days.

TWO INTERVALS, BECAUSE TWO THINGS ARE BEING BOUNDED. The PROBE is one small read plus one loopback connect and runs on Stop, floored at 60 seconds -- derived from how long the owner would sit looking at a dead tab, NOT from IDLE_MS, which is eight hours and would give a mechanism that is never there when it is wanted. The SPAWN is the expensive and the dangerous act: at most one per five minutes, and after three consecutive failures it stands down for the session and says so. That is the only path here that can overload a machine.

OFF UNLESS CONFIGURED. ui.port is the opt-in and its default is absent; ui.enabled is the off switch and gets its first enforcement site in the product, having been validated, displayed and read by nothing that decides anything since it shipped. A plugin that spawns a background server on every machine it is installed on, because somebody installed it, is not acceptable. DEC-the-ui-upkeep-is-off-unless-a-port-is-configured.

DONE WHEN, and all five:
1. With ui.port unset, no hook spawns anything and nothing is written.
2. With it set and ui.enabled true, a killed server is back within one turn or one minute, and an already-open tab keeps working without a new nonce -- ui-sessions.json exists for exactly that and finally has a second caller.
3. With ui.enabled false, no probe and no spawn.
4. Three failed spawns stand the mechanism down for the session, with one line saying so.
5. A stale record from a crashed process is detected by the probe, not believed, and removed.

Design: docs/superpowers/specs/2026-08-27-the-ui-server-outlives-the-session-design.md. Plan: docs/superpowers/plans/2026-08-27-the-ui-server-outlives-the-session.md.
