---
description: Capture a reference in this project's knowledge base
argument-hint: "[which file, and why it matters — A snapshot of a file, with its origin recorded so doctor reports drift]"
disable-model-invocation: true
---

Capture a **reference** — A snapshot of a file, with its origin recorded so doctor reports drift — in this project's my_context
knowledge base.

What the user typed: $ARGUMENTS

A reference's body is a **snapshot** of a file, so capturing one means reading that file —
which no MCP tool does, and which is deliberate: a body you compose is not a copy of a
file, and the whole value of this category is that it is one.

1. If no file was named, ask which file, and stop. Do not guess, and do not paste a file's
   contents into a `create_item` call — that is the stale-copy problem this category exists
   to replace.
2. Work out the repository-relative path, and a one-sentence `title` saying what the file
   IS to this project ("Billing roadmap", not "roadmap.md").
3. Draft the *why*, as one `--note` per point: what this file is for, and what would make
   the snapshot misleading. The snapshot says what the file says; only you and the user can
   say why it is in the corpus, and the item's own text is the only place that goes.
4. Draft the `--summary`: one plain sentence for a reader who does not know this codebase,
   saying what this file IS to the project and why it matters. It is required — a capture
   without one is refused, because an item created with no summary can never afterwards be
   asked for one. Here it is the sentence about the FILE, not about the snapshot.
5. Print this command for the user to run, filled in, and stop:

   `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" add reference "<title>" --file <path> --summary "<one plain sentence>" --note "<why>"`

   Do not run it yourself. `mycontext add` claims `origin: "human"`, which is the one
   claim you cannot make, and it is on the deny list this plugin's README recommends.

Afterwards: `mycontext doctor` reports `source_drift` when the file has moved on, and
`refresh_item` takes a fresh snapshot. Neither happens on its own.
