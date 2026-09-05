# Preview what a query would inject, and pull back what spilled

Every command and every block of output on this page was run against a fresh
workspace while writing it. Nothing here is illustrative.

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

Two related questions, and the second one is the reason this feature exists at
all:

- *If I touch this file now, what will Claude be given?*
- *What did not fit — and how do I get that one item in anyway?*

Injection is a budgeted selection, so "not delivered" is a normal outcome, not
an error. This feature is how you see it happen and how you override it once.

## How it works

**A selection runs six gates, in order:** `eligible`, `tier`, `focus`, `scope`,
`seen`, `budget`. The first one an item fails is the answer — everything above
it passed, everything below was never reached — and each gate has a stable code
so the reason is a value rather than a sentence to parse.

- **eligible** — active, not retired, not superseded, category enabled, not past
  `valid_until`.
- **tier** — only a normative category is injectable in full.
- **focus** — a focus predicate narrows the corpus before scope is considered.
- **scope** — matched against the event path, POSIX-normalised on both sides.
- **seen** — already-delivered items are removed before any budget is checked.
- **budget** — what reaches here and does not fit **spills whole**, with its
  reason. Nothing is ever silently truncated.

**Spilling is first-fit and greedy**, across five tiers — pinned, index, jit,
restored and continuity. The same items at the same costs, tried in another
order, spill a different item. That is a property of the algorithm, and the
product states it rather than hiding it.

**`carry` is the override.** It marks one item for delivery at the *next*
injection regardless of its own budget, as a front-of-queue index line — not the
full item text, and not a change to what governs it. The mark is spent by that
one injection, whether or not the line is admitted, and is not renewed. That is
what makes it different from `pin`, which is permanent and charged to every
session forever.

## From the CLI

```console
$ mycontext carry CONST-card-numbers-never-reach-the-logs
about to mark CONST-card-numbers-never-reach-the-logs ("Card numbers never reach the logs") for
  delivery at the next injection, regardless of its own budget. It is a front-of-queue index line —
  the same disclosure a cross-session carry already gets — not the full item text, and not a change
  to what governs it. The mark is spent by that one injection, whether or not the line is admitted,
  and is not renewed. This does not check whether the item is already in your current context —
  `mycontext status` or the spilled-items list answers that.
my_context: refusing without confirmation — stdin is not interactive. Rerun with --yes to confirm, or run this from an interactive terminal.
```

```console
$ mycontext carry --show
my_context: nothing is carried. `mycontext carry <id>` marks one for the next injection.
```

`mycontext carry <id> --clear` withdraws a mark that has not been spent yet.

To see what spilled after the fact rather than before it:

```bash
mycontext audit --items --role spilled
```

**There is no `mycontext preview` verb.** Previewing a selection for a file you
have not touched is a browser answer; the terminal's equivalent is to touch the
file and read what arrived.

**What the CLI can do here that the UI cannot.** Carry an item. `carry` is not
in the browser's command catalogue, so the override is a terminal act, and so is
clearing one.

## From the UI

The **Injection preview** screen (`nav.inj`) is the landing screen of the whole
UI, and its verdict is the strongest claim on it: *exactly what Claude gets*.

By default it shows what the latest session got at start. Pick a file and it
previews a tool event instead; the session and focus controls above narrow it
exactly as the hook does.

What it draws, and why each part is there:

- **Delivered** — the items, and `{items} items, {used} of {budget} tokens`.
- **Why not — the first gate that failed** — a strip holding one *specimen* per
  gate, the first item that fails there, so the strip stays still as the
  selection moves. Each specimen carries how many items fail with it.
- **Not delivered** — one row per spilled item, whole, across every tier this
  event ran, in try order, with the tier that dropped it and its cost.
- **The budget ribbon** — one segment per admitted item, sized by its cost, with
  a **ghost lane** showing spilled items at the width they would have taken. A
  tier that was never reached is drawn *absent*, not blank, so it cannot look
  like it ran and found nothing.

Two zeroes on that screen are deliberately told apart, which is the whole
lesson: *"everything that reached the budget gate fit"* is a full budget, and
*"nothing reached the budget gate"* is not the same answer. The screen refuses
to draw either as a bare 0.

Carried lines are drawn too — *"an item arriving unseen is as much a defect as
one silently dropped"* — so a carry you set in the terminal is visible here.

**What the UI can do here that the CLI cannot.** Preview a file you have not
touched, for a session you are not in; show the gate ladder with a named
specimen per rung; and draw the ghost lane, which is the only place the *shape*
of a spill is visible rather than its list.

**What the UI cannot do here.** Carry, clear a carry, or change a budget from
this screen. Budgets are the Budget simulator's and the Configure screen's
subject; the carry override has no browser surface at all.
