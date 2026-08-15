# mycontext user surface — design

**Date:** 2026-08-15
**Status:** decisions taken in brainstorming; pending user review of this document
**Scope:** a complete editing surface with tier-scaled gating, staged revisions for agent edits to
governing items, the full slash-command surface, ergonomic option selection, and SQL help for `query`.

---

## 1. Why

Three gaps, all raised by the user, all instances of one thing: **the plugin serves the model better
than it serves the person who owns the knowledge.**

- **There is no way to edit an item.** Not as a slash command, not as a CLI command. `update_item`
  (MCP) exists for the model and refuses on a governing item. A human who wants to narrow a scope or
  harden a severity must hand-edit the Markdown and run `mycontext repair` — a route the plugin's own
  `PreToolUse` hook blocks the model from taking, and which a recorded requirement says documentation
  must never instruct.
- **The two surfaces are not parallel.** Eleven MCP tools; slash commands cover four. `show`,
  `update`, `supersede`, `link`, `query`, `doctor`, `decay`, `repair` and the whole `lesson` flow have
  no slash command. `/mycontext:search` calls an MCP tool with no CLI counterpart at all.
- **The commands are not pleasant enough to reach for.** Every value is typed freehand. Nothing offers
  the valid options for a field whose values are a fixed set.

## 2. What "editing" means — the decomposition

The user's insight, and the thing that shapes this design: **edit is not one operation.** Three classes
of field, two tiers, and they do not interact the way a single gate assumes.

| field class | on a normative item (`rule`, `constraint`, …) | on a rationale item (`decision`, `risk`, …) |
|---|---|---|
| **Content** — title, body, observations, tags | changes what the agent is *told to do* | changes what the agent *knows* |
| **Reach** — `scope`, `always` | changes which files activate it | **inert — the field does nothing** |
| **Force** — `severity`, `status` | decides whether CI fails | **inert — never gates anything** |

The right-hand column is verified, not assumed: `select` filters `isNormative` **before** it filters
`always`, so `always: true` on a rationale item is never injected. A `risk` with `severity: hard` binds
nothing.

**Therefore the gate scales with what the edit can actually do:**

| case | gate |
|---|---|
| Rationale item, content | none |
| Rationale item, reach or force | **refused**, with an explanation — see §3 |
| Normative draft, anything | none — nothing governs yet; that is what `review` is for |
| Normative active/validated, content, by a human | preview, then confirm |
| Any item, content, by an agent | per the category's `agentEdits` setting — see §4 |
| Normative active/validated, reach or force | preview showing what governs before and after, then confirm; human only |

A single `edit` command with a single confirmation would be wrong twice: it would ceremoniously gate
changes that cannot matter, and accept fields that silently do nothing.

## 3. Inert fields are refused, not accepted

Setting `--always`, `--severity` or `--scope` on a rationale item is accepted today and does nothing.
That is a silent drop, and `INV-nothing-is-dropped-silently` is the one failure this codebase treats as
unacceptable.

The refusal must say *why* — that the field exists on every item but only governs on the normative
tier — and name the alternative if there is one (retier the category in config; or capture the fact as
a normative item instead).

**Open sub-question for implementation:** `scope` on a rationale item is inert *for injection*, but it
is not meaningless as metadata — it records which part of the codebase a decision was about, and
`query_items({path})` uses it. Decide whether `scope` is refused like the other two or accepted with
its limits stated, and justify it. Do not assume the three behave alike merely because they are listed
together here.

## 4. Agent edits to content are governed by a per-category config setting

Today an agent cannot change a governing item's `scope`, `severity`, `always` or `status` — that hole
was closed in Plan 3. It **can** rewrite the `body`. The body is the instruction: an agent can turn
"never log customer email" into something weaker, and the item stays `active`, `hard`, unchanged in
every report, with no review triggered.

The user's decision: **make this a policy the user sets per category**, rather than one rule for the
whole corpus. Some categories are worth guarding closely; others benefit from an agent keeping them
current.

### The setting

A third key alongside the two that already exist on a category:

```json
{
  "categories": {
    "rule":     { "enabled": true, "tier": "normative", "agentEdits": "review" },
    "lesson":   { "enabled": true, "tier": "rationale", "agentEdits": "allow" }
  }
}
```

Two values, per the user:

- **`allow`** — an agent's content edit applies immediately, as today.
- **`review`** — an agent's content edit creates a pending revision. The item keeps governing its
  current text until a human promotes the change.

**Defaults must be decided and justified, not inherited by accident.** The tier split is the obvious
starting point — normative defaults to `review`, rationale to `allow` — because that matches what §2
establishes about what an edit can do. Whatever is chosen, a user who has never heard of this setting
must get sensible behaviour, and the default must be visible in `mycontext help` and both READMEs
rather than discoverable only by reading `categories.ts`.

`categories` **merges** per key (verified: `budgets` and `categories` merge; `watchedDocs` replaces), so
a user setting `agentEdits` on one category does not silently reset the others. Confirm this still holds
once the key exists, and test it — the merge behaviour is not obvious and the README documents it
precisely because it surprises people.

### What "content" covers

The setting governs **title, body, observations and tags** — not `body` alone. Splitting them would let
an agent rewrite the instruction through the title while the body stayed guarded, which is the same
hole in a different field. Say so in the documentation; a user who reads "bodies" and gets title too
should find that written down rather than inferred.

`scope`, `always`, `severity` and `status` on a governing normative item remain human-only regardless of
this setting. `agentEdits` widens what an agent may do to content; it does not open the reach-and-force
gate. A config value of `allow` must not be readable as "agents may do anything to this category".

### Staged revisions

