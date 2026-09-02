# my-context v1.0.0 — findings

This campaign exercised the `mycontext` Claude Code plugin across eight surfaces —
CLI capture, CLI mutation, CLI retrieval, CLI pipelines, MCP tools, hooks, config,
and the slash-command layer — producing 419 captured runs in
`harness/evidence/*.jsonl`; a **22-of-22 live pass inside Claude Code**
(`reports/LIVE-PASS.md`), which is the only place the hook layer can be exercised
for real; and a **line-by-line audit of all 4,625 README lines**
(`reports/claims/`), yielding 716 checkable claims. Every finding below traces to
one of those captured runs, to a directly-reproduced command, or to a verbatim
quote in `reports/CAMPAIGN-LEDGER.md`, the authoritative record of this campaign.

**Nothing here is reported on an agent's say-so.** Five findings proposed during
the campaign turned out to be false and were caught before publication; the fifth,
`D2-032`, was a documentation "defect" that would have corrupted correct text had
it been fixed unread. Every contradiction below was re-derived from source, from a
live run, or from arithmetic.

**Environment:** Windows 11 Pro 26300, Node v24.14.0, Claude Code 2.1.233.
Commit `2f306ad`, tag `v1.0.0`. Linux and macOS were **not** tested; every finding
below is scoped to this environment unless stated otherwise.

## Summary

| ID | Severity | Surface | Description |
|---|---|---|---|
| D10 | High | CLI | `audit --role` silently filters nothing outside `--items` — **fixed** `af0fe17` |
| D22 | High | packaging/docs | Live install verification names a count and a label that don't exist in the real output — **fixed** `3f278ff` |
| F1 | High | test suite / hooks / MCP | 11 of the plugin's own tests fail on Node 24.14.0, the stated minimum |
| D2 | Medium | CLI | `add --yes=false` and omitting `--yes` produce an identical, misleading message |
| D6 | Medium | CLI | CLI-surface errors point the user at MCP tool-call syntax, not a CLI command |
| D11 | Medium | CLI | `audit --role` accepts any string with zero validation — **fixed** `af0fe17` |
| D13 | Medium | CLI | `decay`'s caveat never discloses it skips decision/lesson items |
| D20 | Medium | hooks | PostToolUse never writes to the audit ledger; every other hook does |
| D21 | Medium | MCP | `link_items` records a relation on the source item only |
| F3 | Medium | MCP | `serverInfo.version` reports `0.1.0` while the plugin is `1.0.0` — **fixed** `02cdbc8` |
| F4 | Medium | test suite | A timing test asserts an *upper* bound on wall-clock backoff inside a concurrent runner. Growing both READMEs ~5% took it from ~262ms to 461ms against a 400ms ceiling, turning the suite red on a documentation-only change — **found by this campaign's own fix branch failing its pin**; fixed `2fc0c52` |
| D3 | Low | CLI | Three commands report the same "unknown category" rule three different ways |
| D4 | Low | CLI | `rebuild` silently accepts an unknown flag; `init`/`add`/`status` refuse |
| D5 | Low | CLI | Two unrelated `help` refusals share one hardcoded, topic-blind trailer |
| D7 | Low | CLI | `list --short` is byte-identical to `list` with no flag |
| D8 | Low | CLI | `supersede --by` missing gives a bare usage line, no explanation |
| D9 | Low | CLI | Sibling commands say "unknown option"; `repair` alone says "unknown flag" |
| D14 | Low | CLI | "Closest match" hints exist for `--kind` typos but not `--op` typos |
| F2 | Low | packaging | `.mcp.json` can't resolve `${CLAUDE_PLUGIN_ROOT}` in project scope |
| D1 | Low | docs | README says `init` ignores an unknown flag; it refuses |
| D12 | Low | docs | `audit --role`/`--until` missing from README; `--role` missing from built-in help too — **fixed** `af0fe17`, `9c18f0e` |
| D15 | Low | docs | `search --relation` accepts 8 relation types; `focus --relations` lists 16 — undocumented |
| D16 | Low | docs | Default `--limit` differs across commands (search 50, query 1000) — undocumented |
| D17 | Medium | docs | *superseded by `D1-A1`* — "these twenty-five are all of them"; 20 further flags run at exit 0 |
| D18 | Medium | docs | *superseded by `D1-013`* — README's install text says "38 commands"; 66 command files ship — **fixed** `3f278ff` |
| L-F1 | Medium | hooks | The write-deny does not cover `Bash`; shell writes into `.my_context/` are undenied **and unaudited** |
| L-F2 | Low | MCP/CLI | The audit filter is `actor` on the MCP tool, `--origin` on the CLI, `origin` in the record |

### README findings — 33 verified contradictions

