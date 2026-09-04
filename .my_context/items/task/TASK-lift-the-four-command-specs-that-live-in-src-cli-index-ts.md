---
id: TASK-lift-the-four-command-specs-that-live-in-src-cli-index-ts
type: task
title: lift the four command specs that live in src/cli/index.ts, the banned module
status: active
severity: soft
always: false
summary: Four commands describe their options inside a file the viewer is forbidden to touch, so nothing can offer a form for them until they move.
summary_of: 349cf586b191ba03
scope: []
tags:
  - "plan:builder"
  - "seq:1b"
  - v2
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 34f0014fde4a99c1
state: done
plan: builder
seq: 1b
progress: "100"
last_change: 2026-08-31
---

# lift the four command specs that live in src/cli/index.ts, the banned module

Split out of plan:builder seq:1, which lifted 20 of 29 liftable specs and named this as the highest-value remainder.

`add`, `list`, `examples` and `init` declare their flags inside `src/cli/index.ts` - the module `test/ui/no-writes.test.ts` BANS from `src/ui/`, because importing it registers the entire mutating command surface as a side effect. So these are the four specs that most need to be out of that file, and the only four a UI builder cannot reach at all today.

It is short: `ADD_FLAGS` and `ADD_VALUE_FLAGS` are already constants. The lift is mechanical once somebody takes `index.ts`, which seq 1's agent was scoped out of.

Same rule as seq 1: MOVE, do not rewrite. And re-run `no-writes` after - the whole point is that the UI graph may now reach these specs without reaching the registry.

RECONCILED 2026-08-25 under plan:walk seq:23, against the precedence order.

VERDICT: STANDS, and it is FIRST. Nothing in the plan can start without it: add, list, examples and init declare their flags inside src/cli/index.ts, which test/ui/no-writes.test.ts BANS from src/ui/ because importing it registers the entire mutating command surface as a side effect. Four specs a UI builder cannot reach at all. The lift is mechanical -- ADD_FLAGS and ADD_VALUE_FLAGS are already constants -- and it was left only because seq:1 s agent was scoped out of index.ts.

plan:builder IS INTERNALLY CONSISTENT and needed no correction -- the only plan of the six the reconciliation has read that did not. Its sequence stands: 1b, 1c, 2, 2b, 3, 4, then the mockup (plan:walk seq:20), then 5, 6, 7, 8, with plan:walk seq:21 teaching the parity gates to understand a screen that instantiates a pattern.
