# Section E1 — README lines 2847–3400

94 claims: 92 VERIFIED, 2 CONTRADICTED, 0 UNVERIFIED.

Citation shorthand used below:
- `config/<caseId>` — captured run from `harness/evidence/config.jsonl`.
- `<path>:<line>` — plugin source, read-only.
- `own-run/<label>` — a CLI/hook run I performed in `$TEMP` outside the repo; each is paired with a source citation.

---

### E1-001 · README:2849
> Configuration lives in one file, `.my_context/config.json`, created by `mycontext init`

**Verdict:** VERIFIED
**Citation:** `own-run/init` — `mycontext init` in an empty temp dir printed `my_context: initialized …\.my_context` and produced exactly `.gitignore`, `config.json`, `items/`; corroborated by `reports/LIVE-PASS.md` (fresh corpus writes `config.json`).

---

### E1-002 · README:2851
> ```json
> { "profile": "standard", "categories": {}, "budgets": {} }
> ```

**Verdict:** VERIFIED
**Citation:** `own-run/init` — `cat .my_context/config.json` after init returned those three keys and no others; `reports/LIVE-PASS.md` records the same file as `{"profile":"standard","categories":{},"budgets":{}}`.
**Note:** No `watchedDocs` key is written, consistent with `my-context/src/core/config.ts:388` (`requireWatchedDocs` returns `DEFAULT_WATCHED_DOCS` when the key is absent).

---

### E1-003 · README:2859
> Everything below is optional.

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/config.ts:408-420` — `resolveConfig` accepts `undefined`/`null`/`{}`; `my-context/src/mcp/tools.ts:447` calls `resolveConfig({})` to build the default config, so an empty object resolves.

---

### E1-004 · README:2859
> The examples that follow were each run against the example Bookstore API corpus

**Verdict:** VERIFIED
**Citation:** `my-context/scripts/doc-fixture.ts:8-23` — the committed documentation fixture is a `.my_context` workspace for a fictional "Bookstore API"; `own-run/fixture-minimal` reproduced README:2875 byte-for-byte from a copy of `my-context/test/fixtures/docs-workspace`.

---

### E1-005 · README:2864
> Two profiles: `minimal` … and `standard`

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:113-121` — `PROFILES` has exactly the keys `minimal` and `standard`; `config/profile-full-refused` stdout: `Expected one of: minimal, standard.`

---

### E1-006 · README:2864
> `minimal` (8 categories)

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:114-117` — `minimal` lists `constraint, assumption, invariant, tradeoff, adr, edge_case, rule, lesson` = 8; `config/profile-minimal` note "minimal enables exactly 8 categories"; `config/profile-minimal-disabled-category` shows `runbook` refused as disabled under that profile.

---

### E1-007 · README:2864
> `standard` (all 21 …)

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:118-120` — `standard` = every `defaultEnabled` category, and all 21 entries of `CATEGORIES` (`categories.ts:20-85`) declare `defaultEnabled: true`; `own-run/add-nonsense` enumerated exactly 21 accepted types.

---

### E1-008 · README:2864
> … the default

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/config.ts:432` — `const profile = (input.profile ?? 'standard')`; `config/budgets-defaults` stdout reports `"profile": "standard"` for a workspace with `budgets` set and no profile change.

---

### E1-009 · README:2865
> A profile decides which categories are **enabled**

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/config.ts:441` and `:461` — `enabledByProfile = new Set(PROFILES[profile])`, then `enabled: enabledByProfile.has(def.name)` for every catalogue entry.

---

### E1-010 · README:2866
> an unknown profile name is an error at load time, not a silent fallback

**Verdict:** VERIFIED
**Citation:** `config/profile-unknown-refused` — exit 1, `my_context: unknown profile "nope". Expected one of: minimal, standard.`; `my-context/src/core/config.ts:433-439`.

---

### E1-011 · README:2867
> and that includes `full`

**Verdict:** VERIFIED
**Citation:** `config/profile-full-refused` — exit 1, `my_context: unknown profile "full".` plus the retirement hint; `my-context/src/core/config.ts:64-72`.

