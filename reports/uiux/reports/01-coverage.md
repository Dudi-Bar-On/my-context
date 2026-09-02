# Capability coverage — v2.0 web UI

**Owner's goal, verbatim:** *"let the user be able to view and control every single feature / capability."*

**Sources of truth read in full:** `docs/superpowers/specs/2026-08-16-web-ui-design.md` (1126 lines),
`docs/superpowers/specs/2026-08-18-v2-decisions.md` (324), `docs/design/web-ui-mockup.md` (135),
`docs/design/web-ui-mockup.html` (802), the three build plans
(`docs/superpowers/plans/2026-08-16-web-ui-{1,2,3}-*.md`), and the shipped source.

**Marks.** `[V]` = verified against source with a verbatim fragment cited. `[R]` = reasoned.

**What counts as "the UI" for the *exposed?* column.** The spec grades screens; the *plans* are the
only place a capability is actually named as reachable (an endpoint, a palette def, a screen module).
So a capability is **exposed** only if some plan gives it a route, a control or a rendering; the
mockup is graded separately because it is what implementers copy.

**Granularity, stated because the count depends on it.** One capability = one independently
user-reachable knob: a command surface, a flag, an MCP tool, an MCP parameter, a config key, a hook,
an item field, a vocabulary *set*, a slash command, or a state file. Counted this way:

| Group | Count | Exposed | Partial | Missing |
|---|---|---|---|---|
| CLI command surfaces (30 shipped + `audit replay-ledger` + 7 `review` subcommands − 1 parent + 3 planned `ui`/`statusline`/`statusline install|uninstall`) | 41 | 21 | 3 | 17 |
| CLI flags | 118 | 40 | 0 | 78 |
| MCP tools | 14 | 0 | 0 | 14 |
| MCP tool parameters | 62 | 0 | 0 | 62 |
| Config keys (4 top-level + 4 budget + 6 per-category) | 14 | 10 | 3 | 1 |
| Env vars read by `src/` | 6 | 0 | 0 | 6 |
| Hooks | 4 | 0 | 4 | 0 |
| Item fields (21 `Item` + 4 `Observation` + 2 `Relation`) | 27 | 8 | 4 | 15 |
| Vocabulary sets | 19 | 12 | 5 | 2 |
| Slash commands (`commands/*.md`) | 66 | 0 | 0 | 66 |
| Skills | 1 | 0 | 0 | 1 |
| `.my_context/` state files & dirs | 20 | 4 | 5 | 11 |
| **Total** | **392** | **95** | **24** | **273** |

`[V]` counts: `ls commands/*.md | wc -l` → 66; `ID_GRAMMAR`, `RELATION_TYPES`, `TOP_LEVEL_KEYS`,
`CATEGORY_KEYS`, `AUDIT_OPS`, `HELP_TOPICS` and the `Item` interface were each read in source.

---

## Inventory

Grouped by kind. Within each group, one row per capability (flags rolled up per command with the
per-flag verdict spelled out, because 118 separate flag rows is a worse artefact than 41 dense ones).

### A. CLI commands and their flags

`[V]` binary name: `package.json:7` · `"bin": { "mycontext": "./src/cli/index.ts" }`.
`[V]` the UI's only command surface is the palette catalogue:
`plans/…-web-ui-2-palette-and-work.md` Task 10 · `export const PALETTE = [` — 16 `kind: 'write'` defs
and 8 `kind: 'read'` defs, and its own comment pins the contract:
*"a def must never advertise a flag its command refuses."* The inverse — a command refusing to
advertise a flag it accepts — is unchecked, and that is where most of the loss below sits.

