# Check whether your corpus is healthy, and what's ready to work on

Every command and every block of output on this page was run against a fresh
workspace while writing it. Nothing here is illustrative.

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

Two questions, asked often enough to deserve their own commands:

- *Is anything in here stale, broken, or quietly not working?*
- *What can I actually start on right now?*

The first is `doctor` and `status`. The second is `ready`. Together they are the
feature that stops a corpus rotting without anybody noticing.

## How it works

**`status` is a summary of the corpus and its own usage.** Counts by category,
by status and by origin; the review queue; ingest progress; the decay window;
and a health line rolled up from `doctor`. It reads the index and the ledger and
changes nothing.

**`doctor` is a set of checks with codes.** It verifies each item's stored
checksum against its file, follows a `reference`'s source document, looks for
orphans, dead scope globs, permission problems and duplicate session ids. It
reports drift; it never silently fixes it. Findings come at three levels —
`error`, `warning`, `notice` — and the exit code is 0 unless there are errors.

**`ack` is how a finding stops nagging without being hidden.** It records that a
person has ruled on one, anchored to the item as it stands: change the item and
the ruling no longer applies, because it was a judgement about that text.

**`ready` derives, and stores nothing.** It walks open tasks, checks each one's
`needs` against the `state` of what it names, and prints those whose needs are
all met, highest priority first. There is no `ready` state on disk to go stale.

## From the CLI

```console
$ mycontext status
my_context 1.0.2: 3 item(s), profile "standard"

by category
  ┌────────────┬───────┐
  │ category   │ items │
  ├────────────┼───────┤
  │ constraint │ 1     │
  │ lesson     │ 1     │
  │ rule       │ 1     │
  └────────────┴───────┘

by status
  ┌────────┬───────┐
  │ status │ items │
  ├────────┼───────┤
  │ active │ 3     │
  └────────┴───────┘

by origin
  ┌────────┬───────┐
  │ origin │ items │
  ├────────┼───────┤
  │ human  │ 3     │
  └────────┴───────┘

review queue: 0 draft(s) pending review — walk it with `mycontext review`.

usage: no sessions recorded yet — decay reporting starts once items begin to be injected.
  1 active normative item(s) carry no scope, so they apply to every file and compete for the jit
  budget on every file operation.

health: 0 error(s), 0 warning(s), 0 note(s) — details from `mycontext doctor`.
```

That warning is the single most useful habit this tool teaches: **scope your
items.** An unscoped normative item is weighed on every file operation forever.

`doctor` on a healthy corpus says so in one line:

```console
$ mycontext doctor
my_context doctor: 0 error(s), 0 warning(s), 0 note(s) across 0 finding(s).
```

And on a corpus where a `reference`'s source moved underneath it:

```console
$ mycontext doctor
source_drift (1)  [warn]
  REF-architecture-overview: "docs/ARCHITECTURE.md" has changed since REF-architecture-overview
    snapshotted it (11464bc9a02d1351 → e308f1fc47813cde). The item still holds the OLD text, and
    that is what any session reading it gets. Nothing was auto-resolved: run `mycontext refresh
    REF-architecture-overview` to take a fresh snapshot, which shows you the size change and asks
    before it writes.

my_context doctor: 0 error(s), 1 warning(s), 0 note(s) across 1 finding(s).
```

Note what that message does: it states the consequence, confirms nothing was
auto-resolved, and names the exact remedy.

`ready` on a corpus with no tasks says what it measured, and what it did not:

```console
$ mycontext ready
my_context: no task is ready to start.

Readiness is derived on every run from `needs` and the `state` of what it names — it is stored
nowhere and there is no `ready` state to go stale. A task with no `needs` is ready here because
nothing in the corpus says otherwise, which is a statement about the corpus and not a promise about
the work: a dependency that was only ever written in prose is invisible to this report. `mycontext
doctor` reports the blocked tasks that name nothing.
```

Ruling on a finding:

```bash
mycontext ack <id> <finding-code>            # one ruling, anchored to the item as it stands
mycontext ack <id> <finding-code> --clear    # withdraw it
mycontext ack --all --code <code> --count <n>  # one ruling for every finding of one code
```

**The slash commands.** `/mycontext:status`, `/mycontext:doctor` and
`/mycontext:ready`.

**From an agent**, `status_report`, `doctor` and `ready` are MCP tools with the
same three answers.

**What the CLI can do here that the UI cannot.** `ack` — the browser has no
acknowledgement control, so ruling on a finding is a terminal act. `--json` and
`--quiet` on `doctor`, and `ready --plan` / `--held`, are also CLI-only.
`mycontext ready` has no screen of its own at all.

## From the UI

Two screens, both under `nav.ev` — *Evidence — why it did or didn't*:

- **Doctor** draws `runChecks`' findings kept whole, in three cards, one per
  level, each row carrying its code. The screen exists because *"exit 1 loses
  the findings list"*: a terminal reports a number, and this reports the
  findings that produced it.
- **Status** is the recorded exception to this UI's no-plain-tables rule: a
  table, kept as a table, claiming nothing more than the counts it holds.

Both are reads. The **Composer** additionally carries `status`, `doctor` and
`decay` as read entries in its catalogue, so you can run one from the browser
and see its real terminal output.

**What the UI can do here that the CLI cannot.** Keep every finding on screen at
once, grouped and worst-code-first, and let you click from a finding to the item
it is about.

**What the UI cannot do here.** Acknowledge a finding, or repair one. Every
remedy `doctor` names is composed for you to run, never run for you — except
through the Composer's explicit confirm, where `repair` and `rebuild` are two of
the catalogue's write entries.