---

### E1-012 · README:2867
> `full`, which was a third profile until the categories it existed for were removed

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:90-112` — "`full` meant 'every category in the catalogue' … The gap … was exactly `policy`, `postmortem` and `taxonomy` … Phase 3 removed all three."

---

### E1-013 · README:2870
> Switching the example project to `"profile": "minimal"` disables `decision`, `requirement` and `standard`, among others.

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:114-117` — none of `decision`, `requirement`, `standard` appear in the `minimal` list; `own-run/fixture-minimal` shows all three reported as `(disabled/unknown category)`.

---

### E1-014 · README:2871
> Their items do not vanish — they stop being listed individually in the index and are counted as disabled instead

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/render.ts:25-27` — "A disabled or unknown category never deletes existing items — it drops to index-only", rendered as `${n} ${type} (disabled/unknown category)`; `my-context/src/core/select.ts:61-69`.

---

### E1-015 · README:2875
> 1 lesson · 1 drafts pending review · 1 retired · 2 decision (disabled/unknown category) · 1 requirement (disabled/unknown category) · 1 standard (disabled/unknown category)

**Verdict:** VERIFIED
**Citation:** `own-run/fixture-minimal` — the docs fixture copied to `$TEMP`, `config.json` set to `{"profile":"minimal","categories":{},"budgets":{}}`, `rebuild`, then the SessionStart hook (`my-context/src/hooks/session-start.ts`) emitted that line character-for-character.

---

### E1-016 · README:2883
> It decides two things that cannot be changed afterwards: which **tier** the item sits in … and the **prefix of its id**.

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:3-17` — `CategoryDef` carries `tier` and `prefix`; `my-context/src/core/mutate.ts:407-417` — `UpdateInput` has no `type` field, so an item cannot be moved between categories after creation.

---

### E1-017 · README:2884
> normative items can be injected into a future session, rationale items never are

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/select.ts:473` — `const injectable = eligible.filter((i) => isNormative(i, config));`; `my-context/src/core/trust.ts:82-90`.

---

### E1-018 · README:2885
> `type` is fixed at creation; `update_item` cannot re-file an item, because the type decides where the file lives.

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/mutate.ts:407-417` — `UpdateInput` exposes `title, body, scope, tags, severity, always, status, extra, origin` and no `type`; `my-context/src/core/rebuild.ts:146` — `"type" is fixed at creation, so it cannot be re-filed in place`.

---

### E1-019 · README:2888
> The definitions live in the catalogue (`src/core/categories.ts`)

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:19-86` — the `CATEGORIES` record holds every category's name, prefix, tier and description.

---

### E1-020 · README:2889
> are printed for *your* project by `mycontext help categories`, which the model reads through the same `mycontext_help` tool

**Verdict:** VERIFIED
**Citation:** `my-context/src/help/index.ts:11` — `HELP_TOPICS = ['categories', 'scope', 'capture', 'workflow']`; `my-context/src/mcp/tools.ts:836` — the `mycontext_help` schema declares `topic … enum: ['categories', 'scope', 'capture', 'workflow']`; `own-run/help-categories` produced the per-project table.

---

### E1-021 · README:2890
> **The block below is that command's real output**, run against the example project **with one named transformation applied**

**Verdict:** VERIFIED
**Citation:** `own-run/help-categories-diff` — `mycontext help categories` captured, `^#{1,6}\s+` folded to `**…**`, diffed line-by-line against README lines 2912–3265: 354 lines on both sides, 0 differences.

---

### E1-022 · README:2893
> the table of the 21 categories the `standard` profile enables, in tier order

**Verdict:** VERIFIED
**Citation:** `own-run/help-categories` — the rendered table has 21 rows, 13 marked `normative` followed by 8 marked `rationale`; `my-context/src/core/categories.ts:19-85` supplies the same 21 with the same tiers.

---

### E1-023 · README:2896
> the output's own `#` headings are written as **bold lines** instead. Nothing else is changed

**Verdict:** VERIFIED
**Citation:** `own-run/help-categories-diff` — 0 differences after applying only that rule; `my-context/test/docs/examples.test.ts:388` — test named "toDocumentMarkdown folds headings to bold and changes nothing else".

