# Simulate a budget before you commit to it

Every command and every block of output on this page was run against a fresh
workspace while writing it. Nothing here is illustrative.

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

Each injection tier has a token budget. Raise one and more arrives, at a cost
charged to every session that pays that tier. Lower one and something stops
arriving — but not necessarily the thing you expected.

This feature is how you find out which, before you write the number into
`config.json`.

## How it works

**Five budgets, and these are the shipped defaults:**

| Tier | Default | Charged |
|---|---:|---|
| `restored` | 8000 | after a compaction |
| `pinned` | 6000 | every session start |
| `jit` | 6000 | on a matching file touch |
| `continuity` | 2000 | after a compaction, for handover text |
| `index` | 1200 | every session start |

`continuity` is deliberately the smallest full-text budget, and its overflow is
loud rather than absorbed: an item that does not fit it is named in the preview,
in the injected block and as a doctor finding.

**An item that does not fit spills whole.** Nothing is truncated, ever, and the
spill is disclosed by id.

**The selector is first-fit, and that is the counter-intuitive part.**
`fitToBudget` keeps trying later items after one fails to fit, so a *larger*
budget can admit one large item early and crowd out two smaller ones. Raising a
budget can therefore **evict** an item. "Spilled" is not a priority ranking, and
the product says so wherever it draws a spill.

**Budgets compose.** A session start pays `pinned` + `index`; a file touch pays
`jit`; a compaction pays `restored` + `continuity`.

## From the CLI

Budgets are configuration, so the terminal reaches them the way it reaches any
other setting — `.my_context/config.json`, under `budgets`:

```json
{
  "profile": "standard",
  "budgets": { "pinned": 4000 }
}
```

Every key is optional and any you omit keeps its default. A typo is never
accepted and dropped in silence. A tier name that is not one of the five is
**refused** inside the block — it names itself in the error, beside the five
this config accepts, and nothing is loaded. A misspelling of the section itself,
`"budget"` for `"budgets"`, is a top-level key: it is **skipped and disclosed**
rather than read, so the budgets stay at their defaults and you are told which
key went unread.

Raise the pinned budget only if you have a reason: it is charged to every
session forever. Scope delivers the same knowledge exactly when it is relevant,
for nothing.

The arithmetic shows up before any write that could change it. `mycontext
refresh` on a reference prints the size change and the budget the item competes
in before it asks:

```console
$ mycontext refresh REF-architecture-overview
about to refresh:
  item        REF-architecture-overview
  type        reference
  source      docs/ARCHITECTURE.md
  checksum    11464bc9a02d1351 -> e308f1fc47813cde
  size        3 -> 3 line(s), ~16 -> ~18 estimated tokens
  budget      this category is on the rationale tier, so the item is never injected in full and costs the injection budget nothing. It is stored, searchable, and counted in the session index. Retiering the category to "normative" in config changes that — and changes what governs this project — see README, "reference".
  the item's title, observations, relations, scope and tags are untouched; only the
  body is replaced, whole, by the file's current text.

my_context: refusing without confirmation — stdin is not interactive. Rerun with --yes to confirm, or run this from an interactive terminal.
```

Retier that category to `normative` and the same line changes to name the
largest full-text budget the item now competes against.

`mycontext audit --items --role spilled` is the after-the-fact answer: which
items the budgets have actually been dropping.

**What the CLI can do here that the UI cannot.** Nothing that the browser cannot
also reach — but the terminal is the only place `budgets` can be set by hand,
tier by tier, in a file you can diff and review.

## From the UI

The **Budget simulator** (`nav.inj`) is the screen this feature is really about.
Its verdict is *all five tiers*, and its subtitle states the trap up front:
*"Drag a budget and watch what fits. Raising it can evict an item — the selector
is first-fit, not a ranked cut line."*

What it draws:

- **A row per tier** — budget, fits, spills — where "fits" is a **ratio**, not a
  count: *"{fits} of {eligible}"*, so a full budget and an empty corpus cannot
  look the same.
- **The admission staircase** — items admitted at every budget value. The sweep
  is **exact, not sampled**: the selector re-runs at every cumulative candidate
  cost, so nothing between two rungs is invented. A red rung is an eviction.
- **A range control**, which sets how far the slider explores. It is a bound the
  simulator owns, not a budget — nothing on this screen writes `config.json`.
- **The spill list, split in two**: items *already in context* (the agent holds
  them; spending this tier's budget on them would change nothing) and items
  *genuinely absent* (never delivered this session — raising the budget is what
  would actually change what arrives). That split is the difference between a
  budget that is too small and a budget that is being spent twice.

It answers two questions and labels which one you are reading: the **cold**
question — what a brand-new window would get from this corpus and these budgets
— and the session question, what the selected session would get right now with
the seen set it was handed.

The **Configure** screen is where a simulated number becomes a real one, and it
is the one write the server performs *itself* rather than by running a CLI
command: budgets, behind a confirm, with `config.json` re-read at write time so
a change made elsewhere in the meantime is not clobbered. Exactly the `budgets`
property is replaced; the rest of the file is left as it was.

**What the UI can do here that the CLI cannot.** Everything above. There is no
terminal command that sweeps a budget, and no way in a terminal to see the
eviction rung at all.

**What the UI cannot do here.** Change any setting other than budgets. Profile,
category tiers, `scopePolicy` and `watchedDocs` are composed for you to run or
edited in the file; the simulator itself writes nothing at all.
