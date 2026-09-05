# Watch what my_context is doing, live

Every command and every block of output on this page was run against a fresh
workspace while writing it. Nothing here is illustrative.

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

Two questions this product refuses to answer from memory: *did a person decide
this, or did an agent?* and *what did the budget actually drop?*

The audit log answers both, because it is the only place a spill is recorded at
all. Everything that mutates or injects is appended to it.

## How it works

**It is an append-only log on disk**, under `.my_context/.audit/`, and the
SQLite projection over it is disposable. Deleting the database loses nothing;
`mycontext audit replay-ledger` tops the projection up incrementally and rebuilds
it whole only if the log has diverged.

**Seven record kinds**: mutations, injections, hook actions, focus changes,
access refusals, progress steps, and command executions — the last being the
`execute` / `execute-done` pair the browser's Composer writes around a confirmed
run.

**Two axes are worth learning:**

- **`--origin`** is the trust-boundary axis: `human`, `agent`, `ingest`. It is
  the fastest answer to "did a person decide this?" (The MCP tool calls the same
  parameter `actor`.)
- **`--role`**, which only means something with `--items`, selects whether to
  count an item as the record's `subject`, as `injected`, or as `spilled`.
  Passing it without `--items` is refused rather than ignored.

**Imported history is kept apart.** Records that arrived with somebody else's
export land in `.audit/imported/`, so a reader can always tell witnessed from
told.

**A focus change is a regime change, not a row.** Everything after it in the
feed was selected under different rules, and both surfaces treat it that way.

## From the CLI

```console
$ mycontext audit --summary
my_context: 3 audit record(s) in range, by operation:
  ┌────────┬───────┬────────────────┐
  │ op     │ count │ last           │
  ├────────┼───────┼────────────────┤
  │ create │ 3     │ 09-05 11:20:28 │
  └────────┴───────┴────────────────┘
```

```bash
mycontext audit                              # recent records
mycontext audit --since 1d --origin agent    # what Claude did today
mycontext audit --items --role injected      # which items actually reach sessions
mycontext audit --items --role spilled       # which items the budgets are dropping
mycontext audit --item <id>                  # one item's history
mycontext audit --op create --limit 50       # one operation
mycontext audit --files                      # rolled up per file
mycontext audit replay-ledger                # rebuild the usage projection
```

**The slash command.** `/mycontext:audit`.

**From an agent**, `audit_log` reads the same log; its filter parameter is
`actor`, where the CLI says `--origin`.

**What the CLI can do here that the UI cannot.** Every filter above as a
composable flag, `--files`, `--json`, and `replay-ledger`. Rebuilding the
projection in particular is a terminal act with no browser equivalent.

## From the UI

The **Audit stream** screen (`nav.ev`) states its own reason for existing: *the
only record of what spilled*.

It draws the feed live, in five columns — **At**, **Kind**, **Op**, **Who /
subject** and **Detail** — with a filter per record kind, plus:

- **An activity pulse**, one column per ten seconds, newest at the reading edge.
  Height is the number of records in that column; colour is the kind.
- **Two different silences, named.** *"Measured, and empty — no record landed in
  the last N minutes"* is not the same as *"Not measured — no audit projection
  has ever been built for this workspace"*, and the screen refuses to draw them
  identically.
- **Lane grouping.** A subagent dispatch, its steps and its stop are joined on
  the agent id and folded to one row, expandable, with controls to isolate a
  single lane or clear the filter.
- **The regime-change rule.** A focus change is drawn as a rule across the feed
  rather than a row in it, so it is visible as the boundary it is.

**What the UI can do here that the CLI cannot.** Watch it happen. The pulse, the
lane folding and the regime rule are all shapes over time that a paged terminal
listing cannot show, and the stream updates as records land.

**What the UI cannot do here.** Filter by origin, item or operation as
composable flags, roll up per file, export the feed, or rebuild the projection.
It is a live view over a log it never writes to.