---

### E1-024 · README:2899
> `scripts/gen-doc-examples.ts` writes the block by running the command and applying that rule (`toDocumentMarkdown`), so `npm run gen:docs` regenerates it

**Verdict:** VERIFIED
**Citation:** `my-context/scripts/gen-doc-examples.ts:252` (`export function toDocumentMarkdown`) and `:711` (`const body = toDocumentMarkdown(output);`); `my-context/package.json:14` — `"gen:docs": "node scripts/gen-doc-examples.ts"`.

---

### E1-025 · README:2901
> `test/docs/examples.test.ts` re-runs the command and applies the same rule from the same function on every test run

**Verdict:** VERIFIED
**Citation:** `my-context/test/docs/examples.test.ts:13` — imports `runExampleInFixture, …, toDocumentMarkdown` from the generator module; `:396` applies it to fresh command output.

---

### E1-026 · README:2904
> written as headings they would put 24 entries into this document's outline

**Verdict:** VERIFIED
**Citation:** `own-run/help-categories` — `grep -c "^#"` over the command's output returns 24 (`# Categories`, `## What each type is for…`, 21 × `### <type>`, `## When you are unsure`).

---

### E1-027 · README:2914
> The type decides two things: whether the item can be injected into a future session, and the prefix of its id.

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/select.ts:473` (injection gated on tier) and `my-context/src/core/categories.ts:3-17` (`prefix` on `CategoryDef`); reproduced as command output by `own-run/help-categories-diff`.

---

### E1-028 · README:2917
> With `always: true` they are injected in full at every session start.

**Verdict:** VERIFIED
**Citation:** `own-run/fixture-minimal` — the SessionStart hook printed `CONST-postgres-pool-capped-at-20` in full under "these govern this project", and `own-run/show-const` confirms that item carries `always: true`, `scope: []`; `my-context/src/core/trust.ts:82-84`.

---

### E1-029 · README:2918
> Otherwise they are injected when a file they apply to is touched: the files matching their `scope`, or every file if they declare none

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/config.ts:110-116` — `DEFAULT_SCOPE_POLICY = 'global'`, described as "the only value that asks nothing of a user who has no restriction to express"; `my-context/src/core/trust.ts:92-93` — `matchesScope(item, path, config)` is the scope consumer.

---

### E1-030 · README:2921
> **Rationale** types … are never injected. They appear in the session index as counts and are retrieved with `query_items`.

**Verdict:** VERIFIED
**Citation:** `own-run/fixture-minimal` — the index block named only normative items and reduced `lesson` to `1 lesson`; `my-context/src/core/select.ts:473`; `my-context/src/core/trust.ts:91-95` (`query_items` answers over every item).

---

### E1-031 · README:2924
> `always` and `severity` do nothing on one — the pinned tier admits only normative items, and nothing outside that tier gates on severity

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/trust.ts:82-90` — "`select` filters `isNormative` BEFORE it filters `always` … `severity` gates nothing at all outside the normative tier"; `my-context/src/core/select.ts:473`.

---

### E1-032 · README:2927
> Setting either on a rationale item is therefore **refused** rather than stored and ignored, on every write surface.

**Verdict:** VERIFIED
**Citation:** `own-run/rationale-severity` — `mycontext add decision "Rationale sev" --severity hard --yes` exited 1 with `"severity" is a field on every item, but it only governs on the normative tier … Nothing was written.`; `my-context/src/core/trust.ts:126-146` (`inertFieldError`), called from `my-context/src/core/mutate.ts:218` (capture) and `:505` (edit).
**Note:** It is the *governing* assertion that is refused. `always: false` and `severity: 'soft'` are accepted on a rationale item by design (`trust.ts:108-111`), and on update only a *change* is refused (`trust.ts:112-117`).

---

### E1-033 · README:2928
> change the category's tier (`categories.<name>.tier` in `.my_context/config.json`)

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/config.ts:175` (`tier?: Tier` on `RawCategory`), `:198` (`tier` in `CATEGORY_KEYS`), `:538-546` (override applied); `own-run/reference-retier` — `{"categories":{"reference":{"tier":"normative"}}}` moved `REF-roadmap` into the normative index.

