# Section D1 — README lines 1703–2300

76 claims: 67 VERIFIED, 6 CONTRADICTED, 3 UNVERIFIED. (Plus one out-of-range addendum, D1-A1, also CONTRADICTED.)

Subject file: `my-context/README.md`. Nothing under `my-context/` was modified.
Own CLI runs were executed in `%TEMP%/d1audit` and (read-only reporting commands) against
`my-context/`'s own dogfooded corpus.

---

### D1-001 · README:1709
> **The model** calls the fourteen MCP tools.

**Verdict:** VERIFIED
**Citation:** `my-context/src/mcp/tools.ts` declares exactly 14 `name:` entries — `create_item`, `update_item`, `refresh_item`, `supersede_item`, `link_items`, `get_item`, `query_items`, `list_drafts`, `load_context`, `audit_log`, `mycontext_help`, `mycontext_examples`, `focus_context`, `ingest_document`

---

### D1-002 · README:1710–1712
> Both surfaces read and write the same Markdown files under `.my_context/` … an item the model captures shows up in `mycontext list` at once.

**Verdict:** VERIFIED
**Citation:** `my-context/src/cli/index.ts` `openStore()` delegates to `openRebuiltStore` (`src/core/open-store.ts`), which rebuilds `.index.db` from the Markdown on every CLI invocation; `reports/LIVE-PASS.md` "Corpus state left behind" records four items created through the MCP surface into `test_mycontext_plugin/.my_context/`, the same directory the CLI reads
**Note:** no captured record runs an MCP create followed immediately by `mycontext list`; the "at once" guarantee rests on the per-invocation rebuild rather than on a paired observation.

---

### D1-003 · README:1723
> 66 slash commands

**Verdict:** VERIFIED
**Citation:** `slash/file-count` — expected 66, actual 66; `my-context/commands/` contains 66 `.md` files (21 `add-*`, 21 `list-*`, 24 other)

---

### D1-004 · README:1724
> 30 CLI commands

**Verdict:** VERIFIED
**Citation:** `cli-capture/help-bare`; own run of `mycontext help` lists 7 builtin (`init`, `add`, `list`, `show`, `rebuild`, `help`, `examples`) + 23 registered (`audit`, `decay`, `doctor`, `edit`, `focus`, `harden`, `ingest`, `ingest-apply`, `ingest-status`, `lesson`, `lesson-accept`, `lesson-discard`, `lesson-stage`, `pin`, `query`, `refresh`, `repair`, `review`, `search`, `soften`, `status`, `supersede`, `unpin`) = 30

---

### D1-005 · README:1725
> **MCP tools** — fourteen, served over stdio

**Verdict:** VERIFIED
**Citation:** 14 tools (D1-001); `my-context/.mcp.json` declares `"mycontext": { "type": "stdio", … }`

---

### D1-006 · README:1736–1737
> declared by `.claude-plugin/plugin.json` and discovered from `commands/`, `hooks/hooks.json` and `.mcp.json` at the repository root

**Verdict:** VERIFIED
**Citation:** all four paths exist at `my-context/` root; `plugin.json` declares `"name": "mycontext"`, `"version": "1.0.0"`

---

### D1-007 · README:1749–1750
> `mycontext init` creates `.my_context/` in the current directory with an `items/` directory, a `config.json` and a `.gitignore`.

**Verdict:** VERIFIED
**Citation:** `cli-capture/init-on-pristine-dir` (exit 0); own run in `%TEMP%/d1audit` printed `my_context: initialized …\.my_context` and produced exactly `.gitignore`, `config.json`, `items/`

---

### D1-008 · README:1751–1752
> Without `npm link`, every command also works as `node /path/to/my-context/src/cli/index.ts <args>`.

**Verdict:** VERIFIED
**Citation:** every own run in this audit used that invocation form (`node D:/…/my-context/src/cli/index.ts init|help|add|list|edit|pin|doctor|status|decay|examples`) and each dispatched normally

---

### D1-009 · README:1762–1764
> This repository is its own single-plugin marketplace (`.claude-plugin/marketplace.json`), which is why the marketplace and the plugin are both called `mycontext`.

**Verdict:** VERIFIED
**Citation:** `my-context/.claude-plugin/marketplace.json` has `"name": "mycontext"` and a `plugins` array of length 1 whose sole entry is `{"name": "mycontext", "source": "./"}`

---

### D1-010 · README:1764
> The install survives a restart.

**Verdict:** UNVERIFIED
**Note:** no captured record spans a Claude Code restart — `reports/LIVE-PASS.md` explicitly defers its one restart-dependent check (SessionStart injection).

---

### D1-011 · README:1764–1766
> `claude plugin list` shows it, and `claude plugin uninstall mycontext@mycontext` plus `claude plugin marketplace remove mycontext` undo it.

**Verdict:** UNVERIFIED
**Note:** no captured record invokes `claude plugin list`, `plugin uninstall` or `marketplace remove`; uninstalling would have destroyed the live-pass subject.

---

### D1-012 · README:1768–1772
> To try it for one session without installing anything: `claude --plugin-dir /path/to/my-context`

**Verdict:** UNVERIFIED
**Note:** the live pass ran against a user-scope *installed* plugin (`reports/LIVE-PASS.md` header), so the `--plugin-dir` path was never exercised.

---

