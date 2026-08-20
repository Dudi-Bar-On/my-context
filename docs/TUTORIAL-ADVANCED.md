# my_context — the advanced guide

Assumes you have worked through `TUTORIAL.md`: you can capture an item, you have
seen one arrive on a file touch, and you know normative from rationale.

Every command and output below was executed while writing this page.

**Tested on:** my_context v1.0.0, Node 24.14.0, Windows 11, Claude Code 2.1.233.

---

## 1. The four injection tiers

Everything my_context does at runtime is one question: *which items reach this
session, and in what form?* There are exactly four answers.

| Tier | When | What arrives |
|---|---|---|
| **pinned** | every session start | the item **in full** |
| **index** | every session start | id and title only |
| **jit** | the first time a touched file matches the item's scope | the item **in full** |
| **restored** | after a compaction | in full, for items this session had already seen |

Rationale-tier items appear in none of them. In the session index they are
reduced to a bare count — `1 lesson` — with no ids and no content.

### The restored tier, which is easy to misunderstand

When Claude compacts, `PreCompact` writes a manifest of every item id the
session touched:

```json
{
  "sessionId": "9e5b6b17-…",
  "capturedAt": "2026-08-17T14:47:02.709Z",
  "itemIds": [
    "CONST-evidence-must-cite-a-captured-record-id",
    "CONST-live-pass-probe-of-the-agent-normative-trust-boundary",
    "LESSON-agent-created-items-must-land-as-drafts-not-active",
    "REF-campaign-handover-read-this-before-acting-on-any-finding",
    "RULE-harness-cases-must-reach-the-behaviour-they-name"
  ]
}
```

**That manifest is deliberately permissive.** It lists every id — including a
draft and a rationale item. It makes no trust decision and it stores ids only,
never text.

The gate runs on the *other* side. When `SessionStart` fires with
`source: compact`, it re-applies the current policy and, from the five above,
restored exactly one in full: the active normative `RULE`. The draft and the
rationale item came back as `1 lesson · 1 drafts pending review`.

This ordering is the useful part: **the policy in force when context is rebuilt
wins, not the policy frozen when it was captured.** Retier a category or reject
a draft between the two events and the change is honoured.

---

## 2. Scope, and the policy that inverts it

Scope is the main cost control. An item with `scope: ["src/billing/**"]` is
weighed only on files under `src/billing/`. An item with no scope is weighed on
**every** file operation.

`mycontext status` nags about exactly this:

```
1 active normative item(s) carry no scope, so they apply to every file and
compete for the jit budget on every file operation.
```

### `scopePolicy: "inert"`

Per category, you can invert what "no scope" means:

```json
{
  "profile": "standard",
  "categories": {
    "requirement": { "scopePolicy": "inert" }
  }
}
```

With that set, an unscoped `requirement` applies to **no** file rather than all
of them. Same corpus, same query, before and after:

```console
$ mycontext search --path "src/api/handler.ts"
┌─────────────────────────────────────────────────┬────────┬────────┐
│ id                                              │ type   │ status │
├─────────────────────────────────────────────────┼────────┼────────┤
│ LESSON-the-sandbox-declines-3ds-cards-at-random │ lesson │ active │
│ RULE-every-price-is-an-integer-of-minor-units   │ rule   │ active │
└─────────────────────────────────────────────────┴────────┴────────┘
```

The unscoped `REQ-checkout-completes-in-two-steps` is gone — not deleted, just
inert. It survives as an index line and nothing more.

**Use this when a category is mostly aspirational** — requirements and
open questions often are — and you want its members to govern only where they
were explicitly pointed. It is a sharp tool: an item you *forgot* to scope
silently stops governing.

---

## 3. Focus — narrowing a session

Focus is a temporary filter over what may be injected. It narrows on three axes:
`--tag`, `--category`, `--scope`. Positional arguments are tags.

Always preview first:

