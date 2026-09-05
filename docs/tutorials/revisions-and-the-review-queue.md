# Review a pending change before it governs

**Tested on:** my_context v1.0.2, Node 24, Windows 11.

## What it is for

An agent proposing a constraint is useful. An agent *installing* one, into every
future session, without anybody reading it, is not.

The review queue is where that difference lives. It holds two kinds of pending
thing — **drafts**, which are whole items that do not govern yet, and
**revisions**, which are proposed changes to items that already do — and neither
takes effect until a person settles it.

## How it works

### Drafts, and why they exist

The discriminator is the **category's tier**, not who typed it:

| Author | Normative category | Rationale category |
|---|---|---|
| you (`mycontext add`) | active, governing at once | active |
| Claude (`create_item`) | **draft**, governs nothing | **active** |
| `ingest` | draft | active, never pinned |

An agent-authored *rationale* item lands active with no human act. That is
deliberate — rationale is never injected, so it cannot steer anything.

Claude also cannot edit item files directly. The write is denied by name:

```json
{"permissionDecision":"deny","permissionDecisionReason":"my_context: `.my_context/items/` is managed by my_context. Writing the file directly leaves the SQLite index and the item checksum stale, and bypasses the review boundary that keeps agent-authored normative items out of injection. Create items with the `create_item` MCP tool, and read them with `get_item` or `query_items`."}
```

**One limit worth knowing.** That covers Claude's file tools, not `Bash`. An
agent with shell access can write into `.my_context/` and that write is neither
denied nor audited; `mycontext doctor` catches a tampered item afterwards by
checksum, and `config.json` has no checksum at all. A hard link also bypasses
the path check, because a path check cannot see a second inode name. Path
hardening otherwise holds — `\?\`, `\localhost\C$`, 8.3 short names, junctions
and `..` traversal are all denied. Treat the boundary as a strong default that
makes the honest path the easy one, not as a sandbox around a hostile agent.

### Revisions, and per-field staleness

When a category is set to `agentEdits: "review"`, an agent's edit is not applied
— it is staged as a pending revision, recording the text it was written against.

**Staleness is per field.** Edit the body underneath a pending body revision and
that revision goes stale: promoting it is refused, naming the fields that moved
and printing both texts. A *title* revision sitting beside it is unaffected and
stays promotable. Promoting one revision invalidates only the others that
proposed the same field.

`--force` promotes a stale revision anyway, after printing exactly what that
destroys.

## From the CLI

```bash
mycontext review                                  # the drafts awaiting promotion
mycontext review show <id>                        # one, in full
mycontext review promote <id> [--scope … --severity … --always]
mycontext review discard <id>
mycontext review revisions <id> --full            # pending revisions on one item
mycontext review promote-revision <id> --revision REV-…
mycontext review discard-revision <id> --revision REV-… --reason "…"
```

Promotion is also where a draft gets the scope its author could not know:
`--scope` and `--severity` on `review promote` set them as the item is accepted.

Two neighbouring verbs settle an item that is already in force rather than
pending:

```bash
mycontext supersede <old> --by <new>   # retire one in favour of a replacement
mycontext edit <id> --status deprecated
```

`supersede` records both directions, and an agent **can** supersede a validated
*rationale* item — the guard covers normative items only. There is no delete, by
design: deletion is yours alone, and both supersede and deprecate are reversible
and leave a trail.

**The slash commands.** `/mycontext:review`, `/mycontext:promote`,
`/mycontext:discard`, `/mycontext:edit`, `/mycontext:supersede`,
`/mycontext:harden`, `/mycontext:soften`, `/mycontext:pin`, `/mycontext:unpin`.

**From an agent**, `list_drafts` reads the queue, `update_item` is what gets
staged as a revision, and `supersede_item` is refused for a governing normative
item.

**What the CLI can do here that the UI cannot.** `--force` on a stale revision,
and `review show`. And `mycontext review` with no arguments — walking the queue
as a queue.

## From the UI

The **Review queue** screen (`nav.ch`) states its own contract exactly: *the
diff is the capability; the approval is a paste.*

Two lists, and each empty state is a measured sentence rather than blank space —
*"Drafts awaiting a decision. None — everything captured is already settled"*,
*"Revisions proposed against items in force. None — nothing has been proposed
yet."*

For a revision, the screen draws the field table: **Field**, **In force**,
**Proposed** — and the proposed column is a *line-level diff*, not a paragraph
to compare by eye. Additions are tinted and removals struck through as real
`<ins>` and `<del>` elements, so a screen reader announces the change with no
added ARIA.

Per-field staleness is drawn where it happens: a field that moved since staging
is marked *changed since staging*, and the row says *promote refuses until
re-based*. The screen's own note tells you how to read that: **if the body moved
first, promote refuses and names both values — that is the product working, not
failing.**

The four `review` verbs are in the Composer's catalogue, all on the trust
boundary, so accepting or rejecting from the browser goes through the
field-by-field confirm and is written to the audit log twice — once before it
runs and once with its exit code.

**What the UI can do here that the CLI cannot.** The diff. A terminal prints two
texts; this screen aligns them field by field and marks the ones that moved.

**What the UI cannot do here.** Force a stale promotion. And it does not observe
the outcome of a line you copied to run yourself: the screen is explicit that a
composed line is *"copied, not yet observed landing"* until you return to the tab
and it re-checks.