---

### E1-034 · README:2930
> `scope` is not refused there — it is inert for injection on the rationale tier, but `query_items({path})` reads it on every item

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/trust.ts:91-103` — "`scope` is different … the `query_items` MCP tool answers 'which items apply to this path?' with `matchesScope(item, path, config)` over EVERY item, rationale included"; `inertFieldError` (`trust.ts:128`) accepts only `'always' | 'severity'`.

---

### E1-035 · README:2934
> Only the types below are accepted in this project. Anything else is refused.

**Verdict:** VERIFIED
**Citation:** `own-run/add-nonsense` — `mycontext add nonsense "X" --yes` exited 1 with `"type" must be one of: constraint, invariant, … reference. You passed "nonsense".`; `config/custom-category-missing-tier` — an undeclared category is refused at config load.

---

### E1-036 · README:2938
> `constraint` | normative | `CONST-` | Non-negotiable limit: budget, stack, regulation, SLA

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:20-21`; `config/add-constraint` — created `CONST-a-constraint`.

---

### E1-037 · README:2939
> `environment` | normative | `ENV-` | How the environments differ: what production does that local does not

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:42-43`; `config/add-environment` — created `ENV-a-environment`.

---

### E1-038 · README:2940
> `glossary` | normative | `GLOSS-` | Ubiquitous language: the agreed term, and terms not to use

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:32-33`; `config/add-glossary` — created `GLOSS-a-glossary`.

---

### E1-039 · README:2941
> `instruction` | normative | `INSTR-` | Governs the agent's process, not the artifact

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:34-35`; `config/add-instruction` — created `INSTR-a-instruction`.

---

### E1-040 · README:2942
> `invariant` | normative | `INV-` | Condition that must always hold during execution

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:22-23`; `config/add-invariant` — created `INV-a-invariant`.

---

### E1-041 · README:2943
> `known_issue` | normative | `KNOWN-` | Broken, flaky or a dead end right now; do not spend effort on it

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:57-58`; `config/add-known_issue` — created `KNOWN-a-known-issue`, and the CLI banner "active, and governing this project at once" confirms the normative tier.

---

### E1-042 · README:2944
> `non_goal` | normative | `NOGOAL-` | Explicit prohibition on building something

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:36-37`; `config/add-non_goal` — created `NOGOAL-a-non-goal`.

---

### E1-043 · README:2945
> `open_question` | normative | `OPENQ-` | Deliberately undecided; the agent must not decide it alone

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:38-39`; `config/add-open_question` — created `OPENQ-a-open-question`.

---

### E1-044 · README:2946
> `pattern` | normative | `PAT-` | Reusable solution, or an anti-pattern to avoid

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:30-31`; `config/add-pattern` — created `PAT-a-pattern`.

---

### E1-045 · README:2947
> `requirement` | normative | `REQ-` | What must be built

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:26-27`; `config/add-requirement` — created `REQ-a-requirement`.

---

### E1-046 · README:2948
> `rule` | normative | `RULE-` | A do/dont directive

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:24-25`; `config/add-rule` — created `RULE-a-rule`.

---

### E1-047 · README:2949
> `runbook` | normative | `RUN-` | The steps for a named operation, in the order they must be taken

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:40-41`; `config/add-runbook` — created `RUN-a-runbook`.

---

### E1-048 · README:2950
> `standard` | normative | `STD-` | Formatting, coding convention, architectural guideline

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:28-29`; `config/add-standard` — created `STD-a-standard`.

---

### E1-049 · README:2951
> `adr` | rationale | `ADR-` | Formal decision record, MADR shape

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:60-61`; `config/add-adr` — created `ADR-a-adr` with no "governing this project" banner (rationale tier).

---

### E1-050 · README:2952
> `assumption` | rationale | `ASSUME-` | Unverified premise plus validation deadline

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:68-69`; `config/add-assumption` — created `ASSUME-a-assumption`.

---