Full detail in [README findings](#readme-findings--the-claim-audit-verified).
Four systematic clusters account for fourteen of them; a single fix closes each
cluster.

| Cluster | IDs | Root cause |
|---|---|---|
| 1 — release sweep | `F-090` `F-091` `F-059` **+ `F3` (code)** | Section 12 still describes a pre-release project: it denies tags that exist, a Linux certification that happened, and manifests that read `1.0.0` |
| 2 — `known_issue` | `D1-017` `D1-018` `E1-084` | The category moved to the normative tier; the README's trust-boundary description did not move with it. **`D1-018` inverts the trust boundary** for one category |
| 3 — `tags`/`severity` | `B-006` `B-078` `B-075` `F-060` `F-110` | Both fields are called inert with respect to injection in five places; `select.ts:228` and `:242–246` make both decide *whether* an item is injected under a focus. README:2484 already says so correctly |
| 4 — flag totality | `B-009` `D1-A1` `D2-079` | "These twenty-five are all of them" — 25 rows is exact, 20 further flags run at exit 0 |

The remaining nineteen are individual: `A-037` `B-030` `B-053` `C-026` `C-058`
`D1-013` `D1-023` `D1-058` `D1-076` `D2-025` `D2-043` `D2-049` `D2-089` `D2-091`
`E1-082` `E2-094` `F-032` `F-097` `F-113`. Two of them —`D2-049` and part of
`C-058` — are the README being **harder on itself than the code deserves**.

**One is a code change, not a text edit:** `F3`, `src/mcp/protocol.ts:33`.

### Fix status

Branch `fix/v1.0.0-doc-sweep` in `my-context/` (8 commits, authored Dudi Bar-On,
**never pushed**) closes: all 33 README contradictions, plus `F3`, `D10`, `D11`,
`D12`, `D18`, `D22` and `F4`. Baseline after: `failed: 11  known-red: 11`,
matching the pin; `npm run gen:docs` reports both documents `unchanged`.

Deliberately **not** fixed, each for a stated reason — see `reports/PUSH-PROMPT.md`:
`F1` (suppressing a stderr assertion to accommodate an environment can hide a
regression), `L-F1` (intercepting shell is not feasible; section 7 already
discloses it), `L-F2` (renaming an MCP parameter is a breaking schema change),
and the CLI message-consistency set `D2`–`D9`, `D13`–`D16`, `D20`, `D21`, `F2`,
which are small design decisions that should be the author's.

## How to read this

Every finding cites an evidence id shaped `<surface>/<caseId>`, resolving to a
record in `harness/evidence/<surface>.jsonl`. To look one up:

```bash
node --input-type=module -e "
const {load} = await import('./harness/lib/evidence.mjs');
const r = await load('cli-retrieve');
const x = r.find(v => v.caseId === 'audit-role-garbage');
console.log(x.exitCode, x.stdout);
"
```

Surfaces: `cli-capture`, `cli-mutate`, `cli-retrieve`, `cli-pipelines`, `mcp`,
`hooks`, `config`, `slash`. Two findings (D22, and part of F2) cite a live
Claude Code session or a static file read instead, since neither has a
`<surface>/<caseId>` record - each says so explicitly and gives the exact
command or file to reproduce it.

## Findings

### D10 — `audit --role` silently does nothing outside `--items`

**Severity:** High — a filter that looks like it worked returns unfiltered results with no error, in an audit/compliance-oriented feature.
**Surface:** CLI
**Evidence:** `cli-retrieve/audit-bare`, `cli-retrieve/audit-role`, `cli-retrieve/audit-role-garbage`

**Expected.** `mycontext audit --role <value>` should narrow the audit table to records with that role, the way `--kind`, `--op`, `--item`, `--since`/`--until` all demonstrably narrow it elsewhere in this report.

**Actual.** `audit-bare` (no filters) and `audit-role` (`--role subject`, a value valid inside `--items`) return byte-identical output - the same 6 records:
```
my_context: 6 audit record(s), oldest first (most recent 50):
  +----------------+--------+-------+-------------------------------------------+--------+
  | when           | op     | who   | subject                                   | detail |
  ...
```
`audit-role-garbage` (`--role nonsense`, an outright invalid value) *also* returns exactly those same 6 records, exit 0, no warning. Source: `buildFilter()` in `audit.ts:33-82` reads `since/until/item/session/kind/op/origin/limit` but never reads `role` at the top level - `role` is only consulted inside the separate `--items` branch, where the valid values are `subject|injected|spilled`, not values a user would reasonably try against the top-level table.

**Why it matters.** A user filtering an audit trail by role - a natural thing to want from a tool whose stated purpose is auditability - gets the unfiltered result set back with nothing telling them the flag did nothing. In a review or compliance context, that's exactly the kind of silent no-op that leads someone to believe they reviewed a narrowed set when they didn't.

**Suggested fix.** Either wire `role` into `buildFilter()` for the default audit view, using the same values already validated inside `--items`, or reject `--role` outside `--items` the way an unrecognized flag is rejected elsewhere. Silently accepting and ignoring it is the option that shouldn't ship.

---

### D22 — Live install verification can't find what it's told to look for

**Severity:** High — this is the first thing a new user does after installing, and the documented instructions don't match what they see.
**Surface:** packaging / docs
**Evidence:** Task 15 live install pass, quoted verbatim in `CAMPAIGN-LEDGER.md`; no `<surface>/<caseId>` record exists for this (see note below). Numeric half independently corroborated by `slash/file-count`.

**Expected.** README:1777-1782 instructs a new user to run `claude plugin details mycontext@mycontext` to verify their install, and says it will print "the 38 commands and the mycontext skill, the four hooks ... and the one MCP server."

**Actual.** The real output, captured live during this campaign's install pass:
```
Skills (67) | Agents (0) | Hooks (4) | MCP servers (1) | LSP servers (0)
```
Wrong twice over: the count is 67 (66 commands + 1 skill), not 38; and there is no "commands" line at all - Claude Code reports them as **Skills**, so a user following the instructions literally is hunting for a word that never appears. `Hooks (4)` and `MCP servers (1)` do match the README.

**Why it matters.** This is the install-verification step - the one place a brand-new user is told exactly what to check before trusting the install worked. Both halves of the check fail: the number is stale (independently confirmed - `slash/file-count` records 66 real command files, and README:1723 elsewhere already correctly says "66 slash commands," so the "38" at line 1780 was already wrong on its own terms), and "commands" is not a word Claude Code's `plugin details` output uses at all.

**Suggested fix.** Update README:1780 from 38 to 66 (or 67 counting the skill), and rewrite the verification instructions to say "Skills" - the label Claude Code actually shows - instead of "commands." That label is a Claude Code choice, not something the plugin controls; the fix is entirely in what the README tells the reader to expect.

*Note on evidence form:* this was captured directly during Task 15's live install pass (a real `claude plugin details` invocation), not through the `harness/evidence/*.jsonl` sweep, so there is no `<surface>/<caseId>` id for it - it is quoted verbatim in `CAMPAIGN-LEDGER.md`, the authoritative record for this campaign, and reproducible by running the same command after installing the plugin as documented.

---

### F1 — 11 of the plugin's own tests fail on Node 24.14.0, the stated minimum

**Severity:** High — the suite is red on a supported, stated Node version.
**Surface:** test suite, hooks, MCP server
**Evidence:** reproduced directly via `node harness/baseline.mjs`; corroborated by `stderr` on 401 of the 419 harness evidence records, e.g. `mcp/handshake-and-list`, `hooks/session-start-startup`

**Expected.** `npm test` green on Node `>=24.0.0`, the plugin's stated floor. The plugin's own `CONST-node-24-no-build-step` item states *"Node >= 24.0.0 - required for stable node:sqlite."*

**Actual.** Running the plugin's suite on this machine (Node v24.14.0) via the harness's pinned-baseline check:
```
failed: 11  known-red: 11
baseline matches the pin
```
9 of the 11 are in `test/hooks/hook-binaries-e2e.test.ts`, 2 in `test/mcp/server-e2e.test.ts` - all assert stderr is byte-empty. On Node 24.14.0, `node:sqlite` emits `ExperimentalWarning: SQLite is an experimental feature and might change at any time` to stderr on every process start, so every hook binary and the MCP server inherit it. This campaign's own evidence corroborates the root cause directly - 401 of 419 captured records carry this exact line on `stderr`, e.g. `mcp/handshake-and-list`:
```
"(node:232048) ExperimentalWarning: SQLite is an experimental feature and might change at any time\n(Use `node --trace-warnings ...` to show where the warning was created)\n"
```

**Compounding documentation defect.** The plugin's own `CONST-node-24-no-build-step` item calls `node:sqlite` "stable" on Node >=24.0.0. It is not - it is still experimental and still warns, on the exact version the plugin requires.

**Why CI did not catch it.** `.github/workflows/ci.yml` pins `node-version: '24'`, which floats to whatever 24.x is current. CI was presumably green at release and has gone red since, on an unchanged commit.

**Suggested fix.** Suppress the warning at the plugin's own entry points (`--no-warnings=ExperimentalWarning`, or `process.removeAllListeners('warning')` in the hook and server entry scripts) rather than weakening the tests' byte-empty-stderr assertion. Then correct the constraint item's wording, and consider pinning CI to a specific 24.x point release so the matrix is reproducible.

---

### D2 - add --yes=false and omitting --yes give an identical, misleading message

**Severity:** Medium
**Surface:** CLI
**Evidence:** cli-capture/add-yes-false, cli-capture/add-normative-without-yes

**Expected.** A refusal message should reflect what the user actually passed.

**Actual.** Both produce byte-identical stdout:
```
about to create constraint "Uploads capped at 10 MB" - active, and governing this project at once.
my_context: refusing without confirmation - stdin is not interactive. Rerun with --yes to confirm, or run this from an interactive terminal.
```

**Why it matters.** Rerun with --yes reads as if the tool never noticed the user answered.

**Suggested fix.** When --yes=false is passed explicitly, say so distinctly from the missing-flag case.

---

### D6 - CLI-surface errors point the user at MCP tool-call syntax, not a CLI command

**Severity:** Medium
**Surface:** CLI
**Evidence:** cli-capture/add-unknown-category, cli-capture/help-query-refused

**Expected.** A CLI error's suggested next step should be something a terminal user can actually run, e.g. mycontext help categories.

**Actual.** Every category- and topic-validation refusal on the CLI surface ends with MCP tool-call syntax, not a CLI command:
```
my_context: "type" must be one of: constraint, invariant, ... You passed "nosuchtype". See mycontext_help("categories").
my_context: "topic" must be one of: categories, scope, capture, workflow. You passed "query". See mycontext_help("workflow").
```
mycontext_help("categories") is the name of an MCP tool - confirmed present in mcp/handshake-and-list's tool list - not something typed at a shell prompt. The CLI equivalent is mycontext help categories.

**Why it matters.** A CLI user who copies the suggested next step verbatim gets another failure.

**Suggested fix.** Branch the suggestion text on which surface produced the error.

---

### D11 - audit --role has no validation, unlike its siblings

**Severity:** Medium
**Surface:** CLI
**Evidence:** cli-retrieve/audit-role-garbage, cli-retrieve/audit-kind-invalid, cli-retrieve/audit-op-invalid

**Expected.** Consistent with --kind and --op, an invalid --role value should be rejected with a "must be one of" error.

**Actual.** audit --kind nope and audit --op nope both refuse (exit 1) with an enumerated list of valid values:
```
my_context: "kind" must be one of: mutation, injection, hook, focus. You passed "nope". The closest match is "hook". See mycontext_help("workflow").
my_context: "op" must be one of: create, update, stage, promote, discard, supersede, accept, refresh, link, unlink, session-start, compact-restore, jit, manual, pre-compact, post-tool-use, deny, focus-set, focus-clear. You passed "nope". See mycontext_help("workflow").
```
audit --role nonsense exits 0 and returns all 6 records, unfiltered - silently accepted at every call site.

**Why it matters.** Together with D10, --role is the one audit filter a user can mistype, misuse, or misunderstand with zero feedback.

**Suggested fix.** Once D10 settles whether --role gets wired into the top-level filter, validate it the same way --kind/--op are validated.

---

### D13 - decay's caveat never discloses that it only covers normative-tier items

**Severity:** Medium
**Surface:** CLI
**Evidence:** cli-retrieve/decay-bare, cli-retrieve/audit-bare

**Expected.** decay's own caveat text already goes out of its way to explain what "cold" means and to warn against acting on the report alone. That care should extend to which items are even eligible.

**Actual.** The corpus (from audit-bare, same seed) contains 6 items: 2 constraints, 1 invariant, 1 rule, 1 decision, 1 lesson. decay-bare's "cold" table lists exactly 4 - the 2 constraints, the invariant, and the rule. The decision and lesson are excluded, silently: core/decay.ts:103 deliberately scopes decay to normative-tier items only.

**Why it matters.** A user running decay to find abandoned items reasonably assumes it swept everything.

**Suggested fix.** Add one line to the caveat stating which categories are, and are not, covered.

---

### D20 - PostToolUse never writes to the audit ledger; every other hook does

**Severity:** Medium
**Surface:** hooks
**Evidence:** hooks/post-tool-use-watched, hooks/post-tool-use-unwatched, hooks/post-tool-use-inside-my-context, hooks/post-tool-use-empty-stdin, hooks/post-tool-use-garbage-stdin; contrast hooks/session-start-startup, hooks/pre-tool-use-scoped-hit, hooks/pre-compact-basic

**Expected.** If SessionStart, PreToolUse, and PreCompact all touch the SQLite-backed store, PostToolUse events should be equally visible to mycontext audit.

**Actual.** All 5 captured PostToolUse records have byte-empty stderr, against the other three hooks, which all carry the SQLite warning. post-tool-use.ts never imports Store.

**Why it matters.** mycontext audit documents itself as the record of what my_context did. If PostToolUse events leave no trace there, an audit of hook activity is incomplete by one quarter.

**Suggested fix.** May be intentional. If so, a doc note helps. If not, add an audit_log write when the nudge fires.

---

### D21 - link_items records a relation on the source item only

**Severity:** Medium
**Surface:** MCP
**Evidence:** mcp/link_items-effect

**Expected.** Consistent with supersede_item, which the README documents as writing both directions.

**Actual.** link_items-effect creates two items, links them relates_to, then reads both back. The source carries the relation:
```
# Link Source

## Relations
- relates_to [[CONST-link-target]]
```
The target has no Relations section at all:
```
# Link Target
```
despite being the "to" side of that same relates_to link.

**Why it matters.** For a symmetric relation type, reading the target item never surfaces that anything points at it.

**Suggested fix.** For your judgement: record the relation on both sides, or document link_items as one-directional explicitly.

---

### F3 - MCP serverInfo.version reports 0.1.0 while the plugin is 1.0.0

**Severity:** Medium
**Surface:** MCP
**Evidence:** mcp/handshake-and-list

**Expected.** initialize should report the shipped version. VERSIONING.md:107 promises one test fails if the four places that declare it drift apart.

**Actual.** The handshake returns serverInfo: {"name":"mycontext","version":"0.1.0"}. src/mcp/protocol.ts:33 hardcodes it.

**Root cause.** serverInfo.version is a fifth version-declaration site not covered by the existing four-way parity test.

**Suggested fix.** Import the version from src/core/version.ts and extend the parity test to cover this fifth site.

---

### D3 - The same "unknown category" rule is reported three different ways

**Severity:** Low
**Surface:** CLI
**Evidence:** cli-capture/add-unknown-category, cli-capture/list-unknown-category, cli-capture/examples-unknown

**Expected.** The same validation rule, triggered from three sibling commands, should present itself consistently.

**Actual.** All three refuse with a "must be one of" list, but differ in field name and ordering:
```
add-unknown-category:   my_context: "type" must be one of: constraint, invariant, rule, requirement, standard, pattern, glossary, instruction, non_goal, open_question, runbook, environment, known_issue, adr, decision, lesson, tradeoff, assumption, edge_case, risk, reference. ...
list-unknown-category:  my_context: "category" must be one of: adr, assumption, constraint, decision, edge_case, environment, glossary, instruction, invariant, known_issue, lesson, non_goal, open_question, pattern, reference, requirement, risk, rule, runbook, standard, tradeoff. ...
examples-unknown:       my_context: "type" must be one of: constraint, invariant, rule, requirement, standard, pattern, glossary, instruction, non_goal, open_question, runbook, environment, known_issue, adr, decision, lesson, tradeoff, assumption, edge_case, risk, reference. ...
```
add/examples group tier-first; list is fully alphabetical. All three currently end with the same See mycontext_help("categories"). trailer - see D6 for why that trailer itself is a problem.

**Why it matters.** Three presentations of one rule is confusing to anyone who hits more than one of these commands.

**Suggested fix.** Extract the category-list formatting into one shared helper used by all three commands.

---

### D4 - rebuild silently accepts an unknown flag; init/add/status refuse

**Severity:** Low
**Surface:** CLI
**Evidence:** cli-capture/rebuild-with-args-dropped, cli-capture/init-unknown-arg, cli-capture/add-unknown-flag, cli-capture/status-unknown-flag

**Expected.** Consistent with init, add, and status, all of which refuse an unrecognized flag with my_context: unknown option "--nope".

**Actual.** mycontext rebuild --nope exits 0: my_context: indexed 0 item(s) - no complaint about --nope at all. Per the harness case's own note, this is deliberate: arguments are dropped at index.ts:811.

**Why it matters.** Currently harmless since rebuild accepts no meaningful flags. But rebuild sits in an undocumented "does not check" class, and if it ever gains real flags, a typo would silently no-op.

**Suggested fix.** Either route rebuild through the same unknown-flag check as its siblings, or document which commands validate arguments and which don't.

---

### D5 - Two unrelated help refusals share one hardcoded, topic-blind trailer

**Severity:** Low
**Surface:** CLI
**Evidence:** cli-capture/help-query-refused, cli-capture/help-config-refused

**Expected.** A "see also" trailer should point somewhere relevant to the actual mistake.

**Actual.** Both refusals - one for topic query, one for topic config - end with the identical hardcoded trailer, pointing at the unrelated workflow topic:
```
my_context: "topic" must be one of: categories, scope, capture, workflow. You passed "query". See mycontext_help("workflow").
my_context: "topic" must be one of: categories, scope, capture, workflow. You passed "config". See mycontext_help("workflow").
```

**Why it matters.** Minor, but the trailer reads as a specific recommendation and isn't one.

**Suggested fix.** Drop the trailer here, or make it generic rather than naming one specific topic every time.

---

### D7 - list --short is byte-identical to list with no flag

**Severity:** Low
**Surface:** CLI
**Evidence:** cli-capture/list-short, cli-capture/list-bare

**Expected.** Unclear from what this campaign captured - the README documents three detail levels (short/default/full), but whether "short" and the unflagged default are meant to be the same isn't stated either way in the evidence gathered here.

**Actual.** Identical output, byte for byte:
```
+-------------------------------+------------+--------+
| id                            | type       | status |
+-------------------------------+------------+--------+
| CONST-uploads-capped-at-10-mb | constraint | active |
+-------------------------------+------------+--------+
```

**Why it matters.** Consistent with default detail already being "short" - but only 2 of the 3 advertised detail levels are visibly distinct here.

**Suggested fix.** If intentional, a one-line README note saves a reader from wondering. If not, decide what --short should trim relative to the bare default.

---

### D8 - supersede --by missing gives a bare usage line, no explanation

**Severity:** Low
**Surface:** CLI
**Evidence:** cli-mutate/supersede-missing-by, cli-mutate/edit-unknown-flag, cli-mutate/supersede-unknown-flag

**Expected.** Consistent with how the same command explains an unknown flag.

**Actual.** supersede <id> with no --by prints only:
```
usage: mycontext supersede <retired id> --by <replacement id> [--reason <text>] [--yes]
```
No my_context: prefix, no sentence explaining what's wrong - contrast edit-unknown-flag and supersede-unknown-flag, both of which lead with my_context: unknown option "--nope". before the same style of usage line.

**Why it matters.** A user who omits a required flag gets less explanation than one who mistypes an optional one.

**Suggested fix.** Prefix the missing-by usage line with something like my_context: --by is required., matching the pattern used for unknown flags.

---

### D9 - Sibling commands say "unknown option"; repair alone says "unknown flag"

**Severity:** Low
**Surface:** CLI
**Evidence:** cli-mutate/edit-unknown-flag, cli-mutate/supersede-unknown-flag, cli-mutate/review-list-unknown-flag, cli-mutate/repair-unknown-flag

**Expected.** The same class of error should use one term across commands.

**Actual.** edit, supersede, and review list all say my_context: unknown option "--nope".  repair alone says my_context: unknown flag "--nope" for repair. It accepts --yes only. Running it without --yes lists what would be re-stamped and changes nothing.

**Why it matters.** Cosmetic vocabulary inconsistency; repair's message is otherwise more informative than the others.

**Suggested fix.** Pick one term across all commands; keep repair's extra explanatory sentence regardless.

---

### D14 - "Closest match" hints exist for --kind typos but not --op typos

**Severity:** Low
**Surface:** CLI
**Evidence:** cli-retrieve/audit-kind-invalid, cli-retrieve/audit-op-invalid

**Expected.** If the plugin offers a fuzzy-match hint for one enum flag, the same courtesy would be reasonable on a similar flag.

**Actual.** audit --kind nope gets a hint ("The closest match is \"hook\""). audit --op nope, enumerating 19 valid values, gets none.

**Suggested fix.** Apply the same closest-match logic used for --kind to --op (and to --role, once D10/D11 are resolved).

---

### F2 - .mcp.json can't resolve ${CLAUDE_PLUGIN_ROOT} in project scope

**Severity:** Low
**Surface:** packaging
**Evidence:** static inspection of my-context/.mcp.json, verified directly in this campaign; the runtime warning text below was observed during an earlier probe of the repo, not re-captured in the 419-record harness sweep (no surface/caseId exists for it)

**Expected.** Opening the repo in Claude Code should not produce a broken MCP entry.

**Actual.** my-context/.mcp.json, read directly from the clone:
```json
{
  "mcpServers": {
    "mycontext": {
      "type": "stdio",
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/src/mcp/server.ts"]
    }
  }
}
```
This file sits at the repo root, so it is also read as a project-scope MCP config whenever the repo itself is the working directory, a scope where CLAUDE_PLUGIN_ROOT is never set. Claude Code reports this as:
```
[Warning] [mycontext] mcpServers.mycontext: Missing environment variables: CLAUDE_PLUGIN_ROOT
```

**Scope.** Both documented install paths set the variable correctly, so end users are unaffected. This only bites the author and contributors working inside the repo itself.

**Suggested fix.** Add mycontext to disabledMcpjsonServers in the repo's own .claude/settings.json, or document the warning as expected inside the repo.

---

### D-DOC - documentation defects

These six all share one property: the plugin's behavior is not in question, only whether the README or the CLI's own built-in usage text describes it accurately. Each is fixable with a text edit, and none requires a behavior change.

| ID | Severity | Documentation claim | Where | Actual | Evidence |
|---|---|---|---|---|---|
| D1 | Low | A flag init doesn't know "is ignored without a word" | README:2841 | init --nope exits 1: "an argument this command cannot act on is refused rather than ignored" | cli-capture/init-unknown-arg |
| D12 | Low | --role and --until on audit | README (neither mentioned); built-in usage text | --until works and appears in audit's own built-in usage string, just not in the README. --role appears in neither. | cli-retrieve/audit-unknown-flag |
| D15 | Low | (undocumented asymmetry) | - | search --relation accepts 8 relation types; focus --relations lists 16 - likely intentional, invisible to a reader comparing the two commands | cli-retrieve/search-relation-invalid, cli-retrieve/focus-relations |
| D16 | Low | (undocumented difference) | - | Default --limit is 50 for search and 1000 for query - plausibly intentional, undocumented as a cross-command difference | cli-retrieve/search-json, cli-retrieve/query-json |
| D17 | Medium | "These twenty-five are all of them" | README:2771 | 36 distinct flags appear across the 66 command files alone | slash/command-references-real-surface |
| D18 | Medium | "the 38 commands" | README:1780 | 66 command files ship (independently, README:1723 elsewhere already says "66 slash commands" correctly) | slash/file-count |

**Suggested fix (all six).** A text correction in each case - update the README wording (D1, D17, D18) or add the missing documentation (D12, D15, D16). D18 additionally feeds D22 above, where the same stale number surfaces at the live install-verification step with an added complication the author should read there.

> **D17 and D18 are superseded** by `D1-A1`/`D2-079`/`B-009` and `D1-013` in the
> next section, which give exact counts. D17's "36 flags" was itself low: the
> tables hold exactly 25 rows and **20 further flags run at exit 0**.

---

## README findings — the claim audit, verified

Section 16 read all 4,625 lines of `README.md` and produced **716 checkable
claims**: 660 verified, 33 contradicted, 23 unverified. Every contradiction was
then **re-derived independently** here — from source, from a live run, or from
arithmetic — because a claim audit is a lead generator, not a finding list. One
lead (`D2-032`) did not survive that re-derivation and is recorded under
"Disproven" below.

**Result: 33 of 33 confirmed.** Ids trace to `reports/claims/section-*.md`.

### Are these safe to edit?

`npm run gen:docs` (`scripts/gen-doc-examples.ts`) replaces the text *between*
`<!-- example: … -->` and `<!-- /example -->`, and `test/docs/examples.test.ts`
re-runs each command and diffs the result. Hand-editing inside a marked block is
reverted by the next generate and fails the suite.

The README has **50 generated blocks covering 1,391 of 4,625 lines (30%)**.
**All 33 findings fall in hand-written prose; none is inside a generated block.**
One fix (`E1-084`) moves a marker pair rather than editing its body, which is
safe — the generator regenerates in place wherever the markers sit.

---

### Cluster 1 — the v1.0.0 release never swept the document's self-description

Three claims, one root cause: section 12 describes a pre-release project. One
release sweep closes all of them, plus a code defect (`F3`) with the same origin.

| ID | Claim | Where | Actual |
|---|---|---|---|
| `F-091` | "Nothing has been released or tagged yet … there are no git tags … the `0.1.0` the manifests carry" | README:4515–4522 | Tags **`v0.9.0`** (2026-08-16) and **`v1.0.0`** (2026-08-17). `CHANGELOG.md` has released sections `## [1.0.0]` (:31) and `## [0.9.0]` (:213), and says at :9 "`0.9.0` is the first tagged version". `package.json:3` and `.claude-plugin/plugin.json:3` both read **`1.0.0`** — no `0.1.0` in either |
| `F-090` | "**Linux is covered by CI and not certified by a run this project has seen.**" | README:4509–4514 | `docs/ROADMAP.md` row E1 is struck through and replaced with "**Certified 2026-08-16: run 31965803312 (`e1-linux-finish`, 79eb359) is green on both jobs**", with a per-claim account of the ubuntu logs. Row status `✅ 2026-08-16` |
| `F-059` | "**This is the only section of this document where unbuilt behaviour appears.** … Every entry below names something this project does not have" | README:4264–4267 | Two entries below name capabilities the project **has** — the two above. The section's own invariant (README:4275) is that nothing stays once it ships |

**Verification:** `git for-each-ref refs/tags` → `v0.9.0 2026-08-16 d548938`,
`v1.0.0 2026-08-17 9e6a343`; `grep '"version"' package.json .claude-plugin/plugin.json`
→ both `1.0.0`; `grep '^## \[' CHANGELOG.md` → `[Unreleased]`, `[1.0.0]`, `[0.9.0]`.

**Fix.** Rewrite README:4509–4522 to state the shipped facts; delete the two E1
entries from the unbuilt-behaviour section so `F-059`'s invariant holds again.
`F-059` needs no edit of its own once they are gone — which is the point of
fixing the cause rather than the sentence.

**Same root cause, in code — `F3`.** `src/mcp/protocol.ts:33` still reads
`export const SERVER_INFO = { name: 'mycontext', version: '0.1.0' };`. Every MCP
client is told the server is `0.1.0`. `scripts/set-version.ts` exists and did not
reach this constant. **This is the only code change among the documentation
findings**, and it is the one with user-visible effect on a protocol surface.

---

### Cluster 2 — `known_issue` is on the wrong side of the trust boundary, in the docs

`src/core/categories.ts:57` defines `known_issue` as **normative**, and the
21-line comment above it (`:44–56`) explains why it was moved off the rationale
tier: a rationale item "reached a session as the digit in `1 known_issue` and
nothing else." The README describes the world before that change — in the two
places that state the trust consequence.

| ID | Claim | Where | Actual |
|---|---|---|---|
| `D1-017` | the normative `add-*` list — 12 commands | README:1790–1794 | 13 normative categories; `add-known-issue` is missing from the list |
| `D1-018` | the rationale list includes `add-known-issue`, and these "land active, because rationale is never injected and so cannot silently steer anything" | README:1795–1799 | An agent-captured known issue lands **draft**, and it **is** injected. Both halves of the justification are inverted for this one category |
| `E1-084` | "The order is the table's: the normative types first, then the rationale ones" | README:3279 | The specimen run is `… invariant (3332) → non_goal (3344) …` with no `known_issue`; its block sits at **3473**, between `edge_case` (3462) and `lesson` (3486) — inside the rationale run |

**Verification:** tier census of every `def()` in `categories.ts` → **13
normative, 8 rationale**, `known_issue -> normative`. Specimen order read
directly from the 22 `<!-- example: examples … -->` markers.

**Severity note.** `D1-018` is the most consequential documentation defect in
this report. It tells a reader that an agent-captured known issue is inert and
unreviewed, when it is in fact staged for human review *and* injected — the exact
inversion of the trust boundary the plugin's section 7 is built to explain.

**Fix.** Move `add-known-issue` from the rationale list to the normative one in
both sentences; move the specimen block (marker pair and body) from 3473 to
between `invariant` and `non_goal`.

---

### Cluster 3 — `tags` and `severity` **do** affect injection, through focus

Both fields are documented as inert with respect to injection, in five places.
`src/core/select.ts` disagrees, and so does the README elsewhere.

```ts
// select.ts:228 — the tag axis, inside matchesFocus
if (focus.tags.length > 0 && !focus.tags.some((t) => item.tags.includes(t))) return false;

// select.ts:242-246 — the severity exemption, inside focusHides
export function focusHides(item: Item, focus: Focus | null, config: Config): boolean {
  if (!isFocusActive(focus)) return false;
  if (item.severity === 'hard') return false;      // <-- decides *whether*, not order
  return !matchesFocus(item, focus, config);
}
```

| ID | Claim | Where |
|---|---|---|
| `B-006` | "`--tags uploads` … They change nothing about when an item is injected" | README:427 |
| `B-078` | "`tags` \| free-form labels … They affect nothing about injection" | README:1224 |
| `B-075` | "`severity` … It does not change whether an item is injected, only the order" | README:1221 |
| `F-060` | "`severity: hard` changes exactly one thing: hard items are admitted to a tier's budget before soft ones" | README:4291–4292 |
| `F-110` | glossary: "**severity** … It changes the order items are admitted to a budget, nothing else" | README:4610 |

A sixth instance sits in the flag table itself — the `--tags` row at README:2798
repeats "They affect nothing about injection".

**Runtime confirmation.** `mycontext focus db --preview` on a four-item corpus:

```
2 item(s) in focus, 2 hidden by focus (of the eligible corpus).
hidden by focus — still in the corpus, still readable with `mycontext show`:
  LESSON-prefer-small-diffs
  REQ-checkout-completes-in-two-steps
1 severity:hard item(s) do not match this focus and are injected anyway — focus never hides one:
  CONST-never-commit-a-secret
```

Two items removed from injection **by a tag focus**; one item kept **because its
severity is hard**. Both claims falsified in a single command.

**The document already knows.** README:2484 ("**Focus never hides a
`severity: hard` item.**"), README:2719 ("It cannot hide a `severity: hard`
item") and the `focus_context` MCP tool description all state it correctly. This
is a self-contradiction, not a misunderstanding.

**Fix.** Qualify all six: the fields are inert **when no focus is set**. The
accurate sentence already exists at 2484 and can be referenced.

---

### Cluster 4 — "These twenty-five are all of them"

| ID | Where | Claim |
|---|---|---|
| `B-009` | README:436 | "All twenty-five options the CLI takes are listed together" |
| `D1-A1` / `D2-079` | README:2771 | "These twenty-five are all of them." |

**The row count is exact.** The three tables hold 9 + 12 + 4 = **25** rows:
`--short --full --summary --json --quiet --sessions --all --limit --type` /
`--body --note --scope --tags --severity --always --title --directive --extra --status --by --reason` /
`--yes --anchor --file --stdin`.

**The totality claim is not.** Twenty further flags were run to exit 0:

| Command | Flags absent from all three tables |
|---|---|
| `focus` | `--preview` `--show` `--clear` `--relations` `--category` |
| `search` | `--tag` `--text` `--path` `--relation` |
| `audit` | `--since` `--until` `--item` `--session` `--op` `--origin` `--kind` `--role` `--items` `--files` |
| `edit` | `--unlink` (in `edit`'s own usage banner) |
| `review` | `--revision` `--force` (`review.ts:78–79`) |

Six of the `audit` flags are documented **in this same section** at
README:2298–2306. The document contradicts itself across 500 lines.

**Fix.** Either add the missing rows, or replace the totality claim with a
pointer to `mycontext help <command>`. Recommended: the latter for the intro at
436, the former for the reference table at 2771 — a flag reference that is
knowingly partial is worth less than one that is complete.

---

### The remaining nineteen

Each independently re-derived. "Fix" is the edit this campaign will make.

| ID | Where | Claim → what is actually true | Fix |
|---|---|---|---|
| `A-037` | README:244–245 | "`mycontext audit replay-ledger` rebuilds **whole**" → `audit.ts:230–238` calls `topUpLedger`, position-tracked per segment (`ledger-replay.ts:6–14`, "cost is O(new records), not O(log)"); a whole rebuild happens **only on divergence** (`:28`). Observed: `replayed 6 row(s).` then `replayed 0 row(s).` twice | "tops up incrementally, and rebuilds whole if the log has diverged" |
| `B-030` | README:649 | "**The extraction request, in full** — 244 lines" → the block it labels is README:653–916 = **264 lines** | `244` → `264` |
| `B-053` | README:1043 | "There is **no slash command for ingest**; the CLI and the tool are the two surfaces it has" → `commands/ingest.md` ships | say three surfaces |
| `C-026` | README:1434–1436 | "**No scope means no restriction.** An item with no scope patterns applies to every file" → `select.ts:191–193`: `if (item.scope.length === 0) return scopePolicyFor(config, item.type) !== 'inert';` — under `scopePolicy: "inert"` an unscoped item applies to **no** file. The caveat exists at README:1223 and :3864 but not in this **bolded guarantee**, which section 4 presents first | carry the caveat into the guarantee |
| `C-058` | README:1597–1598 | "`pin`, `unpin`, `harden`, `soften`, `supersede` and `review promote` refuse **in the same words**" → five call `globalLayerRefusal` (`persist.ts:209–213`, *"…cannot be **modified** from this project"*); `review promote` uses a hand-written literal (`review.ts:691–696`) with an **unquoted id** and *"cannot be **promoted or discarded**"* | "five in the same words; `review promote` says the same thing in its own" |
| `D1-013` | README:1780 | "the **38 commands** and the `mycontext` skill" → **66** command files; `claude plugin details` prints no commands line at all, labelling them `Skills (67)`. Stale-38 fossil at `test/plugin/commands.test.ts:282` | correct count **and** the output string |
| `D1-023` | README:1837 | "**Every one of those previews** by running the CLI command without `--yes`" → `test/plugin/write-commands.test.ts:66–73` exempts `link.md` by name: *"`link_items` is an MCP tool call, not a CLI command — there is nothing to dry-run"* | "every one except `/mycontext:link`, which writes through the MCP tool" |
| `D1-058` | README:1998 | "the same removal was made to `mycontext decay` (170 columns to **97**)" → measured on the plugin's own corpus: widest box line **100 characters**, 2 of which are the report indent → **98 columns**. (Measure in characters: `awk length()` counts bytes and box-drawing glyphs are 3 bytes each, which reads 108) | `97` → `98` |
| `D1-076` | README:2275 | "rather than as one **284**-character line" → `COLD_CAVEAT` (`decay.ts:28–32`) is **282** characters. The alternative reading, caveat + following sentence, is 369 — neither yields 284 | `284` → `282` |
| `D2-025` | README:2461–2465 | presented as what `mycontext focus` prints: "`7 item(s) hidden by focus, 2 load-bearing relation(s) now dangling`" → it prints **two separate lines**, and the word "now" never appears: `2 item(s) in focus, 2 hidden by focus (of the eligible corpus).` … `0 load-bearing relations dangling.` The quoted string **is** verbatim-correct for the *injected block*, a different renderer (`render.ts:112–137`) | attribute the string to the right renderer |
| `D2-043` | README:2609–2610 | "the `query_items` tool filters by tag, and **no CLI command does**" → `mycontext search --tag db` returns the tagged item, exit 0; `--tag` is in `search`'s own registry usage | delete the clause |
| `D2-049` | README:2633–2634 | "for that one statement the keyword check is **the only barrier there is**" → `cmdQuery` never sends the caller's SQL as written; `withRowCap` (`query.ts:260–262`) wraps it as `SELECT * FROM (\n<sql>\n) LIMIT n`, and `VACUUM INTO` is a syntax error inside a subquery. **Understates its own protection** | name the second barrier |
| `D2-089` | README:2836–2839 | the list of commands that check unknown flags → all 11 named do, but **five more** also refuse at exit 1: `focus`, `audit`, `search`, `refresh`, `examples` | add the five |
| `D2-091` | README:2841–2845 | the list that does **not** check, "**Verified by running each of them**" → two are misfiled. `examples --zzznope` → `unknown option "--zzznope"`, exit 1. `init --zzznope` → *"Nothing was created — an argument this command cannot act on is **refused rather than ignored**"*, exit 1 — the message says the opposite of the claim | move both; drop or re-earn the "verified by running" assurance |
| `E1-082` | README:3273 | "`--short` … the id, the title, the **category-specific** frontmatter fields, and the body" → `exampleItemShort` (`help/index.ts:414–431`) also emits `source_file`, `severity: hard`, `always: true` and `observations:`. None is category-specific — the first three are on every item (`item.ts:36–39`, `COMMON_KEYS`), and observations are not frontmatter. The README's own adjacent specimens show `severity: hard` on `constraint`, which declares `extraFields: []` | enumerate what it actually prints |
| `E2-094` | README:3974 | on a rationale item, `always: true` and `severity: hard` are "**refused**, by every write surface: `mycontext add`, `create_item`, `update_item`, `review promote` and ingest" → `mycontext add lesson … --always` returns **`unknown option "--always"`** with a usage line that has no such flag; ingest **hardcodes `always: false`** for every candidate and its inert check is `if (severity === 'hard')` only (`ingest/schema.ts:314–326`). Neither surface can *express* the field, so neither refuses it. The other three quarters hold verbatim | "refused where it can be expressed; on `add` and ingest it cannot be" |
| `F-032` | README:4124–4126 | "Promoting one therefore leaves **the others** stale … and the promotion names exactly which ones it just invalidated" → only **same-field** revisions go stale. `revision-view.ts:216` prints the opposite for the cross-field case: *"a different field, unaffected by promoting this one"* | **README:4112 already says it correctly** — "Staleness is per field … a title proposal beside it stays promotable." Align 4124 to 4112, twelve lines above it |
| `F-097` | README:4583 | glossary: "**active** … An item is active because a **human** made it so" → every rationale-tier capture by an agent lands `active` with no human act. Live-verified as `LIVE-PASS.md` L14; README:4040–4042 states it correctly 500 lines earlier | add the third route |
| `F-113` | README:4616 | glossary: for a `validated` item, "**an agent cannot supersede it**" → the guard is `if (origin !== 'human' && governsNormatively(ctx, retired))` (`mutate.ts:789`), and its own comment says *"…or any rationale-tier item is harmless and **stays allowed**"*. An agent **can** supersede a validated *rationale* item | "cannot supersede a validated **normative** item" |

---

### Disproven — the campaign's fifth false finding

`D2-032` claimed `.my_context/state/focus.json` is not gitignored, citing
`git check-ignore` exit 1 in a real repo. **It is false.**
`.my_context/state/.gitignore` is `*` (2 bytes, `od -c` → `*  \n`),
`git check-ignore -v` exits **0** naming the rule, and
`git ls-files .my_context/state/` returns nothing. The agent almost certainly ran
`check-ignore` inside its non-git `$TEMP` workspace, where the command exits 1
for every path.

Had this been fixed on the strength of the report, correct documentation would
have been rewritten to describe a defect that does not exist. It is the reason
every one of the other 33 was re-derived before reaching this section.

## Verified correct

The plugin got a great deal right. This table lists documented claims the captured evidence directly confirms - it is as load-bearing to this report as the Findings section above.

#### CLI - capture & inspection

| Claim | Where documented | Evidence |
|---|---|---|
| A comma-separated --scope and a repeated --scope flag produce byte-identical stored state | README:1926 | cli-capture/add-scope-comma-readback, cli-capture/add-scope-repeated-readback (identical checksum 70715f966872a352) |
| One observation is stored per --note occurrence | - | cli-capture/add-note-repeated-readback |
| init on a pristine directory exits 0 and creates the workspace | - | cli-capture/init-on-pristine-dir |
| The plugin ships 66 slash commands | README:1723 | slash/file-count (66 actual, matching this specific claim - contrast D18 above, which is a different README line quoting 38) |

#### CLI - mutation & lifecycle

| Claim | Evidence |
|---|---|
| supersede records the retirement relation in both directions | cli-mutate/supersede-ok-readback-retiring, cli-mutate/supersede-ok-readback-replacement |
| pin genuinely sets always: true; harden genuinely sets severity: hard | cli-mutate/pin-readback, cli-mutate/harden-readback |
| review list --type has its own empty-state message rather than silently ignoring the filter | cli-mutate/review-list-type |
| No such id guidance differs appropriately between edit and review | cli-mutate/edit-missing-id, cli-mutate/review-show-missing |
| --yes gating is uniform across every mutation command once real work is pending - unpin, soften, and refresh all correctly refuse without --yes when there is something to change | cli-mutate/unpin-from-pinned-no-yes, cli-mutate/soften-from-hard-no-yes, cli-mutate/refresh-drifted-no-yes |
| doctor raises source_drift (1) [warn] after a file-snapshot item drifts from its source | cli-mutate/refresh-drifted-readback |
| repair reaches its re-stamp branch and re-stamps as documented | cli-mutate/repair-with-yes-readback |
| review promote flags land: severity: hard, always: true on the promoted draft | cli-mutate/review-promote-flags-readback |

#### CLI - retrieval, audit, focus

| Claim | Evidence |
|---|---|
| query --json returns exactly {rows, rowCount, truncated, limit, loadErrors} | cli-retrieve/query-json |
| SELECT * FROM ledger fails with exactly "no such table: ledger" on a bare rebuild | cli-retrieve/query-ledger-missing-table |
| query refuses INSERT/DROP/PRAGMA, naming the offending keyword, and allows WITH ... SELECT | cli-retrieve/query-insert-refused, cli-retrieve/query-drop-refused, cli-retrieve/query-pragma-refused, cli-retrieve/query-with-cte-allowed |
| decay prints its caveat at default detail, with --summary, and in --json alike | cli-retrieve/decay-bare, cli-retrieve/decay-summary-still-prints-caveat, cli-retrieve/decay-json |
| focus never hides a severity: hard item | cli-retrieve/focus-hard-item-never-hidden |
| focus --tag is real and equals the positional tag form | cli-retrieve/focus-tag-flag, cli-retrieve/focus-positional-tag |
| audit --item and audit --limit genuinely discriminate | cli-retrieve/audit-item, cli-retrieve/audit-limit |
| focus --category and focus --tag are independently wired, not aliases | cli-retrieve/focus-category, cli-retrieve/focus-tag-flag |
| search positional argument and --text are equivalent; both-at-once and zero-filters are both refused | cli-retrieve/search-positional, cli-retrieve/search-text-flag, cli-retrieve/search-both-forms-refused, cli-retrieve/search-no-filter-refused |
| --until 2020-01-01 and --since 2099-01-01 both correctly return "no audit records match" against audit-bare's 6 records | cli-retrieve/audit-until-past, cli-retrieve/audit-since-future |
| --op create and --op update genuinely discriminate (6 vs. 1 record) | cli-retrieve/audit-op-create-discriminates, cli-retrieve/audit-op-update-discriminates |
| focus --show with an active focus reports the tag, item count, and hidden count correctly | cli-retrieve/focus-show-with-active |
| audit --items --role subject works - --role does function inside --items (contrast D10/D11, where it does nothing outside --items) | cli-retrieve/audit-items-role-subject |

#### CLI - ingest & lesson pipelines

| Claim | Evidence |
|---|---|
| A verbatim quoted candidate is accepted by ingest-apply | cli-pipelines/ingest-apply-real-session |
| A paraphrased candidate is rejected with an actionable message naming the session and anchor | cli-pipelines/ingest-apply-paraphrase-rejected |
| An empty candidate array marks the section done and advances to the next chunk | cli-pipelines/ingest-apply-empty-candidates |
| Ingest-created items land as DRAFT with origin: ingest | cli-pipelines/ingest-apply-real-session-readback |

#### MCP tools

| Claim | Evidence |
|---|---|
| Agent-created NORMATIVE items land as drafts, appear in list_drafts, and are absent from an active query | Task 11 MCP sweep (normative create + list_drafts + query_items triplet) |
| Agent-created RATIONALE items land active and are absent from list_drafts - the documented tier contrast | Task 11 MCP sweep |
| create_item is genuinely idempotent - a repeated identical call returns "already captured ... Nothing changed," and query_items shows exactly one item | mcp/create_item-idempotent, mcp/create_item-idempotent-readback |
| update_item stages rather than applies - get_item shows the old title plus "1 pending revision(s)" | mcp/update_item-title-effect |
| supersede_item records the relation in both directions | mcp/supersede_item-rationale-effect |

#### Hooks

| Claim | Where documented | Evidence |
|---|---|---|
| SessionStart's injection format matches exactly: the header line, the id/type/title heading format, the index heading, index lines, the rationale count line, and the closer line | README:144, 146, 1275, 1277, 1281, 1282 | hooks/session-start-startup (all six confirmed in one record) |
| A zero-item corpus produces byte-empty stdout on SessionStart | - | hooks/session-start-empty-corpus |
| The deny surface correctly denies all 10 tested path-spelling variants (items, focus, index, .my-context hyphen, the generic config.json branch, dotdot, backslash, mixed case, NotebookEdit, MultiEdit) | - | hooks/pre-tool-use-deny-* (10 records) |
| A Read of a managed path is never denied | - | hooks/pre-tool-use-deny-read-allowed |
| JIT correctly delivers an unscoped item to any file, even when a different, scoped item's glob doesn't match | README:1313 | hooks/pre-tool-use-scoped-miss |
| A scoped item is correctly withheld from a non-matching path and delivered to a matching one | - | hooks/pre-tool-use-scoped-billing-hit, hooks/pre-tool-use-scoped-billing-miss |
| Fail-open on malformed hook stdin is genuinely silent - no parse-failure text leaks | - | hooks/session-start-garbage-stdin, hooks/pre-tool-use-garbage-stdin, hooks/pre-compact-garbage-stdin |
| Resume and clear behave identically to a fresh startup | - | hooks/session-start-resume, hooks/session-start-clear |

#### Config, categories, profiles

| Claim | Where documented | Evidence |
|---|---|---|
| Profile "full" is refused by name, with the removal note | README:2864 | config/profile-full-refused |
| A disabled category refuses new items | - | Task 13 config sweep |
| An unrecognized top-level config key is refused by name | README:3905 | Task 13 config sweep |
| extraFields is refused by name | README:3640 | Task 13 config sweep |
| scopePolicy: "required" refuses a captured item with no scope, at capture time | README:3866 | Task 13 config sweep |
| A configured id-prefix override is honored | README:3625 | Task 13 config sweep |
| A custom category security_control derives the prefix SECURI- | README:3616 | Task 13 config sweep |
| The headline invariant - nothing is dropped silently for budget reasons. Two pinned items against a 40-token pinned budget name the excluded items in the omission note | README:1686 | config/budgets-spill-pinned |
| Index overflow produces the documented "+N more" note | README:1696 | config/budgets-index-overflow |

#### Slash commands

| Claim | Evidence |
|---|---|
| All 21 built-in categories have both an add-<slug> and a list-<slug> command file - zero missing, zero orphaned | slash/category-command-parity |
| README's own "66 slash commands" claim (README:1723) is correct | slash/file-count |

## Coverage gaps

**Task 15 (the live pass) is incomplete.** Only the install phase ran before a required restart interrupted it; D22 above is the one finding that phase produced. Everything needing a live, restarted Claude Code session - whether SessionStart actually fires on restart, whether the retired task-orchestrator hooks are really gone, live execution of the ~10 documented slash commands and their --yes-preview behavior, live JIT injection and the deny envelope as a real user sees them, a live claude mcp list check of F3's version mismatch, and whether the hook schema's if: field can narrow PostToolUse to watchedDocs globs and skip the spawn on non-matching writes - was never run. Closing this needs a session restart and someone to work through the six-step live-pass checklist this campaign left behind.

**Task 16 (the full README claim audit, ~180 claims) never started.** reports/CLAIMS.md does not exist. Everything in this report's Findings and D-DOC sections was found opportunistically while building the CLI/MCP/hooks/config/slash test cases, not through a systematic claim-by-claim pass. Several additional stale-doc candidates were flagged as worth checking but were never independently confirmed with evidence in this campaign - they are not included above because no captured record backs them, only unverified prose: whether section 8 still claims nothing is tagged when v1.0.0 is; whether section 8 still calls Linux uncertified when the roadmap records certification; whether "there is no slash command for ingest" is contradicted by commands/ingest.md; whether VERSIONING.md still describes the project as 0.x with stale counts; and whether "the same twenty categories" undercounts the actual 21-category catalogue (the catalogue's size of 21 is independently confirmed by slash/category-command-parity, but the specific "twenty categories" prose claim was not checked against it). A full claim audit would confirm or retire each of these.

**Windows-only.** Every finding above is scoped to Windows 11 Pro 26300 / Node v24.14.0 / Claude Code 2.1.233. Linux and macOS were never exercised. The path-canonicalization findings in particular (the deny-surface tests) may behave differently on POSIX systems.

**Deny-surface path spellings.** 10 of the documented Windows path-spelling variants were tested and denied correctly (dotdot, backslash, mixed case, the .my-context hyphen spelling, the generic config.json branch, plus NotebookEdit/MultiEdit). Four remain untested: 8.3 short names, symlinks/junctions, UNC \?\ prefixes, and subst drives.

**Multi-call hook behavior.** Per-session dedupe and post-compaction restore both require more than one hook invocation against the same workspace to observe; the harness runs each hook case as a single call in a fresh workspace, so neither is exercised. PreCompact's snapshot write is unverifiable for the same structural reason - the workspace is destroyed before anything can inspect what it wrote.

**Smaller CLI/MCP gaps carried from the sweeps.** doctor --quiet and doctor --full cannot be distinguished on a zero-finding workspace (both produce the same output when there is nothing to report). supersede --reason was accepted but never read back to confirm it is actually stored. edit --unlink's mutation path needs a pre-existing link as setup, which wasn't provided in this campaign. link_items has no CLI-surface equivalent to compare against (it is MCP-only).

**Harness limitations worth knowing about (not plugin gaps).** The MCP client's close() has no bounded fallback if a child process never exits, and was not stress-tested across long sequential runs. Captured stdout/stderr have no size cap. Multi-byte characters split across a chunk boundary in the raw CLI capture could in principle become replacement characters (U+FFFD) - low risk given rendering was pinned to MYCONTEXT_ASCII=1 throughout.

## Environment restoration

Four things were disabled so the plugin's hooks could be observed without interference from other installed hooks/plugins. All are reversible; ask before restoring, since the quieter environment may be preferred in the meantime. The mycontext plugin itself should stay installed - that was the point of the exercise.

```bash
# 1. GSD hooks - the whole "hooks" block was removed from ~/.claude/settings.json.
#    Verbatim backup: ~/.claude/settings.backup-2026-08-17-mycontext-test.json
#    (restore by copying the "hooks" block back from the backup)

# 2. gsd-2 MCP server:
claude mcp add gsd-2 -s user -- gsd --mode mcp

# 3. Plugins:
claude plugin enable agentic-awesome-skills@antigravity-awesome-skills
claude plugin enable context-management@claude-code-workflows
claude plugin enable agent-orchestration@claude-code-workflows
```
