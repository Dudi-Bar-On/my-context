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
human action: a human runs `mycontext review promote <id>`, or
`mycontext review discard <id>` to reject it. Rationale items (`lesson`, `adr`,
`decision`, `tradeoff`, …) are created active, because nothing in that tier is
injected in the first place.

**Do not tell the user to hand-edit `status:` in the Markdown file, and do not
edit it yourself.** Markdown is the source of truth for an item's *content*,
but every write path also recomputes the item's `checksum`; a hand edit does
not, so the recorded checksum stops matching and `mycontext doctor` reports a
mismatch that `mycontext rebuild` does not clear. That finding is also the only
signal for a genuinely lost-at-write-time item, so a hand edit does not just
leave a warning — it makes a real corruption indistinguishable from your edit.
The plugin's own `PreToolUse` hook denies you writes under `.my_context/` for
this reason. The supported
routes are `mycontext review promote`/`discard` for a draft's status, and
`update_item` for an item's title, body, summary, tags and extra fields.

## The human's CLI, and why it is not your route

`mycontext add <category> "<title>" [--body "<why>"|--file <path>]
[--note "<text>"] [--step "<text>"] [--summary "<text>"|--summary-omitted]
[--scope "a/**,b/**"] [--tags "a,b"] [--severity hard|soft]
[--extra key=value] [--yes]` is the user's capture command. `--scope` and
`--tags` are comma-separated; `--body` goes through the same round-trip guards
described above, so a body containing a `#` heading is refused there exactly as
it is here. `--file` snapshots a file instead of taking text somebody typed,
and `--extra key=value` names one category-specific field at a time and may be
repeated — on `mycontext edit` as well.

`--summary "<text>"` is one plain sentence saying what the item IS and why it
matters, written for somebody who does NOT know this codebase: plain words
rather than project vocabulary, no ids, no file paths, no measurements, and
never how it was found. It is capped at 160 characters and the body keeps all
the precision. It is also recorded WITH the content it was written against, so
a later edit to the body makes it measurably stale (`mycontext doctor` reports
it, and `get_item` labels it) rather than quietly wrong. `mycontext edit <id>
--summary=` removes one.

**Every capture must carry one**, here and on `create_item` alike. Leaving it
out is not a small omission: an item created with no summary can never
afterwards be REQUIRED to have one, because every check that would ask compares
a summary against the content it was written against and an absent one has
neither — so `mycontext doctor` names it as `summary_absent` and nothing else
ever will. Nothing in this product can write the sentence for you; a capture
with no `--summary` is refused, and the refusal says all of this. If an item
genuinely should carry none, say so in words with `--summary-omitted`
(`summary_omitted: true` on `create_item`), which is never a default, is refused
beside `--summary`, and records `summary-omitted` in the audit log so that
nobody wrote one is visible rather than assumed. Reach for it when the item has
nothing to say in one sentence that its title does not already say — never to
get past the refusal.

`--note "<text>"` records a `[note]` observation and may be repeated, and that
is the whole of what this CLI can say about observations. An observation under
any OTHER category, an observation's tags or context, and the CREATION of a
relation have no flag spelling: `create_item` is the route for the first two
and `link_items` for the third — `create_item` refuses a `relations` argument
by name and says so. An unrecognised option is refused rather than folded into
the title. `mycontext help cli` is the command surface as a whole.

`--yes` is required when the category is **normative**, because `add` passes
`origin: 'human'` and the item therefore lands `active` and governs the project
at once — no draft, no review. This is **not** a boundary that constrains you:
anything that can run `mycontext` can pass `--yes`. It exists so that creating
a governing item leaves an explicit token in the transcript. Print the command
for the user; do not run it for them.

This is not a reason to capture less. Capture freely; the gate is downstream.

## Calling create_item more than once is free

`create_item` never overwrites anything: it either creates, or reports what
already exists. It is keyed on `(type, source_file, source_anchor)` plus a
content hash — a requirement and a constraint captured from the same heading
are different items, not a collision. Calling it twice with the same content
returns *"already captured as REQ-…"* and writes nothing. If the wording at a
source anchor has materially changed, it creates a new item rather than
silently updating the old one — one heading legitimately yields several items
as a document evolves, and `create_item` cannot tell an intentional revision
from an unrelated new point at the same anchor. If you mean to revise an
existing item rather than add a new one, call `update_item` with its id
instead of calling `create_item` again. You never need to check first.

## What does not survive being written down

Two shapes of text are refused, because the Markdown they would produce does
not read back as what you wrote — the content would be lost on the next
rebuild, silently:

- A **body line starting with `#`** (any heading level). A body is stored as
  the prose before the item's first `## ` section, so that line and everything
  after it would be lost the next time the item is read back. Put the detail in
  an observation instead — or, for an ordered `procedure`, in the item's
  `## Steps` section, which is a field of the item rather than part of its
  body. That is the third route the refusal itself offers, and it is the one a
  procedure usually wants.
- **Observation text containing `#`, or ending in `(...)`.** `#word` is read
  back as a tag and a trailing parenthetical as the observation's `context`,
  so both would be stripped out of the text. Use the `tags` field, or
  rephrase.

## Tools

- `create_item`: Capture a new constraint, requirement, decision, lesson or other typed item. Idempotent — safe to call repeatedly. Not for: notes about this session's work, or restating an item that already exists.
- `update_item`: Revise an existing item by id. Title, body, tags and extra apply or are staged for a human; the reply says which. Not for: scope, always or severity on a governing item, or status on a normative one.
- `refresh_item`: Re-snapshot a file-backed item: the server re-reads its source_file and replaces the body. Applies or is staged, as update_item is. Not for: an ingested item, which holds an extraction.
- `supersede_item`: Retire the item named by `id` in favour of `by`; both relation directions are recorded for you. Not for: retiring a governing (active or validated) normative item — a human decision.
- `link_items`: Record a typed relation between two items, such as derived_from or constrains. Not for: self-links, supersedes or superseded_by (use supersede_item), or a duplicate relation, which is ignored.
- `get_item`: Fetch one item in full by id, as Markdown. Not for: searching — use query_items when you do not know the id.
- `query_items`: Search and filter items by type, status, tag, relation, text or file path. Not for: fetching a known id, which get_item does directly.
- `list_drafts`: List items awaiting human review, newest first. Not for: promoting them — only a human can do that.
- `load_context`: Inject this project's pinned items and index now, as a session start does. Restored after a compaction only if the transcript still shows the ids; never rationale. Not for: searching — query_items.
- `focus_context`: Narrow what my_context injects, to tags, categories or scopes, and report the cost: items hidden, load-bearing relations dangling. Not for: severity:hard items, never hidden.
- `audit_log`: Read what my_context did: mutations, and injections by scope — which items at which tier, never their text. Filter by item, session, op or time. Not for: item content, which get_item retrieves.
- `mycontext_help`: Read guidance on one topic: categories, scope, capture, workflow, tools, slash. Not for: item content, which query_items retrieves.
- `mycontext_examples`: Show a complete, correct example item of a given type to copy. Not for: real project content.
- `ingest_document`: Extract normative items from a document. Two calls: pass "path" for a chunk to extract yourself, then "session", "anchor" and "candidates". Not for: one fact — use create_item.