### E1-051 · README:2953
> `decision` | rationale | `DEC-` | Lightweight decision not warranting a full ADR

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:62-63`; `config/add-decision` — created `DEC-a-decision`.

---

### E1-052 · README:2954
> `edge_case` | rationale | `EDGE-` | Boundary condition; frequently worth promoting

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:70-71`; `config/add-edge_case` — created `EDGE-a-edge-case`.

---

### E1-053 · README:2955
> `lesson` | rationale | `LESSON-` | What was learned; source material for generated rules

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:64-65`; `config/add-lesson` — created `LESSON-a-lesson`.

---

### E1-054 · README:2956
> `reference` | rationale | `REF-` | A snapshot of a file, with its origin recorded so doctor reports drift

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:84-85`; `own-run/add-reference` — created `REF-roadmap` with the rationale-tier budget note.

---

### E1-055 · README:2957
> `risk` | rationale | `RISK-` | May occur and would harm

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:72-73`; `config/add-risk` — created `RISK-a-risk`.

---

### E1-056 · README:2958
> `tradeoff` | rationale | `TRADE-` | What was sacrificed for what

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:66-67`; `config/add-tradeoff` — created `TRADE-a-tradeoff`.

---

### E1-057 · README:2964
> The neighbour relation is not symmetric — `rule` names `standard` while `standard` names `pattern`

**Verdict:** VERIFIED
**Citation:** `own-run/help-categories` — the `rule` entry reads "Nearest neighbour: `standard`" (README:3080) and the `standard` entry reads "Nearest neighbour: `pattern`" (README:3105), both byte-identical to live output per `own-run/help-categories-diff`.

---

### E1-058 · README:2968
> The table above is what *this project* accepts; the entries below describe the catalogue's own types.

**Verdict:** VERIFIED
**Citation:** `my-context/src/help/index.ts:116` — `helpTopic` expands `{{CATEGORY_TABLE}}` from `categoryTable(config, locale)`, i.e. the resolved per-project config, while the prose entries are static topic text; `config/profile-minimal-disabled-category` shows a catalogue type absent from a project's accepted set.

---

### E1-059 · README:2973
> Run `mycontext examples <type> --short` for a worked specimen of any of them.

**Verdict:** VERIFIED
**Citation:** `my-context/src/cli/index.ts:709-727` — `EXAMPLES_USAGE = 'usage: mycontext examples <category> [--short]'`, dispatching to `exampleItemShort`; `own-run/examples-short` ran it for ten types, all exit 0.

---

### E1-060 · README:3015
> Nothing pins it for you: an instruction is created with `always: false` like every other item.

**Verdict:** VERIFIED
**Citation:** `own-run/instruction-default` — `mycontext add instruction "An instruction" --yes` then `show` returned `always: false`; `my-context/src/core/mutate.ts:278` sets `severity: input.severity ?? 'soft'` in the same default block.

---

### E1-061 · README:3046
> It carries `blocks`, naming what is waiting on the answer.

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:38-39` — `open_question` declares `extraFields: ['blocks']`.

---

### E1-062 · README:3067
> It carries `kind`, which is where functional and non-functional live

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:26-27` — `requirement` declares `extraFields: ['kind']`; `own-run/examples-short` shows `kind: functional` on the requirement specimen.

---

### E1-063 · README:3076
> It carries `directive: do | dont`

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:24-25` — `rule` declares `extraFields: ['directive']`; `own-run/examples-short` shows `directive: dont`.

---

### E1-064 · README:3121
> It carries `validate_by` … and `validated_on`

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:68-69` — `assumption` declares `extraFields: ['validate_by', 'validated_on']`.

---

