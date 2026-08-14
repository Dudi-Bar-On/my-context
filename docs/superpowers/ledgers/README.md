# SDD ledgers

Durable copies of the subagent-driven-development ledgers for each plan.

## Why these are tracked

The SDD skill writes its ledger to `.superpowers/sdd/<plan>/progress.md`, which is **gitignored scratch**
inside the plan's worktree. Removing the worktree destroys it — which is exactly what happened to Plan 3's
ledger, after the controller had offered to preserve it. The rulings, the reasoning behind them, and the
cost-if-wrong for each are **not** in git history: commit messages carry the *what*, not the *why it was
decided that way and what it costs if that judgement was wrong*.

So they are copied here and committed.

## The rule

**Never delete a ledger.** Before removing any worktree, copy its ledger — and anything else in the
workspace that is restorable and worth restoring (task reports, review packages worth keeping) — into this
directory and commit it. **When in doubt, stop and ask rather than delete.**

This applies to `git worktree remove`, `ExitWorktree` with `action: "remove"`, `git clean -fdx`, and the
SDD skill's own "delete this plan's workspace when the final review is clean" step — that step is
**overridden** by this rule.

## Contents

| File | Plan | State |
|---|---|---|
| `2026-08-14-plan3-agent-surface-ledger.md` | Plan 3 — agent surface | **Reconstructed** from the session transcript after the original was destroyed. Rulings faithful; per-task reports and review packages lost. |
| `2026-08-15-plan4-capture-curation-ledger.md` | Plan 4 — capture and curation | Complete. 16 tasks, final whole-branch review, two fix waves. |
| `plan4-reports/` | Plan 4 — per-task reports | The 16 implementer reports plus both fix-wave reports, preserved because Plan 3's were lost. |

Plans 1 and 2 predate this practice and have no ledger here; their decisions survive in the design spec,
the plan documents themselves, and the merge commits.
