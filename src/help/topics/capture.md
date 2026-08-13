# Capture

Capture knowledge **as it is established**, in the same turn it is agreed —
during a brainstorm, while writing a spec, when a review settles an argument.
A constraint recorded three sessions later is usually recorded wrong or not at
all.

## What is worth capturing

Anything that answers *what must hold* rather than *what happened*: a limit
somebody committed to, a decision with a reason, a requirement, a boundary
condition, something explicitly ruled out, a question deliberately left open.

Not worth capturing: what you did this session, a summary of a file, restating
something already in the corpus. Session activity belongs to claude-mem.

## What happens to what you write

Items you create with `origin: agent` — that is, everything created through
these tools — land as **drafts** when their type is normative. Drafts are
indexed and searchable but are never injected into a session. Promotion is a
human action: today that means editing `status:` directly in the item's
Markdown file, since Markdown is the source of truth (`mycontext review` is
not implemented yet). Rationale items (`lesson`, `adr`, `decision`,
`tradeoff`, …) are created active, because nothing in that tier is injected in
the first place.

This is not a reason to capture less. Capture freely; the gate is downstream.

## Calling create_item more than once is free

`create_item` is an upsert keyed on `(source_file, source_anchor)` plus a
content hash. Calling it twice with the same content returns
*"already captured as REQ-…"* and writes nothing. If the wording at a source
anchor has changed, it tells you to call `update_item` with the existing id
rather than creating a near-duplicate. You never need to check first.

## Tools

- `create_item`: Capture a new constraint, requirement, decision, lesson or other typed item. Idempotent — safe to call repeatedly. Not for: notes about this session's work, or restating an item that already exists.
- `update_item`: Revise an existing item's title, body, scope, tags or severity by id. Not for: creating something new, or retiring an item — use supersede_item for that.
- `supersede_item`: Retire a draft, deprecated or already-superseded item, or any rationale item, in favour of a replacement. Not for: retiring a governing (active or validated) normative item — that is a human decision.
- `link_items`: Record a typed relation between two items, such as derived_from or constrains. Not for: relations already present, which are ignored.
- `get_item`: Fetch one item in full by id, as Markdown. Not for: searching — use query_items when you do not know the id.
- `query_items`: Search and filter items by type, status, tag, text or file path. Not for: fetching a known id, which get_item does directly.
- `list_drafts`: List items awaiting human review, newest first. Not for: promoting them — only a human can do that.
- `mycontext_help`: Read guidance on one topic: categories, scope, capture, workflow. Not for: item content, which query_items retrieves.
- `mycontext_examples`: Show a complete, correct example item of a given type to copy. Not for: real project content.
- `ingest_document`: Reserved. Batch extraction from a document is not implemented yet. Not for: capturing anything now — use create_item for each item individually.
