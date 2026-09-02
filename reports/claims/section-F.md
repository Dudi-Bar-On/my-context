# Section F — README lines 4008–4625

**114 claims: 99 VERIFIED · 8 CONTRADICTED · 7 UNVERIFIED.**

Range: "7. The trust boundary" (4008–4259), "8. Not yet available" (4261–4573), "9. Glossary" (4575–4617).

Own runs were executed in `%TEMP%\secF` and `%TEMP%\secF2`, invoked as
`node D:/Users/UserC/source/repos/test_mycontext_plugin/my-context/src/cli/index.ts <args>`, and against
the MCP server over stdio via `harness/lib/mcp.mjs`. Cited as `own-run/<label>`.

---

## 7. The trust boundary

### F-001 · README:4013
> a draft is not selected for any injection tier

**Verdict:** VERIFIED
**Citation:** `own-run/draft-never-injected` — an agent-created constraint carrying `always: true` **and** `severity: hard` (`CONST-draft-never-injected-probe`, body marker `DRAFT-BODY-MARKER`) produced no injected block and no index line when `session-start.ts` was run against the workspace; the same item injected in full the moment it was promoted (`own-run/promote-always-clean`).
**Note:** Deliberately challenged with the two flags that would most plausibly bypass the gate. Neither did.

### F-002 · README:4014
> Promotion is what makes an item `active`, and active is what makes it govern.

**Verdict:** VERIFIED
**Citation:** `own-run/promote-always-clean` — `mycontext review promote RULE-plain-draft-for-always-flag --always --yes` → "is now active (pinned via --always …)"; the item then appeared in the session-start injection.

### F-003 · README:4019
> [*] --> draft: Claude captures a normative item (create_item, origin stamped agent)

**Verdict:** VERIFIED
**Citation:** `mcp/create_item-minimal` — "created CONST-uploads-capped-at-10-mb (**draft**) … It is a draft because non-human-authored normative items are not injected until reviewed"; reproduced in `own-run/agent-normative-draft`.

### F-004 · README:4020
> [*] --> active: you capture it yourself (mycontext add, with an explicit yes)

**Verdict:** VERIFIED
**Citation:** `own-run/add-constraint-yes` — `mycontext add constraint "Pool capped at twenty" … --yes` → "created CONST-pool-capped-at-twenty (**active**)", frontmatter `origin: human`. Without `--yes` the same command exits 1: "refusing without confirmation" (`own-run/add-no-yes`).

### F-005 · README:4021
> draft --> active: mycontext review promote — a human decision

**Verdict:** VERIFIED
**Citation:** `own-run/promote-always-clean`, `own-run/promote-agent-draft` — both moved a `draft` to `active`.

### F-006 · README:4022
> draft --> deprecated: mycontext review discard

**Verdict:** VERIFIED
**Citation:** `own-run/review-discard` — `mycontext review discard RULE-discard-probe --yes` → "RULE-discard-probe is now **deprecated**. It is kept as a trail rather than deleted." `list rule --json` confirms `"status": "deprecated"`.

### F-007 · README:4023
> active --> superseded: mycontext supersede, naming a replacement — a human decision

**Verdict:** VERIFIED
**Citation:** `own-run/supersede-cli` — `mycontext supersede RULE-rule-for-supersede-test --by CONST-pool-capped-at-twenty --yes` → status `active -> superseded`; the retiree's file carries `superseded_by [[CONST-pool-capped-at-twenty]]`.

### F-008 · README:4025–4026
> Not selected for any tier. Counted in the index, injected nowhere.

**Verdict:** VERIFIED
**Citation:** `own-run/draft-never-injected` — with the pinned/hard draft present, the session-start block's summary line read `1 lesson · **1 drafts pending review** · 6 retired`, while neither the draft's body nor an index line for it appeared.

### F-009 · README:4040–4041
> Rationale is not gated … A `decision` or a `lesson` captured by the model lands `active` immediately

**Verdict:** VERIFIED
**Citation:** `mcp/create_item-rationale` — "created DEC-we-chose-stripe (**active**)"; `own-run/agent-lesson-active` — `create_item(type: lesson)` → "created LESSON-rationale-probe-lands-active (**active**)". Also `reports/LIVE-PASS.md` L14.

### F-010 · README:4041–4042
> because rationale is never auto-injected — it can be retrieved, but it cannot steer anything on its own

**Verdict:** VERIFIED
**Citation:** `own-run/session-start-secF` — an `active` lesson in the corpus produced only the count `1 lesson` in the summary line; no lesson text and no lesson index line were injected.

### F-011 · README:4046–4048
> An agent holding only the MCP tools can: create items (normative ones as drafts), **propose** a revision to an item's title, body, tags or extra fields, link items, read anything, list the review queue, and load context.

**Verdict:** VERIFIED
**Citation:** `own-run/mcp-surface-sweep` — all seven exercised against one workspace: `create_item` (draft), `update_item` title/body/extra (staged), `link_items` (applied), `get_item`/`query_items` (read), `list_drafts` (queue), `load_context` (injection block).

### F-012 · README:4048–4049
> It cannot promote a draft

**Verdict:** VERIFIED
**Citation:** `own-run/mcp-promote-attempt` — `update_item {"id":"CONST-agent-authored-draft-probe","status":"active"}` → `isError=true`, "a non-human caller cannot change the status of a normative item. CONST-agent-authored-draft-probe stays \"draft\". … A human can promote it with `mycontext review promote …`".
**Note:** Attacked directly rather than inferred. No other MCP tool reaches `status` — `update_item`'s own accepted-argument list is `id, title, body, scope, tags, severity, always, status, extra` (`mcp/update_item-unknown-arg`), and `status` is the only route to `active`.

### F-013 · README:4049
> `supersede_item` refuses outright to retire a normative item that currently governs

**Verdict:** VERIFIED
**Citation:** `own-run/mcp-supersede-governing` — `supersede_item {"id":"RULE-rule-for-supersede-test","by":"CONST-pool-capped-at-twenty"}` on an `active` rule → `isError=true`, "a non-human caller cannot supersede a governing normative item."
**Note:** The captured record `mcp/supersede_item-governing-refused` does **not** establish this — it passed `by: "CONST-nope"` and got "no item with id \"CONST-nope\"", i.e. it failed on the replacement id before the guard was reached. The guarantee is verified only by the run above.

### F-014 · README:4050
> `update_item` refuses `scope`, `always` and `severity` on a governing normative item

**Verdict:** VERIFIED
**Citation:** `own-run/mcp-reach-and-force` — against `active` `CONST-pool-capped-at-twenty`, all three refused with `isError=true`: `scope:["src/**"]`, `always:true`, `severity:"soft"` → "a non-human caller cannot change the *<field>* of a governing normative item."
**Note:** `mcp/update_item-severity-on-governing-refused` returned "updated … (active)" because it passed `severity:"soft"` to an item already `soft` — a no-op that never reached the guard. Verified only by the run above, which used real changes.

### F-015 · README:4051
> and `status` on any normative item at all

**Verdict:** VERIFIED
**Citation:** `own-run/mcp-status-refusal` — refused on a **governing** item (`CONST-pool-capped-at-twenty`, `status:"deprecated"`) *and* on a **draft** (`CONST-agent-authored-draft-probe`, `status:"active"`). Both `isError=true`.
**Note:** `mcp/update_item-status-on-normative-refused` returned "updated … (active)" because it set `status:"active"` on an already-active item.

