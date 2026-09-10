---
id: TASK-retiring-an-item-asks-before-it-happens-wherever-it-is
type: task
title: retiring an item asks before it happens, wherever it is triggered from
status: active
severity: soft
always: false
summary: Replacing a rule that is in force always asks first, not only when it is done through one particular command.
summary_of: de08b00edb0d6e6b
scope:
  - src/core/mutate.ts
  - src/cli/**
  - test/**
tags:
  - v2
  - governance
  - corpus
  - "plan:contra"
  - "seq:4"
  - "state:done"
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-09-08
valid_until: null
checksum: 857afde54d29b722
plan: contra
seq: "4"
state: done
priority: "1"
verified_on: 2026-09-10
---

# retiring an item asks before it happens, wherever it is triggered from

Owner ruling 2026-09-08. Found by the lane that built the contradiction gate, in its own work.

THE HOLE. `--supersedes <id>` can now be answered from `add` and `edit`, because the gate offers it
as a disposition. But supersedeItem itself NEVER PROMPTED - the confirm lives in the `mycontext
supersede` command, not in the mutation. So retiring a governing item through the gate happens with
no confirmation at all.

preflightSupersede already asks the two refusals that matter BEFORE the write (an unknown id, and a
non-human retiring a governing normative item). What remains is a mid-write failure: the
existing-successor refusal, or a target that stops being writable, can still surface AFTER the create
- leaving the new item on disk and the old one un-retired.

WHAT TO BUILD: the same confirm `mycontext supersede` already shows, on the gated path. Retiring
something that governs is irreversible enough that it asks WHEREVER it is triggered from. The
wording should be the existing one, not a second one.

THE ALTERNATIVE THE OWNER CONSIDERED AND DID NOT TAKE: making create-plus-retire atomic. It is the
better guarantee, and this codebase has no transaction primitive today, so it is a larger piece of
work. If the confirm turns out not to close the half-done-pair case, that is the next move rather
than a wider confirm.

BUILT 2026-09-08, and the entry points were ENUMERATED FROM THE CODE on 2026-09-10 rather than from
memory. The confirm is a hook on `MutationContext` - `core` must not import `cli` - carrying the
EXISTING sentence, `supersedeQuestion`, lifted out of the supersede command and imported back, so
there is exactly one wording.

EVERY WAY AN ITEM CAN BE RETIRED, and what each does now.

Through `supersedeItem`, which names a replacement: (1) `mycontext supersede` previews the change
and asks `supersedeQuestion` itself - it deliberately does NOT set the hook, or a person would be
asked the same thing twice in one command. (2) `mycontext add --supersedes <id>`, the contradiction
gate's disposition, asks through `preflightSupersede` BEFORE the create, because the retirement runs
after it. (3) `mycontext edit <id> --supersedes <id>`, the same disposition on the edit surface,
same pre-flight. (4) The `supersede_item` MCP tool and (5) `applyCandidates` (ingest/apply.ts) have
no person to ask; what protects a governing item there is the ORIGIN guard - `governsNormatively`
refuses a non-human caller outright - and a missing hook is therefore never a silent "yes" on the
path that matters.

Through `updateItem`, which names no replacement and which nothing in this item's original text
accounted for: (6) `mycontext edit <id> --status deprecated` - `edit`'s gate is computed from the
state the edit STARTS from as well as the one it results in, so taking a governing item OUT is
gated and previewed. (7) `mycontext review discard`, (8) `mycontext procedure done` and (9) the
origin half of `mycontext inbox promote` each print a preview and call `confirmAction` before the
write. (10) MCP `update_item({status})` on a normative item is refused for a non-human caller by
the same origin guard. NO PATH RETIRES SILENTLY.

The UI is not a tenth door: it writes nothing (`test/ui/no-writes.test.ts` walks the module graph),
and `mycontext link` cannot forge `supersedes`/`superseded_by`.

AND ONE DEFECT WAS FOUND EN ROUTE THAT IS WORSE THAN THE ONE THIS ITEM WAS FILED FOR: `add
--supersedes` retired an item and PRINTED NOTHING, because `createItem` discarded `supersedeItem`'s
message - under `--yes` there was neither a prompt nor a line, an irreversible act invisible on the
surface that performed it. It now carries the message.

The mid-write failure this item names is NOT closed: the existing-successor refusal, or a target
that stops being writable, can still surface after the create and leave the new item on disk with
the old one un-retired. The pre-flight makes it rarer, not impossible. The owner's stated next move
if that matters is create-plus-retire as one atomic act, which needs a transaction primitive this
codebase does not have.
