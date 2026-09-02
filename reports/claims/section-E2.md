# Section E2 — README lines 3401–4007

99 claims: 95 VERIFIED, 1 CONTRADICTED, 3 UNVERIFIED.

Scope: the second half of "6. Configuration" — the tail of the category catalogue,
custom categories, profiles, per-category settings (`enabled`, `tier`, `agentEdits`,
`scopePolicy`, `prefix`), `budgets`, `watchedDocs`, scope globs, `always`, and the
replace-vs-merge rules.

Own-run citations are marked `own-run/<id>` and were produced in temp workspaces under
`$TEMP` (scripts in the session scratchpad; nothing under `my-context/` was touched).

---

### E2-001 · README:3403
> id: RUN-rotating-the-stripe-webhook-secret

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:40` — `runbook` is defined with prefix `RUN`.

### E2-002 · README:3416
> id: STD-every-exported-function-carries-a-doc-comment

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:28` — `standard` → prefix `STD`.

### E2-003 · README:3427
> id: ADR-use-sqlite-with-jsonb-for-the-local-index / observations: driver, option, consequence

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:60` — `adr` → prefix `ADR`.
**Note:** `adr` declares no `extraFields`; `observations` is a generic field on every item, so the specimen's `observations:` line is not a category-specific field claim.

### E2-004 · README:3435
> **`assumption`** — `validate_by` reads `<a year from today>` … the specimen stamps a deadline the day it is printed

**Verdict:** UNVERIFIED
**Reason:** the README block is a generated placeholder, not a captured run, so there is no output in which a real date could be compared against the generation date.

### E2-005 · README:3441
> id: ASSUME-peak-traffic-stays-under-500-requests-per-second … validate_by: <a year from today>

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:68` — `assumption` → prefix `ASSUME`, `extraFields: ['validate_by', 'validated_on']`.

### E2-006 · README:3453
> id: DEC-slug-ids-rather-than-sequential-ids

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:62` — `decision` → prefix `DEC`.

### E2-007 · README:3464
> id: EDGE-checkout-with-an-empty-cart

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:70` — `edge_case` → prefix `EDGE`.

### E2-008 · README:3475
> id: KNOWN-the-stripe-sandbox-declines-3ds-test-cards-at-random

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:57` — `known_issue` → prefix `KNOWN`, tier `normative`.

### E2-009 · README:3488
> id: LESSON-migrations-need-an-advisory-lock

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:64` — `lesson` → prefix `LESSON`.

### E2-010 · README:3500
> id: REF-billing-roadmap … source_file: docs/billing-roadmap.md

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:84` — `reference` → prefix `REF`; `source_file` is a universal item field (present in every `mycontext show` frontmatter, e.g. `own-run/X1`).

### E2-011 · README:3517
> id: RISK-vendor-rate-limit-could-throttle-bulk-imports … likelihood: medium / impact: high

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:72` — `risk` → prefix `RISK`, `extraFields: ['likelihood', 'impact']`.

### E2-012 · README:3530
> id: TRADE-hand-written-yaml-subset-instead-of-a-parser-dependency

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:66` — `tradeoff` → prefix `TRADE`.

### E2-013 · README:3537
> That is every category in the catalogue — twenty-one specimens, twenty-one types

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:19-86` — `CATEGORIES` holds exactly 21 entries (13 normative, 8 rationale).

### E2-014 · README:3538
> A category you declare yourself is the one case `mycontext examples` cannot answer with real content, and it says so rather than inventing one.

**Verdict:** VERIFIED
**Citation:** `own-run/C1` — `mycontext examples security_control` in a workspace declaring that custom category emits a template whose body is the category's own `description` followed by "Replace this body with the real content and reason.", rather than a worked specimen.

### E2-015 · README:3542
> **One question about this catalogue is open, and it is the owner's to close.**

**Verdict:** UNVERIFIED
**Reason:** a governance statement about an undecided question, not a checkable behaviour; `docs/ROADMAP.md:378` confirms Q5 is open (see E2-017) but cannot confirm whose call it is.

