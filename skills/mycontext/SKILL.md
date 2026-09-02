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
all. Capturing is cheap — `create_item` never overwrites and is idempotent.

Where it lands depends on the category's **tier**, not on you:

- **Normative** (`constraint`, `invariant`, `rule`, `requirement`, `standard`,
  `pattern`, `glossary`, `instruction`, `non_goal`, `open_question`, `runbook`,
  `procedure`, `environment`, `known_issue`) — lands as a **draft**, governing
  nothing until a human promotes it.
- **Rationale** (`adr`, `decision`, `lesson`, `tradeoff`, `assumption`,
  `edge_case`, `risk`, `reference`, `task`, `todo`, `note`) — lands **active**. There is
  no promotion step, because nothing in that tier is ever auto-injected; it is
  there to be found later.

So a `decision` you record is live immediately — not a licence to write one
loosely, since a future session reads it back as settled. Capture freely either
way; for the normative tier the gate is downstream.

Unsure of the type or the shape? `mycontext_help("categories")`,
`mycontext_help("capture")`, or `mycontext_examples(type)` — before writing,
not after being corrected.

## Query before assuming

Before asserting how this project works — a limit, a policy, a rejected
option, a naming rule — check whether it is already written down:
`query_items` by type, tag, text or file `path`. The pinned items injected at
session start are only the always-relevant few; the rest are in the index and
must be fetched.

`/LoadMyContext` (the `load_context` tool) re-injects the pinned set and index
on demand. A compaction usually restores them by itself — the snapshot scans
the transcript for ids — but never rationale items, which a re-load misses too — use `get_item`.

## Never guess an id

Ids look guessable (`CONST-pool-capped-at-20`) and are not. Get them from
`query_items` or the injected index, then `get_item` to read one in full. A
made-up id is a wrong answer delivered confidently — the exact failure this
corpus exists to prevent.

## What you cannot do

Promotion out of `draft`, and retiring a governing item, are human actions.
`supersede_item` works on drafts and rationale items; on an active normative
item it refuses, and that refusal is correct. Print the human's route —
`mycontext supersede <old id> --by <new id>` — rather than working around it.

**Your edit to an item's text may not apply.** Under the category's
`agentEdits` setting — `review` by default for every normative category —
`update_item` **stages** a change to title, body, summary, tags or extra as a pending revision
instead of applying it: the item keeps governing its old text until a human
promotes the change. The response says so in its first words. Read it, tell the
user you staged something, and do not reason as if the new text is in force.
Scope, `always`, `continuity`, severity and status stay refused either way; the refusal names
`mycontext edit` (and `pin`/`harden`) as the human's route.

## The approval gate is not enforced against you

`mycontext review promote`, `mycontext review discard`, `mycontext lesson-accept`,
`mycontext add <normative category> --yes`, `mycontext inbox-promote --yes`,
`mycontext supersede --yes`, `mycontext edit --yes`, `mycontext refresh --yes`,
`mycontext review promote-revision --yes`, `mycontext procedure activate --yes`,
`mycontext procedure done --yes`, `mycontext repair --yes` and
`mycontext pack import --yes --overwrite-changed` all change
what governs here — `supersede` retires an active governing item; `edit` changes
any field of one, including the scope, `always` and severity `update_item`
refuses; `refresh` replaces a governing body with whatever the file it snapshots
says now; `promote-revision` applies a rewrite **you** proposed, which is the one
on this list you have a stake in; `procedure activate` both makes a procedure
govern and pins it in full, in one act, and `procedure done` retires it; `repair`
re-stamps a checksum, turning a hand edit of those same fields into a clean
change with no evidence left; `pack import --overwrite-changed` replaces an
item the user wrote with a stranger's and drops it to `draft`, and `--yes`
alone does not reach that second gate. **Nothing in this plugin
stops an agent with a shell from running them** — nor from writing into
`.my_context/` by shell redirect and running `mycontext rebuild`, which the
`PreToolUse` write-deny does not see: its matcher covers the file tools, not
`Bash`. That deny canonicalizes the path, so alternate spellings of the
directory — a Windows 8.3 short name, a symlink or junction into it — are
denied; a hard link to an item file is not, but making one needs a shell too.
The gate holds if and only if the harness's Bash permissions exclude
the `mycontext` binary entirely, in every spelling, **and** direct writes into
`.my_context/`. That is the user's setting, not this plugin's. `--yes` skips the
confirmation prompt; it is an audit trail, not a lock.

So: never run `add` on a normative category, `inbox-promote`, `supersede`,
`edit` (`pin`/`unpin`/`harden`/`soften`), `refresh`, `repair`, `lesson-accept`,
`procedure activate`, `procedure done`, `pack import`, `review promote`,
`review discard`, `review promote-revision` or
`review discard-revision` — which governs nothing, but ends a proposal for
good — on the user's behalf, and never route around a refusal with `--yes`.
Print the exact command and let them run it.
