# Find the item you're thinking of, from the CLI or the UI

Every command and every block of output on this page was run against a fresh
workspace while writing it. Nothing here is illustrative.

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

A corpus you cannot search is a corpus you stop trusting. This feature is the
read side of my_context: listing what is in here, finding the one item you half
remember, printing it whole, and — when the question is sharper than a word
search — running read-only SQL over the index.

It is also how you answer the question `CLAUDE.md` never could: *what governs
this file?*

## How it works

The Markdown files are the truth. Beside them sits a derived SQLite index,
rebuilt from the Markdown on demand and safe to delete — `.my_context/.gitignore`
excludes exactly that one file and nothing else.

There are four different questions, and four different reads:

- **`list`** — everything, or everything in one category, as a table.
- **`show`** — one item, whole, exactly as it is on disk.
- **`search`** — by text, by type, by tag, by **path**, by status, and by
  relation. The path form is the one that answers "what governs this file?":
  it runs the same scope matching the injection does.
- **`query`** — read-only SQL over the index, capped at 1000 rows.

The **audit log** is a fifth read, over a different thing entirely: not what the
corpus holds, but what the product did. It has its own tutorial, *Watch what
my_context is doing, live*.

## From the CLI

```console
$ mycontext list
┌─────────────────────────────────────────────────┬────────────┬────────┐
│ id                                              │ type       │ status │
├─────────────────────────────────────────────────┼────────────┼────────┤
│ CONST-card-numbers-never-reach-the-logs         │ constraint │ active │
│ LESSON-the-sandbox-declines-3ds-cards-at-random │ lesson     │ active │
│ RULE-every-price-is-an-integer-of-minor-units   │ rule       │ active │
└─────────────────────────────────────────────────┴────────────┴────────┘
```

Text search:

```console
$ mycontext search 3ds
┌─────────────────────────────────────────────────┬────────┬────────┐
│ id                                              │ type   │ status │
├─────────────────────────────────────────────────┼────────┼────────┤
│ LESSON-the-sandbox-declines-3ds-cards-at-random │ lesson │ active │
└─────────────────────────────────────────────────┴────────┴────────┘
```

Search by path — "what governs `src/billing/charge.ts`?":

```console
$ mycontext search --path src/billing/charge.ts
┌─────────────────────────────────────────────────┬────────────┬────────┐
│ id                                              │ type       │ status │
├─────────────────────────────────────────────────┼────────────┼────────┤
│ CONST-card-numbers-never-reach-the-logs         │ constraint │ active │
│ LESSON-the-sandbox-declines-3ds-cards-at-random │ lesson     │ active │
│ RULE-every-price-is-an-integer-of-minor-units   │ rule       │ active │
└─────────────────────────────────────────────────┴────────────┴────────┘
```

Read that answer carefully: it lists what MATCHES the path, not what will be
injected. The lesson matches because scope matching is a property of the item,
and the rule matches because it carries no scope at all. What actually reaches a
session is a narrower question, answered by *See what my_context actually
injected, and why*.

SQL, when the question is a shape rather than a word:

```console
$ mycontext query "SELECT id,type FROM items WHERE type='rule'"
┌───────────────────────────────────────────────┬──────┐
│ id                                            │ type │
├───────────────────────────────────────────────┼──────┤
│ RULE-every-price-is-an-integer-of-minor-units │ rule │
└───────────────────────────────────────────────┴──────┘

1 row(s)
```

Every read command takes `--full`, `--short`, `--summary` and `--json`, so the
same query is a table for you and a document for a script.

**The slash commands.** `/mycontext:search`, `/mycontext:query`, `/mycontext:show`,
`/mycontext:audit`, and a `/mycontext:list-<category>` for each of the 29
categories — a list command per category exists so a session can ask for one
tier of knowledge without composing a flag.

**From an agent**, the same reads are the `query_items`, `get_item`,
`list_items` and `list_todos` MCP tools.

**What the CLI can do here that the UI cannot.** Write SQL of your own. The Ask
screen composes its statement on the server from bound parameters and canned
shapes; no query text crosses the wire. `mycontext query` is the only surface
where the SELECT is yours. `--json` on every read command is also CLI-only, and
so are `search --relation`, `--linked-to` and `--direction`.

## From the UI

The **Ask** screen (`nav.ev`) is the browser's read surface: one filter row,
four canned queries, a three-column result table, and — this is the part worth
knowing — a pane showing **the SQL the server actually ran** for the answer you
are looking at. The screen shows you the statement; it never sends you one.

Beside it, the **Status** screen answers "what is in here" as counts, and
`GET /api/item/:id` behind the item views prints one item whole.

**What the UI can do here that the CLI cannot.** Show you the statement and the
rows together, and let you move from a result straight into the Relations,
Injection preview or Doctor view of the same item without retyping an id.

**What the UI cannot do here.** Accept arbitrary SQL, at all. It also cannot
serve you a JSON dump of a result: the browser draws rows, and `--json` stays a
terminal answer.
