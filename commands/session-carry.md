---
description: Choose which past session a new session carries items forward from
argument-hint: "[<session-id> | --none | --show]"
disable-model-invocation: true
---

Choose which of this project's earlier sessions a **new** session carries items forward
from. This is the cross-session continuity that marks carried ids and hoists them to the
front of the injected index — a standing choice about future sessions, not the one-shot
`/mycontext:carry` (there is no such slash command, deliberately: it marks one item for the
very next injection and is a judgement `mycontext help` explains belongs to a person
reading what just spilled, not to this flow).

What the user typed: $ARGUMENTS

1. With no argument, run: `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" session carry --show`
   and print it as printed. It says which session a new one would carry from today — the
   default (the most recent *other* session) or something chosen — and how many ids that
   session had. That count is what the source session **had**, not how many will get a
   line next time: that is decided fresh at the next session start, against that moment's
   budget, and the injected block discloses the rest.
2. To choose a different source, first run
   `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" session list` if you do not already have
   an id — its `carryable` column says which sessions still have anything on disk to carry;
   a session marked "no" is refused rather than silently accepted. Then run:

   `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" session carry <id>`
3. `--none` turns carrying off entirely — its own state, not "nobody has chosen" falling
   back to the default — and `--show` (step 1) reads whichever of the two is in effect, at
   any time:

   `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" session carry --none`

Print whichever result came back exactly as it was printed.

**This writes no audit record**, for the same reason `/mycontext:session-name` does not: it
changes session metadata, not anything this project's items assert, and there is no
`--yes` to gate — nothing here is a change to what governs this project.
