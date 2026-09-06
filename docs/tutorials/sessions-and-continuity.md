# Carry work from one session into the next

Every command and every block of output on this page was run against a fresh
workspace while writing it. Nothing here is illustrative.

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

A session ends — cleanly, or by compaction, or because you closed the window.
The next one starts knowing what the corpus says and nothing about what you were
in the middle of.

Continuity is the small, deliberately bounded bridge between the two: which
items the last session had actually seen, hoisted to the front of the next
session's index so the thread is not lost.

## How it works

**A session is a thing the audit log already knows about.** `mycontext session`
does not enumerate anything new — it reads the same projection `mycontext audit`
reads, and adds the two columns a *selector* needs: the name a person gave the
session, and whether anything of that session survives to be carried.

**Nothing is invented for an unnamed session.** No derived label, no "session
from Tuesday", not even the short id moved into the name column. A derived name
can be wrong, and naming is precisely the moment you know what a session was
for. The short prefix is a poor label and an honest one, so it gets a column of
its own.

**What a carry actually is, stated precisely:** a carried id is *marked in the
index and hoisted to the front of it*. It is **not** delivered in full, and it
shares `budgets.index` with every other line. An id the source session only ever
saw as an index line is not carried at all.

**The default source is the most recent other session**, and that moves as new
sessions run. `mycontext session carry <id>` pins it to one; `--none` turns it
off.

**Carryability expires.** `state/` is swept at 30 days, so a session this log
still names can have nothing left to carry — and the listing says so rather than
letting the row imply otherwise.

**`continuity` has its own budget**, 2,000 estimated tokens by default and
deliberately the smallest full-text budget. Its overflow is loud rather than
absorbed: an item that does not fit is named in the injection preview, in the
injected block, and as a doctor finding.

## From the CLI

```console
$ mycontext session list
my_context: sessions this workspace has recorded (most recent 20):
  ┌───────────────────┬──────────┬──────┬──────────┬────────────────┬───────────┐
  │ session           │ short    │ name │ activity │ last           │ carryable │
  ├───────────────────┼──────────┼──────┼──────────┼────────────────┼───────────┤
  │ demo-session-0001 │ demo-ses │      │ 2        │ 09-05 11:29:10 │ yes       │
  └───────────────────┴──────────┴──────┴──────────┴────────────────┴───────────┘

note: `carryable` is whether that session's dedupe state is still on disk. `state/` is swept at 30
      days, so a session this log still names can have nothing left to carry.
```

```console
$ mycontext session carry --show
my_context: new sessions carry 2 item id(s) forward from demo-session-0001 (demo-ses), by default —
the most recent other session, which moves as new sessions run.

note: a carried id is marked in the index and hoisted to the front of it; it is not delivered in
      full, and it shares `budgets.index` with every other line. An id the source session only ever
      saw as an index line is not carried at all. The CLI is handed no session id, so this answer
      excludes nothing as the current session — a live session start excludes its own.
note: this count is what the source session HAD. How many of those ids get an index line is decided
      at the next session start, and the injected block says which ones did not and why, under its
      index heading.
```

Read the second note. This answer is *what the source session had*; how many of
those ids get an index line is decided at the next session start, and the
injected block says which ones did not and why.

```bash
mycontext session list [--json]            # the sessions this workspace has had
mycontext session name <session-id> "<name>"   # name one, while you remember what it was for
mycontext session carry <session-id>       # carry from that session specifically
mycontext session carry --none             # carry from nothing
mycontext session carry --show             # what is set, and what it would carry
```

For a single item rather than a session's whole seen set, `mycontext carry <id>`
is the one-shot override described in *Preview what a query would inject, and
pull back what spilled*.

**Asking for the handover before you are ready to stop.** The handover note is the
other half of continuity: a session writes it, the next one is delivered it. It is
normally asked for automatically when the context window crosses
`handover.thresholdPercent`, but you do not have to wait for that — if you are
about to compact or start fresh, ask for it now:

```bash
mycontext handover ask                    # ask THIS session, at whatever it holds
```

It asks the session it is running in, so it only works from inside Claude Code —
from a plain terminal it refuses and says so. It refuses too when it cannot read
how full the window is (no percentage is guessed), and when this session still has
subagents running, which it names so you can choose between waiting for them and
going ahead with `--anyway`.

**The slash commands.** `/mycontext:session-name`, `/mycontext:session-carry` and
`/mycontext:handover`.

**What the CLI can do here that the UI cannot.** All of it. Neither `session`
nor `carry` is in the browser's command catalogue, and no screen names or
changes a carry source.

## From the UI

There is no session screen, but sessions are the **axis** of three of them, and
that is where the browser earns its place:

- **Injected now** takes a session and draws what that session was actually
  given, from its own seen file.
- **Injection preview** takes a session and answers what it would get *now*,
  with the seen set it was handed — as against the *cold* question, what a
  brand-new window would get. The screen labels which of the two you are
  reading, because they are two questions rather than two views.
- **Budget simulator** makes the same split, and defaults to the cold question.

Carried index lines are drawn on the preview screen, with the product's own
reason for drawing them: *"an item arriving unseen is as much a defect as one
silently dropped."*

**What the UI can do here that the CLI cannot.** Compare sessions. Picking a
different session on the preview screen and watching the answer change is the
only place the effect of a carry is visible as an effect.

**What the UI cannot do here.** Name a session, list sessions, set or clear a
carry source. Continuity is configured from a terminal only.
