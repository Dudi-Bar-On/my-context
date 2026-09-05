# Detect and repair a corpus that drifted from disk

Every command and every block of output on this page was run against a fresh
workspace while writing it. Nothing here is illustrative.

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

The items are plain Markdown files, which is the point — and which is also how
they can be changed by something that is not my_context. A hand edit, a merge, a
script, an agent with shell access.

This feature is how you find out that happened, and how you settle it
deliberately rather than by having a tool quietly agree with whatever it found.

## How it works

Three different kinds of drift, and they are not the same problem:

- **Item drift.** Every item carries a `checksum` of its own content. `doctor`
  recomputes it and reports any item whose file no longer matches what was
  recorded.
- **Source drift.** A `reference` also carries the checksum of the *source
  document* it snapshotted. When that document changes, the item still holds the
  old text — and that old text is what any session reading it gets.
- **Index drift.** The SQLite index is derived from the Markdown. It is safe to
  delete, and `rebuild` recreates it.

**`doctor` never silently fixes anything.** Every finding states the
consequence, confirms nothing was auto-resolved, and names the exact remedy.

**`repair` re-stamps a checksum to agree with the file. It cannot recover what
an edit removed.** It is for a deliberate hand edit you stand behind, not for
recovery.

**`refresh` is the source-drift remedy**, and it is a different act from
`repair`: it replaces the item's body, whole, with the source file's current
text. The item's title, observations, relations, scope and tags are untouched.

**`config.json` carries no checksum**, so none of this detects a hand edit to
it.

## From the CLI

A reference whose source moved:

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

The remedy, previewed before it writes:

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

The three verbs, and one more that settles a finding without changing anything:

```bash
mycontext doctor            # checksums, source drift, orphans, dead globs, permissions
mycontext rebuild           # recreate the index from the Markdown
mycontext repair [--yes]    # re-stamp checksums after a deliberate hand edit
mycontext refresh <id>      # re-snapshot a reference from its source file
mycontext ack <id> <code>   # record that a person ruled on a finding, as the item stands
```

`ack` is the honest alternative to editing an item so a check stops firing. The
ruling is anchored to the item as it stands, so changing the item withdraws it.

**The slash command.** `/mycontext:doctor` and `/mycontext:refresh`.

**From an agent**, `doctor` and `refresh_item` are MCP tools. There is no
`repair` tool: re-stamping a checksum is an assertion that a hand edit was
intended, and only a person can make it.

**What the CLI can do here that the UI cannot.** `ack`. `repair`, `rebuild` and
`refresh` are all in the browser's command catalogue, so those three can be run
from a browser behind a confirm; acknowledging a finding cannot, and neither can
`doctor --json` or `doctor --quiet`.

## From the UI

The **Doctor** screen (`nav.ev`) is where drift is read in the browser: three
cards, one per level — `error`, `warning`, `notice` — each row carrying its
finding code, ordered worst-code-first inside each card. It exists because
*"exit 1 loses the findings list"*: a terminal reports a number, and this reports
the findings behind it.

`repair`, `rebuild` and `refresh` sit in the **Composer**'s catalogue.
`rebuild` is the one `kind: 'write'` entry classified *below* the trust
boundary, spelled out rather than omitted, on the reasoning that the index is
derived from the Markdown and rebuilding it changes nothing that governs
anything. `repair` and `refresh` are above the boundary and get the full
confirm.

**What the UI can do here that the CLI cannot.** Keep every finding visible at
once, grouped by level and code, and move from a finding to the item it names.

**What the UI cannot do here.** Acknowledge a finding, refresh a reference, or
resolve drift by itself. Every remedy is either composed for your shell or run
through a confirm you read first.
