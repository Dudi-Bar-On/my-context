# Show my_context state in your terminal's status line

Every command and every block of output on this page was run against a fresh
workspace while writing it. Nothing here is illustrative.

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

Claude Code draws a status line on every assistant message. This feature puts
my_context's own state into it — how much of the context window this corpus is
responsible for, which focus is in force, what the last audited action was — so
the answer is in front of you rather than one command away.

It also does a second thing, quietly and usefully: it tees the payload to disk
so the web UI can join the real context figure to the audit log.

## How it works

**Claude Code pipes a JSON payload to the configured `statusLine` command on
every assistant message.** `mycontext statusline` reads that payload from stdin
and does two things with it:

1. **Tees it whole** to a per-session file, so the web UI can join the context
   number to the audit log on `session_id`.
2. **Prints one line** for Claude Code to display.

**It is opt-in, and installed deliberately.** `mycontext statusline install`
prints your existing `statusLine` setting and what it would replace it with, and
writes nothing without `--yes`. If you already have a status line, the installer
*delegates* to it rather than replacing it, so your own line keeps working.

**This is the one thing in the web-UI design that writes a file**, and it is a
CLI command you install rather than a UI endpoint. The UI itself stays a reader.

**A failure is diagnosed in the line, not in the exit code.** A thrown error or
a non-zero exit would make Claude Code's status line flicker or disappear
between messages, so every branch that has a payload exits 0 and says what went
wrong *in the line itself*. The one non-zero exit is the case where there is no
payload at all — which means a human ran the verb by hand.

Run it that way and it tells you so:

```console
$ mycontext statusline
my_context: `mycontext statusline` expects Claude Code's status-line JSON on stdin. It is installed as a statusLine command by `mycontext statusline install`, which prints your existing setting and what it would replace it with, and writes nothing without --yes.
```

## From the CLI

```bash
mycontext statusline install [--yes]     # print the current setting, and install
mycontext statusline uninstall [--yes]   # put back what was there
mycontext statusline                     # the command Claude Code runs; expects JSON on stdin
```

The line itself can be rendered plain or as a powerline, and it will use colour
only where the terminal says colour is allowed. What it can carry, depending on
what is available: the git branch, the share of the context window my_context is
responsible for, the number of injections and how many of them are unrecorded,
the active focus described in words, and the most recent audited operation.

**There is no slash command**, and no MCP tool. Installing a status line is a
change to *your* Claude Code settings, not to the project's corpus.

**What the CLI can do here that the UI cannot.** All of it. `statusline` is not
in the browser's command catalogue and has no screen.

## From the UI

**The status line has no screen — but it is the reason one number on other
screens is real.**

Without the tee, the web UI has no access to Claude Code's own context figure:
it can count what my_context put into a session, and it cannot know what
fraction of the window that is. With the status line installed, that figure
reaches the UI through the teed file and is joined to the audit log on the
session id.

So the honest statement of the relationship is: **install this feature in the
terminal, and the browser's context-share numbers stop being unmeasured.**
Where the tee is absent, the UI says the figure is unmeasured rather than
guessing one.

**What the UI can do here that the CLI cannot.** Use the number. The status line
shows you one session's share as it happens; the UI joins it to the log, so you
can ask which items that share was actually spent on.

**What the UI cannot do here.** Install, uninstall, configure or render a status
line. It only reads what the tee left behind.
