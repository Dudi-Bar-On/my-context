# my-context plugin — exhaustive test campaign

**Date:** 2026-08-17
**Subject:** `mycontext` v1.0.0 — https://github.com/Dudi-Bar-On/my-context
**Status:** design, awaiting review

---

## 1. Goal

Exercise every feature and option of the `my-context` Claude Code plugin, from both the
human-facing and the model-facing side; audit the documentation against actual behaviour;
and produce a tutorial that takes a new user from nothing to productive.

The output is aimed at the plugin's author, who is still developing it. Every defect must
arrive as a reproducible report with a suggested fix, so it can be acted on without
re-deriving the investigation.

### Success criteria

1. Every element of the surface inventory (§4) has a recorded verdict backed by captured evidence.
2. Every testable README claim (§5) has a recorded verdict.
3. Findings are reproducible from the report alone — command, environment, expected, actual.
4. A new user can follow the tutorial end to end and reach a working, injecting setup.
5. The plugin is installed and demonstrably working in Claude Code when we finish.

### Non-goals

- Rewriting or restructuring the plugin. Fixes are minimal and targeted.
- Testing Claude Code itself, except where its behaviour determines the plugin's.
- Performance benchmarking beyond the repo's own `test:perf` suite.
- macOS and Linux verification. This campaign runs on Windows 11 / Node 24.14.0 only,
  and every finding is reported with that scope attached.

---

## 2. Environment

| Item | Value |
|---|---|
| OS | Windows 11 Pro 26300 |
| Node | v24.14.0 (plugin requires `>=24.0.0`) |
| Claude Code | 2.1.233 |
| Plugin version | 1.0.0, tag `v1.0.0`, commit `2f306ad` |
| Clone | `D:\Users\UserC\source\repos\test_mycontext_plugin\my-context` |
| Workspace | `D:\Users\UserC\source\repos\test_mycontext_plugin` |

### Interference removed before testing

The plugin hooks `SessionStart`, `PreToolUse`, `PostToolUse` and `PreCompact`. Anything else
on those events corrupts our observations, so the following were disabled. All are restorable.

| Removed | Why | Restore |
|---|---|---|
| 8 GSD hooks in `~/.claude/settings.json` | 3 × `PreToolUse` on `Write\|Edit` — one (`gsd-read-guard.js`) injects context on the same event as JIT injection; plus `PostToolUse` on `Read` and on `Write\|Edit` | Restore `hooks` block from `~/.claude/settings.backup-2026-08-17-mycontext-test.json` |
| `gsd-2` MCP server | ~100 tools incl. `memory_query`, `capture_thought`, `gsd_graph` — domain overlap | `claude mcp add gsd-2 -s user -- gsd --mode mcp` |
| `agentic-awesome-skills` | ~800 skills incl. `agent-memory-*`, `memory-systems` — overlap and listing noise | `claude plugin enable agentic-awesome-skills@antigravity-awesome-skills` |
| `context-management`, `agent-orchestration` | `context-save`/`context-restore` skills, context-manager agent | `claude plugin enable <name>@claude-code-workflows` |

Left in place deliberately: `superpowers` (in use, `SessionStart` injection is additive text we
can account for); `claude-mem` and `storybook-assistant` (already disabled). `task-orchestrator`
needs no action — v3.6.0 ships no `hooks.json`; the `SessionStart` injection came from v2.0.0
and disappears on restart. **This must be confirmed after the first restart**, not assumed.

---

## 3. Baseline

`npm ci` and `npm run typecheck` pass. `npm test` gives **2308 pass, 11 fail**.

All 11 failures share one cause: on Node 24.14.0 `node:sqlite` emits
`ExperimentalWarning: SQLite is an experimental feature` to stderr, and these tests assert
stderr is byte-empty. Verified by running a hook binary directly — stdout was correct and
exit code 0, with 169 bytes of warning on stderr.

- `test/hooks/hook-binaries-e2e.test.ts` — 9 failures
- `test/mcp/server-e2e.test.ts` — 2 failures

**This set is pinned as known-red.** Any test outside it that fails during the campaign is new
and must be investigated. Re-running the baseline before and after each phase guards against
our own contamination.

---

## 4. Surface inventory

Established by direct source reading, not from the documentation.

| Surface | Count | Notes |
|---|---|---|
| CLI commands | 30 | 7 builtin + 23 registered; ~90 distinct flags |
| MCP tools | 14 | `additionalProperties: false`; undeclared args refused |
| Slash commands | 66 | 21 `add-*`, 21 `list-*`, 23 other, plus `LoadMyContext` |
| Hooks | 4 | `SessionStart`, `PreToolUse`, `PreCompact`, `PostToolUse` |
| Skill | 1 | `skills/mycontext/SKILL.md` |
| Categories | 21 | 13 normative, 8 rationale |
| Config keys | 4 top-level, 4 budget, 6 per-category | plus `watchedDocs` |

Known asymmetries to probe deliberately, because they are where behaviour is least likely to
match expectation:

- 10 commands skip the shared unknown-flag refusal (`init` is documented as one of them but
  actually refuses — already a suspected doc defect).
- `audit replay-ledger` is a hidden positional subcommand.
- `audit --until` and `audit --role` are real and appear nowhere in the README.
- `focus --show` and `focus --tag` are real and under-documented.

---

## 5. The two-axis coverage model

Testing the code alone misses documentation defects; testing the documentation alone misses
undocumented behaviour. Crossing the two sorts every element into four buckets:

| | Behaves as specified | Misbehaves |
|---|---|---|
| **Documented** | ✅ verified | 🔴 defect — code or doc is wrong |
| **Undocumented** | 🟡 doc gap | ⚫ latent bug |