### D1-013 · README:1780
> It prints the component inventory — the 38 commands and the `mycontext` skill

**Verdict:** CONTRADICTED
**Citation:** `slash/file-count` — 66 command files in `my-context/commands/`; `reports/LIVE-PASS.md` "Smaller observations": *"`plugin details` counts commands as skills. It prints `Skills (67)` — 66 commands plus the one real skill — and has no commands line."*
**Note:** expected "38 commands", actual 66 command files, and `claude plugin details` prints no commands line at all — it labels them `Skills (67)`. Two failures in one sentence: a stale count and an output string the command never emits. The stale 38 has a fossil elsewhere in the repo: `my-context/test/plugin/commands.test.ts:282` records that the old regex assertion "passed on all 38 files". The `mycontext` skill half is correct — `my-context/skills/mycontext/` exists.

---

### D1-014 · README:1780–1781
> the four hooks (`SessionStart`, `PreToolUse`, `PreCompact`, `PostToolUse`)

**Verdict:** VERIFIED
**Citation:** `my-context/hooks/hooks.json` top-level `hooks` keys are exactly `['SessionStart','PreToolUse','PreCompact','PostToolUse']`

---

### D1-015 · README:1781
> and the one MCP server

**Verdict:** VERIFIED
**Citation:** `my-context/.mcp.json` `mcpServers` has one key, `mycontext`

---

### D1-016 · README:1787–1788
> Slash commands are namespaced by the plugin's name, so every one of them begins `/mycontext:`.

**Verdict:** VERIFIED
**Citation:** `my-context/.claude-plugin/plugin.json` `"name": "mycontext"`; `reports/LIVE-PASS.md` records 66 commands registering under the installed `mycontext@mycontext` plugin

---

### D1-017 · README:1790–1794
> One `add-<type>` per enabled category. The normative ones — `/mycontext:add-constraint` … `/mycontext:add-environment` — capture through the `create_item` tool and land as **drafts**.

**Verdict:** CONTRADICTED
**Citation:** `my-context/src/core/categories.ts:57` — `known_issue: def('known_issue', 'KNOWN', 'normative', true, …)`
**Note:** expected 13 normative `add-*` commands, actual list names 12. `add-known-issue` is omitted from the normative list. `known_issue` is a **normative** category, and the source comment immediately above it (`categories.ts:47-56`) states the consequence explicitly: *"an agent-captured known issue now lands as a **draft** needing human review, like every other normative capture (`defaultAgentEdits('normative')` is `review`)."*

---

### D1-018 · README:1795–1799
> The rationale ones — `/mycontext:add-adr`, `/mycontext:add-decision`, `/mycontext:add-lesson`, `/mycontext:add-tradeoff`, `/mycontext:add-assumption`, `/mycontext:add-edge-case`, `/mycontext:add-risk`, `/mycontext:add-known-issue` and `/mycontext:add-reference` — land active, because rationale is never injected and so cannot silently steer anything.

**Verdict:** CONTRADICTED
**Citation:** `my-context/src/core/categories.ts:57` classifies `known_issue` as `'normative'`, not `'rationale'`; `categories.ts:47-56` records that this was changed *precisely because* a rationale `known_issue` "reached a session as the digit in '1 known_issue' and nothing else"
**Note:** expected 8 rationale add-commands (`adr`, `decision`, `lesson`, `tradeoff`, `assumption`, `edge_case`, `risk`, `reference`), actual list names 9 by including `add-known-issue`. The claim attached to the list is the harmful half: an agent-captured known issue does **not** land active, and it **is** injected. This is the mirror image of D1-017 — one category is on the wrong side of the trust boundary in the README's own description of it.

---

### D1-019 · README:1806–1808
> `/mycontext:search` takes words and calls the `query_items` tool … `/mycontext:show` prints one item in full.

**Verdict:** VERIFIED
**Citation:** `my-context/commands/search.md` and `show.md` exist; `slash/command-references-real-surface` lists `search` and `show` among the referenced real subcommands

---

### D1-020 · README:1808–1817
> One `list-<type>` per enabled category prints that category's table: `/mycontext:list-constraint` … `/mycontext:list-reference`. [21 names]

**Verdict:** VERIFIED
**Citation:** `slash/list-count` — expected 21, actual 21; `slash/category-command-parity` enumerates the same 21 enabled categories with their slug mapping

---

### D1-021 · README:1825–1828
> `/mycontext:review` walks the queue of drafts … All three stop before the act itself: they print the exact `mycontext review promote <id>` or `mycontext review discard <id>` for you to run, and do not run it for you.

**Verdict:** VERIFIED
**Citation:** `my-context/commands/promote.md` step 2 ("Run it WITHOUT `--yes`, exactly as written"), step 4 ("Print the same command with `--yes` on the end, for the USER to run, and stop. Do not run it yourself.")
**Note:** the file spells the command as `node "${CLAUDE_PLUGIN_ROOT}/src/cli/index.ts" review promote <id>`, the equivalent form README:1752 itself sanctions, not the literal token `mycontext`.

---

### D1-022 · README:1830–1835
> `/mycontext:edit` … `/mycontext:pin`, `/mycontext:unpin`, `/mycontext:harden` and `/mycontext:soften` … `/mycontext:supersede` … `/mycontext:link` … `/mycontext:unlink` … `/mycontext:refresh`