- The current text keeps governing and keeps being injected until promotion. A staged revision must
  never be injected.
- `review` shows the pending revision as a diff against the current text, and `status` counts them.
- Promotion and rejection reuse the existing gate; rejection must not lose the agent's proposal
  silently.
- A revision is not a new item — it must not appear in `list`, be selectable, or affect any count of
  what governs.
- An item may accumulate more than one pending revision, or a revision may go stale because a human
  edited the item underneath it. Decide what happens in both cases and make the answer visible; the
  wrong outcome is a promotion that silently discards an intervening change.

**This is the largest single piece of new state in the plan.** It resembles the existing lesson-staging
mechanism (`.staging/`, `hasApplied`/`setApplied` accessors, an approval gate) and the ingest session
mechanism; reuse rather than invent, and say what you reused.

**Open question for implementation:** whether a third value — `deny`, refusing an agent's content edit
outright rather than staging it — is worth having. The user named two. A `deny` is not the same as
`review`: it tells the agent immediately rather than accumulating proposals nobody reads. Do not add it
speculatively; raise it if the implementation makes the case obvious.

## 5. The slash-command surface

All four groups the user selected, generated from the same registry that produces the existing 38 so
the two surfaces cannot drift:

- **Read** — `show`, `search`, `status`, `doctor`, `decay`. No gate; they change nothing.
- **Write** — `edit`, `supersede`, `promote`, `discard`. Each previews and confirms, exactly as the CLI
  does. Each is a place the user can act deliberately rather than asking the model to.
- **Ingest and lessons** — `ingest`, `lesson`, `lesson-stage`. Multi-step and stateful; these are the
  hardest to express as one invocation and the most likely to need follow-up prompts. Design them to
  hand back control rather than guessing.
- **Query** — a raw SQL passthrough over the read-only index.

**Parity is the requirement, and it must be enforced rather than asserted.** The existing inventory
test checks that every command and tool is *documented*. Add the check the user actually asked for:
anything the model can do through a tool has a command, and the asymmetries that remain are listed
deliberately rather than discovered.

Note `/mycontext:search` currently calls `query_items` with no CLI counterpart. Either give it one or
record it as a deliberate exception; do not leave it as an accident.

## 6. Selection and ergonomics

The user chose **both** mechanisms:

- **Named commands for the common cases** — `pin`/`unpin`, `harden`/`soften`. The command list is the
  picker: autocomplete filters as you type, which is already why there are 17 `add-<type>` commands
  rather than one taking a category argument.
- **An asking flow for everything else** — `/mycontext:edit <id>` presents the fields with what each
  one means and waits. Claude Code has no native picker for argument values (`argument-hint` is
  placeholder text only), but a command runs through Claude, so presenting options and waiting is
  available today.

**The two mechanisms must stay consistent or they drift.** `pin` and `edit --always` must produce the
same result, the same preview, and the same gate. One implementation, two entry points — and a test
that fails if they diverge, in the shape that finally retired the F2 exit-code defect: enumerate the
entry points in one assertion rather than testing each separately. A surface checked separately is a
surface excluded from the agreement.

## 7. SQL help for `query`

The user's words: *"SQL is great for pro developers but you should allow SQL help (only read
activities) especially the sqlite syntax."*

`query` exposes a read-only SQL passthrough over the index, and a user who does not know the schema
cannot use it. Provide help covering the schema (tables, columns, what each holds), SQLite-specific
syntax worth knowing, and worked queries answering real questions.

**Read activities only.** The help must not teach or demonstrate a write, and must state plainly what
the boundary is. The existing comment in `query.ts` is the model for honesty here: the boundary is a
statement denylist plus a read-only connection, and `VACUUM INTO` is the one filesystem write neither
prevents. Do not let a help topic imply a stronger guarantee than the code provides.

Fit this into the existing four-channel help design (`mycontext help <topic>`, the `mycontext_help` MCP
tool, `src/help/topics/`, and spec §9's channel table) rather than inventing a fifth channel.

## 8. Sequencing

Two phases, because the second depends on the first and each is independently reviewable.

**Phase 1 — the editing semantics.** §2's gating, §3's inert-field refusal, §4's staged revisions, the
`edit` command, and the `pin`/`harden` family. This is where the risk is: new state, a trust-boundary
change, and the mechanism every later surface calls.

**Phase 2 — the surface.** §5's slash commands, §6's asking flow, §7's SQL help, and the parity
enforcement. Mostly generation and prose once Phase 1 exists.

## 9. What this does not change

- Item ids and the file format. No migration.
- The four injection tiers, and `always: true`'s meaning.
- `NOGOAL-no-agent-hard-delete` — no delete command, at any surface. Retirement is `supersede`.
- The existing approval gates on `review promote`, `review discard`, `lesson-accept`, `add --yes` and
  `supersede`. `edit` joins them; it does not replace them.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Staged revisions are new state that can be lost, orphaned or double-applied | Reuse the lesson-staging and ingest-session mechanisms rather than inventing; test interrupt and concurrent paths as those were tested |
| A staged revision leaks into injection | A test that asserts a revision is never selected, mutation-verified |
| `pin` and `edit --always` drift | One implementation, two entry points, one enumerating test |
| The gate list grows to six commands and the docs fall behind | Both READMEs, `SKILL.md` and `workflow.md` are pinned by `plugin-assets.test.ts`; extend it rather than adding a sixth place to remember |
| SQL help implies a stronger read-only guarantee than exists | Carry `query.ts`'s existing wording, which survived audit; state the `VACUUM INTO` exception |
| Phase 2 generates commands faster than they can be reviewed | Parity is enforced by test, not by inspection |
