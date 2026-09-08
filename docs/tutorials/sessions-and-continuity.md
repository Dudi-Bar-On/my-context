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

That is one half of the subject. The other is the **conversation archive**: the
sessions themselves, still on your disk where Claude Code wrote them, read back
as one document you scroll. Continuity decides what the *next* session is told.
The archive is where you go to read what the *last* one actually said — and it
is the only surface here that can answer "what did we decide, and why" three
weeks later.

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

### The conversation archive

**Nothing is copied, and that is the first thing to know about it.** Claude Code
already writes every session to a `.jsonl` file in its own projects directory.
The archive reads those files where they lie and keeps only an *index* beside
your corpus — the session id, the counts, the branch, the size of the file, when
it was last read, and the session's title if it has one. Not the words. The
skeleton of a session, including where in the file each record begins, is worked
out when you open it and is not stored either. Nothing from a conversation
enters your repository. The cost of that is symmetrical and is stated rather
than hidden: a transcript your machine has pruned is gone from the archive too.

**The index is filled from a terminal, and only from a terminal.** The web UI is
read-only, and merely opening the index would create its tables — which is a
write. So `mycontext conversation rebuild` is the one thing that fills it, and
every screen serves what that last run left behind. After the first scan, the
`Stop` hook keeps it current once per assistant turn. That hook refreshes an
index that *already exists* and never creates one, so indexing your transcripts
stays a decision you made once, on purpose, by typing the command.

**A rescan costs what the turn wrote, not what the file holds.** A transcript
never changes what it already contains, so a file whose size and mtime still
match its row is skipped after one `stat`, and a file that has grown is read
from where the last scan stopped — the appended tail only. `--full` re-reads
them whole anyway, which is what you want after an upgrade changes how records
are read.

**A transcript is read up to 256 MB.** Past that the scan stops, and the row
says so rather than implying a total: its prompt and answer counts are printed
with a `+` and are floors, and its end time is where the scan stopped, not where
the conversation did.

**The session is one document, not a list of records.** Measured on the owner's
own transcript on 2026-09-08 — 63,871,429 bytes and 27,813 records — the screen
draws **4,916 nodes**, because a node is one of exactly two things: a turn in
which somebody used words, drawn open; or a *run* of consecutive records in
which nobody did, folded to one line naming what ran and openable in place. The
fold is per run and not per record: a run of thirty-seven tool steps is one line
that says `37 machine steps`, not thirty-seven small rows. Nothing is dropped to
achieve it, and that is arithmetic rather than a promise — every node carries
the number of records it covers, and those spans sum to the record count.

**It is rendered as the terminal showed it.** Text blocks in a transcript hold
Markdown, so Markdown is what gets rendered. Escape sequences are the small
half: colour is drawn, and every escape that is *not* colour — a cursor move, a
screen clear — is removed rather than printed, because the terminal did not show
those either.

**A session opens at its end, and follows itself while it is still being
written.** The end is where the work is; on a 28,000-record session the top is
nowhere near it. From there the page asks one cheap question — has this file
grown? — once a second while its tab is in front, and appends only the new tail.
Two behaviours follow from where *you* are: at the tail it follows you down;
scrolled up, it does not move you, and says `N new below` instead.

**Times are in your clock and say which clock.** A stamp reads
`2026-09-06 14:25 GMT+3`, naming the zone rather than leaving you to assume one.
This is not decoration. It was reported as three hours of a session going
missing: the stored time is UTC, the screen drew it with the `Z` sliced off, and
the reader is UTC+3. `--json` is deliberately untouched and still carries the
stored UTC, because a machine reading it wants the instant, not the courtesy.

**The list says how far behind it is.** Either `Current with every file on disk`
or the number of sessions that have grown and the bytes not yet read — so a
count you are reading can be told from a count that has gone stale.

**Two ways of counting one session, both correct.** See it in the numbers below:
the list says 2 asked, 2 answered and 2 tool steps, while the document over the
same session says 4 turns across 8 records. Neither is broken. The three counts
in the list classify only the records the harness wrote as a user or an
assistant turn; the other two here are book-keeping the harness also wrote — an
attachment record and a queue operation — and they belong to no side of a
conversation. The document has no such gap: it covers every record in the file,
which is why its second number is bigger. Read them as different denominators,
not as a disagreement.

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

### mycontext conversation

Nothing has scanned yet, and the command says so as itself rather than as an
empty list — and it names the directory it would look in, so "nothing here" can
be told apart from "looked in the wrong place". The path below is this machine's;
yours will be your own.

```console
$ mycontext conversation list
my_context: no conversation index in this workspace yet — nothing has been scanned.
my_context: run `mycontext conversation rebuild` to scan C:\Users\UserC\AppData\Local\Temp\mc\h\projects\C--Users-UserC-AppData-Local-Temp-mc-d
```