### F-016 · README:4053–4058
> Under `categories.<name>.agentEdits` — `review` for every normative category unless you change it — an agent's edit to title, body, tags or extra does not take effect. It is staged, the item keeps governing the text it already had, and the agent is told in its first words that nothing was applied.

**Verdict:** VERIFIED
**Citation:** `own-run/stage-title-body` — `update_item` title and body on `CONST-pool-capped-at-twenty` each returned "**my_context: NOT applied** — staged as revision REV-… for review. CONST-pool-capped-at-twenty is unchanged and keeps governing its current title". A subsequent `get_item` showed the original `title: Pool capped at twenty` still in the file.

### F-017 · README:4058–4060
> Under `allow` the same edit lands immediately, which is … still what every rationale category does.

**Verdict:** VERIFIED
**Citation:** `config/category-agentEdits-allow` for the `allow` setting; `own-run/rationale-edit-applies` — `update_item {"id":"LESSON-…","title":"Rationale probe renamed"}` on a rationale item returned "**updated** LESSON-rationale-probe-lands-active (active)" with no staging.

### F-018 · README:4063–4066
> **`extra` is content, and it is inside that.** It holds a rule's `directive` … so it is staged with the rest.

**Verdict:** VERIFIED
**Citation:** `mcp/update_item-extra` — "NOT applied — staged as revision REV-f151f811fcf1 … keeps governing its current **extra**".

### F-019 · README:4067
> `mycontext edit <id> --extra key=value` is the human route, behind the same gate every other field carries.

**Verdict:** VERIFIED
**Citation:** `own-run/edit-usage` — `mycontext edit`'s usage line lists `[--extra key=value]` alongside `[--yes]`; `own-run/edit-status-active` shows the same command's preview-and-confirm gate.

### F-020 · README:4070–4072
> No tool takes an `origin` argument: `create_item`, `update_item` and `supersede_item` each stamp `agent` themselves, so an agent cannot claim to have been a human.

**Verdict:** VERIFIED
**Citation:** `mcp/create_item-origin-refused` — "create_item does not take \"origin\" … origin is never taken from a tool call: every tool that writes on an agent's behalf records origin \"agent\" itself". Confirmed downstream: `own-run/audit-origins` shows every MCP write recorded `who: agent`, every CLI write `who: human`.

### F-021 · README:4073–4074
> `link_items` carries no origin at all, because a relation touches nothing the boundary is about

**Verdict:** VERIFIED
**Citation:** `own-run/link-then-show` — after an agent linked `CONST-pool-capped-at-twenty`, the item's frontmatter still read `origin: human`; nothing about status, severity, scope, `always` or the body moved.
**Note:** The *audit* record for the link does carry `who: agent` (`own-run/audit-op-link`). The claim is about the item, and holds there.

### F-022 · README:4076–4078
> An agent that also holds `Bash` has all of that plus the CLI, and the CLI is the human surface. That is where the boundary actually is

**Verdict:** VERIFIED
**Citation:** `own-run/*` in aggregate — every command in this audit was issued by a non-human process with no interactive terminal, and each one that wrote passed `origin: 'human'` (see `own-run/audit-origins`: `add`, `edit`, `promote`, `supersede`, `discard`, `lesson-accept` all recorded `who: human`).

### F-023 · README:4083–4085
> A pending revision … lives in an append-only log under `.my_context/.revisions/`, never under `items/` … the loader that builds the corpus walks `items/` and nothing else

**Verdict:** VERIFIED
**Citation:** `own-run/revisions-dir` — the only files created were `.my_context/.revisions/revisions.jsonl` and `.gitignore`; the item files under `items/` were byte-unchanged. `src/core/markdown-fallback.ts:24-29` builds the corpus from `rebuildRoots(ws)` layer roots only, and `own-run/session-start-secF` injected no revision content.

### F-024 · README:4090–4092
> **The item keeps governing its current text.** … the words that were in force before the agent wrote are still the words injected into every session, until you promote the change.

**Verdict:** VERIFIED
**Citation:** `own-run/stage-title-body` + `own-run/session-start-secF` — with two revisions pending, `get_item` returned `title: Pool capped at twenty` and the session-start index line read "Pool capped at twenty", not the proposed "Pool capped at fifty".

### F-025 · README:4093
> **A staged revision is never injected**, at any tier, in any session.

**Verdict:** VERIFIED
**Citation:** `own-run/session-start-pending` — with `REV-200c75f6e7b6` pending, the session-start block contained the item's current text plus a disclosure line; the proposed title never appeared.

### F-026 · README:4095–4097
> a session that starts with a proposal waiting is told so in one line naming the revision and the item, and every read tool a model has — `get_item`, `query_items`, `list_drafts` — says the same

**Verdict:** VERIFIED
**Citation:** `own-run/session-start-pending` — the session-start hook and `load_context` both closed with "1 pending revision(s) on 1 item(s) … — **REV-200c75f6e7b6 → RULE-restage-probe**". `own-run/read-tools-disclose` — `get_item`, `query_items` and `list_drafts` each carried the same sentence.

### F-027 · README:4097–4099
> What the model never receives is the proposed text, and what it is told each time is that the text it is looking at is the text in force, that only a human can settle the proposal, and that it should say so rather than propose the change again.

**Verdict:** VERIFIED
**Citation:** `own-run/read-tools-disclose` — verbatim: "Every item here carries the text it had before the proposal; that is the text in force. **Only a human can settle them, and you cannot**: do not propose the same change again, and do not reason as if the proposed text applies. **Tell the user they are waiting.**" No proposed text appears in any of the three tool outputs.

### F-028 · README:4102–4105
> **A revision is not an item.** It does not appear in `mycontext list` … `mycontext status` and `mycontext review` count it in one place and one sentence — a *pending revisions* line that is deliberately separate from the draft queue's count

**Verdict:** VERIFIED
**Citation:** `own-run/list-status-review` — `mycontext list` printed six item rows and no revision; `mycontext status` printed "review queue: 1 draft(s) pending review" and, as a separate paragraph, "2 pending revision(s) on 1 item(s) — proposed by an agent and NOT applied"; `mycontext review` printed the same two counts separately.

### F-029 · README:4106–4109
> **Discarding does not destroy the proposal.** `review discard-revision` appends a decision; it never rewrites the line that recorded the proposal … and `mycontext review revisions <id> --full` prints it back. The command says so as it discards.

**Verdict:** VERIFIED
**Citation:** `own-run/discard-revision` — the raw log kept the original `{"op":"stage",…,"changes":{"body":"Body version THREE proposal B."}}` line and appended `{"op":"discard",…}`; `review revisions … --full` afterwards printed "2 settled revision(s) … kept in full, never deleted" with both proposed bodies. The discard message itself says "The proposal itself is NOT deleted — its full proposed body stays in the append-only log".

### F-030 · README:4111–4114
> **If you edit the item underneath a pending revision, the revision goes stale rather than silently winning.** Staleness is per field … Promoting a stale revision is refused, naming the fields that moved and printing both texts.

**Verdict:** VERIFIED
**Citation:** `own-run/stale-per-field` — after a human `edit --body`, `review revisions` showed the **body** revision "STALE — a human changed body after this was staged" while the **title** revision beside it stayed "applies cleanly". `own-run/promote-stale-refused` — exit 1: "revision REV-03f592eee590 is STALE and was not promoted … in the very field(s) it rewrites: body (staged against \"The pool must never exceed 20 connections.\", now \"The pool must never exceed 25 connections (human edit).\")".

### F-031 · README:4116–4122
> `--force` applies a stale revision anyway; the text you wrote in the meantime is replaced … Before the prompt it prints two diffs with separate legends … and it still goes through the confirmation, which `--yes` answers in advance … On a revision that is *not* stale, `--force` says so rather than being swallowed.