| Capability | Kind | Exposed? | Where | Note |
|---|---|---|---|---|
| `init` (no args; `--global` refused by name) | CLI write | **No** | — | `[V]` `index.ts:107` · `const INIT_USAGE = 'usage: mycontext init   (it takes no arguments)';`. Bootstrap paradox: the server needs a workspace to start, so `init` can only live on the no-workspace error page. |
| `add <category> <title>` — `--body --file --note --scope --tags --severity --yes` (7) | CLI write | **Yes** (7/7) | palette `add`; Work/overlap screen | `[V]` `index.ts:184` · `const ADD_VALUE_FLAGS = ['body', 'file', 'note', 'scope', 'tags', 'severity'];`. Palette def carries all seven + `overlap: true`. Best-covered command in the product. |
| `list [category]` — `--full --short --summary --json` (4) | CLI read | **Partial** | palette `list` → `endpoint: () => '/api/items'` | `[V]` detail flags absent; the UI renders one fixed shape. `/api/items` returns 8 of 21 item fields, so `--full`'s stanza (id,type,status,origin,layer,scope,title) is not reproducible. |
| `show <id>` (no flags) | CLI read | **Partial** | palette `show` → `/api/item/<id>` | `[V]` endpoint returns `{ item: Item; injection; usage }` — but **no screen renders it** (§ gap 1). |
| `rebuild` (silently swallows all args) | CLI write | **Yes** | palette `rebuild` | `[V]` `index.ts:811` · `run: (ws, _args, out) => cmdRebuild(ws, out)`. Classified write in the catalogue though absent from the deny recipe. |
| `help [topic]` | CLI read | **Yes** | palette `help` → `#/learn`; `/api/help/:topic` | `[V]` `src/help/index.ts:11` · `export const HELP_TOPICS: HelpTopic[] = ['categories', 'scope', 'capture', 'workflow'];` — all four routed, each with corpus cross-links. |
| `examples <category>` — `--short` | CLI read | **No** | — | `[V]` `index.ts:709` · `const EXAMPLES_USAGE = 'usage: mycontext examples <category> [--short]';`. No palette def, no endpoint, no screen. The one surface that teaches item *shape*. |
| `status` — 4 detail flags | CLI read | **Partial** | `/api/status`; `#/status` | `[V]` plan 1 Task 10 payload omits **ingest progress**, which `status`'s own summary advertises: `status.ts:506` · `summary: 'counts, review queue, ingest progress, decay and health'`. |
| `doctor` — `--quiet` + 4 detail (5) | CLI read | **Yes** | `/api/doctor`; `#/doctor` | `[V]` `apiDoctor` returns `runChecks` *"verbatim, unfiltered, ungrouped"*. Detail flags are a terminal concern. **But the screen is absent from the mockup.** |
| `decay` — `--sessions N --all` + 4 detail (6) | CLI read | **Partial** (1/6) | `/api/decay?window=N`; `#/decay` | `[V]` `decay.ts:14` · `const DEFAULT_WINDOW = 20;`. `--all` (show warm items) has no control; the palette's `decay` def declares `flags: []`. **Screen absent from the mockup.** |
| `search` — `--text --type --tag --path --status --relation --limit` + 4 detail (11) | CLI read | **Yes** (7/11) | palette `search` → `/api/search` | `[V]` `search.ts:43` · `const VALUE_FLAGS = ['text', 'type', 'tag', 'path', 'status', 'relation', 'limit'];` — all seven in the def. **But `relation` and `status` are `input: 'text'`, not enum pickers** (see D). |
| `query "SELECT …"` — `--json --limit --` (3) | CLI read | **No, by decision** | — | `[V]` spec §2 · *"**Therefore: no `/api` route accepts SQL.**"* Replaced by `/api/ask/corpus`'s 7 structured filters. A deliberate, recorded removal — but the CLI command still exists and the UI never says so. |
| `edit <id>` — `--title --body --scope --tags --severity --status --always --extra --unlink --yes` (10) | CLI write | **Partial** (9/10) | palette `edit`; Configure composes `mycontext edit --budget …` | `[V]` `edit.ts:61-63` · `const ALLOWED = [ 'title', 'body', 'scope', 'tags', 'severity', 'always', 'status', 'extra', 'unlink', 'yes', ];`. **`--unlink` is missing from the def** — and it is the only way to remove a relation anywhere in the product. |
| `pin` / `unpin` / `harden` / `soften` `<id> [--yes]` (4 cmds, 4 flags) | CLI write | **Yes** | palette ×4 | `[V]` `edit.ts:845` · `const NAMED_ALLOWED = ['yes'];`. Complete. |
| `supersede <id> --by <id>` — `--by --reason --yes` (3) | CLI write | **Partial** (1/3) | palette `supersede` | `[V]` `supersede.ts:26` · `const ALLOWED = ['by', 'reason', 'yes'];` vs the def's `flags: [{ name: 'by', … }]`. **`--reason` and `--yes` are missing.** `--yes` omission is not cosmetic: spec §2 calls it *"an explicit, greppable token in the transcript"*. |
| `refresh <id>` — `--yes` (1) | CLI write | **Partial** (0/1) | palette `refresh` (`flags: []`) | `[V]` `refresh.ts:43` · `const ALLOWED = ['yes'];`. Same class as `supersede`. |
| `repair` — `--yes` (1) | CLI write | **Yes** | palette `repair` | `[V]` `repair.ts:13` · `const REPAIR_FLAGS = ['yes'];`. |
| `audit` — `--since --until --item --session --kind --op --origin --limit --role --files --summary --items --sessions --json` (14) | CLI read | **Partial** | `/api/ask/audit` (8 filters), `/api/ask/summary` (3 reports), `#/watch` | `[V]` `audit.ts:26` · `const VALUE_FLAGS = ['since', 'until', 'item', 'session', 'kind', 'op', 'origin', 'limit', 'role'];`. `--files` (the on-disk log-segment rollup) has **no** equivalent — and it is the only view of rotation. No palette def for `audit` at all. |
| `audit replay-ledger` (hidden positional) | CLI write | **No** | — | `[V]` `audit.ts:297` · `if (args[0] === 'replay-ledger') {` — absent from `USAGE`, from the registration string and from `--help`. The UI is the natural place to make an undocumented mutator visible. |
| `focus [<tag>…]` — `--tag --category --scope --relations --clear --show --preview --json` (8) | CLI write+read | **Partial** (read only) | header focus popover (live / off) | `[V]` `focus.ts:38` · `const ALLOWED = ['tag', 'category', 'scope', 'clear', 'show', 'preview', 'relations', 'json'];`. The UI reads `readFocus(projectRoot)` and toggles the *preview*; it composes **no** `mycontext focus` command and offers no axis control. |
| `review` / `review list` — `--type` + 4 detail (5) | CLI read | **Partial** | `/api/review-queue`; `#/work` | `[V]` `review.ts:72` · `list: { allowed: [...DETAIL_FLAGS, 'type'], values: ['type'] },`. `--type` filter absent from the screen contract. |
| `review show <id>` (no flags) | CLI read | **No** | — | `[V]` `review.ts:73` · `show: { allowed: [], values: [] },`. The per-draft detail view — the thing a human reads before promoting — has no screen. |
| `review promote <id>` — `--scope --severity --always --yes` (4) | CLI write | **Yes** | palette | `[V]` `review.ts:75` · `promote: { allowed: ['scope', 'severity', 'always', 'yes'], values: ['scope', 'severity'] },` — matched exactly. |
| `review discard <id>` — `--yes` | CLI write | **Yes** | palette | `[V]` `review.ts:76`. |
| `review revisions [<id>]` — 4 detail | CLI read | **Yes** | `/api/revisions`; `#/work` | `[V]` per-field staleness rendered; the flagship screen of the compose-don't-write rule. |
| `review promote-revision <id>` — `--revision --force --yes` (3) | CLI write | **Yes** | palette + Work screen | `[V]` `review.ts:78` · `'promote-revision': { allowed: ['revision', 'force', 'yes'], values: ['revision'] },`. |
| `review discard-revision <id>` — `--revision --reason --yes` (3) | CLI write | **Yes** | palette + Work screen | `[V]` `review.ts:79`. |
| `ingest <path>` — `--anchor` (1) | CLI write | **No** | — | `[V]` `ingest.ts:40` · `out('usage: mycontext ingest <path> [--anchor <anchor>]');`. The entire document-ingest surface is invisible. |
| `ingest-apply <id>` — `--anchor --file --stdin` (3) | CLI write | **No** | — | `[V]` `ingest.ts:113` · `const usage = 'usage: mycontext ingest-apply <session-id> --anchor <anchor> (--file <path> | --stdin)';`. |
| `ingest-status` — 4 detail | CLI read | **No** | — | `[V]` `ingest.ts:357` · ``usage: `ingest-status ${DETAIL_USAGE}` ``. `.my_context/.ingest/*.json`, `*.applied.jsonl`, `*.rejected.jsonl` are unreadable from the UI. |
| `lesson "<text>" \| <id>` (no flags) | CLI write | **No** | — | `[V]` `lesson.ts:32`. The rule-derivation loop's entry point. |
| `lesson-stage <id>` — `--file` (`--stdin` advertised, unread) | CLI write | **No** | — | `[V]` `lesson.ts:102` · `out('usage: mycontext lesson-stage <LESSON-id> (--file <path> | --stdin)');`. |
| `lesson-accept <id> <key>` — `--title --scope --severity --directive` (4) | CLI write | **Partial** (0/4) | palette `lesson-accept` (`flags: []`) | `[V]` `lesson.ts:205` · `const [lessonId, key] = positionals(args, ['title', 'scope', 'severity', 'directive']);`. The four override flags are the whole point of the human approval step and none is offered. |
| `lesson-discard <id> <key>` | CLI write | **Yes** | palette | `[V]` `lesson.ts:312`. |
| `ui [--port N] [--no-open]` (2, planned) | CLI read | **No** | — | `[V]` plan 1 Task 15 · `mycontext ui [--port N] [--no-open]`. The UI does not describe its own server, port, idle window or token model anywhere on screen except the exit banner. |
| `statusline` / `statusline install` / `statusline uninstall` (planned) | CLI write | **No** | — | `[V]` `2026-08-18-v2-decisions.md` §6 · *"**There is no `statusline` command in shipped code.**"* Plan 3 Tasks 4–5. The UI *depends* on the bridge for its context number and never offers to install it. |