**Verdict:** VERIFIED
**Citation:** `my-context/commands/` contains `edit.md`, `pin.md`, `unpin.md`, `harden.md`, `soften.md`, `supersede.md`, `link.md`, `unlink.md`, `refresh.md`

---

### D1-023 · README:1837
> **Every one of those previews by running the CLI command without `--yes`.**

**Verdict:** CONTRADICTED
**Citation:** `my-context/test/plugin/write-commands.test.ts:66-73` — the plugin's own `NO_DRY_RUN` exception map records `'link.md': 'link_items is an MCP tool call, not a CLI command — there is nothing to dry-run'`; confirmed by `my-context/commands/link.md` step 3, which calls the `link_items` MCP tool directly, and by the absence of any `link` command from `mycontext help` (own run; `cli-capture/help-bare`)
**Note:** expected all nine "Change" commands to dry-run, actual eight. `/mycontext:link` writes through the MCP tool with no preview and no `--yes` gate at all. `write-commands.test.ts` also exempts `lesson.md`, `lesson-stage.md`, `ingest.md` and `add-reference.md`, but those are not in the "Change" list this sentence covers.

---

### D1-024 · README:1841–1843
> `test/plugin/write-commands.test.ts` runs each of those dry runs and asserts all three things: the preview appears, the command declines, and the corpus is byte-identical afterwards.

**Verdict:** VERIFIED
**Citation:** `my-context/test/plugin/write-commands.test.ts:14` ("it reached the confirmation — i.e. it printed a preview and then declined"), `:76-89` `corpusSnapshot()` returning every item file and its bytes, `:214` `test(\`the dry run commands/${file} names previews, refuses and writes nothing\`)`
**Note:** "each of those" is qualified by the same `NO_DRY_RUN` list cited in D1-023; the three assertions themselves are present as described. The test also guards against the trap in D1-023's class: `:226-227` fails when a run "refused for some other reason" than reaching the confirmation.

---

### D1-025 · README:1873
> There is one `add-<type>` and one `list-<type>` per **enabled** category — 42 today

**Verdict:** VERIFIED
**Citation:** `slash/add-count` (21) + `slash/list-count` (21) = 42; `slash/category-command-parity` lists 21 enabled categories

---

### D1-026 · README:1873–1876
> plus the 23 that are not per-category: `search`, `show`, `doctor`, `decay`, `query`, `status`, `audit`, `focus`, `review`, `promote`, `discard`, `edit`, `pin`, `unpin`, `harden`, `soften`, `supersede`, `refresh`, `link`, `unlink`, `ingest`, `lesson` and `lesson-stage`.

**Verdict:** VERIFIED
**Citation:** the 24 non-`add-`/non-`list-` files in `my-context/commands/` are exactly those 23 plus `LoadMyContext.md`; `slash/non-per-category-inventory` enumerates the same set
**Note:** 42 + 23 = 65, and `LoadMyContext` is the 66th file, which is what makes the "All 65" of README:1882 consistent with the 66 of README:1723. Read strictly, though, 24 command files are not per-category, not 23.

---

### D1-027 · README:1876–1880
> They are generated from the same resolved config `mycontext help categories` prints, by `npm run gen:commands`, and a test fails if the committed files and the generator disagree.

**Verdict:** VERIFIED
**Citation:** `slash/generator-parity` — `npm run gen:commands` printed `wrote 65 command file(s) to commands/` and `gitStatus` came back empty, i.e. the committed files are byte-identical to a fresh generation; `my-context/package.json` `"gen:commands": "node scripts/gen-commands.ts"`

---

### D1-028 · README:1882
> All 65 of those carry `disable-model-invocation: true`, and it is in effect

**Verdict:** VERIFIED
**Citation:** `slash/disable-model-invocation` — offenders `[]`; own YAML-frontmatter parse of all 66 files found 65 with `disable-model-invocation: true`, the sole omission being `LoadMyContext.md`

---

### D1-029 · README:1883–1884
> `/mycontext:LoadMyContext` is the single exception, and it is the one command that only reads.

**Verdict:** VERIFIED
**Citation:** `slash/loadmycontext-is-the-exception` — pass; own frontmatter parse names `LoadMyContext.md` as the only file without the flag

---

### D1-030 · README:1886–1888
> Nineteen of these files once shipped an `argument-hint` that was not valid YAML, and Claude Code drops *every* frontmatter field of a file it cannot parse

**Verdict:** VERIFIED
**Citation:** `my-context/CHANGELOG.md:567-568` — *"and not in effect on nineteen of them. The 17 `list-<type>` commands plus `review` and `status` carried `argument-hint: [--full|--short|--summary] [--json]`, which opens a YAML …"* (17 + 2 = 19)

---

### D1-031 · README:1888–1891
> The hints are quoted now, and `test/plugin/commands.test.ts` parses the frontmatter and asserts the flag comes back as the boolean `true` rather than matching the line with a regex

**Verdict:** VERIFIED
**Citation:** `slash/argument-hint-quoted` — offenders `[]`; `my-context/test/plugin/commands.test.ts:318-319` — `assert…(fm['disable-model-invocation'], true, \`${file}: disable-model-invocation must PARSE as boolean true\`)`, with `:282` recording the superseded regex `/^disable-model-invocation: true$/m`

