# Export your corpus, and import it somewhere else

Every command and every block of output on this page was run against a fresh
workspace while writing it. Nothing here is illustrative.

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

Your corpus already lives in the repository, so for anybody sharing that
repository there is nothing to do. This feature is for everybody else: another
workspace, another team, or a machine with no common remote.

## How it works

**What travels, and what does not.** Items travel. History travels, *filtered*:
mutation records carry; injections, hook actions, focus records, refusals and
procedure ticks do not. The index is rebuilt on the far side rather than
shipped, because it is derived.

Imported history lands in `.audit/imported/`, kept apart from the receiver's
own, so a reader can always tell **witnessed** from **told**.

**Two formats ship, and the ladder names a third that does not.**

- **A plain directory** (`--format dir`, the default) — canonical. Readable,
  diffable, and needs no tool to open it.
- **A deterministic ZIP** (`--format zip`) — fixed order, fixed timestamps, so
  the same corpus is the same bytes.
- **A git bundle** is the rung between them on the Export / import screen's
  ladder, and it is **not built**. The screen draws it as unbuilt rather than
  omitting it; `--format` takes `dir` or `zip` and refuses anything else.

**An export can be a pack.** `--as-pack` writes the artefact in the shape
*Start a new project from a template pack* describes, where every item lands on
the far side as a draft.

**On import, nothing applies unconfirmed.** Every incoming item is sorted into
one of three buckets — new, same id with different content, or identical — and
the collision report is printed before anything is written.

## From the CLI

The dry run tells you exactly what would travel, and writes nothing:

```console
$ mycontext export --out ../export-demo --dry-run
my_context: about to export 4 item(s) to C:\…\export-demo as a full export
  constraint 1   lesson 1   rule 1   todo 1
  history: 5 mutation record(s), filtered to mutations and joined to these items
  not travelling: injections, hook actions, focus records, the index, session state,
                  revisions, ingest sessions and staged lessons
  nothing was written — this was a --dry-run. Run it again without --dry-run to write the artefact
  above.
```

Read the *not travelling* list before you rely on the artefact for anything. A
pending revision and a staged lesson stay behind: they are proposals in a
workspace, not knowledge about a domain.

```bash
mycontext export --out ../corpus                    # a plain directory (the default)
mycontext export --out ../corpus.zip --format zip   # deterministic ZIP
mycontext export --out ../pack --as-pack            # as a template pack
mycontext export --out ../corpus --json             # the same answer, machine-readable

mycontext pack import ../pack                       # the other end
mycontext init --pack ../pack                       # or start a new workspace from it
```

**There is no slash command for export or import**, for the same reason there is
none for packs: moving a corpus between machines is a deliberate terminal act.

**What the CLI can do here that the UI cannot.** All of it — export, import,
choose the format, and dry-run. Neither verb is in the browser's command
catalogue.

## From the UI

The **Export / import** screen (`nav.ch`) is three cards and one line you paste:
what travels, the format ladder, and the three buckets an import sorts an
artefact into. Every fact on it comes from the endpoint behind it — six rows, the
audit vocabulary split into travels / filtered / rebuilt, three format rungs,
three bucket names, and the argv itself.

**This screen describes an act and never performs one.** There is no POST behind
it. The line at the bottom is composed for your own shell, and the screen is
explicit that nothing has been copied until you copy it.

The card that earns the screen is the one comparing this to git: the corpus is
already in the repository, so what an export adds is a route to somebody *not*
sharing it.

**What the UI can do here that the CLI cannot.** Put the whole trade on one
screen — what travels, what is filtered, what is rebuilt, and which format rung
is built and which is not — before you run anything. The dry run tells you the
counts; this tells you the rules.

**What the UI cannot do here.** Export anything, import anything, or read an
artefact. It composes the command and stops.
