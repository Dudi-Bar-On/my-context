# Pack templates

**This file is the whole of discovery.** There is no registry, no re-fetch, no update
channel and no version check over the network — this product makes no network request at
all, on any code path. A pack reaches you the way any other file does: somebody sends you a
directory or a ZIP, or you clone a repository that contains one. The list below is curated
by hand, in this repository, and it is the only index that exists.

## The list

It is empty.

That is not an oversight and it is not a placeholder. No packs have been published yet, so
a list seeded with plausible-looking examples would be a document that lies on the day it
ships — and the first reader to follow one of those links would learn that the entries are
decoration rather than a directory. It stays empty until there is something true to put in
it.

When there is, each entry carries a **link** and an **author**, because those are the two
things a person needs in order to decide whether to run `mycontext pack import` on it. The
link is where the artefact actually lives; the author is who is accountable for its
contents. Neither is verified by anything in this repository — see
[What the manifest does, and what it does not](#what-the-manifest-does-and-what-it-does-not)
below.

## Getting one in

An artefact is a directory or a ZIP file that already exists on your disk. Two commands
read one:

- `mycontext pack import <path>` — into a workspace you already have;
- `mycontext init --pack <path>` — to found a workspace from one.

Both are described in full under
[Bringing one in](../README.md#bringing-one-in--mycontext-pack-import). The short version is
the part that matters here: **everything a pack brings in lands `draft`, and governs nothing
until a person promotes it.**

## Updating a pack means importing it again

There is no update command, because there is no channel an update could arrive on. You
fetch the newer artefact however you got the first one, and you import it again over the
top. That path is safe by construction rather than by convention:

- the **collision report prints first, on every path**, sorting the arriving items into
  three buckets — `new` (no item here holds that id), `changed` (same id, different content)
  and `identical` (same id, same content) — and printing all three whether or not they are
  empty;
- every item in the `changed` bucket is **named**, with the content hash you hold and the
  content hash arriving, and the fields they differ in;
- **new items land as drafts**, exactly as they did the first time;
- and an item **you have edited is replaced only if you say so at a second prompt**.
  `--yes` answers the first question — "import this" — and deliberately does not answer the
  second. Non-interactively that second approval is spelled `--overwrite-changed`.

Declining the second question is not an error: the new items still land, and every changed
item that was left alone is named in the outcome rather than silently skipped. Nothing
applies unconfirmed, and nothing is replaced unnamed.

## What the manifest does, and what it does not

Every artefact carries a `manifest.json` listing each file with its size and its full
SHA-256 digest, and the import verifies all of them before it parses anything.

**That proves the bytes arrived intact and says nothing whatever about who wrote them** —
the manifest is written by the same person who wrote the pack, so it catches a truncated
download and a corrupted copy and nothing else. There is no signature and nothing to check
one against. The product states this itself, in the report it prints before it asks you
anything, rather than leaving a green "verified" line to be misread:

```text
manifest: every file verified — 4 of 4 digests match.
          This proves the bytes arrived intact. It says nothing about who wrote them.
```

A verified manifest is not a vetted author. The check that matters is a person reading the
items, which is why every one of them lands `draft`.

## Why there is no registry

Recorded once, here, so that "add a registry" is understood as a decision that was taken
rather than a feature nobody got to.

Centralisation was rejected on the evidence that it does not prevent the thing a registry is
supposed to prevent. The reasoning is set down in
`docs/superpowers/specs/2026-08-19-v2-scope-decisions.md` · `639 malicious versions that passed npm provenance verification with` · ~432:
the May 2026 compromise shipped hundreds of malicious package versions that **passed**
provenance verification with forged attestations. A registry would have added an index, a
re-fetch path and a network dependency to this product, and bought none of the assurance
those costs are usually paid for.

What is offered instead is the part that actually carries weight: the artefact is inert
until a human reads it, the collision report says exactly what would change before anything
changes, and nothing a pack brings in governs until somebody promotes it.

## Adding an entry

Send a pull request against this file. An entry needs a link and an author, and it needs to
point at an artefact that exists. There is no automation behind this list and there is not
meant to be — a curated document that somebody has to edit on purpose is the whole
mechanism.
