# Find what stopped mattering

Every command and every block of output on this page was run against a fresh
workspace while writing it. Nothing here is illustrative.

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

A corpus that only grows stops being read. Somewhere in it are items nobody has
needed for months — and somewhere else are items that look abandoned and are
simply covering a directory nobody touched this quarter.

Decay is the report that tells the two apart, and it is unusually careful about
saying which of them it cannot tell apart at all.

## How it works

**"Cold" means: not auto-injected in the last N sessions.** The window is
counted in *sessions*, not weeks — there is no clock in this measurement.

**The ledger records injection, not reading or reliance.** That is the caveat
the report leads with, and it is the whole reason this feature is a report and
not an action. A new item, an item consulted with `mycontext show`, an item read
through the MCP `get_item` tool, and an item opened as a Markdown file all look
exactly like an abandoned one here.

**The ledger keeps one row per session, item and tier.** A repeat in one session
collides, so what is stored is first-injections only.

Three shapes are worth telling apart, and the report does:

- **cold** — not injected in the window.
- **never injected** — a kind, not a big number. It has no history at all,
  which is different from having a history that stopped.
- **pinned and cold** — a defect signal, not decay. An `always: true` item that
  is not arriving is a selection bug.

**Unrestricted items are a view, not a bucket.** Items that are active,
normative and unscoped are listed as their own breadth view over cold and warm
together — each is *also* counted as one or the other. It is not a fourth
category, and it is not a defect: add a scope glob only if you meant to narrow
where the item applies.

## From the CLI

```console
$ mycontext decay
my_context decay — items not injected in the last 20 session(s). The ledger holds 0 session(s).
  "cold" means: not auto-injected in the last window of sessions. It does NOT mean unused — the
  ledger records injection, not reading or reliance, so a new item, and any item consulted via
  `show`, MCP `get_item`, or the Markdown file directly, look exactly like an abandoned one here.
  Do not supersede or deprecate anything on this report alone — verify real usage first.
  (no sessions recorded yet — nothing here has been measured; "cold" currently means only "never
  injected")

cold (2) — not auto-injected in the window; check before acting:
  ┌───────────────────────────────────────────────┬────────────┬────────────────┐
  │ id                                            │ type       │ usage          │
  ├───────────────────────────────────────────────┼────────────┼────────────────┤
  │ CONST-card-numbers-never-reach-the-logs       │ constraint │ never injected │
  │ RULE-every-price-is-an-integer-of-minor-units │ rule       │ never injected │
  └───────────────────────────────────────────────┴────────────┴────────────────┘

unrestricted (1) — active and normative with no scope, so they apply to every file and compete for
the jit budget on every file operation. Each is also counted as cold or warm — this is a view over
those rows, not a fourth bucket. Not a defect: add a scope glob only if you meant to narrow where
the item applies.
  ┌───────────────────────────────────────────────┬──────┬────────────────┐
  │ id                                            │ type │ usage          │
  ├───────────────────────────────────────────────┼──────┼────────────────┤
  │ RULE-every-price-is-an-integer-of-minor-units │ rule │ never injected │
  └───────────────────────────────────────────────┴──────┴────────────────┘
```

Read the caveat before the table. On a young ledger the report says so directly:
*"cold" currently means only "never injected"*.

```bash
mycontext decay --sessions 50    # a different window
mycontext decay --all            # include what the default view hides
mycontext decay --json           # the same answer, machine-readable
```

Acting on a decay finding is an ordinary corpus edit —
`mycontext supersede <old> --by <new>`, or `mycontext edit <id> --status
deprecated`. There is no "clean up" command, deliberately.

**The slash command.** `/mycontext:decay`.

**From an agent**, `decay_report` answers the same question.

**What the CLI can do here that the UI cannot.** Change the window, ask for the
full list, and take the answer as JSON. And act on it: neither supersede nor
deprecate is reachable from the Decay screen.

## From the UI

The **Decay** screen (`nav.ev`) is *a chart, not a table — of sessions*, and it
draws two different measurements that are easy to confuse:

- **The recency comb** — one tooth per item, never bucketed, so a corpus of
  forty items is forty teeth rather than five bars. Warm, cold, never-injected
  and pinned-and-cold are each their own mark.
- **A 90-day delivery heatstrip**, per item, one cell per day. Intensity is how
  much was delivered; **hatched** means *spilled* that day; empty means nothing
  happened — quiet, rather than chosen or thrown away.

The caveat is on the screen, not only in the terminal: the axis and the badge
are both counted in sessions, and the screen states whether the window sits
inside what the ledger can actually see or runs past it — in which case "cold"
mostly means "new", and it says so.

**What the UI can do here that the CLI cannot.** Show *when* delivery stopped
rather than only that it has, and show spilled days beside delivered ones — the
terminal report has no time axis at all.

**What the UI cannot do here.** Change the window, or retire anything. Decay is
a read on both surfaces; only the terminal can act on what it finds.