### E1-065 · README:3165
> `valid_until` … is a lifecycle record of the day an item stopped being current, stamped when an item is retired and cleared when it is un-retired, and no capture or edit surface accepts one on an active item.

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/persist.ts:249-255` — `stampValidUntil` sets `today()` when `isRetired(status)` and `null` otherwise; `my-context/src/core/mutate.ts:407-417` and `my-context/src/mcp/tools.ts:451-470` — neither `UpdateInput` nor the `create_item` schema exposes `valid_until`; `own-run/known-issue-retire` — after `--status deprecated`, `show` reported `valid_until: 2026-08-17`.

---

### E1-066 · README:3168
> retire the item with `mycontext edit <id> --status deprecated` when the breakage is fixed

**Verdict:** VERIFIED
**Citation:** `own-run/known-issue-retire` — `mycontext edit KNOWN-sandbox-declines-cards --status deprecated --yes` returned `my_context: updated KNOWN-sandbox-declines-cards (deprecated).`

---

### E1-067 · README:3174
> It is a **normative** type

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:57-58` — `known_issue: def('known_issue', 'KNOWN', 'normative', true, …)`.

---

### E1-068 · README:3183
> **a known issue an agent captures lands as a `draft`** and governs nothing until a human promotes it

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/trust.ts:166-168` — `trustedStatus`: `if (origin !== 'human' && tier === 'normative') return 'draft';`, combined with `known_issue`'s normative tier (`categories.ts:57`).

---

### E1-069 · README:3187
> `mycontext add known_issue "…" --yes`, which lands active

**Verdict:** VERIFIED
**Citation:** `own-run/known-issue-add` — `mycontext add known_issue "Sandbox declines cards" --yes` printed `created KNOWN-sandbox-declines-cards (active)`.

---

### E1-070 · README:3188
> A project that would rather have them land active from an agent can set `categories.known_issue.tier` to `rationale`

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/config.ts:538-546` — a `tier` override is applied to a built-in category; `my-context/src/core/trust.ts:166-168` — `trustedStatus` returns the requested status once the resolved tier is not `normative`.

---

### E1-071 · README:3205
> Capture it with `mycontext add reference "Roadmap" --file docs/roadmap.md`: the body becomes a **snapshot** of that file, and the item records `source_file` and `source_checksum` so `mycontext doctor` reports `source_drift` when the file has moved on.

**Verdict:** VERIFIED
**Citation:** `own-run/add-reference` — that exact command printed `snapshotting docs/roadmap.md — 2 line(s), 21 bytes` and `show REF-roadmap` returned `source_file: docs/roadmap.md`, `source_checksum: b6858b03a6cae635`; `my-context/src/doctor/checks.ts:240` — `{ level: 'warn', code: 'source_drift', item: item.id, … }`.

---

### E1-072 · README:3214
> the file is read at capture and at `mycontext refresh <id>`, and never in between

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/persist.ts:88` — the stored body is the snapshot, a stale one being "`source_drift`" rather than a re-read; `my-context/src/mcp/tools.ts:543-547` — "It takes an id and NO content: the server re-reads the item's own `source_file`", the only re-read path besides capture.

---

### E1-073 · README:3220
> `mycontext refresh <id>` re-reads the file, shows the size change, and asks before it writes.

**Verdict:** VERIFIED
**Citation:** `own-run/refresh-prompt` — after editing `docs/roadmap.md`, `mycontext refresh REF-roadmap` printed `checksum b6858b03a6cae635 -> 26a5cd654e540e91`, `size 2 -> 3 line(s), ~6 -> ~9 estimated tokens`, then exited 1 with `refusing without confirmation … Rerun with --yes to confirm`.

---

### E1-074 · README:3221
> An agent's route is the `refresh_item` tool, which goes through the same policy as any other content change: on a category set to `agentEdits: "review"` it stages a pending revision instead of writing.

**Verdict:** VERIFIED
**Citation:** `my-context/src/mcp/tools.ts:550-556` — "it calls `updateItem` with `origin: 'agent'`, so on a category set to `agentEdits: \"review\"` … the new snapshot is STAGED as a pending revision and the item is untouched until a human promotes it"; `:564` declares `name: 'refresh_item'`.

---

### E1-075 · README:3223
> There is no agent-facing capture — a reference enters the corpus only by a human command.

**Verdict:** VERIFIED
**Citation:** `my-context/src/mcp/tools.ts:558-562` — "There is deliberately NO agent-facing capture. A reference enters the corpus only through `mycontext add <category> \"<title>\" --file <path>`, a human command"; `my-context/src/mcp/tools.ts:451-470` — the `create_item` schema exposes no `file`/`source_file` parameter.

