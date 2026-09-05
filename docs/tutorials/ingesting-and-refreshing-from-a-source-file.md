# Pull items out of a document you already wrote

Every command and every block of output on this page was run against a fresh
workspace while writing it. Nothing here is illustrative.

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

Most teams already wrote it down. A PRD, an architecture note, a runbook, a
design document — full of things that must hold, and none of it reachable by a
session.

Ingest is how that document becomes items, chunk by chunk, without anybody
retyping it and without a model quietly deciding what governs.

## How it works

**my_context has no model of its own and never calls one.** That is the shape of
the whole feature: `ingest` emits an *extraction request* — the chunk, the rules
and a JSON schema — and **you** (or the agent you are talking to) are the
extractor. The tool validates what comes back.

**Every candidate must carry a verbatim quote** from the chunk, checked by exact
match after whitespace collapsing. A paraphrase is rejected. That is how an
invented item is caught.

**Everything lands as `draft`.** Nothing extracted governs future work until a
person promotes it with `mycontext review promote`.

**Two properties of an ingested item** worth knowing:

- It carries `origin: ingest`, distinct from both `human` and `agent` in the
  audit log.
- It is written with `always: false`. **No ingested item can assert a pin**,
  whatever the document says.

**Refresh is the other half of the same feature**, for a document you keep
tracking rather than mine once. A `reference` item snapshots a file; when the
file moves on, `doctor` reports the drift and `refresh` takes a new snapshot —
replacing the body, whole, and leaving title, observations, relations, scope and
tags untouched.

## From the CLI

```console
$ mycontext ingest docs/ARCHITECTURE.md
my_context EXTRACTION REQUEST — docs/ARCHITECTURE.md § architecture (chunk 1 of 1, 1 pending)

- You are the extractor. my_context has no model of its own and never calls one — it hands you the text and validates what you return.
- Read the chunk below, taken from docs/ARCHITECTURE.md under the anchor "architecture", and extract every piece of NORMATIVE knowledge it establishes: things that must hold, must be built, must not be done, or are deliberately left open.
- Do not extract narrative, status updates, or descriptions of what was done — that is claude-mem's job, not this one.
- Emit a JSON array matching the "schema" field. Return [] when the chunk establishes nothing normative — that is a correct and common answer, and the common case for prose that isn't a spec.
- Every candidate MUST carry a "quote": a span copied VERBATIM from the chunk. It is checked by exact match after whitespace collapsing, and a paraphrase is rejected. This is how an invented item is caught.
```

The request continues with the rules for `title`, `summary`, `body`, `scope`,
`tags`, `severity`, `observations` and `extra`, then the chunk itself and the
JSON schema, and ends by naming the callback:

```
- Then call back with the results. CLI: mycontext ingest-apply ING-docs-architecture-md-ff21b6b9-e308f1fc --anchor architecture --stdin — pipe your JSON array to stdin.
- This is the last pending chunk in this document.
```

So the loop is three commands, and the ids are the tool's, not yours:

```bash
mycontext ingest docs/prd.md                                  # request candidates for the next chunk
mycontext ingest-apply <session-id> --anchor <anchor> --stdin  # hand the answers back
mycontext ingest-status                                        # what is left
```

`/mycontext:ingest` drives all three from inside a session, which is the way to
use it — `ingest-apply` and `ingest-status` are steps within it rather than
commands you would run by hand.

Then the drafts go through the ordinary queue:

```bash
mycontext review
mycontext review promote <id> --scope "src/billing/**" --yes
```

For the tracked-document half:

```bash
mycontext add reference "Architecture overview" --file docs/ARCHITECTURE.md --summary "…" --yes
mycontext doctor                        # reports source_drift when the file moves on
mycontext refresh REF-architecture-overview
```

**The slash commands.** `/mycontext:ingest` and `/mycontext:refresh`.

**From an agent**, `ingest_document` does both legs in one call — it takes the
same arguments the CLI callback names, plus a `candidates` array — and
`refresh_item` re-snapshots a reference.

**What the CLI can do here that the UI cannot.** All of ingest.
`ingest`, `ingest-apply` and `ingest-status` are not in the browser's command
catalogue, and no screen draws an ingest session.

## From the UI

**There is no ingest screen, and that is a real gap rather than a design.**
Ingest is the one large feature in this product with no browser surface at all.

What the browser does reach:

- **`refresh`** is in the **Composer**'s catalogue, above the trust boundary, so
  a reference can be re-snapshotted from the browser behind a full confirm.
- **The drafts an ingest produced** land in the **Review queue** screen like any
  other draft, with the field-level diff and the accept/reject pair.
- **`doctor`** draws the `source_drift` finding that tells you a refresh is due.

**What the UI can do here that the CLI cannot.** Show an ingested draft beside
the text in force, field by field, before you accept it.

**What the UI cannot do here.** Start an ingest, hand candidates back, or report
what is left in one. `mycontext ingest-status` has no browser equivalent.