### E2-016 · README:3544
> a runbook item is normative and can be injected when work touches the paths it names, while a reference is rationale and is never injected in full

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:40` (`runbook` … `'normative'`) and `:84` (`reference` … `'rationale'`); `my-context/src/core/select.ts:192` and the `isNormative` filter it documents at `categories.ts:74-83` — a rationale item is never admitted to a full-text tier.

### E2-017 · README:3549
> whether `runbook` keeps its entry is tracked as Q5 in [`docs/ROADMAP.md`](docs/ROADMAP.md)

**Verdict:** VERIFIED
**Citation:** `my-context/docs/ROADMAP.md:378` — "| Q5 | Does `runbook` survive if `reference` ships? … Owner's call |".

### E2-018 · README:3554
> A name the catalogue does not have becomes a first-class category of this project the moment you declare it with a `tier` and a `description`

**Verdict:** VERIFIED
**Citation:** `config/custom-category-complete` — `add security_control "All admin endpoints require MFA" --yes` exits 0 and creates the item; `my-context/src/core/config.ts:488-526` is the branch that mints it.

### E2-019 · README:3581
> Both keys are required. A name the catalogue does not have with either one missing is an error at load time rather than a category quietly ignored

**Verdict:** VERIFIED
**Citation:** `config/custom-category-missing-tier` and `config/custom-category-missing-description` — both exit 1 on a bare `mycontext status` with the message quoted at README:3586, verbatim.

### E2-020 · README:3589
> `mycontext add security_control "All admin endpoints require MFA" --scope "src/admin/**" --yes` creates `SECURI-all-admin-endpoints-require-mfa` under `items/security_control/`

**Verdict:** VERIFIED
**Citation:** `config/custom-category-complete` — stdout is exactly the two lines quoted at README:3594-3595, including the path `items/security_control/SECURI-all-admin-endpoints-require-mfa.md`.

### E2-021 · README:3598
> It gets a row in `mycontext help categories`

**Verdict:** VERIFIED
**Citation:** `own-run/C2` — `mycontext help categories` prints `| `security_control` | normative | `SECURI-` | A control the system must implement to satisfy a security requirement |`.

### E2-022 · README:3599
> It is listed by `mycontext list`, has a template under `mycontext examples security_control`, is checked by `mycontext doctor` and is queryable by `mycontext query`.

**Verdict:** VERIFIED
**Citation:** `own-run/C3` — `list security_control` shows the row; `own-run/C1` shows the template; `own-run/C3` shows `doctor` raising a `dead_scope` warning against `SECURI-all-admin-endpoints-require-mfa`; `own-run/Q1` — `mycontext query -- "SELECT id, type FROM items WHERE type = 'security_control'"` returns the row.
**Note:** `query` takes SQL after a `--` separator; `--type` is not a flag it accepts.

### E2-023 · README:3601
> Because it is normative it is injected when a file under `src/admin/` is touched, and `mycontext pin` puts it in every session.

**Verdict:** VERIFIED
**Citation:** `own-run/C4` — a PreToolUse payload for `src/admin/users.js` returns the item in `additionalContext` with `_scope: src/admin/**_`; `own-run/C5` — `mycontext pin SECURI-… --yes` previews `always no -> yes` / "PINNED — injected in full at every session start".

### E2-024 · README:3602
> The `create_item` tool accepts it and lands an agent's version as a draft, exactly as for a built-in.

**Verdict:** VERIFIED
**Citation:** `own-run/C6` — `create_item {type: security_control}` returns "created SECURI-agent-captured-control (draft) … It is a draft because non-human-authored normative items are not injected until reviewed".

### E2-025 · README:3604
> And the six per-category keys — `enabled`, `tier`, `description`, `prefix`, `agentEdits`, `scopePolicy` — all apply to it.

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/config.ts:197-199` (`CATEGORY_KEYS`, exactly those six) and `:507-525` — the custom-category branch reads `prefix`, `enabled`, `tier`, `description`, `agentEdits` and `scopePolicy`; `config/category-extraFields-refused` echoes the same six back in its refusal.

### E2-026 · README:3610
> `type` is fixed at creation, so a misfiled item stays misfiled.

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/mutate.ts:407-418` — `UpdateInput` has no `type` field; `own-run/P4` — `update_item` enumerates what it accepts (`id, title, body, scope, tags, severity, always, status, extra`) and `type` is absent.

### E2-027 · README:3615
> The id prefix is derived from the name unless you set one. It is the first six letters and digits of the name, uppercased: `security_control` gives `SECURI-`.

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/config.ts:513` — `name.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase()`; `config/custom-category-complete` mints `SECURI-…`.

### E2-028 · README:3623
> Two names sharing their first six letters and digits — `standard_ops` and `standardize` — resolve to the same prefix, and nothing warns

**Verdict:** VERIFIED
**Citation:** `own-run/P1` — a config declaring both custom categories loads clean (`mycontext status` exits 0, "0 error(s), 0 warning(s), 0 note(s)"), and the two adds mint `STANDA-one` and `STANDA-two`.

### E2-029 · README:3625
> **`prefix` works on a built-in too**: `{ "rule": { "prefix": "POLICY" } }` mints new rules as `POLICY-…`.

**Verdict:** VERIFIED
**Citation:** `config/category-prefix-override` — `add rule "Write the failing test first" --yes` creates `POLICY-write-the-failing-test-first`; `my-context/src/core/config.ts:572-574`.

### E2-030 · README:3626
> Ids already on disk keep the ones they were created with … so a project that changes this ends up with both, and `mycontext list rule` finds them all either way.

**Verdict:** VERIFIED
**Citation:** `own-run/PX` — a rule captured before the override and one after list together as `POLICY-second-rule` and `RULE-first-rule`, both `type rule`.

### E2-031 · README:3628
> The value must be one to twelve letters or digits and nothing else

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/config.ts:258` — `/^[A-Za-z0-9]{1,12}$/`; `config/category-prefix-invalid` exits 1 with the message quoted at README:3632 (verbatim modulo the offending value).

### E2-032 · README:3635
> A custom category has no category-specific frontmatter fields. … so a `security_control` cannot carry a `control_id`.

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/config.ts:518` — the custom branch hardcodes `extraFields: []`; `own-run/C7` — `create_item {type: security_control, control_id: 'C-1'}` is refused by name.

### E2-033 · README:3638
> Writing `extraFields` in config is refused rather than ignored, and says where those fields do come from

**Verdict:** VERIFIED
**Citation:** `config/category-extraFields-refused` — exit 1, stdout matches README:3641-3642 verbatim, including the `src/core/categories.ts` hint paragraph.

### E2-034 · README:3645
> Any other key a category entry does not understand is refused the same way, by name.

**Verdict:** VERIFIED
**Citation:** `config/category-unknown-key-refused` — `category "rule" declares "nope", which is not a key this config understands…`, exit 1.

### E2-035 · README:3646
> `create_item` refuses an undeclared field rather than dropping it too

**Verdict:** VERIFIED
**Citation:** `own-run/C7` — output is the message at README:3649 verbatim, including the full accepted-argument list `type, title, body, scope, tags, severity, always, observations, source_file, source_anchor, blocks, directive, impact, kind, likelihood, validate_by, validated_on`.

### E2-036 · README:3654
> The generator (`src/plugin/commands.ts`) does build `/mycontext:add-<name>` and `/mycontext:list-<name>` for every enabled category in whatever configuration it is handed, custom ones included, and refuses two names that would produce the same command file.

**Verdict:** VERIFIED
**Citation:** `my-context/src/plugin/commands.ts:156` (`file: \`add-${commandSlug(category.name)}.md\``), `:258` (`list-${slug}.md`), `:36-45` and `:930` — `commandSlug` maps `_`→`-` and `generateCommands` throws on a collision.
**Note:** the generated name is the kebab-cased category (`add-non-goal`, `add-edge-case`), not the raw snake_case `<name>`.

### E2-037 · README:3657
> `commands/` is generated and committed when the plugin is built, from the default configuration, so a category you declare has no slash command in your project.

**Verdict:** VERIFIED
**Citation:** `my-context/commands/` holds 21 `add-*.md` and 21 `list-*.md` files, one per catalogue category, and no `add-security_control.md` / `add-security-control.md` after `own-run/C3` declared and used that category.

### E2-038 · README:3664
> The catalogue holds **21** categories, and `standard` — what `mycontext init` writes — enables all **21** of them. Nothing ships switched off.

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:19-86` — 21 entries, every one `defaultEnabled: true`, and `PROFILES.standard` (`:118-120`) is the `defaultEnabled` filter; `own-run/I1` — `mycontext init` writes `{"profile": "standard", "categories": {}, "budgets": {}}`.

### E2-039 · README:3667
> Three categories, `policy`, `postmortem` and `taxonomy`, shipped disabled … they were **removed**, and `known_issue`, `runbook` and `environment` took their places.

**Verdict:** VERIFIED
**Citation:** `my-context/docs/ROADMAP.md:275` (D1.6, "With `policy`, `postmortem` and `taxonomy` gone…"), `my-context/src/core/categories.ts:96-112` (the same account in the `PROFILES` doc comment), and `categories.ts:40,42,57` — `runbook`, `environment` and `known_issue` are present while the three named are absent.
**Note:** the citation is the project's own change record; the historical state is not otherwise reproducible from the shipped build.

### E2-040 · README:3670
> Since a type cannot be changed after creation, two overlapping types enabled at once is an invitation to file the same fact under both and have no way to reconcile them — which is why they were off.

**Verdict:** UNVERIFIED
**Reason:** a statement of past design intent for categories that no longer exist in the shipped catalogue; no behaviour to exercise.

### E2-041 · README:3682
> With them gone the two names resolved to the same twenty categories

**Verdict:** VERIFIED
**Citation:** `my-context/docs/ROADMAP.md:275` — "`minimal` (8) and `standard` (20 at the time; 21 since `reference` landed) remain."

### E2-042 · README:3685
> **A `config.json` that still says `"profile": "full"` is refused at load time**, by name, with the valid set and the replacement in the message; it is not resolved quietly to `standard`.

**Verdict:** VERIFIED
**Citation:** `config/profile-full-refused` — exit 1 on `mycontext status`: `unknown profile "full". Expected one of: minimal, standard.` followed by the `PROFILE_HINTS` paragraph naming `standard` as the replacement.

### E2-043 · README:3691
> `minimal` … three normative types (`constraint`, `invariant`, `rule`) and five rationale ones (`adr`, `assumption`, `edge_case`, `lesson`, `tradeoff`). Eight in all

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/categories.ts:114-117` — `PROFILES.minimal` is exactly those eight names; their tiers at `:20,22,24,60,68,70,64,66` give the 3/5 split. `config/profile-minimal-disabled-category` shows `runbook` refused under `minimal`.

### E2-044 · README:3699
> If a category disappears from the catalogue — or you rename one in your own config after capturing items under the old name — **the items stay**. They are still on disk, still indexed, still in `mycontext list`, still returned by `mycontext show` and `query_items`.

**Verdict:** VERIFIED
**Citation:** `own-run/U1` (`mycontext list` shows `POLICY-customer-data-never-leaves-the-eu · policy · active` after the category is removed from config), `own-run/X1` (`mycontext show` prints its full frontmatter and body), `own-run/U6` (`query_items` returns it).
**Note:** `config/unknown-category-still-indexed` does NOT support this claim — that record ran `doctor` against a workspace with 0 items and reported 0 findings, so it never reached the behaviour.

### E2-045 · README:3706
> No tier admits a category nothing defines, so it is never injected, and the session-start index counts it — `1 policy (disabled/unknown category)` — rather than naming it.

**Verdict:** VERIFIED
**Citation:** `own-run/U5` — the PreToolUse hook emits nothing for `src/x.js`; `own-run/U4` — the SessionStart hook prints `## my_context index` followed by exactly `1 policy (disabled/unknown category)`.

### E2-046 · README:3708
> Every command that opens the corpus prints a load error naming the file, and `mycontext doctor` reports one `unknown_category` warning per item.

**Verdict:** VERIFIED
**Citation:** `own-run/U1`, `own-run/U3`, `own-run/U6` — `list`, `doctor` and the MCP surface each print `my_context: error  items/policy/POLICY-customer-data-never-leaves-the-eu.md: …`; `own-run/U3` reports `unknown_category (1)  [warn]`.

### E2-047 · README:3713
> unknown_category (1)  [warn] / POL-…: declares type "policy", which this project's config does not define … There is no retype — "type" is fixed at creation and decides where the file lives — so there are two routes.

**Verdict:** VERIFIED
**Citation:** `own-run/U3` — the doctor finding reproduces the quoted text word for word, and continues into the two routes ("Keep the category… Or migrate the item…").
**Note:** the id in the README block reads `POL-…`; a `policy` category declared today derives prefix `POLICY` (`config.ts:513`), so the specimen's id reflects the built-in prefix from before removal and cannot be reproduced as written.

### E2-048 · README:3725
> **Keep the category.** Declare it in `.my_context/config.json` with a `tier` and a `description` … and it is a first-class category of your project again — id prefix, injection, slash commands from `mycontext add`, all of it.

**Verdict:** VERIFIED
**Citation:** `own-run/U7` — after re-adding `{"categories": {"policy": {"tier": "normative", "description": "House policy"}}}`, the same PreToolUse payload that produced nothing at `own-run/U5` now injects `### POLICY-customer-data-never-leaves-the-eu · policy · Customer data never leaves the EU`.

### E2-049 · README:3730
> **Migrate the item.** Capture a replacement under a live category and run `mycontext supersede POL-… --by RULE-…`, which retires the original, stamps its `valid_until`, and records a `superseded_by` relation between the two.

**Verdict:** VERIFIED
**Citation:** `own-run/X2` / `own-run/X3` — supersede works on an item whose category is unknown; readback shows `status: superseded`, `valid_until: 2026-08-17`, and `## Relations — superseded_by [[RULE-customer-data-stays-in-the-eu]]`, with the reciprocal `supersedes` on the replacement.

### E2-050 · README:3734
> **there is no retype.** `type` is fixed at creation and decides which directory the file lives in, so an existing `policy` cannot become a `rule`.

**Verdict:** VERIFIED
**Citation:** `own-run/P4` — `update_item` refuses any argument outside `id, title, body, scope, tags, severity, always, status, extra`; `own-run/U1` shows the file at `items/policy/…` keyed by type.

### E2-051 · README:3745
> With that set, `mycontext add standard "…"` is refused rather than accepted

**Verdict:** VERIFIED
**Citation:** `own-run/E1` — with `{"categories": {"standard": {"enabled": false}}}`, `add standard` exits 1 with the message quoted at README:3748 verbatim; `config/category-disabled` is the same template on `runbook`.

### E2-052 · README:3751
> The existing `STD-api-errors-use-problem-json` still appears in `mycontext list`, and the session-start index counts it as `1 standard (disabled/unknown category)` rather than listing it.

**Verdict:** VERIFIED
**Citation:** `own-run/E2` (list shows `STD-api-errors-use-problem-json · standard · active`) and `own-run/E3` (SessionStart prints `1 standard (disabled/unknown category)`).

### E2-053 · README:3753
> The slash commands do not follow this switch: `/mycontext:add-standard` and `/mycontext:list-standard` stay on disk

**Verdict:** VERIFIED
**Citation:** `my-context/commands/add-standard.md` and `my-context/commands/list-standard.md` are committed files, unaffected by any project's `config.json`; the generator runs at build time (`src/plugin/commands.ts:156,258`).

### E2-054 · README:3760
> A category's tier decides whether its items can be injected. Moving `standard` from `normative` to `rationale` … changes the session-start index from listing the item by name to counting it.

**Verdict:** VERIFIED
**Citation:** `own-run/T1` → `- STD-api-errors-use-problem-json · standard · API errors use Problem JSON` plus `1 decision · 1 lesson`; `own-run/T2`, after `{"categories": {"standard": {"tier": "rationale"}}}` → no named line, `1 decision · 1 lesson · 1 standard`.

### E2-055 · README:3784
> An agent cannot change a governing item's `scope`, `always`, `severity` or `status`.

**Verdict:** VERIFIED
**Citation:** `own-run/A2`, `own-run/A3`, `own-run/A4` — `update_item` on an active rule is refused for `severity`, `always` and `scope`; `mcp/update_item-status-on-normative-refused` for `status`.

### E2-056 · README:3796
> `allow` | applies immediately, and the agent is told `updated`

**Verdict:** VERIFIED
**Citation:** `own-run/A1` — with `{"categories": {"rule": {"agentEdits": "allow"}}}`, an agent `update_item` title change on the active `RULE-never-log-customer-email` returns `my_context: updated RULE-never-log-customer-email (active).`

### E2-057 · README:3797
> `review` | is **staged as a pending revision**. The item is untouched and keeps governing its current text until you promote the change

**Verdict:** VERIFIED
**Citation:** `mcp/update_item-title-effect` — `update_item` returns "NOT applied — staged as revision REV-00a46a85254c", and the subsequent `get_item` readback shows `title: Original Title` unchanged, with a trailing "1 pending revision(s) … It has NOT been applied" notice.

### E2-058 · README:3799
> **"Content" means the title, the body, the tags and the `extra` fields** — not the body alone.

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/trust.ts:323-331` — `UPDATE_FIELD_POLICY` classifies `title`, `body`, `tags`, `extra` as `content` and `scope`, `always`, `severity`, `status` as `gated`; behaviourally `own-run/B1` (body), `own-run/B3` (extra/`directive`) and `own-run/B4` (tags) all stage under `review`, alongside `mcp/update_item-title-effect` (title).

### E2-059 · README:3809
> `observations` cannot be changed by any surface, by anyone, after capture

**Verdict:** VERIFIED
**Citation:** `own-run/P4` — `mycontext edit --observations` → `unknown option "--observations"`; `update_item {observations: […]}` → `update_item does not take "observations"`. `my-context/src/core/mutate.ts:407-418` — `UpdateInput` declares no `observations`.

### E2-060 · README:3814
> An agent that changes `extra` **and** a field a revision cannot carry — `scope`, `always`, `severity`, `status` — in one call is refused outright rather than half-applied.

**Verdict:** VERIFIED
**Citation:** `own-run/B2` — `update_item {extra: {directive: 'do'}, scope: ['src/**']}` on a governing rule under `review` is refused outright, nothing applied and nothing staged; `my-context/src/core/mutate.ts:636-648` is the dedicated mixed-call refusal that covers the draft / rationale-under-review cases.

### E2-061 · README:3817
> The default comes from the category's **resolved** tier: `review` for every normative category, `allow` for every rationale one.

**Verdict:** VERIFIED
**Citation:** `own-run/t1-agentedits` — an agent `create_item` + `update_item` title change run against all 21 catalogue categories in one default-config workspace: all 13 normative categories (`constraint`, `invariant`, `rule`, `requirement`, `standard`, `pattern`, `glossary`, `instruction`, `non_goal`, `open_question`, `runbook`, `environment`, `known_issue`) returned "NOT applied — staged as revision"; all 8 rationale categories (`adr`, `decision`, `lesson`, `tradeoff`, `assumption`, `edge_case`, `risk`, `reference`) returned `my_context: updated …`. Source: `my-context/src/core/config.ts:106-108,464`.
**Note:** each update was content-only, so no gated-field guard could short-circuit it — the staging decision at `mutate.ts:623` was reached in every one of the 21 runs.

### E2-062 · README:3820
> It follows the tier you configure rather than the one the catalogue ships, so `{"categories": {"lesson": {"tier": "normative"}}}` moves `lesson` to `review` with it

**Verdict:** VERIFIED
**Citation:** `own-run/C2` (t2) — with `lesson` retiered to `normative`, an agent's title change on `LESSON-migrations-need-an-advisory-lock` returns "NOT applied — staged as revision REV-58fd3450833c"; source `my-context/src/core/config.ts:559-563`.

### E2-063 · README:3822
> and setting the key explicitly beats both

**Verdict:** VERIFIED
**Citation:** `own-run/D1` (t2) — `{"lesson": {"tier": "normative", "agentEdits": "allow"}}` yields `my_context: updated LESSON-migrations-need-an-advisory-lock (draft).`; `own-run/E1` (t2) — `{"decision": {"agentEdits": "review"}}` on a rationale category stages instead.

### E2-064 · README:3824
> The setting is read only for an agent. Your own edits — `mycontext edit`, `mycontext add`, `mycontext review promote` — pass a human origin and are never staged, whatever this says.

**Verdict:** VERIFIED
**Citation:** `own-run/B5` — under default `review`, `mycontext edit RULE-never-log-customer-email --body … --yes` applies immediately (`my_context: updated RULE-never-log-customer-email (active).`) while three agent-staged revisions sit pending; `my-context/src/core/mutate.ts:623` gates on `origin !== 'human'`.

### E2-065 · README:3831
> my_context: updated RULE-never-log-customer-email (active).

**Verdict:** VERIFIED
**Citation:** `own-run/A1` — byte-identical output from the real `update_item` tool under `agentEdits: "allow"`.

### E2-066 · README:3837
> my_context: NOT applied — staged as revision REV-76627cb9f4c6 for review. … Do not reason as if the new text is in force.

**Verdict:** VERIFIED
**Citation:** `own-run/B1` — the same message verbatim under default `review` (revision id and workspace path differ, as they must); `mcp/update_item-title-effect` is the second instance.

### E2-067 · README:3840
> **`allow` does not mean "agents may do anything to this category."** … `scope`, `always`, `severity` and `status` on a governing normative item stay human-only under either value … and the refusal names `mycontext edit` as the command a human has.

**Verdict:** VERIFIED
**Citation:** `own-run/A2`/`A3`/`A4` — with `rule` explicitly set to `agentEdits: "allow"`, `update_item` still refuses `severity`, `always` and `scope` on the active rule, each refusal naming "`mycontext edit RULE-never-log-customer-email --<field> …`"; `my-context/src/core/mutate.ts:618-619` documents that `allow` is read only on content.

### E2-068 · README:3848
> A value that is not `allow` or `review` is refused when the config loads, naming the key and both values.

**Verdict:** VERIFIED
**Citation:** `config/category-agentEdits-invalid` — exit 1: `my_context: "categories.constraint.agentEdits" must be one of: allow, review. You passed "nope".`

### E2-069 · README:3852
> An item with no `scope` is unrestricted by default: it applies to every file.

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/config.ts:116` (`DEFAULT_SCOPE_POLICY = 'global'`) and `select.ts:192`; `own-run/S11` — an unscoped rule is injected on a PreToolUse for `src/x.js`.

### E2-070 · README:3862
> `global` | applies to every file — the default, and today's behaviour

**Verdict:** VERIFIED
**Citation:** `own-run/Z1` — under default config, `query_items({path: 'src/x.js'})` returns both unscoped items with `scope (unrestricted)`.

### E2-071 · README:3863
> `required` | **refused when you capture it**: `mycontext add`, the `create_item` tool and ingest all say so and write nothing. Pass `--scope`. An edit that removes the last glob is refused too

**Verdict:** VERIFIED
**Citation:** `own-run/S1` (CLI `add pattern` with no scope, exit 1, "Nothing was written"), `config/category-scopePolicy-required` (same on `constraint`), `own-run/S3` (`edit PAT-scoped-one --scope ""` → exit 1, "Nothing was changed. Replace the globs rather than clearing them"), `my-context/src/ingest/schema.ts:364-370` (`scopeRequirementError` rejects the candidate on the ingest path). The `create_item` half is named in the same refusal text ("or the \"scope\" argument of create_item") and shares `mutate.ts`'s capture guard.

### E2-072 · README:3864
> `inert` | applies to no file: never injected just-in-time, and not returned by `query_items({path})`. It still appears in the session index, and `always: true` still pins it

**Verdict:** VERIFIED
**Citation:** `own-run/S8` (PreToolUse for `src/x.js` emits nothing with `rule` set to `inert`), `own-run/Z3` (`query_items({path: 'src/x.js'})` returns only the `constraint`, not the inert-policy rule, where `own-run/Z1` returned both), `own-run/S9` (the same rule is still named in the SessionStart index), `own-run/Z5` (after `mycontext pin`, it is injected in full at session start).

### E2-073 · README:3866
> `required` refuses at capture and never at injection: an item that exists and can never be injected is a trap, not a policy.

**Verdict:** VERIFIED
**Citation:** `own-run/S11` — an unscoped rule captured under `global` and then read under `required` is still injected on `src/x.js`; `own-run/S12` — doctor states it outright: "They are still injected on every file — \"required\" refuses at capture, never at injection".

### E2-074 · README:3869
> **Changing this setting does not rewrite anything you have already captured.** … its Markdown file never changed

**Verdict:** VERIFIED
**Citation:** `own-run/S5` vs `own-run/S6`/`own-run/S10` — the on-disk file for `RULE-unscoped-rule` is byte-identical before and after flipping `rule` to `inert` (same `checksum: 9b51540da4ebcae5`).

### E2-075 · README:3872
> `mycontext doctor` prints a `scope_policy_inert` (or `scope_policy_required`) note counting the items a policy change is currently changing the behaviour of.

**Verdict:** VERIFIED
**Citation:** `own-run/S7` — `scope_policy_inert (1)  [info]`; `own-run/S12` — `scope_policy_required (1)  [info]`.
**Note:** `config/category-scopePolicy-inert` does not support this — that record ran `doctor` on an empty workspace and reported 0 findings.

### E2-076 · README:3874
> an unscoped item's scope reads `(unrestricted)` under `global` and `required`, and `(inert)` under `inert`

**Verdict:** VERIFIED
**Citation:** `own-run/Z2` (`scope   (unrestricted)` under `global`), `own-run/Z4` (`scope   (inert)` for the same item after flipping to `inert`, while the `constraint` beside it still reads `(unrestricted)`), `own-run/S13` (`show`/reports under `required` read `(unrestricted)` — `own-run/U6`'s `query_items` line likewise).

### E2-077 · README:3881
> `{ "budgets": { "pinned": 6000, "jit": 6000, "restored": 8000, "index": 1200 } }` — Those are the defaults, in estimated tokens (characters divided by four)

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/config.ts:51` — `DEFAULT_BUDGETS: Budgets = { pinned: 6000, jit: 6000, restored: 8000, index: 1200 }`; `config/budgets-negative-refused` echoes the default `6000` for `pinned` in its refusal, and the refusal text names the unit "estimateTokens units (characters / 4)".

### E2-078 · README:3885
> Lowering one does not drop anything silently. With `"index": 30`, the example project's four index lines become one plus a count

**Verdict:** VERIFIED
**Citation:** `own-run/J2` — with `{"budgets": {"index": 30}}` and four invariants, the SessionStart index truncates and discloses the remainder as `- … +2 more (fetch with mycontext show <id>)`; `config/budgets-index-overflow` is the second instance (`… +1 more`).
**Note:** how many lines survive before the overflow marker depends on title lengths, so the specific "four become one" split is corpus-specific; the disclosure mechanism is what reproduces.

### E2-079 · README:3894
> and with `"jit": 40`, a file-triggered injection carries no full text at all, only the disclosure of what did not fit

**Verdict:** VERIFIED
**Citation:** `own-run/J1` — with `{"budgets": {"jit": 40}}` the PreToolUse `additionalContext` is exactly `_2 item(s) omitted from full text for budget: INV-prices-are-integer-cents, RULE-never-log-customer-email. Fetch with mycontext show <id>._`, matching README:3898 verbatim.

### E2-080 · README:3901
> A budget key the config does not understand (`"pined"` for `"pinned"`), or a value that is not a finite number greater than or equal to zero, is **refused** — the config does not load, and the message names the valid keys.

**Verdict:** VERIFIED
**Citation:** `config/budgets-unknown-key-refused` (exit 1, "Budgets accepts: pinned, jit, restored, index"), `config/budgets-negative-refused` (`-1`), `config/budgets-non-number-refused` (`"lots"`) — all exit 1 on a bare `mycontext status`.

### E2-081 · README:3905
> a top-level key this config does not understand (`"budget"`, `"watched_docs"`) is refused by name rather than accepted and dropped

**Verdict:** VERIFIED
**Citation:** `config/unknown-top-level-key-refused` — exit 1: `config declares "budget", which is not a key this config understands. Config accepts: profile, categories, budgets, watchedDocs.`; `my-context/src/core/config.ts:328,422-430`.

### E2-082 · README:3911
> After you edit a file matching one of these globs, my_context adds one line to the session suggesting you capture what the edit decided. The defaults are `docs/superpowers/specs/**`, `docs/superpowers/plans/**` and `docs/prd/**`.

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/config.ts:74-78` (`DEFAULT_WATCHED_DOCS`); `own-run/W1`, `own-run/W2`, `own-run/W3` — all three default globs fire the nudge, while `own-run/W4` (`docs/other/x.md`) produces empty stdout.
**Note:** "edit" means the writing tools only — `own-run/W6` shows a `Read` on a watched doc produces nothing (`post-tool-use.ts:18`, `WRITING_TOOLS = Write|Edit|MultiEdit`).

### E2-083 · README:3914
> Editing `docs/prd/checkout.md` under the defaults produces: `You edited docs/prd/checkout.md. If it set a new requirement, decision or constraint, capture it now with create_item (source_file: the path above). Skip if nothing new was decided.`

**Verdict:** VERIFIED
**Citation:** `own-run/W1` — the PostToolUse hook emits exactly that string inside `hookSpecificOutput.additionalContext`; `hooks/post-tool-use-watched` is the same template on `docs/superpowers/specs/x.md`; `reports/LIVE-PASS.md` records the same nudge firing in a live session for `docs/superpowers/live-pass-probe.md`.

### E2-084 · README:3920
> Set `"watchedDocs": ["docs/rfc/**"]` and the same edit produces nothing at all, because **the list you give replaces the defaults**. It is not added to them.

**Verdict:** VERIFIED
**Citation:** `own-run/W8` — with `{"watchedDocs": ["docs/rfc/**"]}`, a Write to `docs/prd/checkout.md` produces empty stdout, while `own-run/W9` (`docs/rfc/a.md`) fires; `own-run/W10` — the audit log for that workspace holds exactly one `post-tool-use` record, for the rfc path only. `config/watched-docs-override-hides-default` and `config/watched-docs-override` are the second instance. Source: `my-context/src/core/config.ts:387-406` — `requireWatchedDocs` returns the raw list, never a union.
**Note:** the audit record is written only when the nudge actually fires (`post-tool-use.ts:69-76`), matching `reports/LIVE-PASS.md`'s observation that an out-of-glob write produced no nudge and no audit record.

### E2-085 · README:3922
> Writes inside `.my_context/` never nudge, whatever the globs say.

**Verdict:** VERIFIED
**Citation:** `own-run/W5` — a Write to `.my_context/config.json` produces empty stdout; `hooks/post-tool-use-inside-my-context` is the second instance; `my-context/src/hooks/post-tool-use.ts:55` (`managedSplit` guard, before the glob test).

### E2-086 · README:3927
> It is a list of POSIX globs, repo-relative, matched against the file Claude is about to read or edit. A rule scoped to `src/billing/tax/**` does not fire when Claude opens `src/billing/prices.js` … and does fire the moment it opens `src/billing/tax/vat.js`

**Verdict:** VERIFIED
**Citation:** `hooks/pre-tool-use-scoped-hit` / `hooks/pre-tool-use-scoped-miss` / `hooks/pre-tool-use-scoped-billing-hit` / `hooks/pre-tool-use-scoped-billing-miss`; `own-run/C4` — a `src/admin/**`-scoped item injected on `src/admin/users.js`; `own-run/S8` — the same hook silent for an out-of-scope path. Backslashes are rejected as non-POSIX (`my-context/src/ingest/schema.ts:344-347`).

### E2-087 · README:3947
> `**` is rejected by the ingest path — along with `*` and `**/*`

**Verdict:** VERIFIED
**Citation:** `my-context/src/ingest/schema.ts:348-362` — `scope.find((s) => s === '**' || s === '**/*' || s === '*')` produces a rejection naming the glob; `cli-pipelines/ingest-apply-real-session` — the emitted extraction request states the same rule to the extractor: `"**", "*" and "**/*" are all rejected, because omitting "scope" already means exactly that.`

### E2-088 · README:3952
> `--scope` on `mycontext add` is comma-separated and repeatable; every occurrence is kept.

**Verdict:** VERIFIED
**Citation:** `own-run/SC1` — `add rule "Multi scoped" --scope "src/a/**,src/b/**" --scope "src/c/**" --yes` produces an item whose `scope` reads `src/a/** src/b/** src/c/**`.

### E2-089 · README:3959
> An item with `always: true` is injected in full at the start of every session, before any file is touched and regardless of scope.

**Verdict:** VERIFIED
**Citation:** `own-run/A1` (t6) — a rule scoped to `src/billing/tax/**` and pinned is delivered by the SessionStart hook in full, with its `_scope: src/billing/tax/**_` line, with no file operation having occurred; `own-run/Z5` — the same for an item whose category's `scopePolicy` is `inert`.

### E2-090 · README:3960
> Other **normative** items wait for a file they apply to and appear as a one-line index entry until then; rationale items (`lesson`, `adr`, `decision`, `tradeoff`, …) are never listed individually — they contribute only an aggregate count.

**Verdict:** VERIFIED
**Citation:** `own-run/T1` — SessionStart names the normative `standard` item on its own line and reduces `decision` and `lesson` to `1 decision · 1 lesson`; `own-run/T2` — retiering `standard` to rationale moves it into the aggregate.

### E2-091 · README:3965
> While it is still a draft, **`mycontext review promote <id> --always`** promotes and pins it in one step.

**Verdict:** VERIFIED
**Citation:** `own-run/P1` (t7) — on an agent-created draft rule, `review promote RULE-agent-rule --always --yes` returns "RULE-agent-rule is now active (pinned via --always — injected at every session start regardless of scope)" and `list --full` then shows `scope   always`.

### E2-092 · README:3967
> **`mycontext pin <id>`** — or `mycontext edit <id> --always=true`, which is the same command — sets it, and `mycontext unpin <id>` clears it, behind the preview and confirmation

**Verdict:** VERIFIED
**Citation:** `own-run/C5` and `own-run/Z5` (`pin` prints an `about to edit:` preview with `always no -> yes`), `own-run/P2` (`unpin … --yes` prints the same preview shape with `always yes -> no`), `own-run/P3` (`edit … --always=true --yes` prints an identical preview and result).

### E2-093 · README:3969
> Neither is available to Claude: `update_item` refuses `scope`/`always`/`severity` on a governing normative item … and its refusal names `mycontext pin` as what a human can do.

**Verdict:** VERIFIED
**Citation:** `own-run/A2`/`A3`/`A4` — each refusal ends "(`mycontext pin`/`unpin` and `harden`/`soften` are that edit under a shorter name)"; `mcp/update_item-always-on-governing-refused`, `mcp/update_item-scope-on-governing-refused`, `mcp/update_item-severity-on-governing-refused`.

### E2-094 · README:3974
> On a **rationale** item … `always: true` and `severity: hard` are **refused**, by every write surface: `mycontext add`, `create_item`, `update_item`, `review promote --always/--severity` and ingest.

**Verdict:** CONTRADICTED
**Citation:** expected: `mycontext add` and ingest refuse `always: true` on a rationale item. Actual: neither surface can express it. `own-run/R1` — `mycontext add lesson "A lesson" --always --yes` exits 1 with `my_context: unknown option "--always".` and a usage line that lists no `--always` flag at all, not the tier refusal; `my-context/src/ingest/schema.ts:319-320` — "`applyCandidates` hardcodes `always: false` for every candidate (ingest/apply.ts), so no ingested item can assert a pin", and the ingest inert-field check at `:323` is guarded by `if (severity === 'hard')` only, with no `always` branch.
**Note:** the other three quarters hold, and hold verbatim: `own-run/R2` (`mycontext add --severity hard`), `own-run/R4`/`R5` (`create_item` `always` and `severity`), `own-run/R6`/`R7` (`update_item` both), `own-run/Y1`/`Y2` (`review promote --always` and `--severity`), `my-context/src/ingest/schema.ts:323-325` (ingest `severity`) all produce the "stored and then do nothing at all … Nothing was written" refusal the README describes. Nothing is stored-and-ignored on either surface — the defect is in the enumeration, not the safety property.

### E2-095 · README:3982
> `scope` is **not** refused there — it is inert for injection on that tier, but `query_items({path})` reads it on every item

**Verdict:** VERIFIED
**Citation:** `own-run/R3` — `mycontext add lesson "A lesson three" --scope "src/**" --yes` succeeds where `--severity hard` was refused on the same category; `own-run/Z1`/`Z3` — `query_items({path})` reads `scope` on items of both tiers.

### E2-096 · README:3984
> An item that carries one of those fields because its category was normative when it was captured, and was retiered afterwards, stays editable: only a change that newly sets the field is refused, and `update_item` reports the stored value as inert instead of reporting a bare "updated".

**Verdict:** VERIFIED
**Citation:** `own-run/Y3` — a `lesson` pinned while its category was normative, then retiered to rationale, accepts an agent `update_item` body change and answers: `my_context: updated LESSON-pinned-lesson (active). Note: \`always: true\` is stored but INERT on LESSON-pinned-lesson — "lesson" is a rationale-tier category in this project …`

### E2-097 · README:3994
> **`watchedDocs` replaces the defaults.** Give it one glob and you have one glob … There is no "extend".

**Verdict:** VERIFIED
**Citation:** `own-run/W8`/`W9`/`W10` (see E2-081) and `my-context/src/core/config.ts:387-406`.

### E2-098 · README:3999
> **`categories` and `budgets` merge per key.** `{"budgets": {"index": 30}}` leaves `pinned`, `jit` and `restored` at their defaults, and `{"categories": {"standard": {"enabled": false}}}` changes nothing about any other category. Within one category, only the keys you name are overridden.

**Verdict:** VERIFIED
**Citation:** `my-context/src/core/config.ts:362-376` (budgets start from `{...DEFAULT_BUDGETS}` and only named keys are written) and `:456-467,529-574` (every category is seeded from the catalogue, then only named keys overridden); behaviourally `own-run/M1` — with `{"budgets": {"index": 30}, "categories": {"standard": {"enabled": false}}}`, `add rule` still succeeds while `add standard` is refused; `own-run/M2` — `{"rule": {"prefix": "POLICY"}}` leaves `rule` enabled and normative (`POLICY-x` created active, "governing this project at once").

### E2-099 · README:4004
> A category name that is not built in must declare both `tier` and `description`, or the config is rejected.

**Verdict:** VERIFIED
**Citation:** `config/custom-category-missing-tier` and `config/custom-category-missing-description` — both exit 1; `my-context/src/core/config.ts:488-494`.