**Verdict:** VERIFIED
**Citation:** `own-run/force-stale` — `--force` without `--yes` printed the promotion diff, then a separately-legended block ("`--force`: this revision is STALE … `-` is what the item said when the revision was written, `+` is what a human has since made it say — and `+` is what will be lost"), then exited 1: "refusing without confirmation". With `--yes` it applied and reported "It was stale and was promoted with force: the newer text in body was overwritten." `own-run/force-non-stale` — on a clean revision: "note: --force was passed, but this revision is not stale — nothing is being overwritten and the flag changed nothing."

### F-032 · README:4124–4126
> An item can carry more than one pending revision, and each records the text it was written against. Promoting one therefore leaves the others stale rather than stacking them, and the promotion names exactly which ones it just invalidated.

**Verdict:** CONTRADICTED
**Citation:** `own-run/promote-different-field` — with a title revision and a body revision both pending on `CONST-pool-capped-at-twenty`, promoting the title revision named nothing as invalidated, and its own preview said the opposite: "1 other revision(s) pending on this item: REV-03f592eee590 (body — **a different field, unaffected by promoting this one**)".
**Note:** Expected: the other revision goes stale and is named. Actual: only *same-field* revisions are invalidated — `own-run/promote-same-field` does behave as the sentence describes ("1 other pending revision(s) on this item (REV-a9d2d11ec818) is now stale"). The recorded base is per-field (`"base":{"body":"Body version one."}` in `revisions.jsonl`), so README:4112's own "Staleness is per field" is the accurate statement and this sentence over-generalises it.

### F-033 · README:4130–4131
> A normative item captured by a model lands as a `draft` and governs nothing until a human promotes it.

**Verdict:** VERIFIED
**Citation:** `mcp/create_item-minimal`; `own-run/draft-never-injected` (F-001) for the "governs nothing" half.
**Note:** The discriminator is the **category tier**, not the author: a `lesson` created by the same agent through the same tool lands `active` (F-009). The sentence is scoped to normative items and is correct as scoped.

### F-034 · README:4131
> A rule derived from a lesson is inert until a human accepts it.

**Verdict:** VERIFIED
**Citation:** `own-run/lesson-flow` — `mycontext lesson-stage … --stdin` returned "1 rule candidate(s) staged … **None of them exists as an item yet.**"; only `mycontext lesson-accept LESSON-… 51abc806` created `RULE-add-jitter-to-every-retry-backoff (active)`.

### F-035 · README:4134
> **What actually enforces it: your Bash permissions, and nothing else.**

**Verdict:** VERIFIED
**Citation:** `own-run/*` — a non-human process with shell access executed `add --yes`, `edit --status active --yes`, `review promote --yes`, `review discard --yes`, `review promote-revision --force --yes`, `supersede --yes`, `lesson-accept` and `repair --yes`, all successfully; nothing in the program distinguished it from a human. Corroborated by `reports/LIVE-PASS.md` L-F1 for the direct-write half.

### F-036 · README:4136
> Eight CLI commands change what governs this project with no human in the loop.

**Verdict:** VERIFIED
**Citation:** Each of the eight exercised: `own-run/promote-agent-draft`, `own-run/review-discard`, `own-run/lesson-flow`, `own-run/add-constraint-yes`, `own-run/supersede-cli`, `own-run/edit-status-active`, `own-run/promote-same-field`, `own-run/repair-after-hand-edit`. The ninth table row, `discard-revision`, is explicitly excluded from the count at README:4166 and indeed changes nothing about what governs (`own-run/discard-revision`: "RULE-multi-revision-probe is unchanged").

### F-037 · README:4136–4137
> Six put an item past the draft gate

**Verdict:** UNVERIFIED
**Citation:** —
**Note:** The six are never enumerated, and the nine table rows do not partition into six-plus-three on any stated rule, so there is nothing to check against.

### F-038 · README:4139
> `edit --status active`, which until recently made that crossing with no preview and no confirmation at all