---

### D1-032 · README:1894–1899
> `src/plugin/parity.ts` declares which command answers which MCP tool, and `test/plugin/parity.test.ts` checks that declaration against the running program: every tool must have a CLI command or a slash command — there is no exception list for that half

**Verdict:** VERIFIED
**Citation:** `my-context/src/plugin/parity.ts:12` ("which checks it against the running program in both directions: every tool …"), `:21-29` ("its reason in `note`. This is deliberately weaker than 'every tool has a …' … the point is that each absence was decided"), `:102` ("an entry with no reason and refuses a command that is missing from the list"); `my-context/test/plugin/parity.test.ts` exists

---

### D1-033 · README:1903
> 30 commands. `mycontext help` prints the same list from the program itself

**Verdict:** VERIFIED
**Citation:** `cli-capture/help-bare` (exit 0); own run of `mycontext help` printed 30 command lines, built by `usage()` in `my-context/src/cli/index.ts:60-88` from `BUILTIN_ORDER` plus the live `COMMANDS` registry — so the banner is the program's own registration table, and `index.ts:71-73` throws rather than silently omitting a de-registered builtin

---

### D1-034 · README:1903–1904
> `mycontext help <topic>` explains one of `categories`, `scope`, `capture`, `workflow`.

**Verdict:** VERIFIED
**Citation:** `cli-capture/help-categories`, `cli-capture/help-scope`, `cli-capture/help-capture`, `cli-capture/help-workflow` all exit 0; `cli-capture/help-query-refused` and `cli-capture/help-config-refused` exit 1; own `mycontext help` prints `help topics: categories, scope, capture, workflow`

---

### D1-035 · README:1910–1920
> [Capture-and-change table: `init`, `add`, `edit`, `pin`/`unpin`, `harden`/`soften`, `review promote`, `review discard`, `supersede`, `refresh`, `repair`, `rebuild`]

**Verdict:** VERIFIED
**Citation:** every name appears in the own `mycontext help` banner (`init`, `add`, `edit`, `pin`, `unpin`, `harden`, `soften`, `review`, `supersede`, `refresh`, `repair`, `rebuild`), and `review`'s usage line lists `promote` and `discard` as subcommands; `cli-mutate/review-promote-flags`, `cli-mutate/review-discard-missing`, `cli-mutate/supersede-ok`, `cli-mutate/refresh-reference`, `cli-mutate/repair-with-yes`, `cli-capture/rebuild-bare` exercise them

---

### D1-036 · README:1912
> The gate scales with what the change can do: none while the item neither governs nor starts governing, a preview and a confirmation otherwise

**Verdict:** VERIFIED
**Citation:** own run — `edit DEC-we-chose-stripe --title "Stripe chosen"` (a rationale item, non-governing) with **no** `--yes` printed `my_context: updated DEC-we-chose-stripe (active).` and exited 0; `cli-mutate/edit-no-yes-declines` (`edit CONST-pool-capped-at-20 --title X`, a governing constraint) exits 1
**Note:** both halves of the conditional were reached, on the two different item classes the sentence distinguishes.

---

### D1-037 · README:1922–1924
> `add` takes `--body` or `--file`, `--note`, `--scope`, `--tags` and `--severity hard|soft`, and refuses any option it does not recognise rather than folding it into the title.

**Verdict:** VERIFIED
**Citation:** `cli-capture/add-unknown-flag` exit 1; own run of `add constraint "Bogus flag" --body x --bogus y --yes` printed `my_context: unknown option "--bogus".` followed by the full usage line, and created nothing; `cli-capture/add-body`, `add-scope-comma`, `add-tags`, `add-severity-hard`, `add-severity-soft`, `add-note-repeated` all exit 0

---

### D1-038 · README:1924–1927
> `--scope` and `--tags` are lists: comma-separated, repeatable, and the two forms compose, so `--scope "src/api/**,src/db/**"` and `--scope src/api/** --scope src/db/**` mean the same thing.

**Verdict:** VERIFIED
**Citation:** `cli-capture/add-scope-comma` and `cli-capture/add-scope-repeated` both exit 0, with `cli-capture/add-scope-comma-readback` and `cli-capture/add-scope-repeated-readback` (`show CONST-uploads-capped-at-10-mb`) recording the stored result of each

---

### D1-039 · README:1927–1929
> A single-valued flag given twice (`--body x --body y`) is refused rather than resolved to one of them, on every command that takes one.

**Verdict:** VERIFIED
**Citation:** `cli-capture/add-repeated-single-value` exit 1; own run printed `my_context: --body was given 2 times ("x", "y"), and it takes a single value. Honouring one of them would drop the others without saying so, so pass it once.`; the mechanism is shared — `repeatedFlagError`/`flagOccurrences` in `my-context/src/cli/commands/registry.ts`, imported by `index.ts`
**Note:** "on every command that takes one" is verified structurally (one shared helper) rather than by a per-command sweep.

---

### D1-040 · README:1929–1931
> `--body` and `--file` both supply the body, so passing both is refused rather than resolved by precedence

**Verdict:** VERIFIED
**Citation:** `cli-capture/add-body-and-file-conflict` exit 1; own run printed `my_context: --body and --file both supply the item's body, and this capture passed both. Nothing was created.`

---

