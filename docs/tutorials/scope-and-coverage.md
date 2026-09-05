# See which files and areas your corpus actually covers

Every command and every block of output on this page was run against a fresh
workspace while writing it. Nothing here is illustrative.

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

Scope is the main cost control in this product, and the one habit that decides
whether it works at all. An item with `scope: ["src/billing/**"]` is weighed only
on files under `src/billing/`. An item with **no** scope is weighed on *every*
file operation, forever.

Coverage is the other half of the same question: given the scopes you have
written, which parts of the repository are actually governed, and which are a
gap nobody has looked at?

## How it works

**Scope is a list of POSIX globs on the item.** Matching normalises both sides,
so a Windows path and a POSIX glob agree. Empty scope means unrestricted.

**`scopePolicy` decides what "no scope" means, per category.** It has three
values: `global` (the default — unrestricted, matching every path), `required`
(a capture without a scope is refused), and `inert` (an unscoped item matches
**no** file rather than all of them). Set the last one and an unscoped item in
that category stops governing anything:

```json
{
  "profile": "standard",
  "categories": {
    "requirement": { "scopePolicy": "inert" }
  }
}
```

Same corpus, same query, before and after. Before:

```console
$ mycontext search --path src/api/handler.ts
┌───────────────────────────────────────────────────────┬─────────────┬────────┐
│ id                                                    │ type        │ status │
├───────────────────────────────────────────────────────┼─────────────┼────────┤
│ LESSON-the-3ds-sandbox-declines-valid-cards-at-random │ lesson      │ active │
│ LESSON-the-sandbox-declines-3ds-cards-at-random       │ lesson      │ active │
│ REF-architecture-overview                             │ reference   │ active │
│ REQ-checkout-completes-in-two-steps                   │ requirement │ active │
│ RULE-every-price-is-an-integer-of-minor-units         │ rule        │ active │
│ TODO-check-whether-the-3ds-retry-path-double-charges  │ todo        │ active │
└───────────────────────────────────────────────────────┴─────────────┴────────┘
```

After:

```console
$ mycontext search --path src/api/handler.ts
┌───────────────────────────────────────────────────────┬───────────┬────────┐
│ id                                                    │ type      │ status │
├───────────────────────────────────────────────────────┼───────────┼────────┤
│ LESSON-the-3ds-sandbox-declines-valid-cards-at-random │ lesson    │ active │
│ LESSON-the-sandbox-declines-3ds-cards-at-random       │ lesson    │ active │
│ REF-architecture-overview                             │ reference │ active │
│ RULE-every-price-is-an-integer-of-minor-units         │ rule      │ active │
│ TODO-check-whether-the-3ds-retry-path-double-charges  │ todo      │ active │
└───────────────────────────────────────────────────────┴───────────┴────────┘
```

The unscoped `REQ-checkout-completes-in-two-steps` is gone — not deleted, just
inert. It survives as an index line and nothing more.

**Use this when a category is mostly aspirational** — requirements and open
questions often are — and you want its members to govern only where they were
explicitly pointed. It is a sharp tool: an item you *forgot* to scope silently
stops governing.

**A pinned item is exempt from the question.** An `always: true` item governs
every path by definition, so colouring it per directory would make a governed
directory look like a gap. Coverage hoists pinned items out and states them
once, which is what makes the word "gap" mean something.

## From the CLI

The path search is the terminal's coverage answer, one path at a time:

```console
$ mycontext search --path src/billing/charge.ts
┌─────────────────────────────────────────────────┬────────────┬────────┐
│ id                                              │ type       │ status │
├─────────────────────────────────────────────────┼────────────┼────────┤
│ CONST-card-numbers-never-reach-the-logs         │ constraint │ active │
│ LESSON-the-sandbox-declines-3ds-cards-at-random │ lesson     │ active │
│ RULE-every-price-is-an-integer-of-minor-units   │ rule       │ active │
└─────────────────────────────────────────────────┴────────────┴────────┘
```

`status` nags about the aggregate, every time you run it:

```
usage: no sessions recorded yet — decay reporting starts once items begin to be injected.
  1 active normative item(s) carry no scope, so they apply to every file and compete for the jit
  budget on every file operation.
```

`doctor` finds the other failure — a scope glob that matches nothing, because
the directory it named was renamed or removed — and reports it as a finding
rather than fixing it.

To set or change a scope:

```bash
mycontext add rule "..." --scope "src/billing/**" --summary "..." --yes
mycontext edit <id> --scope "src/billing/**,src/payments/**"
```

**What the CLI can do here that the UI cannot.** Answer "what governs this exact
path" as a list you can pipe, with `--json`. And write `scopePolicy` into
`config.json` by hand — the browser's Configure screen has a scope-policy strip,
but the file is yours.

## From the UI

The **Scope coverage** screen (`nav.inj`) is this feature's screen, and its
verdict is *what covers each folder, and what does not*.

It is a tree of every walked path, coloured by what governs it, with a detail
pane beside it. Its status line is the whole picture in one sentence:
`{covered} / {total} files covered · {gaps} gaps · {catEmpty} / {catTotal}
categories empty`.

Four things it does that a list cannot:

- **Colour is magnitude, not just a state.** Each row's bar shows governed,
  ungoverned and not-examined as proportions, with the count beside it — dots
  alone could not say *how* dark a row was.
- **Pinned items are hoisted** into their own band at the top, stated once.
- **"Not examined" is a fourth colour**, distinct from "gap". A directory nobody
  walked is not a directory nobody governs.
- **Categories with nothing in them** are listed, and when there are none it
  says so as a measurement: *"none — measured, every category holds at least one
  item"*, never as blank space.

On a corpus that governs nothing yet, it says so once — *"Nothing governs this
project yet"*, with the note that this is the normal state for a new workspace —
rather than drawing a wall of warnings, one per row.

**What the UI can do here that the CLI cannot.** Show coverage as a map. There
is no terminal command that walks the tree and colours it; `search --path`
answers one path, and this answers all of them at once.

**What the UI cannot do here.** Change a scope. The tree is a read; editing an
item's scope is composed on the Composer or Capture screens and confirmed before
it runs, and `scopePolicy` lives in `config.json`.
