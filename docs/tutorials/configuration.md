# Configure how my_context behaves for this project

Every command and every block of output on this page was run against a fresh
workspace while writing it. Nothing here is illustrative.

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

The shipped defaults are the ones most projects should keep. But a category can
be on the wrong tier for your team, an aspirational category can be governing
files nobody meant it to, and a budget can be sized for a corpus you no longer
have.

Configuration is where those move — and, because every one of them changes what
governs the project, it is also the place this product is most careful.

## How it works

`.my_context/config.json` is small, and every key is optional:

```json
{
  "profile": "standard",
  "categories": {
    "reference":   { "tier": "normative" },
    "requirement": { "scopePolicy": "inert" },
    "lesson":      { "agentEdits": "review" }
  },
  "budgets": {},
  "watchedDocs": ["docs/**/*.md"]
}
```

| Key | Effect |
|---|---|
| `profile` | which category catalogue applies — `minimal` (8 categories) or `standard` (all 29) |
| `categories.<name>.tier` | move a category between `normative` and `rationale` |
| `categories.<name>.scopePolicy` | `global`, `required` or `inert` — what an empty scope means |
| `categories.<name>.agentEdits` | `allow`, or `review` to stage an agent's edit as a pending revision |
| `categories.<name>.prefix` / `.description` | the id prefix, and what the category is for |
| `budgets` | per-tier token ceilings |
| `watchedDocs` | globs whose edits produce a capture nudge |
| `ui` | whether the web UI is enabled, and a fixed port for it |
| `handover` | which handover document this project keeps |
| `dispatchGate` | `{"enabled": true}` to require a task item on every `Agent` dispatch |

**An unknown key is never dropped in silence, but the two levels answer
differently.** At the *top* level it is **skipped and disclosed**: `"budget"`
for `"budgets"` is not read, and the loader carries the skip so the surface you
are looking at names it rather than leaving you with a dead setting. Inside a
known block — a category entry, `budgets`, `ui`, `dispatchGate` — an unknown key
is still **refused** and nothing is loaded at all, because nothing inside a
known block ever arrives from a newer build.

**A left-out category is absent, not disabled.** Under `minimal`, the categories
the profile does not name are not in the catalogue at all, and their items are
injected nowhere.

**Retiering is the big lever.** Moving `reference` to `normative` makes
references eligible for the pinned tier — which is how you make a document
re-inject itself after every compaction. Try to pin one *before* retiering and
it refuses, exit 1, explaining that `always: true` asks for the pinned tier,
that the pinned tier admits only normative items, and that nothing was changed.

**`config.json` is protected from Claude's file tools but carries no checksum**,
so `doctor` cannot detect a hand edit to it the way it detects a tampered item.
The hook's refusal says it verbatim: *changes to `.my_context/config.json` are
the user's to make — ask, do not edit.*

## From the CLI

`mycontext config` is narrower than the file. It does two things:

```bash
mycontext config <category> --disable [--yes]   # a shipped category, switched off
mycontext config <category> --delete  [--yes]   # a CUSTOM category, removed
mycontext config <path> --set <value> [--yes]   # one field
mycontext config <path> --unset [--yes]
```

Shipped categories are never deletable; custom ones are. Both forms preview
first, name how many items the change touches, and write nothing without
`--yes`.

Everything else is a hand edit of `config.json`, which is the design: the file
is small, it is checked in, and it diffs. What the CLI gives you around it is
the reading — every command resolves the same config, and a command that is
about to act against a category tells you what that category's settings mean for
what you are doing:

```console
my_context: this category is on the rationale tier, so the item is never injected in full and costs the injection budget nothing. It is stored, searchable, and counted in the session index. Retiering the category to "normative" in config changes that — and changes what governs this project — see README, "reference".
```

**What the CLI can do here that the UI cannot.** Every key except `budgets`.
`profile`, category `tier`, `scopePolicy`, `agentEdits`, `prefix`,
`description`, `watchedDocs`, `ui`, `handover` and `dispatchGate` are all hand
edits or `mycontext config` invocations; the browser previews them and composes
the change, but writes only budgets.

## From the UI

The **Configure** screen (`nav.ch`) carries the strongest claim in this product:
*the strongest "a terminal cannot do this"*. Its subtitle is why — *every change
is previewed as a diff, checked against the same `resolveConfig` that reads it.*

One pane per configuration subject — Profile, Budgets, Categories, Watched
documents — and each pane shows three things:

- **What changes**, as a pair: old value struck through, new value highlighted,
  tinted by direction. A lone `+1` chip loses the pairing, so it is not drawn
  that way.
- **The blast radius**, which is the border colour and the count: how much of
  the corpus stops working. `inert` is the most destructive option, and the
  items are **named, not estimated** — the screen runs the same `select` the
  hook runs, twice over the same items, and reports the difference.
- **A measured "no change"** when there is none: *"Nothing starts or stops
  governing, delivery does not move, and all N items are unaffected"*, rather
  than a blank pane.

**Budgets are the one value written here**, past a confirm that shows every
value, and the screen re-reads `config.json` from disk on every load — so
returning to it shows the new value, or a parse error if the JSON broke.

If `config.json` cannot be parsed or cannot be resolved, the screen says which
of the two happened and prints the loader's own message rather than a generic
failure.

**What the UI can do here that the CLI cannot.** Show you what a setting would
do to *this* corpus before you set it: how many items stop being delivered at
session start, how many change who may edit them, and which ones by name. No
terminal command computes that.

**What the UI cannot do here.** Write anything except budgets. Every other pane
composes a block of `config.json` for you to paste. It also cannot edit a
category's list-shaped or nested `extraFields` — those are read-only on screen.
