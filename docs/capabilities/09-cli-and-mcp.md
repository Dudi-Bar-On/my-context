<title>The CLI and the MCP server</title>

# Chapter 9 — The CLI and the MCP server

[Index](./00-index.md)

my_context has two entry surfaces into the same engine: a **CLI** (`node src/cli/index.ts <command>`, installed as the `mycontext` bin) for a human at a shell or an agent with shell access, and an **MCP server** (`src/mcp/server.ts`, registered in `.mcp.json` as a stdio server) for an agent that only has tool calls.

**They are siblings, not a wrapper around each other.** Both `src/cli/commands/*.ts` and `src/mcp/tools.ts` import directly from the same `src/core/*.ts` modules (`core/mutate.ts` for `createItem`/`updateItem`/`supersedeItem`, `core/select.ts` for `select`/`reviewQueue`, `core/needs.ts` for `readyReport`, `core/decay.ts` for `computeDecay`, `core/audit.ts` for `readAudit`/`recordAudit`, and so on — confirmed by reading the import block at the top of `src/mcp/tools.ts`, lines 1–54). Neither surface shells out to the other. A behavior difference between them is a bug in one of the two call sites, not a translation layer.

This chapter is the full command/tool reference. Commands and tools with deep independent mechanics get their own chapter elsewhere and only a summary line here; every other command gets full treatment.

---

## 1. How commands are registered

`src/cli/commands/registry.ts` defines `CommandDef` and `registerCommand()`. Every command file that is a real top-level command calls `registerCommand(...)` at module load. Grepping `src/cli/commands/*.ts` for that call turns up exactly 33 files that register a command:

```
ack, audit, carry, config, contribution, conversation, decay, doctor, edit, export,
focus, handover, inbox-promote, ingest, lesson, link, pack, procedure, query, ready,
refresh, registry, repair, restore, review, rules, search, session, status,
statusline, supersede, todo, ui
```

`init`, `add`, `list`, `show`, `rebuild`, `help`, `examples`, `harden`, `soften`, `pin`, and `unpin` are the remaining top-level commands from `--help`, registered directly in `src/cli/index.ts` rather than their own file. **`revision-view.ts`, `format.ts`, `context.ts`, `injection.ts`, `statusline-install.ts`, and `statusline-powerline.ts` are not commands at all** — they are internal helpers: `revision-view.ts` is imported only by `review.ts` (`fieldDiff`, `renderRevision`, `renderSettled` — it renders a pending revision as a diff, never a table, because a diff column is prose of unbounded width); `format.ts`/`context.ts` are shared CLI plumbing (output width, workspace resolution); `injection.ts` is a helper `inbox-promote.ts` reuses; `statusline-install.ts`/`statusline-powerline.ts` are dispatched from inside `statusline.ts`'s subcommand switch, not registered separately. Worth naming because the task brief listed several of these as if they were independent commands — they are not, and documenting them as such would be exactly the kind of second copy this project spends its effort deleting.

The real, current top-level usage line (run yourself with `node src/cli/index.ts --help`):

