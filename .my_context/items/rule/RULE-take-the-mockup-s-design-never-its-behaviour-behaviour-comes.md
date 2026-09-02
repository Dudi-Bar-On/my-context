---
id: RULE-take-the-mockup-s-design-never-its-behaviour-behaviour-comes
type: rule
title: take the mockup's design, never its behaviour — behaviour comes from the plans
status: active
severity: hard
always: true
summary: "Copy how the design looks, never how it appears to act: everything moving in it is faked, and the real triggers and timings come from the written plans."
summary_of: f60bea2b7929115c
scope: []
tags:
  - ui
  - mockup
  - v2
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-21
valid_until: null
checksum: ef38b39034e8a8af
---

# take the mockup's design, never its behaviour — behaviour comes from the plans

**The mockup specifies what the interface IS. The plans specify what the application DOES.**

Take from `docs/design/web-ui-mockup.html`: the screens and their layout, the string keys and their wording, the classes and the markup shape, the states an element can be in, the interaction affordances, the bidi and monospace treatment, the aria naming. Where the mockup and a plan disagree about any of that, **the mockup wins and the plan is corrected**.

Take from the plans, and from the server the plans build: what data is fetched, when, from where, what any control triggers, how a condition is detected, what an error means. **None of that comes from the mockup, no matter how convincingly the mockup performs it.**

**Why this needs saying.** The mockup is a single self-contained HTML file. It has no server to call, so every dynamic thing in it is a fixture or a simulation, and simulations are indistinguishable from behaviour by reading. Copied across, they become false claims about a running system.

The case that produced this rule: the exit banner is unhidden by a 900 ms interval at beat 60 — **54 seconds after load, unconditionally**, and again 54 seconds after each dismissal, because nothing resets the counter and there is nothing to poll. That is a demonstration of a state, not a heartbeat. Carried into the shell verbatim it reports a healthy server as exited every 54 seconds. The real shell polls `/api/ping` and resets on a successful response; then the banner means what it says.

The same trap is set by every other lively thing in that file — the cycling provenance strip, the git-state cell that advances on click, the fixture rows, the `#alive` record count. Each is showing you a state the real screen must be able to reach. **None of them is telling you when to reach it.**

**So when implementing a screen:** lift the markup, the keys, the classes, the states and the words. Re-derive every trigger, every fetch, every threshold and every condition from the plan and the API. If the plan does not say when a state fires, that is a gap to report — not a licence to copy what the mockup did.
