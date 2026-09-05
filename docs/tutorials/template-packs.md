# Start a new project from a template pack

Every command and every block of output on this page was run against a fresh
workspace while writing it. Nothing here is illustrative.

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

A brand-new workspace governs nothing. For a project in a domain someone has
already thought about — a regulated industry, a particular framework, a house
style — starting from an opinion beats starting from empty.

A template pack is a pre-authored corpus somebody published, imported so that
your first session already has something to say.

## How it works

**Every item a pack brings in arrives as a `draft`.** Both routes into a
workspace — `mycontext init --pack <path>` and `mycontext pack import <path>` —
land the same way, and **there is no `--trust` flag**: a boundary a flag can
override is not a boundary. You promote what you want; the rest never governs.

**A pack carries domain knowledge, and never a setting that describes you.** It
may carry items and category configuration. It may not carry your budgets or
your repository layout, because its author cannot see either.

**Integrity, described accurately.** A pack has a full per-file digest, sorted,
and a version string the author supplied when packing — descriptive, because
there is no git address to derive one from. Discovery is a curated list in the
docs: no registry, no re-fetch, no version check over the network. Updating
means importing again, and the three collision buckets show you what changed.

**What the digest does not prove**, stated plainly because it is the thing most
easily over-read: a checksum proves the files arrived intact. It says nothing
about whether the author is trustworthy, and it never gates activation.

**Importing sorts every incoming item into three buckets** — new, same id with
different content, and identical — and nothing applies unconfirmed.

## From the CLI

```console
$ mycontext pack list
my_context: no packs have been imported into this workspace. `mycontext pack import <path>` reads
one, and `mycontext export --as-pack` writes one.
```

```bash
mycontext init --pack ./packs/regulated-industry   # start a workspace from one
mycontext pack import ./packs/regulated-industry   # add one to a workspace you have
mycontext pack list                                # what has been imported here
mycontext export --out ./out --as-pack             # write one of your own
```

After an import, the drafts are in the ordinary review queue:

```bash
mycontext review
mycontext review promote <id> --scope "src/**" --yes
```

**There is no slash command for packs.** Importing somebody else's corpus is a
deliberate act at a terminal, not something to do mid-session.

**From an agent**, `preview_pack_import` reads an artefact and reports what
importing it *would* do. There is no tool that performs the import.

**What the CLI can do here that the UI cannot.** All of it. Import, list and
write a pack are terminal acts; the browser reads what is already here.

## From the UI

The **Template packs** screen (`nav.ch`) is four cards of explanation plus the
half the mockup could not draw: the packs actually in *this* workspace, joined
to the corpus as it is now. Without that join it would be an explainer with a
copy button, and the model behind the endpoint says so.

The four cards are the four facts above, each drawn as a small table rather than
prose: where an imported item lands and why, what a pack may and may not carry,
the integrity story with its own disclaimer beside it, and the three import
buckets.

A pack's name and version are strings somebody else wrote, so the screen draws
them as untrusted text — displayed, never interpreted.

**What the UI can do here that the CLI cannot.** Show the pack-trust story and
your imported packs on one screen, so "what did that pack put in here" is a look
rather than a query.

**What the UI cannot do here.** Import a pack, write one, or promote a pack's
drafts from this screen. `pack` is not in the command catalogue at all; the
screen ends at a line you paste, and the drafts are settled on the Review queue
screen.