```
usage: mycontext <command> [args]

  init [--pack <path>]          create .my_context here (--pack: found it from an artefact, as drafts)
  add <category> <title> [opts] create an item (--body|--file --note --observation --step --summary|--summary-omitted --scope --tags --severity --always --valid-from --original-id --request --extra --yes)
  list [category] [--full|--short|--summary] [--json]  list items
  show <id>                     print an item
  rebuild                       rebuild the index from Markdown
  help [topic]                  guidance: categories, scope, capture, workflow, cli, tools, slash
  examples <category> [--short] an example item, and what may be changed on one (--short: the item alone)
  ack <id> <code> [--clear] [--list], or ack --all --code <code> [--count <n>]  record that a person has ruled on a doctor finding, anchored to the item as it stands
  audit [--since T] [--item ID] [--op O] [--limit N]  the run-time log of mutations and hook actions
  carry <id> [--show|--clear]   mark one item for delivery at the next injection, then forget it (one-shot, not pin)
  config <name> --delete|--disable [--yes], or config <path> --set|--unset <value> [--yes]  delete/disable a category, or set/unset one field, in config.json
  contribution [--full|--short|--summary] [--json]  how often each item was actually delivered, from the audit log
  conversation [rebuild|list|subagents|secrets|persist|name|anchor|forget] [--full] [--limit <n>] [--replace <ids>] [--clear] [--yes] [--json]  index the conversation and subagent transcripts on disk, and list what it holds
  decay [--sessions N] [--all] [--full|--short|--summary] [--json]  items that have not been injected lately
  doctor [--quiet] [--full|--short|--summary] [--json]  self-check: index freshness, orphans, drift, dead globs, permissions, session ids
  edit <id> [...]                change an item, with a gate that scales to what the change can do
  export --out <path> [--format dir|zip] [--as-pack] [--dry-run] [--json]  write this corpus to a path outside the workspace, whole or as a pack
  focus [<tag>…] [--show|--clear]  narrow what gets injected
  handover ask [--anyway]       ask for the handover NOW, at whatever the window holds
  harden <id> [--yes]           make a normative item binding (edit --severity=hard)
  inbox-promote <id> --to <cat> a todo or note becomes a real item, linked back
  ingest <path>                 emit an extraction request for a document
  ingest-apply <id> --anchor <a>  apply extracted candidates as drafts
  ingest-status [...]           list ingest sessions and their progress
  lesson / lesson-accept / lesson-discard / lesson-stage   record a lesson, derive and approve rule candidates
  link <from> <relation> <to>   record a relation from one item to another
  pack [import|list] [<path>]   import an artefact somebody else wrote, and list the packs already imported
  pin <id> [--yes]              inject an item at every session start (edit --always=true)
  procedure [list|show|activate|done|step] [<id>] [<n>]  the one-shot lifecycle
  query "SELECT ..." [--json] [--limit <n>]  read-only SQL over the index (capped at 1000 rows)
  ready [--plan <p>] [--held] [--limit <n>] [...]  open tasks whose needs are all done
  refresh <id>                  re-snapshot a reference from its source file
  repair [--yes]                re-stamp project items whose recorded checksum no longer matches their content
  restore --build|--show|--approve <key>|--discard <key>
  review [list|show|promote|discard|revisions|promote-revision|discard-revision] [<id>]
  rules [verify|list|show] [<id>] [--restore] [--json]
  search "<words>" [...]        find items by text, type, tag, path, relation, or what links to another item
  session [list|name|carry] [<session-id>] [<name>] [--json]
  soften <id> [--yes]           make a normative item advisory (edit --severity=soft)
  status [--full|--short|--summary] [--json]
  statusline [install|uninstall] [--yes]
  supersede <id> --by <id>
  todo [--tag <t>] [--all] [--limit <n>] [...]
  ui [--port N] [--no-open] [--idle-ms N] | ui --nonce [--no-open]
  unpin <id> [--yes]

categories: constraint, invariant, rule, requirement, standard, pattern, glossary, instruction,
non_goal, open_question, runbook, procedure, environment, known_issue, exception, contract, adr,
decision, lesson, tradeoff, assumption, edge_case, risk, measurement, reference, plan, task, todo, note
```

---

## 2. Commands covered fully elsewhere (summary + link only)