**Verdict:** VERIFIED (as a statement about today's behaviour)
**Citation:** `own-run/edit-status-active` — `mycontext edit RULE-draft-govern-probe --status active --yes` printed a full preview ("status draft -> active", "today not injected (status \"draft\")", "this edit puts RULE-draft-govern-probe into injection") before writing.
**Note:** The historical half ("until recently") is not checkable from the working tree.

### F-039 · README:4147–4149
> `mycontext pin`, `unpin`, `harden` and `soften` are `edit` under a shorter name … they take the same `--yes`, print the same preview and reach the same write.

**Verdict:** VERIFIED
**Citation:** `own-run/pin-preview` — `mycontext pin RULE-restage-probe --yes` printed `edit`'s preview verbatim ("about to edit: … changing: always no -> yes … after PINNED"), including `edit`'s pending-revision note, and closed with "updated RULE-restage-probe (active)". The usage banner spells all four as `edit` equivalents, e.g. `pin <id> [--yes]  inject an item at every session start (edit --always=true)` (`own-run/help-banner`). Also `reports/LIVE-PASS.md` L21.

### F-040 · README:4150–4155
> a permission rule is matched against the command *string*, so `Bash(mycontext edit *)` does not match `mycontext pin …` … `Bash(mycontext review promote *)` does **not** match `mycontext review promote-revision …`

**Verdict:** UNVERIFIED
**Citation:** —
**Note:** Claude Code's permission matcher is not reachable from this harness; only the plugin's own surfaces are.

### F-041 · README:4159
> `mycontext review promote <id>` — turns a draft into an `active` governing item

**Verdict:** VERIFIED
**Citation:** `own-run/promote-agent-draft` — `CONST-agent-authored-draft-probe` moved `draft` → `active` and was thereafter injected at session start.

### F-042 · README:4160
> `mycontext review discard <id>` — retires a draft

**Verdict:** VERIFIED
**Citation:** `own-run/review-discard` (see F-006).

### F-043 · README:4161
> `mycontext lesson-accept <lesson> <key>` — creates an `active` rule from a staged candidate

**Verdict:** VERIFIED
**Citation:** `own-run/lesson-flow` — "created RULE-add-jitter-to-every-retry-backoff (**active**) with derived_from [[LESSON-…]]", and it takes no `--yes` at all.

### F-044 · README:4162
> `mycontext add <normative category> "…" --yes` — creates an `active` governing item **directly** … it passes `origin: 'human'` … It requires `--yes` … anything that can run `mycontext` can pass `--yes`

**Verdict:** VERIFIED
**Citation:** `own-run/add-constraint-yes` (active, `origin: human`), `own-run/add-no-yes` (exit 1 without `--yes`), and this whole audit for the last clause — a non-human process passed `--yes` on every write.

### F-045 · README:4163
> `mycontext supersede <id> --by <id> --yes` — retires a governing item … records the pair in both directions … this command is the route around that refusal for anything holding a shell

**Verdict:** VERIFIED
**Citation:** `own-run/supersede-cli` — "RULE-rule-for-supersede-test now carries \"superseded_by CONST-pool-capped-at-twenty\", and CONST-pool-capped-at-twenty carries \"supersedes RULE-rule-for-supersede-test\"", preceded by a preview of what is retired, on what terms it is injected today, and what governs afterwards. The same retirement was refused to the agent through `supersede_item` (F-013), so the shell route is demonstrably the way around it.

### F-046 · README:4164
> `mycontext edit <id> … --yes` — changes any field of an item that is already governing … **and makes a draft govern**, with `--status active` … the route around that refusal for anything holding a shell

**Verdict:** VERIFIED
**Citation:** `own-run/edit-status-active` (draft → active with preview); `own-run/edit-body-human` (body of a governing item rewritten, with before/after preview). The same fields were refused to the agent through `update_item` (F-014/F-015).

### F-047 · README:4165
> `mycontext review promote-revision <id> --yes` — applies a pending revision … `--force` additionally overwrites a newer human edit … With more than one revision pending on the item it refuses without `--revision REV-...`

**Verdict:** VERIFIED
**Citation:** `own-run/promote-revision-ambiguous` — exit 1: "CONST-pool-capped-at-twenty has 2 pending revisions … and no --revision names which one to promote. Refusing to pick one". Plus F-031 for `--force`.

### F-048 · README:4166
> `mycontext review discard-revision <id> --yes` … It changes nothing about what governs … the same proposal cannot be staged again against the same text. The proposal itself stays in the log

**Verdict:** VERIFIED
**Citation:** `own-run/restage-after-discard` — after discarding `REV-350b29f121f6`, re-issuing the identical `update_item` body was refused: "this exact change to RULE-restage-probe was already discarded on 2026-08-17T14:08:51.844Z (revision REV-350b29f121f6), against the same text it is being proposed against now. It is not staged again". Log retention per F-029.

### F-049 · README:4167
> `mycontext repair --yes` … So hand edit + `repair --yes` changes what governs this project and leaves no evidence it happened.

**Verdict:** VERIFIED
**Citation:** `own-run/repair-after-hand-edit` — a hand edit flipped `always: false → true` and `severity: soft → hard` on a governing rule; `rebuild` left `checksum: b8fd476dba7cd1c7` byte-identical; `doctor` reported the mismatch and exited 1; `repair --yes` re-stamped to `e4e85e7e9fd80561` and `doctor` returned 0 errors. `mycontext audit --limit 6` immediately afterwards showed **no record of the repair** — the newest entry was the `supersede` that preceded it.

### F-050 · README:4171–4175
> The `--yes` confirmation … is **not** a security boundary — an agent composing the command line can add `--yes` itself, and it can add `--force` beside it. What it buys is legibility

**Verdict:** VERIFIED
**Citation:** `own-run/force-stale` — a non-interactive process passed `--force --yes` together and destroyed a human's newer text with no further gate. Every `--yes` in this audit was supplied by a program.

### F-051 · README:4177–4183
> The `PreToolUse` hook denies writes under `.my_context/`, but its matcher is `Read|Edit|MultiEdit|Write|NotebookEdit` — **`Bash` is not matched**, and the hook only inspects a `file_path` argument, which a Bash call does not carry.

**Verdict:** VERIFIED
**Citation:** `my-context/hooks/hooks.json:18` — `"matcher": "Read|Edit|MultiEdit|Write|NotebookEdit"`, no `Bash`. `reports/LIVE-PASS.md` L-F1 recorded the consequence live: `printf … > .my_context/items/…` and `> .my_context/config.json` both succeeded, with no refusal and **no audit record**.
**Note:** This is the load-bearing limitation of section 7. Everything F-012 through F-020 guarantees holds against an agent restricted to the MCP tools and file tools; none of it holds against an agent holding `Bash`. `mycontext doctor` catches item tampering after the fact by checksum (F-049, LIVE-PASS L18), but `config.json` carries no checksum, so a shell edit to the file that controls `budgets` and `watchedDocs` is undenied, unaudited and undetected.

### F-052 · README:4185–4194
> **Alternate spellings of the managed directory are closed** … the `.my_context` and `.my-context` path segments case-insensitively, and then canonicalizes the path … a Windows **8.3 short name** (`MY_CON~1` …), symlinks and NTFS junctions pointing into the directory, `\\?\` prefixes, `\\localhost\C$` admin shares, `subst` drives, and `..` traversal — each probed by execution against the real hook

**Verdict:** VERIFIED
**Citation:** `own-run/hook-spelling-probe` — ten paths fed to `src/hooks/pre-tool-use.ts` on stdin. `deny` returned for: plain, `\\?\C:\…`, `\\localhost\C$\…`, `MY_CON~1\items\x.md` (8.3 confirmed live by `fsutil 8dot3name query C:` → ENABLED and `dir /x` → `MY_CON~1 .my_context`), `.my-context` hyphen spelling, `.MY_CONTEXT` upper case, `notes\..\.my_context\…`, and `config.json`. `own-run/hook-junction-probe` — an NTFS junction created with `mklink /J jct-into .my_context`, written through as `…\jct-into\items\x.md`, also returned `deny`. Paths outside the directory returned no output (allow). Matches `hooks/pre-tool-use-deny-case`, `-deny-hyphen`, `-deny-dotdot`, `-deny-backslash`, `-deny-items`, `-deny-config`. Source: `src/hooks/pre-tool-use.ts:83` — `managedSplit(toPosix(absNative)) ?? managedSplit(toPosix(canonicalize(absNative)))`.
**Note:** `subst` drives and true (non-junction) symlinks were not probed in this pass; the other seven spellings were.

### F-053 · README:4196–4202
> **What canonicalization cannot close is a hard link.** … A hard link placed outside `.my_context` that points at an existing item file is a path the hook cannot recognize, and a `Write` through it edits the item in place.

**Verdict:** VERIFIED
**Citation:** `own-run/hook-hardlink-probe` — `mklink /H hl-item.md .my_context\items\rule\RULE-multi-revision-probe.md` created a second entry for the item file. The hook returned **allow** (no output) for `…\secF\hl-item.md`, and writing through that path changed the item in place: the probe read the target back and reported `item changed through hard link: true | always line now: always: false`.

### F-054 · README:4205–4207
> the gate holds if and only if the agent's Bash surface excludes the `mycontext` binary entirely, in every spelling, *and* direct writes into `.my_context/`

**Verdict:** VERIFIED
**Citation:** Both necessity halves demonstrated: the binary route by F-036/F-049 (eight commands reached from a shell), the direct-write route by F-051 (`reports/LIVE-PASS.md` L-F1) and F-053.

### F-055 · README:4209–4211
> **A plugin cannot ship permission rules.** Claude Code's plugin `settings.json` supports only the `agent` and `subagentStatusLine` keys

**Verdict:** UNVERIFIED
**Citation:** —
**Note:** Claude Code's plugin-settings schema is not observable from this harness. What is observable: `my-context/.claude-plugin/` contains only `marketplace.json` and `plugin.json`, and `plugin.json` carries no `permissions` key.

### F-056 · README:4237–4241
> They are prefix matches on a command string. `node .claude/plugins/…/src/cli/index.ts add …`, an `npx` invocation, a shell variable holding the path, or any other spelling of the same program is a different string and is **not** denied

**Verdict:** VERIFIED (the reachability half)
**Citation:** `own-run/*` — every CLI command in this audit was invoked as `node …/my-context/src/cli/index.ts <args>`, the exact alternate spelling the README names, and each one reached the same program and the same writes.
**Note:** Whether such a string escapes a `Bash(mycontext …)` deny rule is the untestable half (see F-040).

### F-057 · README:4247–4252
> Every write path recomputes the item's `checksum`; a hand edit does not … `mycontext doctor` reports the mismatch and exits 1 … `mycontext rebuild` does **not** recompute it … the `checksum:` line is byte-identical to what it was before.

**Verdict:** VERIFIED
**Citation:** `own-run/repair-after-hand-edit` — after hand-editing `always:` and `severity:`, `rebuild` left `checksum: b8fd476dba7cd1c7` unchanged and reported "checksum mismatch … recorded b8fd476dba7cd1c7, content hashes to e4e85e7e9fd80561"; `doctor --short` exited **1** on the same finding.

### F-058 · README:4258–4259
> `mycontext repair` re-stamps the checksum after a deliberate hand edit; it makes the recorded checksum agree with the file, and it cannot recover anything the edit removed.

**Verdict:** VERIFIED
**Citation:** `own-run/repair-after-hand-edit` — "re-stamped 1 item(s). Their recorded checksums now match their current content. **Nothing was recovered** — if any of that content was already wrong, it is still wrong and now checksums clean."

---

## 8. Not yet available

### F-059 · README:4264–4267
> **This is the only section of this document where unbuilt behaviour appears.** Everything above describes what the code does today. Every entry below names something this project does not have — either never built, or declared somewhere and verifiably not in effect — and no sentence below claims otherwise.

**Verdict:** CONTRADICTED
**Citation:** Two entries below name capabilities the project **does** have. F-091: `git for-each-ref refs/tags` in `my-context/` returns `v0.9.0` and `v1.0.0`, against "there are no git tags". F-090: `docs/ROADMAP.md` E1 records "**Certified 2026-08-16**: run 31965803312 … is green on both jobs", status `✅ 2026-08-16`, against "not certified by a run this project has seen".
**Note:** The section's stated invariant is that nothing stays here once it ships (README:4275). Both entries have shipped.

### F-060 · README:4291–4292
> `severity: hard` changes exactly one thing: hard items are admitted to a tier's budget before soft ones.

**Verdict:** CONTRADICTED
**Citation:** `my-context/src/core/select.ts:242-246` — `focusHides()` returns `false` unconditionally when `item.severity === 'hard'`, with the comment "The `severity: hard` exemption lives here, in the predicate, rather than in each caller — so no surface can narrow the corpus past it by forgetting." Confirmed by the README's own text at **README:2484** ("**Focus never hides a `severity: hard` item.**") and **README:2719** ("It cannot hide a `severity: hard` item").
**Note:** Expected: one effect (budget ordering, `select.ts:260-275`). Actual: two — budget ordering *and* exemption from session-focus narrowing. The same over-claim recurs in the glossary (F-086).

### F-061 · README:4292–4293
> **No hook, no tool and no command reads an item's severity to decide whether an action may proceed.**

**Verdict:** VERIFIED
**Citation:** `grep -rn "severity" my-context/src/hooks/*.ts` returns no matches. `my-context/src/core/trust.ts:88` states the same in the code: "`severity` gates nothing at all outside the normative tier." The two places severity is refused (`mutate.ts:218`, `mutate.ts:505`) refuse *setting* `hard` on a rationale category, not any external action.

### F-062 · README:4293–4294
> The only action a hook here ever blocks is a write into `.my_context/` itself.

**Verdict:** VERIFIED
**Citation:** `src/hooks/io.ts:80` is the sole `permissionDecision: 'deny'` emitter, reached only from `pre-tool-use.ts:323` via `denyReason(abs)`, which returns non-null only for paths inside the managed directory (`src/hooks/pre-tool-use.ts:82-118`). `own-run/hook-spelling-probe` — paths outside returned allow.

### F-063 · README:4301–4302
> `mycontext add instruction "…"` creates the item with `always: false` and an empty scope, and `add --scope` can set the scope, but `add` has no flag that sets `always`

**Verdict:** VERIFIED
**Citation:** `own-run/add-instruction` — `list instruction --json` → `"always": false, "scope": []`. `own-run/add-always-probe` — both `--always` and `--always true` exit 1 with "unknown option \"--always\"", and the printed usage line is `add <category> <title> [--body|--file] [--note] [--scope] [--tags] [--severity hard|soft] [--yes]`, with no `--always`.

### F-064 · README:4302–4303
> `mycontext pin` is the only route, and it is a second step

**Verdict:** VERIFIED
**Citation:** `own-run/pin-preview` and `own-run/help-banner` — `pin <id> [--yes]  inject an item at every session start (**edit --always=true**)`.
**Note:** `mycontext edit --always` and `mycontext review promote --always` also reach `always: true`, but the README itself identifies all three as one mechanism (README:4147, README:4310), so "route" reads as the mechanism rather than the spelling.

### F-065 · README:4303–4306
> At session start such an item contributes only its index line — id, type, title — and its directive text is not injected. It is not inert: an item with no scope is unrestricted under the default `scopePolicy`, so the text does arrive on the first tool call that touches a file.

**Verdict:** VERIFIED
**Citation:** `own-run/session-start-secF` — the unpinned, unscoped `INSTR-always-run-the-linter-before-commit` appeared only as `- INSTR-always-run-the-linter-before-commit · instruction · Always run the linter before commit` under `## my_context index`, with no body. `hooks/pre-tool-use-scoped-miss` — "unscoped items still arrive" on a file-touching tool call.

### F-066 · README:4310
> `mycontext pin <id>` once it governs, or `mycontext review promote <id> --always` while it is still a draft

**Verdict:** VERIFIED
**Citation:** `own-run/promote-always-clean` — on a draft carrying `always: false`, `review promote … --always --yes` printed "always yes (**from --always**) — pinned: injected in full at every session start" and reported "now active (pinned via --always)". `own-run/pin-preview` for the governing-item half.

### F-067 · README:4312–4321
> A subagent — the Task tool's separate context window — never sees the pinned tier, the index, or a compaction restore … There is no hook that fires at a subagent's birth for my_context to answer.

**Verdict:** UNVERIFIED
**Citation:** —
**Note:** Requires a live `claude -p` run dispatching a subagent with a probe hook attached; no subagent hook surface is reachable from this harness.

### F-068 · README:4326–4328
> The per-session dedupe record keys deliveries on `session_id` plus `agent_id`, so each subagent is its own dedupe scope

**Verdict:** UNVERIFIED
**Citation:** —
**Note:** The `session_id` half is established (`reports/LIVE-PASS.md` L7, `hooks/session-start-dedupe-same-session`); the `agent_id` half needs two hook invocations differing only in `agent_id` inside a real subagent dispatch, which this harness cannot produce.

### F-069 · README:4341–4344
> Every one of the fourteen MCP tools has a CLI command, a slash command, or both; the map is `src/plugin/parity.ts` and `test/plugin/parity.test.ts` checks it

**Verdict:** VERIFIED
**Citation:** `mcp/handshake-and-list` — fourteen tools. `my-context/src/plugin/parity.ts:51` — `TOOL_PARITY` maps each tool to `cli`/`slash`, with a mandatory `note` wherever one is null. `my-context/test/plugin/parity.test.ts` exists.

### F-070 · README:4347–4348
> 9 of the 30 CLI commands have none, each for a reason recorded beside it in `CLI_WITHOUT_SLASH`

**Verdict:** VERIFIED
**Citation:** `own-run/help-banner` — the usage banner lists exactly 30 commands (`init` … `unpin`). `my-context/src/plugin/parity.ts:104` — `CLI_WITHOUT_SLASH` holds exactly nine keys, each with a prose reason.

### F-071 · README:4350–4362
> `init` and `rebuild` … `repair` … `help` and `examples` … `ingest-apply` and `ingest-status` … `lesson-accept` and `lesson-discard`

**Verdict:** VERIFIED
**Citation:** `my-context/src/plugin/parity.ts:104-126` — the nine keys are `init`, `rebuild`, `repair`, `help`, `examples`, `ingest-apply`, `ingest-status`, `lesson-accept`, `lesson-discard`, in the same groupings and with the same reasons. `own-run/commands-dir` — `my-context/commands/` contains 66 files and none of those nine names.

### F-072 · README:4364–4368
> `load_context` has no CLI counterpart … `link_items` has no CLI counterpart … `mycontext edit --unlink` exists with no tool behind it

**Verdict:** VERIFIED
**Citation:** `my-context/src/plugin/parity.ts:56` — `{ tool: 'link_items', cli: null, slash: 'link', note: … }`; `load_context` likewise carries `cli: null`. `own-run/edit-usage` — `mycontext edit`'s usage line includes `[--unlink <relation> <target>]`, and `mcp/update_item-unknown-arg` shows `update_item` accepts no unlink argument.

### F-073 · README:4374–4376
> there is still no picker and no way to ship one … nothing in a plugin can put a menu on `--severity`

**Verdict:** UNVERIFIED
**Citation:** —
**Note:** A claim about what Claude Code's plugin surface permits, not about this program.

### F-074 · README:4378–4379
> The 21 `/mycontext:add-<type>` and 21 `/mycontext:list-<type>` commands

**Verdict:** VERIFIED
**Citation:** `own-run/commands-dir` — 21 `add-*.md` and 21 `list-*.md` files under `my-context/commands/`, matching the 21 categories the usage banner lists (`own-run/help-banner`).

### F-075 · README:4381–4386
> `/mycontext:pin`, `/mycontext:unpin`, `/mycontext:harden` and `/mycontext:soften` are `mycontext edit --always` and `--severity` under names you can find by typing … the CLI command rewrites its arguments into `edit`

**Verdict:** VERIFIED
**Citation:** `own-run/commands-dir` — `pin.md`, `unpin.md`, `harden.md`, `soften.md` all present. `own-run/help-banner` — `harden <id> [--yes]  make a normative item binding (**edit --severity=hard**)`, `pin`/`unpin` likewise. `own-run/pin-preview` — `pin` prints `edit`'s preview verbatim.

### F-076 · README:4393–4395
> `superseded` is deliberately absent from the status list, because `mycontext edit --status superseded` is refused

**Verdict:** VERIFIED
**Citation:** `own-run/edit-status-superseded` — exit 1: "\"superseded\" is not set through `mycontext edit` — a retirement names its replacement, and both items record the relation. Use `mycontext supersede … --by <replacement id>`." The `edit` usage line offers `[--status active|draft|deprecated|validated]` only.

### F-077 · README:4410
> `REQ-changes-are-timestamped-and-audited` — **Implemented** … One clause is still unmet … items carry no `created_at`/`updated_at` frontmatter fields

**Verdict:** VERIFIED
**Citation:** `my-context/.my_context/items/requirement/REQ-changes-are-timestamped-and-audited.md` — `status: active`. `own-run/show-item` — item frontmatter is `id, type, title, status, severity, always, scope, tags, origin, source_file, source_anchor, source_checksum, valid_from, valid_until, checksum`; no `created_at`/`updated_at`. The audit log exists and timestamps every mutation (`own-run/audit-origins`).

### F-078 · README:4411
> `REQ-items-carry-a-domain` — **Retired by decision.** `NOGOAL-no-domain-axis-on-items` supersedes it … It is `superseded`, so nothing injects it

**Verdict:** VERIFIED
**Citation:** `my-context/.my_context/items/requirement/REQ-items-carry-a-domain.md` → `status: superseded`; `my-context/.my_context/items/non_goal/NOGOAL-no-domain-axis-on-items.md` → `status: active`.

### F-079 · README:4414–4416
> `OPENQ-how-do-filters-respect-dependencies` … is superseded by the decision that answered it

**Verdict:** VERIFIED
**Citation:** `my-context/.my_context/items/open_question/OPENQ-how-do-filters-respect-dependencies.md` → `status: superseded`. `REQ-session-focus-controls-what-loads` is `status: active` and `mycontext focus` is in the usage banner (`own-run/help-banner`), matching README:4412.

### F-080 · README:4424–4426
> **`observations` cannot be edited by anyone, at any surface, by any origin.** … `update_item` has no such argument and neither does `mycontext edit`.

**Verdict:** VERIFIED
**Citation:** `mcp/update_item-unknown-arg` — "It accepts: id, title, body, scope, tags, severity, always, status, extra." `own-run/edit-observations` — `mycontext edit … --observations x --yes` exits 1 with "unknown option \"--observations\"", and the usage line offers no such flag.

### F-081 · README:4427–4430
> **`mycontext add` has no `--extra`.** … `create_item` takes them, so the route that exists is asking the model.

**Verdict:** VERIFIED
**Citation:** `own-run/add-extra-probe` — `add … --extra directive=prohibit --yes` exits 1: "unknown option \"--extra\"". `mcp/create_item-origin-refused` enumerates `create_item`'s accepted arguments and they include the category-specific fields `directive, impact, kind, likelihood, validate_by, validated_on`.

### F-082 · README:4431–4434
> **Deletion will not be added at all.** `NOGOAL-no-agent-hard-delete` is an active item in this repository's own corpus … Retirement is supersession — `mycontext supersede <id> --by <id>`, which exists

**Verdict:** VERIFIED
**Citation:** `my-context/.my_context/items/non_goal/NOGOAL-no-agent-hard-delete.md` → `status: active`. `own-run/supersede-cli` — "Nothing was deleted — the file remains and the item stays searchable."

### F-083 · README:4438–4444
> Its log is append-only and never pruned … `mycontext doctor` has no check for the directory at all … the directory carries a `.gitignore` containing `*`, written by the code that creates it

**Verdict:** VERIFIED
**Citation:** `own-run/revisions-dir` — `cat .my_context/.revisions/.gitignore` → `*`. `own-run/discard-revision` — the log only ever gains lines (`stage`, `promote`, `discard`), never rewrites one. `own-run/doctor-clean` — `doctor --full` reported "0 error(s), 0 warning(s), 0 note(s) across 0 finding(s)" with a populated `.revisions/` present; `grep -n "revision" my-context/src/doctor/checks.ts` finds only the comment at :677-679 ("**The growth check the revision log never got.**").

### F-084 · README:4446–4450
> It is gitignored for the same reason … it rotates at 8 MiB but still never deletes … it has a `doctor` check that reports its size. The revision store still has none.

**Verdict:** VERIFIED
**Citation:** `own-run/audit-dir` — `.my_context/.audit/.gitignore` contains `*`. `my-context/src/core/audit.ts:245` — `export const AUDIT_MAX_BYTES = 8 * 1024 * 1024;`, with `rotateIfFull` at :320 and the comment at :222-223 ("8 MiB, which is roughly 20,000–40,000 records"). `my-context/src/doctor/checks.ts:701-715` — the `audit_log_size` finding, and its comment at :691-693 records that nothing ever removes a segment.

### F-085 · README:4466–4472
> **Two categories can share an id prefix, and nothing says so.** … give `rule` and `invariant` both `{"prefix": "POLICY"}` and the second item minted is `POLICY-…-2`, with no error, no warning and no `doctor` finding.

**Verdict:** VERIFIED
**Citation:** `own-run/prefix-collision` (workspace `secF2`) — with exactly that config, `doctor --short` reported "0 error(s), 0 warning(s), 0 note(s)" at config load; `add rule "Same title here"` minted `POLICY-same-title-here` and `add invariant "Same title here"` minted **`POLICY-same-title-here-2`**; `doctor --short` afterwards again reported 0/0/0.
**Note:** Reproduced verbatim, including the `-2` suffix.

### F-086 · README:4473–4478
> **A category you declare gets no slash command.** The generator handles a custom category correctly, but `commands/` is generated from the **default** configuration when the plugin is built

**Verdict:** VERIFIED
**Citation:** `my-context/scripts/gen-commands.ts:28` — `const files = generateCommands(resolveConfig({}));`, i.e. the default config, while `generateCommands(config: Config)` (`src/plugin/commands.ts:922`) does iterate `enabledCategories(config)`. `own-run/commands-dir` — the 21 `add-*` files correspond exactly to the 21 built-in categories.

### F-087 · README:4482–4483
> `mycontext help` takes four topics — `categories`, `scope`, `capture`, `workflow` — and `mycontext help query` and `mycontext help config` are both refused by name.

**Verdict:** VERIFIED
**Citation:** `own-run/help-topics` — the banner prints "help topics: categories, scope, capture, workflow"; `mycontext help query` → "\"topic\" must be one of: categories, scope, capture, workflow. You passed \"**query**\"", and `mycontext help config` gives the same with "\"**config**\"".

### F-088 · README:4492–4499
> `mycontext init --global` is **refused**, and the refusal names the global root — `~/.my-context`, with a hyphen — and the route that works

**Verdict:** VERIFIED
**Citation:** `own-run/init-global` — exit 1: "init takes no arguments, and \"--global\" was passed. Nothing was created … The global layer is **C:\Users\UserC\\.my-context**, and no command creates one or writes to one: build an ordinary workspace somewhere else and move the directory it made into that path."

### F-089 · README:4497–4499
> Every write path refuses a non-project item, and `mycontext repair` names the global items it declined to re-stamp

**Verdict:** UNVERIFIED
**Citation:** —
**Note:** No global layer exists at `~/.my-context` on this machine, and creating one under the user's home directory is outside this audit's scope. `own-run/repair-after-hand-edit` shows `repair`'s message scoped to "1 **project** item(s)", which is consistent but does not exercise the global branch.

### F-090 · README:4509–4514
> **Linux is covered by CI and not certified by a run this project has seen.** … No result of a real Linux run has been verified here … Certification means running it and saying what happened, not asserting that the matrix implies it.

**Verdict:** CONTRADICTED
**Citation:** `my-context/docs/ROADMAP.md` row **E1** — the original text is struck through and replaced by "**Certified 2026-08-16: run 31965803312 (`e1-linux-finish`, 79eb359) is green on both jobs — every step, typecheck through `test:perf`.**", followed by a per-claim account of the ubuntu job's logs (7 deliberate skips named, real symlinks exercised, the case-sensitivity test timestamped "log 2026-08-16T18:53:41Z, 0.87ms"). Row status: `✅ 2026-08-16`. `docs/ROADMAP.md:36` repeats "full matrix green on run 31965803312".
**Note:** Expected per README: no verified Linux run. Actual: a named, dated, log-cited certification in the project's own roadmap. The CI half of the claim is correct — `.github/workflows/ci.yml:8` is `os: [windows-latest, ubuntu-latest]`.

### F-091 · README:4515–4522
> **Nothing has been released or tagged yet.** … there are no git tags, so everything to date sits under `[Unreleased]` and the `0.1.0` the manifests carry is the version being prepared, not one that was published.

**Verdict:** CONTRADICTED — three ways
**Citation:** `own-run/git-tags` — `my-context/` is its own repository (`git rev-parse --show-toplevel` → `…/my-context`) and `git for-each-ref refs/tags` returns **`v0.9.0` (2026-08-16, d548938)** and **`v1.0.0` (2026-08-17, 9e6a343)**. `my-context/CHANGELOG.md` has `## [Unreleased]` at :29 followed by released sections **`## [1.0.0] - 2026-08-17`** at :31 and **`## [0.9.0] - 2026-08-16`** at :213, and states at :9 "**`0.9.0` is the first tagged version**". `my-context/package.json:3` and `my-context/.claude-plugin/plugin.json:3` both read `"version": "1.0.0"` — no `0.1.0` appears in either manifest; `mycontext status` prints `my_context **1.0.0**` (`own-run/status`).
**Note:** Expected: no tags, everything under `[Unreleased]`, manifests at `0.1.0`. Actual: two tags, two released changelog sections, manifests at `1.0.0`.

### F-092 · README:4526–4531
> The just-in-time hook serves from the Markdown itself in exactly two cases: the read-only open of `.my_context/.index.db` fails, or the index's recorded schema version is not the one this build expects. An index that opens cleanly with the right schema is trusted — including a **stale** one

**Verdict:** VERIFIED
**Citation:** `my-context/src/hooks/pre-tool-use.ts:173-179` — `try { store = Store.openReadOnlyChecked(ws.dbPath); candidates = store.activeInjectable(…) } catch { … candidates = activeInjectableFromItems(loadCorpusItems(…)) }`. There is no freshness comparison anywhere on that path; a successfully opened index's rows are used as-is.
**Note:** The code comment at :159-160 enumerates the failure modes as "absent file, stale schema, corruption", so "the open fails" covers three conditions rather than one — the README's two-case framing collapses absent-file and corruption into "open fails", which is accurate but not exhaustive as phrased.

### F-093 · README:4534–4536
> Session start is unaffected: it injects from the Markdown itself and only refreshes the index afterwards, best-effort. `mycontext doctor` reports index freshness, but only when someone runs it.

**Verdict:** VERIFIED
**Citation:** `my-context/src/hooks/session-start.ts:1` imports `buildInjection` from `src/core/inject.ts`, which loads layers from Markdown at :73 (`rebuildRoots(ws)` + `loadLayer`) and only opens the store at :236-246, under the comment at :48 "The index refresh below is **best-effort** and disclosed". `my-context/src/doctor/checks.ts:147` — `level: 'warn', code: 'index_stale'`, described at :112 as comparing against `.md` mtimes.

### F-094 · README:4545
> **10 test files under `test/docs/`**

**Verdict:** VERIFIED
**Citation:** `own-run/test-docs-ls` — `my-context/test/docs/` contains exactly 10 files: `capabilities`, `categories`, `compaction-claim`, `counts`, `examples`, `fixture`, `injection`, `inventory`, `parity`, `staged-revision` (`.test.ts`).

### F-095 · README:4553–4555
> `counts.test.ts` computes the "9 of the 30 CLI commands" ratio above from the running program and fails in **both** languages if either half drifts

**Verdict:** VERIFIED
**Citation:** `my-context/test/docs/counts.test.ts` — `DOCUMENTS = ['README.md', path.join('docs', 'README.he.md')]` at :35, slash names read from `commands/` at :62, the no-slash list derived "by subtracting one from the" other at :16, and the ratio test at :218 described as "The ratio in §8, both halves of it."

### F-096 · README:4559–4562
> `test/plugin/parity.test.ts` checks that every MCP tool has a command and that every asymmetry above is declared, and `test/plugin/write-commands.test.ts` runs the dry run each write command names

**Verdict:** VERIFIED
**Citation:** Both files exist at `my-context/test/plugin/parity.test.ts` and `my-context/test/plugin/write-commands.test.ts`. `src/plugin/parity.ts:100-102` states the contract the first enforces: "the test refuses an entry with no reason and refuses a command that is missing from the list."

---

## 9. Glossary

### F-097 · README:4583
> **active** | the one status that is eligible for injection. An item is active because a human made it so: by capturing it with `mycontext add` and an explicit yes, or by promoting a draft

**Verdict:** CONTRADICTED
**Citation:** `mcp/create_item-rationale` — an agent's `create_item(type: decision)` produced "created DEC-we-chose-stripe (**active**)" with no human act at all; reproduced for `lesson` in `own-run/agent-lesson-active`, and recorded live as `reports/LIVE-PASS.md` L14.
**Note:** Expected per the glossary: `active` implies a human decision. Actual: every rationale-tier capture by an agent lands `active` directly — which README:4040-4042 states correctly two hundred lines earlier. The glossary entry omits the third route.

### F-098 · README:4584
> **agent** | the value of `origin` on anything Claude wrote through an MCP tool. No tool accepts `origin` as an argument, so an agent cannot claim to have been a human

**Verdict:** VERIFIED
**Citation:** `mcp/create_item-origin-refused` (F-020); `own-run/audit-origins` — MCP writes recorded `who: agent` throughout.

### F-099 · README:4585
> **always** | `always: true` means injected in full at every session start, whatever files you touch

**Verdict:** VERIFIED
**Citation:** `own-run/session-start-secF` — `CONST-agent-authored-draft-probe` (`always: true`, scope `src/**`) was injected in full at session start despite no file being touched.
**Note:** True only of an *active* item: a draft carrying `always: true` is not injected (F-001). The entry does not say so; the `draft` entry at README:4593 does.

### F-100 · README:4587
> **budget** | the size limit on one injection tier … Four of them, one per tier

**Verdict:** VERIFIED
**Citation:** `config/budgets-defaults` — "pinned 6000, jit 6000, restored 8000, index 1200".

### F-101 · README:4589
> **checksum** | a hash of an item's own content, re-stamped on every write. `mycontext doctor` compares it to the file to notice a hand edit

**Verdict:** VERIFIED
**Citation:** `own-run/repair-after-hand-edit` (F-057); `reports/LIVE-PASS.md` L18.

### F-102 · README:4592
> **deprecated** | retired with no replacement named. It is what `mycontext review discard` sets on a draft. Not injected; the file stays where it is

**Verdict:** VERIFIED
**Citation:** `own-run/review-discard` — "RULE-discard-probe is now deprecated. It is kept as a trail rather than deleted"; `own-run/session-start-secF` counts it among "retired" and injects nothing for it.

### F-103 · README:4593
> **draft** | Not injected by any tier, counted in the review queue … Every normative item Claude captures starts here

**Verdict:** VERIFIED
**Citation:** `own-run/draft-never-injected` (F-001, F-008); `mcp/create_item-minimal`.

### F-104 · README:4595
> **governing** | being eligible for injection *and* phrased as an instruction. Normative items govern; rationale items never do

**Verdict:** VERIFIED
**Citation:** `own-run/session-start-secF` — the injected block and the index listed only normative items; the active `lesson` appeared only as a count. `src/core/trust.ts:218` states the same rule in code: "neither the pinned tier nor severity governs anything outside the normative tier".

### F-105 · README:4602
> **MCP** | my_context serves fourteen of them over stdio, and they are the model's only surface short of a shell

**Verdict:** VERIFIED
**Citation:** `mcp/handshake-and-list` — fourteen tools returned by `tools/list`; `reports/LIVE-PASS.md` L2 confirms all fourteen exposed in a live Claude Code session.

### F-106 · README:4604
> **origin** | who wrote an item: `human`, `agent` or `ingest`. The trust boundary is built on this field

**Verdict:** VERIFIED
**Citation:** `mcp/handshake-and-list` — `audit_log`'s `actor` enum is `["human","agent","ingest"]`; `own-run/status` — `mycontext status`'s "by origin" table showed `agent` and `human` rows.

### F-107 · README:4605
> **pending revision** | … Created by the `agentEdits: "review"` policy, never by a human's edit, and never injected

**Verdict:** VERIFIED
**Citation:** `own-run/edit-body-human` — a human `edit --body` on an item with revisions pending applied directly and staged nothing; it only reported which existing revision it made stale. `own-run/session-start-pending` for the never-injected half.

### F-108 · README:4606
> **pinned** | `mycontext review promote <id> --always` puts a draft there; `mycontext pin <id>` puts a governing item there

**Verdict:** VERIFIED
**Citation:** `own-run/promote-always-clean` and `own-run/pin-preview` (F-066).

### F-109 · README:4607
> **rationale** | Indexed, searchable, retrievable on request — never injected uninvited

**Verdict:** VERIFIED
**Citation:** `own-run/session-start-secF` — the active lesson contributed only "1 lesson" to the summary line and was retrievable through `mycontext list lesson`.

### F-110 · README:4610
> **severity** | `hard` or `soft`. It changes the order items are admitted to a budget, nothing else: hard first

**Verdict:** CONTRADICTED
**Citation:** `my-context/src/core/select.ts:242-246` — `focusHides()` short-circuits on `severity === 'hard'`, so a hard item is also exempt from session-focus narrowing. Stated in the README's own body at **README:2484** and **README:2719**.
**Note:** Same defect as F-060, restated in the glossary. "hard first" is itself correct (`select.ts:260-275`, `SEVERITY_RANK` in `byPriority`); "nothing else" is not.

### F-111 · README:4613
> **stale** | said of a pending revision whose base text a human has changed since it was staged, in the very field it rewrites. Promoting one is refused; `--force` promotes it anyway and destroys the newer text, after showing you what it destroys

**Verdict:** VERIFIED
**Citation:** `own-run/stale-per-field`, `own-run/promote-stale-refused`, `own-run/force-stale` (F-030, F-031).

### F-112 · README:4614
> **superseded** | retired in favour of a named replacement, by `mycontext supersede`. Not injected; both items record the relation, and both files stay

**Verdict:** VERIFIED
**Citation:** `own-run/supersede-cli` (F-045); `own-run/session-start-secF` counts superseded items among "retired" and injects nothing for them.
**Note:** The MCP `supersede_item` tool reaches the same status for the items it is permitted to retire (`own-run/mcp-supersede-rationale`), so `mycontext supersede` is not the only spelling.

### F-113 · README:4616
> **validated** | It is not injected — only `active` is — and it counts among the retired in the session index, but **an agent cannot supersede it**. `mycontext edit <id> --status validated` sets it … the `update_item` tool can too

**Verdict:** CONTRADICTED
**Citation:** `own-run/mcp-supersede-validated` — `mycontext edit DEC-validated-rationale-probe --status validated --yes` set the status, and then `supersede_item {"id":"DEC-validated-rationale-probe","by":"CONST-pool-capped-at-twenty"}` returned `isError=false`: "DEC-validated-rationale-probe **is now superseded** by CONST-pool-capped-at-twenty." The guard's own refusal text names its scope — "a non-human caller cannot supersede a governing **normative** item … or **any rationale item — is unaffected**".
**Note:** Expected: an agent cannot supersede a validated item. Actual: an agent can, whenever the item is rationale-tier. The remaining clauses of the entry hold: `own-run/validated-not-injected` — setting a normative rule to `validated` removed it from the injection and moved the session-index summary from "5 retired" to "6 retired"; `own-run/edit-status-validated` set it from the CLI; and `update_item` sets `status` on rationale items (`own-run/rationale-status-change`) subject to the normative refusal of F-015.

### F-114 · README:4617
> **watched docs** | Configured under `watchedDocs`; the list you give replaces the defaults

**Verdict:** VERIFIED
**Citation:** `config/watched-docs-override` ("README 3994: watchedDocs replaces the defaults") and `config/watched-docs-override-hides-default`; `reports/LIVE-PASS.md` L10/L11 for the live behaviour.