### B. MCP tools

`[V]` 14 tools, alphabetical and byte-stable: `src/mcp/tools.ts:977` ·
`const SORTED = [...SPECS].sort((a, b) => a.name.localeCompare(b.name));`.
`[V]` capabilities advertised are **tools only**: `src/mcp/protocol.ts:193` ·
`capabilities: { tools: { listChanged: false } },` — no prompts, no resources.

| Capability | Kind | Exposed? | Where | Note |
|---|---|---|---|---|
| `create_item` (18 params incl. 7 generated `extra` fields) | MCP write | **No** | — | `[V]` `tools.ts:451`, `tools.ts:474` · `...extraFieldSchema(DEFAULT_CONFIG),`. |
| `update_item` (9 params) | MCP write | **No** | — | `[V]` `tools.ts:507`. Its behaviour is *governed* by `agentEdits`, which the Configure screen edits — the UI shows the policy and never the thing it governs. |
| `refresh_item` (1) | MCP write | **No** | — | `[V]` `tools.ts:564`. |
| `supersede_item` (3) | MCP write | **No** | — | `[V]` `tools.ts:603`. |
| `link_items` (3) | MCP write | **No** | — | `[V]` `tools.ts:621`. **The only route to a relation** — there is no `mycontext link` CLI command (see *Cannot be exposed*, item 1). |
| `get_item` (1) | MCP read | **No** | — | `[V]` `tools.ts:639`. |
| `query_items` (7) | MCP read | **No** | — | `[V]` `tools.ts:658`. |
| `list_drafts` (2) | MCP read | **No** | — | `[V]` `tools.ts:693`. |
| `load_context` (0 params, and none may be added) | MCP read | **No** | — | `[V]` `tools.ts:734` · `schema: object({}),`. |
| `audit_log` (7) | MCP read | **No** | — | `[V]` `tools.ts:765`; note it takes `actor`, deliberately **not** `origin` (`tools.ts:780`), while the UI's Ask filter is spelled `origin` — a vocabulary the UI would have to reconcile. |
| `mycontext_help` (1) | MCP read | **No** | — | `[V]` `tools.ts:834`. |
| `mycontext_examples` (1) | MCP read | **No** | — | `[V]` `tools.ts:845`. |
| `focus_context` (5) | MCP write/read | **No** | — | `[V]` `tools.ts:877`; read when `preview: true`, write when axes or `clear` are given. |
| `ingest_document` (4 params + 9 candidate fields) | MCP write | **No** | — | `[V]` `src/mcp/tools/ingest.ts:126` · `export const INGEST_DOCUMENT_SCHEMA: Record<string, unknown> = {`. |
| `RESERVED_TOOLS` (the hiding mechanism) | MCP meta | **No** | — | `[V]` `src/help/index.ts:43` · `export const RESERVED_TOOLS: string[] = [];` — currently empty, so nothing is hidden. Worth stating on screen precisely because it *could* stop being empty. |
| No `delete_item`, by non-goal | MCP meta | **No** | — | `[V]` governed by `NOGOAL-no-agent-hard-delete`. An absence the UI should assert, not leave to inference. |

### C. Config keys

`[V]` `src/core/config.ts:328` · `const TOP_LEVEL_KEYS = ['profile', 'categories', 'budgets', 'watchedDocs'];`
— a **closed** list, so an unread key is unrepresentable. `[V]` `config.ts:197-199` ·
`const CATEGORY_KEYS = [ 'enabled', 'tier', 'description', 'prefix', 'agentEdits', 'scopePolicy', ];`.
`[V]` the file the deny hook names: `src/hooks/pre-tool-use.ts` ·
*"Configuration changes to `.my_context/config.json` are the user's to make — ask, do not edit"*.