| Command | One line | Chapter |
|---|---|---|
| `add`, `edit`, `--distinct`, `--supersedes`, `--summary-omitted`, `doctor`, `repair`, `supersede` | Item creation and the summary/contradiction gates | [Chapter 3 — Creation and the gates](./03-creation-and-gates.md) |
| `restore`, `handover ask` | Session continuity across a compact or a new session | [Chapter 7 — Restore and handover](./07-restore-and-handover.md) |
| `rules verify\|list\|show` | The shipped product rule store | [Chapter 10 — The product rule store](./10-rule-store.md) |
| `conversation [rebuild\|list\|subagents\|secrets\|persist\|name\|anchor\|forget]` | The conversation archive and its trigram search | [Chapter 4 — The conversation archive](./04-conversation-archive.md) / [Chapter 5 — Anchors](./05-anchors.md) |
| `ui` | The read-only web UI | [Chapter 8 — The web UI](./08-web-ui.md) |
| `lesson`, `lesson-stage`, `lesson-accept`, `lesson-discard` | The self-improvement loop's proposal pipeline | [Chapter 11 — The self-improvement loop](./11-self-improvement-loop.md) |
| `pack`, `export` | Portable artefacts of the corpus | [Chapter 12 — Packs, export/import, procedures](./12-packs-export-import-procedures.md) |
| `procedure` | The one-shot lifecycle (list/show/activate/done/step) | [Chapter 12](./12-packs-export-import-procedures.md) |

---

## 3. Full reference: commands not covered elsewhere

### Corpus inspection — `list`, `show`, `search`, `query`, `status`

**`status`** — counts, review queue size, ingest progress, decay/health summary in one screen. Read-only. Worked example, real output from this repo today:

```
$ node src/cli/index.ts status
my_context 1.0.2: 1108 item(s), profile "standard"

by category
  ┌───────────────┬───────┐
  │ category      │ items │
  ├───────────────┼───────┤
  │ adr           │ 3     │
  │ constraint    │ 7     │
  │ decision      │ 99    │
  │ instruction   │ 11    │
  │ invariant     │ 6     │
  │ known_issue   │ 32    │
  │ lesson        │ 43    │
  │ measurement   │ 1     │
  │ non_goal      │ 3     │
  │ note          │ 27    │
  │ open_question │ 29    │
  │ reference     │ 5     │
  │ requirement   │ 32    │
  │ rule          │ 55    │
  │ standard      │ 15    │
  │ task          │ 740   │
  └───────────────┴───────┘

by status
  active 1039 · deprecated 29 · superseded 40

by origin
  agent 38 · human 1070

review queue: 0 draft(s) pending review — walk it with `mycontext review`.

usage: 26 session(s) recorded. 1 normative item(s) not injected in the last 20 session(s) — not
evidence they are unused, only that they were not selected. See `mycontext decay`.
  124 active normative item(s) carry no scope, so they apply to every file and compete for the jit
  budget on every file operation.

health: 1 error(s), 56 warning(s), 48 note(s) — details from `mycontext doctor`.
```

Use case: the first command to run at the start of a session to get a one-screen read on corpus size, health, and what's waiting for review.

**`list [category]`** and **`show <id>`** — the basic read path; `list` without a category lists everything (respecting `--full|--short|--summary`), `show <id>` prints one item's full rendered Markdown. These are the two commands nearly every other chapter's worked examples are built on top of.

**`search "<words>"`** — full-text-ish item search (distinct subsystem from the conversation-archive trigram search in Chapter 4 — this one searches item title/body/tags, not transcript prose) with `--type`, `--tag`, `--path`, `--status`, `--relation`, `--linked-to`, `--direction` filters. Real output:

```
$ node src/cli/index.ts search "budget" --limit 3
┌───────────────────────────────────────────────────────────────┬────────────┬────────┐
│ id                                                            │ type       │ status │
├───────────────────────────────────────────────────────────────┼────────────┼────────┤
│ ADR-markdown-plus-disposable-index                            │ adr        │ active │
│ CONST-zero-runtime-dependencies                                │ constraint │ active │
│ DEC-a-budget-is-chosen-by-simulating-it-and-carried-to-config │ decision   │ active │
└───────────────────────────────────────────────────────────────┴────────────┴────────┘

159 item(s) match; 3 shown. Raise the cap with --limit 159, or narrow the search.
```

Use case: "does something already say X" before writing a new item — the search-first half of the contradiction gate described in Chapter 3.

**`query "SELECT ..." [--json] [--limit <n>]`** — raw, capped (1000 rows), read-only SQL over the derived SQLite index. Real schema, discovered read-only:

