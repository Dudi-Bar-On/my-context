# Workflow

## Lifecycle

`draft` → reviewed by a human → `active` → later `superseded` or `deprecated`.

Only `active` items are injected. `draft`, `superseded`, `deprecated` and
`validated` remain indexed and searchable forever — supersession is how the
corpus stays small without losing history.

Nothing is ever deleted through these tools. There is no delete. An item that is
wrong is superseded or deprecated, both of which are reversible and both of
which leave a trail.

## Relations

Relations live in the Markdown file, so they survive a rebuild and merge like
text. The vocabulary is closed:

| Relation | Meaning |
|---|---|
| `derived_from` | This item came out of that one — a rule from a lesson, a constraint from an ADR |
| `constrains` | This item limits what that one may do |
| `supersedes` | This item replaces that one; written automatically by supersede_item |
| `blocks` | That item cannot be settled until this one is — mainly for open_question |
| `mitigates` | This item reduces that risk |
| `refines` | This item makes that one more specific |
| `relates_to` | Weak association, when nothing more precise fits |
| `links_to` | A bare mention |

A relation may point at an item that does not exist yet. It resolves when that
item is created.

## A typical sequence

1. Something is established in conversation or in a document.
2. `create_item` with a type, a title, a body giving the reason, and a `scope`
   if it should activate on particular files.
3. If it came from a document, pass `source_file` and `source_anchor` so the
   capture is idempotent and traceable.
4. `link_items` to whatever it derives from or constrains.
5. Later, when it changes: `create_item` for the new version, then
   `supersede_item` pointing the old one at the new one. As an agent, this
   only succeeds when the old version is a draft, deprecated, already
   superseded, or rationale-tier — superseding an `active` or `validated`
   normative item is refused; a human retires it instead.

## Reviewing

`list_drafts` shows what is waiting. Promotion is a human action: a human
runs `mycontext review promote <id>` (or `mycontext review discard <id>` to
reject it) — `mycontext review` also has `list`/`show` subcommands to walk
the queue. An agent cannot promote its own draft or change a normative item's
status through `update_item`. `supersede_item` is narrower still: an agent may
supersede its own normative draft (that sets its status to `superseded`), but
not a normative item that is currently `active` or `validated` — retiring
something that is still governing is a human decision.
