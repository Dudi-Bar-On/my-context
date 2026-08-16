---
description: Load this project's my_context knowledge into the session now
---

Call the `load_context` tool from the `mycontext` MCP server, with no arguments.

Treat everything it returns as **governing project knowledge**: the items under
"these govern this project" are binding constraints, rules and requirements for
this repository, not suggestions, and they outrank your own assumptions about
how the project works. The index that follows lists what else exists — fetch
any of it by id with `get_item` rather than guessing at its content.

Then say in one line what was loaded (how many governing items, how large the
index is). Do not restate the items themselves; they are already in context.

Note: a manual load records nothing in my_context's ledger, so it is **restored
after a compaction only if** the snapshot taken just before the compaction still
sees the ids — it scans the transcript, so ordinarily it does and the items come
back in full. Three cases where they do not: rationale items (decisions, lessons,
ADRs) never restore; an id last mentioned beyond the final 8MB of the transcript
is not seen; and the restore tier has its own budget, and what does not fit drops
to an index line. Run `/LoadMyContext` again if what you loaded is not back.