```
$ node src/cli/index.ts query "SELECT name FROM sqlite_master WHERE type='table'"
schema_version, items, ledger, ledger_source, conversations, subagents, persisted, named,
conversation_prose, conversation_prose_data, conversation_prose_idx, conversation_prose_content,
conversation_prose_docsize, conversation_prose_config, prose_sources, anchors
```

```
$ node src/cli/index.ts query "SELECT id, status FROM items LIMIT 3" --json
{
  "rows": [
    { "id": "ADR-build-rather-than-adopt", "status": "active" },
    { "id": "ADR-markdown-plus-disposable-index", "status": "active" },
    { "id": "ADR-normative-vs-rationale-tiers", "status": "active" }
  ],
  "rowCount": 3, "truncated": false, "limit": 1000, "loadErrors": []
}
```

Note: the `items` table has no `category` column — `SELECT id, category FROM items` fails with `no such column: category`; category is encoded in the id's prefix and in a different projected column. Use case: ad hoc corpus analytics (e.g. "how many active `rule` items were authored by an agent") without leaving the CLI.

### Workflow — `ready`, `focus`, `carry`, `todo`, `inbox-promote`

**`ready`** — computes, on every run (nothing is cached, there is no stale "ready" state to go wrong), which `task` items have every `needs:` dependency satisfied, ranked by priority. Real output:

```
$ node src/cli/index.ts ready --limit 3
┌──────────┬─────┬───────┬──────────────────────────────────────────────────────────┐
│ task     │ pri │ state │ title                                                    │
├──────────┼─────┼───────┼──────────────────────────────────────────────────────────┤
│ budget/6 │ 1   │ todo  │ an edited budget shows what it was, and one control...   │
│ hooks/22 │ 1   │ todo  │ make mycontext autonomous from the first second: ...     │
│ recall/2 │ 1   │ todo  │ reconstruct a subject from a passage you copied, ...     │
└──────────┴─────┴───────┴──────────────────────────────────────────────────────────┘
59 ready of 63 open task(s)
```
It also surfaces open questions that block work, and separately counts (without listing) open questions that block nothing yet — a deliberate anti-noise design choice stated in the command's own output: *"a list that showed every question every time would train a reader to skip it."* This is `mycontext ready`, the CLAUDE.md-referenced mechanism that replaced the hand-maintained `reports/EXECUTION-BOARD.md`. Use case: "what can I pick up right now" at the start of a work session.

**`focus [<tag>…] [--show|--clear]`** — narrows what `select`/injection considers eligible, by tag/scope/category. `--show` when unset: `my_context: no focus is set — every eligible item is injectable.` Use case: working inside one subsystem (e.g. `focus ui`) so injection budget isn't spent on unrelated governing items.

