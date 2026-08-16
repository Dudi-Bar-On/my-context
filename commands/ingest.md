---
description: Extract candidate items from a document, one chunk at a time
argument-hint: "[the path to a document]"
disable-model-invocation: true
---

Extract candidate items from a document into this project's my_context knowledge base.
**You are the extractor** — there is no model inside this tool.

What the user typed: $ARGUMENTS

1. If no path was given, ask which document and stop.
2. Run: `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" ingest <path>`
   It splits the document into chunks and prints an extraction request for the FIRST one:
   the session id, the anchor, the chunk's text, and the fields a candidate needs.
3. Read that chunk and write the candidates it actually supports as a JSON array to a
   temporary file. Every candidate needs a `quote` that appears in the chunk verbatim —
   that is what makes this an extraction rather than a composition, and a candidate whose
   quote is not in the chunk is refused.
4. Run: `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" ingest-apply <session id> --anchor <anchor> --file <your json>`
   You may run this one: it writes `origin: "ingest"` and everything it creates lands as
   a **draft** that governs nothing until a human promotes it.
5. Report what it says — created, deduped, superseded — and **stop there.**

   - If it rejected any candidate, fix ONLY those and resubmit against the SAME session
     and anchor before doing anything else.
   - If it printed the next chunk's request, say how many chunks are left and let the user
     decide whether to continue. Do not walk the whole document unasked: each chunk is a
     batch of drafts someone has to review, and forty of them arriving at once is how a
     review queue stops being read.

`node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" ingest-status` shows every session and which chunks are still pending, so an
interrupted ingest is resumed rather than restarted. `/mycontext:review` is where the
drafts go next.
