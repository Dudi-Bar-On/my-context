# Link two items, and see how your corpus connects

Every command and every block of output on this page was run against a fresh
workspace while writing it. Nothing here is illustrative.

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

A rule that came out of a lesson, a constraint that limits a requirement, an
open question that blocks a task — these are facts about your corpus that no
amount of full-text search will recover once you have forgotten them.

Relations record them, once, in a closed vocabulary, so the connection survives
the person who made it.

## How it works

**Eighteen relation types, and the list is closed**: `derived_from`,
`constrains`, `supersedes`, `blocks`, `mitigates`, `refines`, `relates_to`,
`links_to`, `depends_on`, `caused_by`, `conflicts_with`, `amends`, `produced`,
`discovered_by`, `unblocks`, `enforces`, `enforced_by`, `answers`.

`mycontext help workflow` prints the table of what each one means, rendered from
the same vocabulary the tool accepts — so the help and the enum cannot disagree.

**`superseded_by` is deliberately not one of them.** It asserts a lifecycle
change rather than a relation, and excluding it from the vocabulary *is* the
gate that stops it being forged. `mycontext supersede` writes both of its
directions together so they cannot drift; `link` refuses to write it at all.

**Relations are classified as load-bearing or referential**, and the difference
matters in two places. A focus that hides one end of a *load-bearing* relation
is disclosed as a dangling edge, because the reader is left acting on an
incomplete instruction. A dangling `relates_to` reads as noise; a dangling
`constrains` reads as alarm.

**A relation is stored on the item, in its Markdown**, so it travels with the
export, diffs in a pull request, and is rebuilt into the index rather than
stored only there.

## From the CLI

```console
$ mycontext link RULE-every-price-is-an-integer-of-minor-units refines CONST-card-numbers-never-reach-the-logs
my_context: RULE-every-price-is-an-integer-of-minor-units refines CONST-card-numbers-never-reach-the-logs.
```

Reading the graph back is `search`, which is the part worth knowing:

```console
$ mycontext search --linked-to CONST-card-numbers-never-reach-the-logs
┌───────────────────────────────────────────────┬──────┬────────┐
│ id                                            │ type │ status │
├───────────────────────────────────────────────┼──────┼────────┤
│ RULE-every-price-is-an-integer-of-minor-units │ rule │ active │
└───────────────────────────────────────────────┴──────┴────────┘
```

```bash
mycontext search --relation refines            # every item with a relation of one type
mycontext search --linked-to <id>              # what points at this item
mycontext search --linked-to <id> --direction out   # or what it points at
mycontext edit <id> --unlink <relation> <id>   # remove one
mycontext focus --relations                    # the types a focus can be built on
```

**The slash commands.** `/mycontext:link` and `/mycontext:unlink`.

**From an agent**, `link_items` writes one — and refuses `supersedes`, which is
`supersede_item`'s job.

**What the CLI can do here that the UI cannot.** Write a relation, or remove
one. Neither `link` nor `edit --unlink` is in the browser's command catalogue,
so both are terminal acts. `search --relation`, `--linked-to` and `--direction`
are also CLI-only as flags.

## From the UI

The **Relations** screen (`nav.ev`) draws *an ego-graph, not a hairball*: one
focused item, radius 1, in a deterministic layered layout, with a hard cap of 60
nodes and an explicit "+N more" when the cap bites. No physics, and no graph
library.

**Direction is the layout.** The column an item sits in decides which way the
relation points, so nothing has to be simulated. Each edge shows its relation
type; the line style shows severity, using the same load-bearing classification
the focus disclosure uses.

**Nodes carry ids, not titles**, which keeps bidirectional text out of the SVG.

The type filter is a control, and the screen is careful about the difference
between a fact about the control and a fact about the corpus: *"No relation of
the types you kept"* is about this item and is undone by picking another, while
*"No relation type is selected, so there is nothing to draw — here or on any
other item"* is true everywhere and is undone only by pressing **All**. Items
with no relation of a kept type are hidden with a count and a "list them anyway"
control, rather than drawn as a field of single nodes.

**What the UI can do here that the CLI cannot.** Draw it. `search --linked-to`
answers one hop from one item as a list; this shows the neighbourhood, with
direction, type and severity all visible at once.

**What the UI cannot do here.** Create or delete a relation. The graph is a
read, end to end.
