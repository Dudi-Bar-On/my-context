# Triage quick captures out of the inbox

Every command and every block of output on this page was run against a fresh
workspace while writing it. Nothing here is illustrative.

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

Most of what occurs to you mid-task is not yet knowledge. "Check whether the 3DS
retry path double-charges" is a worry, not a rule; forcing it through a category
decision at the moment it occurs to you is how it never gets written down at
all.

The inbox is the place for those. Capture now, decide later — and when you do
decide, promote the capture into the category it really was, without losing the
trail back to where it came from.

## How it works

`todo` and `note` are ordinary categories on the **rationale** tier, and that
tier placement is the whole mechanism:

- A todo is never injected into a session in full. The session index reduces the
  whole category to a bare count rather than naming any of these items — so an
  inbox of forty things nobody has built yet costs a session almost nothing.
- Nothing forces an inbox capture to `draft`, so it does not enter the review
  queue. `mycontext review` asks what should govern this project, and the inbox
  is not part of that question.

**Promotion is a create plus a retirement, both recorded.** `inbox-promote`
creates a new item under the category the capture really was, carries the title,
body and tags across, links the new item back with `derived_from`, and marks the
todo `deprecated`. Nothing is deleted: the promoted todo keeps its file, its
body and its observations, and `mycontext todo --all` still lists it.

The `origin` is carried, never restamped — a todo you wrote stays `human` when
it becomes an open question.

## From the CLI

```bash
mycontext add todo "Check whether the 3DS retry path double-charges" \
  --summary "An unverified worry that retrying a 3D Secure authorisation may charge the customer twice." --yes
```

A summary is required here exactly as it is for any other capture — the inbox is
cheap on ceremony, not on the one sentence a future reader needs.

```console
$ mycontext todo
┌──────────────────────────────────────────────────────┬────────┬────────┬─────────────────────────┐
│ id                                                   │ status │ tags   │ title                   │
├──────────────────────────────────────────────────────┼────────┼────────┼─────────────────────────┤
│ TODO-check-whether-the-3ds-retry-path-double-charges │ active │ (none) │ Check whether the 3DS   │
│                                                      │        │        │ retry path              │
│                                                      │        │        │ double-charges          │
└──────────────────────────────────────────────────────┴────────┴────────┴─────────────────────────┘
```

Promoting one shows you the whole trade before it happens:

```console
$ mycontext inbox-promote TODO-check-whether-the-3ds-retry-path-double-charges --to open_question
about to promote out of the inbox:
  from        TODO-check-whether-the-3ds-retry-path-double-charges
  type        todo
  title       Check whether the 3DS retry path double-charges
  status      active -> deprecated
  kept        the file, its body, its observations and its relations all stay, and
              it stays searchable and counted

  to          a new open_question (its id is allocated when it is written)
  title       Check whether the 3DS retry path double-charges
  origin      human (carried from TODO-check-whether-the-3ds-retry-path-double-charges, never restamped)
  status      active
  governs     no scope — unrestricted, so nothing narrows it and it is injected on the first file touched in a session
  linked      the new item will carry "derived_from TODO-check-whether-the-3ds-retry-path-double-charges"

my_context: refusing without confirmation — stdin is not interactive. Rerun with --yes to confirm, or run this from an interactive terminal.
```

Read the `governs` line before you confirm. Promoting into a normative category
with no scope is how an unscoped item gets into a corpus by accident.

`mycontext todo` takes `--tag`, `--all` (include promoted and deprecated ones),
`--limit`, the three width flags and `--json`.

**The slash commands.** `/mycontext:todo` lists the inbox and
`/mycontext:inbox-promote` walks a promotion, both inside a session.

**From an agent**, `list_todos` reads the inbox. There is no promote tool: an
agent may add to the inbox, and a person moves things out of it.

**What the CLI can do here that the UI cannot.** All of it. This feature has no
screen: neither `todo` nor `inbox-promote` is in the browser's command
catalogue, and no screen draws the inbox as a list.

## From the UI

**There is no inbox screen, and that is a real gap rather than a design.** The
nearest the browser gets is the **Ask** screen, where `todo` is a category like
any other and a filter row will list your captures; and the **Status** screen,
where the todo count appears in the by-category table.

**What the UI can do here that the CLI cannot.** Nothing. This is one of the
features where the terminal is strictly ahead.

**What the UI cannot do here.** Draw the inbox as an inbox, or promote anything
out of it. The Capture screen will compose an `add todo` like any other
category, so a capture is possible from the browser; the triage that follows it
is a terminal act.