### D1-041 · README:1931–1933
> `--note` is repeatable and adds a `[note]` observation

**Verdict:** VERIFIED
**Citation:** `cli-capture/add-note-repeated` (`--note first --note second`) exit 0 with `cli-capture/add-note-repeated-readback` recording the result; own `add` usage line states `--note adds a "[note]" observation and may be repeated`

---

### D1-042 · README:1933–1934
> Observations under any other category, an observation's tags or context, and relations are still not expressible as flags — use the `create_item` and `link_items` tools for those.

**Verdict:** VERIFIED
**Citation:** own `add` usage text says exactly this — *"An observation under any OTHER category, an observation's tags or context, and relations have no flag spelling — capture those with the create_item tool on the mycontext MCP server"*; no `--observation`/`--relation` flag appears in `add`'s accepted set

---

### D1-043 · README:1935–1937
> `--yes` is required for a **normative** category, because that item governs the project the moment it exists; rationale categories need no confirmation.

**Verdict:** VERIFIED
**Citation:** `cli-capture/add-normative-without-yes` (`add constraint …`) exit 1 vs `cli-capture/add-rationale-without-yes` (`add decision …`) exit 0; own runs reproduce both — the constraint printed `about to create constraint … — active, and governing this project at once.` then `refusing without confirmation`, while the decision printed `my_context: created DEC-we-chose-stripe (active)…`
**Note:** the normative run reached the confirmation gate itself (it printed the "about to create" preview first), not an earlier guard.

---

### D1-044 · README:1939–1943
> `pin`, `unpin`, `harden` and `soften` are not a second editing mechanism: each one runs `edit` with the single flag it names, so it prints the same preview, asks the same confirmation and produces the same result and the same refusals.

**Verdict:** VERIFIED
**Citation:** all four are registered through `NAMED_ENTRY_POINTS` in `my-context/src/cli/commands/edit.ts`; own `mycontext help` describes each as its `edit` equivalent (`pin` = "edit --always=true", `harden` = "edit --severity=hard", `soften` = "edit --severity=soft", `unpin` = "edit --always=false"); `cli-mutate/pin-no-yes-declines` and `cli-mutate/harden-no-yes-declines` exit 1 after printing the preview, matching `cli-mutate/edit-no-yes-declines`
**Note:** own run of `pin CONST-pool-capped-at-thirty` (no `--yes`) printed the full `about to edit:` / `changing: always no -> yes` / `after PINNED …` preview and then declined — the confirmation gate was reached, not a missing-id guard.

---

### D1-045 · README:1944–1945
> Each takes one id and `--yes`, and refuses every other flag, naming `mycontext edit` as the command that changes more than one field at a time.

**Verdict:** VERIFIED
**Citation:** `cli-mutate/pin-rejects-other-flags` (`pin … --severity hard --yes`) exit 1; own runs printed `my_context: unknown option "--severity". / usage: mycontext pin <id> [--yes]` and, for `harden … --title x --yes`, `unknown option "--title" / usage: mycontext harden <id> [--yes]` — both closing with *"To change any other field, or more than one, use `mycontext edit <id>`."*

---

### D1-046 · README:1947–1948
> `mycontext edit <id> --unlink <relation> <target>` removes a relation, and is the only supported way to.

**Verdict:** VERIFIED
**Citation:** `--unlink` appears only on `edit` in the CLI surface (own `mycontext help`; `cli-mutate/edit-unlink-two-words`, `cli-mutate/edit-unlink-equals-refused`), and there is no `unlink_items` MCP tool (D1-047)

---

### D1-047 · README:1950
> **There is no `unlink_items` tool**

**Verdict:** VERIFIED
**Citation:** the 14 tool names in `my-context/src/mcp/tools.ts` (D1-001) contain no `unlink_items`

---

### D1-048 · README:1951–1952
> which is why `link_items` has no `origin` field at all

**Verdict:** VERIFIED
**Citation:** `my-context/src/mcp/tools.ts:622-626` — `link_items`'s schema is `object({ from, to, relation }, ['from','to','relation'])`, with the comment at `:627-630` noting `origin: 'agent'` is applied internally and "gates nothing here"

---

### D1-049 · README:1954–1956
> **`supersedes` and `superseded_by` cannot be removed** … If a retirement was itself wrong, the route is `mycontext edit <id> --status active`.

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/relations.ts:203-215` `retirementEdgeRefusal()`, which returns the refusal for exactly those two relation names; own run of `edit CONST-pool-capped-at-thirty --unlink supersedes DEC-we-chose-stripe --yes` printed that refusal verbatim, ending *"change the retired item's status with `mycontext edit <id> --status active`"*

---

### D1-050 · README:1957–1959
> **A relation from outside the closed vocabulary can still be removed**, because that vocabulary governs what may be *written*

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/relations.ts:203-204` — `retirementEdgeRefusal` returns `null` for every relation other than `supersedes`/`superseded_by`, and the only other unlink guard, `missingRelationRefusal` (`:226-235`), matches on `r.type === relation` with no `RELATION_TYPES` membership test; the vocabulary check `RELATION_TYPES.includes(input.relation)` sits at `:103`, on the **write** path

---

### D1-051 · README:1960–1961
> an unlink that matches nothing is refused rather than reported as a success

