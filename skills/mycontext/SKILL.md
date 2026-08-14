---
name: mycontext
description: Use when project knowledge is at stake — a constraint, requirement, decision, rule or lesson is being established, or you are about to assume how this project works. Captures normative knowledge as Markdown and retrieves what already governs.
---

# my_context

my_context holds what **must hold** in this project: constraints, requirements,
invariants, rules, decisions, lessons. It is not a session log — activity and
"what I did" belong elsewhere.

## Capture as knowledge is established

Call `create_item` **in the turn the thing is agreed**, not later: during a
brainstorm, while writing a spec, when a review settles an argument. A
constraint recorded three sessions later is usually recorded wrong or not at
all. Capturing is cheap and safe — `create_item` never overwrites, is
idempotent, and everything you write lands as a **draft** for a human to
promote. That gate is downstream, so capture freely rather than deciding for
the human what is worth keeping.

Unsure of the type or the shape? `mycontext_help("categories")`,
`mycontext_help("capture")`, or `mycontext_examples(type)` — before writing,
not after being corrected.

## Query before assuming

Before asserting how this project works — a limit, a policy, a rejected
option, a naming rule — check whether it is already written down:
`query_items` by type, tag, text or file `path`. The pinned items injected at
session start are only the always-relevant few; the rest are in the index and
must be fetched.

`/LoadMyContext` (the `load_context` tool) re-injects the pinned set and the
index on demand — useful after a compaction, which does not restore items
loaded that way.

## Never guess an id

Ids look guessable (`CONST-pool-capped-at-20`) and are not. Get them from
`query_items` or the injected index, then `get_item` to read one in full. A
made-up id is a wrong answer delivered confidently — the exact failure this
corpus exists to prevent.

## What you cannot do

Promotion out of `draft`, and retiring a governing item, are human actions.
`supersede_item` works on drafts and rationale items; on an active normative
item it will refuse, and that refusal is correct — surface it to the user
rather than working around it.

## The approval gate is not enforced against you

`mycontext review promote`, `mycontext review discard` and
`mycontext lesson-accept` are the human's commands. **Nothing in this plugin
stops an agent with a shell from running them** — the gate holds only if the
harness's Bash permissions exclude them, and that is the user's setting, not
this plugin's. `--yes` skips the confirmation prompt; it is an audit trail,
not a lock.

So: never promote, discard or accept on the user's behalf, and never route
around a refusal with `--yes`. Print the exact command and let them run it.