---

### E1-076 · README:3226
> **On the rationale tier, where it ships, a reference costs the injection budget nothing** — it is never injected in full and is not named in the session index, only counted.

**Verdict:** VERIFIED
**Citation:** `own-run/add-reference` — the CLI itself printed "this category is on the rationale tier, so the item is never injected in full and costs the injection budget nothing. It is stored, searchable, and counted in the session index."; `my-context/src/core/select.ts:473`.

---

### E1-077 · README:3228
> the snapshot then competes for the budget like any other item … and one that does not fit spills whole and is disclosed by id

**Verdict:** VERIFIED
**Citation:** `own-run/reference-spill` — with `{"categories":{"reference":{"tier":"normative"}},"budgets":{"pinned":1}}` and `REF-roadmap` pinned, the SessionStart hook admitted no full text and emitted `_1 item(s) omitted from full text for budget: REF-roadmap. Fetch with mycontext show <id>._`; corroborated by `config/budgets-spill-pinned` (two pinned items against a 40-token `pinned` budget, both named).
**Note:** The item genuinely entered the pinned tier and the limit was genuinely reached — the index line still listed `REF-roadmap`, while the full-text block was empty and the omission note named it.

---

### E1-078 · README:3231
> **and the file's content becomes governing knowledge**

**Verdict:** VERIFIED
**Citation:** `own-run/reference-retier` — retiering `reference` to `normative` moved `REF-roadmap` from a bare rationale count into the named `## my_context index` list of governing items; `my-context/src/core/config.ts:538-546`.

---

### E1-079 · README:3243
> It carries `likelihood` and `impact`

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:72-73` — `risk` declares `extraFields: ['likelihood', 'impact']`.

---

### E1-080 · README:3260
> `update_item` cannot re-file an item under a different type … A misfiled item is recovered by `create_item`-ing a correctly-typed replacement and `supersede_item`-ing the original onto it

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/mutate.ts:407-417` — `UpdateInput` has no `type`; `:420-424` — `SupersedeInput { id, by, reason, origin }`; `my-context/src/core/rebuild.ts:146`.

---

### E1-081 · README:3271
> `mycontext examples <category>` prints a complete item exactly as it is stored — … every frontmatter key and the checksum included.

**Verdict:** VERIFIED
**Citation:** `own-run/examples-full` — `mycontext examples rule` printed the full frontmatter block including `status`, `origin`, the three `source_*` keys, `valid_from`, `valid_until`, `checksum: 0040bc230528c1af` and `directive: dont`; `my-context/src/help/index.ts:378` — `return renderItem(exampleItemOf(type, config));`.

---

### E1-082 · README:3273
> `--short` prints the same specimen cut to what its category alone decides: the id, the title, the category-specific frontmatter fields, and the body.

**Verdict:** CONTRADICTED
**Citation:** `my-context/src/help/index.ts:414-431` — `exampleItemShort` also emits `source_file` (`:423`), `severity: hard` (`:425`), `always: true` (`:426`) and an `observations:` line (`:427-429`). None of those four are category-specific frontmatter fields: `severity`, `always` and `source_file` are on every item (`my-context/src/core/item.ts:36-39`, `COMMON_KEYS`) and `observations` are not frontmatter at all. Expected: exactly id, title, category-specific fields, body. Actual: the README's own adjacent specimens contradict the list — the `constraint` block at README:3287-3288 shows `severity: hard` and `observations: limit` although `constraint` declares `extraFields: []` (`categories.ts:20-21`), and the `instruction` block at README:3324 shows `always: true` although `instruction` declares `extraFields: []` (`categories.ts:34-35`). Reproduced by `own-run/examples-short`.
**Note:** The source docstring the sentence is copied from (`help/index.ts:382-383`) carries the same omission, and is corrected four lines later by its own bullet list (`:402-408`), which names `severity`/`always`/observations explicitly.

---

### E1-083 · README:3278
> Every block below is real output, regenerated by `npm run gen:docs` and re-run by the test suite.

