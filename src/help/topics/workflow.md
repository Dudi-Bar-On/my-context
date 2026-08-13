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
   `supersede_item` pointing the old one at the new one.

## Reviewing

`list_drafts` shows what is waiting. Promotion is a human action — today that
means editing `status:` directly in the item's Markdown file, since Markdown
is the source of truth (`mycontext review` is not implemented yet). An agent
cannot promote its own draft, and cannot change the status of a normative item
at all.
