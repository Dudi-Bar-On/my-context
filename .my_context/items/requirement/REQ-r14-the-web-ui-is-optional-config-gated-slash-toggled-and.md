---
id: REQ-r14-the-web-ui-is-optional-config-gated-slash-toggled-and
type: requirement
title: "R14: the web UI is optional, config-gated, slash-toggled, and never changes plugin behaviour"
status: active
severity: hard
always: false
summary: The viewing application is optional and switchable, and turning it on or off changes nothing at all about how the underlying tool behaves.
summary_of: 1cac827ecdd3682a
scope: []
tags:
  - v2
  - ui
  - r14
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: cae6e3f5d7c8f185
---

# R14: the web UI is optional, config-gated, slash-toggled, and never changes plugin behaviour

**The web UI is an OPTIONAL ENHANCEMENT, gated by configuration, toggled by a slash command, and it must not change what the plugin does.**

**Three parts, and the third is the one with teeth.**

**1. Configured in `.my_context/config.json`.** Whether the UI may run is a setting in the corpus configuration, not a flag remembered somewhere else. Today `TOP_LEVEL_KEYS` is `profile`, `categories`, `budgets`, `watchedDocs` — so this adds a key, and a config a build does not understand is refused by name, which means old builds and new configs have to be thought about.

**2. A slash command enables and disables it.** The user turns it on and off without editing JSON by hand.

**3. It must not affect the plugin AT ALL, in either state.** Injection, hooks, the MCP surface, the CLI, budgets, the trust boundary — identical whether the UI is enabled, disabled, or never configured. The UI ADDS a way to see what is happening in the context; it does not change what happens. Disabled must not mean degraded, and enabled must not mean different.

**What it is FOR, because it constrains the design.** The user wants to SEE WHAT IS GOING ON IN THEIR CONTEXT — what was injected, what spilled, what governs, what decayed. That is an observation surface. It is why the no-writes rule exists, and why "enhances, never alters" is the requirement rather than a nice-to-have.

**The test this implies.** "Does not affect the plugin" is a claim, and this project does not ship claims. It needs to be provable the way the no-writes ban is provable: the same operation, run with the UI enabled and disabled, produces the same result — same injection, same audit records, same exit codes.