```console
$ mycontext focus db --preview
my_context: preview only — nothing was changed.
focus: tags: db
2 item(s) in focus, 3 hidden by focus (of the eligible corpus).

hidden by focus — still in the corpus, still readable with `mycontext show`:
  LESSON-the-sandbox-declines-3ds-cards-at-random
  REQ-checkout-completes-in-two-steps
  RULE-every-price-is-an-integer-of-minor-units

0 load-bearing relations dangling.

1 severity:hard item(s) do not match this focus and are injected anyway — focus never hides one:
  CONST-card-numbers-never-reach-the-logs
Apply it by running the same command without --preview.
```

Four things worth extracting from that output:

1. **`tags` decide injection here.** Outside a focus they are pure metadata. The
   moment a focus is set, an item matching none of its tags is held back.
2. **`severity: hard` is exempt.** Focus never hides a hard item, and it says so
   rather than quietly making an exception.
3. **It discloses rather than refuses.** It hides what you asked it to hide and
   tells you the cost, including relations left dangling.
4. **The preview calls the same selection the injection will**, so a preview and
   the injection that follows it cannot disagree.

Focus lives in `.my_context/state/focus.json`, which is gitignored — it is local
to your machine and never narrows a teammate's injection.

```bash
mycontext focus --show      # what is set
mycontext focus --clear     # remove it
mycontext focus --relations # the relation types you can focus on
```

---

## 4. Budgets, and what happens when they bind

Each tier has a token budget. Pinned full text is the expensive one — 8,000
estimated tokens by default. An item that does not fit **spills whole**, and the
spill is disclosed by id. Nothing is ever silently truncated.

`mycontext refresh` shows you the arithmetic before writing. The run below was captured
against the corpus this guide was written on, where a `reference` pointed at a handover
document in another repository — the shape is what matters, not the path:

```console
about to refresh:
  item        REF-campaign-handover-read-this-before-acting-on-any-finding
  type        reference
  source      reports/HANDOVER.md
  checksum    3565908ab29f4fa6 -> 7065ac5489fa7939
  size        265 -> 273 line(s), ~3235 -> ~3385 estimated tokens
  budget      this category is normative, so the item competes for the injection budget
              against every other normative item; the largest full-text budget here is 8000
              estimated tokens, and an item that does not fit spills whole and is disclosed by id.
```

Override budgets per tier in `config.json` under `budgets`. Raise the pinned
budget only if you have a reason: it is charged to every session.

---

## 5. Configuration

`.my_context/config.json` is small and every key is optional.

```json
{
  "profile": "standard",
  "categories": {
    "reference":   { "tier": "normative" },
    "requirement": { "scopePolicy": "inert" },
    "lesson":      { "agentEdits": "review" }
  },
  "budgets": {},
  "watchedDocs": ["docs/**/*.md"]
}
```

| Key | Effect |
|---|---|
| `profile` | which categories are enabled — `minimal`, `standard`, `full` |
| `categories.<name>.tier` | move a category between `normative` and `rationale` |
| `categories.<name>.scopePolicy` | `inert` inverts what "no scope" means |
| `categories.<name>.agentEdits` | `review` stages an agent's edit as a pending revision instead of applying it |
| `budgets` | per-tier token ceilings |
| `watchedDocs` | globs whose edits produce a capture nudge |

**Retiering is the big lever.** Moving `reference` to `normative` makes
references eligible for the pinned tier — which is how you make a document
re-inject itself after every compaction:

```bash
mycontext add reference --file docs/ARCHITECTURE.md --yes
mycontext pin REF-... --yes
```

Try to pin it *before* retiering and it refuses, exit 1, explaining that
`always: true` asks for the pinned tier and the pinned tier admits only
normative items — and that nothing was changed.

**Note:** `config.json` is protected from Claude's file tools but carries no
checksum, so `doctor` cannot detect a hand edit to it the way it detects a
tampered item.

---

## 6. Pulling items out of a document you already have

If the knowledge is already written down — a PRD, an architecture note, a
runbook — `ingest` extracts candidates chunk by chunk.

```bash
mycontext ingest docs/prd.md          # request candidates for the next chunk
mycontext ingest-apply --anchor <a>   # hand the model's answers back
mycontext ingest-status               # what is left
```

`/mycontext:ingest` drives all three from inside a session, which is the way to
use it — `ingest-apply` and `ingest-status` are steps within it rather than
commands you run yourself.

Two properties worth knowing:

- Ingested items carry `origin: ingest`, which is distinct from both `human` and
  `agent` in the audit log.
- Every ingested candidate is written with `always: false`. **No ingested item
  can assert a pin**, whatever the document says.

---

## 7. From an incident to a rule

The lesson pipeline exists because turning an incident into a governing rule is
exactly the step that should not be automatic.

```bash
mycontext lesson "The 3DS sandbox declines valid cards at random"
mycontext lesson-stage                       # stage a candidate rule
mycontext lesson-accept --title "..." --directive dont --scope "src/billing/**"
mycontext lesson-discard
```

`/mycontext:lesson-stage` prints the accept and discard commands and **stops**.
It will not run either. A slash command that ran `lesson-accept` would be the
model settling a rule on your behalf, which is the act the flow exists to
preserve.

---

## 8. Revisions and the review queue

When a category is set to `agentEdits: "review"`, an agent's edit is not applied
— it is staged as a pending revision recording the text it was written against.

```bash
mycontext review                              # drafts awaiting promotion
mycontext review revisions <id> --full        # pending revisions on an item
mycontext review promote-revision <id> --revision REV-...
mycontext review discard-revision <id> --revision REV-... --reason "..."
```

**Staleness is per field.** If you edit the body underneath a pending body
revision, that revision goes stale and promoting it is refused, naming the
fields that moved and printing both texts. A *title* revision sitting beside it
is unaffected and stays promotable. Promoting one revision invalidates only the
others that proposed the same field.

`--force` promotes a stale revision anyway, after printing exactly what that
destroys.

---

## 9. The audit log

Everything that mutates or injects is appended to `.my_context/.audit/`, and the
SQLite projection over it is disposable.

```bash
mycontext audit                                    # recent records
mycontext audit --since 1d --origin agent          # what Claude did today
mycontext audit --items --role injected            # which items actually reach sessions
mycontext audit --summary                          # counts by operation
mycontext audit --files                            # rolled up per file
mycontext audit replay-ledger                      # rebuild the usage projection
```

```console
$ mycontext audit --items --role injected
my_context: the items this log names most as "injected" (top 20):
  ┌───────────────────────────────────────────────┬───────┬────────────────┐
  │ item                                          │ count │ last           │
  ├───────────────────────────────────────────────┼───────┼────────────────┤
  │ CONST-card-numbers-never-reach-the-logs       │ 2     │ 08-17 15:48:55 │
  │ RULE-every-price-is-an-integer-of-minor-units │ 2     │ 08-17 15:48:55 │
  └───────────────────────────────────────────────┴───────┴────────────────┘
```

`--role` is the one flag here that only means something with `--items`: it
selects whether to count an item as the record's `subject`, as `injected`, or as
`spilled`. Passing it without `--items` is refused rather than ignored.

`--origin` is the trust-boundary axis: `human`, `agent`, `ingest`. It is the
fastest answer to "did a person decide this?"

`replay-ledger` tops up incrementally and rebuilds the projection whole only if
the log has diverged. Deleting the database loses nothing.

---

## 10. Decay — finding what stopped mattering

```console
$ mycontext decay
my_context decay — items not injected in the last 20 session(s). The ledger holds 1 session(s).
  "cold" means: not auto-injected in the last window of sessions. It does NOT mean unused — the
  ledger records injection, not reading or reliance, so a new item, and any item consulted via
  `show`, MCP `get_item`, or the Markdown file directly, look exactly like an abandoned one here.
  Do not supersede or deprecate anything on this report alone — verify real usage first.
  (only 1 session(s) recorded so far, so "cold" mostly means "new")
```

Read the caveat before the table. The ledger records **injection**, not reading
or reliance. A correctly-scoped item covering a directory nobody touched this
month is cold and perfectly healthy.

---

## 11. Integrity

```bash
mycontext doctor          # checksums, drift, malformed items
mycontext rebuild         # recreate the index from the Markdown
mycontext repair <id>     # re-stamp a checksum after a deliberate hand edit
```

`doctor` verifies each item's stored checksum against its file, and for a
`reference` it also checks the **source document**. Again captured against this guide's own
corpus:

```
source_drift (1)  [warn]
  REF-…: "reports/HANDOVER.md" has changed since REF-… snapshotted it
    (3565908ab29f4fa6 → 7065ac5489fa7939). The item still holds the OLD text, and that is
    what any session reading it gets. Nothing was auto-resolved: run `mycontext refresh REF-…`
    to take a fresh snapshot, which shows you the size change and asks before it writes.
```

Note what that message does: states the consequence, confirms nothing was
auto-resolved, and names the exact remedy. `doctor` detects drift; it never
silently fixes it. `repair` makes the checksum agree with the file and **cannot
recover what an edit removed** — it is for deliberate hand edits, not recovery.

---

## 12. The trust boundary, precisely

Worth stating exactly, because the useful summary is slightly wrong.

**The discriminator is the category's tier, not who typed it.**

| Author | Normative category | Rationale category |
|---|---|---|
| you (`mycontext add`) | active, governing at once | active |
| Claude (`create_item`) | **draft**, governs nothing | **active** |
| `ingest` | draft | active, never pinned |

An agent-authored *rationale* item lands active with no human act. That is
deliberate — rationale is never injected, so it cannot steer anything.

### What the boundary does not cover

- **`Bash` is not intercepted.** The write-deny covers Claude's file tools. A
  shell write into `.my_context/` is neither denied nor audited. `doctor` finds
  tampered items afterwards by checksum; `config.json` has no checksum.
- **A hard link bypasses it.** Path checks cannot see a second inode name.
- Path hardening otherwise holds: `\\?\`, `\\localhost\C$`, 8.3 short names,
  junctions and `..` traversal are all denied.
- An agent **can** supersede a validated *rationale* item. The guard covers
  normative items only.

Treat it as a strong default that makes the honest path the easy one — not as a
sandbox around a hostile agent.

---

## 13. The MCP surface

Fourteen tools. The ones that matter day to day:

| Tool | Notes |
|---|---|
| `load_context` | what would be injected now |
| `create_item` | normative → draft; rationale → active |
| `update_item` | may be staged as a revision under `agentEdits: "review"` |
| `query_items` | structured search, filters by tag |
| `get_item` | fetch one by id |
| `focus_context` | set or preview a focus |
| `ingest_document` | both legs of ingest in one call |
| `list_drafts` | the review queue |
| `supersede_item` | refused for a governing normative item |
| `audit_log` | its filter parameter is `actor`, where the CLI says `--origin` |

There is **no** `delete_item`, by design. Deletion is yours alone; an agent may
supersede or deprecate, both reversible and both leaving a trail.

---

## 14. A configuration that works

For a repository with a real team:

```json
{
  "profile": "standard",
  "categories": {
    "requirement":  { "scopePolicy": "inert" },
    "open_question":{ "scopePolicy": "inert" }
  },
  "watchedDocs": ["docs/**/*.md", "*.md"]
}
```

And three practices:

1. **Scope on capture, not later.** An unscoped item is charged to every file
   operation, and nobody goes back to add scopes.
2. **Pin at most one or two items.** Pinned text is paid for in every session
   forever. Scope delivers the same knowledge exactly when it is relevant.
3. **Walk the review queue weekly.** `mycontext review` is where the trust
   boundary either works or quietly becomes friction people route around.

---

## Appendix — reference

**Injection tiers:** pinned · index · jit · restored. Rationale reaches none of
them; it appears as a bare count.

**The 14 normative categories:** `constraint` `rule` `requirement` `invariant`
`standard` `pattern` `glossary` `instruction` `non_goal` `open_question`
`runbook` `procedure` `environment` `known_issue`

**The 10 rationale categories:** `adr` `decision` `lesson` `tradeoff`
`assumption` `edge_case` `risk` `reference` `todo` `note`

**Statuses:** `draft` · `active` · `validated` · `deprecated` · `superseded`.
Only `active` is injected.

**Hooks:** `SessionStart` (`startup|clear|resume|compact`) · `PreToolUse`
(`Read|Edit|MultiEdit|Write|NotebookEdit`) · `PreCompact` · `PostToolUse`
(`Write|Edit|MultiEdit`).

**Authority:** `mycontext help <command>` prints the usage the code enforces. If
it and the README disagree, the command is right.