**`carry <id> [--show|--clear]`** — a one-shot delivery marker, explicitly distinguished from `pin` in its own help text: `pin` is permanent (`always: true`), `carry` delivers an item at the *next* injection only and then forgets itself. Use case: "make sure the next session sees this one specific item" without permanently adding to the pinned set (see Chapter 2's budget/spare-band discussion for why permanent pins are expensive).

**`todo [--tag <t>] [--all] [--limit <n>]`** — the rationale-tier inbox. A todo is *never* injected in full and is not part of the review queue (`mycontext review` asks what should *govern*; a todo is pre-decision). Real output when empty:

```
$ node src/cli/index.ts todo --limit 3
my_context: no todo items.
Capture one the moment it occurs to you: `mycontext add todo "<what to do>"`. It takes no category
decision and no review.
```

**`inbox-promote <id> --to <cat>`** — the exit from the inbox: creates a real item under the target category, carries title/body/tags across, links back with a `derived_from` relation, and retires the todo as `deprecated` (nothing is deleted). Use case: a todo jotted mid-session turns out to be a real `known_issue` — promote it rather than re-typing it.

### Governance — `ack`, `audit`, `contribution`, `decay`

**`ack <id> <code>`** — records that a person has *ruled on* a `doctor` finding for an item, anchored to the item's content as it stood at ack time (so a later edit invalidates the ack). `ack --all --code <code>` bulk-acknowledges. Not run live here (it mutates the audit/ack state); read from `src/cli/commands/ack.ts`.

**`audit [--since T] [--item ID] [--op O] [--limit N]`** — the append-only run-time log of every mutation and hook action. Real output (`--limit 5`, redacted-length preserved):

```
$ node src/cli/index.ts audit --limit 5
my_context: 5 audit record(s), oldest first (most recent 5):
  09-12 19:29:29  subagent-stop-untyped  595db3b1    delivery=finished agent=a6eaa4e6a6a476775
                                                       type=<absent> (no agent_type on this firing...)
  ...
```
This is the same log Chapter 2's `governingSpill` and Chapter 11's contribution/decay figures are read back out of. Use case: "what actually happened in this session's hooks", forensic debugging of injection or a hook misfire.

**`contribution [--full|--short|--summary]`** — per-item delivery counts, read backwards out of the audit log, explicitly framed as a *baseline for change-over-time comparison* rather than a usage ranking. Real output:

```
$ node src/cli/index.ts contribution --short
my_context contribution — how often each item was actually delivered into a session, read backwards
out of the audit log. The log holds 2840 injection record(s) of 44844 total, naming 183 distinct
id(s); the corpus holds 1108 item(s), of which 158 could be chosen by `select` today.

A record is one DELIVERY, not one session: 1383 jit, 1376 subagent-start, 54 session-start, 25
compact-restore, 2 manual.
```
The command's own text is explicit that reading via `show` or MCP `get_item` leaves no trace here — contribution measures *injection*, not *use*. Use case: deciding whether an item earns its `always: true` pin, backed by a real delivery count rather than a hunch.

**`decay [--sessions N] [--all]`** — items not auto-injected in the last N sessions ("cold"), plus a separate "unrestricted" bucket (active + normative + no `scope`, so it competes for jit budget everywhere). Real output (this repo, today):

```
$ node src/cli/index.ts decay
cold (1) — not auto-injected in the window; check before acting:
  RULE-never-weaken-byte-identity  rule  never injected

unrestricted (124) — active and normative with no scope...
```
The command is explicit that "cold" is not evidence of being unused — only that `select` never picked it in the sampled window; reading via `show`/MCP looks identical to abandonment. Use case: candidate list for pruning or scoping, always paired with a manual check per the command's own warning — never acted on from this report alone. This is also the trigger-side instrumentation for the self-improvement loop (Chapter 11).

### Conversation & ingest — `ingest`, `ingest-apply`, `ingest-status`

`ingest <path>` emits an *extraction request* for a document — the agent that runs it is expected to be the extractor (it doesn't run an LLM extraction itself; it stages a request). `ingest-apply <id> --anchor <a>` turns extracted candidates into drafts. `ingest-status` lists sessions/progress (read-only). Source: `src/cli/commands/ingest.ts`, backed by `src/ingest/apply.ts`, `src/ingest/lock.ts`, `src/ingest/request.ts`, `src/ingest/session.ts`. Not run live (ingest/ingest-apply mutate); use case: turning a design doc or an old README into staged draft items instead of hand-typing them one by one.

### Relations — `link`

`link <from> <relation> <to>` — records a relation edge directly, added specifically because the equivalent existed only inside `edit --unlink` (removal) and there was no CLI spelling for *creating* one until an explicit owner instruction on 2026-09-04 ("support relation using the cli too", per the doc comment in `link.ts`). Relation vocabulary comes from `core/vocabulary.ts`'s `RELATION_TYPES`. Not run live (mutates); use case: recording that a `decision` `amends` an `adr`, or that a `task` `derived_from` a promoted `todo`.

### Ops — `config`, `registry`, `statusline`

**`config <name> --delete|--disable [--yes]` / `config <path> --set|--unset <value> [--yes]`** — the *only* CLI-driven writer of `.my_context/config.json`; every other change to that file today is a hand-edit. Per the doc comment in `config.ts`, citing an owner ruling (2026-09-04): custom categories may be `DELETE`d, shipped categories may only be `DISABLE`d (never deleted), writes take a backup first, and a change touching many items gets an explicit item-count warning before `--yes` is required. Deliberately kept narrower than the web UI's Configure screen, which only *composes* config text for a human to paste (Chapter 8) — `DEC-should-the-web-ui-be-allowed-to-write-config-json` is the governing decision for that split.

**`registry.ts`** registers the internal command-registration machinery itself (it is the file `registerCommand`/`CommandDef` live in) rather than exposing a user-facing `registry` command with its own verb set beyond what's already listed — treat it as CLI plumbing, not a distinct capability.

**`statusline [install|uninstall] [--yes]`** — an *opt-in* bridge that tees Claude Code's own context-usage figure out to a file the web UI's status screens can read (`core/audit-db.ts`'s `openProjection`/`syncProjection`, `core/context-occupancy.ts`). Off by default; a person opts in with `statusline install`. Use case: watching real context-window occupancy from the web UI (Chapter 8) instead of guessing.

---

## 4. Full reference: the MCP server

The server (`src/mcp/server.ts`) is a 60-line stdio entry point: it resolves the working directory (`CLAUDE_PROJECT_DIR` env var, falling back to `process.cwd()`), stamps a `codeIdentity` snapshot of exactly the modules reachable from it by import (so a stale-vs-fresh check can never accidentally implicate an unrelated CLI file — a false positive that was measured and fixed, per the file's own doc comment referencing an incident on 2026-08-27 where a copy ran an hour stale and misreported 719 of 736 items as checksum-mismatched), and serves `createRegistry(cwd, code)` over stdio via `createSession`/`serveStdio` (`src/mcp/protocol.ts`). Registered for Claude Code via `.mcp.json`:

```json
{
  "mcpServers": {
    "mycontext": {
      "type": "stdio",
      "command": "node",
      "args": ["--disable-warning=ExperimentalWarning", "${CLAUDE_PLUGIN_ROOT}/src/mcp/server.ts"]
    }
  }
}
```

`src/mcp/tools.ts` (2,728 lines) defines every tool. Grepping for `name: '...'` finds **26 tools**, matching the set already visible in this session's own tool list exactly:

| Tool | Backing core module(s) | What it does |
|---|---|---|
| `create_item` | `core/mutate.ts` (`createItem`) | Same creation path as CLI `add`, including the summary/contradiction gates (Chapter 3). |
| `update_item` | `core/mutate.ts` (`updateItem`) | Same as CLI `edit`. |
| `refresh_item` | — | Same as CLI `refresh`: re-snapshot a `reference` item from its source file through the gate. |
| `supersede_item` | `core/mutate.ts` (`supersedeItem`) | Same as CLI `supersede`. |
| `link_items` | `core/relations.ts` (`linkItems`) | Same as CLI `link`. |
| `get_item` | `core/item.ts` (`renderItem`) | Same as CLI `show`. |
| `query_items` | — | Read-only SQL, same engine as CLI `query`. |
| `list_drafts` | `core/select.ts` (`reviewQueue`) | Same underlying list as CLI `review list`. |
| `list_items` | `core/search.ts` (`filterItems`) | Same filtering engine as CLI `search`/`list`. |
| `ready` | `core/needs.ts` (`readyReport`) | Same as CLI `ready`. |
| `doctor` | `doctor/checks.ts` (`runChecks`) | Same as CLI `doctor`. |
| `load_context` | `core/select.ts` (`select`), `core/inject.ts` (`buildInjection`) | The MCP-side equivalent of what a hook injects — an agent without a shell can pull the same governing set directly. |
| `audit_log` | `core/audit.ts` (`readAudit`, `filterAudit`) | Same as CLI `audit`. |
| `mycontext_help` | `core/teach.ts` (`MCP_HELP_TOPICS`) | Same content family as CLI `help`. |
| `mycontext_examples` | — | Same as CLI `examples`. |
| `focus_context` | `core/focus.ts` | Same as CLI `focus`. |
| `ingest_document` | `ingest/request.ts` | Same as CLI `ingest`. |
| `decay_report` | `core/decay.ts` (`computeDecay`) | Same as CLI `decay`. |
| `list_ingest_sessions` | `ingest/session.ts` (`listSessions`) | Same as CLI `ingest-status`. |
| `create_lesson` | — | Same as CLI `lesson` (Chapter 11). |
| `stage_rule_candidates` | — | Same as CLI `lesson-stage` (Chapter 11). |
| `preview_pack_import` | — | The read-only preview half of CLI `pack import` (Chapter 12) — lets an agent see what a pack *would* stage without committing. |
| `status_report` | — | Same as CLI `status`. |
| `list_todos` | — | Same as CLI `todo`. |
| `read_procedure` | `core/procedure-stage.ts` (`STAGES`, `stageOf`), `core/progress.ts` | Same family as CLI `procedure`. |
| `ask_handover` | `core/handover-ask.ts` (`askHandoverNow`) | Same as CLI `handover ask`. |

No MCP tool wraps `carry`, `inbox-promote`, `config`, `registry`, `statusline`, `rules`, `restore`, `pack import` (only its *preview* has an MCP tool), `harden`/`soften`/`pin`/`unpin`, or the `conversation`/`export`/`ui` command families — those remain CLI/UI-only today. This is a real, verified asymmetry, not an oversight to paper over: several of the missing ones (`pin`, `restore --approve`, `pack import`) are exactly the mutating, human-judgment-gated operations this project is generally careful to keep a person in the loop for.

Worked example (constructed precisely from the `ready` tool's schema and its shared implementation with the CLI command — the MCP transport itself was not invoked live, since the registered server showed as disconnected in this session's own tool list, an unrelated connection issue, not a documentation gap):

```
tool: ready
args: { "limit": 3 }
→ same payload shape CLI `ready --json --limit 3` would print: a "ready" array of
  {task, pri, state, title}, plus counts of ready/open/held tasks and blocking open questions.
```

---

## What's NOT built / built but off

- `revision-view`, `format`, `context`, `injection` (the CLI helper, distinct from the injection *mechanism* in Chapter 2), `statusline-install`, `statusline-powerline` are **not independent commands** — they are internal modules other commands import. Documenting them as top-level surface would be inaccurate.
- The MCP surface has **no tool** for `carry`, `inbox-promote`, `config`, `registry`, `statusline`, `rules`, `restore`, `harden`/`soften`/`pin`/`unpin`, the `conversation` family, `export`, or `ui` — an agent needing any of those must go through the CLI (or, for `restore`/config-editing, a human).
- `pack import` has a full MCP *preview* (`preview_pack_import`) but no MCP *commit* path — committing a pack import is CLI/UI-only, consistent with keeping human judgment in the loop for corpus-altering imports.
- `mycontext help tools` / `help slash` are listed as `help` topics but were not independently verified in this chapter — see Chapter 12 for skills/slash-command coverage.

## See also

- [Chapter 1 — Items and the corpus](./01-items-and-corpus.md)
- [Chapter 2 — Injection](./02-injection.md)
- [Chapter 3 — Creation and the gates](./03-creation-and-gates.md)
- [Chapter 4 — The conversation archive](./04-conversation-archive.md)
- [Chapter 5 — Anchors](./05-anchors.md)
- [Chapter 6 — Retrieval](./06-retrieval.md)
- [Chapter 7 — Restore and handover](./07-restore-and-handover.md)
- [Chapter 8 — The web UI](./08-web-ui.md)
- [Chapter 10 — The product rule store](./10-rule-store.md)
- [Chapter 11 — The self-improvement loop](./11-self-improvement-loop.md)
- [Chapter 12 — Packs, export/import, procedures](./12-packs-export-import-procedures.md)
- [Chapter 13 — The testing discipline](./13-testing-discipline.md)