| Capability | Kind | Exposed? | Where | Note |
|---|---|---|---|---|
| `profile` (`minimal` \| `standard`) | config | **Partial** | `/api/config` `meta.profiles`, `resolved.profile`; `#/status` | `[V]` `config.ts:432` · `const profile = (input.profile ?? 'standard') as ProfileName;`. Payload carries it; the spec's Configure bullet list (`scopePolicy`, `agentEdits`, `budgets`, `enabled`, `tier`) never names a profile *switcher*, and switching profile changes 13 categories at once — the single highest-blast-radius config change with no preview. |
| `budgets.pinned` / `.jit` / `.restored` / `.index` (4) | config | **Yes** | `/api/config`, `/api/config/preview`, `#/simulate`, `#/config` | `[V]` `config.ts:51` · `export const DEFAULT_BUDGETS: Budgets = { pinned: 6000, jit: 6000, restored: 8000, index: 1200 };`; mockup renders all four. |
| `watchedDocs` | config | **Partial** | `/api/config` `resolved.watchedDocs` | `[V]` `config.ts:74-78` · `export const DEFAULT_WATCHED_DOCS = [ 'docs/superpowers/specs/**', … ];`. In the payload, in no editor control. It is also the **only** on/off switch for a hook (`post-tool-use.ts:57` · `if (!matchesAnyGlob(relative, ws.config.watchedDocs)) return '';`). |
| `categories.<n>.enabled` | config | **Yes** | `#/config` (`enabled` diff of the governing set) | `[V]` spec §4 · *"**`enabled` and `tier`.** … Shown as a diff of the governing set, not as a warning."* |
| `categories.<n>.tier` (`normative` \| `rationale`) | config | **Yes** | `#/config`; `meta.tiers` | `[V]` `config.ts:272-274` (`isValidTier`). |
| `categories.<n>.agentEdits` (`allow` \| `review`) | config | **Yes** | `#/config`; `meta.agentEdits` | `[V]` `config.ts:93` · `export const AGENT_EDITS: AgentEdits[] = ['allow', 'review'];`. |
| `categories.<n>.scopePolicy` (`global` \| `required` \| `inert`) | config | **Yes** | `#/config`; `meta.scopePolicies` | `[V]` `config.ts:94` · `export const SCOPE_POLICIES: ScopePolicy[] = ['global', 'required', 'inert'];`. |
| `categories.<n>.prefix` (`/^[A-Za-z0-9]{1,12}$/`) | config | **Partial** | `/api/config` `resolved.categories[].prefix` | `[V]` `requirePrefix`, `config.ts:257-266`. In the payload; no control. It renames every future id **and file name**. |
| `categories.<n>.description` | config | **Yes** | `resolved.categories[].description` | `[V]` `config.ts:547-555`. |
| Custom (non-catalogue) category definition | config | **No** | — | `[V]` `config.ts:489-494` · *"To define a custom category it must declare both `tier` … and `description`."* Nothing in the UI creates one, and `/api/config/check` would validate it for free. |
| `extraFields` — **refused by name** in config | config | n/a | — | `[V]` `config.ts:205-212` · *"extraFields is not settable in config: it is declared by the built-in category catalogue"*. A refusal worth surfacing so a user does not try it. |
| `MYCONTEXT_WIDTH` / `MYCONTEXT_ASCII` / `MYCONTEXT_UNICODE` / `MYCONTEXT_DOC_LOCALE` / `CLAUDE_PROJECT_DIR` / `CLAUDE_PLUGIN_ROOT` (6) | env | **No** | — | `[V]` `format.ts:59-60`, `format.ts:103`, `help/index.ts:31`, `mcp/server.ts:14`. Mostly terminal-only; `CLAUDE_PROJECT_DIR` decides where the MCP server looks for `.my_context` and belongs on a diagnostics panel. |

### D. Hooks

`[V]` `hooks/hooks.json` is the only registration; four events, each `node "${CLAUDE_PLUGIN_ROOT}/src/hooks/<name>.ts"`.

| Capability | Kind | Exposed? | Where | Note |
|---|---|---|---|---|
| `SessionStart` (matcher `startup\|clear\|resume\|compact`, timeout 10) | hook | **Partial** | audit stream `kind: injection`, `op: session-start` | Its *actions* stream; the hook itself — matcher, timeout, whether it is installed — is never shown. |
| `PreToolUse` (matcher `Read\|Edit\|MultiEdit\|Write\|NotebookEdit`, timeout 10) | hook | **Partial** | audit `op: jit` and `op: deny`; `#/preview` `event=tool` | The **deny half** is the only non-fail-open path in the product and its four refusal reasons (`pre-tool-use.ts:87,100,108,114`) have no rendering. |
| `PreCompact` (no matcher, timeout 10) | hook | **Partial** | audit `kind: hook, op: pre-compact`; `#/preview` `event=compact` + `restore` | The restore snapshot `.my_context/state/<session>.restore.json` is not browsable. |
| `PostToolUse` (matcher `Write\|Edit\|MultiEdit`, timeout 5) | hook | **Partial** | audit `kind: hook, op: post-tool-use` | Its only knob is `watchedDocs`, which has no editor (C). Its nudge text is never previewed. |

### E. Item fields

`[V]` `src/core/types.ts:33-58` — 21 fields; `Observation` (`:21-26`) 4; `Relation` (`:28-31`) 2.
`[V]` `/api/item/:id` → `{ item: Item; injection; usage }` (plan 1 Task 11) — the whole record crosses
the wire. **No `screens/item.js` exists in any plan** — `[V]` the plans' screen modules are
`ask, configure, coverage, decay, doctor, graph, injected, learn, palette, preview, simulate, status, watch, work`.

| Capability | Kind | Exposed? | Where | Note |
|---|---|---|---|---|
| `id`, `type`, `title`, `status`, `always`, `scope` (6) | item field | **Yes** | `/api/items`, `/api/coverage`, every list | Plus derived `injected` + `phrase`. |
| `severity` (`hard` \| `soft`) | item field | **Partial** | composable via `add`/`edit`/`review promote --severity`; `pin`/`harden` | Writable, never *readable* — no list column, no detail view. |
| `tags` | item field | **Partial** | Work diff shows a `tags` row; `add --tags` | No tag browser, no tag facet, though `query_items`/`search` both filter on it. |
| `body` | item field | **Partial** | `/api/render` (injected bytes), Work diff | Never rendered as *the item's* body. |
| `origin` (`human`\|`agent`\|`ingest`) | item field | **Partial** | `/api/status` `byOrigin`; Ask audit `origin` filter | Aggregated only; not per item. |
| `observations` (+ `category`, `text`, `tags`, `context`) | item field | **No** | — | `[V]` `types.ts:53` · `  observations: Observation[];`. Written by `add --note` and by `create_item`; readable nowhere in the UI. |
| `relations` (+ `type`, `target`) | item field | **Partial** | `/api/graph` nodes/edges | Ego-graph only, radius ≤ 2, 60-node cap; there is no per-item relation list, and no way to *remove* one. |
| `sourceFile`, `sourceAnchor`, `sourceChecksum` (3) | item field | **No** | — | The reference/snapshot mechanism. `doctor` reports `source_drift` / `source_missing` / `source_anchor_missing` against them, so the finding is visible and the field it names is not. |
| `validFrom`, `validUntil` (2) | item field | **No** | — | `[V]` `types.ts:46-47`. Nothing reads or writes them in the UI. |
| `checksum` | item field | **No** | — | `repair` re-stamps it; the UI composes `repair` and never shows what is mismatched. |
| `extra` (`Record<string,string>`; 7 generated names) | item field | **No** | — | `[V]` `types.ts:50`; `[V]` `config.ts:312-318` generates `blocks, directive, impact, kind, likelihood, validate_by, validated_on`. `edit --extra key=value` is in the palette as a **free-text** input, so the seven names are neither offered nor validated. |
| `layer` (`project` \| `global`) | item field | **Partial** | `/api/ask/corpus?layer=`; `/api/status` `globalLayerDrafts` | The global workspace `~/.my-context` (`[V]` `workspace.ts:7` · `export const GLOBAL_DIR = path.join(homedir(), '.my-context');`) is not browsable at all. |
| `filePath` | item field | **No** | — | `[V]` `types.ts:57`. The one field that answers *"where do I go to edit this by hand"*, which is the product's documented escape hatch. |

