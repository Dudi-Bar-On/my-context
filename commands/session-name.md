---
description: Give a session a name you can type back later, instead of a hex prefix
argument-hint: "[<session-id-or-prefix> <name>]"
disable-model-invocation: true
---

Give a session in this project a name — a handle you can type back later instead of a
hex prefix.

What the user typed: $ARGUMENTS

1. If no session id was given, run `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" session list`
   and show the table. The `session` column (or an unambiguous prefix of it) is what
   `session name` takes; the `name` column shows what, if anything, a session is already
   called. There is no way to find out which session **this one** is from here — no CLI
   surface is handed a session id — so the id always comes from that list, never a guess.
2. Run it exactly as written:

   `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" session name <id> <name>`

   A name with a space in it has to be quoted, so the shell hands it over as one argument.
3. Print the result as it was printed. It either confirms the new name — and says what
   name it replaced, if any — or refuses: an ambiguous prefix lists every session it could
   mean, an id this log has never seen points back at `mycontext session list`, and a name
   already held by a different session names that session so you can pick another one.

**This writes no audit record.** Naming a session is metadata about the session itself, not
about anything this project's items assert, and it puts no text in front of a model —
`mycontext session name`'s own help gives the full reasoning.

`/mycontext:session-carry` is the sibling command: choosing which earlier session a **new**
session carries items forward from, not naming one.
