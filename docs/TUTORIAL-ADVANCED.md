# my_context — the tutorials, advanced tier

**This page moved.** It used to be one long advanced guide. The tutorials are
now **one file per feature**, listed in `docs/tutorials/manifest.json` and served
by the product itself — open the web UI (`mycontext ui`) and read them on the
**Tutorials** screen, or read the Markdown directly in `docs/tutorials/`.

This page stays so that an existing link or search lands somewhere useful. It is
an index, not a dead end.

Assumes you have worked through [the basic tier](./TUTORIAL.md): you can capture an
item, you have seen one arrive on a file touch, and you know normative from
rationale.

---

## The advanced tier — eighteen features

**What arrives, and why**

- [See what my_context actually injected, and why](./tutorials/injection-tiers.md)
  — the four tiers, the restored tier, and the gate that decides.
- [Preview what a query would inject, and pull back what spilled](./tutorials/injection-preview-and-spilled-items.md)
  — the six gates in order, first-fit spilling, and `carry`.
- [See which files and areas your corpus actually covers](./tutorials/scope-and-coverage.md)
  — scope globs, `scopePolicy`, and the coverage tree.
- [Simulate a budget before you commit to it](./tutorials/budgets-and-the-simulator.md)
  — five budgets, and why raising one can evict an item.
- [Narrow what gets injected into this session](./tutorials/narrowing-a-session-focus.md)
  — focus on tags, categories and scope, and what it discloses.
- [Carry work from one session into the next](./tutorials/sessions-and-continuity.md)
  — naming a session, and what a carry actually carries.

**Deciding what governs**

- [Review a pending change before it governs](./tutorials/revisions-and-the-review-queue.md)
  — drafts, revisions, per-field staleness, and the trust boundary precisely.
- [Turn an incident into a lesson, staged before it governs](./tutorials/lessons-staging-and-promotion.md)
  — the derivation request, and the stop in the middle.
- [Pull items out of a document you already wrote](./tutorials/ingesting-and-refreshing-from-a-source-file.md)
  — ingest chunk by chunk, and refresh a tracked document.
- [Configure how my_context behaves for this project](./tutorials/configuration.md)
  — profiles, tiers, `scopePolicy`, `agentEdits`, budgets, watched documents.

**Keeping the corpus honest**

- [Find what stopped mattering](./tutorials/decay-finding-what-stopped-mattering.md)
  — cold, never-injected, and pinned-and-cold.
- [Detect and repair a corpus that drifted from disk](./tutorials/corpus-integrity-detecting-and-repairing-drift.md)
  — item drift, source drift, index drift, and the three remedies.
- [Watch what my_context is doing, live](./tutorials/the-audit-log-live-stream.md)
  — six record kinds, `--origin`, `--role`, and the only record of a spill.
- [Link two items, and see how your corpus connects](./tutorials/linking-items-and-the-relations-graph.md)
  — eighteen relation types, and the ego-graph.

**Moving it around, and running it**

- [Start a new project from a template pack](./tutorials/template-packs.md)
- [Export your corpus, and import it somewhere else](./tutorials/export-and-import-your-corpus.md)
- [Write and run a procedure](./tutorials/procedures.md)
- [Show my_context state in your terminal's status line](./tutorials/the-status-line.md)

---

## Appendix — reference

**Injection tiers:** pinned · index · jit · restored. Rationale reaches none of
them; it appears as a bare count. `continuity` is a fifth budget rather than a
fifth tier — the ceiling on handover text after a compaction.

**The 16 normative categories:** `constraint` `invariant` `rule` `requirement`
`standard` `pattern` `glossary` `instruction` `non_goal` `open_question`
`runbook` `procedure` `environment` `known_issue` `exception` `contract`

**The 13 rationale categories:** `adr` `decision` `lesson` `tradeoff`
`assumption` `edge_case` `risk` `measurement` `reference` `plan` `task`
`todo` `note`

**Statuses:** `draft` · `active` · `validated` · `deprecated` · `superseded`.
Only `active` is injected.

**Default budgets:** `restored` 8000 · `pinned` 6000 · `jit` 6000 ·
`continuity` 2000 · `index` 1200. Override per tier under `budgets` in
`.my_context/config.json`.

**Profiles:** `standard` (all 29 categories) and `minimal` (8).

**The MCP surface:** 25 tools. `load_context` (what would be injected now),
`create_item` (normative → draft; rationale → active), `update_item` (may be
staged as a revision under `agentEdits: "review"`), `query_items`, `get_item`,
`list_items`, `list_todos`, `focus_context`, `ingest_document`, `list_drafts`,
`supersede_item` (refused for a governing normative item), `audit_log` (its
filter parameter is `actor`, where the CLI says `--origin`), `decay_report`,
`doctor`, `ready`, `status_report`, `refresh_item`, `link_items`,
`create_lesson`, `stage_rule_candidates`, `read_procedure`,
`list_ingest_sessions`, `preview_pack_import`, `mycontext_help`,
`mycontext_examples`. There is **no** `delete_item`, by design: deletion is
yours alone; an agent may supersede or deprecate, both reversible and both
leaving a trail.

**Hooks:** eighteen registered events today — see
[README §5's hook table](./../README.md#5-using-it) for the full list, what fires
each one, and its timeout. That table is re-derived from `hooks/hooks.json` on
every test run, so it is the one to trust.

**Authority:** `mycontext help <command>` prints the usage the code enforces. If
it and the README disagree, the command is right.