### F. Vocabulary sets

| Capability | Kind | Exposed? | Where | Note |
|---|---|---|---|---|
| `Status` ×5 — `active, draft, superseded, deprecated, validated` | vocab | **Partial** | Ask corpus `status=`; `/api/status` `byStatus` | `[V]` `types.ts:2`. **Palette `edit` declares `{ name: 'status', input: 'text' }`** — free text where the CLI accepts 4 of 5 (`superseded` refused, `edit.ts:519-525`). A picker would be free. |
| `Severity` ×2 — `hard, soft` | vocab | **Yes** | palette `options: ['hard', 'soft']` (add/edit/review promote) | `[V]` `types.ts:3`. |
| `Tier` ×2 — `normative, rationale` | vocab | **Yes** | `/api/config` `meta.tiers` | `[V]` `types.ts:1`. |
| `Origin` ×3 — `human, agent, ingest` | vocab | **Yes** | Ask audit `origin=`; `byOrigin` | `[V]` `types.ts:4`. |
| `Layer` ×2 — `project, global` | vocab | **Partial** | Ask corpus `layer=` | `[V]` `types.ts:5`. |
| `RELATION_TYPES` ×8 — `derived_from, constrains, supersedes, blocks, mitigates, refines, relates_to, links_to` | vocab | **Partial** | graph edge `type` | `[V]` `src/core/vocabulary.ts:42-45`. **Palette `search` declares `{ name: 'relation', input: 'text' }`** — free text over a deliberately *closed* vocabulary. `[V]` `commands/link.md` presents it as a numbered list *"because it is closed on purpose: an open one produces `derived_from`, `derivedFrom` and `derived-from` in one corpus"*. The UI reintroduces exactly that. |
| Categories ×21 (13 normative, 8 rationale) + prefixes | vocab | **Yes** | `source: 'categories'` pickers; `#/config`; `#/learn` `categories` topic | `[V]` `src/core/categories.ts:19-86`. |
| `AGENT_EDITS` ×2, `SCOPE_POLICIES` ×3, `PROFILES` ×2 | vocab | **Yes** | `/api/config` `meta` | `[V]` `config.ts:93-94`, `categories.ts:113`. |
| `AUDIT_KINDS` ×4 — `mutation, injection, hook, focus` | vocab | **Yes** | Watch filters; Ask `kind=` | `[V]` `core/audit.ts:116`; mockup renders all four buttons. |
| `AUDIT_OPS` ×19 | vocab | **Partial** | Ask `op=` (enum-validated) | `[V]` `audit.ts:112-114`. **Watch filters by `kind` only**, so `deny`, `focus-set`, `focus-clear`, `compact-restore` etc. cannot be isolated in the live stream. |
| `AUDIT_ROLES` ×3 — `subject, injected, spilled` | vocab | **Yes** | `/api/ask/summary?report=items&role=` | `[V]` `audit.ts:42`. |
| Doctor codes ×19 | vocab | **Yes** | `#/doctor` groups by `code` | `[V]` 19 occurrences of `code: '…'` in `src/doctor/checks.ts` (`index_missing, index_unreadable, index_stale, orphan_relation, source_missing, source_drift, source_anchor_missing, dead_scope, not_writable, index_not_ignored, session_id_mismatch, scope_policy_inert, scope_policy_required, unknown_category, audit_log_size, corpus_size_fallback_ceiling, check_failed` + 2). |
| Doctor levels ×3 — `error, warn, info` | vocab | **Yes** | `#/doctor` | `[V]` `doctor.ts:34` · `return counts.errors > 0 \|\| loadErrorCount > 0 ? 1 : 0;`. |
| `HELP_TOPICS` ×4 | vocab | **Yes** | `#/learn` | `[V]` `help/index.ts:11`. |
| Select events ×4 — `session-start, compact, tool, manual` | vocab | **Yes** | `#/preview` `<select id="evsel">` | `[V]` mockup renders all four. |
| Seen tiers ×3 — `pinned, jit, restored` (+ `index`, `snapshot` audit tiers) | vocab | **Partial** | `#/injected` chips | `[V]` `seen-file.ts:37` · `const TIERS = new Set<string>(['pinned', 'jit', 'restored']);`. `index` and `snapshot` tiers appear in audit records only. |
| `ID_GRAMMAR` | vocab | **No** | — | `[V]` `vocabulary.ts:68` · `export const ID_GRAMMAR = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;`. Per `2026-08-18-v2-decisions.md` §7 it becomes a **load-boundary rejection** — an item can now be *excluded and its file named*. The UI has no rendering for an excluded item. |
| Injection phrase set (`injection()`) | vocab | **Yes** | `phrase` on every item row | `[V]` `cli/commands/injection.ts:42`; six distinct phrases incl. `PINNED — injected in full at every session start, regardless of scope`. |
| Ingest candidate schema (9 fields) | vocab | **No** | — | `[V]` `src/ingest/schema.ts:123-131`. |

### G. Slash commands, skills, state files

