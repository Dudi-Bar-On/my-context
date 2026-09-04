---
id: TASK-config-the-delta-plate-and-the-blast-panels-are-unblocked-so
type: task
title: "config: the delta plate and the blast panels are unblocked, so build them"
status: active
severity: soft
always: false
summary: The settings screen still cannot show what a change would do, because two halves each waited on the other; the thing they waited for now exists.
summary_of: ac3aa89f8ab962c5
scope: []
tags:
  - v2
  - ui
  - tree-parity
  - "screen:config"
  - "plan:walk"
  - "seq:10"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-25
valid_until: null
checksum: e32ae1b629a41f58
plan: walk
seq: "10"
state: done
priority: "1"
source: "plan:port seq:98, config"
---

# config: the delta plate and the blast panels are unblocked, so build them

THE STANDOFF, and both halves of it have expired.

config.js will not draw the delta rows or the blast panels: "the screen contract s fetcher takes a path and nothing else: no method, no body... Every preview below that would need a candidate config is therefore ABSENT rather than approximated."
styles.css will not carry the ten `.delta` / `.blast` rules: "NOT carried, deliberately... No built module emits them - config s two are held in screen-parity s KNOWN_GAPS until ctx.api can POST."

No rows because no CSS, no CSS because no rows, both waiting on a POST.

`ctx.post` EXISTS. app.js defines `post(path, body)`, puts it on `window.myctx`, and its own comment names this screen: "POST /api/config/check, POST /api/config/preview and POST /api/overlap are registered and tested and, until this existed, unreachable from any screen... screens/config.js names the sketch, and this is what it got instead." It has ZERO callers.

AND IT IS NOT A WRITE, which the same comment settles: "All three routes read, validate or preview; src/ui/ binds no writer at all and test/ui/no-writes.test.ts asserts that structurally. The verb is HTTP s, chosen because the question does not fit in a query string." no-writes bans the mutation SYMBOLS -- createItem, updateItem, supersedeItem -- not an HTTP verb.

ONE TASK, THREE PARTS, and doing any two leaves the standoff intact in a new shape:
1. Carry the ten rules into styles.css: .delta, .delta .was, .delta .will, .delta .arrow, .delta.gain, .delta.loss, .blast, .blast.warn, .blast.crit, .blast b. They exist only in the mockup s own style block, and styles-parity never noticed because it compares the selectors it is handed -- the same blind spot that hid the item pane s six #pane rules.
2. config.js calls `ctx.post("/api/config/preview", ...)` for the delta rows and the blast radius. VERIFY THE RESPONSE SHAPE FIRST: the refusal was written against a plan sketch, and nobody in this walkthrough has read what the endpoint actually returns.
3. Drop the pair from screen-parity s KNOWN_GAPS, which is shrink-only.

The blast count must stay EXACT. `cfg.spn` rules out estimating it in the browser -- "computable exactly rather than estimated" -- and `scopePolicyFor` computes it over the real corpus, server-side. That is the whole reason the POST exists.

Five of config s twelve tree-parity findings are this. The other seven are plan:walk seq:1.
