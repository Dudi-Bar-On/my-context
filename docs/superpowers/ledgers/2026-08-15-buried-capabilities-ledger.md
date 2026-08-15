# SDD ledger — plan: docs/superpowers/plans/2026-08-15-buried-capabilities.md

Spec: `docs/superpowers/specs/2026-08-15-reference-and-catalogue-design.md` — §5, §5b, §5c.
Branch: `docs/buried-capabilities`, worktree `.claude/worktrees/my-context-plan4`.

## Rulings

**R1 — the custom-category example blocks are hand-verified, not generated.** The example harness runs
every marker against one shared fixture (`materializeDocFixture`), and declaring a custom category in
that fixture would rewrite the generated `help categories` block, whose whole job in §6 is to enumerate
the 17 categories the `standard` profile enables. There is also no CLI command that writes
`config.json`, so a `&&`-chained marker cannot create the category inside an example run either.
Extending the materializer to a second fixture config would change `runExampleInFixture`'s contract and
the marker format for one block. §6 already carries a dozen hand-verified `text` blocks
(`budgets`, `watchedDocs`, `enabled`), so this is the section's existing convention rather than a new
exception. *Cost if wrong:* these blocks can go stale without a test noticing — mitigated by an HTML
comment in both documents that says so and names the date they were produced.

## Task log

**Task 1 — fixture prerequisite.** `606079b`, `eb99218`. (Landed before this ledger existed.)

**Task 2 — custom categories.** `README.md` §6 gains "Categories you define yourself", placed
immediately after "What each category means"; `docs/README.he.md` mirrors it. 1829 tests, 1828 pass,
1 POSIX-only skip.

Verified by execution in a scratch workspace, not from the survey's report:

- A name absent from the catalogue, declared with `tier` + `description`, becomes a first-class
  category. `mycontext add security_control …` created `SECURI-all-admin-endpoints-require-mfa`; it
  appears in `help categories`, `list`, `examples`, `doctor`, the session index, just-in-time
  injection on `src/admin/**` (PreToolUse hook), and pinned injection after `mycontext pin`. The MCP
  `create_item` tool accepts it and lands the agent's version as a draft.
- Prefix derivation: first six `[a-z0-9]` of the name, uppercased. `security_control` → `SECURI-`.
- `prefix` on a **built-in** override is accepted and silently ignored — `{"rule":{"prefix":"POLICY"}}`
  loads clean and ids stay `RULE-`. `resolveConfig` reads `override.prefix` only in the
  custom-category branch (`src/core/config.ts:241`); no branch handles it for a built-in. Documented
  as a defect rather than a capability. Tracked as backlog item "Config overrides silently drop
  extraFields and prefix".
- Two custom names sharing their first six alphanumerics (`standard_ops`, `standardize`) resolve to
  the same prefix with no warning. Documented as the reason to set `prefix`.
- `extraFields: []` is hardcoded for a custom category (`config.ts:245`) and there is no config key to
  declare one. `create_item` **refuses** an undeclared field rather than dropping it, which is the
  stronger and more useful statement than "it will not be carried".

**One false statement found and corrected.** `README.md` §6 (`categories.<name>.enabled`) said
`npm run gen:commands` stops generating `/mycontext:add-standard` when the category is disabled.
`scripts/gen-commands.ts:28` calls `generateCommands(resolveConfig({}))` — the **default** config — so
the committed `commands/` directory does not follow a project's config at all. `generateCommands`
itself does read whatever config it is handed (custom categories included, and it refuses two names
that would produce the same command file), but nothing regenerates `commands/` from a user's config.
Corrected in both documents; the new section states the same boundary rather than repeating the
survey's "participates in the slash-command generator", which is true of the function and false of a
user's project.
