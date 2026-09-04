---
id: TASK-lift-the-argument-parsers-into-a-module-the-cli-and-the-ui
type: task
title: lift the argument parsers into a module the CLI and the UI can both import
status: active
severity: soft
always: false
summary: Move the code that understands command arguments somewhere the read-only viewer can use it, without dragging in anything that can change data.
summary_of: f7c449878be98d5d
scope: []
tags:
  - "plan:builder"
  - "seq:1"
  - "state:done"
  - v2
  - ui
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: 9d6c2ca9299f4613
state: done
plan: builder
seq: "1"
---

# lift the argument parsers into a module the CLI and the UI can both import

The foundation, and the biggest risk in this plan.

THE CONSTRAINT: `test/ui/no-writes.test.ts` bans `src/cli/index.ts` from `src/ui/` - not as tidiness but because that module registers the whole mutating command surface as an import side effect, so merely reaching it puts every writing command in the process. Read its `BANNED_ENTRY_MODULES` comment before touching anything.

So each command's FLAG SPEC and its ARGUMENT PARSER move into a module that binds no mutator: what flags exist, which take values, which are required, which are positional. The CLI keeps executing; the UI gets to parse.

PRECEDENT ALREADY FILED: plan:api seq:5 lifts `stageOf`, `STAGES` and `READY_TAG` into a core module both import, for the same reason. Do that one first or alongside; it is the same move at smaller scale and will teach the shape.

DO NOT rewrite a parser while moving it. A lift that also changes behaviour cannot be reviewed - the diff stops being a move. Move first, with the existing tests green and unchanged; change afterwards if anything needs changing.

THE CHECK THAT MATTERS: `no-writes.test.ts` must still pass, and the set of ruled write bindings under `src/ui/` must not grow. If lifting a parser drags a mutator into the graph, the lift is wrong.