**Verdict:** VERIFIED
**Citation:** `cli-mutate/edit-unlink-two-words` exit 1; own run of `edit CONST-pool-capped-at-thirty --unlink depends_on DEC-we-chose-stripe --yes` printed `my_context: CONST-pool-capped-at-thirty has no "depends_on" relation to DEC-we-chose-stripe — it carries none at all. Nothing was written.`; `my-context/src/core/relations.ts:220-224` names `INV-nothing-is-dropped-silently` as the reason
**Note:** the run carried `--yes`, so it passed the confirmation gate and reached the relation-matching check itself.

---

### D1-052 · README:1965–1972
> [Find-and-read table: `list`, `search`, `show`, `query`, `examples`, `help`]

**Verdict:** VERIFIED
**Citation:** all six appear in the own `mycontext help` banner; `cli-capture/list-bare`, `cli-capture/show-existing`, `cli-capture/examples-rule`, `cli-capture/help-bare` exit 0

---

### D1-053 · README:1968
> find items by text, and by `--type`, `--tag`, `--path`, `--status`, `--relation`. The same filter `query_items` runs, and the same code: one predicate, two surfaces

**Verdict:** VERIFIED
**Citation:** own `mycontext help` prints `search "<words>" [--type|--tag|--path|--status|--relation|--limit] …`; `my-context/src/cli/commands/search.ts:6` imports `filterItems` from `../../core/search.ts` and `my-context/src/mcp/tools.ts:25` imports the same `filterItems`, used at `:675` under the comment *"The predicate itself is `filterItems` (src/core/search.ts), shared with …"*

---

### D1-054 · README:1976–1990
> [`mycontext list` example block: an `id` / `type` / `status` table]

**Verdict:** VERIFIED
**Citation:** `cli-capture/list-bare` exit 0; own run reproduced the same three-column box-drawn table (`id`, `type`, `status`) with the same separators
**Note:** the row contents are the documentation fixture's, not reproducible outside it; the column set and rendering match.

---

### D1-055 · README:1993–1996
> the two widest columns of this table said one thing twice, and between them made the default report 192 columns on this repository's own corpus against a 100-column layout

**Verdict:** VERIFIED
**Citation:** computed from `mycontext list --json` run against `my-context/`'s own corpus (44 items): widest `id` 64, `type` 13, `status` 10, `title` 92 → a four-column box table measures exactly **192** characters; `my-context/src/cli/index.ts:612` carries the same figure as a source comment, and `my-context/src/cli/commands/review.ts:628-630` names the 100-column budget as `OUTPUT_WIDTH` in `format.ts`

---

### D1-056 · README:1997
> Without the title it is 97.

**Verdict:** VERIFIED
**Citation:** own run of `mycontext list` against `my-context/`'s own corpus — the widest line measures exactly **97** characters (measured as Unicode code points, since the box-drawing glyphs are multi-byte)

---

### D1-057 · README:1997–1998
> The title is still there in full in `mycontext show`, in `list --full` and in `list --json`

**Verdict:** VERIFIED
**Citation:** `cli-capture/list-full` and `cli-capture/list-json` exit 0; own `list --json` output carries a `title` key on every record (keys: `id`, `type`, `status`, `title`, `origin`, `layer`, `severity`, `always`, `scope`, `tags`, `sourceFile`, `filePath`); `cli-capture/show-existing` exit 0

---

### D1-058 · README:1998
> the same removal was made to `mycontext decay` (170 columns to 97)

**Verdict:** CONTRADICTED
**Citation:** own run of `mycontext decay` against `my-context/`'s own corpus — every table line measures **100** characters, of which 2 are the report's leading indent, so the box itself is **98** columns
**Note:** expected 97, actual 98 (100 including the two-space indent the report prints). The "170 columns" half is corroborated by `my-context/src/cli/commands/decay.ts:36` (*"this report was 170 columns on this repository's corpus"*) and `my-context/src/cli/commands/review.ts:628-630` (*"put those reports at 192 and 170 columns"*). The same corpus and the same measurement method reproduced README's 192 and 97 for `list` exactly, so the one-column gap here is a stale figure rather than a measurement artefact.

---

### D1-059 · README:1999–2000
> `mycontext review list` keeps the column

**Verdict:** VERIFIED
**Citation:** `my-context/src/cli/commands/review.ts:641` — the scanning-level `table(['id','type','origin','always','source','title'], …)`, with the comment at `:626-627` (*"`title` stays at the scanning level here, unlike `list` and `decay`"*)

---

### D1-060 · README:2001–2003
> Its `--full` is not a table at all — like `list --full` it is a stanza per draft

**Verdict:** VERIFIED
**Citation:** `my-context/src/cli/commands/review.ts:611-624` — at `detail === 'full'` it calls `records(…)` rather than `table(…)`, with the comment at `:600-610` (*"As a record view the id is a heading on its own line and every other field is labelled beneath it"*); `cli-mutate/review-list-full` exit 0

---

### D1-061 · README:2005
> `mycontext show <id>` prints the file itself, frontmatter included

**Verdict:** VERIFIED
**Citation:** `cli-capture/show-existing` exit 0; own `mycontext examples rule` (same renderer) emits the full `---` frontmatter block followed by the body

---

### D1-062 · README:2011–2035
> [`mycontext examples rule` example block, ending `checksum: 0040bc230528c1af` / `directive: dont`]

