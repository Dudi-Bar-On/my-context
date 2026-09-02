---
id: RULE-parallel-agents-share-no-mutable-resource-enumerate-and
type: rule
title: parallel agents share no mutable resource - enumerate and isolate before dispatching
status: active
severity: hard
always: true
summary: Before running helpers side by side, list everything they could both write to and give each its own; whatever is left shared will collide on some unlucky day.
summary_of: 8eeefb72092889d9
scope: []
tags:
  - workflow
  - subagents
  - concurrency
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-20
valid_until: null
checksum: 90f3f252f752c501
---

# parallel agents share no mutable resource - enumerate and isolate before dispatching

**Before dispatching agents in parallel, enumerate every mutable resource they share and give each agent its own. A shared resource that nobody enumerated is found only after it has already corrupted something.**

**Three have bitten this project, all in one day, and each was found by accident:**

| Resource | How it bit | Fix |
|---|---|---|
| **The git working tree** | An implementer finishing with `git add -A` would have swept seven other agents' files into its commit; and each would have run the suite against the others' half-finished state. | One **git worktree** per agent, on its own branch. |
| **`node_modules`** | Every worktree junctioned to ONE directory, and an agent was about to `npm install` into it. Eight siblings would have typechecked against a directory mid-rewrite. | A **snapshot copy**, junctioned by the agents that must not see the install. |
| **The scratchpad** | Nine agents were handed the SAME path. Two overwrote each other's mutation-driver scripts mid-run. | A **per-agent subdirectory**, named for the agent. |

**The scratchpad one is the warning, because of how it surfaced.** It changed no result — the agent had already completed and reverted each mutation, and verified the source byte-identical. It was reported anyway, as a finding. **On a different day it would have silently corrupted a mutation battery, and a mutation battery is how everything in this project is verified.** Nothing would have looked wrong.

**The rule when dispatching:**

1. **List what they share.** Working tree, `node_modules`, the scratchpad, `/tmp`, any fixture directory, any lock file, any database.
2. **Isolate each, or prove it is safe to share.** Read-only sharing is fine — a junction to a directory nobody writes costs nothing. Sharing anything an agent *writes* is a defect waiting for a coincidence.
3. **Name the isolated path in every brief.** An agent that is not told where its scratch space is will use the default, which is the shared one.
4. **When isolation is impossible, SEQUENCE instead.** Waiting is cheaper than an unreproducible result. This is why the mockup pass waits for the Playwright suite, and why `security.ts` waits for the plan that specifies it.

**The check that catches the rest.** Ask of each resource: *if two agents write this at the same second, what happens, and would I find out?* If the answer to the second half is "no", isolate it before dispatching — not after a report mentions it.

Related: [[RULE-delegate-to-subagents-reserve-the-context-window-for]].