| Capability | Kind | Exposed? | Where | Note |
|---|---|---|---|---|
| 66 `commands/*.md` slash commands (21 `add-*`, 21 `list-*`, 24 others incl. `link`, `unlink`, `promote`, `discard`, `LoadMyContext`) | slash | **No** | — | `[V]` `ls commands/*.md \| wc -l` → 66; `[V]` `src/plugin/commands.ts` · *"The user-facing slash-command surface, generated from the SAME resolved config"*. For most users **this is the product's primary surface**, and the UI never names it. |
| `skills/mycontext/SKILL.md` | skill | **No** | — | `[V]` one skill, steering toward `create_item`. |
| `.my_context/config.json` | state | **Yes** | `/api/config` reads it **fresh from disk** each call | `[V]` plan 2 Task 6 · *"read FRESH from disk on every call"*. |
| `.my_context/items/<type>/<ID>.md` | state | **Partial** | `/api/items`, `/api/item/:id` | `filePath` never shown, so the file is not locatable from the UI. |
| `.my_context/.index.db` | state | **Partial** | `doctor` codes `index_missing/unreadable/stale/not_ignored` | No direct rendering; `rebuild` composable. |
| `.my_context/state/focus.json` | state | **Partial** | header focus popover reads it | Not settable (A, `focus`). |
| `.my_context/state/<key>.seen.jsonl` | state | **Yes** | `#/injected`, `/api/select` `seen` | `[V]` spec §3 pins `readSeen(root, ledgerKey(...))`, and *"An unreadable seen file is a disclosed state, not an empty one."* |
| `.my_context/state/<session>.restore.json` | state | **Partial** | `event=compact&restore=…` | Contents not browsable. |
| `.my_context/.audit/audit.jsonl` + rotated segments | state | **Partial** | `#/watch`, `/api/ask/audit` (via the SQLite projection) | `[V]` spec §5 · *"JSONL is the truth and SQLite is a disposable projection."* `audit --files` (segment rollup) has no equivalent, so **rotation is invisible**. |
| `.my_context/.audit/audit.db` projection freshness | state | **Yes** | `/api/ask/audit` `projection: { stateBeforeSync, syncedAt }`; 503 on sync failure | `[V]` spec §5 · *"a query behind its log catches up first or reports that it is behind."* Good. |
| `.my_context/.revisions/revisions.jsonl` | state | **Yes** | `/api/revisions`, `#/work` | |
| `.my_context/.staging/<lessonId>.json` | state | **No** | — | The lesson pipeline (D above). |
| `.my_context/.ingest/<id>.json` / `.applied.jsonl` / `.rejected.jsonl` (3) | state | **No** | — | Especially `.rejected.jsonl`: the record of what ingest refused, which nothing else holds. |
| Lock files (`revisions.lock`, `apply.lock`) | state | **No** | — | A stuck lock is a real support case with no diagnosis surface. |

---

## Gaps, ranked

Ranked by *"how much of the owner's sentence does closing this recover"*, not by effort.

**1. There is no item screen. 15 of 27 item fields are unrenderable anywhere. — L(rendering)/S(server)**
`/api/item/:id` already returns `{ item: Item; injection; usage }` `[V]` (plan 1 Task 11), and the
plans' fourteen screen modules contain no `item.js` `[V]`. So the data crosses the wire and dies in
the client. `observations`, `extra`, `sourceFile`/`sourceAnchor`/`sourceChecksum`, `validFrom`/
`validUntil`, `checksum`, `filePath`, `body`, `severity`, `origin`, `layer` have **no rendering**.
`[R]` Every screen in the product links to items — the coverage detail pane, the graph, the preview's
delivered and spilled tables, doctor findings, the audit stream — and every one of those links has
nowhere to land. **Screen: new `#/item/:id`.** It is the missing hub, and it is cheap: one module over
an endpoint that exists.

**2. The entire MCP surface — 14 tools, 62 parameters — is absent. — M**
`[V]` No plan, no route, no screen mentions a tool. Yet the Configure screen edits `agentEdits`,
whose only effect is on `update_item` `[V]` (`mutate.ts:499-500`), and `scopePolicy: 'required'`
changes what `create_item` refuses. `[R]` The UI therefore lets a user tune the agent's permissions
without ever showing the agent's surface — the half of the product a solo developer *cannot* inspect
from a terminal, because the tools are only reachable over stdio from inside a Claude session.
This is the strongest untaken *"a terminal cannot do this"* claim left in the design.
**Screen: new `#/agent`**, under a new nav group — the 14 tools, read/write class, full schema,
which `agentEdits` gate applies to each, plus the two deliberate absences (`RESERVED_TOOLS` is empty
`[V]` `help/index.ts:43`; no `delete_item` by non-goal).

**3. The palette catalogue covers 21 of 41 command surfaces and 40 of 118 flags. — M**
`[V]` `PALETTE` has 16 write + 8 read defs. Missing outright: `focus`, `ingest`, `ingest-apply`,
`ingest-status`, `lesson`, `lesson-stage`, `examples`, `audit`, `audit replay-ledger`, `init`,
`query`, `review show`, `edit --unlink`, `ui`, `statusline`. Missing flags on defs that *are* present:
`supersede --reason --yes` `[V]` (`supersede.ts:26`), `refresh --yes` `[V]` (`refresh.ts:43`),
`lesson-accept --title --scope --severity --directive` `[V]` (`lesson.ts:205`), `decay --sessions --all`,
`review list --type`. `[R]` The catalogue's own test asserts one direction only — *"a def must never
advertise a flag its command refuses"* — so under-advertisement is unpoliced. **Screen: `#/palette`
(exists in plan 2 Task 12).** Add the inverse test: every `refuseUnknownFlag` allow-list in
`src/cli/commands/` is reachable from some def, or is listed as a deliberate omission.