**Verdict:** VERIFIED
**Citation:** `cli-capture/examples-rule` exit 0; own run of `mycontext examples rule` reproduced the block field-for-field including `checksum: 0040bc230528c1af`, `scope: - src/api/auth/**`, `directive: dont` and the body line *"Bodies carry passwords and reset tokens; logs are retained for 90 days."*

---

### D1-063 · README:2038
> `valid_from` reads `<today>` because that field is stamped with the day the command is run.

**Verdict:** VERIFIED
**Citation:** own run printed `valid_from: 2026-08-17` — the real current date, not the literal `<today>`
**Note:** the README block therefore contains a documented substitution, which is what the sentence is there to explain; the underlying stamping behaviour is confirmed.

---

### D1-064 · README:2039–2041
> Every block in this document is produced by actually running the command it sits under and re-checked by the test suite

**Verdict:** VERIFIED
**Citation:** `my-context/package.json` `"gen:docs": "node scripts/gen-doc-examples.ts"`; `my-context/test/docs/examples.test.ts` exists alongside `test/docs/categories.test.ts`, `injection.test.ts`, `parity.test.ts` and `staged-revision.test.ts`; the README's `<!-- example: … -->` / `<!-- /example -->` markers are the generator's anchors
**Note:** subject to the `<today>` substitution of D1-063.

---

### D1-065 · README:2043–2045
> `mycontext examples <category> --short` prints the same specimen cut to its id, title, category-specific fields and body — four to six lines instead of the whole stored file.

**Verdict:** VERIFIED
**Citation:** `cli-capture/examples-short` exit 0; own run of `examples rule --short` printed 5 lines — `id:`, `title:`, `directive:` (the rule-specific field), a blank, and the body

---

### D1-066 · README:2065–2069
> `mycontext review show <id>` prints one draft in full. `mycontext review promote <id>` makes it govern; `--always` pins it at the same time … `mycontext review discard <id>` retires it instead.

**Verdict:** VERIFIED
**Citation:** `my-context/src/cli/commands/review.ts:38` registers subcommands `list`, `show`, `promote`, `discard`, `revisions`, `promote-revision`, `discard-revision`; `:75` `promote: { allowed: ['scope','severity','always','yes'], … }`; `:84` usage `mycontext review promote <id> [--scope "a/**,b/**"] [--always] [--severity hard|soft] [--yes]`; `cli-mutate/review-promote-flags` (`review promote CONST-draft-item --scope src/** --severity hard --always --yes`) exit 0 with `cli-mutate/review-promote-flags-readback`

---

### D1-067 · README:2072–2076
> When an agent revises the title, body, tags or `extra` of an item in a category set to `agentEdits: "review"` … the edit does not apply. It becomes a **pending revision**

**Verdict:** VERIFIED
**Citation:** `my-context/src/mcp/tools.ts:644` (*"`agentEdits: \"review\"` answers 'NOT applied — staged as revision REV-…'"*) and `my-context/src/core/revision.ts:938-943`, which builds that message without touching the item

---

### D1-068 · README:2080–2082
> [Revision table: `review revisions [<id>]`; `review promote-revision <id>` — `--revision`, `--yes`, `--force`; `review discard-revision <id>` — `--revision`, `--yes`]

**Verdict:** VERIFIED
**Citation:** `my-context/src/cli/commands/review.ts:78-79` — `'promote-revision': { allowed: ['revision','force','yes'], … }`, `'discard-revision': { allowed: ['revision','reason','yes'], … }`; usage at `:87-88`; `cli-mutate/review-revisions` and `cli-mutate/review-revisions-full` exit 0
**Note:** `discard-revision` also accepts a fourth flag, `--reason` (`review.ts:79`, usage `:88`, exercised by `cli-mutate/review-discard-revision-reason`), which this row does not list. The row does not claim to be exhaustive, so it is recorded as an omission rather than a false statement — but see D1-A1, where the flag table *does* claim totality and omits `--reason` too.

---

### D1-069 · README:2084–2088
> When an item carries **more than one** pending revision, both settlement commands require `--revision REV-...` and refuse the bare form … With exactly one pending, the id is unambiguous and `--revision` may be omitted.

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/revision.ts:969-996` `pickPendingRevision()` — when `revisionId === undefined` and `forItem.length > 1` it throws *"has N pending revisions (…) and no --revision names which one to <verb>. Refusing to pick one…"*, and otherwise `return forItem[0]`; the doc comment at `:956-967` states *"With more than one pending and no `revisionId`, it REFUSES rather than defaults."*
**Note:** deliberately **not** cited to `cli-mutate/review-promote-revision-missing` or `cli-mutate/review-discard-revision-reason`. Both exit 1, but on the *no revision pending at all* branch (`revision.ts:973-981`), which is reached before the ambiguity check — they would prove nothing about this claim.

---

### D1-070 · README:2095–2097
> `my_context: NOT applied — staged as revision REV-76627cb9f4c6 for review. RULE-never-log-customer-email is unchanged and keeps governing its current body, and will until a human promotes this proposal. …`

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/revision.ts:938-943` builds exactly that string — `` `my_context: NOT applied — staged as revision ${revisionId} for review. ${itemId} is unchanged and ${keepsPhrase(ctx, item)} its current ${changedFields(normalized).join(', ')}, and will until a human promotes this proposal. A human sees it with \`mycontext review revisions\` (it is counted by \`mycontext status\` too), and it is recorded in ${revisionLogPath(ctx.root)}. Tell the user you staged it rather than assuming they will look. Do not reason as if the new text is in force.${queued}` ``; `my-context/test/docs/staged-revision.test.ts` pins it