```console
$ mycontext conversation rebuild
my_context: scanned 1 transcript(s) of 1 in C:\Users\UserC\AppData\Local\Temp\mc\h\projects\C--Users-UserC-AppData-Local-Temp-mc-d
my_context: read 952 byte(s) in 30ms
```

Then one more turn was written to that session, and the same command was run
again. It read 107 bytes rather than 952:

```console
$ mycontext conversation rebuild
my_context: scanned 0 transcript(s) of 1 in C:\Users\UserC\AppData\Local\Temp\mc\h\projects\C--Users-UserC-AppData-Local-Temp-mc-d
my_context: 1 transcript(s) had grown since they were indexed and only the appended tail was read — a transcript never changes what it already holds, so the row is composed rather than rebuilt; `--full` re-reads them whole anyway
my_context: read 107 byte(s) in 19ms
```

```console
$ mycontext conversation list
┌──────────┬────────────────────────┬─────────┬─────────┬────────┬───────┐
│ session  │ ended                  │ prompts │ answers │ branch │ title │
├──────────┼────────────────────────┼─────────┼─────────┼────────┼───────┤
│ demo-ses │ 2026-09-06 14:25 GMT+3 │ 2       │ 2       │ master │ —     │
└──────────┴────────────────────────┴─────────┴─────────┴────────┴───────┘
my_context: showing all 1.
```

Three things in that table are worth reading slowly. `ended` is **your** clock
and names the zone; the stored value is UTC and `--json` still hands you that
one. `title` is `—` because nothing named this session, and an unnamed session
is shown as unnamed rather than given a label somebody invented — the same rule
`session list` follows one section above. And `prompts` and `answers` are the
two counts that classify records somebody spoke in: the file behind this row
holds eight records, and the archive screen's own document says so.

```bash
mycontext conversation list [--limit <n>] [--json]  # what the index holds
mycontext conversation rebuild                      # scan; re-read only what grew
mycontext conversation rebuild --full               # re-read every transcript whole
```

There is no slash command for the archive, and no category: it is not a corpus
capability, it is a reader over files the harness already wrote.

**What the CLI can do here that the UI cannot.** For continuity, all of it:
neither `session` nor `carry` is in the browser's command catalogue, and no
screen names or changes a carry source. For the archive, the *write* half — the
browser can never build or refresh the index, because the server is read-only,
so the first `mycontext conversation rebuild` in a workspace has to be typed.

## From the UI

### Continuity has no screen of its own

No screen names a session, sets a carry source or clears one. But sessions are
the **axis** of three screens, and that is where the browser earns its place:

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

**What the UI cannot do here.** Name a session, list the sessions the audit log
recorded, set or clear a carry source. Continuity is configured from a terminal
only.

### Conversations — where the archive is read

**Read → Conversations.** It opens on a list of sessions, one row each, headed
by where they were read from. A row carries the counts as
`2 asked · 2 answered · 2 tool steps`, the branch, and a title only if the
session has one — a title the model wrote is labelled as the model's, and an
unnamed session says *Untitled session* rather than wearing a name nobody chose.
Above the list, the archive states its own freshness: *Current with every file
on disk*, or how many sessions have grown since the last read and how many bytes
of transcript are not in the list yet. Every count below such a warning is what
the last scan saw, and the screen says so rather than letting the rows imply
otherwise.

**Pick a row and you get the session as one scrollable document.** Not a page of
it. There is no next button and nothing to page through, because the document is
virtualised: only what is on your screen is in the page, and scrolling costs the
window rather than the file. It opens at the end, where the work is.

Reading it:

- **Turns are drawn open**, with who spoke, the time beneath, and the words
  rendered as Markdown — headings, lists, tables and fenced code intact.
- **Machinery is folded per run.** One line — `37 machine steps` — with up to
  four of the tools that ran named on it, and a count of the steps that failed.
  Open it and all thirty-seven are there, in place, with their output. A run
  longer than forty records becomes two folds rather than one unopenable one,
  and each says its own true length.
- **Find in the whole session** filters the document to matching sections and
  says what it searched: the first 140 characters of each turn and the tools
  each run used, not every word of the file. That bound is on screen, so a
  search that misses something can be told from a session that does not contain
  it.
- **Top** and **End** are one control each, because a document you can only
  scroll is a document you cannot leave.
- **A session still being written keeps up with itself**, once a second while
  the tab is in front. At the end of the document new turns simply arrive.
  Scrolled up, nothing moves under you and a `N new below` control appears
  instead — press it when you want to go there.
- **A transcript the harness has deleted** says the file is gone and stops
  looking, showing what the last scan recorded. It does not quietly show an
  empty session.

**What the UI can do here that the CLI cannot.** Read a conversation at all.
`mycontext conversation list` gives you the rows; the words themselves are only
on this screen.

**What the UI cannot do here.** Scan. The list never refreshes itself when you
open the page — reading is all this app does — and the screen tells you the
command to run when you want it current now.