**Verdict:** VERIFIED
**Citation:** `own-run/examples-short` — all ten specimen blocks in range (README:3283-3397) are byte-identical to live `mycontext examples <type> --short` output; `my-context/package.json:14`; `my-context/test/docs/examples.test.ts:13`.

---

### E1-084 · README:3279
> The order is the table's: the normative types first, then the rationale ones.

**Verdict:** CONTRADICTED
**Citation:** The table (README:2936-2958, verified against `my-context/src/core/categories.ts:57-58`) lists `known_issue` as the sixth **normative** row, between `invariant` and `non_goal`. The specimen blocks run `… invariant (3332) → non_goal (3344) …` with no `known_issue`, and place `<!-- example: examples known_issue --short -->` at README:3473 — between `edge_case` (3462) and `lesson` (3486), i.e. inside the rationale run. Expected: `known_issue` between `invariant` and `non_goal`. Actual: `known_issue` after `edge_case`, so a normative type appears among the rationale ones.

---

### E1-085 · README:3284
> ```text
> id: CONST-postgres-connection-pool-capped-at-20 … RDS permits 25 connections; 5 are reserved for migrations and the admin console.
> ```

**Verdict:** VERIFIED
**Citation:** `own-run/examples-short` — `mycontext examples constraint --short` reproduced all six lines exactly.

---

### E1-086 · README:3297
> ```text
> id: ENV-staging-talks-to-the-real-stripe-api-local-does-not … only bites live.
> ```

**Verdict:** VERIFIED
**Citation:** `own-run/examples-short` — `mycontext examples environment --short` reproduced all six lines exactly.

---

### E1-087 · README:3310
> ```text
> id: GLOSS-tenant-means-a-paying-organisation-not-a-user … Never "account".
> ```

**Verdict:** VERIFIED
**Citation:** `own-run/examples-short` — `mycontext examples glossary --short` reproduced all four lines exactly.

---

### E1-088 · README:3321
> ```text
> id: INSTR-run-the-test-suite-before-proposing-a-change-is-complete … always: true …
> ```

**Verdict:** VERIFIED
**Citation:** `own-run/examples-short` — `mycontext examples instruction --short` reproduced all five lines exactly, `always: true` included.

---

### E1-089 · README:3333
> ```text
> id: INV-order-total-always-equals-the-sum-of-its-line-items … must fail loudly.
> ```

**Verdict:** VERIFIED
**Citation:** `own-run/examples-short` — `mycontext examples invariant --short` reproduced all five lines exactly.

---

### E1-090 · README:3345
> ```text
> id: NOGOAL-we-are-not-building-offline-support … Do not add local queues or sync reconciliation.
> ```

**Verdict:** VERIFIED
**Citation:** `own-run/examples-short` — `mycontext examples non_goal --short` reproduced all four lines exactly.

---

### E1-091 · README:3356
> ```text
> id: OPENQ-do-we-shard-by-tenant-or-by-region … Do not assume either.
> ```

**Verdict:** VERIFIED
**Citation:** `own-run/examples-short` — `mycontext examples open_question --short` reproduced all four lines exactly.

---

### E1-092 · README:3367
> ```text
> id: PAT-repository-objects-wrap-every-query-handlers-never-open-a … makes the pool cap enforceable.
> ```

**Verdict:** VERIFIED
**Citation:** `own-run/examples-short` — `mycontext examples pattern --short` reproduced all four lines exactly, truncated id included.

---

### E1-093 · README:3378
> ```text
> id: REQ-users-can-reset-their-password-without-support … kind: functional … expires after 30 minutes.
> ```

**Verdict:** VERIFIED
**Citation:** `own-run/examples-short` — `mycontext examples requirement --short` reproduced all five lines exactly.

---

### E1-094 · README:3390
> ```text
> id: RULE-never-log-request-bodies-on-auth-endpoints … directive: dont … logs are retained for 90 days.
> ```

**Verdict:** VERIFIED
**Citation:** `own-run/examples-short` — `mycontext examples rule --short` reproduced all five lines exactly.
