# The slash commands

`/mycontext:…` is the surface the **user** types. It is not your route — the
tools are, and `help("tools")` is their page — but it is the surface you will
be asked to name for a user, and a slash command that does not exist costs
them a round trip and costs you the benefit of the doubt on everything else
you named.

It is also where several of these commands end up pointing at *you*: a slash
command is a prompt Claude Code hands to the model, so a `/mycontext:edit`
runs through you, prints a preview, and stops. Knowing which ones stop, and
where, is most of this page.

## Every command

Generated from the command files this plugin actually ships — Claude Code
discovers them by scanning `commands/` on disk, so what is in that directory
is what a user can type:

{{SLASH_COMMAND_LIST}}

Those per-category files are generated when the plugin is built, from the
catalogue as it ships. A category your own project adds in `config.json` is
fully usable — `mycontext add` and `create_item` both take it — but it gets no
command file of its own. `help("categories")` is the category list; it is not
repeated here.

## Which of these you may invoke

**One.** Every other command file declares `disable-model-invocation: true`,
which is Claude Code's way of saying the command is the user's to type and not
yours to reach for. The exception, read from the files themselves:

{{SLASH_MODEL_INVOCABLE}}

That is not a security boundary and does not pretend to be one — it keeps a
user surface out of your automatic reach, nothing more. The boundary is
further down this page.

## Which of these stop and hand back, and why

Every command that would change what governs this project runs the CLI
**without** `--yes`, shows the user the preview the CLI itself printed, prints
the `--yes` form for the user to run, and stops. Three things about that are
worth knowing before you meet one:

- **Exit code 1 there is the expected outcome, not a failure.** The command
  refuses because stdin is not a terminal, and nothing was written. Retrying
  it, or adding `--yes` yourself, is the one thing these commands exist to
  prevent.
- **The preview is the CLI's own output.** Show it as printed. It is the whole
  of what the user is being asked to approve, and a summary of it is not.
- **The command it hands back claims `origin: "human"`.** That is the one
  claim you cannot truthfully make from a shell. `help("workflow")` states the
  boundary in full and lists the commands it covers.

## The two acts with no slash command at all

`lesson-accept` is the approval gate itself. It turns a staged candidate into
a **rule**: normative, active, and governing this repository from the moment it
exists. It claims `origin: "human"`, it has **no `--agent` spelling** and is
not getting one — asked for the flag it answers *"lesson-accept takes no
--agent, and there is no spelling of it that would"* — and it has no slash
command, so there is no route through this surface that runs it.
`/mycontext:lesson-stage` prints it for the user and stops. Recording what was
learned and approving what everyone is now obliged to do are different acts,
and only the first has an honest agent spelling
(`mycontext lesson --agent`, and `create_item`, which is stronger — see
`help("tools")`).

Every CLI verb with no slash command, and the declared reason for each:

{{SLASH_ABSENCES}}

## The gate is the user's settings.json, not this program

Promotion is a human action **by convention and by permission settings, not by
enforcement** — `help("workflow")` states that in full, and it is true of this
surface too. Nothing on this page is enforced by the program. Every command
above is an ordinary CLI invocation, and anything that can run a shell can run
the `--yes` form directly without going through a slash command at all.

What can enforce it is the user's own `.claude/settings.json` deny list, and
the README recommends one. **It is a prefix match on the command string, and
that is narrower than it looks.** `Bash(mycontext lesson-accept *)` denies
`mycontext lesson-accept …` and nothing else: a `node` invocation of the same
file, an `npx` spelling, or a shell variable holding the path is a different
string and is not denied. Neither is a shell redirect into `.my_context/`
followed by `mycontext rebuild`.

That is not hypothetical here. The command files above invoke the CLI as
`node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" <command>`, because that is how
a plugin reaches its own code — so the very line `/mycontext:lesson-stage`
prints for the user to run is a spelling the recommended
`Bash(mycontext lesson-accept *)` rule does not match. A plugin cannot ship
permission rules, so nothing here can close that; only the user's settings
file can, and only if it covers every spelling.

Which leaves the honest statement: **print the command for the user, and do
not run it for them.** That is the boundary as it actually holds — a habit
rather than a lock.
