# The CLI

`mycontext` is the command surface a **human** drives. Capture is not your
route through it — `create_item` is, and `help("capture")` says why — but it is
the surface you will be asked to *print* for a user, and a printed command that
does not exist, or one carrying a flag it does not take, costs them a round
trip and costs you the benefit of the doubt on everything else you printed.

Three failures from one session, all of them answerable from this page:

- `mycontext add rule "…" --always` — was refused, `unknown option "--always"`.
  `add` takes it now, and the lesson survives the fix: see below.
- `mycontext link <id> refines <id>` — refused, `unknown command "link"`.
- `mycontext supersede <id> --reason "…"` — refused, the usage line.

## Commands

Generated from the command registry itself, so this is the set this build
actually dispatches rather than a list somebody kept up to date:

{{COMMAND_LIST}}

**If a verb is not in that list, this CLI does not have it.** There is no alias
table, no abbreviation matching and no plugin that adds a command: an
unrecognised first argument is refused with `unknown command "<name>"` and the
whole list is printed back. `link` is the one that catches people — see below —
and `promote` and `discard` are subcommands of `review`, not commands.

## Flags belong to commands, not to the CLI

There is no global flag vocabulary. `--by` is `supersede`'s, `--agent` is
`lesson`'s, `--unlink` is `edit`'s. A flag one command accepts is refused **by
name** on any other, and nothing is written when it is. A flag that appears on
two commands appears there *deliberately*, and means the same thing on both —
`--always` is on `add`, `edit` and `review promote`, and pins in all three.

The usage above carries the flags that *distinguish* each command. It is not
the complete list for any of them, and this page does not print one: a second
copy of a per-command flag list is stale the day a flag is added, and nothing
would tell you. Two things are authoritative instead, in this order:

1. **The refusal.** `mycontext <command> … --nonsense` prints
   `unknown option "--nonsense"` when the command does not accept it — and that
   check reads the command's own accept-list, so it cannot be out of date. A
   flag that is *not* refused is a flag that exists. Nothing is created by a
   refused call, so probing is free.
2. **The command's own usage line**, printed by the same refusal and by running
   a command that needs an argument without one — `mycontext add`,
   `mycontext show`, `mycontext edit`, `mycontext supersede`. It is prose, so
   it is the second authority rather than the first, but it is per-command and
   it is complete in a way the one-line usage column above is not.

## The three refusals, read

**`--always` was `edit`'s flag and is now `add`'s as well** — the refusal above
is what a printed command got until 2026-09-03, and the lesson it taught is the
one that still holds: read the flag off the command, not off the CLI. `add
--always` pins at capture, in one act, which is what an item carried in from
another corpus needs; `edit --always=true` / `--always=false` pins and unpins an
item that already exists, and `mycontext pin <id>` / `mycontext unpin <id>` are
those two edits with the flag filled in. `--always=false` means "not pinned" on
every one of them: `add` accepts it as the default it already is, and does not
advertise it. `harden` and `soften` are the same shorthand over `--severity`.

**There is no `link` command, and no command creates a relation.** Relations
are recorded through the MCP server: `link_items(from, to, relation)` for an
ordinary edge, and `supersede_item(id, by)` — the human's
`mycontext supersede <id> --by <id>` — for a retirement, which writes both
directions itself. `create_item` does **not** take a `relations` argument; it
refuses it by name and points at those two routes. The one relation verb the
CLI does have is destructive and does not create anything:
`mycontext edit <id> --unlink <relation> <target>` removes an edge, as two
words, repeatable. The vocabulary is closed and lives in `help("workflow")`.

**`supersede` requires `--by <replacement id>`.** Supersession is a
*replacement*, so there is no reading of it without the item that replaces —
the command refuses and writes nothing rather than retiring the item on its
own. `--reason <text>` is real, and optional, and is not a substitute. Retiring
something that nothing replaces is a different act: `mycontext edit <id>
--status deprecated`.

## What this CLI cannot spell at all

- **Creating a relation.** Above.
- **An observation's tags or context.** `mycontext add … --note "<text>"`
  records a `[note]` observation and `--observation kind=text` records one
  under any other kind; both may be repeated and keep command-line order
  between them. What neither carries is the observation's own tags or its
  parenthetical context — `create_item` is the route for those.
- **An item's `type`.** Fixed at creation, on every surface — see
  `help("categories")` for what to do with a misfiled item.
- **Deleting anything.** There is no delete here and none on the tool surface.
  Items are superseded or deprecated; see `help("workflow")`.

## One flag that makes a claim about who ran the command

`mycontext lesson "<text>" --agent` records the lesson with `origin: agent`.
Without the flag the same command claims `origin: human`, which is the one
claim you cannot truthfully make from a shell. The flag adds no way to lie that
the bare command did not already have — it adds the first way to be accurate,
and `lesson` is rationale tier, so what it records governs nothing either way.

It stops there on purpose. `lesson-accept` refuses `--agent` **by name**, in
every spelling including `--agent=false`, because accepting a staged candidate
creates an active rule that governs this repository: that command is not a step
towards the approval gate, it *is* the gate, and an agent spelling of a gate is
the gate's absence. The MCP route is stronger than either — `create_item` and
the other write tools stamp `origin: agent` in the handler, so it is not
something the caller declares at all.

## Who runs these

Several commands on this page change what governs the project with no human in
the loop, and the boundary that keeps them out of your hands is the user's own
permission settings rather than anything enforced here. Print the command for
the user; do not run it for them. The full statement, and the list of which
commands it covers, is in `help("workflow")`.