---

### D1-071 · README:2190–2196
> [Diagnose table: `status`, `doctor`, `decay`, `audit`, `focus`]

**Verdict:** VERIFIED
**Citation:** all five appear in the own `mycontext help` banner with matching summaries; `cli-capture/status-bare`, `cli-capture/doctor-bare` exit 0

---

### D1-072 · README:2198–2243
> [`mycontext status` example block: `my_context 1.0.0: N item(s), profile "standard"`, then `by category`, `by status`, `by origin`, `review queue:`, `usage:`, `health:`]

**Verdict:** VERIFIED
**Citation:** `cli-capture/status-bare` exit 0; own run reproduced the version-and-profile headline, all three tables in the same order, the `review queue:` line, the `usage: no sessions recorded yet — decay reporting starts once items begin to be injected.` line, the unscoped-normative warning and the closing `health: 0 error(s), 0 warning(s), 0 note(s) — details from \`mycontext doctor\`.`
**Note:** the counts are the documentation fixture's; every literal line of prose matched.

---

### D1-073 · README:2249–2253
> `my_context doctor: 0 error(s), 0 warning(s), 0 note(s) across 0 finding(s).`

**Verdict:** VERIFIED
**Citation:** `cli-capture/doctor-bare` exit 0; own run of `mycontext doctor` on a healthy workspace printed that line byte-for-byte as its only output

---

### D1-074 · README:2259–2271
> [`mycontext decay --summary` example block, headline + caveat + `cold N, warm 0, of which M unrestricted.`]

**Verdict:** VERIFIED
**Citation:** own run of `mycontext decay --summary` reproduced the headline `my_context decay — items not injected in the last 20 session(s). The ledger holds 0 session(s).`, the four-line caveat, the parenthetical `(no sessions recorded yet — nothing here has been measured; "cold" currently means only "never injected")` and the closing `cold N, warm 0, of which M unrestricted. Rows with \`mycontext decay\` (default) or \`--full\`.`

---

### D1-075 · README:2273–2274
> That caveat is printed at every detail level, `--summary` included

**Verdict:** VERIFIED
**Citation:** own runs — the string `does NOT mean unused` appears in the output of `decay --summary`, `decay --short`, `decay --full` and `decay --json` alike

---

### D1-076 · README:2275
> so it reads as a paragraph rather than as one 284-character line

**Verdict:** CONTRADICTED
**Citation:** `my-context/src/cli/commands/decay.ts:28-32` — `COLD_CAVEAT` is `'"cold" means: not auto-injected in the last window of sessions. It does ' + 'NOT mean unused — the ledger records injection, not reading or reliance, ' + 'so a new item, and any item consulted via \`show\`, MCP \`get_item\`, or the ' + 'Markdown file directly, look exactly like an abandoned one here.'`, which is **282** characters
**Note:** expected 284, actual 282. Confirmed independently from the rendered output: the caveat wraps to three lines of 93, 92 and 95 characters (excluding the two-space indent), and 93 + 92 + 95 + 2 joining spaces = 282. The alternative reading — caveat plus the following `Do not supersede or deprecate anything on this report alone — verify real usage first.` sentence (`decay.ts:209`) — measures 369, so neither reading yields 284.

---

## Addendum — out of assigned range

### D1-A1 · README:2771
> These twenty-five are all of them.

**Verdict:** CONTRADICTED
**Citation:** the three tables the sentence introduces hold 9 + 12 + 4 = **25** rows — README:2781-2789, README:2795-2806 and README:2812-2815 — `--short`, `--full`, `--summary`, `--json`, `--quiet`, `--sessions`, `--all`, `--limit`, `--type`, `--body`, `--note`, `--scope`, `--tags`, `--severity`, `--always`, `--title`, `--directive`, `--extra`, `--status`, `--by`, `--reason`, `--yes`, `--anchor`, `--file`, `--stdin`. At least **18** further flags are accepted by the shipped CLI and appear in no row: `--unlink` (`edit`; README:1947 documents it in prose), `--revision` and `--force` (`review promote-revision`/`discard-revision`, `src/cli/commands/review.ts:78-79`), `--tag`, `--path`, `--relation` (`search`, own `mycontext help`), `--since`, `--item`, `--session`, `--op`, `--origin`, `--items`, `--files` (`audit`, `src/cli/commands/audit.ts:22-23,255,273-275`; README:2298-2304 documents six of them itself), `--show`, `--clear`, `--category`, `--preview`, `--relations` (`focus`, own `mycontext help`)
**Note:** the row count of 25 is exact; the totality assertion attached to it is false. `--sessions` and `--limit` also appear with a second command each (`audit`) that their "Where it works" columns omit, and `--reason` is listed for `supersede` only while `review discard-revision` accepts it too (D1-068). This block falls at README:2771, outside the 1703–2300 range assigned to D1; it is recorded here because it was named in the assignment. README:436 (*"All twenty-five options the CLI takes"*) makes the same claim and is likewise out of range.