Both off-diagonal buckets are already known to be populated, which is why the model earns its
keep: `audit --until` / `--role` are 🟡, and the README's *"These twenty-five are all of them"*
flag table omitting at least 15 real flags is 🔴.

The claim oracle is a list of ~180 discrete, verifiable README assertions extracted verbatim
with file and line references — counts, exact output strings, defaults, refusal messages,
matchers, budgets, and behavioural guarantees.

---

## 6. Harness

A driver script runs each case in a disposable workspace and appends one JSONL record per case:

```
{ "id", "surface", "command", "argv", "cwd", "exitCode", "stdout", "stderr", "durationMs" }
```

Rules that make the evidence trustworthy:

- **Never touch the repo's own `.my_context/`.** Every case runs in a fresh temp workspace
  created by `mycontext init`. Mutating commands (`review promote`, `lesson-accept`,
  `supersede`, `edit`, `repair`) would otherwise corrupt the author's dogfooded corpus.
- **Pin the rendering environment.** `MYCONTEXT_WIDTH` and the ASCII/Unicode selection are set
  explicitly, so table assertions do not depend on the terminal.
- **Record exit codes as first-class results.** The plugin distinguishes exit 0 from exit 1
  deliberately (`mycontext` bare exits 1, `--help` exits 0; only `status` and `doctor` exit
  non-zero on corpus load errors). Any harness that only captured stdout would miss this.
- **Capture stderr separately from stdout.** Finding #1 exists precisely because the two were
  conflated; the MCP server's contract is that stdout carries only protocol messages.

MCP tools are driven over stdio with hand-written JSON-RPC, matching how Claude Code speaks to
the server. Hooks are driven by piping synthetic payloads to the hook binaries.

---

## 7. Phases

| Phase | Work | Parallelism |
|---|---|---|
| 0 | Environment prep, baseline pinned | done |
| 1 | Build and self-test the harness | single |
| 2 | Surface sweep — CLI batches, MCP tools, hooks, config/categories | subagents in parallel per group |
| 3 | Claim audit — ~180 README assertions against recorded behaviour | subagents in parallel per section |
| 4 | Live pass in Claude Code — install, restart, verify slash commands, session injection, JIT injection, deny envelope, PreCompact restore | sequential, needs user restarts |
| 5 | Deliverables | subagents draft, single reviewer merges |

Phase 4 is the only phase requiring the user. Restart points are batched so there are as few as
possible, and everything that can be verified without a restart is verified before we ask.

Subagents return structured findings, never raw transcripts. Each finding carries its evidence
record id so any claim in the final report can be traced back to a captured run.

---

## 8. Deliverables

Written to `test_mycontext_plugin/reports/`, outside the plugin clone.

1. **`FINDINGS.md`** — developer-facing. Per finding: id, severity, surface, environment scope,
   reproduction, expected vs actual, evidence id, `file:line`, and a suggested fix. Ordered by
   severity. This is the artifact handed to the author.
2. **`COVERAGE.md`** — the two-axis matrix. Every inventory element and every README claim with
   its verdict. Explicitly lists anything *not* covered and why — an audit that hides its own
   gaps is worse than one that admits them.
3. **`TUTORIAL.md`** — quickstart walkthrough plus reference appendix. The walkthrough takes a
   new user from install to a working injecting setup: install → `init` → capture a constraint →
   see it injected at session start → scope it and watch JIT injection fire → review a draft →
   search and query. Every command and every output block is copied from a captured run, never
   written from memory. The appendix tabulates every command, tool and flag with verified status.
4. **Fix branch** (in the clone) — optional and secondary. The report is the primary artifact:
   the author is actively developing the plugin and wants to make the fixes themselves. A commit
   is written only where the fix is unambiguous — a defect that blocks installation or use, or a
   factual documentation correction. Anything requiring design judgement (which of two
   contradictory statements is the intended one, whether a missing flag should be documented or
   removed) is reported with options and left for the author to decide. Never pushed.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Our tests corrupt the dogfooded corpus | Disposable workspaces only; the repo's `.my_context/` is read-only to us |
| Known-red baseline masks a new regression | Failure set pinned by name; re-run and diff, never eyeball |
| Windows-only results reported as universal | Every finding carries its environment scope; CI covers Linux, we do not |
| Subagent reports drift from evidence | Findings must cite an evidence record id; unciteable claims are dropped |
| Restart-dependent behaviour assumed rather than observed | Phase 4 observes it; nothing about live hook behaviour is asserted before then |
| Disabled plugins forgotten and left off | Restore commands recorded in §2 and repeated in `FINDINGS.md` |

---

## 10. Findings already established

Recorded here so the campaign starts from a known state; both carry full detail in `FINDINGS.md`.

- **F1 — 11 tests fail on Node 24.14.0.** `node:sqlite`'s `ExperimentalWarning` reaches stderr;
  hook and MCP e2e tests assert stderr is empty. Compounding documentation defect: the plugin's
  own `CONST-node-24-no-build-step` item claims Node 24 is *"required for stable node:sqlite"*,
  which is false on 24.14.0. CI pins `node-version: '24'` (floating), so CI was green at release
  and has gone red since on an unchanged commit.
- **F2 — `.mcp.json` cannot resolve `${CLAUDE_PLUGIN_ROOT}` in project scope.** The file sits at
  the repo root and is read as a project MCP config whenever the repo is the working directory,
  where the variable is undefined. Documented install paths set it, so end users are unaffected;
  this bites the author and contributors working inside the repo.