**4. `mycontext focus` cannot be set or cleared from the UI. — S**
`[V]` `focus.ts:38` declares eight flags; the UI composes none of them. It *reads* focus
(`readFocus`), previews with and without it, and renders `Selection.focus`'s disclosure — all
correct. But focus is the single largest lever over what Claude sees (`[V]` spec §3: *"`select()`
applies focus before every tier and before budgeting"*), the file is deny-hook-protected
`[V]` (`pre-tool-use.ts:100`: *"`state/focus.json` is the session focus, and it decides what
my_context injects"*), and the UI already has the axis pickers it would need — tags, categories and
scope globs are the same pickers the palette builds for `add`. **Screen: the header focus popover
gains a "compose a focus" panel**, or a `focus` palette def. `--preview` maps onto the existing
preview; `--relations` (the dangling-relation classification) has no equivalent anywhere.

**5. The mockup ships 10 of the plans' 14 screens, and it is what implementers copy. — S**
`[V]` mockup nav: `preview, coverage, simulate, injected, work, config, watch, ask, status, learn`.
`[V]` plan 1's `SCREENS` map plus plan 2's additions: `preview, simulate, injected, coverage, graph,
status, doctor, decay, learn, work, palette, configure, watch, ask`. **Missing from the mockup:
`doctor`, `decay`, `graph`, `palette`** — three of which the spec grades ✅, and one of which
(`palette`) is the *only* place a write is composed for anything other than a revision.
`[R]` The mockup's own companion doc warns *"An implementer building a screen should scan this list
before copying anything"* — but the list does not mention the four absent screens.
**Fix: regenerate the mockup nav to 14 entries.**

**6. 66 slash commands and the skill are invisible. — S**
`[V]` `ls commands/*.md` → 66, generated from resolved config `[V]` (`src/plugin/commands.ts`).
`[R]` For a Claude Code plugin, `/mycontext:add-rule` is the surface most users touch first, and the
UI's composed commands are all `mycontext …` shell strings. **Screen: `#/palette` gains a second
composed form per def** — the slash equivalent beside the shell one — which is nearly free because
both are generated from the same category set.

**7. Two closed vocabularies are offered as free text. — S**
`[V]` palette `search` declares `{ name: 'relation', input: 'text' }` against an 8-member closed
`RELATION_TYPES` `[V]` (`vocabulary.ts:42-45`), and palette `edit` declares
`{ name: 'status', input: 'text' }` against 5 statuses of which the CLI refuses one
`[V]` (`edit.ts:519-525`). `[R]` This is the defect `commands/link.md` was written to prevent, in a
new medium. **Screen: `#/palette`; `options: [...]` already exists in the def grammar.**

**8. The hooks are shown only as their side effects. — M**
`[V]` four hooks in `hooks/hooks.json`; the UI streams their audit records and never shows the hooks.
No matcher, no timeout, no "is this installed", no deny-reason preview, no `watchedDocs` editor.
`[R]` The commonest failure a user hits is *"mycontext isn't injecting"*, and its answers live in
four places (hook registration, `session_id_mismatch` doctor code, `watchedDocs`, `focus`).
**Screen: a `#/config` tab, or a new `#/hooks`** — four rows, each with its matcher, its timeout, its
audit `op`, its last firing time from the projection, and the config key that gates it.

**9. `watchedDocs`, `profile`, `prefix` and custom categories have no editor control. — S**
`[V]` all four are in `/api/config`'s payload; `[V]` spec §4's Configure bullets name only
`scopePolicy`, `agentEdits`, `budgets`, `enabled`, `tier`. `[R]` `profile` is the highest-blast-radius
key in the file (it re-decides 13 `enabled` flags at once) and `/api/config/check` would preview it
for free. **Screen: `#/config`.**

**10. The audit surface loses `--files` and `--role`, and Watch cannot filter by `op`. — S**
`[V]` `audit.ts:26` declares nine value flags; `/api/ask/audit` takes eight and `/api/ask/summary`
carries `role`; **`--files` has no equivalent**, so log rotation (8 MiB, `[V]` `audit.ts:245`
`AUDIT_MAX_BYTES`) is invisible. `[V]` the mockup's Watch filters are `all/mutation/injection/hook/focus`
— `kind` only, over a 19-member `AUDIT_OPS`. **Screen: `#/watch` gains an `op` facet; `#/status` or a
diagnostics panel gains the segment rollup.**

**11. The ingest and lesson pipelines are entirely absent. — M**
`[V]` `ingest`, `ingest-apply`, `ingest-status`, `lesson`, `lesson-stage` have no def, route or screen;
`[V]` `.my_context/.ingest/<id>.rejected.jsonl` holds the only record of refused candidates.
`[R]` Both are two-phase agent/human loops — exactly the shape the review queue's diff-then-paste
treatment was designed for. **Screen: `#/work` gains two more queues**, beside drafts and revisions.

**12. The global layer is not browsable. — M**
`[V]` `workspace.ts:7` · `export const GLOBAL_DIR = path.join(homedir(), '.my-context');`;
`[V]` `/api/status` reports `globalLayerDrafts` as a bare number. `[R]` A user with global items has
no way to see which ones are merged into this project. **Screen: a layer facet on `#/item`/lists.**

**13. `docs/design/web-ui-mockup.md` is stale against its own `.html`. — S**
`[V]` the `.md` says *"the mockup opens on Status"*, *"no focus anywhere"* and *"the query builder
shows SQL as the input"*; `[V]` the `.html` lands on `data-p="preview"` with `aria-current="true"`,
ships a `#focuspop` with live/off options, and renders *"**Why not a SQL box.**"* prose in Ask.
It also still lists *"Global search + ⌘K"* and *"Toast notifications"* as divergences the current
file no longer has (`[V]` the HTML comments read *"No global search and no ⌘K"*).
`[R]` The regeneration required by `2026-08-18-v2-decisions.md` §8 item 4 evidently landed in the
HTML and not in the companion. A document whose stated purpose is *"a mockup that implies capability
the product does not have is this project's characteristic defect"* now asserts **absences** that do
not hold — the same defect it already corrected once, in its own 2026-08-18 note about the 0.55 ms p95.

---

## Cannot be exposed directly

The mutator-free rule `[V]` (spec §2: *"No `/api` route calls `createItem`, `updateItem`,
`supersedeItem`, `linkItems`, `unlinkItems`, `stageRevision`, `promoteRevision` or `discardRevision`,
directly or transitively"*) blocks every write. The treatment is compose-and-copy `[V]`
(*"composed and copied to the console … with the on-screen note the owner asked for saying plainly
that this is a write and must be run in your own shell"*). Most writes compose cleanly. These do not,
and each needs a named treatment.

**1. `link` — the one write with no shell form at all.**
`[V]` there is **no `mycontext link` CLI command** (the 30 registered commands do not include one);
`[V]` `commands/link.md` says *"Call the `link_items` tool on the `mycontext` MCP server"*. So the
composed-command treatment has nothing to compose. `[V]` Spec §2 nonetheless lists it —
*"Promote, discard, edit, supersede, capture, **link**, unlink, and every configuration change are
composed and copied to the console"* — which is not achievable as written.
**Treatment:** compose the **slash command** `/mycontext:link <from> <relation> <to>` with the closed
8-member picker, plus the exact `link_items` JSON for a user who prefers to ask the agent directly.
Label it *"this runs through Claude, not your shell"* — a different sentence from the write note,
because the deny rules do not apply to it and the user should know that.

**2. `unlink` — a two-word flag the composer cannot emit.**
`[V]` the only route is `mycontext edit <id> --unlink <relation> <target>` `[V]` (`edit.ts:377`:
`if (args[i] !== '--unlink') { rest.push(args[i]); continue; }`, and `edit.ts:371-375` refuses the
`--unlink=` form). `[V]` `commandFor` emits only `--name value` or bare `--name`, so a two-word flag
is unrepresentable in the current def grammar.
**Treatment:** extend the def grammar with `words: 2`, and copy `commands/unlink.md`'s three-step
choreography verbatim into the screen — show the relations the item actually carries, let the user
pick, compose without `--yes` first so the CLI prints its own preview, then compose with `--yes`.
Also render the two relations that **cannot** be removed (`supersedes`, `superseded_by`).

**3. `config.json` — refused to agents by the product's own hook.**
`[V]` `pre-tool-use.ts:97` refuses with *"Configuration changes to `.my_context/config.json` are the
user's to make — ask, do not edit"*. `[V]` spec §4: *"a UI that wrote it would be arguing with a rule
this product enforces against its own agent."*
**Treatment (already specified, keep it):** emit the resulting `config.json` **or the minimal diff**,
with `/api/config/check`'s `dropped[]` findings shown beside it — the loader's silences named
(`budgets.jit` kept at default, a `watchedDocs` non-string dropped, an unknown top-level key never
read). That last part is the screen's real value and must not be cut.

**4. `focus` — deny-hook-protected state, and the only lever with a *live* effect.**
`[V]` `pre-tool-use.ts:100` refuses direct writes to `state/focus.json`: *"No rebuild regenerates it"*.
**Treatment:** compose `mycontext focus --tag … --category … --scope …` and `mycontext focus --clear`,
and — because focus has a genuine read-only preview in the CLI (`--preview`, `[V]` `focus.ts:148`) —
render the cost *before* the paste: items hidden, hard items never hidden, relations left dangling.
That preview is a pure function of items and focus, so it needs no write and it is exactly the
Configure screen's pattern applied to the other narrowing input.

**5. `ingest-apply` and `lesson-stage` — commands whose argument is a file the UI cannot write.**
`[V]` both read a JSON payload from `--file <path>` or stdin (`ingest.ts:123`, `lesson.ts:111`).
The UI cannot create that file.
**Treatment:** render the payload in a copy block **and** compose the heredoc form
(`mycontext ingest-apply <id> --anchor <a> --stdin <<'JSON' … JSON`) so one paste does both. Guard the
id against `ID_GRAMMAR` before it is echoed — `[V]` `2026-08-18-v2-decisions.md` §6.1 demonstrates a
`DEC-$(echo SUBSTITUTED)` id reaching a copy-paste-ready command, and *"the substitution runs in the
user's own interactive shell, where none of the fourteen deny rules apply"*. **Every composed command
in the UI inherits that hazard**, so the composer must validate every id it interpolates, not only
this one.

**6. `init` — the bootstrap the server cannot survive without.**
`[V]` `workspace.ts:17-25` discovers `.my_context` by walking upward; with none, there is no corpus,
no config and no db path.
**Treatment:** the no-workspace state is a first-class page, not a 500 — one sentence and a copyable
`mycontext init`, in the same shape as `#/coverage`'s empty state
(`[V]` mockup: *"Nothing governs this project yet. That is the normal state of a new workspace, not a
wall of warnings."*).

**7. `rebuild`, `repair`, `audit replay-ledger` — derived-state rewrites.**
All three only rewrite disposable projections `[V]` (spec §5: *"deleting the database loses nothing"*),
so the risk is low and the rule still applies.
**Treatment:** compose, with the note distinguishing *"this rewrites a derived file"* from
*"this changes your corpus"*. `replay-ledger` additionally needs **naming**, since it is undocumented
`[V]` (`audit.ts:297`), and a UI that lists it is the cheapest documentation it will ever get.

**8. `statusline install` / `uninstall` — writes another product's settings.**
`[V]` spec §8 risk row: the installer *"prints the existing setting and what it would replace it with,
and asks, before writing"*.
**Treatment:** the UI shows the *current* `statusLine` setting it would replace and composes the
install command; it never writes. It must also render the **not-installed** state honestly, because
the context number the strip shows depends on it `[V]` (spec §7: *"without the bridge, it shows only
what mycontext injected and says so"*).

**9. The 14 MCP tools — not writes the user runs at all.**
`[R]` These execute inside a Claude session over stdio; there is no shell string and no HTTP route.
**Treatment:** an `#/agent` screen that is *documentation with your corpus joined in* — the same
conditional-pass shape §4 grants Learn. For each tool: its schema, whether `agentEdits` will stage or
apply its result **for each of your 21 categories**, and how many times it has fired, from
`AUDIT_OPS` in the projection. That join is unavailable in a terminal, which is what earns the screen.

---

## Headline

The UI as specified exposes **95 of 392 capabilities cleanly and misses 273**, and the misses are not
scattered — they are three whole surfaces: the 14 MCP tools with their 62 parameters, the 66 slash
commands, and the item record itself, of which 15 of 27 fields have no rendering anywhere because no
plan contains an item screen even though `/api/item/:id` already returns the whole record. The
command palette, which is the product's answer to "control every feature", carries 21 of 41 command
surfaces and 40 of 118 flags, and its one test polices only over-advertisement — so the gap is
structurally invisible. Closing the top three (an item screen, an agent screen, and an inverse
palette-coverage test) recovers most of the owner's sentence for roughly one wave of work.
