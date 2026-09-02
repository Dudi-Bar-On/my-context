---
id: DEC-the-slash-command-hook-observes-and-does-not-write
type: decision
title: the slash-command hook observes and does not write
status: active
severity: soft
always: false
summary: The background watcher that notices which commands you ran only records them; it does not change anything on your behalf while you are typing.
summary_of: 22150ed95ca682a1
scope: []
tags:
  - v2
  - hooks
  - owner-ruling
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-24
valid_until: null
checksum: ebaab39a6035d0b0
---

# the slash-command hook observes and does not write

OWNER RULING, 2026-08-24, settling plan:hooks seq:16, which had been blocked since 2026-08-20 on a measurement that was taken on 2026-08-23.

THE MEASUREMENT, and it landed on the best row of the plan's own decision table. `UserPromptExpansion` fires on a slash command and CARRIES `session_id`:

    {"session_id":"8321812a-...","expansion_type":"slash_command",
     "command_name":"mycontext:status","command_source":"plugin"}

That is Row 1 - "a prompt event fires and carries session_id" - and it beat the row on both of the costs the row itself named. The table said to register a binary that RECOGNISES A SENTINEL LINE the slash command emits; none is needed, because the event already carries `command_name`, parsed and prefixed. And the table warned it is "a hook on every prompt"; the `^mycontext:` matcher means it is not - the platform falls through to a real RegExp for that string, so nothing spawns for a prompt that is not ours.

WHAT WAS DELIVERED: the hook is registered and RECORDS which mycontext slash command ran, with its session id. That is the visibility section 6m.8 wanted.

WHAT WAS DECLINED, and why. Row 1 also says the binary should call `setSessionName` and `setCarrySource` - so that a naming command needs no id typed. That is a hook that WRITES on a user's keystroke, and three things argue against it:

- the one thing it would write is exactly what `mycontext session name` already does explicitly, so the gain is saving a copied id rather than enabling anything;
- the session-name store is the one that was LOSING WRITES under concurrency until 2026-08-24 (plan:hooks seq:13c: 11 of 20 rounds at 32 writers, up to 15 entries lost, every writer reporting success). It is fixed, but adding a keystroke-frequency writer to the store that just had a lost-update defect deserves its own decision rather than arriving as a consequence;
- INV-hooks-fail-open means this hook must never block a prompt. A write that fails open is a write that sometimes does not happen, and a session name that is sometimes set is worse than one that is always typed.

WHAT WOULD REOPEN IT: a measured case where typing the id is the actual friction - the plan's own README section 8 currently cannot claim the "supplies the id automatically" half of 6m.8, and if that turns out to matter to a user rather than to a specification, this is the change that delivers it. The narrower version - write only the CARRY SOURCE, which is machine state a user never types - is the one to consider first.
